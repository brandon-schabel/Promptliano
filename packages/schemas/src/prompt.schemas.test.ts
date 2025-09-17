import { describe, expect, it } from 'bun:test'
import { SuggestPromptsResponseSchema } from './prompt.schemas'

describe('SuggestPromptsResponseSchema', () => {
  it('validates prompts with optional debug metadata', () => {
    const payload = {
      success: true,
      data: {
        prompts: [],
        debug: {
          scores: [
            {
              promptId: '42',
              totalScore: 0.92,
              titleScore: 0.8,
              contentScore: 0.7,
              tagScore: 0.6,
              recencyScore: 0.5,
              usageScore: 0,
              aiConfidence: 0.88,
              aiReasons: ['DirectMatch', 'Dependency']
            }
          ],
          metadata: {
            totalPrompts: 12,
            analyzedPrompts: 40,
            strategy: 'balanced',
            processingTime: 320,
            tokensSaved: 0,
            aiSelections: [
              { id: '42', confidence: 0.88, reasons: ['DirectMatch', 'Dependency'] }
            ]
          }
        }
      }
    }

    expect(() => SuggestPromptsResponseSchema.parse(payload)).not.toThrow()
  })
})
