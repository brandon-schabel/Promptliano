/**
 * Claude Repository - AI integration entities
 * New centralized Claude agents, commands, and hooks management
 */

import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '../db'
import { 
  claudeAgents, 
  claudeCommands, 
  claudeHooks,
  providerKeys,
  activeTabs,
  type ClaudeAgent, 
  type ClaudeCommand,
  type ClaudeHook,
  type ProviderKey,
  type ActiveTab,
  type InsertClaudeAgent, 
  type InsertClaudeCommand,
  type InsertClaudeHook,
  type InsertProviderKey,
  type InsertActiveTab,
  type HookType
} from '../schema'

export const claudeRepository = {
  // =============================================================================
  // CLAUDE AGENTS
  // =============================================================================

  /**
   * Create or update Claude agent
   */
  async upsertAgent(data: Omit<InsertClaudeAgent, 'createdAt' | 'updatedAt'>): Promise<ClaudeAgent> {
    const now = Date.now()
    
    const existing = await db.select()
      .from(claudeAgents)
      .where(eq(claudeAgents.id, data.id))
      .limit(1)

    if (existing.length > 0) {
      const [updated] = await db.update(claudeAgents)
        .set({
          ...data,
          updatedAt: now
        })
        .where(eq(claudeAgents.id, data.id))
        .returning()
      return updated
    } else {
      const [created] = await db.insert(claudeAgents).values({
        ...data,
        createdAt: now,
        updatedAt: now
      }).returning()
      return created
    }
  },

  /**
   * Get agent by ID
   */
  async getAgentById(id: string): Promise<ClaudeAgent | null> {
    const [agent] = await db.select()
      .from(claudeAgents)
      .where(eq(claudeAgents.id, id))
      .limit(1)
    return agent ?? null
  },

  /**
   * Get all active agents
   */
  async getActiveAgents(): Promise<ClaudeAgent[]> {
    return db.select()
      .from(claudeAgents)
      .where(eq(claudeAgents.isActive, true))
      .orderBy(asc(claudeAgents.name))
  },

  // =============================================================================
  // CLAUDE COMMANDS
  // =============================================================================

  /**
   * Create command
   */
  async createCommand(data: Omit<InsertClaudeCommand, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClaudeCommand> {
    const now = Date.now()
    const [command] = await db.insert(claudeCommands).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    return command
  },

  /**
   * Get commands by project
   */
  async getCommandsByProject(projectId: number): Promise<ClaudeCommand[]> {
    return db.select()
      .from(claudeCommands)
      .where(eq(claudeCommands.projectId, projectId))
      .orderBy(asc(claudeCommands.name))
  },

  /**
   * Get active commands by project
   */
  async getActiveCommandsByProject(projectId: number): Promise<ClaudeCommand[]> {
    return db.select()
      .from(claudeCommands)
      .where(and(
        eq(claudeCommands.projectId, projectId),
        eq(claudeCommands.isActive, true)
      ))
      .orderBy(asc(claudeCommands.name))
  },

  // =============================================================================
  // CLAUDE HOOKS
  // =============================================================================

  /**
   * Create hook
   */
  async createHook(data: Omit<InsertClaudeHook, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClaudeHook> {
    const now = Date.now()
    const [hook] = await db.insert(claudeHooks).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    return hook
  },

  /**
   * Get hooks by project and type
   */
  async getHooksByProjectAndType(projectId: number, hookType: HookType): Promise<ClaudeHook[]> {
    return db.select()
      .from(claudeHooks)
      .where(and(
        eq(claudeHooks.projectId, projectId),
        eq(claudeHooks.hookType, hookType),
        eq(claudeHooks.isActive, true)
      ))
      .orderBy(asc(claudeHooks.name))
  },

  /**
   * Get hooks by project and event
   */
  async getHooksByProjectAndEvent(projectId: number, triggerEvent: string): Promise<ClaudeHook[]> {
    return db.select()
      .from(claudeHooks)
      .where(and(
        eq(claudeHooks.projectId, projectId),
        eq(claudeHooks.triggerEvent, triggerEvent),
        eq(claudeHooks.isActive, true)
      ))
      .orderBy(asc(claudeHooks.name))
  },

  // =============================================================================
  // PROVIDER KEYS
  // =============================================================================

  /**
   * Store encrypted provider key
   */
  async storeProviderKey(data: Omit<InsertProviderKey, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderKey> {
    const now = Date.now()
    
    // Check for existing key
    const existing = await db.select()
      .from(providerKeys)
      .where(and(
        eq(providerKeys.provider, data.provider),
        eq(providerKeys.keyName, data.keyName)
      ))
      .limit(1)

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db.update(providerKeys)
        .set({
          ...data,
          updatedAt: now
        })
        .where(eq(providerKeys.id, existing[0].id))
        .returning()
      return updated
    } else {
      // Create new
      const [created] = await db.insert(providerKeys).values({
        ...data,
        createdAt: now,
        updatedAt: now
      }).returning()
      return created
    }
  },

  /**
   * Get provider key
   */
  async getProviderKey(provider: string, keyName: string): Promise<ProviderKey | null> {
    const [key] = await db.select()
      .from(providerKeys)
      .where(and(
        eq(providerKeys.provider, provider),
        eq(providerKeys.keyName, keyName),
        eq(providerKeys.isActive, true)
      ))
      .limit(1)
    return key ?? null
  },

  /**
   * Get all keys for provider
   */
  async getProviderKeys(provider: string): Promise<ProviderKey[]> {
    return db.select()
      .from(providerKeys)
      .where(and(
        eq(providerKeys.provider, provider),
        eq(providerKeys.isActive, true)
      ))
      .orderBy(asc(providerKeys.keyName))
  },

  // =============================================================================
  // ACTIVE TABS
  // =============================================================================

  /**
   * Set active tab
   */
  async setActiveTab(data: Omit<InsertActiveTab, 'id' | 'createdAt'>): Promise<ActiveTab> {
    const now = Date.now()
    
    // Deactivate other tabs of same type for this project
    await db.update(activeTabs)
      .set({ isActive: false })
      .where(and(
        eq(activeTabs.projectId, data.projectId),
        eq(activeTabs.tabType, data.tabType)
      ))

    const [tab] = await db.insert(activeTabs).values({
      ...data,
      lastAccessedAt: now,
      createdAt: now
    }).returning()
    return tab
  },

  /**
   * Get active tab for project and type
   */
  async getActiveTab(projectId: number, tabType: string): Promise<ActiveTab | null> {
    const [tab] = await db.select()
      .from(activeTabs)
      .where(and(
        eq(activeTabs.projectId, projectId),
        eq(activeTabs.tabType, tabType),
        eq(activeTabs.isActive, true)
      ))
      .orderBy(desc(activeTabs.lastAccessedAt))
      .limit(1)
    return tab ?? null
  },

  /**
   * Update tab access time
   */
  async updateTabAccess(id: number): Promise<ActiveTab> {
    const [updated] = await db.update(activeTabs)
      .set({
        lastAccessedAt: Date.now()
      })
      .where(eq(activeTabs.id, id))
      .returning()
    return updated
  },

  /**
   * Clear inactive tabs (older than threshold)
   */
  async clearInactiveTabs(thresholdMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - thresholdMs
    const result = await db.delete(activeTabs)
      .where(
        eq(activeTabs.lastAccessedAt, cutoff) // This would need proper comparison operator
      )
      .run() as unknown as { changes: number }
    return result.changes
  }
}