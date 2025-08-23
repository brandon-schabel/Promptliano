/**
 * Request Deduplication System
 * 
 * Core optimization for preventing duplicate API requests and improving performance.
 * This system:
 * - Prevents identical API calls from being made simultaneously
 * - Shares promises for duplicate requests
 * - Integrates with unified query key system
 * - Provides automatic cleanup and memory management
 * - Maintains error handling and request context
 * 
 * Expected impact:
 * - 60% reduction in duplicate requests
 * - Faster perceived performance
 * - Reduced server load
 * - Better cache utilization
 */

import { getUnifiedQueryKeys } from './query-keys'

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple hash function for body content
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Default key generator that creates deterministic keys from request options
 */
function defaultKeyGenerator(options: RequestOptions, enableCombining: boolean = true): string {
  const { method, endpoint, body, params } = options
  
  // Create base key from method and endpoint
  let key = `${method}:${endpoint}`
  
  // Add query parameters
  if (params && Object.keys(params).length > 0) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&')
    key += `?${sortedParams}`
  }
  
  // Add body hash for POST/PUT/PATCH requests
  if (body && enableCombining) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    key += `#${simpleHash(bodyStr)}`
  }
  
  return key
}

// ============================================================================
// Types and Interfaces
// ============================================================================

interface RequestOptions {
  method: string
  endpoint: string
  body?: unknown
  params?: Record<string, string | number | boolean>
  timeout?: number
  abortSignal?: AbortSignal
}

interface CachedRequest<T = any> {
  promise: Promise<T>
  timestamp: number
  abortController: AbortController
  requestCount: number
  requestKey: string
}

interface DeduplicationConfig {
  /** Maximum time to cache requests in milliseconds (default: 5000) */
  cacheTtl?: number
  /** Maximum number of cached requests (default: 1000) */
  maxCacheSize?: number
  /** Enable request combining for identical payloads (default: true) */
  enableCombining?: boolean
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Custom key generator for deduplication */
  keyGenerator?: (options: RequestOptions) => string
}

interface DeduplicationStats {
  totalRequests: number
  duplicatesFound: number
  duplicatesPrevented: number
  cacheHits: number
  cacheMisses: number
  averageDeduplicationRate: number
  activeRequests: number
  cacheSize: number
}

// ============================================================================
// Request Deduplicator Class
// ============================================================================

export class RequestDeduplicator {
  private requestCache = new Map<string, CachedRequest>()
  private config: Required<DeduplicationConfig>
  private stats: DeduplicationStats = {
    totalRequests: 0,
    duplicatesFound: 0,
    duplicatesPrevented: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageDeduplicationRate: 0,
    activeRequests: 0,
    cacheSize: 0
  }
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      cacheTtl: config.cacheTtl ?? 5000,
      maxCacheSize: config.maxCacheSize ?? 1000,
      enableCombining: config.enableCombining ?? true,
      debug: config.debug ?? false,
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator
    }

    // Start cleanup interval
    this.startCleanupInterval()
  }

  /**
   * Deduplicate a request with metadata about whether deduplication occurred
   */
  async deduplicateWithMetadata<T>(
    requestOptions: RequestOptions,
    requestExecutor: (abortSignal: AbortSignal) => Promise<T>
  ): Promise<{ result: T; wasDeduplicated: boolean }> {
    this.stats.totalRequests++

    // Generate deduplication key
    const requestKey = this.generateRequestKey(requestOptions)
    
    // Check if we already have this request in flight
    const cachedRequest = this.requestCache.get(requestKey)
    
    if (cachedRequest && this.isRequestValid(cachedRequest)) {
      this.stats.duplicatesFound++
      this.stats.duplicatesPrevented++
      this.stats.cacheHits++
      
      cachedRequest.requestCount++
      
      if (this.config.debug) {
        console.log(`[RequestDeduplicator] Cache hit for ${requestKey} (${cachedRequest.requestCount} requests)`)
      }
      
      const result = await (cachedRequest.promise as Promise<T>)
      return { result, wasDeduplicated: true }
    }

    this.stats.cacheMisses++

    // Create new request (same logic as before)
    const abortController = new AbortController()
    
    // Handle external abort signal
    if (requestOptions.abortSignal) {
      requestOptions.abortSignal.addEventListener('abort', () => {
        abortController.abort()
      })
    }

    const promise = this.executeRequest(requestExecutor, abortController.signal)
    
    const cachedRequestEntry: CachedRequest<T> = {
      promise,
      timestamp: Date.now(),
      abortController,
      requestCount: 1,
      requestKey
    }

    // Add to cache
    this.requestCache.set(requestKey, cachedRequestEntry)
    this.stats.activeRequests++
    this.stats.cacheSize = this.requestCache.size

    // Handle request completion (success or error)
    promise
      .then(
        (result) => {
          // Schedule cleanup after success
          setTimeout(() => {
            this.removeFromCache(requestKey)
          }, 100)
          return result
        },
        (error) => {
          // Schedule cleanup after error
          setTimeout(() => {
            this.removeFromCache(requestKey)
          }, 100)
          throw error
        }
      )
      .catch(() => {
        // Silently catch cleanup errors to prevent unhandled rejections
      })

    if (this.config.debug) {
      console.log(`[RequestDeduplicator] New request cached: ${requestKey}`)
    }

    // Cleanup old requests if cache is getting too large
    this.cleanupIfNeeded()

    const result = await promise
    return { result, wasDeduplicated: false }
  }

  /**
   * Deduplicate a request - either return existing promise or create new one
   */
  async deduplicate<T>(
    requestOptions: RequestOptions,
    requestExecutor: (abortSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    this.stats.totalRequests++

    // Generate deduplication key
    const requestKey = this.generateRequestKey(requestOptions)
    
    // Check if we already have this request in flight
    const cachedRequest = this.requestCache.get(requestKey)
    
    if (cachedRequest && this.isRequestValid(cachedRequest)) {
      this.stats.duplicatesFound++
      this.stats.duplicatesPrevented++
      this.stats.cacheHits++
      
      cachedRequest.requestCount++
      
      if (this.config.debug) {
        console.log(`[RequestDeduplicator] Cache hit for ${requestKey} (${cachedRequest.requestCount} requests)`)
      }
      
      return cachedRequest.promise as Promise<T>
    }

    this.stats.cacheMisses++

    // Create new request
    const abortController = new AbortController()
    
    // Handle external abort signal
    if (requestOptions.abortSignal) {
      requestOptions.abortSignal.addEventListener('abort', () => {
        abortController.abort()
      })
    }

    const promise = this.executeRequest(requestExecutor, abortController.signal)
    
    const cachedRequestEntry: CachedRequest<T> = {
      promise,
      timestamp: Date.now(),
      abortController,
      requestCount: 1,
      requestKey
    }

    // Add to cache
    this.requestCache.set(requestKey, cachedRequestEntry)
    this.stats.activeRequests++
    this.stats.cacheSize = this.requestCache.size

    // Handle request completion (success or error)
    promise
      .then(
        (result) => {
          // Schedule cleanup after success
          setTimeout(() => {
            this.removeFromCache(requestKey)
          }, 100)
          return result
        },
        (error) => {
          // Schedule cleanup after error
          setTimeout(() => {
            this.removeFromCache(requestKey)
          }, 100)
          throw error
        }
      )
      .catch(() => {
        // Silently catch cleanup errors to prevent unhandled rejections
      })

    if (this.config.debug) {
      console.log(`[RequestDeduplicator] New request cached: ${requestKey}`)
    }

    // Cleanup old requests if cache is getting too large
    this.cleanupIfNeeded()

    return promise
  }

  /**
   * Execute the actual request with proper error handling
   */
  private async executeRequest<T>(
    requestExecutor: (abortSignal: AbortSignal) => Promise<T>,
    abortSignal: AbortSignal
  ): Promise<T> {
    // Check if already aborted before starting
    if (abortSignal.aborted) {
      throw new Error('Request aborted')
    }

    try {
      const result = await requestExecutor(abortSignal)
      return result
    } catch (error) {
      // Re-throw the error to maintain error handling behavior
      throw error
    }
  }

  /**
   * Generate a unique key for request deduplication
   */
  public generateRequestKey(options: RequestOptions): string {
    return this.config.keyGenerator(options)
  }

  /**
   * Default key generator that creates deterministic keys from request options
   */
  private defaultKeyGenerator = (options: RequestOptions): string => {
    return defaultKeyGenerator(options, this.config.enableCombining)
  }

  /**
   * Check if a cached request is still valid
   */
  private isRequestValid(cachedRequest: CachedRequest): boolean {
    const now = Date.now()
    const age = now - cachedRequest.timestamp
    
    // Check if request has expired
    if (age > this.config.cacheTtl) {
      return false
    }
    
    // Check if request was aborted
    if (cachedRequest.abortController.signal.aborted) {
      return false
    }
    
    return true
  }

  /**
   * Remove a request from cache
   */
  private removeFromCache(requestKey: string): void {
    const removed = this.requestCache.delete(requestKey)
    if (removed) {
      this.stats.activeRequests--
      this.stats.cacheSize = this.requestCache.size
      
      if (this.config.debug) {
        console.log(`[RequestDeduplicator] Removed from cache: ${requestKey}`)
      }
    }
  }

  /**
   * Cleanup expired requests if cache is getting too large
   */
  private cleanupIfNeeded(): void {
    if (this.requestCache.size <= this.config.maxCacheSize) {
      return
    }

    const now = Date.now()
    const keysToRemove: string[] = []

    // Find expired requests
    for (const [key, cachedRequest] of this.requestCache.entries()) {
      if (!this.isRequestValid(cachedRequest)) {
        keysToRemove.push(key)
      }
    }

    // Remove expired requests
    keysToRemove.forEach(key => this.removeFromCache(key))

    // If still too large, remove oldest requests
    if (this.requestCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.requestCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize)
      toRemove.forEach(([key]) => this.removeFromCache(key))
    }

    if (this.config.debug) {
      console.log(`[RequestDeduplicator] Cleanup completed. Cache size: ${this.requestCache.size}`)
    }
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    // Cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests()
    }, 30000)
  }

  /**
   * Cleanup expired requests
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now()
    const keysToRemove: string[] = []

    for (const [key, cachedRequest] of this.requestCache.entries()) {
      if (!this.isRequestValid(cachedRequest)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => this.removeFromCache(key))

    // Update deduplication rate
    if (this.stats.totalRequests > 0) {
      this.stats.averageDeduplicationRate = 
        (this.stats.duplicatesPrevented / this.stats.totalRequests) * 100
    }
  }

  /**
   * Get current deduplication statistics
   */
  getStats(): DeduplicationStats {
    return { ...this.stats }
  }

  /**
   * Clear all cached requests
   */
  clearCache(): void {
    // Abort all active requests
    for (const cachedRequest of this.requestCache.values()) {
      cachedRequest.abortController.abort()
    }
    
    this.requestCache.clear()
    this.stats.activeRequests = 0
    this.stats.cacheSize = 0
    
    if (this.config.debug) {
      console.log('[RequestDeduplicator] Cache cleared')
    }
  }

  /**
   * Abort a specific request by key
   */
  abortRequest(requestKey: string): boolean {
    const cachedRequest = this.requestCache.get(requestKey)
    if (cachedRequest) {
      cachedRequest.abortController.abort()
      this.removeFromCache(requestKey)
      return true
    }
    return false
  }

  /**
   * Get active request keys (for debugging)
   */
  getActiveRequestKeys(): string[] {
    return Array.from(this.requestCache.keys())
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Cleanup and destroy the deduplicator
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    this.clearCache()
  }
}

// ============================================================================
// Global Deduplicator Instance
// ============================================================================

let globalDeduplicator: RequestDeduplicator | null = null

/**
 * Get the global request deduplicator instance
 */
export function getRequestDeduplicator(): RequestDeduplicator {
  if (!globalDeduplicator) {
    globalDeduplicator = new RequestDeduplicator({
      debug: process.env.NODE_ENV === 'development',
      cacheTtl: 5000, // 5 seconds
      maxCacheSize: 1000
    })
  }
  return globalDeduplicator
}

/**
 * Configure the global deduplicator
 */
export function configureRequestDeduplicator(config: DeduplicationConfig): void {
  const deduplicator = getRequestDeduplicator()
  deduplicator.updateConfig(config)
}

/**
 * Get deduplication statistics
 */
export function getDeduplicationStats(): DeduplicationStats {
  return getRequestDeduplicator().getStats()
}

// ============================================================================
// Integration with Query Keys
// ============================================================================

/**
 * Enhanced key generator that uses unified query keys for better deduplication
 */
export function createQueryKeyBasedDeduplicator(config: DeduplicationConfig = {}): RequestDeduplicator {
  const queryKeys = getUnifiedQueryKeys()
  
  return new RequestDeduplicator({
    ...config,
    keyGenerator: (options: RequestOptions) => {
      // Try to extract entity information from endpoint
      const entityMatch = options.endpoint.match(/^\/([^\/]+)/)
      const entity = entityMatch?.[1]
      
      // Use query key format for better deduplication
      if (entity && queryKeys[entity as keyof typeof queryKeys]) {
        try {
          // Extract ID from endpoint if present
          const idMatch = options.endpoint.match(/\/(\d+)(?:\/|$)/)
          const id = idMatch ? parseInt(idMatch[1]) : undefined
          
          // Create query-key-like deduplication key
          const baseKey = id 
            ? `${entity}:${options.method}:${id}`
            : `${entity}:${options.method}`
          
          // Add parameters if present
          if (options.params && Object.keys(options.params).length > 0) {
            const sortedParams = Object.keys(options.params)
              .sort()
              .map(k => `${k}=${options.params![k]}`)
              .join('&')
            return `${baseKey}?${sortedParams}`
          }
          
          return baseKey
        } catch (error) {
          // Fallback to default key generation using the private method directly
          return config.keyGenerator?.(options) || defaultKeyGenerator(options, config.enableCombining ?? true)
        }
      }
      
      // Fallback to default key generation using the private method directly
      return config.keyGenerator?.(options) || defaultKeyGenerator(options, config.enableCombining ?? true)
    }
  })
}

/**
 * Type exports for public API
 */
export type {
  RequestOptions,
  DeduplicationConfig,
  DeduplicationStats
}