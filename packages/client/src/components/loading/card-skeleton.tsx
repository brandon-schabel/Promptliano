import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Skeleton } from '@promptliano/ui'

export interface CardSkeletonProps {
  variant?: 'default' | 'compact' | 'detailed' | 'stat' | 'media'
  showHeader?: boolean
  showAvatar?: boolean
  showActions?: boolean
  showFooter?: boolean
  className?: string
}

export function CardSkeleton({
  variant = 'default',
  showHeader = true,
  showAvatar = false,
  showActions = true,
  showFooter = false,
  className
}: CardSkeletonProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('rounded-lg border bg-card p-4 space-y-3', className)}>
        <div className='flex items-start gap-3'>
          {showAvatar && <Skeleton className='h-8 w-8 rounded-full' />}
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
        {showActions && (
          <div className='flex items-center gap-2'>
            <Skeleton className='h-7 w-16' />
            <Skeleton className='h-7 w-7' />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={cn('rounded-lg border bg-card p-6 space-y-6', className)}>
        {showHeader && (
          <div className='flex items-start gap-4'>
            {showAvatar && <Skeleton className='h-12 w-12 rounded-lg' />}
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-6 w-2/3' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-3/4' />
            </div>
            {showActions && <Skeleton className='h-8 w-8 rounded' />}
          </div>
        )}
        
        <div className='space-y-3'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
          <Skeleton className='h-4 w-4/5' />
          <Skeleton className='h-4 w-2/3' />
        </div>
        
        <div className='flex items-center gap-4'>
          <Skeleton className='h-8 w-20' />
          <Skeleton className='h-8 w-24' />
          <Skeleton className='h-8 w-16' />
        </div>
        
        {showFooter && (
          <div className='border-t pt-4 flex items-center justify-between'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-4 w-24' />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'stat') {
    return (
      <div className={cn('rounded-lg border bg-card p-6 space-y-4', className)}>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-6 w-6 rounded' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-8 w-20' />
          <Skeleton className='h-4 w-16' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-4' />
          <Skeleton className='h-4 w-12' />
        </div>
      </div>
    )
  }

  if (variant === 'media') {
    return (
      <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
        <Skeleton className='h-48 w-full' />
        <div className='p-4 space-y-3'>
          <div className='flex items-start gap-3'>
            {showAvatar && <Skeleton className='h-10 w-10 rounded-full' />}
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-5 w-3/4' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-2/3' />
            </div>
          </div>
          {showActions && (
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-8 w-8 rounded' />
                <Skeleton className='h-8 w-8 rounded' />
                <Skeleton className='h-8 w-8 rounded' />
              </div>
              <Skeleton className='h-8 w-16' />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className={cn('rounded-lg border bg-card p-6 space-y-4', className)}>
      {showHeader && (
        <div className='flex items-start gap-4'>
          {showAvatar && <Skeleton className='h-12 w-12 rounded-lg' />}
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-5 w-2/3' />
            <Skeleton className='h-4 w-full' />
          </div>
          {showActions && <Skeleton className='h-8 w-8 rounded' />}
        </div>
      )}
      
      <div className='space-y-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-4/5' />
        <Skeleton className='h-4 w-3/5' />
      </div>
      
      {showActions && (
        <div className='flex items-center gap-2'>
          <Skeleton className='h-9 w-24' />
          <Skeleton className='h-9 w-24' />
        </div>
      )}
      
      {showFooter && (
        <div className='border-t pt-4 flex items-center justify-between'>
          <Skeleton className='h-4 w-28' />
          <Skeleton className='h-4 w-20' />
        </div>
      )}
    </div>
  )
}

// Specialized card skeletons for specific content types
export interface ProjectCardSkeletonProps {
  className?: string
}

export function ProjectCardSkeleton({ className }: ProjectCardSkeletonProps) {
  return (
    <CardSkeleton
      variant='detailed'
      showHeader={true}
      showAvatar={true}
      showActions={true}
      showFooter={true}
      className={className}
    />
  )
}

export interface TicketCardSkeletonProps {
  className?: string
}

export function TicketCardSkeleton({ className }: TicketCardSkeletonProps) {
  return (
    <CardSkeleton
      variant='default'
      showHeader={true}
      showAvatar={false}
      showActions={true}
      showFooter={true}
      className={className}
    />
  )
}

export interface StatCardSkeletonProps {
  className?: string
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <CardSkeleton
      variant='stat'
      showHeader={false}
      showAvatar={false}
      showActions={false}
      showFooter={false}
      className={className}
    />
  )
}

export interface CompactCardSkeletonProps {
  className?: string
}

export function CompactCardSkeleton({ className }: CompactCardSkeletonProps) {
  return (
    <CardSkeleton
      variant='compact'
      showHeader={true}
      showAvatar={true}
      showActions={true}
      showFooter={false}
      className={className}
    />
  )
}