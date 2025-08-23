/**
 * Error Handling Components
 * Centralized exports for all error-related components and utilities
 */

// Core error boundary
export { EnhancedErrorBoundary, useErrorBoundary, withErrorBoundary } from './enhanced-error-boundary'

// Inline error displays
export {
  InlineErrorDisplay,
  FieldErrorDisplay,
  LoadingErrorState,
  SuccessState
} from './inline-error-display'

// Error classification
export { classifyError, ErrorPresets } from '../../lib/error-classification'
export type { ClassifiedError, ErrorCategory, ErrorSeverity } from '../../lib/error-classification'

// Error handling hooks
export {
  useGlobalErrorHandler,
  useQueryErrorHandler,
  useMutationErrorHandler,
  useEnhancedQueryOptions,
  useEnhancedMutationOptions,
  useErrorRecovery,
  useNetworkErrorDetection,
  useFormErrorHandler
} from '../../hooks/use-enhanced-error-handling'

// Error provider
export { ErrorHandlerProvider, useErrorHandler } from '../../providers/error-handler-provider'

// Demo component (development only)
if (process.env.NODE_ENV === 'development') {
  export { ErrorDemo } from './error-demo'
}
