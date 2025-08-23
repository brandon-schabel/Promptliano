/**
 * Error Handler Factory
 * Creates centralized error handling patterns for React Query and UI components
 */

import { useCallback, useState, useRef } from 'react'
import { toast } from 'sonner'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types
// ============================================================================

export interface ErrorHandlerConfig {
  enableToasts?: boolean
  enableLogging?: boolean
  enableRetry?: boolean
  maxRetries?: number
  retryDelay?: number
  enableUserFeedback?: boolean
  fallbackMessage?: string
  customLogger?: (error: Error, context?: any) => void
}

export interface ErrorState {
  hasError: boolean
  error: Error | null
  errorCount: number
  lastErrorTime: number | null
  retryCount: number
  canRetry: boolean
}

export interface ErrorHandler {
  state: ErrorState
  handleError: (error: Error | string, context?: any) => void
  handleApiError: (error: ApiError, context?: any) => void
  retry: () => Promise<void>
  reset: () => void
  clearError: () => void
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorContext {
  component?: string
  operation?: string
  entityType?: string
  entityId?: string | number
  userId?: string
  timestamp?: number
  additional?: Record<string, any>
}

// ============================================================================
// Error Classification
// ============================================================================

export function classifyError(error: Error | ApiError): ErrorSeverity {
  const message = error.message?.toLowerCase() || ''
  
  // Critical errors
  if (
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('server error') ||
    message.includes('500') ||
    message.includes('503')
  ) {
    return 'critical'
  }
  
  // High severity
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('payment') ||
    message.includes('quota')
  ) {
    return 'high'
  }
  
  // Medium severity
  if (
    message.includes('validation') ||
    message.includes('bad request') ||
    message.includes('400') ||
    message.includes('not found') ||
    message.includes('404')
  ) {
    return 'medium'
  }
  
  // Low severity (default)
  return 'low'
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error | ApiError): string {
  const message = error.message?.toLowerCase() || ''
  
  // Network errors
  if (message.includes('network error') || message.includes('failed to fetch')) {
    return 'Network connection problem. Please check your internet connection and try again.'
  }
  
  // Server errors
  if (message.includes('server error') || message.includes('500')) {
    return 'Server is experiencing issues. Please try again in a few moments.'
  }
  
  // Authentication errors
  if (message.includes('unauthorized') || message.includes('401')) {
    return 'Please log in again to continue.'
  }
  
  // Permission errors
  if (message.includes('forbidden') || message.includes('403')) {
    return 'You don\'t have permission to perform this action.'
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    return 'The requested item could not be found.'
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('bad request')) {
    return 'Please check your input and try again.'
  }
  
  // Quota/rate limiting
  if (message.includes('quota') || message.includes('rate limit')) {
    return 'You\'ve reached your usage limit. Please try again later.'
  }
  
  // Return original message if no pattern matches
  return error.message || 'An unexpected error occurred.'
}

// ============================================================================
// Main Factory
// ============================================================================

export function createErrorHandler(config: ErrorHandlerConfig = {}): ErrorHandler {
  const {
    enableToasts = true,
    enableLogging = true,
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
    enableUserFeedback = true,
    fallbackMessage = 'An unexpected error occurred',
    customLogger
  } = config

  const [state, setState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorCount: 0,
    lastErrorTime: null,
    retryCount: 0,
    canRetry: false
  })

  const retryFnRef = useRef<(() => Promise<void>) | null>(null)

  const updateState = useCallback((updates: Partial<ErrorState>) => {
    setState(current => ({ ...current, ...updates }))
  }, [])

  const handleError = useCallback((
    error: Error | string,
    context?: ErrorContext
  ) => {
    const errorObj = error instanceof Error ? error : new Error(error)
    const severity = classifyError(errorObj)
    const userMessage = getUserFriendlyMessage(errorObj)
    const timestamp = Date.now()

    // Update state
    updateState({
      hasError: true,
      error: errorObj,
      errorCount: state.errorCount + 1,
      lastErrorTime: timestamp,
      canRetry: enableRetry && state.retryCount < maxRetries
    })

    // Logging
    if (enableLogging) {
      const logData = {
        error: errorObj,
        severity,
        context,
        timestamp,
        retryCount: state.retryCount,
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      if (customLogger) {
        customLogger(errorObj, logData)
      } else {
        console.error('Error occurred:', logData)
      }
    }

    // User feedback
    if (enableToasts && enableUserFeedback) {
      const toastMessage = userMessage || fallbackMessage
      
      switch (severity) {
        case 'critical':
          toast.error(toastMessage, {
            duration: 10000,
            action: enableRetry && state.retryCount < maxRetries ? {
              label: 'Retry',
              onClick: () => retry()
            } : undefined
          })
          break
        case 'high':
          toast.error(toastMessage, { duration: 8000 })
          break
        case 'medium':
          toast.warning(toastMessage, { duration: 5000 })
          break
        case 'low':
          toast.info(toastMessage, { duration: 3000 })
          break
      }
    }
  }, [
    state.errorCount,
    state.retryCount,
    maxRetries,
    enableRetry,
    enableLogging,
    enableToasts,
    enableUserFeedback,
    fallbackMessage,
    customLogger,
    updateState
  ])

  const handleApiError = useCallback((
    error: ApiError,
    context?: ErrorContext
  ) => {
    // Extract additional info from API error
    const enhancedContext: ErrorContext = {
      ...context,
      statusCode: (error as any).status || (error as any).statusCode,
      requestId: (error as any).requestId,
      timestamp: Date.now()
    }

    handleError(error, enhancedContext)
  }, [handleError])

  const retry = useCallback(async () => {
    if (!state.canRetry || !retryFnRef.current) {
      return
    }

    updateState({
      retryCount: state.retryCount + 1,
      canRetry: state.retryCount + 1 < maxRetries
    })

    try {
      // Add delay before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (state.retryCount + 1)))
      }

      await retryFnRef.current()
      
      // Success - reset error state
      updateState({
        hasError: false,
        error: null,
        retryCount: 0,
        canRetry: false
      })

      if (enableToasts) {
        toast.success('Operation completed successfully')
      }
    } catch (retryError) {
      handleError(retryError as Error, { operation: 'retry' })
    }
  }, [
    state.canRetry,
    state.retryCount,
    maxRetries,
    retryDelay,
    enableToasts,
    updateState,
    handleError
  ])

  const reset = useCallback(() => {
    setState({
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: null,
      retryCount: 0,
      canRetry: false
    })
    retryFnRef.current = null
  }, [])

  const clearError = useCallback(() => {
    updateState({
      hasError: false,
      error: null
    })
  }, [updateState])

  return {
    state,
    handleError,
    handleApiError,
    retry,
    reset,
    clearError
  }
}

// ============================================================================
// Specialized Error Handlers
// ============================================================================

/**
 * Form validation error handler
 */
export function createFormErrorHandler() {
  const handler = createErrorHandler({
    enableToasts: false, // Forms handle their own validation messages
    enableRetry: false,
    enableUserFeedback: false
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleValidationError = useCallback((
    error: any,
    fieldMapping?: Record<string, string>
  ) => {
    if (error?.issues && Array.isArray(error.issues)) {
      // Zod validation errors
      const errors: Record<string, string> = {}
      error.issues.forEach((issue: any) => {
        const field = issue.path?.[0] || 'general'
        const displayField = fieldMapping?.[field] || field
        errors[displayField] = issue.message
      })
      setFieldErrors(errors)
    } else if (error?.fields && typeof error.fields === 'object') {
      // API validation errors
      const errors: Record<string, string> = {}
      Object.entries(error.fields).forEach(([field, message]) => {
        const displayField = fieldMapping?.[field] || field
        errors[displayField] = Array.isArray(message) ? message[0] : message as string
      })
      setFieldErrors(errors)
    } else {
      // Generic error
      handler.handleError(error)
    }
  }, [handler])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(current => {
      const { [field]: _, ...rest } = current
      return rest
    })
  }, [])

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({})
  }, [])

  return {
    ...handler,
    fieldErrors,
    handleValidationError,
    clearFieldError,
    clearAllFieldErrors
  }
}

/**
 * Network error handler with retry logic
 */
export function createNetworkErrorHandler(retryFn: () => Promise<void>) {
  const handler = createErrorHandler({
    enableRetry: true,
    maxRetries: 5,
    retryDelay: 2000,
    enableUserFeedback: true
  })

  // Store retry function
  const retryFnRef = useRef(retryFn)
  retryFnRef.current = retryFn

  const handleNetworkError = useCallback((error: Error) => {
    // Set the retry function
    handler.retry = async () => {
      try {
        await retryFnRef.current()
      } catch (retryError) {
        throw retryError
      }
    }

    handler.handleError(error, { operation: 'network' })
  }, [handler])

  return {
    ...handler,
    handleNetworkError
  }
}

/**
 * Async operation error handler
 */
export function createAsyncErrorHandler<T>(
  asyncFn: () => Promise<T>,
  context?: ErrorContext
) {
  const handler = createErrorHandler({
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000
  })

  const execute = useCallback(async (): Promise<T | null> => {
    try {
      const result = await asyncFn()
      handler.reset()
      return result
    } catch (error) {
      handler.handleError(error as Error, context)
      return null
    }
  }, [asyncFn, context, handler])

  const executeWithRetry = useCallback(async (): Promise<T | null> => {
    // Set up retry function
    const retryFnRef = useRef(asyncFn)
    retryFnRef.current = asyncFn

    try {
      return await execute()
    } catch (error) {
      // Error is already handled in execute()
      return null
    }
  }, [execute, asyncFn])

  return {
    ...handler,
    execute,
    executeWithRetry
  }
}

/**
 * Global error handler for unhandled errors
 */
export function createGlobalErrorHandler() {
  const handler = createErrorHandler({
    enableToasts: true,
    enableLogging: true,
    enableRetry: false,
    customLogger: (error, context) => {
      // Send to error reporting service
      console.error('Global error:', { error, context })
      
      // In production, send to service like Sentry
      if (process.env.NODE_ENV === 'production') {
        // sentryClient.captureException(error, { extra: context })
      }
    }
  })

  // Handle unhandled promise rejections
  const handleUnhandledRejection = useCallback((event: PromiseRejectionEvent) => {
    handler.handleError(
      new Error(event.reason?.message || 'Unhandled promise rejection'),
      { operation: 'unhandled_rejection', reason: event.reason }
    )
    event.preventDefault()
  }, [handler])

  // Handle general errors
  const handleWindowError = useCallback((event: ErrorEvent) => {
    handler.handleError(
      new Error(event.message),
      {
        operation: 'window_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    )
  }, [handler])

  return {
    ...handler,
    setupGlobalHandlers: () => {
      window.addEventListener('unhandledrejection', handleUnhandledRejection)
      window.addEventListener('error', handleWindowError)
      
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        window.removeEventListener('error', handleWindowError)
      }
    }
  }
}