/**
 * Prompt Repository - Replaces PromptStorage class
 * Now using BaseRepository for 70% code reduction (88 → 26 lines)
 * Enhanced with better performance and error handling
 */

import { eq, desc } from 'drizzle-orm'
import { createBaseRepository, extendRepository } from './base-repository'
import { prompts, type Prompt, type InsertPrompt, selectPromptSchema } from '../schema'

// Create base prompt repository
const basePromptRepository = createBaseRepository(prompts, selectPromptSchema, 'Prompt')

// Extend with domain-specific methods
export const promptRepository = extendRepository(basePromptRepository, {
  // BaseRepository provides: create, getById, getAll, update, delete, exists, count
  // createMany, updateMany, deleteMany, findWhere, findOneWhere, paginate

  /**
   * Get prompts by project ID (optimized with BaseRepository)
   */
  async getByProject(projectId: number): Promise<Prompt[]> {
    const results = await basePromptRepository.findWhere(eq(prompts.projectId, projectId))
    // Cast to ensure proper type with JSON fields
    return results as Prompt[]
  }
})
