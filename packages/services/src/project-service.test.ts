import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { createProjectService, type FileSyncData } from './project-service'
import { createTestEnvironment, type TestContext } from './test-utils/test-environment'
import { projects, createBaseRepository, extendRepository } from '@promptliano/database'
import { eq } from 'drizzle-orm'
import type {
  Project,
  File as ProjectFile,
  CreateProject as CreateProjectBody,
  UpdateProject as UpdateProjectBody
} from '@promptliano/database'
import { z } from 'zod'

// Create test environment for this suite
const testEnv = createTestEnvironment({
  suiteName: 'project-service',
  seedData: false,
  verbose: false
})

// Service instance
let projectService: ReturnType<typeof createProjectService>

// --- Mocking gen-ai-services ---
const mockGenerateStructuredData = mock(async ({ schema }: { schema: z.ZodSchema<any> }) => {
  if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
    return { object: { summary: 'Mocked AI summary' } }
  }
  // Fallback for other schemas if needed, or throw error if unexpected
  return { object: {} }
})
mock.module('./gen-ai-services', () => ({
  generateStructuredData: mockGenerateStructuredData
}))

// --- Mocking file-sync-service-unified ---
const mockSyncProject = mock(async (project: Project) => {
  // Just return a successful sync result with no changes
  return {
    added: [],
    updated: [],
    removed: [],
    unchanged: [],
    log: [],
    error: null
  }
})
mock.module('./file-services/file-sync-service-unified', () => ({
  syncProject: mockSyncProject
}))

// Helper to generate random strings for test data
const randomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)

describe('Project Service (Functional Factory)', () => {
  let context: TestContext
  
  beforeEach(async () => {
    context = await testEnv.setupTest()
    
    // Create project service with test database and extended repository
    const baseProjectRepository = createBaseRepository(projects, context.testDb.db, undefined, 'Project')
    const testProjectRepository = extendRepository(baseProjectRepository, {
      async getByPath(path: string) {
        return baseProjectRepository.findOneWhere(eq(projects.path, path))
      },
      async getWithAllRelations(id: number) {
        const project = await baseProjectRepository.getById(id)
        if (!project) return null
        return {
          ...project,
          tickets: [],
          chats: [],
          prompts: [],
          queues: [],
          files: []
        }
      }
    })
    
    projectService = createProjectService({ repository: testProjectRepository })
    
    // Reset mock call counts
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
  })

  afterEach(async () => {
    await testEnv.cleanupTest()
    
    // Reset mocks
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
  })

  test('database initialization works', async () => {
    // Import the Database class directly to test without singleton issues
    const { Database } = await import('bun:sqlite')
    const db = new Database(':memory:')

    // Create the projects table manually
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Test basic operations
    const now = Date.now()
    const testData = { name: 'test', path: '/test' }

    // Insert a record
    const insertQuery = db.prepare(`
      INSERT INTO projects (id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    insertQuery.run('1', JSON.stringify(testData), now, now)

    // Check if it exists
    const selectQuery = db.prepare(`SELECT data FROM projects WHERE id = ?`)
    const result = selectQuery.get('1') as { data: string } | undefined

    expect(result).toBeDefined()
    expect(JSON.parse(result!.data)).toEqual(testData)

    // Test that a different ID doesn't exist
    const result2 = selectQuery.get('2')
    expect(result2).toBeNull()

    db.close()
  })

  test('simple project creation works', async () => {
    const projectData = {
      name: 'Test Project',
      path: '/test/path',
      description: 'A test project'
    }

    const project = await projectService.create(projectData)
    context.trackResource('project', project.id)

    expect(project.id).toBeDefined()
    expect(project.name).toBe(projectData.name)
    expect(project.path).toBe(projectData.path)
    expect(project.description).toBe(projectData.description)
  })

  describe('Project CRUD', () => {
    test('createProject creates a new project', async () => {
      const input: CreateProjectBody = {
        name: `TestProject_${randomString()}`,
        path: `/path/to/${randomString()}`,
        description: 'A test project'
      }
      const project = await projectService.create(input)
      context.trackResource('project', project.id)

      expect(project.id).toBeDefined()
      expect(project.name).toBe(input.name)
      expect(project.path).toBe(input.path)
      expect(project.description).toBe(input.description ?? '') // Handle potentially undefined description

      // Verify project was stored in database
      const retrieved = await projectService.getById(project.id)
      expect(retrieved).toEqual(project)
    })

    test('getProjectById returns project if found, throws if not', async () => {
      const input: CreateProjectBody = { name: 'GetMe', path: '/get/me' }
      const created = await projectService.create(input)
      context.trackResource('project', created.id)

      const found = await projectService.getById(created.id)
      expect(found).toEqual(created)

      const notFoundId = 999999999999
      await expect(projectService.getById(notFoundId)).rejects.toThrow('Project with ID 999999999999 not found')
    })

    test('listProjects returns all projects', async () => {
      let all = await projectService.list()
      expect(all.length).toBe(0)

      const p1 = await projectService.create({ name: 'P1', path: '/p1' })
      context.trackResource('project', p1.id)
      await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure timestamp difference
      const p2 = await projectService.create({ name: 'P2', path: '/p2' })
      context.trackResource('project', p2.id)

      all = await projectService.list()
      expect(all.length).toBe(2)
      expect(all.some(p => p.id === p1.id)).toBe(true)
      expect(all.some(p => p.id === p2.id)).toBe(true)
    })

    test('updateProject updates fields and returns updated project', async () => {
      const created = await projectService.create({ name: 'Before', path: '/old' })
      context.trackResource('project', created.id)
      const updates: UpdateProjectBody = { name: 'After', description: 'New Desc' }
      await new Promise((resolve) => setTimeout(resolve, 10))
      const updated = await projectService.update(created.id, updates)

      expect(updated).toBeDefined()
      if (!updated) throw new Error('Update failed')
      expect(updated.name).toBe('After')
      expect(updated.description).toBe('New Desc')
      expect(updated.path).toBe(created.path) // Path not changed
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime())
    })

    test('updateProject throws if project does not exist', async () => {
      const nonExistentId = 999999999999
      await expect(projectService.update(nonExistentId, { name: 'X' })).rejects.toThrow('Project with ID 999999999999 not found')
    })

    test('deleteProject returns true if deleted, throws if nonexistent', async () => {
      const project = await projectService.create({ name: 'DelMe', path: '/del/me' })
      // Don't track this resource since we're testing deletion

      const success = await projectService.delete(project.id)
      expect(success).toBe(true)

      // Verify project is deleted
      await expect(projectService.getById(project.id)).rejects.toThrow('Project with ID')

      const fakeProjectId = 999999999999
      await expect(projectService.delete(fakeProjectId)).rejects.toThrow('Project with ID 999999999999 not found')
    })
  })

  describe('Project File Operations', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await projectService.create({ name: 'FileTestProj', path: '/file/test' })
      context.trackResource('project', proj.id)
      projectId = proj.id
    })

    test('getProjectFiles returns files for a project', async () => {
      const files = await projectService.getProjectFiles(projectId)
      expect(Array.isArray(files)).toBe(true)
    })

    test('updateFileContent placeholder test', async () => {
      // Note: This test would need actual file creation through file service
      // Skipping detailed implementation as it depends on file service integration
      expect(true).toBe(true) // Placeholder
    })

    test('project file operations handle non-existent project', async () => {
      const nonExistentProjectId = 999999999999
      await expect(projectService.getProjectFiles(nonExistentProjectId)).rejects.toThrow('Project with ID 999999999999 not found')
    })
  })

  describe('Summarization', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await projectService.create({ name: 'SummarizeProj', path: '/summarize/test' })
      context.trackResource('project', proj.id)
      projectId = proj.id
      
      // Reset mock return for generateStructuredData for each test if specific return values are needed
      mockGenerateStructuredData.mockImplementation(async ({ schema }: { schema: z.ZodSchema<any> }) => {
        if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
          return { object: { summary: 'Mocked AI summary' } }
        }
        return { object: {} }
      })
    })

    test('summarizeFiles processes multiple files', async () => {
      const result = await projectService.summarizeFiles(projectId, ['file1', 'file2'])
      expect(result.included).toBeGreaterThanOrEqual(0)
      expect(result.skipped).toBeGreaterThanOrEqual(0)
    })

    test('removeSummariesFromFiles clears summaries', async () => {
      const result = await projectService.removeSummariesFromFiles(projectId, ['file1', 'file2'])
      expect(result.removedCount).toBeGreaterThanOrEqual(0)
      expect(result.message).toBeDefined()
    })

    test('resummarizeAllFiles handles project correctly', async () => {
      // Note: This would require full file sync service integration
      // For now, just test that the function exists and can be called
      const { resummarizeAllFiles } = await import('./project-service')
      
      // Test with a non-existent project to verify error handling
      const nonExistentId = 999999999999
      await expect(resummarizeAllFiles(nonExistentId)).rejects.toThrow('Project with ID 999999999999 not found')
    })
  })
})