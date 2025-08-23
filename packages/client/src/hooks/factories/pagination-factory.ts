/**
 * Pagination Factory
 * Creates reusable pagination patterns for tables, lists, and infinite scroll
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

// ============================================================================
// Types
// ============================================================================

export interface PaginationParams {
  page: number
  limit: number
  offset?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextPage?: number
  previousPage?: number
}

export interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  isLoading: boolean
  error: Error | null
}

export interface PaginationActions {
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  nextPage: () => void
  previousPage: () => void
  firstPage: () => void
  lastPage: () => void
  goToPage: (page: number) => void
  refresh: () => void
}

export interface PaginationHookConfig<T, TParams = void> {
  queryKey: (params: TParams & PaginationParams) => readonly unknown[]
  queryFn: (params: TParams & PaginationParams) => Promise<PaginatedResult<T>>
  defaultPage?: number
  defaultLimit?: number
  maxLimit?: number
  enabled?: boolean
  staleTime?: number
  keepPreviousData?: boolean
}

// ============================================================================
// Main Pagination Hook Factory
// ============================================================================

export function createPaginationHooks<T, TParams = void>(
  config: PaginationHookConfig<T, TParams>
) {
  return function usePagination(
    params?: TParams,
    options?: UseQueryOptions<PaginatedResult<T>>
  ) {
    const {
      queryKey,
      queryFn,
      defaultPage = 1,
      defaultLimit = 10,
      maxLimit = 100,
      enabled = true,
      staleTime = 5 * 60 * 1000,
      keepPreviousData = true
    } = config

    // Pagination state
    const [page, setPageState] = useState(defaultPage)
    const [limit, setLimitState] = useState(defaultLimit)

    // Computed query parameters
    const queryParams = useMemo(() => ({
      ...params,
      page,
      limit,
      offset: (page - 1) * limit
    } as TParams & PaginationParams), [params, page, limit])

    // Query
    const query = useQuery({
      queryKey: queryKey(queryParams),
      queryFn: () => queryFn(queryParams),
      enabled,
      staleTime,
      placeholderData: keepPreviousData ? (prev) => prev : undefined,
      ...options
    })

    // Computed state
    const state: PaginationState = useMemo(() => {
      const result = query.data
      return {
        page,
        limit,
        total: result?.total || 0,
        totalPages: result ? Math.ceil(result.total / result.limit) : 0,
        hasNextPage: result?.hasNextPage || false,
        hasPreviousPage: result?.hasPreviousPage || false,
        isLoading: query.isLoading,
        error: query.error
      }
    }, [query.data, query.isLoading, query.error, page, limit])

    // Actions
    const setPage = useCallback((newPage: number) => {
      const maxPage = Math.ceil((query.data?.total || 0) / limit)
      const validPage = Math.max(1, Math.min(newPage, maxPage))
      setPageState(validPage)
    }, [query.data?.total, limit])

    const setLimit = useCallback((newLimit: number) => {
      const validLimit = Math.max(1, Math.min(newLimit, maxLimit))
      setLimitState(validLimit)
      
      // Adjust page if necessary
      const currentOffset = (page - 1) * limit
      const newPage = Math.floor(currentOffset / validLimit) + 1
      setPageState(newPage)
    }, [page, limit, maxLimit])

    const nextPage = useCallback(() => {
      if (state.hasNextPage) {
        setPage(page + 1)
      }
    }, [state.hasNextPage, page, setPage])

    const previousPage = useCallback(() => {
      if (state.hasPreviousPage) {
        setPage(page - 1)
      }
    }, [state.hasPreviousPage, page, setPage])

    const firstPage = useCallback(() => {
      setPage(1)
    }, [setPage])

    const lastPage = useCallback(() => {
      if (state.totalPages > 0) {
        setPage(state.totalPages)
      }
    }, [state.totalPages, setPage])

    const goToPage = useCallback((targetPage: number) => {
      setPage(targetPage)
    }, [setPage])

    const refresh = useCallback(() => {
      query.refetch()
    }, [query])

    const actions: PaginationActions = {
      setPage,
      setLimit,
      nextPage,
      previousPage,
      firstPage,
      lastPage,
      goToPage,
      refresh
    }

    return {
      ...query,
      state,
      actions,
      data: query.data?.data || [],
      pagination: state
    }
  }
}

// ============================================================================
// Specialized Pagination Hooks
// ============================================================================

/**
 * Simple offset-based pagination
 */
export function createOffsetPagination<T>(
  queryKey: (offset: number, limit: number) => readonly unknown[],
  queryFn: (offset: number, limit: number) => Promise<{ data: T[]; total: number }>,
  defaultLimit: number = 10
) {
  return function useOffsetPagination() {
    const [offset, setOffset] = useState(0)
    const [limit, setLimit] = useState(defaultLimit)

    const query = useQuery({
      queryKey: queryKey(offset, limit),
      queryFn: () => queryFn(offset, limit),
      staleTime: 5 * 60 * 1000
    })

    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = query.data ? Math.ceil(query.data.total / limit) : 0
    const hasNextPage = offset + limit < (query.data?.total || 0)
    const hasPreviousPage = offset > 0

    const nextPage = useCallback(() => {
      if (hasNextPage) {
        setOffset(offset + limit)
      }
    }, [hasNextPage, offset, limit])

    const previousPage = useCallback(() => {
      if (hasPreviousPage) {
        setOffset(Math.max(0, offset - limit))
      }
    }, [hasPreviousPage, offset, limit])

    const goToPage = useCallback((page: number) => {
      const newOffset = (page - 1) * limit
      setOffset(Math.max(0, newOffset))
    }, [limit])

    const changeLimit = useCallback((newLimit: number) => {
      const currentPage = Math.floor(offset / limit) + 1
      setLimit(newLimit)
      setOffset((currentPage - 1) * newLimit)
    }, [offset, limit])

    return {
      ...query,
      data: query.data?.data || [],
      offset,
      limit,
      currentPage,
      totalPages,
      total: query.data?.total || 0,
      hasNextPage,
      hasPreviousPage,
      nextPage,
      previousPage,
      goToPage,
      setLimit: changeLimit,
      setOffset
    }
  }
}

/**
 * Cursor-based pagination for large datasets
 */
export function createCursorPagination<T extends { id: string | number }>(
  queryKey: (cursor: string | null, limit: number) => readonly unknown[],
  queryFn: (cursor: string | null, limit: number) => Promise<{
    data: T[]
    nextCursor: string | null
    hasMore: boolean
  }>,
  defaultLimit: number = 10
) {
  return function useCursorPagination() {
    const [cursors, setCursors] = useState<(string | null)[]>([null])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [limit, setLimit] = useState(defaultLimit)

    const currentCursor = cursors[currentIndex]

    const query = useQuery({
      queryKey: queryKey(currentCursor, limit),
      queryFn: () => queryFn(currentCursor, limit),
      staleTime: 5 * 60 * 1000
    })

    const hasNextPage = query.data?.hasMore || false
    const hasPreviousPage = currentIndex > 0

    const nextPage = useCallback(() => {
      if (hasNextPage && query.data?.nextCursor) {
        setCursors(prev => {
          const newCursors = [...prev]
          newCursors[currentIndex + 1] = query.data.nextCursor
          return newCursors
        })
        setCurrentIndex(currentIndex + 1)
      }
    }, [hasNextPage, query.data?.nextCursor, currentIndex])

    const previousPage = useCallback(() => {
      if (hasPreviousPage) {
        setCurrentIndex(currentIndex - 1)
      }
    }, [hasPreviousPage, currentIndex])

    const reset = useCallback(() => {
      setCursors([null])
      setCurrentIndex(0)
    }, [])

    return {
      ...query,
      data: query.data?.data || [],
      currentPage: currentIndex + 1,
      hasNextPage,
      hasPreviousPage,
      nextPage,
      previousPage,
      reset,
      limit,
      setLimit
    }
  }
}

/**
 * Search pagination with debouncing
 */
export function createSearchPagination<T>(
  queryKey: (query: string, page: number, limit: number) => readonly unknown[],
  queryFn: (query: string, page: number, limit: number) => Promise<PaginatedResult<T>>,
  debounceMs: number = 300
) {
  return function useSearchPagination() {
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)

    // Debounce search query
    const debounceRef = useRef<NodeJS.Timeout>()
    
    const updateQuery = useCallback((newQuery: string) => {
      setQuery(newQuery)
      
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(newQuery)
        setPage(1) // Reset to first page on new search
      }, debounceMs)
    }, [debounceMs])

    const searchQuery = useQuery({
      queryKey: queryKey(debouncedQuery, page, limit),
      queryFn: () => queryFn(debouncedQuery, page, limit),
      enabled: debouncedQuery.length > 0,
      staleTime: 5 * 60 * 1000
    })

    const totalPages = searchQuery.data ? Math.ceil(searchQuery.data.total / limit) : 0
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    const nextPage = useCallback(() => {
      if (hasNextPage) {
        setPage(page + 1)
      }
    }, [hasNextPage, page])

    const previousPage = useCallback(() => {
      if (hasPreviousPage) {
        setPage(page - 1)
      }
    }, [hasPreviousPage, page])

    const goToPage = useCallback((targetPage: number) => {
      const validPage = Math.max(1, Math.min(targetPage, totalPages))
      setPage(validPage)
    }, [totalPages])

    const clear = useCallback(() => {
      setQuery('')
      setDebouncedQuery('')
      setPage(1)
    }, [])

    return {
      ...searchQuery,
      data: searchQuery.data?.data || [],
      query,
      isSearching: query !== debouncedQuery,
      page,
      limit,
      totalPages,
      total: searchQuery.data?.total || 0,
      hasNextPage,
      hasPreviousPage,
      setQuery: updateQuery,
      setPage,
      setLimit,
      nextPage,
      previousPage,
      goToPage,
      clear
    }
  }
}

/**
 * Virtual pagination for large lists
 */
export function createVirtualPagination<T>(
  data: T[],
  itemHeight: number,
  containerHeight: number
) {
  return function useVirtualPagination() {
    const [scrollTop, setScrollTop] = useState(0)

    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const totalHeight = data.length * itemHeight
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(startIndex + visibleCount, data.length)

    const visibleItems = useMemo(() => {
      return data.slice(startIndex, endIndex).map((item, index) => ({
        item,
        index: startIndex + index,
        top: (startIndex + index) * itemHeight
      }))
    }, [data, startIndex, endIndex, itemHeight])

    const scrollToIndex = useCallback((index: number) => {
      const targetScrollTop = index * itemHeight
      setScrollTop(Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight)))
    }, [itemHeight, totalHeight, containerHeight])

    const handleScroll = useCallback((event: React.UIEvent) => {
      setScrollTop(event.currentTarget.scrollTop)
    }, [])

    return {
      visibleItems,
      totalHeight,
      scrollTop,
      startIndex,
      endIndex,
      visibleCount,
      scrollToIndex,
      handleScroll
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate page numbers for pagination UI
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | '...')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = []
  const sidePages = Math.floor((maxVisible - 3) / 2) // Reserve space for first, last, and ellipsis

  if (currentPage <= sidePages + 2) {
    // Near the beginning
    for (let i = 1; i <= maxVisible - 2; i++) {
      pages.push(i)
    }
    pages.push('...')
    pages.push(totalPages)
  } else if (currentPage >= totalPages - sidePages - 1) {
    // Near the end
    pages.push(1)
    pages.push('...')
    for (let i = totalPages - maxVisible + 3; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // In the middle
    pages.push(1)
    pages.push('...')
    for (let i = currentPage - sidePages; i <= currentPage + sidePages; i++) {
      pages.push(i)
    }
    pages.push('...')
    pages.push(totalPages)
  }

  return pages
}

/**
 * Calculate offset from page and limit
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit
}

/**
 * Calculate page from offset and limit
 */
export function calculatePage(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: number, limit: number, total: number) {
  const maxPage = Math.ceil(total / limit) || 1
  return {
    isValid: page >= 1 && page <= maxPage && limit > 0,
    normalizedPage: Math.max(1, Math.min(page, maxPage)),
    normalizedLimit: Math.max(1, limit),
    maxPage
  }
}