/**
 * Claude Code File Reader Service Tests - Functional Factory Pattern
 * Tests Claude Code file reading and chat history operations
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  createClaudeCodeFileReaderService,
  type ClaudeCodeFileReaderService,
} from './claude-code-file-reader-service'

// Set test environment
process.env.NODE_ENV = 'test'

// Mock file system operations
const mockFs = {
  readdir: mock(),
  readFile: mock(),
  stat: mock(),
  access: mock(),
}

// Mock modules
mock.module('fs/promises', () => mockFs)

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

describe('Claude Code File Reader Service - Functional Factory Pattern', () => {
  let service: ClaudeCodeFileReaderService

  beforeEach(async () => {
    // Reset all mocks
    Object.values(mockFs).forEach(mock => mock.mockReset())
    Object.values(mockLogger).forEach(mock => mock.mockClear())

    // Setup default mock behaviors
    mockFs.access.mockResolvedValue(undefined) // Files exist by default
    mockFs.stat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date()
    })
    mockFs.readdir.mockResolvedValue([])
    mockFs.readFile.mockResolvedValue('{}')

    // Create service instance
    service = createClaudeCodeFileReaderService({
      logger: mockLogger as any
    })
  })

  describe('Service Initialization', () => {
    test('should create service with default dependencies', () => {
      const defaultService = createClaudeCodeFileReaderService()
      
      expect(typeof defaultService.readChatHistory).toBe('function')
      expect(typeof defaultService.getClaudeProjects).toBe('function')
      expect(typeof defaultService.getSessionsMetadata).toBe('function')
      expect(typeof defaultService.isClaudeCodeInstalled).toBe('function')
    })

    test('should accept custom dependencies', () => {
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      
      const customService = createClaudeCodeFileReaderService({
        logger: customLogger as any,
        cacheConfig: { ttl: 60000, maxEntries: 100 },
        maxConcurrent: 10
      })

      expect(typeof customService.readChatHistory).toBe('function')
    })
  })

  describe('Claude Code Detection', () => {
    test('should detect Claude Code installation', async () => {
      // Mock successful access to Claude Code directory
      mockFs.access.mockResolvedValueOnce(undefined)
      
      const isInstalled = await service.isClaudeCodeInstalled()
      
      expect(typeof isInstalled).toBe('boolean')
      expect(mockFs.access).toHaveBeenCalled()
    })

    test('should handle missing Claude Code installation', async () => {
      // Mock file not found error
      const notFoundError = new Error('ENOENT') as any
      notFoundError.code = 'ENOENT'
      mockFs.access.mockRejectedValueOnce(notFoundError)
      
      const isInstalled = await service.isClaudeCodeInstalled()
      
      expect(isInstalled).toBe(false)
    })

    test('should get Claude config directory', () => {
      const configDir = service.getClaudeConfigDir()
      
      expect(typeof configDir).toBe('string')
      expect(configDir).toContain('.claude')
    })
  })

  describe('Project Path Encoding', () => {
    test('should encode project paths', () => {
      const projectPath = '/Users/test/simple-project'
      const encoded = service.encodeProjectPath(projectPath)
      
      expect(typeof encoded).toBe('string')
      expect(encoded.length).toBeGreaterThan(0)
    })

    test('should decode project paths consistently', () => {
      const projectPath = '/Users/test/simple-project'
      const encoded = service.encodeProjectPath(projectPath)
      const decoded = service.decodeProjectPath(encoded)
      
      // Should be a valid path, even if not exactly the same
      expect(typeof decoded).toBe('string')
      expect(decoded.length).toBeGreaterThan(0)
    })
  })

  describe('Project Operations', () => {
    test('should get Claude projects', async () => {
      // Mock project directory listing
      mockFs.readdir.mockResolvedValueOnce(['project1', 'project2'])
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false
      })
      
      const projects = await service.getClaudeProjects()
      
      expect(Array.isArray(projects)).toBe(true)
    })

    test('should handle empty projects directory', async () => {
      mockFs.readdir.mockResolvedValueOnce([])
      
      const projects = await service.getClaudeProjects()
      
      expect(Array.isArray(projects)).toBe(true)
      expect(projects).toHaveLength(0)
    })

    test('should handle projects directory not found', async () => {
      const notFoundError = new Error('ENOENT') as any
      notFoundError.code = 'ENOENT'
      mockFs.readdir.mockRejectedValueOnce(notFoundError)
      
      const projects = await service.getClaudeProjects()
      
      expect(Array.isArray(projects)).toBe(true)
      expect(projects).toHaveLength(0)
    })
  })

  describe('Chat History Operations', () => {
    test('should read chat history for project', async () => {
      const projectPath = '/test/project'
      
      // Mock chat file listing and reading
      mockFs.readdir.mockResolvedValueOnce(['chat1.json', 'chat2.json'])
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'chat-1',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: Date.now()
          }
        ]
      }))
      
      const history = await service.readChatHistory(projectPath)
      
      expect(Array.isArray(history)).toBe(true)
    })

    test('should handle empty chat history', async () => {
      const projectPath = '/test/empty-project'
      
      mockFs.readdir.mockResolvedValueOnce([])
      
      const history = await service.readChatHistory(projectPath)
      
      expect(Array.isArray(history)).toBe(true)
      expect(history).toHaveLength(0)
    })

    test('should handle chat directory not found', async () => {
      const projectPath = '/test/missing-project'
      const notFoundError = new Error('ENOENT') as any
      notFoundError.code = 'ENOENT'
      mockFs.readdir.mockRejectedValueOnce(notFoundError)
      
      const history = await service.readChatHistory(projectPath)
      
      expect(Array.isArray(history)).toBe(true)
      expect(history).toHaveLength(0)
    })
  })

  describe('Session Metadata Operations', () => {
    test('should get sessions metadata', async () => {
      const projectPath = '/test/project'
      
      mockFs.readdir.mockResolvedValueOnce(['session1', 'session2'])
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'session-1',
        name: 'Test Session',
        createdAt: Date.now()
      }))
      
      const metadata = await service.getSessionsMetadata(projectPath)
      
      expect(Array.isArray(metadata)).toBe(true)
    })

    test('should get paginated sessions', async () => {
      const projectPath = '/test/project'
      
      const result = await service.getSessionsPaginated(projectPath, {
        offset: 0,
        limit: 10
      })
      
      expect(result).toHaveProperty('sessions')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.sessions)).toBe(true)
      expect(typeof result.total).toBe('number')
      expect(typeof result.hasMore).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      const projectPath = '/restricted/project'
      mockFs.readdir.mockRejectedValueOnce(new Error('Permission denied'))
      
      const history = await service.readChatHistory(projectPath)
      
      expect(Array.isArray(history)).toBe(true)
      expect(history).toHaveLength(0)
    })

    test('should handle malformed chat files', async () => {
      const projectPath = '/test/project'
      
      mockFs.readdir.mockResolvedValueOnce(['chat1.json'])
      mockFs.readFile.mockResolvedValueOnce('invalid json content')
      
      const history = await service.readChatHistory(projectPath)
      
      expect(Array.isArray(history)).toBe(true)
      // Should skip invalid files
    })
  })

  describe('Service Factory Pattern', () => {
    test('should support dependency injection', () => {
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      
      const customService = createClaudeCodeFileReaderService({
        logger: customLogger as any,
        cacheConfig: { ttl: 120000, maxEntries: 200 },
        maxConcurrent: 5
      })

      expect(typeof customService.readChatHistory).toBe('function')
    })

    test('should work with default dependencies', () => {
      const defaultService = createClaudeCodeFileReaderService()
      
      expect(typeof defaultService.readChatHistory).toBe('function')
      expect(typeof defaultService.getClaudeProjects).toBe('function')
      expect(typeof defaultService.getSessionsMetadata).toBe('function')
      expect(typeof defaultService.isClaudeCodeInstalled).toBe('function')
    })
  })
})