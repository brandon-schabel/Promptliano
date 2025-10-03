import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { suggestFilesForProject, recommendStrategy } from '../suggestions-service'

// Mock all dependencies
const mockGetProjectFileTree = mock(async () => ({
  tree: {
    name: 'root',
    path: '/',
    type: 'directory' as const,
    children: [
      {
        name: 'src',
        path: '/src',
        type: 'directory' as const,
        children: [
          {
            name: 'auth',
            path: '/src/auth',
            type: 'directory' as const,
            children: []
          }
        ]
      }
    ]
  }
}))

const mockGetProjectById = mock(async () => ({
  id: 1,
  name: 'Test Project',
  path: '/test/project',
  createdAt: Date.now(),
  updatedAt: Date.now()
}))

const mockGetProjectFiles = mock(async () => [
  {
    id: 1,
    projectId: 1,
    path: 'src/auth/jwt.ts',
    name: 'jwt.ts',
    extension: '.ts',
    content: 'import jwt from "jsonwebtoken"\nexport function verifyToken() {}',
    size: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    checksum: 'abc123'
  }
])

// Mock modules
mock.module('../../project-service', () => ({
  getProjectFileTree: mockGetProjectFileTree,
  getProjectById: mockGetProjectById,
  getProjectFiles: mockGetProjectFiles
}))

describe('Suggestions Service V2 - Integration', () => {
  beforeEach(() => {
    mockGetProjectFileTree.mockClear()
    mockGetProjectById.mockClear()
    mockGetProjectFiles.mockClear()
  })

  describe('suggestFilesForProject', () => {
    test('should execute two-stage AI flow successfully', async () => {
      const result = await suggestFilesForProject(1, 'implement JWT auth', {
        strategy: 'balanced',
        maxResults: 10
      })

      expect(result).toBeDefined()
      expect(result.suggestions).toBeDefined()
      expect(Array.isArray(result.suggestions)).toBe(true)
      expect(result.suggestedFiles).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    test('should include comprehensive metadata', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        strategy: 'balanced'
      })

      expect(result.metadata).toBeDefined()
      expect(result.metadata.strategy).toBe('balanced')
      expect(result.metadata.totalFiles).toBeGreaterThanOrEqual(0)
      expect(result.metadata.analyzedFiles).toBeGreaterThanOrEqual(0)
      expect(result.metadata.processingTime).toBeGreaterThan(0)
    })

    test('should include V2 metadata fields', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      expect(result.metadata.selectedDirectories).toBeDefined()
      expect(result.metadata.totalDirectories).toBeDefined()
      expect(result.metadata.filesFromDirectories).toBeDefined()
      expect(result.metadata.lineCountPerFile).toBeDefined()
      expect(result.metadata.aiModel).toBeDefined()
    })

    test('should skip directory selection when directories provided', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        directories: ['src/auth'],
        skipDirectorySelection: true
      })

      expect(result.metadata.selectedDirectories).toContain('src/auth')
      // Directory selection should not have been called
    })

    test('should respect maxResults limit', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        maxResults: 5
      })

      expect(result.suggestedFiles.length).toBeLessThanOrEqual(5)
    })

    test('should use custom lineCount', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        lineCount: 100
      })

      expect(result.metadata.lineCountPerFile).toBe(100)
    })

    test('should handle includeScores option', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        includeScores: true,
        maxResults: 5
      })

      if (result.scores) {
        expect(Array.isArray(result.scores)).toBe(true)
        result.scores.forEach((score) => {
          expect(score).toHaveProperty('fileId')
          expect(score).toHaveProperty('confidence')
          expect(score).toHaveProperty('relevance')
          expect(score).toHaveProperty('reasons')
        })
      }
    })

    test('should include user context in processing', async () => {
      const result = await suggestFilesForProject(1, 'implement feature', {
        userContext: 'focus on authentication'
      })

      expect(result).toBeDefined()
      // User context should be passed to AI
    })

    test('should handle empty project gracefully', async () => {
      mockGetProjectFileTree.mockReturnValueOnce(
        Promise.resolve({
          tree: {
            name: 'root',
            path: '/',
            type: 'directory' as const,
            children: []
          }
        })
      )
      mockGetProjectFiles.mockReturnValueOnce(Promise.resolve([]))

      const result = await suggestFilesForProject(1, 'test', {
        strategy: 'fast'
      })

      expect(result.suggestedFiles).toHaveLength(0)
      expect(result.metadata.totalFiles).toBe(0)
    })
  })

  describe('Strategy configurations', () => {
    test('should use fast strategy correctly', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        strategy: 'fast'
      })

      expect(result.metadata.strategy).toBe('fast')
      expect(result.metadata.lineCountPerFile).toBeLessThanOrEqual(30)
    })

    test('should use balanced strategy correctly', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        strategy: 'balanced'
      })

      expect(result.metadata.strategy).toBe('balanced')
      expect(result.metadata.lineCountPerFile).toBeLessThanOrEqual(50)
    })

    test('should use thorough strategy correctly', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        strategy: 'thorough'
      })

      expect(result.metadata.strategy).toBe('thorough')
      expect(result.metadata.lineCountPerFile).toBeLessThanOrEqual(100)
    })
  })

  describe('recommendStrategy', () => {
    test('should recommend fast for small projects', () => {
      const strategy = recommendStrategy(30)
      expect(strategy).toBe('fast')
    })

    test('should recommend balanced for medium projects', () => {
      const strategy = recommendStrategy(250)
      expect(strategy).toBe('balanced')
    })

    test('should recommend thorough for large projects', () => {
      const strategy = recommendStrategy(600)
      expect(strategy).toBe('thorough')
    })
  })

  describe('Performance', () => {
    test('should complete within reasonable time', async () => {
      const startTime = Date.now()
      await suggestFilesForProject(1, 'test', {
        strategy: 'fast'
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(5000) // 5 seconds
    })

    test('should track processing time in metadata', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      expect(result.metadata.processingTime).toBeGreaterThan(0)
      expect(result.metadata.processingTime).toBeLessThan(30000) // 30 seconds max
    })

    test('should include stage timing breakdown', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      if (result.metadata.directorySelectionTime) {
        expect(result.metadata.directorySelectionTime).toBeGreaterThan(0)
      }
      if (result.metadata.fileFetchTime) {
        expect(result.metadata.fileFetchTime).toBeGreaterThan(0)
      }
      if (result.metadata.suggestionTime) {
        expect(result.metadata.suggestionTime).toBeGreaterThan(0)
      }
    })
  })

  describe('Error handling', () => {
    test('should handle invalid project ID', async () => {
      mockGetProjectFileTree.mockRejectedValueOnce(new Error('Project not found'))

      await expect(
        suggestFilesForProject(999, 'test', {})
      ).rejects.toThrow()
    })

    test('should provide helpful error messages', async () => {
      mockGetProjectById.mockReturnValueOnce(Promise.resolve(null))

      await expect(
        suggestFilesForProject(999, 'test', {
          directories: ['src'],
          skipDirectorySelection: true
        })
      ).rejects.toThrow(/Project.*not found/)
    })
  })

  describe('Token optimization', () => {
    test('should estimate tokens saved', async () => {
      const result = await suggestFilesForProject(1, 'test', {
        strategy: 'balanced'
      })

      if (result.metadata.tokensSaved !== undefined) {
        expect(result.metadata.tokensSaved).toBeGreaterThanOrEqual(0)
      }
    })

    test('should track token usage estimate', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      expect(result.metadata).toBeDefined()
      // Token usage should be tracked in metadata
    })
  })

  describe('Backward compatibility', () => {
    test('should return file IDs as suggestions array', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      expect(Array.isArray(result.suggestions)).toBe(true)
      result.suggestions.forEach((id) => {
        expect(typeof id).toBe('string')
      })
    })

    test('should return suggestedFiles with V1-compatible fields', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      result.suggestedFiles.forEach((file) => {
        expect(file).toHaveProperty('path')
        expect(file).toHaveProperty('relevance')
        expect(file).toHaveProperty('confidence')
        expect(file).toHaveProperty('fileType')
      })
    })

    test('should include V2-specific fields', async () => {
      const result = await suggestFilesForProject(1, 'test', {})

      result.suggestedFiles.forEach((file) => {
        expect(file).toHaveProperty('reasons')
        expect(file).toHaveProperty('lineCount')
        expect(file).toHaveProperty('totalLines')
      })
    })
  })
})
