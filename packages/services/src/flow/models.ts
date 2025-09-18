import type { FlowTask, FlowTicket } from './types'

export type TicketWithTasks = FlowTicket & {
  tasks: FlowTask[]
}

export interface CreateTicketInput {
  projectId: number
  title: string
  overview?: string | null
  status?: 'open' | 'in_progress' | 'closed'
  priority?: 'low' | 'normal' | 'high'
  suggestedFileIds?: string[]
  suggestedAgentIds?: string[]
  suggestedPromptIds?: number[]
}

export interface UpdateTicketInput extends Partial<CreateTicketInput> {}

export interface CreateTaskInput {
  content: string
  description?: string | null
  done?: boolean
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  orderIndex?: number
  estimatedHours?: number | null
  dependencies?: number[]
  tags?: string[]
  agentId?: string | null
  suggestedFileIds?: string[]
  suggestedPromptIds?: number[]
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}
