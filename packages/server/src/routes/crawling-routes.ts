/**
 * Web Crawling API Routes
 *
 * Provides endpoints for crawling web pages, caching content,
 * and searching crawled data with AI-powered summarization.
 */

import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { crawlingService } from '@promptliano/services'
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
  const { url, maxDepth, summarize, forceRefresh } = c.req.valid('json')

  // If maxDepth > 1, crawl website, otherwise crawl single page
  if (maxDepth && maxDepth > 1) {
    const results = await crawlingService.crawlWebsite(url, {
      maxDepth,
      summarize,
        forceRefresh
      })

      // Generate overall summary if requested
      let aiSummary: string | undefined
      if (summarize && results.length > 0) {
        // Combine summaries from individual pages
        aiSummary = results
          .map(r => r.summary)
          .filter(Boolean)
          .join('\n\n')
      }

      return c.json(
        successResponse({
          pagesCrawled: results.length,
          results: results.map(r => ({
            id: r.id,
            url: r.url.url,
            urlHash: r.url.urlHash,
            domain: r.url.domain,
            status: r.url.status as 'pending' | 'crawled' | 'failed',
            httpStatus: r.url.httpStatus,
            title: r.title,
            cleanContent: r.cleanContent,
            metadata: r.metadata,
            summary: r.summary,
            lastCrawledAt: r.url.lastCrawledAt,
            createdAt: r.url.createdAt
          })),
          aiSummary
        }),
        200
      )
    } else {
      // Single page crawl
      const result = await crawlingService.crawlUrl(url, {
        summarize,
        forceRefresh
      })

      return c.json(
        successResponse({
          pagesCrawled: 1,
          results: [
            {
              id: result.id,
              url: result.url.url,
              urlHash: result.url.urlHash,
              domain: result.url.domain,
              status: result.url.status as 'pending' | 'crawled' | 'failed',
              httpStatus: result.url.httpStatus,
              title: result.title,
              cleanContent: result.cleanContent,
              metadata: result.metadata,
              summary: result.summary,
              lastCrawledAt: result.url.lastCrawledAt,
              createdAt: result.url.createdAt
            }
          ],
          aiSummary: result.summary || undefined
        }),
        200
      )
    }
  })

// GET /api/crawl/cached/:urlHash
crawlingRoutes.openapi(getCachedRoute, async c => {
  const { urlHash } = c.req.valid('param')

    const cached = await crawlingService.getCachedByUrlHash(urlHash)

    if (!cached) {
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

    return c.json(
      successResponse({
        url: cached.url.url,
        title: cached.title,
        cleanContent: cached.cleanContent,
        metadata: cached.metadata,
        summary: cached.summary,
        lastCrawledAt: cached.url.lastCrawledAt
      }),
      200
    )
  })

// GET /api/crawl/history
crawlingRoutes.openapi(getHistoryRoute, async c => {
  const { limit, offset } = c.req.valid('query')

  const history = await crawlingService.getHistory({ limit, offset })

  return c.json(successResponse(history), 200)
})

// POST /api/crawl/search
crawlingRoutes.openapi(searchRoute, async c => {
  const { query, limit } = c.req.valid('json')

  const results = await crawlingService.searchCached(query, { limit })

  return c.json(
    successResponse({
      results: results.map(r => ({
        id: r.content.id,
        url: r.url.url,
        title: r.content.title,
        snippet: r.snippet || r.content.excerpt,
        lastCrawledAt: r.url.lastCrawledAt
      })),
      total: results.length
    }),
    200
  )
})

// GET /api/crawl/domains
crawlingRoutes.openapi(getDomainsRoute, async c => {
  const domains = await crawlingService.getDomainStats()

  return c.json(successResponse({ domains }), 200)
})

// GET /api/crawl/domains/:domain/robots
crawlingRoutes.openapi(getRobotsTxtRoute, async c => {
  const { domain } = c.req.valid('param')

  const robotsInfo = await crawlingService.getRobotsTxt(domain)

  return c.json(successResponse(robotsInfo), 200)
})
