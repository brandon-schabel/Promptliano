import React from 'react'
import { ProvidersSidebarNav, type ProvidersView } from './providers-sidebar-nav'
import { cn } from '@/lib/utils'

interface ProvidersTabWithSidebarProps {
  activeView: ProvidersView
  onViewChange: (view: ProvidersView) => void
  renderView: (view: ProvidersView) => React.ReactNode
  className?: string
}

export function ProvidersTabWithSidebar({ activeView, onViewChange, renderView, className }: ProvidersTabWithSidebarProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <ProvidersSidebarNav activeView={activeView} onViewChange={onViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto'>{renderView(activeView)}</div>
    </div>
  )
}

