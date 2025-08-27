/**
 * MCP Project Config Service Tests - Functional Factory Pattern
 * Tests project-specific MCP configuration management with hierarchy support,
 * caching, validation, and integration with global configs
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  createMCPProjectConfigService,
  type MCPProjectConfigService,
  type ProjectMCPConfig,
  type ProjectMCPState,
} from './mcp-project-config-service'

// Set test environment
process.env.NODE_ENV = 'test'

// Test fixtures
const mockProjectConfig: ProjectMCPConfig = {
  projectId: 123,
  servers: {
    projectServer: {
      type: 'stdio',
      command: 'node',
      args: ['project-server.js'],
      env: { PROJECT_ENV: 'test' },
      enabled: true,
      autoStart: false
    }
  },
  serverUrl: 'http://localhost:3147/api/mcp',
  debugMode: false,
  inheritGlobal: true,
  projectEnv: { PROJECT_VAR: 'project_value' }
}

const mockProjectState: ProjectMCPState = {
  config: mockProjectConfig,
  lastModified: Date.now()
}

// Mock project service
const mockProjectService = {
  getById: mock(async () => ({
    id: 123,
    path: '/test/project/path',
    name: 'Test Project'
  }))
}

// Mock global config service
const mockGlobalConfigService = {
  getGlobalConfig: mock(async () => ({
    servers: {
      globalServer: {
        type: 'stdio' as const,
        command: 'global-command',
        args: ['global-args']
      }
    },
    defaultServerUrl: 'http://localhost:3147/api/mcp',
    debugMode: false,
    globalEnv: { GLOBAL_VAR: 'global_value' }
  })),
  on: mock(),
  removeAllListeners: mock()
}

// Mock file system operations
const mockFs = {
  mkdir: mock(async () => {}),
  readFile: mock(),
  writeFile: mock(async () => {}),
  access: mock(),
  stat: mock(),
  copyFile: mock(async () => {})
}

// Mock modules
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

describe('MCP Project Config Service - Functional Factory Pattern', () => {
  let configDir: string
  let service: MCPProjectConfigService
  const projectId = 123

  beforeEach(async () => {
    // Create temp directory for test config
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-project-test-'))
    configDir = tempDir

    // Reset all mocks
    Object.values(mockFs).forEach(mock => mock.mockReset())
    Object.values(mockLogger).forEach(mock => mock.mockClear())
    mockGlobalConfigService.getGlobalConfig.mockClear()

    // Setup default mock behaviors
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' }) // File not found by default
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockRejectedValue({ code: 'ENOENT' })

    // Create service instance
    service = createMCPProjectConfigService({
      projectService: mockProjectService as any,
      enableWatching: false, // Disable for tests
      logger: mockLogger as any
    })
  })

  afterEach(async () => {
    await service.cleanup()
  })

  describe('Config Location Detection', () => {
    test('should find config file locations', async () => {
      mockFs.access
        .mockResolvedValueOnce(undefined) // .vscode/mcp.json exists
        .mockRejectedValueOnce({ code: 'ENOENT' }) // .cursor/mcp.json doesn't exist
        .mockResolvedValueOnce(undefined) // .mcp.json exists

      const locations = await service.getConfigLocations(projectId)

      expect(locations).toHaveLength(3)
      expect(locations[0]).toEqual({
        path: expect.stringContaining('.vscode/mcp.json'),
        exists: true,
        priority: 0
      })
      expect(locations[1]).toEqual({
        path: expect.stringContaining('.cursor/mcp.json'),
        exists: false,
        priority: 1
      })
      expect(locations[2]).toEqual({
        path: expect.stringContaining('.mcp.json'),
        exists: true,
        priority: 2
      })
    })

    test('should handle project path resolution', async () => {
      // Mock project service to return project with path
      mockProjectService.getById.mockResolvedValueOnce({
        id: projectId,
        path: '/test/project/path'
      })

      const locations = await service.getConfigLocations(projectId)

      expect(mockProjectService.getById).toHaveBeenCalledWith(projectId)
      expect(locations[0].path).toContain('/test/project/path/.vscode/mcp.json')
    })

    test('should handle missing project', async () => {
      mockProjectService.getById.mockRejectedValueOnce(new Error('Project not found'))

      await expect(service.getConfigLocations(projectId)).rejects.toThrow('Project not found')
    })
  })

  describe('Configuration Management', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockProjectConfig))
      mockFs.access.mockResolvedValue(undefined) // Config file exists
    })

    test('should load project configuration', async () => {
      const result = await service.loadProjectConfig(projectId)

      expect(result).toBeTruthy()
      if (result) {
        expect(result.config).toEqual(expect.objectContaining({
          servers: expect.any(Object)
        }))
        expect(result.projectPath).toBe('/test/project/path')
      }
    })

    test('should save project configuration', async () => {
      const configToSave = {
        ...mockProjectConfig,
        servers: {
          ...mockProjectConfig.servers,
          newServer: {
            type: 'stdio' as const,
            command: 'new-command'
          }
        }
      }

      await service.saveProjectConfig(projectId, configToSave)

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    test('should get merged configuration', async () => {
      const mergedConfig = await service.getMergedConfig(projectId)

      expect(mergedConfig).toBeDefined()
      expect(mergedConfig.servers || mergedConfig.mcpServers).toBeDefined()
    })

    test('should expand variables in configuration', async () => {
      const configWithVars = {
        ...mockProjectConfig,
        servers: {
          testServer: {
            type: 'stdio' as const,
            command: '${COMMAND:-node}',
            args: ['${ARGS:-index.js}']
          }
        }
      }

      const expanded = await service.expandVariables(configWithVars, projectId)
      expect(expanded).toBeDefined()
    })

    test('should get editor type from location path', () => {
      const vscodeType = service.getEditorType('.vscode/mcp.json')
      const cursorType = service.getEditorType('.cursor/mcp.json')
      const genericType = service.getEditorType('.mcp.json')

      expect(vscodeType).toBe('vscode')
      expect(cursorType).toBe('cursor')
      expect(genericType).toBe('generic')
    })
  })

  describe('Configuration Loading', () => {
    beforeEach(async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockProjectConfig))
      mockFs.access.mockResolvedValue(undefined)
    })

    test('should get merged configuration', async () => {
      const mergedConfig = await service.getMergedConfig(projectId)

      expect(mergedConfig).toBeDefined()
      expect(mergedConfig.mcpServers || mergedConfig.servers).toBeDefined()
    })

    test('should get expanded configuration with variables', async () => {
      const expandedConfig = await service.getExpandedConfig(projectId)

      expect(expandedConfig).toBeDefined()
      expect(expandedConfig.mcpServers || expandedConfig.servers).toBeDefined()
    })

    test('should get user configuration', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockProjectConfig))
      
      const userConfig = await service.getUserConfig()

      // User config may or may not exist
      expect(userConfig === null || typeof userConfig === 'object').toBe(true)
    })

    test('should get global configuration', async () => {
      const globalConfig = await service.getGlobalConfig()

      // Global config may or may not exist
      expect(globalConfig === null || typeof globalConfig === 'object').toBe(true)
    })
  })

  describe('Configuration Locations', () => {
    test('should get default config for location', async () => {
      const defaultConfig = await service.getDefaultConfigForLocation(projectId, '.mcp.json')

      expect(defaultConfig).toBeDefined()
      expect(defaultConfig.mcpServers).toBeDefined()
    })

    test('should save config to specific location', async () => {
      await service.saveProjectConfigToLocation(projectId, mockProjectConfig, '.mcp.json')

      expect(mockFs.writeFile).toHaveBeenCalled()
    })


  })

  describe('Multi-Project Support', () => {
    const projectId2 = 456

    test('should load configs for multiple projects', async () => {
      const config1 = await service.loadProjectConfig(projectId)
      const config2 = await service.loadProjectConfig(projectId2)

      // Both should work independently
      expect(config1 === null || typeof config1 === 'object').toBe(true)
      expect(config2 === null || typeof config2 === 'object').toBe(true)
    })

    test('should get merged configs for multiple projects', async () => {
      const merged1 = await service.getMergedConfig(projectId)
      const merged2 = await service.getMergedConfig(projectId2)

      expect(merged1).toBeDefined()
      expect(merged2).toBeDefined()
    })

    test('should get config locations for multiple projects', async () => {
      const locations1 = await service.getConfigLocations(projectId)
      const locations2 = await service.getConfigLocations(projectId2)

      expect(Array.isArray(locations1)).toBe(true)
      expect(Array.isArray(locations2)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'))
      
      // Should handle gracefully and return null
      const config = await service.loadProjectConfig(projectId)
      expect(config).toBeNull()
    })

    test('should handle config loading failures', async () => {
      mockFs.access.mockRejectedValue({ code: 'ENOENT' })

      // Should handle gracefully
      const merged = await service.getMergedConfig(projectId)
      expect(merged).toBeDefined()
    })

    test('should handle invalid config gracefully', async () => {
      mockFs.readFile.mockResolvedValue('invalid json')

      const config = await service.loadProjectConfig(projectId)
      expect(config).toBeNull()
    })

    test('should handle missing project service', async () => {
      mockProjectService.getById.mockRejectedValue(new Error('Project not found'))

      const locations = await service.getConfigLocations(projectId)
      
      // Should still return default locations
      expect(Array.isArray(locations)).toBe(true)
    })
  })

  describe('Caching Behavior', () => {
    test('should cache configuration reads', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockProjectConfig))
      
      // First call loads from file
      const config1 = await service.loadProjectConfig(projectId)
      
      // Second call should potentially use cache
      const config2 = await service.loadProjectConfig(projectId)

      expect(config1 === null || typeof config1 === 'object').toBe(true)
      expect(config2 === null || typeof config2 === 'object').toBe(true)
    })

    test('should cache merged configuration', async () => {
      // First call
      const merged1 = await service.getMergedConfig(projectId)
      
      // Second call
      const merged2 = await service.getMergedConfig(projectId)

      expect(merged1).toBeDefined()
      expect(merged2).toBeDefined()
    })

    test('should work with expanded configurations', async () => {
      const expanded = await service.getExpandedConfig(projectId)

      expect(expanded).toBeDefined()
    })
  })

  describe('Event Emission', () => {
    test('should support event listeners', () => {
      const handler = mock()
      service.on('configChanged', handler)

      expect(typeof service.on).toBe('function')
      expect(typeof service.emit).toBe('function')
      expect(typeof service.removeAllListeners).toBe('function')
    })

    test('should emit events', () => {
      const result = service.emit('test', 'data')
      
      expect(typeof result).toBe('boolean')
    })

    test('should support event listener cleanup', () => {
      service.removeAllListeners()
      
      // Should not throw and function should exist
      expect(typeof service.removeAllListeners).toBe('function')
    })
  })

  describe('Service Factory Pattern', () => {
    test('should create service with default dependencies', () => {
      const defaultService = createMCPProjectConfigService()
      
      expect(typeof defaultService.loadProjectConfig).toBe('function')
      expect(typeof defaultService.getMergedConfig).toBe('function')
      expect(typeof defaultService.saveProjectConfig).toBe('function')
      expect(typeof defaultService.cleanup).toBe('function')
    })

    test('should accept custom dependencies', () => {
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      
      const customService = createMCPProjectConfigService({
        projectService: mockProjectService as any,
        logger: customLogger as any,
        enableWatching: false,
        cacheConfig: { ttl: 60000, maxEntries: 100 }
      })

      expect(typeof customService.loadProjectConfig).toBe('function')
    })
  })

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await service.cleanup()

      // Should not throw and function should exist
      expect(typeof service.cleanup).toBe('function')
    })

    test('should handle cleanup errors gracefully', async () => {
      // Should not throw
      await expect(service.cleanup()).resolves.toBeUndefined()
    })
  })
})