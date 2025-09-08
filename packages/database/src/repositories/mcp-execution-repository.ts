import { eq, and, gte, lte, desc, asc, sql, inArray, isNull } from 'drizzle-orm'
import { db } from '../db'
import {
  mcpToolExecutions,
  mcpToolStatistics,
  mcpExecutionChains,
  mcpErrorPatterns,
  type MCPToolExecution,
  type CreateMCPToolExecution,
  type MCPToolStatistic,
  type MCPExecutionChain,
  type MCPErrorPattern
} from '../schema/mcp-executions'
import type { MCPToolSummary } from '@promptliano/schemas'
import { createBaseRepository } from './base-repository'

/**
 * MCP Tool Execution Repository
 * Handles all database operations for MCP execution tracking
 */
export const mcpExecutionRepository = {
  // Basic CRUD methods
  async getById(id: number): Promise<MCPToolExecution | null> {
    const [result] = await db.select().from(mcpToolExecutions).where(eq(mcpToolExecutions.id, id)).limit(1)
    return result || null
  },

  /**
   * Start a new MCP tool execution
   */
  async startExecution(data: Omit<CreateMCPToolExecution, 'status' | 'startedAt'>): Promise<MCPToolExecution> {
    const [result] = await db
      .insert(mcpToolExecutions)
      .values({
        ...data,
        status: 'running',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()

    if (!result) throw new Error('Failed to create MCP execution')
    return result
  },

  /**
   * Complete an MCP tool execution
   */
  async completeExecution(
    id: number,
    status: 'success' | 'error' | 'timeout',
    outputSize?: number,
    errorMessage?: string,
    errorCode?: string
  ): Promise<MCPToolExecution | null> {
    const completedAt = new Date()
    const [execution] = await db.select().from(mcpToolExecutions).where(eq(mcpToolExecutions.id, id)).limit(1)

    if (!execution) return null

    const durationMs = completedAt.getTime() - execution.startedAt.getTime()

    const [result] = await db
      .update(mcpToolExecutions)
      .set({
        status,
        completedAt,
        durationMs,
        outputSize,
        errorMessage,
        errorCode,
        updatedAt: new Date()
      })
      .where(eq(mcpToolExecutions.id, id))
      .returning()

    return result || null
  },

  /**
   * Query executions with filters
   */
  async queryExecutions(params: {
    projectId?: number
    toolName?: string
    status?: string
    startDate?: number
    endDate?: number
    sessionId?: string
    limit?: number
    offset?: number
    sortBy?: 'startedAt' | 'duration' | 'toolName'
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ executions: MCPToolExecution[]; total: number }> {
    const conditions = []

    if (params.projectId !== undefined) {
      conditions.push(eq(mcpToolExecutions.projectId, params.projectId))
    }
    if (params.toolName) {
      conditions.push(eq(mcpToolExecutions.toolName, params.toolName))
    }
    if (params.status) {
      conditions.push(eq(mcpToolExecutions.status, params.status as 'running' | 'success' | 'error' | 'timeout'))
    }
    if (params.startDate) {
      conditions.push(gte(mcpToolExecutions.startedAt, new Date(params.startDate)))
    }
    if (params.endDate) {
      conditions.push(lte(mcpToolExecutions.startedAt, new Date(params.endDate)))
    }
    if (params.sessionId) {
      conditions.push(eq(mcpToolExecutions.sessionId, params.sessionId))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcpToolExecutions)
      .where(whereClause)

    const count = countResult[0]?.count || 0

    // Get paginated results - build query in a single chain
    const sortColumn =
      params.sortBy === 'duration'
        ? mcpToolExecutions.durationMs
        : params.sortBy === 'toolName'
          ? mcpToolExecutions.toolName
          : mcpToolExecutions.startedAt

    const executions = await db
      .select()
      .from(mcpToolExecutions)
      .where(whereClause || undefined)
      .orderBy(params.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(params.limit || 1000)
      .offset(params.offset || 0)

    return { executions, total: count }
  },

  /**
   * Get execution by project and time range
   */
  async getByProjectAndTimeRange(projectId: number, startDate: Date, endDate: Date): Promise<MCPToolExecution[]> {
    return await db
      .select()
      .from(mcpToolExecutions)
      .where(
        and(
          eq(mcpToolExecutions.projectId, projectId),
          gte(mcpToolExecutions.startedAt, startDate),
          lte(mcpToolExecutions.startedAt, endDate)
        )
      )
      .orderBy(desc(mcpToolExecutions.startedAt))
  }
}

/**
 * MCP Tool Statistics Repository
 */
export const mcpStatisticsRepository = {
  /**
   * Upsert statistics for a tool and period
   */
  async upsertStatistics(data: {
    toolName: string
    projectId: number | null
    periodStart: Date
    periodEnd: Date
    periodType: 'hour' | 'day' | 'week' | 'month'
    executionCount: number
    successCount: number
    errorCount: number
    timeoutCount: number
    totalDurationMs: number
    totalOutputSize: number
  }): Promise<MCPToolStatistic> {
    // Try to find existing record
    const existing = await db
      .select()
      .from(mcpToolStatistics)
      .where(
        and(
          eq(mcpToolStatistics.toolName, data.toolName),
          data.projectId ? eq(mcpToolStatistics.projectId, data.projectId) : isNull(mcpToolStatistics.projectId),
          eq(mcpToolStatistics.periodType, data.periodType),
          eq(mcpToolStatistics.periodStart, data.periodStart)
        )
      )
      .limit(1)

    const current = existing[0]

    if (current) {
      // Update existing record
      const newExecutionCount = current.executionCount + data.executionCount
      const newTotalDuration = current.totalDurationMs + data.totalDurationMs

      const updateResults = await db
        .update(mcpToolStatistics)
        .set({
          executionCount: newExecutionCount,
          successCount: current.successCount + data.successCount,
          errorCount: current.errorCount + data.errorCount,
          timeoutCount: current.timeoutCount + data.timeoutCount,
          totalDurationMs: newTotalDuration,
          avgDurationMs: newTotalDuration / newExecutionCount,
          minDurationMs: Math.min(current.minDurationMs ?? data.totalDurationMs, data.totalDurationMs),
          maxDurationMs: Math.max(current.maxDurationMs ?? data.totalDurationMs, data.totalDurationMs),
          totalOutputSize: current.totalOutputSize + data.totalOutputSize,
          updatedAt: new Date()
        })
        .where(eq(mcpToolStatistics.id, current.id))
        .returning()

      const updated = updateResults[0]
      if (!updated) {
        throw new Error(`Failed to update MCP tool statistics for id: ${current.id}`)
      }
      return updated
    } else {
      // Create new record
      const createResults = await db
        .insert(mcpToolStatistics)
        .values({
          ...data,
          avgDurationMs: data.totalDurationMs / data.executionCount,
          minDurationMs: data.totalDurationMs,
          maxDurationMs: data.totalDurationMs,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()

      const created = createResults[0]
      if (!created) {
        throw new Error('Failed to create MCP tool statistics record')
      }
      return created
    }
  },

  /**
   * Get tool summaries for analytics
   */
  async getToolSummaries(projectId?: number, limit: number = 10): Promise<MCPToolSummary[]> {
    const conditions = []
    if (projectId !== undefined) {
      conditions.push(eq(mcpToolStatistics.projectId, projectId))
    }

    // Get last 30 days of data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    conditions.push(gte(mcpToolStatistics.periodStart, thirtyDaysAgo))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const result = await db
      .select({
        toolName: mcpToolStatistics.toolName,
        totalExecutions: sql<number>`sum(${mcpToolStatistics.executionCount})`,
        successRate: sql<number>`cast(sum(${mcpToolStatistics.successCount}) as real) / sum(${mcpToolStatistics.executionCount})`,
        errorRate: sql<number>`cast(sum(${mcpToolStatistics.errorCount}) as real) / sum(${mcpToolStatistics.executionCount})`,
        timeoutRate: sql<number>`cast(sum(${mcpToolStatistics.timeoutCount}) as real) / sum(${mcpToolStatistics.executionCount})`,
        avgDurationMs: sql<number>`avg(${mcpToolStatistics.avgDurationMs})`,
        minDurationMs: sql<number>`min(${mcpToolStatistics.minDurationMs})`,
        maxDurationMs: sql<number>`max(${mcpToolStatistics.maxDurationMs})`,
        totalOutputSize: sql<number>`sum(${mcpToolStatistics.totalOutputSize})`,
        lastExecutedAt: sql<number>`max(strftime('%s', ${mcpToolStatistics.updatedAt})) * 1000`
      })
      .from(mcpToolStatistics)
      .where(whereClause)
      .groupBy(mcpToolStatistics.toolName)
      .orderBy(desc(sql`sum(${mcpToolStatistics.executionCount})`))
      .limit(limit)

    return result
  },

  /**
   * Get execution timeline
   */
  async getExecutionTimeline(
    projectId?: number,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date
  ): Promise<
    {
      timestamp: Date
      toolCounts: Record<string, number>
      totalCount: number
      avgDuration: number
      successCount: number
      errorCount: number
    }[]
  > {
    const conditions = [eq(mcpToolStatistics.periodType, period)]

    if (projectId !== undefined) {
      conditions.push(eq(mcpToolStatistics.projectId, projectId))
    }
    if (startDate) {
      conditions.push(gte(mcpToolStatistics.periodStart, startDate))
    }
    if (endDate) {
      conditions.push(lte(mcpToolStatistics.periodEnd, endDate))
    }

    const result = await db
      .select({
        timestamp: mcpToolStatistics.periodStart,
        toolName: mcpToolStatistics.toolName,
        executions: sql<number>`sum(${mcpToolStatistics.executionCount})`,
        successCount: sql<number>`sum(${mcpToolStatistics.successCount})`,
        errorCount: sql<number>`sum(${mcpToolStatistics.errorCount})`,
        avgDuration: sql<number>`avg(${mcpToolStatistics.avgDurationMs})`
      })
      .from(mcpToolStatistics)
      .where(and(...conditions))
      .groupBy(mcpToolStatistics.periodStart, mcpToolStatistics.toolName)
      .orderBy(asc(mcpToolStatistics.periodStart))

    // Group by timestamp and aggregate tool counts
    const grouped = new Map<
      string,
      {
        timestamp: Date
        toolCounts: Record<string, number>
        totalCount: number
        avgDuration: number
        successCount: number
        errorCount: number
      }
    >()

    for (const row of result) {
      const key = row.timestamp.toISOString()
      const existing = grouped.get(key)

      if (existing) {
        existing.toolCounts[row.toolName] = (existing.toolCounts[row.toolName] || 0) + row.executions
        existing.totalCount += row.executions
        existing.successCount += row.successCount
        existing.errorCount += row.errorCount
        // Weighted average for duration
        existing.avgDuration = (existing.avgDuration + row.avgDuration) / 2
      } else {
        grouped.set(key, {
          timestamp: row.timestamp,
          toolCounts: { [row.toolName]: row.executions },
          totalCount: row.executions,
          avgDuration: row.avgDuration,
          successCount: row.successCount,
          errorCount: row.errorCount
        })
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }
}

/**
 * MCP Execution Chains Repository
 */
export const mcpChainsRepository = {
  async createChain(chainId: string, executionId: number, parentExecutionId?: number, position = 0): Promise<void> {
    await db.insert(mcpExecutionChains).values({
      chainId,
      executionId,
      parentExecutionId,
      position,
      createdAt: new Date()
    })
  },

  async getChainExecutions(chainId: string): Promise<MCPExecutionChain[]> {
    return await db
      .select()
      .from(mcpExecutionChains)
      .where(eq(mcpExecutionChains.chainId, chainId))
      .orderBy(asc(mcpExecutionChains.position))
  }
}

/**
 * MCP Error Patterns Repository
 */
export const mcpErrorPatternsRepository = {
  async recordPattern(
    projectId: number | null,
    toolName: string,
    errorType: string,
    errorPattern: string
  ): Promise<void> {
    // Try to find existing pattern
    const existing = await db
      .select()
      .from(mcpErrorPatterns)
      .where(
        and(
          projectId ? eq(mcpErrorPatterns.projectId, projectId) : isNull(mcpErrorPatterns.projectId),
          eq(mcpErrorPatterns.toolName, toolName),
          eq(mcpErrorPatterns.errorPattern, errorPattern)
        )
      )
      .limit(1)

    const existingPattern = existing[0]
    if (existingPattern) {
      // Increment occurrence count
      await db
        .update(mcpErrorPatterns)
        .set({
          occurrenceCount: existingPattern.occurrenceCount + 1,
          lastOccurredAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(mcpErrorPatterns.id, existingPattern.id))
    } else {
      // Create new pattern
      await db.insert(mcpErrorPatterns).values({
        projectId,
        toolName,
        errorType,
        errorPattern,
        occurrenceCount: 1,
        lastOccurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
  },

  async getTopPatterns(projectId?: number, limit: number = 10): Promise<MCPErrorPattern[]> {
    const conditions = []
    if (projectId !== undefined) {
      conditions.push(eq(mcpErrorPatterns.projectId, projectId))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    return await db
      .select()
      .from(mcpErrorPatterns)
      .where(whereClause)
      .orderBy(desc(mcpErrorPatterns.occurrenceCount))
      .limit(limit)
  }
}
