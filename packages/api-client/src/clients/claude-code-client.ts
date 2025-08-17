import {
  ClaudeSessionsResponseSchema,
  ClaudeMessagesResponseSchema,
  ClaudeProjectDataResponseSchema,
  ClaudeSessionQuerySchema,
  ClaudeMessageQuerySchema,
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
    const result = await this.request('GET', `/api/claude-code/mcp-status/${projectId}`)
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
    const result = await this.request('GET', `/api/claude-code/sessions/${projectId}`, {
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
    const result = await this.request('GET', `/api/claude-code/sessions/${projectId}/${sessionId}/messages`, {
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
    const result = await this.request('GET', `/api/claude-code/project-data/${projectId}`, {
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
    const result = await this.request('POST', `/api/claude-code/sessions/${projectId}/${sessionId}/import`, {
      responseSchema: ChatResponseSchema
    })
    return result as z.infer<typeof ChatResponseSchema>
  }
}