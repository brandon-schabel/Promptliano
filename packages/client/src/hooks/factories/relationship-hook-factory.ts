/**
 * Relationship Hook Factory
 * Handles parent-child relationships, many-to-many associations, and nested data
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions
} from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types
// ============================================================================

export interface RelationshipApiClient<TParent, TChild, TLink = void> {
  getChildren: (client: any, parentId: number) => Promise<TChild[]>
  getParent?: (client: any, childId: number) => Promise<TParent>
  addChild: (client: any, parentId: number, childData: Partial<TChild> | TLink) => Promise<TChild>
  removeChild: (client: any, parentId: number, childId: number) => Promise<void>
  updateChild?: (client: any, parentId: number, childId: number, data: Partial<TChild>) => Promise<TChild>
  reorderChildren?: (client: any, parentId: number, childIds: number[]) => Promise<TChild[]>
}

export interface RelationshipQueryKeys<TParams = void> {
  all: readonly string[]
  parent: (parentId: number) => readonly unknown[]
  children: (parentId: number, params?: TParams) => readonly unknown[]
  child: (parentId: number, childId: number) => readonly unknown[]
}

export interface RelationshipHookConfig<TParent, TChild, TLink = void, TParams = void> {
  parentName: string
  childName: string
  queryKeys: RelationshipQueryKeys<TParams>
  apiClient: RelationshipApiClient<TParent, TChild, TLink>
  staleTime?: number
  optimistic?: boolean
  messages?: {
    addSuccess?: string
    addError?: string
    removeSuccess?: string
    removeError?: string
    updateSuccess?: string
    updateError?: string
    reorderSuccess?: string
    reorderError?: string
  }
}

// ============================================================================
// Main Factory
// ============================================================================

export function createRelationshipHooks<
  TParent extends { id: number },
  TChild extends { id: number },
  TLink = void,
  TParams = void
>(config: RelationshipHookConfig<TParent, TChild, TLink, TParams>) {
  const {
    parentName,
    childName,
    queryKeys,
    apiClient,
    staleTime = 5 * 60 * 1000,
    optimistic = true,
    messages = {}
  } = config

  const defaultMessages = {
    addSuccess: `${childName} added successfully`,
    addError: `Failed to add ${childName}`,
    removeSuccess: `${childName} removed successfully`,
    removeError: `Failed to remove ${childName}`,
    updateSuccess: `${childName} updated successfully`,
    updateError: `Failed to update ${childName}`,
    reorderSuccess: `${childName}s reordered successfully`,
    reorderError: `Failed to reorder ${childName}s`,
    ...messages
  }

  // ============================================================================
  // Query Hooks
  // ============================================================================

  function useChildren(
    parentId: number,
    params?: TParams,
    options?: UseQueryOptions<TChild[], ApiError>
  ) {
    return useQuery({
      queryKey: queryKeys.children(parentId, params),
      queryFn: () => apiClient.getChildren(undefined, parentId),
      enabled: !!parentId && parentId > 0,
      staleTime,
      ...options
    })
  }

  function useParent(childId: number, options?: UseQueryOptions<TParent, ApiError>) {
    if (!apiClient.getParent) {
      throw new Error(`getParent not implemented for ${parentName}-${childName} relationship`)
    }

    return useQuery({
      queryKey: queryKeys.parent(childId),
      queryFn: () => apiClient.getParent!(undefined, childId),
      enabled: !!childId && childId > 0,
      staleTime,
      ...options
    })
  }

  // ============================================================================
  // Mutation Hooks
  // ============================================================================

  function useAddChild(
    options?: UseMutationOptions<TChild, ApiError, { parentId: number; data: Partial<TChild> | TLink }>
  ) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ parentId, data }) => apiClient.addChild(undefined, parentId, data),
      onMutate: optimistic
        ? async ({ parentId, data }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.children(parentId) })

            const previousChildren = queryClient.getQueryData<TChild[]>(queryKeys.children(parentId))

            // Create optimistic child
            const optimisticChild = {
              ...(data as any),
              id: -Date.now(),
              created: Date.now(),
              updated: Date.now()
            } as TChild

            queryClient.setQueryData(queryKeys.children(parentId), (old: TChild[] | undefined) => {
              if (!old) return [optimisticChild]
              return [...old, optimisticChild]
            })

            return { previousChildren, parentId }
          }
        : undefined,
      onError: (error, { parentId }, context) => {
        if (context?.previousChildren !== undefined) {
          queryClient.setQueryData(queryKeys.children(parentId), context.previousChildren)
        }
        toast.error(defaultMessages.addError)
      },
      onSuccess: (child, { parentId }) => {
        toast.success(defaultMessages.addSuccess)
      },
      onSettled: (_, __, { parentId }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.children(parentId) })
      },
      ...options
    })
  }

  function useRemoveChild(
    options?: UseMutationOptions<void, ApiError, { parentId: number; childId: number }>
  ) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ parentId, childId }) => apiClient.removeChild(undefined, parentId, childId),
      onMutate: optimistic
        ? async ({ parentId, childId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.children(parentId) })

            const previousChildren = queryClient.getQueryData<TChild[]>(queryKeys.children(parentId))

            queryClient.setQueryData(queryKeys.children(parentId), (old: TChild[] | undefined) => {
              if (!old) return undefined
              return old.filter(child => child.id !== childId)
            })

            return { previousChildren, parentId }
          }
        : undefined,
      onError: (error, { parentId }, context) => {
        if (context?.previousChildren !== undefined) {
          queryClient.setQueryData(queryKeys.children(parentId), context.previousChildren)
        }
        toast.error(defaultMessages.removeError)
      },
      onSuccess: () => {
        toast.success(defaultMessages.removeSuccess)
      },
      onSettled: (_, __, { parentId }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.children(parentId) })
      },
      ...options
    })
  }

  function useUpdateChild(
    options?: UseMutationOptions<TChild, ApiError, { parentId: number; childId: number; data: Partial<TChild> }>
  ) {
    if (!apiClient.updateChild) {
      throw new Error(`updateChild not implemented for ${parentName}-${childName} relationship`)
    }

    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ parentId, childId, data }) =>
        apiClient.updateChild!(undefined, parentId, childId, data),
      onMutate: optimistic
        ? async ({ parentId, childId, data }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.children(parentId) })

            const previousChildren = queryClient.getQueryData<TChild[]>(queryKeys.children(parentId))

            queryClient.setQueryData(queryKeys.children(parentId), (old: TChild[] | undefined) => {
              if (!old) return undefined
              return old.map(child =>
                child.id === childId
                  ? { ...child, ...data, updated: Date.now() }
                  : child
              )
            })

            return { previousChildren, parentId }
          }
        : undefined,
      onError: (error, { parentId }, context) => {
        if (context?.previousChildren !== undefined) {
          queryClient.setQueryData(queryKeys.children(parentId), context.previousChildren)
        }
        toast.error(defaultMessages.updateError)
      },
      onSuccess: () => {
        toast.success(defaultMessages.updateSuccess)
      },
      onSettled: (_, __, { parentId }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.children(parentId) })
      },
      ...options
    })
  }

  function useReorderChildren(
    options?: UseMutationOptions<TChild[], ApiError, { parentId: number; childIds: number[] }>
  ) {
    if (!apiClient.reorderChildren) {
      throw new Error(`reorderChildren not implemented for ${parentName}-${childName} relationship`)
    }

    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ parentId, childIds }) =>
        apiClient.reorderChildren!(undefined, parentId, childIds),
      onMutate: optimistic
        ? async ({ parentId, childIds }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.children(parentId) })

            const previousChildren = queryClient.getQueryData<TChild[]>(queryKeys.children(parentId))

            if (previousChildren) {
              // Reorder optimistically
              const childMap = new Map(previousChildren.map(child => [child.id, child]))
              const reordered = childIds
                .map(id => childMap.get(id))
                .filter((child): child is TChild => child !== undefined)

              queryClient.setQueryData(queryKeys.children(parentId), reordered)
            }

            return { previousChildren, parentId }
          }
        : undefined,
      onError: (error, { parentId }, context) => {
        if (context?.previousChildren !== undefined) {
          queryClient.setQueryData(queryKeys.children(parentId), context.previousChildren)
        }
        toast.error(defaultMessages.reorderError)
      },
      onSuccess: (children, { parentId }) => {
        queryClient.setQueryData(queryKeys.children(parentId), children)
        toast.success(defaultMessages.reorderSuccess)
      },
      onSettled: (_, __, { parentId }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.children(parentId) })
      },
      ...options
    })
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  function useInvalidate() {
    const queryClient = useQueryClient()

    return {
      invalidateChildren: (parentId: number) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.children(parentId) })
      },
      invalidateParent: (childId: number) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.parent(childId) })
      },
      invalidateAll: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.all })
      },
      setChildren: (parentId: number, children: TChild[]) => {
        queryClient.setQueryData(queryKeys.children(parentId), children)
      },
      updateChildInCache: (parentId: number, childId: number, updater: (child: TChild) => TChild) => {
        queryClient.setQueryData(queryKeys.children(parentId), (old: TChild[] | undefined) => {
          if (!old) return undefined
          return old.map(child => (child.id === childId ? updater(child) : child))
        })
      }
    }
  }

  return {
    useChildren,
    useParent,
    useAddChild,
    useRemoveChild,
    useUpdateChild,
    useReorderChildren,
    useInvalidate,
    queryKeys
  }
}

// ============================================================================
// Specialized Relationship Factories
// ============================================================================

/**
 * Create hooks for a one-to-many relationship
 */
export function createOneToManyHooks<TParent extends { id: number }, TChild extends { id: number }>(
  config: Omit<RelationshipHookConfig<TParent, TChild, void, void>, 'apiClient'> & {
    apiPath: string // e.g., 'projects' for /api/projects/:id/tickets
  }
) {
  return createRelationshipHooks<TParent, TChild>({
    ...config,
    apiClient: {
      getChildren: async (client, parentId) => {
        const response = await client[config.apiPath][parentId][config.childName].list()
        return response.data
      },
      addChild: async (client, parentId, data) => {
        const response = await client[config.apiPath][parentId][config.childName].create(data)
        return response.data
      },
      removeChild: async (client, parentId, childId) => {
        await client[config.apiPath][parentId][config.childName][childId].delete()
      },
      updateChild: async (client, parentId, childId, data) => {
        const response = await client[config.apiPath][parentId][config.childName][childId].update(data)
        return response.data
      }
    }
  })
}

/**
 * Create hooks for a many-to-many relationship with a junction table
 */
export function createManyToManyHooks<
  TEntity1 extends { id: number },
  TEntity2 extends { id: number },
  TLink = { entity1Id: number; entity2Id: number }
>(config: {
  entity1Name: string
  entity2Name: string
  queryKeys: RelationshipQueryKeys
  apiClient: {
    getRelated: (client: any, entity1Id: number) => Promise<TEntity2[]>
    link: (client: any, entity1Id: number, entity2Id: number, linkData?: Partial<TLink>) => Promise<void>
    unlink: (client: any, entity1Id: number, entity2Id: number) => Promise<void>
  }
}) {
  const queryClient = useQueryClient()

  function useRelated(entity1Id: number, options?: UseQueryOptions<TEntity2[], ApiError>) {
    return useQuery({
      queryKey: config.queryKeys.children(entity1Id),
      queryFn: () => config.apiClient.getRelated(undefined, entity1Id),
      enabled: !!entity1Id && entity1Id > 0,
      ...options
    })
  }

  function useLink(options?: UseMutationOptions<void, ApiError, { entity1Id: number; entity2Id: number; linkData?: Partial<TLink> }>) {
    return useMutation({
      mutationFn: ({ entity1Id, entity2Id, linkData }) =>
        config.apiClient.link(undefined, entity1Id, entity2Id, linkData),
      onSuccess: (_, { entity1Id }) => {
        queryClient.invalidateQueries({ queryKey: config.queryKeys.children(entity1Id) })
        toast.success(`${config.entity2Name} linked successfully`)
      },
      onError: () => {
        toast.error(`Failed to link ${config.entity2Name}`)
      },
      ...options
    })
  }

  function useUnlink(options?: UseMutationOptions<void, ApiError, { entity1Id: number; entity2Id: number }>) {
    return useMutation({
      mutationFn: ({ entity1Id, entity2Id }) =>
        config.apiClient.unlink(undefined, entity1Id, entity2Id),
      onSuccess: (_, { entity1Id }) => {
        queryClient.invalidateQueries({ queryKey: config.queryKeys.children(entity1Id) })
        toast.success(`${config.entity2Name} unlinked successfully`)
      },
      onError: () => {
        toast.error(`Failed to unlink ${config.entity2Name}`)
      },
      ...options
    })
  }

  return {
    useRelated,
    useLink,
    useUnlink
  }
}