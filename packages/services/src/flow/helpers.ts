import { nullToUndefined } from '../utils/file-utils'
import type { FlowRuntimeContext, FlowItem } from './types'
import type { TicketWithTasks } from './models'

export function createHelperModule(ctx: FlowRuntimeContext) {
  const { ticketRepo, transformTicket, transformTask } = ctx

  return {
    async getTicketsWithTasks(projectId: number): Promise<TicketWithTasks[]> {
      const tickets = await ticketRepo.getByProject(projectId)
      const results = await Promise.all(
        tickets.map(async (ticket) => ({
          ticket: transformTicket(ticket),
          tasks: (await ticketRepo.getTasksByTicket(ticket.id)).map((task) => transformTask(task))
        }))
      )

      return results.map(({ ticket, tasks }) => ({
        ...ticket,
        tasks
      }))
    },

    ticketToFlowItem(ticket: Parameters<typeof transformTicket>[0] extends never ? never : any): FlowItem {
      const normalized = typeof ticket === 'object' && ticket?.id ? ticket : transformTicket(ticket)
      return {
        id: `ticket-${normalized.id}`,
        type: 'ticket',
        title: normalized.title,
        description: nullToUndefined(normalized.overview),
        ticket: normalized,
        queueId: nullToUndefined(normalized.queueId),
        queuePosition: nullToUndefined(normalized.queuePosition),
        queueStatus: nullToUndefined(normalized.queueStatus),
        queuePriority: nullToUndefined(normalized.queuePriority),
        created: normalized.createdAt,
        updated: normalized.updatedAt
      }
    },

    taskToFlowItem(task: Parameters<typeof transformTask>[0] extends never ? never : any): FlowItem {
      const normalized = typeof task === 'object' && task?.id ? task : transformTask(task)
      return {
        id: `task-${normalized.id}`,
        type: 'task',
        title: normalized.content,
        description: normalized.description ?? undefined,
        task: normalized,
        queueId: normalized.queueId ?? null,
        queuePosition: normalized.queuePosition ?? null,
        queueStatus: normalized.queueStatus ?? null,
        queuePriority: normalized.queuePriority ?? undefined,
        created: normalized.createdAt,
        updated: normalized.updatedAt
      }
    }
  }
}

export type HelperModule = ReturnType<typeof createHelperModule>
