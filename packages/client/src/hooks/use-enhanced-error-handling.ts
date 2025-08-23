/**
 * Enhanced Error Handling Hooks
 * Integration with React Query and error classification
 */

import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { classifyError, type ClassifiedError } from '@/lib/error-classification'

/**
 * Global error handler hook
 */
export function useGlobalErrorHandler() {
  const handleError = useCallback((error: any, context?: Record<string, any>) => {
    const classifiedError = classifyError(error, { context })
    
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Global Error Handler:', classifiedError)
    }
    
    // Show appropriate toast based on severity
    switch (classifiedError.severity) {
      case 'critical':
        toast.error(classifiedError.title, {
          description: classifiedError.userMessage,
          duration: 10000
        })
        break
      case 'high':
        toast.error(classifiedError.title, {
          description: classifiedError.userMessage,
          duration: 8000
        })
        break
      case 'medium':
        toast.warning(classifiedError.title, {
          description: classifiedError.userMessage,
          duration: 5000
        })
        break
      case 'low':
        // Don't show toast for low severity errors by default
        break
    }
    
    return classifiedError
  }, [])
  
  return { handleError }
}

/**
 * Query error handler hook
 */
export function useQueryErrorHandler() {
  const { handleError } = useGlobalErrorHandler()
  
  const handleQueryError = useCallback((error: any, queryKey?: string[]) => {
    const context = {
      type: 'query',
      queryKey: queryKey?.join('.') || 'unknown'
    }
    
    return handleError(error, context)
  }, [handleError])
  
  return { handleQueryError }
}

/**
 * Mutation error handler hook
 */
export function useMutationErrorHandler() {
  const { handleError } = useGlobalErrorHandler()
  
  const handleMutationError = useCallback((error: any, variables?: any) => {
    const context = {
      type: 'mutation',
      variables
    }
    
    const classifiedError = handleError(error, context)
    
    // For validation errors, don't show toast (form will handle it)
    if (classifiedError.category === 'validation') {
      return classifiedError
    }
    
    return classifiedError
  }, [handleError])
  
  return { handleMutationError }
}

/**
 * Enhanced query options with error handling
 */
export function useEnhancedQueryOptions() {
  const { handleQueryError } = useQueryErrorHandler()
  
  const getQueryOptions = useCallback((queryKey: string[]) => ({
    retry: (failureCount: number, error: any) => {
      const classifiedError = classifyError(error)
      
      // Don't retry auth or validation errors
      if (classifiedError.category === 'auth' || classifiedError.category === 'validation') {
        return false
      }
      
      // Retry network and server errors up to 3 times
      if (classifiedError.category === 'network' || classifiedError.category === 'server') {
        return failureCount < 3
      }
      
      return false
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error: any) => handleQueryError(error, queryKey)
  }), [handleQueryError])
  
  return { getQueryOptions }
}

/**
 * Enhanced mutation options with error handling
 */
export function useEnhancedMutationOptions() {
  const { handleMutationError } = useMutationErrorHandler()
  const queryClient = useQueryClient()
  
  const getMutationOptions = useCallback(<TData, TError, TVariables>(
    options: {
      onSuccess?: (data: TData, variables: TVariables) => void
      onError?: (error: TError, variables: TVariables) => void
      invalidateQueries?: string[][]
      successMessage?: string
    } = {}
  ) => ({
    onSuccess: (data: TData, variables: TVariables) => {
      // Show success toast if provided
      if (options.successMessage) {
        toast.success(options.successMessage)
      }
      
      // Invalidate specified queries
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }
      
      // Call custom success handler
      options.onSuccess?.(data, variables)
    },
    onError: (error: TError, variables: TVariables) => {
      const classifiedError = handleMutationError(error, variables)
      
      // Call custom error handler with classified error
      options.onError?.(error, variables)
      
      return classifiedError
    }
  }), [handleMutationError, queryClient])
  
  return { getMutationOptions }
}

/**
 * Error recovery hook
 */
export function useErrorRecovery() {
  const queryClient = useQueryClient()
  
  const retryFailedQueries = useCallback(() => {
    queryClient.getQueryCache().getAll().forEach(query => {
      if (query.state.status === 'error') {
        const classifiedError = classifyError(query.state.error)
        if (classifiedError.retryable) {
          queryClient.refetchQueries({ queryKey: query.queryKey })
        }
      }
    })
  }, [queryClient])
  
  const clearErrorQueries = useCallback(() => {
    queryClient.getQueryCache().getAll().forEach(query => {
      if (query.state.status === 'error') {
        queryClient.removeQueries({ queryKey: query.queryKey })
      }
    })
  }, [queryClient])
  
  const resetQueryCache = useCallback(() => {
    queryClient.clear()
  }, [queryClient])
  
  return {
    retryFailedQueries,
    clearErrorQueries,
    resetQueryCache
  }
}

/**
 * Network status hook with error handling
 */
export function useNetworkErrorDetection() {
  const { handleError } = useGlobalErrorHandler()
  
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Connection restored', {
        description: 'You are back online'
      })
    }
    
    const handleOffline = () => {
      handleError(new Error('Network connection lost'), {
        type: 'network',
        source: 'offline-detection'
      })
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleError])
}

/**
 * Form error handler hook
 */
export function useFormErrorHandler() {
  const handleFormError = useCallback((error: any) => {
    const classifiedError = classifyError(error)
    
    // For validation errors, return field-specific errors
    if (classifiedError.category === 'validation') {
      if (error?.issues) {
        // Zod validation errors
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach((issue: any) => {
          const field = issue.path?.[0] || 'general'
          fieldErrors[field] = issue.message
        })
        return { fieldErrors, classifiedError }
      }
      
      if (error?.fields) {
        // API validation errors
        const fieldErrors: Record<string, string> = {}
        Object.entries(error.fields).forEach(([field, message]) => {
          fieldErrors[field] = Array.isArray(message) ? message[0] : message as string
        })
        return { fieldErrors, classifiedError }
      }
    }
    
    // For non-validation errors, show toast
    if (classifiedError.severity !== 'low') {
      toast.error(classifiedError.title, {
        description: classifiedError.userMessage
      })
    }
    
    return { fieldErrors: {}, classifiedError }
  }, [])
  
  return { handleFormError }
}
