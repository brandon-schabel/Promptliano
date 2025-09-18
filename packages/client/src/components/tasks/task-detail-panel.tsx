import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator } from '@promptliano/ui'
import { ArrowUpRight, CheckCircle2, Clock, Hash, Loader2, ListPlus, Unlink } from 'lucide-react'
import { AddTaskToQueueDialog } from '@/components/tickets/add-task-to-queue-dialog'
import { useDequeueTask, useUpdateTask } from '@/hooks/api-hooks'
import type { FlowItem } from '@/hooks/api-hooks'

interface TaskDetailPanelProps {
  task: NonNullable<FlowItem['task']>
  projectId: number
  queueName?: string
  ticketTitle?: string
  onOpenTicket?: (ticketId: number) => void
  onRefresh?: () => void
}

export function TaskDetailPanel({ task, projectId, queueName, ticketTitle, onOpenTicket, onRefresh }: TaskDetailPanelProps) {
  const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const updateTask = useUpdateTask()
  const dequeueTask = useDequeueTask()

  const handleToggleDone = async () => {
    setIsUpdating(true)
    try {
      await updateTask.mutateAsync({
        ticketId: task.ticketId,
        taskId: task.id,
        data: { done: !task.done }
      })
      onRefresh?.()
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUnqueue = async () => {
    setIsUpdating(true)
    try {
      await dequeueTask.mutateAsync(task.id)
      onRefresh?.()
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div className='space-y-2'>
            <CardTitle className='text-lg font-semibold leading-tight'>{task.content}</CardTitle>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <Badge variant={task.done ? 'secondary' : 'outline'} className='flex items-center gap-1'>
                <CheckCircle2 className='h-3 w-3' />
                {task.done ? 'Completed' : 'Pending'}
              </Badge>
              {task.queueStatus && (
                <Badge variant='outline' className='capitalize'>
                  {task.queueStatus.replace('_', ' ')}
                </Badge>
              )}
              {queueName && (
                <Badge variant='outline' className='flex items-center gap-1'>
                  <ListPlus className='h-3 w-3' />
                  {queueName}
                </Badge>
              )}
              {ticketTitle && (
                <Badge variant='secondary' className='flex items-center gap-1'>
                  {ticketTitle}
                </Badge>
              )}
            </div>
          </div>
          <div className='flex flex-col gap-2'>
            <Button variant='outline' size='sm' onClick={handleToggleDone} disabled={isUpdating}>
              {isUpdating ? <Loader2 className='h-4 w-4 animate-spin' /> : task.done ? 'Mark as Pending' : 'Mark Complete'}
            </Button>
            {onOpenTicket && (
              <Button variant='ghost' size='sm' className='gap-1' onClick={() => onOpenTicket(task.ticketId)}>
                <ArrowUpRight className='h-4 w-4' /> View Ticket
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {task.description && (
            <div>
              <h4 className='text-sm font-medium mb-1'>Description</h4>
              <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{task.description}</p>
            </div>
          )}

          <div className='grid grid-cols-2 gap-4 text-xs text-muted-foreground'>
            <div>
              <p className='font-medium uppercase tracking-wide text-[0.65rem] text-muted-foreground'>Created</p>
              <p>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</p>
            </div>
            <div>
              <p className='font-medium uppercase tracking-wide text-[0.65rem] text-muted-foreground'>Updated</p>
              <p>{formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}</p>
            </div>
            {typeof task.orderIndex === 'number' && (
              <div>
                <p className='font-medium uppercase tracking-wide text-[0.65rem] text-muted-foreground'>Order</p>
                <p>#{task.orderIndex}</p>
              </div>
            )}
            {typeof task.queuePriority === 'number' && (
              <div>
                <p className='font-medium uppercase tracking-wide text-[0.65rem] text-muted-foreground'>Queue Priority</p>
                <p>{task.queuePriority}</p>
              </div>
            )}
          </div>

          {(task.tags?.length || task.suggestedFileIds?.length) && <Separator />}

          {task.tags && task.tags.length > 0 && (
            <div className='space-y-1'>
              <p className='flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                <Hash className='h-3 w-3' /> Tags
              </p>
              <div className='flex flex-wrap gap-1'>
                {task.tags.map((tag: string) => (
                  <Badge key={tag} variant='outline' className='text-xs'>
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {task.suggestedFileIds && task.suggestedFileIds.length > 0 && (
            <div className='space-y-1 text-xs text-muted-foreground'>
              <p className='font-medium uppercase tracking-wide text-[0.65rem] text-muted-foreground'>Suggested Files</p>
              <ul className='list-disc pl-5 space-y-1'>
                {task.suggestedFileIds.map((fileId: string) => (
                  <li key={fileId}>{fileId}</li>
                ))}
              </ul>
            </div>
          )}

          <Separator />

          <div className='flex flex-wrap gap-2'>
            {task.queueId ? (
              <Button variant='outline' size='sm' className='gap-1' onClick={handleUnqueue} disabled={isUpdating}>
                {isUpdating ? <Loader2 className='h-4 w-4 animate-spin' /> : <Unlink className='h-4 w-4' />}
                Unqueue Task
              </Button>
            ) : (
              <Button variant='default' size='sm' className='gap-1' onClick={() => setIsQueueDialogOpen(true)}>
                <ListPlus className='h-4 w-4' /> Add to Queue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AddTaskToQueueDialog
        isOpen={isQueueDialogOpen}
        onClose={() => {
          setIsQueueDialogOpen(false)
          onRefresh?.()
        }}
        task={task as any}
        projectId={projectId}
        ticketQueueId={task.queueId ?? null}
        ticketQueueName={queueName ?? undefined}
      />
    </div>
  )
}
