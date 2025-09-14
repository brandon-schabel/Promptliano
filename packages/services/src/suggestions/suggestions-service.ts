import type { FileSuggestionStrategy } from '@promptliano/database'
import { createFileRelevanceService } from '../file-services/file-relevance-service'
import { createFileSuggestionStrategyService } from '../file-services/file-suggestion-strategy-service'
import { getProjectFiles } from '../project-service'
import { createFileSearchService } from '../file-services/file-search-service'
import { getTicketById } from '../ticket-service'
import { suggestPrompts as coreSuggestPrompts } from '../prompt-service'

export interface SuggestFilesForProjectOptions {
  strategy?: FileSuggestionStrategy
  maxResults?: number
  includeScores?: boolean
  userContext?: string
}

export interface SuggestFilesResult {
  suggestions: string[]
  scores?: Array<{
    fileId: string
    totalScore: number
    keywordScore: number
    pathScore: number
    typeScore: number
    recencyScore: number
    importScore: number
  }>
  metadata: {
    totalFiles: number
    analyzedFiles: number
    strategy: FileSuggestionStrategy
    processingTime: number
    tokensSaved?: number
  }
  error?: string
}

export interface SuggestionsServiceDeps {}

export function createSuggestionsService(_deps: SuggestionsServiceDeps = {}) {
  const relevanceService = createFileRelevanceService()
  const strategyService = createFileSuggestionStrategyService()

  async function suggestFilesForProject(
    projectId: number,
    userInput: string,
    options: SuggestFilesForProjectOptions = {}
  ): Promise<SuggestFilesResult> {
    const start = Date.now()
    const strategy: FileSuggestionStrategy = options.strategy || 'balanced'
    const maxResults = options.maxResults ?? 10

    // Get all files once for path-based heuristics and ID mapping
    const allFiles = (await getProjectFiles(projectId)) || []
    const byId = new Map(allFiles.map((f: any) => [String(f.id), f]))

    // 1) Relevance scoring (uses content + path and metadata)
    const relevanceScores = await relevanceService.scoreFilesForText(userInput || '', projectId)
    const relMap = new Map(relevanceScores.map((s) => [String(s.fileId), s]))

    // 2) Path-oriented fuzzy search to catch obvious route/feature files
    const search = createFileSearchService()
    const tokens = extractKeywords(userInput || '')
    const fuzzyQuery = buildFuzzyQuery(tokens)

    let fuzzyResults: Array<{ fileId: string; score: number }> = []
    if (fuzzyQuery) {
      try {
        const { results } = await search.search(projectId, {
          query: fuzzyQuery,
          searchType: 'fuzzy',
          limit: Math.max(maxResults * 10, 50)
        })
        fuzzyResults = results.map((r) => ({ fileId: String((r.file as any).id), score: clamp01(r.score) }))
      } catch {}
    }

    // 3) Add explicit phrase variants that often matter in code (e.g., suggest-files)
    const variantQueries = buildVariantQueries(tokens)
    for (const q of variantQueries) {
      try {
        const { results } = await search.search(projectId, {
          query: q,
          searchType: 'fuzzy',
          limit: Math.max(maxResults * 5, 25)
        })
        for (const r of results) {
          fuzzyResults.push({ fileId: String((r.file as any).id), score: clamp01(r.score) })
        }
      } catch {}
    }

    // 4) Union candidates from relevance and fuzzy
    const candidateIds = new Set<string>([
      ...relevanceScores.slice(0, Math.max(200, maxResults * 10)).map((s) => String(s.fileId)),
      ...fuzzyResults.map((f) => f.fileId)
    ])

    // Build a quick index for fuzzy scores
    const fuzzyMap = new Map<string, number>()
    for (const f of fuzzyResults) {
      const prev = fuzzyMap.get(f.fileId) || 0
      if (f.score > prev) fuzzyMap.set(f.fileId, f.score)
    }

    // 5) Re-rank with simple, understandable heuristics
    const queryHints = new Set(tokens)
    let composite = Array.from(candidateIds)
      .map((id) => {
        const base = relMap.get(id) || createZeroScore(id)
        const file = byId.get(id)
        const fuzzy = fuzzyMap.get(id) || 0
        const pathBoost = scorePathTokens(file?.path || '', tokens)
        const penalty = computePenalties(file?.path || '', queryHints)
        const codeBoost = codeLocationBoost(file?.path || '', tokens)

        // Adjusted blend: more weight to relevance, more to path signals, slightly lower fuzzy; stronger penalty
        const blended = clamp01(0.6 * base.totalScore + 0.2 * fuzzy + 0.2 * pathBoost + 0.1 * codeBoost - 1.25 * penalty)

        // Map back to the standard score shape
        const mapped = {
          fileId: id,
          totalScore: blended,
          keywordScore: base.keywordScore,
          pathScore: Math.max(base.pathScore, (fuzzy + pathBoost) / 2),
          typeScore: Math.max(0, base.typeScore - penalty * 0.5),
          recencyScore: base.recencyScore,
          importScore: base.importScore
        }

        return mapped
      })
      .sort((a, b) => b.totalScore - a.totalScore)

    // AI-assisted reranker for project-level (no flag): apply when strategy != 'fast' and candidates > maxResults
    if ((options.strategy ?? 'balanced') !== 'fast' && composite.length > maxResults) {
      try {
        const strategySvc = createFileSuggestionStrategyService()
        const topForAi = composite.slice(0, Math.max(50, maxResults * 5))
        const candidateFiles = topForAi
          .map((c) => byId.get(String(c.fileId)))
          .filter(Boolean) as any[]
        if (candidateFiles.length > 0) {
          const fauxTicket = {
            id: -1,
            projectId,
            title: userInput || '',
            overview: options.userContext || ''
          } as any
          const aiIds = await (strategySvc as any).aiRefineSuggestions(
            fauxTicket,
            candidateFiles,
            maxResults,
            { maxPreFilterFiles: 50, maxAIFiles: 50, useAI: true, aiModel: 'medium', compactLevel: 'compact' },
            options.userContext
          )
          if (Array.isArray(aiIds) && aiIds.length) {
            const aiTop = aiIds
              .map((id) => composite.find((c) => String(c.fileId) === String(id)))
              .filter(Boolean) as typeof composite
            const aiSet = new Set(aiIds.map(String))
            const rest = composite.filter((c) => !aiSet.has(String(c.fileId)))
            composite = [...aiTop, ...rest]
          }
        }
      } catch {}
    }

    const top = composite.slice(0, maxResults)
    const suggestions = top.map((s) => s.fileId)

    return {
      suggestions,
      scores: options.includeScores ? top : undefined,
      metadata: {
        totalFiles: allFiles.length,
        analyzedFiles: composite.length,
        strategy,
        processingTime: Date.now() - start,
        tokensSaved: 0
      }
    }
  }

  async function suggestFilesForTicket(
    ticketId: number,
    options: { strategy?: FileSuggestionStrategy; maxResults?: number; userContext?: string } = {}
  ): Promise<SuggestFilesResult> {
    const start = Date.now()
    const strategy: FileSuggestionStrategy = options.strategy || 'balanced'
    const maxResults = options.maxResults ?? 10

    const ticket = await getTicketById(ticketId)
    const result = await strategyService.suggestFiles(ticket as any, strategy, maxResults, options.userContext)

    return {
      suggestions: (result.suggestions || []).map(String),
      scores: result.scores as any,
      metadata: {
        totalFiles: result.metadata.totalFiles,
        analyzedFiles: result.metadata.analyzedFiles,
        strategy: result.metadata.strategy,
        processingTime: result.metadata.processingTime,
        tokensSaved: result.metadata.tokensSaved
      }
    }
  }

  async function suggestPromptsForProject(projectId: number, userInput: string, limit?: number) {
    // Delegate to existing prompt service for now (2-arg signature)
    const suggestions = await coreSuggestPrompts(projectId, userInput)
    return typeof limit === 'number' ? (suggestions as any[]).slice(0, limit) : suggestions
  }

  return {
    suggestFilesForProject,
    suggestFilesForTicket,
    suggestPromptsForProject
  }
}

export type SuggestionsService = ReturnType<typeof createSuggestionsService>

export const suggestionsService = createSuggestionsService()

export const { suggestFilesForProject, suggestFilesForTicket, suggestPromptsForProject } = suggestionsService

// ---------- Local helpers (scoped to project-level suggestions) ----------

function clamp01(n: number): number {
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function extractKeywords(text: string): string[] {
  // Basic normalization
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const stop = new Set([
    'the',
    'is',
    'at',
    'which',
    'on',
    'and',
    'a',
    'an',
    'as',
    'are',
    'was',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'to',
    'of',
    'in',
    'for',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    // extra conversational filler / vague intent words
    'please',
    'help',
    'me',
    'find',
    'show',
    'provide',
    'some',
    'list',
    'improvement',
    'improvements',
    // soft stopword for generic prompts; may be re-added conditionally
    'file',
    'files'
  ])

  // lightweight typo normalization
  const typos: Record<string, string> = { improvments: 'improvements' }

  let tokens = cleaned
    .split(/\s+/)
    .map((t) => typos[t] || t.trim())
    .filter((t) => t.length > 1 && !stop.has(t))

  // Deduplicate and keep order
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const t of tokens) {
    if (!seen.has(t)) {
      ordered.push(t)
      seen.add(t)
    }
  }
  // Re-add 'file/files' only when paired with suggest|search|manager to avoid generic noise
  const allowFileToken = ordered.some((t) => ['suggest', 'suggestion', 'search', 'manager'].includes(t))
  if (allowFileToken) {
    const originalWords = cleaned.split(/\s+/)
    if (originalWords.some((w) => w === 'file' || w === 'files')) {
      if (!seen.has('file')) ordered.push('file')
      if (!seen.has('files')) ordered.push('files')
    }
  }
  return ordered.slice(0, 12)
}

function buildFuzzyQuery(tokens: string[]): string {
  if (tokens.length === 0) return ''
  // Keep it short so Levenshtein stays meaningful
  const key = tokens.slice(0, 3).join(' ')
  return key
}

function buildVariantQueries(tokens: string[]): string[] {
  const joined = tokens.join(' ')
  const variants = new Set<string>()

  // Common phrase collapses
  const hasSuggest = tokens.includes('suggest') || tokens.includes('suggestion') || tokens.includes('suggestions')
  const hasFiles = tokens.includes('file') || tokens.includes('files')

  if (/suggest\s+files?/.test(joined) || (hasSuggest && hasFiles)) {
    variants.add('suggest-files')
    variants.add('suggest_files')
    variants.add('suggestions')
    variants.add('file-suggestion')
    variants.add('suggestion-service')
    variants.add('suggestFiles')
  }
  if (/file\s+suggest(ion|ions)?/.test(joined)) {
    variants.add('file-suggestions')
  }

  // When users say feature/route/api, boost those too
  if (tokens.includes('feature') || tokens.includes('route') || tokens.includes('api')) {
    variants.add('route')
    variants.add('routes')
    variants.add('api')
    variants.add('server')
    variants.add('service')
  }

  return Array.from(variants)
}

function scorePathTokens(path: string, tokens: string[]): number {
  if (!path) return 0
  const parts = path.toLowerCase().split(/[\\/._-]+/)
  if (parts.length === 0 || tokens.length === 0) return 0
  let hits = 0
  for (const t of tokens) {
    if (!t) continue
    for (const p of parts) {
      if (p === t) {
        hits += 1
        break
      }
      if (p.includes(t) || t.includes(p)) {
        hits += 0.5
        break
      }
      // Special boost for suggest-related tokens
      if ((t === 'suggest' || t === 'suggestion') && p.includes('suggest')) {
        hits += 1
        break
      }
    }
  }
  return clamp01(hits / tokens.length)
}

function computePenalties(path: string, queryHints: Set<string>): number {
  const p = path.toLowerCase()
  let penalty = 0

  const isTest = /(^|[\\/])__tests__([\\/]|$)|\.test\.|\.spec\.|(^|[\\/])e2e([\\/]|$)/.test(p)
  const isSqlOrMigration = p.endsWith('.sql') || /(^|[\\/])migrations?([\\/]|$)/.test(p)
  const isDocs = /(^|[\\/])docs?([\\/]|$)|\.mdx?$/.test(p)

  if (isTest && !hasAny(queryHints, ['test', 'tests', 'spec', 'e2e'])) penalty += 0.4
  if (isSqlOrMigration && !hasAny(queryHints, ['db', 'sql', 'migration', 'database'])) penalty += 0.35
  if (isDocs && !hasAny(queryHints, ['doc', 'docs', 'readme'])) penalty += 0.2

  const codeIntent = hasAny(queryHints, [
    'feature',
    'route',
    'routes',
    'api',
    'service',
    'server',
    'tool',
    'tools',
    'mcp',
    'hook',
    'hooks',
    'suggest'
  ])
  if (codeIntent) {
    if (isSqlOrMigration) penalty += 0.2
    if (isDocs) penalty += 0.1
  }

  return penalty
}

function hasAny(set: Set<string>, terms: string[]): boolean {
  for (const t of terms) if (set.has(t)) return true
  return false
}

function createZeroScore(fileId: string) {
  return {
    fileId,
    totalScore: 0,
    keywordScore: 0,
    pathScore: 0,
    typeScore: 0,
    recencyScore: 0,
    importScore: 0
  }
}

// Prefer key code locations for feature-like queries
function codeLocationBoost(path: string, tokens: string[]): number {
  if (!path) return 0
  const p = path.toLowerCase()
  const codeIntent = tokens.some((t) =>
    ['feature', 'route', 'routes', 'api', 'service', 'server', 'tools', 'tool', 'mcp', 'hook', 'hooks', 'suggest'].includes(
      t
    )
  )
  if (!codeIntent) return 0

  const matches = [
    '/routes/',
    '/services/',
    '/mcp/',
    '/tools/',
    '/hooks/',
    '/suggestions/'
  ].some((seg) => p.includes(seg))

  return matches ? 1 : 0
}
