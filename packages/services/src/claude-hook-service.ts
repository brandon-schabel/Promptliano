import { claudeHookRepository } from '@promptliano/database'
import {
  type ClaudeHook,
  type InsertClaudeHook as CreateClaudeHookBody,
  type InsertClaudeHook as UpdateClaudeHookBody,
  selectClaudeHookSchema as ClaudeHookSchema
} from '@promptliano/database'

// Define local types for hooks (schema types may not exist yet)
export type HookEvent = 
  | 'PreToolUse' 
  | 'PostToolUse' 
  | 'UserPromptSubmit' 
  | 'Notification' 
  | 'Stop' 
  | 'SubagentStop' 
  | 'SessionStart' 
  | 'PreCompact'

export interface HookListItem {
  event: string
  matcher: string
  command: string
  timeout?: number
  description?: string
}

export interface CreateHookRequest {
  event: HookEvent
  matcher: string
  command: string
  timeout?: number
}

export interface UpdateHookRequest {
  event?: HookEvent
  matcher?: string
  command?: string
  timeout?: number
}

export const HookGenerationResponseSchema = z.object({
  data: z.object({
    event: z.string(),
    matcher: z.string(),
    command: z.string(),
    timeout: z.number().optional(),
    description: z.string(),
    security_warnings: z.array(z.string()).optional()
  })
})

import { ErrorFactory, assertExists, withErrorContext, ApiError } from '@promptliano/shared'
import { z } from 'zod'
import { generateStructuredData } from './gen-ai-services'

// Schema for AI-generated hook data
const GeneratedHookConfigSchema = z.object({
  event: z.enum(['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SessionStart', 'PreCompact']),
  matcher: z.string().describe('Pattern to match tool names (e.g., "Edit|Write" or ".*" for all tools)'),
  command: z.string().describe('Safe shell command to execute'),
  description: z.string().describe('Human-readable description of what this hook does'),
  timeout: z.number().optional().describe('Timeout in seconds (default: 60)'),
  security_warnings: z.array(z.string()).optional().describe('Any security concerns with the generated command')
})

// Service dependencies interface
export interface ClaudeHookServiceDeps {
  repository?: typeof claudeHookRepository
  logger?: any
  cache?: any
}

/**
 * Create Claude Hook Service factory function
 * Manages Claude hooks with database persistence
 */
export function createClaudeHookService(deps: ClaudeHookServiceDeps = {}) {
  const {
    repository = claudeHookRepository,
    logger = console,
    cache,
  } = deps

  const errors = ErrorFactory.forEntity('ClaudeHook')

  return {
    /**
     * List all hooks for a project
     */
    async listHooks(projectId: number): Promise<ClaudeHook[]> {
      return withErrorContext(
        async () => {
          return await repository.getByProject(projectId)
        },
        { entity: 'ClaudeHook', action: 'listHooks', projectId }
      )
    },

    /**
     * Get a specific hook by ID
     */
    async getById(hookId: number): Promise<ClaudeHook> {
      return withErrorContext(
        async () => {
          const hook = await repository.getById(hookId)
          assertExists(hook, 'ClaudeHook', hookId)
          return hook
        },
        { entity: 'ClaudeHook', action: 'getById', hookId }
      )
    },

    /**
     * Create a new hook
     */
    async create(projectId: number, data: CreateClaudeHookBody): Promise<ClaudeHook> {
      return withErrorContext(
        async () => {
          const validated = ClaudeHookSchema.parse({
            ...data,
            projectId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
          return await repository.create(validated)
        },
        { entity: 'ClaudeHook', action: 'create', projectId }
      )
    },

    /**
     * Update an existing hook
     */
    async update(hookId: number, data: Partial<UpdateClaudeHookBody>): Promise<ClaudeHook> {
      return withErrorContext(
        async () => {
          // Verify hook exists
          await this.getById(hookId)
          
          const validated = ClaudeHookSchema.partial().parse({
            ...data,
            updatedAt: Date.now(),
          })
          
          const result = await repository.update(hookId, validated)
          if (!result) {
            throw errors.updateFailed(hookId)
          }
          
          return result
        },
        { entity: 'ClaudeHook', action: 'update', hookId }
      )
    },

    /**
     * Delete a hook
     */
    async delete(hookId: number): Promise<boolean> {
      return withErrorContext(
        async () => {
          // Verify hook exists
          await this.getById(hookId)
          
          const result = await repository.delete(hookId)
          if (!result) {
            throw errors.deleteFailed(hookId)
          }
          
          return true
        },
        { entity: 'ClaudeHook', action: 'delete', hookId }
      )
    },

    /**
     * Get hooks by event type
     */
    async getByEvent(projectId: number, event: string): Promise<ClaudeHook[]> {
      return withErrorContext(
        async () => {
          return await repository.getByEvent(projectId, event)
        },
        { entity: 'ClaudeHook', action: 'getByEvent', projectId, event }
      )
    },

    /**
     * Search hooks by pattern
     */
    async searchHooks(projectId: number, query: string): Promise<ClaudeHook[]> {
      return withErrorContext(
        async () => {
          const allHooks = await this.listHooks(projectId)

          if (!query) return allHooks

          const lowerQuery = query.toLowerCase()
          return allHooks.filter(
            (hook) =>
              hook.triggerEvent.toLowerCase().includes(lowerQuery) ||
              hook.name.toLowerCase().includes(lowerQuery) ||
              hook.script.toLowerCase().includes(lowerQuery) ||
              (hook.description && hook.description.toLowerCase().includes(lowerQuery))
          )
        },
        { entity: 'ClaudeHook', action: 'searchHooks', projectId }
      )
    },

    /**
     * Generate hook configuration from natural language description
     */
    async generateHookFromDescription(
      description: string,
      context?: {
        projectId?: number
        suggestedEvent?: HookEvent
        examples?: string[]
      }
    ): Promise<z.infer<typeof HookGenerationResponseSchema>['data']> {
      return withErrorContext(
        async () => {
          const systemPrompt = `You are a Claude Code hook configuration generator. Generate safe, useful hook configurations based on user descriptions.

IMPORTANT SECURITY RULES:
- NEVER generate commands that could delete files or directories
- NEVER generate commands that could expose sensitive information
- NEVER generate commands that could modify system files
- ALWAYS validate user input and sanitize file paths
- PREFER read-only operations where possible

Available hook events:
- PreToolUse: Runs before a tool is executed
- PostToolUse: Runs after a tool completes
- UserPromptSubmit: Runs when user submits a prompt
- Notification: Runs on notifications
- Stop: Runs when stopping
- SubagentStop: Runs when subagent stops
- SessionStart: Runs at session start
- PreCompact: Runs before context compaction

Common tool names for matchers:
- Edit, Write, Read, MultiEdit (file operations)
- Bash (shell commands)
- WebFetch (web requests)
- Task (subagent tasks)

Environment variables available:
- $CLAUDE_PROJECT_DIR: Absolute path to project root
- $TOOL_NAME: Name of the tool being executed
- $TOOL_INPUT: JSON input to the tool (parse with jq)

${context?.examples ? `Examples:\n${context.examples.join('\n')}` : ''}`

          const userPrompt = `Generate a hook configuration for: "${description}"
          ${context?.suggestedEvent ? `Suggested event: ${context.suggestedEvent}` : ''}
          
Return a safe, practical hook configuration.`

          const result = await generateStructuredData({
            prompt: userPrompt,
            systemMessage: systemPrompt,
            schema: GeneratedHookConfigSchema
          })

          return {
            event: result.object.event as string,
            matcher: result.object.matcher as string,
            command: result.object.command as string,
            timeout: result.object.timeout as number | undefined,
            description: result.object.description as string,
            security_warnings: result.object.security_warnings as string[] | undefined
          }
        },
        { entity: 'ClaudeHook', action: 'generateHookFromDescription' }
      )
    },

    /**
     * Test hook - Note: Claude Code handles actual execution
     */
    async testHook(
      hookId: number,
      sampleToolName?: string
    ): Promise<{ message: string; hook: ClaudeHook }> {
      return withErrorContext(
        async () => {
          const hook = await this.getById(hookId)
          
          // Claude Code handles hook execution, we just return a message with hook data
          return {
            message: 'Hook testing is not implemented. Claude Code handles hook execution directly.',
            hook
          }
        },
        { entity: 'ClaudeHook', action: 'testHook', hookId }
      )
    },

    /**
     * Enable/disable a hook
     */
    async toggleActive(hookId: number, isActive: boolean): Promise<ClaudeHook> {
      return await this.update(hookId, { isActive })
    },

    // Legacy method support for backward compatibility
    async listHooksLegacy(projectPath: string): Promise<HookListItem[]> {
      logger?.warn('Using legacy listHooks method with projectPath. Consider migrating to projectId.')
      // For now, return empty array since we can't resolve projectPath to projectId
      return []
    },

    async getHookLegacy(projectPath: string, event: HookEvent, matcherIndex: number): Promise<HookListItem | null> {
      logger?.warn('Using legacy getHook method. Consider migrating to getById.')
      return null
    },

    async createHookLegacy(projectPath: string, request: CreateHookRequest): Promise<HookListItem> {
      logger?.warn('Using legacy createHook method. Consider migrating to create with projectId.')
      throw new ApiError(400, 'Legacy createHook method not supported', 'LEGACY_METHOD_NOT_SUPPORTED')
    },

    async updateHookLegacy(
      projectPath: string,
      event: HookEvent,
      matcherIndex: number,
      request: Partial<UpdateHookRequest>
    ): Promise<HookListItem | null> {
      logger?.warn('Using legacy updateHook method. Consider migrating to update with hookId.')
      return null
    },

    async deleteHookLegacy(projectPath: string, event: HookEvent, matcherIndex: number): Promise<boolean> {
      logger?.warn('Using legacy deleteHook method. Consider migrating to delete with hookId.')
      return false
    },

    async isClaudeCodeInstalled(projectPath: string): Promise<boolean> {
      logger?.warn('Using legacy isClaudeCodeInstalled method.')
      return false
    }
  }
}

// Create and export singleton instance
export const claudeHookService = createClaudeHookService()

// Export service type
export type ClaudeHookService = ReturnType<typeof createClaudeHookService>

// Export individual methods for tree-shaking
export const {
  listHooks: listClaudeHooks,
  getById: getClaudeHookById,
  create: createClaudeHook,
  update: updateClaudeHook,
  delete: deleteClaudeHook,
  getByEvent: getClaudeHooksByEvent,
  searchHooks: searchClaudeHooks,
  generateHookFromDescription,
  testHook: testClaudeHook,
  toggleActive: toggleClaudeHookActive,
  // Legacy methods with different names to avoid conflicts
  listHooksLegacy,
  getHookLegacy,
  createHookLegacy,
  updateHookLegacy,
  deleteHookLegacy,
  isClaudeCodeInstalled
} = claudeHookService

// Legacy exports for backward compatibility
export const listHooks = claudeHookService.listHooksLegacy
export const getHook = claudeHookService.getHookLegacy  
export const createHook = claudeHookService.createHookLegacy
export const updateHook = claudeHookService.updateHookLegacy
export const deleteHook = claudeHookService.deleteHookLegacy
