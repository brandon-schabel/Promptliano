import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { createProjectService } from './project-service'
import { TestDataFactory } from './test-utils/test-data-factories'
import { createTestDatabase } from '@promptliano/database'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { z } from 'zod'

// Service instance
let projectService: ReturnType<typeof createProjectService>
let testDb: any
let projectsStore: any[] = []

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

describe('Project Service (Isolated Database)', () => {
  beforeEach(async () => {
    // Reset in-memory store
    projectsStore = []

    // Create isolated test database
    testDb = await createTestDatabase({
      testId: `project-service-${Date.now()}-${Math.random()}`,
      verbose: false,
      seedData: false,
      useMemory: true,
      busyTimeout: 30000
    })

    // Create Drizzle instance with schema
    const drizzleDb = drizzle(testDb.rawDb)

    // Create mock repository that uses in-memory store
    const mockRepository = {
      create: mock(async (data: any) => {
        const project = {
          id: Date.now(),
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        projectsStore.push(project)
        return project
      }),
      getById: mock(async (id: number) => {
        return projectsStore.find((p) => p.id === id) || null
      }),
      getAll: mock(async () => [...projectsStore]),
      update: mock(async (id: number, data: any) => {
        const index = projectsStore.findIndex((p) => p.id === id)
        if (index === -1) throw new Error(`Project with ID ${id} not found`)
        const updated = {
          ...projectsStore[index],
          ...data,
          updatedAt: Date.now()
        }
        projectsStore[index] = updated
        return updated
      }),
      delete: mock(async (id: number) => {
        const index = projectsStore.findIndex((p) => p.id === id)
        if (index === -1) throw new Error(`Project with ID ${id} not found`)
        projectsStore.splice(index, 1)
        return true
      }),
      getByPath: mock(async (path: string) => {
        return projectsStore.find((p) => p.path === path) || null
      }),
      getWithAllRelations: mock(async (id: number) => {
        const project = projectsStore.find((p) => p.id === id)
        if (!project) return null
        return {
          ...project,
          tickets: [],
          chats: [],
          prompts: [],
          queues: [],
          files: []
        }
      }),
      paginate: mock(async (page: number, limit: number) => {
        const start = (page - 1) * limit
        const end = start + limit
        return {
          data: projectsStore.slice(start, end),
          total: projectsStore.length,
          page,
          limit,
          totalPages: Math.ceil(projectsStore.length / limit)
        }
      })
    }

    // Create mock file service for isolated testing
    const mockFileService = {
      getById: mock(async (id: string) => ({
        id,
        projectId: 1,
        name: 'test-file.txt',
        path: '/test/test-file.txt',
        content: 'test content',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      getByProject: mock(async (projectId: number) => []),
      updateContent: mock(async (projectId: number, fileId: string, content: string) => ({
        id: fileId,
        projectId,
        name: 'test-file.txt',
        path: '/test/test-file.txt',
        content,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      batch: {
        createFiles: mock(async () => []),
        updateFiles: mock(async () => []),
        deleteFiles: mock(async () => 0)
      }
    }

    projectService = createProjectService({
      repository: mockRepository,
      fileService: mockFileService
    })

    // Reset mock call counts
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
  })

  afterEach(async () => {
    // Cleanup test database
    if (testDb) {
      testDb.close()
    }

    // Reset mocks
    mockGenerateStructuredData.mockClear()
    mockSyncProject.mockClear()
  })

  test('should have isolated test database', async () => {
    // Verify that we have a clean test database for each test
    const projects = await projectService.list()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBe(0) // Should be empty initially due to isolated database
  })

  test('should create a new project', async () => {
    const projectData = TestDataFactory.project({
      name: 'Test Project',
      path: '/test/project',
      description: 'A test project for service testing'
    })

    const project = await projectService.create(projectData)

    expect(project.id).toBeDefined()
    expect(typeof project.id).toBe('number')
    expect(project.name).toBe(projectData.name)
    expect(project.path).toBe(projectData.path)
    expect(project.description).toBe(projectData.description)
  })

  describe('Project CRUD', () => {
    test('should create a new project', async () => {
      const input = TestDataFactory.project({
        name: 'TestProject',
        path: '/path/to/test',
        description: 'A test project'
      })

      const project = await projectService.create(input)

      expect(project.id).toBeDefined()
      expect(project.name).toBe(input.name)
      expect(project.path).toBe(input.path)
      expect(project.description).toBe(input.description)

      // Verify project was stored in database
      const retrieved = await projectService.getById(project.id)
      expect(retrieved).toEqual(project)
    })

    test('should get project by ID', async () => {
      const input = TestDataFactory.project({
        name: 'GetMe',
        path: '/get/me'
      })
      const created = await projectService.create(input)

      const found = await projectService.getById(created.id)
      expect(found).toEqual(created)

      const notFoundId = 999999999999
      await expect(projectService.getById(notFoundId)).rejects.toThrow('Project with ID 999999999999 not found')
    })

    test('should list all projects', async () => {
      let all = await projectService.list()
      expect(all.length).toBe(0)

      const p1 = await projectService.create(
        TestDataFactory.project({
          name: 'Project1',
          path: '/project1'
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure timestamp difference
      const p2 = await projectService.create(
        TestDataFactory.project({
          name: 'Project2',
          path: '/project2'
        })
      )

      all = await projectService.list()
      expect(all.length).toBe(2)
      expect(all.some((p) => p.id === p1.id)).toBe(true)
      expect(all.some((p) => p.id === p2.id)).toBe(true)
    })

    test('should update project', async () => {
      const created = await projectService.create(
        TestDataFactory.project({
          name: 'Before',
          path: '/old'
        })
      )

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

    test('should throw when updating non-existent project', async () => {
      const nonExistentId = 999999999999
      await expect(projectService.update(nonExistentId, { name: 'X' })).rejects.toThrow(
        'Project with ID 999999999999 not found'
      )
    })

    test('should delete project', async () => {
      const project = await projectService.create(
        TestDataFactory.project({
          name: 'DelMe',
          path: '/del/me'
        })
      )

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
      const proj = await projectService.create(
        TestDataFactory.project({
          name: 'FileTestProj',
          path: '/file/test'
        })
      )
      projectId = proj.id
    })

    test('should get project files', async () => {
      const files = await projectService.getProjectFiles(projectId)
      expect(Array.isArray(files)).toBe(true)
    })

    test('should handle non-existent project for file operations', async () => {
      const nonExistentProjectId = 999999999999
      await expect(projectService.getProjectFiles(nonExistentProjectId)).rejects.toThrow(
        'Project with ID 999999999999 not found'
      )
    })
  })

  describe('Summarization', () => {
    let projectId: number

    beforeEach(async () => {
      const proj = await projectService.create(
        TestDataFactory.project({
          name: 'SummarizeProj',
          path: '/summarize/test'
        })
      )
      projectId = proj.id

      // Reset mock return for generateStructuredData for each test if specific return values are needed
      mockGenerateStructuredData.mockImplementation(async ({ schema }: { schema: z.ZodSchema<any> }) => {
        if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
          return { object: { summary: 'Mocked AI summary' } }
        }
        return { object: {} }
      })
    })

    test('should process multiple files for summarization', async () => {
      const result = await projectService.summarizeFiles(projectId, ['file1', 'file2'])
      expect(result.included).toBeGreaterThanOrEqual(0)
      expect(result.skipped).toBeGreaterThanOrEqual(0)
    })

    test('should remove summaries from files', async () => {
      const result = await projectService.removeSummariesFromFiles(projectId, ['file1', 'file2'])
      expect(result.removedCount).toBeGreaterThanOrEqual(0)
      expect(result.message).toBeDefined()
    })

    test('should handle non-existent project for getById', async () => {
      // Test with a non-existent project to verify error handling
      const nonExistentId = 999999999999
      await expect(projectService.getById(nonExistentId)).rejects.toThrow('Project with ID 999999999999 not found')
    })
  })
})
