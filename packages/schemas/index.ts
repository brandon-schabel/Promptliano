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
export * from './src/schema-factories'

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
export * from './src/mcp-tracking.schemas'

// Import/Export & Processing
export * from './src/markdown-import-export.schemas'
export * from './src/parser-config.schemas'

// Claude Code Integration
export * from './src/claude-code.schemas'

// Legacy Model Configuration (TODO: Move to @promptliano/config)
export * from './src/constants/models-temp-not-allowed'

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
