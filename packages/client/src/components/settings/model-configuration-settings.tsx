import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Settings2, RefreshCw } from 'lucide-react'
import { ModelPresetSelector, type ModelPreset } from '@/components/model-selection'
import { toast } from 'sonner'

export function ModelConfigurationSettings() {
  const [selectedPreset, setSelectedPreset] = useState<ModelPreset>('medium')
  const [isLoading, setIsLoading] = useState(false)

  const handlePresetChange = async (preset: ModelPreset) => {
    setSelectedPreset(preset)

    // In a real implementation, this would save to backend
    try {
      setIsLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      toast.success(`Switched to ${preset} preset configuration`)
    } catch (error) {
      toast.error('Failed to apply preset')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    // Refresh configuration from server
    toast.info('Configuration refreshed')
  }

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Model Configuration</h1>
          <p className='text-muted-foreground'>Select AI model presets optimized for different use cases.</p>
        </div>
        <Button variant='outline' onClick={handleRefresh}>
          <RefreshCw className='h-4 w-4 mr-2' />
          Refresh
        </Button>
      </div>

      {/* Preset Selection */}
      <ModelPresetSelector value={selectedPreset} onChange={handlePresetChange} disabled={isLoading} />

      {/* Current Configuration Display */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg flex items-center gap-2'>
            <Settings2 className='h-5 w-5' />
            Current Configuration
          </CardTitle>
          <CardDescription>Active model settings based on selected preset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3 text-sm'>
            <div className='flex justify-between items-center py-2 border-b'>
              <span className='text-muted-foreground'>Active Preset:</span>
              <span className='font-medium capitalize'>{selectedPreset}</span>
            </div>

            {selectedPreset === 'low' && (
              <>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Provider:</span>
                  <span className='font-medium'>LMStudio (Local)</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Model:</span>
                  <span className='font-medium'>Qwen3 Coder 30B</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Max Tokens:</span>
                  <span className='font-medium'>32,000</span>
                </div>
              </>
            )}

            {selectedPreset === 'medium' && (
              <>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Provider:</span>
                  <span className='font-medium'>OpenRouter</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Model:</span>
                  <span className='font-medium'>Gemini 2.5 Flash</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Max Tokens:</span>
                  <span className='font-medium'>25,000</span>
                </div>
              </>
            )}

            {selectedPreset === 'high' && (
              <>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Provider:</span>
                  <span className='font-medium'>OpenRouter</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Model:</span>
                  <span className='font-medium'>Gemini 2.5 Pro</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Max Tokens:</span>
                  <span className='font-medium'>200,000</span>
                </div>
              </>
            )}

            {selectedPreset === 'planning' && (
              <>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Provider:</span>
                  <span className='font-medium'>OpenRouter</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Model:</span>
                  <span className='font-medium'>Gemini 2.5 Flash (Optimized)</span>
                </div>
                <div className='flex justify-between items-center py-2 border-b'>
                  <span className='text-muted-foreground'>Max Tokens:</span>
                  <span className='font-medium'>200,000</span>
                </div>
              </>
            )}

            <div className='flex justify-between items-center py-2 border-b'>
              <span className='text-muted-foreground'>Temperature:</span>
              <span className='font-medium'>0.7</span>
            </div>
            <div className='flex justify-between items-center py-2'>
              <span className='text-muted-foreground'>Top P:</span>
              <span className='font-medium'>0</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className='bg-muted/50'>
        <CardHeader>
          <CardTitle className='text-lg'>About Model Presets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-2 text-sm text-muted-foreground'>
            <p>
              <strong>Low:</strong> Fast local model for quick tasks and simple queries. Runs on your machine via
              LMStudio.
            </p>
            <p>
              <strong>Medium:</strong> Balanced performance for most tasks. Good mix of speed and quality.
            </p>
            <p>
              <strong>High:</strong> Maximum quality for complex tasks requiring deep analysis and reasoning.
            </p>
            <p>
              <strong>Planning:</strong> Optimized for task planning, project breakdown, and strategic thinking.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
