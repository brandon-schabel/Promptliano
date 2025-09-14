import React from 'react'
import { cn } from '@/lib/utils'
import { ProcessesScriptsPanel } from './processes-scripts-panel'
import { ProcessesRunningList } from './processes-running-list'
import { StartProcessPopover } from './start-process-popover'
import { useListProcesses } from '@/hooks/api/processes-hooks'

type ProcessesTabProps = {
  projectId: number
  projectName?: string
}

export function ProcessesTab({ projectId, projectName }: ProcessesTabProps) {
  const { refetch } = useListProcesses(projectId)

  const handleProcessStarted = () => {
    refetch()
  }

  return (
    <div className='h-full flex flex-col'>
      {/* Header with Start Process Button */}
      <div className='flex-none px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold'>Process Management</h2>
            <p className='text-sm text-muted-foreground'>
              Manage scripts and running processes{projectName ? ` for ${projectName}` : ''}
            </p>
          </div>
          <StartProcessPopover projectId={projectId} onProcessStarted={handleProcessStarted} />
        </div>
      </div>

      {/* Vertical Split Layout */}
      <div className='flex-1 flex min-h-0'>
        {/* Left Panel - Scripts */}
        <div className={cn('w-2/5 border-r bg-muted/30 flex-shrink-0 overflow-y-auto', 'p-4')}>
          <ProcessesScriptsPanel projectId={projectId} projectName={projectName} className='h-full' />
        </div>

        {/* Right Panel - Running Processes */}
        <div className='flex-1 overflow-y-auto p-4'>
          <ProcessesRunningList projectId={projectId} projectName={projectName} className='h-full' />
        </div>
      </div>
    </div>
  )
}
