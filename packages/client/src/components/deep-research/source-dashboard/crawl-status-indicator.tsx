/**
 * Crawl Status Indicator Component
 *
 * Displays the current crawl status with color-coded badge and animations.
 * Shows real-time status updates with pulse animation for active crawls.
 */

import { Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { Activity, CheckCircle, XCircle, Clock, Loader2, Pause, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface CrawlStatusIndicatorProps {
  status: 'idle' | 'queued' | 'active' | 'completed' | 'failed' | 'paused'
  lastCrawlTime?: string
  sessionId?: string | null
  className?: string
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    icon: Activity,
    variant: 'default' as const,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Crawl is currently in progress',
    pulse: true
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    variant: 'secondary' as const,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Crawl completed successfully',
    pulse: false
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive' as const,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Crawl encountered errors',
    pulse: false
  },
  idle: {
    label: 'Idle',
    icon: Clock,
    variant: 'outline' as const,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'No active crawl',
    pulse: false
  },
  queued: {
    label: 'Queued',
    icon: Loader2,
    variant: 'secondary' as const,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Crawl is queued and will start soon',
    pulse: false
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    variant: 'secondary' as const,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Crawl has been paused',
    pulse: false
  }
} as const

/**
 * CrawlStatusIndicator - Shows current crawl status with visual feedback
 *
 * Features:
 * - Color-coded status badges
 * - Pulse animation for active status
 * - Tooltip with detailed information
 * - Last crawl timestamp display
 * - Session ID tracking
 *
 * @example
 * ```tsx
 * <CrawlStatusIndicator
 *   status="active"
 *   lastCrawlTime="2024-03-15T10:30:00Z"
 *   sessionId="session-123"
 * />
 * ```
 */
export function CrawlStatusIndicator({
  status,
  lastCrawlTime,
  sessionId,
  className
}: CrawlStatusIndicatorProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-medium">{config.description}</p>
      {lastCrawlTime && (
        <p className="text-xs text-muted-foreground">
          Last activity: {formatDistanceToNow(new Date(lastCrawlTime), { addSuffix: true })}
        </p>
      )}
      {sessionId && (
        <p className="text-xs text-muted-foreground font-mono">Session: {sessionId.slice(0, 8)}...</p>
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={cn('flex items-center gap-1.5 px-3 py-1', className)}>
            <Icon
              className={cn('h-3.5 w-3.5', config.pulse && 'animate-pulse')}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{config.label}</span>
            {status === 'active' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact version without tooltip for use in lists
 */
export function CrawlStatusBadge({ status }: Pick<CrawlStatusIndicatorProps, 'status'>) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 px-2 py-0.5">
      <Icon className={cn('h-3 w-3', config.pulse && 'animate-pulse')} aria-hidden="true" />
      <span className="text-xs">{config.label}</span>
    </Badge>
  )
}

/**
 * Large card version with more details
 */
export function CrawlStatusCard({ status, lastCrawlTime, sessionId }: CrawlStatusIndicatorProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        config.bgColor,
        config.borderColor
      )}
      role="status"
      aria-label={`Crawl status: ${config.label}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn('rounded-full p-2', config.bgColor)}>
          <Icon
            className={cn('h-5 w-5', config.color, config.pulse && 'animate-pulse')}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn('font-semibold', config.color)}>{config.label}</h4>
            {status === 'active' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          {lastCrawlTime && (
            <p className="text-xs text-muted-foreground mt-2">
              Last activity: {formatDistanceToNow(new Date(lastCrawlTime), { addSuffix: true })}
            </p>
          )}
          {sessionId && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Session: {sessionId}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
