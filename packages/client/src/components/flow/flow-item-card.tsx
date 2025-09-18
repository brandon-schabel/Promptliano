import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { ClipboardList, Ticket as TicketIcon, Layers, Clock } from 'lucide-react'
import type { FlowItem } from '@/hooks/api-hooks'
import { isQuickBucketOverview } from '@/constants/flow'

interface FlowItemCardProps {
  item: FlowItem
  queueName?: string
  meta?: React.ReactNode
  trailing?: React.ReactNode
  isSelected?: boolean
  onSelect?: () => void
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed'
}

function formatStatus(status?: string | null) {
  if (!status) return null
  return STATUS_LABEL[status] || status.replace('_', ' ')
}

export function FlowItemCard({ item, queueName, meta, trailing, isSelected, onSelect }: FlowItemCardProps) {
  const Icon = item.type === 'ticket' ? TicketIcon : ClipboardList
  const isQuickBucket = item.type === 'ticket' && isQuickBucketOverview(item.ticket?.overview)
  const statusLabel = formatStatus(item.queueStatus)

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5',
        isSelected && 'border-primary bg-primary/5'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <span className='mt-0.5 rounded-md bg-muted p-1'>
            <Icon className='h-4 w-4 text-muted-foreground' />
          </span>
          <div className='space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='line-clamp-1 text-sm font-medium'>{item.title}</span>
              <Badge variant='outline' className='text-xs'>
                {item.type === 'ticket' ? 'Ticket' : 'Task'}
              </Badge>
              {isQuickBucket && (
                <Badge variant='secondary' className='text-xs'>
                  Quick Bucket
                </Badge>
              )}
              {statusLabel && (
                <Badge variant='secondary' className='text-xs capitalize'>
                  {statusLabel}
                </Badge>
              )}
              {queueName && (
                <Badge variant='outline' className='text-xs flex items-center gap-1'>
                  <Layers className='h-3 w-3' />
                  {queueName}
                </Badge>
              )}
            </div>
            {item.type === 'task' && item.task?.ticketId && (
              <p className='text-xs text-muted-foreground'>Ticket #{item.task.ticketId}</p>
            )}
            {item.description && <p className='line-clamp-2 text-xs text-muted-foreground'>{item.description}</p>}
            {meta}
          </div>
        </div>
        <div className='flex flex-col items-end gap-2'>
          {trailing}
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Clock className='h-3 w-3' />
            {formatDistanceToNow(new Date(item.updated), { addSuffix: true })}
          </span>
        </div>
      </div>
    </button>
  )
}
