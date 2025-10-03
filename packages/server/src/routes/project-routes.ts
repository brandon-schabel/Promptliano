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
  SuggestFilesResponseSchema as ProjectSuggestFilesResponseSchema,
  SuggestFilesBodySchema as ProjectSuggestFilesBodySchema
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
  getProjectStatistics,
  syncProject,
  syncProjectFolder,
  watchersManager,
  getProjectFiles,
  updateFileContent,
  suggestFilesForProject
} from '@promptliano/services'
import { createFileSearchService, createSuggestionsService } from '@promptliano/services'
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

// File search schemas
const FileSearchRequestSchema = z.object({
  query: z.string().min(1),
  searchType: z.enum(['ast', 'exact', 'fuzzy', 'regex', 'semantic']).optional().default('ast'),
  fileTypes: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  includeContext: z.boolean().optional(),
  contextLines: z.number().int().min(0).max(20).optional(),
  caseSensitive: z.boolean().optional()
})

const FileSearchMatchSchema = z.object({
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  text: z.string(),
  context: z.string().optional()
})

const FileSearchResultSchema = z.object({
  file: DbFileSchema as any,
  score: z.number(),
  matches: z.array(FileSearchMatchSchema),
  snippet: z.string().optional()
})

const FileSearchResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    results: z.array(FileSearchResultSchema),
    stats: z.object({
      totalResults: z.number().int().nonnegative(),
      searchTime: z.number().int().nonnegative(),
      cached: z.boolean(),
      indexCoverage: z.number().int().nonnegative()
    })
  })
})

// Revert to version schema
const RevertToVersionBodySchema = z.object({
  versionNumber: z.number().int().positive()
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

const searchProjectFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/search',
  tags: ['Projects', 'Files'],
  summary: 'Search project files (AST-grep by default)',
  request: {
    params: IDParamsSchema,
    body: { content: { 'application/json': { schema: FileSearchRequestSchema } } }
  },
  responses: createStandardResponses(FileSearchResponseSchema)
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

// Removed: project summary routes and schemas

const suggestFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/suggest-files',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Suggest relevant files based on user input and project context',
  request: {
    params: IDParamsSchema,
    body: { content: { 'application/json': { schema: ProjectSuggestFilesBodySchema } } }
  },
  responses: createStandardResponses(ProjectSuggestFilesResponseSchema)
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
          })
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

  .openapi(searchProjectFilesRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      await projectService.getById(projectId)
      const searchService = createFileSearchService()
      const { results, stats } = await searchService.search(projectId, body as any)
      return c.json(successResponse({ results, stats }), 200)
    } catch (error) {
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

  // Removed project summary endpoints

  // Optimize endpoint not implemented
  // .openapi(optimizeUserInputRoute, async (c) => {
  //   const { userContext, projectId } = c.req.valid('json')
  //   const optimized = 'Not implemented'
  //   const responseData = { optimizedPrompt: optimized }
  //   return c.json({ success: true, data: responseData }, 200)
  // })
  .openapi(suggestFilesRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json') as z.infer<typeof ProjectSuggestFilesBodySchema>
    const limit = body.limit ?? 25
    const prompt = body.userInput ?? body.prompt ?? ''
    const strategy = body.strategy ?? 'balanced'
    const includeScores = body.includeScores ?? true
    const includeReasons = body.includeReasons ?? false // NEW: default false
    const userContext = body.userContext

    // V2 new options
    const lineCount = body.lineCount ?? 50
    const directories = body.directories
    const skipDirectorySelection = body.skipDirectorySelection ?? false

    const start = Date.now()
    await projectService.getById(projectId)

    // Use Simplified AI-Based Suggestions Service (static import)
    const result = await suggestFilesForProject(projectId, String(prompt || ''), {
      strategy: strategy as any,
      maxResults: limit,
      includeScores,
      includeReasons, // NEW: pass includeReasons to service
      userContext,
      lineCount,
      directories,
      skipDirectorySelection
    })

    // V2 response mapping - much simpler!
    // Convert V2 suggestedFiles to response format with backward compat
    const suggestedFiles = result.suggestedFiles.map((file) => ({
      path: file.path,
      relevance: file.relevance,
      // Only include reasons if they were requested (saves tokens)
      ...(includeReasons && file.reasons.length > 0
        ? {
            reason: file.reasons.join(', '), // V1 compat: join reasons
            reasons: file.reasons, // V2 format
            aiReasons: file.reasons // V1 compat
          }
        : {}),
      fileType: file.fileType,
      aiConfidence: file.confidence, // V1 compat
      confidence: file.confidence, // V2 format
      lineCount: file.lineCount,
      totalLines: file.totalLines
    }))

    const payload: z.infer<typeof ProjectSuggestFilesResponseSchema> = {
      success: true,
      data: {
        suggestedFiles,
        totalFiles: result.metadata.totalFiles,
        analyzedFiles: result.metadata.analyzedFiles,
        strategy: result.metadata.strategy,
        tokensSaved: result.metadata.tokensSaved,
        processingTime: Date.now() - start,
        recommendedFileIds: result.suggestions?.map(String),
        // V2 new metadata
        selectedDirectories: result.metadata.selectedDirectories,
        totalDirectories: result.metadata.totalDirectories,
        filesFromDirectories: result.metadata.filesFromDirectories,
        lineCountPerFile: result.metadata.lineCountPerFile,
        aiModel: result.metadata.aiModel,
        directorySelectionTime: result.metadata.directorySelectionTime,
        fileFetchTime: result.metadata.fileFetchTime,
        suggestionTime: result.metadata.suggestionTime
      }
    }

    return c.json(payload, 200)
  })
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

export type ProjectRouteTypes = typeof projectRoutes
