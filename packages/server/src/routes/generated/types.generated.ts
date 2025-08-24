/**
 * AUTO-GENERATED ROUTE TYPE DEFINITIONS
 * Generated at: 2025-08-22T23:50:50.385Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

// =============================================================================
// ENTITY ROUTE INTERFACES
// =============================================================================

export interface ProjectRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
  getTickets: string
  getChats: string
  getPrompts: string
  getQueues: string
  getClaudeCommands: string
  getClaudeHooks: string
  getFiles: string
  getSelectedFiles: string
  getActiveTabs: string
  sync: string
  getSummary: string
}

export interface TicketRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
  generateTasks: string
}

export interface TicketTaskRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface ChatRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
  addMessage: string
}

export interface ChatMessageRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface PromptRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface QueueRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
  process: string
}

export interface QueueItemRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface ClaudeAgentRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface ClaudeCommandRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface ClaudeHookRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface ProviderKeyRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface FileRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface SelectedFileRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

export interface ActiveTabRoutes {
  create: string
  list: string
  get: string
  update: string
  delete: string
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RoutePattern = `${RouteMethod} ${string}`

export interface RouteMetadata {
  method: RouteMethod
  path: string
  entity: string
  operation: string
  isCustom: boolean
}
