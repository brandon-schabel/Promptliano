import type { GitRemote, GitTag } from '@promptliano/schemas'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { createGitServiceFactory, createGitUtils, type GitServiceDependencies } from '../core/service-factory-base'

export interface GitRemoteServiceDeps extends GitServiceDependencies {
  gitStatusService?: {
    clearCache: (projectId: number) => void
  }
}

/**
 * Create Git remote service with functional factory pattern
 */
export function createGitRemoteService(dependencies?: GitRemoteServiceDeps) {
  return createGitServiceFactory({
    entityName: 'GitRemote',
    serviceName: 'Remote',
    dependencies
  }, (deps) => {
    const gitUtils = createGitUtils(deps.projectService, deps.errorHandler)
    
    // Default git status service dependency
    const gitStatusService = dependencies?.gitStatusService || {
      clearCache: (projectId: number) => {
        // Import lazily to avoid circular dependencies
        import('./git-status-service').then(module => {
          module.gitStatusService.clearCache(projectId)
        })
      }
    }

    return {
      /**
       * Get all remotes
       */
      async getRemotes(projectId: number): Promise<GitRemote[]> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const remotes = await git.getRemotes(true)

          return remotes.map((remote: any) => ({
            name: remote.name,
            fetch: remote.refs.fetch || '',
            push: remote.refs.push || ''
          }))
        }, 'get remotes')
      },

      /**
       * Add a remote
       */
      async addRemote(projectId: number, name: string, url: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)
          await git.addRemote(name, url)
        }, 'add remote')
      },

      /**
       * Remove a remote
       */
      async removeRemote(projectId: number, name: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)
          await git.removeRemote(name)
        }, 'remove remote')
      },

      /**
       * Fetch from remote
       */
      async fetch(projectId: number, remote: string = 'origin', options?: { prune?: boolean }): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const fetchOptions: string[] = []
          if (options?.prune) {
            fetchOptions.push('--prune')
          }

          await git.fetch([remote, ...fetchOptions])
        }, 'fetch from remote')
      },

      /**
       * Pull from remote
       */
      async pull(
        projectId: number,
        remote: string = 'origin',
        branch?: string,
        options?: { rebase?: boolean }
      ): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const pullOptions: any = {}
          if (options?.rebase) {
            pullOptions['--rebase'] = null
          }

          if (branch) {
            await git.pull(remote, branch, pullOptions)
          } else {
            await git.pull(remote, pullOptions)
          }

          gitStatusService.clearCache(projectId)
        }, 'pull from remote')
      },

      /**
       * Push to remote
       */
      async push(
        projectId: number,
        remote: string = 'origin',
        branch?: string,
        options?: { force?: boolean; setUpstream?: boolean }
      ): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const pushOptions: any = {}
          if (options?.force) {
            pushOptions['--force'] = null
          }
          if (options?.setUpstream) {
            pushOptions['--set-upstream'] = null
          }

          if (branch) {
            await git.push(remote, branch, pushOptions)
          } else {
            await git.push(remote, pushOptions)
          }
        }, 'push to remote')
      },

      /**
       * Get all tags
       */
      async getTags(projectId: number): Promise<GitTag[]> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const tags = await git.tags([
            '--format=%(refname:short)%09%(objectname)%09%(subject)%09%(taggername)%09%(taggeremail)%09%(taggerdate:iso)'
          ])

          return tags.all.map((tagLine: string) => {
            const [name = '', commit = '', annotation = '', taggerName = '', taggerEmail = '', taggerDate = ''] =
              tagLine.split('\t')

            const tag: GitTag = {
              name,
              commit,
              annotation: annotation || undefined
            }

            if (taggerName && taggerEmail) {
              tag.tagger = {
                name: taggerName,
                email: taggerEmail,
                date: taggerDate
              }
            }

            return tag
          })
        }, 'get tags')
      },

      /**
       * Create a tag
       */
      async createTag(projectId: number, tagName: string, options?: { message?: string; ref?: string }): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const tagOptions: string[] = []
          if (options?.message) {
            tagOptions.push('-a', tagName, '-m', options.message)
          } else {
            tagOptions.push(tagName)
          }

          if (options?.ref) {
            tagOptions.push(options.ref)
          }

          await git.tag(tagOptions)
        }, 'create tag')
      },

      /**
       * Delete a tag
       */
      async deleteTag(projectId: number, tagName: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)
          await git.tag(['-d', tagName])
        }, 'delete tag')
      }
    }
  })
}

// Export type for consumers
export type GitRemoteService = ReturnType<typeof createGitRemoteService>

// Export singleton instance for backward compatibility
export const gitRemoteService = createGitRemoteService()

// Export individual functions for tree-shaking
export const {
  getRemotes,
  addRemote,
  removeRemote,
  fetch,
  pull,
  push,
  getTags,
  createTag,
  deleteTag
} = gitRemoteService
