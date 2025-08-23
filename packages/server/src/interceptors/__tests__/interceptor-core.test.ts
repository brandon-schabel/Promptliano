import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { Context } from 'hono'
import {
  type InterceptorContext,
  type Interceptor,
  type InterceptorHandler,
  InterceptorError
} from '../types'

// Mock dependencies for testing
function createMockContext(): Context {
  return {
    req: {
      method: 'GET',
      path: '/api/test',
      header: mock(() => undefined),
    },
    res: {
      status: 200,
    },
    set: mock(),
    get: mock(),
    json: mock(() => ({ success: true })),
  } as unknown as Context
}

describe('Interceptor Core Infrastructure', () => {
  describe('InterceptorContext', () => {
    it('should create context with required properties', () => {
      const context: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        metadata: {},
        metrics: {
          interceptorTimings: {}
        },
        cacheKeys: [],
        security: {
          ip: '127.0.0.1',
          rateLimitKeys: []
        }
      }

      expect(context.requestId).toBe('req-123')
      expect(context.startTime).toBeTypeOf('number')
      expect(context.metadata).toEqual({})
      expect(context.metrics).toBeDefined()
      expect(context.cacheKeys).toEqual([])
      expect(context.security.ip).toBe('127.0.0.1')
    })

    it('should allow adding metadata', () => {
      const context: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        metadata: { key: 'value' },
        metrics: { interceptorTimings: {} },
        cacheKeys: [],
        security: { ip: '127.0.0.1', rateLimitKeys: [] }
      }

      expect(context.metadata.key).toBe('value')
    })

    it('should support optional user property', () => {
      const context: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        user: { id: 1, name: 'test' },
        metadata: {},
        metrics: { interceptorTimings: {} },
        cacheKeys: [],
        security: { ip: '127.0.0.1', rateLimitKeys: [] }
      }

      expect(context.user?.id).toBe(1)
      expect(context.user?.name).toBe('test')
    })

    it('should track interceptor execution timings', () => {
      const context: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        metadata: {},
        metrics: {
          interceptorTimings: {
            'auth-interceptor': 15,
            'logging-interceptor': 5
          }
        },
        cacheKeys: [],
        security: { ip: '127.0.0.1', rateLimitKeys: [] }
      }

      expect(context.metrics.interceptorTimings['auth-interceptor']).toBe(15)
      expect(context.metrics.interceptorTimings['logging-interceptor']).toBe(5)
    })
  })

  describe('Interceptor Interface', () => {
    it('should define interceptor structure', () => {
      const mockHandler: InterceptorHandler = mock(async () => {})

      const interceptor: Interceptor = {
        name: 'test-interceptor',
        order: 10,
        phase: 'request',
        enabled: true,
        handler: mockHandler
      }

      expect(interceptor.name).toBe('test-interceptor')
      expect(interceptor.order).toBe(10)
      expect(interceptor.phase).toBe('request')
      expect(interceptor.enabled).toBe(true)
      expect(interceptor.handler).toBe(mockHandler)
    })

    it('should support response phase interceptors', () => {
      const interceptor: Interceptor = {
        name: 'response-interceptor',
        order: 20,
        phase: 'response',
        enabled: true,
        handler: mock(async () => {})
      }

      expect(interceptor.phase).toBe('response')
    })

    it('should support error phase interceptors', () => {
      const interceptor: Interceptor = {
        name: 'error-interceptor',
        order: 90,
        phase: 'error',
        enabled: true,
        handler: mock(async () => {})
      }

      expect(interceptor.phase).toBe('error')
    })

    it('should allow disabling interceptors', () => {
      const interceptor: Interceptor = {
        name: 'disabled-interceptor',
        order: 30,
        phase: 'request',
        enabled: false,
        handler: mock(async () => {})
      }

      expect(interceptor.enabled).toBe(false)
    })

    it('should support dependencies', () => {
      const interceptor: Interceptor = {
        name: 'dependent-interceptor',
        order: 30,
        phase: 'request',
        enabled: true,
        handler: mock(async () => {}),
        dependencies: ['auth-interceptor', 'logging-interceptor']
      }

      expect(interceptor.dependencies).toEqual(['auth-interceptor', 'logging-interceptor'])
    })

    it('should support route and method filtering', () => {
      const interceptor: Interceptor = {
        name: 'filtered-interceptor',
        order: 20,
        phase: 'request',
        enabled: true,
        handler: mock(async () => {}),
        routes: ['/api/auth/*', '/api/users/*'],
        methods: ['POST', 'PUT']
      }

      expect(interceptor.routes).toEqual(['/api/auth/*', '/api/users/*'])
      expect(interceptor.methods).toEqual(['POST', 'PUT'])
    })
  })

  describe('InterceptorHandler', () => {
    it('should call handler with correct parameters', async () => {
      const mockNext = mock(async () => {})
      const handler: InterceptorHandler = mock(async (ctx, interceptorCtx, next) => {
        expect(ctx).toBeDefined()
        expect(interceptorCtx.requestId).toBeDefined()
        expect(next).toBe(mockNext)
        await next()
      })

      const context = createMockContext()
      const interceptorContext: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        metadata: {},
        metrics: { interceptorTimings: {} },
        cacheKeys: [],
        security: { ip: '127.0.0.1', rateLimitKeys: [] }
      }

      await handler(context, interceptorContext, mockNext)

      expect(handler).toHaveBeenCalledWith(context, interceptorContext, mockNext)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle async operations', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
      
      const handler: InterceptorHandler = async (ctx, interceptorCtx, next) => {
        const start = Date.now()
        await delay(10)
        await next()
        const duration = Date.now() - start
        interceptorCtx.metadata.duration = duration
      }

      const context = createMockContext()
      const interceptorContext: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        metadata: {},
        metrics: { interceptorTimings: {} },
        cacheKeys: [],
        security: { ip: '127.0.0.1', rateLimitKeys: [] }
      }

      await handler(context, interceptorContext, async () => {})

      expect(interceptorContext.metadata.duration).toBeGreaterThan(0)
    })

    it('should propagate errors correctly', async () => {
      const errorHandler: InterceptorHandler = async (ctx, interceptorCtx, next) => {
        throw new Error('Test error')
      }

      const context = createMockContext()
      const interceptorContext: InterceptorContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        metadata: {},
        metrics: { interceptorTimings: {} },
        cacheKeys: [],
        security: { ip: '127.0.0.1', rateLimitKeys: [] }
      }

      await expect(
        errorHandler(context, interceptorContext, async () => {})
      ).rejects.toThrow('Test error')
    })

    it('should create InterceptorError for system errors', () => {
      const error = new InterceptorError(
        'Test interceptor failed',
        'test-interceptor',
        'request',
        new Error('Original error')
      )

      expect(error.message).toBe('Test interceptor failed')
      expect(error.interceptorName).toBe('test-interceptor')
      expect(error.phase).toBe('request')
      expect(error.cause).toBeInstanceOf(Error)
      expect(error.name).toBe('InterceptorError')
    })
  })
})