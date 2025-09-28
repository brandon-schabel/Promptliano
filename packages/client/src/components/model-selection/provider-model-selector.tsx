import { useCallback, useEffect, useMemo } from 'react'
import type { APIProviders } from '@promptliano/database'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { PromptlianoCombobox } from '@/components/promptliano/promptliano-combobox'
import { useGetModels, useGetProviders } from '@/hooks/generated'
import { useServerConnection } from '@/hooks/use-server-connection'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import {
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
  showProviderSelect?: boolean // Optional prop to show/hide provider select
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
  const { isConnected } = useServerConnection()

  // Prepare provider options from API response
  const { providerOptions, missingConfiguredProviders, providersLoaded } = useMemo(() => {
    const defaultOptions: ComboboxOption[] = [
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

    const applyFilter = (options: ComboboxOption[]) => {
      if (filterProviders && filterProviders.length > 0) {
        return options.filter((option) => filterProviders.includes(option.value as APIProviders))
      }
      return options
    }

    if (!providersData) {
      return {
        providerOptions: applyFilter(defaultOptions),
        missingConfiguredProviders: [] as string[],
        providersLoaded: false
      }
    }

    const rawProviders: any[] = Array.isArray(providersData)
      ? providersData
      : Array.isArray((providersData as any)?.data)
        ? ((providersData as any).data as any[])
        : []

    if (!Array.isArray(rawProviders) || rawProviders.length === 0) {
      return {
        providerOptions: [] as ComboboxOption[],
        missingConfiguredProviders: [] as string[],
        providersLoaded: true
      }
    }

    const missing: string[] = []
    const normalizedOptions: ComboboxOption[] = []

    for (const raw of rawProviders) {
      const value = typeof raw?.id !== 'undefined' ? String(raw.id) : raw?.provider
      const label = raw?.name || raw?.provider || (typeof value === 'string' ? value : '')
      if (!value || !label) continue

      const requiresConfiguration = Boolean(raw?.requiresConfiguration)
      const isConfigured = raw?.configured !== false

      if (requiresConfiguration && !isConfigured) {
        missing.push(label)
        continue
      }

      normalizedOptions.push({ value, label })
    }

    return {
      providerOptions: applyFilter(normalizedOptions),
      missingConfiguredProviders: missing,
      providersLoaded: true
    }
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

  // Auto-select first model only when no current model is set
  // Avoid overriding an explicitly provided model (e.g., from a preset)
  useEffect(() => {
    if ((!currentModel || currentModel === '') && comboboxOptions.length > 0) {
      onModelChange(comboboxOptions[0].value)
    }
  }, [comboboxOptions, currentModel, onModelChange])

  useEffect(() => {
    if (!providersLoaded) return
    if (providerOptions.length === 0) return
    const hasCurrent = providerOptions.some((option) => option.value === provider)
    if (!hasCurrent) {
      onProviderChange(providerOptions[0].value)
    }
  }, [providersLoaded, providerOptions, provider, onProviderChange])

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

  const providerSelectClassName = cn('w-full', providerClassName)
  const modelComboboxClassName = cn('w-full min-w-[150px]', modelClassName)

  const providerWrapperClassName = cn(
    'flex flex-col gap-1',
    layout !== 'vertical' && 'flex-1',
    layout === 'horizontal' && 'min-w-[200px]',
    layout === 'compact' && 'min-w-[120px]'
  )

  const modelWrapperClassName = cn('flex flex-col gap-1', layout !== 'vertical' && 'flex-1')

  const providerSelectDisabled = disabled || providerOptions.length === 0
  const providerPlaceholder = providerOptions.length > 0
    ? 'Select provider'
    : providersLoaded
      ? 'Configure a provider in Settings'
      : 'Loading providers...'

  const selectedProviderValue = providerOptions.some((option) => option.value === provider)
    ? provider
    : undefined

  const missingProvidersText = missingConfiguredProviders.join(', ')

  return (
    <div className={containerClassName}>
      <div className={providerWrapperClassName}>
        {showLabels && layout === 'vertical' && <label className='text-sm font-medium'>Provider</label>}
        <Select
          value={selectedProviderValue}
          onValueChange={(val) => onProviderChange(val)}
          disabled={providerSelectDisabled}
        >
          <SelectTrigger className={providerSelectClassName}>
            <SelectValue placeholder={providerPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((option: ComboboxOption) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {providersLoaded && missingConfiguredProviders.length > 0 && (
          <p className='text-xs text-muted-foreground'>
            Add API keys for {missingProvidersText} in{' '}
            <a href='/settings' className='underline'>
              Settings
            </a>{' '}
            to enable them.
          </p>
        )}
        {providersLoaded && providerOptions.length === 0 && missingConfiguredProviders.length === 0 && (
          <p className='text-xs text-muted-foreground'>
            Configure a provider in{' '}
            <a href='/settings' className='underline'>
              Settings
            </a>{' '}
            to enable models.
          </p>
        )}
      </div>

      <div className={modelWrapperClassName}>
        {showLabels && layout === 'vertical' && <label className='text-sm font-medium'>Model</label>}
        <PromptlianoCombobox
          options={comboboxOptions}
          value={currentModel}
          onValueChange={handleModelChange}
          placeholder={
            isLoadingModels
              ? 'Loading...'
              : !isConnected
                ? 'Connect server to load models'
                : providerOptions.length === 0
                  ? 'Configure a provider to load models'
                  : comboboxOptions.length === 0
                    ? 'No models available'
                    : 'Select model'
          }
          searchPlaceholder='Search models...'
          className={modelComboboxClassName}
          popoverClassName='w-[300px]'
          disabled={
            disabled ||
            providerOptions.length === 0 ||
            !isConnected ||
            isLoadingModels ||
            comboboxOptions.length === 0
          }
        />
      </div>
    </div>
  )
}
