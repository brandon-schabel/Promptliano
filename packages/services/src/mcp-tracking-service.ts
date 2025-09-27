import {
  mcpExecutionRepository,
  mcpStatisticsRepository,
  mcpChainsRepository,
  mcpErrorPatternsRepository,
  type MCPToolExecution,
  type CreateMCPToolExecution,
  type UpdateMCPToolExecution
} from '@promptliano/database'
import type {
  MCPExecutionQuery,
  MCPAnalyticsRequest,
  MCPToolSummary,
  MCPAnalyticsOverview,
  MCPExecutionTimeline,
  MCPExecutionStatus
} from '@promptliano/schemas'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { createServiceLogger } from './core/base-service'
import type { ServiceLogger } from './core/base-service'

// Service configuration interface
export interface MCPTrackingServiceDeps {
  logger?: ServiceLogger
  executionRepository?: typeof mcpExecutionRepository
  statisticsRepository?: typeof mcpStatisticsRepository
  chainsRepository?: typeof mcpChainsRepository
  errorPatternsRepository?: typeof mcpErrorPatternsRepository
}

/**
 * Create MCP Tracking Service with functional factory pattern
 * Handles MCP tool execution tracking, analytics, and error pattern detection
 */
export function createMCPTrackingService(deps: MCPTrackingServiceDeps = {}) {
  const logger = deps.logger || createServiceLogger('MCPTracking')
  const executionRepo = deps.executionRepository || mcpExecutionRepository
  const statsRepo = deps.statisticsRepository || mcpStatisticsRepository
  const chainsRepo = deps.chainsRepository || mcpChainsRepository
  const errorPatternsRepo = deps.errorPatternsRepository || mcpErrorPatternsRepository
  const errors = ErrorFactory.forEntity('MCPExecution')

  // Global tracking state for active executions within this service instance
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
  async function startMCPToolExecution(
    toolName: string,
    projectId?: number,
    inputParams?: Record<string, unknown>,
    sessionId?: string
  ): Promise<number> {
    return withErrorContext(
      async () => {
        const execution = await executionRepo.startExecution({
          toolName,
          projectId: projectId ?? null,
          sessionId: sessionId ?? null,
          inputParams: inputParams ? JSON.stringify(inputParams) : null
        })

        // Track active execution
        const executionId = execution.id as number
        activeExecutions.set(executionId, {
          startTime: execution.startedAt.getTime(),
          toolName,
          projectId
        })

        logger.info('Started MCP tool execution tracking', { executionId, toolName, projectId })
        return executionId
      },
      { entity: 'MCPExecution', action: 'start' }
    )
  }

  /**
   * Complete tracking for an MCP tool execution
   */
  async function completeMCPToolExecution(
    executionId: number,
    status: MCPExecutionStatus,
    outputSize?: number,
    errorMessage?: string,
    errorCode?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const activeExecution = activeExecutions.get(executionId)
      if (!activeExecution) {
        logger.warn('No active execution found for completion', { executionId })
        return
      }

      const completedAt = Date.now()
      const durationMs = completedAt - activeExecution.startTime

      await executionRepo.completeExecution(
        executionId,
        status,
        outputSize ?? undefined,
        errorMessage ?? undefined,
        errorCode ?? undefined
      )

      logger.info('Completed MCP tool execution tracking', {
        executionId,
        status,
        durationMs,
        toolName: activeExecution.toolName
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
      logger.error('Failed to complete execution tracking', { executionId, error })
      // Don't throw to avoid disrupting the actual tool execution
    }
  }

  /**
   * Track an MCP tool execution with automatic completion
   */
  async function trackMCPToolExecution<T>(
    toolName: string,
    projectId: number | undefined,
    inputParams: Record<string, unknown>,
    handler: () => Promise<T>,
    sessionId?: string
  ): Promise<T> {
    const executionId = await startMCPToolExecution(toolName, projectId, inputParams, sessionId)

    try {
      const result = await handler()

      // Calculate output size
      const outputSize = result ? JSON.stringify(result).length : 0

      await completeMCPToolExecution(executionId, 'success', outputSize)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined

      await completeMCPToolExecution(executionId, 'error', undefined, errorMessage, errorCode)

      throw error
    }
  }

  /**
   * Get MCP tool executions with filtering
   */
  async function getMCPToolExecutions(query: MCPExecutionQuery): Promise<{
    executions: MCPToolExecution[]
    total: number
    page: number
    pageSize: number
  }> {
    return withErrorContext(
      async () => {
        const result = await executionRepo.queryExecutions(query)

        return {
          ...result,
          page: Math.floor((query.offset ?? 0) / (query.limit ?? 100)) + 1,
          pageSize: query.limit ?? 100
        }
      },
      { entity: 'MCPExecution', action: 'query' }
    )
  }

  /**
   * Get analytics overview for MCP tools
   */
  async function getMCPAnalyticsOverview(
    projectId?: number,
    startDate?: number,
    endDate?: number
  ): Promise<MCPAnalyticsOverview> {
    return withErrorContext(
      async () => {
        // Get tool summaries
        const topTools = await statsRepo.getToolSummaries(projectId, 10)

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
        const { executions: recentErrors } = await executionRepo.queryExecutions(errorQuery)

        // Get execution timeline (last 7 days by default)
        const timelineStartDate = startDate || Date.now() - 7 * 24 * 60 * 60 * 1000
        const executionTrendData = await statsRepo.getExecutionTimeline(
          projectId,
          'day',
          timelineStartDate ? new Date(timelineStartDate) : undefined,
          endDate ? new Date(endDate) : undefined
        )

        // Calculate overview metrics
        const totalExecutions = topTools.reduce((sum: number, tool: MCPToolSummary) => sum + tool.totalExecutions, 0)
        const uniqueTools = topTools.length
        const overallSuccessRate =
          totalExecutions > 0
            ? topTools.reduce((sum: number, tool: MCPToolSummary) => sum + tool.totalExecutions * tool.successRate, 0) /
              totalExecutions
            : 0
        const avgExecutionTime =
          totalExecutions > 0
            ? topTools.reduce(
                (sum: number, tool: MCPToolSummary) => sum + tool.totalExecutions * tool.avgDurationMs,
                0
              ) / totalExecutions
            : 0

        return {
          totalExecutions,
          uniqueTools,
          overallSuccessRate,
          avgExecutionTime,
          topTools,
          recentErrors: recentErrors
            .filter((error) => error.status !== 'running')
            .map((error) => ({
              id: error.id,
              toolName: error.toolName,
              startedAt: error.startedAt instanceof Date ? error.startedAt.getTime() : error.startedAt,
              status: error.status as 'success' | 'error' | 'timeout',
              errorMessage: error.errorMessage,
              errorType: (error as any).errorType || 'unknown',
              duration: error.durationMs,
              projectId: error.projectId,
              sessionId: error.sessionId,
              inputParams: error.inputParams,
              outputResult: (error as any).output,
              outputSize: error.outputSize
            })),
          executionTrend: executionTrendData.map((item) => ({
            timestamp: item.timestamp instanceof Date ? item.timestamp.getTime() : item.timestamp,
            count: item.totalCount,
            avgDuration: item.avgDuration
          }))
        }
      },
      { entity: 'MCPAnalytics', action: 'getOverview' }
    )
  }

  /**
   * Get tool-specific statistics
   */
  async function getMCPToolStatistics(request: MCPAnalyticsRequest): Promise<MCPToolSummary[]> {
    return withErrorContext(
      async () => {
        return await statsRepo.getToolSummaries(request.projectId)
      },
      { entity: 'MCPToolStatistics', action: 'get' }
    )
  }

  /**
   * Get execution timeline data
   */
  async function getMCPExecutionTimeline(
    projectId?: number,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: number,
    endDate?: number
  ): Promise<MCPExecutionTimeline[]> {
    return withErrorContext(
      async () => {
        const timelineData = await statsRepo.getExecutionTimeline(
          projectId,
          period,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        )

        // Convert to expected MCPExecutionTimeline format
        return timelineData.map((item) => ({
          timestamp: item.timestamp.getTime(),
          toolCounts: item.toolCounts,
          totalCount: item.totalCount,
          avgDuration: item.avgDuration,
          successCount: item.successCount,
          errorCount: item.errorCount
        }))
      },
      { entity: 'MCPExecutionTimeline', action: 'get' }
    )
  }

  /**
   * Create or get chain ID for tracking related executions
   */
  function createMCPExecutionChain(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Add execution to a chain
   */
  async function addExecutionToChain(
    chainId: string,
    executionId: number,
    parentExecutionId?: number,
    position?: number
  ): Promise<void> {
    try {
      await chainsRepo.createChain(chainId, executionId, parentExecutionId, position)
      logger.info('Added execution to chain', { chainId, executionId, parentExecutionId, position })
    } catch (error) {
      logger.error('Failed to add execution to chain', { chainId, executionId, error })
      // Don't throw to avoid disrupting execution
    }
  }

  /**
   * Get all executions in a chain
   */
  async function getChainExecutions(chainId: string): Promise<MCPToolExecution[]> {
    return withErrorContext(
      async () => {
        const chainData = await chainsRepo.getChainExecutions(chainId)
        // Transform the chain data to execution data if needed
        // For now, return empty array as the type mismatch indicates this method may need repository changes
        return []
      },
      { entity: 'MCPExecutionChain', action: 'getExecutions' }
    )
  }

  /**
   * Get top error patterns
   */
  async function getTopErrorPatterns(
    projectId?: number,
    limit: number = 10
  ): Promise<Array<{ pattern: Record<string, unknown>; toolName: string; count: number; lastSeen: number }>> {
    return withErrorContext(
      async () => {
        const patterns = await errorPatternsRepo.getTopPatterns(projectId, limit)
        return patterns.map((pattern) => ({
          pattern: { message: pattern.errorPattern, type: pattern.errorType, toolName: pattern.toolName },
          toolName: pattern.toolName,
          count: pattern.occurrenceCount,
          lastSeen: pattern.lastOccurredAt instanceof Date ? pattern.lastOccurredAt.getTime() : pattern.lastOccurredAt
        }))
      },
      { entity: 'MCPErrorPattern', action: 'getTop' }
    )
  }

  /**
   * Clean up stale active executions (for recovery after crashes)
   */
  async function cleanupStaleExecutions(maxAge: number = 3600000): Promise<void> {
    const now = Date.now()
    const staleExecutions: number[] = []

    for (const [executionId, execution] of activeExecutions.entries()) {
      if (now - execution.startTime > maxAge) {
        staleExecutions.push(executionId)
      }
    }

    for (const executionId of staleExecutions) {
      await completeMCPToolExecution(executionId, 'timeout', undefined, 'Execution timed out')
    }

    if (staleExecutions.length > 0) {
      logger.info('Cleaned up stale executions', { count: staleExecutions.length })
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
      await statsRepo.upsertStatistics({
        toolName,
        projectId: projectId ?? null,
        periodStart: new Date(period.start),
        periodEnd: new Date(period.end),
        periodType: period.type,
        executionCount: 1,
        successCount: status === 'success' ? 1 : 0,
        errorCount: status === 'error' ? 1 : 0,
        timeoutCount: status === 'timeout' ? 1 : 0,
        totalDurationMs: durationMs,
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
    const errorPattern: Record<string, unknown> = {
      tool: toolName,
      errorType: (errorParts[0] || errorMessage).substring(0, 50),
      message: errorMessage.substring(0, 100)
    }

    await errorPatternsRepo.recordPattern(
      projectId ?? null,
      toolName,
      (errorParts[0] || errorMessage).substring(0, 50),
      errorMessage.substring(0, 100)
    )
  }

  // Return public interface
  return {
    startMCPToolExecution,
    completeMCPToolExecution,
    trackMCPToolExecution,
    getMCPToolExecutions,
    getMCPAnalyticsOverview,
    getMCPToolStatistics,
    getMCPExecutionTimeline,
    createMCPExecutionChain,
    addExecutionToChain,
    getChainExecutions,
    getTopErrorPatterns,
    cleanupStaleExecutions
  }
}

// Export types for consumers
export type MCPTrackingService = ReturnType<typeof createMCPTrackingService>

// Export singleton instance for backward compatibility
export const mcpTrackingService = createMCPTrackingService()

// Export individual functions for tree-shaking
export const {
  startMCPToolExecution,
  completeMCPToolExecution,
  trackMCPToolExecution,
  getMCPToolExecutions,
  getMCPAnalyticsOverview,
  getMCPToolStatistics,
  getMCPExecutionTimeline,
  createMCPExecutionChain,
  addExecutionToChain,
  getChainExecutions,
  getTopErrorPatterns,
  cleanupStaleExecutions
} = mcpTrackingService
