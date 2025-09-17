import type { Prompt } from '@promptliano/database'
import { promptRepository as defaultPromptRepository } from '@promptliano/database'
import { extractKeywords, clamp01 } from '../suggestions/utils/suggestion-utils'

export interface PromptRelevanceConfig {
  weights: {
    title: number
    content: number
    tags: number
    recency: number
    usage: number
  }
  maxPrompts: number
  minScore: number
  contentSample: number
}

export interface PromptRelevanceScoreResult {
  promptId: string
  totalScore: number
  titleScore: number
  contentScore: number
  tagScore: number
  recencyScore: number
  usageScore: number
}

const DEFAULT_PROMPT_RELEVANCE_CONFIG: PromptRelevanceConfig = {
  weights: {
    title: 0.45,
    content: 0.3,
    tags: 0.15,
    recency: 0.1,
    usage: 0
  },
  maxPrompts: 100,
  minScore: 0.05,
  contentSample: 400
}

export function createPromptRelevanceService(deps: { config?: Partial<PromptRelevanceConfig>; repository?: { getByProject: (projectId: number) => Promise<Prompt[]> } } = {}) {
  let cfg: PromptRelevanceConfig = { ...DEFAULT_PROMPT_RELEVANCE_CONFIG, ...(deps.config || {}) }
  const repository = deps.repository || defaultPromptRepository

  async function scorePromptsForText(text: string, projectId: number): Promise<PromptRelevanceScoreResult[]> {
    const prompts = await repository.getByProject(projectId)
    if (!prompts || prompts.length === 0) return []

    const keywords = extractKeywords(text || '')
    const scores: PromptRelevanceScoreResult[] = []

    for (const p of prompts) {
      const titleScore = scoreTitle(p, keywords)
      const contentScore = scoreContent(p, keywords, cfg.contentSample)
      const tagScore = scoreTags(p, keywords)
      const recencyScore = scoreRecency(p)
      const usageScore = 0

      const total =
        titleScore * cfg.weights.title +
        contentScore * cfg.weights.content +
        tagScore * cfg.weights.tags +
        recencyScore * cfg.weights.recency +
        usageScore * cfg.weights.usage

      const totalScore = clamp01(total)
      if (totalScore >= cfg.minScore) {
        scores.push({
          promptId: String(p.id),
          totalScore,
          titleScore,
          contentScore,
          tagScore,
          recencyScore,
          usageScore
        })
      }
    }

    return scores.sort((a, b) => b.totalScore - a.totalScore).slice(0, cfg.maxPrompts)
  }

  function updateConfig(next: Partial<PromptRelevanceConfig>): void {
    cfg = { ...cfg, ...next }
  }

  return {
    scorePromptsForText,
    updateConfig
  }
}

function scoreTitle(p: Prompt, keywords: string[]): number {
  if (keywords.length === 0) return 0
  const t = (p.title || '').toLowerCase()
  let hits = 0
  for (const k of keywords) if (t.includes(k)) hits += 1
  return clamp01(hits / keywords.length)
}

function scoreContent(p: Prompt, keywords: string[], sample: number): number {
  if (keywords.length === 0) return 0
  const c = (p.content || '').toLowerCase().slice(0, Math.max(0, sample))
  let hits = 0
  for (const k of keywords) {
    if (c.includes(k)) hits += 1
    else if (approxContains(c, k)) hits += 0.5
  }
  return clamp01(hits / keywords.length)
}

function scoreTags(p: Prompt, keywords: string[]): number {
  const tags = Array.isArray(p.tags) ? p.tags.map((x) => String(x).toLowerCase()) : []
  if (tags.length === 0 || keywords.length === 0) return 0
  let hits = 0
  for (const k of keywords) {
    for (const tag of tags) {
      if (tag === k) {
        hits += 1
        break
      }
      if (tag.includes(k) || k.includes(tag)) {
        hits += 0.5
        break
      }
    }
  }
  return clamp01(hits / keywords.length)
}

function scoreRecency(p: Prompt): number {
  const ts = p.updatedAt || p.createdAt
  if (!ts) return 0.5
  const now = Date.now()
  const age = now - ts
  const day = 24 * 60 * 60 * 1000
  if (age < day) return 1
  if (age < 30 * day) return 1 - (age / (30 * day)) * 0.5
  return 0.5
}

function approxContains(text: string, term: string): boolean {
  if (!text || !term) return false
  if (text.includes(term)) return true
  if (term.length < 3) return false
  const words = text.split(/\s+/)
  for (const w of words) {
    if (w.includes(term) || term.includes(w)) return true
  }
  return false
}
