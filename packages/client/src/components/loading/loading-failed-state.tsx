import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { ErrorEmptyState, type ErrorEmptyStateProps } from '@promptliano/ui'
import { 
  AlertCircle, 
  Wifi, 
  Server, 
  Shield, 
  Clock, 
  Database,
  RefreshCw,
  HelpCircle,
  Settings,
  Bug
} from 'lucide-react'

export interface LoadingFailedStateProps extends Omit<ErrorEmptyStateProps, 'error'> {
  failureType?: 'network' | 'server' | 'timeout' | 'permission' | 'data' | 'client' | 'unknown'
  entityType?: string
  errorMessage?: string
  errorCode?: string | number
  retryCount?: number
  maxRetries?: number
  onRetry?: () => void
  onReportIssue?: () => void
  onContactSupport?: () => void
  showErrorDetails?: boolean
  className?: string
}

export function LoadingFailedState({
  failureType = 'unknown',
  entityType = 'data',
  errorMessage,
  errorCode,
  retryCount = 0,
  maxRetries = 3,
  onRetry,
  onReportIssue,
  onContactSupport,
  showErrorDetails = false,
  title,
  description,
  className,
  ...props
}: LoadingFailedStateProps) {
  const canRetry = retryCount < maxRetries && onRetry
  
  const getFailureContent = () => {
    switch (failureType) {
      case 'network':
        return {
          icon: Wifi,
          defaultTitle: 'Connection problem',
          defaultDescription: `Can't connect to the server to load ${entityType}. Check your internet connection and try again.`,
          primaryAction: canRetry ? {
            label: retryCount > 0 ? `Retry (${retryCount}/${maxRetries})` : 'Retry',
            onClick: onRetry,
            icon: RefreshCw,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(onContactSupport ? [{
              label: 'Contact Support',
              onClick: onContactSupport,
              icon: HelpCircle,
              variant: 'outline' as const
            }] : [])
          ],
          tip: 'Check your internet connection or try again in a few moments'
        }

      case 'server':
        return {
          icon: Server,
          defaultTitle: 'Server unavailable',
          defaultDescription: `The server is temporarily unavailable and can't load ${entityType}. This is usually temporary.`,
          primaryAction: canRetry ? {
            label: retryCount > 0 ? `Try Again (${retryCount}/${maxRetries})` : 'Try Again',
            onClick: onRetry,
            icon: RefreshCw,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(onReportIssue ? [{
              label: 'Report Issue',
              onClick: onReportIssue,
              icon: Bug,
              variant: 'outline' as const
            }] : [])
          ],
          tip: 'Server issues are usually resolved quickly. Try again in a few minutes.'
        }

      case 'timeout':
        return {
          icon: Clock,
          defaultTitle: 'Request timed out',
          defaultDescription: `Loading ${entityType} took too long and timed out. The server might be busy.`,
          primaryAction: canRetry ? {
            label: retryCount > 0 ? `Retry (${retryCount}/${maxRetries})` : 'Retry',
            onClick: onRetry,
            icon: RefreshCw,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(onContactSupport ? [{
              label: 'Contact Support',
              onClick: onContactSupport,
              icon: HelpCircle,
              variant: 'outline' as const
            }] : [])
          ],
          tip: 'Timeouts often resolve themselves. Try again or contact support if it persists.'
        }

      case 'permission':
        return {
          icon: Shield,
          defaultTitle: 'Access denied',
          defaultDescription: `You don't have permission to access this ${entityType}. Contact your administrator for access.`,
          primaryAction: onContactSupport ? {
            label: 'Request Access',
            onClick: onContactSupport,
            icon: HelpCircle,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(canRetry ? [{
              label: 'Try Again',
              onClick: onRetry,
              icon: RefreshCw,
              variant: 'outline' as const
            }] : [])
          ],
          tip: 'Contact your team administrator or project owner to get the right permissions'
        }

      case 'data':
        return {
          icon: Database,
          defaultTitle: 'Data error',
          defaultDescription: `There was a problem with the ${entityType} data. This might be a temporary issue.`,
          primaryAction: canRetry ? {
            label: retryCount > 0 ? `Reload (${retryCount}/${maxRetries})` : 'Reload',
            onClick: onRetry,
            icon: RefreshCw,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(onReportIssue ? [{
              label: 'Report Data Issue',
              onClick: onReportIssue,
              icon: Bug,
              variant: 'outline' as const
            }] : [])
          ],
          tip: 'Data issues can sometimes be resolved by reloading or clearing cache'
        }

      case 'client':
        return {
          icon: Settings,
          defaultTitle: 'App error',
          defaultDescription: `Something went wrong in the app while loading ${entityType}. This might be a browser issue.`,
          primaryAction: canRetry ? {
            label: 'Reload',
            onClick: onRetry,
            icon: RefreshCw,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(onReportIssue ? [{
              label: 'Report Bug',
              onClick: onReportIssue,
              icon: Bug,
              variant: 'outline' as const
            }] : []),
            {
              label: 'Refresh Page',
              onClick: () => window.location.reload(),
              icon: RefreshCw,
              variant: 'outline' as const
            }
          ],
          tip: 'Try refreshing the page or clearing your browser cache if the problem persists'
        }

      default: // 'unknown'
        return {
          icon: AlertCircle,
          defaultTitle: 'Something went wrong',
          defaultDescription: `We couldn't load ${entityType}. This might be a temporary issue.`,
          primaryAction: canRetry ? {
            label: retryCount > 0 ? `Try Again (${retryCount}/${maxRetries})` : 'Try Again',
            onClick: onRetry,
            icon: RefreshCw,
            variant: 'default' as const,
            loading: false
          } : undefined,
          secondaryActions: [
            ...(onReportIssue ? [{
              label: 'Report Issue',
              onClick: onReportIssue,
              icon: Bug,
              variant: 'outline' as const
            }] : []),
            ...(onContactSupport ? [{
              label: 'Get Help',
              onClick: onContactSupport,
              icon: HelpCircle,
              variant: 'outline' as const
            }] : [])
          ],
          tip: 'If this problem persists, try refreshing the page or contact support'
        }
    }
  }

  const content = getFailureContent()
  
  // Combine provided actions with failure-specific actions
  const allActions = [
    ...(content.primaryAction ? [content.primaryAction] : []),
    ...content.secondaryActions
  ]

  // Create error message with details if available
  const enhancedDescription = React.useMemo(() => {
    let desc = description || content.defaultDescription
    
    if (showErrorDetails && (errorMessage || errorCode)) {
      desc += '\n\n'
      if (errorCode) {
        desc += `Error code: ${errorCode}`
      }
      if (errorMessage && errorMessage !== desc) {
        desc += errorCode ? `\n${errorMessage}` : errorMessage
      }
    }
    
    return desc
  }, [description, content.defaultDescription, errorMessage, errorCode, showErrorDetails])

  return (
    <div className={cn('space-y-4', className)}>
      <ErrorEmptyState
        {...props}
        title={title || content.defaultTitle}
        description={enhancedDescription}
        actions={allActions}
        icon={content.icon}
        className={cn(
          'border-destructive/20 bg-destructive/5',
          retryCount > 0 && 'border-warning/20 bg-warning/5'
        )}
      />
      
      {content.tip && (
        <div className='text-center'>
          <p className='text-xs text-muted-foreground italic'>
            💡 {content.tip}
          </p>
        </div>
      )}
      
      {showErrorDetails && (errorMessage || errorCode) && (
        <details className='text-sm text-muted-foreground'>
          <summary className='cursor-pointer hover:text-foreground'>
            Technical Details
          </summary>
          <div className='mt-2 p-3 bg-muted rounded-md font-mono text-xs'>
            {errorCode && <div>Code: {errorCode}</div>}
            {errorMessage && <div>Message: {errorMessage}</div>}
            {retryCount > 0 && <div>Retry attempts: {retryCount}/{maxRetries}</div>}
          </div>
        </details>
      )}
    </div>
  )
}

// Specialized loading failed states for common scenarios
export interface NetworkErrorStateProps {
  entityType?: string
  onRetry?: () => void
  retryCount?: number
  className?: string
}

export function NetworkErrorState({ 
  entityType = 'data', 
  onRetry, 
  retryCount = 0,
  className 
}: NetworkErrorStateProps) {
  return (
    <LoadingFailedState
      failureType='network'
      entityType={entityType}
      onRetry={onRetry}
      retryCount={retryCount}
      className={className}
    />
  )
}

export interface ServerErrorStateProps {
  entityType?: string
  errorCode?: string | number
  onRetry?: () => void
  onReportIssue?: () => void
  retryCount?: number
  className?: string
}

export function ServerErrorState({ 
  entityType = 'data', 
  errorCode,
  onRetry, 
  onReportIssue,
  retryCount = 0,
  className 
}: ServerErrorStateProps) {
  return (
    <LoadingFailedState
      failureType='server'
      entityType={entityType}
      errorCode={errorCode}
      onRetry={onRetry}
      onReportIssue={onReportIssue}
      retryCount={retryCount}
      showErrorDetails={!!errorCode}
      className={className}
    />
  )
}

export interface PermissionErrorStateProps {
  entityType?: string
  onRequestAccess?: () => void
  className?: string
}

export function PermissionErrorState({ 
  entityType = 'content', 
  onRequestAccess,
  className 
}: PermissionErrorStateProps) {
  return (
    <LoadingFailedState
      failureType='permission'
      entityType={entityType}
      onContactSupport={onRequestAccess}
      className={className}
    />
  )
}