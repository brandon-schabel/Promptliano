/**
 * Simple In-Memory Rate Limiter
 *
 * Provides basic rate limiting for local-first applications.
 * Uses in-memory Map storage with automatic cleanup.
 *
 * Key Features:
 * - In-memory Map storage (no Redis needed)
 * - Configurable windowMs and maxRequests
 * - Returns middleware function for Hono
 * - DISABLED when process.env.DEV is 'true'
 * - Periodic cleanup to prevent memory leaks (every 60 seconds)
 * - Uses ApiError for rate limit responses
 *
 * @module SimpleRateLimiter
 */

import type { Context, Next } from 'hono'
import { ErrorFactory } from '@promptliano/shared'

export interface RateLimiterOptions {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
}

interface RateLimitRecord {
  count: number
  resetAt: number
}

// In-memory store for rate limit tracking
const requestCounts = new Map<string, RateLimitRecord>()

/**
 * Create a simple rate limiter middleware
 *
 * @param options - Rate limiter configuration
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * const aiRateLimiter = createSimpleRateLimiter({
 *   windowMs: 60000, // 1 minute
 *   maxRequests: 10
 * })
 *
 * app.post('/api/generate', aiRateLimiter, async (c) => {
 *   // Handler code
 * })
 * ```
 */
export function createSimpleRateLimiter(options: RateLimiterOptions) {
  return async (c: Context, next: Next) => {
    // CRITICAL: Skip rate limiting in development mode
    // This allows unrestricted testing and development
    if (process.env.DEV === 'true') {
      return await next()
    }

    // Use simple 'local-user' key for local-first app
    // In a multi-user scenario, this could be based on IP or user ID
    const key = 'local-user'
    const now = Date.now()

    // Get or create request record
    let record = requestCounts.get(key)

    // Reset if window expired
    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + options.windowMs
      }
      requestCounts.set(key, record)
    }

    // Increment count
    record.count++

    // Check limit
    if (record.count > options.maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)

      // Set retry-after header
      c.header('Retry-After', retryAfter.toString())
      c.header('X-RateLimit-Limit', options.maxRequests.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', record.resetAt.toString())

      // Throw rate limit error using ErrorFactory
      throw ErrorFactory.rateLimitExceeded(
        `Too many requests. Try again in ${retryAfter} seconds.`,
        retryAfter
      )
    }

    // Set rate limit headers
    c.header('X-RateLimit-Limit', options.maxRequests.toString())
    c.header('X-RateLimit-Remaining', (options.maxRequests - record.count).toString())
    c.header('X-RateLimit-Reset', record.resetAt.toString())

    await next()
  }
}

/**
 * Cleanup old entries periodically to prevent memory leaks
 * Runs every 60 seconds
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key)
    }
  }
}, 60000) // Clean every minute

/**
 * Get current rate limit stats (for debugging/monitoring)
 */
export function getRateLimitStats() {
  return {
    totalKeys: requestCounts.size,
    records: Array.from(requestCounts.entries()).map(([key, record]) => ({
      key,
      count: record.count,
      resetAt: new Date(record.resetAt).toISOString(),
      remaining: Math.max(0, record.resetAt - Date.now())
    }))
  }
}

/**
 * Clear all rate limit records (for testing)
 */
export function clearRateLimits() {
  requestCounts.clear()
}
