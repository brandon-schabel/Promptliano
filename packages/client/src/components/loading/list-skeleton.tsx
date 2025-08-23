import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Skeleton } from '@promptliano/ui'

export interface ListSkeletonProps {
  itemCount?: number
  variant?: 'default' | 'compact' | 'detailed' | 'media' | 'conversation'
  showDividers?: boolean
  showActions?: boolean
  showMetadata?: boolean
  className?: string
}

export function ListSkeleton({
  itemCount = 5,
  variant = 'default',
  showDividers = true,
  showActions = true,
  showMetadata = true,
  className
}: ListSkeletonProps) {
  const renderListItem = (index: number) => {
    if (variant === 'compact') {
      return (
        <div key={index} className='flex items-center gap-3 p-2'>
          <Skeleton className='h-6 w-6 rounded' />
          <div className='flex-1 space-y-1'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
          {showActions && <Skeleton className='h-6 w-6 rounded' />}
        </div>
      )
    }

    if (variant === 'detailed') {
      return (
        <div key={index} className='p-4 space-y-3'>
          <div className='flex items-start gap-4'>
            <Skeleton className='h-12 w-12 rounded-lg' />
            <div className='flex-1 space-y-2'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-5 w-1/3' />
                <Skeleton className='h-4 w-16 rounded-full' />
              </div>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-2/3' />
            </div>
            {showActions && (
              <div className='flex items-center gap-1'>
                <Skeleton className='h-8 w-8 rounded' />
                <Skeleton className='h-8 w-8 rounded' />
              </div>
            )}
          </div>
          {showMetadata && (
            <div className='flex items-center gap-4 text-sm'>
              <Skeleton className='h-4 w-20' />
              <Skeleton className='h-4 w-16' />
              <Skeleton className='h-4 w-24' />
            </div>
          )}
        </div>
      )
    }

    if (variant === 'media') {
      return (
        <div key={index} className='flex gap-4 p-4'>
          <Skeleton className='h-20 w-20 rounded-lg flex-shrink-0' />
          <div className='flex-1 space-y-2'>
            <div className='flex items-start justify-between'>
              <div className='space-y-1 flex-1'>
                <Skeleton className='h-5 w-2/3' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-1/2' />
              </div>
              {showActions && <Skeleton className='h-8 w-8 rounded' />}
            </div>
            {showMetadata && (
              <div className='flex items-center gap-3'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-4 w-20' />
              </div>
            )}
          </div>
        </div>
      )
    }

    if (variant === 'conversation') {
      const isEven = index % 2 === 0
      return (
        <div key={index} className={cn('flex gap-3 p-4', isEven ? 'flex-row' : 'flex-row-reverse')}>
          <Skeleton className='h-8 w-8 rounded-full flex-shrink-0' />
          <div className={cn('flex-1 space-y-2 max-w-[70%]', isEven ? 'items-start' : 'items-end')}>
            <div className={cn('space-y-1', isEven ? 'text-left' : 'text-right')}>
              <Skeleton className={cn('h-4', isEven ? 'w-20' : 'w-16 ml-auto')} />
              <div className={cn('p-3 rounded-lg bg-muted space-y-1', isEven ? 'rounded-tl-none' : 'rounded-tr-none')}>
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-3/4' />
                {Math.random() > 0.5 && <Skeleton className='h-4 w-1/2' />}
              </div>
            </div>
            <Skeleton className={cn('h-3 w-12', isEven ? '' : 'ml-auto')} />
          </div>
        </div>
      )
    }

    // Default variant
    return (
      <div key={index} className='flex items-center gap-3 p-3'>
        <Skeleton className='h-10 w-10 rounded-full' />
        <div className='flex-1 space-y-2'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-3 w-16 rounded-full' />
          </div>
          <Skeleton className='h-4 w-full' />
          {showMetadata && <Skeleton className='h-3 w-1/2' />}
        </div>
        {showActions && (
          <div className='flex items-center gap-1'>
            <Skeleton className='h-8 w-8 rounded' />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <React.Fragment key={index}>
          {renderListItem(index)}
          {showDividers && index < itemCount - 1 && variant !== 'conversation' && (
            <div className='border-t mx-3' />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// Specialized list skeletons for specific content types
export interface FileListSkeletonProps {
  itemCount?: number
  className?: string
}

export function FileListSkeleton({ itemCount = 8, className }: FileListSkeletonProps) {
  return (
    <ListSkeleton
      itemCount={itemCount}
      variant='compact'
      showDividers={false}
      showActions={true}
      showMetadata={false}
      className={className}
    />
  )
}

export interface ChatListSkeletonProps {
  itemCount?: number
  className?: string
}

export function ChatListSkeleton({ itemCount = 6, className }: ChatListSkeletonProps) {
  return (
    <ListSkeleton
      itemCount={itemCount}
      variant='conversation'
      showDividers={false}
      showActions={false}
      showMetadata={true}
      className={className}
    />
  )
}

export interface NotificationListSkeletonProps {
  itemCount?: number
  className?: string
}

export function NotificationListSkeleton({ itemCount = 4, className }: NotificationListSkeletonProps) {
  return (
    <ListSkeleton
      itemCount={itemCount}
      variant='detailed'
      showDividers={true}
      showActions={true}
      showMetadata={true}
      className={className}
    />
  )
}

export interface SearchResultsSkeletonProps {
  itemCount?: number
  className?: string
}

export function SearchResultsSkeleton({ itemCount = 6, className }: SearchResultsSkeletonProps) {
  return (
    <ListSkeleton
      itemCount={itemCount}
      variant='media'
      showDividers={true}
      showActions={false}
      showMetadata={true}
      className={className}
    />
  )
}