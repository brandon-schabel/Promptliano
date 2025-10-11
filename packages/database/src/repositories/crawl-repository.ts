/**
 * Web Crawling Repository - Enhanced
 * Comprehensive database operations for crawling domains, URLs, and content
 *
 * Features:
 * - Domain-level crawl rules (robots.txt, crawl delay)
 * - URL management with hash-based deduplication
 * - Crawled content storage with metadata
 * - Utility functions for URL normalization and hashing
 */

import { eq, and, desc, lt, sql, inArray, asc, gt } from 'drizzle-orm'
import { db } from '../db'
import {
  domains,
  urls,
  crawledContent,
  type Domain,
  type Url,
  type CrawledContent,
  type InsertDomain,
  type InsertUrl,
  type InsertCrawledContent,
  type UrlStatus
} from '../schema'
import { createBaseRepository } from './base-repository'
import { createHash } from 'crypto'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Normalize URL for consistent hashing
 * - Remove fragments (#)
 * - Remove trailing slashes
 * - Convert to lowercase
 * - Sort query parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Remove fragment
    parsed.hash = ''

    // Sort query parameters for consistency
    const params = Array.from(parsed.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
    parsed.search = new URLSearchParams(params).toString()

    // Remove trailing slash from pathname
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }

    // Convert to lowercase for consistency
    return parsed.toString().toLowerCase()
  } catch (error) {
    // If URL parsing fails, return cleaned original
    return url.toLowerCase().replace(/#.*$/, '').replace(/\/$/, '')
  }
}

/**
 * Generate MD5 hash of normalized URL for fast lookups
 */
export function generateUrlHash(url: string): string {
  const normalized = normalizeUrl(url)
  return createHash('md5').update(normalized).digest('hex')
}

/**
 * Extract domain from URL
 * Returns the hostname without protocol or path
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch (error) {
    // Fallback: try to extract domain from malformed URLs
    const match = url.match(/^(?:https?:\/\/)?([^\/]+)/)
    return (match && match[1]) || url
  }
}

// =============================================================================
// DOMAIN REPOSITORY
// =============================================================================

const baseDomainRepo = createBaseRepository(domains)

export const domainRepository = {
  ...baseDomainRepo,

  /**
   * Explicitly expose base methods for TypeScript
   */
  async getAll(orderBy: 'asc' | 'desc' = 'desc') {
    return baseDomainRepo.getAll(orderBy)
  },

  async delete(id: number): Promise<boolean> {
    return baseDomainRepo.delete(id)
  },

  /**
   * Get domain record by domain name (primary method following getBy{Property} convention)
   * @returns Domain if found, null otherwise (lookup method - does not throw)
   */
  async getByDomain(domain: string): Promise<Domain | null> {
    const result = await db.select().from(domains).where(eq(domains.domain, domain))
    return result[0] || null
  },

  /**
   * Get domain record by domain name (backward compatibility alias)
   * @returns Domain if found, null otherwise (lookup method - does not throw)
   * @deprecated Use getByDomain instead
   */
  async getDomain(domain: string): Promise<Domain | null> {
    return this.getByDomain(domain)
  },

  /**
   * Get domain by extracting from URL
   * @returns Domain if found, null otherwise (lookup method - does not throw)
   */
  async getDomainByUrl(url: string): Promise<Domain | null> {
    const domain = extractDomain(url)
    return this.getByDomain(domain)
  },

  /**
   * Create new domain record
   */
  async createDomain(
    data: Omit<InsertDomain, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Domain> {
    return await baseDomainRepo.create(data)
  },

  /**
   * Update domain record
   */
  async updateDomain(id: number, data: Partial<InsertDomain>): Promise<Domain> {
    return await baseDomainRepo.update(id, data)
  },

  /**
   * Upsert domain (insert or update if exists)
   */
  async upsert(data: Omit<InsertDomain, 'id' | 'createdAt' | 'updatedAt'>): Promise<Domain> {
    const existing = await this.getByDomain(data.domain)
    if (existing) {
      return await baseDomainRepo.update(existing.id, {
        robotsTxt: data.robotsTxt,
        crawlDelay: data.crawlDelay,
        lastCrawlAt: Date.now()
      })
    }
    return await baseDomainRepo.create(data)
  },

  /**
   * Update robots.txt for domain
   */
  async updateRobotsTxt(domain: string, robotsTxt: string | null): Promise<Domain> {
    const existing = await this.getByDomain(domain)
    if (!existing) {
      return await baseDomainRepo.create({ domain, robotsTxt })
    }
    return await baseDomainRepo.update(existing.id, { robotsTxt })
  },

  /**
   * Update last crawl timestamp for domain
   */
  async updateLastCrawl(domain: string): Promise<void> {
    const existing = await this.getByDomain(domain)
    if (existing) {
      await baseDomainRepo.update(existing.id, { lastCrawlAt: Date.now() })
    }
  }
}

// =============================================================================
// URL REPOSITORY
// =============================================================================

const baseUrlRepo = createBaseRepository(urls)

export const urlRepository = {
  ...baseUrlRepo,

  /**
   * Explicitly expose base methods for TypeScript
   */
  async getAll(orderBy: 'asc' | 'desc' = 'desc') {
    return baseUrlRepo.getAll(orderBy)
  },

  async delete(id: number): Promise<boolean> {
    return baseUrlRepo.delete(id)
  },

  /**
   * Create URL with automatic hash generation
   */
  async createUrl(
    data: Omit<InsertUrl, 'id' | 'createdAt' | 'updatedAt' | 'urlHash' | 'domain'>
  ): Promise<Url> {
    const urlHash = generateUrlHash(data.url)
    const domain = extractDomain(data.url)

    return await baseUrlRepo.create({
      ...data,
      urlHash,
      domain
    })
  },

  /**
   * Get URL by hash (primary method following getBy{Property} convention)
   * @returns URL if found, null otherwise (lookup method - does not throw)
   */
  async getByUrlHash(urlHash: string): Promise<Url | null> {
    const result = await db.select().from(urls).where(eq(urls.urlHash, urlHash))
    return result[0] || null
  },

  /**
   * Get URL by hash (backward compatibility alias)
   * @returns URL if found, null otherwise (lookup method - does not throw)
   * @deprecated Use getByUrlHash instead
   */
  async getUrlByHash(urlHash: string): Promise<Url | null> {
    return this.getByUrlHash(urlHash)
  },

  /**
   * Get URL by full URL string (generates hash automatically)
   * @returns URL if found, null otherwise (lookup method - does not throw)
   */
  async getByUrl(url: string): Promise<Url | null> {
    const urlHash = generateUrlHash(url)
    return this.getByUrlHash(urlHash)
  },

  /**
   * Check if URL exists by hash
   */
  async existsByHash(urlHash: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(urls)
      .where(eq(urls.urlHash, urlHash))

    return (result[0]?.count ?? 0) > 0
  },

  /**
   * Get pending URLs to crawl
   */
  async getPendingUrls(limit: number = 10): Promise<Url[]> {
    return await db
      .select()
      .from(urls)
      .where(eq(urls.status, 'pending'))
      .limit(limit)
  },

  /**
   * Get pending URLs for specific domain
   */
  async getPendingUrlsByDomain(domain: string, limit: number = 10): Promise<Url[]> {
    return await db
      .select()
      .from(urls)
      .where(and(
        eq(urls.domain, domain),
        eq(urls.status, 'pending')
      ))
      .limit(limit)
  },

  /**
   * Get URLs by domain
   */
  async getByDomain(domain: string, limit: number = 100): Promise<Url[]> {
    return await db.select().from(urls).where(eq(urls.domain, domain)).limit(limit)
  },

  /**
   * Get URLs linked to a crawl session
   */
  async getByCrawlSessionId(crawlSessionId: string): Promise<Url[]> {
    return await db
      .select()
      .from(urls)
      .where(eq(urls.crawlSessionId, crawlSessionId))
      .orderBy(asc(urls.id))
  },

  /**
   * Get paginated URLs for a crawl session using cursor-based pagination
   */
  async getPageByCrawlSessionId(
    crawlSessionId: string,
    limit: number,
    cursorId?: number
  ): Promise<Url[]> {
    let condition = eq(urls.crawlSessionId, crawlSessionId)
    if (typeof cursorId === 'number') {
      condition = and(condition, gt(urls.id, cursorId))
    }

    return await db
      .select()
      .from(urls)
      .where(condition)
      .orderBy(asc(urls.id))
      .limit(limit)
  },

  /**
   * Update URL status
   */
  async updateUrlStatus(
    id: number,
    status: UrlStatus,
    httpStatus?: number
  ): Promise<Url> {
    return await baseUrlRepo.update(id, {
      status,
      httpStatus,
      lastCrawledAt: status === 'crawled' ? Date.now() : undefined
    })
  },

  /**
   * Mark URL as crawled
   * @throws ErrorFactory.updateFailed if URL doesn't exist (from base repository)
   */
  async markUrlCrawled(id: number, httpStatus: number): Promise<Url> {
    // BaseRepository.update() already throws ErrorFactory.updateFailed if not found
    return await baseUrlRepo.update(id, {
      status: 'crawled',
      httpStatus,
      lastCrawledAt: Date.now()
    })
  },

  /**
   * Mark URL as failed
   * @throws ErrorFactory.updateFailed if URL doesn't exist (from base repository)
   */
  async markUrlFailed(id: number, httpStatus?: number): Promise<Url> {
    // BaseRepository.update() already throws ErrorFactory.updateFailed if not found
    return await baseUrlRepo.update(id, {
      status: 'failed',
      httpStatus,
      lastCrawledAt: Date.now()
    })
  },

  /**
   * Associate URL with a crawl session identifier
   */
  async setCrawlSessionId(id: number, crawlSessionId: string | null): Promise<Url> {
    return await baseUrlRepo.update(id, {
      crawlSessionId,
      updatedAt: Date.now()
    })
  },

  /**
   * Count URLs by crawl session
   */
  async countByCrawlSessionId(crawlSessionId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(urls)
      .where(eq(urls.crawlSessionId, crawlSessionId))

    return result[0]?.count ?? 0
  },

  /**
   * Delete URLs belonging to a crawl session (content cascades)
   */
  async deleteByCrawlSessionId(crawlSessionId: string): Promise<number> {
    const result = await db
      .delete(urls)
      .where(eq(urls.crawlSessionId, crawlSessionId))
      .run() as unknown as { changes: number }

    return result.changes
  },

  /**
   * Upsert URL (insert or return existing)
   */
  async upsert(
    data: Omit<InsertUrl, 'id' | 'createdAt' | 'updatedAt' | 'urlHash' | 'domain'>
  ): Promise<Url> {
    const urlHash = generateUrlHash(data.url)
    const existing = await this.getByUrlHash(urlHash)

    if (existing) {
      return existing
    }

    return await this.createUrl(data)
  },

  /**
   * Get stale URLs that need re-crawling based on TTL
   */
  async getStaleUrls(ttlMs: number, limit: number = 100): Promise<Url[]> {
    const cutoffTime = Date.now() - ttlMs
    return await db
      .select()
      .from(urls)
      .where(and(
        eq(urls.status, 'crawled'),
        lt(urls.lastCrawledAt, cutoffTime)
      ))
      .limit(limit)
  }
}

// =============================================================================
// CRAWLED CONTENT REPOSITORY
// =============================================================================

const baseContentRepo = createBaseRepository(crawledContent)

export const crawledContentRepository = {
  ...baseContentRepo,

  /**
   * Explicitly expose base methods for TypeScript
   */
  async delete(id: number): Promise<boolean> {
    return baseContentRepo.delete(id)
  },

  /**
   * Create content for URL
   */
  async createContent(
    data: Omit<InsertCrawledContent, 'id' | 'crawledAt'>
  ): Promise<CrawledContent> {
    return await baseContentRepo.create({
      ...data,
      crawledAt: Date.now()
    })
  },

  /**
   * Get content by URL ID
   * @returns Content if found, null otherwise (lookup method - does not throw)
   */
  async getContentByUrl(urlId: number): Promise<CrawledContent | null> {
    const result = await db
      .select()
      .from(crawledContent)
      .where(eq(crawledContent.urlId, urlId))
      .orderBy(desc(crawledContent.crawledAt))
    return result[0] || null
  },

  /**
   * Get content by URL ID (alias for consistency)
   * @returns Content if found, null otherwise (lookup method - does not throw)
   */
  async getByUrlId(urlId: number): Promise<CrawledContent | null> {
    return this.getContentByUrl(urlId)
  },

  /**
   * Get content for multiple URL IDs (batch operation)
   * @returns Array of content (may be empty if none found)
   */
  async getByUrlIds(urlIds: number[]): Promise<CrawledContent[]> {
    if (urlIds.length === 0) return []

    const results = await db
      .select()
      .from(crawledContent)
      .where(inArray(crawledContent.urlId, urlIds))
      .orderBy(desc(crawledContent.crawledAt))

    return results as CrawledContent[]
  },

  /**
   * Get latest crawled content (most recent)
   * @returns Array of content (may be empty if none found)
   */
  async getLatestContent(limit: number = 10): Promise<CrawledContent[]> {
    return await db
      .select()
      .from(crawledContent)
      .orderBy(desc(crawledContent.crawledAt))
      .limit(limit)
  },

  /**
   * Get content by URL hash
   * @returns Content if found, null otherwise (lookup method - does not throw)
   */
  async getLatestByUrl(urlHash: string): Promise<CrawledContent | null> {
    const url = await urlRepository.getByUrlHash(urlHash)
    if (!url) return null
    return await this.getByUrlId(url.id)
  },

  /**
   * Upsert content for URL (update existing or create new)
   */
  async upsertForUrl(
    urlId: number,
    data: Omit<InsertCrawledContent, 'id' | 'urlId'>
  ): Promise<CrawledContent> {
    const existing = await this.getByUrlId(urlId)
    if (existing) {
      return await baseContentRepo.update(existing.id, {
        ...data,
        crawledAt: Date.now()
      })
    }
    return await baseContentRepo.create({
      ...data,
      urlId,
      crawledAt: Date.now()
    })
  },

  /**
   * Get content with links extracted
   */
  async getWithLinks(urlId: number): Promise<(CrawledContent & { links: string[] }) | null> {
    const content = await this.getByUrlId(urlId)
    if (!content) return null
    return content as CrawledContent & { links: string[] }
  },

  /**
   * Delete old content before specified timestamp
   * Useful for cleanup and maintenance
   */
  async deleteOldContent(beforeTimestamp: number): Promise<number> {
    const result = await db
      .delete(crawledContent)
      .where(lt(crawledContent.crawledAt, beforeTimestamp))
      .run() as unknown as { changes: number }

    return result.changes
  },

  /**
   * Get crawled content records linked to a crawl session
   */
  async getByCrawlSessionId(crawlSessionId: string): Promise<CrawledContent[]> {
    return await db
      .select()
      .from(crawledContent)
      .where(eq(crawledContent.crawlSessionId, crawlSessionId))
      .orderBy(desc(crawledContent.crawledAt))
  },

  /**
   * Get crawled content records linked to a research source
   */
  async getByResearchSourceId(researchSourceId: number): Promise<CrawledContent[]> {
    return await db
      .select()
      .from(crawledContent)
      .where(eq(crawledContent.researchSourceId, researchSourceId))
      .orderBy(desc(crawledContent.crawledAt))
  },

  /**
   * Count crawled content records for a session
   */
  async countByCrawlSessionId(crawlSessionId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(crawledContent)
      .where(eq(crawledContent.crawlSessionId, crawlSessionId))

    return result[0]?.count ?? 0
  },

  /**
   * Delete crawled content by crawl session identifier
   */
  async deleteByCrawlSessionId(crawlSessionId: string): Promise<number> {
    const result = await db
      .delete(crawledContent)
      .where(eq(crawledContent.crawlSessionId, crawlSessionId))
      .run() as unknown as { changes: number }

    return result.changes
  },

  /**
   * Delete crawled content by research source identifier
   */
  async deleteByResearchSourceId(researchSourceId: number): Promise<number> {
    const result = await db
      .delete(crawledContent)
      .where(eq(crawledContent.researchSourceId, researchSourceId))
      .run() as unknown as { changes: number }

    return result.changes
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export all crawling repositories as a unified object
 */
export const crawlingRepositories = {
  domain: domainRepository,
  url: urlRepository,
  content: crawledContentRepository
}

/**
 * Export utility functions for external use
 */
export const crawlUtils = {
  normalizeUrl,
  generateUrlHash,
  extractDomain
}
