import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { FlowSidebarNav } from './flow-sidebar-nav'
import { useMediaQuery } from '@/hooks/use-media-query'
import { QueueOverviewView } from '@/components/queues/views/queue-overview-view'
import { QueueTimelineView } from '@/components/queues/views/queue-timeline-view'
import { QueueAnalyticsView } from '@/components/queues/views/queue-analytics-view'
import { QueueCreateDialog } from '@/components/queues/queue-create-dialog'
import { SimpleTicketList } from './simple-ticket-list'
import { TicketDetailView } from '@/components/tickets/ticket-detail-view'
import { KanbanBoard } from '@/components/queues/kanban-board'
import { TicketDialog } from '@/components/tickets/ticket-dialog'
import { useTickets, useQueues, useTicketTasks } from '@/hooks/generated'
import type { TicketWithTasks, TicketTask } from '@promptliano/database'
import { Button } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@promptliano/ui'
import { Plus, Filter } from 'lucide-react'
import { type FlowView } from '@/lib/search-schemas'

interface FlowTabWithSidebarProps {
  projectId: number
  projectName?: string
  projectTabId: number
  flowView?: FlowView
  selectedTicketId?: number
  selectedQueueId?: number
  onFlowViewChange: (view: FlowView) => void
  onTicketSelect: (ticketId: number | undefined) => void
  onQueueSelect: (queueId: number | undefined) => void
  className?: string
}

export function FlowTabWithSidebar({
  projectId,
  projectName,
  projectTabId,
  flowView = 'queues',
  selectedTicketId,
  selectedQueueId,
  onFlowViewChange,
  onTicketSelect,
  onQueueSelect,
  className
}: FlowTabWithSidebarProps) {
  const [isCreateQueueDialogOpen, setIsCreateQueueDialogOpen] = useState(false)
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false)
  const [ticketStatusFilter, setTicketStatusFilter] = useState<
    'all' | 'open' | 'in_progress' | 'closed' | 'non_closed'
  >('non_closed')
  const [ticketQueueFilter, setTicketQueueFilter] = useState<string>('all')

  // Responsive sidebar width
  const isCompact = useMediaQuery('(max-width: 768px)')

  // Fetch tickets for the tickets view
  const { data: rawTickets, isLoading, refetch, error } = useTickets({ projectId })

  // Fetch available queues
  const { data: queuesData } = useQueues({ projectId })

  // Transform tickets to include empty tasks array for now
  // TODO: Use proper ticket with tasks hook when available
  const tickets: TicketWithTasks[] = React.useMemo(() => {
    if (!rawTickets) return []
    return rawTickets.map((ticket) => ({
      ...ticket,
      tasks: [] // For now, we'll use empty tasks array
    } as TicketWithTasks))
  }, [rawTickets])

  // Derive selected ticket from selectedTicketId and tickets data
  const selectedTicket: import('@/hooks/generated/types').TicketWithTasksNested | null = React.useMemo(() => {
    if (!selectedTicketId || !tickets) return null
    const ticket = tickets.find(t => t.id === selectedTicketId)
    if (!ticket) return null
    
    // Convert the flat TicketWithTasks to the nested structure expected by TicketDetailView
    const { tasks, ...ticketData } = ticket
    return {
      ticket: ticketData as any, // Cast to the base Ticket type
      tasks: tasks || []
    }
  }, [selectedTicketId, tickets])

  // Filter tickets based on status and queue
  const filteredTickets = React.useMemo(() => {
    if (!tickets) return []

    let filtered = tickets

    // Apply status filter
    switch (ticketStatusFilter) {
      case 'non_closed':
        filtered = filtered.filter(t => t.status !== 'closed')
        break
      case 'open':
        filtered = filtered.filter(t => t.status === 'open')
        break
      case 'in_progress':
        filtered = filtered.filter(t => t.status === 'in_progress')
        break
      case 'closed':
        filtered = filtered.filter(t => t.status === 'closed')
        break
      case 'all':
      default:
        // No status filtering
        break
    }

    // Apply queue filter
    if (ticketQueueFilter === 'all') {
      // No queue filtering
    } else if (ticketQueueFilter === 'unqueued') {
      filtered = filtered.filter(t => t.queueId == null)
    } else {
      // It's a specific queue ID
      filtered = filtered.filter(t => t.queueId?.toString() === ticketQueueFilter)
    }

    return filtered
  }, [tickets, ticketStatusFilter, ticketQueueFilter])

  // Handle ticket selection
  const handleSelectTicket = (ticket: TicketWithTasks) => {
    // Handle both flat and nested ticket structures
    const ticketId = (ticket as any)?.ticket?.id || (ticket as any)?.id
    onTicketSelect(ticketId)
  }

  const renderContent = () => {
    switch (flowView) {
      case 'queues':
        return (
          <QueueOverviewView
            projectId={projectId}
            selectedQueueId={selectedQueueId}
            onQueueSelect={onQueueSelect}
            onCreateQueue={() => setIsCreateQueueDialogOpen(true)}
          />
        )

      case 'tickets':
        return (
          <div className='flex h-full'>
            <div className='w-1/3 min-w-[300px] max-w-[400px] border-r'>
              <div className='h-full flex flex-col'>
                <div className='p-4 border-b flex flex-col gap-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='font-semibold flex-shrink-0'>Tickets</h3>
                    <Button size='sm' onClick={() => setIsCreateTicketDialogOpen(true)} className='gap-1'>
                      <Plus className='h-4 w-4' />
                      New Ticket
                    </Button>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Select value={ticketStatusFilter} onValueChange={(value: 'all' | 'open' | 'in_progress' | 'closed' | 'non_closed') => setTicketStatusFilter(value)}>
                      <SelectTrigger className='flex-1 h-8'>
                        <Filter className='h-3 w-3 mr-1' />
                        <SelectValue placeholder='Status' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='non_closed'>Non-Closed</SelectItem>
                        <SelectItem value='all'>All Status</SelectItem>
                        <SelectItem value='open'>Open</SelectItem>
                        <SelectItem value='in_progress'>In Progress</SelectItem>
                        <SelectItem value='closed'>Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={ticketQueueFilter} onValueChange={(value) => setTicketQueueFilter(value)}>
                      <SelectTrigger className='flex-1 h-8'>
                        <Filter className='h-3 w-3 mr-1' />
                        <SelectValue placeholder='Queue' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>All Tickets</SelectItem>
                        <SelectItem value='unqueued'>Unqueued</SelectItem>
                        {queuesData && queuesData.length > 0 && (
                          <>
                            <SelectSeparator />
                            {queuesData.map((queueWithStats: any) => (
                              <SelectItem key={queueWithStats.queue.id} value={queueWithStats.queue.id.toString()}>
                                {queueWithStats.queue.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='flex-1 overflow-y-auto'>
                  {error ? (
                    <div className='p-4 text-red-500'>
                      <p className='font-semibold'>Error loading tickets</p>
                      <p className='text-sm mt-1'>{(error as any)?.message || 'Please try refreshing the page'}</p>
                      <Button size='sm' onClick={() => refetch()} className='mt-2'>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <SimpleTicketList
                      tickets={filteredTickets}
                      selectedTicket={selectedTicket as any}
                      onSelectTicket={handleSelectTicket}
                      loading={isLoading}
                      projectId={projectId}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className='flex-1'>
              {selectedTicket ? (
                <TicketDetailView ticket={selectedTicket} projectId={projectId} onTicketUpdate={refetch} />
              ) : (
                <div className='flex items-center justify-center h-full text-muted-foreground'>
                  <p>Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        )

      case 'kanban':
        return <KanbanBoard projectId={projectId} onCreateTicket={() => setIsCreateTicketDialogOpen(true)} />

      case 'analytics':
        return (
          <div className='p-6'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <div>
                <h3 className='text-lg font-semibold mb-4'>Queue Analytics</h3>
                <QueueAnalyticsView projectId={projectId} selectedQueueId={selectedQueueId} />
              </div>
              <div>
                <h3 className='text-lg font-semibold mb-4'>Ticket Analytics</h3>
                <div className='flex items-center justify-center h-64 text-muted-foreground border rounded-lg'>
                  <p>Ticket analytics coming soon...</p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar - responsive width */}
      <div className={cn('border-r flex-shrink-0 transition-all duration-200', isCompact ? 'w-16' : 'w-64')}>
        <FlowSidebarNav activeView={flowView} onViewChange={onFlowViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-hidden'>{renderContent()}</div>

      {/* Dialogs */}
      <QueueCreateDialog
        projectId={projectId}
        open={isCreateQueueDialogOpen}
        onOpenChange={setIsCreateQueueDialogOpen}
      />

      <TicketDialog
        isOpen={isCreateTicketDialogOpen}
        onClose={() => {
          setIsCreateTicketDialogOpen(false)
          refetch()
        }}
        ticketWithTasks={null}
        projectId={projectId.toString()}
      />
    </div>
  )
}
