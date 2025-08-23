import { z } from '@hono/zod-openapi'
import {
  unixTSSchemaSpec,
  unixTSOptionalSchemaSpec,
  entityIdSchema,
  entityIdOptionalSchema,
  entityIdNullableOptionalSchema,
  entityIdArraySchema
} from './schema-utils'

// Import database schemas as source of truth
import { 
  TicketSchema as DatabaseTicketSchema,
  TaskSchema as DatabaseTaskSchema 
} from '@promptliano/database'

// Use database schemas as the base
export const TicketSchema = DatabaseTicketSchema
export const TicketTaskSchema = DatabaseTaskSchema

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
}).extend({
  title: z.string().min(1),
  overview: z.string().default(''),
  status: z.enum(['open', 'in_progress', 'closed']).default('open'),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
}).openapi('CreateTicketBody')

export const UpdateTicketBodySchema = CreateTicketBodySchema.pick({
  title: true,
  overview: true, 
  status: true,
  priority: true,
  suggestedFileIds: true,
  suggestedAgentIds: true,
  suggestedPromptIds: true
}).partial().openapi('UpdateTicketBody')

export const CreateTaskBodySchema = TicketTaskSchema.pick({
  content: true,
  description: true,
  suggestedFileIds: true,
  estimatedHours: true,
  dependencies: true,
  tags: true,
  agentId: true,
  suggestedPromptIds: true
}).extend({
  content: z.string().min(1)
}).openapi('CreateTaskBody')

export const UpdateTaskBodySchema = CreateTaskBodySchema.pick({
  content: true,
  description: true,
  suggestedFileIds: true,
  estimatedHours: true,
  dependencies: true,
  tags: true,
  agentId: true,
  suggestedPromptIds: true
}).partial().extend({
  done: z.boolean().optional()
}).openapi('UpdateTaskBody')

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
