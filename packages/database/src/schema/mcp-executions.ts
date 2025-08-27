import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { projects } from '../schema'

/**
 * MCP Tool Execution Tracking Schema
 * Tracks individual MCP tool executions with timing and status
 */
export const mcpToolExecutions = sqliteTable(
  'mcp_tool_executions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    toolName: text('tool_name').notNull(),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    sessionId: text('session_id'),
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    durationMs: integer('duration_ms'),
    status: text('status', { enum: ['running', 'success', 'error', 'timeout'] }).notNull().default('running'),
    errorMessage: text('error_message'),
    errorCode: text('error_code'),
    inputParams: text('input_params'), // JSON string
    outputSize: integer('output_size'),
    metadata: text('metadata'), // JSON string for additional data
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    toolNameIdx: index('mcp_exec_tool_name_idx').on(table.toolName),
    projectIdx: index('mcp_exec_project_idx').on(table.projectId),
    statusIdx: index('mcp_exec_status_idx').on(table.status),
    startedAtIdx: index('mcp_exec_started_at_idx').on(table.startedAt),
    sessionIdx: index('mcp_exec_session_idx').on(table.sessionId)
  })
)

/**
 * MCP Tool Statistics
 * Aggregated statistics for MCP tool usage by period
 */
export const mcpToolStatistics = sqliteTable(
  'mcp_tool_statistics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    toolName: text('tool_name').notNull(),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
    periodType: text('period_type', { enum: ['hour', 'day', 'week', 'month'] }).notNull(),
    executionCount: integer('execution_count').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    timeoutCount: integer('timeout_count').notNull().default(0),
    totalDurationMs: integer('total_duration_ms').notNull().default(0),
    avgDurationMs: real('avg_duration_ms').notNull().default(0),
    minDurationMs: integer('min_duration_ms'),
    maxDurationMs: integer('max_duration_ms'),
    totalOutputSize: integer('total_output_size').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    uniqueStatIdx: uniqueIndex('mcp_stat_unique_idx').on(
      table.toolName,
      table.projectId,
      table.periodType,
      table.periodStart
    ),
    toolNameIdx: index('mcp_stat_tool_name_idx').on(table.toolName),
    projectIdx: index('mcp_stat_project_idx').on(table.projectId),
    periodIdx: index('mcp_stat_period_idx').on(table.periodStart, table.periodEnd)
  })
)

/**
 * MCP Execution Chains
 * Track related executions (e.g., multi-step operations)
 */
export const mcpExecutionChains = sqliteTable(
  'mcp_execution_chains',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chainId: text('chain_id').notNull(),
    executionId: integer('execution_id')
      .notNull()
      .references(() => mcpToolExecutions.id, { onDelete: 'cascade' }),
    parentExecutionId: integer('parent_execution_id').references(() => mcpToolExecutions.id, {
      onDelete: 'cascade'
    }),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    chainIdx: index('mcp_chain_idx').on(table.chainId),
    executionIdx: index('mcp_chain_execution_idx').on(table.executionId),
    uniqueChainExecIdx: uniqueIndex('mcp_chain_exec_unique_idx').on(table.chainId, table.executionId)
  })
)

/**
 * MCP Error Patterns
 * Track common error patterns for analysis
 */
export const mcpErrorPatterns = sqliteTable(
  'mcp_error_patterns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    errorType: text('error_type').notNull(),
    errorPattern: text('error_pattern').notNull(), // Normalized error message pattern
    occurrenceCount: integer('occurrence_count').notNull().default(1),
    lastOccurredAt: integer('last_occurred_at', { mode: 'timestamp' }).notNull(),
    metadata: text('metadata'), // JSON string with additional context
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    projectIdx: index('mcp_error_project_idx').on(table.projectId),
    toolNameIdx: index('mcp_error_tool_idx').on(table.toolName),
    errorTypeIdx: index('mcp_error_type_idx').on(table.errorType),
    uniquePatternIdx: uniqueIndex('mcp_error_pattern_unique_idx').on(
      table.projectId,
      table.toolName,
      table.errorPattern
    )
  })
)

// Type exports for use across the application
export type MCPToolExecution = typeof mcpToolExecutions.$inferSelect
export type CreateMCPToolExecution = typeof mcpToolExecutions.$inferInsert
export type UpdateMCPToolExecution = Partial<CreateMCPToolExecution>

export type MCPToolStatistic = typeof mcpToolStatistics.$inferSelect
export type CreateMCPToolStatistic = typeof mcpToolStatistics.$inferInsert
export type UpdateMCPToolStatistic = Partial<CreateMCPToolStatistic>

export type MCPExecutionChain = typeof mcpExecutionChains.$inferSelect
export type CreateMCPExecutionChain = typeof mcpExecutionChains.$inferInsert

export type MCPErrorPattern = typeof mcpErrorPatterns.$inferSelect
export type CreateMCPErrorPattern = typeof mcpErrorPatterns.$inferInsert
export type UpdateMCPErrorPattern = Partial<CreateMCPErrorPattern>