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
import { fileRepository, selectedFileRepository } from './file-repository'
import { 
  claudeAgentRepository, 
  claudeCommandRepository, 
  claudeHookRepository 
} from './claude-repository'
import { providerKeyRepository } from './provider-key-repository'
import { activeTabRepository } from './app-state-repository'
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
  type QueueItem,
  type ClaudeAgent,
  type ClaudeCommand,
  type ClaudeHook,
  type ProviderKey,
  type File,
  type SelectedFile,
  type ActiveTab
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

  // Claude-specific repositories (fully typed)
  public readonly claudeAgents = claudeAgentRepository
  public readonly claudeCommands = claudeCommandRepository
  public readonly claudeHooks = claudeHookRepository

  // Configuration repositories (fully typed)
  public readonly providerKeys = providerKeyRepository
  public readonly activeTabs = activeTabRepository

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
      agentCount,
      commandCount,
      hookCount,
      providerKeyCount,
      activeTabCount
    ] = await Promise.all([
      db.select({ count: count() }).from(projects).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(tickets).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(ticketTasks).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(chats).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(chatMessages).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(prompts).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(queues).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(queueItems).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(files).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(claudeAgents).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(claudeCommands).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(claudeHooks).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(providerKeys).then(result => result[0]?.count ?? 0),
      db.select({ count: count() }).from(activeTabs).then(result => result[0]?.count ?? 0)
    ])

    const totalRecords = projectCount + ticketCount + taskCount + chatCount + 
      messageCount + promptCount + queueCount + queueItemCount + fileCount + 
      agentCount + commandCount + hookCount + providerKeyCount + activeTabCount

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
      
      // Claude entities
      claudeAgents: agentCount,
      claudeCommands: commandCount,
      claudeHooks: hookCount,
      
      // Configuration
      providerKeys: providerKeyCount,
      activeTabs: activeTabCount,
      
      // Totals
      total: totalRecords,
      
      // Categories
      coreEntities: projectCount + ticketCount + taskCount + chatCount + messageCount,
      claudeEntities: agentCount + commandCount + hookCount,
      configEntities: providerKeyCount + activeTabCount,
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
      { name: 'claudeAgents', repo: this.claudeAgents },
      { name: 'claudeCommands', repo: this.claudeCommands },
      { name: 'claudeHooks', repo: this.claudeHooks },
      { name: 'providerKeys', repo: this.providerKeys },
      { name: 'activeTabs', repo: this.activeTabs }
    ]

    await Promise.all(repositories.map(async ({ name, repo }) => {
      try {
        await repo.count()
        repositoryChecks[name] = true
      } catch (error) {
        repositoryChecks[name] = false
        errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }))

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

    return { status, repositories: repositoryChecks, errors }
  }

  /**
   * Get repository by entity name (for dynamic access)
   */
  getRepository(entityName: string) {
    const repositories: Record<string, any> = {
      'projects': this.projects,
      'tickets': this.tickets,
      'tasks': this.tasks,
      'chats': this.chats,
      'messages': this.messages,
      'prompts': this.prompts,
      'queues': this.queues,
      'queueItems': this.queueItems,
      'files': this.files,
      'selectedFiles': this.selectedFiles,
      'claudeAgents': this.claudeAgents,
      'claudeCommands': this.claudeCommands,
      'claudeHooks': this.claudeHooks,
      'providerKeys': this.providerKeys,
      'activeTabs': this.activeTabs
    }
    
    return repositories[entityName] || null
  }
}

// Export singleton instance for backward compatibility
export const storageService = new StorageService()

// Export the class for dependency injection
export default StorageService