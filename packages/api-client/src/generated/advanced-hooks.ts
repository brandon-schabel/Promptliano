/**
 * AUTO-GENERATED ADVANCED REACT QUERY HOOKS
 * Generated at: 2025-08-23T20:26:54.232Z
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

import { createCrudHooks } from '@promptliano/client/hooks/factories/crud-hook-factory'
import { createTypeSafeClient } from './type-safe-client'
import type {
  GetProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  GetChatsResponse,
  CreateChatRequest,
  CreateChatResponse
} from './type-safe-client'

// Global client instance
let globalClient: ReturnType<typeof createTypeSafeClient> | null = null

function getApiClient() {
  if (!globalClient) {
    globalClient = createTypeSafeClient()
  }
  return globalClient
}

/**
 * Initialize the global API client
 */
export function initializeApiClient(baseUrl?: string) {
  globalClient = createTypeSafeClient(baseUrl)
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

const projectHooks = createCrudHooks({
  entityName: 'Project',
  queryKeys: queryKeys.projects,
  apiClient: {
    list: () => getApiClient().getProjects(),
    getById: (_, id: number) => getApiClient().getProject(id),
    create: (_, data: CreateProjectRequest) => getApiClient().createProject(data),
    update: (_, id: number, data: Partial<CreateProjectRequest>) => getApiClient().updateProject(id, data),
    delete: (_, id: number) => getApiClient().deleteProject(id),
  },
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

const chatHooks = createCrudHooks({
  entityName: 'Chat',
  queryKeys: queryKeys.chats,
  apiClient: {
    list: () => getApiClient().getChats(),
    getById: (_, id: number) => { throw new Error('getChat not available - endpoint does not exist') },
    create: (_, data: CreateChatRequest) => getApiClient().createChat(data),
    update: (_, id: number, data: Partial<CreateChatRequest>) => getApiClient().updateChat(id, data),
    delete: (_, id: number) => getApiClient().deleteChat(id),
  },
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
  GetChatsResponse,
  CreateChatRequest,
  CreateChatResponse
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
} from '@promptliano/client/hooks/factories/crud-hook-factory'
