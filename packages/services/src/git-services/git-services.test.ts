import { describe, test, expect } from 'bun:test'
import { gitStatusService } from './git-status-service'
import { gitCommitService } from './git-commit-service'
import { gitBranchService } from './git-branch-service'
import { gitStashService } from './git-stash-service'
import { gitRemoteService } from './git-remote-service'
import { gitWorktreeService } from './git-worktree-service'
import { gitConfigService } from './git-config-service'

describe('Modular Git Services', () => {
  describe('Service Instances', () => {
    test('should have singleton instances of all services', () => {
      // All services are now functional factories returning service objects
      expect(gitStatusService).toBeDefined()
      expect(typeof gitStatusService).toBe('object')
      expect(typeof gitStatusService.getProjectGitStatus).toBe('function')

      expect(gitCommitService).toBeDefined()
      expect(typeof gitCommitService).toBe('object')
      expect(typeof gitCommitService.commitChanges).toBe('function')

      expect(gitBranchService).toBeDefined()
      expect(typeof gitBranchService).toBe('object')
      expect(typeof gitBranchService.getBranches).toBe('function')

      expect(gitStashService).toBeDefined()
      expect(typeof gitStashService).toBe('object')
      expect(typeof gitStashService.stash).toBe('function')

      expect(gitRemoteService).toBeDefined()
      expect(typeof gitRemoteService).toBe('object')
      expect(typeof gitRemoteService.getRemotes).toBe('function')

      expect(gitWorktreeService).toBeDefined()
      expect(typeof gitWorktreeService).toBe('object')
      expect(typeof gitWorktreeService.getWorktrees).toBe('function')

      expect(gitConfigService).toBeDefined()
      expect(typeof gitConfigService).toBe('object')
      expect(typeof gitConfigService.getConfig).toBe('function')
    })
  })

  describe('Backwards Compatibility', () => {
    test('should export all functions from index', async () => {
      const gitServices = await import('./index')

      // Check that all main functions are exported
      expect(typeof gitServices.getProjectGitStatus).toBe('function')
      expect(typeof gitServices.clearGitStatusCache).toBe('function')
      expect(typeof gitServices.stageFiles).toBe('function')
      expect(typeof gitServices.unstageFiles).toBe('function')
      expect(typeof gitServices.stageAll).toBe('function')
      expect(typeof gitServices.unstageAll).toBe('function')
      expect(typeof gitServices.commitChanges).toBe('function')
      expect(typeof gitServices.getCommitLog).toBe('function')
      expect(typeof gitServices.getBranches).toBe('function')
      expect(typeof gitServices.getCurrentBranch).toBe('function')
      expect(typeof gitServices.createBranch).toBe('function')
      expect(typeof gitServices.switchBranch).toBe('function')
      expect(typeof gitServices.deleteBranch).toBe('function')
      expect(typeof gitServices.mergeBranch).toBe('function')
      expect(typeof gitServices.stash).toBe('function')
      expect(typeof gitServices.stashList).toBe('function')
      expect(typeof gitServices.stashApply).toBe('function')
      expect(typeof gitServices.stashPop).toBe('function')
      expect(typeof gitServices.stashDrop).toBe('function')
      expect(typeof gitServices.getRemotes).toBe('function')
      expect(typeof gitServices.addRemote).toBe('function')
      expect(typeof gitServices.removeRemote).toBe('function')
      expect(typeof gitServices.fetch).toBe('function')
      expect(typeof gitServices.pull).toBe('function')
      expect(typeof gitServices.push).toBe('function')
      expect(typeof gitServices.getTags).toBe('function')
      expect(typeof gitServices.createTag).toBe('function')
      expect(typeof gitServices.deleteTag).toBe('function')
      expect(typeof gitServices.getWorktrees).toBe('function')
      expect(typeof gitServices.addWorktree).toBe('function')
      expect(typeof gitServices.removeWorktree).toBe('function')
      expect(typeof gitServices.lockWorktree).toBe('function')
      expect(typeof gitServices.unlockWorktree).toBe('function')
      expect(typeof gitServices.pruneWorktrees).toBe('function')
      expect(typeof gitServices.getConfig).toBe('function')
      expect(typeof gitServices.setConfig).toBe('function')
    })

    test('should export all from git-service.ts', async () => {
      const gitService = await import('../git-service')

      // Check that the main backwards compatibility layer works
      expect(typeof gitService.getProjectGitStatus).toBe('function')
      expect(typeof gitService.commitChanges).toBe('function')
      expect(typeof gitService.getBranches).toBe('function')
      expect(typeof gitService.stash).toBe('function')
      expect(typeof gitService.getRemotes).toBe('function')
      expect(typeof gitService.getWorktrees).toBe('function')
      expect(typeof gitService.getConfig).toBe('function')
    })
  })

  describe('Service Isolation', () => {
    test('each service should be an isolated functional service', () => {
      // All services are now functional factories
      // They have their own internal state and error handling
      // But don't expose loggers externally (encapsulation)
      
      // Test that services have all expected methods
      expect(typeof gitStatusService.getProjectGitStatus).toBe('function')
      expect(typeof gitStatusService.clearCache).toBe('function')
      expect(typeof gitStatusService.stageFiles).toBe('function')
      
      expect(typeof gitCommitService.commitChanges).toBe('function')
      expect(typeof gitCommitService.getCommitLog).toBe('function')
      expect(typeof gitCommitService.getCommitDetails).toBe('function')
      
      expect(typeof gitBranchService.getBranches).toBe('function')
      expect(typeof gitBranchService.createBranch).toBe('function')
      expect(typeof gitBranchService.switchBranch).toBe('function')
      
      expect(typeof gitStashService.stash).toBe('function')
      expect(typeof gitStashService.stashList).toBe('function')
      expect(typeof gitStashService.stashApply).toBe('function')
      
      expect(typeof gitRemoteService.getRemotes).toBe('function')
      expect(typeof gitRemoteService.fetch).toBe('function')
      expect(typeof gitRemoteService.push).toBe('function')
      
      expect(typeof gitWorktreeService.getWorktrees).toBe('function')
      expect(typeof gitWorktreeService.addWorktree).toBe('function')
      expect(typeof gitWorktreeService.removeWorktree).toBe('function')
      
      expect(typeof gitConfigService.getConfig).toBe('function')
      expect(typeof gitConfigService.setConfig).toBe('function')
      expect(typeof gitConfigService.getUserName).toBe('function')
    })
  })
})
