import { useCallback, useState, useEffect, useMemo } from 'react'
import type { APIProviders } from '@promptliano/database'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { useGetModels } from '@/hooks/generated'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { validateModelsArray, type ValidatedModelData, extractErrorMessage } from '@/utils/type-guards'

export interface UseModelSelectionOptions {
  defaultProvider?: APIProviders
  defaultModel?: string
  persistenceKey?: string
  onProviderChange?: (provider: APIProviders) => void
  onModelChange?: (model: string) => void
}

export interface UseModelSelectionReturn {
  provider: APIProviders
  model: string
  setProvider: (provider: APIProviders) => void
  setModel: (model: string) => void
  isLoadingModels: boolean
  availableModels: ValidatedModelData[]
}

/**
 * Hook for managing provider and model selection with optional persistence
 */
export function useModelSelection(options: UseModelSelectionOptions = {}): UseModelSelectionReturn {
  const { defaultProvider = 'openrouter', defaultModel = '', persistenceKey, onProviderChange, onModelChange } = options

  // Use local storage if persistence key is provided, otherwise use state
  const [provider, setProviderInternal] = persistenceKey
    ? useLocalStorage<APIProviders>(`${persistenceKey}_provider`, defaultProvider)
    : useState<APIProviders>(defaultProvider)

  const [model, setModelInternal] = persistenceKey
    ? useLocalStorage<string>(`${persistenceKey}_model`, defaultModel)
    : useState<string>(defaultModel)

  // Get app settings for provider URLs
  const [appSettings] = useAppSettings()

  // Prepare URL options based on provider
  const urlOptions = {
    ...(provider === 'ollama' && appSettings.ollamaGlobalUrl ? { ollamaUrl: appSettings.ollamaGlobalUrl } : {}),
    ...(provider === 'lmstudio' && appSettings.lmStudioGlobalUrl ? { lmstudioUrl: appSettings.lmStudioGlobalUrl } : {})
  }

  // Fetch available models for the current provider
  const { data: modelsData, isLoading: isLoadingModels } = useGetModels(provider, urlOptions)

  const availableModels: ValidatedModelData[] = useMemo(() => {
    if (!modelsData || !Array.isArray(modelsData)) {
      return []
    }

    try {
      const validationResult = validateModelsArray(modelsData)

      if (!validationResult.success) {
        console.warn(`Model data validation failed: ${validationResult.error} at ${validationResult.path}`)
        return []
      }

      return validationResult.data
    } catch (error) {
      console.error('Error validating model data:', extractErrorMessage(error))
      return []
    }
  }, [modelsData])

  // Auto-select first model when provider changes
  useEffect(() => {
    if (availableModels.length > 0) {
      const isCurrentModelValid = availableModels.some((m: ValidatedModelData) => m.id === model)
      if (!model || !isCurrentModelValid) {
        const firstModelId = availableModels[0].id
        setModelInternal(firstModelId)
        onModelChange?.(firstModelId)
      }
    }
  }, [availableModels, model, setModelInternal, onModelChange])

  const setProvider = useCallback(
    (newProvider: APIProviders) => {
      setProviderInternal(newProvider)
      onProviderChange?.(newProvider)
      // Clear model when provider changes to trigger auto-selection
      setModelInternal('')
    },
    [setProviderInternal, setModelInternal, onProviderChange]
  )

  const setModel = useCallback(
    (newModel: string) => {
      setModelInternal(newModel)
      onModelChange?.(newModel)
    },
    [setModelInternal, onModelChange]
  )

  return {
    provider,
    model,
    setProvider,
    setModel,
    isLoadingModels,
    availableModels
  }
}
