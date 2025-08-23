import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  useInfiniteQuery, 
  useQueries 
} from '@tanstack/react-query'
import type {
  ClaudeSession,
  ClaudeSessionMetadata,
  ClaudeMessage,
  ClaudeProjectData,
  ClaudeSessionQuerySchema,
  ClaudeMessageQuerySchema,
  ClaudeSessionCursorSchema,
  ClaudeSessionsPaginatedResponseSchema
} from '@promptliano/schemas'
import { z } from 'zod'
import { useApiClient } from './use-api-client'
import { toast } from 'sonner'
import { useCallback, useEffect, useRef, useMemo } from 'react'

// Query keys with proper hierarchy for optimal caching
export const CLAUDE_CODE_KEYS = {
  all: ['claude-code'] as const,
  sessions: (projectId: number) => [...CLAUDE_CODE_KEYS.all, 'sessions', projectId] as const,
  sessionsWithQuery: (projectId: number, query?: z.infer<typeof ClaudeSessionQuerySchema>) =>
    [...CLAUDE_CODE_KEYS.sessions(projectId), 'legacy', query] as const,
  sessionsPaginated: (projectId: number, query?: z.infer<typeof ClaudeSessionCursorSchema>) =>
    [...CLAUDE_CODE_KEYS.sessions(projectId), 'paginated', query] as const,
  sessionsMetadata: (projectId: number, query?: z.infer<typeof ClaudeSessionCursorSchema>) =>
    [...CLAUDE_CODE_KEYS.sessions(projectId), 'metadata', query] as const,
  sessionsRecent: (projectId: number) => [...CLAUDE_CODE_KEYS.sessions(projectId), 'recent'] as const,
  sessionsInfinite: (projectId: number, query?: Omit<z.infer<typeof ClaudeSessionCursorSchema>, 'cursor'>) =>
    [...CLAUDE_CODE_KEYS.sessions(projectId), 'infinite', query] as const,
  sessionsTable: (projectId: number, tableState?: any) =>
    [...CLAUDE_CODE_KEYS.sessions(projectId), 'table', tableState] as const,
  messages: (projectId: number, sessionId: string) =>
    [...CLAUDE_CODE_KEYS.all, 'messages', projectId, sessionId] as const,
  messagesWithQuery: (projectId: number, sessionId: string, query?: z.infer<typeof ClaudeMessageQuerySchema>) =>
    [...CLAUDE_CODE_KEYS.messages(projectId, sessionId), query] as const,
  projectData: (projectId: number) => [...CLAUDE_CODE_KEYS.all, 'project-data', projectId] as const
}

// Factory for Claude Code session hooks with specialized query patterns
export function createClaudeCodeSessionHooks() {
  return {
    /**
     * Legacy hook for backward compatibility
     */
    useClaudeSessions: (
      projectId: number | undefined,
      query?: z.infer<typeof ClaudeSessionQuerySchema>,
      options?: {
        enabled?: boolean
        refetchInterval?: number | false
        staleTime?: number
      }
    ) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_CODE_KEYS.sessionsWithQuery(projectId ?? 0, query),
        queryFn: async () => {
          if (!projectId) throw new Error('Project ID is required')
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getSessions(projectId, query)
          return response.data
        },
        enabled: !!client && options?.enabled !== false && !!projectId,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
        gcTime: 10 * 60 * 1000 // 10 minutes garbage collection
      })
    },

    /**
     * Ultra-fast metadata loading for initial views
     */
    useClaudeSessionsMetadata: (
      projectId: number | undefined,
      query?: z.infer<typeof ClaudeSessionCursorSchema>,
      options?: {
        enabled?: boolean
        refetchInterval?: number | false
        staleTime?: number
      }
    ) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_CODE_KEYS.sessionsMetadata(projectId ?? 0, query),
        queryFn: async () => {
          if (!projectId) throw new Error('Project ID is required')
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getSessionsMetadata(projectId, query)
          return response
        },
        enabled: !!client && options?.enabled !== false && !!projectId,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 2 * 60 * 1000, // 2 minutes - metadata changes less frequently
        gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
        select: (data) => ({
          sessions: data.data,
          pagination: data.pagination,
          hasMore: data.pagination?.hasMore ?? false,
          nextCursor: data.pagination?.nextCursor,
          total: data.pagination?.total
        })
      })
    },

    /**
     * Recent sessions for quick access
     */
    useClaudeSessionsRecent: (
      projectId: number | undefined,
      options?: {
        enabled?: boolean
        refetchInterval?: number | false
        staleTime?: number
      }
    ) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_CODE_KEYS.sessionsRecent(projectId ?? 0),
        queryFn: async () => {
          if (!projectId) throw new Error('Project ID is required')
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getRecentSessions(projectId)
          return response.data
        },
        enabled: !!client && options?.enabled !== false && !!projectId,
        refetchInterval: options?.refetchInterval ?? 30000, // 30 seconds - recent data should be fresh
        staleTime: options?.staleTime ?? 1 * 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000 // 5 minutes garbage collection
      })
    },

    /**
     * Infinite scrolling with cursor-based pagination
     */
    useClaudeSessionsInfinite: (
      projectId: number | undefined,
      query?: Omit<z.infer<typeof ClaudeSessionCursorSchema>, 'cursor'>,
      options?: {
        enabled?: boolean
        staleTime?: number
        getNextPageParam?: (lastPage: any) => string | undefined
      }
    ) => {
      const client = useApiClient()

      return useInfiniteQuery({
        queryKey: CLAUDE_CODE_KEYS.sessionsInfinite(projectId ?? 0, query),
        queryFn: async ({ pageParam }: { pageParam?: string }) => {
          if (!projectId) throw new Error('Project ID is required')
          if (!client) throw new Error('API client not initialized')
          
          const cursorQuery: z.infer<typeof ClaudeSessionCursorSchema> = {
            sortBy: (query?.sortBy as 'lastUpdate' | 'startTime' | 'messageCount' | 'fileSize') || 'lastUpdate',
            sortOrder: (query?.sortOrder as 'asc' | 'desc') || 'desc',
            limit: query?.limit || 20,
            search: query?.search,
            branch: query?.branch,
            startDate: query?.startDate,
            endDate: query?.endDate,
            cursor: pageParam
          }
          
          const response = await client.claudeCode.getSessionsPaginated(projectId, cursorQuery)
          return response
        },
        enabled: !!client && options?.enabled !== false && !!projectId,
        staleTime: options?.staleTime ?? 3 * 60 * 1000, // 3 minutes
        gcTime: 20 * 60 * 1000, // 20 minutes for infinite data
        getNextPageParam: options?.getNextPageParam ?? ((lastPage) => {
          return lastPage.pagination?.hasMore ? lastPage.pagination.nextCursor : undefined
        }),
        initialPageParam: undefined as string | undefined,
        maxPages: 50, // Prevent memory issues with very large datasets
        select: (data) => ({
          pages: data.pages,
          pageParams: data.pageParams,
          // Flatten all sessions for easy consumption
          allSessions: data.pages.flatMap(page => page.data),
          totalLoaded: data.pages.reduce((sum, page) => sum + page.data.length, 0),
          hasNextPage: data.pages[data.pages.length - 1]?.pagination?.hasMore ?? false,
          isFetchingNextPage: false // Will be set by the hook
        })
      })
    },

    /**
     * TanStack Table optimized hook with server-side features
     */
    useClaudeSessionsTable: (
      projectId: number | undefined,
      tableOptions: {
        pagination?: {
          pageIndex: number
          pageSize: number
        }
        sorting?: Array<{
          id: string
          desc: boolean
        }>
        columnFilters?: Array<{
          id: string
          value: any
        }>
        globalFilter?: string
      },
      options?: {
        enabled?: boolean
        staleTime?: number
        placeholderData?: any
        metadata?: boolean // If true, uses metadata endpoint for faster loading
      }
    ) => {
      const client = useApiClient()
      const queryClient = useQueryClient()

      // Build optimized query from table state
      const query = useMemo((): z.infer<typeof ClaudeSessionCursorSchema> => {
        const { pagination, sorting, columnFilters, globalFilter } = tableOptions
        
        // Map table sorting to API sorting
        let sortBy: 'lastUpdate' | 'startTime' | 'messageCount' | 'fileSize' = 'lastUpdate'
        let sortOrder: 'asc' | 'desc' = 'desc'
        
        if (sorting && sorting.length > 0) {
          const sort = sorting[0]
          if (['lastUpdate', 'startTime', 'messageCount', 'fileSize'].includes(sort.id)) {
            sortBy = sort.id as 'lastUpdate' | 'startTime' | 'messageCount' | 'fileSize'
            sortOrder = sort.desc ? 'desc' : 'asc'
          }
        }
        
        // Extract filters
        const branchFilter = columnFilters?.find(f => f.id === 'gitBranch')?.value
        const dateFilters = {
          startDate: columnFilters?.find(f => f.id === 'startDate')?.value,
          endDate: columnFilters?.find(f => f.id === 'endDate')?.value
        }
        
        return {
          limit: pagination?.pageSize ?? 20,
          sortBy,
          sortOrder,
          search: globalFilter || undefined,
          branch: branchFilter || undefined,
          startDate: dateFilters.startDate || undefined,
          endDate: dateFilters.endDate || undefined
        }
      }, [tableOptions])

      // Calculate cursor for pagination
      const cursor = useMemo(() => {
        const { pagination } = tableOptions
        if (!pagination || pagination.pageIndex === 0) return undefined
        
        // We need to implement cursor calculation based on previous page data
        // For now, we'll use offset-style pagination as fallback
        return undefined
      }, [tableOptions.pagination])

      const finalQuery = { ...query, cursor }

      // Choose between metadata or full session data
      const queryKey = options?.metadata 
        ? CLAUDE_CODE_KEYS.sessionsMetadata(projectId ?? 0, finalQuery)
        : CLAUDE_CODE_KEYS.sessionsPaginated(projectId ?? 0, finalQuery)

      const result = useQuery({
        queryKey,
        queryFn: async () => {
          if (!projectId) throw new Error('Project ID is required')
          if (!client) throw new Error('API client not initialized')
          
          if (options?.metadata) {
            return await client.claudeCode.getSessionsMetadata(projectId, finalQuery)
          } else {
            return await client.claudeCode.getSessionsPaginated(projectId, finalQuery)
          }
        },
        enabled: !!client && options?.enabled !== false && !!projectId,
        staleTime: options?.staleTime ?? 2 * 60 * 1000, // 2 minutes for table data
        gcTime: 10 * 60 * 1000,
        placeholderData: options?.placeholderData,
        select: (data) => ({
          data: data.data,
          pagination: data.pagination || { hasMore: false },
          rowCount: data.pagination?.total ?? data.data.length,
          pageCount: data.pagination?.total ? Math.ceil(data.pagination.total / (query.limit || 20)) : 1
        })
      })

      // Background prefetching for next/previous pages
      useEffect(() => {
        if (!result.isSuccess || !result.data?.pagination?.hasMore) return
        
        const { pageIndex = 0, pageSize = 20 } = tableOptions.pagination || {}
        
        // Prefetch next page
        const nextPageQuery = {
          ...finalQuery,
          cursor: result.data.pagination.nextCursor
        }
        
        if (result.data.pagination.nextCursor) {
          const nextPageKey = options?.metadata 
            ? CLAUDE_CODE_KEYS.sessionsMetadata(projectId ?? 0, nextPageQuery)
            : CLAUDE_CODE_KEYS.sessionsPaginated(projectId ?? 0, nextPageQuery)
          
          queryClient.prefetchQuery({
            queryKey: nextPageKey,
            queryFn: async () => {
              if (!client || !projectId) return null
              if (options?.metadata) {
                return await client.claudeCode.getSessionsMetadata(projectId, nextPageQuery)
              } else {
                return await client.claudeCode.getSessionsPaginated(projectId, nextPageQuery)
              }
            },
            staleTime: 1 * 60 * 1000 // 1 minute for prefetched data
          })
        }
      }, [result.data, tableOptions.pagination, finalQuery, queryClient, client, projectId, options?.metadata])

      return {
        ...result,
        // Table-specific helpers
        tableData: result.data?.data ?? [],
        rowCount: result.data?.rowCount ?? 0,
        pageCount: result.data?.pageCount ?? 1,
        pagination: result.data?.pagination,
        // State helpers
        isEmpty: result.isSuccess && result.data?.data.length === 0,
        isLoadingFirstPage: result.isLoading,
        hasNextPage: result.data?.pagination?.hasMore ?? false,
        // Utilities
        invalidateTable: () => {
          const baseKey = CLAUDE_CODE_KEYS.sessions(projectId ?? 0)
          queryClient.invalidateQueries({ queryKey: baseKey })
        }
      }
    },

    /**
     * Progressive loading: metadata first, then full data
     */
    useClaudeSessionsProgressive: (
      projectId: number | undefined,
      query?: z.infer<typeof ClaudeSessionCursorSchema>,
      options?: {
        enabled?: boolean
        loadFullData?: boolean
        staleTime?: number
      }
    ) => {
      // First, load metadata for instant feedback
      const metadataResult = useQuery({
        queryKey: CLAUDE_CODE_KEYS.sessionsMetadata(projectId ?? 0, query),
        queryFn: async () => {
          if (!projectId) throw new Error('Project ID is required')
          const client = useApiClient()
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getSessionsMetadata(projectId, query)
          return response
        },
        enabled: options?.enabled !== false && !!projectId,
        staleTime: options?.staleTime ?? 1 * 60 * 1000, // 1 minute
        select: (data) => ({
          sessions: data.data,
          pagination: data.pagination,
          hasMore: data.pagination?.hasMore ?? false,
          nextCursor: data.pagination?.nextCursor,
          total: data.pagination?.total
        })
      })

      // Then, optionally load full session data
      const client = useApiClient()
      const fullDataResult = useQuery({
        queryKey: CLAUDE_CODE_KEYS.sessionsPaginated(projectId ?? 0, query),
        queryFn: async () => {
          if (!projectId || !client) throw new Error('Project ID and client required')
          return await client.claudeCode.getSessionsPaginated(projectId, query)
        },
        enabled: !!client && options?.enabled !== false && !!projectId && 
                 options?.loadFullData !== false && metadataResult.isSuccess,
        staleTime: options?.staleTime ?? 3 * 60 * 1000, // 3 minutes
        gcTime: 15 * 60 * 1000
      })

      return {
        // Metadata results (fast)
        metadata: metadataResult.data?.sessions ?? [],
        metadataLoading: metadataResult.isLoading,
        metadataError: metadataResult.error,
        
        // Full data results (slower but complete)
        sessions: fullDataResult.data?.data ?? metadataResult.data?.sessions ?? [],
        fullDataLoading: fullDataResult.isLoading,
        fullDataError: fullDataResult.error,
        
        // Combined state
        isLoading: metadataResult.isLoading,
        isLoadingFullData: fullDataResult.isLoading,
        error: metadataResult.error || fullDataResult.error,
        hasFullData: fullDataResult.isSuccess,
        
        // Pagination
        pagination: fullDataResult.data?.pagination ?? metadataResult.data?.pagination,
        hasMore: fullDataResult.data?.pagination?.hasMore ?? metadataResult.data?.hasMore ?? false,
        
        // Utils
        refetchMetadata: metadataResult.refetch,
        refetchFullData: fullDataResult.refetch,
        refetchAll: () => Promise.all([metadataResult.refetch(), fullDataResult.refetch()])
      }
    }
  }
}

// Factory for Claude Code message hooks
export function createClaudeCodeMessageHooks() {
  return {
    useClaudeMessages: (
      projectId: number | undefined,
      sessionId: string | undefined,
      query?: z.infer<typeof ClaudeMessageQuerySchema>,
      options?: {
        enabled?: boolean
        refetchInterval?: number | false
      }
    ) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_CODE_KEYS.messagesWithQuery(projectId ?? 0, sessionId ?? '', query),
        queryFn: async () => {
          if (!projectId || !sessionId) throw new Error('Project ID and Session ID are required')
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getSessionMessages(projectId, sessionId, query)
          return response.data
        },
        enabled: !!client && options?.enabled !== false && !!projectId && !!sessionId,
        refetchInterval: options?.refetchInterval
      })
    },

    useClaudeFullSession: (
      projectId: number | undefined,
      sessionId: string | undefined,
      options?: {
        enabled?: boolean
        staleTime?: number
      }
    ) => {
      const client = useApiClient()

      return useQuery({
        queryKey: [...CLAUDE_CODE_KEYS.all, 'full-session', projectId, sessionId],
        queryFn: async () => {
          if (!projectId || !sessionId) throw new Error('Project ID and Session ID are required')
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getFullSession(projectId, sessionId)
          return response
        },
        enabled: !!client && options?.enabled !== false && !!projectId && !!sessionId,
        staleTime: options?.staleTime ?? 10 * 60 * 1000, // 10 minutes - full session data changes less
        gcTime: 30 * 60 * 1000, // 30 minutes garbage collection for detailed data
        select: (data) => ({
          session: data.data,
          hasSession: !!data.data,
          isEmpty: !data.data
        })
      })
    }
  }
}

// Factory for Claude Code project hooks
export function createClaudeCodeProjectHooks() {
  return {
    useClaudeProjectData: (
      projectId: number | undefined,
      options?: {
        enabled?: boolean
        refetchInterval?: number | false
      }
    ) => {
      const client = useApiClient()

      return useQuery({
        queryKey: CLAUDE_CODE_KEYS.projectData(projectId ?? 0),
        queryFn: async () => {
          if (!projectId) throw new Error('Project ID is required')
          if (!client) throw new Error('API client not initialized')
          const response = await client.claudeCode.getProjectData(projectId)
          return response.data
        },
        enabled: !!client && options?.enabled !== false && !!projectId,
        refetchInterval: options?.refetchInterval
      })
    }
  }
}

// Advanced hooks that don't fit into standard factory patterns
export function createClaudeCodeAdvancedHooks() {
  return {
    /**
     * Real-time session watching with smart polling
     */
    useWatchClaudeSessions: (
      projectId: number | undefined,
      options?: {
        enabled?: boolean
        onUpdate?: (sessions: ClaudeSession[]) => void
        pollInterval?: number
        useRecent?: boolean
      }
    ) => {
      const queryClient = useQueryClient()
      const cleanupRef = useRef<(() => void) | null>(null)
      const client = useApiClient()
      const {
        enabled = true,
        pollInterval = 30000, // 30 seconds
        useRecent = true
      } = options || {}

      useEffect(() => {
        if (!projectId || !enabled || !client) return

        const interval = setInterval(async () => {
          try {
            let sessions: ClaudeSession[]
            
            if (useRecent) {
              // Use recent endpoint for efficiency
              const response = await client.claudeCode.getRecentSessions(projectId)
              sessions = response.data
              
              // Update recent cache
              queryClient.setQueryData(CLAUDE_CODE_KEYS.sessionsRecent(projectId), sessions)
            } else {
              // Use full sessions endpoint
              const response = await client.claudeCode.getSessions(projectId)
              sessions = response.data
              
              // Update sessions cache
              queryClient.setQueryData(CLAUDE_CODE_KEYS.sessions(projectId), sessions)
            }

            // Call callback if provided
            options?.onUpdate?.(sessions)
            
            // Invalidate related queries to trigger background updates
            queryClient.invalidateQueries({ 
              queryKey: CLAUDE_CODE_KEYS.sessions(projectId),
              exact: false,
              refetchType: 'none' // Don't refetch immediately, just mark as stale
            })
          } catch (error) {
            console.warn('Failed to fetch Claude sessions:', error)
          }
        }, pollInterval)

        cleanupRef.current = () => clearInterval(interval)

        return () => {
          cleanupRef.current?.()
        }
      }, [projectId, enabled, queryClient, options?.onUpdate, client, pollInterval, useRecent])

      return {
        stop: useCallback(() => {
          cleanupRef.current?.()
        }, []),
        
        // Force refresh now
        refresh: useCallback(async () => {
          if (!projectId || !client) return
          
          try {
            if (useRecent) {
              const response = await client.claudeCode.getRecentSessions(projectId)
              queryClient.setQueryData(CLAUDE_CODE_KEYS.sessionsRecent(projectId), response.data)
              options?.onUpdate?.(response.data)
            } else {
              const response = await client.claudeCode.getSessions(projectId)
              queryClient.setQueryData(CLAUDE_CODE_KEYS.sessions(projectId), response.data)
              options?.onUpdate?.(response.data)
            }
          } catch (error) {
            console.warn('Manual refresh failed:', error)
          }
        }, [projectId, client, queryClient, options?.onUpdate, useRecent])
      }
    },

    /**
     * Smart background data management
     */
    useClaudeCodeBackgroundData: (
      projectId: number | undefined,
      options?: {
        enableBackgroundRefresh?: boolean
        prefetchRecent?: boolean
        prefetchMetadata?: boolean
        backgroundRefreshInterval?: number
      }
    ) => {
      const queryClient = useQueryClient()
      const client = useApiClient()
      
      const {
        enableBackgroundRefresh = true,
        prefetchRecent = true,
        prefetchMetadata = true,
        backgroundRefreshInterval = 5 * 60 * 1000 // 5 minutes
      } = options || {}

      // Background refresh of critical data
      useEffect(() => {
        if (!projectId || !enableBackgroundRefresh || !client) return

        const interval = setInterval(async () => {
          try {
            // Refresh recent sessions in background
            if (prefetchRecent) {
              await queryClient.prefetchQuery({
                queryKey: CLAUDE_CODE_KEYS.sessionsRecent(projectId),
                queryFn: () => client.claudeCode.getRecentSessions(projectId),
                staleTime: 30 * 1000 // 30 seconds
              })
            }
            
            // Refresh metadata if it's being used
            if (prefetchMetadata) {
              await queryClient.prefetchQuery({
                queryKey: CLAUDE_CODE_KEYS.sessionsMetadata(projectId, { limit: 20, sortBy: 'lastUpdate', sortOrder: 'desc' }),
                queryFn: () => client.claudeCode.getSessionsMetadata(projectId, { limit: 20, sortBy: 'lastUpdate', sortOrder: 'desc' }),
                staleTime: 1 * 60 * 1000 // 1 minute
              })
            }
          } catch (error) {
            console.warn('Background data refresh failed:', error)
          }
        }, backgroundRefreshInterval)

        return () => clearInterval(interval)
      }, [projectId, enableBackgroundRefresh, prefetchRecent, prefetchMetadata, backgroundRefreshInterval, queryClient, client])

      // Initial prefetching on mount
      useEffect(() => {
        if (!projectId || !client) return

        const prefetch = async () => {
          try {
            if (prefetchRecent) {
              queryClient.prefetchQuery({
                queryKey: CLAUDE_CODE_KEYS.sessionsRecent(projectId),
                queryFn: () => client.claudeCode.getRecentSessions(projectId),
                staleTime: 30 * 1000
              })
            }
            
            if (prefetchMetadata) {
              queryClient.prefetchQuery({
                queryKey: CLAUDE_CODE_KEYS.sessionsMetadata(projectId, { limit: 10, sortBy: 'lastUpdate', sortOrder: 'desc' }),
                queryFn: () => client.claudeCode.getSessionsMetadata(projectId, { limit: 10, sortBy: 'lastUpdate', sortOrder: 'desc' }),
                staleTime: 1 * 60 * 1000
              })
            }
          } catch (error) {
            console.warn('Initial prefetch failed:', error)
          }
        }

        prefetch()
      }, [projectId, prefetchRecent, prefetchMetadata, queryClient, client])

      return {
        // Manual prefetch controls
        prefetchRecent: useCallback(async () => {
          if (!projectId || !client) return
          return queryClient.prefetchQuery({
            queryKey: CLAUDE_CODE_KEYS.sessionsRecent(projectId),
            queryFn: () => client.claudeCode.getRecentSessions(projectId)
          })
        }, [projectId, client, queryClient]),
        
        prefetchMetadata: useCallback(async (limit = 20) => {
          if (!projectId || !client) return
          return queryClient.prefetchQuery({
            queryKey: CLAUDE_CODE_KEYS.sessionsMetadata(projectId, { limit, sortBy: 'lastUpdate', sortOrder: 'desc' }),
            queryFn: () => client.claudeCode.getSessionsMetadata(projectId, { limit, sortBy: 'lastUpdate', sortOrder: 'desc' })
          })
        }, [projectId, client, queryClient])
      }
    },

    /**
     * Cache invalidation utilities
     */
    useClaudeCodeInvalidation: () => {
      const queryClient = useQueryClient()

      return useMemo(() => ({
        // Invalidate all Claude Code data
        invalidateAll: () => {
          queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.all })
        },
        
        // Invalidate all sessions for a project
        invalidateSessions: (projectId: number) => {
          queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.sessions(projectId) })
        },
        
        // Invalidate specific session data
        invalidateSessionMessages: (projectId: number, sessionId: string) => {
          queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.messages(projectId, sessionId) })
        },
        
        // Invalidate project data
        invalidateProjectData: (projectId: number) => {
          queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.projectData(projectId) })
        },
        
        // Reset infinite query
        resetInfiniteQuery: (projectId: number, query?: Omit<z.infer<typeof ClaudeSessionCursorSchema>, 'cursor'>) => {
          queryClient.resetQueries({ queryKey: CLAUDE_CODE_KEYS.sessionsInfinite(projectId, query) })
        },
        
        // Prefetch recent sessions
        prefetchRecent: async (projectId: number) => {
          return queryClient.prefetchQuery({
            queryKey: CLAUDE_CODE_KEYS.sessionsRecent(projectId),
            staleTime: 30 * 1000 // 30 seconds
          })
        },
        
        // Manually update session data (optimistic updates)
        updateSessionData: (projectId: number, sessionId: string, updater: (old: ClaudeSession) => ClaudeSession) => {
          // Update in all relevant caches
          queryClient.setQueriesData(
            { queryKey: CLAUDE_CODE_KEYS.sessions(projectId) },
            (old: any) => {
              if (!old || !Array.isArray(old)) return old
              return old.map((session: ClaudeSession) => 
                session.sessionId === sessionId ? updater(session) : session
              )
            }
          )
        },
        
        // Get cached session data without triggering a request
        getCachedSession: (projectId: number, sessionId: string): ClaudeSession | undefined => {
          const sessionsData = queryClient.getQueryData(CLAUDE_CODE_KEYS.sessions(projectId)) as ClaudeSession[]
          return sessionsData?.find(s => s.sessionId === sessionId)
        },
        
        // Check if data is stale
        isStale: (queryKey: any[]) => {
          const query = queryClient.getQueryState(queryKey)
          if (!query) return true
          
          // Get the default stale time from query cache or use default
          const defaultStaleTime = queryClient.getDefaultOptions().queries?.staleTime || 0
          const staleTime = typeof defaultStaleTime === 'number' ? defaultStaleTime : 0
          
          return Date.now() - (query.dataUpdatedAt || 0) > staleTime
        }
      }), [queryClient])
    }
  }
}

// Utility hooks
export function createClaudeCodeUtilityHooks() {
  return {
    /**
     * Copy to clipboard with toast feedback
     */
    useCopyToClipboard: () => {
      return useMutation({
        mutationFn: async (text: string) => {
          await navigator.clipboard.writeText(text)
          return text
        },
        onSuccess: () => {
          toast.success('Copied to clipboard')
        },
        onError: () => {
          toast.error('Failed to copy. Please try again.')
        }
      })
    },

    /**
     * Format Claude message content
     */
    useFormatClaudeMessage: () => {
      return useCallback((content: string | Array<any>) => {
        if (typeof content === 'string') {
          return content
        }

        return content
          .map((item) => {
            if (typeof item === 'string') return item
            if (item.type === 'text') return item.text
            if (item.type === 'image') return '[Image]'
            return ''
          })
          .join('')
      }, [])
    },

    /**
     * Calculate session duration
     */
    useSessionDuration: (startTime: string, endTime?: string) => {
      const start = new Date(startTime).getTime()
      const end = endTime ? new Date(endTime).getTime() : Date.now()
      const duration = end - start

      const hours = Math.floor(duration / (1000 * 60 * 60))
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((duration % (1000 * 60)) / 1000)

      if (hours > 0) {
        return `${hours}h ${minutes}m`
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`
      } else {
        return `${seconds}s`
      }
    }
  }
}

// Create hook instances
const sessionHooks = createClaudeCodeSessionHooks()
const messageHooks = createClaudeCodeMessageHooks()
const projectHooks = createClaudeCodeProjectHooks()
const advancedHooks = createClaudeCodeAdvancedHooks()
const utilityHooks = createClaudeCodeUtilityHooks()

// Export individual hooks for backward compatibility
export const useClaudeSessions = sessionHooks.useClaudeSessions
export const useClaudeSessionsMetadata = sessionHooks.useClaudeSessionsMetadata
export const useClaudeSessionsRecent = sessionHooks.useClaudeSessionsRecent
export const useClaudeSessionsInfinite = sessionHooks.useClaudeSessionsInfinite
export const useClaudeSessionsTable = sessionHooks.useClaudeSessionsTable
export const useClaudeSessionsProgressive = sessionHooks.useClaudeSessionsProgressive

export const useClaudeMessages = messageHooks.useClaudeMessages
export const useClaudeFullSession = messageHooks.useClaudeFullSession

export const useClaudeProjectData = projectHooks.useClaudeProjectData

export const useWatchClaudeSessions = advancedHooks.useWatchClaudeSessions
export const useClaudeCodeBackgroundData = advancedHooks.useClaudeCodeBackgroundData
export const useClaudeCodeInvalidation = advancedHooks.useClaudeCodeInvalidation

export const useCopyToClipboard = utilityHooks.useCopyToClipboard
export const useFormatClaudeMessage = utilityHooks.useFormatClaudeMessage
export const useSessionDuration = utilityHooks.useSessionDuration

// Export factories for advanced usage
export {
  createClaudeCodeSessionHooks,
  createClaudeCodeMessageHooks,
  createClaudeCodeProjectHooks,
  createClaudeCodeAdvancedHooks,
  createClaudeCodeUtilityHooks
}