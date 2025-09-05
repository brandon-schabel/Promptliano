import { z } from '@hono/zod-openapi'
import {
  createSuccessResponseSchema,
  createListResponseSchema,
} from './factories'

// Import only types from database (not runtime schemas to avoid Vite bundling issues)
import type {
  Ticket as DatabaseTicket,
  Chat as DatabaseChat,
  Queue as DatabaseQueue,

  SelectedFile as DatabaseSelectedFile,
  ActiveTab as DatabaseActiveTab
} from '@promptliano/database'

// Import the actual schemas for proper type validation (type-only to avoid bundling issues)
import { SelectedFileSchema } from './entity.schemas'

// Recreate basic schemas locally to avoid runtime imports
// These are used in response schemas but don't need full validation
const TicketSchema = z.object({}).passthrough()
const ChatSchema = z.object({}).passthrough()
const QueueSchema = z.object({}).passthrough()
const ActiveTabSchema = z.object({}).passthrough()

// Recreate schema definitions locally based on database schema

// =============================================================================
// MISSING RESPONSE SCHEMAS FOR AUTO-GENERATED ROUTES
// =============================================================================
// These schemas are imported by auto-generated routes but were missing from the codebase.
// They provide standard response formats for various API operations.

// Task Schema
const TaskSchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'normal', 'high']),
  assignedTo: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number()
}).describe('Task')

// Task List Response Schema
export const TaskListResponseSchema = createListResponseSchema(TaskSchema, { name: 'Task' })

// Chat Message Create Schema
export const ChatMessageCreateSchema = z
  .object({
    chatId: z.number().int().positive(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
    metadata: z.record(z.any()).optional().default({})
  })
  .openapi('ChatMessageCreate')

// Chat Message Schema
const ChatMessageSchema = z.object({
  id: z.number(),
  chatId: z.number(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.number()
}).describe('ChatMessage')

// Chat Message Response Schema
export const ChatMessageResponseSchema = createSuccessResponseSchema(ChatMessageSchema, { name: 'ChatMessage' })

// Chat Message List Response Schema
export const ChatMessageListResponseSchema = createListResponseSchema(ChatMessageSchema, { name: 'ChatMessage' })

// Chat Schema (basic)
const ChatDataSchema = z.object({
  id: z.number(),
  projectId: z.number(),
  title: z.string(), // Changed from 'name' to 'title' to match database schema
  createdAt: z.number(),
  updatedAt: z.number()
}).describe('Chat')

// Chat Response Schema
export const ChatResponseSchema = createSuccessResponseSchema(ChatDataSchema, { name: 'Chat' })

// Hook Schema
const HookSchema = z.object({
  id: z.number(),
  projectId: z.number().nullable(),
  name: z.string(),
  event: z.string(),
  command: z.string(),
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number()
}).describe('Hook')

// Queue Stats Schema
const QueueStatsDataSchema = z.object({
  queueId: z.number(),
  name: z.string(),
  stats: z.object({
    totalItems: z.number(),
    pendingItems: z.number(),
    processingItems: z.number(),
    completedItems: z.number(),
    failedItems: z.number(),
    averageProcessingTime: z.number(),
    throughputPerHour: z.number(),
    errorRate: z.number(),
    oldestPendingItem: z.number().nullable(),
    lastProcessedItem: z.number().nullable()
  })
}).describe('QueueStats')

// Queue Stats Response Schema
export const QueueStatsResponseSchema = createSuccessResponseSchema(QueueStatsDataSchema, { name: 'QueueStats' })

// =============================================================================
// MISSING LIST RESPONSE SCHEMAS
// =============================================================================

// Ticket List Response Schema
export const TicketListResponseSchema = createListResponseSchema(TicketSchema, { name: 'Ticket' })

// Chat List Response Schema
export const ChatListResponseSchema = createListResponseSchema(ChatSchema, { name: 'Chat' })

// Queue List Response Schema
export const QueueListResponseSchema = createListResponseSchema(QueueSchema, { name: 'Queue' })

// Selected File List Response Schema
export const SelectedFileListResponseSchema = createListResponseSchema(SelectedFileSchema, { name: 'SelectedFile' })

// Active Tab List Response Schema
export const ActiveTabListResponseSchema = createListResponseSchema(ActiveTabSchema, { name: 'ActiveTab' })

// Note: ProjectListResponseSchema and PromptListResponseSchema are exported 
// from project.schemas.ts and prompt.schemas.ts respectively to avoid duplicates

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type TaskListResponse = z.infer<typeof TaskListResponseSchema>
export type ChatMessageCreate = z.infer<typeof ChatMessageCreateSchema>
export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>
export type ChatMessageListResponse = z.infer<typeof ChatMessageListResponseSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
export type QueueStatsResponse = z.infer<typeof QueueStatsResponseSchema>
export type TicketListResponse = z.infer<typeof TicketListResponseSchema>
export type ChatListResponse = z.infer<typeof ChatListResponseSchema>
export type QueueListResponse = z.infer<typeof QueueListResponseSchema>
export type SelectedFileListResponse = z.infer<typeof SelectedFileListResponseSchema>
export type ActiveTabListResponse = z.infer<typeof ActiveTabListResponseSchema>
// Note: ProjectListResponse and PromptListResponse types are exported from their respective schema files
