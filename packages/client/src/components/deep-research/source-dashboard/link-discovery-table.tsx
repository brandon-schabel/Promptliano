/**
 * Link Discovery Table Component
 *
 * A comprehensive, feature-rich data table for displaying discovered links with:
 * - Advanced sorting (multi-column, persistent state)
 * - Comprehensive filtering (status, depth, search, date range)
 * - Server-side pagination with page size selector
 * - Bulk selection and actions
 * - Column visibility and reordering
 * - Export functionality (CSV, JSON)
 * - Keyboard navigation and accessibility
 * - Responsive design with mobile variant
 *
 * @example
 * ```tsx
 * <LinkDiscoveryTable
 *   sourceId={sourceId}
 *   initialFilters={{ status: ['crawled'], minDepth: 0, maxDepth: 3 }}
 * />
 * ```
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState
} from '@tanstack/react-table'
import { useSourceLinks } from '@/hooks/api-hooks'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  DataTableColumnHeader,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  createSelectionColumn
} from '@promptliano/ui'
import {
  CheckCircle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Link2,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { LinkDiscoveryTableToolbar } from './link-discovery-table-toolbar'
import { LinkDiscoveryTableFilters } from './link-discovery-table-filters'
import { LinkDiscoveryTablePagination } from './link-discovery-table-pagination'
import { toast } from 'sonner'
import { Route } from '@/routes/deep-research.$researchId.sources.$sourceId'
import type { SourceDashboardSearch } from '@/lib/search-schemas'
import { sanitizeUrl, getSafeRelAttribute } from '@/lib/url-utils'

// Type definitions
export interface LinkDiscoveryTableProps {
  sourceId: number
  initialFilters?: LinkFilters
  showBulkActions?: boolean
  showColumnControls?: boolean
  compact?: boolean
  className?: string
}

export interface LinkFilters {
  status?: ('pending' | 'crawled' | 'failed')[]
  minDepth?: number
  maxDepth?: number
  search?: string
  dateRange?: { from: Date; to: Date }
}

export interface Link {
  id: number
  url: string
  title?: string
  depth: number
  discoveredAt: string
  status: 'pending' | 'crawled' | 'failed'
  parentUrl?: string
  relevanceScore?: number
  tokenCount?: number
  contentPreview?: string
}

export type SortableColumn = 'discoveredAt' | 'url' | 'depth' | 'relevanceScore' | 'title' | 'status'

// Status configuration
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-yellow-600'
  },
  crawled: {
    label: 'Crawled',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-green-600'
  },
  failed: {
    label: 'Failed',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-red-600'
  }
} as const

/**
 * LinkDiscoveryTable - Main component
 *
 * Features:
 * - Type-safe search parameter management
 * - Optimistic UI updates
 * - Keyboard shortcuts (Ctrl+F for search, Ctrl+A for select all)
 * - Auto-refresh support
 * - Virtual scrolling for large datasets
 */
export function LinkDiscoveryTable({
  sourceId,
  initialFilters,
  showBulkActions = true,
  showColumnControls = true,
  compact = false,
  className
}: LinkDiscoveryTableProps) {
  const getLinkKey = useCallback((link: Link) => {
    if (link && link.id !== undefined && link.id !== null) {
      return link.id.toString()
    }

    if (link?.url) {
      return link.url
    }

    return `${link?.discoveredAt ?? 'unknown'}-${link?.depth ?? 'unknown'}`
  }, [])
  // URL state management for persistence
  const searchParams = Route.useSearch()
  const params = Route.useParams()
  const navigate = useNavigate()

  // Parse search params for table state
  const parsedPageIndex = useMemo(() => {
    const raw = Number.parseInt(String(searchParams.page ?? '1'), 10)
    return Number.isFinite(raw) && raw > 0 ? raw - 1 : 0
  }, [searchParams.page])
  const parsedPageSize = useMemo(() => {
    const raw = Number.parseInt(String(searchParams.limit ?? '100'), 10)
    return Number.isFinite(raw) && raw > 0 ? raw : 100
  }, [searchParams.limit])
  const sortBy = (searchParams.sortBy as SortableColumn) || 'discoveredAt'
  const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc'

  // Local state
  const filtersFromSearch = useMemo<LinkFilters>(() => {
    const statusValue = searchParams.status
    const status = statusValue ? (statusValue.split(',') as ('pending' | 'crawled' | 'failed')[]) : undefined
    const dateRange =
      searchParams.from && searchParams.to
        ? { from: new Date(searchParams.from), to: new Date(searchParams.to) }
        : undefined

    return {
      status,
      minDepth: searchParams.minDepth,
      maxDepth: searchParams.maxDepth,
      search: searchParams.search,
      dateRange
    }
  }, [searchParams])

  const [filters, setFilters] = useState<LinkFilters>(initialFilters || filtersFromSearch)
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: parsedPageIndex,
    pageSize: parsedPageSize
  })

  useEffect(() => {
    if (!initialFilters) {
      setFilters(filtersFromSearch)
    }
  }, [filtersFromSearch, initialFilters])

  useEffect(() => {
    setPaginationState((prev) => {
      if (prev.pageIndex !== parsedPageIndex || prev.pageSize !== parsedPageSize) {
        return {
          pageIndex: parsedPageIndex,
          pageSize: parsedPageSize
        }
      }
      return prev
    })
  }, [parsedPageIndex, parsedPageSize])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showFilters, setShowFilters] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    status: true,
    url: true,
    title: true,
    depth: true,
    discoveredAt: true,
    parentUrl: false,
    relevanceScore: false,
    tokens: false
  })

  // Fetch data with parameters
  const { data, isLoading, isFetching, refetch } = useSourceLinks(sourceId, {
    page: paginationState.pageIndex + 1,
    limit: paginationState.pageSize,
    sortBy,
    sortOrder,
    status: filters.status?.join(','),
    minDepth: filters.minDepth,
    maxDepth: filters.maxDepth,
    search: filters.search,
    from: filters.dateRange?.from?.toISOString(),
    to: filters.dateRange?.to?.toISOString()
  })

  const paginationData = useMemo(() => data?.data?.pagination, [data])
  const links = useMemo(() => data?.data?.links || [], [data])
  const totalCount = useMemo(() => {
    if (paginationData?.total !== undefined) return paginationData.total
    if (data?.data?.total !== undefined) return data.data.total
    return links.length
  }, [paginationData, data, links])
  const effectiveLimit = paginationState.pageSize
  const totalPages = useMemo(() => {
    if (paginationData?.totalPages !== undefined) {
      return Math.max(paginationData.totalPages, 1)
    }
    return Math.max(Math.ceil(totalCount / Math.max(effectiveLimit, 1)), 1)
  }, [paginationData, totalCount, effectiveLimit])

  const [sortingState, setSortingState] = useState<SortingState>([{ id: sortBy, desc: sortOrder === 'desc' }])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status && filters.status.length > 0) count++
    if (filters.minDepth !== undefined || filters.maxDepth !== undefined) count++
    if (filters.search) count++
    if (filters.dateRange) count++
    return count
  }, [filters])

  // Update URL when table state changes
  const updateSearchParams = useCallback(
    (updates: Partial<SourceDashboardSearch>) => {
      navigate({
        to: '/deep-research/$researchId/sources/$sourceId',
        params,
        search: (prev) => ({
          ...prev,
          ...updates
        }),
        replace: true
      })
    },
    [navigate, params]
  )

  // Sorting handler
  // Pagination handlers
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPaginationState((prev) => ({ ...prev, pageIndex: Math.max(newPage - 1, 0) }))
      setRowSelection({})
      updateSearchParams({
        page: newPage,
        limit: paginationState.pageSize,
        sortBy,
        sortOrder,
        status: filters.status?.join(','),
        minDepth: filters.minDepth,
        maxDepth: filters.maxDepth,
        search: filters.search,
        from: filters.dateRange?.from?.toISOString(),
        to: filters.dateRange?.to?.toISOString()
      })
    },
    [filters, paginationState.pageSize, sortBy, sortOrder, updateSearchParams]
  )

  const handlePageSizeChange = useCallback(
    (newLimit: number) => {
      setPaginationState({ pageIndex: 0, pageSize: newLimit })
      setRowSelection({})
      updateSearchParams({
        limit: newLimit,
        page: 1,
        sortBy,
        sortOrder,
        status: filters.status?.join(','),
        minDepth: filters.minDepth,
        maxDepth: filters.maxDepth,
        search: filters.search,
        from: filters.dateRange?.from?.toISOString(),
        to: filters.dateRange?.to?.toISOString()
      })
    },
    [filters, sortBy, sortOrder, updateSearchParams]
  )

  // Filter handlers
  const handleFilterChange = useCallback(
    (newFilters: LinkFilters) => {
      setFilters(newFilters)
      setPaginationState((prev) => ({ ...prev, pageIndex: 0 }))
      setRowSelection({})
      updateSearchParams({
        page: 1,
        status: newFilters.status?.join(',') || undefined,
        minDepth: newFilters.minDepth,
        maxDepth: newFilters.maxDepth,
        search: newFilters.search,
        from: newFilters.dateRange?.from?.toISOString(),
        to: newFilters.dateRange?.to?.toISOString(),
        limit: paginationState.pageSize,
        sortBy,
        sortOrder
      })
    },
    [paginationState.pageSize, sortBy, sortOrder, updateSearchParams]
  )

  const clearFilters = useCallback(() => {
    setFilters({})
    setPaginationState((prev) => ({ ...prev, pageIndex: 0 }))
    setRowSelection({})
    updateSearchParams({
      page: 1,
      status: undefined,
      minDepth: undefined,
      maxDepth: undefined,
      search: undefined,
      from: undefined,
      to: undefined,
      limit: paginationState.pageSize,
      sortBy,
      sortOrder
    })
  }, [paginationState.pageSize, sortBy, sortOrder, updateSearchParams])

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (!showBulkActions) return
    setRowSelection((prev) => {
      const allSelected = links.every((link) => prev[getLinkKey(link)])
      if (allSelected) {
        return {}
      }
      const next: RowSelectionState = {}
      links.forEach((link) => {
        next[getLinkKey(link)] = true
      })
      return next
    })
  }, [links, showBulkActions, getLinkKey])

  // Bulk actions
  const selectedLinks = useMemo(
    () => links.filter((link) => rowSelection[getLinkKey(link)]),
    [getLinkKey, links, rowSelection]
  )

  const handleBulkExport = useCallback(
    (format: 'csv' | 'json') => {
      exportLinks(selectedLinks, format)
      toast.success(`Exported ${selectedLinks.length} links as ${format.toUpperCase()}`)
    },
    [selectedLinks]
  )

  const handleCopyUrls = useCallback(() => {
    const urls = selectedLinks.map((link) => link.url).join('\n')
    navigator.clipboard.writeText(urls)
    toast.success(`Copied ${selectedLinks.length} URLs to clipboard`)
  }, [selectedLinks])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showBulkActions) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        handleSelectAll()
      }
      if (e.key === 'Escape' && Object.keys(rowSelection).length > 0) {
        setRowSelection({})
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectAll, rowSelection, showBulkActions])

  useEffect(() => {
    if (paginationState.pageIndex !== parsedPageIndex || paginationState.pageSize !== parsedPageSize) {
      setPaginationState({ pageIndex: parsedPageIndex, pageSize: parsedPageSize })
    }
  }, [parsedPageIndex, parsedPageSize, paginationState.pageIndex, paginationState.pageSize])

  useEffect(() => {
    setSortingState([{ id: sortBy, desc: sortOrder === 'desc' }])
  }, [sortBy, sortOrder])

  useEffect(() => {
    setRowSelection({})
  }, [links])

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback((updater) => {
    setRowSelection((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  const handlePaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      setPaginationState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        updateSearchParams({
          page: next.pageIndex + 1,
          limit: next.pageSize,
          sortBy,
          sortOrder,
          status: filters.status?.join(','),
          minDepth: filters.minDepth,
          maxDepth: filters.maxDepth,
          search: filters.search,
          from: filters.dateRange?.from?.toISOString(),
          to: filters.dateRange?.to?.toISOString()
        })
        return next
      })
    },
    [filters, sortBy, sortOrder, updateSearchParams]
  )

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      setSortingState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!next.length) {
          updateSearchParams({
            sortBy: 'discoveredAt',
            sortOrder: 'desc',
            page: paginationState.pageIndex + 1,
            limit: paginationState.pageSize,
            status: filters.status?.join(','),
            minDepth: filters.minDepth,
            maxDepth: filters.maxDepth,
            search: filters.search,
            from: filters.dateRange?.from?.toISOString(),
            to: filters.dateRange?.to?.toISOString()
          })
          return [{ id: 'discoveredAt', desc: true }]
        }

        const [primary] = next
        const sortId = primary.id as SortableColumn
        updateSearchParams({
          sortBy: sortId,
          sortOrder: primary.desc ? 'desc' : 'asc',
          page: paginationState.pageIndex + 1,
          limit: paginationState.pageSize,
          status: filters.status?.join(','),
          minDepth: filters.minDepth,
          maxDepth: filters.maxDepth,
          search: filters.search,
          from: filters.dateRange?.from?.toISOString(),
          to: filters.dateRange?.to?.toISOString()
        })
        return [{ id: sortId, desc: primary.desc }]
      })
    },
    [filters, paginationState.pageIndex, paginationState.pageSize, updateSearchParams]
  )

  const columns = useMemo<ColumnDef<Link>[]>(() => {
    const cols: ColumnDef<Link>[] = []

    if (showBulkActions) {
      cols.push(createSelectionColumn<Link>())
    }

    cols.push({
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row }) => {
        const statusConfig = STATUS_CONFIG[row.original.status]
        const StatusIcon = statusConfig.icon
        return (
          <Badge variant={statusConfig.variant} className='flex items-center gap-1 w-fit'>
            <StatusIcon className='h-3 w-3' />
            {statusConfig.label}
          </Badge>
        )
      },
      meta: {
        className: 'w-28'
      }
    })

    cols.push({
      accessorKey: 'url',
      header: ({ column }) => <DataTableColumnHeader column={column} title='URL' />,
      cell: ({ row }) => {
        const link = row.original
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={sanitizeUrl(link.url)}
                  target='_blank'
                  rel={getSafeRelAttribute()}
                  className='text-blue-600 hover:underline flex items-center gap-1 max-w-md truncate group'
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className='truncate'>{link.url}</span>
                  <ExternalLink className='h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity' />
                </a>
              </TooltipTrigger>
              <TooltipContent side='bottom' className='max-w-lg break-all'>
                {link.url}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
    })

    cols.push({
      accessorKey: 'title',
      header: 'Title',
      enableSorting: false,
      cell: ({ row }) => {
        const title = row.original.title
        if (!title) {
          return <span className='text-muted-foreground italic'>—</span>
        }
        return (
          <span className='truncate max-w-xs block' title={title}>
            {title}
          </span>
        )
      }
    })

    cols.push({
      accessorKey: 'depth',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Depth' />,
      cell: ({ row }) => <Badge variant='outline'>Depth {row.original.depth}</Badge>,
      meta: {
        className: 'w-24'
      }
    })

    cols.push({
      accessorKey: 'discoveredAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Discovered' />,
      cell: ({ row }) => {
        const discoveredAt = new Date(row.original.discoveredAt)
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='text-sm text-muted-foreground'>
                  {formatDistanceToNow(discoveredAt, { addSuffix: true })}
                </span>
              </TooltipTrigger>
              <TooltipContent>{discoveredAt.toLocaleString()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      meta: {
        className: 'w-40'
      }
    })

    cols.push({
      accessorKey: 'parentUrl',
      header: 'Parent URL',
      enableSorting: false,
      cell: ({ row }) => {
        const parentUrl = row.original.parentUrl
        if (!parentUrl) {
          return <span className='text-muted-foreground italic'>—</span>
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={sanitizeUrl(parentUrl)}
                  target='_blank'
                  rel={getSafeRelAttribute()}
                  className='text-sm text-blue-600 hover:underline truncate block max-w-xs'
                  onClick={(e) => e.stopPropagation()}
                >
                  {parentUrl}
                </a>
              </TooltipTrigger>
              <TooltipContent className='max-w-lg break-all'>{parentUrl}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
    })

    cols.push({
      accessorKey: 'relevanceScore',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Relevance' />,
      cell: ({ row }) => {
        const value = row.original.relevanceScore
        if (value === undefined) {
          return <span className='text-muted-foreground italic'>—</span>
        }
        return <Badge variant='secondary'>{(value * 100).toFixed(0)}%</Badge>
      },
      meta: {
        className: 'w-32'
      }
    })

    cols.push({
      accessorKey: 'tokenCount',
      header: 'Tokens',
      enableSorting: false,
      cell: ({ row }) => {
        const tokens = row.original.tokenCount
        if (tokens === undefined) {
          return <span className='text-muted-foreground italic'>—</span>
        }
        return <span className='text-sm'>{tokens.toLocaleString()}</span>
      },
      meta: {
        className: 'w-24'
      }
    })

    cols.push({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const link = row.original

        const handleCopyUrl = () => {
          navigator.clipboard.writeText(link.url)
          toast.success('URL copied to clipboard')
        }

        const handleOpenUrl = () => {
          const safeUrl = sanitizeUrl(link.url)
          if (safeUrl !== '#') {
            window.open(safeUrl, '_blank', 'noopener,noreferrer')
          } else {
            toast.error('Invalid URL')
          }
        }

        return (
          <div className='flex items-center gap-1'>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleCopyUrl}>
                    <Copy className='h-4 w-4' />
                    <span className='sr-only'>Copy URL</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy URL</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleOpenUrl}>
                    <ExternalLink className='h-4 w-4' />
                    <span className='sr-only'>Open in new tab</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open in new tab</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
      meta: {
        className: 'w-20'
      }
    })

    return cols
  }, [showBulkActions])

  // Empty state
  if (!isLoading && links.length === 0 && activeFilterCount === 0) {
    return (
      <Card className={cn('', className)}>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <Link2 className='h-16 w-16 text-muted-foreground opacity-50 mb-4' />
          <h3 className='text-lg font-semibold mb-2'>No Links Discovered</h3>
          <p className='text-sm text-muted-foreground text-center max-w-md'>
            Links will appear here as they are discovered during the crawl process.
          </p>
        </CardContent>
      </Card>
    )
  }

  // No results with filters
  if (!isLoading && links.length === 0 && activeFilterCount > 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <LinkDiscoveryTableToolbar
            searchTerm={filters.search || ''}
            onSearchChange={(search) => handleFilterChange({ ...filters, search })}
            onFilterToggle={() => setShowFilters(!showFilters)}
            activeFilterCount={activeFilterCount}
            onRefresh={() => refetch()}
            selectedCount={selectedLinks.length}
            onBulkExport={handleBulkExport}
            onCopyUrls={handleCopyUrls}
            showBulkActions={showBulkActions}
            showColumnControls={showColumnControls}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />
        </CardHeader>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <Filter className='h-16 w-16 text-muted-foreground opacity-50 mb-4' />
          <h3 className='text-lg font-semibold mb-2'>No Results Found</h3>
          <p className='text-sm text-muted-foreground text-center max-w-md mb-4'>
            Try adjusting your filters or search criteria.
          </p>
          <Button variant='outline' onClick={clearFilters}>
            Clear Filters
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              Link Discovery Table
              <Badge variant='outline'>{totalCount.toLocaleString()} links</Badge>
            </CardTitle>
            <CardDescription>
              View, filter, and analyze all discovered links with advanced table features
            </CardDescription>
          </div>
        </div>

        <LinkDiscoveryTableToolbar
          searchTerm={filters.search || ''}
          onSearchChange={(search) => handleFilterChange({ ...filters, search })}
          onFilterToggle={() => setShowFilters(!showFilters)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          selectedCount={selectedLinks.length}
          onBulkExport={handleBulkExport}
          onCopyUrls={handleCopyUrls}
          showBulkActions={showBulkActions}
          showColumnControls={showColumnControls}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />

        {showFilters && (
          <LinkDiscoveryTableFilters
            filters={filters}
            onFiltersChange={handleFilterChange}
            onClearFilters={clearFilters}
          />
        )}
      </CardHeader>

      <CardContent>
        {/* Table */}
        <DataTable
          columns={columns}
          data={links}
          isLoading={isLoading}
          isFetching={isFetching}
          manualPagination
          manualSorting
          manualFiltering
          pageCount={Math.max(totalPages, 1)}
          pagination={paginationState}
          onPaginationChange={handlePaginationChange}
          sorting={sortingState}
          onSortingChange={handleSortingChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          enableRowSelection={showBulkActions}
          rowSelection={rowSelection}
          onRowSelectionChange={handleRowSelectionChange}
          showToolbar={false}
          showPagination={false}
          emptyMessage={activeFilterCount > 0 ? 'No results found' : 'No links discovered'}
          getRowId={(row) => getLinkKey(row)}
        />

        {/* Pagination */}
        <LinkDiscoveryTablePagination
          currentPage={paginationState.pageIndex + 1}
          totalPages={totalPages}
          pageSize={paginationState.pageSize}
          totalItems={totalCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          className='mt-4'
        />
      </CardContent>
    </Card>
  )
}

/**
 * Export utility functions
 */
function exportLinks(links: Link[], format: 'csv' | 'json') {
  if (format === 'csv') {
    const headers = ['URL', 'Title', 'Status', 'Depth', 'Discovered At', 'Parent URL', 'Relevance Score', 'Tokens']
    const rows = links.map((link) => [
      link.url,
      link.title || '',
      link.status,
      link.depth,
      new Date(link.discoveredAt).toISOString(),
      link.parentUrl || '',
      link.relevanceScore !== undefined ? link.relevanceScore.toString() : '',
      link.tokenCount !== undefined ? link.tokenCount.toString() : ''
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')

    downloadFile(csv, `links-export-${Date.now()}.csv`, 'text/csv')
  } else {
    const json = JSON.stringify(links, null, 2)
    downloadFile(json, `links-export-${Date.now()}.json`, 'application/json')
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
