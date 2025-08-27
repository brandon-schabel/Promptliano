/**
 * Project Routes using Hybrid Factory Pattern
 * 
 * Combines standard CRUD operations with complex project management
 * Reduces boilerplate from 1297 lines to ~600 lines (54% reduction)
 * Keeps complex operations (sync, streaming, summarization) manual
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createCrudRoutes } from './factories/crud-routes-factory'
import { projectService } from '@promptliano/services'
import { ErrorFactory, ApiError } from '@promptliano/shared'
import {
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema
} from '@promptliano/database'
import {
  ProjectIdParamsSchema,
  FileListResponseSchema,
  ProjectSummaryResponseSchema,
  OperationSuccessResponseSchema,
  ApiErrorResponseSchema,
  ProjectResponseMultiStatusSchema
} from '@promptliano/schemas'
import {
  createStandardResponses,
  successResponse,
  operationSuccessResponse,
  withErrorHandling
} from '../utils/route-helpers'

// Complex operations imports
import { stream } from 'hono/streaming'
import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { homedir as getHomedir } from 'node:os'
import { createSyncProgressTracker } from '@promptliano/services/src/utils/sync-progress-tracker'
import {
  getFullProjectSummary,
  getProjectStatistics,
  syncProject,
  syncProjectFolder,
  watchersManager,
  getProjectFiles,
  updateFileContent,
  summarizeFiles
} from '@promptliano/services'

// ============= CRUD ROUTES WITH FACTORY =============
const crudRoutes = createCrudRoutes({
  entityName: 'Project',
  path: 'api/projects',
  tags: ['Projects'],
  service: projectService,
  schemas: {
    entity: ProjectSchema,
    create: CreateProjectSchema,
    update: UpdateProjectSchema
  },
  options: {
    // Disable create route as we need custom path normalization
    disableCreate: true,
    // Keep other CRUD operations
    disableList: false,
    disableGet: false,
    disableUpdate: false,
    disableDelete: false
  }
})

// ============= CUSTOM ROUTES FOR COMPLEX OPERATIONS =============
const customRoutes = new OpenAPIHono()

// Custom Create with Path Normalization
const createProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'Create a new project and sync its files',
  request: {
    body: { 
      content: { 
        'application/json': { 
          schema: CreateProjectSchema 
        } 
      },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project created and initial sync started'
    },
    207: {
      content: { 'application/json': { schema: ProjectResponseMultiStatusSchema } },
      description: 'Project created, but post-creation steps encountered issues'
    },
    422: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Validation Error' 
    },
    500: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Internal Server Error' 
    }
  }
})

customRoutes.openapi(createProjectRoute, withErrorHandling(async (c) => {
  const body = c.req.valid('json')
  
  // Path normalization
  let normalizedPath = body.path
  if (normalizedPath.startsWith('~')) {
    normalizedPath = normalizedPath.replace(/^~/, getHomedir())
  }
  normalizedPath = resolvePath(normalizedPath)
  
  const projectData = { ...body, path: normalizedPath }
  const createdProject = await projectService.create(projectData)
  
  let syncWarning: string | undefined
  let syncError: string | undefined
  let httpStatus: 201 | 207 = 201

  try {
    if (!existsSync(createdProject.path)) {
      syncWarning = 'Project created but directory does not exist. No files will be synced.'
      httpStatus = 207
    } else {
      await syncProject(createdProject)
      await watchersManager.startWatchingProject(createdProject, [
        'node_modules',
        'dist',
        '.git',
        '*.tmp',
        '*.db-journal'
      ])
    }
  } catch (error: any) {
    syncError = `Post-creation setup failed: ${String(error)}`
    httpStatus = 207
  }

  if (httpStatus === 201) {
    return c.json(createdProject satisfies z.infer<typeof ProjectSchema>, 201)
  } else {
    return c.json({
      success: true,
      data: createdProject,
      ...(syncWarning && { warning: syncWarning }),
      ...(syncError && { error: syncError })
    } satisfies z.infer<typeof ProjectResponseMultiStatusSchema>, 207)
  }
}))

// Custom Delete with Watcher Cleanup
const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Delete a project and its associated data',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

customRoutes.openapi(deleteProjectRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  
  const deleted = await projectService.deleteCascade(projectId)
  if (deleted) {
    watchersManager.stopWatchingProject(projectId)
  }
  
  return c.json(operationSuccessResponse('Project deleted successfully'))
}))

// ============= SYNC OPERATIONS =============
const syncProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/sync',
  tags: ['Projects', 'Files'],
  summary: 'Manually trigger a full file sync for a project',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

customRoutes.openapi(syncProjectRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  const project = await projectService.getById(projectId)
  await syncProject(project)
  return c.json(operationSuccessResponse('Project sync initiated.'))
}))

// Streaming sync endpoint
const syncProjectStreamRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/sync-stream',
  tags: ['Projects', 'Files'],
  summary: 'Trigger a file sync with real-time progress updates via SSE',
  request: { params: ProjectIdParamsSchema },
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
    404: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Project not found' 
    },
    500: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Internal Server Error' 
    }
  }
})

customRoutes.openapi(syncProjectStreamRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  const project = await projectService.getById(projectId)

  // Set up SSE headers
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  return stream(c, async (streamInstance) => {
    const progressTracker = createSyncProgressTracker({
      onProgress: async (event) => {
        const data = JSON.stringify({
          type: 'progress',
          data: event
        })
        await streamInstance.writeln(`data: ${data}`)
        await streamInstance.writeln('')
      }
    })

    try {
      const results = await syncProject(project, progressTracker)
      
      const successData = JSON.stringify({
        type: 'complete',
        data: results
      })
      await streamInstance.writeln(`data: ${successData}`)
      await streamInstance.writeln('')
    } catch (error: any) {
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
}))

// ============= FILE OPERATIONS =============
const getProjectFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/files',
  tags: ['Projects', 'Files'],
  summary: 'Get the list of files associated with a project',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      includeAllVersions: z.coerce.boolean().optional().default(false),
      limit: z.coerce.number().int().positive().optional(),
      offset: z.coerce.number().int().nonnegative().optional().default(0)
    })
  },
  responses: createStandardResponses(FileListResponseSchema)
})

customRoutes.openapi(getProjectFilesRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')
  
  await projectService.getById(projectId)
  const files = await getProjectFiles(projectId, { limit, offset })
  return c.json(successResponse(files ?? []))
}))

// ============= AI SUMMARIZATION =============
const getProjectSummaryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/summary',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get a combined summary of all files in the project',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(ProjectSummaryResponseSchema)
})

customRoutes.openapi(getProjectSummaryRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  
  try {
    const summary = await getFullProjectSummary(projectId)
    return c.json({
      success: true,
      summary: summary
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw ErrorFactory.operationFailed(
      'generate project summary',
      error instanceof Error ? error.message : String(error)
    )
  }
}))

// File summarization
const summarizeFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/files/summarize',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Summarize specified files in a project',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            fileIds: z.array(z.string()).min(1),
            force: z.boolean().optional().default(false)
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      included: z.number(),
      skipped: z.number(),
      updatedFiles: z.array(z.any()),
      skippedReasons: z.object({
        empty: z.number(),
        tooLarge: z.number(),
        errors: z.number()
      }).optional()
    })
  }))
})

customRoutes.openapi(summarizeFilesRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  const { fileIds, force = false } = c.req.valid('json')

  await projectService.getById(projectId)
  const result = await summarizeFiles(projectId, fileIds, force)
  
  return c.json(successResponse(result))
}))

// ============= PROJECT STATISTICS =============
const getProjectStatisticsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/statistics',
  tags: ['Projects', 'Statistics'],
  summary: 'Get comprehensive statistics for a project',
  request: { params: ProjectIdParamsSchema },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.any() // Complex statistics object
  }))
})

customRoutes.openapi(getProjectStatisticsRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  const statistics = await getProjectStatistics(projectId)
  return c.json(successResponse(statistics))
}))

// ============= REFRESH PROJECT =============
const refreshProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/refresh',
  tags: ['Projects', 'Files'],
  summary: 'Refresh project files (sync) optionally limited to a folder',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      folder: z.string().optional()
    })
  },
  responses: createStandardResponses(FileListResponseSchema)
})

customRoutes.openapi(refreshProjectRoute, withErrorHandling(async (c) => {
  const { projectId } = c.req.valid('param')
  const { folder } = c.req.valid('query')
  
  const project = await projectService.getById(projectId)
  if (folder) {
    await syncProjectFolder(project, folder)
  } else {
    await syncProject(project)
  }
  
  const files = await getProjectFiles(projectId)
  return c.json(successResponse(files ?? []))
}))

// ============= UPDATE FILE CONTENT =============
const updateFileContentRoute = createRoute({
  method: 'put',
  path: '/api/projects/{projectId}/files/{fileId}',
  tags: ['Projects', 'Files'],
  summary: 'Update the content of a specific file',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      fileId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.string()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.any())
})

customRoutes.openapi(updateFileContentRoute, withErrorHandling(async (c) => {
  const { projectId, fileId } = c.req.valid('param')
  const { content } = c.req.valid('json')
  
  const updatedFile = await updateFileContent(projectId, fileId.toString(), content)
  return c.json(successResponse(updatedFile))
}))

// Combine factory routes with custom routes
export const projectRoutes = new OpenAPIHono()
  .route('/', crudRoutes)
  .route('/', customRoutes)

export type ProjectRouteTypes = typeof projectRoutes