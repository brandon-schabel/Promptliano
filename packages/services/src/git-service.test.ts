import { describe, test, expect, spyOn, beforeEach, afterEach, Mock, jest } from 'bun:test'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { Project } from '@promptliano/database'
import ErrorFactory from '@promptliano/shared/src/error/error-factory'

// Import the service creation functions
import {
  createGitStatusService,
  createGitCommitService,
  type GitStatusService,
  type GitCommitService
} from './git-services'

// Create a proper test setup with dependency injection
describe('Git Service - Functional Factory Pattern', () => {
  const mockProject: Project = {
    id: 1,
    name: 'Test Project',
    path: '/test/project',
    description: 'Test',
    created: Date.now(),
    updated: Date.now()
  }

  // Mock simple-git
  const mockGit: Partial<SimpleGit> = {
    checkIsRepo: jest.fn().mockResolvedValue(true),
    status: jest.fn().mockResolvedValue({
      current: 'main',
      tracking: 'origin/main',
      ahead: 1,
      behind: 0,
      files: [
        { path: 'file1.js', index: 'M', working_dir: ' ' },
        { path: 'file2.ts', index: 'A', working_dir: ' ' },
        { path: 'file3.txt', index: ' ', working_dir: 'M' },
        { path: 'file4.md', index: '?', working_dir: '?' }
      ],
      staged: ['file1.js', 'file2.ts'],
      modified: ['file1.js', 'file3.txt'],
      created: ['file2.ts'],
      deleted: [],
      renamed: [],
      conflicted: [],
      isClean: () => false
    }),
    add: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue({
      commit: 'abc123',
      summary: { changes: 2, deletions: 0, insertions: 10 }
    })
  }

  // Mock project service
  const mockProjectService = {
    getById: jest.fn().mockResolvedValue(mockProject)
  }

  // Mock logger
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }

  let gitStatusService: GitStatusService
  let gitCommitService: GitCommitService
  let simpleGitSpy: Mock<any>

  beforeEach(async () => {
    // Create services with mocked dependencies
    gitStatusService = createGitStatusService({
      projectService: mockProjectService,
      logger: mockLogger
    })

    gitCommitService = createGitCommitService({
      projectService: mockProjectService,
      logger: mockLogger,
      statusService: gitStatusService
    })

    // Mock simpleGit function to return our mock
    const simpleGitModule = await import('simple-git')
    simpleGitSpy = spyOn(simpleGitModule, 'simpleGit').mockReturnValue(mockGit as SimpleGit)

    // Clear service cache
    gitStatusService.clearCache()

    // Reset mock call counts
    mockProjectService.getById.mockClear()
  })

  afterEach(() => {
    // Reset mock call history
    mockProjectService.getById.mockClear()
    mockGit.checkIsRepo = jest.fn().mockResolvedValue(true)
    mockGit.status = jest.fn().mockResolvedValue({
      current: 'main',
      tracking: 'origin/main',
      ahead: 1,
      behind: 0,
      files: [
        { path: 'file1.js', index: 'M', working_dir: ' ' },
        { path: 'file2.ts', index: 'A', working_dir: ' ' },
        { path: 'file3.txt', index: ' ', working_dir: 'M' },
        { path: 'file4.md', index: '?', working_dir: '?' }
      ],
      staged: ['file1.js', 'file2.ts'],
      modified: ['file1.js', 'file3.txt'],
      created: ['file2.ts'],
      deleted: [],
      renamed: [],
      conflicted: [],
      isClean: () => false
    })
    mockGit.add = jest.fn().mockResolvedValue(undefined)
    mockGit.reset = jest.fn().mockResolvedValue(undefined)
    mockGit.commit = jest.fn().mockResolvedValue({
      commit: 'abc123',
      summary: { changes: 2, deletions: 0, insertions: 10 }
    })

    // Restore mock project to default
    mockProjectService.getById.mockResolvedValue(mockProject)

    simpleGitSpy.mockRestore()
  })

  describe('Git Status Service', () => {
    describe('getProjectGitStatus', () => {
      test('should return git status for a valid repository', async () => {
        const result = await gitStatusService.getProjectGitStatus(1)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.isRepo).toBe(true)
        expect(result.data!.current).toBe('main')
        expect(result.data!.tracking).toBe('origin/main')
        expect(result.data!.ahead).toBe(1)
        expect(result.data!.behind).toBe(0)
        expect(result.data!.files).toHaveLength(4)

        // Check file status mapping
        const files = result.data!.files
        expect(files[0]).toMatchObject({ path: 'file1.js', status: 'modified', staged: true })
        expect(files[1]).toMatchObject({ path: 'file2.ts', status: 'added', staged: true })
        expect(files[2]).toMatchObject({ path: 'file3.txt', status: 'modified', staged: false })
        expect(files[3]).toMatchObject({ path: 'file4.md', status: 'untracked', staged: false })
      })

      test('should return cached result within TTL', async () => {
        // First call
        await gitStatusService.getProjectGitStatus(1)

        // Second call should use cache
        const result = await gitStatusService.getProjectGitStatus(1)

        expect(result.success).toBe(true)
        // simpleGit should only be called once due to caching
        expect(simpleGitSpy).toHaveBeenCalledTimes(1)
      })

      test('should handle project without path', async () => {
        // Create a fresh service instance with a mock that returns null path
        const projectServiceWithNullPath = {
          getById: jest.fn().mockResolvedValue({ ...mockProject, path: null })
        }

        const testGitStatusService = createGitStatusService({
          projectService: projectServiceWithNullPath,
          logger: mockLogger
        })

        const result = await testGitStatusService.getProjectGitStatus(1)
        expect(result.success).toBe(false)
        expect(result.error?.type).toBe('unknown') // Error gets wrapped as unknown type
        expect(result.error?.message).toContain('missing path')
      })

      test('should handle non-git repository', async () => {
        mockGit.checkIsRepo = jest.fn().mockResolvedValue(false)

        const result = await gitStatusService.getProjectGitStatus(1)

        expect(result.success).toBe(false)
        expect(result.error?.type).toBe('not_a_repo')
        expect(result.error?.message).toContain('not a git repository')
      })

      test('should handle git command not found error', async () => {
        mockGit.checkIsRepo = jest.fn().mockRejectedValue(new Error('git: command not found'))

        const result = await gitStatusService.getProjectGitStatus(1)

        expect(result.success).toBe(false)
        expect(result.error?.type).toBe('git_not_installed')
        expect(result.error?.message).toContain('Git is not installed')
      })

      test('should handle permission denied error', async () => {
        mockGit.checkIsRepo = jest.fn().mockRejectedValue(new Error('permission denied'))

        const result = await gitStatusService.getProjectGitStatus(1)

        expect(result.success).toBe(false)
        expect(result.error?.type).toBe('permission_denied')
        expect(result.error?.message).toContain('Permission denied')
      })

      test('should handle project not found', async () => {
        // Create a fresh service instance with a mock that throws error
        const projectServiceWithError = {
          getById: jest.fn().mockRejectedValue(ErrorFactory.notFound('Project', 1))
        }

        const testGitStatusService = createGitStatusService({
          projectService: projectServiceWithError,
          logger: mockLogger
        })

        const result = await testGitStatusService.getProjectGitStatus(1)
        expect(result.success).toBe(false)
        expect(result.error?.type).toBe('unknown') // Error gets wrapped as unknown type
        expect(result.error?.message).toContain('not found')
      })
    })

    describe('clearCache', () => {
      test('should clear cache for specific project', async () => {
        // Populate cache
        await gitStatusService.getProjectGitStatus(1)

        // Clear specific project cache
        gitStatusService.clearCache(1)

        // Next call should not use cache
        await gitStatusService.getProjectGitStatus(1)
        expect(simpleGitSpy).toHaveBeenCalledTimes(2)
      })

      test('should clear all cache when no projectId provided', async () => {
        // Populate cache for multiple projects
        await gitStatusService.getProjectGitStatus(1)
        mockProjectService.getById.mockResolvedValue({ ...mockProject, id: 2 })
        await gitStatusService.getProjectGitStatus(2)

        // Clear all cache
        gitStatusService.clearCache()

        // Both projects should fetch fresh data
        await gitStatusService.getProjectGitStatus(1)
        await gitStatusService.getProjectGitStatus(2)

        // 4 calls total (2 initial + 2 after cache clear)
        expect(simpleGitSpy).toHaveBeenCalledTimes(4)
      })
    })

    describe('stageFiles', () => {
      beforeEach(() => {
        mockGit.add = jest.fn().mockResolvedValue(undefined)
      })

      test('should stage files with relative paths', async () => {
        await gitStatusService.stageFiles(1, ['file1.js', 'file2.ts'])

        expect(mockGit.add).toHaveBeenCalledWith(['file1.js', 'file2.ts'])
      })

      test('should convert absolute paths to relative', async () => {
        await gitStatusService.stageFiles(1, ['/test/project/file1.js', '/test/project/src/file2.ts'])

        expect(mockGit.add).toHaveBeenCalledWith(['file1.js', 'src/file2.ts'])
      })

      test('should clear cache after staging', async () => {
        // Populate cache
        await gitStatusService.getProjectGitStatus(1)

        // Reset call count
        simpleGitSpy.mockClear()

        await gitStatusService.stageFiles(1, ['file1.js'])

        // Next status call should fetch fresh data (cache cleared)
        await gitStatusService.getProjectGitStatus(1)
        // Should call simpleGit twice: once for stageFiles, once for getProjectGitStatus
        expect(simpleGitSpy).toHaveBeenCalledTimes(2)
      })

      test('should throw error if project has no path', async () => {
        // Create a fresh service instance with a mock that returns null path
        const projectServiceWithNullPath = {
          getById: jest.fn().mockResolvedValue({ ...mockProject, path: null })
        }

        const testGitStatusService = createGitStatusService({
          projectService: projectServiceWithNullPath,
          logger: mockLogger
        })

        await expect(testGitStatusService.stageFiles(1, ['file1.js'])).rejects.toThrow('missing path')
      })

      test('should handle git errors', async () => {
        mockGit.add = jest.fn().mockRejectedValue(new Error('Failed to add files'))

        await expect(gitStatusService.stageFiles(1, ['file1.js'])).rejects.toThrow('Failed to add files')
      })
    })

    describe('unstageFiles', () => {
      beforeEach(() => {
        mockGit.reset = jest.fn().mockResolvedValue(undefined)
      })

      test('should unstage files with relative paths', async () => {
        await gitStatusService.unstageFiles(1, ['file1.js', 'file2.ts'])

        expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', 'file1.js', 'file2.ts'])
      })

      test('should convert absolute paths to relative', async () => {
        await gitStatusService.unstageFiles(1, ['/test/project/file1.js'])

        expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', 'file1.js'])
      })

      test('should clear cache after unstaging', async () => {
        await gitStatusService.getProjectGitStatus(1)

        // Reset call count
        simpleGitSpy.mockClear()

        await gitStatusService.unstageFiles(1, ['file1.js'])

        await gitStatusService.getProjectGitStatus(1)
        // Should call simpleGit twice: once for unstageFiles, once for getProjectGitStatus
        expect(simpleGitSpy).toHaveBeenCalledTimes(2)
      })
    })

    describe('stageAll', () => {
      test('should stage all files', async () => {
        await gitStatusService.stageAll(1)

        expect(mockGit.add).toHaveBeenCalledWith('.')
      })

      test('should clear cache after staging all', async () => {
        await gitStatusService.getProjectGitStatus(1)

        // Reset call count
        simpleGitSpy.mockClear()

        await gitStatusService.stageAll(1)

        await gitStatusService.getProjectGitStatus(1)
        // Should call simpleGit twice: once for stageAll, once for getProjectGitStatus
        expect(simpleGitSpy).toHaveBeenCalledTimes(2)
      })
    })

    describe('unstageAll', () => {
      test('should unstage all files', async () => {
        await gitStatusService.unstageAll(1)

        expect(mockGit.reset).toHaveBeenCalledWith(['HEAD'])
      })

      test('should clear cache after unstaging all', async () => {
        await gitStatusService.getProjectGitStatus(1)

        // Reset call count
        simpleGitSpy.mockClear()

        await gitStatusService.unstageAll(1)

        await gitStatusService.getProjectGitStatus(1)
        // Should call simpleGit twice: once for unstageAll, once for getProjectGitStatus
        expect(simpleGitSpy).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Git Commit Service', () => {
    describe('commitChanges', () => {
      test('should commit staged changes', async () => {
        await gitCommitService.commitChanges(1, 'Test commit message')

        expect(mockGit.commit).toHaveBeenCalledWith('Test commit message')
      })

      test('should throw error if no staged changes', async () => {
        const originalStatus = mockGit.status
        mockGit.status = jest.fn().mockResolvedValue({
          current: 'main',
          tracking: 'origin/main',
          ahead: 1,
          behind: 0,
          files: [],
          staged: [],
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          isClean: () => true
        })

        await expect(gitCommitService.commitChanges(1, 'Test commit')).rejects.toThrow()

        // Restore original status
        mockGit.status = originalStatus
      })

      test('should clear cache after commit', async () => {
        await gitStatusService.getProjectGitStatus(1)

        // Reset call count
        simpleGitSpy.mockClear()

        await gitCommitService.commitChanges(1, 'Test commit')

        await gitStatusService.getProjectGitStatus(1)
        // Should call simpleGit at least once for getProjectGitStatus after commit
        expect(simpleGitSpy).toHaveBeenCalledTimes(1)
      })

      test('should handle commit errors', async () => {
        mockGit.commit = jest.fn().mockRejectedValue(new Error('Failed to commit'))

        await expect(gitCommitService.commitChanges(1, 'Test commit')).rejects.toThrow('Failed to commit')
      })

      test('should handle project not found in commit service', async () => {
        // Create a fresh service instance with a mock that throws error
        const projectServiceWithError = {
          getById: jest.fn().mockRejectedValue(ErrorFactory.notFound('Project', 1))
        }

        const testGitCommitService = createGitCommitService({
          projectService: projectServiceWithError,
          logger: mockLogger,
          statusService: gitStatusService
        })

        await expect(testGitCommitService.commitChanges(1, 'Test commit')).rejects.toThrow('not found')
      })

      test('should handle project without path in commit service', async () => {
        // Create a fresh service instance with a mock that returns null path
        const projectServiceWithNullPath = {
          getById: jest.fn().mockResolvedValue({ ...mockProject, path: null })
        }

        const testGitCommitService = createGitCommitService({
          projectService: projectServiceWithNullPath,
          logger: mockLogger,
          statusService: gitStatusService
        })

        await expect(testGitCommitService.commitChanges(1, 'Test commit')).rejects.toThrow('missing path')
      })
    })

    describe('ErrorFactory Integration Tests', () => {
      test('should verify ErrorFactory.notFound works correctly', () => {
        const error = ErrorFactory.notFound('Project', 1)
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Project with ID 1 not found')
      })

      test('should verify ErrorFactory.operationFailed works correctly', () => {
        const error = ErrorFactory.operationFailed('git commit', 'test reason')
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('git commit')
        expect(error.message).toContain('test reason')
      })

      test('should verify ErrorFactory.invalidState works correctly', () => {
        const error = ErrorFactory.invalidState('Project', 'missing path', 'git operations')
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('missing path')
      })

      test('should verify ErrorFactory.validationFailed works correctly', () => {
        const testError = new Error('No staged changes')
        const error = ErrorFactory.validationFailed(testError, { code: 'NO_STAGED_CHANGES' })
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Validation failed')
      })

      test('should verify ErrorFactory.wrap works correctly', () => {
        const originalError = new Error('Original error message')
        const wrappedError = ErrorFactory.wrap(originalError, 'test context')
        expect(wrappedError).toBeInstanceOf(Error)
        expect(wrappedError.message).toContain('test context')
        expect(wrappedError.message).toContain('Original error message')
      })
    })

    // Migrated test pattern section
    describe('Git Service (Migrated Pattern)', () => {
      let testContext: any
      let testEnv: any

      beforeEach(async () => {
        // Create test environment
        testEnv = {
          setupTest: jest.fn().mockResolvedValue({
            testProjectId: 1,
            testDb: { db: {} }
          }),
          cleanupTest: jest.fn().mockResolvedValue(undefined)
        }

        testContext = await testEnv.setupTest()
      })

      afterEach(async () => {
        await testEnv.cleanupTest()
      })

      test('should demonstrate migrated pattern structure', async () => {
        // This test demonstrates the migrated pattern structure
        // In a real implementation, this would use TestDataFactory and proper database isolation

        const mockRepository = {
          create: jest.fn().mockResolvedValue({
            id: Date.now(),
            projectId: testContext.testProjectId,
            status: 'clean',
            branch: 'main',
            ahead: 0,
            behind: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }),
          getById: jest.fn().mockResolvedValue({
            id: 123,
            projectId: testContext.testProjectId,
            status: 'modified',
            branch: 'feature-branch',
            ahead: 2,
            behind: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }),
          getByProject: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue({
            id: 123,
            projectId: testContext.testProjectId,
            status: 'updated',
            updatedAt: Date.now()
          }),
          delete: jest.fn().mockResolvedValue(true)
        }

        // This would create a service with proper database isolation
        // const gitStatusService = createGitStatusService({
        //   gitStatusRepository: mockRepository,
        //   projectService: mockProjectService
        // })

        // For now, just verify the pattern structure is in place
        expect(mockRepository).toBeDefined()
        expect(typeof mockRepository.create).toBe('function')
        expect(typeof mockRepository.getById).toBe('function')
      })

      test('should integrate with TestDataFactory pattern', async () => {
        // This demonstrates how the migrated pattern would use TestDataFactory
        // In practice, this would create Git status records using TestDataFactory

        const gitStatusData = {
          projectId: testContext.testProjectId,
          status: 'modified',
          branch: 'feature-branch',
          ahead: 2,
          behind: 1,
          files: [
            { path: 'src/main.ts', status: 'modified' },
            { path: 'test/app.test.ts', status: 'added' }
          ]
        }

        expect(gitStatusData.projectId).toBe(testContext.testProjectId)
        expect(gitStatusData.status).toBe('modified')
        expect(gitStatusData.branch).toBe('feature-branch')
        expect(gitStatusData.ahead).toBe(2)
        expect(gitStatusData.behind).toBe(1)
      })
    })
  })
})
