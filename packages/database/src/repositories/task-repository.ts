/**
 * Task Repository - Dedicated repository for ticket tasks
 * Provides advanced task management with dependencies and ordering
 */

import { eq, ne, and, desc, asc, inArray, count, sum, gte, lte, like } from 'drizzle-orm'
import { db } from '../db'
import { 
  ticketTasks,
  type TicketTask,
  type InsertTicketTask,
  type TaskStatus
} from '../schema'

export const taskRepository = {
  /**
   * Create a new task
   */
  async create(data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketTask> {
    const now = Date.now()
    
    // Auto-assign order index if not provided
    if (data.orderIndex === undefined) {
      const [maxOrder] = await db.select({ max: count() })
        .from(ticketTasks)
        .where(eq(ticketTasks.ticketId, data.ticketId))
      
      data.orderIndex = (maxOrder?.max ?? 0)
    }

    const [task] = await db.insert(ticketTasks).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    
    if (!task) {
      throw new Error('Failed to create task')
    }
    
    return task
  },

  /**
   * Get task by ID
   */
  async getById(id: number): Promise<TicketTask | null> {
    const [task] = await db.select()
      .from(ticketTasks)
      .where(eq(ticketTasks.id, id))
      .limit(1)
    return task ?? null
  },

  /**
   * Get all tasks for a ticket
   */
  async getByTicket(ticketId: number): Promise<TicketTask[]> {
    return db.select()
      .from(ticketTasks)
      .where(eq(ticketTasks.ticketId, ticketId))
      .orderBy(asc(ticketTasks.orderIndex))
  },

  /**
   * Get tasks by completion status (legacy - use getByTaskStatus instead)
   */
  async getByStatus(ticketId: number, done: boolean): Promise<TicketTask[]> {
    return db.select()
      .from(ticketTasks)
      .where(and(
        eq(ticketTasks.ticketId, ticketId),
        eq(ticketTasks.done, done)
      ))
      .orderBy(asc(ticketTasks.orderIndex))
  },

  /**
   * Get tasks by status using TaskStatus enum
   */
  async getByTaskStatus(ticketId: number, status: TaskStatus): Promise<TicketTask[]> {
    return db.select()
      .from(ticketTasks)
      .where(and(
        eq(ticketTasks.ticketId, ticketId),
        eq(ticketTasks.status, status)
      ))
      .orderBy(asc(ticketTasks.orderIndex))
  },

  /**
   * Get tasks assigned to a specific agent
   */
  async getByAgent(agentId: string): Promise<TicketTask[]> {
    return db.select()
      .from(ticketTasks)
      .where(eq(ticketTasks.agentId, agentId))
      .orderBy(desc(ticketTasks.createdAt))
  },

  /**
   * Update task
   */
  async update(id: number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>): Promise<TicketTask> {
    const [updated] = await db.update(ticketTasks)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(ticketTasks.id, id))
      .returning()
    
    if (!updated) {
      throw new Error(`Task ${id} not found or failed to update`)
    }
    
    return updated
  },

  /**
   * Delete task
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(ticketTasks)
      .where(eq(ticketTasks.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  /**
   * Toggle task completion
   */
  async toggleCompletion(id: number): Promise<TicketTask> {
    const task = await this.getById(id)
    if (!task) {
      throw new Error(`Task ${id} not found`)
    }

    const [updated] = await db.update(ticketTasks)
      .set({
        done: !task.done,
        updatedAt: Date.now()
      })
      .where(eq(ticketTasks.id, id))
      .returning()
    
    if (!updated) {
      throw new Error(`Failed to update task ${id}`)
    }
    
    return updated
  },

  /**
   * Mark multiple tasks as completed
   */
  async completeMany(taskIds: number[]): Promise<TicketTask[]> {
    if (taskIds.length === 0) return []
    
    return db.update(ticketTasks)
      .set({
        done: true,
        updatedAt: Date.now()
      })
      .where(inArray(ticketTasks.id, taskIds))
      .returning()
  },

  /**
   * Reorder tasks within a ticket
   */
  async reorder(ticketId: number, taskOrders: { taskId: number; orderIndex: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const { taskId, orderIndex } of taskOrders) {
        await tx.update(ticketTasks)
          .set({ 
            orderIndex,
            updatedAt: Date.now() 
          })
          .where(and(
            eq(ticketTasks.id, taskId),
            eq(ticketTasks.ticketId, ticketId)
          ))
      }
    })
  },

  /**
   * Move task to a different position
   */
  async moveToPosition(taskId: number, newOrderIndex: number): Promise<TicketTask> {
    const task = await this.getById(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // Get all tasks in the same ticket to reorder them
    const allTasks = await this.getByTicket(task.ticketId)
    
    await db.transaction(async (tx) => {
      // Remove the task from its current position
      const tasksToReorder = allTasks
        .filter(t => t.id !== taskId)
        .map((t, index) => ({
          id: t.id,
          orderIndex: index >= newOrderIndex ? index + 1 : index
        }))

      // Update all other tasks
      for (const { id, orderIndex } of tasksToReorder) {
        await tx.update(ticketTasks)
          .set({ orderIndex, updatedAt: Date.now() })
          .where(eq(ticketTasks.id, id))
      }

      // Update the moved task
      await tx.update(ticketTasks)
        .set({ 
          orderIndex: newOrderIndex,
          updatedAt: Date.now() 
        })
        .where(eq(ticketTasks.id, taskId))
    })

    return this.getById(taskId) as Promise<TicketTask>
  },

  /**
   * Get task statistics for a ticket
   */
  async getTicketStats(ticketId: number) {
    // Get all tasks for the ticket
    const allTasks = await this.getByTicket(ticketId)
    
    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter(task => task.done).length
    const pendingTasks = allTasks.filter(task => !task.done).length
    const totalHours = allTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0)

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      totalHours,
      completionPercentage: totalTasks > 0 ? 
        Math.round((completedTasks / totalTasks) * 100) : 0
    }
  },

  /**
   * Get tasks with dependencies
   */
  async getTasksWithDependencies(ticketId: number): Promise<TicketTask[]> {
    const allTasks = await db.select()
      .from(ticketTasks)
      .where(eq(ticketTasks.ticketId, ticketId))
      .orderBy(asc(ticketTasks.orderIndex))
    
    // Filter tasks that have dependencies (non-empty array)
    return allTasks.filter(task => task.dependencies && task.dependencies.length > 0)
  },

  /**
   * Check if task dependencies are completed
   */
  async areDependenciesCompleted(taskId: number): Promise<boolean> {
    const task = await this.getById(taskId)
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return true
    }

    const dependentTasks = await db.select({ done: ticketTasks.done })
      .from(ticketTasks)
      .where(inArray(ticketTasks.id, task.dependencies))

    const completedCount = dependentTasks.filter(t => t.done).length
    const totalCount = dependentTasks.length

    return completedCount === totalCount
  },

  /**
   * Get tasks that are blocked by dependencies
   */
  async getBlockedTasks(ticketId: number): Promise<TicketTask[]> {
    const allTasks = await this.getByTicket(ticketId)
    const blockedTasks: TicketTask[] = []

    for (const task of allTasks) {
      if (task.dependencies && task.dependencies.length > 0 && !task.done) {
        const dependenciesCompleted = await this.areDependenciesCompleted(task.id)
        if (!dependenciesCompleted) {
          blockedTasks.push(task)
        }
      }
    }

    return blockedTasks
  },

  /**
   * Get next available tasks (no incomplete dependencies)
   */
  async getAvailableTasks(ticketId: number): Promise<TicketTask[]> {
    const allTasks = await this.getByTicket(ticketId)
    const availableTasks: TicketTask[] = []

    for (const task of allTasks) {
      if (!task.done) {
        const dependenciesCompleted = await this.areDependenciesCompleted(task.id)
        if (dependenciesCompleted) {
          availableTasks.push(task)
        }
      }
    }

    return availableTasks.sort((a, b) => a.orderIndex - b.orderIndex)
  },

  /**
   * Create multiple tasks in a single transaction
   */
  async createMany(tasksData: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TicketTask[]> {
    const now = Date.now()
    
    // Auto-assign order indexes
    const tasksWithOrder = tasksData.map((data, index) => ({
      ...data,
      orderIndex: data.orderIndex ?? index,
      createdAt: now,
      updatedAt: now
    }))

    return db.insert(ticketTasks).values(tasksWithOrder).returning()
  },

  /**
   * Delete all tasks for a ticket
   */
  async deleteByTicket(ticketId: number): Promise<number> {
    const result = await db.delete(ticketTasks)
      .where(eq(ticketTasks.ticketId, ticketId))
      .run() as unknown as { changes: number }
    return result.changes
  },

  /**
   * Search tasks by content
   */
  async searchByContent(searchTerm: string, ticketId?: number): Promise<TicketTask[]> {
    const whereCondition = ticketId 
      ? and(
          like(ticketTasks.content, `%${searchTerm}%`),
          eq(ticketTasks.ticketId, ticketId)
        )
      : like(ticketTasks.content, `%${searchTerm}%`)

    return db.select()
      .from(ticketTasks)
      .where(whereCondition)
      .orderBy(desc(ticketTasks.createdAt))
  },

  /**
   * Get tasks by time range
   */
  async getByTimeRange(startDate: number, endDate: number): Promise<TicketTask[]> {
    return db.select()
      .from(ticketTasks)
      .where(and(
        gte(ticketTasks.createdAt, startDate),
        lte(ticketTasks.createdAt, endDate)
      ))
      .orderBy(desc(ticketTasks.createdAt))
  }
}