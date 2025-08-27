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
    test('should handle project not found errors consistently', async () => {
      const mockProjectService = {
        getById: jest.fn().mockResolvedValue({ id: 1, path: null })
      }
      
      const service = createGitBranchService({
        projectService: mockProjectService
      })
      
      await expect(service.getBranches(1))
        .rejects
        .toThrow('missing path')
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