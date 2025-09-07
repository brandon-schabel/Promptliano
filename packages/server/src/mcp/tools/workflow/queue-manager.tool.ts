import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse
} from '../shared'
import {
  createQueue,
  getQueueById,
  listQueuesByProject,
  updateQueue,
  deleteQueue,
  getQueueStats,
  getQueuesWithStats,
  enqueueTicketWithAllTasks,
  enqueueTicket,
  enqueueTask,
  dequeueTicket,
  dequeueTask
} from '@promptliano/services'
import type { CreateQueueBody, UpdateQueueBody } from '@promptliano/schemas'
import type { Queue } from '@promptliano/database'
import { ApiError } from '@promptliano/shared'

// Define action types
export enum QueueManagerAction {
  CREATE_QUEUE = 'create_queue',
  LIST_QUEUES = 'list_queues',
  GET_QUEUE = 'get_queue',
  UPDATE_QUEUE = 'update_queue',
  DELETE_QUEUE = 'delete_queue',
  ENQUEUE_TICKET = 'enqueue_ticket',
  ENQUEUE_TASK = 'enqueue_task',
  ENQUEUE_TICKET_WITH_TASKS = 'enqueue_ticket_with_tasks',
  DEQUEUE_TICKET = 'dequeue_ticket',
  DEQUEUE_TASK = 'dequeue_task',
  GET_STATS = 'get_stats',
  GET_ALL_STATS = 'get_all_stats'
}

// Schema for the tool
export const QueueManagerSchema = z.object({
  action: z.nativeEnum(QueueManagerAction),
  projectId: z.number().optional(),
  queueId: z.number().optional(),
  data: z.any().optional()
})

export const queueManagerTool: MCPToolDefinition = {
  name: 'queue_manager',
  description:
    'Manage task queues for AI agent processing. Actions: create_queue, list_queues, get_queue, update_queue, delete_queue, enqueue_ticket, enqueue_task, enqueue_ticket_with_tasks, dequeue_ticket, dequeue_task, get_stats, get_all_stats',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(QueueManagerAction)
      },
      projectId: {
        type: 'number',
        description:
          'The project ID (required for: create_queue, list_queues, get_all_stats). Tip: use project_manager(list) to fetch a valid ID.'
      },
      queueId: {
        type: 'number',
        description: 'The queue ID (required for most actions except create/list)'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create_queue: { name: "Main Queue", description: "Primary processing queue", maxParallelItems: 3 }. For enqueue_ticket: { ticketId: 456, priority: 5 }. For enqueue_task: { ticketId: 123, taskId: 789, priority: 5 }. For enqueue_ticket_with_tasks: { ticketId: 456, priority: 5 }. For dequeue_ticket: { ticketId: 456 }. For dequeue_task: { ticketId: 123, taskId: 789 }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'queue_manager',
    async (args: z.infer<typeof QueueManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, queueId, data } = args

        switch (action) {
          case QueueManagerAction.CREATE_QUEUE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const name = validateDataField<string>(data, 'name', 'string', 'Main Queue')

            const createData: CreateQueueBody = {
              projectId: validProjectId,
              name,
              description: data?.description,
              maxParallelItems: data?.maxParallelItems
            }

            const queue = await createQueue(createData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue created successfully:
ID: ${queue.id}
Name: ${queue.name}
Description: ${queue.description}
Active: ${queue.isActive ? 'Yes' : 'No'}
Max Parallel Items: ${queue.maxParallelItems}`
                }
              ]
            }
          }

          case QueueManagerAction.LIST_QUEUES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const queues = await listQueuesByProject(validProjectId)

            if (queues.length === 0) {
              return {
                content: [{ type: 'text', text: 'No queues found for this project' }]
              }
            }

            const queueList = queues
              .map(
                (q: Queue) =>
                  `${q.id}: ${q.name} [${q.isActive ? 'Active' : 'Inactive'}] - ${q.description || 'No description'}`
              )
              .join('\n')

            return {
              content: [{ type: 'text', text: queueList }]
            }
          }

          case QueueManagerAction.GET_QUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const queue = await getQueueById(validQueueId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue Details:
ID: ${queue.id}
Name: ${queue.name}
Description: ${queue.description}
Active: ${queue.isActive ? 'Yes' : 'No'}
Max Parallel Items: ${queue.maxParallelItems}
Project ID: ${queue.projectId}
Created: ${new Date(queue.createdAt * 1000).toLocaleString()}
Updated: ${new Date(queue.updatedAt * 1000).toLocaleString()}`
                }
              ]
            }
          }

          case QueueManagerAction.UPDATE_QUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')

            const updateData: UpdateQueueBody = {
              name: data?.name,
              description: data?.description,
              status: data?.status,
              maxParallelItems: data?.maxParallelItems
            }

            const queue = await updateQueue(validQueueId, updateData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Queue ${queue.id} updated successfully`
                }
              ]
            }
          }

          case QueueManagerAction.DELETE_QUEUE: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            await deleteQueue(validQueueId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue ${validQueueId} deleted successfully`
                }
              ]
            }
          }

          case QueueManagerAction.ENQUEUE_TICKET: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const priority = data?.priority || 5

            const ticket = await enqueueTicket(ticketId, validQueueId, priority)
            return {
              content: [
                {
                  type: 'text',
                  text: `Ticket enqueued successfully:
Ticket ID: ${ticket.id}
Queue ID: ${ticket.queueId}
Status: ${ticket.queueStatus}
Priority: ${ticket.queuePriority}`
                }
              ]
            }
          }

          case QueueManagerAction.ENQUEUE_TASK: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '123')
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            const priority = data?.priority || 5

            const task = await enqueueTask(taskId, validQueueId, priority)
            return {
              content: [
                {
                  type: 'text',
                  text: `Task enqueued successfully:
Task ID: ${task.id}
Queue ID: ${task.queueId}
Status: ${task.queueStatus}
Priority: ${task.queuePriority}`
                }
              ]
            }
          }

          case QueueManagerAction.ENQUEUE_TICKET_WITH_TASKS: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const priority = data?.priority || 5

            const taskCount = await enqueueTicketWithAllTasks(ticketId, validQueueId, priority)
            return {
              content: [
                {
                  type: 'text',
                  text: `Enqueued ticket with ${taskCount} tasks to queue ${validQueueId}`
                }
              ]
            }
          }

          case QueueManagerAction.DEQUEUE_TICKET: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            await dequeueTicket(ticketId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Ticket ${ticketId} removed from queue`
                }
              ]
            }
          }

          case QueueManagerAction.DEQUEUE_TASK: {
            const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
            await dequeueTask(taskId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Task ${taskId} removed from queue`
                }
              ]
            }
          }

          case QueueManagerAction.GET_STATS: {
            const validQueueId = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const stats = await getQueueStats(validQueueId)

            return {
              content: [
                {
                  type: 'text',
                  text: `Queue Statistics for "${stats.queue.name}":
Total Items: ${stats.items.length}
Queued: ${stats.items.filter((item) => item.status === 'queued').length}
In Progress: ${stats.items.filter((item) => item.status === 'in_progress').length}
Completed: ${stats.items.filter((item) => item.status === 'completed').length}
Failed: ${stats.items.filter((item) => item.status === 'failed').length}
Cancelled: ${stats.items.filter((item) => item.status === 'cancelled').length}
Average Processing Time: N/A
Current Agents: ${
                    stats.items
                      .filter((item) => item.status === 'in_progress' && item.agentId)
                      .map((item) => item.agentId)
                      .join(', ') || 'None'
                  }`
                }
              ]
            }
          }

          case QueueManagerAction.GET_ALL_STATS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const allStats = await getQueuesWithStats(validProjectId)

            if (allStats.length === 0) {
              return {
                content: [{ type: 'text', text: 'No queues found for this project' }]
              }
            }

            const statsSummary = allStats
              .map(
                ({ queue, stats }: { queue: Queue; stats: any }) =>
                  `${queue.name} [${queue.isActive ? 'Active' : 'Inactive'}]:\n` +
                  `  Total: ${stats.totalItems} | Queued: ${stats.queuedItems} | ` +
                  `In Progress: ${stats.inProgressItems} | Completed: ${stats.completedItems}`
              )
              .join('\n\n')

            return {
              content: [
                {
                  type: 'text',
                  text: `All Queue Statistics:\n\n${statsSummary}`
                }
              ]
            }
          }

          default:
            throw new MCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`)
        }
      } catch (error) {
        if (error instanceof MCPError) {
          return formatMCPErrorResponse(error)
        }
        if (error instanceof ApiError) {
          return formatMCPErrorResponse(
            createMCPError(MCPErrorCode.SERVICE_ERROR, error.message, { details: error.details })
          )
        }
        return formatMCPErrorResponse(
          createMCPError(MCPErrorCode.SERVICE_ERROR, 'An unexpected error occurred', { error: String(error) })
        )
      }
    }
  )
}
