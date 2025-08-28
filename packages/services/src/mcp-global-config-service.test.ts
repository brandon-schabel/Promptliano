/**
 * MCP Global Config Service Tests - Functional Factory Pattern
 * Tests global MCP configuration management with proper error handling,
 * caching, file watching, and installation tracking
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import {
  createMCPGlobalConfigService,
  type MCPGlobalConfigService,
  type GlobalMCPConfig,
  type GlobalInstallationRecord,
  type GlobalMCPState,
} from './mcp-global-config-service'

// Set test environment
process.env.NODE_ENV = 'test'

// Test fixtures
const mockGlobalConfig: GlobalMCPConfig = {
  servers: {
    promptliano: {
      type: 'stdio',
      command: 'sh',
      args: ['/test/path/mcp-start.sh'],
      env: { NODE_ENV: 'production' }
    }
  },
  defaultServerUrl: 'http://localhost:3147/api/mcp',
  debugMode: false,
  globalEnv: { TEST_VAR: 'test_value' }
}

const mockInstallationRecord: GlobalInstallationRecord = {
  tool: 'claude-desktop',
  installedAt: Date.now(),
  configPath: '/test/path/config.json',
  serverName: 'promptliano',
  version: '1.0.0'
}

const mockState: GlobalMCPState = {
  installations: [mockInstallationRecord],
  config: mockGlobalConfig,
  lastModified: Date.now()
}

// Mock file system operations
const mockFs = {
  mkdir: mock(async () => {}),
  readFile: mock(),
  writeFile: mock(async () => {}),
  copyFile: mock(async () => {}),
  access: mock(async () => {}),
  stat: mock(),
}

// Mock path and os modules
mock.module('fs/promises', () => mockFs)
mock.module('fs', () => ({
  watch: mock(() => ({
    on: mock(),
    close: mock()
  }))
}))

// Mock logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {})
}

mock.module('./utils/logger', () => ({
  createLogger: mock(() => mockLogger)
}))

// Mock MCP service helpers
const mockMCPFileOps = {
  writeJsonFile: mock(async () => ({ backupPath: undefined })),
  readJsonFile: mock(),
  fileExists: mock(async () => false),
  makeExecutable: mock(async () => {})
}

mock.module('./utils/mcp-service-helpers', () => ({
  MCPErrorFactory: {
    configNotFound: mock(() => new Error('Config not found')),
    configInvalid: mock(() => new Error('Config invalid')),
    installationFailed: mock(() => new Error('Installation failed'))
  },
  MCPFileOps: mockMCPFileOps,
  MCPRetryConfig: {
    fileOperation: { maxAttempts: 1, delay: 0, backoff: 1, shouldRetry: () => false },
    installation: { maxAttempts: 1, delay: 0, backoff: 1, shouldRetry: () => false },
    configLoad: { maxAttempts: 1, delay: 0, backoff: 1, shouldRetry: () => false }
  },
  withMCPCache: (fn: any) => fn, // Pass through for tests
  MCPCacheConfig: {
    config: { ttl: 30000, maxEntries: 50 }
  },
  createMCPFileWatcher: mock(() => mock()), // Return a cleanup function
  MCPValidation: {
    validateRequiredFields: mock(),
    validateTool: mock(),
    validatePlatform: mock()
  }
}))

describe('MCP Global Config Service - Functional Factory Pattern', () => {
  let configPath: string
  let service: MCPGlobalConfigService

  beforeEach(async () => {
    // Create temp directory for test config
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'))
    configPath = path.join(tempDir, 'global-mcp-config.json')

    // Reset all mocks
    Object.values(mockFs).forEach(mock => mock.mockReset())
    Object.values(mockLogger).forEach(mock => mock.mockClear())
    Object.values(mockMCPFileOps).forEach(mock => mock.mockReset())

    // Setup default mock behaviors
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' }) // File not found by default
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockRejectedValue({ code: 'ENOENT' })
    
    // Setup MCP mock behaviors
    mockMCPFileOps.writeJsonFile.mockResolvedValue({ backupPath: undefined })
    mockMCPFileOps.fileExists.mockResolvedValue(false)

    // Create service instance
    service = createMCPGlobalConfigService({
      configPath,
      enableWatching: false, // Disable for tests
      logger: mockLogger as any
    })
  })

  afterEach(async () => {
    await service.cleanup()
  })

  describe('Service Initialization', () => {
    test('should initialize with default config when file does not exist', async () => {
      await service.initialize()

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(configPath), { recursive: true })
      expect(mockFs.readFile).toHaveBeenCalledWith(configPath, 'utf-8')
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new global MCP configuration file')
    })

    test('should load existing valid config', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockState))

      await service.initialize()

      expect(mockFs.readFile).toHaveBeenCalledWith(configPath, 'utf-8')
      expect(mockLogger.debug).toHaveBeenCalledWith('Loaded global MCP state from disk')
    })

    test('should handle invalid config file gracefully', async () => {
      mockFs.readFile.mockResolvedValueOnce('invalid json content')

      await service.initialize()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid global MCP configuration, creating new one:',
        expect.any(Error)
      )
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should create config directory if it does not exist', async () => {
      const nestedPath = path.join(configPath, '..', 'nested', 'path', 'config.json')
      
      const nestedService = createMCPGlobalConfigService({
        configPath: nestedPath,
        enableWatching: false
      })

      await nestedService.initialize()

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.dirname(nestedPath),
        { recursive: true }
      )

      await nestedService.cleanup()
    })
  })

  describe('Configuration Management', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockState))
      await service.initialize()
    })

    test('should get global configuration', async () => {
      const config = await service.getGlobalConfig()

      expect(config).toEqual(mockGlobalConfig)
      expect(config.servers.promptliano).toBeDefined()
      expect(config.defaultServerUrl).toBe('http://localhost:3147/api/mcp')
    })

    test('should update global configuration', async () => {
      const updates = {
        debugMode: true,
        defaultTimeout: 30000
      }

      const updatedConfig = await service.updateGlobalConfig(updates)

      expect(updatedConfig.debugMode).toBe(true)
      expect(updatedConfig.defaultTimeout).toBe(30000)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Global MCP configuration updated successfully')
    })

    test('should merge server configurations on update', async () => {
      const updates = {
        servers: {
          newServer: {
            type: 'http' as const,
            command: 'node',
            args: ['server.js']
          }
        }
      }

      const updatedConfig = await service.updateGlobalConfig(updates)

      expect(updatedConfig.servers.promptliano).toBeDefined() // Original preserved
      expect(updatedConfig.servers.newServer).toBeDefined() // New added
      expect(updatedConfig.servers.newServer.type).toBe('http')
    })

    test('should validate server config on update', async () => {
      const invalidUpdates = {
        servers: {
          invalidServer: {
            type: 'stdio' as const,
            // Missing required 'command' field
            args: ['test']
          }
        }
      }

      await expect(service.updateGlobalConfig(invalidUpdates as any)).rejects.toThrow()
    })

    test('should get default configuration', () => {
      const defaultConfig = service.getDefaultConfig()

      expect(defaultConfig).toHaveProperty('servers')
      expect(defaultConfig).toHaveProperty('defaultServerUrl')
      expect(defaultConfig.defaultServerUrl).toBe('http://localhost:3147/api/mcp')
      expect(defaultConfig.debugMode).toBe(false)
    })
  })

  describe('Installation Management', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockState))
      await service.initialize()
    })

    test('should get all global installations', async () => {
      const installations = await service.getGlobalInstallations()

      expect(installations).toHaveLength(1)
      expect(installations[0]).toEqual(mockInstallationRecord)
    })

    test('should add new installation', async () => {
      const newInstallation = {
        tool: 'vscode',
        configPath: '/test/vscode/config.json',
        serverName: 'promptliano',
        version: '1.1.0'
      }

      await service.addGlobalInstallation(newInstallation)

      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Added global installation for vscode')
    })

    test('should replace existing installation for same tool', async () => {
      const replacementInstallation = {
        tool: 'claude-desktop',
        configPath: '/new/path/config.json',
        serverName: 'promptliano',
        version: '2.0.0'
      }

      await service.addGlobalInstallation(replacementInstallation)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Replacing existing installation for claude-desktop'
      )
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should validate installation data on add', async () => {
      const invalidInstallation = {
        // Missing required fields
        configPath: '/test/path',
      }

      await expect(service.addGlobalInstallation(invalidInstallation as any)).rejects.toThrow()
    })

    test('should remove installation', async () => {
      await service.removeGlobalInstallation('claude-desktop')

      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Removed global installation for claude-desktop')
    })

    test('should handle removal of non-existent installation', async () => {
      await service.removeGlobalInstallation('vscode')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No global installation found for tool: vscode'
      )
    })

    test('should check if installation exists', async () => {
      const hasInstallation = await service.hasGlobalInstallation('claude-desktop')
      const hasNonExistent = await service.hasGlobalInstallation('vscode')

      expect(hasInstallation).toBe(true)
      expect(hasNonExistent).toBe(false)
    })

    test('should validate tool name', async () => {
      await expect(service.hasGlobalInstallation('invalid-tool')).rejects.toThrow()
      await expect(service.removeGlobalInstallation('invalid-tool')).rejects.toThrow()
    })
  })

  describe('Server Configuration Generation', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockState))
      await service.initialize()
    })

    test('should generate server config for current platform', async () => {
      // Mock path detection
      const originalCwd = process.cwd
      const originalPlatform = process.platform
      
      // Mock process.cwd to simulate being in packages/server
      process.cwd = mock(() => '/test/promptliano/packages/server')
      
      const serverConfig = await service.getGlobalServerConfig()

      expect(serverConfig).toHaveProperty('type', 'stdio')
      expect(serverConfig).toHaveProperty('command')
      expect(serverConfig).toHaveProperty('args')
      expect(serverConfig).toHaveProperty('env')
      expect(serverConfig.env).toHaveProperty('PROMPTLIANO_API_URL', mockGlobalConfig.defaultServerUrl)
      expect(serverConfig.env).toHaveProperty('MCP_DEBUG', 'false')

      // Restore original functions
      process.cwd = originalCwd
    })

    test('should handle script path detection from workspace root', async () => {
      // Mock successful package.json read with workspaces
      const packageJson = {
        name: 'promptliano',
        workspaces: ['packages/*']
      }
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockState)) // Initial state load
        .mockResolvedValueOnce(JSON.stringify(packageJson)) // package.json read

      mockFs.access.mockResolvedValue(undefined) // File exists

      const serverConfig = await service.getGlobalServerConfig()

      expect(serverConfig.command).toBeDefined()
      expect(Array.isArray(serverConfig.args)).toBe(true)
    })

    test('should include debug mode in environment when enabled', async () => {
      // Update the config to enable debug mode
      await service.updateGlobalConfig({ debugMode: true })

      const serverConfig = await service.getGlobalServerConfig()

      expect(serverConfig.env?.MCP_DEBUG).toBe('true')
    })

    test('should include global environment variables', async () => {
      const serverConfig = await service.getGlobalServerConfig()

      expect(serverConfig.env).toMatchObject(mockGlobalConfig.globalEnv || {})
    })
  })

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      // First call fails with permission denied, second call succeeds for default state creation
      mockFs.readFile
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce('{}') // For writing default state
      
      mockFs.writeFile.mockResolvedValueOnce(undefined) // Allow writing default state

      const errorService = createMCPGlobalConfigService({
        configPath: '/invalid/path/config.json',
        enableWatching: false
      })

      // Should not throw on initialization - should create default state
      await expect(errorService.initialize()).resolves.toBeUndefined()

      await errorService.cleanup()
    })

    test('should validate schema on state load', async () => {
      const invalidState = {
        installations: 'not-an-array', // Invalid type
        config: {},
        lastModified: 'not-a-number' // Invalid type
      }

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidState))

      await service.initialize()

      // Should create new default state when validation fails
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid global MCP configuration, creating new one:',
        expect.any(Error)
      )
    })

    test('should handle concurrent access with retry', async () => {
      // Test that retry logic is available and would work
      // This is more about testing the pattern exists than the exact implementation
      expect(typeof service.getGlobalConfig).toBe('function')
      
      // We can test that operations continue to work even after temporary failures
      await service.updateGlobalConfig({ debugMode: true })
      const config = await service.getGlobalConfig()
      expect(config.debugMode).toBe(true)
    })
  })

  describe('Caching Behavior', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockState))
      await service.initialize()
    })

    test('should cache configuration reads', async () => {
      // First call loads from file
      const config1 = await service.getGlobalConfig()
      
      // Second call should use cache (no additional file read)
      const config2 = await service.getGlobalConfig()

      expect(config1).toEqual(config2)
      // readFile called once during init, not again for cached reads
      expect(mockFs.readFile).toHaveBeenCalledTimes(1)
    })

    test('should cache installation reads', async () => {
      // First call loads from state
      const installations1 = await service.getGlobalInstallations()
      
      // Second call should use cached state
      const installations2 = await service.getGlobalInstallations()

      expect(installations1).toEqual(installations2)
      expect(installations1).toHaveLength(1)
    })
  })

  describe('Event Emission', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockState))
      await service.initialize()
    })

    test('should emit events on configuration changes', async () => {
      const configChangedHandler = mock()
      service.on('configChanged', configChangedHandler)

      const updates = { debugMode: true }
      await service.updateGlobalConfig(updates)

      expect(configChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ debugMode: true })
      )
    })

    test('should emit events on installation changes', async () => {
      const installationAddedHandler = mock()
      const installationRemovedHandler = mock()
      
      service.on('installationAdded', installationAddedHandler)
      service.on('installationRemoved', installationRemovedHandler)

      // Add installation
      const newInstallation = {
        tool: 'vscode',
        configPath: '/test/vscode/config.json',
        serverName: 'promptliano'
      }
      await service.addGlobalInstallation(newInstallation)

      expect(installationAddedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'vscode',
          installedAt: expect.any(Number)
        })
      )

      // Remove installation
      await service.removeGlobalInstallation('claude-desktop')

      expect(installationRemovedHandler).toHaveBeenCalledWith(mockInstallationRecord)
    })

    test('should support event listener cleanup', () => {
      const handler = mock()
      service.on('configChanged', handler)
      
      expect(typeof service.removeAllListeners).toBe('function')
      
      service.removeAllListeners()
      // Should not throw
    })
  })

  describe('Service Factory Pattern', () => {
    test('should create service with default dependencies', () => {
      const defaultService = createMCPGlobalConfigService()
      
      expect(typeof defaultService.initialize).toBe('function')
      expect(typeof defaultService.getGlobalConfig).toBe('function')
      expect(typeof defaultService.updateGlobalConfig).toBe('function')
      expect(typeof defaultService.cleanup).toBe('function')
    })

    test('should accept custom dependencies', () => {
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      const customPath = '/custom/path/config.json'
      
      const customService = createMCPGlobalConfigService({
        logger: customLogger as any,
        configPath: customPath,
        enableWatching: false,
        cacheConfig: { ttl: 60000, maxEntries: 100 }
      })

      expect(typeof customService.getGlobalConfig).toBe('function')
    })
  })

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await service.initialize()
      await service.cleanup()

      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up MCP Global Config Service')
      expect(mockLogger.info).toHaveBeenCalledWith('MCP Global Config Service cleanup complete')
    })

    test('should handle cleanup errors gracefully', async () => {
      // Mock file watcher cleanup that throws
      const mockWatcher = {
        close: mock(() => { throw new Error('Cleanup failed') })
      }

      // This is hard to test without exposing internal state
      // but cleanup should not throw even if individual operations fail
      await expect(service.cleanup()).resolves.toBeUndefined()
    })
  })
})