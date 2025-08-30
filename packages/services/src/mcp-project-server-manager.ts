// MCP Project Server Manager
// Manages MCP servers based on project-level .mcp.json configurations

import { mcpProjectConfigService } from './mcp-project-config-service'
import { getMCPClientManager } from './mcp-service'
import { createLogger } from './utils/logger'
import { getProjectById } from './project-service'
import type { McpServerConfig as DatabaseMcpServerConfig } from '@promptliano/database'
import type { MCPServerConfig } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'

const logger = createLogger('MCPProjectServerManager')

interface ProjectServerInfo {
  projectId: number
  servers: Map<string, number> // server name -> config ID mapping
  lastUpdated: number
}

class MCPProjectServerManager {
  private projectServers = new Map<number, ProjectServerInfo>()
  private serverIdCounter = 100000 // Start with high IDs to avoid conflicts

  constructor() {
    // Listen for configuration changes
    mcpProjectConfigService.on('configChanged', async (projectId: number) => {
      logger.info(`Project ${projectId} config changed, reloading servers`)
      await this.reloadProjectServers(projectId)
    })
  }

  /**
   * Initialize servers for a project based on its .mcp.json config
   */
  async initializeProjectServers(projectId: number): Promise<void> {
    try {
      const project = await getProjectById(projectId)
      logger.info(`Initializing MCP servers for project ${project.name} (${projectId})`)

      // Get the expanded config (with variables resolved)
      const config = await mcpProjectConfigService.getExpandedConfig(projectId)

      if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        logger.info(`No MCP servers configured for project ${projectId}`)
        return
      }

      const serverInfo: ProjectServerInfo = {
        projectId,
        servers: new Map(),
        lastUpdated: Date.now()
      }

      const manager = getMCPClientManager()

      // Start each configured server
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        try {
          // Create a database MCP config and convert to API format for client manager
          const serverId = this.serverIdCounter++
          const dbConfig: DatabaseMcpServerConfig = {
            id: serverId,
            projectId,
            name: serverName,
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env || {},
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            autoStart: true
          }

          // Convert to API format for client manager
          const apiConfig: MCPServerConfig = {
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

          // Store the mapping
          serverInfo.servers.set(serverName, serverId)

          // Start the server
          await manager.startServer(apiConfig)
          logger.info(`Started MCP server "${serverName}" for project ${projectId}`)
        } catch (error) {
          logger.error(`Failed to start server "${serverName}":`, error)
        }
      }

      this.projectServers.set(projectId, serverInfo)
      logger.info(`Initialized ${serverInfo.servers.size} MCP servers for project ${projectId}`)
    } catch (error) {
      logger.error(`Failed to initialize project servers:`, error)
      throw new ApiError(
        500,
        `Failed to initialize MCP servers: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_PROJECT_INIT_FAILED'
      )
    }
  }

  /**
   * Stop all servers for a project
   */
  async stopProjectServers(projectId: number): Promise<void> {
    const serverInfo = this.projectServers.get(projectId)
    if (!serverInfo) {
      return
    }

    const manager = getMCPClientManager()

    for (const [serverName, configId] of Array.from(serverInfo.servers)) {
      try {
        await manager.stopServer(configId)
        logger.info(`Stopped MCP server "${serverName}" for project ${projectId}`)
      } catch (error) {
        logger.error(`Failed to stop server "${serverName}":`, error)
      }
    }

    this.projectServers.delete(projectId)
  }

  /**
   * Reload servers for a project (stop and restart)
   */
  async reloadProjectServers(projectId: number): Promise<void> {
    await this.stopProjectServers(projectId)
    await this.initializeProjectServers(projectId)
  }

  /**
   * Get server info for a project
   */
  getProjectServerInfo(projectId: number): ProjectServerInfo | undefined {
    return this.projectServers.get(projectId)
  }

  /**
   * Get all active project servers
   */
  getAllProjectServers(): Map<number, ProjectServerInfo> {
    return new Map(this.projectServers)
  }

  /**
   * Handle project deletion
   */
  async handleProjectDeleted(projectId: number): Promise<void> {
    await this.stopProjectServers(projectId)
  }

  /**
   * Clean up all servers
   */
  async cleanup(): Promise<void> {
    const stopPromises: Promise<void>[] = []

    for (const projectId of Array.from(this.projectServers.keys())) {
      stopPromises.push(this.stopProjectServers(projectId))
    }

    await Promise.all(stopPromises)
  }
}

// Export singleton instance
export const mcpProjectServerManager = new MCPProjectServerManager()

// Helper function to initialize project servers on demand
export async function ensureProjectServersInitialized(projectId: number): Promise<void> {
  const serverInfo = mcpProjectServerManager.getProjectServerInfo(projectId)

  // If servers are already initialized and recent, skip
  if (serverInfo && Date.now() - serverInfo.lastUpdated < 5 * 60 * 1000) {
    // 5 minutes
    return
  }

  await mcpProjectServerManager.initializeProjectServers(projectId)
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP project servers...')
  await mcpProjectServerManager.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP project servers...')
  await mcpProjectServerManager.cleanup()
  process.exit(0)
})
