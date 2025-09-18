import { queueRepository, taskRepository, ticketRepository } from '@promptliano/database'
import { createServiceLogger } from '../core/base-service'
import type { FlowRuntimeContext, FlowServiceDeps } from './types'
import { transformTicket, transformTask, transformTicketForCompat, transformTaskForCompat } from './transformers'

export function createFlowRuntimeContext(deps: FlowServiceDeps = {}): FlowRuntimeContext {
  const ticketRepo = deps.ticketRepository ?? ticketRepository
  const taskRepo = deps.taskRepository ?? taskRepository
  const queueRepo = deps.queueRepository ?? queueRepository
  const logger = deps.logger ?? createServiceLogger('FlowService')

  return {
    ticketRepo,
    taskRepo,
    queueRepo,
    logger,
    transformTicket,
    transformTicketForCompat,
    transformTask,
    transformTaskForCompat
  }
}
