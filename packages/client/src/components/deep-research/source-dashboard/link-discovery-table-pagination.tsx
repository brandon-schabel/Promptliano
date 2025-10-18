/**
 * Link Discovery Table Pagination
 *
 * Custom pagination component with:
 * - Page size selector (10, 20, 50, 100)
 * - Page navigation (First, Previous, Page numbers, Next, Last)
 * - Current range display ("1-20 of 1,245 links")
 * - Smooth transitions and keyboard navigation
 */

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LinkDiscoveryTablePaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  className?: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/**
 * LinkDiscoveryTablePagination - Pagination controls
 *
 * Features:
 * - Page size selector dropdown
 * - First/Last page buttons
 * - Previous/Next navigation
 * - Page number display with ellipsis
 * - Current range indicator
 * - Keyboard navigation support
 * - Responsive layout
 */
export function LinkDiscoveryTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className
}: LinkDiscoveryTablePaginationProps) {
  // Calculate display range
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // Generate visible page numbers with ellipsis
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = []
    const showEllipsis = totalPages > 7

    if (!showEllipsis) {
      // Show all pages if <= 7
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show first page
      pages.push(1)

      // Show ellipsis or pages near current page
      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      // Show ellipsis or last pages
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const visiblePages = getVisiblePages()

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handleFirstPage = () => {
    onPageChange(1)
  }

  const handleLastPage = () => {
    onPageChange(totalPages)
  }

  // No pagination needed if only one page
  if (totalPages <= 1 && totalItems <= PAGE_SIZE_OPTIONS[0]) {
    return (
      <div className={cn('flex items-center justify-between', className)}>
        <div className="text-sm text-muted-foreground">
          Showing {totalItems} {totalItems === 1 ? 'link' : 'links'}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      {/* Left: Items per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Items per page:</span>
        <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Center: Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleFirstPage}
          disabled={currentPage === 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-3 py-2 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  ...
                </span>
              )
            }

            return (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page)}
                className={cn('min-w-[2.5rem]', currentPage === page && 'pointer-events-none')}
                aria-label={`Go to page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </Button>
            )
          })}
        </div>

        {/* Next page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleLastPage}
          disabled={currentPage === totalPages}
          aria-label="Go to last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: Current range */}
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{startItem.toLocaleString()}</span>-
        <span className="font-medium">{endItem.toLocaleString()}</span> of{' '}
        <span className="font-medium">{totalItems.toLocaleString()}</span> links
      </div>
    </div>
  )
}

/**
 * Compact pagination variant for smaller displays
 */
export function CompactLinkDiscoveryTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className
}: LinkDiscoveryTablePaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Top row: Range and page size */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {startItem}-{endItem} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Per page:</span>
          <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))}>
            <SelectTrigger className="w-16 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bottom row: Navigation */}
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <span className="px-4 text-sm">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
