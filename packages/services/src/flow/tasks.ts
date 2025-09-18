import { withErrorContext } from '../core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import type { FlowRuntimeContext, FlowTask } from './types'
import type { CreateTaskInput, UpdateTaskInput } from './models'

export function createTaskModule(ctx: FlowRuntimeContext) {
  const { ticketRepo, logger, transformTask, transformTaskForCompat } = ctx

  return {
    async createTask(ticketId: number, data: CreateTaskInput) {
      return withErrorContext(
        async () => {
          const tasks = await ticketRepo.getTasksByTicket(ticketId)
          const maxOrder = Math.max(0, ...tasks.map((t: any) => t.orderIndex))

          const taskData = {
            ticketId,
            content: data.content,
            description: data.description ?? null,
            suggestedFileIds: data.suggestedFileIds ?? [],
            done: false,
            status: 'pending' as 'pending' | 'in_progress' | 'completed' | 'cancelled',
            orderIndex: maxOrder + 1,
            estimatedHours: data.estimatedHours ?? null,
            dependencies: data.dependencies ?? [],
            tags: data.tags ?? [],
            agentId: data.agentId ?? null,
            suggestedPromptIds: data.suggestedPromptIds ?? [],
            queueId: null,
            queueStatus: null,
            queuePosition: null,
            queuePriority: null,
            queuedAt: null,
            queueStartedAt: null,
            queueCompletedAt: null,
            queueAgentId: null,
            queueErrorMessage: null,
            estimatedProcessingTime: null,
            actualProcessingTime: null
          }

          const task = await ticketRepo.createTask(taskData as any)
          logger.info('Created task with queue initialization', { taskId: task.id, ticketId })
          return transformTask(task)
        },
        { entity: 'Task', action: 'create' }
      )
    },

    async updateTask(taskId: number, updates: UpdateTaskInput) {
      return withErrorContext(
        async () => {
          const task = await ticketRepo.getTaskById(taskId)
          if (!task) {
            throw ErrorFactory.notFound('Task', taskId)
          }

          const updatedTask = await ticketRepo.updateTask(taskId, {
            ...updates,
            updatedAt: Date.now()
          } as any)

          logger.info('Updated task', { taskId })
          return transformTask(updatedTask)
        },
        { entity: 'Task', action: 'update', id: taskId }
      )
    },

    async deleteTask(taskId: number) {
      return withErrorContext(
        async () => {
          const success = await ticketRepo.deleteTask(taskId)
          if (success) {
            logger.info('Deleted task', { taskId })
          }
          return success
        },
        { entity: 'Task', action: 'delete', id: taskId }
      )
    },

    async getTasks(ticketId: number) {
      return withErrorContext(
        async () => {
          const tasks = await ticketRepo.getTasksByTicket(ticketId)
          return tasks.sort((a: any, b: any) => a.orderIndex - b.orderIndex).map((task) => transformTask(task))
        },
        { entity: 'Task', action: 'list', id: ticketId }
      )
    },

    async reorderTasks(ticketId: number, order: Array<{ taskId: number; orderIndex: number }>) {
      return withErrorContext(
        async () => {
          const tasks = await ticketRepo.getTasksByTicket(ticketId)
          const updates: FlowTask[] = []

          for (const { taskId, orderIndex } of order) {
            const task = tasks.find((t: any) => t.id === taskId)
            if (!task) {
              throw ErrorFactory.notFound('Task', taskId)
            }
            if (task.orderIndex !== orderIndex) {
              const updated = await ticketRepo.updateTask(taskId, { orderIndex })
              updates.push(transformTask(updated))
            }
          }

          logger.info('Reordered tasks for ticket', { ticketId, count: order.length })
          return updates
        },
        { entity: 'Task', action: 'reorder', id: ticketId }
      )
    },

    async dequeueTask(taskId: number) {
      return withErrorContext(
        async () => {
          const task = await ticketRepo.updateTask(taskId, {
            queueId: null,
            queueStatus: null,
            queuePosition: null,
            queuePriority: null,
            queuedAt: null,
            queueStartedAt: null,
            queueCompletedAt: null,
            queueAgentId: null,
            queueErrorMessage: null
          })

          if (!task) {
            throw ErrorFactory.notFound('Task', taskId)
          }

          logger.info('Dequeued task', { taskId })
          return transformTaskForCompat(task)
        },
        { entity: 'Task', action: 'dequeue', id: taskId }
      )
    }
  }
}

export type TaskModule = ReturnType<typeof createTaskModule>
