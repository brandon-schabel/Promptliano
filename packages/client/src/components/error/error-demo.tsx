/**
 * Error Handling Demo Component
 * For testing different error scenarios (development only)
 */

import { useState } from 'react'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Separator } from '@promptliano/ui'
import { InlineErrorDisplay, LoadingErrorState, SuccessState } from './inline-error-display'
import { useErrorBoundary } from './enhanced-error-boundary'
import { useErrorHandler } from '@/providers/error-handler-provider'
import { ErrorPresets } from '@/lib/error-classification'

// Only show in development
if (process.env.NODE_ENV !== 'development') {
  throw new Error('ErrorDemo is only available in development')
}

export function ErrorDemo() {
  const [currentError, setCurrentError] = useState<any>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const { throwError } = useErrorBoundary()
  const { reportError } = useErrorHandler()
  
  const errorScenarios = [
    {
      name: 'Network Timeout',
      description: 'Simulates a network timeout error',
      severity: 'critical',
      action: () => {
        const error = ErrorPresets.networkTimeout()
        setCurrentError(error)
        reportError(new Error('Network request timed out'))
      }
    },
    {
      name: 'Unauthorized',
      description: 'Simulates an authentication error',
      severity: 'high',
      action: () => {
        const error = ErrorPresets.unauthorized()
        setCurrentError(error)
        reportError({ status: 401, message: 'Unauthorized' })
      }
    },
    {
      name: 'Validation Error',
      description: 'Simulates form validation errors',
      severity: 'medium',
      action: () => {
        const error = ErrorPresets.validation({ email: 'Invalid email format', name: 'Name is required' })
        setCurrentError(error)
        reportError({
          status: 400,
          message: 'Validation failed',
          fields: { email: 'Invalid email format', name: 'Name is required' }
        })
      }
    },
    {
      name: 'Server Error',
      description: 'Simulates a 500 server error',
      severity: 'critical',
      action: () => {
        const error = ErrorPresets.serverError()
        setCurrentError(error)
        reportError({ status: 500, message: 'Internal server error' })
      }
    },
    {
      name: 'Not Found',
      description: 'Simulates a 404 not found error',
      severity: 'medium',
      action: () => {
        const error = ErrorPresets.notFound('User')
        setCurrentError(error)
        reportError({ status: 404, message: 'User not found' })
      }
    },
    {
      name: 'React Error Boundary',
      description: 'Throws an error that will be caught by error boundary',
      severity: 'critical',
      action: () => {
        throwError(new Error('This error will be caught by the error boundary'))
      }
    }
  ]
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      default: return 'outline'
    }
  }
  
  const handleRetry = () => {
    setCurrentError(null)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }
  
  const handleDismiss = () => {
    setCurrentError(null)
  }
  
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Error Handling Demo</h1>
        <p className="text-muted-foreground">
          Test different error scenarios to see how they are handled throughout the application.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Error Scenarios</CardTitle>
          <CardDescription>
            Click on any scenario to trigger the corresponding error type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {errorScenarios.map((scenario, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{scenario.name}</h4>
                    <Badge variant={getSeverityColor(scenario.severity)}>
                      {scenario.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                </div>
                <Button onClick={scenario.action} variant="outline" size="sm">
                  Trigger
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Separator />
      
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Error Display Examples</h2>
        
        {/* Success State */}
        {showSuccess && (
          <div>
            <h3 className="text-md font-medium mb-2">Success State</h3>
            <div className="space-y-3">
              <SuccessState 
                message="Operation completed successfully!" 
                onDismiss={() => setShowSuccess(false)}
                variant="full"
              />
              <SuccessState 
                message="Data saved" 
                variant="compact"
              />
              <SuccessState 
                message="Updated" 
                variant="minimal"
              />
            </div>
          </div>
        )}
        
        {/* Current Error Display */}
        {currentError && (
          <div>
            <h3 className="text-md font-medium mb-2">Current Error Display</h3>
            <div className="space-y-4">
              {/* Full variant */}
              <div>
                <h4 className="text-sm font-medium mb-2">Full Variant</h4>
                <InlineErrorDisplay
                  error={currentError}
                  onRetry={handleRetry}
                  onDismiss={handleDismiss}
                  variant="full"
                />
              </div>
              
              {/* Compact variant */}
              <div>
                <h4 className="text-sm font-medium mb-2">Compact Variant</h4>
                <InlineErrorDisplay
                  error={currentError}
                  onRetry={handleRetry}
                  onDismiss={handleDismiss}
                  variant="compact"
                />
              </div>
              
              {/* Minimal variant */}
              <div>
                <h4 className="text-sm font-medium mb-2">Minimal Variant</h4>
                <InlineErrorDisplay
                  error={currentError}
                  onRetry={handleRetry}
                  variant="minimal"
                />
              </div>
              
              {/* Loading error state */}
              <div>
                <h4 className="text-sm font-medium mb-2">Loading Error State</h4>
                <LoadingErrorState
                  error={currentError}
                  onRetry={handleRetry}
                  className="border rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
        
        {!currentError && !showSuccess && (
          <div className="text-center p-8 text-muted-foreground">
            <p>Trigger an error scenario above to see how it's displayed</p>
          </div>
        )}
      </div>
    </div>
  )
}
