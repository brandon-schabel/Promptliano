import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type {
  CreateHookConfigBody,
  UpdateHookConfigBody,
  HookGenerationRequest,
  HookTestRequest,
  HookEvent
} from '@promptliano/api-client'
import { toast } from 'sonner'
// Note: createCrudHooks import removed as it's not being used

const CLAUDE_HOOKS_KEYS = {
  all: ['claude-hooks'] as const,
  byProject: (projectPath: string) => [...CLAUDE_HOOKS_KEYS.all, 'project', projectPath] as const,
  detail: (projectPath: string, eventName: HookEvent, matcherIndex: number) => 
    [...CLAUDE_HOOKS_KEYS.byProject(projectPath), 'detail', eventName, matcherIndex] as const,
  search: (projectPath: string, query: string) => 
    [...CLAUDE_HOOKS_KEYS.byProject(projectPath), 'search', query] as const
}

// Factory for Claude hooks CRUD operations
export function createClaudeHooksFactory() {
  return {
    /**
     * List all hooks for a project
     */
    useGetProjectHooks: (projectPath: string) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.list(projectPath)
          return response.data
        },
        enabled: !!client && !!projectPath,
        staleTime: 2 * 60 * 1000, // 2 minutes - hook configs don't change frequently
        gcTime: 10 * 60 * 1000
      })
    },

    /**
     * Get a specific hook
     */
    useGetHook: (projectPath: string, eventName: HookEvent, matcherIndex: number) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.getHook(projectPath, eventName, matcherIndex)
          return response.data
        },
        enabled: !!client && !!projectPath && !!eventName && matcherIndex >= 0,
        staleTime: 5 * 60 * 1000, // 5 minutes - individual hooks are relatively stable
        gcTime: 15 * 60 * 1000
      })
    },

    /**
     * Search hooks
     */
    useSearchHooks: (projectPath: string, query: string) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_HOOKS_KEYS.search(projectPath, query),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.search(projectPath, query)
          return response.data
        },
        enabled: !!client && !!projectPath && !!query && query.length > 0,
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
    useCreateHook: (projectPath: string) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: async (data: CreateHookConfigBody) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.create(projectPath, data)
          return response.data
        },
        onMutate: async (data) => {
          // Cancel outgoing refetches
          await queryClient.cancelQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath) })
          
          // Snapshot the previous value
          const previousHooks = queryClient.getQueryData(CLAUDE_HOOKS_KEYS.byProject(projectPath))
          
          // Optimistic update - add the new hook to the list
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(projectPath), (old: any) => {
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
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(projectPath), context?.previousHooks)
          toast.error('Failed to create hook')
        },
        onSuccess: (newHook, data) => {
          // Update the cache with the actual hook data
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(projectPath), (old: any) => {
            if (!old || !Array.isArray(old)) return [newHook]
            
            // Replace the optimistic entry with the real data
            return old.map(hook => 
              hook.id?.toString().startsWith('temp-') ? newHook : hook
            )
          })
          
          // Cache the individual hook
          if (data.eventName && typeof data.matcherIndex === 'number') {
            queryClient.setQueryData(
              CLAUDE_HOOKS_KEYS.detail(projectPath, data.eventName, data.matcherIndex),
              newHook
            )
          }
          
          toast.success('Hook created successfully')
        },
        onSettled: () => {
          // Always refetch to ensure we have the latest data
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath) })
        }
      })
    },

    /**
     * Update an existing hook
     */
    useUpdateHook: (projectPath: string) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: async ({
          eventName,
          matcherIndex,
          data
        }: {
          eventName: HookEvent
          matcherIndex: number
          data: UpdateHookConfigBody
        }) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.update(projectPath, eventName, matcherIndex, data)
          return response.data
        },
        onMutate: async ({ eventName, matcherIndex, data }) => {
          const detailKey = CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex)
          const listKey = CLAUDE_HOOKS_KEYS.byProject(projectPath)
          
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
            return old.map(hook => {
              if (hook.eventName === eventName && hook.matcherIndex === matcherIndex) {
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
        onSuccess: (updatedHook, { eventName, matcherIndex }) => {
          // Update caches with server response
          const detailKey = CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex)
          queryClient.setQueryData(detailKey, updatedHook)
          
          queryClient.setQueryData(CLAUDE_HOOKS_KEYS.byProject(projectPath), (old: any) => {
            if (!old || !Array.isArray(old)) return old
            return old.map(hook => {
              if (hook.eventName === eventName && hook.matcherIndex === matcherIndex) {
                return updatedHook
              }
              return hook
            })
          })
          
          toast.success('Hook updated successfully')
        },
        onSettled: (_, __, { eventName, matcherIndex }) => {
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath) })
          queryClient.invalidateQueries({ 
            queryKey: CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex) 
          })
        }
      })
    },

    /**
     * Delete a hook
     */
    useDeleteHook: (projectPath: string) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: async ({ eventName, matcherIndex }: { eventName: HookEvent; matcherIndex: number }) => {
          if (!client) throw new Error('API client not initialized')
          return client.claudeHooks.deleteHook(projectPath, eventName, matcherIndex)
        },
        onMutate: async ({ eventName, matcherIndex }) => {
          const detailKey = CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex)
          const listKey = CLAUDE_HOOKS_KEYS.byProject(projectPath)
          
          // Cancel outgoing refetches
          await queryClient.cancelQueries({ queryKey: listKey })
          
          // Snapshot previous value
          const previousHooks = queryClient.getQueryData(listKey)
          
          // Optimistic removal from list
          queryClient.setQueryData(listKey, (old: any) => {
            if (!old || !Array.isArray(old)) return old
            return old.filter(hook => 
              !(hook.eventName === eventName && hook.matcherIndex === matcherIndex)
            )
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
        onSettled: (_, __, { eventName, matcherIndex }) => {
          // Clean up and invalidate
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath) })
          queryClient.removeQueries({ 
            queryKey: CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex)
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
    useGenerateHook: (projectPath: string) => {
      const client = useApiClient()

      return useMutation({
        mutationFn: async (data: HookGenerationRequest) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.generate(projectPath, data)
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
    useTestHook: (projectPath: string) => {
      const client = useApiClient()

      return useMutation({
        mutationFn: async (data: HookTestRequest) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeHooks.test(projectPath, data)
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
        invalidateProjectHooks: (projectPath: string) => {
          queryClient.invalidateQueries({ queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath) })
        },
        
        // Invalidate specific hook
        invalidateHook: (projectPath: string, eventName: HookEvent, matcherIndex: number) => {
          queryClient.invalidateQueries({ 
            queryKey: CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex) 
          })
        },
        
        // Clear search cache
        clearSearchCache: (projectPath: string) => {
          queryClient.removeQueries({ 
            queryKey: [...CLAUDE_HOOKS_KEYS.byProject(projectPath), 'search'],
            exact: false 
          })
        },
        
        // Prefetch project hooks
        prefetchProjectHooks: async (projectPath: string) => {
          const client = useApiClient()
          if (!client || !projectPath) return
          
          return queryClient.prefetchQuery({
            queryKey: CLAUDE_HOOKS_KEYS.byProject(projectPath),
            queryFn: () => client.claudeHooks.list(projectPath).then(r => r.data),
            staleTime: 2 * 60 * 1000
          })
        },
        
        // Get cached hooks without triggering fetch
        getCachedProjectHooks: (projectPath: string) => {
          return queryClient.getQueryData(CLAUDE_HOOKS_KEYS.byProject(projectPath))
        },
        
        // Get cached hook without triggering fetch
        getCachedHook: (projectPath: string, eventName: HookEvent, matcherIndex: number) => {
          return queryClient.getQueryData(CLAUDE_HOOKS_KEYS.detail(projectPath, eventName, matcherIndex))
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