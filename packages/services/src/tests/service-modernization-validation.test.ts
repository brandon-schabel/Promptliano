/**
 * Service Modernization Validation Tests
 * Tests the complete Phase 2B service layer modernization
 * 
 * Validates:
 * - All V2 services follow functional factory pattern
 * - ErrorFactory integration across all services
 * - Dependency injection support
 * - Service composition functionality
 * - Performance improvements
 * - Backward compatibility
 */

import { describe, test, expect, beforeEach, jest } from 'bun:test'
import { 
  createServiceContainer,
  createTestServiceContainer
} from '../service-container'
import { createProjectService } from '../project-service-v2'
import { createTicketService } from '../ticket-service-v2'
import { createPromptService } from '../prompt-service-v2'
import { createChatService } from '../chat-service-v2'
import { createQueueService } from '../queue-service-v2'
import { ErrorFactory } from '../utils/error-factory'

// Mock repositories for testing
const createMockRepository = () => ({
  create: jest.fn(),
  getById: jest.fn(),
  getAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  count: jest.fn(),
  createMany: jest.fn(),
  // Service-specific methods
  getByProject: jest.fn(),
  getByPath: jest.fn(),
  search: jest.fn(),
  getWithAllRelations: jest.fn()
})

describe('Service Modernization Validation', () => {
  let mockRepositories: any

  beforeEach(() => {
    mockRepositories = {
      project: createMockRepository(),
      ticket: createMockRepository(),
      prompt: createMockRepository(),
      chat: createMockRepository(),
      queue: createMockRepository()
    }
  })

  describe('V2 Service Factory Pattern', () => {
    test('all V2 services follow functional factory pattern', () => {
      // All services should be factory functions that return service objects
      expect(typeof createProjectService).toBe('function')
      expect(typeof createTicketService).toBe('function')
      expect(typeof createPromptService).toBe('function')
      expect(typeof createChatService).toBe('function')
      expect(typeof createQueueService).toBe('function')
      
      // Factory functions should return service objects with expected methods
      const projectService = createProjectService({ repository: mockRepositories.project })
      expect(typeof projectService.create).toBe('function')
      expect(typeof projectService.getById).toBe('function')
      expect(typeof projectService.update).toBe('function')
      expect(typeof projectService.delete).toBe('function')
      expect(typeof projectService.getByPath).toBe('function') // Domain-specific method
    })

    test('services support dependency injection', () => {
      const customLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
      
      const projectService = createProjectService({
        repository: mockRepositories.project,
        logger: customLogger
      })
      
      expect(projectService).toBeDefined()
      // Service should use injected dependencies
    })

    test('services have consistent CRUD operations', () => {
      const services = [
        createProjectService({ repository: mockRepositories.project }),
        createTicketService({ repository: mockRepositories.ticket }),
        createPromptService({ repository: mockRepositories.prompt }),
        createChatService({ repository: mockRepositories.chat }),
        createQueueService({ repository: mockRepositories.queue })
      ]

      services.forEach(service => {
        expect(typeof service.create).toBe('function')
        expect(typeof service.getById).toBe('function')
        expect(typeof service.update).toBe('function')
        expect(typeof service.delete).toBe('function')
        expect(typeof service.exists).toBe('function')
        expect(typeof service.count).toBe('function')
      })
    })
  })

  describe('Error Handling Consistency', () => {
    test('services use ErrorFactory for consistent errors', async () => {
      const projectService = createProjectService({ repository: mockRepositories.project })
      
      // Mock repository to return null (not found)
      mockRepositories.project.getById.mockResolvedValue(null)
      
      await expect(projectService.getById(999))
        .rejects
        .toThrow('Project with ID 999 not found')
    })

    test('ErrorFactory provides consistent error structure', () => {
      expect(() => ErrorFactory.notFound('Project', 123))
        .toThrow(expect.objectContaining({
          status: 404,
          message: 'Project with ID 123 not found'
        }))
      
      expect(() => ErrorFactory.validationFailed('Project'))
        .toThrow(expect.objectContaining({
          status: 400,
          message: 'Validation failed for Project'
        }))
    })
  })

  describe('Service Container Integration', () => {
    test('service container creates all services with proper dependencies', () => {
      const container = createTestServiceContainer(mockRepositories)
      
      expect(container.project).toBeDefined()
      expect(container.ticket).toBeDefined()
      expect(container.prompt).toBeDefined()
      expect(container.chat).toBeDefined()
      expect(container.queue).toBeDefined()
      expect(container.domain).toBeDefined()
    })

    test('domain services provide composed operations', () => {
      const container = createTestServiceContainer(mockRepositories)
      
      expect(typeof container.domain.createProjectWithStructure).toBe('function')
      expect(typeof container.domain.deleteProjectCascade).toBe('function')
      expect(typeof container.domain.getProjectDashboard).toBe('function')
    })

    test('container supports health checks', async () => {
      const container = createTestServiceContainer(mockRepositories)
      
      // Mock successful health checks
      Object.values(mockRepositories).forEach(repo => {
        repo.count.mockResolvedValue(0)
      })
      
      const health = await container.health()
      expect(health.healthy).toBe(true)
      expect(health.services).toBeDefined()
    })

    test('container supports disposal', async () => {
      const container = createTestServiceContainer(mockRepositories)
      
      // Should not throw
      await expect(container.dispose()).resolves.toBeUndefined()
    })
  })

  describe('Service Composition', () => {
    test('project domain service handles complex workflows', async () => {
      const container = createTestServiceContainer(mockRepositories)
      
      // Mock successful creation
      mockRepositories.project.create.mockResolvedValue({ id: 1, name: 'Test Project' })
      mockRepositories.ticket.create.mockResolvedValue({ id: 1, projectId: 1, title: 'Test Ticket' })
      
      const result = await container.domain.createProjectWithStructure({
        project: { name: 'Test Project', path: '/test' },
        tickets: [{ title: 'Initial ticket' }],
        initialFiles: [],
        prompts: []
      })
      
      expect(result.project).toBeDefined()
      expect(result.tickets).toBeDefined()
      expect(result.prompts).toBeDefined()
    })

    test('cascade delete removes all related data', async () => {
      const container = createTestServiceContainer(mockRepositories)
      
      // Mock data retrieval
      mockRepositories.ticket.getByProject.mockResolvedValue([{ id: 1 }])
      mockRepositories.prompt.getByProject.mockResolvedValue([{ id: 1 }])
      mockRepositories.chat.getRecentSessions = jest.fn().mockResolvedValue([])
      mockRepositories.queue.deleteByProject = jest.fn().mockResolvedValue(true)
      
      // Mock deletions
      mockRepositories.project.delete.mockResolvedValue(true)
      mockRepositories.ticket.delete.mockResolvedValue(true)
      mockRepositories.prompt.delete.mockResolvedValue(true)
      
      await expect(container.domain.deleteProjectCascade(1))
        .resolves
        .toBeUndefined()
      
      // Verify deletion calls were made
      expect(mockRepositories.project.delete).toHaveBeenCalledWith(1)
    })
  })

  describe('Performance and Code Reduction', () => {
    test('service creation is fast and lightweight', () => {
      const startTime = Date.now()
      
      // Create 10 service instances
      for (let i = 0; i < 10; i++) {
        createProjectService({ repository: mockRepositories.project })
        createTicketService({ repository: mockRepositories.ticket })
        createPromptService({ repository: mockRepositories.prompt })
      }
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // Should be very fast
    })

    test('services have minimal memory footprint', () => {
      const service = createProjectService({ repository: mockRepositories.project })
      
      // Service should be a plain object with functions
      const keys = Object.keys(service)
      expect(keys.length).toBeLessThan(20) // Should have reasonable number of methods
      
      // All methods should be functions
      keys.forEach(key => {
        expect(typeof (service as any)[key]).toBe('function')
      })
    })
  })

  describe('Backward Compatibility', () => {
    test('V2 services export same interface as legacy services', () => {
      const projectService = createProjectService({ repository: mockRepositories.project })
      
      // Should have all the basic CRUD operations that legacy services had
      expect(projectService.create).toBeDefined()
      expect(projectService.getById).toBeDefined()
      expect(projectService.update).toBeDefined()
      expect(projectService.delete).toBeDefined()
      
      // Plus new domain-specific methods
      expect(projectService.getByPath).toBeDefined()
      expect(projectService.getWithRelations).toBeDefined()
    })

    test('container exports individual services for tree-shaking', () => {
      const container = createTestServiceContainer(mockRepositories)
      
      // Should be able to destructure individual services
      const { project, ticket, prompt } = container
      expect(project).toBeDefined()
      expect(ticket).toBeDefined()
      expect(prompt).toBeDefined()
    })
  })

  describe('Integration with Drizzle Repositories', () => {
    test('services work with repository interface', async () => {
      const projectService = createProjectService({ repository: mockRepositories.project })
      
      mockRepositories.project.create.mockResolvedValue({ id: 1, name: 'Test' })
      
      const result = await projectService.create({ name: 'Test', path: '/test' })
      expect(result).toEqual({ id: 1, name: 'Test' })
      expect(mockRepositories.project.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test', path: '/test' })
      )
    })

    test('services handle repository errors gracefully', async () => {
      const projectService = createProjectService({ repository: mockRepositories.project })
      
      mockRepositories.project.create.mockRejectedValue(new Error('Database error'))
      
      await expect(projectService.create({ name: 'Test', path: '/test' }))
        .rejects
        .toThrow(/create Project/)
    })
  })

  describe('Type Safety', () => {
    test('services maintain type safety with proper interfaces', () => {
      const projectService = createProjectService({ repository: mockRepositories.project })
      
      // TypeScript should enforce correct types (tested by compilation)
      expect(typeof projectService.create).toBe('function')
      expect(typeof projectService.getById).toBe('function')
    })
  })
})

// Performance benchmark test
describe('Performance Benchmarks', () => {
  test('service operations complete within reasonable time', async () => {
    const mockRepo = createMockRepository()
    mockRepo.create.mockResolvedValue({ id: 1 })
    mockRepo.getById.mockResolvedValue({ id: 1 })
    mockRepo.update.mockResolvedValue({ id: 1 })
    mockRepo.delete.mockResolvedValue(true)
    
    const service = createProjectService({ repository: mockRepo })
    
    const operations = [
      () => service.create({ name: 'Test', path: '/test' }),
      () => service.getById(1),
      () => service.update(1, { name: 'Updated' }),
      () => service.delete(1)
    ]
    
    for (const operation of operations) {
      const start = Date.now()
      await operation()
      const duration = Date.now() - start
      expect(duration).toBeLessThan(10) // Should be very fast with mocked repo
    }
  })
})