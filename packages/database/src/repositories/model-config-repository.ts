import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db'
import { modelConfigs, type ModelConfig, type InsertModelConfig } from '../schema'
import { createBaseRepository } from './base-repository'

/**
 * Repository for model configuration operations
 * Handles CRUD operations and business logic queries for model configs
 */
export const modelConfigRepository = {
  ...createBaseRepository(modelConfigs),

  /**
   * Get all model configurations
   */
  async getAll(): Promise<ModelConfig[]> {
    const results = await db.select().from(modelConfigs).orderBy(modelConfigs.name)
    return results as ModelConfig[]
  },

  /**
   * Get model configurations by provider
   */
  async getByProvider(provider: string): Promise<ModelConfig[]> {
    const results = await db
      .select()
      .from(modelConfigs)
      .where(and(eq(modelConfigs.provider, provider), eq(modelConfigs.isActive, true)))
      .orderBy(modelConfigs.name)
    return results as ModelConfig[]
  },

  /**
   * Get default configuration for a provider
   */
  async getDefaultForProvider(provider: string): Promise<ModelConfig | null> {
    const results = await db
      .select()
      .from(modelConfigs)
      .where(and(eq(modelConfigs.provider, provider), eq(modelConfigs.isDefault, true), eq(modelConfigs.isActive, true)))
      .limit(1)

    return (results[0] as ModelConfig) || null
  },

  /**
   * Get configuration by name
   */
  async getByName(name: string): Promise<ModelConfig | null> {
    const results = await db.select().from(modelConfigs).where(eq(modelConfigs.name, name)).limit(1)

    return (results[0] as ModelConfig) || null
  },

  /**
   * Get system presets
   */
  async getSystemPresets(): Promise<ModelConfig[]> {
    const results = await db
      .select()
      .from(modelConfigs)
      .where(and(eq(modelConfigs.isSystemPreset, true), eq(modelConfigs.isActive, true)))
      .orderBy(modelConfigs.name)
    return results as ModelConfig[]
  },

  /**
   * Get user configurations
   */
  async getUserConfigs(userId?: number): Promise<ModelConfig[]> {
    if (userId) {
      const results = await db
        .select()
        .from(modelConfigs)
        .where(and(eq(modelConfigs.userId, userId), eq(modelConfigs.isActive, true)))
        .orderBy(modelConfigs.name)
      return results as ModelConfig[]
    }

    // Get all non-system configs when no userId provided
    const results = await db
      .select()
      .from(modelConfigs)
      .where(and(eq(modelConfigs.isSystemPreset, false), eq(modelConfigs.isActive, true)))
      .orderBy(modelConfigs.name)
    return results as ModelConfig[]
  },

  /**
   * Set default configuration for a provider
   */
  async setDefaultForProvider(id: number, provider: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // First, unset any existing defaults for this provider
      await tx
        .update(modelConfigs)
        .set({ isDefault: false, updatedAt: Date.now() })
        .where(and(eq(modelConfigs.provider, provider), eq(modelConfigs.isDefault, true)))

      // Then set the new default
      const result = await tx
        .update(modelConfigs)
        .set({ isDefault: true, updatedAt: Date.now() })
        .where(and(eq(modelConfigs.id, id), eq(modelConfigs.provider, provider)))

      return (result as any).changes > 0
    })
  },

  /**
   * Create a model configuration with timestamps
   */
  async create(data: Omit<InsertModelConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModelConfig> {
    const now = Date.now()
    const result = await db
      .insert(modelConfigs)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now
      })
      .returning()

    return result[0] as ModelConfig
  },

  /**
   * Update a model configuration
   */
  async update(id: number, data: Partial<Omit<InsertModelConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ModelConfig | null> {
    const result = await db
      .update(modelConfigs)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(modelConfigs.id, id))
      .returning()

    return (result[0] as ModelConfig) || null
  },

  /**
   * Delete a model configuration (soft delete by setting isActive = false)
   */
  async softDelete(id: number): Promise<boolean> {
    const result = await db
      .update(modelConfigs)
      .set({ isActive: false, updatedAt: Date.now() })
      .where(eq(modelConfigs.id, id))

    return (result as any).changes > 0
  },

  /**
   * Hard delete a model configuration
   */
  async hardDelete(id: number): Promise<boolean> {
    const result = await db.delete(modelConfigs).where(eq(modelConfigs.id, id))
    return (result as any).changes > 0
  },

  /**
   * Get by ID
   */
  async getById(id: number): Promise<ModelConfig | null> {
    const results = await db.select().from(modelConfigs).where(eq(modelConfigs.id, id)).limit(1)
    return (results[0] as ModelConfig) || null
  },

  /**
   * Check if a configuration name exists
   */
  async nameExists(name: string, excludeId?: number): Promise<boolean> {
    const query = excludeId
      ? and(eq(modelConfigs.name, name), eq(modelConfigs.isActive, true))
      : and(eq(modelConfigs.name, name), eq(modelConfigs.isActive, true))

    const result = await db.select({ id: modelConfigs.id }).from(modelConfigs).where(query).limit(1)

    return result.length > 0
  }
}