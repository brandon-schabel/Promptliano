import { z } from '@hono/zod-openapi'
import { entityIdCoercibleSchema } from './schema-utils'

// =============================================================================
// MISSING ENTITY SCHEMAS FOR AUTO-GENERATED ROUTES
// =============================================================================
// This file contains ONLY the entity schemas that are missing from other files
// and are needed by auto-generated routes. Avoid duplicating existing schemas.

// Active Tab Schema (missing from existing files)
export const ActiveTabSchema = z
  .object({
    id: z.number().int().positive(),
    tabId: z.number().int().min(0),
    clientId: z.string().nullable(),
    tabMetadata: z.record(z.string(), z.any()).nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('ActiveTab')

// Chat Schema (missing from existing files)
export const ChatSchema = z
  .object({
    id: z.number().int().positive(),
    projectId: z.number().int().positive().nullable(),
    title: z.string(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('Chat')

// File Schema (missing from existing files)
export const FileSchema = z
  .object({
    id: z.number().int().positive(),
    projectId: z.number().int().positive().nullable(),
    path: z.string(),
    type: z.enum(['file', 'directory']),
    size: z.number().nullable(),
    lastModified: z.number().nullable(),
    permissions: z.string().nullable(),
    metadata: z.record(z.string(), z.any()).nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('File')

// Queue Schema (missing from existing files)
export const QueueSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable(),
    isActive: z.boolean().default(true),
    maxConcurrency: z.number().int().positive().default(1),
    retryConfig: z.record(z.string(), z.any()).nullable(),
    metadata: z.record(z.string(), z.any()).nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('Queue')

// Selected File Schema (missing from existing files)
export const SelectedFileSchema = z
  .object({
    id: z.number().int().positive(),
    fileId: z.number().int().positive(),
    projectId: z.number().int().positive().nullable(),
    selectionType: z.enum(['manual', 'auto', 'suggested']),
    relevanceScore: z.number().nullable(),
    metadata: z.record(z.string(), z.any()).nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('SelectedFile')

// Chat Message Schema (missing from existing files)
export const ChatMessageSchema = z
  .object({
    id: z.number().int().positive(),
    chatId: z.number().int().positive(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    metadata: z.record(z.string(), z.any()).nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('ChatMessage')

// Queue Item Schema (different from queue.schemas.ts to avoid conflicts)
export const QueueItemSchema = z
  .object({
    id: z.number().int().positive(),
    queueId: z.number().int().positive(),
    itemType: z.enum(['ticket', 'task', 'chat', 'prompt']),
    itemId: z.number().int().positive(),
    priority: z.number().default(0),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']),
    agentId: z.string().nullable(),
    errorMessage: z.string().nullable(),
    estimatedProcessingTime: z.number().nullable(),
    actualProcessingTime: z.number().nullable(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('QueueItem')

// Ticket Schema (for entity routes, references the main schema from ticket.schemas.ts)
export const TicketSchema = z
  .object({
    id: z.number().int().positive(),
    projectId: z.number().int().positive(),
    title: z.string(),
    overview: z.string().nullable(),
    status: z.enum(['open', 'in_progress', 'closed']),
    priority: z.enum(['low', 'normal', 'high']),
    suggestedFileIds: z.array(z.string()),
    suggestedAgentIds: z.array(z.string()),
    suggestedPromptIds: z.array(z.number()),
    queueId: z.number().nullable(),
    queuePosition: z.number().nullable(),
    queueStatus: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).nullable(),
    queuePriority: z.number().nullable(),
    queuedAt: z.number().nullable(),
    queueStartedAt: z.number().nullable(),
    queueCompletedAt: z.number().nullable(),
    queueAgentId: z.string().nullable(),
    queueErrorMessage: z.string().nullable(),
    estimatedProcessingTime: z.number().nullable(),
    actualProcessingTime: z.number().nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('Ticket')

// Ticket Task Schema (for entity routes)
export const TicketTaskSchema = z
  .object({
    id: z.number().int().positive(),
    ticketId: z.number().int().positive(),
    content: z.string(),
    description: z.string().nullable(),
    suggestedFileIds: z.array(z.string()),
    done: z.boolean(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    orderIndex: z.number(),
    estimatedHours: z.number().nullable(),
    dependencies: z.array(z.number()),
    tags: z.array(z.string()),
    agentId: z.string().nullable(),
    suggestedPromptIds: z.array(z.number()),
    queueId: z.number().nullable(),
    queuePosition: z.number().nullable(),
    queueStatus: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).nullable(),
    queuePriority: z.number().nullable(),
    queuedAt: z.number().nullable(),
    queueStartedAt: z.number().nullable(),
    queueCompletedAt: z.number().nullable(),
    queueAgentId: z.string().nullable(),
    queueErrorMessage: z.string().nullable(),
    estimatedProcessingTime: z.number().nullable(),
    actualProcessingTime: z.number().nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('TicketTask')

// Prompt Schema (for entity routes)
export const PromptSchema = z
  .object({
    id: z.number().int().positive(),
    projectId: z.number().int().positive(),
    title: z.string(),
    content: z.string(),
    description: z.string().nullable(),
    tags: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('Prompt')

// =============================================================================
// CREATE SCHEMAS - Only for missing entities
// =============================================================================

export const CreateActiveTabSchema = z
  .object({
    tabId: z.number().int().min(0),
    clientId: z.string().optional(),
    tabMetadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('CreateActiveTab')

export const CreateChatSchema = z
  .object({
    projectId: z.number().int().positive().optional(),
    title: z.string().min(1).max(255)
  })
  .openapi('CreateChat')

export const CreateFileSchema = z
  .object({
    projectId: z.number().int().positive().optional(),
    path: z.string().min(1),
    type: z.enum(['file', 'directory']),
    size: z.number().optional(),
    lastModified: z.number().optional(),
    permissions: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('CreateFile')

export const CreateQueueSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
    maxConcurrency: z.number().int().positive().default(1),
    retryConfig: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('CreateQueue')

export const CreateSelectedFileSchema = z
  .object({
    fileId: z.number().int().positive(),
    projectId: z.number().int().positive().optional(),
    selectionType: z.enum(['manual', 'auto', 'suggested']).default('manual'),
    relevanceScore: z.number().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('CreateSelectedFile')

// Chat Message Create/Update schemas - missing from generated routes
export const CreateChatMessageSchema = z
  .object({
    chatId: z.number().int().positive(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('CreateChatMessage')

export const UpdateChatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'system']).optional(),
    content: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('UpdateChatMessage')

// Provider Key schemas (for entity routes) - compatibility with ProviderModelSchema
export const ProviderKeySchema = z
  .object({
    id: z.number().int().positive(),
    provider: z.string(),
    keyName: z.string().nullable(),
    name: z.string().nullable(),
    secretRef: z.string().nullable().optional(),
    encryptedValue: z.string(),
    encrypted: z.boolean(),
    iv: z.string().nullable(),
    tag: z.string().nullable(),
    salt: z.string().nullable(),
    baseUrl: z.string().nullable(),
    customHeaders: z.record(z.string(), z.string()).nullable(),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    environment: z.string(),
    description: z.string().nullable(),
    expiresAt: z.number().nullable(),
    lastUsed: z.number().nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('ProviderKey')

export const CreateProviderKeySchema = z
  .object({
    provider: z.string().min(1),
    keyName: z.string().optional(),
    name: z.string().optional(),
    secretRef: z.string().optional(),
    key: z.string().optional(),
    baseUrl: z.string().optional(),
    customHeaders: z.record(z.string(), z.string()).optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    environment: z.string().default('production'),
    description: z.string().optional(),
    expiresAt: z.number().optional(),
    lastUsed: z.number().optional()
  })
  .openapi('CreateProviderKey')

export const UpdateProviderKeySchema = z
  .object({
    keyName: z.string().optional(),
    name: z.string().optional(),
    secretRef: z.string().optional(),
    key: z.string().optional(),
    baseUrl: z.string().optional(),
    customHeaders: z.record(z.string(), z.string()).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    environment: z.string().optional(),
    description: z.string().optional(),
    expiresAt: z.number().optional(),
    lastUsed: z.number().optional()
  })
  .openapi('UpdateProviderKey')

// Additional Create/Update schemas that are expected by generated routes
// These reference the same underlying entities but with different naming conventions

// Ticket Create/Update schemas
export const CreateTicketSchema = z
  .object({
    projectId: z.number().int().positive(),
    title: z.string().min(1),
    overview: z.string().optional(),
    status: z.enum(['open', 'in_progress', 'closed']).default('open'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    suggestedFileIds: z.array(z.string()).default([]),
    suggestedAgentIds: z.array(z.string()).default([]),
    suggestedPromptIds: z.array(z.number()).default([])
  })
  .openapi('CreateTicket')

export const UpdateTicketSchema = z
  .object({
    title: z.string().min(1).optional(),
    overview: z.string().optional(),
    status: z.enum(['open', 'in_progress', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    suggestedFileIds: z.array(z.string()).optional(),
    suggestedAgentIds: z.array(z.string()).optional(),
    suggestedPromptIds: z.array(z.number()).optional()
  })
  .openapi('UpdateTicket')

// TicketTask Create/Update schemas
export const CreateTicketTaskSchema = z
  .object({
    ticketId: z.number().int().positive(),
    content: z.string().min(1),
    description: z.string().optional(),
    suggestedFileIds: z.array(z.string()).default([]),
    done: z.boolean().default(false),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
    orderIndex: z.number().default(0),
    estimatedHours: z.number().optional(),
    dependencies: z.array(z.number()).default([]),
    tags: z.array(z.string()).default([]),
    agentId: z.string().optional(),
    suggestedPromptIds: z.array(z.number()).default([])
  })
  .openapi('CreateTicketTask')

export const UpdateTicketTaskSchema = z
  .object({
    content: z.string().min(1).optional(),
    description: z.string().optional(),
    suggestedFileIds: z.array(z.string()).optional(),
    done: z.boolean().optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    orderIndex: z.number().optional(),
    estimatedHours: z.number().optional(),
    dependencies: z.array(z.number()).optional(),
    tags: z.array(z.string()).optional(),
    agentId: z.string().optional(),
    suggestedPromptIds: z.array(z.number()).optional()
  })
  .openapi('UpdateTicketTask')

// Queue Item needs Create/Update schemas with different naming
export const CreateQueueItemSchema = z
  .object({
    queueId: z.number().int().positive(),
    itemType: z.enum(['ticket', 'task', 'chat', 'prompt']),
    itemId: z.number().int().positive(),
    priority: z.number().default(0),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).default('queued'),
    agentId: z.string().optional(),
    estimatedProcessingTime: z.number().optional()
  })
  .openapi('CreateQueueItem')

export const UpdateQueueItemSchema = z
  .object({
    priority: z.number().optional(),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
    agentId: z.string().optional(),
    errorMessage: z.string().optional(),
    estimatedProcessingTime: z.number().optional(),
    actualProcessingTime: z.number().optional(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional()
  })
  .openapi('UpdateQueueItem')

// Project schemas - aliases for proper naming expected by generated routes
export const CreateProjectSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    path: z.string().optional(),
    isDefault: z.boolean().default(false)
  })
  .openapi('CreateProject')

export const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    path: z.string().optional(),
    isDefault: z.boolean().optional()
  })
  .openapi('UpdateProject')

// =============================================================================
// UPDATE SCHEMAS - Only for missing entities
// =============================================================================

// UpdateActiveTab schema for generated routes
// (Note: active-tab-request.schemas.ts has a different UpdateActiveTab type)
export const UpdateActiveTabSchema = z
  .object({
    tabId: z.number().int().min(0).optional(),
    clientId: z.string().optional(),
    tabMetadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('UpdateActiveTab')

export const UpdateChatSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    projectId: z.number().int().positive().optional()
  })
  .openapi('UpdateChat')

export const UpdateFileSchema = z
  .object({
    path: z.string().min(1).optional(),
    type: z.enum(['file', 'directory']).optional(),
    size: z.number().optional(),
    lastModified: z.number().optional(),
    permissions: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('UpdateFile')

export const UpdateQueueSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    maxConcurrency: z.number().int().positive().optional(),
    retryConfig: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('UpdateQueue')

export const UpdateSelectedFileSchema = z
  .object({
    selectionType: z.enum(['manual', 'auto', 'suggested']).optional(),
    relevanceScore: z.number().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })
  .openapi('UpdateSelectedFile')

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ActiveTab = z.infer<typeof ActiveTabSchema>
export type Chat = z.infer<typeof ChatSchema>
export type File = z.infer<typeof FileSchema>
export type Queue = z.infer<typeof QueueSchema>
export type SelectedFile = z.infer<typeof SelectedFileSchema>
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type QueueItem = z.infer<typeof QueueItemSchema>
export type Ticket = z.infer<typeof TicketSchema>
export type TicketTask = z.infer<typeof TicketTaskSchema>
export type Prompt = z.infer<typeof PromptSchema>

export type ProviderKey = z.infer<typeof ProviderKeySchema>

export type CreateActiveTab = z.infer<typeof CreateActiveTabSchema>
export type CreateChat = z.infer<typeof CreateChatSchema>
export type CreateFile = z.infer<typeof CreateFileSchema>
export type CreateQueue = z.infer<typeof CreateQueueSchema>
export type CreateSelectedFile = z.infer<typeof CreateSelectedFileSchema>
export type CreateChatMessage = z.infer<typeof CreateChatMessageSchema>
export type UpdateChatMessage = z.infer<typeof UpdateChatMessageSchema>
export type CreateProviderKey = z.infer<typeof CreateProviderKeySchema>
export type UpdateProviderKey = z.infer<typeof UpdateProviderKeySchema>
export type CreateTicket = z.infer<typeof CreateTicketSchema>
export type UpdateTicket = z.infer<typeof UpdateTicketSchema>
export type CreateTicketTask = z.infer<typeof CreateTicketTaskSchema>
export type UpdateTicketTask = z.infer<typeof UpdateTicketTaskSchema>
export type CreateQueueItem = z.infer<typeof CreateQueueItemSchema>
export type UpdateQueueItem = z.infer<typeof UpdateQueueItemSchema>
export type CreateProject = z.infer<typeof CreateProjectSchema>
export type UpdateProject = z.infer<typeof UpdateProjectSchema>

export type UpdateActiveTab = z.infer<typeof UpdateActiveTabSchema>
export type UpdateChat = z.infer<typeof UpdateChatSchema>
export type UpdateFile = z.infer<typeof UpdateFileSchema>
export type UpdateQueue = z.infer<typeof UpdateQueueSchema>
export type UpdateSelectedFile = z.infer<typeof UpdateSelectedFileSchema>
