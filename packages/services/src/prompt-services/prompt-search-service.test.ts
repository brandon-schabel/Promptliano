import { describe, it, expect } from 'bun:test'
import type { Prompt } from '@promptliano/database'
import { createPromptSearchService } from './prompt-search-service'

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

describe('prompt-search-service', () => {
  it('performs simple fuzzy search over title/tags/content', async () => {
    const prompts: Prompt[] = [
      makePrompt(1, 'Authentication Flow', 'Implement login and signup with JWT', ['auth', 'backend']),
      makePrompt(2, 'Unit Testing Guide', 'Write unit tests for services and hooks', ['testing']),
      makePrompt(3, 'API Routes', 'Add REST API routes for users', ['api'])
    ]

    const search = createPromptSearchService({ repository: { getByProject: async () => prompts } })
    const { results } = await search.search(1, { query: 'auth login', searchType: 'fuzzy', limit: 10 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].prompt.id).toBe(1)
  })
})
