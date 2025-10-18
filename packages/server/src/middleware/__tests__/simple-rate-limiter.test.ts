/**
 * Simple Rate Limiter Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createSimpleRateLimiter, clearRateLimits, getRateLimitStats } from '../simple-rate-limiter'
import { ApiError } from '@promptliano/shared'

describe('Simple Rate Limiter', () => {
  let app: Hono

  beforeEach(() => {
    // Clear rate limits before each test
    clearRateLimits()

    // Ensure DEV mode is disabled for tests (unless explicitly testing DEV mode)
    process.env.DEV = 'false'

    // Create new app with error handling
    app = new Hono()

    // Add error handler for ApiError
    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            message: err.message,
            code: err.code
          },
          err.status
        )
      }
      return c.json({ success: false, message: err.message }, 500)
    })
  })

  test('should allow requests under the limit', async () => {
    const limiter = createSimpleRateLimiter({
      windowMs: 60000,
      maxRequests: 5
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    // Make 5 requests - all should succeed
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test')
      expect(res.status).toBe(200)
    }
  })

  test('should block requests over the limit', async () => {
    const limiter = createSimpleRateLimiter({
      windowMs: 60000,
      maxRequests: 3
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    // Make 3 successful requests
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test')
      expect(res.status).toBe(200)
    }

    // 4th request should be rate limited
    const res = await app.request('/test')
    expect(res.status).toBe(429)

    const body = await res.json()
    expect(body).toHaveProperty('message')
    expect(body.message).toContain('Too many requests')
  })

  test('should set rate limit headers', async () => {
    const limiter = createSimpleRateLimiter({
      windowMs: 60000,
      maxRequests: 10
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    const res = await app.request('/test')

    expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  test('should set Retry-After header when limit exceeded', async () => {
    const limiter = createSimpleRateLimiter({
      windowMs: 60000,
      maxRequests: 2
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    // Use up the limit
    await app.request('/test')
    await app.request('/test')

    // Next request should be rate limited
    const res = await app.request('/test')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  test('should skip rate limiting in DEV mode', async () => {
    // Set DEV environment variable
    const originalDev = process.env.DEV
    process.env.DEV = 'true'

    const limiter = createSimpleRateLimiter({
      windowMs: 60000,
      maxRequests: 2
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    // Make 10 requests - all should succeed in DEV mode
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/test')
      expect(res.status).toBe(200)
    }

    // Restore environment variable
    process.env.DEV = originalDev
  })

  test('should track rate limit stats', async () => {
    const limiter = createSimpleRateLimiter({
      windowMs: 60000,
      maxRequests: 5
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    // Make some requests
    await app.request('/test')
    await app.request('/test')

    const stats = getRateLimitStats()
    expect(stats.totalKeys).toBe(1)
    expect(stats.records).toHaveLength(1)
    expect(stats.records[0].key).toBe('local-user')
    expect(stats.records[0].count).toBe(2)
  })

  test('should reset counter after window expires', async () => {
    const limiter = createSimpleRateLimiter({
      windowMs: 100, // 100ms window
      maxRequests: 2
    })

    app.get('/test', limiter, (c) => c.json({ success: true }))

    // Use up the limit
    await app.request('/test')
    await app.request('/test')

    // Next request should fail
    let res = await app.request('/test')
    expect(res.status).toBe(429)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Should be able to make requests again
    res = await app.request('/test')
    expect(res.status).toBe(200)
  })
})
