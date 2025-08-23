/**
 * Query Key Factory for All Entities
 * Centralized query key management for 22+ core entities
 * Provides consistent structure across all entity types
 */

import type { QueryKeyFactory } from '../factories/crud-hook-factory'

// ============================================================================
// Core Entity Query Key Factories
// ============================================================================

export const PROJECTS_KEYS: QueryKeyFactory<void> = {
  all: ['projects'] as const,
  lists: () => [...PROJECTS_KEYS.all, 'list'] as const,
  list: () => [...PROJECTS_KEYS.lists()] as const,
  details: () => [...PROJECTS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...PROJECTS_KEYS.details(), id] as const,
  infinite: () => [...PROJECTS_KEYS.all, 'infinite'] as const
} as const

// Enhanced project query keys with file/summary variants
export const PROJECT_ENHANCED_KEYS = {
  ...PROJECTS_KEYS,
  files: (projectId: number) => [...PROJECTS_KEYS.all, 'files', projectId] as const,
  filesWithoutContent: (projectId: number) => [...PROJECTS_KEYS.all, 'filesWithoutContent', projectId] as const,
  summary: (projectId: number) => [...PROJECTS_KEYS.all, 'summary', projectId] as const,
  statistics: (projectId: number) => [...PROJECTS_KEYS.all, 'statistics', projectId] as const,
  fileVersions: (projectId: number, originalFileId: number) =>
    [...PROJECTS_KEYS.all, 'fileVersions', projectId, originalFileId] as const,
  fileVersion: (projectId: number, originalFileId: number, version?: number) =>
    [...PROJECTS_KEYS.all, 'fileVersion', projectId, originalFileId, version || 'latest'] as const
} as const

export const TICKETS_KEYS: QueryKeyFactory<{ projectId: number; status?: string }> = {
  all: ['tickets'] as const,
  lists: () => [...TICKETS_KEYS.all, 'list'] as const,
  list: (params?: { projectId: number; status?: string }) => 
    [...TICKETS_KEYS.lists(), params] as const,
  details: () => [...TICKETS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...TICKETS_KEYS.details(), id] as const,
  infinite: (params?: { projectId: number; status?: string }) => 
    [...TICKETS_KEYS.all, 'infinite', params] as const
} as const

// Enhanced ticket query keys with task relationships
export const TICKET_ENHANCED_KEYS = {
  ...TICKETS_KEYS,
  tasks: (ticketId: number) => [...TICKETS_KEYS.all, 'tasks', ticketId] as const,
  withTasks: (projectId: number, status?: string) => 
    [...TICKETS_KEYS.all, 'withTasks', { projectId, status }] as const,
  withCounts: (projectId: number, status?: string) =>
    [...TICKETS_KEYS.all, 'withCounts', { projectId, status }] as const,
  projectTickets: (projectId: number) => [...TICKETS_KEYS.all, 'project', projectId] as const
} as const

export const TASKS_KEYS: QueryKeyFactory<{ ticketId: number }> = {
  all: ['tasks'] as const,
  lists: () => [...TASKS_KEYS.all, 'list'] as const,
  list: (params?: { ticketId: number }) => [...TASKS_KEYS.lists(), params] as const,
  details: () => [...TASKS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...TASKS_KEYS.details(), id] as const
} as const

export const CHATS_KEYS: QueryKeyFactory<void> = {
  all: ['chats'] as const,
  lists: () => [...CHATS_KEYS.all, 'list'] as const,
  list: () => [...CHATS_KEYS.lists()] as const,
  details: () => [...CHATS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...CHATS_KEYS.details(), id] as const
} as const

// Enhanced chat query keys with message relationships
export const CHAT_ENHANCED_KEYS = {
  ...CHATS_KEYS,
  messages: (chatId: number) => [...CHATS_KEYS.all, 'messages', chatId] as const,
  streaming: (chatId: number) => [...CHATS_KEYS.all, 'streaming', chatId] as const
} as const

export const PROMPTS_KEYS: QueryKeyFactory<{ projectId?: number }> = {
  all: ['prompts'] as const,
  lists: () => [...PROMPTS_KEYS.all, 'list'] as const,
  list: (params?: { projectId?: number }) => [...PROMPTS_KEYS.lists(), params] as const,
  details: () => [...PROMPTS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...PROMPTS_KEYS.details(), id] as const
} as const

// Enhanced prompt query keys with project relationships
export const PROMPT_ENHANCED_KEYS = {
  ...PROMPTS_KEYS,
  projectPrompts: (projectId: number) => [...PROMPTS_KEYS.all, 'project', projectId] as const,
  templates: () => [...PROMPTS_KEYS.all, 'templates'] as const,
  suggestions: (projectId: number, context: string) => 
    [...PROMPTS_KEYS.all, 'suggestions', projectId, context] as const
} as const

export const AGENTS_KEYS: QueryKeyFactory<{ projectId?: number }> = {
  all: ['agents'] as const,
  lists: () => [...AGENTS_KEYS.all, 'list'] as const,
  list: (params?: { projectId?: number }) => [...AGENTS_KEYS.lists(), params] as const,
  details: () => [...AGENTS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...AGENTS_KEYS.details(), id] as const
} as const

// Enhanced agent query keys with project relationships
export const AGENT_ENHANCED_KEYS = {
  ...AGENTS_KEYS,
  projectAgents: (projectId: number) => [...AGENTS_KEYS.all, 'project', projectId] as const,
  capabilities: (agentId: string) => [...AGENTS_KEYS.all, 'capabilities', agentId] as const,
  execution: (agentId: string) => [...AGENTS_KEYS.all, 'execution', agentId] as const
} as const

export const FILES_KEYS: QueryKeyFactory<{ projectId?: number }> = {
  all: ['files'] as const,
  lists: () => [...FILES_KEYS.all, 'list'] as const,
  list: (params?: { projectId?: number }) => [...FILES_KEYS.lists(), params] as const,
  details: () => [...FILES_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...FILES_KEYS.details(), id] as const
} as const

// Enhanced file query keys with content/metadata variants
export const FILE_ENHANCED_KEYS = {
  ...FILES_KEYS,
  content: (fileId: number) => [...FILES_KEYS.all, 'content', fileId] as const,
  metadata: (fileId: number) => [...FILES_KEYS.all, 'metadata', fileId] as const,
  versions: (fileId: number) => [...FILES_KEYS.all, 'versions', fileId] as const,
  search: (projectId: number, query: string) => 
    [...FILES_KEYS.all, 'search', projectId, query] as const
} as const

export const QUEUES_KEYS: QueryKeyFactory<{ projectId: number }> = {
  all: ['queues'] as const,
  lists: () => [...QUEUES_KEYS.all, 'list'] as const,
  list: (params?: { projectId: number }) => [...QUEUES_KEYS.lists(), params] as const,
  details: () => [...QUEUES_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...QUEUES_KEYS.details(), id] as const
} as const

// Enhanced queue query keys with items/stats
export const QUEUE_ENHANCED_KEYS = {
  ...QUEUES_KEYS,
  stats: (queueId: number) => [...QUEUES_KEYS.all, 'stats', queueId] as const,
  allStats: (projectId: number) => [...QUEUES_KEYS.all, 'all-stats', projectId] as const,
  items: (queueId: number, status?: string) =>
    status ? [...QUEUES_KEYS.all, 'items', queueId, status] as const 
           : [...QUEUES_KEYS.all, 'items', queueId] as const,
  timeline: (queueId: number) => [...QUEUES_KEYS.all, 'timeline', queueId] as const
} as const

export const PROVIDER_KEYS_KEYS: QueryKeyFactory<void> = {
  all: ['keys'] as const,
  lists: () => [...PROVIDER_KEYS_KEYS.all, 'list'] as const,
  list: () => [...PROVIDER_KEYS_KEYS.lists()] as const,
  details: () => [...PROVIDER_KEYS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...PROVIDER_KEYS_KEYS.details(), id] as const
} as const

// ============================================================================
// Extended Entity Query Key Factories
// ============================================================================

export const USERS_KEYS: QueryKeyFactory<void> = {
  all: ['users'] as const,
  lists: () => [...USERS_KEYS.all, 'list'] as const,
  list: () => [...USERS_KEYS.lists()] as const,
  details: () => [...USERS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...USERS_KEYS.details(), id] as const
} as const

export const USER_ENHANCED_KEYS = {
  ...USERS_KEYS,
  settings: (userId: number) => [...USERS_KEYS.all, 'settings', userId] as const,
  preferences: (userId: number) => [...USERS_KEYS.all, 'preferences', userId] as const,
  workspaces: (userId: number) => [...USERS_KEYS.all, 'workspaces', userId] as const
} as const

export const WORKSPACES_KEYS: QueryKeyFactory<void> = {
  all: ['workspaces'] as const,
  lists: () => [...WORKSPACES_KEYS.all, 'list'] as const,
  list: () => [...WORKSPACES_KEYS.lists()] as const,
  details: () => [...WORKSPACES_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...WORKSPACES_KEYS.details(), id] as const
} as const

export const WORKSPACE_ENHANCED_KEYS = {
  ...WORKSPACES_KEYS,
  members: (workspaceId: number) => [...WORKSPACES_KEYS.all, 'members', workspaceId] as const,
  permissions: (workspaceId: number) => [...WORKSPACES_KEYS.all, 'permissions', workspaceId] as const,
  projects: (workspaceId: number) => [...WORKSPACES_KEYS.all, 'projects', workspaceId] as const
} as const

export const COMMANDS_KEYS: QueryKeyFactory<void> = {
  all: ['commands'] as const,
  lists: () => [...COMMANDS_KEYS.all, 'list'] as const,
  list: () => [...COMMANDS_KEYS.lists()] as const,
  details: () => [...COMMANDS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...COMMANDS_KEYS.details(), id] as const
} as const

export const FLOWS_KEYS: QueryKeyFactory<{ projectId: number }> = {
  all: ['flows'] as const,
  lists: () => [...FLOWS_KEYS.all, 'list'] as const,
  list: (params?: { projectId: number }) => [...FLOWS_KEYS.lists(), params] as const,
  details: () => [...FLOWS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...FLOWS_KEYS.details(), id] as const
} as const

export const FLOW_ENHANCED_KEYS = {
  ...FLOWS_KEYS,
  unqueued: (projectId: number) => [...FLOWS_KEYS.all, 'unqueued', projectId] as const,
  processing: (projectId: number) => [...FLOWS_KEYS.all, 'processing', projectId] as const
} as const

export const GIT_KEYS: QueryKeyFactory<{ projectId: number }> = {
  all: ['git'] as const,
  lists: () => [...GIT_KEYS.all, 'list'] as const,
  list: (params?: { projectId: number }) => [...GIT_KEYS.lists(), params] as const,
  details: () => [...GIT_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...GIT_KEYS.details(), id] as const
} as const

export const GIT_ENHANCED_KEYS = {
  ...GIT_KEYS,
  branches: (projectId: number) => [...GIT_KEYS.all, 'branches', projectId] as const,
  status: (projectId: number) => [...GIT_KEYS.all, 'status', projectId] as const,
  commits: (projectId: number) => [...GIT_KEYS.all, 'commits', projectId] as const,
  diff: (projectId: number) => [...GIT_KEYS.all, 'diff', projectId] as const
} as const

export const PROVIDERS_KEYS: QueryKeyFactory<void> = {
  all: ['providers'] as const,
  lists: () => [...PROVIDERS_KEYS.all, 'list'] as const,
  list: () => [...PROVIDERS_KEYS.lists()] as const,
  details: () => [...PROVIDERS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...PROVIDERS_KEYS.details(), id] as const
} as const

export const ANALYTICS_KEYS: QueryKeyFactory<{ projectId?: number }> = {
  all: ['analytics'] as const,
  lists: () => [...ANALYTICS_KEYS.all, 'list'] as const,
  list: (params?: { projectId?: number }) => [...ANALYTICS_KEYS.lists(), params] as const,
  details: () => [...ANALYTICS_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...ANALYTICS_KEYS.details(), id] as const
} as const

export const MCP_KEYS: QueryKeyFactory<void> = {
  all: ['mcp'] as const,
  lists: () => [...MCP_KEYS.all, 'list'] as const,
  list: () => [...MCP_KEYS.lists()] as const,
  details: () => [...MCP_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...MCP_KEYS.details(), id] as const
} as const

export const MCP_ENHANCED_KEYS = {
  ...MCP_KEYS,
  tools: () => [...MCP_KEYS.all, 'tools'] as const,
  sessions: () => [...MCP_KEYS.all, 'sessions'] as const,
  tracking: (projectId: number) => [...MCP_KEYS.all, 'tracking', projectId] as const
} as const

// ============================================================================
// Query Key Registry and Helper Functions
// ============================================================================

export const QUERY_KEY_REGISTRY = {
  projects: PROJECT_ENHANCED_KEYS,
  tickets: TICKET_ENHANCED_KEYS,
  tasks: TASKS_KEYS,
  chats: CHAT_ENHANCED_KEYS,
  prompts: PROMPT_ENHANCED_KEYS,
  agents: AGENT_ENHANCED_KEYS,
  files: FILE_ENHANCED_KEYS,
  queues: QUEUE_ENHANCED_KEYS,
  keys: PROVIDER_KEYS_KEYS,
  users: USER_ENHANCED_KEYS,
  workspaces: WORKSPACE_ENHANCED_KEYS,
  commands: COMMANDS_KEYS,
  flows: FLOW_ENHANCED_KEYS,
  git: GIT_ENHANCED_KEYS,
  providers: PROVIDERS_KEYS,
  analytics: ANALYTICS_KEYS,
  mcp: MCP_ENHANCED_KEYS
} as const

export type EntityName = keyof typeof QUERY_KEY_REGISTRY

/**
 * Get query keys for a specific entity
 */
export function getQueryKeys<T extends EntityName>(entityName: T): typeof QUERY_KEY_REGISTRY[T] {
  return QUERY_KEY_REGISTRY[entityName]
}

/**
 * Invalidate all queries for a specific entity
 */
export function invalidateEntityQueries(queryClient: any, entityName: EntityName) {
  const keys = getQueryKeys(entityName)
  queryClient.invalidateQueries({ queryKey: keys.all })
}

/**
 * Remove all queries for a specific entity
 */
export function removeEntityQueries(queryClient: any, entityName: EntityName) {
  const keys = getQueryKeys(entityName)
  queryClient.removeQueries({ queryKey: keys.all })
}

/**
 * Create relationship-aware invalidation
 * When an entity changes, invalidate related entities
 */
export const ENTITY_RELATIONSHIPS = {
  projects: ['tickets', 'prompts', 'agents', 'files', 'queues', 'git'],
  tickets: ['tasks', 'projects'],
  tasks: ['tickets'],
  chats: ['prompts', 'agents'],
  prompts: ['projects'],
  agents: ['projects'],
  files: ['projects'],
  queues: ['projects', 'tickets', 'tasks'],
  workspaces: ['projects', 'users'],
  users: ['workspaces'],
  git: ['projects']
} as const

/**
 * Invalidate entity and all related entities
 */
export function invalidateWithRelationships(
  queryClient: any, 
  entityName: EntityName, 
  cascade = true
) {
  // Invalidate the primary entity
  invalidateEntityQueries(queryClient, entityName)
  
  // Invalidate related entities if cascade is enabled
  if (cascade && entityName in ENTITY_RELATIONSHIPS) {
    const relatedEntities = ENTITY_RELATIONSHIPS[entityName as keyof typeof ENTITY_RELATIONSHIPS]
    relatedEntities?.forEach(relatedEntity => {
      invalidateEntityQueries(queryClient, relatedEntity as EntityName)
    })
  }
}