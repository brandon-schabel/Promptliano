/**
 * Link Discovery Table Filters
 *
 * Comprehensive filter panel with:
 * - Multi-select status filter
 * - Depth range slider/dropdown
 * - Date range picker with presets
 * - Active filter chips
 * - Clear all filters button
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@promptliano/ui'
import { Calendar, CheckCircle, Clock, Filter, Layers, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LinkFilters } from './link-discovery-table'
import { useEffect, useState } from 'react'

interface LinkDiscoveryTableFiltersProps {
  filters: LinkFilters
  onFiltersChange: (filters: LinkFilters) => void
  onClearFilters: () => void
  className?: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'crawled', label: 'Crawled', icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'failed', label: 'Failed', icon: XCircle, color: 'bg-red-100 text-red-800 border-red-300' }
] as const

const DEPTH_OPTIONS = [
  { value: 'any', label: 'Any Depth', min: undefined, max: undefined },
  { value: '0', label: 'Depth 0', min: 0, max: 0 },
  { value: '1', label: 'Depth 1', min: 1, max: 1 },
  { value: '2', label: 'Depth 2', min: 2, max: 2 },
  { value: '3', label: 'Depth 3', min: 3, max: 3 },
  { value: '4+', label: 'Depth 4+', min: 4, max: undefined }
]

const DATE_PRESETS = [
  { value: 'hour', label: 'Last Hour', hours: 1 },
  { value: '24h', label: 'Last 24 Hours', hours: 24 },
  { value: '7d', label: 'Last 7 Days', hours: 24 * 7 },
  { value: 'custom', label: 'Custom Range', hours: null }
]

/**
 * LinkDiscoveryTableFilters - Comprehensive filter panel
 *
 * Features:
 * - Multi-select status filtering (checkboxes)
 * - Depth range selection (dropdown)
 * - Date range filtering with presets
 * - Active filter chips with remove buttons
 * - Clear all filters button
 * - Responsive layout
 */
export function LinkDiscoveryTableFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  className
}: LinkDiscoveryTableFiltersProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(filters.status || []))

  useEffect(() => {
    setSelectedStatuses(new Set(filters.status || []))
  }, [(filters.status || []).join(',')])

  const handleStatusToggle = (status: string) => {
    const newStatuses = new Set(selectedStatuses)
    if (newStatuses.has(status)) {
      newStatuses.delete(status)
    } else {
      newStatuses.add(status)
    }
    setSelectedStatuses(newStatuses)
    onFiltersChange({
      ...filters,
      status: Array.from(newStatuses) as ('pending' | 'crawled' | 'failed')[]
    })
  }

  const handleDepthChange = (value: string) => {
    const selected = DEPTH_OPTIONS.find((opt) => opt.value === value)
    if (selected) {
      onFiltersChange({
        ...filters,
        minDepth: selected.min,
        maxDepth: selected.max
      })
    }
  }

  const handleDatePresetChange = (value: string) => {
    const preset = DATE_PRESETS.find((p) => p.value === value)
    if (preset && preset.hours !== null) {
      const to = new Date()
      const from = new Date(to)
      from.setHours(from.getHours() - preset.hours)
      onFiltersChange({
        ...filters,
        dateRange: { from, to }
      })
    } else if (value === 'custom') {
      const newFilters = { ...filters }
      delete newFilters.dateRange
      onFiltersChange(newFilters)
    } else if (value === 'any') {
      const newFilters = { ...filters }
      delete newFilters.dateRange
      onFiltersChange(newFilters)
    }
  }

  const removeStatusFilter = (status: string) => {
    handleStatusToggle(status)
  }

  const removeDepthFilter = () => {
    const newFilters = { ...filters }
    delete newFilters.minDepth
    delete newFilters.maxDepth
    onFiltersChange(newFilters)
  }

  const removeDateFilter = () => {
    const newFilters = { ...filters }
    delete newFilters.dateRange
    onFiltersChange(newFilters)
  }

  // Compute active filters for display
  const activeFilters = []
  if (filters.status && filters.status.length > 0) {
    activeFilters.push({
      type: 'status',
      label: `Status: ${filters.status.join(', ')}`,
      onRemove: () => {
        const newFilters = { ...filters }
        delete newFilters.status
        setSelectedStatuses(new Set())
        onFiltersChange(newFilters)
      }
    })
  }
  if (filters.minDepth !== undefined || filters.maxDepth !== undefined) {
    const depthLabel =
      filters.minDepth === filters.maxDepth
        ? `Depth: ${filters.minDepth}`
        : filters.maxDepth === undefined
          ? `Depth: ${filters.minDepth}+`
          : `Depth: ${filters.minDepth}-${filters.maxDepth}`
    activeFilters.push({
      type: 'depth',
      label: depthLabel,
      onRemove: removeDepthFilter
    })
  }
  if (filters.dateRange) {
    activeFilters.push({
      type: 'date',
      label: `Date: ${filters.dateRange.from.toLocaleDateString()} - ${filters.dateRange.to.toLocaleDateString()}`,
      onRemove: removeDateFilter
    })
  }

  const hasActiveFilters = activeFilters.length > 0

  // Get current depth value for select
  const currentDepthValue =
    filters.minDepth === undefined && filters.maxDepth === undefined
      ? 'any'
      : DEPTH_OPTIONS.find((opt) => opt.min === filters.minDepth && opt.max === filters.maxDepth)?.value || 'any'

  return (
    <Card className={cn('', className)}>
      <CardContent className='pt-6'>
        <div className='space-y-6'>
          {/* Filter Controls */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {/* Status Filter */}
            <div className='space-y-2'>
              <Label className='flex items-center gap-2'>
                <Filter className='h-4 w-4' />
                Status
              </Label>
              <div className='space-y-2'>
                {STATUS_OPTIONS.map((status) => {
                  const StatusIcon = status.icon
                  const isSelected = selectedStatuses.has(status.value)

                  return (
                    <button
                      key={status.value}
                      onClick={() => handleStatusToggle(status.value)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md border transition-all',
                        'hover:shadow-sm',
                        isSelected ? status.color : 'bg-background border-border hover:border-foreground/20'
                      )}
                    >
                      <div
                        className={cn(
                          'h-4 w-4 rounded border flex items-center justify-center',
                          isSelected ? 'bg-foreground border-foreground' : 'border-muted-foreground'
                        )}
                      >
                        {isSelected && <div className='h-2 w-2 bg-background rounded-sm' />}
                      </div>
                      <StatusIcon className='h-4 w-4' />
                      <span className='text-sm font-medium'>{status.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Depth Filter */}
            <div className='space-y-2'>
              <Label className='flex items-center gap-2'>
                <Layers className='h-4 w-4' />
                Crawl Depth
              </Label>
              <Select value={currentDepthValue} onValueChange={handleDepthChange}>
                <SelectTrigger>
                  <SelectValue placeholder='Select depth' />
                </SelectTrigger>
                <SelectContent>
                  {DEPTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>Filter links by how many hops from the seed URL</p>
            </div>

            {/* Date Range Filter */}
            <div className='space-y-2'>
              <Label className='flex items-center gap-2'>
                <Calendar className='h-4 w-4' />
                Discovery Date
              </Label>
              <Select value={filters.dateRange ? 'custom' : 'any'} onValueChange={handleDatePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder='Select date range' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='any'>Any Time</SelectItem>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>Filter by when the link was discovered</p>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label className='text-sm'>Active Filters</Label>
                <Button variant='ghost' size='sm' onClick={onClearFilters} className='h-8 text-xs'>
                  Clear All
                </Button>
              </div>
              <div className='flex flex-wrap gap-2'>
                {activeFilters.map((filter, index) => (
                  <Badge
                    key={`${filter.type}-${index}`}
                    variant='secondary'
                    className='pl-2 pr-1 py-1 flex items-center gap-1'
                  >
                    <span className='text-xs'>{filter.label}</span>
                    <button
                      onClick={filter.onRemove}
                      className='ml-1 hover:bg-muted-foreground/20 rounded p-0.5'
                      aria-label={`Remove ${filter.type} filter`}
                    >
                      <X className='h-3 w-3' />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
