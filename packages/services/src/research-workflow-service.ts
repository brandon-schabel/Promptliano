/**
 * Research Workflow Orchestration Service - Functional Factory Pattern
 * Automates the complete deep research pipeline with state machine management
 *
 * Following Promptliano's service architecture:
 * - Functional factory pattern (not classes)
 * - Uses generated types from @promptliano/database
 * - ErrorFactory for consistent error handling
 * - Dependency injection for testability
 * - Integrates with deep-research-service for operations
 *
 * State Machine Flow:
 * initializing → gathering → processing → building → complete
 *      ↓            ↓           ↓            ↓          ↓
 *   (setup)  (add sources)  (process)    (build)    (done)
 *
 * Phase Details:
 * - Gathering: Generate search queries, add sources based on strategy
 * - Processing: Fetch and process sources in batches with retry logic
 * - Building: Generate outline, build sections with AI in parallel
 * - Complete: Final status update and cleanup
 */

import { createServiceLogger, withErrorContext } from './core/base-service'
import { safeErrorFactory } from './core/base-service'
import { deepResearchService } from './deep-research-service'
import {
  researchRecordRepository,
  researchSourceRepository,
  researchDocumentSectionRepository,
  researchProcessedDataRepository,
  urlRepository,
  crawledContentRepository,
  type ResearchRecord,
  type ResearchSource,
  type ResearchMetadata
} from '@promptliano/database'
import { generateStructuredData, type AiSdkCompatibleOptions } from './gen-ai-services'
import { z } from 'zod'
import { createWebCrawlingService } from './web-crawling-service'
import { createAiLinkRelevanceService } from './ai-link-relevance-service'

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_CONCURRENT_SOURCES = 5 // Process 5 sources at a time
const MAX_CONCURRENT_SECTIONS = 3 // Build 3 sections at a time
const MAX_RETRY_ATTEMPTS = 3 // Retry failed sources up to 3 times
const RETRY_DELAY_MS = 2000 // Base delay for exponential backoff
const BATCH_DELAY_MS = 1000 // Delay between batches to respect rate limits

// Strategy configurations
const STRATEGY_CONFIG = {
  fast: { maxSources: 5, maxDepth: 2, sectionsCount: 5 },
  balanced: { maxSources: 10, maxDepth: 3, sectionsCount: 8 },
  thorough: { maxSources: 20, maxDepth: 4, sectionsCount: 12 }
} as const

// =============================================================================
// WORKFLOW TRACKING (Concurrency Control & Abort Mechanism)
// =============================================================================

// Track active workflows to prevent concurrent execution
const activeWorkflows = new Map<number, {
  promise: Promise<WorkflowProgress>
  startedAt: number
}>()

// Track abort controllers for graceful cancellation
const abortControllers = new Map<number, AbortController>()

// =============================================================================
// DEPENDENCIES INTERFACE
// =============================================================================

export interface ResearchWorkflowServiceDeps {
  logger?: ReturnType<typeof createServiceLogger>
  deepResearchService?: typeof deepResearchService
}

// =============================================================================
// TYPES
// =============================================================================

export type WorkflowPhase = 'gathering' | 'processing' | 'building'
export type WorkflowStatus = 'initializing' | 'gathering' | 'processing' | 'building' | 'complete' | 'failed'

export interface WorkflowProgress {
  researchId: number
  status: WorkflowStatus
  currentPhase: string
  progress: {
    totalSources: number
    processedSources: number
    sectionsTotal: number
    sectionsCompleted: number
    percentage: number
  }
  errors: Array<{ phase: string; message: string; timestamp: number }>
}

export interface WorkflowOptions {
  autoStart?: boolean
  skipGathering?: boolean
  skipProcessing?: boolean
  skipBuilding?: boolean
  customSources?: string[]
  modelConfig?: AiSdkCompatibleOptions
}

// =============================================================================
// PURE UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate search queries for a research topic using AI
 */
async function generateSearchQueries(
  topic: string,
  count: number = 5,
  modelConfig?: AiSdkCompatibleOptions
): Promise<string[]> {
  const result = await generateStructuredData({
    prompt: `Generate ${count} diverse search queries for researching: "${topic}"

Requirements:
- Cover different aspects of the topic
- Use specific, searchable terms
- Include academic and practical perspectives
- Vary query complexity
- Keep queries concise (under 100 characters)

Example for "Artificial Intelligence in Healthcare":
1. "AI diagnostic tools medical imaging accuracy"
2. "machine learning patient outcome prediction"
3. "ethical implications AI healthcare decisions"
4. "AI-powered drug discovery pharmaceutical research"
5. "natural language processing electronic health records"`,
    schema: z.object({
      queries: z.array(z.string()).min(1).max(count)
    }),
    options: {
      provider: modelConfig?.provider || 'openai',
      model: modelConfig?.model || 'gpt-4o-mini',
      temperature: modelConfig?.temperature ?? 0.7,
      maxTokens: modelConfig?.maxTokens ?? 1000,
      ...modelConfig
    }
  })

  return result.object.queries
}

/**
 * Exponential backoff delay calculation
 */
function calculateRetryDelay(attempt: number): number {
  return RETRY_DELAY_MS * Math.pow(2, attempt - 1)
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Process items in batches with concurrency control
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  delayMs: number = 0
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    // Delay between batches to respect rate limits
    if (i + concurrency < items.length && delayMs > 0) {
      await sleep(delayMs)
    }
  }

  return results
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Create Research Workflow Service with functional factory pattern
 */
export function createResearchWorkflowService(deps: ResearchWorkflowServiceDeps = {}) {
  const { logger = createServiceLogger('ResearchWorkflowService'), deepResearchService: research = deepResearchService } =
    deps

  /**
   * Execute the complete workflow from current state to completion
   * Implements concurrency control and abort mechanism
   */
  async function executeWorkflow(
    researchId: number,
    options: WorkflowOptions = {}
  ): Promise<WorkflowProgress> {
    return withErrorContext(
      async () => {
        // Atomic check-and-set: Check if workflow already exists
        const existingEntry = activeWorkflows.get(researchId)
        if (existingEntry) {
          logger.warn('Workflow already running, returning existing promise', { researchId })
          return await existingEntry.promise
        }

        logger.info('Starting workflow execution', { researchId, options })

        // Create abort controller for this workflow
        const abortController = new AbortController()
        abortControllers.set(researchId, abortController)

        // Create workflow promise synchronously (no await before set)
        const workflowPromise = (async (): Promise<WorkflowProgress> => {
          try {
            // Get current state
            const record = await researchRecordRepository.getById(researchId)
            if (!record) {
              throw safeErrorFactory.notFound('ResearchRecord', researchId)
            }

            // Check if stopped
            if (record.metadata?.stopped) {
              logger.info('Workflow was stopped, clearing stop flag', { researchId })
              await researchRecordRepository.update(researchId, {
                metadata: {
                  ...(record.metadata || {}),
                  stopped: false,
                  stoppedAt: undefined
                } satisfies ResearchMetadata,
                updatedAt: Date.now()
              })
            }

            // Execute phases based on current status
            let currentRecord = record

            // Phase 1: Gathering (if needed)
            if (currentRecord.status === 'initializing' && !options.skipGathering) {
              // Check abort before phase
              if (abortController.signal.aborted) {
                logger.info('Workflow aborted before gathering', { researchId })
                return await getProgress(researchId)
              }

              currentRecord = await gatherSources(researchId, options)

              // Check abort after phase
              if (abortController.signal.aborted) {
                logger.info('Workflow aborted after gathering', { researchId })
                return await getProgress(researchId)
              }
            }

            // Phase 2: Processing (if needed)
            if (currentRecord.status === 'gathering' && !options.skipProcessing) {
              if (abortController.signal.aborted) {
                logger.info('Workflow aborted before processing', { researchId })
                return await getProgress(researchId)
              }

              currentRecord = await processSources(researchId)

              if (abortController.signal.aborted) {
                logger.info('Workflow aborted after processing', { researchId })
                return await getProgress(researchId)
              }
            }

            // Phase 3: Building (if needed)
            if (currentRecord.status === 'processing' && !options.skipBuilding) {
              if (abortController.signal.aborted) {
                logger.info('Workflow aborted before building', { researchId })
                return await getProgress(researchId)
              }

              currentRecord = await buildDocument(researchId)
            }

            // Return final progress
            return await getProgress(researchId)
          } finally {
            // Always cleanup workflow tracking and abort controllers
            activeWorkflows.delete(researchId)
            abortControllers.delete(researchId)
            logger.info('Workflow execution completed, resources cleaned up', { researchId })
          }
        })()

        // Set immediately - prevents race condition by establishing ownership before first await
        activeWorkflows.set(researchId, {
          promise: workflowPromise,
          startedAt: Date.now()
        })

        return await workflowPromise
      },
      { entity: 'ResearchWorkflow', action: 'executeWorkflow', id: researchId }
    )
  }

  /**
   * Resume workflow from current state
   */
  async function resumeWorkflow(researchId: number): Promise<WorkflowProgress> {
    return withErrorContext(
      async () => {
        // Atomic check-and-set: Check if workflow already running
        const existingEntry = activeWorkflows.get(researchId)
        if (existingEntry) {
          logger.warn('Workflow already running, returning existing promise', { researchId })
          return await existingEntry.promise
        }

        logger.info('Resuming workflow', { researchId })

        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        // Reset status if failed
        if (record.status === 'failed') {
          await researchRecordRepository.update(researchId, {
            status: 'initializing',
            updatedAt: Date.now()
          })
        }

        // Execute workflow (which will do its own atomic check-and-set)
        return await executeWorkflow(researchId)
      },
      { entity: 'ResearchWorkflow', action: 'resumeWorkflow', id: researchId }
    )
  }

  /**
   * Stop workflow gracefully with abort mechanism
   */
  async function stopWorkflow(researchId: number): Promise<void> {
    return withErrorContext(
      async () => {
        logger.info('Stopping workflow', { researchId })

        // Abort running operations
        const abortController = abortControllers.get(researchId)
        if (abortController) {
          abortController.abort()
          logger.info('Workflow operations aborted', { researchId })
        }

        // Update database
        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        await researchRecordRepository.update(researchId, {
          metadata: {
            ...(record.metadata || {}),
            stopped: true,
            stoppedAt: Date.now()
          } satisfies ResearchMetadata,
          updatedAt: Date.now()
        })

        logger.info('Workflow stopped successfully', { researchId })
      },
      { entity: 'ResearchWorkflow', action: 'stopWorkflow', id: researchId }
    )
  }

  /**
   * Convert a crawled page to a research source
   * @deprecated Use convertCrawledPagesToSourcesBatch for better performance
   */
  async function convertCrawledPageToSource(
    researchId: number,
    urlId: number
  ): Promise<void> {
    return withErrorContext(
      async () => {
        // Get URL and content
        const allUrls = await urlRepository.getAll('desc')
        const url = allUrls.find((u) => u.id === urlId)
        if (!url) {
          logger.warn('URL not found for conversion', { urlId })
          return
        }

        const content = await crawledContentRepository.getByUrlId(urlId)
        if (!content || !content.cleanContent) {
          logger.warn('No content found for URL', { urlId, url: url.url })
          return
        }

        logger.debug('Converting crawled page to source', {
          researchId,
          urlId,
          url: url.url,
          contentLength: content.cleanContent.length
        })

        // Create research source
        const source = await researchSourceRepository.create({
          researchId,
          url: url.url,
          title: content.title || 'Untitled',
          sourceType: url.url.endsWith('.pdf') ? 'pdf' : 'web',
          status: 'complete', // Already crawled
          contentLength: content.cleanContent.length,
          tokenCount: Math.floor(content.cleanContent.length / 4), // Estimate
          fetchedAt: content.crawledAt
        })

        // Create processed data from crawled content
        const keywords = content.cleanContent
          .toLowerCase()
          .match(/\b\w{4,}\b/g)
          ?.slice(0, 20) || []

        await researchProcessedDataRepository.create({
          sourceId: source.id,
          researchId,
          rawContent: content.rawHtml || content.cleanContent,
          cleanedContent: content.cleanContent,
          markdown: content.cleanContent, // Already clean from Readability
          title: content.title,
          excerpt: content.metadata?.excerpt,
          author: content.metadata?.author,
          keywords,
          entities: [],
          tokenCount: Math.floor(content.cleanContent.length / 4)
        })

        logger.info('Crawled page converted to research source', {
          researchId,
          sourceId: source.id,
          url: url.url
        })
      },
      { entity: 'ResearchSource', action: 'convertCrawledPageToSource', id: researchId }
    )
  }

  /**
   * Convert multiple crawled pages to research sources in batch
   * Optimized version that reduces N+1 queries to just 2 batch operations
   */
  async function convertCrawledPagesToSourcesBatch(
    researchId: number,
    urlIds: number[]
  ): Promise<void> {
    return withErrorContext(
      async () => {
        if (urlIds.length === 0) {
          logger.debug('No URLs to convert in batch', { researchId })
          return
        }

        logger.info('Starting batch conversion of crawled pages', {
          researchId,
          urlCount: urlIds.length
        })

        // Batch 1: Get all URLs and content in one query
        const [allUrls, allContent] = await Promise.all([
          urlRepository.getAll('desc'),
          crawledContentRepository.getByUrlIds(urlIds)
        ])

        // Create lookup maps for O(1) access
        const urlMap = new Map(allUrls.map(u => [u.id, u]))
        const contentMap = new Map(allContent.map(c => [c.urlId, c]))

        // Prepare batch data
        const sourcesToCreate: Array<{
          researchId: number
          url: string
          title: string
          sourceType: 'web' | 'pdf'
          status: 'complete'
          contentLength: number
          tokenCount: number
          fetchedAt: number
        }> = []

        const urlIdsWithContent: number[] = []

        // Build sources array
        for (const urlId of urlIds) {
          const url = urlMap.get(urlId)
          const content = contentMap.get(urlId)

          if (!url) {
            logger.warn('URL not found for conversion', { urlId })
            continue
          }

          if (!content || !content.cleanContent) {
            logger.warn('No content found for URL', { urlId, url: url.url })
            continue
          }

          sourcesToCreate.push({
            researchId,
            url: url.url,
            title: content.title || 'Untitled',
            sourceType: url.url.endsWith('.pdf') ? 'pdf' : 'web',
            status: 'complete',
            contentLength: content.cleanContent.length,
            tokenCount: Math.floor(content.cleanContent.length / 4),
            fetchedAt: content.crawledAt
          })

          urlIdsWithContent.push(urlId)
        }

        if (sourcesToCreate.length === 0) {
          logger.info('No valid content to convert', { researchId })
          return
        }

        // Batch 2: Create all sources at once
        const createdSources = await researchSourceRepository.createMany(sourcesToCreate)

        logger.info('Batch sources created', {
          researchId,
          count: createdSources.length
        })

        // Batch 3: Create all processed data at once
        const processedDataToCreate = createdSources.map((source, index) => {
          const urlId = urlIdsWithContent[index]!
          const content = contentMap.get(urlId)!

          const cleanContent = content.cleanContent || ''
          const keywords = cleanContent
            .toLowerCase()
            .match(/\b\w{4,}\b/g)
            ?.slice(0, 20) || []

          return {
            sourceId: source.id,
            researchId,
            rawContent: content.rawHtml || cleanContent,
            cleanedContent: cleanContent,
            markdown: cleanContent,
            title: content.title,
            excerpt: content.metadata?.excerpt,
            author: content.metadata?.author,
            keywords,
            entities: [],
            tokenCount: Math.floor(cleanContent.length / 4)
          }
        })

        await researchProcessedDataRepository.createMany(processedDataToCreate)

        logger.info('Batch conversion complete', {
          researchId,
          sourcesCreated: createdSources.length,
          processedDataCreated: processedDataToCreate.length
        })
      },
      { entity: 'ResearchSource', action: 'convertCrawledPagesToSourcesBatch', id: researchId }
    )
  }

  /**
   * Gather sources via intelligent web crawling
   */
  async function gatherSourcesViaCrawling(
    researchId: number,
    metadata: ResearchMetadata
  ): Promise<ResearchRecord> {
    return withErrorContext(
      async () => {
        const {
          crawlSeedUrl,
          crawlMaxDepth = 2,
          crawlMaxPages = 20,
          crawlRelevanceThreshold = 0.6
        } = metadata

        if (!crawlSeedUrl) {
          throw safeErrorFactory.operationFailed(
            'Crawl mode enabled but no seed URL provided',
            'crawlSeedUrl is required when crawlEnabled is true'
          )
        }

        logger.info('Starting intelligent web crawling', {
          researchId,
          seedUrl: crawlSeedUrl,
          maxDepth: crawlMaxDepth,
          maxPages: crawlMaxPages,
          threshold: crawlRelevanceThreshold
        })

        // 1. Start crawl session
        const crawlService = createWebCrawlingService()
        const relevanceService = createAiLinkRelevanceService()

        const { crawlId } = await crawlService.startCrawl(crawlSeedUrl, {
          maxDepth: crawlMaxDepth,
          maxPages: crawlMaxPages,
          respectRobotsTxt: true
        })

        logger.info('Crawl session started', { researchId, crawlId })

        // 2. Get research record for AI relevance filtering
        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        // Update metadata with crawl ID
        await researchRecordRepository.update(researchId, {
          metadata: {
            ...metadata,
            crawlId
          } satisfies ResearchMetadata,
          updatedAt: Date.now()
        })

        // 3. Execute crawl with AI-guided link filtering
        const progress = await crawlService.getCrawlProgress(crawlId)
        let processedCount = 0

        // Manual crawl loop with AI filtering
        const session = (crawlService as any).activeSessions?.get(crawlId)
        if (!session) {
          throw safeErrorFactory.operationFailed('Crawl session not found', crawlId)
        }

        // Track successfully crawled URL IDs for batch conversion
        const crawledUrlIds: number[] = []

        while (
          session.pending.length > 0 &&
          processedCount < crawlMaxPages &&
          session.progress.status === 'running'
        ) {
          const next = session.pending.shift()
          if (!next) break

          const { url, depth } = next

          // Skip if depth exceeds limit
          if (depth > crawlMaxDepth) {
            logger.debug('Skipping URL - depth limit', {
              url,
              depth,
              maxDepth: crawlMaxDepth
            })
            session.progress.urlsPending--
            continue
          }

          // Get or create URL record
          const urlRecord = await urlRepository.upsert({ url, status: 'pending' })

          // Process URL
          try {
            const result = await crawlService.processUrl(urlRecord.id, depth, session.options, {
              crawlId,
              context: session.context
            })

            if (result.success) {
              processedCount++

              // Collect URL ID for batch conversion (N+1 fix)
              crawledUrlIds.push(urlRecord.id)

              // Get extracted links
              const content = await crawledContentRepository.getByUrlId(urlRecord.id)
              if (content?.links && content.links.length > 0) {
                // Filter links using AI relevance service
                logger.debug('Starting AI relevance filtering', {
                  researchId,
                  linkCount: content.links.length,
                  topic: record.topic,
                  threshold: crawlRelevanceThreshold
                })

                const batch = await relevanceService.evaluateBatch(content.links, {
                  topic: record.topic,
                  threshold: crawlRelevanceThreshold
                })

                logger.debug('AI relevance batch complete', {
                  researchId,
                  evaluated: batch.totalEvaluated,
                  accepted: batch.aboveThreshold,
                  rejected: batch.totalEvaluated - batch.aboveThreshold,
                  averageScore: batch.averageScore.toFixed(3),
                  threshold: crawlRelevanceThreshold,
                  topScores: batch.results
                    .sort((a, b) => b.relevanceScore - a.relevanceScore)
                    .slice(0, 3)
                    .map(r => ({ url: r.url, score: r.relevanceScore.toFixed(3) }))
                })

                logger.info('AI filtering complete', {
                  total: batch.totalEvaluated,
                  aboveThreshold: batch.aboveThreshold,
                  averageScore: batch.averageScore.toFixed(3)
                })

                // Add only relevant links to crawl queue
                for (const linkResult of batch.results) {
                  logger.debug('AI relevance decision', {
                    url: linkResult.url,
                    score: linkResult.relevanceScore.toFixed(3),
                    shouldCrawl: linkResult.shouldCrawl,
                    threshold: crawlRelevanceThreshold,
                    reasoning: linkResult.reasoning || 'N/A'
                  })

                  if (!linkResult.shouldCrawl) {
                    logger.debug('Link rejected by AI', {
                      url: linkResult.url,
                      score: linkResult.relevanceScore,
                      threshold: crawlRelevanceThreshold
                    })
                    continue
                  }

                  const linkHash = (await import('@promptliano/database')).crawlUtils.generateUrlHash(linkResult.url)

                  // Skip if already visited
                  if (session.visited.has(linkHash)) {
                    logger.debug('Skipping URL - already visited', {
                      url: linkResult.url,
                      urlHash: linkHash.substring(0, 8)
                    })
                    continue
                  }

                  // Check same-domain constraint
                  if (session.options.sameDomainOnly) {
                    const linkDomain = (await import('@promptliano/database')).crawlUtils.extractDomain(linkResult.url)
                    if (linkDomain !== session.seedDomain) {
                      logger.debug('Skipping URL - different domain', {
                        url: linkResult.url,
                        linkDomain,
                        seedDomain: session.seedDomain
                      })
                      continue
                    }
                  }

                  // Add to pending queue with AI priority
                  session.visited.add(linkHash)
                  session.pending.push({ url: linkResult.url, depth: depth + 1 })
                  session.progress.urlsPending++

                  logger.debug('Link added to crawl queue', {
                    url: linkResult.url,
                    depth: depth + 1,
                    score: linkResult.relevanceScore,
                    queueSize: session.pending.length
                  })
                }
              }
            }

            // Respect crawl delay
            if (session.options.crawlDelay > 0) {
              logger.debug('Applying crawl delay', {
                crawlId,
                delay: session.options.crawlDelay,
                nextUrl: session.pending[0]?.url
              })
              await sleep(session.options.crawlDelay)
            }
          } catch (error) {
            logger.error('Error processing URL in crawl', {
              researchId,
              url,
              error: String(error)
            })
            session.progress.urlsFailed++
          }

          session.progress.urlsPending--

          // Update crawl progress in metadata
          await researchRecordRepository.update(researchId, {
            metadata: {
              ...metadata,
              crawlId,
              crawlProgress: {
                urlsCrawled: processedCount,
                urlsPending: session.pending.length,
                urlsFailed: session.progress.urlsFailed,
                currentDepth: depth
              }
            } satisfies ResearchMetadata,
            updatedAt: Date.now()
          })
        }

        // Batch convert all crawled pages to research sources (N+1 fix)
        if (crawledUrlIds.length > 0) {
          logger.info('Converting crawled pages in batch', {
            researchId,
            urlCount: crawledUrlIds.length
          })
          await convertCrawledPagesToSourcesBatch(researchId, crawledUrlIds)
        }

        // 4. Transition to processing phase
        const sources = await researchSourceRepository.getByResearch(researchId)
        const updatedRecord = await researchRecordRepository.update(researchId, {
          totalSources: sources.length,
          status: 'processing',
          metadata: {
            ...metadata,
            crawlId,
            crawlProgress: {
              urlsCrawled: processedCount,
              urlsPending: session.pending.length,
              urlsFailed: session.progress.urlsFailed,
              currentDepth: session.progress.currentDepth
            }
          } satisfies ResearchMetadata,
          updatedAt: Date.now()
        })

        logger.info('Intelligent crawling complete', {
          researchId,
          totalSources: sources.length,
          urlsCrawled: processedCount,
          urlsFailed: session.progress.urlsFailed
        })

        return updatedRecord as ResearchRecord
      },
      { entity: 'ResearchWorkflow', action: 'gatherSourcesViaCrawling', id: researchId }
    )
  }

  /**
   * Phase 1: Gather sources based on strategy
   */
  async function gatherSources(
    researchId: number,
    options: WorkflowOptions = {}
  ): Promise<ResearchRecord> {
    return withErrorContext(
      async () => {
        logger.info('Starting gathering phase', { researchId })

        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        // Update status to gathering
        await researchRecordRepository.update(researchId, {
          status: 'gathering',
          updatedAt: Date.now()
        })

        // Check if crawl mode is enabled
        const metadata = record.metadata as ResearchMetadata
        if (metadata.crawlEnabled && metadata.crawlSeedUrl) {
          logger.info('Crawl mode detected, using intelligent web crawling', {
            researchId,
            seedUrl: metadata.crawlSeedUrl
          })
          return await gatherSourcesViaCrawling(researchId, metadata)
        }

        try {
          let sourceUrls: string[] = []

          if (options.customSources && options.customSources.length > 0) {
            // Use custom sources if provided
            sourceUrls = options.customSources
          } else {
            // Generate search queries using AI
            const config = STRATEGY_CONFIG[record.strategy]
            const searchQueries = await generateSearchQueries(
              record.topic,
              Math.ceil(config.maxSources / 2),
              options.modelConfig // Pass through model config
            )

            // Store search queries in metadata
            await researchRecordRepository.update(researchId, {
              metadata: {
                ...record.metadata,
                searchQueries
              },
              updatedAt: Date.now()
            })

            // TODO: In production, integrate with search API to get actual URLs
            // For now, we'll use placeholder URLs based on queries
            sourceUrls = searchQueries.flatMap((query) => [
              `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
              `https://arxiv.org/search/?query=${encodeURIComponent(query)}`
            ])

            // Limit to max sources
            sourceUrls = sourceUrls.slice(0, config.maxSources)
          }

          // Add sources to database
          for (const url of sourceUrls) {
            try {
              await research.addSource(researchId, url)
            } catch (error) {
              // Continue if source already exists
              logger.warn('Failed to add source', { researchId, url, error: String(error) })
            }
          }

          // Update total sources count and transition to processing
          const sources = await researchSourceRepository.getByResearch(researchId)
          const updatedRecord = await researchRecordRepository.update(researchId, {
            totalSources: sources.length,
            status: 'processing',
            updatedAt: Date.now()
          })

          logger.info('Gathering phase complete', {
            researchId,
            totalSources: sources.length
          })

          return updatedRecord as ResearchRecord
        } catch (error) {
          logger.error('Failed to gather sources', { researchId, error: String(error) })

          // Create categorized error
          const errorMessage = error instanceof Error ? error.message : String(error)
          const categorizedError = safeErrorFactory.operationFailed('Source gathering failed', errorMessage)

          // Mark as failed with categorized error
          await researchRecordRepository.update(researchId, {
            status: 'failed',
            metadata: {
              ...(record.metadata || {}),
              errorMessage: categorizedError.message,
              errorCode: 'GATHERING_FAILED',
              errorCategory: 'gathering'
            } satisfies ResearchMetadata,
            updatedAt: Date.now()
          })

          throw categorizedError
        }
      },
      { entity: 'ResearchWorkflow', action: 'gatherSources', id: researchId }
    )
  }

  /**
   * Phase 2: Process all pending sources with retry logic
   */
  async function processSources(researchId: number): Promise<ResearchRecord> {
    return withErrorContext(
      async () => {
        logger.info('Starting processing phase', { researchId })

        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        try {
          // Get pending sources
          const sources = await researchSourceRepository.getByResearch(researchId)
          const pendingSources = sources.filter(
            (s) => s.status === 'pending' || (s.status === 'failed' && (s.retryCount || 0) < MAX_RETRY_ATTEMPTS)
          )

          logger.info('Processing sources', {
            researchId,
            total: sources.length,
            pending: pendingSources.length
          })

          // Process sources in batches with retry logic
          await processBatch(
            pendingSources,
            async (source) => {
              for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                  await research.processSource(source.id)

                  // Update progress after each source
                  const processedCount = await researchSourceRepository.countByStatus(researchId, 'complete')
                  await researchRecordRepository.update(researchId, {
                    processedSources: processedCount,
                    updatedAt: Date.now()
                  })

                  logger.info('Source processed', {
                    researchId,
                    sourceId: source.id,
                    attempt
                  })
                  break // Success, exit retry loop
                } catch (error) {
                  logger.warn('Source processing failed', {
                    researchId,
                    sourceId: source.id,
                    attempt,
                    error: String(error)
                  })

                  if (attempt < MAX_RETRY_ATTEMPTS) {
                    // Wait before retry with exponential backoff
                    await sleep(calculateRetryDelay(attempt))
                  } else {
                    // Max retries reached, continue to next source
                    logger.error('Source processing failed permanently', {
                      researchId,
                      sourceId: source.id,
                      error: String(error)
                    })
                  }
                }
              }
            },
            MAX_CONCURRENT_SOURCES,
            BATCH_DELAY_MS
          )

          // Check if we have enough processed sources to continue
          const processedSources = await researchSourceRepository.countByStatus(researchId, 'complete')
          const totalSources = sources.length

          if (processedSources === 0) {
            throw new Error('No sources were successfully processed')
          }

          // Transition to building phase
          const updatedRecord = await researchRecordRepository.update(researchId, {
            status: 'building',
            processedSources,
            updatedAt: Date.now()
          })

          logger.info('Processing phase complete', {
            researchId,
            processedSources,
            totalSources,
            successRate: Math.round((processedSources / totalSources) * 100)
          })

          return updatedRecord as ResearchRecord
        } catch (error) {
          logger.error('Failed to process sources', { researchId, error: String(error) })

          const errorMessage = error instanceof Error ? error.message : String(error)
          const categorizedError = safeErrorFactory.operationFailed(
            'Source processing failed - check individual source errors',
            errorMessage
          )

          await researchRecordRepository.update(researchId, {
            status: 'failed',
            metadata: {
              ...(record.metadata || {}),
              errorMessage: categorizedError.message,
              errorCode: 'PROCESSING_FAILED',
              errorCategory: 'processing'
            } satisfies ResearchMetadata,
            updatedAt: Date.now()
          })

          throw categorizedError
        }
      },
      { entity: 'ResearchWorkflow', action: 'processSources', id: researchId }
    )
  }

  /**
   * Phase 3: Build document with outline and sections
   */
  async function buildDocument(researchId: number): Promise<ResearchRecord> {
    return withErrorContext(
      async () => {
        logger.info('Starting building phase', { researchId })

        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        try {
          // Generate outline if not exists
          const sections = await researchDocumentSectionRepository.getByResearch(researchId)
          if (sections.length === 0) {
            const config = STRATEGY_CONFIG[record.strategy]
            await research.generateOutline(researchId, config.sectionsCount, config.maxDepth)
            logger.info('Outline generated', { researchId })
          }

          // Get pending sections
          const allSections = await researchDocumentSectionRepository.getByResearch(researchId)
          const pendingSections = allSections.filter((s) => s.status === 'pending')

          logger.info('Building sections', {
            researchId,
            total: allSections.length,
            pending: pendingSections.length
          })

          // Build sections in parallel with concurrency control
          await processBatch(
            pendingSections,
            async (section) => {
              try {
                await research.buildSection(section.id)

                // Update progress after each section
                const completedCount = await researchDocumentSectionRepository.countByStatus(
                  researchId,
                  'complete'
                )
                await researchRecordRepository.update(researchId, {
                  sectionsCompleted: completedCount,
                  updatedAt: Date.now()
                })

                logger.info('Section built', {
                  researchId,
                  sectionId: section.id,
                  title: section.title
                })
              } catch (error) {
                logger.error('Section building failed', {
                  researchId,
                  sectionId: section.id,
                  error: String(error)
                })
                // Continue with other sections even if one fails
              }
            },
            MAX_CONCURRENT_SECTIONS,
            BATCH_DELAY_MS
          )

          // Mark as complete
          const completedSections = await researchDocumentSectionRepository.countByStatus(researchId, 'complete')
          const updatedRecord = await researchRecordRepository.update(researchId, {
            status: 'complete',
            sectionsCompleted: completedSections,
            completedAt: Date.now(),
            updatedAt: Date.now()
          })

          logger.info('Building phase complete', {
            researchId,
            sectionsCompleted: completedSections,
            sectionsTotal: allSections.length
          })

          return updatedRecord as ResearchRecord
        } catch (error) {
          logger.error('Failed to build document', { researchId, error: String(error) })

          const errorMessage = error instanceof Error ? error.message : String(error)
          const categorizedError = safeErrorFactory.operationFailed('Document building failed', errorMessage)

          await researchRecordRepository.update(researchId, {
            status: 'failed',
            metadata: {
              ...(record.metadata || {}),
              errorMessage: categorizedError.message,
              errorCode: 'BUILDING_FAILED',
              errorCategory: 'building'
            } satisfies ResearchMetadata,
            updatedAt: Date.now()
          })

          throw categorizedError
        }
      },
      { entity: 'ResearchWorkflow', action: 'buildDocument', id: researchId }
    )
  }

  /**
   * Get workflow progress
   */
  async function getProgress(researchId: number): Promise<WorkflowProgress> {
    return withErrorContext(
      async () => {
        const record = await researchRecordRepository.getById(researchId)
        if (!record) {
          throw safeErrorFactory.notFound('ResearchRecord', researchId)
        }

        const sources = await researchSourceRepository.getByResearch(researchId)
        const processedSources = sources.filter((s) => s.status === 'complete').length

        // Calculate overall percentage
        let percentage = 0
        if (record.status === 'gathering') {
          percentage = 10
        } else if (record.status === 'processing') {
          percentage = 10 + Math.round((processedSources / Math.max(sources.length, 1)) * 40)
        } else if (record.status === 'building') {
          percentage =
            50 +
            Math.round(
              ((record.sectionsCompleted || 0) / Math.max(record.sectionsTotal || 1, 1)) * 50
            )
        } else if (record.status === 'complete') {
          percentage = 100
        }

        return {
          researchId,
          status: record.status,
          currentPhase: determineCurrentPhase(record.status),
          progress: {
            totalSources: sources.length,
            processedSources,
            sectionsTotal: record.sectionsTotal || 0,
            sectionsCompleted: record.sectionsCompleted || 0,
            percentage
          },
          errors: []
        }
      },
      { entity: 'ResearchWorkflow', action: 'getProgress', id: researchId }
    )
  }

  return {
    executeWorkflow,
    resumeWorkflow,
    stopWorkflow,
    getProgress,
    // Export phase functions for testing
    gatherSources,
    processSources,
    buildDocument
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine current phase description from status
 */
function determineCurrentPhase(status: WorkflowStatus): string {
  const phases: Record<WorkflowStatus, string> = {
    initializing: 'Initializing research session',
    gathering: 'Gathering sources',
    processing: 'Processing content',
    building: 'Building document',
    complete: 'Research complete',
    failed: 'Research failed'
  }
  return phases[status] || 'Unknown phase'
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export types and singleton
export type ResearchWorkflowService = ReturnType<typeof createResearchWorkflowService>
export const researchWorkflowService = createResearchWorkflowService()

// Export individual functions for tree-shaking and backward compatibility
export const { executeWorkflow, resumeWorkflow, stopWorkflow, getProgress } =
  researchWorkflowService
