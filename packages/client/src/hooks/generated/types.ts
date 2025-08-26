/**
 * Generated Hook Types
 * Comprehensive type exports for all generated entity hooks
 * Provides full TypeScript support for the hook factory system
 */

import type { UseQueryOptions, UseMutationOptions, UseInfiniteQueryOptions, QueryClient } from '@tanstack/react-query'

// Import ApiError from shared package to avoid conflicts
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Re-export all entity types from schemas
// ============================================================================

// Import schema types from schemas package to get properly typed schemas with JSON fields as typed arrays
import type {
  // Tickets & Tasks - use schemas with proper typing for JSON fields
  TicketSchema,
  TicketTaskSchema,

  // Prompts
  PromptSchema,

  // Export the inferred types directly
  Ticket,
  TicketTask,
  Prompt,
  TicketWithTasks
} from '@promptliano/schemas'

// Import database types for entities that don't have JSON type issues
import type {
  // Core Entities - these don't have JSON field issues
  ProjectSchema,
  CreateProject,
  UpdateProject,

  // Chats & Messages - these don't have problematic JSON fields
  ChatSchema,
  CreateChat,
  UpdateChat,
  ChatMessageSchema,

  // Agents
  ClaudeAgentSchema,
  CreateClaudeAgent,
  UpdateClaudeAgent,

  // Queues
  QueueSchema,
  CreateQueue,
  UpdateQueue,

  // Provider Keys
  ProviderKeySchema,
  CreateProviderKey,
  UpdateProviderKey
} from '@promptliano/database'

// Re-export as proper TypeScript types
export type Project = typeof ProjectSchema._type
export type CreateProjectBody = CreateProject
export type UpdateProjectBody = UpdateProject

// Use the properly typed exports from schemas package for entities with JSON fields
export { Ticket, TicketTask, Prompt, TicketWithTasks }

// Create type aliases for backward compatibility
export type CreateTicketBody = any // TODO: Add proper create schema types
export type UpdateTicketBody = any // TODO: Add proper update schema types
export type CreateTaskBody = any // TODO: Add proper create schema types
export type UpdateTaskBody = any // TODO: Add proper update schema types

export type Chat = typeof ChatSchema._type
export type CreateChatBody = CreateChat
export type UpdateChatBody = UpdateChat

export type ChatMessage = typeof ChatMessageSchema._type

export type ClaudeAgent = typeof ClaudeAgentSchema._type
export type CreateClaudeAgentBody = CreateClaudeAgent
export type UpdateClaudeAgentBody = UpdateClaudeAgent

// Prompt types already exported above from schemas package
export type CreatePromptBody = any // TODO: Add proper create schema types
export type UpdatePromptBody = any // TODO: Add proper update schema types

export type TaskQueue = typeof QueueSchema._type & {
  status?: 'active' | 'paused' | 'completed'
  isActive?: boolean
}
export type CreateQueueBody = CreateQueue
export type UpdateQueueBody = UpdateQueue

// Import the proper ProviderKey type that handles JSON fields correctly
import type { ProviderKey as DatabaseProviderKey } from '@promptliano/database'
export type ProviderKey = DatabaseProviderKey
export type CreateProviderKeyBody = CreateProviderKey
export type UpdateProviderKeyBody = UpdateProviderKey

// Define types that were previously imported from schemas
export type ProjectFile = {
  id: number
  name: string
  path: string
  projectId: number
  content?: string
  summary?: string
  size?: number
  lastModified?: number
}

export type AiChatStreamRequest = {
  messages: any[]
  model?: string
  provider?: string
  stream?: boolean
}

// Files & Content
export type FileRelevance = {
  file: string
  relevance: number
  reason: string
}

export type FileSummarizationStats = {
  totalFiles: number
  summarizedFiles: number
  avgSummaryLength: number
}

export type SummaryOptions = {
  maxLength?: number
  includeCode?: boolean
  focusAreas?: string[]
}

// Markdown Import/Export
export type MarkdownImportRequest = {
  content: string
  projectId: number
  fileName?: string
}

export type MarkdownExportRequest = {
  projectId: number
  includeFiles?: boolean
  format?: 'markdown' | 'html'
}

export type BatchExportRequest = {
  projectIds: number[]
  format: 'markdown' | 'html' | 'json'
}

// Git Operations
export type GitBranch = {
  name: string
  current: boolean
  remote?: boolean
}

// Common Types
export type DataResponse<T = any> = {
  success: true
  data: T
}

export type PaginatedResponse<T = any> = {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Additional types that may be from database or computed
export type ProjectSummary = {
  id: number
  name: string
  fileCount: number
  totalSizeBytes: number
}

export type ProjectStatistics = {
  fileCount: number
  totalSizeBytes: number
  lastSyncedAt: number | null
}

// Use TicketWithTasks from schemas package - it has the correct nested structure
export type TicketWithTasksNested = TicketWithTasks

export type TicketWithTaskCount = Ticket & {
  taskCount: number
}

export type ReorderTasksBody = {
  taskIds: number[]
}

export type OptimizePromptRequest = {
  content: string
  context?: string
}

export type QueueItem = {
  id: number
  queueId: number
  ticketId?: number
  taskId?: number
  itemType: 'ticket' | 'task'
  itemId: number
  priority: number
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'pending'
  agentId?: string
  startedAt?: number
  completedAt?: number
  errorMessage?: string
  createdAt: number
}

export type QueueStats = {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  currentAgents: string[]
  completedItems: number
  totalItems: number
  averageProcessingTime?: number
}

export type QueueWithStats = TaskQueue & {
  stats: QueueStats
}

export type EnqueueItemBody = {
  ticketId?: number
  taskId?: number
  priority?: number
}

export type BatchEnqueueBody = {
  items: EnqueueItemBody[]
}

export type GetNextTaskResponse = {
  item: QueueItem | null
  hasMore: boolean
}

export type BulkImportResponse = {
  imported: number
  skipped: number
  errors: string[]
}

export type MarkdownExportResponse = {
  content: string
  metadata: Record<string, any>
}

export type MarkdownContentValidation = {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export type GitStatus = {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
}

export type GitCommit = {
  hash: string
  message: string
  author: string
  date: string
}

export type GitDiff = {
  file: string
  hunks: any[]
}

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
  data:
    | {
        pages: TData[]
        pageParams: unknown[]
      }
    | undefined
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
  useCreate: (
    options?: UseMutationOptions<Project, ApiError, CreateProjectBody>
  ) => MutationHookReturn<Project, ApiError, CreateProjectBody>
  useUpdate: (
    options?: UseMutationOptions<Project, ApiError, { id: number; data: UpdateProjectBody }>
  ) => MutationHookReturn<Project, ApiError, { id: number; data: UpdateProjectBody }>
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
  useList: (
    params?: { projectId: number; status?: string },
    options?: UseQueryOptions<Ticket[], ApiError>
  ) => QueryHookReturn<Ticket[]>
  useGetById: (id: number, options?: UseQueryOptions<Ticket, ApiError>) => QueryHookReturn<Ticket>
  useCreate: (
    options?: UseMutationOptions<Ticket, ApiError, CreateTicketBody>
  ) => MutationHookReturn<Ticket, ApiError, CreateTicketBody>
  useUpdate: (
    options?: UseMutationOptions<Ticket, ApiError, { id: number; data: UpdateTicketBody }>
  ) => MutationHookReturn<Ticket, ApiError, { id: number; data: UpdateTicketBody }>
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
  useCreate: (
    options?: UseMutationOptions<Chat, ApiError, CreateChatBody>
  ) => MutationHookReturn<Chat, ApiError, CreateChatBody>
  useUpdate: (
    options?: UseMutationOptions<Chat, ApiError, { id: number; data: UpdateChatBody }>
  ) => MutationHookReturn<Chat, ApiError, { id: number; data: UpdateChatBody }>
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
  useCreate: (
    options?: UseMutationOptions<Prompt, ApiError, CreatePromptBody>
  ) => MutationHookReturn<Prompt, ApiError, CreatePromptBody>
  useUpdate: (
    options?: UseMutationOptions<Prompt, ApiError, { id: number; data: UpdatePromptBody }>
  ) => MutationHookReturn<Prompt, ApiError, { id: number; data: UpdatePromptBody }>
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
  useSuggestFiles: () => MutationHookReturn<
    ProjectFile[],
    ApiError,
    { projectId: number; prompt: string; limit?: number }
  >
  useSummarizeFiles: () => MutationHookReturn<any, ApiError, { projectId: number; fileIds: number[]; force?: boolean }>
}

/**
 * Enhanced Ticket Hook Types with Task Management
 */
export interface EnhancedTicketHooks extends TicketHooks {
  useTicketTasks: (ticketId: number) => QueryHookReturn<TicketTask[]>
  useCreateTask: () => MutationHookReturn<TicketTask, ApiError, { ticketId: number; data: CreateTaskBody }>
  useUpdateTask: () => MutationHookReturn<
    TicketTask,
    ApiError,
    { ticketId: number; taskId: number; data: UpdateTaskBody }
  >
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
  useList: (
    params: { projectId: number },
    options?: UseQueryOptions<TaskQueue[], ApiError>
  ) => QueryHookReturn<TaskQueue[]>
  useGetById: (id: number, options?: UseQueryOptions<TaskQueue, ApiError>) => QueryHookReturn<TaskQueue>
  useCreate: (projectId: number) => MutationHookReturn<TaskQueue, ApiError, Omit<CreateQueueBody, 'projectId'>>
  useUpdate: (
    options?: UseMutationOptions<TaskQueue, ApiError, { id: number; data: UpdateQueueBody }>
  ) => MutationHookReturn<TaskQueue, ApiError, { id: number; data: UpdateQueueBody }>
  useDelete: (options?: UseMutationOptions<void, ApiError, number>) => MutationHookReturn<void, ApiError, number>
  useQueueStats: (queueId: number) => QueryHookReturn<QueueStats>
  useQueueItems: (queueId: number, status?: string) => QueryHookReturn<QueueItem[]>
  useEnqueueTicket: (
    queueId: number
  ) => MutationHookReturn<QueueItem[], ApiError, { ticketId: number; priority?: number }>
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
  useCreate: (
    options?: UseMutationOptions<TEntity, ApiError, TCreate>
  ) => MutationHookReturn<TEntity, ApiError, TCreate>
  useUpdate: (
    options?: UseMutationOptions<TEntity, ApiError, { id: number; data: TUpdate }>
  ) => MutationHookReturn<TEntity, ApiError, { id: number; data: TUpdate }>
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
