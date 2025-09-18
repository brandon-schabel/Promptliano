import { TicketSchema, TaskSchema, validateJsonField } from '@promptliano/database'
import type { FlowTask, FlowTicket } from './types'

export function transformTicket(rawTicket: any): FlowTicket {
  const result = TicketSchema.safeParse({
    ...rawTicket,
    suggestedFileIds: validateJsonField.stringArray(rawTicket.suggestedFileIds),
    suggestedAgentIds: validateJsonField.stringArray(rawTicket.suggestedAgentIds),
    suggestedPromptIds: validateJsonField.numberArray(rawTicket.suggestedPromptIds)
  })

  if (result.success) {
    return result.data as FlowTicket
  }

  return {
    ...rawTicket,
    suggestedFileIds: validateJsonField.stringArray(rawTicket.suggestedFileIds),
    suggestedAgentIds: validateJsonField.stringArray(rawTicket.suggestedAgentIds),
    suggestedPromptIds: validateJsonField.numberArray(rawTicket.suggestedPromptIds)
  } as FlowTicket
}

export function transformTicketForCompat(rawTicket: any): FlowTicket {
  const ticket = transformTicket(rawTicket)
  return {
    ...ticket,
    queueId: ticket.queueId === null ? undefined : ticket.queueId,
    queueStatus: ticket.queueStatus === null ? undefined : ticket.queueStatus,
    queuePosition: ticket.queuePosition === null ? undefined : ticket.queuePosition,
    queuePriority: ticket.queuePriority === null ? undefined : ticket.queuePriority,
    queuedAt: ticket.queuedAt === null ? undefined : ticket.queuedAt,
    queueStartedAt: ticket.queueStartedAt === null ? undefined : ticket.queueStartedAt,
    queueCompletedAt: ticket.queueCompletedAt === null ? undefined : ticket.queueCompletedAt,
    queueAgentId: ticket.queueAgentId === null ? undefined : ticket.queueAgentId,
    queueErrorMessage: ticket.queueErrorMessage === null ? undefined : ticket.queueErrorMessage
  } as FlowTicket
}

export function transformTask(rawTask: any): FlowTask {
  const result = TaskSchema.safeParse({
    ...rawTask,
    suggestedFileIds: validateJsonField.stringArray(rawTask.suggestedFileIds),
    dependencies: validateJsonField.numberArray(rawTask.dependencies),
    tags: validateJsonField.stringArray(rawTask.tags),
    suggestedPromptIds: validateJsonField.numberArray(rawTask.suggestedPromptIds)
  })

  if (result.success) {
    return result.data as FlowTask
  }

  return {
    ...rawTask,
    suggestedFileIds: validateJsonField.stringArray(rawTask.suggestedFileIds),
    dependencies: validateJsonField.numberArray(rawTask.dependencies),
    tags: validateJsonField.stringArray(rawTask.tags),
    suggestedPromptIds: validateJsonField.numberArray(rawTask.suggestedPromptIds)
  } as FlowTask
}

export function transformTaskForCompat(rawTask: any): FlowTask {
  const task = transformTask(rawTask)
  return {
    ...task,
    queueId: task.queueId === null ? undefined : task.queueId,
    queueStatus: task.queueStatus === null ? undefined : task.queueStatus,
    queuePosition: task.queuePosition === null ? undefined : task.queuePosition,
    queuePriority: task.queuePriority === null ? undefined : task.queuePriority,
    queuedAt: task.queuedAt === null ? undefined : task.queuedAt,
    queueStartedAt: task.queueStartedAt === null ? undefined : task.queueStartedAt,
    queueCompletedAt: task.queueCompletedAt === null ? undefined : task.queueCompletedAt,
    queueAgentId: task.queueAgentId === null ? undefined : task.queueAgentId,
    queueErrorMessage: task.queueErrorMessage === null ? undefined : task.queueErrorMessage
  } as FlowTask
}
