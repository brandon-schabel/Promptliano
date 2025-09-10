/**
 * Storage Service - Unified interface replacing all legacy storage classes
 * Now uses properly typed repositories instead of BaseRepository<any>
 * Provides backward compatibility while using modern repository pattern
 */

import { count } from 'drizzle-orm'
import { projectRepository } from './project-repository'
import { ticketRepository, taskRepository } from './ticket-repository'
import { chatRepository, messageRepository } from './chat-repository'
import { promptRepository } from './prompt-repository'
import { queueRepository, queueItemRepository } from './queue-repository'
import { fileRepository } from './file-repository'
import { providerKeyRepository } from './provider-key-repository'
import { selectedFileRepository } from './app-state-repository'
import { mcpServerRepository } from './mcp-server-repository'
import {
  projects,
  tickets,
  ticketTasks,
  chats,
  chatMessages,
  prompts,
  queues,
  queueItems,
  providerKeys,
  files,
  selectedFiles,
  mcpServerConfigs,
  type Project,
  type Ticket,
  type TicketTask,
  type Chat,
  type ChatMessage,
  type Prompt,
  type Queue,
  type QueueItem,
  type ProviderKey,
  type File,
  type SelectedFile,
  type McpServerConfig
} from '../schema'

/**
 * Unified Storage Service - Single entry point for all data operations
 * Replaces 15+ individual storage classes with properly typed repository pattern
 */
export class StorageService {
  // Core entity repositories (fully typed)
  public readonly projects = projectRepository
  public readonly tickets = ticketRepository
  public readonly tasks = taskRepository
  public readonly chats = chatRepository
  public readonly messages = messageRepository
  public readonly prompts = promptRepository
  public readonly queues = queueRepository
  public readonly queueItems = queueItemRepository
  public readonly files = fileRepository
  public readonly selectedFiles = selectedFileRepository

  // Configuration repositories (fully typed)
  public readonly providerKeys = providerKeyRepository
  public readonly mcpServers = mcpServerRepository

  /**
   * Get comprehensive storage statistics
   */
  async getStorageStats() {
    // Import db here to avoid circular dependency
    const { db } = await import('../db')

    const [
      projectCount,
      ticketCount,
      taskCount,
      chatCount,
      messageCount,
      promptCount,
      queueCount,
      queueItemCount,
      fileCount,

      providerKeyCount,
      mcpServerCount
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(projects)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(tickets)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(ticketTasks)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(chats)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(chatMessages)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(prompts)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(queues)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(queueItems)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(files)
        .then((result) => result[0]?.count ?? 0),

      db
        .select({ count: count() })
        .from(providerKeys)
        .then((result) => result[0]?.count ?? 0),
      db
        .select({ count: count() })
        .from(mcpServerConfigs)
        .then((result) => result[0]?.count ?? 0)
    ])

    const totalRecords =
      projectCount +
      ticketCount +
      taskCount +
      chatCount +
      messageCount +
      promptCount +
      queueCount +
      queueItemCount +
      fileCount +
      providerKeyCount +
      mcpServerCount

    return {
      // Core entities
      projects: projectCount,
      tickets: ticketCount,
      tasks: taskCount,
      chats: chatCount,
      messages: messageCount,
      prompts: promptCount,
      queues: queueCount,
      queueItems: queueItemCount,
      files: fileCount,

      // Configuration
      providerKeys: providerKeyCount,
      // activeTabs removed
      mcpServers: mcpServerCount,

      // Totals
      total: totalRecords,

      // Categories
      coreEntities: projectCount + ticketCount + taskCount + chatCount + messageCount,
      configEntities: providerKeyCount + mcpServerCount,
      workflowEntities: queueCount + queueItemCount + promptCount + fileCount
    }
  }

  /**
   * Health check - verify all repositories are functioning
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    repositories: Record<string, boolean>
    errors: string[]
    timestamp: number
  }> {
    const repositoryChecks: Record<string, boolean> = {}
    const errors: string[] = []

    // Test each repository with a simple count operation
    const repositories = [
      { name: 'projects', repo: this.projects },
      { name: 'tickets', repo: this.tickets },
      { name: 'tasks', repo: this.tasks },
      { name: 'chats', repo: this.chats },
      { name: 'prompts', repo: this.prompts },
      { name: 'queues', repo: this.queues },
      { name: 'files', repo: this.files },
      { name: 'providerKeys', repo: this.providerKeys },
      { name: 'mcpServers', repo: this.mcpServers }
    ]

    await Promise.all(
      repositories.map(async ({ name, repo }) => {
        try {
          // Type assertion to ensure count method is available
          const repositoryWithCount = repo as any
          if (typeof repositoryWithCount.count === 'function') {
            await repositoryWithCount.count()
            repositoryChecks[name] = true
          } else {
            repositoryChecks[name] = false
            errors.push(`${name}: count method not available`)
          }
        } catch (error) {
          repositoryChecks[name] = false
          errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    )

    const healthyCount = Object.values(repositoryChecks).filter(Boolean).length
    const totalCount = repositories.length

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyCount === totalCount) {
      status = 'healthy'
    } else if (healthyCount > totalCount / 2) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return { status, repositories: repositoryChecks, errors, timestamp: Date.now() }
  }

  /**
   * Get repository by entity name (for dynamic access)
   */
  getRepository(entityName: string) {
    const repositories: Record<string, any> = {
      projects: this.projects,
      tickets: this.tickets,
      tasks: this.tasks,
      chats: this.chats,
      messages: this.messages,
      prompts: this.prompts,
      queues: this.queues,
      queueItems: this.queueItems,
      files: this.files,
      selectedFiles: this.selectedFiles,
      providerKeys: this.providerKeys,
      mcpServers: this.mcpServers
    }

    return repositories[entityName] || null
  }
}

// Export singleton instance for backward compatibility
export const storageService = new StorageService()

// Export the class for dependency injection
export default StorageService
