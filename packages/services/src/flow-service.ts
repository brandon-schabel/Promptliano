/**
 * Unified Flow Service
 *
 * Combines ticket and queue management into a single unified system.
 * This service treats queue state as properties directly on tickets/tasks,
 * eliminating the need for separate queue_items tracking.
 */

import { ticketRepository, queueRepository } from '@promptliano/database'
import type {
  Ticket,
  TicketTask,
  Queue as TaskQueue
} from '@promptliano/database'
import type {
  TicketWithTasks,
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { QueueStateMachine, type QueueStatus } from './queue-state-machine'

export interface FlowItem {
  id: string
  type: 'ticket' | 'task'
  title: string
  description?: string
  ticket?: Ticket
  task?: TicketTask
  queueId?: number | null
  queuePosition?: number | null
  queueStatus?: string | null
  queuePriority?: number
  created: number
  updated: number
}

export interface FlowData {
  unqueued: {
    tickets: Ticket[]
    tasks: TicketTask[]
  }
  queues: Record<
    number,
    {
      queue: TaskQueue
      tickets: Ticket[]
      tasks: TicketTask[]
    }
  >
}

export class FlowService {
  // === Ticket Operations ===

  async createTicket(data: CreateTicketBody): Promise<Ticket> {
    const ticketId = ticketStorage.generateTicketId()
    const now = Date.now()

    const ticket: Ticket = {
      id: ticketId,
      projectId: data.projectId,
      title: data.title,
      overview: data.overview || '',
      status: data.status || 'open',
      priority: data.priority || 'normal',
      suggestedFileIds: data.suggestedFileIds || [],
      suggestedAgentIds: data.suggestedAgentIds || [],
      suggestedPromptIds: data.suggestedPromptIds || [],
      // New tickets start unqueued
      queueId: undefined,
      queueStatus: undefined,
      queuePosition: undefined,
      queuePriority: 0,
      created: now,
      updated: now
    }

    return await ticketStorage.addTicket(ticket)
  }

  async getTicketById(ticketId: number): Promise<Ticket | null> {
    return await ticketStorage.readTicket(ticketId)
  }

  async updateTicket(ticketId: number, updates: UpdateTicketBody): Promise<Ticket> {
    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw new ApiError(404, `Ticket ${ticketId} not found`, 'NOT_FOUND')
    }

    const updatedTicket: Ticket = {
      ...ticket,
      ...updates,
      updated: Date.now()
    }

    await ticketStorage.replaceTicket(ticketId, updatedTicket)
    return updatedTicket
  }

  async deleteTicket(ticketId: number): Promise<boolean> {
    await ticketStorage.deleteTicketData(ticketId)
    return true
  }

  // === Task Operations ===

  async createTask(ticketId: number, data: CreateTaskBody): Promise<TicketTask> {
    const taskId = ticketStorage.generateTaskId()
    const tasks = await ticketStorage.readTasks(ticketId)
    const maxOrder = Math.max(0, ...Object.values(tasks).map((t) => t.orderIndex))
    const now = Date.now()

    const task: TicketTask = {
      id: taskId,
      ticketId,
      content: data.content,
      description: data.description || '',
      suggestedFileIds: data.suggestedFileIds || [],
      done: false,
      orderIndex: maxOrder + 1,
      estimatedHours: data.estimatedHours || null,
      dependencies: data.dependencies || [],
      tags: data.tags || [],
      agentId: data.agentId || null,
      suggestedPromptIds: data.suggestedPromptIds || [],
      // New tasks start unqueued
      queueId: undefined,
      queueStatus: undefined,
      queuePosition: undefined,
      queuePriority: 0,
      created: now,
      updated: now
    }

    return await ticketStorage.addTask(task)
  }

  async updateTask(taskId: number, updates: UpdateTaskBody): Promise<TicketTask> {
    const task = await ticketStorage.getTaskById(taskId)
    if (!task) {
      throw new ApiError(404, `Task ${taskId} not found`, 'NOT_FOUND')
    }

    const updatedTask: TicketTask = {
      ...task,
      ...updates,
      updated: Date.now()
    }

    await ticketStorage.replaceTask(taskId, updatedTask)
    return updatedTask
  }

  async deleteTask(taskId: number): Promise<boolean> {
    return await ticketStorage.deleteTask(taskId)
  }

  // === Queue Operations ===

  async enqueueTicket(ticketId: number, queueId: number, priority: number = 0): Promise<Ticket> {
    // Verify queue exists
    const queue = await queueStorage.readQueue(queueId)
    if (!queue) {
      throw new ApiError(404, `Queue ${queueId} not found`, 'NOT_FOUND')
    }

    // Enqueue the ticket
    await ticketStorage.enqueueTicket(ticketId, queueId, priority)

    // Return updated ticket
    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw new ApiError(404, `Ticket ${ticketId} not found`, 'NOT_FOUND')
    }

    return ticket
  }

  async enqueueTask(taskId: number, queueId: number, priority: number = 0): Promise<TicketTask> {
    // Verify queue exists
    const queue = await queueStorage.readQueue(queueId)
    if (!queue) {
      throw new ApiError(404, `Queue ${queueId} not found`, 'NOT_FOUND')
    }

    // Enqueue the task
    await ticketStorage.enqueueTask(taskId, queueId, priority)

    // Return updated task
    const task = await ticketStorage.getTaskById(taskId)
    if (!task) {
      throw new ApiError(404, `Task ${taskId} not found`, 'NOT_FOUND')
    }

    return task
  }

  async enqueueTicketWithTasks(ticketId: number, queueId: number, priority: number = 0): Promise<void> {
    // Enqueue the ticket
    await this.enqueueTicket(ticketId, queueId, priority)

    // Enqueue all its tasks
    const tasks = await ticketStorage.readTasks(ticketId)
    for (const task of Object.values(tasks)) {
      await this.enqueueTask(task.id, queueId, priority)
    }
  }

  async dequeueTicket(ticketId: number): Promise<Ticket> {
    await ticketStorage.dequeueTicket(ticketId)

    // Also dequeue all tasks associated with this ticket
    const tasks = await ticketStorage.readTasks(ticketId)
    for (const task of Object.values(tasks)) {
      if (task.queueId !== null) {
        await ticketStorage.dequeueTask(task.id)
      }
    }

    const ticket = await ticketStorage.readTicket(ticketId)
    if (!ticket) {
      throw new ApiError(404, `Ticket ${ticketId} not found`, 'NOT_FOUND')
    }

    return ticket
  }

  async dequeueTicketWithTasks(ticketId: number): Promise<Ticket> {
    // dequeueTicket now handles tasks automatically
    return await this.dequeueTicket(ticketId)
  }

  async dequeueTask(taskId: number): Promise<TicketTask> {
    await ticketStorage.dequeueTask(taskId)

    const task = await ticketStorage.getTaskById(taskId)
    if (!task) {
      throw new ApiError(404, `Task ${taskId} not found`, 'NOT_FOUND')
    }

    return task
  }

  async moveItem(
    itemType: 'ticket' | 'task',
    itemId: number,
    targetQueueId: number | null,
    priority: number = 0,
    includeTasks: boolean = false
  ): Promise<FlowItem> {
    if (itemType === 'ticket') {
      if (targetQueueId === null) {
        await this.dequeueTicketWithTasks(itemId)
        const ticket = await ticketStorage.readTicket(itemId)
        if (!ticket) {
          throw new ApiError(404, `Ticket ${itemId} not found`, 'NOT_FOUND')
        }
        return this.ticketToFlowItem(ticket)
      } else {
        // Moving to another queue
        if (includeTasks) {
          // First, get the ticket and all its tasks before any changes
          const ticket = await ticketStorage.readTicket(itemId)
          if (!ticket) {
            throw new ApiError(404, `Ticket ${itemId} not found`, 'NOT_FOUND')
          }

          // Get all tasks for this ticket, regardless of queue status
          const tasks = await ticketStorage.readTasks(itemId)
          const taskList = Object.values(tasks)

          // If ticket is already in a queue, dequeue it first
          if (ticket.queueId) {
            await this.dequeueTicket(itemId)
          }

          // Dequeue all tasks that are currently in any queue
          for (const task of taskList) {
            if (task.queueId !== null) {
              await this.dequeueTask(task.id)
            }
          }

          // Now enqueue the ticket to the new queue
          await this.enqueueTicket(itemId, targetQueueId, priority)

          // And enqueue all its tasks to the same queue
          for (const task of taskList) {
            await this.enqueueTask(task.id, targetQueueId, priority)
          }

          // Return the updated ticket
          const updatedTicket = await ticketStorage.readTicket(itemId)
          if (!updatedTicket) {
            throw new ApiError(404, `Ticket ${itemId} not found after move`, 'NOT_FOUND')
          }
          return this.ticketToFlowItem(updatedTicket)
        } else {
          // Just move the ticket without tasks (existing behavior)
          const ticket = await this.enqueueTicket(itemId, targetQueueId, priority)
          return this.ticketToFlowItem(ticket)
        }
      }
    } else {
      if (targetQueueId === null) {
        const task = await this.dequeueTask(itemId)
        return this.taskToFlowItem(task)
      } else {
        const task = await this.enqueueTask(itemId, targetQueueId, priority)
        return this.taskToFlowItem(task)
      }
    }
  }

  // === Flow Data Operations ===

  async getFlowData(projectId: number): Promise<FlowData> {
    // Get all tickets and tasks for the project
    const ticketsWithTasks = await this.getTicketsWithTasks(projectId)

    // Get all queues for the project
    const queues = await queueStorage.readQueues(projectId)

    // Initialize flow data structure
    const flowData: FlowData = {
      unqueued: {
        tickets: [],
        tasks: []
      },
      queues: {}
    }

    // Initialize queue structures
    for (const queue of Object.values(queues)) {
      flowData.queues[queue.id] = {
        queue,
        tickets: [],
        tasks: []
      }
    }

    // Organize tickets and tasks by queue status
    for (const ticketWithTasks of ticketsWithTasks) {
      const ticket = ticketWithTasks.ticket
      const tasks = ticketWithTasks.tasks

      // Process ticket
      if (!ticket.queueId) {
        flowData.unqueued.tickets.push(ticket)
      } else if (flowData.queues[ticket.queueId]) {
        flowData.queues[ticket.queueId]!.tickets.push(ticket)
      }

      // Process tasks
      for (const task of tasks) {
        if (!task.queueId) {
          flowData.unqueued.tasks.push(task)
        } else if (flowData.queues[task.queueId]) {
          flowData.queues[task.queueId]!.tasks.push(task)
        }
      }
    }

    // Sort items within each queue by position
    for (const queueData of Object.values(flowData.queues)) {
      queueData.tickets.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
      queueData.tasks.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
    }

    return flowData
  }

  async reorderWithinQueue(
    queueId: number,
    items: Array<{ itemType: 'ticket' | 'task'; itemId: number; ticketId?: number }>
  ): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it) continue
      if (it.itemType === 'ticket') {
        const ticket = await ticketStorage.readTicket(it.itemId)
        if (ticket?.queueId === queueId) {
          await ticketStorage.updateTicket(it.itemId, { queuePosition: i })
        }
      } else if (it.ticketId) {
        const task = await ticketStorage.getTaskById(it.itemId)
        if (task?.queueId === queueId) {
          await ticketStorage.updateTask(it.ticketId, it.itemId, { queuePosition: i })
        }
      }
    }
  }

  async getFlowItems(projectId: number): Promise<FlowItem[]> {
    const flowData = await this.getFlowData(projectId)
    const items: FlowItem[] = []

    // Add unqueued items
    for (const ticket of flowData.unqueued.tickets) {
      items.push(this.ticketToFlowItem(ticket))
    }
    for (const task of flowData.unqueued.tasks) {
      items.push(this.taskToFlowItem(task))
    }

    // Add queued items
    for (const queueData of Object.values(flowData.queues)) {
      for (const ticket of queueData.tickets) {
        items.push(this.ticketToFlowItem(ticket))
      }
      for (const task of queueData.tasks) {
        items.push(this.taskToFlowItem(task))
      }
    }

    return items
  }

  async getQueueItems(queueId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
    return await ticketStorage.getQueueItems(queueId)
  }

  async getUnqueuedItems(projectId: number): Promise<{ tickets: Ticket[]; tasks: TicketTask[] }> {
    return await ticketStorage.getUnqueuedItems(projectId)
  }

  // === Helper Methods ===

  private async getTicketsWithTasks(projectId: number): Promise<TicketWithTasks[]> {
    // Use optimized single-query method to avoid N+1 problem
    const results = await ticketStorage.getTicketsWithTasksOptimized(projectId)

    // Transform to TicketWithTasks format
    return results.map(({ ticket, tasks }) => ({
      ticket,
      tasks
    }))
  }

  private ticketToFlowItem(ticket: Ticket): FlowItem {
    return {
      id: `ticket-${ticket.id}`,
      type: 'ticket',
      title: ticket.title,
      description: ticket.overview,
      ticket,
      queueId: ticket.queueId ?? null,
      queuePosition: ticket.queuePosition ?? null,
      queueStatus: ticket.queueStatus ?? null,
      queuePriority: ticket.queuePriority,
      created: ticket.created,
      updated: ticket.updated
    }
  }

  private taskToFlowItem(task: TicketTask): FlowItem {
    return {
      id: `task-${task.id}`,
      type: 'task',
      title: task.content,
      description: task.description,
      task,
      queueId: task.queueId ?? null,
      queuePosition: task.queuePosition ?? null,
      queueStatus: task.queueStatus ?? null,
      queuePriority: task.queuePriority,
      created: task.created,
      updated: task.updated
    }
  }

  // === Queue Processing Operations ===

  async startProcessingItem(itemType: 'ticket' | 'task', itemId: number, agentId: string): Promise<void> {
    if (itemType === 'ticket') {
      const ticket = await ticketStorage.readTicket(itemId)
      if (!ticket) throw new ApiError(404, `Ticket ${itemId} not found`, 'NOT_FOUND')

      // Use state machine to validate and apply transition
      try {
        const updatedTicket = QueueStateMachine.transition(ticket, 'in_progress', { agentId })
        await ticketStorage.replaceTicket(itemId, updatedTicket as Ticket)
      } catch (error: any) {
        throw new ApiError(400, error.message, 'INVALID_STATE_TRANSITION')
      }
    } else {
      const task = await ticketStorage.getTaskById(itemId)
      if (!task) throw new ApiError(404, `Task ${itemId} not found`, 'NOT_FOUND')

      // Use state machine to validate and apply transition
      try {
        const updatedTask = QueueStateMachine.transition(task, 'in_progress', { agentId })
        await ticketStorage.replaceTask(itemId, updatedTask as TicketTask)
      } catch (error: any) {
        throw new ApiError(400, error.message, 'INVALID_STATE_TRANSITION')
      }
    }
  }

  async completeProcessingItem(itemType: 'ticket' | 'task', itemId: number, processingTime?: number): Promise<void> {
    if (itemType === 'ticket') {
      const ticket = await ticketStorage.readTicket(itemId)
      if (!ticket) throw new ApiError(404, `Ticket ${itemId} not found`, 'NOT_FOUND')

      // Use state machine to validate and apply transition
      try {
        const updatedTicket = QueueStateMachine.transition(ticket, 'completed') as Ticket
        // Add processing time if provided
        if (processingTime) {
          ;(updatedTicket as any).actualProcessingTime = processingTime
        }
        await ticketStorage.replaceTicket(itemId, updatedTicket)
      } catch (error: any) {
        throw new ApiError(400, error.message, 'INVALID_STATE_TRANSITION')
      }
    } else {
      const task = await ticketStorage.getTaskById(itemId)
      if (!task) throw new ApiError(404, `Task ${itemId} not found`, 'NOT_FOUND')

      // Use state machine to validate and apply transition
      try {
        const updatedTask = QueueStateMachine.transition(task, 'completed') as TicketTask
        // Add processing time if provided
        if (processingTime) {
          ;(updatedTask as any).actualProcessingTime = processingTime
        }
        // Mark task as done when completed
        ;(updatedTask as any).done = true
        await ticketStorage.replaceTask(itemId, updatedTask)
      } catch (error: any) {
        throw new ApiError(400, error.message, 'INVALID_STATE_TRANSITION')
      }
    }
  }

  async failProcessingItem(itemType: 'ticket' | 'task', itemId: number, errorMessage: string): Promise<void> {
    if (itemType === 'ticket') {
      const ticket = await ticketStorage.readTicket(itemId)
      if (!ticket) throw new ApiError(404, `Ticket ${itemId} not found`, 'NOT_FOUND')

      // Use state machine to validate and apply transition
      try {
        const updatedTicket = QueueStateMachine.transition(ticket, 'failed', { errorMessage })
        await ticketStorage.replaceTicket(itemId, updatedTicket as Ticket)
      } catch (error: any) {
        throw new ApiError(400, error.message, 'INVALID_STATE_TRANSITION')
      }
    } else {
      const task = await ticketStorage.getTaskById(itemId)
      if (!task) throw new ApiError(404, `Task ${itemId} not found`, 'NOT_FOUND')

      // Use state machine to validate and apply transition
      try {
        const updatedTask = QueueStateMachine.transition(task, 'failed', { errorMessage })
        await ticketStorage.replaceTask(itemId, updatedTask as TicketTask)
      } catch (error: any) {
        throw new ApiError(400, error.message, 'INVALID_STATE_TRANSITION')
      }
    }
  }
}

// Export singleton instance
export const flowService = new FlowService()
