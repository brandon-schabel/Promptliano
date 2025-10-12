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

import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './api/use-api-client'
import { toast } from 'sonner'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { PROJECT_ENHANCED_KEYS, PROMPT_ENHANCED_KEYS, invalidateWithRelationships } from './generated/query-keys'
import { POLLING_CONFIG } from '@/lib/constants'
import type {
  OptimizePromptRequest,
  MarkdownImportRequest,
  MarkdownExportRequest,
  BatchExportRequest,
  MarkdownContentValidation,
  ProjectFile,
  Prompt
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

// Removed: project summary hook

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
      // Send both keys for compatibility with server variants
      const response = await client.projects.suggestFiles(projectId, { prompt, userInput: prompt, limit } as any)

      // New shape: { success, data: { suggestedFiles: [{ path, relevance, reason, fileType }], ... } }
      if (response?.data?.suggestedFiles && Array.isArray(response.data.suggestedFiles)) {
        const suggested = response.data.suggestedFiles as Array<{
          path: string
          relevance?: number
          reason?: string
          fileType?: string
        }>
        // Fetch project files and map by path
        const allFilesRes = await client.projects.getProjectFiles(projectId)
        const allFiles = (allFilesRes?.data || allFilesRes || []) as any[]
        const byPath = new Map(allFiles.map((f: any) => [String(f.path), f]))
        const files = suggested
          .map((s) => {
            const base = byPath.get(s.path)
            if (!base) return null
            // Attach metadata for UI display (non-breaking extra fields)
            return {
              ...base,
              suggestionRelevance: s.relevance,
              suggestionReason: s.reason,
              suggestionFileType: s.fileType
            }
          })
          .filter(Boolean)
        return files
      }

      // Old shape: { success, data: File[] } or just File[]
      return response?.data || response
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suggest files')
    }
  })
}

/**
 * Advanced Prompt Operations
 */

export type SuggestPromptsScoreDebug = {
  promptId: string
  totalScore: number
  titleScore?: number
  contentScore?: number
  tagScore?: number
  recencyScore?: number
  usageScore?: number
  aiConfidence?: number
  aiReasons?: string[]
}

export type SuggestPromptsHookResult = {
  prompts: Array<Prompt | number | string>
  debug?: {
    scores?: SuggestPromptsScoreDebug[]
    metadata?: Record<string, unknown>
  }
}

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
      limit = 5,
      includeScores = false
    }: {
      projectId: number
      userInput: string
      limit?: number
      includeScores?: boolean
    }): Promise<SuggestPromptsHookResult> => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.suggestPrompts(projectId, { userInput, limit, includeScores })

      const primaryPayload = (response as any)?.data ?? response

      if (primaryPayload && typeof primaryPayload === 'object') {
        if (Array.isArray((primaryPayload as any).prompts)) {
          return {
            prompts: (primaryPayload as any).prompts,
            debug: (primaryPayload as any).debug
          }
        }

        if ((primaryPayload as any).data && Array.isArray((primaryPayload as any).data?.prompts)) {
          return {
            prompts: (primaryPayload as any).data.prompts,
            debug: (primaryPayload as any).data?.debug ?? (primaryPayload as any).debug
          }
        }
      }

      if (Array.isArray(primaryPayload)) {
        return {
          prompts: primaryPayload
        }
      }

      return {
        prompts: []
      }
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

/**
 * Mermaid Diagram Operations
 * AI-powered mermaid diagram fixing and optimization
 */

export function useFixMermaidDiagram() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      mermaidCode,
      error,
      userIntent,
      options
    }: {
      mermaidCode: string
      error?: string
      userIntent?: string
      options?: any
    }) => {
      if (!client) throw new Error('API client not initialized')

      // Call the AI mermaid fix endpoint
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/ai/mermaid/fix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mermaidCode,
          error,
          userIntent,
          options
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fix mermaid diagram')
      }

      const result = await response.json()
      return result.data // { fixedCode, explanation, diagramType }
    },
    onSuccess: (data) => {
      if (data.explanation) {
        toast.success(`Fixed: ${data.explanation}`)
      } else {
        toast.success('Diagram fixed successfully')
      }
    },
    onError: (error: any) => {
      console.error('Failed to fix mermaid diagram:', error)
      toast.error(error.message || 'Failed to fix mermaid diagram')
    }
  })
}

// ============================================================================
// DEEP RESEARCH HOOKS - Comprehensive research automation
// ============================================================================

/**
 * Deep Research Operations
 * AI-powered research automation with document generation
 */

// Query keys for Deep Research
export const RESEARCH_KEYS = {
  all: ['research'] as const,
  lists: () => [...RESEARCH_KEYS.all, 'list'] as const,
  list: (filters?: any) => [...RESEARCH_KEYS.all, 'list', filters] as const,
  detail: (id: number) => [...RESEARCH_KEYS.all, 'detail', id] as const,
  sources: (id: number) => [...RESEARCH_KEYS.all, 'sources', id] as const,
  sections: (id: number) => [...RESEARCH_KEYS.all, 'sections', id] as const,
  progress: (id: number) => [...RESEARCH_KEYS.all, 'progress', id] as const,
  crawlProgress: (id: number) => [...RESEARCH_KEYS.all, 'crawl-progress', id] as const
}

export function useResearchRecords() {
  const client = useApiClient()

  return useQuery({
    queryKey: RESEARCH_KEYS.lists(),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch research records')
      const result = await response.json()
      return result?.data || []
    },
    staleTime: 30 * 1000 // Research data is volatile
  })
}

export function useResearchRecord(id: number | undefined) {
  const client = useApiClient()

  return useQuery({
    queryKey: RESEARCH_KEYS.detail(id!),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${id}`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch research record')
      const result = await response.json()
      return result
    },
    enabled: !!id && id > 0,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useCreateResearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      projectId?: number
      topic: string
      description?: string
      maxSources?: number
      strategy?: 'fast' | 'balanced' | 'thorough'
    }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to create research')
      const result = await response.json()
      return result?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.all })
      toast.success('Research session created')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create research')
    }
  })
}

export function useStartResearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      projectId?: number
      topic: string
      description?: string
      maxSources?: number
      strategy?: 'fast' | 'balanced' | 'thorough'
      searchQueries?: string[]
      modelConfig?: {
        provider?: string
        model?: string
        temperature?: number
        maxTokens?: number
      }
      // Crawl mode options
      enableCrawling?: boolean
      crawlSeedUrl?: string
      crawlMaxDepth?: number
      crawlMaxPages?: number
      crawlRelevanceThreshold?: number
    }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to start research')
      const result = await response.json()
      return result?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.all })
      toast.success('Research session started')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start research')
    }
  })
}

export function useUpdateResearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { topic?: string; description?: string; status?: string } }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to update research')
      const result = await response.json()
      return result?.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.detail(id) })
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.lists() })
      toast.success('Research updated')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update research')
    }
  })
}

export function useDeleteResearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to delete research')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.all })
      toast.success('Research deleted')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete research')
    }
  })
}

export function useResearchSources(researchId: number | undefined) {
  return useQuery({
    queryKey: RESEARCH_KEYS.sources(researchId!),
    queryFn: async () => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/sources`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch sources')
      const result = await response.json()
      return result
    },
    enabled: !!researchId && researchId > 0,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useAddSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ researchId, url, sourceType }: { researchId: number; url: string; sourceType?: string }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, sourceType }),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to add source')
      const result = await response.json()
      return result?.data
    },
    onSuccess: (_, { researchId }) => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.sources(researchId) })
      toast.success('Source added')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add source')
    }
  })
}

export function useProcessSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sourceId: number) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/sources/${sourceId}/process`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to process source')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.all })
      toast.success('Source processing started')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process source')
    }
  })
}

export function useSourceProcessedData(sourceId: number | undefined) {
  return useQuery({
    queryKey: [...RESEARCH_KEYS.all, 'source-processed-data', sourceId],
    queryFn: async () => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/sources/${sourceId}/processed-data`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch processed data')
      const result = await response.json()
      return result
    },
    enabled: !!sourceId && sourceId > 0,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useResearchSections(researchId: number | undefined) {
  return useQuery({
    queryKey: RESEARCH_KEYS.sections(researchId!),
    queryFn: async () => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/sections`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch sections')
      const result = await response.json()
      return result
    },
    enabled: !!researchId && researchId > 0,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useGenerateOutline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ researchId, sectionsCount, depth }: { researchId: number; sectionsCount?: number; depth?: number }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionsCount, depth }),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to generate outline')
      const result = await response.json()
      return result?.data
    },
    onSuccess: (_, { researchId }) => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.sections(researchId) })
      toast.success('Outline generated')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate outline')
    }
  })
}

export function useBuildSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sectionId, userContext }: { sectionId: number; userContext?: string }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/sections/${sectionId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, userContext }),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to build section')
      const result = await response.json()
      return result?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.all })
      toast.success('Section built')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to build section')
    }
  })
}

export function useUpdateSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sectionId, data }: { sectionId: number; data: any }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to update section')
      const result = await response.json()
      return result?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.all })
      toast.success('Section updated')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update section')
    }
  })
}

// Enhanced progress hook with intelligent polling
export function useResearchProgress(researchId: number | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: RESEARCH_KEYS.progress(researchId!),
    queryFn: async () => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/progress`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch progress')
      const result = await response.json()
      return result
    },
    enabled: !!researchId && researchId > 0 && (options?.enabled !== false),
    refetchInterval: (query) => {
      // Stop polling when research reaches terminal status
      const data = query.state.data as any
      if (!data?.data) return false
      const status = data.data.status
      return ['complete', 'failed'].includes(status) ? false : 4000 // 4 seconds
    },
    staleTime: 2000, // Consider data stale after 2 seconds
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
  })
}

/**
 * Execute workflow for a research session
 */
export function useExecuteWorkflow() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      researchId,
      options
    }: {
      researchId: number
      options?: { skipGathering?: boolean; skipProcessing?: boolean; skipBuilding?: boolean }
    }) => {
      if (!client) throw new Error('API client not initialized')
      return await client.typeSafeClient.createResearchByIdExecute(researchId, { options: options || {} })
    },
    onSuccess: (_, variables) => {
      // Invalidate research and progress queries
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.detail(variables.researchId) })
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.progress(variables.researchId) })
      queryClient.invalidateQueries({ queryKey: ['workflow-status', variables.researchId] })
      toast.success('Workflow execution started')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to execute workflow')
    }
  })
}

/**
 * Resume failed/stopped workflow
 */
export function useResumeWorkflow() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (researchId: number) => {
      if (!client) throw new Error('API client not initialized')
      return await client.typeSafeClient.createResearchByIdResume(researchId)
    },
    onSuccess: (_, researchId) => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.detail(researchId) })
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.progress(researchId) })
      queryClient.invalidateQueries({ queryKey: ['workflow-status', researchId] })
      toast.success('Workflow resumed')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resume workflow')
    }
  })
}

/**
 * Stop automatic workflow execution
 */
export function useStopWorkflow() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (researchId: number) => {
      if (!client) throw new Error('API client not initialized')
      return await client.typeSafeClient.createResearchByIdStop(researchId)
    },
    onSuccess: (_, researchId) => {
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.detail(researchId) })
      queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.progress(researchId) })
      queryClient.invalidateQueries({ queryKey: ['workflow-status', researchId] })
      toast.success('Workflow stopped')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to stop workflow')
    }
  })
}

/**
 * Get detailed workflow status with action availability
 */
export function useWorkflowStatus(researchId: number | undefined) {
  const client = useApiClient()

  return useQuery({
    queryKey: ['workflow-status', researchId],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return await client.typeSafeClient.getResearchByIdWorkflowStatus(researchId!)
    },
    enabled: !!researchId && researchId > 0,
    refetchInterval: (query) => {
      // Auto-refresh every 5 seconds while workflow is active
      const data = query.state.data as any
      const status = data?.data?.status
      if (['gathering', 'processing', 'building'].includes(status || '')) {
        return 5000
      }
      return false
    },
    staleTime: 2000 // Consider data stale after 2 seconds
  })
}

export function useExportDocument() {
  return useMutation({
    mutationFn: async ({ researchId, format, includeToc, includeReferences }: {
      researchId: number
      format: 'markdown' | 'pdf' | 'html' | 'docx'
      includeToc?: boolean
      includeReferences?: boolean
    }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, includeToc, includeReferences }),
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to export document')
      const result = await response.json()

      // Download the exported content
      if (result?.data?.content) {
        const blob = new Blob([result.data.content], {
          type: format === 'markdown' ? 'text/markdown' : 'application/octet-stream'
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.data.filename || `research-export.${format}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      return result?.data
    },
    onSuccess: () => {
      toast.success('Document exported successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export document')
    }
  })
}

/**
 * Get crawl progress for a research session with web crawling enabled
 * Polls every 3 seconds while crawling is active
 */
export function useCrawlProgress(researchId: number | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: RESEARCH_KEYS.crawlProgress(researchId!),
    queryFn: async () => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/${researchId}/crawl-progress`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch crawl progress')
      const result = await response.json()
      return result
    },
    enabled: !!researchId && researchId > 0 && (options?.enabled !== false),
    refetchInterval: (query) => {
      // Poll every 3 seconds if crawling is active
      const data = query.state.data as any
      if (!data?.data?.crawlEnabled) return false

      // Stop polling if we have reached max pages or no pending URLs
      const progress = data.data.progress
      const config = data.data.config
      if (!progress || !config) return false

      const reachedMaxPages = progress.urlsCrawled >= config.maxPages
      const noPendingUrls = progress.urlsPending === 0

      return (reachedMaxPages || noPendingUrls) ? false : 3000 // 3 seconds
    },
    staleTime: 2000, // Consider data stale after 2 seconds
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
  })
}

/**
 * Source Dashboard Operations
 * Real-time monitoring of individual source crawling and processing
 */

// Query keys for Source Dashboard
export const SOURCE_KEYS = {
  all: ['sources'] as const,
  dashboard: (sourceId: number) => [...SOURCE_KEYS.all, 'dashboard', sourceId] as const,
  linksRoot: (sourceId: number) => [...SOURCE_KEYS.all, 'links', sourceId] as const,
  links: (sourceId: number, params?: any) => [...SOURCE_KEYS.all, 'links', sourceId, params] as const
}

/**
 * Start or recrawl a specific source
 */
export function useStartSourceCrawl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sourceId,
      researchId,
      options
    }: {
      sourceId: number
      researchId?: number
      options?: {
        depthOverride?: number
        maxPagesOverride?: number
        maxLinks?: number
        recrawl?: boolean
        sameDomainOnly?: boolean
      }
    }) => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/sources/${sourceId}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options ?? {}),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to start crawl')
      }

      const result = await response.json().catch(() => ({}))
      return result?.data ?? result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: SOURCE_KEYS.dashboard(variables.sourceId) })
      queryClient.invalidateQueries({ queryKey: SOURCE_KEYS.linksRoot(variables.sourceId), exact: false })

      if (variables.researchId) {
        queryClient.invalidateQueries({ queryKey: RESEARCH_KEYS.sources(variables.researchId), exact: false })
      }

      toast.success('Crawl started')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start crawl')
    }
  })
}

/**
 * Get comprehensive dashboard data for a specific source
 * Includes crawl status, metadata, statistics, and real-time progress
 * With smart exponential backoff on errors
 */
export function useSourceDashboard(
  sourceId: number | undefined,
  options?: {
    refetchInterval?: number | ((data: any) => number | false)
    enabled?: boolean
  }
) {
  const errorCountRef = React.useRef(0)
  const lastSuccessRef = React.useRef(Date.now())

  return useQuery({
    queryKey: SOURCE_KEYS.dashboard(sourceId!),
    queryFn: async () => {
      const response = await fetch(`${SERVER_HTTP_ENDPOINT}/api/research/sources/${sourceId}/dashboard`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch source dashboard')
      const result = await response.json()

      // Reset error count on success
      errorCountRef.current = 0
      lastSuccessRef.current = Date.now()

      return result
    },
    enabled: !!sourceId && sourceId > 0 && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? ((query) => {
      const data = query.state.data as any
      const status = data?.data?.crawlStatus?.status
      const isActive = status === 'active' || status === 'queued'

      if (!isActive) return false

      // Handle errors with exponential backoff
      if (query.state.error) {
        errorCountRef.current++
        if (errorCountRef.current >= POLLING_CONFIG.MAX_RETRIES) {
          console.warn('Max polling retries reached, stopping polling')
          return false
        }

        const backoff = Math.min(
          POLLING_CONFIG.BASE_INTERVAL_MS * Math.pow(POLLING_CONFIG.ERROR_BACKOFF_MULTIPLIER, errorCountRef.current - 1),
          POLLING_CONFIG.MAX_INTERVAL_MS
        )
        const jitter = Math.random() * POLLING_CONFIG.JITTER_MS
        return Math.max(backoff + jitter, POLLING_CONFIG.MIN_INTERVAL_MS)
      }

      return POLLING_CONFIG.BASE_INTERVAL_MS
    }),
    staleTime: 2000, // Consider data stale after 2 seconds
    gcTime: 10 * 60 * 1000 // Cache for 10 minutes
  })
}

/**
 * Get paginated links discovered from a source with filtering and sorting
 */
export function useSourceLinks(
  sourceId: number | undefined,
  params?: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    status?: string
    minDepth?: number
    maxDepth?: number
    search?: string
    from?: string
    to?: string
  }
) {
  return useQuery({
    queryKey: SOURCE_KEYS.links(sourceId!, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)
      if (params?.status) searchParams.set('status', params.status)
      if (params?.minDepth !== undefined) searchParams.set('minDepth', params.minDepth.toString())
      if (params?.maxDepth !== undefined) searchParams.set('maxDepth', params.maxDepth.toString())
      if (params?.search) searchParams.set('search', params.search)
      if (params?.from) searchParams.set('from', params.from)
      if (params?.to) searchParams.set('to', params.to)

      const response = await fetch(
        `${SERVER_HTTP_ENDPOINT}/api/research/sources/${sourceId}/links?${searchParams.toString()}`,
        {
          credentials: 'include'
        }
      )
      if (!response.ok) throw new Error('Failed to fetch source links')
      const result = await response.json()
      return result
    },
    enabled: !!sourceId && sourceId > 0,
    staleTime: 30 * 1000, // Links data is fairly stable, 30 seconds
    gcTime: 10 * 60 * 1000
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
