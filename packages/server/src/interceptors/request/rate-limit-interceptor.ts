import type { Context } from 'hono'
import { ErrorFactory } from '@promptliano/shared'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorHandler,
  type RateLimitInterceptorConfig,
  InterceptorError
} from '../types'

/**
 * Rate limit entry structure
 */
interface RateLimitEntry {
  count: number
  resetTime: number
  firstRequestTime: number
}

/**
 * Simple in-memory rate limit store
 */
class MemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval?: NodeJS.Timeout

  constructor(cleanupIntervalMs: number = 300000) { // 5 minutes default
    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup()
      }, cleanupIntervalMs)
    }
  }

  async get(key: string): Promise<RateLimitEntry | undefined> {
    return this.store.get(key)
  }

  async set(key: string, value: RateLimitEntry): Promise<void> {
    this.store.set(key, value)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    // Collect keys to delete first - using Array.from to avoid iterator issues
    const entries = Array.from(this.store.entries())
    for (const [key, entry] of entries) {
      if (entry.resetTime < now) {
        keysToDelete.push(key)
      }
    }
    
    // Delete keys outside of iteration
    for (const key of keysToDelete) {
      this.store.delete(key)
    }
  }

  size(): number {
    return this.store.size
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(context: Context, interceptorContext: InterceptorContext): string {
  return `ip:${interceptorContext.security.ip}`
}

/**
 * Pattern matcher for route patterns
 */
function matchesRoutePattern(pattern: string, path: string): boolean {
  const regexPattern = pattern
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*')
    .replace(/\?/g, '.')
  
  const regex = new RegExp('^' + regexPattern + '$')
  return regex.test(path)
}

/**
 * Get the applicable rate limit for the current request
 */
function getApplicableLimit(
  context: Context,
  interceptorContext: InterceptorContext,
  config: RateLimitInterceptorConfig
): number {
  const path = context.req.path

  // Check per-route limits first
  if (config.perRouteLimit) {
    for (const [pattern, limit] of Object.entries(config.perRouteLimit)) {
      if (matchesRoutePattern(pattern, path)) {
        return limit
      }
    }
  }

  // Check per-user limit if user is authenticated
  if (config.perUserLimit && interceptorContext.user) {
    return config.perUserLimit
  }

  // Use default limit
  return config.max
}

/**
 * Check if request should be skipped
 */
function shouldSkipRequest(
  context: Context,
  interceptorContext: InterceptorContext,
  config: RateLimitInterceptorConfig
): boolean {
  // Custom skip function
  if (config.skip && config.skip(context, interceptorContext)) {
    return true
  }

  return false
}

/**
 * Calculate retry after time in seconds
 */
function calculateRetryAfter(resetTime: number): number {
  return Math.ceil((resetTime - Date.now()) / 1000)
}

/**
 * Create rate limit interceptor handler
 */
function createRateLimitHandler(config: RateLimitInterceptorConfig): InterceptorHandler {
  const store = config.store || new MemoryRateLimitStore(config.cleanupInterval)
  const keyGenerator = config.keyGenerator || defaultKeyGenerator

  return async (context: Context, interceptorContext: InterceptorContext, next: () => Promise<void>) => {
    const startTime = Date.now()
    
    try {
      // Check if request should be skipped
      if (shouldSkipRequest(context, interceptorContext, config)) {
        context.header('X-RateLimit-Skip', 'true')
        await next()
        return
      }

      // Generate rate limit key
      const key = keyGenerator(context, interceptorContext)
      interceptorContext.security.rateLimitKeys.push(key)

      // Get applicable limit for this request
      const limit = getApplicableLimit(context, interceptorContext, config)
      const windowMs = config.windowMs
      const now = Date.now()

      try {
        // Get current rate limit state
        let entry = await store.get(key)

        // Create new entry or reset if window expired
        if (!entry || entry.resetTime < now) {
          entry = {
            count: 0,
            resetTime: now + windowMs,
            firstRequestTime: now
          }
        }

        // Check if limit is exceeded
        if (entry.count >= limit) {
          const retryAfter = calculateRetryAfter(entry.resetTime)

          // Set rate limit headers
          context.header('X-RateLimit-Limit', limit.toString())
          context.header('X-RateLimit-Remaining', '0')
          context.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())
          context.header('Retry-After', retryAfter.toString())

          // Call custom handler if provided
          if (config.onLimitReached) {
            return await config.onLimitReached(context, interceptorContext)
          }

          // Default rate limit exceeded response
          context.status(429)
          return context.json({
            success: false,
            error: {
              message: 'Too many requests',
              code: 'RATE_LIMIT_EXCEEDED',
              details: {
                limit,
                windowMs,
                retryAfter
              }
            }
          })
        }

        // Execute next interceptor/handler
        let error: Error | undefined
        try {
          await next()
        } catch (e) {
          error = e as Error
          throw e
        } finally {
          // Increment counter based on skip conditions
          let shouldIncrement = true

          if (config.skipSuccessfulRequests && context.res.status >= 200 && context.res.status < 400 && !error) {
            shouldIncrement = false
          }

          if (config.skipFailedRequests && (context.res.status >= 400 || error)) {
            shouldIncrement = false
          }

          if (shouldIncrement) {
            entry.count++
            await store.set(key, entry)
          }

          // Set rate limit headers
          const remaining = Math.max(0, limit - entry.count)
          context.header('X-RateLimit-Limit', limit.toString())
          context.header('X-RateLimit-Remaining', remaining.toString())
          context.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())
        }

      } catch (storeError) {
        // Log store error but continue request
        console.warn('Rate limit store error:', storeError)
        await next()
      }

    } catch (error) {
      // Record timing even on error
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['rate-limit'] = duration

      throw error
    } finally {
      // Record timing
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['rate-limit'] = duration
    }
  }
}

/**
 * Create rate limit interceptor with configuration
 */
export function createRateLimitInterceptor(config: Partial<RateLimitInterceptorConfig> = {}): Interceptor {
  const defaultConfig: RateLimitInterceptorConfig = {
    windowMs: 900000, // 15 minutes
    max: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    ...config
  }

  return {
    name: 'rate-limit-interceptor',
    order: 5, // Run very early, before auth and other interceptors
    phase: 'request',
    enabled: true,
    handler: createRateLimitHandler(defaultConfig),
    config: defaultConfig,
    tags: ['rate-limit', 'security'],
    routes: [], // Apply to all routes by default
    methods: [] // Apply to all methods by default
  }
}

/**
 * Pre-configured rate limiter for general API usage
 */
export const apiRateLimiter = createRateLimitInterceptor({
  windowMs: 900000, // 15 minutes
  max: 1000,
  skipSuccessfulRequests: false
})

/**
 * Pre-configured rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimitInterceptor({
  windowMs: 900000, // 15 minutes
  max: 5, // Very strict for auth attempts
  skipSuccessfulRequests: true, // Only count failed auth attempts
  perRouteLimit: {
    '/api/auth/login': 5,
    '/api/auth/register': 3,
    '/api/auth/reset-password': 3
  }
})

/**
 * Pre-configured rate limiter for AI/expensive operations
 */
export const aiRateLimiter = createRateLimitInterceptor({
  windowMs: 600000, // 10 minutes
  max: 50,
  perUserLimit: 100, // Higher limit for authenticated users
  perRouteLimit: {
    '/api/ai/*': 20,
    '/api/summarize/*': 10,
    '/api/analyze/*': 15
  }
})

/**
 * Pre-configured rate limiter for file operations
 */
export const fileRateLimiter = createRateLimitInterceptor({
  windowMs: 300000, // 5 minutes
  max: 200,
  perRouteLimit: {
    '/api/files/upload': 10,
    '/api/files/*/content': 100
  }
})

/**
 * Utility function to create user-aware key generator
 */
export function createUserAwareKeyGenerator(
  fallbackToIP: boolean = true
): (context: Context, interceptorContext: InterceptorContext) => string {
  return (context: Context, interceptorContext: InterceptorContext) => {
    if (interceptorContext.user && interceptorContext.user.id) {
      return `user:${interceptorContext.user.id}`
    }
    
    if (fallbackToIP) {
      return `ip:${interceptorContext.security.ip}`
    }
    
    // Use a generic key if no user and no IP fallback
    return 'anonymous'
  }
}

/**
 * Utility function to create method-aware key generator
 */
export function createMethodAwareKeyGenerator(): (context: Context, interceptorContext: InterceptorContext) => string {
  return (context: Context, interceptorContext: InterceptorContext) => {
    const baseKey = interceptorContext.user 
      ? `user:${interceptorContext.user.id}`
      : `ip:${interceptorContext.security.ip}`
    
    return `${context.req.method}:${baseKey}`
  }
}

/**
 * Utility function to create path-aware key generator
 */
export function createPathAwareKeyGenerator(
  pathPattern?: string
): (context: Context, interceptorContext: InterceptorContext) => string {
  return (context: Context, interceptorContext: InterceptorContext) => {
    const baseKey = interceptorContext.user 
      ? `user:${interceptorContext.user.id}`
      : `ip:${interceptorContext.security.ip}`
    
    let pathKey = context.req.path
    if (pathPattern) {
      // Normalize path based on pattern (e.g., /api/projects/:id -> /api/projects/*) 
      pathKey = pathPattern
    }
    
    return `${pathKey}:${baseKey}`
  }
}

/**
 * Utility function to get rate limit statistics
 */
export function getRateLimitStats(store: any): {
  totalKeys: number
  activeWindows: number
} {
  if (!store || typeof store.size !== 'function') {
    return { totalKeys: 0, activeWindows: 0 }
  }

  const totalKeys = store.size()
  // In a real implementation, you'd count active windows
  const activeWindows = totalKeys // Simplified

  return { totalKeys, activeWindows }
}

export { MemoryRateLimitStore }