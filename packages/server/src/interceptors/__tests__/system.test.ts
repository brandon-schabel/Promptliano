import { describe, expect, it, beforeEach, mock } from 'bun:test'
import {
  InterceptorSystem,
  createInterceptorSystem,
  getGlobalInterceptorSystem,
  setGlobalInterceptorSystem,
  setupInterceptors,
  InterceptorUtils
} from '../index'
import type { Interceptor } from '../types'
import type { Hono } from 'hono'

describe('InterceptorSystem', () => {
  let system: InterceptorSystem
  let mockApp: Hono

  beforeEach(() => {
    // Create system with explicit enabled config for testing
    system = new InterceptorSystem({ enabled: true })
    mockApp = {
      use: mock(),
      onError: mock()
    } as unknown as Hono
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

  describe('constructor', () => {
    it('should create system with default configuration', () => {
      const stats = system.getStats()

      expect(stats.interceptorCount).toBe(0)
      expect(stats.config.enabled).toBe(true)
    })
  })

  describe('register', () => {
    it('should register single interceptor', () => {
      const interceptor = createMockInterceptor()

      system.register(interceptor)
      const stats = system.getStats()

      expect(stats.interceptorCount).toBe(1)
      expect(stats.enabledCount).toBe(1)
    })

    it('should register multiple interceptors', () => {
      const interceptors = [
        createMockInterceptor({ name: 'interceptor1' }),
        createMockInterceptor({ name: 'interceptor2' }),
        createMockInterceptor({ name: 'interceptor3', enabled: false })
      ]

      system.registerMany(interceptors)
      const stats = system.getStats()

      expect(stats.interceptorCount).toBe(3)
      expect(stats.enabledCount).toBe(2)
    })
  })

  describe('applyTo', () => {
    it('should apply interceptor system to Hono app', () => {
      const interceptor = createMockInterceptor()
      system.register(interceptor)

      system.applyTo(mockApp)

      // Should add context middleware, request interceptors, response interceptors, and error handler
      expect(mockApp.use).toHaveBeenCalledTimes(3)
      expect(mockApp.onError).toHaveBeenCalledTimes(1)
    })

    it('should not apply if system is disabled', () => {
      system.setEnabled(false)

      system.applyTo(mockApp)

      expect(mockApp.use).not.toHaveBeenCalled()
      expect(mockApp.onError).not.toHaveBeenCalled()
    })
  })

  describe('getRegistry', () => {
    it('should return registry instance', () => {
      const registry = system.getRegistry()

      expect(registry).toBeDefined()
      expect(typeof registry.register).toBe('function')
      expect(typeof registry.getAll).toBe('function')
    })
  })

  describe('getStats', () => {
    it('should return system statistics', () => {
      const interceptor1 = createMockInterceptor({ name: 'interceptor1' })
      const interceptor2 = createMockInterceptor({ name: 'interceptor2', enabled: false })

      system.register(interceptor1)
      system.register(interceptor2)

      const stats = system.getStats()

      expect(stats.interceptorCount).toBe(2)
      expect(stats.enabledCount).toBe(1)
      expect(stats.registryStats.total).toBe(2)
      expect(stats.registryStats.enabled).toBe(1)
      expect(stats.registryStats.disabled).toBe(1)
      expect(stats.config).toBeDefined()
    })
  })

  describe('setEnabled', () => {
    it('should enable/disable system', () => {
      // System should start enabled due to our explicit config
      expect(system.getStats().config.enabled).toBe(true)

      system.setEnabled(false)
      expect(system.getStats().config.enabled).toBe(false)

      system.setEnabled(true)
      expect(system.getStats().config.enabled).toBe(true)
    })
  })

  describe('updateConfig', () => {
    it('should update system configuration', () => {
      const newConfig = {
        chain: {
          continueOnError: true,
          timeoutMs: 5000
        }
      }

      system.updateConfig(newConfig)
      const config = system.getStats().config

      expect(config.chain?.continueOnError).toBe(true)
      expect(config.chain?.timeoutMs).toBe(5000)
    })
  })

  describe('clear', () => {
    it('should clear all interceptors', () => {
      system.register(createMockInterceptor({ name: 'interceptor1' }))
      system.register(createMockInterceptor({ name: 'interceptor2' }))

      expect(system.getStats().interceptorCount).toBe(2)

      system.clear()

      expect(system.getStats().interceptorCount).toBe(0)
    })
  })
})

describe('Factory Functions', () => {
  describe('createInterceptorSystem', () => {
    it('should create new system instance', () => {
      const system = createInterceptorSystem()

      expect(system).toBeInstanceOf(InterceptorSystem)
      expect(system.getStats().interceptorCount).toBe(0)
    })

    it('should accept config overrides', () => {
      const config = { enabled: false }
      const system = createInterceptorSystem(config)

      expect(system.getStats().config.enabled).toBe(false)
    })
  })

  describe('getGlobalInterceptorSystem', () => {
    it('should return global system instance', () => {
      const system1 = getGlobalInterceptorSystem()
      const system2 = getGlobalInterceptorSystem()

      expect(system1).toBe(system2)
      expect(system1).toBeInstanceOf(InterceptorSystem)
    })
  })

  describe('setGlobalInterceptorSystem', () => {
    it('should set global system instance', () => {
      const customSystem = createInterceptorSystem()
      setGlobalInterceptorSystem(customSystem)

      const retrievedSystem = getGlobalInterceptorSystem()
      expect(retrievedSystem).toBe(customSystem)
    })
  })

  describe('setupInterceptors', () => {
    let mockApp: Hono

    beforeEach(() => {
      mockApp = {
        use: mock(),
        onError: mock()
      } as unknown as Hono
    })

    it('should setup interceptors with default options', () => {
      const system = setupInterceptors(mockApp, {
        config: { enabled: true }
      })

      expect(system).toBeInstanceOf(InterceptorSystem)
      expect(mockApp.use).toHaveBeenCalled()
    })

    it('should register custom interceptors', () => {
      const customInterceptors = [
        createMockInterceptor({ name: 'custom1' }),
        createMockInterceptor({ name: 'custom2' })
      ]

      const system = setupInterceptors(mockApp, {
        interceptors: customInterceptors
      })

      expect(system.getStats().interceptorCount).toBe(2)
    })

    it('should apply config overrides', () => {
      const system = setupInterceptors(mockApp, {
        config: { enabled: false }
      })

      expect(system.getStats().config.enabled).toBe(false)
    })
  })
})

describe('InterceptorUtils', () => {
  describe('createLoggingInterceptor', () => {
    it('should create logging interceptor with defaults', () => {
      const interceptor = InterceptorUtils.createLoggingInterceptor()

      expect(interceptor.name).toBe('logger')
      expect(interceptor.order).toBe(10)
      expect(interceptor.phase).toBe('request')
      expect(interceptor.enabled).toBe(true)
      expect(typeof interceptor.handler).toBe('function')
    })

    it('should create logging interceptor with custom name and order', () => {
      const interceptor = InterceptorUtils.createLoggingInterceptor('custom-logger', 5)

      expect(interceptor.name).toBe('custom-logger')
      expect(interceptor.order).toBe(5)
    })

    it('should log request information', async () => {
      const consoleLogSpy = mock(() => {})
      console.log = consoleLogSpy

      const interceptor = InterceptorUtils.createLoggingInterceptor()
      const mockContext = {
        req: { method: 'GET', path: '/api/test' }
      } as any
      const interceptorContext = {
        requestId: 'req-123'
      } as any
      const mockNext = mock(async () => {})

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(consoleLogSpy).toHaveBeenCalledTimes(2) // Start and end logs
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('createTimingInterceptor', () => {
    it('should create timing interceptor', () => {
      const interceptor = InterceptorUtils.createTimingInterceptor()

      expect(interceptor.name).toBe('timer')
      expect(interceptor.order).toBe(5)
      expect(interceptor.phase).toBe('request')
    })

    it('should measure response time', async () => {
      const interceptor = InterceptorUtils.createTimingInterceptor()
      const mockContext = {
        header: mock()
      } as any
      const interceptorContext = {
        metadata: {}
      } as any
      const mockNext = mock(async () => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(interceptorContext.metadata.responseTime).toBeGreaterThan(0)
      expect(mockContext.header).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/\d+ms/))
    })
  })

  describe('createRequestIdInterceptor', () => {
    it('should create request ID interceptor', () => {
      const interceptor = InterceptorUtils.createRequestIdInterceptor()

      expect(interceptor.name).toBe('request-id')
      expect(interceptor.order).toBe(1)
      expect(interceptor.phase).toBe('request')
    })

    it('should add request ID header', async () => {
      const interceptor = InterceptorUtils.createRequestIdInterceptor()
      const mockContext = {
        header: mock()
      } as any
      const interceptorContext = {
        requestId: 'req-123'
      } as any
      const mockNext = mock(async () => {})

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.header).toHaveBeenCalledWith('X-Request-ID', 'req-123')
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('createCorsInterceptor', () => {
    it('should create CORS interceptor with defaults', () => {
      const interceptor = InterceptorUtils.createCorsInterceptor()

      expect(interceptor.name).toBe('cors')
      expect(interceptor.order).toBe(15)
      expect(interceptor.phase).toBe('response')
    })

    it('should add CORS headers', async () => {
      const interceptor = InterceptorUtils.createCorsInterceptor('cors', 15, ['https://example.com'])
      const mockContext = {
        header: mock()
      } as any
      const interceptorContext = {} as any
      const mockNext = mock(async () => {})

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com')
      expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      expect(mockNext).toHaveBeenCalled()
    })
  })
})

// Helper function to create mock interceptor (reused in tests)
function createMockInterceptor(overrides: Partial<Interceptor> = {}): Interceptor {
  return {
    name: 'test-interceptor',
    order: 10,
    phase: 'request',
    enabled: true,
    handler: mock(async (ctx, interceptorCtx, next) => {
      await next()
    }),
    ...overrides
  }
}
