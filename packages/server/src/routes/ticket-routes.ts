// Modern functional service imports with ErrorFactory integration
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  createStandardResponses,
  standardResponses,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'

// Modern service imports
import {
  ticketService,
  createTicket,
  getTicketById,
  updateTicket,
  deleteTicket,
  completeTicket,
  linkFilesToTicket,
  suggestTasksForTicket,
  listTicketsByProject,
  listTicketsWithTaskCount,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  autoGenerateTasksFromOverview,
  getTasksForTickets,
  listTicketsWithTasks,
  suggestFilesForTicket
} from '@promptliano/services'

// Error factory and context handling from shared package
import { ApiError, ErrorFactory, withErrorContext } from '@promptliano/shared'
// Import database schemas as source of truth
import {
  selectTicketSchema as TicketSchema,
  selectTicketTaskSchema as TicketTaskSchema,
  type TicketStatus
} from '@promptliano/database'
// Import API-specific validation from schemas
import { ticketsApiValidation } from '@promptliano/schemas'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

// Schemas now come from @promptliano/database as single source of truth
const TaskSchema = TicketTaskSchema // Alias for consistency with existing code

const TicketResponseSchema = z
  .object({
    success: z.literal(true),
    data: TicketSchema
  })
  .openapi('TicketResponse')

const TicketListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketSchema)
  })
  .openapi('TicketListResponse')

const TaskResponseSchema = z
  .object({
    success: z.literal(true),
    data: TaskSchema
  })
  .openapi('TaskResponse')

const TaskListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TaskSchema)
  })
  .openapi('TaskListResponse')

const LinkedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        ticketId: z.string(),
        fileId: z.string()
      })
    )
  })
  .openapi('LinkedFilesResponse')

const SuggestedTasksResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      suggestedTasks: z.array(z.string())
    })
  })
  .openapi('SuggestedTasksResponse')

const SuggestedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      recommendedFileIds: z.array(z.string()),
      combinedSummaries: z.string().optional(),
      message: z.string().optional()
    })
  })
  .openapi('SuggestedFilesResponse')

const TicketWithTaskCountSchema = z
  .object({
    ticket: TicketSchema,
    taskCount: z.number(),
    completedTaskCount: z.number()
  })
  .openapi('TicketWithTaskCount')

const TicketWithTaskCountListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketWithTaskCountSchema)
  })
  .openapi('TicketWithTaskCountListResponse')

const TicketWithTasksSchema = z
  .object({
    ticket: TicketSchema,
    tasks: z.array(TaskSchema)
  })
  .openapi('TicketWithTasks')

const TicketWithTasksListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TicketWithTasksSchema)
  })
  .openapi('TicketWithTasksListResponse')

const BulkTasksResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.record(z.string(), z.array(TaskSchema))
  })
  .openapi('BulkTasksResponse')

// Custom schema for completeTicket response
const CompleteTicketResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      ticket: TicketSchema,
      tasks: z.array(TicketTaskSchema)
    })
  })
  .openapi('CompleteTicketResponse')

const CreateTicketBodySchema = ticketsApiValidation.create.body.openapi('CreateTicketBody')
const UpdateTicketBodySchema = ticketsApiValidation.update.body.openapi('UpdateTicketBody')
const TicketIdParamsSchema = z
  .object({
    ticketId: z.string().openapi({
      param: { name: 'ticketId', in: 'path' },
      description: 'Ticket identifier'
    })
  })
  .openapi('TicketIdParams')

const ProjectIdParamsSchema = z
  .object({
    projectId: z.string().openapi({
      param: { name: 'projectId', in: 'path' },
      description: 'Project identifier'
    })
  })
  .openapi('ProjectIdParams')

const StatusQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .openapi({
        param: { name: 'status', in: 'query' },
        description: 'Filter tickets by status'
      })
  })
  .openapi('StatusQuery')

const LinkFilesBodySchema = ticketsApiValidation.linkFiles.body.openapi('LinkFilesBody')
const SuggestTasksBodySchema = ticketsApiValidation.suggestTasks.body.openapi('SuggestTasksBody')
const SuggestFilesBodySchema = ticketsApiValidation.suggestFiles.body.openapi('SuggestFilesBody')

const CreateTaskBodySchema = ticketsApiValidation.createTask.body.openapi('CreateTaskBody')
const UpdateTaskBodySchema = ticketsApiValidation.updateTask.body.openapi('UpdateTaskBody')
const TaskIdParamsSchema = z
  .object({
    taskId: z.string().openapi({
      param: { name: 'taskId', in: 'path' },
      description: 'Task identifier'
    })
  })
  .openapi('TaskIdParams')

const TicketTaskIdParamsSchema = z
  .object({
    ticketId: TicketIdParamsSchema.shape.ticketId,
    taskId: TaskIdParamsSchema.shape.taskId
  })
  .openapi('TicketTaskIdParams')

const ReorderTasksBodySchema = ticketsApiValidation.reorderTasks.body.openapi('ReorderTasksBody')
const BulkTasksQuerySchema = z
  .object({
    ids: z
      .string()
      .transform((str) => str.split(','))
      .openapi({
        param: { name: 'ids', in: 'query' },
        description: 'Comma-separated list of ticket IDs'
      })
  })
  .openapi('BulkTasksQuery')

const createTicketRoute = createRoute({
  method: 'post',
  path: '/api/tickets',
  tags: ['Tickets'],
  summary: 'Create a new ticket',
  request: {
    body: { content: { 'application/json': { schema: CreateTicketBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: TicketResponseSchema } },
      description: 'Ticket created successfully'
    },
    ...standardResponses
  }
})

const getTicketRoute = createRoute({
  method: 'get',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Get a ticket by ID',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(TicketResponseSchema)
})

const updateTicketRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Update a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateTicketBodySchema } } }
  },
  responses: createStandardResponses(TicketResponseSchema)
})

const completeTicketRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/complete',
  tags: ['Tickets'],
  summary: 'Complete a ticket and mark all tasks as done',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(CompleteTicketResponseSchema)
})

const deleteTicketRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}',
  tags: ['Tickets'],
  summary: 'Delete a ticket',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const linkFilesRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/link-files',
  tags: ['Tickets', 'Files'],
  summary: 'Link files to a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: LinkFilesBodySchema } } }
  },
  responses: createStandardResponses(LinkedFilesResponseSchema)
})

const suggestTasksRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/suggest-tasks',
  tags: ['Tickets', 'AI'],
  summary: 'Get AI suggestions for tasks',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: SuggestTasksBodySchema } } }
  },
  responses: createStandardResponses(SuggestedTasksResponseSchema)
})

const suggestFilesRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/suggest-files',
  tags: ['Tickets', 'Files', 'AI'],
  summary: 'Get AI suggestions for relevant files',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } }
  },
  responses: createStandardResponses(SuggestedFilesResponseSchema)
})

const listTicketsByProjectRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/tickets',
  tags: ['Projects', 'Tickets'],
  summary: 'List all tickets for a project',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    query: StatusQuerySchema
  },
  responses: createStandardResponses(TicketListResponseSchema)
})

const listTicketsWithCountRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/tickets-with-count',
  tags: ['Projects', 'Tickets'],
  summary: 'List tickets with task counts',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    query: StatusQuerySchema
  },
  responses: createStandardResponses(TicketWithTaskCountListResponseSchema)
})

const listTicketsWithTasksRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/tickets-with-tasks',
  tags: ['Projects', 'Tickets', 'Tasks'],
  summary: 'List tickets with their tasks',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    query: StatusQuerySchema
  },
  responses: createStandardResponses(TicketWithTasksListResponseSchema)
})

const createTaskRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Create a new task for a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: CreateTaskBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: TaskResponseSchema } },
      description: 'Task created successfully'
    },
    ...standardResponses
  }
})

const getTasksRoute = createRoute({
  method: 'get',
  path: '/api/tickets/{ticketId}/tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Get all tasks for a ticket',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(TaskListResponseSchema)
})

const updateTaskRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Update a task',
  request: {
    params: TicketTaskIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateTaskBodySchema } } }
  },
  responses: createStandardResponses(TaskResponseSchema)
})

const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{ticketId}/tasks/{taskId}',
  tags: ['Tickets', 'Tasks'],
  summary: 'Delete a task',
  request: {
    params: TicketTaskIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const reorderTasksRoute = createRoute({
  method: 'patch',
  path: '/api/tickets/{ticketId}/tasks/reorder',
  tags: ['Tickets', 'Tasks'],
  summary: 'Reorder tasks within a ticket',
  request: {
    params: TicketIdParamsSchema,
    body: { content: { 'application/json': { schema: ReorderTasksBodySchema } } }
  },
  responses: createStandardResponses(TaskListResponseSchema)
})

const autoGenerateTasksRoute = createRoute({
  method: 'post',
  path: '/api/tickets/{ticketId}/auto-generate-tasks',
  tags: ['Tickets', 'Tasks', 'AI'],
  summary: 'Auto-generate tasks from ticket overview',
  request: {
    params: TicketIdParamsSchema
  },
  responses: createStandardResponses(TaskListResponseSchema)
})

const getTasksForTicketsRoute = createRoute({
  method: 'get',
  path: '/api/tickets/bulk-tasks',
  tags: ['Tickets', 'Tasks'],
  summary: 'Get tasks for multiple tickets',
  request: {
    query: BulkTasksQuerySchema
  },
  responses: createStandardResponses(BulkTasksResponseSchema)
})

// Helper function to parse string ID to number using ErrorFactory
const parseNumericId = (id: string): number => {
  const parsed = parseInt(id, 10)
  if (isNaN(parsed)) {
    throw ErrorFactory.invalidParam('id', 'number', id)
  }
  return parsed
}

const formatTicketData = (ticket: any): z.infer<typeof TicketSchema> => {
  // The ticket data from service already matches the schema format
  // Just ensure all fields are present and valid
  return TicketSchema.parse(ticket)
}

const formatTaskData = (task: any): z.infer<typeof TaskSchema> => {
  // The task data from service already matches the schema format
  // Just ensure all fields are present and valid
  return TaskSchema.parse(task)
}

export const ticketRoutes = new OpenAPIHono()

  .openapi(createTicketRoute, async (c) => {
    const body = c.req.valid('json')

    return await withErrorContext(
      async () => {
        const ticket = await createTicket(body)
        const formattedTicket = formatTicketData(ticket)
        const payload: z.infer<typeof TicketResponseSchema> = { success: true, data: formattedTicket }
        return c.json(payload, 201)
      },
      {
        entity: 'Ticket',
        action: 'create',
        metadata: { title: body.title, projectId: body.projectId }
      }
    )
  })
  .openapi(getTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const numericTicketId = parseNumericId(ticketId)

    return await withErrorContext(
      async () => {
        const ticket = await getTicketById(numericTicketId)
        if (!ticket) {
          throw ErrorFactory.notFound('Ticket', numericTicketId)
        }
        const formattedTicket = formatTicketData(ticket)
        const payload: z.infer<typeof TicketResponseSchema> = { success: true, data: formattedTicket }
        return c.json(payload, 200)
      },
      {
        entity: 'Ticket',
        action: 'get',
        correlationId: ticketId
      }
    )
  })
  .openapi(updateTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedTicket = await updateTicket(parseNumericId(ticketId), body)
    const formattedTicket = formatTicketData(updatedTicket)
    const payload: z.infer<typeof TicketResponseSchema> = { success: true, data: formattedTicket }
    return c.json(payload, 200)
  })
  .openapi(completeTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const ticket = await completeTicket(parseNumericId(ticketId))
    const tasks = await getTasks(parseNumericId(ticketId))

    // Format the ticket and tasks
    const formattedTicket = formatTicketData(ticket)
    const formattedTasks = tasks.map(formatTaskData)

    const payload = {
      success: true as const,
      data: {
        ticket: formattedTicket,
        tasks: formattedTasks
      }
    }
    return c.json(payload, 200)
  })
  .openapi(deleteTicketRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    if (!deleteTicket) {
      throw ErrorFactory.operationFailed('service unavailable', 'deleteTicket function not available')
    }
    const deleted = await deleteTicket(parseNumericId(ticketId))
    if (!deleted) {
      throw ErrorFactory.operationFailed('delete ticket', `Ticket ID: ${ticketId}`)
    }
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Ticket deleted successfully'
    }
    return c.json(payload, 200)
  })

  .openapi(linkFilesRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { fileIds } = c.req.valid('json')
    // Convert string fileIds to numbers
    const numericFileIds = fileIds.map((id: string) => parseNumericId(id))
    const result = await linkFilesToTicket(parseNumericId(ticketId), numericFileIds)
    // Transform result to match expected schema format
    const linkedFiles = numericFileIds.map((fileId: number) => ({
      ticketId: ticketId,
      fileId: fileId.toString()
    }))
    const payload: z.infer<typeof LinkedFilesResponseSchema> = { success: true, data: linkedFiles }
    return c.json(payload, 200)
  })
  .openapi(suggestFilesRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { extraUserInput } = c.req.valid('json')
    const result = await suggestFilesForTicket(parseNumericId(ticketId))

    // Handle placeholder response from service
    const payload: z.infer<typeof SuggestedFilesResponseSchema> = {
      success: true,
      data: {
        recommendedFileIds: Array.isArray(result) ? result.map(String) : [],
        combinedSummaries: 'No summary available',
        message: 'File suggestions not implemented yet'
      }
    }
    return c.json(payload, 200)
  })

  .openapi(suggestTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { userContext } = c.req.valid('json')
    const tasks = await suggestTasksForTicket(parseNumericId(ticketId))
    const payload: z.infer<typeof SuggestedTasksResponseSchema> = { success: true, data: { suggestedTasks: tasks } }
    return c.json(payload, 200)
  })

  .openapi(listTicketsByProjectRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const tickets = await listTicketsByProject(projectId, query?.status as TicketStatus | undefined)
    const formattedTickets = tickets.map(formatTicketData)
    const payload: z.infer<typeof TicketListResponseSchema> = {
      success: true,
      data: formattedTickets
    }
    return c.json(payload, 200)
  })
  .openapi(listTicketsWithCountRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const statusFilter = query?.status === 'all' ? undefined : query?.status

    const results = await listTicketsWithTaskCount(projectId)

    const formatted: z.infer<typeof TicketWithTaskCountSchema>[] = results.map((item: any) => {
      const { taskCount, completedTaskCount, ...ticketData } = item
      return {
        ticket: formatTicketData(ticketData),
        taskCount: Number(taskCount || 0),
        completedTaskCount: Number(completedTaskCount || 0)
      }
    })

    const payload: z.infer<typeof TicketWithTaskCountListResponseSchema> = {
      success: true,
      data: formatted
    }
    return c.json(payload, 200)
  })
  .openapi(listTicketsWithTasksRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    const statusFilter = query?.status === 'all' ? undefined : query?.status

    const ticketsWithTasks = await listTicketsWithTasks(projectId)

    const formatted: z.infer<typeof TicketWithTasksSchema>[] = ticketsWithTasks.map((item: any) => ({
      ticket: formatTicketData(item),
      tasks: (item.tasks || []).map(formatTaskData)
    }))

    const payload: z.infer<typeof TicketWithTasksListResponseSchema> = {
      success: true,
      data: formatted
    }
    return c.json(payload, 200)
  })

  .openapi(createTaskRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    // Transform the body to match the expected task schema
    const taskData = {
      ticketId: parseNumericId(ticketId),
      content: body.content,
      description: body.description || null,
      suggestedFileIds: Array.isArray(body.suggestedFileIds) ? (body.suggestedFileIds as string[]) : [],
      suggestedPromptIds: Array.isArray(body.suggestedPromptIds) ? (body.suggestedPromptIds as number[]) : [],
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
      dependencies: Array.isArray(body.dependencies) ? (body.dependencies as number[]) : [],
      estimatedHours: body.estimatedHours || null,
      agentId: body.agentId || null
    }
    const task = await createTask(taskData)
    const formattedTask = formatTaskData(task)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, data: formattedTask }
    return c.json(payload, 201)
  })
  .openapi(getTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const tasks = await getTasks(parseNumericId(ticketId))
    const formattedTasks = tasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(updateTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param')
    const body = c.req.valid('json')
    // Transform the body to match the expected task update schema
    const updateData = {
      ...body,
      suggestedFileIds:
        body.suggestedFileIds && Array.isArray(body.suggestedFileIds) ? (body.suggestedFileIds as string[]) : undefined,
      suggestedPromptIds:
        body.suggestedPromptIds && Array.isArray(body.suggestedPromptIds)
          ? (body.suggestedPromptIds as number[])
          : undefined,
      tags: body.tags && Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
      dependencies: body.dependencies && Array.isArray(body.dependencies) ? (body.dependencies as number[]) : undefined
    }
    const updatedTask = await updateTask(parseNumericId(taskId), updateData)
    const formattedTask = formatTaskData(updatedTask)
    const payload: z.infer<typeof TaskResponseSchema> = { success: true, data: formattedTask }
    return c.json(payload, 200)
  })
  .openapi(deleteTaskRoute, async (c) => {
    const { ticketId, taskId } = c.req.valid('param')
    if (!deleteTask) {
      throw ErrorFactory.operationFailed('service unavailable', 'deleteTask function not available')
    }
    const deleted = await deleteTask(parseNumericId(taskId))
    if (!deleted) {
      throw ErrorFactory.operationFailed('delete task', `Task ID: ${taskId}`)
    }
    const payload: z.infer<typeof OperationSuccessResponseSchema> = {
      success: true,
      message: 'Task deleted successfully'
    }
    return c.json(payload, 200)
  })
  .openapi(reorderTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const { tasks } = c.req.valid('json')
    // Convert string taskIds to numbers in the tasks array
    const numericTasks = tasks.map((task: any) => ({
      taskId: parseNumericId(task.taskId.toString()),
      orderIndex: task.orderIndex
    }))
    await reorderTasks(parseNumericId(ticketId), numericTasks)
    // Get updated tasks after reorder
    const updatedTasks = await getTasks(parseNumericId(ticketId))
    const formattedTasks = updatedTasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(autoGenerateTasksRoute, async (c) => {
    const { ticketId } = c.req.valid('param')
    const newTasks = await autoGenerateTasksFromOverview(parseNumericId(ticketId), '')
    const formattedTasks = newTasks.map(formatTaskData)
    const payload: z.infer<typeof TaskListResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })
  .openapi(getTasksForTicketsRoute, async (c) => {
    const { ids } = c.req.valid('query')
    const numericIds = ids.map((id: string) => parseNumericId(id))
    const tasksByTicketId = await getTasksForTickets(numericIds)

    const formattedTasks: Record<string, z.infer<typeof TaskSchema>[]> = {}
    for (const [ticketId, tasks] of Object.entries(tasksByTicketId)) {
      formattedTasks[ticketId] = (tasks as any[]).map(formatTaskData)
    }

    const payload: z.infer<typeof BulkTasksResponseSchema> = { success: true, data: formattedTasks }
    return c.json(payload, 200)
  })

// Manual routes - basic CRUD operations
const getTicketByIdBasicRoute = createRoute({
  method: 'get',
  path: '/api/tickets/{id}',
  tags: ['Tickets'],
  summary: 'Get a ticket by ID (basic)',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({
        param: {
          name: 'id',
          in: 'path'
        },
        example: '1'
      })
    })
  },
  responses: createStandardResponses(TicketResponseSchema)
})

const updateTicketByIdBasicRoute = createRoute({
  method: 'put',
  path: '/api/tickets/{id}',
  tags: ['Tickets'],
  summary: 'Update a ticket by ID (basic)',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({
        param: {
          name: 'id',
          in: 'path'
        },
        example: '1'
      })
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTicketBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(TicketResponseSchema)
})

const deleteTicketByIdBasicRoute = createRoute({
  method: 'delete',
  path: '/api/tickets/{id}',
  tags: ['Tickets'],
  summary: 'Delete a ticket by ID (basic)',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({
        param: {
          name: 'id',
          in: 'path'
        },
        example: '1'
      })
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

ticketRoutes
  .openapi(getTicketByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const ticket = await getTicketById(id)

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND')
    }

    return c.json(successResponse(ticket), 200)
  })
  .openapi(updateTicketByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const ticket = await updateTicket(id, data)

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND')
    }

    return c.json(successResponse(ticket), 200)
  })
  .openapi(deleteTicketByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const success = await deleteTicket(id)

    if (!success) {
      throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND')
    }

    return c.json(operationSuccessResponse('Ticket deleted successfully'), 200)
  })

export type TicketRouteTypes = typeof ticketRoutes
// Local params schema matching path placeholder {projectId}
const ProjectIdParamsProjectIdSchema = z
  .object({
    projectId: z.coerce.number().int().positive().openapi({ param: { name: 'projectId', in: 'path' } })
  })
  .openapi('ProjectIdParamsProjectId')
