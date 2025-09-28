import { useMemo } from 'react'
import { useModelConfigs } from '@/hooks/generated/model-config-hooks'
import type { ModelConfig } from '@promptliano/database'

export type PresetCategory = 'low' | 'medium' | 'high' | 'planning'

export interface ModelPresetConfig extends ModelConfig {
  presetKey: PresetCategory
}

const PRESET_KEYS: PresetCategory[] = ['low', 'medium', 'high', 'planning']

const FALLBACK_PRESET_META: Record<
  PresetCategory,
  { displayName: string; description: string; uiIcon: string; uiColor: string; uiOrder: number }
> = {
  low: {
    displayName: 'Low - Fast & Efficient',
    description: 'Optimized for speed and efficiency with smaller models',
    uiIcon: 'Zap',
    uiColor: 'text-green-500',
    uiOrder: 0
  },
  medium: {
    displayName: 'Medium - Balanced',
    description: 'Balanced performance and quality for general use',
    uiIcon: 'Gauge',
    uiColor: 'text-blue-500',
    uiOrder: 1
  },
  high: {
    displayName: 'High - Best Quality',
    description: 'Maximum quality with larger, more capable models',
    uiIcon: 'Rocket',
    uiColor: 'text-purple-500',
    uiOrder: 2
  },
  planning: {
    displayName: 'Planning - Long Context',
    description: 'High context models tuned for planning-heavy tasks',
    uiIcon: 'Brain',
    uiColor: 'text-orange-500',
    uiOrder: 3
  }
}

const FALLBACK_PRESET_BASES: Record<PresetCategory, Partial<ModelConfig>> = {
  low: {
    provider: 'lmstudio',
    model: 'unsloth-qwen3-coder-30b-a3b-instruct-qx4-mlx',
    temperature: 0.7,
    maxTokens: 32000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  medium: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 25000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  high: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro',
    temperature: 0.7,
    maxTokens: 200000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  planning: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 200000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
}

const FALLBACK_PRESET_CONFIGS: Record<PresetCategory, ModelPresetConfig> = PRESET_KEYS.reduce(
  (acc, key, index) => {
    const base = FALLBACK_PRESET_BASES[key] || {}
    const meta = FALLBACK_PRESET_META[key]

    acc[key] = {
      id: -(index + 1),
      name: key,
      displayName: meta.displayName,
      provider: base.provider ?? 'openrouter',
      model: base.model ?? 'google/gemini-2.5-flash',
      temperature: base.temperature ?? 0.7,
      maxTokens: base.maxTokens ?? 4096,
      topP: base.topP ?? 1,
      topK: base.topK ?? 0,
      frequencyPenalty: base.frequencyPenalty ?? 0,
      presencePenalty: base.presencePenalty ?? 0,
      responseFormat: base.responseFormat ?? null,
      systemPrompt: base.systemPrompt ?? null,
      isSystemPreset: true,
      isDefault: key === 'medium',
      isActive: true,
      description: meta.description,
      presetCategory: key,
      uiIcon: meta.uiIcon,
      uiColor: meta.uiColor,
      uiOrder: meta.uiOrder,
      createdAt: 0,
      updatedAt: 0,
      presetKey: key
    }

    return acc
  },
  {} as Record<PresetCategory, ModelPresetConfig>
)

/**
 * Hook to fetch and manage model preset configurations from backend
 */
export function useModelConfigPresets() {
  const { data: configs, isLoading, error, refetch } = useModelConfigs()

  // Filter and transform configs that have preset categories
  const presets = useMemo(() => {
    const presetConfigs: Partial<Record<PresetCategory, ModelPresetConfig>> = {}

    if (Array.isArray(configs) && configs.length > 0) {
      const systemPresets = configs.filter(
        (c: ModelConfig) =>
          c.isSystemPreset && c.presetCategory && PRESET_KEYS.includes(c.presetCategory as PresetCategory)
      )

      systemPresets.forEach((config: ModelConfig) => {
        const category = config.presetCategory as PresetCategory | undefined
        if (!category || presetConfigs[category]) return

        presetConfigs[category] = {
          ...config,
          presetKey: category
        }
      })
    }

    const resolvedPresets = PRESET_KEYS.reduce((acc, key) => {
      const preset = presetConfigs[key] ?? { ...FALLBACK_PRESET_CONFIGS[key] }
      acc[key] = { ...preset, presetKey: key }
      return acc
    }, {} as Record<PresetCategory, ModelPresetConfig>)

    return resolvedPresets
  }, [configs])

  // Get a specific preset config
  const getPresetConfig = (preset: PresetCategory): ModelPresetConfig | null => {
    return presets?.[preset] ? { ...presets[preset] } : null
  }

  // Get the default preset (the one marked as isDefault or 'medium' as fallback)
  const defaultPreset = useMemo(() => {
    if (!presets) return 'medium' as PresetCategory

    const defaultConfig = Object.entries(presets).find(([, config]) => config.isDefault)
    if (defaultConfig) {
      return defaultConfig[0] as PresetCategory
    }

    if (presets.medium) return 'medium' as PresetCategory

    const firstAvailable = Object.entries(presets).find(([, config]) => !!config)
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
