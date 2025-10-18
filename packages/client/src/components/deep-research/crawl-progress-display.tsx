import { Card, Progress, Badge, Separator } from '@promptliano/ui'
import { Globe, Link as LinkIcon, AlertCircle, CheckCircle2, Loader2, ExternalLink, Brain, Shield, FileText, ListOrdered, Circle } from 'lucide-react'
import { useCrawlProgress } from '@/hooks/api-hooks'
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/api/use-api-client'

export interface CrawlProgressDisplayProps {
  researchId: number
  className?: string
}

/**
 * Helper function to map activity categories to icons
 */
function ActivityIcon({ category }: { category: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    'url-processing': <Globe className="h-3 w-3 text-blue-500" />,
    'ai-filtering': <Brain className="h-3 w-3 text-purple-500" />,
    'robots': <Shield className="h-3 w-3 text-green-500" />,
    'extraction': <FileText className="h-3 w-3 text-orange-500" />,
    'queue-management': <ListOrdered className="h-3 w-3 text-cyan-500" />,
    'error': <AlertCircle className="h-3 w-3 text-destructive" />
  }
  return iconMap[category] || <Circle className="h-3 w-3 text-muted-foreground" />
}

/**
 * Helper function to format relative timestamps
 */
function formatTimestamp(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

/**
 * Crawl progress display component for deep research
 * Shows real-time web crawling progress with polling and live activity feed
 */
export function CrawlProgressDisplay({ researchId, className }: CrawlProgressDisplayProps) {
  const { data, isLoading, error } = useCrawlProgress(researchId)
  const apiClient = useApiClient()

  // Determine if crawl is currently active
  const crawlData = data?.data
  const progress = crawlData?.progress
  const config = crawlData?.config
  const isActive = progress && progress.urlsPending > 0 && progress.urlsCrawled < (config?.maxPages || 20)

  // Fetch recent debug activity - only poll when crawl is active
  const { data: activityData } = useQuery({
    queryKey: ['research-debug-activity', researchId],
    queryFn: async () => {
      if (!apiClient) throw new Error('API client not initialized')
      return apiClient.typeSafeClient.listDeepResearchByResearchIdDebugActivity(researchId, { limit: 5 })
    },
    refetchInterval: isActive ? 3000 : false, // Refresh every 3 seconds when active
    enabled: !!apiClient && !!crawlData?.crawlEnabled, // Only fetch when crawling is enabled
    staleTime: 2000 // Consider stale after 2 seconds
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 mx-auto text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Loading crawl status...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="p-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">Failed to load crawl progress</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (!crawlData?.crawlEnabled) {
    return null // Don't show anything if crawling is not enabled
  }

  const { crawlId, seedUrl } = crawlData

  // Determine status
  const isComplete = progress && (progress.urlsCrawled >= (config?.maxPages || 20) || progress.urlsPending === 0)
  const totalUrls = progress ? progress.urlsCrawled + progress.urlsPending : 0
  const progressPercentage = config && progress
    ? Math.min(100, (progress.urlsCrawled / config.maxPages) * 100)
    : 0

  return (
    <Card className={className}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Web Crawl Progress</h3>
          </div>
          <Badge variant={isActive ? 'default' : isComplete ? 'secondary' : 'outline'}>
            {isActive && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Crawling
              </span>
            )}
            {isComplete && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </span>
            )}
            {!isActive && !isComplete && 'Initialized'}
          </Badge>
        </div>

        {/* Seed URL */}
        {seedUrl && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Seed URL</Label>
            <a
              href={seedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="truncate font-mono">{seedUrl}</span>
            </a>
          </div>
        )}

        {progress && config && (
          <>
            <Separator />

            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Crawl Progress</span>
                <span className="text-muted-foreground">
                  {progress.urlsCrawled} / {config.maxPages} pages
                </span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressPercentage.toFixed(0)}% complete</span>
                {isActive && <span>Discovering pages...</span>}
              </div>
            </div>

            <Separator />

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* URLs Crawled */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Crawled</span>
                </div>
                <p className="text-2xl font-bold">{progress.urlsCrawled}</p>
                <p className="text-xs text-muted-foreground">Pages processed</p>
              </div>

              {/* URLs Pending */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className={`h-4 w-4 ${isActive ? 'animate-spin text-blue-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <p className="text-2xl font-bold">{progress.urlsPending}</p>
                <p className="text-xs text-muted-foreground">In queue</p>
              </div>

              {/* URLs Failed */}
              {progress.urlsFailed > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Failed</span>
                  </div>
                  <p className="text-2xl font-bold">{progress.urlsFailed}</p>
                  <p className="text-xs text-muted-foreground">Errors encountered</p>
                </div>
              )}

              {/* Current Depth */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Depth</span>
                </div>
                <p className="text-2xl font-bold">
                  {progress.currentDepth} / {config.maxDepth}
                </p>
                <p className="text-xs text-muted-foreground">Link levels</p>
              </div>
            </div>

            <Separator />

            {/* Current Activity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Current Activity</h4>
                {isActive && <Badge variant="outline" className="text-xs">Live</Badge>}
              </div>

              <div className="space-y-2">
                {activityData?.data && activityData.data.length > 0 ? (
                  activityData.data.slice(0, 5).map((event, idx) => (
                    <div key={event.id || idx} className="flex items-start gap-2 text-xs">
                      <ActivityIcon category={event.category} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-foreground">{event.message}</p>
                        <p className="text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
                      </div>
                      {event.level === 'error' && <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Configuration Summary */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Configuration</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Max Depth</p>
                  <p className="font-mono font-medium">{config.maxDepth}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Pages</p>
                  <p className="font-mono font-medium">{config.maxPages}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Relevance</p>
                  <p className="font-mono font-medium">{(config.relevanceThreshold * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>

            {/* Crawl ID for debugging */}
            {crawlId && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Crawl ID: <span className="font-mono">{crawlId}</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// Helper label component
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>
}
