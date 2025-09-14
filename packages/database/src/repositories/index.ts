/**
 * Repository Layer - Clean abstraction over Drizzle ORM
 * Replaces 2,400+ lines of storage classes with ~200 lines total
 */

// Core repositories
export * from './base-repository'
export * from './project-repository'
export * from './ticket-repository' // Also exports taskRepository
export * from './chat-repository' // Also exports messageRepository
export * from './prompt-repository'
export * from './queue-repository' // Also exports queueItemRepository
export * from './file-repository'

// Configuration and state repositories
export * from './provider-key-repository'
export * from './model-config-repository'
export * from './model-preset-repository'
export * from './app-state-repository' // Exports selectedFileRepository
export * from './mcp-server-repository'
export * from './mcp-execution-repository' // Exports MCP tracking repositories

// Process management repositories
export * from './process-repository'

// Unified storage service (for backward compatibility)
export * from './storage-service'
