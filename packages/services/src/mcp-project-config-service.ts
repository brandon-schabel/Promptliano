// Project-level MCP configuration service (Functional Factory Pattern)
// Handles loading and managing .mcp.json files at the project level
// Supports configuration hierarchy: project > user > global

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { createLogger } from './utils/logger'
import { EventEmitter } from 'events'
import { getProjectById } from './project-service'
import { toPosixPath, toOSPath, joinPosix, ErrorFactory } from '@promptliano/shared'
import { withErrorContext, withRetry } from './utils/service-helpers'
import {
  MCPErrorFactory,
  MCPFileOps,
  MCPRetryConfig,
  withMCPCache,
  MCPCacheConfig,
  createMCPFileWatcher,
  MCPValidation,
  expandMCPVariables
} from './utils/mcp-service-helpers'

const logger = createLogger('MCPProjectConfigService')

// Configuration schemas
export const MCPServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']).default('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  // Zod v4: explicit key/value for record
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().optional()
})

export const MCPInputConfigSchema = z.object({
  type: z.enum(['promptString', 'promptNumber', 'promptBoolean']),
  id: z.string(),
  description: z.string(),
  default: z.any().optional(),
  password: z.boolean().optional()
})

// Support both old 'servers' format and new 'mcpServers' format
export const ProjectMCPConfigSchema = z
  .object({
    // Zod v4: record requires key schema
    mcpServers: z.record(z.string(), MCPServerConfigSchema).optional(),
    inputs: z.array(MCPInputConfigSchema).optional(),
    extends: z.union([z.string(), z.array(z.string())]).optional()
  })
  .transform((data) => {
    // Always ensure mcpServers exists, even if empty
    return {
      ...data,
      mcpServers: data.mcpServers || {}
    }
  })

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>
export type MCPInputConfig = z.infer<typeof MCPInputConfigSchema>
export type ProjectMCPConfig = z.infer<typeof ProjectMCPConfigSchema>

// Configuration file paths by priority (highest to lowest)
const CONFIG_FILE_NAMES = [
  '.vscode/mcp.json', // VS Code workspace-specific
  '.cursor/mcp.json', // Cursor IDE project-specific
  '.mcp.json' // Universal project root (primary)
  // '.promptliano/mcp.json'   // Promptliano-specific
]

export interface MCPConfigLocation {
  path: string
  exists: boolean
  priority: number
}

export interface ResolvedMCPConfig {
  config: ProjectMCPConfig
  source: string
  projectPath: string
}

export interface MCPProjectConfigDependencies {
  logger?: ReturnType<typeof createLogger>
  projectService?: { getById: (id: number) => Promise<any> }
  enableWatching?: boolean
  cacheConfig?: { ttl?: number; maxEntries?: number }
  configFileNames?: string[]
}

export interface MCPProjectConfigService {
  getConfigLocations(projectId: number): Promise<MCPConfigLocation[]>
  loadProjectConfig(projectId: number): Promise<ResolvedMCPConfig | null>
  getUserConfig(): Promise<ProjectMCPConfig | null>
  getGlobalConfig(): Promise<ProjectMCPConfig | null>
  getMergedConfig(projectId: number): Promise<ProjectMCPConfig>
  getExpandedConfig(projectId: number): Promise<ProjectMCPConfig>
  expandVariables(config: ProjectMCPConfig, projectId: number): Promise<ProjectMCPConfig>
  saveProjectConfig(projectId: number, config: ProjectMCPConfig): Promise<void>
  saveProjectConfigToLocation(projectId: number, config: ProjectMCPConfig, locationPath: string): Promise<void>
  getEditorType(locationPath: string): string
  getDefaultConfigForLocation(projectId: number, locationPath: string): Promise<ProjectMCPConfig>
  getProjectConfig(projectId: number): Promise<{ config: ProjectMCPConfig | null; source?: string }>
  updateProjectConfig(
    projectId: number,
    config: ProjectMCPConfig
  ): Promise<{ config: ProjectMCPConfig; source: string }>
  deleteProjectConfig(projectId: number): Promise<void>
  cleanup(): Promise<void>
  // EventEmitter-like interface for compatibility
  on(event: string, listener: (...args: any[]) => void): void
  emit(event: string, ...args: any[]): boolean
  removeAllListeners(): void
}

export function createMCPProjectConfigService(deps?: MCPProjectConfigDependencies): MCPProjectConfigService {
  // Provide fallback cache config with proper defaults
  const defaultCacheConfig = { ttl: 30000, maxEntries: 50 }
  const {
    logger = createLogger('MCPProjectConfigService'),
    projectService = { getById: getProjectById },
    enableWatching = true,
    cacheConfig = defaultCacheConfig,
    configFileNames = CONFIG_FILE_NAMES
  } = deps || {}

  // Ensure cache config has proper defaults
  const safeCacheConfig = {
    ttl: cacheConfig?.ttl ?? defaultCacheConfig.ttl,
    maxEntries: cacheConfig?.maxEntries ?? defaultCacheConfig.maxEntries
  }

  // Internal state
  const configCache = new Map<number, ResolvedMCPConfig>()
  const fileWatchers = new Map<string, () => void>()
  const eventEmitter = new EventEmitter()

  /**
   * Normalize raw config to the canonical shape expected by ProjectMCPConfigSchema
   * - Accepts legacy `servers` key as alias for `mcpServers`
   * - Accepts shorthand string values for servers and expands to full objects
   * - Coerces env values to strings
   */
  const normalizeProjectMCPConfig = (raw: any): any => {
    if (!raw || typeof raw !== 'object') return raw

    const cloned = { ...raw }

    // Support legacy key
    if (!cloned.mcpServers && cloned.servers && typeof cloned.servers === 'object') {
      cloned.mcpServers = cloned.servers
    }

    if (cloned.mcpServers && typeof cloned.mcpServers === 'object') {
      const normalizedServers: Record<string, any> = {}
      for (const [name, value] of Object.entries(cloned.mcpServers)) {
        let server: any = value

        // Shorthand: string => command
        if (typeof server === 'string') {
          server = { type: 'stdio', command: server }
        }

        // Default type
        if (!server.type) server.type = 'stdio'

        // Ensure env values are strings
        if (server.env && typeof server.env === 'object') {
          const env: Record<string, string> = {}
          for (const [k, v] of Object.entries(server.env)) {
            env[k] = typeof v === 'string' ? v : String(v)
          }
          server.env = env
        }

        normalizedServers[name] = server
      }

      cloned.mcpServers = normalizedServers
    }

    return cloned
  }

  /**
   * Get the servers from config, handling both formats
   */
  const getServersFromConfig = (config: ProjectMCPConfig): Record<string, MCPServerConfig> => {
    // If undefined, fallback to empty typed record
    return (config.mcpServers as Record<string, MCPServerConfig> | undefined) || ({} as Record<string, MCPServerConfig>)
  }

  /**
   * Get all possible config file locations for a project with caching
   */
  const getConfigLocations = withMCPCache(
    async (projectId: number): Promise<MCPConfigLocation[]> => {
      return withErrorContext(
        async () => {
          const project = await projectService.getById(projectId)

          if (!project) {
            throw ErrorFactory.notFound('Project', projectId)
          }

          const projectPath = project.path

          if (!projectPath) {
            throw ErrorFactory.missingRequired('path', `Project ${projectId}`)
          }

          const locations: MCPConfigLocation[] = []

          for (let i = 0; i < configFileNames.length; i++) {
            const configFileName = configFileNames[i]
            if (!configFileName) continue

            const configPath = path.join(projectPath, configFileName)
            const exists = await MCPFileOps.fileExists(configPath)

            locations.push({
              path: configPath,
              exists,
              priority: configFileNames.length - i // Higher number = higher priority
            })
          }

          logger.debug(`Found ${locations.length} potential config locations for project ${projectId}`)
          return locations
        },
        { entity: 'MCPProjectConfig', action: 'getConfigLocations', id: projectId }
      )
    },
    {
      ttl: safeCacheConfig.ttl,
      maxEntries: safeCacheConfig.maxEntries,
      keyGenerator: (projectId) => `locations-${projectId}`
    }
  )

  /**
   * Load project-level MCP configuration with retry and caching
   */
  const loadProjectConfig = async (projectId: number): Promise<ResolvedMCPConfig | null> => {
    return withErrorContext(
      async () => {
        // Check cache first
        if (configCache.has(projectId)) {
          logger.debug(`Returning cached config for project ${projectId}`)
          return configCache.get(projectId)!
        }

        return withRetry(async () => {
          const project = await projectService.getById(projectId)

          if (!project) {
            throw ErrorFactory.notFound('Project', projectId)
          }

          const projectPath = project.path

          if (!projectPath) {
            throw ErrorFactory.missingRequired('path', `Project ${projectId}`)
          }

          const locations = await getConfigLocations(projectId)

          // Find the first existing config file (highest priority)
          const existingConfig = locations.sort((a, b) => b.priority - a.priority).find((loc) => loc.exists)

          if (!existingConfig) {
            logger.debug(`No MCP config found for project ${projectId}`)
            return null
          }

          const config = await MCPFileOps.readJsonFile<ProjectMCPConfig>(existingConfig.path, 'ProjectMCP')
          if (!config) {
            return null
          }

          // Validate config
          const validatedConfig = ProjectMCPConfigSchema.parse(normalizeProjectMCPConfig(config))

          const resolved: ResolvedMCPConfig = {
            config: validatedConfig,
            source: existingConfig.path,
            projectPath
          }

          // Cache the result
          configCache.set(projectId, resolved)

          // Set up file watcher if enabled
          if (enableWatching) {
            watchConfigFile(projectId, existingConfig.path)
          }

          logger.info(`Loaded MCP config for project ${projectId} from ${existingConfig.path}`)
          return resolved
        }, MCPRetryConfig.configLoad)
      },
      { entity: 'MCPProjectConfig', action: 'load', id: projectId }
    )
  }

  /**
   * Get user-level MCP configuration with caching and retry
   */
  const getUserConfig = withMCPCache(
    async (): Promise<ProjectMCPConfig | null> => {
      return withErrorContext(
        async () => {
          const userConfigPath = path.join(os.homedir(), '.promptliano', 'mcp-config.json')

          return withRetry(async () => {
            const config = await MCPFileOps.readJsonFile<ProjectMCPConfig>(userConfigPath, 'UserMCP')
            if (config) {
              const validatedConfig = ProjectMCPConfigSchema.parse(normalizeProjectMCPConfig(config))
              logger.debug('Loaded user MCP configuration')
              return validatedConfig
            }
            return null
          }, MCPRetryConfig.configLoad)
        },
        { entity: 'MCPProjectConfig', action: 'getUserConfig' }
      )
    },
    { ttl: safeCacheConfig.ttl, maxEntries: 1, keyGenerator: () => 'user-config' }
  )

  /**
   * Get global/default MCP configuration with caching
   */
  const getGlobalConfig = withMCPCache(
    async (): Promise<ProjectMCPConfig | null> => {
      return withErrorContext(
        async () => {
          // For now, return a minimal default config
          // This could be extended to load from a system-wide location
          logger.debug('Using default global MCP configuration')
          return {
            mcpServers: {}
          }
        },
        { entity: 'MCPProjectConfig', action: 'getGlobalConfig' }
      )
    },
    { ttl: safeCacheConfig.ttl, maxEntries: 1, keyGenerator: () => 'global-config' }
  )

  /**
   * Helper to merge two configurations
   */
  const mergeConfigs = (base: ProjectMCPConfig, override: ProjectMCPConfig): ProjectMCPConfig => {
    const baseServers = getServersFromConfig(base)
    const overrideServers = getServersFromConfig(override)

    return {
      mcpServers: {
        ...baseServers,
        ...overrideServers
      },
      inputs: override.inputs || base.inputs,
      extends: override.extends || base.extends
    }
  }

  /**
   * Merge configurations with proper precedence (Project > User > Global)
   */
  const getMergedConfig = withMCPCache(
    async (projectId: number): Promise<ProjectMCPConfig> => {
      return withErrorContext(
        async () => {
          const [projectConfig, userConfig, globalConfig] = await Promise.all([
            loadProjectConfig(projectId),
            getUserConfig(),
            getGlobalConfig()
          ])

          // Start with global config
          let merged: ProjectMCPConfig = globalConfig || { mcpServers: {} }

          // Merge user config
          if (userConfig) {
            merged = mergeConfigs(merged, userConfig)
          }

          // Merge project config (highest priority)
          if (projectConfig) {
            merged = mergeConfigs(merged, projectConfig.config)
          }

          logger.debug(`Merged configuration for project ${projectId}`, {
            hasProject: !!projectConfig,
            hasUser: !!userConfig,
            hasGlobal: !!globalConfig,
            serverCount: Object.keys(getServersFromConfig(merged)).length
          })

          return merged
        },
        { entity: 'MCPProjectConfig', action: 'merge', id: projectId }
      )
    },
    {
      ttl: safeCacheConfig.ttl,
      maxEntries: safeCacheConfig.maxEntries,
      keyGenerator: (projectId) => `merged-${projectId}`
    }
  )

  /**
   * Expand environment variables in configuration
   */
  const expandVariables = async (config: ProjectMCPConfig, projectId: number): Promise<ProjectMCPConfig> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)

        if (!project) {
          throw ErrorFactory.notFound('Project', projectId)
        }

        if (!project.path) {
          throw ErrorFactory.missingRequired('path', `Project ${projectId}`)
        }

        const variables: Record<string, string> = {
          workspaceFolder: toPosixPath(project.path),
          projectId: String(projectId),
          projectName: project.name,
          userHome: toPosixPath(os.homedir()),
          ...process.env
        }

        const expandedConfig = JSON.parse(JSON.stringify(config)) as ProjectMCPConfig

        // Expand variables in server configurations
        const servers = getServersFromConfig(expandedConfig)
        for (const [serverName, serverConfig] of Object.entries(servers)) {
          // Expand in command
          serverConfig.command = expandMCPVariables(serverConfig.command, variables)

          // Expand in args
          if (serverConfig.args) {
            serverConfig.args = serverConfig.args.map((arg) => expandMCPVariables(arg, variables))
          }

          // Expand in env
          if (serverConfig.env) {
            const expandedEnv: Record<string, string> = {}
            for (const [key, value] of Object.entries(serverConfig.env)) {
              expandedEnv[key] = expandMCPVariables(value, variables)
            }
            serverConfig.env = expandedEnv
          }
        }

        // Update the config with expanded servers
        if (expandedConfig.mcpServers) {
          expandedConfig.mcpServers = servers
        }

        logger.debug(`Expanded variables for project ${projectId}`, {
          variableCount: Object.keys(variables).length,
          serverCount: Object.keys(servers).length
        })

        return expandedConfig
      },
      { entity: 'MCPProjectConfig', action: 'expandVariables', id: projectId }
    )
  }

  /**
   * Get expanded configuration (with variables resolved) with caching
   */
  const getExpandedConfig = withMCPCache(
    async (projectId: number): Promise<ProjectMCPConfig> => {
      return withErrorContext(
        async () => {
          const mergedConfig = await getMergedConfig(projectId)
          return expandVariables(mergedConfig, projectId)
        },
        { entity: 'MCPProjectConfig', action: 'expand', id: projectId }
      )
    },
    {
      ttl: safeCacheConfig.ttl / 2,
      maxEntries: safeCacheConfig.maxEntries,
      keyGenerator: (projectId) => `expanded-${projectId}`
    }
  )

  /**
   * Save project configuration with validation and backup
   */
  const saveProjectConfig = async (projectId: number, config: ProjectMCPConfig): Promise<void> => {
    return withErrorContext(
      async () => {
        return withRetry(async () => {
          // Normalize then validate config
          const validatedConfig = ProjectMCPConfigSchema.parse(normalizeProjectMCPConfig(config))

          const project = await projectService.getById(projectId)
          if (!project) {
            throw ErrorFactory.notFound('Project', projectId)
          }

          const configPath = path.join(project.path, '.mcp.json')

          // Save with backup
          await MCPFileOps.writeJsonFile(configPath, validatedConfig, {
            createBackup: true,
            configType: 'ProjectMCP'
          })

          // Clear cache
          configCache.delete(projectId)

          // Emit change event
          eventEmitter.emit('configChanged', projectId, validatedConfig)

          logger.info(`Saved MCP config for project ${projectId}`)
        }, MCPRetryConfig.fileOperation)
      },
      { entity: 'MCPProjectConfig', action: 'save', id: projectId }
    )
  }

  /**
   * Save project configuration to a specific location
   */
  const saveProjectConfigToLocation = async (
    projectId: number,
    config: ProjectMCPConfig,
    locationPath: string
  ): Promise<void> => {
    return withErrorContext(
      async () => {
        return withRetry(async () => {
          // Normalize then validate config
          const validatedConfig = ProjectMCPConfigSchema.parse(normalizeProjectMCPConfig(config))

          const project = await projectService.getById(projectId)
          if (!project) {
            throw ErrorFactory.notFound('Project', projectId)
          }

          // Validate that the location is one of the allowed paths
          const allowedPaths = configFileNames.map((name) => path.join(project.path, name))
          const fullPath = path.isAbsolute(locationPath) ? locationPath : path.join(project.path, locationPath)

          if (!allowedPaths.includes(fullPath)) {
            throw ErrorFactory.invalidInput('config location', `one of: ${configFileNames.join(', ')}`, locationPath)
          }

          // Save with backup
          await MCPFileOps.writeJsonFile(fullPath, validatedConfig, {
            createBackup: true,
            configType: 'ProjectMCP'
          })

          // Clear cache
          configCache.delete(projectId)

          // Emit change event
          eventEmitter.emit('configChanged', projectId, validatedConfig)

          logger.info(`Saved MCP config for project ${projectId} to ${fullPath}`)
        }, MCPRetryConfig.fileOperation)
      },
      { entity: 'MCPProjectConfig', action: 'saveToLocation', id: projectId }
    )
  }

  /**
   * Get editor type from config location path
   */
  const getEditorType = (locationPath: string): string => {
    // Normalize path to use forward slashes for consistent comparison
    const normalizedPath = toPosixPath(locationPath)

    if (normalizedPath.includes('.vscode/mcp.json')) {
      return 'vscode'
    } else if (normalizedPath.includes('.cursor/mcp.json')) {
      return 'cursor'
    } else if (normalizedPath.includes('.mcp.json')) {
      return 'universal'
    }
    return 'unknown'
  }

  /**
   * Get project configuration (wrapper around loadProjectConfig for route compatibility)
   */
  const getProjectConfig = async (projectId: number): Promise<{ config: ProjectMCPConfig | null; source?: string }> => {
    return withErrorContext(
      async () => {
        const resolved = await loadProjectConfig(projectId)
        return {
          config: resolved?.config || null,
          source: resolved?.source
        }
      },
      { entity: 'MCPProjectConfig', action: 'getProjectConfig', id: projectId }
    )
  }

  /**
   * Update project configuration (wrapper around saveProjectConfig for route compatibility)
   */
  const updateProjectConfig = async (
    projectId: number,
    config: ProjectMCPConfig
  ): Promise<{ config: ProjectMCPConfig; source: string }> => {
    return withErrorContext(
      async () => {
        await saveProjectConfig(projectId, config)

        // Return the updated config with its source path
        const project = await projectService.getById(projectId)
        if (!project) {
          throw ErrorFactory.notFound('Project', projectId)
        }

        const source = path.join(project.path, '.mcp.json')
        return { config, source }
      },
      { entity: 'MCPProjectConfig', action: 'updateProjectConfig', id: projectId }
    )
  }

  /**
   * Delete project configuration
   */
  const deleteProjectConfig = async (projectId: number): Promise<void> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)
        if (!project) {
          throw ErrorFactory.notFound('Project', projectId)
        }

        // Delete the primary config file
        const configPath = path.join(project.path, '.mcp.json')

        try {
          await fs.unlink(configPath)
          logger.info(`Deleted MCP config for project ${projectId}`)
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
            // File doesn't exist, that's fine
            logger.debug(`MCP config file not found for project ${projectId}`)
          } else {
            throw error
          }
        }

        // Clear cache
        configCache.delete(projectId)

        // Emit change event
        eventEmitter.emit('configDeleted', projectId)
      },
      { entity: 'MCPProjectConfig', action: 'deleteProjectConfig', id: projectId }
    )
  }

  /**
   * Get default config for a specific editor location with enhanced path detection
   */
  const getDefaultConfigForLocation = async (projectId: number, locationPath: string): Promise<ProjectMCPConfig> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)
        if (!project) {
          throw ErrorFactory.notFound('Project', projectId)
        }

        const editorType = getEditorType(locationPath)

        // Get the Promptliano installation path with better detection
        let promptlianoPath = process.cwd()

        // Try to find the root by looking for package.json with workspaces
        let currentPath = promptlianoPath
        let foundRoot = false

        for (let i = 0; i < 5; i++) {
          try {
            const packageJsonPath = path.join(currentPath, 'package.json')
            await fs.access(packageJsonPath)
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

            if (packageJson.workspaces) {
              promptlianoPath = currentPath
              foundRoot = true
              break
            }
          } catch {
            // Continue searching up the directory tree
          }

          const parentPath = path.dirname(currentPath)
          if (parentPath === currentPath) break
          currentPath = parentPath
        }

        if (!foundRoot && promptlianoPath.includes('packages/server')) {
          promptlianoPath = path.resolve(promptlianoPath, '../..')
        }

        const scriptPath =
          process.platform === 'win32'
            ? path.join(promptlianoPath, 'packages/server/mcp-start.bat')
            : path.join(promptlianoPath, 'packages/server/mcp-start.sh')

        // Validate script exists
        const scriptExists = await MCPFileOps.fileExists(scriptPath)
        if (!scriptExists) {
          logger.warn(`MCP start script not found at: ${scriptPath}`)
        }

        logger.info('MCP Config Generation:', {
          initialCwd: process.cwd(),
          detectedRoot: promptlianoPath,
          foundRoot,
          scriptPath,
          scriptPathNormalized: toPosixPath(scriptPath)
        })

        // Base config that works for all editors (using new format)
        const baseConfig: ProjectMCPConfig = {
          mcpServers: {
            promptliano: {
              type: 'stdio',
              command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
              args: process.platform === 'win32' ? ['/c', toOSPath(scriptPath)] : [toOSPath(scriptPath)],
              env: {
                PROMPTLIANO_PROJECT_ID: projectId.toString(),
                PROMPTLIANO_PROJECT_PATH: toPosixPath(project.path),
                PROMPTLIANO_API_URL: 'http://localhost:3147/api/mcp',
                NODE_ENV: 'production'
              }
            }
          }
        }

        return baseConfig
      },
      { entity: 'MCPProjectConfig', action: 'getDefaultConfig', id: projectId }
    )
  }

  /**
   * Watch configuration file for changes with improved error handling
   */
  const watchConfigFile = (projectId: number, configPath: string): void => {
    // Remove existing watcher if any
    unwatchConfigFile(configPath)

    try {
      const cleanup = createMCPFileWatcher(
        configPath,
        async () => {
          logger.info(`MCP config changed for project ${projectId}, reloading`)

          // Clear cache
          configCache.delete(projectId)

          // Reload and emit event
          try {
            const newConfig = await loadProjectConfig(projectId)
            if (newConfig) {
              eventEmitter.emit('configChanged', projectId, newConfig.config)
              logger.debug('Project config reloaded successfully')
            }
          } catch (error) {
            logger.error('Failed to reload MCP config:', error)
            eventEmitter.emit('configError', projectId, error)
          }
        },
        { configType: 'ProjectMCP' }
      )

      fileWatchers.set(configPath, cleanup)
    } catch (error) {
      logger.error(`Failed to watch config file ${configPath}:`, error)
      // Don't throw, as watching is not critical for functionality
    }
  }

  /**
   * Stop watching a configuration file
   */
  const unwatchConfigFile = (configPath: string): void => {
    const cleanup = fileWatchers.get(configPath)
    if (cleanup) {
      cleanup()
      fileWatchers.delete(configPath)
    }
  }

  /**
   * Clear all watchers and cache
   */
  const cleanup = async (): Promise<void> => {
    return withErrorContext(
      async () => {
        logger.info('Cleaning up MCP Project Config Service')

        // Close all file watchers
        for (const cleanup of fileWatchers.values()) {
          try {
            cleanup()
          } catch (error) {
            logger.debug('Error cleaning up file watcher:', error)
          }
        }
        fileWatchers.clear()

        // Clear cache
        configCache.clear()

        // Remove all event listeners
        eventEmitter.removeAllListeners()

        logger.info('MCP Project Config Service cleanup complete')
      },
      { entity: 'MCPProjectConfig', action: 'cleanup' }
    )
  }

  return {
    getConfigLocations,
    loadProjectConfig,
    getUserConfig,
    getGlobalConfig,
    getMergedConfig,
    getExpandedConfig,
    expandVariables,
    saveProjectConfig,
    saveProjectConfigToLocation,
    getEditorType,
    getDefaultConfigForLocation,
    getProjectConfig,
    updateProjectConfig,
    deleteProjectConfig,
    cleanup,
    // EventEmitter compatibility
    on: eventEmitter.on.bind(eventEmitter),
    emit: eventEmitter.emit.bind(eventEmitter),
    removeAllListeners: eventEmitter.removeAllListeners.bind(eventEmitter)
  }
}

// Export singleton for backwards compatibility
export const mcpProjectConfigService = createMCPProjectConfigService()

// Export types for consumers - interface already exported above
