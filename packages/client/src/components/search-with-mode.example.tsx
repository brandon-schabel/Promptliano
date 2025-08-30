'use client'

import React, { useState } from 'react'
import { SearchWithMode } from './search-with-mode'
import { FileText, Search, Code } from 'lucide-react'

export function SearchWithModeExample() {
  const [searchValue, setSearchValue] = useState('')
  const [searchMode, setSearchMode] = useState('name')

  const searchModes = [
    {
      value: 'name',
      label: 'Search Names',
      shortLabel: 'Names',
      icon: <FileText className='h-4 w-4' />
    },
    {
      value: 'content',
      label: 'Search Content',
      shortLabel: 'Content',
      icon: <Code className='h-4 w-4' />
    },
    {
      value: 'both',
      label: 'Search Both',
      shortLabel: 'Both',
      icon: <Search className='h-4 w-4' />
    }
  ]

  const handleClear = () => {
    console.log('Search cleared')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      console.log(`Searching for "${searchValue}" in mode "${searchMode}"`)
    }
  }

  return (
    <div className='p-6 space-y-4'>
      <h2 className='text-lg font-semibold'>SearchWithMode Component Example</h2>

      <div className='space-y-2'>
        <label className='text-sm font-medium'>File Search:</label>
        <SearchWithMode
          value={searchValue}
          onChange={setSearchValue}
          onClear={handleClear}
          mode={searchMode}
          onModeChange={setSearchMode}
          modes={searchModes}
          placeholder={`Search file ${searchMode === 'content' ? 'content' : searchMode === 'name' ? 'names' : 'names & content'}...`}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>

      <div className='text-sm text-muted-foreground space-y-1'>
        <p>
          <strong>Current Value:</strong> {searchValue || '(empty)'}
        </p>
        <p>
          <strong>Current Mode:</strong> {searchMode}
        </p>
        <p>
          <strong>Keyboard shortcuts:</strong>
        </p>
        <ul className='ml-4 list-disc space-y-1'>
          <li>Ctrl/Cmd + M to open mode selector</li>
          <li>Arrow keys to navigate modes when dropdown is open</li>
          <li>Enter to select mode</li>
          <li>Escape to close dropdown</li>
        </ul>
      </div>
    </div>
  )
}
