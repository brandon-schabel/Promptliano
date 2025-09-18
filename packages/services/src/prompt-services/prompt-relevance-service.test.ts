import { describe, it, expect } from 'bun:test'
import type { Prompt } from '@promptliano/database'
import { createPromptRelevanceService } from './prompt-relevance-service'

function makePrompt(id: number, title: string, content: string, tags: string[] = []): Prompt {
  return {
    id,
    projectId: 1,
    title,
    content,
    description: null,
    tags,
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000
  } as unknown as Prompt
}

describe('prompt-relevance-service', () => {
  it('scores title/content/tag relevance and sorts prompts', async () => {
    const prompts: Prompt[] = [
      makePrompt(1, 'Authentication Flow', 'Implement login and signup with JWT', ['auth', 'backend']),
      makePrompt(2, 'Unit Testing Guide', 'Write unit tests for services and hooks', ['testing']),
      makePrompt(3, 'API Routes', 'Add REST API routes for users', ['api'])
    ]

    const service = createPromptRelevanceService({
      repository: { getByProject: async () => prompts }
    })

    const scores = await service.scorePromptsForText('implement auth login', 1)
    expect(scores.length).toBeGreaterThan(0)

    // Expect Authentication prompt to come first
    expect(scores[0].promptId).toBe('1')
    expect(scores[0].totalScore).toBeGreaterThanOrEqual(scores[1].totalScore)
  })
})
