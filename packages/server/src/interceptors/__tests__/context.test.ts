import { describe, expect, it, beforeEach, mock } from 'bun:test'
import {
  InterceptorContextManager,
  createContextMiddleware,
  withInterceptorContext,
  TypedMetadata,
  createTypedMetadata
} from '../context'
import type { Context } from 'hono'
import type { InterceptorContext } from '../types'

describe('InterceptorContextManager', () => {
  let mockContext: Context

  beforeEach(() => {
    mockContext = {
      req: {
        header: mock((name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1'
          if (name === 'user-agent') return 'Test Agent'
          return undefined
        })
      },
      set: mock(),
      get: mock((key: string) => {
        if (key === 'requestId') return 'req-123'
        return undefined
      })
    } as unknown as Context
  })

  describe('create', () => {
    it('should create interceptor context with default values', () => {
      const context = InterceptorContextManager.create()

      expect(context.requestId).toBeDefined()
      expect(context.startTime).toBeTypeOf('number')
      expect(context.metadata).toEqual({})
      expect(context.metrics.interceptorTimings).toEqual({})
      expect(context.cacheKeys).toEqual([])
      expect(context.security.ip).toBe('unknown')
      expect(context.security.rateLimitKeys).toEqual([])
    })

    it('should create context with provided values', () => {
      const context = InterceptorContextManager.create('custom-req-id', '192.168.1.1', 'Custom Agent')

      expect(context.requestId).toBe('custom-req-id')
      expect(context.security.ip).toBe('192.168.1.1')
      expect(context.security.userAgent).toBe('Custom Agent')
    })
  })

  describe('store and retrieve', () => {
    it('should store and retrieve context', () => {
      const context = InterceptorContextManager.create()

      // Mock the get method to return the stored context
      mockContext.get = mock((key: string) => {
        if (key === 'interceptorContext') return context
        if (key === 'requestId') return 'req-123'
        return undefined
      })

      InterceptorContextManager.store(mockContext, context)
      const retrieved = InterceptorContextManager.retrieve(mockContext)

      expect(retrieved).toBe(context)
      expect(mockContext.set).toHaveBeenCalledWith('interceptorContext', context)
    })

    it('should return undefined if no context stored', () => {
      mockContext.get = mock(() => undefined)

      const retrieved = InterceptorContextManager.retrieve(mockContext)

      expect(retrieved).toBeUndefined()
    })
  })

  describe('getOrCreate', () => {
    it('should return existing context if available', () => {
      const existingContext = InterceptorContextManager.create()
      mockContext.get = mock(() => existingContext)

      const context = InterceptorContextManager.getOrCreate(mockContext)

      expect(context).toBe(existingContext)
    })

    it('should create new context if none exists', () => {
      mockContext.get = mock((key: string) => {
        if (key === 'requestId') return 'req-123'
        return undefined
      })

      const context = InterceptorContextManager.getOrCreate(mockContext)

      expect(context).toBeDefined()
      expect(context.requestId).toBe('req-123')
      expect(context.security.ip).toBe('192.168.1.1')
      expect(context.security.userAgent).toBe('Test Agent')
      expect(mockContext.set).toHaveBeenCalledWith('interceptorContext', context)
    })
  })

  describe('metadata operations', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      mockContext.get = mock(() => interceptorContext)
    })

    it('should update metadata', () => {
      InterceptorContextManager.updateMetadata(mockContext, 'testKey', 'testValue')

      expect(interceptorContext.metadata.testKey).toBe('testValue')
    })

    it('should get metadata', () => {
      interceptorContext.metadata.testKey = 'testValue'

      const value = InterceptorContextManager.getMetadata(mockContext, 'testKey')

      expect(value).toBe('testValue')
    })

    it('should return undefined for non-existent metadata', () => {
      const value = InterceptorContextManager.getMetadata(mockContext, 'nonExistent')

      expect(value).toBeUndefined()
    })
  })

  describe('cache key operations', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      mockContext.get = mock(() => interceptorContext)
    })

    it('should add cache key', () => {
      InterceptorContextManager.addCacheKey(mockContext, 'cache-key-1')

      expect(interceptorContext.cacheKeys).toContain('cache-key-1')
    })

    it('should not add duplicate cache keys', () => {
      InterceptorContextManager.addCacheKey(mockContext, 'cache-key-1')
      InterceptorContextManager.addCacheKey(mockContext, 'cache-key-1')

      expect(interceptorContext.cacheKeys.filter((k) => k === 'cache-key-1')).toHaveLength(1)
    })
  })

  describe('rate limit key operations', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      mockContext.get = mock(() => interceptorContext)
    })

    it('should add rate limit key', () => {
      InterceptorContextManager.addRateLimitKey(mockContext, 'rate-limit-key-1')

      expect(interceptorContext.security.rateLimitKeys).toContain('rate-limit-key-1')
    })

    it('should not add duplicate rate limit keys', () => {
      InterceptorContextManager.addRateLimitKey(mockContext, 'rate-limit-key-1')
      InterceptorContextManager.addRateLimitKey(mockContext, 'rate-limit-key-1')

      expect(interceptorContext.security.rateLimitKeys.filter((k) => k === 'rate-limit-key-1')).toHaveLength(1)
    })
  })

  describe('user operations', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      mockContext.get = mock(() => interceptorContext)
    })

    it('should set and get user', () => {
      const user = { id: 1, name: 'Test User' }

      InterceptorContextManager.setUser(mockContext, user)
      const retrievedUser = InterceptorContextManager.getUser(mockContext)

      expect(retrievedUser).toBe(user)
      expect(interceptorContext.user).toBe(user)
    })
  })

  describe('timing operations', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      mockContext.get = mock(() => interceptorContext)
    })

    it('should record and get timing', () => {
      InterceptorContextManager.recordTiming(mockContext, 'test-interceptor', 150)

      const timing = InterceptorContextManager.getTiming(mockContext, 'test-interceptor')
      expect(timing).toBe(150)
      expect(interceptorContext.metrics.interceptorTimings['test-interceptor']).toBe(150)
    })

    it('should get total time', () => {
      // Add a small delay to ensure time difference
      interceptorContext.startTime = Date.now() - 10

      const totalTime = InterceptorContextManager.getTotalTime(mockContext)

      expect(totalTime).toBeGreaterThan(0)
    })
  })

  describe('createLogger', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      mockContext.get = mock(() => interceptorContext)
    })

    it('should create context-aware logger', () => {
      const consoleLogSpy = mock(() => {})
      console.info = consoleLogSpy

      const logger = InterceptorContextManager.createLogger(mockContext)
      logger.info('Test message', { extra: 'data' })

      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('getSummary', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      interceptorContext.metadata.test = 'value'
      interceptorContext.cacheKeys.push('cache-1')
      interceptorContext.security.rateLimitKeys.push('rate-1')
      interceptorContext.metrics.interceptorTimings['test'] = 100
      interceptorContext.user = { id: 1 }
      mockContext.get = mock(() => interceptorContext)
    })

    it('should return context summary', () => {
      // Add a small delay to ensure time difference
      interceptorContext.startTime = Date.now() - 10

      const summary = InterceptorContextManager.getSummary(mockContext)

      expect(summary).toBeDefined()
      expect(summary!.requestId).toBe(interceptorContext.requestId)
      expect(summary!.totalTime).toBeGreaterThan(0)
      expect(summary!.interceptorCount).toBe(1)
      expect(summary!.cacheKeysCount).toBe(1)
      expect(summary!.rateLimitKeysCount).toBe(1)
      expect(summary!.hasUser).toBe(true)
      expect(summary!.metadataKeys).toEqual(['test'])
    })

    it('should return undefined if no context', () => {
      mockContext.get = mock(() => undefined)

      const summary = InterceptorContextManager.getSummary(mockContext)

      expect(summary).toBeUndefined()
    })
  })

  describe('exportContext', () => {
    let interceptorContext: InterceptorContext

    beforeEach(() => {
      interceptorContext = InterceptorContextManager.create()
      interceptorContext.security.ip = '192.168.1.100'
      interceptorContext.security.userAgent = 'Very long user agent string that should be truncated'
      mockContext.get = mock(() => interceptorContext)
    })

    it('should export sanitized context', () => {
      const exported = InterceptorContextManager.exportContext(mockContext)

      expect(exported).toBeDefined()
      expect(exported!.requestId).toBe(interceptorContext.requestId)
      expect(exported!.security!.ip).toBe('***.***.*.***') // IP masked
      expect(exported!.security!.userAgent).toContain('...') // UA truncated
      expect(exported!.user).toBeUndefined() // User omitted for security
      expect(exported!.metadata).toBeUndefined() // Metadata omitted for security
    })
  })
})

describe('createContextMiddleware', () => {
  it('should create context middleware', async () => {
    const middleware = createContextMiddleware()
    const mockContext = {
      req: { header: mock(() => undefined) },
      get: mock(() => undefined),
      set: mock()
    } as unknown as Context
    const mockNext = mock(async () => {})

    await middleware(mockContext, mockNext)

    expect(mockContext.set).toHaveBeenCalledWith('interceptorContext', expect.any(Object))
    expect(mockNext).toHaveBeenCalled()
  })
})

describe('withInterceptorContext', () => {
  it('should call callback with context', () => {
    const interceptorContext = InterceptorContextManager.create()
    const mockContext = {
      get: mock(() => interceptorContext)
    } as unknown as Context
    const callback = mock((ctx) => ctx.requestId)

    const result = withInterceptorContext(mockContext, callback)

    expect(callback).toHaveBeenCalledWith(interceptorContext)
    expect(result).toBe(interceptorContext.requestId)
  })

  it('should return undefined if no context', () => {
    const mockContext = {
      get: mock(() => undefined)
    } as unknown as Context
    const callback = mock()

    const result = withInterceptorContext(mockContext, callback)

    expect(callback).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})

describe('TypedMetadata', () => {
  let typedMetadata: TypedMetadata
  let mockContext: Context
  let interceptorContext: InterceptorContext

  beforeEach(() => {
    interceptorContext = InterceptorContextManager.create()
    mockContext = {
      get: mock(() => interceptorContext)
    } as unknown as Context
    typedMetadata = new TypedMetadata(mockContext)
  })

  it('should set and get typed metadata', () => {
    typedMetadata.set('stringKey', 'stringValue')
    typedMetadata.set('numberKey', 42)
    typedMetadata.set('objectKey', { test: true })

    expect(typedMetadata.get<string>('stringKey')).toBe('stringValue')
    expect(typedMetadata.get<number>('numberKey')).toBe(42)
    expect(typedMetadata.get<object>('objectKey')).toEqual({ test: true })
  })

  it('should get with default value', () => {
    const result = typedMetadata.getOrDefault('nonExistent', 'default')
    expect(result).toBe('default')
  })

  it('should check if key exists', () => {
    typedMetadata.set('existingKey', 'value')

    expect(typedMetadata.has('existingKey')).toBe(true)
    expect(typedMetadata.has('nonExistentKey')).toBe(false)
  })

  it('should remove metadata', () => {
    typedMetadata.set('keyToRemove', 'value')
    expect(typedMetadata.has('keyToRemove')).toBe(true)

    typedMetadata.remove('keyToRemove')
    expect(typedMetadata.has('keyToRemove')).toBe(false)
  })

  it('should get all keys', () => {
    typedMetadata.set('key1', 'value1')
    typedMetadata.set('key2', 'value2')

    const keys = typedMetadata.keys()
    expect(keys).toContain('key1')
    expect(keys).toContain('key2')
    expect(keys).toHaveLength(2)
  })
})

describe('createTypedMetadata', () => {
  it('should create TypedMetadata instance', () => {
    const mockContext = {} as Context
    const typedMetadata = createTypedMetadata(mockContext)

    expect(typedMetadata).toBeInstanceOf(TypedMetadata)
  })
})
