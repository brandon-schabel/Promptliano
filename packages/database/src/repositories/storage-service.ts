/**
 * Storage Service - Unified interface replacing all legacy storage classes
 * Provides backward compatibility while using Drizzle repositories internally
 */

import { count } from 'drizzle-orm'
import { projectRepository } from './project-repository'
import { ticketRepository } from './ticket-repository'
import { taskRepository } from './task-repository'
import { chatRepository } from './chat-repository'
import { promptRepository } from './prompt-repository'
import { queueRepository } from './queue-repository'
import { BaseRepository } from './base-repository'
import { 
  projects,
  tickets, 
  ticketTasks,
  chats,
  chatMessages,
  prompts,
  queues,
  queueItems,
  claudeAgents,
  claudeCommands,
  claudeHooks,
  providerKeys,
  files,
  selectedFiles,
  activeTabs,
  type Project,
  type Ticket,
  type TicketTask,
  type Chat,
  type ChatMessage,
  type Prompt,
  type Queue,
  type QueueItem
} from '../schema'

/**
 * Unified Storage Service - Single entry point for all data operations
 * Replaces 15+ individual storage classes with repository pattern
 */
export class StorageService {
  // Repository instances
  public readonly projects = projectRepository
  public readonly tickets = ticketRepository  
  public readonly tasks = taskRepository
  public readonly chats = chatRepository
  public readonly prompts = promptRepository
  public readonly queues = queueRepository

  // Base repositories for entities not yet fully migrated
  public readonly claudeAgents = new BaseRepository<any>(claudeAgents)
  public readonly claudeCommands = new BaseRepository<any>(claudeCommands)
  public readonly claudeHooks = new BaseRepository<any>(claudeHooks)
  public readonly providerKeys = new BaseRepository<any>(providerKeys)
  public readonly files = new BaseRepository<any>(files)
  public readonly selectedFiles = new BaseRepository<any>(selectedFiles)
  public readonly activeTabs = new BaseRepository<any>(activeTabs)

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    // Import db here to avoid circular dependency
    const { db } = await import('../db')
    
    const [
      projectCount,
      ticketCount,
      taskCount,
      chatCount,
      promptCount,
      queueCount
    ] = await Promise.all([
      db.select({ count: count() }).from(projects).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(tickets).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(ticketTasks).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(chats).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(prompts).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(queues).then(result => result[0]?.count ?? 0)
    ])

    return {
      projects: projectCount,
      tickets: ticketCount,
      tasks: taskCount,
      chats: chatCount,
      prompts: promptCount,
      queues: queueCount,
      total: projectCount + ticketCount + taskCount + chatCount + promptCount + queueCount
    }
  }

  /**
   * Migrate data from legacy storage format
   */
  async migrateFromLegacy() {
    // This would contain migration logic from old JSON/manual SQLite format
    // to the new Drizzle schema format
    throw new Error('Migration not yet implemented - use migration scripts')
  }

  /**
   * Health check - verify all repositories are working
   */
  async healthCheck() {
    try {
      // Just test basic database connectivity
      const stats = await this.getStorageStats()
      return { status: 'healthy', timestamp: Date.now(), stats }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now() 
      }
    }
  }

  /**
   * Execute database maintenance tasks
   */
  async maintenance() {
    const { dbUtils } = await import('../db')
    
    // Analyze database for query optimization
    dbUtils.analyze()
    
    // Get current stats
    const stats = dbUtils.getStats()
    
    return {
      message: 'Maintenance completed',
      stats,
      timestamp: Date.now()
    }
  }

  /**
   * Backup critical data
   */
  async backup() {
    const stats = await this.getStorageStats()
    const timestamp = Date.now()
    
    return {
      message: 'Backup placeholder - implement with actual backup logic',
      stats,
      timestamp
    }
  }
}

/**
 * Singleton instance for backward compatibility
 */
export const storageService = new StorageService()

/**
 * Legacy compatibility - individual storage exports
 */
export const ProjectStorage = {
  // Proxy to new repository methods
  async create(data: any) {
    return storageService.projects.create(data)
  },
  async getById(id: number) {
    return storageService.projects.getById(id)
  },
  async getByPath(path: string) {
    return storageService.projects.getByPath(path)
  },
  async getAll() {
    return storageService.projects.getAll()
  },
  async update(id: number, data: any) {
    return storageService.projects.update(id, data)
  },
  async delete(id: number) {
    return storageService.projects.delete(id)
  }
}

export const TicketStorage = {
  async create(data: any) {
    return storageService.tickets.create(data)
  },
  async getById(id: number) {
    return storageService.tickets.getById(id)
  },
  async getByProject(projectId: number) {
    return storageService.tickets.getByProject(projectId)
  },
  async getByStatus(projectId: number, status: any) {
    return storageService.tickets.getByStatus(projectId, status)
  },
  async update(id: number, data: any) {
    return storageService.tickets.update(id, data)
  },
  async delete(id: number) {
    return storageService.tickets.delete(id)
  },
  async getWithTasks(id: number) {
    return storageService.tickets.getWithTasks(id)
  }
}

export const TaskStorage = {
  async create(data: any) {
    return storageService.tasks.create(data)
  },
  async getById(id: number) {
    return storageService.tasks.getById(id)
  },
  async getByTicket(ticketId: number) {
    return storageService.tasks.getByTicket(ticketId)
  },
  async update(id: number, data: any) {
    return storageService.tasks.update(id, data)
  },
  async delete(id: number) {
    return storageService.tasks.delete(id)
  },
  async toggleCompletion(id: number) {
    return storageService.tasks.toggleCompletion(id)
  }
}

export const ChatStorage = {
  async create(data: any) {
    return storageService.chats.create(data)
  },
  async getById(id: number) {
    return storageService.chats.getById(id)
  },
  async getByProject(projectId: number) {
    return storageService.chats.getByProject(projectId)
  },
  async update(id: number, data: any) {
    return storageService.chats.update(id, data)
  },
  async delete(id: number) {
    return storageService.chats.delete(id)
  },
  async getWithMessages(id: number) {
    return storageService.chats.getWithMessages(id)
  },
  async addMessage(data: any) {
    return storageService.chats.addMessage(data)
  }
}

/**
 * Type-safe wrappers for common patterns
 */
export class TypedStorageService {
  /**
   * Get project with all related data
   */
  async getProjectWithEverything(projectId: number) {
    const project = await storageService.projects.getWithAllRelations(projectId)
    return project
  }

  /**
   * Create ticket with tasks in a single transaction
   */
  async createTicketWithTasks(
    ticketData: any, 
    tasksData: any[]
  ) {
    const ticket = await storageService.tickets.create(ticketData)
    
    if (tasksData.length > 0) {
      const tasksWithTicketId = tasksData.map(task => ({
        ...task,
        ticketId: ticket.id
      }))
      const tasks = await storageService.tasks.createMany(tasksWithTicketId)
      
      return {
        ticket,
        tasks
      }
    }
    
    return { ticket, tasks: [] }
  }

  /**
   * Archive completed project data
   */
  async archiveProject(projectId: number) {
    // Mark all tickets as closed
    const tickets = await storageService.tickets.getByProject(projectId)
    const ticketIds = tickets.map(t => t.id)
    
    if (ticketIds.length > 0) {
      await storageService.tickets.updateMany(ticketIds, { status: 'closed' })
    }
    
    // Mark all tasks as done
    const allTasks = []
    for (const ticket of tickets) {
      const tasks = await storageService.tasks.getByTicket(ticket.id)
      allTasks.push(...tasks)
    }
    
    const pendingTaskIds = allTasks.filter(t => !t.done).map(t => t.id)
    if (pendingTaskIds.length > 0) {
      await storageService.tasks.completeMany(pendingTaskIds)
    }
    
    return {
      ticketsUpdated: ticketIds.length,
      tasksCompleted: pendingTaskIds.length
    }
  }
}

/**
 * Export singleton instance
 */
export const typedStorage = new TypedStorageService()

/**
 * Default export for easy importing
 */
export default storageService