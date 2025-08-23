/**
 * Search Hook Factory
 * Creates powerful search and filter hooks with debouncing, caching, and auto-complete
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions
} from '@tanstack/react-query'
import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { useDebounce } from '../utility-hooks/use-debounce'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types
// ============================================================================

export interface SearchParams {
  query: string
  filters?: Record<string, any>
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface SearchResult<T> {
  results: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  query: string
  executionTime?: number
}

export interface SearchApiClient<TEntity, TFilters = Record<string, any>> {
  search: (client: any, params: SearchParams & TFilters) => Promise<SearchResult<TEntity>>
  suggest?: (client: any, query: string) => Promise<string[]>
  facets?: (client: any, filters: TFilters) => Promise<Record<string, Array<{ value: any; count: number }>>>
}

export interface SearchHookConfig<TEntity, TFilters = Record<string, any>> {
  entityName: string
  queryKeys: {
    search: (params: SearchParams & TFilters) => readonly unknown[]
    suggest?: (query: string) => readonly unknown[]
    facets?: (filters: TFilters) => readonly unknown[]
  }
  apiClient: SearchApiClient<TEntity, TFilters>
  debounceMs?: number
  minQueryLength?: number
  staleTime?: number
  cacheTime?: number
  enableSuggestions?: boolean
  enableFacets?: boolean
}

// ============================================================================
// Main Factory
// ============================================================================

export function createSearchHooks<
  TEntity extends { id: number },
  TFilters = Record<string, any>
>(config: SearchHookConfig<TEntity, TFilters>) {
  const {
    entityName,
    queryKeys,
    apiClient,
    debounceMs = 300,
    minQueryLength = 2,
    staleTime = 1 * 60 * 1000, // 1 minute
    cacheTime = 5 * 60 * 1000, // 5 minutes
    enableSuggestions = false,
    enableFacets = false
  } = config

  // ============================================================================
  // Search Hook with Debouncing
  // ============================================================================

  function useSearch(
    initialParams?: Partial<SearchParams & TFilters>,
    options?: UseQueryOptions<SearchResult<TEntity>, ApiError>
  ) {
    const [searchParams, setSearchParams] = useState<SearchParams & TFilters>({
      query: '',
      page: 1,
      limit: 20,
      ...initialParams
    } as SearchParams & TFilters)

    const debouncedQuery = useDebounce(searchParams.query, debounceMs)

    const queryResult = useQuery({
      queryKey: queryKeys.search({ ...searchParams, query: debouncedQuery }),
      queryFn: () => apiClient.search(undefined, { ...searchParams, query: debouncedQuery }),
      enabled: debouncedQuery.length >= minQueryLength || debouncedQuery.length === 0,
      staleTime,
      gcTime: cacheTime,
      keepPreviousData: true, // Keep previous results while loading new ones
      ...options
    })

    const search = useCallback((query: string) => {
      setSearchParams(prev => ({ ...prev, query, page: 1 }))
    }, [])

    const setFilters = useCallback((filters: Partial<TFilters>) => {
      setSearchParams(prev => ({ ...prev, ...filters, page: 1 }))
    }, [])

    const setSort = useCallback((sort: string, order: 'asc' | 'desc' = 'desc') => {
      setSearchParams(prev => ({ ...prev, sort, order }))
    }, [])

    const nextPage = useCallback(() => {
      setSearchParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))
    }, [])

    const previousPage = useCallback(() => {
      setSearchParams(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))
    }, [])

    const setPage = useCallback((page: number) => {
      setSearchParams(prev => ({ ...prev, page }))
    }, [])

    const reset = useCallback(() => {
      setSearchParams({
        query: '',
        page: 1,
        limit: 20,
        ...initialParams
      } as SearchParams & TFilters)
    }, [initialParams])

    return {
      ...queryResult,
      searchParams,
      search,
      setFilters,
      setSort,
      nextPage,
      previousPage,
      setPage,
      reset,
      isSearching: queryResult.isFetching,
      hasResults: (queryResult.data?.results.length ?? 0) > 0
    }
  }

  // ============================================================================
  // Auto-complete / Suggestions Hook
  // ============================================================================

  function useSuggestions(
    query: string,
    options?: UseQueryOptions<string[], ApiError>
  ) {
    if (!enableSuggestions || !apiClient.suggest) {
      throw new Error(`Suggestions not enabled for ${entityName}`)
    }

    const debouncedQuery = useDebounce(query, debounceMs)

    return useQuery({
      queryKey: queryKeys.suggest?.(debouncedQuery) || ['search', entityName, 'suggest', debouncedQuery],
      queryFn: () => apiClient.suggest!(undefined, debouncedQuery),
      enabled: debouncedQuery.length >= minQueryLength,
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 2 * 60 * 1000, // 2 minutes
      ...options
    })
  }

  // ============================================================================
  // Faceted Search Hook
  // ============================================================================

  function useFacets(
    filters: TFilters,
    options?: UseQueryOptions<Record<string, Array<{ value: any; count: number }>>, ApiError>
  ) {
    if (!enableFacets || !apiClient.facets) {
      throw new Error(`Facets not enabled for ${entityName}`)
    }

    return useQuery({
      queryKey: queryKeys.facets?.(filters) || ['search', entityName, 'facets', filters],
      queryFn: () => apiClient.facets!(undefined, filters),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      ...options
    })
  }

  // ============================================================================
  // Advanced Search with History
  // ============================================================================

  function useSearchWithHistory() {
    const [history, setHistory] = useState<string[]>([])
    const maxHistorySize = 10

    const search = useSearch()

    const addToHistory = useCallback((query: string) => {
      if (!query.trim()) return
      
      setHistory(prev => {
        const filtered = prev.filter(q => q !== query)
        const newHistory = [query, ...filtered].slice(0, maxHistorySize)
        // Optionally persist to localStorage
        localStorage.setItem(`search-history-${entityName}`, JSON.stringify(newHistory))
        return newHistory
      })
    }, [])

    const clearHistory = useCallback(() => {
      setHistory([])
      localStorage.removeItem(`search-history-${entityName}`)
    }, [])

    // Load history from localStorage on mount
    useEffect(() => {
      const stored = localStorage.getItem(`search-history-${entityName}`)
      if (stored) {
        try {
          setHistory(JSON.parse(stored))
        } catch (e) {
          console.error('Failed to load search history:', e)
        }
      }
    }, [])

    // Add to history when search is performed
    const enhancedSearch = useCallback((query: string) => {
      search.search(query)
      if (query.trim()) {
        addToHistory(query)
      }
    }, [search, addToHistory])

    return {
      ...search,
      search: enhancedSearch,
      history,
      clearHistory
    }
  }

  // ============================================================================
  // Instant Search Hook (no debounce, for controlled inputs)
  // ============================================================================

  function useInstantSearch(
    params: SearchParams & TFilters,
    options?: UseQueryOptions<SearchResult<TEntity>, ApiError>
  ) {
    return useQuery({
      queryKey: queryKeys.search(params),
      queryFn: () => apiClient.search(undefined, params),
      enabled: params.query.length >= minQueryLength || params.query.length === 0,
      staleTime: 30 * 1000, // 30 seconds for instant search
      gcTime: 2 * 60 * 1000,
      ...options
    })
  }

  // ============================================================================
  // Prefetch Search Results
  // ============================================================================

  function usePrefetchSearch() {
    const queryClient = useQueryClient()

    return {
      prefetchSearch: (params: SearchParams & TFilters) => {
        return queryClient.prefetchQuery({
          queryKey: queryKeys.search(params),
          queryFn: () => apiClient.search(undefined, params),
          staleTime
        })
      },
      prefetchSuggestions: (query: string) => {
        if (!apiClient.suggest) return Promise.resolve()
        
        return queryClient.prefetchQuery({
          queryKey: queryKeys.suggest?.(query) || ['search', entityName, 'suggest', query],
          queryFn: () => apiClient.suggest!(undefined, query),
          staleTime: 30 * 1000
        })
      }
    }
  }

  // ============================================================================
  // Combined Search and Filter Hook
  // ============================================================================

  function useAdvancedSearch() {
    const [state, setState] = useState({
      query: '',
      filters: {} as TFilters,
      sort: undefined as string | undefined,
      order: 'desc' as 'asc' | 'desc',
      page: 1,
      limit: 20
    })

    const debouncedQuery = useDebounce(state.query, debounceMs)
    
    const searchParams = useMemo(() => ({
      ...state,
      query: debouncedQuery
    }), [state, debouncedQuery])

    const queryResult = useQuery({
      queryKey: queryKeys.search(searchParams as SearchParams & TFilters),
      queryFn: () => apiClient.search(undefined, searchParams as SearchParams & TFilters),
      enabled: debouncedQuery.length >= minQueryLength || debouncedQuery.length === 0,
      staleTime,
      gcTime: cacheTime,
      keepPreviousData: true
    })

    const facetsResult = useFacets(state.filters, {
      enabled: enableFacets && Object.keys(state.filters).length > 0
    })

    const suggestionsResult = useSuggestions(state.query, {
      enabled: enableSuggestions && state.query.length >= minQueryLength
    })

    const updateState = useCallback((updates: Partial<typeof state>) => {
      setState(prev => ({
        ...prev,
        ...updates,
        // Reset page when query or filters change
        page: updates.query !== undefined || updates.filters !== undefined ? 1 : updates.page || prev.page
      }))
    }, [])

    return {
      // State
      state,
      searchParams,
      
      // Results
      searchResults: queryResult.data,
      facets: facetsResult.data,
      suggestions: suggestionsResult.data,
      
      // Loading states
      isSearching: queryResult.isFetching,
      isLoadingFacets: facetsResult.isFetching,
      isLoadingSuggestions: suggestionsResult.isFetching,
      
      // Actions
      search: (query: string) => updateState({ query }),
      setFilters: (filters: Partial<TFilters>) => updateState({ filters: { ...state.filters, ...filters } }),
      clearFilters: () => updateState({ filters: {} as TFilters }),
      setSort: (sort: string, order?: 'asc' | 'desc') => updateState({ sort, order }),
      setPage: (page: number) => updateState({ page }),
      setLimit: (limit: number) => updateState({ limit, page: 1 }),
      nextPage: () => updateState({ page: state.page + 1 }),
      previousPage: () => updateState({ page: Math.max(1, state.page - 1) }),
      reset: () => setState({
        query: '',
        filters: {} as TFilters,
        sort: undefined,
        order: 'desc',
        page: 1,
        limit: 20
      }),
      
      // Computed
      hasResults: (queryResult.data?.results.length ?? 0) > 0,
      hasMore: queryResult.data?.hasMore ?? false,
      totalResults: queryResult.data?.total ?? 0,
      totalPages: Math.ceil((queryResult.data?.total ?? 0) / state.limit)
    }
  }

  return {
    useSearch,
    useSuggestions,
    useFacets,
    useSearchWithHistory,
    useInstantSearch,
    usePrefetchSearch,
    useAdvancedSearch
  }
}

// ============================================================================
// Specialized Search Factories
// ============================================================================

/**
 * Create a simple text search hook
 */
export function createTextSearchHook<TEntity extends { id: number }>(
  entityName: string,
  searchFn: (query: string) => Promise<TEntity[]>
) {
  return function useTextSearch(query: string, options?: UseQueryOptions<TEntity[], ApiError>) {
    const debouncedQuery = useDebounce(query, 300)

    return useQuery({
      queryKey: ['search', entityName, debouncedQuery],
      queryFn: () => searchFn(debouncedQuery),
      enabled: debouncedQuery.length >= 2,
      staleTime: 30 * 1000,
      ...options
    })
  }
}

/**
 * Create a filtered list hook
 */
export function createFilteredListHook<TEntity, TFilters>(
  entityName: string,
  listFn: (filters: TFilters) => Promise<TEntity[]>
) {
  return function useFilteredList(filters: TFilters, options?: UseQueryOptions<TEntity[], ApiError>) {
    return useQuery({
      queryKey: ['list', entityName, 'filtered', filters],
      queryFn: () => listFn(filters),
      staleTime: 5 * 60 * 1000,
      ...options
    })
  }
}