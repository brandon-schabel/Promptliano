import type { Ticket, File, FileSuggestionStrategy, RelevanceConfig } from '@promptliano/database'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { createFileRelevanceService, type RelevanceScoreResult } from './file-relevance-service'
import { CompactFileFormatter } from '../utils/compact-file-formatter'
import { generateStructuredData } from '../gen-ai-services'
import { modelConfigService } from '../model-config-service'
import type { ModelOptionsWithProvider } from '@promptliano/config'
import { nullToUndefined } from '../utils/file-utils'
import { z } from 'zod'
import { getProjectFiles } from '../project-service'
import { createFileService, createFileCache, type FileServiceConfig } from './file-service-factory'

export interface FileSuggestionResponse {
  suggestions: string[] // File IDs
  scores?: RelevanceScoreResult[]
  metadata: {
    totalFiles: number
    analyzedFiles: number
    strategy: FileSuggestionStrategy
    processingTime: number
    tokensSaved: number
  }
  error?: string
}

export interface StrategyConfig {
  maxPreFilterFiles: number
  maxAIFiles: number
  useAI: boolean
  aiModel: 'high' | 'medium'
  compactLevel: 'ultra' | 'compact' | 'standard'
}

export interface FileSuggestionServiceDeps {
  relevanceService?: ReturnType<typeof createFileRelevanceService>
  config?: FileServiceConfig
  cache?: ReturnType<typeof createFileCache>
}

const STRATEGY_CONFIGS: Record<FileSuggestionStrategy, StrategyConfig> = {
  fast: {
    maxPreFilterFiles: 30,
    maxAIFiles: 0,
    useAI: false,
    aiModel: 'medium',
    compactLevel: 'ultra'
  },
  balanced: {
    maxPreFilterFiles: 50,
    maxAIFiles: 50,
    useAI: true,
    aiModel: 'medium',
    compactLevel: 'compact'
  },
  thorough: {
    maxPreFilterFiles: 100,
    maxAIFiles: 100,
    useAI: true,
    aiModel: 'high',
    compactLevel: 'standard'
  }
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
        let scores: RelevanceScoreResult[] | undefined

        if (strategyConfig.useAI && relevanceScores.length > 0) {
          // Step 2: Use AI to refine suggestions from pre-filtered set
          const candidateFiles = await getFilesByScores(
            ticket.projectId,
            relevanceScores.slice(0, strategyConfig.maxAIFiles)
          )

          finalSuggestions = await aiRefineSuggestions(
            ticket,
            candidateFiles,
            maxResults,
            strategyConfig,
            userContext
          )

          // Map AI suggestions back to relevance scores
          scores = finalSuggestions.map(fileId => {
            const score = relevanceScores.find(s => s.fileId === fileId)
            return score || createDefaultScore(fileId)
          })
        } else {
          // Fast mode: Use only pre-filtering results
          finalSuggestions = relevanceScores.slice(0, maxResults).map(score => score.fileId)
          scores = relevanceScores.slice(0, maxResults)
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
            tokensSaved
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

    const fileMap = new Map(allFiles.map(f => [f.id, f]))
    return scores
      .map(score => fileMap.get(score.fileId))
      .filter((file): file is File => file !== undefined)
  }

  async function aiRefineSuggestions(
    ticket: Ticket,
    candidateFiles: File[],
    maxResults: number,
    config: StrategyConfig,
    userContext?: string
  ): Promise<string[]> {
    return service.withErrorContext(
      async () => {
        if (candidateFiles.length === 0) return []

        // Format files in compact representation
        const compactSummary = CompactFileFormatter.format(candidateFiles, config.compactLevel)

        const systemPrompt = `You are a code assistant that selects the most relevant files for a ticket.
Given a ticket and a pre-filtered list of potentially relevant files, select the ${maxResults} most relevant files.

Consider:
1. Files directly related to the ticket's functionality
2. Test files that need to be updated
3. Configuration files that might need changes
4. Related components or modules

Return only file IDs as strings in order of relevance.`

        const userPrompt = `Ticket: ${ticket.title}
Overview: ${ticket.overview || 'No overview'}
${userContext ? `Context: ${userContext}` : ''}

Pre-filtered files (${compactSummary.total} files):
${CompactFileFormatter.toAIPrompt(candidateFiles, config.compactLevel)}

Select the ${maxResults} most relevant file IDs from the above list.`

        const FileSuggestionsSchema = z.object({
          fileIds: z.array(z.string()).max(maxResults)
        })

        // Get dynamic preset config based on AI model setting
        const presetConfig = await modelConfigService.getPresetConfig(
          config.aiModel === 'high' ? 'high' : 'medium'
        )
        
        // Convert ModelConfig (with null values) to ModelOptionsWithProvider (with undefined values)
        const modelConfig: ModelOptionsWithProvider = {
          provider: presetConfig.provider as ModelOptionsWithProvider['provider'],
          model: presetConfig.model,
          frequencyPenalty: nullToUndefined(presetConfig.frequencyPenalty),
          presencePenalty: nullToUndefined(presetConfig.presencePenalty),
          maxTokens: nullToUndefined(presetConfig.maxTokens),
          temperature: nullToUndefined(presetConfig.temperature),
          topP: nullToUndefined(presetConfig.topP),
          topK: nullToUndefined(presetConfig.topK)
        }

        const result = await generateStructuredData({
          prompt: userPrompt,
          systemMessage: systemPrompt,
          schema: FileSuggestionsSchema,
          options: modelConfig
        })

        return result.object.fileIds
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
        const processor = service.createParallelProcessor(
          async (batch: Ticket[]) => {
            return Promise.allSettled(
              batch.map(async ticket => {
                const result = await suggestFiles(ticket, strategy, maxResultsPerTicket)
                return { ticketId: ticket.id, result }
              })
            )
          }
        )

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
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  // Progressive suggestion refinement
  async function *progressiveSuggestion(
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
    const fastSuggestions = prefilterResults.slice(0, maxResults).map(s => s.fileId)

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
        const candidateFiles = await getFilesByScores(ticket.projectId, prefilterResults.slice(0, 50))
        const aiSuggestions = await aiRefineSuggestions(
          ticket,
          candidateFiles,
          maxResults,
          STRATEGY_CONFIGS.balanced,
          userContext
        )

        const finalScores = aiSuggestions.map(fileId => {
          const score = prefilterResults.find(s => s.fileId === fileId)
          return score || createDefaultScore(fileId)
        })

        yield {
          stage: 'ai-refine',
          suggestions: aiSuggestions,
          scores: finalScores,
          progress: 0.9
        }

        yield {
          stage: 'complete',
          suggestions: aiSuggestions,
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
export const {
  suggestFiles,
  batchSuggestFiles,
  recommendStrategy
} = fileSuggestionStrategyService