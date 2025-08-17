import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  Badge,
  Button,
  Input,
  ScrollArea,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  useIsMobile
} from '@promptliano/ui'
import { CopyableInline, CopyableBlock } from '@promptliano/ui'
import { TokenBadge } from '@promptliano/ui'
import { 
  Search, 
  MessageSquare, 
  Clock, 
  GitBranch, 
  FolderOpen, 
  RefreshCw, 
  ChevronRight, 
  Terminal,
  LayoutGrid,
  List,
  Settings2,
  Loader2
} from 'lucide-react'
import { 
  useClaudeSessions, 
  useClaudeSessionsRecent,
  useClaudeSessionsProgressive,
  useSessionDuration 
} from '@/hooks/api/use-claude-code-api'
import { SessionsTableView } from './sessions-table-view'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * Enhanced SessionsView with view mode toggle and progressive loading
 * 
 * Features:
 * - View mode toggle (Cards/Table) with keyboard shortcuts
 * - Progressive loading strategy for optimal performance
 * - View mode persistence in localStorage
 * - Responsive design with mobile fallback
 * - Smooth transitions between modes
 * - Advanced loading states and error handling
 * 
 * Usage:
 * ```tsx
 * <SessionsView 
 *   projectId={projectId}
 *   projectName="My Project"
 *   onSelectSession={(sessionId) => navigate(`/sessions/${sessionId}`)}
 *   enableViewModeToggle={true}
 *   enableProgressiveLoading={true}
 *   tablePreset="detailed"
 * />
 * ```
 * 
 * Keyboard Shortcuts:
 * - Ctrl+G: Switch to card view
 * - Ctrl+T: Switch to table view
 */
type ViewMode = 'cards' | 'table'

interface SessionsViewProps {
  projectId: number
  projectName?: string
  onSelectSession?: (sessionId: string) => void
  initialViewMode?: ViewMode
  enableViewModeToggle?: boolean
  enableProgressiveLoading?: boolean
  tablePreset?: 'minimal' | 'compact' | 'detailed' | 'mobile'
}

interface SessionCardProps {
  session: {
    sessionId: string
    projectPath: string
    startTime: string
    lastUpdate: string
    messageCount: number
    gitBranch?: string
    cwd?: string
    tokenUsage?: {
      totalInputTokens: number
      totalCacheCreationTokens: number
      totalCacheReadTokens: number
      totalOutputTokens: number
      totalTokens: number
    }
    serviceTiers?: string[]
    totalTokensUsed?: number
    totalCostUsd?: number
  }
  isSelected: boolean
  onClick: () => void
}

function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const duration = useSessionDuration(session.startTime, session.lastUpdate)

  return (
    <Card
      className={cn('cursor-pointer transition-all hover:shadow-md', isSelected && 'ring-2 ring-primary')}
      onClick={onClick}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='space-y-1 flex-1'>
            <CardTitle className='text-base flex items-center gap-2'>
              <MessageSquare className='h-4 w-4' />
              <CopyableInline text={session.sessionId} className='font-mono text-sm'>
                {session.sessionId}
              </CopyableInline>
            </CardTitle>
            <CardDescription className='text-xs'>
              {format(new Date(session.startTime), 'MMM d, yyyy h:mm a')}
            </CardDescription>
          </div>
          <ChevronRight className='h-4 w-4 text-muted-foreground' />
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex items-center gap-4 text-sm'>
          <div className='flex items-center gap-1'>
            <Clock className='h-3 w-3 text-muted-foreground' />
            <span>{duration}</span>
          </div>
          <div className='flex items-center gap-1'>
            <MessageSquare className='h-3 w-3 text-muted-foreground' />
            <span>{session.messageCount} messages</span>
          </div>
        </div>

        {session.gitBranch && (
          <div className='flex items-center gap-2'>
            <GitBranch className='h-3 w-3 text-muted-foreground' />
            <CopyableInline text={session.gitBranch} className='text-sm font-mono'>
              {session.gitBranch}
            </CopyableInline>
          </div>
        )}

        {session.cwd && (
          <div className='flex items-start gap-2'>
            <FolderOpen className='h-3 w-3 text-muted-foreground mt-0.5' />
            <CopyableInline text={session.cwd} className='text-sm font-mono break-all' truncate maxLength={50}>
              {session.cwd}
            </CopyableInline>
          </div>
        )}

        {/* Token usage with detailed breakdown */}
        <div className='flex items-center gap-3 flex-wrap'>
          {session.tokenUsage && <TokenBadge tokenUsage={session.tokenUsage} className='text-xs' />}

          {/* Legacy token display */}
          {!session.tokenUsage && session.totalTokensUsed && (
            <Badge variant='outline' className='text-xs'>
              {session.totalTokensUsed.toLocaleString()} tokens
            </Badge>
          )}

          {session.totalCostUsd && (
            <span className='text-xs text-muted-foreground'>${session.totalCostUsd.toFixed(4)}</span>
          )}

          {/* Service tiers */}
          {session.serviceTiers && session.serviceTiers.length > 0 && (
            <Badge variant='secondary' className='text-xs'>
              {session.serviceTiers[0]}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function SessionsView({ 
  projectId, 
  projectName, 
  onSelectSession,
  initialViewMode = 'cards',
  enableViewModeToggle = true,
  enableProgressiveLoading = true,
  tablePreset = 'detailed'
}: SessionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const isMobile = useIsMobile()
  
  // Responsive view mode - force cards on mobile for better UX
  const effectiveViewMode = useMemo(() => {
    if (isMobile) return 'cards'
    return viewMode
  }, [isMobile, viewMode])

  // Progressive loading strategy
  const {
    metadata,
    sessions,
    metadataLoading,
    fullDataLoading,
    error,
    hasFullData,
    refetch: refetchProgressive
  } = useClaudeSessionsProgressive(
    projectId,
    {
      search: searchQuery || undefined,
      limit: effectiveViewMode === 'table' ? 50 : 20,
      offset: 0
    },
    {
      enabled: enableProgressiveLoading,
      loadFullData: effectiveViewMode === 'table'
    }
  )
  
  // Recent sessions for fast initial load
  const {
    data: recentSessions,
    isLoading: recentLoading,
    refetch: refetchRecent
  } = useClaudeSessionsRecent(projectId, {
    enabled: enableProgressiveLoading && !searchQuery,
    staleTime: 1 * 60 * 1000 // 1 minute
  })
  
  // Fallback to standard hook if progressive loading is disabled
  const {
    data: fallbackSessions,
    isLoading: fallbackLoading,
    error: fallbackError,
    refetch: refetchFallback
  } = useClaudeSessions(projectId, {
    search: searchQuery || undefined,
    limit: 50,
    offset: 0
  }, {
    enabled: !enableProgressiveLoading
  })
  
  // Determine which data to use
  const displaySessions = useMemo(() => {
    if (!enableProgressiveLoading) {
      return fallbackSessions || []
    }
    
    // Use progressive data if available
    if (sessions.length > 0) {
      return sessions
    }
    
    // Fall back to recent sessions for instant feedback
    if (!searchQuery && recentSessions) {
      return recentSessions
    }
    
    // Fall back to metadata
    return metadata || []
  }, [enableProgressiveLoading, sessions, recentSessions, metadata, searchQuery, fallbackSessions])
  
  const isLoading = enableProgressiveLoading 
    ? (metadataLoading && recentLoading)
    : fallbackLoading
    
  const actualError = enableProgressiveLoading ? error : fallbackError

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    if (onSelectSession) {
      onSelectSession(sessionId)
    }
  }

  // View mode persistence
  useEffect(() => {
    const savedViewMode = localStorage.getItem('sessions-view-mode')
    if (savedViewMode && (savedViewMode === 'cards' || savedViewMode === 'table')) {
      setViewMode(savedViewMode as ViewMode)
    }
  }, [])
  
  const handleViewModeChange = useCallback(async (newMode: ViewMode) => {
    if (newMode === viewMode || isMobile) return
    
    setIsTransitioning(true)
    
    // Smooth transition with animation
    try {
      // Save preference
      localStorage.setItem('sessions-view-mode', newMode)
      
      // Small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 150))
      
      setViewMode(newMode)
      
      // Show helpful message
      if (newMode === 'table') {
        toast.success('Switched to table view')
      } else {
        toast.success('Switched to card view')
      }
    } finally {
      setIsTransitioning(false)
    }
  }, [viewMode, isMobile])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!enableViewModeToggle || isMobile) return
      
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case 't':
            event.preventDefault()
            handleViewModeChange('table')
            break
          case 'g':
            event.preventDefault() 
            handleViewModeChange('cards')
            break
        }
      }
    }
    
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [enableViewModeToggle, handleViewModeChange, isMobile])
  
  const handleRefresh = useCallback(() => {
    if (enableProgressiveLoading) {
      refetchProgressive()
      refetchRecent()
    } else {
      refetchFallback()
    }
    toast.success('Sessions refreshed')
  }, [enableProgressiveLoading, refetchProgressive, refetchRecent, refetchFallback])

  if (isLoading) {
    return (
      <div className='p-6 space-y-4'>
        <Skeleton className='h-10 w-full' />
        <div className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className='h-32 w-full' />
          ))}
        </div>
      </div>
    )
  }

  if (actualError) {
    return (
      <div className='p-6'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Terminal className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>Failed to load sessions</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              {actualError instanceof Error ? actualError.message : 'An error occurred'}
            </p>
            <Button onClick={handleRefresh} variant='outline' size='sm'>
              <RefreshCw className='h-4 w-4 mr-2' />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasNoSessions = !displaySessions || displaySessions.length === 0

  return (
    <div className='p-6 space-y-6'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Claude Code Sessions</h2>
            <p className='text-muted-foreground'>
              Browse your chat history from Claude Code
              {displaySessions && displaySessions.length > 0 && (
                <span className='ml-2'>
                  ({displaySessions.length} {displaySessions.length === 1 ? 'session' : 'sessions'})
                </span>
              )}
            </p>
          </div>
          
          <div className='flex items-center gap-2'>
            {/* View mode toggle */}
            {enableViewModeToggle && !isMobile && (
              <div className='flex items-center gap-1'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ToggleGroup 
                        type='single' 
                        value={effectiveViewMode} 
                        onValueChange={(value) => value && handleViewModeChange(value as ViewMode)}
                        className='border border-border rounded-md p-1'
                        disabled={isTransitioning}
                      >
                        <ToggleGroupItem 
                          value='cards' 
                          size='sm'
                          className='h-7 px-2'
                          disabled={isTransitioning}
                        >
                          <LayoutGrid className='h-3 w-3' />
                        </ToggleGroupItem>
                        <ToggleGroupItem 
                          value='table' 
                          size='sm'
                          className='h-7 px-2'
                          disabled={isTransitioning}
                        >
                          <List className='h-3 w-3' />
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className='text-center'>
                      <div>Switch view mode</div>
                      <div className='text-xs text-muted-foreground mt-1'>
                        {!isMobile && 'Ctrl+G (Cards) / Ctrl+T (Table)'}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            
            {/* Loading indicator for background refresh */}
            {(fullDataLoading || isTransitioning) && (
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
            )}
            
            <Button variant='outline' size='sm' onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {!hasNoSessions && (
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search sessions by ID, branch, or path...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
        )}
      </div>

      {hasNoSessions ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <Terminal className='h-16 w-16 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Claude Code sessions found</h3>
            <p className='text-sm text-muted-foreground max-w-sm'>
              Start a conversation with Claude Code in this project to see your chat history here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          'transition-all duration-200 ease-in-out',
          isTransitioning && 'opacity-50'
        )}>
          {effectiveViewMode === 'table' ? (
            <SessionsTableView
              projectId={projectId}
              projectName={projectName}
              onSelectSession={onSelectSession}
              preset={tablePreset}
              enableVirtualization={displaySessions.length > 50}
              enableSelection={true}
              enableRowExpansion={true}
              className='border-0 shadow-none'
            />
          ) : (
            <ScrollArea className='h-[calc(100vh-250px)]'>
              <div className='grid gap-4 pr-4'>
                {/* Show skeleton cards while transitioning or loading */}
                {(isLoading || isTransitioning) && displaySessions.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className='animate-pulse'>
                      <CardHeader className='pb-3'>
                        <div className='flex items-start justify-between'>
                          <div className='space-y-2 flex-1'>
                            <Skeleton className='h-5 w-3/4' />
                            <Skeleton className='h-4 w-1/2' />
                          </div>
                          <Skeleton className='h-4 w-4' />
                        </div>
                      </CardHeader>
                      <CardContent className='space-y-3'>
                        <div className='flex items-center gap-4'>
                          <Skeleton className='h-4 w-20' />
                          <Skeleton className='h-4 w-24' />
                        </div>
                        <Skeleton className='h-4 w-full' />
                        <div className='flex items-center gap-2'>
                          <Skeleton className='h-6 w-16' />
                          <Skeleton className='h-4 w-12' />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  displaySessions.map((session: any) => (
                    <SessionCard
                      key={session.sessionId}
                      session={session}
                      isSelected={session.sessionId === selectedSessionId}
                      onClick={() => handleSessionClick(session.sessionId)}
                    />
                  ))
                )}
                
                {/* Progressive loading indicator */}
                {enableProgressiveLoading && fullDataLoading && displaySessions.length > 0 && (
                  <Card className='border-dashed'>
                    <CardContent className='flex items-center justify-center py-6'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Loading complete session data...
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
