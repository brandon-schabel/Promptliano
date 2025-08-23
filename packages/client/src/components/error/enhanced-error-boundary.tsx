/**
 * Enhanced Error Boundary with Classification
 * Provides better user experience and developer debugging
 */

import { Component, type PropsWithChildren, type ReactNode } from 'react'
import { AlertCircle, RefreshCw, Bug, ExternalLink } from 'lucide-react'
import { Button } from '@promptliano/ui'
import { Alert, AlertDescription, AlertTitle } from '@promptliano/ui'
import { classifyError, type ClassifiedError } from '@/lib/error-classification'
import { toast } from 'sonner'

interface EnhancedErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: ClassifiedError, retry: () => void) => ReactNode
  onError?: (error: ClassifiedError) => void
  showErrorDetails?: boolean
  enableRetry?: boolean
  context?: Record<string, any>
}

interface EnhancedErrorBoundaryState {
  hasError: boolean
  classifiedError: ClassifiedError | null
  errorId: string | null
}

export class EnhancedErrorBoundary extends Component<
  EnhancedErrorBoundaryProps,
  EnhancedErrorBoundaryState
> {
  private retryCount = 0
  private readonly maxRetries = 3

  constructor(props: EnhancedErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      classifiedError: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): EnhancedErrorBoundaryState {
    const classifiedError = classifyError(error, {
      context: { source: 'error-boundary' },
      includeDebugInfo: true
    })
    
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`    
    return {
      hasError: true,
      classifiedError,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, context } = this.props
    const { classifiedError, errorId } = this.state
    
    if (!classifiedError) return

    // Enhanced error logging
    const enhancedError = {
      ...classifiedError,
      debugInfo: {
        ...classifiedError.debugInfo,
        errorId,
        componentStack: errorInfo.componentStack,
        errorBoundary: 'EnhancedErrorBoundary',
        retryCount: this.retryCount,
        context
      }
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary Caught Error [${errorId}]`)
      console.error('Original Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Classified Error:', enhancedError)
      console.groupEnd()
    }

    // Call custom error handler
    if (onError) {
      onError(enhancedError)
    }

    // Show toast notification for critical errors
    if (classifiedError.severity === 'critical') {
      toast.error(`Critical error occurred (ID: ${errorId})`, {
        description: classifiedError.userMessage,
        duration: 10000
      })
    }
  }

  handleRetry = () => {
    const { classifiedError } = this.state
    
    if (!classifiedError?.retryable || this.retryCount >= this.maxRetries) {
      return
    }

    this.retryCount++
    
    // Reset error state
    this.setState({
      hasError: false,
      classifiedError: null,
      errorId: null
    })

    // Show retry toast
    toast.info(`Retrying... (${this.retryCount}/${this.maxRetries})`)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { children, fallback, showErrorDetails = false, enableRetry = true } = this.props
    const { hasError, classifiedError, errorId } = this.state

    if (!hasError || !classifiedError) {
      return children
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback(classifiedError, this.handleRetry)
    }

    // Default error UI
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <Alert variant={classifiedError.severity === 'critical' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{classifiedError.title}</AlertTitle>
            <AlertDescription>{classifiedError.userMessage}</AlertDescription>
          </Alert>

          {/* Error Actions */}
          <div className="flex flex-col gap-2">
            {/* Retry button */}
            {enableRetry && classifiedError.retryable && this.retryCount < this.maxRetries && (
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again ({this.maxRetries - this.retryCount} attempts left)
              </Button>
            )}

            {/* Reload page button */}
            <Button variant="outline" onClick={this.handleReload} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
          </div>

          {/* Developer Debug Info */}
          {showErrorDetails && process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Information
              </summary>
              <div className="mt-2 p-3 bg-muted rounded text-xs font-mono">
                <div className="space-y-2">
                  <div><strong>Error ID:</strong> {errorId}</div>
                  <div><strong>Category:</strong> {classifiedError.category}</div>
                  <div><strong>Severity:</strong> {classifiedError.severity}</div>
                  <div><strong>Retryable:</strong> {classifiedError.retryable ? 'Yes' : 'No'}</div>
                  {classifiedError.debugInfo?.statusCode && (
                    <div><strong>Status Code:</strong> {classifiedError.debugInfo.statusCode}</div>
                  )}
                  <div><strong>Timestamp:</strong> {new Date(classifiedError.debugInfo?.timestamp || Date.now()).toISOString()}</div>
                  {classifiedError.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted-foreground">Stack Trace</summary>
                      <pre className="mt-2 text-xs whitespace-pre-wrap break-all">
                        {classifiedError.details}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    )
  }
}

/**
 * Hook for using error boundary context
 */
export function useErrorBoundary() {
  const throwError = (error: Error | string) => {
    const errorObj = error instanceof Error ? error : new Error(error)
    throw errorObj
  }

  return { throwError }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<EnhancedErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}
