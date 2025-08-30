import { describe, expect, it, beforeEach } from 'bun:test'
import { DefaultInterceptorRegistry, createInterceptorRegistry } from '../registry'
import { type Interceptor, type InterceptorHandler, InterceptorRegistrationError } from '../types'

describe('DefaultInterceptorRegistry', () => {
  let registry: DefaultInterceptorRegistry

  beforeEach(() => {
    registry = new DefaultInterceptorRegistry()
  })

  const createMockInterceptor = (overrides: Partial<Interceptor> = {}): Interceptor => ({
    name: 'test-interceptor',
    order: 10,
    phase: 'request',
    enabled: true,
    handler: async () => {},
    ...overrides
  })

  describe('register', () => {
    it('should register a valid interceptor', () => {
      const interceptor = createMockInterceptor()

      registry.register(interceptor)

      expect(registry.has('test-interceptor')).toBe(true)
      expect(registry.get('test-interceptor')).toEqual(interceptor)
    })

    it('should throw error for duplicate names', () => {
      const interceptor = createMockInterceptor()

      registry.register(interceptor)

      expect(() => registry.register(interceptor)).toThrow(InterceptorRegistrationError)
    })

    it('should throw error for invalid name', () => {
      const interceptor = createMockInterceptor({ name: '' })

      expect(() => registry.register(interceptor)).toThrow(InterceptorRegistrationError)
    })

    it('should throw error for invalid order', () => {
      const interceptor = createMockInterceptor({ order: -1 })

      expect(() => registry.register(interceptor)).toThrow(InterceptorRegistrationError)
    })

    it('should throw error for invalid phase', () => {
      const interceptor = createMockInterceptor({ phase: 'invalid' as any })

      expect(() => registry.register(interceptor)).toThrow(InterceptorRegistrationError)
    })

    it('should throw error for invalid handler', () => {
      const interceptor = createMockInterceptor({ handler: 'not-a-function' as any })

      expect(() => registry.register(interceptor)).toThrow(InterceptorRegistrationError)
    })
  })

  describe('unregister', () => {
    it('should unregister existing interceptor', () => {
      const interceptor = createMockInterceptor()
      registry.register(interceptor)

      const result = registry.unregister('test-interceptor')

      expect(result).toBe(true)
      expect(registry.has('test-interceptor')).toBe(false)
    })

    it('should return false for non-existent interceptor', () => {
      const result = registry.unregister('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('getByPhase', () => {
    it('should return interceptors for specific phase', () => {
      const requestInterceptor = createMockInterceptor({
        name: 'request-interceptor',
        phase: 'request'
      })
      const responseInterceptor = createMockInterceptor({
        name: 'response-interceptor',
        phase: 'response'
      })

      registry.register(requestInterceptor)
      registry.register(responseInterceptor)

      const requestInterceptors = registry.getByPhase('request')
      const responseInterceptors = registry.getByPhase('response')

      expect(requestInterceptors).toHaveLength(1)
      expect(requestInterceptors[0].name).toBe('request-interceptor')
      expect(responseInterceptors).toHaveLength(1)
      expect(responseInterceptors[0].name).toBe('response-interceptor')
    })

    it('should return interceptors sorted by order', () => {
      const interceptor1 = createMockInterceptor({ name: 'interceptor-1', order: 20 })
      const interceptor2 = createMockInterceptor({ name: 'interceptor-2', order: 10 })
      const interceptor3 = createMockInterceptor({ name: 'interceptor-3', order: 30 })

      registry.register(interceptor1)
      registry.register(interceptor2)
      registry.register(interceptor3)

      const interceptors = registry.getByPhase('request')

      expect(interceptors.map((i) => i.name)).toEqual(['interceptor-2', 'interceptor-1', 'interceptor-3'])
    })
  })

  describe('setEnabled', () => {
    it('should enable/disable interceptor', () => {
      const interceptor = createMockInterceptor()
      registry.register(interceptor)

      let result = registry.setEnabled('test-interceptor', false)
      expect(result).toBe(true)
      expect(registry.get('test-interceptor')?.enabled).toBe(false)

      result = registry.setEnabled('test-interceptor', true)
      expect(result).toBe(true)
      expect(registry.get('test-interceptor')?.enabled).toBe(true)
    })

    it('should return false for non-existent interceptor', () => {
      const result = registry.setEnabled('non-existent', false)
      expect(result).toBe(false)
    })
  })

  describe('getMatching', () => {
    beforeEach(() => {
      // Register test interceptors
      registry.register(
        createMockInterceptor({
          name: 'all-routes',
          phase: 'request'
        })
      )

      registry.register(
        createMockInterceptor({
          name: 'api-only',
          phase: 'request',
          routes: ['/api/*']
        })
      )

      registry.register(
        createMockInterceptor({
          name: 'post-only',
          phase: 'request',
          methods: ['POST']
        })
      )

      registry.register(
        createMockInterceptor({
          name: 'disabled',
          phase: 'request',
          enabled: false
        })
      )
    })

    it('should match interceptors without route/method filters', () => {
      const interceptors = registry.getMatching('/any/route', 'GET', 'request')

      const names = interceptors.map((i) => i.name)
      expect(names).toContain('all-routes')
      expect(names).not.toContain('disabled')
    })

    it('should match interceptors with route patterns', () => {
      const interceptors = registry.getMatching('/api/users', 'GET', 'request')

      const names = interceptors.map((i) => i.name)
      expect(names).toContain('all-routes')
      expect(names).toContain('api-only')
    })

    it('should not match interceptors with non-matching routes', () => {
      const interceptors = registry.getMatching('/public/docs', 'GET', 'request')

      const names = interceptors.map((i) => i.name)
      expect(names).toContain('all-routes')
      expect(names).not.toContain('api-only')
    })

    it('should match interceptors with method filters', () => {
      const interceptors = registry.getMatching('/any/route', 'POST', 'request')

      const names = interceptors.map((i) => i.name)
      expect(names).toContain('all-routes')
      expect(names).toContain('post-only')
    })

    it('should not match interceptors with non-matching methods', () => {
      const interceptors = registry.getMatching('/any/route', 'GET', 'request')

      const names = interceptors.map((i) => i.name)
      expect(names).toContain('all-routes')
      expect(names).not.toContain('post-only')
    })

    it('should not match disabled interceptors', () => {
      const interceptors = registry.getMatching('/any/route', 'GET', 'request')

      const names = interceptors.map((i) => i.name)
      expect(names).not.toContain('disabled')
    })
  })

  describe('getByTag', () => {
    it('should return interceptors with specific tag', () => {
      registry.register(
        createMockInterceptor({
          name: 'auth-interceptor',
          tags: ['auth', 'security']
        })
      )
      registry.register(
        createMockInterceptor({
          name: 'cache-interceptor',
          tags: ['cache', 'performance']
        })
      )

      const authInterceptors = registry.getByTag('auth')
      expect(authInterceptors).toHaveLength(1)
      expect(authInterceptors[0].name).toBe('auth-interceptor')

      const securityInterceptors = registry.getByTag('security')
      expect(securityInterceptors).toHaveLength(1)
      expect(securityInterceptors[0].name).toBe('auth-interceptor')
    })
  })

  describe('validateDependencies', () => {
    it('should validate satisfied dependencies', () => {
      registry.register(createMockInterceptor({ name: 'base' }))
      registry.register(
        createMockInterceptor({
          name: 'dependent',
          dependencies: ['base']
        })
      )

      const result = registry.validateDependencies()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing dependencies', () => {
      registry.register(
        createMockInterceptor({
          name: 'dependent',
          dependencies: ['missing']
        })
      )

      const result = registry.validateDependencies()
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("depends on 'missing' which is not registered")
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register(createMockInterceptor({ name: 'req1', phase: 'request' }))
      registry.register(createMockInterceptor({ name: 'req2', phase: 'request', enabled: false }))
      registry.register(createMockInterceptor({ name: 'res1', phase: 'response' }))

      const stats = registry.getStats()

      expect(stats.total).toBe(3)
      expect(stats.enabled).toBe(2)
      expect(stats.disabled).toBe(1)
      expect(stats.byPhase.request).toBe(2)
      expect(stats.byPhase.response).toBe(1)
      expect(stats.byPhase.error).toBe(0)
    })
  })

  describe('clear', () => {
    it('should remove all interceptors', () => {
      registry.register(createMockInterceptor({ name: 'interceptor1' }))
      registry.register(createMockInterceptor({ name: 'interceptor2' }))

      expect(registry.getAll()).toHaveLength(2)

      registry.clear()

      expect(registry.getAll()).toHaveLength(0)
    })
  })
})

describe('createInterceptorRegistry', () => {
  it('should create new registry instance', () => {
    const registry = createInterceptorRegistry()

    expect(registry).toBeInstanceOf(DefaultInterceptorRegistry)
    expect(registry.getAll()).toHaveLength(0)
  })
})
