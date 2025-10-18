/**
 * Web Crawling API Routes
 *
 * Provides endpoints for crawling web pages, caching content,
 * and searching crawled data with AI-powered summarization.
 */

import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { crawlUtils, crawledContentRepository, domainRepository, urlRepository } from '@promptliano/database'
import type { Domain } from '@promptliano/database'
import {
  startCrawl,
  executeCrawl,
  getCrawlArtifacts,
  type CrawlOptions,
  fetchRobotsTxt
} from '@promptliano/services'
import {
  CrawlRequestSchema,
  CrawlResponseSchema,
  CachedContentResponseSchema,
  CrawlHistoryQuerySchema,
  CrawlHistoryResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  DomainsResponseSchema,
  RobotsTxtResponseSchema,
  UrlHashParamSchema,
  DomainParamSchema
} from '@promptliano/schemas'
import {
  createStandardResponses,
  successResponse,
  withErrorHandling
} from '../utils/route-helpers'

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

// POST /api/crawl - Crawl a URL or website
const crawlRoute = createRoute({
  method: 'post',
  path: '/api/crawl',
  tags: ['Web Crawling'],
  summary: 'Crawl a single URL or multiple pages',
  description:
    'Crawl a web page or entire website with configurable depth. Optionally generate AI summaries and bypass cache.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CrawlRequestSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(CrawlResponseSchema)
})

// GET /api/crawl/cached/:urlHash - Get cached crawl result
const getCachedRoute = createRoute({
  method: 'get',
  path: '/api/crawl/cached/{urlHash}',
  tags: ['Web Crawling'],
  summary: 'Get cached crawl result by URL hash',
  description: 'Retrieve previously crawled content using the MD5 hash of the URL',
  request: {
    params: UrlHashParamSchema
  },
  responses: createStandardResponses(CachedContentResponseSchema)
})

// GET /api/crawl/history - List recent crawls
const getHistoryRoute = createRoute({
  method: 'get',
  path: '/api/crawl/history',
  tags: ['Web Crawling'],
  summary: 'List recent crawls',
  description: 'Get paginated list of recently crawled URLs with metadata',
  request: {
    query: CrawlHistoryQuerySchema
  },
  responses: createStandardResponses(CrawlHistoryResponseSchema)
})

// POST /api/crawl/search - Search cached content
const searchRoute = createRoute({
  method: 'post',
  path: '/api/crawl/search',
  tags: ['Web Crawling'],
  summary: 'Search cached content',
  description: 'Search through cached crawl content with full-text search',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SearchRequestSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(SearchResponseSchema)
})

// GET /api/crawl/domains - List crawled domains with stats
const getDomainsRoute = createRoute({
  method: 'get',
  path: '/api/crawl/domains',
  tags: ['Web Crawling'],
  summary: 'List crawled domains with statistics',
  description: 'Get list of all crawled domains with page counts and last crawl times',
  responses: createStandardResponses(DomainsResponseSchema)
})

// GET /api/crawl/domains/:domain/robots - Get robots.txt for domain
const getRobotsTxtRoute = createRoute({
  method: 'get',
  path: '/api/crawl/domains/{domain}/robots',
  tags: ['Web Crawling'],
  summary: 'Get robots.txt for domain',
  description: 'Retrieve the robots.txt rules and crawl delay for a specific domain',
  request: {
    params: DomainParamSchema
  },
  responses: createStandardResponses(RobotsTxtResponseSchema)
})

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export const crawlingRoutes = new OpenAPIHono()

// POST /api/crawl
crawlingRoutes.openapi(crawlRoute, async c => {
  const { url, maxDepth, summarize } = c.req.valid('json')

  const crawlOptions: CrawlOptions = {
    maxDepth: Math.min(Math.max(maxDepth ?? 1, 1), 5),
    maxPages: 100,
    respectRobotsTxt: true,
    sameDomainOnly: true
  }

  const { crawlId } = await startCrawl(url, crawlOptions)
  await executeCrawl(crawlId)

  const artifacts = await getCrawlArtifacts(crawlId, { limit: crawlOptions.maxPages })
  const contents = await Promise.all(artifacts.records.map(record => crawledContentRepository.getByUrlId(record.urlId)))

  const results = artifacts.records.map((record, index) => {
    const content = contents[index]

    return {
      id: record.urlId,
      url: record.url,
      urlHash: crawlUtils.generateUrlHash(record.url),
      domain: new URL(record.url).hostname,
      status: record.status,
      httpStatus: record.httpStatus ?? null,
      title: content?.title ?? null,
      cleanContent: content?.cleanContent ?? null,
      metadata: (content?.metadata as Record<string, unknown>) ?? null,
      summary: content?.summary ?? null,
      lastCrawledAt: record.crawledAt ?? content?.crawledAt ?? null,
      createdAt: content?.crawledAt ?? Date.now()
    }
  })

  let aiSummary: string | undefined
  if (summarize && results.length > 0) {
    aiSummary = results
      .map(r => r.summary)
      .filter((value): value is string => Boolean(value))
      .join('\n\n')
  }

  return c.json(
    successResponse({
      pagesCrawled: results.length,
      results,
      aiSummary
    }),
    200
  )
})

// GET /api/crawl/cached/:urlHash
crawlingRoutes.openapi(getCachedRoute, async c => {
  const { urlHash } = c.req.valid('param')

  const urlRecord = await urlRepository.getByUrlHash(urlHash)
  if (!urlRecord) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Cached content not found',
          code: 'NOT_FOUND'
        }
      },
      404
    )
  }

  const content = await crawledContentRepository.getByUrlId(urlRecord.id)

  return c.json(
    successResponse({
      url: urlRecord.url,
      title: content?.title ?? null,
      cleanContent: content?.cleanContent ?? null,
      metadata: (content?.metadata as Record<string, unknown>) ?? null,
      summary: content?.summary ?? null,
      lastCrawledAt: content?.crawledAt ?? urlRecord.lastCrawledAt ?? null
    }),
    200
  )
})

// GET /api/crawl/history
crawlingRoutes.openapi(getHistoryRoute, async c => {
  const { limit, offset } = c.req.valid('query')

  const allUrls = await urlRepository.getAll('desc')
  const paged = allUrls.slice(offset, offset + limit)

  const contents = await Promise.all(paged.map(urlEntry => crawledContentRepository.getByUrlId(urlEntry.id)))

  const crawls = paged.map((urlEntry, index) => {
    const content = contents[index]

    return {
      id: urlEntry.id,
      url: urlEntry.url,
      domain: urlEntry.domain,
      status: urlEntry.status,
      httpStatus: urlEntry.httpStatus ?? null,
      title: content?.title ?? null,
      lastCrawledAt: urlEntry.lastCrawledAt ?? content?.crawledAt ?? null,
      createdAt: urlEntry.createdAt
    }
  })

  return c.json(
    successResponse({
      total: allUrls.length,
      crawls
    }),
    200
  )
})

// POST /api/crawl/search
crawlingRoutes.openapi(searchRoute, async c => {
  const { query, limit } = c.req.valid('json')

  const cachedContent = await crawledContentRepository.getLatestContent(1000)
  const allUrls = await urlRepository.getAll('desc')
  const urlMap = new Map(allUrls.map(urlEntry => [urlEntry.id, urlEntry]))

  const filtered = cachedContent.filter(entry => {
    const haystack = `${entry.title ?? ''} ${entry.summary ?? ''} ${entry.cleanContent ?? ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  const trimmed = filtered.slice(0, limit)

  const results = trimmed.map(entry => {
    const urlEntry = urlMap.get(entry.urlId)

    return {
      id: entry.id,
      url: urlEntry?.url ?? 'unknown',
      title: entry.title ?? null,
      snippet: entry.summary ?? entry.cleanContent?.slice(0, 200) ?? null,
      lastCrawledAt: entry.crawledAt ?? urlEntry?.lastCrawledAt ?? null
    }
  })

  return c.json(
    successResponse({
      results,
      total: filtered.length
    }),
    200
  )
})

// GET /api/crawl/domains
crawlingRoutes.openapi(getDomainsRoute, async c => {
  const domains = await domainRepository.getAll('desc')

  const stats = await Promise.all(
    domains.map(async domainEntry => {
      const urlsForDomain = await urlRepository.getByDomain(domainEntry.domain)

      return {
        domain: domainEntry.domain,
        totalPages: urlsForDomain.length,
        lastCrawl: domainEntry.lastCrawlAt ?? null,
        robotsTxt: domainEntry.robotsTxt ?? null,
        crawlDelay: domainEntry.crawlDelay ?? 0
      }
    })
  )

  return c.json(successResponse({ domains: stats }), 200)
})

// GET /api/crawl/domains/:domain/robots
crawlingRoutes.openapi(getRobotsTxtRoute, async c => {
  const { domain } = c.req.valid('param')

  const existing = await domainRepository.getByDomain(domain)

  if (existing?.robotsTxt) {
    return c.json(
      successResponse({
        robotsTxt: existing.robotsTxt,
        crawlDelay: existing.crawlDelay ?? 0
      }),
      200
    )
  }

  const robotsInfo = await fetchRobotsTxt(domain)
  await domainRepository.upsert({ domain, robotsTxt: robotsInfo.rules, crawlDelay: robotsInfo.crawlDelay ?? undefined })

  return c.json(
    successResponse({
      robotsTxt: robotsInfo.rules || null,
      crawlDelay: robotsInfo.crawlDelay ?? 0
    }),
    200
  )
})
