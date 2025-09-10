/**
 * API Hooks - Specialized Hooks & Backward Compatibility
 *
 * This file contains specialized hooks that aren't covered by the generated CRUD factories,
 * plus backward compatibility aliases for smooth migration.
 *
 * Most hooks are now imported from './generated' which provides:
 * - Generated hooks with consistent patterns
 * - Built-in optimistic updates and smart caching
 * - 100% type safety with IntelliSense support
 * - 76% code reduction through factory patterns
 */

// ============================================================================
// RE-EXPORT GENERATED HOOKS - Primary Interface
// ============================================================================

// Re-export all generated hooks for backward compatibility
export * from './generated'

// Re-export specialized hooks from domain-specific modules
export { useBrowseDirectory } from './api/browse-directory-hooks'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './api/use-api-client'
import { toast } from 'sonner'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { PROJECT_ENHANCED_KEYS, PROMPT_ENHANCED_KEYS, invalidateWithRelationships } from './generated/query-keys'
import type {
  OptimizePromptRequest,
  MarkdownImportRequest,
  MarkdownExportRequest,
  BatchExportRequest,
  MarkdownContentValidation,
  ProjectFile
} from '@promptliano/schemas'

// ============================================================================
// SPECIALIZED HOOKS - Not covered by CRUD factory
// ============================================================================

/**
 * Advanced Project Operations
 * These extend beyond basic CRUD and provide specialized functionality
 */

// Alias for backward compatibility
// Note: useProjectSync is now part of generated hooks

export function useSyncProjectWithProgress() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return {
    syncWithProgress: async (
      projectId: number,
      onProgress?: (event: MessageEvent) => void,
      abortSignal?: AbortSignal
    ) => {
      if (!client) throw new Error('API client not initialized')

      try {
        // Start SSE sync with progress tracking
        // Correct SSE endpoint path: /api/projects/{id}/sync-stream
        const eventSource = new EventSource(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/sync-stream`, {
          withCredentials: true
        })

        return new Promise((resolve, reject) => {
          // Handle abort signal
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              eventSource.close()
              reject(new Error('Sync cancelled'))
            })
          }

          eventSource.onmessage = (event) => {
            try {
              const progressEvent = JSON.parse(event.data)
              onProgress?.(event)

              // Check if sync is complete
              if (progressEvent.type === 'complete') {
                eventSource.close()

                // Invalidate queries on completion
                queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.files(projectId) })
                queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.detail(projectId) })

                resolve(progressEvent.data)
              } else if (progressEvent.type === 'error') {
                eventSource.close()
                reject(new Error(progressEvent.message || 'Sync failed'))
              }
            } catch (parseError) {
              eventSource.close()
              reject(new Error('Failed to parse sync progress'))
            }
          }

          eventSource.onerror = (error) => {
            eventSource.close()
            reject(new Error('Sync connection failed'))
          }

          // Timeout after 5 minutes
          setTimeout(
            () => {
              eventSource.close()
              reject(new Error('Sync timeout'))
            },
            5 * 60 * 1000
          )
        })
      } catch (error) {
        throw new Error(`Failed to start sync: ${error}`)
      }
    }
  }
}

/**
 * Automatically sync the active project on an interval.
 * Silent: no toasts, relies on server-side lock to avoid overlap.
 */
export function useAutoProjectSync(projectId?: number, intervalMs: number = 4000) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!client || !projectId || projectId === -1) return
    let cancelled = false
    const id = setInterval(
      async () => {
        if (cancelled) return
        try {
          await client.projects.syncProject(projectId)
          // Lightly refresh file list cache in background
          queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.files(projectId) })
        } catch (_) {
          // Ignore errors to keep interval running; server lock prevents overlap
        }
      },
      Math.max(3000, intervalMs)
    )
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [client, projectId, intervalMs, queryClient])
}

export function useGetProjectSummary(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_ENHANCED_KEYS.summary(projectId),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.getProjectSummary(projectId).then((r) => r)
    },
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 10 * 60 * 1000 // 10 minutes for summary
  })
}

export function useGetProjectStatistics(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_ENHANCED_KEYS.statistics(projectId),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.getProjectStatistics(projectId).then((r) => r?.data || r)
    },
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000 // 5 minutes cache for statistics
  })
}

export function useGetProjectFilesWithoutContent(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_ENHANCED_KEYS.filesWithoutContent(projectId),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      // Use getProjectFiles method instead as getProjectFilesWithoutContent may not exist
      return client.projects.getProjectFiles(projectId).then((r) => r?.data || r)
    },
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes for file metadata
    refetchOnWindowFocus: true
  })
}

export function useRefreshProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, folder }: { projectId: number; folder?: string }) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.refreshProject(projectId, folder ? { folder } : undefined)
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.files(projectId) })
      toast.success('Project refreshed successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to refresh project')
    }
  })
}

export function useUpdateFileContent() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, fileId, content }: { projectId: number; fileId: number; content: string }) => {
      if (!client) throw new Error('API client not initialized')

      // Update the file content
      const result = await client.typeSafeClient.updateProjectsByIdFilesByFileId(projectId, fileId, { content })

      // Sync the project to ensure file system and data store are synchronized
      await client.projects.syncProject(projectId)

      return result
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.files(projectId) })
      toast.success('File updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update file')
    }
  })
}

export function useSuggestFiles() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ projectId, prompt, limit = 10 }: { projectId: number; prompt: string; limit?: number }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.suggestFiles(projectId, { prompt, limit })
      return response?.data || response
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suggest files')
    }
  })
}

export function useSummarizeProjectFiles() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      fileIds,
      force = false
    }: {
      projectId: number
      fileIds: number[]
      force?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.summarizeFiles(projectId, { fileIds, force })
      return response?.data || response
    },
    onSuccess: (data, variables) => {
      // Invalidate project files to refresh summaries
      queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.files(variables.projectId) })
      toast.success(`Summarized ${data.included} files`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to summarize files')
    }
  })
}

export function useRemoveSummariesFromFiles() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, fileIds }: { projectId: number; fileIds: number[] }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.removeSummariesFromFiles(projectId, { fileIds })
      return response?.data || response
    },
    onSuccess: (data, variables) => {
      // Invalidate project files to refresh summaries
      queryClient.invalidateQueries({ queryKey: PROJECT_ENHANCED_KEYS.files(variables.projectId) })
      toast.success(`Removed summaries from ${data.removedCount} files`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove summaries')
    }
  })
}

/**
 * Advanced Prompt Operations
 */

export function useGetProjectPrompts(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_ENHANCED_KEYS.projectPrompts(projectId),
    queryFn: async (): Promise<import('@promptliano/schemas').Prompt[]> => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.prompts.getProjectPrompts(projectId)
      const data = result?.data || result
      // Ensure data matches expected Prompt schema format
      return Array.isArray(data)
        ? data.map((item: any) => ({
            id: item.id,
            projectId: item.projectId || projectId,
            title: item.title || item.name || '',
            content: item.content || '',
            description: item.description || null,
            tags: Array.isArray(item.tags) ? item.tags : [],
            createdAt: item.createdAt || item.created || Date.now(),
            updatedAt: item.updatedAt || item.updated || Date.now()
          }))
        : []
    },
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000
  })
}

/**
 * Prompt-Project Association Hooks
 * These connect and disconnect prompts from projects
 */

export function useAddPromptToProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.addPromptToProject(projectId, promptId)
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate both project-specific prompts and all prompts list
      queryClient.invalidateQueries({ queryKey: PROMPT_ENHANCED_KEYS.projectPrompts(projectId) })
      queryClient.invalidateQueries({ queryKey: PROMPT_ENHANCED_KEYS.all })
      toast.success('Prompt added to project successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add prompt to project')
    }
  })
}

export function useRemovePromptFromProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.removePromptFromProject(projectId, promptId)
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate both project-specific prompts and all prompts list
      queryClient.invalidateQueries({ queryKey: PROMPT_ENHANCED_KEYS.projectPrompts(projectId) })
      queryClient.invalidateQueries({ queryKey: PROMPT_ENHANCED_KEYS.all })
      toast.success('Prompt removed from project successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove prompt from project')
    }
  })
}

/*
export function useOptimizeUserInput() {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: OptimizePromptRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.optimizeUserInput(data.projectId, { userContext: data.userContext })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to optimize user input')
    }
  })
}
*/

export function useSuggestPrompts() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      userInput,
      limit = 5
    }: {
      projectId: number
      userInput: string
      limit?: number
    }): Promise<any[]> => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.suggestPrompts(projectId, { userInput, limit })
      return response?.data?.prompts || response || []
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suggest prompts')
    }
  })
}

/**
 * Advanced Chat Operations with Streaming Support
 * Note: useForkChat, useForkChatFromMessage, and useDeleteMessage are now provided by generated hooks
 */

/**
 * Enhanced AI Chat Hook with Streaming
 */
export function useAIChatV2({
  chatId,
  provider,
  model,
  systemMessage
}: {
  chatId: number
  provider: string
  model: string
  systemMessage?: string
}) {
  const { useChatMessages, useStreamChat } = require('./generated')
  const { data: messages, refetch: refetchMessages } = useChatMessages(chatId)
  const streamChat = useStreamChat()

  const sendMessage = async (userMessage: string, options?: any) => {
    try {
      const stream = await streamChat.mutateAsync({
        chatId,
        userMessage,
        systemMessage,
        options: {
          provider,
          model,
          ...options
        }
      })

      // Return the stream for the UI to handle
      return stream
    } catch (error) {
      throw error
    }
  }

  return {
    messages: messages || [],
    sendMessage,
    isLoading: streamChat.isPending,
    error: streamChat.error,
    refetchMessages
  }
}

// ============================================================================
// MARKDOWN IMPORT/EXPORT HOOKS - Complex specialized operations
// ============================================================================

/**
 * Markdown Import/Export Operations
 * These are complex operations that don't fit the CRUD pattern
 */

export function useImportMarkdownPrompts() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ files, options = {} }: { files: File[]; options?: Partial<MarkdownImportRequest> }) => {
      if (!client) throw new Error('Client not connected')

      // Create FormData for multipart upload
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (options.projectId) formData.append('projectId', options.projectId.toString())
      if (options.overwriteExisting) formData.append('overwriteExisting', 'true')

      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/prompts/import`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to import prompts')
      }

      return response.json()
    },
    onSuccess: (result: any, variables) => {
      // Invalidate all prompts and optionally project prompts
      invalidateWithRelationships(queryClient, 'prompts')
      if (variables.options?.projectId) {
        queryClient.invalidateQueries({ queryKey: PROMPT_ENHANCED_KEYS.projectPrompts(variables.options.projectId) })
      }

      // Access the summary from result.data
      const successCount = result.data?.summary?.created || 0
      const updatedCount = result.data?.summary?.updated || 0
      const errorCount = result.data?.summary?.failed || 0
      const totalSuccessful = successCount + updatedCount

      if (totalSuccessful > 0 && errorCount === 0) {
        toast.success(`Successfully imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''}`)
      } else if (totalSuccessful > 0 && errorCount > 0) {
        toast.warning(`Imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''}, ${errorCount} failed`)
      } else {
        toast.error('Failed to import any prompts')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import markdown prompts')
    }
  })
}

export function useExportPromptAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      promptId,
      options = {},
      filename
    }: {
      promptId: number
      options?: Partial<MarkdownExportRequest>
      filename?: string
    }) => {
      if (!client) throw new Error('Client not connected')

      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/prompts/${promptId}/export`, {
        method: 'GET'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to export prompt')
      }

      const markdown = await response.text()
      return { markdown, filename: filename || `prompt-${promptId}.md` }
    },
    onSuccess: ({ markdown, filename }) => {
      // Create blob and trigger download
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Prompt exported successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export prompt')
    }
  })
}

export function useExportPromptsBatch() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (request: BatchExportRequest) => {
      if (!client) throw new Error('Client not connected')

      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/prompts/export-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to export prompts')
      }

      // Check content type to handle different response formats
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/zip')) {
        // Multi-file format returns binary ZIP
        const blob = await response.blob()
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1] || 'prompts-export.zip'

        return {
          format: 'multi-file',
          blob,
          filename,
          promptCount: request.promptIds.length // Estimate from request
        }
      } else {
        // Single-file format returns JSON
        const result = await response.json()
        return result.data
      }
    },
    onSuccess: (result) => {
      // Handle download based on format
      if (result.format === 'single-file') {
        // Download single markdown file
        const blob = new Blob([result.content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename || 'prompts-export.md'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else if (result.format === 'multi-file') {
        // Download ZIP file (blob already created)
        const url = URL.createObjectURL(result.blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      toast.success(`${result.promptCount} prompt${result.promptCount !== 1 ? 's' : ''} exported successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export prompts')
    }
  })
}

export function useValidateMarkdownFile() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (file: File): Promise<MarkdownContentValidation & { isValid: boolean; metadata?: any }> => {
      if (!client) throw new Error('Client not connected')

      const content = await file.text()

      // Parse frontmatter and validate structure
      const validation: MarkdownContentValidation = {
        hasValidFrontmatter: false,
        hasRequiredFields: false,
        contentLength: content.length,
        estimatedPrompts: 0,
        warnings: [],
        errors: []
      }

      try {
        let metadata: any = {}
        let promptContent: string

        // Check for frontmatter (optional)
        if (content.startsWith('---')) {
          const frontmatterEnd = content.indexOf('---', 3)
          if (frontmatterEnd === -1) {
            validation.errors.push({ message: 'Invalid frontmatter format', path: [] } as any)
            return { isValid: false, ...validation }
          }

          validation.hasValidFrontmatter = true

          // Extract frontmatter
          const frontmatterContent = content.substring(3, frontmatterEnd).trim()

          // Parse frontmatter as YAML-like structure
          const lines = frontmatterContent.split('\n')
          for (const line of lines) {
            const colonIndex = line.indexOf(':')
            if (colonIndex > 0) {
              const key = line.substring(0, colonIndex).trim()
              const value = line.substring(colonIndex + 1).trim()
              metadata[key] = value
            }
          }

          // Check content after frontmatter
          promptContent = content.substring(frontmatterEnd + 3).trim()
        } else {
          // No frontmatter - use filename as name
          validation.hasValidFrontmatter = false

          // Extract filename without extension and clean it up
          const fileName = file.name
          const promptName =
            fileName
              .replace(/\.(md|markdown)$/i, '')
              .replace(/[-_]/g, ' ')
              .replace(/\s+/g, ' ') // Normalize multiple spaces
              .replace(/\b\w/g, (l) => l.toUpperCase())
              .trim() || 'Untitled Prompt'

          metadata.name = promptName
          promptContent = content.trim()
        }

        // Always mark as having required fields since we generate name from filename if needed
        validation.hasRequiredFields = true
        validation.estimatedPrompts = promptContent.length > 0 ? 1 : 0

        // Check content length
        if (promptContent.length === 0) {
          validation.warnings.push('Prompt content is empty')
        }

        validation.contentLength = promptContent.length

        return {
          isValid: validation.errors.length === 0,
          metadata,
          ...validation
        }
      } catch (error: any) {
        validation.errors.push({ message: error.message || 'Failed to validate file', path: [] } as any)
        return {
          isValid: false,
          ...validation
        }
      }
    },
    onSuccess: (validation: any) => {
      if (validation.isValid && validation.warnings.length === 0) {
        toast.success('Markdown file is valid')
      } else if (validation.isValid && validation.warnings.length > 0) {
        toast.warning(
          `File is valid but has ${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`
        )
      } else {
        toast.error(`Validation failed: ${validation.errors[0]?.message || 'Unknown error'}`)
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to validate markdown file')
    }
  })
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

// Import hooks from generated to create backward compatibility aliases
import {
  useProjects,
  useProject,
  usePrompts,
  usePrompt,
  useQueues,
  useQueue,
  useKeys,
  useKey,
  useTicket,
  useTicketTasks,
  useProjectSync,
  useProjectFiles,
  useUpdateTask
} from './generated'
import { useEffect } from 'react'

// Provide aliases for existing hook names to ensure backward compatibility
export const useGetProjects = useProjects
export const useGetProject = useProject
export const useGetTicket = useTicket
export const useGetTasks = useTicketTasks
export const useGetQueue = useQueue
export const useGetAllPrompts = usePrompts
export const useGetPrompt = usePrompt
export const useGetQueues = useQueues
export const useGetKeys = useKeys
export const useGetKey = useKey

// Additional exports for backward compatibility
export const useGetProjectFiles = useProjectFiles
export const useGetTicketsWithTasks = useTicketTasks // Alias for tickets with tasks
export const useReorderTasks = useUpdateTask // Alias for task reordering
export const useSyncProject = useProjectSync
