/**
 * MCP Execution Routes
 * Provides minimal endpoints for listing and invoking MCP tools/resources.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  MCPToolExecutionRequestSchema,
  MCPToolExecutionResultResponseSchema,
  MCPResourceListResponseSchema
} from '@promptliano/schemas'
import { listMCPTools, executeMCPTool, listMCPResources, readMCPResource } from '@promptliano/services'
import { createStandardResponses, successResponse } from '../../utils/route-helpers'

// List MCP tools
const listMCPToolsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/tools',
  tags: ['MCP', 'Tools'],
  summary: 'List available MCP tools',
  request: {
    query: z.object({
      serverId: z.string().optional()
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          serverId: z.string().optional()
        })
      )
    })
  )
})

// Execute MCP tool
const executeMCPToolRoute = createRoute({
  method: 'post',
  path: '/api/mcp/tools/execute',
  tags: ['MCP', 'Tools'],
  summary: 'Execute an MCP tool',
  request: {
    body: {
      content: { 'application/json': { schema: MCPToolExecutionRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(MCPToolExecutionResultResponseSchema)
})

// List MCP resources
const listMCPResourcesRoute = createRoute({
  method: 'get',
  path: '/api/mcp/resources',
  tags: ['MCP', 'Resources'],
  summary: 'List available MCP resources',
  request: {
    query: z.object({
      serverId: z.string().optional()
    })
  },
  responses: createStandardResponses(MCPResourceListResponseSchema)
})

// Read MCP resource
const readMCPResourceRoute = createRoute({
  method: 'post',
  path: '/api/mcp/resources/read',
  tags: ['MCP', 'Resources'],
  summary: 'Read MCP resource content',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            uri: z.string(),
            serverId: z.string().optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        uri: z.string(),
        name: z.string(),
        description: z.string(),
        mimeType: z.string(),
        content: z.any()
      })
    })
  )
})

export const mcpExecutionRoutes = new OpenAPIHono()
  .openapi(listMCPToolsRoute, async (c): Promise<any> => {
    c.req.valid('query')
    const tools = await listMCPTools(1)
    return c.json(successResponse(tools))
  })
  .openapi(executeMCPToolRoute, async (c): Promise<any> => {
    const body = c.req.valid('json')
    const result = await executeMCPTool(
      1, // TODO: projectId
      body
    )
    return c.json(successResponse(result))
  })
  .openapi(listMCPResourcesRoute, async (c): Promise<any> => {
    c.req.valid('query')
    const resources = await listMCPResources(1)
    return c.json(successResponse(resources))
  })
  .openapi(readMCPResourceRoute, async (c): Promise<any> => {
    const body = c.req.valid('json')
    const content = await readMCPResource(
      1, // TODO: projectId
      parseInt(body.serverId || '1'),
      body.uri
    )
    return c.json(successResponse(content))
  })

export type MCPExecutionRouteTypes = typeof mcpExecutionRoutes
