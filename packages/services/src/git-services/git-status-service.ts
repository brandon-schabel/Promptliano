import type { StatusResult, FileStatusResult } from 'simple-git'
import type { GitStatus, GitFileStatus, GitStatusResult, GitFileStatusType } from '@promptliano/schemas'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { createGitServiceFactory, createGitUtils, type GitServiceDependencies } from '../core/service-factory-base'
import { retryOperation } from '../utils/retry-operation'

// Cache interface
interface GitStatusCache {
  status: GitStatus
  timestamp: number
}

export interface GitStatusServiceDeps extends GitServiceDependencies {}

/**
 * Create Git status service with functional factory pattern
 */
export function createGitStatusService(dependencies?: GitStatusServiceDeps) {
  return createGitServiceFactory(
    {
      entityName: 'GitStatus',
      serviceName: 'Status',
      dependencies
    },
    (deps) => {
      const gitUtils = createGitUtils(deps.projectService, deps.errorHandler)

      // Cache for status results
      const statusCache = new Map<number, GitStatusCache>()
      const CACHE_TTL = 5000 // 5 seconds

      // Helper functions
      const getGitFileStatus = (file: FileStatusResult): GitFileStatusType => {
        if (file.index === 'A' || file.working_dir === 'A') return 'added'
        if (file.index === 'D' || file.working_dir === 'D') return 'deleted'
        if (file.index === 'M' || file.working_dir === 'M') return 'modified'
        if (file.index === 'R' || file.working_dir === 'R') return 'renamed'
        if (file.index === 'C' || file.working_dir === 'C') return 'copied'
        if (file.index === '?' && file.working_dir === '?') return 'untracked'
        if (file.index === '!' && file.working_dir === '!') return 'ignored'
        return 'unchanged'
      }

      const mapGitStatusToSchema = (status: StatusResult): GitStatus => {
        const files: GitFileStatus[] = status.files.map((file) => ({
          path: file.path,
          status: getGitFileStatus(file),
          staged: file.index !== ' ' && file.index !== '?',
          index: file.index || null,
          workingDir: file.working_dir || null
        }))

        return {
          isRepo: true,
          current: status.current || null,
          tracking: status.tracking || null,
          ahead: status.ahead,
          behind: status.behind,
          files,
          staged: status.staged,
          modified: status.modified,
          created: status.created,
          deleted: status.deleted,
          renamed: status.renamed.map((r) => r.to),
          conflicted: status.conflicted
        }
      }

      return {
        /**
         * Get project git status
         */
        async getProjectGitStatus(projectId: number): Promise<GitStatusResult> {
          try {
            // Check cache first
            const cached = statusCache.get(projectId)
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
              return {
                success: true,
                data: cached.status
              }
            }

            const { git, projectPath } = await gitUtils.getGitInstance(projectId)

            // Check if it's a git repository
            const isRepo = await retryOperation(() => git.checkIsRepo(), {
              maxAttempts: 2,
              shouldRetry: (error) => {
                return (
                  error.message?.includes('ENOENT') === false &&
                  (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')
                )
              }
            })

            if (!isRepo) {
              return {
                success: false,
                error: {
                  type: 'not_a_repo',
                  message: 'The project directory is not a git repository'
                }
              }
            }

            // Get the status with retry for network issues
            const status = await retryOperation(() => git.status(), {
              maxAttempts: 3,
              shouldRetry: (error) => {
                return (
                  error.code === 'ENOTFOUND' ||
                  error.code === 'ETIMEDOUT' ||
                  error.message?.includes('Could not read from remote repository')
                )
              }
            })

            const gitStatus = mapGitStatusToSchema(status as any)

            // Cache the result
            statusCache.set(projectId, {
              status: gitStatus,
              timestamp: Date.now()
            })

            return {
              success: true,
              data: gitStatus
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            if (errorMessage.includes('not a git repository')) {
              return {
                success: false,
                error: {
                  type: 'not_a_repo',
                  message: 'The project directory is not a git repository'
                }
              }
            }

            if (errorMessage.includes('git: command not found') || errorMessage.includes('git not found')) {
              return {
                success: false,
                error: {
                  type: 'git_not_installed',
                  message: 'Git is not installed on the system'
                }
              }
            }

            if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
              return {
                success: false,
                error: {
                  type: 'permission_denied',
                  message: 'Permission denied when accessing the git repository'
                }
              }
            }

            // Use ErrorFactory.wrap to handle unknown errors consistently
            const wrappedError = ErrorFactory.wrap(error, 'git status operation')
            return {
              success: false,
              error: {
                type: 'unknown',
                message: wrappedError.message
              }
            }
          }
        },

        /**
         * Clear git status cache
         */
        clearCache(projectId?: number): void {
          if (projectId !== undefined) {
            statusCache.delete(projectId)
          } else {
            statusCache.clear()
          }
        },

        /**
         * Stage files
         */
        async stageFiles(projectId: number, filePaths: string[]): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git, projectPath } = await gitUtils.getGitInstance(projectId)
            const relativePaths = gitUtils.toRelativePaths(projectPath, filePaths)
            await git.add(relativePaths)
            statusCache.delete(projectId)
          }, 'stage files')
        },

        /**
         * Unstage files
         */
        async unstageFiles(projectId: number, filePaths: string[]): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git, projectPath } = await gitUtils.getGitInstance(projectId)
            const relativePaths = gitUtils.toRelativePaths(projectPath, filePaths)
            await git.reset(['HEAD', ...relativePaths])
            statusCache.delete(projectId)
          }, 'unstage files')
        },

        /**
         * Stage all files
         */
        async stageAll(projectId: number): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)
            await git.add('.')
            statusCache.delete(projectId)
          }, 'stage all files')
        },

        /**
         * Unstage all files
         */
        async unstageAll(projectId: number): Promise<void> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)
            await git.reset(['HEAD'])
            statusCache.delete(projectId)
          }, 'unstage all files')
        },

        /**
         * Get file diff
         */
        async getFileDiff(
          projectId: number,
          filePath: string,
          options?: { commit?: string; staged?: boolean }
        ): Promise<string> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)

            if (options?.staged) {
              return await git.diff(['--cached', '--', filePath])
            } else if (options?.commit) {
              return await git.diff([`${options.commit}^`, options.commit, '--', filePath])
            } else {
              return await git.diff(['--', filePath])
            }
          }, 'get file diff')
        },

        /**
         * Clean untracked files
         */
        async clean(
          projectId: number,
          options?: { directories?: boolean; force?: boolean; dryRun?: boolean }
        ): Promise<string[]> {
          return deps.errorHandler.withGitErrorHandling(async () => {
            const { git } = await gitUtils.getGitInstance(projectId)

            const cleanOptions: string[] = []
            if (options?.directories) cleanOptions.push('-d')
            if (options?.force) cleanOptions.push('-f')
            if (options?.dryRun) cleanOptions.push('-n')

            const result = (await git.clean(cleanOptions.join(''))) as
              | string
              | { paths?: string[]; files?: string[]; folders?: string[] }

            // Handle both string and CleanSummary results
            if (typeof result === 'string') {
              return result.split('\n').filter(Boolean)
            } else {
              const cleanResult = result as { paths?: string[]; files?: string[]; folders?: string[] }
              return [...(cleanResult.paths || []), ...(cleanResult.files || []), ...(cleanResult.folders || [])]
            }
          }, 'clean')
        }
      }
    }
  )
}

// Export type for consumers
export type GitStatusService = ReturnType<typeof createGitStatusService>

// Export singleton instance for backward compatibility
export const gitStatusService = createGitStatusService()

// Export individual functions for tree-shaking
export const { getProjectGitStatus, clearCache, stageFiles, unstageFiles, stageAll, unstageAll, getFileDiff, clean } =
  gitStatusService
