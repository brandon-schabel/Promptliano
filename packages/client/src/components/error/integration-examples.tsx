/**
 * Error Handling Integration Examples
 * Shows how to integrate error handling into different parts of the app
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { 
  InlineErrorDisplay, 
  FieldErrorDisplay, 
  LoadingErrorState,
  useEnhancedQueryOptions,
  useEnhancedMutationOptions,
  useFormErrorHandler
} from './index'

/**
 * Example 1: Enhanced Query with Error Handling
 */
export function DataFetchingExample() {
  const { getQueryOptions } = useEnhancedQueryOptions()
  
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['example-data'],
    queryFn: async () => {
      // Simulate random errors for demo
      const rand = Math.random()
      if (rand < 0.3) throw new Error('Network timeout')
      if (rand < 0.6) throw { status: 500, message: 'Server error' }
      return { message: 'Data loaded successfully!' }
    },
    ...getQueryOptions(['example-data'])
  })
  
  if (isLoading) {
    return <div className="p-4">Loading...</div>
  }
  
  if (error) {
    return (
      <LoadingErrorState
        error={error}
        onRetry={() => refetch()}
        title="Failed to load data"
        description="There was a problem loading the data. Please try again."
      />
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Fetching with Error Handling</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{data?.message}</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-2">
          Refresh Data
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Example 2: Form with Validation Error Handling
 */
export function FormExample() {
  const [formData, setFormData] = useState({ email: '', name: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { handleFormError } = useFormErrorHandler()
  const { getMutationOptions } = useEnhancedMutationOptions()
  
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Simulate validation errors
      if (!data.email.includes('@')) {
        throw {
          status: 400,
          message: 'Validation failed',
          fields: { email: 'Invalid email format' }
        }
      }
      if (data.name.length < 2) {
        throw {
          status: 400,
          message: 'Validation failed',
          fields: { name: 'Name must be at least 2 characters' }
        }
      }
      return { success: true }
    },
    ...getMutationOptions({
      onSuccess: () => {
        setFieldErrors({})
        setFormData({ email: '', name: '' })
      },
      onError: (error) => {
        const { fieldErrors } = handleFormError(error)
        setFieldErrors(fieldErrors)
      },
      successMessage: 'Form submitted successfully!'
    })
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form with Error Handling</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-2 border rounded"
              placeholder="Enter your email"
            />
            <FieldErrorDisplay error={fieldErrors.email} />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border rounded"
              placeholder="Enter your name"
            />
            <FieldErrorDisplay error={fieldErrors.name} />
          </div>
          
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * Example 3: Inline Error Display Variants
 */
export function InlineErrorExample() {
  const [selectedError, setSelectedError] = useState<string | null>(null)
  
  const errorExamples = {
    network: new Error('Network connection failed'),
    auth: { status: 401, message: 'Unauthorized access' },
    validation: { status: 400, message: 'Invalid input data' },
    server: { status: 500, message: 'Internal server error' }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inline Error Display Variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {Object.keys(errorExamples).map(errorType => (
            <Button
              key={errorType}
              variant={selectedError === errorType ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedError(errorType)}
            >
              {errorType} error
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedError(null)}
          >
            Clear
          </Button>
        </div>
        
        {selectedError && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">Full Variant</h4>
              <InlineErrorDisplay
                error={errorExamples[selectedError as keyof typeof errorExamples]}
                onRetry={() => console.log('Retry clicked')}
                onDismiss={() => setSelectedError(null)}
                variant="full"
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Compact Variant</h4>
              <InlineErrorDisplay
                error={errorExamples[selectedError as keyof typeof errorExamples]}
                onRetry={() => console.log('Retry clicked')}
                onDismiss={() => setSelectedError(null)}
                variant="compact"
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Minimal Variant</h4>
              <InlineErrorDisplay
                error={errorExamples[selectedError as keyof typeof errorExamples]}
                variant="minimal"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Example 4: Complete Integration Example
 */
export function CompleteIntegrationExample() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Error Handling Integration Examples</h2>
        <p className="text-muted-foreground">
          These examples show how to integrate the error handling system into different parts of your application.
        </p>
      </div>
      
      <DataFetchingExample />
      <FormExample />
      <InlineErrorExample />
    </div>
  )
}
