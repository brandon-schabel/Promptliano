/**
 * Project Domain Service - Service Composition Example
 * Demonstrates how functional services compose into domain-specific operations
 *
 * This service combines multiple modernized services to provide high-level
 * business operations that span multiple entities and implement complex workflows.
 */

import { composeServices, withErrorContext, createServiceLogger } from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { createProjectService, type ProjectService } from './project-service'
import { createTicketService, createTaskService, type TicketService, type TaskService } from './ticket-service'
import { createChatService, type ChatService } from './chat-service'
import { createQueueService, type QueueService } from './queue-service'

// Dependencies interface for dependency injection
export interface ProjectDomainServiceDeps {
  projectService?: ProjectService
  ticketService?: TicketService
  taskService?: TaskService
  chatService?: ChatService
  queueService?: QueueService
  logger?: ReturnType<typeof createServiceLogger>
  aiService?: any // For AI-powered operations
}

/**
 * Create Project Domain Service with composed operations
 */
export function createProjectDomainService(deps: ProjectDomainServiceDeps = {}) {
  const logger = deps.logger || createServiceLogger('ProjectDomainService')

  const services = {
    projects: deps.projectService || createProjectService(),
    tickets: deps.ticketService || createTicketService(),
    tasks: deps.taskService || createTaskService(),
    chats: deps.chatService || createChatService(),
    queues: deps.queueService || createQueueService()
  }

  return composeServices({
    ...services,

    /**
     * Create a complete project with initial structure
     */
    async createProjectWithStructure(data: {
      name: string
      path: string
      description?: string
      createQueue?: boolean
      createChat?: boolean
      initialTickets?: Array<{
        title: string
        overview: string
        generateTasks?: boolean
      }>
    }) {
      return withErrorContext(
        async () => {
          // Create the project
          const project = await services.projects.create({
            name: data.name,
            path: data.path,
            description: data.description || ''
          })

          logger.info('Created project', { projectId: project.id, name: project.name })

          const results: any = { project }

          // Create default queue if requested
          if (data.createQueue) {
            const queue = await services.queues.create({
              projectId: project.id,
              name: 'Default Queue',
              description: 'Default task processing queue',
              maxParallelItems: 3,
              isActive: true
            })
            results.queue = queue
            logger.info('Created default queue', { queueId: queue.id })
          }

          // Create default chat session if requested
          if (data.createChat) {
            const { chat } = await services.chats.createSession({
              projectId: project.id,
              title: 'Project Chat',
              initialMessage: `Started working on project: ${project.name}`
            })
            results.chat = chat
            logger.info('Created default chat', { chatId: chat.id })
          }

          // Create initial tickets if provided
          if (data.initialTickets?.length) {
            const tickets = []
            for (const ticketData of data.initialTickets) {
              const { ticket, tasks } = await services.tickets.createWithTasks({
                projectId: project.id,
                title: ticketData.title,
                overview: ticketData.overview,
                status: 'open',
                priority: 'normal',
                generateTasks: ticketData.generateTasks
              })
              tickets.push({ ticket, tasks })

              // Add ticket to queue if queue was created
              if (results.queue) {
                await services.queues.enqueue(results.queue.id, {
                  type: 'ticket',
                  referenceId: ticket.id,
                  title: ticket.title,
                  description: `Process ticket: ${ticket.title}`,
                  priority: ticket.priority === 'high' ? 1 : ticket.priority === 'low' ? 9 : 5
                })
              }
            }
            results.tickets = tickets
            logger.info('Created initial tickets', {
              projectId: project.id,
              ticketCount: tickets.length
            })
          }

          return results
        },
        { entity: 'ProjectDomain', action: 'createProjectWithStructure' }
      )
    },

    /**
     * Get comprehensive project dashboard data
     */
    async getProjectDashboard(projectId: number) {
      return withErrorContext(
        async () => {
          // Get all project data in parallel
          const [project, projectStats, ticketsWithStats, queuesWithStats, recentChats] = await Promise.all([
            services.projects.getById(projectId),
            services.projects.getStats(projectId),
            services.tickets.getByProjectWithStats(projectId),
            services.queues.getQueuesWithStats(projectId),
            services.chats.getByProject(projectId).then((chats) => chats.slice(0, 5))
          ])

          // Calculate additional metrics
          const openTickets = ticketsWithStats.filter((t) => t.status !== 'closed')
          const inProgressTickets = ticketsWithStats.filter((t) => t.status === 'in_progress')
          const totalProgress =
            ticketsWithStats.length > 0
              ? ticketsWithStats.reduce((sum, ticket) => sum + ticket.progress, 0) / ticketsWithStats.length
              : 0

          // Get queue processing summary
          const queueSummary = {
            totalQueues: queuesWithStats.length,
            activeQueues: queuesWithStats.filter((q) => q.queue.isActive).length,
            totalQueuedItems: queuesWithStats.reduce((sum, q) => sum + q.stats.queuedItems, 0),
            totalInProgressItems: queuesWithStats.reduce((sum, q) => sum + q.stats.inProgressItems, 0),
            totalCompletedItems: queuesWithStats.reduce((sum, q) => sum + q.stats.completedItems, 0)
          }

          return {
            project,
            stats: {
              ...projectStats,
              totalProgress: Math.round(totalProgress),
              openTickets: openTickets.length,
              inProgressTickets: inProgressTickets.length,
              avgTicketProgress: Math.round(totalProgress)
            },
            tickets: {
              total: ticketsWithStats.length,
              open: openTickets.length,
              inProgress: inProgressTickets.length,
              recent: ticketsWithStats.slice(0, 10)
            },
            queues: {
              summary: queueSummary,
              details: queuesWithStats
            },
            chats: {
              total: recentChats.length,
              recent: recentChats
            }
          }
        },
        { entity: 'ProjectDomain', action: 'getProjectDashboard', id: projectId }
      )
    },

    /**
     * Archive completed project work
     */
    async archiveProjectWork(projectId: number, beforeDate: number) {
      return withErrorContext(
        async () => {
          const [archivedTickets, archivedChats, clearedQueueItems] = await Promise.all([
            services.tickets.archiveOldTickets(projectId, beforeDate),
            services.chats.archiveOldChats(beforeDate),
            // Clear completed items from all project queues
            services.queues.getByProject(projectId).then(async (queues) => {
              let totalCleared = 0
              for (const queue of queues) {
                const cleared = await services.queues.clearCompleted(queue.id)
                totalCleared += cleared
              }
              return totalCleared
            })
          ])

          logger.info('Archived project work', {
            projectId,
            archivedTickets,
            archivedChats,
            clearedQueueItems
          })

          return {
            archivedTickets,
            archivedChats,
            clearedQueueItems,
            totalOperations: archivedTickets + archivedChats + clearedQueueItems
          }
        },
        { entity: 'ProjectDomain', action: 'archiveProjectWork', id: projectId }
      )
    },

    /**
     * Process next work item from project queues
     */
    async processNextWorkItem(projectId: number, agentId: string) {
      return withErrorContext(
        async () => {
          const queues = await services.queues.getByProject(projectId)
          const activeQueues = queues.filter((q) => q.isActive)

          if (activeQueues.length === 0) {
            return { success: false, reason: 'No active queues found' }
          }

          // Try to get next item from each queue (priority order)
          for (const queue of activeQueues) {
            const item = await services.queues.getNextItem(queue.id, agentId)

            if (item) {
              logger.info('Assigned work item to agent', {
                queueId: queue.id,
                itemId: item.id,
                agentId,
                type: item.itemType
              })

              return {
                success: true,
                queue,
                item,
                message: `Assigned ${item.itemType} (ID: ${item.itemId}) to agent ${agentId}`
              }
            }
          }

          return { success: false, reason: 'No items available in any queue' }
        },
        { entity: 'ProjectDomain', action: 'processNextWorkItem', id: projectId }
      )
    },

    /**
     * Create ticket with auto-queueing
     */
    async createTicketAndQueue(
      projectId: number,
      ticketData: {
        title: string
        overview: string
        priority?: 'low' | 'normal' | 'high'
        generateTasks?: boolean
      },
      queueOptions?: {
        queueId?: number
        priority?: number
      }
    ) {
      return withErrorContext(
        async () => {
          // Create ticket with tasks
          const { ticket, tasks } = await services.tickets.createWithTasks({
            projectId,
            ...ticketData
          })

          // Auto-queue if options provided or default queue exists
          let queueItem = null
          if (queueOptions?.queueId) {
            queueItem = await services.queues.enqueue(queueOptions.queueId, {
              type: 'ticket',
              referenceId: ticket.id,
              title: ticket.title,
              description: `Process ticket: ${ticket.title}`,
              priority: queueOptions.priority || (ticket.priority === 'high' ? 1 : ticket.priority === 'low' ? 9 : 5)
            })
          } else {
            // Try to find and use default queue
            const queues = await services.queues.getByProject(projectId)
            const defaultQueue = queues.find((q) => q.isActive)

            if (defaultQueue) {
              queueItem = await services.queues.enqueue(defaultQueue.id, {
                type: 'ticket',
                referenceId: ticket.id,
                title: ticket.title,
                description: `Process ticket: ${ticket.title}`,
                priority: ticket.priority === 'high' ? 1 : ticket.priority === 'low' ? 9 : 5
              })
            }
          }

          logger.info('Created ticket and queued for processing', {
            ticketId: ticket.id,
            taskCount: tasks.length,
            queued: !!queueItem
          })

          return { ticket, tasks, queueItem }
        },
        { entity: 'ProjectDomain', action: 'createTicketAndQueue', id: projectId }
      )
    }
  })
}

// Export type for consumers
export type ProjectDomainService = ReturnType<typeof createProjectDomainService>

// Export singleton for backward compatibility
export const projectDomainService = createProjectDomainService()

// Export individual functions for tree-shaking
export const {
  createProjectWithStructure,
  getProjectDashboard,
  archiveProjectWork,
  processNextWorkItem,
  createTicketAndQueue
} = projectDomainService
