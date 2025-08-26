import { useCallback, useEffect, useMemo } from 'react'
import type { APIProviders, ProviderKey } from '@promptliano/database'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { PromptlianoCombobox } from '@/components/promptliano/promptliano-combobox'
import { useGetModels, useGetProviders } from '@/hooks/api-hooks'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import {
  isValidProviderKey,
  isValidModelsResponse,
  validateModelsArray,
  type ValidatedModelData,
  extractErrorMessage
} from '@/utils/type-guards'

// Reuse validated types from type guards
interface ComboboxOption {
  value: string
  label: string
}

export interface ProviderModelSelectorProps {
  provider: APIProviders | string // Allow custom provider IDs like "custom_123"
  currentModel: string
  onProviderChange: (provider: APIProviders | string) => void
  onModelChange: (modelId: string) => void
  className?: string
  layout?: 'horizontal' | 'vertical' | 'compact'
  disabled?: boolean
  showLabels?: boolean
  providerClassName?: string
  modelClassName?: string
  filterProviders?: APIProviders[]
  filterModels?: (model: ValidatedModelData) => boolean
}

export function ProviderModelSelector({
  provider,
  currentModel,
  onProviderChange,
  onModelChange,
  className,
  layout = 'horizontal',
  disabled = false,
  showLabels = false,
  providerClassName,
  modelClassName,
  filterProviders,
  filterModels
}: ProviderModelSelectorProps) {
  // Get app settings for provider URLs
  const [appSettings] = useAppSettings()

  // Get all available providers (predefined + custom)
  const { data: providersData } = useGetProviders()

  // Prepare URL options based on provider
  const urlOptions = {
    ...(provider === 'ollama' && appSettings.ollamaGlobalUrl ? { ollamaUrl: appSettings.ollamaGlobalUrl } : {}),
    ...(provider === 'lmstudio' && appSettings.lmStudioGlobalUrl ? { lmstudioUrl: appSettings.lmStudioGlobalUrl } : {})
  }

  const { data: modelsData, isLoading: isLoadingModels } = useGetModels(provider, urlOptions)

  // Prepare provider options from API response
  const availableProviders = useMemo(() => {
    if (!providersData) {
      // Fallback to predefined providers if API hasn't loaded yet
      return [
        { value: 'openai', label: 'OpenAI' },
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'google_gemini', label: 'Google Gemini' },
        { value: 'groq', label: 'Groq' },
        { value: 'together', label: 'Together' },
        { value: 'xai', label: 'XAI' },
        { value: 'openrouter', label: 'OpenRouter' },
        { value: 'lmstudio', label: 'LMStudio' },
        { value: 'ollama', label: 'Ollama' }
      ]
    }

    // Validate and transform provider data with type safety
    const allProviders = (Array.isArray(providersData) ? providersData : []).filter(isValidProviderKey).map(
      (p: ProviderKey): ComboboxOption => ({
        value: p.id?.toString() || p.provider,
        label: p.name || p.provider
      })
    )

    // Apply filter if specified
    if (filterProviders && filterProviders.length > 0) {
      return allProviders.filter((option: ComboboxOption) => filterProviders.includes(option.value as APIProviders))
    }

    return allProviders
  }, [providersData, filterProviders])

  // Prepare model options with comprehensive validation
  const comboboxOptions = useMemo((): ComboboxOption[] => {
    if (!modelsData || !Array.isArray(modelsData)) {
      return []
    }

    try {
      // Use comprehensive validation with detailed error handling
      const validationResult = validateModelsArray(modelsData)

      if (!validationResult.success) {
        console.warn(`Model data validation failed: ${validationResult.error} at ${validationResult.path}`)
        return []
      }

      let filteredModels = validationResult.data

      if (filterModels) {
        filteredModels = filteredModels.filter(filterModels)
      }

      return filteredModels.map(
        (m: ValidatedModelData): ComboboxOption => ({
          value: m.id,
          label: m.name
        })
      )
    } catch (error) {
      console.error('Error processing model data:', extractErrorMessage(error))
      return []
    }
  }, [modelsData, filterModels])

  // Auto-select first model when provider changes or current model is invalid
  useEffect(() => {
    const isCurrentModelValid = comboboxOptions.some((model: ComboboxOption) => model.value === currentModel)
    if ((!currentModel || !isCurrentModelValid) && comboboxOptions.length > 0) {
      onModelChange(comboboxOptions[0].value)
    }
  }, [comboboxOptions, currentModel, onModelChange])

  const handleModelChange = useCallback(
    (value: string | null) => {
      if (value !== null) {
        onModelChange(value)
      }
    },
    [onModelChange]
  )

  const containerClassName = cn(
    'flex gap-4',
    layout === 'vertical' && 'flex-col',
    layout === 'compact' && 'gap-2',
    className
  )

  const providerSelectClassName = cn('w-full', layout === 'compact' && 'min-w-[120px]', providerClassName)

  const modelComboboxClassName = cn('w-full min-w-[150px]', layout === 'compact' && 'min-w-[120px]', modelClassName)

  return (
    <div className={containerClassName}>
      {showLabels && layout === 'vertical' && <label className='text-sm font-medium'>Provider</label>}
      <Select value={provider} onValueChange={(val) => onProviderChange(val)} disabled={disabled}>
        <SelectTrigger className={providerSelectClassName}>
          <SelectValue placeholder='Select provider' />
        </SelectTrigger>
        <SelectContent>
          {availableProviders.map((option: ComboboxOption) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showLabels && layout === 'vertical' && <label className='text-sm font-medium'>Model</label>}
      <PromptlianoCombobox
        options={comboboxOptions}
        value={currentModel}
        onValueChange={handleModelChange}
        placeholder={isLoadingModels ? 'Loading...' : comboboxOptions.length === 0 ? 'No models' : 'Select model'}
        searchPlaceholder='Search models...'
        className={modelComboboxClassName}
        popoverClassName='w-[300px]'
        disabled={disabled || isLoadingModels || comboboxOptions.length === 0}
      />
    </div>
  )
}
