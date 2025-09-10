import React, { useMemo } from 'react'
import { 
  Button, 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@promptliano/ui'
import { useListProcesses, useStopProcess, useProcessHistory } from '@/hooks/api/processes-hooks'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Loader2, Square, Terminal, Copy, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type ProcessesRunningListProps = {
  projectId: number
  projectName?: string
  className?: string
}

export function ProcessesRunningList({ projectId, projectName, className }: ProcessesRunningListProps) {
  const { data: processes = [], isLoading, refetch } = useListProcesses(projectId)
  // Increase history limit to show more completed processes (no pagination)
  const { data: historicalProcesses = [], isLoading: historyLoading } = useProcessHistory(projectId, 1000, 0)
  const stopMutation = useStopProcess(projectId)
  const { copyToClipboard } = useCopyClipboard()

  // Process filtering and deduplication
  const { runningProcesses, completedProcesses } = useMemo(() => {
    const running = processes.filter((p: any) => p.status === 'running')
    
    // Get completed processes from current list and historical data
    const currentCompleted = processes.filter((p: any) => p.status !== 'running')
    
    // Combine and deduplicate completed processes (prefer current over historical)
    const allCompleted = [...currentCompleted]
    const currentIds = new Set(currentCompleted.map((p: any) => p.id))
    
    // Add historical processes that aren't already in current completed
    historicalProcesses.forEach((p: any) => {
      if (!currentIds.has(p.id) && p.status !== 'running') {
        allCompleted.push(p)
      }
    })

    // Sort completed processes by completion time (most recent first)
    const completed = allCompleted.sort((a: any, b: any) => {
      const aTime = a.exitedAt || a.updatedAt || a.createdAt || 0
      const bTime = b.exitedAt || b.updatedAt || b.createdAt || 0
      return bTime - aTime
    })

    return { runningProcesses: running, completedProcesses: completed }
  }, [processes, historicalProcesses])

  const handleCopyOutput = (process: any) => {
    if (process.lastOutput?.stdout?.length || process.lastOutput?.stderr?.length) {
      const outputText = [...(process.lastOutput.stderr || []), ...(process.lastOutput.stdout || [])]
        .slice(-20)
        .join('\n')
      
      copyToClipboard(outputText, {
        successMessage: 'Process output copied to clipboard',
        errorMessage: 'Failed to copy output'
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Terminal className='h-4 w-4' />
      case 'exited':
        return <CheckCircle className='h-4 w-4 text-green-500' />
      case 'error':
      case 'killed':
        return <XCircle className='h-4 w-4 text-red-500' />
      case 'stopped':
        return <AlertCircle className='h-4 w-4 text-yellow-500' />
      default:
        return <Terminal className='h-4 w-4' />
    }
  }

  const renderProcess = (p: any, showStopButton: boolean = false) => (
    <div key={p.id} className='rounded-md border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          {getStatusIcon(p.status)}
          <div className='font-medium'>{p.name || p.command}</div>
          <div className='flex items-center gap-1'>
            <div className='text-xs text-muted-foreground'>PID {p.pid ?? '—'}</div>
            {p.pid ? (
              <Button
                size='icon'
                variant='ghost'
                className='h-6 w-6'
                onClick={() =>
                  copyToClipboard(String(p.pid), {
                    successMessage: 'PID copied to clipboard',
                    errorMessage: 'Failed to copy PID'
                  })
                }
                title='Copy PID'
              >
                <Copy className='h-3 w-3' />
              </Button>
            ) : null}
          </div>
          <div className='text-xs'>•</div>
          <div className='text-xs capitalize'>{p.status}</div>
          {p.exitCode !== undefined && p.exitCode !== null && (
            <>
              <div className='text-xs'>•</div>
              <div className={`text-xs ${p.exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
                Exit {p.exitCode}
              </div>
            </>
          )}
          {p.exitedAt && (
            <>
              <div className='text-xs'>•</div>
              <div className='text-xs text-muted-foreground'>
                {formatDistanceToNow(new Date(p.exitedAt), { addSuffix: true })}
              </div>
            </>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {showStopButton && p.status === 'running' && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => stopMutation.mutate(p.id)}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <Loader2 className='h-3.5 w-3.5 mr-1 animate-spin' />
              ) : (
                <Square className='h-3.5 w-3.5 mr-1' />
              )}
              Stop
            </Button>
          )}
        </div>
      </div>
      {(p.lastOutput?.stdout?.length || p.lastOutput?.stderr?.length) && (
        <div className='mt-2 relative'>
          <pre className='max-h-48 overflow-auto rounded bg-muted p-2 pr-10 text-xs'>
            {[...(p.lastOutput.stderr || []), ...(p.lastOutput.stdout || [])]
              .slice(-20)
              .map((line: string, idx: number) => (
                <div key={idx}>{line}</div>
              ))}
          </pre>
          <Button
            size='icon'
            variant='ghost'
            className='absolute top-2 right-2 h-6 w-6 bg-background/80 hover:bg-background'
            onClick={() => handleCopyOutput(p)}
            title='Copy output to clipboard'
          >
            <Copy className='h-3 w-3' />
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Running Processes</CardTitle>
          <CardDescription>Manage and monitor processes started from this project</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Running Processes Section */}
          {isLoading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' /> Loading processes...
            </div>
          ) : runningProcesses.length === 0 ? (
            <div className='text-sm text-muted-foreground'>No running processes. Start one using the button above.</div>
          ) : (
            <div className='space-y-3'>
              {runningProcesses.map((p: any) => renderProcess(p, true))}
            </div>
          )}

          {/* Completed Processes Accordion */}
          {completedProcesses.length > 0 && (
            <Accordion type='single' collapsible className='w-full'>
              <AccordionItem value='completed-processes' className='border rounded-md'>
                <AccordionTrigger className='px-4 py-3 hover:no-underline'>
                  <div className='flex items-center gap-2 text-sm'>
                    <AlertCircle className='h-4 w-4 text-muted-foreground' />
                    <span>Completed Processes ({completedProcesses.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className='px-4 pb-4'>
                  {historyLoading ? (
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                      <Loader2 className='h-4 w-4 animate-spin' /> Loading completed processes...
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      {completedProcesses.map((p: any) => renderProcess(p, false))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
