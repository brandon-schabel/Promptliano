/**
 * Simple Service Factory Tests
 * Tests the core service factory patterns without database dependencies
 */

import { test, expect, describe } from 'bun:test'
import { createCrudService, withErrorContext, createServiceLogger } from '../core/base-service'
import { ErrorFactory } from '../utils/error-factory'

// Simple mock repository for testing
const createMockRepository = () => {
  const data = new Map<number, any>()
  let idCounter = 1

  return {
    create: async (item: any) => {
      const newItem = { id: idCounter++, ...item, createdAt: Date.now(), updatedAt: Date.now() }
      data.set(newItem.id, newItem)
      return newItem
    },
    getById: async (id: number) => data.get(id) || null,
    getAll: async () => Array.from(data.values()),
    update: async (id: number, updates: any) => {
      const existing = data.get(id)
      if (!existing) return null
      const updated = { ...existing, ...updates, updatedAt: Date.now() }
      data.set(id, updated)
      return updated
    },
    delete: async (id: number) => {
      const exists = data.has(id)
      data.delete(id)
      return exists
    },
    exists: async (id: number) => data.has(id),
    count: async () => data.size,
    createMany: async (items: any[]) => {
      return items.map(item => {
        const newItem = { id: idCounter++, ...item, createdAt: Date.now(), updatedAt: Date.now() }
        data.set(newItem.id, newItem)
        return newItem
      })
    },
    // Helper to reset data
    clear: () => {
      data.clear()
      idCounter = 1
    }
  }
}

describe('Service Factory Core', () => {
  test('should create CRUD service with basic operations', async () => {
    const mockRepo = createMockRepository()
    
    const service = createCrudService({
      entityName: 'TestEntity',
      repository: mockRepo
    })
    
    // Test create
    const created = await service.create({ name: 'Test Item', description: 'Test description' })
    expect(created.id).toBe(1)
    expect(created.name).toBe('Test Item')
    expect(created.createdAt).toBeGreaterThan(0)
    
    // Test getById
    const retrieved = await service.getById(1)
    expect(retrieved.id).toBe(1)
    expect(retrieved.name).toBe('Test Item')
    
    // Test findById (returns null if not found)
    const notFound = await service.findById(999)
    expect(notFound).toBeNull()
    
    // Test getAll
    const all = await service.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(1)
    
    // Test update (add small delay to ensure different timestamp)
    await new Promise(resolve => setTimeout(resolve, 1))
    const updated = await service.update(1, { name: 'Updated Item' })
    expect(updated.name).toBe('Updated Item')
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt)
    
    // Test exists
    const exists = await service.exists(1)
    expect(exists).toBe(true)
    
    const notExists = await service.exists(999)
    expect(notExists).toBe(false)
    
    // Test count
    const count = await service.count()
    expect(count).toBe(1)
    
    // Test delete
    const deleted = await service.delete(1)
    expect(deleted).toBe(true)
    
    const countAfterDelete = await service.count()
    expect(countAfterDelete).toBe(0)
  })
  
  test('should handle errors consistently', async () => {
    const mockRepo = createMockRepository()
    
    const service = createCrudService({
      entityName: 'TestEntity',
      repository: mockRepo
    })
    
    // Test not found error
    try {
      await service.getById(999)
      expect(false).toBe(true) // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(404)
      expect(error.message).toContain('TestEntity with ID 999 not found')
    }
    
    // Test update of non-existent entity
    try {
      await service.update(999, { name: 'Updated' })
      expect(false).toBe(true) // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(404)
      expect(error.message).toContain('TestEntity with ID 999 not found')
    }
    
    // Test delete of non-existent entity
    try {
      await service.delete(999)
      expect(false).toBe(true) // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(404)
      expect(error.message).toContain('TestEntity with ID 999 not found')
    }
  })
  
  test('should support batch operations', async () => {
    const mockRepo = createMockRepository()
    
    const service = createCrudService({
      entityName: 'TestEntity',
      repository: mockRepo
    })
    
    // Test batch create
    const items = [
      { name: 'Item 1', value: 10 },
      { name: 'Item 2', value: 20 },
      { name: 'Item 3', value: 30 }
    ]
    
    const created = await service.batch.create(items)
    expect(created).toHaveLength(3)
    expect(created[0].name).toBe('Item 1')
    expect(created[1].name).toBe('Item 2')
    expect(created[2].name).toBe('Item 3')
    
    // Verify all items were created
    const all = await service.getAll()
    expect(all).toHaveLength(3)
  })
  
  test('should support custom logger injection', () => {
    const mockRepo = createMockRepository()
    const logMessages: string[] = []
    
    const customLogger = {
      info: (msg: string) => logMessages.push(`INFO: ${msg}`),
      error: (msg: string) => logMessages.push(`ERROR: ${msg}`),
      warn: (msg: string) => logMessages.push(`WARN: ${msg}`),
      debug: (msg: string) => logMessages.push(`DEBUG: ${msg}`)
    }
    
    const service = createCrudService({
      entityName: 'TestEntity',
      repository: mockRepo,
      logger: customLogger
    })
    
    expect(service).toBeDefined()
    expect(typeof service.create).toBe('function')
  })
})

describe('Error Factory', () => {
  test('should create consistent error types', () => {
    try {
      ErrorFactory.notFound('TestEntity', 123)
    } catch (error: any) {
      expect(error.status).toBe(404)
      expect(error.message).toBe('TestEntity with ID 123 not found')
      expect(error.code).toBe('TESTENTITY_NOT_FOUND')
    }
    
    try {
      ErrorFactory.validationFailed('TestEntity', { field: 'name' })
    } catch (error: any) {
      expect(error.status).toBe(400)
      expect(error.message).toBe('Validation failed for TestEntity')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.details).toEqual({ field: 'name' })
    }
    
    try {
      ErrorFactory.operationFailed('test operation', 'something went wrong')
    } catch (error: any) {
      expect(error.status).toBe(500)
      expect(error.message).toBe('something went wrong')
      expect(error.code).toBe('TEST_OPERATION_FAILED')
    }
  })
  
  test('should create entity-specific error factory', () => {
    const entityErrors = ErrorFactory.forEntity('Project')
    
    try {
      entityErrors.notFound(456)
    } catch (error: any) {
      expect(error.status).toBe(404)
      expect(error.message).toBe('Project with ID 456 not found')
    }
    
    try {
      entityErrors.createFailed('database connection failed')
    } catch (error: any) {
      expect(error.status).toBe(500)
      expect(error.message).toBe('Failed to create Project: database connection failed')
    }
  })
})

describe('Error Context Wrapper', () => {
  test('should wrap operations with error context', async () => {
    const operation = async () => {
      throw new Error('Something went wrong')
    }
    
    try {
      await withErrorContext(operation, {
        entity: 'TestEntity',
        action: 'test',
        id: 123
      })
    } catch (error: any) {
      expect(error.status).toBe(500)
      expect(error.message).toBe('Something went wrong') // The reason becomes the message
      expect(error.code).toBe('TEST_TESTENTITY_(ID:_123)_FAILED')
    }
  })
  
  test('should pass through API errors unchanged', async () => {
    const operation = async () => {
      throw ErrorFactory.notFound('TestEntity', 123)
    }
    
    try {
      await withErrorContext(operation, {
        entity: 'TestEntity',
        action: 'test'
      })
    } catch (error: any) {
      expect(error.status).toBe(404)
      expect(error.message).toBe('TestEntity with ID 123 not found')
    }
  })
})

describe('Service Logger', () => {
  test('should create logger with service name', () => {
    const logger = createServiceLogger('TestService')
    
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })
})

describe('Service Integration Patterns', () => {
  test('should demonstrate complete CRUD workflow', async () => {
    const mockRepo = createMockRepository()
    
    const service = createCrudService({
      entityName: 'Project',
      repository: mockRepo
    })
    
    // Create project
    const project = await service.create({
      name: 'Test Project',
      path: '/test/path',
      description: 'A test project'
    })
    
    expect(project.id).toBe(1)
    expect(project.name).toBe('Test Project')
    
    // Get project
    const retrieved = await service.getById(1)
    expect(retrieved.name).toBe('Test Project')
    
    // Update project
    const updated = await service.update(1, {
      name: 'Updated Project',
      description: 'Updated description'
    })
    
    expect(updated.name).toBe('Updated Project')
    expect(updated.description).toBe('Updated description')
    expect(updated.path).toBe('/test/path') // Should preserve unchanged fields
    
    // List projects
    const projects = await service.getAll()
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Updated Project')
    
    // Delete project
    const deleted = await service.delete(1)
    expect(deleted).toBe(true)
    
    // Verify deletion
    const count = await service.count()
    expect(count).toBe(0)
  })
})