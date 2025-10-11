import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/api/use-api-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Button,
  ScrollArea,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@promptliano/ui'
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
  Activity,
  BarChart3,
  Terminal
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CrawlDebugPanelProps {
  researchId: number
  className?: string
}

/**
 * Debug event categories from the backend
 */
type DebugCategory = 'url-processing' | 'ai-filtering' | 'robots' | 'extraction' | 'queue-management' | 'error'

/**
 * Debug event levels
 */
type DebugLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Time range filter options
 */
type TimeRange = 'all' | '5m' | '15m' | '1h'

/**
 * Debug event structure from API
 */
interface DebugEvent {
  id: string
  researchId: number
  timestamp: number
  category: DebugCategory
  level: DebugLevel
  message: string
  metadata?: Record<string, unknown>
}

/**
 * Debug statistics structure from API
 */
interface DebugStats {
  totalEvents: number
  byCategory: Record<DebugCategory, number>
  byLevel: Record<DebugLevel, number>
  timeRange: {
    first: number
    last: number
  }
  aiAcceptanceRate?: number
  avgProcessingTime?: number
}

/**
 * Comprehensive debug panel for web crawling
 * Provides real-time insights into crawling operations with:
 * - Event filtering and search
 * - Aggregated statistics
 * - Activity feed with auto-refresh
 */
export function CrawlDebugPanel({ researchId, className }: CrawlDebugPanelProps) {
  const client = useApiClient()

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<DebugCategory | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<DebugLevel | 'all'>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Calculate time filter timestamps
  const timeFilter = useMemo(() => {
    if (timeRange === 'all') return undefined

    const now = Date.now()
    const ranges = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000
    }

    return {
      from: now - ranges[timeRange],
      to: now
    }
  }, [timeRange])

  // Fetch debug events
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents
  } = useQuery({
    queryKey: ['research-debug-events', researchId, categoryFilter, levelFilter, timeFilter],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')

      const params: Record<string, unknown> = {}
      if (categoryFilter !== 'all') params.category = categoryFilter
      if (levelFilter !== 'all') params.level = levelFilter
      if (timeFilter) {
        params.from = timeFilter.from
        params.to = timeFilter.to
      }

      return await client.typeSafeClient.listDeepResearchByResearchIdDebugEvents(researchId, params)
    },
    enabled: !!client && !!researchId,
    refetchInterval: autoRefresh ? 5000 : false, // 5 seconds when auto-refresh is on
    staleTime: 2000
  })

  // Fetch debug statistics
  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['research-debug-stats', researchId],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return await client.typeSafeClient.listDeepResearchByResearchIdDebugStats(researchId)
    },
    enabled: !!client && !!researchId,
    refetchInterval: autoRefresh ? 5000 : false,
    staleTime: 2000
  })

  // Fetch activity feed
  const {
    data: activityData,
    isLoading: activityLoading,
    refetch: refetchActivity
  } = useQuery({
    queryKey: ['research-debug-activity', researchId],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return await client.typeSafeClient.listDeepResearchByResearchIdDebugActivity(researchId)
    },
    enabled: !!client && !!researchId,
    refetchInterval: autoRefresh ? 3000 : false, // 3 seconds for activity feed
    staleTime: 1000
  })

  const events = eventsData?.data || []
  const stats = statsData?.data as unknown as DebugStats | undefined
  const recentEvents = activityData?.data || []

  // Refresh all data
  const handleRefreshAll = () => {
    refetchEvents()
    refetchStats()
    refetchActivity()
  }

  // Clear all events
  const handleClearEvents = async () => {
    if (!client) return
    try {
      await client.typeSafeClient.deleteDeepResearchByResearchIdDebugEvents(researchId)
      handleRefreshAll()
    } catch (error) {
      console.error('Failed to clear debug events:', error)
    }
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Crawl Debug Panel</CardTitle>
              <CardDescription>Real-time crawling system diagnostics</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Auto-refresh</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <Button variant="outline" size="sm" onClick={handleRefreshAll}>
              <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearEvents}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="events" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistics
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Feed
            </TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as DebugCategory | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="url-processing">URL Processing</SelectItem>
                  <SelectItem value="ai-filtering">AI Filtering</SelectItem>
                  <SelectItem value="robots">Robots</SelectItem>
                  <SelectItem value="extraction">Extraction</SelectItem>
                  <SelectItem value="queue-management">Queue Management</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as DebugLevel | 'all')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="5m">Last 5 minutes</SelectItem>
                  <SelectItem value="15m">Last 15 minutes</SelectItem>
                  <SelectItem value="1h">Last hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Event List */}
            {eventsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : eventsError ? (
              <div className="flex items-center gap-3 p-4 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Failed to load events</p>
                  <p className="text-sm text-muted-foreground">{(eventsError as Error).message}</p>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No debug events found</p>
                <p className="text-sm">Try adjusting your filters or start a new crawl</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <div className="space-y-2 p-4">
                  {events.map((event: DebugEvent) => (
                    <DebugEventCard key={event.id} event={event} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-4">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <DebugStatistics stats={stats} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No statistics available</p>
              </div>
            )}
          </TabsContent>

          {/* Activity Feed Tab */}
          <TabsContent value="activity" className="space-y-4">
            {activityLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <div className="space-y-1 p-2">
                  {recentEvents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No recent activity</p>
                    </div>
                  ) : (
                    recentEvents.map((event: DebugEvent) => (
                      <ActivityEventItem key={event.id} event={event} />
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

/**
 * Individual debug event card with metadata expansion
 */
function DebugEventCard({ event }: { event: DebugEvent }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <LevelBadge level={event.level} />
            <CategoryBadge category={event.category} />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm">{event.message}</p>
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-7 text-xs">
              {expanded ? 'Hide' : 'Show'} Details
            </Button>
            {expanded && (
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-0">
        {new Date(event.timestamp).toLocaleString()}
      </CardFooter>
    </Card>
  )
}

/**
 * Compact activity event item for the activity feed
 */
function ActivityEventItem({ event }: { event: DebugEvent }) {
  return (
    <div className="flex items-start gap-2 p-2 hover:bg-muted/50 rounded-md transition-colors">
      <div className="mt-0.5">
        <LevelIcon level={event.level} className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <CategoryBadge category={event.category} size="sm" />
          <span className="text-xs text-muted-foreground">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm truncate">{event.message}</p>
      </div>
    </div>
  )
}

/**
 * Statistics display component
 */
function DebugStatistics({ stats }: { stats: DebugStats }) {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Events" value={stats.totalEvents} icon={Terminal} />
          {stats.avgProcessingTime && (
            <StatCard label="Avg Processing" value={`${stats.avgProcessingTime.toFixed(0)}ms`} icon={Clock} />
          )}
          {stats.aiAcceptanceRate !== undefined && (
            <StatCard label="AI Acceptance" value={`${(stats.aiAcceptanceRate * 100).toFixed(1)}%`} icon={CheckCircle2} />
          )}
          {stats.timeRange && (
            <StatCard
              label="Time Span"
              value={formatDuration(stats.timeRange.last - stats.timeRange.first)}
              icon={Clock}
            />
          )}
        </div>
      </div>

      <Separator />

      {/* Events by Category */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Events by Category</h3>
        <div className="space-y-2">
          {Object.entries(stats.byCategory).map(([category, count]) => (
            <div key={category} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <CategoryBadge category={category as DebugCategory} />
              </div>
              <span className="text-lg font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Events by Level */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Events by Level</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(stats.byLevel).map(([level, count]) => (
            <div key={level} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <LevelBadge level={level as DebugLevel} />
              <span className="text-lg font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Stat card component
 */
function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

/**
 * Level badge component
 */
function LevelBadge({ level }: { level: DebugLevel }) {
  const variants: Record<DebugLevel, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    debug: { variant: 'outline', label: 'Debug' },
    info: { variant: 'default', label: 'Info' },
    warn: { variant: 'secondary', label: 'Warning' },
    error: { variant: 'destructive', label: 'Error' }
  }

  const config = variants[level]

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  )
}

/**
 * Level icon component
 */
function LevelIcon({ level, className }: { level: DebugLevel; className?: string }) {
  const icons: Record<DebugLevel, any> = {
    debug: Bug,
    info: Info,
    warn: AlertCircle,
    error: XCircle
  }

  const colors: Record<DebugLevel, string> = {
    debug: 'text-muted-foreground',
    info: 'text-blue-500',
    warn: 'text-yellow-500',
    error: 'text-destructive'
  }

  const Icon = icons[level]
  return <Icon className={cn(colors[level], className)} />
}

/**
 * Category badge component
 */
function CategoryBadge({ category, size = 'default' }: { category: DebugCategory; size?: 'default' | 'sm' }) {
  const labels: Record<DebugCategory, string> = {
    'url-processing': 'URL Processing',
    'ai-filtering': 'AI Filtering',
    robots: 'Robots',
    extraction: 'Extraction',
    'queue-management': 'Queue',
    error: 'Error'
  }

  return (
    <Badge variant="outline" className={cn('font-mono', size === 'sm' && 'text-xs px-1.5 py-0')}>
      {labels[category]}
    </Badge>
  )
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
