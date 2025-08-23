/**
 * Inline Error Display Components
 * For showing errors within forms, data tables, and other UI components
 */

import { 
  AlertCircle, 
  AlertTriangle, 
  Wifi, 
  Shield, 
  Server, 
  RefreshCw, 
  X,
  Info,
  CheckCircle
} from 'lucide-react'
import { Button } from '@promptliano/ui'
import { Alert, AlertDescription, AlertTitle } from '@promptliano/ui'
import { classifyError, type ClassifiedError } from '@/lib/error-classification'
import { cn } from '@promptliano/ui/utils'

export interface InlineErrorDisplayProps {
  error: any
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: 'full' | 'compact' | 'minimal'
  showIcon?: boolean
  showActions?: boolean
}

export function InlineErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
  variant = 'full',
  showIcon = true,
  showActions = true
}: InlineErrorDisplayProps) {
  const classifiedError = classifyError(error)
  const Icon = getErrorIcon(classifiedError.category)
  
  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)}>
        {showIcon && <Icon className="h-4 w-4" />}
        <span>{classifiedError.userMessage}</span>
        {showActions && onRetry && classifiedError.retryable && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }
  
  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        getErrorStyling(classifiedError),
        className
      )}>
        {showIcon && <Icon className="h-4 w-4 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{classifiedError.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{classifiedError.userMessage}</p>
        </div>
        {showActions && (
          <div className="flex items-center gap-1">
            {onRetry && classifiedError.retryable && (
              <Button size="sm" variant="ghost" onClick={onRetry}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
  
  // Full variant
  return (
    <Alert 
      variant={classifiedError.severity === 'critical' ? 'destructive' : 'default'} 
      className={className}
    >
      {showIcon && <Icon className="h-4 w-4" />}
      <AlertTitle>{classifiedError.title}</AlertTitle>
      <AlertDescription className="mt-2">
        {classifiedError.userMessage}
        {showActions && (onRetry || onDismiss) && (
          <div className="flex gap-2 mt-3">
            {onRetry && classifiedError.retryable && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Try Again
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Field Error Display - for form fields
 */
export interface FieldErrorDisplayProps {
  error?: string | string[]
  className?: string
}

export function FieldErrorDisplay({ error, className }: FieldErrorDisplayProps) {
  if (!error) return null
  
  const errorMessage = Array.isArray(error) ? error[0] : error
  
  return (
    <div className={cn("flex items-center gap-1 text-sm text-destructive mt-1", className)}>
      <AlertCircle className="h-3 w-3" />
      <span>{errorMessage}</span>
    </div>
  )
}

/**
 * Loading Error State - for data fetching components
 */
export interface LoadingErrorStateProps {
  error: any
  onRetry?: () => void
  className?: string
  title?: string
  description?: string
}

export function LoadingErrorState({
  error,
  onRetry,
  className,
  title,
  description
}: LoadingErrorStateProps) {
  const classifiedError = classifyError(error)
  const Icon = getErrorIcon(classifiedError.category)
  
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {title || classifiedError.title}
      </h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        {description || classifiedError.userMessage}
      </p>
      {onRetry && classifiedError.retryable && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  )
}

/**
 * Success State Display - for showing success messages
 */
export interface SuccessStateProps {
  message: string
  onDismiss?: () => void
  className?: string
  variant?: 'full' | 'compact' | 'minimal'
}

export function SuccessState({
  message,
  onDismiss,
  className,
  variant = 'full'
}: SuccessStateProps) {
  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <CheckCircle className="h-4 w-4" />
        <span>{message}</span>
      </div>
    )
  }
  
  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50",
        className
      )}>
        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-sm text-green-800">{message}</span>
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <Alert className={cn("border-green-200 bg-green-50", className)}>
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-800">Success</AlertTitle>
      <AlertDescription className="text-green-700">
        {message}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss} className="mt-2">
            Dismiss
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Helper Functions
 */
function getErrorIcon(category: ClassifiedError['category']) {
  switch (category) {
    case 'network':
      return Wifi
    case 'auth':
      return Shield
    case 'server':
      return Server
    case 'validation':
      return AlertTriangle
    case 'client':
      return Info
    case 'ai':
      return AlertCircle
    default:
      return AlertCircle
  }
}

function getErrorStyling(classifiedError: ClassifiedError) {
  switch (classifiedError.severity) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-800'
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-800'
    case 'medium':
      return 'border-yellow-200 bg-yellow-50 text-yellow-800'
    default:
      return 'border-blue-200 bg-blue-50 text-blue-800'
  }
}
