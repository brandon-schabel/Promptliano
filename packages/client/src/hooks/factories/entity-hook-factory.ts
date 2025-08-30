import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult
} from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PromptlianoClient } from '@promptliano/api-client'

/**
 * Configuration for creating entity hooks
 */
export interface EntityHookConfig<TEntity, TCreate, TUpdate> {
  entityName: string
  clientPath: keyof PromptlianoClient
  queryKeys?: {
    all: readonly unknown[]
    lists: () => readonly unknown[]
    list: (params?: any) => readonly unknown[]
    detail: (id: number) => readonly unknown[]
  }
  options?: {
    staleTime?: number
    optimistic?: boolean
    pagination?: boolean
    search?: boolean
  }
}

/**
 * Entity hooks return type
 */
export interface EntityHooks<TEntity, TCreate, TUpdate> {
  useList: (params?: any) => UseQueryResult<TEntity[], Error>
  useGetById: (id: number) => UseQueryResult<TEntity, Error>
  useCreate: () => UseMutationResult<TEntity, Error, TCreate>
  useUpdate: () => UseMutationResult<TEntity, Error, { id: number; data: TUpdate }>
  useDelete: () => UseMutationResult<void, Error, number>
  useInvalidate: () => {
    all: () => void
    lists: () => void
    detail: (id: number) => void
  }
}

/**
 * Create standardized entity hooks for CRUD operations
 */
export function createEntityHooks<TEntity extends { id: number }, TCreate, TUpdate>(
  config: EntityHookConfig<TEntity, TCreate, TUpdate>
): EntityHooks<TEntity, TCreate, TUpdate> {
  const { entityName, clientPath, options = {} } = config

  // Default query keys if not provided
  const defaultQueryKeys = {
    all: [entityName.toLowerCase()],
    lists: () => [...defaultQueryKeys.all, 'list'],
    list: (params?: any) => [...defaultQueryKeys.lists(), params],
    detail: (id: number) => [...defaultQueryKeys.all, 'detail', id]
  }

  const queryKeys = config.queryKeys || defaultQueryKeys
  const staleTime = options.staleTime || 5 * 60 * 1000 // 5 minutes default

  const useList = (params?: any) => {
    return useQuery({
      queryKey: queryKeys.list(params),
      queryFn: async () => {
        // This is a placeholder - actual implementation would use the API client
        throw new Error(`List function not implemented for ${entityName}`)
      },
      staleTime
    })
  }

  const useGetById = (id: number) => {
    return useQuery({
      queryKey: queryKeys.detail(id),
      queryFn: async () => {
        // This is a placeholder - actual implementation would use the API client
        throw new Error(`GetById function not implemented for ${entityName}`)
      },
      enabled: id > 0,
      staleTime
    })
  }

  const useCreate = () => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (data: TCreate) => {
        // This is a placeholder - actual implementation would use the API client
        throw new Error(`Create function not implemented for ${entityName}`)
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
        toast.success(`${entityName} created successfully`)
      },
      onError: (error: Error) => {
        toast.error(error.message || `Failed to create ${entityName}`)
      }
    })
  }

  const useUpdate = () => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({ id, data }: { id: number; data: TUpdate }) => {
        // This is a placeholder - actual implementation would use the API client
        throw new Error(`Update function not implemented for ${entityName}`)
      },
      onSuccess: (data, { id }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
        toast.success(`${entityName} updated successfully`)
      },
      onError: (error: Error) => {
        toast.error(error.message || `Failed to update ${entityName}`)
      }
    })
  }

  const useDelete = () => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: number) => {
        // This is a placeholder - actual implementation would use the API client
        throw new Error(`Delete function not implemented for ${entityName}`)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.all })
        toast.success(`${entityName} deleted successfully`)
      },
      onError: (error: Error) => {
        toast.error(error.message || `Failed to delete ${entityName}`)
      }
    })
  }

  const useInvalidate = () => {
    const queryClient = useQueryClient()

    return {
      all: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
      lists: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists() }),
      detail: (id: number) => queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) })
    }
  }

  return {
    useList,
    useGetById,
    useCreate,
    useUpdate,
    useDelete,
    useInvalidate
  }
}
