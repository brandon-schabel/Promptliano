import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { fetchPartialFilesFromDirectories } from '../partial-file-fetcher'
import type { File } from '@promptliano/database'

// Mock dependencies
const mockGetProjectById = mock(async (projectId: number) => ({
  id: projectId,
  name: 'Test Project',
  path: '/test/project',
  createdAt: Date.now(),
  updatedAt: Date.now()
}))

const mockGetProjectFiles = mock(async (projectId: number): Promise<File[]> => [
  {
    id: 1,
    projectId,
    path: 'src/auth/jwt.ts',
    name: 'jwt.ts',
    extension: '.ts',
    content: 'import jwt from "jsonwebtoken"\n\nexport function verifyToken() {\n  // implementation\n}',
    size: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    checksum: 'abc123'
  } as File,
  {
    id: 2,
    projectId,
    path: 'src/api/routes.ts',
    name: 'routes.ts',
    extension: '.ts',
    content: 'import express from "express"\n\nconst router = express.Router()\n\nrouter.get("/", () => {})',
    size: 150,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    checksum: 'def456'
  } as File,
  {
    id: 3,
    projectId,
    path: 'tests/auth.test.ts',
    name: 'auth.test.ts',
    extension: '.ts',
    content: 'import { test } from "bun:test"\n\ntest("auth works", () => {})',
    size: 80,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    checksum: 'ghi789'
  } as File
])

// Mock the service imports
mock.module('../../project-service', () => ({
  getProjectById: mockGetProjectById,
  getProjectFiles: mockGetProjectFiles
}))

describe('Partial File Fetcher', () => {
  beforeEach(() => {
    mockGetProjectById.mockClear()
    mockGetProjectFiles.mockClear()
  })

  describe('fetchPartialFilesFromDirectories', () => {
    test('should fetch first N lines from files in specified directories', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src/auth'], {
        lineCount: 2
      })

      expect(result.partialFiles).toBeDefined()
      expect(result.partialFiles.length).toBe(1)
      expect(result.partialFiles[0].path).toBe('src/auth/jwt.ts')
      expect(result.partialFiles[0].lineCount).toBe(2)
      expect(result.partialFiles[0].partialContent).toContain('import jwt')
    })

    test('should handle multiple directories', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src/auth', 'src/api'], {
        lineCount: 3
      })

      expect(result.partialFiles.length).toBe(2)
      expect(result.metadata.totalFilesInDirectories).toBe(2)
    })

    test('should respect lineCount option', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        lineCount: 1
      })

      result.partialFiles.forEach((file) => {
        expect(file.lineCount).toBeLessThanOrEqual(1)
      })
    })

    test('should mark files as truncated when totalLines > lineCount', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src/auth'], {
        lineCount: 2
      })

      const file = result.partialFiles[0]
      if (file.totalLines > 2) {
        expect(file.truncated).toBe(true)
      }
    })

    test('should filter files by includeExtensions', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src', 'tests'], {
        includeExtensions: ['.ts']
      })

      result.partialFiles.forEach((file) => {
        expect(file.extension).toBe('.ts')
      })
    })

    test('should filter files by excludeExtensions', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        excludeExtensions: ['.ts']
      })

      result.partialFiles.forEach((file) => {
        expect(file.extension).not.toBe('.ts')
      })
    })

    test('should skip files larger than maxFileSize', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        maxFileSize: 120 // Smaller than some files
      })

      expect(result.metadata.filesSkipped).toBeGreaterThan(0)
    })

    test('should include metadata with statistics', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        lineCount: 50
      })

      expect(result.metadata).toBeDefined()
      expect(result.metadata.totalFilesInDirectories).toBeGreaterThan(0)
      expect(result.metadata.filesReturned).toBeGreaterThan(0)
      expect(result.metadata.averageLineCount).toBeGreaterThan(0)
      expect(result.metadata.totalTokensEstimate).toBeGreaterThan(0)
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
    })

    test('should skip files without content', async () => {
      // Mock a file without content
      mockGetProjectFiles.mockReturnValueOnce(
        Promise.resolve([
          {
            id: 1,
            projectId: 1,
            path: 'src/empty.ts',
            name: 'empty.ts',
            extension: '.ts',
            content: null,
            size: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            checksum: 'empty'
          } as File
        ])
      )

      const result = await fetchPartialFilesFromDirectories(1, ['src'], {})

      expect(result.partialFiles.length).toBe(0)
      expect(result.metadata.filesSkipped).toBe(1)
    })

    test('should estimate token count accurately', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src/auth'], {
        lineCount: 50
      })

      // Token estimate should be roughly content.length / 4
      const totalChars = result.partialFiles.reduce(
        (sum, f) => sum + f.partialContent.length,
        0
      )
      const expectedTokens = Math.ceil(totalChars / 4)

      expect(result.metadata.totalTokensEstimate).toBeCloseTo(expectedTokens, -1)
    })
  })

  describe('Security: Path Traversal Prevention', () => {
    test('should reject directories outside project root with ../', async () => {
      await expect(
        fetchPartialFilesFromDirectories(1, ['../../etc'], {})
      ).rejects.toThrow(/Invalid directory.*expected path within project root/)
    })

    test('should reject directories outside project root with absolute paths', async () => {
      await expect(
        fetchPartialFilesFromDirectories(1, ['/etc/passwd'], {})
      ).rejects.toThrow(/Invalid directory.*expected path within project root/)
    })

    test('should reject directories that resolve outside project', async () => {
      await expect(
        fetchPartialFilesFromDirectories(1, ['src/../../etc'], {})
      ).rejects.toThrow(/Invalid directory.*expected path within project root/)
    })

    test('should accept valid relative directories', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src'], {})
      expect(result).toBeDefined()
      expect(result.partialFiles).toBeDefined()
    })

    test('should accept nested directories within project', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src/auth'], {})
      expect(result).toBeDefined()
      expect(result.partialFiles).toBeDefined()
    })

    test('should validate all directories in array', async () => {
      await expect(
        fetchPartialFilesFromDirectories(1, ['src', '../../etc'], {})
      ).rejects.toThrow(/Invalid directory.*expected path within project root/)
    })

    test('should throw error if project not found', async () => {
      mockGetProjectById.mockReturnValueOnce(Promise.resolve(null))

      await expect(
        fetchPartialFilesFromDirectories(999, ['src'], {})
      ).rejects.toThrow()
    })
  })

  describe('Edge cases', () => {
    test('should handle empty directories array', async () => {
      const result = await fetchPartialFilesFromDirectories(1, [], {})

      expect(result.partialFiles).toHaveLength(0)
      if (result.metadata.totalFiles !== undefined) {
        expect(result.metadata.totalFiles).toBe(0)
      }
    })

    test('should handle directory with no matching files', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['nonexistent'], {})

      expect(result.partialFiles).toHaveLength(0)
    })

    test('should handle very long files with small lineCount', async () => {
      // Create a file with 1000 lines
      const longContent = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n')
      mockGetProjectFiles.mockReturnValueOnce(
        Promise.resolve([
          {
            id: 1,
            projectId: 1,
            path: 'src/long.ts',
            name: 'long.ts',
            extension: '.ts',
            content: longContent,
            size: longContent.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            checksum: 'long'
          } as File
        ])
      )

      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        lineCount: 10
      })

      expect(result.partialFiles[0].lineCount).toBe(10)
      expect(result.partialFiles[0].totalLines).toBe(1000)
      expect(result.partialFiles[0].truncated).toBe(true)
    })

    test('should handle file with no newlines', async () => {
      mockGetProjectFiles.mockReturnValueOnce(
        Promise.resolve([
          {
            id: 1,
            projectId: 1,
            path: 'src/single.ts',
            name: 'single.ts',
            extension: '.ts',
            content: 'single line content',
            size: 19,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            checksum: 'single'
          } as File
        ])
      )

      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        lineCount: 50
      })

      expect(result.partialFiles[0].lineCount).toBe(1)
      expect(result.partialFiles[0].totalLines).toBe(1)
      expect(result.partialFiles[0].truncated).toBe(false)
    })

    test('should calculate average line count correctly', async () => {
      const result = await fetchPartialFilesFromDirectories(1, ['src', 'tests'], {
        lineCount: 50
      })

      if (result.partialFiles.length > 0) {
        const manualAverage =
          result.partialFiles.reduce((sum, f) => sum + f.lineCount, 0) /
          result.partialFiles.length

        expect(result.metadata.averageLineCount).toBe(Math.round(manualAverage))
      }
    })
  })

  describe('Performance', () => {
    test('should complete within reasonable time for many files', async () => {
      // Mock 100 files
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        projectId: 1,
        path: `src/file${i}.ts`,
        name: `file${i}.ts`,
        extension: '.ts',
        content: `// File ${i}\nexport const value = ${i}`,
        size: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        checksum: `checksum${i}`
      })) as File[]

      mockGetProjectFiles.mockReturnValueOnce(Promise.resolve(manyFiles))

      const startTime = Date.now()
      const result = await fetchPartialFilesFromDirectories(1, ['src'], {
        lineCount: 50,
        maxTotalFiles: 150,
        maxFilesPerDirectory: 150
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
      expect(result.partialFiles.length).toBe(100)
    })
  })
})
