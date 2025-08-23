import { useCallback, useEffect, useRef, useState } from 'react'

export type TransitionState = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited'

export interface LoadingTransitionConfig {
  /** Duration of enter transition in milliseconds */
  enterDuration?: number
  /** Duration of exit transition in milliseconds */
  exitDuration?: number
  /** Whether the loading state is active */
  isLoading: boolean
  /** Delay before starting enter transition */
  enterDelay?: number
  /** Delay before starting exit transition */
  exitDelay?: number
  /** Whether to enable reduced motion */
  respectReducedMotion?: boolean
  /** Custom transition timing function */
  timingFunction?: string
}

export interface LoadingTransitionState {
  /** Current transition state */
  transitionState: TransitionState
  /** Whether the loading UI should be rendered */
  shouldRender: boolean
  /** Whether the loading UI should be visible */
  shouldShow: boolean
  /** CSS classes for the current transition state */
  transitionClasses: string
  /** Inline styles for the current transition */
  transitionStyles: React.CSSProperties
  /** Whether animation is currently running */
  isAnimating: boolean
  /** Progress of current transition (0-1) */
  progress: number
}

export function useLoadingTransition({
  enterDuration = 150,
  exitDuration = 200,
  isLoading,
  enterDelay = 0,
  exitDelay = 0,
  respectReducedMotion = true,
  timingFunction = 'ease-out'
}: LoadingTransitionConfig): LoadingTransitionState {
  const [transitionState, setTransitionState] = useState<TransitionState>('idle')
  const [shouldRender, setShouldRender] = useState(isLoading)
  const [progress, setProgress] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const progressIntervalRef = useRef<NodeJS.Timeout>()
  const startTimeRef = useRef<number>()

  // Check for reduced motion preference
  const prefersReducedMotion = respectReducedMotion && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // Start progress tracking
  const startProgressTracking = useCallback((duration: number) => {
    if (prefersReducedMotion) {
      setProgress(1)
      return
    }

    startTimeRef.current = Date.now()
    setProgress(0)

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current || 0)
      const newProgress = Math.min(elapsed / duration, 1)
      setProgress(newProgress)

      if (newProgress >= 1) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      }
    }, 16) // ~60fps
  }, [prefersReducedMotion])

  // Stop progress tracking
  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    setProgress(0)
  }, [])

  // Handle loading state changes
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (isLoading) {
      // Start loading
      if (transitionState === 'idle' || transitionState === 'exited') {
        setShouldRender(true)
        
        if (enterDelay > 0 && !prefersReducedMotion) {
          timeoutRef.current = setTimeout(() => {
            setTransitionState('entering')
            startProgressTracking(enterDuration)
          }, enterDelay)
        } else {
          setTransitionState('entering')
          startProgressTracking(enterDuration)
        }
      }
    } else {
      // Stop loading
      if (transitionState === 'entered' || transitionState === 'entering') {
        stopProgressTracking()
        
        if (exitDelay > 0 && !prefersReducedMotion) {
          timeoutRef.current = setTimeout(() => {
            setTransitionState('exiting')
            startProgressTracking(exitDuration)
          }, exitDelay)
        } else {
          setTransitionState('exiting')
          startProgressTracking(exitDuration)
        }
      }
    }
  }, [isLoading, transitionState, enterDelay, exitDelay, enterDuration, exitDuration, prefersReducedMotion, startProgressTracking, stopProgressTracking])

  // Handle transition state progression
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const duration = transitionState === 'entering' ? enterDuration : exitDuration

    if (transitionState === 'entering') {
      timeoutRef.current = setTimeout(() => {
        setTransitionState('entered')
        stopProgressTracking()
      }, prefersReducedMotion ? 0 : duration)
    } else if (transitionState === 'exiting') {
      timeoutRef.current = setTimeout(() => {
        setTransitionState('exited')
        setShouldRender(false)
        stopProgressTracking()
      }, prefersReducedMotion ? 0 : duration)
    }
  }, [transitionState, enterDuration, exitDuration, prefersReducedMotion, stopProgressTracking])

  // Generate CSS classes based on transition state
  const transitionClasses = (() => {
    const baseClasses = 'transition-all'
    
    switch (transitionState) {
      case 'entering':
        return `${baseClasses} opacity-0 scale-95 animate-in fade-in zoom-in`
      case 'entered':
        return `${baseClasses} opacity-100 scale-100`
      case 'exiting':
        return `${baseClasses} opacity-100 scale-100 animate-out fade-out zoom-out`
      case 'exited':
        return `${baseClasses} opacity-0 scale-95`
      default:
        return baseClasses
    }
  })()

  // Generate inline styles
  const transitionStyles: React.CSSProperties = prefersReducedMotion ? {} : {
    transitionDuration: `${transitionState === 'entering' ? enterDuration : exitDuration}ms`,
    transitionTimingFunction: timingFunction,
    ...(transitionState === 'entering' && {
      opacity: progress,
      transform: `scale(${0.95 + (progress * 0.05)})`
    }),
    ...(transitionState === 'exiting' && {
      opacity: 1 - progress,
      transform: `scale(${1 - (progress * 0.05)})`
    })
  }

  const shouldShow = transitionState === 'entering' || transitionState === 'entered'
  const isAnimating = transitionState === 'entering' || transitionState === 'exiting'

  return {
    transitionState,
    shouldRender,
    shouldShow,
    transitionClasses,
    transitionStyles,
    isAnimating,
    progress
  }
}

// Hook for staggered transitions of multiple elements
export interface StaggeredTransitionConfig extends LoadingTransitionConfig {
  /** Number of items to stagger */
  itemCount: number
  /** Delay between each item in milliseconds */
  staggerDelay?: number
}

export function useStaggeredLoadingTransition({
  itemCount,
  staggerDelay = 50,
  ...transitionConfig
}: StaggeredTransitionConfig) {
  const mainTransition = useLoadingTransition(transitionConfig)
  
  const getItemDelay = useCallback((index: number) => {
    if (!mainTransition.shouldShow) return 0
    return index * staggerDelay
  }, [mainTransition.shouldShow, staggerDelay])

  const getItemTransitionState = useCallback((index: number) => {
    const delay = getItemDelay(index)
    const adjustedProgress = Math.max(0, (mainTransition.progress * 100) - delay) / (100 - delay)
    
    return {
      ...mainTransition,
      progress: isNaN(adjustedProgress) ? 0 : Math.min(1, adjustedProgress),
      transitionStyles: {
        ...mainTransition.transitionStyles,
        transitionDelay: `${delay}ms`
      }
    }
  }, [mainTransition, getItemDelay])

  return {
    mainTransition,
    getItemDelay,
    getItemTransitionState,
    itemCount
  }
}

// Hook for content transition with loading states
export interface ContentTransitionConfig extends LoadingTransitionConfig {
  /** Whether content data is available */
  hasContent?: boolean
  /** Content to show when loaded */
  content?: React.ReactNode
  /** Loading content to show during transition */
  loadingContent?: React.ReactNode
}

export function useContentTransition({
  hasContent = false,
  content,
  loadingContent,
  ...transitionConfig
}: ContentTransitionConfig) {
  const loadingTransition = useLoadingTransition(transitionConfig)
  const contentTransition = useLoadingTransition({
    ...transitionConfig,
    isLoading: !transitionConfig.isLoading && hasContent
  })

  const shouldShowLoading = loadingTransition.shouldShow
  const shouldShowContent = contentTransition.shouldShow && hasContent

  const currentContent = (() => {
    if (shouldShowLoading) return loadingContent
    if (shouldShowContent) return content
    return null
  })()

  return {
    loadingTransition,
    contentTransition,
    shouldShowLoading,
    shouldShowContent,
    currentContent,
    isTransitioning: loadingTransition.isAnimating || contentTransition.isAnimating
  }
}