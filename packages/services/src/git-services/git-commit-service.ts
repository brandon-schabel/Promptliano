import type {
  GitCommit,
  GitLogEntry,
  GitDiff,
  GitLogEnhancedRequest,
  GitLogEnhancedResponse,
  GitCommitEnhanced,
  GitFileStats,
  GitCommitDetailResponse,
  GitFileDiff
} from '@promptliano/schemas'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { createGitServiceFactory, createGitUtils, type GitServiceDependencies } from '../core/service-factory-base'
import * as path from 'path'

export interface GitCommitServiceDeps extends GitServiceDependencies {
  gitStatusService?: {
    clearCache: (projectId: number) => void
  }
}

/**
 * Create Git commit service with functional factory pattern
 */
export function createGitCommitService(dependencies?: GitCommitServiceDeps) {
  return createGitServiceFactory({
    entityName: 'GitCommit',
    serviceName: 'Commit',
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

    // Helper functions
    const getRelativeTime = (dateString: string): string => {
      const date = new Date(dateString)
      const now = new Date()
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

      if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`

      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`

      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

      const days = Math.floor(hours / 24)
      if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`

      const weeks = Math.floor(days / 7)
      if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`

      const months = Math.floor(days / 30)
      if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`

      const years = Math.floor(days / 365)
      return `${years} year${years !== 1 ? 's' : ''} ago`
    }

    const parseRefs = (refsString: string): string[] => {
      if (!refsString) return []
      const cleaned = refsString.replace(/HEAD\s*->\s*/, '')
      if (!cleaned) return []
      return cleaned
        .split(',')
        .map((ref) => ref.trim())
        .filter(Boolean)
    }

    return {
      /**
       * Commit staged changes
       */
      async commitChanges(projectId: number, message: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          // Check if there are staged changes
          const status = await git.status()
          if (status.staged.length === 0) {
            throw ErrorFactory.validationFailed(
              new Error('No staged changes to commit'), 
              { code: 'NO_STAGED_CHANGES' }
            )
          }

          await git.commit(message)
          gitStatusService.clearCache(projectId)
        }, 'commit changes')
      },

      /**
       * Get commit log
       */
      async getCommitLog(
        projectId: number,
        options?: {
          limit?: number
          skip?: number
          offset?: number
          branch?: string
          file?: string
        }
      ): Promise<GitLogEntry[]> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git, projectPath } = await gitUtils.getGitInstance(projectId)

          const logOptions: any = {
            format: {
              hash: '%H',
              abbreviatedHash: '%h',
              message: '%s',
              authorName: '%an',
              authorEmail: '%ae',
              date: '%ai',
              refs: '%D'
            }
          }

          // Handle pagination
          const skipCount = options?.skip ?? options?.offset ?? 0
          if (options?.limit || skipCount > 0) {
            logOptions.maxCount = (options?.limit || 100) + skipCount
          }

          if (options?.file) {
            logOptions.file = path.join(projectPath, options.file)
          }

          const logResult = options?.branch ? await git.log([options.branch], logOptions) : await git.log(logOptions)

          const allEntries = logResult.all.map((commit: any) => ({
            hash: commit.hash,
            abbreviatedHash: commit.abbreviatedHash || commit.hash.substring(0, 7),
            message: commit.message,
            author: {
              name: commit.authorName || '',
              email: commit.authorEmail || ''
            },
            date: commit.date || new Date().toISOString(),
            refs: commit.refs || ''
          }))

          // Apply offset/skip
          if (skipCount > 0) {
            return allEntries.slice(skipCount, skipCount + (options?.limit || allEntries.length))
          }
          return allEntries
        }, 'get commit log')
      },

      /**
       * Get commit details
       */
      async getCommitDetails(projectId: number, commitHash: string): Promise<GitCommit> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const [commitInfo, diffSummary] = await Promise.all([
            git.show([commitHash, '--format=%H%n%s%n%b%n%an%n%ae%n%ai%n%cn%n%ce%n%ci%n%P']),
            git.diffSummary([`${commitHash}^`, commitHash])
          ])

          const lines = commitInfo.split('\n')
          const hash = lines[0] || ''
          const subject = lines[1] || ''
          const body = lines[2] || ''
          const message = body ? `${subject}\n\n${body}` : subject

          return {
            hash,
            message,
            author: {
              name: lines[3] || '',
              email: lines[4] || '',
              date: lines[5] || ''
            },
            committer: {
              name: lines[6] || '',
              email: lines[7] || '',
              date: lines[8] || ''
            },
            parents: lines[9] ? lines[9].split(' ') : [],
            files: diffSummary.files.map((f: any) => f.file)
          }
        }, 'get commit details')
      },

      /**
       * Get commit diff
       */
      async getCommitDiff(projectId: number, commitHash: string): Promise<GitDiff> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const [diffSummary, diffContent] = await Promise.all([
            git.diffSummary([`${commitHash}^`, commitHash]),
            git.diff([`${commitHash}^`, commitHash])
          ])

          return {
            files: diffSummary.files.map((file: any) => {
              const isBinary = 'binary' in file ? file.binary : false
              const additions = 'insertions' in file ? file.insertions : 0
              const deletions = 'deletions' in file ? file.deletions : 0

              return {
                path: file.file,
                type: isBinary
                  ? 'modified'
                  : additions > 0 && deletions === 0
                    ? 'added'
                    : additions === 0 && deletions > 0
                      ? 'deleted'
                      : 'modified',
                additions,
                deletions,
                binary: isBinary
              }
            }),
            additions: diffSummary.insertions,
            deletions: diffSummary.deletions,
            content: diffContent
          }
        }, 'get commit diff')
      },

      /**
       * Cherry-pick a commit
       */
      async cherryPick(projectId: number, commitHash: string): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)
          await git.raw(['cherry-pick', commitHash])
          gitStatusService.clearCache(projectId)
        }, 'cherry-pick commit')
      },

      /**
       * Revert a commit
       */
      async revert(projectId: number, commitHash: string, options?: { noCommit?: boolean }): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const revertOptions: string[] = []
          if (options?.noCommit) {
            revertOptions.push('--no-commit')
          }

          await git.revert(commitHash, revertOptions)
          gitStatusService.clearCache(projectId)
        }, 'revert commit')
      },

      /**
       * Get blame for a file
       */
      async blame(projectId: number, filePath: string): Promise<import('@promptliano/schemas').GitBlame> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const blameResult = await git.raw(['blame', '--porcelain', filePath])
          const lines: import('@promptliano/schemas').GitBlameLine[] = []
          const blameLines = blameResult.split('\n')
          let i = 0

          while (i < blameLines.length) {
            const line = blameLines[i]
            if (!line) {
              i++
              continue
            }

            const match = line.match(/^([0-9a-f]+) (\d+) (\d+)/)
            if (match) {
              const commit = match[1] || ''
              const lineNumber = parseInt(match[3] || '0', 10)

              let author = ''
              let date = ''
              let content = ''

              i++
              while (i < blameLines.length && blameLines[i] && !blameLines[i]?.startsWith('\t')) {
                const metaLine = blameLines[i]
                if (metaLine && metaLine.startsWith('author ')) {
                  author = metaLine.substring(7)
                } else if (metaLine && metaLine.startsWith('author-time ')) {
                  const timestamp = parseInt(metaLine.substring(12), 10)
                  date = new Date(timestamp * 1000).toISOString()
                }
                i++
              }

              if (i < blameLines.length && blameLines[i] && blameLines[i]?.startsWith('\t')) {
                content = blameLines[i]?.substring(1) || ''
              }

              lines.push({
                line: lineNumber,
                content,
                commit,
                author,
                date
              })
            }
            i++
          }

          return {
            path: filePath,
            lines
          }
        }, 'get blame')
      },


      /**
       * Get enhanced commit log
       */
      async getCommitLogEnhanced(projectId: number, request: GitLogEnhancedRequest): Promise<GitLogEnhancedResponse> {
        return withErrorContext(async () => {
          try {
            const { git } = await gitUtils.getGitInstance(projectId)

      const currentBranch = request.branch || (await git.status()).current || 'HEAD'
      const skip = (request.page - 1) * request.perPage

      const logOptions: any = {
        format: {
          hash: '%H',
          abbreviatedHash: '%h',
          subject: '%s',
          body: '%B',
          authorName: '%an',
          authorEmail: '%ae',
          authorDate: '%aI',
          committerName: '%cn',
          committerEmail: '%ce',
          committerDate: '%cI',
          parents: '%P',
          refs: '%D'
        },
        maxCount: request.perPage + skip + 1,
        '--': null
      }

      if (request.author) logOptions['--author'] = request.author
      if (request.since) logOptions['--since'] = request.since
      if (request.until) logOptions['--until'] = request.until
      if (request.search) logOptions['--grep'] = request.search

      const logResult = request.branch ? await git.log([request.branch], logOptions) : await git.log(logOptions)
      const allCommits = logResult.all
      const pageCommits = allCommits.slice(skip, skip + request.perPage)
      const hasMore = allCommits.length > skip + request.perPage

      const enhancedCommits: GitCommitEnhanced[] = await Promise.all(
        pageCommits.map(async (commit: any) => {
          const result: GitCommitEnhanced = {
            hash: commit.hash,
            abbreviatedHash: commit.abbreviatedHash || commit.hash.substring(0, 8),
            subject: commit.subject || commit.body?.split('\n')[0] || '',
            body: commit.body || commit.subject || '',
            author: {
              name: commit.authorName || '',
              email: commit.authorEmail || ''
            },
            committer: {
              name: commit.committerName || commit.authorName || '',
              email: commit.committerEmail || commit.authorEmail || ''
            },
            authoredDate: commit.authorDate || new Date().toISOString(),
            committedDate: commit.committerDate || commit.authorDate || new Date().toISOString(),
            relativeTime: getRelativeTime(commit.authorDate || new Date().toISOString()),
            parents: commit.parents ? commit.parents.split(' ').filter(Boolean) : [],
            refs: parseRefs(commit.refs || ''),
            stats: {
              filesChanged: 0,
              additions: 0,
              deletions: 0
            }
          }

          if (request.includeStats || request.includeFileDetails) {
            try {
              const numstat = await git.raw(['show', '--numstat', '--format=', commit.hash])
              const fileStats: GitFileStats[] = []
              let totalAdditions = 0
              let totalDeletions = 0

              const lines = numstat.trim().split('\n').filter(Boolean)
              for (const line of lines) {
                const parts = line.split('\t')
                if (parts.length >= 3) {
                  const additions = parseInt(parts[0] || '0', 10) || 0
                  const deletions = parseInt(parts[1] || '0', 10) || 0
                  const filePath = parts[2] || ''

                  let status: GitFileStats['status'] = 'modified'
                  let oldPath: string | undefined

                  if (filePath && filePath.includes('=>')) {
                    const renameParts = filePath.match(/(.+?)\s*=>\s*(.+)/)
                    if (renameParts) {
                      oldPath = renameParts[1]?.trim()
                      status = 'renamed'
                    }
                  } else if (additions > 0 && deletions === 0) {
                    status = 'added'
                  } else if (additions === 0 && deletions > 0) {
                    status = 'deleted'
                  }

                  if (request.includeFileDetails && filePath) {
                    fileStats.push({ path: filePath, additions, deletions, status, oldPath })
                  }

                  totalAdditions += additions
                  totalDeletions += deletions
                }
              }

              result.stats = {
                filesChanged: fileStats.length,
                additions: totalAdditions,
                deletions: totalDeletions
              }

              if (request.includeFileDetails) {
                result.fileStats = fileStats
              }
            } catch (error) {
              deps.logger.error(`Failed to get stats for commit ${commit.hash}:`, error)
            }
          }

          return result
        })
      )

            return {
              success: true,
              data: {
                commits: enhancedCommits,
                pagination: {
                  page: request.page,
                  perPage: request.perPage,
                  hasMore,
                  totalCount: undefined
                },
                branch: currentBranch
              }
            }
          } catch (error) {
            return {
              success: false,
              message: `Failed to get enhanced commit log: ${error instanceof Error ? error.message : String(error)}`
            }
          }
        }, { entity: 'GitCommit', action: 'getCommitLogEnhanced' })
      },

      /**
       * Get detailed commit information
       */
      async getCommitDetail(
        projectId: number,
        commitHash: string,
        includeFileContents: boolean = false
      ): Promise<GitCommitDetailResponse> {
        return withErrorContext(async () => {
          try {
            const { git } = await gitUtils.getGitInstance(projectId)

      const commitFormat = ['%H', '%h', '%s', '%b', '%an', '%ae', '%aI', '%cn', '%ce', '%cI', '%P', '%D'].join('%n')

      const showResult = await git.show([commitHash, `--format=${commitFormat}`, '--no-patch'])
      const lines = showResult.split('\n')
      const [hash = '', abbreviatedHash = '', subject = '', ...bodyAndRest] = lines

      let bodyEndIndex = bodyAndRest.findIndex((line: string) => line === '')
      if (bodyEndIndex === -1) bodyEndIndex = bodyAndRest.length

      const body = bodyAndRest.slice(0, bodyEndIndex).join('\n')
      const metadataLines = bodyAndRest.slice(bodyEndIndex + 1)

      const [
        authorName = '',
        authorEmail = '',
        authorDate = '',
        committerName = '',
        committerEmail = '',
        committerDate = '',
        parents = '',
        refs = ''
      ] = metadataLines

      const numstatResult = await git.raw(['show', '--numstat', '--format=', commitHash])
      const fileDiffs: GitFileDiff[] = []
      let totalAdditions = 0
      let totalDeletions = 0

      const numstatLines = numstatResult.trim().split('\n').filter(Boolean)
      for (const line of numstatLines) {
        const parts = line.split('\t')
        if (parts.length >= 3) {
          const additions = parts[0] === '-' || !parts[0] ? 0 : parseInt(parts[0], 10) || 0
          const deletions = parts[1] === '-' || !parts[1] ? 0 : parseInt(parts[1], 10) || 0
          const filePath = parts[2] || ''

          let status: GitFileDiff['status'] = 'modified'
          let path = filePath
          let oldPath: string | undefined

          if (filePath && filePath.includes('=>')) {
            const renameParts = filePath.match(/^(?:\{(.+?)\s*=>\s*(.+?)\}|(.+?)\s*=>\s*(.+))$/)
            if (renameParts) {
              oldPath = renameParts[1] || renameParts[3] || undefined
              path = renameParts[2] || renameParts[4] || filePath
              status = 'renamed'
            }
          } else if (additions > 0 && deletions === 0) {
            status = 'added'
          } else if (additions === 0 && deletions > 0) {
            status = 'deleted'
          }

          fileDiffs.push({
            path: path || filePath,
            status,
            additions,
            deletions,
            binary: parts[0] === '-' && parts[1] === '-',
            oldPath
          })

          if (!fileDiffs[fileDiffs.length - 1]?.binary) {
            totalAdditions += additions
            totalDeletions += deletions
          }
        }
      }

      if (includeFileContents) {
        for (const file of fileDiffs) {
          if (!file.binary) {
            try {
              const diff = await git.diff([`${commitHash}^`, commitHash, '--', file.path])
              file.diff = diff
            } catch (error) {
              try {
                const diff = await git.show([commitHash, '--', file.path])
                file.diff = diff
              } catch {
                // Ignore diff errors
              }
            }
          }
        }
      }

      const enhancedCommit: GitCommitEnhanced = {
        hash,
        abbreviatedHash,
        subject,
        body: body || subject,
        author: { name: authorName || '', email: authorEmail || '' },
        committer: {
          name: committerName || authorName || '',
          email: committerEmail || authorEmail || ''
        },
        authoredDate: authorDate || new Date().toISOString(),
        committedDate: committerDate || authorDate || new Date().toISOString(),
        relativeTime: getRelativeTime(authorDate || new Date().toISOString()),
        parents: parents ? parents.split(' ').filter(Boolean) : [],
        refs: parseRefs(refs || ''),
        stats: {
          filesChanged: fileDiffs.length,
          additions: totalAdditions,
          deletions: totalDeletions
        },
        fileStats: fileDiffs.map((f) => ({
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          status: f.status,
          oldPath: f.oldPath
        }))
      }

      let totalDiff: string | undefined
      if (includeFileContents) {
        try {
          totalDiff = await git.diff([`${commitHash}^`, commitHash])
        } catch {
          totalDiff = await git.show([commitHash])
        }
      }

            return {
              success: true,
              data: {
                commit: enhancedCommit,
                files: fileDiffs,
                totalDiff
              }
            }
          } catch (error) {
            return {
              success: false,
              message: `Failed to get commit detail: ${error instanceof Error ? error.message : String(error)}`
            }
          }
        }, { entity: 'GitCommit', action: 'getCommitDetail' })
      },

      /**
       * Reset to a specific ref
       */
      async reset(projectId: number, ref: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)
          await git.reset([`--${mode}`, ref])
          gitStatusService.clearCache(projectId)
        }, 'reset')
      }
    }
  })
}

// Export type for consumers
export type GitCommitService = ReturnType<typeof createGitCommitService>

// Export singleton instance for backward compatibility
export const gitCommitService = createGitCommitService()

// Export individual functions for tree-shaking
export const {
  commitChanges,
  getCommitLog,
  getCommitDetails,
  getCommitDiff,
  cherryPick,
  revert,
  blame,
  getCommitLogEnhanced,
  getCommitDetail,
  reset
} = gitCommitService
