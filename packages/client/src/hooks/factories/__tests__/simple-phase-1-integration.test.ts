/**
 * Simple Phase 1 Frontend Optimization Integration Test
 * Validates core Phase 1 systems working correctly
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'

// Import Phase 1 systems that we can actually use
import { RequestDeduplicator, type DeduplicationStats } from '../../caching/deduplication'
import { createLoadingStateManager, type LoadingStateManager } from '../loading-state-manager'

// Simple error factory for testing
class TestErrorFactory {
  static createApiError(message: string, status?: number) {
    return new Error(`API Error (${status}): ${message}`)
  }
  static createValidationError(message: string) {
    return new Error(`Validation Error: ${message}`)
  }
}

// ============================================================================
// Phase 1 Integration Test Suite
// ============================================================================

describe('Phase 1 Frontend Optimization - Core Systems', () => {
  let queryClient: QueryClient
  let deduplicator: RequestDeduplicator
  let loadingManager: LoadingStateManager
  
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false }
      }
    })

    deduplicator = new RequestDeduplicator({
      enabled: true,
      maxAge: 1000,
      maxConcurrent: 10
    })

    loadingManager = createLoadingStateManager({
      minimumLoadingMs: 50,
      enableDebounce: false
    })
  })

  describe('Request Deduplication System', () => {
    it('should deduplicate identical requests', async () => {
      const mockApiCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { data: 'test-response' }
      }

      const requestKey = { method: 'GET', url: '/api/test' }

      // Make multiple identical requests simultaneously
      const [result1, result2, result3] = await Promise.all([
        deduplicator.executeRequest(requestKey, mockApiCall),
        deduplicator.executeRequest(requestKey, mockApiCall),
        deduplicator.executeRequest(requestKey, mockApiCall)
      ])

      // All should return the same result
      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)
      expect(result1.data).toBe('test-response')

      // Check deduplication stats
      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.deduplicatedRequests).toBe(2) // 2 requests were deduplicated
    })

    it('should handle errors correctly', async () => {
      const testError = new Error('API request failed')
      const mockFailingCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw testError
      }

      const requestKey = { method: 'GET', url: '/api/error' }

      // All requests should fail with the same error
      const promises = [
        deduplicator.executeRequest(requestKey, mockFailingCall),
        deduplicator.executeRequest(requestKey, mockFailingCall),
        deduplicator.executeRequest(requestKey, mockFailingCall)
      ]

      for (const promise of promises) {
        await expect(promise).rejects.toThrow('API request failed')
      }

      // Should still track the requests
      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(3)
    })

    it('should provide accurate performance metrics', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        method: 'GET' as const,
        url: `/api/item/${i % 3}` // Only 3 unique URLs, so should deduplicate
      }))

      await Promise.all(
        requests.map(requestKey =>
          deduplicator.executeRequest(requestKey, async () => ({ id: requestKey.url }))
        )
      )

      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(10)
      expect(stats.deduplicatedRequests).toBe(7) // 7 requests deduplicated (10 - 3 unique)
      expect(stats.deduplicationRate).toBeCloseTo(0.7, 1) // 70% deduplication rate
    })
  })

  describe('Loading State Manager', () => {
    it('should manage loading states correctly', async () => {
      // Start idle
      expect(loadingManager.state.isIdle).toBe(true)
      expect(loadingManager.state.isLoading).toBe(false)

      // Set loading
      loadingManager.setLoading(true, 'Loading data...')
      expect(loadingManager.state.isLoading).toBe(true)
      expect(loadingManager.state.isIdle).toBe(false)
      expect(loadingManager.state.message).toBe('Loading data...')

      // Set progress
      loadingManager.setProgress(50, 'Halfway done...')
      expect(loadingManager.state.progress).toBe(50)
      expect(loadingManager.state.message).toBe('Halfway done...')

      // Set success
      loadingManager.setSuccess('Completed successfully!')
      expect(loadingManager.state.isSuccess).toBe(true)
      expect(loadingManager.state.isLoading).toBe(false)
      expect(loadingManager.state.message).toBe('Completed successfully!')
    })

    it('should handle errors in loading states', async () => {
      const testError = TestErrorFactory.createApiError('Something went wrong', 500)

      try {
        await loadingManager.withLoading(async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
          throw testError
        }, 'Processing...')
      } catch (error) {
        expect(error).toBe(testError)
      }

      expect(loadingManager.state.isError).toBe(true)
      expect(loadingManager.state.isLoading).toBe(false)
      expect(loadingManager.state.message).toContain('Something went wrong')
    })

    it('should manage async operations with progress', async () => {
      const operationPromise = loadingManager.withLoading(async () => {
        loadingManager.setProgress(25, 'Step 1...')
        await new Promise(resolve => setTimeout(resolve, 10))
        
        loadingManager.setProgress(75, 'Step 2...')
        await new Promise(resolve => setTimeout(resolve, 10))
        
        return { result: 'success' }
      }, 'Starting operation...')

      const result = await operationPromise

      expect(result.result).toBe('success')
      expect(loadingManager.state.isSuccess).toBe(true)
    })
  })

  describe('Cross-System Integration', () => {
    it('should coordinate deduplication with loading states', async () => {
      const mockApiCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { data: 'coordinated-response' }
      }

      // Start loading state
      loadingManager.setLoading(true, 'Fetching data...')

      // Make deduplicated requests
      const requests = Array.from({ length: 5 }, () =>
        deduplicator.executeRequest(
          { method: 'GET', url: '/api/coordinate' },
          mockApiCall
        )
      )

      const results = await Promise.all(requests)

      // Complete loading
      loadingManager.setSuccess('Data fetched successfully')

      // All results should be identical
      expect(results.every(result => result.data === 'coordinated-response')).toBe(true)

      // Check systems worked together
      const deduplicationStats = deduplicator.getStats()
      expect(deduplicationStats.deduplicatedRequests).toBe(4) // 4 out of 5 deduplicated
      expect(loadingManager.state.isSuccess).toBe(true)
    })

    it('should handle concurrent operations efficiently', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        url: `/api/operation/${i % 5}` // Only 5 unique operations
      }))

      loadingManager.setLoading(true, 'Processing batch operations...')

      const startTime = performance.now()

      const results = await Promise.all(
        operations.map(op =>
          deduplicator.executeRequest(
            { method: 'POST', url: op.url },
            async () => {
              await new Promise(resolve => setTimeout(resolve, 10))
              return { operationId: op.id, url: op.url }
            }
          )
        )
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime

      loadingManager.setSuccess(`Completed ${operations.length} operations`)

      // Should complete much faster than 20 * 10ms due to deduplication
      expect(totalTime).toBeLessThan(200) // Should be much less than 200ms

      // Should have deduplicated most requests
      const stats = deduplicator.getStats()
      expect(stats.deduplicationRate).toBeGreaterThan(0.5) // At least 50% deduplication

      expect(results).toHaveLength(20)
      expect(loadingManager.state.isSuccess).toBe(true)
    })

    it('should maintain performance under load', async () => {
      const loadTest = async () => {
        const promises = Array.from({ length: 100 }, (_, i) => {
          const requestKey = { method: 'GET', url: `/api/load/${i % 10}` }
          
          return deduplicator.executeRequest(requestKey, async () => {
            loadingManager.setProgress((i / 100) * 100, `Processing ${i}/100`)
            return { index: i, timestamp: Date.now() }
          })
        })

        return Promise.all(promises)
      }

      const startTime = performance.now()
      const results = await loadTest()
      const endTime = performance.now()

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // Under 1 second

      // Should have many deduplicated requests
      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(100)
      expect(stats.deduplicationRate).toBeGreaterThan(0.8) // 80%+ deduplication

      expect(results).toHaveLength(100)
    })
  })

  describe('Memory Management', () => {
    it('should clean up resources properly', async () => {
      // Generate many requests to test cleanup
      const promises = Array.from({ length: 50 }, (_, i) => 
        deduplicator.executeRequest(
          { method: 'GET', url: `/api/cleanup/${i}` },
          async () => ({ id: i })
        )
      )

      await Promise.all(promises)

      // Stats should be reasonable
      const stats = deduplicator.getStats()
      expect(stats.activePendingRequests).toBe(0) // No pending requests
      expect(stats.totalRequests).toBe(50)

      // Loading manager should be able to reset
      loadingManager.reset()
      expect(loadingManager.state.isIdle).toBe(true)
      expect(loadingManager.state.progress).toBeUndefined()
      expect(loadingManager.state.message).toBeUndefined()
    })
  })
})

// ============================================================================
// Performance Validation
// ============================================================================

describe('Phase 1 Performance Validation', () => {
  it('should demonstrate measurable performance improvements', async () => {
    const deduplicator = new RequestDeduplicator({ enabled: true })
    
    // Test with high duplication scenario
    const startTime = performance.now()
    
    const duplicatedRequests = Array.from({ length: 100 }, () =>
      deduplicator.executeRequest(
        { method: 'GET', url: '/api/performance/test' }, // Same URL for all
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1))
          return { data: 'performance-test' }
        }
      )
    )

    await Promise.all(duplicatedRequests)
    const endTime = performance.now()

    // Should complete much faster than 100ms (100 * 1ms)
    expect(endTime - startTime).toBeLessThan(50)

    // Should achieve near 99% deduplication rate
    const stats = deduplicator.getStats()
    expect(stats.totalRequests).toBe(100)
    expect(stats.deduplicatedRequests).toBe(99) // 99 out of 100 deduplicated
    expect(stats.deduplicationRate).toBeCloseTo(0.99, 2)
  })
})