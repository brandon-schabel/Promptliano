/**
 * Research Source Metadata Schema - Comprehensive Crawling Statistics
 * Defines type-safe metadata structure for research sources with full crawl tracking
 */

import { z } from '@hono/zod-openapi'

// =============================================================================
// CRAWL METADATA SCHEMAS
// =============================================================================

/**
 * Link Discovery Timeline Entry
 * Tracks individual link discoveries with timestamps
 */
export const linkDiscoveryEntry = z.object({
  url: z.string(),
  title: z.string().optional(),
  discoveredAt: z.number(),
  depth: z.number(),
  parentUrl: z.string().optional(),
  relevanceScore: z.number().min(0).max(1).optional()
}).strict()

export type LinkDiscoveryEntry = z.infer<typeof linkDiscoveryEntry>

/**
 * Performance Statistics
 * Tracks crawl performance metrics
 */
export const performanceStats = z.object({
  avgCrawlTimeMs: z.number(),
  minCrawlTimeMs: z.number().optional(),
  maxCrawlTimeMs: z.number().optional(),
  successRate: z.number().min(0).max(100),
  failedPagesCount: z.number(),
  totalTokens: z.number(),
  avgTokensPerPage: z.number(),
  totalContentSizeBytes: z.number(),
  avgContentSizeBytes: z.number(),
  pagesPerMinute: z.number().optional(),
  bytesPerSecond: z.number().optional()
}).strict()

export type PerformanceStats = z.infer<typeof performanceStats>

/**
 * Error Entry
 * Tracks individual error occurrences
 */
export const errorEntry = z.object({
  url: z.string(),
  errorCode: z.string().optional(),
  errorMessage: z.string(),
  timestamp: z.number(),
  retryCount: z.number().default(0)
}).strict()

export type ErrorEntry = z.infer<typeof errorEntry>

/**
 * Depth Level Statistics
 * Tracks link distribution by depth level
 */
export const depthLevelStats = z.object({
  depth: z.number(),
  totalLinks: z.number(),
  crawledLinks: z.number(),
  pendingLinks: z.number(),
  failedLinks: z.number(),
  avgProcessingTimeMs: z.number().optional()
}).strict()

export type DepthLevelStats = z.infer<typeof depthLevelStats>

/**
 * Crawl Progress Metrics
 * Real-time crawl progress tracking
 */
export const crawlProgress = z.object({
  // Core progress metrics
  totalLinksDiscovered: z.number(),
  totalPagesCrawled: z.number(),
  pagesRemainingInQueue: z.number(),
  currentDepth: z.number(),
  maxDepthConfigured: z.number(),

  // Depth distribution
  linksPerDepth: z.array(depthLevelStats).optional(),

  // Status counts
  pendingPages: z.number(),
  processingPages: z.number(),
  completedPages: z.number(),
  failedPages: z.number(),
  skippedPages: z.number().optional(),

  // Rate metrics
  currentCrawlRate: z.number().optional(), // pages per minute
  estimatedTimeRemainingMs: z.number().optional()
}).strict()

export type CrawlProgress = z.infer<typeof crawlProgress>

/**
 * Link Discovery Timeline
 * Tracks recent link discoveries with rate metrics
 */
export const linkDiscoveryTimeline = z.object({
  recentDiscoveries: z.array(linkDiscoveryEntry).max(100), // Keep last 100
  linkDiscoveryRatePerMinute: z.number(),
  lastLinkDiscoveredAt: z.number().optional(),
  totalLinksDiscoveredSession: z.number(),
  uniqueDomainsDiscovered: z.number().optional()
}).strict()

export type LinkDiscoveryTimeline = z.infer<typeof linkDiscoveryTimeline>

/**
 * Error Tracking
 * Comprehensive error tracking and analysis
 */
export const errorTracking = z.object({
  totalErrorCount: z.number(),
  lastErrorMessage: z.string().optional(),
  lastErrorAt: z.number().optional(),
  failedUrls: z.array(errorEntry).max(50), // Keep last 50 errors
  errorsByType: z.record(z.string(), z.number()).optional(), // Error type counts
  consecutiveErrors: z.number().default(0)
}).strict()

export type ErrorTracking = z.infer<typeof errorTracking>

/**
 * Enhanced Research Source Metadata
 * Complete metadata structure for research sources with full crawling statistics
 */
export const enhancedResearchSourceMetadata = z.object({
  // ===== 1. CRAWL STATUS INFORMATION =====
  crawlStatus: z.enum(['idle', 'queued', 'active', 'completed', 'failed', 'paused']).default('idle'),
  lastCrawlStartedAt: z.number().optional(),
  lastCrawlEndedAt: z.number().optional(),
  currentCrawlSessionId: z.string().optional(),
  crawlPriority: z.number().min(0).max(10).default(5),

  // ===== 2. CRAWL PROGRESS METRICS =====
  crawlProgress: crawlProgress.optional(),

  // ===== 3. PERFORMANCE STATS =====
  performanceStats: performanceStats.optional(),

  // ===== 4. LINK DISCOVERY TIMELINE =====
  linkDiscoveryTimeline: linkDiscoveryTimeline.optional(),

  // ===== 5. ERROR TRACKING =====
  errorTracking: errorTracking.optional(),

  // ===== Additional Metadata =====
  crawlConfiguration: z.object({
    maxDepth: z.number(),
    maxPages: z.number(),
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    respectRobotsTxt: z.boolean().default(true),
    crawlDelayMs: z.number().default(1000),
    userAgent: z.string().optional()
  }).optional(),

  // Quality metrics
  qualityMetrics: z.object({
    contentQualityScore: z.number().min(0).max(1).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    duplicateContentRatio: z.number().min(0).max(1).optional()
  }).optional(),

  // Resource usage
  resourceUsage: z.object({
    totalBandwidthBytes: z.number(),
    totalProcessingTimeMs: z.number(),
    peakMemoryUsageBytes: z.number().optional()
  }).optional(),

  // Last update timestamp for real-time tracking
  lastUpdatedAt: z.number().optional()
}).strict()

export type EnhancedResearchSourceMetadata = z.infer<typeof enhancedResearchSourceMetadata>

// =============================================================================
// METADATA UPDATE HELPERS
// =============================================================================

/**
 * Creates initial metadata for a new research source
 */
export function createInitialSourceMetadata(config?: {
  maxDepth?: number
  maxPages?: number
  crawlDelayMs?: number
}): EnhancedResearchSourceMetadata {
  return {
    crawlStatus: 'idle',
    crawlPriority: 5, // Add required crawlPriority field
    crawlConfiguration: {
      maxDepth: config?.maxDepth ?? 3,
      maxPages: config?.maxPages ?? 100,
      crawlDelayMs: config?.crawlDelayMs ?? 1000,
      respectRobotsTxt: true
    },
    lastUpdatedAt: Date.now()
  }
}

/**
 * Updates crawl progress metrics
 */
export function updateCrawlProgress(
  current: EnhancedResearchSourceMetadata,
  updates: Partial<CrawlProgress>
): EnhancedResearchSourceMetadata {
  return {
    ...current,
    crawlProgress: {
      ...current.crawlProgress,
      ...updates,
      totalLinksDiscovered: updates.totalLinksDiscovered ?? current.crawlProgress?.totalLinksDiscovered ?? 0,
      totalPagesCrawled: updates.totalPagesCrawled ?? current.crawlProgress?.totalPagesCrawled ?? 0,
      pagesRemainingInQueue: updates.pagesRemainingInQueue ?? current.crawlProgress?.pagesRemainingInQueue ?? 0,
      currentDepth: updates.currentDepth ?? current.crawlProgress?.currentDepth ?? 0,
      maxDepthConfigured: updates.maxDepthConfigured ?? current.crawlProgress?.maxDepthConfigured ?? 3,
      pendingPages: updates.pendingPages ?? current.crawlProgress?.pendingPages ?? 0,
      processingPages: updates.processingPages ?? current.crawlProgress?.processingPages ?? 0,
      completedPages: updates.completedPages ?? current.crawlProgress?.completedPages ?? 0,
      failedPages: updates.failedPages ?? current.crawlProgress?.failedPages ?? 0
    },
    lastUpdatedAt: Date.now()
  }
}

/**
 * Adds a discovered link to the timeline
 */
export function addDiscoveredLink(
  current: EnhancedResearchSourceMetadata,
  link: Omit<LinkDiscoveryEntry, 'discoveredAt'>
): EnhancedResearchSourceMetadata {
  const entry: LinkDiscoveryEntry = {
    ...link,
    discoveredAt: Date.now()
  }

  const timeline = current.linkDiscoveryTimeline ?? {
    recentDiscoveries: [],
    linkDiscoveryRatePerMinute: 0,
    totalLinksDiscoveredSession: 0
  }

  // Keep only last 100 entries
  const recentDiscoveries = [entry, ...timeline.recentDiscoveries].slice(0, 100)

  // Calculate discovery rate (links per minute over last 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  const recentCount = recentDiscoveries.filter(d => d.discoveredAt > fiveMinutesAgo).length
  const linkDiscoveryRatePerMinute = recentCount / 5

  return {
    ...current,
    linkDiscoveryTimeline: {
      recentDiscoveries,
      linkDiscoveryRatePerMinute,
      lastLinkDiscoveredAt: entry.discoveredAt,
      totalLinksDiscoveredSession: timeline.totalLinksDiscoveredSession + 1,
      uniqueDomainsDiscovered: timeline.uniqueDomainsDiscovered
    },
    lastUpdatedAt: Date.now()
  }
}

/**
 * Tracks an error occurrence
 */
export function trackError(
  current: EnhancedResearchSourceMetadata,
  error: Omit<ErrorEntry, 'timestamp'>
): EnhancedResearchSourceMetadata {
  const errorItem: ErrorEntry = {
    ...error,
    timestamp: Date.now()
  }

  const tracking = current.errorTracking ?? {
    totalErrorCount: 0,
    failedUrls: [],
    consecutiveErrors: 0
  }

  // Keep only last 50 errors
  const failedUrls = [errorItem, ...tracking.failedUrls].slice(0, 50)

  // Update error type counts
  const errorsByType = { ...tracking.errorsByType }
  if (error.errorCode) {
    errorsByType[error.errorCode] = (errorsByType[error.errorCode] ?? 0) + 1
  }

  return {
    ...current,
    errorTracking: {
      totalErrorCount: tracking.totalErrorCount + 1,
      lastErrorMessage: error.errorMessage,
      lastErrorAt: errorItem.timestamp,
      failedUrls,
      errorsByType,
      consecutiveErrors: tracking.consecutiveErrors + 1
    },
    lastUpdatedAt: Date.now()
  }
}

/**
 * Updates performance statistics
 */
export function updatePerformanceStats(
  current: EnhancedResearchSourceMetadata,
  stats: Partial<PerformanceStats>
): EnhancedResearchSourceMetadata {
  return {
    ...current,
    performanceStats: {
      avgCrawlTimeMs: stats.avgCrawlTimeMs ?? current.performanceStats?.avgCrawlTimeMs ?? 0,
      successRate: stats.successRate ?? current.performanceStats?.successRate ?? 100,
      failedPagesCount: stats.failedPagesCount ?? current.performanceStats?.failedPagesCount ?? 0,
      totalTokens: stats.totalTokens ?? current.performanceStats?.totalTokens ?? 0,
      avgTokensPerPage: stats.avgTokensPerPage ?? current.performanceStats?.avgTokensPerPage ?? 0,
      totalContentSizeBytes: stats.totalContentSizeBytes ?? current.performanceStats?.totalContentSizeBytes ?? 0,
      avgContentSizeBytes: stats.avgContentSizeBytes ?? current.performanceStats?.avgContentSizeBytes ?? 0,
      ...stats
    },
    lastUpdatedAt: Date.now()
  }
}

/**
 * Sets crawl status with appropriate timestamp updates
 */
export function setCrawlStatus(
  current: EnhancedResearchSourceMetadata,
  status: EnhancedResearchSourceMetadata['crawlStatus'],
  sessionId?: string
): EnhancedResearchSourceMetadata {
  const updates: Partial<EnhancedResearchSourceMetadata> = {
    crawlStatus: status,
    lastUpdatedAt: Date.now()
  }

  if (status === 'active' || status === 'queued') {
    updates.lastCrawlStartedAt = Date.now()
    updates.currentCrawlSessionId = sessionId
  } else if (status === 'completed' || status === 'failed' || status === 'paused') {
    updates.lastCrawlEndedAt = Date.now()
  }

  return {
    ...current,
    ...updates
  }
}

// =============================================================================
// VALIDATION EXPORTS
// =============================================================================

export const validateSourceMetadata = (data: unknown): EnhancedResearchSourceMetadata => {
  return enhancedResearchSourceMetadata.parse(data)
}

export const validatePartialSourceMetadata = (data: unknown): Partial<EnhancedResearchSourceMetadata> => {
  return enhancedResearchSourceMetadata.partial().parse(data)
}