import {
  ClaudeAgentResponseSchema,
  ClaudeAgentListResponseSchema,
  CreateClaudeAgentBodySchema,
  UpdateClaudeAgentBodySchema,
  SuggestAgentsRequestSchema,
  AgentSuggestionsResponseSchema
} from '@promptliano/schemas'
import { z } from 'zod'
import { BaseApiClient } from '../base-client'

/**
 * Claude Agents API Client
 * 
 * Provides methods for managing Claude agents including CRUD operations,
 * project-specific agent management, and agent suggestions.
 */
export class ClaudeAgentsClient extends BaseApiClient {
  /**
   * List all agents
   * 
   * @param projectId - Optional project ID to filter agents
   * @returns List of all agents
   */
  async listAgents(projectId?: number) {
    const params = projectId ? { projectId } : undefined
    const result = await this.request('GET', '/agents', {
      params,
      responseSchema: ClaudeAgentListResponseSchema
    })
    return result as z.infer<typeof ClaudeAgentListResponseSchema>
  }

  /**
   * Create a new agent
   * 
   * @param data - Agent creation data
   * @param projectId - Optional project ID to associate with
   * @returns The created agent
   */
  async createAgent(data: z.infer<typeof CreateClaudeAgentBodySchema>, projectId?: number) {
    const params = projectId ? { projectId } : undefined
    const validatedData = this.validateBody(CreateClaudeAgentBodySchema, data)
    const result = await this.request('POST', '/agents', {
      params,
      body: validatedData,
      responseSchema: ClaudeAgentResponseSchema
    })
    return result as z.infer<typeof ClaudeAgentResponseSchema>
  }

  /**
   * Get a specific agent by ID
   * 
   * @param agentId - The agent ID
   * @returns The agent details
   */
  async getAgent(agentId: string) {
    const result = await this.request('GET', `/agents/${agentId}`, {
      responseSchema: ClaudeAgentResponseSchema
    })
    return result as z.infer<typeof ClaudeAgentResponseSchema>
  }

  /**
   * Update an existing agent
   * 
   * @param agentId - The agent ID to update
   * @param data - Agent update data
   * @returns The updated agent
   */
  async updateAgent(agentId: string, data: z.infer<typeof UpdateClaudeAgentBodySchema>) {
    const validatedData = this.validateBody(UpdateClaudeAgentBodySchema, data)
    const result = await this.request('PUT', `/agents/${agentId}`, {
      body: validatedData,
      responseSchema: ClaudeAgentResponseSchema
    })
    return result as z.infer<typeof ClaudeAgentResponseSchema>
  }

  /**
   * Delete an agent
   * 
   * @param agentId - The agent ID to delete
   * @returns Success confirmation
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    await this.request('DELETE', `/agents/${agentId}`)
    return true
  }

  /**
   * Get agents for a specific project
   * 
   * @param projectId - The project ID
   * @returns List of agents for the project
   */
  async getProjectAgents(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/agents`, {
      responseSchema: ClaudeAgentListResponseSchema
    })
    return result as z.infer<typeof ClaudeAgentListResponseSchema>
  }

  /**
   * Suggest agents for a project
   * 
   * @param projectId - The project ID
   * @param data - Agent suggestion request data
   * @returns Agent suggestions
   */
  async suggestAgents(projectId: number, data: z.infer<typeof SuggestAgentsRequestSchema>) {
    const validatedData = this.validateBody(SuggestAgentsRequestSchema, data)
    const result = await this.request('POST', `/projects/${projectId}/suggest-agents`, {
      body: validatedData,
      responseSchema: AgentSuggestionsResponseSchema
    })
    return result as z.infer<typeof AgentSuggestionsResponseSchema>
  }
}