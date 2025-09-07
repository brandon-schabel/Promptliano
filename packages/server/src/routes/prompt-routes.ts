import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'
import {
  CreatePromptBodySchema,
  UpdatePromptBodySchema,
  PromptIdParamsSchema,
  ProjectAndPromptIdParamsSchema,
  IDParamsSchema,
  PromptResponseSchema,
  PromptListResponseSchema,
  SuggestPromptsRequestSchema,
  SuggestPromptsResponseSchema,
  MarkdownImportRequestSchema,
  MarkdownImportResponseSchema,
  BulkImportResponseSchema,
  MarkdownExportResponseSchema,
  BatchExportRequestSchema,
  MarkdownContentValidationSchema
} from '@promptliano/schemas'
import {
  addPromptToProject,
  createPrompt,
  deletePrompt,
  getPromptById,
  listAllPrompts,
  listPromptsByProject,
  removePromptFromProject,
  updatePrompt,
  suggestPrompts,
  bulkImportMarkdownPrompts,
  exportPromptsToMarkdown,
  promptToMarkdown,
  validateMarkdownContent
} from '@promptliano/services'

// File upload constants for markdown imports
const MARKDOWN_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_EXTENSIONS: ['.md', '.markdown'],
  ALLOWED_MIME_TYPES: ['text/markdown', 'text/x-markdown', 'text/plain']
} as const

// All manual routes normalized to {id}; use ProjectIdParamsSchema

const createPromptRoute = createRoute({
  method: 'post',
  path: '/api/prompts',
  tags: ['Prompts'],
  summary: 'Create a new prompt',
  request: {
    body: {
      content: { 'application/json': { schema: CreatePromptBodySchema } },
      required: true
    }
  },
  responses: createStandardResponsesWithStatus(PromptResponseSchema, 201, 'Prompt created successfully')
})

const listAllPromptsRoute = createRoute({
  method: 'get',
  path: '/api/prompts',
  tags: ['Prompts'],
  summary: 'List all available prompts',
  responses: createStandardResponses(PromptListResponseSchema)
})

const listProjectPromptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/prompts',
  tags: ['Projects', 'Prompts'],
  summary: 'List prompts associated with a specific project',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(PromptListResponseSchema)
})

const suggestPromptsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/suggest-prompts',
  tags: ['Projects', 'Prompts', 'AI'],
  summary: 'Get AI-suggested prompts based on user input',
  description: 'Uses AI to analyze user input and suggest the most relevant prompts from the project',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: SuggestPromptsRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(SuggestPromptsResponseSchema)
})

const addPromptToProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/prompts/{promptId}',
  tags: ['Projects', 'Prompts'],
  summary: 'Associate a prompt with a project',
  request: {
    params: z.object({ id: IDParamsSchema.shape.id, promptId: z.coerce.number().int().positive() })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const removePromptFromProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}/prompts/{promptId}',
  tags: ['Projects', 'Prompts'],
  summary: 'Disassociate a prompt from a project',
  request: {
    params: z.object({ id: IDParamsSchema.shape.id, promptId: z.coerce.number().int().positive() })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const getPromptByIdRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: 'Get a specific prompt by its ID',
  request: {
    params: PromptIdParamsSchema
  },
  responses: createStandardResponses(PromptResponseSchema)
})

const updatePromptRoute = createRoute({
  method: 'patch',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: "Update a prompt's details",
  request: {
    params: PromptIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdatePromptBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(PromptResponseSchema)
})

const deletePromptRoute = createRoute({
  method: 'delete',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: 'Delete a prompt',
  request: {
    params: PromptIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Markdown Import/Export Routes
const importPromptsRoute = createRoute({
  method: 'post',
  path: '/api/prompts/import',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Import prompts from markdown files',
  description: 'Upload and import one or more markdown files containing prompts with frontmatter',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            files: z
              .union([
                z.any().openapi({ type: 'string', format: 'binary' }),
                z.array(z.any()).openapi({ type: 'array', items: { type: 'string', format: 'binary' } })
              ])
              .openapi({
                description: 'Markdown file(s) to import (max 10MB per file)'
              }),
            projectId: z.coerce.number().int().positive().optional().openapi({
              description: 'Optional project ID to associate imported prompts with'
            }),
            overwriteExisting: z.coerce.boolean().optional().default(false).openapi({
              description: 'Whether to overwrite existing prompts with the same name'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    ...createStandardResponses(BulkImportResponseSchema),
    413: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'File too large'
    }
  }
})

const exportPromptRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{promptId}/export',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Export a single prompt as markdown',
  description: 'Download a prompt as a markdown file with frontmatter',
  request: {
    params: PromptIdParamsSchema
  },
  responses: {
    200: {
      content: {
        'application/octet-stream': {
          schema: z.string().openapi({
            type: 'string',
            format: 'binary',
            description: 'Markdown file content'
          })
        }
      },
      description: 'Prompt exported successfully',
      headers: z.object({
        'Content-Type': z.string().default('text/plain; charset=utf-8'),
        'Content-Disposition': z.string()
      })
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const exportBatchPromptsRoute = createRoute({
  method: 'post',
  path: '/api/prompts/export-batch',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Export multiple prompts as markdown',
  description: 'Export multiple prompts to markdown format',
  request: {
    body: {
      content: { 'application/json': { schema: BatchExportRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(MarkdownExportResponseSchema)
})

const importProjectPromptsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/prompts/import',
  tags: ['Projects', 'Prompts', 'Import/Export'],
  summary: 'Import prompts to a specific project',
  description: 'Upload and import markdown files with prompts directly to a project',
  request: {
    params: IDParamsSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            files: z
              .union([
                z.any().openapi({ type: 'string', format: 'binary' }),
                z.array(z.any()).openapi({ type: 'array', items: { type: 'string', format: 'binary' } })
              ])
              .openapi({
                description: 'Markdown file(s) to import (max 10MB per file)'
              }),
            overwriteExisting: z.coerce.boolean().optional().default(false).openapi({
              description: 'Whether to overwrite existing prompts with the same name'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    ...createStandardResponses(BulkImportResponseSchema),
    413: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'File too large'
    }
  }
})

const exportAllProjectPromptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/prompts/export',
  tags: ['Projects', 'Prompts', 'Import/Export'],
  summary: 'Export all prompts from a project',
  description: 'Download all prompts from a project as markdown file(s)',
  request: {
    params: IDParamsSchema,
    query: z.object({
      format: z.enum(['single-file', 'multi-file']).optional().default('single-file').openapi({
        description: 'Export format'
      }),
      sortBy: z.enum(['name', 'created', 'updated']).optional().default('name').openapi({
        description: 'Sort order for prompts'
      }),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc').openapi({
        description: 'Sort direction'
      })
    })
  },
  responses: createStandardResponses(MarkdownExportResponseSchema)
})

const validateMarkdownRoute = createRoute({
  method: 'post',
  path: '/api/prompts/validate-markdown',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Validate markdown content for prompt import',
  description: 'Validates markdown content structure and frontmatter for prompt import',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.string().openapi({
              description: 'Markdown content to validate'
            })
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: MarkdownContentValidationSchema
    })
  )
})

export const promptRoutes = new OpenAPIHono()
  .openapi(createPromptRoute, (async (c: Context) => {
    const body = (c.req as any).valid('json')
    const promptData = {
      title: body.title,
      content: body.content,
      projectId: body.projectId
    }
    const createdPrompt = await createPrompt(promptData)
    return c.json(successResponse(createdPrompt), 201)
  }) as any)
  .openapi(listAllPromptsRoute, async (c) => {
    return c.json(successResponse(await listAllPrompts()))
  })
  .openapi(listProjectPromptsRoute, async (c) => {
    const { id: projectId } = (c.req as any).valid('param')
    const projectPrompts = await listPromptsByProject(projectId)
    return c.json(successResponse(projectPrompts))
  })
  .openapi(suggestPromptsRoute, async (c) => {
    const { id: projectId } = (c.req as any).valid('param')
    const { userInput, limit } = c.req.valid('json')
    const suggestedPrompts = await suggestPrompts(projectId, userInput)
    return c.json(successResponse({ prompts: suggestedPrompts }))
  })

  .openapi(addPromptToProjectRoute, async (c) => {
    const { promptId, id: projectId } = c.req.valid('param')
    await addPromptToProject(promptId, projectId)
    return c.json(operationSuccessResponse('Prompt linked to project.'))
  })
  .openapi(removePromptFromProjectRoute, async (c) => {
    const { promptId, id: projectId } = c.req.valid('param')
    await removePromptFromProject(promptId)
    return c.json(operationSuccessResponse('Prompt unlinked from project.'))
  })
  .openapi(getPromptByIdRoute, async (c) => {
    const { id: promptId } = c.req.valid('param')
    const prompt = await getPromptById(promptId)
    return c.json(successResponse(prompt))
  })
  .openapi(updatePromptRoute, async (c) => {
    const { id: promptId } = c.req.valid('param')
    const body = (c.req as any).valid('json')
    const updatedPrompt = await updatePrompt(promptId, body)
    return c.json(successResponse(updatedPrompt))
  })
  .openapi(deletePromptRoute, async (c) => {
    const { id: promptId } = c.req.valid('param')
    if (!deletePrompt) {
      throw new Error('Delete prompt function not available')
    }
    const deleted = await deletePrompt(promptId)
    if (!deleted) {
      throw new Error('Failed to delete prompt')
    }
    return c.json(operationSuccessResponse('Prompt deleted successfully.'))
  })

  // Markdown Import/Export Handlers
  .openapi(importPromptsRoute, (async (c: Context) => {
    const body = await c.req.formData()
    const projectId = body.get('projectId') ? parseInt(body.get('projectId') as string) : undefined
    const overwriteExisting = body.get('overwriteExisting') === 'true'

    const files: Array<{ name: string; content: string; size: number }> = []

    // Handle both single file and multiple files
    const fileEntries = body.getAll('files')
    if (!fileEntries || fileEntries.length === 0) {
      throw new Error('No files provided')
    }

    // Validate file types and size
    const { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = MARKDOWN_UPLOAD_CONFIG

    for (const entry of fileEntries) {
      if (entry instanceof File) {
        // Validate file extension
        const fileName = entry.name.toLowerCase()
        const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))

        if (!hasValidExtension) {
          throw new Error(`Invalid file type: ${entry.name}. Only .md and .markdown files are allowed`)
        }

        // Validate MIME type if available
        if (entry.type && entry.type !== '' && !ALLOWED_MIME_TYPES.includes(entry.type as any)) {
          throw new Error(`Invalid MIME type for ${entry.name}: ${entry.type}. Expected markdown or plain text`)
        }

        // Validate file size - throw error which will be handled by middleware
        if (entry.size > MAX_FILE_SIZE) {
          const error = new Error(`File ${entry.name} exceeds maximum size of 10MB`)
            ; (error as any).statusCode = 413
            ; (error as any).code = 'FILE_TOO_LARGE'
          throw error
        }

        const content = await entry.text()
        files.push({
          name: entry.name,
          content,
          size: entry.size
        })
      }
    }

    if (files.length === 0) {
      throw new Error('No valid markdown files found')
    }

    const result = await bulkImportMarkdownPrompts(files, projectId)
    return c.json(successResponse(result))
  }) as any)

  .openapi(exportPromptRoute, async (c) => {
    const { id: promptId } = c.req.valid('param')
    const prompt = await getPromptById(promptId)
    // Ensure tags are properly typed for the promptToMarkdown function
    const promptForMarkdown = {
      ...prompt,
      tags: Array.isArray(prompt.tags) ? prompt.tags.filter((tag): tag is string => typeof tag === 'string') : []
    }
    const markdownContent = await promptToMarkdown(promptForMarkdown)

    const filename = `${prompt.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')}.md`

    c.header('Content-Type', 'text/plain')
    c.header('Content-Disposition', `attachment; filename="${filename}"`)

    return c.body(markdownContent)
  })

  .openapi(exportBatchPromptsRoute, async (c) => {
    const body = (c.req as any).valid('json')
    const { promptIds, ...options } = body

    // Get all requested prompts
    const prompts = await Promise.all(
      promptIds.map(async (id: number) => {
        try {
          return await getPromptById(id)
        } catch (error) {
          throw new Error(`Prompt with ID ${id} not found`)
        }
      })
    )

    const result = await exportPromptsToMarkdown(prompts, options)
    return c.json(successResponse(result))
  })

  .openapi(importProjectPromptsRoute, (async (c: Context) => {
    const { id: projectId } = (c.req as any).valid('param')
    const body = await c.req.formData()
    const overwriteExisting = body.get('overwriteExisting') === 'true'

    const files: Array<{ name: string; content: string; size: number }> = []

    // Handle both single file and multiple files
    const fileEntries = body.getAll('files')
    if (!fileEntries || fileEntries.length === 0) {
      throw new Error('No files provided')
    }

    // Validate file types and size
    const { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = MARKDOWN_UPLOAD_CONFIG

    for (const entry of fileEntries) {
      if (entry instanceof File) {
        // Validate file extension
        const fileName = entry.name.toLowerCase()
        const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))

        if (!hasValidExtension) {
          throw new Error(`Invalid file type: ${entry.name}. Only .md and .markdown files are allowed`)
        }

        // Validate MIME type if available
        if (entry.type && entry.type !== '' && !ALLOWED_MIME_TYPES.includes(entry.type as any)) {
          throw new Error(`Invalid MIME type for ${entry.name}: ${entry.type}. Expected markdown or plain text`)
        }

        // Validate file size - throw error which will be handled by middleware
        if (entry.size > MAX_FILE_SIZE) {
          const error = new Error(`File ${entry.name} exceeds maximum size of 10MB`)
            ; (error as any).statusCode = 413
            ; (error as any).code = 'FILE_TOO_LARGE'
          throw error
        }

        const content = await entry.text()
        files.push({
          name: entry.name,
          content,
          size: entry.size
        })
      }
    }

    if (files.length === 0) {
      throw new Error('No valid markdown files found')
    }

    const result = await bulkImportMarkdownPrompts(files, projectId)
    return c.json(successResponse(result))
  }) as any)

  .openapi(exportAllProjectPromptsRoute, async (c) => {
    const { id: projectId } = (c.req as any).valid('param')
    const { format, sortBy, sortOrder } = c.req.valid('query')

    const projectPrompts = await listPromptsByProject(projectId)

    if (projectPrompts.length === 0) {
      const result = {
        success: true,
        format: format || ('single-file' as const),
        promptCount: 0,
        fileName: 'no-prompts.md',
        content: '# No Prompts Found\n\nThis project has no prompts to export.',
        metadata: {
          exportedAt: new Date().toISOString(),
          totalSize: 0,
          settings: {
            format: format || ('single-file' as const),
            includeFrontmatter: true,
            includeCreatedDate: true,
            includeUpdatedDate: true,
            includeTags: true,
            sanitizeContent: true,
            sortBy: sortBy || ('name' as const),
            sortOrder: sortOrder || ('asc' as const)
          }
        }
      }
      return c.json(successResponse(result))
    }

    const result = await exportPromptsToMarkdown(projectPrompts, {
      format,
      sortBy,
      sortOrder
    })

    return c.json(successResponse(result))
  })

  .openapi(validateMarkdownRoute, async (c) => {
    const { content } = c.req.valid('json')
    const validationResult = await validateMarkdownContent(content)

    return c.json(
      {
        success: true,
        data: validationResult.validation
      },
      200
    )
  })

// Manual routes - basic CRUD operations
const getPromptByIdBasicRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{id}',
  tags: ['Prompts'],
  summary: 'Get a prompt by ID (basic)',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({
        param: {
          name: 'id',
          in: 'path'
        },
        example: '1'
      })
    })
  },
  responses: createStandardResponses(PromptResponseSchema)
})

const updatePromptByIdBasicRoute = createRoute({
  method: 'put',
  path: '/api/prompts/{id}',
  tags: ['Prompts'],
  summary: 'Update a prompt by ID (basic)',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({
        param: {
          name: 'id',
          in: 'path'
        },
        example: '1'
      })
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePromptBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(PromptResponseSchema)
})

const deletePromptByIdBasicRoute = createRoute({
  method: 'delete',
  path: '/api/prompts/{id}',
  tags: ['Prompts'],
  summary: 'Delete a prompt by ID (basic)',
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({
        param: {
          name: 'id',
          in: 'path'
        },
        example: '1'
      })
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

promptRoutes
  .openapi(getPromptByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const prompt = await getPromptById(id)

    if (!prompt) {
      return c.json({ error: 'Prompt not found' }, 404)
    }

    return c.json({ data: prompt }, 200)
  })
  .openapi(updatePromptByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const prompt = await updatePrompt(id, data)

    if (!prompt) {
      return c.json({ error: 'Prompt not found' }, 404)
    }

    return c.json({ data: prompt }, 200)
  })
  .openapi(deletePromptByIdBasicRoute, async (c) => {
    const { id } = c.req.valid('param')
    const success = await deletePrompt(id)

    if (!success) {
      return c.json({ error: 'Prompt not found' }, 404)
    }

    return c.json({ success: true, message: 'Prompt deleted successfully' }, 200)
  })

export type PromptRouteTypes = typeof promptRoutes
