import {
  ClaudeSessionsResponseSchema,
  ClaudeMessagesResponseSchema,
  ClaudeProjectDataResponseSchema,
  ClaudeSessionQuerySchema,
  ClaudeMessageQuerySchema,
  ClaudeSessionCursorSchema,
  ClaudeSessionsPaginatedResponseSchema,
  ClaudeSessionsMetadataResponseSchema,
  ChatResponseSchema
} from '@promptliano/schemas'
import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { DataResponseSchema } from '../types'

/**
 * Claude Code API Client
 * 
 * Provides methods for interacting with Claude Code functionality including
 * MCP status checking, session management, message retrieval, and session imports.
 */
export class ClaudeCodeClient extends BaseApiClient {
  /**
   * Get MCP (Model Context Protocol) installation status for a project
   * 
   * @param projectId - The project ID to check MCP status for
   * @returns MCP installation and configuration status
   */
  async getMCPStatus(projectId: number) {
    const result = await this.request('GET', `/claude-code/mcp-status/${projectId}`)
    return result as DataResponseSchema<{
      claudeDesktop: {
        installed: boolean
        configExists: boolean
        hasPromptliano: boolean
        configPath?: string
        error?: string
      }
      claudeCode: {
        globalConfigExists: boolean
        globalHasPromptliano: boolean
        globalConfigPath?: string
        projectConfigExists: boolean
        projectHasPromptliano: boolean
        projectConfigPath?: string
        localConfigExists: boolean
        localHasPromptliano: boolean
        localConfigPath?: string
        error?: string
      }
      projectId: string
      installCommand: string
    }>
  }

  /**
   * Get Claude Code sessions for a project
   * 
   * @param projectId - The project ID to get sessions for
   * @param query - Optional query parameters for filtering sessions
   * @returns List of Claude Code sessions
   */
  async getSessions(
    projectId: number,
    query?: z.infer<typeof ClaudeSessionQuerySchema>
  ) {
    const result = await this.request('GET', `/claude-code/sessions/${projectId}`, {
      params: query,
      responseSchema: ClaudeSessionsResponseSchema
    })
    return result as z.infer<typeof ClaudeSessionsResponseSchema>
  }

  /**
   * Get messages for a specific Claude Code session
   * 
   * @param projectId - The project ID
   * @param sessionId - The session ID to get messages for
   * @param query - Optional query parameters for filtering messages
   * @returns List of messages in the session
   */
  async getSessionMessages(
    projectId: number,
    sessionId: string,
    query?: z.infer<typeof ClaudeMessageQuerySchema>
  ) {
    const result = await this.request('GET', `/claude-code/sessions/${projectId}/${sessionId}/messages`, {
      params: query,
      responseSchema: ClaudeMessagesResponseSchema
    })
    return result as z.infer<typeof ClaudeMessagesResponseSchema>
  }

  /**
   * Get project data for Claude Code integration
   * 
   * @param projectId - The project ID to get data for
   * @returns Project metadata and configuration
   */
  async getProjectData(projectId: number) {
    const result = await this.request('GET', `/claude-code/project-data/${projectId}`, {
      responseSchema: ClaudeProjectDataResponseSchema
    })
    return result as z.infer<typeof ClaudeProjectDataResponseSchema>
  }

  /**
   * Import a Claude Code session into the project
   * 
   * @param projectId - The project ID to import into
   * @param sessionId - The session ID to import
   * @returns The created chat from the imported session
   */
  async importSession(projectId: number, sessionId: string) {
    const result = await this.request('POST', `/claude-code/sessions/${projectId}/${sessionId}/import`, {
      responseSchema: ChatResponseSchema
    })
    return result as z.infer<typeof ChatResponseSchema>
  }

  /**
   * Get Claude Code sessions metadata for a project (lightweight, fast loading)
   * 
   * @param projectId - The project ID to get session metadata for
   * @param query - Optional cursor-based query parameters for pagination and filtering
   * @returns List of Claude Code session metadata with optional pagination
   */
  async getSessionsMetadata(
    projectId: number,
    query?: z.infer<typeof ClaudeSessionCursorSchema>
  ) {
    const result = await this.request('GET', `/claude-code/sessions/${projectId}/metadata`, {
      params: query,
      responseSchema: ClaudeSessionsMetadataResponseSchema
    })
    return result as z.infer<typeof ClaudeSessionsMetadataResponseSchema>
  }

  /**
   * Get Claude Code sessions with cursor-based pagination (optimized for large datasets)
   * 
   * @param projectId - The project ID to get sessions for
   * @param query - Optional cursor-based query parameters for pagination and filtering
   * @returns Paginated list of Claude Code sessions with cursor information
   */
  async getSessionsPaginated(
    projectId: number,
    query?: z.infer<typeof ClaudeSessionCursorSchema>
  ) {
    const result = await this.request('GET', `/claude-code/sessions/${projectId}/paginated`, {
      params: query,
      responseSchema: ClaudeSessionsPaginatedResponseSchema
    })
    return result as z.infer<typeof ClaudeSessionsPaginatedResponseSchema>
  }

  /**
   * Get recent Claude Code sessions for a project (last 10 sessions, optimized for quick access)
   * 
   * @param projectId - The project ID to get recent sessions for
   * @returns List of the 10 most recently updated Claude Code sessions
   */
  async getRecentSessions(projectId: number) {
    const result = await this.request('GET', `/claude-code/sessions/${projectId}/recent`, {
      responseSchema: ClaudeSessionsPaginatedResponseSchema
    })
    return result as z.infer<typeof ClaudeSessionsPaginatedResponseSchema>
  }

  /**
   * Get Claude Code sessions with enhanced cursor support (backward compatible)
   * 
   * This method enhances the original getSessions method with optional cursor-based pagination
   * while maintaining full backward compatibility with existing offset-based queries.
   * 
   * @param projectId - The project ID to get sessions for
   * @param query - Query parameters supporting both offset-based and cursor-based pagination
   * @returns List of Claude Code sessions (supports both response formats)
   */
  async getSessionsWithCursor(
    projectId: number,
    query?: z.infer<typeof ClaudeSessionQuerySchema> | z.infer<typeof ClaudeSessionCursorSchema>
  ) {
    // Determine if this is a cursor-based query or offset-based query
    const isCursorQuery = query && 'cursor' in query && query.cursor !== undefined
    
    if (isCursorQuery) {
      // Use cursor-based pagination endpoint
      const result = await this.request('GET', `/claude-code/sessions/${projectId}/paginated`, {
        params: query,
        responseSchema: ClaudeSessionsPaginatedResponseSchema
      })
      return result as z.infer<typeof ClaudeSessionsPaginatedResponseSchema>
    } else {
      // Use traditional offset-based pagination endpoint
      const result = await this.request('GET', `/claude-code/sessions/${projectId}`, {
        params: query,
        responseSchema: ClaudeSessionsResponseSchema
      })
      return result as z.infer<typeof ClaudeSessionsResponseSchema>
    }
  }

  /**
   * Get complete Claude Code session with full message data
   * 
   * Use this method when you need detailed session information including all messages,
   * token usage, and cost data. For list views, prefer getRecentSessions or getSessionsMetadata.
   * 
   * @param projectId - The project ID
   * @param sessionId - The session ID to get complete data for
   * @returns Complete session data including all messages and token usage
   */
  async getFullSession(
    projectId: number,
    sessionId: string
  ) {
    const result = await this.request('GET', `/claude-code/sessions/${projectId}/${sessionId}/full`, {
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          sessionId: z.string(),
          projectPath: z.string(),
          startTime: z.string(),
          lastUpdate: z.string(),
          messageCount: z.number(),
          gitBranch: z.string().optional(),
          cwd: z.string().optional(),
          tokenUsage: z.object({
            totalInputTokens: z.number(),
            totalCacheCreationTokens: z.number(),
            totalCacheReadTokens: z.number(),
            totalOutputTokens: z.number(),
            totalTokens: z.number()
          }).optional(),
          serviceTiers: z.array(z.string()).optional(),
          totalTokensUsed: z.number().optional(),
          totalCostUsd: z.number().optional()
        }).nullable()
      })
    })
    return result
  }
}