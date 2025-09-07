/**
 * CRUD Hooks Factory - Universal factory for creating CRUD operation hooks
 *
 * This factory generates all standard CRUD hooks with:
 * - Built-in optimistic updates
 * - Smart cache invalidation
 * - Toast notifications
 * - Error handling
 * - Type safety
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseQueryResult,
  type UseMutationResult
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApiClient } from '../api/use-api-client'
import type { PromptlianoClient } from '@promptliano/api-client'
import { createQueryKeys, getStaleTimeForDomain, type QueryKeyFactory } from './query-key-factory'

/**
 * Configuration for CRUD hooks
 */
export interface CrudHookConfig<TEntity, TCreate, TUpdate> {
  /**
   * Display name for the entity (used in toast messages)
   */
  entityName: string

  /**
   * Plural display name (defaults to entityName + 's')
   */
  entityNamePlural?: string

  /**
   * Path to the API client methods (e.g., 'projects', 'tickets')
   */
  clientPath: string

  /**
   * Custom query keys (uses createQueryKeys by default)
   */
  queryKeys?: QueryKeyFactory

  /**
   * Hook options
   */
  options?: {
    /**
     * Stale time in milliseconds (auto-determined by domain if not provided)
     */
    staleTime?: number

    /**
     * Enable optimistic updates
     */
    optimistic?: boolean

    /**
     * Enable pagination support
     */
    pagination?: boolean

    /**
     * Enable search functionality
     */
    search?: boolean

    /**
     * Enable export functionality
     */
    export?: boolean

    /**
     * Custom success message formatter
     */
    successMessage?: (action: string, entity: TEntity) => string

    /**
     * Custom error message formatter
     */
    errorMessage?: (action: string, error: Error) => string

    /**
     * Disable toast notifications
     */
    silent?: boolean
  }
}

/**
 * CRUD hooks return type
 */
export interface CrudHooks<TEntity, TCreate, TUpdate> {
  // Query hooks
  useList: (params?: any, options?: UseQueryOptions<TEntity[]>) => UseQueryResult<TEntity[], Error>
  useGet: (id: number | string, options?: UseQueryOptions<TEntity>) => UseQueryResult<TEntity, Error>

  // Mutation hooks
  useCreate: (options?: UseMutationOptions<TEntity, Error, TCreate>) => UseMutationResult<TEntity, Error, TCreate>
  useUpdate: (
    options?: UseMutationOptions<TEntity, Error, { id: number | string; data: TUpdate }>
  ) => UseMutationResult<TEntity, Error, { id: number | string; data: TUpdate }>
  useDelete: (
    options?: UseMutationOptions<void, Error, number | string>
  ) => UseMutationResult<void, Error, number | string>

  // Utility hooks
  useInvalidate: () => {
    all: () => Promise<void>
    lists: () => Promise<void>
    list: (params?: any) => Promise<void>
    detail: (id: number | string) => Promise<void>
  }

  // Prefetch hooks
  usePrefetch: () => {
    list: (params?: any) => Promise<void>
    detail: (id: number | string) => Promise<void>
  }
}

/**
 * Create CRUD hooks for an entity
 */
export function createCrudHooks<
  TEntity extends { id: number | string },
  TCreate = Partial<TEntity>,
  TUpdate = Partial<TEntity>
>(config: CrudHookConfig<TEntity, TCreate, TUpdate>): CrudHooks<TEntity, TCreate, TUpdate> {
  const { entityName, entityNamePlural = `${entityName}s`, clientPath, options = {} } = config

  // Create query keys
  const KEYS = config.queryKeys || createQueryKeys(clientPath)

  // Determine stale time
  const staleTime = options.staleTime || getStaleTimeForDomain(clientPath)

  // Success message formatter
  const formatSuccess =
    options.successMessage ||
    ((action: string) => {
      const messages: Record<string, string> = {
        create: `${entityName} created successfully`,
        update: `${entityName} updated successfully`,
        delete: `${entityName} deleted successfully`,
        batchCreate: `${entityNamePlural} created successfully`,
        batchUpdate: `${entityNamePlural} updated successfully`,
        batchDelete: `${entityNamePlural} deleted successfully`
      }
      return messages[action] || `${entityName} ${action} successful`
    })

  // Error message formatter
  const formatError =
    options.errorMessage ||
    ((action: string, error: Error) => {
      return error.message || `Failed to ${action} ${entityName.toLowerCase()}`
    })

  // Show toast helper
  const showToast = (type: 'success' | 'error', message: string) => {
    if (!options.silent) {
      toast[type](message)
    }
  }

  /**
   * List/Query Hook
   */
  const useList = (params?: any, queryOptions?: UseQueryOptions<TEntity[]>) => {
    const client = useApiClient()

    return useQuery({
      queryKey: KEYS.list(params),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.list) throw new Error(`API client missing list method for ${clientPath}`)

        const response = await api.list(params)
        return response.data || response
      },
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Get by ID Hook
   */
  const useGet = (id: number | string, queryOptions?: UseQueryOptions<TEntity>) => {
    const client = useApiClient()

    return useQuery({
      queryKey: KEYS.detail(id),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.get) throw new Error(`API client missing get method for ${clientPath}`)

        const response = await api.get(id)
        return response.data || response
      },
      enabled: !!id && !!client,
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Create Hook
   */
  const useCreate = (mutationOptions?: UseMutationOptions<TEntity, Error, TCreate>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (data: TCreate) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.create) throw new Error(`API client missing create method for ${clientPath}`)

        const response = await api.create(data)
        return response.data || response
      },
      onSuccess: (data, variables, context) => {
        // Invalidate list queries
        queryClient.invalidateQueries({ queryKey: KEYS.lists() })

        // Show success toast
        showToast('success', formatSuccess('create', data))

        // Call custom onSuccess
        mutationOptions?.onSuccess?.(data, variables, context)
      },
      onError: (error, variables, context) => {
        // Show error toast
        showToast('error', formatError('create', error))

        // Call custom onError
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })
  }

  /**
   * Update Hook
   */
  const useUpdate = (mutationOptions?: UseMutationOptions<TEntity, Error, { id: number | string; data: TUpdate }>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({ id, data }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.update) throw new Error(`API client missing update method for ${clientPath}`)

        const response = await api.update(id, data)
        return response.data || response
      },
      onMutate: options.optimistic
        ? async ({ id, data }: { id: number | string; data: TUpdate }) => {
            // Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: KEYS.detail(id) })
            await queryClient.cancelQueries({ queryKey: KEYS.lists() })

            // Snapshot previous values
            const previousDetail = queryClient.getQueryData<TEntity>(KEYS.detail(id))
            const previousLists = queryClient.getQueriesData<TEntity[]>({
              queryKey: KEYS.lists()
            })

            // Optimistically update detail
            if (previousDetail) {
              queryClient.setQueryData(KEYS.detail(id), {
                ...previousDetail,
                ...data,
                updatedAt: new Date().toISOString()
              })
            }

            // Optimistically update lists
            previousLists.forEach(([queryKey, list]) => {
              if (list) {
                queryClient.setQueryData(
                  queryKey,
                  list.map((item) =>
                    item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
                  )
                )
              }
            })

            return { previousDetail, previousLists }
          }
        : undefined,
      onError: (error, { id }, context) => {
        // Rollback optimistic updates
        if (
          options.optimistic &&
          context &&
          typeof context === 'object' &&
          context !== null &&
          'previousDetail' in context
        ) {
          const optContext = context as {
            previousDetail?: TEntity
            previousLists?: [readonly unknown[], TEntity[] | undefined][]
          }
          if (optContext.previousDetail) {
            queryClient.setQueryData(KEYS.detail(id), optContext.previousDetail)
          }
          optContext.previousLists?.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }

        // Show error toast
        showToast('error', formatError('update', error))

        // Call custom onError
        mutationOptions?.onError?.(error, { id, data: {} as TUpdate }, context)
      },
      onSuccess: (data, { id }, context) => {
        // Update cache with server response
        queryClient.setQueryData(KEYS.detail(id), data)

        // Invalidate affected queries
        queryClient.invalidateQueries({ queryKey: KEYS.detail(id) })
        queryClient.invalidateQueries({ queryKey: KEYS.lists() })

        // Show success toast
        showToast('success', formatSuccess('update', data))

        // Call custom onSuccess
        mutationOptions?.onSuccess?.(data, { id, data: {} as TUpdate }, context)
      },
      ...mutationOptions
    })
  }

  /**
   * Delete Hook
   */
  const useDelete = (mutationOptions?: UseMutationOptions<void, Error, number | string>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.delete) throw new Error(`API client missing delete method for ${clientPath}`)

        await api.delete(id)
      },
      onMutate: options.optimistic
        ? async (id: number | string) => {
            // Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: KEYS.lists() })

            // Snapshot previous lists
            const previousLists = queryClient.getQueriesData<TEntity[]>({
              queryKey: KEYS.lists()
            })

            // Optimistically remove from lists
            previousLists.forEach(([queryKey, list]) => {
              if (list) {
                queryClient.setQueryData(
                  queryKey,
                  list.filter((item) => item.id !== id)
                )
              }
            })

            // Remove detail query
            queryClient.removeQueries({ queryKey: KEYS.detail(id) })

            return { previousLists }
          }
        : undefined,
      onError: (error, id, context) => {
        // Rollback optimistic updates
        if (
          options.optimistic &&
          context &&
          typeof context === 'object' &&
          context !== null &&
          'previousLists' in context
        ) {
          const optContext = context as { previousLists?: [readonly unknown[], TEntity[] | undefined][] }
          optContext.previousLists?.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }

        // Show error toast
        showToast('error', formatError('delete', error))

        // Call custom onError
        mutationOptions?.onError?.(error, id, context)
      },
      onSuccess: (data, id, context) => {
        // Invalidate all queries for this domain
        queryClient.invalidateQueries({ queryKey: KEYS.all })

        // Remove detail query
        queryClient.removeQueries({ queryKey: KEYS.detail(id) })

        // Show success toast
        showToast('success', formatSuccess('delete', {} as TEntity))

        // Call custom onSuccess
        mutationOptions?.onSuccess?.(data, id, context)
      },
      ...mutationOptions
    })
  }

  /**
   * Invalidation utilities
   */
  const useInvalidate = () => {
    const queryClient = useQueryClient()

    return {
      all: () => queryClient.invalidateQueries({ queryKey: KEYS.all }),
      lists: () => queryClient.invalidateQueries({ queryKey: KEYS.lists() }),
      list: (params?: any) => queryClient.invalidateQueries({ queryKey: KEYS.list(params) }),
      detail: (id: number | string) => queryClient.invalidateQueries({ queryKey: KEYS.detail(id) })
    }
  }

  /**
   * Prefetch utilities
   */
  const usePrefetch = () => {
    const queryClient = useQueryClient()
    const client = useApiClient()

    return {
      list: async (params?: any) => {
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
      detail: async (id: number | string) => {
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
      }
    }
  }

  return {
    useList,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
    useInvalidate,
    usePrefetch
  }
}
