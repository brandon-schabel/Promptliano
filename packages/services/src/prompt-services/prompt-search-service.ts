import type { Prompt } from '@promptliano/database'
import { promptRepository as defaultPromptRepository } from '@promptliano/database'

export interface PromptSearchOptions {
  query: string
  searchType?: 'fuzzy'
  limit?: number
  offset?: number
}

export interface PromptSearchResult {
  prompt: Prompt
  score: number
}

export function createPromptSearchService(
  deps: { repository?: { getByProject: (projectId: number) => Promise<Prompt[]> } } = {}
) {
  const repository = deps.repository || defaultPromptRepository
  async function search(projectId: number, options: PromptSearchOptions): Promise<{ results: PromptSearchResult[] }> {
    const all = await repository.getByProject(projectId)
    const q = (options.query || '').toLowerCase().trim()
    if (!q) return { results: [] }

    const scored = all
      .map((p) => ({ prompt: p, score: calculateFuzzyScore(q, p) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)

    const offset = options.offset || 0
    const limit = options.limit || 50
    return { results: scored.slice(offset, offset + limit) }
  }

  return { search }
}

function calculateFuzzyScore(query: string, p: Prompt): number {
  const qTokens = tokenize(query)
  if (qTokens.length === 0) return 0

  const title = String(p.title || '').toLowerCase()
  const tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => String(t).toLowerCase())
  const content = String(p.content || '')
    .toLowerCase()
    .slice(0, 240)

  let score = 0
  for (const t of qTokens) {
    if (title.includes(t)) score += 2
    else if (tags.some((g) => g.includes(t))) score += 1.5
    else if (content.includes(t)) score += 1
  }

  return score / (qTokens.length * 2)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}
