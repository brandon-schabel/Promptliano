import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { createCacheInterceptor } from '../request/cache-interceptor'
import type { Context } from 'hono'
import type { InterceptorContext, CacheInterceptorConfig } from '../types'

describe('Cache Interceptor', () => {
  let mockContext: Context
  let interceptorContext: InterceptorContext
  let mockNext: ReturnType<typeof mock<() => Promise<void>>>
  let mockCache: Map<string, any>

  beforeEach(() => {
    mockCache = new Map()

    mockContext = {
      req: {
        method: 'GET',
        path: '/api/projects/123',
        url: '/api/projects/123',
        header: mock((name: string) => {
          if (name === 'cache-control') return undefined
          if (name === 'if-none-match') return undefined
          return undefined
        }) as any,
        query: mock((key?: string) => {
          if (key === 'refresh') return undefined
          return undefined
        }) as any
      },
      res: {
        status: 200,
        headers: new Headers()
      },
      set: mock() as any,
      get: mock() as any,
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
      security: { ip: '127.0.0.1', rateLimitKeys: [] }
    }

    mockNext = mock(async () => {
      // Simulate successful response
      ;(mockContext.res as any).status = 200
    })
  })

  describe('createCacheInterceptor', () => {
    it('should create interceptor with default configuration', () => {
      const interceptor = createCacheInterceptor()

      expect(interceptor.name).toBe('cache-interceptor')
      expect(interceptor.phase).toBe('request')
      expect(interceptor.order).toBe(30)
      expect(interceptor.enabled).toBe(true)
      expect(interceptor.config.enabled).toBe(true)
      expect(interceptor.config.defaultTtl).toBe(300000) // 5 minutes
    })

    it('should create interceptor with custom configuration', () => {
      const config: Partial<CacheInterceptorConfig> = {
        enabled: true,
        defaultTtl: 600000, // 10 minutes
        maxSize: 1000,
        allowedMethods: ['GET', 'HEAD']
      }

      const interceptor = createCacheInterceptor(config)

      expect(interceptor.config.defaultTtl).toBe(600000)
      expect(interceptor.config.maxSize).toBe(1000)
      expect(interceptor.config.allowedMethods).toEqual(['GET', 'HEAD'])
    })
  })

  describe('cache hit scenarios', () => {
    it('should return cached response for GET requests', async () => {
      const cacheKey = 'GET:/api/projects/123'
      const cachedResponse = {
        data: { id: 123, name: 'Test Project' },
        timestamp: Date.now(),
        etag: 'etag-123'
      }
      mockCache.set(cacheKey, cachedResponse)

      const mockCache$ = {
        get: mock(() => cachedResponse),
        set: mock(),
        delete: mock(),
        has: mock(() => true)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith(cachedResponse.data)
      expect(mockContext.header).toHaveBeenCalledWith('ETag', cachedResponse.etag)
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'HIT')
      expect(mockNext).not.toHaveBeenCalled()
      expect(interceptorContext.cacheKeys).toContain(cacheKey)
    })

    it('should respect If-None-Match header for 304 responses', async () => {
      const cacheKey = 'GET:/api/projects/123'
      const cachedResponse = {
        data: { id: 123, name: 'Test Project' },
        timestamp: Date.now(),
        etag: 'etag-123'
      }
      mockCache.set(cacheKey, cachedResponse)
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'if-none-match') return 'etag-123'
        return undefined
      })

      const mockCache$ = {
        get: mock(() => cachedResponse),
        set: mock(),
        delete: mock(),
        has: mock(() => true)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      // Status method already mocked in beforeEach

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(304)
      expect(mockContext.header).toHaveBeenCalledWith('ETag', cachedResponse.etag)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('cache miss scenarios', () => {
    it('should proceed to next interceptor on cache miss', async () => {
      const mockCache$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'MISS')
    })

    it('should cache successful responses after execution', async () => {
      const mockCache$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const responseData = { id: 123, name: 'Test Project' }

      // Mock successful response
      mockNext = mock(async () => {
        ;(mockContext.res as any).status = 200
        // Simulate that the response data is available
        ;(mockContext as any).get = mock(() => responseData)
      })

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockCache$.set).toHaveBeenCalled()

      // Verify cache key generation
      const cacheKey = 'GET:/api/projects/123'
      expect(interceptorContext.cacheKeys).toContain(cacheKey)
    })
  })

  describe('cache invalidation', () => {
    it('should skip caching for non-GET requests', async () => {
      ;(mockContext.req as any).method = 'POST'

      const mockCache$ = {
        get: mock(),
        set: mock(),
        delete: mock(),
        has: mock()
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockCache$.get).not.toHaveBeenCalled()
      expect(mockCache$.set).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })

    it('should bypass cache when refresh parameter is present', async () => {
      ;(mockContext.req as any).query = mock((key?: string) => {
        if (key === 'refresh') return 'true'
        return undefined
      })

      const mockCache$ = {
        get: mock(() => ({ data: 'cached', timestamp: Date.now() })),
        set: mock(),
        delete: mock(),
        has: mock(() => true)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'BYPASS')
    })

    it('should respect Cache-Control: no-cache header', async () => {
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'cache-control') return 'no-cache'
        return undefined
      })

      const mockCache$ = {
        get: mock(() => ({ data: 'cached', timestamp: Date.now() })),
        set: mock(),
        delete: mock(),
        has: mock(() => true)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'BYPASS')
    })
  })

  describe('cache expiration', () => {
    it('should treat expired cache entries as misses', async () => {
      const expiredEntry = {
        data: { id: 123, name: 'Test Project' },
        timestamp: Date.now() - 400000, // 6.67 minutes ago (expired if TTL is 5 minutes)
        etag: 'etag-123'
      }

      const mockCache$ = {
        get: mock(() => expiredEntry),
        set: mock(),
        delete: mock(),
        has: mock(() => true)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any,
        defaultTtl: 300000 // 5 minutes
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockCache$.delete).toHaveBeenCalledWith('GET:/api/projects/123')
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'EXPIRED')
    })
  })

  describe('cache key generation', () => {
    it('should generate consistent cache keys', async () => {
      const mockCache$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      const expectedKey = 'GET:/api/projects/123'
      expect(interceptorContext.cacheKeys).toContain(expectedKey)
    })

    it('should include query parameters in cache key', async () => {
      ;(mockContext.req as any).path = '/api/projects'
      ;(mockContext.req as any).query = mock((key?: string) => {
        if (key === 'status') return 'active'
        if (key === 'limit') return '10'
        return undefined
      })

      // Mock URL search params
      Object.defineProperty(mockContext.req, 'url', {
        value: '/api/projects?status=active&limit=10',
        writable: true
      })

      const mockCache$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any,
        includeQuery: true
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      // Should include sorted query parameters
      const expectedKey = 'GET:/api/projects?limit=10&status=active'
      expect(interceptorContext.cacheKeys).toContain(expectedKey)
    })
  })

  describe('error handling', () => {
    it('should proceed normally if cache operations fail', async () => {
      const mockCache$ = {
        get: mock(() => {
          throw new Error('Cache read error')
        }),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      // Should not throw error, should proceed to next
      await expect(interceptor.handler(mockContext, interceptorContext, mockNext)).resolves.toBeUndefined()
      expect(mockNext).toHaveBeenCalled()
    })

    it('should not cache error responses', async () => {
      mockNext = mock(async () => {
        ;(mockContext.res as any).status = 500
        throw new Error('Server error')
      })

      const mockCache$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await expect(interceptor.handler(mockContext, interceptorContext, mockNext)).rejects.toThrow()
      expect(mockCache$.set).not.toHaveBeenCalled()
    })
  })

  describe('timing metrics', () => {
    it('should record cache operation timing', async () => {
      const mockCache$ = {
        get: mock(() => undefined),
        set: mock(),
        delete: mock(),
        has: mock(() => false)
      }

      const interceptor = createCacheInterceptor({
        cache: mockCache$ as any
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(interceptorContext.metrics.interceptorTimings['cache']).toBeTypeOf('number')
      expect(interceptorContext.metrics.interceptorTimings['cache']).toBeGreaterThanOrEqual(0)
    })
  })
})
