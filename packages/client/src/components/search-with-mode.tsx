'use client'

import * as React from 'react'
import { ChevronDown, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@promptliano/ui'

interface SearchMode {
  value: string
  label: string
  shortLabel?: string
  icon?: React.ReactNode
}

interface SearchWithModeProps {
  value?: string
  onChange?: (value: string) => void
  onClear?: () => void
  mode: string
  onModeChange: (mode: string) => void
  modes: SearchMode[]
  placeholder?: string
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  autoFocus?: boolean
  disabled?: boolean
}

export const SearchWithMode = React.forwardRef<HTMLInputElement, SearchWithModeProps>(
  function SearchWithMode({
    value = '',
    onChange,
    onClear,
    mode,
    onModeChange,
    modes,
    placeholder = 'Search...',
    className,
    onKeyDown,
    onFocus,
    onBlur,
    autoFocus,
    disabled
  }, ref) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const [dropdownIndex, setDropdownIndex] = React.useState(-1)
  const internalInputRef = React.useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = React.useState(false)

  // Helper function to focus the input
  const focusInput = React.useCallback(() => {
    if (ref) {
      if (typeof ref === 'function') {
        // Can't focus callback refs directly
        return
      } else if (ref.current) {
        ref.current.focus()
      }
    } else if (internalInputRef.current) {
      internalInputRef.current.focus()
    }
  }, [ref])

  // Get the actual ref to pass to the Input component
  const actualInputRef = ref || internalInputRef

  const currentMode = modes.find(m => m.value === mode) || modes[0]
  const displayLabel = currentMode?.shortLabel || currentMode?.label || 'Search'

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Ctrl/Cmd+M to open mode selector
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault()
      setIsDropdownOpen(true)
      setDropdownIndex(0)
      return
    }

    // Handle dropdown navigation when open
    if (isDropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropdownIndex(prev => Math.min(modes.length - 1, prev + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropdownIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'Enter' && dropdownIndex >= 0) {
        e.preventDefault()
        onModeChange(modes[dropdownIndex].value)
        setIsDropdownOpen(false)
        setDropdownIndex(-1)
        focusInput()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setIsDropdownOpen(false)
        setDropdownIndex(-1)
        focusInput()
      }
      return
    }

    // Pass through other key events to parent
    onKeyDown?.(e)
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const handleClear = () => {
    onChange?.('')
    onClear?.()
    focusInput()
  }

  const handleModeSelect = (selectedMode: string) => {
    onModeChange(selectedMode)
    setIsDropdownOpen(false)
    setDropdownIndex(-1)
    // Focus input after mode change
    setTimeout(() => focusInput(), 0)
  }

  return (
    <div 
      className={cn(
        'relative flex items-center w-full max-w-sm',
        'border border-input rounded-md bg-background',
        'transition-colors duration-200',
        isFocused && 'ring-2 ring-ring ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Mode Selector */}
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              'h-full px-3 rounded-none rounded-l-md border-r border-input',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:ring-0 focus:ring-offset-0',
              'shrink-0 min-w-0'
            )}
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen)
              if (!isDropdownOpen) {
                setDropdownIndex(0)
              }
            }}
          >
            <div className="flex items-center gap-1 min-w-0">
              {currentMode?.icon && (
                <span className="shrink-0">
                  {currentMode.icon}
                </span>
              )}
              <span className="truncate text-sm">
                {displayLabel}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {modes.map((modeOption, index) => (
            <DropdownMenuItem
              key={modeOption.value}
              onClick={() => handleModeSelect(modeOption.value)}
              className={cn(
                'flex items-center gap-2',
                mode === modeOption.value && 'bg-accent text-accent-foreground',
                index === dropdownIndex && isDropdownOpen && 'bg-accent text-accent-foreground'
              )}
            >
              {modeOption.icon && (
                <span className="shrink-0">
                  {modeOption.icon}
                </span>
              )}
              <span>{modeOption.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search Input */}
      <div className="relative flex-1">
        <Input
          ref={actualInputRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            'border-0 rounded-none bg-transparent',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'pl-3',
            value && 'pr-8' // Add padding for clear button when there's content
          )}
        />

        {/* Clear Button */}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={handleClear}
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2',
              'h-6 w-6 p-0',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:ring-0 focus:ring-offset-0'
            )}
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
})