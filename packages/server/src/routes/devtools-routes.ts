import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import { ErrorFactory } from '@promptliano/shared'
import { McpInspectorSessionResponseSchema } from '@promptliano/schemas/src/devtools.schemas'
import { getMcpInspectorSession } from '@promptliano/services/src/devtools-service'

const getInspectorSessionRoute = createRoute({
  method: 'get',
  path: '/api/devtools/mcp-inspector/session',
  responses: createStandardResponses(McpInspectorSessionResponseSchema),
  tags: ['DevTools'],
  summary: 'Get the current MCP Inspector session token and helper URLs',
  operationId: 'getMcpInspectorSession'
})

export const devtoolsRoutes = new OpenAPIHono()
  .openapi(getInspectorSessionRoute, async (c) => {
    try {
      const session = await getMcpInspectorSession()
      return c.json(successResponse(session), 200) as any
    } catch (error) {
      throw ErrorFactory.wrap(error, 'Failed to read MCP Inspector session')
    }
  })
