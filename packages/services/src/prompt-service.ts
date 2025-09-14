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
import { nullToUndefined } from './utils/file-utils'
import ErrorFactory from '@promptliano/shared/src/error/error-factory'
import { promptRepository, projectRepository } from '@promptliano/database'
import { type Prompt, type CreatePrompt, type UpdatePrompt, PromptSchema } from '@promptliano/database'

type CreatePromptBody = CreatePrompt
type UpdatePromptBody = UpdatePrompt
import { PromptSuggestionsZodSchema } from '@promptliano/schemas' // AI generation schema - may remain in schemas package
import { generateStructuredData } from './gen-ai-services'
// Project summary removed

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
  const { repository = promptRepository, logger = createServiceLogger('PromptService') } = deps

  // Ensure logger is never undefined
  const safeLogger = logger!

  // Base CRUD operations using the service factory
  const baseService = createCrudService({
    entityName: 'Prompt',
    repository,
    logger
  })

  // Ensure baseService is never undefined
  const safeBaseService = baseService!

  // Extended domain operations
  const extensions = {
    /**
     * Override base create to add project validation
     */
    async create(data: CreatePromptBody): Promise<Prompt> {
      return withErrorContext(
        async () => {
          // Validate project exists if projectId provided
          if ((data as any).projectId) {
            const projectExists = await projectRepository.exists((data as any).projectId)
            if (!projectExists) {
              throw ErrorFactory.notFound('Project', (data as any).projectId.toString())
            }
          }

          // Create the prompt using repository
          return (await repository.create(data as any)) as Prompt
        },
        { entity: 'Prompt', action: 'create' }
      )
    },

    /**
     * List prompts by project with proper associations
     */
    async getByProject(projectId: number): Promise<Prompt[]> {
      return withErrorContext(
        async () => {
          return (await repository.getByProject(projectId)) as Prompt[]
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
          // Use the getByProject method and filter in memory for now
          if (projectId) {
            const prompts = (await repository.getByProject(projectId)) as Prompt[]
            return prompts.filter(
              (p) =>
                p.title.toLowerCase().includes(query.toLowerCase()) ||
                p.content.toLowerCase().includes(query.toLowerCase())
            )
          } else {
            const allPrompts = (await repository.getAll()) as Prompt[]
            return allPrompts.filter(
              (p) =>
                p.title.toLowerCase().includes(query.toLowerCase()) ||
                p.content.toLowerCase().includes(query.toLowerCase())
            )
          }
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
          if ((data as any).projectId && deps.projectService) {
            await deps.projectService.getById((data as any).projectId)
          }

          // Use repository directly with proper type casting
          return (await repository.create(data as any)) as Prompt
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
          const existingPrompts = await this.getByProject(projectId)

          const systemPrompt = `You are a prompt engineering assistant. Based on the project context and user query, suggest relevant prompt templates that would be useful for this project.

Return an array of prompt suggestions that are:
1. Specific to the project's domain and technology stack
2. Actionable and practical for development tasks
3. Different from existing prompts
4. Tailored to the user's query

Existing Prompts:
${existingPrompts.map((p) => `- ${p.title}: ${p.content.substring(0, 100)}...`).join('\n')}

User Query: ${userQuery}`

          const result = await generateStructuredData({
            prompt: userQuery,
            systemMessage: systemPrompt,
            schema: PromptSuggestionsZodSchema
          })

          return result.object.promptIds.map((id) => `Prompt ID: ${id}`)
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
          const prompt = (await safeBaseService.getById(promptId)) as Prompt

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

          return (result as any).object.content
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
          const original = (await safeBaseService.getById(promptId)) as Prompt

          const duplicateData: CreatePromptBody = {
            title: `${original.title} (Copy)`,
            content: original.content,
            projectId: original.projectId,
            ...modifications
          } as any

          return (await repository.create(duplicateData as any)) as Prompt
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
          // For now, return mock data
          return {
            usageCount: 0,
            lastUsed: null,
            projectsUsedIn: []
          }
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
            const results = []
            for (const prompt of prompts) {
              const created = (await repository.create(prompt as any)) as Prompt
              results.push(created)
            }
            return results
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
              updates.map(async ({ id, data }) => {
                return repository.update(id, data as any) as unknown as Prompt
              })
            )

            const successful = results.filter((r) => r.status === 'fulfilled').length

            if (successful < updates.length) {
              safeLogger.warn('Some prompt updates failed', {
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
              promptIds.map((id) => safeBaseService.delete?.(id) || Promise.resolve(false))
            )

            return results.filter((r) => r.status === 'fulfilled').length
          },
          { entity: 'Prompt', action: 'batchDelete' }
        )
      }
    }
  }

  return extendService(safeBaseService, extensions)
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

// Add legacy aliases and missing functions for backward compatibility
export const listPromptsByProject = getPromptsByProject
export const suggestPrompts = getPromptSuggestions

export const listAllPrompts = async () => {
  // Get all prompts across all projects
  const prompts = await promptRepository.getAll()
  return prompts
}

export const addPromptToProject = async (promptId: number, projectId: number) => {
  // Update prompt to associate with project
  const prompt = await promptRepository.update(promptId, { projectId })
  return prompt
}

export const removePromptFromProject = async (promptId: number) => {
  // Remove prompt from project by setting projectId to null
  const prompt = await promptRepository.update(promptId, { projectId: null })
  return prompt
}

export const getPromptsByIds = async (promptIds: number[]): Promise<Prompt[]> => {
  // Get multiple prompts by their IDs
  const prompts = await Promise.all(
    promptIds.map(async (id) => {
      try {
        return await promptRepository.getById(id)
      } catch {
        return null // Skip missing prompts
      }
    })
  )
  return prompts.filter((p): p is Prompt => p !== null)
}

export const getPromptProjects = async (promptId: number) => {
  // Get project associations for a prompt (simplified for current schema)
  const prompt = await promptRepository.getById(promptId)
  if (prompt?.projectId) {
    return [{ id: 1, promptId, projectId: prompt.projectId }]
  }
  return []
}
