import * as fs from 'fs/promises'
import { withRetry, withCache } from './service-helpers'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { createLogger } from './logger'

const logger = createLogger('MCPServiceHelpers')

/**
 * MCP-specific error factory
 */
export const MCPErrorFactory = {
  configNotFound: (configType: string, path?: string) =>
    ErrorFactory.notFound(`${configType} config`, path || 'unknown'),
    
  configInvalid: (configType: string, path: string, error: Error) =>
    ErrorFactory.validationFailed(error, {
      context: `${configType} configuration`,
      path,
    }),
    
  installationFailed: (tool: string, reason: string) =>
    ErrorFactory.operationFailed(`install MCP for ${tool}: ${reason}`),
    
  toolNotInstalled: (tool: string) =>
    ErrorFactory.notFound(`${tool} installation`, tool),
    
  scriptNotExecutable: (scriptPath: string) =>
    ErrorFactory.operationFailed(`make script executable: ${scriptPath}`),
    
  platformNotSupported: (platform: string, operation: string) =>
    ErrorFactory.invalidInput('platform', 'darwin, win32, or linux', platform, {
      context: operation,
    }),
    
  fileWatcherFailed: (path: string, error: Error) =>
    ErrorFactory.operationFailed(`watch file ${path}: ${error.message}`),
    
  cacheLimitExceeded: (limit: number, current: number) =>
    ErrorFactory.operationFailed(`cache limit exceeded: ${current} > ${limit}`),
}

/**
 * File system operations with MCP-specific error handling
 */
export const MCPFileOps = {
  /**
   * Read and parse JSON file safely with MCP error context
   */
  async readJsonFile<T>(filePath: string, configType: string): Promise<T | null> {
    return withErrorContext(
      async () => {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          return JSON.parse(content)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null
          }
          throw MCPErrorFactory.configInvalid(
            configType,
            filePath,
            error instanceof Error ? error : new Error(String(error))
          )
        }
      },
      { entity: 'config', action: 'read', path: filePath }
    )
  },

  /**
   * Write JSON file safely with backup
   */
  async writeJsonFile(
    filePath: string,
    data: any,
    options: { createBackup?: boolean; configType?: string } = {}
  ): Promise<{ backupPath?: string }> {
    const { createBackup = false, configType = 'config' } = options
    
    return withErrorContext(
      async () => {
        let backupPath: string | undefined

        if (createBackup) {
          try {
            await fs.access(filePath)
            backupPath = `${filePath}.backup-${Date.now()}`
            await fs.copyFile(filePath, backupPath)
          } catch {
            // File doesn't exist, no backup needed
          }
        }

        // Ensure directory exists
        const dir = require('path').dirname(filePath)
        await fs.mkdir(dir, { recursive: true })

        // Write file
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

        return { backupPath }
      },
      { entity: configType, action: 'write', path: filePath }
    )
  },

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  },

  /**
   * Make script executable on Unix-like systems
   */
  async makeExecutable(scriptPath: string): Promise<void> {
    return withErrorContext(
      async () => {
        if (process.platform !== 'win32') {
          try {
            await fs.chmod(scriptPath, 0o755)
          } catch (error) {
            throw MCPErrorFactory.scriptNotExecutable(scriptPath)
          }
        }
      },
      { entity: 'script', action: 'makeExecutable', path: scriptPath }
    )
  },
}

/**
 * Installation progress tracking
 */
export interface InstallationProgress {
  step: string
  progress: number
  total: number
  message?: string
}

export type ProgressCallback = (progress: InstallationProgress) => void

export function createProgressTracker(
  steps: string[],
  onProgress?: ProgressCallback
): {
  startStep: (step: string, message?: string) => void
  completeStep: (step: string, message?: string) => void
  error: (step: string, error: Error) => void
  getProgress: () => InstallationProgress
} {
  let currentStepIndex = 0
  let completedSteps = 0

  const startStep = (step: string, message?: string) => {
    currentStepIndex = steps.indexOf(step)
    const progress = {
      step,
      progress: completedSteps,
      total: steps.length,
      message,
    }
    onProgress?.(progress)
  }

  const completeStep = (step: string, message?: string) => {
    completedSteps++
    const progress = {
      step,
      progress: completedSteps,
      total: steps.length,
      message,
    }
    onProgress?.(progress)
  }

  const error = (step: string, error: Error) => {
    const progress = {
      step,
      progress: completedSteps,
      total: steps.length,
      message: `Error: ${error.message}`,
    }
    onProgress?.(progress)
  }

  const getProgress = (): InstallationProgress => ({
    step: steps[currentStepIndex] || 'unknown',
    progress: completedSteps,
    total: steps.length,
  })

  return { startStep, completeStep, error, getProgress }
}

/**
 * Retry configuration for MCP operations
 */
export const MCPRetryConfig = {
  fileOperation: {
    maxAttempts: 3,
    delay: 500,
    backoff: 2,
    shouldRetry: (error: any) => {
      const code = (error as NodeJS.ErrnoException)?.code
      return code === 'EBUSY' || code === 'ENOENT' || code === 'EMFILE'
    },
  },
  
  installation: {
    maxAttempts: 2,
    delay: 1000,
    backoff: 1.5,
    shouldRetry: (error: any) => {
      // Retry on transient errors, but not on validation errors
      return !error?.message?.includes('validation') && !error?.message?.includes('invalid')
    },
  },
  
  configLoad: {
    maxAttempts: 3,
    delay: 200,
    backoff: 1.5,
    shouldRetry: () => true,
  },
}

/**
 * Cache configuration for MCP services
 */
export const MCPCacheConfig = {
  config: {
    ttl: 30000, // 30 seconds
    maxEntries: 50,
  },
  
  metadata: {
    ttl: 60000, // 1 minute
    maxEntries: 100,
  },
  
  installation: {
    ttl: 300000, // 5 minutes
    maxEntries: 20,
  },
}

/**
 * Enhanced cache with memory limits
 */
export function withMCPCache<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    ttl?: number
    maxEntries?: number
    keyGenerator?: (...args: TArgs) => string
  } = {}
) {
  const { ttl = MCPCacheConfig.config.ttl, maxEntries = MCPCacheConfig.config.maxEntries, keyGenerator = (...args) => JSON.stringify(args) } = options
  
  const cache = new Map<string, { value: TResult; expires: number }>()

  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args)
    const cached = cache.get(key)

    // Return cached value if still valid
    if (cached && cached.expires > Date.now()) {
      return cached.value
    }

    // Execute function
    const value = await fn(...args)

    // Check cache size limit before adding
    if (cache.size >= maxEntries) {
      // Remove expired entries first
      const now = Date.now()
      for (const [k, v] of cache.entries()) {
        if (v.expires < now) {
          cache.delete(k)
        }
      }

      // If still at limit, remove oldest entries (LRU)
      if (cache.size >= maxEntries) {
        const entriesToRemove = cache.size - maxEntries + 1
        const entries = Array.from(cache.entries())
        entries.sort((a, b) => a[1].expires - b[1].expires)
        
        for (let i = 0; i < entriesToRemove; i++) {
          const entryToRemove = entries[i]
          if (entryToRemove) {
            cache.delete(entryToRemove[0])
          }
        }
      }
    }

    cache.set(key, {
      value,
      expires: Date.now() + ttl,
    })

    return value
  }
}

/**
 * Validation helpers for MCP configurations
 */
export const MCPValidation = {
  /**
   * Validate that required fields are present in config
   */
  validateRequiredFields<T extends Record<string, any>>(
    config: T,
    requiredFields: (keyof T)[],
    configType: string
  ): void {
    for (const field of requiredFields) {
      if (config[field] === undefined || config[field] === null) {
        throw ErrorFactory.missingRequired(String(field), configType)
      }
    }
  },

  /**
   * Validate platform support
   */
  validatePlatform(operation: string): void {
    const platform = process.platform
    if (!['darwin', 'win32', 'linux'].includes(platform)) {
      throw MCPErrorFactory.platformNotSupported(platform, operation)
    }
  },

  /**
   * Validate tool name
   */
  validateTool(tool: string): void {
    const validTools = ['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf']
    if (!validTools.includes(tool)) {
      throw ErrorFactory.invalidInput('tool', validTools.join(', '), tool)
    }
  },
}

/**
 * File watcher with MCP-specific error handling
 */
export function createMCPFileWatcher(
  filePath: string,
  onChange: () => void,
  options: {
    debounceMs?: number
    configType?: string
  } = {}
): () => void {
  const { debounceMs = 300, configType = 'config' } = options
  
  let watcher: any = null
  let debounceTimer: NodeJS.Timeout | null = null

  try {
    const fs = require('fs')
    
    watcher = fs.watch(filePath, (eventType: string) => {
      if (eventType === 'change') {
        // Debounce rapid changes
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        
        debounceTimer = setTimeout(() => {
          try {
            onChange()
          } catch (error) {
            logger.error(`Error in ${configType} watcher:`, error)
          }
        }, debounceMs)
      }
    })
    
    watcher.on('error', (error: Error) => {
      logger.error(`File watcher error for ${filePath}:`, error)
      throw MCPErrorFactory.fileWatcherFailed(filePath, error)
    })
  } catch (error) {
    throw MCPErrorFactory.fileWatcherFailed(
      filePath,
      error instanceof Error ? error : new Error(String(error))
    )
  }

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    
    if (watcher) {
      try {
        watcher.close()
      } catch (error) {
        logger.debug('Error closing file watcher:', error)
      }
      watcher = null
    }
  }
}

/**
 * Environment variable expansion for MCP configs
 */
export function expandMCPVariables(
  value: string,
  variables: Record<string, string>
): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const [name, defaultValue] = varName.split(':-')
    const envValue = variables[name]
    
    if (envValue !== undefined) {
      return envValue
    } else if (defaultValue !== undefined) {
      return defaultValue
    } else {
      logger.debug(`Environment variable ${name} not found, keeping placeholder`)
      return match
    }
  })
}

/**
 * Platform-specific path helpers
 */
export const MCPPlatformPaths = {
  getConfigDir(tool: string): string | null {
    const platform = process.platform
    const home = require('os').homedir()
    const path = require('path')
    
    switch (tool) {
      case 'claude-desktop':
        switch (platform) {
          case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Claude')
          case 'win32':
            return path.join(process.env.APPDATA || home, 'Claude')
          case 'linux':
            return path.join(home, '.config', 'claude')
          default:
            return null
        }
        
      case 'vscode':
        switch (platform) {
          case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Code', 'User')
          case 'win32':
            return path.join(process.env.APPDATA || home, 'Code', 'User')
          case 'linux':
            return path.join(home, '.config', 'Code', 'User')
          default:
            return null
        }
        
      case 'cursor':
        switch (platform) {
          case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Cursor', 'User')
          case 'win32':
            return path.join(process.env.APPDATA || home, 'Cursor', 'User')
          case 'linux':
            return path.join(home, '.config', 'Cursor', 'User')
          default:
            return null
        }
        
      case 'windsurf':
        switch (platform) {
          case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Windsurf', 'User')
          case 'win32':
            return path.join(process.env.APPDATA || home, 'Windsurf', 'User')
          case 'linux':
            return path.join(home, '.config', 'Windsurf', 'User')
          default:
            return null
        }
        
      case 'continue':
        return path.join(home, '.continue')
        
      case 'claude-code':
        return home // Claude Code uses ~/.claude.json
        
      default:
        return null
    }
  },
  
  getConfigFileName(tool: string): string {
    switch (tool) {
      case 'claude-desktop':
        return 'claude_desktop_config.json'
      case 'vscode':
      case 'cursor':
      case 'windsurf':
        return 'settings.json'
      case 'continue':
        return 'config.json'
      case 'claude-code':
        return '.claude.json'
      default:
        throw ErrorFactory.invalidInput('tool', 'valid MCP tool name', tool)
    }
  },
  
  getFullConfigPath(tool: string): string | null {
    const configDir = this.getConfigDir(tool)
    if (!configDir) return null
    
    const fileName = this.getConfigFileName(tool)
    const path = require('path')
    
    if (tool === 'claude-code') {
      return path.join(configDir, fileName)
    } else {
      return path.join(configDir, fileName)
    }
  },
}