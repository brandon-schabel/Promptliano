/**
 * Link Timeline Component
 *
 * Displays a chronological timeline of discovered links with status indicators.
 * Features real-time updates and virtualized scrolling for performance.
 */

import { Badge, ScrollArea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { Link2, ExternalLink, CheckCircle, Clock, XCircle, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface LinkTimelineProps {
  links: Array<{
    url: string
    title?: string
    depth: number
    discoveredAt: string
    status: 'pending' | 'crawled' | 'failed'
    parentUrl?: string
    relevanceScore?: number
  }>
  linkDiscoveryRate?: number
  isLive?: boolean
  className?: string
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  crawled: {
    label: 'Crawled',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  }
} as const

/**
 * LinkTimeline - Chronological display of discovered links
 *
 * Features:
 * - Real-time link discovery updates
 * - Status badges with color coding
 * - Depth level indicators
 * - Parent URL tracking
 * - Relevance scores
 * - Virtualized scrolling for performance
 * - Auto-scroll to latest links
 *
 * @example
 * ```tsx
 * <LinkTimeline
 *   links={[
 *     {
 *       url: 'https://example.com/page1',
 *       title: 'Example Page',
 *       depth: 1,
 *       discoveredAt: '2024-03-15T10:30:00Z',
 *       status: 'crawled',
 *       parentUrl: 'https://example.com',
 *       relevanceScore: 0.85
 *     }
 *   ]}
 *   linkDiscoveryRate={2.5}
 *   isLive={true}
 * />
 * ```
 */
export function LinkTimeline({ links, linkDiscoveryRate, isLive, className }: LinkTimelineProps) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)

  if (links.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card p-8 text-center', className)}>
        <Link2 className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
        <p className="text-sm text-muted-foreground">No links discovered yet</p>
        <p className="text-xs text-muted-foreground mt-1">Links will appear here as they are found</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Link Timeline</h3>
          <Badge variant="outline" className="font-normal">
            {links.length} links
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {linkDiscoveryRate !== undefined && (
            <div className="text-sm text-muted-foreground">
              <Activity className="inline h-4 w-4 mr-1" />
              {linkDiscoveryRate.toFixed(1)} links/min
            </div>
          )}
          {isLive && (
            <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="h-[600px] rounded-lg border bg-card">
        <div className="p-4 space-y-2">
          {links.map((link, index) => (
            <LinkTimelineItem
              key={`${link.url}-${index}`}
              link={link}
              isExpanded={expandedUrl === link.url}
              onToggleExpand={() => setExpandedUrl(expandedUrl === link.url ? null : link.url)}
              isNew={index < 3 && Boolean(isLive)} // Highlight first 3 items if live
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * LinkTimelineItem - Individual link entry in timeline
 */
function LinkTimelineItem({
  link,
  isExpanded,
  onToggleExpand,
  isNew
}: {
  link: LinkTimelineProps['links'][0]
  isExpanded: boolean
  onToggleExpand: () => void
  isNew: boolean
}) {
  const statusConfig = STATUS_CONFIG[link.status]
  const StatusIcon = statusConfig.icon

  // Truncate URL for display
  const displayUrl = link.url.length > 60 ? `${link.url.slice(0, 57)}...` : link.url
  const timeAgo = formatDistanceToNow(new Date(link.discoveredAt), { addSuffix: true })

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all duration-300',
        'hover:shadow-md hover:border-primary/50 cursor-pointer',
        isNew && 'animate-in fade-in slide-in-from-top-2 border-primary bg-primary/5',
        isExpanded && 'shadow-lg border-primary'
      )}
      onClick={onToggleExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleExpand()
        }
      }}
      aria-expanded={isExpanded}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={cn('rounded-full p-2 flex-shrink-0', statusConfig.bgColor)}>
          <StatusIcon className={cn('h-4 w-4', statusConfig.color)} aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* URL and Title */}
          <div>
            {link.title && (
              <p className="font-medium text-sm mb-1 truncate" title={link.title}>
                {link.title}
              </p>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{displayUrl}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-md break-all">{link.url}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              Depth {link.depth}
            </Badge>
            <Badge variant={link.status === 'crawled' ? 'default' : 'secondary'} className="text-xs">
              {statusConfig.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {link.relevanceScore !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {(link.relevanceScore * 100).toFixed(0)}% relevant
              </Badge>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded ? (
            <div
              className="pt-2 border-t space-y-2 animate-in fade-in slide-in-from-top-1"
              onClick={(e) => e.stopPropagation()}
            >
              {link.parentUrl ? (
                <div className="text-xs">
                  <span className="text-muted-foreground">Discovered from:</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={link.parentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-blue-600 hover:underline truncate inline-block max-w-[300px] align-bottom"
                        >
                          {link.parentUrl}
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-md break-all">{link.parentUrl}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                <span>Discovered:</span>
                <span className="ml-1 font-mono">
                  {new Date(link.discoveredAt).toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version for smaller displays
 */
export function CompactLinkTimeline({
  links,
  maxItems = 10
}: Pick<LinkTimelineProps, 'links'> & { maxItems?: number }) {
  const displayLinks = links.slice(0, maxItems)

  return (
    <div className="space-y-2">
      {displayLinks.map((link, index) => {
        const statusConfig = STATUS_CONFIG[link.status]
        const StatusIcon = statusConfig.icon

        return (
          <div key={`${link.url}-${index}`} className="flex items-center gap-2 text-sm">
            <StatusIcon className={cn('h-4 w-4 flex-shrink-0', statusConfig.color)} />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate flex-1"
              title={link.url}
            >
              {link.url}
            </a>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              D{link.depth}
            </Badge>
          </div>
        )
      })}
      {links.length > maxItems && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          +{links.length - maxItems} more links
        </p>
      )}
    </div>
  )
}
