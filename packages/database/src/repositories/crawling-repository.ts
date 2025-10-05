/**
 * Web Crawling Repository
 * Database operations for crawling domains, URLs, and content
 */

import { eq, and, desc, lt } from 'drizzle-orm'
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

// Domain Repository
const baseDomainRepo = createBaseRepository(domains)

export const domainRepository = {
  ...baseDomainRepo,

  // Explicitly expose base methods for TypeScript
  async getAll(orderBy: 'asc' | 'desc' = 'desc') {
    return baseDomainRepo.getAll(orderBy)
  },

  async getByDomain(domain: string): Promise<Domain | null> {
    const result = await db.select().from(domains).where(eq(domains.domain, domain))
    return result[0] || null
  },

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

  async updateRobotsTxt(domain: string, robotsTxt: string | null): Promise<Domain> {
    const existing = await this.getByDomain(domain)
    if (!existing) {
      return await baseDomainRepo.create({ domain, robotsTxt })
    }
    return await baseDomainRepo.update(existing.id, { robotsTxt })
  },

  async updateLastCrawl(domain: string): Promise<void> {
    const existing = await this.getByDomain(domain)
    if (existing) {
      await baseDomainRepo.update(existing.id, { lastCrawlAt: Date.now() })
    }
  }
}

// URL Repository
const baseUrlRepo = createBaseRepository(urls)

export const urlRepository = {
  ...baseUrlRepo,

  // Explicitly expose base methods for TypeScript
  async getAll(orderBy: 'asc' | 'desc' = 'desc') {
    return baseUrlRepo.getAll(orderBy)
  },

  async getByUrlHash(urlHash: string): Promise<Url | null> {
    const result = await db.select().from(urls).where(eq(urls.urlHash, urlHash))
    return result[0] || null
  },

  async getByUrl(url: string, urlHash: string): Promise<Url | null> {
    const result = await db.select().from(urls).where(eq(urls.urlHash, urlHash))
    return result[0] || null
  },

  async upsert(data: Omit<InsertUrl, 'id' | 'createdAt' | 'updatedAt'>): Promise<Url> {
    const existing = await this.getByUrlHash(data.urlHash)
    if (existing) {
      return existing
    }
    return await baseUrlRepo.create(data)
  },

  async updateStatus(
    urlHash: string,
    status: UrlStatus,
    httpStatus?: number,
    nextCrawlAt?: number
  ): Promise<Url | null> {
    const existing = await this.getByUrlHash(urlHash)
    if (!existing) return null

    return await baseUrlRepo.update(existing.id, {
      status,
      httpStatus,
      lastCrawledAt: Date.now(),
      nextCrawlAt
    })
  },

  async getStaleUrls(ttlMs: number, limit: number = 100): Promise<Url[]> {
    const cutoffTime = Date.now() - ttlMs
    return await db
      .select()
      .from(urls)
      .where(and(eq(urls.status, 'crawled'), lt(urls.lastCrawledAt, cutoffTime)))
      .limit(limit)
  },

  async getByDomain(domain: string, limit: number = 100): Promise<Url[]> {
    return await db.select().from(urls).where(eq(urls.domain, domain)).limit(limit)
  },

  async getPendingUrls(limit: number = 10): Promise<Url[]> {
    return await db.select().from(urls).where(eq(urls.status, 'pending')).limit(limit)
  }
}

// Crawled Content Repository
const baseContentRepo = createBaseRepository(crawledContent)

export const crawledContentRepository = {
  ...baseContentRepo,

  async getByUrlId(urlId: number): Promise<CrawledContent | null> {
    const result = await db
      .select()
      .from(crawledContent)
      .where(eq(crawledContent.urlId, urlId))
      .orderBy(desc(crawledContent.crawledAt))
    return result[0] || null
  },

  async getLatestByUrl(urlHash: string): Promise<CrawledContent | null> {
    const url = await urlRepository.getByUrlHash(urlHash)
    if (!url) return null
    return await this.getByUrlId(url.id)
  },

  async upsertForUrl(
    urlId: number,
    data: Omit<InsertCrawledContent, 'id' | 'urlId'>
  ): Promise<CrawledContent> {
    const existing = await this.getByUrlId(urlId)
    if (existing) {
      return await baseContentRepo.update(existing.id, { ...data, crawledAt: Date.now() })
    }
    return await baseContentRepo.create({ ...data, urlId })
  },

  async getWithLinks(urlId: number): Promise<(CrawledContent & { links: string[] }) | null> {
    const content = await this.getByUrlId(urlId)
    if (!content) return null
    return content as CrawledContent & { links: string[] }
  }
}

// Export all repositories
export const crawlingRepositories = {
  domain: domainRepository,
  url: urlRepository,
  content: crawledContentRepository
}
