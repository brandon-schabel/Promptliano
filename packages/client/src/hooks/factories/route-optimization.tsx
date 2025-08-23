/**
 * Route Optimization System
 * 
 * Advanced route-based code splitting and lazy loading
 * Part of Phase 5 optimization layer
 */

import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Skeleton } from '@promptliano/ui'

// ============================================================================
// Types
// ============================================================================

export interface OptimizedRoute {
  path: string
  component: ComponentType<any>
  preload?: () => Promise<void>
  prefetch?: () => Promise<void>
  errorBoundary?: ComponentType<any>
  loadingFallback?: ReactNode
  meta?: {
    title?: string
    description?: string
    priority?: 'high' | 'medium' | 'low'
    chunkName?: string
  }
}

export interface RouteOptimizationConfig {
  enablePreloading?: boolean
  enablePrefetching?: boolean
  enableIntersectionObserver?: boolean
  preloadDelay?: number
  prefetchDelay?: number
}

export interface RouteMetrics {
  loadTime: number
  renderTime: number
  errorCount: number
  lastAccessed: number
  accessCount: number
}

// ============================================================================
// Route Registry
// ============================================================================

class RouteRegistry {
  private routes = new Map<string, OptimizedRoute>()
  private metrics = new Map<string, RouteMetrics>()
  private preloadedRoutes = new Set<string>()
  private prefetchedData = new Map<string, any>()

  register(route: OptimizedRoute) {
    this.routes.set(route.path, route)
    this.metrics.set(route.path, {
      loadTime: 0,
      renderTime: 0,
      errorCount: 0,
      lastAccessed: 0,
      accessCount: 0
    })
  }

  get(path: string): OptimizedRoute | undefined {
    return this.routes.get(path)
  }

  getAll(): OptimizedRoute[] {
    return Array.from(this.routes.values())
  }

  isPreloaded(path: string): boolean {
    return this.preloadedRoutes.has(path)
  }

  markPreloaded(path: string) {
    this.preloadedRoutes.add(path)
  }

  setPrefetchedData(path: string, data: any) {
    this.prefetchedData.set(path, data)
  }

  getPrefetchedData(path: string): any {
    return this.prefetchedData.get(path)
  }

  updateMetrics(path: string, updates: Partial<RouteMetrics>) {
    const current = this.metrics.get(path) || {
      loadTime: 0,
      renderTime: 0,
      errorCount: 0,
      lastAccessed: 0,
      accessCount: 0
    }
    this.metrics.set(path, { ...current, ...updates })
  }

  getMetrics(path: string): RouteMetrics | undefined {
    return this.metrics.get(path)
  }

  getTopRoutes(limit: number = 5): string[] {
    return Array.from(this.metrics.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([path]) => path)
  }
}

const routeRegistry = new RouteRegistry()

// ============================================================================
// Lazy Loading Factory
// ============================================================================

export function createLazyRoute<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    fallback?: ReactNode
    errorBoundary?: ComponentType<any>
    chunkName?: string
    preload?: boolean
  }
): ComponentType<React.ComponentProps<T>> {
  const { 
    fallback = <DefaultLoadingFallback />,
    errorBoundary: ErrorBoundary,
    chunkName,
    preload = false
  } = options || {}

  // Create lazy component with webpack magic comments
  const LazyComponent = lazy(() => {
    const startTime = performance.now()
    
    return importFn().then(module => {
      const loadTime = performance.now() - startTime
      
      // Track load metrics
      if (chunkName) {
        console.log(`[RouteOptimization] Loaded chunk "${chunkName}" in ${loadTime.toFixed(2)}ms`)
      }
      
      return module
    })
  })

  // Preload function
  const preloadComponent = () => importFn()

  // Auto-preload if requested
  if (preload && typeof window !== 'undefined') {
    // Preload after initial render
    requestIdleCallback(() => {
      preloadComponent()
    }, { timeout: 5000 })
  }

  // Wrapped component with suspense and error boundary
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    const content = (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    )

    if (ErrorBoundary) {
      return <ErrorBoundary>{content}</ErrorBoundary>
    }

    return content
  }

  // Attach preload function
  ;(WrappedComponent as any).preload = preloadComponent

  return WrappedComponent
}

// ============================================================================
// Route Optimization Factory
// ============================================================================

export function createOptimizedRoute(
  path: string,
  importFn: () => Promise<{ default: ComponentType<any> }>,
  options?: {
    loadingFallback?: ReactNode
    errorBoundary?: ComponentType<any>
    prefetchData?: () => Promise<any>
    meta?: OptimizedRoute['meta']
  }
): OptimizedRoute {
  const {
    loadingFallback = <DefaultLoadingFallback />,
    errorBoundary,
    prefetchData,
    meta
  } = options || {}

  // Create lazy component
  const component = createLazyRoute(importFn, {
    fallback: loadingFallback,
    errorBoundary,
    chunkName: meta?.chunkName || path
  })

  // Create route object
  const route: OptimizedRoute = {
    path,
    component,
    loadingFallback,
    errorBoundary,
    meta,
    
    // Preload the component code
    preload: async () => {
      if (!routeRegistry.isPreloaded(path)) {
        await (component as any).preload?.()
        routeRegistry.markPreloaded(path)
      }
    },
    
    // Prefetch the route data
    prefetch: async () => {
      if (prefetchData) {
        const data = await prefetchData()
        routeRegistry.setPrefetchedData(path, data)
      }
    }
  }

  // Register route
  routeRegistry.register(route)

  return route
}

// ============================================================================
// Route Preloader
// ============================================================================

export class RoutePreloader {
  private observer: IntersectionObserver | null = null
  private preloadQueue: string[] = []
  private isPreloading = false

  constructor(private config: RouteOptimizationConfig = {}) {
    if (config.enableIntersectionObserver && typeof window !== 'undefined') {
      this.setupIntersectionObserver()
    }
  }

  private setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const path = entry.target.getAttribute('data-preload-route')
            if (path) {
              this.preloadRoute(path)
            }
          }
        })
      },
      { rootMargin: '50px' }
    )
  }

  observe(element: Element, path: string) {
    if (this.observer) {
      element.setAttribute('data-preload-route', path)
      this.observer.observe(element)
    }
  }

  async preloadRoute(path: string) {
    const route = routeRegistry.get(path)
    
    if (!route || routeRegistry.isPreloaded(path)) {
      return
    }

    // Add to queue
    this.preloadQueue.push(path)
    
    // Process queue
    if (!this.isPreloading) {
      this.processQueue()
    }
  }

  private async processQueue() {
    this.isPreloading = true

    while (this.preloadQueue.length > 0) {
      const path = this.preloadQueue.shift()!
      const route = routeRegistry.get(path)
      
      if (route && !routeRegistry.isPreloaded(path)) {
        try {
          await route.preload?.()
          
          // Delay between preloads to avoid blocking
          if (this.config.preloadDelay) {
            await new Promise(resolve => setTimeout(resolve, this.config.preloadDelay))
          }
        } catch (error) {
          console.error(`[RoutePreloader] Failed to preload route ${path}:`, error)
        }
      }
    }

    this.isPreloading = false
  }

  async preloadAdjacentRoutes(currentPath: string) {
    const allRoutes = routeRegistry.getAll()
    
    // Find routes that are likely to be visited next
    const adjacentRoutes = allRoutes.filter(route => {
      if (route.path === currentPath) return false
      if (routeRegistry.isPreloaded(route.path)) return false
      
      // Simple heuristic: routes with similar paths
      const currentParts = currentPath.split('/')
      const routeParts = route.path.split('/')
      
      // Count common segments
      let commonSegments = 0
      for (let i = 0; i < Math.min(currentParts.length, routeParts.length); i++) {
        if (currentParts[i] === routeParts[i]) {
          commonSegments++
        }
      }
      
      // Consider adjacent if they share most segments
      return commonSegments >= Math.max(currentParts.length, routeParts.length) - 2
    })

    // Preload adjacent routes
    for (const route of adjacentRoutes) {
      await this.preloadRoute(route.path)
    }
  }

  async preloadPriorityRoutes() {
    const allRoutes = routeRegistry.getAll()
    
    // Group by priority
    const highPriority = allRoutes.filter(r => r.meta?.priority === 'high')
    const mediumPriority = allRoutes.filter(r => r.meta?.priority === 'medium')
    
    // Preload high priority first
    for (const route of highPriority) {
      await this.preloadRoute(route.path)
    }
    
    // Then medium priority
    for (const route of mediumPriority) {
      await this.preloadRoute(route.path)
    }
  }

  async preloadFrequentRoutes() {
    const topRoutes = routeRegistry.getTopRoutes(5)
    
    for (const path of topRoutes) {
      await this.preloadRoute(path)
    }
  }

  destroy() {
    this.observer?.disconnect()
    this.preloadQueue = []
  }
}

// ============================================================================
// Route Prefetcher
// ============================================================================

export class RoutePrefetcher {
  private prefetchQueue: string[] = []
  private isPrefetching = false

  constructor(private config: RouteOptimizationConfig = {}) {}

  async prefetchRoute(path: string) {
    const route = routeRegistry.get(path)
    
    if (!route || !route.prefetch) {
      return
    }

    // Check if already has data
    if (routeRegistry.getPrefetchedData(path)) {
      return
    }

    // Add to queue
    this.prefetchQueue.push(path)
    
    // Process queue
    if (!this.isPrefetching) {
      this.processQueue()
    }
  }

  private async processQueue() {
    this.isPrefetching = true

    while (this.prefetchQueue.length > 0) {
      const path = this.prefetchQueue.shift()!
      const route = routeRegistry.get(path)
      
      if (route?.prefetch && !routeRegistry.getPrefetchedData(path)) {
        try {
          await route.prefetch()
          
          // Delay between prefetches
          if (this.config.prefetchDelay) {
            await new Promise(resolve => setTimeout(resolve, this.config.prefetchDelay))
          }
        } catch (error) {
          console.error(`[RoutePrefetcher] Failed to prefetch route ${path}:`, error)
        }
      }
    }

    this.isPrefetching = false
  }

  getPrefetchedData(path: string): any {
    return routeRegistry.getPrefetchedData(path)
  }

  clearPrefetchedData(path?: string) {
    if (path) {
      routeRegistry.setPrefetchedData(path, undefined)
    } else {
      // Clear all
      routeRegistry.getAll().forEach(route => {
        routeRegistry.setPrefetchedData(route.path, undefined)
      })
    }
  }
}

// ============================================================================
// Default Loading Fallbacks
// ============================================================================

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  )
}

export function PageLoadingFallback() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-1/3 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  )
}

export function TableLoadingFallback() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border rounded-lg p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Route Optimization Hook
// ============================================================================

export function useRouteOptimization(config?: RouteOptimizationConfig) {
  const preloader = new RoutePreloader(config)
  const prefetcher = new RoutePrefetcher(config)

  return {
    preloadRoute: (path: string) => preloader.preloadRoute(path),
    preloadAdjacentRoutes: (currentPath: string) => preloader.preloadAdjacentRoutes(currentPath),
    preloadPriorityRoutes: () => preloader.preloadPriorityRoutes(),
    preloadFrequentRoutes: () => preloader.preloadFrequentRoutes(),
    
    prefetchRoute: (path: string) => prefetcher.prefetchRoute(path),
    getPrefetchedData: (path: string) => prefetcher.getPrefetchedData(path),
    clearPrefetchedData: (path?: string) => prefetcher.clearPrefetchedData(path),
    
    getRouteMetrics: (path: string) => routeRegistry.getMetrics(path),
    getTopRoutes: (limit?: number) => routeRegistry.getTopRoutes(limit),
    
    observeElement: (element: Element, path: string) => preloader.observe(element, path),
    
    destroy: () => {
      preloader.destroy()
    }
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Example of creating optimized routes
 * 
 * ```typescript
 * // Define routes with optimization
 * const routes = [
 *   createOptimizedRoute(
 *     '/dashboard',
 *     () => import('./pages/Dashboard'),
 *     {
 *       meta: { priority: 'high', chunkName: 'dashboard' },
 *       prefetchData: async () => {
 *         const response = await fetch('/api/dashboard')
 *         return response.json()
 *       }
 *     }
 *   ),
 *   createOptimizedRoute(
 *     '/projects/:id',
 *     () => import('./pages/ProjectDetail'),
 *     {
 *       loadingFallback: <PageLoadingFallback />,
 *       meta: { priority: 'medium', chunkName: 'project-detail' }
 *     }
 *   ),
 *   createOptimizedRoute(
 *     '/settings',
 *     () => import('./pages/Settings'),
 *     {
 *       meta: { priority: 'low', chunkName: 'settings' }
 *     }
 *   )
 * ]
 * 
 * // In your app component
 * function App() {
 *   const routeOptimization = useRouteOptimization({
 *     enablePreloading: true,
 *     enablePrefetching: true,
 *     preloadDelay: 100
 *   })
 * 
 *   useEffect(() => {
 *     // Preload high priority routes
 *     routeOptimization.preloadPriorityRoutes()
 *     
 *     // Preload frequently accessed routes
 *     routeOptimization.preloadFrequentRoutes()
 *   }, [])
 * 
 *   return <RouterProvider routes={routes} />
 * }
 * ```
 */