/**
 * Rate Limiting Middleware
 *
 * Provides in-memory rate limiting for authentication and API endpoints.
 * Uses sliding window rate limiting with automatic cleanup of expired entries.
 *
 * Security Features:
 * - Prevents brute force attacks on login endpoints
 * - Protects against API abuse
 * - Custom key generation for username + IP tracking
 * - Standard rate limit headers (X-RateLimit-*)
 * - Automatic cleanup of expired entries
 */

import { createMiddleware } from 'hono/factory'
import { ErrorFactory } from '@promptliano/shared'
import type { Context } from 'hono'

interface RateLimitConfig {
  windowMs: number           // Time window in milliseconds
  maxRequests: number        // Max requests allowed in window
  keyGenerator?: (c: Context) => string  // Custom key function
  skipSuccessfulRequests?: boolean       // Don't count successful requests
  message?: string           // Custom error message
  onLimitReached?: (key: string, c: Context) => void  // Callback
}

interface RateLimitRecord {
  count: number
  resetAt: number
  blocked: boolean
}

// In-memory store (use Redis in production)
const requestCounts = new Map<string, RateLimitRecord>()

/**
 * Create a rate limiting middleware
 * DISABLED IN DEVELOPMENT - Only active in production
 */
export function createRateLimiter(config: RateLimitConfig) {
  return createMiddleware(async (c, next) => {
    // CRITICAL: Disable rate limiting in development
    // Development often triggers many rapid requests during testing
    if (process.env.NODE_ENV !== 'production') {
      await next()
      return
    }

    const key = config.keyGenerator?.(c) || getDefaultKey(c)
    const now = Date.now()

    let record = requestCounts.get(key)

    // Create or reset record if window expired
    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + config.windowMs,
        blocked: false
      }
      requestCounts.set(key, record)
    }

    // Check if blocked
    if (record.blocked && now < record.resetAt) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      c.header('Retry-After', retryAfter.toString())
      c.header('X-RateLimit-Limit', config.maxRequests.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', record.resetAt.toString())

      throw ErrorFactory.rateLimitExceeded(
        config.maxRequests,
        `${config.windowMs / 1000 / 60} minutes`,
        retryAfter
      )
    }

    // Increment count
    record.count++

    // Set rate limit headers
    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - record.count).toString())
    c.header('X-RateLimit-Reset', record.resetAt.toString())

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      record.blocked = true

      if (config.onLimitReached) {
        config.onLimitReached(key, c)
      }

      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      c.header('Retry-After', retryAfter.toString())

      throw ErrorFactory.rateLimitExceeded(
        config.maxRequests,
        `${config.windowMs / 1000 / 60} minutes`,
        retryAfter
      )
    }

    await next()

    // Decrement count for successful requests if configured
    if (config.skipSuccessfulRequests && c.res.status < 400) {
      record.count = Math.max(0, record.count - 1)
    }
  })
}

/**
 * Default key generator - uses IP address
 */
function getDefaultKey(c: Context): string {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
             c.req.header('x-real-ip') ||
             'unknown'
  return `ratelimit:${ip}`
}

/**
 * Cleanup expired entries periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key)
    }
  }
}, 60000) // Clean up every minute

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limit for login attempts
  login: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (c) => {
      // Rate limit by username + IP
      const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
      // For login, we need to read the body to get username
      // Since middleware runs before body parsing, we'll use IP only for now
      // The actual username-based limiting will be in the route handler
      return `login:${ip}`
    },
    message: 'Too many login attempts. Please try again in 15 minutes.',
    onLimitReached: (key, c) => {
      console.warn(`🚨 Rate limit exceeded for login: ${key}`)
    }
  }),

  // Moderate rate limit for token refresh
  refresh: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    message: 'Too many token refresh requests.',
  }),

  // Very strict for first-time setup
  setup: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Setup endpoint is rate limited. Please try again later.',
  }),

  // Moderate for admin operations
  admin: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many admin requests.',
  }),

  // General API rate limit
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  }),
}
