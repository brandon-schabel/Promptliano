import type { Project, Queue, Ticket, TicketTask, Prompt } from '@promptliano/schemas'
import type { GetProjectsByIdFlowResponse } from '@promptliano/api-client'

export type FlowDataResponse = GetProjectsByIdFlowResponse

export interface FlowQueueSnapshot {
  queue: Queue
  tickets: Ticket[]
  tasks: TicketTask[]
}

export interface FlowTicketSnapshot {
  ticket: Ticket
  tasks: TicketTask[]
}

export interface FlowProjectSnapshot {
  project: Project
  tickets: FlowTicketSnapshot[]
  queues: FlowQueueSnapshot[]
  prompts: Prompt[]
}

export type ProjectFlowResult =
  | { kind: 'success'; snapshot: FlowProjectSnapshot }
  | { kind: 'error'; project: Project; message: string }
