/**
 * Crawl Debug Service - Functional Factory Pattern
 * Collects and manages crawl debugging events for research workflow monitoring
 *
 * Following Promptliano's service architecture:
 * - Functional factory pattern (not classes)
 * - Dependency injection for testability
 * - Type safety with TypeScript
 * - Circular buffer for memory-efficient event storage
 * - Auto-cleanup of old events
 *
 * Features:
 * - Event collection with circular buffer (last 500 per research)
 * - Event filtering by category, level, time range
 * - Statistics and aggregation
 * - Auto-cleanup (events older than 1 hour)
 * - Integration with web-crawling-service and research-workflow-service
 */

import { createServiceLogger } from './core/base-service'
import { safeErrorFactory } from './core/base-service'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type EventCategory =
  | 'url-processing'
  | 'ai-filtering'
  | 'robots'
  | 'extraction'
  | 'queue-management'
  | 'error'

export type EventLevel = 'debug' | 'info' | 'warn' | 'error'

export interface CrawlDebugEvent {
  id: string
  researchId: number
  timestamp: number
  category: EventCategory
  level: EventLevel
  message: string
  metadata: {
    url?: string
    urlId?: number
    score?: number
    reasoning?: string
    duration?: number
    depth?: number
    queueSize?: number
    crawlId?: string
    error?: string
    statusCode?: number
    contentLength?: number
    linksFound?: number
    linksAccepted?: number
    linksRejected?: number
    threshold?: number
    [key: string]: any
  }
}

export interface EventFilters {
  categories?: EventCategory[]
  levels?: EventLevel[]
  fromTimestamp?: number
  toTimestamp?: number
  limit?: number
}

export interface CrawlDebugStats {
  researchId: number
  totalEvents: number
  eventsByCategory: Record<EventCategory, number>
  eventsByLevel: Record<EventLevel, number>
  averageProcessingTimeMs?: number
  aiAcceptanceRate?: number
  recentActivity: CrawlDebugEvent[]
  timeRange: {
    oldest: number
    newest: number
  }
}

export interface CircularBuffer<T> {
  items: T[]
  maxSize: number
  currentIndex: number
  isFull: boolean
}

export interface CrawlDebugServiceDeps {
  logger?: ReturnType<typeof createServiceLogger>
  maxEventsPerResearch?: number
  autoCleanupIntervalMs?: number
  eventTtlMs?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_EVENTS = 500
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_EVENT_TTL_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_RECENT_ACTIVITY_LIMIT = 10

// =============================================================================
// PURE UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a circular buffer for efficient fixed-size storage
 */
function createCircularBuffer<T>(maxSize: number): CircularBuffer<T> {
  return {
    items: [],
    maxSize,
    currentIndex: 0,
    isFull: false
  }
}

/**
 * Add item to circular buffer
 */
function addToCircularBuffer<T>(buffer: CircularBuffer<T>, item: T): void {
  if (!buffer.isFull && buffer.items.length < buffer.maxSize) {
    buffer.items.push(item)
    buffer.currentIndex = buffer.items.length
  } else {
    buffer.isFull = true
    buffer.currentIndex = buffer.currentIndex % buffer.maxSize
    buffer.items[buffer.currentIndex] = item
    buffer.currentIndex++
  }
}

/**
 * Get all items from circular buffer (in chronological order)
 */
function getCircularBufferItems<T>(buffer: CircularBuffer<T>): T[] {
  if (!buffer.isFull) {
    return [...buffer.items]
  }

  // If full, reorder items to maintain chronological order
  const start = buffer.currentIndex % buffer.maxSize
  return [...buffer.items.slice(start), ...buffer.items.slice(0, start)]
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Calculate average processing time from events
 */
function calculateAverageProcessingTime(events: CrawlDebugEvent[]): number | undefined {
  const durations = events
    .filter((e) => e.category === 'url-processing' && e.metadata.duration !== undefined)
    .map((e) => e.metadata.duration!)

  if (durations.length === 0) return undefined

  return durations.reduce((sum, d) => sum + d, 0) / durations.length
}

/**
 * Calculate AI acceptance rate from events
 */
function calculateAiAcceptanceRate(events: CrawlDebugEvent[]): number | undefined {
  const aiEvents = events.filter((e) => e.category === 'ai-filtering')

  if (aiEvents.length === 0) return undefined

  const totalEvaluated = aiEvents.reduce((sum, e) => {
    const accepted = e.metadata.linksAccepted || 0
    const rejected = e.metadata.linksRejected || 0
    return sum + accepted + rejected
  }, 0)

  const totalAccepted = aiEvents.reduce((sum, e) => sum + (e.metadata.linksAccepted || 0), 0)

  if (totalEvaluated === 0) return undefined

  return totalAccepted / totalEvaluated
}

/**
 * Filter events based on criteria
 */
function filterEvents(events: CrawlDebugEvent[], filters: EventFilters): CrawlDebugEvent[] {
  let filtered = [...events]

  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter((e) => filters.categories!.includes(e.category))
  }

  // Filter by levels
  if (filters.levels && filters.levels.length > 0) {
    filtered = filtered.filter((e) => filters.levels!.includes(e.level))
  }

  // Filter by time range
  if (filters.fromTimestamp !== undefined) {
    filtered = filtered.filter((e) => e.timestamp >= filters.fromTimestamp!)
  }

  if (filters.toTimestamp !== undefined) {
    filtered = filtered.filter((e) => e.timestamp <= filters.toTimestamp!)
  }

  // Apply limit
  if (filters.limit !== undefined && filters.limit > 0) {
    filtered = filtered.slice(-filters.limit)
  }

  return filtered
}

/**
 * Count events by category
 */
function countEventsByCategory(events: CrawlDebugEvent[]): Record<EventCategory, number> {
  const counts: Record<EventCategory, number> = {
    'url-processing': 0,
    'ai-filtering': 0,
    robots: 0,
    extraction: 0,
    'queue-management': 0,
    error: 0
  }

  for (const event of events) {
    counts[event.category]++
  }

  return counts
}

/**
 * Count events by level
 */
function countEventsByLevel(events: CrawlDebugEvent[]): Record<EventLevel, number> {
  const counts: Record<EventLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0
  }

  for (const event of events) {
    counts[event.level]++
  }

  return counts
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Create Crawl Debug Service with functional factory pattern
 */
export function createCrawlDebugService(deps: CrawlDebugServiceDeps = {}) {
  const {
    logger = createServiceLogger('CrawlDebugService'),
    maxEventsPerResearch = DEFAULT_MAX_EVENTS,
    autoCleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
    eventTtlMs = DEFAULT_EVENT_TTL_MS
  } = deps

  // In-memory storage: Map<researchId, CircularBuffer<CrawlDebugEvent>>
  const eventBuffers = new Map<number, CircularBuffer<CrawlDebugEvent>>()

  // Cleanup interval reference
  let cleanupIntervalId: NodeJS.Timeout | null = null

  /**
   * Get or create event buffer for research
   */
  function getOrCreateBuffer(researchId: number): CircularBuffer<CrawlDebugEvent> {
    let buffer = eventBuffers.get(researchId)
    if (!buffer) {
      buffer = createCircularBuffer<CrawlDebugEvent>(maxEventsPerResearch)
      eventBuffers.set(researchId, buffer)
      logger.debug('Created event buffer for research', { researchId, maxSize: maxEventsPerResearch })
    }
    return buffer
  }

  /**
   * Add event to collection
   */
  function addEvent(event: Omit<CrawlDebugEvent, 'id' | 'timestamp'>): void {
    const fullEvent: CrawlDebugEvent = {
      id: generateEventId(),
      timestamp: Date.now(),
      ...event
    }

    const buffer = getOrCreateBuffer(event.researchId)
    addToCircularBuffer(buffer, fullEvent)

    logger.debug('Event added', {
      researchId: event.researchId,
      category: event.category,
      level: event.level,
      message: event.message
    })
  }

  /**
   * Get events for research with optional filtering
   */
  function getEvents(researchId: number, filters: EventFilters = {}): CrawlDebugEvent[] {
    const buffer = eventBuffers.get(researchId)
    if (!buffer) {
      return []
    }

    const allEvents = getCircularBufferItems(buffer)
    return filterEvents(allEvents, filters)
  }

  /**
   * Get recent activity for research
   */
  function getRecentActivity(researchId: number, limit: number = DEFAULT_RECENT_ACTIVITY_LIMIT): CrawlDebugEvent[] {
    const buffer = eventBuffers.get(researchId)
    if (!buffer) {
      return []
    }

    const allEvents = getCircularBufferItems(buffer)
    return allEvents.slice(-limit)
  }

  /**
   * Get statistics for research
   */
  function getStats(researchId: number): CrawlDebugStats {
    const buffer = eventBuffers.get(researchId)
    if (!buffer) {
      return {
        researchId,
        totalEvents: 0,
        eventsByCategory: {
          'url-processing': 0,
          'ai-filtering': 0,
          robots: 0,
          extraction: 0,
          'queue-management': 0,
          error: 0
        },
        eventsByLevel: {
          debug: 0,
          info: 0,
          warn: 0,
          error: 0
        },
        recentActivity: [],
        timeRange: {
          oldest: 0,
          newest: 0
        }
      }
    }

    const allEvents = getCircularBufferItems(buffer)

    // Calculate time range
    const timestamps = allEvents.map((e) => e.timestamp)
    const oldest = timestamps.length > 0 ? Math.min(...timestamps) : 0
    const newest = timestamps.length > 0 ? Math.max(...timestamps) : 0

    return {
      researchId,
      totalEvents: allEvents.length,
      eventsByCategory: countEventsByCategory(allEvents),
      eventsByLevel: countEventsByLevel(allEvents),
      averageProcessingTimeMs: calculateAverageProcessingTime(allEvents),
      aiAcceptanceRate: calculateAiAcceptanceRate(allEvents),
      recentActivity: getRecentActivity(researchId, DEFAULT_RECENT_ACTIVITY_LIMIT),
      timeRange: {
        oldest,
        newest
      }
    }
  }

  /**
   * Clear all events for research
   */
  function clearEvents(researchId: number): void {
    const deleted = eventBuffers.delete(researchId)
    if (deleted) {
      logger.info('Events cleared for research', { researchId })
    }
  }

  /**
   * Cleanup old events (older than TTL)
   */
  function cleanup(): void {
    const now = Date.now()
    const cutoffTime = now - eventTtlMs
    let totalCleaned = 0
    let totalBuffersRemoved = 0

    for (const [researchId, buffer] of Array.from(eventBuffers.entries())) {
      const allEvents = getCircularBufferItems(buffer)
      const validEvents = allEvents.filter((e: CrawlDebugEvent) => e.timestamp >= cutoffTime)

      if (validEvents.length === 0) {
        // Remove entire buffer if no valid events
        eventBuffers.delete(researchId)
        totalBuffersRemoved++
        totalCleaned += allEvents.length
      } else if (validEvents.length < allEvents.length) {
        // Recreate buffer with valid events only
        const newBuffer = createCircularBuffer<CrawlDebugEvent>(maxEventsPerResearch)
        for (const event of validEvents) {
          addToCircularBuffer(newBuffer, event)
        }
        eventBuffers.set(researchId, newBuffer)
        totalCleaned += allEvents.length - validEvents.length
      }
    }

    if (totalCleaned > 0 || totalBuffersRemoved > 0) {
      logger.info('Cleanup complete', {
        eventsCleaned: totalCleaned,
        buffersRemoved: totalBuffersRemoved,
        remainingBuffers: eventBuffers.size
      })
    }
  }

  /**
   * Start auto-cleanup interval
   */
  function startAutoCleanup(): void {
    if (cleanupIntervalId) {
      logger.warn('Auto-cleanup already started')
      return
    }

    cleanupIntervalId = setInterval(() => {
      cleanup()
    }, autoCleanupIntervalMs)

    logger.info('Auto-cleanup started', {
      intervalMs: autoCleanupIntervalMs,
      ttlMs: eventTtlMs
    })
  }

  /**
   * Stop auto-cleanup interval
   */
  function stopAutoCleanup(): void {
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId)
      cleanupIntervalId = null
      logger.info('Auto-cleanup stopped')
    }
  }

  /**
   * Shutdown service and cleanup resources
   */
  function shutdown(): void {
    stopAutoCleanup()
    eventBuffers.clear()
    logger.info('Service shutdown complete')
  }

  /**
   * Get service health status
   */
  function getHealthStatus() {
    return {
      totalResearchSessions: eventBuffers.size,
      totalEvents: Array.from(eventBuffers.values()).reduce((sum, buffer) => {
        return sum + getCircularBufferItems(buffer).length
      }, 0),
      autoCleanupActive: cleanupIntervalId !== null,
      config: {
        maxEventsPerResearch,
        autoCleanupIntervalMs,
        eventTtlMs
      }
    }
  }

  // Start auto-cleanup on service creation
  startAutoCleanup()

  return {
    // Event collection
    addEvent,

    // Retrieval
    getEvents,
    getRecentActivity,

    // Statistics
    getStats,

    // Cleanup
    clearEvents,
    cleanup,

    // Lifecycle
    startAutoCleanup,
    stopAutoCleanup,
    shutdown,

    // Health
    getHealthStatus
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export types
export type CrawlDebugService = ReturnType<typeof createCrawlDebugService>

// Export singleton instance
export const crawlDebugService = createCrawlDebugService()

// Ensure cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    crawlDebugService.shutdown()
  })

  process.on('SIGINT', () => {
    crawlDebugService.shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    crawlDebugService.shutdown()
    process.exit(0)
  })
}
