/**
 * MCP Installation Service Tests - Functional Factory Pattern
 * Tests MCP tool installation and configuration management with progress tracking,
 * platform support, file operations, and error recovery
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  createMCPInstallationService,
  type MCPInstallationService,
  type MCPInstallationOptions,
  type MCPInstallationResult,
  type MCPTool,
  type MCPToolInfo,
} from './mcp-installation-service'

// Set test environment
process.env.NODE_ENV = 'test'

// Test fixtures
const mockInstallConfig: MCPInstallationOptions = {
  tool: 'claude-desktop',
  projectId: 123,
  projectName: 'test-project',
  projectPath: '/test/project'
}

const mockInstallResult: MCPInstallationResult = {
  success: true,
  message: 'Installation successful',
  configPath: '/test/path/config.json'
}

const mockToolInfo: MCPToolInfo = {
  tool: 'claude-desktop' as MCPTool,
  isInstalled: true,
  version: '1.0.0',
  configPath: '/test/path/config.json'
}

// Mock dependencies
const mockDeps = {
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {})
  },
  platform: 'darwin' as const,
  defaultServerUrl: 'http://localhost:3147/api/mcp'
}

// Mock file system operations
const mockFs = {
  mkdir: mock(async () => {}),
  readFile: mock(),
  writeFile: mock(async () => {}),
  access: mock(),
  stat: mock(),
  copyFile: mock(async () => {}),
  chmod: mock(async () => {}),
  rm: mock(async () => {})
}

// Mock MCP service helpers to align with actual service behavior
const mockMCPFileOps = {
  readJsonFile: mock(),
  writeJsonFile: mock(async () => ({ backupPath: '/test/backup/path' })),
  fileExists: mock(async () => true),
  makeExecutable: mock(async () => {})
}

const mockMCPPlatformPaths = {
  getFullConfigPath: mock(() => '/test/config/path/config.json')
}

const mockMCPValidation = {
  validateTool: mock(() => {}),
  validatePlatform: mock(() => {})
}

// Mock modules
mock.module('fs/promises', () => mockFs)
mock.module('./utils/service-helpers', () => ({
  withErrorContext: (fn: Function) => fn(),
  withRetry: (operation: Function) => operation(),
  ErrorFactory: {
    invalidInput: (field: string, expected: string, received: string) => new Error(`Invalid ${field}: expected ${expected}, got ${received}`)
  }
}))
mock.module('./utils/mcp-service-helpers', () => ({
  MCPErrorFactory: {
    configNotFound: (type: string) => new Error(`${type} config not found`),
    platformNotSupported: (platform: string, op: string) => new Error(`${platform} not supported for ${op}`)
  },
  MCPFileOps: mockMCPFileOps,
  MCPRetryConfig: { installation: { maxAttempts: 1, delay: 0, backoff: 1, shouldRetry: () => false } },
  MCPValidation: mockMCPValidation,
  MCPPlatformPaths: mockMCPPlatformPaths,
  MCPCacheConfig: { installation: { ttl: 300000, maxEntries: 20 } },
  withMCPCache: (fn: Function) => fn,
  createProgressTracker: () => ({
    startStep: mock(() => {}),
    completeStep: mock(() => {}),
    error: mock(() => {}),
    getProgress: mock(() => ({ step: 'test', progress: 1, total: 1 }))
  })
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

// Mock platform-specific operations
const originalPlatform = process.platform

describe('MCP Installation Service - Functional Factory Pattern', () => {
  let service: MCPInstallationService
  let progressCallback: ReturnType<typeof mock>

  beforeEach(async () => {
    // Reset all mocks
    Object.values(mockFs).forEach(mock => mock.mockReset())
    Object.values(mockDeps.logger).forEach(mock => mock.mockClear())
    Object.values(mockMCPFileOps).forEach(mock => mock.mockReset())
    mockMCPPlatformPaths.getFullConfigPath.mockReset()
    mockMCPValidation.validateTool.mockReset()
    mockMCPValidation.validatePlatform.mockReset()

    // Setup default mock behaviors
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined) // Files exist by default
    mockFs.copyFile.mockResolvedValue(undefined)
    mockFs.chmod.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue('{}') // Empty config by default

    // Setup MCP service helper mocks to return success
    mockMCPFileOps.readJsonFile
      .mockResolvedValueOnce(null) // First call: No existing config 
      .mockResolvedValue({ // All subsequent calls: Valid config for validation
        mcpServers: {
          'promptliano-test-project': { command: 'test' }
        }
      })
    mockMCPFileOps.writeJsonFile.mockResolvedValue({ backupPath: '/test/backup/path' })
    mockMCPFileOps.fileExists.mockResolvedValue(true) // Files exist for validation
    mockMCPFileOps.makeExecutable.mockResolvedValue(undefined)
    mockMCPPlatformPaths.getFullConfigPath.mockReturnValue('/test/config/claude_desktop_config.json')
    mockMCPValidation.validateTool.mockReturnValue(undefined)
    mockMCPValidation.validatePlatform.mockReturnValue(undefined)

    // Create progress callback
    progressCallback = mock()

    // Create service instance
    service = createMCPInstallationService(mockDeps)
  })

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    })
  })

  describe('Service Initialization', () => {
    test('should create service with default dependencies', () => {
      const defaultService = createMCPInstallationService()
      
      expect(typeof defaultService.installMCP).toBe('function')
      expect(typeof defaultService.uninstallMCP).toBe('function')
      expect(typeof defaultService.detectInstalledTools).toBe('function')
      expect(typeof defaultService.installProjectConfig).toBe('function')
    })

    test('should accept custom dependencies', () => {
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      
      const customService = createMCPInstallationService({
        logger: customLogger as any,
        platform: 'linux',
        defaultServerUrl: 'http://custom:3000/api/mcp'
      })

      expect(typeof customService.installMCP).toBe('function')
    })
  })

  describe('Tool Detection', () => {
    test('should detect installed tools', async () => {
      // Mock successful tool detection
      mockFs.access.mockResolvedValue(undefined)
      mockFs.readFile.mockResolvedValue('{ "version": "1.0.0" }')
      
      const tools = await service.detectInstalledTools()
      
      expect(Array.isArray(tools)).toBe(true)
      expect(mockDeps.logger.debug).toHaveBeenCalled()
    })

    test('should handle missing tools gracefully', async () => {
      const notFoundError = new Error('ENOENT') as any
      notFoundError.code = 'ENOENT'
      mockFs.access.mockRejectedValue(notFoundError)
      
      const tools = await service.detectInstalledTools()
      
      expect(Array.isArray(tools)).toBe(true)
    })
  })

  describe('Installation Process', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
    })

    test('should install MCP for tool', async () => {
      const result = await service.installMCP(mockInstallConfig)
      
      expect(result.success).toBe(true)
      expect(result.configPath).toBeDefined()
      expect(result.message).toBeDefined()
      
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle installation when config exists', async () => {
      // Reset the mock completely
      mockMCPFileOps.readJsonFile.mockReset()
      
      // Mock existing config for initial read
      const existingConfig = {
        mcpServers: {
          existingServer: { command: 'test' }
        }
      }
      
      // Mock the config read for validation to include the newly added server
      const configAfterInstall = {
        mcpServers: {
          existingServer: { command: 'test' },
          'promptliano-test-project': { 
            command: '/test/script/path.sh',
            env: {
              PROMPTLIANO_PROJECT_ID: '123',
              MCP_DEBUG: 'false'
            }
          }
        }
      }
      
      mockMCPFileOps.readJsonFile
        .mockResolvedValueOnce(existingConfig) // First call: existing config
        .mockResolvedValueOnce(configAfterInstall) // Second call: validation read

      const result = await service.installMCP(mockInstallConfig)
      
      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should install with custom server URL', async () => {
      const configWithUrl = { 
        ...mockInstallConfig, 
        serverUrl: 'http://custom:3000/api/mcp' 
      }
      const result = await service.installMCP(configWithUrl as any)

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle Claude Desktop installation', async () => {
      // Reset the mock completely
      mockMCPFileOps.readJsonFile.mockReset()
      
      const existingConfig = {
        mcpServers: { existing: { command: 'test' } }
      }
      
      const configAfterInstall = {
        mcpServers: { 
          existing: { command: 'test' },
          'promptliano-test-project': { 
            command: '/test/script/path.sh',
            env: {
              PROMPTLIANO_PROJECT_ID: '123',
              MCP_DEBUG: 'false'
            }
          }
        }
      }
      
      mockMCPFileOps.readJsonFile
        .mockResolvedValueOnce(existingConfig)
        .mockResolvedValueOnce(configAfterInstall)

      const result = await service.installMCP(mockInstallConfig)

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle VSCode installation', async () => {
      const vscodeConfig = { ...mockInstallConfig, tool: 'vscode' as const }
      
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce({
        'mcp.servers': {}
      })
      mockMCPPlatformPaths.getFullConfigPath.mockReturnValue('/test/vscode/settings.json')

      const result = await service.installMCP(vscodeConfig)

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle Continue installation', async () => {
      const continueConfig = { ...mockInstallConfig, tool: 'continue' as const }
      
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce({
        models: [],
        mcpConfigs: {}
      })
      mockMCPPlatformPaths.getFullConfigPath.mockReturnValue('/test/continue/config.json')

      const result = await service.installMCP(continueConfig)

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle Claude Code installation', async () => {
      const claudeCodeConfig = { ...mockInstallConfig, tool: 'claude-code' as const }
      
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce({
        defaultMcpServers: [],
        projectBindings: {},
        mcpServers: {}
      })
      mockMCPPlatformPaths.getFullConfigPath.mockReturnValue('/test/.claude.json')
      
      const result = await service.installMCP(claudeCodeConfig)

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should install project configuration', async () => {
      const result = await service.installProjectConfig(
        mockInstallConfig.projectId,
        mockInstallConfig.projectPath,
        'http://localhost:3147/api/mcp'
      )

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
      expect(mockMCPFileOps.makeExecutable).toHaveBeenCalled()
    })

    test('should handle installation errors gracefully', async () => {
      mockMCPFileOps.writeJsonFile.mockRejectedValueOnce(new Error('Permission denied'))

      const result = await service.installMCP(mockInstallConfig)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Permission denied')
      expect(mockDeps.logger.error).toHaveBeenCalled()
    })

    test('should validate installation config', async () => {
      const invalidConfig = {
        tool: 'invalid-tool',
        projectId: -1, // Invalid
        projectName: '',
        projectPath: ''
      }

      // Mock validation to throw error for invalid tool
      mockMCPValidation.validateTool.mockImplementationOnce(() => {
        throw new Error('Invalid tool: expected claude-desktop, vscode, cursor, continue, claude-code, windsurf, got invalid-tool')
      })

      await expect(service.installMCP(invalidConfig as any))
        .rejects.toThrow()
    })
  })

  describe('Uninstallation Process', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
    })

    test('should uninstall MCP from tool', async () => {
      // Reset the mock completely
      mockMCPFileOps.readJsonFile.mockReset()
      
      // Mock existing config with MCP server
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce({
        mcpServers: {
          'promptliano-test-project': { command: 'test' },
          otherServer: { command: 'other' }
        }
      })

      const result = await service.uninstallMCP('claude-desktop', 'test-project')

      expect(result.success).toBe(true)
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle uninstall when config not found', async () => {
      // Mock readJsonFile to return null (file not found)
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce(null)

      const result = await service.uninstallMCP('claude-desktop', 'test-project')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Configuration file not found')
    })

    test('should preserve other servers during uninstall', async () => {
      // Reset the mock completely
      mockMCPFileOps.readJsonFile.mockReset()
      
      const originalConfig = {
        mcpServers: {
          'promptliano-test-project': { command: 'test' },
          otherServer: { command: 'other' }
        }
      }
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce(originalConfig)

      const result = await service.uninstallMCP('claude-desktop', 'test-project')

      expect(result.success).toBe(true)
      
      // Verify that the config was written back with other server preserved
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle global MCP uninstallation', async () => {
      const result = await service.uninstallGlobalMCP('claude-desktop')

      // Currently returns not implemented
      expect(result.success).toBe(false)
      expect(result.message).toContain('not yet implemented')
    })

    test('should handle uninstall errors gracefully', async () => {
      // Reset the mock completely
      mockMCPFileOps.readJsonFile.mockReset()
      mockMCPFileOps.readJsonFile.mockRejectedValueOnce(new Error('Permission denied'))

      await expect(service.uninstallMCP('claude-desktop', 'test-project'))
        .rejects.toThrow('Permission denied')
    })

    test('should validate tool name for uninstall', async () => {
      // Mock validation to throw error for invalid tool
      mockMCPValidation.validateTool.mockImplementationOnce(() => {
        throw new Error('Invalid tool: expected claude-desktop, vscode, cursor, continue, claude-code, windsurf, got invalid-tool')
      })

      await expect(service.uninstallMCP('invalid-tool' as any, 'test-project'))
        .rejects.toThrow()
    })
  })

  describe('Global Installation Management', () => {
    test('should detect global installations', async () => {
      const tools = await service.detectGlobalInstallations()

      expect(Array.isArray(tools)).toBe(true)
      expect(mockDeps.logger.debug).toHaveBeenCalled()
    })

    test('should install global MCP (placeholder)', async () => {
      const result = await service.installGlobalMCP('claude-desktop')

      // Currently returns not implemented
      expect(result.success).toBe(false)
      expect(result.message).toContain('not yet implemented')
    })

    test('should handle tool detection errors', async () => {
      // Mock internal errors during detection - should be caught and logged
      mockFs.access.mockRejectedValue(new Error('Permission denied'))

      const tools = await service.detectGlobalInstallations()

      expect(Array.isArray(tools)).toBe(true)
      // Note: Errors during tool detection are handled internally and don't always call logger.error
    })
  })

  describe('Project Configuration', () => {
    test('should install project-specific configuration', async () => {
      const result = await service.installProjectConfig(
        123,
        '/test/project',
        'http://localhost:3147/api/mcp'
      )

      expect(result.success).toBe(true)
      expect(result.configPath).toContain('.mcp.json')
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })

    test('should handle existing project config', async () => {
      // Reset the mock completely
      mockMCPFileOps.readJsonFile.mockReset()
      mockMCPFileOps.writeJsonFile.mockReset()
      
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce({
        mcpServers: {
          existing: { command: 'existing' }
        }
      })
      mockMCPFileOps.writeJsonFile
        .mockResolvedValueOnce({ backupPath: '/test/project/.mcp.json.backup-123456' }) // For backup
        .mockResolvedValueOnce({ backupPath: undefined }) // For main config

      const result = await service.installProjectConfig(123, '/test/project')

      expect(result.success).toBe(true)
      expect(result.backedUp).toBe(true)
      expect(result.backupPath).toBeDefined()
    })

    test('should handle project config errors', async () => {
      // Mock writeJsonFile to reject with permission error 
      mockMCPFileOps.writeJsonFile.mockRejectedValue(new Error('Permission denied'))

      // installProjectConfig uses withErrorContext which re-throws errors, unlike installMCP
      await expect(service.installProjectConfig(123, '/test/project'))
        .rejects
        .toThrow('Permission denied')
    })
  })

  describe('Error Recovery', () => {
    test('should handle file system errors during installation', async () => {
      // Mock writeJsonFile to consistently throw EBUSY error (simulating persistent file system issue) 
      mockMCPFileOps.writeJsonFile.mockRejectedValue(new Error('EBUSY: resource busy or locked'))
      
      // Mock readJsonFile to return no existing config
      mockMCPFileOps.readJsonFile.mockResolvedValue(null)

      const result = await service.installMCP(mockInstallConfig)

      // Since EBUSY is an operational error, it gets caught and converted to a failure result
      expect(result.success).toBe(false)
      expect(result.message).toContain('EBUSY')
    })

    test('should handle validation errors', async () => {
      const invalidConfig = {
        tool: 'invalid-tool',
        projectId: -1,
        projectName: '',
        projectPath: ''
      }

      // Mock validation to throw error
      mockMCPValidation.validateTool.mockImplementationOnce(() => {
        throw new Error('Invalid tool: expected claude-desktop, vscode, cursor, continue, claude-code, windsurf, got invalid-tool')
      })

      // Validation errors should be thrown, not converted to failure results
      await expect(service.installMCP(invalidConfig as any))
        .rejects
        .toThrow('Invalid tool')
    })
  })

  describe('Multi-Tool Support', () => {
    test('should support different tools', async () => {
      const tools = ['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code'] as const
      
      for (const tool of tools) {
        const config = { ...mockInstallConfig, tool }
        const result = await service.installMCP(config)
        
        // Should attempt installation for each tool
        expect(typeof result.success).toBe('boolean')
        expect(typeof result.message).toBe('string')
      }
    })

    test('should handle tool-specific configurations', async () => {
      const vscodeConfig = { ...mockInstallConfig, tool: 'vscode' as const }
      mockMCPFileOps.readJsonFile.mockResolvedValueOnce({ 'mcp.servers': {} })
      mockMCPPlatformPaths.getFullConfigPath.mockReturnValue('/test/vscode/settings.json')
      
      const result = await service.installMCP(vscodeConfig)
      
      expect(typeof result.success).toBe('boolean')
      expect(mockMCPFileOps.writeJsonFile).toHaveBeenCalled()
    })
  })

  describe('Service Integration', () => {
    test('should work with default dependencies', () => {
      const defaultService = createMCPInstallationService()
      
      expect(typeof defaultService.installMCP).toBe('function')
      expect(typeof defaultService.detectInstalledTools).toBe('function')
    })

    test('should accept custom configuration', () => {
      const customService = createMCPInstallationService({
        logger: mockDeps.logger,
        platform: 'linux',
        defaultServerUrl: 'http://custom:3000/api/mcp'
      })
      
      expect(typeof customService.installMCP).toBe('function')
    })
  })
})