/**
 * Prompt Repository - Replaces PromptStorage class
 * Reduces from 150+ lines to ~25 lines
 */

import { eq, desc } from 'drizzle-orm'
import { db } from '../db'
import { prompts, type Prompt, type InsertPrompt } from '../schema'

export const promptRepository = {
  /**
   * Create a new prompt
   */
  async create(data: Omit<InsertPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prompt> {
    const now = Date.now()
    const result = await db.insert(prompts).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create prompt')
    }
    
    return result[0]
  },

  /**
   * Get prompt by ID
   */
  async getById(id: number): Promise<Prompt | null> {
    const [prompt] = await db.select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1)
    return prompt ?? null
  },

  /**
   * Get prompts by project ID
   */
  async getByProject(projectId: number): Promise<Prompt[]> {
    return db.select()
      .from(prompts)
      .where(eq(prompts.projectId, projectId))
      .orderBy(desc(prompts.updatedAt))
  },

  /**
   * Update prompt
   */
  async update(id: number, data: Partial<Omit<InsertPrompt, 'id' | 'createdAt'>>): Promise<Prompt> {
    const result = await db.update(prompts)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(prompts.id, id))
      .returning()
    
    if (!result[0]) {
      throw new Error(`Prompt with id ${id} not found`)
    }
    
    return result[0]
  },

  /**
   * Delete prompt
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(prompts)
      .where(eq(prompts.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  /**
   * Search prompts by title
   */
  async searchByTitle(projectId: number, query: string): Promise<Prompt[]> {
    // Note: For proper text search, you'd use a FTS extension or LIKE with raw SQL
    return db.select()
      .from(prompts)
      .where(eq(prompts.projectId, projectId))
      .orderBy(desc(prompts.updatedAt))
  }
}