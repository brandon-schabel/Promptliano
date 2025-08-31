import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Alert, AlertDescription } from '@promptliano/ui'
// Tabs not used in this simplified implementation
import { Loader2, Save, RotateCcw, Settings, Zap, Gauge, Rocket, Brain, AlertCircle } from 'lucide-react'
import { ModelParameterEditor } from '@/components/model-selection/model-parameter-editor'
import { ProviderModelSelector } from '@/components/model-selection'
import { useModelConfigs, useUpdateModelConfig } from '@/hooks/generated/model-config-hooks'
import { toast } from 'sonner'
import type { ModelConfig, APIProviders } from '@promptliano/database'
import { Label } from '@promptliano/ui'

type PresetName = 'low' | 'medium' | 'high' | 'planning'

const PRESET_INFO: Record<PresetName, {
  label: string
  icon: React.ElementType
  color: string
  description: string
  defaultProvider: APIProviders
}> = {
  low: {
    label: 'Low - Fast Local',
    icon: Zap,
    color: 'text-green-600',
    description: 'Optimized for quick responses using local models',
    defaultProvider: 'lmstudio'
  },
  medium: {
    label: 'Medium - Balanced',
    icon: Gauge,
    color: 'text-blue-600',
    description: 'Balance between speed and quality',
    defaultProvider: 'openrouter'
  },
  high: {
    label: 'High - Maximum Quality',
    icon: Rocket,
    color: 'text-purple-600',
    description: 'Best quality for complex tasks',
    defaultProvider: 'openrouter'
  },
  planning: {
    label: 'Planning - Task Breakdown',
    icon: Brain,
    color: 'text-orange-600',
    description: 'Optimized for planning and task analysis',
    defaultProvider: 'openrouter'
  }
}

export function ModelPresetConfigurator() {
  const [activePreset, setActivePreset] = useState<PresetName>('medium')
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<ModelConfig>>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const { data: configs, isLoading, refetch } = useModelConfigs()
  const updateMutation = useUpdateModelConfig()

  // Debug logging
  console.log('ModelPresetConfigurator - configs:', configs)
  console.log('ModelPresetConfigurator - isLoading:', isLoading)

  // Filter to only system presets
  const systemPresets = configs?.filter((c: any) => 
    c.isSystemPreset && ['low', 'medium', 'high', 'planning'].includes(c.name)
  ) || []

  console.log('ModelPresetConfigurator - systemPresets:', systemPresets)

  // Get config for active preset
  const activeConfig = systemPresets.find((c: any) => c.name === activePreset)
  const editedConfig = editedConfigs[activePreset] || {}
  const currentConfig = activeConfig ? { ...activeConfig, ...editedConfig } : null
  
  console.log('ModelPresetConfigurator - currentConfig:', currentConfig)

  useEffect(() => {
    setHasChanges(Object.keys(editedConfigs).length > 0)
  }, [editedConfigs])

  const handleParameterChange = (params: any) => {
    if (!currentConfig) return
    
    setEditedConfigs(prev => ({
      ...prev,
      [activePreset]: {
        ...prev[activePreset],
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        topP: params.topP,
        topK: params.topK,
        frequencyPenalty: params.frequencyPenalty,
        presencePenalty: params.presencePenalty
      }
    }))
  }

  const handleProviderChange = (provider: APIProviders) => {
    setEditedConfigs(prev => ({
      ...prev,
      [activePreset]: {
        ...prev[activePreset],
        provider,
        model: '' // Reset model when provider changes
      }
    }))
  }

  const handleModelChange = (model: string) => {
    setEditedConfigs(prev => ({
      ...prev,
      [activePreset]: {
        ...prev[activePreset],
        model
      }
    }))
  }

  const handleSave = async () => {
    try {
      // Save all edited configurations
      const updates = Object.entries(editedConfigs).map(async ([presetName, changes]) => {
        const config = systemPresets.find((c: any) => c.name === presetName)
        if (config && Object.keys(changes).length > 0) {
          await updateMutation.mutateAsync({
            id: config.id,
            data: changes
          })
        }
      })

      await Promise.all(updates)
      
      toast.success('Preset configurations saved successfully')
      setEditedConfigs({})
      setHasChanges(false)
      refetch()
    } catch (error) {
      toast.error('Failed to save configurations')
      console.error('Error saving configurations:', error)
    }
  }

  const handleReset = () => {
    setEditedConfigs({})
    setHasChanges(false)
  }

  const handleResetPreset = () => {
    setEditedConfigs(prev => {
      const updated = { ...prev }
      delete updated[activePreset]
      return updated
    })
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!currentConfig) {
    return (
      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          Preset configuration not found. Please run the server to initialize presets.
        </AlertDescription>
      </Alert>
    )
  }

  const PresetIcon = PRESET_INFO[activePreset].icon

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Model Preset Configuration</h2>
          <p className='text-muted-foreground'>
            Customize the models and parameters for each preset
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw className='h-4 w-4 mr-2' />
            Reset All
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
            ) : (
              <Save className='h-4 w-4 mr-2' />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply them.
          </AlertDescription>
        </Alert>
      )}

      {/* Preset Tabs - Simplified to debug infinite loop */}
      <div className='mb-6'>
        <div className='flex gap-2 p-1 bg-muted rounded-lg'>
          {Object.entries(PRESET_INFO).map(([key, info]) => {
            const Icon = info.icon
            const hasEdits = !!editedConfigs[key]
            return (
              <button
                key={key}
                type='button'
                onClick={() => setActivePreset(key as PresetName)}
                className={`flex-1 px-3 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                  activePreset === key 
                    ? 'bg-background shadow-sm' 
                    : 'hover:bg-background/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${info.color}`} />
                <span>{info.label.split(' - ')[0]}</span>
                {hasEdits && (
                  <div className='h-2 w-2 bg-yellow-500 rounded-full' />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div>
        {Object.entries(PRESET_INFO).map(([presetKey, presetInfo]) => {
          if (activePreset !== presetKey) return null
          return (
          <div key={presetKey} className='space-y-6 mt-6'>
            {/* Preset Header */}
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <PresetIcon className={`h-6 w-6 ${presetInfo.color}`} />
                    <div>
                      <CardTitle>{presetInfo.label}</CardTitle>
                      <CardDescription>{presetInfo.description}</CardDescription>
                    </div>
                  </div>
                  {editedConfigs[presetKey] && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={handleResetPreset}
                    >
                      <RotateCcw className='h-4 w-4 mr-2' />
                      Reset This Preset
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Provider and Model Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-lg flex items-center gap-2'>
                    <Settings className='h-5 w-5' />
                    Provider & Model
                  </CardTitle>
                  <CardDescription>
                    Select the AI provider and model for this preset
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <Label>Provider</Label>
                    <Select
                      value={currentConfig.provider}
                      onValueChange={handleProviderChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='openai'>OpenAI</SelectItem>
                        <SelectItem value='anthropic'>Anthropic</SelectItem>
                        <SelectItem value='google_gemini'>Google Gemini</SelectItem>
                        <SelectItem value='openrouter'>OpenRouter</SelectItem>
                        <SelectItem value='groq'>Groq</SelectItem>
                        <SelectItem value='together'>Together</SelectItem>
                        <SelectItem value='xai'>XAI</SelectItem>
                        <SelectItem value='lmstudio'>LMStudio</SelectItem>
                        <SelectItem value='ollama'>Ollama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label>Model</Label>
                    <ProviderModelSelector
                      provider={currentConfig.provider as APIProviders}
                      currentModel={currentConfig.model}
                      onProviderChange={(provider: string) => handleProviderChange(provider as APIProviders)}
                      onModelChange={handleModelChange}
                      showProviderSelect={false}
                    />
                  </div>

                  <div className='pt-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Current Model:</span>
                      <Badge variant='secondary' className='font-mono text-xs'>
                        {currentConfig.model || 'Not selected'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Parameters */}
              <ModelParameterEditor
                parameters={{
                  temperature: currentConfig.temperature || 0.7,
                  maxTokens: currentConfig.maxTokens || 4096,
                  topP: currentConfig.topP || 1,
                  topK: currentConfig.topK,
                  frequencyPenalty: currentConfig.frequencyPenalty || 0,
                  presencePenalty: currentConfig.presencePenalty || 0
                }}
                onChange={handleParameterChange}
              />
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
