import type { GitWorktree } from '@promptliano/schemas'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { createGitServiceFactory, createGitUtils, type GitServiceDependencies } from '../core/service-factory-base'
import * as path from 'path'

export interface GitWorktreeServiceDeps extends GitServiceDependencies {}

/**
 * Create Git worktree service with functional factory pattern
 */
export function createGitWorktreeService(dependencies?: GitWorktreeServiceDeps) {
  return createGitServiceFactory({
    entityName: 'GitWorktree',
    serviceName: 'Worktree',
    dependencies
  }, (deps) => {
    const gitUtils = createGitUtils(deps.projectService, deps.errorHandler)

    const service = {
      /**
       * Get all worktrees
       */
      async getWorktrees(projectId: number): Promise<GitWorktree[]> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git, projectPath } = await gitUtils.getGitInstance(projectId)

      // Get worktrees using porcelain format
      const worktreeList = await git.raw(['worktree', 'list', '--porcelain'])

      const worktrees: GitWorktree[] = []
      const lines = worktreeList.split('\n')

      let currentWorktree: Partial<GitWorktree> = {}

      for (const line of lines) {
        if (!line.trim()) {
          // Empty line indicates end of worktree entry
          if (currentWorktree.path) {
            worktrees.push({
              path: currentWorktree.path,
              branch: currentWorktree.branch || 'HEAD',
              commit: currentWorktree.commit || '',
              isMain: currentWorktree.isMain || false,
              isLocked: currentWorktree.isLocked || false,
              lockReason: currentWorktree.lockReason,
              prunable: currentWorktree.prunable
            })
            currentWorktree = {}
          }
          continue
        }

        const [key, ...valueParts] = line.split(' ')
        const value = valueParts.join(' ')

        switch (key) {
          case 'worktree':
            currentWorktree.path = value
            // Check if this is the main worktree
            currentWorktree.isMain = path.resolve(value) === projectPath
            break
          case 'HEAD':
            currentWorktree.commit = value
            break
          case 'branch':
            // branch refs/heads/branch-name
            currentWorktree.branch = value.replace('refs/heads/', '')
            break
          case 'detached':
            // If detached, there's no branch
            currentWorktree.branch = 'HEAD'
            break
          case 'locked':
            currentWorktree.isLocked = true
            if (value) {
              currentWorktree.lockReason = value
            }
            break
          case 'prunable':
            currentWorktree.prunable = true
            break
        }
      }

      // Add the last worktree if exists
      if (currentWorktree.path) {
        worktrees.push({
          path: currentWorktree.path,
          branch: currentWorktree.branch || 'HEAD',
          commit: currentWorktree.commit || '',
          isMain: currentWorktree.isMain || false,
          isLocked: currentWorktree.isLocked || false,
          lockReason: currentWorktree.lockReason,
          prunable: currentWorktree.prunable
        })
      }

          return worktrees
        }, 'get worktrees')
      },

      /**
       * Add a worktree
       */
      async addWorktree(
        projectId: number,
        options: {
          path: string
          branch?: string
          newBranch?: string
          commitish?: string
          detach?: boolean
        }
      ): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          // Resolve the worktree path to absolute
          const worktreePath = path.resolve(options.path)

          const args = ['worktree', 'add']

          // Add options
          if (options.newBranch) {
            args.push('-b', options.newBranch)
          } else if (options.detach) {
            args.push('--detach')
          }

          args.push(worktreePath)

          // Add branch/commit to checkout
          if (options.commitish) {
            args.push(options.commitish)
          } else if (options.branch && !options.newBranch) {
            args.push(options.branch)
          }

          await git.raw(args)
        }, 'add worktree')
      },

      /**
       * Remove a worktree
       */
      async removeWorktree(projectId: number, worktreePath: string, force: boolean = false): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          // Get current worktrees to validate
          const worktrees = await service.getWorktrees(projectId)
          const targetPath = path.resolve(worktreePath)
          const worktree = worktrees.find((w) => path.resolve(w.path) === targetPath)

          if (!worktree) {
            throw ErrorFactory.notFound('Worktree', worktreePath)
          }

          if (worktree.isMain) {
            throw ErrorFactory.validationFailed(
              new Error('Cannot remove the main worktree'),
              { code: 'CANNOT_REMOVE_MAIN_WORKTREE' }
            )
          }

          const args = ['worktree', 'remove']
          if (force) {
            args.push('--force')
          }
          args.push(targetPath)

          await git.raw(args)
        }, 'remove worktree')
      },

      /**
       * Lock a worktree
       */
      async lockWorktree(projectId: number, worktreePath: string, reason?: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const targetPath = path.resolve(worktreePath)

          const args = ['worktree', 'lock']
          if (reason) {
            args.push('--reason', reason)
          }
          args.push(targetPath)

          await git.raw(args)
        }, 'lock worktree')
      },

      /**
       * Unlock a worktree
       */
      async unlockWorktree(projectId: number, worktreePath: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const targetPath = path.resolve(worktreePath)

          await git.raw(['worktree', 'unlock', targetPath])
        }, 'unlock worktree')
      },

      /**
       * Prune worktrees
       */
      async pruneWorktrees(projectId: number, dryRun: boolean = false): Promise<string[]> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const args = ['worktree', 'prune']
          if (dryRun) {
            args.push('--dry-run')
          }
          args.push('--verbose')

          const result = await git.raw(args)

          // Parse the output to get pruned worktree paths
          const prunedPaths: string[] = []
          const lines = result.split('\n').filter(Boolean)

          for (const line of lines) {
            // Git outputs lines like "Removing worktrees/branch-name: gitdir file points to non-existent location"
            const match = line.match(/^Removing (.+?):|^Would remove (.+?):/)
            if (match) {
              prunedPaths.push(match[1] || match[2] || '')
            }
          }

          return prunedPaths
        }, 'prune worktrees')
      }
    }
    
    return service
  })
}

// Export type for consumers
export type GitWorktreeService = ReturnType<typeof createGitWorktreeService>

// Export singleton instance for backward compatibility
export const gitWorktreeService = createGitWorktreeService()

// Export individual functions for tree-shaking
export const {
  getWorktrees,
  addWorktree,
  removeWorktree,
  lockWorktree,
  unlockWorktree,
  pruneWorktrees
} = gitWorktreeService
