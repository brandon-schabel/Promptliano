import { withErrorContext } from '../core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { QueueStateMachine } from '../queue-state-machine'
import type { FlowRuntimeContext } from './types'

export function createProcessorModule(ctx: FlowRuntimeContext) {
  const { ticketRepo, logger } = ctx

  return {
    async startProcessingItem(itemType: 'ticket' | 'task', itemId: number, agentId: string) {
      return withErrorContext(
        async () => {
          if (itemType === 'ticket') {
            const ticket = await ticketRepo.getById(itemId)
            if (!ticket) throw ErrorFactory.notFound('Ticket', itemId)

            try {
              const updated = QueueStateMachine.transition(ticket, 'in_progress', { agentId })
              await ticketRepo.update(itemId, {
                queueStatus: updated.queueStatus,
                queueAgentId: updated.queueAgentId,
                queueStartedAt: updated.queueStartedAt,
                updatedAt: Date.now()
              })
              logger.info('Started processing ticket', { ticketId: itemId, agentId })
            } catch (error: any) {
              throw ErrorFactory.invalidState('Ticket', error.message, 'start processing')
            }
          } else {
            const task = await ticketRepo.getTaskById(itemId)
            if (!task) throw ErrorFactory.notFound('Task', itemId)

            try {
              const updated = QueueStateMachine.transition(task, 'in_progress', { agentId })
              await ticketRepo.updateTask(itemId, {
                queueStatus: updated.queueStatus,
                queueAgentId: updated.queueAgentId,
                queueStartedAt: updated.queueStartedAt,
                updatedAt: Date.now()
              })
              logger.info('Started processing task', { taskId: itemId, agentId })
            } catch (error: any) {
              throw ErrorFactory.invalidState('Task', error.message, 'start processing')
            }
          }
        },
        { entity: itemType === 'ticket' ? 'Ticket' : 'Task', action: 'startProcessing', id: itemId }
      )
    },

    async completeProcessingItem(itemType: 'ticket' | 'task', itemId: number, processingTime?: number) {
      return withErrorContext(
        async () => {
          if (itemType === 'ticket') {
            const ticket = await ticketRepo.getById(itemId)
            if (!ticket) throw ErrorFactory.notFound('Ticket', itemId)

            try {
              const updated = QueueStateMachine.transition(ticket, 'completed')
              const now = Date.now()
              const updates = {
                queueStatus: updated.queueStatus,
                queueCompletedAt: updated.queueCompletedAt,
                actualProcessingTime: processingTime || updated.actualProcessingTime,
                updatedAt: now,
                ...(ticket.status !== 'closed' ? { status: 'closed' as const } : {})
              }

              await ticketRepo.update(itemId, updates)
              logger.info('Completed processing ticket', {
                ticketId: itemId,
                processingTime,
                statusUpdated: ticket.status !== 'closed'
              })
            } catch (error: any) {
              throw ErrorFactory.invalidState('Ticket', error.message, 'complete processing')
            }
          } else {
            const task = await ticketRepo.getTaskById(itemId)
            if (!task) throw ErrorFactory.notFound('Task', itemId)

            try {
              const updated = QueueStateMachine.transition(task, 'completed')
              await ticketRepo.updateTask(itemId, {
                queueStatus: updated.queueStatus,
                queueCompletedAt: updated.queueCompletedAt,
                done: true,
                actualProcessingTime: processingTime || updated.actualProcessingTime,
                updatedAt: Date.now()
              })
              logger.info('Completed processing task', { taskId: itemId, processingTime })
            } catch (error: any) {
              throw ErrorFactory.invalidState('Task', error.message, 'complete processing')
            }
          }
        },
        { entity: itemType === 'ticket' ? 'Ticket' : 'Task', action: 'completeProcessing', id: itemId }
      )
    },

    async failProcessingItem(itemType: 'ticket' | 'task', itemId: number, errorMessage: string) {
      return withErrorContext(
        async () => {
          if (itemType === 'ticket') {
            const ticket = await ticketRepo.getById(itemId)
            if (!ticket) throw ErrorFactory.notFound('Ticket', itemId)

            try {
              const updated = QueueStateMachine.transition(ticket, 'failed', { errorMessage })
              await ticketRepo.update(itemId, {
                queueStatus: updated.queueStatus,
                queueErrorMessage: updated.queueErrorMessage,
                updatedAt: Date.now()
              })
              logger.info('Failed processing ticket', { ticketId: itemId, errorMessage })
            } catch (error: any) {
              throw ErrorFactory.invalidState('Ticket', error.message, 'fail processing')
            }
          } else {
            const task = await ticketRepo.getTaskById(itemId)
            if (!task) throw ErrorFactory.notFound('Task', itemId)

            try {
              const updated = QueueStateMachine.transition(task, 'failed', { errorMessage })
              await ticketRepo.updateTask(itemId, {
                queueStatus: updated.queueStatus,
                queueErrorMessage: updated.queueErrorMessage,
                updatedAt: Date.now()
              })
              logger.info('Failed processing task', { taskId: itemId, errorMessage })
            } catch (error: any) {
              throw ErrorFactory.invalidState('Task', error.message, 'fail processing')
            }
          }
        },
        { entity: itemType === 'ticket' ? 'Ticket' : 'Task', action: 'failProcessing', id: itemId }
      )
    }
  }
}

export type ProcessorModule = ReturnType<typeof createProcessorModule>
