/**
 * Crawl Debug API Routes
 *
 * Real-time debugging and monitoring for web crawling operations
 * Follows Promptliano patterns: Hono + Zod + OpenAPI
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  createStandardResponses,
  successResponse,
  operationSuccessResponse,
  createSuccessResponseSchema,
  createListResponseSchema
} from '../utils/route-helpers'
import {
  crawlDebugService,
  type CrawlDebugEvent,
  type CrawlDebugStats,
  type EventCategory,
  type EventLevel
} from '@promptliano/services'
import { OperationSuccessResponseSchema } from '@promptliano/schemas'

// =============================================================================
// SCHEMAS
// =============================================================================

// Event category enum
const EventCategorySchema = z.enum([
  'url-processing',
  'ai-filtering',
  'robots',
  'extraction',
  'queue-management',
  'error'
])

// Event level enum
const EventLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

// Event metadata schema - use catchall to allow any additional properties
const EventMetadataSchema = z
  .object({
    url: z.string().optional(),
    urlId: z.number().optional(),
    score: z.number().optional(),
    reasoning: z.string().optional(),
    duration: z.number().optional(),
    depth: z.number().optional(),
    queueSize: z.number().optional(),
    crawlId: z.string().optional(),
    error: z.string().optional(),
    statusCode: z.number().optional(),
    contentLength: z.number().optional(),
    linksFound: z.number().optional(),
    linksAccepted: z.number().optional(),
    linksRejected: z.number().optional(),
    threshold: z.number().optional()
  })
  .catchall(z.any()) // Allow additional properties with any type

// Debug event schema
const CrawlDebugEventSchema = z.object({
  id: z.string(),
  researchId: z.number(),
  timestamp: z.number(),
  category: EventCategorySchema,
  level: EventLevelSchema,
  message: z.string(),
  metadata: EventMetadataSchema
})

// Debug stats schema
const CrawlDebugStatsSchema = z.object({
  researchId: z.number(),
  totalEvents: z.number(),
  eventsByCategory: z.record(EventCategorySchema, z.number()),
  eventsByLevel: z.record(EventLevelSchema, z.number()),
  averageProcessingTimeMs: z.number().optional(),
  aiAcceptanceRate: z.number().optional(),
  recentActivity: z.array(CrawlDebugEventSchema),
  timeRange: z.object({
    oldest: z.number(),
    newest: z.number()
  })
})

// Query filter schemas
const EventFiltersQuerySchema = z.object({
  category: EventCategorySchema.optional(),
  level: EventLevelSchema.optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
  from: z.coerce.number().int().nonnegative().optional(),
  to: z.coerce.number().int().nonnegative().optional()
})

const ActivityLimitQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10)
})

// Parameter schemas
const ResearchIdParamsSchema = z.object({
  researchId: z.coerce.number().int().positive()
})

// Response schemas
const CrawlDebugEventListResponseSchema = createListResponseSchema(
  CrawlDebugEventSchema,
  'CrawlDebugEventListResponse'
)

const CrawlDebugStatsResponseSchema = createSuccessResponseSchema(
  CrawlDebugStatsSchema,
  'CrawlDebugStatsResponse'
)

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

const getDebugEventsRoute = createRoute({
  method: 'get',
  path: '/api/deep-research/{researchId}/debug/events',
  tags: ['Deep Research', 'Debug'],
  summary: 'Get debug events for a research session',
  description: 'Retrieve filtered debug events from the web crawling system',
  request: {
    params: ResearchIdParamsSchema,
    query: EventFiltersQuerySchema
  },
  responses: createStandardResponses(CrawlDebugEventListResponseSchema)
})

const getDebugStatsRoute = createRoute({
  method: 'get',
  path: '/api/deep-research/{researchId}/debug/stats',
  tags: ['Deep Research', 'Debug'],
  summary: 'Get debug statistics for a research session',
  description: 'Retrieve aggregated statistics including counts, rates, and timing data',
  request: {
    params: ResearchIdParamsSchema
  },
  responses: createStandardResponses(CrawlDebugStatsResponseSchema)
})

const getDebugActivityRoute = createRoute({
  method: 'get',
  path: '/api/deep-research/{researchId}/debug/activity',
  tags: ['Deep Research', 'Debug'],
  summary: 'Get recent debug activity',
  description: 'Retrieve the most recent debug events for real-time monitoring',
  request: {
    params: ResearchIdParamsSchema,
    query: ActivityLimitQuerySchema
  },
  responses: createStandardResponses(CrawlDebugEventListResponseSchema)
})

const clearDebugEventsRoute = createRoute({
  method: 'delete',
  path: '/api/deep-research/{researchId}/debug/events',
  tags: ['Deep Research', 'Debug'],
  summary: 'Clear all debug events',
  description: 'Remove all debug events for a research session',
  request: {
    params: ResearchIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export const crawlDebugRoutes = new OpenAPIHono()

crawlDebugRoutes
  // Get filtered debug events
  .openapi(getDebugEventsRoute, async (c) => {
    const { researchId } = c.req.valid('param')
    const queryParams = c.req.valid('query')

    // Build filters from query parameters
    const filters: {
      categories?: EventCategory[]
      levels?: EventLevel[]
      fromTimestamp?: number
      toTimestamp?: number
      limit?: number
    } = {}

    if (queryParams.category) {
      filters.categories = [queryParams.category]
    }

    if (queryParams.level) {
      filters.levels = [queryParams.level]
    }

    if (queryParams.from !== undefined) {
      filters.fromTimestamp = queryParams.from
    }

    if (queryParams.to !== undefined) {
      filters.toTimestamp = queryParams.to
    }

    if (queryParams.limit !== undefined) {
      filters.limit = queryParams.limit
    }

    const events = crawlDebugService.getEvents(researchId, filters)

    return c.json(successResponse(events), 200)
  })

  // Get debug statistics
  .openapi(getDebugStatsRoute, async (c) => {
    const { researchId } = c.req.valid('param')

    const stats = crawlDebugService.getStats(researchId)

    return c.json(successResponse(stats), 200)
  })

  // Get recent activity
  .openapi(getDebugActivityRoute, async (c) => {
    const { researchId } = c.req.valid('param')
    const { limit } = c.req.valid('query')

    const activity = crawlDebugService.getRecentActivity(researchId, limit)

    return c.json(successResponse(activity), 200)
  })

  // Clear all debug events
  .openapi(clearDebugEventsRoute, async (c) => {
    const { researchId } = c.req.valid('param')

    crawlDebugService.clearEvents(researchId)

    return c.json(operationSuccessResponse('Debug events cleared successfully'), 200)
  })

// Export route types for type safety
export type CrawlDebugRouteTypes = typeof crawlDebugRoutes
