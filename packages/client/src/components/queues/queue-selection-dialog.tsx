import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Card, CardContent } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Slider } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { useGetQueuesWithStats } from '@/hooks/generated'
import { useEnqueueTicket } from '@/hooks/generated'
import { toast } from 'sonner'
import { Inbox, Users, Clock, CheckCircle2, AlertCircle, Pause, Play, Loader2, ListTodo } from 'lucide-react'
// QueueWithStats type not used - queue data comes from hook with different structure

interface QueueSelectionDialogProps {
  isOpen: boolean
  onClose: () => void
  ticketId: number
  projectId: number
}

export function QueueSelectionDialog({ isOpen, onClose, ticketId, projectId }: QueueSelectionDialogProps) {
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null)
  const [priority, setPriority] = useState(5)
  const [includeTasks, setIncludeTasks] = useState(true)

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
        priority: 10 - priority, // Invert for UI (higher slider = higher priority)
        includeTasks
      })

      toast.success(includeTasks ? 'Ticket and tasks added to queue' : 'Ticket added to queue')
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

  const getQueueHealth = (queueData: { queue: any; stats: any }) => {
    const { stats } = queueData
    const total = stats?.totalItems || stats?.total || 0
    const failed = stats?.failed || 0
    const completed = stats?.completed || stats?.completedItems || 0
    const processing = stats?.processing || stats?.inProgressItems || 0

    if (total === 0) return 'empty'
    if (failed > total * 0.2) return 'unhealthy'
    if (completed === total && total > 0) return 'complete'
    if (processing > 0) return 'active'
    return 'healthy'
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'unhealthy':
        return 'text-red-500 bg-red-50 dark:bg-red-950'
      case 'complete':
        return 'text-green-500 bg-green-50 dark:bg-green-950'
      case 'active':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-950'
      case 'empty':
        return 'text-gray-500 bg-gray-50 dark:bg-gray-950'
      default:
        return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Add Ticket to Queue</DialogTitle>
          <DialogDescription>Select a queue to add this ticket to for processing</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Queue Selection */}
          <div className='space-y-2'>
            <Label>Select Queue</Label>
            {isLoading ? (
              <div className='space-y-2'>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className='h-20 w-full' />
                ))}
              </div>
            ) : (
              <ScrollArea className='h-[300px] pr-4'>
                <RadioGroup
                  value={selectedQueueId?.toString()}
                  onValueChange={(value) => setSelectedQueueId(parseInt(value))}
                >
                  <div className='space-y-2'>
                    {queues?.map((queueData: any) => {
                      const health = getQueueHealth({ queue: queueData, stats: queueData.stats })
                      const healthColor = getHealthColor(health)
                      const isSelected = selectedQueueId === queueData.id

                      return (
                        <div key={queueData.id} className='relative'>
                          <RadioGroupItem
                            value={queueData.id.toString()}
                            id={`queue-${queueData.id}`}
                            className='peer sr-only'
                          />
                          <Label htmlFor={`queue-${queueData.id}`} className='cursor-pointer'>
                            <Card
                              className={cn(
                                'transition-all hover:shadow-md',
                                isSelected && 'ring-2 ring-primary shadow-md',
                                (queueData.status ?? 'active') === 'paused' && 'opacity-60'
                              )}
                            >
                              <CardContent className='p-4'>
                                <div className='flex items-start justify-between mb-2'>
                                  <div className='flex items-center gap-2'>
                                    <Inbox className='h-4 w-4 text-muted-foreground' />
                                    <span className='font-semibold'>{queueData.name}</span>
                                    <Badge variant='outline' className='text-xs'>
                                      {getQueueStatusIcon(queueData.status ?? 'inactive')}
                                      {queueData.status ?? 'inactive'}
                                    </Badge>
                                  </div>
                                  <Badge className={cn('text-xs', healthColor)}>{health}</Badge>
                                </div>

                                {queueData.description && (
                                  <p className='text-sm text-muted-foreground mb-2'>{queueData.description}</p>
                                )}

                                <div className='grid grid-cols-4 gap-2 text-xs'>
                                  <div className='flex items-center gap-1'>
                                    <Clock className='h-3 w-3 text-blue-500' />
                                    <span>{queueData.stats?.pending || 0} queued</span>
                                  </div>
                                  <div className='flex items-center gap-1'>
                                    <Loader2 className='h-3 w-3 text-amber-500' />
                                    <span>{queueData.stats?.processing || 0} active</span>
                                  </div>
                                  <div className='flex items-center gap-1'>
                                    <CheckCircle2 className='h-3 w-3 text-green-500' />
                                    <span>{queueData.stats?.completed || 0} done</span>
                                  </div>
                                  <div className='flex items-center gap-1'>
                                    <AlertCircle className='h-3 w-3 text-red-500' />
                                    <span>{queueData.stats?.failed || 0} failed</span>
                                  </div>
                                </div>

                                {queueData.stats?.currentAgents && queueData.stats.currentAgents.length > 0 && (
                                  <div className='mt-2 flex items-center gap-1 text-xs text-muted-foreground'>
                                    <Users className='h-3 w-3' />
                                    <span>Agents: {queueData.stats.currentAgents.join(', ')}</span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </RadioGroup>
              </ScrollArea>
            )}
          </div>

          {/* Priority Slider */}
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
              <span>High</span>
            </div>
          </div>

          {/* Include Tasks Toggle */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='include-tasks' className='flex items-center gap-2'>
                <ListTodo className='h-4 w-4' />
                Include All Tasks
              </Label>
              <p className='text-xs text-muted-foreground'>Add all tasks from this ticket to the queue</p>
            </div>
            <Switch id='include-tasks' checked={includeTasks} onCheckedChange={setIncludeTasks} />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddToQueue} disabled={!selectedQueueId || enqueueTicket.isPending}>
            {enqueueTicket.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Adding...
              </>
            ) : (
              'Add to Queue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
