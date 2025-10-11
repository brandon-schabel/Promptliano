/**
 * Deep Research Service - Functional Factory Pattern
 * Comprehensive research automation with AI-powered document building
 *
 * Following Promptliano's service architecture:
 * - Functional factory pattern (not classes)
 * - Pure functions for utilities (not classes)
 * - Uses generated types from @promptliano/database
 * - Repository integration for data access
 * - ErrorFactory for consistent error handling
 * - Dependency injection for testability
 *
 * Phase 1 Security Improvements:
 * - URL validation with SSRF protection
 * - Content size limits (10MB HTTP, 1M chars, 100K tokens)
 * - Timeout protection (30 seconds)
 * - Token limits on AI calls
 * - Optimized streaming with array joins
 */

import { createCrudService, extendService, withErrorContext, createServiceLogger } from './core/base-service'
import { safeErrorFactory } from './core/base-service'
import {
  researchRecordRepository,
  researchSourceRepository,
  researchProcessedDataRepository,
  researchDocumentSectionRepository,
  researchExportRepository,
  crawledContentRepository,
  urlRepository,
  type ResearchRecord,
  type InsertResearchRecord,
  type ResearchSource,
  type InsertResearchSource,
  type ResearchProcessedData,
  type InsertResearchProcessedData,
  type ResearchDocumentSection,
  type InsertResearchDocumentSection,
  type ResearchExport,
  type InsertResearchExport,
  type ResearchSourceMetadata
} from '@promptliano/database'
import { z } from 'zod'
import { generateStructuredData, genTextStream, type AiSdkCompatibleOptions } from './gen-ai-services'
import { ApiError } from '@promptliano/shared'

// Web scraping and content processing imports
import { Readability } from '@mozilla/readability'
// @ts-ignore - jsdom types not needed for runtime
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import { htmlToText } from 'html-to-text'
// @ts-ignore - pdf-parse module resolution issue
import * as pdfParse from 'pdf-parse'
import sanitizeHtml from 'sanitize-html'
import { encoding_for_model } from 'tiktoken'

// Web crawling service integration
import { webCrawlingService, type CrawlOptions } from './web-crawling-service'

// Security imports
import { validateResearchUrlSync } from './utils/url-validator'

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_CONTENT_SIZE = 10_000_000 // 10MB for HTTP content
const MAX_TEXT_SIZE = 1_000_000 // 1M characters for processing
const MAX_TOKENS = 100_000 // 100K tokens for chunking

// =============================================================================
// DEPENDENCIES INTERFACE
// =============================================================================

export interface DeepResearchServiceDeps {
  logger?: ReturnType<typeof createServiceLogger>
  modelConfig?: AiSdkCompatibleOptions
}

// =============================================================================
// SHARED UTILITIES (Singletons)
// =============================================================================

/**
 * Shared TurndownService instance for HTML to Markdown conversion
 */
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

/**
 * Shared token encoder instance for GPT-4 tokenization
 */
const tokenEncoder = encoding_for_model('gpt-4')

// =============================================================================
// PURE UTILITY FUNCTIONS
// =============================================================================

/**
 * Fetch and process a source URL (web page or PDF)
 *
 * @param url - Source URL to fetch
 * @returns Processed content with title, text, and markdown
 * @throws ApiError if URL is invalid, blocked, or content too large
 */
async function fetchAndProcessSource(url: string) {
  // Validate URL (SSRF protection)
  const validatedUrl = validateResearchUrlSync(url)

  // Fetch with timeout and size limits
  const response = await fetch(validatedUrl.toString(), {
    signal: AbortSignal.timeout(30000), // 30 second timeout
    headers: {
      'User-Agent': 'Promptliano-Research/1.0'
    }
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to fetch URL: ${response.statusText}`,
      'FETCH_FAILED',
      { url, status: response.status }
    )
  }

  // Check content size before reading
  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
    throw new ApiError(
      422,
      `Content too large: ${Math.round(parseInt(contentLength) / 1_000_000)}MB (max 10MB)`,
      'CONTENT_TOO_LARGE',
      { contentLength: parseInt(contentLength), maxSize: MAX_CONTENT_SIZE }
    )
  }

  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/pdf')) {
    return processPdfContent(await response.arrayBuffer())
  }

  return processHtmlContent(await response.text(), url)
}

/**
 * Process HTML content with Readability
 *
 * @param html - Raw HTML content
 * @param url - Source URL for base resolution
 * @returns Extracted article content
 */
function processHtmlContent(html: string, url: string) {
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document as any)
  const article = reader.parse()

  if (!article) {
    return {
      title: dom.window.document.title,
      content: htmlToText(html),
      markdown: turndownService.turndown(html),
      excerpt: ''
    }
  }

  return {
    title: article.title || 'Untitled',
    content: article.textContent || '',
    markdown: turndownService.turndown(article.content || ''),
    excerpt: article.excerpt || '',
    author: article.byline,
    siteName: article.siteName
  }
}

/**
 * Process PDF content
 *
 * @param buffer - PDF file buffer
 * @returns Extracted PDF text content
 */
async function processPdfContent(buffer: ArrayBuffer) {
  // @ts-ignore - pdf-parse default export issue
  const parsePdf = pdfParse.default || pdfParse
  const data = await parsePdf(Buffer.from(buffer))
  return {
    title: data.info?.Title || 'PDF Document',
    content: data.text || '',
    markdown: data.text || '',
    pages: data.numpages
  }
}

/**
 * Process raw source data into clean, analyzable content
 *
 * @param rawData - Raw content with markdown and title
 * @returns Cleaned and analyzed content
 * @throws ApiError if content exceeds size limits
 */
function processSourceData(rawData: { content: string; markdown: string; title: string }) {
  // Check content size before processing
  if (rawData.content.length > MAX_TEXT_SIZE) {
    throw new ApiError(
      422,
      `Content too large to process: ${rawData.content.length.toLocaleString()} characters (max ${MAX_TEXT_SIZE.toLocaleString()})`,
      'CONTENT_TOO_LARGE',
      { contentLength: rawData.content.length, maxSize: MAX_TEXT_SIZE }
    )
  }

  const cleanedContent = cleanText(rawData.content)
  const sanitizedMarkdown = sanitizeHtml(rawData.markdown, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2'])
  })

  const keywords = extractKeywords(cleanedContent)
  const tokenCount = countTokens(cleanedContent)
  const excerpt = createExcerpt(cleanedContent, 200)
  const chunks = chunkText(cleanedContent, 512)

  return {
    cleanedContent,
    markdown: sanitizedMarkdown,
    excerpt,
    tokenCount,
    keywords,
    chunks
  }
}

/**
 * Clean text by removing extra whitespace
 *
 * @param text - Raw text to clean
 * @returns Cleaned text
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Count tokens using tiktoken
 *
 * @param text - Text to tokenize
 * @returns Token count
 */
function countTokens(text: string): number {
  return tokenEncoder.encode(text).length
}

/**
 * Create excerpt from text
 *
 * @param text - Full text
 * @param maxLength - Maximum excerpt length
 * @returns Truncated excerpt
 */
function createExcerpt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Chunk text by token count with size limits
 *
 * @param text - Text to chunk
 * @param chunkSize - Size of each chunk in tokens
 * @returns Array of text chunks
 */
function chunkText(text: string, chunkSize: number): string[] {
  // Enforce text size limit
  if (text.length > MAX_TEXT_SIZE) {
    throw new ApiError(
      422,
      `Text exceeds maximum size of ${MAX_TEXT_SIZE.toLocaleString()} characters`,
      'TEXT_TOO_LARGE',
      { textLength: text.length, maxSize: MAX_TEXT_SIZE }
    )
  }

  // Simplified chunking: use character-based chunks with estimated tokens
  // Average English text: ~4 characters per token
  const estimatedCharsPerChunk = chunkSize * 4
  const chunks: string[] = []

  let currentPosition = 0
  while (currentPosition < text.length) {
    const chunkEnd = Math.min(currentPosition + estimatedCharsPerChunk, text.length)
    chunks.push(text.slice(currentPosition, chunkEnd))
    currentPosition = chunkEnd
  }

  // Verify total doesn't exceed token limit
  const totalTokens = countTokens(text)
  if (totalTokens > MAX_TOKENS) {
    console.warn(`Text has ${totalTokens} tokens, exceeding max ${MAX_TOKENS}. Using first ${chunks.length} chunks.`)
  }

  return chunks
}

/**
 * Extract keywords from text using frequency analysis
 *
 * @param text - Text to analyze
 * @returns Array of top keywords
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || []
  const frequency: Record<string, number> = {}

  words.forEach((word) => {
    frequency[word] = (frequency[word] || 0) + 1
  })

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word)
}

/**
 * Generate document outline using AI
 *
 * @param topic - Research topic
 * @param sectionsCount - Number of main sections
 * @param depth - Outline depth level
 * @param modelConfig - Optional AI model configuration
 * @returns Generated outline structure
 */
async function generateDocumentOutline(
  topic: string,
  sectionsCount: number = 8,
  depth: number = 2,
  modelConfig?: AiSdkCompatibleOptions
) {
  const result = await generateStructuredData({
    prompt: `Create a comprehensive document outline for: ${topic}

Requirements:
- ${sectionsCount} main sections
- Depth level: ${depth}
- Logical flow from introduction to conclusion
- Each section should have a clear purpose
- Professional research document structure
- Keep response concise (under 2000 tokens)`,
    schema: z.object({
      title: z.string(),
      sections: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          subsections: z.array(z.string()).optional()
        })
      )
    }),
    options: {
      provider: modelConfig?.provider || 'openai',
      model: modelConfig?.model || 'gpt-4o',
      temperature: modelConfig?.temperature ?? 0.7,
      maxTokens: modelConfig?.maxTokens ?? 2000,
      ...modelConfig
    }
  })

  return result.object
}

/**
 * Build section content using AI with relevant research data
 *
 * @param sectionTitle - Section title
 * @param sectionGoal - Section purpose/goal
 * @param relevantData - Relevant research excerpts
 * @param modelConfig - Optional AI model configuration
 * @returns Generated section content
 */
async function buildSectionContent(
  sectionTitle: string,
  sectionGoal: string,
  relevantData: string[],
  modelConfig?: AiSdkCompatibleOptions
) {
  const context = relevantData.join('\n\n---\n\n')

  const { stream } = await genTextStream({
    prompt: `Write a comprehensive section for a research document.

Section Title: ${sectionTitle}
Goal: ${sectionGoal}

Research Context:
${context}

Requirements:
- Use markdown formatting
- Cite sources using [n] notation
- 500-1000 words (keep under 2000 tokens)
- Professional, clear writing
- Include relevant examples and data`,
    options: {
      provider: modelConfig?.provider || 'openai',
      model: modelConfig?.model || 'gpt-4o',
      temperature: modelConfig?.temperature ?? 0.7,
      maxTokens: modelConfig?.maxTokens ?? 2000,
      ...modelConfig
    }
  })

  // Optimize string concatenation (use array + join)
  const chunks: string[] = []
  for await (const chunk of stream.textStream) {
    chunks.push(chunk)
  }

  return chunks.join('')
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Create Deep Research Service with functional factory pattern
 */
export function createDeepResearchService(deps: DeepResearchServiceDeps = {}) {
  const { logger = createServiceLogger('DeepResearchService') } = deps

  // Base CRUD operations for research records
  const baseService = createCrudService<ResearchRecord, InsertResearchRecord, Partial<InsertResearchRecord>>({
    entityName: 'ResearchRecord',
    repository: researchRecordRepository as any, // Type compatibility with generated types
    logger
  })

  // Extended operations
  const extensions = {
    /**
     * Helper to merge crawl metadata into a research record
     */
    async updateResearchCrawlMetadata(
      researchId: number,
      metadata: Partial<ResearchRecord['metadata']>
    ) {
      return withErrorContext(
        async () => {
          const research = await baseService.getById(researchId)
          await baseService.update(researchId, {
            metadata: {
              ...research.metadata,
              ...metadata
            },
            updatedAt: Date.now()
          })
        },
        { entity: 'ResearchRecord', action: 'updateCrawlMetadata', id: researchId }
      )
    },

    /**
     * Helper to merge crawl metadata into a research source
     */
    async updateSourceCrawlMetadata(
      sourceId: number,
      metadata: Partial<ResearchSourceMetadata>
    ) {
      return withErrorContext(
        async () => {
          const source = await researchSourceRepository.getById(sourceId)
          if (!source) throw safeErrorFactory.notFound('ResearchSource', sourceId)

          await researchSourceRepository.update(sourceId, {
            metadata: {
              ...source.metadata,
              ...metadata
            },
            updatedAt: Date.now()
          } as Partial<InsertResearchSource>)
        },
        { entity: 'ResearchSource', action: 'updateCrawlMetadata', id: sourceId }
      )
    },

    /**
     * Start a new research session
     */
    async startResearch(data: {
      projectId?: number
      topic: string
      description?: string
      maxSources?: number
      maxDepth?: number
      strategy?: 'fast' | 'balanced' | 'thorough'
      searchQueries?: string[]
      autoExecute?: boolean // New option for automatic workflow execution
      modelConfig?: AiSdkCompatibleOptions // AI model configuration

      // Crawl mode options
      enableCrawling?: boolean
      crawlSeedUrl?: string
      crawlMaxDepth?: number
      crawlMaxPages?: number
      crawlRelevanceThreshold?: number
    }): Promise<ResearchRecord> {
      return withErrorContext(
        async () => {
          // Build metadata with optional crawl config
          const metadata: any = {
            searchQueries: data.searchQueries,
            modelConfig: data.modelConfig
          }

          // Add crawl settings if enabled
          if (data.enableCrawling && data.crawlSeedUrl) {
            metadata.crawlEnabled = true
            metadata.crawlSeedUrl = data.crawlSeedUrl
            metadata.crawlMaxDepth = data.crawlMaxDepth ?? 2
            metadata.crawlMaxPages = data.crawlMaxPages ?? 20
            metadata.crawlRelevanceThreshold = data.crawlRelevanceThreshold ?? 0.6
          }

          const record = await baseService.create({
            projectId: data.projectId,
            topic: data.topic,
            description: data.description,
            maxSources: data.maxSources ?? 10,
            maxDepth: data.maxDepth ?? 3,
            strategy: data.strategy ?? 'balanced',
            status: 'initializing',
            totalSources: 0,
            processedSources: 0,
            sectionsTotal: 0,
            sectionsCompleted: 0,
            metadata,
            createdAt: Date.now(),
            updatedAt: Date.now()
          } as InsertResearchRecord)

          logger.info('Research session started', { researchId: record.id })

          // Trigger workflow execution if requested
          if (data.autoExecute !== false) {
            // Execute in background (non-blocking)
            setImmediate(async () => {
              try {
                const { researchWorkflowService } = await import('./research-workflow-service')
                await researchWorkflowService.executeWorkflow(record.id, { modelConfig: data.modelConfig })
                logger.info('Workflow execution completed', { researchId: record.id })
              } catch (error) {
                logger.error('Workflow execution failed', { researchId: record.id, error: String(error) })
              }
            })
          }

          return record
        },
        { entity: 'ResearchRecord', action: 'startResearch' }
      )
    },

    /**
     * Add source to research
     */
    async addSource(
      researchId: number,
      url: string,
      sourceType: 'web' | 'pdf' | 'academic' | 'api' = 'web'
    ): Promise<ResearchSource> {
      return withErrorContext(
        async () => {
          await baseService.getById(researchId)

          // Validate URL synchronously (basic checks)
          validateResearchUrlSync(url)

          // Check if URL already exists
          const exists = await researchSourceRepository.existsByUrl(researchId, url)
          if (exists) {
            throw safeErrorFactory.alreadyExists('ResearchSource', 'url', url)
          }

          const source = await researchSourceRepository.create({
            researchId,
            url,
            sourceType,
            status: 'pending',
            retryCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          } as InsertResearchSource)

          logger.info('Source added', { researchId, sourceId: source.id, url })
          return source
        },
        { entity: 'ResearchSource', action: 'addSource', id: researchId }
      )
    },

    /**
     * Fetch and process a source with security protections
     */
    async processSource(sourceId: number) {
      return withErrorContext(
        async () => {
          const source = await researchSourceRepository.getById(sourceId)
          if (!source) {
            throw safeErrorFactory.notFound('ResearchSource', sourceId)
          }

          // Update status to fetching
          await researchSourceRepository.update(sourceId, { status: 'fetching', updatedAt: Date.now() })

          try {
            // Fetch content (with URL validation, timeout, size limits)
            const rawData = await fetchAndProcessSource(source.url)

            // Update status to processing
            await researchSourceRepository.update(sourceId, { status: 'processing', updatedAt: Date.now() })

            // Process content (with size validation)
            const processed = processSourceData(rawData)

            // Save processed data
            await researchProcessedDataRepository.create({
              sourceId: source.id,
              researchId: source.researchId,
              rawContent: rawData.content,
              cleanedContent: processed.cleanedContent,
              markdown: processed.markdown,
              title: rawData.title,
              excerpt: processed.excerpt,
              author: (rawData as any).author,
              keywords: processed.keywords,
              entities: [],
              tokenCount: processed.tokenCount,
              createdAt: Date.now()
            } as InsertResearchProcessedData)

            // Update source status to complete
            await researchSourceRepository.update(sourceId, {
              status: 'complete',
              fetchedAt: Date.now(),
              tokenCount: processed.tokenCount,
              contentLength: rawData.content.length,
              updatedAt: Date.now()
            })

            logger.info('Source processed successfully', { sourceId })
            return { success: true }
          } catch (error) {
            await researchSourceRepository.update(sourceId, {
              status: 'failed',
              errorMessage: String(error),
              retryCount: (source.retryCount || 0) + 1,
              updatedAt: Date.now()
            })
            throw error
          }
        },
        { entity: 'ResearchSource', action: 'processSource', id: sourceId }
      )
    },

    /**
     * Generate document outline with AI
     */
    async generateOutline(
      researchId: number,
      sectionsCount: number = 8,
      depth: number = 2,
      modelConfig?: AiSdkCompatibleOptions
    ) {
      return withErrorContext(
        async () => {
          const research = await baseService.getById(researchId)

          // Use stored model config from metadata if not provided
          const effectiveModelConfig = modelConfig || (research.metadata as any)?.modelConfig

          const outline = await generateDocumentOutline(research.topic, sectionsCount, depth, effectiveModelConfig)

          // Create section records
          let orderIndex = 0
          for (const section of outline.sections) {
            await researchDocumentSectionRepository.create({
              researchId,
              title: section.title,
              description: section.description,
              orderIndex: orderIndex++,
              level: 1,
              status: 'pending',
              citedSourceIds: [],
              createdAt: Date.now(),
              updatedAt: Date.now()
            } as InsertResearchDocumentSection)

            // Create subsections if present
            if (section.subsections && section.subsections.length > 0) {
              for (const subsection of section.subsections) {
                await researchDocumentSectionRepository.create({
                  researchId,
                  title: subsection,
                  description: '',
                  orderIndex: orderIndex++,
                  level: 2,
                  status: 'pending',
                  citedSourceIds: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                } as InsertResearchDocumentSection)
              }
            }
          }

          await baseService.update(researchId, {
            sectionsTotal: orderIndex,
            status: 'building',
            updatedAt: Date.now()
          })

          logger.info('Outline generated', { researchId, sectionsCount: orderIndex })
          return outline
        },
        { entity: 'ResearchRecord', action: 'generateOutline', id: researchId }
      )
    },

    /**
     * Build a document section with AI
     */
    async buildSection(sectionId: number, userContext?: string, modelConfig?: AiSdkCompatibleOptions) {
      return withErrorContext(
        async () => {
          const section = await researchDocumentSectionRepository.getById(sectionId)
          if (!section) {
            throw safeErrorFactory.notFound('ResearchDocumentSection', sectionId)
          }

          // Update status to drafting
          await researchDocumentSectionRepository.update(sectionId, {
            status: 'drafting',
            updatedAt: Date.now()
          })

          // Get research record to access stored model config
          const research = await baseService.getById(section.researchId)

          // Use stored model config from metadata if not provided
          const effectiveModelConfig = modelConfig || (research.metadata as any)?.modelConfig

          // Get relevant research data
          const processedData = await researchProcessedDataRepository.getByResearch(section.researchId)
          const relevantData = processedData.map((d) => d.cleanedContent || '').filter(Boolean)

          // Build section content (with token limits and optimized streaming)
          const content = await buildSectionContent(
            section.title,
            section.description || '',
            relevantData,
            effectiveModelConfig
          )

          // Update section with content
          await researchDocumentSectionRepository.update(sectionId, {
            content,
            status: 'complete',
            wordCount: content.split(/\s+/).length,
            tokenCount: content.length, // Simplified token count
            updatedAt: Date.now()
          })

          logger.info('Section built', { sectionId })
          return { content }
        },
        { entity: 'ResearchDocumentSection', action: 'buildSection', id: sectionId }
      )
    },

    /**
     * Export research document
     */
    async exportDocument(
      researchId: number,
      format: 'markdown' | 'pdf' | 'html' | 'docx',
      options: {
        includeToc?: boolean
        includeReferences?: boolean
        filename?: string
      } = {}
    ): Promise<ResearchExport> {
      return withErrorContext(
        async () => {
          const research = await baseService.getById(researchId)
          const sections = await researchDocumentSectionRepository.getByResearch(researchId)
          const sources = await researchSourceRepository.getByResearch(researchId)

          // Build document content
          let content = `# ${research.topic}\n\n`

          if (research.description) {
            content += `${research.description}\n\n`
          }

          // Table of contents
          if (options.includeToc) {
            content += `## Table of Contents\n\n`
            sections.forEach((section) => {
              const level = section.level || 1
              const indent = '  '.repeat(level - 1)
              content += `${indent}- [${section.title}](#${section.title.toLowerCase().replace(/\s+/g, '-')})\n`
            })
            content += '\n'
          }

          // Sections
          sections.forEach((section) => {
            const level = section.level || 1
            const heading = '#'.repeat(level + 1)
            content += `${heading} ${section.title}\n\n`
            if (section.content) {
              content += `${section.content}\n\n`
            }
          })

          // References
          if (options.includeReferences && sources.length > 0) {
            content += `## References\n\n`
            sources.forEach((source, idx) => {
              content += `[${idx + 1}] ${source.title || 'Untitled'} - ${source.url}\n`
            })
          }

          // Create export record
          const filename = options.filename || `${research.topic.replace(/\s+/g, '-').toLowerCase()}.${format}`
          const exportRecord = await researchExportRepository.create({
            researchId,
            format,
            filename,
            content: format === 'markdown' ? content : undefined,
            size: content.length,
            downloadCount: 0,
            createdAt: Date.now()
          } as InsertResearchExport)

          logger.info('Document exported', { researchId, format, exportId: exportRecord.id })
          return exportRecord
        },
        { entity: 'ResearchExport', action: 'exportDocument', id: researchId }
      )
    },

    /**
     * Get research progress
     */
    async getProgress(researchId: number) {
      return withErrorContext(
        async () => {
          const research = await baseService.getById(researchId)
          const sources = await researchSourceRepository.getByResearch(researchId)

          const totalSources = sources.length
          const processedSources = sources.filter((s) => s.status === 'complete').length
          const percentage =
            totalSources > 0 && research.sectionsTotal
              ? Math.round(
                ((processedSources / totalSources + (research.sectionsCompleted || 0) / research.sectionsTotal) *
                  50)
              )
              : 0

          return {
            researchId,
            status: research.status,
            progress: {
              totalSources,
              processedSources,
              sectionsTotal: research.sectionsTotal,
              sectionsCompleted: research.sectionsCompleted,
              percentage
            },
            currentPhase: determineCurrentPhase(research.status),
            estimatedTimeRemaining: estimateTimeRemaining(research, processedSources, totalSources)
          }
        },
        { entity: 'ResearchRecord', action: 'getProgress', id: researchId }
      )
    },

    /**
     * Start a crawl for a specific research source
     */
    async startSourceCrawl(
      researchId: number,
      sourceId: number,
      options: {
        depthOverride?: number
        maxPagesOverride?: number
        maxLinks?: number
        recrawl?: boolean
        sameDomainOnly?: boolean
      } = {}
    ) {
      return withErrorContext(
        async () => {
          const source = await researchSourceRepository.getById(sourceId)
          if (!source) throw safeErrorFactory.notFound('ResearchSource', sourceId)
          if (source.researchId !== researchId) {
            throw safeErrorFactory.operationFailed('Source does not belong to research', {
              researchId,
              sourceId
            })
          }

          const urlToCrawl = source.url
          const shouldRecrawl = options.recrawl === true

          if (shouldRecrawl && source.metadata?.crawlSessionId) {
            await crawledContentRepository.deleteByCrawlSessionId(source.metadata.crawlSessionId)
            await urlRepository.deleteByCrawlSessionId(source.metadata.crawlSessionId)
          }

          const crawlOptions: CrawlOptions = {
            maxDepth: options.depthOverride,
            maxPages: options.maxPagesOverride,
            sameDomainOnly: options.sameDomainOnly ?? true
          }

          const crawlService = webCrawlingService
          const { crawlId } = await crawlService.startCrawl(urlToCrawl, crawlOptions, {
            researchId,
            researchSourceId: sourceId
          })

          const baseMetadata = {
            crawlSessionId: crawlId,
            crawlStatus: 'running' as const,
            crawlStartedAt: Date.now(),
            crawlFinishedAt: undefined,
            crawlError: undefined,
            crawlProgress: {
              urlsCrawled: 0,
              urlsPending: 1,
              urlsFailed: 0,
              currentDepth: 0
            }
          }

          await researchSourceRepository.update(sourceId, {
            metadata: {
              ...source.metadata,
              ...baseMetadata
            },
            updatedAt: Date.now()
          } as Partial<InsertResearchSource>)

          setImmediate(async () => {
            try {
              const progress = await crawlService.executeCrawl(crawlId)

              await researchSourceRepository.update(sourceId, {
                metadata: {
                  ...source.metadata,
                  ...baseMetadata,
                  crawlStatus: 'completed',
                  crawlFinishedAt: Date.now(),
                  crawlProgress: progress,
                  totalLinksDiscovered: progress.totalLinksDiscovered,
                  totalPagesFetched: progress.totalPagesFetched
                },
                updatedAt: Date.now()
              } as Partial<InsertResearchSource>)
            } catch (error) {
              await researchSourceRepository.update(sourceId, {
                metadata: {
                  ...source.metadata,
                  ...baseMetadata,
                  crawlStatus: 'failed',
                  crawlError: String(error),
                  crawlFinishedAt: Date.now()
                },
                updatedAt: Date.now()
              } as Partial<InsertResearchSource>)
            }
          })

          return { crawlId }
        },
        { entity: 'ResearchSource', action: 'startSourceCrawl', id: sourceId }
      )
    },

    /**
     * Retrieve crawl status for a research source
     */
    async getSourceCrawlStatus(sourceId: number) {
      return withErrorContext(
        async () => {
          const source = await researchSourceRepository.getById(sourceId)
          if (!source) throw safeErrorFactory.notFound('ResearchSource', sourceId)

          const metadata = source.metadata || {}
          const crawlSessionId = metadata.crawlSessionId
          let progress = metadata.crawlProgress

          if (crawlSessionId) {
            try {
              progress = await webCrawlingService.getCrawlProgress(crawlSessionId)
            } catch (error) {
              logger.warn('Unable to fetch live crawl progress', {
                sourceId,
                crawlSessionId,
                error: String(error)
              })
            }
          }

          return {
            sourceId: source.id,
            researchId: source.researchId,
            status: metadata.crawlStatus ?? 'idle',
            crawlSessionId,
            startedAt: metadata.crawlStartedAt,
            finishedAt: metadata.crawlFinishedAt,
            lastCrawledAt: metadata.lastCrawledAt,
            error: metadata.crawlError,
            progress,
            totalLinksDiscovered: metadata.totalLinksDiscovered,
            totalPagesFetched: metadata.totalPagesFetched
          }
        },
        { entity: 'ResearchSource', action: 'getSourceCrawlStatus', id: sourceId }
      )
    },

    /**
     * Retrieve crawl artifacts for a research source
     */
    async getSourceCrawlResults(
      sourceId: number,
      options: {
        cursor?: number
        limit?: number
        includeRawHtml?: boolean
        includeCleanContent?: boolean
      } = {}
    ) {
      return withErrorContext(
        async () => {
          const source = await researchSourceRepository.getById(sourceId)
          if (!source) throw safeErrorFactory.notFound('ResearchSource', sourceId)

          const crawlSessionId = source.metadata?.crawlSessionId
          if (!crawlSessionId) {
            return {
              sourceId,
              crawlSessionId: undefined,
              links: [],
              payloads: [],
              hasMore: false,
              cursor: undefined
            }
          }

          const crawlService = webCrawlingService
          const artifacts = await crawlService.getCrawlArtifacts(crawlSessionId, {
            cursor: options.cursor,
            limit: options.limit
          })

          const payloads = await Promise.all(
            artifacts.records.map(async (record) => {
              const content = await crawledContentRepository.getByUrlId(record.urlId)
              return {
                url: record.url,
                title: content?.title,
                rawHtml: options.includeRawHtml ? content?.rawHtml : undefined,
                cleanContent: options.includeCleanContent !== false ? content?.cleanContent : undefined,
                metadata: content?.metadata,
                crawledAt: content?.crawledAt ?? record.crawledAt ?? Date.now()
              }
            })
          )

          const links = artifacts.records.map((record) => ({
            url: record.url,
            depth: record.depth ?? 0,
            httpStatus: record.httpStatus ?? null,
            firstSeenAt: record.crawledAt ?? undefined,
            sourceUrlId: record.urlId
          }))

          return {
            sourceId,
            crawlSessionId,
            links,
            payloads,
            hasMore: artifacts.hasMore,
            cursor: artifacts.nextCursor
          }
        },
        { entity: 'ResearchSource', action: 'getSourceCrawlResults', id: sourceId }
      )
    },

    /**
     * Recrawl source helper
     */
    async recrawlSource(
      researchId: number,
      sourceId: number,
      options: {
        depthOverride?: number
        maxPagesOverride?: number
        maxLinks?: number
        sameDomainOnly?: boolean
      } = {}
    ) {
      return this.startSourceCrawl(researchId, sourceId, {
        ...options,
        recrawl: true
      })
    }
  }

  return extendService(baseService, extensions)
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine current phase description from status
 */
function determineCurrentPhase(status: string): string {
  const phases: Record<string, string> = {
    initializing: 'Initializing research session',
    gathering: 'Gathering sources',
    processing: 'Processing content',
    building: 'Building document',
    complete: 'Research complete',
    failed: 'Research failed'
  }
  return phases[status] || 'Unknown phase'
}

/**
 * Estimate time remaining based on progress
 */
function estimateTimeRemaining(
  research: ResearchRecord,
  processedSources: number,
  totalSources: number
): number | undefined {
  if (processedSources === 0) return undefined

  const timeElapsed = Date.now() - research.createdAt
  const timePerSource = timeElapsed / processedSources
  const remainingSources = totalSources - processedSources

  return Math.round(timePerSource * remainingSources)
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export types and singleton
export type DeepResearchService = ReturnType<typeof createDeepResearchService>
export const deepResearchService = createDeepResearchService()

// Export individual functions for tree-shaking and backward compatibility
export const {
  create: createResearch,
  getById: getResearchById,
  getAll: getAllResearch,
  update: updateResearch,
  delete: deleteResearch,
  startResearch,
  addSource,
  processSource,
  generateOutline,
  buildSection,
  exportDocument,
  getProgress
} = deepResearchService
