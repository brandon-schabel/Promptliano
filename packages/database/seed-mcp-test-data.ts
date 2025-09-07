#!/usr/bin/env bun
import {
  mcpExecutionRepository,
  mcpStatisticsRepository,
  mcpErrorPatternsRepository
} from './src/repositories/mcp-execution-repository'

async function seedMCPData() {
  console.log('Seeding MCP analytics data...')

  const projectId = null // Test without project reference first
  const tools = ['project_manager', 'ticket_manager', 'queue_processor', 'ai_assistant']
  const statuses = ['success', 'success', 'success', 'error', 'success', 'timeout'] as const

  // Create sample executions
  for (let i = 0; i < 50; i++) {
    const toolName = tools[Math.floor(Math.random() * tools.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const startedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Last 7 days

    const execution = await mcpExecutionRepository.startExecution({
      toolName,
      projectId,
      userId: 'test-user',
      sessionId: `session-${Math.floor(i / 10)}`,
      inputParams: JSON.stringify({ action: 'test', data: { index: i } })
    })

    // Complete the execution
    const duration = Math.floor(Math.random() * 5000) + 100 // 100ms to 5s
    const outputSize = Math.floor(Math.random() * 10000)
    const errorMessage = status === 'error' ? `Test error ${i}` : undefined

    await mcpExecutionRepository.completeExecution(execution.id, status, outputSize, errorMessage)
  }

  // Create some statistics
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  for (const tool of tools) {
    for (let day = 0; day < 7; day++) {
      const periodStart = new Date(now - (day + 1) * dayMs)
      const periodEnd = new Date(now - day * dayMs)

      await mcpStatisticsRepository.upsertStatistics({
        toolName: tool,
        projectId,
        periodStart,
        periodEnd,
        periodType: 'day',
        executionCount: Math.floor(Math.random() * 20) + 5,
        successCount: Math.floor(Math.random() * 15) + 5,
        errorCount: Math.floor(Math.random() * 3),
        timeoutCount: Math.floor(Math.random() * 2),
        totalDurationMs: Math.floor(Math.random() * 50000) + 10000,
        totalOutputSize: Math.floor(Math.random() * 100000)
      })
    }
  }

  // Create some error patterns
  const errorTypes = ['VALIDATION_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'NOT_FOUND']
  for (const tool of tools) {
    for (const errorType of errorTypes) {
      if (Math.random() > 0.5) {
        await mcpErrorPatternsRepository.recordPattern(
          projectId,
          tool,
          errorType,
          `${errorType}: Sample error message for ${tool}`
        )
      }
    }
  }

  console.log('MCP analytics data seeded successfully!')

  // Query and display summary
  const { executions, total } = await mcpExecutionRepository.queryExecutions({
    projectId,
    limit: 5
  })

  console.log(`\nTotal executions: ${total}`)
  console.log('Recent executions:')
  for (const exec of executions) {
    console.log(`  - ${exec.toolName}: ${exec.status} (${exec.durationMs}ms)`)
  }

  const topTools = await mcpStatisticsRepository.getToolSummaries(projectId, 5)
  console.log('\nTop tools:')
  for (const tool of topTools) {
    console.log(
      `  - ${tool.toolName}: ${tool.totalExecutions} executions, ${Math.round(tool.successRate * 100)}% success rate`
    )
  }

  const errorPatterns = await mcpErrorPatternsRepository.getTopPatterns(projectId, 5)
  console.log('\nTop error patterns:')
  for (const pattern of errorPatterns) {
    console.log(`  - ${pattern.toolName}: ${pattern.errorType} (${pattern.occurrenceCount} occurrences)`)
  }
}

seedMCPData().catch(console.error)
