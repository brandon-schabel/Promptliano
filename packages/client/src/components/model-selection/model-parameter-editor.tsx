import React from 'react'
import { Label } from '@promptliano/ui'
import { Slider } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'

interface ModelParameters {
  temperature: number
  maxTokens: number
  topP: number
  topK?: number
  frequencyPenalty: number
  presencePenalty: number
}

interface ModelParameterEditorProps {
  parameters: ModelParameters
  onChange: (params: ModelParameters) => void
  disabled?: boolean
  className?: string
}

const PARAMETER_INFO = {
  temperature: {
    label: 'Temperature',
    description: 'Controls randomness. Lower is more focused and deterministic.',
    min: 0,
    max: 2,
    step: 0.1
  },
  maxTokens: {
    label: 'Max Tokens',
    description: 'Maximum number of tokens to generate.',
    min: 100,
    max: 200000,
    step: 100
  },
  topP: {
    label: 'Top P',
    description: 'Nucleus sampling threshold. Controls diversity.',
    min: 0,
    max: 1,
    step: 0.01
  },
  topK: {
    label: 'Top K',
    description: 'Limits vocabulary to top K tokens. 0 means no limit.',
    min: 0,
    max: 100,
    step: 1
  },
  frequencyPenalty: {
    label: 'Frequency Penalty',
    description: 'Reduces repetition of frequently used tokens.',
    min: -2,
    max: 2,
    step: 0.1
  },
  presencePenalty: {
    label: 'Presence Penalty',
    description: 'Reduces repetition of any used tokens.',
    min: -2,
    max: 2,
    step: 0.1
  }
}

export function ModelParameterEditor({ parameters, onChange, disabled = false, className }: ModelParameterEditorProps) {
  const handleSliderChange = (param: keyof ModelParameters) => (value: number[]) => {
    onChange({
      ...parameters,
      [param]: value[0]
    })
  }

  const handleInputChange = (param: keyof ModelParameters) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      const info = PARAMETER_INFO[param]
      const clampedValue = Math.max(info.min, Math.min(info.max, value))
      onChange({
        ...parameters,
        [param]: clampedValue
      })
    }
  }

  const renderParameter = (key: keyof ModelParameters) => {
    const info = PARAMETER_INFO[key]
    const value = parameters[key] ?? 0

    // Skip topK if not provided
    if (key === 'topK' && parameters.topK === undefined) {
      return null
    }

    return (
      <div key={key} className='space-y-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Label htmlFor={key} className='text-sm font-medium'>
              {info.label}
            </Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className='h-3 w-3 text-muted-foreground' />
              </TooltipTrigger>
              <TooltipContent>
                <p className='max-w-xs text-xs'>{info.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id={`${key}-input`}
            type='number'
            value={value}
            onChange={handleInputChange(key)}
            min={info.min}
            max={info.max}
            step={info.step}
            disabled={disabled}
            className='w-20 h-7 text-xs'
          />
        </div>
        <Slider
          id={key}
          value={[value]}
          onValueChange={handleSliderChange(key)}
          min={info.min}
          max={info.max}
          step={info.step}
          disabled={disabled}
          className='w-full'
        />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={className}>
        <div className='grid gap-4'>
          {/* Generation Parameters */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Generation Settings</CardTitle>
              <CardDescription className='text-xs'>Control how the model generates responses</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {renderParameter('temperature')}
              {renderParameter('maxTokens')}
            </CardContent>
          </Card>

          {/* Sampling Parameters */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Sampling Settings</CardTitle>
              <CardDescription className='text-xs'>Fine-tune token selection behavior</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {renderParameter('topP')}
              {parameters.topK !== undefined && renderParameter('topK')}
            </CardContent>
          </Card>

          {/* Penalty Parameters */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Penalty Settings</CardTitle>
              <CardDescription className='text-xs'>Control repetition in generated text</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {renderParameter('frequencyPenalty')}
              {renderParameter('presencePenalty')}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}
