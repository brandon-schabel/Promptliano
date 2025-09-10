import { ErrorFactory, ApiError } from '@promptliano/shared'
import {
  modelConfigRepository,
  modelPresetRepository,
  type ModelConfig,
  type ModelPreset,
  type CreateModelConfig,
  type UpdateModelConfig,
  type CreateModelPreset,
  type UpdateModelPreset
} from '@promptliano/database'
import { createServiceLogger } from './utils/service-logger'
import { LOW_MODEL_CONFIG, MEDIUM_MODEL_CONFIG, HIGH_MODEL_CONFIG, PLANNING_MODEL_CONFIG } from '@promptliano/config'

export interface ModelConfigServiceDeps {
  repository?: typeof modelConfigRepository
  presetRepository?: typeof modelPresetRepository
  logger?: ReturnType<typeof createServiceLogger>
}

/**
 * Service for managing model configurations and presets
 * Provides business logic for AI model configuration management
 */
// Simple in-memory cache for preset configs
const presetConfigCache = new Map<string, { config: ModelConfig; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute cache

export function createModelConfigService(deps: ModelConfigServiceDeps = {}) {
  const {
    repository = modelConfigRepository,
    presetRepository = modelPresetRepository,
    logger = createServiceLogger('ModelConfigService')
  } = deps

  // Static config fallbacks for when database is unavailable
  const STATIC_FALLBACKS: Record<string, ModelConfig> = {
    low: LOW_MODEL_CONFIG as any,
    medium: MEDIUM_MODEL_CONFIG as any,
    high: HIGH_MODEL_CONFIG as any,
    planning: PLANNING_MODEL_CONFIG as any
  }

  return {
    // ==================== Model Configurations ====================

    /**
     * Get all model configurations
     */
    async getAllConfigs(): Promise<ModelConfig[]> {
      try {
        const configs = await repository.getAll()
        logger.info('Retrieved all model configurations', { count: configs.length })
        return configs
      } catch (error) {
        logger.error('Failed to retrieve model configurations', { error })
        throw ErrorFactory.operationFailed('getAllConfigs', 'Failed to retrieve model configurations')
      }
    },

    /**
     * Get configurations by provider
     */
    async getConfigsByProvider(provider: string): Promise<ModelConfig[]> {
      try {
        const configs = await repository.getByProvider(provider)
        logger.info('Retrieved configurations for provider', { provider, count: configs.length })
        return configs
      } catch (error) {
        logger.error('Failed to retrieve provider configurations', { provider, error })
        throw ErrorFactory.operationFailed(
          'getConfigsByProvider',
          `Failed to retrieve provider configurations for ${provider}`
        )
      }
    },

    /**
     * Get default configuration for a provider or fallback to system defaults
     */
    async getDefaultConfig(provider: string): Promise<ModelConfig | null> {
      try {
        // First try to get user-defined default
        let config = await repository.getDefaultForProvider(provider)

        // If no default found, use system defaults based on provider
        if (!config) {
          const systemDefaults = await this.getSystemDefaults()
          config = systemDefaults[provider] || null
        }

        logger.info('Retrieved default configuration', { provider, found: !!config })
        return config
      } catch (error) {
        logger.error('Failed to retrieve default configuration', { provider, error })
        throw ErrorFactory.operationFailed(
          'getDefaultConfig',
          `Failed to retrieve default configuration for ${provider}`
        )
      }
    },

    /**
     * Get configuration by name (e.g., 'low', 'medium', 'high')
     */
    async getConfigByName(name: string): Promise<ModelConfig | null> {
      try {
        const config = await repository.getByName(name)
        logger.info('Retrieved configuration by name', { name, found: !!config })
        return config
      } catch (error) {
        logger.error('Failed to retrieve configuration by name', { name, error })
        throw ErrorFactory.operationFailed('getConfigByName', `Failed to retrieve configuration by name: ${name}`)
      }
    },

    /**
     * Get preset configuration with caching and fallback support
     * This is the primary method for retrieving preset configs throughout the app
     */
    async getPresetConfig(presetName: 'low' | 'medium' | 'high' | 'planning'): Promise<ModelConfig> {
      // Check cache first
      const cached = presetConfigCache.get(presetName)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug('Returning cached preset config', { presetName })
        return cached.config
      }

      try {
        // Try to get from database
        const config = await repository.getByName(presetName)

        if (config) {
          // Update cache
          presetConfigCache.set(presetName, { config, timestamp: Date.now() })
          logger.info('Retrieved preset config from database', { presetName })
          return config
        }

        // Fall back to static config if not in database
        logger.warn('Preset not found in database, using static fallback', { presetName })
        const fallback = STATIC_FALLBACKS[presetName]
        if (!fallback) {
          throw ErrorFactory.notFound('Preset configuration', presetName)
        }
        return fallback
      } catch (error) {
        // If database is unavailable, use static fallback
        logger.error('Failed to retrieve preset config, using static fallback', { presetName, error })
        const fallback = STATIC_FALLBACKS[presetName]
        if (!fallback) {
          throw ErrorFactory.notFound('Preset configuration', presetName)
        }
        return fallback
      }
    },

    /**
     * Clear the preset config cache
     */
    clearPresetCache(presetName?: string): void {
      if (presetName) {
        presetConfigCache.delete(presetName)
        logger.info('Cleared preset cache', { presetName })
      } else {
        presetConfigCache.clear()
        logger.info('Cleared all preset caches')
      }
    },

    /**
     * Get configuration by ID
     */
    async getConfigById(id: number): Promise<ModelConfig | null> {
      try {
        const config = await repository.getById(id)
        if (!config) {
          logger.warn('Configuration not found', { id })
          return null
        }
        return config
      } catch (error) {
        logger.error('Failed to retrieve configuration', { id, error })
        throw ErrorFactory.operationFailed('getConfigById', `Failed to retrieve configuration with ID: ${id}`)
      }
    },

    /**
     * Create a new model configuration
     */
    async createConfig(data: CreateModelConfig): Promise<ModelConfig> {
      try {
        // Validate name uniqueness
        if (await repository.nameExists(data.name)) {
          throw ErrorFactory.alreadyExists('Configuration', 'name', data.name)
        }

        // If setting as default, unset other defaults for this provider
        if (data.isDefault) {
          await this.clearDefaultForProvider(data.provider)
        }

        const config = await repository.create(data)
        logger.info('Created model configuration', { id: config.id, name: config.name })
        return config
      } catch (error) {
        if (error instanceof ApiError) throw error
        logger.error('Failed to create model configuration', { data, error })
        throw ErrorFactory.createFailed('Configuration', 'Database operation failed')
      }
    },

    /**
     * Update a model configuration
     */
    async updateConfig(id: number, data: UpdateModelConfig): Promise<ModelConfig> {
      try {
        // Check if configuration exists
        const existing = await repository.getById(id)
        if (!existing) {
          throw ErrorFactory.notFound('Configuration', id.toString())
        }

        // Validate name uniqueness if changing name
        if (data.name && data.name !== existing.name) {
          if (await repository.nameExists(data.name, id)) {
            throw ErrorFactory.alreadyExists('Configuration', 'name', data.name)
          }
        }

        // If setting as default, unset other defaults for this provider
        if (data.isDefault && !existing.isDefault) {
          await this.clearDefaultForProvider(data.provider || existing.provider)
        }

        const updated = await repository.update(id, data)
        if (!updated) {
          throw ErrorFactory.updateFailed('Configuration', id, 'Database operation failed')
        }

        // Clear cache if this is a preset
        if (['low', 'medium', 'high', 'planning'].includes(updated.name)) {
          this.clearPresetCache(updated.name)
        }

        logger.info('Updated model configuration', { id, changes: Object.keys(data) })
        return updated
      } catch (error) {
        if (error instanceof ApiError) throw error
        logger.error('Failed to update model configuration', { id, data, error })
        throw ErrorFactory.updateFailed('Configuration', id, 'Database operation failed')
      }
    },

    /**
     * Delete a model configuration
     */
    async deleteConfig(id: number, hard = false): Promise<boolean> {
      try {
        const config = await repository.getById(id)
        if (!config) {
          throw ErrorFactory.notFound('Configuration', id.toString())
        }

        // Don't allow deletion of system presets
        if (config.isSystemPreset && hard) {
          throw ErrorFactory.invalidInput('preset', 'Cannot delete system presets')
        }

        const success = hard ? await repository.hardDelete(id) : await repository.softDelete(id)

        logger.info('Deleted model configuration', { id, hard, success })
        return success
      } catch (error) {
        if (error instanceof ApiError) throw error
        logger.error('Failed to delete model configuration', { id, error })
        throw ErrorFactory.deleteFailed('Configuration', id, 'Database operation failed')
      }
    },

    /**
     * Set default configuration for a provider
     */
    async setDefaultConfig(configId: number, provider: string): Promise<boolean> {
      try {
        const success = await repository.setDefaultForProvider(configId, provider)
        logger.info('Set default configuration', { configId, provider, success })
        return success
      } catch (error) {
        logger.error('Failed to set default configuration', { configId, provider, error })
        throw ErrorFactory.updateFailed('Configuration', configId, 'Failed to set as default')
      }
    },

    // ==================== Model Presets ====================

    /**
     * Get all presets with their configurations
     */
    async getAllPresets(): Promise<(ModelPreset & { config: ModelConfig })[]> {
      try {
        const presets = await presetRepository.getAllWithConfigs()
        logger.info('Retrieved all presets', { count: presets.length })
        return presets
      } catch (error) {
        logger.error('Failed to retrieve presets', { error })
        throw ErrorFactory.operationFailed('getAllPresets', 'Failed to retrieve presets')
      }
    },

    /**
     * Get presets by category
     */
    async getPresetsByCategory(category: string): Promise<ModelPreset[]> {
      try {
        const presets = await presetRepository.getByCategory(category)
        logger.info('Retrieved presets by category', { category, count: presets.length })
        return presets
      } catch (error) {
        logger.error('Failed to retrieve presets by category', { category, error })
        throw ErrorFactory.operationFailed(
          'getPresetsByCategory',
          `Failed to retrieve presets for category: ${category}`
        )
      }
    },

    /**
     * Get preset with its configuration
     */
    async getPresetWithConfig(id: number): Promise<(ModelPreset & { config: ModelConfig }) | null> {
      try {
        const preset = await presetRepository.getWithConfig(id)
        logger.info('Retrieved preset with config', { id, found: !!preset })
        return preset
      } catch (error) {
        logger.error('Failed to retrieve preset', { id, error })
        throw ErrorFactory.operationFailed('getPresetWithConfig', `Failed to retrieve preset with ID: ${id}`)
      }
    },

    /**
     * Create a new preset
     */
    async createPreset(data: CreateModelPreset): Promise<ModelPreset> {
      try {
        // Validate configuration exists
        const config = await repository.getById(data.configId)
        if (!config) {
          throw ErrorFactory.notFound('Configuration', data.configId.toString())
        }

        // Validate name uniqueness
        if (await presetRepository.nameExists(data.name)) {
          throw ErrorFactory.alreadyExists('Preset', 'name', data.name)
        }

        const preset = await presetRepository.create(data)
        logger.info('Created preset', { id: preset.id, name: preset.name })
        return preset
      } catch (error) {
        if (error instanceof ApiError) throw error
        logger.error('Failed to create preset', { data, error })
        throw ErrorFactory.createFailed('Preset', 'Database operation failed')
      }
    },

    /**
     * Update a preset
     */
    async updatePreset(id: number, data: UpdateModelPreset): Promise<ModelPreset> {
      try {
        const existing = await presetRepository.getById(id)
        if (!existing) {
          throw ErrorFactory.notFound('Preset', id.toString())
        }

        // Validate name uniqueness if changing
        if (data.name && data.name !== existing.name) {
          if (await presetRepository.nameExists(data.name, id)) {
            throw ErrorFactory.alreadyExists('Preset', 'name', data.name)
          }
        }

        const updated = await presetRepository.update(id, data)
        if (!updated) {
          throw ErrorFactory.updateFailed('Preset', id, 'Database operation failed')
        }

        logger.info('Updated preset', { id, changes: Object.keys(data) })
        return updated
      } catch (error) {
        if (error instanceof ApiError) throw error
        logger.error('Failed to update preset', { id, data, error })
        throw ErrorFactory.updateFailed('Preset', id, 'Database operation failed')
      }
    },

    /**
     * Delete a preset
     */
    async deletePreset(id: number, hard = false): Promise<boolean> {
      try {
        const preset = await presetRepository.getById(id)
        if (!preset) {
          throw ErrorFactory.notFound('Preset', id.toString())
        }

        // Don't allow deletion of system presets
        if (preset.isSystemPreset && hard) {
          throw ErrorFactory.invalidInput('preset', 'Cannot delete system presets')
        }

        const success = hard ? await presetRepository.hardDelete(id) : await presetRepository.softDelete(id)

        logger.info('Deleted preset', { id, hard, success })
        return success
      } catch (error) {
        if (error instanceof ApiError) throw error
        logger.error('Failed to delete preset', { id, error })
        throw ErrorFactory.deleteFailed('Preset', id, undefined, { error })
      }
    },

    /**
     * Use a preset (increment usage count)
     */
    async usePreset(id: number): Promise<boolean> {
      try {
        const success = await presetRepository.incrementUsage(id)
        logger.info('Preset used', { id, success })
        return success
      } catch (error) {
        logger.error('Failed to update preset usage', { id, error })
        // Don't throw - this is not critical
        return false
      }
    },

    /**
     * Get most used presets
     */
    async getMostUsedPresets(limit = 5): Promise<ModelPreset[]> {
      try {
        const presets = await presetRepository.getMostUsed(limit)
        logger.info('Retrieved most used presets', { limit, count: presets.length })
        return presets
      } catch (error) {
        logger.error('Failed to retrieve most used presets', { error })
        throw ErrorFactory.operationFailed('getMostUsedPresets', 'Failed to retrieve most used presets')
      }
    },

    /**
     * Get recently used presets
     */
    async getRecentlyUsedPresets(limit = 5): Promise<ModelPreset[]> {
      try {
        const presets = await presetRepository.getRecentlyUsed(limit)
        logger.info('Retrieved recently used presets', { limit, count: presets.length })
        return presets
      } catch (error) {
        logger.error('Failed to retrieve recently used presets', { error })
        throw ErrorFactory.operationFailed('getRecentlyUsedPresets', 'Failed to retrieve recently used presets')
      }
    },

    // ==================== System Defaults ====================

    /**
     * Initialize system default configurations
     * This should be called during application startup or migration
     */
    async initializeSystemDefaults(): Promise<void> {
      try {
        const systemConfigs = [
          {
            name: 'low',
            displayName: 'Low - Fast & Efficient',
            ...LOW_MODEL_CONFIG,
            isSystemPreset: true,
            isDefault: false,
            isActive: true,
            description: 'Optimized for speed and efficiency with smaller models'
          },
          {
            name: 'medium',
            displayName: 'Medium - Balanced',
            ...MEDIUM_MODEL_CONFIG,
            isSystemPreset: true,
            isDefault: false,
            isActive: true,
            description: 'Balanced performance and quality for general use'
          },
          {
            name: 'high',
            displayName: 'High - Best Quality',
            ...HIGH_MODEL_CONFIG,
            isSystemPreset: true,
            isDefault: false,
            isActive: true,
            description: 'Maximum quality with larger, more capable models'
          }
        ]

        for (const config of systemConfigs) {
          // Check if already exists
          const existing = await repository.getByName(config.name)
          if (!existing) {
            await repository.create(config as CreateModelConfig)
            logger.info('Created system default configuration', { name: config.name })
          } else {
            logger.info('System default configuration already exists', { name: config.name })
          }
        }

        logger.info('Initialized system default configurations')
      } catch (error) {
        logger.error('Failed to initialize system defaults', { error })
        throw ErrorFactory.operationFailed('initializeSystemDefaults', 'Failed to initialize system defaults')
      }
    },

    /**
     * Get system default configurations mapped by provider
     */
    async getSystemDefaults(): Promise<Record<string, ModelConfig>> {
      try {
        const configs = await repository.getSystemPresets()
        const defaults: Record<string, ModelConfig> = {}

        for (const config of configs) {
          if (!defaults[config.provider]) {
            defaults[config.provider] = config
          }
        }

        return defaults
      } catch (error) {
        logger.error('Failed to retrieve system defaults', { error })
        throw ErrorFactory.operationFailed('getSystemDefaults', 'Failed to retrieve system defaults')
      }
    },

    // ==================== Helper Methods ====================

    /**
     * Clear default flag for all configurations of a provider
     */
    async clearDefaultForProvider(provider: string): Promise<void> {
      const configs = await repository.getByProvider(provider)
      for (const config of configs) {
        if (config.isDefault) {
          await repository.update(config.id, { isDefault: false })
        }
      }
    },

    /**
     * Export configurations and presets
     */
    async exportConfigurations(): Promise<{ configs: ModelConfig[]; presets: ModelPreset[] }> {
      try {
        const configs = await repository.getAll()
        const presets = await presetRepository.getAllPresets()

        logger.info('Exported configurations', { configCount: configs.length, presetCount: presets.length })

        return { configs, presets }
      } catch (error) {
        logger.error('Failed to export configurations', { error })
        throw ErrorFactory.operationFailed('exportConfigurations', 'Failed to export configurations')
      }
    },

    /**
     * Import configurations and presets
     */
    async importConfigurations(data: {
      configs?: CreateModelConfig[]
      presets?: CreateModelPreset[]
    }): Promise<{ configsImported: number; presetsImported: number }> {
      try {
        let configsImported = 0
        let presetsImported = 0

        // Import configurations first
        if (data.configs) {
          for (const config of data.configs) {
            try {
              await this.createConfig(config)
              configsImported++
            } catch (error) {
              logger.warn('Failed to import configuration', { name: config.name, error })
            }
          }
        }

        // Then import presets
        if (data.presets) {
          for (const preset of data.presets) {
            try {
              await this.createPreset(preset)
              presetsImported++
            } catch (error) {
              logger.warn('Failed to import preset', { name: preset.name, error })
            }
          }
        }

        logger.info('Imported configurations', { configsImported, presetsImported })
        return { configsImported, presetsImported }
      } catch (error) {
        logger.error('Failed to import configurations', { error })
        throw ErrorFactory.operationFailed('importConfigurations', 'Failed to import configurations')
      }
    }
  }
}

// Export singleton instance
export const modelConfigService = createModelConfigService()
