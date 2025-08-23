import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { Skeleton } from '@promptliano/ui'

export interface TableSkeletonProps {
  columns?: number
  rows?: number
  showHeader?: boolean
  showPagination?: boolean
  showActions?: boolean
  dense?: boolean
  className?: string
}

export function TableSkeleton({
  columns = 4,
  rows = 5,
  showHeader = true,
  showPagination = true,
  showActions = true,
  dense = false,
  className
}: TableSkeletonProps) {
  const cellHeight = dense ? 'h-3' : 'h-4'
  const padding = dense ? 'p-2' : 'p-4'
  
  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Table search and controls */}
      <div className='flex items-center justify-between'>
        <Skeleton className='h-9 w-64' />
        {showActions && (
          <div className='flex items-center gap-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-9' />
          </div>
        )}
      </div>
      
      {/* Table */}
      <div className='rounded-lg border bg-card'>
        {showHeader && (
          <div className={cn('border-b bg-muted/50', padding)}>
            <div 
              className='grid gap-4' 
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className={cellHeight} />
              ))}
            </div>
          </div>
        )}
        
        <div className='divide-y'>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className={padding}>
              <div 
                className='grid gap-4 items-center' 
                style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
              >
                {Array.from({ length: columns }).map((_, colIndex) => {
                  // Vary skeleton widths for more realistic appearance
                  const widths = ['w-full', 'w-4/5', 'w-3/4', 'w-2/3', 'w-1/2']
                  const randomWidth = widths[Math.floor(Math.random() * widths.length)]
                  
                  return (
                    <Skeleton 
                      key={colIndex} 
                      className={cn(cellHeight, randomWidth)} 
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination */}
      {showPagination && (
        <div className='flex items-center justify-between'>
          <Skeleton className='h-9 w-32' />
          <div className='flex items-center gap-2'>
            <Skeleton className='h-9 w-16' />
            <Skeleton className='h-9 w-9' />
            <Skeleton className='h-9 w-9' />
            <Skeleton className='h-9 w-9' />
            <Skeleton className='h-9 w-16' />
          </div>
        </div>
      )}
    </div>
  )
}

// Specialized table skeletons for specific content types
export interface ProjectTableSkeletonProps {
  rows?: number
  className?: string
}

export function ProjectTableSkeleton({ rows = 5, className }: ProjectTableSkeletonProps) {
  return (
    <TableSkeleton
      columns={5}
      rows={rows}
      showHeader={true}
      showPagination={true}
      showActions={true}
      className={className}
    />
  )
}

export interface TicketTableSkeletonProps {
  rows?: number
  className?: string
}

export function TicketTableSkeleton({ rows = 5, className }: TicketTableSkeletonProps) {
  return (
    <TableSkeleton
      columns={6}
      rows={rows}
      showHeader={true}
      showPagination={true}
      showActions={true}
      className={className}
    />
  )
}

export interface CompactTableSkeletonProps {
  rows?: number
  className?: string
}

export function CompactTableSkeleton({ rows = 3, className }: CompactTableSkeletonProps) {
  return (
    <TableSkeleton
      columns={3}
      rows={rows}
      showHeader={false}
      showPagination={false}
      showActions={false}
      dense={true}
      className={className}
    />
  )
}