/**
 * Task Service - Business logic layer for ticket task management
 * Functional factory pattern for task operations with dependency injection
 * Provides consistent TaskStatus type handling and business rules
 */

import { taskRepository, TaskSchema, validateJsonField, type InsertTicketTask, type TaskStatus, type TicketTask } from '@promptliano/database'
import ErrorFactory from '@promptliano/shared/src/error/error-factory'

// Export types for external use
export type { TicketTask, InsertTicketTask, TaskStatus }

/**
 * Transform raw database task to properly typed task
 * This converts Json fields to proper TypeScript types using database validators
 */
function transformTask(rawTask: any): TicketTask {
  const result = TaskSchema.safeParse({
    ...rawTask,
    suggestedFileIds: validateJsonField.stringArray(rawTask.suggestedFileIds),
    dependencies: validateJsonField.numberArray(rawTask.dependencies),
    tags: validateJsonField.stringArray(rawTask.tags),
    suggestedPromptIds: validateJsonField.numberArray(rawTask.suggestedPromptIds)
  })
  if (result.success) {
    return result.data as TicketTask
  }
  // Fallback with manual transformation using database validators
  return {
    ...rawTask,
    suggestedFileIds: validateJsonField.stringArray(rawTask.suggestedFileIds),
    dependencies: validateJsonField.numberArray(rawTask.dependencies),
    tags: validateJsonField.stringArray(rawTask.tags),
    suggestedPromptIds: validateJsonField.numberArray(rawTask.suggestedPromptIds)
  } as TicketTask
}

/**
 * Transform array of raw database tasks to properly typed tasks
 */
function transformTasks(rawTasks: any[]): TicketTask[] {
  return rawTasks.map(transformTask)
}

export interface TaskServiceDependencies {
  repository?: typeof taskRepository
  errorFactory?: typeof ErrorFactory
}

/**
 * Creates a task service with dependency injection
 */
export function createTaskService(deps: TaskServiceDependencies = {}) {
  const repository = deps.repository || taskRepository
  // ErrorFactory provides all necessary methods for standardized error handling

  return {
    /**
     * List all tasks (route factory compatible)
     */
    async list(): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getAll()
        // Transform raw repository results to proper types
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('list tasks', String(error))
      }
    },

    /**
     * Get task by ID (returns null if not found) - route factory compatible
     */
    async get(id: number | string): Promise<TicketTask | null> {
      try {
        const task = await repository.getById(Number(id))
        return task ? transformTask(task) : null
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch task', String(error))
      }
    },

    /**
     * Get task by ID (route factory compatible)
     */
    async getById(id: number | string): Promise<TicketTask> {
      try {
        const task = await repository.getById(Number(id))
        if (!task) {
          throw ErrorFactory.notFound('Task', id)
        }
        return transformTask(task)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch task', String(error))
      }
    },

    /**
     * Create task (route factory compatible)
     */
    async create(data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketTask> {
      const result = await this.createTask(data)
      return result
    },

    /**
     * Update task (route factory compatible)
     */
    async update(id: number | string, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>): Promise<TicketTask> {
      const result = await this.updateTask(Number(id), data)
      return result
    },

    /**
     * Delete task (route factory compatible)
     */
    async delete(id: number | string): Promise<boolean> {
      try {
        return await repository.delete(Number(id))
      } catch (error) {
        throw ErrorFactory.operationFailed('delete task', String(error))
      }
    },

    /**
     * Create a new task with proper TaskStatus handling
     */
    async createTask(data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketTask> {
      try {
        const now = Date.now()
        // Ensure status is properly typed as TaskStatus, not string and add timestamps
        const taskData = {
          ...data,
          status: (data.status || 'pending') as TaskStatus,
          createdAt: now,
          updatedAt: now
        }

        const result = await repository.create(taskData)
        return transformTask(result)
      } catch (error) {
        throw ErrorFactory.operationFailed('create task', String(error))
      }
    },

    /**
     * Update task with proper status type handling
     */
    async updateTask(id: number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>): Promise<TicketTask> {
      try {
        // Ensure status is properly typed if provided
        const updateData = data.status ? { ...data, status: data.status as TaskStatus } : data

        const result = await repository.update(id, updateData)
        return transformTask(result)
      } catch (error) {
        throw ErrorFactory.operationFailed('update task', String(error))
      }
    },

    /**
     * Update task status with type safety
     */
    async updateTaskStatus(id: number, status: TaskStatus): Promise<TicketTask> {
      try {
        const result = await repository.update(id, { status })
        return transformTask(result)
      } catch (error) {
        throw ErrorFactory.operationFailed('update task status', String(error))
      }
    },

    /**
     * Get task by ID
     */
    async getTaskById(id: number): Promise<TicketTask | null> {
      try {
        const task = await repository.getById(id)
        return task ? transformTask(task) : null
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch task', String(error))
      }
    },

    /**
     * Get tasks by ticket ID (route factory compatible alias)
     */
    async getByTicket(ticketId: number): Promise<TicketTask[]> {
      return this.getTasksByTicket(ticketId)
    },

    /**
     * Get tasks by ticket ID
     */
    async getTasksByTicket(ticketId: number): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getByTicket(ticketId)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch tasks for ticket', String(error))
      }
    },

    /**
     * Get tasks by status with proper TaskStatus type
     */
    async getTasksByStatus(ticketId: number, status: TaskStatus): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getByTaskStatus(ticketId, status)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch tasks by status', String(error))
      }
    },

    /**
     * Get pending tasks for a ticket
     */
    async getPendingTasks(ticketId: number): Promise<TicketTask[]> {
      return this.getTasksByStatus(ticketId, 'pending')
    },

    /**
     * Get in-progress tasks for a ticket
     */
    async getInProgressTasks(ticketId: number): Promise<TicketTask[]> {
      return this.getTasksByStatus(ticketId, 'in_progress')
    },

    /**
     * Get completed tasks for a ticket
     */
    async getCompletedTasks(ticketId: number): Promise<TicketTask[]> {
      return this.getTasksByStatus(ticketId, 'completed')
    },

    /**
     * Mark task as in progress
     */
    async startTask(id: number): Promise<TicketTask> {
      return this.updateTaskStatus(id, 'in_progress')
    },

    /**
     * Mark task as completed
     */
    async completeTask(id: number): Promise<TicketTask> {
      try {
        // Update both status and done flag for backwards compatibility
        const result = await repository.update(id, {
          status: 'completed' as TaskStatus,
          done: true
        })
        return transformTask(result)
      } catch (error) {
        throw ErrorFactory.operationFailed('complete task', String(error))
      }
    },

    /**
     * Cancel a task
     */
    async cancelTask(id: number): Promise<TicketTask> {
      const result = await this.updateTaskStatus(id, 'cancelled')
      return result
    },

    /**
     * Delete a task
     */
    async deleteTask(id: number): Promise<boolean> {
      try {
        return await repository.delete(id)
      } catch (error) {
        throw ErrorFactory.operationFailed('delete task', String(error))
      }
    },

    /**
     * Get tasks by agent with proper type handling
     */
    async getTasksByAgent(agentId: string): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getByAgent(agentId)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch tasks for agent', String(error))
      }
    },

    /**
     * Toggle task completion (legacy method with status sync)
     */
    async toggleTaskCompletion(id: number): Promise<TicketTask> {
      try {
        const task = await repository.getById(id)
        if (!task) {
          throw ErrorFactory.notFound('Task', id)
        }

        // Sync done flag with status
        const newStatus: TaskStatus = task.done ? 'pending' : 'completed'
        const result = await repository.update(id, {
          done: !task.done,
          status: newStatus
        })
        return transformTask(result)
      } catch (error) {
        if (error instanceof Error && (error as any).code) throw error // Re-throw domain errors
        throw ErrorFactory.operationFailed('toggle task', error instanceof Error ? error.message : String(error))
      }
    },

    /**
     * Create multiple tasks with proper type handling
     */
    async createTasks(tasksData: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TicketTask[]> {
      try {
        const now = Date.now()
        // Ensure all tasks have properly typed status and required timestamps
        const typedTasksData = tasksData.map((data) => ({
          ...data,
          status: (data.status || 'pending') as TaskStatus,
          createdAt: now,
          updatedAt: now
        }))

        const results = await repository.createMany(typedTasksData)
        return transformTasks(results)
      } catch (error) {
        throw ErrorFactory.operationFailed('batch create tasks', String(error))
      }
    },

    /**
     * Get task statistics with status breakdown
     */
    async getTaskStatistics(ticketId: number) {
      try {
        const rawTasks = await repository.getByTicket(ticketId)
        const tasks = transformTasks(rawTasks)

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
          completionPercentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          activePercentage: stats.total > 0 ? Math.round(((stats.inProgress + stats.pending) / stats.total) * 100) : 0
        }
      } catch (error) {
        throw ErrorFactory.operationFailed('get task statistics', String(error))
      }
    },

    /**
     * Reorder tasks within a ticket
     */
    async reorderTasks(ticketId: number, taskOrders: { taskId: number; orderIndex: number }[]): Promise<void> {
      try {
        return await repository.reorder(ticketId, taskOrders)
      } catch (error) {
        throw ErrorFactory.operationFailed('reorder tasks', String(error))
      }
    },

    /**
     * Move task to different position
     */
    async moveTaskToPosition(taskId: number, newOrderIndex: number): Promise<TicketTask> {
      try {
        const result = await repository.moveToPosition(taskId, newOrderIndex)
        return transformTask(result)
      } catch (error) {
        throw ErrorFactory.operationFailed('move task', String(error))
      }
    },

    /**
     * Check if task dependencies are completed
     */
    async areDependenciesCompleted(taskId: number): Promise<boolean> {
      try {
        return await repository.areDependenciesCompleted(taskId)
      } catch (error) {
        throw ErrorFactory.operationFailed('check task dependencies', String(error))
      }
    },

    /**
     * Get available tasks (no incomplete dependencies)
     */
    async getAvailableTasks(ticketId: number): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getAvailableTasks(ticketId)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch available tasks', String(error))
      }
    },

    /**
     * Get blocked tasks (have incomplete dependencies)
     */
    async getBlockedTasks(ticketId: number): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getBlockedTasks(ticketId)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch blocked tasks', String(error))
      }
    },

    /**
     * Search tasks by content
     */
    async searchTasks(searchTerm: string, ticketId?: number): Promise<TicketTask[]> {
      try {
        const tasks = await repository.searchByContent(searchTerm, ticketId)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('search tasks', String(error))
      }
    },

    /**
     * Get tasks by time range
     */
    async getTasksByTimeRange(startDate: number, endDate: number): Promise<TicketTask[]> {
      try {
        const tasks = await repository.getByTimeRange(startDate, endDate)
        return transformTasks(tasks)
      } catch (error) {
        throw ErrorFactory.operationFailed('fetch tasks by time range', String(error))
      }
    },

    /**
     * Delete all tasks for a ticket
     */
    async deleteTasksByTicket(ticketId: number): Promise<number> {
      try {
        return await repository.deleteByTicket(ticketId)
      } catch (error) {
        throw ErrorFactory.operationFailed('batch delete tasks', String(error))
      }
    }
  }
}

// Default service instance for convenience
export const taskService = createTaskService()

// =============================================================================
// FUNCTIONAL API - Export functions that MCP tools and routes expect
// =============================================================================

/**
 * Create a task using the factory service
 */
export const createTask = (data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>) =>
  taskService.createTask(data)

/**
 * Get all tasks for a ticket
 */
export const getTasks = (ticketId: number) => taskService.getTasksByTicket(ticketId)

/**
 * Update a task
 */
export const updateTask = (id: number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>) =>
  taskService.updateTask(id, data)

/**
 * Delete a task
 */
export const deleteTask = (id: number) => taskService.deleteTask(id)

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

  // Use Promise.all for better performance
  const tasks = await Promise.all(
    ticketIds.map(async (ticketId) => ({
      ticketId,
      tasks: await taskService.getTasksByTicket(ticketId)
    }))
  )

  tasks.forEach(({ ticketId, tasks }) => {
    results[ticketId] = tasks
  })

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
export const batchUpdateTasks = async (
  updates: { id: number; data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>> }[]
): Promise<TicketTask[]> => {
  // Use Promise.all for better performance
  return await Promise.all(updates.map(({ id, data }) => taskService.updateTask(id, data)))
}

/**
 * Delete multiple tasks in batch
 */
export const batchDeleteTasks = async (taskIds: number[]): Promise<boolean[]> => {
  // Use Promise.all for better performance
  return await Promise.all(taskIds.map((id) => taskService.deleteTask(id)))
}

/**
 * Move multiple tasks to different positions
 */
export const batchMoveTasks = async (moves: { taskId: number; newOrderIndex: number }[]): Promise<TicketTask[]> => {
  // Use Promise.all for better performance
  const results = await Promise.all(
    moves.map(({ taskId, newOrderIndex }) => taskService.moveTaskToPosition(taskId, newOrderIndex))
  )
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
    tasks = tasks.filter((t: TicketTask) => filters.tags!.some((tag) => t.tags.includes(tag)))
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
    throw ErrorFactory.notFound('Task', taskId)
  }

  const result = await taskService.updateTask(taskId, {
    queueId: queueId || null,
    queuePriority: priority || 5,
    queueStatus: 'queued' as const,
    queuedAt: Date.now()
  })
  return result
}

/**
 * Dequeue a task (placeholder)
 */
export const dequeueTask = async (taskId: number) => {
  const result = await taskService.updateTask(taskId, {
    queueId: null,
    queueStatus: null,
    queuedAt: null
  })
  return result
}

/**
 * Get next task from queue
 */
export const getNextTaskFromQueue = async (queueId: number, agentId?: string) => {
  const { queueService } = await import('./queue-service')
  return await queueService.getNextItem(queueId, agentId || 'default-agent')
}

/**
 * Enqueue ticket with all tasks (placeholder)
 */
export const enqueueTicketWithAllTasks = async (ticketId: number, queueId: number, priority: number = 5) => {
  const tasks = await taskService.getTasksByTicket(ticketId)

  // Use Promise.all for better performance
  await Promise.all(tasks.map((task) => enqueueTask(task.id, queueId, priority)))

  return tasks.length
}
