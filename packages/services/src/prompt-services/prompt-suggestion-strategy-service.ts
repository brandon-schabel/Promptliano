import type { FileSuggestionStrategy } from '@promptliano/database'
import { promptRepository as defaultPromptRepository } from '@promptliano/database'
import { createPromptRelevanceService, type PromptRelevanceScoreResult } from './prompt-relevance-service'
import { createPromptSearchService } from './prompt-search-service'
import { buildFuzzyQuery, buildVariantQueries, extractKeywords, clamp01 } from '../suggestions/utils/suggestion-utils'

export interface PromptSuggestionResponse {
  suggestions: string[]
  scores?: PromptRelevanceScoreResult[]
  metadata: {
    totalPrompts: number
    analyzedPrompts: number
    strategy: FileSuggestionStrategy
    processingTime: number
    tokensSaved: number
  }
  error?: string
}

export interface StrategyConfig {
  maxPreFilterItems: number
  maxAIItems: number
  useAI: boolean
  aiModel: 'high' | 'medium'
  compactLevel: 'ultra' | 'compact' | 'standard'
}

const STRATEGIES: Record<FileSuggestionStrategy, StrategyConfig> = {
  fast: { maxPreFilterItems: 30, maxAIItems: 0, useAI: false, aiModel: 'medium', compactLevel: 'ultra' },
  balanced: { maxPreFilterItems: 50, maxAIItems: 50, useAI: true, aiModel: 'medium', compactLevel: 'compact' },
  thorough: { maxPreFilterItems: 100, maxAIItems: 100, useAI: true, aiModel: 'high', compactLevel: 'standard' }
}

export function createPromptSuggestionStrategyService(deps: {
  repository?: { getByProject: (projectId: number) => Promise<any[]> }
  relevance?: ReturnType<typeof createPromptRelevanceService>
  search?: ReturnType<typeof createPromptSearchService>
} = {}) {
  const repository = deps.repository || defaultPromptRepository
  const relevance = deps.relevance || createPromptRelevanceService({ repository })
  const search = deps.search || createPromptSearchService({ repository })

  async function suggestPrompts(
    projectId: number,
    userInput: string,
    strategy: FileSuggestionStrategy = 'balanced',
    maxResults: number = 10,
    userContext?: string
  ): Promise<PromptSuggestionResponse> {
    const started = Date.now()
    const all = await repository.getByProject(projectId)
    const byId = new Map(all.map((p) => [String(p.id), p]))

    const relevanceScores = await relevance.scorePromptsForText(`${userInput || ''} ${userContext || ''}`, projectId)

    const tokens = extractKeywords(userInput || '')
    const fuzzyQuery = buildFuzzyQuery(tokens)
    let fuzzyResults: Array<{ promptId: string; score: number }> = []

    if (fuzzyQuery) {
      const { results } = await search.search(projectId, { query: fuzzyQuery, searchType: 'fuzzy', limit: 50 })
      fuzzyResults = results.map((r) => ({ promptId: String(r.prompt.id), score: clamp01(r.score) }))
    }

    const variants = buildVariantQueries(tokens)
    for (const q of variants) {
      const { results } = await search.search(projectId, { query: q, searchType: 'fuzzy', limit: 25 })
      for (const r of results) fuzzyResults.push({ promptId: String(r.prompt.id), score: clamp01(r.score) })
    }

    const candidateIds = new Set<string>([
      ...relevanceScores.slice(0, Math.max(200, maxResults * 10)).map((s) => String(s.promptId)),
      ...fuzzyResults.map((f) => f.promptId)
    ])

    const relMap = new Map(relevanceScores.map((s) => [String(s.promptId), s]))
    const fuzzyMap = new Map<string, number>()
    for (const f of fuzzyResults) {
      const prev = fuzzyMap.get(f.promptId) || 0
      if (f.score > prev) fuzzyMap.set(f.promptId, f.score)
    }

    let composite = Array.from(candidateIds)
      .map((id) => {
        const base = relMap.get(id) || createZeroScore(id)
        const fuzzy = fuzzyMap.get(id) || 0
        const boost = computeTagBoost(byId.get(id)?.tags || [], tokens)
        const total = clamp01(base.totalScore * 0.75 + fuzzy * 0.2 + boost * 0.15)
        return { ...base, promptId: id, totalScore: total }
      })
      .sort((a, b) => b.totalScore - a.totalScore)

    const top = composite.slice(0, maxResults)
    const suggestions = top.map((s) => String(s.promptId))

    return {
      suggestions,
      scores: top,
      metadata: {
        totalPrompts: all.length,
        analyzedPrompts: composite.length,
        strategy,
        processingTime: Date.now() - started,
        tokensSaved: 0
      }
    }
  }

  return { suggestPrompts }
}

function createZeroScore(id: string): PromptRelevanceScoreResult {
  return {
    promptId: id,
    totalScore: 0,
    titleScore: 0,
    contentScore: 0,
    tagScore: 0,
    recencyScore: 0,
    usageScore: 0
  }
}

function computeTagBoost(tags: unknown, tokens: string[]): number {
  const tagList = Array.isArray(tags) ? (tags as string[]).map((t) => String(t).toLowerCase()) : []
  if (tagList.length === 0 || tokens.length === 0) return 0
  let hits = 0
  for (const t of tokens) {
    for (const g of tagList) {
      if (g === t) {
        hits += 1
        break
      }
      if (g.includes(t) || t.includes(g)) {
        hits += 0.5
        break
      }
    }
  }
  return clamp01(hits / tokens.length)
}
