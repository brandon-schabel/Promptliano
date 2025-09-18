import type { FileSuggestionStrategy } from '@promptliano/database'
import { createFileRelevanceService, type RelevanceScoreResult } from '../file-services/file-relevance-service'
import { createFileSuggestionStrategyService } from '../file-services/file-suggestion-strategy-service'
import { createPromptSuggestionStrategyService } from '../prompt-services/prompt-suggestion-strategy-service'
import { getProjectFiles } from '../project-service'
import { createFileSearchService } from '../file-services/file-search-service'
import { getTicketById } from '../ticket-service'

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
    aiConfidence?: number
    aiReasons?: string[]
  }>
  metadata: {
    totalFiles: number
    analyzedFiles: number
    strategy: FileSuggestionStrategy
    processingTime: number
    tokensSaved?: number
    aiSelections?: Array<{ id: string; confidence: number; reasons: string[] }>
  }
  error?: string
}

export interface SuggestionsServiceDeps {}

type CompositeScore = {
  fileId: string
  totalScore: number
  keywordScore: number
  pathScore: number
  typeScore: number
  recencyScore: number
  importScore: number
}

export function createSuggestionsService(_deps: SuggestionsServiceDeps = {}) {
  const relevanceService = createFileRelevanceService()
  const strategyService = createFileSuggestionStrategyService()
  const promptStrategyService = createPromptSuggestionStrategyService()

  async function suggestFilesForProject(
    projectId: number,
    userInput: string,
    options: SuggestFilesForProjectOptions = {}
  ): Promise<SuggestFilesResult> {
    const start = Date.now()
    const strategy: FileSuggestionStrategy = options.strategy || 'balanced'
    const maxResults = options.maxResults ?? 10
    const debugFlag = (() => {
      const raw = process.env.DEBUG_SUGGEST_FILES
      if (!raw) return false
      const normalized = raw.toLowerCase()
      return normalized === '1' || normalized === 'true' || normalized === 'yes'
    })()
    const trace: Record<string, number> = {}

    // Get all files once for path-based heuristics and ID mapping
    const allFiles = (await getProjectFiles(projectId)) || []
    const byId = new Map(allFiles.map((f: any) => [String(f.id), f]))

    // 1) Relevance scoring (uses content + path and metadata)
    const relevanceScores = await relevanceService.scoreFilesForText(userInput || '', projectId)
    trace.relevanceCandidates = relevanceScores.length
    const relMap = new Map(relevanceScores.map((score) => [String(score.fileId), score]))

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

    trace.fuzzyMatches = fuzzyResults.length

    // 4) Union candidates from relevance and fuzzy
    const candidateIds = new Set<string>([
      ...relevanceScores.slice(0, Math.max(200, maxResults * 10)).map((s) => String(s.fileId)),
      ...fuzzyResults.map((f) => f.fileId)
    ])
    trace.candidateSet = candidateIds.size

    // Build a quick index for fuzzy scores
    const fuzzyMap = new Map<string, number>()
    for (const f of fuzzyResults) {
      const prev = fuzzyMap.get(f.fileId) || 0
      if (f.score > prev) fuzzyMap.set(f.fileId, f.score)
    }

    // 5) Re-rank with simple, understandable heuristics
    const queryHints = new Set(tokens)
    const preparedComposite = Array.from(candidateIds)
      .map<CompositeScore | null>((id) => {
        const file = byId.get(id)
        if (!file || shouldIgnoreFilePath(file.path)) {
          return null
        }

        if (shouldSuppressFileForQuery(file.path || '', tokens)) {
          return null
        }

        const base = relMap.get(id) || createZeroScore(id)
        const fuzzy = fuzzyMap.get(id) || 0
        const pathBoost = scorePathTokens(file.path || '', tokens)
        const penalty = computePenalties(file.path || '', queryHints)
        const codeBoost = codeLocationBoost(file.path || '', tokens)
        const domainBoost = domainSpecificBoost(file.path || '', tokens)

        const blended = clamp01(
          0.55 * base.totalScore + 0.15 * fuzzy + 0.2 * pathBoost + 0.15 * codeBoost + domainBoost - 1.1 * penalty
        )

        return {
          fileId: id,
          totalScore: blended,
          keywordScore: base.keywordScore,
          pathScore: Math.max(base.pathScore, (fuzzy + pathBoost) / 2),
          typeScore: Math.max(0, base.typeScore - penalty * 0.4),
          recencyScore: base.recencyScore,
          importScore: base.importScore
        }
      })
      .filter(isCompositeScore)
    let composite: CompositeScore[] = preparedComposite.sort((a, b) => b.totalScore - a.totalScore)
    trace.filteredCandidates = composite.length

    // AI-assisted reranker for project-level (no flag): apply when strategy != 'fast' and candidates > maxResults
    if ((options.strategy ?? 'balanced') !== 'fast' && composite.length > maxResults) {
      try {
        const topForAi = composite.slice(0, Math.max(50, maxResults * 5))
        const idToComposite = new Map(topForAi.map((entry) => [String(entry.fileId), entry]))
        const candidateFiles = topForAi.map((c) => byId.get(String(c.fileId))).filter(Boolean) as any[]

        if (candidateFiles.length > 0) {
          const aiScoreInputs: RelevanceScoreResult[] = candidateFiles.map((file: any) => {
            const entry = idToComposite.get(String(file.id))
            return {
              fileId: String(file.id),
              totalScore: entry?.totalScore ?? 0.5,
              keywordScore: entry?.keywordScore ?? 0,
              pathScore: entry?.pathScore ?? 0,
              typeScore: entry?.typeScore ?? 0,
              recencyScore: entry?.recencyScore ?? 0,
              importScore: entry?.importScore ?? 0
            }
          })

          if (aiScoreInputs.length > 0) {
            const fauxTicket = {
              id: -1,
              projectId,
              title: userInput || '',
              overview: options.userContext || ''
            } as any

            const aiResult = await (strategyService as any).aiRefineSuggestions(
              fauxTicket,
              candidateFiles,
              aiScoreInputs,
              maxResults,
              {
                maxPreFilterFiles: 50,
                maxAIFiles: 50,
                useAI: true,
                aiModel: 'medium',
                compactLevel: 'compact',
                rerankStrategy: 'ai-sdk'
              },
              options.userContext
            )

            const aiIds = Array.isArray(aiResult?.fileIds) ? aiResult.fileIds : []
            if (aiIds.length) {
              const aiTop = aiIds
                .map((id: string) => composite.find((c) => String(c.fileId) === String(id)))
                .filter(Boolean) as typeof composite
              const aiSet = new Set(aiIds.map((id: string) => String(id)))
              const rest = composite.filter((c) => !aiSet.has(String(c.fileId)))
              composite = [...aiTop, ...rest]
              trace.aiRerank = aiIds.length
              trace.aiSelections = (aiResult?.selections || []).length
            }
          }
        }
      } catch {}
    }

    const top = composite.slice(0, maxResults)
    const suggestions = top.map((s) => s.fileId)
    const duration = Date.now() - start

    trace.returned = suggestions.length

    if (debugFlag) {
      console.debug('[SuggestionsService] suggestFilesForProject', {
        projectId,
        strategy,
        maxResults,
        promptPreview: (userInput || '').slice(0, 120),
        metrics: trace,
        duration
      })
    }

    return {
      suggestions,
      scores: options.includeScores ? top : undefined,
      metadata: {
        totalFiles: allFiles.length,
        analyzedFiles: composite.length,
        strategy,
        processingTime: duration,
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

  async function suggestPromptsForProject(
    projectId: number,
    userInput: string,
    options: {
      strategy?: FileSuggestionStrategy
      maxResults?: number
      includeScores?: boolean
      userContext?: string
    } = {}
  ): Promise<{
    suggestions: string[]
    scores?: Array<{
      promptId: string
      totalScore: number
      titleScore: number
      contentScore: number
      tagScore: number
      recencyScore: number
      usageScore: number
      aiConfidence?: number
      aiReasons?: string[]
    }>
    metadata: {
      totalPrompts: number
      analyzedPrompts: number
      strategy: FileSuggestionStrategy
      processingTime: number
      tokensSaved: number
      aiSelections?: Array<{ id: string; confidence: number; reasons: string[] }>
    }
  }> {
    const strategy = options.strategy ?? 'balanced'
    const maxResults = options.maxResults ?? 10
    const result = await promptStrategyService.suggestPrompts(
      projectId,
      userInput,
      strategy,
      maxResults,
      options.userContext
    )

    return {
      suggestions: result.suggestions,
      scores: options.includeScores ? (result.scores as any) : undefined,
      metadata: {
        totalPrompts: result.metadata.totalPrompts,
        analyzedPrompts: result.metadata.analyzedPrompts,
        strategy: result.metadata.strategy,
        processingTime: result.metadata.processingTime,
        tokensSaved: result.metadata.tokensSaved,
        aiSelections: result.metadata.aiSelections ?? []
      }
    }
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

// ---------- File suggestions helpers (existing) ----------

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
  return ordered.slice(0, 15)
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

  if (tokens.includes('mcp')) {
    variants.add('mcp')
    variants.add('mcp tools')
    variants.add('mcp transport')
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

      const partialScore = partialTokenOverlapScore(p, t)
      if (partialScore > 0) {
        hits += partialScore
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

  const isGithubWorkflow = p.startsWith('.github/workflows/') || p.includes('/.github/workflows/')
  if (isGithubWorkflow && !hasAny(queryHints, ['workflow', 'ci', 'deploy', 'release', 'action', 'github'])) {
    penalty += 0.45
  }

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

function createZeroScore(fileId: string): CompositeScore {
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

function isCompositeScore(entry: CompositeScore | null): entry is CompositeScore {
  return entry !== null
}

function shouldIgnoreFilePath(path: string): boolean {
  if (!path) return false
  const normalized = path.toLowerCase()
  if (normalized.includes('/node_modules/') || normalized.startsWith('node_modules/')) return true
  if (normalized.startsWith('.claude/') || normalized.includes('/.claude/')) return true
  if (normalized.startsWith('.cursor/') || normalized.includes('/.cursor/')) return true
  if (normalized.startsWith('dist/') || normalized.includes('/dist/')) return true
  if (normalized.startsWith('build/') || normalized.includes('/build/')) return true
  if (normalized.includes('/coverage/')) return true
  if (normalized.endsWith('.log') || normalized.endsWith('.tmp')) return true
  return false
}

function shouldSuppressFileForQuery(path: string, tokens: string[]): boolean {
  if (!path) return false
  const normalized = path.toLowerCase()
  const tokenSet = new Set(tokens)

  const suppressGithubWorkflows =
    (normalized.startsWith('.github/workflows/') || normalized.includes('/.github/workflows/')) &&
    !hasAny(tokenSet, ['workflow', 'ci', 'deploy', 'release', 'action', 'github'])

  return suppressGithubWorkflows
}

function domainSpecificBoost(path: string, tokens: string[]): number {
  if (!path || tokens.length === 0) return 0
  const normalized = path.toLowerCase()
  const set = new Set(tokens)
  let boost = 0

  if (set.has('mcp') || set.has('provider')) {
    if (normalized.includes('/mcp/') || normalized.includes('mcp-')) {
      boost += 0.25
    }
  }

  if (set.has('prompt') || set.has('prompts')) {
    if (normalized.includes('/prompt') || normalized.includes('prompt-')) {
      boost += 0.15
    }
  }

  if ((set.has('workflow') || set.has('flow')) && normalized.includes('workflow')) {
    boost += 0.1
  }

  if (set.has('simplify') && normalized.includes('simpl')) {
    boost += 0.1
  }

  return Math.min(0.35, boost)
}

// Prefer key code locations for feature-like queries
function codeLocationBoost(path: string, tokens: string[]): number {
  if (!path) return 0
  const p = path.toLowerCase()
  const codeIntent = tokens.some((t) =>
    [
      'feature',
      'route',
      'routes',
      'api',
      'service',
      'server',
      'tools',
      'tool',
      'mcp',
      'hook',
      'hooks',
      'suggest'
    ].includes(t)
  )
  if (!codeIntent) return 0

  const matches = ['/routes/', '/services/', '/mcp/', '/tools/', '/hooks/', '/suggestions/'].some((seg) =>
    p.includes(seg)
  )

  return matches ? 1 : 0
}

function partialTokenOverlapScore(part: string, token: string): number {
  if (!part || !token) return 0
  if (part === token) return 1

  const lowerPart = part.toLowerCase()
  const lowerToken = token.toLowerCase()
  let ratio = 0

  if (lowerPart.includes(lowerToken)) {
    ratio = lowerToken.length / lowerPart.length
  } else if (lowerToken.includes(lowerPart)) {
    ratio = lowerPart.length / lowerToken.length
  } else {
    return 0
  }

  if (ratio >= 0.9) return 0.8
  if (ratio >= 0.6) return 0.4
  if (ratio >= 0.4) return 0.2
  return 0
}
