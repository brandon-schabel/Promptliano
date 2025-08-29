/**
 * Prompt Routes - Migrated to CRUD Factory
 * 
 * This implementation uses the CRUD factory to reduce boilerplate
 * from ~600 lines to ~150 lines (75% reduction)
 */

import { createCrudRoutes, extendCrudRoutes } from './factories/crud-routes-factory'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { promptService } from '@promptliano/services'
import { 
  PromptSchema,
  CreatePromptSchema,
  UpdatePromptSchema,
  type Prompt 
} from '@promptliano/database'
import {
  SuggestPromptsRequestSchema,
  SuggestPromptsResponseSchema,
  MarkdownImportResponseSchema,
  MarkdownExportResponseSchema,
  BatchExportRequestSchema,
  BulkImportResponseSchema
} from '@promptliano/schemas'
import {
  suggestPrompts,
  bulkImportMarkdownPrompts,
  exportPromptsToMarkdown,
  promptToMarkdown,
  validateMarkdownContent,
  listPromptsByProject
} from '@promptliano/services'
import { withErrorContext, ErrorFactory } from '@promptliano/shared'
import { successResponse, operationSuccessResponse } from '../utils/route-helpers'
import { authMiddleware } from './factories/middleware'

// File upload constants
const MARKDOWN_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_EXTENSIONS: ['.md', '.markdown'],
  ALLOWED_MIME_TYPES: ['text/markdown', 'text/x-markdown', 'text/plain']
} as const

// Transform raw DB types to proper Prompt types
function transformPromptFromDB(dbPrompt: any): Prompt {
  return {
    ...dbPrompt,
    tags: Array.isArray(dbPrompt.tags) 
      ? dbPrompt.tags.filter((tag: any): tag is string => typeof tag === 'string')
      : []
  }
}

/**
 * Create CRUD routes for prompts using the factory
 */
const promptCrudRoutes = createCrudRoutes<Prompt, any, any>({
  entityName: 'Prompt',
  path: 'api/prompts',
  tags: ['Prompts'],
  
  service: {
    list: async () => {
      const prompts = await promptService.getAll()
      return prompts.map(transformPromptFromDB)
    },
    get: async (id: number) => {
      const prompt = await promptService.get(id)
      return prompt ? transformPromptFromDB(prompt) : null
    },
    create: async (data: any) => {
      const created = await promptService.create(data)
      return transformPromptFromDB(created)
    },
    update: async (id: number, data: any) => {
      const updated = await promptService.update(id, data)
      return updated ? transformPromptFromDB(updated) : null
    },
    delete: (id: number) => promptService.delete(id),
    count: async () => {
      const all = await promptService.getAll()
      return all.length
    }
  },
  
  schemas: {
    entity: PromptSchema as unknown as z.ZodType<Prompt>,
    create: CreatePromptSchema,
    update: UpdatePromptSchema
  },
  
  options: {
    pagination: true,
    search: false, // Prompts don't have built-in search yet
    batch: false,  // Not needed for prompts
    
    middleware: {
      all: [authMiddleware({ required: false })]
    },
    
    transformResponse: {
      // Sort prompts by updated date
      list: (prompts) => prompts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    }
  }
})

/**
 * Custom routes for prompt-specific operations
 */
const promptCustomRoutes = new OpenAPIHono()

// List prompts by project
const listProjectPromptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/prompts',
  tags: ['Projects', 'Prompts'],
  summary: 'List prompts associated with a specific project',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(PromptSchema)
          })
        }
      },
      description: 'List of project prompts'
    }
  }
})

promptCustomRoutes.openapi(listProjectPromptsRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const projectPrompts = await listPromptsByProject(projectId)
  const transformedPrompts = projectPrompts.map(transformPromptFromDB)
  return c.json(successResponse(transformedPrompts))
})

// PATCH alias for update to support older clients expecting PATCH
const patchPromptRoute = createRoute({
  method: 'patch',
  path: '/api/prompts/{id}',
  tags: ['Prompts'],
  summary: 'Update Prompt (PATCH alias)',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: {
      content: { 'application/json': { schema: UpdatePromptSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true), data: PromptSchema as any })
        }
      },
      description: 'Prompt updated'
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(false), error: z.any() })
        }
      },
      description: 'Prompt not found'
    }
  }
})

promptCustomRoutes.openapi(patchPromptRoute, async (c) => {
  return withErrorContext(
    async () => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const updated = await promptService.update(id, body)
      if (!updated) {
        throw ErrorFactory.notFound('Prompt', id.toString())
      }
      return c.json(successResponse(transformPromptFromDB(updated)))
    },
    { entity: 'Prompt', action: 'updatePatch' }
  )
})

// Suggest prompts using AI
const suggestPromptsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/suggest-prompts',
  tags: ['Projects', 'Prompts', 'AI'],
  summary: 'Get AI-suggested prompts based on user input',
  description: 'Uses AI to analyze user input and suggest the most relevant prompts from the project',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: {
      content: { 'application/json': { schema: SuggestPromptsRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: SuggestPromptsResponseSchema }
      },
      description: 'Suggested prompts'
    }
  }
})

promptCustomRoutes.openapi(suggestPromptsRoute, async (c): Promise<any> => {
  const { id: projectId } = c.req.valid('param')
  const { userInput } = c.req.valid('json')
  const suggestedPrompts = await suggestPrompts(projectId, userInput)
  return c.json(successResponse({ prompts: suggestedPrompts }))
})

// Export single prompt as markdown
const exportPromptRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{promptId}/export',
  tags: ['Prompts', 'Import/Export'],
  summary: 'Export a single prompt as markdown',
  description: 'Download a prompt as a markdown file with frontmatter',
  request: {
    params: z.object({
      promptId: z.coerce.number().int().positive()
    })
  },
  responses: {
    200: {
      content: {
        'application/octet-stream': {
          schema: z.string()
        }
      },
      description: 'Markdown file content',
      headers: z.object({
        'Content-Type': z.string().default('text/plain; charset=utf-8'),
        'Content-Disposition': z.string()
      })
    }
  }
})

promptCustomRoutes.openapi(exportPromptRoute, async (c) => {
  return withErrorContext(
    async () => {
      const { promptId } = c.req.valid('param')
      const prompt = await promptService.get(promptId)
      
      if (!prompt) {
        throw new Error('Prompt not found')
      }
      
      const promptForMarkdown = transformPromptFromDB(prompt)
      
      const markdownContent = await promptToMarkdown(promptForMarkdown)
      
      const filename = `${prompt.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}.md`
      
      c.header('Content-Type', 'text/plain')
      c.header('Content-Disposition', `attachment; filename="${filename}"`)
      
      return c.body(markdownContent)
    },
    { entity: 'Prompt', action: 'export' }
  )
})

// Batch export prompts
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
  responses: {
    200: {
      content: {
        'application/json': { schema: MarkdownExportResponseSchema }
      },
      description: 'Export result'
    }
  }
})

promptCustomRoutes.openapi(exportBatchPromptsRoute, async (c) => {
  return withErrorContext(
    async () => {
      const body = c.req.valid('json')
      const { promptIds, ...options } = body
      
      // Get all requested prompts
      const prompts = await Promise.all(
        promptIds.map(async (id: number) => {
          const prompt = await promptService.get(id)
          if (!prompt) {
            throw new Error(`Prompt with ID ${id} not found`)
          }
          return transformPromptFromDB(prompt)
        })
      )
      
      const result = await exportPromptsToMarkdown(prompts, options)
      return c.json(successResponse(result))
    },
    { entity: 'Prompt', action: 'batchExport' }
  )
})

// Import prompts from markdown files
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
            files: z.any(),
            projectId: z.coerce.number().int().positive().optional(),
            overwriteExisting: z.coerce.boolean().optional().default(false)
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: BulkImportResponseSchema }
      },
      description: 'Import result'
    },
    413: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string()
          })
        }
      },
      description: 'File too large'
    }
  }
})

promptCustomRoutes.openapi(importPromptsRoute, async (c): Promise<any> => {
  return withErrorContext(
    async () => {
      const body = await c.req.formData()
      const projectId = body.get('projectId') 
        ? parseInt(body.get('projectId') as string) 
        : undefined
      const overwriteExisting = body.get('overwriteExisting') === 'true'
      
      const files: Array<{ name: string; content: string; size: number }> = []
      const fileEntries = body.getAll('files')
      
      if (!fileEntries || fileEntries.length === 0) {
        throw new Error('No files provided')
      }
      
      // Validate and process files
      const { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = MARKDOWN_UPLOAD_CONFIG
      
      for (const entry of fileEntries) {
        if (entry instanceof File) {
          // Validate file
          const fileName = entry.name.toLowerCase()
          const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))
          
          if (!hasValidExtension) {
            throw new Error(`Invalid file type: ${entry.name}. Only .md and .markdown files are allowed`)
          }
          
          if (entry.type && entry.type !== '' && !ALLOWED_MIME_TYPES.includes(entry.type as any)) {
            throw new Error(`Invalid MIME type for ${entry.name}: ${entry.type}`)
          }
          
          if (entry.size > MAX_FILE_SIZE) {
            const error = new Error(`File ${entry.name} exceeds maximum size of 10MB`)
            ;(error as any).statusCode = 413
            ;(error as any).code = 'FILE_TOO_LARGE'
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
    },
    { entity: 'Prompt', action: 'import' }
  )
})

// Validate markdown content
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
            content: z.string()
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
            data: z.any()
          })
        }
      },
      description: 'Validation result'
    }
  }
})

promptCustomRoutes.openapi(validateMarkdownRoute, async (c) => {
  return withErrorContext(
    async () => {
      const { content } = c.req.valid('json')
      const validationResult = await validateMarkdownContent(content)
      
      return c.json({
        success: true,
        data: validationResult.validation
      })
    },
    { entity: 'Prompt', action: 'validateMarkdown' }
  )
})

/**
 * Combine CRUD and custom routes
 */
export const promptRoutes = extendCrudRoutes(
  promptCrudRoutes,
  { entityName: 'Prompt', path: 'api/prompts', tags: ['Prompts'], service: {} as any, schemas: {} as any },
  promptCustomRoutes
)

export type PromptRouteTypes = typeof promptRoutes
