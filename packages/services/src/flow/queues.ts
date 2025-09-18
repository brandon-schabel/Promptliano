import { withErrorContext } from '../core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { eq, and, isNull } from 'drizzle-orm'
import { tickets, ticketTasks, type QueueItem } from '@promptliano/database'
import type { FlowRuntimeContext, FlowData, FlowItem, FlowTicket, FlowTask } from './types'
import type { TaskModule } from './tasks'
import type { HelperModule } from './helpers'
import type { ProcessorModule } from './processors'

interface QueueModuleDeps {
  tasks: TaskModule
  helpers: HelperModule
  processor: ProcessorModule
}

export function createQueueModule(ctx: FlowRuntimeContext, deps: QueueModuleDeps) {
  const {
    ticketRepo,
    taskRepo,
    queueRepo,
    logger,
    transformTicket,
    transformTicketForCompat,
    transformTask,
    transformTaskForCompat
  } = ctx
  const { helpers, tasks, processor } = deps

  const enqueueTicket = (ticketId: number, queueId: number, priority = 0) =>
    withErrorContext(
      async () => {
        const queue = await queueRepo.getById(queueId)
        if (!queue) {
          throw ErrorFactory.notFound('Queue', queueId)
        }

        const ticket = await ticketRepo.addToQueue(ticketId, queueId, priority)
        await queueRepo.addItem({
          queueId,
          itemType: 'ticket',
          itemId: ticketId,
          priority,
          status: 'queued',
          agentId: null
        })

        logger.info('Enqueued ticket', { ticketId, queueId, priority })
        return transformTicket(ticket)
      },
      { entity: 'Ticket', action: 'enqueue', id: ticketId }
    )

  const enqueueTask = (taskId: number, queueId: number, priority = 0) =>
    withErrorContext(
      async () => {
        const queue = await queueRepo.getById(queueId)
        if (!queue) {
          throw ErrorFactory.notFound('Queue', queueId)
        }

        const task = await ticketRepo.updateTask(taskId, {
          queueId,
          queueStatus: 'queued',
          queuePriority: priority,
          queuedAt: Date.now()
        })

        await queueRepo.addItem({
          queueId,
          itemType: 'task',
          itemId: taskId,
          priority,
          status: 'queued',
          agentId: null
        })

        logger.info('Enqueued task', { taskId, queueId, priority })
        return transformTask(task)
      },
      { entity: 'Task', action: 'enqueue', id: taskId }
    )

  const ensureQueuedItemsMaterialized = async (queueId: number) => {
    const existing = await queueRepo.getItems(queueId)
    const existingKeys = new Set(existing.map((item) => `${item.itemType}:${item.itemId}`))

    const queuedTickets = await ticketRepo.findWhere(eq(tickets.queueId, queueId))
    for (const ticket of queuedTickets) {
      if (ticket.queueStatus === 'queued') {
        const key = `ticket:${ticket.id}`
        if (!existingKeys.has(key)) {
          try {
            await queueRepo.addItem({
              queueId,
              itemType: 'ticket',
              itemId: ticket.id,
              priority: ticket.queuePriority || 5,
              status: 'queued',
              agentId: null
            })
            existingKeys.add(key)
          } catch (error) {
            logger.warn('Failed to materialize ticket queue item', { queueId, ticketId: ticket.id, error })
          }
        }
      }
    }

    const queuedTasks = await taskRepo.findWhere(eq(ticketTasks.queueId, queueId))
    for (const task of queuedTasks) {
      if (task.queueStatus === 'queued') {
        const key = `task:${task.id}`
        if (!existingKeys.has(key)) {
          try {
            await queueRepo.addItem({
              queueId,
              itemType: 'task',
              itemId: task.id,
              priority: task.queuePriority || 5,
              status: 'queued',
              agentId: null
            })
            existingKeys.add(key)
          } catch (error) {
            logger.warn('Failed to materialize task queue item', { queueId, taskId: task.id, error })
          }
        }
      }
    }
  }

  const buildQueueEntry = async (item: QueueItem) => {
    if (item.itemType === 'ticket') {
      const ticket = await ticketRepo.getById(item.itemId)
      return {
        queueItem: item,
        ticket: ticket ? transformTicket(ticket) : undefined
      }
    }

    const task = await ticketRepo.getTaskById(item.itemId)
    return {
      queueItem: item,
      task: task ? transformTask(task) : undefined
    }
  }

  const getQueueEntries = async (queueId: number, status?: string) => {
    await ensureQueuedItemsMaterialized(queueId)
    const items = await queueRepo.getItems(queueId, status as any)
    const entries = await Promise.all(items.map((item) => buildQueueEntry(item)))
    return entries
  }

  const getQueueItems = async (queueId: number, status?: string) => {
    const entries = await getQueueEntries(queueId, status)
    return {
      tickets: entries.filter((entry) => entry.ticket).map((entry) => entry.ticket!),
      tasks: entries.filter((entry) => entry.task).map((entry) => entry.task!)
    }
  }

  const computeQueueStats = (entries: Array<{ queueItem: QueueItem }>) => {
    const totalItems = entries.length
    const queuedItems = entries.filter((entry) => entry.queueItem.status === 'queued').length
    const inProgressItems = entries.filter((entry) => entry.queueItem.status === 'in_progress').length
    const completedItems = entries.filter((entry) => entry.queueItem.status === 'completed').length
    const failedItems = entries.filter((entry) => entry.queueItem.status === 'failed').length
    const currentAgents = [
      ...new Set(
        entries
          .filter((entry) => entry.queueItem.status === 'in_progress' && entry.queueItem.agentId)
          .map((entry) => entry.queueItem.agentId!)
      )
    ]

    return {
      totalItems,
      queuedItems,
      inProgressItems,
      completedItems,
      failedItems,
      cancelledItems: entries.filter((entry) => entry.queueItem.status === 'cancelled').length,
      currentAgents,
      averageProcessingTime: null
    }
  }

  const getQueueWithStats = async (queueId: number) => {
    const queue = await queueRepo.getById(queueId)
    if (!queue) throw ErrorFactory.notFound('Queue', queueId)
    const entries = await getQueueEntries(queueId)
    const stats = computeQueueStats(entries)

    return {
      queue,
      items: entries,
      stats
    }
  }

  const listQueues = async (projectId: number) => queueRepo.getByProject(projectId)

  const getQueuesWithStats = async (projectId: number) => {
    const queues = await listQueues(projectId)
    return Promise.all(
      queues.map(async (queue) => {
        const { stats } = await getQueueWithStats(queue.id)
        return { queue, stats }
      })
    )
  }

  const getNextQueueItem = (queueId: number, agentId: string) =>
    withErrorContext(
      async () => {
        const queue = await queueRepo.getById(queueId)
        if (!queue) throw ErrorFactory.notFound('Queue', queueId)
        if (!queue.isActive) {
          return null
        }

        await ensureQueuedItemsMaterialized(queueId)

        const items = await queueRepo.getItems(queueId)
        const queuedItems = items
          .filter((item) => item.status === 'queued')
          .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

        if (queue.maxParallelItems) {
          const inProgressCount = items.filter((item) => item.status === 'in_progress').length
          if (inProgressCount >= queue.maxParallelItems) {
            return null
          }
        }

        const nextItem = queuedItems[0]
        if (!nextItem) {
          return null
        }

        const now = Date.now()
        if (nextItem.itemType !== 'ticket' && nextItem.itemType !== 'task') {
          return null
        }

        const updatedItem = await queueRepo.updateItem(nextItem.id, {
          status: 'in_progress',
          agentId,
          startedAt: now,
          updatedAt: now
        })

        await processor.startProcessingItem(nextItem.itemType, nextItem.itemId, agentId)

        return updatedItem
      },
      { entity: 'Queue', action: 'getNextItem', id: queueId }
    )

  const completeQueueItem = (
    itemId: number,
    result: { success: boolean; error?: string; metadata?: Record<string, unknown> }
  ) =>
    withErrorContext(
      async () => {
        const item = await queueRepo.getItemById(itemId)
        if (!item) {
          throw ErrorFactory.notFound('QueueItem', itemId)
        }

        if (item.itemType !== 'ticket' && item.itemType !== 'task') {
          return queueRepo.updateItem(itemId, {
            status: result.success ? 'completed' : 'failed',
            completedAt: Date.now(),
            updatedAt: Date.now(),
            errorMessage: result.error || null
          })
        }

        const now = Date.now()
        const status = result.success ? 'completed' : 'failed'
        const updatedItem = await queueRepo.updateItem(itemId, {
          status,
          completedAt: now,
          updatedAt: now,
          errorMessage: result.error || null,
          actualProcessingTime: item.startedAt ? now - item.startedAt : null
        })

        if (result.success) {
          await processor.completeProcessingItem(item.itemType, item.itemId)
        } else {
          await processor.failProcessingItem(item.itemType, item.itemId, result.error || 'Processing failed')
        }

        return updatedItem
      },
      { entity: 'QueueItem', action: 'complete', id: itemId }
    )

  const failQueueItem = (
    itemId: number,
    errorMessage: string,
    options: { retry?: boolean; maxRetries?: number } = {}
  ) =>
    withErrorContext(
      async () => {
        const item = await queueRepo.getItemById(itemId)
        if (!item) {
          throw ErrorFactory.notFound('QueueItem', itemId)
        }

        if (item.itemType !== 'ticket' && item.itemType !== 'task') {
          return queueRepo.updateItem(itemId, {
            status: 'failed',
            errorMessage,
            updatedAt: Date.now()
          })
        }

        const retryCount = 1
        const maxRetries = options.maxRetries ?? 3
        let status: 'queued' | 'failed' = 'failed'

        if (options.retry && retryCount <= maxRetries) {
          status = 'queued'
          logger.info('Retrying queue item', { itemId, queueId: item.queueId })
        } else {
          logger.error('Queue item failed permanently', { itemId, queueId: item.queueId, errorMessage })
        }

        const updated = await queueRepo.updateItem(itemId, {
          status,
          errorMessage,
          updatedAt: Date.now(),
          agentId: status === 'queued' ? null : item.agentId
        })

        if (status === 'queued') {
          await processor.failProcessingItem(item.itemType, item.itemId, errorMessage)
        }

        return updated
      },
      { entity: 'QueueItem', action: 'fail', id: itemId }
    )

  const setQueueStatus = (queueId: number, isActive: boolean) =>
    withErrorContext(
      async () => {
        const queue = await queueRepo.update(queueId, { isActive, updatedAt: Date.now() })
        if (!queue) {
          throw ErrorFactory.notFound('Queue', queueId)
        }

        if (!isActive) {
          const items = await queueRepo.getItems(queueId)
          const inProgress = items.filter((item) => item.status === 'in_progress')
          await Promise.all(
            inProgress.map((item) =>
              queueRepo.updateItem(item.id, {
                status: 'queued',
                agentId: null,
                updatedAt: Date.now()
              })
            )
          )
        }

        return queue
      },
      { entity: 'Queue', action: 'setStatus', id: queueId }
    )

  const pauseQueue = (queueId: number) => setQueueStatus(queueId, false)

  const resumeQueue = (queueId: number) => setQueueStatus(queueId, true)

  const clearCompletedItems = (queueId: number) =>
    withErrorContext(
      async () => {
        const items = await queueRepo.getItems(queueId)
        const completed = items.filter((item) => item.status === 'completed' || item.status === 'failed')
        await Promise.all(completed.map((item) => queueRepo.removeItem(item.id)))
        logger.info('Cleared completed queue items', { queueId, removed: completed.length })
        return completed.length
      },
      { entity: 'Queue', action: 'clearCompleted', id: queueId }
    )

  const getProcessingStats = (queueId: number, timeRange?: { start: number; end: number }) =>
    withErrorContext(
      async () => {
        const items = await queueRepo.getItems(queueId)
        const filtered = timeRange
          ? items.filter((item) => item.createdAt >= timeRange.start && item.createdAt <= timeRange.end)
          : items

        const completed = filtered.filter((item) => item.status === 'completed')
        const failed = filtered.filter((item) => item.status === 'failed')
        const totalProcessingTime = completed.reduce((sum, item) => sum + (item.actualProcessingTime || 0), 0)

        return {
          totalItems: filtered.length,
          completedItems: completed.length,
          failedItems: failed.length,
          successRate: filtered.length > 0 ? (completed.length / filtered.length) * 100 : 0,
          averageProcessingTime: completed.length > 0 ? totalProcessingTime / completed.length : 0,
          totalProcessingTime
        }
      },
      { entity: 'Queue', action: 'getProcessingStats', id: queueId }
    )

  const batchEnqueueItems = (
    queueId: number,
    items: Array<{ ticketId?: number; taskId?: number; priority?: number }>
  ) =>
    withErrorContext(
      async () => {
        const before = await queueRepo.getItems(queueId)
        const beforeKeys = new Set(before.map((item) => `${item.itemType}:${item.itemId}`))

        for (const item of items) {
          if (item.ticketId) {
            await enqueueTicket(item.ticketId, queueId, item.priority ?? 0)
          } else if (item.taskId) {
            await enqueueTask(item.taskId, queueId, item.priority ?? 0)
          }
        }

        const after = await queueRepo.getItems(queueId)
        return after.filter((item) => !beforeKeys.has(`${item.itemType}:${item.itemId}`))
      },
      { entity: 'Queue', action: 'batchEnqueue', id: queueId }
    )

  const getQueueTimeline = (queueId: number) =>
    withErrorContext(
      async () => {
        const now = Date.now()
        const entries = await getQueueEntries(queueId)
        const items = entries.map((entry) => {
          const queueItem = entry.queueItem
          const estimatedStartTime = queueItem.startedAt ?? queueItem.createdAt
          const estimatedProcessingTime = queueItem.estimatedProcessingTime ?? queueItem.actualProcessingTime ?? 0
          const estimatedEndTime =
            queueItem.completedAt ??
            (queueItem.startedAt
              ? queueItem.startedAt + estimatedProcessingTime
              : estimatedStartTime + estimatedProcessingTime)

          return {
            itemId: queueItem.id,
            ticketId: queueItem.itemType === 'ticket' ? queueItem.itemId : null,
            taskId: queueItem.itemType === 'task' ? queueItem.itemId : null,
            title: entry.ticket?.title || entry.task?.content || `${queueItem.itemType} ${queueItem.itemId}`,
            estimatedStartTime,
            estimatedEndTime,
            estimatedProcessingTime,
            status: queueItem.status
          }
        })

        const totalEstimatedTime = items.reduce((sum, item) => sum + item.estimatedProcessingTime, 0)
        const estimatedCompletionTime = items.reduce((latest, item) => Math.max(latest, item.estimatedEndTime), now)

        return {
          queueId,
          currentTime: now,
          items,
          totalEstimatedTime,
          estimatedCompletionTime
        }
      },
      { entity: 'Queue', action: 'getTimeline', id: queueId }
    )

  return {
    enqueueTicket,
    enqueueTask,
    async enqueueTicketWithTasks(ticketId: number, queueId: number, priority = 0) {
      return withErrorContext(
        async () => {
          await enqueueTicket(ticketId, queueId, priority)
          const associatedTasks = await ticketRepo.getTasksByTicket(ticketId)
          for (const task of associatedTasks) {
            await enqueueTask(task.id, queueId, priority)
          }

          logger.info('Enqueued ticket with tasks', { ticketId, queueId, taskCount: associatedTasks.length })
        },
        { entity: 'Ticket', action: 'enqueueWithTasks', id: ticketId }
      )
    },
    async dequeueTicket(ticketId: number) {
      return withErrorContext(
        async () => {
          const associatedTasks = await ticketRepo.getTasksByTicket(ticketId)
          for (const task of associatedTasks) {
            if (task.queueId !== null) {
              await ticketRepo.updateTask(task.id, {
                queueId: null,
                queueStatus: null,
                queuePosition: null,
                queuePriority: null,
                queuedAt: null,
                queueStartedAt: null,
                queueCompletedAt: null,
                queueAgentId: null,
                queueErrorMessage: null
              })
            }
          }

          const ticket = await ticketRepo.removeFromQueue(ticketId)
          logger.info('Dequeued ticket with tasks', { ticketId })
          return transformTicketForCompat(ticket)
        },
        { entity: 'Ticket', action: 'dequeue', id: ticketId }
      )
    },
    dequeueTicketWithTasks(ticketId: number) {
      return this.dequeueTicket(ticketId)
    },
    dequeueTask: tasks.dequeueTask,
    createQueue(data: { projectId: number; name: string; description?: string; maxParallelItems?: number }) {
      return withErrorContext(
        async () => {
          const now = Date.now()
          return queueRepo.create({
            projectId: data.projectId,
            name: data.name,
            description: data.description ?? null,
            maxParallelItems: data.maxParallelItems ?? 1,
            isActive: true,
            createdAt: now,
            updatedAt: now
          } as any)
        },
        { entity: 'Queue', action: 'create' }
      )
    },
    listQueues,
    getQueuesWithStats,
    updateQueue(
      queueId: number,
      data: Partial<{ name: string; description?: string; maxParallelItems?: number; isActive?: boolean }>
    ) {
      return withErrorContext(
        async () => {
          const existing = await queueRepo.getById(queueId)
          if (!existing) throw ErrorFactory.notFound('Queue', queueId)
          return queueRepo.update(queueId, { ...data, updatedAt: Date.now() } as any)
        },
        { entity: 'Queue', action: 'update', id: queueId }
      )
    },
    deleteQueue(queueId: number) {
      return withErrorContext(
        async () => {
          const existing = await queueRepo.getById(queueId)
          if (!existing) throw ErrorFactory.notFound('Queue', queueId)

          const entries = await getQueueEntries(queueId)
          await Promise.all(
            entries.map(async (entry) => {
              if (entry.queueItem.itemType === 'ticket') {
                await ticketRepo.removeFromQueue(entry.queueItem.itemId)
              } else {
                await ticketRepo.updateTask(entry.queueItem.itemId, {
                  queueId: null,
                  queueStatus: null,
                  queuePosition: null,
                  queuePriority: null,
                  queuedAt: null,
                  queueStartedAt: null,
                  queueCompletedAt: null,
                  queueAgentId: null,
                  queueErrorMessage: null
                })
              }
            })
          )

          return queueRepo.delete(queueId)
        },
        { entity: 'Queue', action: 'delete', id: queueId }
      )
    },
    getQueueById(queueId: number) {
      return withErrorContext(
        async () => {
          const queue = await queueRepo.getById(queueId)
          if (!queue) throw ErrorFactory.notFound('Queue', queueId)
          return queue
        },
        { entity: 'Queue', action: 'getById', id: queueId }
      )
    },
    moveItem(
      itemType: 'ticket' | 'task',
      itemId: number,
      targetQueueId: number | null,
      priority = 0,
      includeTasks = false
    ) {
      return withErrorContext(
        async () => {
          if (itemType === 'ticket') {
            if (targetQueueId === null) {
              await this.dequeueTicketWithTasks(itemId)
              const ticket = await ticketRepo.getById(itemId)
              if (!ticket) throw ErrorFactory.notFound('Ticket', itemId)
              return helpers.ticketToFlowItem(transformTicket(ticket))
            }

            if (includeTasks) {
              const ticket = await ticketRepo.getById(itemId)
              if (!ticket) throw ErrorFactory.notFound('Ticket', itemId)

              const existingTasks = await ticketRepo.getTasksByTicket(itemId)
              if (ticket.queueId) {
                await this.dequeueTicket(itemId)
              }

              for (const task of existingTasks) {
                if (task.queueId !== null) {
                  await tasks.dequeueTask(task.id)
                }
              }

              await enqueueTicket(itemId, targetQueueId, priority)
              for (const task of existingTasks) {
                await enqueueTask(task.id, targetQueueId, priority)
              }

              const updatedTicket = await ticketRepo.getById(itemId)
              if (!updatedTicket) throw ErrorFactory.notFound('Ticket', itemId)
              return helpers.ticketToFlowItem(transformTicket(updatedTicket))
            }

            const ticket = await enqueueTicket(itemId, targetQueueId, priority)
            return helpers.ticketToFlowItem(ticket)
          }

          if (targetQueueId === null) {
            const task = await tasks.dequeueTask(itemId)
            return helpers.taskToFlowItem(transformTask(task))
          }

          const task = await enqueueTask(itemId, targetQueueId, priority)
          return helpers.taskToFlowItem(task)
        },
        { entity: itemType === 'ticket' ? 'Ticket' : 'Task', action: 'move', id: itemId }
      )
    },
    getFlowData(projectId: number): Promise<FlowData> {
      return withErrorContext(
        async () => {
          const ticketsWithTasks = await helpers.getTicketsWithTasks(projectId)
          const queues = await queueRepo.getByProject(projectId)

          const flowData: FlowData = {
            unqueued: { tickets: [], tasks: [] },
            queues: {}
          }

          for (const queue of queues) {
            flowData.queues[queue.id] = {
              queue,
              tickets: [],
              tasks: []
            }
          }

          for (const ticket of ticketsWithTasks) {
            if (!ticket.queueId) {
              flowData.unqueued.tickets.push(ticket)
            } else if (flowData.queues[ticket.queueId]) {
              flowData.queues[ticket.queueId]!.tickets.push(ticket)
            }

            for (const task of ticket.tasks) {
              if (!task.queueId) {
                flowData.unqueued.tasks.push(task)
              } else if (flowData.queues[task.queueId]) {
                flowData.queues[task.queueId]!.tasks.push(task)
              }
            }
          }

          for (const queueData of Object.values(flowData.queues)) {
            queueData.tickets.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
            queueData.tasks.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
          }

          return flowData
        },
        { entity: 'FlowData', action: 'getFlowData' }
      )
    },
    async reorderWithinQueue(
      queueId: number,
      items: Array<{ itemType: 'ticket' | 'task'; itemId: number; ticketId?: number }>
    ) {
      return withErrorContext(
        async () => {
          for (let index = 0; index < items.length; index++) {
            const entry = items[index]
            if (!entry) continue

            if (entry.itemType === 'ticket') {
              const ticket = await ticketRepo.getById(entry.itemId)
              if (ticket?.queueId === queueId) {
                await ticketRepo.update(entry.itemId, { queuePosition: index })
              }
            } else {
              const task = await ticketRepo.getTaskById(entry.itemId)
              if (task?.queueId === queueId) {
                await ticketRepo.updateTask(entry.itemId, { queuePosition: index })
              }
            }
          }

          logger.info('Reordered items within queue', { queueId, itemCount: items.length })
        },
        { entity: 'Queue', action: 'reorder', id: queueId }
      )
    },
    async getFlowItems(projectId: number): Promise<FlowItem[]> {
      return withErrorContext(
        async () => {
          const flowData = await this.getFlowData(projectId)
          const items: FlowItem[] = []

          for (const ticket of flowData.unqueued.tickets) {
            items.push(helpers.ticketToFlowItem(ticket as FlowTicket))
          }
          for (const task of flowData.unqueued.tasks) {
            items.push(helpers.taskToFlowItem(task as FlowTask))
          }

          for (const queueData of Object.values(flowData.queues)) {
            for (const ticket of queueData.tickets) {
              items.push(helpers.ticketToFlowItem(ticket as FlowTicket))
            }
            for (const task of queueData.tasks) {
              items.push(helpers.taskToFlowItem(task as FlowTask))
            }
          }

          return items
        },
        { entity: 'FlowItem', action: 'getFlowItems' }
      )
    },
    getQueueItems,
    getQueueEntries,
    getQueueWithStats,
    getUnqueuedItems(projectId: number) {
      return withErrorContext(
        async () => {
          const ticketList = await ticketRepo.findWhere(and(eq(tickets.projectId, projectId), isNull(tickets.queueId)))
          const allTasks: FlowTask[] = []

          for (const ticket of ticketList) {
            const tasksForTicket = await ticketRepo.getTasksByTicket(ticket.id)
            allTasks.push(...tasksForTicket.filter((task) => !task.queueId).map(transformTask))
          }

          return {
            tickets: ticketList.map(transformTicket),
            tasks: allTasks
          }
        },
        { entity: 'Project', action: 'getUnqueuedItems', id: projectId }
      )
    },
    getNextQueueItem,
    completeQueueItem,
    failQueueItem,
    setQueueStatus,
    pauseQueue,
    resumeQueue,
    clearCompletedItems,
    getProcessingStats,
    batchEnqueueItems,
    getQueueTimeline
  }
}
