// =============================================================================
// PROMPTLIANO SCHEMAS - NON-DATABASE VALIDATION & API SCHEMAS
// =============================================================================
// This package now contains only schemas that are NOT database entities.
// All database entity schemas are auto-generated in @promptliano/database via Drizzle-Zod.

// API Response & Common Schemas
export * from './src/common.schemas'

// Global Application State
export {
  globalStateSchema,
  createInitialGlobalState,
  createSafeGlobalState,
  validateAndRepairGlobalState,
  getDefaultProjectTabState,
  EDITOR_OPTIONS,
  projectTabStateSchema,
  appSettingsSchema,
  type GlobalState,
  type ProjectTabState,
  type ProjectTabStatePartial,
  type ProjectTabsStateRecord,
  type AppSettings,
  type Theme,
  type EditorType as GlobalStateEditorType
} from './src/global-state-schema'

// Key-Value Store & Configuration
export * from './src/kv-store.schemas'

// Schema Utilities & Helpers
export * from './src/schema-utils'
export * from './src/unix-ts-utils'
// Export enhanced factories only (they include everything from schema-factories)
export * from './src/factories'

// AI & Generation Schemas
export * from './src/gen-ai.schemas'

// File System & Directory Operations
export * from './src/browse-directory.schemas'
export * from './src/file-relevance.schemas'
export * from './src/file-summarization.schemas'
export * from './src/summary-options.schemas'

// Git Operations
export * from './src/git.schemas'

// MCP Protocol Schemas
export * from './src/mcp.schemas'

// Hook Schemas
export * from './src/hooks.schemas'
export * from './src/mcp-tracking.schemas'

// ID Parameter Schemas (for auto-generated routes)
export * from './src/id-params.schemas'

// Response Schemas (for auto-generated routes)
export * from './src/response.schemas'

// Chat Request Schemas
export * from './src/chat-request.schemas'

// Active Tab Request Schemas - using specific exports to avoid conflicts
export {
  updateActiveTabSchema,
  type UpdateActiveTab as UpdateActiveTabRequest
} from './src/active-tab-request.schemas'

// Import/Export & Processing
export * from './src/markdown-import-export.schemas'
export * from './src/parser-config.schemas'

// Claude Code Integration
export * from './src/claude-code.schemas'

// Command Management Schemas
export * from './src/command.schemas'

// Provider Testing Schemas
export * from './src/provider-testing.schemas'

// Legacy Model Configuration (TODO: Move to @promptliano/config)
export * from './src/constants/models-temp-not-allowed'

// Legacy Project File Types (TODO: Migrate these to @promptliano/database)
export { type ImportInfo, type ExportInfo, type ProjectFile, type ProjectFileMap } from './src/project.schemas'

// Note: HookConfig, HookEvent, and APIProviders types have been moved to @promptliano/database
// Import them directly from @promptliano/database instead

// Entity Schemas (for auto-generated routes) - only export non-conflicting schemas
export {
  // Missing entity schemas needed by generated routes
  ActiveTabSchema,
  ChatSchema,
  FileSchema,
  QueueSchema,
  SelectedFileSchema,
  ChatMessageSchema,
  QueueItemSchema,
  TicketSchema,
  TicketTaskSchema,
  PromptSchema,
  // Claude schemas - fix naming mismatches
  ClaudeAgentSchema, // was: ClaudeContentSchema
  ClaudeCommandSchema,
  ClaudeHookSchema,
  ProviderKeySchema, // was: ProviderModelSchema
  // Create schemas for missing entities
  CreateActiveTabSchema,
  CreateChatSchema,
  CreateFileSchema,
  CreateQueueSchema,
  CreateSelectedFileSchema,
  CreateChatMessageSchema,
  CreateClaudeAgentSchema, // was: CreateClaudeAgentBodySchema
  CreateClaudeCommandSchema, // was: CreateClaudeCommandBodySchema  
  CreateClaudeHookSchema,
  CreateProviderKeySchema, // was: CreateProviderKeyInputSchema
  CreateTicketSchema,
  CreateTicketTaskSchema,
  CreateQueueItemSchema, // was: CreateQueueSchema per error
  CreateProjectSchema, // was: CreateProjectBodySchema
  UpdateProjectSchema, // was: UpdateProjectBodySchema
  // Update schemas for missing entities
  UpdateActiveTabSchema,
  UpdateChatSchema,
  UpdateFileSchema,
  UpdateQueueSchema,
  UpdateSelectedFileSchema,
  UpdateChatMessageSchema,
  UpdateClaudeAgentSchema, // was: UpdateClaudeAgentBodySchema
  UpdateClaudeCommandSchema, // was: UpdateClaudeCommandBodySchema
  UpdateClaudeHookSchema,
  UpdateProviderKeySchema,
  UpdateTicketSchema,
  UpdateTicketTaskSchema,
  UpdateQueueItemSchema, // was: UpdateQueueSchema per error
  // Types for missing entities
  type ActiveTab,
  type Chat,
  type File,
  type Queue,
  type SelectedFile,
  type ChatMessage,
  type QueueItem,
  type Ticket,
  type TicketTask,
  type Prompt,
  type ClaudeAgent,
  type ClaudeCommand,
  type ClaudeHook,
  type ProviderKey,
  type CreateActiveTab,
  type CreateChat,
  type CreateFile,
  type CreateQueue,
  type CreateSelectedFile,
  type CreateChatMessage,
  type CreateClaudeAgent,
  type CreateClaudeCommand,
  type CreateClaudeHook,
  type CreateProviderKey,
  type CreateTicket,
  type CreateTicketTask,
  type CreateQueueItem,
  type CreateProject,
  type UpdateProject,
  type UpdateActiveTab as UpdateActiveTabEntity,
  type UpdateChat,
  type UpdateFile,
  type UpdateQueue,
  type UpdateSelectedFile,
  type UpdateChatMessage,
  type UpdateClaudeAgent,
  type UpdateClaudeCommand,
  type UpdateClaudeHook,
  type UpdateProviderKey,
  type UpdateTicket,
  type UpdateTicketTask,
  type UpdateQueueItem
} from './src/entity.schemas'

// API Request/Response Schemas (kept for API validation) - be selective to avoid conflicts
export * from './src/project.schemas'
export * from './src/prompt.schemas'

// Explicitly export Prompt API types that might be overridden by entity.schemas.ts
export type { CreatePromptBody, UpdatePromptBody } from './src/prompt.schemas'

// Export specific non-conflicting schemas from these files
export {
  // From ticket.schemas.ts - avoid conflicts with entity.schemas.ts
  type CreateTicketBody,
  type UpdateTicketBody,
  type CreateTaskBody,
  type UpdateTaskBody,
  type TicketWithTasks,
  // Export API validation schemas
  ticketsApiValidation
} from './src/ticket.schemas'

export {
  // From queue.schemas.ts - schemas needed by queue routes
  TaskQueueSchema,
  QueueStatsSchema,
  QueueWithStatsSchema,
  CreateQueueBodySchema,
  UpdateQueueBodySchema,
  GetNextTaskResponseSchema,
  BatchEnqueueBodySchema,
  QueueTimelineSchema,
  // From queue.schemas.ts - avoid conflicts with entity.schemas.ts  
  type CreateQueueBody,
  type UpdateQueueBody
} from './src/queue.schemas'

// =============================================================================
// DEPRECATED EXPORTS - These now come from @promptliano/database
// =============================================================================
//
// The following schemas have been moved to @promptliano/database and are
// auto-generated via Drizzle-Zod. Update your imports:
//
// OLD: import { ProjectSchema } from '@promptliano/schemas'
// NEW: import { ProjectSchema } from '@promptliano/database'
//
// Deprecated schemas (use @promptliano/database instead):
// - project.schemas.ts -> ProjectSchema, CreateProject, UpdateProject
// - ticket.schemas.ts -> TicketSchema, CreateTicket, UpdateTicket
// - chat.schemas.ts -> ChatSchema, CreateChat, UpdateChat
// - prompt.schemas.ts -> PromptSchema, CreatePrompt, UpdatePrompt
// - queue.schemas.ts -> QueueSchema, CreateQueue, UpdateQueue
// - claude-agent.schemas.ts -> ClaudeAgent, CreateClaudeAgent, UpdateClaudeAgent
// - claude-command.schemas.ts -> ClaudeCommand, CreateClaudeCommand, UpdateClaudeCommand
// - claude-hook.schemas.ts -> ClaudeHook, CreateClaudeHook, UpdateClaudeHook
// - provider-key.schemas.ts -> ProviderKey, CreateProviderKey, UpdateProviderKey
// - active-tab.schemas.ts -> ActiveTab, CreateActiveTab, UpdateActiveTab
// - selected-files.schemas.ts -> REMOVED (unused schemas)
