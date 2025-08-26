import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  HookApiResponseSchema,
  HookListResponseSchema,
  CreateHookRequestSchema,
  UpdateHookRequestSchema,
  HookEventSchema,
  HookGenerationRequestSchema,
  HookGenerationResponseSchema,
  HookTestRequestSchema,
  HookTestResponseSchema
} from '@promptliano/schemas'
import { claudeHookService, type HookEvent } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'

// Mapping function between schema event names and service event names
function mapSchemaEventToServiceEvent(schemaEvent: string): HookEvent {
  const mapping: Record<string, HookEvent> = {
    'tool-call': 'PreToolUse',
    'user-prompt-submit': 'UserPromptSubmit',
    'file-change': 'Notification'
  }

  const mapped = mapping[schemaEvent]
  if (!mapped) {
    throw new Error(`Unknown event type: ${schemaEvent}`)
  }
  return mapped
}

// Parameter schemas
const ProjectPathParamsSchema = z
  .object({
    projectPath: z.string().openapi({
      param: { name: 'projectPath', in: 'path' },
      description: 'Project directory path (URL encoded)'
    })
  })
  .openapi('ProjectPathParams')

const HookParamsSchema = z
  .object({
    projectPath: z.string().openapi({
      param: { name: 'projectPath', in: 'path' },
      description: 'Project directory path (URL encoded)'
    }),
    eventName: HookEventSchema.openapi({
      param: { name: 'eventName', in: 'path' },
      description: 'Hook event name'
    }),
    matcherIndex: z.coerce
      .number()
      .int()
      .min(0)
      .openapi({
        param: { name: 'matcherIndex', in: 'path' },
        description: 'Index of the matcher group'
      })
  })
  .openapi('HookParams')

// Query schemas
const SearchQuerySchema = z
  .object({
    q: z
      .string()
      .optional()
      .openapi({
        param: { name: 'q', in: 'query' },
        description: 'Search query for hooks'
      })
  })
  .openapi('SearchQuery')

// Helper function to decode project path
const decodeProjectPath = (encodedPath: string): string => {
  try {
    return decodeURIComponent(encodedPath)
  } catch (error) {
    throw new ApiError(400, 'Invalid project path encoding')
  }
}

// Routes
const listHooksRoute = createRoute({
  method: 'get',
  path: '/api/claude-hooks/{projectPath}',
  tags: ['Claude Hooks'],
  summary: 'List all hooks for a project',
  description: 'Retrieves all Claude Code hooks configured for the specified project path',
  request: {
    params: ProjectPathParamsSchema
  },
  responses: createStandardResponses(HookListResponseSchema)
})

const getHookRoute = createRoute({
  method: 'get',
  path: '/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}',
  tags: ['Claude Hooks'],
  summary: 'Get specific hook configuration',
  description: 'Retrieves a specific hook by its event name and matcher index',
  request: {
    params: HookParamsSchema
  },
  responses: createStandardResponses(HookApiResponseSchema)
})

const createHookRoute = createRoute({
  method: 'post',
  path: '/api/claude-hooks/{projectPath}',
  tags: ['Claude Hooks'],
  summary: 'Create new hook',
  description: 'Creates a new Claude Code hook configuration',
  request: {
    params: ProjectPathParamsSchema,
    body: { content: { 'application/json': { schema: CreateHookRequestSchema } } }
  },
  responses: {
    201: {
      content: {
        'application/json': { schema: HookApiResponseSchema }
      },
      description: 'Hook created successfully'
    },
    400: {
      content: {
        'application/json': { schema: ApiErrorResponseSchema }
      },
      description: 'Bad Request'
    },
    404: {
      content: {
        'application/json': { schema: ApiErrorResponseSchema }
      },
      description: 'Resource Not Found'
    },
    422: {
      content: {
        'application/json': { schema: ApiErrorResponseSchema }
      },
      description: 'Validation Error'
    },
    500: {
      content: {
        'application/json': { schema: ApiErrorResponseSchema }
      },
      description: 'Internal Server Error'
    }
  }
})

const updateHookRoute = createRoute({
  method: 'put',
  path: '/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}',
  tags: ['Claude Hooks'],
  summary: 'Update hook configuration',
  description: 'Updates an existing Claude Code hook configuration',
  request: {
    params: HookParamsSchema,
    body: { content: { 'application/json': { schema: UpdateHookRequestSchema.partial() } } }
  },
  responses: createStandardResponses(HookApiResponseSchema)
})

const deleteHookRoute = createRoute({
  method: 'delete',
  path: '/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}',
  tags: ['Claude Hooks'],
  summary: 'Delete hook configuration',
  description: 'Deletes an existing Claude Code hook configuration',
  request: {
    params: HookParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const generateHookRoute = createRoute({
  method: 'post',
  path: '/api/claude-hooks/{projectPath}/generate',
  tags: ['Claude Hooks', 'AI'],
  summary: 'Generate hook from description',
  description: 'Uses AI to generate a hook configuration from a natural language description',
  request: {
    params: ProjectPathParamsSchema,
    body: { content: { 'application/json': { schema: HookGenerationRequestSchema } } }
  },
  responses: createStandardResponses(HookGenerationResponseSchema)
})

const testHookRoute = createRoute({
  method: 'post',
  path: '/api/claude-hooks/{projectPath}/test',
  tags: ['Claude Hooks'],
  summary: 'Test hook (placeholder)',
  description: 'Note: Claude Code handles actual hook execution. This endpoint returns a message.',
  request: {
    params: ProjectPathParamsSchema,
    body: { content: { 'application/json': { schema: HookTestRequestSchema } } }
  },
  responses: createStandardResponses(HookTestResponseSchema)
})

const searchHooksRoute = createRoute({
  method: 'get',
  path: '/api/claude-hooks/{projectPath}/search',
  tags: ['Claude Hooks'],
  summary: 'Search hooks',
  description: 'Searches hooks by command, matcher, event name',
  request: {
    params: ProjectPathParamsSchema,
    query: SearchQuerySchema
  },
  responses: createStandardResponses(HookListResponseSchema)
})

export const claudeHookRoutesSimple = new OpenAPIHono()
  .openapi(listHooksRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      // Convert project path to project ID (for now, use a mock project ID since we don't have path resolution)
      // TODO: Implement proper project path to ID resolution
      const projectId = 1754713756748 // Mock project ID
      const hooks = await claudeHookService.listHooks(projectId)

      return c.json(successResponse(hooks))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to list hooks: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_HOOKS_FAILED'
      )
    }
  })
  .openapi(getHookRoute, async (c) => {
    const { projectPath, eventName, matcherIndex } = c.req.valid('param')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      // For now, use legacy method since the new service doesn't support this signature yet
      const mappedEvent = mapSchemaEventToServiceEvent(eventName)
      const hook = await claudeHookService.getHookLegacy(decodedPath, mappedEvent, matcherIndex)

      if (!hook) {
        throw new ApiError(404, `Hook not found for event ${eventName} at index ${matcherIndex}`)
      }

      return c.json(successResponse(hook))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get hook: ${error instanceof Error ? error.message : String(error)}`,
        'GET_HOOK_FAILED'
      )
    }
  })
  .openapi(createHookRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const body = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      // For now, use legacy method since the new service expects projectId
      // Map schema body to service request format
      const serviceRequest = {
        event: mapSchemaEventToServiceEvent(body.event),
        matcher: body.name, // Use name as matcher for now
        command: body.command,
        timeout: 30000 // Default timeout
      }
      const hook = await claudeHookService.createHookLegacy(decodedPath, serviceRequest)

      // Transform HookListItem to expected response format
      const responseData = {
        id: Math.floor(Math.random() * 1000000), // Generate temporary ID
        projectId: 1754713756748, // Mock project ID
        name: body.name,
        event: body.event,
        command: hook.command,
        enabled: body.enabled ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      return c.json({ success: true, data: responseData } satisfies z.infer<typeof HookApiResponseSchema>, 201)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to create hook: ${error instanceof Error ? error.message : String(error)}`,
        'CREATE_HOOK_FAILED'
      )
    }
  })
  .openapi(updateHookRoute, async (c) => {
    const { projectPath, eventName, matcherIndex } = c.req.valid('param')
    const body = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const mappedEvent = mapSchemaEventToServiceEvent(eventName)
      // Transform body to match service interface
      const serviceBody: Partial<{ event: HookEvent; matcher: string; command: string; timeout: number }> = {}

      if (body.event) {
        serviceBody.event = mapSchemaEventToServiceEvent(body.event)
      }
      if (body.name) {
        serviceBody.matcher = body.name // Map name to matcher
      }
      if (body.command) {
        serviceBody.command = body.command
      }

      const hook = await claudeHookService.updateHookLegacy(decodedPath, mappedEvent, matcherIndex, serviceBody)

      if (!hook) {
        throw new ApiError(404, `Hook not found for event ${eventName} at index ${matcherIndex}`)
      }

      return c.json(successResponse(hook))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to update hook: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE_HOOK_FAILED'
      )
    }
  })
  .openapi(deleteHookRoute, async (c) => {
    const { projectPath, eventName, matcherIndex } = c.req.valid('param')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const mappedEvent = mapSchemaEventToServiceEvent(eventName)
      const success = await claudeHookService.deleteHookLegacy(decodedPath, mappedEvent, matcherIndex)

      if (!success) {
        throw new ApiError(404, `Hook not found for event ${eventName} at index ${matcherIndex}`)
      }

      return c.json(operationSuccessResponse('Hook deleted successfully'))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to delete hook: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_HOOK_FAILED'
      )
    }
  })
  .openapi(generateHookRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const { description } = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const generatedHook = await claudeHookService.generateHookFromDescription(description, {
        projectId: 1754713756748 // Mock project ID
      })

      return c.json(successResponse(generatedHook))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to generate hook: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATE_HOOK_FAILED'
      )
    }
  })
  .openapi(testHookRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const body = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      // Test hook using mock hookId since service expects hookId, not path/event/matcher
      // TODO: Implement proper hook resolution from path/event/matcher to hookId
      const mockHookId = 1
      // Get sampleToolName from testData if available
      const sampleToolName = body.testData?.sampleToolName
      const result = await claudeHookService.testHook(mockHookId, sampleToolName)

      return c.json(successResponse(result))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to test hook: ${error instanceof Error ? error.message : String(error)}`,
        'TEST_HOOK_FAILED'
      )
    }
  })
  .openapi(searchHooksRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const { q } = c.req.valid('query')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const projectId = 1754713756748 // Mock project ID
      const hooks = await claudeHookService.searchHooks(projectId, q || '')

      return c.json(successResponse(hooks))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to search hooks: ${error instanceof Error ? error.message : String(error)}`,
        'SEARCH_HOOKS_FAILED'
      )
    }
  })

export type ClaudeHookRouteTypes = typeof claudeHookRoutesSimple
