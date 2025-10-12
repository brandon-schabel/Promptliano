/**
 * Research Crawl Helper Methods
 * Provides specialized methods for managing crawl statistics and metadata
 */

import { eq } from 'drizzle-orm'
import { db } from '../db'
import {
  researchSources,
  type ResearchSource,
  type ResearchSourceMetadata
} from '../schema'
import {
  type EnhancedResearchSourceMetadata,
  type CrawlProgress,
  type LinkDiscoveryEntry,
  type PerformanceStats,
  type ErrorEntry,
  createInitialSourceMetadata,
  updateCrawlProgress,
  addDiscoveredLink,
  trackError,
  updatePerformanceStats,
  setCrawlStatus,
  validateSourceMetadata,
  validatePartialSourceMetadata
} from '../schemas/research-metadata'

// =============================================================================
// CRAWL STATUS MANAGEMENT
// =============================================================================

/**
 * Update the crawl status of a research source
 */
export async function updateSourceCrawlStatus(
  sourceId: number,
  status: EnhancedResearchSourceMetadata['crawlStatus'],
  sessionId?: string
): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse and update metadata with validation
  const currentMetadata = validateSourceMetadata(source.metadata || {})
  const updatedMetadata = setCrawlStatus(currentMetadata, status, sessionId)

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: updatedMetadata,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

// =============================================================================
// CRAWL PROGRESS TRACKING
// =============================================================================

/**
 * Update crawl progress metrics for a source
 */
export async function updateSourceCrawlProgress(
  sourceId: number,
  progress: Partial<CrawlProgress>
): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse and update metadata with validation
  const currentMetadata = validateSourceMetadata(source.metadata || {})
  const updatedMetadata = updateCrawlProgress(currentMetadata, progress)

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: updatedMetadata,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

/**
 * Batch update progress for multiple sources
 */
export async function batchUpdateCrawlProgress(
  updates: Array<{ sourceId: number; progress: Partial<CrawlProgress> }>
): Promise<void> {
  // Process updates in parallel batches of 10
  const batchSize = 10
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await Promise.all(
      batch.map(({ sourceId, progress }) =>
        updateSourceCrawlProgress(sourceId, progress)
      )
    )
  }
}

// =============================================================================
// LINK DISCOVERY TRACKING
// =============================================================================

/**
 * Add a discovered link to the source's timeline
 */
export async function addSourceDiscoveredLink(
  sourceId: number,
  link: Omit<LinkDiscoveryEntry, 'discoveredAt'>
): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse and update metadata with validation
  const currentMetadata = validateSourceMetadata(source.metadata || {})
  const updatedMetadata = addDiscoveredLink(currentMetadata, link)

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: updatedMetadata,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

/**
 * Batch add discovered links
 */
export async function batchAddDiscoveredLinks(
  sourceId: number,
  links: Array<Omit<LinkDiscoveryEntry, 'discoveredAt'>>
): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse current metadata with validation
  let currentMetadata = validateSourceMetadata(source.metadata || {})

  // Add all links to metadata
  for (const link of links) {
    currentMetadata = addDiscoveredLink(currentMetadata, link)
  }

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: currentMetadata,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

// =============================================================================
// PERFORMANCE TRACKING
// =============================================================================

/**
 * Update performance statistics for a source
 */
export async function updateSourcePerformanceStats(
  sourceId: number,
  stats: Partial<PerformanceStats>
): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse and update metadata with validation
  const currentMetadata = validateSourceMetadata(source.metadata || {})
  const updatedMetadata = updatePerformanceStats(currentMetadata, stats)

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: updatedMetadata,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

// =============================================================================
// ERROR TRACKING
// =============================================================================

/**
 * Track an error for a source
 */
export async function trackSourceError(
  sourceId: number,
  error: Omit<ErrorEntry, 'timestamp'>
): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse and update metadata with validation
  const currentMetadata = validateSourceMetadata(source.metadata || {})
  const updatedMetadata = trackError(currentMetadata, error)

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: updatedMetadata,
      status: 'failed', // Mark source as failed when error is tracked
      errorMessage: error.errorMessage,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

/**
 * Clear errors and reset consecutive error counter
 */
export async function clearSourceErrors(sourceId: number): Promise<ResearchSource | null> {
  // Get current source
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  // Parse and update metadata with validation
  const currentMetadata = validateSourceMetadata(source.metadata || {})

  // Clear error tracking but keep error history
  const updatedMetadata: EnhancedResearchSourceMetadata = {
    ...currentMetadata,
    errorTracking: currentMetadata.errorTracking ? {
      ...currentMetadata.errorTracking,
      consecutiveErrors: 0
    } : undefined,
    lastUpdatedAt: Date.now()
  }

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: updatedMetadata,
      errorMessage: null,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

// =============================================================================
// AGGREGATION & REPORTING
// =============================================================================

/**
 * Get crawl statistics summary for a research session
 */
export async function getResearchCrawlStatistics(researchId: number): Promise<{
  totalSources: number
  sourcesWithCrawl: number
  activeCrawls: number
  completedCrawls: number
  failedCrawls: number
  totalLinksDiscovered: number
  totalPagesCrawled: number
  totalErrors: number
  avgSuccessRate: number
  totalTokens: number
}> {
  // Get all sources for the research
  const sources = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.researchId, researchId))

  // Aggregate statistics
  let sourcesWithCrawl = 0
  let activeCrawls = 0
  let completedCrawls = 0
  let failedCrawls = 0
  let totalLinksDiscovered = 0
  let totalPagesCrawled = 0
  let totalErrors = 0
  let totalSuccessRate = 0
  let successRateCount = 0
  let totalTokens = 0

  for (const source of sources) {
    const metadata = validateSourceMetadata(source.metadata || {})

    if (!metadata) continue

    // Count sources with crawl data
    if (metadata.crawlStatus && metadata.crawlStatus !== 'idle') {
      sourcesWithCrawl++
    }

    // Count by status
    switch (metadata.crawlStatus) {
      case 'active':
      case 'queued':
        activeCrawls++
        break
      case 'completed':
        completedCrawls++
        break
      case 'failed':
        failedCrawls++
        break
    }

    // Aggregate metrics
    if (metadata.crawlProgress) {
      totalLinksDiscovered += metadata.crawlProgress.totalLinksDiscovered || 0
      totalPagesCrawled += metadata.crawlProgress.totalPagesCrawled || 0
    }

    if (metadata.errorTracking) {
      totalErrors += metadata.errorTracking.totalErrorCount || 0
    }

    if (metadata.performanceStats) {
      if (metadata.performanceStats.successRate !== undefined) {
        totalSuccessRate += metadata.performanceStats.successRate
        successRateCount++
      }
      totalTokens += metadata.performanceStats.totalTokens || 0
    }
  }

  const avgSuccessRate = successRateCount > 0 ? totalSuccessRate / successRateCount : 100

  return {
    totalSources: sources.length,
    sourcesWithCrawl,
    activeCrawls,
    completedCrawls,
    failedCrawls,
    totalLinksDiscovered,
    totalPagesCrawled,
    totalErrors,
    avgSuccessRate,
    totalTokens
  }
}

/**
 * Get sources currently being crawled
 */
export async function getActiveCrawlingSources(researchId?: number): Promise<ResearchSource[]> {
  let sources: ResearchSource[]

  if (researchId) {
    sources = await db
      .select()
      .from(researchSources)
      .where(eq(researchSources.researchId, researchId)) as ResearchSource[]
  } else {
    sources = await db.select().from(researchSources) as ResearchSource[]
  }

  // Filter for active crawls
  return sources.filter(source => {
    const metadata = validateSourceMetadata(source.metadata || {})
    return metadata?.crawlStatus === 'active' || metadata?.crawlStatus === 'queued'
  })
}

/**
 * Get crawl performance metrics for dashboard
 */
export async function getCrawlPerformanceMetrics(sourceId: number): Promise<{
  status: string
  progress: CrawlProgress | null
  performance: PerformanceStats | null
  errors: number
  lastError: string | null
  linkDiscoveryRate: number
  estimatedTimeRemaining: number | null
} | null> {
  const [source] = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.id, sourceId))
    .limit(1)

  if (!source) return null

  const metadata = validateSourceMetadata(source.metadata || {})

  return {
    status: metadata.crawlStatus || 'idle',
    progress: metadata.crawlProgress || null,
    performance: metadata.performanceStats || null,
    errors: metadata.errorTracking?.totalErrorCount || 0,
    lastError: metadata.errorTracking?.lastErrorMessage || null,
    linkDiscoveryRate: metadata.linkDiscoveryTimeline?.linkDiscoveryRatePerMinute || 0,
    estimatedTimeRemaining: metadata.crawlProgress?.estimatedTimeRemainingMs || null
  }
}

// =============================================================================
// INITIALIZATION & CONFIGURATION
// =============================================================================

/**
 * Initialize crawl metadata for a source
 */
export async function initializeSourceCrawlMetadata(
  sourceId: number,
  config?: {
    maxDepth?: number
    maxPages?: number
    crawlDelayMs?: number
    includePatterns?: string[]
    excludePatterns?: string[]
  }
): Promise<ResearchSource | null> {
  const initialMetadata = createInitialSourceMetadata(config)

  // Add additional configuration
  if (config?.includePatterns || config?.excludePatterns) {
    initialMetadata.crawlConfiguration = {
      ...initialMetadata.crawlConfiguration!,
      includePatterns: config.includePatterns,
      excludePatterns: config.excludePatterns
    }
  }

  // Update in database
  const [updated] = await db
    .update(researchSources)
    .set({
      metadata: initialMetadata,
      updatedAt: Date.now()
    })
    .where(eq(researchSources.id, sourceId))
    .returning()

  return updated as ResearchSource
}

// Export all helper functions
export const researchCrawlHelpers = {
  // Status management
  updateSourceCrawlStatus,

  // Progress tracking
  updateSourceCrawlProgress,
  batchUpdateCrawlProgress,

  // Link discovery
  addSourceDiscoveredLink,
  batchAddDiscoveredLinks,

  // Performance
  updateSourcePerformanceStats,

  // Error tracking
  trackSourceError,
  clearSourceErrors,

  // Aggregation & reporting
  getResearchCrawlStatistics,
  getActiveCrawlingSources,
  getCrawlPerformanceMetrics,

  // Initialization
  initializeSourceCrawlMetadata
}