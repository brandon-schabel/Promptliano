/**
 * Entity Configuration Mappings
 * Centralized configuration for all entities using hook factory patterns
 * Maps entity types to their API client methods and configurations
 */

import type { 
  CrudApiClient, 
  CrudHookConfig, 
  OptimisticConfig,
  InvalidationStrategy 
} from '../factories/crud-hook-factory'
import { 
  PROJECT_ENHANCED_KEYS,
  TICKET_ENHANCED_KEYS,
  CHAT_ENHANCED_KEYS,
  PROMPT_ENHANCED_KEYS,
  AGENT_ENHANCED_KEYS,
  QUEUE_ENHANCED_KEYS,
  PROVIDER_KEYS_KEYS
} from './query-keys'
import type {
  ProjectSchema,
  CreateProject,
  UpdateProject,
  TicketSchema,
  CreateTicket,
  UpdateTicket,
  TaskSchema,
  CreateTask,
  UpdateTask,
  ChatSchema,
  CreateChat,
  UpdateChat,
  PromptSchema,
  CreatePrompt,
  UpdatePrompt,
  ClaudeAgentSchema,
  CreateClaudeAgent,
  UpdateClaudeAgent,
  QueueSchema,
  CreateQueue,
  UpdateQueue,
  ProviderKeySchema,
  CreateProviderKey,
  UpdateProviderKey
} from '@promptliano/database'

// Extract proper TypeScript types from schemas
type Project = typeof ProjectSchema._type
type CreateProjectBody = CreateProject
type UpdateProjectBody = UpdateProject
type Ticket = typeof TicketSchema._type
type CreateTicketBody = CreateTicket
type UpdateTicketBody = UpdateTicket
type TicketTask = typeof TaskSchema._type
type CreateTaskBody = CreateTask
type UpdateTaskBody = UpdateTask
type Chat = typeof ChatSchema._type
type CreateChatBody = CreateChat
type UpdateChatBody = UpdateChat
type Prompt = typeof PromptSchema._type
type CreatePromptBody = CreatePrompt
type UpdatePromptBody = UpdatePrompt
type ClaudeAgent = typeof ClaudeAgentSchema._type
type CreateClaudeAgentBody = CreateClaudeAgent
type UpdateClaudeAgentBody = UpdateClaudeAgent
type TaskQueue = typeof QueueSchema._type
type CreateQueueBody = CreateQueue
type UpdateQueueBody = UpdateQueue
// Import the proper ProviderKey type that handles JSON fields correctly  
import type { ProviderKey as DatabaseProviderKey } from '@promptliano/database'
type ProviderKey = DatabaseProviderKey
type CreateProviderKeyBody = CreateProviderKey
type UpdateProviderKeyBody = UpdateProviderKey
// Import additional types that we need
export type ProjectFile = {
  id: number
  name: string
  path: string
  projectId: number
  content?: string
  summary?: string
}

// ============================================================================
// Entity Type Definitions
// ============================================================================

export interface BaseEntity {
  id: number
  createdAt?: number
  updatedAt?: number
}

export interface ProjectEntity extends BaseEntity {
  name: string
  path: string
  description?: string
}

export interface TicketEntity extends BaseEntity {
  projectId: number
  title: string
  description?: string
  status: string
  priority?: number
}

export interface TaskEntity extends BaseEntity {
  ticketId: number
  title: string
  description?: string
  status: string
  completed: boolean
}

export interface ChatEntity extends BaseEntity {
  title: string
  systemMessage?: string
  provider: string
  model: string
}

export interface PromptEntity extends BaseEntity {
  name: string
  content: string
  projectId?: number
  tags?: string[]
}

export interface AgentEntity extends Omit<BaseEntity, 'id'> {
  id: string // Agents use string IDs
  name: string
  description?: string
  capabilities?: string[]
  createdAt?: number
  updatedAt?: number
}

export interface FileEntity extends BaseEntity {
  name: string
  path: string
  projectId: number
  content?: string
  summary?: string
}

export interface QueueEntity extends BaseEntity {
  name: string
  description?: string
  projectId: number
  status: string
  maxParallelItems: number
}

export interface KeyEntity extends BaseEntity {
  provider: string
  keyName: string
  isValid: boolean
}

// ============================================================================
// API Client Configurations
// ============================================================================

/**
 * Project API Client Configuration
 */
export const projectApiClient: CrudApiClient<Project, CreateProjectBody, UpdateProjectBody> = {
  list: (client) => client.projects.listProjects().then((r: any) => r?.data || r),
  getById: (client, id) => client.projects.getProject(id).then((r: any) => r?.data || r),
  create: (client, data) => client.projects.createProject(data).then((r: any) => r?.data || r),
  update: (client, id, data) => client.projects.updateProject(id, data).then((r: any) => r?.data || r),
  delete: (client, id) => client.projects.deleteProject(id).then(() => undefined)
}

/**
 * Ticket API Client Configuration
 */
export const ticketApiClient: CrudApiClient<Ticket, CreateTicketBody, UpdateTicketBody, { projectId: number; status?: string }> = {
  list: (client, params) => client.tickets.listTickets(params?.projectId, params?.status).then((r: any) => r?.data || r),
  getById: (client, id) => client.tickets.getTicket(id).then((r: any) => r?.data || r),
  create: (client, data) => client.tickets.createTicket(data).then((r: any) => r?.data || r),
  update: (client, id, data) => client.tickets.updateTicket(id, data).then((r: any) => r?.data || r),
  delete: (client, id) => client.tickets.deleteTicket(id).then(() => undefined)
}

/**
 * Task API Client Configuration
 */
export const taskApiClient: CrudApiClient<TicketTask, CreateTaskBody, UpdateTaskBody, { ticketId: number }> = {
  list: (client, params) => client.tickets.getTasks(params!.ticketId).then((r: any) => r?.data || r),
  getById: (client, id) => {
    // Tasks don't have direct getById, need to implement custom logic
    throw new Error('Task getById requires ticketId context')
  },
  create: (client, data) => {
    // Tasks need ticketId for creation, will be handled in wrapper
    throw new Error('Task create requires ticketId context')
  },
  update: (client, id, data) => {
    // Tasks need ticketId for update, will be handled in wrapper
    throw new Error('Task update requires ticketId context')
  },
  delete: (client, id) => {
    // Tasks need ticketId for deletion, will be handled in wrapper
    throw new Error('Task delete requires ticketId context')
  }
}

/**
 * Chat API Client Configuration
 */
export const chatApiClient: CrudApiClient<Chat, CreateChatBody, UpdateChatBody> = {
  list: (client) => client.chats.listChats().then((r: any) => r?.data || r),
  getById: (client, id) => client.chats.getChat(id).then((r: any) => r?.data || r),
  create: (client, data) => client.chats.createChat(data).then((r: any) => r?.data || r),
  update: (client, id, data) => client.chats.updateChat(id, data).then((r: any) => r?.data || r),
  delete: (client, id) => client.chats.deleteChat(id).then(() => undefined)
}

/**
 * Prompt API Client Configuration
 */
export const promptApiClient: CrudApiClient<Prompt, CreatePromptBody, UpdatePromptBody, { projectId?: number }> = {
  list: (client, params) => {
    if (params?.projectId) {
      return client.prompts.getProjectPrompts(params.projectId).then((r: any) => r?.data || r)
    }
    return client.prompts.listPrompts().then((r: any) => r?.data || r)
  },
  getById: (client, id) => client.prompts.getPrompt(id).then((r: any) => r?.data || r),
  create: (client, data) => client.prompts.createPrompt(data).then((r: any) => r?.data || r),
  update: (client, id, data) => client.prompts.updatePrompt(id, data).then((r: any) => r?.data || r),
  delete: (client, id) => client.prompts.deletePrompt(id).then(() => undefined)
}

/**
 * Agent API Client Configuration
 */
export const agentApiClient: CrudApiClient<ClaudeAgent, CreateClaudeAgentBody, UpdateClaudeAgentBody, { projectId?: number }> = {
  list: (client, params) => client.agents.listAgents(params?.projectId).then((r: any) => r?.data || r),
  getById: (client, id) => client.agents.getAgent(typeof id === 'string' ? id : id.toString()).then((r: any) => r?.data || r),
  create: (client, data) => client.agents.createAgent(data).then((r: any) => r?.data || r),
  update: (client, id, data) => client.agents.updateAgent(typeof id === 'string' ? id : id.toString(), data).then((r: any) => r?.data || r),
  delete: (client, id) => client.agents.deleteAgent(typeof id === 'string' ? id : id.toString()).then(() => undefined)
}

/**
 * Queue API Client Configuration
 */
export const queueApiClient: CrudApiClient<TaskQueue, CreateQueueBody, UpdateQueueBody, { projectId: number }> = {
  list: (client, params) => client.queues.listQueues(params!.projectId).then((r: any) => r?.data || r),
  getById: (client, id) => client.queues.getQueue(id).then((r: any) => r?.data || r),
  create: (client, data) => {
    // Queues need projectId for creation, will be handled in wrapper
    throw new Error('Queue create requires projectId context')
  },
  update: (client, id, data) => client.queues.updateQueue(id, data).then((r: any) => r?.data || r),
  delete: (client, id) => client.queues.deleteQueue(id).then(() => undefined)
}

/**
 * Provider Key API Client Configuration
 */
export const keyApiClient: CrudApiClient<ProviderKey, CreateProviderKeyBody, UpdateProviderKeyBody> = {
  list: (client) => client.keys.listKeys().then((r: any) => r?.data || r),
  getById: (client, id) => client.keys.getKey(id).then((r: any) => r?.data || r),
  create: (client, data) => client.keys.createKey(data).then((r: any) => r?.data || r),
  update: (client, id, data) => client.keys.updateKey(id, data).then((r: any) => r?.data || r),
  delete: (client, id) => client.keys.deleteKey(id).then(() => undefined)
}

// ============================================================================
// Optimistic Update Configurations
// ============================================================================

export const projectOptimisticConfig: OptimisticConfig<Project> = {
  enabled: true,
  createOptimisticEntity: (data: CreateProjectBody) => ({
    ...data,
    id: -Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    fileCount: 0,
    totalSizeBytes: 0,
    lastSyncedAt: null
  } as Project),
  updateOptimisticEntity: (old, data) => ({
    ...old,
    ...data,
    updatedAt: Date.now()
  }),
  deleteStrategy: 'remove'
}

export const ticketOptimisticConfig: OptimisticConfig<Ticket> = {
  enabled: true,
  createOptimisticEntity: (data: CreateTicketBody) => ({
    ...data,
    id: -Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: data.status || 'open',
    priority: data.priority || 3
  } as Ticket),
  updateOptimisticEntity: (old, data) => ({
    ...old,
    ...data,
    updatedAt: Date.now()
  }),
  deleteStrategy: 'remove'
}

export const chatOptimisticConfig: OptimisticConfig<Chat> = {
  enabled: true,
  createOptimisticEntity: (data: CreateChatBody) => ({
    ...data,
    id: -Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0
  } as Chat),
  updateOptimisticEntity: (old, data) => ({
    ...old,
    ...data,
    updatedAt: Date.now()
  }),
  deleteStrategy: 'remove'
}

export const promptOptimisticConfig: OptimisticConfig<Prompt> = {
  enabled: true,
  createOptimisticEntity: (data: CreatePromptBody) => ({
    ...data,
    id: -Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: data.tags || []
  } as Prompt),
  updateOptimisticEntity: (old, data) => ({
    ...old,
    ...data,
    updatedAt: Date.now()
  }),
  deleteStrategy: 'remove'
}

// ============================================================================
// Invalidation Strategies
// ============================================================================

export const projectInvalidationStrategy: InvalidationStrategy = {
  onCreate: 'lists',
  onUpdate: ['lists', 'detail'],
  onDelete: 'all',
  cascadeInvalidate: true
}

export const ticketInvalidationStrategy: InvalidationStrategy = {
  onCreate: 'lists',
  onUpdate: ['lists', 'detail'],
  onDelete: 'all',
  cascadeInvalidate: true
}

export const chatInvalidationStrategy: InvalidationStrategy = {
  onCreate: 'lists',
  onUpdate: ['lists', 'detail'],
  onDelete: 'all',
  cascadeInvalidate: false
}

export const promptInvalidationStrategy: InvalidationStrategy = {
  onCreate: 'lists',
  onUpdate: ['lists', 'detail'],
  onDelete: 'all',
  cascadeInvalidate: true
}

// ============================================================================
// Complete Entity Configurations
// ============================================================================

export const PROJECT_CONFIG: CrudHookConfig<Project, CreateProjectBody, UpdateProjectBody> = {
  entityName: 'project',
  queryKeys: PROJECT_ENHANCED_KEYS,
  apiClient: projectApiClient,
  staleTime: 5 * 60 * 1000, // 5 minutes
  optimistic: projectOptimisticConfig,
  invalidation: projectInvalidationStrategy,
  prefetch: { enabled: true, prefetchOnHover: true }
}

export const TICKET_CONFIG: CrudHookConfig<Ticket, CreateTicketBody, UpdateTicketBody, { projectId: number; status?: string }> = {
  entityName: 'ticket',
  queryKeys: TICKET_ENHANCED_KEYS,
  apiClient: ticketApiClient,
  staleTime: 2 * 60 * 1000, // 2 minutes - tickets change frequently
  optimistic: ticketOptimisticConfig,
  invalidation: ticketInvalidationStrategy,
  prefetch: { enabled: true }
}

export const CHAT_CONFIG: CrudHookConfig<Chat, CreateChatBody, UpdateChatBody> = {
  entityName: 'chat',
  queryKeys: CHAT_ENHANCED_KEYS,
  apiClient: chatApiClient,
  staleTime: 5 * 60 * 1000,
  optimistic: chatOptimisticConfig,
  invalidation: chatInvalidationStrategy,
  prefetch: { enabled: true }
}

export const PROMPT_CONFIG: CrudHookConfig<Prompt, CreatePromptBody, UpdatePromptBody, { projectId?: number }> = {
  entityName: 'prompt',
  queryKeys: PROMPT_ENHANCED_KEYS,
  apiClient: promptApiClient,
  staleTime: 5 * 60 * 1000,
  optimistic: promptOptimisticConfig,
  invalidation: promptInvalidationStrategy,
  prefetch: { enabled: true }
}

export const AGENT_CONFIG: CrudHookConfig<ClaudeAgent, CreateClaudeAgentBody, UpdateClaudeAgentBody, { projectId?: number }> = {
  entityName: 'agent',
  queryKeys: AGENT_ENHANCED_KEYS,
  apiClient: agentApiClient,
  staleTime: 5 * 60 * 1000,
  optimistic: { enabled: false }, // Agents are more complex, disable optimistic updates initially
  invalidation: { onCreate: 'lists', onUpdate: 'lists', onDelete: 'all' },
  prefetch: { enabled: true }
}

export const QUEUE_CONFIG: CrudHookConfig<TaskQueue, CreateQueueBody, UpdateQueueBody, { projectId: number }> = {
  entityName: 'queue',
  queryKeys: QUEUE_ENHANCED_KEYS,
  apiClient: queueApiClient,
  staleTime: 30 * 1000, // 30 seconds - queues are dynamic
  optimistic: { enabled: false }, // Queues are complex, use server state
  invalidation: { onCreate: 'lists', onUpdate: 'lists', onDelete: 'all' },
  prefetch: { enabled: false }
}

export const KEY_CONFIG: CrudHookConfig<ProviderKey, CreateProviderKeyBody, UpdateProviderKeyBody> = {
  entityName: 'key',
  queryKeys: PROVIDER_KEYS_KEYS,
  apiClient: keyApiClient,
  staleTime: 10 * 60 * 1000, // 10 minutes - keys don't change often
  optimistic: { enabled: false }, // Keys are sensitive, use server confirmation
  invalidation: { onCreate: 'lists', onUpdate: 'lists', onDelete: 'all' },
  prefetch: { enabled: false }
}

// ============================================================================
// Entity Configuration Registry
// ============================================================================

export const ENTITY_CONFIGS = {
  project: PROJECT_CONFIG,
  ticket: TICKET_CONFIG,
  chat: CHAT_CONFIG,
  prompt: PROMPT_CONFIG,
  agent: AGENT_CONFIG,
  queue: QUEUE_CONFIG,
  key: KEY_CONFIG
} as const

export type ConfiguredEntityName = keyof typeof ENTITY_CONFIGS

/**
 * Get configuration for a specific entity
 */
export function getEntityConfig<T extends ConfiguredEntityName>(
  entityName: T
): typeof ENTITY_CONFIGS[T] {
  return ENTITY_CONFIGS[entityName]
}

/**
 * Custom entity messages for better UX
 */
export const ENTITY_MESSAGES = {
  project: {
    createSuccess: (entity: Project) => `Project "${entity.name}" created successfully`,
    updateSuccess: (entity: Project) => `Project "${entity.name}" updated successfully`,
    deleteSuccess: 'Project deleted successfully'
  },
  ticket: {
    createSuccess: (entity: Ticket) => `Ticket "${entity.title}" created successfully`,
    updateSuccess: (entity: Ticket) => `Ticket "${entity.title}" updated successfully`,
    deleteSuccess: 'Ticket deleted successfully'
  },
  chat: {
    createSuccess: (entity: Chat) => `Chat "${entity.title}" created successfully`,
    updateSuccess: (entity: Chat) => `Chat "${entity.title}" updated successfully`,
    deleteSuccess: 'Chat deleted successfully'
  },
  prompt: {
    createSuccess: (entity: Prompt) => `Prompt "${(entity as any).name || (entity as any).title || 'Prompt'}" created successfully`,
    updateSuccess: (entity: Prompt) => `Prompt "${(entity as any).name || (entity as any).title || 'Prompt'}" updated successfully`,
    deleteSuccess: 'Prompt deleted successfully'
  },
  agent: {
    createSuccess: (entity: ClaudeAgent) => `Agent "${entity.name}" created successfully`,
    updateSuccess: (entity: ClaudeAgent) => `Agent "${entity.name}" updated successfully`,
    deleteSuccess: 'Agent deleted successfully'
  },
  queue: {
    createSuccess: (entity: TaskQueue) => `Queue "${entity.name}" created successfully`,
    updateSuccess: (entity: TaskQueue) => `Queue "${entity.name}" updated successfully`,
    deleteSuccess: 'Queue deleted successfully'
  },
  key: {
    createSuccess: 'API key created successfully',
    updateSuccess: 'API key updated successfully',
    deleteSuccess: 'API key deleted successfully'
  }
} as const