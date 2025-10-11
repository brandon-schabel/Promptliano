/**
 * Deep Research Schemas - Application-Level Validation
 *
 * CRITICAL: Database types come from @promptliano/database (auto-generated from Drizzle)
 * This file contains ONLY application-specific validation schemas for:
 * - Request validation (API endpoints)
 * - Response formatting (API responses)
 * - Specialized operations (outline generation, progress tracking)
 */

import { z } from '@hono/zod-openapi'
import { createResponseSchemas } from './schema-factories'

// Import database types (single source of truth)
import type {
  ResearchRecord as DatabaseResearchRecord,
  ResearchSource as DatabaseResearchSource,
  ResearchProcessedData as DatabaseResearchProcessedData,
  ResearchDocumentSection as DatabaseResearchDocumentSection,
  ResearchExport as DatabaseResearchExport
} from '@promptliano/database'

// NOTE: Response schemas are created in the server package using database schemas
// The schemas package should NOT import runtime values from database (only types)

// =============================================================================
// REQUEST SCHEMAS (Application-Level Validation)
// =============================================================================

/**
 * Create Research Request
 * Used for POST /api/research/start
 */
export const CreateResearchRequestSchema = z.object({
  projectId: z.number().int().positive().optional(),
  topic: z.string()
    .min(1, 'Topic is required')
    .max(500, 'Topic too long (max 500 characters)')
    .refine(
      (s) => !/[<>{}[\]]/.test(s),
      'Topic contains invalid characters (<>{}[])'
    ),
  description: z.string()
    .max(2000, 'Description too long (max 2000 characters)')
    .optional()
    .transform(s => s?.trim()),
  maxSources: z.number().int().min(1, 'At least 1 source required').max(50, 'Maximum 50 sources').default(10),
  maxDepth: z.number().int().min(1, 'Depth must be at least 1').max(5, 'Maximum depth is 5').default(3),
  strategy: z.enum(['fast', 'balanced', 'thorough']).default('balanced'),
  searchQueries: z.array(
    z.string().min(1, 'Query cannot be empty').max(200, 'Query too long (max 200 characters)')
  ).max(20, 'Maximum 20 search queries').optional(),
  autoExecute: z.boolean().default(true).optional(),
  modelConfig: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional()
  }).optional(),

  // Crawl mode options
  enableCrawling: z.boolean().default(false).optional(),
  crawlSeedUrl: z.string().url('Invalid URL format').max(2000, 'URL too long').optional(),
  crawlMaxDepth: z.number().int().min(1).max(5).default(2).optional(),
  crawlMaxPages: z.number().int().min(1).max(100).default(20).optional(),
  crawlRelevanceThreshold: z.number().min(0).max(1).default(0.6).optional()
}).refine(
  (data) => {
    // If crawling is enabled, seed URL is required
    if (data.enableCrawling && !data.crawlSeedUrl) {
      return false
    }
    return true
  },
  {
    message: 'crawlSeedUrl is required when enableCrawling is true',
    path: ['crawlSeedUrl']
  }
).openapi('CreateResearchRequest')

/**
 * Update Research Request
 * Used for PATCH /api/research/:id
 */
export const UpdateResearchRequestSchema = z.object({
  topic: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['initializing', 'gathering', 'processing', 'building', 'complete', 'failed']).optional()
}).openapi('UpdateResearchRequest')

/**
 * Add Source Request
 * Used for POST /api/research/:id/sources
 */
export const AddSourceRequestSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .max(2000, 'URL too long (max 2000 characters)'),
  sourceType: z.enum(['web', 'pdf', 'academic', 'api']).default('web')
}).openapi('AddSourceRequest')

/**
 * Start Source Crawl Request
 * Used for POST /api/research/sources/{id}/crawl
 */
export const StartSourceCrawlRequestSchema = z.object({
  depthOverride: z.number().int().min(1).max(5).optional(),
  maxPagesOverride: z.number().int().min(1).max(200).optional(),
  maxLinks: z.number().int().min(1).max(500).optional(),
  recrawl: z.boolean().default(false).optional(),
  sameDomainOnly: z.boolean().default(true).optional()
}).openapi('StartSourceCrawlRequest')

/**
 * Crawl Result Query Schema
 * Used for GET /api/research/sources/{id}/crawl-results query params
 */
export const CrawlResultQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
  includeRawHtml: z.boolean().default(false).optional(),
  includeCleanContent: z.boolean().default(true).optional()
}).openapi('CrawlResultQuery')

/**
 * Create Section Request
 * Used for POST /api/research/:id/sections
 */
export const CreateSectionRequestSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title too long (max 200 characters)'),
  description: z.string()
    .max(1000, 'Description too long (max 1000 characters)')
    .optional(),
  orderIndex: z.number().int().min(0, 'Order index must be non-negative'),
  level: z.number().int().min(1, 'Level must be at least 1').max(6, 'Maximum level is 6').default(1),
  parentSectionId: z.number().int().positive().optional()
}).openapi('CreateSectionRequest')

/**
 * Update Section Request
 * Used for PATCH /api/research/sections/:id
 */
export const UpdateSectionRequestSchema = z.object({
  title: z.string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title too long (max 200 characters)')
    .optional(),
  description: z.string()
    .max(1000, 'Description too long (max 1000 characters)')
    .optional(),
  content: z.string()
    .max(100000, 'Content too long (max 100,000 characters)')
    .optional(),
  orderIndex: z.number().int().min(0).optional(),
  status: z.enum(['pending', 'drafting', 'complete', 'reviewed']).optional()
}).openapi('UpdateSectionRequest')

/**
 * Build Section Request
 * Used for POST /api/research/sections/:id/build
 */
export const BuildSectionRequestSchema = z.object({
  sectionId: z.number().int().positive(),
  userContext: z.string().max(5000, 'Context too long').optional(),
  includeSubsections: z.boolean().default(false)
}).openapi('BuildSectionRequest')

/**
 * Export Request
 * Used for POST /api/research/:id/export
 */
export const ExportRequestSchema = z.object({
  format: z.enum(['markdown', 'pdf', 'html', 'docx']),
  includeToc: z.boolean().default(true),
  includeReferences: z.boolean().default(true),
  filename: z.string()
    .max(255, 'Filename too long (max 255 characters)')
    .refine(
      (s) => !s || !/[/\\<>:"|?*\x00-\x1F]/.test(s),
      'Filename contains invalid characters'
    )
    .refine(
      (s) => !s || !s.includes('..'),
      'Filename cannot contain path traversal (..)'
    )
    .optional()
}).openapi('ExportRequest')

/**
 * Generate Outline Request
 * Used for POST /api/research/:id/outline
 */
export const GenerateOutlineRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic too long'),
  sectionsCount: z.number().int().min(3, 'At least 3 sections required').max(20, 'Maximum 20 sections').default(8),
  depth: z.number().int().min(1, 'Depth must be at least 1').max(3, 'Maximum depth is 3').default(2)
}).openapi('GenerateOutlineRequest')

// =============================================================================
// RESPONSE SCHEMAS (Moved to Server Package)
// =============================================================================
//
// NOTE: Response schemas that use database schemas are created in the server package
// to avoid importing runtime values from @promptliano/database (which has top-level await).
// This package should only contain request validation schemas and types.
//
// Response schemas are created in:
// packages/server/src/routes/deep-research-routes.ts

// =============================================================================
// SPECIALIZED RESPONSE SCHEMAS (Application-Specific)
// =============================================================================

/**
 * Research Progress Response
 * Used for GET /api/research/:id/progress
 */
export const ResearchProgressResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    researchId: z.number().int().positive(),
    status: z.enum(['initializing', 'gathering', 'processing', 'building', 'complete', 'failed']),
    progress: z.object({
      totalSources: z.number().int().min(0),
      processedSources: z.number().int().min(0),
      sectionsTotal: z.number().int().min(0),
      sectionsCompleted: z.number().int().min(0),
      percentage: z.number().min(0).max(100)
    }),
    currentPhase: z.string(),
    estimatedTimeRemaining: z.number().int().min(0).optional()
  })
}).openapi('ResearchProgressResponse')

/**
 * Generate Outline Response
 * Used for POST /api/research/:id/outline
 */
export const GenerateOutlineResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    title: z.string(),
    sections: z.array(z.object({
      title: z.string(),
      description: z.string(),
      level: z.number().int().min(1).max(6),
      subsections: z.array(z.object({
        title: z.string(),
        description: z.string(),
        level: z.number().int().min(1).max(6)
      })).optional()
    })),
    estimatedTokens: z.number().int().min(0),
    estimatedTime: z.number().int().min(0)
  })
}).openapi('GenerateOutlineResponse')

/**
 * Execute Workflow Request
 * Used for POST /api/research/{id}/execute
 */
export const ExecuteWorkflowRequestSchema = z.object({
  options: z.object({
    skipGathering: z.boolean().optional(),
    skipProcessing: z.boolean().optional(),
    skipBuilding: z.boolean().optional(),
    modelConfig: z.object({
      provider: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional()
    }).optional()
  }).optional()
}).openapi('ExecuteWorkflowRequest')

/**
 * Workflow Status Response
 * Used for GET /api/research/{id}/workflow-status
 */
export const WorkflowStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    researchId: z.number().int().positive(),
    status: z.enum(['initializing', 'gathering', 'processing', 'building', 'complete', 'failed']),
    currentPhase: z.string(),
    canResume: z.boolean(),
    canExecute: z.boolean(),
    canStop: z.boolean(),
    progress: z.object({
      percentage: z.number().min(0).max(100),
      totalSources: z.number().int().min(0),
      processedSources: z.number().int().min(0),
      sectionsTotal: z.number().int().min(0),
      sectionsCompleted: z.number().int().min(0)
    }),
    estimatedTimeRemaining: z.number().int().min(0).optional(),
    lastError: z.string().optional()
  })
}).openapi('WorkflowStatusResponse')

/**
 * Crawl Progress Response
 * Used for GET /api/research/{id}/crawl-progress
 */
export const CrawlProgressResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    researchId: z.number().int().positive(),
    crawlEnabled: z.boolean(),
    crawlId: z.string().optional(),
    seedUrl: z.string().optional(),
    progress: z.object({
      urlsCrawled: z.number().int().min(0),
      urlsPending: z.number().int().min(0),
      urlsFailed: z.number().int().min(0),
      currentDepth: z.number().int().min(0)
    }).optional(),
    config: z.object({
      maxDepth: z.number().int().min(1).max(5),
      maxPages: z.number().int().min(1).max(100),
      relevanceThreshold: z.number().min(0).max(1)
    }).optional()
  })
}).openapi('CrawlProgressResponse')

/**
 * Source Crawl Status Response
 * Used for GET /api/research/sources/{id}/crawl-status
 */
export const SourceCrawlStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    sourceId: z.number().int().positive(),
    researchId: z.number().int().positive(),
    status: z.enum(['idle', 'running', 'completed', 'failed']),
    crawlSessionId: z.string().optional(),
    startedAt: z.number().optional(),
    finishedAt: z.number().optional(),
    lastCrawledAt: z.number().optional(),
    error: z.string().optional(),
    progress: z.object({
      urlsCrawled: z.number().int().min(0),
      urlsPending: z.number().int().min(0),
      urlsFailed: z.number().int().min(0),
      currentDepth: z.number().int().min(0)
    }).optional()
  })
}).openapi('SourceCrawlStatusResponse')

/**
 * Source Crawl Results Response
 * Used for GET /api/research/sources/{id}/crawl-results
 */
export const SourceCrawlResultsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    sourceId: z.number().int().positive(),
    crawlSessionId: z.string().optional(),
    links: z.array(z.object({
      url: z.string().url(),
      depth: z.number().int().min(0),
      httpStatus: z.number().int().nullable(),
      firstSeenAt: z.number().optional(),
      sourceUrlId: z.number().optional()
    })),
    payloads: z.array(z.object({
      url: z.string().url(),
      title: z.string().optional(),
      rawHtml: z.string().optional(),
      cleanContent: z.string().optional(),
      metadata: z.record(z.any()).optional(),
      crawledAt: z.number()
    })),
    cursor: z.string().optional(),
    hasMore: z.boolean()
  })
}).openapi('SourceCrawlResultsResponse')

// =============================================================================
// TYPE EXPORTS (Inferred from Schemas)
// =============================================================================

// Database types (re-export from database package)
export type {
  ResearchRecord,
  ResearchSource,
  ResearchProcessedData,
  ResearchDocumentSection,
  ResearchExport
} from '@promptliano/database'

// Request types (inferred from request schemas)
export type CreateResearchRequest = z.infer<typeof CreateResearchRequestSchema>
export type UpdateResearchRequest = z.infer<typeof UpdateResearchRequestSchema>
export type AddSourceRequest = z.infer<typeof AddSourceRequestSchema>
export type CreateSectionRequest = z.infer<typeof CreateSectionRequestSchema>
export type UpdateSectionRequest = z.infer<typeof UpdateSectionRequestSchema>
export type BuildSectionRequest = z.infer<typeof BuildSectionRequestSchema>
export type ExportRequest = z.infer<typeof ExportRequestSchema>
export type GenerateOutlineRequest = z.infer<typeof GenerateOutlineRequestSchema>
export type ExecuteWorkflowRequest = z.infer<typeof ExecuteWorkflowRequestSchema>
export type StartSourceCrawlRequest = z.infer<typeof StartSourceCrawlRequestSchema>
export type CrawlResultQuery = z.infer<typeof CrawlResultQuerySchema>

// NOTE: Response types are exported from the server package
// See packages/server/src/routes/deep-research-routes.ts

// Specialized response types
export type ResearchProgressResponse = z.infer<typeof ResearchProgressResponseSchema>
export type GenerateOutlineResponse = z.infer<typeof GenerateOutlineResponseSchema>
export type WorkflowStatusResponse = z.infer<typeof WorkflowStatusResponseSchema>
export type CrawlProgressResponse = z.infer<typeof CrawlProgressResponseSchema>
export type SourceCrawlStatusResponse = z.infer<typeof SourceCrawlStatusResponseSchema>
export type SourceCrawlResultsResponse = z.infer<typeof SourceCrawlResultsResponseSchema>
