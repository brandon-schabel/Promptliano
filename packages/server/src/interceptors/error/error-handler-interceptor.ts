import type { Context } from 'hono'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorHandler,
  type ErrorHandlerInterceptorConfig,
  InterceptorError
} from '../types'

/**
 * Custom error mapping definition
 */
interface ErrorMapping {
  status: number
  message: string
  code?: string
}

/**
 * Error context for reporting
 */
interface ErrorReportContext {
  requestId: string
  method: string
  path: string
  userAgent?: string
  ip: string
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * Sanitize sensitive data from strings
 */
function sanitizeSensitiveData(text: string): string {
  // Common patterns for sensitive data
  const patterns = [
    /password\s*[=:]\s*[^\s\n]+/gi,
    /token\s*[=:]\s*[^\s\n]+/gi,
    /key\s*[=:]\s*[^\s\n]+/gi,
    /secret\s*[=:]\s*[^\s\n]+/gi,
    /apikey\s*[=:]\s*[^\s\n]+/gi,
    /authorization\s*[=:]\s*[^\s\n]+/gi,
    /bearer\s+[^\s\n]+/gi,
    /sk-[a-zA-Z0-9]+/gi, // API keys like OpenAI
    /\b[A-Za-z0-9]{32,}\b/g // Long strings that might be tokens
  ]

  let sanitized = text
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '***REDACTED***')
  }

  return sanitized
}

/**
 * Determine content type preference from Accept header
 */
function getPreferredContentType(context: Context): 'json' | 'html' | 'text' {
  const accept = context.req.header('accept') || ''
  
  if (accept.includes('application/json')) {
    return 'json'
  }
  
  if (accept.includes('text/html') || accept.includes('application/xhtml')) {
    return 'html'
  }
  
  return 'text'
}

/**
 * Check if error is an API error (has status and code properties)
 */
function isApiError(error: any): error is { status: number; message: string; code: string; details?: any } {
  return error && 
         typeof error === 'object' && 
         typeof error.status === 'number' && 
         typeof error.message === 'string' &&
         typeof error.code === 'string'
}

/**
 * Check if error is an ApiError instance from ErrorFactory
 */
function isApiErrorInstance(error: any): error is { statusCode?: number; status?: number; message: string; code: string; details?: any } {
  return error && 
         error.name === 'ApiError' &&
         typeof error === 'object' && 
         (typeof error.status === 'number' || typeof error.statusCode === 'number') && 
         typeof error.message === 'string' &&
         typeof error.code === 'string'
}

/**
 * Generate error HTML page
 */
function generateErrorHtml(
  status: number,
  message: string,
  code: string,
  requestId: string,
  includeDetails: boolean = false,
  details?: any
): string {
  const detailsHtml = includeDetails && details ? `
    <details>
      <summary>Error Details</summary>
      <pre>${JSON.stringify(details, null, 2)}</pre>
    </details>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Error ${status}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .error-container { max-width: 600px; margin: 0 auto; }
        .error-code { color: #d32f2f; font-size: 48px; font-weight: bold; }
        .error-message { color: #424242; font-size: 18px; margin: 20px 0; }
        .request-id { color: #757575; font-size: 12px; font-family: monospace; }
        details { margin-top: 20px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-code">${status}</div>
        <div class="error-message">${message}</div>
        ${detailsHtml}
        <div class="request-id">Request ID: ${requestId}</div>
    </div>
</body>
</html>
  `.trim()
}

/**
 * Map JavaScript error types to appropriate HTTP status codes and messages
 */
function mapJavaScriptError(error: Error): { status: number; message: string; code: string } {
  if (error instanceof SyntaxError) {
    return {
      status: 400,
      message: 'Invalid request format',
      code: 'SYNTAX_ERROR'
    }
  }

  if (error instanceof TypeError) {
    return {
      status: 500,
      message: 'Internal Server Error',
      code: 'TYPE_ERROR'
    }
  }

  if (error instanceof RangeError) {
    return {
      status: 500,
      message: 'Internal Server Error',
      code: 'RANGE_ERROR'
    }
  }

  if (error instanceof ReferenceError) {
    return {
      status: 500,
      message: 'Internal Server Error',
      code: 'REFERENCE_ERROR'
    }
  }

  // Default for unknown errors
  return {
    status: 500,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR'
  }
}

/**
 * Create error handler interceptor handler
 */
function createErrorHandler(config: ErrorHandlerInterceptorConfig): InterceptorHandler {
  return async (context: Context, interceptorContext: InterceptorContext, next: () => Promise<void>): Promise<void> => {
    const startTime = Date.now()
    
    try {
      // Execute next interceptor/handler
      await next()
    } catch (error) {
      try {
        let status: number
        let message: string
        let code: string
        let details: any = {}

        // Check if it's a custom mapped error
        if (config.customErrorMap && error instanceof Error && config.customErrorMap[error.name]) {
          const mapping = config.customErrorMap[error.name]
          status = mapping.status
          message = mapping.message
          code = mapping.code || error.name.toUpperCase()
          details.originalMessage = error.message
        }
        // Check if it's an ApiError instance from ErrorFactory
        else if (isApiErrorInstance(error)) {
          status = error.status || error.statusCode || 500
          message = error.message
          code = error.code
          details = error.details || {}
        }
        // Check if it's a general API error (has status and code properties)
        else if (isApiError(error)) {
          status = error.status
          message = error.message
          code = error.code
          details = error.details || {}
        }
        // Map standard JavaScript errors
        else if (error instanceof Error) {
          const mapped = mapJavaScriptError(error)
          status = mapped.status
          message = mapped.message
          code = mapped.code
          details.originalMessage = error.message
          details.errorType = error.constructor.name
        }
        // Fallback for unknown error types
        else {
          status = 500
          message = 'Internal Server Error'
          code = 'UNKNOWN_ERROR'
          details.originalError = String(error)
        }

        // Build error response
        const errorResponse: any = {
          message,
          code,
          requestId: interceptorContext.requestId
        }

        // Add optional fields based on config
        if (config.includeDetails) {
          // Add request details
          details.method = context.req.method
          details.path = context.req.path
          details.timestamp = new Date().toISOString()
          details.ip = interceptorContext.security.ip
          
          errorResponse.details = details
        }

        if (config.includeStackTrace && error instanceof Error && error.stack) {
          let stackTrace = error.stack
          if (config.sanitizeSensitiveData) {
            stackTrace = sanitizeSensitiveData(stackTrace)
          }
          errorResponse.stackTrace = stackTrace
        }

        // Add correlation and tracing information if available
        if (interceptorContext.metadata.correlationId) {
          errorResponse.correlationId = interceptorContext.metadata.correlationId
        }

        if (interceptorContext.metadata.traceId) {
          errorResponse.traceId = interceptorContext.metadata.traceId
        }

        if (interceptorContext.metadata.spanId) {
          errorResponse.spanId = interceptorContext.metadata.spanId
        }

        // Report error if enabled
        if (config.enableErrorReporting && config.errorReporter) {
          try {
            const reportContext: ErrorReportContext = {
              requestId: interceptorContext.requestId,
              method: context.req.method,
              path: context.req.path,
              userAgent: context.req.header('user-agent'),
              ip: interceptorContext.security.ip,
              timestamp: Date.now(),
              metadata: interceptorContext.metadata
            }
            
            await config.errorReporter(error instanceof Error ? error : new Error(String(error)), reportContext)
          } catch (reportError) {
            // Don't let reporting errors fail the response
            console.error('[ErrorHandler] Error reporting failed:', reportError)
          }
        }

        // Set status and send response based on content type preference
        context.status(status as any)

        const contentType = getPreferredContentType(context)

        switch (contentType) {
          case 'html':
            if (config.enableHtmlErrorPages) {
              const html = generateErrorHtml(
                status,
                message,
                code,
                interceptorContext.requestId,
                config.includeDetails,
                config.includeDetails ? details : undefined
              )
              context.html(html)
              return
            }
            // Fallback to JSON
            context.json({ success: false, error: errorResponse })
            return

          case 'text':
            const textResponse = `Error ${status}: ${message}\nRequest ID: ${interceptorContext.requestId}`
            context.text(textResponse)
            return

          case 'json':
          default:
            context.json({ success: false, error: errorResponse })
            return
        }

      } catch (handlerError) {
        // If error handling itself fails, send a minimal error response
        console.error('[ErrorHandler] Error in error handler:', handlerError)
        
        try {
          context.status(500)
          context.json({
            success: false,
            error: {
              message: 'Internal Server Error',
              code: 'ERROR_HANDLER_FAILED',
              requestId: interceptorContext.requestId
            }
          })
          return
        } catch (finalError) {
          // Last resort - re-throw original error
          throw error
        }
      } finally {
        // Record timing
        const duration = Date.now() - startTime
        interceptorContext.metrics.interceptorTimings['error-handler'] = duration
      }
    }
  }
}

/**
 * Create error handler interceptor with configuration
 */
export function createErrorHandlerInterceptor(config: Partial<ErrorHandlerInterceptorConfig> = {}): Interceptor {
  const defaultConfig: ErrorHandlerInterceptorConfig = {
    enabled: true,
    includeStackTrace: process.env.NODE_ENV === 'development',
    includeDetails: true,
    enableErrorReporting: false,
    enableHtmlErrorPages: false,
    sanitizeSensitiveData: true,
    customErrorMap: {},
    ...config
  }

  return {
    name: 'error-handler-interceptor',
    order: 10, // Run early in error handling
    phase: 'error',
    enabled: true,
    handler: createErrorHandler(defaultConfig),
    config: defaultConfig,
    tags: ['error', 'logging'],
    routes: [], // Apply to all routes by default
    methods: [] // Apply to all methods by default
  }
}

/**
 * Pre-configured error handler for development
 */
export const devErrorHandler = createErrorHandlerInterceptor({
  includeStackTrace: true,
  includeDetails: true,
  enableHtmlErrorPages: true,
  sanitizeSensitiveData: false
})

/**
 * Pre-configured error handler for production
 */
export const prodErrorHandler = createErrorHandlerInterceptor({
  includeStackTrace: false,
  includeDetails: false,
  enableErrorReporting: true,
  enableHtmlErrorPages: false,
  sanitizeSensitiveData: true
})

/**
 * Pre-configured error handler with custom error mapping
 */
export const customErrorHandler = createErrorHandlerInterceptor({
  customErrorMap: {
    'ValidationError': {
      status: 422,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR'
    },
    'AuthenticationError': {
      status: 401,
      message: 'Authentication failed',
      code: 'AUTHENTICATION_ERROR'
    },
    'AuthorizationError': {
      status: 403,
      message: 'Access denied',
      code: 'AUTHORIZATION_ERROR'
    },
    'NotFoundError': {
      status: 404,
      message: 'Resource not found',
      code: 'NOT_FOUND'
    },
    'ConflictError': {
      status: 409,
      message: 'Resource conflict',
      code: 'CONFLICT'
    },
    'RateLimitError': {
      status: 429,
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
})

/**
 * Utility function to create a simple error reporter
 */
export function createConsoleErrorReporter(): (error: Error, context: ErrorReportContext) => Promise<void> {
  return async (error: Error, context: ErrorReportContext) => {
    console.error('[ErrorReporter]', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    })
  }
}

/**
 * Utility function to create an error reporter that sends to external service
 */
export function createExternalErrorReporter(
  reportingEndpoint: string,
  apiKey?: string
): (error: Error, context: ErrorReportContext) => Promise<void> {
  return async (error: Error, context: ErrorReportContext) => {
    try {
      const payload = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context,
        timestamp: new Date().toISOString()
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      await fetch(reportingEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
    } catch (reportingError) {
      console.error('[ErrorReporter] Failed to send error report:', reportingError)
    }
  }
}