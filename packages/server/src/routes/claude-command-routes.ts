import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  ProjectIdParamsSchema,
  CommandNameParamsSchema,
  CreateClaudeCommandBodySchema,
  UpdateClaudeCommandBodySchema,
  ExecuteClaudeCommandBodySchema,
  ClaudeCommandResponseSchema,
  ClaudeCommandListResponseSchema,
  CommandSuggestionsResponseSchema,
  CommandExecutionResponseSchema,
  SearchCommandsQuerySchema,
  CommandGenerationRequestSchema,
  CommandGenerationResponseSchema
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
import { ApiError } from '@promptliano/shared'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  successResponse,
  operationSuccessResponse,
  withErrorHandling
} from '../utils/route-helpers'
import type { Context } from 'hono'

const createClaudeCommandRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands',
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

const listClaudeCommandsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/commands',
  tags: ['Claude Commands'],
  summary: 'List Claude commands for a project',
  request: {
    params: ProjectIdParamsSchema,
    query: SearchCommandsQuerySchema
  },
  responses: createStandardResponses(ClaudeCommandListResponseSchema)
})

const getClaudeCommandRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Get a specific Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    })
  },
  responses: createStandardResponses(ClaudeCommandResponseSchema)
})

const updateClaudeCommandRoute = createRoute({
  method: 'put',
  path: '/api/projects/{projectId}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Update a Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
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

const deleteClaudeCommandRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/commands/{commandName}',
  tags: ['Claude Commands'],
  summary: 'Delete a Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
      commandName: z.string()
    }),
    query: z.object({
      namespace: z.string().optional()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const executeClaudeCommandRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands/{commandName}/execute',
  tags: ['Claude Commands'],
  summary: 'Execute a Claude command',
  request: {
    params: z.object({
      projectId: z.coerce.number(),
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

const generateClaudeCommandRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands/generate',
  tags: ['Claude Commands'],
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

const suggestClaudeCommandsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/commands/suggest',
  tags: ['Claude Commands'],
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

export const claudeCommandRoutes = new OpenAPIHono()
  .openapi(createClaudeCommandRoute, withErrorHandling(async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const project = await getProjectById(Number(projectId))
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    const command = await createCommand(Number(projectId), body)
    return c.json(successResponse(command), 201)
  }))
  .openapi(listClaudeCommandsRoute, withErrorHandling(async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')

    const project = await getProjectById(Number(projectId))
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    const commands = await listCommands(Number(projectId), query)
    return c.json(successResponse(commands))
  }))
  .openapi(getClaudeCommandRoute, withErrorHandling(async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')

    const project = await getProjectById(Number(projectId))
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    const command = await getCommandByName(Number(projectId), commandName)
    return c.json(successResponse(command))
  }))
  .openapi(updateClaudeCommandRoute, withErrorHandling(async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')
    const body = c.req.valid('json')

    const project = await getProjectById(Number(projectId))
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    const command = await updateCommand(Number(projectId), commandName, body)
    return c.json(successResponse(command))
  }))
  .openapi(deleteClaudeCommandRoute, withErrorHandling(async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')

    const project = await getProjectById(Number(projectId))
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    await deleteCommand(Number(projectId), commandName)
    return c.json(operationSuccessResponse('Command deleted successfully'))
  }))
  .openapi(executeClaudeCommandRoute, withErrorHandling(async (c) => {
    const { projectId, commandName } = c.req.valid('param')
    const { namespace } = c.req.valid('query')
    const body = c.req.valid('json')

    const project = await getProjectById(Number(projectId))
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    const result = await executeCommand(Number(projectId), commandName, body?.arguments)

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
  }))
  .openapi(generateClaudeCommandRoute, withErrorHandling(async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const generatedCommand = await generateCommand(Number(projectId), body)
    return c.json(successResponse(generatedCommand))
  }))
  .openapi(suggestClaudeCommandsRoute, withErrorHandling(async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    const suggestions = await suggestCommands(Number(projectId), body?.context || '', body?.limit || 5)
    return c.json(successResponse(suggestions))
  }))
