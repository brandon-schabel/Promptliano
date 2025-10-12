/**
 * Source Dashboard Components
 *
 * A comprehensive set of reusable components for displaying real-time
 * crawl statistics, performance metrics, and activity feeds.
 *
 * @module source-dashboard
 */

// Status components
export { CrawlStatusIndicator, CrawlStatusBadge, CrawlStatusCard } from './crawl-status-indicator'

// Progress components
export { CrawlProgressPanel } from './crawl-progress-panel'

// Performance components
export { PerformanceStatsCard } from './performance-stats-card'

// Timeline components
export { LinkTimeline, CompactLinkTimeline } from './link-timeline'

// Error logging components
export { ErrorLogPanel, ErrorLogSummary } from './error-log-panel'

// Activity feed components
export {
  CrawlActivityFeed,
  CompactActivityFeed,
  ActivityFeedWithStats
} from './crawl-activity-feed'

// Content samples components
export { ContentSamplesPanel, ContentSamplesGrid } from './content-samples-panel'

/**
 * Re-export types from individual files
 * Note: Component prop types are available via React.ComponentProps<typeof Component>
 */
