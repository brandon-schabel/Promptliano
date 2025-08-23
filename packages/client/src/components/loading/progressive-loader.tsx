import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Progress, Badge } from '@promptliano/ui'
import { CheckCircle, Circle, AlertCircle, SkipForward, Loader2 } from 'lucide-react'
import { useProgressiveLoading, type ProgressiveLoadingConfig } from './use-progressive-loading'

export interface ProgressiveLoaderProps extends ProgressiveLoadingConfig {
  /** Whether to show detailed stage information */
  showDetails?: boolean
  /** Whether to show progress percentage */
  showProgress?: boolean
  /** Whether to show stage descriptions */
  showDescriptions?: boolean
  /** Whether to allow skipping optional stages */
  allowSkipping?: boolean
  /** Custom styling */
  className?: string
}

export function ProgressiveLoader({
  showDetails = true,
  showProgress = true,
  showDescriptions = false,
  allowSkipping = false,
  className,
  ...progressiveConfig
}: ProgressiveLoaderProps) {
  const {
    isLoading,
    isComplete,
    progress,
    currentStage,
    stages,
    completedStages,
    failedStages,
    getStageStatus,
    skipStage,
    retryStage
  } = useProgressiveLoading(progressiveConfig)

  const getStageIcon = (stageId: string) => {
    const status = getStageStatus(stageId)
    const isCurrentStage = currentStage?.id === stageId
    
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-muted-foreground" />
      case 'loading':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />
      default:
        return <Circle className={cn(
          "h-4 w-4",
          isCurrentStage ? "text-primary" : "text-muted-foreground"
        )} />
    }
  }

  const getStageVariant = (stageId: string) => {
    const status = getStageStatus(stageId)
    
    switch (status) {
      case 'complete':
        return 'default' as const
      case 'error':
        return 'destructive' as const
      case 'loading':
        return 'secondary' as const
      case 'skipped':
        return 'outline' as const
      default:
        return 'outline' as const
    }
  }

  if (isComplete) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Loading complete!</span>
        </div>
        
        {showDetails && (
          <div className="space-y-2">
            {stages.map(stage => (
              <div key={stage.id} className="flex items-center gap-2">
                {getStageIcon(stage.id)}
                <span className="text-sm text-muted-foreground">
                  {stage.name}
                </span>
                <Badge variant={getStageVariant(stage.id)} className="ml-auto">
                  {getStageStatus(stage.id)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall progress */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {currentStage ? `Loading: ${currentStage.name}` : 'Initializing...'}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress * 100)}%
            </span>
          </div>
          <Progress value={progress * 100} className="h-2" />
        </div>
      )}

      {/* Current stage description */}
      {showDescriptions && currentStage?.description && (
        <p className="text-sm text-muted-foreground">
          {currentStage.description}
        </p>
      )}

      {/* Stage details */}
      {showDetails && (
        <div className="space-y-2">
          {stages.map(stage => {
            const status = getStageStatus(stage.id)
            const isCurrentStage = currentStage?.id === stage.id
            const canSkip = allowSkipping && !stage.isRequired && status === 'loading'
            const canRetry = status === 'error'

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  isCurrentStage && "bg-muted/50 border border-primary/20"
                )}
              >
                {getStageIcon(stage.id)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      isCurrentStage ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {stage.name}
                    </span>
                    
                    <Badge variant={getStageVariant(stage.id)} className="text-xs">
                      {status}
                    </Badge>
                  </div>
                  
                  {showDescriptions && stage.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stage.description}
                    </p>
                  )}
                </div>

                {/* Stage actions */}
                <div className="flex items-center gap-1">
                  {canRetry && (
                    <button
                      onClick={() => retryStage(stage.id)}
                      className="text-xs text-primary hover:text-primary/80 px-2 py-1 rounded"
                    >
                      Retry
                    </button>
                  )}
                  
                  {canSkip && (
                    <button
                      onClick={() => skipStage(stage.id)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Error summary */}
      {failedStages.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {failedStages.length} stage{failedStages.length > 1 ? 's' : ''} failed
            </span>
          </div>
          <p className="text-xs text-red-600">
            Some stages encountered errors. You can retry failed stages or continue with available data.
          </p>
        </div>
      )}
    </div>
  )
}

// Specialized progressive loaders for common scenarios
export interface DataProgressiveLoaderProps {
  isLoadingSchema?: boolean
  isLoadingData?: boolean
  isLoadingRelated?: boolean
  hasSchema?: boolean
  hasData?: boolean
  hasRelated?: boolean
  onRetrySchema?: () => void
  onRetryData?: () => void
  onRetryRelated?: () => void
  className?: string
}

export function DataProgressiveLoader({
  isLoadingSchema = false,
  isLoadingData = false,
  isLoadingRelated = false,
  hasSchema = false,
  hasData = false,
  hasRelated = false,
  onRetrySchema,
  onRetryData,
  onRetryRelated,
  className
}: DataProgressiveLoaderProps) {
  return (
    <ProgressiveLoader
      stages={[
        {
          id: 'schema',
          name: 'Loading Schema',
          description: 'Loading data structure and validation rules',
          isLoading: isLoadingSchema,
          isComplete: hasSchema,
          isRequired: true,
          weight: 1
        },
        {
          id: 'data',
          name: 'Loading Data',
          description: 'Loading primary content',
          isLoading: isLoadingData,
          isComplete: hasData,
          isRequired: true,
          weight: 3,
          dependencies: ['schema']
        },
        {
          id: 'related',
          name: 'Loading Related Data',
          description: 'Loading additional context and references',
          isLoading: isLoadingRelated,
          isComplete: hasRelated,
          isRequired: false,
          weight: 2,
          dependencies: ['data']
        }
      ]}
      onStageError={(stage, error) => {
        console.error(`Stage ${stage.name} failed:`, error)
        
        // Call appropriate retry handler
        if (stage.id === 'schema' && onRetrySchema) onRetrySchema()
        if (stage.id === 'data' && onRetryData) onRetryData()
        if (stage.id === 'related' && onRetryRelated) onRetryRelated()
      }}
      showDetails={true}
      showProgress={true}
      showDescriptions={true}
      allowSkipping={true}
      className={className}
    />
  )
}

export interface SimpleProgressiveLoaderProps {
  stages: Array<{
    name: string
    isLoading: boolean
    isComplete: boolean
  }>
  showProgress?: boolean
  className?: string
}

export function SimpleProgressiveLoader({
  stages,
  showProgress = true,
  className
}: SimpleProgressiveLoaderProps) {
  const progressiveStages = stages.map((stage, index) => ({
    id: `stage-${index}`,
    name: stage.name,
    isLoading: stage.isLoading,
    isComplete: stage.isComplete,
    isRequired: true,
    weight: 1
  }))

  return (
    <ProgressiveLoader
      stages={progressiveStages}
      showDetails={false}
      showProgress={showProgress}
      showDescriptions={false}
      allowSkipping={false}
      className={className}
    />
  )
}