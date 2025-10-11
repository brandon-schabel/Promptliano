/**
 * AI-Powered Link Relevance Service
 *
 * Intelligently filters and prioritizes URLs for deep research crawling
 * Uses AI to analyze URL relevance to research topics and prevent wasted crawling
 *
 * Features:
 * - Batch URL evaluation for efficiency (up to 20 URLs per AI call)
 * - Context-aware filtering using already-crawled content
 * - Heuristic fallback when AI service fails
 * - Configurable relevance thresholds
 * - Priority ranking for optimal crawl order
 *
 * @module ai-link-relevance-service
 */

import { z } from 'zod'
import { ErrorFactory } from '@promptliano/shared'
import { createServiceLogger, type ServiceLogger } from './utils/service-logger'
import { generateStructuredData, type AiSdkCompatibleOptions } from './gen-ai-services'

// ============================================
// Types & Interfaces
// ============================================

export interface AiLinkRelevanceServiceDeps {
  logger?: ServiceLogger
}

export interface LinkRelevanceOptions {
  topic: string                     // Research topic
  existingContent?: string[]        // Already-crawled summaries for context
  threshold?: number                // Min relevance score (default: 0.5)
  maxLinksToEvaluate?: number       // Batch size (default: 20)
  modelConfig?: AiSdkCompatibleOptions  // AI model settings
}

export interface LinkRelevanceResult {
  url: string
  relevanceScore: number            // 0-1 scale
  reasoning: string                 // Why relevant/irrelevant
  priority: number                  // Crawl priority (1-10)
  shouldCrawl: boolean             // Above threshold?
}

export interface BatchRelevanceResult {
  results: LinkRelevanceResult[]
  totalEvaluated: number
  aboveThreshold: number
  belowThreshold: number
  averageScore: number
}

// ============================================
// Zod Schemas
// ============================================

/**
 * Schema for AI-generated link relevance evaluation
 */
const linkRelevanceEvaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      url: z.string(),
      relevanceScore: z.number().min(0).max(1).describe('Relevance score from 0 (irrelevant) to 1 (highly relevant)'),
      reasoning: z.string().max(200).describe('Brief explanation of relevance assessment'),
      priority: z.number().int().min(1).max(10).describe('Crawl priority from 1 (lowest) to 10 (highest)'),
      topicAlignment: z.enum(['high', 'medium', 'low', 'none']).describe('How well the URL aligns with the research topic')
    })
  )
})

type LinkRelevanceEvaluation = z.infer<typeof linkRelevanceEvaluationSchema>

// ============================================
// Service Factory
// ============================================

/**
 * Creates an AI-powered link relevance service
 *
 * @param deps - Service dependencies (logger)
 * @returns Link relevance service with evaluation methods
 *
 * @example
 * ```typescript
 * const service = createAiLinkRelevanceService()
 *
 * const result = await service.evaluateBatch(
 *   ['https://example.com/docs', 'https://example.com/blog'],
 *   { topic: 'Machine Learning', threshold: 0.6 }
 * )
 *
 * console.log(`${result.aboveThreshold} URLs above threshold`)
 * ```
 */
export function createAiLinkRelevanceService(deps: AiLinkRelevanceServiceDeps = {}) {
  const { logger = createServiceLogger('AiLinkRelevanceService') } = deps

  // ============================================
  // Core Evaluation Methods
  // ============================================

  /**
   * Evaluate a single URL for relevance to a research topic
   *
   * @param url - URL to evaluate
   * @param options - Evaluation options (topic, threshold, model config)
   * @returns Relevance result with score and reasoning
   *
   * @example
   * ```typescript
   * const result = await service.evaluateUrl(
   *   'https://docs.example.com/ml',
   *   { topic: 'Machine Learning in Healthcare', threshold: 0.7 }
   * )
   * console.log(`Relevance: ${result.relevanceScore}, Should crawl: ${result.shouldCrawl}`)
   * ```
   */
  async function evaluateUrl(
    url: string,
    options: LinkRelevanceOptions
  ): Promise<LinkRelevanceResult> {
    logger.debug('Evaluating single URL', { url, topic: options.topic })

    const batchResult = await evaluateBatch([url], options)

    if (batchResult.results.length === 0) {
      throw ErrorFactory.operationFailed('URL evaluation', 'No results returned from batch evaluation')
    }

    const result = batchResult.results[0]
    if (!result) {
      throw ErrorFactory.operationFailed('URL evaluation', 'Result is undefined')
    }

    return result
  }

  /**
   * Evaluate multiple URLs in batch (efficient)
   *
   * Processes up to maxLinksToEvaluate URLs per AI call
   * Automatically splits larger batches into chunks
   *
   * @param urls - Array of URLs to evaluate
   * @param options - Evaluation options
   * @returns Batch evaluation result with statistics
   *
   * @example
   * ```typescript
   * const result = await service.evaluateBatch(urls, {
   *   topic: 'Deep Learning',
   *   threshold: 0.6,
   *   maxLinksToEvaluate: 20
   * })
   *
   * const topUrls = result.results
   *   .filter(r => r.shouldCrawl)
   *   .sort((a, b) => b.priority - a.priority)
   * ```
   */
  async function evaluateBatch(
    urls: string[],
    options: LinkRelevanceOptions
  ): Promise<BatchRelevanceResult> {
    const {
      topic,
      existingContent = [],
      threshold = 0.5,
      maxLinksToEvaluate = 20,
      modelConfig = {}
    } = options

    if (urls.length === 0) {
      return {
        results: [],
        totalEvaluated: 0,
        aboveThreshold: 0,
        belowThreshold: 0,
        averageScore: 0
      }
    }

    logger.info('Evaluating URL batch', {
      urlCount: urls.length,
      topic,
      threshold,
      maxLinksToEvaluate
    })

    // Split into chunks if needed
    const chunks: string[][] = []
    for (let i = 0; i < urls.length; i += maxLinksToEvaluate) {
      chunks.push(urls.slice(i, i + maxLinksToEvaluate))
    }

    logger.debug(`Split into ${chunks.length} chunks`)

    // Process each chunk
    const allResults: LinkRelevanceResult[] = []

    for (const [index, chunk] of chunks.entries()) {
      logger.debug(`Processing chunk ${index + 1}/${chunks.length}`, { urlCount: chunk.length })

      try {
        const chunkResults = await evaluateChunk(chunk, topic, existingContent, threshold, modelConfig)
        allResults.push(...chunkResults)
      } catch (error) {
        logger.warn('Chunk evaluation failed, using heuristic fallback', { error, chunkIndex: index })

        // Use heuristic fallback for failed chunk
        const fallbackResults = chunk.map(url => {
          const score = heuristicRelevanceScore(url, topic)
          return {
            url,
            relevanceScore: score,
            reasoning: 'Heuristic evaluation (AI unavailable)',
            priority: Math.ceil(score * 10),
            shouldCrawl: score >= threshold
          }
        })

        allResults.push(...fallbackResults)
      }
    }

    // Calculate statistics
    const aboveThreshold = allResults.filter(r => r.shouldCrawl).length
    const belowThreshold = allResults.length - aboveThreshold
    const averageScore = allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.relevanceScore, 0) / allResults.length
      : 0

    logger.info('Batch evaluation complete', {
      total: allResults.length,
      aboveThreshold,
      belowThreshold,
      averageScore: averageScore.toFixed(3)
    })

    return {
      results: allResults,
      totalEvaluated: allResults.length,
      aboveThreshold,
      belowThreshold,
      averageScore
    }
  }

  /**
   * Re-rank URLs by relevance and priority
   *
   * @param results - Array of relevance results to rank
   * @returns Sorted array (highest priority first)
   *
   * @example
   * ```typescript
   * const ranked = service.rankUrls(batchResult.results)
   * const nextToCrawl = ranked[0].url
   * ```
   */
  function rankUrls(results: LinkRelevanceResult[]): LinkRelevanceResult[] {
    return [...results].sort((a, b) => {
      // Primary sort: priority (descending)
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }

      // Secondary sort: relevance score (descending)
      return b.relevanceScore - a.relevanceScore
    })
  }

  // ============================================
  // Context-Aware Methods
  // ============================================

  /**
   * Filter URLs based on already-crawled content patterns
   *
   * Uses crawled content to identify which pending URLs would add value
   *
   * @param urls - Pending URLs to filter
   * @param crawledContent - Already-crawled pages with content
   * @param topic - Research topic
   * @returns Filtered URLs that would add value
   *
   * @example
   * ```typescript
   * const valuableUrls = await service.filterByContext(
   *   pendingUrls,
   *   crawledPages,
   *   'AI Ethics'
   * )
   * ```
   */
  async function filterByContext(
    urls: string[],
    crawledContent: Array<{ url: string; content: string }>,
    topic: string
  ): Promise<string[]> {
    if (crawledContent.length === 0) {
      logger.debug('No crawled content for context filtering')
      return urls
    }

    logger.info('Filtering URLs by context', {
      urlCount: urls.length,
      crawledCount: crawledContent.length,
      topic
    })

    // Build context summary from crawled content
    const contextSummary = buildContextSummary(crawledContent)

    // Evaluate URLs with context
    const result = await evaluateBatch(urls, {
      topic,
      existingContent: [contextSummary],
      threshold: 0.5
    })

    // Return URLs that should be crawled
    const filtered = result.results
      .filter(r => r.shouldCrawl)
      .map(r => r.url)

    logger.info('Context filtering complete', {
      original: urls.length,
      filtered: filtered.length,
      removed: urls.length - filtered.length
    })

    return filtered
  }

  /**
   * Suggest next best URLs to crawl based on current research state
   *
   * Analyzes pending URLs against crawled content to find gaps
   *
   * @param pendingUrls - URLs not yet crawled
   * @param crawledUrls - Already-crawled pages with content
   * @param topic - Research topic
   * @param limit - Maximum suggestions to return
   * @returns Top suggestions ranked by value
   *
   * @example
   * ```typescript
   * const suggestions = await service.suggestNextUrls(
   *   pendingUrls,
   *   crawledPages,
   *   'Neural Networks',
   *   10
   * )
   *
   * for (const suggestion of suggestions) {
   *   console.log(`Next: ${suggestion.url} (score: ${suggestion.relevanceScore})`)
   * }
   * ```
   */
  async function suggestNextUrls(
    pendingUrls: string[],
    crawledUrls: Array<{ url: string; content: string }>,
    topic: string,
    limit: number
  ): Promise<LinkRelevanceResult[]> {
    logger.info('Suggesting next URLs to crawl', {
      pending: pendingUrls.length,
      crawled: crawledUrls.length,
      limit
    })

    // Build context from crawled content
    const contextSummary = crawledUrls.length > 0
      ? buildContextSummary(crawledUrls)
      : undefined

    // Evaluate all pending URLs with context
    const result = await evaluateBatch(pendingUrls, {
      topic,
      existingContent: contextSummary ? [contextSummary] : [],
      threshold: 0.4 // Lower threshold for suggestions
    })

    // Rank and return top suggestions
    const ranked = rankUrls(result.results)
    const suggestions = ranked.slice(0, limit)

    logger.info('Suggestions generated', {
      total: result.results.length,
      returning: suggestions.length
    })

    return suggestions
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Evaluate a chunk of URLs using AI
   */
  async function evaluateChunk(
    urls: string[],
    topic: string,
    existingContent: string[],
    threshold: number,
    modelConfig: AiSdkCompatibleOptions
  ): Promise<LinkRelevanceResult[]> {
    // Build context summary
    const contextSummary = existingContent.length > 0
      ? existingContent.join('\n\n').slice(0, 1000)
      : ''

    // Build prompt
    const prompt = buildEvaluationPrompt(urls, topic, contextSummary)
    const systemMessage = buildSystemMessage()

    logger.debug('Calling AI for evaluation', {
      urlCount: urls.length,
      hasContext: contextSummary.length > 0,
      provider: modelConfig.provider || 'openai',
      model: modelConfig.model || 'gpt-4o-mini'
    })

    // Call AI service
    const aiResult = await generateStructuredData({
      prompt,
      schema: linkRelevanceEvaluationSchema,
      systemMessage,
      options: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2000,
        ...modelConfig
      },
      debug: false
    })

    logger.debug('AI evaluation complete', {
      usage: aiResult.usage,
      evaluations: aiResult.object.evaluations.length
    })

    // Convert to results
    return aiResult.object.evaluations.map(evaluation => ({
      url: evaluation.url,
      relevanceScore: evaluation.relevanceScore,
      reasoning: evaluation.reasoning,
      priority: evaluation.priority,
      shouldCrawl: evaluation.relevanceScore >= threshold
    }))
  }

  /**
   * Build evaluation prompt for AI
   */
  function buildEvaluationPrompt(
    urls: string[],
    topic: string,
    contextSummary: string
  ): string {
    const urlList = urls.map((url, i) => `${i + 1}. ${url}`).join('\n')

    let prompt = `You are a research assistant evaluating URLs for a deep research project.

Research Topic: "${topic}"
`

    if (contextSummary.length > 0) {
      prompt += `
Context from already-crawled pages:
${contextSummary}

`
    }

    prompt += `Evaluate these URLs for relevance to the research topic:
${urlList}

For each URL:
1. Score 0-1 (0=irrelevant, 1=highly relevant)
2. Brief reasoning (max 200 chars)
3. Priority 1-10 for crawl order
4. Topic alignment (high/medium/low/none)

Consider:
- URL structure and path segments
- Domain authority and type (.edu, .org, .gov higher)
- Similarity to already-crawled content
- Potential for unique insights
- Avoid duplicate or very similar content`

    return prompt
  }

  /**
   * Build system message for AI
   */
  function buildSystemMessage(): string {
    return 'You are a helpful assistant for Promptliano\'s deep research system. Evaluate URLs accurately and concisely, focusing on research value and topic relevance.'
  }

  /**
   * Build context summary from crawled content
   */
  function buildContextSummary(
    crawledContent: Array<{ url: string; content: string }>
  ): string {
    // Take first 3 crawled pages and summarize
    const summaries = crawledContent.slice(0, 3).map(page => {
      const preview = page.content.slice(0, 200)
      return `URL: ${page.url}\nContent preview: ${preview}...`
    })

    return summaries.join('\n\n')
  }

  // ============================================
  // Heuristic Fallback
  // ============================================

  /**
   * Heuristic-based relevance scoring when AI fails
   *
   * Uses rule-based scoring based on URL structure and patterns
   *
   * @param url - URL to score
   * @param topic - Research topic
   * @returns Relevance score (0-1)
   */
  function heuristicRelevanceScore(url: string, topic: string): number {
    let score = 0.5 // Base score

    try {
      const urlLower = url.toLowerCase()
      const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3)

      // URL contains topic keywords
      const keywordMatches = topicWords.filter(word => urlLower.includes(word)).length
      score += Math.min(keywordMatches * 0.1, 0.3)

      // Authoritative domains
      if (urlLower.includes('.edu') || urlLower.includes('.gov')) {
        score += 0.15
      } else if (urlLower.includes('.org')) {
        score += 0.1
      }

      // Documentation paths
      if (urlLower.includes('/docs/') || urlLower.includes('/documentation/')) {
        score += 0.15
      } else if (urlLower.includes('/api/') || urlLower.includes('/reference/')) {
        score += 0.1
      } else if (urlLower.includes('/guide/') || urlLower.includes('/tutorial/')) {
        score += 0.1
      }

      // Research/academic content
      if (urlLower.includes('/research/') || urlLower.includes('/papers/') || urlLower.includes('/publications/')) {
        score += 0.15
      }

      // File types
      if (urlLower.endsWith('.pdf')) {
        score += 0.1
      } else if (urlLower.endsWith('.md') || urlLower.endsWith('.markdown')) {
        score += 0.05
      }

      // Negative signals
      if (urlLower.includes('/blog/') || urlLower.includes('/news/')) {
        score -= 0.05
      }
      if (urlLower.includes('/category/') || urlLower.includes('/tag/')) {
        score -= 0.1
      }

      // Clamp to valid range
      return Math.min(1, Math.max(0, score))
    } catch (error) {
      logger.warn('Heuristic scoring failed', { url, error })
      return 0.5 // Default to neutral score
    }
  }

  // ============================================
  // Return Service Interface
  // ============================================

  return {
    evaluateUrl,
    evaluateBatch,
    rankUrls,
    filterByContext,
    suggestNextUrls
  }
}

// ============================================
// Exports
// ============================================

export const aiLinkRelevanceService = createAiLinkRelevanceService()
