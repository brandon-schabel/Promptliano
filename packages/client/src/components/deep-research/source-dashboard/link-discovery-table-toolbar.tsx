/**
 * Link Discovery Table Toolbar
 *
 * Top toolbar with search, filters, bulk actions, export, and column controls.
 * Provides the primary interaction surface for table operations.
 */

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input
} from '@promptliano/ui'
import { Columns, Copy, Download, Filter, RefreshCw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'

interface LinkDiscoveryTableToolbarProps {
  searchTerm: string
  onSearchChange: (search: string) => void
  onFilterToggle: () => void
  activeFilterCount: number
  onRefresh: () => void
  isRefreshing?: boolean
  selectedCount: number
  onBulkExport: (format: 'csv' | 'json') => void
  onCopyUrls: () => void
  showBulkActions: boolean
  showColumnControls: boolean
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (visibility: VisibilityState) => void
  className?: string
}

/**
 * LinkDiscoveryTableToolbar - Main toolbar component
 *
 * Features:
 * - Real-time search with debouncing
 * - Filter toggle with active count badge
 * - Bulk action menu when rows selected
 * - Export options (CSV, JSON)
 * - Column visibility controls
 * - Refresh button with loading state
 * - Keyboard shortcuts (Ctrl+F to focus search)
 */
export function LinkDiscoveryTableToolbar({
  searchTerm,
  onSearchChange,
  onFilterToggle,
  activeFilterCount,
  onRefresh,
  isRefreshing,
  selectedCount,
  onBulkExport,
  onCopyUrls,
  showBulkActions,
  showColumnControls,
  columnVisibility,
  onColumnVisibilityChange,
  className
}: LinkDiscoveryTableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchTerm) {
        onSearchChange(localSearch)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localSearch, searchTerm, onSearchChange])

  // Sync with external changes
  useEffect(() => {
    setLocalSearch(searchTerm)
  }, [searchTerm])

  // Keyboard shortcut for search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClearSearch = () => {
    setLocalSearch('')
    onSearchChange('')
  }

  const toggleColumn = (column: string) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [column]: !columnVisibility[column]
    })
  }

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      <div className='flex items-center gap-2 flex-1 min-w-[300px]'>
        {/* Search Input */}
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            ref={searchInputRef}
            type='search'
            placeholder='Search by URL or title... (Ctrl+F)'
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className='pl-9 pr-9'
          />
          {localSearch && (
            <button
              onClick={handleClearSearch}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
              aria-label='Clear search'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <Button
          variant={activeFilterCount > 0 ? 'default' : 'outline'}
          size='default'
          onClick={onFilterToggle}
          className='relative'
        >
          <Filter className='h-4 w-4 mr-2' />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant='secondary'
              className='ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs'
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* Refresh Button */}
        <Button variant='outline' size='icon' onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          <span className='sr-only'>Refresh</span>
        </Button>
      </div>

      <div className='flex items-center gap-2'>
        {/* Bulk Actions (shown when rows selected) */}
        {showBulkActions && selectedCount > 0 && (
          <div className='flex items-center gap-2 border-r pr-4'>
            <span className='text-sm text-muted-foreground'>{selectedCount} selected</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm'>
                  <Download className='h-4 w-4 mr-2' />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkExport('csv')}>
                  <Download className='h-4 w-4 mr-2' />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkExport('json')}>
                  <Download className='h-4 w-4 mr-2' />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant='outline' size='sm' onClick={onCopyUrls}>
              <Copy className='h-4 w-4 mr-2' />
              Copy URLs
            </Button>
          </div>
        )}

        {/* Column Controls */}
        {showColumnControls && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm'>
                <Columns className='h-4 w-4 mr-2' />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-48'>
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={columnVisibility.status}
                onCheckedChange={() => toggleColumn('status')}
              >
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.url}
                onCheckedChange={() => toggleColumn('url')}
                disabled // Always visible
              >
                URL (Required)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={columnVisibility.title} onCheckedChange={() => toggleColumn('title')}>
                Title
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={columnVisibility.depth} onCheckedChange={() => toggleColumn('depth')}>
                Depth
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.discoveredAt}
                onCheckedChange={() => toggleColumn('discoveredAt')}
              >
                Discovered At
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className='text-xs text-muted-foreground'>Optional Columns</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.parentUrl}
                onCheckedChange={() => toggleColumn('parentUrl')}
              >
                Parent URL
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.relevanceScore}
                onCheckedChange={() => toggleColumn('relevanceScore')}
              >
                Relevance Score
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.tokens}
                onCheckedChange={() => toggleColumn('tokens')}
              >
                Token Count
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
