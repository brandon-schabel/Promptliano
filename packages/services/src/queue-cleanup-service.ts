import { ApiError } from '@promptliano/shared'
import { queueRepository, db, rawDb } from '@promptliano/database'
import { eq, and, lt, notInArray, sql, count } from 'drizzle-orm'
import { queues, queueItems, tickets, ticketTasks } from '@promptliano/database'

export interface CleanupResult {
  orphanedItemsRemoved: number
  oldCompletedItemsRemoved: number
  invalidTasksRemoved: number
  invalidTicketsRemoved: number
  totalRemoved: number
  errors: string[]
}

/**
 * Clean up orphaned and invalid queue items
 * @param projectId - Optional project ID to limit cleanup scope
 * @param maxAgeMs - Maximum age for completed items (default: 7 days)
 */
export async function cleanupQueueData(
  projectId?: number,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): Promise<CleanupResult> {
  const result: CleanupResult = {
    orphanedItemsRemoved: 0,
    oldCompletedItemsRemoved: 0,
    invalidTasksRemoved: 0,
    invalidTicketsRemoved: 0,
    totalRemoved: 0,
    errors: []
  }

  try {
    const now = Date.now()
    const cutoffTime = now - maxAgeMs

    // Use Drizzle transaction for atomic cleanup
    await db.transaction(async (tx) => {
      // 1. Remove orphaned queue items (queue doesn't exist)
      // First get queue IDs that exist
      const existingQueueIds = await tx.select({ id: queues.id }).from(queues)
      const existingIds = existingQueueIds.map((q) => q.id)

      if (existingIds.length === 0) {
        // No queues exist, delete all queue items
        const orphanedResult = (await tx.delete(queueItems).run()) as unknown as { changes: number }
        result.orphanedItemsRemoved = orphanedResult.changes || 0
      } else {
        // Delete items where queue_id is not in existing queues
        const orphanedResult = (await tx
          .delete(queueItems)
          .where(notInArray(queueItems.queueId, existingIds))
          .run()) as unknown as { changes: number }
        result.orphanedItemsRemoved = orphanedResult.changes || 0
      }

      // 2. Remove old completed items
      let oldCompletedConditions = and(
        sql`${queueItems.status} IN ('completed', 'failed', 'cancelled', 'timeout')`,
        lt(queueItems.createdAt, cutoffTime)
      )

      if (projectId) {
        // Get queue IDs for this project
        const projectQueueIds = await tx.select({ id: queues.id }).from(queues).where(eq(queues.projectId, projectId))
        const projectQueueIdList = projectQueueIds.map((q) => q.id)

        if (projectQueueIdList.length > 0) {
          oldCompletedConditions = and(
            oldCompletedConditions!,
            sql`${queueItems.queueId} IN (${sql.join(projectQueueIdList, sql`, `)})`
          )
        } else {
          // No queues for this project, skip deletion
          result.oldCompletedItemsRemoved = 0
          return
        }
      }

      const oldCompletedResult = (await tx.delete(queueItems).where(oldCompletedConditions!).run()) as unknown as {
        changes: number
      }
      result.oldCompletedItemsRemoved = oldCompletedResult.changes || 0

      // 3. Remove items with invalid task IDs
      // First get all valid task IDs
      const validTaskIds = await tx.select({ id: ticketTasks.id }).from(ticketTasks)
      const validTaskIdList = validTaskIds.map((t) => t.id)

      let invalidTasksResult
      if (validTaskIdList.length === 0) {
        // No valid tasks exist, delete all items with itemType = 'task'
        invalidTasksResult = (await tx.delete(queueItems).where(eq(queueItems.itemType, 'task')).run()) as unknown as {
          changes: number
        }
      } else {
        // Delete items with invalid task IDs (where itemType is 'task' but itemId not in valid tasks)
        invalidTasksResult = (await tx
          .delete(queueItems)
          .where(and(eq(queueItems.itemType, 'task'), notInArray(queueItems.itemId, validTaskIdList)))
          .run()) as unknown as { changes: number }
      }
      result.invalidTasksRemoved = invalidTasksResult.changes || 0

      // 4. Remove items with invalid ticket IDs
      // First get all valid ticket IDs
      const validTicketIds = await tx.select({ id: tickets.id }).from(tickets)
      const validTicketIdList = validTicketIds.map((t) => t.id)

      let invalidTicketsResult
      if (validTicketIdList.length === 0) {
        // No valid tickets exist, delete all items with itemType = 'ticket'
        invalidTicketsResult = (await tx
          .delete(queueItems)
          .where(eq(queueItems.itemType, 'ticket'))
          .run()) as unknown as { changes: number }
      } else {
        // Delete items with invalid ticket IDs (where itemType is 'ticket' but itemId not in valid tickets)
        invalidTicketsResult = (await tx
          .delete(queueItems)
          .where(and(eq(queueItems.itemType, 'ticket'), notInArray(queueItems.itemId, validTicketIdList)))
          .run()) as unknown as { changes: number }
      }
      result.invalidTicketsRemoved = invalidTicketsResult.changes || 0

      // 5. Update queue statistics after cleanup
      if (projectId) {
        // Get all queues for this project
        const projectQueues = await tx.select({ id: queues.id }).from(queues).where(eq(queues.projectId, projectId))

        // Update statistics for each queue
        for (const queue of projectQueues) {
          // Calculate statistics using Drizzle aggregation
          const stats = await tx
            .select({
              completedItems: count(sql`CASE WHEN ${queueItems.status} = 'completed' THEN 1 END`),
              avgProcessingTime: sql`AVG(CASE 
              WHEN ${queueItems.status} = 'completed' AND ${queueItems.actualProcessingTime} IS NOT NULL 
              THEN ${queueItems.actualProcessingTime} 
              ELSE NULL 
            END)`.as('avg_processing_time')
            })
            .from(queueItems)
            .where(eq(queueItems.queueId, queue.id))

          const stat = stats[0]
          if (stat) {
            // Update queue statistics (only updatedAt since averageProcessingTime/totalCompletedItems don't exist in schema)
            await tx
              .update(queues)
              .set({
                updatedAt: Date.now()
              })
              .where(eq(queues.id, queue.id))
          }
        }
      }
    })

    result.totalRemoved =
      result.orphanedItemsRemoved +
      result.oldCompletedItemsRemoved +
      result.invalidTasksRemoved +
      result.invalidTicketsRemoved

    console.log('[Queue Cleanup] Cleanup completed:', result)
  } catch (error) {
    console.error('[Queue Cleanup] Error during cleanup:', error)
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

/**
 * Reset a queue by removing all its items
 * @param queueId - The queue to reset
 */
export async function resetQueue(queueId: number): Promise<number> {
  try {
    // Use Drizzle transaction for atomic reset
    return await db.transaction(async (tx) => {
      // Verify queue exists
      const queue = await tx.select({ id: queues.id }).from(queues).where(eq(queues.id, queueId)).limit(1)

      if (queue.length === 0) {
        throw new ApiError(404, `Queue ${queueId} not found`, 'QUEUE_NOT_FOUND')
      }

      // Delete all items in the queue
      const result = (await tx.delete(queueItems).where(eq(queueItems.queueId, queueId)).run()) as unknown as {
        changes: number
      }

      // Reset queue statistics (only updatedAt since averageProcessingTime/totalCompletedItems don't exist in schema)
      await tx
        .update(queues)
        .set({
          updatedAt: Date.now()
        })
        .where(eq(queues.id, queueId))

      const removedCount = result.changes || 0
      console.log(`[Queue Cleanup] Reset queue ${queueId}, removed ${removedCount} items`)
      return removedCount
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(`[Queue Cleanup] Error resetting queue ${queueId}:`, error)
    throw new ApiError(500, 'Failed to reset queue', 'QUEUE_RESET_ERROR')
  }
}

/**
 * Move failed items to dead letter queue
 * @param queueId - Optional queue ID to limit scope
 */
export async function moveFailedToDeadLetter(queueId?: number): Promise<number> {
  try {
    let movedCount = 0

    // Build conditions for failed items
    // Note: Schema doesn't have retryCount/maxRetries, so we'll just move all failed items
    const conditions = [eq(queueItems.status, 'failed')]

    if (queueId) {
      conditions.push(eq(queueItems.queueId, queueId))
    }

    // Get failed items that need to be moved
    const failedItems = await db
      .select()
      .from(queueItems)
      .where(and(...conditions))

    if (failedItems.length === 0) {
      console.log('[Queue Cleanup] No failed items to move to dead letter queue')
      return 0
    }

    // Note: Since dead letter queue table doesn't exist in schema,
    // we'll log these items instead and delete them
    // In a real implementation, you'd create a dead_letter table first

    console.warn('[Queue Cleanup] Dead letter queue table not found in schema.')
    console.warn('[Queue Cleanup] Failed items will be logged and deleted:')

    for (const item of failedItems) {
      console.warn(
        `[Queue Cleanup] Dead letter item: ${JSON.stringify({
          originalQueueId: item.queueId,
          originalItemId: item.id,
          itemType: item.itemType,
          itemId: item.itemId,
          finalStatus: item.status,
          errorMessage: item.errorMessage,
          agentId: item.agentId,
          originalCreatedAt: item.createdAt
        })}`
      )
    }

    // Delete the failed items since we can't move them to dead letter
    const result = (await db
      .delete(queueItems)
      .where(and(...conditions))
      .run()) as unknown as { changes: number }

    movedCount = result.changes || 0

    console.log(`[Queue Cleanup] Removed ${movedCount} failed items (dead letter queue not implemented)`)
    return movedCount
  } catch (error) {
    console.error('[Queue Cleanup] Error moving items to dead letter queue:', error)
    throw new ApiError(500, 'Failed to move items to dead letter queue', 'DEAD_LETTER_ERROR')
  }
}

/**
 * Get queue health status
 */
export async function getQueueHealth(projectId: number): Promise<{
  healthy: boolean
  issues: string[]
  stats: {
    totalQueues: number
    activeQueues: number
    totalItems: number
    orphanedItems: number
    stuckItems: number
  }
}> {
  const issues: string[] = []

  try {
    // Get queue stats using queueRepository instead of queueStorage
    const projectQueues = await queueRepository.getByProject(projectId)
    const activeQueues = projectQueues.filter((q) => q.isActive)

    // Get project queue IDs
    const projectQueueIds = projectQueues.map((q) => q.id)

    // Count total items in project queues
    let totalItemsCount = 0
    if (projectQueueIds.length > 0) {
      const totalItemsResult = await db
        .select({ count: count() })
        .from(queueItems)
        .where(sql`${queueItems.queueId} IN (${sql.join(projectQueueIds, sql`, `)})`)
      totalItemsCount = totalItemsResult[0]?.count || 0
    }

    // Count orphaned items (items pointing to non-existent queues)
    const allQueueIds = await db.select({ id: queues.id }).from(queues)
    const allQueueIdList = allQueueIds.map((q) => q.id)

    let orphanedItemsCount = 0
    if (allQueueIdList.length === 0) {
      // No queues exist, all items are orphaned
      const orphanedResult = await db.select({ count: count() }).from(queueItems)
      orphanedItemsCount = orphanedResult[0]?.count || 0
    } else {
      // Count items with queue_id not in existing queues
      const orphanedResult = await db
        .select({ count: count() })
        .from(queueItems)
        .where(notInArray(queueItems.queueId, allQueueIdList))
      orphanedItemsCount = orphanedResult[0]?.count || 0
    }

    // Count stuck items (in_progress for > 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const stuckResult = await db
      .select({ count: count() })
      .from(queueItems)
      .where(
        and(
          eq(queueItems.status, 'in_progress'),
          sql`${queueItems.startedAt} IS NOT NULL`,
          lt(queueItems.startedAt, oneHourAgo)
        )
      )

    const stats = {
      totalQueues: projectQueues.length,
      activeQueues: activeQueues.length,
      totalItems: totalItemsCount,
      orphanedItems: orphanedItemsCount,
      stuckItems: stuckResult[0]?.count || 0
    }

    // Check for issues
    if (stats.orphanedItems > 0) {
      issues.push(`${stats.orphanedItems} orphaned queue items found`)
    }
    if (stats.stuckItems > 0) {
      issues.push(`${stats.stuckItems} items stuck in processing`)
    }
    if (stats.totalQueues === 0) {
      issues.push('No queues exist for this project')
    }
    if (stats.activeQueues === 0 && stats.totalQueues > 0) {
      issues.push('All queues are paused or inactive')
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    }
  } catch (error) {
    console.error('[Queue Health] Error checking queue health:', error)
    issues.push('Failed to check queue health')
    return {
      healthy: false,
      issues,
      stats: {
        totalQueues: 0,
        activeQueues: 0,
        totalItems: 0,
        orphanedItems: 0,
        stuckItems: 0
      }
    }
  }
}
