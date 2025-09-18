import React, { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { FlowSidebarNav } from './flow-sidebar-nav'
import { useMediaQuery } from '@/hooks/use-media-query'
import { QueueOverviewView } from '@/components/queues/views/queue-overview-view'
import { QueueTimelineView } from '@/components/queues/views/queue-timeline-view'
import { QueueAnalyticsView } from '@/components/queues/views/queue-analytics-view'
import { QueueCreateDialog } from '@/components/queues/queue-create-dialog'
import { TicketDetailView } from '@/components/tickets/ticket-detail-view'
import { KanbanBoard } from '@/components/queues/kanban-board'
import { TicketDialog } from '@/components/tickets/ticket-dialog'
import { FlowItemCard } from './flow-item-card'
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel'
import { useTickets } from '@/hooks/generated'
import { useGetFlowItems, useGetFlowData } from '@/hooks/api-hooks'
import type { TicketWithTasks } from '@promptliano/database'
import { Button, Skeleton } from '@promptliano/ui'
import { Plus } from 'lucide-react'
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
  const [selectedFlowItemId, setSelectedFlowItemId] = useState<string | null>(null)
  const [flowFilter, setFlowFilter] = useState<'all' | 'tickets' | 'tasks' | 'queued' | 'unqueued'>('all')

  // Responsive sidebar width
  const isCompact = useMediaQuery('(max-width: 768px)')

  // Fetch tickets for the tickets view
  const { data: rawTickets, refetch } = (useTickets as any)({ projectId })

  // Unified flow items and queue metadata
  const {
    data: flowItemsData,
    isLoading: isLoadingFlowItems,
    refetch: refetchFlowItems,
    error: flowItemsError
  } = useGetFlowItems(projectId)
  const { data: flowData } = useGetFlowData(projectId)

  // Transform tickets to include empty tasks array for now
  // TODO: Use proper ticket with tasks hook when available
  const tickets: TicketWithTasks[] = React.useMemo(() => {
    if (!rawTickets) return []
    return rawTickets.map(
      (ticket: any) =>
        ({
          ...ticket,
          tasks: [] // For now, we'll use empty tasks array
        }) as TicketWithTasks
    )
  }, [rawTickets])

  const queueNameMap = useMemo(() => {
    const map = new Map<number, string>()
    if (flowData?.queues) {
      Object.entries(flowData.queues).forEach(([id, value]) => {
        const queue = (value as any)?.queue
        map.set(Number(id), queue?.name || `Queue ${id}`)
      })
    }
    return map
  }, [flowData])

  const filteredFlowItems = useMemo(() => {
    if (!flowItemsData) return []
    return flowItemsData
      .filter((item) => {
        if (flowFilter === 'tickets') return item.type === 'ticket'
        if (flowFilter === 'tasks') return item.type === 'task'
        if (flowFilter === 'queued') return item.queueId !== null && item.queueId !== undefined
        if (flowFilter === 'unqueued') return item.queueId === null || item.queueId === undefined
        return true
      })
      .sort((a, b) => (b.updated || 0) - (a.updated || 0))
  }, [flowItemsData, flowFilter])

  // Derive selected ticket from selectedTicketId and tickets data
  const selectedTicket: import('@/hooks/generated/types').TicketWithTasksNested | null = React.useMemo(() => {
    if (!selectedTicketId || !tickets) return null
    const ticket = tickets.find((t) => t.id === selectedTicketId)
    if (!ticket) return null

    // Convert the flat TicketWithTasks to the nested structure expected by TicketDetailView
    const { tasks, ...ticketData } = ticket
    return {
      ticket: ticketData as any, // Cast to the base Ticket type
      tasks: tasks || []
    }
  }, [selectedTicketId, tickets])

  const selectedFlowItem = useMemo(() => {
    if (!flowItemsData) return null
    if (selectedFlowItemId) {
      const match = flowItemsData.find((item) => item.id === selectedFlowItemId)
      if (match) return match
    }
    if (selectedTicketId) {
      return flowItemsData.find((item) => item.type === 'ticket' && item.ticket?.id === selectedTicketId) || null
    }
    return null
  }, [flowItemsData, selectedFlowItemId, selectedTicketId])

  useEffect(() => {
    if (!flowItemsData || !selectedTicketId) return
    const ticketItem = flowItemsData.find((item) => item.type === 'ticket' && item.ticket?.id === selectedTicketId)
    if (ticketItem && ticketItem.id !== selectedFlowItemId) {
      setSelectedFlowItemId(ticketItem.id)
    }
  }, [selectedTicketId, flowItemsData, selectedFlowItemId])

  useEffect(() => {
    if (!flowItemsData || !selectedFlowItemId) return
    const exists = flowItemsData.some((item) => item.id === selectedFlowItemId)
    if (!exists) {
      setSelectedFlowItemId(null)
    }
  }, [flowItemsData, selectedFlowItemId])

  const handleSelectFlowItem = (item: any) => {
    setSelectedFlowItemId(item.id)
    if (item.type === 'ticket' && item.ticket) {
      onTicketSelect(item.ticket.id)
    } else if (item.type === 'task' && item.task) {
      onTicketSelect(item.task.ticketId)
    }
  }

  const selectedTaskTicketTitle = useMemo(() => {
    if (!selectedFlowItem || selectedFlowItem.type !== 'task') return undefined
    const parent = tickets.find((t) => t.id === selectedFlowItem.task?.ticketId)
    return parent?.title
  }, [selectedFlowItem, tickets])

  const handleTaskPanelRefresh = () => {
    refetch()
    refetchFlowItems()
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
              <div className='flex h-full flex-col'>
                <div className='border-b p-4 space-y-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='font-semibold flex-shrink-0'>Flow Items</h3>
                    <Button size='sm' onClick={() => setIsCreateTicketDialogOpen(true)} className='gap-1'>
                      <Plus className='h-4 w-4' />
                      New Ticket
                    </Button>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'tickets', label: 'Tickets' },
                      { id: 'tasks', label: 'Tasks' },
                      { id: 'queued', label: 'Queued' },
                      { id: 'unqueued', label: 'Unqueued' }
                    ].map(({ id, label }) => (
                      <Button
                        key={id}
                        size='sm'
                        variant={flowFilter === id ? 'default' : 'outline'}
                        onClick={() => setFlowFilter(id as any)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className='flex-1 overflow-y-auto'>
                  {flowItemsError ? (
                    <div className='p-4 text-red-500 space-y-2'>
                      <p className='font-semibold'>Error loading flow items</p>
                      <p className='text-sm'>{(flowItemsError as any)?.message || 'Please try refreshing the page'}</p>
                      <Button size='sm' onClick={() => refetchFlowItems()} className='gap-1'>
                        Retry
                      </Button>
                    </div>
                  ) : isLoadingFlowItems ? (
                    <div className='space-y-2 p-4'>
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className='h-20 w-full rounded-lg' />
                      ))}
                    </div>
                  ) : filteredFlowItems.length === 0 ? (
                    <div className='flex h-full items-center justify-center p-4 text-sm text-muted-foreground text-center'>
                      <p>No flow items yet. Create a ticket or quick task to get started.</p>
                    </div>
                  ) : (
                    <div className='space-y-2 p-3'>
                      {filteredFlowItems.map((item: any) => (
                        <FlowItemCard
                          key={item.id}
                          item={item}
                          queueName={item.queueId ? queueNameMap.get(item.queueId) : undefined}
                          isSelected={selectedFlowItem?.id === item.id}
                          onSelect={() => handleSelectFlowItem(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className='flex-1 overflow-y-auto'>
              {selectedFlowItem ? (
                selectedFlowItem.type === 'ticket' && selectedTicket ? (
                  <TicketDetailView
                    ticket={selectedTicket}
                    projectId={projectId}
                    onTicketUpdate={() => {
                      refetch()
                      refetchFlowItems()
                    }}
                  />
                ) : selectedFlowItem.type === 'task' && selectedFlowItem.task ? (
                  <div className='p-6'>
                    <TaskDetailPanel
                      task={selectedFlowItem.task}
                      projectId={projectId}
                      queueName={selectedFlowItem.queueId ? queueNameMap.get(selectedFlowItem.queueId) : undefined}
                      ticketTitle={selectedTaskTicketTitle}
                      onOpenTicket={(ticketId) => {
                        onTicketSelect(ticketId)
                        const matching = flowItemsData?.find(
                          (item) => item.type === 'ticket' && item.ticket?.id === ticketId
                        )
                        if (matching) {
                          setSelectedFlowItemId(matching.id)
                        }
                      }}
                      onRefresh={handleTaskPanelRefresh}
                    />
                  </div>
                ) : (
                  <div className='flex h-full items-center justify-center text-muted-foreground'>
                    <p>Select an item to view details</p>
                  </div>
                )
              ) : (
                <div className='flex h-full items-center justify-center text-muted-foreground'>
                  <p>Select an item to view details</p>
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
          refetchFlowItems()
        }}
        ticketWithTasks={null}
        projectId={projectId.toString()}
      />
    </div>
  )
}
