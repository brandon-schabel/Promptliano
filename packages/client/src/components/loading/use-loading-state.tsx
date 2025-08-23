import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

export interface LoadingStateConfig {
  /** Minimum time to show loading state (prevents flashing) */
  minLoadingTime?: number
  /** Delay before showing loading state (prevents flashing for fast loads) */
  loadingDelay?: number
  /** Show different loading states for different types of operations */
  showMutationLoading?: boolean
  /** Show loading state for background refetches */
  showRefetchLoading?: boolean
  /** Custom query keys to monitor */
  queryKeys?: string[]
  /** Custom loading predicate */
  isLoadingPredicate?: () => boolean
}

export interface LoadingState {
  /** Primary loading state for initial data fetching */
  isLoading: boolean
  /** Background loading state for refetches */
  isRefetching: boolean
  /** Mutation loading state for create/update/delete operations */
  isMutating: boolean
  /** Any loading activity (combines all loading states) */
  isAnyLoading: boolean
  /** Loading state has been active for minimum time */
  isStableLoading: boolean
  /** Loading just started (useful for transitions) */
  isLoadingStarted: boolean
  /** Loading just finished (useful for transitions) */
  isLoadingFinished: boolean
}

export function useLoadingState({
  minLoadingTime = 300,
  loadingDelay = 100,
  showMutationLoading = true,
  showRefetchLoading = false,
  queryKeys = [],
  isLoadingPredicate
}: LoadingStateConfig = {}): LoadingState {
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null)
  const [isDelayedLoading, setIsDelayedLoading] = useState(false)
  const [isStableLoading, setIsStableLoading] = useState(false)
  const [wasLoading, setWasLoading] = useState(false)

  // Monitor TanStack Query states
  const isFetching = useIsFetching({
    queryKey: queryKeys.length > 0 ? queryKeys : undefined
  })
  
  const isMutating = useIsMutating({
    queryKey: queryKeys.length > 0 ? queryKeys : undefined
  })

  // Determine loading states
  const isQueryLoading = isFetching > 0
  const isMutationLoading = showMutationLoading && isMutating > 0
  const isCustomLoading = isLoadingPredicate ? isLoadingPredicate() : false
  
  const isActuallyLoading = isQueryLoading || isMutationLoading || isCustomLoading
  const isRefetching = showRefetchLoading && isFetching > 0

  // Handle loading delay and minimum time
  useEffect(() => {
    if (isActuallyLoading && !loadingStartTime) {
      // Loading started
      const startTime = Date.now()
      setLoadingStartTime(startTime)
      setWasLoading(true)

      // Delay showing loading state
      const delayTimer = setTimeout(() => {
        setIsDelayedLoading(true)
      }, loadingDelay)

      // Mark as stable after minimum time
      const stableTimer = setTimeout(() => {
        setIsStableLoading(true)
      }, minLoadingTime)

      return () => {
        clearTimeout(delayTimer)
        clearTimeout(stableTimer)
      }
    } else if (!isActuallyLoading && loadingStartTime) {
      // Loading finished
      const loadingDuration = Date.now() - loadingStartTime
      
      if (loadingDuration < minLoadingTime) {
        // Wait for minimum loading time
        const remainingTime = minLoadingTime - loadingDuration
        setTimeout(() => {
          setLoadingStartTime(null)
          setIsDelayedLoading(false)
          setIsStableLoading(false)
        }, remainingTime)
      } else {
        setLoadingStartTime(null)
        setIsDelayedLoading(false)
        setIsStableLoading(false)
      }
    }
  }, [isActuallyLoading, loadingStartTime, minLoadingTime, loadingDelay])

  // Track loading transitions
  const isLoadingStarted = useMemo(
    () => isActuallyLoading && !wasLoading,
    [isActuallyLoading, wasLoading]
  )

  const isLoadingFinished = useMemo(
    () => !isActuallyLoading && wasLoading,
    [isActuallyLoading, wasLoading]
  )

  // Update wasLoading state
  useEffect(() => {
    if (!isActuallyLoading && wasLoading) {
      // Small delay to allow transition detection
      const timer = setTimeout(() => setWasLoading(false), 50)
      return () => clearTimeout(timer)
    }
  }, [isActuallyLoading, wasLoading])

  return {
    isLoading: isDelayedLoading,
    isRefetching,
    isMutating: isMutationLoading,
    isAnyLoading: isDelayedLoading || isRefetching || isMutationLoading,
    isStableLoading,
    isLoadingStarted,
    isLoadingFinished
  }
}

// Specialized hook for monitoring specific entity loading
export interface EntityLoadingConfig extends LoadingStateConfig {
  entityType: string
  entityId?: string | number
}

export function useEntityLoadingState({
  entityType,
  entityId,
  ...config
}: EntityLoadingConfig) {
  const queryKeys = useMemo(() => {
    const keys = [entityType]
    if (entityId) {
      keys.push(`${entityType}:${entityId}`)
    }
    return [...keys, ...(config.queryKeys || [])]
  }, [entityType, entityId, config.queryKeys])

  return useLoadingState({
    ...config,
    queryKeys
  })
}

// Hook for managing loading states across multiple related queries
export interface MultiQueryLoadingConfig extends LoadingStateConfig {
  queries: Array<{
    queryKey: string
    required?: boolean
  }>
}

export function useMultiQueryLoadingState({
  queries,
  ...config
}: MultiQueryLoadingConfig) {
  const queryKeys = queries.map(q => q.queryKey)
  const loadingState = useLoadingState({ ...config, queryKeys })

  // Check if all required queries are loaded
  const requiredQueries = queries.filter(q => q.required !== false)
  const isFetching = useIsFetching()
  
  const areRequiredQueriesLoading = requiredQueries.some(query => {
    return useIsFetching({ queryKey: [query.queryKey] }) > 0
  })

  return {
    ...loadingState,
    isLoading: loadingState.isLoading || areRequiredQueriesLoading,
    hasRequiredData: !areRequiredQueriesLoading
  }
}

// Hook for progressive loading scenarios
export interface ProgressiveLoadingConfig extends LoadingStateConfig {
  stages: Array<{
    name: string
    queryKey: string
    required?: boolean
  }>
}

export function useProgressiveLoadingState({
  stages,
  ...config
}: ProgressiveLoadingConfig) {
  const [currentStage, setCurrentStage] = useState(0)
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set())

  // Monitor each stage
  const stageStates = stages.map(stage => ({
    ...stage,
    isLoading: useIsFetching({ queryKey: [stage.queryKey] }) > 0
  }))

  // Update completed stages
  useEffect(() => {
    stageStates.forEach(stage => {
      if (!stage.isLoading && !completedStages.has(stage.name)) {
        setCompletedStages(prev => new Set(prev).add(stage.name))
      }
    })
  }, [stageStates, completedStages])

  // Calculate current stage
  useEffect(() => {
    const newCurrentStage = stageStates.findIndex(stage => stage.isLoading)
    if (newCurrentStage !== -1) {
      setCurrentStage(newCurrentStage)
    } else if (completedStages.size === stages.length) {
      setCurrentStage(stages.length)
    }
  }, [stageStates, completedStages, stages.length])

  const overallLoading = useLoadingState({
    ...config,
    queryKeys: stages.map(s => s.queryKey)
  })

  return {
    ...overallLoading,
    currentStage,
    currentStageName: stages[currentStage]?.name || 'complete',
    completedStages: Array.from(completedStages),
    progress: completedStages.size / stages.length,
    stageStates
  }
}