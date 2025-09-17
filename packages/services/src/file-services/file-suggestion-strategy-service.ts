import type { Ticket, File, FileSuggestionStrategy, RelevanceConfig } from '@promptliano/database'
import { createFileRelevanceService, type RelevanceScoreResult } from './file-relevance-service'
import { generateStructuredData } from '../gen-ai-services'
import { modelConfigService } from '../model-config-service'
import type { ModelOptionsWithProvider } from '@promptliano/config'
import { nullToUndefined } from '../utils/file-utils'
import { z } from 'zod'
import { getProjectFiles } from '../project-service'
import { createFileService, createFileCache, type FileServiceConfig } from './file-service-factory'

export interface FileSuggestionResponse {
  suggestions: string[] // File IDs
  scores?: Array<RelevanceScoreResult & { aiConfidence?: number; aiReasons?: string[] }>
  metadata: {
    totalFiles: number
    analyzedFiles: number
    strategy: FileSuggestionStrategy
    processingTime: number
    tokensSaved: number
    aiSelections?: AiRerankSelection[]
  }
  error?: string
}

type RerankStrategy = 'ai-sdk' | 'cohere' | 'contextual' | 'hybrid'

export interface StrategyConfig {
  maxPreFilterFiles: number
  maxAIFiles: number
  useAI: boolean
  aiModel: 'high' | 'medium'
  compactLevel: 'ultra' | 'compact' | 'standard'
  rerankStrategy?: RerankStrategy
}

export interface FileSuggestionServiceDeps {
  relevanceService?: ReturnType<typeof createFileRelevanceService>
  config?: FileServiceConfig
  cache?: ReturnType<typeof createFileCache>
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

const FILE_RERANK_SCHEMA = z.object({
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
  'You are a senior engineer helping choose the most relevant repository files for a ticket. ' +
  'Study the structured descriptors, prioritise true matches, and return the best candidates with confidences and reason tags.'

const STRATEGY_CONFIGS: Record<FileSuggestionStrategy, StrategyConfig> = {
  fast: {
    maxPreFilterFiles: 30,
    maxAIFiles: 0,
    useAI: false,
    aiModel: 'medium',
    compactLevel: 'ultra',
    rerankStrategy: DEFAULT_RERANK_STRATEGY
  },
  balanced: {
    maxPreFilterFiles: 50,
    maxAIFiles: 50,
    useAI: true,
    aiModel: 'medium',
    compactLevel: 'compact',
    rerankStrategy: DEFAULT_RERANK_STRATEGY
  },
  thorough: {
    maxPreFilterFiles: 100,
    maxAIFiles: 100,
    useAI: true,
    aiModel: 'high',
    compactLevel: 'standard',
    rerankStrategy: DEFAULT_RERANK_STRATEGY
  }
}

async function resolveModelOptions(tier: StrategyConfig['aiModel']): Promise<ModelOptionsWithProvider> {
  const presetConfig = await modelConfigService.getPresetConfig(tier === 'high' ? 'high' : 'medium')
  return {
    provider: presetConfig.provider as ModelOptionsWithProvider['provider'],
    model: presetConfig.model,
    frequencyPenalty: nullToUndefined(presetConfig.frequencyPenalty),
    presencePenalty: nullToUndefined(presetConfig.presencePenalty),
    maxTokens: nullToUndefined(presetConfig.maxTokens),
    temperature: nullToUndefined(presetConfig.temperature),
    topP: nullToUndefined(presetConfig.topP),
    topK: nullToUndefined(presetConfig.topK)
  }
}

function buildRerankPrompt({
  ticket,
  userContext,
  descriptors,
  topK
}: {
  ticket: Ticket
  userContext?: string
  descriptors: string[]
  topK: number
}): string {
  const lines: string[] = [
    `Ticket: ${ticket.title}`,
    `Overview: ${ticket.overview?.trim() || 'No overview provided.'}`
  ]
  if (userContext) {
    lines.push(`Context: ${userContext}`)
  }
  lines.push(
    '',
    'Candidates (one per file):',
    '<fileId>|<path>|<category>|rank:<n>|score:<0-1>|rec:<0-1>|exp:[sym...]|imp:[module:sym...]|hints:[signal]',
    ...descriptors,
    '',
    `Select up to ${topK} files most relevant to the ticket.`,
    'Ranking rubric (descending priority):',
    '1) Direct references to ticket keywords or feature names',
    '2) Domain alignment (UI/API/Test/Config/etc.)',
    '3) Dependency proximity and importance signals',
    '4) Recency when the task implies active work or bug fixes',
    `Valid reasons: ${RERANK_REASON_TAGS.join(', ')}.`
  )
  lines.push('Return JSON that follows selections[{id, confidence, reasons[]}] (no extra text).')
  return lines.join('\n')
}

function buildCandidateDescriptor(
  file: File,
  score: RelevanceScoreResult,
  index: number,
  level: StrategyConfig['compactLevel'],
  keywords: string[]
): string {
  const parts: string[] = []
  parts.push(sanitizeDescriptorPart(file.id))
  parts.push(sanitizeDescriptorPart(truncateForDescriptor(file.path, level === 'ultra' ? 72 : 96)))
  parts.push(inferFileDomain(file))
  parts.push(`rank:${index + 1}`)
  parts.push(`score:${formatScore(score.totalScore, 2, 0.35)}`)
  parts.push(`rec:${computeRecencySignal(score, file)}`)

  const exportLimit = level === 'standard' ? 3 : 2
  const importLimit = level === 'standard' ? 3 : 2
  const exportsList = extractTopExports(file, exportLimit)
  const importsList = extractTopImports(file, importLimit)
  const hints = deriveSignalHints(file, keywords, score)

  if (level !== 'ultra' && exportsList.length > 0) {
    parts.push(`exp:[${exportsList.join(',')}]`)
  }
  if (level !== 'ultra' && importsList.length > 0) {
    parts.push(`imp:[${importsList.join(',')}]`)
  }
  if (level === 'standard') {
    parts.push(`kw:${formatScore(score.keywordScore)}`)
    parts.push(`path:${formatScore(score.pathScore)}`)
  }
  if (hints.length > 0) {
    parts.push(`hints:[${hints.join(',')}]`)
  }

  return parts.map(sanitizeDescriptorPart).join('|')
}

function extractTopExports(file: File, limit: number): string[] {
  const result: string[] = []
  if (!file.exports) return result
  for (const exp of file.exports) {
    if (result.length >= limit) break
    if (exp.specifiers && exp.specifiers.length > 0) {
      for (const spec of exp.specifiers) {
        if (result.length >= limit) break
        const name = spec.exported || spec.local
        if (name) {
          result.push(cleanSymbolName(name))
        }
      }
    } else if (exp.type === 'default') {
      result.push('default')
    } else if (exp.type === 'all') {
      result.push('*')
    }
  }
  return result
}

function extractTopImports(file: File, limit: number): string[] {
  const result: string[] = []
  if (!file.imports) return result
  for (const imp of file.imports) {
    if (result.length >= limit) break
    const sourceHint = sanitizeDescriptorPart(imp.source.split('/').pop() || imp.source)
    if (imp.specifiers && imp.specifiers.length > 0) {
      for (const spec of imp.specifiers) {
        if (result.length >= limit) break
        const local = spec.local || spec.imported
        if (local) {
          result.push(`${sourceHint}:${cleanSymbolName(local)}`)
        }
      }
    } else {
      result.push(sourceHint)
    }
  }
  return result
}

function cleanSymbolName(value: string): string {
  return sanitizeDescriptorPart(value.replace(/[{}()*]/g, '')).slice(0, 24)
}

function truncateForDescriptor(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const headLength = Math.max(0, Math.floor(maxLength * 0.6))
  const tailLength = Math.max(0, maxLength - headLength - 3)
  const head = value.slice(0, headLength)
  const tail = tailLength > 0 ? value.slice(-tailLength) : ''
  return `${head}...${tail}`
}

function sanitizeDescriptorPart(value: string): string {
  return value.replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatScore(value?: number, decimals = 2, fallback = 0): string {
  const num = typeof value === 'number' && isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback
  return num.toFixed(decimals)
}

function computeRecencySignal(score: RelevanceScoreResult | undefined, file: File): string {
  if (typeof score?.recencyScore === 'number') {
    return formatScore(score.recencyScore, 2, 0.5)
  }
  if (!file.updatedAt) return '0.50'
  const ageDays = (Date.now() - file.updatedAt) / (24 * 60 * 60 * 1000)
  if (ageDays <= 1) return '1.00'
  if (ageDays <= 7) return '0.85'
  if (ageDays <= 30) return '0.70'
  if (ageDays <= 90) return '0.50'
  return '0.30'
}

function inferFileDomain(file: File): string {
  const path = file.path.toLowerCase()
  if (/[\\/](tests?|__tests__|e2e)[\\/]/.test(path) || path.includes('.test.') || path.includes('.spec.')) return 'test'
  if (path.includes('/routes/') || path.includes('/api/') || path.includes('/server/')) return 'api'
  if (path.includes('/components/') || path.endsWith('.tsx') || path.endsWith('.jsx')) return 'ui'
  if (path.includes('/hooks/')) return 'hook'
  if (path.includes('/services/') || path.includes('service')) return 'service'
  if (path.includes('/schemas/') || path.includes('schema')) return 'schema'
  if (path.includes('config') || path.endsWith('.json')) return 'config'
  if (path.includes('/docs/') || path.endsWith('.md') || path.endsWith('.mdx')) return 'doc'
  return 'code'
}

function deriveSignalHints(file: File, keywords: string[], score?: RelevanceScoreResult): string[] {
  const hints: string[] = []
  const lowerPath = file.path.toLowerCase()
  const directMatch = keywords.find((kw) => kw.length >= 3 && lowerPath.includes(kw))
  if (directMatch) hints.push(`kw:${directMatch.slice(0, 12)}`)
  if (lowerPath.includes('chat')) hints.push('chat')
  if (lowerPath.includes('socket') || lowerPath.includes('ws')) hints.push('realtime')
  if (lowerPath.includes('auth')) hints.push('auth')
  if (lowerPath.includes('/routes/') || lowerPath.includes('router')) hints.push('route')
  if (lowerPath.includes('service')) hints.push('service')
  if (lowerPath.includes('test') || lowerPath.includes('__tests__')) hints.push('test')
  if (typeof score?.importScore === 'number' && score.importScore > 0.45) hints.push('dependency')
  if (typeof score?.recencyScore === 'number' && score.recencyScore > 0.7) hints.push('recent')
  return Array.from(new Set(hints)).slice(0, 3)
}

function buildTicketKeywords(ticket: Ticket, userContext?: string): string[] {
  const text = `${ticket.title || ''} ${ticket.overview || ''} ${userContext || ''}`
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
  const unique: string[] = []
  for (const token of tokens) {
    if (!unique.includes(token)) {
      unique.push(token)
    }
  }
  return unique.slice(0, 12)
}

function dedupeCandidates(files: File[]): File[] {
  const seen = new Set<string>()
  const result: File[] = []
  for (const file of files) {
    if (!file) continue
    if (seen.has(file.id)) continue
    seen.add(file.id)
    result.push(file)
  }
  return result
}

export function createFileSuggestionStrategyService(deps: FileSuggestionServiceDeps = {}) {
  const service = createFileService('FileSuggestionStrategyService', deps.config)
  const relevanceService = deps.relevanceService || createFileRelevanceService()
  const cache = deps.cache || createFileCache({ ttl: 5 * 60 * 1000, maxSize: 200 }) // 5 minute cache

  async function suggestFiles(
    ticket: Ticket,
    strategy: FileSuggestionStrategy = 'balanced',
    maxResults: number = 10,
    userContext?: string,
    customConfig?: Partial<RelevanceConfig>
  ): Promise<FileSuggestionResponse> {
    return service.withErrorContext<FileSuggestionResponse>(
      async (): Promise<FileSuggestionResponse> => {
        const startTime = Date.now()
        const strategyConfig = STRATEGY_CONFIGS[strategy]

        // Check cache first
        const cacheKey = `suggestions:${ticket.id}:${strategy}:${maxResults}:${hashContext(userContext || '')}`
        const cached = cache.get(cacheKey) as any
        if (cached && cached.suggestions && Array.isArray(cached.suggestions)) {
          return {
            suggestions: cached.suggestions,
            scores: cached.scores || [],
            metadata: {
              ...(cached.metadata || {}),
              processingTime: Date.now() - startTime
            }
          }
        }

        // Step 1: Pre-filter files using relevance scoring
        const relevanceScores = await preFilterFiles(
          ticket,
          strategyConfig.maxPreFilterFiles,
          userContext,
          customConfig
        )

        let finalSuggestions: string[]
        let scores: Array<RelevanceScoreResult & { aiConfidence?: number; aiReasons?: string[] }> | undefined
        let aiSelections: AiRerankSelection[] | undefined

        if (strategyConfig.useAI && relevanceScores.length > 0) {
          // Step 2: Use AI to refine suggestions from pre-filtered set
          const aiCandidateScores = relevanceScores.slice(0, strategyConfig.maxAIFiles)
          const candidateFiles = await getFilesByScores(ticket.projectId, aiCandidateScores)

          const aiResult = await aiRefineSuggestions(
            ticket,
            candidateFiles,
            aiCandidateScores,
            maxResults,
            strategyConfig,
            userContext
          )

          finalSuggestions = aiResult.fileIds
          aiSelections = aiResult.selections
          const selectionMap = new Map(aiResult.selections.map((selection) => [selection.id, selection]))

          // Map AI suggestions back to relevance scores and attach debug metadata
          scores = finalSuggestions.map((fileId) => {
            const baseScore = relevanceScores.find((s) => s.fileId === fileId) || createDefaultScore(fileId)
            const selection = selectionMap.get(fileId)
            return selection
              ? { ...baseScore, aiConfidence: selection.confidence, aiReasons: selection.reasons }
              : baseScore
          })
        } else {
          // Fast mode: Use only pre-filtering results
          finalSuggestions = relevanceScores.slice(0, maxResults).map((score) => score.fileId)
          scores = relevanceScores.slice(0, maxResults)
          aiSelections = []
        }

        // Calculate token savings
        const tokensSaved = await calculateTokenSavings(ticket.projectId, strategyConfig.maxAIFiles)

        const result: FileSuggestionResponse = {
          suggestions: finalSuggestions,
          scores,
          metadata: {
            totalFiles: await getTotalFileCount(ticket.projectId),
            analyzedFiles: relevanceScores.length,
            strategy,
            processingTime: Date.now() - startTime,
            tokensSaved,
            aiSelections: aiSelections ?? []
          }
        }

        // Cache the result
        cache.set(cacheKey, result)
        return result
      },
      { action: 'suggest-files', id: ticket.id }
    )
  }

  async function preFilterFiles(
    ticket: Ticket,
    maxFiles: number,
    userContext?: string,
    customConfig?: Partial<RelevanceConfig>
  ): Promise<RelevanceScoreResult[]> {
    // Update config if custom settings provided
    if (customConfig) {
      relevanceService.updateConfig(customConfig)
    }

    // Get relevance scores for all files
    const scores = await relevanceService.scoreFilesForTicket(ticket, ticket.projectId, userContext)

    // Return top scored files
    return scores.slice(0, maxFiles)
  }

  async function getFilesByScores(projectId: number, scores: RelevanceScoreResult[]): Promise<File[]> {
    const allFiles = await getProjectFiles(projectId)

    // Handle case where project doesn't exist or has no files
    if (!allFiles) {
      console.warn(`[FileSuggestionStrategy] Project ${projectId} not found or has no files`)
      return []
    }

    const fileMap = new Map(allFiles.map((f) => [f.id, f]))
    return scores.map((score) => fileMap.get(score.fileId)).filter((file): file is File => file !== undefined)
  }

  async function aiRefineSuggestions(
    ticket: Ticket,
    candidateFiles: File[],
    candidateScores: RelevanceScoreResult[],
    maxResults: number,
    config: StrategyConfig,
    userContext?: string,
    overrides?: AiRerankOverrides
  ): Promise<{ fileIds: string[]; selections: AiRerankSelection[] }> {
    return service.withErrorContext(
      async () => {
        if (candidateFiles.length === 0) return { fileIds: [], selections: [] }

        const keywords = buildTicketKeywords(ticket, userContext)
        const dedupedCandidates = dedupeCandidates(candidateFiles)
        const maxCandidates = Math.max(1, overrides?.maxCandidates ?? MAX_RERANK_CANDIDATES)
        const trimmedCandidates = dedupedCandidates.slice(0, maxCandidates)

        const scoreMap = new Map(candidateScores.map((score) => [score.fileId, score]))
        const descriptors = trimmedCandidates
          .map((file, index) =>
            buildCandidateDescriptor(
              file,
              scoreMap.get(file.id) ?? createDefaultScore(file.id),
              index,
              config.compactLevel,
              keywords
            )
          )
          .filter((line) => line.length > 0)

        if (descriptors.length === 0) {
          return { fileIds: trimmedCandidates.slice(0, maxResults).map((file) => file.id), selections: [] }
        }

        const strategy = overrides?.strategy ?? config.rerankStrategy ?? DEFAULT_RERANK_STRATEGY
        if (strategy !== 'ai-sdk') {
          console.warn(
            `[FileSuggestionStrategy] Rerank strategy "${strategy}" not implemented; falling back to ai-sdk listwise reranker.`
          )
        }

        const topK = Math.max(1, Math.min(maxResults, overrides?.topK ?? maxResults, 10))
        const candidateIdSet = new Set(trimmedCandidates.map((file) => file.id))
        const prompt = buildRerankPrompt({
          ticket,
          userContext,
          descriptors: descriptors.slice(0, maxCandidates),
          topK
        })

        try {
          const modelOptions = await resolveModelOptions(config.aiModel)
          const result = await generateStructuredData({
            prompt,
            systemMessage: AI_RERANK_SYSTEM_PROMPT,
            schema: FILE_RERANK_SCHEMA,
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
            if (!candidateIdSet.has(selection.id) || seen.has(selection.id)) continue
            rankedIds.push(selection.id)
            seen.add(selection.id)
            if (rankedIds.length >= maxResults) break
          }

          const fallbackOrder = trimmedCandidates.map((file) => file.id)
          for (const id of fallbackOrder) {
            if (!seen.has(id)) {
              rankedIds.push(id)
              seen.add(id)
            }
            if (rankedIds.length >= maxResults) break
          }

          return { fileIds: rankedIds.slice(0, maxResults), selections }
        } catch (error) {
          console.error(`[FileSuggestionStrategy] AI reranker failed for ticket ${ticket.id}:`, error)
          return { fileIds: trimmedCandidates.slice(0, maxResults).map((file) => file.id), selections: [] }
        }
      },
      { action: 'ai-refine-suggestions', id: `${ticket.id}:${candidateFiles.length}` }
    )
  }

  // Batch processing for multiple tickets
  async function batchSuggestFiles(
    tickets: Ticket[],
    strategy: FileSuggestionStrategy = 'fast',
    maxResultsPerTicket: number = 5
  ): Promise<Map<number, FileSuggestionResponse>> {
    return service.withErrorContext(
      async () => {
        const results = new Map<number, FileSuggestionResponse>()

        // Use parallel processor for batch operations
        const processor = service.createParallelProcessor(async (batch: Ticket[]) => {
          return Promise.allSettled(
            batch.map(async (ticket) => {
              const result = await suggestFiles(ticket, strategy, maxResultsPerTicket)
              return { ticketId: ticket.id, result }
            })
          )
        })

        const batchResult = await processor.processBatch(tickets)

        // Process successful results
        for (const settled of batchResult.successful) {
          if (settled.status === 'fulfilled') {
            results.set(settled.value.ticketId, settled.value.result)
          } else {
            // Handle failed individual suggestion
            const errorResponse = createErrorResponse(settled.reason, strategy)
            // We'd need ticket ID from context, skipping for now
          }
        }

        // Handle completely failed batches
        for (const { item: failedBatch, error } of batchResult.failed) {
          for (const ticket of failedBatch) {
            results.set(ticket.id, createErrorResponse(error, strategy))
          }
        }

        return results
      },
      { action: 'batch-suggest-files' }
    )
  }

  // Strategy recommendation based on project size
  async function recommendStrategy(projectId: number): Promise<FileSuggestionStrategy> {
    const files = await getProjectFiles(projectId)

    // Default to balanced strategy if project doesn't exist
    if (!files) {
      console.warn(`[FileSuggestionStrategy] Project ${projectId} not found, using balanced strategy`)
      return 'balanced'
    }

    const fileCount = files.length

    if (fileCount < 50) return 'thorough'
    if (fileCount < 200) return 'balanced'
    return 'fast'
  }

  // Utility functions
  function createDefaultScore(fileId: string): RelevanceScoreResult {
    return {
      fileId,
      totalScore: 0.5,
      keywordScore: 0,
      pathScore: 0,
      typeScore: 0,
      recencyScore: 0,
      importScore: 0
    }
  }

  async function getTotalFileCount(projectId: number): Promise<number> {
    const files = await getProjectFiles(projectId)
    return files?.length || 0
  }

  async function calculateTokenSavings(projectId: number, analyzedFiles: number): Promise<number> {
    const allFiles = await getProjectFiles(projectId)

    // Handle case where project doesn't exist or has no files
    if (!allFiles) {
      return 0
    }

    // Estimate tokens for full project summary (XML format)
    const fullSummaryChars = allFiles.length * 500 // ~500 chars per file in XML
    const fullSummaryTokens = Math.ceil(fullSummaryChars / 4)

    // Estimate tokens for compact format
    const compactSummaryChars = analyzedFiles * 100 // ~100 chars per file in compact JSON
    const compactSummaryTokens = Math.ceil(compactSummaryChars / 4)

    return Math.max(0, fullSummaryTokens - compactSummaryTokens)
  }

  function createErrorResponse(error: any, strategy: FileSuggestionStrategy): FileSuggestionResponse {
    return {
      suggestions: [],
      metadata: {
        totalFiles: 0,
        analyzedFiles: 0,
        strategy,
        processingTime: 0,
        tokensSaved: 0
      },
      error: error instanceof Error ? error.message : String(error)
    }
  }

  function hashContext(context: string): string {
    let hash = 0
    for (let i = 0; i < context.length; i++) {
      const char = context.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  // Progressive suggestion refinement
  async function* progressiveSuggestion(
    ticket: Ticket,
    maxResults: number = 10,
    userContext?: string
  ): AsyncIterator<{
    stage: 'prefilter' | 'ai-refine' | 'complete'
    suggestions: string[]
    scores?: RelevanceScoreResult[]
    progress: number
  }> {
    // Stage 1: Fast prefiltering
    yield {
      stage: 'prefilter',
      suggestions: [],
      progress: 0.1
    }

    const prefilterResults = await preFilterFiles(ticket, 50, userContext)
    const fastSuggestions = prefilterResults.slice(0, maxResults).map((s) => s.fileId)

    yield {
      stage: 'prefilter',
      suggestions: fastSuggestions,
      scores: prefilterResults.slice(0, maxResults),
      progress: 0.5
    }

    // Stage 2: AI refinement if beneficial
    if (prefilterResults.length > maxResults) {
      yield {
        stage: 'ai-refine',
        suggestions: fastSuggestions,
        scores: prefilterResults.slice(0, maxResults),
        progress: 0.7
      }

      try {
        const candidateScores = prefilterResults.slice(0, 50)
        const candidateFiles = await getFilesByScores(ticket.projectId, candidateScores)
        const aiResult = await aiRefineSuggestions(
          ticket,
          candidateFiles,
          candidateScores,
          maxResults,
          STRATEGY_CONFIGS.balanced,
          userContext
        )

        const selectionMap = new Map(aiResult.selections.map((selection) => [selection.id, selection]))
        const finalScores = aiResult.fileIds.map((fileId) => {
          const score = prefilterResults.find((s) => s.fileId === fileId) || createDefaultScore(fileId)
          const selection = selectionMap.get(fileId)
          return selection
            ? { ...score, aiConfidence: selection.confidence, aiReasons: selection.reasons }
            : score
        })

        yield {
          stage: 'ai-refine',
          suggestions: aiResult.fileIds,
          scores: finalScores,
          progress: 0.9
        }

        yield {
          stage: 'complete',
          suggestions: aiResult.fileIds,
          scores: finalScores,
          progress: 1.0
        }
      } catch (error) {
        // Fall back to prefilter results
        yield {
          stage: 'complete',
          suggestions: fastSuggestions,
          scores: prefilterResults.slice(0, maxResults),
          progress: 1.0
        }
      }
    } else {
      yield {
        stage: 'complete',
        suggestions: fastSuggestions,
        scores: prefilterResults.slice(0, maxResults),
        progress: 1.0
      }
    }
  }

  return {
    // Core functionality
    suggestFiles,
    batchSuggestFiles,
    recommendStrategy,
    progressiveSuggestion,
    // Expose for project-level AI reranker reuse
    aiRefineSuggestions,

    // Service metadata
    serviceName: service.serviceName,
    config: service.config,

    // Cleanup
    destroy: () => {
      cache.destroy()
      service.destroy()
    }
  }
}

// Export types
export type FileSuggestionStrategyService = ReturnType<typeof createFileSuggestionStrategyService>

// Export singleton for backward compatibility
export const fileSuggestionStrategyService = createFileSuggestionStrategyService()

// Export individual functions for tree-shaking
export const { suggestFiles, batchSuggestFiles, recommendStrategy, aiRefineSuggestions } =
  fileSuggestionStrategyService
