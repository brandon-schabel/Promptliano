import { z } from '@hono/zod-openapi'
// Import only types from database (not runtime schemas to avoid Vite bundling issues)
import type {
  Ticket as DatabaseTicket,
  Chat as DatabaseChat,
  Queue as DatabaseQueue,
  ClaudeCommand as DatabaseClaudeCommand,
  ClaudeHook as DatabaseClaudeHook,
  ClaudeAgent as DatabaseClaudeAgent,
  SelectedFile as DatabaseSelectedFile,
  ActiveTab as DatabaseActiveTab
} from '@promptliano/database'

// Import the actual schemas for proper type validation (type-only to avoid bundling issues)
import type {
  ClaudeAgentSchema as DatabaseClaudeAgentSchema,
  ClaudeCommandSchema as DatabaseClaudeCommandSchema,
  ClaudeHookSchema as DatabaseClaudeHookSchema
} from '@promptliano/database'

// Recreate basic schemas locally to avoid runtime imports
// These are used in response schemas but don't need full validation
const TicketSchema = z.object({}).passthrough()
const ChatSchema = z.object({}).passthrough()
const QueueSchema = z.object({}).passthrough()
const SelectedFileSchema = z.object({}).passthrough()
const ActiveTabSchema = z.object({}).passthrough()

// Recreate schema definitions locally based on database schema
const ClaudeCommandSchema = z.object({
  id: z.number(),
  name: z.string(),
  content: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  projectId: z.number().nullable(),
  tags: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number()
})

const ClaudeHookSchema = z.object({
  id: z.number(),
  projectId: z.number().nullable(),
  name: z.string(),
  event: z.string(),
  command: z.string(),
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number()
})

const ClaudeAgentSchema = z.object({
  id: z.string(), // String ID from claude system
  name: z.string(),
  description: z.string().nullable(),
  instructions: z.string().nullable(),
  model: z.string(),
  isActive: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number()
})

// =============================================================================
// MISSING RESPONSE SCHEMAS FOR AUTO-GENERATED ROUTES
// =============================================================================
// These schemas are imported by auto-generated routes but were missing from the codebase.
// They provide standard response formats for various API operations.

// Task List Response Schema
export const TaskListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
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
    )
  })
  .openapi('TaskListResponse')

// Chat Message Create Schema
export const ChatMessageCreateSchema = z
  .object({
    chatId: z.number().int().positive(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
    metadata: z.record(z.any()).optional().default({})
  })
  .openapi('ChatMessageCreate')

// Chat Message Response Schema
export const ChatMessageResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.number(),
      chatId: z.number(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      metadata: z.record(z.any()).nullable(),
      createdAt: z.number()
    })
  })
  .openapi('ChatMessageResponse')

// Chat Message List Response Schema
export const ChatMessageListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        id: z.number(),
        chatId: z.number(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        metadata: z.record(z.any()).nullable(),
        createdAt: z.number()
      })
    )
  })
  .openapi('ChatMessageListResponse')

// Chat Response Schema
export const ChatResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.number(),
      projectId: z.number(),
      title: z.string(), // Changed from 'name' to 'title' to match database schema
      createdAt: z.number(),
      updatedAt: z.number()
    })
  })
  .openapi('ChatResponse')

// Hook API Response Schema
export const HookApiResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.number(),
      projectId: z.number().nullable(),
      name: z.string(),
      event: z.string(),
      command: z.string(),
      enabled: z.boolean(),
      createdAt: z.number(),
      updatedAt: z.number()
    })
  })
  .openapi('HookApiResponse')

// Hook List Response Schema
export const HookListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        id: z.number(),
        projectId: z.number().nullable(),
        name: z.string(),
        event: z.string(),
        command: z.string(),
        enabled: z.boolean(),
        createdAt: z.number(),
        updatedAt: z.number()
      })
    )
  })
  .openapi('HookListResponse')

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
export const HookGenerationResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      name: z.string(),
      command: z.string(),
      description: z.string()
    })
  })
  .openapi('HookGenerationResponse')

// Hook Test Request Schema
export const HookTestRequestSchema = z
  .object({
    command: z.string(),
    testData: z.record(z.any()).optional()
  })
  .openapi('HookTestRequest')

// Hook Test Response Schema
export const HookTestResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      exitCode: z.number(),
      stdout: z.string(),
      stderr: z.string(),
      executionTime: z.number()
    })
  })
  .openapi('HookTestResponse')

// Queue Item Create Schema
export const QueueItemCreateSchema = z
  .object({
    queueId: z.number().int().positive(),
    type: z.string().min(1),
    data: z.record(z.any()),
    priority: z.number().int().min(0).max(10).default(5),
    scheduledFor: z.number().optional(),
    maxRetries: z.number().int().min(0).default(3)
  })
  .openapi('QueueItemCreate')

// Queue Item Response Schema
export const QueueItemResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.number(),
      queueId: z.number(),
      type: z.string(),
      data: z.record(z.any()),
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
  })
  .openapi('QueueItemResponse')

// Queue Stats Response Schema
export const QueueStatsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
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
  })
  .openapi('QueueStatsResponse')

// =============================================================================
// MISSING LIST RESPONSE SCHEMAS
// =============================================================================

// Ticket List Response Schema
export const TicketListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketSchema)
  })
  .openapi('TicketListResponse')

// Chat List Response Schema
export const ChatListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ChatSchema)
  })
  .openapi('ChatListResponse')

// Queue List Response Schema
export const QueueListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(QueueSchema)
  })
  .openapi('QueueListResponse')

// Claude Command List Response Schema
export const ClaudeCommandListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeCommandSchema)
  })
  .openapi('ClaudeCommandListResponse')

// Claude Hook List Response Schema
export const ClaudeHookListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeHookSchema)
  })
  .openapi('ClaudeHookListResponse')

// Claude Agent Response Schema
export const ClaudeAgentResponseSchema = z
  .object({
    success: z.literal(true),
    data: ClaudeAgentSchema
  })
  .openapi('ClaudeAgentResponse')

// Claude Agent List Response Schema
export const ClaudeAgentListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeAgentSchema)
  })
  .openapi('ClaudeAgentListResponse')

// Claude Command Response Schema
export const ClaudeCommandResponseSchema = z
  .object({
    success: z.literal(true),
    data: ClaudeCommandSchema
  })
  .openapi('ClaudeCommandResponse')

// Command Execution Response Schema
export const CommandExecutionResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
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
  })
  .openapi('CommandExecutionResponse')

// Agent Suggestions Response Schema
export const AgentSuggestionsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        path: z.string(),
        relevanceScore: z.number()
      })
    )
  })
  .openapi('AgentSuggestionsResponse')

// Command Suggestions Response Schema
export const CommandSuggestionsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      suggestions: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          content: z.string(),
          category: z.string(),
          useCase: z.string(),
          difficulty: z.enum(['easy', 'medium', 'hard'])
        })
      ),
      reasoning: z.string()
    })
  })
  .openapi('CommandSuggestionsResponse')

// Selected File List Response Schema
export const SelectedFileListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(SelectedFileSchema)
  })
  .openapi('SelectedFileListResponse')

// Active Tab List Response Schema
export const ActiveTabListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ActiveTabSchema)
  })
  .openapi('ActiveTabListResponse')

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
export type ClaudeCommandListResponse = z.infer<typeof ClaudeCommandListResponseSchema>
export type ClaudeHookListResponse = z.infer<typeof ClaudeHookListResponseSchema>
export type ClaudeAgentResponse = z.infer<typeof ClaudeAgentResponseSchema>
export type ClaudeAgentListResponse = z.infer<typeof ClaudeAgentListResponseSchema>
export type ClaudeCommandResponse = z.infer<typeof ClaudeCommandResponseSchema>
export type CommandExecutionResponse = z.infer<typeof CommandExecutionResponseSchema>
export type AgentSuggestionsResponse = z.infer<typeof AgentSuggestionsResponseSchema>
export type CommandSuggestionsResponse = z.infer<typeof CommandSuggestionsResponseSchema>
export type SelectedFileListResponse = z.infer<typeof SelectedFileListResponseSchema>
export type ActiveTabListResponse = z.infer<typeof ActiveTabListResponseSchema>
