// =============================================================================  
// DRIZZLE-ZOD SCHEMA EXPORTS - Single Source of Truth
// =============================================================================
// These auto-generated schemas replace all manual schemas in @promptliano/schemas

// Export everything from schema first to ensure all exports are available
export * from './src/schema'
export * from './src/db'
export * from './src/repositories'

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
  selectFileSchema,
  insertProjectSchema, 
  insertTicketSchema, 
  insertTicketTaskSchema,
  insertChatSchema,
  insertChatMessageSchema,
  insertPromptSchema,
  insertQueueSchema,
  insertFileSchema
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