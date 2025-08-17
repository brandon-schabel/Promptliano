import {
  ClaudeCommandResponseSchema,
  ClaudeCommandListResponseSchema,
  CreateClaudeCommandBodySchema,
  UpdateClaudeCommandBodySchema,
  ExecuteClaudeCommandBodySchema,
  CommandSuggestionsResponseSchema,
  CommandExecutionResponseSchema,
  SearchCommandsQuerySchema,
  CommandGenerationRequestSchema,
  CommandGenerationResponseSchema
} from '@promptliano/schemas'
import { z } from 'zod'
import { BaseApiClient } from '../base-client'

/**
 * Claude Commands API Client
 * 
 * Provides methods for managing Claude commands including CRUD operations,
 * command execution, generation, and suggestions. All commands are project-scoped.
 */
export class ClaudeCommandsClient extends BaseApiClient {
  /**
   * List commands for a project
   * 
   * @param projectId - The project ID
   * @param query - Optional search parameters
   * @returns List of commands for the project
   */
  async listCommands(projectId: number, query?: z.infer<typeof SearchCommandsQuerySchema>) {
    const result = await this.request('GET', `/projects/${projectId}/commands`, {
      params: query,
      responseSchema: ClaudeCommandListResponseSchema
    })
    return result as z.infer<typeof ClaudeCommandListResponseSchema>
  }

  /**
   * Create a new command
   * 
   * @param projectId - The project ID
   * @param data - Command creation data
   * @returns The created command
   */
  async createCommand(projectId: number, data: z.infer<typeof CreateClaudeCommandBodySchema>) {
    const validatedData = this.validateBody(CreateClaudeCommandBodySchema, data)
    const result = await this.request('POST', `/projects/${projectId}/commands`, {
      body: validatedData,
      responseSchema: ClaudeCommandResponseSchema
    })
    return result as z.infer<typeof ClaudeCommandResponseSchema>
  }

  /**
   * Get a specific command
   * 
   * @param projectId - The project ID
   * @param commandName - The command name
   * @param namespace - Optional namespace
   * @returns The command details
   */
  async getCommand(projectId: number, commandName: string, namespace?: string) {
    const path = namespace 
      ? `/projects/${projectId}/commands/${commandName}?namespace=${encodeURIComponent(namespace)}`
      : `/projects/${projectId}/commands/${commandName}`
    
    const result = await this.request('GET', path, {
      responseSchema: ClaudeCommandResponseSchema
    })
    return result as z.infer<typeof ClaudeCommandResponseSchema>
  }

  /**
   * Update an existing command
   * 
   * @param projectId - The project ID
   * @param commandName - The command name to update
   * @param data - Command update data
   * @param namespace - Optional namespace
   * @returns The updated command
   */
  async updateCommand(
    projectId: number, 
    commandName: string, 
    data: z.infer<typeof UpdateClaudeCommandBodySchema>,
    namespace?: string
  ) {
    const validatedData = this.validateBody(UpdateClaudeCommandBodySchema, data)
    const path = namespace 
      ? `/projects/${projectId}/commands/${commandName}?namespace=${encodeURIComponent(namespace)}`
      : `/projects/${projectId}/commands/${commandName}`
    
    const result = await this.request('PUT', path, {
      body: validatedData,
      responseSchema: ClaudeCommandResponseSchema
    })
    return result as z.infer<typeof ClaudeCommandResponseSchema>
  }

  /**
   * Delete a command
   * 
   * @param projectId - The project ID
   * @param commandName - The command name to delete
   * @param namespace - Optional namespace
   * @returns Success confirmation
   */
  async deleteCommand(projectId: number, commandName: string, namespace?: string): Promise<boolean> {
    const path = namespace 
      ? `/projects/${projectId}/commands/${commandName}?namespace=${encodeURIComponent(namespace)}`
      : `/projects/${projectId}/commands/${commandName}`
    
    await this.request('DELETE', path)
    return true
  }

  /**
   * Execute a command
   * 
   * @param projectId - The project ID
   * @param commandName - The command name to execute
   * @param data - Command execution data
   * @param namespace - Optional namespace
   * @returns The execution result
   */
  async executeCommand(
    projectId: number, 
    commandName: string, 
    data: z.infer<typeof ExecuteClaudeCommandBodySchema>,
    namespace?: string
  ) {
    const validatedData = this.validateBody(ExecuteClaudeCommandBodySchema, data)
    const path = namespace 
      ? `/projects/${projectId}/commands/${commandName}/execute?namespace=${encodeURIComponent(namespace)}`
      : `/projects/${projectId}/commands/${commandName}/execute`
    
    const result = await this.request('POST', path, {
      body: validatedData,
      responseSchema: CommandExecutionResponseSchema
    })
    return result as z.infer<typeof CommandExecutionResponseSchema>
  }

  /**
   * Generate a command from natural language description
   * 
   * @param projectId - The project ID
   * @param data - Command generation request
   * @returns Generated command configuration
   */
  async generateCommand(projectId: number, data: z.infer<typeof CommandGenerationRequestSchema>) {
    const validatedData = this.validateBody(CommandGenerationRequestSchema, data)
    const result = await this.request('POST', `/projects/${projectId}/commands/generate`, {
      body: validatedData,
      responseSchema: CommandGenerationResponseSchema
    })
    return result as z.infer<typeof CommandGenerationResponseSchema>
  }

  /**
   * Get command suggestions for a project
   * 
   * @param projectId - The project ID
   * @param query - Optional query string for suggestions
   * @returns Command suggestions
   */
  async suggestCommands(projectId: number, query?: string) {
    const params = query ? { q: query } : undefined
    const result = await this.request('POST', `/projects/${projectId}/commands/suggest`, {
      params,
      responseSchema: CommandSuggestionsResponseSchema
    })
    return result as z.infer<typeof CommandSuggestionsResponseSchema>
  }
}