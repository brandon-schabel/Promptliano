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
import { ProjectFileSchema } from '@promptliano/schemas'

// ============= CRUD ROUTES WITH FACTORY (PARTIAL) =============
// We create separate CRUD routes for list, get, and update
// Create and Delete are custom due to special requirements

// Separate CRUD app for the operations we want to use
const partialCrudRoutes = createCrudRoutes({
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
    // Standard CRUD operations without custom requirements
    pagination: false,
    search: false,
    batch: false,
    // Disable create and delete routes since we have custom implementations
    disableRoutes: {
      create: true,  // Custom create route with path normalization
      delete: true   // Custom delete route with watcher cleanup
    }
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

customRoutes.openapi(createProjectRoute, async (c) => {
  try {
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
  } catch (error) {
    console.error('Create project error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to create project' 
      } 
    }, 500)
  }
})

// Custom Delete with Watcher Cleanup
const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: 'Delete a project and its associated data',
  request: { 
    params: z.object({ id: z.coerce.number().int().positive() })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Project deleted successfully'
    },
    400: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Bad Request' 
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

customRoutes.openapi(deleteProjectRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
  
  const deleted = await projectService.deleteCascade(id)
  if (deleted) {
    watchersManager.stopWatchingProject(id)
  }
  
  return c.json(operationSuccessResponse('Project deleted successfully'), 200)
  } catch (error) {
    console.error('Delete project error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to delete project' 
      } 
    }, 500)
  }
})

// ============= SYNC OPERATIONS =============
const syncProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/sync',
  tags: ['Projects', 'Files'],
  summary: 'Manually trigger a full file sync for a project',
  request: { 
    params: z.object({ id: z.coerce.number().int().positive() })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Project sync initiated successfully'
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

customRoutes.openapi(syncProjectRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
  const project = await projectService.getById(id)
  await syncProject(project)
  return c.json(operationSuccessResponse('Project sync initiated.'), 200)
  } catch (error) {
    console.error('Sync project error:', error) 
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to sync project' 
      } 
    }, 500)
  }
})

// Streaming sync endpoint
const syncProjectStreamRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/sync-stream',
  tags: ['Projects', 'Files'],
  summary: 'Trigger a file sync with real-time progress updates via SSE',
  request: { 
    params: z.object({ id: z.coerce.number().int().positive() })
  },
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

customRoutes.openapi(syncProjectStreamRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
  const project = await projectService.getById(id)

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
  } catch (error) {
    console.error('Sync stream error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to start sync stream' 
      } 
    }, 500)
  }
})

// ============= FILE OPERATIONS =============
const getProjectFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/files',
  tags: ['Projects', 'Files'],
  summary: 'Get the list of files associated with a project',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    query: z.object({
      includeAllVersions: z.coerce.boolean().optional().default(false),
      limit: z.coerce.number().int().positive().optional(),
      offset: z.coerce.number().int().nonnegative().optional().default(0)
    })
  },
  responses: {
    200: {
      content: { 
        'application/json': { 
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()) // File structure from service layer
          })
        } 
      },
      description: 'Files retrieved successfully'
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

customRoutes.openapi(getProjectFilesRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')
  
  await projectService.getById(id)
  const files = await getProjectFiles(id, { limit, offset })
  return c.json(successResponse(files ?? []), 200)
  } catch (error) {
    console.error('Get project files error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to get project files' 
      } 
    }, 500)
  }
})

// ============= AI SUMMARIZATION =============
const getProjectSummaryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/summary',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Get a combined summary of all files in the project',
  request: { 
    params: z.object({ id: z.coerce.number().int().positive() })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSummaryResponseSchema } },
      description: 'Project summary retrieved successfully'
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

customRoutes.openapi(getProjectSummaryRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    
    const summary = await getFullProjectSummary(id)
    return c.json({
      success: true,
      summary: summary
    }, 200)
  } catch (error) {
    console.error('Get project summary error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to get project summary' 
      } 
    }, 500)
  }
})

// File summarization
const summarizeFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/files/summarize',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Summarize specified files in a project',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
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
  responses: {
    200: {
      content: { 
        'application/json': { 
          schema: z.object({
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
          })
        } 
      },
      description: 'Files summarized successfully'
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

customRoutes.openapi(summarizeFilesRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const { fileIds, force = false } = c.req.valid('json')

  await projectService.getById(id)
  const result = await summarizeFiles(id, fileIds, force)
  
  return c.json(successResponse(result), 200)
  } catch (error) {
    console.error('Summarize files error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to summarize files' 
      } 
    }, 500)
  }
})

// ============= PROJECT STATISTICS =============
const getProjectStatisticsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/statistics',
  tags: ['Projects', 'Statistics'],
  summary: 'Get comprehensive statistics for a project',
  request: { 
    params: z.object({ id: z.coerce.number().int().positive() })
  },
  responses: {
    200: {
      content: { 
        'application/json': { 
          schema: z.object({
            success: z.literal(true),
            data: z.any() // Complex statistics object
          })
        } 
      },
      description: 'Project statistics retrieved successfully'
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

customRoutes.openapi(getProjectStatisticsRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
  const statistics = await getProjectStatistics(id)
  return c.json(successResponse(statistics), 200)
  } catch (error) {
    console.error('Get project statistics error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to get project statistics' 
      } 
    }, 500)
  }
})

// ============= REFRESH PROJECT =============
const refreshProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/refresh',
  tags: ['Projects', 'Files'],
  summary: 'Refresh project files (sync) optionally limited to a folder',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    query: z.object({
      folder: z.string().optional()
    })
  },
  responses: {
    200: {
      content: { 
        'application/json': { 
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()) // File structure from service layer
          })
        } 
      },
      description: 'Project refreshed successfully'
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

customRoutes.openapi(refreshProjectRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const { folder } = c.req.valid('query')
  
  const project = await projectService.getById(id)
  if (folder) {
    await syncProjectFolder(project, folder)
  } else {
    await syncProject(project)
  }
  
  const files = await getProjectFiles(id)
  return c.json(successResponse(files ?? []), 200)
  } catch (error) {
    console.error('Refresh project error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to refresh project' 
      } 
    }, 500)
  }
})

// ============= UPDATE FILE CONTENT =============
const updateFileContentRoute = createRoute({
  method: 'put',
  path: '/api/projects/{id}/files/{fileId}',
  tags: ['Projects', 'Files'],
  summary: 'Update the content of a specific file',
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
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
  responses: {
    200: {
      content: { 'application/json': { schema: z.any() } },
      description: 'File content updated successfully'
    },
    404: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Project or file not found' 
    },
    500: { 
      content: { 'application/json': { schema: ApiErrorResponseSchema } }, 
      description: 'Internal Server Error' 
    }
  }
})

customRoutes.openapi(updateFileContentRoute, async (c) => {
  try {
    const { id, fileId } = c.req.valid('param')
    const { content } = c.req.valid('json')
  
  const updatedFile = await updateFileContent(id, fileId.toString(), content)
  return c.json(successResponse(updatedFile), 200)
  } catch (error) {
    console.error('Update file content error:', error)
    if (error instanceof ApiError) {
      return c.json({ 
        success: false as const, 
        error: { 
          message: error.message, 
          code: error.code 
        } 
      }, error.status as any)
    }
    return c.json({ 
      success: false as const, 
      error: { 
        message: 'Failed to update file content' 
      } 
    }, 500)
  }
})

// ============= SUGGEST FILES (PROJECT-SCOPED) =============
const suggestFilesRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/suggest-files',
  tags: ['Projects', 'Files', 'AI'],
  summary: 'Suggest relevant files based on user input and project context',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              prompt: z.string().min(1).optional(),
              userInput: z.string().min(1).optional(),
              limit: z.number().int().positive().optional().default(10)
            })
            .refine((v) => !!(v.prompt || v.userInput), {
              message: 'Either prompt or userInput is required'
            })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.array(ProjectFileSchema) }) } },
      description: 'Suggested files returned successfully'
    },
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  }
})

customRoutes.openapi(suggestFilesRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const prompt = (body as any).prompt || (body as any).userInput
    const limit = (body as any).limit ?? 10

    // Verify project exists via service call (throws if not found)
    await projectService.getById(id)

    const files = await projectService.suggestFiles(id, prompt, limit)
    
    // Transform database File objects to ProjectFile API objects
    const transformedFiles = files.map(file => {
      // Create a numeric ID from the string path ID for API consistency
      const numericId = Math.abs(file.id.split('').reduce((hash, char) => 
        ((hash << 5) - hash) + char.charCodeAt(0), 0
      ))
      
      return {
        id: numericId,
        projectId: file.projectId,
        name: file.name,
        path: file.path,
        extension: file.extension,
        size: file.size,
        lastModified: file.lastModified,
        contentType: file.contentType,
        content: file.content,
        summary: file.summary,
        summaryLastUpdated: file.summaryLastUpdated,
        meta: file.meta,
        checksum: file.checksum,
        imports: file.imports,
        exports: file.exports,
        isRelevant: file.isRelevant,
        relevanceScore: file.relevanceScore,
        created: file.createdAt,
        updated: file.updatedAt
      }
    })
    
    return c.json({ success: true as const, data: transformedFiles }, 200)
  } catch (error) {
    console.error('Suggest files error:', error)
    if (error instanceof ApiError) {
      return c.json({ success: false as const, error: { message: error.message, code: error.code } }, error.status as any)
    }
    return c.json({ success: false as const, error: { message: 'Failed to suggest files' } }, 500)
  }
})

// Combine factory routes with custom routes  
// Note: Custom create and delete routes override the factory ones
export const projectRoutes = new OpenAPIHono()
  .route('/', partialCrudRoutes)
  .route('/', customRoutes)

export type ProjectRouteTypes = typeof projectRoutes
