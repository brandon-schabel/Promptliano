import { useMemo } from 'react'
import { useModelConfigs } from '@/hooks/generated/model-config-hooks'
import type { ModelConfig } from '@promptliano/database'

export type PresetCategory = 'low' | 'medium' | 'high' | 'planning'

export interface ModelPresetConfig extends ModelConfig {
  presetKey: PresetCategory
}

/**
 * Hook to fetch and manage model preset configurations from backend
 */
export function useModelConfigPresets() {
  const { data: configs, isLoading, error, refetch } = useModelConfigs()

  // Filter and transform configs that have preset categories
  const presets = useMemo(() => {
    if (!configs) return null

    const presetConfigs: Record<PresetCategory, ModelPresetConfig | null> = {
      low: null,
      medium: null,
      high: null,
      planning: null
    }

    // Filter configs that have a preset category and are system presets
    const systemPresets = configs.filter(
      (c: ModelConfig) =>
        c.isSystemPreset && c.presetCategory && ['low', 'medium', 'high', 'planning'].includes(c.presetCategory)
    )

    // Map configs to their preset categories
    systemPresets.forEach((config: ModelConfig) => {
      const category = config.presetCategory as PresetCategory
      if (category && !presetConfigs[category]) {
        presetConfigs[category] = {
          ...config,
          presetKey: category
        }
      }
    })

    return presetConfigs
  }, [configs])

  // Get a specific preset config
  const getPresetConfig = (preset: PresetCategory): ModelPresetConfig | null => {
    return presets?.[preset] || null
  }

  // Get the default preset (the one marked as isDefault or 'medium' as fallback)
  const defaultPreset = useMemo(() => {
    if (!presets) return 'medium' as PresetCategory

    // Find the preset marked as default
    const defaultConfig = Object.entries(presets).find(([_, config]) => config?.isDefault)
    if (defaultConfig) {
      return defaultConfig[0] as PresetCategory
    }

    // Fallback to medium if it exists, otherwise first available
    if (presets.medium) return 'medium' as PresetCategory

    const firstAvailable = Object.entries(presets).find(([_, config]) => config !== null)
    return (firstAvailable?.[0] || 'medium') as PresetCategory
  }, [presets])

  return {
    presets,
    getPresetConfig,
    defaultPreset,
    isLoading,
    error,
    refetch
  }
}
