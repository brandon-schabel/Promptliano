import React, { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Textarea,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Alert,
  AlertDescription,
  Slider
} from '@promptliano/ui'
import { Loader2, Bot, Inbox, ListTodo, ListPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateTicket,
  useCreateTask,
  useEnqueueTask,
  useAutoGenerateTasks,
  useGetFlowData
} from '@/hooks/api-hooks'
import { useTickets } from '@/hooks/generated'
import type { Ticket } from '@/hooks/generated/types'
import { FLOW_QUICK_TICKET_MARKER, isQuickBucketOverview, extractQuickBucketQueueId } from '@/constants/flow'

interface TaskQuickCreateDialogProps {
  open: boolean
  onClose: () => void
  projectId: number
  ticketId?: number
  ticketTitle?: string
  ticketOverview?: string | null
  queueId?: number
  queueName?: string
  defaultQueuePriority?: number
  onCreated?: (taskId: number) => void
}

const PRIORITY_MIN = 1
const PRIORITY_MAX = 10

function extractPayload<T>(result: any): T {
  if (!result) return result
  if (typeof result === 'object' && 'data' in result) {
    return (result as any).data as T
  }
  return result as T
}

export function TaskQuickCreateDialog({
  open,
  onClose,
  projectId,
  ticketId,
  ticketTitle,
  ticketOverview,
  queueId,
  queueName,
  defaultQueuePriority = 5,
  onCreated
}: TaskQuickCreateDialogProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(ticketId ?? null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shouldQueue, setShouldQueue] = useState(Boolean(queueId))
  const [priority, setPriority] = useState(defaultQueuePriority)
  const [useQuickBucket, setUseQuickBucket] = useState(Boolean(queueId))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTicket = useCreateTicket()
  const createTask = useCreateTask()
  const enqueueTask = useEnqueueTask()
  const autoGenerateTasks = useAutoGenerateTasks()

  const { data: ticketsData } = (useTickets as any)({ projectId }) as { data?: Ticket[] }
  const { data: flowData } = useGetFlowData(projectId, open)

  const tickets = useMemo(() => ticketsData ?? [], [ticketsData])

  const quickBucketTicketId = useMemo(() => {
    if (!queueId) return null

    const fromFlow = (() => {
      if (!flowData) return null
      const candidates: Ticket[] = []

      Object.values(flowData.queues ?? {}).forEach((entry: any) => {
        entry?.tickets?.forEach((ticket: any) => candidates.push(ticket as Ticket))
      })
      flowData.unqueued?.tickets?.forEach((ticket: any) => candidates.push(ticket as Ticket))

      const match = candidates.find((ticket) => {
        if (!isQuickBucketOverview(ticket.overview)) return false
        return extractQuickBucketQueueId(ticket.overview) === queueId
      })
      return match?.id ?? null
    })()

    if (fromFlow) return fromFlow

    const match = tickets.find((ticket) => {
      if (!isQuickBucketOverview((ticket as any).overview)) return false
      return extractQuickBucketQueueId((ticket as any).overview) === queueId
    })
    return match?.id ?? null
  }, [flowData, tickets, queueId])

  const selectableTickets = useMemo(() => {
    return tickets.filter((ticket) => !isQuickBucketOverview((ticket as any).overview))
  }, [tickets])

  const isTicketLocked = Boolean(ticketId) && !queueId
  const showTicketSelector = !isTicketLocked
  const showGenerateButton = Boolean(ticketId && ticketOverview)

  useEffect(() => {
    if (!open) return
    setSelectedTicketId(ticketId ?? null)
    setTitle('')
    setDescription('')
    setError(null)
    setIsSubmitting(false)
    setShouldQueue(Boolean(queueId))
    setUseQuickBucket(Boolean(queueId))
    setPriority(defaultQueuePriority)
  }, [open, ticketId, queueId, defaultQueuePriority])

  useEffect(() => {
    if (!open || !queueId || !useQuickBucket) return
    if (quickBucketTicketId) {
      setSelectedTicketId(quickBucketTicketId)
    }
  }, [open, queueId, useQuickBucket, quickBucketTicketId])

  const ensureQuickBucketTicket = async () => {
    if (!queueId) throw new Error('Queue context required to create quick task bucket')
    if (quickBucketTicketId) return quickBucketTicketId

    const titleBase = `${queueName || 'Queue'} Quick Tasks`
    const overview = [
      FLOW_QUICK_TICKET_MARKER,
      `Queue:${queueId}`,
      queueName ? `QueueName:${queueName}` : undefined,
      'Auto-generated ticket for queue-level quick tasks.'
    ]
      .filter(Boolean)
      .join('\n')

    const response = await createTicket.mutateAsync({
      projectId,
      title: titleBase,
      overview,
      priority: 'normal',
      status: 'open',
      suggestedFileIds: [],
      suggestedAgentIds: [],
      suggestedPromptIds: []
    })

    const created = extractPayload<Ticket>(response)
    if (!created?.id) {
      throw new Error('Failed to create quick task ticket')
    }
    return created.id
  }

  const resolveTargetTicketId = async () => {
    if (selectedTicketId) return selectedTicketId
    if (queueId && useQuickBucket) {
      return ensureQuickBucketTicket()
    }
    throw new Error('Please select a ticket for the new task')
  }

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Task summary is required')
      return
    }

    setIsSubmitting(true)
    try {
      const targetTicketId = await resolveTargetTicketId()
      const taskResult = await createTask.mutateAsync({
        ticketId: targetTicketId,
        data: {
          ticketId: targetTicketId,
          content: title.trim(),
          description: description.trim() || null,
          agentId: null,
          tags: [],
          dependencies: [],
          suggestedFileIds: [],
          suggestedPromptIds: [],
          estimatedHours: null
        }
      })

      const createdTask = extractPayload<any>(taskResult)
      const createdTaskId = createdTask?.id
      if (!createdTaskId) {
        throw new Error('Task creation succeeded but an id was not returned')
      }

      if (queueId && shouldQueue) {
        await enqueueTask.mutateAsync({
          taskId: createdTaskId,
          queueId,
          priority: PRIORITY_MAX - priority
        })
      }

      toast.success('Task created successfully')
      onCreated?.(createdTaskId)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateFromOverview = async () => {
    if (!ticketId) return
    setError(null)
    setIsSubmitting(true)
    try {
      await autoGenerateTasks.mutateAsync(ticketId)
      toast.success('AI generated tasks added to the ticket')
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to generate tasks')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !isSubmitting && onClose()}>
      <DialogContent className='sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ListTodo className='h-4 w-4 text-muted-foreground' />
            Quick Add Task
          </DialogTitle>
          <DialogDescription>
            Create a lightweight task {queueName ? `for ${queueName}` : ticketTitle ? `for ${ticketTitle}` : 'for this project'}.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-2'>
          {showTicketSelector && (
            <div className='space-y-2'>
              <Label>Ticket</Label>
              {queueId ? (
                <div className='rounded-md border p-3 space-y-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <div>
                      <p className='text-sm font-medium'>Use quick task bucket</p>
                      <p className='text-xs text-muted-foreground'>Automatically manage queue-specific quick tasks.</p>
                    </div>
                    <Switch checked={useQuickBucket} onCheckedChange={setUseQuickBucket} />
                  </div>
                  <Select
                    value={selectedTicketId ? String(selectedTicketId) : ''}
                    onValueChange={(value) => setSelectedTicketId(value ? Number(value) : null)}
                    disabled={useQuickBucket}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select ticket' />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableTickets.length === 0 ? (
                        <SelectItem value='' disabled>
                          No tickets found
                        </SelectItem>
                      ) : (
                        selectableTickets.map((ticket) => (
                          <SelectItem key={ticket.id} value={ticket.id.toString()}>
                            {ticket.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Select
                  value={selectedTicketId ? String(selectedTicketId) : ''}
                  onValueChange={(value) => setSelectedTicketId(value ? Number(value) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select ticket' />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableTickets.length === 0 ? (
                      <SelectItem value='' disabled>
                        No tickets found
                      </SelectItem>
                    ) : (
                      selectableTickets.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id.toString()}>
                          {ticket.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {!showTicketSelector && ticketTitle && (
            <div className='flex items-center gap-2 rounded-md border p-3 text-sm'>
              <Badge variant='outline'>Ticket</Badge>
              <span className='font-medium'>{ticketTitle}</span>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='task-summary'>Task summary</Label>
            <Input
              id='task-summary'
              placeholder='Describe the work to be completed'
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='task-description'>Details (optional)</Label>
            <Textarea
              id='task-description'
              placeholder='Add context or acceptance criteria'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>

          {queueId && (
            <div className='rounded-md border p-3 space-y-4'>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <Label className='text-sm font-medium'>Queue immediately</Label>
                  <p className='text-xs text-muted-foreground'>Send this task straight into the queue.</p>
                </div>
                <Switch checked={shouldQueue} onCheckedChange={setShouldQueue} />
              </div>
              <div className='space-y-2 text-xs text-muted-foreground'>
                <div className='flex items-center justify-between'>
                  <span>Priority</span>
                  <span>{priority >= 8 ? 'High' : priority >= 4 ? 'Normal' : 'Low'} · {priority}</span>
                </div>
                <Slider
                  min={PRIORITY_MIN}
                  max={PRIORITY_MAX}
                  step={1}
                  value={[priority]}
                  onValueChange={([value]) => setPriority(value)}
                  disabled={!shouldQueue}
                />
              </div>
            </div>
          )}

          {showGenerateButton && (
            <Alert className='border-dashed'>
              <Bot className='h-4 w-4' />
              <AlertDescription className='flex items-center justify-between gap-3'>
                Generate tasks from the ticket overview using AI.
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleGenerateFromOverview}
                  disabled={isSubmitting}
                  className='gap-1'
                >
                  {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <ListPlus className='h-4 w-4' />}
                  Generate
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {error && <p className='text-sm text-destructive'>{error}</p>}

          {!ticketId && !queueId && selectableTickets.length === 0 && (
            <div className='flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
              <Inbox className='mb-3 h-6 w-6' />
              <p>Create a ticket first to attach tasks.</p>
            </div>
          )}
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='outline' onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (!selectedTicketId && !(queueId && useQuickBucket)) ||
              (!ticketId && !queueId && selectableTickets.length === 0)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving...
              </>
            ) : (
              'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
