/**
 * Generated Git Hooks - Factory Pattern Implementation
 * Migrated from use-git-api.ts with polling intervals preserved
 * 
 * Replaces 900+ lines of manual Git hook code with factory-based patterns
 * Maintains all polling intervals: 5s for status, 30s for branches, etc.
 */

import { useApiClient } from '../api/use-api-client'
import { createCrudHooks } from '../factories/crud-hook-factory'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
// Define Git types locally to avoid import issues
export type GitStatusResult = {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
}

export type GitBranch = {
  name: string
  current: boolean
  ahead?: number
  behind?: number
}

export type GitLogEntry = {
  hash: string
  message: string
  author: string
  date: string
}

export type GitRemote = {
  name: string
  url: string
}

export type GitTag = {
  name: string
  hash: string
  message?: string
}

export type GitStash = {
  index: number
  message: string
  branch: string
}

export type GitLogEnhancedRequest = {
  branch?: string
  limit?: number
  offset?: number
}

export type GitLogEnhancedResponse = {
  entries: GitLogEntry[]
  total: number
  hasMore: boolean
}

export type GitBranchListEnhancedResponse = {
  branches: GitBranch[]
  current: string
}

export type GitCommitDetailResponse = {
  commit: GitLogEntry
  files: any[]
}

export type GitDiffResponse = {
  files: {
    path: string
    type: 'added' | 'modified' | 'deleted' | 'renamed'
    additions: number
    deletions: number
    binary: boolean
    oldPath?: string
  }[]
  additions: number
  deletions: number
  content?: string
  diff?: string // Add support for diff property
}

// ============================================================================
// Query Keys (enhanced from original)
// ============================================================================

export const GIT_KEYS = {
  all: ['git'] as const,
  project: (projectId: number) => [...GIT_KEYS.all, 'project', projectId] as const,
  status: (projectId: number) => [...GIT_KEYS.project(projectId), 'status'] as const,
  branches: (projectId: number) => [...GIT_KEYS.project(projectId), 'branches'] as const,
  branchesEnhanced: (projectId: number) => [...GIT_KEYS.project(projectId), 'branches', 'enhanced'] as const,
  log: (projectId: number, options?: any) => [...GIT_KEYS.project(projectId), 'log', options] as const,
  logEnhanced: (projectId: number, params?: any) => [...GIT_KEYS.project(projectId), 'log', 'enhanced', params] as const,
  commitDetail: (projectId: number, hash: string, includeFiles?: boolean) => 
    [...GIT_KEYS.project(projectId), 'commits', hash, { includeFileContents: includeFiles }] as const,
  diff: (projectId: number, filePath: string, options?: any) => 
    [...GIT_KEYS.project(projectId), 'diff', filePath, options] as const,
  remotes: (projectId: number) => [...GIT_KEYS.project(projectId), 'remotes'] as const,
  tags: (projectId: number) => [...GIT_KEYS.project(projectId), 'tags'] as const,
  stash: (projectId: number) => [...GIT_KEYS.project(projectId), 'stash'] as const,
  worktrees: (projectId: number) => [...GIT_KEYS.project(projectId), 'worktrees'] as const
}

// ============================================================================
// Factory Configuration for Git Operations
// ============================================================================

// Git operations don't follow standard CRUD patterns, so we'll skip the factory
// and use custom hooks for all operations

// ============================================================================
// Core Git Query Hooks (migrated with polling preserved)
// ============================================================================

/**
 * Get project Git status with 5s polling (preserved from original)
 */
export function useProjectGitStatus(projectId: number | undefined, enabled = true) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: GIT_KEYS.status(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getProjectGitStatus(projectId)
      // Handle both wrapped and unwrapped responses
      if (response && typeof response === 'object' && 'success' in response && !(response as any).success) {
        throw new Error((response as any).error?.message || (response as any).message || 'Failed to fetch git status')
      }
      return response?.data || response
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: 5000, // 5s polling preserved
    staleTime: 4000, // 4s stale time preserved
    refetchIntervalInBackground: true
  })
}

/**
 * Get files with changes (computed from status)
 */
export function useGitFilesWithChanges(projectId: number | undefined) {
  const { data: gitStatus } = useProjectGitStatus(projectId)

  if (!gitStatus) {
    return []
  }

  // Handle both wrapped and unwrapped responses  
  const statusData = (gitStatus as any)?.data || gitStatus
  if (!statusData || typeof statusData !== 'object' || !('files' in statusData)) {
    return []
  }

  return statusData.files.filter((file: any) => file.status !== 'unchanged' && file.status !== 'ignored')
}

/**
 * Get file diff
 */
export function useFileDiff(
  projectId: number | undefined,
  filePath: string | undefined,
  options?: { staged?: boolean; commit?: string },
  enabled = true
) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_KEYS.diff(projectId!, filePath!, options),
    queryFn: async () => {
      if (!projectId || !filePath) throw new Error('Project ID and file path are required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getFileDiff(projectId, filePath, options)
      // Handle both wrapped and unwrapped responses
      if (response && typeof response === 'object' && 'success' in response && !(response as any).success) {
        throw new Error((response as any).error?.message || (response as any).message || 'Failed to fetch file diff')
      }
      const diffData = response?.data || response
      // Ensure diff property is available for backward compatibility
      if (diffData && typeof diffData === 'object' && 'content' in diffData && !('diff' in diffData)) {
        (diffData as any).diff = diffData.content
      }
      return diffData
    },
    enabled: !!client && enabled && !!projectId && !!filePath,
    staleTime: 30000 // 30s stale time preserved
  })
}

// ============================================================================
// Branch Management Hooks (migrated with polling preserved)
// ============================================================================

/**
 * Get Git branches with 10s stale time
 */
export function useGitBranches(projectId: number | undefined, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.branches(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getBranches(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch branches')
      }
      return response.data
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 10000 // 10s stale time preserved
  })
}

/**
 * Get enhanced branches with 30s polling (preserved from original)
 */
export function useBranchesEnhanced(projectId: number | undefined, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.branchesEnhanced(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getBranchesEnhanced(projectId)
      const typedResponse = response as any as { success: boolean; data?: any; message?: string }
      if (!typedResponse.success) {
        throw new Error(typedResponse.message || 'Failed to fetch enhanced branches')
      }
      if (!typedResponse.data) {
        throw new Error('No enhanced branches data returned')
      }
      return typedResponse.data
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 10000,
    refetchInterval: 30000, // 30s polling preserved
    refetchIntervalInBackground: true
  })
}

// ============================================================================
// Commit History Hooks
// ============================================================================

/**
 * Get Git commit log
 */
export function useGitLog(
  projectId: number | undefined,
  options?: { limit?: number; skip?: number; branch?: string; file?: string },
  enabled = true
) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.log(projectId!, options),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getCommitLog(projectId, options)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch commit log')
      }
      return response
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 30000 // 30s stale time preserved
  })
}

/**
 * Get enhanced commit log
 */
export function useCommitLogEnhanced(projectId: number | undefined, params?: GitLogEnhancedRequest, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.logEnhanced(projectId!, params),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getCommitLogEnhanced(projectId, params)
      const typedResponse = response as any as { success: boolean; data?: any; message?: string }
      if (!typedResponse.success) {
        throw new Error(typedResponse.message || 'Failed to fetch enhanced commit log')
      }
      if (!typedResponse.data) {
        throw new Error('No enhanced commit log data returned')
      }
      return typedResponse.data
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 30000 // 30s stale time preserved
  })
}

/**
 * Get commit details
 */
export function useCommitDetail(
  projectId: number | undefined,
  hash: string | undefined,
  includeFileContents?: boolean,
  enabled = true
) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.commitDetail(projectId!, hash!, includeFileContents),
    queryFn: async () => {
      if (!projectId || !hash) throw new Error('Project ID and commit hash are required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getCommitDetail(projectId, hash, includeFileContents)
      const typedResponse = response as any as { success: boolean; data?: any; message?: string }
      if (!typedResponse.success) {
        throw new Error(typedResponse.message || 'Failed to fetch commit details')
      }
      if (!typedResponse.data) {
        throw new Error('No commit details data returned')
      }
      return typedResponse.data
    },
    enabled: !!client && enabled && !!projectId && !!hash,
    staleTime: 60000 // 1 minute stale time preserved
  })
}

// ============================================================================
// Remote Operations Hooks
// ============================================================================

/**
 * Get Git remotes
 */
export function useGitRemotes(projectId: number | undefined, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.remotes(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getRemotes(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch remotes')
      }
      return response.data
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 60000 // 1 minute stale time preserved
  })
}

// ============================================================================
// Tag Management Hooks
// ============================================================================

/**
 * Get Git tags
 */
export function useGitTags(projectId: number | undefined, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.tags(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getTags(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch tags')
      }
      return response.data
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 30000 // 30s stale time preserved
  })
}

// ============================================================================
// Stash Management Hooks
// ============================================================================

/**
 * Get Git stash list
 */
export function useGitStashList(projectId: number | undefined, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.stash(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.getStashList(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch stash list')
      }
      return response
    },
    enabled: !!client && enabled && !!projectId,
    staleTime: 10000 // 10s stale time preserved
  })
}

// ============================================================================
// Worktree Operations Hooks
// ============================================================================

/**
 * Get Git worktrees
 */
export function useGitWorktrees(projectId: number | undefined, enabled = true) {
  const client = useApiClient()

  return useQuery({
    queryKey: GIT_ENHANCED_KEYS.worktrees(projectId!),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      const response = await client.git.worktrees.list(projectId)
      const typedResponse = response as any as { success: boolean; data?: any; message?: string }
      if (!typedResponse.success) {
        throw new Error(typedResponse.message || 'Failed to fetch worktrees')
      }
      if (!typedResponse.data) {
        throw new Error('No worktrees data returned')
      }
      return typedResponse.data
    },
    enabled: !!client && enabled && !!projectId
  })
}

// ============================================================================
// File Staging Mutation Hooks
// ============================================================================

/**
 * Stage files
 */
export function useStageFiles(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filePaths: string[]) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.stageFiles(projectId, filePaths)
    },
    onSuccess: (data, filePaths) => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success(`Staged ${filePaths.length} file(s)`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to stage files: ${error.message}`)
    }
  })
}

/**
 * Unstage files
 */
export function useUnstageFiles(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filePaths: string[]) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.unstageFiles(projectId, filePaths)
    },
    onSuccess: (data, filePaths) => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success(`Unstaged ${filePaths.length} file(s)`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to unstage files: ${error.message}`)
    }
  })
}

/**
 * Stage all files
 */
export function useStageAll(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.stageAll(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success('Staged all files')
    },
    onError: (error: Error) => {
      toast.error(`Failed to stage all files: ${error.message}`)
    }
  })
}

/**
 * Unstage all files
 */
export function useUnstageAll(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.unstageAll(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success('Unstaged all files')
    },
    onError: (error: Error) => {
      toast.error(`Failed to unstage all files: ${error.message}`)
    }
  })
}

/**
 * Commit changes
 */
export function useCommitChanges(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (message: string) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.commitChanges(projectId, message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success('Changes committed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to commit changes: ${error.message}`)
    }
  })
}

// ============================================================================
// Branch Management Mutation Hooks
// ============================================================================

/**
 * Create branch
 */
export function useCreateBranch(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, startPoint }: { name: string; startPoint?: string }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.createBranch(projectId, { name, startPoint })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.branches(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success(`Created branch '${variables.name}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create branch: ${error.message}`)
    }
  })
}

/**
 * Switch branch
 */
export function useSwitchBranch(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (branchName: string) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.switchBranch(projectId, branchName)
    },
    onSuccess: (data, branchName) => {
      // Invalidate all branch-related queries
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.branches(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.log(projectId!) })
      toast.success(`Switched to branch '${branchName}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to switch branch: ${error.message}`)
    }
  })
}

/**
 * Delete branch
 */
export function useDeleteBranch(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ branchName, force }: { branchName: string; force?: boolean }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.deleteBranch(projectId, branchName, force)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.branches(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success(`Deleted branch '${variables.branchName}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete branch: ${error.message}`)
    }
  })
}

// ============================================================================
// Remote Operations Mutation Hooks  
// ============================================================================

/**
 * Git push
 */
export function useGitPush(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      remote,
      branch,
      force,
      setUpstream
    }: {
      remote?: string
      branch?: string
      force?: boolean
      setUpstream?: boolean
    }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.push(projectId, remote, branch, { force, setUpstream })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.branches(projectId!) })
      toast.success('Pushed changes successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to push: ${error.message}`)
    }
  })
}

/**
 * Git fetch
 */
export function useGitFetch(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ remote, prune }: { remote?: string; prune?: boolean }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.fetch(projectId, remote, prune)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.branches(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.remotes(projectId!) })
      toast.success('Fetched from remote successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to fetch: ${error.message}`)
    }
  })
}

/**
 * Git pull
 */
export function useGitPull(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ remote, branch, rebase }: { remote?: string; branch?: string; rebase?: boolean }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.pull(projectId, remote, branch, rebase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.project(projectId!) })
      toast.success('Pulled changes successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to pull: ${error.message}`)
    }
  })
}

// ============================================================================
// Tag Management Mutation Hooks
// ============================================================================

/**
 * Create tag
 */
export function useCreateTag(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, message, ref }: { name: string; message?: string; ref?: string }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.createTag(projectId, name, { message, ref })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.tags(projectId!) })
      toast.success(`Created tag '${variables.name}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create tag: ${error.message}`)
    }
  })
}

// ============================================================================
// Stash Management Mutation Hooks
// ============================================================================

/**
 * Git stash
 */
export function useGitStash(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (message?: string) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.stash(projectId, message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.stash(projectId!) })
      toast.success('Changes stashed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to stash changes: ${error.message}`)
    }
  })
}

/**
 * Git stash apply
 */
export function useGitStashApply(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ref?: string) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.stashApply(projectId, ref)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      toast.success('Stash applied successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply stash: ${error.message}`)
    }
  })
}

/**
 * Git stash pop
 */
export function useGitStashPop(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ref?: string) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.stashPop(projectId, ref)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.status(projectId!) })
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.stash(projectId!) })
      toast.success('Stash popped successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to pop stash: ${error.message}`)
    }
  })
}

/**
 * Git stash drop
 */
export function useGitStashDrop(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ref?: string) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.stashDrop(projectId, ref)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.stash(projectId!) })
      toast.success('Stash dropped successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to drop stash: ${error.message}`)
    }
  })
}

// ============================================================================
// Reset Operations Hooks
// ============================================================================

/**
 * Git reset
 */
export function useGitReset(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ref, mode }: { ref: string; mode?: 'soft' | 'mixed' | 'hard' }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.reset(projectId, ref, mode)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.project(projectId!) })
      toast.success('Reset completed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset: ${error.message}`)
    }
  })
}

// ============================================================================
// Worktree Mutation Hooks
// ============================================================================

/**
 * Add worktree
 */
export function useAddGitWorktree(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      path: string
      branch?: string
      newBranch?: string
      commitish?: string
      detach?: boolean
    }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.worktrees.add(projectId, params)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.worktrees(projectId!) })
      toast.success('Worktree created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create worktree: ${error.message}`)
    }
  })
}

/**
 * Remove worktree
 */
export function useRemoveGitWorktree(projectId: number | undefined) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ path, force }: { path: string; force?: boolean }) => {
      if (!projectId) throw new Error('Project ID is required')
      if (!client) throw new Error('API client not initialized')
      return client.git.worktrees.remove(projectId, { path, force })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GIT_ENHANCED_KEYS.worktrees(projectId!) })
      toast.success('Worktree removed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove worktree: ${error.message}`)
    }
  })
}

// ============================================================================
// Invalidation Utilities
// ============================================================================

export function useInvalidateGit() {
  const queryClient = useQueryClient()
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: GIT_KEYS.all }),
    invalidateProject: (projectId: number) => queryClient.invalidateQueries({ queryKey: GIT_KEYS.project(projectId) }),
    invalidateStatus: (projectId: number) => queryClient.invalidateQueries({ queryKey: GIT_KEYS.status(projectId) }),
    invalidateBranches: (projectId: number) => queryClient.invalidateQueries({ queryKey: GIT_KEYS.branches(projectId) }),
    invalidateWorktrees: (projectId: number) => queryClient.invalidateQueries({ queryKey: GIT_KEYS.worktrees(projectId) })
  }
}

// ============================================================================
// Type Exports
// ============================================================================

// Types are exported inline where defined

// Alias for backward compatibility
export const GIT_ENHANCED_KEYS = GIT_KEYS