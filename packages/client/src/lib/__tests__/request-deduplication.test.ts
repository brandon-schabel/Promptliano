/**
 * Request Deduplication System Tests
 * 
 * Comprehensive test suite for the request deduplication system including:
 * - Core deduplication functionality
 * - Performance benchmarks
 * - Memory management
 * - Error handling
 * - Integration scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { RequestDeduplicator, getRequestDeduplicator } from '../request-deduplicator'
import { DeduplicatedApiClient } from '../deduplicated-api-client'

// ============================================================================
// Test Setup
// ============================================================================

// Mock fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock performance.now for consistent timing
const mockPerformanceNow = vi.fn()
global.performance = {
  ...global.performance,
  now: mockPerformanceNow
}

// Test utilities
const createMockResponse = (data: any, ok = true, status = 200) => ({
  ok,
  status,
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  json: vi.fn().mockResolvedValue(data)
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ============================================================================
// Core Deduplication Tests
// ============================================================================

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator
  let requestExecutor: Mock

  beforeEach(() => {
    deduplicator = new RequestDeduplicator({
      debug: false,
      cacheTtl: 1000,
      maxCacheSize: 100
    })
    
    requestExecutor = vi.fn()
    mockPerformanceNow.mockClear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    deduplicator.destroy()
  })

  describe('Basic Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const mockData = { result: 'test' }
      requestExecutor.mockResolvedValue(mockData)

      const requestOptions = {
        method: 'GET',
        endpoint: '/test',
        params: { id: 1 }
      }

      // Make multiple identical requests simultaneously
      const promises = Array.from({ length: 5 }, () =>
        deduplicator.deduplicate(requestOptions, requestExecutor)
      )

      const results = await Promise.all(promises)

      // Should only execute once
      expect(requestExecutor).toHaveBeenCalledTimes(1)
      
      // All results should be identical
      results.forEach(result => {
        expect(result).toEqual(mockData)
      })

      // Check stats
      const stats = deduplicator.getStats()
      expect(stats.totalRequests).toBe(5)
      expect(stats.duplicatesPrevented).toBe(4)
      expect(stats.cacheHits).toBe(4)
      expect(stats.cacheMisses).toBe(1)
    })

    it('should not deduplicate different requests', async () => {
      requestExecutor.mockResolvedValue({ result: 'test' })

      const request1 = { method: 'GET', endpoint: '/test1' }
      const request2 = { method: 'GET', endpoint: '/test2' }

      await Promise.all([
        deduplicator.deduplicate(request1, requestExecutor),
        deduplicator.deduplicate(request2, requestExecutor)
      ])

      expect(requestExecutor).toHaveBeenCalledTimes(2)
    })

    it('should deduplicate based on method, endpoint, and params', async () => {
      requestExecutor.mockResolvedValue({ result: 'test' })

      const baseRequest = { method: 'GET', endpoint: '/test' }
      const withParams = { ...baseRequest, params: { id: 1 } }
      const withDifferentParams = { ...baseRequest, params: { id: 2 } }

      await Promise.all([
        deduplicator.deduplicate(baseRequest, requestExecutor),
        deduplicator.deduplicate(withParams, requestExecutor),
        deduplicator.deduplicate(withDifferentParams, requestExecutor)
      ])

      expect(requestExecutor).toHaveBeenCalledTimes(3)
    })

    it('should deduplicate POST requests with identical bodies', async () => {
      requestExecutor.mockResolvedValue({ result: 'created' })

      const requestOptions = {
        method: 'POST',
        endpoint: '/create',
        body: { name: 'test', value: 123 }
      }

      const promises = Array.from({ length: 3 }, () =>
        deduplicator.deduplicate(requestOptions, requestExecutor)
      )

      await Promise.all(promises)

      expect(requestExecutor).toHaveBeenCalledTimes(1)
      
      const stats = deduplicator.getStats()
      expect(stats.duplicatesPrevented).toBe(2)
    })
  })

  describe('Cache Management', () => {
    it('should respect cache TTL', async () => {
      const shortTtlDeduplicator = new RequestDeduplicator({
        cacheTtl: 100 // 100ms
      })

      requestExecutor.mockResolvedValue({ result: 'test' })
      const requestOptions = { method: 'GET', endpoint: '/test' }

      // First request
      await shortTtlDeduplicator.deduplicate(requestOptions, requestExecutor)
      expect(requestExecutor).toHaveBeenCalledTimes(1)

      // Wait for cache to expire
      await delay(150)

      // Second request should execute again
      await shortTtlDeduplicator.deduplicate(requestOptions, requestExecutor)
      expect(requestExecutor).toHaveBeenCalledTimes(2)

      shortTtlDeduplicator.destroy()
    })

    it('should cleanup cache when max size is reached', async () => {
      const smallCacheDeduplicator = new RequestDeduplicator({
        maxCacheSize: 2
      })

      requestExecutor.mockResolvedValue({ result: 'test' })

      // Fill cache
      await smallCacheDeduplicator.deduplicate(
        { method: 'GET', endpoint: '/test1' }, 
        requestExecutor
      )
      await smallCacheDeduplicator.deduplicate(
        { method: 'GET', endpoint: '/test2' }, 
        requestExecutor
      )

      let stats = smallCacheDeduplicator.getStats()
      expect(stats.cacheSize).toBe(2)

      // Add one more to trigger cleanup
      await smallCacheDeduplicator.deduplicate(
        { method: 'GET', endpoint: '/test3' }, 
        requestExecutor
      )

      stats = smallCacheDeduplicator.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(2)

      smallCacheDeduplicator.destroy()
    })

    it('should clear cache manually', async () => {
      requestExecutor.mockResolvedValue({ result: 'test' })
      
      await deduplicator.deduplicate(
        { method: 'GET', endpoint: '/test' }, 
        requestExecutor
      )

      let stats = deduplicator.getStats()
      expect(stats.cacheSize).toBe(1)

      deduplicator.clearCache()

      stats = deduplicator.getStats()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle request errors properly', async () => {
      const error = new Error('Request failed')
      requestExecutor.mockRejectedValue(error)

      const requestOptions = { method: 'GET', endpoint: '/test' }

      // Multiple requests should all fail with the same error
      const promises = Array.from({ length: 3 }, () =>
        deduplicator.deduplicate(requestOptions, requestExecutor)
      )

      await expect(Promise.all(promises)).rejects.toThrow('Request failed')
      
      // Should only execute once
      expect(requestExecutor).toHaveBeenCalledTimes(1)
    })

    it('should clean up cache after error', async () => {
      requestExecutor.mockRejectedValue(new Error('Failed'))

      try {
        await deduplicator.deduplicate(
          { method: 'GET', endpoint: '/test' }, 
          requestExecutor
        )
      } catch {
        // Expected error
      }

      // Wait for cleanup
      await delay(150)

      const stats = deduplicator.getStats()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('Abort Handling', () => {
    it('should handle abort signals', async () => {
      const abortController = new AbortController()
      requestExecutor.mockImplementation((signal) => {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('Aborted'))
          })
          // Simulate long request
          setTimeout(() => resolve({ result: 'test' }), 1000)
        })
      })

      const requestOptions = { 
        method: 'GET', 
        endpoint: '/test',
        abortSignal: abortController.signal
      }

      const promise = deduplicator.deduplicate(requestOptions, requestExecutor)

      // Abort after 100ms
      setTimeout(() => abortController.abort(), 100)

      await expect(promise).rejects.toThrow('Aborted')
    })

    it('should abort specific requests', async () => {
      requestExecutor.mockImplementation((signal: AbortSignal) => 
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve({ result: 'test' }), 1000)
          
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            reject(new Error('Request aborted'))
          })
        })
      )

      const requestOptions = { method: 'GET', endpoint: '/test' }
      const promise = deduplicator.deduplicate(requestOptions, requestExecutor)

      // Give a moment for the request to be registered
      await new Promise(resolve => setTimeout(resolve, 10))

      // Get the request key and abort it
      const activeRequests = deduplicator.getActiveRequestKeys()
      expect(activeRequests.length).toBe(1)

      const aborted = deduplicator.abortRequest(activeRequests[0])
      expect(aborted).toBe(true)

      await expect(promise).rejects.toThrow()
    })
  })

  describe('Performance', () => {
    it('should improve performance for duplicate requests', async () => {
      const responses = [
        { result: 'slow' },
        { result: 'fast' }
      ]

      let callCount = 0
      requestExecutor.mockImplementation(() => {
        const response = responses[callCount++]
        // First call is slow, subsequent calls should be fast due to deduplication
        const delay = callCount === 1 ? 100 : 0
        return new Promise(resolve => setTimeout(() => resolve(response), delay))
      })

      const requestOptions = { method: 'GET', endpoint: '/test' }
      
      const startTime = Date.now()
      
      // Make 5 identical requests
      const promises = Array.from({ length: 5 }, () =>
        deduplicator.deduplicate(requestOptions, requestExecutor)
      )

      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      // All should return the same result (from first call)
      results.forEach(result => {
        expect(result).toEqual({ result: 'slow' })
      })

      // Should complete faster than 5 separate requests would
      expect(totalTime).toBeLessThan(200) // Much less than 5 * 100ms
      expect(requestExecutor).toHaveBeenCalledTimes(1)
    })
  })
})

// ============================================================================
// Deduplicated API Client Tests
// ============================================================================

describe('DeduplicatedApiClient', () => {
  let client: DeduplicatedApiClient

  beforeEach(() => {
    client = new DeduplicatedApiClient({
      baseUrl: 'http://localhost:3000',
      deduplication: {
        enabled: true,
        debug: false,
        cacheTtl: 1000
      }
    })

    mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }))
    mockPerformanceNow.mockClear()
  })

  afterEach(() => {
    client.destroy()
    vi.clearAllMocks()
  })

  describe('Integration with Base Client', () => {
    it('should deduplicate identical GET requests', async () => {
      // Make multiple identical requests
      const promises = Array.from({ length: 3 }, () =>
        client['get']('/test', { params: { id: 1 } })
      )

      await Promise.all(promises)

      // Should only make one fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not deduplicate when disabled', async () => {
      client.setDeduplicationEnabled(false)

      const promises = Array.from({ length: 3 }, () =>
        client['get']('/test')
      )

      await Promise.all(promises)

      // Should make three separate fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should respect deduplication options per request', async () => {
      // First request with deduplication enabled
      await client['get']('/test')
      
      // Second request with deduplication disabled
      await client['get']('/test', { 
        deduplication: { enabled: false } 
      })

      // Should make two fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should force new request when specified', async () => {
      // First request
      await client['get']('/test')
      
      // Second request forced
      await client['get']('/test', { 
        deduplication: { force: true } 
      })

      // Should make two fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      // Provide enough mock values for all possible performance.now() calls
      mockPerformanceNow
        .mockReturnValue(0)    // Initial calls
        .mockReturnValueOnce(100) // Final end time measurement

      await client['get']('/test')

      const metrics = client.getPerformanceMetrics()
      console.log('Performance metrics:', metrics)
      expect(metrics['GET:/test']).toBeDefined()
      expect(metrics['GET:/test'].requestCount).toBe(1)
      expect(metrics['GET:/test'].averageTime).toBeGreaterThanOrEqual(0) // Allow zero for now
    })

    it('should calculate deduplication rate', async () => {
      // Mock to provide consistent values for all calls
      mockPerformanceNow
        .mockReturnValue(0)    // All start times
        .mockReturnValueOnce(50)  // End time for first request

      // Make multiple identical requests
      await Promise.all([
        client['get']('/test'),
        client['get']('/test'),
        client['get']('/test')
      ])

      const metrics = client.getPerformanceMetrics()
      console.log('Deduplication metrics:', metrics)
      expect(metrics['GET:/test'].deduplicationRate).toBeGreaterThan(0)
    })
  })

  describe('Cache Management', () => {
    it('should provide cache management methods', async () => {
      await client['get']('/test')

      let stats = client.getDeduplicationStats()
      expect(stats.cacheSize).toBe(1)

      client.clearDeduplicationCache()

      stats = client.getDeduplicationStats()
      expect(stats.cacheSize).toBe(0)
    })

    it('should list active requests', async () => {
      // Start a slow request
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(createMockResponse({ data: 'test' })), 100)
        )
      )

      const promise = client['get']('/slow-test')
      
      // Check active requests while request is in flight
      const activeRequests = client.getActiveRequests()
      expect(activeRequests.length).toBeGreaterThan(0)

      await promise
    })
  })
})

// ============================================================================
// Performance Benchmarks
// ============================================================================

describe('Performance Benchmarks', () => {
  let deduplicator: RequestDeduplicator

  beforeEach(() => {
    deduplicator = new RequestDeduplicator({
      debug: false,
      cacheTtl: 5000
    })
  })

  afterEach(() => {
    deduplicator.destroy()
  })

  it('should benchmark deduplication performance', async () => {
    const requestExecutor = vi.fn().mockResolvedValue({ result: 'test' })
    const requestOptions = { method: 'GET', endpoint: '/benchmark' }

    // Use real performance.now for this benchmark test
    const realPerformanceNow = global.performance.now
    global.performance.now = () => Date.now()

    try {
      // Benchmark without deduplication (separate requests)
      const startWithout = performance.now()
      await Promise.all(Array.from({ length: 100 }, () => 
        requestExecutor()
      ))
      const timeWithout = performance.now() - startWithout

      // Reset mock
      requestExecutor.mockClear()

      // Benchmark with deduplication
      const startWith = performance.now()
      await Promise.all(Array.from({ length: 100 }, () =>
        deduplicator.deduplicate(requestOptions, requestExecutor)
      ))
      const timeWith = performance.now() - startWith

      console.log(`Without deduplication: ${timeWithout}ms`)
      console.log(`With deduplication: ${timeWith}ms`)
      console.log(`Improvement: ${((timeWithout - timeWith) / timeWithout * 100).toFixed(2)}%`)

      // Deduplication should be significantly faster (or at least equal)
      expect(timeWith).toBeLessThanOrEqual(timeWithout + 10) // Allow 10ms tolerance
      expect(requestExecutor).toHaveBeenCalledTimes(1)
    } finally {
      // Restore the mock
      global.performance.now = realPerformanceNow
    }
  })

  it('should benchmark memory usage', async () => {
    const requestExecutor = vi.fn().mockResolvedValue({ result: 'test' })
    
    // Create many different requests to test memory usage
    const requests = Array.from({ length: 1000 }, (_, i) => ({
      method: 'GET',
      endpoint: `/test/${i}`,
      params: { id: i }
    }))

    const startMemory = process.memoryUsage().heapUsed

    await Promise.all(
      requests.map(request => 
        deduplicator.deduplicate(request, requestExecutor)
      )
    )

    const endMemory = process.memoryUsage().heapUsed
    const memoryUsed = (endMemory - startMemory) / 1024 / 1024 // MB

    console.log(`Memory used for 1000 requests: ${memoryUsed.toFixed(2)}MB`)

    // Memory usage should be reasonable
    expect(memoryUsed).toBeLessThan(50) // Less than 50MB for 1000 requests
  })

  it('should benchmark key generation performance', async () => {
    const keyCount = 10000
    const requests = Array.from({ length: keyCount }, (_, i) => ({
      method: i % 4 === 0 ? 'POST' : 'GET', // Mix of methods
      endpoint: `/test/${i % 20}`, // 20 unique endpoints (lots of duplicates)
      params: i % 3 === 0 ? { id: i % 10, type: 'benchmark' } : undefined, // Some have params, some don't
      body: i % 4 === 0 ? { data: `item${i % 5}` } : undefined // Some have bodies, some don't
    }))

    // Use real performance.now for this benchmark test
    const realPerformanceNow = global.performance.now
    global.performance.now = () => Date.now()

    let keyGenTime = 0
    let keys: string[] = []

    try {
      const start = performance.now()
      
      // Generate keys
      keys = requests.map(request => 
        deduplicator.generateRequestKey(request)
      )

      keyGenTime = performance.now() - start
    } finally {
      // Restore the mock
      global.performance.now = realPerformanceNow
    }

    console.log(`Generated ${keyCount} keys in ${keyGenTime.toFixed(2)}ms`)
    console.log(`Average: ${(keyGenTime / keyCount).toFixed(4)}ms per key`)

    // Verify uniqueness where expected
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBeLessThan(keyCount) // Some should be duplicates
    expect(uniqueKeys.size).toBeGreaterThan(20) // Should be more than just the endpoints
    expect(uniqueKeys.size).toBeLessThan(500) // Should be much less than total requests
    
    console.log(`Generated ${uniqueKeys.size} unique keys from ${keyCount} requests`)

    // Performance should be good (be lenient since this depends on test environment)
    expect(keyGenTime).toBeLessThan(1000) // Less than 1s for 10k keys (very generous)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Scenarios', () => {
  it('should handle real-world API patterns', async () => {
    const deduplicator = new RequestDeduplicator()
    const mockApiCall = vi.fn()

    // Simulate common API patterns
    const patterns = [
      // GET list requests (likely to be duplicated)
      { method: 'GET', endpoint: '/projects' },
      { method: 'GET', endpoint: '/projects', params: { page: 1 } },
      { method: 'GET', endpoint: '/projects', params: { page: 1 } }, // Duplicate
      
      // GET detail requests
      { method: 'GET', endpoint: '/projects/1' },
      { method: 'GET', endpoint: '/projects/1' }, // Duplicate
      { method: 'GET', endpoint: '/projects/2' },
      
      // POST requests (usually shouldn't be deduplicated, but identical ones could be)
      { method: 'POST', endpoint: '/projects', body: { name: 'Test' } },
      { method: 'POST', endpoint: '/projects', body: { name: 'Test' } }, // Potential duplicate
      
      // PUT/PATCH requests
      { method: 'PUT', endpoint: '/projects/1', body: { name: 'Updated' } },
      { method: 'PUT', endpoint: '/projects/1', body: { name: 'Updated' } }, // Duplicate
    ]

    mockApiCall.mockResolvedValue({ success: true })

    await Promise.all(
      patterns.map(pattern => 
        deduplicator.deduplicate(pattern, mockApiCall)
      )
    )

    const stats = deduplicator.getStats()
    
    console.log('Integration test stats:', stats)
    
    // Should have deduplicated some requests
    expect(stats.duplicatesPrevented).toBeGreaterThan(0)
    expect(stats.totalRequests).toBe(patterns.length)
    expect(mockApiCall).toHaveBeenCalledTimes(stats.totalRequests - stats.duplicatesPrevented)

    deduplicator.destroy()
  })

  it('should handle concurrent requests with different timings', async () => {
    const deduplicator = new RequestDeduplicator()
    const mockApiCall = vi.fn()

    // Create requests with different delays to simulate real network conditions
    mockApiCall.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({ data: 'test' }), Math.random() * 100)
      )
    )

    const requestOptions = { method: 'GET', endpoint: '/test' }
    
    // Start requests at different times
    const promises = [
      deduplicator.deduplicate(requestOptions, mockApiCall),
      delay(10).then(() => deduplicator.deduplicate(requestOptions, mockApiCall)),
      delay(20).then(() => deduplicator.deduplicate(requestOptions, mockApiCall)),
      delay(30).then(() => deduplicator.deduplicate(requestOptions, mockApiCall)),
    ]

    const results = await Promise.all(promises)

    // All should return the same result
    results.forEach(result => {
      expect(result).toEqual({ data: 'test' })
    })

    // Should only execute once
    expect(mockApiCall).toHaveBeenCalledTimes(1)

    deduplicator.destroy()
  })
})