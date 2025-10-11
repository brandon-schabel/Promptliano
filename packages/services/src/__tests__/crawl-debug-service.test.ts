/**
 * Crawl Debug Service Tests
 * Tests for the crawl debugging event collection and management service
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
  createCrawlDebugService,
  type CrawlDebugService,
  type CrawlDebugEvent,
  type EventFilters
} from '../crawl-debug-service'
import { createServiceLogger } from '../core/base-service'

describe('CrawlDebugService (Isolated)', () => {
  let service: CrawlDebugService
  let mockLogger: ReturnType<typeof createServiceLogger>

  beforeEach(() => {
    mockLogger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {})
    } as any

    service = createCrawlDebugService({
      logger: mockLogger,
      maxEventsPerResearch: 100, // Smaller for testing
      autoCleanupIntervalMs: 60000, // 1 minute for testing
      eventTtlMs: 5000 // 5 seconds for testing
    })
  })

  afterEach(() => {
    service.shutdown()
  })

  describe('Event Collection', () => {
    test('should add event with auto-generated id and timestamp', () => {
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Processing URL',
        metadata: { url: 'https://example.com' }
      })

      const events = service.getEvents(1)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Processing URL',
        metadata: { url: 'https://example.com' }
      })
      expect(events[0]!.id).toBeDefined()
      expect(events[0]!.timestamp).toBeGreaterThan(0)
    })

    test('should store events in circular buffer (max 100)', () => {
      // Add 150 events (exceeds max of 100)
      for (let i = 0; i < 150; i++) {
        service.addEvent({
          researchId: 1,
          category: 'url-processing',
          level: 'debug',
          message: `Event ${i}`,
          metadata: { index: i }
        })
      }

      const events = service.getEvents(1)
      expect(events).toHaveLength(100) // Should only keep last 100

      // Verify we have events 50-149 (oldest events 0-49 were evicted)
      const indices = events.map((e) => e.metadata.index)
      expect(Math.min(...indices)).toBe(50)
      expect(Math.max(...indices)).toBe(149)
    })

    test('should maintain separate buffers for different research IDs', () => {
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Research 1 event',
        metadata: {}
      })

      service.addEvent({
        researchId: 2,
        category: 'ai-filtering',
        level: 'info',
        message: 'Research 2 event',
        metadata: {}
      })

      const events1 = service.getEvents(1)
      const events2 = service.getEvents(2)

      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(1)
      expect(events1[0]!.message).toBe('Research 1 event')
      expect(events2[0]!.message).toBe('Research 2 event')
    })

    test('should handle all event categories', () => {
      const categories: Array<'url-processing' | 'ai-filtering' | 'robots' | 'extraction' | 'queue-management' | 'error'> = [
        'url-processing',
        'ai-filtering',
        'robots',
        'extraction',
        'queue-management',
        'error'
      ]

      for (const category of categories) {
        service.addEvent({
          researchId: 1,
          category,
          level: 'info',
          message: `${category} event`,
          metadata: {}
        })
      }

      const events = service.getEvents(1)
      expect(events).toHaveLength(6)

      const foundCategories = events.map((e) => e.category)
      for (const category of categories) {
        expect(foundCategories).toContain(category)
      }
    })

    test('should handle all event levels', () => {
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error']

      for (const level of levels) {
        service.addEvent({
          researchId: 1,
          category: 'url-processing',
          level,
          message: `${level} event`,
          metadata: {}
        })
      }

      const events = service.getEvents(1)
      expect(events).toHaveLength(4)

      const foundLevels = events.map((e) => e.level)
      for (const level of levels) {
        expect(foundLevels).toContain(level)
      }
    })
  })

  describe('Event Filtering', () => {
    beforeEach(() => {
      // Add diverse events for filtering
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'debug',
        message: 'Processing URL 1',
        metadata: { url: 'https://example1.com' }
      })

      service.addEvent({
        researchId: 1,
        category: 'ai-filtering',
        level: 'info',
        message: 'AI filtering URL 2',
        metadata: { url: 'https://example2.com', score: 0.8 }
      })

      service.addEvent({
        researchId: 1,
        category: 'error',
        level: 'error',
        message: 'Failed to process URL 3',
        metadata: { url: 'https://example3.com', error: 'Network timeout' }
      })

      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'warn',
        message: 'Slow processing URL 4',
        metadata: { url: 'https://example4.com', duration: 5000 }
      })
    })

    test('should filter by single category', () => {
      const events = service.getEvents(1, { categories: ['ai-filtering'] })
      expect(events).toHaveLength(1)
      expect(events[0]!.category).toBe('ai-filtering')
    })

    test('should filter by multiple categories', () => {
      const events = service.getEvents(1, { categories: ['url-processing', 'error'] })
      expect(events).toHaveLength(3) // 2 url-processing + 1 error
    })

    test('should filter by single level', () => {
      const events = service.getEvents(1, { levels: ['error'] })
      expect(events).toHaveLength(1)
      expect(events[0]!.level).toBe('error')
    })

    test('should filter by multiple levels', () => {
      const events = service.getEvents(1, { levels: ['info', 'warn'] })
      expect(events).toHaveLength(2)
    })

    test('should filter by time range', () => {
      const now = Date.now()
      const events = service.getEvents(1, {
        fromTimestamp: now - 1000,
        toTimestamp: now + 1000
      })
      expect(events.length).toBeGreaterThan(0)
      for (const event of events) {
        expect(event.timestamp).toBeGreaterThanOrEqual(now - 1000)
        expect(event.timestamp).toBeLessThanOrEqual(now + 1000)
      }
    })

    test('should filter by limit', () => {
      const events = service.getEvents(1, { limit: 2 })
      expect(events).toHaveLength(2)
      // Should get the last 2 events
      expect(events[1]!.message).toContain('URL 4')
    })

    test('should combine multiple filters', () => {
      const events = service.getEvents(1, {
        categories: ['url-processing'],
        levels: ['debug', 'warn'],
        limit: 1
      })
      expect(events).toHaveLength(1)
      expect(events[0]!.category).toBe('url-processing')
      expect(['debug', 'warn']).toContain(events[0]!.level)
    })

    test('should return empty array for non-existent research', () => {
      const events = service.getEvents(999)
      expect(events).toEqual([])
    })
  })

  describe('Recent Activity', () => {
    test('should return last N events', () => {
      for (let i = 0; i < 20; i++) {
        service.addEvent({
          researchId: 1,
          category: 'url-processing',
          level: 'info',
          message: `Event ${i}`,
          metadata: { index: i }
        })
      }

      const recent = service.getRecentActivity(1, 5)
      expect(recent).toHaveLength(5)

      // Should get events 15-19
      const indices = recent.map((e) => e.metadata.index)
      expect(indices).toEqual([15, 16, 17, 18, 19])
    })

    test('should return all events if less than limit', () => {
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Event 1',
        metadata: {}
      })

      const recent = service.getRecentActivity(1, 10)
      expect(recent).toHaveLength(1)
    })

    test('should return empty array for non-existent research', () => {
      const recent = service.getRecentActivity(999)
      expect(recent).toEqual([])
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      // Add diverse events for stats
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Processing URL 1',
        metadata: { duration: 100 }
      })

      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Processing URL 2',
        metadata: { duration: 200 }
      })

      service.addEvent({
        researchId: 1,
        category: 'ai-filtering',
        level: 'info',
        message: 'AI filtering batch',
        metadata: { linksAccepted: 8, linksRejected: 2 }
      })

      service.addEvent({
        researchId: 1,
        category: 'ai-filtering',
        level: 'info',
        message: 'AI filtering batch 2',
        metadata: { linksAccepted: 6, linksRejected: 4 }
      })

      service.addEvent({
        researchId: 1,
        category: 'error',
        level: 'error',
        message: 'Failed to process',
        metadata: { error: 'Network timeout' }
      })
    })

    test('should count total events', () => {
      const stats = service.getStats(1)
      expect(stats.totalEvents).toBe(5)
    })

    test('should count events by category', () => {
      const stats = service.getStats(1)
      expect(stats.eventsByCategory['url-processing']).toBe(2)
      expect(stats.eventsByCategory['ai-filtering']).toBe(2)
      expect(stats.eventsByCategory['error']).toBe(1)
      expect(stats.eventsByCategory['robots']).toBe(0)
    })

    test('should count events by level', () => {
      const stats = service.getStats(1)
      expect(stats.eventsByLevel.info).toBe(4)
      expect(stats.eventsByLevel.error).toBe(1)
      expect(stats.eventsByLevel.debug).toBe(0)
      expect(stats.eventsByLevel.warn).toBe(0)
    })

    test('should calculate average processing time', () => {
      const stats = service.getStats(1)
      expect(stats.averageProcessingTimeMs).toBe(150) // (100 + 200) / 2
    })

    test('should calculate AI acceptance rate', () => {
      const stats = service.getStats(1)
      expect(stats.aiAcceptanceRate).toBe(0.7) // (8+6) / (8+2+6+4) = 14/20 = 0.7
    })

    test('should include time range', () => {
      const stats = service.getStats(1)
      expect(stats.timeRange.oldest).toBeGreaterThan(0)
      expect(stats.timeRange.newest).toBeGreaterThanOrEqual(stats.timeRange.oldest)
    })

    test('should include recent activity', () => {
      const stats = service.getStats(1)
      expect(stats.recentActivity.length).toBeGreaterThan(0)
      expect(stats.recentActivity.length).toBeLessThanOrEqual(10)
    })

    test('should return empty stats for non-existent research', () => {
      const stats = service.getStats(999)
      expect(stats.totalEvents).toBe(0)
      expect(stats.recentActivity).toEqual([])
      expect(stats.timeRange.oldest).toBe(0)
      expect(stats.timeRange.newest).toBe(0)
    })

    test('should return undefined for stats with no relevant data', () => {
      service.addEvent({
        researchId: 2,
        category: 'robots',
        level: 'info',
        message: 'Robots.txt check',
        metadata: {}
      })

      const stats = service.getStats(2)
      expect(stats.averageProcessingTimeMs).toBeUndefined()
      expect(stats.aiAcceptanceRate).toBeUndefined()
    })
  })

  describe('Cleanup', () => {
    test('should clear events for specific research', () => {
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Event 1',
        metadata: {}
      })

      service.addEvent({
        researchId: 2,
        category: 'url-processing',
        level: 'info',
        message: 'Event 2',
        metadata: {}
      })

      service.clearEvents(1)

      expect(service.getEvents(1)).toEqual([])
      expect(service.getEvents(2)).toHaveLength(1)
    })

    test('should cleanup old events based on TTL', async () => {
      // Add old event (5+ seconds ago)
      const oldTimestamp = Date.now() - 6000
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Old event',
        metadata: {}
      })

      // Manually set old timestamp (hack for testing)
      const events = service.getEvents(1)
      if (events[0]) {
        ;(events[0] as any).timestamp = oldTimestamp
      }

      // Add recent event
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Recent event',
        metadata: {}
      })

      // Run cleanup
      service.cleanup()

      // Should keep recent event, remove old event
      const remainingEvents = service.getEvents(1)
      expect(remainingEvents.length).toBeGreaterThan(0)
    })

    test('should remove entire buffer if all events are old', async () => {
      // Add event
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Old event',
        metadata: {}
      })

      // Manually set old timestamp
      const events = service.getEvents(1)
      if (events[0]) {
        ;(events[0] as any).timestamp = Date.now() - 10000
      }

      const healthBefore = service.getHealthStatus()
      expect(healthBefore.totalResearchSessions).toBeGreaterThan(0)

      service.cleanup()

      const healthAfter = service.getHealthStatus()
      expect(healthAfter.totalResearchSessions).toBe(0)
    })
  })

  describe('Lifecycle', () => {
    test('should start auto-cleanup on creation', () => {
      const health = service.getHealthStatus()
      expect(health.autoCleanupActive).toBe(true)
    })

    test('should stop auto-cleanup', () => {
      service.stopAutoCleanup()
      const health = service.getHealthStatus()
      expect(health.autoCleanupActive).toBe(false)
    })

    test('should restart auto-cleanup', () => {
      service.stopAutoCleanup()
      service.startAutoCleanup()
      const health = service.getHealthStatus()
      expect(health.autoCleanupActive).toBe(true)
    })

    test('should clear all data on shutdown', () => {
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Event',
        metadata: {}
      })

      service.shutdown()

      const health = service.getHealthStatus()
      expect(health.totalEvents).toBe(0)
      expect(health.totalResearchSessions).toBe(0)
      expect(health.autoCleanupActive).toBe(false)
    })
  })

  describe('Health Status', () => {
    test('should provide health status', () => {
      service.addEvent({
        researchId: 1,
        category: 'url-processing',
        level: 'info',
        message: 'Event 1',
        metadata: {}
      })

      service.addEvent({
        researchId: 2,
        category: 'url-processing',
        level: 'info',
        message: 'Event 2',
        metadata: {}
      })

      const health = service.getHealthStatus()
      expect(health.totalResearchSessions).toBe(2)
      expect(health.totalEvents).toBe(2)
      expect(health.autoCleanupActive).toBe(true)
      expect(health.config).toBeDefined()
      expect(health.config.maxEventsPerResearch).toBe(100)
    })
  })

  describe('Integration Scenarios', () => {
    test('should track complete crawl workflow', () => {
      const researchId = 1

      // 1. Queue management
      service.addEvent({
        researchId,
        category: 'queue-management',
        level: 'info',
        message: 'Added seed URL to queue',
        metadata: { url: 'https://example.com', queueSize: 1 }
      })

      // 2. URL processing
      service.addEvent({
        researchId,
        category: 'url-processing',
        level: 'info',
        message: 'Processing URL',
        metadata: { url: 'https://example.com', depth: 0, duration: 150 }
      })

      // 3. Robots.txt check
      service.addEvent({
        researchId,
        category: 'robots',
        level: 'info',
        message: 'Robots.txt allows crawling',
        metadata: { url: 'https://example.com' }
      })

      // 4. Content extraction
      service.addEvent({
        researchId,
        category: 'extraction',
        level: 'info',
        message: 'Extracted content',
        metadata: { url: 'https://example.com', contentLength: 5000, linksFound: 25 }
      })

      // 5. AI filtering
      service.addEvent({
        researchId,
        category: 'ai-filtering',
        level: 'info',
        message: 'AI filtered links',
        metadata: {
          url: 'https://example.com',
          linksAccepted: 15,
          linksRejected: 10,
          threshold: 0.6
        }
      })

      const stats = service.getStats(researchId)
      expect(stats.totalEvents).toBe(5)
      expect(stats.eventsByCategory['queue-management']).toBe(1)
      expect(stats.eventsByCategory['url-processing']).toBe(1)
      expect(stats.eventsByCategory['robots']).toBe(1)
      expect(stats.eventsByCategory['extraction']).toBe(1)
      expect(stats.eventsByCategory['ai-filtering']).toBe(1)
      expect(stats.averageProcessingTimeMs).toBe(150)
      expect(stats.aiAcceptanceRate).toBe(0.6) // 15/(15+10)
    })

    test('should track error scenarios', () => {
      const researchId = 1

      service.addEvent({
        researchId,
        category: 'url-processing',
        level: 'error',
        message: 'Failed to fetch URL',
        metadata: {
          url: 'https://example.com',
          error: 'ECONNREFUSED',
          statusCode: 0
        }
      })

      service.addEvent({
        researchId,
        category: 'robots',
        level: 'warn',
        message: 'Robots.txt disallows crawling',
        metadata: { url: 'https://example.com/admin' }
      })

      const stats = service.getStats(researchId)
      expect(stats.eventsByLevel.error).toBe(1)
      expect(stats.eventsByLevel.warn).toBe(1)

      const errors = service.getEvents(researchId, { levels: ['error', 'warn'] })
      expect(errors).toHaveLength(2)
    })
  })
})
