import type { FileSuggestionStrategy } from '@promptliano/database'
import type { Prompt } from '@promptliano/database'
import { promptRepository as defaultPromptRepository } from '@promptliano/database'
import { createPromptRelevanceService, type PromptRelevanceScoreResult } from './prompt-relevance-service'
import { createPromptSearchService } from './prompt-search-service'
import {
  buildFuzzyQuery,
  buildVariantQueries,
  extractKeywords,
  clamp01
} from '../suggestions/utils/suggestion-utils'
import { generateStructuredData } from '../gen-ai-services'
import { modelConfigService } from '../model-config-service'
import type { ModelOptionsWithProvider } from '@promptliano/config'
import { nullToUndefined } from '../utils/file-utils'
import { z } from 'zod'

export interface PromptSuggestionResponse {
  suggestions: string[]
  scores?: Array<PromptRelevanceScoreResult & { aiConfidence?: number; aiReasons?: string[] }>
  metadata: {
    totalPrompts: number
    analyzedPrompts: number
    strategy: FileSuggestionStrategy
    processingTime: number
    tokensSaved: number
    aiSelections?: AiRerankSelection[]
  }
  error?: string
}

type RerankStrategy = 'ai-sdk' | 'cohere' | 'contextual' | 'hybrid'

export interface StrategyConfig {
  maxPreFilterItems: number
  maxAIItems: number
  useAI: boolean
  aiModel: 'high' | 'medium'
  compactLevel: 'ultra' | 'compact' | 'standard'
  rerankStrategy?: RerankStrategy
}

const STRATEGIES: Record<FileSuggestionStrategy, StrategyConfig> = {
  fast: { maxPreFilterItems: 30, maxAIItems: 0, useAI: false, aiModel: 'medium', compactLevel: 'ultra', rerankStrategy: 'ai-sdk' },
  balanced: { maxPreFilterItems: 50, maxAIItems: 50, useAI: true, aiModel: 'medium', compactLevel: 'compact', rerankStrategy: 'ai-sdk' },
  thorough: { maxPreFilterItems: 100, maxAIItems: 100, useAI: true, aiModel: 'high', compactLevel: 'standard', rerankStrategy: 'ai-sdk' }
}

interface AiRerankSelection {
  id: string
  confidence: number
  reasons: string[]
}

interface AiRerankOverrides {
  strategy?: RerankStrategy
  topK?: number
  maxCandidates?: number
}

const DEFAULT_RERANK_STRATEGY: RerankStrategy = 'ai-sdk'
const MAX_RERANK_CANDIDATES = 40
const MIN_SELECTIONS = 3

const RERANK_REASON_TAGS = [
  'DirectMatch',
  'PathMatch',
  'API',
  'UI',
  'Auth',
  'Test',
  'Config',
  'Schema',
  'Dependency',
  'Recency'
] as const

const RERANK_REASON_ENUM = z.enum(RERANK_REASON_TAGS)

const PROMPT_RERANK_SCHEMA = z.object({
  selections: z
    .array(
      z.object({
        id: z.string().min(1),
        confidence: z.number().min(0).max(1),
        reasons: z.array(RERANK_REASON_ENUM).min(1).max(3)
      })
    )
    .max(10)
})

const AI_RERANK_SYSTEM_PROMPT =
  'You are a product engineer selecting the most relevant reusable prompts for a coding task. ' +
  'Review each candidate descriptor carefully and return the strongest matches along with confidence scores and succinct reason tags.'

export function createPromptSuggestionStrategyService(deps: {
  repository?: { getByProject: (projectId: number) => Promise<Prompt[]> }
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
    const strategyConfig = STRATEGIES[strategy]
    const prompts = (await repository.getByProject(projectId)) || []

    if (prompts.length === 0) {
      return {
        suggestions: [],
        scores: [],
        metadata: {
          totalPrompts: 0,
          analyzedPrompts: 0,
          strategy,
          processingTime: Date.now() - started,
          tokensSaved: 0,
          aiSelections: []
        }
      }
    }

    const promptMap = new Map(prompts.map((p) => [String(p.id), p]))
    const combinedText = `${userInput || ''} ${userContext || ''}`
    const relevanceScores = await relevance.scorePromptsForText(combinedText, projectId)

    const tokens = extractKeywords(userInput || '')
    let fuzzyResults: Array<{ promptId: string; score: number }> = []

    const fuzzyQuery = buildFuzzyQuery(tokens)
    if (fuzzyQuery) {
      try {
        const { results } = await search.search(projectId, {
          query: fuzzyQuery,
          searchType: 'fuzzy',
          limit: Math.max(maxResults * 10, 50)
        })
        fuzzyResults = results.map((r) => ({ promptId: String(r.prompt.id), score: clamp01(r.score) }))
      } catch {
        // ignore search errors
      }
    }

    const variantQueries = buildVariantQueries(tokens)
    for (const query of variantQueries) {
      try {
        const { results } = await search.search(projectId, {
          query,
          searchType: 'fuzzy',
          limit: Math.max(maxResults * 5, 25)
        })
        for (const r of results) {
          fuzzyResults.push({ promptId: String(r.prompt.id), score: clamp01(r.score) })
        }
      } catch {
        // ignore
      }
    }

    const candidateIds = new Set<string>([
      ...relevanceScores.slice(0, Math.max(strategyConfig.maxPreFilterItems * 4, maxResults * 10)).map((s) => String(s.promptId)),
      ...fuzzyResults.map((f) => f.promptId)
    ])

    const relevanceMap = new Map(relevanceScores.map((s) => [String(s.promptId), s]))
    const fuzzyScoreMap = new Map<string, number>()
    for (const f of fuzzyResults) {
      const previous = fuzzyScoreMap.get(f.promptId) || 0
      if (f.score > previous) fuzzyScoreMap.set(f.promptId, f.score)
    }

    const composite = Array.from(candidateIds)
      .map((id) => {
        const base = relevanceMap.get(id) || createZeroScore(id)
        const fuzzyScore = fuzzyScoreMap.get(id) || 0
        const tagBoost = computeTagBoost(promptMap.get(id)?.tags || [], tokens)
        const contentBoost = computeContentHint(promptMap.get(id), tokens)
        const blended = clamp01(base.totalScore * 0.7 + fuzzyScore * 0.2 + tagBoost * 0.1 + contentBoost * 0.1)
        return {
          promptId: id,
          totalScore: blended,
          titleScore: base.titleScore,
          contentScore: base.contentScore,
          tagScore: base.tagScore,
          recencyScore: base.recencyScore,
          usageScore: base.usageScore
        }
      })
      .sort((a, b) => b.totalScore - a.totalScore)

    if (composite.length === 0) {
      const fallbackIds = fallbackPromptIds(prompts, maxResults)
      const duration = Date.now() - started
      return {
        suggestions: fallbackIds,
        scores: fallbackIds.map((id) => createZeroScore(id)),
        metadata: {
          totalPrompts: prompts.length,
          analyzedPrompts: 0,
          strategy,
          processingTime: duration,
          tokensSaved: 0,
          aiSelections: []
        }
      }
    }

    const compositeMap = new Map(composite.map((entry) => [entry.promptId, entry]))

    let finalIds = composite.slice(0, maxResults).map((c) => c.promptId)
    let aiSelections: AiRerankSelection[] | undefined
    let debugScores: Array<PromptRelevanceScoreResult & { aiConfidence?: number; aiReasons?: string[] }>

    if (strategyConfig.useAI && composite.length > 0) {
      const aiCandidates = composite.slice(0, Math.max(strategyConfig.maxAIItems, maxResults))
      const candidatePrompts = aiCandidates
        .map((entry) => promptMap.get(entry.promptId))
        .filter((p): p is Prompt => Boolean(p))

      if (candidatePrompts.length > 0) {
        const aiResult = await aiRefinePrompts({
          prompts: candidatePrompts,
          scores: aiCandidates.map((entry) => ({
            promptId: entry.promptId,
            totalScore: entry.totalScore,
            titleScore: entry.titleScore,
            contentScore: entry.contentScore,
            tagScore: entry.tagScore,
            recencyScore: entry.recencyScore,
            usageScore: entry.usageScore
          })),
          maxResults,
          config: strategyConfig,
          userInput,
          userContext,
          overrides: undefined,
          keywords: tokens
        })

        if (aiResult.promptIds.length >= MIN_SELECTIONS) {
          finalIds = aiResult.promptIds
          aiSelections = aiResult.selections
        }
      }
    }

    if (!finalIds.length) {
      finalIds = fallbackPromptIds(prompts, maxResults)
      aiSelections = aiSelections ?? []
    }

    const selectionMap = new Map((aiSelections || []).map((selection) => [selection.id, selection]))

    debugScores = finalIds.map((id) => {
      const base = compositeMap.get(id) || createZeroScore(id)
      const selection = selectionMap.get(id)
      return selection
        ? { ...base, aiConfidence: selection.confidence, aiReasons: selection.reasons }
        : base
    })

    if (!debugScores.length) {
      debugScores = finalIds.map((id) => createZeroScore(id))
    }

    const duration = Date.now() - started

    return {
      suggestions: finalIds,
      scores: debugScores,
      metadata: {
        totalPrompts: prompts.length,
        analyzedPrompts: composite.length,
        strategy,
        processingTime: duration,
        tokensSaved: 0,
        aiSelections: aiSelections ?? []
      }
    }
  }

  return { suggestPrompts }
}

async function aiRefinePrompts({
  prompts,
  scores,
  maxResults,
  config,
  userInput,
  userContext,
  overrides,
  keywords
}: {
  prompts: Prompt[]
  scores: PromptRelevanceScoreResult[]
  maxResults: number
  config: StrategyConfig
  userInput: string
  userContext?: string
  overrides?: AiRerankOverrides
  keywords: string[]
}): Promise<{ promptIds: string[]; selections: AiRerankSelection[] }> {
  const deduped = dedupePrompts(prompts)
  const maxCandidates = Math.max(1, overrides?.maxCandidates ?? MAX_RERANK_CANDIDATES)
  const trimmed = deduped.slice(0, maxCandidates)
  if (trimmed.length === 0) {
    return { promptIds: [], selections: [] }
  }

  const scoreMap = new Map(scores.map((s) => [String(s.promptId), s]))
  const descriptors = trimmed
    .map((prompt, index) =>
      buildCandidateDescriptor(prompt, scoreMap.get(String(prompt.id)) ?? createZeroScore(String(prompt.id)), index, config.compactLevel, keywords)
    )
    .filter(Boolean) as string[]

  if (descriptors.length === 0) {
    return { promptIds: trimmed.slice(0, maxResults).map((p) => String(p.id)), selections: [] }
  }

  const strategy = overrides?.strategy ?? config.rerankStrategy ?? DEFAULT_RERANK_STRATEGY
  if (strategy !== 'ai-sdk') {
    console.warn(
      `[PromptSuggestionStrategy] Rerank strategy "${strategy}" not implemented; falling back to ai-sdk listwise reranker.`
    )
  }

  const topK = Math.max(1, Math.min(maxResults, overrides?.topK ?? maxResults, 10))
  const descriptorPromptIds = new Set(trimmed.map((p) => String(p.id)))
  const prompt = buildRerankPrompt({ userInput, userContext, descriptors, topK })

  try {
    const modelOptions = await resolveModelOptions(config.aiModel)
    const result = await generateStructuredData({
      prompt,
      systemMessage: AI_RERANK_SYSTEM_PROMPT,
      schema: PROMPT_RERANK_SCHEMA,
      options: modelOptions
    })

    const selections = (result.object.selections || []).map((selection) => ({
      id: selection.id,
      confidence: selection.confidence,
      reasons: selection.reasons
    }))

    const rankedIds: string[] = []
    const seen = new Set<string>()
    for (const selection of selections) {
      if (!descriptorPromptIds.has(selection.id) || seen.has(selection.id)) continue
      rankedIds.push(selection.id)
      seen.add(selection.id)
      if (rankedIds.length >= maxResults) break
    }

    for (const promptId of trimmed.map((p) => String(p.id))) {
      if (!seen.has(promptId)) {
        rankedIds.push(promptId)
        seen.add(promptId)
      }
      if (rankedIds.length >= maxResults) break
    }

    return { promptIds: rankedIds.slice(0, maxResults), selections }
  } catch (error) {
    console.error('[PromptSuggestionStrategy] AI reranker failed:', error)
    return {
      promptIds: trimmed.slice(0, maxResults).map((p) => String(p.id)),
      selections: []
    }
  }
}

function resolveModelOptions(tier: StrategyConfig['aiModel']): Promise<ModelOptionsWithProvider> {
  return modelConfigService.getPresetConfig(tier === 'high' ? 'high' : 'medium').then((presetConfig) => ({
    provider: presetConfig.provider as ModelOptionsWithProvider['provider'],
    model: presetConfig.model,
    frequencyPenalty: nullToUndefined(presetConfig.frequencyPenalty),
    presencePenalty: nullToUndefined(presetConfig.presencePenalty),
    maxTokens: nullToUndefined(presetConfig.maxTokens),
    temperature: nullToUndefined(presetConfig.temperature),
    topP: nullToUndefined(presetConfig.topP),
    topK: nullToUndefined(presetConfig.topK)
  }))
}

function buildRerankPrompt({
  userInput,
  userContext,
  descriptors,
  topK
}: {
  userInput: string
  userContext?: string
  descriptors: string[]
  topK: number
}): string {
  const lines: string[] = []
  lines.push(`User Request: ${userInput || 'None provided.'}`)
  if (userContext) {
    lines.push(`Additional Context: ${userContext}`)
  }
  lines.push(
    '',
    'Candidate prompts (one per line):',
    '<promptId>|<title>|category:<type>|rank:<n>|score:<0-1>|rec:<0-1>|tags:[...]|hints:[...]',
    ...descriptors,
    '',
    `Choose up to ${topK} prompts that best address the request.`,
    'Evaluation rubric (priority order):',
    '1) Direct alignment to user intent and keywords',
    '2) Coverage of the technical domain (API/UI/Auth/etc.) indicated by context or tags',
    '3) Recency and specificity, prefer newer prompts for bugfixes or active work',
    '4) Diversity across prompt types if multiple are needed',
    `Valid reason tags: ${RERANK_REASON_TAGS.join(', ')}`
  )
  lines.push('Respond strictly with JSON matching selections[{id, confidence, reasons[]}].')
  return lines.join('\n')
}

function buildCandidateDescriptor(
  prompt: Prompt,
  score: PromptRelevanceScoreResult,
  index: number,
  level: StrategyConfig['compactLevel'],
  keywords: string[]
): string {
  const parts: string[] = []
  parts.push(sanitizeDescriptorPart(String(prompt.id)))
  parts.push(sanitizeDescriptorPart(truncate(prompt.title || 'Untitled Prompt', level === 'ultra' ? 68 : 92)))
  parts.push(`category:${inferPromptCategory(prompt)}`)
  parts.push(`rank:${index + 1}`)
  parts.push(`score:${formatScore(score.totalScore)}`)
  parts.push(`rec:${computeRecencySignal(prompt, score)}`)

  const tags = Array.isArray(prompt.tags) ? prompt.tags.map((tag) => sanitizeDescriptorPart(String(tag))).slice(0, 4) : []
  if (tags.length > 0) {
    parts.push(`tags:[${tags.join(',')}]`)
  }

  const hints = derivePromptHints(prompt, keywords, score)
  if (hints.length > 0) {
    parts.push(`hints:[${hints.join(',')}]`)
  }

  if (level === 'standard') {
    parts.push(`title:${formatScore(score.titleScore)}`)
    parts.push(`content:${formatScore(score.contentScore)}`)
  }

  return parts.map(sanitizeDescriptorPart).join('|')
}

function computeRecencySignal(prompt: Prompt, score?: PromptRelevanceScoreResult): string {
  if (typeof score?.recencyScore === 'number') {
    return formatScore(score.recencyScore)
  }
  const updatedAt = prompt.updatedAt || prompt.createdAt
  if (!updatedAt) return '0.50'
  const ageDays = (Date.now() - updatedAt) / (24 * 60 * 60 * 1000)
  if (ageDays <= 1) return '1.00'
  if (ageDays <= 7) return '0.85'
  if (ageDays <= 30) return '0.70'
  if (ageDays <= 90) return '0.55'
  return '0.40'
}

function derivePromptHints(prompt: Prompt, keywords: string[], score?: PromptRelevanceScoreResult): string[] {
  const hints = new Set<string>()
  const lowerTitle = (prompt.title || '').toLowerCase()
  for (const keyword of keywords) {
    if (keyword.length >= 3 && lowerTitle.includes(keyword)) hints.add(`kw:${keyword}`)
  }

  const tags = Array.isArray(prompt.tags) ? prompt.tags.map((tag) => String(tag).toLowerCase()) : []
  if (tags.includes('auth')) hints.add('auth')
  if (tags.includes('api')) hints.add('api')
  if (tags.includes('test') || tags.includes('testing')) hints.add('test')
  if (tags.includes('ui') || tags.includes('frontend')) hints.add('ui')
  if (tags.includes('db') || tags.includes('database')) hints.add('db')
  if (typeof score?.tagScore === 'number' && score.tagScore > 0.5) hints.add('tags')
  if (typeof score?.contentScore === 'number' && score.contentScore > 0.6) hints.add('content')
  return Array.from(hints).slice(0, 3)
}

function inferPromptCategory(prompt: Prompt): string {
  const tags = Array.isArray(prompt.tags) ? prompt.tags.map((tag) => String(tag).toLowerCase()) : []
  if (tags.some((tag) => tag.includes('auth'))) return 'auth'
  if (tags.some((tag) => tag.includes('test'))) return 'test'
  if (tags.some((tag) => tag.includes('api'))) return 'api'
  if (tags.some((tag) => tag.includes('ui') || tag.includes('frontend'))) return 'ui'
  if (tags.some((tag) => tag.includes('docs'))) return 'docs'
  return 'general'
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const head = value.slice(0, Math.floor(maxLength * 0.6))
  const tail = value.slice(-Math.max(0, maxLength - head.length - 3))
  return `${head}...${tail}`
}

function sanitizeDescriptorPart(value: string): string {
  return value.replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatScore(value?: number, decimals = 2): string {
  const num = typeof value === 'number' && isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  return num.toFixed(decimals)
}

function dedupePrompts(prompts: Prompt[]): Prompt[] {
  const seen = new Set<string>()
  const result: Prompt[] = []
  for (const prompt of prompts) {
    const key = String(prompt.id)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(prompt)
  }
  return result
}

function fallbackPromptIds(prompts: Prompt[], maxResults: number): string[] {
  if (!prompts.length) return []
  return prompts
    .slice()
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, Math.max(1, maxResults))
    .map((prompt) => String(prompt.id))
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

function computeContentHint(prompt: Prompt | undefined, tokens: string[]): number {
  if (!prompt || !tokens.length) return 0
  const content = (prompt.content || '').toLowerCase()
  let hits = 0
  for (const t of tokens) {
    if (content.includes(t)) {
      hits += 1
      continue
    }
    const words = content.split(/\s+/)
    for (const word of words) {
      if (!word) continue
      const shorter = word.slice(0, Math.max(3, Math.ceil(word.length * 0.7)))
      if (shorter && t.startsWith(shorter)) {
        hits += 0.3
        break
      }
    }
  }
  return clamp01(hits / tokens.length)
}

