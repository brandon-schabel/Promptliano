import type { Context } from 'hono'
import type { InterceptorContext } from './types'

/**
 * Utility functions for managing interceptor context throughout the request lifecycle
 */
export class InterceptorContextManager {
  private static readonly CONTEXT_KEY = 'interceptorContext'

  /**
   * Create a new interceptor context for a request
   */
  static create(requestId?: string, ip?: string, userAgent?: string): InterceptorContext {
    return {
      requestId: requestId || this.generateRequestId(),
      startTime: Date.now(),
      metadata: {},
      metrics: {
        interceptorTimings: {}
      },
      cacheKeys: [],
      security: {
        ip: ip || 'unknown',
        userAgent,
        rateLimitKeys: []
      }
    }
  }

  /**
   * Store interceptor context in Hono context
   */
  static store(honoContext: Context, interceptorContext: InterceptorContext): void {
    honoContext.set(this.CONTEXT_KEY, interceptorContext)
  }

  /**
   * Retrieve interceptor context from Hono context
   */
  static retrieve(honoContext: Context): InterceptorContext | undefined {
    return honoContext.get(this.CONTEXT_KEY)
  }

  /**
   * Get or create interceptor context
   */
  static getOrCreate(honoContext: Context): InterceptorContext {
    let context = this.retrieve(honoContext)

    if (!context) {
      const ip = this.extractIP(honoContext)
      const userAgent = honoContext.req.header('user-agent')
      const requestId = honoContext.get('requestId') || this.generateRequestId()

      context = this.create(requestId, ip, userAgent)
      this.store(honoContext, context)
    }

    return context
  }

  /**
   * Update metadata in the interceptor context
   */
  static updateMetadata(honoContext: Context, key: string, value: any): void {
    const context = this.getOrCreate(honoContext)
    context.metadata[key] = value
  }

  /**
   * Get metadata from the interceptor context
   */
  static getMetadata<T = any>(honoContext: Context, key: string): T | undefined {
    const context = this.retrieve(honoContext)
    return context?.metadata[key] as T
  }

  /**
   * Add a cache key to the context
   */
  static addCacheKey(honoContext: Context, cacheKey: string): void {
    const context = this.getOrCreate(honoContext)
    if (!context.cacheKeys.includes(cacheKey)) {
      context.cacheKeys.push(cacheKey)
    }
  }

  /**
   * Add a rate limit key to the context
   */
  static addRateLimitKey(honoContext: Context, rateLimitKey: string): void {
    const context = this.getOrCreate(honoContext)
    if (!context.security.rateLimitKeys.includes(rateLimitKey)) {
      context.security.rateLimitKeys.push(rateLimitKey)
    }
  }

  /**
   * Set the authenticated user in the context
   */
  static setUser(honoContext: Context, user: any): void {
    const context = this.getOrCreate(honoContext)
    context.user = user
  }

  /**
   * Get the authenticated user from the context
   */
  static getUser<T = any>(honoContext: Context): T | undefined {
    const context = this.retrieve(honoContext)
    return context?.user as T
  }

  /**
   * Record timing for an interceptor
   */
  static recordTiming(honoContext: Context, interceptorName: string, timeMs: number): void {
    const context = this.getOrCreate(honoContext)
    context.metrics.interceptorTimings[interceptorName] = timeMs
  }

  /**
   * Get timing for an interceptor
   */
  static getTiming(honoContext: Context, interceptorName: string): number | undefined {
    const context = this.retrieve(honoContext)
    return context?.metrics.interceptorTimings[interceptorName]
  }

  /**
   * Get total request processing time
   */
  static getTotalTime(honoContext: Context): number | undefined {
    const context = this.retrieve(honoContext)
    if (!context) return undefined

    return context.metrics.totalTime || Date.now() - context.startTime
  }

  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `req_${timestamp}_${random}`
  }

  /**
   * Extract client IP from Hono context
   */
  private static extractIP(honoContext: Context): string {
    return (
      honoContext.req.header('x-forwarded-for') ||
      honoContext.req.header('x-real-ip') ||
      honoContext.req.header('cf-connecting-ip') ||
      'unknown'
    )
  }

  /**
   * Create a context-aware logger function
   */
  static createLogger(honoContext: Context) {
    const context = this.getOrCreate(honoContext)

    return {
      debug: (message: string, data?: any) => this.log('debug', context, message, data),
      info: (message: string, data?: any) => this.log('info', context, message, data),
      warn: (message: string, data?: any) => this.log('warn', context, message, data),
      error: (message: string, data?: any) => this.log('error', context, message, data)
    }
  }

  /**
   * Log with context information
   */
  private static log(
    level: 'debug' | 'info' | 'warn' | 'error',
    context: InterceptorContext,
    message: string,
    data?: any
  ): void {
    const logData = {
      level,
      message,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
      data
    }

    console[level](`[${level.toUpperCase()}] ${message}`, logData)
  }

  /**
   * Get context summary for debugging
   */
  static getSummary(honoContext: Context):
    | {
        requestId: string
        totalTime: number
        interceptorCount: number
        cacheKeysCount: number
        rateLimitKeysCount: number
        hasUser: boolean
        metadataKeys: string[]
      }
    | undefined {
    const context = this.retrieve(honoContext)
    if (!context) return undefined

    return {
      requestId: context.requestId,
      totalTime: Date.now() - context.startTime,
      interceptorCount: Object.keys(context.metrics.interceptorTimings).length,
      cacheKeysCount: context.cacheKeys.length,
      rateLimitKeysCount: context.security.rateLimitKeys.length,
      hasUser: !!context.user,
      metadataKeys: Object.keys(context.metadata)
    }
  }

  /**
   * Export context for debugging (strips sensitive data)
   */
  static exportContext(honoContext: Context): Partial<InterceptorContext> | undefined {
    const context = this.retrieve(honoContext)
    if (!context) return undefined

    return {
      requestId: context.requestId,
      startTime: context.startTime,
      metrics: context.metrics,
      cacheKeys: context.cacheKeys,
      security: {
        ip: context.security.ip.replace(/\d/g, '*'), // Mask IP for privacy
        userAgent: context.security.userAgent?.substring(0, 50) + '...', // Truncate UA
        rateLimitKeys: context.security.rateLimitKeys
      }
      // Note: user and metadata are omitted for security
    }
  }
}

/**
 * Middleware to automatically create and manage interceptor context
 */
export function createContextMiddleware() {
  return async (context: Context, next: () => Promise<void>) => {
    // Create or get existing interceptor context
    InterceptorContextManager.getOrCreate(context)

    // Continue with the request
    await next()

    // Optional: Log context summary in development
    if (process.env.NODE_ENV === 'development') {
      const summary = InterceptorContextManager.getSummary(context)
      if (summary) {
        console.debug('[InterceptorContext]', summary)
      }
    }
  }
}

/**
 * Helper function to safely access interceptor context
 */
export function withInterceptorContext<T>(
  honoContext: Context,
  callback: (context: InterceptorContext) => T
): T | undefined {
  const interceptorContext = InterceptorContextManager.retrieve(honoContext)
  if (!interceptorContext) {
    console.warn('[InterceptorContext] No interceptor context found')
    return undefined
  }

  return callback(interceptorContext)
}

/**
 * Type-safe metadata access utilities
 */
export class TypedMetadata {
  private readonly honoContext: Context

  constructor(honoContext: Context) {
    this.honoContext = honoContext
  }

  /**
   * Set typed metadata
   */
  set<T>(key: string, value: T): void {
    InterceptorContextManager.updateMetadata(this.honoContext, key, value)
  }

  /**
   * Get typed metadata
   */
  get<T>(key: string): T | undefined {
    return InterceptorContextManager.getMetadata<T>(this.honoContext, key)
  }

  /**
   * Get typed metadata with default value
   */
  getOrDefault<T>(key: string, defaultValue: T): T {
    return this.get<T>(key) ?? defaultValue
  }

  /**
   * Check if metadata key exists
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Remove metadata key
   */
  remove(key: string): void {
    const context = InterceptorContextManager.retrieve(this.honoContext)
    if (context) {
      delete context.metadata[key]
    }
  }

  /**
   * Get all metadata keys
   */
  keys(): string[] {
    const context = InterceptorContextManager.retrieve(this.honoContext)
    return context ? Object.keys(context.metadata) : []
  }
}

/**
 * Create a typed metadata accessor for a Hono context
 */
export function createTypedMetadata(honoContext: Context): TypedMetadata {
  return new TypedMetadata(honoContext)
}
