import React from 'react'
import { cn } from '@/lib/utils'
import { ProcessesSidebarNav, type ProcessView } from './processes-sidebar-nav'
import { ProcessesTab } from './processes-tab'
import { PortTable } from './port-table'

interface ProcessesTabWithSidebarProps {
  projectId: number
  projectName?: string
  processView?: ProcessView
  onProcessViewChange: (view: ProcessView) => void
  className?: string
}

export function ProcessesTabWithSidebar({
  projectId,
  projectName,
  processView = 'processes',
  onProcessViewChange,
  className
}: ProcessesTabWithSidebarProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <ProcessesSidebarNav activeView={processView} onViewChange={onProcessViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto'>
        {processView === 'processes' && <ProcessesTab projectId={projectId} projectName={projectName} />}
        {processView === 'ports' && (
          <div className='p-4 md:p-6'>
            <PortTable projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  )
}

