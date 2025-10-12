/**
 * Crawl Progress Panel Component
 *
 * Displays comprehensive crawl progress metrics with visual indicators.
 * Shows real-time updates during active crawling sessions.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@promptliano/ui'
import { Link2, FileText, Clock, Activity, TrendingUp, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CrawlProgressPanelProps {
  progress: {
    totalLinksDiscovered: number
    totalPagesCrawled: number
    pagesRemainingInQueue: number
    currentCrawlDepth: number
    maxDepthConfigured: number
    linksPerDepth: Record<number, number>
  }
  isActive: boolean
  className?: string
}

/**
 * CrawlProgressPanel - Comprehensive progress visualization for crawl operations
 *
 * Features:
 * - Real-time metrics display
 * - Progress bars with animations
 * - Depth-based breakdown
 * - Visual indicators for active crawls
 * - Links per depth visualization
 *
 * @example
 * ```tsx
 * <CrawlProgressPanel
 *   progress={{
 *     totalLinksDiscovered: 150,
 *     totalPagesCrawled: 45,
 *     pagesRemainingInQueue: 105,
 *     currentCrawlDepth: 2,
 *     maxDepthConfigured: 3,
 *     linksPerDepth: { 0: 1, 1: 25, 2: 124 }
 *   }}
 *   isActive={true}
 * />
 * ```
 */
export function CrawlProgressPanel({ progress, isActive, className }: CrawlProgressPanelProps) {
  const {
    totalLinksDiscovered,
    totalPagesCrawled,
    pagesRemainingInQueue,
    currentCrawlDepth,
    maxDepthConfigured,
    linksPerDepth
  } = progress

  // Calculate progress percentage
  const totalPages = totalPagesCrawled + pagesRemainingInQueue
  const crawlProgress = totalPages > 0 ? (totalPagesCrawled / totalPages) * 100 : 0
  const depthProgress = maxDepthConfigured > 0 ? (currentCrawlDepth / maxDepthConfigured) * 100 : 0

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className={cn('h-5 w-5', isActive && 'animate-pulse text-green-600')} />
              Crawl Progress
            </CardTitle>
            <CardDescription>
              {isActive ? 'Real-time crawling metrics' : 'Latest crawl statistics'}
            </CardDescription>
          </div>
          {isActive && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </div>
              Live
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={Link2}
            label="Links Discovered"
            value={totalLinksDiscovered.toLocaleString()}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <MetricCard
            icon={FileText}
            label="Pages Crawled"
            value={totalPagesCrawled.toLocaleString()}
            color="text-green-600"
            bgColor="bg-green-50"
          />
          <MetricCard
            icon={Clock}
            label="Pages Remaining"
            value={pagesRemainingInQueue.toLocaleString()}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
        </div>

        {/* Crawl Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              {totalPagesCrawled} / {totalPages} pages
            </span>
          </div>
          <Progress
            value={crawlProgress}
            className="h-2"
            aria-label={`Crawl progress: ${Math.round(crawlProgress)}%`}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(crawlProgress)}% complete</span>
            {pagesRemainingInQueue > 0 && (
              <span className={cn(isActive && 'text-green-600 font-medium')}>
                {pagesRemainingInQueue} pages queued
              </span>
            )}
          </div>
        </div>

        {/* Depth Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Depth Progress
            </span>
            <span className="text-muted-foreground">
              Depth {currentCrawlDepth} / {maxDepthConfigured}
            </span>
          </div>
          <Progress
            value={depthProgress}
            className="h-2"
            aria-label={`Depth progress: ${Math.round(depthProgress)}%`}
          />
          <p className="text-xs text-muted-foreground">
            Crawling at depth level {currentCrawlDepth} of maximum {maxDepthConfigured}
          </p>
        </div>

        {/* Links Per Depth Breakdown */}
        {Object.keys(linksPerDepth).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Links by Depth
            </h4>
            <div className="space-y-2">
              {Object.entries(linksPerDepth)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([depth, count]) => (
                  <DepthBreakdownRow
                    key={depth}
                    depth={Number(depth)}
                    count={count}
                    total={totalLinksDiscovered}
                    isCurrentDepth={Number(depth) === currentCrawlDepth}
                    isActive={isActive}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalLinksDiscovered === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No crawl data available yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * MetricCard - Individual metric display with icon and color
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  bgColor: string
}) {
  return (
    <div className={cn('rounded-lg border p-4', bgColor)}>
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', bgColor)}>
          <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className={cn('text-2xl font-bold', color)}>{value}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * DepthBreakdownRow - Shows links count for a specific depth level
 */
function DepthBreakdownRow({
  depth,
  count,
  total,
  isCurrentDepth,
  isActive
}: {
  depth: number
  count: number
  total: number
  isCurrentDepth: boolean
  isActive: boolean
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div className={cn('flex items-center gap-3', isCurrentDepth && 'font-medium')}>
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium',
          isCurrentDepth
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {depth}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span>Depth {depth}</span>
          <span className="text-muted-foreground">
            {count.toLocaleString()} ({Math.round(percentage)}%)
          </span>
        </div>
        <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all',
              isCurrentDepth && isActive
                ? 'bg-primary animate-pulse'
                : isCurrentDepth
                  ? 'bg-primary'
                  : 'bg-muted-foreground'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
