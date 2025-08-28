/**
 * MCP Server Repository - Drizzle-based repository for MCP server configurations
 */

import { eq, and } from 'drizzle-orm'
import { createBaseRepository, extendRepository } from './base-repository'
import { mcpServerConfigs, type McpServerConfig, type InsertMcpServerConfig } from '../schema'
import { db } from '../db'

// Create base repository with proper schema
const baseMcpServerRepository = createBaseRepository(
  mcpServerConfigs,
  undefined, // db instance
  undefined, // Will use default validation
  'McpServerConfig'
)

// Extend with domain-specific methods
export const mcpServerRepository = extendRepository(baseMcpServerRepository, {
  /**
   * Get all MCP server configurations for a specific project
   */
  async getByProject(projectId: number): Promise<McpServerConfig[]> {
    const results = await db.select().from(mcpServerConfigs).where(eq(mcpServerConfigs.projectId, projectId))
    return results as McpServerConfig[]
  },

  /**
   * Get enabled MCP servers for a project
   */
  async getEnabledByProject(projectId: number): Promise<McpServerConfig[]> {
    const results = await db
      .select()
      .from(mcpServerConfigs)
      .where(and(eq(mcpServerConfigs.projectId, projectId), eq(mcpServerConfigs.enabled, true)))
    return results as McpServerConfig[]
  },

  /**
   * Get auto-start servers for a project
   */
  async getAutoStartByProject(projectId: number): Promise<McpServerConfig[]> {
    const results = await db
      .select()
      .from(mcpServerConfigs)
      .where(
        and(
          eq(mcpServerConfigs.projectId, projectId),
          eq(mcpServerConfigs.enabled, true),
          eq(mcpServerConfigs.autoStart, true)
        )
      )
    return results as McpServerConfig[]
  },

  /**
   * Update server state (typically called by MCP client manager)
   */
  async updateState(
    serverId: number,
    state: {
      status?: string
      pid?: number | null
      error?: string | null
      startedAt?: number | null
      lastHeartbeat?: number | null
    }
  ): Promise<McpServerConfig> {
    const updateData: Partial<InsertMcpServerConfig> = {
      updatedAt: Date.now()
    }

    // Map state fields to database fields if they exist in the schema
    // Note: The current schema doesn't have status/pid/error fields
    // This method is prepared for future schema additions

    const [updated] = await db
      .update(mcpServerConfigs)
      .set(updateData)
      .where(eq(mcpServerConfigs.id, serverId))
      .returning()

    if (!updated) {
      throw new Error(`Failed to update MCP server state for ID ${serverId}`)
    }

    return updated as McpServerConfig
  },

  /**
   * Delete all MCP server configs for a project (cascade cleanup)
   */
  async deleteByProject(projectId: number): Promise<number> {
    const result = (await db
      .delete(mcpServerConfigs)
      .where(eq(mcpServerConfigs.projectId, projectId))
      .run()) as unknown as { changes: number }

    return result.changes || 0
  }
})

export type MCPServerRepository = typeof mcpServerRepository
