import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Card, CardContent } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Slider } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { useGetQueuesWithStats } from '@/hooks/generated'
import { useEnqueueTicket } from '@/hooks/generated'
import { toast } from 'sonner'
import { Inbox, Clock, CheckCircle2, AlertCircle, Pause, Play, Loader2, ListPlus } from 'lucide-react'
// QueueWithStats type not used - queue data comes from hook with different structure

interface AddToQueueDialogProps {
  isOpen: boolean
  onClose: () => void
  ticketId: number
  projectId: number
  ticketTitle?: string
}

export function AddToQueueDialog({ isOpen, onClose, ticketId, projectId, ticketTitle }: AddToQueueDialogProps) {
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null)
  const [priority, setPriority] = useState(5)

  const { data: queues, isLoading } = useGetQueuesWithStats(projectId)
  const enqueueTicket = useEnqueueTicket()

  const handleAddToQueue = async () => {
    if (!selectedQueueId) {
      toast.error('Please select a queue')
      return
    }

    try {
      await enqueueTicket.mutateAsync({
        ticketId,
        queueId: selectedQueueId,
        priority: 10 - priority // Invert for UI (higher slider = higher priority)
      })

      toast.success('Ticket added to queue successfully')
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add ticket to queue')
    }
  }

  const getQueueStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className='h-3 w-3' />
      case 'paused':
        return <Pause className='h-3 w-3' />
      default:
        return <Clock className='h-3 w-3' />
    }
  }

  const getQueueItemCount = (stats: any) => {
    const total = (stats?.pending || 0) + (stats?.processing || 0)
    return total
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ListPlus className='h-5 w-5' />
            Add to Queue
          </DialogTitle>
          <DialogDescription>
            {ticketTitle ? `Select a queue for "${ticketTitle}"` : 'Select a queue to add this ticket for processing'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Queue Selection */}
          <div className='space-y-2'>
            <Label>Available Queues</Label>
            {isLoading ? (
              <div className='space-y-2'>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className='h-16 w-full' />
                ))}
              </div>
            ) : queues && queues.length > 0 ? (
              <ScrollArea className='h-[280px] pr-4'>
                <RadioGroup
                  value={selectedQueueId?.toString()}
                  onValueChange={(value) => setSelectedQueueId(parseInt(value))}
                >
                  <div className='space-y-2'>
                    {queues.map((raw: any, index: number) => {
                      // Support both shapes: { queue, stats } and flattened queue object
                      const q = raw?.queue ?? raw
                      const stats = raw?.stats ?? raw?.stats ?? {}
                      if (!q?.id) return null

                      const isSelected = selectedQueueId === q.id
                      const status = (q.status as string) ?? (q.isActive ? 'active' : 'paused')
                      const itemCount = getQueueItemCount(stats)

                      return (
                        <div key={q.id ?? index} className='relative'>
                          <RadioGroupItem value={q.id?.toString?.()} id={`queue-${q.id}`} className='peer sr-only' />
                          <Label htmlFor={`queue-${q.id}`} className='cursor-pointer'>
                            <Card
                              className={cn(
                                'transition-all hover:shadow-md',
                                isSelected && 'ring-2 ring-primary shadow-md',
                                (status ?? 'active') === 'paused' && 'opacity-60'
                              )}
                            >
                              <CardContent className='p-3'>
                                <div className='flex items-start justify-between'>
                                  <div className='flex-1'>
                                    <div className='flex items-center gap-2 mb-1'>
                                      <Inbox className='h-4 w-4 text-muted-foreground' />
                                      <span className='font-medium'>{q.name}</span>
                                    </div>
                                    {q.description && (
                                      <p className='text-xs text-muted-foreground mb-2 line-clamp-1'>{q.description}</p>
                                    )}
                                    <div className='flex items-center gap-3 text-xs'>
                                      <Badge variant='secondary' className='text-xs'>
                                        {getQueueStatusIcon(status ?? 'inactive')}
                                        <span className='ml-1'>{status ?? 'inactive'}</span>
                                      </Badge>
                                      <span className='text-muted-foreground'>
                                        {itemCount === 0 ? 'Empty' : itemCount === 1 ? '1 item' : `${itemCount} items`}
                                      </span>
                                      {(stats?.failed || 0) > 0 && (
                                        <span className='flex items-center gap-1 text-red-600'>
                                          <AlertCircle className='h-3 w-3' />
                                          {stats.failed} failed
                                        </span>
                                      )}
                                      {(stats?.completed || 0) > 0 && (
                                        <span className='flex items-center gap-1 text-green-600'>
                                          <CheckCircle2 className='h-3 w-3' />
                                          {stats.completed}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </RadioGroup>
              </ScrollArea>
            ) : (
              <div className='text-center py-8 text-muted-foreground'>
                <Inbox className='h-12 w-12 mx-auto mb-3 opacity-50' />
                <p className='text-sm'>No queues available</p>
                <p className='text-xs mt-1'>Create a queue first to start processing tickets</p>
              </div>
            )}
          </div>

          {/* Priority Slider */}
          {queues && queues.length > 0 && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='priority'>Priority</Label>
                <span className='text-sm text-muted-foreground'>
                  {priority === 10 ? 'Highest' : priority >= 7 ? 'High' : priority >= 4 ? 'Medium' : 'Low'}
                </span>
              </div>
              <Slider
                id='priority'
                min={1}
                max={10}
                step={1}
                value={[priority]}
                onValueChange={([value]) => setPriority(value)}
                className='w-full'
              />
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToQueue}
            disabled={!selectedQueueId || enqueueTicket.isPending || !queues || queues.length === 0}
          >
            {enqueueTicket.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Adding...
              </>
            ) : (
              <>
                <ListPlus className='mr-2 h-4 w-4' />
                Add to Queue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
