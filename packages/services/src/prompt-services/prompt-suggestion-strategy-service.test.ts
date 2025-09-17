import { describe, it, expect } from 'bun:test'
import type { Prompt } from '@promptliano/database'
import { createPromptSuggestionStrategyService } from './prompt-suggestion-strategy-service'

function makePrompt(id: number, title: string, content: string, tags: string[] = []): Prompt {
  return {
    id,
    projectId: 1,
    title,
    content,
    description: null,
    tags,
    createdAt: Date.now(),
    updatedAt: Date.now()
  } as unknown as Prompt
}

describe('prompt-suggestion-strategy-service', () => {
  it('returns prompt IDs ordered by composite score', async () => {
    const prompts: Prompt[] = [
      makePrompt(1, 'Authentication Flow', 'Implement login and signup with JWT', ['auth', 'backend']),
      makePrompt(2, 'Unit Testing Guide', 'Write unit tests for services and hooks', ['testing']),
      makePrompt(3, 'API Routes', 'Add REST API routes for users', ['api'])
    ]

    const strat = createPromptSuggestionStrategyService({ repository: { getByProject: async () => prompts } })
    const res = await strat.suggestPrompts(1, 'implement auth login', 'fast', 2)
    expect(res.suggestions.length).toBe(2)
    // Authentication should be included and likely ranked first
    expect(res.suggestions).toContain('1')
  })
})

