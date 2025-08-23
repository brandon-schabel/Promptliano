/**
 * Cache Manager Factory
 * Advanced cache management with smart invalidation and cross-cache updates
 */

import { type QueryClient } from '@tanstack/react-query'

// ============================================================================
// Types
// ============================================================================

export interface CacheManagerConfig {
  queryClient: QueryClient
  defaultStaleTime?: number
  defaultCacheTime?: number
  enableLogging?: boolean
}

export interface InvalidationRule {
  source: readonly unknown[] | ((key: readonly unknown[]) => boolean)
  targets: readonly (readonly unknown[])[] | ((key: readonly unknown[]) => readonly unknown[][])
  strategy?: 'invalidate' | 'remove' | 'refetch'
  cascade?: boolean
}

export interface CacheUpdateRule<T = any> {
  source: readonly unknown[]
  targets: readonly unknown[][]
  updater: (sourceData: T, targetData: any) => any
}

// ============================================================================
// Main Factory
// ============================================================================

export function createCacheManager(config: CacheManagerConfig) {
  const {
    queryClient,
    defaultStaleTime = 5 * 60 * 1000,
    defaultCacheTime = 10 * 60 * 1000,
    enableLogging = false
  } = config

  const log = (message: string, ...args: any[]) => {
    if (enableLogging) {
      console.log(`[CacheManager] ${message}`, ...args)
    }
  }

  // ============================================================================
  // Smart Invalidation
  // ============================================================================

  function createSmartInvalidator(rules: InvalidationRule[]) {
    return async (triggerKey: readonly unknown[]) => {
      log('Smart invalidation triggered for:', triggerKey)

      for (const rule of rules) {
        const shouldApply = typeof rule.source === 'function'
          ? rule.source(triggerKey)
          : matchesPattern(triggerKey, rule.source)

        if (shouldApply) {
          const targets = typeof rule.targets === 'function'
            ? rule.targets(triggerKey)
            : rule.targets

          for (const target of targets) {
            log(`Applying ${rule.strategy || 'invalidate'} to:`, target)

            switch (rule.strategy) {
              case 'remove':
                await queryClient.removeQueries({ queryKey: target })
                break
              case 'refetch':
                await queryClient.refetchQueries({ queryKey: target })
                break
              case 'invalidate':
              default:
                await queryClient.invalidateQueries({ queryKey: target })
                break
            }
          }

          // Cascade to related queries
          if (rule.cascade) {
            const relatedQueries = queryClient.getQueryCache().findAll({
              predicate: (query) => {
                const queryKey = query.queryKey
                return targets.some(target => 
                  queryKey.length > target.length &&
                  target.every((item, index) => 
                    JSON.stringify(item) === JSON.stringify(queryKey[index])
                  )
                )
              }
            })

            for (const query of relatedQueries) {
              log('Cascading invalidation to:', query.queryKey)
              await queryClient.invalidateQueries({ queryKey: query.queryKey })
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // Cross-Cache Updates
  // ============================================================================

  function createCrossCacheUpdater<T = any>(rules: CacheUpdateRule<T>[]) {
    return (sourceKey: readonly unknown[], sourceData: T) => {
      log('Cross-cache update from:', sourceKey)

      for (const rule of rules) {
        if (matchesPattern(sourceKey, rule.source)) {
          for (const targetKey of rule.targets) {
            const targetData = queryClient.getQueryData(targetKey)
            
            if (targetData !== undefined) {
              const updatedData = rule.updater(sourceData, targetData)
              log('Updating cache:', targetKey, 'with:', updatedData)
              queryClient.setQueryData(targetKey, updatedData)
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // Cache Warming
  // ============================================================================

  async function warmCache(
    keys: readonly (readonly unknown[])[],
    fetcher: (key: readonly unknown[]) => Promise<any>
  ) {
    log('Warming cache for', keys.length, 'keys')

    const promises = keys.map(key =>
      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () => fetcher(key),
        staleTime: defaultStaleTime
      })
    )

    await Promise.all(promises)
    log('Cache warming complete')
  }

  // ============================================================================
  // Cache Pruning
  // ============================================================================

  function pruneCache(options?: {
    maxAge?: number
    maxSize?: number
    excludeKeys?: readonly (readonly unknown[])[]
  }) {
    const { maxAge = 24 * 60 * 60 * 1000, excludeKeys = [] } = options || {}
    
    log('Pruning cache with maxAge:', maxAge)

    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()
    let pruned = 0

    for (const query of queries) {
      const shouldExclude = excludeKeys.some(key =>
        matchesPattern(query.queryKey, key)
      )

      if (!shouldExclude) {
        const lastUpdated = query.state.dataUpdatedAt
        const age = now - lastUpdated

        if (age > maxAge) {
          log('Pruning old query:', query.queryKey)
          cache.remove(query)
          pruned++
        }
      }
    }

    log(`Pruned ${pruned} queries`)
    return pruned
  }

  // ============================================================================
  // Cache Persistence
  // ============================================================================

  function persistCache(storage: Storage = localStorage, key: string = 'query-cache') {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    
    const persistableData = queries
      .filter(query => query.state.status === 'success')
      .map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
        dataUpdatedAt: query.state.dataUpdatedAt
      }))

    try {
      storage.setItem(key, JSON.stringify(persistableData))
      log('Cache persisted with', persistableData.length, 'queries')
    } catch (error) {
      console.error('Failed to persist cache:', error)
    }
  }

  function restoreCache(storage: Storage = localStorage, key: string = 'query-cache') {
    try {
      const stored = storage.getItem(key)
      if (!stored) return

      const persistedData = JSON.parse(stored)
      const now = Date.now()
      let restored = 0

      for (const item of persistedData) {
        const age = now - item.dataUpdatedAt
        
        // Only restore if not too old
        if (age < defaultCacheTime) {
          queryClient.setQueryData(item.queryKey, item.data)
          restored++
        }
      }

      log('Cache restored with', restored, 'queries')
    } catch (error) {
      console.error('Failed to restore cache:', error)
    }
  }

  // ============================================================================
  // Cache Statistics
  // ============================================================================

  function getCacheStats() {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()

    const stats = {
      totalQueries: queries.length,
      activeQueries: 0,
      staleQueries: 0,
      freshQueries: 0,
      averageAge: 0,
      totalSize: 0,
      oldestQuery: null as readonly unknown[] | null,
      newestQuery: null as readonly unknown[] | null,
      byStatus: {
        success: 0,
        error: 0,
        pending: 0
      }
    }

    let totalAge = 0
    let oldestAge = 0
    let newestAge = Infinity

    for (const query of queries) {
      const age = now - query.state.dataUpdatedAt
      totalAge += age

      // Status counts
      stats.byStatus[query.state.status as keyof typeof stats.byStatus]++

      // Active/stale/fresh counts
      if (query.isActive()) stats.activeQueries++
      if (query.isStale()) stats.staleQueries++
      else stats.freshQueries++

      // Track oldest/newest
      if (age > oldestAge) {
        oldestAge = age
        stats.oldestQuery = query.queryKey
      }
      if (age < newestAge) {
        newestAge = age
        stats.newestQuery = query.queryKey
      }

      // Estimate size (rough)
      try {
        const dataStr = JSON.stringify(query.state.data)
        stats.totalSize += dataStr.length
      } catch {}
    }

    stats.averageAge = queries.length > 0 ? totalAge / queries.length : 0

    return stats
  }

  // ============================================================================
  // Cache Synchronization
  // ============================================================================

  function createCacheSynchronizer(channel: string = 'query-cache-sync') {
    const bc = new BroadcastChannel(channel)

    // Listen for updates from other tabs
    bc.onmessage = (event) => {
      const { type, queryKey, data } = event.data

      switch (type) {
        case 'update':
          log('Received cache update from another tab:', queryKey)
          queryClient.setQueryData(queryKey, data)
          break
        case 'invalidate':
          log('Received invalidation from another tab:', queryKey)
          queryClient.invalidateQueries({ queryKey })
          break
        case 'remove':
          log('Received removal from another tab:', queryKey)
          queryClient.removeQueries({ queryKey })
          break
      }
    }

    // Broadcast updates to other tabs
    const broadcastUpdate = (queryKey: readonly unknown[], data: any) => {
      bc.postMessage({ type: 'update', queryKey, data })
    }

    const broadcastInvalidation = (queryKey: readonly unknown[]) => {
      bc.postMessage({ type: 'invalidate', queryKey })
    }

    const broadcastRemoval = (queryKey: readonly unknown[]) => {
      bc.postMessage({ type: 'remove', queryKey })
    }

    return {
      broadcastUpdate,
      broadcastInvalidation,
      broadcastRemoval,
      close: () => bc.close()
    }
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function matchesPattern(queryKey: readonly unknown[], pattern: readonly unknown[]): boolean {
    if (pattern.length > queryKey.length) return false
    
    return pattern.every((item, index) => {
      if (item === '*') return true // Wildcard
      return JSON.stringify(item) === JSON.stringify(queryKey[index])
    })
  }

  return {
    // Core functions
    invalidate: (queryKey: readonly unknown[]) => 
      queryClient.invalidateQueries({ queryKey }),
    remove: (queryKey: readonly unknown[]) => 
      queryClient.removeQueries({ queryKey }),
    refetch: (queryKey: readonly unknown[]) => 
      queryClient.refetchQueries({ queryKey }),
    reset: () => queryClient.clear(),

    // Advanced functions
    createSmartInvalidator,
    createCrossCacheUpdater,
    warmCache,
    pruneCache,
    persistCache,
    restoreCache,
    getCacheStats,
    createCacheSynchronizer,

    // Query functions
    getData: <T = any>(queryKey: readonly unknown[]) => 
      queryClient.getQueryData<T>(queryKey),
    setData: <T = any>(queryKey: readonly unknown[], data: T) => 
      queryClient.setQueryData(queryKey, data),
    
    // Batch operations
    invalidateMany: (queryKeys: readonly (readonly unknown[])[]) => 
      Promise.all(queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))),
    removeMany: (queryKeys: readonly (readonly unknown[])[]) => 
      Promise.all(queryKeys.map(key => queryClient.removeQueries({ queryKey: key }))),
    
    // Debugging
    getAllQueries: () => queryClient.getQueryCache().getAll(),
    getActiveQueries: () => queryClient.getQueryCache().getAll().filter(q => q.isActive()),
    getStaleQueries: () => queryClient.getQueryCache().getAll().filter(q => q.isStale())
  }
}

// ============================================================================
// Standalone Smart Invalidator
// ============================================================================

export function createSmartInvalidator(
  queryClient: QueryClient,
  rules: InvalidationRule[]
) {
  const manager = createCacheManager({ queryClient })
  return manager.createSmartInvalidator(rules)
}

// ============================================================================
// Standalone Cross-Cache Updater
// ============================================================================

export function createCrossCacheUpdater<T = any>(
  queryClient: QueryClient,
  rules: CacheUpdateRule<T>[]
) {
  const manager = createCacheManager({ queryClient })
  return manager.createCrossCacheUpdater(rules)
}