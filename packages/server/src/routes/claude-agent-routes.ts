import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  ProjectIdParamsSchema,
  AgentIdParamsSchema,
  CreateClaudeAgentBodySchema,
  UpdateClaudeAgentBodySchema,
  ClaudeAgentResponseSchema,
  ClaudeAgentListResponseSchema,
  SuggestAgentsRequestSchema,
  AgentSuggestionsResponseSchema,
  ExecuteClaudeCommandBodySchema,
  CommandExecutionResponseSchema
} from '@promptliano/schemas'
import {
  createAgent,
  listAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  getAgentsByProjectId,
  suggestAgents,
  getProjectById
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'

const createClaudeAgentRoute = createRoute({
  method: 'post',
  path: '/api/agents',
  tags: ['Claude Agents'],
  summary: 'Create a new Claude agent',
  request: {
    query: z.object({
      projectId: z.coerce.number().optional()
    }),
    body: {
      content: { 'application/json': { schema: CreateClaudeAgentBodySchema } },
      required: true
    }
  },
  responses: createStandardResponsesWithStatus(ClaudeAgentResponseSchema, 201, 'Agent created successfully')
})

const listAllClaudeAgentsRoute = createRoute({
  method: 'get',
  path: '/api/agents',
  tags: ['Claude Agents'],
  summary: 'List all available Claude agents',
  request: {
    query: z.object({
      projectId: z.coerce.number().optional()
    })
  },
  responses: createStandardResponses(ClaudeAgentListResponseSchema)
})

const getClaudeAgentByIdRoute = createRoute({
  method: 'get',
  path: '/api/agents/{agentId}',
  tags: ['Claude Agents'],
  summary: 'Get a specific Claude agent by its ID',
  request: {
    params: AgentIdParamsSchema,
    query: z.object({
      projectId: z.coerce.number().optional()
    })
  },
  responses: createStandardResponses(ClaudeAgentResponseSchema)
})

const updateClaudeAgentRoute = createRoute({
  method: 'patch',
  path: '/api/agents/{agentId}',
  tags: ['Claude Agents'],
  summary: "Update a Claude agent's details",
  request: {
    params: AgentIdParamsSchema,
    query: z.object({
      projectId: z.coerce.number().optional()
    }),
    body: {
      content: { 'application/json': { schema: UpdateClaudeAgentBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(ClaudeAgentResponseSchema)
})

const deleteClaudeAgentRoute = createRoute({
  method: 'delete',
  path: '/api/agents/{agentId}',
  tags: ['Claude Agents'],
  summary: 'Delete a Claude agent',
  request: {
    params: AgentIdParamsSchema,
    query: z.object({
      projectId: z.coerce.number().optional()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const listProjectClaudeAgentsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/agents',
  tags: ['Projects', 'Claude Agents'],
  summary: 'List Claude agents associated with a specific project',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() })
  },
  responses: createStandardResponses(ClaudeAgentListResponseSchema)
})

const suggestClaudeAgentsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/suggest-agents',
  tags: ['Projects', 'Claude Agents', 'AI'],
  summary: 'Get AI-suggested Claude agents based on user input',
  description: 'Uses AI to analyze user input and suggest the most relevant agents for the task',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: {
      content: { 'application/json': { schema: SuggestAgentsRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(AgentSuggestionsResponseSchema)
})

export const claudeAgentRoutes = new OpenAPIHono<{}>()
  .openapi(createClaudeAgentRoute, async (c): Promise<any> => {
    const body = c.req.valid('json')
    const { projectId } = c.req.valid('query')

    const effectiveProjectId = projectId
    if (!effectiveProjectId) {
      throw new ApiError(400, 'projectId is required either in query or body', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(effectiveProjectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    // Create service instance with project context
    const { createClaudeAgentService } = await import('@promptliano/services')
    const agentService = createClaudeAgentService({ projectPath: project.path })

    const createdAgent = await agentService.create(body)
    return c.json(successResponse(createdAgent), 201)
  })
  .openapi(listAllClaudeAgentsRoute, async (c) => {
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const agents = await listAgents()
    return c.json(successResponse(agents))
  })
  .openapi(getClaudeAgentByIdRoute, async (c) => {
    const { id: agentId } = c.req.valid('param')
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const agent = await getAgentById(agentId)
    return c.json(successResponse(agent))
  })
  .openapi(updateClaudeAgentRoute, async (c) => {
    const { id: agentId } = c.req.valid('param')
    const body = c.req.valid('json')
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const updatedAgent = await updateAgent(agentId, body)
    return c.json(successResponse(updatedAgent))
  })
  .openapi(deleteClaudeAgentRoute, async (c) => {
    const { id: agentId } = c.req.valid('param')
    const { projectId } = c.req.valid('query')

    if (!projectId) {
      throw new ApiError(400, 'projectId query parameter is required', 'PROJECT_ID_REQUIRED')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    await deleteAgent(agentId)
    return c.json(operationSuccessResponse('Agent deleted successfully.'))
  })
  .openapi(listProjectClaudeAgentsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }
    // Use listAgents to read all agents from the project's .claude/agents directory
    const agents = await listAgents()
    return c.json(successResponse(agents))
  })
  .openapi(suggestClaudeAgentsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { userContext, limit } = c.req.valid('json')
    const suggestedAgents = await suggestAgents(projectId, userContext, limit)
    return c.json(successResponse(suggestedAgents))
  })

export type ClaudeAgentRouteTypes = typeof claudeAgentRoutes
