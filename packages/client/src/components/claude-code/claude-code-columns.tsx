import React from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  createTextColumn,
  createDateColumn,
  createActionsColumn,
  createSelectionColumn,
  DataTableColumnHeader
} from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { CopyableInline, TokenBadge, Collapsible, CollapsibleContent, CollapsibleTrigger } from '@promptliano/ui'
import {
  Eye,
  Import,
  Copy,
  GitBranch,
  MessageSquare,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronRight,
  FolderOpen
} from 'lucide-react'
import { format } from 'date-fns'
import type { ClaudeSession } from '@promptliano/schemas'
import { cn } from '@/lib/utils'

// Actions for each session row
export interface SessionTableActions {
  onView?: (session: ClaudeSession) => void
  onImport?: (session: ClaudeSession) => void
  onCopy?: (session: ClaudeSession) => void
}

// Helper function to calculate session duration
function calculateDuration(startTime: string, lastUpdate: string): string {
  const start = new Date(startTime).getTime()
  const end = new Date(lastUpdate).getTime()
  const duration = end - start

  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((duration % (1000 * 60)) / 1000)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

// Helper function to format cost
function formatCost(cost?: number): string {
  if (!cost) return '-'
  return `$${cost.toFixed(4)}`
}

// Create columns for Claude Code sessions table
export function createClaudeCodeSessionColumns(
  actions?: SessionTableActions,
  enableExpansion = true
): ColumnDef<ClaudeSession>[] {
  const columns: ColumnDef<ClaudeSession>[] = []

  // Expansion column (if enabled)
  if (enableExpansion) {
    columns.push({
      id: 'expand',
      header: '',
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          className='h-6 w-6 p-0'
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
        >
          {row.getIsExpanded() ? <ChevronDown className='h-3 w-3' /> : <ChevronRight className='h-3 w-3' />}
        </Button>
      ),
      enableSorting: false,
      meta: {
        width: '40px'
      }
    })
  }

  // Selection column
  columns.push(createSelectionColumn<ClaudeSession>())

  // Add the rest of the columns
  columns.push(
    // Session ID column (copyable)
    {
      accessorKey: 'sessionId',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Session ID' />,
      cell: ({ getValue }) => {
        const sessionId = getValue() as string
        return (
          <div className='max-w-[200px]'>
            <CopyableInline text={sessionId} className='font-mono text-sm' truncate maxLength={20}>
              {sessionId}
            </CopyableInline>
          </div>
        )
      },
      enableSorting: false,
      filterFn: 'includesString',
      meta: {
        className: 'w-[200px]'
      }
    },

    // Start Time column
    createDateColumn<ClaudeSession>({
      accessorKey: 'startTime',
      header: 'Start Time',
      format: 'relative',
      enableSorting: true,
      className: 'w-[120px]'
    }),

    // Duration column (calculated)
    {
      accessorFn: (row) => calculateDuration(row.startTime, row.lastUpdate),
      id: 'duration',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Duration' />,
      cell: ({ row }) => {
        const duration = calculateDuration(row.original.startTime, row.original.lastUpdate)
        return (
          <div className='flex items-center gap-1 text-sm'>
            <Clock className='h-3 w-3 text-muted-foreground' />
            <span className='font-mono'>{duration}</span>
          </div>
        )
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const durationA = new Date(rowA.original.lastUpdate).getTime() - new Date(rowA.original.startTime).getTime()
        const durationB = new Date(rowB.original.lastUpdate).getTime() - new Date(rowB.original.startTime).getTime()
        return durationA - durationB
      },
      meta: {
        className: 'w-[100px]'
      }
    },

    // Message Count column
    {
      accessorKey: 'messageCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Messages' />,
      cell: ({ getValue }) => {
        const count = getValue() as number
        return (
          <div className='flex items-center gap-1'>
            <MessageSquare className='h-3 w-3 text-muted-foreground' />
            <span className='font-medium'>{count.toLocaleString()}</span>
          </div>
        )
      },
      enableSorting: true,
      meta: {
        className: 'w-[100px]',
        align: 'right' as const
      }
    },

    // Token Usage column (expandable with detailed breakdown)
    {
      accessorFn: (row) => row.tokenUsage?.totalTokens || row.totalTokensUsed || 0,
      id: 'tokens',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Tokens' />,
      cell: ({ row }) => {
        const session = row.original
        const [isExpanded, setIsExpanded] = React.useState(false)

        // Use new tokenUsage if available, fallback to legacy
        const tokenUsage = session.tokenUsage
        const totalTokens = tokenUsage?.totalTokens || session.totalTokensUsed || 0

        if (!totalTokens) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              {tokenUsage ? (
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button variant='ghost' size='sm' className='h-auto p-0 gap-1'>
                      {isExpanded ? <ChevronDown className='h-3 w-3' /> : <ChevronRight className='h-3 w-3' />}
                      <TokenBadge tokenUsage={tokenUsage} className='text-xs' />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='mt-1 space-y-1'>
                    <div className='grid grid-cols-2 gap-1 text-xs text-muted-foreground'>
                      <div>Input: {tokenUsage.totalInputTokens?.toLocaleString()}</div>
                      <div>Output: {tokenUsage.totalOutputTokens?.toLocaleString()}</div>
                      {tokenUsage.totalCacheCreationTokens > 0 && (
                        <div>Cache Create: {tokenUsage.totalCacheCreationTokens?.toLocaleString()}</div>
                      )}
                      {tokenUsage.totalCacheReadTokens > 0 && (
                        <div>Cache Read: {tokenUsage.totalCacheReadTokens?.toLocaleString()}</div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <Badge variant='outline' className='text-xs'>
                  {totalTokens.toLocaleString()} tokens
                </Badge>
              )}
            </div>
          </div>
        )
      },
      enableSorting: true,
      meta: {
        className: 'w-[140px]'
      }
    },

    // Git Branch column
    {
      accessorKey: 'gitBranch',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Branch' />,
      cell: ({ getValue }) => {
        const branch = getValue() as string
        if (!branch) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <div className='flex items-center gap-1 max-w-[120px]'>
            <GitBranch className='h-3 w-3 text-muted-foreground' />
            <CopyableInline text={branch} className='font-mono text-sm' truncate maxLength={15}>
              {branch}
            </CopyableInline>
          </div>
        )
      },
      enableSorting: true,
      filterFn: 'includesString',
      meta: {
        className: 'w-[120px]'
      }
    },

    // Working Directory column
    {
      accessorKey: 'cwd',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Directory' />,
      cell: ({ getValue }) => {
        const cwd = getValue() as string
        if (!cwd) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <div className='flex items-center gap-1 max-w-[150px]'>
            <FolderOpen className='h-3 w-3 text-muted-foreground' />
            <CopyableInline text={cwd} className='font-mono text-sm' truncate maxLength={20}>
              {cwd}
            </CopyableInline>
          </div>
        )
      },
      enableSorting: false,
      filterFn: 'includesString',
      meta: {
        className: 'w-[150px]'
      }
    },

    // Cost column
    {
      accessorKey: 'totalCostUsd',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Cost' />,
      cell: ({ getValue }) => {
        const cost = getValue() as number
        return (
          <div className='flex items-center gap-1 text-sm font-medium'>
            <DollarSign className='h-3 w-3 text-muted-foreground' />
            <span className={cn('font-mono', cost && cost > 0 ? 'text-foreground' : 'text-muted-foreground')}>
              {formatCost(cost)}
            </span>
          </div>
        )
      },
      enableSorting: true,
      meta: {
        className: 'w-[80px]',
        align: 'right' as const
      }
    },

    // Actions column
    createActionsColumn<ClaudeSession>({
      actions: [
        {
          label: 'View Details',
          icon: Eye,
          onClick: (session) => actions?.onView?.(session)
        },
        {
          label: 'Import Session',
          icon: Import,
          onClick: (session) => actions?.onImport?.(session)
        },
        {
          label: 'Copy Session ID',
          icon: Copy,
          onClick: (session) => {
            navigator.clipboard.writeText(session.sessionId)
          }
        }
      ]
    })
  )

  return columns
}

// Column configuration for different views
export const SESSION_TABLE_PRESETS = {
  compact: {
    hiddenColumns: ['cwd', 'duration'],
    pageSize: 25
  },
  detailed: {
    hiddenColumns: [],
    pageSize: 15
  },
  mobile: {
    hiddenColumns: ['cwd', 'gitBranch', 'duration', 'totalCostUsd'],
    pageSize: 10
  }
} as const

// Export types for use in other components
export type SessionTablePreset = keyof typeof SESSION_TABLE_PRESETS
