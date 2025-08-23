import type { Context } from 'hono'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorHandler,
  type CacheInterceptorConfig,
  InterceptorError
} from '../types'

/**
 * Cache entry structure
 */
interface CacheEntry {
  data: any
  timestamp: number
  etag: string
  headers?: Record<string, string>
}

/**
 * Simple in-memory cache implementation
 */
class MemoryCache {
  private store = new Map<string, CacheEntry>()
  private maxSize: number

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  get(key: string): CacheEntry | undefined {
    return this.store.get(key)
  }

  set(key: string, value: CacheEntry): void {
    // Simple LRU eviction: remove oldest entries if at max size
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value
      if (firstKey) {
        this.store.delete(firstKey)
      }
    }
    this.store.set(key, value)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  has(key: string): boolean {
    return this.store.has(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

/**
 * Generate cache key from request
 */
function generateCacheKey(context: Context, includeQuery: boolean = false): string {
  const method = context.req.method
  const path = context.req.path
  
  if (!includeQuery) {
    return `${method}:${path}`
  }

  // Parse and sort query parameters for consistent keys
  const url = new URL(context.req.url, 'http://localhost')
  const sortedParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return sortedParams ? `${method}:${path}?${sortedParams}` : `${method}:${path}`
}

/**
 * Generate ETag for response data
 */
function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  // Simple hash-like ETag generation (in production, use proper hashing)
  const hash = Array.from(content).reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff
  }, 0)
  return `"${Math.abs(hash).toString(36)}"`
}

/**
 * Check if cache entry is expired
 */
function isExpired(entry: CacheEntry, ttl: number): boolean {
  return (Date.now() - entry.timestamp) > ttl
}

/**
 * Check if request should bypass cache
 */
function shouldBypassCache(context: Context): boolean {
  // Check for refresh parameter
  const refresh = context.req.query('refresh')
  if (refresh === 'true' || refresh === '1') {
    return true
  }

  // Check for Cache-Control header
  const cacheControl = context.req.header('cache-control')
  if (cacheControl?.includes('no-cache') || cacheControl?.includes('no-store')) {
    return true
  }

  return false
}

/**
 * Check if method is cacheable
 */
function isCacheableMethod(method: string, allowedMethods: string[]): boolean {
  return allowedMethods.includes(method.toUpperCase())
}

/**
 * Check if response is cacheable
 */
function isCacheableResponse(status: number): boolean {
  // Only cache successful responses
  return status >= 200 && status < 300
}

/**
 * Create cache interceptor handler
 */
function createCacheHandler(config: CacheInterceptorConfig): InterceptorHandler {
  const cache = config.cache || new MemoryCache(config.maxSize || 1000)

  return async (context: Context, interceptorContext: InterceptorContext, next: () => Promise<void>): Promise<void> => {
    const startTime = Date.now()
    
    try {
      // Skip if caching is disabled
      if (!config.enabled) {
        await next()
        return
      }

      const method = context.req.method
      const allowedMethods = config.allowedMethods || ['GET', 'HEAD']

      // Skip non-cacheable methods
      if (!isCacheableMethod(method, allowedMethods)) {
        await next()
        return
      }

      // Generate cache key
      const cacheKey = generateCacheKey(context, config.includeQuery)
      interceptorContext.cacheKeys.push(cacheKey)

      // Check for cache bypass conditions
      if (shouldBypassCache(context)) {
        context.header('X-Cache', 'BYPASS')
        await next()
        return
      }

      try {
        // Try to get from cache
        const cached = cache.get(cacheKey)

        if (cached) {
          // Check if entry is expired
          const ttl = config.defaultTtl || 300000 // 5 minutes default
          if (isExpired(cached, ttl)) {
            cache.delete(cacheKey)
            context.header('X-Cache', 'EXPIRED')
          } else {
            // Check If-None-Match header for 304 responses
            const ifNoneMatch = context.req.header('if-none-match')
            if (ifNoneMatch && ifNoneMatch === cached.etag) {
              context.status(304)
              context.header('ETag', cached.etag)
              context.header('X-Cache', 'HIT')
              return
            }

            // Cache hit - return cached response
            context.header('ETag', cached.etag)
            context.header('X-Cache', 'HIT')
            
            // Set any cached headers
            if (cached.headers) {
              Object.entries(cached.headers).forEach(([key, value]) => {
                context.header(key as any, value as string)
              })
            }

            context.json(cached.data)
            return
          }
        } else {
          context.header('X-Cache', 'MISS')
        }
      } catch (cacheError) {
        // Log cache error but continue
        console.warn('Cache read error:', cacheError)
        context.header('X-Cache', 'ERROR')
      }

      // Execute next interceptor/handler
      await next()

      // Cache the response if successful
      try {
        const status = context.res.status
        if (isCacheableResponse(status)) {
          // Get response data (this is simplified - in real implementation,
          // we'd need to intercept the response stream)
          const responseData = context.get('responseData')
          
          if (responseData) {
            const etag = generateETag(responseData)
            const cacheEntry: CacheEntry = {
              data: responseData,
              timestamp: Date.now(),
              etag
            }

            cache.set(cacheKey, cacheEntry)
            context.header('ETag', etag)
          }
        }
      } catch (cacheError) {
        // Log cache write error but don't fail the request
        console.warn('Cache write error:', cacheError)
      }

    } catch (error) {
      // Record timing even on error
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['cache'] = duration

      throw error
    } finally {
      // Record timing
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['cache'] = duration
    }
  }
}

/**
 * Create cache interceptor with configuration
 */
export function createCacheInterceptor(config: Partial<CacheInterceptorConfig> = {}): Interceptor {
  const defaultConfig: CacheInterceptorConfig = {
    enabled: true,
    defaultTtl: 300000, // 5 minutes
    maxSize: 1000,
    allowedMethods: ['GET', 'HEAD'],
    includeQuery: false,
    ...config
  }

  return {
    name: 'cache-interceptor',
    order: 30, // Run after auth and rate limiting
    phase: 'request',
    enabled: true,
    handler: createCacheHandler(defaultConfig),
    config: defaultConfig,
    tags: ['cache', 'performance'],
    routes: [], // Apply to all routes by default
    methods: defaultConfig.allowedMethods || ['GET', 'HEAD']
  }
}

/**
 * Pre-configured cache interceptor for development
 */
export const devCacheInterceptor = createCacheInterceptor({
  enabled: true,
  defaultTtl: 60000, // 1 minute for development
  maxSize: 500,
  includeQuery: true
})

/**
 * Pre-configured cache interceptor for production
 */
export const prodCacheInterceptor = createCacheInterceptor({
  enabled: true,
  defaultTtl: 900000, // 15 minutes
  maxSize: 5000,
  includeQuery: true
})

/**
 * Cache interceptor with aggressive caching
 */
export const aggressiveCacheInterceptor = createCacheInterceptor({
  enabled: true,
  defaultTtl: 3600000, // 1 hour
  maxSize: 10000,
  allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
  includeQuery: true
})

/**
 * Utility function to create cache key
 */
export function createCacheKey(
  method: string,
  path: string,
  query?: Record<string, string>
): string {
  if (!query || Object.keys(query).length === 0) {
    return `${method}:${path}`
  }

  const sortedParams = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return `${method}:${path}?${sortedParams}`
}

/**
 * Utility function to invalidate cache entries by pattern
 */
export function invalidateCachePattern(
  cache: any,
  pattern: string
): number {
  if (!cache || typeof cache.delete !== 'function') {
    return 0
  }

  let deletedCount = 0
  const regex = new RegExp(pattern.replace('*', '.*'))

  // Note: This is a simplified implementation
  // In a real cache implementation, you'd need to iterate over keys
  try {
    if (typeof cache.keys === 'function') {
      const keys = Array.from(cache.keys())
      for (const key of keys) {
        if (typeof key === 'string' && regex.test(key)) {
          cache.delete(key)
          deletedCount++
        }
      }
    }
  } catch (error) {
    console.warn('Cache invalidation error:', error)
  }

  return deletedCount
}

/**
 * Utility function to get cache statistics
 */
export function getCacheStats(cache: any): {
  size: number
  hitRate?: number
  maxSize?: number
} {
  if (!cache) {
    return { size: 0 }
  }

  return {
    size: typeof cache.size === 'function' ? cache.size() : 0,
    maxSize: cache.maxSize || undefined
  }
}

export { MemoryCache }