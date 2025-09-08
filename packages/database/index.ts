// =============================================================================
// DRIZZLE-ZOD SCHEMA EXPORTS - Single Source of Truth
// =============================================================================
// These auto-generated schemas replace all manual schemas in @promptliano/schemas

// Export everything from schema first to ensure all exports are available
export * from './src/schema'
export * from './src/schema/mcp-executions'
export * from './src/db'
export * from './src/repositories'
export * from './src/schema-transformers'
// Migrations helpers
export { runMigrations, createInitialSchema } from './src/migrations/migrate'

// Model configuration initialization
export { initializeModelConfigs } from './src/scripts/init-model-configs'
// Utility: Allow consumers (server) to log DB location
export { getDatabasePath } from './src/db'

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
  providerKeys,
  modelConfigs,
  modelPresets
} from './src/schema'

export { mcpToolExecutions, mcpToolStatistics, mcpExecutionChains, mcpErrorPatterns } from './src/schema/mcp-executions'

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
  selectProviderKeySchema,
  selectModelConfigSchema,
  selectModelPresetSchema,
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
  insertProviderKeySchema,
  insertModelConfigSchema,
  insertModelPresetSchema,
  insertSelectedFileSchema
} from './src/schema'

// Import schema transformers
import {
  createTransformedSelectSchema,
  createTransformedInsertSchema,
  commonJsonTransforms
} from './src/schema-transformers'

// Import Zod for type inference
import { z } from '@hono/zod-openapi'

// Helper type for drizzle-zod schema inference
type InferSchema<T> = T extends { _output: infer U } ? U : T extends { _def: { _output: infer V } } ? V : any

// Project schemas (backward compatibility)
export const ProjectSchema = selectProjectSchema
export const CreateProjectSchema = insertProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})
export const UpdateProjectSchema = CreateProjectSchema.partial()
export type CreateProject = InferSchema<typeof CreateProjectSchema>
export type UpdateProject = InferSchema<typeof UpdateProjectSchema>

// Ticket schemas - split into service (raw) and API (transformed) versions
export const TicketSchemaRaw = selectTicketSchema
export const TicketSchema = createTransformedSelectSchema(selectTicketSchema, {
  suggestedFileIds: commonJsonTransforms.suggestedFileIds,
  suggestedAgentIds: commonJsonTransforms.suggestedAgentIds,
  suggestedPromptIds: commonJsonTransforms.suggestedPromptIds
})
export const CreateTicketSchema = createTransformedInsertSchema(insertTicketSchema).extend({
  suggestedFileIds: commonJsonTransforms.suggestedFileIds.optional(),
  suggestedAgentIds: commonJsonTransforms.suggestedAgentIds.optional(),
  suggestedPromptIds: commonJsonTransforms.suggestedPromptIds.optional()
})
export const UpdateTicketSchema = CreateTicketSchema.partial()
export type CreateTicket = InferSchema<typeof CreateTicketSchema>
export type UpdateTicket = InferSchema<typeof UpdateTicketSchema>

// Task schemas (with JSON field transformations)
export const TaskSchema = createTransformedSelectSchema(selectTicketTaskSchema, {
  suggestedFileIds: commonJsonTransforms.suggestedFileIds,
  dependencies: commonJsonTransforms.dependencies,
  tags: commonJsonTransforms.tags,
  suggestedPromptIds: commonJsonTransforms.suggestedPromptIds
})
export const CreateTaskSchema = createTransformedInsertSchema(insertTicketTaskSchema).extend({
  suggestedFileIds: commonJsonTransforms.suggestedFileIds.optional(),
  dependencies: commonJsonTransforms.dependencies.optional(),
  tags: commonJsonTransforms.tags.optional(),
  suggestedPromptIds: commonJsonTransforms.suggestedPromptIds.optional()
})
export const UpdateTaskSchema = CreateTaskSchema.partial()
export type CreateTask = InferSchema<typeof CreateTaskSchema>
export type UpdateTask = InferSchema<typeof UpdateTaskSchema>
export type { TicketTask, TaskStatus, InsertTicketTask } from './src/schema'

// Chat schemas (backward compatibility)
export const ChatSchema = selectChatSchema
export const CreateChatSchema = insertChatSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})
export const UpdateChatSchema = CreateChatSchema.partial()
export type CreateChat = InferSchema<typeof CreateChatSchema>
export type UpdateChat = InferSchema<typeof UpdateChatSchema>

// Message schemas (backward compatibility)
export const MessageSchema = selectChatMessageSchema
export const CreateMessageSchema = insertChatMessageSchema.omit({
  id: true,
  createdAt: true
})
export type CreateMessage = InferSchema<typeof CreateMessageSchema>

// ChatMessage schemas (with JSON field transformations)
export const ChatMessageSchema = createTransformedSelectSchema(selectChatMessageSchema, {
  metadata: commonJsonTransforms.metadata
})
export const CreateChatMessageSchema = createTransformedInsertSchema(insertChatMessageSchema).extend({
  metadata: commonJsonTransforms.metadata.optional()
})
export const UpdateChatMessageSchema = CreateChatMessageSchema.partial()
export type CreateChatMessage = InferSchema<typeof CreateChatMessageSchema>
export type UpdateChatMessage = InferSchema<typeof UpdateChatMessageSchema>

// Prompt schemas (with JSON field transformations)
export const PromptSchema = createTransformedSelectSchema(selectPromptSchema, {
  tags: commonJsonTransforms.tags
})
export const CreatePromptSchema = createTransformedInsertSchema(insertPromptSchema).extend({
  tags: commonJsonTransforms.tags.optional()
})
export const UpdatePromptSchema = CreatePromptSchema.partial()
export type CreatePrompt = InferSchema<typeof CreatePromptSchema>
export type UpdatePrompt = InferSchema<typeof UpdatePromptSchema>

// Queue schemas (backward compatibility)
export const QueueSchema = selectQueueSchema
export const CreateQueueSchema = insertQueueSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})
export const UpdateQueueSchema = CreateQueueSchema.partial()
export type CreateQueue = InferSchema<typeof CreateQueueSchema>
export type UpdateQueue = InferSchema<typeof UpdateQueueSchema>

// File schemas (backward compatibility)
export const FileSchema = selectFileSchema
export const CreateFileSchema = insertFileSchema // Files table doesn't have createdAt/updatedAt fields to omit
export const UpdateFileSchema = CreateFileSchema.partial()
export type CreateFile = InferSchema<typeof CreateFileSchema>
export type UpdateFile = InferSchema<typeof UpdateFileSchema>

// QueueItem schemas (backward compatibility)
export const QueueItemSchema = selectQueueItemSchema
export const CreateQueueItemSchema = insertQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})
export const UpdateQueueItemSchema = CreateQueueItemSchema.partial()
export type CreateQueueItem = InferSchema<typeof CreateQueueItemSchema>
export type UpdateQueueItem = InferSchema<typeof UpdateQueueItemSchema>

// ProviderKey schemas (with JSON field transformations)
export const ProviderKeySchema = createTransformedSelectSchema(selectProviderKeySchema, {
  customHeaders: commonJsonTransforms.customHeaders
})
export const CreateProviderKeySchema = insertProviderKeySchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true
  })
  .extend({
    customHeaders: (commonJsonTransforms.customHeaders as any).optional()
  })
export const UpdateProviderKeySchema = CreateProviderKeySchema.partial()
export type CreateProviderKey = InferSchema<typeof CreateProviderKeySchema>
export type UpdateProviderKey = InferSchema<typeof UpdateProviderKeySchema>

// ActiveTab removed: handled entirely on the frontend

// SelectedFile schemas (backward compatibility)
export const SelectedFileSchema = selectSelectedFileSchema
export const CreateSelectedFileSchema = insertSelectedFileSchema.omit({
  id: true
})
export const UpdateSelectedFileSchema = CreateSelectedFileSchema.partial()
export type CreateSelectedFile = InferSchema<typeof CreateSelectedFileSchema>
export type UpdateSelectedFile = InferSchema<typeof UpdateSelectedFileSchema>

// Export test utilities
export * from './src/test-utils'
export * from './src/test-utils/test-db'
export { createTestDatabase } from './src/test-utils/test-db'
