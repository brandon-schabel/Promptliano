/**
 * Real-time Log Viewer Component
 * Displays and streams process logs with filtering and search
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useProcessLogs } from '@/hooks/api/processes-hooks'
import {
  Button,
  Input,
  Badge,
  ScrollArea,
  Toggle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn
} from '@promptliano/ui'
import {
  Terminal,
  Search,
  Download,
  Trash2,
  Pause,
  Play,
  ChevronDown,
  AlertCircle,
  Info,
  Copy,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

// Log entry type
interface ProcessLog {
  id: number
  runId: number
  timestamp: number
  type: 'stdout' | 'stderr' | 'system'
  content: string
  lineNumber: number
}

interface LogViewerProps {
  projectId: number
  processId: string
  processName?: string
  className?: string
  maxLines?: number
}

export function LogViewer({ projectId, processId, processName, className, maxLines = 1000 }: LogViewerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [logType, setLogType] = useState<'all' | 'stdout' | 'stderr' | 'system'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  // toast imported from sonner

  // Fetch logs with auto-refresh when not paused
  const {
    data: logs = [],
    isLoading,
    refetch
  } = useProcessLogs(projectId, processId, {
    limit: maxLines,
    type: isPaused ? undefined : logType // Don't auto-refresh when paused
  })

  // Filter logs based on search and type
  const filteredLogs = logs.filter((log: ProcessLog) => {
    if (searchTerm && !log.content.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (logType !== 'all' && log.type !== logType) {
      return false
    }
    return true
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current && !isPaused) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [filteredLogs, autoScroll, isPaused])

  // Copy logs to clipboard
  const copyToClipboard = useCallback(() => {
    const logText = filteredLogs
      .map((log: ProcessLog) => `[${new Date(log.timestamp).toISOString()}] [${log.type}] ${log.content}`)
      .join('\n')

    navigator.clipboard
      .writeText(logText)
      .then(() => {
        toast.success('Copied to clipboard', { description: `${filteredLogs.length} log entries copied` })
      })
      .catch(() => {
        toast.error('Failed to copy', { description: 'Could not copy logs to clipboard' })
      })
  }, [filteredLogs, toast])

  // Export logs as file
  const exportLogs = useCallback(() => {
    const logText = filteredLogs
      .map((log: ProcessLog) => `[${new Date(log.timestamp).toISOString()}] [${log.type}] ${log.content}`)
      .join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${processName || processId}-logs-${Date.now()}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Logs exported', { description: `Exported ${filteredLogs.length} log entries` })
  }, [filteredLogs, processName, processId, toast])

  // Clear logs (local only)
  const [localLogs, setLocalLogs] = useState<ProcessLog[]>([])
  useEffect(() => {
    setLocalLogs(logs)
  }, [logs])

  const clearLogs = () => {
    setLocalLogs([])
    toast('Logs cleared', { description: 'Local log display cleared' })
  }

  // Log type colors and icons
  const getLogTypeStyle = (type: ProcessLog['type']) => {
    switch (type) {
      case 'stderr':
        return { color: 'text-red-500', icon: AlertCircle, label: 'ERROR' }
      case 'system':
        return { color: 'text-blue-500', icon: Info, label: 'SYSTEM' }
      case 'stdout':
      default:
        return { color: 'text-green-500', icon: Terminal, label: 'OUTPUT' }
    }
  }

  // Format log line
  const LogLine = ({ log }: { log: ProcessLog }) => {
    const style = getLogTypeStyle(log.type)
    const Icon = style.icon

    return (
      <div className='group flex items-start gap-2 py-1 px-2 hover:bg-muted/50 font-mono text-xs'>
        <span className='text-muted-foreground min-w-[60px] text-right'>{String(log.lineNumber).padStart(5, ' ')}</span>
        <Icon className={cn('h-3 w-3 mt-0.5 flex-shrink-0', style.color)} />
        <span className={cn('min-w-[60px] flex-shrink-0', style.color)}>[{style.label}]</span>
        <span className='text-muted-foreground min-w-[180px] flex-shrink-0'>
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <pre className='flex-1 whitespace-pre-wrap break-all'>{log.content}</pre>
      </div>
    )
  }

  const displayLogs = searchTerm || logType !== 'all' ? filteredLogs : localLogs

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header Controls */}
      <div className='flex flex-col gap-3 p-4 border-b'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Terminal className='h-5 w-5 text-muted-foreground' />
            <h3 className='font-semibold'>{processName || `Process ${processId.slice(0, 8)}`} Logs</h3>
            <Badge variant='outline' className='ml-2'>
              {displayLogs.length} lines
            </Badge>
          </div>

          <div className='flex items-center gap-2'>
            <Toggle
              pressed={!isPaused}
              onPressedChange={(pressed: boolean) => setIsPaused(!pressed)}
              size='sm'
              aria-label='Toggle auto-refresh'
            >
              {isPaused ? <Play className='h-4 w-4' /> : <Pause className='h-4 w-4' />}
            </Toggle>

            <Toggle
              pressed={autoScroll}
              onPressedChange={(pressed: boolean) => setAutoScroll(pressed)}
              size='sm'
              aria-label='Toggle auto-scroll'
            >
              <ChevronDown className='h-4 w-4' />
            </Toggle>

            <Button variant='ghost' size='sm' onClick={copyToClipboard} disabled={displayLogs.length === 0}>
              <Copy className='h-4 w-4' />
            </Button>

            <Button variant='ghost' size='sm' onClick={exportLogs} disabled={displayLogs.length === 0}>
              <Download className='h-4 w-4' />
            </Button>

            <Button variant='ghost' size='sm' onClick={clearLogs} disabled={localLogs.length === 0}>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search logs...'
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className='pl-8 h-8'
            />
          </div>

          <Select value={logType} onValueChange={(value: any) => setLogType(value)}>
            <SelectTrigger className='w-[140px] h-8'>
              <Filter className='h-4 w-4 mr-2' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Logs</SelectItem>
              <SelectItem value='stdout'>Output Only</SelectItem>
              <SelectItem value='stderr'>Errors Only</SelectItem>
              <SelectItem value='system'>System Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Log Display */}
      <ScrollArea ref={scrollAreaRef} className='flex-1 h-0'>
        <div className='p-2'>
          {isLoading && displayLogs.length === 0 ? (
            <div className='flex items-center justify-center h-32'>
              <div className='text-muted-foreground'>Loading logs...</div>
            </div>
          ) : displayLogs.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-32 gap-2'>
              <Terminal className='h-8 w-8 text-muted-foreground' />
              <div className='text-muted-foreground'>No logs yet</div>
              <div className='text-xs text-muted-foreground'>Logs will appear here when the process outputs data</div>
            </div>
          ) : (
            <div className='space-y-0'>
              {displayLogs.map((log: ProcessLog) => (
                <LogLine key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Status */}
      <div className='flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground'>
        <div className='flex items-center gap-4'>
          <span>{isPaused ? 'Paused' : 'Live'}</span>
          {!isPaused && (
            <span className='flex items-center gap-1'>
              <div className='h-2 w-2 bg-green-500 rounded-full animate-pulse' />
              Auto-refreshing
            </span>
          )}
        </div>

        {displayLogs.length > 0 && (
          <span>
            Last log:{' '}
            {formatDistanceToNow(new Date(displayLogs[displayLogs.length - 1].timestamp), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  )
}
