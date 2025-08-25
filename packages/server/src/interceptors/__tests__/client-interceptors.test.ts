import { describe, expect, it, beforeEach, mock } from 'bun:test'
import {
  ClientInterceptorSystem,
  createClientInterceptor,
  ClientInterceptorContext,
  ClientRequestInterceptor,
  ClientResponseInterceptor,
  ClientErrorInterceptor,
  type ClientInterceptorConfig
} from '../client-interceptors'

describe('ClientInterceptorSystem', () => {
  let system: ClientInterceptorSystem
  let mockFetch: ReturnType<typeof mock>

  beforeEach(() => {
    system = new ClientInterceptorSystem()
    mockFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ success: true, data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })
    global.fetch = mockFetch as any
  })

  describe('constructor', () => {
    it('should create system with default config', () => {
      const config = system.getConfig()
      
      expect(config.enabled).toBe(true)
      expect(config.timeout).toBe(30000)
      expect(config.retries).toBe(3)
    })

    it('should create system with custom config', () => {
      const customConfig: ClientInterceptorConfig = {
        enabled: false,
        timeout: 5000,
        retries: 1,
        baseURL: 'https://api.example.com'
      }
      
      const customSystem = new ClientInterceptorSystem(customConfig)
      const config = customSystem.getConfig()
      
      expect(config.enabled).toBe(false)
      expect(config.timeout).toBe(5000)
      expect(config.retries).toBe(1)
      expect(config.baseURL).toBe('https://api.example.com')
    })
  })

  describe('request interceptors', () => {
    it('should register and execute request interceptors', async () => {
      const interceptor1 = createClientInterceptor({
        name: 'auth-interceptor',
        type: 'request',
        order: 10,
        handler: async (context) => {
          context.request.headers.set('Authorization', 'Bearer token123')
          return context
        }
      })

      const interceptor2 = createClientInterceptor({
        name: 'json-interceptor',
        type: 'request',
        order: 20,
        handler: async (context) => {
          context.request.headers.set('Content-Type', 'application/json')
          return context
        }
      })

      system.addInterceptor(interceptor1)
      system.addInterceptor(interceptor2)

      await system.fetch('/api/test')

      // Check that mockFetch was called with a Request that has the correct headers
      expect(mockFetch).toHaveBeenCalled()
      const [request] = mockFetch.mock.calls[0] as any[]
      expect(request).toBeInstanceOf(Request)
      expect(request.headers.get('Authorization')).toBe('Bearer token123')
      expect(request.headers.get('Content-Type')).toBe('application/json')
    })

    it('should execute interceptors in order', async () => {
      const executionOrder: string[] = []

      const interceptor1 = createClientInterceptor({
        name: 'first',
        type: 'request',
        order: 10,
        handler: async (context) => {
          executionOrder.push('first')
          return context
        }
      })

      const interceptor2 = createClientInterceptor({
        name: 'second',
        type: 'request',
        order: 5,
        handler: async (context) => {
          executionOrder.push('second')
          return context
        }
      })

      system.addInterceptor(interceptor1)
      system.addInterceptor(interceptor2)

      await system.fetch('/api/test')

      expect(executionOrder).toEqual(['second', 'first'])
    })

    it('should allow interceptors to modify request', async () => {
      const interceptor = createClientInterceptor({
        name: 'url-modifier',
        type: 'request',
        order: 10,
        handler: async (context) => {
          const url = new URL(context.request.url)
          url.searchParams.set('modified', 'true')
          context.request = new Request(url.toString(), context.request)
          return context
        }
      })

      system.addInterceptor(interceptor)

      await system.fetch('/api/test')

      const calledUrl = (mockFetch.mock.calls[0] as any[])[0].url
      expect(calledUrl).toContain('modified=true')
    })
  })

  describe('response interceptors', () => {
    it('should register and execute response interceptors', async () => {
      const interceptor = createClientInterceptor({
        name: 'response-logger',
        type: 'response',
        order: 10,
        handler: async (context) => {
          context.metadata.logged = true
          return context
        }
      })

      system.addInterceptor(interceptor)

      const response = await system.fetch('/api/test')
      
      expect(response).toBeDefined()
      expect(response.status).toBe(200)
    })

    it('should allow response transformation', async () => {
      const interceptor = createClientInterceptor({
        name: 'response-transformer',
        type: 'response',
        order: 10,
        handler: async (context) => {
          if (context.response.ok) {
            const data = await context.response.json()
            context.response = new Response(
              JSON.stringify({ ...data, transformed: true }),
              { 
                status: context.response.status,
                headers: context.response.headers
              }
            )
          }
          return context
        }
      })

      system.addInterceptor(interceptor)

      const response = await system.fetch('/api/test')
      const data = await response.json()
      
      expect(data.transformed).toBe(true)
    })
  })

  describe('error interceptors', () => {
    it('should handle fetch errors', async () => {
      const errorInterceptor = createClientInterceptor({
        name: 'error-handler',
        type: 'error',
        order: 10,
        handler: async (context) => {
          context.metadata.errorHandled = true
          // Return a fallback response
          context.response = new Response(
            JSON.stringify({ error: 'Handled by interceptor' }),
            { status: 500 }
          )
          return context
        }
      })

      // Make fetch throw an error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      system.addInterceptor(errorInterceptor)

      const response = await system.fetch('/api/test')
      const data = await response.json()
      
      expect(data.error).toBe('Handled by interceptor')
    })

    it('should handle HTTP error responses', async () => {
      const errorInterceptor = createClientInterceptor({
        name: 'http-error-handler',
        type: 'error',
        order: 10,
        handler: async (context) => {
          if (context.response && !context.response.ok) {
            context.metadata.httpErrorHandled = true
          }
          return context
        }
      })

      // Mock a 404 response
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      )

      system.addInterceptor(errorInterceptor)

      const response = await system.fetch('/api/test')
      
      expect(response.status).toBe(404)
    })
  })

  describe('timeout handling', () => {
    it('should timeout requests after configured time', async () => {
      const shortTimeoutSystem = new ClientInterceptorSystem({
        timeout: 100 // 100ms timeout
      })

      // Mock a slow response that respects the abort signal
      mockFetch.mockImplementationOnce((request, options) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve(new Response('Too slow'))
          }, 500)
          
          // Respect the abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(new Error('Request timeout'))
            })
          }
        })
      })

      await expect(shortTimeoutSystem.fetch('/api/slow')).rejects.toThrow('Request timeout')
    })

    it('should allow timeout override per request', async () => {
      // Mock a slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(new Response('OK')), 200)
        )
      )

      const response = await system.fetch('/api/slow', {
        timeout: 300 // Override timeout to 300ms
      })
      
      expect(response).toBeDefined()
    })
  })

  describe('retry mechanism', () => {
    it('should retry failed requests', async () => {
      let attemptCount = 0
      mockFetch.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          // Make it a network error by creating a TypeError with 'fetch' in the message
          const error = new TypeError('fetch failed: network error')
          throw error
        }
        return Promise.resolve(new Response('Success'))
      })

      const response = await system.fetch('/api/test')
      
      expect(attemptCount).toBe(3)
      expect(response).toBeDefined()
    })

    it('should respect retry limit', async () => {
      const limitedRetrySystem = new ClientInterceptorSystem({
        retries: 1
      })

      let attemptCount = 0
      mockFetch.mockImplementation(() => {
        attemptCount++
        // Make it a network error by creating a TypeError with 'fetch' in the message
        const error = new TypeError('fetch failed')
        throw error
      })

      await expect(limitedRetrySystem.fetch('/api/test')).rejects.toThrow()
      expect(attemptCount).toBe(2) // Original + 1 retry
    })
  })

  describe('interceptor management', () => {
    it('should remove interceptors', () => {
      const interceptor = createClientInterceptor({
        name: 'test-interceptor',
        type: 'request',
        order: 10,
        handler: async (context) => context
      })

      system.addInterceptor(interceptor)
      expect(system.getInterceptors()).toHaveLength(1)

      system.removeInterceptor('test-interceptor')
      expect(system.getInterceptors()).toHaveLength(0)
    })

    it('should clear all interceptors', () => {
      system.addInterceptor(createClientInterceptor({
        name: 'interceptor1',
        type: 'request',
        order: 10,
        handler: async (context) => context
      }))

      system.addInterceptor(createClientInterceptor({
        name: 'interceptor2',
        type: 'response',
        order: 10,
        handler: async (context) => context
      }))

      expect(system.getInterceptors()).toHaveLength(2)

      system.clearInterceptors()
      expect(system.getInterceptors()).toHaveLength(0)
    })

    it('should enable/disable interceptors', () => {
      const interceptor = createClientInterceptor({
        name: 'test-interceptor',
        type: 'request',
        order: 10,
        handler: async (context) => context
      })

      system.addInterceptor(interceptor)
      
      system.setInterceptorEnabled('test-interceptor', false)
      const disabled = system.getInterceptors().find(i => i.name === 'test-interceptor')
      expect(disabled?.enabled).toBe(false)

      system.setInterceptorEnabled('test-interceptor', true)
      const enabled = system.getInterceptors().find(i => i.name === 'test-interceptor')
      expect(enabled?.enabled).toBe(true)
    })
  })

  describe('request context', () => {
    it('should provide rich context to interceptors', async () => {
      let capturedContext: ClientInterceptorContext | undefined

      const interceptor = createClientInterceptor({
        name: 'context-capturer',
        type: 'request',
        order: 10,
        handler: async (context) => {
          capturedContext = context
          return context
        }
      })

      system.addInterceptor(interceptor)

      await system.fetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })

      expect(capturedContext).toBeDefined()
      expect(capturedContext!.request).toBeInstanceOf(Request)
      expect(capturedContext!.metadata).toBeTypeOf('object')
      expect(capturedContext!.startTime).toBeTypeOf('number')
      expect(capturedContext!.attempt).toBe(1)
    })

    it('should track request timing', async () => {
      let requestContext: ClientInterceptorContext | undefined
      let responseContext: ClientInterceptorContext | undefined

      const requestInterceptor = createClientInterceptor({
        name: 'request-timer',
        type: 'request',
        order: 10,
        handler: async (context) => {
          requestContext = context
          return context
        }
      })

      const responseInterceptor = createClientInterceptor({
        name: 'response-timer',
        type: 'response',
        order: 10,
        handler: async (context) => {
          responseContext = context
          return context
        }
      })

      system.addInterceptor(requestInterceptor)
      system.addInterceptor(responseInterceptor)

      await system.fetch('/api/test')

      expect(requestContext?.startTime).toBeDefined()
      expect(responseContext?.duration).toBeTypeOf('number')
      expect(responseContext?.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('system configuration', () => {
    it('should disable system when configured', async () => {
      const disabledSystem = new ClientInterceptorSystem({ enabled: false })
      
      const interceptor = createClientInterceptor({
        name: 'should-not-run',
        type: 'request',
        order: 10,
        handler: async (context) => {
          throw new Error('Interceptor should not run when system is disabled')
        }
      })

      disabledSystem.addInterceptor(interceptor)

      // Should make direct fetch call without interceptors
      const response = await disabledSystem.fetch('/api/test')
      expect(response).toBeDefined()
    })

    it('should update configuration at runtime', () => {
      system.updateConfig({ timeout: 5000, retries: 1 })
      const config = system.getConfig()
      
      expect(config.timeout).toBe(5000)
      expect(config.retries).toBe(1)
    })
  })
})

describe('createClientInterceptor helper', () => {
  it('should create request interceptor', () => {
    const interceptor = createClientInterceptor({
      name: 'test-request',
      type: 'request',
      order: 10,
      handler: async (context) => context
    })

    expect(interceptor.name).toBe('test-request')
    expect(interceptor.type).toBe('request')
    expect(interceptor.order).toBe(10)
    expect(interceptor.enabled).toBe(true)
    expect(typeof interceptor.handler).toBe('function')
  })

  it('should create response interceptor', () => {
    const interceptor = createClientInterceptor({
      name: 'test-response',
      type: 'response',
      order: 5,
      enabled: false,
      handler: async (context) => context
    })

    expect(interceptor.name).toBe('test-response')
    expect(interceptor.type).toBe('response')
    expect(interceptor.order).toBe(5)
    expect(interceptor.enabled).toBe(false)
  })

  it('should create error interceptor', () => {
    const interceptor = createClientInterceptor({
      name: 'test-error',
      type: 'error',
      order: 1,
      handler: async (context) => context
    })

    expect(interceptor.name).toBe('test-error')
    expect(interceptor.type).toBe('error')
    expect(interceptor.order).toBe(1)
  })
})