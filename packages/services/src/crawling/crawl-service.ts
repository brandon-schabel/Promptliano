/**
 * Main Crawl Service
 * Orchestrates web crawling with caching, rate limiting, and queue management
 */

import crypto from 'node:crypto'
import {
  domainRepository,
  urlRepository,
  crawledContentRepository,
  type Url,
  type CrawledContent
} from '@promptliano/database'
import { createServiceLogger } from '../utils/service-logger'
import { CrawlErrorFactory } from './errors'
import { createRobotsTxtService, type RobotsTxtServiceDeps } from './robots-service'
import { createContentExtractor } from './content-extractor'
import { createAIService, type AIServiceDeps, type AISummaryResult } from './ai-service'

const logger = createServiceLogger('CrawlService')

export interface CrawlServiceDeps {
  domainRepo?: typeof domainRepository
  urlRepo?: typeof urlRepository
  contentRepo?: typeof crawledContentRepository
  robotsService?: ReturnType<typeof createRobotsTxtService>
  contentExtractor?: ReturnType<typeof createContentExtractor>
  aiService?: ReturnType<typeof createAIService>
  logger?: ReturnType<typeof createServiceLogger>
}

export interface CrawlOptions {
  timeout?: number // milliseconds
  maxSize?: number // bytes
  respectRobotsTxt?: boolean
  cacheEnabled?: boolean
  cacheTTL?: number // milliseconds
  generateSummary?: boolean
  userAgent?: string
}

export interface CrawlResult {
  url: string
  urlHash: string
  title: string
  cleanContent: string
  rawHtml: string
  summary?: string
  aiSummary?: AISummaryResult
  metadata: {
    author?: string
    date?: string
    publishedTime?: string
    siteName?: string
    excerpt?: string
    lang?: string
  }
  links: string[]
  cached: boolean
  crawledAt: number
  httpStatus: number
}

export interface MultiCrawlOptions extends CrawlOptions {
  maxDepth?: number
  maxPages?: number
  sameDomainOnly?: boolean
}

/**
 * Generate MD5 hash for URL (for caching)
 */
function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex')
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    throw CrawlErrorFactory.invalidUrl(url, 'Invalid URL format')
  }
}

/**
 * Validate URL format
 */
function validateUrl(url: string): void {
  try {
    const urlObj = new URL(url)
    if (!urlObj.protocol.startsWith('http')) {
      throw new Error('Only HTTP/HTTPS URLs are supported')
    }
  } catch (error) {
    throw CrawlErrorFactory.invalidUrl(url, error instanceof Error ? error.message : 'Invalid format')
  }
}

/**
 * Rate limiter - tracks last crawl time per domain
 */
class RateLimiter {
  private lastCrawl = new Map<string, number>()

  async checkAndWait(domain: string, delayMs: number): Promise<void> {
    const lastTime = this.lastCrawl.get(domain) || 0
    const timeSinceLastCrawl = Date.now() - lastTime
    const waitTime = delayMs - timeSinceLastCrawl

    if (waitTime > 0) {
      logger.info('Rate limiting', { domain, waitMs: waitTime })
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastCrawl.set(domain, Date.now())
  }

  reset(domain: string): void {
    this.lastCrawl.delete(domain)
  }
}

/**
 * Create Crawl Service
 */
export function createCrawlService(deps: CrawlServiceDeps = {}) {
  const {
    domainRepo = domainRepository,
    urlRepo = urlRepository,
    contentRepo = crawledContentRepository,
    robotsService = createRobotsTxtService(),
    contentExtractor = createContentExtractor(),
    logger: serviceLogger = logger
  } = deps

  const rateLimiter = new RateLimiter()

  // Default options
  const defaultOptions: CrawlOptions = {
    timeout: 30000,
    maxSize: 10 * 1024 * 1024, // 10MB
    respectRobotsTxt: true,
    cacheEnabled: true,
    cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
    generateSummary: false,
    userAgent: 'Promptliano-WebCrawler/1.0'
  }

  return {
    /**
     * Crawl a single URL with caching
     */
    async crawlUrl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
      const opts = { ...defaultOptions, ...options }
      validateUrl(url)

      const urlHash = hashUrl(url)
      const domain = extractDomain(url)

      // Check cache first
      if (opts.cacheEnabled) {
        const cached = await this.getCachedContent(urlHash)
        if (cached && this.isFresh(cached, opts.cacheTTL!)) {
          serviceLogger.info('Returning cached content', { url, urlHash })
          return {
            ...cached,
            cached: true
          }
        }
      }

      // Check robots.txt
      if (opts.respectRobotsTxt) {
        await robotsService.validateOrThrow(url)
        const crawlDelay = await robotsService.getCrawlDelay(domain)
        await rateLimiter.checkAndWait(domain, crawlDelay)
      } else {
        // Default rate limit even without robots.txt
        await rateLimiter.checkAndWait(domain, 1000)
      }

      // Fetch URL
      const { html, httpStatus } = await this.fetchUrl(url, opts)

      // Extract content
      const extracted = contentExtractor.extractAll(html, url)

      // Store in database
      const urlRecord = await urlRepo.upsert({
        url,
        urlHash,
        domain,
        status: 'crawled',
        httpStatus,
        lastCrawledAt: Date.now(),
        nextCrawlAt: Date.now() + opts.cacheTTL!
      })

      const contentRecord = await contentRepo.upsertForUrl(urlRecord.id, {
        title: extracted.content.title,
        cleanContent: extracted.content.textContent,
        rawHtml: html,
        summary: extracted.metadata.excerpt,
        metadata: extracted.metadata,
        links: extracted.links,
        crawledAt: Date.now()
      })

      // Update domain last crawl time
      await domainRepo.updateLastCrawl(domain)

      // Generate AI summary if requested
      let aiSummary: AISummaryResult | undefined
      if (opts.generateSummary && deps.aiService) {
        const contentForAI = contentExtractor.prepareForAI(
          extracted.content.textContent,
          extracted.content.title,
          extracted.metadata
        )
        aiSummary = await deps.aiService.summarizeContent(contentForAI, url)
      }

      serviceLogger.info('URL crawled successfully', {
        url,
        httpStatus,
        contentLength: extracted.content.length,
        links: extracted.links.length
      })

      return {
        url,
        urlHash,
        title: extracted.content.title,
        cleanContent: extracted.content.textContent,
        rawHtml: html,
        summary: extracted.metadata.excerpt,
        aiSummary,
        metadata: extracted.metadata,
        links: extracted.links,
        cached: false,
        crawledAt: Date.now(),
        httpStatus
      }
    },

    /**
     * Fetch URL with timeout and size limit
     */
    async fetchUrl(url: string, options: CrawlOptions): Promise<{ html: string; httpStatus: number }> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), options.timeout)

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': options.userAgent || 'Promptliano-WebCrawler/1.0'
          }
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw CrawlErrorFactory.fetchFailed(url, response.status, response.statusText)
        }

        // Check content size
        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > options.maxSize!) {
          throw CrawlErrorFactory.tooLarge(url, parseInt(contentLength), options.maxSize!)
        }

        const html = await response.text()

        if (html.length > options.maxSize!) {
          throw CrawlErrorFactory.tooLarge(url, html.length, options.maxSize!)
        }

        return { html, httpStatus: response.status }
      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          throw CrawlErrorFactory.timeout(url, options.timeout!)
        }

        throw error
      }
    },

    /**
     * Get cached content
     */
    async getCachedContent(urlHash: string): Promise<CrawlResult | null> {
      const content = await contentRepo.getLatestByUrl(urlHash)
      if (!content) return null

      const url = await urlRepo.getByUrlHash(urlHash)
      if (!url) return null

      return {
        url: url.url,
        urlHash,
        title: content.title || 'Untitled',
        cleanContent: content.cleanContent || '',
        rawHtml: content.rawHtml || '',
        summary: content.summary || undefined,
        metadata: content.metadata || {},
        links: content.links || [],
        cached: true,
        crawledAt: content.crawledAt,
        httpStatus: url.httpStatus || 200
      }
    },

    /**
     * Check if cached content is fresh
     */
    isFresh(result: CrawlResult, ttl: number): boolean {
      return Date.now() - result.crawledAt < ttl
    },

    /**
     * Crawl multiple URLs (breadth-first with depth limit)
     */
    async crawlMultiple(startUrl: string, options: MultiCrawlOptions = {}): Promise<CrawlResult[]> {
      const opts = { ...defaultOptions, maxDepth: 2, maxPages: 10, sameDomainOnly: true, ...options }
      const results: CrawlResult[] = []
      const visited = new Set<string>()
      const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }]
      const startDomain = extractDomain(startUrl)

      while (queue.length > 0 && results.length < opts.maxPages!) {
        const { url, depth } = queue.shift()!

        if (visited.has(url) || depth > opts.maxDepth!) {
          continue
        }

        visited.add(url)

        try {
          const result = await this.crawlUrl(url, opts)
          results.push(result)

          // Add discovered links to queue
          if (depth < opts.maxDepth!) {
            for (const link of result.links) {
              if (!visited.has(link)) {
                if (opts.sameDomainOnly) {
                  const linkDomain = extractDomain(link)
                  if (linkDomain === startDomain) {
                    queue.push({ url: link, depth: depth + 1 })
                  }
                } else {
                  queue.push({ url: link, depth: depth + 1 })
                }
              }
            }
          }
        } catch (error) {
          serviceLogger.error('Failed to crawl URL', { url, depth, error })
          // Continue with other URLs
        }
      }

      return results
    },

    /**
     * Check crawl permission without actually crawling
     */
    async checkCrawlPermission(url: string): Promise<boolean> {
      try {
        return await robotsService.canCrawl(url)
      } catch {
        return false
      }
    },

    /**
     * Get crawl delay for domain
     */
    async getCrawlDelay(domain: string): Promise<number> {
      return await robotsService.getCrawlDelay(domain)
    }
  }
}

export const crawlService = createCrawlService()
