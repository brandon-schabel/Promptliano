/**
 * Global Error Handler Provider
 * Sets up global error handling for the entire application
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { classifyError } from '@/lib/error-classification'
import { useNetworkErrorDetection } from '@/hooks/use-enhanced-error-handling'

interface ErrorHandlerContextValue {
  reportError: (error: any, context?: Record<string, any>) => void
}

const ErrorHandlerContext = createContext<ErrorHandlerContextValue | null>(null)

export function useErrorHandler() {
  const context = useContext(ErrorHandlerContext)
  if (!context) {
    throw new Error('useErrorHandler must be used within ErrorHandlerProvider')
  }
  return context
}

interface ErrorHandlerProviderProps {
  children: ReactNode
  enableGlobalHandlers?: boolean
  enableNetworkDetection?: boolean
  onError?: (error: any, context?: Record<string, any>) => void
}

export function ErrorHandlerProvider({
  children,
  enableGlobalHandlers = true,
  enableNetworkDetection = true,
  onError
}: ErrorHandlerProviderProps) {
  const queryClient = useQueryClient()
  
  // Enable network error detection
  if (enableNetworkDetection) {
    useNetworkErrorDetection()
  }
  
  // Report error function
  const reportError = (error: any, context?: Record<string, any>) => {
    const classifiedError = classifyError(error, { context })
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Reported Error:', classifiedError)
    }
    
    // Call custom error handler
    onError?.(error, context)
    
    // In production, you could send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: { classifiedError, context } })
    }
  }
  
  // Set up global error handlers
  useEffect(() => {
    if (!enableGlobalHandlers) return
    
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const classifiedError = classifyError(
        new Error(event.reason?.message || 'Unhandled promise rejection'),
        { 
          context: { 
            type: 'unhandled_rejection', 
            reason: event.reason 
          } 
        }
      )
      
      // Show critical error toast
      if (classifiedError.severity === 'critical') {
        toast.error('Critical Error', {
          description: classifiedError.userMessage,
          duration: 10000
        })
      }
      
      reportError(event.reason, { type: 'unhandled_rejection' })
      event.preventDefault()
    }
    
    // Handle general window errors
    const handleWindowError = (event: ErrorEvent) => {
      const classifiedError = classifyError(
        new Error(event.message),
        {
          context: {
            type: 'window_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      )
      
      reportError(event.error || new Error(event.message), {
        type: 'window_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    }
    
    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleWindowError)
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleWindowError)
    }
  }, [enableGlobalHandlers, reportError])
  
  // Set up React Query global error handler
  useEffect(() => {
    const queryCache = queryClient.getQueryCache()
    const mutationCache = queryClient.getMutationCache()
    
    // Global query error handler
    const unsubscribeQuery = queryCache.subscribe(event => {
      if (event.type === 'updated' && event.query.state.status === 'error') {
        const classifiedError = classifyError(event.query.state.error)
        
        // Only show toast for critical errors (others should be handled by components)
        if (classifiedError.severity === 'critical') {
          toast.error('Data Loading Error', {
            description: classifiedError.userMessage,
            duration: 8000
          })
        }
        
        reportError(event.query.state.error, {
          type: 'query',
          queryKey: event.query.queryKey
        })
      }
    })
    
    // Global mutation error handler
    const unsubscribeMutation = mutationCache.subscribe(event => {
      if (event.type === 'updated' && event.mutation.state.status === 'error') {
        const classifiedError = classifyError(event.mutation.state.error)
        
        reportError(event.mutation.state.error, {
          type: 'mutation',
          variables: event.mutation.state.variables
        })
      }
    })
    
    return () => {
      unsubscribeQuery()
      unsubscribeMutation()
    }
  }, [queryClient, reportError])
  
  const contextValue: ErrorHandlerContextValue = {
    reportError
  }
  
  return (
    <ErrorHandlerContext.Provider value={contextValue}>
      {children}
    </ErrorHandlerContext.Provider>
  )
}
