/**
 * MCP Configuration Routes
 * Handles MCP server configuration CRUD operations
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  MCPServerConfigSchema,
  CreateMCPServerConfigBodySchema,
  UpdateMCPServerConfigBodySchema,
  MCPServerConfigListResponseSchema,
  MCPServerConfigResponseSchema,
  ProjectIdParamsSchema
} from '@promptliano/schemas'
import {
  createMCPServerConfig,
  listMCPServerConfigs,
  getMCPServerConfigById,
  updateMCPServerConfig,
  deleteMCPServerConfig
} from '@promptliano/services'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../../utils/route-helpers'

// Parameter schemas
const MCPServerIdParamsSchema = z.object({
  serverId: z.string()
})

const ProjectMCPServerParamsSchema = ProjectIdParamsSchema.extend({
  serverId: z.string()
})

// Create MCP server config
const createMCPServerConfigRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/mcp/servers',
  tags: ['MCP', 'Configuration'],
  summary: 'Create MCP server configuration',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: CreateMCPServerConfigBodySchema.omit({ projectId: true }) } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: MCPServerConfigResponseSchema } },
      description: 'MCP server configuration created successfully'
    },
    ...createStandardResponses(MCPServerConfigResponseSchema)
  }
})

// List MCP server configs
const listMCPServerConfigsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/servers',
  tags: ['MCP', 'Configuration'],
  summary: 'List all MCP server configurations for a project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(MCPServerConfigListResponseSchema)
})

// Get MCP server config by ID
const getMCPServerConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/mcp/servers/{serverId}',
  tags: ['MCP', 'Configuration'],
  summary: 'Get MCP server configuration by ID',
  request: {
    params: ProjectMCPServerParamsSchema
  },
  responses: createStandardResponses(MCPServerConfigResponseSchema)
})

// Update MCP server config
const updateMCPServerConfigRoute = createRoute({
  method: 'patch',
  path: '/api/projects/{projectId}/mcp/servers/{serverId}',
  tags: ['MCP', 'Configuration'],
  summary: 'Update MCP server configuration',
  request: {
    params: ProjectMCPServerParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateMCPServerConfigBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(MCPServerConfigResponseSchema)
})

// Delete MCP server config
const deleteMCPServerConfigRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/mcp/servers/{serverId}',
  tags: ['MCP', 'Configuration'],
  summary: 'Delete MCP server configuration',
  request: {
    params: ProjectMCPServerParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Export routes
export const mcpConfigRoutes = new OpenAPIHono()
  .openapi(createMCPServerConfigRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const config = await createMCPServerConfig(parseInt(projectId), body)
    return c.json(successResponse(config), 201)
  })
  .openapi(listMCPServerConfigsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const configs = await listMCPServerConfigs(parseInt(projectId))
    return c.json(successResponse(configs))
  })
  .openapi(getMCPServerConfigRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    const config = await getMCPServerConfigById(parseInt(serverId))
    return c.json(successResponse(config))
  })
  .openapi(updateMCPServerConfigRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    const body = c.req.valid('json')
    const config = await updateMCPServerConfig(parseInt(serverId), body)
    return c.json(successResponse(config))
  })
  .openapi(deleteMCPServerConfigRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    await deleteMCPServerConfig(parseInt(serverId))
    return c.json(operationSuccessResponse('MCP server configuration deleted successfully'))
  })

export type MCPConfigRouteTypes = typeof mcpConfigRoutes