import React from 'react'
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Zap, Gauge, Rocket, Brain } from 'lucide-react'
// Intelligence level configurations based on models.config.ts
const INTELLIGENCE_CONFIGS = {
  low: {
    provider: 'lmstudio',
    model: 'unsloth-qwen3-coder-30b-a3b-instruct-qx4-mlx',
    maxTokens: 32000
  },
  medium: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    maxTokens: 25000
  },
  high: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro',
    maxTokens: 200000
  },
  planning: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    maxTokens: 25000
  }
} as const

export type ModelPreset = 'low' | 'medium' | 'high' | 'planning'

interface ModelPresetSelectorProps {
  value: ModelPreset
  onChange: (preset: ModelPreset) => void
  className?: string
  disabled?: boolean
}

const PRESET_INFO = {
  low: {
    label: 'Low Intelligence',
    description: 'Fast responses for simple tasks like summaries',
    icon: Zap,
    provider: INTELLIGENCE_CONFIGS.low.provider === 'lmstudio' ? 'LMStudio' : INTELLIGENCE_CONFIGS.low.provider,
    model: INTELLIGENCE_CONFIGS.low.model,
    color: 'text-green-600',
    useCases: ['Summaries', 'Quick searches', 'Basic Q&A'],
    contextWindow: '32K tokens',
    speed: 'Very Fast'
  },
  medium: {
    label: 'Medium Intelligence',
    description: 'Balanced quality for most development tasks',
    icon: Gauge,
    provider: INTELLIGENCE_CONFIGS.medium.provider === 'openrouter' ? 'OpenRouter' : INTELLIGENCE_CONFIGS.medium.provider,
    model: INTELLIGENCE_CONFIGS.medium.model,
    color: 'text-blue-600',
    useCases: ['Code generation', 'Documentation', 'Analysis'],
    contextWindow: '25K tokens',
    speed: 'Fast'
  },
  high: {
    label: 'High Intelligence',
    description: 'Maximum quality for complex reasoning and large context',
    icon: Rocket,
    provider: INTELLIGENCE_CONFIGS.high.provider === 'openrouter' ? 'OpenRouter' : INTELLIGENCE_CONFIGS.high.provider,
    model: INTELLIGENCE_CONFIGS.high.model,
    color: 'text-purple-600',
    useCases: ['File suggestions', 'Architecture', 'Complex refactoring'],
    contextWindow: '200K tokens',
    speed: 'Moderate'
  },
  planning: {
    label: 'Planning Intelligence',
    description: 'Optimized for project planning and ticket creation',
    icon: Brain,
    provider: INTELLIGENCE_CONFIGS.planning.provider === 'openrouter' ? 'OpenRouter' : INTELLIGENCE_CONFIGS.planning.provider,
    model: INTELLIGENCE_CONFIGS.planning.model,
    color: 'text-orange-600',
    useCases: ['Task breakdown', 'Project planning', 'Ticket management'],
    contextWindow: '25K tokens',
    speed: 'Fast'
  }
} as const

export function ModelPresetSelector({ value, onChange, className, disabled = false }: ModelPresetSelectorProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Intelligence Level</CardTitle>
        <CardDescription>Select the appropriate AI intelligence level for your task</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={value} onValueChange={(val) => onChange(val as ModelPreset)} disabled={disabled}>
          <div className='grid gap-4'>
            {Object.entries(PRESET_INFO).map(([key, info]) => {
              const Icon = info.icon
              const isSelected = value === key
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 transition-colors ${
                    isSelected ? 'border-primary bg-muted/50' : 'border-muted hover:bg-muted/30'
                  } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
                >
                  <div className='flex items-start space-x-3'>
                    <RadioGroupItem value={key} id={key} className='mt-1' />
                    <Label htmlFor={key} className='flex-1 cursor-pointer'>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <Icon className={`h-5 w-5 ${info.color}`} />
                            <span className='font-semibold'>{info.label}</span>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Badge variant='outline' className='text-xs'>
                              {info.speed}
                            </Badge>
                            <Badge variant='secondary' className='text-xs'>
                              {info.contextWindow}
                            </Badge>
                          </div>
                        </div>
                        <p className='text-sm text-muted-foreground'>{info.description}</p>
                        <div className='flex flex-wrap gap-1 mt-2'>
                          {info.useCases.map((useCase) => (
                            <Badge key={useCase} variant='outline' className='text-xs'>
                              {useCase}
                            </Badge>
                          ))}
                        </div>
                        <div className='flex items-center gap-2 mt-2 text-xs text-muted-foreground'>
                          <span>{info.provider}</span>
                          <span>•</span>
                          <span>{info.model}</span>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              )
            })}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}