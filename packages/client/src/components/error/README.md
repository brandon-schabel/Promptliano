# Enhanced Error Handling System

A comprehensive error handling system for Promptliano that provides consistent error classification, user-friendly messages, and improved developer experience.

## Features

- **Error Classification**: Automatically categorize errors (network, auth, validation, server, client, AI, unknown)
- **Severity Levels**: Critical, high, medium, and low severity handling
- **User-Friendly Messages**: Convert technical errors into actionable user messages
- **Developer Debugging**: Detailed error information in development mode
- **React Query Integration**: Enhanced query and mutation error handling
- **Toast Notifications**: Automatic toast notifications based on error severity
- **Error Boundaries**: Enhanced error boundaries with classification and recovery
- **Form Validation**: Specialized handling for form validation errors
- **Network Detection**: Automatic online/offline status handling

## Quick Start

### 1. Setup Error Handler Provider

Wrap your app with the ErrorHandlerProvider:

```tsx
import { ErrorHandlerProvider } from '@/components/error'

function App() {
  return (
    <ErrorHandlerProvider>
      <YourApp />
    </ErrorHandlerProvider>
  )
}
```

### 2. Add Error Boundary

Wrap components that might throw errors:

```tsx
import { EnhancedErrorBoundary } from '@/components/error'

function MyComponent() {
  return (
    <EnhancedErrorBoundary>
      <ComponentThatMightFail />
    </EnhancedErrorBoundary>
  )
}
```

### 3. Enhanced Query Error Handling

```tsx
import { useQuery } from '@tanstack/react-query'
import { useEnhancedQueryOptions, LoadingErrorState } from '@/components/error'

function DataComponent() {
  const { getQueryOptions } = useEnhancedQueryOptions()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
    ...getQueryOptions(['data']) // Automatic retry logic and error handling
  })
  
  if (error) {
    return <LoadingErrorState error={error} onRetry={() => refetch()} />
  }
  
  // ... rest of component
}
```

### 4. Form Error Handling

```tsx
import { useFormErrorHandler, FieldErrorDisplay } from '@/components/error'

function MyForm() {
  const { handleFormError } = useFormErrorHandler()
  const [fieldErrors, setFieldErrors] = useState({})
  
  const mutation = useMutation({
    mutationFn: submitForm,
    onError: (error) => {
      const { fieldErrors } = handleFormError(error)
      setFieldErrors(fieldErrors)
    }
  })
  
  return (
    <form>
      <input name="email" />
      <FieldErrorDisplay error={fieldErrors.email} />
    </form>
  )
}
```

## Components

### EnhancedErrorBoundary

An advanced error boundary with classification and recovery options.

```tsx
<EnhancedErrorBoundary
  fallback={(error, retry) => <CustomErrorUI error={error} onRetry={retry} />}
  onError={(error) => console.log('Error caught:', error)}
  showErrorDetails={true} // Shows debug info in development
  enableRetry={true}
  context={{ page: 'dashboard' }}
>
  <YourComponent />
</EnhancedErrorBoundary>
```

### InlineErrorDisplay

Flexible error display component for various UI contexts.

```tsx
// Full variant (default)
<InlineErrorDisplay
  error={error}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
  variant="full"
/>

// Compact variant
<InlineErrorDisplay
  error={error}
  variant="compact"
  showIcon={true}
  showActions={true}
/>

// Minimal variant
<InlineErrorDisplay
  error={error}
  variant="minimal"
/>
```

### LoadingErrorState

Centered error state for data loading scenarios.

```tsx
<LoadingErrorState
  error={error}
  onRetry={refetch}
  title="Failed to load data"
  description="Custom description override"
/>
```

### FieldErrorDisplay

Specialized component for form field errors.

```tsx
<FieldErrorDisplay error={fieldError} />
<FieldErrorDisplay error={["Error 1", "Error 2"]} /> {/* Multiple errors */}
```

### SuccessState

Component for displaying success messages.

```tsx
<SuccessState
  message="Operation completed successfully!"
  onDismiss={handleDismiss}
  variant="full" // "full" | "compact" | "minimal"
/>
```

## Hooks

### useEnhancedQueryOptions

Provides enhanced React Query options with automatic retry logic.

```tsx
const { getQueryOptions } = useEnhancedQueryOptions()

const queryOptions = getQueryOptions(['my-query'])
// Returns: { retry, retryDelay, onError }
```

### useEnhancedMutationOptions

Provides enhanced mutation options with error handling and query invalidation.

```tsx
const { getMutationOptions } = useEnhancedMutationOptions()

const mutationOptions = getMutationOptions({
  onSuccess: (data) => console.log('Success:', data),
  invalidateQueries: [['users'], ['projects']],
  successMessage: "User created successfully!"
})
```

### useFormErrorHandler

Specialized hook for form validation errors.

```tsx
const { handleFormError } = useFormErrorHandler()

const mutation = useMutation({
  onError: (error) => {
    const { fieldErrors, classifiedError } = handleFormError(error)
    setFieldErrors(fieldErrors)
  }
})
```

### useErrorRecovery

Utilities for error recovery and cache management.

```tsx
const { retryFailedQueries, clearErrorQueries, resetQueryCache } = useErrorRecovery()

// Retry all failed queries that are retryable
retryFailedQueries()

// Clear all queries with errors
clearErrorQueries()

// Reset the entire query cache
resetQueryCache()
```

### useGlobalErrorHandler

Access to the global error handler.

```tsx
const { handleError } = useGlobalErrorHandler()

// Manually report an error
handleError(new Error('Something went wrong'), { context: 'manual' })
```

## Error Classification

The system automatically classifies errors into categories and severity levels:

### Categories
- **network**: Connection issues, timeouts
- **auth**: Authentication and authorization errors
- **validation**: Form validation and input errors
- **server**: 5xx server errors
- **client**: 4xx client errors (except auth/validation)
- **ai**: AI service specific errors
- **unknown**: Unclassified errors

### Severity Levels
- **critical**: Network, server errors (show persistent toasts)
- **high**: Auth errors (show error toasts)
- **medium**: Validation, client errors (show warning toasts)
- **low**: AI, unknown errors (minimal UI feedback)

### Manual Classification

```tsx
import { classifyError, ErrorPresets } from '@/components/error'

// Classify any error
const classified = classifyError(error, {
  context: { userId: '123' },
  includeDebugInfo: true
})

// Use presets for common scenarios
const networkError = ErrorPresets.networkTimeout()
const authError = ErrorPresets.unauthorized()
const validationError = ErrorPresets.validation({ email: 'Invalid format' })
```

## Configuration

### ErrorHandlerProvider Options

```tsx
<ErrorHandlerProvider
  enableGlobalHandlers={true} // Handle unhandled rejections
  enableNetworkDetection={true} // Detect online/offline status
  onError={(error, context) => {
    // Custom error reporting (e.g., Sentry)
    console.log('Error reported:', error, context)
  }}
>
  <App />
</ErrorHandlerProvider>
```

### Development vs Production

- **Development**: Full debug information, detailed error messages, stack traces
- **Production**: User-friendly messages only, errors can be sent to error reporting services

## Best Practices

1. **Use Error Boundaries**: Wrap major sections of your app with `EnhancedErrorBoundary`
2. **Handle Query Errors**: Use `LoadingErrorState` for data fetching errors
3. **Form Validation**: Use `FieldErrorDisplay` for individual field errors
4. **Consistent Retry Logic**: Let the system handle retry logic automatically
5. **User-Friendly Messages**: The system provides user-friendly messages automatically
6. **Error Reporting**: Configure the `ErrorHandlerProvider` to send errors to your reporting service

## Migration from Existing Error Handling

1. Replace custom error boundaries with `EnhancedErrorBoundary`
2. Use `useEnhancedQueryOptions` and `useEnhancedMutationOptions` instead of manual error handling
3. Replace custom error displays with `InlineErrorDisplay` components
4. Remove manual toast calls for errors (system handles this automatically)
5. Use `FieldErrorDisplay` for form validation errors

## Testing

In development mode, you can use the `ErrorDemo` component to test different error scenarios:

```tsx
import { ErrorDemo } from '@/components/error'

// Only available in development
function TestPage() {
  return <ErrorDemo />
}
```

## TypeScript Support

Full TypeScript support with proper types:

```tsx
import type { ClassifiedError, ErrorCategory, ErrorSeverity } from '@/components/error'

function handleError(error: ClassifiedError) {
  console.log('Category:', error.category) // ErrorCategory
  console.log('Severity:', error.severity) // ErrorSeverity
}
```
