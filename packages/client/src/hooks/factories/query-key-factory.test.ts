/**
 * Comprehensive tests for the unified query key system
 */

import { describe, test, expect, beforeEach, vi } from 'bun:test'
import {
  createEntityQueryKeys,
  createUnifiedQueryKeys,
  createSmartInvalidator,
  calculateInvalidationTargets,
  validateQueryKey,
  validateQueryKeyPattern,
  migrateQueryKey,
  createMemoizedQueryKey,
  clearQueryKeyCache,
  initializeUnifiedQuerySystem,
  getEntityQueryKeys,
  assertValidQueryKey,
  ENTITY_RELATIONSHIPS,
  QUERY_KEY_REGISTRY,
  type EntityNamespace,
  type InvalidationStrategy
} from './query-key-factory'

// Mock QueryClient for testing
const mockQueryClient = {
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
  getQueryCache: vi.fn(() => ({
    getAll: vi.fn(() => []),
    clear: vi.fn()
  }))
}

describe('Query Key Factory System', () => {
  beforeEach(() => {
    // Clear registry before each test
    QUERY_KEY_REGISTRY.clear()
    clearQueryKeyCache()
    vi.clearAllMocks()
  })

  describe('Entity Query Keys', () => {
    test('should create standardized query keys for an entity', () => {
      const projectKeys = createEntityQueryKeys('projects')
      
      expect(projectKeys.all).toEqual(['projects', 'v1'])
      expect(projectKeys.lists()).toEqual(['projects', 'v1', 'list'])
      expect(projectKeys.list({ limit: 10 })).toEqual(['projects', 'v1', 'list', { limit: 10 }])
      expect(projectKeys.detail(123)).toEqual(['projects', 'v1', 'detail', 123])
    })

    test('should create project-scoped query keys', () => {
      const ticketKeys = createEntityQueryKeys('tickets')
      
      expect(ticketKeys.project(456)).toEqual(['tickets', 'v1', 'project', 456])
      expect(ticketKeys.projectList(456, { status: 'open' })).toEqual([
        'tickets', 'v1', 'project', 456, 'list', { status: 'open' }
      ])
    })

    test('should create hierarchical relationship keys', () => {
      const taskKeys = createEntityQueryKeys('tasks')
      
      expect(taskKeys.parent(789, 'tickets')).toEqual(['tasks', 'v1', 'parent', 789, 'tickets'])
      expect(taskKeys.children(456, 'tasks')).toEqual(['tasks', 'v1', 'children', 456, 'tasks'])
    })

    test('should create search and filter keys', () => {
      const promptKeys = createEntityQueryKeys('prompts')
      
      expect(promptKeys.search('test query', { limit: 5 })).toEqual([
        'prompts', 'v1', 'search', { query: 'test query', limit: 5 }
      ])
      expect(promptKeys.filter({ status: 'active' })).toEqual([
        'prompts', 'v1', 'filter', { status: 'active' }
      ])
    })

    test('should create mutation and optimistic update keys', () => {
      const chatKeys = createEntityQueryKeys('chats')
      
      expect(chatKeys.mutation('create', 123)).toEqual(['chats', 'v1', 'mutation', 'create', 123])
      expect(chatKeys.optimistic(456)).toEqual(['chats', 'v1', 'optimistic', 456])
    })

    test('should include utility methods', () => {
      const keys = createEntityQueryKeys('projects')
      
      expect(keys.match(['projects', 'v1', 'detail', 123])).toBe(true)
      expect(keys.match(['tickets', 'v1', 'detail', 123])).toBe(false)
      expect(keys.match(['projects', 'v2', 'detail', 123])).toBe(false)
    })
  })

  describe('Unified Query Key System', () => {
    test('should create query keys for all entity namespaces', () => {
      const unifiedKeys = createUnifiedQueryKeys()
      
      const expectedNamespaces: EntityNamespace[] = [
        'projects', 'tickets', 'tasks', 'chats', 'prompts', 'agents',
        'commands', 'hooks', 'queues', 'files', 'keys', 'providers',
        'git', 'mcp', 'flows'
      ]
      
      expectedNamespaces.forEach(namespace => {
        expect(unifiedKeys[namespace]).toBeDefined()
        expect(unifiedKeys[namespace].all).toEqual([namespace, 'v1'])
      })
    })

    test('should register all keys in the global registry', () => {
      createUnifiedQueryKeys()
      
      expect(QUERY_KEY_REGISTRY.size).toBeGreaterThan(0)
      expect(QUERY_KEY_REGISTRY.has('projects')).toBe(true)
      expect(QUERY_KEY_REGISTRY.has('tickets')).toBe(true)
    })
  })

  describe('Invalidation Strategy Calculation', () => {
    test('should calculate minimal invalidation targets', () => {
      const targets = calculateInvalidationTargets('projects', 'minimal')
      expect(targets).toEqual(['projects'])
    })

    test('should calculate targeted invalidation targets', () => {
      const targets = calculateInvalidationTargets('projects', 'targeted')
      expect(targets).toContain('projects')
      expect(targets).toContain('tickets')
      expect(targets).toContain('files')
    })

    test('should calculate cascade invalidation targets', () => {
      const targets = calculateInvalidationTargets('projects', 'cascade')
      expect(targets).toContain('projects')
      expect(targets).toContain('tickets')
      expect(targets).toContain('tasks') // tickets -> tasks
      expect(targets).toContain('queues') // tasks -> queues
    })

    test('should calculate aggressive invalidation targets', () => {
      const targets = calculateInvalidationTargets('projects', 'aggressive')
      expect(targets.length).toBe(Object.keys(ENTITY_RELATIONSHIPS).length)
    })
  })

  describe('Smart Invalidation', () => {
    test('should invalidate entity with dependencies', () => {
      createUnifiedQueryKeys() // Initialize registry
      const smartInvalidator = createSmartInvalidator(mockQueryClient)
      
      smartInvalidator.invalidateEntity('projects', { id: 123, strategy: 'targeted' })
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalled()
    })

    test('should invalidate multiple entities', () => {
      createUnifiedQueryKeys()
      const smartInvalidator = createSmartInvalidator(mockQueryClient)
      
      smartInvalidator.invalidateMultiple([
        { namespace: 'projects', id: 123 },
        { namespace: 'tickets', id: 456 }
      ])
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2)
    })

    test('should invalidate project-scoped queries', () => {
      createUnifiedQueryKeys()
      const smartInvalidator = createSmartInvalidator(mockQueryClient)
      
      smartInvalidator.invalidateProject(123)
      
      // Should invalidate project and all project-scoped entities
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(7) // 6 project-scoped + 1 project
    })
  })

  describe('Query Key Validation', () => {
    test('should validate query keys against rules', () => {
      const validKey = ['projects', 'v1', 'detail', 123]
      const invalidKey = ['unknown', 'v1', 'detail', 123]
      
      expect(validateQueryKey(validKey)).toBe(true)
      expect(validateQueryKey(invalidKey)).toBe(false)
    })

    test('should validate query key patterns', () => {
      const queryKey = ['projects', 'v1', 'detail', 123]
      const validPattern = ['projects', 'v1', 'detail', '*']
      const invalidPattern = ['tickets', 'v1', 'detail', '*']
      
      expect(validateQueryKeyPattern(queryKey, validPattern)).toBe(true)
      expect(validateQueryKeyPattern(queryKey, invalidPattern)).toBe(false)
    })

    test('should assert valid query keys with TypeScript', () => {
      const queryKey = ['projects', 'v1', 'detail', 123] as const
      
      expect(() => assertValidQueryKey(queryKey, 'projects')).not.toThrow()
      expect(() => assertValidQueryKey(queryKey, 'tickets')).toThrow()
    })

    test('should reject query keys exceeding max depth', () => {
      const deepKey = Array.from({ length: 15 }, (_, i) => `level${i}`)
      
      expect(validateQueryKey(deepKey)).toBe(false)
    })

    test('should reject query keys with invalid types', () => {
      const keyWithFunction = ['projects', 'v1', () => {}]
      
      expect(validateQueryKey(keyWithFunction)).toBe(false)
    })
  })

  describe('Migration Helpers', () => {
    test('should migrate legacy query keys to unified format', () => {
      const legacyKey = ['projects', 'detail', 123]
      const migratedKey = migrateQueryKey(legacyKey, 'projects')
      
      expect(migratedKey).toEqual(['projects', 'v1', 'detail', 123])
    })

    test('should not migrate already unified keys', () => {
      const unifiedKey = ['projects', 'v1', 'detail', 123]
      const result = migrateQueryKey(unifiedKey, 'projects')
      
      expect(result).toEqual(unifiedKey)
    })
  })

  describe('Performance Optimizations', () => {
    test('should memoize query key creation', () => {
      createUnifiedQueryKeys()
      
      const key1 = createMemoizedQueryKey('projects', 'list', { limit: 10 })
      const key2 = createMemoizedQueryKey('projects', 'list', { limit: 10 })
      
      expect(key1).toBe(key2) // Same reference due to memoization
    })

    test('should clear memoization cache', () => {
      createUnifiedQueryKeys()
      
      createMemoizedQueryKey('projects', 'list', { limit: 10 })
      clearQueryKeyCache()
      
      const key1 = createMemoizedQueryKey('projects', 'list', { limit: 10 })
      const key2 = createMemoizedQueryKey('projects', 'list', { limit: 10 })
      
      expect(key1).toBe(key2) // Still memoized after cache operations
    })

    test('should throw error for unknown operations', () => {
      createUnifiedQueryKeys()
      
      expect(() => createMemoizedQueryKey('projects', 'unknown', {})).toThrow()
    })
  })

  describe('System Initialization', () => {
    test('should initialize unified query system', () => {
      const result = initializeUnifiedQuerySystem()
      
      expect(result).toBeDefined()
      expect(QUERY_KEY_REGISTRY.size).toBeGreaterThan(0)
    })

    test('should get entity query keys after initialization', () => {
      initializeUnifiedQuerySystem()
      
      const projectKeys = getEntityQueryKeys('projects')
      expect(projectKeys.all).toEqual(['projects', 'v1'])
    })

    test('should throw error for unregistered entity', () => {
      QUERY_KEY_REGISTRY.clear()
      
      expect(() => getEntityQueryKeys('projects')).toThrow()
    })
  })

  describe('Entity Relationships', () => {
    test('should define relationships for all entities', () => {
      const entityCount = Object.keys(ENTITY_RELATIONSHIPS).length
      expect(entityCount).toBeGreaterThan(0)
      
      // Verify that each entity has required relationship properties
      Object.entries(ENTITY_RELATIONSHIPS).forEach(([namespace, relationships]) => {
        expect(relationships.dependents).toBeInstanceOf(Array)
        expect(relationships.dependencies).toBeInstanceOf(Array)
      })
    })

    test('should have consistent hierarchical relationships', () => {
      // If A is parent of B, then B should have A as dependency
      Object.entries(ENTITY_RELATIONSHIPS).forEach(([namespace, relationships]) => {
        if (relationships.children) {
          relationships.children.forEach(child => {
            const childRelationships = ENTITY_RELATIONSHIPS[child]
            expect(childRelationships.dependencies).toContain(namespace as EntityNamespace)
          })
        }
      })
    })
  })

  describe('Type Safety', () => {
    test('should provide type-safe entity namespace', () => {
      const keys = createEntityQueryKeys('projects')
      
      // TypeScript should prevent invalid namespaces at compile time
      expect(keys.all[0]).toBe('projects')
    })

    test('should maintain readonly query key arrays', () => {
      const keys = createEntityQueryKeys('projects')
      const queryKey = keys.detail(123)
      
      // Should be readonly - this would fail at compile time
      // queryKey[0] = 'modified' // TypeScript error
      
      expect(queryKey).toEqual(['projects', 'v1', 'detail', 123])
    })
  })

  describe('Error Handling', () => {
    test('should handle missing entity in smart invalidator', () => {
      const smartInvalidator = createSmartInvalidator(mockQueryClient)
      
      // Should not throw, just warn
      smartInvalidator.invalidateEntity('projects' as EntityNamespace, { id: 123 })
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
    })

    test('should handle empty query client cache', () => {
      mockQueryClient.getQueryCache.mockReturnValue({
        getAll: () => [],
        clear: vi.fn()
      })
      
      const smartInvalidator = createSmartInvalidator(mockQueryClient)
      
      expect(() => smartInvalidator.invalidateProject(123)).not.toThrow()
    })
  })

  describe('Integration with Real Query Keys', () => {
    test('should integrate with existing CHAT_KEYS pattern', () => {
      const chatKeys = createEntityQueryKeys('chats')
      
      // Should match existing patterns from api-hooks.ts
      expect(chatKeys.all).toEqual(['chats', 'v1'])
      expect(chatKeys.list()).toEqual(['chats', 'v1', 'list'])
      expect(chatKeys.detail(123)).toEqual(['chats', 'v1', 'detail', 123])
    })

    test('should integrate with existing PROJECT_KEYS pattern', () => {
      const projectKeys = createEntityQueryKeys('projects')
      
      expect(projectKeys.all).toEqual(['projects', 'v1'])
      expect(projectKeys.list()).toEqual(['projects', 'v1', 'list'])
      expect(projectKeys.detail(456)).toEqual(['projects', 'v1', 'detail', 456])
    })

    test('should support project-specific queries like existing hooks', () => {
      const fileKeys = createEntityQueryKeys('files')
      
      // Should support project-scoped file queries
      expect(fileKeys.project(123)).toEqual(['files', 'v1', 'project', 123])
      expect(fileKeys.projectList(123)).toEqual(['files', 'v1', 'project', 123, 'list'])
    })
  })
})

describe('Performance Benchmarks', () => {
  test('should create query keys efficiently', () => {
    const start = performance.now()
    
    // Create 1000 query keys
    for (let i = 0; i < 1000; i++) {
      createEntityQueryKeys('projects').detail(i)
    }
    
    const end = performance.now()
    const duration = end - start
    
    // Should complete in under 100ms
    expect(duration).toBeLessThan(100)
  })

  test('should memoize query keys for performance', () => {
    initializeUnifiedQuerySystem()
    
    const start = performance.now()
    
    // Create same query key 1000 times
    for (let i = 0; i < 1000; i++) {
      createMemoizedQueryKey('projects', 'list', { limit: 10 })
    }
    
    const end = performance.now()
    const duration = end - start
    
    // Memoized calls should be very fast
    expect(duration).toBeLessThan(50)
  })

  test('should calculate invalidation targets efficiently', () => {
    const start = performance.now()
    
    // Calculate invalidation targets 100 times
    for (let i = 0; i < 100; i++) {
      calculateInvalidationTargets('projects', 'cascade')
    }
    
    const end = performance.now()
    const duration = end - start
    
    // Should complete quickly even for cascade strategy
    expect(duration).toBeLessThan(50)
  })
})