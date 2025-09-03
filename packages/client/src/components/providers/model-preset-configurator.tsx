import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Alert, AlertDescription } from '@promptliano/ui'
import { Loader2, Save, RotateCcw, Settings, AlertCircle } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { ModelParameterEditor } from '@/components/model-selection/model-parameter-editor'
import { ProviderModelSelector } from '@/components/model-selection'
import { useModelConfigs, useUpdateModelConfig } from '@/hooks/generated/model-config-hooks'
import { toast } from 'sonner'
import type { ModelConfig, APIProviders } from '@promptliano/database'
import { Label } from '@promptliano/ui'

export function ModelPresetConfigurator() {
  const [activePresetId, setActivePresetId] = useState<number | null>(null)
  const [editedConfigs, setEditedConfigs] = useState<Record<number, Partial<ModelConfig>>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const { data: configs, isLoading, refetch } = useModelConfigs()
  const updateMutation = useUpdateModelConfig()

  // Filter to only system presets with preset categories
  const systemPresets = useMemo(() => {
    const presets = configs?.filter((c: any) => 
      c.isSystemPreset && c.presetCategory && ['low', 'medium', 'high', 'planning'].includes(c.presetCategory)
    ) || []
    // Sort by uiOrder
    return presets.sort((a: any, b: any) => (a.uiOrder || 0) - (b.uiOrder || 0))
  }, [configs])

  // Set initial active preset when presets load
  useEffect(() => {
    if (systemPresets.length > 0 && !activePresetId) {
      // Find the default preset or use the first one
      const defaultPreset = systemPresets.find((p: any) => p.isDefault) || systemPresets[0]
      setActivePresetId(defaultPreset.id)
    }
  }, [systemPresets, activePresetId])

  // Get current active config
  const activeConfig = systemPresets.find((c: any) => c.id === activePresetId)
  const editedConfig = activePresetId ? editedConfigs[activePresetId] || {} : {}
  const currentConfig = activeConfig ? { ...activeConfig, ...editedConfig } : null

  useEffect(() => {
    setHasChanges(Object.keys(editedConfigs).length > 0)
  }, [editedConfigs])

  const handleParameterChange = (params: any) => {
    if (!currentConfig || !activePresetId) return
    
    setEditedConfigs(prev => ({
      ...prev,
      [activePresetId]: {
        ...prev[activePresetId],
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
    if (!activePresetId) return
    setEditedConfigs(prev => ({
      ...prev,
      [activePresetId]: {
        ...prev[activePresetId],
        provider,
        model: '' // Reset model when provider changes
      }
    }))
  }

  const handleModelChange = (model: string) => {
    if (!activePresetId) return
    setEditedConfigs(prev => ({
      ...prev,
      [activePresetId]: {
        ...prev[activePresetId],
        model
      }
    }))
  }

  const handleSave = async () => {
    try {
      // Save all edited configurations
      const updates = Object.entries(editedConfigs).map(async ([presetId, changes]) => {
        const id = Number(presetId)
        if (!isNaN(id) && Object.keys(changes).length > 0) {
          await updateMutation.mutateAsync({
            id,
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
    if (!activePresetId) return
    setEditedConfigs(prev => {
      const updated = { ...prev }
      delete updated[activePresetId]
      return updated
    })
  }

  // Helper function to get icon component
  const getIconComponent = (iconName?: string) => {
    if (!iconName) return Settings
    // @ts-ignore - Dynamic icon lookup
    return LucideIcons[iconName] || Settings
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

  const PresetIcon = activeConfig ? getIconComponent(activeConfig.uiIcon) : Settings

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

      {/* Preset Tabs - Dynamic from backend */}
      <div className='mb-6'>
        <div className='flex gap-2 p-1 bg-muted rounded-lg'>
          {systemPresets.map((preset: any) => {
            const Icon = getIconComponent(preset.uiIcon)
            const hasEdits = !!editedConfigs[preset.id]
            return (
              <button
                key={preset.id}
                type='button'
                onClick={() => setActivePresetId(preset.id)}
                className={`flex-1 px-3 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                  activePresetId === preset.id 
                    ? 'bg-background shadow-sm' 
                    : 'hover:bg-background/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${preset.uiColor || 'text-muted-foreground'}`} />
                <span>{preset.displayName?.split(' - ')[0] || preset.name}</span>
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
        {currentConfig && (
          <div className='space-y-6 mt-6'>
            {/* Preset Header */}
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <PresetIcon className={`h-6 w-6 ${currentConfig.uiColor || 'text-muted-foreground'}`} />
                    <div>
                      <CardTitle>{currentConfig.displayName || currentConfig.name}</CardTitle>
                      <CardDescription>{currentConfig.description || 'Configure this preset'}</CardDescription>
                    </div>
                  </div>
                  {activePresetId && editedConfigs[activePresetId] && (
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
        )}
      </div>
    </div>
  )
}
