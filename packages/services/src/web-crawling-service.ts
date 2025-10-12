/**
 * Web Crawling Service - Functional Factory Pattern
 * Intelligent web page crawling with link extraction, deduplication, and content processing
 *
 * Following Promptliano's service architecture:
 * - Functional factory pattern (not classes)
 * - Pure functions for utilities (not classes)
 * - Uses generated types from @promptliano/database
 * - Repository integration for data access
 * - ErrorFactory for consistent error handling
 * - Dependency injection for testability
 *
 * Features:
 * - Link extraction from HTML pages
 * - URL deduplication using hashing
 * - Depth tracking for crawl limits
 * - Page limits per session
 * - robots.txt parsing and compliance
 * - Crawl delay enforcement
 * - Content processing with @mozilla/readability
 * - SSRF protection and security
 *
 * Memory Management:
 * - TTL-based session tracking (2 hour expiration)
 * - Automatic cleanup of expired sessions (every 30 minutes)
 * - Immediate cleanup of completed/failed/cancelled sessions
 * - TTL extension on active session access
 * - Manual cleanup utilities for testing
 */

import { createServiceLogger, withErrorContext, safeErrorFactory } from './core/base-service'
import {
  domainRepository,
  urlRepository,
  crawledContentRepository,
  researchSourceRepository as dbResearchSourceRepository,
  crawlUtils,
  type Domain,
  type Url,
  type CrawledContent,
  type InsertDomain,
  type InsertUrl,
  type InsertCrawledContent
} from '@promptliano/database'
import { ApiError } from '@promptliano/shared'

// Web scraping and content processing imports
import { Readability } from '@mozilla/readability'
// @ts-ignore - jsdom types not needed for runtime
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import sanitizeHtml from 'sanitize-html'
// @ts-ignore - robots-parser module types
import robotsParser from 'robots-parser'

// Security imports
import { validateResearchUrlSync, validateResearchUrl } from './utils/url-validator'

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_DEPTH = 3
const DEFAULT_MAX_PAGES = 50
const DEFAULT_CRAWL_DELAY = 1000 // 1 second
const DEFAULT_USER_AGENT = 'Promptliano-Crawler/1.0'
const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_CONTENT_SIZE = 10_000_000 // 10MB

// Session management constants
const SESSION_TTL = 2 * 60 * 60 * 1000 // 2 hours
const SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000 // 30 minutes

// Real-time update configuration
const PROGRESS_UPDATE_INTERVAL = 10 // Update metadata every N pages
const MAX_LINK_TIMELINE_SIZE = 100 // Keep last 100 discovered links

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface WebCrawlingServiceDeps {
  domainRepository?: typeof domainRepository
  urlRepository?: typeof urlRepository
  contentRepository?: typeof crawledContentRepository
  researchSourceRepository?: typeof import('@promptliano/database').researchSourceRepository
  logger?: ReturnType<typeof createServiceLogger>
}

export interface CrawlOptions {
  maxDepth?: number // Default: 3
  maxPages?: number // Default: 50
  respectRobotsTxt?: boolean // Default: true
  crawlDelay?: number // Default: 1000ms, overrides robots.txt
  userAgent?: string // Default: 'Promptliano-Crawler/1.0'
  timeout?: number // Default: 30000ms
  sameDomainOnly?: boolean // Default: true - only crawl same domain
}

export interface CrawlContext {
  researchId?: number
  researchSourceId?: number
}

export interface CrawlProgress {
  urlsCrawled: number
  urlsPending: number
  urlsFailed: number
  currentDepth: number
  status: 'running' | 'paused' | 'completed' | 'failed'
  totalPagesFetched?: number
  totalLinksDiscovered?: number
}

export interface CrawlSession {
  crawlId: string
  seedDomain: string
  seedUrl: Url
  options: Required<CrawlOptions>
  startedAt: number
  visited: Set<string> // URL hashes
  pending: Array<{ url: string; depth: number }> // Queue of URLs to process
  progress: CrawlProgress
  context?: CrawlContext
  metrics: {
    totalLinksDiscovered: number
    totalPagesFetched: number
  }
}

export interface CrawlArtifactsOptions {
  limit?: number
  cursor?: number
}

export interface CrawlArtifactPayload {
  urlId: number
  url: string
  depth?: number | null
  status: Url['status']
  httpStatus?: number | null
  crawledAt?: number | null
  links?: string[] | null
  title?: string | null
  metadata?: CrawledContent['metadata']
  researchSourceId?: number | null
}

export interface CrawlArtifactsResult {
  crawlId: string
  records: CrawlArtifactPayload[]
  hasMore: boolean
  nextCursor?: number
}

export interface SessionEntry {
  session: CrawlSession
  expiresAt: number
  lastAccessedAt: number
}

// =============================================================================
// SHARED UTILITIES (Singletons)
// =============================================================================

/**
 * Shared TurndownService instance for HTML to Markdown conversion
 */
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

// =============================================================================
// PURE UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract all links from HTML content
 *
 * @param html - Raw HTML content
 * @param baseUrl - Base URL for resolving relative links
 * @returns Array of absolute URLs
 */
function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  try {
    const dom = new JSDOM(html, { url: baseUrl })
    const links = dom.window.document.querySelectorAll('a[href]')

    const urls: string[] = []
    links.forEach((link: Element) => {
      const href = link.getAttribute('href')
      if (!href) return

      try {
        // Resolve relative URLs to absolute
        const absoluteUrl = new URL(href, baseUrl).toString()

        // Filter out invalid protocols
        if (
          absoluteUrl.startsWith('http://') ||
          absoluteUrl.startsWith('https://')
        ) {
          urls.push(absoluteUrl)
        }
      } catch {
        // Skip malformed URLs
      }
    })

    return urls
  } catch (error) {
    console.warn('Failed to extract links from HTML:', error)
    return []
  }
}

/**
 * Process HTML into clean content using @mozilla/readability
 *
 * @param html - Raw HTML content
 * @param url - Source URL for base resolution
 * @returns Processed content with title, text, and metadata
 */
function processHtmlContentInternal(html: string, url: string) {
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document as any)
  const article = reader.parse()

  // Extract all links regardless of Readability success
  const extractedLinks = extractLinksFromHtml(html, url)

  if (!article) {
    // Fallback when Readability fails
    const cleanHtml = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3'])
    })

    return {
      title: dom.window.document.title || 'Untitled',
      cleanContent: dom.window.document.body?.textContent || '',
      markdown: turndownService.turndown(cleanHtml),
      metadata: {
        siteName: dom.window.document.title
      },
      links: extractedLinks
    }
  }

  return {
    title: article.title || 'Untitled',
    cleanContent: article.textContent || '',
    markdown: turndownService.turndown(article.content || ''),
    metadata: {
      author: article.byline || undefined,
      excerpt: article.excerpt || undefined,
      siteName: article.siteName || undefined
    },
    links: extractedLinks
  }
}

/**
 * Parse robots.txt content and check if URL is allowed
 *
 * @param robotsTxt - robots.txt content
 * @param url - URL to check
 * @param userAgent - User agent string
 * @returns Whether URL is allowed by robots.txt
 */
function isUrlAllowedByRobotsTxt(
  robotsTxt: string | null,
  url: string,
  userAgent: string
): boolean {
  if (!robotsTxt) return true // No robots.txt = allow all

  try {
    const robots = robotsParser(url, robotsTxt)
    return robots.isAllowed(url, userAgent) ?? true
  } catch (error) {
    console.warn('Failed to parse robots.txt:', error)
    return true // Allow on parse error
  }
}

/**
 * Extract crawl delay from robots.txt
 *
 * @param robotsTxt - robots.txt content
 * @param userAgent - User agent string
 * @returns Crawl delay in milliseconds, or null if not specified
 */
function extractCrawlDelayFromRobotsTxt(
  robotsTxt: string | null,
  userAgent: string
): number | null {
  if (!robotsTxt) return null

  try {
    const robots = robotsParser('https://example.com', robotsTxt)
    const delay = robots.getCrawlDelay(userAgent)
    return delay ? delay * 1000 : null // Convert to milliseconds
  } catch {
    return null
  }
}

/**
 * Extract disallowed paths from robots.txt
 *
 * @param robotsTxt - robots.txt content
 * @returns Array of disallowed path patterns
 */
function extractDisallowedPaths(robotsTxt: string | null): string[] {
  if (!robotsTxt) return []

  const disallowed: string[] = []
  const lines = robotsTxt.split('\n')
  let inRelevantUserAgent = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check for user-agent directives
    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      const agent = trimmed.substring('user-agent:'.length).trim()
      inRelevantUserAgent = agent === '*' // Simplification: only handle * for now
      continue
    }

    // Extract disallow directives
    if (inRelevantUserAgent && trimmed.toLowerCase().startsWith('disallow:')) {
      const path = trimmed.substring('disallow:'.length).trim()
      if (path) {
        disallowed.push(path)
      }
    }
  }

  return disallowed
}

// =============================================================================
// REAL-TIME METADATA UPDATE HELPERS
// =============================================================================

/**
 * Update research source metadata during active crawls
 * Provides real-time progress tracking for dashboard polling
 */
async function updateSourceMetadataProgress(
  researchSourceRepository: any,
  sourceId: number,
  updates: {
    totalLinksDiscovered?: number
    totalPagesCrawled?: number
    pagesRemainingInQueue?: number
    currentDepth?: number
    failedPages?: number
    completedPages?: number
  }
) {
  try {
    await researchSourceRepository.updateSourceCrawlProgress(sourceId, updates)
  } catch (error) {
    console.warn('Failed to update source metadata progress', { sourceId, error: String(error) })
  }
}

/**
 * Track discovered link with timestamp in source metadata
 */
async function trackDiscoveredLink(
  researchSourceRepository: any,
  sourceId: number,
  link: {
    url: string
    title?: string
    depth: number
    parentUrl?: string
  }
) {
  try {
    await researchSourceRepository.addSourceDiscoveredLink(sourceId, link)
  } catch (error) {
    console.warn('Failed to track discovered link', { sourceId, url: link.url, error: String(error) })
  }
}

/**
 * Track crawl error in source metadata
 */
async function trackCrawlError(
  researchSourceRepository: any,
  sourceId: number,
  error: {
    url: string
    errorCode?: string
    errorMessage: string
    retryCount?: number
  }
) {
  try {
    await researchSourceRepository.trackSourceError(sourceId, error)
  } catch (err) {
    console.warn('Failed to track crawl error', { sourceId, error: String(err) })
  }
}

/**
 * Update performance statistics during crawl
 */
async function updatePerformanceMetrics(
  researchSourceRepository: any,
  sourceId: number,
  metrics: {
    avgCrawlTimeMs?: number
    minCrawlTimeMs?: number
    maxCrawlTimeMs?: number
    successRate?: number
    failedPagesCount?: number
    totalTokens?: number
    avgTokensPerPage?: number
    totalContentSizeBytes?: number
    avgContentSizeBytes?: number
    pagesPerMinute?: number
  }
) {
  try {
    await researchSourceRepository.updateSourcePerformanceStats(sourceId, metrics)
  } catch (error) {
    console.warn('Failed to update performance metrics', { sourceId, error: String(error) })
  }
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Create Web Crawling Service with functional factory pattern
 */
export function createWebCrawlingService(deps: WebCrawlingServiceDeps = {}) {
  const {
    domainRepository: domainRepo = domainRepository,
    urlRepository: urlRepo = urlRepository,
    contentRepository: contentRepo = crawledContentRepository,
    researchSourceRepository: researchSourceRepo = dbResearchSourceRepository,
    logger = createServiceLogger('WebCrawlingService')
  } = deps

  // In-memory crawl sessions with TTL tracking
  const activeSessions = new Map<string, SessionEntry>()

  // Cleanup interval reference for proper disposal
  let cleanupIntervalId: Timer | null = null

  /**
   * Clean up expired or completed sessions
   */
  function cleanupExpiredSessions(): number {
    const now = Date.now()
    let cleanedCount = 0

    for (const [crawlId, entry] of activeSessions.entries()) {
      const { session, expiresAt } = entry
      const isExpired = now > expiresAt
      const isTerminal =
        session.progress.status === 'completed' ||
        session.progress.status === 'failed'

      if (isExpired || isTerminal) {
        activeSessions.delete(crawlId)
        cleanedCount++
        logger.info('Cleaned up crawl session', {
          crawlId,
          reason: isExpired ? 'expired' : session.progress.status,
          urlsCrawled: session.progress.urlsCrawled,
          duration: now - session.startedAt
        })
      }
    }

    if (cleanedCount > 0) {
      logger.info('Session cleanup completed', {
        cleanedCount,
        remainingCount: activeSessions.size
      })
    }

    return cleanedCount
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  function startSessionCleanup(): void {
    if (cleanupIntervalId) return // Already started

    cleanupIntervalId = setInterval(() => {
      cleanupExpiredSessions()
    }, SESSION_CLEANUP_INTERVAL)

    logger.info('Session cleanup started', {
      intervalMs: SESSION_CLEANUP_INTERVAL,
      ttlMs: SESSION_TTL
    })
  }

  /**
   * Stop periodic cleanup (for testing and shutdown)
   */
  function stopSessionCleanup(): void {
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId)
      cleanupIntervalId = null
      logger.info('Session cleanup stopped')
    }
  }

  /**
   * Update session access time to extend TTL
   */
  function touchSession(crawlId: string): void {
    const entry = activeSessions.get(crawlId)
    if (entry) {
      entry.lastAccessedAt = Date.now()
      entry.expiresAt = Date.now() + SESSION_TTL
    }
  }

  // Start cleanup on service creation
  startSessionCleanup()

  /**
   * Start a new crawl session from a seed URL
   */
  async function startCrawl(
    seedUrl: string,
    options: CrawlOptions = {},
    context?: CrawlContext
  ): Promise<{
    crawlId: string
    seedDomain: string
    initialUrl: Url
  }> {
    return withErrorContext(
      async () => {
        // Validate seed URL with SSRF protection
        const validatedUrl = await validateResearchUrl(seedUrl)
        const normalizedUrl = crawlUtils.normalizeUrl(validatedUrl.toString())
        const domain = crawlUtils.extractDomain(normalizedUrl)

        logger.info('Starting crawl', { seedUrl: normalizedUrl, domain })

        // Create or update domain record
        const domainRecord = await domainRepo.upsert({
          domain,
          robotsTxt: null,
          crawlDelay: options.crawlDelay ?? DEFAULT_CRAWL_DELAY
        })

        const crawlId = `crawl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // Create URL record
        const urlRecord = await urlRepo.upsert({
          url: normalizedUrl,
          status: 'pending'
        })

        await urlRepo.setCrawlSessionId(urlRecord.id, crawlId)

        // Create crawl session
        const fullOptions: Required<CrawlOptions> = {
          maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
          maxPages: options.maxPages ?? DEFAULT_MAX_PAGES,
          respectRobotsTxt: options.respectRobotsTxt ?? true,
          crawlDelay: options.crawlDelay ?? DEFAULT_CRAWL_DELAY,
          userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
          timeout: options.timeout ?? DEFAULT_TIMEOUT,
          sameDomainOnly: options.sameDomainOnly ?? true
        }

        const now = Date.now()
        const session: CrawlSession = {
          crawlId,
          seedDomain: domain,
          seedUrl: urlRecord,
          options: fullOptions,
          startedAt: now,
          visited: new Set([crawlUtils.generateUrlHash(normalizedUrl)]),
          pending: [{ url: normalizedUrl, depth: 0 }],
          progress: {
            urlsCrawled: 0,
            urlsPending: 1,
            urlsFailed: 0,
            currentDepth: 0,
            status: 'running',
            totalPagesFetched: 0,
            totalLinksDiscovered: 0
          },
          context,
          metrics: {
            totalLinksDiscovered: 0,
            totalPagesFetched: 0
          }
        }

        const sessionEntry: SessionEntry = {
          session,
          expiresAt: now + SESSION_TTL,
          lastAccessedAt: now
        }

        activeSessions.set(crawlId, sessionEntry)

        logger.info('Crawl session created', {
          crawlId,
          domain,
          options: fullOptions
        })

        return {
          crawlId,
          seedDomain: domain,
          initialUrl: urlRecord
        }
      },
      { entity: 'CrawlSession', action: 'startCrawl' }
    )
  }

  /**
   * Process a single URL (fetch, extract content and links)
   */
  async function processUrl(
    urlId: number,
    depth: number,
    options: Required<CrawlOptions>,
    extras: {
      crawlId?: string
      context?: CrawlContext
    } = {}
  ): Promise<{
    success: boolean
    linksExtracted: number
    contentSize: number
  }> {
    return withErrorContext(
      async () => {
        const startTime = Date.now()

        // Use base repository method getAll and find by ID
        const allUrls = await urlRepo.getAll('desc')
        const urlRecord = allUrls.find((u) => u.id === urlId)
        if (!urlRecord) {
          throw safeErrorFactory.notFound('Url', urlId)
        }

        logger.info('Processing URL', {
          urlId,
          url: urlRecord.url,
          depth,
          crawlId: extras.crawlId,
          researchSourceId: extras.context?.researchSourceId
        })
        logger.debug('URL processing started', {
          urlId,
          url: urlRecord.url,
          depth,
          timestamp: startTime
        })

        if (extras.crawlId) {
          await urlRepo.setCrawlSessionId(urlId, extras.crawlId)
        }

        try {
          // Fetch robots.txt if respecting it
          let robotsTxt: string | null = null
          if (options.respectRobotsTxt) {
            const domainRecord = await domainRepo.getDomain(urlRecord.domain)
            if (domainRecord?.robotsTxt) {
              robotsTxt = domainRecord.robotsTxt
            } else {
              // Fetch robots.txt
              const robotsResult = await fetchRobotsTxt(urlRecord.domain)
              robotsTxt = robotsResult.rules
              await domainRepo.updateRobotsTxt(urlRecord.domain, robotsTxt)
            }

            logger.debug('Robots.txt check', {
              url: urlRecord.url,
              hasRobotsTxt: !!robotsTxt,
              isAllowed: isUrlAllowedByRobotsTxt(robotsTxt, urlRecord.url, options.userAgent),
              userAgent: options.userAgent
            })

            // Check if URL is allowed
            if (!isUrlAllowedByRobotsTxt(robotsTxt, urlRecord.url, options.userAgent)) {
              logger.warn('URL blocked by robots.txt', { url: urlRecord.url })
              logger.debug('URL blocked by robots.txt', {
                url: urlRecord.url,
                disallowedPaths: extractDisallowedPaths(robotsTxt)
              })
              await urlRepo.markUrlFailed(urlId, 403)
              return { success: false, linksExtracted: 0, contentSize: 0 }
            }
          }

          // Fetch content with timeout and size limits
          logger.debug('Fetching URL content', {
            url: urlRecord.url,
            timeout: options.timeout,
            userAgent: options.userAgent
          })

          const response = await fetch(urlRecord.url, {
            signal: AbortSignal.timeout(options.timeout),
            headers: {
              'User-Agent': options.userAgent
            }
          })

          if (!response.ok) {
            await urlRepo.markUrlFailed(urlId, response.status)
            logger.warn('HTTP error', { url: urlRecord.url, status: response.status })
            return { success: false, linksExtracted: 0, contentSize: 0 }
          }

          // Check content size
          const contentLength = response.headers.get('content-length')
          if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
            throw new ApiError(
              422,
              `Content too large: ${Math.round(parseInt(contentLength) / 1_000_000)}MB (max 10MB)`,
              'CONTENT_TOO_LARGE',
              { contentLength: parseInt(contentLength) }
            )
          }

          const html = await response.text()

          logger.debug('URL content fetched', {
            url: urlRecord.url,
            status: response.status,
            contentLength: html.length,
            duration: Date.now() - startTime
          })

          // Process HTML content
          const processed = processHtmlContentInternal(html, urlRecord.url)

          logger.debug('Links extracted from page', {
            url: urlRecord.url,
            totalLinks: processed.links.length,
            sampleLinks: processed.links.slice(0, 5),
            depth: depth + 1
          })

          // Save crawled content
          await contentRepo.upsertForUrl(urlId, {
            title: processed.title,
            cleanContent: processed.cleanContent,
            rawHtml: html,
            metadata: processed.metadata,
            links: processed.links,
            crawledAt: Date.now(),
            crawlSessionId: extras.crawlId,
            researchSourceId: extras.context?.researchSourceId,
            depth
          })

          // Mark URL as crawled
          await urlRepo.markUrlCrawled(urlId, response.status)

          if (extras.crawlId) {
            sessionUpdateTotals(extras.crawlId, {
              linksExtracted: processed.links.length,
              pageFetched: true
            })
          }

          logger.info('URL processed successfully', {
            urlId,
            linksExtracted: processed.links.length,
            contentSize: html.length
          })

          return {
            success: true,
            linksExtracted: processed.links.length,
            contentSize: html.length
          }
        } catch (error) {
          await urlRepo.markUrlFailed(urlId)
          logger.error('URL processing failed', {
            urlId,
            url: urlRecord.url,
            error: String(error)
          })
          throw error
        }
      },
      { entity: 'Url', action: 'processUrl', id: urlId }
    )
  }

  /**
   * Extract links from HTML content
   */
  async function extractLinks(html: string, baseUrl: string): Promise<string[]> {
    return withErrorContext(
      async () => {
        const links = extractLinksFromHtml(html, baseUrl)
        logger.info('Links extracted', { count: links.length, baseUrl })
        return links
      },
      { entity: 'Content', action: 'extractLinks' }
    )
  }

  /**
   * Fetch and parse robots.txt for a domain
   */
  async function fetchRobotsTxt(domain: string): Promise<{
    rules: string
    crawlDelay?: number
    disallowedPaths: string[]
  }> {
    return withErrorContext(
      async () => {
        const robotsUrl = `https://${domain}/robots.txt`
        logger.info('Fetching robots.txt', { domain, robotsUrl })

        try {
          const response = await fetch(robotsUrl, {
            signal: AbortSignal.timeout(10000), // 10 second timeout
            headers: {
              'User-Agent': DEFAULT_USER_AGENT
            }
          })

          if (!response.ok) {
            logger.warn('robots.txt not found', { domain, status: response.status })
            return { rules: '', disallowedPaths: [] }
          }

          const rules = await response.text()
          const crawlDelay = extractCrawlDelayFromRobotsTxt(rules, DEFAULT_USER_AGENT)
          const disallowedPaths = extractDisallowedPaths(rules)

          logger.info('robots.txt fetched', {
            domain,
            crawlDelay,
            disallowedCount: disallowedPaths.length
          })

          return {
            rules,
            crawlDelay: crawlDelay ?? undefined,
            disallowedPaths
          }
        } catch (error) {
          logger.warn('Failed to fetch robots.txt', { domain, error: String(error) })
          return { rules: '', disallowedPaths: [] }
        }
      },
      { entity: 'Domain', action: 'fetchRobotsTxt' }
    )
  }

  /**
   * Check if URL is allowed by robots.txt
   */
  async function isUrlAllowed(url: string, userAgent: string): Promise<boolean> {
    return withErrorContext(
      async () => {
        const domain = crawlUtils.extractDomain(url)
        const domainRecord = await domainRepo.getDomain(domain)

        if (!domainRecord?.robotsTxt) {
          // No robots.txt = allow all
          return true
        }

        return isUrlAllowedByRobotsTxt(domainRecord.robotsTxt, url, userAgent)
      },
      { entity: 'Url', action: 'isUrlAllowed' }
    )
  }

  /**
   * Process HTML into clean content using @mozilla/readability
   */
  async function processHtmlContent(
    html: string,
    url: string
  ): Promise<{
    title: string
    cleanContent: string
    metadata: {
      author?: string
      date?: string
      siteName?: string
      excerpt?: string
    }
    links: string[]
  }> {
    return withErrorContext(
      async () => {
        return processHtmlContentInternal(html, url)
      },
      { entity: 'Content', action: 'processHtmlContent' }
    )
  }

  /**
   * Get crawl progress for a session
   */
  async function getCrawlProgress(crawlId: string): Promise<CrawlProgress> {
    return withErrorContext(
      async () => {
        const entry = activeSessions.get(crawlId)
        if (!entry) {
          throw safeErrorFactory.notFound('CrawlSession', crawlId)
        }

        touchSession(crawlId) // Extend TTL on access
        return entry.session.progress
      },
      { entity: 'CrawlSession', action: 'getCrawlProgress' }
    )
  }

  /**
   * Execute a full crawl session (process all pending URLs)
   */
  async function executeCrawl(crawlId: string): Promise<CrawlProgress> {
    return withErrorContext(
      async () => {
        const entry = activeSessions.get(crawlId)
        if (!entry) {
          throw safeErrorFactory.notFound('CrawlSession', crawlId)
        }

        const session = entry.session
        touchSession(crawlId) // Extend TTL on access

        logger.info('Executing crawl', { crawlId })

        // Initialize metadata tracking if research source is available
        const sourceId = session.context?.researchSourceId
        if (sourceId && researchSourceRepo) {
          // Initialize crawl metadata with configuration
          await researchSourceRepo.initializeSourceCrawlMetadata(sourceId, {
            maxDepth: session.options.maxDepth,
            maxPages: session.options.maxPages,
            crawlDelayMs: session.options.crawlDelay
          })

          // Set status to active
          await researchSourceRepo.updateSourceCrawlStatus(sourceId, 'active', crawlId)

          // Initialize progress
          await updateSourceMetadataProgress(researchSourceRepo, sourceId, {
            totalLinksDiscovered: 0,
            totalPagesCrawled: 0,
            pagesRemainingInQueue: session.pending.length,
            currentDepth: 0,
            completedPages: 0,
            failedPages: 0
          })
        }

        // Performance tracking
        const crawlStartTime = Date.now()
        const pageCrawlTimes: number[] = []
        let totalContentSize = 0
        let totalTokens = 0

        while (
          session.pending.length > 0 &&
          session.progress.urlsCrawled < session.options.maxPages &&
          session.progress.status === 'running'
        ) {
          const next = session.pending.shift()
          if (!next) break

          const { url, depth } = next
          const pageStartTime = Date.now()

          // Skip if depth exceeds limit
          if (depth > session.options.maxDepth) {
            logger.debug('Skipping URL - depth limit', {
              url,
              depth,
              maxDepth: session.options.maxDepth
            })
            session.progress.urlsPending--
            continue
          }

          // Update current depth
          session.progress.currentDepth = Math.max(session.progress.currentDepth, depth)

          // Get or create URL record
          const urlRecord = await urlRepo.upsert({ url, status: 'pending' })

          // Process URL
          try {
            const result = await processUrl(urlRecord.id, depth, session.options, {
              crawlId,
              context: session.context
            })

            if (result.success) {
              session.progress.urlsCrawled++

              // Track performance metrics
              const pageCrawlTime = Date.now() - pageStartTime
              pageCrawlTimes.push(pageCrawlTime)
              totalContentSize += result.contentSize

              // Estimate tokens (rough estimate: 1 token ≈ 4 characters)
              const estimatedTokens = Math.floor(result.contentSize / 4)
              totalTokens += estimatedTokens

              // Add extracted links to queue
              const content = await contentRepo.getByUrlId(urlRecord.id)
              if (content?.links) {
                const totalExtracted = content.links.length
                let afterDomainFilter = 0
                let uniqueLinks = 0

                for (const link of content.links) {
                  const linkHash = crawlUtils.generateUrlHash(link)

                  // Skip if already visited
                  if (session.visited.has(linkHash)) {
                    logger.debug('Skipping URL - already visited', {
                      url: link,
                      urlHash: linkHash.substring(0, 8)
                    })
                    continue
                  }

                  // Check same-domain constraint
                  if (session.options.sameDomainOnly) {
                    const linkDomain = crawlUtils.extractDomain(link)
                    if (linkDomain !== session.seedDomain) {
                      logger.debug('Skipping URL - different domain', {
                        url: link,
                        linkDomain,
                        seedDomain: session.seedDomain
                      })
                      continue
                    }
                    afterDomainFilter++
                  }

                  // Add to pending queue
                  session.visited.add(linkHash)
                  session.pending.push({ url: link, depth: depth + 1 })
                  session.progress.urlsPending++
                  uniqueLinks++

                  // Track discovered link in metadata (sample - not every link to avoid overhead)
                  if (sourceId && researchSourceRepo && uniqueLinks <= MAX_LINK_TIMELINE_SIZE) {
                    await trackDiscoveredLink(researchSourceRepo, sourceId, {
                      url: link,
                      title: content.title || undefined,
                      depth: depth + 1,
                      parentUrl: url
                    })
                  }
                }

                logger.debug('Filtering extracted links', {
                  url: urlRecord.url,
                  totalExtracted,
                  afterDomainFilter: session.options.sameDomainOnly ? afterDomainFilter : totalExtracted,
                  afterDeduplication: uniqueLinks,
                  seedDomain: session.seedDomain
                })
              }

              // Periodic metadata updates (every N pages)
              if (sourceId && researchSourceRepo && session.progress.urlsCrawled % PROGRESS_UPDATE_INTERVAL === 0) {
                const avgCrawlTime = pageCrawlTimes.reduce((a, b) => a + b, 0) / pageCrawlTimes.length
                const successRate = (session.progress.urlsCrawled / (session.progress.urlsCrawled + session.progress.urlsFailed)) * 100

                // Update progress metrics
                await updateSourceMetadataProgress(researchSourceRepo, sourceId, {
                  totalLinksDiscovered: session.visited.size,
                  totalPagesCrawled: session.progress.urlsCrawled,
                  pagesRemainingInQueue: session.pending.length,
                  currentDepth: session.progress.currentDepth,
                  completedPages: session.progress.urlsCrawled,
                  failedPages: session.progress.urlsFailed
                })

                // Update performance stats
                await updatePerformanceMetrics(researchSourceRepo, sourceId, {
                  avgCrawlTimeMs: avgCrawlTime,
                  minCrawlTimeMs: Math.min(...pageCrawlTimes),
                  maxCrawlTimeMs: Math.max(...pageCrawlTimes),
                  successRate,
                  failedPagesCount: session.progress.urlsFailed,
                  totalTokens,
                  avgTokensPerPage: totalTokens / session.progress.urlsCrawled,
                  totalContentSizeBytes: totalContentSize,
                  avgContentSizeBytes: totalContentSize / session.progress.urlsCrawled,
                  pagesPerMinute: (session.progress.urlsCrawled / ((Date.now() - crawlStartTime) / 60000))
                })

                logger.debug('Periodic metadata update', {
                  crawlId,
                  sourceId,
                  pagesCrawled: session.progress.urlsCrawled,
                  avgCrawlTime,
                  successRate: `${successRate.toFixed(2)}%`
                })
              }
            } else {
              session.progress.urlsFailed++

              // Track error in metadata
              if (sourceId && researchSourceRepo) {
                await trackCrawlError(researchSourceRepo, sourceId, {
                  url,
                  errorMessage: 'Failed to crawl page',
                  retryCount: 0
                })
              }
            }

            // Respect crawl delay
            if (session.options.crawlDelay > 0) {
              logger.debug('Applying crawl delay', {
                crawlId: session.crawlId,
                delay: session.options.crawlDelay,
                nextUrl: session.pending[0]?.url
              })
              await new Promise((resolve) => setTimeout(resolve, session.options.crawlDelay))
            }
          } catch (error) {
            logger.error('Error processing URL in crawl', {
              crawlId,
              url,
              error: String(error)
            })
            session.progress.urlsFailed++

            // Track error in metadata
            if (sourceId && researchSourceRepo) {
              await trackCrawlError(researchSourceRepo, sourceId, {
                url,
                errorCode: error instanceof Error ? error.name : 'UNKNOWN',
                errorMessage: String(error),
                retryCount: 0
              })
            }
          }

          session.progress.urlsPending--
        }

        // Mark session as completed and trigger cleanup
        session.progress.status = 'completed'
        logger.info('Crawl completed', {
          crawlId,
          urlsCrawled: session.progress.urlsCrawled,
          urlsFailed: session.progress.urlsFailed
        })

        // Final metadata update
        if (sourceId && researchSourceRepo) {
          await researchSourceRepo.updateSourceCrawlStatus(sourceId, 'completed', crawlId)

          // Final progress update
          await updateSourceMetadataProgress(researchSourceRepo, sourceId, {
            totalLinksDiscovered: session.visited.size,
            totalPagesCrawled: session.progress.urlsCrawled,
            pagesRemainingInQueue: 0,
            currentDepth: session.progress.currentDepth,
            completedPages: session.progress.urlsCrawled,
            failedPages: session.progress.urlsFailed
          })

          // Final performance stats
          if (pageCrawlTimes.length > 0) {
            const avgCrawlTime = pageCrawlTimes.reduce((a, b) => a + b, 0) / pageCrawlTimes.length
            const successRate = (session.progress.urlsCrawled / (session.progress.urlsCrawled + session.progress.urlsFailed)) * 100

            await updatePerformanceMetrics(researchSourceRepo, sourceId, {
              avgCrawlTimeMs: avgCrawlTime,
              minCrawlTimeMs: Math.min(...pageCrawlTimes),
              maxCrawlTimeMs: Math.max(...pageCrawlTimes),
              successRate,
              failedPagesCount: session.progress.urlsFailed,
              totalTokens,
              avgTokensPerPage: totalTokens / (session.progress.urlsCrawled || 1),
              totalContentSizeBytes: totalContentSize,
              avgContentSizeBytes: totalContentSize / (session.progress.urlsCrawled || 1),
              pagesPerMinute: (session.progress.urlsCrawled / ((Date.now() - crawlStartTime) / 60000))
            })
          }
        }

        // Clean up completed session immediately
        activeSessions.delete(crawlId)
        logger.info('Completed session cleaned up', { crawlId })

        return session.progress
      },
      { entity: 'CrawlSession', action: 'executeCrawl' }
    )
  }

  function sessionUpdateTotals(
    crawlId: string,
    deltas: {
      linksExtracted?: number
      pageFetched?: boolean
    }
  ) {
    const entry = activeSessions.get(crawlId)
    if (!entry) return

    if (typeof deltas.linksExtracted === 'number') {
      entry.session.metrics.totalLinksDiscovered += deltas.linksExtracted
      entry.session.progress.totalLinksDiscovered = entry.session.metrics.totalLinksDiscovered
    }

    if (deltas.pageFetched) {
      entry.session.metrics.totalPagesFetched += 1
      entry.session.progress.totalPagesFetched = entry.session.metrics.totalPagesFetched
    }

    touchSession(crawlId)
  }

  async function getCrawlArtifacts(
    crawlId: string,
    options: CrawlArtifactsOptions = {}
  ): Promise<CrawlArtifactsResult> {
    return withErrorContext(
      async () => {
        const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
        const cursor = options.cursor

        const urls = await urlRepo.getPageByCrawlSessionId(crawlId, limit + 1, cursor)
        const records = urls.slice(0, limit)
        const hasMore = urls.length > limit
        const nextCursor = hasMore ? urls[limit]!.id : undefined

        const contentMap = await Promise.all(
          records.map(async (url) => {
            const content = await contentRepo.getByUrlId(url.id)
            return { urlId: url.id, content }
          })
        )

        const payloads: CrawlArtifactPayload[] = records.map((url) => {
          const match = contentMap.find((entry) => entry.urlId === url.id)?.content

          return {
            urlId: url.id,
            url: url.url,
            depth: match?.depth ?? null,
            status: url.status,
            httpStatus: url.httpStatus,
            crawledAt: match?.crawledAt ?? url.lastCrawledAt ?? null,
            links: match?.links ?? null,
            title: match?.title ?? null,
            metadata: match?.metadata ?? null,
            researchSourceId: match?.researchSourceId ?? null
          }
        })

        return {
          crawlId,
          records: payloads,
          hasMore,
          nextCursor
        }
      },
      { entity: 'CrawlSession', action: 'getCrawlArtifacts', id: crawlId }
    )
  }

  async function clearCrawlArtifacts(crawlId: string): Promise<void> {
    return withErrorContext(
      async () => {
        await contentRepo.deleteByCrawlSessionId(crawlId)
        await urlRepo.deleteByCrawlSessionId(crawlId)
      },
      { entity: 'CrawlSession', action: 'clearCrawlArtifacts', id: crawlId }
    )
  }

  /**
   * Pause a running crawl session
   */
  async function pauseCrawl(crawlId: string): Promise<void> {
    return withErrorContext(
      async () => {
        const entry = activeSessions.get(crawlId)
        if (!entry) {
          throw safeErrorFactory.notFound('CrawlSession', crawlId)
        }

        entry.session.progress.status = 'paused'
        touchSession(crawlId) // Extend TTL on access
        logger.info('Crawl paused', { crawlId })
      },
      { entity: 'CrawlSession', action: 'pauseCrawl' }
    )
  }

  /**
   * Resume a paused crawl session
   */
  async function resumeCrawl(crawlId: string): Promise<void> {
    return withErrorContext(
      async () => {
        const entry = activeSessions.get(crawlId)
        if (!entry) {
          throw safeErrorFactory.notFound('CrawlSession', crawlId)
        }

        entry.session.progress.status = 'running'
        touchSession(crawlId) // Extend TTL on access
        logger.info('Crawl resumed', { crawlId })
      },
      { entity: 'CrawlSession', action: 'resumeCrawl' }
    )
  }

  /**
   * Cancel and cleanup a crawl session
   */
  async function cancelCrawl(crawlId: string): Promise<void> {
    return withErrorContext(
      async () => {
        const entry = activeSessions.get(crawlId)
        if (!entry) {
          throw safeErrorFactory.notFound('CrawlSession', crawlId)
        }

        entry.session.progress.status = 'failed'
        activeSessions.delete(crawlId)
        logger.info('Crawl cancelled and cleaned up', { crawlId })
      },
      { entity: 'CrawlSession', action: 'cancelCrawl' }
    )
  }

  /**
   * Get dashboard data for a research source
   * Returns latest crawl statistics for real-time display
   */
  async function getSourceDashboardData(sourceId: number) {
    return withErrorContext(
      async () => {
        if (!researchSourceRepo) {
          throw new Error('Research source repository not available')
        }

        // Get performance metrics from repository helpers
        const metrics = await researchSourceRepo.getCrawlPerformanceMetrics(sourceId)

        if (!metrics) {
          return {
            sourceId,
            status: 'idle',
            progress: null,
            performance: null,
            errors: 0,
            lastError: null,
            isActive: false
          }
        }

        return {
          sourceId,
          status: metrics.status,
          progress: metrics.progress,
          performance: metrics.performance,
          errors: metrics.errors,
          lastError: metrics.lastError,
          linkDiscoveryRate: metrics.linkDiscoveryRate,
          estimatedTimeRemaining: metrics.estimatedTimeRemaining,
          isActive: metrics.status === 'active' || metrics.status === 'queued'
        }
      },
      { entity: 'ResearchSource', action: 'getSourceDashboardData', id: sourceId }
    )
  }

  /**
   * Check if a source is actively crawling
   */
  async function isSourceActivelyCrawling(sourceId: number): Promise<boolean> {
    return withErrorContext(
      async () => {
        if (!researchSourceRepo) {
          return false
        }

        const source = await researchSourceRepo.getById(sourceId)
        if (!source) return false

        const metadata = (typeof source.metadata === 'object' && source.metadata ? source.metadata : {}) as any
        return metadata.crawlStatus === 'active' || metadata.crawlStatus === 'queued'
      },
      { entity: 'ResearchSource', action: 'isSourceActivelyCrawling', id: sourceId }
    )
  }

  /**
   * Get recent link discovery activity for a source
   */
  async function getSourceRecentActivity(sourceId: number, limit: number = 10) {
    return withErrorContext(
      async () => {
        if (!researchSourceRepo) {
          throw new Error('Research source repository not available')
        }

        const source = await researchSourceRepo.getById(sourceId)
        if (!source) {
          throw safeErrorFactory.notFound('ResearchSource', sourceId)
        }

        const metadata = (typeof source.metadata === 'object' && source.metadata ? source.metadata : {}) as any
        const timeline = metadata.linkDiscoveryTimeline

        if (!timeline?.recentDiscoveries) {
          return {
            sourceId,
            recentLinks: [],
            linkDiscoveryRate: 0,
            totalLinksDiscovered: 0
          }
        }

        return {
          sourceId,
          recentLinks: timeline.recentDiscoveries.slice(0, limit),
          linkDiscoveryRate: timeline.linkDiscoveryRatePerMinute || 0,
          totalLinksDiscovered: timeline.totalLinksDiscoveredSession || 0,
          lastLinkDiscoveredAt: timeline.lastLinkDiscoveredAt
        }
      },
      { entity: 'ResearchSource', action: 'getSourceRecentActivity', id: sourceId }
    )
  }

  /**
   * Get aggregated crawl statistics for a research session
   */
  async function getResearchCrawlStatistics(researchId: number) {
    return withErrorContext(
      async () => {
        if (!researchSourceRepo) {
          throw new Error('Research source repository not available')
        }

        return await researchSourceRepo.getResearchCrawlStatistics(researchId)
      },
      { entity: 'Research', action: 'getResearchCrawlStatistics', id: researchId }
    )
  }

  return {
    startCrawl,
    processUrl,
    extractLinks,
    fetchRobotsTxt,
    isUrlAllowed,
    processHtmlContent,
    getCrawlProgress,
    executeCrawl,
    pauseCrawl,
    resumeCrawl,
    cancelCrawl,
    getCrawlArtifacts,
    clearCrawlArtifacts,
    // Dashboard and polling methods
    getSourceDashboardData,
    isSourceActivelyCrawling,
    getSourceRecentActivity,
    getResearchCrawlStatistics,
    // Session management utilities
    cleanupExpiredSessions,
    stopSessionCleanup,
    getActiveSessionCount: () => activeSessions.size
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type WebCrawlingService = ReturnType<typeof createWebCrawlingService>
export const webCrawlingService = createWebCrawlingService()

// Export individual functions for tree-shaking
export const {
  startCrawl,
  processUrl,
  extractLinks,
  fetchRobotsTxt,
  isUrlAllowed,
  processHtmlContent,
  getCrawlProgress,
  executeCrawl,
  pauseCrawl,
  resumeCrawl,
  cancelCrawl,
  cleanupExpiredSessions,
  stopSessionCleanup,
  getActiveSessionCount,
  getCrawlArtifacts,
  clearCrawlArtifacts,
  // Dashboard and polling methods
  getSourceDashboardData,
  isSourceActivelyCrawling,
  getSourceRecentActivity,
  getResearchCrawlStatistics,
} = webCrawlingService
