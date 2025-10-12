/**
 * Crawl Activity Feed Component
 *
 * Real-time activity feed showing live crawl events and updates.
 * Only visible during active crawling sessions.
 */

import { ScrollArea, Badge } from '@promptliano/ui'
import { Activity, Link2, CheckCircle, XCircle, Layers, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'

interface CrawlActivityFeedProps {
  isActive: boolean
  recentLinks: Array<{ url: string; discoveredAt: string }>
  recentErrors: Array<{ message: string; timestamp: string }>
  currentDepth: number
  className?: string
}

type ActivityEvent = {
  id: string
  type: 'link_discovered' | 'page_crawled' | 'error_occurred' | 'depth_completed'
  timestamp: string
  data: {
    url?: string
    message?: string
    depth?: number
  }
}

const ACTIVITY_CONFIG = {
  link_discovered: {
    icon: Link2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    label: 'Link Discovered'
  },
  page_crawled: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'Page Crawled'
  },
  error_occurred: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    label: 'Error Occurred'
  },
  depth_completed: {
    icon: Layers,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    label: 'Depth Completed'
  }
} as const

/**
 * CrawlActivityFeed - Real-time activity stream for active crawls
 *
 * Features:
 * - Live activity updates
 * - Auto-scroll to latest activity
 * - Activity type icons and colors
 * - Timestamp formatting
 * - Maximum 50 recent activities
 * - Conditional rendering (only shows when active)
 *
 * @example
 * ```tsx
 * <CrawlActivityFeed
 *   isActive={true}
 *   recentLinks={[
 *     { url: 'https://example.com/page1', discoveredAt: '2024-03-15T10:30:00Z' }
 *   ]}
 *   recentErrors={[
 *     { message: 'Connection timeout', timestamp: '2024-03-15T10:31:00Z' }
 *   ]}
 *   currentDepth={2}
 * />
 * ```
 */
export function CrawlActivityFeed({
  isActive,
  recentLinks,
  recentErrors,
  currentDepth,
  className
}: CrawlActivityFeedProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastActivityCount = useRef<number>(0)

  // Don't render if not active
  if (!isActive) {
    return null
  }

  // Combine and sort activities
  const activities: ActivityEvent[] = [
    ...recentLinks.slice(0, 30).map((link, index) => ({
      id: `link-${index}-${link.discoveredAt}`,
      type: 'link_discovered' as const,
      timestamp: link.discoveredAt,
      data: { url: link.url }
    })),
    ...recentErrors.slice(0, 20).map((error, index) => ({
      id: `error-${index}-${error.timestamp}`,
      type: 'error_occurred' as const,
      timestamp: error.timestamp,
      data: { message: error.message }
    }))
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50) // Keep only 50 most recent

  // Auto-scroll when new activities are added
  useEffect(() => {
    if (activities.length > lastActivityCount.current) {
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    lastActivityCount.current = activities.length
  }, [activities.length])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <h3 className='text-lg font-semibold'>Live Activity</h3>
          <Badge variant='default' className='flex items-center gap-1'>
            <Activity className='h-3 w-3 animate-pulse' />
            Active
          </Badge>
        </div>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <TrendingUp className='h-4 w-4' />
          <span>{activities.length} recent events</span>
        </div>
      </div>

      {/* Activity Feed */}
      <ScrollArea className='h-[500px] rounded-lg border bg-card p-4' ref={scrollAreaRef}>
        {activities.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            <Activity className='mx-auto h-8 w-8 mb-2 opacity-50 animate-pulse' />
            <p className='text-sm'>Waiting for crawl activity...</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {activities.map((activity, index) => (
              <ActivityItem key={activity.id} activity={activity} isNew={index < 3} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer Status */}
      <div className='flex items-center justify-between text-xs text-muted-foreground px-2'>
        <span>Current depth: {currentDepth}</span>
        <span className='flex items-center gap-1'>
          <span className='relative flex h-2 w-2'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' />
            <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500' />
          </span>
          Updates in real-time
        </span>
      </div>
    </div>
  )
}

/**
 * ActivityItem - Individual activity entry
 */
function ActivityItem({ activity, isNew }: { activity: ActivityEvent; isNew: boolean }) {
  const config = ACTIVITY_CONFIG[activity.type]
  const Icon = config.icon
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all duration-300',
        isNew && 'animate-in fade-in slide-in-from-top-2 bg-primary/5 border-primary',
        !isNew && 'bg-card hover:bg-muted/50'
      )}
    >
      {/* Icon */}
      <div className={cn('rounded-full p-2 flex-shrink-0', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} aria-hidden='true' />
      </div>

      {/* Content */}
      <div className='flex-1 min-w-0 space-y-1'>
        <div className='flex items-center gap-2'>
          <span className='font-medium text-sm'>{config.label}</span>
          <span className='text-xs text-muted-foreground'>{timeAgo}</span>
        </div>

        {/* Activity-specific content */}
        {activity.type === 'link_discovered' && activity.data.url && (
          <p className='text-sm text-blue-600 truncate' title={activity.data.url}>
            {activity.data.url}
          </p>
        )}

        {activity.type === 'page_crawled' && activity.data.url && (
          <p className='text-sm text-muted-foreground truncate'>Successfully crawled page</p>
        )}

        {activity.type === 'error_occurred' && activity.data.message && (
          <p className='text-sm text-red-600'>{activity.data.message}</p>
        )}

        {activity.type === 'depth_completed' && activity.data.depth !== undefined && (
          <p className='text-sm text-muted-foreground'>Completed crawling at depth {activity.data.depth}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version for smaller displays
 */
export function CompactActivityFeed({ activities, maxItems = 10 }: { activities: ActivityEvent[]; maxItems?: number }) {
  const displayActivities = activities.slice(0, maxItems)

  return (
    <div className='space-y-1'>
      {displayActivities.map((activity) => {
        const config = ACTIVITY_CONFIG[activity.type]
        const Icon = config.icon

        return (
          <div key={activity.id} className='flex items-center gap-2 text-sm'>
            <Icon className={cn('h-4 w-4 flex-shrink-0', config.color)} />
            <span className='flex-1 truncate text-muted-foreground'>
              {config.label}
              {activity.data.url && `: ${activity.data.url}`}
              {activity.data.message && `: ${activity.data.message}`}
            </span>
            <span className='text-xs text-muted-foreground flex-shrink-0'>
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </span>
          </div>
        )
      })}
      {activities.length > maxItems && (
        <p className='text-xs text-muted-foreground text-center pt-2'>
          +{activities.length - maxItems} more activities
        </p>
      )}
    </div>
  )
}

/**
 * Activity feed with statistics
 */
export function ActivityFeedWithStats({ isActive, recentLinks, recentErrors, currentDepth }: CrawlActivityFeedProps) {
  const stats = {
    totalActivities: recentLinks.length + recentErrors.length,
    linksDiscovered: recentLinks.length,
    errors: recentErrors.length,
    successRate:
      recentLinks.length > 0
        ? ((recentLinks.length / (recentLinks.length + recentErrors.length)) * 100).toFixed(1)
        : '0'
  }

  return (
    <div className='space-y-4'>
      {/* Stats Header */}
      <div className='grid grid-cols-4 gap-4'>
        <div className='text-center p-3 rounded-lg border bg-card'>
          <p className='text-2xl font-bold'>{stats.totalActivities}</p>
          <p className='text-xs text-muted-foreground'>Total Events</p>
        </div>
        <div className='text-center p-3 rounded-lg border bg-card'>
          <p className='text-2xl font-bold text-blue-600'>{stats.linksDiscovered}</p>
          <p className='text-xs text-muted-foreground'>Links</p>
        </div>
        <div className='text-center p-3 rounded-lg border bg-card'>
          <p className='text-2xl font-bold text-red-600'>{stats.errors}</p>
          <p className='text-xs text-muted-foreground'>Errors</p>
        </div>
        <div className='text-center p-3 rounded-lg border bg-card'>
          <p className='text-2xl font-bold text-green-600'>{stats.successRate}%</p>
          <p className='text-xs text-muted-foreground'>Success</p>
        </div>
      </div>

      {/* Activity Feed */}
      <CrawlActivityFeed
        isActive={isActive}
        recentLinks={recentLinks}
        recentErrors={recentErrors}
        currentDepth={currentDepth}
      />
    </div>
  )
}
