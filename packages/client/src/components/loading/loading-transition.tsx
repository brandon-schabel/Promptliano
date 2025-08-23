import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { useLoadingTransition, useStaggeredLoadingTransition } from './use-loading-transition'

export interface LoadingTransitionProps {
  /** Whether the loading state is active */
  isLoading: boolean
  /** Content to show when loading */
  loadingContent: React.ReactNode
  /** Content to show when loaded */
  children: React.ReactNode
  /** Duration of enter transition in milliseconds */
  enterDuration?: number
  /** Duration of exit transition in milliseconds */
  exitDuration?: number
  /** Delay before starting transitions */
  enterDelay?: number
  exitDelay?: number
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean
  /** Custom transition timing function */
  timingFunction?: string
  /** Custom CSS classes */
  className?: string
}

export function LoadingTransition({
  isLoading,
  loadingContent,
  children,
  enterDuration = 150,
  exitDuration = 200,
  enterDelay = 0,
  exitDelay = 0,
  respectReducedMotion = true,
  timingFunction = 'ease-out',
  className
}: LoadingTransitionProps) {
  const {
    transitionState,
    shouldRender,
    shouldShow,
    transitionClasses,
    transitionStyles,
    isAnimating
  } = useLoadingTransition({
    isLoading,
    enterDuration,
    exitDuration,
    enterDelay,
    exitDelay,
    respectReducedMotion,
    timingFunction
  })

  if (!shouldRender) {
    return <>{children}</>
  }

  const currentContent = shouldShow ? loadingContent : children

  return (
    <div
      className={cn(
        'w-full',
        transitionClasses,
        isAnimating && 'pointer-events-none',
        className
      )}
      style={transitionStyles}
    >
      {currentContent}
    </div>
  )
}

// Component for staggered transitions of multiple elements
export interface StaggeredTransitionProps {
  /** Whether the loading state is active */
  isLoading: boolean
  /** Array of items to render with staggered animation */
  items: React.ReactNode[]
  /** Delay between each item in milliseconds */
  staggerDelay?: number
  /** Duration of each item's transition */
  enterDuration?: number
  exitDuration?: number
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean
  /** Render function for each item */
  renderItem?: (item: React.ReactNode, index: number, transitionProps: any) => React.ReactNode
  /** Custom CSS classes */
  className?: string
}

export function StaggeredTransition({
  isLoading,
  items,
  staggerDelay = 50,
  enterDuration = 150,
  exitDuration = 200,
  respectReducedMotion = true,
  renderItem,
  className
}: StaggeredTransitionProps) {
  const {
    mainTransition,
    getItemTransitionState
  } = useStaggeredLoadingTransition({
    isLoading,
    itemCount: items.length,
    staggerDelay,
    enterDuration,
    exitDuration,
    respectReducedMotion
  })

  if (!mainTransition.shouldRender) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => {
        const itemTransition = getItemTransitionState(index)
        
        if (renderItem) {
          return renderItem(item, index, itemTransition)
        }

        return (
          <div
            key={index}
            className={cn(
              'w-full',
              itemTransition.transitionClasses,
              itemTransition.isAnimating && 'pointer-events-none'
            )}
            style={itemTransition.transitionStyles}
          >
            {item}
          </div>
        )
      })}
    </div>
  )
}

// Component for cross-fade transitions between different states
export interface CrossFadeTransitionProps {
  /** Current state identifier */
  currentState: string
  /** Map of state to content */
  states: Record<string, React.ReactNode>
  /** Duration of cross-fade transition */
  duration?: number
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean
  /** Custom CSS classes */
  className?: string
}

export function CrossFadeTransition({
  currentState,
  states,
  duration = 200,
  respectReducedMotion = true,
  className
}: CrossFadeTransitionProps) {
  const [displayState, setDisplayState] = React.useState(currentState)
  const [isTransitioning, setIsTransitioning] = React.useState(false)

  React.useEffect(() => {
    if (currentState !== displayState) {
      setIsTransitioning(true)
      
      const timer = setTimeout(() => {
        setDisplayState(currentState)
        setIsTransitioning(false)
      }, respectReducedMotion ? 0 : duration / 2)

      return () => clearTimeout(timer)
    }
  }, [currentState, displayState, duration, respectReducedMotion])

  const currentContent = states[displayState] || states[currentState]

  return (
    <div
      className={cn(
        'w-full transition-opacity',
        isTransitioning && !respectReducedMotion && 'opacity-50',
        className
      )}
      style={{
        transitionDuration: respectReducedMotion ? '0ms' : `${duration}ms`
      }}
    >
      {currentContent}
    </div>
  )
}

// Component for slide transitions between states
export interface SlideTransitionProps {
  /** Current content */
  children: React.ReactNode
  /** Direction of slide animation */
  direction?: 'left' | 'right' | 'up' | 'down'
  /** Duration of slide transition */
  duration?: number
  /** Whether the transition is active */
  isTransitioning?: boolean
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean
  /** Custom CSS classes */
  className?: string
}

export function SlideTransition({
  children,
  direction = 'left',
  duration = 200,
  isTransitioning = false,
  respectReducedMotion = true,
  className
}: SlideTransitionProps) {
  const getTransformValue = () => {
    if (respectReducedMotion || !isTransitioning) return 'translateX(0)'
    
    switch (direction) {
      case 'left': return 'translateX(-100%)'
      case 'right': return 'translateX(100%)'
      case 'up': return 'translateY(-100%)'
      case 'down': return 'translateY(100%)'
      default: return 'translateX(0)'
    }
  }

  return (
    <div
      className={cn(
        'w-full transition-transform overflow-hidden',
        className
      )}
      style={{
        transform: getTransformValue(),
        transitionDuration: respectReducedMotion ? '0ms' : `${duration}ms`,
        transitionTimingFunction: 'ease-out'
      }}
    >
      {children}
    </div>
  )
}

// Component for scale transitions
export interface ScaleTransitionProps {
  /** Whether the content should be scaled down */
  isScaled?: boolean
  /** Scale factor when scaled down */
  scaleFactor?: number
  /** Duration of scale transition */
  duration?: number
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean
  /** Content to render */
  children: React.ReactNode
  /** Custom CSS classes */
  className?: string
}

export function ScaleTransition({
  isScaled = false,
  scaleFactor = 0.95,
  duration = 150,
  respectReducedMotion = true,
  children,
  className
}: ScaleTransitionProps) {
  return (
    <div
      className={cn(
        'w-full transition-transform origin-center',
        className
      )}
      style={{
        transform: isScaled && !respectReducedMotion ? `scale(${scaleFactor})` : 'scale(1)',
        transitionDuration: respectReducedMotion ? '0ms' : `${duration}ms`,
        transitionTimingFunction: 'ease-out'
      }}
    >
      {children}
    </div>
  )
}