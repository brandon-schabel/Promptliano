import { z } from '@hono/zod-openapi'
import {
  createSuccessResponseSchema,
  createListResponseSchema,
  createOperationResponseSchema,
  createMetadataResponseSchema
} from './factories'

// Import only types from database (not runtime schemas to avoid Vite bundling issues)
import type {
  Ticket as DatabaseTicket,
  Chat as DatabaseChat,
  Queue as DatabaseQueue,
  SelectedFile as DatabaseSelectedFile
} from '@promptliano/database'

// Import the actual schemas for proper type validation (type-only to avoid bundling issues)
import { SelectedFileSchema } from './entity.schemas'

// Recreate basic schemas locally to avoid runtime imports
// These are used in response schemas but don't need full validation
const TicketSchema = z.object({}).passthrough()
const ChatSchema = z.object({}).passthrough()
const QueueSchema = z.object({}).passthrough()
const ActiveTabSchema = z.object({}).passthrough()
const PromptSchema = z.object({}).passthrough()
const FileSchema = z.object({}).passthrough()

// Recreate schema definitions locally based on database schema

// =============================================================================
// MISSING RESPONSE SCHEMAS FOR AUTO-GENERATED ROUTES
// =============================================================================
// These schemas are imported by auto-generated routes but were missing from the codebase.
// They provide standard response formats for various API operations.

// Task Schema
const TaskSchema = z
  .object({
    id: z.number(),
    ticketId: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(['pending', 'in_progress', 'completed']),
    priority: z.enum(['low', 'normal', 'high']),
    assignedTo: z.string().nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .describe('Task')

// Task List Response Schema
export const TaskListResponseSchema = createListResponseSchema(TaskSchema, { name: 'Task' })

// Chat Message Create Schema
export const ChatMessageCreateSchema = z
  .object({
    chatId: z.number().int().positive(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
    metadata: z.record(z.string(), z.any()).optional().default({})
  })
  .openapi('ChatMessageCreate')

// Chat Message Schema
const ChatMessageSchema = z
  .object({
    id: z.number(),
    chatId: z.number(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    metadata: z.record(z.string(), z.any()).nullable(),
    createdAt: z.number()
  })
  .describe('ChatMessage')

// Chat Message Response Schema
export const ChatMessageResponseSchema = createSuccessResponseSchema(ChatMessageSchema, { name: 'ChatMessage' })

// Chat Message List Response Schema
export const ChatMessageListResponseSchema = createListResponseSchema(ChatMessageSchema, { name: 'ChatMessage' })

// Chat Schema (basic)
const ChatDataSchema = z
  .object({
    id: z.number(),
    projectId: z.number(),
    title: z.string(), // Changed from 'name' to 'title' to match database schema
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .describe('Chat')

// Chat Response Schema
export const ChatResponseSchema = createSuccessResponseSchema(ChatDataSchema, { name: 'Chat' })

// Chat List Response Schema
export const ChatListResponseSchema = createListResponseSchema(ChatDataSchema, { name: 'Chat' })

// Ticket List Response Schema
export const TicketListResponseSchema = createListResponseSchema(TicketSchema, { name: 'Ticket' })

// Note: PromptListResponseSchema is exported from prompt.schemas.ts to avoid duplicates

// Queue List Response Schema
export const QueueListResponseSchema = createListResponseSchema(QueueSchema, { name: 'Queue' })

// Note: FileListResponseSchema is exported from project.schemas.ts to avoid duplicates

// SelectedFile List Response Schema
export const SelectedFileListResponseSchema = createListResponseSchema(SelectedFileSchema, { name: 'SelectedFile' })

// ActiveTab List Response Schema
export const ActiveTabListResponseSchema = createListResponseSchema(ActiveTabSchema, { name: 'ActiveTab' })

// Hook Schema
const HookSchema = z
  .object({
    id: z.number(),
    projectId: z.number().nullable(),
    name: z.string(),
    event: z.string(),
    command: z.string(),
    enabled: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .describe('Hook')

// Hook API Response Schema
export const HookApiResponseSchema = createSuccessResponseSchema(HookSchema, { name: 'HookApi' })

// Hook List Response Schema
export const HookListResponseSchema = createListResponseSchema(HookSchema, { name: 'Hook' })

// Create Hook Request Schema
export const CreateHookRequestSchema = z
  .object({
    name: z.string().min(1),
    event: z.string(),
    command: z.string(),
    enabled: z.boolean().default(true),
    projectId: z.number().nullable().optional()
  })
  .openapi('CreateHookRequest')

// Update Hook Request Schema
export const UpdateHookRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    event: z.string().optional(),
    command: z.string().optional(),
    enabled: z.boolean().optional()
  })
  .openapi('UpdateHookRequest')

// Hook Event Schema
export const HookEventSchema = z.enum(['user-prompt-submit', 'tool-call', 'file-change']).openapi('HookEvent')

// Hook Generation Request Schema
export const HookGenerationRequestSchema = z
  .object({
    event: HookEventSchema,
    description: z.string().min(1),
    projectId: z.number().optional()
  })
  .openapi('HookGenerationRequest')

// Hook Generation Response Schema
const HookGenerationDataSchema = z
  .object({
    name: z.string(),
    command: z.string(),
    description: z.string()
  })
  .describe('HookGeneration')

export const HookGenerationResponseSchema = createSuccessResponseSchema(HookGenerationDataSchema, {
  name: 'HookGeneration'
})

// Hook Test Request Schema
export const HookTestRequestSchema = z
  .object({
    command: z.string(),
    testData: z.record(z.string(), z.any()).optional()
  })
  .openapi('HookTestRequest')

// Hook Test Response Schema
const HookTestDataSchema = z
  .object({
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    executionTime: z.number()
  })
  .describe('HookTest')

export const HookTestResponseSchema = createSuccessResponseSchema(HookTestDataSchema, { name: 'HookTest' })

// Queue Item Create Schema
export const QueueItemCreateSchema = z
  .object({
    queueId: z.number().int().positive(),
    type: z.string().min(1),
    data: z.record(z.string(), z.any()),
    priority: z.number().int().min(0).max(10).default(5),
    scheduledFor: z.number().optional(),
    maxRetries: z.number().int().min(0).default(3)
  })
  .openapi('QueueItemCreate')

// Queue Item Schema
const QueueItemSchema = z
  .object({
    id: z.number(),
    queueId: z.number(),
    type: z.string(),
    data: z.record(z.string(), z.any()),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    priority: z.number(),
    scheduledFor: z.number().nullable(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable(),
    error: z.string().nullable(),
    retryCount: z.number(),
    maxRetries: z.number(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .describe('QueueItem')

// Queue Item Response Schema
export const QueueItemResponseSchema = createSuccessResponseSchema(QueueItemSchema, { name: 'QueueItem' })

// Queue Stats Schema
const QueueStatsDataSchema = z
  .object({
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
  })
  .describe('QueueStats')

// Queue Stats Response Schema
export const QueueStatsResponseSchema = createSuccessResponseSchema(QueueStatsDataSchema, { name: 'QueueStats' })

// =============================================================================
// MISSING LIST RESPONSE SCHEMAS
// =============================================================================

// Command Execution Response Schema
const CommandExecutionDataSchema = z
  .object({
    result: z.string(),
    usage: z
      .object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number()
      })
      .optional(),
    model: z.string().optional(),
    sessionId: z.string().optional()
  })
  .describe('CommandExecution')

export const CommandExecutionResponseSchema = createSuccessResponseSchema(CommandExecutionDataSchema, {
  name: 'CommandExecution'
})

// Agent Suggestion Schema
const AgentSuggestionSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    path: z.string(),
    relevanceScore: z.number()
  })
  .describe('AgentSuggestion')

// Agent Suggestions Response Schema
export const AgentSuggestionsResponseSchema = createListResponseSchema(AgentSuggestionSchema, {
  name: 'AgentSuggestions'
})

// Command Suggestion Schema
const CommandSuggestionSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    content: z.string(),
    category: z.string(),
    useCase: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard'])
  })
  .describe('CommandSuggestion')

// Command Suggestions Response Schema
const CommandSuggestionsDataSchema = z
  .object({
    suggestions: z.array(CommandSuggestionSchema),
    reasoning: z.string()
  })
  .describe('CommandSuggestions')

export const CommandSuggestionsResponseSchema = createSuccessResponseSchema(CommandSuggestionsDataSchema, {
  name: 'CommandSuggestions'
})

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
export type HookApiResponse = z.infer<typeof HookApiResponseSchema>
export type HookListResponse = z.infer<typeof HookListResponseSchema>
export type CreateHookRequest = z.infer<typeof CreateHookRequestSchema>
export type UpdateHookRequest = z.infer<typeof UpdateHookRequestSchema>
export type HookEvent = z.infer<typeof HookEventSchema>
export type HookGenerationRequest = z.infer<typeof HookGenerationRequestSchema>
export type HookGenerationResponse = z.infer<typeof HookGenerationResponseSchema>
export type HookTestRequest = z.infer<typeof HookTestRequestSchema>
export type HookTestResponse = z.infer<typeof HookTestResponseSchema>
export type QueueItemCreate = z.infer<typeof QueueItemCreateSchema>
export type QueueItemResponse = z.infer<typeof QueueItemResponseSchema>
export type QueueStatsResponse = z.infer<typeof QueueStatsResponseSchema>
export type TicketListResponse = z.infer<typeof TicketListResponseSchema>
export type ChatListResponse = z.infer<typeof ChatListResponseSchema>
export type QueueListResponse = z.infer<typeof QueueListResponseSchema>

export type CommandExecutionResponse = z.infer<typeof CommandExecutionResponseSchema>
export type AgentSuggestionsResponse = z.infer<typeof AgentSuggestionsResponseSchema>
export type CommandSuggestionsResponse = z.infer<typeof CommandSuggestionsResponseSchema>
export type SelectedFileListResponse = z.infer<typeof SelectedFileListResponseSchema>
export type ActiveTabListResponse = z.infer<typeof ActiveTabListResponseSchema>
// Note: ProjectListResponse and PromptListResponse types are exported from their respective schema files
