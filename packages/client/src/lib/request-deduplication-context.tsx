/**
 * Request Deduplication Context and Memory Management
 * 
 * Provides React context for request deduplication with automatic cleanup,
 * memory management, and lifecycle integration.
 * 
 * Features:
 * - Automatic cleanup on component unmount
 * - Memory leak prevention
 * - Performance monitoring
 * - Route-based cache invalidation
 * - Error boundary integration
 * - Development tools integration
 */

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useRef, 
  useCallback,
  useState,
  ReactNode
} from 'react'
import { useRouter } from '@tanstack/react-router'
import { 
  RequestDeduplicator,
  getRequestDeduplicator,
  createQueryKeyBasedDeduplicator,
  type DeduplicationConfig,
  type DeduplicationStats
} from './request-deduplicator'

// ============================================================================
// Context Types
// ============================================================================

interface DeduplicationContextValue {
  deduplicator: RequestDeduplicator
  stats: DeduplicationStats
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
  clearCache: () => void
  getActiveRequests: () => string[]
  updateConfig: (config: Partial<DeduplicationConfig>) => void
}

interface DeduplicationProviderProps {
  children: ReactNode
  config?: DeduplicationConfig
  enableRouteInvalidation?: boolean
  enableDevTools?: boolean
  cleanupOnUnmount?: boolean
}

// ============================================================================
// Context Creation
// ============================================================================

const DeduplicationContext = createContext<DeduplicationContextValue | null>(null)

/**
 * Hook to access deduplication context
 */
export function useDeduplicationContext(): DeduplicationContextValue {
  const context = useContext(DeduplicationContext)
  if (!context) {
    throw new Error('useDeduplicationContext must be used within a DeduplicationProvider')
  }
  return context
}

// ============================================================================
// Memory Management Utilities
// ============================================================================

class MemoryManager {
  private memoryUsage: Map<string, number> = new Map()
  private gcInterval: NodeJS.Timeout | null = null
  private onMemoryPressure?: () => void

  constructor(onMemoryPressure?: () => void) {
    this.onMemoryPressure = onMemoryPressure
    this.startMemoryMonitoring()
  }

  private startMemoryMonitoring(): void {
    // Check memory usage every 30 seconds
    this.gcInterval = setInterval(() => {
      this.performGarbageCollection()
    }, 30000)

    // Listen for memory pressure events (if supported)
    if (typeof window !== 'undefined' && 'memory' in performance) {
      // Modern browsers with memory API
      this.monitorMemoryPressure()
    }
  }

  private performGarbageCollection(): void {
    // Clear old memory usage records
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    
    for (const [key, timestamp] of this.memoryUsage.entries()) {
      if (timestamp < oneHourAgo) {
        this.memoryUsage.delete(key)
      }
    }

    // Check if manual GC is available (development only)
    if (typeof window !== 'undefined' && 'gc' in window && typeof window.gc === 'function') {
      try {
        window.gc()
      } catch (error) {
        // GC not available, ignore
      }
    }
  }

  private monitorMemoryPressure(): void {
    try {
      const checkMemory = () => {
        const memInfo = (performance as any).memory
        if (memInfo) {
          const usedMB = memInfo.usedJSHeapSize / 1024 / 1024
          const limitMB = memInfo.jsHeapSizeLimit / 1024 / 1024
          
          // If memory usage is above 80% of limit, trigger cleanup
          if (usedMB / limitMB > 0.8) {
            this.onMemoryPressure?.()
          }
        }
      }

      // Check memory every 10 seconds
      setInterval(checkMemory, 10000)
    } catch (error) {
      // Memory monitoring not available
    }
  }

  recordMemoryUsage(key: string): void {
    this.memoryUsage.set(key, Date.now())
  }

  destroy(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = null
    }
    this.memoryUsage.clear()
  }
}

// ============================================================================
// Request Deduplication Provider
// ============================================================================

export function DeduplicationProvider({
  children,
  config = {},
  enableRouteInvalidation = true,
  enableDevTools = process.env.NODE_ENV === 'development',
  cleanupOnUnmount = true
}: DeduplicationProviderProps) {
  const router = useRouter()
  const deduplicatorRef = useRef<RequestDeduplicator | null>(null)
  const memoryManagerRef = useRef<MemoryManager | null>(null)
  const [stats, setStats] = useState<DeduplicationStats>({
    totalRequests: 0,
    duplicatesFound: 0,
    duplicatesPrevented: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageDeduplicationRate: 0,
    activeRequests: 0,
    cacheSize: 0
  })
  const [isEnabled, setIsEnabled] = useState(true)
  const statsUpdateInterval = useRef<NodeJS.Timeout | null>(null)

  // Initialize deduplicator
  useEffect(() => {
    if (!deduplicatorRef.current) {
      deduplicatorRef.current = config.keyGenerator
        ? new RequestDeduplicator(config)
        : createQueryKeyBasedDeduplicator(config)
    }

    // Initialize memory manager
    if (!memoryManagerRef.current) {
      memoryManagerRef.current = new MemoryManager(() => {
        // On memory pressure, clear cache
        deduplicatorRef.current?.clearCache()
        console.warn('[Deduplication] Memory pressure detected, clearing cache')
      })
    }

    return () => {
      if (cleanupOnUnmount) {
        deduplicatorRef.current?.destroy()
        memoryManagerRef.current?.destroy()
      }
    }
  }, [config, cleanupOnUnmount])

  // Stats updating
  useEffect(() => {
    const updateStats = () => {
      if (deduplicatorRef.current) {
        setStats(deduplicatorRef.current.getStats())
      }
    }

    // Update stats every second
    statsUpdateInterval.current = setInterval(updateStats, 1000)

    return () => {
      if (statsUpdateInterval.current) {
        clearInterval(statsUpdateInterval.current)
      }
    }
  }, [])

  // Route-based cache invalidation
  useEffect(() => {
    if (!enableRouteInvalidation || !deduplicatorRef.current) return

    const handleRouteChange = () => {
      // Clear cache on route changes to prevent stale data
      deduplicatorRef.current?.clearCache()
      
      if (enableDevTools) {
        console.log('[Deduplication] Route changed, clearing cache')
      }
    }

    // Listen for route changes
    const unsubscribe = router.subscribe('onLoad', handleRouteChange)

    return unsubscribe
  }, [router, enableRouteInvalidation, enableDevTools])

  // Development tools integration
  useEffect(() => {
    if (!enableDevTools || typeof window === 'undefined') return

    // Add global debugging functions
    (window as any).__PROMPTLIANO_DEDUPLICATION__ = {
      getStats: () => deduplicatorRef.current?.getStats(),
      clearCache: () => deduplicatorRef.current?.clearCache(),
      getActiveRequests: () => deduplicatorRef.current?.getActiveRequestKeys(),
      updateConfig: (newConfig: Partial<DeduplicationConfig>) => 
        deduplicatorRef.current?.updateConfig(newConfig),
      deduplicator: deduplicatorRef.current
    }

    return () => {
      delete (window as any).__PROMPTLIANO_DEDUPLICATION__
    }
  }, [enableDevTools])

  // Context value
  const contextValue: DeduplicationContextValue = {
    deduplicator: deduplicatorRef.current!,
    stats,
    isEnabled,
    setEnabled: useCallback((enabled: boolean) => {
      setIsEnabled(enabled)
      // Additional logic could be added here to disable/enable the deduplicator
    }, []),
    clearCache: useCallback(() => {
      deduplicatorRef.current?.clearCache()
      memoryManagerRef.current?.recordMemoryUsage('manual_clear')
    }, []),
    getActiveRequests: useCallback(() => {
      return deduplicatorRef.current?.getActiveRequestKeys() || []
    }, []),
    updateConfig: useCallback((newConfig: Partial<DeduplicationConfig>) => {
      deduplicatorRef.current?.updateConfig(newConfig)
    }, [])
  }

  return (
    <DeduplicationContext.Provider value={contextValue}>
      {children}
    </DeduplicationContext.Provider>
  )
}

// ============================================================================
// Higher-Order Component for Automatic Cleanup
// ============================================================================

interface WithDeduplicationCleanupOptions {
  clearOnUnmount?: boolean
  clearOnPropsChange?: boolean
  watchProps?: string[]
}

/**
 * HOC that provides automatic deduplication cleanup
 */
export function withDeduplicationCleanup<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  options: WithDeduplicationCleanupOptions = {}
) {
  const {
    clearOnUnmount = true,
    clearOnPropsChange = false,
    watchProps = []
  } = options

  return function DeduplicationCleanupWrapper(props: P) {
    const { clearCache } = useDeduplicationContext()
    const prevPropsRef = useRef<P>(props)

    // Clear cache on unmount
    useEffect(() => {
      if (clearOnUnmount) {
        return () => clearCache()
      }
    }, [clearCache, clearOnUnmount])

    // Clear cache on specific prop changes
    useEffect(() => {
      if (!clearOnPropsChange) return

      const hasRelevantChange = watchProps.length > 0
        ? watchProps.some(prop => prevPropsRef.current[prop] !== props[prop])
        : JSON.stringify(prevPropsRef.current) !== JSON.stringify(props)

      if (hasRelevantChange) {
        clearCache()
      }

      prevPropsRef.current = props
    }, [props, clearCache, clearOnPropsChange])

    return <Component {...props} />
  }
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Hook for automatic cleanup based on conditions
 */
export function useDeduplicationCleanup(
  condition: () => boolean,
  dependencies: React.DependencyList = []
) {
  const { clearCache } = useDeduplicationContext()

  useEffect(() => {
    if (condition()) {
      clearCache()
    }
  }, [clearCache, condition, ...dependencies])
}

/**
 * Hook for periodic cache cleanup
 */
export function usePeriodicCleanup(intervalMs: number = 300000) { // 5 minutes default
  const { clearCache } = useDeduplicationContext()

  useEffect(() => {
    const interval = setInterval(() => {
      clearCache()
    }, intervalMs)

    return () => clearInterval(interval)
  }, [clearCache, intervalMs])
}

/**
 * Hook for visibility-based cleanup
 */
export function useVisibilityCleanup() {
  const { clearCache } = useDeduplicationContext()

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Clear cache when tab becomes hidden to free memory
        clearCache()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clearCache])
}

// ============================================================================
// Error Boundary Integration
// ============================================================================

interface DeduplicationErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary that clears deduplication cache on errors
 */
export class DeduplicationErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  DeduplicationErrorBoundaryState
> {
  private deduplicator: RequestDeduplicator | null = null

  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
    this.deduplicator = getRequestDeduplicator()
  }

  static getDerivedStateFromError(error: Error): DeduplicationErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Deduplication Error Boundary] Error caught:', error, errorInfo)
    
    // Clear cache on error to prevent corrupted state
    this.deduplicator?.clearCache()
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-200 rounded bg-red-50">
          <h2 className="text-red-800 font-semibold">Something went wrong</h2>
          <p className="text-red-600 text-sm mt-1">
            The deduplication cache has been cleared. Please try again.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

// ============================================================================
// Performance Monitoring Component
// ============================================================================

interface MemoryMonitorProps {
  onMemoryPressure?: () => void
  warningThreshold?: number // MB
  children: ReactNode
}

export function MemoryMonitor({ 
  children, 
  onMemoryPressure,
  warningThreshold = 100 
}: MemoryMonitorProps) {
  const { clearCache } = useDeduplicationContext()
  const [memoryUsage, setMemoryUsage] = useState<number>(0)

  useEffect(() => {
    const checkMemory = () => {
      if (typeof window !== 'undefined' && 'memory' in performance) {
        const memInfo = (performance as any).memory
        if (memInfo) {
          const usedMB = memInfo.usedJSHeapSize / 1024 / 1024
          setMemoryUsage(usedMB)
          
          if (usedMB > warningThreshold) {
            onMemoryPressure?.()
            clearCache()
          }
        }
      }
    }

    const interval = setInterval(checkMemory, 5000)
    return () => clearInterval(interval)
  }, [onMemoryPressure, warningThreshold, clearCache])

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black text-white text-xs p-2 rounded opacity-50">
          Memory: {memoryUsage.toFixed(1)}MB
        </div>
      )}
    </>
  )
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  DeduplicationContextValue,
  DeduplicationProviderProps,
  WithDeduplicationCleanupOptions
}