/**
 * Queue Item Service - Functional Factory Pattern
 * Provides CRUD operations for queue items with proper error handling
 * 
 * Uses generated types from database schema and integrates with queueItemRepository
 */

import { createCrudService, extendService, withErrorContext, createServiceLogger, safeErrorFactory } from './core/base-service'
import { queueItemRepository } from '@promptliano/database'
import {
  type QueueItem,
  type InsertQueueItem,
  type CreateQueueItem,
  type UpdateQueueItem,
  type QueueStatus,
  CreateQueueItemSchema,
  QueueItemSchema
} from '@promptliano/database'

// Dependencies interface for dependency injection
export interface QueueItemServiceDeps {
  queueItemRepository?: typeof queueItemRepository
  logger?: ReturnType<typeof createServiceLogger>
}

/**
 * Create Queue Item Service with functional factory pattern
 */
export function createQueueItemService(deps: QueueItemServiceDeps = {}) {
  const {
    queueItemRepository: repo = queueItemRepository,
    logger = createServiceLogger('QueueItemService')
  } = deps

  // Base CRUD operations using createCrudService
  const baseService = createCrudService<QueueItem, CreateQueueItem, UpdateQueueItem>({
    entityName: 'QueueItem',
    repository: repo,
    schema: CreateQueueItemSchema,
    logger
  })

  // Extended queue item operations
  const extensions = {
    /**
     * Get queue items by queue ID
     */
    async getByQueue(queueId: number): Promise<QueueItem[]> {
      return withErrorContext(
        async () => {
          if (!queueId || queueId <= 0) {
            throw safeErrorFactory.invalidInput('queueId', 'valid positive number', queueId)
          }
          return await repo.getByQueue(queueId)
        },
        { entity: 'QueueItem', action: 'getByQueue', queueId }
      )
    },

    /**
     * Get queue items by status
     */
    async getByStatus(status: QueueStatus): Promise<QueueItem[]> {
      return withErrorContext(
        async () => {
          return await repo.getByStatus(status)
        },
        { entity: 'QueueItem', action: 'getByStatus', status }
      )
    },

    /**
     * Get queue items by status within a specific queue
     */
    async getByQueueAndStatus(queueId: number, status: QueueStatus): Promise<QueueItem[]> {
      return withErrorContext(
        async () => {
          if (!queueId || queueId <= 0) {
            throw safeErrorFactory.invalidInput('queueId', 'valid positive number', queueId)
          }
          
          const allQueueItems = await repo.getByQueue(queueId)
          return allQueueItems.filter(item => item.status === status)
        },
        { entity: 'QueueItem', action: 'getByQueueAndStatus', queueId, status }
      )
    },

    /**
     * Update queue item status
     */
    async updateStatus(id: number | string, status: QueueStatus): Promise<QueueItem> {
      return withErrorContext(
        async () => {
          const numericId = typeof id === 'string' ? parseInt(id, 10) : id
          if (isNaN(numericId) || numericId <= 0) {
            throw safeErrorFactory.invalidInput('id', 'valid number', id)
          }

          // Update the status and relevant timestamps
          const updateData: Partial<InsertQueueItem> = {
            status,
            updatedAt: Date.now()
          }

          // Set appropriate timestamps based on status
          if (status === 'in_progress' && !updateData.startedAt) {
            updateData.startedAt = Date.now()
          } else if (['completed', 'failed', 'cancelled'].includes(status) && !updateData.completedAt) {
            updateData.completedAt = Date.now()
            
            // Calculate actual processing time if we have startedAt
            const currentItem = await repo.getById(numericId)
            if (currentItem?.startedAt) {
              updateData.actualProcessingTime = Date.now() - currentItem.startedAt
            }
          }

          const result = await repo.update(numericId, updateData)
          logger.info(`Updated QueueItem status`, { id: numericId, status })
          return result
        },
        { entity: 'QueueItem', action: 'updateStatus', id }
      )
    },

    /**
     * Mark queue item as started
     */
    async markAsStarted(id: number | string, agentId?: string): Promise<QueueItem> {
      return withErrorContext(
        async () => {
          const numericId = typeof id === 'string' ? parseInt(id, 10) : id
          if (isNaN(numericId) || numericId <= 0) {
            throw safeErrorFactory.invalidInput('id', 'valid number', id)
          }

          const updateData: Partial<InsertQueueItem> = {
            status: 'in_progress',
            startedAt: Date.now(),
            updatedAt: Date.now()
          }

          if (agentId) {
            updateData.agentId = agentId
          }

          const result = await repo.update(numericId, updateData)
          logger.info(`Marked QueueItem as started`, { id: numericId, agentId })
          return result
        },
        { entity: 'QueueItem', action: 'markAsStarted', id }
      )
    },

    /**
     * Mark queue item as completed
     */
    async markAsCompleted(id: number | string): Promise<QueueItem> {
      return withErrorContext(
        async () => {
          return await extensions.updateStatus(id, 'completed')
        },
        { entity: 'QueueItem', action: 'markAsCompleted', id }
      )
    },

    /**
     * Mark queue item as failed
     */
    async markAsFailed(id: number | string, errorMessage?: string): Promise<QueueItem> {
      return withErrorContext(
        async () => {
          const numericId = typeof id === 'string' ? parseInt(id, 10) : id
          if (isNaN(numericId) || numericId <= 0) {
            throw safeErrorFactory.invalidInput('id', 'valid number', id)
          }

          const updateData: Partial<InsertQueueItem> = {
            status: 'failed',
            completedAt: Date.now(),
            updatedAt: Date.now()
          }

          if (errorMessage) {
            updateData.errorMessage = errorMessage
          }

          // Calculate actual processing time if we have startedAt
          const currentItem = await repo.getById(numericId)
          if (currentItem?.startedAt) {
            updateData.actualProcessingTime = Date.now() - currentItem.startedAt
          }

          const result = await repo.update(numericId, updateData)
          logger.info(`Marked QueueItem as failed`, { id: numericId, errorMessage })
          return result
        },
        { entity: 'QueueItem', action: 'markAsFailed', id }
      )
    },

    /**
     * Remove queue item (alias for delete)
     */
    async removeItem(id: number | string): Promise<boolean> {
      return withErrorContext(
        async () => {
          return await baseService.delete(id)
        },
        { entity: 'QueueItem', action: 'removeItem', id }
      )
    },

    /**
     * Get queue items with processing time statistics
     */
    async getWithStats(queueId?: number): Promise<Array<QueueItem & {
      isOverdue?: boolean
      estimatedCompletion?: number
    }>> {
      return withErrorContext(
        async () => {
          const items = queueId 
            ? await extensions.getByQueue(queueId)
            : await baseService.getAll()

          const now = Date.now()
          
          return items.map(item => {
            const stats: QueueItem & { isOverdue?: boolean; estimatedCompletion?: number } = { ...item }
            
            // Check if item is overdue (if it has estimated processing time)
            if (item.status === 'in_progress' && item.startedAt && item.estimatedProcessingTime) {
              const expectedCompletion = item.startedAt + item.estimatedProcessingTime
              stats.isOverdue = now > expectedCompletion
              stats.estimatedCompletion = expectedCompletion
            }
            
            return stats
          })
        },
        { entity: 'QueueItem', action: 'getWithStats' }
      )
    }
  }

  return extendService(baseService, extensions)
}

// Export types for consumers
export type QueueItemService = ReturnType<typeof createQueueItemService>

// Export singleton for backward compatibility
export const queueItemService = createQueueItemService()

// Export individual functions for tree-shaking
export const {
  create: createQueueItem,
  getById: getQueueItemById,
  update: updateQueueItem,
  delete: deleteQueueItem,
  list: listQueueItems,
  getByQueue: getQueueItemsByQueue,
  getByStatus: getQueueItemsByStatus,
  updateStatus: updateQueueItemStatus,
  markAsStarted: markQueueItemAsStarted,
  markAsCompleted: markQueueItemAsCompleted,
  markAsFailed: markQueueItemAsFailed,
  removeItem: removeQueueItem
} = queueItemService