/**
 * Task Service - Business logic layer for ticket task management
 * Wraps the task repository with service-level functionality
 * Provides consistent TaskStatus type handling and business rules
 */

import { taskRepository } from '../../database/src/repositories/task-repository'
import { 
  type TicketTask, 
  type InsertTicketTask, 
  type TaskStatus 
} from '../../database/src/schema'

export class TaskService {
  private repository = taskRepository

  /**
   * Create a new task with proper TaskStatus handling
   */
  async createTask(data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketTask> {
    // Ensure status is properly typed as TaskStatus, not string
    const taskData = {
      ...data,
      status: (data.status || 'pending') as TaskStatus
    }

    return this.repository.create(taskData)
  }

  /**
   * Update task with proper status type handling
   */
  async updateTask(id: number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>): Promise<TicketTask> {
    // Ensure status is properly typed if provided
    const updateData = data.status 
      ? { ...data, status: data.status as TaskStatus }
      : data

    return this.repository.update(id, updateData)
  }

  /**
   * Update task status with type safety
   */
  async updateTaskStatus(id: number, status: TaskStatus): Promise<TicketTask> {
    return this.repository.update(id, { status })
  }

  /**
   * Get task by ID
   */
  async getTaskById(id: number): Promise<TicketTask | null> {
    return this.repository.getById(id)
  }

  /**
   * Get tasks by ticket ID
   */
  async getTasksByTicket(ticketId: number): Promise<TicketTask[]> {
    return this.repository.getByTicket(ticketId)
  }

  /**
   * Get tasks by status with proper TaskStatus type
   */
  async getTasksByStatus(ticketId: number, status: TaskStatus): Promise<TicketTask[]> {
    return this.repository.getByTaskStatus(ticketId, status)
  }

  /**
   * Get pending tasks for a ticket
   */
  async getPendingTasks(ticketId: number): Promise<TicketTask[]> {
    return this.getTasksByStatus(ticketId, 'pending')
  }

  /**
   * Get in-progress tasks for a ticket
   */
  async getInProgressTasks(ticketId: number): Promise<TicketTask[]> {
    return this.getTasksByStatus(ticketId, 'in_progress')
  }

  /**
   * Get completed tasks for a ticket
   */
  async getCompletedTasks(ticketId: number): Promise<TicketTask[]> {
    return this.getTasksByStatus(ticketId, 'completed')
  }

  /**
   * Mark task as in progress
   */
  async startTask(id: number): Promise<TicketTask> {
    return this.updateTaskStatus(id, 'in_progress')
  }

  /**
   * Mark task as completed
   */
  async completeTask(id: number): Promise<TicketTask> {
    // Update both status and done flag for backwards compatibility
    return this.repository.update(id, { 
      status: 'completed' as TaskStatus,
      done: true
    })
  }

  /**
   * Cancel a task
   */
  async cancelTask(id: number): Promise<TicketTask> {
    return this.updateTaskStatus(id, 'cancelled')
  }

  /**
   * Delete a task
   */
  async deleteTask(id: number): Promise<boolean> {
    return this.repository.delete(id)
  }

  /**
   * Get tasks by agent with proper type handling
   */
  async getTasksByAgent(agentId: string): Promise<TicketTask[]> {
    return this.repository.getByAgent(agentId)
  }

  /**
   * Toggle task completion (legacy method with status sync)
   */
  async toggleTaskCompletion(id: number): Promise<TicketTask> {
    const task = await this.repository.getById(id)
    if (!task) {
      throw new Error(`Task ${id} not found`)
    }

    // Sync done flag with status
    const newStatus: TaskStatus = task.done ? 'pending' : 'completed'
    return this.repository.update(id, {
      done: !task.done,
      status: newStatus
    })
  }

  /**
   * Create multiple tasks with proper type handling
   */
  async createTasks(tasksData: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TicketTask[]> {
    // Ensure all tasks have properly typed status
    const typedTasksData = tasksData.map(data => ({
      ...data,
      status: (data.status || 'pending') as TaskStatus
    }))

    return this.repository.createMany(typedTasksData)
  }

  /**
   * Get task statistics with status breakdown
   */
  async getTaskStatistics(ticketId: number) {
    const tasks = await this.repository.getByTicket(ticketId)
    
    const stats = {
      total: tasks.length,
      pending: tasks.filter((t: TicketTask) => t.status === 'pending').length,
      inProgress: tasks.filter((t: TicketTask) => t.status === 'in_progress').length,
      completed: tasks.filter((t: TicketTask) => t.status === 'completed').length,
      cancelled: tasks.filter((t: TicketTask) => t.status === 'cancelled').length,
      totalHours: tasks.reduce((sum: number, task: TicketTask) => sum + (task.estimatedHours || 0), 0)
    }

    return {
      ...stats,
      completionPercentage: stats.total > 0 ? 
        Math.round((stats.completed / stats.total) * 100) : 0,
      activePercentage: stats.total > 0 ? 
        Math.round(((stats.inProgress + stats.pending) / stats.total) * 100) : 0
    }
  }

  /**
   * Reorder tasks within a ticket
   */
  async reorderTasks(ticketId: number, taskOrders: { taskId: number; orderIndex: number }[]): Promise<void> {
    return this.repository.reorder(ticketId, taskOrders)
  }

  /**
   * Move task to different position
   */
  async moveTaskToPosition(taskId: number, newOrderIndex: number): Promise<TicketTask> {
    return this.repository.moveToPosition(taskId, newOrderIndex)
  }

  /**
   * Check if task dependencies are completed
   */
  async areDependenciesCompleted(taskId: number): Promise<boolean> {
    return this.repository.areDependenciesCompleted(taskId)
  }

  /**
   * Get available tasks (no incomplete dependencies)
   */
  async getAvailableTasks(ticketId: number): Promise<TicketTask[]> {
    return this.repository.getAvailableTasks(ticketId)
  }

  /**
   * Get blocked tasks (have incomplete dependencies)
   */
  async getBlockedTasks(ticketId: number): Promise<TicketTask[]> {
    return this.repository.getBlockedTasks(ticketId)
  }

  /**
   * Search tasks by content
   */
  async searchTasks(searchTerm: string, ticketId?: number): Promise<TicketTask[]> {
    return this.repository.searchByContent(searchTerm, ticketId)
  }

  /**
   * Get tasks by time range
   */
  async getTasksByTimeRange(startDate: number, endDate: number): Promise<TicketTask[]> {
    return this.repository.getByTimeRange(startDate, endDate)
  }

  /**
   * Delete all tasks for a ticket
   */
  async deleteTasksByTicket(ticketId: number): Promise<number> {
    return this.repository.deleteByTicket(ticketId)
  }
}

// Export singleton instance for convenience
export const taskService = new TaskService()

// Export types for external use
export type { TicketTask, InsertTicketTask, TaskStatus }

// =============================================================================
// FUNCTIONAL API - Export functions that MCP tools and routes expect
// =============================================================================

/**
 * Create a task using the singleton service instance
 */
export const createTask = (data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>) => 
  taskService.createTask(data)

/**
 * Get all tasks for a ticket
 */
export const getTasks = (ticketId: number) => 
  taskService.getTasksByTicket(ticketId)

/**
 * Update a task
 */
export const updateTask = (id: number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>) => 
  taskService.updateTask(id, data)

/**
 * Delete a task
 */
export const deleteTask = (id: number) => 
  taskService.deleteTask(id)

/**
 * Reorder tasks within a ticket
 */
export const reorderTasks = (ticketId: number, taskOrders: { taskId: number; orderIndex: number }[]) => 
  taskService.reorderTasks(ticketId, taskOrders)

/**
 * Get tasks for multiple tickets (batch operation)
 */
export const getTasksForTickets = async (ticketIds: number[]): Promise<Record<number, TicketTask[]>> => {
  const results: Record<number, TicketTask[]> = {}
  
  for (const ticketId of ticketIds) {
    results[ticketId] = await taskService.getTasksByTicket(ticketId)
  }
  
  return results
}

/**
 * Create multiple tasks in batch
 */
export const batchCreateTasks = (tasksData: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>[]) => 
  taskService.createTasks(tasksData)

/**
 * Update multiple tasks in batch
 */
export const batchUpdateTasks = async (updates: { id: number; data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>> }[]): Promise<TicketTask[]> => {
  const results: TicketTask[] = []
  
  for (const { id, data } of updates) {
    const updated = await taskService.updateTask(id, data)
    results.push(updated)
  }
  
  return results
}

/**
 * Delete multiple tasks in batch
 */
export const batchDeleteTasks = async (taskIds: number[]): Promise<boolean[]> => {
  const results: boolean[] = []
  
  for (const id of taskIds) {
    const deleted = await taskService.deleteTask(id)
    results.push(deleted)
  }
  
  return results
}

/**
 * Move multiple tasks to different positions
 */
export const batchMoveTasks = async (moves: { taskId: number; newOrderIndex: number }[]): Promise<TicketTask[]> => {
  const results: TicketTask[] = []
  
  for (const { taskId, newOrderIndex } of moves) {
    const moved = await taskService.moveTaskToPosition(taskId, newOrderIndex)
    results.push(moved)
  }
  
  return results
}

/**
 * Filter tasks by various criteria
 */
export const filterTasks = async (
  ticketId: number, 
  filters: {
    status?: TaskStatus
    done?: boolean
    agentId?: string
    tags?: string[]
  }
): Promise<TicketTask[]> => {
  let tasks = await taskService.getTasksByTicket(ticketId)
  
  if (filters.status) {
    tasks = tasks.filter((t: TicketTask) => t.status === filters.status)
  }
  
  if (filters.done !== undefined) {
    tasks = tasks.filter((t: TicketTask) => t.done === filters.done)
  }
  
  if (filters.agentId) {
    tasks = tasks.filter((t: TicketTask) => t.agentId === filters.agentId)
  }
  
  if (filters.tags && filters.tags.length > 0) {
    tasks = tasks.filter((t: TicketTask) => 
      filters.tags!.some(tag => t.tags.includes(tag))
    )
  }
  
  return tasks
}

/**
 * Get task with additional context (files, etc.)
 */
export const getTaskWithContext = async (taskId: number) => {
  const task = await taskService.getTaskById(taskId)
  if (!task) return null
  
  return {
    ...task,
    dependenciesCompleted: await taskService.areDependenciesCompleted(taskId)
  }
}

/**
 * Analyze task complexity based on content, dependencies, etc.
 */
export const analyzeTaskComplexity = async (taskId: number) => {
  const task = await taskService.getTaskById(taskId)
  if (!task) return null
  
  const complexity = {
    score: 1, // Base complexity
    factors: [] as string[]
  }
  
  // Add complexity for dependencies
  if (task.dependencies.length > 0) {
    complexity.score += task.dependencies.length * 0.5
    complexity.factors.push(`${task.dependencies.length} dependencies`)
  }
  
  // Add complexity for content length
  if (task.content.length > 200) {
    complexity.score += 1
    complexity.factors.push('Detailed description')
  }
  
  // Add complexity for estimated hours
  if (task.estimatedHours && task.estimatedHours > 2) {
    complexity.score += 1
    complexity.factors.push('High time estimate')
  }
  
  return {
    task,
    complexity: Math.min(complexity.score, 5), // Cap at 5
    factors: complexity.factors
  }
}

/**
 * Suggest files for a task based on content and existing suggestions
 */
export const suggestFilesForTask = async (taskId: number) => {
  const task = await taskService.getTaskById(taskId)
  if (!task) return []
  
  // For now, return existing suggested files
  // In the future, could use AI to suggest additional relevant files
  return task.suggestedFileIds
}

// =============================================================================
// QUEUE INTEGRATION FUNCTIONS - For MCP tools that expect queue operations
// =============================================================================

/**
 * Enqueue a task (placeholder - should integrate with queue service)
 */
export const enqueueTask = async (taskId: number, queueId?: number, priority?: number) => {
  // TODO: Integrate with actual queue service
  // For now, just update the task with queue info
  const task = await taskService.getTaskById(taskId)
  if (!task) {
    throw new Error(`Task ${taskId} not found`)
  }
  
  return taskService.updateTask(taskId, {
    queueId: queueId || null,
    queuePriority: priority || 5,
    queueStatus: 'queued' as const,
    queuedAt: Date.now()
  })
}

/**
 * Dequeue a task (placeholder)
 */
export const dequeueTask = async (taskId: number) => {
  return taskService.updateTask(taskId, {
    queueId: null,
    queueStatus: null,
    queuedAt: null
  })
}

/**
 * Get next task from queue (placeholder)
 */
export const getNextTaskFromQueue = async (queueId: number) => {
  // TODO: Implement proper queue logic
  // For now, return null
  return null
}

/**
 * Enqueue ticket with all tasks (placeholder)
 */
export const enqueueTicketWithAllTasks = async (ticketId: number, queueId: number, priority: number = 5) => {
  const tasks = await taskService.getTasksByTicket(ticketId)
  
  for (const task of tasks) {
    await enqueueTask(task.id, queueId, priority)
  }
  
  return tasks.length
}