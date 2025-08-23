/**
 * Generated Hook Types
 * Comprehensive type exports for all generated entity hooks
 * Provides full TypeScript support for the hook factory system
 */

import type {
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions,
  QueryClient
} from '@tanstack/react-query'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Re-export all entity types from schemas
// ============================================================================

export type {
  // Core Entities
  Project,
  CreateProjectBody,
  UpdateProjectBody,
  ProjectFile,
  ProjectSummary,
  ProjectStatistics,
  
  // Tickets & Tasks
  Ticket,
  CreateTicketBody,
  UpdateTicketBody,
  TicketTask,
  CreateTaskBody,
  UpdateTaskBody,
  TicketWithTasks,
  TicketWithTaskCount,
  ReorderTasksBody,
  
  // Chats & Messages
  Chat,
  CreateChatBody,
  UpdateChatBody,
  ChatMessage,
  AiChatStreamRequest,
  
  // Prompts
  Prompt,
  CreatePromptBody,
  UpdatePromptBody,
  OptimizePromptRequest,
  
  // Agents
  ClaudeAgent,
  CreateClaudeAgentBody,
  UpdateClaudeAgentBody,
  
  // Queues
  TaskQueue,
  CreateQueueBody,
  UpdateQueueBody,
  QueueItem,
  QueueStats,
  QueueWithStats,
  EnqueueItemBody,
  BatchEnqueueBody,
  GetNextTaskResponse,
  
  // Provider Keys
  ProviderKey,
  CreateProviderKeyBody,
  UpdateProviderKeyBody,
  
  // Files & Content
  FileRelevance,
  FileSummarization,
  SummaryOptions,
  
  // Markdown Import/Export
  MarkdownImportRequest,
  MarkdownExportRequest,
  BatchExportRequest,
  BulkImportResponse,
  MarkdownExportResponse,
  MarkdownContentValidation,
  
  // Git Operations
  GitBranch,
  GitStatus,
  GitCommit,
  GitDiff,
  
  // Common Types
  DataResponseSchema,
  PaginatedResponse
} from '@promptliano/schemas'

// ============================================================================
// Hook Return Type Definitions
// ============================================================================

/**
 * Standard Query Hook Return Type
 */
export interface QueryHookReturn<TData, TError = ApiError> {
  data: TData | undefined
  error: TError | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  isFetching: boolean
  isStale: boolean
  refetch: () => void
  status: 'loading' | 'error' | 'success'
}

/**
 * Standard Mutation Hook Return Type
 */
export interface MutationHookReturn<TData, TError = ApiError, TVariables = void> {
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  data: TData | undefined
  error: TError | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  isPending: boolean
  status: 'idle' | 'loading' | 'error' | 'success'
  reset: () => void
}

/**
 * Infinite Query Hook Return Type
 */
export interface InfiniteQueryHookReturn<TData, TError = ApiError> {
  data: {
    pages: TData[]
    pageParams: unknown[]
  } | undefined
  error: TError | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  status: 'loading' | 'error' | 'success'
}

// ============================================================================
// Entity-Specific Hook Types
// ============================================================================

/**
 * Project Hook Types
 */
export interface ProjectHooks {
  useList: (options?: UseQueryOptions<Project[], ApiError>) => QueryHookReturn<Project[]>
  useGetById: (id: number, options?: UseQueryOptions<Project, ApiError>) => QueryHookReturn<Project>
  useCreate: (options?: UseMutationOptions<Project, ApiError, CreateProjectBody>) => MutationHookReturn<Project, ApiError, CreateProjectBody>
  useUpdate: (options?: UseMutationOptions<Project, ApiError, { id: number; data: UpdateProjectBody }>) => MutationHookReturn<Project, ApiError, { id: number; data: UpdateProjectBody }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  usePrefetch: () => {
    prefetchList: () => Promise<void>
    prefetchById: (id: number) => Promise<void>
  }
  useInvalidate: () => {
    invalidateAll: () => void
    invalidateLists: () => void
    invalidateDetail: (id: number) => void
    setDetail: (project: Project) => void
    removeDetail: (id: number) => void
  }
}

/**
 * Ticket Hook Types
 */
export interface TicketHooks {
  useList: (params?: { projectId: number; status?: string }, options?: UseQueryOptions<Ticket[], ApiError>) => QueryHookReturn<Ticket[]>
  useGetById: (id: number, options?: UseQueryOptions<Ticket, ApiError>) => QueryHookReturn<Ticket>
  useCreate: (options?: UseMutationOptions<Ticket, ApiError, CreateTicketBody>) => MutationHookReturn<Ticket, ApiError, CreateTicketBody>
  useUpdate: (options?: UseMutationOptions<Ticket, ApiError, { id: number; data: UpdateTicketBody }>) => MutationHookReturn<Ticket, ApiError, { id: number; data: UpdateTicketBody }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  usePrefetch: () => {
    prefetchList: (params?: { projectId: number; status?: string }) => Promise<void>
    prefetchById: (id: number) => Promise<void>
  }
  useInvalidate: () => {
    invalidateAll: () => void
    invalidateLists: () => void
    invalidateDetail: (id: number) => void
    setDetail: (ticket: Ticket) => void
    removeDetail: (id: number) => void
  }
}

/**
 * Chat Hook Types
 */
export interface ChatHooks {
  useList: (options?: UseQueryOptions<Chat[], ApiError>) => QueryHookReturn<Chat[]>
  useGetById: (id: number, options?: UseQueryOptions<Chat, ApiError>) => QueryHookReturn<Chat>
  useCreate: (options?: UseMutationOptions<Chat, ApiError, CreateChatBody>) => MutationHookReturn<Chat, ApiError, CreateChatBody>
  useUpdate: (options?: UseMutationOptions<Chat, ApiError, { id: number; data: UpdateChatBody }>) => MutationHookReturn<Chat, ApiError, { id: number; data: UpdateChatBody }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  usePrefetch: () => {
    prefetchList: () => Promise<void>
    prefetchById: (id: number) => Promise<void>
  }
  useInvalidate: () => {
    invalidateAll: () => void
    invalidateLists: () => void
    invalidateDetail: (id: number) => void
    setDetail: (chat: Chat) => void
    removeDetail: (id: number) => void
  }
}

/**
 * Prompt Hook Types
 */
export interface PromptHooks {
  useList: (params?: { projectId?: number }, options?: UseQueryOptions<Prompt[], ApiError>) => QueryHookReturn<Prompt[]>
  useGetById: (id: number, options?: UseQueryOptions<Prompt, ApiError>) => QueryHookReturn<Prompt>
  useCreate: (options?: UseMutationOptions<Prompt, ApiError, CreatePromptBody>) => MutationHookReturn<Prompt, ApiError, CreatePromptBody>
  useUpdate: (options?: UseMutationOptions<Prompt, ApiError, { id: number; data: UpdatePromptBody }>) => MutationHookReturn<Prompt, ApiError, { id: number; data: UpdatePromptBody }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  usePrefetch: () => {
    prefetchList: (params?: { projectId?: number }) => Promise<void>
    prefetchById: (id: number) => Promise<void>
  }
  useInvalidate: () => {
    invalidateAll: () => void
    invalidateLists: () => void
    invalidateDetail: (id: number) => void
    setDetail: (prompt: Prompt) => void
    removeDetail: (id: number) => void
  }
}

// ============================================================================
// Advanced Hook Types
// ============================================================================

/**
 * Enhanced Project Hook Types with Additional Operations
 */
export interface EnhancedProjectHooks extends ProjectHooks {
  useProjectFiles: (projectId: number) => QueryHookReturn<ProjectFile[]>
  useProjectSync: () => MutationHookReturn<void, ApiError, number>
  useProjectSummary: (projectId: number) => QueryHookReturn<ProjectSummary>
  useProjectStatistics: (projectId: number) => QueryHookReturn<ProjectStatistics>
  useSuggestFiles: () => MutationHookReturn<ProjectFile[], ApiError, { projectId: number; prompt: string; limit?: number }>
  useSummarizeFiles: () => MutationHookReturn<any, ApiError, { projectId: number; fileIds: number[]; force?: boolean }>
}

/**
 * Enhanced Ticket Hook Types with Task Management
 */
export interface EnhancedTicketHooks extends TicketHooks {
  useTicketTasks: (ticketId: number) => QueryHookReturn<TicketTask[]>
  useCreateTask: () => MutationHookReturn<TicketTask, ApiError, { ticketId: number; data: CreateTaskBody }>
  useUpdateTask: () => MutationHookReturn<TicketTask, ApiError, { ticketId: number; taskId: number; data: UpdateTaskBody }>
  useDeleteTask: () => MutationHookReturn<void, ApiError, { ticketId: number; taskId: number }>
  useCompleteTicket: () => MutationHookReturn<any, ApiError, number>
  useSuggestTasks: () => MutationHookReturn<TicketTask[], ApiError, { ticketId: number; userContext?: string }>
  useAutoGenerateTasks: () => MutationHookReturn<TicketTask[], ApiError, number>
}

/**
 * Enhanced Chat Hook Types with Message Management
 */
export interface EnhancedChatHooks extends ChatHooks {
  useChatMessages: (chatId: number) => QueryHookReturn<ChatMessage[]>
  useStreamChat: () => MutationHookReturn<any, ApiError, AiChatStreamRequest>
  useForkChat: () => MutationHookReturn<Chat, ApiError, { chatId: number; excludeMessageIds?: number[] }>
  useDeleteMessage: () => MutationHookReturn<void, ApiError, { chatId: number; messageId: number }>
}

/**
 * Enhanced Queue Hook Types with Stats and Items
 */
export interface EnhancedQueueHooks {
  useList: (params: { projectId: number }, options?: UseQueryOptions<TaskQueue[], ApiError>) => QueryHookReturn<TaskQueue[]>
  useGetById: (id: number, options?: UseQueryOptions<TaskQueue, ApiError>) => QueryHookReturn<TaskQueue>
  useCreate: (projectId: number) => MutationHookReturn<TaskQueue, ApiError, Omit<CreateQueueBody, 'projectId'>>
  useUpdate: (options?: UseMutationOptions<TaskQueue, ApiError, { id: number; data: UpdateQueueBody }>) => MutationHookReturn<TaskQueue, ApiError, { id: number; data: UpdateQueueBody }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  useQueueStats: (queueId: number) => QueryHookReturn<QueueStats>
  useQueueItems: (queueId: number, status?: string) => QueryHookReturn<QueueItem[]>
  useEnqueueTicket: (queueId: number) => MutationHookReturn<QueueItem[], ApiError, { ticketId: number; priority?: number }>
  useGetNextTask: () => MutationHookReturn<GetNextTaskResponse, ApiError, { queueId: number; agentId?: string }>
}

// ============================================================================
// Utility Hook Types
// ============================================================================

/**
 * Batch Operations Hook Types
 */
export interface BatchOperationsHooks {
  invalidateMultiple: (entityNames: string[]) => void
  prefetchProjectData: (projectId: number) => Promise<void>
}

/**
 * Real-time Sync Hook Types
 */
export interface RealtimeSyncHooks {
  syncProjectData: (projectId: number) => void
  refreshAll: () => void
}

/**
 * Analytics Hook Types
 */
export interface AnalyticsHooks {
  getCacheStats: () => {
    totalQueries: number
    staleQueries: number
    errorQueries: number
    loadingQueries: number
    successQueries: number
  }
  getEntityCacheStats: (entityName: string) => {
    totalQueries: number
    hitRate: number
    avgStaleTime: number
  }
}

// ============================================================================
// Hook Factory Types
// ============================================================================

/**
 * Configuration for creating custom entity hooks
 */
export interface CustomEntityHookConfig<TEntity, TCreate, TUpdate, TListParams = void> {
  entityName: string
  queryKeys: any
  apiClient: {
    list: (client: any, params?: TListParams) => Promise<TEntity[]>
    getById: (client: any, id: number) => Promise<TEntity>
    create: (client: any, data: TCreate) => Promise<TEntity>
    update: (client: any, id: number, data: TUpdate) => Promise<TEntity>
    delete: (client: any, id: number) => Promise<void>
  }
  staleTime?: number
  optimistic?: {
    enabled: boolean
    createOptimisticEntity?: (data: TCreate) => TEntity
    updateOptimisticEntity?: (old: TEntity, data: TUpdate) => TEntity
  }
  messages?: {
    createSuccess?: string | ((entity: TEntity) => string)
    updateSuccess?: string | ((entity: TEntity) => string)
    deleteSuccess?: string
  }
}

/**
 * Return type of the hook factory
 */
export interface GeneratedEntityHooks<TEntity, TCreate, TUpdate, TListParams = void> {
  useList: (params?: TListParams, options?: UseQueryOptions<TEntity[], ApiError>) => QueryHookReturn<TEntity[]>
  useGetById: (id: number, options?: UseQueryOptions<TEntity, ApiError>) => QueryHookReturn<TEntity>
  useCreate: (options?: UseMutationOptions<TEntity, ApiError, TCreate>) => MutationHookReturn<TEntity, ApiError, TCreate>
  useUpdate: (options?: UseMutationOptions<TEntity, ApiError, { id: number; data: TUpdate }>) => MutationHookReturn<TEntity, ApiError, { id: number; data: TUpdate }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  usePrefetch: () => {
    prefetchList: (params?: TListParams) => Promise<void>
    prefetchById: (id: number) => Promise<void>
  }
  useInvalidate: () => {
    invalidateAll: () => void
    invalidateLists: () => void
    invalidateDetail: (id: number) => void
    setDetail: (entity: TEntity) => void
    removeDetail: (id: number) => void
  }
}

// ============================================================================
// Error and Loading State Types
// ============================================================================

/**
 * Standard error handling types
 */
export interface HookError {
  message: string
  code?: string
  status?: number
  details?: any
}

/**
 * Loading state types
 */
export interface LoadingStates {
  isLoading: boolean
  isRefetching: boolean
  isFetching: boolean
  isValidating: boolean
}

/**
 * Cache state types
 */
export interface CacheStates {
  isStale: boolean
  isCached: boolean
  lastFetched?: number
  expiresAt?: number
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

/**
 * Performance metrics for hook monitoring
 */
export interface HookPerformanceMetrics {
  queryCount: number
  cacheHitRate: number
  averageResponseTime: number
  errorRate: number
  stalenessRate: number
}

/**
 * Entity-specific performance metrics
 */
export interface EntityPerformanceMetrics extends HookPerformanceMetrics {
  entityName: string
  operationsPerMinute: number
  optimisticUpdateRate: number
  invalidationFrequency: number
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // React Query base types
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions,
  QueryClient
} from '@tanstack/react-query'

export type { ApiError } from '@promptliano/shared'