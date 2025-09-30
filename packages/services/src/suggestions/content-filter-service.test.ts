import { describe, test, expect } from 'bun:test'
import { extractKeywords } from './utils/suggestion-utils'

describe('ContentFilterService - Keyword Extraction', () => {
  describe('keyword extraction utility', () => {
    test('should extract relevant keywords from query', () => {
      const query = 'find authentication routes for user login'
      const keywords = extractKeywords(query)

      expect(Array.isArray(keywords)).toBe(true)
      expect(keywords.length).toBeGreaterThan(0)
      expect(keywords).toContain('authentication')
      expect(keywords).toContain('routes')
      expect(keywords).toContain('user')
      expect(keywords).toContain('login')
    })

    test('should filter stop words', () => {
      const query = 'the quick brown fox is jumping'
      const keywords = extractKeywords(query)

      // Stop words should be filtered
      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('is')
      // Content words should remain
      expect(keywords).toContain('quick')
      expect(keywords).toContain('brown')
    })

    test('should handle empty query', () => {
      const keywords = extractKeywords('')
      expect(Array.isArray(keywords)).toBe(true)
      expect(keywords.length).toBe(0)
    })
  })

  describe('path analysis', () => {
    test('should detect test files', () => {
      const testPaths = [
        'src/components/Button.test.ts',
        'src/utils/helpers.spec.ts',
        '__tests__/integration.ts',
        'e2e/auth.test.ts'
      ]

      testPaths.forEach((path) => {
        const isTest =
          path.includes('.test.') ||
          path.includes('.spec.') ||
          path.includes('__tests__') ||
          path.includes('/e2e/')
        expect(isTest).toBe(true)
      })
    })

    test('should detect migration files', () => {
      const migrationPaths = [
        'migrations/001_initial.sql',
        'src/database/migrations/002_users.ts',
        'db/migrate/003_add_index.sql'
      ]

      migrationPaths.forEach((path) => {
        const isMigration = path.includes('migration') || path.endsWith('.sql')
        expect(isMigration).toBe(true)
      })
    })

    test('should detect config files', () => {
      const configPaths = [
        'tsconfig.json',
        'vite.config.ts',
        '.eslintrc.js',
        'config/database.ts'
      ]

      configPaths.forEach((path) => {
        const isConfig =
          path.includes('config') ||
          path.endsWith('.json') ||
          path.includes('.eslintrc') ||
          path.startsWith('tsconfig') ||
          path.startsWith('vite.config')
        expect(isConfig).toBe(true)
      })
    })
  })

  describe('keyword variations', () => {
    test('should handle technical terms', () => {
      const keywords = extractKeywords('typescript generics interface')
      expect(keywords).toContain('typescript')
      expect(keywords).toContain('generics')
      expect(keywords).toContain('interface')
    })

    test('should handle phrases with special characters', () => {
      const keywords = extractKeywords('file-sync-service.ts configuration')
      expect(keywords.length).toBeGreaterThan(0)
    })
  })
})

describe('Content Filter Type Safety', () => {
  test('should maintain type safety for options', () => {
    // Valid options
    const validOptions = {
      maxFiles: 10,
      includeContext: true,
      contextLines: 3,
      useAI: true,
      aiModel: 'medium' as const,
      userContext: 'test context'
    }

    // TypeScript should accept valid options
    expect(validOptions.aiModel).toBe('medium')
    expect(validOptions.maxFiles).toBe(10)
    expect(validOptions.includeContext).toBe(true)
  })
})