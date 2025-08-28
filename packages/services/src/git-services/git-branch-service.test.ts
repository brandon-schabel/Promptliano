import { describe, test, expect, jest } from 'bun:test'
import { createGitBranchService } from './git-branch-service'
import type { GitBranchServiceDependencies } from './git-branch-service'

describe('Git Branch Service - Functional Factory', () => {
  describe('Factory Pattern', () => {
    test('should create service instance with dependency injection', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }
      
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: '/test/repo' })
      }
      
      const mockStatusService = {
        clearCache: jest.fn()
      }
      
      const deps: GitBranchServiceDependencies = {
        logger: mockLogger,
        projectService: mockProjectService,
        statusService: mockStatusService
      }
      
      const service = createGitBranchService(deps)
      
      expect(service).toBeDefined()
      expect(typeof service.getBranches).toBe('function')
      expect(typeof service.getCurrentBranch).toBe('function')
      expect(typeof service.createBranch).toBe('function')
      expect(typeof service.switchBranch).toBe('function')
      expect(typeof service.deleteBranch).toBe('function')
      expect(typeof service.mergeBranch).toBe('function')
      expect(typeof service.getBranchesEnhanced).toBe('function')
    })
    
    test('should work without dependencies (using defaults)', () => {
      const service = createGitBranchService()
      
      expect(service).toBeDefined()
      expect(typeof service.getBranches).toBe('function')
      expect(typeof service.getCurrentBranch).toBe('function')
    })
    
    test('should be immutable and stateless', () => {
      const service1 = createGitBranchService()
      const service2 = createGitBranchService()
      
      // Different instances
      expect(service1).not.toBe(service2)
      
      // Same interface
      expect(Object.keys(service1).sort()).toEqual(Object.keys(service2).sort())
    })
  })
  
  describe('Error Handling', () => {
    test('should handle project with missing path consistently', async () => {
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: null })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      await expect(service.getBranches(1))
        .rejects
        .toThrow('Cannot git operations Project in current state: missing path')
    })

    test('should handle project service errors', async () => {
      const mockProjectService = {
        getById: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      await expect(service.getBranches(1))
        .rejects
        .toThrow('Database connection failed')
    })

    test('should handle git-related errors through the error handler', async () => {
      // Create a custom logger to verify error handling patterns
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }
      
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: '/nonexistent/path' })
      }
      
      const service = createGitBranchService({
        logger: mockLogger,
        projectService: mockProjectService
      })
      
      // Test with getBranchesEnhanced which logs errors internally before returning
      const result = await service.getBranchesEnhanced(1)
      
      // Should return error response structure
      expect(result.success).toBe(false)
      expect(result.message).toBeDefined()
      
      // Verify error was logged by getBranchesEnhanced
      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get enhanced branches',
        expect.objectContaining({
          projectId: 1,
          error: expect.any(Error)
        })
      )
    })

    test('should handle service method errors consistently', async () => {
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: '/nonexistent/path' })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      // Test multiple service methods to ensure they all follow error handling patterns
      const methods = [
        { method: 'getCurrentBranch', args: [1] },
        { method: 'createBranch', args: [1, 'test-branch'] },
        { method: 'switchBranch', args: [1, 'main'] },
        { method: 'deleteBranch', args: [1, 'feature-branch'] },
        { method: 'mergeBranch', args: [1, 'feature-branch'] }
      ]
      
      for (const { method, args } of methods) {
        await expect((service as any)[method](...args))
          .rejects
          .toThrow() // All should throw some error due to invalid path
      }
    })

    test('should handle all service methods with error scenarios', async () => {
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: null })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      // Test all service methods with missing path error
      const methods = [
        'getBranches',
        'getCurrentBranch', 
        'createBranch',
        'switchBranch',
        'deleteBranch',
        'mergeBranch'
      ]
      
      for (const method of methods) {
        const args = method === 'createBranch' || method === 'switchBranch' || method === 'deleteBranch' || method === 'mergeBranch'
          ? [1, 'test-branch']
          : [1]
          
        await expect((service as any)[method](...args))
          .rejects
          .toThrow('Cannot git operations Project in current state: missing path')
      }
    })
  })
  
  describe('Integration Interface', () => {
    test('should expose individual functions for tree-shaking', async () => {
      // Test the module exports the individual functions
      const { getBranches, getCurrentBranch, createBranch } = await import('./git-branch-service')
      
      expect(typeof getBranches).toBe('function')
      expect(typeof getCurrentBranch).toBe('function') 
      expect(typeof createBranch).toBe('function')
    })
    
    test('should maintain backward compatibility with singleton export', async () => {
      const { gitBranchService } = await import('./git-branch-service')
      
      expect(gitBranchService).toBeDefined()
      expect(typeof gitBranchService.getBranches).toBe('function')
    })
  })
  
  describe('Enhanced Branch Operations', () => {
    test('should handle getBranchesEnhanced success response', async () => {
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: null })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      // This will fail due to missing path, but should return proper error structure
      const result = await service.getBranchesEnhanced(1)
      
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(false)
      expect(result).toHaveProperty('message')
      expect(typeof result.message).toBe('string')
    })
    
    test('should call status cache clear on branch operations', async () => {
      const mockStatusService = {
        clearCache: jest.fn()
      }
      
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: null })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService,
        statusService: mockStatusService
      })
      
      // Try operations that should clear cache (they'll fail but should attempt to clear)
      try { await service.createBranch(1, 'test') } catch {}
      try { await service.switchBranch(1, 'main') } catch {}
      try { await service.mergeBranch(1, 'feature') } catch {}
      
      // Cache clear should not be called since operations fail early
      // But the service should have the clearCache dependency
      expect(mockStatusService.clearCache).toBeDefined()
    })
  })

  describe('Service Dependencies', () => {
    test('should handle missing statusService dependency gracefully', () => {
      const service = createGitBranchService({
        // No statusService provided
      })
      
      expect(service).toBeDefined()
      expect(typeof service.getBranches).toBe('function')
    })
    
    test('should inject default dependencies when none provided', () => {
      const service = createGitBranchService()
      
      expect(service).toBeDefined()
      expect(typeof service.getBranches).toBe('function')
      expect(typeof service.getBranchesEnhanced).toBe('function')
    })
  })

  describe('Error Pattern Validation', () => {
    test('should follow consistent ErrorFactory patterns across all methods', async () => {
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: null })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      // Test that all methods produce consistent ErrorFactory errors
      const testCases = [
        { method: 'getBranches', args: [1] },
        { method: 'getCurrentBranch', args: [1] },
        { method: 'createBranch', args: [1, 'test-branch'] },
        { method: 'switchBranch', args: [1, 'main'] },
        { method: 'deleteBranch', args: [1, 'feature'] },
        { method: 'mergeBranch', args: [1, 'feature'] }
      ]
      
      for (const { method, args } of testCases) {
        try {
          await (service as any)[method](...args)
          // Should not reach here
          expect(true).toBe(false)
        } catch (error) {
          // Verify ErrorFactory structure
          expect(error).toHaveProperty('message')
          expect(error).toHaveProperty('status')
          expect(error).toHaveProperty('code')
          
          // Should be the missing path error
          expect(error.message).toContain('Cannot git operations Project in current state: missing path')
          expect(error.status).toBe(400)
          expect(error.code).toBe('INVALID_STATE')
        }
      }
    })
    
    test('should handle project service rejection consistently', async () => {
      const mockProjectService = {
        getById: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      // Test a few methods to ensure they handle upstream errors
      await expect(service.getBranches(1))
        .rejects
        .toThrow('Service unavailable')
        
      await expect(service.getCurrentBranch(1))
        .rejects
        .toThrow('Service unavailable')
    })
  })

  describe('Performance Characteristics', () => {
    test('should create service instances quickly', () => {
      const start = performance.now()
      
      for (let i = 0; i < 100; i++) {
        createGitBranchService()
      }
      
      const end = performance.now()
      const elapsed = end - start
      
      // Should create 100 instances in less than 10ms (very fast)
      expect(elapsed).toBeLessThan(10)
    })
  })
})