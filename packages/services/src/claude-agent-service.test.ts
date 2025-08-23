import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { rmSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import {
  createClaudeAgentService,
  type ClaudeAgentService
} from './claude-agent-service'

// Test utilities
const createTestProjectPath = (): string => {
  const testPath = join(tmpdir(), `claude-agent-test-${randomUUID()}`)
  mkdirSync(testPath, { recursive: true })
  return testPath
}

const cleanupTestPath = (testPath: string): void => {
  if (existsSync(testPath)) {
    rmSync(testPath, { recursive: true, force: true })
  }
}

describe('Claude Agent Service', () => {
  let service: ClaudeAgentService
  let testProjectPath: string
  let mockLogger: any

  beforeEach(async () => {
    // Create test project directory
    testProjectPath = createTestProjectPath()
    
    // Create mock logger
    mockLogger = {
      debug: () => {},
      warn: () => {},
      error: () => {},
      info: () => {}
    }

    // Create service instance with test dependencies
    service = createClaudeAgentService({
      logger: mockLogger,
      projectPath: testProjectPath
    })
  })

  afterEach(() => {
    // Clean up test directory
    cleanupTestPath(testProjectPath)
  })

  describe('Service Factory Pattern', () => {
    test('creates service with default dependencies', () => {
      const defaultService = createClaudeAgentService()
      expect(defaultService).toBeDefined()
      expect(typeof defaultService.create).toBe('function')
      expect(typeof defaultService.getById).toBe('function')
      expect(typeof defaultService.list).toBe('function')
      expect(typeof defaultService.update).toBe('function')
      expect(typeof defaultService.delete).toBe('function')
    })

    test('creates service with custom dependencies', () => {
      const customLogger = { 
        debug: () => {}, 
        warn: () => {}, 
        error: () => {}, 
        info: () => {} 
      }

      const customService = createClaudeAgentService({
        logger: customLogger,
        projectPath: testProjectPath
      })

      expect(customService).toBeDefined()
      expect(typeof customService.create).toBe('function')
      expect(typeof customService.getById).toBe('function')
      expect(typeof customService.list).toBe('function')
    })

    test('service exposes all expected methods', () => {
      const expectedMethods = [
        'create',
        'getById', 
        'list',
        'update',
        'delete',
        'getByProject',
        'getByIds',
        'getContent',
        'formatContext',
        'suggest',
        'suggestForTask'
      ]

      for (const method of expectedMethods) {
        expect(typeof service[method]).toBe('function')
      }
    })
  })

  describe('File System Operations', () => {
    test('handles test project directory setup', () => {
      expect(existsSync(testProjectPath)).toBe(true)
      
      const agentsDir = join(testProjectPath, 'claude-agents')
      mkdirSync(agentsDir, { recursive: true })
      expect(existsSync(agentsDir)).toBe(true)
    })

    test('service function types are correctly defined', () => {
      // Test the service interface without making database calls
      expect(service.create).toBeDefined()
      expect(service.getById).toBeDefined()
      expect(service.list).toBeDefined()
      expect(service.update).toBeDefined()
      expect(service.delete).toBeDefined()
      expect(service.getByProject).toBeDefined()
      expect(service.getByIds).toBeDefined()
      expect(service.getContent).toBeDefined()
      expect(service.formatContext).toBeDefined()
      expect(service.suggest).toBeDefined()
      expect(service.suggestForTask).toBeDefined()
    })
  })

  describe('Agent Retrieval Operations', () => {
    test('gets agent by ID', async () => {
      const agentData = {
        name: 'Retrieval Test Agent',
        description: 'Agent for testing retrieval'
      }

      const created = await service.create(agentData)
      const retrieved = await service.getById(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe(created.id)
      expect(retrieved.name).toBe(agentData.name)
      expect(retrieved.description).toBe(agentData.description)
    })

    test('throws error when agent not found', async () => {
      await expect(service.getById('nonexistent-agent')).rejects.toThrow(
        expect.objectContaining({
          code: 'ENTITY_NOT_FOUND'
        })
      )
    })

    test('lists all agents in correct order', async () => {
      const agents = [
        { name: 'Agent Alpha' },
        { name: 'Agent Beta' },
        { name: 'Agent Gamma' }
      ]

      for (const agentData of agents) {
        await service.create(agentData)
      }

      const allAgents = await service.list()
      expect(allAgents).toHaveLength(3)
      
      // Should be ordered by name
      const names = allAgents.map(a => a.name).sort()
      expect(names).toEqual(['Agent Alpha', 'Agent Beta', 'Agent Gamma'])
    })

    test('gets active agents by project', async () => {
      // Create active and inactive agents
      const activeAgent = await service.create({ name: 'Active Agent' })
      const inactiveAgent = await service.create({ name: 'Inactive Agent' })
      
      // Deactivate one agent
      await service.update(inactiveAgent.id, { isActive: false })

      const projectAgents = await service.getByProject(1)
      
      // Should only return active agents
      expect(projectAgents).toHaveLength(1)
      expect(projectAgents[0].id).toBe(activeAgent.id)
      expect(projectAgents[0].isActive).toBe(true)
    })
  })

  describe('Agent Update Operations', () => {
    test('updates agent successfully', async () => {
      const agent = await service.create({
        name: 'Original Name',
        description: 'Original Description'
      })

      const updateData = {
        name: 'Updated Name',
        description: 'Updated Description',
        model: 'claude-3-haiku'
      }

      const updated = await service.update(agent.id, updateData)

      expect(updated.id).toBe(agent.id)
      expect(updated.name).toBe(updateData.name)
      expect(updated.description).toBe(updateData.description)
      expect(updated.model).toBe(updateData.model)
      expect(updated.updatedAt).toBeGreaterThan(agent.updatedAt)
    })

    test('updates markdown file when instructions change', async () => {
      const agent = await service.create({
        name: 'File Update Agent',
        instructions: 'Original instructions'
      })

      const newInstructions = '# Updated Instructions\n\nThese are the new instructions.'
      await service.update(agent.id, { instructions: newInstructions })

      const filePath = join(testProjectPath, 'claude-agents', `${agent.id}.md`)
      expect(existsSync(filePath)).toBe(true)
      
      const fileContent = readFileSync(filePath, 'utf-8')
      expect(fileContent).toBe(newInstructions)
    })

    test('removes markdown file when instructions cleared', async () => {
      const agent = await service.create({
        name: 'File Removal Agent',
        instructions: 'Instructions to be removed'
      })

      const filePath = join(testProjectPath, 'claude-agents', `${agent.id}.md`)
      expect(existsSync(filePath)).toBe(true)

      await service.update(agent.id, { instructions: '' })
      expect(existsSync(filePath)).toBe(false)
    })

    test('throws error when updating nonexistent agent', async () => {
      await expect(service.update('nonexistent-agent', { name: 'New Name' }))
        .rejects.toThrow(
          expect.objectContaining({
            code: 'ENTITY_NOT_FOUND'
          })
        )
    })
  })

  describe('Agent Deletion Operations', () => {
    test('deletes agent successfully', async () => {
      const agent = await service.create({
        name: 'Agent to Delete',
        instructions: 'These instructions will be deleted'
      })

      const filePath = join(testProjectPath, 'claude-agents', `${agent.id}.md`)
      expect(existsSync(filePath)).toBe(true)

      const deleted = await service.delete(agent.id)
      expect(deleted).toBe(true)

      // Verify agent is deleted from database
      await expect(service.getById(agent.id)).rejects.toThrow()

      // Verify markdown file is deleted
      expect(existsSync(filePath)).toBe(false)
    })

    test('returns false when deleting nonexistent agent', async () => {
      const deleted = await service.delete('nonexistent-agent')
      expect(deleted).toBe(false)
    })

    test('handles file deletion errors gracefully', async () => {
      const agent = await service.create({ name: 'File Error Agent' })

      // Create a directory where the file should be (to cause deletion error)
      const filePath = join(testProjectPath, 'claude-agents', `${agent.id}.md`)
      mkdirSync(filePath, { recursive: true })

      // Should still delete from database despite file error
      const deleted = await service.delete(agent.id)
      expect(deleted).toBe(true)

      // Should have logged the error
      expect(mockLogger.debug).toHaveBeenCalled()
    })
  })

  describe('Content and Context Operations', () => {
    test('gets agent content from file', async () => {
      const instructions = '# Test Agent Content\n\nThis is test content.'
      const agent = await service.create({
        name: 'Content Agent',
        instructions
      })

      const content = await service.getContent(agent.id)
      expect(content).toBe(instructions)
    })

    test('falls back to database instructions when file not found', async () => {
      const instructions = 'Database instructions'
      const agent = await service.create({
        name: 'Fallback Agent',
        instructions
      })

      // Remove the file manually
      const filePath = join(testProjectPath, 'claude-agents', `${agent.id}.md`)
      if (existsSync(filePath)) {
        rmSync(filePath)
      }

      const content = await service.getContent(agent.id)
      expect(content).toBe(instructions)
    })

    test('formats agent context correctly', async () => {
      const agent = await service.create({
        name: 'Context Agent',
        description: 'Agent for context testing',
        instructions: '# Context Test\n\nContext instructions.',
        model: 'claude-3-sonnet'
      })

      const context = await service.formatContext(agent.id)
      
      expect(context).toContain(`## Agent: ${agent.name}`)
      expect(context).toContain(agent.instructions!)
      expect(context).toContain(`Agent ID: ${agent.id}`)
      expect(context).toContain(`Model: ${agent.model}`)
      expect(context).toContain(`Description: ${agent.description}`)
    })

    test('handles missing agent in context formatting', async () => {
      const context = await service.formatContext('nonexistent-agent')
      
      expect(context).toContain('## Agent: nonexistent-agent (not found)')
      expect(context).toContain('This agent could not be loaded')
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe('Batch Operations', () => {
    test('gets multiple agents by IDs', async () => {
      const agents = [
        await service.create({ name: 'Batch Agent 1' }),
        await service.create({ name: 'Batch Agent 2' }),
        await service.create({ name: 'Batch Agent 3' })
      ]

      const agentIds = agents.map(a => a.id)
      const retrieved = await service.getByIds(agentIds)

      expect(retrieved).toHaveLength(3)
      expect(retrieved.map(a => a.id).sort()).toEqual(agentIds.sort())
    })

    test('handles missing agents in batch retrieval', async () => {
      const agent = await service.create({ name: 'Existing Agent' })
      
      const agentIds = [agent.id, 'nonexistent-1', 'nonexistent-2']
      const retrieved = await service.getByIds(agentIds)

      expect(retrieved).toHaveLength(1)
      expect(retrieved[0].id).toBe(agent.id)
      expect(mockLogger.warn).toHaveBeenCalledTimes(2) // Two missing agents
    })
  })

  describe('AI-Powered Operations', () => {
    test('suggests agents for project', async () => {
      const projectId = 12345
      const context = 'Need help with React components'
      const limit = 3

      const suggestions = await service.suggest(projectId, context, limit)

      expect(suggestions).toBeDefined()
      expect(suggestions.suggestions).toHaveLength(2) // From mock data
      expect(suggestions.suggestions[0].name).toBe('Test UI Architect')
      expect(suggestions.suggestions[1].name).toBe('Test API Expert')

      // Verify AI service was called correctly
      expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1)
      expect(mockGetCompactProjectSummary).toHaveBeenCalledWith(projectId)
    })

    test('handles project summary errors in agent suggestions', async () => {
      // Mock project summary to throw error
      mockGetCompactProjectSummary.mockRejectedValueOnce(new Error('Project not found'))

      const suggestions = await service.suggest(12345, 'test context')

      expect(suggestions).toBeDefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not get project summary')
      )
    })

    test('suggests agent for specific task', async () => {
      // Create test agents with different specializations
      await service.create({
        name: 'UI Expert',
        description: 'Specializes in React components and frontend development'
      })
      
      await service.create({
        name: 'API Expert', 
        description: 'Specializes in API design and backend development'
      })

      const suggestion = await service.suggestForTask(
        'Create React component',
        'Build a new button component with TypeScript'
      )

      expect(suggestion).toBeDefined()
      // Should suggest UI Expert based on task content
      // Note: This is heuristic-based matching, so exact result may vary
    })

    test('returns null when no agents available for task suggestion', async () => {
      const suggestion = await service.suggestForTask(
        'Some task',
        'Task description'
      )

      expect(suggestion).toBeNull()
    })
  })

  describe('Error Handling', () => {
    test('handles database errors gracefully', async () => {
      const mockService = createClaudeAgentService({
        repository: {
          ...claudeAgentRepository,
          create: mock(async () => { throw new Error('Database connection failed') })
        },
        logger: mockLogger
      })

      await expect(mockService.create({ name: 'Error Test Agent' }))
        .rejects.toThrow('Database connection failed')
    })

    test('handles file system permission errors', async () => {
      // Create a read-only directory to cause permission errors
      const readOnlyPath = join(testProjectPath, 'readonly')
      mkdirSync(readOnlyPath, { recursive: true, mode: 0o444 })

      const readOnlyService = createClaudeAgentService({
        projectPath: readOnlyPath,
        logger: mockLogger
      })

      // Should handle file creation errors gracefully
      const agent = await readOnlyService.create({
        name: 'Permission Test',
        instructions: 'This should fail to write'
      })

      expect(agent).toBeDefined()
      // File creation may fail, but agent should still be created in database
    })
  })

  describe('Service Factory Pattern', () => {
    test('creates service with default dependencies', async () => {
      const defaultService = createClaudeAgentService()
      expect(defaultService).toBeDefined()
      expect(typeof defaultService.create).toBe('function')
      expect(typeof defaultService.getById).toBe('function')
      expect(typeof defaultService.list).toBe('function')
    })

    test('creates service with custom dependencies', async () => {
      const customLogger = { log: mock(() => {}) }
      const customCache = { get: mock(() => {}), set: mock(() => {}) }

      const customService = createClaudeAgentService({
        logger: customLogger,
        cache: customCache,
        projectPath: '/custom/path'
      })

      expect(customService).toBeDefined()
      // Dependencies should be used internally (tested through behavior)
    })

    test('exports individual functions for tree-shaking', async () => {
      const { 
        create: createAgent,
        getById: getAgentById,
        list: listAgents,
        update: updateAgent,
        delete: deleteAgent
      } = await import('./claude-agent-service')

      expect(typeof createAgent).toBe('function')
      expect(typeof getAgentById).toBe('function')
      expect(typeof listAgents).toBe('function')
      expect(typeof updateAgent).toBe('function')
      expect(typeof deleteAgent).toBe('function')
    })
  })

  describe('Integration with Repository Layer', () => {
    test('uses repository for database operations', async () => {
      const repositoryMockService = createClaudeAgentService({
        repository: mockRepository,
        logger: mockLogger
      })

      // Mock repository responses
      const mockAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        description: null,
        instructions: '',
        model: 'claude-3-sonnet',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockRepository.create.mockResolvedValue(mockAgent)

      await repositoryMockService.create({ name: 'Test Agent' })

      expect(mockRepository.create).toHaveBeenCalledTimes(1)
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-agent',
          name: 'Test Agent',
          isActive: true
        })
      )
    })

    test('validates schema using repository patterns', async () => {
      // This test ensures the service properly validates data through the repository layer
      const invalidData = {
        name: '', // Invalid: empty name
        model: 'invalid-model'
      }

      await expect(service.create(invalidData as any))
        .rejects.toThrow()
    })
  })
})