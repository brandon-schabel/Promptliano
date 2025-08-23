/**
 * Queue Repository - New unified queue management
 * Replaces fragmented queue handling with centralized system
 */

import { eq, and, desc, asc, count, sum, sql } from 'drizzle-orm'
import { db } from '../db'
import { 
  queues, 
  queueItems, 
  type Queue, 
  type QueueItem,
  type InsertQueue, 
  type InsertQueueItem,
  type QueueWithItems,
  type QueueStatus,
  type ItemType
} from '../schema'

export const queueRepository = {
  // =============================================================================
  // QUEUE OPERATIONS
  // =============================================================================

  /**
   * Create a new queue
   */
  async create(data: Omit<InsertQueue, 'id' | 'createdAt' | 'updatedAt'>): Promise<Queue> {
    const now = Date.now()
    const result = await db.insert(queues).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create queue')
    }
    
    return result[0]
  },

  /**
   * Get queue by ID
   */
  async getById(id: number): Promise<Queue | null> {
    const [queue] = await db.select()
      .from(queues)
      .where(eq(queues.id, id))
      .limit(1)
    return queue ?? null
  },

  /**
   * Get queues by project ID
   */
  async getByProject(projectId: number): Promise<Queue[]> {
    return db.select()
      .from(queues)
      .where(eq(queues.projectId, projectId))
      .orderBy(desc(queues.updatedAt))
  },

  /**
   * Update queue
   */
  async update(id: number, data: Partial<Omit<InsertQueue, 'id' | 'createdAt'>>): Promise<Queue> {
    const result = await db.update(queues)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(queues.id, id))
      .returning()
    
    if (!result[0]) {
      throw new Error(`Queue with id ${id} not found`)
    }
    
    return result[0]
  },

  /**
   * Delete queue and all items (cascade)
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(queues)
      .where(eq(queues.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  /**
   * Get queue with all items
   */
  async getWithItems(id: number): Promise<QueueWithItems | null> {
    return db.query.queues.findFirst({
      where: eq(queues.id, id),
      with: {
        items: {
          orderBy: [asc(queueItems.priority), asc(queueItems.createdAt)]
        }
      }
    }) as Promise<QueueWithItems | null>
  },

  // =============================================================================
  // QUEUE ITEM OPERATIONS
  // =============================================================================

  /**
   * Add item to queue
   */
  async addItem(data: Omit<InsertQueueItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<QueueItem> {
    const now = Date.now()
    const result = await db.insert(queueItems).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create queue item')
    }
    
    return result[0]
  },

  /**
   * Get queue item by ID
   */
  async getItemById(id: number): Promise<QueueItem | null> {
    const [item] = await db.select()
      .from(queueItems)
      .where(eq(queueItems.id, id))
      .limit(1)
    return item ?? null
  },

  /**
   * Get items by queue ID
   */
  async getItems(queueId: number): Promise<QueueItem[]> {
    return db.select()
      .from(queueItems)
      .where(eq(queueItems.queueId, queueId))
      .orderBy(asc(queueItems.priority), asc(queueItems.createdAt))
  },

  /**
   * Get items by status
   */
  async getItemsByStatus(queueId: number, status: QueueStatus): Promise<QueueItem[]> {
    return db.select()
      .from(queueItems)
      .where(and(
        eq(queueItems.queueId, queueId),
        eq(queueItems.status, status)
      ))
      .orderBy(asc(queueItems.priority), asc(queueItems.createdAt))
  },

  /**
   * Get next item to process
   */
  async getNextItem(queueId: number): Promise<QueueItem | null> {
    const [item] = await db.select()
      .from(queueItems)
      .where(and(
        eq(queueItems.queueId, queueId),
        eq(queueItems.status, 'queued')
      ))
      .orderBy(asc(queueItems.priority), asc(queueItems.createdAt))
      .limit(1)
    return item ?? null
  },

  /**
   * Update queue item
   */
  async updateItem(id: number, data: Partial<Omit<InsertQueueItem, 'id' | 'createdAt'>>): Promise<QueueItem> {
    const result = await db.update(queueItems)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(queueItems.id, id))
      .returning()
    
    if (!result[0]) {
      throw new Error(`Queue item with id ${id} not found`)
    }
    
    return result[0]
  },

  /**
   * Update item status
   */
  async updateItemStatus(
    id: number, 
    status: QueueStatus,
    agentId?: string,
    errorMessage?: string
  ): Promise<QueueItem> {
    const now = Date.now()
    const updates: any = {
      status,
      updatedAt: now
    }

    if (status === 'in_progress') {
      updates.startedAt = now
      if (agentId) updates.agentId = agentId
    } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = now
      if (errorMessage) updates.errorMessage = errorMessage
    }

    const result = await db.update(queueItems)
      .set(updates)
      .where(eq(queueItems.id, id))
      .returning()
    
    if (!result[0]) {
      throw new Error(`Queue item with id ${id} not found`)
    }
    
    return result[0]
  },

  /**
   * Remove item from queue
   */
  async removeItem(id: number): Promise<boolean> {
    const result = await db.delete(queueItems)
      .where(eq(queueItems.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  // =============================================================================
  // QUEUE ANALYTICS & STATISTICS
  // =============================================================================

  /**
   * Get queue statistics
   */
  async getQueueStats(queueId: number) {
    const [stats] = await db.select({
      totalItems: count(),
      queuedItems: sum(sql`CASE WHEN ${queueItems.status} = 'queued' THEN 1 ELSE 0 END`),
      inProgressItems: sum(sql`CASE WHEN ${queueItems.status} = 'in_progress' THEN 1 ELSE 0 END`),
      completedItems: sum(sql`CASE WHEN ${queueItems.status} = 'completed' THEN 1 ELSE 0 END`),
      failedItems: sum(sql`CASE WHEN ${queueItems.status} = 'failed' THEN 1 ELSE 0 END`)
    })
      .from(queueItems)
      .where(eq(queueItems.queueId, queueId))

    return stats
  },

  /**
   * Get active queues with item counts
   */
  async getActiveQueuesWithCounts(projectId: number) {
    // This would typically be done with a JOIN and GROUP BY
    // For now, we'll do it in two queries for simplicity
    const activeQueues = await db.select()
      .from(queues)
      .where(and(
        eq(queues.projectId, projectId),
        eq(queues.isActive, true)
      ))

    const queuesWithCounts = await Promise.all(
      activeQueues.map(async (queue) => {
        const stats = await this.getQueueStats(queue.id)
        return {
          ...queue,
          ...stats
        }
      })
    )

    return queuesWithCounts
  }
}