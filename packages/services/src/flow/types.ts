import { z } from 'zod'
import {
  type queueRepository,
  type taskRepository,
  type ticketRepository,
  type Queue,
  type TicketSchema,
  type TaskSchema
} from '@promptliano/database'
import type { createServiceLogger } from '../core/base-service'

export type FlowQueue = Queue
export type FlowTicket = z.infer<typeof TicketSchema>
export type FlowTask = z.infer<typeof TaskSchema>

export interface FlowItem {
  id: string
  type: 'ticket' | 'task'
  title: string
  description?: string
  ticket?: FlowTicket
  task?: FlowTask
  queueId?: number | null
  queuePosition?: number | null
  queueStatus?: string | null
  queuePriority?: number
  created: number
  updated: number
}

export interface FlowData {
  unqueued: {
    tickets: FlowTicket[]
    tasks: FlowTask[]
  }
  queues: Record<
    number,
    {
      queue: FlowQueue
      tickets: FlowTicket[]
      tasks: FlowTask[]
    }
  >
}

export interface FlowServiceDeps {
  ticketRepository?: typeof ticketRepository
  taskRepository?: typeof taskRepository
  queueRepository?: typeof queueRepository
  logger?: ReturnType<typeof createServiceLogger>
}

export interface FlowTransformers {
  transformTicket(raw: any): FlowTicket
  transformTicketForCompat(raw: any): FlowTicket
  transformTask(raw: any): FlowTask
  transformTaskForCompat(raw: any): FlowTask
}

export interface FlowRuntimeContext extends FlowTransformers {
  ticketRepo: typeof ticketRepository
  taskRepo: typeof taskRepository
  queueRepo: typeof queueRepository
  logger: ReturnType<typeof createServiceLogger>
}
