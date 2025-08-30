import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { createErrorHandlerInterceptor } from '../error/error-handler-interceptor'
import type { Context } from 'hono'
import type { InterceptorContext, ErrorHandlerInterceptorConfig } from '../types'
import { ErrorFactory } from '@promptliano/shared'

describe('Error Handler Interceptor', () => {
  let mockContext: Context
  let interceptorContext: InterceptorContext
  let mockNext: ReturnType<typeof mock<() => Promise<void>>>
  let mockError: Error

  beforeEach(() => {
    mockContext = {
      req: {
        method: 'GET',
        path: '/api/users',
        header: mock((name: string) => {
          if (name === 'accept') return 'application/json'
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
      text: mock() as any,
      html: mock() as any,
      status: mock(() => mockContext) as any,
      header: mock() as any
    } as unknown as Context

    interceptorContext = {
      requestId: 'req-123',
      startTime: Date.now(),
      metadata: {},
      metrics: { interceptorTimings: {} },
      cacheKeys: [],
      security: { ip: '127.0.0.1', rateLimitKeys: [] }
    }

    mockError = new Error('Test error')
    mockNext = mock(async () => {
      throw mockError
    })
  })

  describe('createErrorHandlerInterceptor', () => {
    it('should create interceptor with default configuration', () => {
      const interceptor = createErrorHandlerInterceptor()

      expect(interceptor.name).toBe('error-handler-interceptor')
      expect(interceptor.phase).toBe('error')
      expect(interceptor.order).toBe(10)
      expect(interceptor.enabled).toBe(true)
      expect(interceptor.config.enabled).toBe(true)
    })

    it('should create interceptor with custom configuration', () => {
      const config: Partial<ErrorHandlerInterceptorConfig> = {
        enabled: true,
        includeStackTrace: false,
        includeDetails: true,
        enableErrorReporting: true,
        customErrorMap: {
          CUSTOM_ERROR: { status: 418, message: 'Custom error occurred' }
        }
      }

      const interceptor = createErrorHandlerInterceptor(config)

      expect(interceptor.config.includeStackTrace).toBe(false)
      expect(interceptor.config.enableErrorReporting).toBe(true)
      expect(interceptor.config.customErrorMap).toBeDefined()
    })
  })

  describe('standard error handling', () => {
    it('should handle generic errors with 500 status', async () => {
      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(500)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal Server Error',
          code: 'INTERNAL_ERROR',
          requestId: 'req-123',
          details: expect.any(Object)
        }
      })
    })

    it('should include stack trace when enabled', async () => {
      const interceptor = createErrorHandlerInterceptor({
        includeStackTrace: true
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          stackTrace: expect.any(String)
        })
      })
    })

    it('should exclude stack trace when disabled', async () => {
      const interceptor = createErrorHandlerInterceptor({
        includeStackTrace: false
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      const callArgs = (mockContext.json as any).mock.calls[0][0]
      expect(callArgs.error.stackTrace).toBeUndefined()
    })

    it('should exclude details when disabled', async () => {
      const interceptor = createErrorHandlerInterceptor({
        includeDetails: false
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      const callArgs = (mockContext.json as any).mock.calls[0][0]
      expect(callArgs.error.details).toBeUndefined()
    })
  })

  describe('API error handling', () => {
    it('should handle ErrorFactory errors with proper status codes', async () => {
      mockNext = mock(async () => {
        throw ErrorFactory.notFound('User', 'undefined')
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(404)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User with ID undefined not found',
          code: 'USER_NOT_FOUND',
          requestId: 'req-123',
          details: expect.any(Object)
        }
      })
    })

    it('should handle validation errors properly', async () => {
      mockNext = mock(async () => {
        throw ErrorFactory.validationFailed({
          validationErrors: [{ field: 'email', message: 'Invalid email format' }]
        })
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(400)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          requestId: 'req-123',
          details: expect.objectContaining({
            errors: expect.any(Object)
          })
        }
      })
    })

    it('should handle unauthorized errors', async () => {
      mockNext = mock(async () => {
        throw ErrorFactory.unauthorized('Invalid token')
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(401)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'UNAUTHORIZED',
          requestId: 'req-123',
          details: expect.any(Object)
        }
      })
    })
  })

  describe('custom error mapping', () => {
    it('should use custom error mapping when provided', async () => {
      const customError = new Error('Custom business logic error')
      customError.name = 'BusinessLogicError'

      mockNext = mock(async () => {
        throw customError
      })

      const interceptor = createErrorHandlerInterceptor({
        customErrorMap: {
          BusinessLogicError: {
            status: 422,
            message: 'Business rule violation',
            code: 'BUSINESS_RULE_VIOLATION'
          }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(422)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Business rule violation',
          code: 'BUSINESS_RULE_VIOLATION',
          requestId: 'req-123',
          details: expect.any(Object)
        }
      })
    })

    it('should fallback to default handling for unmapped errors', async () => {
      const unmappedError = new Error('Unmapped error')
      unmappedError.name = 'UnmappedError'

      mockNext = mock(async () => {
        throw unmappedError
      })

      const interceptor = createErrorHandlerInterceptor({
        customErrorMap: {
          SomeOtherError: { status: 422, message: 'Other error' }
        }
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(500)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal Server Error',
          code: 'INTERNAL_ERROR',
          requestId: 'req-123',
          details: expect.any(Object)
        }
      })
    })
  })

  describe('content type handling', () => {
    it('should return JSON for API requests', async () => {
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'accept') return 'application/json'
        return undefined
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.json).toHaveBeenCalled()
      expect(mockContext.html).not.toHaveBeenCalled()
    })

    it('should return HTML for browser requests', async () => {
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'accept') return 'text/html,application/xhtml+xml'
        return undefined
      })

      const interceptor = createErrorHandlerInterceptor({
        enableHtmlErrorPages: true
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.html).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })

    it('should return plain text when no specific format requested', async () => {
      ;(mockContext.req as any).header = mock((name: string) => {
        if (name === 'accept') return 'text/plain'
        return undefined
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.text).toHaveBeenCalled()
    })
  })

  describe('error reporting', () => {
    it('should call custom error reporter when enabled', async () => {
      const mockReporter = mock() as ReturnType<typeof mock<(error: Error, context: any) => Promise<void>>>

      const interceptor = createErrorHandlerInterceptor({
        enableErrorReporting: true,
        errorReporter: mockReporter
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockReporter).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({
          requestId: 'req-123',
          method: 'GET',
          path: '/api/users'
        })
      )
    })

    it('should not call reporter when disabled', async () => {
      const mockReporter = mock() as ReturnType<typeof mock<(error: Error, context: any) => Promise<void>>>

      const interceptor = createErrorHandlerInterceptor({
        enableErrorReporting: false,
        errorReporter: mockReporter
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockReporter).not.toHaveBeenCalled()
    })

    it('should handle reporter errors gracefully', async () => {
      const mockReporter = mock(async (error: Error, context: any) => {
        throw new Error('Reporter failed')
      }) as ReturnType<typeof mock<(error: Error, context: any) => Promise<void>>>

      const interceptor = createErrorHandlerInterceptor({
        enableErrorReporting: true,
        errorReporter: mockReporter
      })

      // Should not throw even if reporter fails
      await expect(interceptor.handler(mockContext, interceptorContext, mockNext)).resolves.toBeUndefined()
      expect(mockContext.json).toHaveBeenCalled() // Error response should still be sent
    })
  })

  describe('sensitive data sanitization', () => {
    it('should sanitize sensitive data from error details', async () => {
      const errorWithSensitiveData = new Error('Database error')
      errorWithSensitiveData.stack = `Error: Database error
        at connect (database.js:123)
        password=secret123
        apiKey=sk-1234567890`

      mockNext = mock(async () => {
        throw errorWithSensitiveData
      })

      const interceptor = createErrorHandlerInterceptor({
        includeStackTrace: true,
        sanitizeSensitiveData: true
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      const callArgs = (mockContext.json as any).mock.calls[0][0]
      expect(callArgs.error.stackTrace).not.toContain('secret123')
      expect(callArgs.error.stackTrace).not.toContain('sk-1234567890')
      expect(callArgs.error.stackTrace).toContain('***REDACTED***')
    })

    it('should not sanitize when disabled', async () => {
      const errorWithSensitiveData = new Error('Database error')
      errorWithSensitiveData.stack = 'Error with password=secret123'

      mockNext = mock(async () => {
        throw errorWithSensitiveData
      })

      const interceptor = createErrorHandlerInterceptor({
        includeStackTrace: true,
        sanitizeSensitiveData: false
      })

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      const callArgs = (mockContext.json as any).mock.calls[0][0]
      expect(callArgs.error.stackTrace).toContain('password=secret123')
    })
  })

  describe('correlation ID and tracing', () => {
    it('should include correlation ID in error response', async () => {
      interceptorContext.metadata.correlationId = 'corr-456'

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          correlationId: 'corr-456'
        })
      })
    })

    it('should include trace information when available', async () => {
      interceptorContext.metadata.traceId = 'trace-789'
      interceptorContext.metadata.spanId = 'span-123'

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          traceId: 'trace-789',
          spanId: 'span-123'
        })
      })
    })
  })

  describe('timing metrics', () => {
    it('should record error handling timing', async () => {
      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(interceptorContext.metrics.interceptorTimings['error-handler']).toBeTypeOf('number')
      expect(interceptorContext.metrics.interceptorTimings['error-handler']).toBeGreaterThanOrEqual(0)
    })
  })

  describe('different error types', () => {
    it('should handle syntax errors', async () => {
      const syntaxError = new SyntaxError('Unexpected token')
      mockNext = mock(async () => {
        throw syntaxError
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(400)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Invalid request format',
          code: 'SYNTAX_ERROR'
        })
      })
    })

    it('should handle type errors', async () => {
      const typeError = new TypeError('Cannot read property of undefined')
      mockNext = mock(async () => {
        throw typeError
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(500)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Internal Server Error',
          code: 'TYPE_ERROR'
        })
      })
    })

    it('should handle range errors', async () => {
      const rangeError = new RangeError('Maximum call stack size exceeded')
      mockNext = mock(async () => {
        throw rangeError
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockContext.status).toHaveBeenCalledWith(500)
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Internal Server Error',
          code: 'RANGE_ERROR'
        })
      })
    })
  })

  describe('successful request handling', () => {
    it('should not interfere with successful requests', async () => {
      mockNext = mock(async () => {
        // Successful request - no error thrown
      })

      const interceptor = createErrorHandlerInterceptor()

      await interceptor.handler(mockContext, interceptorContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.status).not.toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })
  })
})
