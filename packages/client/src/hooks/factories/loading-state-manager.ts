/**
 * Loading State Manager Factory
 * Creates reusable loading state patterns for complex UI interactions
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// ============================================================================
// Types
// ============================================================================

export interface LoadingStateConfig {
  defaultDelayMs?: number
  minimumLoadingMs?: number
  enableDebounce?: boolean
  debounceMs?: number
}

export interface LoadingState {
  isLoading: boolean
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  progress?: number
  message?: string
}

export interface LoadingStateManager {
  state: LoadingState
  setLoading: (loading: boolean, message?: string) => void
  setProgress: (progress: number, message?: string) => void
  setSuccess: (message?: string) => void
  setError: (error: string | Error) => void
  reset: () => void
  withLoading: <T>(asyncFn: () => Promise<T>, message?: string) => Promise<T>
}

// ============================================================================
// Main Factory
// ============================================================================

export function createLoadingStateManager(config: LoadingStateConfig = {}): LoadingStateManager {
  const {
    defaultDelayMs = 200,
    minimumLoadingMs = 500,
    enableDebounce = true,
    debounceMs = 100
  } = config

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    isError: false
  })

  const timeoutRef = useRef<NodeJS.Timeout>()
  const startTimeRef = useRef<number>()
  const debounceRef = useRef<NodeJS.Timeout>()

  const setLoadingState = useCallback((newState: Partial<LoadingState>) => {
    setState(current => ({ ...current, ...newState }))
  }, [])

  const setLoading = useCallback((loading: boolean, message?: string) => {
    if (enableDebounce) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        if (loading) {
          startTimeRef.current = Date.now()
          setLoadingState({
            isLoading: true,
            isIdle: false,
            isPending: true,
            isSuccess: false,
            isError: false,
            message
          })
        } else {
          const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0
          const remainingTime = Math.max(0, minimumLoadingMs - elapsed)

          if (remainingTime > 0) {
            timeoutRef.current = setTimeout(() => {
              setLoadingState({
                isLoading: false,
                isIdle: true,
                isPending: false,
                progress: undefined,
                message: undefined
              })
            }, remainingTime)
          } else {
            setLoadingState({
              isLoading: false,
              isIdle: true,
              isPending: false,
              progress: undefined,
              message: undefined
            })
          }
        }
      }, loading ? 0 : debounceMs)
    } else {
      if (loading) {
        startTimeRef.current = Date.now()
        setLoadingState({
          isLoading: true,
          isIdle: false,
          isPending: true,
          isSuccess: false,
          isError: false,
          message
        })
      } else {
        setLoadingState({
          isLoading: false,
          isIdle: true,
          isPending: false,
          progress: undefined,
          message: undefined
        })
      }
    }
  }, [enableDebounce, debounceMs, minimumLoadingMs, setLoadingState])

  const setProgress = useCallback((progress: number, message?: string) => {
    setLoadingState({
      progress: Math.max(0, Math.min(100, progress)),
      message
    })
  }, [setLoadingState])

  const setSuccess = useCallback((message?: string) => {
    setLoadingState({
      isLoading: false,
      isIdle: false,
      isPending: false,
      isSuccess: true,
      isError: false,
      progress: 100,
      message
    })

    // Auto-reset after success
    timeoutRef.current = setTimeout(() => {
      setLoadingState({
        isSuccess: false,
        isIdle: true,
        progress: undefined,
        message: undefined
      })
    }, 2000)
  }, [setLoadingState])

  const setError = useCallback((error: string | Error) => {
    const message = error instanceof Error ? error.message : error
    setLoadingState({
      isLoading: false,
      isIdle: false,
      isPending: false,
      isSuccess: false,
      isError: true,
      progress: undefined,
      message
    })
  }, [setLoadingState])

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    setLoadingState({
      isLoading: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
      isError: false,
      progress: undefined,
      message: undefined
    })
  }, [setLoadingState])

  const withLoading = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    message?: string
  ): Promise<T> => {
    try {
      setLoading(true, message)
      const result = await asyncFn()
      setSuccess()
      return result
    } catch (error) {
      setError(error as Error)
      throw error
    }
  }, [setLoading, setSuccess, setError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    state,
    setLoading,
    setProgress,
    setSuccess,
    setError,
    reset,
    withLoading
  }
}

// ============================================================================
// Specialized Loading State Hooks
// ============================================================================

/**
 * File upload loading state with progress tracking
 */
export function createFileUploadLoader() {
  const manager = createLoadingStateManager({
    minimumLoadingMs: 1000,
    enableDebounce: false
  })

  const uploadFile = useCallback(async (
    file: File,
    uploadFn: (file: File, onProgress: (progress: number) => void) => Promise<any>
  ) => {
    manager.setLoading(true, `Uploading ${file.name}...`)
    
    try {
      const result = await uploadFn(file, (progress) => {
        manager.setProgress(progress, `Uploading ${file.name}... ${Math.round(progress)}%`)
      })
      
      manager.setSuccess(`${file.name} uploaded successfully`)
      return result
    } catch (error) {
      manager.setError(`Failed to upload ${file.name}`)
      throw error
    }
  }, [manager])

  return {
    ...manager,
    uploadFile
  }
}

/**
 * Multi-step operation loading state
 */
export function createMultiStepLoader(steps: string[]) {
  const manager = createLoadingStateManager({
    minimumLoadingMs: 300,
    enableDebounce: false
  })

  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = useCallback(() => {
    const step = currentStep + 1
    setCurrentStep(step)
    
    if (step < steps.length) {
      const progress = (step / steps.length) * 100
      manager.setProgress(progress, steps[step])
    } else {
      manager.setSuccess('All steps completed')
    }
  }, [currentStep, steps, manager])

  const resetSteps = useCallback(() => {
    setCurrentStep(0)
    manager.reset()
  }, [manager])

  const executeSteps = useCallback(async (
    stepFunctions: Array<() => Promise<any>>
  ) => {
    if (stepFunctions.length !== steps.length) {
      throw new Error('Step functions must match step names')
    }

    resetSteps()
    manager.setLoading(true, steps[0])

    try {
      for (let i = 0; i < stepFunctions.length; i++) {
        setCurrentStep(i)
        const progress = (i / stepFunctions.length) * 100
        manager.setProgress(progress, steps[i])
        
        await stepFunctions[i]()
      }
      
      manager.setSuccess('All steps completed successfully')
    } catch (error) {
      manager.setError(`Failed at step: ${steps[currentStep]}`)
      throw error
    }
  }, [steps, currentStep, manager, resetSteps])

  return {
    ...manager,
    currentStep,
    totalSteps: steps.length,
    stepName: steps[currentStep],
    nextStep,
    resetSteps,
    executeSteps
  }
}

/**
 * Query-aware loading state that integrates with React Query
 */
export function createQueryAwareLoader(queryKeys: readonly unknown[][]) {
  const queryClient = useQueryClient()
  const manager = createLoadingStateManager()

  const checkQueryStates = useCallback(() => {
    const queries = queryKeys.map(key => queryClient.getQueryState(key))
    const isAnyLoading = queries.some(query => query?.status === 'pending')
    const hasErrors = queries.some(query => query?.status === 'error')
    const allSuccess = queries.every(query => query?.status === 'success')

    if (isAnyLoading) {
      manager.setLoading(true, 'Loading data...')
    } else if (hasErrors) {
      manager.setError('Some queries failed')
    } else if (allSuccess) {
      manager.setSuccess('All data loaded')
    } else {
      manager.reset()
    }
  }, [queryKeys, queryClient, manager])

  // Check query states when they change
  useEffect(() => {
    checkQueryStates()
    
    // Subscribe to query changes
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      checkQueryStates()
    })

    return unsubscribe
  }, [checkQueryStates, queryClient])

  return {
    ...manager,
    checkQueryStates,
    invalidateQueries: () => {
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    }
  }
}

/**
 * Batch operation loading state
 */
export function createBatchLoader<T>() {
  const manager = createLoadingStateManager({
    minimumLoadingMs: 800
  })

  const [completed, setCompleted] = useState(0)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<T[]>([])
  const [errors, setErrors] = useState<Error[]>([])

  const executeBatch = useCallback(async (
    items: any[],
    batchFn: (item: any, index: number) => Promise<T>,
    batchSize: number = 5
  ) => {
    setTotal(items.length)
    setCompleted(0)
    setResults([])
    setErrors([])
    
    manager.setLoading(true, `Processing ${items.length} items...`)

    const newResults: T[] = []
    const newErrors: Error[] = []

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const promises = batch.map((item, index) => batchFn(item, i + index))
        
        const batchResults = await Promise.allSettled(promises)
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            newResults.push(result.value)
          } else {
            newErrors.push(new Error(`Item ${i + index}: ${result.reason}`))
          }
        })

        const newCompleted = Math.min(i + batchSize, items.length)
        setCompleted(newCompleted)
        setResults([...newResults])
        setErrors([...newErrors])
        
        const progress = (newCompleted / items.length) * 100
        manager.setProgress(progress, `Processed ${newCompleted}/${items.length} items`)
      }

      if (newErrors.length === 0) {
        manager.setSuccess(`Successfully processed all ${items.length} items`)
      } else {
        manager.setError(`Completed with ${newErrors.length} errors`)
      }

      return { results: newResults, errors: newErrors }
    } catch (error) {
      manager.setError('Batch operation failed')
      throw error
    }
  }, [manager])

  const reset = useCallback(() => {
    setCompleted(0)
    setTotal(0)
    setResults([])
    setErrors([])
    manager.reset()
  }, [manager])

  return {
    ...manager,
    completed,
    total,
    results,
    errors,
    progress: total > 0 ? (completed / total) * 100 : 0,
    executeBatch,
    reset
  }
}