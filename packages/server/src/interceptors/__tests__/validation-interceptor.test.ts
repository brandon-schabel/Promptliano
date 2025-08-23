import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { createValidationInterceptor } from '../request/validation-interceptor'
import type { Context } from 'hono'
import type { InterceptorContext, ValidationInterceptorConfig } from '../types'
import { z } from 'zod'

describe('Validation Interceptor', () => {
  let mockContext: Context
  let interceptorContext: InterceptorContext
  let mockNext: ReturnType<typeof mock<() => Promise<void>>>

  beforeEach(() => {
    mockContext = {
      req: {
        method: 'POST',
        path: '/api/users',
        header: mock((name: string) => {
          if (name === 'content-type') return 'application/json'
          return undefined
        }) as any,
        json: mock(async () => ({
          name: 'John Doe',
          email: 'john@example.com',
          age: 30
        })) as any,
        query: mock((key?: string) => {
          if (key === 'sort') return 'name'
          if (key === 'limit') return '10'
          return undefined
        }) as any,
        param: mock((key: string) => {
          if (key === 'id') return '123'
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
    })
  })

  describe('createValidationInterceptor', () => {
    it('should create interceptor with default configuration', () => {
      const interceptor = createValidationInterceptor()

      expect(interceptor.name).toBe('validation-interceptor')
      expect(interceptor.phase).toBe('request')
      expect(interceptor.order).toBe(15)
      expect(interceptor.enabled).toBe(true)
      expect(interceptor.config.enabled).toBe(true)
    })

    it('should create interceptor with custom configuration', () => {
      const bodySchema = z.object({
        name: z.string(),
        email: z.string().email()
      })

      const config: Partial<ValidationInterceptorConfig> = {
        enabled: true,
        validateBody: true,
        validateQuery: true,
        validateParams: true,
        schemas: {
          '/api/users': {
            POST: { body: bodySchema }
          }
        },
        onValidationError: mock()
      }

      const interceptor = createValidationInterceptor(config)

      expect(interceptor.config.validateBody).toBe(true)
      expect(interceptor.config.validateQuery).toBe(true)
      expect(interceptor.config.schemas).toBeDefined()
    })
  })

  describe('body validation', () => {
    it('should validate request body successfully', async () => {
      const bodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0).max(150)
      })

      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: { body: bodySchema }
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(interceptorContext.metadata.validation).toEqual({
        bodyValid: true,
        queryValid: true,
        paramsValid: true
      })
    })

    it('should reject invalid request body', async () => {
      const bodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0).max(150)
      })

      ;(mockContext.req as any).json = mock(async () => ({
        name: '', // Invalid: empty string
        email: 'invalid-email', // Invalid: not an email
        age: -5 // Invalid: negative age
      }))

      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: { body: bodySchema }
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.status).toHaveBeenCalledWith(400)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: expect.objectContaining({
            body: expect.any(Array)
          })
        }
      })
    })

    it('should handle missing request body for required validation', async () => {
      const bodySchema = z.object({
        name: z.string(),
        email: z.string().email()
      })

      ;(mockContext.req as any).json = mock(async () => {
        throw new Error('No body provided')
      })

      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: { body: bodySchema }
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.status).toHaveBeenCalledWith(400)
    })
  })

  describe('query validation', () => {
    it('should validate query parameters successfully', async () => {
      const querySchema = z.object({
        sort: z.string().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional()
      })

      const interceptor = createValidationInterceptor({
        validateQuery: true,
        schemas: {
          '/api/users': {
            GET: { query: querySchema }
          }
        }
      })

      ;(mockContext.req as any).method = 'GET'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(interceptorContext.metadata.validation?.queryValid).toBe(true)
    })

    it('should reject invalid query parameters', async () => {
      const querySchema = z.object({
        limit: z.string().regex(/^\d+$/).transform(Number),
        sort: z.enum(['name', 'email', 'age'])
      })

      ;(mockContext.req as any).query = mock((key?: string) => {
        if (key === 'limit') return 'invalid' // Invalid: not a number
        if (key === 'sort') return 'invalid_field' // Invalid: not in enum
        return undefined
      })

      const interceptor = createValidationInterceptor({
        validateQuery: true,
        schemas: {
          '/api/users': {
            GET: { query: querySchema }
          }
        }
      })

      ;(mockContext.req as any).method = 'GET'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.status).toHaveBeenCalledWith(400)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: expect.objectContaining({
            query: expect.any(Array)
          })
        }
      })
    })
  })

  describe('params validation', () => {
    it('should validate path parameters successfully', async () => {
      const paramsSchema = z.object({
        id: z.string().regex(/^\d+$/).transform(Number)
      })

      const interceptor = createValidationInterceptor({
        validateParams: true,
        schemas: {
          '/api/users/:id': {
            GET: { params: paramsSchema }
          }
        }
      })

      ;(mockContext.req as any).method = 'GET'
      ;(mockContext.req as any).path = '/api/users/123'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(interceptorContext.metadata.validation?.paramsValid).toBe(true)
    })

    it('should reject invalid path parameters', async () => {
      const paramsSchema = z.object({
        id: z.string().regex(/^\d+$/).transform(Number)
      })

      ;(mockContext.req as any).param = mock((key: string) => {
        if (key === 'id') return 'invalid' // Invalid: not a number
        return undefined
      })

      const interceptor = createValidationInterceptor({
        validateParams: true,
        schemas: {
          '/api/users/:id': {
            GET: { params: paramsSchema }
          }
        }
      })

      ;(mockContext.req as any).method = 'GET'
      ;(mockContext.req as any).path = '/api/users/invalid'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.status).toHaveBeenCalledWith(400)
    })
  })

  describe('combined validation', () => {
    it('should validate body, query, and params together', async () => {
      const schemas = {
        body: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        query: z.object({
          notify: z.string().optional()
        }),
        params: z.object({
          id: z.string().regex(/^\d+$/)
        })
      }

      const interceptor = createValidationInterceptor({
        validateBody: true,
        validateQuery: true,
        validateParams: true,
        schemas: {
          '/api/users/:id': {
            PUT: schemas
          }
        }
      })

      ;(mockContext.req as any).method = 'PUT'
      ;(mockContext.req as any).path = '/api/users/123'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(interceptorContext.metadata.validation).toEqual({
        bodyValid: true,
        queryValid: true,
        paramsValid: true
      })
    })

    it('should report all validation errors together', async () => {
      const schemas = {
        body: z.object({
          name: z.string().min(1),
          email: z.string().email()
        }),
        query: z.object({
          limit: z.string().regex(/^\d+$/)
        }),
        params: z.object({
          id: z.string().regex(/^\d+$/)
        })
      }

      // Set up invalid data for all three
      ;(mockContext.req as any).json = mock(async () => ({
        name: '', // Invalid
        email: 'invalid' // Invalid
      }))

      ;(mockContext.req as any).query = mock((key?: string) => {
        if (key === 'limit') return 'invalid' // Invalid
        return undefined
      })

      ;(mockContext.req as any).param = mock((key: string) => {
        if (key === 'id') return 'invalid' // Invalid
        return undefined
      })

      const interceptor = createValidationInterceptor({
        validateBody: true,
        validateQuery: true,
        validateParams: true,
        schemas: {
          '/api/users/:id': {
            PUT: schemas
          }
        }
      })

      ;(mockContext.req as any).method = 'PUT'
      ;(mockContext.req as any).path = '/api/users/invalid'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: expect.objectContaining({
            body: expect.any(Array),
            query: expect.any(Array),
            params: expect.any(Array)
          })
        }
      })
    })
  })

  describe('route pattern matching', () => {
    it('should match exact routes', async () => {
      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: {
              body: z.object({ name: z.string() })
            }
          }
        }
      })

      ;(mockContext.req as any).path = '/api/users'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should match parameterized routes', async () => {
      const interceptor = createValidationInterceptor({
        validateParams: true,
        schemas: {
          '/api/users/:id': {
            GET: {
              params: z.object({ id: z.string() })
            }
          }
        }
      })

      ;(mockContext.req as any).method = 'GET'
      ;(mockContext.req as any).path = '/api/users/123'

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should match wildcard routes', async () => {
      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/*/create': {
            POST: {
              body: z.object({ data: z.any() })
            }
          }
        }
      })

      ;(mockContext.req as any).path = '/api/projects/create'
      ;(mockContext.req as any).json = mock(async () => ({ data: { name: 'Test' } }))

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('skip conditions', () => {
    it('should skip validation when disabled', async () => {
      const interceptor = createValidationInterceptor({
        enabled: false
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(interceptorContext.metadata.validation).toBeUndefined()
    })

    it('should skip validation for routes without schemas', async () => {
      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/other': {
            POST: {
              body: z.object({ name: z.string() })
            }
          }
        }
      })

      ;(mockContext.req as any).path = '/api/users' // No schema for this route

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(interceptorContext.metadata.validation).toBeUndefined()
    })

    it('should skip validation for methods without schemas', async () => {
      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            GET: { // Only GET has schema
              query: z.object({ q: z.string() })
            }
          }
        }
      })

      ;(mockContext.req as any).method = 'POST' // POST doesn't have schema

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('custom error handlers', () => {
    it('should use custom validation error handler', async () => {
      const customHandler = mock((ctx: Context, iCtx: InterceptorContext, errors: any) => {
        ctx.status(422)
        return ctx.json({ custom: 'error', errors })
      }) as ReturnType<typeof mock<(ctx: Context, iCtx: InterceptorContext, errors: any) => any>>

      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: {
              body: z.object({ name: z.string().min(1) })
            }
          }
        },
        onValidationError: customHandler
      })

      ;(mockContext.req as any).json = mock(async () => ({ name: '' })) // Invalid

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(customHandler).toHaveBeenCalled()
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('timing metrics', () => {
    it('should record validation timing', async () => {
      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: {
              body: z.object({ name: z.string() })
            }
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(interceptorContext.metrics.interceptorTimings['validation']).toBeTypeOf('number')
      expect(interceptorContext.metrics.interceptorTimings['validation']).toBeGreaterThanOrEqual(0)
    })
  })

  describe('content-type handling', () => {
    it('should skip body validation for non-JSON requests', async () => {
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'content-type') return 'text/plain'
        return undefined
      })

      const interceptor = createValidationInterceptor({
        validateBody: true,
        schemas: {
          '/api/users': {
            POST: {
              body: z.object({ name: z.string() })
            }
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.req.json).not.toHaveBeenCalled()
    })

    it('should handle form data requests', async () => {
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'content-type') return 'application/x-www-form-urlencoded'
        return undefined
      })

      ;(mockContext.req as any).parseBody = mock(async () => ({
        name: 'John Doe',
        email: 'john@example.com'
      }))

      const interceptor = createValidationInterceptor({
        validateBody: true,
        allowFormData: true,
        schemas: {
          '/api/users': {
            POST: {
              body: z.object({
                name: z.string(),
                email: z.string().email()
              })
            }
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.req.parseBody).toHaveBeenCalled()
    })
  })
})