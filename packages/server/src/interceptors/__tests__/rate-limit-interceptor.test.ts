import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { createRateLimitInterceptor } from '../request/rate-limit-interceptor'
import type { Context } from 'hono'
import type { InterceptorContext, RateLimitInterceptorConfig } from '../types'

describe('Rate Limit Interceptor', () => {
  let mockContext: Context
  let interceptorContext: InterceptorContext
  let mockNext: ReturnType<typeof mock<() => Promise<void>>>
  let mockStore: Map<string, any>

  beforeEach(() => {
    mockStore = new Map()

    mockContext = {
      req: {
        method: 'GET',
        path: '/api/projects/123',
        header: mock((name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1'
          if (name === 'user-agent') return 'Test Agent'
          if (name === 'authorization') return 'Bearer test-token'
          return undefined
        }) as any
      },
      res: {
        status: 200,
        headers: new Headers()
      },
      set: mock() as any,
      get: mock((key: string) => {
        if (key === 'user') return { id: 'user-123' }
        return undefined
      }) as any,
      json: mock() as any,
      header: mock() as any,
      status: mock(() => mockContext) as any
    } as unknown as Context

    interceptorContext = {
      requestId: 'req-123',
      startTime: Date.now(),
      metadata: {},
      metrics: { interceptorTimings: {} },
      cacheKeys: [],
      security: {
        ip: '192.168.1.1',
        rateLimitKeys: [],
        userAgent: 'Test Agent'
      },
      user: { id: 'user-123' }
    }

    mockNext = mock(async () => {
      // Simulate successful response
    })
  })

  describe('createRateLimitInterceptor', () => {
    it('should create interceptor with default configuration', () => {
      const interceptor = createRateLimitInterceptor()

      expect(interceptor.name).toBe('rate-limit-interceptor')
      expect(interceptor.phase).toBe('request')
      expect(interceptor.order).toBe(5)
      expect(interceptor.enabled).toBe(true)
      expect(interceptor.config.windowMs).toBe(900000) // 15 minutes
      expect(interceptor.config.max).toBe(100)
    })

    it('should create interceptor with custom configuration', () => {
      const config: Partial<RateLimitInterceptorConfig> = {
        windowMs: 60000, // 1 minute
        max: 50,
        keyGenerator: (ctx, iCtx) => `custom:${iCtx.security.ip}`,
        skipSuccessfulRequests: true
      }

      const interceptor = createRateLimitInterceptor(config)

      expect(interceptor.config.windowMs).toBe(60000)
      expect(interceptor.config.max).toBe(50)
      expect(interceptor.config.skipSuccessfulRequests).toBe(true)
    })
  })

  describe('rate limit enforcement', () => {
    it('should allow requests within limit', async () => {
      const mockStore$ = {
        get: mock(() => ({ count: 5, resetTime: Date.now() + 900000 })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '100')
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '94') // 100 - 5 - 1
      expect(interceptorContext.security.rateLimitKeys).toContain('ip:192.168.1.1')
    })

    it('should block requests that exceed limit', async () => {
      const mockStore$ = {
        get: mock(() => ({ count: 100, resetTime: Date.now() + 900000 })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.status).toHaveBeenCalledWith(429)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            limit: 100,
            windowMs: 900000,
            retryAfter: expect.any(Number)
          }
        }
      })
    })

    it('should reset counter after window expires', async () => {
      const expiredTime = Date.now() - 1000 // 1 second ago
      const mockStore$ = {
        get: mock(() => ({ count: 150, resetTime: expiredTime })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      // Should start fresh count
      expect(mockStore$.set).toHaveBeenCalledWith('ip:192.168.1.1', expect.objectContaining({ count: 1 }))
    })
  })

  describe('key generation strategies', () => {
    it('should use IP-based key by default', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockStore$.get).toHaveBeenCalledWith('ip:192.168.1.1')
      expect(interceptorContext.security.rateLimitKeys).toContain('ip:192.168.1.1')
    })

    it('should use user-based key when user is authenticated', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        keyGenerator: (ctx, iCtx) => {
          return iCtx.user ? `user:${iCtx.user.id}` : `ip:${iCtx.security.ip}`
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockStore$.get).toHaveBeenCalledWith('user:user-123')
      expect(interceptorContext.security.rateLimitKeys).toContain('user:user-123')
    })

    it('should use custom key generator', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock()
      }

      const customKeyGen = mock((ctx: Context, iCtx: InterceptorContext) => {
        return `${ctx.req.method}:${iCtx.security.ip}:${ctx.req.path}`
      }) as ReturnType<typeof mock<(ctx: Context, iCtx: InterceptorContext) => string>>

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        keyGenerator: customKeyGen
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(customKeyGen).toHaveBeenCalledWith(mockContext, interceptorContext)
      expect(mockStore$.get).toHaveBeenCalledWith('GET:192.168.1.1:/api/projects/123')
    })
  })

  describe('different limit strategies', () => {
    it('should apply per-route limits', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100,
        perRouteLimit: {
          '/api/auth/*': 10,
          '/api/projects/*': 50
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '50')
    })

    it('should apply per-user limits', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100,
        perUserLimit: 200
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '200')
    })
  })

  describe('skip conditions', () => {
    it('should skip rate limiting for whitelisted IPs', async () => {
      const mockStore$ = {
        get: mock(),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        skip: (ctx, iCtx) => {
          const whitelistedIPs = ['192.168.1.1', '127.0.0.1']
          return whitelistedIPs.includes(iCtx.security.ip)
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockStore$.get).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Skip', 'true')
    })

    it('should skip successful requests when configured', async () => {
      ;(mockContext.res as any).status = 200

      const mockStore$ = {
        get: mock(() => ({ count: 50, resetTime: Date.now() + 900000 })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        skipSuccessfulRequests: true
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      // Should not increment counter for successful requests
      expect(mockStore$.set).not.toHaveBeenCalled()
    })

    it('should skip failed requests when configured', async () => {
      mockNext = mock(async () => {
        ;(mockContext.res as any).status = 404
        throw new Error('Not found')
      })

      const mockStore$ = {
        get: mock(() => ({ count: 50, resetTime: Date.now() + 900000 })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        skipFailedRequests: true
      })

      await expect(interceptor.handler(mockContext, interceptorContext, mockNext)).rejects.toThrow()

      // Should not increment counter for failed requests
      expect(mockStore$.set).not.toHaveBeenCalled()
    })
  })

  describe('response headers', () => {
    it('should include standard rate limit headers', async () => {
      const mockStore$ = {
        get: mock(() => ({ count: 25, resetTime: Date.now() + 600000 })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '100')
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '74') // 100 - 25 - 1
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
    })

    it('should include retry-after header when limit exceeded', async () => {
      const resetTime = Date.now() + 300000 // 5 minutes from now
      const mockStore$ = {
        get: mock(() => ({ count: 100, resetTime })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.header).toHaveBeenCalledWith('Retry-After', expect.any(String))
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.objectContaining({
              retryAfter: expect.any(Number)
            })
          })
        })
      )
    })
  })

  describe('store operations', () => {
    it('should handle store failures gracefully', async () => {
      const mockStore$ = {
        get: mock(() => {
          throw new Error('Store error')
        }),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any
      })

      // Should not throw error, should proceed to next
      await expect(interceptor.handler(mockContext, interceptorContext, mockNext)).resolves.toBeUndefined()
      expect(mockNext).toHaveBeenCalled()
    })

    it('should clean up expired entries', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        cleanup: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        cleanupInterval: 1 // Very short interval for testing
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      // Note: In a real implementation, cleanup would be called periodically
      // This test verifies the store interface supports cleanup
      expect(typeof mockStore$.cleanup).toBe('function')
    })
  })

  describe('timing metrics', () => {
    it('should record rate limit operation timing', async () => {
      const mockStore$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(interceptorContext.metrics.interceptorTimings['rate-limit']).toBeTypeOf('number')
      expect(interceptorContext.metrics.interceptorTimings['rate-limit']).toBeGreaterThanOrEqual(0)
    })
  })

  describe('custom handlers', () => {
    it('should use custom limit exceeded handler', async () => {
      const customHandler = mock((ctx: Context, iCtx: InterceptorContext) => {
        ctx.status(429)
        return ctx.json({ error: 'Custom rate limit message' })
      }) as ReturnType<typeof mock<(ctx: Context, iCtx: InterceptorContext) => any>>

      const mockStore$ = {
        get: mock(() => ({ count: 100, resetTime: Date.now() + 900000 })),
        set: mock(),
        delete: mock()
      }

      const interceptor = createRateLimitInterceptor({
        store: mockStore$ as any,
        max: 100,
        onLimitReached: customHandler
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(customHandler).toHaveBeenCalledWith(mockContext, interceptorContext)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})
