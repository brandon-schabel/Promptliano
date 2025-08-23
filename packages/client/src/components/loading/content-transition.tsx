import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { useContentTransition } from './use-loading-transition'
import { LoadingTransition } from './loading-transition'

export interface ContentTransitionProps {
  /** Whether data is currently loading */
  isLoading: boolean
  /** Whether content data is available */
  hasContent?: boolean
  /** Content to show when loaded */
  children: React.ReactNode
  /** Loading content to show during transition */
  loadingContent: React.ReactNode
  /** Empty state content to show when no data */
  emptyContent?: React.ReactNode
  /** Error content to show when there's an error */
  errorContent?: React.ReactNode
  /** Whether there's an error state */
  hasError?: boolean
  /** Transition configuration */
  transitionConfig?: {
    enterDuration?: number
    exitDuration?: number
    enterDelay?: number
    exitDelay?: number
    respectReducedMotion?: boolean
  }
  /** Custom CSS classes */
  className?: string
}

export function ContentTransition({
  isLoading,
  hasContent = false,
  children,
  loadingContent,
  emptyContent,
  errorContent,
  hasError = false,
  transitionConfig = {},
  className
}: ContentTransitionProps) {
  const {
    loadingTransition,
    contentTransition,
    shouldShowLoading,
    shouldShowContent,
    isTransitioning
  } = useContentTransition({
    isLoading,
    hasContent,
    content: children,
    loadingContent,
    ...transitionConfig
  })

  // Determine what content to show
  const getCurrentContent = () => {
    if (hasError && errorContent) {
      return errorContent
    }
    
    if (shouldShowLoading) {
      return loadingContent
    }
    
    if (shouldShowContent) {
      return children
    }
    
    if (!hasContent && emptyContent) {
      return emptyContent
    }
    
    return null
  }

  const currentContent = getCurrentContent()

  if (!currentContent) {
    return null
  }

  return (
    <div
      className={cn(
        'w-full',
        isTransitioning && 'pointer-events-none',
        className
      )}
    >
      {currentContent}
    </div>
  )
}

// Enhanced content transition with state management
export interface SmartContentTransitionProps extends ContentTransitionProps {
  /** Loading states for different phases */
  loadingStates?: {
    initial?: boolean
    refresh?: boolean
    paginate?: boolean
    search?: boolean
    filter?: boolean
  }
  /** Different loading content for different states */
  loadingVariants?: {
    initial?: React.ReactNode
    refresh?: React.ReactNode
    paginate?: React.ReactNode
    search?: React.ReactNode
    filter?: React.ReactNode
  }
  /** Whether to show overlay loading for non-initial states */
  useOverlayForUpdates?: boolean
}

export function SmartContentTransition({
  isLoading,
  hasContent,
  children,
  loadingContent,
  loadingStates = {},
  loadingVariants = {},
  useOverlayForUpdates = true,
  ...props
}: SmartContentTransitionProps) {
  // Determine the current loading type
  const currentLoadingType = React.useMemo(() => {
    if (loadingStates.initial) return 'initial'
    if (loadingStates.refresh) return 'refresh'
    if (loadingStates.paginate) return 'paginate'
    if (loadingStates.search) return 'search'
    if (loadingStates.filter) return 'filter'
    return 'initial'
  }, [loadingStates])

  // Get appropriate loading content
  const getLoadingContent = () => {
    if (loadingVariants[currentLoadingType as keyof typeof loadingVariants]) {
      return loadingVariants[currentLoadingType as keyof typeof loadingVariants]
    }
    return loadingContent
  }

  // For non-initial loading states, show overlay if content exists
  if (useOverlayForUpdates && hasContent && currentLoadingType !== 'initial') {
    return (
      <div className={cn('relative', props.className)}>
        {/* Existing content */}
        <div className={cn(isLoading && 'opacity-60 pointer-events-none')}>
          {children}
        </div>
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="bg-background border rounded-lg shadow-lg p-4">
              {getLoadingContent()}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Default full-content transition
  return (
    <ContentTransition
      {...props}
      isLoading={isLoading}
      hasContent={hasContent}
      loadingContent={getLoadingContent()}
    >
      {children}
    </ContentTransition>
  )
}

// Progressive content loading with phases
export interface ProgressiveContentTransitionProps {
  /** Loading phases configuration */
  phases: Array<{
    id: string
    name: string
    isLoading: boolean
    hasContent: boolean
    content?: React.ReactNode
    loadingContent?: React.ReactNode
    required?: boolean
  }>
  /** Whether to show all phases or just the current one */
  showAllPhases?: boolean
  /** Transition configuration */
  transitionConfig?: {
    phaseDuration?: number
    staggerDelay?: number
  }
  /** Custom CSS classes */
  className?: string
}

export function ProgressiveContentTransition({
  phases,
  showAllPhases = false,
  transitionConfig = {},
  className
}: ProgressiveContentTransitionProps) {
  const { phaseDuration = 200, staggerDelay = 100 } = transitionConfig
  
  const [visiblePhases, setVisiblePhases] = React.useState<Set<string>>(new Set())

  // Update visible phases based on content availability
  React.useEffect(() => {
    const timer = setTimeout(() => {
      phases.forEach((phase, index) => {
        if (phase.hasContent && !phase.isLoading) {
          setTimeout(() => {
            setVisiblePhases(prev => new Set(prev).add(phase.id))
          }, index * staggerDelay)
        }
      })
    }, 0)

    return () => clearTimeout(timer)
  }, [phases, staggerDelay])

  if (showAllPhases) {
    return (
      <div className={cn('space-y-4', className)}>
        {phases.map((phase, index) => (
          <ContentTransition
            key={phase.id}
            isLoading={phase.isLoading}
            hasContent={phase.hasContent}
            loadingContent={phase.loadingContent || (
              <div className="h-24 bg-muted rounded animate-pulse" />
            )}
            transitionConfig={{
              enterDelay: index * staggerDelay,
              enterDuration: phaseDuration
            }}
          >
            {phase.content}
          </ContentTransition>
        ))}
      </div>
    )
  }

  // Show only the most advanced phase that has content
  const currentPhase = phases
    .filter(phase => visiblePhases.has(phase.id))
    .slice(-1)[0]

  if (!currentPhase) {
    // Show the first loading phase
    const loadingPhase = phases.find(phase => phase.isLoading)
    if (loadingPhase) {
      return (
        <div className={className}>
          {loadingPhase.loadingContent || (
            <div className="h-24 bg-muted rounded animate-pulse" />
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className={className}>
      {currentPhase.content}
    </div>
  )
}

// Transition wrapper for conditional rendering
export interface ConditionalTransitionProps {
  /** Condition for showing content */
  show: boolean
  /** Content to render when condition is true */
  children: React.ReactNode
  /** Content to render when condition is false */
  fallback?: React.ReactNode
  /** Transition type */
  type?: 'fade' | 'scale' | 'slide'
  /** Duration of transition */
  duration?: number
  /** Custom CSS classes */
  className?: string
}

export function ConditionalTransition({
  show,
  children,
  fallback,
  type = 'fade',
  duration = 200,
  className
}: ConditionalTransitionProps) {
  const [shouldRender, setShouldRender] = React.useState(show)
  const [isVisible, setIsVisible] = React.useState(show)

  React.useEffect(() => {
    if (show) {
      setShouldRender(true)
      // Small delay to ensure element is in DOM before animating
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
      // Wait for animation to complete before removing from DOM
      setTimeout(() => setShouldRender(false), duration)
    }
  }, [show, duration])

  const getTransitionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      transitionDuration: `${duration}ms`,
      transitionTimingFunction: 'ease-out'
    }

    switch (type) {
      case 'fade':
        return {
          ...baseStyles,
          opacity: isVisible ? 1 : 0,
          transitionProperty: 'opacity'
        }
      case 'scale':
        return {
          ...baseStyles,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          transitionProperty: 'opacity, transform'
        }
      case 'slide':
        return {
          ...baseStyles,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
          transitionProperty: 'opacity, transform'
        }
      default:
        return baseStyles
    }
  }

  if (!shouldRender && !show) {
    return fallback ? <>{fallback}</> : null
  }

  return (
    <div
      className={cn('w-full', className)}
      style={getTransitionStyles()}
    >
      {children}
    </div>
  )
}