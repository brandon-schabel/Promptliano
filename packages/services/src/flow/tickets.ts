import { withErrorContext } from '../core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import type { FlowRuntimeContext } from './types'
import type { CreateTicketInput, UpdateTicketInput } from './models'

export function createTicketModule(ctx: FlowRuntimeContext) {
  const { ticketRepo, logger, transformTicket, transformTicketForCompat } = ctx

  return {
    async createTicket(data: CreateTicketInput) {
      return withErrorContext(
        async () => {
          const ticketData = {
            projectId: data.projectId,
            title: data.title,
            overview: data.overview ?? null,
            status: (data.status ?? 'open') as 'open' | 'in_progress' | 'closed',
            priority: (data.priority ?? 'normal') as 'low' | 'normal' | 'high',
            suggestedFileIds: data.suggestedFileIds ?? [],
            suggestedAgentIds: data.suggestedAgentIds ?? [],
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

          const ticket = await ticketRepo.create(ticketData as any)
          logger.info('Created ticket with queue initialization', { ticketId: ticket.id })
          return transformTicket(ticket)
        },
        { entity: 'Ticket', action: 'create' }
      )
    },

    async getTicketById(ticketId: number) {
      return withErrorContext(
        async () => {
          const ticket = await ticketRepo.getById(ticketId)
          return ticket ? transformTicketForCompat(ticket) : null
        },
        { entity: 'Ticket', action: 'get', id: ticketId }
      )
    },

    async updateTicket(ticketId: number, updates: UpdateTicketInput) {
      return withErrorContext(
        async () => {
          const ticket = await ticketRepo.getById(ticketId)
          if (!ticket) {
            throw ErrorFactory.notFound('Ticket', ticketId)
          }

          const convertedUpdates = {
            ...updates,
            updatedAt: Date.now()
          }

          const updatedTicket = await ticketRepo.update(ticketId, convertedUpdates as any)
          logger.info('Updated ticket', { ticketId })
          return transformTicket(updatedTicket)
        },
        { entity: 'Ticket', action: 'update', id: ticketId }
      )
    },

    async deleteTicket(ticketId: number) {
      return withErrorContext(
        async () => {
          const success = await ticketRepo.delete(ticketId)
          if (success) {
            logger.info('Deleted ticket', { ticketId })
          }
          return success
        },
        { entity: 'Ticket', action: 'delete', id: ticketId }
      )
    },

    async listTicketsByProject(projectId: number, status?: 'open' | 'in_progress' | 'closed') {
      return withErrorContext(
        async () => {
          const records = await ticketRepo.getByProject(projectId)
          const normalized = records.map(transformTicket)
          const filtered = status ? normalized.filter((ticket) => ticket.status === status) : normalized
          return filtered.sort((a, b) => b.createdAt - a.createdAt)
        },
        { entity: 'Ticket', action: 'listByProject', id: projectId }
      )
    }
  }
}
