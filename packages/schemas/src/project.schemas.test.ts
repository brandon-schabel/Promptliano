import { describe, expect, test } from 'bun:test'
import { SuggestFilesBodySchema, SuggestFilesResponseSchema } from './project.schemas'

describe('SuggestFilesBodySchema', () => {
  test('applies defaults for limit, strategy, and includeScores', () => {
    const parsed = SuggestFilesBodySchema.parse({ userInput: 'review MCP transport tools' })

    expect(parsed.limit).toBe(25)
    expect(parsed.strategy).toBe('balanced')
    expect(parsed.includeScores).toBe(true)
  })

  test('accepts prompt alias and enforces required input', () => {
    const parsed = SuggestFilesBodySchema.parse({ prompt: 'simplify MCP workflow', limit: 15 })
    expect(parsed.limit).toBe(15)

    expect(() => SuggestFilesBodySchema.parse({ limit: 5 })).toThrow()
  })
})

describe('SuggestFilesResponseSchema', () => {
  test('validates extended metadata fields', () => {
    const payload = {
      success: true,
      data: {
        suggestedFiles: [
          {
            path: 'packages/server/src/mcp/server.ts',
            relevance: 0.8,
            reason: 'Match',
            fileType: '.ts',
            aiConfidence: 0.92,
            aiReasons: ['DirectMatch', 'Dependency']
          }
        ],
        totalFiles: 120,
        analyzedFiles: 40,
        strategy: 'balanced',
        tokensSaved: 1250,
        processingTime: 120,
        recommendedFileIds: ['42'],
        aiSelections: [
          { id: 'packages/server/src/mcp/server.ts', confidence: 0.92, reasons: ['DirectMatch', 'Dependency'] }
        ]
      }
    }

    expect(() => SuggestFilesResponseSchema.parse(payload)).not.toThrow()
  })
})
