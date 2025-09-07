import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  standardResponses,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'
import {
  TaskQueueSchema,
  QueueStatsSchema,
  QueueWithStatsSchema,
  CreateQueueBodySchema,
  UpdateQueueBodySchema,
  GetNextTaskResponseSchema,
  QueueItemSchema,
  BatchEnqueueBodySchema,
  QueueTimelineSchema,
  TicketSchema,
  TicketTaskSchema
} from '@promptliano/schemas'
import {
  createQueue,
  getQueueById,
  listQueuesByProject,
  updateQueue,
  deleteQueue,
  pauseQueue,
  resumeQueue,
  enqueueTicket,
  enqueueTask,
  enqueueTicketWithAllTasks,
  dequeueTicket,
  dequeueTask,
  getNextTaskFromQueue,
  getQueueStats,
  getQueuesWithStats,
  getUnqueuedItems,
  moveItemToQueue,
  completeQueueItem,
  failQueueItem,
  getQueueItems,
  batchEnqueueItems,
  getQueueTimeline
} from '@promptliano/services'
import type { Context } from 'hono'
// Ensure dequeue returns full Ticket data
import { dequeueTicket as flowDequeueTicket } from '@promptliano/services/src/flow-service'
import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'

const queueRoutesApp = new OpenAPIHono()

// Create queue
const createQueueRoute = createRoute({
  method: 'post',
  path: '/api/projects/:projectId/queues',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateQueueBodySchema.omit({ projectId: true })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

queueRoutesApp.openapi(createQueueRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const body = c.req.valid('json')

  const queue = await createQueue({
    ...body,
    projectId
  })

  return c.json(successResponse(queue), 200)
})

// List queues for project
const listQueuesRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/queues',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.array(TaskQueueSchema)
    })
  )
})

queueRoutesApp.openapi(listQueuesRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const queues = await listQueuesByProject(projectId)
  return c.json(successResponse(queues), 200)
})

// Get queue by ID
const getQueueRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

queueRoutesApp.openapi(getQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const queue = await getQueueById(queueId)
  return c.json(successResponse(queue), 200)
})

// Update queue
const updateQueueRoute = createRoute({
  method: 'patch',
  path: '/api/queues/:queueId',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateQueueBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

queueRoutesApp.openapi(updateQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const body = c.req.valid('json')
  const queue = await updateQueue(queueId, body)
  return c.json(successResponse(queue), 200)
})

// Delete queue
const deleteQueueRoute = createRoute({
  method: 'delete',
  path: '/api/queues/:queueId',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({ deleted: z.boolean() })
    })
  )
})

queueRoutesApp.openapi(deleteQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const deleted = await deleteQueue(queueId)
  return c.json(successResponse({ deleted }), 200)
})

// Enqueue ticket
const enqueueTicketRoute = createRoute({
  method: 'post',
  path: '/api/tickets/:ticketId/enqueue',
  request: {
    params: z.object({
      ticketId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.number(),
            priority: z.number().optional(),
            includeTasks: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TicketSchema
    })
  )
})

queueRoutesApp.openapi(enqueueTicketRoute, (async (c: any) => {
  const { ticketId } = c.req.valid('param')
  const { queueId, priority, includeTasks } = c.req.valid('json')

  if (includeTasks) {
    const tasksCount = await enqueueTicketWithAllTasks(ticketId, queueId, priority)
    // Since enqueueTicketWithAllTasks returns a number, we need to get the ticket separately
    const ticket = await enqueueTicket(ticketId, queueId, priority || 0)
    return c.json(successResponse(ticket), 200)
  } else {
    const ticket = await enqueueTicket(ticketId, queueId, priority || 0)
    return c.json(successResponse(ticket), 200)
  }
}) as any)

// Enqueue task
const enqueueTaskRoute = createRoute({
  method: 'post',
  path: '/api/tickets/:ticketId/tasks/:taskId/enqueue',
  request: {
    params: z.object({
      ticketId: z.coerce.number().int().positive(),
      taskId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            queueId: z.number(),
            priority: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TicketTaskSchema
    })
  )
})

queueRoutesApp.openapi(enqueueTaskRoute, (async (c: any) => {
  const { ticketId, taskId } = c.req.valid('param')
  const { queueId, priority } = c.req.valid('json')
  const task = await enqueueTask(taskId, queueId, priority || 0)
  return c.json(successResponse(task), 200)
}) as any)

// Dequeue ticket
const dequeueTicketRoute = createRoute({
  method: 'post',
  path: '/api/tickets/:ticketId/dequeue',
  request: {
    params: z.object({
      ticketId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TicketSchema
    })
  )
})

queueRoutesApp.openapi(dequeueTicketRoute, async (c) => {
  const { ticketId } = c.req.valid('param')
  const ticket = await flowDequeueTicket(ticketId)
  return c.json(successResponse(ticket), 200)
})

// Dequeue task
const dequeueTaskRoute = createRoute({
  method: 'post',
  path: '/api/tickets/:ticketId/tasks/:taskId/dequeue',
  request: {
    params: z.object({
      ticketId: z.coerce.number().int().positive(),
      taskId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TicketTaskSchema
    })
  )
})

queueRoutesApp.openapi(dequeueTaskRoute, (async (c: any) => {
  const { ticketId, taskId } = c.req.valid('param')
  const task = await dequeueTask(taskId)
  return c.json(successResponse(task), 200)
}) as any)

// Get queue statistics
const getQueueStatsRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId/stats',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: QueueStatsSchema
    })
  )
})

queueRoutesApp.openapi(getQueueStatsRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const result = await getQueueStats(queueId)
  const queue = (result as any).queue
  const items = (result as any).items || []
  const s = (result as any).stats || result
  const normalized = {
    queueId: queue?.id ?? queueId,
    queueName: queue?.name ?? 'Queue',
    totalItems: s.totalItems ?? items.length,
    queuedItems: s.queuedItems ?? items.filter((i: any) => i.status === 'queued').length,
    inProgressItems: s.inProgressItems ?? items.filter((i: any) => i.status === 'in_progress').length,
    completedItems: s.completedItems ?? items.filter((i: any) => i.status === 'completed').length,
    failedItems: s.failedItems ?? items.filter((i: any) => i.status === 'failed').length,
    cancelledItems: items.filter((i: any) => i.status === 'cancelled').length,
    averageProcessingTime: s.averageProcessingTime ?? null,
    currentAgents: s.currentAgents ?? [],
    ticketCount: s.ticketCount,
    taskCount: s.taskCount,
    uniqueTickets: s.uniqueTickets
  }
  return c.json(successResponse(normalized), 200)
})

// Get all queues with stats
const getQueuesWithStatsRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/queues-with-stats',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.array(QueueWithStatsSchema)
    })
  )
})

queueRoutesApp.openapi(getQueuesWithStatsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const result = await getQueuesWithStats(projectId)
  const normalized = (result as any[]).map((entry) => {
    const queue = entry.queue || entry
    const items = (entry as any).items || []
    const s = entry.stats || {}
    const stats = {
      queueId: queue?.id ?? 0,
      queueName: queue?.name ?? 'Queue',
      totalItems: s.totalItems ?? items.length ?? 0,
      queuedItems: s.queuedItems ?? items.filter((i: any) => i.status === 'queued').length ?? 0,
      inProgressItems: s.inProgressItems ?? items.filter((i: any) => i.status === 'in_progress').length ?? 0,
      completedItems: s.completedItems ?? items.filter((i: any) => i.status === 'completed').length ?? 0,
      failedItems: s.failedItems ?? items.filter((i: any) => i.status === 'failed').length ?? 0,
      cancelledItems: items.filter((i: any) => i.status === 'cancelled').length ?? 0,
      averageProcessingTime: s.averageProcessingTime ?? null,
      currentAgents: s.currentAgents ?? []
    }
    return { queue, stats }
  })
  return c.json(successResponse(normalized), 200)
})

// Get next task from queue
const getNextTaskRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/next-task',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            agentId: z.string().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: GetNextTaskResponseSchema
    })
  )
})

queueRoutesApp.openapi(getNextTaskRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { agentId } = c.req.valid('json')
  const nextTask = await getNextTaskFromQueue(queueId, agentId)
  return c.json(successResponse({ queueItem: nextTask, ticket: null, task: null }), 200)
})

// Get unqueued items
const getUnqueuedItemsRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/unqueued-items',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        tickets: z.array(TicketSchema),
        tasks: z.array(TicketTaskSchema)
      })
    })
  )
})

queueRoutesApp.openapi(getUnqueuedItemsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const unqueuedItems = await getUnqueuedItems(projectId)
  return c.json(successResponse(unqueuedItems), 200)
})

// Pause queue route
const pauseQueueRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/pause',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

queueRoutesApp.openapi(pauseQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const queue = await pauseQueue(queueId)
  return c.json(successResponse(queue), 200)
})

// Resume queue route
const resumeQueueRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/resume',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

queueRoutesApp.openapi(resumeQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const queue = await resumeQueue(queueId)
  return c.json(successResponse(queue), 200)
})

// Complete queue item
const completeQueueItemRoute = createRoute({
  method: 'post',
  path: '/api/queue/:itemType/:itemId/complete',
  request: {
    params: z.object({
      itemType: z.enum(['ticket', 'task']),
      itemId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ticketId: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({ completed: z.boolean() })
    })
  )
})

queueRoutesApp.openapi(completeQueueItemRoute, async (c) => {
  const { itemType, itemId } = c.req.valid('param')
  const { ticketId } = c.req.valid('json')
  await completeQueueItem(Number(itemId), { success: true, metadata: { ticketId } })
  return c.json(successResponse({ completed: true }), 200)
})

// Fail queue item
const failQueueItemRoute = createRoute({
  method: 'post',
  path: '/api/queue/:itemType/:itemId/fail',
  request: {
    params: z.object({
      itemType: z.enum(['ticket', 'task']),
      itemId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            errorMessage: z.string(),
            ticketId: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({ failed: z.boolean() })
    })
  )
})

queueRoutesApp.openapi(failQueueItemRoute, async (c) => {
  const { itemType, itemId } = c.req.valid('param')
  const { errorMessage, ticketId } = c.req.valid('json')
  await failQueueItem(Number(itemId), errorMessage, { retry: false })
  return c.json(successResponse({ failed: true }), 200)
})

// Move item to queue
const moveItemToQueueRoute = createRoute({
  method: 'post',
  path: '/api/queue/:itemType/:itemId/move',
  request: {
    params: z.object({
      itemType: z.enum(['ticket', 'task']),
      itemId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            targetQueueId: z.number().nullable(),
            ticketId: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({ moved: z.boolean() })
    })
  )
})

queueRoutesApp.openapi(moveItemToQueueRoute, async (c) => {
  const { itemType, itemId } = c.req.valid('param')
  const { targetQueueId, ticketId } = c.req.valid('json')
  await moveItemToQueue(itemType, itemId, targetQueueId, ticketId)
  return c.json(successResponse({ moved: true }), 200)
})

// === MISSING QUEUE-CENTRIC ROUTES ===

// Add ticket to queue (queue-centric endpoint)
const enqueueTicketToQueueRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/enqueue-ticket',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ticketId: z.number(),
            priority: z.number().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.array(QueueItemSchema)
    })
  )
})

queueRoutesApp.openapi(enqueueTicketToQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { ticketId, priority } = c.req.valid('json')

  // Use existing service function to enqueue the ticket
  await enqueueTicket(ticketId, queueId, priority || 0)

  // Return the queue items to show the result
  const queueItems = await getQueueItems(queueId)
  return c.json(successResponse(queueItems.map((item) => item.queueItem)), 200)
})

// Get queue items with enriched data
const getQueueItemsRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId/items',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    }),
    query: z.object({
      status: z.string().optional()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.array(
        z.object({
          queueItem: QueueItemSchema,
          ticket: z.any().optional(),
          task: z.any().optional()
        })
      )
    })
  )
})

queueRoutesApp.openapi(getQueueItemsRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { status } = c.req.valid('query')

  const queueItems = await getQueueItems(queueId, status)
  return c.json(successResponse(queueItems), 200)
})

// Add items to queue (generic enqueue endpoint)
const enqueueItemsRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/items',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              ticketId: z.number().optional(),
              taskId: z.number().optional(),
              priority: z.number().optional()
            })
            .refine(
              (data) => {
                return (data.ticketId && !data.taskId) || (!data.ticketId && data.taskId)
              },
              {
                message: 'Either ticketId or taskId must be provided, but not both'
              }
            )
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: QueueItemSchema
    })
  )
})

queueRoutesApp.openapi(enqueueItemsRoute, async (c) => {
  const params = c.req.valid('param')
  const { ticketId, taskId, priority } = c.req.valid('json')

  // Ensure queueId is valid
  const queueId = params.queueId
  if (!queueId || typeof queueId !== 'number') {
    throw new ApiError(400, 'Invalid queue ID', 'INVALID_QUEUE_ID')
  }

  if (ticketId) {
    await enqueueTicket(ticketId, queueId, priority ?? 0)
  } else if (taskId) {
    // Need the ticket ID for the existing service function
    // For now, throw an error - will need to enhance service layer
    throw new ApiError(400, 'Task enqueuing requires ticketId parameter', 'MISSING_TICKET_ID')
  }

  // Try to find the created queue item
  const items = await getQueueItems(queueId)
  const found = items.find((it) =>
    ticketId ? it.queueItem.itemType === 'ticket' && it.queueItem.itemId === ticketId : it.queueItem.itemType === 'task' && it.queueItem.itemId === taskId
  )
  if (found) {
    return c.json(successResponse(found.queueItem), 200)
  }
  const now = Date.now()
  return c.json(
    successResponse({
      id: 0,
      queueId,
      itemType: (ticketId ? 'ticket' : 'task') as 'ticket' | 'task',
      itemId: (ticketId || taskId) ?? 0,
      priority: priority || 0,
      status: 'queued' as 'queued',
      agentId: null,
      errorMessage: null,
      estimatedProcessingTime: null,
      actualProcessingTime: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    }),
    200
  )
})

// Batch enqueue items
const batchEnqueueRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/batch-enqueue',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: BatchEnqueueBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.array(QueueItemSchema)
    })
  )
})

queueRoutesApp.openapi(batchEnqueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { items } = c.req.valid('json')

  const results = await batchEnqueueItems(queueId, items)
  return c.json(successResponse(results), 200)
})

// Get queue timeline
const getQueueTimelineRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId/timeline',
  request: {
    params: z.object({
      queueId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: QueueTimelineSchema
    })
  )
})

queueRoutesApp.openapi(getQueueTimelineRoute, async (c) => {
  const { queueId } = c.req.valid('param')

  const timeline = await getQueueTimeline(queueId)
  return c.json(successResponse(timeline), 200)
})

// Manual routes - basic CRUD operations
const getQueueByIdBasicRoute = createRoute({
  method: 'get',
  path: '/api/queues/{id}',
  tags: ['Queues'],
  summary: 'Get a queue by ID (basic)',
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
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

const updateQueueByIdBasicRoute = createRoute({
  method: 'put',
  path: '/api/queues/{id}',
  tags: ['Queues'],
  summary: 'Update a queue by ID (basic)',
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
          schema: UpdateQueueBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: TaskQueueSchema
    })
  )
})

const deleteQueueByIdBasicRoute = createRoute({
  method: 'delete',
  path: '/api/queues/{id}',
  tags: ['Queues'],
  summary: 'Delete a queue by ID (basic)',
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
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({ deleted: z.boolean() })
    })
  )
})

queueRoutesApp
  .openapi(getQueueByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const queue = await getQueueById(id)

    if (!queue) {
      throw new ApiError(404, 'Queue not found', 'QUEUE_NOT_FOUND')
    }

    return c.json(successResponse(queue), 200)
  })
  .openapi(updateQueueByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const queue = await updateQueue(id, data)

    if (!queue) {
      throw new ApiError(404, 'Queue not found', 'QUEUE_NOT_FOUND')
    }

    return c.json(successResponse(queue), 200)
  })
  .openapi(deleteQueueByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const deleted = await deleteQueue(id)
    return c.json(successResponse({ deleted }), 200)
  })

export const queueRoutes = queueRoutesApp
export type QueueRouteTypes = typeof queueRoutes
