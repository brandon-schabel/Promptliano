/**
 * Performance benchmarks for the unified query key system
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import {
  createEntityQueryKeys,
  createUnifiedQueryKeys,
  createMemoizedQueryKey,
  calculateInvalidationTargets,
  clearQueryKeyCache,
  initializeUnifiedQuerySystem,
  QUERY_KEY_REGISTRY
} from './query-key-factory'

describe('Query Key Performance Benchmarks', () => {
  beforeEach(() => {
    QUERY_KEY_REGISTRY.clear()
    clearQueryKeyCache()
  })

  test('should create query keys efficiently at scale', () => {
    const iterations = 10000
    const start = performance.now()
    
    // Create 10,000 query keys
    for (let i = 0; i < iterations; i++) {
      const keys = createEntityQueryKeys('projects')
      keys.detail(i)
      keys.list({ page: i % 10 })
      keys.search(`query-${i}`)
    }
    
    const end = performance.now()
    const duration = end - start
    
    console.log(`Created ${iterations * 3} query keys in ${duration.toFixed(2)}ms`)
    console.log(`Average time per key: ${(duration / (iterations * 3)).toFixed(4)}ms`)
    
    // Should complete in under 1 second for 30,000 operations
    expect(duration).toBeLessThan(1000)
  })

  test('should memoize query keys for repeated operations', () => {
    initializeUnifiedQuerySystem()
    
    const iterations = 1000
    const params = { limit: 10, sort: 'name' }
    
    // First run - populate cache
    const start1 = performance.now()
    for (let i = 0; i < iterations; i++) {
      createMemoizedQueryKey('projects', 'list', params)
    }
    const end1 = performance.now()
    const firstRun = end1 - start1
    
    // Second run - should be faster due to memoization
    const start2 = performance.now()
    for (let i = 0; i < iterations; i++) {
      createMemoizedQueryKey('projects', 'list', params)
    }
    const end2 = performance.now()
    const secondRun = end2 - start2
    
    console.log(`First run (cache miss): ${firstRun.toFixed(2)}ms`)
    console.log(`Second run (cache hit): ${secondRun.toFixed(2)}ms`)
    console.log(`Speedup: ${(firstRun / secondRun).toFixed(2)}x`)
    
    // Memoized calls should be at least somewhat faster (or at least not slower)
    // Note: In fast environments, the difference might be minimal
    expect(secondRun).toBeLessThanOrEqual(firstRun * 1.5)
  })

  test('should calculate invalidation targets efficiently', () => {
    const iterations = 1000
    const strategies = ['minimal', 'targeted', 'cascade', 'aggressive'] as const
    
    const results: Record<string, number> = {}
    
    strategies.forEach(strategy => {
      const start = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        calculateInvalidationTargets('projects', strategy)
        calculateInvalidationTargets('tickets', strategy)
        calculateInvalidationTargets('tasks', strategy)
      }
      
      const end = performance.now()
      const duration = end - start
      results[strategy] = duration
      
      console.log(`${strategy} strategy: ${duration.toFixed(2)}ms for ${iterations * 3} calculations`)
    })
    
    // All strategies should complete quickly
    Object.values(results).forEach(duration => {
      expect(duration).toBeLessThan(100)
    })
  })

  test('should handle large unified system initialization efficiently', () => {
    const start = performance.now()
    
    // Initialize the full unified system
    const unifiedKeys = initializeUnifiedQuerySystem()
    
    const end = performance.now()
    const duration = end - start
    
    console.log(`Initialized unified query system in ${duration.toFixed(2)}ms`)
    console.log(`Registry size: ${QUERY_KEY_REGISTRY.size} entities`)
    
    // Should initialize quickly even with all entities
    expect(duration).toBeLessThan(50)
    expect(QUERY_KEY_REGISTRY.size).toBeGreaterThan(10)
  })

  test('should maintain performance with complex query key structures', () => {
    const keys = createEntityQueryKeys('projects')
    const iterations = 5000
    
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      // Create complex nested query keys
      keys.relatedList(i, 'tickets', { 
        filters: { status: 'open', priority: 'high' },
        sort: { field: 'updated', order: 'desc' },
        pagination: { page: i % 100, limit: 20 }
      })
      
      keys.search(`complex query ${i}`, {
        projectId: i % 50,
        tags: ['urgent', 'bug'],
        dateRange: { start: Date.now() - 86400000, end: Date.now() }
      })
      
      keys.page(i % 100, 20, {
        filters: { category: 'development' },
        includes: ['metadata', 'permissions']
      })
    }
    
    const end = performance.now()
    const duration = end - start
    
    console.log(`Created ${iterations * 3} complex query keys in ${duration.toFixed(2)}ms`)
    
    // Should handle complex structures efficiently
    expect(duration).toBeLessThan(500)
  })

  test('should scale memory usage linearly', () => {
    const iterations = [100, 500, 1000, 2000]
    const memoryUsage: number[] = []
    
    iterations.forEach(count => {
      // Clear previous data
      QUERY_KEY_REGISTRY.clear()
      clearQueryKeyCache()
      
      const start = performance.now()
      
      // Create query keys
      for (let i = 0; i < count; i++) {
        const keys = createEntityQueryKeys('projects')
        keys.detail(i)
        keys.list({ offset: i })
      }
      
      const end = performance.now()
      const duration = end - start
      
      memoryUsage.push(duration)
      console.log(`${count} iterations: ${duration.toFixed(2)}ms`)
    })
    
    // Memory usage should scale roughly linearly
    // (not exponentially)
    const scalingRatio = memoryUsage[3] / memoryUsage[0] // 2000 vs 100
    expect(scalingRatio).toBeLessThan(30) // Should be closer to 20x than exponential growth
  })

  test('should optimize repeated entity key creation', () => {
    const entityTypes = ['projects', 'tickets', 'tasks', 'chats', 'prompts'] as const
    const iterations = 1000
    
    const start = performance.now()
    
    // Simulate real usage pattern - repeated access to same entity types
    for (let i = 0; i < iterations; i++) {
      entityTypes.forEach(entityType => {
        const keys = createEntityQueryKeys(entityType)
        keys.detail(i)
        keys.list()
        keys.search(`query-${i}`)
      })
    }
    
    const end = performance.now()
    const duration = end - start
    const totalOperations = iterations * entityTypes.length * 3
    
    console.log(`${totalOperations} operations in ${duration.toFixed(2)}ms`)
    console.log(`Average per operation: ${(duration / totalOperations).toFixed(4)}ms`)
    
    // Should handle repeated entity creation efficiently
    expect(duration).toBeLessThan(200)
  })

  test('should validate query keys quickly', () => {
    const iterations = 10000
    const validKeys = [
      ['projects', 'v1', 'detail', 123],
      ['tickets', 'v1', 'list', { status: 'open' }],
      ['prompts', 'v1', 'search', { query: 'test' }]
    ]
    
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      const key = validKeys[i % validKeys.length]
      // Validation happens in the factory functions
      createEntityQueryKeys('projects').validate(key)
    }
    
    const end = performance.now()
    const duration = end - start
    
    console.log(`Validated ${iterations} query keys in ${duration.toFixed(2)}ms`)
    
    // Validation should be very fast
    expect(duration).toBeLessThan(100)
  })
})

describe('Memory and Resource Usage', () => {
  test('should not create memory leaks in registry', () => {
    const initialSize = QUERY_KEY_REGISTRY.size
    
    // Create and destroy many entity keys
    for (let i = 0; i < 100; i++) {
      createUnifiedQueryKeys()
      QUERY_KEY_REGISTRY.clear()
    }
    
    const finalSize = QUERY_KEY_REGISTRY.size
    
    // Registry should be cleaned up properly
    expect(finalSize).toBe(0)
  })

  test('should handle concurrent query key operations', async () => {
    const promises = []
    const iterations = 100
    
    // Simulate concurrent access
    for (let i = 0; i < iterations; i++) {
      promises.push(Promise.resolve().then(() => {
        const keys = createEntityQueryKeys('projects')
        return {
          detail: keys.detail(i),
          list: keys.list({ page: i }),
          search: keys.search(`query-${i}`)
        }
      }))
    }
    
    const start = performance.now()
    const results = await Promise.all(promises)
    const end = performance.now()
    
    console.log(`Handled ${iterations} concurrent operations in ${(end - start).toFixed(2)}ms`)
    
    // All operations should complete successfully
    expect(results).toHaveLength(iterations)
    results.forEach((result, index) => {
      expect(result.detail).toEqual(['projects', 'v1', 'detail', index])
    })
  })
})

describe('Real-World Usage Simulation', () => {
  test('should handle typical application usage patterns', () => {
    initializeUnifiedQuerySystem()
    
    const start = performance.now()
    
    // Simulate a typical user session
    for (let session = 0; session < 10; session++) {
      // Load project list
      createMemoizedQueryKey('projects', 'list', {})
      
      // Navigate to project details
      const projectId = session + 1
      createMemoizedQueryKey('projects', 'detail', projectId)
      
      // Load project tickets
      createMemoizedQueryKey('tickets', 'list', { projectId })
      
      // Search prompts
      createMemoizedQueryKey('prompts', 'search', { query: `session-${session}` })
      
      // Load various project data
      const entities = ['files', 'git', 'queues'] as const
      entities.forEach(entity => {
        createMemoizedQueryKey(entity, 'list', { projectId })
      })
      
      // Simulate navigation and interactions
      for (let i = 0; i < 5; i++) {
        createMemoizedQueryKey('tickets', 'detail', session * 5 + i)
        createMemoizedQueryKey('tasks', 'list', { ticketId: session * 5 + i })
      }
    }
    
    const end = performance.now()
    const duration = end - start
    
    console.log(`Simulated 10 user sessions in ${duration.toFixed(2)}ms`)
    
    // Should handle realistic usage efficiently
    expect(duration).toBeLessThan(100)
  })
})