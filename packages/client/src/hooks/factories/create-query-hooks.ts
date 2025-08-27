/**
 * Query Hooks Factory - Advanced query patterns beyond basic CRUD
 * 
 * This factory creates specialized query hooks for:
 * - Infinite scrolling with pagination
 * - Search with debouncing
 * - Prefetching strategies
 * - Aggregation queries
 * - Related data loading
 */

import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseInfiniteQueryOptions,
  type UseQueryResult,
  type UseInfiniteQueryResult,
  type InfiniteData
} from '@tanstack/react-query'
import { useApiClient } from '../api/use-api-client'
import { useState, useEffect, useRef } from 'react'
import { createQueryKeys, getStaleTimeForDomain, type QueryKeyFactory } from './query-key-factory'

/**
 * Debounce hook for search queries
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Configuration for query hooks
 */
export interface QueryHookConfig<TEntity> {
  /**
   * Display name for the entity
   */
  entityName: string
  
  /**
   * Path to the API client methods
   */
  clientPath: string
  
  /**
   * Custom query keys
   */
  queryKeys?: QueryKeyFactory
  
  /**
   * Hook options
   */
  options?: {
    /**
     * Stale time in milliseconds
     */
    staleTime?: number
    
    /**
     * Default page size for pagination
     */
    pageSize?: number
    
    /**
     * Debounce delay for search in milliseconds
     */
    searchDebounceMs?: number
    
    /**
     * Minimum search query length
     */
    minSearchLength?: number
    
    /**
     * Enable cursor-based pagination
     */
    useCursor?: boolean
  }
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: any
}

/**
 * Cursor pagination parameters
 */
export interface CursorPaginationParams {
  cursor?: string
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: any
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[]
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  hasMore?: boolean
  nextCursor?: string
  prevCursor?: string
}

/**
 * Query hooks return type
 */
export interface QueryHooks<TEntity> {
  // Infinite scrolling
  useInfiniteQuery: (
    params?: PaginationParams | CursorPaginationParams,
    options?: UseInfiniteQueryOptions<PaginatedResponse<TEntity>>
  ) => UseInfiniteQueryResult<InfiniteData<PaginatedResponse<TEntity>>, Error>
  
  // Search with debouncing
  useSearch: (
    searchTerm: string,
    options?: UseQueryOptions<TEntity[]>
  ) => UseQueryResult<TEntity[], Error> & { debouncedSearch: string }
  
  // Aggregation queries
  useCount: (params?: any, options?: UseQueryOptions<number>) => UseQueryResult<number, Error>
  useStats: (params?: any, options?: UseQueryOptions<any>) => UseQueryResult<any, Error>
  
  // Related data queries
  useRelated: <TRelated = any>(
    id: number | string,
    relation: string,
    options?: UseQueryOptions<TRelated>
  ) => UseQueryResult<TRelated, Error>
  
  // Prefetch utilities
  usePrefetch: () => {
    prefetchList: (params?: any) => Promise<void>
    prefetchDetail: (id: number | string) => Promise<void>
    prefetchRelated: (id: number | string, relation: string) => Promise<void>
    prefetchMany: (ids: (number | string)[]) => Promise<void>
  }
  
  // Batch queries
  useMany: (
    ids: (number | string)[],
    options?: UseQueryOptions<TEntity[]>
  ) => UseQueryResult<TEntity[], Error>
  
  // Query by field
  useByField: <K extends keyof TEntity>(
    field: K,
    value: TEntity[K],
    options?: UseQueryOptions<TEntity[]>
  ) => UseQueryResult<TEntity[], Error>
}

/**
 * Create advanced query hooks
 */
export function createQueryHooks<TEntity extends { id: number | string }>(
  config: QueryHookConfig<TEntity>
): QueryHooks<TEntity> {
  const {
    entityName,
    clientPath,
    options = {}
  } = config

  // Create query keys
  const KEYS = config.queryKeys || createQueryKeys(clientPath)
  
  // Determine stale time
  const staleTime = options.staleTime || getStaleTimeForDomain(clientPath)
  
  // Default options
  const pageSize = options.pageSize || 20
  const searchDebounceMs = options.searchDebounceMs || 300
  const minSearchLength = options.minSearchLength || 2

  /**
   * Infinite query hook with pagination
   */
  const useInfiniteQuery = (
    params?: PaginationParams | CursorPaginationParams,
    queryOptions?: UseInfiniteQueryOptions<PaginatedResponse<TEntity>>
  ) => {
    const client = useApiClient()
    
    return useInfiniteQuery({
      queryKey: KEYS.infinite(params),
      queryFn: async ({ pageParam }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        // Determine pagination type
        if (options.useCursor) {
          // Cursor-based pagination
          const cursorParams = {
            ...params,
            cursor: pageParam as string | undefined,
            limit: (params as CursorPaginationParams)?.limit || pageSize
          }
          
          if (!api?.listWithCursor) {
            throw new Error(`API client missing listWithCursor method for ${clientPath}`)
          }
          
          const response = await api.listWithCursor(cursorParams)
          return response.data || response
        } else {
          // Page-based pagination
          const pageParams = {
            ...params,
            page: pageParam as number,
            pageSize: (params as PaginationParams)?.pageSize || pageSize
          }
          
          if (!api?.listPaginated) {
            // Fallback to regular list if paginated method doesn't exist
            if (!api?.list) {
              throw new Error(`API client missing list method for ${clientPath}`)
            }
            const response = await api.list(pageParams)
            // Wrap in paginated response structure
            return {
              data: response.data || response,
              page: pageParam as number,
              pageSize: pageParams.pageSize,
              hasMore: false // Can't determine without total count
            }
          }
          
          const response = await api.listPaginated(pageParams)
          return response.data || response
        }
      },
      getNextPageParam: (lastPage) => {
        if (options.useCursor) {
          // Cursor-based
          return lastPage.hasMore ? lastPage.nextCursor : undefined
        } else {
          // Page-based
          if (lastPage.hasMore) {
            return ((lastPage.page || 0) + 1)
          }
          if (lastPage.totalPages && lastPage.page) {
            return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
          }
          return undefined
        }
      },
      getPreviousPageParam: (firstPage) => {
        if (options.useCursor) {
          // Cursor-based
          return firstPage.prevCursor
        } else {
          // Page-based
          const page = firstPage.page || 1
          return page > 1 ? page - 1 : undefined
        }
      },
      initialPageParam: options.useCursor ? undefined : 1,
      staleTime,
      ...queryOptions
    } as any)
  }

  /**
   * Search hook with debouncing
   */
  const useSearch = (
    searchTerm: string,
    queryOptions?: UseQueryOptions<TEntity[]>
  ) => {
    const client = useApiClient()
    const debouncedSearch = useDebounce(searchTerm, searchDebounceMs)
    
    const query = useQuery({
      queryKey: KEYS.search(debouncedSearch),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        if (!api?.search) {
          throw new Error(`API client missing search method for ${clientPath}`)
        }
        
        const response = await api.search(debouncedSearch)
        return response.data || response
      },
      enabled: debouncedSearch.length >= minSearchLength && !!client,
      staleTime: staleTime / 2, // Search results are more volatile
      ...queryOptions
    })

    return {
      ...query,
      debouncedSearch
    }
  }

  /**
   * Count query hook
   */
  const useCount = (params?: any, queryOptions?: UseQueryOptions<number>) => {
    const client = useApiClient()
    
    return useQuery({
      queryKey: [...KEYS.count(), params],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        if (!api?.count) {
          // Fallback to list and count locally
          if (!api?.list) {
            throw new Error(`API client missing count/list method for ${clientPath}`)
          }
          const response = await api.list(params)
          const data = response.data || response
          return Array.isArray(data) ? data.length : 0
        }
        
        const response = await api.count(params)
        return response.data || response || 0
      },
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Stats query hook
   */
  const useStats = (params?: any, queryOptions?: UseQueryOptions<any>) => {
    const client = useApiClient()
    
    return useQuery({
      queryKey: [...KEYS.stats(), params],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        if (!api?.stats) {
          throw new Error(`API client missing stats method for ${clientPath}`)
        }
        
        const response = await api.stats(params)
        return response.data || response
      },
      staleTime: staleTime * 2, // Stats change less frequently
      ...queryOptions
    })
  }

  /**
   * Related data query hook
   */
  const useRelated = <TRelated = any>(
    id: number | string,
    relation: string,
    queryOptions?: UseQueryOptions<TRelated>
  ) => {
    const client = useApiClient()
    
    return useQuery({
      queryKey: KEYS.related(id, relation),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        // Try specific relation method first
        const relationMethod = `get${relation.charAt(0).toUpperCase()}${relation.slice(1)}`
        if (api?.[relationMethod]) {
          const response = await api[relationMethod](id)
          return response.data || response
        }
        
        // Fallback to generic getRelated
        if (!api?.getRelated) {
          throw new Error(`API client missing ${relationMethod} or getRelated method for ${clientPath}`)
        }
        
        const response = await api.getRelated(id, relation)
        return response.data || response
      },
      enabled: !!id && !!relation && !!client,
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Batch query hook - fetch multiple entities by IDs
   */
  const useMany = (
    ids: (number | string)[],
    queryOptions?: UseQueryOptions<TEntity[]>
  ) => {
    const client = useApiClient()
    
    return useQuery({
      queryKey: [...KEYS.all, 'many', ids],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        if (api?.getMany) {
          const response = await api.getMany(ids)
          return response.data || response
        }
        
        // Fallback to fetching individually
        if (!api?.get) {
          throw new Error(`API client missing getMany/get method for ${clientPath}`)
        }
        
        const promises = ids.map(id => api.get(id))
        const responses = await Promise.all(promises)
        return responses.map(r => r.data || r)
      },
      enabled: ids.length > 0 && !!client,
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Query by field hook
   */
  const useByField = <K extends keyof TEntity>(
    field: K,
    value: TEntity[K],
    queryOptions?: UseQueryOptions<TEntity[]>
  ) => {
    const client = useApiClient()
    
    return useQuery({
      queryKey: KEYS.byField(String(field), value),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        
        // Try specific getByField method
        const byFieldMethod = `getBy${String(field).charAt(0).toUpperCase()}${String(field).slice(1)}`
        if (api?.[byFieldMethod]) {
          const response = await api[byFieldMethod](value)
          return response.data || response
        }
        
        // Fallback to list with filter
        if (!api?.list) {
          throw new Error(`API client missing ${byFieldMethod} or list method for ${clientPath}`)
        }
        
        const response = await api.list({ [field]: value })
        return response.data || response
      },
      enabled: value !== undefined && value !== null && !!client,
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Prefetch utilities
   */
  const usePrefetch = () => {
    const queryClient = useQueryClient()
    const client = useApiClient()
    
    return {
      prefetchList: async (params?: any) => {
        if (!client) return
        const api = (client as any)[clientPath]
        if (!api?.list) return
        
        return queryClient.prefetchQuery({
          queryKey: KEYS.list(params),
          queryFn: async () => {
            const response = await api.list(params)
            return response.data || response
          },
          staleTime
        })
      },
      
      prefetchDetail: async (id: number | string) => {
        if (!client) return
        const api = (client as any)[clientPath]
        if (!api?.get) return
        
        return queryClient.prefetchQuery({
          queryKey: KEYS.detail(id),
          queryFn: async () => {
            const response = await api.get(id)
            return response.data || response
          },
          staleTime
        })
      },
      
      prefetchRelated: async (id: number | string, relation: string) => {
        if (!client) return
        const api = (client as any)[clientPath]
        const relationMethod = `get${relation.charAt(0).toUpperCase()}${relation.slice(1)}`
        
        if (!api?.[relationMethod] && !api?.getRelated) return
        
        return queryClient.prefetchQuery({
          queryKey: KEYS.related(id, relation),
          queryFn: async () => {
            if (api[relationMethod]) {
              const response = await api[relationMethod](id)
              return response.data || response
            }
            const response = await api.getRelated(id, relation)
            return response.data || response
          },
          staleTime
        })
      },
      
      prefetchMany: async (ids: (number | string)[]) => {
        if (!client || ids.length === 0) return
        const api = (client as any)[clientPath]
        
        if (api?.getMany) {
          return queryClient.prefetchQuery({
            queryKey: [...KEYS.all, 'many', ids],
            queryFn: async () => {
              const response = await api.getMany(ids)
              return response.data || response
            },
            staleTime
          })
        }
        
        // Prefetch individually
        if (api?.get) {
          return Promise.all(
            ids.map(id => 
              queryClient.prefetchQuery({
                queryKey: KEYS.detail(id),
                queryFn: async () => {
                  const response = await api.get(id)
                  return response.data || response
                },
                staleTime
              })
            )
          )
        }
      }
    }
  }

  return {
    useInfiniteQuery,
    useSearch,
    useCount,
    useStats,
    useRelated,
    useMany,
    useByField,
    usePrefetch
  }
}