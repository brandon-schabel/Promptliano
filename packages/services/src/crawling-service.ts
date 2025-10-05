/**
 * Database-Integrated Web Crawling Service
 *
 * Provides web crawling with database persistence, caching, and AI summarization.
 * Integrates with existing crawl-service for extraction while adding persistence.
 *
 * @module crawling-service
 */

import { createHash } from 'crypto'
import { ErrorFactory, ApiError } from '@promptliano/shared'
import { createServiceLogger } from './utils/service-logger'
import type { ModelConfig } from '@promptliano/database'
import {
  domainRepository,
  urlRepository,
  crawledContentRepository,
  type Domain,
  type Url,
  type CrawledContent
} from '@promptliano/database'
import { createCrawlService, type CrawlResult } from './crawl-service'

const logger = createServiceLogger('CrawlingService')

// Service dependencies
export interface CrawlingServiceDeps {
  modelConfig?: ModelConfig
  logger?: ReturnType<typeof createServiceLogger>
  domainRepo?: typeof domainRepository
  urlRepo?: typeof urlRepository
  contentRepo?: typeof crawledContentRepository
}

/**
 * Generate MD5 hash for URL
 */
function hashUrl(url: string): string {
  return createHash('md5').update(url).digest('hex')
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    throw ErrorFactory.invalidInput('url', 'valid URL format', url)
  }
}

/**
 * Create database-integrated crawling service
 */
export function createCrawlingService(deps: CrawlingServiceDeps = {}) {
  const {
    modelConfig,
    logger: serviceLogger = logger,
    domainRepo = domainRepository,
    urlRepo = urlRepository,
    contentRepo = crawledContentRepository
  } = deps

  // Create base crawl service
  const baseCrawlService = createCrawlService({ logger: serviceLogger })

  /**
   * Crawl single URL with database persistence
   */
  async function crawlUrl(
    url: string,
    options: {
      summarize?: boolean
      forceRefresh?: boolean
    } = {}
  ): Promise<CrawledContent & { url: Url; domain: Domain }> {
    try {
      const urlHash = hashUrl(url)
      const domain = extractDomain(url)

      serviceLogger.info('Crawling URL with database persistence', { url, urlHash })

      // Check cache unless force refresh
      if (!options.forceRefresh) {
        const cachedContent = await contentRepo.getLatestByUrl(urlHash)
        if (cachedContent) {
          serviceLogger.info('Returning cached content', { url })
          const urlData = await urlRepo.getByUrlHash(urlHash)
          const domainData = await domainRepo.getByDomain(domain)
          return {
            ...cachedContent,
            url: urlData!,
            domain: domainData!
          }
        }
      }

      // Check robots.txt
      const robotsCheck = await baseCrawlService.checkRobotsTxt(url)
      if (!robotsCheck.canCrawl) {
        throw ErrorFactory.badRequest('Crawling disallowed by robots.txt', { url })
      }

      // Update domain info
      const domainData = await domainRepo.upsert({
        domain,
        robotsTxt: robotsCheck.disallowedPaths.join('\n') || null,
        crawlDelay: robotsCheck.crawlDelay || 1000
      })

      // Crawl the page
      const result = await baseCrawlService.crawlWebpage(url, {
        summarize: options.summarize
      })

      // Store URL
      const urlData = await urlRepo.upsert({
        url,
        urlHash,
        domain,
        status: 'crawled',
        httpStatus: 200,
        lastCrawledAt: result.crawledAt
      })

      // Store content
      const contentData = await contentRepo.upsertForUrl(urlData.id, {
        title: result.title,
        cleanContent: result.textContent,
        rawHtml: result.content,
        metadata: {
          siteName: result.siteName,
          author: result.byline,
          publishedTime: result.publishedTime,
          date: result.modifiedTime,
          lang: result.lang,
          excerpt: result.excerpt
        },
        summary: result.summary || null,
        links: [], // Will be populated by extractLinks if needed
        crawledAt: result.crawledAt
      })

      serviceLogger.info('URL crawled and stored successfully', {
        url,
        urlId: urlData.id,
        contentId: contentData.id
      })

      return {
        ...contentData,
        url: urlData,
        domain: domainData
      }
    } catch (error) {
      serviceLogger.error('Crawl failed', { url, error })
      if (error instanceof ApiError) throw error
      throw ErrorFactory.operationFailed('crawl URL', error instanceof Error ? error.message : undefined, { url })
    }
  }

  /**
   * Crawl multiple pages starting from a URL
   */
  async function crawlWebsite(
    startUrl: string,
    options: {
      maxDepth?: number
      summarize?: boolean
      forceRefresh?: boolean
    } = {}
  ): Promise<Array<CrawledContent & { url: Url }>> {
    try {
      const { maxDepth = 1, summarize = false } = options

      serviceLogger.info('Crawling website', { startUrl, maxDepth })

      // Crawl using base service
      const results = await baseCrawlService.crawlWebsite(startUrl, {
        maxDepth,
        maxPages: 50,
        followExternalLinks: false,
        summarize,
        respectRobotsTxt: true
      })

      // Store all results in database
      const storedResults: Array<CrawledContent & { url: Url }> = []

      for (const result of results) {
        try {
          const stored = await crawlUrl(result.url, { summarize, forceRefresh: true })
          storedResults.push(stored)
        } catch (error) {
          serviceLogger.warn('Failed to store crawl result', {
            url: result.url,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      serviceLogger.info('Website crawl completed', {
        startUrl,
        totalPages: results.length,
        storedPages: storedResults.length
      })

      return storedResults
    } catch (error) {
      serviceLogger.error('Website crawl failed', { startUrl, error })
      if (error instanceof ApiError) throw error
      throw ErrorFactory.operationFailed('crawl website', error instanceof Error ? error.message : undefined, {
        startUrl
      })
    }
  }

  /**
   * Get cached content by URL hash
   */
  async function getCachedByUrlHash(
    urlHash: string
  ): Promise<(CrawledContent & { url: Url }) | null> {
    try {
      const url = await urlRepo.getByUrlHash(urlHash)
      if (!url) return null

      const content = await contentRepo.getByUrlId(url.id)
      if (!content) return null

      return {
        ...content,
        url
      }
    } catch (error) {
      serviceLogger.error('Failed to get cached content', { urlHash, error })
      return null
    }
  }

  /**
   * Search cached content
   */
  async function searchCached(
    query: string,
    options: { limit?: number } = {}
  ): Promise<Array<{ url: Url; content: CrawledContent; snippet?: string }>> {
    try {
      const { limit = 20 } = options

      // Use base service for in-memory search
      const memoryResults = baseCrawlService.searchCached(query, { limit })

      // Convert to database format
      const results: Array<{ url: Url; content: CrawledContent; snippet?: string }> = []

      for (const result of memoryResults) {
        const urlHash = hashUrl(result.url)
        const cached = await getCachedByUrlHash(urlHash)
        if (cached) {
          results.push({
            url: cached.url,
            content: cached,
            snippet: result.excerpt
          })
        }
      }

      return results
    } catch (error) {
      serviceLogger.error('Search failed', { query, error })
      throw ErrorFactory.operationFailed('search cached content', error instanceof Error ? error.message : undefined, {
        query
      })
    }
  }

  /**
   * Get crawl history with pagination
   */
  async function getHistory(options: { limit?: number; offset?: number } = {}): Promise<{
    total: number
    crawls: Array<{
      id: number
      url: string
      domain: string
      status: string
      httpStatus: number | null
      title: string | null
      lastCrawledAt: number | null
      createdAt: number
    }>
  }> {
    try {
      const { limit = 50, offset = 0 } = options

      // Get all URLs (in production, add pagination to repository)
      const urls = (await urlRepo.getAll()) as any[]

      // Sort by last crawled
      const sorted = urls.sort((a: any, b: any) => (b.lastCrawledAt || 0) - (a.lastCrawledAt || 0))

      // Paginate
      const paginated = sorted.slice(offset, offset + limit)

      // Enrich with content data
      const enriched = await Promise.all(
        paginated.map(async (url: any) => {
          const content = await contentRepo.getByUrlId(url.id)
          return {
            id: url.id,
            url: url.url,
            domain: url.domain,
            status: url.status,
            httpStatus: url.httpStatus,
            title: content?.title || null,
            lastCrawledAt: url.lastCrawledAt,
            createdAt: url.createdAt
          }
        })
      )

      return {
        total: urls.length,
        crawls: enriched
      }
    } catch (error) {
      serviceLogger.error('Failed to get history', { error })
      throw ErrorFactory.operationFailed('get crawl history', error instanceof Error ? error.message : undefined)
    }
  }

  /**
   * Get domain statistics
   */
  async function getDomainStats(): Promise<
    Array<{
      domain: string
      totalPages: number
      lastCrawl: number | null
      robotsTxt: string | null
      crawlDelay: number
    }>
  > {
    try {
      const domains = (await domainRepo.getAll()) as any[]

      const stats = await Promise.all(
        domains.map(async (domain: any) => {
          const urls = await urlRepo.getByDomain(domain.domain)
          return {
            domain: domain.domain,
            totalPages: urls.length,
            lastCrawl: domain.lastCrawlAt,
            robotsTxt: domain.robotsTxt,
            crawlDelay: domain.crawlDelay
          }
        })
      )

      return stats
    } catch (error) {
      serviceLogger.error('Failed to get domain stats', { error })
      throw ErrorFactory.operationFailed('get domain statistics', error instanceof Error ? error.message : undefined)
    }
  }

  /**
   * Get robots.txt for a domain
   */
  async function getRobotsTxt(
    domain: string
  ): Promise<{ robotsTxt: string | null; crawlDelay: number }> {
    try {
      const domainData = await domainRepo.getByDomain(domain)
      if (!domainData) {
        return { robotsTxt: null, crawlDelay: 1000 }
      }

      return {
        robotsTxt: domainData.robotsTxt,
        crawlDelay: domainData.crawlDelay
      }
    } catch (error) {
      serviceLogger.error('Failed to get robots.txt', { domain, error })
      throw ErrorFactory.operationFailed('get robots.txt', error instanceof Error ? error.message : undefined, {
        domain
      })
    }
  }

  return {
    crawlUrl,
    crawlWebsite,
    getCachedByUrlHash,
    searchCached,
    getHistory,
    getDomainStats,
    getRobotsTxt
  }
}

// Singleton instance
export const crawlingService = createCrawlingService()

// Functional API exports
export const crawlUrl = (url: string, options?: { summarize?: boolean; forceRefresh?: boolean }) =>
  crawlingService.crawlUrl(url, options)

export const crawlWebsite = (
  startUrl: string,
  options?: { maxDepth?: number; summarize?: boolean; forceRefresh?: boolean }
) => crawlingService.crawlWebsite(startUrl, options)

export const getCachedByUrlHash = (urlHash: string) =>
  crawlingService.getCachedByUrlHash(urlHash)

export const searchCachedContent = (query: string, options?: { limit?: number }) =>
  crawlingService.searchCached(query, options)

export const getCrawlHistory = (options?: { limit?: number; offset?: number }) =>
  crawlingService.getHistory(options)

export const getDomainStats = () => crawlingService.getDomainStats()

export const getRobotsTxt = (domain: string) => crawlingService.getRobotsTxt(domain)

export type CrawlingService = ReturnType<typeof createCrawlingService>
