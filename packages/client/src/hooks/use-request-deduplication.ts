/**
 * React Hooks for Request Deduplication Management
 * 
 * This module provides React hooks for managing request deduplication,
 * performance monitoring, and optimization controls.
 * 
 * Features:
 * - Real-time deduplication statistics
 * - Performance metrics monitoring
 * - Manual cache control
 * - Configuration management
 * - Integration with existing API hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePromptlianoClient } from '@/context/promptliano-client-context'
import { 
  getRequestDeduplicator,
  getDeduplicationStats,
  configureRequestDeduplicator,
  type DeduplicationStats,
  type DeduplicationConfig
} from '../lib/request-deduplicator'
import { 
  isDeduplicatedClient,
  type DeduplicatedApiClient
} from '../lib/deduplicated-api-client'

// ============================================================================
// Core Deduplication Hooks
// ============================================================================

/**
 * Hook to access deduplication statistics with real-time updates
 */
export function useDeduplicationStats(updateInterval: number = 1000) {
  const [stats, setStats] = useState<DeduplicationStats>(getDeduplicationStats())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const updateStats = () => {
      setStats(getDeduplicationStats())
    }

    // Update immediately
    updateStats()

    // Set up interval for real-time updates
    intervalRef.current = setInterval(updateStats, updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [updateInterval])

  return stats
}

/**
 * Hook for managing deduplication configuration
 */
export function useDeduplicationConfig() {
  const [config, setConfigState] = useState<Partial<DeduplicationConfig>>({})

  const updateConfig = useCallback((newConfig: Partial<DeduplicationConfig>) => {
    configureRequestDeduplicator(newConfig)
    setConfigState(prev => ({ ...prev, ...newConfig }))
  }, [])

  const resetConfig = useCallback(() => {
    const defaultConfig: DeduplicationConfig = {
      cacheTtl: 5000,
      maxCacheSize: 1000,
      enableCombining: true,
      debug: false
    }
    updateConfig(defaultConfig)
  }, [updateConfig])

  return {
    config,
    updateConfig,
    resetConfig
  }
}

/**
 * Hook for manual cache management
 */
export function useDeduplicationCache() {
  const { client } = usePromptlianoClient()
  const deduplicator = getRequestDeduplicator()

  const clearCache = useCallback(() => {
    deduplicator.clearCache()
    
    // Also clear client cache if it's a deduplicated client
    if (client && isDeduplicatedClient(client)) {
      client.clearDeduplicationCache()
    }
  }, [client, deduplicator])

  const getActiveRequests = useCallback(() => {
    return deduplicator.getActiveRequestKeys()
  }, [deduplicator])

  const abortRequest = useCallback((requestKey: string) => {
    return deduplicator.abortRequest(requestKey)
  }, [deduplicator])

  const getCacheSize = useCallback(() => {
    return deduplicator.getStats().cacheSize
  }, [deduplicator])

  return {
    clearCache,
    getActiveRequests,
    abortRequest,
    getCacheSize
  }
}

// ============================================================================
// Performance Monitoring Hooks
// ============================================================================

/**
 * Hook for monitoring API performance metrics
 */
export function useApiPerformanceMetrics() {
  const { client } = usePromptlianoClient()
  const [metrics, setMetrics] = useState<Record<string, any>>({})

  const updateMetrics = useCallback(() => {
    if (client && isDeduplicatedClient(client)) {
      setMetrics(client.getPerformanceMetrics())
    }
  }, [client])

  useEffect(() => {
    updateMetrics()
    
    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000)
    
    return () => clearInterval(interval)
  }, [updateMetrics])

  // Calculate aggregate metrics
  const aggregateMetrics = useCallback(() => {
    const endpoints = Object.keys(metrics)
    if (endpoints.length === 0) return null

    const totalRequests = endpoints.reduce((sum, endpoint) => 
      sum + metrics[endpoint].requestCount, 0)
    
    const averageDeduplicationRate = endpoints.reduce((sum, endpoint) => 
      sum + (metrics[endpoint].deduplicationRate * metrics[endpoint].requestCount), 0) / totalRequests
    
    const averageResponseTime = endpoints.reduce((sum, endpoint) => 
      sum + (metrics[endpoint].averageTime * metrics[endpoint].requestCount), 0) / totalRequests
    
    const totalErrors = endpoints.reduce((sum, endpoint) => 
      sum + (metrics[endpoint].errorRate * metrics[endpoint].requestCount / 100), 0)
    
    return {
      totalRequests,
      averageDeduplicationRate: Math.round(averageDeduplicationRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      errorRate: Math.round((totalErrors / totalRequests) * 100 * 100) / 100,
      endpointCount: endpoints.length
    }
  }, [metrics])

  return {
    metrics,
    aggregate: aggregateMetrics(),
    refresh: updateMetrics
  }
}

/**
 * Hook for real-time deduplication rate monitoring
 */
export function useDeduplicationRate(windowSize: number = 10) {
  const stats = useDeduplicationStats(500) // Update every 500ms for real-time feel
  const [rateHistory, setRateHistory] = useState<number[]>([])

  useEffect(() => {
    const currentRate = stats.totalRequests > 0 
      ? (stats.duplicatesPrevented / stats.totalRequests) * 100 
      : 0

    setRateHistory(prev => {
      const newHistory = [...prev, currentRate]
      // Keep only the last windowSize entries
      return newHistory.slice(-windowSize)
    })
  }, [stats, windowSize])

  const averageRate = rateHistory.length > 0 
    ? rateHistory.reduce((sum, rate) => sum + rate, 0) / rateHistory.length
    : 0

  const trend = rateHistory.length >= 2 
    ? rateHistory[rateHistory.length - 1] - rateHistory[rateHistory.length - 2]
    : 0

  return {
    currentRate: rateHistory[rateHistory.length - 1] || 0,
    averageRate: Math.round(averageRate * 100) / 100,
    trend: Math.round(trend * 100) / 100,
    history: rateHistory
  }
}

// ============================================================================
// Optimization Control Hooks
// ============================================================================

/**
 * Hook for controlling deduplication on/off
 */
export function useDeduplicationControl() {
  const { client } = usePromptlianoClient()
  const [isEnabled, setIsEnabled] = useState(true)

  const toggle = useCallback(() => {
    const newState = !isEnabled
    setIsEnabled(newState)
    
    if (client && isDeduplicatedClient(client)) {
      client.setDeduplicationEnabled(newState)
    }
  }, [client, isEnabled])

  const enable = useCallback(() => {
    setIsEnabled(true)
    if (client && isDeduplicatedClient(client)) {
      client.setDeduplicationEnabled(true)
    }
  }, [client])

  const disable = useCallback(() => {
    setIsEnabled(false)
    if (client && isDeduplicatedClient(client)) {
      client.setDeduplicationEnabled(false)
    }
  }, [client])

  // Sync with client state
  useEffect(() => {
    if (client && isDeduplicatedClient(client)) {
      setIsEnabled(client.isDeduplicationEnabled())
    }
  }, [client])

  return {
    isEnabled,
    toggle,
    enable,
    disable
  }
}

/**
 * Hook for adaptive deduplication based on performance
 */
export function useAdaptiveDeduplication() {
  const stats = useDeduplicationStats()
  const { updateConfig } = useDeduplicationConfig()
  const { metrics } = useApiPerformanceMetrics()
  
  useEffect(() => {
    // Adaptive logic: adjust cache TTL based on cache hit rate
    if (stats.totalRequests > 100) { // Only adapt after some requests
      const hitRate = stats.cacheHits / (stats.cacheHits + stats.cacheMisses)
      
      if (hitRate < 0.3) {
        // Low hit rate, increase cache TTL
        updateConfig({ cacheTtl: 8000 })
      } else if (hitRate > 0.8) {
        // High hit rate, can afford shorter TTL for fresher data
        updateConfig({ cacheTtl: 3000 })
      }
    }
  }, [stats, updateConfig])

  useEffect(() => {
    // Adaptive cache size based on active requests
    if (stats.activeRequests > 800) {
      // Increase cache size if we're near the limit
      updateConfig({ maxCacheSize: 1500 })
    } else if (stats.activeRequests < 100) {
      // Decrease cache size to save memory
      updateConfig({ maxCacheSize: 500 })
    }
  }, [stats.activeRequests, updateConfig])

  return {
    isAdapting: stats.totalRequests > 100,
    recommendations: {
      shouldIncreaseCacheTtl: stats.totalRequests > 100 && 
        (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) < 0.3,
      shouldDecreaseCacheTtl: stats.totalRequests > 100 && 
        (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) > 0.8,
      shouldIncreaseCacheSize: stats.activeRequests > 800,
      shouldDecreaseCacheSize: stats.activeRequests < 100
    }
  }
}

// ============================================================================
// Debug and Development Hooks
// ============================================================================

/**
 * Hook for debugging deduplication behavior
 */
export function useDeduplicationDebug() {
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const stats = useDeduplicationStats()
  const cache = useDeduplicationCache()
  
  const logDebugInfo = useCallback(() => {
    const timestamp = new Date().toISOString()
    const activeRequests = cache.getActiveRequests()
    
    const logEntry = `[${timestamp}] Stats: ${JSON.stringify(stats)} | Active: ${activeRequests.length}`
    
    setDebugLogs(prev => {
      const newLogs = [...prev, logEntry]
      // Keep only last 50 logs
      return newLogs.slice(-50)
    })
  }, [stats, cache])

  const clearLogs = useCallback(() => {
    setDebugLogs([])
  }, [])

  const exportLogs = useCallback(() => {
    return debugLogs.join('\n')
  }, [debugLogs])

  return {
    logs: debugLogs,
    logDebugInfo,
    clearLogs,
    exportLogs,
    currentStats: stats
  }
}

/**
 * Hook for testing deduplication effectiveness
 */
export function useDeduplicationTest() {
  const { client } = usePromptlianoClient()
  const [testResults, setTestResults] = useState<{
    withDeduplication: number[]
    withoutDeduplication: number[]
    isRunning: boolean
  }>({
    withDeduplication: [],
    withoutDeduplication: [],
    isRunning: false
  })

  const runTest = useCallback(async (
    endpoint: string, 
    requestCount: number = 10
  ) => {
    if (!client || !isDeduplicatedClient(client)) {
      console.warn('Cannot run deduplication test: client is not deduplicated')
      return
    }

    setTestResults(prev => ({ ...prev, isRunning: true }))

    try {
      // Test with deduplication
      const withDeduplicationTimes: number[] = []
      client.setDeduplicationEnabled(true)
      
      const promises1 = Array.from({ length: requestCount }, async () => {
        const start = performance.now()
        try {
          await client.get(endpoint)
          return performance.now() - start
        } catch {
          return performance.now() - start
        }
      })
      
      const results1 = await Promise.all(promises1)
      withDeduplicationTimes.push(...results1)

      // Wait a bit for cache to clear
      await new Promise(resolve => setTimeout(resolve, 1000))
      client.clearDeduplicationCache()

      // Test without deduplication
      const withoutDeduplicationTimes: number[] = []
      client.setDeduplicationEnabled(false)
      
      const promises2 = Array.from({ length: requestCount }, async () => {
        const start = performance.now()
        try {
          await client.get(endpoint)
          return performance.now() - start
        } catch {
          return performance.now() - start
        }
      })
      
      const results2 = await Promise.all(promises2)
      withoutDeduplicationTimes.push(...results2)

      // Re-enable deduplication
      client.setDeduplicationEnabled(true)

      setTestResults({
        withDeduplication: withDeduplicationTimes,
        withoutDeduplication: withoutDeduplicationTimes,
        isRunning: false
      })
    } catch (error) {
      console.error('Deduplication test failed:', error)
      setTestResults(prev => ({ ...prev, isRunning: false }))
    }
  }, [client])

  const getTestAnalysis = useCallback(() => {
    const { withDeduplication, withoutDeduplication } = testResults
    
    if (withDeduplication.length === 0 || withoutDeduplication.length === 0) {
      return null
    }

    const avgWith = withDeduplication.reduce((sum, time) => sum + time, 0) / withDeduplication.length
    const avgWithout = withoutDeduplication.reduce((sum, time) => sum + time, 0) / withoutDeduplication.length
    
    const improvement = ((avgWithout - avgWith) / avgWithout) * 100
    
    return {
      averageTimeWithDeduplication: Math.round(avgWith * 100) / 100,
      averageTimeWithoutDeduplication: Math.round(avgWithout * 100) / 100,
      improvementPercentage: Math.round(improvement * 100) / 100,
      requestCount: withDeduplication.length
    }
  }, [testResults])

  return {
    runTest,
    testResults,
    analysis: getTestAnalysis(),
    isRunning: testResults.isRunning
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook that warns about potential deduplication issues
 */
export function useDeduplicationHealthCheck() {
  const stats = useDeduplicationStats()
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const newWarnings: string[] = []

    // Check for low deduplication rate
    if (stats.totalRequests > 50 && stats.averageDeduplicationRate < 10) {
      newWarnings.push('Low deduplication rate detected. Consider reviewing request patterns.')
    }

    // Check for high cache miss rate
    const totalCacheOperations = stats.cacheHits + stats.cacheMisses
    if (totalCacheOperations > 20 && (stats.cacheMisses / totalCacheOperations) > 0.8) {
      newWarnings.push('High cache miss rate. Consider increasing cache TTL.')
    }

    // Check for cache size issues
    if (stats.cacheSize > 900) {
      newWarnings.push('Cache approaching maximum size. Consider increasing max cache size.')
    }

    setWarnings(newWarnings)
  }, [stats])

  return {
    warnings,
    isHealthy: warnings.length === 0,
    stats
  }
}

/**
 * Hook for integration with existing query invalidation
 */
export function useDeduplicationInvalidation() {
  const cache = useDeduplicationCache()
  
  const invalidateByPattern = useCallback((pattern: string) => {
    const activeRequests = cache.getActiveRequests()
    const matchingRequests = activeRequests.filter(key => 
      key.includes(pattern)
    )
    
    matchingRequests.forEach(key => cache.abortRequest(key))
    
    return matchingRequests.length
  }, [cache])

  const invalidateByEndpoint = useCallback((endpoint: string) => {
    return invalidateByPattern(endpoint)
  }, [invalidateByPattern])

  const invalidateByMethod = useCallback((method: string) => {
    return invalidateByPattern(`${method}:`)
  }, [invalidateByPattern])

  return {
    invalidateByPattern,
    invalidateByEndpoint,
    invalidateByMethod,
    clearAll: cache.clearCache
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type { DeduplicationStats, DeduplicationConfig }