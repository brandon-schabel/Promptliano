import {
  HookApiResponseSchema,
  HookListResponseSchema,
  CreateHookRequestSchema,
  UpdateHookRequestSchema,
  HookGenerationRequestSchema,
  HookGenerationResponseSchema,
  HookTestRequestSchema,
  HookTestResponseSchema,
  HookEventSchema
} from '@promptliano/schemas'
import { z } from 'zod'
import { BaseApiClient } from '../base-client'

/**
 * Claude Hooks API Client
 * 
 * Provides methods for managing Claude Code hooks including CRUD operations,
 * hook generation from natural language, testing, and searching.
 */
export class ClaudeHooksClient extends BaseApiClient {
  /**
   * List all hooks for a project
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @returns List of hooks in the project
   */
  async list(projectPath: string) {
    const encodedPath = encodeURIComponent(projectPath)
    const result = await this.request('GET', `/api/claude-hooks/${encodedPath}`, {
      responseSchema: HookListResponseSchema
    })
    return result as z.infer<typeof HookListResponseSchema>
  }

  /**
   * Get a specific hook
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param eventName - The hook event name
   * @param matcherIndex - Index of the matcher group
   * @returns The specific hook configuration
   */
  async getHook(projectPath: string, eventName: z.infer<typeof HookEventSchema>, matcherIndex: number) {
    const encodedPath = encodeURIComponent(projectPath)
    const result = await this.request('GET', `/api/claude-hooks/${encodedPath}/${eventName}/${matcherIndex}`, {
      responseSchema: HookApiResponseSchema
    })
    return result as z.infer<typeof HookApiResponseSchema>
  }

  /**
   * Create a new hook
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param data - Hook creation data
   * @returns The created hook configuration
   */
  async create(projectPath: string, data: z.infer<typeof CreateHookRequestSchema>) {
    const encodedPath = encodeURIComponent(projectPath)
    const validatedData = this.validateBody(CreateHookRequestSchema, data)
    const result = await this.request('POST', `/api/claude-hooks/${encodedPath}`, {
      body: validatedData,
      responseSchema: HookApiResponseSchema
    })
    return result as z.infer<typeof HookApiResponseSchema>
  }

  /**
   * Update an existing hook
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param eventName - The hook event name
   * @param matcherIndex - Index of the matcher group
   * @param data - Hook update data
   * @returns The updated hook configuration
   */
  async update(
    projectPath: string,
    eventName: z.infer<typeof HookEventSchema>,
    matcherIndex: number,
    data: z.infer<typeof UpdateHookRequestSchema>
  ) {
    const encodedPath = encodeURIComponent(projectPath)
    const validatedData = this.validateBody(UpdateHookRequestSchema, data)
    const result = await this.request('PUT', `/api/claude-hooks/${encodedPath}/${eventName}/${matcherIndex}`, {
      body: validatedData,
      responseSchema: HookApiResponseSchema
    })
    return result as z.infer<typeof HookApiResponseSchema>
  }

  /**
   * Delete a hook
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param eventName - The hook event name
   * @param matcherIndex - Index of the matcher group
   * @returns Success confirmation
   */
  async deleteHook(projectPath: string, eventName: z.infer<typeof HookEventSchema>, matcherIndex: number) {
    const encodedPath = encodeURIComponent(projectPath)
    await this.request('DELETE', `/api/claude-hooks/${encodedPath}/${eventName}/${matcherIndex}`)
    return true
  }

  /**
   * Generate a hook from natural language description
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param data - Hook generation request with natural language prompt
   * @returns Generated hook configuration
   */
  async generate(projectPath: string, data: z.infer<typeof HookGenerationRequestSchema>) {
    const encodedPath = encodeURIComponent(projectPath)
    const validatedData = this.validateBody(HookGenerationRequestSchema, data)
    const result = await this.request('POST', `/api/claude-hooks/${encodedPath}/generate`, {
      body: validatedData,
      responseSchema: HookGenerationResponseSchema
    })
    return result as z.infer<typeof HookGenerationResponseSchema>
  }

  /**
   * Test a hook configuration
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param data - Hook test request with configuration and test inputs
   * @returns Test execution results
   */
  async test(projectPath: string, data: z.infer<typeof HookTestRequestSchema>) {
    const encodedPath = encodeURIComponent(projectPath)
    const validatedData = this.validateBody(HookTestRequestSchema, data)
    const result = await this.request('POST', `/api/claude-hooks/${encodedPath}/test`, {
      body: validatedData,
      responseSchema: HookTestResponseSchema
    })
    return result as z.infer<typeof HookTestResponseSchema>
  }

  /**
   * Search hooks by query
   * 
   * @param projectPath - The project directory path (URL encoded)
   * @param query - Search query string
   * @returns Filtered list of hooks matching the query
   */
  async search(projectPath: string, query: string) {
    const encodedPath = encodeURIComponent(projectPath)
    const result = await this.request('GET', `/api/claude-hooks/${encodedPath}/search`, {
      params: { q: query },
      responseSchema: HookListResponseSchema
    })
    return result as z.infer<typeof HookListResponseSchema>
  }
}