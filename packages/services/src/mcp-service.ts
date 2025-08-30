/**
 * MCP Service - Functional Factory Pattern
 * Migrated from direct storage access to repository-based operations
 *
 * Key improvements:
 * - Uses mcpServerRepository instead of mcpStorage
 * - Consistent error handling with ErrorFactory
 * - Functional composition with dependency injection
 * - Maintains MCP client manager lifecycle
 */

import { createCrudService, extendService, withErrorContext, createServiceLogger } from './core/base-service'
import ErrorFactory from '@promptliano/shared/src/error/error-factory'
import { mcpServerRepository } from '@promptliano/database'
import {
  type McpServerConfig as DatabaseMcpServerConfig,
  type InsertMcpServerConfig as CreateMCPServerConfig,
  insertMcpServerConfigSchema as InsertMCPServerConfigSchema,
  selectMcpServerConfigSchema as MCPServerConfigSchema
} from '@promptliano/database'
import {
  type MCPServerConfig,
  type MCPServerState,
  type MCPTool,
  type MCPResource,
  type MCPToolExecutionRequest,
  type MCPToolExecutionResult,
  MCPToolExecutionRequestSchema
} from '@promptliano/schemas'
import { MCPClientManager } from '@promptliano/mcp-client'
import { z, ZodError } from 'zod'
import { projectService } from './project-service'

// Dependencies interface for dependency injection
export interface MCPServiceDeps {
  repository?: typeof mcpServerRepository
  logger?: ReturnType<typeof createServiceLogger>
  projectService?: any // To avoid circular dependency
  clientManager?: MCPClientManager
}

// Type adapters to convert between database and API schemas
function databaseToApiConfig(dbConfig: DatabaseMcpServerConfig): MCPServerConfig {
  return {
    id: dbConfig.id,
    projectId: dbConfig.projectId,
    name: dbConfig.name,
    command: dbConfig.command,
    args: dbConfig.args || [],
    env: dbConfig.env || {},
    enabled: dbConfig.enabled,
    autoStart: dbConfig.autoStart,
    created: dbConfig.createdAt,
    updated: dbConfig.updatedAt
  }
}

function databaseToApiConfigs(dbConfigs: DatabaseMcpServerConfig[]): MCPServerConfig[] {
  return dbConfigs.map(databaseToApiConfig)
}

// Global MCP client manager factory
function createMCPClientManager(
  repository: typeof mcpServerRepository,
  logger: ReturnType<typeof createServiceLogger>
): MCPClientManager {
  return new MCPClientManager({
    onServerStateChange: async (serverId: number, state: any) => {
      logger.info(`MCP server ${serverId} state changed to: ${state}`)
      // Update server state in repository
      try {
        await repository.updateState(serverId, {
          // Note: Current schema doesn't have status/pid/error fields
          // This is prepared for future schema additions
        })
      } catch (error) {
        logger.error('Failed to update server state', { serverId, state, error })
      }
    },
    onServerError: async (serverId: number, error: Error) => {
      logger.error(`MCP server ${serverId} error:`, error)
      // Update server state with error in repository
      try {
        await repository.updateState(serverId, {
          // Note: Current schema doesn't have status/pid/error fields
          // This is prepared for future schema additions
        })
      } catch (updateError) {
        logger.error('Failed to update server error state', { serverId, error, updateError })
      }
    }
  })
}

/**
 * Create MCP Service with functional factory pattern
 */
export function createMCPService(deps: MCPServiceDeps = {}) {
  const {
    repository = mcpServerRepository,
    logger = createServiceLogger('MCPService'),
    projectService: injectedProjectService = projectService,
    clientManager = createMCPClientManager(repository, logger)
  } = deps

  // Base CRUD operations using the service factory
  const baseService = createCrudService<DatabaseMcpServerConfig, CreateMCPServerConfig>({
    entityName: 'MCPServerConfig',
    repository: repository as any, // Extended repository with additional methods
    schema: InsertMCPServerConfigSchema as any, // Schema compatibility handled by type adapters
    logger
  })

  // Extended domain operations
  const extensions = {
    /**
     * Create MCP server config with project validation and auto-start
     */
    async createForProject(
      projectId: number,
      data: Omit<CreateMCPServerConfig, 'projectId'>
    ): Promise<DatabaseMcpServerConfig> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await injectedProjectService.getById(projectId)

          const configData: CreateMCPServerConfig = {
            ...data,
            projectId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }

          const config = await baseService.create(configData)

          // Auto-start if enabled and autoStart is true
          if (config.enabled && config.autoStart) {
            try {
              await clientManager.startServer(databaseToApiConfig(config))
            } catch (error) {
              logger.error(`Failed to auto-start MCP server ${config.name}`, error)
            }
          }

          return config
        },
        { entity: 'MCPServerConfig', action: 'createForProject', id: projectId }
      )
    },

    /**
     * Get MCP server config by ID (alias for base getById)
     */
    async getConfigById(configId: number): Promise<DatabaseMcpServerConfig> {
      return baseService.getById(configId)
    },

    /**
     * List MCP server configs for a project
     */
    async listForProject(projectId: number): Promise<DatabaseMcpServerConfig[]> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await injectedProjectService.getById(projectId)
          return await repository.getByProject(projectId)
        },
        { entity: 'MCPServerConfig', action: 'listForProject', id: projectId }
      )
    },

    /**
     * Update MCP server config with server lifecycle management
     */
    async updateConfig(configId: number, data: Partial<CreateMCPServerConfig>): Promise<DatabaseMcpServerConfig> {
      return withErrorContext(
        async () => {
          const existing = await baseService.getById(configId)

          const updateData = {
            ...data,
            updatedAt: Date.now()
          } as Partial<CreateMCPServerConfig>

          const updated = await baseService.update(configId, updateData)

          // Handle state changes based on update
          if (existing.enabled && !updated.enabled) {
            // Server was disabled, stop it
            await clientManager.stopServer(configId)
          } else if (!existing.enabled && updated.enabled && updated.autoStart) {
            // Server was enabled with autoStart, start it
            await clientManager.startServer(databaseToApiConfig(updated))
          } else if (existing.enabled && updated.enabled) {
            // Server config changed while enabled, restart it
            await clientManager.restartServer(databaseToApiConfig(updated))
          }

          return updated
        },
        { entity: 'MCPServerConfig', action: 'updateConfig', id: configId }
      )
    },

    /**
     * Delete MCP server config with server cleanup
     */
    async deleteConfig(configId: number): Promise<boolean> {
      return withErrorContext(
        async () => {
          // Stop the server if running
          await clientManager.stopServer(configId)

          // Delete from repository
          return await baseService.delete!(configId)
        },
        { entity: 'MCPServerConfig', action: 'deleteConfig', id: configId }
      )
    },

    // MCP Server Management operations
    /**
     * Start MCP server
     */
    async startServer(configId: number): Promise<MCPServerState> {
      return withErrorContext(
        async () => {
          const config = await baseService.getById(configId)

          if (!config.enabled) {
            throw ErrorFactory.businessRuleViolation('Cannot start disabled MCP server')
          }

          await clientManager.startServer(databaseToApiConfig(config))
          return clientManager.getServerState(configId)
        },
        { entity: 'MCPServer', action: 'start', id: configId }
      )
    },

    /**
     * Stop MCP server
     */
    async stopServer(configId: number): Promise<MCPServerState> {
      return withErrorContext(
        async () => {
          await clientManager.stopServer(configId)
          return clientManager.getServerState(configId)
        },
        { entity: 'MCPServer', action: 'stop', id: configId }
      )
    },

    /**
     * Get MCP server state
     */
    async getServerState(configId: number): Promise<MCPServerState> {
      return withErrorContext(
        async () => {
          return clientManager.getServerState(configId)
        },
        { entity: 'MCPServer', action: 'getState', id: configId }
      )
    },

    // MCP Tool operations
    /**
     * List all MCP tools for a project
     */
    async listTools(projectId: number): Promise<MCPTool[]> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await injectedProjectService.getById(projectId)
          return await clientManager.listAllTools(projectId)
        },
        { entity: 'MCPTool', action: 'list', id: projectId }
      )
    },

    /**
     * Execute MCP tool with request validation and project verification
     */
    async executeTool(projectId: number, request: MCPToolExecutionRequest): Promise<MCPToolExecutionResult> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await injectedProjectService.getById(projectId)

          // Validate request
          const validatedRequest = MCPToolExecutionRequestSchema.parse(request)

          // Verify the server belongs to this project
          const config = await baseService.getById(validatedRequest.serverId)
          if (config.projectId !== projectId) {
            throw ErrorFactory.forbidden('MCP server does not belong to this project')
          }

          const executionId = `exec_${Date.now()}`
          const startedAt = Date.now()

          try {
            const result = await clientManager.executeTool(
              validatedRequest.serverId,
              validatedRequest.toolId,
              validatedRequest.parameters
            )

            return {
              id: executionId,
              toolId: validatedRequest.toolId,
              serverId: validatedRequest.serverId,
              status: 'success',
              result,
              error: null,
              startedAt,
              completedAt: Date.now()
            }
          } catch (error) {
            return {
              id: executionId,
              toolId: validatedRequest.toolId,
              serverId: validatedRequest.serverId,
              status: 'error',
              result: null,
              error: error instanceof Error ? error.message : String(error),
              startedAt,
              completedAt: Date.now()
            }
          }
        },
        { entity: 'MCPTool', action: 'execute', id: projectId }
      )
    },

    // MCP Resource operations
    /**
     * List all MCP resources for a project
     */
    async listResources(projectId: number): Promise<MCPResource[]> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await injectedProjectService.getById(projectId)
          return await clientManager.listAllResources(projectId)
        },
        { entity: 'MCPResource', action: 'list', id: projectId }
      )
    },

    /**
     * Read MCP resource with project and server verification
     */
    async readResource(projectId: number, serverId: number, uri: string): Promise<any> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await injectedProjectService.getById(projectId)

          // Verify the server belongs to this project
          const config = await baseService.getById(serverId)
          if (config.projectId !== projectId) {
            throw ErrorFactory.forbidden('MCP server does not belong to this project')
          }

          return await clientManager.readResource(serverId, uri)
        },
        { entity: 'MCPResource', action: 'read', id: projectId }
      )
    },

    /**
     * Auto-start servers for a project
     */
    async autoStartProjectServers(projectId: number): Promise<void> {
      return withErrorContext(
        async () => {
          const configs = await repository.getAutoStartByProject(projectId)
          await clientManager.autoStartProjectServers(databaseToApiConfigs(configs))
        },
        { entity: 'MCPServer', action: 'autoStartProject', id: projectId }
      )
    },

    /**
     * Clean up when project is deleted
     */
    async cleanupProjectServers(projectId: number): Promise<void> {
      return withErrorContext(
        async () => {
          const configs = await repository.getByProject(projectId)

          // Stop all servers for this project
          for (const config of configs) {
            try {
              await clientManager.stopServer(config.id)
            } catch (error) {
              logger.warn(`Failed to stop server ${config.id} during cleanup`, error)
            }
          }

          // Delete all MCP configs for this project
          await repository.deleteByProject(projectId)
        },
        { entity: 'MCPServer', action: 'cleanupProject', id: projectId }
      )
    },

    /**
     * Get enabled servers for a project
     */
    async getEnabledForProject(projectId: number): Promise<DatabaseMcpServerConfig[]> {
      return withErrorContext(
        async () => {
          await injectedProjectService.getById(projectId)
          return await repository.getEnabledByProject(projectId)
        },
        { entity: 'MCPServerConfig', action: 'getEnabledForProject', id: projectId }
      )
    },

    /**
     * Access to the MCP client manager for advanced operations
     */
    getClientManager(): MCPClientManager {
      return clientManager
    }
  }

  return extendService(baseService, extensions)
}

// Export type for consumers
export type MCPService = ReturnType<typeof createMCPService>

// Export singleton for backward compatibility
export const mcpService = createMCPService()

// Export individual functions for tree-shaking and backward compatibility
export const create = mcpService.create
export const getById = mcpService.getById
export const update = mcpService.update
export const deleteMCPConfig = mcpService.delete ?? mcpService.deleteConfig
export const createForProject = mcpService.createForProject
export const getConfigById = mcpService.getConfigById
export const listForProject = mcpService.listForProject
export const updateConfig = mcpService.updateConfig
export const deleteConfig = mcpService.deleteConfig
export const startServer = mcpService.startServer
export const stopServer = mcpService.stopServer
export const getServerState = mcpService.getServerState
export const listTools = mcpService.listTools
export const executeTool = mcpService.executeTool
export const listResources = mcpService.listResources
export const readResource = mcpService.readResource
export const autoStartProjectServers = mcpService.autoStartProjectServers
export const cleanupProjectServers = mcpService.cleanupProjectServers
export const getEnabledForProject = mcpService.getEnabledForProject
export const getClientManager = mcpService.getClientManager

// Legacy exports for backward compatibility (avoid name conflicts)
export const createMCPServerConfig = mcpService.createForProject
export const getMCPServerConfigById = mcpService.getConfigById
export const listMCPServerConfigs = mcpService.listForProject
export const updateMCPServerConfig = mcpService.updateConfig
export const deleteMCPServerConfig = mcpService.deleteConfig
export const startMCPServer = mcpService.startServer
export const stopMCPServer = mcpService.stopServer
export const getMCPServerState = mcpService.getServerState
export const listMCPTools = mcpService.listTools
export const executeMCPTool = mcpService.executeTool
export const listMCPResources = mcpService.listResources
export const readMCPResource = mcpService.readResource
export const autoStartProjectMCPServers = mcpService.autoStartProjectServers
export const cleanupProjectMCPServers = mcpService.cleanupProjectServers
export const getMCPClientManager = mcpService.getClientManager
