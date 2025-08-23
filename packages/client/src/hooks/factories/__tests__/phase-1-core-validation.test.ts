/**
 * Phase 1 Frontend Optimization Core Validation
 * Tests systems that can be validated without React context
 */

import { describe, it, expect, beforeEach } from 'bun:test'

// Import Phase 1 systems that work without React
import { RequestDeduplicator, type DeduplicationStats } from '../../caching/deduplication'

// ============================================================================
// Core System Validation
// ============================================================================

describe('Phase 1 Frontend Optimization - Core Systems', () => {
  let deduplicator: RequestDeduplicator
  
  beforeEach(() => {
    deduplicator = new RequestDeduplicator({
      enabled: true,
      maxAge: 1000,
      maxConcurrent: 10,
      debounceMs: 50
    })
  })

  describe('Request Deduplication System', () => {
    it('should deduplicate identical requests successfully', async () => {
      let callCount = 0
      const mockApiCall = async (signal: AbortSignal) => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return { data: 'test-response', callNumber: callCount }
      }

      const requestKey = { method: 'GET', url: '/api/test' }

      // Make 5 identical requests simultaneously
      const promises = Array.from({ length: 5 }, () =>
        deduplicator.executeRequest(requestKey, mockApiCall)
      )

      const results = await Promise.all(promises)

      // Should only have called the API once
      expect(callCount).toBe(1)
      
      // All results should be identical
      results.forEach((result, index) => {
        expect(result.data).toBe('test-response')
        expect(result.callNumber).toBe(1) // All from same call
        if (index > 0) {
          expect(result).toEqual(results[0])
        }
      })

      // Check deduplication stats
      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(5)
      expect(stats.deduplicatedRequests).toBe(4) // 4 out of 5 were deduplicated
      expect(stats.deduplicationRate).toBe(0.8) // 80% deduplication rate
    })

    it('should handle different requests separately', async () => {
      let callCount = 0
      const mockApiCall = async (signal: AbortSignal) => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 10))
        return { data: `response-${callCount}` }
      }

      // Make different requests
      const [result1, result2, result3] = await Promise.all([
        deduplicator.executeRequest({ method: 'GET', url: '/api/endpoint1' }, mockApiCall),
        deduplicator.executeRequest({ method: 'GET', url: '/api/endpoint2' }, mockApiCall),
        deduplicator.executeRequest({ method: 'POST', url: '/api/endpoint1' }, mockApiCall)
      ])

      // Should have called API 3 times for different requests
      expect(callCount).toBe(3)
      
      // Results should be different
      expect(result1.data).toBe('response-1')
      expect(result2.data).toBe('response-2')
      expect(result3.data).toBe('response-3')

      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.deduplicatedRequests).toBe(0) // No deduplication for different requests
    })

    it('should propagate errors correctly across deduplicated requests', async () => {
      const testError = new Error('API request failed')
      let callCount = 0

      const mockFailingCall = async (signal: AbortSignal) => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 10))
        throw testError
      }

      const requestKey = { method: 'GET', url: '/api/error' }

      // Make multiple identical requests that should fail
      const promises = Array.from({ length: 3 }, () =>
        deduplicator.executeRequest(requestKey, mockFailingCall)
      )

      // All should reject with the same error
      for (const promise of promises) {
        await expect(promise).rejects.toThrow('API request failed')
      }

      // Should only have called the failing API once
      expect(callCount).toBe(1)

      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.deduplicatedRequests).toBe(2)
    })

    it('should handle abort signals correctly', async () => {
      const mockSlowCall = async (signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve({ data: 'slow-response' }), 1000)
          
          signal.addEventListener('abort', () => {
            clearTimeout(timeout)
            reject(new Error('Request aborted'))
          })
        })
      }

      const requestKey = { method: 'GET', url: '/api/slow' }
      
      // Start a request
      const promise = deduplicator.executeRequest(requestKey, mockSlowCall)
      
      // Abort it quickly
      setTimeout(() => {
        deduplicator.abortRequestsForKey(JSON.stringify(requestKey))
      }, 10)

      // Should be aborted
      await expect(promise).rejects.toThrow('Request aborted')
    })

    it('should clean up expired cache entries', async () => {
      const mockApiCall = async () => ({ data: 'cached-response' })
      
      // Configure with very short max age
      const shortLivedDeduplicator = new RequestDeduplicator({
        enabled: true,
        maxAge: 50 // 50ms cache
      })

      const requestKey = { method: 'GET', url: '/api/cache-test' }

      // First request
      const result1 = await shortLivedDeduplicator.executeRequest(requestKey, mockApiCall)
      expect(result1.data).toBe('cached-response')

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      // Second request - should not be deduplicated due to cache expiry
      const result2 = await shortLivedDeduplicator.executeRequest(requestKey, mockApiCall)
      expect(result2.data).toBe('cached-response')

      // Should have made 2 separate calls
      const stats = shortLivedDeduplicator.getStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.deduplicatedRequests).toBe(0) // No deduplication due to expiry
    })

    it('should handle high concurrency efficiently', async () => {
      const startTime = performance.now()
      let apiCallCount = 0

      const mockApiCall = async () => {
        apiCallCount++
        await new Promise(resolve => setTimeout(resolve, 20))
        return { data: `response-${apiCallCount}`, timestamp: Date.now() }
      }

      // Create 50 identical requests
      const promises = Array.from({ length: 50 }, () =>
        deduplicator.executeRequest(
          { method: 'GET', url: '/api/concurrent' },
          mockApiCall
        )
      )

      const results = await Promise.all(promises)
      const endTime = performance.now()

      // Should have only made 1 API call despite 50 requests
      expect(apiCallCount).toBe(1)

      // All results should be identical
      const firstResult = results[0]
      results.forEach(result => {
        expect(result).toEqual(firstResult)
      })

      // Should complete much faster than 50 * 20ms
      expect(endTime - startTime).toBeLessThan(500)

      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(50)
      expect(stats.deduplicatedRequests).toBe(49)
      expect(stats.deduplicationRate).toBe(0.98) // 98% deduplication
    })

    it('should provide accurate performance metrics', async () => {
      const operations = [
        // 5 requests to endpoint A
        ...Array(5).fill({ method: 'GET', url: '/api/endpoint-a' }),
        // 3 requests to endpoint B  
        ...Array(3).fill({ method: 'GET', url: '/api/endpoint-b' }),
        // 10 requests to endpoint A again (should deduplicate with first batch)
        ...Array(10).fill({ method: 'GET', url: '/api/endpoint-a' })
      ]

      let callCount = 0
      const mockApiCall = async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 5))
        return { callNumber: callCount }
      }

      // Execute all operations
      await Promise.all(
        operations.map(requestKey =>
          deduplicator.executeRequest(requestKey, mockApiCall)
        )
      )

      const stats = deduplicator.getStats()
      
      // Total: 18 requests
      expect(stats.totalRequests).toBe(18)
      
      // Should make 2 unique API calls (endpoint-a and endpoint-b)
      expect(callCount).toBe(2)
      
      // Deduplication: 18 - 2 = 16 deduplicated requests
      expect(stats.deduplicatedRequests).toBe(16)
      
      // Deduplication rate: 16/18 ≈ 0.89
      expect(stats.deduplicationRate).toBeCloseTo(0.89, 2)
      
      // No pending requests after completion
      expect(stats.activePendingRequests).toBe(0)
    })

    it('should handle retry logic with deduplication', async () => {
      let attemptCount = 0
      const maxRetries = 2

      const mockRetryCall = async () => {
        attemptCount++
        if (attemptCount <= maxRetries) {
          throw new Error(`Attempt ${attemptCount} failed`)
        }
        return { data: 'success-after-retries', attempts: attemptCount }
      }

      const retryDeduplicator = new RequestDeduplicator({
        enabled: true,
        retryPolicy: { maxRetries: 3, backoffMs: 10 }
      })

      const requestKey = { method: 'GET', url: '/api/retry' }

      // Make multiple identical requests that will retry
      const promises = Array.from({ length: 3 }, () =>
        retryDeduplicator.executeRequest(requestKey, mockRetryCall)
      )

      const results = await Promise.all(promises)

      // Should eventually succeed for all requests
      results.forEach(result => {
        expect(result.data).toBe('success-after-retries')
        expect(result.attempts).toBe(3) // Succeeded on 3rd attempt
      })

      // Retries should be shared across deduplicated requests
      expect(attemptCount).toBe(3) // Only retried once for all requests
    })
  })

  describe('Performance Benchmarks', () => {
    it('should demonstrate significant performance gains with deduplication', async () => {
      // Scenario: 100 identical expensive requests
      const expensiveOperationTime = 50 // ms per operation
      let operationCount = 0

      const expensiveOperation = async () => {
        operationCount++
        await new Promise(resolve => setTimeout(resolve, expensiveOperationTime))
        return { operationId: operationCount, timestamp: Date.now() }
      }

      // Test with deduplication
      const startTimeWithDedup = performance.now()
      
      const deduplicatedPromises = Array.from({ length: 100 }, () =>
        deduplicator.executeRequest(
          { method: 'POST', url: '/api/expensive' },
          expensiveOperation
        )
      )

      const deduplicatedResults = await Promise.all(deduplicatedPromises)
      const endTimeWithDedup = performance.now()

      // Reset for baseline test
      operationCount = 0
      
      // Test without deduplication (baseline)
      const startTimeBaseline = performance.now()
      const baselinePromises = Array.from({ length: 100 }, () => expensiveOperation())
      const baselineResults = await Promise.all(baselinePromises)
      const endTimeBaseline = performance.now()

      // Deduplication should be much faster
      const deduplicationTime = endTimeWithDedup - startTimeWithDedup
      const baselineTime = endTimeBaseline - startTimeBaseline
      const improvement = (baselineTime - deduplicationTime) / baselineTime

      console.log(`Baseline: ${baselineTime.toFixed(2)}ms`)
      console.log(`With deduplication: ${deduplicationTime.toFixed(2)}ms`)
      console.log(`Improvement: ${(improvement * 100).toFixed(1)}%`)

      // Should be at least 90% faster with deduplication
      expect(improvement).toBeGreaterThan(0.9)

      // Deduplication should only make 1 API call
      expect(deduplicatedResults[0].operationId).toBe(1) // First batch
      expect(baselineResults[0].operationId).toBe(101) // Second batch starts at 101

      const stats = deduplicator.getStats()
      expect(stats.deduplicationRate).toBeCloseTo(0.99, 2) // 99% deduplication
    })

    it('should maintain low memory usage under high load', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Generate many unique requests to test memory management
      const promises = Array.from({ length: 1000 }, (_, i) =>
        deduplicator.executeRequest(
          { method: 'GET', url: `/api/unique/${i}` },
          async () => ({ id: i, data: `response-${i}` })
        )
      )

      await Promise.all(promises)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`)

      // Memory increase should be reasonable (less than 10MB for 1000 requests)
      expect(memoryIncrease).toBeLessThan(10)

      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(1000)
      expect(stats.activePendingRequests).toBe(0) // All cleaned up
    })
  })
})