import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Zap, Gauge, Rocket, Brain } from 'lucide-react'

export type ModelPreset = 'low' | 'medium' | 'high' | 'planning'

interface PresetSelectorProps {
  value: ModelPreset
  onChange: (preset: ModelPreset) => void
  className?: string
  disabled?: boolean
  compact?: boolean
}

const PRESET_CONFIG = {
  low: {
    label: 'Low',
    icon: Zap,
    color: 'text-green-600',
    description: 'Fast local model'
  },
  medium: {
    label: 'Medium',
    icon: Gauge,
    color: 'text-blue-600',
    description: 'Balanced performance'
  },
  high: {
    label: 'High',
    icon: Rocket,
    color: 'text-purple-600',
    description: 'Maximum quality'
  },
  planning: {
    label: 'Planning',
    icon: Brain,
    color: 'text-orange-600',
    description: 'Task planning'
  }
} as const

export function PresetSelector({ value, onChange, className, disabled = false, compact = false }: PresetSelectorProps) {
  const currentPreset = PRESET_CONFIG[value]
  const Icon = currentPreset.icon

  return (
    <Select value={value} onValueChange={(val) => onChange(val as ModelPreset)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue>
          <div className='flex items-center gap-2'>
            <Icon className={`h-4 w-4 ${currentPreset.color}`} />
            <span>{currentPreset.label}</span>
            {!compact && (
              <Badge variant='outline' className='ml-auto text-xs'>
                {currentPreset.description}
              </Badge>
            )}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PRESET_CONFIG).map(([key, config]) => {
          const ItemIcon = config.icon
          return (
            <SelectItem key={key} value={key}>
              <div className='flex items-center gap-2'>
                <ItemIcon className={`h-4 w-4 ${config.color}`} />
                <span>{config.label}</span>
                {!compact && <span className='text-xs text-muted-foreground ml-2'>- {config.description}</span>}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}