import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test'
import { suggestFilesFromPartialContent } from '../ai-file-suggester'
import type { PartialFileContent, FileSuggestionOptions } from '../ai-file-suggester'
import { seedModelConfigs } from '../../test-utils/test-model-setup'

// Mock model config service to provide preset configs
mock.module('../../model-config-service', () => ({
  modelConfigService: {
    getPresetConfig: mock(async (preset: string) => {
      const configs: Record<string, any> = {
        low: {
          id: 1,
          name: 'low',
          displayName: 'Low - Fast',
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          temperature: 0.7,
          maxTokens: 2048
        },
        medium: {
          id: 2,
          name: 'medium',
          displayName: 'Medium - Balanced',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
          maxTokens: 4096
        },
        high: {
          id: 3,
          name: 'high',
          displayName: 'High - Quality',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.8,
          maxTokens: 8192
        }
      }
      return configs[preset] || configs.medium
    }),
    resolveProviderConfig: mock(async ({ provider, model }: any) => ({
      id: 1,
      name: 'test-config',
      provider: provider || 'anthropic',
      model: model || 'claude-3-haiku-20240307',
      temperature: 0.7,
      maxTokens: 4096
    }))
  }
}))

// Mock generateStructuredData to return predictable results
mock.module('../../gen-ai-services', () => ({
  generateStructuredData: mock(async () => ({
    object: {
      suggestions: [
        { fileId: '1', confidence: 0.9, relevance: 0.85, reasons: ['JWT auth'] },
        { fileId: '2', confidence: 0.8, relevance: 0.75, reasons: ['Session handling'] }
      ]
    }
  }))
}))

// Mock AI SDK to prevent real API calls
mock.module('ai', () => ({
  generateObject: mock(async ({ model, schema, prompt }: any) => {
    // Return mock based on what's being requested
    if (prompt && typeof prompt === 'string' && prompt.includes('directory')) {
      // Directory selection mock
      return {
        object: {
          selectedDirectories: ['src'],
          reasoning: 'Mock directory selection for testing',
          confidenceScores: { src: 0.9 }
        }
      }
    } else {
      // File suggestion mock
      return {
        object: {
          suggestedFiles: [
            {
              fileId: '1',
              path: 'src/auth/jwt.ts',
              confidence: 0.9,
              relevance: 0.85,
              reasons: ['Mock suggestion for testing']
            }
          ],
          metadata: {
            totalAnalyzed: 1,
            processingTime: 100
          }
        }
      }
    }
  })
}))

describe('AI File Suggester', () => {
  beforeAll(async () => {
    await seedModelConfigs()
  })

  const mockPartialFiles: PartialFileContent[] = [
    {
      fileId: '1',
      path: 'src/auth/jwt.ts',
      extension: '.ts',
      partialContent:
        'import jwt from "jsonwebtoken"\nimport { User } from "../types"\n\nexport function verifyToken(token: string) {\n  return jwt.verify(token, process.env.JWT_SECRET)\n}',
      lineCount: 5,
      totalLines: 50,
      truncated: true,
      size: 2048
    },
    {
      fileId: '2',
      path: 'src/auth/session.ts',
      extension: '.ts',
      partialContent:
        'import { Session } from "../types"\n\nexport function createSession(userId: number) {\n  // Create new session\n}',
      lineCount: 4,
      totalLines: 30,
      truncated: true,
      size: 1024
    },
    {
      fileId: '3',
      path: 'src/api/routes.ts',
      extension: '.ts',
      partialContent:
        'import express from "express"\n\nconst router = express.Router()\n\nrouter.get("/auth/login", () => {})',
      lineCount: 5,
      totalLines: 20,
      truncated: true,
      size: 512
    },
    {
      fileId: '4',
      path: 'src/components/LoginForm.tsx',
      extension: '.tsx',
      partialContent:
        'import React from "react"\n\nexport function LoginForm() {\n  return <form>Login</form>\n}',
      lineCount: 4,
      totalLines: 25,
      truncated: true,
      size: 800
    },
    {
      fileId: '5',
      path: 'tests/auth.test.ts',
      extension: '.ts',
      partialContent:
        'import { test } from "bun:test"\nimport { verifyToken } from "../src/auth/jwt"\n\ntest("verifyToken works", () => {})',
      lineCount: 4,
      totalLines: 15,
      truncated: true,
      size: 400
    }
  ]

  describe('suggestFilesFromPartialContent', () => {
    test('should suggest relevant files based on user input', async () => {
      const result = await suggestFilesFromPartialContent(
        mockPartialFiles,
        'implement JWT authentication',
        {
          maxResults: 3,
          aiModel: 'medium'
        }
      )

      expect(result.suggestedFiles).toBeDefined()
      expect(Array.isArray(result.suggestedFiles)).toBe(true)
      expect(result.suggestedFiles.length).toBeGreaterThan(0)
      expect(result.suggestedFiles.length).toBeLessThanOrEqual(3)
    })

    test('should include confidence scores for each suggestion', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'JWT token', {
        maxResults: 5
      })

      result.suggestedFiles.forEach((file) => {
        expect(file).toHaveProperty('confidence')
        expect(file.confidence).toBeGreaterThanOrEqual(0)
        expect(file.confidence).toBeLessThanOrEqual(1)
      })
    })

    test('should include relevance scores for each suggestion', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'authentication', {
        maxResults: 5
      })

      result.suggestedFiles.forEach((file) => {
        expect(file).toHaveProperty('relevance')
        expect(file.relevance).toBeGreaterThanOrEqual(0)
        expect(file.relevance).toBeLessThanOrEqual(1)
      })
    })

    test('should include specific reasons for each suggestion', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'JWT implementation', {
        maxResults: 3
      })

      result.suggestedFiles.forEach((file) => {
        expect(file).toHaveProperty('reasons')
        expect(Array.isArray(file.reasons)).toBe(true)
        expect(file.reasons.length).toBeGreaterThan(0)
      })
    })

    test('should respect maxResults limit', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 2
      })

      expect(result.suggestedFiles.length).toBeLessThanOrEqual(2)
    })

    test('should filter by minConfidence threshold', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'authentication', {
        maxResults: 10,
        minConfidence: 0.7 // High confidence threshold
      })

      result.suggestedFiles.forEach((file) => {
        expect(file.confidence).toBeGreaterThanOrEqual(0.7)
      })
    })

    test('should use different AI models based on option', async () => {
      const resultMedium = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        aiModel: 'medium'
      })

      const resultHigh = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        aiModel: 'high'
      })

      expect(resultMedium.metadata.aiModel).toBeDefined()
      expect(resultHigh.metadata.aiModel).toBeDefined()
      // Both should complete without errors
    })

    test('should include user context in suggestion process', async () => {
      const result = await suggestFilesFromPartialContent(
        mockPartialFiles,
        'implement feature',
        {
          maxResults: 5,
          userContext: 'focus on authentication and security'
        }
      )

      expect(result.suggestedFiles).toBeDefined()
      // Should prioritize auth-related files when context mentions authentication
    })

    test('should include metadata with timing information', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 5
      })

      expect(result.metadata).toBeDefined()
      expect(result.metadata.totalCandidates).toBe(mockPartialFiles.length)
      expect(result.metadata.filesAnalyzed).toBe(mockPartialFiles.length)
      expect(result.metadata.processingTime).toBeGreaterThan(0)
      expect(result.metadata.aiModel).toBeDefined()
    })

    test('should include token savings estimate in metadata', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 5
      })

      expect(result.metadata.tokensSaved).toBeGreaterThanOrEqual(0)
    })

    test('should handle empty partial files array', async () => {
      const result = await suggestFilesFromPartialContent([], 'test', {
        maxResults: 5
      })

      expect(result.suggestedFiles).toHaveLength(0)
      expect(result.metadata.totalCandidates).toBe(0)
      expect(result.metadata.filesAnalyzed).toBe(0)
    })

    test('should handle single file', async () => {
      const result = await suggestFilesFromPartialContent([mockPartialFiles[0]], 'JWT', {
        maxResults: 5
      })

      expect(result.suggestedFiles.length).toBeLessThanOrEqual(1)
    })

    test('should rank files by relevance', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'JWT authentication', {
        maxResults: 10,
        minConfidence: 0.1 // Low threshold to get all files
      })

      // Files should be sorted by relevance (descending)
      for (let i = 0; i < result.suggestedFiles.length - 1; i++) {
        expect(result.suggestedFiles[i].relevance).toBeGreaterThanOrEqual(
          result.suggestedFiles[i + 1].relevance
        )
      }
    })

    test('should include file metadata in suggestions', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 5
      })

      result.suggestedFiles.forEach((file) => {
        expect(file).toHaveProperty('fileId')
        expect(file).toHaveProperty('path')
        expect(file).toHaveProperty('extension')
        expect(file).toHaveProperty('lineCount')
        expect(file).toHaveProperty('totalLines')
      })
    })

    test('should handle files with different extensions', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'component', {
        maxResults: 5
      })

      // Should be able to suggest .tsx files
      const hasTypescriptReact = result.suggestedFiles.some(
        (f) => f.extension === '.tsx'
      )
      if (result.suggestedFiles.length > 0) {
        expect(['.ts', '.tsx']).toContain(result.suggestedFiles[0].extension)
      }
    })
  })

  describe('Strategy configurations', () => {
    test('should use fast strategy settings', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 5,
        minConfidence: 0.4,
        aiModel: 'medium',
        strategy: 'fast'
      })

      expect(result.metadata.strategy).toBe('ai-file-suggestion-fast')
    })

    test('should use balanced strategy settings', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 10,
        minConfidence: 0.3,
        aiModel: 'medium',
        strategy: 'balanced'
      })

      expect(result.metadata.strategy).toBe('ai-file-suggestion-balanced')
    })

    test('should use thorough strategy settings', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 15,
        minConfidence: 0.2,
        aiModel: 'high',
        strategy: 'thorough'
      })

      expect(result.metadata.strategy).toBe('ai-file-suggestion-thorough')
    })
  })

  describe('Performance', () => {
    test('should handle large number of files efficiently', async () => {
      // Create 100 mock files
      const manyFiles: PartialFileContent[] = Array.from({ length: 100 }, (_, i) => ({
        fileId: String(i),
        path: `src/file${i}.ts`,
        extension: '.ts',
        partialContent: `// File ${i}\nexport const value = ${i}`,
        lineCount: 2,
        totalLines: 10,
        truncated: true,
        size: 50
      }))

      const startTime = Date.now()
      const result = await suggestFilesFromPartialContent(manyFiles, 'test', {
        maxResults: 10
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
      expect(result.suggestedFiles.length).toBeLessThanOrEqual(10)
    })

    test('should complete within reasonable time for complex query', async () => {
      const complexQuery =
        'Find files related to JWT authentication, session management, and user verification in the authentication system'

      const startTime = Date.now()
      const result = await suggestFilesFromPartialContent(mockPartialFiles, complexQuery, {
        maxResults: 5
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.suggestedFiles).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    test('should handle files with minimal content', async () => {
      const minimalFiles: PartialFileContent[] = [
        {
          fileId: '1',
          path: 'src/minimal.ts',
          extension: '.ts',
          partialContent: '// Empty',
          lineCount: 1,
          totalLines: 1,
          truncated: false,
          size: 10
        }
      ]

      const result = await suggestFilesFromPartialContent(minimalFiles, 'test', {
        maxResults: 5
      })

      expect(result.suggestedFiles).toBeDefined()
    })

    test('should handle very long file content', async () => {
      const longContent = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n')
      const longFiles: PartialFileContent[] = [
        {
          fileId: '1',
          path: 'src/long.ts',
          extension: '.ts',
          partialContent: longContent,
          lineCount: 100,
          totalLines: 1000,
          truncated: true,
          size: 10000
        }
      ]

      const result = await suggestFilesFromPartialContent(longFiles, 'test', {
        maxResults: 5
      })

      expect(result.suggestedFiles).toBeDefined()
    })

    test('should handle special characters in content', async () => {
      const specialFiles: PartialFileContent[] = [
        {
          fileId: '1',
          path: 'src/special.ts',
          extension: '.ts',
          partialContent: 'const regex = /[a-z]+/g\nconst template = `Hello ${name}`',
          lineCount: 2,
          totalLines: 10,
          truncated: true,
          size: 100
        }
      ]

      const result = await suggestFilesFromPartialContent(specialFiles, 'regex', {
        maxResults: 5
      })

      expect(result.suggestedFiles).toBeDefined()
    })

    test('should handle empty user input gracefully', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, '', {
        maxResults: 5
      })

      expect(result.suggestedFiles).toBeDefined()
      // Should still return some files
    })

    test('should handle very long user input', async () => {
      const longInput = 'Find files related to ' + 'authentication '.repeat(50)

      const result = await suggestFilesFromPartialContent(mockPartialFiles, longInput, {
        maxResults: 5
      })

      expect(result.suggestedFiles).toBeDefined()
    })
  })

  describe('AI response validation', () => {
    test('should validate file IDs match provided files', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 10
      })

      const validFileIds = new Set(mockPartialFiles.map((f) => f.fileId))

      result.suggestedFiles.forEach((file) => {
        expect(validFileIds.has(file.fileId)).toBe(true)
      })
    })

    test('should not suggest duplicate files', async () => {
      const result = await suggestFilesFromPartialContent(mockPartialFiles, 'test', {
        maxResults: 10
      })

      const fileIds = result.suggestedFiles.map((f) => f.fileId)
      const uniqueFileIds = new Set(fileIds)

      expect(fileIds.length).toBe(uniqueFileIds.size)
    })
  })
})
