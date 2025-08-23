/**
 * Prefetch Factory
 * Intelligent data prefetching for improved perceived performance
 */

import { type QueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'

// ============================================================================
// Types
// ============================================================================

export type PrefetchStrategy = 'hover' | 'visible' | 'route' | 'idle' | 'manual'

export interface PrefetchConfig {
  queryClient: QueryClient
  strategy?: PrefetchStrategy
  delay?: number
  staleTime?: number
  enableLogging?: boolean
}

export interface PrefetchRule {
  trigger: string | RegExp | ((path: string) => boolean)
  prefetch: (params?: any) => Promise<any> | Promise<any>[]
  priority?: 'high' | 'normal' | 'low'
}

// ============================================================================
// Main Factory
// ============================================================================

export function createPrefetcher(config: PrefetchConfig) {
  const {
    queryClient,
    strategy = 'hover',
    delay = 200,
    staleTime = 5 * 60 * 1000,
    enableLogging = false
  } = config

  const log = (message: string, ...args: any[]) => {
    if (enableLogging) {
      console.log(`[Prefetch] ${message}`, ...args)
    }
  }

  // ============================================================================
  // Hover Prefetch
  // ============================================================================

  function createHoverPrefetch<T = any>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>
  ) {
    let timeoutId: NodeJS.Timeout | null = null

    return {
      onMouseEnter: () => {
        timeoutId = setTimeout(() => {
          log('Hover prefetch triggered for:', queryKey)
          queryClient.prefetchQuery({
            queryKey,
            queryFn,
            staleTime
          })
        }, delay)
      },
      onMouseLeave: () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
    }
  }

  // ============================================================================
  // Visibility Prefetch
  // ============================================================================

  function createVisibilityPrefetch<T = any>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    options?: IntersectionObserverInit
  ) {
    return (element: HTMLElement | null) => {
      if (!element) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              log('Visibility prefetch triggered for:', queryKey)
              queryClient.prefetchQuery({
                queryKey,
                queryFn,
                staleTime
              })
              observer.disconnect()
            }
          })
        },
        {
          rootMargin: '50px',
          threshold: 0.01,
          ...options
        }
      )

      observer.observe(element)

      return () => observer.disconnect()
    }
  }

  // ============================================================================
  // Route Prefetch
  // ============================================================================

  function createRoutePrefetch(rules: PrefetchRule[]) {
    const activePrefetches = new Set<string>()

    return async (targetPath: string) => {
      // Avoid duplicate prefetches
      if (activePrefetches.has(targetPath)) {
        log('Skipping duplicate prefetch for:', targetPath)
        return
      }

      activePrefetches.add(targetPath)

      try {
        for (const rule of rules) {
          const shouldPrefetch = 
            typeof rule.trigger === 'string' 
              ? targetPath === rule.trigger
              : typeof rule.trigger === 'function'
              ? rule.trigger(targetPath)
              : rule.trigger.test(targetPath)

          if (shouldPrefetch) {
            log('Route prefetch triggered for:', targetPath, 'with priority:', rule.priority)
            
            const prefetchPromises = Array.isArray(rule.prefetch)
              ? rule.prefetch
              : [rule.prefetch()]

            // Execute based on priority
            if (rule.priority === 'high') {
              await Promise.all(prefetchPromises)
            } else if (rule.priority === 'low') {
              // Use requestIdleCallback for low priority
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => {
                  Promise.all(prefetchPromises)
                })
              } else {
                setTimeout(() => {
                  Promise.all(prefetchPromises)
                }, 1000)
              }
            } else {
              // Normal priority - fire and forget
              Promise.all(prefetchPromises)
            }
          }
        }
      } finally {
        // Remove from active set after a delay
        setTimeout(() => {
          activePrefetches.delete(targetPath)
        }, 5000)
      }
    }
  }

  // ============================================================================
  // Idle Prefetch
  // ============================================================================

  function createIdlePrefetch(
    prefetchQueue: Array<{
      queryKey: readonly unknown[]
      queryFn: () => Promise<any>
      priority?: number
    }>
  ) {
    let idleCallbackId: number | null = null

    const executePrefetch = () => {
      if (prefetchQueue.length === 0) return

      // Sort by priority
      const sorted = [...prefetchQueue].sort((a, b) => 
        (b.priority || 0) - (a.priority || 0)
      )

      const batch = sorted.slice(0, 3) // Prefetch up to 3 at a time

      log('Idle prefetch executing batch of', batch.length)

      batch.forEach(({ queryKey, queryFn }) => {
        queryClient.prefetchQuery({
          queryKey,
          queryFn,
          staleTime
        })
      })

      // Remove prefetched items
      prefetchQueue.splice(0, batch.length)

      // Schedule next batch if more items
      if (prefetchQueue.length > 0) {
        scheduleIdlePrefetch()
      }
    }

    const scheduleIdlePrefetch = () => {
      if ('requestIdleCallback' in window) {
        idleCallbackId = window.requestIdleCallback(executePrefetch, {
          timeout: 2000
        })
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(executePrefetch, 100)
      }
    }

    return {
      start: scheduleIdlePrefetch,
      stop: () => {
        if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleCallbackId)
        }
      },
      add: (item: typeof prefetchQueue[0]) => {
        prefetchQueue.push(item)
        if (prefetchQueue.length === 1) {
          scheduleIdlePrefetch()
        }
      }
    }
  }

  // ============================================================================
  // Waterfall Prefetch
  // ============================================================================

  async function waterfallPrefetch(
    prefetches: Array<() => Promise<any>>,
    delayBetween: number = 100
  ) {
    log('Starting waterfall prefetch with', prefetches.length, 'items')

    for (let i = 0; i < prefetches.length; i++) {
      await prefetches[i]()
      
      if (i < prefetches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetween))
      }
    }

    log('Waterfall prefetch complete')
  }

  // ============================================================================
  // Predictive Prefetch
  // ============================================================================

  function createPredictivePrefetch(
    predictions: Map<string, string[]>
  ) {
    const history: string[] = []
    const maxHistorySize = 10

    return {
      recordNavigation: (path: string) => {
        history.push(path)
        if (history.length > maxHistorySize) {
          history.shift()
        }

        // Predict next likely navigation
        const lastTwo = history.slice(-2).join(' -> ')
        const predicted = predictions.get(lastTwo)

        if (predicted && predicted.length > 0) {
          log('Predictive prefetch for paths:', predicted)
          // Prefetch predicted paths
          // Implementation depends on your routing setup
        }
      },

      updatePredictions: (from: string, to: string) => {
        const key = from + ' -> ' + to
        const current = predictions.get(from) || []
        if (!current.includes(to)) {
          current.push(to)
          predictions.set(from, current)
        }
      }
    }
  }

  // ============================================================================
  // Batch Prefetch
  // ============================================================================

  function batchPrefetch(
    items: Array<{
      queryKey: readonly unknown[]
      queryFn: () => Promise<any>
    }>,
    batchSize: number = 3
  ) {
    const batches: typeof items[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    log('Batch prefetch with', batches.length, 'batches')

    return Promise.all(
      batches.map((batch, index) =>
        Promise.all(
          batch.map(({ queryKey, queryFn }) =>
            queryClient.prefetchQuery({
              queryKey,
              queryFn,
              staleTime
            })
          )
        ).then(() => {
          log(`Batch ${index + 1}/${batches.length} complete`)
        })
      )
    )
  }

  return {
    createHoverPrefetch,
    createVisibilityPrefetch,
    createRoutePrefetch,
    createIdlePrefetch,
    createPredictivePrefetch,
    waterfallPrefetch,
    batchPrefetch,

    // Direct prefetch methods
    prefetch: <T = any>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime
      }),

    prefetchInfinite: <T = any>(
      queryKey: readonly unknown[],
      queryFn: ({ pageParam }: { pageParam: number }) => Promise<T>
    ) =>
      queryClient.prefetchInfiniteQuery({
        queryKey,
        queryFn,
        staleTime,
        initialPageParam: 1
      })
  }
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook for hover-based prefetching
 */
export function useHoverPrefetch<T = any>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: { delay?: number; enabled?: boolean }
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { delay = 200, enabled = true } = options || {}

  const handleMouseEnter = useCallback(() => {
    if (!enabled) return

    timeoutRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn
      })
    }, delay)
  }, [queryKey, queryFn, delay, enabled])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave
  }
}

/**
 * Hook for route-based prefetching
 */
export function useRoutePrefetch(rules: PrefetchRule[]) {
  const router = useRouter()
  const prefetcherRef = useRef<ReturnType<typeof createRoutePrefetch> | null>(null)

  useEffect(() => {
    const prefetcher = createRoutePrefetch(rules)
    prefetcherRef.current = prefetcher

    // You can set up route listeners here
    // Example: router.subscribe((location) => prefetcher(location.pathname))

    return () => {
      prefetcherRef.current = null
    }
  }, [rules])

  return useCallback((path: string) => {
    prefetcherRef.current?.(path)
  }, [])
}

// Declare queryClient (should be imported from your app setup)
declare const queryClient: QueryClient