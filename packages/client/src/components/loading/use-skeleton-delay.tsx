import { useEffect, useState } from 'react'

export interface SkeletonDelayConfig {
  /** Delay in milliseconds before showing skeleton (prevents flashing for fast loads) */
  delay?: number
  /** Minimum time to show skeleton once it appears (prevents flashing) */
  minShowTime?: number
  /** Whether the actual loading state is active */
  isLoading: boolean
  /** Force immediate skeleton display (bypasses delay) */
  forceImmediate?: boolean
}

export interface SkeletonDelayState {
  /** Whether to show the skeleton UI */
  showSkeleton: boolean
  /** Whether the skeleton has been shown for the minimum time */
  isStableShow: boolean
  /** Whether we're in the initial delay period */
  isDelaying: boolean
  /** Whether the skeleton just appeared */
  justAppeared: boolean
  /** Whether the skeleton is about to disappear */
  aboutToDisappear: boolean
}

export function useSkeletonDelay({
  delay = 150,
  minShowTime = 300,
  isLoading,
  forceImmediate = false
}: SkeletonDelayConfig): SkeletonDelayState {
  const [showSkeleton, setShowSkeleton] = useState(forceImmediate && isLoading)
  const [skeletonShowTime, setSkeletonShowTime] = useState<number | null>(null)
  const [isDelaying, setIsDelaying] = useState(false)
  const [justAppeared, setJustAppeared] = useState(false)
  const [aboutToDisappear, setAboutToDisappear] = useState(false)

  useEffect(() => {
    if (isLoading && !showSkeleton) {
      // Loading started, decide whether to show skeleton
      if (forceImmediate) {
        // Show immediately
        setShowSkeleton(true)
        setSkeletonShowTime(Date.now())
        setJustAppeared(true)
        
        // Reset justAppeared after a brief moment
        const timer = setTimeout(() => setJustAppeared(false), 50)
        return () => clearTimeout(timer)
      } else {
        // Start delay timer
        setIsDelaying(true)
        
        const delayTimer = setTimeout(() => {
          // Check if still loading after delay
          if (isLoading) {
            setShowSkeleton(true)
            setSkeletonShowTime(Date.now())
            setJustAppeared(true)
            
            // Reset justAppeared after a brief moment
            setTimeout(() => setJustAppeared(false), 50)
          }
          setIsDelaying(false)
        }, delay)

        return () => {
          clearTimeout(delayTimer)
          setIsDelaying(false)
        }
      }
    } else if (!isLoading && showSkeleton && skeletonShowTime) {
      // Loading finished, check if we should hide skeleton
      const timeShown = Date.now() - skeletonShowTime
      
      if (timeShown >= minShowTime) {
        // Hide immediately
        setAboutToDisappear(true)
        
        // Brief delay to allow transition detection
        const hideTimer = setTimeout(() => {
          setShowSkeleton(false)
          setSkeletonShowTime(null)
          setAboutToDisappear(false)
        }, 50)
        
        return () => clearTimeout(hideTimer)
      } else {
        // Wait for minimum show time
        const remainingTime = minShowTime - timeShown
        setAboutToDisappear(true)
        
        const hideTimer = setTimeout(() => {
          setShowSkeleton(false)
          setSkeletonShowTime(null)
          setAboutToDisappear(false)
        }, remainingTime)

        return () => clearTimeout(hideTimer)
      }
    }
  }, [isLoading, showSkeleton, skeletonShowTime, delay, minShowTime, forceImmediate])

  // Calculate stable show state
  const isStableShow = showSkeleton && skeletonShowTime && 
    (Date.now() - skeletonShowTime) >= minShowTime

  return {
    showSkeleton,
    isStableShow: !!isStableShow,
    isDelaying,
    justAppeared,
    aboutToDisappear
  }
}

// Hook for managing skeleton delays across multiple loading states
export interface MultiSkeletonDelayConfig {
  loadingStates: Array<{
    key: string
    isLoading: boolean
    delay?: number
    minShowTime?: number
    priority?: number
  }>
  /** Global delay override */
  globalDelay?: number
  /** Global minimum show time override */
  globalMinShowTime?: number
}

export function useMultiSkeletonDelay({
  loadingStates,
  globalDelay,
  globalMinShowTime
}: MultiSkeletonDelayConfig) {
  const skeletonStates = loadingStates.map(state => {
    const delayState = useSkeletonDelay({
      delay: globalDelay ?? state.delay ?? 150,
      minShowTime: globalMinShowTime ?? state.minShowTime ?? 300,
      isLoading: state.isLoading
    })
    
    return {
      key: state.key,
      priority: state.priority ?? 0,
      ...delayState
    }
  })

  // Determine which skeleton to show based on priority
  const activeSkeleton = skeletonStates
    .filter(state => state.showSkeleton)
    .sort((a, b) => b.priority - a.priority)[0]

  // Check if any skeleton is showing
  const isAnySkeletonShowing = skeletonStates.some(state => state.showSkeleton)
  
  // Check if all skeletons are stable
  const areAllSkeletonsStable = skeletonStates
    .filter(state => state.showSkeleton)
    .every(state => state.isStableShow)

  return {
    skeletonStates,
    activeSkeleton,
    isAnySkeletonShowing,
    areAllSkeletonsStable,
    shouldShowSkeleton: (key: string) => {
      const state = skeletonStates.find(s => s.key === key)
      return state?.showSkeleton ?? false
    }
  }
}

// Hook for conditional skeleton display based on data availability
export interface ConditionalSkeletonConfig extends SkeletonDelayConfig {
  /** Whether data is available */
  hasData?: boolean
  /** Whether to show skeleton when data is partially available */
  showWhenPartial?: boolean
  /** Custom condition for showing skeleton */
  shouldShow?: boolean
}

export function useConditionalSkeleton({
  hasData = false,
  showWhenPartial = false,
  shouldShow,
  ...delayConfig
}: ConditionalSkeletonConfig) {
  // Determine if we should show skeleton based on conditions
  const shouldShowSkeleton = shouldShow ?? (
    delayConfig.isLoading && (!hasData || showWhenPartial)
  )

  const delayState = useSkeletonDelay({
    ...delayConfig,
    isLoading: shouldShowSkeleton
  })

  return {
    ...delayState,
    hasData,
    shouldShowContent: hasData && !delayState.showSkeleton,
    shouldShowPartialContent: hasData && showWhenPartial && delayState.showSkeleton
  }
}

// Hook for skeleton display with content transition
export interface SkeletonTransitionConfig extends SkeletonDelayConfig {
  /** Whether to fade between skeleton and content */
  enableTransition?: boolean
  /** Transition duration in milliseconds */
  transitionDuration?: number
}

export function useSkeletonTransition({
  enableTransition = true,
  transitionDuration = 200,
  ...delayConfig
}: SkeletonTransitionConfig) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const delayState = useSkeletonDelay(delayConfig)

  useEffect(() => {
    if (enableTransition && (delayState.justAppeared || delayState.aboutToDisappear)) {
      setIsTransitioning(true)
      
      const timer = setTimeout(() => {
        setIsTransitioning(false)
      }, transitionDuration)

      return () => clearTimeout(timer)
    }
  }, [delayState.justAppeared, delayState.aboutToDisappear, enableTransition, transitionDuration])

  return {
    ...delayState,
    isTransitioning,
    transitionDuration,
    shouldAnimate: enableTransition
  }
}