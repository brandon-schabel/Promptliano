import { z } from '@hono/zod-openapi'
import {
  unixTSSchemaSpec,
  unixTSOptionalSchemaSpec,
  entityIdSchema,
  entityIdOptionalSchema,
  entityIdNullableOptionalSchema
} from './schema-utils'

// Import only types from database (not runtime schemas to avoid Vite bundling issues)
import type { Queue as DatabaseQueue, QueueItem as DatabaseQueueItem } from '@promptliano/database'

// Recreate schemas locally to avoid runtime imports from database package
export const TaskQueueSchema = z
  .object({
    id: z.number(),
    projectId: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    maxParallelItems: z.number(),
    isActive: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .openapi('TaskQueue')

export const QueueItemSchema = z
  .object({
    id: z.number(),
    queueId: z.number(),
    itemType: z.enum(['ticket', 'task', 'chat', 'prompt']),
    itemId: z.number(),
    priority: z.number(),
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

// Type verification to ensure schemas match database types
const _queueTypeCheck: z.infer<typeof TaskQueueSchema> = {} as DatabaseQueue
const _queueItemTypeCheck: z.infer<typeof QueueItemSchema> = {} as DatabaseQueueItem

// Queue status enums (keep for API validation)
export const QueueStatusEnum = z.enum(['active', 'paused', 'inactive'])
export type QueueStatus = z.infer<typeof QueueStatusEnum>

export const ItemQueueStatusEnum = z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'timeout'])
export type ItemQueueStatus = z.infer<typeof ItemQueueStatusEnum>

// Queue statistics schema
export const QueueStatsSchema = z
  .object({
    queueId: entityIdSchema,
    queueName: z.string(),
    totalItems: z.number(),
    queuedItems: z.number(),
    inProgressItems: z.number(),
    completedItems: z.number(),
    failedItems: z.number(),
    cancelledItems: z.number(),
    averageProcessingTime: z.number().nullable(), // in milliseconds
    currentAgents: z.array(z.string()), // list of agent IDs currently processing
    // Enhanced stats fields (optional for backward compatibility)
    ticketCount: z.number().optional(),
    taskCount: z.number().optional(),
    uniqueTickets: z.number().optional()
  })
  .openapi('QueueStats')

// API Request Body Schemas - derived from database schemas
export const CreateQueueBodySchema = TaskQueueSchema.pick({
  projectId: true,
  name: true,
  description: true,
  maxParallelItems: true
})
  .extend({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    maxParallelItems: z.number().min(1).max(10).optional()
  })
  .openapi('CreateQueueBody')

export const UpdateQueueBodySchema = CreateQueueBodySchema.pick({
  name: true,
  description: true,
  maxParallelItems: true
})
  .partial()
  .extend({
    status: QueueStatusEnum.optional(),
    isActive: z.boolean().optional()
  })
  .openapi('UpdateQueueBody')

// Enqueue item body schema
export const EnqueueItemBodySchema = z
  .object({
    ticketId: entityIdOptionalSchema,
    taskId: entityIdOptionalSchema,
    priority: z.number().optional(),
    agentId: z.string().optional()
  })
  .refine(
    (data) => {
      // Ensure either ticketId or taskId is set, but not both
      return (
        (data.ticketId !== undefined && data.taskId === undefined) ||
        (data.ticketId === undefined && data.taskId !== undefined)
      )
    },
    {
      message: 'Either ticketId or taskId must be set, but not both'
    }
  )
  .openapi('EnqueueItemBody')

// Note: UpdateQueueItemBodySchema removed - use ticket/task update endpoints directly

// Get next task response schema
// Note: Import cycle prevents direct import of TicketSchema and TicketTaskSchema
// These will be properly typed when used in services
export const GetNextTaskResponseSchema = z
  .object({
    queueItem: QueueItemSchema.nullable(),
    ticket: z.any().nullable(), // TicketSchema when used
    task: z.any().nullable() // TicketTaskSchema when used
  })
  .openapi('GetNextTaskResponse')

// Standardized batch enqueue result schema
export const BatchEnqueueResultSchema = z
  .object({
    items: z.array(QueueItemSchema), // Successfully enqueued items
    skipped: z.number().default(0), // Count of skipped duplicates
    errors: z.array(z.string()).optional() // Optional error messages
  })
  .openapi('BatchEnqueueResult')

// Queue with stats schema
export const QueueWithStatsSchema = z
  .object({
    queue: TaskQueueSchema,
    stats: QueueStatsSchema
  })
  .openapi('QueueWithStats')

// Aliases for auto-generated routes (they expect different names)
export const CreateQueueSchema = CreateQueueBodySchema
export const UpdateQueueSchema = UpdateQueueBodySchema
export const CreateQueueItemSchema = EnqueueItemBodySchema

// Type exports
export type TaskQueue = z.infer<typeof TaskQueueSchema>
export type QueueItem = z.infer<typeof QueueItemSchema>
export type QueueStats = z.infer<typeof QueueStatsSchema>
export type CreateQueueBody = z.infer<typeof CreateQueueBodySchema>
export type UpdateQueueBody = z.infer<typeof UpdateQueueBodySchema>
export type CreateQueue = z.infer<typeof CreateQueueSchema>
export type UpdateQueue = z.infer<typeof UpdateQueueSchema>
export type CreateQueueItem = z.infer<typeof CreateQueueItemSchema>
export type EnqueueItemBody = z.infer<typeof EnqueueItemBodySchema>
export type GetNextTaskResponse = z.infer<typeof GetNextTaskResponseSchema>
export type BatchEnqueueResult = z.infer<typeof BatchEnqueueResultSchema>
export type QueueWithStats = z.infer<typeof QueueWithStatsSchema>

// API validation schemas
export const queueApiValidation = {
  create: {
    body: CreateQueueBodySchema
  },
  update: {
    body: UpdateQueueBodySchema,
    params: z.object({
      queueId: z.string()
    })
  },
  getOrDelete: {
    params: z.object({
      queueId: z.string()
    })
  },
  enqueue: {
    body: EnqueueItemBodySchema,
    params: z.object({
      queueId: z.string()
    })
  },
  // Note: updateItem removed - use ticket/task update endpoints
  getNextTask: {
    params: z.object({
      queueId: z.string()
    }),
    query: z.object({
      agentId: z.string().optional()
    })
  }
}

// Batch operation schemas
export const BatchEnqueueBodySchema = z
  .object({
    items: z.array(EnqueueItemBodySchema).min(1).max(100)
  })
  .openapi('BatchEnqueueBody')

// Note: BatchUpdateItemsBodySchema removed - use ticket/task batch update endpoints

export type BatchEnqueueBody = z.infer<typeof BatchEnqueueBodySchema>
// Note: BatchUpdateItemsBody type removed

// Kanban operation schemas
export const BulkMoveItemsBodySchema = z
  .object({
    itemIds: z.array(entityIdSchema).min(1),
    targetQueueId: entityIdSchema,
    positions: z.array(z.number()).optional() // Optional array of positions for each item
  })
  .openapi('BulkMoveItemsBody')

export const ReorderQueueItemsBodySchema = z
  .object({
    queueId: entityIdSchema,
    itemIds: z.array(entityIdSchema).min(1) // Items in their new order
  })
  .openapi('ReorderQueueItemsBody')

export const QueueTimelineSchema = z
  .object({
    queueId: entityIdSchema,
    currentTime: z.number(),
    items: z.array(
      z.object({
        itemId: entityIdSchema,
        ticketId: entityIdNullableOptionalSchema,
        taskId: entityIdNullableOptionalSchema,
        title: z.string(),
        estimatedStartTime: z.number(),
        estimatedEndTime: z.number(),
        estimatedProcessingTime: z.number(),
        status: ItemQueueStatusEnum
      })
    ),
    totalEstimatedTime: z.number(),
    estimatedCompletionTime: z.number()
  })
  .openapi('QueueTimeline')

export type BulkMoveItemsBody = z.infer<typeof BulkMoveItemsBodySchema>
export type ReorderQueueItemsBody = z.infer<typeof ReorderQueueItemsBodySchema>
export type QueueTimeline = z.infer<typeof QueueTimelineSchema>
