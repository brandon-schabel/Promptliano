/**
 * MCP Configuration Routes using Factory Pattern
 * 
 * Consolidates global and project MCP configuration routes
 * Reduces boilerplate from ~600 lines to ~300 lines (50% reduction)
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  mcpInstallationService,
  mcpGlobalConfigService,
  mcpProjectConfigService,
  ProjectMCPConfigSchema,
  type GlobalMCPConfig,
  type GlobalInstallationRecord
} from '@promptliano/services'
import { ErrorFactory, ApiError } from '@promptliano/shared'
import {
  createStandardResponses,
  successResponse,
  operationSuccessResponse,
  withErrorHandling
} from '../utils/route-helpers'
import { ProjectIdParamsSchema } from '@promptliano/schemas'

// ============= SHARED SCHEMAS =============
const GlobalMCPConfigSchema = z.object({
  servers: z.record(
    z.object({
      type: z.enum(['stdio', 'http']).default('stdio'),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      timeout: z.number().optional()
    })
  ),
  defaultServerUrl: z.string().default('http://localhost:3147/api/mcp'),
  debugMode: z.boolean().default(false),
  defaultTimeout: z.number().optional(),
  globalEnv: z.record(z.string()).optional()
})

const GlobalInstallationRecordSchema = z.object({
  tool: z.string(),
  installedAt: z.number(),
  configPath: z.string(),
  serverName: z.string(),
  version: z.string().optional()
})

const ToolOptionsSchema = z.enum([
  'claude-desktop', 
  'vscode', 
  'cursor', 
  'continue', 
  'claude-code', 
  'windsurf'
])

// ============= GLOBAL CONFIG ROUTES =============
export const mcpGlobalConfigRoutes = new OpenAPIHono()

// Get global config
const getGlobalConfigRoute = createRoute({
  method: 'get',
  path: '/api/mcp/global/config',
  tags: ['MCP Global'],
  summary: 'Get global MCP configuration',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: GlobalMCPConfigSchema
  }))
})

mcpGlobalConfigRoutes.openapi(getGlobalConfigRoute, withErrorHandling(async (c) => {
  await mcpGlobalConfigService.initialize()
  const config = await mcpGlobalConfigService.getGlobalConfig()
  return c.json(successResponse(config))
}))

// Update global config
const updateGlobalConfigRoute = createRoute({
  method: 'post',
  path: '/api/mcp/global/config',
  tags: ['MCP Global'],
  summary: 'Update global MCP configuration',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            defaultServerUrl: z.string().optional(),
            debugMode: z.boolean().optional(),
            defaultTimeout: z.number().optional(),
            globalEnv: z.record(z.string()).optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: GlobalMCPConfigSchema
  }))
})

mcpGlobalConfigRoutes.openapi(updateGlobalConfigRoute, withErrorHandling(async (c) => {
  const updates = await c.req.json()
  await mcpGlobalConfigService.initialize()
  const updatedConfig = await mcpGlobalConfigService.updateGlobalConfig(updates)
  return c.json(successResponse(updatedConfig))
}))

// Get installations
const getGlobalInstallationsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/global/installations',
  tags: ['MCP Global'],
  summary: 'Get all global MCP installations',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      installations: z.array(GlobalInstallationRecordSchema),
      toolStatuses: z.array(z.object({
        tool: z.string(),
        name: z.string(),
        installed: z.boolean(),
        hasGlobalPromptliano: z.boolean(),
        configPath: z.string().optional()
      }))
    })
  }))
})

mcpGlobalConfigRoutes.openapi(getGlobalInstallationsRoute, withErrorHandling(async (c) => {
  await mcpGlobalConfigService.initialize()
  const installations = await mcpGlobalConfigService.getGlobalInstallations()
  const toolStatuses = await mcpInstallationService.detectGlobalInstallations()
  
  return c.json(successResponse({
    installations,
    toolStatuses: toolStatuses.map((tool) => ({
      tool: tool.tool,
      name: tool.name,
      installed: tool.installed,
      hasGlobalPromptliano: tool.hasPromptliano || false,
      configPath: tool.configPath
    }))
  }))
}))

// Install MCP
const installGlobalMCPRoute = createRoute({
  method: 'post',
  path: '/api/mcp/global/install',
  tags: ['MCP Global'],
  summary: 'Install Promptliano MCP globally for a tool',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            tool: ToolOptionsSchema,
            serverUrl: z.string().optional(),
            debug: z.boolean().optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      message: z.string(),
      configPath: z.string().optional(),
      backedUp: z.boolean().optional(),
      backupPath: z.string().optional()
    })
  }))
})

mcpGlobalConfigRoutes.openapi(installGlobalMCPRoute, withErrorHandling(async (c) => {
  const { tool, serverUrl, debug } = await c.req.json()
  const result = await mcpInstallationService.installGlobalMCP(tool, serverUrl, debug)
  
  if (!result.success) {
    throw ErrorFactory.operationFailed('install MCP', result.message)
  }
  
  return c.json(successResponse({
    message: result.message,
    configPath: result.configPath,
    backedUp: result.backedUp,
    backupPath: result.backupPath
  }))
}))

// Uninstall MCP
const uninstallGlobalMCPRoute = createRoute({
  method: 'post',
  path: '/api/mcp/global/uninstall',
  tags: ['MCP Global'],
  summary: 'Uninstall global Promptliano MCP for a tool',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            tool: ToolOptionsSchema
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      message: z.string()
    })
  }))
})

mcpGlobalConfigRoutes.openapi(uninstallGlobalMCPRoute, withErrorHandling(async (c) => {
  const { tool } = await c.req.json()
  const result = await mcpInstallationService.uninstallGlobalMCP(tool)
  
  if (!result.success) {
    throw ErrorFactory.operationFailed('uninstall MCP', result.message)
  }
  
  return c.json(successResponse({
    message: result.message
  }))
}))

// Get status
const getGlobalStatusRoute = createRoute({
  method: 'get',
  path: '/api/mcp/global/status',
  tags: ['MCP Global'],
  summary: 'Get global MCP installation status',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      configExists: z.boolean(),
      configPath: z.string(),
      lastModified: z.number().optional(),
      totalInstallations: z.number(),
      installedTools: z.array(z.string()),
      installation: z.object({
        supported: z.boolean(),
        scriptPath: z.string(),
        scriptExists: z.boolean()
      })
    })
  }))
})

mcpGlobalConfigRoutes.openapi(getGlobalStatusRoute, withErrorHandling(async (c) => {
  await mcpGlobalConfigService.initialize()
  const status = await mcpGlobalConfigService.getInstallationStatus()
  return c.json(successResponse(status))
}))

// ============= PROJECT CONFIG ROUTES =============
export const mcpProjectConfigRoutes = new OpenAPIHono()

// Get config locations
const getConfigLocationsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/config/locations',
  tags: ['MCP Project'],
  summary: 'Get project MCP configuration locations',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      locations: z.array(z.object({
        path: z.string(),
        exists: z.boolean(),
        priority: z.number()
      }))
    })
  }))
})

mcpProjectConfigRoutes.openapi(getConfigLocationsRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const locations = await mcpProjectConfigService.getConfigLocations(projectId)
  return c.json(successResponse({ locations }))
}))

// Get merged config
const getMergedConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/config/merged',
  tags: ['MCP Project'],
  summary: 'Get merged project MCP configuration',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema
    })
  }))
})

mcpProjectConfigRoutes.openapi(getMergedConfigRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const config = await mcpProjectConfigService.getMergedConfig(projectId)
  return c.json(successResponse({ config }))
}))

// Get expanded (variable-resolved) config
const getExpandedConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/config/expanded',
  tags: ['MCP Project'],
  summary: 'Get expanded project MCP configuration (variables resolved)',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema
    })
  }))
})

mcpProjectConfigRoutes.openapi(getExpandedConfigRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const config = await mcpProjectConfigService.getMergedConfig(projectId)
  const expandedConfig = await mcpProjectConfigService.expandVariables(config, projectId)
  return c.json(successResponse({ config: expandedConfig }))
}))

// Get project config
const getProjectConfigRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/config',
  tags: ['MCP Project'],
  summary: 'Get project-specific MCP configuration',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema.nullable(),
      source: z.string().optional()
    })
  }))
})

mcpProjectConfigRoutes.openapi(getProjectConfigRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const result = await mcpProjectConfigService.getProjectConfig(projectId)
  return c.json(successResponse(result))
}))

// Save project configuration to a specific location
const saveProjectConfigToLocationRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/mcp/config/save-to-location',
  tags: ['MCP Project'],
  summary: 'Save project MCP configuration to a specific location',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            config: ProjectMCPConfigSchema,
            location: z.string()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    message: z.string()
  }))
})

mcpProjectConfigRoutes.openapi(saveProjectConfigToLocationRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const { config, location } = await c.req.json()
  await mcpProjectConfigService.saveProjectConfigToLocation(projectId, config, location)
  return c.json(operationSuccessResponse('Config saved to location successfully'))
}))

// Get default config for a specific location
const getDefaultConfigForLocationRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/mcp/config/default-for-location',
  tags: ['MCP Project'],
  summary: 'Get default project MCP configuration for a given location',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      location: z.string()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema
    })
  }))
})

mcpProjectConfigRoutes.openapi(getDefaultConfigForLocationRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const { location } = c.req.query()
  const config = await mcpProjectConfigService.getDefaultConfigForLocation(projectId, location!)
  return c.json(successResponse({ config }))
}))

// Update project config
const updateProjectConfigRoute = createRoute({
  method: 'put',
  path: '/api/projects/{id}/mcp/config',
  tags: ['MCP Project'],
  summary: 'Update project-specific MCP configuration',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: ProjectMCPConfigSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      config: ProjectMCPConfigSchema,
      source: z.string()
    })
  }))
})

mcpProjectConfigRoutes.openapi(updateProjectConfigRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  const config = await c.req.json()
  const result = await mcpProjectConfigService.updateProjectConfig(projectId, config)
  return c.json(successResponse(result))
}))

// Delete project config
const deleteProjectConfigRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}/mcp/config',
  tags: ['MCP Project'],
  summary: 'Delete project-specific MCP configuration',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    message: z.string()
  }))
})

mcpProjectConfigRoutes.openapi(deleteProjectConfigRoute, withErrorHandling(async (c) => {
  const projectId = parseInt(c.req.param('id')!)
  await mcpProjectConfigService.deleteProjectConfig(projectId)
  return c.json(operationSuccessResponse('Project configuration deleted successfully'))
}))

// Combine both route sets
export const mcpConfigRoutes = new OpenAPIHono()
  .route('/', mcpGlobalConfigRoutes)
  .route('/', mcpProjectConfigRoutes)

export type MCPConfigRouteTypes = typeof mcpConfigRoutes
