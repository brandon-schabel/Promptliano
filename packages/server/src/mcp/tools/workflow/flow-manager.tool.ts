import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  MCPError,
  MCPErrorCode,
  createMCPError,
  formatMCPErrorResponse
} from '../shared'
import {
  listTicketsByProject,
  createTicket,
  getTicketById,
  updateTicket,
  deleteTicket,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  createQueue,
  listQueues,
  getQueueById,
  updateQueue,
  deleteQueue,
  getQueueWithStats,
  getQueuesWithStats,
  getQueueEntries,
  enqueueTicket,
  enqueueTask,
  enqueueTicketWithTasks,
  dequeueTicket,
  dequeueTask,
  getNextQueueItem,
  completeQueueItem,
  failQueueItem
} from '@promptliano/services/src/flow/core'

export enum FlowManagerAction {
  // Tickets
  TICKETS_LIST = 'tickets_list',
  TICKETS_GET = 'tickets_get',
  TICKETS_CREATE = 'tickets_create',
  TICKETS_UPDATE = 'tickets_update',
  TICKETS_DELETE = 'tickets_delete',

  // Tasks
  TASKS_LIST_BY_TICKET = 'tasks_list_by_ticket',
  TASKS_CREATE = 'tasks_create',
  TASKS_UPDATE = 'tasks_update',
  TASKS_DELETE = 'tasks_delete',
  TASKS_REORDER = 'tasks_reorder',

  // Queues (CRUD + stats)
  QUEUES_CREATE = 'queues_create',
  QUEUES_LIST = 'queues_list',
  QUEUES_GET = 'queues_get',
  QUEUES_UPDATE = 'queues_update',
  QUEUES_DELETE = 'queues_delete',
  QUEUES_GET_STATS = 'queues_get_stats',
  QUEUES_GET_ALL_STATS = 'queues_get_all_stats',

  // Queue operations
  ENQUEUE_TICKET = 'enqueue_ticket',
  ENQUEUE_TASK = 'enqueue_task',
  DEQUEUE_TICKET = 'dequeue_ticket',
  DEQUEUE_TASK = 'dequeue_task',

  // Processor
  PROCESSOR_GET_NEXT = 'processor_get_next',
  PROCESSOR_COMPLETE = 'processor_complete',
  PROCESSOR_FAIL = 'processor_fail'
}

const FlowManagerSchema = z.object({
  action: z.nativeEnum(FlowManagerAction),
  projectId: z.number().optional(),
  ticketId: z.number().optional(),
  taskId: z.number().optional(),
  queueId: z.number().optional(),
  data: z.any().optional()
})

export const flowManagerTool: MCPToolDefinition = {
  name: 'flow_manager',
  description:
    'Unified flow operations for tickets, tasks, and queues. Groups: tickets_*, tasks_*, queues_* (CRUD + stats), queue ops, and processor actions.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform (e.g., tickets_list, tasks_create, queues_get_stats, processor_get_next)',
        enum: [
          'tickets_list',
          'tickets_get',
          'tickets_create',
          'tickets_update',
          'tickets_delete',
          'tasks_list_by_ticket',
          'tasks_create',
          'tasks_update',
          'tasks_delete',
          'tasks_reorder',
          'queues_create',
          'queues_list',
          'queues_get',
          'queues_update',
          'queues_delete',
          'queues_get_stats',
          'queues_get_all_stats',
          'enqueue_ticket',
          'enqueue_task',
          'dequeue_ticket',
          'dequeue_task',
          'processor_get_next',
          'processor_complete',
          'processor_fail'
        ]
      },
      projectId: { type: 'number', description: 'Project ID for project-scoped actions' },
      ticketId: { type: 'number', description: 'Ticket ID for task or ticket-specific actions' },
      taskId: { type: 'number', description: 'Task ID for task-specific actions' },
      queueId: { type: 'number', description: 'Queue ID for queue actions' },
      data: { type: 'object', description: 'Action-specific data payload', additionalProperties: true }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'flow_manager',
    async (args: z.infer<typeof FlowManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, ticketId, taskId, queueId, data } = args

        switch (action) {
          // ------------------- Tickets -------------------
          case FlowManagerAction.TICKETS_LIST: {
            const pid = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const tickets = await listTicketsByProject(pid)
            return { content: [{ type: 'text', text: JSON.stringify({ tickets }, null, 2) }] }
          }
          case FlowManagerAction.TICKETS_GET: {
            const tid = validateRequiredParam(ticketId, 'ticketId', 'number', '123')
            const ticket = await getTicketById(tid)
            return { content: [{ type: 'text', text: JSON.stringify({ ticket }, null, 2) }] }
          }
          case FlowManagerAction.TICKETS_CREATE: {
            const pid = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const title = validateDataField<string>(data, 'title', 'string', '"Add login"')
            const ticket = await createTicket({
              projectId: pid,
              title,
              overview: data?.overview,
              priority: data?.priority
            })
            return { content: [{ type: 'text', text: JSON.stringify({ ticket }, null, 2) }] }
          }
          case FlowManagerAction.TICKETS_UPDATE: {
            const tid = validateRequiredParam(ticketId, 'ticketId', 'number', '123')
            const ticket = await updateTicket(tid, data || {})
            return { content: [{ type: 'text', text: JSON.stringify({ ticket }, null, 2) }] }
          }
          case FlowManagerAction.TICKETS_DELETE: {
            const tid = validateRequiredParam(ticketId, 'ticketId', 'number', '123')
            const ok = await deleteTicket(tid)
            return { content: [{ type: 'text', text: ok ? `Deleted ticket ${tid}` : `Ticket ${tid} not found` }] }
          }

          // ------------------- Tasks -------------------
          case FlowManagerAction.TASKS_LIST_BY_TICKET: {
            const tid = validateRequiredParam(ticketId, 'ticketId', 'number', '123')
            const tasks = await getTasks(tid)
            return { content: [{ type: 'text', text: JSON.stringify({ tasks }, null, 2) }] }
          }
          case FlowManagerAction.TASKS_CREATE: {
            const tid = validateRequiredParam(ticketId, 'ticketId', 'number', '123')
            const content = validateDataField<string>(data, 'content', 'string', '"Implement login form"')
            const task = await createTask(tid, {
              content,
              description: data?.description,
              status: data?.status
            })
            return { content: [{ type: 'text', text: JSON.stringify({ task }, null, 2) }] }
          }
          case FlowManagerAction.TASKS_UPDATE: {
            const tskId = validateRequiredParam(taskId, 'taskId', 'number', '456')
            const task = await updateTask(tskId, data || {})
            return { content: [{ type: 'text', text: JSON.stringify({ task }, null, 2) }] }
          }
          case FlowManagerAction.TASKS_DELETE: {
            const tskId = validateRequiredParam(taskId, 'taskId', 'number', '456')
            const ok = await deleteTask(tskId)
            return { content: [{ type: 'text', text: ok ? `Deleted task ${tskId}` : `Task ${tskId} not found` }] }
          }
          case FlowManagerAction.TASKS_REORDER: {
            const tid = validateRequiredParam(ticketId, 'ticketId', 'number', '123')
            const orders = validateDataField<Array<{ taskId: number; orderIndex: number }>>(
              data,
              'orders',
              'array',
              '[{ "taskId": 1, "orderIndex": 1 }]'
            )
            await reorderTasks(tid, orders)
            return { content: [{ type: 'text', text: `Reordered ${orders.length} tasks for ticket ${tid}` }] }
          }

          // ------------------- Queues -------------------
          case FlowManagerAction.QUEUES_CREATE: {
            const pid = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const name = validateDataField<string>(data, 'name', 'string', '"Main Queue"')
            const queue = await createQueue({
              projectId: pid,
              name,
              description: data?.description,
              maxParallelItems: data?.maxParallelItems
            })
            return { content: [{ type: 'text', text: JSON.stringify({ queue }, null, 2) }] }
          }
          case FlowManagerAction.QUEUES_LIST: {
            const pid = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const queues = await listQueues(pid)
            return { content: [{ type: 'text', text: JSON.stringify({ queues }, null, 2) }] }
          }
          case FlowManagerAction.QUEUES_GET: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const queue = await getQueueById(qid)
            return { content: [{ type: 'text', text: JSON.stringify({ queue }, null, 2) }] }
          }
          case FlowManagerAction.QUEUES_UPDATE: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const queue = await updateQueue(qid, data || {})
            return { content: [{ type: 'text', text: JSON.stringify({ queue }, null, 2) }] }
          }
          case FlowManagerAction.QUEUES_DELETE: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const ok = await deleteQueue(qid)
            return { content: [{ type: 'text', text: ok ? `Deleted queue ${qid}` : `Queue ${qid} not found` }] }
          }
          case FlowManagerAction.QUEUES_GET_STATS: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const detail = await getQueueWithStats(qid)
            return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] }
          }
          case FlowManagerAction.QUEUES_GET_ALL_STATS: {
            const pid = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const allStats = await getQueuesWithStats(pid)
            return { content: [{ type: 'text', text: JSON.stringify(allStats, null, 2) }] }
          }

          // ------------------- Queue Ops -------------------
          case FlowManagerAction.ENQUEUE_TICKET: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const tid = validateDataField<number>(data, 'ticketId', 'number', '123')
            const priority = (data?.priority as number | undefined) ?? 5
            if (data?.includeTasks) {
              await enqueueTicketWithTasks(tid, qid, priority)
              const ticket = await getTicketById(tid)
              return { content: [{ type: 'text', text: JSON.stringify({ ticket }, null, 2) }] }
            }

            const ticket = await enqueueTicket(tid, qid, priority)
            return { content: [{ type: 'text', text: JSON.stringify({ ticket }, null, 2) }] }
          }
          case FlowManagerAction.ENQUEUE_TASK: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const tskId = validateDataField<number>(data, 'taskId', 'number', '456')
            const priority = (data?.priority as number | undefined) ?? 5
            const task = await enqueueTask(tskId, qid, priority)
            return { content: [{ type: 'text', text: JSON.stringify({ task }, null, 2) }] }
          }
          case FlowManagerAction.DEQUEUE_TICKET: {
            const tid = validateRequiredParam(
              ticketId ?? (data?.ticketId as number | undefined),
              'ticketId',
              'number',
              '123'
            )
            const ticket = await dequeueTicket(tid)
            return { content: [{ type: 'text', text: JSON.stringify({ ticket }, null, 2) }] }
          }
          case FlowManagerAction.DEQUEUE_TASK: {
            const tskId = validateRequiredParam(
              taskId ?? (data?.taskId as number | undefined),
              'taskId',
              'number',
              '456'
            )
            const task = await dequeueTask(tskId)
            return { content: [{ type: 'text', text: JSON.stringify({ task }, null, 2) }] }
          }

          // ------------------- Processor -------------------
          case FlowManagerAction.PROCESSOR_GET_NEXT: {
            const qid = validateRequiredParam(queueId, 'queueId', 'number', '1')
            const agentId = (data?.agentId as string) || 'mcp-agent'
            const item = await getNextQueueItem(qid, agentId)
            if (!item) return { content: [{ type: 'text', text: 'No items available' }] }
            const entries = await getQueueEntries(qid)
            const entry = entries.find((candidate) => candidate.queueItem.id === item.id)
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ queueItem: item, ticket: entry?.ticket, task: entry?.task }, null, 2)
                }
              ]
            }
          }
          case FlowManagerAction.PROCESSOR_COMPLETE: {
            const queueItemId = validateDataField<number>(data, 'queueItemId', 'number', '1001')
            const result = validateDataField<{ success: boolean }>(data, 'result', 'object', '{ "success": true }')
            const item = await completeQueueItem(queueItemId, result)
            return { content: [{ type: 'text', text: JSON.stringify({ item }, null, 2) }] }
          }
          case FlowManagerAction.PROCESSOR_FAIL: {
            const queueItemId = validateDataField<number>(data, 'queueItemId', 'number', '1001')
            const error = validateDataField<string>(data, 'error', 'string', '"Validation failed"')
            const item = await failQueueItem(queueItemId, error)
            return { content: [{ type: 'text', text: JSON.stringify({ item }, null, 2) }] }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(FlowManagerAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, { tool: 'flow_manager', action: (args as any).action })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}
