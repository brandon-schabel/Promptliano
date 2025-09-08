import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db'
import { modelPresets, modelConfigs, type ModelPreset, type InsertModelPreset, type ModelConfig } from '../schema'
import { createBaseRepository } from './base-repository'

/**
 * Repository for model preset operations
 * Handles CRUD operations and business logic queries for model presets
 */
export const modelPresetRepository = {
  ...createBaseRepository(modelPresets),

  /**
   * Get all presets with their associated configurations
   */
  async getAllWithConfigs(): Promise<(ModelPreset & { config: ModelConfig })[]> {
    const results = await db
      .select({
        preset: modelPresets,
        config: modelConfigs
      })
      .from(modelPresets)
      .innerJoin(modelConfigs, eq(modelPresets.configId, modelConfigs.id))
      .where(eq(modelPresets.isActive, true))
      .orderBy(desc(modelPresets.usageCount), modelPresets.name)
    return results.map((r) => ({ ...(r.preset as ModelPreset), config: r.config as ModelConfig }))
  },

  /**
   * Get presets by category
   */
  async getByCategory(category: string): Promise<ModelPreset[]> {
    const results = await db
      .select()
      .from(modelPresets)
      .where(and(eq(modelPresets.category, category as any), eq(modelPresets.isActive, true)))
      .orderBy(desc(modelPresets.usageCount), modelPresets.name)
    return results as ModelPreset[]
  },

  /**
   * Get system presets
   */
  async getSystemPresets(): Promise<ModelPreset[]> {
    const results = await db
      .select()
      .from(modelPresets)
      .where(and(eq(modelPresets.isSystemPreset, true), eq(modelPresets.isActive, true)))
      .orderBy(modelPresets.name)
    return results as ModelPreset[]
  },

  /**
   * Get all presets
   */
  async getAllPresets(): Promise<ModelPreset[]> {
    const results = await db
      .select()
      .from(modelPresets)
      .where(and(eq(modelPresets.isSystemPreset, false), eq(modelPresets.isActive, true)))
      .orderBy(desc(modelPresets.usageCount), modelPresets.name)
    return results as ModelPreset[]
  },

  /**
   * Get most used presets
   */
  async getMostUsed(limit = 5): Promise<ModelPreset[]> {
    const results = await db
      .select()
      .from(modelPresets)
      .where(eq(modelPresets.isActive, true))
      .orderBy(desc(modelPresets.usageCount))
      .limit(limit)
    return results as ModelPreset[]
  },

  /**
   * Get recently used presets
   */
  async getRecentlyUsed(limit = 5): Promise<ModelPreset[]> {
    const results = await db
      .select()
      .from(modelPresets)
      .where(and(eq(modelPresets.isActive, true)))
      .orderBy(desc(modelPresets.lastUsedAt))
      .limit(limit)
    return results as ModelPreset[]
  },

  /**
   * Get preset with its configuration
   */
  async getWithConfig(id: number): Promise<(ModelPreset & { config: ModelConfig }) | null> {
    const results = await db
      .select({
        preset: modelPresets,
        config: modelConfigs
      })
      .from(modelPresets)
      .innerJoin(modelConfigs, eq(modelPresets.configId, modelConfigs.id))
      .where(eq(modelPresets.id, id))
      .limit(1)

    if (results.length === 0) return null
    const result = results[0]!
    return {
      ...(result.preset as ModelPreset),
      config: result.config as ModelConfig
    }
  },

  /**
   * Create a preset with timestamps
   */
  async create(data: Omit<InsertModelPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModelPreset> {
    const now = Date.now()
    const result = await db
      .insert(modelPresets)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now
      })
      .returning()

    return result[0] as ModelPreset
  },

  /**
   * Update a preset
   */
  async update(
    id: number,
    data: Partial<Omit<InsertModelPreset, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ModelPreset | null> {
    const result = await db
      .update(modelPresets)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(modelPresets.id, id))
      .returning()

    return (result[0] as ModelPreset) || null
  },

  /**
   * Increment usage count for a preset
   */
  async incrementUsage(id: number): Promise<boolean> {
    const now = Date.now()
    const result = await db
      .update(modelPresets)
      .set({
        usageCount: (modelPresets.usageCount as any) + 1,
        lastUsedAt: now,
        updatedAt: now
      })
      .where(eq(modelPresets.id, id))

    return (result as any).changes > 0
  },

  /**
   * Delete a preset (soft delete by setting isActive = false)
   */
  async softDelete(id: number): Promise<boolean> {
    const result = await db
      .update(modelPresets)
      .set({ isActive: false, updatedAt: Date.now() })
      .where(eq(modelPresets.id, id))

    return (result as any).changes > 0
  },

  /**
   * Hard delete a preset
   */
  async hardDelete(id: number): Promise<boolean> {
    const result = await db.delete(modelPresets).where(eq(modelPresets.id, id))
    return (result as any).changes > 0
  },

  /**
   * Get by ID
   */
  async getById(id: number): Promise<ModelPreset | null> {
    const results = await db.select().from(modelPresets).where(eq(modelPresets.id, id)).limit(1)
    return (results[0] as ModelPreset) || null
  },

  /**
   * Check if a preset name exists
   */
  async nameExists(name: string, excludeId?: number): Promise<boolean> {
    const query = excludeId
      ? and(eq(modelPresets.name, name), eq(modelPresets.isActive, true))
      : and(eq(modelPresets.name, name), eq(modelPresets.isActive, true))

    const result = await db.select({ id: modelPresets.id }).from(modelPresets).where(query).limit(1)

    return result.length > 0
  }
}
