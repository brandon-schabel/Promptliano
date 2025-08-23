/**
 * MCP Server Repository - Drizzle-based repository for MCP server configurations
 */

import { eq, and } from 'drizzle-orm'
import { createBaseRepository } from './base-repository'
import { mcpServerConfigs, type McpServerConfig, type InsertMcpServerConfig } from '../schema'
import { db } from '../db'

export const mcpServerRepository = createBaseRepository(mcpServerConfigs, {
  /**
   * Get all MCP server configurations for a specific project
   */
  async getByProject(projectId: number): Promise<McpServerConfig[]> {
    return await db.select().from(mcpServerConfigs).where(eq(mcpServerConfigs.projectId, projectId))
  },

  /**
   * Get enabled MCP servers for a project
   */
  async getEnabledByProject(projectId: number): Promise<McpServerConfig[]> {
    return await db.select()
      .from(mcpServerConfigs)
      .where(and(
        eq(mcpServerConfigs.projectId, projectId),
        eq(mcpServerConfigs.enabled, true)
      ))
  },

  /**
   * Get auto-start servers for a project
   */
  async getAutoStartByProject(projectId: number): Promise<McpServerConfig[]> {
    return await db.select()
      .from(mcpServerConfigs)
      .where(and(
        eq(mcpServerConfigs.projectId, projectId),
        eq(mcpServerConfigs.enabled, true),
        eq(mcpServerConfigs.autoStart, true)
      ))
  },

  /**
   * Update server state (typically called by MCP client manager)
   */
  async updateState(serverId: number, state: {
    status?: string
    pid?: number | null
    error?: string | null
    startedAt?: number | null
    lastHeartbeat?: number | null
  }): Promise<McpServerConfig> {
    const updateData: Partial<InsertMcpServerConfig> = {
      updatedAt: Date.now()
    }

    // Map state fields to database fields if they exist in the schema
    // Note: The current schema doesn't have status/pid/error fields
    // This method is prepared for future schema additions
    
    const [updated] = await db.update(mcpServerConfigs)
      .set(updateData)
      .where(eq(mcpServerConfigs.id, serverId))
      .returning()
    
    if (!updated) {
      throw new Error(`Failed to update MCP server state for ID ${serverId}`)
    }
    
    return updated
  },

  /**
   * Delete all MCP server configs for a project (cascade cleanup)
   */
  async deleteByProject(projectId: number): Promise<number> {
    const result = await db.delete(mcpServerConfigs)
      .where(eq(mcpServerConfigs.projectId, projectId))
    
    return result.rowsAffected || 0
  }
})

export type MCPServerRepository = typeof mcpServerRepository