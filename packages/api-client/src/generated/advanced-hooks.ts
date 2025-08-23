/**
 * AUTO-GENERATED ADVANCED REACT QUERY HOOKS
 * Generated at: 2025-08-23T00:21:48.699Z
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
  GetTicketsResponse,
  CreateTicketRequest,
  CreateTicketResponse,
  GetChatsResponse,
  CreateChatRequest,
  CreateChatResponse,
  GetQueuesResponse,
  CreateQueueRequest,
  CreateQueueResponse
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
  tickets: {
    all: ['tickets'] as const,
    lists: () => ['tickets', 'list'] as const,
    list: (params?: any) => ['tickets', 'list', params] as const,
    details: () => ['tickets', 'detail'] as const,
    detail: (id: number) => ['tickets', 'detail', id] as const,
  },
  chats: {
    all: ['chats'] as const,
    lists: () => ['chats', 'list'] as const,
    list: (params?: any) => ['chats', 'list', params] as const,
    details: () => ['chats', 'detail'] as const,
    detail: (id: number) => ['chats', 'detail', id] as const,
  },
  queues: {
    all: ['queues'] as const,
    lists: () => ['queues', 'list'] as const,
    list: (params?: any) => ['queues', 'list', params] as const,
    details: () => ['queues', 'detail'] as const,
    detail: (id: number) => ['queues', 'detail', id] as const,
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
    getById: (_, id: number) => getApiClient().getProject(id), // TODO: Add to generated client
    create: (_, data: CreateProjectRequest) => getApiClient().createProject(data),
    update: (_, id: number, data: Partial<CreateProjectRequest>) => getApiClient().updateProject(id, data), // TODO: Add to generated client
    delete: (_, id: number) => getApiClient().deleteProject(id), // TODO: Add to generated client
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
// TICKETS - Advanced Factory Hooks
// =============================================================================

const ticketHooks = createCrudHooks({
  entityName: 'Ticket',
  queryKeys: queryKeys.tickets,
  apiClient: {
    list: () => getApiClient().getTickets(),
    getById: (_, id: number) => getApiClient().getTicket(id), // TODO: Add to generated client
    create: (_, data: CreateTicketRequest) => getApiClient().createTicket(data),
    update: (_, id: number, data: Partial<CreateTicketRequest>) => getApiClient().updateTicket(id, data), // TODO: Add to generated client
    delete: (_, id: number) => getApiClient().deleteTicket(id), // TODO: Add to generated client
  },
  messages: {
    createSuccess: (ticket) => `Ticket "${ticket.title}" created successfully`,
    updateSuccess: (ticket) => `Ticket "${ticket.title}" updated successfully`,
    deleteSuccess: 'Ticket deleted successfully',
  },
  optimistic: {
    enabled: true,
  },
  invalidation: {
    onCreate: 'lists',
    onUpdate: ['lists', 'details'],
    onDelete: 'all',
  }
})

export const useTickets = ticketHooks.useList
export const useTicket = ticketHooks.useGetById
export const useCreateTicket = ticketHooks.useCreate
export const useUpdateTicket = ticketHooks.useUpdate
export const useDeleteTicket = ticketHooks.useDelete
export const useTicketPrefetch = ticketHooks.usePrefetch
export const useTicketInvalidate = ticketHooks.useInvalidate

// =============================================================================
// CHATS - Advanced Factory Hooks
// =============================================================================

const chatHooks = createCrudHooks({
  entityName: 'Chat',
  queryKeys: queryKeys.chats,
  apiClient: {
    list: () => getApiClient().getChats(),
    getById: (_, id: number) => getApiClient().getChat(id), // TODO: Add to generated client
    create: (_, data: CreateChatRequest) => getApiClient().createChat(data),
    update: (_, id: number, data: Partial<CreateChatRequest>) => getApiClient().updateChat(id, data), // TODO: Add to generated client
    delete: (_, id: number) => getApiClient().deleteChat(id), // TODO: Add to generated client
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
// QUEUES - Advanced Factory Hooks
// =============================================================================

const queueHooks = createCrudHooks({
  entityName: 'Queue',
  queryKeys: queryKeys.queues,
  apiClient: {
    list: () => getApiClient().getQueues(),
    getById: (_, id: number) => getApiClient().getQueue(id), // TODO: Add to generated client
    create: (_, data: CreateQueueRequest) => getApiClient().createQueue(data),
    update: (_, id: number, data: Partial<CreateQueueRequest>) => getApiClient().updateQueue(id, data), // TODO: Add to generated client
    delete: (_, id: number) => getApiClient().deleteQueue(id), // TODO: Add to generated client
  },
  messages: {
    createSuccess: (queue) => `Queue "${queue.name}" created successfully`,
    updateSuccess: (queue) => `Queue "${queue.name}" updated successfully`,
    deleteSuccess: 'Queue deleted successfully',
  },
  optimistic: {
    enabled: true,
  }
})

export const useQueues = queueHooks.useList
export const useQueue = queueHooks.useGetById
export const useCreateQueue = queueHooks.useCreate
export const useUpdateQueue = queueHooks.useUpdate
export const useDeleteQueue = queueHooks.useDelete
export const useQueuePrefetch = queueHooks.usePrefetch
export const useQueueInvalidate = queueHooks.useInvalidate

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Invalidate all entity caches
 */
export function useInvalidateAll() {
  const projectInvalidate = useProjectInvalidate()
  const ticketInvalidate = useTicketInvalidate()
  const chatInvalidate = useChatInvalidate()
  const queueInvalidate = useQueueInvalidate()
  
  return () => {
    projectInvalidate.invalidateAll()
    ticketInvalidate.invalidateAll()
    chatInvalidate.invalidateAll()
    queueInvalidate.invalidateAll()
  }
}

// =============================================================================
// TYPES
// =============================================================================

export type {
  GetProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  GetTicketsResponse,
  CreateTicketRequest,
  CreateTicketResponse,
  GetChatsResponse,
  CreateChatRequest,
  CreateChatResponse,
  GetQueuesResponse,
  CreateQueueRequest,
  CreateQueueResponse
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
