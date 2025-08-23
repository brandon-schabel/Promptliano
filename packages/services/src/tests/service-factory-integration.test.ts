/**
 * Service Factory Integration Tests
 * Validates the new functional service patterns work correctly
 */

import { test, expect, describe, beforeEach } from 'bun:test'
import { createProjectService } from '../project-service-v2'
import { createTicketService, createTaskService } from '../ticket-service-v2'
import { createChatService } from '../chat-service-v2'
import { createQueueService } from '../queue-service-v2'
import { createProjectDomainService } from '../project-domain-service'

// Mock repositories for testing
const mockProjectRepository = {
  create: async (data: any) => ({ id: 1, ...data, createdAt: Date.now(), updatedAt: Date.now() }),
  getById: async (id: number) => id === 1 ? { id: 1, name: 'Test Project', path: '/test', createdAt: Date.now(), updatedAt: Date.now() } : null,
  getByPath: async (path: string) => path === '/test' ? { id: 1, name: 'Test Project', path: '/test', createdAt: Date.now(), updatedAt: Date.now() } : null,
  getAll: async () => [{ id: 1, name: 'Test Project', path: '/test', createdAt: Date.now(), updatedAt: Date.now() }],
  update: async (id: number, data: any) => ({ id, ...data, updatedAt: Date.now() }),
  delete: async (id: number) => true,
  exists: async (id: number) => id === 1,
  count: async () => 1,
  createMany: async (items: any[]) => items.map((item, i) => ({ id: i + 1, ...item, createdAt: Date.now(), updatedAt: Date.now() })),
  getWithAllRelations: async (id: number) => ({
    id: 1,
    name: 'Test Project',
    path: '/test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tickets: [],
    chats: [],
    prompts: [],
    queues: []
  })
}

const mockTicketRepository = {
  create: async (data: any) => ({ id: 1, ...data, createdAt: Date.now(), updatedAt: Date.now() }),
  getById: async (id: number) => id === 1 ? { id: 1, projectId: 1, title: 'Test Ticket', overview: 'Test overview', status: 'open', priority: 'normal', createdAt: Date.now(), updatedAt: Date.now() } : null,
  getAll: async () => [{ id: 1, projectId: 1, title: 'Test Ticket', overview: 'Test overview', status: 'open', priority: 'normal', createdAt: Date.now(), updatedAt: Date.now() }],
  update: async (id: number, data: any) => ({ id, ...data, updatedAt: Date.now() }),
  delete: async (id: number) => true,
  exists: async (id: number) => id === 1,
  count: async () => 1,
  createMany: async (items: any[]) => items.map((item, i) => ({ id: i + 1, ...item, createdAt: Date.now(), updatedAt: Date.now() })),
  getByProject: async (projectId: number) => [{ id: 1, projectId, title: 'Test Ticket', overview: 'Test overview', status: 'open', priority: 'normal', createdAt: Date.now(), updatedAt: Date.now() }]
}

const mockTaskRepository = {
  create: async (data: any) => ({ id: 1, ...data, createdAt: Date.now(), updatedAt: Date.now() }),
  getById: async (id: number) => id === 1 ? { id: 1, ticketId: 1, content: 'Test Task', status: 'pending', priority: 'normal', position: 0, createdAt: Date.now(), updatedAt: Date.now() } : null,
  getAll: async () => [{ id: 1, ticketId: 1, content: 'Test Task', status: 'pending', priority: 'normal', position: 0, createdAt: Date.now(), updatedAt: Date.now() }],
  update: async (id: number, data: any) => ({ id, ...data, updatedAt: Date.now() }),
  delete: async (id: number) => true,
  exists: async (id: number) => id === 1,
  count: async () => 1,
  createMany: async (items: any[]) => items.map((item, i) => ({ id: i + 1, ...item, createdAt: Date.now(), updatedAt: Date.now() })),
  getByTicket: async (ticketId: number) => [{ id: 1, ticketId, content: 'Test Task', status: 'pending', priority: 'normal', position: 0, createdAt: Date.now(), updatedAt: Date.now() }]
}

const mockChatRepository = {
  create: async (data: any) => ({ id: 1, ...data, createdAt: Date.now(), updatedAt: Date.now() }),
  getById: async (id: number) => id === 1 ? { id: 1, projectId: 1, name: 'Test Chat', createdAt: Date.now(), updatedAt: Date.now() } : null,
  getAll: async () => [{ id: 1, projectId: 1, name: 'Test Chat', createdAt: Date.now(), updatedAt: Date.now() }],
  update: async (id: number, data: any) => ({ id, ...data, updatedAt: Date.now() }),
  delete: async (id: number) => true,
  exists: async (id: number) => id === 1,
  count: async () => 1,
  createMany: async (items: any[]) => items.map((item, i) => ({ id: i + 1, ...item, createdAt: Date.now(), updatedAt: Date.now() })),
  getByProject: async (projectId: number) => [{ id: 1, projectId, name: 'Test Chat', createdAt: Date.now(), updatedAt: Date.now() }],
  getMessages: async (chatId: number, options: any) => [],
  addMessage: async (chatId: number, message: any) => ({ id: 1, chatId, ...message, createdAt: Date.now() }),
  countMessages: async (chatId: number) => 0
}

const mockQueueRepository = {
  create: async (data: any) => ({ id: 1, ...data, createdAt: Date.now(), updatedAt: Date.now() }),
  getById: async (id: number) => id === 1 ? { id: 1, projectId: 1, name: 'Test Queue', status: 'active', maxParallelItems: 3, createdAt: Date.now(), updatedAt: Date.now() } : null,
  getAll: async () => [{ id: 1, projectId: 1, name: 'Test Queue', status: 'active', maxParallelItems: 3, createdAt: Date.now(), updatedAt: Date.now() }],
  update: async (id: number, data: any) => ({ id, ...data, updatedAt: Date.now() }),
  delete: async (id: number) => true,
  exists: async (id: number) => id === 1,
  count: async () => 1,
  createMany: async (items: any[]) => items.map((item, i) => ({ id: i + 1, ...item, createdAt: Date.now(), updatedAt: Date.now() })),
  getByProject: async (projectId: number) => [{ id: 1, projectId, name: 'Test Queue', status: 'active', maxParallelItems: 3, createdAt: Date.now(), updatedAt: Date.now() }],
  getItems: async (queueId: number) => [],
  addItem: async (queueId: number, item: any) => ({ id: 1, queueId, ...item, createdAt: Date.now(), updatedAt: Date.now() }),
  updateItem: async (itemId: number, data: any) => ({ id: itemId, ...data, updatedAt: Date.now() }),
  getItemById: async (itemId: number) => ({ id: itemId, queueId: 1, type: 'ticket', title: 'Test Item', status: 'queued', priority: 5, createdAt: Date.now(), updatedAt: Date.now() }),
  removeItem: async (itemId: number) => true
}

describe('Service Factory Integration', () => {
  describe('Project Service V2', () => {
    test('should create project service with CRUD operations', async () => {
      const projectService = createProjectService({
        repository: mockProjectRepository
      })
      
      // Test create
      const project = await projectService.create({
        name: 'Test Project',
        path: '/test/path',
        description: 'Test description'
      })
      
      expect(project.id).toBe(1)
      expect(project.name).toBe('Test Project')
      
      // Test getById
      const retrieved = await projectService.getById(1)
      expect(retrieved.id).toBe(1)
      
      // Test getByPath (extension method)
      const byPath = await projectService.getByPath('/test')
      expect(byPath?.id).toBe(1)
      
      // Test update
      const updated = await projectService.update(1, { name: 'Updated Project' })
      expect(updated.name).toBe('Updated Project')
      
      // Test exists
      const exists = await projectService.exists(1)
      expect(exists).toBe(true)
    })
    
    test('should handle not found errors consistently', async () => {
      const projectService = createProjectService({
        repository: mockProjectRepository
      })
      
      expect(async () => {
        await projectService.getById(999)
      }).toThrow('Project with ID 999 not found')
    })
  })

  describe('Ticket Service V2', () => {
    test('should create ticket service with domain extensions', async () => {
      const ticketService = createTicketService({
        ticketRepository: mockTicketRepository,
        taskRepository: mockTaskRepository
      })
      
      // Test create
      const ticket = await ticketService.create({
        projectId: 1,
        title: 'Test Ticket',
        overview: 'Test overview',
        status: 'open',
        priority: 'normal'
      })
      
      expect(ticket.id).toBe(1)
      expect(ticket.title).toBe('Test Ticket')
      
      // Test getByProject (extension method)
      const projectTickets = await ticketService.getByProject(1)
      expect(projectTickets).toHaveLength(1)
      expect(projectTickets[0].id).toBe(1)
      
      // Test getWithTasks (extension method)
      const withTasks = await ticketService.getWithTasks(1)
      expect(withTasks.tasks).toHaveLength(1)
      expect(withTasks.tasks[0].content).toBe('Test Task')
    })
  })

  describe('Chat Service V2', () => {
    test('should create chat service with messaging capabilities', async () => {
      const chatService = createChatService({
        chatRepository: mockChatRepository
      })
      
      // Test createSession
      const { chat, message } = await chatService.createSession({
        projectId: 1,
        name: 'Test Chat',
        initialMessage: 'Hello, world!'
      })
      
      expect(chat.id).toBe(1)
      expect(chat.name).toBe('Test Chat')
      expect(message?.content).toBe('Hello, world!')
      
      // Test addMessage
      const addedMessage = await chatService.addMessage(1, {
        role: 'user',
        content: 'Test message'
      })
      
      expect(addedMessage.role).toBe('user')
      expect(addedMessage.content).toBe('Test message')
    })
  })

  describe('Queue Service V2', () => {
    test('should create queue service with item management', async () => {
      const queueService = createQueueService({
        queueRepository: mockQueueRepository
      })
      
      // Test create
      const queue = await queueService.create({
        projectId: 1,
        name: 'Test Queue',
        description: 'Test queue description',
        status: 'active',
        maxParallelItems: 3
      })
      
      expect(queue.id).toBe(1)
      expect(queue.name).toBe('Test Queue')
      
      // Test enqueue
      const item = await queueService.enqueue(1, {
        type: 'ticket',
        title: 'Test Item',
        description: 'Test item description',
        priority: 5
      })
      
      expect(item.id).toBe(1)
      expect(item.title).toBe('Test Item')
      expect(item.status).toBe('queued')
    })
  })

  describe('Project Domain Service', () => {
    test('should compose services for complex operations', async () => {
      const projectService = createProjectService({ repository: mockProjectRepository })
      const ticketService = createTicketService({ 
        ticketRepository: mockTicketRepository,
        taskRepository: mockTaskRepository
      })
      const chatService = createChatService({ chatRepository: mockChatRepository })
      const queueService = createQueueService({ queueRepository: mockQueueRepository })
      
      const domainService = createProjectDomainService({
        projectService,
        ticketService,
        chatService,
        queueService
      })
      
      // Test createProjectWithStructure
      const result = await domainService.createProjectWithStructure({
        name: 'Test Project',
        path: '/test',
        description: 'Test project description',
        createQueue: true,
        createChat: true,
        initialTickets: [
          {
            title: 'Initial Ticket',
            overview: 'First ticket for the project'
          }
        ]
      })
      
      expect(result.project.name).toBe('Test Project')
      expect(result.queue).toBeDefined()
      expect(result.chat).toBeDefined()
      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].ticket.title).toBe('Initial Ticket')
    })
    
    test('should provide comprehensive dashboard data', async () => {
      const projectService = createProjectService({ repository: mockProjectRepository })
      const ticketService = createTicketService({ 
        ticketRepository: mockTicketRepository,
        taskRepository: mockTaskRepository
      })
      const chatService = createChatService({ chatRepository: mockChatRepository })
      const queueService = createQueueService({ queueRepository: mockQueueRepository })
      
      const domainService = createProjectDomainService({
        projectService,
        ticketService,
        chatService,
        queueService
      })
      
      const dashboard = await domainService.getProjectDashboard(1)
      
      expect(dashboard.project.id).toBe(1)
      expect(dashboard.stats).toBeDefined()
      expect(dashboard.tickets).toBeDefined()
      expect(dashboard.queues).toBeDefined()
      expect(dashboard.chats).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    test('should provide consistent error handling across services', async () => {
      const projectService = createProjectService({
        repository: mockProjectRepository
      })
      
      // Test not found error
      try {
        await projectService.getById(999)
        expect(false).toBe(true) // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404)
        expect(error.message).toContain('Project with ID 999 not found')
      }
      
      // Test update of non-existent entity
      try {
        await projectService.update(999, { name: 'Updated' })
        expect(false).toBe(true) // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404)
        expect(error.message).toContain('Project with ID 999 not found')
      }
    })
  })

  describe('Dependency Injection', () => {
    test('should support dependency injection for testing', () => {
      const customLogger = {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {}
      }
      
      const projectService = createProjectService({
        repository: mockProjectRepository,
        logger: customLogger
      })
      
      // Service should work with injected dependencies
      expect(projectService).toBeDefined()
      expect(typeof projectService.create).toBe('function')
      expect(typeof projectService.getById).toBe('function')
    })
  })
})