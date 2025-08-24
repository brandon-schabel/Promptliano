/**
 * Service Container - Dependency Injection and Service Composition
 * Provides centralized service management with dependency injection
 * 
 * Key features:
 * - Centralized service configuration
 * - Dependency injection for all services
 * - Service composition for complex operations
 * - Testing support with mock services
 * - Lifecycle management (initialize, dispose)
 * - Performance monitoring
 */

import { createServiceLogger } from './core/base-service'
import { createProjectService, type ProjectServiceDeps } from './project-service'
import { createTicketService, type TicketServiceDeps } from './ticket-service'
// import { createPromptService, type PromptServiceDeps } from './prompt-service' // TODO: Migrate prompt service
// import { createFileService, type FileServiceDeps } from './file-service-v2' // Temporarily disabled until file repository is implemented
// import { createChatService, type ChatServiceDeps } from './chat-service' // TODO: Migrate chat service  
import { createQueueService, type QueueServiceDeps } from './queue-service'

// Re-export repositories for convenience
import {
  projectRepository,
  ticketRepository,
  queueRepository,
  taskRepository
  // chatRepository,
  // promptRepository
} from '@promptliano/database'

// Service container configuration
export interface ServiceContainerConfig {
  // Repository overrides for testing
  repositories?: {
    project?: typeof projectRepository
    ticket?: typeof ticketRepository
    task?: typeof taskRepository
    queue?: typeof queueRepository
    // prompt?: typeof promptRepository
    // chat?: typeof chatRepository
  }
  
  // Logger configuration
  logger?: {
    level?: 'debug' | 'info' | 'warn' | 'error'
    enabled?: boolean
  }
  
  // External services
  external?: {
    aiService?: any
    gitService?: any
    fileSystem?: any
  }
  
  // Performance monitoring
  monitoring?: {
    enabled?: boolean
    logSlowOperations?: boolean
    slowOperationThreshold?: number // milliseconds
  }
}

// Container instance type
export interface ServiceContainer {
  // Core services
  project: ReturnType<typeof createProjectService>
  ticket: ReturnType<typeof createTicketService>
  // prompt: ReturnType<typeof createPromptService> // TODO: Migrate prompt service
  // file: ReturnType<typeof createFileService> // Temporarily disabled
  // chat: ReturnType<typeof createChatService> // TODO: Migrate chat service
  queue: ReturnType<typeof createQueueService>
  
  // Domain compositions
  domain: {
    // Project domain service with all related operations
    createProjectWithStructure: (data: any) => Promise<any>
    deleteProjectCascade: (projectId: number) => Promise<void>
    getProjectDashboard: (projectId: number) => Promise<any>
  }
  
  // Container management
  dispose: () => Promise<void>
  health: () => Promise<{ healthy: boolean; services: Record<string, boolean> }>
}

/**
 * Create a service container with dependency injection
 */
export function createServiceContainer(config: ServiceContainerConfig = {}): ServiceContainer {
  const logger = createServiceLogger('ServiceContainer')
  const { repositories = {}, external = {}, monitoring = {} } = config
  
  // Initialize repositories with defaults
  const repos = {
    project: repositories.project || projectRepository,
    ticket: repositories.ticket || ticketRepository,
    task: repositories.task || taskRepository,
    queue: repositories.queue || queueRepository
    // prompt: repositories.prompt || promptRepository,
    // chat: repositories.chat || chatRepository
  }
  
  // Performance monitoring wrapper
  function withMonitoring<T extends any[], R>(
    serviceName: string,
    methodName: string,
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    if (!monitoring.enabled) return fn
    
    return async (...args: T): Promise<R> => {
      const start = Date.now()
      try {
        const result = await fn(...args)
        const duration = Date.now() - start
        
        if (monitoring.logSlowOperations && duration > (monitoring.slowOperationThreshold || 1000)) {
          logger.warn(`Slow operation detected: ${serviceName}.${methodName} took ${duration}ms`)
        }
        
        return result
      } catch (error) {
        const duration = Date.now() - start
        logger.error(`Error in ${serviceName}.${methodName} after ${duration}ms:`, error)
        throw error
      }
    }
  }
  
  // Create services with dependency injection
  const projectService = createProjectService({
    repository: repos.project,
    logger: createServiceLogger('ProjectService'),
    aiService: external.aiService,
    gitService: external.gitService
  } as ProjectServiceDeps)
  
  // File service temporarily disabled until file repository is implemented
  // const fileService = createFileService({
  //   repository: repositories.file || null as any,
  //   logger: createServiceLogger('FileService'),
  //   fs: external.fileSystem,
  //   projectService
  // } as FileServiceDeps)
  
  // TODO: Migrate prompt service
  // const promptService = createPromptService({
  //   repository: repos.prompt,
  //   logger: createServiceLogger('PromptService'),
  //   aiService: external.aiService,
  //   projectService
  // } as PromptServiceDeps)
  
  const ticketService = createTicketService({
    ticketRepository: repos.ticket,
    taskRepository: repos.task,
    logger: createServiceLogger('TicketService'),
    // promptService,
    // fileService, // Temporarily disabled
    aiService: external.aiService
  } as TicketServiceDeps)
  
  // TODO: Migrate chat service
  // const chatService = createChatService({
  //   repository: repos.chat,
  //   logger: createServiceLogger('ChatService'),
  //   aiService: external.aiService,
  //   projectService
  // } as ChatServiceDeps)
  
  const queueService = createQueueService({
    queueRepository: repos.queue,
    logger: createServiceLogger('QueueService'),
    ticketService,
    // projectService
  } as QueueServiceDeps)
  
  // Domain service compositions
  const domainServices = {
    /**
     * Create project with full structure (tickets, files, etc.)
     */
    async createProjectWithStructure(data: {
      project: any
      tickets?: any[]
      initialFiles?: any[]
      prompts?: any[]
    }) {
      const { project: projectData, tickets = [], initialFiles = [], prompts = [] } = data
      
      // Create project first
      const project = await projectService.create(projectData)
      
      // Create associated resources in parallel where possible
      const results = await Promise.allSettled([
        // Create tickets if provided
        tickets.length > 0 
          ? Promise.all(tickets.map(ticket => 
              ticketService.create({ ...ticket, projectId: project.id })
            ))
          : Promise.resolve([]),
          
        // Create initial files if provided (temporarily disabled)
        // initialFiles.length > 0
        //   ? fileService.batch.createFiles(project.id, initialFiles)
        //   : Promise.resolve([]),
        Promise.resolve([]), // Placeholder
          
        // Create prompts if provided (TODO: Re-enable when prompt service is migrated)
        // prompts.length > 0
        //   ? Promise.all(prompts.map(prompt =>
        //       promptService.create({ ...prompt, projectId: project.id })
        //     ))
        //   : Promise.resolve([])
        Promise.resolve([]) // Placeholder
      ])
      
      const [ticketResults, fileResults, promptResults] = results
      
      return {
        project,
        tickets: ticketResults.status === 'fulfilled' ? ticketResults.value : [],
        files: fileResults.status === 'fulfilled' ? fileResults.value : [],
        prompts: promptResults.status === 'fulfilled' ? promptResults.value : [],
        errors: results.filter(r => r.status === 'rejected').map(r => (r as any).reason)
      }
    },
    
    /**
     * Delete project and all associated data (cascade delete)
     */
    async deleteProjectCascade(projectId: number) {
      // Delete in proper order to maintain referential integrity
      
      // 1. Delete queue items related to this project (TODO: Implement deleteByProject in queue service)
      // await queueService.deleteByProject(projectId)
      
      // 2. Delete chat sessions (TODO: Re-enable when chat service is migrated)
      // await chatService.deleteByProject(projectId)
      
      // 3. Delete tickets (which cascades to tasks)
      const tickets = await ticketService.getByProject(projectId)
      for (const ticket of tickets) {
        if (ticketService.delete) {
          await ticketService.delete(ticket.id)
        }
      }
      
      // 4. Delete files (temporarily disabled)
      // const files = await fileService.getByProject(projectId)
      // if (files.length > 0) {
      //   await fileService.batch.deleteFiles(projectId, files.map(f => f.id))
      // }
      
      // 5. Delete prompts (TODO: Re-enable when prompt service is migrated)
      // const prompts = await promptService.getByProject(projectId)
      // for (const prompt of prompts) {
      //   await promptService.delete(prompt.id)
      // }
      
      // 6. Finally delete the project
      if (projectService.delete) {
        await projectService.delete(projectId)
      }
      
      logger.info(`Cascade deleted project ${projectId} and all associated data`)
    },
    
    /**
     * Get comprehensive project dashboard data
     */
    async getProjectDashboard(projectId: number) {
      const [
        project,
        tickets
        // TODO: Re-enable when services are migrated
        // prompts,
        // recentChats,
        // queueStats
      ] = await Promise.all([
        projectService.getById(projectId),
        ticketService.getByProject(projectId)
        // fileService.getByProject(projectId, { limit: 100 }), // Temporarily disabled
        // promptService.getByProject(projectId),
        // chatService.getRecentSessions(projectId, 5),
        // queueService.getProjectStats(projectId)
      ])
      
      const files: any[] = [] // Placeholder until file service is implemented
      const prompts: any[] = [] // Placeholder until prompt service is migrated
      const recentChats: any[] = [] // Placeholder until chat service is migrated
      const queueStats = { queuedItems: 0, inProgressItems: 0 } // Placeholder until queue service method is available
      
      // Calculate statistics
      const stats = {
        totalTickets: tickets.length,
        openTickets: tickets.filter(t => t.status !== 'closed').length,
        totalFiles: files.length,
        totalPrompts: prompts.length,
        queuedItems: queueStats.queuedItems,
        inProgressItems: queueStats.inProgressItems
      }
      
      return {
        project,
        stats,
        recentTickets: tickets.slice(0, 10),
        recentFiles: files.slice(0, 20),
        recentPrompts: prompts.slice(0, 10),
        recentChats,
        queueStats
      }
    }
  }
  
  // Container instance
  const container: ServiceContainer = {
    // Core services
    project: projectService,
    ticket: ticketService,
    // prompt: promptService, // TODO: Migrate prompt service
    // file: fileService, // Temporarily disabled
    // chat: chatService, // TODO: Migrate chat service
    queue: queueService,
    
    // Domain compositions
    domain: domainServices,
    
    // Container management
    async dispose() {
      logger.info('Disposing service container...')
      
      // Dispose services in reverse dependency order
      const disposePromises = [
        queueService,
        // chatService, // TODO: Migrate chat service
        ticketService,
        // promptService, // TODO: Migrate prompt service
        // fileService, // Temporarily disabled
        projectService
      ].filter(Boolean).map(service => {
        if (typeof (service as any).dispose === 'function') {
          return (service as any).dispose()
        }
        return Promise.resolve()
      })
      
      await Promise.allSettled(disposePromises)
      logger.info('Service container disposed')
    },
    
    async health() {
      const serviceChecks = {
        project: true,
        ticket: true,
        // prompt: true, // TODO: Migrate prompt service
        // file: true, // Temporarily disabled
        // chat: true, // TODO: Migrate chat service
        queue: true
      }
      
      // Perform basic health checks (could be expanded)
      try {
        // Test repository connections
        await Promise.all([
          repos.project.count(),
          repos.ticket.count(),
          repos.task.count(),
          repos.queue.count()
          // repos.prompt.count(), // TODO: Migrate prompt service
          // repos.chat.count() // TODO: Migrate chat service
        ])
      } catch (error) {
        logger.error('Health check failed:', error)
        Object.keys(serviceChecks).forEach(key => {
          serviceChecks[key as keyof typeof serviceChecks] = false
        })
      }
      
      const healthy = Object.values(serviceChecks).every(status => status)
      
      return {
        healthy,
        services: serviceChecks
      }
    }
  }
  
  logger.info('Service container initialized with all services')
  return container
}

// Export default container instance
export const serviceContainer = createServiceContainer()

// Export factory function for testing
export function createTestServiceContainer(mockRepositories: any = {}): ServiceContainer {
  return createServiceContainer({
    repositories: mockRepositories,
    monitoring: { enabled: false }
  })
}

// Export individual services for backward compatibility (prefixed to avoid conflicts)
export const {
  project: modernProjectService,
  ticket: modernTicketService,
  // prompt: modernPromptService, // TODO: Migrate prompt service
  // file: fileService, // Temporarily disabled
  // chat: modernChatService, // TODO: Migrate chat service
  queue: modernQueueService
} = serviceContainer