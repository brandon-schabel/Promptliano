import { z } from '@hono/zod-openapi'
import {
  unixTSSchemaSpec,
  unixTSOptionalSchemaSpec,
  entityIdSchema,
  entityIdOptionalSchema,
  entityIdNullableOptionalSchema,
  entityIdArraySchema
} from './schema-utils'

// Import only types from database (not runtime schemas to avoid Vite bundling issues)
import type { Ticket as DatabaseTicket, TicketTask as DatabaseTicketTask } from '@promptliano/database'

// Recreate schemas locally to avoid runtime imports from database package
// These must stay in sync with the database schemas
export const TicketSchema = z
  .object({
    id: z.number(),
    projectId: z.number(),
    title: z.string(),
    overview: z.string().nullable(),
    status: z.enum(['open', 'in_progress', 'closed']),
    priority: z.enum(['low', 'normal', 'high']),
    suggestedFileIds: z.array(z.string()),
    suggestedAgentIds: z.array(z.string()),
    suggestedPromptIds: z.array(z.number()),

    // Queue integration fields (unified flow system)
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

export const TicketTaskSchema = z
  .object({
    id: z.number(),
    ticketId: z.number(),
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

    // Queue integration fields (unified flow system)
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

// Type verification to ensure our schemas match the database types
// These will cause TypeScript errors if schemas drift out of sync
const _ticketTypeCheck: z.infer<typeof TicketSchema> = {} as DatabaseTicket
const _taskTypeCheck: z.infer<typeof TicketTaskSchema> = {} as DatabaseTicketTask

// API Request Body Schemas - derived from database schemas
export const CreateTicketBodySchema = TicketSchema.pick({
  projectId: true,
  title: true,
  overview: true,
  status: true,
  priority: true,
  suggestedFileIds: true,
  suggestedAgentIds: true,
  suggestedPromptIds: true
})
  .extend({
    title: z.string().min(1),
    overview: z.string().nullable().default(null),
    status: z.enum(['open', 'in_progress', 'closed']).default('open'),
    priority: z.enum(['low', 'normal', 'high']).default('normal')
  })
  .openapi('CreateTicketBody')

export const UpdateTicketBodySchema = CreateTicketBodySchema.pick({
  title: true,
  overview: true,
  status: true,
  priority: true,
  suggestedFileIds: true,
  suggestedAgentIds: true,
  suggestedPromptIds: true
})
  .partial()
  .openapi('UpdateTicketBody')

export const CreateTaskBodySchema = TicketTaskSchema.pick({
  content: true,
  description: true,
  suggestedFileIds: true,
  estimatedHours: true,
  dependencies: true,
  tags: true,
  agentId: true,
  suggestedPromptIds: true
})
  .extend({
    content: z.string().min(1)
  })
  .openapi('CreateTaskBody')

export const UpdateTaskBodySchema = CreateTaskBodySchema.pick({
  content: true,
  description: true,
  suggestedFileIds: true,
  estimatedHours: true,
  dependencies: true,
  tags: true,
  agentId: true,
  suggestedPromptIds: true
})
  .partial()
  .extend({
    done: z.boolean().optional()
  })
  .openapi('UpdateTaskBody')

export const ReorderTasksBodySchema = z
  .object({
    tasks: z.array(
      z.object({
        taskId: entityIdSchema,
        orderIndex: z.number().min(0)
      })
    )
  })
  .openapi('ReorderTasksBody')

// AI-related schemas
export const TaskSuggestionsSchema = z
  .object({
    tasks: z.array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        suggestedFileIds: z.array(z.string()).default([]), // NEW: Direct file IDs
        estimatedHours: z.number().nullable().optional(), // NEW
        tags: z.array(z.string()).default([]), // NEW
        suggestedAgentId: z.string().optional(), // NEW: Suggested agent for this task
        files: z
          .array(
            z.object({
              fileId: z.string(),
              fileName: z.string()
            })
          )
          .optional() // Keep for backward compatibility
      })
    )
  })
  .openapi('TaskSuggestions')

export const SuggestTasksBodySchema = z
  .object({
    userContext: z.string().optional()
  })
  .openapi('SuggestTasksBody')

export const TicketSuggestFilesBodySchema = z
  .object({
    extraUserInput: z.string().optional()
  })
  .openapi('TicketSuggestFilesBody')

// Combined schemas
export const TicketWithTasksSchema = z
  .object({
    ticket: TicketSchema,
    tasks: z.array(TicketTaskSchema)
  })
  .openapi('TicketWithTasks')

export const TicketWithTaskCountSchema = z
  .object({
    ticket: TicketSchema,
    taskCount: z.number(),
    completedTaskCount: z.number()
  })
  .openapi('TicketWithTaskCount')

// Type exports
export type Ticket = z.infer<typeof TicketSchema>
export type TicketTask = z.infer<typeof TicketTaskSchema>
export type CreateTicketBody = z.infer<typeof CreateTicketBodySchema>
export type UpdateTicketBody = z.infer<typeof UpdateTicketBodySchema>
export type CreateTaskBody = z.infer<typeof CreateTaskBodySchema>
export type UpdateTaskBody = z.infer<typeof UpdateTaskBodySchema>
export type ReorderTasksBody = z.infer<typeof ReorderTasksBodySchema>
export type TaskSuggestions = z.infer<typeof TaskSuggestionsSchema>
export type TicketWithTasks = z.infer<typeof TicketWithTasksSchema>
export type TicketWithTaskCount = z.infer<typeof TicketWithTaskCountSchema>

// API validation schemas
export const ticketsApiValidation = {
  create: {
    body: CreateTicketBodySchema
  },
  update: {
    body: UpdateTicketBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  getOrDelete: {
    params: z.object({
      ticketId: z.string()
    })
  },
  suggestTasks: {
    body: SuggestTasksBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  suggestFiles: {
    body: TicketSuggestFilesBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  createTask: {
    body: CreateTaskBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  updateTask: {
    body: UpdateTaskBodySchema,
    params: z.object({
      ticketId: z.string(),
      taskId: z.string()
    })
  },
  deleteTask: {
    params: z.object({
      ticketId: z.string(),
      taskId: z.string()
    })
  },
  reorderTasks: {
    body: ReorderTasksBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  linkFiles: {
    body: z.object({
      fileIds: z.array(z.string())
    }),
    params: z.object({
      ticketId: z.string()
    })
  }
}
