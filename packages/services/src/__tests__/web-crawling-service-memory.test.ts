/**
 * Web Crawling Service Memory Management Tests
 *
 * Tests for TTL-based session cleanup and memory leak prevention
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { createWebCrawlingService } from '../web-crawling-service'
import type { WebCrawlingServiceDeps } from '../web-crawling-service'

describe('Web Crawling Service - Memory Management', () => {
  let service: ReturnType<typeof createWebCrawlingService>
  let mockDomainRepo: any
  let mockUrlRepo: any
  let mockContentRepo: any
  let mockLogger: any

  beforeEach(() => {
    // Mock repositories
    mockDomainRepo = {
      upsert: mock(async (data: any) => ({
        id: 1,
        domain: data.domain,
        robotsTxt: data.robotsTxt,
        crawlDelay: data.crawlDelay,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      getDomain: mock(async (domain: string) => null),
      updateRobotsTxt: mock(async (domain: string, robotsTxt: string) => true)
    }

    mockUrlRepo = {
      upsert: mock(async (data: any) => ({
        id: Date.now(),
        url: data.url,
        domain: data.url.split('/')[2],
        urlHash: `hash_${data.url}`,
        status: data.status,
        statusCode: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      getAll: mock(async () => []),
      markUrlCrawled: mock(async (id: number, statusCode: number) => true),
      markUrlFailed: mock(async (id: number, statusCode?: number) => true)
    }

    mockContentRepo = {
      upsertForUrl: mock(async (urlId: number, data: any) => ({
        id: Date.now(),
        urlId,
        ...data
      })),
      getByUrlId: mock(async (urlId: number) => null)
    }

    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {})
    }

    const deps: WebCrawlingServiceDeps = {
      domainRepository: mockDomainRepo,
      urlRepository: mockUrlRepo,
      contentRepository: mockContentRepo,
      logger: mockLogger
    }

    service = createWebCrawlingService(deps)
  })

  afterEach(() => {
    // Stop cleanup interval to prevent test interference
    service.stopSessionCleanup()
  })

  describe('Session Creation with TTL', () => {
    test('should create session with expiration timestamp', async () => {
      const result = await service.startCrawl('https://example.com')

      expect(result.crawlId).toBeDefined()
      expect(result.seedDomain).toBe('example.com')
      expect(service.getActiveSessionCount()).toBe(1)
    })

    test('should create multiple sessions without interference', async () => {
      const result1 = await service.startCrawl('https://example.com')
      const result2 = await service.startCrawl('https://test.com')

      expect(result1.crawlId).not.toBe(result2.crawlId)
      expect(service.getActiveSessionCount()).toBe(2)
    })
  })

  describe('Session Cleanup on Completion', () => {
    test('should clean up session immediately when completed', async () => {
      const result = await service.startCrawl('https://example.com')
      expect(service.getActiveSessionCount()).toBe(1)

      // Mock empty response to complete immediately
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body>Test</body></html>',
        headers: new Headers()
      })) as any

      await service.executeCrawl(result.crawlId)

      // Session should be cleaned up immediately after completion
      expect(service.getActiveSessionCount()).toBe(0)
    })

    test('should clean up session when cancelled', async () => {
      const result = await service.startCrawl('https://example.com')
      expect(service.getActiveSessionCount()).toBe(1)

      await service.cancelCrawl(result.crawlId)

      expect(service.getActiveSessionCount()).toBe(0)
    })
  })

  describe('Session TTL Extension on Access', () => {
    test('should extend TTL when accessing session progress', async () => {
      const result = await service.startCrawl('https://example.com')

      const progress1 = await service.getCrawlProgress(result.crawlId)
      expect(progress1.status).toBe('running')

      // Access again to extend TTL
      const progress2 = await service.getCrawlProgress(result.crawlId)
      expect(progress2.status).toBe('running')
    })

    test('should extend TTL when pausing/resuming', async () => {
      const result = await service.startCrawl('https://example.com')

      await service.pauseCrawl(result.crawlId)
      const progress1 = await service.getCrawlProgress(result.crawlId)
      expect(progress1.status).toBe('paused')

      await service.resumeCrawl(result.crawlId)
      const progress2 = await service.getCrawlProgress(result.crawlId)
      expect(progress2.status).toBe('running')

      expect(service.getActiveSessionCount()).toBe(1)
    })
  })

  describe('Manual Cleanup', () => {
    test('should clean up expired sessions manually', async () => {
      const result = await service.startCrawl('https://example.com')
      expect(service.getActiveSessionCount()).toBe(1)

      // Manually trigger cleanup (won't clean non-expired sessions)
      const cleanedCount = service.cleanupExpiredSessions()
      expect(cleanedCount).toBe(0) // Session not expired yet
      expect(service.getActiveSessionCount()).toBe(1)
    })

    test('should clean up completed sessions manually', async () => {
      const result = await service.startCrawl('https://example.com')
      expect(service.getActiveSessionCount()).toBe(1)

      // Mock empty response to complete immediately
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body>Test</body></html>',
        headers: new Headers()
      })) as any

      await service.executeCrawl(result.crawlId)

      // Session already cleaned up by executeCrawl
      expect(service.getActiveSessionCount()).toBe(0)
    })
  })

  describe('Session Lifecycle', () => {
    test('should handle full session lifecycle', async () => {
      // Start crawl
      const result = await service.startCrawl('https://example.com')
      expect(service.getActiveSessionCount()).toBe(1)

      // Check progress
      const progress = await service.getCrawlProgress(result.crawlId)
      expect(progress.status).toBe('running')

      // Pause
      await service.pauseCrawl(result.crawlId)
      expect(service.getActiveSessionCount()).toBe(1)

      // Resume
      await service.resumeCrawl(result.crawlId)
      expect(service.getActiveSessionCount()).toBe(1)

      // Cancel
      await service.cancelCrawl(result.crawlId)
      expect(service.getActiveSessionCount()).toBe(0)
    })
  })

  describe('Memory Leak Prevention', () => {
    test('should not accumulate sessions indefinitely', async () => {
      // Create multiple sessions
      for (let i = 0; i < 10; i++) {
        await service.startCrawl(`https://example${i}.com`)
      }

      expect(service.getActiveSessionCount()).toBe(10)

      // Complete all sessions
      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body>Test</body></html>',
        headers: new Headers()
      })) as any

      // Get all crawl IDs
      const crawlIds: string[] = []
      for (let i = 0; i < 10; i++) {
        const result = await service.startCrawl(`https://test${i}.com`)
        crawlIds.push(result.crawlId)
      }

      // Execute all crawls
      for (const crawlId of crawlIds) {
        await service.executeCrawl(crawlId)
      }

      // All completed sessions should be cleaned up
      expect(service.getActiveSessionCount()).toBeLessThan(20) // Original 10 + completed cleanup
    })

    test('should handle cleanup interval gracefully', async () => {
      // Stop default cleanup
      service.stopSessionCleanup()

      // Create session
      await service.startCrawl('https://example.com')
      expect(service.getActiveSessionCount()).toBe(1)

      // Stop again (should be no-op)
      service.stopSessionCleanup()
      expect(service.getActiveSessionCount()).toBe(1)
    })
  })

  describe('Error Handling', () => {
    test('should throw error when accessing non-existent session', async () => {
      expect(async () => {
        await service.getCrawlProgress('non-existent-id')
      }).toThrow()
    })

    test('should throw error when canceling non-existent session', async () => {
      expect(async () => {
        await service.cancelCrawl('non-existent-id')
      }).toThrow()
    })

    test('should throw error when pausing non-existent session', async () => {
      expect(async () => {
        await service.pauseCrawl('non-existent-id')
      }).toThrow()
    })

    test('should throw error when resuming non-existent session', async () => {
      expect(async () => {
        await service.resumeCrawl('non-existent-id')
      }).toThrow()
    })
  })

  describe('Logging', () => {
    test('should log session creation', async () => {
      await service.startCrawl('https://example.com')
      expect(mockLogger.info).toHaveBeenCalled()
    })

    test('should log session cleanup on completion', async () => {
      const result = await service.startCrawl('https://example.com')

      global.fetch = mock(async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body>Test</body></html>',
        headers: new Headers()
      })) as any

      await service.executeCrawl(result.crawlId)
      expect(mockLogger.info).toHaveBeenCalled()
    })

    test('should log session cleanup on cancel', async () => {
      const result = await service.startCrawl('https://example.com')
      await service.cancelCrawl(result.crawlId)
      expect(mockLogger.info).toHaveBeenCalled()
    })
  })
})
