import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@promptliano/ui'
import { Terminal, Network } from 'lucide-react'

export type ProcessView = 'processes' | 'ports'

interface ProcessesSidebarNavProps {
  activeView: ProcessView
  onViewChange: (view: ProcessView) => void
  className?: string
}

export function ProcessesSidebarNav({ activeView, onViewChange, className }: ProcessesSidebarNavProps) {
  const navItems = [
    {
      id: 'processes' as ProcessView,
      label: 'Processes',
      icon: Terminal,
      description: 'Start and manage processes'
    },
    {
      id: 'ports' as ProcessView,
      label: 'Ports',
      icon: Network,
      description: 'View and free ports'
    }
  ]

  return (
    <div className={cn('flex flex-col gap-1 p-2', className)}>
      {navItems.map((item) => (
        <Button
          key={item.id}
          variant={activeView === item.id ? 'secondary' : 'ghost'}
          className={cn('w-full justify-start gap-3 h-auto py-3 px-3', activeView === item.id && 'bg-secondary')}
          onClick={() => onViewChange(item.id)}
        >
          <item.icon className='h-4 w-4 shrink-0' />
          <div className='flex flex-col items-start text-left'>
            <span className='text-sm font-medium whitespace-nowrap'>{item.label}</span>
            <span className='text-xs text-muted-foreground whitespace-nowrap'>{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}

