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
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { createServiceLogger } from './core/base-service'
import type { ServiceLogger } from './core/base-service'

// Service configuration interface
export interface MCPTrackingServiceDeps {
  logger?: ServiceLogger
  storage?: any // TODO: Replace with proper MCP repository when available
}

/**
 * Create MCP tracking storage interface (temporary implementation)
 * TODO: Replace with proper MCP repository when database schema is implemented
 */
function createMCPTrackingStorage(logger: ServiceLogger) {
  return {
    async createExecution(data: any) {
      // Temporary stub - needs proper implementation with MCP tables
      logger.warn('MCP tracking not fully implemented - createExecution called', { data })
      return { id: Date.now(), ...data }
    },
    async updateExecution(id: number, data: any) {
      logger.warn('MCP tracking not fully implemented - updateExecution called', { id, data })
    },
    async queryExecutions(query: any) {
      logger.warn('MCP tracking not fully implemented - queryExecutions called', { query })
      return { executions: [], total: 0 }
    },
    async getToolSummaries(projectId?: number, limit?: number) {
      logger.warn('MCP tracking not fully implemented - getToolSummaries called', { projectId, limit })
      return []
    },
    async getExecutionTimeline(projectId?: number, period?: string, startDate?: number, endDate?: number) {
      logger.warn('MCP tracking not fully implemented - getExecutionTimeline called', {
        projectId,
        period,
        startDate,
        endDate
      })
      return []
    },
    async createChain(chainId: string, executionId: number, parentExecutionId?: number, position?: number) {
      logger.warn('MCP tracking not fully implemented - createChain called', {
        chainId,
        executionId,
        parentExecutionId,
        position
      })
    },
    async getChainExecutions(chainId: string) {
      logger.warn('MCP tracking not fully implemented - getChainExecutions called', { chainId })
      return []
    },
    async upsertStatistics(data: any) {
      logger.warn('MCP tracking not fully implemented - upsertStatistics called', { data })
    },
    async recordPattern(projectId: number | null, type: string, pattern: any) {
      logger.warn('MCP tracking not fully implemented - recordPattern called', { projectId, type, pattern })
    },
    async getTopPatterns(projectId?: number, type?: string, limit?: number) {
      logger.warn('MCP tracking not fully implemented - getTopPatterns called', { projectId, type, limit })
      return []
    }
  }
}

/**
 * Create MCP Tracking Service with functional factory pattern
 * Handles MCP tool execution tracking, analytics, and error pattern detection
 */
export function createMCPTrackingService(deps: MCPTrackingServiceDeps = {}) {
  const logger = deps.logger || createServiceLogger('MCPTracking')
  const storage = deps.storage || createMCPTrackingStorage(logger)
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
    inputParams?: any,
    userId?: string,
    sessionId?: string
  ): Promise<number> {
    return withErrorContext(
      async () => {
        const execution = await storage.createExecution({
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
    metadata?: any
  ): Promise<void> {
    try {
      const activeExecution = activeExecutions.get(executionId)
      if (!activeExecution) {
        logger.warn('No active execution found for completion', { executionId })
        return
      }

      const completedAt = Date.now()
      const durationMs = completedAt - activeExecution.startTime

      await storage.updateExecution(executionId, {
        completedAt,
        durationMs,
        status,
        outputSize,
        errorMessage,
        errorCode,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      })

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
        const result = await storage.queryExecutions(query)

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
        const topTools = await storage.getToolSummaries(projectId, 10)

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
        const { executions: recentErrors } = await storage.queryExecutions(errorQuery)

        // Get execution timeline (last 7 days by default)
        const timelineStartDate = startDate || Date.now() - 7 * 24 * 60 * 60 * 1000
        const executionTrend = await storage.getExecutionTimeline(projectId, 'day', timelineStartDate, endDate)

        // Calculate overview metrics
        const totalExecutions = topTools.reduce(
          (sum: number, tool: MCPToolSummary) => sum + (tool.totalExecutions as number),
          0
        )
        const uniqueTools = topTools.length
        const overallSuccessRate =
          totalExecutions > 0
            ? topTools.reduce(
                (sum: number, tool: MCPToolSummary) =>
                  sum + (tool.totalExecutions as number) * (tool.successRate as number),
                0
              ) / totalExecutions
            : 0
        const avgExecutionTime =
          totalExecutions > 0
            ? topTools.reduce(
                (sum: number, tool: MCPToolSummary) =>
                  sum + (tool.totalExecutions as number) * (tool.avgDurationMs as number),
                0
              ) / totalExecutions
            : 0

        return {
          totalExecutions,
          uniqueTools,
          overallSuccessRate,
          avgExecutionTime,
          topTools,
          recentErrors,
          executionTrend: executionTrend.map((item: MCPExecutionTimeline) => ({
            timestamp: item.timestamp,
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
        return await storage.getToolSummaries(request.projectId)
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
        return await storage.getExecutionTimeline(projectId, period, startDate, endDate)
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
      await storage.createChain(chainId, executionId, parentExecutionId, position)
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
        return await storage.getChainExecutions(chainId)
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
  ): Promise<Array<{ pattern: any; count: number; lastSeen: number }>> {
    return withErrorContext(
      async () => {
        return await storage.getTopPatterns(projectId, 'error', limit)
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
      await storage.upsertStatistics({
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

    await storage.recordPattern(projectId ?? null, 'error', errorPattern)
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
