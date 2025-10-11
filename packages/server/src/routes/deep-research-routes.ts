/**
 * Deep Research API Routes
 *
 * Comprehensive research automation with AI-powered document building
 * Follows Promptliano patterns: Hono + Zod + OpenAPI
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  createStandardResponses,
  successResponse,
  operationSuccessResponse,
  createSuccessResponseSchema,
  createListResponseSchema
} from '../utils/route-helpers'
import { createSimpleRateLimiter } from '../middleware/simple-rate-limiter'
import {
  CreateResearchRequestSchema,
  UpdateResearchRequestSchema,
  AddSourceRequestSchema,
  CreateSectionRequestSchema,
  UpdateSectionRequestSchema,
  BuildSectionRequestSchema,
  ExportRequestSchema,
  GenerateOutlineRequestSchema,
  ResearchProgressResponseSchema,
  GenerateOutlineResponseSchema,
  OperationSuccessResponseSchema,
  ExecuteWorkflowRequestSchema,
  WorkflowStatusResponseSchema,
  CrawlProgressResponseSchema,
  StartSourceCrawlRequestSchema,
  CrawlResultQuerySchema,
  SourceCrawlStatusResponseSchema,
  SourceCrawlResultsResponseSchema
} from '@promptliano/schemas'
import { deepResearchService, researchWorkflowService } from '@promptliano/services'
import {
  researchSourceRepository,
  researchDocumentSectionRepository,
  researchProcessedDataRepository,
  selectResearchRecordSchema,
  selectResearchSourceSchema,
  selectResearchDocumentSectionSchema,
  selectResearchExportSchema,
  selectResearchProcessedDataSchema
} from '@promptliano/database'

// =============================================================================
// RESPONSE SCHEMAS (Created from database schemas)
// =============================================================================

// Create response schemas from database select schemas
const ResearchRecordResponseSchema = createSuccessResponseSchema(selectResearchRecordSchema, 'ResearchRecordResponse')
const ResearchRecordListResponseSchema = createListResponseSchema(selectResearchRecordSchema, 'ResearchRecordListResponse')
const ResearchSourceResponseSchema = createSuccessResponseSchema(selectResearchSourceSchema, 'ResearchSourceResponse')
const ResearchSourceListResponseSchema = createListResponseSchema(selectResearchSourceSchema, 'ResearchSourceListResponse')
const ResearchDocumentSectionResponseSchema = createSuccessResponseSchema(
  selectResearchDocumentSectionSchema,
  'ResearchDocumentSectionResponse'
)
const ResearchDocumentSectionListResponseSchema = createListResponseSchema(
  selectResearchDocumentSectionSchema,
  'ResearchDocumentSectionListResponse'
)
const ResearchExportResponseSchema = createSuccessResponseSchema(selectResearchExportSchema, 'ResearchExportResponse')
const ResearchProcessedDataResponseSchema = createSuccessResponseSchema(
  selectResearchProcessedDataSchema,
  'ResearchProcessedDataResponse'
)

// =============================================================================
// RATE LIMITERS
// =============================================================================

// AI operations rate limiter - 10 requests per minute
const aiRateLimiter = createSimpleRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10
})

// Source fetching rate limiter - 20 requests per minute
const sourceRateLimiter = createSimpleRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 20
})

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const IDParamsSchema = z.object({
  id: z.coerce.number().int().positive()
})

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

// ----------------------
// CRUD Routes
// ----------------------

const createResearchRoute = createRoute({
  method: 'post',
  path: '/api/research',
  tags: ['Deep Research'],
  summary: 'Create a new research session',
  request: {
    body: {
      content: { 'application/json': { schema: CreateResearchRequestSchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ResearchRecordResponseSchema } },
      description: 'Research created successfully'
    },
    422: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listResearchRoute = createRoute({
  method: 'get',
  path: '/api/research',
  tags: ['Deep Research'],
  summary: 'List all research sessions',
  responses: createStandardResponses(ResearchRecordListResponseSchema)
})

const getResearchRoute = createRoute({
  method: 'get',
  path: '/api/research/{id}',
  tags: ['Deep Research'],
  summary: 'Get a specific research session',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(ResearchRecordResponseSchema)
})

const updateResearchRoute = createRoute({
  method: 'patch',
  path: '/api/research/{id}',
  tags: ['Deep Research'],
  summary: 'Update a research session',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateResearchRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ResearchRecordResponseSchema)
})

const deleteResearchRoute = createRoute({
  method: 'delete',
  path: '/api/research/{id}',
  tags: ['Deep Research'],
  summary: 'Delete a research session',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// ----------------------
// Research Operations
// ----------------------

const startResearchRoute = createRoute({
  method: 'post',
  path: '/api/research/start',
  tags: ['Deep Research'],
  summary: 'Start a new research session with automatic source gathering',
  request: {
    body: {
      content: { 'application/json': { schema: CreateResearchRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ResearchRecordResponseSchema)
})

const addSourceRoute = createRoute({
  method: 'post',
  path: '/api/research/{id}/sources',
  tags: ['Deep Research'],
  summary: 'Add a source to research',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: AddSourceRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ResearchSourceResponseSchema)
})

const getSourcesRoute = createRoute({
  method: 'get',
  path: '/api/research/{id}/sources',
  tags: ['Deep Research'],
  summary: 'Get all sources for a research session',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(ResearchSourceListResponseSchema)
})

const processSourceRoute = createRoute({
  method: 'post',
  path: '/api/research/sources/{id}/process',
  tags: ['Deep Research'],
  summary: 'Process a specific source',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const startSourceCrawlRoute = createRoute({
  method: 'post',
  path: '/api/research/sources/{id}/crawl',
  tags: ['Deep Research', 'Crawl'],
  summary: 'Start a crawl for a research source',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: StartSourceCrawlRequestSchema } }
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const getSourceCrawlStatusRoute = createRoute({
  method: 'get',
  path: '/api/research/sources/{id}/crawl-status',
  tags: ['Deep Research', 'Crawl'],
  summary: 'Get crawl status for a research source',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(SourceCrawlStatusResponseSchema)
})

const getSourceCrawlResultsRoute = createRoute({
  method: 'get',
  path: '/api/research/sources/{id}/crawl-results',
  tags: ['Deep Research', 'Crawl'],
  summary: 'Get crawl results for a research source',
  request: {
    params: IDParamsSchema,
    query: CrawlResultQuerySchema
  },
  responses: createStandardResponses(SourceCrawlResultsResponseSchema)
})

const getSourceProcessedDataRoute = createRoute({
  method: 'get',
  path: '/api/research/sources/{id}/processed-data',
  tags: ['Deep Research'],
  summary: 'Get processed data for a specific source',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(ResearchProcessedDataResponseSchema)
})

// ----------------------
// Document Building
// ----------------------

const generateOutlineRoute = createRoute({
  method: 'post',
  path: '/api/research/{id}/outline',
  tags: ['Deep Research'],
  summary: 'Generate document outline',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: GenerateOutlineRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(GenerateOutlineResponseSchema)
})

const getSectionsRoute = createRoute({
  method: 'get',
  path: '/api/research/{id}/sections',
  tags: ['Deep Research'],
  summary: 'Get all sections for a research document',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(ResearchDocumentSectionListResponseSchema)
})

const buildSectionRoute = createRoute({
  method: 'post',
  path: '/api/research/sections/{id}/build',
  tags: ['Deep Research'],
  summary: 'Build a specific section',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: BuildSectionRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ResearchDocumentSectionResponseSchema)
})

const updateSectionRoute = createRoute({
  method: 'patch',
  path: '/api/research/sections/{id}',
  tags: ['Deep Research'],
  summary: 'Update a section',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateSectionRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ResearchDocumentSectionResponseSchema)
})

// ----------------------
// Progress and Export
// ----------------------

const getProgressRoute = createRoute({
  method: 'get',
  path: '/api/research/{id}/progress',
  tags: ['Deep Research'],
  summary: 'Get research progress',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(ResearchProgressResponseSchema)
})

const exportDocumentRoute = createRoute({
  method: 'post',
  path: '/api/research/{id}/export',
  tags: ['Deep Research'],
  summary: 'Export research document',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: ExportRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ResearchExportResponseSchema)
})

// ----------------------
// Workflow Orchestration
// ----------------------

const executeWorkflowRoute = createRoute({
  method: 'post',
  path: '/api/research/{id}/execute',
  tags: ['Deep Research', 'Workflow'],
  summary: 'Execute workflow from current state to completion',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: ExecuteWorkflowRequestSchema } },
      required: false
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const resumeWorkflowRoute = createRoute({
  method: 'post',
  path: '/api/research/{id}/resume',
  tags: ['Deep Research', 'Workflow'],
  summary: 'Resume workflow from failed/stopped state',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const stopWorkflowRoute = createRoute({
  method: 'post',
  path: '/api/research/{id}/stop',
  tags: ['Deep Research', 'Workflow'],
  summary: 'Stop automatic workflow execution',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const getWorkflowStatusRoute = createRoute({
  method: 'get',
  path: '/api/research/{id}/workflow-status',
  tags: ['Deep Research', 'Workflow'],
  summary: 'Get detailed workflow status with action availability',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(WorkflowStatusResponseSchema)
})

const getCrawlProgressRoute = createRoute({
  method: 'get',
  path: '/api/research/{id}/crawl-progress',
  tags: ['Deep Research', 'Crawl'],
  summary: 'Get web crawling progress',
  description: 'Get real-time web crawling progress for a research session with crawl mode enabled',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(CrawlProgressResponseSchema)
})

// =============================================================================
// TYPE MAPPING FUNCTIONS (Type-Safe Transformations)
// =============================================================================

/**
 * Map CreateResearchRequest to service-compatible data
 * Excludes auto-generated fields and transforms nested objects
 */
function mapCreateRequestToServiceData(
  body: z.infer<typeof CreateResearchRequestSchema>
): Parameters<typeof deepResearchService.startResearch>[0] {
  return {
    projectId: body.projectId,
    topic: body.topic,
    description: body.description,
    maxSources: body.maxSources,
    maxDepth: body.maxDepth,
    strategy: body.strategy,
    searchQueries: body.searchQueries,
    autoExecute: body.autoExecute,
    modelConfig: body.modelConfig,
    enableCrawling: body.enableCrawling,
    crawlSeedUrl: body.crawlSeedUrl,
    crawlMaxDepth: body.crawlMaxDepth,
    crawlMaxPages: body.crawlMaxPages,
    crawlRelevanceThreshold: body.crawlRelevanceThreshold
  }
}

/**
 * Map UpdateResearchRequest to service-compatible data
 * Only includes fields that should be updatable
 */
function mapUpdateRequestToServiceData(
  body: z.infer<typeof UpdateResearchRequestSchema>
): Partial<{
  topic: string
  description?: string
  status: 'initializing' | 'gathering' | 'processing' | 'building' | 'complete' | 'failed'
  updatedAt: number
}> {
  return {
    ...body,
    updatedAt: Date.now()
  }
}

/**
 * Map UpdateSectionRequest to repository-compatible data
 * Includes auto-generated fields and proper typing
 */
function mapUpdateSectionRequestToRepoData(
  body: z.infer<typeof UpdateSectionRequestSchema>
): Partial<{
  title?: string
  description?: string
  content?: string
  orderIndex?: number
  status?: 'pending' | 'drafting' | 'complete' | 'reviewed'
  updatedAt: number
}> {
  return {
    ...body,
    updatedAt: Date.now()
  }
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export const deepResearchRoutes = new OpenAPIHono()

// Apply rate limiters to specific routes
deepResearchRoutes.use(generateOutlineRoute.path, aiRateLimiter)
deepResearchRoutes.use(buildSectionRoute.path, aiRateLimiter)
deepResearchRoutes.use(processSourceRoute.path, sourceRateLimiter)
deepResearchRoutes.use(executeWorkflowRoute.path, aiRateLimiter)
deepResearchRoutes.use(resumeWorkflowRoute.path, aiRateLimiter)

deepResearchRoutes
  // CRUD operations
  .openapi(createResearchRoute, async (c) => {
    const body = c.req.valid('json')
    const serviceData = mapCreateRequestToServiceData(body)
    const research = await deepResearchService.startResearch(serviceData)
    return c.json(successResponse(research), 201)
  })

  .openapi(listResearchRoute, async (c) => {
    const records = await deepResearchService.getAll()
    return c.json(successResponse(records), 200)
  })

  .openapi(getResearchRoute, async (c) => {
    const { id } = c.req.valid('param')
    const research = await deepResearchService.getById(id)
    return c.json(successResponse(research), 200)
  })

  .openapi(updateResearchRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const updateData = mapUpdateRequestToServiceData(body)
    const research = await deepResearchService.update(id, updateData)
    return c.json(successResponse(research), 200)
  })

  .openapi(deleteResearchRoute, async (c) => {
    const { id } = c.req.valid('param')
    await deepResearchService.delete(id)
    return c.json(operationSuccessResponse('Research deleted successfully'), 200)
  })

  // Research operations
  .openapi(startResearchRoute, async (c) => {
    const body = c.req.valid('json')
    // Pass through all body fields including modelConfig
    const research = await deepResearchService.startResearch(body)
    return c.json(successResponse(research), 200)
  })

  .openapi(addSourceRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { url, sourceType } = c.req.valid('json')
    const source = await deepResearchService.addSource(id, url, sourceType)
    return c.json(successResponse(source), 200)
  })

  .openapi(getSourcesRoute, async (c) => {
    const { id } = c.req.valid('param')
    const sources = await researchSourceRepository.getByResearch(id)
    return c.json(successResponse(sources), 200)
  })

  .openapi(processSourceRoute, async (c) => {
    const { id } = c.req.valid('param')
    await deepResearchService.processSource(id)
    return c.json(operationSuccessResponse('Source processing started'), 200)
  })

  .openapi(getSourceProcessedDataRoute, async (c) => {
    const { id } = c.req.valid('param')
    const processedData = await researchProcessedDataRepository.getBySource(id)

    if (!processedData) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Processed data not found for this source',
            code: 'NOT_FOUND'
          }
        },
        404
      )
    }

    return c.json(successResponse(processedData), 200)
  })

  // Document building
  .openapi(generateOutlineRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { sectionsCount, depth } = c.req.valid('json')
    const outline = await deepResearchService.generateOutline(id, sectionsCount, depth)

    // Transform outline to match response schema
    const transformedOutline = {
      title: outline.title,
      sections: outline.sections.map(section => ({
        title: section.title,
        description: section.description,
        level: 1,
        subsections: section.subsections?.map(subsection => ({
          title: subsection,
          description: '',
          level: 2
        }))
      })),
      estimatedTokens: outline.sections.length * 500, // Rough estimate
      estimatedTime: outline.sections.length * 60000 // 1 minute per section estimate
    }

    return c.json(successResponse(transformedOutline), 200)
  })

  .openapi(getSectionsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const sections = await researchDocumentSectionRepository.getByResearch(id)
    return c.json(successResponse(sections), 200)
  })

  .openapi(buildSectionRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { userContext } = c.req.valid('json')
    await deepResearchService.buildSection(id, userContext)

    // Get the updated section after building
    const updatedSection = await researchDocumentSectionRepository.getById(id)
    if (!updatedSection) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Section not found after building',
            code: 'NOT_FOUND'
          }
        },
        404
      )
    }
    return c.json(successResponse(updatedSection), 200)
  })

  .openapi(updateSectionRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const updateData = mapUpdateSectionRequestToRepoData(body)
    const section = await researchDocumentSectionRepository.update(id, updateData)
    return c.json(successResponse(section), 200)
  })

  // Progress and export
  .openapi(getProgressRoute, async (c) => {
    const { id } = c.req.valid('param')
    const progress = await deepResearchService.getProgress(id)

    // Ensure progress values are non-null as per schema
    const transformedProgress = {
      researchId: progress.researchId,
      status: progress.status,
      progress: {
        totalSources: progress.progress.totalSources,
        processedSources: progress.progress.processedSources,
        sectionsTotal: progress.progress.sectionsTotal || 0,
        sectionsCompleted: progress.progress.sectionsCompleted || 0,
        percentage: progress.progress.percentage
      },
      currentPhase: progress.currentPhase,
      estimatedTimeRemaining: progress.estimatedTimeRemaining
    }

    return c.json(successResponse(transformedProgress), 200)
  })

  .openapi(exportDocumentRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { format, includeToc, includeReferences, filename } = c.req.valid('json')
    const exportRecord = await deepResearchService.exportDocument(id, format, {
      includeToc,
      includeReferences,
      filename
    })
    return c.json(successResponse(exportRecord), 200)
  })

  // Workflow orchestration
  .openapi(executeWorkflowRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const options = body?.options || {}

    await researchWorkflowService.executeWorkflow(id, options)

    return c.json(operationSuccessResponse('Workflow execution started'), 200)
  })

  .openapi(resumeWorkflowRoute, async (c) => {
    const { id } = c.req.valid('param')

    await researchWorkflowService.resumeWorkflow(id)

    return c.json(operationSuccessResponse('Workflow resumed'), 200)
  })

  .openapi(stopWorkflowRoute, async (c) => {
    const { id } = c.req.valid('param')

    await researchWorkflowService.stopWorkflow(id)

    return c.json(operationSuccessResponse('Workflow stopped'), 200)
  })

  .openapi(getWorkflowStatusRoute, async (c) => {
    const { id } = c.req.valid('param')

    const research = await deepResearchService.getById(id)
    const workflowProgress = await researchWorkflowService.getProgress(id)
    const detailedProgress = await deepResearchService.getProgress(id)

    const status = {
      researchId: id,
      status: research.status,
      currentPhase: workflowProgress.currentPhase,
      canResume: ['failed', 'initializing'].includes(research.status),
      canExecute: ['initializing', 'failed'].includes(research.status),
      canStop: ['gathering', 'processing', 'building'].includes(research.status),
      progress: {
        percentage: workflowProgress.progress.percentage,
        totalSources: workflowProgress.progress.totalSources,
        processedSources: workflowProgress.progress.processedSources,
        sectionsTotal: workflowProgress.progress.sectionsTotal,
        sectionsCompleted: workflowProgress.progress.sectionsCompleted
      },
      estimatedTimeRemaining: detailedProgress.estimatedTimeRemaining,
      lastError: (research.metadata as any)?.errorMessage
    }

    return c.json(successResponse(status), 200)
  })

  .openapi(getCrawlProgressRoute, async (c) => {
    const { id } = c.req.valid('param')

    const research = await deepResearchService.getById(id)
    const metadata = research.metadata as any

    const crawlProgress = {
      researchId: id,
      crawlEnabled: metadata?.crawlEnabled || false,
      crawlId: metadata?.crawlId,
      seedUrl: metadata?.crawlSeedUrl,
      progress: metadata?.crawlProgress ? {
        urlsCrawled: metadata.crawlProgress.urlsCrawled || 0,
        urlsPending: metadata.crawlProgress.urlsPending || 0,
        urlsFailed: metadata.crawlProgress.urlsFailed || 0,
        currentDepth: metadata.crawlProgress.currentDepth || 0
      } : undefined,
      config: metadata?.crawlEnabled ? {
        maxDepth: metadata.crawlMaxDepth || 2,
        maxPages: metadata.crawlMaxPages || 20,
        relevanceThreshold: metadata.crawlRelevanceThreshold || 0.6
      } : undefined
    }

    return c.json(successResponse(crawlProgress), 200)
  })
  .openapi(startSourceCrawlRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const source = await researchSourceRepository.getById(id)
    if (!source) {
      return c.json(successResponse({ success: false, message: 'Source not found' }), 404)
    }

    const result = await deepResearchService.startSourceCrawl(source.researchId, id, {
      depthOverride: body.depthOverride,
      maxPagesOverride: body.maxPagesOverride,
      maxLinks: body.maxLinks,
      recrawl: body.recrawl,
      sameDomainOnly: body.sameDomainOnly
    })

    return c.json(operationSuccessResponse(result), 200)
  })
  .openapi(getSourceCrawlStatusRoute, async (c) => {
    const { id } = c.req.valid('param')

    const source = await researchSourceRepository.getById(id)
    if (!source) {
      return c.json(successResponse({ success: false, message: 'Source not found' }), 404)
    }

    const result = await deepResearchService.getSourceCrawlStatus(id)
    return c.json(successResponse(result), 200)
  })
  .openapi(getSourceCrawlResultsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')

    const source = await researchSourceRepository.getById(id)
    if (!source) {
      return c.json(successResponse({ success: false, message: 'Source not found' }), 404)
    }

    const result = await deepResearchService.getSourceCrawlResults(id, {
      cursor: query.cursor ? Number(query.cursor) : undefined,
      limit: query.limit,
      includeRawHtml: query.includeRawHtml,
      includeCleanContent: query.includeCleanContent
    })

    return c.json(successResponse(result), 200)
  })

// Export route types for type safety
export type DeepResearchRouteTypes = typeof deepResearchRoutes
