import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { SmartEmptyState, type SmartEmptyStateProps } from './smart-empty-state'
import { Database, Search, Filter, AlertCircle, Wifi, Server } from 'lucide-react'

export interface NoDataStateProps extends Omit<SmartEmptyStateProps, 'context'> {
  reason?: 'empty' | 'filtered' | 'searched' | 'error' | 'network' | 'server'
  entityType?: string
  searchTerm?: string
  filterCount?: number
  onRetry?: () => void
  onClearFilters?: () => void
  onClearSearch?: () => void
}

export function NoDataState({
  reason = 'empty',
  entityType = 'items',
  searchTerm,
  filterCount,
  onRetry,
  onClearFilters,
  onClearSearch,
  title,
  description,
  ...props
}: NoDataStateProps) {
  const getReasonContent = () => {
    switch (reason) {
      case 'filtered':
        return {
          context: 'filter' as const,
          title: title || `No ${entityType} match your filters`,
          description: description || (filterCount 
            ? `Your ${filterCount} active filter${filterCount > 1 ? 's' : ''} don't match any ${entityType}. Try adjusting or removing some filters.`
            : `No ${entityType} match the current filters. Try adjusting your criteria.`),
          primaryAction: onClearFilters ? {
            label: 'Clear Filters',
            onClick: onClearFilters,
            icon: Filter,
            variant: 'outline' as const
          } : undefined
        }

      case 'searched':
        return {
          context: 'search' as const,
          title: title || 'No search results',
          description: description || (searchTerm 
            ? `No ${entityType} found for "${searchTerm}". Try different keywords or browse all ${entityType}.`
            : `No ${entityType} found. Try different search terms or browse all ${entityType}.`),
          primaryAction: onClearSearch ? {
            label: 'Clear Search',
            onClick: onClearSearch,
            icon: Search,
            variant: 'outline' as const
          } : undefined
        }

      case 'error':
        return {
          context: 'error' as const,
          title: title || 'Failed to load data',
          description: description || `We couldn't load the ${entityType}. This might be a temporary issue.`,
          primaryAction: onRetry ? {
            label: 'Try Again',
            onClick: onRetry,
            icon: AlertCircle,
            variant: 'default' as const
          } : undefined
        }

      case 'network':
        return {
          context: 'error' as const,
          title: title || 'Connection problem',
          description: description || `Can't connect to the server. Check your internet connection and try again.`,
          primaryAction: onRetry ? {
            label: 'Retry',
            onClick: onRetry,
            icon: Wifi,
            variant: 'default' as const
          } : undefined
        }

      case 'server':
        return {
          context: 'error' as const,
          title: title || 'Server unavailable',
          description: description || `The server is temporarily unavailable. Please try again in a few moments.`,
          primaryAction: onRetry ? {
            label: 'Try Again',
            onClick: onRetry,
            icon: Server,
            variant: 'default' as const
          } : undefined
        }

      default: // 'empty'
        return {
          context: 'data' as const,
          title: title || `No ${entityType} yet`,
          description: description || `You haven't created any ${entityType} yet. Get started by creating your first one.`,
          primaryAction: undefined
        }
    }
  }

  const reasonContent = getReasonContent()

  return (
    <SmartEmptyState
      {...props}
      context={reasonContent.context}
      title={reasonContent.title}
      description={reasonContent.description}
      primaryAction={reasonContent.primaryAction}
      searchTerm={searchTerm}
      filterCount={filterCount}
    />
  )
}

// Specialized no-data components for specific scenarios
export interface NoProjectsStateProps {
  reason?: 'empty' | 'filtered' | 'searched'
  searchTerm?: string
  filterCount?: number
  onCreateProject?: () => void
  onClearFilters?: () => void
  onClearSearch?: () => void
  className?: string
}

export function NoProjectsState({
  reason = 'empty',
  searchTerm,
  filterCount,
  onCreateProject,
  onClearFilters,
  onClearSearch,
  className
}: NoProjectsStateProps) {
  return (
    <NoDataState
      reason={reason}
      entityType='projects'
      searchTerm={searchTerm}
      filterCount={filterCount}
      onClearFilters={onClearFilters}
      onClearSearch={onClearSearch}
      primaryAction={reason === 'empty' && onCreateProject ? {
        label: 'Create Project',
        onClick: onCreateProject,
        icon: Database,
        variant: 'default'
      } : undefined}
      variant='decorated'
      className={className}
    />
  )
}

export interface NoTicketsStateProps {
  reason?: 'empty' | 'filtered' | 'searched'
  searchTerm?: string
  filterCount?: number
  onCreateTicket?: () => void
  onClearFilters?: () => void
  onClearSearch?: () => void
  className?: string
}

export function NoTicketsState({
  reason = 'empty',
  searchTerm,
  filterCount,
  onCreateTicket,
  onClearFilters,
  onClearSearch,
  className
}: NoTicketsStateProps) {
  return (
    <NoDataState
      reason={reason}
      entityType='tickets'
      searchTerm={searchTerm}
      filterCount={filterCount}
      onClearFilters={onClearFilters}
      onClearSearch={onClearSearch}
      primaryAction={reason === 'empty' && onCreateTicket ? {
        label: 'Create Ticket',
        onClick: onCreateTicket,
        icon: Database,
        variant: 'default'
      } : undefined}
      variant='simple'
      className={className}
    />
  )
}

export interface NoChatsStateProps {
  reason?: 'empty' | 'filtered' | 'searched'
  searchTerm?: string
  filterCount?: number
  onStartChat?: () => void
  onClearFilters?: () => void
  onClearSearch?: () => void
  className?: string
}

export function NoChatsState({
  reason = 'empty',
  searchTerm,
  filterCount,
  onStartChat,
  onClearFilters,
  onClearSearch,
  className
}: NoChatsStateProps) {
  return (
    <NoDataState
      reason={reason}
      entityType='conversations'
      searchTerm={searchTerm}
      filterCount={filterCount}
      onClearFilters={onClearFilters}
      onClearSearch={onClearSearch}
      primaryAction={reason === 'empty' && onStartChat ? {
        label: 'Start Chat',
        onClick: onStartChat,
        icon: Database,
        variant: 'default'
      } : undefined}
      variant='simple'
      className={className}
    />
  )
}

export interface NoFilesStateProps {
  reason?: 'empty' | 'filtered' | 'searched'
  searchTerm?: string
  filterCount?: number
  onUploadFiles?: () => void
  onClearFilters?: () => void
  onClearSearch?: () => void
  className?: string
}

export function NoFilesState({
  reason = 'empty',
  searchTerm,
  filterCount,
  onUploadFiles,
  onClearFilters,
  onClearSearch,
  className
}: NoFilesStateProps) {
  return (
    <NoDataState
      reason={reason}
      entityType='files'
      searchTerm={searchTerm}
      filterCount={filterCount}
      onClearFilters={onClearFilters}
      onClearSearch={onClearSearch}
      primaryAction={reason === 'empty' && onUploadFiles ? {
        label: 'Upload Files',
        onClick: onUploadFiles,
        icon: Database,
        variant: 'default'
      } : undefined}
      variant='simple'
      className={className}
    />
  )
}