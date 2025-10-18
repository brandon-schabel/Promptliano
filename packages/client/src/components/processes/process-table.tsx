/**
 * Process Table Component
 * Displays running and historical processes with DataTable
 */

import React from 'react'
import { useState, useEffect } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@promptliano/ui'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Input,
  Badge,
  cn
} from '@promptliano/ui'

import {
  MoreHorizontal,
  Play,
  Square,
  Terminal,
  Trash2,
  RefreshCw,
  ChevronDown,
  Activity,
  Clock,
  Cpu,
  HardDrive,
  ArrowUpDown
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

// Process type based on database schema
interface ProcessRun {
  id: number
  projectId: number
  processId: string
  pid?: number
  name?: string
  command: string
  args: string[]
  cwd: string
  status: 'running' | 'stopped' | 'exited' | 'error' | 'killed'
  exitCode?: number
  signal?: string
  startedAt: number
  exitedAt?: number
  cpuUsage?: number
  memoryUsage?: number
  scriptName?: string
  scriptType?: 'npm' | 'bun' | 'yarn' | 'pnpm' | 'custom'
}

interface ProcessTableProps {
  projectId: number
  onProcessSelect?: (process: ProcessRun) => void
  showHistory?: boolean
}

export function ProcessTable({ projectId, onProcessSelect, showHistory = false }: ProcessTableProps) {
  const [processes, setProcesses] = useState<ProcessRun[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')
  // Using fetch-based calls; generated client hooks exist elsewhere

  // Fetch processes
  const fetchProcesses = async () => {
    try {
      setLoading(true)
      const endpoint = showHistory
        ? `/api/projects/${projectId}/processes/history`
        : `/api/projects/${projectId}/processes`

      const res = await fetch(endpoint)
      if (res.ok) {
        const json = await res.json()
        if (json?.success) setProcesses(json.data)
      }
    } catch (error: any) {
      toast.error('Failed to fetch processes')
    } finally {
      setLoading(false)
    }
  }

  // Stop process
  const stopProcess = async (processId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/processes/${processId}/stop`, { method: 'POST' })
      if (res.ok) {
        toast.success('Process stopped successfully')
        fetchProcesses()
      }
    } catch (error: any) {
      toast.error('Failed to stop process')
    }
  }

  // Restart process
  const restartProcess = async (process: ProcessRun) => {
    try {
      // Stop the process first
      await stopProcess(process.processId)

      // Start it again
      const res = await fetch(`/api/projects/${projectId}/processes/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: process.command,
          args: process.args,
          cwd: process.cwd,
          scriptName: process.scriptName,
          scriptType: process.scriptType
        })
      })
      if (res.ok) {
        toast.success('Process restarted successfully')
        fetchProcesses()
      }
    } catch (error: any) {
      toast.error('Failed to restart process')
    }
  }

  useEffect(() => {
    fetchProcesses()

    // Refresh every 5 seconds if showing running processes
    if (!showHistory) {
      const interval = setInterval(fetchProcesses, 5000)
      return () => clearInterval(interval)
    }
  }, [projectId, showHistory])

  // Status badge component
  const StatusBadge = ({ status }: { status: ProcessRun['status'] }) => {
    const variants: Record<ProcessRun['status'], { className: string; label: string }> = {
      running: { className: 'bg-green-100 text-green-800', label: 'Running' },
      stopped: { className: 'bg-yellow-100 text-yellow-800', label: 'Stopped' },
      exited: { className: 'bg-gray-100 text-gray-800', label: 'Exited' },
      error: { className: 'bg-red-100 text-red-800', label: 'Error' },
      killed: { className: 'bg-orange-100 text-orange-800', label: 'Killed' }
    }

    const variant = variants[status]
    return <Badge className={cn('font-medium', variant.className)}>{variant.label}</Badge>
  }

  // Column definitions
  const columns: ColumnDef<ProcessRun>[] = [
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Status
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <StatusBadge status={row.getValue('status')} />
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const name = row.getValue('name') as string | undefined
        const scriptName = row.original.scriptName
        const processId = row.original.processId

        return (
          <div className='flex items-center gap-2'>
            <Terminal className='h-4 w-4 text-muted-foreground' />
            <span className='font-medium'>{name || scriptName || processId.slice(0, 8)}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'command',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Command
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const command = row.getValue('command') as string
        const args = row.original.args

        return (
          <code className='text-xs bg-muted px-2 py-1 rounded'>
            {command} {args.join(' ')}
          </code>
        )
      }
    },
    {
      accessorKey: 'pid',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          PID
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      filterFn: 'includesString',
      cell: ({ row }) => {
        const pid = row.getValue('pid') as number | undefined
        return pid ? (
          <span className='text-muted-foreground'>{pid}</span>
        ) : (
          <span className='text-muted-foreground'>-</span>
        )
      }
    },
    {
      accessorKey: 'startedAt',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Started
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const startedAt = row.getValue('startedAt') as number
        return (
          <div className='flex items-center gap-1'>
            <Clock className='h-3 w-3 text-muted-foreground' />
            <span className='text-sm text-muted-foreground'>
              {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}
            </span>
          </div>
        )
      }
    },
    {
      accessorKey: 'cpuUsage',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          CPU
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const cpu = row.getValue('cpuUsage') as number | undefined
        return cpu !== undefined ? (
          <div className='flex items-center gap-1'>
            <Cpu className='h-3 w-3 text-muted-foreground' />
            <span className='text-sm'>{cpu.toFixed(1)}%</span>
          </div>
        ) : (
          <span className='text-muted-foreground'>-</span>
        )
      }
    },
    {
      accessorKey: 'memoryUsage',
      header: ({ column }) => (
        <Button
          variant='ghost'
          className='h-8 -ml-2'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Memory
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const memory = row.getValue('memoryUsage') as number | undefined
        return memory !== undefined ? (
          <div className='flex items-center gap-1'>
            <HardDrive className='h-3 w-3 text-muted-foreground' />
            <span className='text-sm'>{(memory / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        ) : (
          <span className='text-muted-foreground'>-</span>
        )
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const process = row.original
        const isRunning = process.status === 'running'

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Open menu</span>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onProcessSelect?.(process)} className='cursor-pointer'>
                <Activity className='mr-2 h-4 w-4' />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isRunning ? (
                <DropdownMenuItem onClick={() => stopProcess(process.processId)} className='cursor-pointer'>
                  <Square className='mr-2 h-4 w-4' />
                  Stop Process
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => restartProcess(process)} className='cursor-pointer'>
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Restart Process
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  const table = useReactTable({
    data: processes,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter
    }
  })

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Input
            placeholder='Search processes...'
            value={globalFilter}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
            className='h-8 w-[220px] lg:w-[280px]'
          />
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={fetchProcesses} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm'>
                Columns <ChevronDown className='ml-2 h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className='capitalize'
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className='rounded-md border border-border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onProcessSelect?.(row.original)}
                  className='cursor-pointer'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  {loading ? 'Loading...' : 'No processes found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-start text-sm text-muted-foreground'>
        {table.getFilteredRowModel().rows.length} process(es)
      </div>
    </div>
  )
}
