import React, { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import * as LucideIcons from 'lucide-react'
import { Settings } from 'lucide-react'
import { useModelConfigPresets, type PresetCategory } from '@/hooks/use-model-presets'

export type ModelPreset = PresetCategory

interface PresetSelectorProps {
  value: ModelPreset
  onChange: (preset: ModelPreset) => void
  className?: string
  disabled?: boolean
  compact?: boolean
}

export function PresetSelector({ value, onChange, className, disabled = false, compact = false }: PresetSelectorProps) {
  const { presets, isLoading } = useModelConfigPresets()

  // Helper to get icon component
  const getIconComponent = (iconName?: string) => {
    if (!iconName) return Settings
    // @ts-ignore - Dynamic icon lookup
    return LucideIcons[iconName] || Settings
  }

  // Get current preset config
  const currentPreset = presets?.[value]
  const Icon = currentPreset ? getIconComponent(currentPreset.uiIcon || undefined) : Settings

  // Build available presets list
  const availablePresets = useMemo(() => {
    if (!presets) return []
    return Object.entries(presets)
      .filter(([_, config]) => config !== null)
      .map(([key, config]) => ({
        key: key as PresetCategory,
        config: config!
      }))
      .sort((a, b) => (a.config.uiOrder || 0) - (b.config.uiOrder || 0))
  }, [presets])

  if (isLoading) {
    return <Skeleton className={`h-10 ${className}`} />
  }

  return (
    <Select value={value} onValueChange={(val) => onChange(val as ModelPreset)} disabled={disabled || !currentPreset}>
      <SelectTrigger className={className}>
        <SelectValue>
          {currentPreset ? (
            <div className='flex items-center gap-2'>
              <Icon className={`h-4 w-4 ${currentPreset.uiColor || 'text-muted-foreground'}`} />
              <span>{currentPreset.displayName?.split(' - ')[0] || currentPreset.name}</span>
              {!compact && currentPreset.description && (
                <Badge variant='outline' className='ml-auto text-xs'>
                  {currentPreset.description.substring(0, 30)}
                </Badge>
              )}
            </div>
          ) : (
            <span className='text-muted-foreground'>Select preset...</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availablePresets.map(({ key, config }) => {
          const ItemIcon = getIconComponent(config.uiIcon || undefined)
          return (
            <SelectItem key={key} value={key}>
              <div className='flex items-center gap-2'>
                <ItemIcon className={`h-4 w-4 ${config.uiColor || 'text-muted-foreground'}`} />
                <span>{config.displayName || config.name}</span>
                {!compact && config.description && (
                  <span className='text-xs text-muted-foreground ml-2'>- {config.description}</span>
                )}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}