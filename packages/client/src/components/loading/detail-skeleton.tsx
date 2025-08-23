import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Skeleton } from '@promptliano/ui'

export interface DetailSkeletonProps {
  variant?: 'project' | 'ticket' | 'user' | 'settings' | 'dashboard'
  showSidebar?: boolean
  showTabs?: boolean
  showMetrics?: boolean
  className?: string
}

export function DetailSkeleton({
  variant = 'project',
  showSidebar = false,
  showTabs = false,
  showMetrics = false,
  className
}: DetailSkeletonProps) {
  const renderHeader = () => (
    <div className='space-y-4 p-6 border-b'>
      {/* Breadcrumb */}
      <div className='flex items-center gap-2'>
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-3 w-3' />
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-3 w-3' />
        <Skeleton className='h-4 w-24' />
      </div>

      {/* Title and actions */}
      <div className='flex items-start justify-between'>
        <div className='space-y-2 flex-1'>
          <div className='flex items-center gap-3'>
            <Skeleton className='h-8 w-8 rounded-lg' />
            <Skeleton className='h-8 w-64' />
            <Skeleton className='h-6 w-20 rounded-full' />
          </div>
          <Skeleton className='h-5 w-96' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-9 w-9 rounded' />
          <Skeleton className='h-9 w-9 rounded' />
          <Skeleton className='h-9 w-24' />
        </div>
      </div>

      {/* Metadata */}
      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-4' />
          <Skeleton className='h-4 w-20' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-4' />
          <Skeleton className='h-4 w-24' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-4' />
          <Skeleton className='h-4 w-16' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-4' />
          <Skeleton className='h-4 w-28' />
        </div>
      </div>
    </div>
  )

  const renderMetrics = () => (
    <div className='grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b'>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className='space-y-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-7 w-16' />
          <div className='flex items-center gap-1'>
            <Skeleton className='h-3 w-3' />
            <Skeleton className='h-3 w-12' />
          </div>
        </div>
      ))}
    </div>
  )

  const renderTabs = () => (
    <div className='border-b'>
      <div className='flex items-center gap-1 px-6'>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className='h-10 w-24 rounded-t-md' />
        ))}
      </div>
    </div>
  )

  const renderSidebar = () => (
    <div className='w-80 border-r bg-muted/30 p-6 space-y-6'>
      {/* Sidebar header */}
      <div className='space-y-2'>
        <Skeleton className='h-5 w-24' />
        <Skeleton className='h-4 w-full' />
      </div>

      {/* Quick actions */}
      <div className='space-y-3'>
        <Skeleton className='h-4 w-20' />
        <div className='grid grid-cols-2 gap-2'>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
        </div>
      </div>

      {/* Properties */}
      <div className='space-y-4'>
        <Skeleton className='h-4 w-20' />
        <div className='space-y-3'>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className='flex items-center justify-between'>
              <Skeleton className='h-4 w-16' />
              <Skeleton className='h-4 w-20' />
            </div>
          ))}
        </div>
      </div>

      {/* Activity */}
      <div className='space-y-4'>
        <Skeleton className='h-4 w-16' />
        <div className='space-y-3'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className='flex gap-3'>
              <Skeleton className='h-6 w-6 rounded-full flex-shrink-0' />
              <div className='space-y-1 flex-1'>
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-16' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderMainContent = () => {
    if (variant === 'dashboard') {
      return (
        <div className='p-6 space-y-6'>
          {/* Widget grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className='rounded-lg border bg-card p-4 space-y-3'>
                <div className='flex items-center justify-between'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-4' />
                </div>
                <Skeleton className='h-8 w-20' />
                <div className='flex items-center gap-2'>
                  <Skeleton className='h-3 w-3' />
                  <Skeleton className='h-3 w-16' />
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <div className='rounded-lg border bg-card p-6 space-y-4'>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-64 w-full' />
            </div>
            <div className='rounded-lg border bg-card p-6 space-y-4'>
              <Skeleton className='h-5 w-28' />
              <Skeleton className='h-64 w-full' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='p-6 space-y-6'>
        {/* Main content sections */}
        <div className='space-y-4'>
          <Skeleton className='h-5 w-32' />
          <div className='space-y-2'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-5/6' />
            <Skeleton className='h-4 w-4/5' />
            <Skeleton className='h-4 w-2/3' />
          </div>
        </div>

        {/* Code or content block */}
        <div className='rounded-lg border bg-muted/50 p-4 space-y-2'>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className='h-4 w-full' />
          ))}
        </div>

        {/* Additional sections */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='space-y-4'>
            <Skeleton className='h-5 w-24' />
            <div className='space-y-3'>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className='flex items-center gap-3 p-3 border rounded'>
                  <Skeleton className='h-8 w-8 rounded' />
                  <div className='flex-1 space-y-1'>
                    <Skeleton className='h-4 w-3/4' />
                    <Skeleton className='h-3 w-1/2' />
                  </div>
                  <Skeleton className='h-6 w-6' />
                </div>
              ))}
            </div>
          </div>

          <div className='space-y-4'>
            <Skeleton className='h-5 w-28' />
            <div className='space-y-2'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-4/5' />
              <Skeleton className='h-4 w-3/4' />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {renderHeader()}
      {showMetrics && renderMetrics()}
      {showTabs && renderTabs()}
      
      <div className='flex flex-1 overflow-hidden'>
        {showSidebar && renderSidebar()}
        <div className='flex-1 overflow-auto'>
          {renderMainContent()}
        </div>
      </div>
    </div>
  )
}

// Specialized detail skeletons for specific pages
export interface ProjectDetailSkeletonProps {
  className?: string
}

export function ProjectDetailSkeleton({ className }: ProjectDetailSkeletonProps) {
  return (
    <DetailSkeleton
      variant='project'
      showSidebar={true}
      showTabs={true}
      showMetrics={true}
      className={className}
    />
  )
}

export interface TicketDetailSkeletonProps {
  className?: string
}

export function TicketDetailSkeleton({ className }: TicketDetailSkeletonProps) {
  return (
    <DetailSkeleton
      variant='ticket'
      showSidebar={true}
      showTabs={false}
      showMetrics={false}
      className={className}
    />
  )
}

export interface DashboardSkeletonProps {
  className?: string
}

export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <DetailSkeleton
      variant='dashboard'
      showSidebar={false}
      showTabs={true}
      showMetrics={true}
      className={className}
    />
  )
}

export interface SettingsDetailSkeletonProps {
  className?: string
}

export function SettingsDetailSkeleton({ className }: SettingsDetailSkeletonProps) {
  return (
    <DetailSkeleton
      variant='settings'
      showSidebar={true}
      showTabs={true}
      showMetrics={false}
      className={className}
    />
  )
}