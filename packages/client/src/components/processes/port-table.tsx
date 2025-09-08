/**
 * Port Management Table Component
 * Displays and manages ports used by processes
 */

import React from 'react'
import { useState, useEffect } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Badge,
  cn
} from '@promptliano/ui'
import { Network, XCircle, RefreshCw, Wifi, WifiOff, Search, Terminal, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { useProcessPorts, useKillByPort, useScanPorts } from '@/hooks/api/processes-hooks'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@promptliano/ui'

// Port type based on database schema
interface ProcessPort {
  id: number
  projectId: number
  runId?: number
  port: number
  protocol: 'tcp' | 'udp'
  address: string
  pid?: number
  processName?: string
  state: 'listening' | 'established' | 'closed'
  createdAt: number
  updatedAt: number
}

interface PortTableProps {
  projectId: number
  className?: string
}

export function PortTable({ projectId, className }: PortTableProps) {
  const [stateFilter, setStateFilter] = useState<'listening' | 'all'>('listening')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [portToKill, setPortToKill] = useState<number | null>(null)

  // toast imported from sonner

  // Fetch ports
  const { data: ports = [], isLoading, refetch } = useProcessPorts(projectId, stateFilter)
  const { mutate: killByPort, isPending: isKilling } = useKillByPort(projectId)
  const { mutate: scanPorts, isPending: isScanning } = useScanPorts(projectId)

  // Handle port kill confirmation
  const handleKillPort = (port: number) => {
    setPortToKill(port)
  }

  const confirmKillPort = () => {
    if (portToKill) {
      killByPort(portToKill, {
        onSuccess: () => {
          setPortToKill(null)
          refetch()
        }
      })
    }
  }

  // Protocol badge component
  const ProtocolBadge = ({ protocol }: { protocol: 'tcp' | 'udp' }) => {
    return (
      <Badge variant='outline' className='font-mono text-xs'>
        {protocol.toUpperCase()}
      </Badge>
    )
  }

  // State indicator component
  const StateIndicator = ({ state }: { state: ProcessPort['state'] }) => {
    const indicators = {
      listening: { icon: Wifi, color: 'text-green-500', label: 'Listening' },
      established: { icon: Activity, color: 'text-blue-500', label: 'Connected' },
      closed: { icon: WifiOff, color: 'text-gray-400', label: 'Closed' }
    }

    const indicator = indicators[state]
    const Icon = indicator.icon

    return (
      <div className='flex items-center gap-2'>
        <Icon className={cn('h-4 w-4', indicator.color)} />
        <span className='text-sm'>{indicator.label}</span>
      </div>
    )
  }

  // Column definitions
  const columns: ColumnDef<ProcessPort>[] = [
    {
      accessorKey: 'port',
      header: 'Port',
      cell: ({ row }) => {
        const port = row.getValue('port') as number
        return (
          <div className='flex items-center gap-2'>
            <Network className='h-4 w-4 text-muted-foreground' />
            <span className='font-mono font-semibold'>{port}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'protocol',
      header: 'Protocol',
      cell: ({ row }) => <ProtocolBadge protocol={row.getValue('protocol')} />
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => {
        const address = row.getValue('address') as string
        return <code className='text-xs bg-muted px-2 py-1 rounded'>{address}</code>
      }
    },
    {
      accessorKey: 'processName',
      header: 'Process',
      cell: ({ row }) => {
        const name = row.getValue('processName') as string | undefined
        const pid = row.original.pid

        if (!name && !pid) {
          return <span className='text-muted-foreground'>-</span>
        }

        return (
          <div className='flex items-center gap-2'>
            <Terminal className='h-3 w-3 text-muted-foreground' />
            <div className='flex flex-col'>
              {name && <span className='text-sm font-medium'>{name}</span>}
              {pid && <span className='text-xs text-muted-foreground'>PID: {pid}</span>}
            </div>
          </div>
        )
      }
    },
    {
      accessorKey: 'state',
      header: 'State',
      cell: ({ row }) => <StateIndicator state={row.getValue('state')} />
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const port = row.original
        const canKill = port.state === 'listening' && port.pid

        return (
          <div className='flex items-center gap-2'>
            {canKill && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleKillPort(port.port)}
                disabled={isKilling}
                className='h-8'
              >
                <XCircle className='h-4 w-4 text-destructive' />
                <span className='ml-2'>Kill</span>
              </Button>
            )}
          </div>
        )
      }
    }
  ]

  const table = useReactTable({
    data: ports as ProcessPort[],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters
    }
  })

  // Auto-refresh for listening ports
  useEffect(() => {
    if (stateFilter === 'listening') {
      const interval = setInterval(() => refetch(), 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
  }, [stateFilter, refetch])

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <Search className='h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Filter ports...'
              value={(table.getColumn('port')?.getFilterValue() as string) ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                table.getColumn('port')?.setFilterValue(event.target.value)
              }
              className='h-8 w-[150px]'
            />
          </div>

          <div className='flex items-center gap-2'>
            <Button
              variant={stateFilter === 'listening' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setStateFilter('listening')}
            >
              Active Only
            </Button>
            <Button
              variant={stateFilter === 'all' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setStateFilter('all')}
            >
              All Ports
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => scanPorts()} disabled={isScanning}>
            <Search className={cn('h-4 w-4', isScanning && 'animate-pulse')} />
            <span className='ml-2'>Scan Ports</span>
          </Button>

          <Button variant='outline' size='sm' onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className='rounded-md border'>
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
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  <div className='flex flex-col items-center gap-2'>
                    <WifiOff className='h-8 w-8 text-muted-foreground' />
                    <span className='text-sm text-muted-foreground'>
                      {isLoading ? 'Loading ports...' : 'No ports found'}
                    </span>
                    {!isLoading && (
                      <Button variant='outline' size='sm' onClick={() => scanPorts()} disabled={isScanning}>
                        <Search className='h-4 w-4 mr-2' />
                        Scan for Ports
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          Showing {table.getRowModel().rows.length} of {ports.length} port(s)
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>

      {/* Kill Port Confirmation Dialog */}
      <AlertDialog open={!!portToKill} onOpenChange={() => setPortToKill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kill Process on Port {portToKill}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate the process listening on port {portToKill}. The process may not be recoverable and any
              unsaved work may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmKillPort}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Kill Process
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
