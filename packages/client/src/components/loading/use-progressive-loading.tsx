import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLoadingState, type LoadingStateConfig } from './use-loading-state'

export interface ProgressiveLoadingStage {
  id: string
  name: string
  description?: string
  queryKey?: string
  isLoading?: boolean
  isComplete?: boolean
  isRequired?: boolean
  weight?: number
  dependencies?: string[]
}

export interface ProgressiveLoadingConfig extends LoadingStateConfig {
  stages: ProgressiveLoadingStage[]
  onStageComplete?: (stage: ProgressiveLoadingStage) => void
  onAllComplete?: () => void
  onStageError?: (stage: ProgressiveLoadingStage, error: Error) => void
}

export interface ProgressiveLoadingState {
  // Overall progress
  isLoading: boolean
  isComplete: boolean
  progress: number
  currentStage: ProgressiveLoadingStage | null
  currentStageIndex: number
  
  // Stage management
  stages: ProgressiveLoadingStage[]
  completedStages: string[]
  failedStages: string[]
  
  // Stage operations
  markStageComplete: (stageId: string) => void
  markStageError: (stageId: string, error?: Error) => void
  retryStage: (stageId: string) => void
  skipStage: (stageId: string) => void
  
  // Utilities
  getStageStatus: (stageId: string) => 'pending' | 'loading' | 'complete' | 'error' | 'skipped'
  canProceedToStage: (stageId: string) => boolean
  getNextStage: () => ProgressiveLoadingStage | null
}

export function useProgressiveLoading({
  stages: initialStages,
  onStageComplete,
  onAllComplete,
  onStageError,
  ...loadingConfig
}: ProgressiveLoadingConfig): ProgressiveLoadingState {
  const [stages, setStages] = useState<ProgressiveLoadingStage[]>(
    initialStages.map(stage => ({
      weight: 1,
      isRequired: true,
      ...stage
    }))
  )
  
  const [completedStages, setCompletedStages] = useState<string[]>([])
  const [failedStages, setFailedStages] = useState<string[]>([])
  const [skippedStages, setSkippedStages] = useState<string[]>([])

  // Overall loading state
  const loadingState = useLoadingState({
    ...loadingConfig,
    queryKeys: stages.map(s => s.queryKey).filter(Boolean) as string[]
  })

  // Calculate current stage
  const currentStageIndex = useMemo(() => {
    return stages.findIndex(stage => {
      const isCompleted = completedStages.includes(stage.id)
      const isFailed = failedStages.includes(stage.id)
      const isSkipped = skippedStages.includes(stage.id)
      
      return !isCompleted && !isFailed && !isSkipped
    })
  }, [stages, completedStages, failedStages, skippedStages])

  const currentStage = currentStageIndex >= 0 ? stages[currentStageIndex] : null

  // Calculate progress
  const progress = useMemo(() => {
    const totalWeight = stages.reduce((sum, stage) => sum + (stage.weight || 1), 0)
    const completedWeight = stages
      .filter(stage => 
        completedStages.includes(stage.id) || skippedStages.includes(stage.id)
      )
      .reduce((sum, stage) => sum + (stage.weight || 1), 0)
    
    return totalWeight > 0 ? completedWeight / totalWeight : 0
  }, [stages, completedStages, skippedStages])

  // Check if all stages are complete
  const isComplete = useMemo(() => {
    const requiredStages = stages.filter(stage => stage.isRequired !== false)
    return requiredStages.every(stage => 
      completedStages.includes(stage.id) || skippedStages.includes(stage.id)
    )
  }, [stages, completedStages, skippedStages])

  // Stage management functions
  const markStageComplete = useCallback((stageId: string) => {
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return

    setCompletedStages(prev => {
      if (prev.includes(stageId)) return prev
      const newCompleted = [...prev, stageId]
      
      // Remove from failed stages if it was there
      setFailedStages(failedPrev => failedPrev.filter(id => id !== stageId))
      
      // Call completion callback
      if (onStageComplete) {
        onStageComplete(stage)
      }
      
      return newCompleted
    })
  }, [stages, onStageComplete])

  const markStageError = useCallback((stageId: string, error?: Error) => {
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return

    setFailedStages(prev => {
      if (prev.includes(stageId)) return prev
      const newFailed = [...prev, stageId]
      
      // Call error callback
      if (onStageError && error) {
        onStageError(stage, error)
      }
      
      return newFailed
    })
  }, [stages, onStageError])

  const retryStage = useCallback((stageId: string) => {
    setFailedStages(prev => prev.filter(id => id !== stageId))
    setCompletedStages(prev => prev.filter(id => id !== stageId))
    setSkippedStages(prev => prev.filter(id => id !== stageId))
  }, [])

  const skipStage = useCallback((stageId: string) => {
    setSkippedStages(prev => {
      if (prev.includes(stageId)) return prev
      return [...prev, stageId]
    })
    
    // Remove from other states
    setFailedStages(prev => prev.filter(id => id !== stageId))
    setCompletedStages(prev => prev.filter(id => id !== stageId))
  }, [])

  // Utility functions
  const getStageStatus = useCallback((stageId: string): 'pending' | 'loading' | 'complete' | 'error' | 'skipped' => {
    if (completedStages.includes(stageId)) return 'complete'
    if (failedStages.includes(stageId)) return 'error'
    if (skippedStages.includes(stageId)) return 'skipped'
    if (currentStage?.id === stageId) return 'loading'
    return 'pending'
  }, [completedStages, failedStages, skippedStages, currentStage])

  const canProceedToStage = useCallback((stageId: string): boolean => {
    const stage = stages.find(s => s.id === stageId)
    if (!stage?.dependencies) return true

    // Check if all dependencies are complete
    return stage.dependencies.every(depId => 
      completedStages.includes(depId) || skippedStages.includes(depId)
    )
  }, [stages, completedStages, skippedStages])

  const getNextStage = useCallback((): ProgressiveLoadingStage | null => {
    const availableStages = stages.filter(stage => {
      const isNotProcessed = !completedStages.includes(stage.id) && 
                            !failedStages.includes(stage.id) && 
                            !skippedStages.includes(stage.id)
      return isNotProcessed && canProceedToStage(stage.id)
    })

    return availableStages[0] || null
  }, [stages, completedStages, failedStages, skippedStages, canProceedToStage])

  // Auto-advance to next available stage
  useEffect(() => {
    if (!currentStage && !isComplete) {
      const nextStage = getNextStage()
      if (nextStage) {
        // This would typically trigger the loading of the next stage
        console.debug('Next stage available:', nextStage.name)
      }
    }
  }, [currentStage, isComplete, getNextStage])

  // Call completion callback when all stages are done
  useEffect(() => {
    if (isComplete && onAllComplete) {
      onAllComplete()
    }
  }, [isComplete, onAllComplete])

  return {
    // Overall progress
    isLoading: loadingState.isLoading && !isComplete,
    isComplete,
    progress,
    currentStage,
    currentStageIndex,
    
    // Stage management
    stages,
    completedStages,
    failedStages,
    
    // Stage operations
    markStageComplete,
    markStageError,
    retryStage,
    skipStage,
    
    // Utilities
    getStageStatus,
    canProceedToStage,
    getNextStage
  }
}

// Hook for common progressive loading patterns
export interface DataLoadingStages {
  loadSchema?: boolean
  loadInitialData?: boolean
  loadRelatedData?: boolean
  loadMetadata?: boolean
  validateData?: boolean
}

export function useDataProgressiveLoading({
  loadSchema = true,
  loadInitialData = true,
  loadRelatedData = false,
  loadMetadata = false,
  validateData = false,
  ...config
}: DataLoadingStages & Omit<ProgressiveLoadingConfig, 'stages'>) {
  const stages: ProgressiveLoadingStage[] = [
    ...(loadSchema ? [{
      id: 'schema',
      name: 'Loading Schema',
      description: 'Loading data structure and validation rules',
      weight: 1,
      isRequired: true
    }] : []),
    
    ...(loadInitialData ? [{
      id: 'initial-data',
      name: 'Loading Data',
      description: 'Loading primary data content',
      weight: 3,
      isRequired: true,
      dependencies: loadSchema ? ['schema'] : undefined
    }] : []),
    
    ...(loadRelatedData ? [{
      id: 'related-data',
      name: 'Loading Related Data',
      description: 'Loading associated and referenced data',
      weight: 2,
      isRequired: false,
      dependencies: loadInitialData ? ['initial-data'] : undefined
    }] : []),
    
    ...(loadMetadata ? [{
      id: 'metadata',
      name: 'Loading Metadata',
      description: 'Loading additional information and context',
      weight: 1,
      isRequired: false,
      dependencies: loadInitialData ? ['initial-data'] : undefined
    }] : []),
    
    ...(validateData ? [{
      id: 'validation',
      name: 'Validating Data',
      description: 'Verifying data integrity and completeness',
      weight: 1,
      isRequired: true,
      dependencies: loadInitialData ? ['initial-data'] : undefined
    }] : [])
  ]

  return useProgressiveLoading({
    ...config,
    stages
  })
}