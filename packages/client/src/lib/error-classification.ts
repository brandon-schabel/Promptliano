/**
 * Enhanced Error Classification System
 * Provides consistent error categorization and user-friendly messages
 */

export type ErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'client' | 'ai' | 'unknown'
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ClassifiedError {
  category: ErrorCategory
  severity: ErrorSeverity
  title: string
  message: string
  details?: string
  retryable: boolean
  userMessage: string
  debugInfo?: {
    originalError: any
    statusCode?: number
    timestamp: number
    url?: string
    context?: Record<string, any>
  }
}

export interface ErrorClassificationOptions {
  context?: Record<string, any>
  includeDebugInfo?: boolean
}

/**
 * Classify any error into a structured format
 */
export function classifyError(
  error: any,
  options: ErrorClassificationOptions = {}
): ClassifiedError {
  const { context, includeDebugInfo = process.env.NODE_ENV === 'development' } = options
  const timestamp = Date.now()
  
  // Extract basic error information
  const errorMessage = getErrorMessage(error)
  const statusCode = getStatusCode(error)
  const errorCode = getErrorCode(error)
  
  // Classify the error
  const category = determineCategory(error, errorMessage, statusCode, errorCode)
  const severity = determineSeverity(category, statusCode, errorCode)
  const { title, userMessage } = getUserMessages(category, errorMessage, statusCode)
  const retryable = isRetryable(category, statusCode, errorCode)
  
  const result: ClassifiedError = {
    category,
    severity,
    title,
    message: errorMessage,
    userMessage,
    retryable
  }
  
  // Add debug information in development
  if (includeDebugInfo) {
    result.debugInfo = {
      originalError: error,
      statusCode,
      timestamp,
      url: window.location.href,
      context
    }
    
    // Include stack trace or additional details
    if (error?.stack) {
      result.details = error.stack
    } else if (error?.details) {
      result.details = error.details
    }
  }
  
  return result
}

/**
 * Extract error message from various error formats
 */
function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.error?.message) return error.error.message
  if (error?.data?.message) return error.data.message
  return 'An unexpected error occurred'
}

/**
 * Extract HTTP status code
 */
function getStatusCode(error: any): number | undefined {
  return error?.status || error?.statusCode || error?.response?.status
}

/**
 * Extract error code
 */
function getErrorCode(error: any): string | undefined {
  return error?.code || error?.error?.code || error?.data?.code
}

/**
 * Determine error category based on error characteristics
 */
function determineCategory(
  error: any,
  message: string,
  statusCode?: number,
  errorCode?: string
): ErrorCategory {
  const lowerMessage = message.toLowerCase()
  
  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('econnrefused') ||
    errorCode === 'NETWORK_ERROR'
  ) {
    return 'network'
  }
  
  // Authentication/Authorization errors
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('api key') ||
    errorCode === 'UNAUTHORIZED'
  ) {
    return 'auth'
  }
  
  // Validation errors
  if (
    statusCode === 400 ||
    statusCode === 422 ||
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('bad request') ||
    errorCode === 'VALIDATION_ERROR' ||
    error?.issues || // Zod validation errors
    error?.fields    // API validation errors
  ) {
    return 'validation'
  }
  
  // Server errors
  if (
    statusCode && statusCode >= 500 ||
    lowerMessage.includes('server error') ||
    lowerMessage.includes('internal server')
  ) {
    return 'server'
  }
  
  // Client errors (4xx other than auth/validation)
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return 'client'
  }
  
  // AI-specific errors
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('context length') ||
    lowerMessage.includes('model') ||
    lowerMessage.includes('token') ||
    error?.provider
  ) {
    return 'ai'
  }
  
  return 'unknown'
}

/**
 * Determine error severity
 */
function determineSeverity(
  category: ErrorCategory,
  statusCode?: number,
  errorCode?: string
): ErrorSeverity {
  // Critical errors
  if (
    category === 'network' ||
    category === 'server' ||
    statusCode === 500 ||
    statusCode === 503
  ) {
    return 'critical'
  }
  
  // High severity
  if (
    category === 'auth' ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return 'high'
  }
  
  // Medium severity
  if (
    category === 'validation' ||
    category === 'client' ||
    statusCode === 400 ||
    statusCode === 404
  ) {
    return 'medium'
  }
  
  // Low severity (AI errors, unknown)
  return 'low'
}

/**
 * Get user-friendly title and message
 */
function getUserMessages(
  category: ErrorCategory,
  originalMessage: string,
  statusCode?: number
): { title: string; userMessage: string } {
  switch (category) {
    case 'network':
      return {
        title: 'Connection Problem',
        userMessage: 'Unable to connect to the server. Please check your internet connection and try again.'
      }
    
    case 'auth':
      return {
        title: 'Authentication Required',
        userMessage: statusCode === 403 
          ? "You don't have permission to perform this action."
          : 'Please sign in again to continue.'
      }
    
    case 'validation':
      return {
        title: 'Invalid Input',
        userMessage: 'Please check your input and try again.'
      }
    
    case 'server':
      return {
        title: 'Server Error',
        userMessage: 'The server is experiencing issues. Please try again in a few moments.'
      }
    
    case 'client':
      return {
        title: statusCode === 404 ? 'Not Found' : 'Request Error',
        userMessage: statusCode === 404 
          ? 'The requested item could not be found.'
          : 'There was a problem with your request.'
      }
    
    case 'ai':
      return {
        title: 'AI Service Error',
        userMessage: originalMessage.includes('rate limit')
          ? 'You\'ve reached your usage limit. Please try again later.'
          : 'There was an issue with the AI service. Please try again.'
      }
    
    default:
      return {
        title: 'Something Went Wrong',
        userMessage: originalMessage || 'An unexpected error occurred. Please try again.'
      }
  }
}

/**
 * Determine if error is retryable
 */
function isRetryable(
  category: ErrorCategory,
  statusCode?: number,
  errorCode?: string
): boolean {
  // Never retry auth errors
  if (category === 'auth') return false
  
  // Never retry validation errors
  if (category === 'validation') return false
  
  // Never retry 404s
  if (statusCode === 404) return false
  
  // Retry network, server, and some AI errors
  return category === 'network' || category === 'server' || category === 'ai'
}

/**
 * Error classification presets for common scenarios
 */
export const ErrorPresets = {
  networkTimeout: (): ClassifiedError => classifyError(
    new Error('Network request timed out')
  ),
  
  unauthorized: (): ClassifiedError => classifyError(
    { status: 401, message: 'Unauthorized' }
  ),
  
  validation: (fields: Record<string, string>): ClassifiedError => classifyError(
    { status: 400, message: 'Validation failed', fields }
  ),
  
  serverError: (): ClassifiedError => classifyError(
    { status: 500, message: 'Internal server error' }
  ),
  
  notFound: (resource: string): ClassifiedError => classifyError(
    { status: 404, message: `${resource} not found` }
  )
} as const
