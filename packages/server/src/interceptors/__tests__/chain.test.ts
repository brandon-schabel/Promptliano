import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { InterceptorChain, createInterceptorChain } from '../chain'
import { DefaultInterceptorRegistry } from '../registry'
import { type Interceptor, type InterceptorContext, type InterceptorChainConfig, InterceptorError } from '../types'
import type { Context } from 'hono'

describe('InterceptorChain', () => {
  let registry: DefaultInterceptorRegistry
  let chain: InterceptorChain
  let mockContext: Context
  let interceptorContext: InterceptorContext

  beforeEach(() => {
    registry = new DefaultInterceptorRegistry()
    chain = new InterceptorChain(registry)

    mockContext = {
      req: {
        method: 'GET',
        path: '/api/test',
        header: mock(() => undefined)
      },
      res: { status: 200 },
      set: mock(),
      get: mock(),
      json: mock(() => ({ success: true })),
      header: mock()
    } as unknown as Context

    interceptorContext = {
      requestId: 'req-123',
      startTime: Date.now(),
      metadata: {},
      metrics: { interceptorTimings: {} },
      cacheKeys: [],
      security: { ip: '127.0.0.1', rateLimitKeys: [] }
    }
  })

  const createMockInterceptor = (overrides: Partial<Interceptor> = {}): Interceptor => ({
    name: 'test-interceptor',
    order: 10,
    phase: 'request',
    enabled: true,
    handler: mock(async (ctx, interceptorCtx, next) => {
      await next()
    }),
    ...overrides
  })

  describe('execute', () => {
    it('should execute enabled interceptors in order', async () => {
      const interceptor1 = createMockInterceptor({ name: 'first', order: 10 })
      const interceptor2 = createMockInterceptor({ name: 'second', order: 20 })

      registry.register(interceptor1)
      registry.register(interceptor2)

      const result = await chain.execute('request', mockContext, interceptorContext)

      expect(result.success).toBe(true)
      expect(result.metrics.interceptorCount).toBe(2)
      expect(interceptor1.handler).toHaveBeenCalled()
      expect(interceptor2.handler).toHaveBeenCalled()
    })

    it('should skip disabled interceptors', async () => {
      const enabledInterceptor = createMockInterceptor({ name: 'enabled' })
      const disabledInterceptor = createMockInterceptor({
        name: 'disabled',
        enabled: false
      })

      registry.register(enabledInterceptor)
      registry.register(disabledInterceptor)

      const result = await chain.execute('request', mockContext, interceptorContext)

      expect(result.success).toBe(true)
      expect(result.metrics.interceptorCount).toBe(1)
      expect(enabledInterceptor.handler).toHaveBeenCalled()
      expect(disabledInterceptor.handler).not.toHaveBeenCalled()
    })

    it('should execute interceptors in dependency order', async () => {
      const baseInterceptor = createMockInterceptor({
        name: 'base',
        order: 20
      })
      const dependentInterceptor = createMockInterceptor({
        name: 'dependent',
        order: 10, // Lower order, but should run after base due to dependency
        dependencies: ['base']
      })

      registry.register(baseInterceptor)
      registry.register(dependentInterceptor)

      await chain.execute('request', mockContext, interceptorContext)

      // Both should be called, dependency order should be respected
      expect(baseInterceptor.handler).toHaveBeenCalled()
      expect(dependentInterceptor.handler).toHaveBeenCalled()
    })

    it('should handle interceptor errors', async () => {
      const failingInterceptor = createMockInterceptor({
        name: 'failing',
        handler: mock(async () => {
          throw new Error('Interceptor failed')
        })
      })

      registry.register(failingInterceptor)

      await expect(chain.execute('request', mockContext, interceptorContext)).rejects.toThrow(InterceptorError)
    })

    it('should continue on error when configured', async () => {
      const chainWithContinueOnError = new InterceptorChain(registry, {
        continueOnError: true
      })

      const failingInterceptor = createMockInterceptor({
        name: 'failing',
        handler: mock(async () => {
          throw new Error('Interceptor failed')
        })
      })
      const successInterceptor = createMockInterceptor({
        name: 'success',
        order: 20
      })

      registry.register(failingInterceptor)
      registry.register(successInterceptor)

      const result = await chainWithContinueOnError.execute('request', mockContext, interceptorContext)

      expect(result.success).toBe(true)
      expect(successInterceptor.handler).toHaveBeenCalled()
    })

    it('should collect performance metrics', async () => {
      const interceptor = createMockInterceptor({
        handler: mock(async (ctx, interceptorCtx, next) => {
          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 10))
          await next()
        })
      })

      registry.register(interceptor)

      const result = await chain.execute('request', mockContext, interceptorContext)

      expect(result.metrics.totalTime).toBeGreaterThan(0)
      expect(result.metrics.interceptorTimings['test-interceptor']).toBeGreaterThan(0)
    })

    it('should timeout long-running interceptors', async () => {
      const slowInterceptor = createMockInterceptor({
        handler: mock(async (ctx, interceptorCtx, next) => {
          // Simulate slow operation
          await new Promise((resolve) => setTimeout(resolve, 100))
          await next()
        })
      })

      registry.register(slowInterceptor)

      const fastChain = new InterceptorChain(registry, { timeoutMs: 50 })

      await expect(fastChain.execute('request', mockContext, interceptorContext)).rejects.toThrow('timed out')
    })

    it('should filter interceptors by route and method', async () => {
      const allRoutesInterceptor = createMockInterceptor({ name: 'all-routes' })
      const apiOnlyInterceptor = createMockInterceptor({
        name: 'api-only',
        routes: ['/api/*']
      })
      const postOnlyInterceptor = createMockInterceptor({
        name: 'post-only',
        methods: ['POST']
      })

      registry.register(allRoutesInterceptor)
      registry.register(apiOnlyInterceptor)
      registry.register(postOnlyInterceptor)

      // Test API route with GET method
      const result = await chain.execute('request', mockContext, interceptorContext, '/api/test', 'GET')

      expect(allRoutesInterceptor.handler).toHaveBeenCalled()
      expect(apiOnlyInterceptor.handler).toHaveBeenCalled()
      expect(postOnlyInterceptor.handler).not.toHaveBeenCalled()
    })

    it('should handle circular dependencies', async () => {
      const interceptor1 = createMockInterceptor({
        name: 'interceptor1',
        dependencies: ['interceptor2']
      })
      const interceptor2 = createMockInterceptor({
        name: 'interceptor2',
        dependencies: ['interceptor1']
      })

      registry.register(interceptor1)
      registry.register(interceptor2)

      await expect(chain.execute('request', mockContext, interceptorContext)).rejects.toThrow('Circular dependency')
    })
  })

  describe('createMiddleware', () => {
    it('should create Hono middleware', async () => {
      const interceptor = createMockInterceptor()
      registry.register(interceptor)

      const middleware = chain.createMiddleware('request')
      const mockNext = mock(async () => {})

      await middleware(mockContext, mockNext)

      expect(interceptor.handler).toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })

    it('should create interceptor context automatically', async () => {
      const interceptor = createMockInterceptor({
        handler: mock(async (ctx, interceptorCtx, next) => {
          expect(interceptorCtx.requestId).toBeDefined()
          expect(interceptorCtx.startTime).toBeTypeOf('number')
          expect(interceptorCtx.security.ip).toBeDefined()
          await next()
        })
      })
      registry.register(interceptor)

      const middleware = chain.createMiddleware('request')
      const mockNext = mock(async () => {})

      await middleware(mockContext, mockNext)

      expect(interceptor.handler).toHaveBeenCalled()
    })

    it('should handle errors in middleware', async () => {
      const failingInterceptor = createMockInterceptor({
        handler: mock(async () => {
          throw new Error('Middleware error')
        })
      })
      registry.register(failingInterceptor)

      const middleware = chain.createMiddleware('request')
      const mockNext = mock(async () => {})

      await expect(middleware(mockContext, mockNext)).rejects.toThrow(InterceptorError)
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig: InterceptorChainConfig = {
        continueOnError: true,
        timeoutMs: 5000,
        enableMetrics: false
      }

      chain.updateConfig(newConfig)

      const config = chain.getConfig()
      expect(config.continueOnError).toBe(true)
      expect(config.timeoutMs).toBe(5000)
      expect(config.enableMetrics).toBe(false)
    })

    it('should return current configuration', () => {
      const config = chain.getConfig()

      expect(config).toHaveProperty('continueOnError')
      expect(config).toHaveProperty('timeoutMs')
      expect(config).toHaveProperty('enableMetrics')
      expect(config).toHaveProperty('enableLogging')
    })
  })
})

describe('createInterceptorChain', () => {
  it('should create new chain instance', () => {
    const registry = new DefaultInterceptorRegistry()
    const chain = createInterceptorChain(registry)

    expect(chain).toBeInstanceOf(InterceptorChain)
  })

  it('should accept configuration', () => {
    const registry = new DefaultInterceptorRegistry()
    const config = { continueOnError: true, timeoutMs: 1000 }
    const chain = createInterceptorChain(registry, config)

    expect(chain.getConfig().continueOnError).toBe(true)
    expect(chain.getConfig().timeoutMs).toBe(1000)
  })
})
