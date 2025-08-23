import { storageService } from '@promptliano/database'
// TODO: These MCP tracking types should be migrated to @promptliano/database
import {
  type MCPToolExecution,
  type CreateMCPToolExecution,
  type UpdateMCPToolExecution,
  type MCPExecutionQuery,
  type MCPAnalyticsRequest,
  type MCPToolSummary,
  type MCPAnalyticsOverview,
  type MCPExecutionTimeline,
  type MCPExecutionStatus
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { createLogger } from './utils/logger'

const logger = createLogger('MCPTracking')

// TODO: Implement proper MCP tracking repository
// For now, create a basic interface to prevent compilation errors
const mcpTrackingStorage = {
  async createExecution(data: any) {
    // Temporary stub - needs proper implementation with MCP tables
    logger.warn('MCP tracking not fully implemented - createExecution called')
    return { id: Date.now(), ...data }
  },
  async updateExecution(id: number, data: any) {
    logger.warn('MCP tracking not fully implemented - updateExecution called')
  },
  async queryExecutions(query: any) {
    logger.warn('MCP tracking not fully implemented - queryExecutions called')
    return { executions: [], total: 0 }
  },
  async getToolSummaries(projectId?: number, limit?: number) {
    logger.warn('MCP tracking not fully implemented - getToolSummaries called')
    return []
  },
  async getExecutionTimeline(projectId?: number, period?: string, startDate?: number, endDate?: number) {
    logger.warn('MCP tracking not fully implemented - getExecutionTimeline called')
    return []
  },
  async createChain(chainId: string, executionId: number, parentExecutionId?: number, position?: number) {
    logger.warn('MCP tracking not fully implemented - createChain called')
  },
  async getChainExecutions(chainId: string) {
    logger.warn('MCP tracking not fully implemented - getChainExecutions called')
    return []
  },
  async upsertStatistics(data: any) {
    logger.warn('MCP tracking not fully implemented - upsertStatistics called')
  },
  async recordPattern(projectId: number | null, type: string, pattern: any) {
    logger.warn('MCP tracking not fully implemented - recordPattern called')
  },
  async getTopPatterns(projectId?: number, type?: string, limit?: number) {
    logger.warn('MCP tracking not fully implemented - getTopPatterns called')
    return []
  }
}

// Global tracking state for active executions
const activeExecutions = new Map<
  number,
  {
    startTime: number
    toolName: string
    projectId?: number
  }
>()

/**
 * Start tracking a new MCP tool execution
 */
export async function startMCPToolExecution(
  toolName: string,
  projectId?: number,
  inputParams?: any,
  userId?: string,
  sessionId?: string
): Promise<number> {
  try {
    const execution = await mcpTrackingStorage.createExecution({
      toolName,
      projectId,
      userId,
      sessionId,
      startedAt: Date.now(),
      inputParams: inputParams ? JSON.stringify(inputParams) : undefined,
      status: 'success' // Default to success, will be updated if error occurs
    })

    // Track active execution
    const executionId = execution.id as number
    activeExecutions.set(executionId, {
      startTime: execution.startedAt,
      toolName,
      projectId
    })

    return executionId
  } catch (error) {
    logger.error('Failed to start execution tracking:', error)
    throw new ApiError(500, 'Failed to start MCP tool execution tracking', 'MCP_TRACKING_START_FAILED')
  }
}

/**
 * Complete tracking for an MCP tool execution
 */
export async function completeMCPToolExecution(
  executionId: number,
  status: MCPExecutionStatus,
  outputSize?: number,
  errorMessage?: string,
  errorCode?: string,
  metadata?: any
): Promise<void> {
  try {
    const activeExecution = activeExecutions.get(executionId)
    if (!activeExecution) {
      console.warn(`[MCPTrackingService] No active execution found for ID: ${executionId}`)
      return
    }

    const completedAt = Date.now()
    const durationMs = completedAt - activeExecution.startTime

    await mcpTrackingStorage.updateExecution(executionId, {
      completedAt,
      durationMs,
      status,
      outputSize,
      errorMessage,
      errorCode,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    })

    // Update statistics asynchronously
    updateStatisticsAsync(activeExecution.toolName, activeExecution.projectId, status, durationMs, outputSize).catch(
      (error) => {
        logger.error('Failed to update statistics:', error)
      }
    )

    // Record patterns asynchronously
    if (status === 'error' && errorMessage) {
      recordErrorPatternAsync(activeExecution.projectId ?? null, activeExecution.toolName, errorMessage).catch(
        (error) => {
          logger.error('Failed to record error pattern:', error)
        }
      )
    }

    // Clean up active execution
    activeExecutions.delete(executionId)
  } catch (error) {
    logger.error('Failed to complete execution tracking:', error)
    // Don't throw to avoid disrupting the actual tool execution
  }
}

/**
 * Track an MCP tool execution with automatic completion
 */
export async function trackMCPToolExecution<T>(
  toolName: string,
  projectId: number | undefined,
  inputParams: any,
  handler: () => Promise<T>,
  userId?: string,
  sessionId?: string
): Promise<T> {
  const executionId = await startMCPToolExecution(toolName, projectId, inputParams, userId, sessionId)

  try {
    const result = await handler()

    // Calculate output size
    const outputSize = result ? JSON.stringify(result).length : 0

    await completeMCPToolExecution(executionId, 'success', outputSize)

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = error instanceof ApiError ? error.code : undefined

    await completeMCPToolExecution(executionId, 'error', undefined, errorMessage, errorCode)

    throw error
  }
}

/**
 * Get MCP tool executions with filtering
 */
export async function getMCPToolExecutions(query: MCPExecutionQuery): Promise<{
  executions: MCPToolExecution[]
  total: number
  page: number
  pageSize: number
}> {
  try {
    const result = await mcpTrackingStorage.queryExecutions(query)

    return {
      ...result,
      page: Math.floor((query.offset ?? 0) / (query.limit ?? 100)) + 1,
      pageSize: query.limit ?? 100
    }
  } catch (error) {
    logger.error('Failed to get executions:', error)
    throw new ApiError(500, 'Failed to retrieve MCP tool executions', 'MCP_TRACKING_QUERY_FAILED')
  }
}

/**
 * Get analytics overview for MCP tools
 */
export async function getMCPAnalyticsOverview(
  projectId?: number,
  startDate?: number,
  endDate?: number
): Promise<MCPAnalyticsOverview> {
  try {
    // Get tool summaries
    const topTools = await mcpTrackingStorage.getToolSummaries(projectId, 10)

    // Get recent errors
    const errorQuery: MCPExecutionQuery = {
      projectId,
      status: 'error',
      startDate,
      endDate,
      limit: 10,
      offset: 0,
      sortBy: 'startedAt',
      sortOrder: 'desc'
    }
    const { executions: recentErrors } = await mcpTrackingStorage.queryExecutions(errorQuery)

    // Get execution timeline (last 7 days by default)
    const timelineStartDate = startDate || Date.now() - 7 * 24 * 60 * 60 * 1000
    const executionTrend = await mcpTrackingStorage.getExecutionTimeline(projectId, 'day', timelineStartDate, endDate)

    // Calculate overview metrics
    const totalExecutions = topTools.reduce((sum, tool) => sum + (tool.totalExecutions as number), 0)
    const uniqueTools = topTools.length
    const overallSuccessRate =
      totalExecutions > 0
        ? topTools.reduce((sum, tool) => sum + (tool.totalExecutions as number) * (tool.successRate as number), 0) /
          totalExecutions
        : 0
    const avgExecutionTime =
      totalExecutions > 0
        ? topTools.reduce((sum, tool) => sum + (tool.totalExecutions as number) * (tool.avgDurationMs as number), 0) /
          totalExecutions
        : 0

    return {
      totalExecutions,
      uniqueTools,
      overallSuccessRate,
      avgExecutionTime,
      topTools,
      recentErrors,
      executionTrend: executionTrend.map((item) => ({
        timestamp: item.timestamp,
        count: item.totalCount,
        avgDuration: item.avgDuration
      }))
    }
  } catch (error) {
    logger.error('Failed to get analytics overview:', error)
    throw new ApiError(500, 'Failed to retrieve MCP analytics overview', 'MCP_ANALYTICS_OVERVIEW_FAILED')
  }
}

/**
 * Get tool-specific statistics
 */
export async function getMCPToolStatistics(request: MCPAnalyticsRequest): Promise<MCPToolSummary[]> {
  try {
    return await mcpTrackingStorage.getToolSummaries(request.projectId)
  } catch (error) {
    logger.error('Failed to get tool statistics:', error)
    throw new ApiError(500, 'Failed to retrieve MCP tool statistics', 'MCP_TOOL_STATISTICS_FAILED')
  }
}

/**
 * Get execution timeline data
 */
export async function getMCPExecutionTimeline(
  projectId?: number,
  period: 'hour' | 'day' | 'week' | 'month' = 'day',
  startDate?: number,
  endDate?: number
): Promise<MCPExecutionTimeline[]> {
  try {
    return await mcpTrackingStorage.getExecutionTimeline(projectId, period, startDate, endDate)
  } catch (error) {
    logger.error('Failed to get execution timeline:', error)
    throw new ApiError(500, 'Failed to retrieve MCP execution timeline', 'MCP_TIMELINE_FAILED')
  }
}

/**
 * Create or get chain ID for tracking related executions
 */
export function createMCPExecutionChain(): string {
  return `chain_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Add execution to a chain
 */
export async function addExecutionToChain(
  chainId: string,
  executionId: number,
  parentExecutionId?: number,
  position?: number
): Promise<void> {
  try {
    await mcpTrackingStorage.createChain(chainId, executionId, parentExecutionId, position)
  } catch (error) {
    logger.error('Failed to add execution to chain:', error)
    // Don't throw to avoid disrupting execution
  }
}

/**
 * Get all executions in a chain
 */
export async function getChainExecutions(chainId: string): Promise<MCPToolExecution[]> {
  try {
    return await mcpTrackingStorage.getChainExecutions(chainId)
  } catch (error) {
    logger.error('Failed to get chain executions:', error)
    throw new ApiError(500, 'Failed to retrieve chain executions', 'MCP_CHAIN_QUERY_FAILED')
  }
}

// --- Private helper functions ---

async function updateStatisticsAsync(
  toolName: string,
  projectId: number | undefined,
  status: MCPExecutionStatus,
  durationMs: number,
  outputSize?: number
): Promise<void> {
  // Get current hour/day/week/month boundaries
  const now = Date.now()
  const hourStart = Math.floor(now / 3600000) * 3600000
  const dayStart = Math.floor(now / 86400000) * 86400000
  const weekStart = Math.floor(now / 604800000) * 604800000
  const monthStart = Math.floor(now / 2592000000) * 2592000000

  const periods = [
    { type: 'hour' as const, start: hourStart, end: hourStart + 3600000 },
    { type: 'day' as const, start: dayStart, end: dayStart + 86400000 },
    { type: 'week' as const, start: weekStart, end: weekStart + 604800000 },
    { type: 'month' as const, start: monthStart, end: monthStart + 2592000000 }
  ]

  for (const period of periods) {
    await mcpTrackingStorage.upsertStatistics({
      toolName,
      projectId: projectId ?? null,
      periodStart: period.start,
      periodEnd: period.end,
      periodType: period.type,
      executionCount: 1,
      successCount: status === 'success' ? 1 : 0,
      errorCount: status === 'error' ? 1 : 0,
      timeoutCount: status === 'timeout' ? 1 : 0,
      totalDurationMs: durationMs,
      avgDurationMs: durationMs,
      minDurationMs: durationMs,
      maxDurationMs: durationMs,
      totalOutputSize: outputSize || 0
    })
  }
}

async function recordErrorPatternAsync(
  projectId: number | null,
  toolName: string,
  errorMessage: string
): Promise<void> {
  // Extract error pattern (first line, error type, etc.)
  const errorParts = errorMessage.split(':')
  const errorPattern = {
    tool: toolName,
    errorType: (errorParts[0] || errorMessage).substring(0, 50),
    message: errorMessage.substring(0, 100)
  }

  await mcpTrackingStorage.recordPattern(projectId ?? null, 'error', errorPattern)
}

/**
 * Get top error patterns
 */
export async function getTopErrorPatterns(
  projectId?: number,
  limit: number = 10
): Promise<Array<{ pattern: any; count: number; lastSeen: number }>> {
  try {
    return await mcpTrackingStorage.getTopPatterns(projectId, 'error', limit)
  } catch (error) {
    logger.error('Failed to get error patterns:', error)
    throw new ApiError(500, 'Failed to retrieve error patterns', 'MCP_ERROR_PATTERNS_FAILED')
  }
}

/**
 * Clean up stale active executions (for recovery after crashes)
 */
export async function cleanupStaleExecutions(maxAge: number = 3600000): Promise<void> {
  const now = Date.now()
  const staleExecutions: number[] = []

  for (const [executionId, execution] of activeExecutions) {
    if (now - execution.startTime > maxAge) {
      staleExecutions.push(executionId)
    }
  }

  for (const executionId of staleExecutions) {
    await completeMCPToolExecution(executionId, 'timeout', undefined, 'Execution timed out')
  }
}
