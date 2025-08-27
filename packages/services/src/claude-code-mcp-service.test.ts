/**
 * Claude Code MCP Service Tests - Functional Factory Pattern
 * Tests Claude Code specific MCP integration with database operations
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  createClaudeCodeMCPService,
  type ClaudeCodeMCPService,
} from './claude-code-mcp-service'

// Set test environment
process.env.NODE_ENV = 'test'

// Mock dependencies
const mockProjectConfigService = {
  getProjectConfig: mock(async () => ({
    projectId: 123,
    servers: { promptliano: { type: 'stdio', command: 'test' } },
    serverUrl: 'http://localhost:3147/api/mcp'
  }))
}

describe('Claude Code MCP Service - Functional Factory Pattern', () => {
  let service: ClaudeCodeMCPService

  beforeEach(async () => {
    // Reset all mocks
    mockProjectConfigService.getProjectConfig.mockClear()

    // Create service instance
    service = createClaudeCodeMCPService({
      projectConfigService: mockProjectConfigService as any
    })
  })

  describe('Service Initialization', () => {
    test('should create service with default dependencies', () => {
      const defaultService = createClaudeCodeMCPService()
      
      expect(typeof defaultService.getMCPStatus).toBe('function')
      expect(typeof defaultService.getSessions).toBe('function')
      expect(typeof defaultService.getRecentSessions).toBe('function')
      expect(typeof defaultService.getSessionsPaginated).toBe('function')
    })

    test('should accept custom dependencies', () => {
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      
      const customService = createClaudeCodeMCPService({
        projectConfigService: mockProjectConfigService as any,
        logger: customLogger as any,
        cacheConfig: { ttl: 60000, maxEntries: 100 }
      })

      expect(typeof customService.getMCPStatus).toBe('function')
    })
  })

  describe('MCP Status Operations', () => {
    test('should get MCP status for project', async () => {
      const status = await service.getMCPStatus(123)

      expect(status).toHaveProperty('isInstalled')
      expect(status).toHaveProperty('isRunning')
      expect(typeof status.isInstalled).toBe('boolean')
      expect(typeof status.isRunning).toBe('boolean')
    })

    test('should handle invalid project ID', async () => {
      await expect(service.getMCPStatus(-1)).rejects.toThrow()
    })
  })

  describe('Session Operations', () => {
    test('should get sessions for project', async () => {
      const sessions = await service.getSessions(123)

      expect(Array.isArray(sessions)).toBe(true)
    })

    test('should get recent sessions with limit', async () => {
      const sessions = await service.getRecentSessions(123, 5)

      expect(Array.isArray(sessions)).toBe(true)
    })

    test('should get paginated sessions', async () => {
      const result = await service.getSessionsPaginated(123, 0, 10)

      expect(result).toHaveProperty('sessions')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.sessions)).toBe(true)
      expect(typeof result.total).toBe('number')
      expect(typeof result.hasMore).toBe('boolean')
    })

    test('should get session metadata', async () => {
      const metadata = await service.getSessionsMetadata(123)

      expect(Array.isArray(metadata)).toBe(true)
    })

    test('should get full session by ID', async () => {
      const session = await service.getFullSession(123, 'session-123')

      // Should return session or null
      if (session !== null) {
        expect(session).toHaveProperty('session_id')
        expect(session).toHaveProperty('project_id')
      }
    })

    test('should handle invalid session ID', async () => {
      const session = await service.getFullSession(123, 'non-existent')

      expect(session).toBeNull()
    })
  })

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      // Test with invalid project ID
      await expect(service.getMCPStatus(0)).rejects.toThrow()
    })

    test('should validate project IDs', async () => {
      const invalidIds = [-1, 0, NaN]
      
      for (const id of invalidIds) {
        await expect(service.getSessions(id)).rejects.toThrow()
      }
    })
  })

  describe('Service Factory Pattern', () => {
    test('should support dependency injection', () => {
      const customProjectService = { getProjectConfig: mock() }
      const customLogger = { info: mock(), warn: mock(), error: mock(), debug: mock() }
      
      const customService = createClaudeCodeMCPService({
        projectConfigService: customProjectService as any,
        logger: customLogger as any,
        cacheConfig: { ttl: 120000, maxEntries: 200 }
      })

      expect(typeof customService.getMCPStatus).toBe('function')
    })

    test('should work with default dependencies', () => {
      const defaultService = createClaudeCodeMCPService()
      
      expect(typeof defaultService.getMCPStatus).toBe('function')
      expect(typeof defaultService.getSessions).toBe('function')
      expect(typeof defaultService.getRecentSessions).toBe('function')
      expect(typeof defaultService.getSessionsPaginated).toBe('function')
    })
  })
})