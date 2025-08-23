/**
 * Claude Repository - Manages Claude-specific entities
 * Replaces manual storage with BaseRepository for consistency
 */

import { eq, and } from 'drizzle-orm'
import { createBaseRepository, extendRepository } from './base-repository'
import { 
  claudeAgents,
  claudeCommands,
  claudeHooks,
  type ClaudeAgent,
  type ClaudeCommand,
  type ClaudeHook,
  type InsertClaudeAgent,
  type InsertClaudeCommand,
  type InsertClaudeHook,
  selectClaudeAgentSchema,
  selectClaudeCommandSchema,
  selectClaudeHookSchema
} from '../schema'

// Create base repositories for Claude entities
const baseAgentRepository = createBaseRepository(
  claudeAgents,
  selectClaudeAgentSchema,
  'ClaudeAgent'
)

const baseCommandRepository = createBaseRepository(
  claudeCommands,
  selectClaudeCommandSchema,
  'ClaudeCommand'
)

const baseHookRepository = createBaseRepository(
  claudeHooks,
  selectClaudeHookSchema,
  'ClaudeHook'
)

// Claude Agents Repository
export const claudeAgentRepository = extendRepository(baseAgentRepository, {
  /**
   * Get agents by project ID
   */
  async getByProject(projectId: number): Promise<ClaudeAgent[]> {
    return baseAgentRepository.findWhere(eq(claudeAgents.projectId, projectId))
  },

  /**
   * Get agent by name
   */
  async getByName(projectId: number, name: string): Promise<ClaudeAgent | null> {
    return baseAgentRepository.findOneWhere(and(
      eq(claudeAgents.projectId, projectId),
      eq(claudeAgents.name, name)
    ))
  }
})

// Claude Commands Repository  
export const claudeCommandRepository = extendRepository(baseCommandRepository, {
  /**
   * Get commands by project ID
   */
  async getByProject(projectId: number): Promise<ClaudeCommand[]> {
    return baseCommandRepository.findWhere(eq(claudeCommands.projectId, projectId))
  }
})

// Claude Hooks Repository
export const claudeHookRepository = extendRepository(baseHookRepository, {
  /**
   * Get hooks by project ID
   */
  async getByProject(projectId: number): Promise<ClaudeHook[]> {
    return baseHookRepository.findWhere(eq(claudeHooks.projectId, projectId))
  },

  /**
   * Get hooks by event type
   */
  async getByEvent(projectId: number, event: string): Promise<ClaudeHook[]> {
    return baseHookRepository.findWhere(and(
      eq(claudeHooks.projectId, projectId),
      eq(claudeHooks.event, event)
    ))
  }
})

// Export individual repositories for direct access
export const agentRepository = baseAgentRepository
export const commandRepository = baseCommandRepository  
export const hookRepository = baseHookRepository