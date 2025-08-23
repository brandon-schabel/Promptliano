/**
 * Infinite Scroll Factory
 * Creates infinite scrolling patterns with React Query integration
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  type InfiniteData
} from '@tanstack/react-query'

// ============================================================================
// Types
// ============================================================================

export interface InfiniteScrollParams {
  limit?: number
  cursor?: string | number | null
  sort?: string
  order?: 'asc' | 'desc'
}

export interface InfiniteScrollResult<T> {
  data: T[]
  nextCursor?: string | number | null
  hasMore: boolean
  total?: number
}

export interface InfiniteScrollConfig<T, TParams = void> {
  queryKey: (params?: TParams) => readonly unknown[]
  queryFn: (params: TParams & InfiniteScrollParams) => Promise<InfiniteScrollResult<T>>
  getNextPageParam: (lastPage: InfiniteScrollResult<T>, pages: InfiniteScrollResult<T>[]) => any
  defaultLimit?: number
  enabled?: boolean
  staleTime?: number
  threshold?: number // Distance from bottom to trigger load
  rootMargin?: string // For intersection observer
}

export interface InfiniteScrollState {
  isLoading: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  error: Error | null
  totalItems: number
}

export interface InfiniteScrollActions {
  fetchNextPage: () => Promise<any>
  refresh: () => void
  reset: () => void
  loadMore: () => void
}

// ============================================================================
// Main Infinite Scroll Factory
// ============================================================================

export function createInfiniteScrollHooks<T, TParams = void>(
  config: InfiniteScrollConfig<T, TParams>
) {
  return function useInfiniteScroll(
    params?: TParams,
    options?: UseInfiniteQueryOptions<InfiniteScrollResult<T>>
  ) {
    const {
      queryKey,
      queryFn,
      getNextPageParam,
      defaultLimit = 20,
      enabled = true,
      staleTime = 5 * 60 * 1000,
      threshold = 100,
      rootMargin = '100px'
    } = config

    // Internal state
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const lastElementRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)

    // Query with cursor-based pagination
    const query = useInfiniteQuery({
      queryKey: queryKey(params),
      queryFn: ({ pageParam }) => queryFn({
        ...params,
        cursor: pageParam,
        limit: defaultLimit
      } as TParams & InfiniteScrollParams),
      getNextPageParam,
      initialPageParam: null,
      enabled,
      staleTime,
      ...options
    })

    // Flatten all pages into single array
    const allData = query.data?.pages.flatMap(page => page.data) || []

    // Computed state
    const state: InfiniteScrollState = {
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isFetchingNextPage: query.isFetchingNextPage,
      hasNextPage: query.hasNextPage || false,
      error: query.error,
      totalItems: allData.length
    }

    // Load more function
    const loadMore = useCallback(async () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        setIsLoadingMore(true)
        try {
          await query.fetchNextPage()
        } finally {
          setIsLoadingMore(false)
        }
      }
    }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage])

    // Actions
    const actions: InfiniteScrollActions = {
      fetchNextPage: query.fetchNextPage,
      refresh: () => query.refetch(),
      reset: () => query.remove(),
      loadMore
    }

    // Intersection Observer for automatic loading
    useEffect(() => {
      if (!lastElementRef.current || !query.hasNextPage) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const lastEntry = entries[0]
          if (lastEntry.isIntersecting && !query.isFetchingNextPage) {
            loadMore()
          }
        },
        {
          rootMargin,
          threshold: 0.1
        }
      )

      observerRef.current.observe(lastElementRef.current)

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
      }
    }, [query.hasNextPage, query.isFetchingNextPage, loadMore, rootMargin])

    return {
      ...query,
      data: allData,
      state,
      actions,
      isLoadingMore,
      lastElementRef
    }
  }
}

// ============================================================================
// Specialized Infinite Scroll Hooks
// ============================================================================

/**
 * Offset-based infinite scroll
 */
export function createOffsetInfiniteScroll<T>(
  queryKey: (offset: number, limit: number) => readonly unknown[],
  queryFn: (offset: number, limit: number) => Promise<{ data: T[]; total: number; hasMore: boolean }>,
  defaultLimit: number = 20
) {
  return function useOffsetInfiniteScroll() {
    const query = useInfiniteQuery({
      queryKey: ['offset-infinite', ...queryKey(0, defaultLimit)],
      queryFn: ({ pageParam = 0 }) => queryFn(pageParam, defaultLimit),
      getNextPageParam: (lastPage, pages) => {
        return lastPage.hasMore ? pages.length * defaultLimit : undefined
      },
      initialPageParam: 0,
      staleTime: 5 * 60 * 1000
    })

    const allData = query.data?.pages.flatMap(page => page.data) || []
    const total = query.data?.pages[0]?.total || 0

    return {
      ...query,
      data: allData,
      total,
      loadMore: query.fetchNextPage,
      hasMore: query.hasNextPage
    }
  }
}

/**
 * Time-based infinite scroll (for chronological data)
 */
export function createTimeBasedInfiniteScroll<T extends { createdAt: string | number }>(
  queryKey: (before?: string | number, limit?: number) => readonly unknown[],
  queryFn: (before: string | number | null, limit: number) => Promise<InfiniteScrollResult<T>>,
  defaultLimit: number = 20
) {
  return function useTimeBasedInfiniteScroll() {
    const query = useInfiniteQuery({
      queryKey: queryKey(undefined, defaultLimit),
      queryFn: ({ pageParam }) => queryFn(pageParam, defaultLimit),
      getNextPageParam: (lastPage) => {
        if (!lastPage.hasMore || lastPage.data.length === 0) return undefined
        
        // Use the oldest item's timestamp as the cursor
        const oldestItem = lastPage.data[lastPage.data.length - 1]
        return oldestItem.createdAt
      },
      initialPageParam: null,
      staleTime: 5 * 60 * 1000
    })

    const allData = query.data?.pages.flatMap(page => page.data) || []

    return {
      ...query,
      data: allData,
      loadMore: query.fetchNextPage,
      hasMore: query.hasNextPage,
      oldest: allData[allData.length - 1]?.createdAt,
      newest: allData[0]?.createdAt
    }
  }
}

/**
 * Search infinite scroll with debouncing
 */
export function createSearchInfiniteScroll<T>(
  queryKey: (query: string, cursor?: any) => readonly unknown[],
  queryFn: (query: string, cursor: any, limit: number) => Promise<InfiniteScrollResult<T>>,
  debounceMs: number = 300,
  defaultLimit: number = 20
) {
  return function useSearchInfiniteScroll() {
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const debounceRef = useRef<NodeJS.Timeout>()

    // Debounce search query
    const updateQuery = useCallback((newQuery: string) => {
      setQuery(newQuery)
      
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(newQuery)
      }, debounceMs)
    }, [debounceMs])

    const infiniteQuery = useInfiniteQuery({
      queryKey: queryKey(debouncedQuery),
      queryFn: ({ pageParam }) => queryFn(debouncedQuery, pageParam, defaultLimit),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialPageParam: null,
      enabled: debouncedQuery.length > 0,
      staleTime: 5 * 60 * 1000
    })

    const allData = infiniteQuery.data?.pages.flatMap(page => page.data) || []

    const clear = useCallback(() => {
      setQuery('')
      setDebouncedQuery('')
    }, [])

    return {
      ...infiniteQuery,
      data: allData,
      query,
      setQuery: updateQuery,
      clear,
      isSearching: query !== debouncedQuery,
      loadMore: infiniteQuery.fetchNextPage,
      hasMore: infiniteQuery.hasNextPage
    }
  }
}

/**
 * Bidirectional infinite scroll (load more above and below)
 */
export function createBidirectionalInfiniteScroll<T extends { id: string | number }>(
  queryKey: (cursor?: any, direction?: 'before' | 'after') => readonly unknown[],
  queryFn: (cursor: any, direction: 'before' | 'after', limit: number) => Promise<{
    data: T[]
    nextCursor?: any
    previousCursor?: any
    hasMore: boolean
    hasPrevious: boolean
  }>,
  defaultLimit: number = 20
) {
  return function useBidirectionalInfiniteScroll() {
    const [direction, setDirection] = useState<'before' | 'after'>('after')

    const query = useInfiniteQuery({
      queryKey: queryKey(undefined, direction),
      queryFn: ({ pageParam }) => queryFn(pageParam, direction, defaultLimit),
      getNextPageParam: (lastPage) => {
        return direction === 'after' ? lastPage.nextCursor : lastPage.previousCursor
      },
      initialPageParam: null,
      staleTime: 5 * 60 * 1000
    })

    const allData = query.data?.pages.flatMap(page => page.data) || []

    const loadNewer = useCallback(() => {
      setDirection('before')
      query.fetchNextPage()
    }, [query])

    const loadOlder = useCallback(() => {
      setDirection('after')
      query.fetchNextPage()
    }, [query])

    return {
      ...query,
      data: allData,
      loadNewer,
      loadOlder,
      direction,
      hasNewer: query.data?.pages[0]?.hasPrevious || false,
      hasOlder: query.hasNextPage
    }
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Scroll position tracking
 */
export function useScrollPosition(threshold: number = 100) {
  const [isNearBottom, setIsNearBottom] = useState(false)
  const [scrollPercentage, setScrollPercentage] = useState(0)

  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const docHeight = document.documentElement.scrollHeight
    
    const scrolled = (scrollTop / (docHeight - windowHeight)) * 100
    setScrollPercentage(Math.min(100, Math.max(0, scrolled)))
    
    const distanceFromBottom = docHeight - (scrollTop + windowHeight)
    setIsNearBottom(distanceFromBottom <= threshold)
  }, [threshold])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  return {
    isNearBottom,
    scrollPercentage
  }
}

/**
 * Virtual scrolling for infinite lists
 */
export function useVirtualInfiniteScroll<T>(
  data: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    data.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = data.slice(startIndex, endIndex).map((item, index) => ({
    item,
    index: startIndex + index,
    top: (startIndex + index) * itemHeight
  }))

  const totalHeight = data.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((event: React.UIEvent) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  const scrollToIndex = useCallback((index: number) => {
    const targetScrollTop = index * itemHeight
    setScrollTop(targetScrollTop)
  }, [itemHeight])

  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    handleScroll,
    scrollToIndex
  }
}

/**
 * Auto-load more when scrolling
 */
export function useAutoLoad(
  loadMore: () => void,
  hasMore: boolean,
  threshold: number = 200
) {
  const { isNearBottom } = useScrollPosition(threshold)

  useEffect(() => {
    if (isNearBottom && hasMore) {
      loadMore()
    }
  }, [isNearBottom, hasMore, loadMore])

  return {
    isNearBottom
  }
}

/**
 * Pull to refresh functionality
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  threshold: number = 100
) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const startY = useRef(0)
  const currentY = useRef(0)

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = event.touches[0].clientY
      setIsPulling(true)
    }
  }, [])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!isPulling) return

    currentY.current = event.touches[0].clientY
    const diff = currentY.current - startY.current

    if (diff > 0) {
      setPullDistance(Math.min(diff, threshold * 1.5))
      if (diff > threshold) {
        event.preventDefault()
      }
    }
  }, [isPulling, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return

    setIsPulling(false)

    if (pullDistance > threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }

    setPullDistance(0)
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    shouldShowRefreshIndicator: pullDistance > threshold || isRefreshing
  }
}