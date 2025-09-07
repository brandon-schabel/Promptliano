import type { GitStash } from '@promptliano/schemas'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { createGitServiceFactory, createGitUtils, type GitServiceDependencies } from '../core/service-factory-base'

export interface GitStashServiceDeps extends GitServiceDependencies {
  gitStatusService?: {
    clearCache: (projectId: number) => void
  }
}

/**
 * Create Git stash service with functional factory pattern
 */
export function createGitStashService(dependencies?: GitStashServiceDeps) {
  return createGitServiceFactory(
    {
      entityName: 'GitStash',
      serviceName: 'Stash',
      dependencies
    },
    (deps) => {
      const gitUtils = createGitUtils(deps.projectService, deps.errorHandler)

      // Default git status service dependency
      const gitStatusService = dependencies?.gitStatusService || {
        clearCache: (projectId: number) => {
          // Import lazily to avoid circular dependencies
          import('./git-status-service').then((module) => {
            module.gitStatusService.clearCache(projectId)
          })
        }
      }

      return {
        /**
         * Stash changes
         */
        async stash(projectId: number, message?: string): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)

            if (message) {
              await git.stash(['push', '-m', message])
            } else {
              await git.stash()
            }

            gitStatusService.clearCache(projectId)
          }, 'stash changes')
        },

        /**
         * List stashes
         */
        async stashList(projectId: number): Promise<GitStash[]> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)

            const stashListResult = await git.stashList()

            return stashListResult.all.map((stashItem: any, index: number) => {
              // Parse stash message format: stash@{0}: WIP on branch: message
              const message = stashItem.message || ''
              const match = message.match(/WIP on (.+?): (.+)$/) || message.match(/On (.+?): (.+)$/)

              return {
                index,
                message: match && match[2] ? match[2] : message,
                branch: match && match[1] ? match[1] : 'unknown',
                date: stashItem.date || new Date().toISOString()
              }
            })
          }, 'list stashes')
        },

        /**
         * Apply a stash
         */
        async stashApply(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)
            await git.stash(['apply', stashRef])
            gitStatusService.clearCache(projectId)
          }, 'apply stash')
        },

        /**
         * Pop a stash
         */
        async stashPop(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)
            await git.stash(['pop', stashRef])
            gitStatusService.clearCache(projectId)
          }, 'pop stash')
        },

        /**
         * Drop a stash
         */
        async stashDrop(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)
            await git.stash(['drop', stashRef])
          }, 'drop stash')
        }
      }
    }
  )
}

// Export type for consumers
export type GitStashService = ReturnType<typeof createGitStashService>

// Export singleton instance for backward compatibility
export const gitStashService = createGitStashService()

// Export individual functions for tree-shaking
export const { stash, stashList, stashApply, stashPop, stashDrop } = gitStashService
