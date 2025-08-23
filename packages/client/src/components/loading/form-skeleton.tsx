import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Skeleton } from '@promptliano/ui'

export interface FormSkeletonProps {
  fields?: number
  variant?: 'simple' | 'complex' | 'wizard' | 'settings'
  showActions?: boolean
  showTabs?: boolean
  columns?: 1 | 2 | 3
  className?: string
}

export function FormSkeleton({
  fields = 6,
  variant = 'simple',
  showActions = true,
  showTabs = false,
  columns = 1,
  className
}: FormSkeletonProps) {
  const renderField = (index: number, fieldType?: string) => {
    const isFullWidth = fieldType === 'textarea' || fieldType === 'select-multi' || columns === 1
    const fieldClass = isFullWidth ? 'col-span-full' : ''

    // Vary field types for realistic appearance
    const types = ['text', 'select', 'textarea', 'checkbox', 'radio', 'number', 'date']
    const randomType = fieldType || types[Math.floor(Math.random() * types.length)]

    if (randomType === 'textarea') {
      return (
        <div key={index} className={cn('space-y-2', fieldClass)}>
          <Skeleton className='h-4 w-1/3' />
          <Skeleton className='h-24 w-full rounded-md' />
          <Skeleton className='h-3 w-1/4' />
        </div>
      )
    }

    if (randomType === 'select') {
      return (
        <div key={index} className={cn('space-y-2', fieldClass)}>
          <Skeleton className='h-4 w-1/3' />
          <Skeleton className='h-10 w-full rounded-md' />
        </div>
      )
    }

    if (randomType === 'checkbox' || randomType === 'radio') {
      return (
        <div key={index} className={cn('space-y-3', fieldClass)}>
          <Skeleton className='h-4 w-1/3' />
          <div className='space-y-2'>
            {Array.from({ length: 3 }).map((_, optionIndex) => (
              <div key={optionIndex} className='flex items-center gap-2'>
                <Skeleton className='h-4 w-4 rounded' />
                <Skeleton className='h-4 w-24' />
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Default text input
    return (
      <div key={index} className={cn('space-y-2', fieldClass)}>
        <Skeleton className='h-4 w-1/3' />
        <Skeleton className='h-10 w-full rounded-md' />
        {Math.random() > 0.7 && <Skeleton className='h-3 w-1/2' />}
      </div>
    )
  }

  if (variant === 'wizard') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Progress indicator */}
        <div className='flex items-center gap-2'>
          {Array.from({ length: 4 }).map((_, index) => (
            <React.Fragment key={index}>
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full',
                index <= 1 ? 'bg-primary' : 'bg-muted'
              )}>
                <Skeleton className={cn('h-4 w-4 rounded-full', index <= 1 ? 'bg-primary-foreground' : 'bg-muted-foreground')} />
              </div>
              {index < 3 && <Skeleton className='h-1 w-12 flex-1' />}
            </React.Fragment>
          ))}
        </div>

        {/* Step title */}
        <div className='space-y-2'>
          <Skeleton className='h-6 w-1/3' />
          <Skeleton className='h-4 w-2/3' />
        </div>

        {/* Form fields */}
        <div className={cn(
          'grid gap-6',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3'
        )}>
          {Array.from({ length: Math.min(fields, 4) }).map((_, index) => renderField(index))}
        </div>

        {/* Navigation buttons */}
        <div className='flex items-center justify-between pt-4 border-t'>
          <Skeleton className='h-10 w-20' />
          <div className='flex items-center gap-2'>
            <Skeleton className='h-10 w-20' />
            <Skeleton className='h-10 w-20' />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'settings') {
    return (
      <div className={cn('space-y-8', className)}>
        {showTabs && (
          <div className='flex items-center gap-1 border-b'>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className='h-10 w-24 rounded-t-md' />
            ))}
          </div>
        )}

        {/* Settings sections */}
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className='space-y-4'>
            <div className='space-y-1'>
              <Skeleton className='h-5 w-1/4' />
              <Skeleton className='h-4 w-1/2' />
            </div>
            
            <div className='grid gap-4 grid-cols-1'>
              {Array.from({ length: Math.floor(fields / 3) }).map((_, fieldIndex) => (
                <div key={fieldIndex} className='flex items-center justify-between p-4 border rounded-lg'>
                  <div className='space-y-1'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-3 w-48' />
                  </div>
                  <Skeleton className='h-6 w-12 rounded-full' />
                </div>
              ))}
            </div>
          </div>
        ))}

        {showActions && (
          <div className='flex items-center justify-end gap-2 pt-4 border-t'>
            <Skeleton className='h-10 w-20' />
            <Skeleton className='h-10 w-24' />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'complex') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Form header */}
        <div className='space-y-2'>
          <Skeleton className='h-6 w-1/3' />
          <Skeleton className='h-4 w-2/3' />
        </div>

        {/* Field sections */}
        <div className='space-y-8'>
          <div className='space-y-4'>
            <Skeleton className='h-5 w-1/4' />
            <div className={cn(
              'grid gap-4',
              columns === 2 && 'grid-cols-2',
              columns === 3 && 'grid-cols-3'
            )}>
              {Array.from({ length: Math.floor(fields / 2) }).map((_, index) => renderField(index))}
            </div>
          </div>

          <div className='space-y-4'>
            <Skeleton className='h-5 w-1/4' />
            <div className={cn(
              'grid gap-4',
              columns === 2 && 'grid-cols-2',
              columns === 3 && 'grid-cols-3'
            )}>
              {Array.from({ length: Math.ceil(fields / 2) }).map((_, index) => renderField(index))}
            </div>
          </div>
        </div>

        {showActions && (
          <div className='flex items-center justify-between pt-6 border-t'>
            <Skeleton className='h-10 w-24' />
            <div className='flex items-center gap-2'>
              <Skeleton className='h-10 w-20' />
              <Skeleton className='h-10 w-24' />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Simple variant
  return (
    <div className={cn('space-y-4', className)}>
      <div className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3'
      )}>
        {Array.from({ length: fields }).map((_, index) => renderField(index))}
      </div>

      {showActions && (
        <div className='flex items-center justify-end gap-2 pt-4'>
          <Skeleton className='h-10 w-20' />
          <Skeleton className='h-10 w-24' />
        </div>
      )}
    </div>
  )
}

// Specialized form skeletons for specific use cases
export interface LoginFormSkeletonProps {
  className?: string
}

export function LoginFormSkeleton({ className }: LoginFormSkeletonProps) {
  return (
    <div className={cn('w-full max-w-sm space-y-4', className)}>
      <div className='space-y-2 text-center'>
        <Skeleton className='h-7 w-32 mx-auto' />
        <Skeleton className='h-4 w-48 mx-auto' />
      </div>
      
      <FormSkeleton
        fields={2}
        variant='simple'
        showActions={true}
        columns={1}
      />
      
      <div className='space-y-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-4 w-24 mx-auto' />
      </div>
    </div>
  )
}

export interface ProjectFormSkeletonProps {
  className?: string
}

export function ProjectFormSkeleton({ className }: ProjectFormSkeletonProps) {
  return (
    <FormSkeleton
      fields={8}
      variant='complex'
      showActions={true}
      columns={2}
      className={className}
    />
  )
}

export interface SettingsFormSkeletonProps {
  className?: string
}

export function SettingsFormSkeleton({ className }: SettingsFormSkeletonProps) {
  return (
    <FormSkeleton
      fields={12}
      variant='settings'
      showActions={true}
      showTabs={true}
      columns={1}
      className={className}
    />
  )
}