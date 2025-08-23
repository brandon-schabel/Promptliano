/**
 * Error Boundary System
 * 
 * Comprehensive error handling with recovery patterns
 * Part of Phase 5 optimization layer
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react'
import { QueryClient, QueryErrorResetBoundary } from '@tanstack/react-query'
import { Button } from '@promptliano/ui'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types
// ============================================================================

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | ApiError | null
  errorInfo: ErrorInfo | null
  errorCount: number
  lastErrorTime: number
}

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (props: ErrorFallbackProps) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  isolate?: boolean
  showDetails?: boolean
  maxRetries?: number
  resetKeys?: string[]
  resetOnPropsChange?: boolean
}

export interface ErrorFallbackProps {
  error: Error | ApiError
  errorInfo: ErrorInfo | null
  retry: () => void
  reset: () => void
  errorCount: number
}

// ============================================================================
// Error Classification
// ============================================================================

export function classifyError(error: Error | ApiError): {
  type: 'network' | 'auth' | 'validation' | 'server' | 'client' | 'unknown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
  userMessage: string
} {
  // Check if it's an API error
  if ('code' in error && typeof error.code === 'number') {
    const apiError = error as ApiError
    
    if (apiError.code === 401 || apiError.code === 403) {
      return {
        type: 'auth',
        severity: 'high',
        recoverable: false,
        userMessage: 'You need to sign in to access this content.'
      }
    }
    
    if (apiError.code === 422 || apiError.code === 400) {
      return {
        type: 'validation',
        severity: 'low',
        recoverable: true,
        userMessage: 'Please check your input and try again.'
      }
    }
    
    if (apiError.code === 429) {
      return {
        type: 'server',
        severity: 'medium',
        recoverable: true,
        userMessage: 'Too many requests. Please wait a moment and try again.'
      }
    }
    
    if (apiError.code >= 500) {
      return {
        type: 'server',
        severity: 'high',
        recoverable: true,
        userMessage: 'Something went wrong on our end. Please try again later.'
      }
    }
  }
  
  // Check for network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return {
      type: 'network',
      severity: 'medium',
      recoverable: true,
      userMessage: 'Connection problem. Please check your internet and try again.'
    }
  }
  
  // Check for chunk loading errors (code splitting)
  if (error.message.includes('Loading chunk') || error.message.includes('Failed to import')) {
    return {
      type: 'client',
      severity: 'low',
      recoverable: true,
      userMessage: 'Loading error. The page will refresh automatically.'
    }
  }
  
  // Default classification
  return {
    type: 'unknown',
    severity: 'medium',
    recoverable: true,
    userMessage: 'An unexpected error occurred. Please try again.'
  }
}

// ============================================================================
// Main Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: NodeJS.Timeout | null = null
  private originalProps: ErrorBoundaryProps

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.originalProps = props
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    
    // Update error count
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }))
    
    // Call error handler
    onError?.(error, errorInfo)
    
    // Log to error reporting service
    this.logError(error, errorInfo)
    
    // Auto-retry for certain errors
    this.handleAutoRetry(error)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys = [] } = this.props
    
    if (resetOnPropsChange && this.state.hasError) {
      // Check if any reset keys changed
      const shouldReset = resetKeys.some(key => 
        (prevProps as any)[key] !== (this.props as any)[key]
      )
      
      if (shouldReset) {
        this.reset()
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  private logError(error: Error, errorInfo: ErrorInfo) {
    const classification = classifyError(error)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary Caught:', {
        error,
        errorInfo,
        classification,
        component: errorInfo.componentStack
      })
    }
    
    // Send to error tracking service (e.g., Sentry)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack
    //       }
    //     },
    //     tags: {
    //       type: classification.type,
    //       severity: classification.severity
    //     }
    //   })
    // }
  }

  private handleAutoRetry(error: Error) {
    const { maxRetries = 3 } = this.props
    const classification = classifyError(error)
    
    // Auto-retry for recoverable errors
    if (classification.recoverable && this.state.errorCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, this.state.errorCount), 10000)
      
      this.resetTimeoutId = setTimeout(() => {
        this.retry()
      }, delay)
    }
    
    // Auto-reload for chunk loading errors
    if (classification.type === 'client' && error.message.includes('chunk')) {
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0
    })
  }

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state
    const { children, fallback, isolate = false, showDetails = false } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback({
          error,
          errorInfo,
          retry: this.retry,
          reset: this.reset,
          errorCount
        })
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          retry={this.retry}
          reset={this.reset}
          errorCount={errorCount}
          showDetails={showDetails}
          isolate={isolate}
        />
      )
    }

    return children
  }
}

// ============================================================================
// Default Error Fallback Component
// ============================================================================

function DefaultErrorFallback({
  error,
  errorInfo,
  retry,
  reset,
  errorCount,
  showDetails,
  isolate
}: ErrorFallbackProps & { showDetails?: boolean; isolate?: boolean }) {
  const classification = classifyError(error)
  const [detailsExpanded, setDetailsExpanded] = React.useState(false)

  return (
    <div className={`
      ${isolate ? 'p-4' : 'min-h-screen flex items-center justify-center p-4'}
      bg-background
    `}>
      <div className="max-w-md w-full space-y-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 space-y-4">
          {/* Error Icon and Title */}
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-destructive mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                {classification.severity === 'critical' 
                  ? 'Critical Error'
                  : classification.severity === 'high'
                  ? 'Something went wrong'
                  : 'Oops!'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {classification.userMessage}
              </p>
            </div>
          </div>

          {/* Error Details (Development Only) */}
          {showDetails && process.env.NODE_ENV === 'development' && (
            <div className="space-y-2">
              <button
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {detailsExpanded ? 'Hide' : 'Show'} Details
              </button>
              
              {detailsExpanded && (
                <div className="bg-background/50 rounded p-3 space-y-2">
                  <div className="text-xs font-mono">
                    <div className="text-muted-foreground">Type:</div>
                    <div className="text-foreground">{classification.type}</div>
                  </div>
                  <div className="text-xs font-mono">
                    <div className="text-muted-foreground">Message:</div>
                    <div className="text-foreground break-all">{error.message}</div>
                  </div>
                  {errorInfo?.componentStack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Component Stack
                      </summary>
                      <pre className="mt-2 overflow-x-auto text-[10px] text-muted-foreground">
                        {errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Retry Information */}
          {errorCount > 1 && (
            <div className="text-xs text-muted-foreground">
              Retry attempt {errorCount} of 3
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {classification.recoverable && (
              <Button
                onClick={retry}
                variant="default"
                size="sm"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            
            {!isolate && (
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            )}
            
            {isolate && (
              <Button
                onClick={reset}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Additional Help Text */}
        {classification.type === 'network' && (
          <p className="text-xs text-center text-muted-foreground">
            Check your internet connection and try again
          </p>
        )}
        
        {classification.type === 'auth' && (
          <p className="text-xs text-center text-muted-foreground">
            You may need to sign in again to continue
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Query Error Boundary (TanStack Query Integration)
// ============================================================================

export function QueryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onError={(error, errorInfo) => {
            // Log query errors
            console.error('Query Error:', error, errorInfo)
          }}
          fallback={({ error, retry }) => (
            <DefaultErrorFallback
              error={error}
              errorInfo={null}
              retry={() => {
                reset()
                retry()
              }}
              reset={reset}
              errorCount={1}
            />
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

// ============================================================================
// Async Error Boundary (for Suspense)
// ============================================================================

export function AsyncErrorBoundary({ 
  children,
  fallback 
}: { 
  children: ReactNode
  fallback?: ReactNode 
}) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive mb-2">
            Failed to load this section
          </p>
          <Button onClick={retry} size="sm" variant="outline">
            Retry
          </Button>
        </div>
      )}
    >
      <React.Suspense fallback={fallback || <div>Loading...</div>}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  )
}

// ============================================================================
// HOC for Error Boundary
// ============================================================================

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: ErrorBoundaryProps
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}