import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type {
  CreateHookConfigBody,
  UpdateHookConfigBody,
  HookEventType,
  HookGeneration,
  HookTest
} from '@promptliano/schemas'
import { toast } from 'sonner'
// Note: createCrudHooks import removed as it's not being used

const CLAUDE_HOOKS_KEYS = {
  all: ['claude-hooks'] as const,
  byProject: (projectId: string) => [...CLAUDE_HOOKS_KEYS.all, 'project', projectId] as const,
  detail: (projectId: string, serverId: string, matcherIndex: number) =>
    [...CLAUDE_HOOKS_KEYS.byProject(projectId), 'detail', serverId, matcherIndex] as const,
  search: (projectId: string, query: string) =>
    [...CLAUDE_HOOKS_KEYS.byProject(projectId), 'search', query] as const
}

// Factory for Claude hooks CRUD operations
export function createClaudeHooksFactory() {
  return {
    /**
     * List all hooks for a project
     */
    useGetProjectHooks: (projectId: number) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.list(projectId)
          return response.data
        },
        enabled: !!client && !!projectId && projectId > 0,
        staleTime: 2 * 60 * 1000, // 2 minutes - hook configs don't change frequently
        gcTime: 10 * 60 * 1000
      })
    },

    /**
     * Get a specific hook
     */
    useGetHook: (projectId: number, eventName: HookEventType, matcherIndex: number) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_HOOKS_KEYS.detail(String(projectId), eventName, matcherIndex),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.getHook(projectId, eventName, matcherIndex)
          return response.data
        },
        enabled: !!client && !!projectId && projectId > 0 && !!eventName && matcherIndex >= 0,
        staleTime: 5 * 60 * 1000, // 5 minutes - individual hooks are relatively stable
        gcTime: 15 * 60 * 1000
      })
    },

    /**
     * Search hooks
     */
    useSearchHooks: (projectId: number, query: string) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_HOOKS_KEYS.search(String(projectId), query),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.search(projectId, query)
          return response.data
        },
        enabled: !!client && !!projectId && projectId > 0 && !!query && query.length > 0,
        staleTime: 1 * 60 * 1000, // 1 minute - search results can be cached briefly
        gcTime: 5 * 60 * 1000
      })
    }
  }
}

// Factory for Claude hooks mutation operations
export function createClaudeHooksMutationFactory() {
  return {
    /**
     * Create a new hook
     */
    useCreateHook: (projectId: number) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: async (data: CreateHookConfigBody) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.create(projectId, data)
          return response.data
        },
        onMutate: async (data) => {
          // Cancel outgoing refetches
          await queryClient.cancelQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)) })

          // Snapshot the previous value
          const previousHooks = queryClient.getQueryData(CLAUDE_HOOKS_KEYS.byProject(String(projectId)))

          // Optimistic update - add the new hook to the list
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(String(projectId)), (old: any) => {
            if (!old || !Array.isArray(old)) return old

            const optimisticHook = {
              ...data,
              id: `temp-${Date.now()}`, // Temporary ID
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }

            return [...old, optimisticHook]
          })

          return { previousHooks }
        },
        onError: (err, data, context) => {
          // Rollback optimistic update
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(String(projectId)), context?.previousHooks)
          toast.error('Failed to create hook')
        },
        onSuccess: (newHook, data) => {
          // Update the cache with the actual hook data
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(String(projectId)), (old: any) => {
            if (!old || !Array.isArray(old)) return [newHook]

            // Replace the optimistic entry with the real data
            return old.map((hook) => (hook.id?.toString().startsWith('temp-') ? newHook : hook))
          })

          // Cache the individual hook if we have the necessary info from newHook response
          if (
            newHook &&
            'eventName' in newHook &&
            'matcherIndex' in newHook &&
            typeof (newHook as any).matcherIndex === 'number'
          ) {
            queryClient.setQueryData(
              CLAUDE_HOOKS_KEYS.detail(String(projectId), (newHook as any).eventName, (newHook as any).matcherIndex),
              newHook
            )
          }

          toast.success('Hook created successfully')
        },
        onSettled: () => {
          // Always refetch to ensure we have the latest data
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)) })
        }
      })
    },

    /**
     * Update an existing hook
     */
    useUpdateHook: (projectId: number) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: async ({
          serverId,
          data
        }: {
          serverId: string | number
          data: UpdateHookConfigBody
        }) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.update(projectId, serverId, data)
          return response.data
        },
        onMutate: async ({ serverId, data }) => {
          const detailKey = CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0)
          const listKey = CLAUDE_HOOKS_KEYS.byProject(String(projectId))

          // Cancel outgoing refetches
          await queryClient.cancelQueries({ queryKey: detailKey })
          await queryClient.cancelQueries({ queryKey: listKey })

          // Snapshot previous values
          const previousHook = queryClient.getQueryData(detailKey)
          const previousHooks = queryClient.getQueryData(listKey)

          // Optimistic update for individual hook
          queryClient.setQueryData(detailKey, (old: any) => {
            if (!old) return old
            return { ...old, ...data, updatedAt: new Date().toISOString() }
          })

          // Optimistic update for hooks list
          queryClient.setQueryData(listKey, (old: any) => {
            if (!old || !Array.isArray(old)) return old
            return old.map((hook) => {
              if (hook.id === serverId) {
                return { ...hook, ...data, updatedAt: new Date().toISOString() }
              }
              return hook
            })
          })

          return { previousHook, previousHooks, detailKey, listKey }
        },
        onError: (err, variables, context) => {
          // Rollback optimistic updates
          if (context?.previousHook) {
            queryClient.setQueryData(context.detailKey, context.previousHook)
          }
          if (context?.previousHooks) {
            queryClient.setQueryData(context.listKey, context.previousHooks)
          }
          toast.error('Failed to update hook')
        },
        onSuccess: (updatedHook, { serverId }) => {
          // Update caches with server response
          const detailKey = CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0)
          queryClient.setQueryData(detailKey, updatedHook)

          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(String(projectId)), (old: any) => {
            if (!old || !Array.isArray(old)) return old
            return old.map((hook) => {
              if (hook.id === serverId) {
                return updatedHook
              }
              return hook
            })
          })

          toast.success('Hook updated successfully')
        },
        onSettled: (_, __, { serverId }) => {
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)) })
          queryClient.invalidateQueries({
            queryKey: CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0)
          })
        }
      })
    },

    /**
     * Delete a hook
     */
    useDeleteHook: (projectId: number) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: async ({ serverId }: { serverId: string | number }) => {
          if (!client) throw new Error('API client not initialized')
          return client.claudeHooks.deleteHook(projectId, serverId)
        },
        onMutate: async ({ serverId }) => {
          const detailKey = CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0)
          const listKey = CLAUDE_HOOKS_KEYS.byProject(String(projectId))

          // Cancel outgoing refetches
          await queryClient.cancelQueries({ queryKey: listKey })

          // Snapshot previous value
          const previousHooks = queryClient.getQueryData(listKey)

          // Optimistic removal from list
          queryClient.setQueryData(listKey, (old: any) => {
            if (!old || !Array.isArray(old)) return old
            return old.filter((hook) => hook.id !== serverId)
          })

          // Remove individual hook cache
          queryClient.removeQueries({ queryKey: detailKey })

          return { previousHooks, listKey }
        },
        onError: (err, variables, context) => {
          // Rollback optimistic update
          if (context?.previousHooks) {
            queryClient.setQueryData(context.listKey, context.previousHooks)
          }
          toast.error('Failed to delete hook')
        },
        onSuccess: () => {
          toast.success('Hook deleted successfully')
        },
        onSettled: (_, __, { serverId }) => {
          // Clean up and invalidate
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)) })
          queryClient.removeQueries({
            queryKey: CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0)
          })
        }
      })
    }
  }
}

// Factory for Claude hooks utility operations
export function createClaudeHooksUtilityFactory() {
  return {
    /**
     * Generate a hook from natural language
     */
    useGenerateHook: (projectId: number) => {
      const client = useApiClient()

      return useMutation({
        mutationFn: async (data: HookGeneration) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.generate(projectId, data)
          return response.data
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to generate hook')
        }
      })
    },

    /**
     * Test a hook configuration
     */
    useTestHook: (projectId: number) => {
      const client = useApiClient()

      return useMutation({
        mutationFn: async (data: HookTest) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.test(projectId, data)
          return response.data
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to test hook')
        }
      })
    }
  }
}

// Factory for Claude hooks cache management
export function createClaudeHooksCacheFactory() {
  return {
    useClaudeHooksInvalidation: () => {
      const queryClient = useQueryClient()

      return {
        // Invalidate all hooks for a project
        invalidateProjectHooks: (projectId: number) => {
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)) })
        },

        // Invalidate specific hook
        invalidateHook: (projectId: number, serverId: string | number) => {
          queryClient.invalidateQueries({
            queryKey: CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0)
          })
        },

        // Clear search cache
        clearSearchCache: (projectId: number) => {
          queryClient.removeQueries({
            queryKey: [...CLAUDE_HOOKS_KEYS.byProject(String(projectId)), 'search'],
            exact: false
          })
        },

        // Prefetch project hooks
        prefetchProjectHooks: async (projectId: number) => {
          const client = useApiClient()
          if (!client || !projectId || projectId <= 0) return

          return queryClient.prefetchQuery({
            queryKey: CLAUDE_HOOKS_KEYS.byProject(String(projectId)),
            queryFn: () => client.claudeHooks.list(projectId).then((r: any) => r.data),
            staleTime: 2 * 60 * 1000
          })
        },

        // Get cached hooks without triggering fetch
        getCachedProjectHooks: (projectId: number) => {
          return queryClient.getQueryData(CLAUDE_HOOKS_KEYS.byProject(String(projectId)))
        },

        // Get cached hook without triggering fetch
        getCachedHook: (projectId: number, serverId: string | number) => {
          return queryClient.getQueryData(CLAUDE_HOOKS_KEYS.detail(String(projectId), String(serverId), 0))
        }
      }
    }
  }
}

// Create hook instances
const queryHooks = createClaudeHooksFactory()
const mutationHooks = createClaudeHooksMutationFactory()
const utilityHooks = createClaudeHooksUtilityFactory()
const cacheHooks = createClaudeHooksCacheFactory()

// Export individual hooks for backward compatibility
export const useGetProjectHooks = queryHooks.useGetProjectHooks
export const useGetHook = queryHooks.useGetHook
export const useSearchHooks = queryHooks.useSearchHooks

export const useCreateHook = mutationHooks.useCreateHook
export const useUpdateHook = mutationHooks.useUpdateHook
export const useDeleteHook = mutationHooks.useDeleteHook

export const useGenerateHook = utilityHooks.useGenerateHook
export const useTestHook = utilityHooks.useTestHook

export const useClaudeHooksInvalidation = cacheHooks.useClaudeHooksInvalidation

// Export query keys for advanced usage
export { CLAUDE_HOOKS_KEYS }

// Export types for compatibility
export type {
  CreateHookConfigBody,
  UpdateHookConfigBody,
  HookEventType as HookEvent,
  HookGeneration as HookGenerationRequest,
  HookTest as HookTestRequest
}
