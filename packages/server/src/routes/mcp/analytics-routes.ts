import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  IDParamsSchema,
  mcpExecutionListResponseSchema,
  mcpAnalyticsOverviewSchema,
  mcpToolSummarySchema,
  mcpExecutionTimelineSchema,
  mcpExecutionStatusSchema,
  type MCPToolExecution
} from '@promptliano/schemas'
import {
  createSuccessResponseSchema,
  createStandardResponses,
  successResponse
} from '../../utils/route-helpers'
import {
  getMCPToolExecutions,
  getMCPAnalyticsOverview,
  getMCPToolStatistics,
  getMCPExecutionTimeline,
  getTopErrorPatterns
} from '@promptliano/services'

const MCPExecutionListSuccessSchema = createSuccessResponseSchema(
  mcpExecutionListResponseSchema,
  'MCPExecutionListSuccessResponse'
)

const MCPAnalyticsOverviewSuccessSchema = createSuccessResponseSchema(
  mcpAnalyticsOverviewSchema,
  'MCPAnalyticsOverviewSuccessResponse'
)

const MCPAnalyticsStatisticsSuccessSchema = createSuccessResponseSchema(
  z.array(mcpToolSummarySchema),
  'MCPAnalyticsStatisticsSuccessResponse'
)

const MCPExecutionTimelineSuccessSchema = createSuccessResponseSchema(
  z.array(mcpExecutionTimelineSchema),
  'MCPExecutionTimelineSuccessResponse'
)

const MCPErrorPatternSchema = z
  .object({
    pattern: z.record(z.string(), z.any()),
    toolName: z.string().optional(),
    count: z.number(),
    lastSeen: z.number()
  })
  .openapi('MCPErrorPattern')

const MCPErrorPatternsSuccessSchema = createSuccessResponseSchema(
  z.array(MCPErrorPatternSchema),
  'MCPErrorPatternsSuccessResponse'
)

const AnalyticsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).optional().openapi({
    param: { name: 'period', in: 'query' },
    description: 'Time window to aggregate analytics over'
  }),
  toolNames: z
    .string()
    .optional()
    .openapi({
      param: { name: 'toolNames', in: 'query' },
      description: 'Comma-separated list of MCP tool names to filter'
    }),
  startDate: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'startDate', in: 'query' }, description: 'Unix timestamp (ms) for range start' }),
  endDate: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'endDate', in: 'query' }, description: 'Unix timestamp (ms) for range end' })
})

const ErrorPatternsQuerySchema = AnalyticsQuerySchema.extend({
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'limit', in: 'query' }, description: 'Maximum number of error patterns to return' })
})

const ExecutionsQuerySchema = z.object({
  toolName: z
    .string()
    .optional()
    .openapi({ param: { name: 'toolName', in: 'query' }, description: 'Filter executions by tool name' }),
  status: mcpExecutionStatusSchema.optional().openapi({
    param: { name: 'status', in: 'query' },
    description: 'Filter by execution status (success, error, timeout)'
  }),
  sessionId: z
    .string()
    .optional()
    .openapi({ param: { name: 'sessionId', in: 'query' }, description: 'Filter by session identifier' }),
  startDate: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'startDate', in: 'query' }, description: 'Unix timestamp (ms) for range start' }),
  endDate: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'endDate', in: 'query' }, description: 'Unix timestamp (ms) for range end' }),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'limit', in: 'query' }, description: 'Maximum number of records (default 100)' }),
  offset: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: 'offset', in: 'query' }, description: 'Pagination offset (default 0)' }),
  sortBy: z
    .enum(['startedAt', 'duration', 'toolName'])
    .optional()
    .openapi({ param: { name: 'sortBy', in: 'query' }, description: 'Sort executions by field' }),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .openapi({ param: { name: 'sortOrder', in: 'query' }, description: 'Sort order' }),
  toolNames: z
    .string()
    .optional()
    .openapi({
      param: { name: 'toolNames', in: 'query' },
      description: 'Alias for toolName supporting comma-separated values'
    })
})

function normalizeToolNames(raw?: string): string[] | undefined {
  if (!raw) return undefined
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

function resolveDateRange(
  period?: 'hour' | 'day' | 'week' | 'month',
  startDate?: number,
  endDate?: number
): { start?: number; end?: number } {
  if (startDate || endDate) {
    return { start: startDate, end: endDate }
  }

  if (!period) return {}

  const now = Date.now()
  const durations: Record<typeof period, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  }

  return {
    start: now - durations[period],
    end: now
  }
}

function serializeExecution(execution: MCPToolExecution) {
  return {
    ...execution,
    startedAt: execution.startedAt instanceof Date ? execution.startedAt.getTime() : execution.startedAt,
    completedAt: execution.completedAt instanceof Date ? execution.completedAt.getTime() : execution.completedAt,
    createdAt: execution.createdAt instanceof Date ? execution.createdAt.getTime() : execution.createdAt,
    updatedAt: execution.updatedAt instanceof Date ? execution.updatedAt.getTime() : execution.updatedAt
  }
}

const getExecutionsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/analytics/executions',
  tags: ['MCP', 'Analytics'],
  summary: 'List MCP tool executions for a project',
  request: {
    params: IDParamsSchema,
    query: ExecutionsQuerySchema
  },
  responses: createStandardResponses(MCPExecutionListSuccessSchema)
})

const getOverviewRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/analytics/overview',
  tags: ['MCP', 'Analytics'],
  summary: 'Get aggregated MCP analytics overview for a project',
  request: {
    params: IDParamsSchema,
    query: AnalyticsQuerySchema
  },
  responses: createStandardResponses(MCPAnalyticsOverviewSuccessSchema)
})

const getStatisticsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/analytics/statistics',
  tags: ['MCP', 'Analytics'],
  summary: 'Get MCP tool statistics for a project',
  request: {
    params: IDParamsSchema,
    query: AnalyticsQuerySchema
  },
  responses: createStandardResponses(MCPAnalyticsStatisticsSuccessSchema)
})

const getTimelineRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/analytics/timeline',
  tags: ['MCP', 'Analytics'],
  summary: 'Get MCP execution timeline for a project',
  request: {
    params: IDParamsSchema,
    query: AnalyticsQuerySchema
  },
  responses: createStandardResponses(MCPExecutionTimelineSuccessSchema)
})

const getErrorPatternsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/analytics/error-patterns',
  tags: ['MCP', 'Analytics'],
  summary: 'Get common MCP error patterns for a project',
  request: {
    params: IDParamsSchema,
    query: ErrorPatternsQuerySchema
  },
  responses: createStandardResponses(MCPErrorPatternsSuccessSchema)
})

export const mcpAnalyticsRoutes = new OpenAPIHono()
  .openapi(getExecutionsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')

    const toolNames = normalizeToolNames(query.toolNames)
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined
    const startDate = query.startDate ? Number.parseInt(query.startDate, 10) : undefined
    const endDate = query.endDate ? Number.parseInt(query.endDate, 10) : undefined

    const executionQuery = {
      projectId: Number(id),
      toolName: query.toolName ?? (toolNames ? toolNames[0] : undefined),
      status: query.status,
      sessionId: query.sessionId,
      startDate,
      endDate,
      limit,
      offset,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    }

    const result = await getMCPToolExecutions(executionQuery)

    const data = {
      executions: result.executions.map(serializeExecution),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    }

    return c.json(successResponse(data))
  })
  .openapi(getOverviewRoute, async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')
    const toolNames = normalizeToolNames(query.toolNames)
    const startDate = query.startDate ? Number.parseInt(query.startDate, 10) : undefined
    const endDate = query.endDate ? Number.parseInt(query.endDate, 10) : undefined
    const { start, end } = resolveDateRange(query.period, startDate, endDate)

    const overview = await getMCPAnalyticsOverview(Number(id), start, end)

    const filteredOverview = toolNames?.length
      ? {
          ...overview,
          topTools: overview.topTools.filter((tool) => toolNames.includes(tool.toolName)),
          recentErrors: overview.recentErrors.filter((error) => toolNames.includes(error.toolName))
        }
      : overview

    return c.json(successResponse(filteredOverview))
  })
  .openapi(getStatisticsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')
    const toolNames = normalizeToolNames(query.toolNames)
    const startDate = query.startDate ? Number.parseInt(query.startDate, 10) : undefined
    const endDate = query.endDate ? Number.parseInt(query.endDate, 10) : undefined

    const stats = await getMCPToolStatistics({
      projectId: Number(id),
      toolNames,
      period: query.period,
      startDate,
      endDate
    })

    return c.json(successResponse(stats))
  })
  .openapi(getTimelineRoute, async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')
    const startDate = query.startDate ? Number.parseInt(query.startDate, 10) : undefined
    const endDate = query.endDate ? Number.parseInt(query.endDate, 10) : undefined
    const { start, end } = resolveDateRange(query.period, startDate, endDate)

    const timeline = await getMCPExecutionTimeline(Number(id), query.period, start, end)

    return c.json(successResponse(timeline))
  })
  .openapi(getErrorPatternsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')
    const toolNames = normalizeToolNames(query.toolNames)
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined
    const startDate = query.startDate ? Number.parseInt(query.startDate, 10) : undefined
    const endDate = query.endDate ? Number.parseInt(query.endDate, 10) : undefined
    const { start, end } = resolveDateRange(query.period, startDate, endDate)

    const patterns = await getTopErrorPatterns(Number(id), limit)

    const normalized = patterns.map((pattern) => ({
      pattern: pattern.pattern,
      toolName: pattern.toolName,
      count: pattern.count,
      lastSeen: pattern.lastSeen
    }))

    const filtered = normalized
      .filter((pattern) => (toolNames?.length ? toolNames.includes(pattern.toolName ?? '') : true))
      .filter((pattern) => (start ? pattern.lastSeen >= start : true))
      .filter((pattern) => (end ? pattern.lastSeen <= end : true))

    return c.json(successResponse(filtered))
  })

export type MCPAnalyticsRouteTypes = typeof mcpAnalyticsRoutes
