// Global MCP configuration service (Functional Factory Pattern)
// Handles MCP configurations that apply across all projects
// No project-specific IDs or paths in global configs

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { createLogger } from './utils/logger'
import { EventEmitter } from 'events'
import { withErrorContext, withRetry } from './utils/service-helpers'
import ErrorFactory from '@promptliano/shared/src/error/error-factory'
import { 
  MCPErrorFactory, 
  MCPFileOps, 
  MCPRetryConfig, 
  withMCPCache,
  MCPCacheConfig,
  createMCPFileWatcher,
  MCPValidation
} from './utils/mcp-service-helpers'

const logger = createLogger('MCPGlobalConfigService')

// Global configuration schemas
export const GlobalMCPServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']).default('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().optional()
})

export const GlobalMCPConfigSchema = z.object({
  servers: z.record(GlobalMCPServerConfigSchema),
  defaultServerUrl: z.string().default('http://localhost:3147/api/mcp'),
  debugMode: z.boolean().default(false),
  defaultTimeout: z.number().optional(),
  globalEnv: z.record(z.string()).optional()
})

export const GlobalInstallationRecordSchema = z.object({
  tool: z.string(),
  installedAt: z.number(),
  configPath: z.string(),
  serverName: z.string(),
  version: z.string().optional()
})

export const GlobalMCPStateSchema = z.object({
  installations: z.array(GlobalInstallationRecordSchema),
  config: GlobalMCPConfigSchema,
  lastModified: z.number()
})

export type GlobalMCPServerConfig = z.infer<typeof GlobalMCPServerConfigSchema>
export type GlobalMCPConfig = z.infer<typeof GlobalMCPConfigSchema>
export type GlobalInstallationRecord = z.infer<typeof GlobalInstallationRecordSchema>
export type GlobalMCPState = z.infer<typeof GlobalMCPStateSchema>

export interface MCPGlobalConfigDependencies {
  logger?: ReturnType<typeof createLogger>
  configPath?: string
  enableWatching?: boolean
  cacheConfig?: { ttl?: number; maxEntries?: number }
}

export interface MCPGlobalConfigService {
  initialize(): Promise<void>
  getGlobalConfig(): Promise<GlobalMCPConfig>
  updateGlobalConfig(updates: Partial<GlobalMCPConfig>): Promise<GlobalMCPConfig>
  getGlobalInstallations(): Promise<GlobalInstallationRecord[]>
  addGlobalInstallation(installation: Omit<GlobalInstallationRecord, 'installedAt'>): Promise<void>
  removeGlobalInstallation(tool: string): Promise<void>
  hasGlobalInstallation(tool: string): Promise<boolean>
  getGlobalServerConfig(): Promise<GlobalMCPServerConfig>
  getDefaultConfig(): GlobalMCPConfig
  getInstallationStatus(): Promise<{
    configExists: boolean
    configPath: string
    lastModified?: number
    totalInstallations: number
    installedTools: string[]
    installation: {
      supported: boolean
      scriptPath: string
      scriptExists: boolean
    }
  }>
  cleanup(): Promise<void>
  // EventEmitter-like interface for compatibility
  on(event: string, listener: (...args: any[]) => void): void
  emit(event: string, ...args: any[]): boolean
  removeAllListeners(): void
}

export function createMCPGlobalConfigService(deps?: MCPGlobalConfigDependencies): MCPGlobalConfigService {
  const {
    logger = createLogger('MCPGlobalConfigService'),
    configPath = path.join(os.homedir(), '.promptliano', 'global-mcp-config.json'),
    enableWatching = true,
    cacheConfig = MCPCacheConfig.config || { ttl: 30000, maxEntries: 50 }
  } = deps || {}

  // Internal state
  let stateCache: GlobalMCPState | null = null
  let fileWatcherCleanup: (() => void) | null = null
  const eventEmitter = new EventEmitter()

  /**
   * Initialize the service and ensure config directory exists
   */
  const initialize = async (): Promise<void> => {
    return withErrorContext(
      async () => {
        logger.info('Initializing MCP Global Config Service')
        
        const configDir = path.dirname(configPath)
        await fs.mkdir(configDir, { recursive: true })

        // Load or create initial state
        await loadState()

        // Set up file watching if enabled
        if (enableWatching) {
          watchConfigFile()
        }
        
        logger.info('MCP Global Config Service initialized successfully')
      },
      { entity: 'GlobalMCPConfig', action: 'initialize' }
    )
  }

  /**
   * Get the global MCP configuration with caching
   */
  const getGlobalConfig = withMCPCache(
    async (): Promise<GlobalMCPConfig> => {
      return withErrorContext(
        async () => {
          const state = await loadState()
          return state.config
        },
        { entity: 'GlobalMCPConfig', action: 'get' }
      )
    },
    { ttl: cacheConfig?.ttl || 30000, maxEntries: 1, keyGenerator: () => 'global-config' }
  )

  /**
   * Update the global MCP configuration with retry logic
   */
  const updateGlobalConfig = async (updates: Partial<GlobalMCPConfig>): Promise<GlobalMCPConfig> => {
    return withErrorContext(
      async () => {
        return withRetry(
          async () => {
            const state = await loadState()

            // Validate updates
            if (updates.servers) {
              for (const [serverName, serverConfig] of Object.entries(updates.servers)) {
                if (!serverConfig.command) {
                  throw ErrorFactory.missingRequired('command', `server ${serverName}`)
                }
              }
            }

            state.config = {
              ...state.config,
              ...updates,
              servers: {
                ...state.config.servers,
                ...(updates.servers || {})
              }
            }

            state.lastModified = Date.now()
            await saveState(state)

            eventEmitter.emit('configChanged', state.config)
            logger.info('Global MCP configuration updated successfully')
            return state.config
          },
          MCPRetryConfig.fileOperation
        )
      },
      { entity: 'GlobalMCPConfig', action: 'update' }
    )
  }

  /**
   * Get all global installations with caching
   */
  const getGlobalInstallations = withMCPCache(
    async (): Promise<GlobalInstallationRecord[]> => {
      return withErrorContext(
        async () => {
          const state = await loadState()
          return state.installations
        },
        { entity: 'GlobalMCPConfig', action: 'getInstallations' }
      )
    },
    { ttl: cacheConfig?.ttl || 30000, maxEntries: 1, keyGenerator: () => 'installations' }
  )

  /**
   * Add a global installation record with validation
   */
  const addGlobalInstallation = async (installation: Omit<GlobalInstallationRecord, 'installedAt'>): Promise<void> => {
    return withErrorContext(
      async () => {
        return withRetry(
          async () => {
            // Validate installation data
            const requiredFields = ['tool', 'configPath', 'serverName']
            for (const field of requiredFields) {
              if (!installation[field as keyof typeof installation]) {
                throw ErrorFactory.missingRequired(field, 'installation')
              }
            }
            
            // Validate tool name
            const validTools = ['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf']
            if (!validTools.includes(installation.tool)) {
              throw ErrorFactory.invalidInput('tool', validTools.join(', '), installation.tool)
            }

            const state = await loadState()

            // Remove existing installation for the same tool if any
            const existingIndex = state.installations.findIndex((i) => i.tool === installation.tool)
            if (existingIndex >= 0) {
              logger.info(`Replacing existing installation for ${installation.tool}`)
              state.installations.splice(existingIndex, 1)
            }

            // Add new installation
            const newInstallation = {
              ...installation,
              installedAt: Date.now()
            }
            state.installations.push(newInstallation)

            state.lastModified = Date.now()
            await saveState(state)

            eventEmitter.emit('installationAdded', newInstallation)
            logger.info(`Added global installation for ${installation.tool}`)
          },
          MCPRetryConfig.fileOperation
        )
      },
      { entity: 'GlobalMCPConfig', action: 'addInstallation', tool: installation.tool }
    )
  }

  /**
   * Remove a global installation record
   */
  const removeGlobalInstallation = async (tool: string): Promise<void> => {
    return withErrorContext(
      async () => {
        return withRetry(
          async () => {
            // Validate tool name
            const validTools = ['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf']
            if (!validTools.includes(tool)) {
              throw ErrorFactory.invalidInput('tool', validTools.join(', '), tool)
            }
            
            const state = await loadState()
            const removed = state.installations.find((i) => i.tool === tool)
            
            if (!removed) {
              logger.warn(`No global installation found for tool: ${tool}`)
              return
            }
            
            state.installations = state.installations.filter((i) => i.tool !== tool)
            state.lastModified = Date.now()
            await saveState(state)

            eventEmitter.emit('installationRemoved', removed)
            logger.info(`Removed global installation for ${tool}`)
          },
          MCPRetryConfig.fileOperation
        )
      },
      { entity: 'GlobalMCPConfig', action: 'removeInstallation', tool }
    )
  }

  /**
   * Check if a tool has global Promptliano installed
   */
  const hasGlobalInstallation = async (tool: string): Promise<boolean> => {
    return withErrorContext(
      async () => {
        // Validate tool name
        const validTools = ['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf']
        if (!validTools.includes(tool)) {
          throw ErrorFactory.invalidInput('tool', validTools.join(', '), tool)
        }
        const state = await loadState()
        return state.installations.some((i) => i.tool === tool)
      },
      { entity: 'GlobalMCPConfig', action: 'checkInstallation', tool }
    )
  }

  /**
   * Get global server configuration for MCP with enhanced path detection
   */
  const getGlobalServerConfig = async (): Promise<GlobalMCPServerConfig> => {
    return withErrorContext(
      async () => {
        const config = await getGlobalConfig()

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

        return {
          type: 'stdio',
          command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
          args: process.platform === 'win32' ? ['/c', scriptPath] : [scriptPath],
          env: {
            // No project ID for global installation
            PROMPTLIANO_API_URL: config.defaultServerUrl,
            MCP_DEBUG: config.debugMode ? 'true' : 'false',
            NODE_ENV: 'production',
            ...config.globalEnv
          },
          timeout: config.defaultTimeout
        }
      },
      { entity: 'GlobalMCPConfig', action: 'getServerConfig' }
    )
  }

  /**
   * Get default configuration for new installations
   */
  const getDefaultConfig = (): GlobalMCPConfig => {
    return {
      servers: {
        promptliano: {
          type: 'stdio',
          command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
          args: [],
          env: {}
        }
      },
      defaultServerUrl: 'http://localhost:3147/api/mcp',
      debugMode: false,
      globalEnv: {}
    }
  }

  /**
   * Get installation status information
   */
  const getInstallationStatus = async () => {
    return withErrorContext(
      async () => {
        const state = await loadState()
        const installations = state.installations
        
        // Get script path
        let promptlianoPath = process.cwd()
        if (promptlianoPath.includes('packages/server')) {
          promptlianoPath = path.resolve(promptlianoPath, '../..')
        }
        
        const scriptPath = process.platform === 'win32'
          ? path.join(promptlianoPath, 'packages/server/mcp-start.bat')
          : path.join(promptlianoPath, 'packages/server/mcp-start.sh')
        
        const scriptExists = await MCPFileOps.fileExists(scriptPath)
        const configExists = await MCPFileOps.fileExists(configPath)
        
        let lastModified: number | undefined
        if (configExists) {
          try {
            const stats = await fs.stat(configPath)
            lastModified = stats.mtime.getTime()
          } catch {
            // Ignore stat errors
          }
        }
        
        return {
          configExists,
          configPath,
          lastModified,
          totalInstallations: installations.length,
          installedTools: installations.map(i => i.tool),
          installation: {
            supported: true,
            scriptPath,
            scriptExists
          }
        }
      },
      { entity: 'GlobalMCPConfig', action: 'getInstallationStatus' }
    )
  }

  /**
   * Load state from disk with validation and retry
   */
  const loadState = async (): Promise<GlobalMCPState> => {
    // Return cached state if available
    if (stateCache) {
      return stateCache
    }

    return withRetry(
      async () => {
        try {
          const content = await fs.readFile(configPath, 'utf-8')
          const rawState = JSON.parse(content)
          stateCache = GlobalMCPStateSchema.parse(rawState)
          logger.debug('Loaded global MCP state from disk')
          return stateCache
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
            // File doesn't exist, create default state
            logger.info('Creating new global MCP configuration file')
          } else {
            logger.warn('Invalid global MCP configuration, creating new one:', error)
          }
          
          // Create default state
          const defaultState: GlobalMCPState = {
            installations: [],
            config: getDefaultConfig(),
            lastModified: Date.now()
          }

          stateCache = defaultState
          await saveState(defaultState)
          return defaultState
        }
      },
      MCPRetryConfig.configLoad
    )
  }

  /**
   * Save state to disk with backup and validation
   */
  const saveState = async (state: GlobalMCPState): Promise<void> => {
    // Validate state before saving
    const validatedState = GlobalMCPStateSchema.parse(state)
    
    await MCPFileOps.writeJsonFile(configPath, validatedState, {
      createBackup: true,
      configType: 'GlobalMCPConfig'
    })
    
    stateCache = validatedState
    logger.info('Global MCP configuration saved successfully')
  }

  /**
   * Watch configuration file for changes with improved error handling
   */
  const watchConfigFile = (): void => {
    if (fileWatcherCleanup) {
      fileWatcherCleanup()
      fileWatcherCleanup = null
    }

    try {
      fileWatcherCleanup = createMCPFileWatcher(
        configPath,
        async () => {
          logger.info('Global MCP config file changed, reloading')

          // Clear cache to force reload
          stateCache = null

          try {
            const state = await loadState()
            eventEmitter.emit('stateChanged', state)
            logger.debug('Global config reloaded successfully')
          } catch (error) {
            logger.error('Failed to reload global config:', error)
            eventEmitter.emit('configError', error)
          }
        },
        { configType: 'GlobalMCPConfig' }
      )
    } catch (error) {
      logger.error('Failed to watch global config file:', error)
      // Don't throw, as watching is not critical for functionality
    }
  }

  /**
   * Clean up resources
   */
  const cleanup = async (): Promise<void> => {
    return withErrorContext(
      async () => {
        logger.info('Cleaning up MCP Global Config Service')
        
        if (fileWatcherCleanup) {
          try {
            fileWatcherCleanup()
            fileWatcherCleanup = null
          } catch (error) {
            logger.error('Failed to close file watcher:', error)
          }
        }

        stateCache = null
        eventEmitter.removeAllListeners()
        logger.info('MCP Global Config Service cleanup complete')
      },
      { entity: 'GlobalMCPConfig', action: 'cleanup' }
    )
  }

  return {
    initialize,
    getGlobalConfig,
    updateGlobalConfig,
    getGlobalInstallations,
    addGlobalInstallation,
    removeGlobalInstallation,
    hasGlobalInstallation,
    getGlobalServerConfig,
    getDefaultConfig,
    getInstallationStatus,
    cleanup,
    // EventEmitter compatibility
    on: eventEmitter.on.bind(eventEmitter),
    emit: eventEmitter.emit.bind(eventEmitter),
    removeAllListeners: eventEmitter.removeAllListeners.bind(eventEmitter),
  }
}

// Export singleton for backwards compatibility
export const mcpGlobalConfigService = createMCPGlobalConfigService()

// Export types for consumers - interface already exported above
