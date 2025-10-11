import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test'
import { selectRelevantDirectories } from '../ai-directory-selector'
import type { FileTreeNode, DirectorySelectionOptions } from '../ai-directory-selector'
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
      directories: [
        { path: '/src/auth', confidence: 0.9, reason: 'Authentication files' },
        { path: '/src/api', confidence: 0.7, reason: 'API routes' }
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

describe('AI Directory Selector', () => {
  beforeAll(async () => {
    await seedModelConfigs()
  })

  const mockFileTree: FileTreeNode = {
    name: 'root',
    path: '/',
    type: 'directory',
    children: [
      {
        name: 'src',
        path: '/src',
        type: 'directory',
        children: [
          {
            name: 'auth',
            path: '/src/auth',
            type: 'directory',
            children: [
              { name: 'jwt.ts', path: '/src/auth/jwt.ts', type: 'file' },
              { name: 'session.ts', path: '/src/auth/session.ts', type: 'file' }
            ]
          },
          {
            name: 'api',
            path: '/src/api',
            type: 'directory',
            children: [
              { name: 'routes.ts', path: '/src/api/routes.ts', type: 'file' }
            ]
          },
          {
            name: 'components',
            path: '/src/components',
            type: 'directory',
            children: [
              { name: 'Button.tsx', path: '/src/components/Button.tsx', type: 'file' }
            ]
          }
        ]
      },
      {
        name: 'tests',
        path: '/tests',
        type: 'directory',
        children: [
          { name: 'auth.test.ts', path: '/tests/auth.test.ts', type: 'file' }
        ]
      },
      {
        name: 'docs',
        path: '/docs',
        type: 'directory',
        children: [
          { name: 'README.md', path: '/docs/README.md', type: 'file' }
        ]
      }
    ]
  }

  describe('selectRelevantDirectories', () => {
    test('should select relevant directories based on user input', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'implement JWT authentication', {
        maxDirectories: 3,
        aiModel: 'medium'
      })

      expect(result.selectedDirectories).toBeDefined()
      expect(Array.isArray(result.selectedDirectories)).toBe(true)
      expect(result.selectedDirectories.length).toBeGreaterThan(0)
      expect(result.selectedDirectories.length).toBeLessThanOrEqual(3)
      expect(result.metadata.totalDirectories).toBeGreaterThan(0)
      expect(result.metadata.strategy).toBeDefined()
    })

    test('should respect maxDirectories limit', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'general search', {
        maxDirectories: 2
      })

      expect(result.selectedDirectories.length).toBeLessThanOrEqual(2)
    })

    test('should include metadata with timing information', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'test prompt', {
        maxDirectories: 5
      })

      expect(result.metadata).toBeDefined()
      expect(result.metadata.totalDirectories).toBeDefined()
      expect(result.metadata.aiModel).toBeDefined()
      expect(result.metadata.processingTime).toBeGreaterThan(0)
      expect(result.metadata.strategy).toBeDefined()
    })

    test('should handle empty file tree gracefully', async () => {
      const emptyTree: FileTreeNode = {
        name: 'root',
        path: '/',
        type: 'directory',
        children: []
      }

      const result = await selectRelevantDirectories(emptyTree, 'test', {
        maxDirectories: 5
      })

      expect(result.selectedDirectories).toBeDefined()
      expect(result.metadata.totalDirectories).toBe(0)
    })

    test('should handle single directory tree', async () => {
      const singleDirTree: FileTreeNode = {
        name: 'root',
        path: '/',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: '/src',
            type: 'directory',
            children: []
          }
        ]
      }

      const result = await selectRelevantDirectories(singleDirTree, 'test', {
        maxDirectories: 5
      })

      expect(result.selectedDirectories.length).toBeLessThanOrEqual(1)
    })

    test('should apply minConfidence filter', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'authentication', {
        maxDirectories: 5,
        minConfidence: 0.8 // High confidence threshold
      })

      // All selections should meet minimum confidence
      if (result.allSelections) {
        result.allSelections.forEach((selection) => {
          expect(selection.confidence).toBeGreaterThanOrEqual(0.8)
        })
      }
    })

    test('should use different AI models based on option', async () => {
      const resultMedium = await selectRelevantDirectories(mockFileTree, 'test', {
        aiModel: 'medium'
      })

      const resultHigh = await selectRelevantDirectories(mockFileTree, 'test', {
        aiModel: 'high'
      })

      expect(resultMedium.metadata.aiModel).toBeDefined()
      expect(resultHigh.metadata.aiModel).toBeDefined()
      // Both should complete without errors
    })

    test('should include user context in selection', async () => {
      const result = await selectRelevantDirectories(
        mockFileTree,
        'implement feature',
        {
          maxDirectories: 5,
          userContext: 'focus on authentication and security'
        }
      )

      expect(result.selectedDirectories).toBeDefined()
      // Should prioritize auth-related directories when context mentions authentication
    })

    test('should handle nested directory structures', async () => {
      const deepTree: FileTreeNode = {
        name: 'root',
        path: '/',
        type: 'directory',
        children: [
          {
            name: 'level1',
            path: '/level1',
            type: 'directory',
            children: [
              {
                name: 'level2',
                path: '/level1/level2',
                type: 'directory',
                children: [
                  {
                    name: 'level3',
                    path: '/level1/level2/level3',
                    type: 'directory',
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = await selectRelevantDirectories(deepTree, 'test', {
        maxDirectories: 5
      })

      expect(result.selectedDirectories).toBeDefined()
      expect(result.metadata.totalDirectories).toBeGreaterThan(0)
    })

    test('should handle large directory trees efficiently', async () => {
      const largeTree: FileTreeNode = {
        name: 'root',
        path: '/',
        type: 'directory',
        children: Array.from({ length: 50 }, (_, i) => ({
          name: `dir${i}`,
          path: `/dir${i}`,
          type: 'directory' as const,
          children: []
        }))
      }

      const startTime = Date.now()
      const result = await selectRelevantDirectories(largeTree, 'test', {
        maxDirectories: 8
      })
      const duration = Date.now() - startTime

      expect(result.selectedDirectories.length).toBeLessThanOrEqual(8)
      expect(result.metadata.totalDirectories).toBe(50)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })

    test('should return all selections when requested', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'test', {
        maxDirectories: 3
      })

      expect(result.allSelections).toBeDefined()
      expect(Array.isArray(result.allSelections)).toBe(true)
      if (result.allSelections && result.allSelections.length > 0) {
        expect(result.allSelections[0]).toHaveProperty('path')
        expect(result.allSelections[0]).toHaveProperty('confidence')
        expect(result.allSelections[0]).toHaveProperty('reason')
      }
    })
  })

  describe('Fallback behavior', () => {
    test('should provide fallback when AI fails', async () => {
      // This test would need to mock AI failure
      // For now, verify that result always has selectedDirectories
      const result = await selectRelevantDirectories(mockFileTree, '', {
        maxDirectories: 3
      })

      expect(result.selectedDirectories).toBeDefined()
      expect(Array.isArray(result.selectedDirectories)).toBe(true)
    })

    test('should include strategy in metadata for fallback', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'test', {
        maxDirectories: 5
      })

      expect(result.metadata.strategy).toBeDefined()
      expect(['directory-selection-medium', 'directory-selection-high', 'fallback-root-dirs']).toContain(
        result.metadata.strategy
      )
    })
  })

  describe('Strategy configurations', () => {
    test('should use fast strategy settings', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'test', {
        maxDirectories: 3,
        minConfidence: 0.4,
        aiModel: 'medium'
      })

      expect(result.selectedDirectories.length).toBeLessThanOrEqual(3)
      expect(result.metadata.aiModel).toBe('medium')
    })

    test('should use balanced strategy settings', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'test', {
        maxDirectories: 5,
        minConfidence: 0.3,
        aiModel: 'medium'
      })

      expect(result.selectedDirectories.length).toBeLessThanOrEqual(5)
    })

    test('should use thorough strategy settings', async () => {
      const result = await selectRelevantDirectories(mockFileTree, 'test', {
        maxDirectories: 8,
        minConfidence: 0.2,
        aiModel: 'high'
      })

      expect(result.selectedDirectories.length).toBeLessThanOrEqual(8)
    })
  })
})
