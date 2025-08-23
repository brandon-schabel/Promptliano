import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Skeleton } from '@promptliano/ui'

export interface TextSkeletonProps {
  lines?: number
  variant?: 'paragraph' | 'title' | 'heading' | 'caption' | 'code'
  spacing?: 'tight' | 'normal' | 'loose'
  width?: 'full' | 'auto'
  className?: string
}

export function TextSkeleton({
  lines = 3,
  variant = 'paragraph',
  spacing = 'normal',
  width = 'auto',
  className
}: TextSkeletonProps) {
  const getSpacing = () => {
    switch (spacing) {
      case 'tight': return 'space-y-1'
      case 'loose': return 'space-y-4'
      default: return 'space-y-2'
    }
  }

  const getLineHeight = () => {
    switch (variant) {
      case 'title': return 'h-8'
      case 'heading': return 'h-6'
      case 'caption': return 'h-3'
      case 'code': return 'h-4'
      default: return 'h-4'
    }
  }

  const getLineWidth = (lineIndex: number, totalLines: number) => {
    if (width === 'full') return 'w-full'
    
    // Vary line widths for more realistic appearance
    if (variant === 'title') {
      return lineIndex === 0 ? 'w-3/4' : 'w-1/2'
    }
    
    if (variant === 'heading') {
      return lineIndex === 0 ? 'w-2/3' : 'w-1/3'
    }
    
    // For paragraphs, make the last line shorter
    if (lineIndex === totalLines - 1) {
      return ['w-1/2', 'w-2/3', 'w-3/4'][Math.floor(Math.random() * 3)]
    }
    
    return ['w-full', 'w-5/6', 'w-4/5'][Math.floor(Math.random() * 3)]
  }

  if (variant === 'code') {
    return (
      <div className={cn('font-mono text-sm', getSpacing(), className)}>
        {Array.from({ length: lines }).map((_, index) => {
          // Simulate code indentation
          const indentLevel = Math.floor(Math.random() * 3)
          const marginLeft = indentLevel > 0 ? `ml-${indentLevel * 4}` : ''
          const codeWidth = ['w-1/3', 'w-1/2', 'w-2/3', 'w-3/4', 'w-5/6'][Math.floor(Math.random() * 5)]
          
          return (
            <Skeleton
              key={index}
              className={cn(
                getLineHeight(),
                codeWidth,
                marginLeft,
                'bg-muted/60'
              )}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn(getSpacing(), className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            getLineHeight(),
            getLineWidth(index, lines)
          )}
        />
      ))}
    </div>
  )
}

// Specialized text skeletons for specific content types
export interface TitleSkeletonProps {
  subtitle?: boolean
  className?: string
}

export function TitleSkeleton({ subtitle = false, className }: TitleSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className='h-8 w-2/3' />
      {subtitle && <Skeleton className='h-5 w-1/2' />}
    </div>
  )
}

export interface ParagraphSkeletonProps {
  lines?: number
  className?: string
}

export function ParagraphSkeleton({ lines = 4, className }: ParagraphSkeletonProps) {
  return (
    <TextSkeleton
      lines={lines}
      variant='paragraph'
      spacing='normal'
      className={className}
    />
  )
}

export interface CodeBlockSkeletonProps {
  lines?: number
  className?: string
}

export function CodeBlockSkeleton({ lines = 8, className }: CodeBlockSkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-muted/50 p-4', className)}>
      <TextSkeleton
        lines={lines}
        variant='code'
        spacing='tight'
      />
    </div>
  )
}

export interface MetadataSkeletonProps {
  items?: number
  className?: string
}

export function MetadataSkeleton({ items = 3, className }: MetadataSkeletonProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className='flex items-center gap-2'>
          <Skeleton className='h-4 w-4 rounded' />
          <Skeleton className='h-3 w-16' />
        </div>
      ))}
    </div>
  )
}

export interface BreadcrumbSkeletonProps {
  items?: number
  className?: string
}

export function BreadcrumbSkeleton({ items = 3, className }: BreadcrumbSkeletonProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <React.Fragment key={index}>
          <Skeleton className='h-4 w-20' />
          {index < items - 1 && (
            <Skeleton className='h-3 w-3' />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export interface ArticleSkeletonProps {
  className?: string
}

export function ArticleSkeleton({ className }: ArticleSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Title */}
      <TitleSkeleton subtitle={true} />
      
      {/* Metadata */}
      <MetadataSkeleton items={4} />
      
      {/* Content paragraphs */}
      <ParagraphSkeleton lines={5} />
      <ParagraphSkeleton lines={4} />
      <ParagraphSkeleton lines={6} />
      
      {/* Code block */}
      <CodeBlockSkeleton lines={6} />
      
      {/* More content */}
      <ParagraphSkeleton lines={3} />
    </div>
  )
}