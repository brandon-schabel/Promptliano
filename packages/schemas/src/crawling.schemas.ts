import { z } from '@hono/zod-openapi'
import { createSuccessResponseSchema, createListResponseSchema } from './factories'

// =============================================================================
// WEB CRAWLING SCHEMAS
// =============================================================================

// Crawl Request Schema
export const CrawlRequestSchema = z
  .object({
    url: z
      .string()
      .url({ message: 'Must be a valid URL' })
      .openapi({ example: 'https://example.com' }),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(1)
      .openapi({
        example: 1,
        description: 'Maximum depth to crawl (1-5)'
      }),
    summarize: z
      .boolean()
      .default(false)
      .openapi({
        example: false,
        description: 'Generate AI summary of crawled content'
      }),
    forceRefresh: z
      .boolean()
      .default(false)
      .openapi({
        example: false,
        description: 'Bypass cache and force fresh crawl'
      })
  })
  .openapi('CrawlRequest')

// Crawled Page Data Schema
export const CrawledPageSchema = z
  .object({
    id: z.number().int().positive(),
    url: z.string().url(),
    urlHash: z.string(),
    domain: z.string(),
    status: z.enum(['pending', 'crawled', 'failed']),
    httpStatus: z.number().int().nullable(),
    title: z.string().nullable(),
    cleanContent: z.string().nullable(),
    metadata: z.record(z.string(), z.any()).nullable(),
    summary: z.string().nullable(),
    lastCrawledAt: z.number().nullable(),
    createdAt: z.number()
  })
  .openapi('CrawledPage')

// Crawl Response Schema
export const CrawlResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      pagesCrawled: z.number().int().min(0),
      results: z.array(CrawledPageSchema),
      aiSummary: z.string().optional()
    })
  })
  .openapi('CrawlResponse')

// Cached Content Response Schema
export const CachedContentResponseSchema = createSuccessResponseSchema(
  z.object({
    url: z.string().url(),
    title: z.string().nullable(),
    cleanContent: z.string().nullable(),
    metadata: z.record(z.string(), z.any()).nullable(),
    summary: z.string().nullable(),
    lastCrawledAt: z.number().nullable()
  }),
  { name: 'CachedContent' }
)

// Crawl History Query Schema
export const CrawlHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).openapi({
    example: 50,
    description: 'Maximum number of results to return'
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    example: 0,
    description: 'Number of results to skip'
  })
})

// Crawl History Item Schema
export const CrawlHistoryItemSchema = z
  .object({
    id: z.number().int().positive(),
    url: z.string().url(),
    domain: z.string(),
    status: z.enum(['pending', 'crawled', 'failed']),
    httpStatus: z.number().int().nullable(),
    title: z.string().nullable(),
    lastCrawledAt: z.number().nullable(),
    createdAt: z.number()
  })
  .openapi('CrawlHistoryItem')

// Crawl History Response Schema
export const CrawlHistoryResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      total: z.number().int().min(0),
      crawls: z.array(CrawlHistoryItemSchema)
    })
  })
  .openapi('CrawlHistoryResponse')

// Search Request Schema
export const SearchRequestSchema = z
  .object({
    query: z.string().min(1).openapi({
      example: 'search term',
      description: 'Search query for cached content'
    }),
    limit: z.number().int().min(1).max(100).default(20).openapi({
      example: 20,
      description: 'Maximum number of results to return'
    })
  })
  .openapi('SearchRequest')

// Search Result Schema
export const SearchResultSchema = z
  .object({
    id: z.number().int().positive(),
    url: z.string().url(),
    title: z.string().nullable(),
    snippet: z.string().nullable(),
    relevanceScore: z.number().min(0).max(1).optional(),
    lastCrawledAt: z.number().nullable()
  })
  .openapi('SearchResult')

// Search Response Schema
export const SearchResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      results: z.array(SearchResultSchema),
      total: z.number().int().min(0)
    })
  })
  .openapi('SearchResponse')

// Domain Stats Schema
export const DomainStatsSchema = z
  .object({
    domain: z.string(),
    totalPages: z.number().int().min(0),
    lastCrawl: z.number().nullable(),
    robotsTxt: z.string().nullable(),
    crawlDelay: z.number().int().min(0)
  })
  .openapi('DomainStats')

// Domains Response Schema
export const DomainsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      domains: z.array(DomainStatsSchema)
    })
  })
  .openapi('DomainsResponse')

// Robots.txt Response Schema
export const RobotsTxtResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      robotsTxt: z.string().nullable(),
      crawlDelay: z.number().int().min(0)
    })
  })
  .openapi('RobotsTxtResponse')

// URL Hash Param Schema
export const UrlHashParamSchema = z.object({
  urlHash: z.string().length(32).openapi({
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    description: 'MD5 hash of the URL'
  })
})

// Domain Param Schema
export const DomainParamSchema = z.object({
  domain: z.string().openapi({
    example: 'example.com',
    description: 'Domain name'
  })
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CrawlRequest = z.infer<typeof CrawlRequestSchema>
export type CrawledPage = z.infer<typeof CrawledPageSchema>
export type CrawlResponse = z.infer<typeof CrawlResponseSchema>
export type CachedContentResponse = z.infer<typeof CachedContentResponseSchema>
export type CrawlHistoryQuery = z.infer<typeof CrawlHistoryQuerySchema>
export type CrawlHistoryItem = z.infer<typeof CrawlHistoryItemSchema>
export type CrawlHistoryResponse = z.infer<typeof CrawlHistoryResponseSchema>
export type SearchRequest = z.infer<typeof SearchRequestSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>
export type SearchResponse = z.infer<typeof SearchResponseSchema>
export type DomainStats = z.infer<typeof DomainStatsSchema>
export type DomainsResponse = z.infer<typeof DomainsResponseSchema>
export type RobotsTxtResponse = z.infer<typeof RobotsTxtResponseSchema>
export type UrlHashParam = z.infer<typeof UrlHashParamSchema>
export type DomainParam = z.infer<typeof DomainParamSchema>
