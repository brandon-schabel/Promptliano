/**
 * Hono integration for the interceptor system
 * Provides seamless integration between the interceptor chain and Hono middleware
 */

import type { Context, MiddlewareHandler } from 'hono'
import { OpenAPIHono } from '@hono/zod-openapi'
import { InterceptorSystem, getGlobalInterceptorSystem } from './index'
import { loadConfigFromEnv } from './config'
import type { InterceptorContext, InterceptorHandler } from './types'

/**
 * Context bridge between Hono and Interceptor systems
 */
export class HonoInterceptorBridge {
  private system: InterceptorSystem

  constructor(system?: InterceptorSystem) {
    this.system = system || getGlobalInterceptorSystem()
  }

  /**
   * Convert Hono context to interceptor context
   */
  private createInterceptorContext(honoContext: Context): InterceptorContext {
    const requestId = this.generateRequestId()

    return {
      requestId,
      startTime: Date.now(),
      metadata: {
        method: honoContext.req.method,
        path: honoContext.req.path,
        headers: {}, // Will be populated by specific interceptors that need headers
        query: honoContext.req.query()
      },
      metrics: {
        interceptorTimings: {}
      },
      cacheKeys: [],
      security: {
        ip: this.getClientIP(honoContext),
        rateLimitKeys: []
      }
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get client IP from Hono context
   */
  private getClientIP(c: Context): string {
    // Check for forwarded headers first (production)
    const forwarded = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    if (forwarded) return forwarded

    // For local development, try to get the actual connection IP
    const connection = (c.env as any)?.incoming?.socket || (c.req.raw as any)?.connection || (c.req.raw as any)?.socket
    const remoteAddress = connection?.remoteAddress

    // Check if it's a localhost IP
    if (remoteAddress === '::1' || remoteAddress === '127.0.0.1' || remoteAddress === 'localhost') {
      return 'localhost'
    }
    return remoteAddress || 'unknown'
  }

  /**
   * Create middleware that runs interceptor context setup
   */
  createContextMiddleware(): MiddlewareHandler {
    return async (c: Context, next) => {
      // Create interceptor context and store it in Hono context
      const interceptorContext = this.createInterceptorContext(c)
      c.set('interceptorContext', interceptorContext)
      c.set('requestId', interceptorContext.requestId)

      await next()
    }
  }

  /**
   * Create middleware for request interceptors
   */
  createRequestMiddleware(): MiddlewareHandler {
    return async (c: Context, next) => {
      const interceptorContext = c.get('interceptorContext') as InterceptorContext
      if (!interceptorContext) {
        await next()
        return
      }

      // Get matching interceptors for this route
      const route = c.req.path
      const method = c.req.method
      const interceptors = this.system.getRegistry().getMatching(route, method, 'request')

      // Execute request interceptors
      for (const interceptor of interceptors) {
        if (!interceptor.enabled) continue

        try {
          const startTime = Date.now()

          // Create a wrapped next function that prevents further execution if interceptor handles response
          let interceptorHandled = false
          const interceptorNext = async () => {
            // This does nothing - interceptors should not call next, they transform the request
          }

          await interceptor.handler(c, interceptorContext, interceptorNext)

          // Record timing
          interceptorContext.metrics.interceptorTimings[interceptor.name] = Date.now() - startTime

          // Check if the interceptor set a response (finalized the context)
          if (c.finalized) {
            return c.res
          }
        } catch (error) {
          // If interceptor throws, it will be caught by error interceptors
          throw error
        }
      }

      await next()
    }
  }

  /**
   * Create middleware for response interceptors
   */
  createResponseMiddleware(): MiddlewareHandler {
    return async (c: Context, next) => {
      await next()

      const interceptorContext = c.get('interceptorContext') as InterceptorContext
      if (!interceptorContext) return

      // Calculate total request duration
      interceptorContext.metadata.duration = Date.now() - interceptorContext.startTime

      // Get matching interceptors for this route
      const route = c.req.path
      const method = c.req.method
      const interceptors = this.system.getRegistry().getMatching(route, method, 'response')

      // Execute response interceptors
      for (const interceptor of interceptors) {
        if (!interceptor.enabled) continue

        try {
          const startTime = Date.now()

          const interceptorNext = async () => {
            // Response interceptors run after the response is generated
          }

          await interceptor.handler(c, interceptorContext, interceptorNext)

          // Record timing
          interceptorContext.metrics.interceptorTimings[interceptor.name] = Date.now() - startTime
        } catch (error) {
          console.error(`Response interceptor '${interceptor.name}' failed:`, error)
          // Don't throw - response is already generated
        }
      }
    }
  }

  /**
   * Create error handler for error interceptors
   */
  createErrorHandler(): (err: Error, c: Context) => Response | Promise<Response> {
    return async (err: Error, c: Context) => {
      const interceptorContext = c.get('interceptorContext') as InterceptorContext

      // If no interceptor context, fall back to basic error handling
      if (!interceptorContext) {
        console.error('[HonoInterceptorBridge] No interceptor context found for error handling')
        const response = c.json(
          {
            success: false,
            error: {
              message: 'Internal Server Error',
              code: 'INTERNAL_ERROR'
            }
          },
          500
        )
        return response
      }

      // Get matching error interceptors
      const route = c.req.path
      const method = c.req.method
      const interceptors = this.system.getRegistry().getMatching(route, method, 'error')

      // Execute error interceptors
      for (const interceptor of interceptors) {
        if (!interceptor.enabled) continue

        try {
          const startTime = Date.now()

          const interceptorNext = async () => {
            // Error interceptors should handle the error and set response
          }

          await interceptor.handler(c, interceptorContext, interceptorNext)

          // Record timing
          interceptorContext.metrics.interceptorTimings[interceptor.name] = Date.now() - startTime

          // If interceptor handled the error by calling c.json() or c.status(), return early
          // Check if the response was actually modified by the interceptor
          if (c.finalized) {
            return c.res
          }
        } catch (interceptorError) {
          console.error(`Error interceptor '${interceptor.name}' failed:`, interceptorError)
          // Continue to next interceptor
        }
      }

      // If no interceptor handled the error, return default error response
      const response = c.json(
        {
          success: false,
          error: {
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
            requestId: interceptorContext.requestId
          }
        },
        500
      )
      return response
    }
  }
}

/**
 * Built-in interceptors that replace common Hono middleware
 */
export class HonoReplacementInterceptors {
  /**
   * Create CORS interceptor to replace hono/cors
   */
  static createCorsInterceptor(
    options: {
      origin?: string | string[]
      allowMethods?: string[]
      allowHeaders?: string[]
      exposeHeaders?: string[]
      credentials?: boolean
      maxAge?: number
    } = {}
  ): InterceptorHandler {
    return async (c: Context, interceptorContext: InterceptorContext, next) => {
      const origin = c.req.header('Origin')

      // Handle preflight
      if (c.req.method === 'OPTIONS') {
        c.header('Access-Control-Allow-Origin', (options.origin as string) || '*')
        c.header('Access-Control-Allow-Methods', options.allowMethods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS')
        c.header('Access-Control-Allow-Headers', options.allowHeaders?.join(', ') || 'Content-Type, Authorization')

        if (options.credentials) {
          c.header('Access-Control-Allow-Credentials', 'true')
        }

        if (options.maxAge) {
          c.header('Access-Control-Max-Age', options.maxAge.toString())
        }

        // Return a proper 204 response for preflight
        // Use body() with empty string to properly finalize the response
        c.status(204)
        c.body('')
        return
      }

      // Set CORS headers for actual requests
      if (origin) {
        if (Array.isArray(options.origin)) {
          if (options.origin.includes(origin)) {
            c.header('Access-Control-Allow-Origin', origin)
          }
        } else {
          c.header('Access-Control-Allow-Origin', options.origin || '*')
        }
      } else {
        c.header('Access-Control-Allow-Origin', '*')
      }

      if (options.exposeHeaders) {
        c.header('Access-Control-Expose-Headers', options.exposeHeaders.join(', '))
      }

      if (options.credentials) {
        c.header('Access-Control-Allow-Credentials', 'true')
      }

      await next()
    }
  }

  /**
   * Create request ID interceptor
   */
  static createRequestIdInterceptor(): InterceptorHandler {
    return async (c: Context, interceptorContext: InterceptorContext, next) => {
      // Request ID is already set in interceptor context
      c.header('X-Request-ID', interceptorContext.requestId)
      await next()
    }
  }

  /**
   * Create response time interceptor to replace timing middleware
   */
  static createResponseTimeInterceptor(): InterceptorHandler {
    return async (c: Context, interceptorContext: InterceptorContext, next) => {
      await next()

      const duration = Date.now() - interceptorContext.startTime
      c.header('X-Response-Time', `${duration}ms`)
      interceptorContext.metadata.responseTime = duration
    }
  }
}

/**
 * Apply interceptor system to Hono app
 */
export function applyInterceptorSystem(
  app: OpenAPIHono,
  options: {
    configLoader?: any
    customInterceptors?: any[]
    replaceMiddleware?: boolean
  } = {}
): void {
  const bridge = new HonoInterceptorBridge()

  // Initialize interceptor system if not already done
  if (!getGlobalInterceptorSystem().getStats().interceptorCount) {
    setupDefaultInterceptors(options.configLoader)
  }

  // Add custom interceptors if provided
  if (options.customInterceptors) {
    const system = getGlobalInterceptorSystem()
    options.customInterceptors.forEach((interceptor) => {
      system.register(interceptor)
    })
  }

  // Add interceptor middleware in correct order
  app.use('*', bridge.createContextMiddleware())
  app.use('*', bridge.createRequestMiddleware())
  app.use('*', bridge.createResponseMiddleware())

  // Set error handler
  app.onError(bridge.createErrorHandler())

  console.log('[InterceptorSystem] Applied to Hono app')
}

/**
 * Setup default interceptors that replace common middleware
 */
export function setupDefaultInterceptors(configLoader?: any): void {
  const system = getGlobalInterceptorSystem()
  const config = configLoader || loadConfigFromEnv()

  // Import interceptors
  const { createAuthInterceptor } = require('./request/auth-interceptor')
  const { createLoggingInterceptor } = require('./request/logging-interceptor')
  const { createRateLimitInterceptor } = require('./request/rate-limit-interceptor')
  const { createCacheInterceptor } = require('./request/cache-interceptor')
  const { createValidationInterceptor } = require('./request/validation-interceptor')
  const { createErrorHandlerInterceptor } = require('./error/error-handler-interceptor')

  // Register built-in interceptors with configuration
  const interceptors = [
    // Request interceptors (run in order)
    {
      name: 'cors-interceptor',
      order: 1,
      phase: 'request',
      enabled: true,
      handler: HonoReplacementInterceptors.createCorsInterceptor({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
      })
    },
    {
      ...createAuthInterceptor(config.getInterceptorConfig('auth')),
      enabled: config.isInterceptorEnabled('auth')
    },
    {
      ...createLoggingInterceptor(config.getInterceptorConfig('logging')),
      enabled: config.isInterceptorEnabled('logging')
    },
    {
      ...createRateLimitInterceptor(config.getInterceptorConfig('rateLimit')),
      enabled: config.isInterceptorEnabled('rateLimit')
    },
    {
      ...createCacheInterceptor(config.getInterceptorConfig('cache')),
      enabled: config.isInterceptorEnabled('cache')
    },
    {
      ...createValidationInterceptor(config.getInterceptorConfig('validation')),
      enabled: config.isInterceptorEnabled('validation')
    },

    // Error interceptor
    {
      ...createErrorHandlerInterceptor(config.getInterceptorConfig('errorHandler')),
      enabled: config.isInterceptorEnabled('errorHandler')
    }
  ]

  // Register all interceptors
  interceptors.forEach((interceptor) => {
    system.register(interceptor)
  })

  const stats = system.getStats()
  console.log(`[InterceptorSystem] Registered ${stats.interceptorCount} interceptors (${stats.enabledCount} enabled)`)
}

/**
 * Create a configured Hono app with interceptor system
 */
export function createHonoAppWithInterceptors(
  options: {
    configLoader?: any
    customInterceptors?: any[]
    enableSwagger?: boolean
  } = {}
): OpenAPIHono {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        console.error('Validation Error:', JSON.stringify(result.error.issues, null, 2))

        return c.json(
          {
            success: false,
            error: {
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: result.error.flatten().fieldErrors
            }
          },
          422
        )
      }
    }
  })

  // Apply interceptor system
  applyInterceptorSystem(app, options)

  // Add health check
  app.get('/api/health', (c) => c.json({ success: true }))

  // Add swagger documentation if enabled
  if (options.enableSwagger) {
    const { swaggerUI } = require('@hono/swagger-ui')
    app.get('/swagger', swaggerUI({ url: '/doc' }))
    app.doc('/doc', {
      openapi: '3.1.1',
      info: {
        description: 'Promptliano OpenAPI Server Spec',
        version: '1.0.0',
        title: 'Promptliano API'
      }
    })
  }

  return app
}

/**
 * Migrate existing Hono app to use interceptor system
 */
export function migrateToInterceptorSystem(app: OpenAPIHono): {
  interceptorsApplied: number
  middlewareReplaced: string[]
  migrationNotes: string[]
} {
  const replacedMiddleware: string[] = []
  const migrationNotes: string[] = []

  // Apply interceptor system
  applyInterceptorSystem(app, {
    replaceMiddleware: true
  })

  const system = getGlobalInterceptorSystem()
  const stats = system.getStats()

  // Note what was replaced
  replacedMiddleware.push('hono/cors', 'hono/logger', 'rate-limiter', 'custom-error-handler')

  migrationNotes.push(
    'CORS middleware replaced with CORS interceptor',
    'Logger middleware replaced with logging interceptor',
    'Rate limiter replaced with rate limit interceptor',
    'Error handler replaced with error interceptor system',
    'Request ID generation added via interceptor',
    'Response timing added via interceptor'
  )

  console.log('[Migration] Successfully migrated to interceptor system')
  console.log(`[Migration] Replaced middleware: ${replacedMiddleware.join(', ')}`)

  return {
    interceptorsApplied: stats.interceptorCount,
    middlewareReplaced: replacedMiddleware,
    migrationNotes
  }
}
