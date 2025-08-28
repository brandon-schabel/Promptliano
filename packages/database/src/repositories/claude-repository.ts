/**
 * Claude Repository - Manages Claude-specific entities
 * Replaces manual storage with BaseRepository for consistency
 */

import { eq, and } from 'drizzle-orm'
import { createBaseRepository, extendRepository } from './base-repository'
import { db } from '../db'
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

// Claude agents have string IDs and no projectId, so we'll use custom implementation
export const claudeAgentRepository = {
  async create(data: Omit<InsertClaudeAgent, 'createdAt' | 'updatedAt'>): Promise<ClaudeAgent> {
    const now = Date.now()
    const [agent] = await db
      .insert(claudeAgents)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now
      })
      .returning()

    if (!agent) {
      throw new Error('Failed to create Claude agent')
    }

    return agent
  },

  async getById(id: string): Promise<ClaudeAgent | null> {
    const [agent] = await db.select().from(claudeAgents).where(eq(claudeAgents.id, id)).limit(1)
    return agent ?? null
  },

  async getAll(): Promise<ClaudeAgent[]> {
    return db.select().from(claudeAgents)
  },

  async getByName(name: string): Promise<ClaudeAgent | null> {
    const [agent] = await db.select().from(claudeAgents).where(eq(claudeAgents.name, name)).limit(1)
    return agent ?? null
  },

  async update(id: string, data: Partial<Omit<InsertClaudeAgent, 'createdAt' | 'updatedAt'>>): Promise<ClaudeAgent> {
    const [updated] = await db
      .update(claudeAgents)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(claudeAgents.id, id))
      .returning()

    if (!updated) {
      throw new Error(`Failed to update Claude agent with id: ${id}`)
    }

    return updated
  },

  async delete(id: string): Promise<boolean> {
    const result = (await db.delete(claudeAgents).where(eq(claudeAgents.id, id)).run()) as unknown as {
      changes: number
    }
    return result.changes > 0
  }
}

const baseCommandRepository = createBaseRepository(claudeCommands, undefined, selectClaudeCommandSchema, 'ClaudeCommand')

const baseHookRepository = createBaseRepository(claudeHooks, undefined, selectClaudeHookSchema, 'ClaudeHook')

// Claude Commands Repository
export const claudeCommandRepository = extendRepository(baseCommandRepository, {
  /**
   * Get commands by project ID
   */
  async getByProject(projectId: number): Promise<ClaudeCommand[]> {
    const results = await baseCommandRepository.findWhere(eq(claudeCommands.projectId, projectId))
    // Cast to ensure proper type with JSON fields
    return results as ClaudeCommand[]
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
    return baseHookRepository.findWhere(and(eq(claudeHooks.projectId, projectId), eq(claudeHooks.triggerEvent, event)))
  }
})

// Export individual repositories for direct access
export const agentRepository = claudeAgentRepository
export const commandRepository = baseCommandRepository
export const hookRepository = baseHookRepository
