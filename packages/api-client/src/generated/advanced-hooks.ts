/**
 * AUTO-GENERATED ADVANCED REACT QUERY HOOKS
 * Generated at: 2025-08-26T05:01:30.406Z
 * 
 * Uses the CRUD Hook Factory for advanced features:
 * ✅ Optimistic updates
 * ✅ Batch operations  
 * ✅ Smart caching
 * ✅ Prefetching
 * ✅ Error handling
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import { createCrudHooks } from '@promptliano/hook-factory'
import { createTypeSafeClient } from './type-safe-client'
import type {
  GetProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  GetChatsResponse,
  CreateChatRequest,
  CreateChatResponse,
  UpdateChatRequest
} from './type-safe-client'

// Global client instance
let globalClient: ReturnType<typeof createTypeSafeClient> | null = null

function getApiClient() {
  if (!globalClient) {
    globalClient = createTypeSafeClient({ baseUrl: '/api' })
  }
  return globalClient
}

/**
 * Hook for API client access in React components
 */
function useApiClient() {
  return getApiClient()
}

/**
 * Initialize the global API client
 */
export function initializeApiClient(config?: { baseUrl?: string; timeout?: number; headers?: Record<string, string> }) {
  globalClient = createTypeSafeClient(config || { baseUrl: '/api' })
  return globalClient
}

// =============================================================================
// QUERY KEYS (using factory pattern)
// =============================================================================

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    lists: () => ['projects', 'list'] as const,
    list: (params?: any) => ['projects', 'list', params] as const,
    details: () => ['projects', 'detail'] as const,
    detail: (id: number) => ['projects', 'detail', id] as const,
  },
  chats: {
    all: ['chats'] as const,
    lists: () => ['chats', 'list'] as const,
    list: (params?: any) => ['chats', 'list', params] as const,
    details: () => ['chats', 'detail'] as const,
    detail: (id: number) => ['chats', 'detail', id] as const,
  },
} as const

// =============================================================================
// PROJECTS - Advanced Factory Hooks
// =============================================================================

/**
 * CRITICAL: API Response Adapter Pattern
 * 
 * The API returns wrapped responses: { success: true, data: Project[] }
 * But the hook factory expects unwrapped data: Project[]
 * 
 * Each API call is wrapped in an async adapter function that:
 * 1. Calls the API client method
 * 2. Extracts the .data property from the wrapped response
 * 3. Returns the unwrapped entity data to the hook factory
 * 
 * This maintains type safety while bridging the response format mismatch.
 */
const projectHooks = createCrudHooks({
  entityName: 'Project',
  queryKeys: queryKeys.projects,
  apiClient: {
    list: async () => {
      const response = await getApiClient().getProjects()
      return response.data
    },
    getById: async (_, id: number) => {
      const response = await getApiClient().getProject(id)
      return response.data
    },
    create: async (_, data: CreateProjectRequest) => {
      const response = await getApiClient().createProject(data)
      return response.data
    },
    update: async (_, id: number, data: UpdateProjectRequest) => {
      const response = await getApiClient().updateProject(id, data)
      return response.data
    },
    delete: async (_, id: number) => {
      await getApiClient().deleteProject(id)
      return true
    },
  },
  useApiClient: useApiClient,
  messages: {
    createSuccess: (project) => `Project "${project.name}" created successfully`,
    updateSuccess: (project) => `Project "${project.name}" updated successfully`,
    deleteSuccess: 'Project deleted successfully',
  },
  optimistic: {
    enabled: true,
    createOptimisticEntity: (data) => ({
      ...data,
      id: -Date.now(),
      created: Date.now(),
      updated: Date.now(),
    }),
  },
  invalidation: {
    onCreate: 'lists',
    onUpdate: 'lists',
    onDelete: 'all',
  }
})

// Export project hooks with familiar names
export const useProjects = projectHooks.useList
export const useProject = projectHooks.useGetById
export const useCreateProject = projectHooks.useCreate
export const useUpdateProject = projectHooks.useUpdate
export const useDeleteProject = projectHooks.useDelete
export const useProjectPrefetch = projectHooks.usePrefetch
export const useProjectInvalidate = projectHooks.useInvalidate

// =============================================================================
// TICKETS - Not available in current API
// =============================================================================

// Note: Ticket CRUD endpoints do not exist in the current OpenAPI spec
// These hooks are disabled until the endpoints are implemented

// =============================================================================
// CHATS - Advanced Factory Hooks
// =============================================================================

/**
 * CRITICAL: Same API Response Adapter Pattern as Projects
 * Unwraps { success: true, data: Chat[] } to Chat[] for hook factory compatibility
 */
const chatHooks = createCrudHooks({
  entityName: 'Chat',
  queryKeys: queryKeys.chats,
  apiClient: {
    list: async () => {
      const response = await getApiClient().getChats()
      return response.data
    },
    getById: async (_, id: number) => { 
      throw new Error('getChat not available - endpoint does not exist') 
    },
    create: async (_, data: CreateChatRequest) => {
      const response = await getApiClient().createChat(data)
      return response.data
    },
    update: async (_, id: number, data: UpdateChatRequest) => {
      const response = await getApiClient().updateChat(id, data)
      return response.data
    },
    delete: async (_, id: number) => {
      await getApiClient().deleteChat(id)
      return true
    },
  },
  useApiClient: useApiClient,
  messages: {
    createSuccess: (chat) => `Chat "${chat.title}" created successfully`,
    updateSuccess: (chat) => `Chat "${chat.title}" updated successfully`,
    deleteSuccess: 'Chat deleted successfully',
  },
  staleTime: 1 * 60 * 1000, // 1 minute for real-time feel
  optimistic: {
    enabled: true,
  }
})

export const useChats = chatHooks.useList
export const useChat = chatHooks.useGetById
export const useCreateChat = chatHooks.useCreate
export const useUpdateChat = chatHooks.useUpdate
export const useDeleteChat = chatHooks.useDelete
export const useChatPrefetch = chatHooks.usePrefetch
export const useChatInvalidate = chatHooks.useInvalidate

// =============================================================================
// QUEUES - Not available in current API
// =============================================================================

// Note: Queue CRUD endpoints do not exist in the current OpenAPI spec
// These hooks are disabled until the endpoints are implemented

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Invalidate all entity caches
 */
export function useInvalidateAll() {
  const projectInvalidate = useProjectInvalidate()
  const chatInvalidate = useChatInvalidate()
  
  return () => {
    projectInvalidate.invalidateAll()
    chatInvalidate.invalidateAll()
  }
}

// =============================================================================
// TYPES
// =============================================================================

export type {
  GetProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  GetChatsResponse,
  CreateChatRequest,
  CreateChatResponse,
  UpdateChatRequest
}

// Re-export advanced factory types
export type {
  EntityIdentifiable,
  PaginationParams,
  PaginatedResponse,
  CrudApiClient,
  QueryKeyFactory,
  OptimisticConfig,
  PrefetchConfig,
  InvalidationStrategy
} from '@promptliano/hook-factory'
