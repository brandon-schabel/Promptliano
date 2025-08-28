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
  ProjectIdParamsSchema,
  type MCPServerConfig
} from '@promptliano/schemas'
import {
  createMCPServerConfig,
  listMCPServerConfigs,
  getMCPServerConfigById,
  updateMCPServerConfig,
  deleteMCPServerConfig
} from '@promptliano/services'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../../utils/route-helpers'
import type { McpServerConfig, InsertMcpServerConfig } from '@promptliano/database'

// Transform database model to API model
function transformMcpServerConfig(config: McpServerConfig): MCPServerConfig {
  return {
    id: config.id,
    projectId: config.projectId,
    name: config.name,
    command: config.command,
    args: config.args || [],
    env: config.env || {},
    enabled: config.enabled,
    autoStart: config.autoStart,
    created: config.createdAt,
    updated: config.updatedAt
  }
}

// Transform API request body to database-compatible structure
function transformCreateRequestBody(body: any): Omit<InsertMcpServerConfig, 'projectId'> {
  return {
    name: body.name,
    command: body.command,
    args: body.args,
    env: body.env,
    enabled: body.enabled ?? true,
    autoStart: body.autoStart ?? false,
    // These will be overridden by the service, but need to be present for type compatibility
    createdAt: 0,
    updatedAt: 0
  }
}

// Transform API request body for updates
function transformUpdateRequestBody(body: any): Partial<InsertMcpServerConfig> {
  const result: any = {}
  if (body.name !== undefined) result.name = body.name
  if (body.command !== undefined) result.command = body.command
  if (body.args !== undefined) result.args = body.args
  if (body.env !== undefined) result.env = body.env
  if (body.enabled !== undefined) result.enabled = body.enabled
  if (body.autoStart !== undefined) result.autoStart = body.autoStart
  // Note: updatedAt will be set by the service
  return result
}

// Parameter schemas
const MCPServerIdParamsSchema = z.object({
  serverId: z.coerce.number().int().positive()
})

const ProjectMCPServerParamsSchema = ProjectIdParamsSchema.extend({
  serverId: z.coerce.number().int().positive()
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
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const transformedBody = transformCreateRequestBody(body)
    const config = await createMCPServerConfig(projectId, transformedBody)
    return c.json(successResponse(transformMcpServerConfig(config)), 201)
  })
  .openapi(listMCPServerConfigsRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const configs = await listMCPServerConfigs(projectId)
    return c.json(successResponse(configs.map(transformMcpServerConfig)))
  })
  .openapi(getMCPServerConfigRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    const config = await getMCPServerConfigById(serverId)
    return c.json(successResponse(transformMcpServerConfig(config)))
  })
  .openapi(updateMCPServerConfigRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    const body = c.req.valid('json')
    const transformedBody = transformUpdateRequestBody(body)
    const config = await updateMCPServerConfig(serverId, transformedBody)
    return c.json(successResponse(transformMcpServerConfig(config)))
  })
  .openapi(deleteMCPServerConfigRoute, async (c) => {
    const { serverId } = c.req.valid('param')
    await deleteMCPServerConfig(serverId)
    return c.json(operationSuccessResponse('MCP server configuration deleted successfully'))
  })

export type MCPConfigRouteTypes = typeof mcpConfigRoutes
