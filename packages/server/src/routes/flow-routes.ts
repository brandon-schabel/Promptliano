/**
 * Flow Routes - Unified ticket and queue management API
 *
 * Provides a unified interface for managing tickets, tasks, and queues
 * as a single flow system.
 */

import { OpenAPIHono, z, createRoute } from '@hono/zod-openapi'
import { flowService } from '@promptliano/services'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'
import {
  TicketSchema,
  TicketTaskSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  CreateTicketTaskSchema,
  UpdateTicketTaskSchema,
  QueueSchema,
  entityIdSchema
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'

const app = new OpenAPIHono()

// === Flow Data Schemas ===

const FlowItemSchema = z.object({
  id: z.string(),
  type: z.enum(['ticket', 'task']),
  title: z.string(),
  description: z.string().optional(),
  ticket: TicketSchema.openapi('Ticket').optional(),
  task: TicketTaskSchema.openapi('TicketTask').optional(),
  queueId: z.number().nullable().optional(),
  queuePosition: z.number().nullable().optional(),
  queueStatus: z.string().nullable().optional(),
  queuePriority: z.number().optional(),
  created: z.number(),
  updated: z.number()
}).openapi('FlowItem')

const FlowDataSchema = z.object({
  unqueued: z.object({
    tickets: z.array(TicketSchema.openapi('Ticket')),
    tasks: z.array(TicketTaskSchema.openapi('TicketTask'))
  }),
  queues: z.record(
    z.string(),
    z.object({
      queue: QueueSchema.openapi('Queue'),
      tickets: z.array(TicketSchema.openapi('Ticket')),
      tasks: z.array(TicketTaskSchema.openapi('TicketTask'))
    })
  )
}).openapi('FlowData')

// === Flow Data Endpoints ===

// Get complete flow data for a project
const getFlowDataRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/flow',
  request: {
    params: z.object({
      id: z.coerce.number()
    })
  },
  responses: createStandardResponses(FlowDataSchema),
  tags: ['Flow'],
  summary: 'Get complete flow data for a project'
})

app.openapi(getFlowDataRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const flowData = await flowService.getFlowData(projectId)
  return c.json(flowData)
})

// Get flow items as a flat list
const getFlowItemsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/flow/items',
  request: {
    params: z.object({
      id: z.coerce.number()
    })
  },
  responses: createStandardResponses(z.array(FlowItemSchema).openapi('FlowItemsList')),
  tags: ['Flow'],
  summary: 'Get all flow items as a flat list'
})

app.openapi(getFlowItemsRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const items = await flowService.getFlowItems(projectId)
  return c.json(items)
})

// Get unqueued items
const getUnqueuedItemsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/flow/unqueued',
  request: {
    params: z.object({
      id: z.coerce.number()
    })
  },
  responses: createStandardResponses(
    z.object({
      tickets: z.array(TicketSchema.openapi('Ticket')),
      tasks: z.array(TicketTaskSchema.openapi('TicketTask'))
    }).openapi('UnqueuedItems')
  ),
  tags: ['Flow'],
  summary: 'Get all unqueued tickets and tasks'
})

app.openapi(getUnqueuedItemsRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const items = await flowService.getUnqueuedItems(projectId)
  return c.json(items)
})

// === Queue Management (Flow-centric) ===

// Create a queue via Flow
const createQueueRoute = createRoute({
  method: 'post',
  path: '/api/flow/queues',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.coerce.number(),
            name: z.string().min(1),
            description: z.string().optional(),
            maxParallelItems: z.number().min(1).max(10).optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.any()
    })
  ),
  tags: ['Flow'],
  summary: 'Create a queue (Flow)'
})

app.openapi(createQueueRoute, async (c) => {
  const body = c.req.valid('json')
  const queue = await flowService.createQueue(body)
  return c.json(successResponse(queue))
})

// List queues for project via Flow
const listQueuesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/flow/queues',
  request: { params: z.object({ id: z.coerce.number() }) },
  responses: createStandardResponses(z.array(z.any())),
  tags: ['Flow'],
  summary: 'List queues for a project (Flow)'
})

app.openapi(listQueuesRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const queues = await flowService.listQueues(projectId)
  return c.json(successResponse(queues))
})

// Queues with stats via Flow
const queuesWithStatsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/flow/queues-with-stats',
  request: { params: z.object({ id: z.coerce.number() }) },
  responses: createStandardResponses(z.array(z.any())),
  tags: ['Flow'],
  summary: 'Get queues with stats (Flow)'
})

app.openapi(queuesWithStatsRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const data = await flowService.getQueuesWithStats(projectId)
  return c.json(successResponse(data))
})

// Queue items for a specific queue (Flow)
const getQueueItemsRoute = createRoute({
  method: 'get',
  path: '/api/flow/queues/{queueId}/items',
  request: {
    params: z.object({ queueId: z.coerce.number() }),
    query: z.object({ status: z.string().optional() })
  },
  responses: createStandardResponses(
    z.object({
      tickets: z.array(TicketSchema.openapi('Ticket')),
      tasks: z.array(TicketTaskSchema.openapi('TicketTask'))
    }).openapi('QueueItems')
  ),
  tags: ['Flow'],
  summary: 'Get items in a queue (Flow)'
})

app.openapi(getQueueItemsRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { status } = c.req.valid('query')
  const items = await flowService.getQueueItems(queueId)
  if (!status) return c.json(items)
  const normalize = (s: any) => (s ? String(s).toLowerCase() : s)
  return c.json({
    tickets: items.tickets.filter((t: any) => normalize(t.queueStatus) === normalize(status)),
    tasks: items.tasks.filter((t: any) => normalize(t.queueStatus) === normalize(status))
  })
})

// Queue stats for a specific queue (Flow)
const getQueueStatsRoute = createRoute({
  method: 'get',
  path: '/api/flow/queues/{queueId}/stats',
  request: { params: z.object({ queueId: z.coerce.number() }) },
  responses: createStandardResponses(
    z.object({
      totalItems: z.number(),
      queuedItems: z.number(),
      inProgressItems: z.number(),
      completedItems: z.number(),
      failedItems: z.number(),
      currentAgents: z.array(z.string())
    })
  ),
  tags: ['Flow'],
  summary: 'Get queue statistics (Flow)'
})

app.openapi(getQueueStatsRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const items = await flowService.getQueueItems(queueId)
  const toPairs = [
    ...items.tickets.map((t: any) => ({ status: t.queueStatus, agentId: t.queueAgentId })),
    ...items.tasks.map((t: any) => ({ status: t.queueStatus, agentId: t.queueAgentId }))
  ]
  const stats = {
    totalItems: toPairs.length,
    queuedItems: toPairs.filter((i) => i.status === 'queued').length,
    inProgressItems: toPairs.filter((i) => i.status === 'in_progress').length,
    completedItems: toPairs.filter((i) => i.status === 'completed').length,
    failedItems: toPairs.filter((i) => i.status === 'failed').length,
    currentAgents: Array.from(new Set(toPairs.filter(i => i.status === 'in_progress' && i.agentId).map(i => i.agentId)))
  }
  return c.json(successResponse(stats))
})

// Update queue (Flow)
const updateQueueRoute = createRoute({
  method: 'patch',
  path: '/api/flow/queues/{queueId}',
  request: {
    params: z.object({ queueId: z.coerce.number() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            maxParallelItems: z.number().min(1).max(10).optional(),
            isActive: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.any()),
  tags: ['Flow'],
  summary: 'Update queue (Flow)'
})

app.openapi(updateQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const body = c.req.valid('json')
  const updated = await flowService.updateQueue(queueId, body)
  return c.json(successResponse(updated))
})

// Delete queue (Flow)
const deleteQueueRoute = createRoute({
  method: 'delete',
  path: '/api/flow/queues/{queueId}',
  request: { params: z.object({ queueId: z.coerce.number() }) },
  responses: createStandardResponses(z.object({ deleted: z.boolean() })),
  tags: ['Flow'],
  summary: 'Delete queue (Flow)'
})

app.openapi(deleteQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const success = await flowService.deleteQueue(queueId)
  return c.json(successResponse({ deleted: !!success }))
})

// === Queue Operations ===

// Enqueue a ticket
const enqueueTicketRoute = createRoute({
  method: 'post',
  path: '/api/flow/tickets/{ticketId}/enqueue',
  request: {
    params: z.object({
      ticketId: z.coerce.number()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.coerce.number(),
            priority: z.number().default(0),
            includeTasks: z.boolean().default(false)
          })
        }
      }
    }
  },
  responses: createStandardResponses(TicketSchema.openapi('Ticket')),
  tags: ['Flow'],
  summary: 'Enqueue a ticket to a queue'
})

app.openapi(enqueueTicketRoute, async (c) => {
  const { ticketId } = c.req.valid('param')
  const { queueId, priority, includeTasks } = c.req.valid('json')

  if (includeTasks) {
    await flowService.enqueueTicketWithTasks(ticketId, queueId, priority)
    const ticket = await flowService.getTicketById(ticketId)
    return c.json(ticket)
  } else {
    const ticket = await flowService.enqueueTicket(ticketId, queueId, priority)
    return c.json(ticket)
  }
})

// Enqueue a task
const enqueueTaskRoute = createRoute({
  method: 'post',
  path: '/api/flow/tasks/{taskId}/enqueue',
  request: {
    params: z.object({
      taskId: z.coerce.number()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.coerce.number(),
            priority: z.number().default(0)
          })
        }
      }
    }
  },
  responses: createStandardResponses(TicketTaskSchema.openapi('TicketTask')),
  tags: ['Flow'],
  summary: 'Enqueue a task to a queue'
})

app.openapi(enqueueTaskRoute, async (c) => {
  const { taskId } = c.req.valid('param')
  const { queueId, priority } = c.req.valid('json')

  const task = await flowService.enqueueTask(taskId, queueId, priority)
  return c.json(task)
})

// Dequeue a ticket
const dequeueTicketRoute = createRoute({
  method: 'post',
  path: '/api/flow/tickets/{ticketId}/dequeue',
  request: {
    params: z.object({
      ticketId: z.coerce.number()
    }),
    query: z.object({
      includeTasks: z
        .string()
        .optional()
        .transform((val) => val === 'true')
    })
  },
  responses: createStandardResponses(TicketSchema.openapi('Ticket')),
  tags: ['Flow'],
  summary: 'Remove a ticket from its queue'
})

app.openapi(dequeueTicketRoute, async (c) => {
  const { ticketId } = c.req.valid('param')
  const { includeTasks = false } = c.req.valid('query')

  if (includeTasks) {
    const ticket = await flowService.dequeueTicketWithTasks(ticketId)
    return c.json(ticket)
  } else {
    const ticket = await flowService.dequeueTicket(ticketId)
    return c.json(ticket)
  }
})

// Dequeue a task
const dequeueTaskRoute = createRoute({
  method: 'post',
  path: '/api/flow/tasks/{taskId}/dequeue',
  request: {
    params: z.object({
      taskId: z.coerce.number()
    })
  },
  responses: createStandardResponses(TicketTaskSchema.openapi('TicketTask')),
  tags: ['Flow'],
  summary: 'Remove a task from its queue'
})

app.openapi(dequeueTaskRoute, async (c) => {
  const { taskId } = c.req.valid('param')
  const task = await flowService.dequeueTask(taskId)
  return c.json(task)
})

// Move an item between queues or to unqueued
const moveItemRoute = createRoute({
  method: 'post',
  path: '/api/flow/move',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            targetQueueId: z.coerce.number().nullable(),
            priority: z.number().default(0),
            includeTasks: z.boolean().default(false)
          })
        }
      }
    }
  },
  responses: createStandardResponses(FlowItemSchema),
  tags: ['Flow'],
  summary: 'Move an item between queues or to unqueued'
})

app.openapi(moveItemRoute, async (c) => {
  const { itemType, itemId, targetQueueId, priority, includeTasks } = c.req.valid('json')
  const item = await flowService.moveItem(itemType, itemId, targetQueueId, priority, includeTasks)
  return c.json(item)
})

// Reorder items within a queue
const reorderRoute = createRoute({
  method: 'post',
  path: '/api/flow/reorder',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.coerce.number(),
            items: z.array(
              z.object({
                itemType: z.enum(['ticket', 'task']),
                itemId: z.coerce.number(),
                ticketId: z.coerce.number().optional()
              })
            )
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Persist new order for items in a queue'
})

app.openapi(reorderRoute, async (c) => {
  const { queueId, items } = c.req.valid('json')
  await flowService.reorderWithinQueue(queueId, items)
  return c.json({ success: true })
})

// === Processing Operations ===

// Start processing an item
const startProcessingRoute = createRoute({
  method: 'post',
  path: '/api/flow/process/start',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            agentId: z.string()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Mark an item as being processed'
})

app.openapi(startProcessingRoute, async (c) => {
  const { itemType, itemId, agentId } = c.req.valid('json')
  await flowService.startProcessingItem(itemType, itemId, agentId)
  return c.json({ success: true })
})

// Complete processing an item
const completeProcessingRoute = createRoute({
  method: 'post',
  path: '/api/flow/process/complete',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            processingTime: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Mark an item as completed'
})

app.openapi(completeProcessingRoute, async (c) => {
  const { itemType, itemId, processingTime } = c.req.valid('json')
  await flowService.completeProcessingItem(itemType, itemId, processingTime)
  return c.json({ success: true })
})

// Fail processing an item
const failProcessingRoute = createRoute({
  method: 'post',
  path: '/api/flow/process/fail',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            itemType: z.enum(['ticket', 'task']),
            itemId: z.coerce.number(),
            errorMessage: z.string()
          })
        }
      }
    }
  },
  responses: createStandardResponses(z.object({ success: z.boolean() })),
  tags: ['Flow'],
  summary: 'Mark an item as failed'
})

app.openapi(failProcessingRoute, async (c) => {
  const { itemType, itemId, errorMessage } = c.req.valid('json')
  await flowService.failProcessingItem(itemType, itemId, errorMessage)
  return c.json({ success: true })
})

// === Batch Operations ===

// Bulk move items
const bulkMoveRoute = createRoute({
  method: 'post',
  path: '/api/flow/bulk-move',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(
              z.object({
                itemType: z.enum(['ticket', 'task']),
                itemId: z.coerce.number()
              })
            ),
            targetQueueId: z.coerce.number().nullable(),
            priority: z.number().default(0)
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.boolean(),
      movedCount: z.number()
    })
  ),
  tags: ['Flow'],
  summary: 'Move multiple items to a queue or unqueued'
})

app.openapi(bulkMoveRoute, async (c) => {
  const { items, targetQueueId, priority } = c.req.valid('json')

  let movedCount = 0
  for (const item of items) {
    try {
      await flowService.moveItem(item.itemType, item.itemId, targetQueueId, priority)
      movedCount++
    } catch (error) {
      console.error(`Failed to move ${item.itemType} ${item.itemId}:`, error)
    }
  }

  return c.json({ success: true, movedCount })
})

// Export the app
export const flowRoutes = app
