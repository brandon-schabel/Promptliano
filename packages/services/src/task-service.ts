/**
 * Task Service - Business logic layer for ticket task management
 * Functional factory pattern for task operations with dependency injection
 * Provides consistent TaskStatus type handling and business rules
 */

import { taskRepository } from '@promptliano/database'
import { ErrorFactory } from '@promptliano/shared'
import { 
  type TicketTask, 
  type InsertTicketTask, 
  type TaskStatus 
} from '@promptliano/database/schema'

// Export types for external use
export type { TicketTask, InsertTicketTask, TaskStatus }

export interface TaskServiceDependencies {
  repository?: typeof taskRepository
  errorFactory?: typeof ErrorFactory
}

/**
 * Creates a task service with dependency injection
 */
export function createTaskService(deps: TaskServiceDependencies = {}) {
  const repository = deps.repository || taskRepository
  const createError = deps.errorFactory || ErrorFactory.createDomainError

  return {
    /**
     * Create a new task with proper TaskStatus handling
     */
    async createTask(data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketTask> {
      try {
        // Ensure status is properly typed as TaskStatus, not string
        const taskData = {
          ...data,
          status: (data.status || 'pending') as TaskStatus
        }

        return await repository.create(taskData)
      } catch (error) {
        throw createError('Task', 'CREATE_FAILED', `Failed to create task: ${error}`)
      }
    },

    /**
     * Update task with proper status type handling
     */
    async updateTask(id: number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>): Promise<TicketTask> {
      try {
        // Ensure status is properly typed if provided
        const updateData = data.status 
          ? { ...data, status: data.status as TaskStatus }
          : data

        return await repository.update(id, updateData)
      } catch (error) {
        throw createError('Task', 'UPDATE_FAILED', `Failed to update task ${id}: ${error}`)
      }
    },

    /**
     * Update task status with type safety
     */
    async updateTaskStatus(id: number, status: TaskStatus): Promise<TicketTask> {
      try {
        return await repository.update(id, { status })
      } catch (error) {
        throw createError('Task', 'UPDATE_STATUS_FAILED', `Failed to update task ${id} status: ${error}`)
      }
    },

    /**
     * Get task by ID
     */
    async getTaskById(id: number): Promise<TicketTask | null> {
      try {
        return await repository.getById(id)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch task ${id}: ${error}`)
      }
    },

    /**
     * Get tasks by ticket ID
     */
    async getTasksByTicket(ticketId: number): Promise<TicketTask[]> {
      try {
        return await repository.getByTicket(ticketId)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch tasks for ticket ${ticketId}: ${error}`)
      }
    },

    /**
     * Get tasks by status with proper TaskStatus type
     */
    async getTasksByStatus(ticketId: number, status: TaskStatus): Promise<TicketTask[]> {
      try {
        return await repository.getByTaskStatus(ticketId, status)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch ${status} tasks for ticket ${ticketId}: ${error}`)
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
        return await repository.update(id, { 
          status: 'completed' as TaskStatus,
          done: true
        })
      } catch (error) {
        throw createError('Task', 'COMPLETE_FAILED', `Failed to complete task ${id}: ${error}`)
      }
    },

    /**
     * Cancel a task
     */
    async cancelTask(id: number): Promise<TicketTask> {
      return this.updateTaskStatus(id, 'cancelled')
    },

    /**
     * Delete a task
     */
    async deleteTask(id: number): Promise<boolean> {
      try {
        return await repository.delete(id)
      } catch (error) {
        throw createError('Task', 'DELETE_FAILED', `Failed to delete task ${id}: ${error}`)
      }
    },

    /**
     * Get tasks by agent with proper type handling
     */
    async getTasksByAgent(agentId: string): Promise<TicketTask[]> {
      try {
        return await repository.getByAgent(agentId)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch tasks for agent ${agentId}: ${error}`)
      }
    },

    /**
     * Toggle task completion (legacy method with status sync)
     */
    async toggleTaskCompletion(id: number): Promise<TicketTask> {
      try {
        const task = await repository.getById(id)
        if (!task) {
          throw createError('Task', 'NOT_FOUND', `Task ${id} not found`)
        }

        // Sync done flag with status
        const newStatus: TaskStatus = task.done ? 'pending' : 'completed'
        return await repository.update(id, {
          done: !task.done,
          status: newStatus
        })
      } catch (error) {
        if (error.code) throw error // Re-throw domain errors
        throw createError('Task', 'TOGGLE_FAILED', `Failed to toggle task ${id}: ${error}`)
      }
    },

    /**
     * Create multiple tasks with proper type handling
     */
    async createTasks(tasksData: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TicketTask[]> {
      try {
        // Ensure all tasks have properly typed status
        const typedTasksData = tasksData.map(data => ({
          ...data,
          status: (data.status || 'pending') as TaskStatus
        }))

        return await repository.createMany(typedTasksData)
      } catch (error) {
        throw createError('Task', 'BATCH_CREATE_FAILED', `Failed to create ${tasksData.length} tasks: ${error}`)
      }
    },

    /**
     * Get task statistics with status breakdown
     */
    async getTaskStatistics(ticketId: number) {
      try {
        const tasks = await repository.getByTicket(ticketId)
        
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
      } catch (error) {
        throw createError('Task', 'STATS_FAILED', `Failed to get statistics for ticket ${ticketId}: ${error}`)
      }
    },

    /**
     * Reorder tasks within a ticket
     */
    async reorderTasks(ticketId: number, taskOrders: { taskId: number; orderIndex: number }[]): Promise<void> {
      try {
        return await repository.reorder(ticketId, taskOrders)
      } catch (error) {
        throw createError('Task', 'REORDER_FAILED', `Failed to reorder tasks for ticket ${ticketId}: ${error}`)
      }
    },

    /**
     * Move task to different position
     */
    async moveTaskToPosition(taskId: number, newOrderIndex: number): Promise<TicketTask> {
      try {
        return await repository.moveToPosition(taskId, newOrderIndex)
      } catch (error) {
        throw createError('Task', 'MOVE_FAILED', `Failed to move task ${taskId}: ${error}`)
      }
    },

    /**
     * Check if task dependencies are completed
     */
    async areDependenciesCompleted(taskId: number): Promise<boolean> {
      try {
        return await repository.areDependenciesCompleted(taskId)
      } catch (error) {
        throw createError('Task', 'DEPENDENCY_CHECK_FAILED', `Failed to check dependencies for task ${taskId}: ${error}`)
      }
    },

    /**
     * Get available tasks (no incomplete dependencies)
     */
    async getAvailableTasks(ticketId: number): Promise<TicketTask[]> {
      try {
        return await repository.getAvailableTasks(ticketId)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch available tasks for ticket ${ticketId}: ${error}`)
      }
    },

    /**
     * Get blocked tasks (have incomplete dependencies)
     */
    async getBlockedTasks(ticketId: number): Promise<TicketTask[]> {
      try {
        return await repository.getBlockedTasks(ticketId)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch blocked tasks for ticket ${ticketId}: ${error}`)
      }
    },

    /**
     * Search tasks by content
     */
    async searchTasks(searchTerm: string, ticketId?: number): Promise<TicketTask[]> {
      try {
        return await repository.searchByContent(searchTerm, ticketId)
      } catch (error) {
        throw createError('Task', 'SEARCH_FAILED', `Failed to search tasks: ${error}`)
      }
    },

    /**
     * Get tasks by time range
     */
    async getTasksByTimeRange(startDate: number, endDate: number): Promise<TicketTask[]> {
      try {
        return await repository.getByTimeRange(startDate, endDate)
      } catch (error) {
        throw createError('Task', 'FETCH_FAILED', `Failed to fetch tasks by time range: ${error}`)
      }
    },

    /**
     * Delete all tasks for a ticket
     */
    async deleteTasksByTicket(ticketId: number): Promise<number> {
      try {
        return await repository.deleteByTicket(ticketId)
      } catch (error) {
        throw createError('Task', 'BATCH_DELETE_FAILED', `Failed to delete tasks for ticket ${ticketId}: ${error}`)
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
  
  // Use Promise.all for better performance
  const tasks = await Promise.all(
    ticketIds.map(async ticketId => ({
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
export const batchUpdateTasks = async (updates: { id: number; data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>> }[]): Promise<TicketTask[]> => {
  // Use Promise.all for better performance
  return await Promise.all(
    updates.map(({ id, data }) => taskService.updateTask(id, data))
  )
}

/**
 * Delete multiple tasks in batch
 */
export const batchDeleteTasks = async (taskIds: number[]): Promise<boolean[]> => {
  // Use Promise.all for better performance
  return await Promise.all(
    taskIds.map(id => taskService.deleteTask(id))
  )
}

/**
 * Move multiple tasks to different positions
 */
export const batchMoveTasks = async (moves: { taskId: number; newOrderIndex: number }[]): Promise<TicketTask[]> => {
  // Use Promise.all for better performance
  return await Promise.all(
    moves.map(({ taskId, newOrderIndex }) => taskService.moveTaskToPosition(taskId, newOrderIndex))
  )
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
  
  // Use Promise.all for better performance
  await Promise.all(
    tasks.map(task => enqueueTask(task.id, queueId, priority))
  )
  
  return tasks.length
}