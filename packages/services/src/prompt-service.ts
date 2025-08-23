/**
 * Prompt Service - Functional Factory Pattern
 * Modernized prompt management with repository integration
 * 
 * Key improvements:
 * - Uses Drizzle repository instead of manual storage
 * - Functional composition pattern
 * - Consistent error handling with ErrorFactory
 * - Dependency injection support
 * - Project association management
 * - AI prompt optimization features
 */

import { createCrudService, extendService, withErrorContext, createServiceLogger } from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { promptRepository } from '@promptliano/database'
import { 
  type Prompt, 
  type CreatePromptBody, 
  type UpdatePromptBody,
  PromptSchema,
  PromptSuggestionsZodSchema
} from '@promptliano/schemas'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'

// Dependencies interface for dependency injection
export interface PromptServiceDeps {
  repository?: typeof promptRepository
  logger?: ReturnType<typeof createServiceLogger>
  aiService?: any // For prompt optimization
  projectService?: any // For project validation
}

/**
 * Create Prompt Service with functional factory pattern
 */
export function createPromptService(deps: PromptServiceDeps = {}) {
  const {
    repository = promptRepository,
    logger = createServiceLogger('PromptService'),
  } = deps

  // Base CRUD operations using the service factory
  const baseService = createCrudService<Prompt, CreatePromptBody, UpdatePromptBody>({
    entityName: 'Prompt',
    repository,
    schema: PromptSchema,
    logger
  })

  // Extended domain operations
  const extensions = {
    /**
     * List prompts by project with proper associations
     */
    async getByProject(projectId: number): Promise<Prompt[]> {
      return withErrorContext(
        async () => {
          return await repository.getByProject(projectId)
        },
        { entity: 'Prompt', action: 'getByProject' }
      )
    },

    /**
     * Search prompts by content or name
     */
    async search(query: string, projectId?: number): Promise<Prompt[]> {
      return withErrorContext(
        async () => {
          return await repository.search(query, projectId)
        },
        { entity: 'Prompt', action: 'search' }
      )
    },

    /**
     * Create prompt with project association
     */
    async createWithProject(data: CreatePromptBody): Promise<Prompt> {
      return withErrorContext(
        async () => {
          // Validate project exists if projectId provided
          if (data.projectId && deps.projectService) {
            await deps.projectService.getById(data.projectId)
          }

          return await baseService.create(data)
        },
        { entity: 'Prompt', action: 'createWithProject' }
      )
    },

    /**
     * Get prompt suggestions based on project context
     */
    async getSuggestions(projectId: number, userQuery: string): Promise<string[]> {
      return withErrorContext(
        async () => {
          const projectSummary = await getCompactProjectSummary(projectId)
          const existingPrompts = await this.getByProject(projectId)
          
          const systemPrompt = `You are a prompt engineering assistant. Based on the project context and user query, suggest relevant prompt templates that would be useful for this project.

Return an array of prompt suggestions that are:
1. Specific to the project's domain and technology stack
2. Actionable and practical for development tasks
3. Different from existing prompts
4. Tailored to the user's query

Project Summary:
${projectSummary}

Existing Prompts:
${existingPrompts.map(p => `- ${p.name}: ${p.content.substring(0, 100)}...`).join('\n')}

User Query: ${userQuery}`

          const result = await generateStructuredData({
            prompt: userQuery,
            systemMessage: systemPrompt,
            schema: PromptSuggestionsZodSchema
          })

          return result.object.suggestions
        },
        { entity: 'Prompt', action: 'getSuggestions' }
      )
    },

    /**
     * Optimize existing prompt content using AI
     */
    async optimizePrompt(promptId: number, context?: string): Promise<string> {
      return withErrorContext(
        async () => {
          const prompt = await baseService.getById(promptId)
          
          const systemPrompt = `You are a prompt optimization expert. Improve the given prompt to be more effective, clear, and specific.

Original Prompt:
${prompt.content}

${context ? `Additional Context: ${context}` : ''}

Return the optimized version that:
1. Is more specific and actionable
2. Uses clear, direct language
3. Includes relevant context
4. Follows prompt engineering best practices
5. Maintains the original intent`

          const result = await generateStructuredData({
            prompt: prompt.content,
            systemMessage: systemPrompt,
            schema: PromptSchema.pick({ content: true })
          })

          return result.object.content
        },
        { entity: 'Prompt', action: 'optimizePrompt', id: promptId }
      )
    },

    /**
     * Duplicate prompt with optional modifications
     */
    async duplicate(promptId: number, modifications?: Partial<CreatePromptBody>): Promise<Prompt> {
      return withErrorContext(
        async () => {
          const original = await baseService.getById(promptId)
          
          const duplicateData: CreatePromptBody = {
            name: `${original.name} (Copy)`,
            content: original.content,
            projectId: original.projectId,
            ...modifications
          }
          
          return await baseService.create(duplicateData)
        },
        { entity: 'Prompt', action: 'duplicate', id: promptId }
      )
    },

    /**
     * Get prompt usage statistics
     */
    async getUsageStats(promptId: number): Promise<{
      usageCount: number
      lastUsed: Date | null
      projectsUsedIn: number[]
    }> {
      return withErrorContext(
        async () => {
          // This would integrate with usage tracking when implemented
          return await repository.getUsageStats(promptId)
        },
        { entity: 'Prompt', action: 'getUsageStats', id: promptId }
      )
    },

    /**
     * Batch operations for prompts
     */
    batch: {
      /**
       * Create multiple prompts at once
       */
      createMany: async (prompts: CreatePromptBody[]): Promise<Prompt[]> => {
        return withErrorContext(
          async () => {
            return await repository.createMany(prompts)
          },
          { entity: 'Prompt', action: 'batchCreate' }
        )
      },

      /**
       * Update multiple prompts
       */
      updateMany: async (updates: Array<{ id: number; data: UpdatePromptBody }>): Promise<number> => {
        return withErrorContext(
          async () => {
            const results = await Promise.allSettled(
              updates.map(({ id, data }) => baseService.update(id, data))
            )
            
            const successful = results.filter(r => r.status === 'fulfilled').length
            
            if (successful < updates.length) {
              logger.warn('Some prompt updates failed', {
                total: updates.length,
                successful,
                failed: updates.length - successful
              })
            }
            
            return successful
          },
          { entity: 'Prompt', action: 'batchUpdate' }
        )
      },

      /**
       * Delete multiple prompts
       */
      deleteMany: async (promptIds: number[]): Promise<number> => {
        return withErrorContext(
          async () => {
            const results = await Promise.allSettled(
              promptIds.map(id => baseService.delete(id))
            )
            
            return results.filter(r => r.status === 'fulfilled').length
          },
          { entity: 'Prompt', action: 'batchDelete' }
        )
      }
    }
  }

  return extendService(baseService, extensions)
}

// Export type for consumers
export type PromptService = ReturnType<typeof createPromptService>
export type PromptServiceV2 = ReturnType<typeof createPromptService>

// Export singleton for backward compatibility
export const promptService = createPromptService()
export const promptServiceV2 = promptService

// Export individual functions for tree-shaking (main functions)
export const {
  create: createPrompt,
  getById: getPromptById,
  update: updatePrompt,
  delete: deletePrompt,
  getByProject: getPromptsByProject,
  search: searchPrompts,
  getSuggestions: getPromptSuggestions,
  optimizePrompt,
  duplicate: duplicatePrompt
} = promptService

// Export individual functions for tree-shaking (V2 backwards compatibility)
export const {
  create: createPromptV2,
  getById: getPromptByIdV2,
  update: updatePromptV2,
  delete: deletePromptV2,
  getByProject: getPromptsByProjectV2,
  search: searchPromptsV2,
  getSuggestions: getPromptSuggestionsV2,
  optimizePrompt: optimizePromptV2,
  duplicate: duplicatePromptV2
} = promptServiceV2