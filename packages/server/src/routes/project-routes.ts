import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createStandardResponses, createStandardResponsesWithStatus, standardResponses } from '../utils/route-helpers'
import { type File as ProjectFile } from '@promptliano/database'
import {
  IDParamsSchema,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  RefreshQuerySchema,
  ProjectResponseSchema,
  ProjectListResponseSchema,
  ProjectResponseMultiStatusSchema,
  ProjectSummaryResponseSchema,
  SummaryOptionsSchema,
  BatchSummaryOptionsSchema
} from '@promptliano/schemas'
import { selectFileSchema as DbFileSchema } from '@promptliano/database'

import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { successResponse, operationSuccessResponse } from '../utils/route-helpers'

import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { homedir as getHomedir } from 'node:os'

// Modern functional service imports with ErrorFactory integration
import { projectService } from '@promptliano/services'
import { ErrorFactory, ApiError } from '@promptliano/shared'
// Additional project service functions

import { stream } from 'hono/streaming'
import { createSyncProgressTracker } from '@promptliano/services/src/utils/sync-progress-tracker'
import {
  getFullProjectSummary,
  getProjectStatistics,
  syncProject,
  syncProjectFolder,
  watchersManager,
  getProjectSummaryWithOptions,
  invalidateProjectSummaryCache,
  enhancedSummarizationService,
  fileSummarizationTracker,
  fileGroupingService,
  getProjectFiles,
  updateFileContent,
  summarizeFiles,
  removeSummariesFromFiles
} from '@promptliano/services'
// Note: projectServiceV2 is now exported from @promptliano/services
// and contains all necessary methods for generated routes

// File operation schemas
const FileIdParamsSchema = z.object({
  id: IDParamsSchema.shape.id,
  fileId: z.coerce.number().int().positive()
})

// All manual routes normalized to {id}; use ProjectIdParamsSchema from @promptliano/schemas

const UpdateFileContentBodySchema = z.object({
  content: z.string()
})

const BulkUpdateFilesBodySchema = z.object({
  updates: z.array(
    z.object({
      fileId: z.number().int().positive(),
      content: z.string()
    })
  )
})

const DbFileResponseSchema = z.object({ success: z.literal(true), data: DbFileSchema as any })
const DbFileListResponseSchema = z.object({ success: z.literal(true), data: z.array(DbFileSchema as any) })
const BulkFilesResponseSchema = DbFileListResponseSchema

const SuggestFilesBodySchema = z.object({
  prompt: z.string().min(1).describe('The prompt to analyze for file suggestions'),
  limit: z.number().int().positive().optional().default(10).describe('Maximum number of files to suggest')
})

const SuggestFilesResponseSchema = DbFileListResponseSchema

// Revert to version schema
const RevertToVersionBodySchema = z.object({
  versionNumber: z.number().int().positive()
})

// Batch summarization schemas
const StartBatchSummarizationBodySchema = z.object({
  strategy: z.enum(['imports', 'directory', 'semantic', 'mixed']).default('mixed'),
  options: z
    .object({
      maxGroupSize: z.number().min(1).max(50).optional(),
      maxTokensPerGroup: z.number().min(1000).max(100000).optional(),
      priorityThreshold: z.number().min(0).max(10).optional(),
      maxConcurrentGroups: z.number().min(1).max(10).optional(),
      staleThresholdDays: z.number().min(1).max(365).optional(),
      includeStaleFiles: z.boolean().optional(),
      retryFailedFiles: z.boolean().optional()
    })
    .optional()
})

const BatchProgressResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    batchId: z.string(),
    currentGroup: z.string(),
    groupIndex: z.number(),
    totalGroups: z.number(),
    filesProcessed: z.number(),
    totalFiles: z.number(),
    tokensUsed: z.number(),
    errors: z.array(z.string())
  })
})

const FileSummarizationStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    projectId: z.number(),
    totalFiles: z.number(),
    summarizedFiles: z.number(),
    unsummarizedFiles: z.number(),
    staleFiles: z.number(),
    failedFiles: z.number(),
    averageTokensPerFile: z.number(),
    lastBatchRun: z.number().optional(),
    filesByStatus: z.object({
      pending: z.number(),
      in_progress: z.number(),
      completed: z.number(),
      failed: z.number(),
      skipped: z.number()
    })
  })
})

const FileGroupsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    groups: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        strategy: z.enum(['imports', 'directory', 'semantic', 'mixed']),
        fileIds: z.array(z.string()),
        estimatedTokens: z.number().optional(),
        priority: z.number()
      })
    ),
    totalFiles: z.number(),
    totalGroups: z.number(),
    estimatedTotalTokens: z.number()
  })
})

// Existing route definitions...
const createProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'Create a new project and sync its files',
  request: {
    body: { content: { 'application/json': { schema: CreateProjectBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectResponseSchema } },
      description: 'Project created and initial sync started'
    },
    207: {
      content: { 'application/json': { schema: ProjectResponseMultiStatusSchema } },
      description: 'Project created, but post-creation steps encountered issues'
    },
    422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const listProjectsRoute = createRoute({
  method: 'get',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'List all projects',
  responses: createStandardResponses(ProjectListResponseSchema)
})

const getProjectByIdRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: 'Get a specific project by ID',
  request: { params: IDParamsSchema },
  responses: createStandardResponses(ProjectResponseSchema)
})

const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: "Update a project's details",
  request: {
    params: IDParamsSchema,
    body: { content: { 'application/json': { schema: UpdateProjectBodySchema } } }
  },
  responses: createStandardResponses(ProjectResponseSchema)
})

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: 'Delete a project and its associated data',
  request: { params: IDParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const syncProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/sync',
  tags: ['Projects', 'Files'],
  summary: 'Manually trigger a full file sync for a project',
  request: { params: IDParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const syncProjectStreamRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/sync-stream',
  tags: ['Projects', 'Files'],
  summary: 'Trigger a file sync with real-time progress updates via SSE',
  request: { params: IDParamsSchema },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({
            description: 'Server-sent events stream with sync progress updates'
          })
        }
      },
      description: 'Sync progress stream'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

const getProjectFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/files',
  tags: ['Projects', 'Files'],
  summary: 'Get the list of files associated with a project',
  request: {
    params: IDParamsSchema,
    query: z.object({
      includeAllVersions: z.coerce.boolean().optional().default(false),
      limit: z.coerce.number().int().positive().optional().describe('Maximum number of files to return'),
      offset: z.coerce.number().int().nonnegative().optional().default(0).describe('Number of files to skip')
    })
  },
  responses: createStandardResponses(DbFileListResponseSchema)
})

const getProjectFilesMetadataRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/files/metadata',
  tags: ['Projects', 'Files'],
  summary: 'Get project files metadata without content (for performance)',
  request: {
    params: IDParamsSchema,
    query: z.object({
      limit: z.coerce.number().int().positive().optional().describe('Maximum number of files to return'),
      offset: z.coerce.number().int().nonnegative().optional().default(0).describe('Number of files to skip')
    })
  },
  responses: createStandardResponses(
    z.object({ success: z.literal(true), data: z.array((DbFileSchema as any).omit({ content: true })) })
  )
})

const updateFileContentRoute = createRoute({
  method: 'put',
  path: '/api/projects/{id}/files/{fileId}',
  tags: ['Projects', 'Files'],
  summary: 'Update the content of a specific file (creates new version)',
  request: {
    params: FileIdParamsSchema,
    body: { content: { 'application/json': { schema: UpdateFileContentBodySchema } } }
  },
  responses: createStandardResponses(DbFileResponseSchema)
})

const bulkUpdateFilesRoute = createRoute({
  method: 'put',
  path: '/api/projects/{id}/files/bulk',
  tags: ['Projects', 'Files'],
  summary: 'Update content of multiple files in a project (creates new versions)',
  request: {
    params: IDParamsSchema,
    body: { content: { 'application/json': { schema: BulkUpdateFilesBodySchema } } }
  },
  responses: createStandardResponses(BulkFilesResponseSchema)
})

const refreshProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/refresh',
  tags: ['Projects', 'Files'],
  summary: 'Refresh project files (sync) optionally limited to a folder',
  request: {
    params: IDParamsSchema,
    query: RefreshQuerySchema
  },
  responses: createStandardResponses(DbFileListResponseSchema)
})

const getProjectSummaryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/summary',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get a combined summary of all files in the project',
  request: { params: IDParamsSchema },
  responses: createStandardResponses(ProjectSummaryResponseSchema)
})

const getProjectSummaryAdvancedRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/summary/advanced',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get an advanced project summary with customizable options',
  request: {
    params: IDParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            depth: z.enum(['minimal', 'standard', 'detailed']).optional(),
            format: z.enum(['xml', 'json', 'markdown']).optional(),
            strategy: z.enum(['fast', 'balanced', 'thorough']).optional(),
            focus: z.array(z.string()).optional(),
            includeImports: z.boolean().optional(),
            includeExports: z.boolean().optional(),
            maxTokens: z.number().min(100).max(100000).optional(),
            progressive: z.boolean().optional(),
            expand: z.array(z.string()).optional(),
            includeMetrics: z.boolean().optional()
          })
        }
      },
      description: 'Summary generation options'
    }
  },
  responses: createStandardResponses(z.any())
})

const getProjectSummaryMetricsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/summary/metrics',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get metrics about project summary generation',
  request: { params: IDParamsSchema },
  responses: createStandardResponses(z.any())
})

const invalidateProjectSummaryCacheRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/summary/invalidate',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Invalidate the project summary cache',
  request: { params: IDParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const suggestFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/suggest-files',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Suggest relevant files based on user input and project context',
  request: {
    params: IDParamsSchema,
    body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } }
  },
  responses: createStandardResponses(SuggestFilesResponseSchema)
})

// Optimize endpoint not implemented - commenting out
// const optimizeUserInputRoute = createRoute({
//   method: 'post',
//   path: '/api/prompt/optimize',
//   tags: ['Prompts', 'AI'],
//   summary: 'Optimize a user-provided prompt using an AI model',
//   request: {
//     body: {
//       content: { 'application/json': { schema: z.object({ userContext: z.string(), projectId: z.number() }) } },
//       required: true,
//       description: 'The user prompt context to optimize'
//     }
//   },
//   responses: createStandardResponses(z.object({ success: z.literal(true), data: z.object({ optimizedPrompt: z.string() }) }))
// })

// Batch summarization routes
const startBatchSummarizationRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/batch-summarize',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Start batch summarization of unsummarized files',
  request: {
    params: IDParamsSchema,
    body: { content: { 'application/json': { schema: StartBatchSummarizationBodySchema } } }
  },
  responses: createStandardResponses(BatchProgressResponseSchema)
})

const getBatchProgressRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/batch-summarize/{batchId}',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get progress of a batch summarization operation',
  request: {
    params: z.object({
      id: IDParamsSchema.shape.id,
      batchId: z.string()
    })
  },
  responses: createStandardResponses(BatchProgressResponseSchema)
})

const cancelBatchSummarizationRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}/batch-summarize/{batchId}',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Cancel a running batch summarization',
  request: {
    params: z.object({
      id: IDParamsSchema.shape.id,
      batchId: z.string()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const getSummarizationStatsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/summarization-stats',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get file summarization statistics for a project',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(FileSummarizationStatsResponseSchema)
})

const previewFileGroupsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/preview-file-groups',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Preview how files would be grouped for summarization',
  request: {
    params: IDParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            strategy: z.enum(['imports', 'directory', 'semantic', 'mixed']).default('mixed'),
            maxGroupSize: z.number().min(1).max(50).optional(),
            includeStaleFiles: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(FileGroupsResponseSchema)
})

const getProjectStatisticsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/statistics',
  tags: ['Projects', 'Statistics'],
  summary: 'Get comprehensive statistics for a project',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        fileStats: z.object({
          totalFiles: z.number(),
          totalSize: z.number(),
          filesByType: z.record(z.string(), z.number()),
          sizeByType: z.record(z.string(), z.number()),
          filesByCategory: z.object({
            source: z.number(),
            tests: z.number(),
            docs: z.number(),
            config: z.number(),
            other: z.number()
          }),
          filesWithSummaries: z.number(),
          averageSummaryLength: z.number()
        }),
        ticketStats: z.object({
          totalTickets: z.number(),
          ticketsByStatus: z.object({
            open: z.number(),
            in_progress: z.number(),
            closed: z.number()
          }),
          ticketsByPriority: z.object({
            low: z.number(),
            normal: z.number(),
            high: z.number()
          }),
          averageTasksPerTicket: z.number()
        }),
        taskStats: z.object({
          totalTasks: z.number(),
          completedTasks: z.number(),
          completionRate: z.number(),
          tasksByTicket: z.array(
            z.object({
              ticketId: z.number(),
              ticketTitle: z.string(),
              totalTasks: z.number(),
              completedTasks: z.number()
            })
          )
        }),
        promptStats: z.object({
          totalPrompts: z.number(),
          totalTokens: z.number(),
          averagePromptLength: z.number(),
          promptTypes: z.record(z.string(), z.number())
        }),
        activityStats: z.object({
          recentUpdates: z.number(),
          lastUpdateTime: z.number(),
          creationTrend: z.array(
            z.object({
              date: z.string(),
              files: z.number(),
              tickets: z.number(),
              tasks: z.number()
            })
          )
        })
      })
    })
  )
})

// TODO: Future enhancement - use generated routes for basic CRUD
// For now, keeping manual routes as they handle complex scenarios the generator doesn't support yet
// import { registerProjectRoutes as registerGeneratedProjectRoutes } from './generated/project-routes.generated'

// --- Manual Routes (Complex Operations) ---
export const projectRoutes = new OpenAPIHono()
  .openapi(createProjectRoute, async (c) => {
    const body = c.req.valid('json')
    let normalizedPath = body.path
    if (normalizedPath.startsWith('~')) {
      normalizedPath = normalizedPath.replace(/^~/, getHomedir())
    }
    normalizedPath = resolvePath(normalizedPath)
    console.log(`Creating project - Original path: ${body.path}, Normalized path: ${normalizedPath}`)

    const projectData = { ...body, path: normalizedPath }

    try {
      // Use modern service factory with ErrorFactory integration
      const createdProject = await projectService.create(projectData)
      console.log(`Project created with ID: ${createdProject.id}`)

      let syncWarning: string | undefined
      let syncError: string | undefined
      let httpStatus: 201 | 207 = 201

      try {
        if (!existsSync(createdProject.path)) {
          console.warn(`Project path does not exist: ${createdProject.path}`)
          syncWarning = 'Project created but directory does not exist. No files will be synced.'
          httpStatus = 207
        } else {
          console.log(`Starting sync for project: ${createdProject.id} at path: ${createdProject.path}`)
          await syncProject(createdProject)
          console.log(`Finished syncing files for project: ${createdProject.id}`)
          console.log(`Starting file watchers for project: ${createdProject.id}`)
          await watchersManager.startWatchingProject(createdProject, [
            'node_modules',
            'dist',
            '.git',
            '*.tmp',
            '*.db-journal'
          ])
          console.log(`File watchers started for project: ${createdProject.id}`)
          const files = await getProjectFiles(createdProject.id)
          console.log(`Synced ${files?.length || 0} files for project`)
        }
      } catch (error: any) {
        console.error(`Error during project setup: ${error}`)
        syncError = `Post-creation setup failed: ${String(error)}`
        httpStatus = 207
      }

      if (httpStatus === 201) {
        return c.json(successResponse(createdProject), 201)
      } else {
        const payload = {
          success: true,
          data: createdProject,
          ...(syncWarning && { warning: syncWarning }),
          ...(syncError && { error: syncError })
        } satisfies z.infer<typeof ProjectResponseMultiStatusSchema>
        return c.json(payload, 207)
      }
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(listProjectsRoute, async (c) => {
    try {
      // Use modern service factory with built-in error handling
      const projects = await projectService.list()
      return c.json(successResponse(projects), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(getProjectByIdRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    try {
      // Service factory includes automatic existence check and error handling
      const project = await projectService.getById(projectId)
      return c.json(successResponse(project), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(updateProjectRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      // Service factory includes automatic existence check and validation
      const updatedProject = await projectService.update(projectId, body)
      return c.json(successResponse(updatedProject), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(deleteProjectRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    try {
      // Use cascade delete for complete cleanup
      const deleted = await projectService.deleteCascade(projectId)
      if (deleted) {
        watchersManager.stopWatchingProject(projectId)
      }
      return c.json(operationSuccessResponse('Project deleted successfully.'), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(syncProjectRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    try {
      // Service factory includes automatic existence check
      const project = await projectService.getById(projectId)
      await syncProject(project)
      return c.json(operationSuccessResponse('Project sync initiated.'), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(syncProjectStreamRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    try {
      // Service factory includes automatic existence check
      const project = await projectService.getById(projectId)

      // Set up SSE headers
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')

      return stream(c, async (streamInstance) => {
        // Create progress tracker with callback
        const progressTracker = createSyncProgressTracker({
          onProgress: async (event) => {
            // Send progress event as SSE
            const data = JSON.stringify({
              type: 'progress',
              data: event
            })
            await streamInstance.writeln(`data: ${data}`)
            await streamInstance.writeln('') // Empty line to flush
          }
        })

        try {
          // Perform sync with progress tracking
          const results = await syncProject(project, progressTracker)

          // Send final success event
          const successData = JSON.stringify({
            type: 'complete',
            data: results
          })
          await streamInstance.writeln(`data: ${successData}`)
          await streamInstance.writeln('')
        } catch (error: any) {
          // Send error event
          const errorData = JSON.stringify({
            type: 'error',
            data: {
              message: error.message || 'Sync failed',
              code: error.code || 'SYNC_ERROR'
            }
          })
          await streamInstance.writeln(`data: ${errorData}`)
          await streamInstance.writeln('')
        }
      })
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(getProjectFilesRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')
    try {
      // Service factory includes automatic existence check
      await projectService.getById(projectId)
      const files = await getProjectFiles(projectId, { limit, offset })
      return c.json(successResponse(files ?? []), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(getProjectFilesMetadataRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')
    try {
      // Service factory includes automatic existence check
      await projectService.getById(projectId)
      const files = await getProjectFiles(projectId, { limit, offset })
      // Remove content from files for performance
      const filesWithoutContent = files?.map(({ content, ...fileMetadata }: any) => fileMetadata) ?? []
      return c.json(successResponse(filesWithoutContent), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(bulkUpdateFilesRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { updates } = c.req.valid('json')

    // Update file content directly
    const updatedFiles: ProjectFile[] = []

    console.log({ projectId, updates, updatedFiles })

    for (const update of updates) {
      try {
        const updatedFile = await updateFileContent(projectId, update.fileId.toString(), update.content)
        updatedFiles.push(updatedFile)
      } catch (error) {
        console.error(`Failed to update file ${update.fileId}:`, error)
        // Continue with other files, but could also throw here if strict mode is desired
      }
    }

    return c.json(successResponse(updatedFiles), 200)
  })

  .openapi(updateFileContentRoute, async (c) => {
    const { id: projectId, fileId } = c.req.valid('param')
    const { content } = c.req.valid('json')

    const updatedFile = await updateFileContent(projectId, fileId.toString(), content)

    return c.json(successResponse(updatedFile), 200)
  })

  .openapi(refreshProjectRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { folder } = c.req.valid('query')
    try {
      // Service factory includes automatic existence check
      const project = await projectService.getById(projectId)
      if (folder) {
        await syncProjectFolder(project, folder)
      } else {
        await syncProject(project)
      }
      const files = await getProjectFiles(projectId)
      return c.json(successResponse(files ?? []), 200)
    } catch (error) {
      // ErrorFactory integration - errors are already properly formatted
      throw error
    }
  })

  .openapi(getProjectSummaryRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')

    try {
      const summary = await getFullProjectSummary(projectId)

      const payload: z.infer<typeof ProjectSummaryResponseSchema> = {
        success: true,
        summary: summary
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to generate project summary: ${error instanceof Error ? error.message : String(error)}`,
        'AI_SUMMARY_ERROR'
      )
    }
  })

  .openapi(getProjectSummaryAdvancedRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const options = c.req.valid('json')

    try {
      // Validate options
      const validatedOptions = SummaryOptionsSchema.parse(options)

      // Get summary with options
      const result = await getProjectSummaryWithOptions(projectId, validatedOptions)

      return c.json(result, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to generate advanced project summary: ${error instanceof Error ? error.message : String(error)}`,
        'AI_SUMMARY_ERROR'
      )
    }
  })

  .openapi(getProjectSummaryMetricsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')

    try {
      // Get summary with metrics enabled
      const result = await getProjectSummaryWithOptions(projectId, {
        depth: 'standard',
        format: 'xml',
        strategy: 'balanced',
        includeImports: true,
        includeExports: true,
        progressive: false,
        includeMetrics: true,
        groupAware: false,
        includeRelationships: false,
        contextWindow: 4000
      })

      if (!result.metrics) {
        throw new ApiError(500, 'Failed to generate metrics', 'METRICS_GENERATION_ERROR')
      }

      const payload = {
        success: true,
        data: {
          metrics: result.metrics,
          version: result.version
        }
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to retrieve summary metrics: ${error instanceof Error ? error.message : String(error)}`,
        'AI_METRICS_ERROR'
      )
    }
  })

  .openapi(invalidateProjectSummaryCacheRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')

    try {
      // Service factory includes automatic existence check with proper error handling
      await projectService.getById(projectId)

      invalidateProjectSummaryCache(projectId)

      const payload: z.infer<typeof OperationSuccessResponseSchema> = {
        success: true,
        message: 'Project summary cache invalidated successfully'
      }

      return c.json(payload, 200)
    } catch (error) {
      // ErrorFactory integration - if not already an API error, wrap it
      if (error instanceof ApiError) {
        throw error
      }
      throw ErrorFactory.operationFailed('cache invalidation', error instanceof Error ? error.message : String(error))
    }
  })

  // Optimize endpoint not implemented
  // .openapi(optimizeUserInputRoute, async (c) => {
  //   const { userContext, projectId } = c.req.valid('json')
  //   const optimized = 'Not implemented'
  //   const responseData = { optimizedPrompt: optimized }
  //   return c.json({ success: true, data: responseData }, 200)
  // })
  .openapi(suggestFilesRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { prompt, limit = 10 } = c.req.valid('json')

    await projectService.getById(projectId)
    const files = await projectService.suggestFiles(projectId, prompt, limit)
    return c.json({ success: true as const, data: files }, 200)
  })
  .openapi(
    createRoute({
      method: 'post',
      path: '/api/projects/{id}/files/summarize',
      tags: ['Projects', 'Files', 'AI'],
      summary: 'Summarize specified files in a project',
      request: {
        params: IDParamsSchema,
        body: {
          content: {
            'application/json': {
              schema: z.object({
                fileIds: z.array(z.string()).min(1).describe('Array of file IDs to summarize'),
                force: z
                  .boolean()
                  .optional()
                  .default(false)
                  .describe('Force re-summarization of already summarized files')
              })
            }
          }
        }
      },
      responses: createStandardResponses(
        z.object({
          success: z.literal(true),
          data: z.object({
            included: z.number(),
            skipped: z.number(),
            updatedFiles: z.array(DbFileSchema as any),
            skippedReasons: z
              .object({
                empty: z.number(),
                tooLarge: z.number(),
                errors: z.number()
              })
              .optional()
          })
        })
      )
    }),
    async (c) => {
      const { id: projectId } = c.req.valid('param')
      const { fileIds, force = false } = c.req.valid('json')

      const project = await projectService.getById(projectId)
      if (!project) {
        throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
      }

      // Pass the force parameter to summarizeFiles
      const result = await summarizeFiles(projectId, fileIds, force)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    }
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/api/projects/{id}/files/remove-summaries',
      tags: ['Projects', 'Files'],
      summary: 'Remove summaries from specified files',
      request: {
        params: IDParamsSchema,
        body: {
          content: {
            'application/json': {
              schema: z.object({
                fileIds: z.array(z.string()).min(1).describe('Array of file IDs to remove summaries from')
              })
            }
          }
        }
      },
      responses: createStandardResponses(
        z.object({
          success: z.literal(true),
          data: z.object({
            removedCount: z.number(),
            message: z.string()
          })
        })
      )
    }),
    async (c) => {
      const { id: projectId } = c.req.valid('param')
      const { fileIds } = c.req.valid('json')

      const project = await projectService.getById(projectId)
      if (!project) {
        throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
      }

      const result = await removeSummariesFromFiles(projectId, fileIds)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    }
  )
  .openapi(getProjectStatisticsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')

    const statistics = await getProjectStatistics(projectId)

    return c.json(
      {
        success: true as const,
        data: statistics
      },
      200
    )
  })
  .openapi(startBatchSummarizationRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { strategy, options } = c.req.valid('json')

    const project = await projectService.getById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    try {
      // Prepare batch options
      const batchOptions = BatchSummaryOptionsSchema.parse({
        strategy,
        ...options
      })

      // Start batch summarization (async iterator)
      const progressIterator = enhancedSummarizationService.batchSummarizeWithProgress(projectId, batchOptions)

      // Get first progress update
      const firstProgress = await progressIterator.next()
      if (firstProgress.done || !firstProgress.value) {
        throw new ApiError(500, 'Failed to start batch summarization', 'BATCH_START_ERROR')
      }

      // Store iterator for streaming updates (would need WebSocket or SSE for real-time)
      // For now, just return initial progress
      const payload = {
        success: true as const,
        data: firstProgress.value
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to start batch summarization: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_SUMMARIZATION_ERROR'
      )
    }
  })
  .openapi(getBatchProgressRoute, async (c) => {
    const { id: projectId, batchId } = c.req.valid('param')

    try {
      const progress = fileSummarizationTracker.getSummarizationProgress(projectId)

      if (!progress || progress.batchId !== batchId) {
        throw new ApiError(404, `Batch ${batchId} not found`, 'BATCH_NOT_FOUND')
      }

      const payload = {
        success: true as const,
        data: {
          batchId: progress.batchId,
          currentGroup: progress.currentGroup || 'Initializing',
          groupIndex: progress.processedGroups,
          totalGroups: progress.totalGroups,
          filesProcessed: progress.processedFiles,
          totalFiles: progress.totalFiles,
          tokensUsed: progress.estimatedTokensUsed,
          errors: progress.errors || []
        }
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to get batch progress: ${error instanceof Error ? error.message : String(error)}`,
        'GET_PROGRESS_ERROR'
      )
    }
  })
  .openapi(cancelBatchSummarizationRoute, async (c) => {
    const { id: projectId, batchId } = c.req.valid('param')

    try {
      // Cancel in tracker
      const cancelledInTracker = fileSummarizationTracker.cancelBatch(batchId)

      // Cancel in service
      const cancelledInService = enhancedSummarizationService.cancelBatch(batchId)

      if (!cancelledInTracker && !cancelledInService) {
        throw new ApiError(404, `Batch ${batchId} not found or already completed`, 'BATCH_NOT_FOUND')
      }

      const payload: z.infer<typeof OperationSuccessResponseSchema> = {
        success: true,
        message: 'Batch summarization cancelled successfully'
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to cancel batch: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_BATCH_ERROR'
      )
    }
  })
  .openapi(getSummarizationStatsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')

    const project = await projectService.getById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    try {
      const stats = await fileSummarizationTracker.getSummarizationStats(projectId)

      const normalized = {
        projectId: stats.projectId,
        totalFiles: stats.totalFiles,
        summarizedFiles: stats.summarizedFiles,
        unsummarizedFiles: stats.unsummarizedFiles,
        staleFiles: stats.staleFiles,
        failedFiles: stats.failedFiles,
        averageTokensPerFile: stats.averageTokensPerFile,
        lastBatchRun: stats.lastBatchRun,
        filesByStatus: {
          pending: (stats.filesByStatus as any).pending ?? 0,
          in_progress: (stats.filesByStatus as any).in_progress ?? 0,
          completed: (stats.filesByStatus as any).completed ?? 0,
          failed: (stats.filesByStatus as any).failed ?? 0,
          skipped: (stats.filesByStatus as any).skipped ?? 0
        }
      }

      const payload = {
        success: true as const,
        data: normalized
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to get summarization stats: ${error instanceof Error ? error.message : String(error)}`,
        'GET_STATS_ERROR'
      )
    }
  })
  .openapi(previewFileGroupsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { strategy, maxGroupSize, includeStaleFiles } = c.req.valid('json')

    const project = await projectService.getById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    try {
      // Get files to group
      const unsummarizedFiles = await fileSummarizationTracker.getUnsummarizedFiles(projectId)
      const staleFiles = includeStaleFiles ? await fileSummarizationTracker.getStaleFiles(projectId) : []

      // Combine and deduplicate
      const fileMap = new Map()
      const allFilesToGroup = [...unsummarizedFiles, ...staleFiles]
      allFilesToGroup.forEach((f) => fileMap.set(f.id, f))
      const filesToGroup = Array.from(fileMap.values())

      if (filesToGroup.length === 0) {
        const payload = {
          success: true as const,
          data: {
            groups: [],
            totalFiles: 0,
            totalGroups: 0,
            estimatedTotalTokens: 0
          }
        }
        return c.json(payload, 200)
      }

      // Group files
      const groups = await fileGroupingService.groupFilesByStrategy(filesToGroup, strategy, projectId, { maxGroupSize })

      // Estimate tokens
      let totalTokens = 0
      const groupsWithTokens = groups.map((group) => {
        const estimatedTokens = group.fileIds.reduce((sum, fileId) => {
          const file = fileMap.get(fileId)
          return sum + Math.ceil((file?.content?.length || 0) / 4)
        }, 0)
        totalTokens += estimatedTokens
        return {
          ...group,
          estimatedTokens
        }
      })

      const payload = {
        success: true as const,
        data: {
          groups: groupsWithTokens,
          totalFiles: filesToGroup.length,
          totalGroups: groups.length,
          estimatedTotalTokens: totalTokens
        }
      }

      return c.json(payload, 200)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        500,
        `Failed to preview file groups: ${error instanceof Error ? error.message : String(error)}`,
        'PREVIEW_GROUPS_ERROR'
      )
    }
  })

export type ProjectRouteTypes = typeof projectRoutes
