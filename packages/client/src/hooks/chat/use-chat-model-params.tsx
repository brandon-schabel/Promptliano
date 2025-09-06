import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { AiSdkOptions } from '@promptliano/schemas'
import { useCallback, useMemo, useEffect } from 'react'
import { APIProviders } from '@promptliano/database'
import { modelsTempNotAllowed } from '@promptliano/schemas'
import { useModelConfigPresets, type PresetCategory } from '@/hooks/use-model-presets'

type ModelParamMutationFn = (value: number) => void

export function useChatModelParams() {
  const [settings, updateSettings] = useAppSettings()
  const { presets, getPresetConfig, defaultPreset } = useModelConfigPresets()

  const { temperature, maxTokens, topP, frequencyPenalty, presencePenalty, model, provider, selectedPreset } = settings

  // Initialize preset if not set
  useEffect(() => {
    if (!selectedPreset && defaultPreset && presets) {
      updateSettings({ selectedPreset: defaultPreset })
    }
  }, [selectedPreset, defaultPreset, presets, updateSettings])

  const isTempDisabled = useMemo(() => {
    if (!model) return false
    return modelsTempNotAllowed.some((m) => model.includes(m))
  }, [model])

  const setTemperature: ModelParamMutationFn = useCallback(
    (value) => {
      if (isTempDisabled) return
      updateSettings({ temperature: value })
    },
    [isTempDisabled, updateSettings]
  )

  const setMaxTokens: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ maxTokens: value })
    },
    [updateSettings]
  )

  const setTopP: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ topP: value })
    },
    [updateSettings]
  )

  const setFreqPenalty: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ frequencyPenalty: value })
    },
    [updateSettings]
  )

  const setPresPenalty: ModelParamMutationFn = useCallback(
    (value) => {
      updateSettings({ presencePenalty: value })
    },
    [updateSettings]
  )

  const setModel = useCallback(
    (value: string) => {
      updateSettings({ model: value })
    },
    [updateSettings]
  )

  const setProvider = useCallback(
    (value: APIProviders) => {
      updateSettings({ provider: value })
    },
    [updateSettings]
  )

  const setPreset = useCallback(
    (preset: PresetCategory) => {
      const presetConfig = getPresetConfig(preset)
      if (presetConfig) {
        // Apply all settings from the preset
        updateSettings({
          selectedPreset: preset,
          provider: presetConfig.provider as APIProviders,
          model: presetConfig.model,
          temperature: presetConfig.temperature ?? 0.7,
          maxTokens: presetConfig.maxTokens ?? 10000,
          topP: presetConfig.topP ?? 1.0,
          frequencyPenalty: presetConfig.frequencyPenalty ?? 0,
          presencePenalty: presetConfig.presencePenalty ?? 0
        })
      }
    },
    [getPresetConfig, updateSettings]
  )

  const modelSettings: AiSdkOptions = useMemo(
    () => ({
      temperature: temperature ?? 0.7,
      topP: topP ?? 0.9,
      frequencyPenalty: frequencyPenalty ?? 0,
      presencePenalty: presencePenalty ?? 0,
      maxTokens: maxTokens ?? 10000,
      model: model ?? 'google/gemini-2.5-flash-preview',
      provider: provider ?? 'openrouter'
    }),
    [temperature, topP, frequencyPenalty, presencePenalty, maxTokens, model, provider]
  )

  return {
    settings: modelSettings as AiSdkOptions & {
      provider: string
    },
    setTemperature,
    setMaxTokens,
    setTopP,
    setFreqPenalty,
    setPresPenalty,
    isTempDisabled,
    setModel,
    setProvider,
    setPreset,
    selectedPreset: selectedPreset as PresetCategory | undefined
  }
}
