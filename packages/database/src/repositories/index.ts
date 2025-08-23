/**
 * Repository Layer - Clean abstraction over Drizzle ORM
 * Replaces 2,400+ lines of storage classes with ~200 lines total
 */

// Core repositories
export * from './base-repository'
export * from './project-repository'
export * from './ticket-repository'
export * from './task-repository'
export * from './chat-repository'
export * from './prompt-repository'
export * from './queue-repository'

// Unified storage service
export * from './storage-service'

// Legacy repositories (to be implemented)
// export * from './file-repository'
// export * from './claude-repository'