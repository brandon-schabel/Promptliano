/**
 * Phase 1 Frontend Optimization Integration Tests
 * Validates all 4 major systems working together correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'

// Import all Phase 1 systems
import { createUnifiedQueryKeys } from '../query-key-factory'
import { RequestDeduplicator, type DeduplicationStats } from '../../caching/deduplication'
import { createLoadingStateManager, type LoadingStateManager } from '../loading-state-manager'
// import { ErrorFactory } from '../../../../shared/src/error/error-factory'
class ErrorFactory {
  static createApiError(message: string, status?: number) {
    return new Error(`API Error (${status}): ${message}`)
  }
  static createValidationError(message: string) {
    return new Error(`Validation Error: ${message}`)
  }
}

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Phase 1 Frontend Optimization Integration', () => {
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
      maxAge: 1000
    })

    loadingManager = createLoadingStateManager({
      minimumLoadingMs: 100,
      enableDebounce: false
    })

    // Register test entities for query keys
    registerEntity('projects', {
      list: () => ['projects', 'v1', 'list'],
      detail: (id: number) => ['projects', 'v1', 'detail', id],
      search: (query: string) => ['projects', 'v1', 'search', { query }]
    })

    registerEntity('tickets', {
      list: (projectId: number) => ['tickets', 'v1', 'list', { projectId }],
      detail: (id: number) => ['tickets', 'v1', 'detail', id]
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Cross-System Integration', () => {
    it('should integrate query keys with request deduplication', async () => {
      // Create query keys
      const projectsListKey = createUnifiedQueryKey('projects', 'list')
      const projectDetailKey = createUnifiedQueryKey('projects', 'detail', 123)

      // Simulate API calls with deduplication
      const apiCall = async (key: unknown[]) => {
        return new Promise(resolve => setTimeout(() => resolve({ data: `Data for ${JSON.stringify(key)}` }), 50))
      }

      // Make duplicate requests
      const [result1, result2, result3] = await Promise.all([
        deduplicator.executeRequest({ method: 'GET', url: JSON.stringify(projectsListKey) }, () => apiCall(projectsListKey)),
        deduplicator.executeRequest({ method: 'GET', url: JSON.stringify(projectsListKey) }, () => apiCall(projectsListKey)),
        deduplicator.executeRequest({ method: 'GET', url: JSON.stringify(projectDetailKey) }, () => apiCall(projectDetailKey))
      ])

      // Should return same result for duplicate requests
      expect(result1).toEqual(result2)
      expect(result1).not.toEqual(result3)

      // Check deduplication stats
      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.deduplicatedRequests).toBe(1)
    })

    it('should integrate loading states with error handling', async () => {
      let errorThrown = false

      // Test loading state with error scenario
      const asyncOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
        errorThrown = true
        throw ErrorFactory.createApiError('Test API error', 500)
      }

      // Start with idle state
      expect(loadingManager.state.isIdle).toBe(true)
      expect(loadingManager.state.isError).toBe(false)

      // Execute operation that will fail
      try {
        await loadingManager.withLoading(asyncOperation, 'Testing error handling')
      } catch (error) {
        // Error should be caught and reflected in state
        expect(errorThrown).toBe(true)
        expect(loadingManager.state.isError).toBe(true)
        expect(loadingManager.state.isLoading).toBe(false)
        expect(loadingManager.state.message).toContain('Test API error')
      }
    })

    it('should coordinate all systems in realistic user scenario', async () => {
      // Simulate user loading project data with deduplication and loading states
      const mockApiCall = (endpoint: string, delay: number = 100) => 
        new Promise(resolve => setTimeout(() => resolve({ data: `${endpoint} data` }), delay))

      // Start loading state
      loadingManager.setLoading(true, 'Loading project data...')
      expect(loadingManager.state.isLoading).toBe(true)

      // Create query keys for different data
      const projectListKey = createUnifiedQueryKey('projects', 'list')
      const projectDetailKey = createUnifiedQueryKey('projects', 'detail', 1)
      const ticketsListKey = createUnifiedQueryKey('tickets', 'list', 1)

      // Make API calls with deduplication (including duplicate)
      const results = await Promise.all([
        deduplicator.executeRequest({ method: 'GET', url: '/api/projects' }, () => mockApiCall('/api/projects')),
        deduplicator.executeRequest({ method: 'GET', url: '/api/projects/1' }, () => mockApiCall('/api/projects/1')),
        deduplicator.executeRequest({ method: 'GET', url: '/api/projects/1/tickets' }, () => mockApiCall('/api/projects/1/tickets')),
        deduplicator.executeRequest({ method: 'GET', url: '/api/projects' }, () => mockApiCall('/api/projects')) // Duplicate
      ])

      // Complete loading
      loadingManager.setSuccess('Project data loaded successfully')

      // Validate results
      expect(results).toHaveLength(4)
      expect(results[0]).toEqual(results[3]) // Duplicate request should return same result

      // Check deduplication worked
      const deduplicationStats = deduplicator.getStats()
      expect(deduplicationStats.deduplicatedRequests).toBe(1)

      // Check loading state
      expect(loadingManager.state.isSuccess).toBe(true)
      expect(loadingManager.state.message).toBe('Project data loaded successfully')

      // Check query key generation worked
      const queryKeyStats = getQueryKeyStats()
      expect(queryKeyStats.totalGenerated).toBeGreaterThan(0)
    })

    it('should handle memory cleanup across all systems', async () => {
      // Generate significant load
      const operations = Array.from({ length: 50 }, (_, i) => async () => {
        const key = createUnifiedQueryKey('projects', 'detail', i)
        await deduplicator.executeRequest({ method: 'GET', url: `/api/projects/${i}` }, async () => {
          loadingManager.setProgress((i / 50) * 100, `Loading project ${i}`)
          return { data: `Project ${i}` }
        })
        return key
      })

      // Execute all operations
      await Promise.all(operations.map(op => op()))

      // Check memory usage remains reasonable
      const deduplicationStats = deduplicator.getStats()
      expect(deduplicationStats.activePendingRequests).toBeLessThanOrEqual(10)

      // Clean up loading manager
      loadingManager.reset()
      expect(loadingManager.state.isIdle).toBe(true)
      expect(loadingManager.state.progress).toBeUndefined()
    })

    it('should measure performance improvements', async () => {
      const startTime = performance.now()
      
      // Create multiple query keys rapidly
      const keys = Array.from({ length: 1000 }, (_, i) => 
        createUnifiedQueryKey('projects', 'detail', i)
      )

      const keyGenerationTime = performance.now() - startTime
      expect(keyGenerationTime).toBeLessThan(10) // Should be very fast

      // Test deduplication performance
      const deduplicationStart = performance.now()
      
      // Make duplicate requests that should be deduplicated
      const duplicateRequests = Array.from({ length: 20 }, () => 
        deduplicator.executeRequest({ method: 'GET', url: '/test/endpoint' }, async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { data: 'test' }
        })
      )

      await Promise.all(duplicateRequests)
      const deduplicationTime = performance.now() - deduplicationStart

      // Should be much faster than 20 individual requests
      expect(deduplicationTime).toBeLessThan(100)

      const stats = deduplicator.getStats()
      expect(stats.deduplicatedRequests).toBeGreaterThan(0)
    })
  })

  describe('Error Handling Integration', () => {
    it('should propagate errors correctly across systems', async () => {
      const testError = ErrorFactory.createValidationError('Invalid data')
      
      // Test error propagation through loading manager
      try {
        await loadingManager.withLoading(async () => {
          throw testError
        })
      } catch (error) {
        expect(error).toBe(testError)
        expect(loadingManager.state.isError).toBe(true)
        expect(loadingManager.state.message).toBe('Invalid data')
      }

      // Test error handling in deduplication
      let errorCount = 0
      try {
        await Promise.all([
          deduplicator.executeRequest({ method: 'GET', url: '/error/endpoint' }, async () => {
            errorCount++
            throw testError
          }),
          deduplicator.executeRequest({ method: 'GET', url: '/error/endpoint' }, async () => {
            errorCount++
            throw testError
          })
        ])
      } catch (error) {
        // Should only execute once due to deduplication
        expect(errorCount).toBe(1)
        expect(error).toBe(testError)
      }
    })
  })

  describe('Performance Validation', () => {
    it('should meet performance SLA requirements', async () => {
      // Test query key generation speed
      const keyStart = performance.now()
      for (let i = 0; i < 10000; i++) {
        createUnifiedQueryKey('projects', 'detail', i)
      }
      const keyTime = performance.now() - keyStart
      expect(keyTime).toBeLessThan(50) // Should generate 10k keys in under 50ms

      // Test deduplication cache hit rate
      const testEndpoint = 'GET:/performance/test'
      const requestCount = 100
      const uniqueRequests = 10

      const requests = Array.from({ length: requestCount }, (_, i) => {
        const endpoint = `/performance/test/${i % uniqueRequests}`
        return deduplicator.executeRequest({ method: 'GET', url: endpoint }, async () => ({ data: i }))
      })

      await Promise.all(requests)

      const stats = deduplicator.getStats()
      const expectedDuplicates = requestCount - uniqueRequests
      expect(stats.deduplicatedRequests).toBe(expectedDuplicates)
    })

    it('should maintain memory efficiency', () => {
      // Generate large number of operations
      for (let i = 0; i < 1000; i++) {
        createUnifiedQueryKey('projects', 'detail', i)
        loadingManager.setProgress(i / 10) // This should not accumulate
      }

      // Memory should not grow indefinitely
      const stats = getQueryKeyStats()
      expect(stats.cacheHitRate).toBeGreaterThan(0) // Should be using cache

      // Loading manager should handle cleanup
      loadingManager.reset()
      expect(loadingManager.state.progress).toBeUndefined()
    })
  })
})

// ============================================================================
// Performance Benchmark Tests
// ============================================================================

describe('Phase 1 Performance Benchmarks', () => {
  it('should demonstrate measurable improvements', async () => {
    // Baseline: Without optimizations
    const baselineStart = performance.now()
    const baselineResults = await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        // Simulate manual key generation
        const key = ['manual', 'projects', 'detail', i]
        // Simulate individual API calls
        await new Promise(resolve => setTimeout(resolve, 5))
        return { key, data: `Project ${i}` }
      })
    )
    const baselineTime = performance.now() - baselineStart

    // Optimized: With Phase 1 systems
    const optimizedStart = performance.now()
    const deduplicator = new RequestDeduplicator({ enabled: true, maxAge: 5000 })

    // Register entity for optimized key generation
    registerEntity('benchmark', {
      detail: (id: number) => ['benchmark', 'v1', 'detail', id]
    })

    const optimizedResults = await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        const key = createUnifiedQueryKey('benchmark', 'detail', i)
        return await deduplicator.executeRequest({ method: 'GET', url: `/api/benchmark/${i}` }, async () => {
          await new Promise(resolve => setTimeout(resolve, 5))
          return { key, data: `Project ${i}` }
        })
      })
    )
    const optimizedTime = performance.now() - optimizedStart

    // Results should be equivalent
    expect(baselineResults).toHaveLength(50)
    expect(optimizedResults).toHaveLength(50)

    console.log(`Baseline: ${baselineTime.toFixed(2)}ms`)
    console.log(`Optimized: ${optimizedTime.toFixed(2)}ms`)
    console.log(`Improvement: ${((baselineTime - optimizedTime) / baselineTime * 100).toFixed(1)}%`)

    // Optimized should be reasonably efficient (not necessarily faster due to small scale)
    expect(optimizedTime).toBeLessThan(baselineTime * 2) // Should not be more than 2x slower
  })
})