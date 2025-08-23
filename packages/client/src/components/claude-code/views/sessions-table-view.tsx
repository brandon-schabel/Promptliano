import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { 
  DataTable,
  DataTableViewOptions,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Skeleton,
  ErrorBoundary,
  LoadingState,
  EmptyState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useIsMobile
} from '@promptliano/ui'
import { 
  Settings2, 
  Download, 
  RefreshCw, 
  Search, 
  Filter,
  MoreHorizontal,
  Grid3X3,
  List,
  Eye,
  Import,
  Copy,
  ChevronDown,
  GitBranch,
  Calendar,
  MessageSquare,
  Clock,
  Database,
  Terminal,
  FileText,
  X,
  Monitor,
  Smartphone,
  Tablet,
  FolderOpen
} from 'lucide-react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState
} from '@tanstack/react-table'
import { 
  useClaudeSessionsTable, 
  useClaudeSessionsInfinite,
  useClaudeCodeInvalidation,
  useClaudeFullSession,
  useCopyToClipboard 
} from '@/hooks/api-hooks'
import { 
  createClaudeCodeSessionColumns, 
  type SessionTableActions,
  SESSION_TABLE_PRESETS,
  type SessionTablePreset
} from '../claude-code-columns'
import type { ClaudeSession } from '@promptliano/schemas'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'

interface SessionsTableViewProps {
  projectId: number
  projectName?: string
  onSelectSession?: (sessionId: string) => void
  onViewSessionDetails?: (session: ClaudeSession) => void
  onImportSession?: (session: ClaudeSession) => void
  className?: string
  preset?: SessionTablePreset
  enableVirtualization?: boolean
  enableSelection?: boolean
  enableRowExpansion?: boolean
}

interface SessionDetailsPanelProps {
  session: ClaudeSession | null
  projectId: number
  isOpen: boolean
  onClose: () => void
}

// Session details panel component
function SessionDetailsPanel({ session, projectId, isOpen, onClose }: SessionDetailsPanelProps) {
  const copyToClipboard = useCopyToClipboard()

  // Load full session data when panel opens
  const { 
    data: fullSessionData, 
    isLoading: isLoadingFullSession, 
    error: fullSessionError 
  } = useClaudeFullSession(
    projectId,
    session?.sessionId,
    { enabled: isOpen && !!session?.sessionId }
  )

  if (!session) return null

  // Use full session data if available, otherwise fall back to lightweight session data
  const displaySession = fullSessionData?.session || session
  const hasFullData = !!fullSessionData?.session

  const handleCopyField = (value: string, field: string) => {
    copyToClipboard.mutate(value)
    toast.success(`${field} copied to clipboard`)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Session Details
          </SheetTitle>
          <SheetDescription>
            Detailed information about the Claude Code session
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Session ID</span>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {displaySession.sessionId}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField(displaySession.sessionId, 'Session ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Project Path</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {displaySession.projectPath}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField(displaySession.projectPath, 'Project path')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Start Time</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(displaySession.startTime), 'PPpp')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Update</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(displaySession.lastUpdate), 'PPpp')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Message Count</span>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{displaySession.messageCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading indicator for full session data */}
            {isLoadingFullSession && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading detailed session information...
                </div>
              </div>
            )}

            {/* Git Information */}
            {displaySession.gitBranch && displaySession.gitBranch !== 'Unknown' && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Git Information</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Branch</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      <code className="text-sm font-mono">{displaySession.gitBranch}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField(displaySession.gitBranch!, 'Git branch')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Working Directory */}
            {displaySession.cwd && displaySession.cwd !== 'Unknown' && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Working Directory</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Path</span>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-muted rounded text-xs font-mono max-w-[300px] truncate">
                      {displaySession.cwd}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField(displaySession.cwd!, 'Working directory')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Token Usage - Only show if we have full data with detailed token info */}
            {hasFullData && displaySession.tokenUsage && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Token Usage</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Tokens</span>
                    <Badge variant="outline" className="font-mono">
                      {displaySession.tokenUsage.totalTokens.toLocaleString()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Input</span>
                      <span className="font-mono">{displaySession.tokenUsage.totalInputTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Output</span>
                      <span className="font-mono">{displaySession.tokenUsage.totalOutputTokens.toLocaleString()}</span>
                    </div>
                    {displaySession.tokenUsage.totalCacheCreationTokens > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cache Create</span>
                        <span className="font-mono">{displaySession.tokenUsage.totalCacheCreationTokens.toLocaleString()}</span>
                      </div>
                    )}
                    {displaySession.tokenUsage.totalCacheReadTokens > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cache Read</span>
                        <span className="font-mono">{displaySession.tokenUsage.totalCacheReadTokens.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cost Information - Only show if we have full data with cost info */}
            {hasFullData && displaySession.totalCostUsd && displaySession.totalCostUsd > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Cost Information</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Cost</span>
                  <Badge variant="outline" className="font-mono">
                    ${displaySession.totalCostUsd.toFixed(4)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Service Tiers - Only show if we have full data with service tier info */}
            {hasFullData && displaySession.serviceTiers && displaySession.serviceTiers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Service Tiers</h3>
                <div className="flex flex-wrap gap-2">
                  {displaySession.serviceTiers.map((tier, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tier}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Expandable row content component
interface SessionRowExpansionProps {
  session: ClaudeSession
}

function SessionRowExpansion({ session }: SessionRowExpansionProps) {
  const copyToClipboard = useCopyToClipboard()

  const handleCopyField = (value: string, field: string) => {
    copyToClipboard.mutate(value)
  }

  const duration = React.useMemo(() => {
    const start = new Date(session.startTime).getTime()
    const end = new Date(session.lastUpdate).getTime()
    return end - start
  }, [session.startTime, session.lastUpdate])

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${hours}h ${minutes}m ${seconds}s`
  }

  return (
    <div className="px-6 py-4 bg-muted/30 border-t">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Session Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Session Details
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-mono">{formatDuration(duration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started:</span>
              <span>{format(new Date(session.startTime), 'PPp')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Update:</span>
              <span>{format(new Date(session.lastUpdate), 'PPp')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Messages:</span>
              <span className="font-medium">{session.messageCount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Token & Cost Information */}
        {(session.tokenUsage || session.totalTokensUsed || session.totalCostUsd) && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Usage & Cost
            </h4>
            <div className="space-y-2 text-sm">
              {session.tokenUsage ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tokens:</span>
                    <span className="font-mono">{session.tokenUsage.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input:</span>
                    <span className="font-mono">{session.tokenUsage.totalInputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-mono">{session.tokenUsage.totalOutputTokens.toLocaleString()}</span>
                  </div>
                  {session.tokenUsage.totalCacheReadTokens > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cache Read:</span>
                      <span className="font-mono">{session.tokenUsage.totalCacheReadTokens.toLocaleString()}</span>
                    </div>
                  )}
                </>
              ) : session.totalTokensUsed ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Tokens:</span>
                  <span className="font-mono">{session.totalTokensUsed.toLocaleString()}</span>
                </div>
              ) : null}
              
              {session.totalCostUsd && session.totalCostUsd > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="font-mono">${session.totalCostUsd.toFixed(4)}</span>
                </div>
              )}

              {session.serviceTiers && session.serviceTiers.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Service Tiers:</span>
                  <div className="flex flex-wrap gap-1">
                    {session.serviceTiers.map((tier, index) => (
                      <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                        {tier}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Environment Information */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            Environment
          </h4>
          <div className="space-y-2 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs">Project Path:</span>
              <div className="flex items-center gap-1">
                <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono break-all">
                  {session.projectPath}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => handleCopyField(session.projectPath, 'Project path')}
                >
                  <Copy className="h-2 w-2" />
                </Button>
              </div>
            </div>

            {session.cwd && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Working Directory:</span>
                <div className="flex items-center gap-1">
                  <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono break-all">
                    {session.cwd}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => handleCopyField(session.cwd!, 'Working directory')}
                  >
                    <Copy className="h-2 w-2" />
                  </Button>
                </div>
              </div>
            )}

            {session.gitBranch && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Git Branch:</span>
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3 text-muted-foreground" />
                  <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
                    {session.gitBranch}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => handleCopyField(session.gitBranch!, 'Git branch')}
                  >
                    <Copy className="h-2 w-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(session.sessionId)}>
          <Copy className="h-3 w-3 mr-1" />
          Copy ID
        </Button>
        {session.projectPath && (
          <Button size="sm" variant="outline" onClick={() => handleCopyField(session.projectPath, 'Project path')}>
            <FolderOpen className="h-3 w-3 mr-1" />
            Copy Path
          </Button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          Session ID: {session.sessionId}
        </span>
      </div>
    </div>
  )
}

// Main table view component
export function SessionsTableView({
  projectId,
  projectName,
  onSelectSession,
  onViewSessionDetails,
  onImportSession,
  className,
  preset = 'detailed',
  enableVirtualization = true,
  enableSelection = true,
  enableRowExpansion = true
}: SessionsTableViewProps) {
  // Responsive behavior
  const isMobile = useIsMobile()
  const isTablet = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024

  // Auto-adjust preset based on screen size
  const responsivePreset = useMemo((): SessionTablePreset => {
    if (isMobile) return 'mobile'
    if (isTablet) return 'compact'
    return preset
  }, [isMobile, isTablet, preset])

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startTime', desc: true }
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20
  })
  const [globalFilter, setGlobalFilter] = useState('')
  
  // Debounce global filter for better performance
  const debouncedGlobalFilter = useDebounce(globalFilter, 300)
  
  // Local state
  const [selectedSession, setSelectedSession] = useState<ClaudeSession | null>(null)
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  // API hooks
  const {
    tableData: sessions,
    isLoading,
    isLoadingFirstPage,
    error,
    pagination: serverPagination,
    hasNextPage,
    refetch,
    invalidateTable
  } = useClaudeSessionsTable(
    projectId,
    {
      pagination: enableVirtualization ? { 
        pageIndex: 0, 
        pageSize: Math.max(pagination.pageSize, 50) // Larger page size for virtual scrolling
      } : pagination,
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter
    },
    {
      enabled: !!projectId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      metadata: false // Use full data for table
    }
  )

  const { invalidateSessions } = useClaudeCodeInvalidation()

  // Update column visibility and pagination when responsive preset changes
  useEffect(() => {
    const presetConfig = SESSION_TABLE_PRESETS[responsivePreset]
    
    // Update column visibility
    const hidden: VisibilityState = {}
    presetConfig.hiddenColumns.forEach(col => {
      hidden[col] = false
    })
    setColumnVisibility(hidden)
    
    // Update page size
    setPagination(prev => ({
      ...prev,
      pageSize: presetConfig.pageSize,
      pageIndex: 0 // Reset to first page
    }))
  }, [responsivePreset])

  // Memoized table actions
  const tableActions: SessionTableActions = useMemo(() => ({
    onView: (session) => {
      setSelectedSession(session)
      setIsDetailsPanelOpen(true)
      onViewSessionDetails?.(session)
    },
    onImport: (session) => {
      onImportSession?.(session)
      toast.success('Session import started')
    },
    onCopy: (session) => {
      navigator.clipboard.writeText(session.sessionId)
      toast.success('Session ID copied to clipboard')
    }
  }), [onViewSessionDetails, onImportSession])

  // Memoized columns
  const columns = useMemo(() => 
    createClaudeCodeSessionColumns(tableActions, enableRowExpansion),
    [tableActions, enableRowExpansion]
  )

  // Handle row click
  const handleRowClick = useCallback((row: any) => {
    const session = row.original as ClaudeSession
    onSelectSession?.(session.sessionId)
    setSelectedSession(session)
  }, [onSelectSession])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch()
    invalidateSessions(projectId)
    toast.success('Sessions refreshed')
  }, [refetch, invalidateSessions, projectId])

  // Handle export
  const handleExport = useCallback(() => {
    if (!sessions || sessions.length === 0) {
      toast.error('No data to export')
      return
    }

    const csvContent = [
      // Headers
      'Session ID,Start Time,Duration,Messages,Total Tokens,Git Branch,Cost',
      // Data rows
      ...sessions.map(session => {
        const duration = new Date(session.lastUpdate).getTime() - new Date(session.startTime).getTime()
        const hours = Math.floor(duration / (1000 * 60 * 60))
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
        
        return [
          session.sessionId,
          session.startTime,
          `${hours}h ${minutes}m`,
          session.messageCount,
          (session as ClaudeSession).tokenUsage?.totalTokens || (session as ClaudeSession).totalTokensUsed || 0,
          (session as ClaudeSession).gitBranch || '',
          (session as ClaudeSession).totalCostUsd?.toFixed(4) || ''
        ].join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claude-sessions-${projectName || 'project'}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Sessions exported successfully')
  }, [sessions, projectName])

  // Handle bulk operations
  const handleBulkDelete = useCallback(() => {
    const selectedIds = Object.keys(rowSelection)
    if (selectedIds.length === 0) {
      toast.error('No sessions selected')
      return
    }
    
    // TODO: Implement bulk delete functionality
    toast.info(`Would delete ${selectedIds.length} sessions`)
    setRowSelection({})
  }, [rowSelection])

  // Error boundary fallback
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load sessions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoadingFirstPage) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  const isEmpty = !isLoading && (!sessions || sessions.length === 0)

  return (
    <ErrorBoundary>
      <div className={cn('space-y-6', className)}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Claude Code Sessions</h1>
            <p className="text-muted-foreground">
              {projectName ? `Sessions for ${projectName}` : 'Browse your Claude Code chat history'}
              {sessions && sessions.length > 0 && (
                <span className="ml-2">
                  ({sessions.length} {sessions.length === 1 ? 'session' : 'sessions'})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-md border p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-7 px-2"
              >
                <List className="h-3 w-3" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-7 px-2"
              >
                <Grid3X3 className="h-3 w-3" />
              </Button>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh sessions</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={isEmpty}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export to CSV</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>View Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={enableVirtualization}
                  onCheckedChange={() => {/* TODO: implement */}}
                >
                  Virtual Scrolling
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={enableSelection}
                  onCheckedChange={() => {/* TODO: implement */}}
                >
                  Row Selection
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Selected rows actions */}
        {Object.keys(rowSelection).length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium">
              {Object.keys(rowSelection).length} session(s) selected
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkDelete}>
                Delete Selected
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setRowSelection({})}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Main content */}
        {isEmpty ? (
          <EmptyState
            icon={Terminal}
            title="No Claude Code sessions found"
            description="Start a conversation with Claude Code in this project to see your chat history here."
            actions={
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={sessions || []}
                // Pagination
                manualPagination
                pageCount={serverPagination?.total ? Math.ceil(serverPagination.total / pagination.pageSize) : 1}
                pagination={pagination}
                onPaginationChange={setPagination}
                // Sorting
                manualSorting
                sorting={sorting}
                onSortingChange={setSorting}
                // Filtering
                manualFiltering
                columnFilters={columnFilters}
                onColumnFiltersChange={setColumnFilters}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                // Selection
                enableRowSelection={enableSelection}
                onRowSelectionChange={setRowSelection}
                // Visibility
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                // State
                isLoading={isLoading}
                isFetching={isLoading}
                // Interaction
                onRowClick={handleRowClick}
                getRowId={(row) => row.sessionId}
                // Row expansion
                renderSubComponent={enableRowExpansion ? ({ row }) => (
                  <SessionRowExpansion session={row.original} />
                ) : undefined}
                // Custom messages
                emptyMessage="No sessions match your search criteria."
                className="border-0"
              />
            </CardContent>
          </Card>
        )}

        {/* Session details panel */}
        <SessionDetailsPanel
          session={selectedSession}
          projectId={projectId}
          isOpen={isDetailsPanelOpen}
          onClose={() => setIsDetailsPanelOpen(false)}
        />
      </div>
    </ErrorBoundary>
  )
}