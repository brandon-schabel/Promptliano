import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { useLoadingState } from './use-loading-state'
import { useSkeletonDelay } from './use-skeleton-delay'
import { useLoadingTransition } from './use-loading-transition'
import { TableSkeleton } from './table-skeleton'
import { CardSkeleton } from './card-skeleton'
import { ListSkeleton } from './list-skeleton'
import { TextSkeleton } from './text-skeleton'
import { FormSkeleton } from './form-skeleton'
import { DetailSkeleton } from './detail-skeleton'
import { SmartEmptyState } from './smart-empty-state'
import { NoDataState } from './no-data-state'
import { LoadingFailedState } from './loading-failed-state'

export type ContentType = 'table' | 'card' | 'list' | 'text' | 'form' | 'detail' | 'custom'
export type LoadingReason = 'initial' | 'refresh' | 'paginate' | 'search' | 'filter' | 'error'

export interface LoadingOrchestratorProps {
  /** Whether data is currently loading */
  isLoading: boolean
  /** Whether data is available */
  hasData?: boolean
  /** Whether there was an error */
  hasError?: boolean
  /** Error object if available */
  error?: Error | string
  /** Type of content being loaded */
  contentType: ContentType
  /** Reason for loading state */
  loadingReason?: LoadingReason
  /** Data being displayed */
  data?: any
  /** Total number of items (for empty states) */
  totalItems?: number
  /** Search term (for empty states) */
  searchTerm?: string
  /** Number of active filters (for empty states) */
  filterCount?: number
  /** Content to render when data is available */
  children: React.ReactNode
  /** Custom skeleton component */
  customSkeleton?: React.ReactNode
  /** Custom empty state component */
  customEmptyState?: React.ReactNode
  /** Custom error state component */
  customErrorState?: React.ReactNode
  /** Loading state configuration */
  loadingConfig?: {
    minLoadingTime?: number
    loadingDelay?: number
    skeletonDelay?: number
    skeletonMinTime?: number
    enableTransitions?: boolean
  }
  /** Skeleton configuration based on content type */
  skeletonConfig?: {
    rows?: number
    columns?: number
    variant?: string
    dense?: boolean
  }
  /** Callbacks for user actions */
  onRetry?: () => void
  onClearSearch?: () => void
  onClearFilters?: () => void
  onCreateItem?: () => void
  /** Custom styling */
  className?: string
}

export function LoadingOrchestrator({
  isLoading,
  hasData = false,
  hasError = false,
  error,
  contentType,
  loadingReason = 'initial',
  data,
  totalItems = 0,
  searchTerm,
  filterCount = 0,
  children,
  customSkeleton,
  customEmptyState,
  customErrorState,
  loadingConfig = {},
  skeletonConfig = {},
  onRetry,
  onClearSearch,
  onClearFilters,
  onCreateItem,
  className
}: LoadingOrchestratorProps) {
  const {
    minLoadingTime = 300,
    loadingDelay = 150,
    skeletonDelay = 100,
    skeletonMinTime = 300,
    enableTransitions = true
  } = loadingConfig

  // Use loading state management
  const loadingState = useLoadingState({
    minLoadingTime,
    loadingDelay,
    isLoadingPredicate: () => isLoading
  })

  // Use skeleton delay management
  const skeletonState = useSkeletonDelay({
    delay: skeletonDelay,
    minShowTime: skeletonMinTime,
    isLoading: loadingState.isLoading
  })

  // Use transition management
  const transitionState = useLoadingTransition({
    isLoading: skeletonState.showSkeleton,
    enterDuration: 150,
    exitDuration: 200,
    respectReducedMotion: true
  })

  // Determine what to render
  const shouldShowSkeleton = skeletonState.showSkeleton
  const shouldShowError = hasError && !shouldShowSkeleton
  const shouldShowEmpty = !hasData && !shouldShowSkeleton && !hasError && totalItems === 0
  const shouldShowNoResults = !hasData && !shouldShowSkeleton && !hasError && 
    (searchTerm || filterCount > 0) && totalItems === 0
  const shouldShowContent = hasData && !shouldShowSkeleton

  // Get appropriate skeleton component
  const renderSkeleton = () => {
    if (customSkeleton) return customSkeleton

    const { rows = 5, columns = 4, variant, dense = false } = skeletonConfig

    switch (contentType) {
      case 'table':
        return (
          <TableSkeleton
            rows={rows}
            columns={columns}
            dense={dense}
            showHeader={true}
            showPagination={true}
            showActions={true}
          />
        )

      case 'card':
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: Math.min(rows, 6) }).map((_, i) => (
              <CardSkeleton
                key={i}
                variant={variant as any || 'default'}
                showHeader={true}
                showActions={true}
              />
            ))}
          </div>
        )

      case 'list':
        return (
          <ListSkeleton
            itemCount={rows}
            variant={variant as any || 'default'}
            showDividers={true}
            showActions={true}
          />
        )

      case 'text':
        return (
          <TextSkeleton
            lines={rows}
            variant={variant as any || 'paragraph'}
            spacing="normal"
          />
        )

      case 'form':
        return (
          <FormSkeleton
            fields={rows}
            variant={variant as any || 'simple'}
            columns={Math.min(columns, 3) as 1 | 2 | 3}
            showActions={true}
          />
        )

      case 'detail':
        return (
          <DetailSkeleton
            variant={variant as any || 'project'}
            showSidebar={true}
            showTabs={true}
            showMetrics={true}
          />
        )

      default:
        return (
          <div className="space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )
    }
  }

  // Get appropriate empty state
  const renderEmptyState = () => {
    if (customEmptyState) return customEmptyState

    if (shouldShowNoResults) {
      if (searchTerm) {
        return (
          <NoDataState
            reason="searched"
            entityType={getEntityTypeName(contentType)}
            searchTerm={searchTerm}
            onClearSearch={onClearSearch}
            variant="minimal"
          />
        )
      }

      if (filterCount > 0) {
        return (
          <NoDataState
            reason="filtered"
            entityType={getEntityTypeName(contentType)}
            filterCount={filterCount}
            onClearFilters={onClearFilters}
            variant="minimal"
          />
        )
      }
    }

    return (
      <SmartEmptyState
        context={getSmartEmptyContext(contentType)}
        primaryAction={onCreateItem ? {
          label: `Create ${getEntityTypeName(contentType, true)}`,
          onClick: onCreateItem,
          variant: 'default'
        } : undefined}
        variant="card"
      />
    )
  }

  // Get appropriate error state
  const renderErrorState = () => {
    if (customErrorState) return customErrorState

    const errorMessage = error instanceof Error ? error.message : error

    return (
      <LoadingFailedState
        failureType="unknown"
        entityType={getEntityTypeName(contentType)}
        errorMessage={errorMessage}
        onRetry={onRetry}
        showErrorDetails={true}
      />
    )
  }

  // Main render logic
  const renderContent = () => {
    if (shouldShowError) {
      return renderErrorState()
    }

    if (shouldShowEmpty || shouldShowNoResults) {
      return renderEmptyState()
    }

    if (shouldShowSkeleton) {
      return (
        <div
          className={cn(
            enableTransitions && transitionState.transitionClasses,
            "w-full"
          )}
          style={enableTransitions ? transitionState.transitionStyles : undefined}
        >
          {renderSkeleton()}
        </div>
      )
    }

    if (shouldShowContent) {
      return (
        <div
          className={cn(
            enableTransitions && transitionState.transitionClasses,
            "w-full"
          )}
          style={enableTransitions ? transitionState.transitionStyles : undefined}
        >
          {children}
        </div>
      )
    }

    return null
  }

  return (
    <div className={cn('w-full', className)}>
      {renderContent()}
    </div>
  )
}

// Helper functions
function getEntityTypeName(contentType: ContentType, singular = false): string {
  const pluralMap: Record<ContentType, string> = {
    table: 'items',
    card: 'items',
    list: 'items',
    text: 'content',
    form: 'data',
    detail: 'details',
    custom: 'items'
  }

  const singularMap: Record<ContentType, string> = {
    table: 'item',
    card: 'item',
    list: 'item',
    text: 'content',
    form: 'entry',
    detail: 'item',
    custom: 'item'
  }

  return singular ? singularMap[contentType] : pluralMap[contentType]
}

function getSmartEmptyContext(contentType: ContentType): string {
  const contextMap: Record<ContentType, string> = {
    table: 'data',
    card: 'data',
    list: 'data',
    text: 'data',
    form: 'data',
    detail: 'data',
    custom: 'data'
  }

  return contextMap[contentType]
}

// Convenience wrapper for common table scenarios
export interface TableOrchestratorProps extends Omit<LoadingOrchestratorProps, 'contentType'> {
  rows?: number
  columns?: number
  dense?: boolean
}

export function TableOrchestrator(props: TableOrchestratorProps) {
  return (
    <LoadingOrchestrator
      {...props}
      contentType="table"
      skeletonConfig={{
        rows: props.rows,
        columns: props.columns,
        dense: props.dense
      }}
    />
  )
}

// Convenience wrapper for common card grid scenarios
export interface CardGridOrchestratorProps extends Omit<LoadingOrchestratorProps, 'contentType'> {
  cardCount?: number
  cardVariant?: string
}

export function CardGridOrchestrator(props: CardGridOrchestratorProps) {
  return (
    <LoadingOrchestrator
      {...props}
      contentType="card"
      skeletonConfig={{
        rows: props.cardCount,
        variant: props.cardVariant
      }}
    />
  )
}