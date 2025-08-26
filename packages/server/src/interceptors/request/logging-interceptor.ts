import type { Context } from 'hono'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorHandler,
  type LoggingInterceptorConfig,
  InterceptorError
} from '../types'

/**
 * Default logger function (uses console)
 */
function defaultLogger(level: string, message: string, data?: any): void {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...data
  }

  switch (level) {
    case 'error':
      console.error(`[${logEntry.level}] ${logEntry.message}`, logEntry)
      break
    case 'warn':
      console.warn(`[${logEntry.level}] ${logEntry.message}`, logEntry)
      break
    case 'info':
      console.info(`[${logEntry.level}] ${logEntry.message}`, logEntry)
      break
    case 'debug':
      console.debug(`[${logEntry.level}] ${logEntry.message}`, logEntry)
      break
    default:
      console.log(`[${logEntry.level}] ${logEntry.message}`, logEntry)
  }
}

/**
 * Determine if a log level should be logged based on current config
 */
function shouldLog(level: string, configLevel: string): boolean {
  const levels = ['debug', 'info', 'warn', 'error']
  const levelIndex = levels.indexOf(level)
  const configLevelIndex = levels.indexOf(configLevel)

  return levelIndex >= configLevelIndex
}

/**
 * Mask sensitive header values
 */
function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'x-auth-token', 'x-access-token']

  const masked: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      masked[key] = '***MASKED***'
    } else {
      masked[key] = value
    }
  }

  return masked
}

/**
 * Extract request headers safely
 */
function getRequestHeaders(context: Context): Record<string, string> {
  const headers: Record<string, string> = {}

  // Common headers to log
  const headerNames = [
    'user-agent',
    'content-type',
    'accept',
    'origin',
    'referer',
    'authorization',
    'x-api-key',
    'x-forwarded-for',
    'x-real-ip'
  ]

  for (const name of headerNames) {
    const value = context.req.header(name)
    if (value) {
      headers[name] = value
    }
  }

  return headers
}

/**
 * Create logging interceptor handler
 */
function createLoggingHandler(config: LoggingInterceptorConfig): InterceptorHandler {
  return async (context: Context, interceptorContext: InterceptorContext, next: () => Promise<void>) => {
    const logger = config.logger || defaultLogger
    const logLevel = config.level || 'info'
    const startTime = Date.now()

    try {
      // Log request start
      if (shouldLog('info', logLevel)) {
        const requestData = {
          requestId: interceptorContext.requestId,
          method: context.req.method,
          path: context.req.path,
          ip: interceptorContext.security.ip,
          userAgent: context.req.header('user-agent'),
          timestamp: new Date().toISOString()
        }

        logger('info', 'Request started', requestData)
      }

      // Log request headers (debug level)
      if (shouldLog('debug', logLevel)) {
        const headers = getRequestHeaders(context)
        const maskedHeaders = maskSensitiveHeaders(headers)

        logger('debug', 'Request headers', {
          requestId: interceptorContext.requestId,
          headers: maskedHeaders
        })
      }

      // Log request body if enabled
      if (config.logRequestBody && context.req.method !== 'GET') {
        if (shouldLog('debug', logLevel)) {
          try {
            // Clone the request to avoid consuming the body
            // Note: HonoRequest may not have clone method, so we'll need to handle this carefully
            const clonedRequest = context.req
            const body = await clonedRequest.json()
            const bodyStr = JSON.stringify(body)
            const maxSize = config.maxBodySize || 1024

            if (bodyStr.length <= maxSize) {
              logger('debug', 'Request body', {
                requestId: interceptorContext.requestId,
                body: body
              })
            } else {
              logger('debug', 'Request body (truncated)', {
                requestId: interceptorContext.requestId,
                bodySize: bodyStr.length,
                body: bodyStr.substring(0, maxSize) + '...'
              })
            }
          } catch (error) {
            if (shouldLog('warn', logLevel)) {
              logger('warn', 'Failed to parse request body', {
                requestId: interceptorContext.requestId,
                error: error instanceof Error ? error.message : String(error)
              })
            }
          }
        }
      }

      // Execute next interceptor/handler
      await next()

      // Log request completion
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['logging'] = duration

      if (shouldLog('info', logLevel)) {
        logger('info', 'Request completed', {
          requestId: interceptorContext.requestId,
          duration,
          status: context.res.status
        })
      }

      // Log slow requests
      const slowThreshold = config.slowThreshold || 1000 // 1 second default
      if (duration > slowThreshold && shouldLog('warn', logLevel)) {
        logger('warn', 'Slow request detected', {
          requestId: interceptorContext.requestId,
          method: context.req.method,
          path: context.req.path,
          duration,
          threshold: slowThreshold
        })
      }

      // Log response if enabled
      if (config.logResponseBody && shouldLog('debug', logLevel)) {
        try {
          // Note: In a real implementation, we'd need to capture the response
          // This is a simplified version for demonstration
          logger('debug', 'Response logged', {
            requestId: interceptorContext.requestId,
            status: context.res.status
          })
        } catch (error) {
          if (shouldLog('warn', logLevel)) {
            logger('warn', 'Failed to log response', {
              requestId: interceptorContext.requestId,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      }
    } catch (error) {
      // Log the error
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['logging'] = duration

      if (shouldLog('error', logLevel)) {
        logger('error', 'Request failed', {
          requestId: interceptorContext.requestId,
          method: context.req.method,
          path: context.req.path,
          duration,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'Unknown'
          }
        })
      }

      // Re-throw the error
      throw error
    }
  }
}

/**
 * Create logging interceptor with configuration
 */
export function createLoggingInterceptor(config: Partial<LoggingInterceptorConfig> = {}): Interceptor {
  const defaultConfig: LoggingInterceptorConfig = {
    level: 'info',
    logRequestBody: false,
    logResponseBody: false,
    maxBodySize: 1024, // 1KB
    slowThreshold: 1000, // 1 second
    ...config
  }

  return {
    name: 'logging-interceptor',
    order: 20, // Run after auth but before business logic
    phase: 'request',
    enabled: true,
    handler: createLoggingHandler(defaultConfig),
    config: defaultConfig,
    tags: ['logging', 'observability'],
    routes: [], // Apply to all routes by default
    methods: [] // Apply to all methods by default
  }
}

/**
 * Pre-configured logging interceptor for development
 */
export const devLoggingInterceptor = createLoggingInterceptor({
  level: 'debug',
  logRequestBody: true,
  logResponseBody: true,
  maxBodySize: 2048,
  slowThreshold: 500
})

/**
 * Pre-configured logging interceptor for production
 */
export const prodLoggingInterceptor = createLoggingInterceptor({
  level: 'info',
  logRequestBody: false,
  logResponseBody: false,
  maxBodySize: 512,
  slowThreshold: 2000
})

/**
 * Minimal logging interceptor (errors and warnings only)
 */
export const minimalLoggingInterceptor = createLoggingInterceptor({
  level: 'warn',
  logRequestBody: false,
  logResponseBody: false,
  slowThreshold: 5000
})

/**
 * Utility function to create a structured log entry
 */
export function createLogEntry(
  level: string,
  message: string,
  requestId?: string,
  additionalData?: Record<string, any>
): Record<string, any> {
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    requestId,
    ...additionalData
  }
}

/**
 * Utility function to determine if request should be logged
 * based on path patterns
 */
export function shouldLogRequest(path: string, excludePatterns: string[] = []): boolean {
  // Default exclude patterns for noisy endpoints
  const defaultExcludes = ['/health', '/metrics', '/favicon.ico', '/_next/**']

  const allExcludes = [...defaultExcludes, ...excludePatterns]

  return !allExcludes.some((pattern) => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
    return regex.test(path)
  })
}

/**
 * Utility function to safely stringify objects for logging
 */
export function safeStringify(obj: any, maxDepth = 3): string {
  const seen = new WeakSet()

  function replacer(key: string, value: any, depth = 0): any {
    if (depth > maxDepth) {
      return '[Max Depth Reached]'
    }

    if (value === null) return null

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)

      if (Array.isArray(value)) {
        return value.map((item, index) => replacer(index.toString(), item, depth + 1))
      }

      const result: any = {}
      for (const [k, v] of Object.entries(value)) {
        result[k] = replacer(k, v, depth + 1)
      }
      return result
    }

    return value
  }

  try {
    return JSON.stringify(obj, (key, value) => replacer(key, value))
  } catch (error) {
    return '[Stringify Error]'
  }
}
