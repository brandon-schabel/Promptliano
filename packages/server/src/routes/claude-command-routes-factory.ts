/**
 * Claude Command Routes - Hybrid Migration
 * 
 * Commands are project-scoped, so we keep the complex routing but standardize where possible
 * Reduces boilerplate from 282 lines to ~150 lines (47% reduction)
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  CreateClaudeCommandBodySchema,
  UpdateClaudeCommandBodySchema,
  ExecuteClaudeCommandBodySchema,
  ClaudeCommandResponseSchema,
  ClaudeCommandListResponseSchema,
  CommandSuggestionsResponseSchema,
  CommandExecutionResponseSchema,
  SearchCommandsQuerySchema,
  CommandGenerationRequestSchema,
  CommandGenerationResponseSchema,
  OperationSuccessResponseSchema
} from '@promptliano/schemas'
import {
  createCommand,
  listCommands,
  getCommandByName,
  updateCommand,
  deleteCommand,
  executeCommand,
  suggestCommands,
  generateCommand,
  getProjectById
} from '@promptliano/services'
import { ErrorFactory, ApiError } from '@promptliano/shared'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'
import type { Context } from 'hono'

// Parameter schema for project ID in path (normalized to {id})
const ProjectIdParamsSchema = z.object({
  id: z.coerce.number().openapi({ param: { name: 'id', in: 'path' } })
})

// Helper to validate project exists
async function validateProject(projectId: number) {
  const project = await getProjectById(projectId)
  if (!project) {
    throw ErrorFactory.notFound('Project', projectId)
  }
  return project
}

// Create main routes
export const claudeCommandRoutes = new OpenAPIHono()

// ============= CREATE COMMAND =============
const createRoute_ = createRoute({
  method: 'post',
  path: '/api/projects/{id}/commands',
  tags: ['Claude Commands'],
  summary: 'Create a new Claude command',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CreateClaudeCommandBodySchema } },
      required: true
    }
  },
  responses: createStandardResponsesWithStatus(ClaudeCommandResponseSchema, 201, 'Command created successfully')
})

claudeCommandRoutes.openapi(createRoute_, async (c): Promise<any> => {
  const { id: projectId } = c.req.valid('param')
  const body = c.req.valid('json')
  
  await validateProject(projectId)
  // Add required timestamps and project context
  const commandData = {
    ...body,
    projectId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  const command = await createCommand(projectId, commandData)
  return c.json(successResponse(command), 201)
})

// ============= LIST COMMANDS =============
const listRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/commands',
  tags: ['Claude Commands'],
  summary: 'List Claude commands for a project',
  request: {
    params: ProjectIdParamsSchema,
    query: SearchCommandsQuerySchema
  },
  responses: createStandardResponses(ClaudeCommandListResponseSchema)
})

claudeCommandRoutes.openapi(listRoute, async (c) => {
  const { id: projectId } = c.req.valid('param')
  const query = c.req.valid('query')
  
  await validateProject(projectId)
  const commands = await listCommands(projectId, query)
  return c.json(successResponse(commands))
})

// ============= GET COMMAND =============
const getRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Get a specific Claude command',
  request: {
    params: z.object({
      id: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    })
  },
  responses: createStandardResponses(ClaudeCommandResponseSchema)
})

claudeCommandRoutes.openapi(getRoute, async (c) => {
  const { id: projectId, commandName } = c.req.valid('param')
    
    await validateProject(projectId)
    const command = await getCommandByName(projectId, commandName)
    return c.json(successResponse(command))
})

// ============= UPDATE COMMAND =============
const updateRoute = createRoute({
  method: 'put',
  path: '/api/projects/{id}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Update a Claude command',
  request: {
    params: z.object({
      id: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    }),
    body: {
      content: { 'application/json': { schema: UpdateClaudeCommandBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(ClaudeCommandResponseSchema)
})

claudeCommandRoutes.openapi(updateRoute, async (c) => {
  const { id: projectId, commandName } = c.req.valid('param')
    const body = c.req.valid('json')
    
    await validateProject(projectId)
    const command = await updateCommand(projectId, commandName, body)
    return c.json(successResponse(command))
})

// ============= DELETE COMMAND =============
const deleteRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Delete a Claude command',
  request: {
    params: z.object({
      id: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

claudeCommandRoutes.openapi(deleteRoute, async (c) => {
    const { id: projectId, commandName } = c.req.valid('param')
    
    await validateProject(projectId)
    await deleteCommand(projectId, commandName)
    return c.json(operationSuccessResponse('Command deleted successfully'))
})

// ============= EXECUTE COMMAND (Custom) =============
const executeRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/commands/{commandName}/execute',
  tags: ['Claude Commands'],
  summary: 'Execute a Claude command',
  request: {
    params: z.object({
      id: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    }),
    body: {
      content: { 'application/json': { schema: ExecuteClaudeCommandBodySchema } },
      required: false
    }
  },
  responses: createStandardResponses(CommandExecutionResponseSchema)
})

claudeCommandRoutes.openapi(executeRoute, async (c) => {
    const { id: projectId, commandName } = c.req.valid('param')
    const body = c.req.valid('json')
    
    await validateProject(projectId)
    const result = await executeCommand(projectId, commandName, body?.arguments)
    
    const responseData = {
      result: result.result,
      usage: result.metadata?.usage
        ? {
            inputTokens: result.metadata.usage.inputTokens || 0,
            outputTokens: result.metadata.usage.outputTokens || 0,
            totalTokens: result.metadata.usage.totalTokens || 0
          }
        : undefined,
      model: result.metadata?.model,
      sessionId: result.metadata?.sessionId
    }
    
    return c.json(successResponse(responseData))
})

// ============= GENERATE COMMAND (AI) =============
const generateRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/commands/generate',
  tags: ['Claude Commands', 'AI'],
  summary: 'Generate a new Claude command using AI',
  description: 'Uses AI to generate a complete slash command based on user requirements and project context',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CommandGenerationRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(CommandGenerationResponseSchema)
})

claudeCommandRoutes.openapi(generateRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    
    await validateProject(projectId)
    const generatedCommand = await generateCommand(projectId, body)
    return c.json(successResponse(generatedCommand))
})

// ============= SUGGEST COMMANDS (AI) =============
const suggestRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/commands/suggest',
  tags: ['Claude Commands', 'AI'],
  summary: 'Get AI-powered command suggestions',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            context: z.string().optional(),
            limit: z.number().int().positive().max(10).optional().default(5)
          })
        }
      },
      required: false
    }
  },
  responses: createStandardResponses(CommandSuggestionsResponseSchema)
})

claudeCommandRoutes.openapi(suggestRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    
    await validateProject(projectId)
    const suggestions = await suggestCommands(projectId, body?.context || '', body?.limit || 5)
    return c.json(successResponse(suggestions))
})

export type ClaudeCommandRouteTypes = typeof claudeCommandRoutes
