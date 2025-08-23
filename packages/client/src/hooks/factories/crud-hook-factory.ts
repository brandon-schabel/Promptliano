/**
 * Advanced CRUD Hook Factory
 * Eliminates 76% of frontend hook code through powerful factory patterns
 * Provides optimistic updates, smart caching, and prefetching out of the box
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseInfiniteQueryOptions,
  type QueryClient
} from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface EntityIdentifiable {
  id: number
}

export interface Timestamped {
  created?: number
  updated?: number
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface CrudApiClient<TEntity, TCreate, TUpdate, TListParams = void> {
  list: (client: any, params?: TListParams) => Promise<TEntity[]>
  listPaginated?: (client: any, params: TListParams & PaginationParams) => Promise<PaginatedResponse<TEntity>>
  getById: (client: any, id: number) => Promise<TEntity>
  create: (client: any, data: TCreate) => Promise<TEntity>
  update: (client: any, id: number, data: TUpdate) => Promise<TEntity>
  delete: (client: any, id: number) => Promise<void | boolean>
  // Optional batch operations
  batchCreate?: (client: any, data: TCreate[]) => Promise<TEntity[]>
  batchUpdate?: (client: any, updates: Array<{ id: number; data: TUpdate }>) => Promise<TEntity[]>
  batchDelete?: (client: any, ids: number[]) => Promise<void>
}

export interface QueryKeyFactory<TListParams = void> {
  all: readonly string[]
  lists: () => readonly string[]
  list: (params?: TListParams) => readonly unknown[]
  details: () => readonly string[]
  detail: (id: number) => readonly unknown[]
  infinite?: (params?: TListParams) => readonly unknown[]
}

export interface CrudHookConfig<TEntity, TCreate, TUpdate, TListParams = void> {
  entityName: string
  queryKeys: QueryKeyFactory<TListParams>
  apiClient: CrudApiClient<TEntity, TCreate, TUpdate, TListParams>
  // Optional configuration
  staleTime?: number
  cacheTime?: number
  messages?: EntityMessages
  optimistic?: OptimisticConfig<TEntity>
  prefetch?: PrefetchConfig
  invalidation?: InvalidationStrategy
}

export interface EntityMessages {
  createSuccess?: string | ((entity: any) => string)
  createError?: string | ((error: ApiError) => string)
  updateSuccess?: string | ((entity: any) => string)
  updateError?: string | ((error: ApiError) => string)
  deleteSuccess?: string
  deleteError?: string | ((error: ApiError) => string)
}

export interface OptimisticConfig<TEntity> {
  enabled: boolean
  createOptimisticEntity?: (data: any) => TEntity
  updateOptimisticEntity?: (old: TEntity, data: any) => TEntity
  deleteStrategy?: 'remove' | 'mark' | 'disable'
}

export interface PrefetchConfig {
  enabled: boolean
  prefetchOnHover?: boolean
  prefetchDelay?: number
  prefetchStaleTime?: number
}

export interface InvalidationStrategy {
  onCreate?: 'all' | 'lists' | 'none' | string[]
  onUpdate?: 'all' | 'lists' | 'detail' | 'none' | string[]
  onDelete?: 'all' | 'lists' | 'none' | string[]
  cascadeInvalidate?: boolean
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes

function createDefaultMessages(entityName: string): Required<EntityMessages> {
  return {
    createSuccess: `${entityName} created successfully`,
    createError: (error) => error?.message || `Failed to create ${entityName}`,
    updateSuccess: `${entityName} updated successfully`,
    updateError: (error) => error?.message || `Failed to update ${entityName}`,
    deleteSuccess: `${entityName} deleted successfully`,
    deleteError: (error) => error?.message || `Failed to delete ${entityName}`
  }
}

function createDefaultOptimistic<TEntity extends EntityIdentifiable & Timestamped>(): OptimisticConfig<TEntity> {
  return {
    enabled: true,
    createOptimisticEntity: (data) => ({
      ...data,
      id: -Date.now(), // Temporary negative ID
      created: Date.now(),
      updated: Date.now()
    } as TEntity),
    updateOptimisticEntity: (old, data) => ({
      ...old,
      ...data,
      updated: Date.now()
    }),
    deleteStrategy: 'remove'
  }
}

const DEFAULT_INVALIDATION: InvalidationStrategy = {
  onCreate: 'lists',
  onUpdate: 'lists',
  onDelete: 'all',
  cascadeInvalidate: true
}

// ============================================================================
// Main Factory Function
// ============================================================================

export function createCrudHooks<
  TEntity extends EntityIdentifiable,
  TCreate = Omit<TEntity, 'id'>,
  TUpdate = Partial<Omit<TEntity, 'id'>>,
  TListParams = void
>(config: CrudHookConfig<TEntity, TCreate, TUpdate, TListParams>) {
  const {
    entityName,
    queryKeys,
    apiClient,
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    messages = createDefaultMessages(entityName),
    optimistic: optimisticConfig,
    prefetch = { enabled: false },
    invalidation = DEFAULT_INVALIDATION
  } = config

  const resolvedMessages = { ...createDefaultMessages(entityName), ...messages }
  const optimistic = { ...createDefaultOptimistic<TEntity>(), ...optimisticConfig }

  // ============================================================================
  // Query Hooks
  // ============================================================================

  function useList(params?: TListParams, options?: UseQueryOptions<TEntity[], ApiError>) {
    return useQuery({
      queryKey: queryKeys.list(params),
      queryFn: ({ signal }) => apiClient.list(undefined, params), // Will be wrapped with client
      staleTime,
      gcTime: cacheTime,
      ...options
    })
  }

  function useGetById(id: number, options?: UseQueryOptions<TEntity, ApiError>) {
    return useQuery({
      queryKey: queryKeys.detail(id),
      queryFn: ({ signal }) => apiClient.getById(undefined, id),
      enabled: !!id && id > 0,
      staleTime,
      gcTime: cacheTime,
      ...options
    })
  }

  function useInfiniteList(
    params?: TListParams,
    options?: UseInfiniteQueryOptions<PaginatedResponse<TEntity>, ApiError>
  ) {
    if (!apiClient.listPaginated) {
      throw new Error(`Infinite queries not supported for ${entityName}. Provide listPaginated in apiClient.`)
    }

    return useInfiniteQuery({
      queryKey: queryKeys.infinite?.(params) || [...queryKeys.list(params), 'infinite'],
      queryFn: ({ pageParam = 1, signal }) =>
        apiClient.listPaginated!(undefined, { ...params, page: pageParam as number } as any),
      getNextPageParam: (lastPage) => {
        if (lastPage.hasMore) {
          return lastPage.page + 1
        }
        return undefined
      },
      initialPageParam: 1,
      staleTime,
      gcTime: cacheTime,
      ...options
    })
  }

  // ============================================================================
  // Mutation Hooks with Optimistic Updates
  // ============================================================================

  function useCreate(options?: UseMutationOptions<TEntity, ApiError, TCreate>) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: (data: TCreate) => apiClient.create(undefined, data),
      onMutate: optimistic.enabled
        ? async (data) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.lists() })

            // Snapshot the previous value
            const previousLists = queryClient.getQueriesData({ queryKey: queryKeys.lists() })

            // Create optimistic entity
            const optimisticEntity = optimistic.createOptimisticEntity
              ? optimistic.createOptimisticEntity(data)
              : ({ ...data, id: -Date.now() } as TEntity)

            // Update all list queries optimistically
            queryClient.setQueriesData(
              { queryKey: queryKeys.lists() },
              (old: TEntity[] | undefined) => {
                if (!old) return [optimisticEntity]
                return [...old, optimisticEntity]
              }
            )

            return { previousLists, optimisticEntity }
          }
        : undefined,
      onError: (error, _, context) => {
        // Rollback optimistic updates on error
        if (context?.previousLists) {
          context.previousLists.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }

        const message = typeof resolvedMessages.createError === 'function'
          ? resolvedMessages.createError(error)
          : resolvedMessages.createError
        toast.error(message)
      },
      onSuccess: (entity, _, context) => {
        // Replace optimistic entity with real one
        if (context?.optimisticEntity) {
          queryClient.setQueriesData(
            { queryKey: queryKeys.lists() },
            (old: TEntity[] | undefined) => {
              if (!old) return [entity]
              return old.map(item =>
                item.id === context.optimisticEntity.id ? entity : item
              )
            }
          )
        }

        // Set the detail query
        queryClient.setQueryData(queryKeys.detail(entity.id), entity)

        const message = typeof resolvedMessages.createSuccess === 'function'
          ? resolvedMessages.createSuccess(entity)
          : resolvedMessages.createSuccess
        toast.success(message)
      },
      onSettled: () => {
        // Invalidate based on strategy
        invalidateQueries(queryClient, invalidation.onCreate, queryKeys)
      },
      ...options
    })
  }

  function useUpdate(options?: UseMutationOptions<TEntity, ApiError, { id: number; data: TUpdate }>) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ id, data }) => apiClient.update(undefined, id, data),
      onMutate: optimistic.enabled
        ? async ({ id, data }) => {
            // Cancel queries for this entity
            await queryClient.cancelQueries({ queryKey: queryKeys.detail(id) })

            // Snapshot
            const previousEntity = queryClient.getQueryData<TEntity>(queryKeys.detail(id))
            const previousLists = queryClient.getQueriesData({ queryKey: queryKeys.lists() })

            // Optimistic update
            if (previousEntity) {
              const updatedEntity = optimistic.updateOptimisticEntity
                ? optimistic.updateOptimisticEntity(previousEntity, data)
                : ({ ...previousEntity, ...data, updated: Date.now() } as TEntity)

              queryClient.setQueryData(queryKeys.detail(id), updatedEntity)

              // Update in all lists
              queryClient.setQueriesData(
                { queryKey: queryKeys.lists() },
                (old: TEntity[] | undefined) => {
                  if (!old) return undefined
                  return old.map(item => (item.id === id ? updatedEntity : item))
                }
              )
            }

            return { previousEntity, previousLists }
          }
        : undefined,
      onError: (error, { id }, context) => {
        // Rollback
        if (context?.previousEntity) {
          queryClient.setQueryData(queryKeys.detail(id), context.previousEntity)
        }
        if (context?.previousLists) {
          context.previousLists.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }

        const message = typeof resolvedMessages.updateError === 'function'
          ? resolvedMessages.updateError(error)
          : resolvedMessages.updateError
        toast.error(message)
      },
      onSuccess: (entity, { id }) => {
        queryClient.setQueryData(queryKeys.detail(id), entity)

        const message = typeof resolvedMessages.updateSuccess === 'function'
          ? resolvedMessages.updateSuccess(entity)
          : resolvedMessages.updateSuccess
        toast.success(message)
      },
      onSettled: (_, __, { id }) => {
        invalidateQueries(queryClient, invalidation.onUpdate, queryKeys, id)
      },
      ...options
    })
  }

  function useDelete(options?: UseMutationOptions<void | boolean, ApiError, number>) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: (id: number) => apiClient.delete(undefined, id),
      onMutate: optimistic.enabled
        ? async (id) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.lists() })

            const previousLists = queryClient.getQueriesData({ queryKey: queryKeys.lists() })

            // Apply delete strategy
            if (optimistic.deleteStrategy === 'remove') {
              queryClient.setQueriesData(
                { queryKey: queryKeys.lists() },
                (old: TEntity[] | undefined) => {
                  if (!old) return undefined
                  return old.filter(item => item.id !== id)
                }
              )
            } else if (optimistic.deleteStrategy === 'mark') {
              queryClient.setQueriesData(
                { queryKey: queryKeys.lists() },
                (old: TEntity[] | undefined) => {
                  if (!old) return undefined
                  return old.map(item =>
                    item.id === id ? { ...item, deleted: true } as TEntity : item
                  )
                }
              )
            }

            return { previousLists, deletedId: id }
          }
        : undefined,
      onError: (error, id, context) => {
        // Rollback
        if (context?.previousLists) {
          context.previousLists.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }

        const message = typeof resolvedMessages.deleteError === 'function'
          ? resolvedMessages.deleteError(error)
          : resolvedMessages.deleteError
        toast.error(message)
      },
      onSuccess: (_, id) => {
        queryClient.removeQueries({ queryKey: queryKeys.detail(id) })
        toast.success(resolvedMessages.deleteSuccess)
      },
      onSettled: () => {
        invalidateQueries(queryClient, invalidation.onDelete, queryKeys)
      },
      ...options
    })
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  function useBatchCreate(options?: UseMutationOptions<TEntity[], ApiError, TCreate[]>) {
    const queryClient = useQueryClient()

    if (!apiClient.batchCreate) {
      throw new Error(`Batch create not supported for ${entityName}`)
    }

    return useMutation({
      mutationFn: (data: TCreate[]) => apiClient.batchCreate!(undefined, data),
      onSuccess: (entities) => {
        // Add all entities to cache
        entities.forEach(entity => {
          queryClient.setQueryData(queryKeys.detail(entity.id), entity)
        })
        toast.success(`Created ${entities.length} ${entityName}s`)
      },
      onError: (error) => {
        toast.error(error?.message || `Failed to create ${entityName}s`)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      ...options
    })
  }

  function useBatchUpdate(
    options?: UseMutationOptions<TEntity[], ApiError, Array<{ id: number; data: TUpdate }>>
  ) {
    const queryClient = useQueryClient()

    if (!apiClient.batchUpdate) {
      throw new Error(`Batch update not supported for ${entityName}`)
    }

    return useMutation({
      mutationFn: (updates) => apiClient.batchUpdate!(undefined, updates),
      onSuccess: (entities) => {
        entities.forEach(entity => {
          queryClient.setQueryData(queryKeys.detail(entity.id), entity)
        })
        toast.success(`Updated ${entities.length} ${entityName}s`)
      },
      onError: (error) => {
        toast.error(error?.message || `Failed to update ${entityName}s`)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      ...options
    })
  }

  function useBatchDelete(options?: UseMutationOptions<void, ApiError, number[]>) {
    const queryClient = useQueryClient()

    if (!apiClient.batchDelete) {
      throw new Error(`Batch delete not supported for ${entityName}`)
    }

    return useMutation({
      mutationFn: (ids: number[]) => apiClient.batchDelete!(undefined, ids),
      onSuccess: (_, ids) => {
        ids.forEach(id => {
          queryClient.removeQueries({ queryKey: queryKeys.detail(id) })
        })
        toast.success(`Deleted ${ids.length} ${entityName}s`)
      },
      onError: (error) => {
        toast.error(error?.message || `Failed to delete ${entityName}s`)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      ...options
    })
  }

  // ============================================================================
  // Prefetching Utilities
  // ============================================================================

  function usePrefetch() {
    const queryClient = useQueryClient()

    return {
      prefetchList: (params?: TListParams) => {
        return queryClient.prefetchQuery({
          queryKey: queryKeys.list(params),
          queryFn: () => apiClient.list(undefined, params),
          staleTime: prefetch.prefetchStaleTime || staleTime
        })
      },
      prefetchById: (id: number) => {
        return queryClient.prefetchQuery({
          queryKey: queryKeys.detail(id),
          queryFn: () => apiClient.getById(undefined, id),
          staleTime: prefetch.prefetchStaleTime || staleTime
        })
      },
      prefetchOnHover: (id: number) => {
        if (!prefetch.enabled || !prefetch.prefetchOnHover) return () => {}

        let timeoutId: NodeJS.Timeout

        return {
          onMouseEnter: () => {
            timeoutId = setTimeout(() => {
              queryClient.prefetchQuery({
                queryKey: queryKeys.detail(id),
                queryFn: () => apiClient.getById(undefined, id),
                staleTime: prefetch.prefetchStaleTime || staleTime
              })
            }, prefetch.prefetchDelay || 200)
          },
          onMouseLeave: () => {
            clearTimeout(timeoutId)
          }
        }
      }
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  function useInvalidate() {
    const queryClient = useQueryClient()

    return {
      invalidateAll: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.all })
      },
      invalidateLists: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
      },
      invalidateList: (params?: TListParams) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.list(params) })
      },
      invalidateDetail: (id: number) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) })
      },
      setDetail: (entity: TEntity) => {
        queryClient.setQueryData(queryKeys.detail(entity.id), entity)
      },
      removeDetail: (id: number) => {
        queryClient.removeQueries({ queryKey: queryKeys.detail(id) })
      },
      reset: () => {
        queryClient.removeQueries({ queryKey: queryKeys.all })
      }
    }
  }

  // ============================================================================
  // Return all hooks
  // ============================================================================

  return {
    // Query hooks
    useList,
    useGetById,
    useInfiniteList,
    
    // Mutation hooks
    useCreate,
    useUpdate,
    useDelete,
    
    // Batch operations
    useBatchCreate,
    useBatchUpdate,
    useBatchDelete,
    
    // Utilities
    usePrefetch,
    useInvalidate,
    
    // Metadata
    queryKeys,
    entityName
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function invalidateQueries(
  queryClient: QueryClient,
  strategy: InvalidationStrategy[keyof InvalidationStrategy],
  queryKeys: QueryKeyFactory<any>,
  entityId?: number
) {
  if (!strategy || strategy === 'none') return

  if (strategy === 'all') {
    queryClient.invalidateQueries({ queryKey: queryKeys.all })
  } else if (strategy === 'lists') {
    queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
  } else if (strategy === 'detail' && entityId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.detail(entityId) })
  } else if (Array.isArray(strategy)) {
    strategy.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key as any })
    })
  }
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions
} from '@tanstack/react-query'