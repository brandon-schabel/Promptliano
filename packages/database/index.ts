// =============================================================================  
// DRIZZLE-ZOD SCHEMA EXPORTS - Single Source of Truth
// =============================================================================
// These auto-generated schemas replace all manual schemas in @promptliano/schemas

// Export everything from schema first to ensure all exports are available
export * from './src/schema'
export * from './src/db'
export * from './src/repositories'

// Export table definitions for services that need direct access
export { 
  projects,
  tickets,
  ticketTasks,
  chats,
  chatMessages,
  prompts,
  queues,
  queueItems,
  files,
  selectedFiles,
  activeTabs,
  claudeAgents,
  claudeCommands,
  claudeHooks,
  providerKeys
} from './src/schema'

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================
// Import the schemas to create backward-compatible aliases

import { 
  selectProjectSchema, 
  selectTicketSchema, 
  selectTicketTaskSchema,
  selectChatSchema,
  selectChatMessageSchema,
  selectPromptSchema,
  selectQueueSchema,
  selectQueueItemSchema,
  selectFileSchema,
  selectClaudeAgentSchema,
  selectClaudeCommandSchema,
  selectClaudeHookSchema,
  selectProviderKeySchema,
  selectActiveTabSchema,
  selectSelectedFileSchema,
  insertProjectSchema, 
  insertTicketSchema, 
  insertTicketTaskSchema,
  insertChatSchema,
  insertChatMessageSchema,
  insertPromptSchema,
  insertQueueSchema,
  insertQueueItemSchema,
  insertFileSchema,
  insertClaudeAgentSchema,
  insertClaudeCommandSchema,
  insertClaudeHookSchema,
  insertProviderKeySchema,
  insertActiveTabSchema,
  insertSelectedFileSchema
} from './src/schema'

// Project schemas (backward compatibility)
export const ProjectSchema = selectProjectSchema
export const CreateProjectSchema = insertProjectSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateProjectSchema = CreateProjectSchema.partial()
export type CreateProject = typeof CreateProjectSchema._type
export type UpdateProject = typeof UpdateProjectSchema._type

// Ticket schemas (backward compatibility) 
export const TicketSchema = selectTicketSchema
export const CreateTicketSchema = insertTicketSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateTicketSchema = CreateTicketSchema.partial()
export type CreateTicket = typeof CreateTicketSchema._type
export type UpdateTicket = typeof UpdateTicketSchema._type

// Task schemas (backward compatibility)
export const TaskSchema = selectTicketTaskSchema
export const CreateTaskSchema = insertTicketTaskSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateTaskSchema = CreateTaskSchema.partial()
export type CreateTask = typeof CreateTaskSchema._type
export type UpdateTask = typeof UpdateTaskSchema._type

// Chat schemas (backward compatibility)
export const ChatSchema = selectChatSchema
export const CreateChatSchema = insertChatSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateChatSchema = CreateChatSchema.partial()
export type CreateChat = typeof CreateChatSchema._type
export type UpdateChat = typeof UpdateChatSchema._type

// Message schemas (backward compatibility)
export const MessageSchema = selectChatMessageSchema
export const CreateMessageSchema = insertChatMessageSchema.omit({ 
  id: true, 
  createdAt: true 
})
export type CreateMessage = typeof CreateMessageSchema._type

// ChatMessage schemas (backward compatibility - alias to Message)
export const ChatMessageSchema = selectChatMessageSchema
export const CreateChatMessageSchema = insertChatMessageSchema.omit({ 
  id: true, 
  createdAt: true 
})
export const UpdateChatMessageSchema = CreateChatMessageSchema.partial()
export type CreateChatMessage = typeof CreateChatMessageSchema._type
export type UpdateChatMessage = typeof UpdateChatMessageSchema._type

// Prompt schemas (backward compatibility)
export const PromptSchema = selectPromptSchema
export const CreatePromptSchema = insertPromptSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdatePromptSchema = CreatePromptSchema.partial()
export type CreatePrompt = typeof CreatePromptSchema._type
export type UpdatePrompt = typeof UpdatePromptSchema._type

// Queue schemas (backward compatibility)
export const QueueSchema = selectQueueSchema
export const CreateQueueSchema = insertQueueSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateQueueSchema = CreateQueueSchema.partial()
export type CreateQueue = typeof CreateQueueSchema._type
export type UpdateQueue = typeof UpdateQueueSchema._type

// File schemas (backward compatibility)
export const FileSchema = selectFileSchema
export const CreateFileSchema = insertFileSchema.omit({ createdAt: true, updatedAt: true })
export const UpdateFileSchema = CreateFileSchema.partial()
export type CreateFile = typeof CreateFileSchema._type
export type UpdateFile = typeof UpdateFileSchema._type

// QueueItem schemas (backward compatibility)
export const QueueItemSchema = selectQueueItemSchema
export const CreateQueueItemSchema = insertQueueItemSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateQueueItemSchema = CreateQueueItemSchema.partial()
export type CreateQueueItem = typeof CreateQueueItemSchema._type
export type UpdateQueueItem = typeof UpdateQueueItemSchema._type

// ClaudeAgent schemas (backward compatibility)
export const ClaudeAgentSchema = selectClaudeAgentSchema
export const CreateClaudeAgentSchema = insertClaudeAgentSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateClaudeAgentSchema = CreateClaudeAgentSchema.partial()
export type CreateClaudeAgent = typeof CreateClaudeAgentSchema._type
export type UpdateClaudeAgent = typeof UpdateClaudeAgentSchema._type

// ClaudeCommand schemas (backward compatibility)
export const ClaudeCommandSchema = selectClaudeCommandSchema
export const CreateClaudeCommandSchema = insertClaudeCommandSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateClaudeCommandSchema = CreateClaudeCommandSchema.partial()
export type CreateClaudeCommand = typeof CreateClaudeCommandSchema._type
export type UpdateClaudeCommand = typeof UpdateClaudeCommandSchema._type

// ClaudeHook schemas (backward compatibility)
export const ClaudeHookSchema = selectClaudeHookSchema
export const CreateClaudeHookSchema = insertClaudeHookSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateClaudeHookSchema = CreateClaudeHookSchema.partial()
export type CreateClaudeHook = typeof CreateClaudeHookSchema._type
export type UpdateClaudeHook = typeof UpdateClaudeHookSchema._type

// ProviderKey schemas (backward compatibility)
export const ProviderKeySchema = selectProviderKeySchema
export const CreateProviderKeySchema = insertProviderKeySchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
export const UpdateProviderKeySchema = CreateProviderKeySchema.partial()
export type CreateProviderKey = typeof CreateProviderKeySchema._type
export type UpdateProviderKey = typeof UpdateProviderKeySchema._type

// ActiveTab schemas (backward compatibility)
export const ActiveTabSchema = selectActiveTabSchema
export const CreateActiveTabSchema = insertActiveTabSchema.omit({ 
  id: true, 
  createdAt: true
})
export const UpdateActiveTabSchema = CreateActiveTabSchema.partial()
export type CreateActiveTab = typeof CreateActiveTabSchema._type
export type UpdateActiveTab = typeof UpdateActiveTabSchema._type

// SelectedFile schemas (backward compatibility)
export const SelectedFileSchema = selectSelectedFileSchema
export const CreateSelectedFileSchema = insertSelectedFileSchema.omit({ 
  id: true
})
export const UpdateSelectedFileSchema = CreateSelectedFileSchema.partial()
export type CreateSelectedFile = typeof CreateSelectedFileSchema._type
export type UpdateSelectedFile = typeof UpdateSelectedFileSchema._type

// Export test utilities
export { createTestDatabase, testFactories } from './src/test-utils'