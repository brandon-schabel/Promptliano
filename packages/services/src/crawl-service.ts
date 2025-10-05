/**
 * Web Crawling Service
 *
 * Provides web page and website crawling capabilities with clean content extraction,
 * caching, and AI-powered summarization.
 *
 * @module crawl-service
 */

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import * as cheerio from 'cheerio'
import robotsParser from 'robots-parser'
import { ApiError, ErrorFactory } from '@promptliano/shared'
import { createServiceLogger } from './utils/service-logger'

const logger = createServiceLogger('CrawlService')

// Types
export interface CrawlResult {
  url: string
  title: string
  content: string
  textContent: string
  excerpt: string
  siteName?: string
  byline?: string
  publishedTime?: string
  modifiedTime?: string
  lang?: string
  length: number
  crawledAt: number
  summary?: string
}

export interface CrawlWebsiteOptions {
  maxDepth?: number // 1-3, default 2
  maxPages?: number // Max pages to crawl, default 50
  followExternalLinks?: boolean // default false
  summarize?: boolean // Generate AI summary
  respectRobotsTxt?: boolean // default true
}

export interface CrawlWebpageOptions {
  summarize?: boolean
  userAgent?: string
}

export interface CachedCrawl extends CrawlResult {
  id: string
}

export interface SearchCachedOptions {
  limit?: number // 1-20, default 10
}

export interface CrawlHistory {
  url: string
  crawledAt: number
  pageCount?: number
  depth?: number
}

export interface RobotsTxtCheck {
  canCrawl: boolean
  crawlDelay?: number
  disallowedPaths: string[]
  sitemap?: string[]
}

// In-memory cache (in production, use Redis or database)
const crawlCache = new Map<string, CachedCrawl>()
const crawlHistory: CrawlHistory[] = []
const MAX_CACHE_SIZE = 1000
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Service dependencies
export interface CrawlServiceDeps {
  logger?: ReturnType<typeof createServiceLogger>
  summarizer?: (content: string, title: string) => Promise<string>
}

/**
 * Create crawling service with functional factory pattern
 */
export function createCrawlService(deps: CrawlServiceDeps = {}) {
  const serviceLogger = deps.logger || logger
  const defaultUserAgent = 'Promptliano-Crawler/1.0'

  /**
   * Fetch and parse a single webpage
   */
  async function fetchPage(url: string, userAgent: string = defaultUserAgent): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        redirect: 'follow'
      })

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Failed to fetch page: ${response.statusText}`,
          'FETCH_FAILED',
          { url, status: response.status }
        )
      }

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('text/html')) {
        throw new ApiError(
          400,
          `URL does not return HTML content: ${contentType}`,
          'INVALID_CONTENT_TYPE',
          { url, contentType }
        )
      }

      return await response.text()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, 'Network error while fetching page', 'NETWORK_ERROR', { url, error: String(error) })
    }
  }

  /**
   * Extract clean content using Readability
   */
  function extractContent(html: string, url: string): Omit<CrawlResult, 'crawledAt' | 'summary'> {
    try {
      const { document } = parseHTML(html)
      const reader = new Readability(document)
      const article = reader.parse()

      if (!article) {
        throw new ApiError(500, 'Failed to parse article content', 'PARSE_FAILED', { url })
      }

      return {
        url,
        title: article.title || 'Untitled',
        content: article.content || '',
        textContent: article.textContent || '',
        excerpt: article.excerpt || '',
        siteName: article.siteName || undefined,
        byline: article.byline || undefined,
        publishedTime: article.publishedTime || undefined,
        lang: article.lang || undefined,
        length: article.length || 0
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, 'Content extraction failed', 'EXTRACTION_FAILED', { url, error: String(error) })
    }
  }

  /**
   * Generate AI summary of content
   */
  async function generateSummary(content: string, title: string): Promise<string> {
    try {
      if (!deps.summarizer) {
        serviceLogger.debug('No summarizer provided, skipping summary generation')
        return ''
      }

      return await deps.summarizer(content, title)
    } catch (error) {
      serviceLogger.error('Summary generation failed', { error })
      return '' // Non-critical failure
    }
  }

  /**
   * Extract links from HTML
   */
  function extractLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html)
    const links: string[] = []

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href')
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          links.push(absoluteUrl)
        } catch {
          // Invalid URL, skip
        }
      }
    })

    return [...new Set(links)] // Remove duplicates
  }

  /**
   * Filter links based on domain and options
   */
  function filterLinks(
    links: string[],
    baseUrl: string,
    options: CrawlWebsiteOptions
  ): string[] {
    const baseDomain = new URL(baseUrl).hostname

    return links.filter(link => {
      try {
        const linkUrl = new URL(link)

        // Skip non-HTTP protocols
        if (!['http:', 'https:'].includes(linkUrl.protocol)) return false

        // Skip common non-content URLs
        const path = linkUrl.pathname.toLowerCase()
        if (path.match(/\.(jpg|jpeg|png|gif|pdf|zip|mp4|mp3)$/)) return false

        // Check domain
        if (!options.followExternalLinks && linkUrl.hostname !== baseDomain) {
          return false
        }

        return true
      } catch {
        return false
      }
    })
  }

  /**
   * Add to cache with LRU eviction
   */
  function addToCache(result: CrawlResult): void {
    const id = `${result.url}-${result.crawledAt}`
    const cached: CachedCrawl = { ...result, id }

    crawlCache.set(id, cached)

    // LRU eviction
    if (crawlCache.size > MAX_CACHE_SIZE) {
      const firstKey = crawlCache.keys().next().value
      if (firstKey) crawlCache.delete(firstKey)
    }
  }

  /**
   * Crawl a single webpage
   */
  async function crawlWebpage(
    url: string,
    options: CrawlWebpageOptions = {}
  ): Promise<CrawlResult> {
    try {
      serviceLogger.info('Crawling webpage', { url })

      const html = await fetchPage(url, options.userAgent)
      const extracted = extractContent(html, url)

      let summary: string | undefined
      if (options.summarize) {
        summary = await generateSummary(extracted.textContent, extracted.title)
      }

      const result: CrawlResult = {
        ...extracted,
        crawledAt: Date.now(),
        summary
      }

      // Cache the result
      addToCache(result)

      // Add to history
      crawlHistory.unshift({
        url,
        crawledAt: result.crawledAt
      })
      if (crawlHistory.length > 100) crawlHistory.pop()

      serviceLogger.info('Webpage crawled successfully', {
        url,
        title: result.title,
        length: result.length
      })

      return result
    } catch (error) {
      serviceLogger.error('Webpage crawl failed', { url, error })
      if (error instanceof ApiError) throw error
      throw new ApiError(500, 'Failed to crawl webpage', 'CRAWL_FAILED', { url, error: String(error) })
    }
  }

  /**
   * Crawl multiple pages starting from a URL
   */
  async function crawlWebsite(
    startUrl: string,
    options: CrawlWebsiteOptions = {}
  ): Promise<CrawlResult[]> {
    const {
      maxDepth = 2,
      maxPages = 50,
      followExternalLinks = false,
      summarize = false,
      respectRobotsTxt = true
    } = options

    try {
      serviceLogger.info('Crawling website', { startUrl, maxDepth, maxPages })

      // Check robots.txt if required
      if (respectRobotsTxt) {
        const robotsCheck = await checkRobotsTxt(startUrl)
        if (!robotsCheck.canCrawl) {
          throw new ApiError(
            403,
            'Crawling disallowed by robots.txt',
            'ROBOTS_DISALLOWED',
            { url: startUrl }
          )
        }
      }

      const visited = new Set<string>()
      const results: CrawlResult[] = []
      const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }]

      while (queue.length > 0 && results.length < maxPages) {
        const item = queue.shift()
        if (!item || visited.has(item.url) || item.depth > maxDepth) continue

        visited.add(item.url)

        try {
          // Crawl the page
          const result = await crawlWebpage(item.url, { summarize })
          results.push(result)

          // Extract and queue links if not at max depth
          if (item.depth < maxDepth) {
            const html = await fetchPage(item.url)
            const links = extractLinks(html, item.url)
            const filtered = filterLinks(links, startUrl, options)

            for (const link of filtered) {
              if (!visited.has(link) && queue.length + results.length < maxPages) {
                queue.push({ url: link, depth: item.depth + 1 })
              }
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          serviceLogger.warn('Failed to crawl page, continuing', {
            url: item.url,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // Add to history
      crawlHistory.unshift({
        url: startUrl,
        crawledAt: Date.now(),
        pageCount: results.length,
        depth: maxDepth
      })
      if (crawlHistory.length > 100) crawlHistory.pop()

      serviceLogger.info('Website crawl completed', {
        startUrl,
        pagesFound: results.length
      })

      return results
    } catch (error) {
      serviceLogger.error('Website crawl failed', { startUrl, error })
      if (error instanceof ApiError) throw error
      throw new ApiError(500, 'Failed to crawl website', 'WEBSITE_CRAWL_FAILED', {
        url: startUrl,
        error: String(error)
      })
    }
  }

  /**
   * Search cached content
   */
  function searchCached(
    query: string,
    options: SearchCachedOptions = {}
  ): CachedCrawl[] {
    const { limit = 10 } = options
    const normalizedQuery = query.toLowerCase()

    const matches = Array.from(crawlCache.values())
      .filter(item => {
        // Check if TTL expired
        if (Date.now() - item.crawledAt > CACHE_TTL) {
          crawlCache.delete(item.id)
          return false
        }

        // Search in title, content, and excerpt
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.textContent.toLowerCase().includes(normalizedQuery) ||
          item.excerpt.toLowerCase().includes(normalizedQuery) ||
          (item.summary?.toLowerCase().includes(normalizedQuery) ?? false)
        )
      })
      .slice(0, limit)

    serviceLogger.info('Cache search completed', {
      query,
      matches: matches.length
    })

    return matches
  }

  /**
   * Get crawl history
   */
  function getHistory(limit: number = 50): CrawlHistory[] {
    return crawlHistory.slice(0, limit)
  }

  /**
   * Check robots.txt for a URL
   */
  async function checkRobotsTxt(url: string): Promise<RobotsTxtCheck> {
    try {
      const urlObj = new URL(url)
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`

      let robotsTxt: string
      try {
        const response = await fetch(robotsUrl)
        robotsTxt = response.ok ? await response.text() : ''
      } catch {
        // No robots.txt found, allow all
        return {
          canCrawl: true,
          disallowedPaths: []
        }
      }

      const robots = robotsParser(robotsUrl, robotsTxt)
      const canCrawl = robots.isAllowed(url, defaultUserAgent) ?? true
      const crawlDelay = robots.getCrawlDelay(defaultUserAgent)

      // Extract sitemaps
      const sitemaps: string[] = []
      const sitemapMatches = robotsTxt.matchAll(/Sitemap:\s*(.+)/gi)
      for (const match of sitemapMatches) {
        if (match[1]) sitemaps.push(match[1].trim())
      }

      // Extract disallowed paths
      const disallowedPaths: string[] = []
      const disallowMatches = robotsTxt.matchAll(/Disallow:\s*(.+)/gi)
      for (const match of disallowMatches) {
        if (match[1]) disallowedPaths.push(match[1].trim())
      }

      return {
        canCrawl,
        crawlDelay: crawlDelay || undefined,
        disallowedPaths,
        sitemap: sitemaps.length > 0 ? sitemaps : undefined
      }
    } catch (error) {
      serviceLogger.error('robots.txt check failed', { url, error })
      // On error, allow crawling (fail open)
      return {
        canCrawl: true,
        disallowedPaths: []
      }
    }
  }

  /**
   * Clear cache (for testing/maintenance)
   */
  function clearCache(): void {
    crawlCache.clear()
    serviceLogger.info('Cache cleared')
  }

  return {
    crawlWebpage,
    crawlWebsite,
    searchCached,
    getHistory,
    checkRobotsTxt,
    clearCache
  }
}

// Singleton instance
export const crawlService = createCrawlService()

// Functional API exports
export const crawlWebpage = (url: string, options?: CrawlWebpageOptions) =>
  crawlService.crawlWebpage(url, options)

export const crawlWebsite = (url: string, options?: CrawlWebsiteOptions) =>
  crawlService.crawlWebsite(url, options)

export const searchCached = (query: string, options?: SearchCachedOptions) =>
  crawlService.searchCached(query, options)

export const getCrawlHistory = (limit?: number) =>
  crawlService.getHistory(limit)

export const checkRobotsTxt = (url: string) =>
  crawlService.checkRobotsTxt(url)

export const clearCrawlCache = () =>
  crawlService.clearCache()

export type CrawlService = ReturnType<typeof createCrawlService>
