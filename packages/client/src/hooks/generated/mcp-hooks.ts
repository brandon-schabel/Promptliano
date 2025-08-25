/**
 * Generated MCP Hooks - Factory Pattern Implementation
 * Migrated from use-mcp-analytics-api.ts and use-mcp-global-api.ts
 * 
 * Replaces 239 + 98 = 337 lines of manual MCP hook code with factory-based patterns
 * Maintains 30s polling for analytics overview
 */

import { useApiClient } from '../api/use-api-client'
import { createCrudHooks } from '../factories/crud-hook-factory'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
// Define MCP types locally to avoid import issues
export type MCPExecutionQuery = {
  projectId?: number
  toolName?: string
  startDate?: number
  endDate?: number
  status?: 'success' | 'error' | 'timeout'
  userId?: string
  sessionId?: string
  limit?: number
  offset?: number
  sortBy?: 'startedAt' | 'duration' | 'toolName'
  sortOrder?: 'asc' | 'desc'
}

export type MCPAnalyticsRequest = {
  projectId?: number
  timeRange?: '1h' | '24h' | '7d' | '30d'
  toolNames?: string[]
}

export type MCPAnalyticsOverview = {
  totalExecutions: number
  successRate: number
  avgExecutionTime: number
  topTools: Array<{ name: string; count: number }>
  errorPatterns: Array<{ pattern: string; count: number }>
  timeline: Array<{ timestamp: string; count: number }>
}

export type MCPToolExecution = {
  id: string | number
  toolName: string
  projectId?: number | null
  userId?: string | null
  sessionId?: string | null
  startedAt: number
  completedAt?: number | null
  durationMs?: number | null
  status: 'success' | 'error' | 'timeout'
  errorMessage?: string | null
  errorCode?: string | null
  inputParams?: string | null
  outputSize?: number | null
  metadata?: string | null
}

export type MCPToolStatistics = {
  toolName: string
  totalExecutions: number
  successCount: number
  errorCount: number
  avgDuration: number
  lastExecution: string
}

export type MCPExecutionTimeline = {
  timestamp: string
  executions: number
  errors: number
}

export type MCPToolPattern = {
  pattern: string
  count: number
  percentage: number
}

// ============================================================================
// Types (from original files)
// ============================================================================

export type GlobalMCPConfig = {
  servers?: Record<string, any>
  mcpServers?: Record<string, any>
  capabilities?: {
    sampling?: boolean
    [key: string]: any
  }
  cloudProvider?: string
  cloudProviderConfig?: any
  extends?: string | string[]
}

export type GlobalMCPInstallation = {
  tool: string
  version: string
  installedAt: string
  installedBy: string
  location: string
  config?: {
    serverName?: string
    settings?: Record<string, any>
  }
}

export type GlobalMCPStatus = {
  configExists: boolean
  configPath: string
  lastModified?: number
  totalInstallations: number
  installedTools: string[]
  installation: {
    supported: boolean
    scriptPath: string
    scriptExists: boolean
  }
}

// ============================================================================
// Query Keys (enhanced from original)
// ============================================================================

export const MCP_ENHANCED_KEYS = {
  all: ['mcp'] as const,
  // Required QueryKeyFactory methods
  lists: () => ['mcp', 'list'] as const,
  list: () => ['mcp', 'list'] as const,
  details: () => ['mcp', 'detail'] as const,
  detail: (id: number) => ['mcp', 'detail', id] as const,
  // MCP-specific query keys
  analytics: (projectId: number) => ['mcp', 'analytics', projectId] as const,
  executions: (projectId: number, query?: MCPExecutionQuery) => 
    ['mcp', 'analytics', projectId, 'executions', query] as const,
  overview: (projectId: number, request?: MCPAnalyticsRequest) => 
    ['mcp', 'analytics', projectId, 'overview', request] as const,
  statistics: (projectId: number, request?: MCPAnalyticsRequest) => 
    ['mcp', 'analytics', projectId, 'statistics', request] as const,
  timeline: (projectId: number, request?: MCPAnalyticsRequest) => 
    ['mcp', 'analytics', projectId, 'timeline', request] as const,
  errorPatterns: (projectId: number, request?: MCPAnalyticsRequest) => 
    ['mcp', 'analytics', projectId, 'error-patterns', request] as const,
  global: () => ['mcp', 'global'] as const,
  config: () => ['mcp', 'global', 'config'] as const,
  installations: () => ['mcp', 'global', 'installations'] as const,
  status: () => [...MCP_ENHANCED_KEYS.global(), 'status'] as const
}

// ============================================================================
// Factory Configuration
// ============================================================================

const MCP_CONFIG = {
  entityName: 'MCP',
  queryKeys: MCP_ENHANCED_KEYS,
  apiClient: {
    // MCP doesn't have standard CRUD operations, we'll use custom hooks
    list: () => Promise.resolve([]),
    getById: () => Promise.resolve(null as any),
    create: () => Promise.resolve(null as any),
    update: () => Promise.resolve(null as any),
    delete: () => Promise.resolve(undefined)
  },
  staleTime: 30000, // 30s default stale time
  polling: {
    custom: {
      overview: {
        enabled: true,
        interval: 30000, // 30s polling for analytics overview (preserved from original)
        refetchInBackground: true
      }
    }
  },
  invalidation: {
    onCreate: 'all' as const,
    onUpdate: 'all' as const,
    onDelete: 'all' as const
  }
}

// Create base MCP hooks (for utilities)
const mcpHooks = createCrudHooks(MCP_CONFIG)

// ============================================================================
// MCP Analytics Query Hooks (migrated from use-mcp-analytics-api.ts)
// ============================================================================

/**
 * Get MCP tool executions
 */
export function useGetMCPExecutions(projectId: number | undefined, query?: MCPExecutionQuery) {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.executions(projectId!, query),
    queryFn: async () => {
      if (!projectId) return null
      if (!client) throw new Error('API client not initialized')
      const response = await client.mcpAnalytics.getExecutions(projectId, query)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

/**
 * Get MCP analytics overview with 30s polling (preserved from original)
 */
export function useGetMCPAnalyticsOverview(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.overview(projectId!, request),
    queryFn: async () => {
      if (!projectId) return null
      if (!client) throw new Error('API client not initialized')
      const response = await client.mcpAnalytics.getOverview(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId,
    refetchInterval: 30000, // 30s polling preserved
    refetchIntervalInBackground: true
  })
}

/**
 * Get MCP tool statistics
 */
export function useGetMCPToolStatistics(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.statistics(projectId!, request),
    queryFn: async () => {
      if (!projectId) return null
      if (!client) throw new Error('API client not initialized')
      const response = await client.mcpAnalytics.getStatistics(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

/**
 * Get MCP execution timeline
 */
export function useGetMCPExecutionTimeline(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.timeline(projectId!, request),
    queryFn: async () => {
      if (!projectId) return null
      if (!client) throw new Error('API client not initialized')
      const response = await client.mcpAnalytics.getTimeline(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

/**
 * Get MCP error patterns
 */
export function useGetMCPErrorPatterns(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.errorPatterns(projectId!, request),
    queryFn: async () => {
      if (!projectId) return null
      if (!client) throw new Error('API client not initialized')
      const response = await client.mcpAnalytics.getErrorPatterns(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

// ============================================================================
// MCP Global Query Hooks (migrated from use-mcp-global-api.ts)
// ============================================================================

/**
 * Get global MCP config
 */
export function useGetGlobalMCPConfig() {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.config(),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return client.mcp.getGlobalConfig()
    },
    enabled: !!client,
    staleTime: 5 * 60 * 1000, // 5 minutes preserved
    retry: 2
  })
}

/**
 * Get global installations
 */
export function useGetGlobalInstallations() {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.installations(),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return client.mcp.getGlobalInstallations()
    },
    enabled: !!client,
    staleTime: 2 * 60 * 1000, // 2 minutes preserved
    refetchOnWindowFocus: true
  })
}

/**
 * Get global MCP status
 */
export function useGetGlobalMCPStatus() {
  const client = useApiClient()

  return useQuery({
    queryKey: MCP_ENHANCED_KEYS.status(),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return client.mcp.getGlobalStatus()
    },
    enabled: !!client,
    staleTime: 30 * 1000, // 30 seconds preserved
    refetchOnWindowFocus: true
  })
}

// ============================================================================
// MCP Global Mutation Hooks (migrated from use-mcp-global-api.ts)
// ============================================================================

/**
 * Update global MCP config
 */
export function useUpdateGlobalMCPConfig() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: any) => {
      if (!client) throw new Error('API client not initialized')
      return client.mcp.updateGlobalConfig(updates)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.global() })
      const typedData = data as any
      toast.success(typedData.data?.message || 'Global MCP config updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update global MCP config')
    }
  })
}

/**
 * Install global MCP
 */
export function useInstallGlobalMCP() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { tool: string; serverName?: string; debug?: boolean }) => {
      if (!client) throw new Error('API client not initialized')
      return client.mcp.installGlobalMCP(data)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.installations() })
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.status() })
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.config() })
      const typedData = data as any
      toast.success(typedData.data?.message || 'MCP tool installed globally')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to install MCP tool globally')
    }
  })
}

/**
 * Uninstall global MCP
 */
export function useUninstallGlobalMCP() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { tool: string }) => {
      if (!client) throw new Error('API client not initialized')
      return client.mcp.uninstallGlobalMCP(data)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.installations() })
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.status() })
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.config() })
      const typedData = data as any
      toast.success(typedData.data?.message || 'MCP tool uninstalled globally')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to uninstall MCP tool globally')
    }
  })
}

// ============================================================================
// Factory-Based Invalidation Utilities
// ============================================================================

export function useInvalidateMCP() {
  const { invalidateAll } = mcpHooks.useInvalidate()
  const queryClient = useQueryClient()

  return {
    invalidateAll,
    invalidateAnalytics: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.analytics(projectId) })
    },
    invalidateGlobal: () => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.global() })
    },
    invalidateConfig: () => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.config() })
    },
    invalidateInstallations: () => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.installations() })
    },
    invalidateStatus: () => {
      queryClient.invalidateQueries({ queryKey: MCP_ENHANCED_KEYS.status() })
    },
    // Optimistic update for config
    setConfigOptimistically: (config: any) => {
      queryClient.setQueryData(MCP_ENHANCED_KEYS.config(), (old: any) => ({
        ...old,
        data: {
          ...old?.data,
          ...config
        }
      }))
    }
  }
}

// ============================================================================
// Composite Hook (migrated from use-mcp-global-api.ts)
// ============================================================================

/**
 * Global MCP Manager - composite hook for managing MCP installations
 */
export function useGlobalMCPManager() {
  const { data: config, isLoading: configLoading } = useGetGlobalMCPConfig()
  const { data: installations, isLoading: installationsLoading } = useGetGlobalInstallations()
  const { data: status, isLoading: statusLoading } = useGetGlobalMCPStatus()

  const updateConfig = useUpdateGlobalMCPConfig()
  const install = useInstallGlobalMCP()
  const uninstall = useUninstallGlobalMCP()

  return {
    // Query states
    config: config?.data,
    installations: (installations?.data as any)?.installations || [],
    toolStatuses: (installations?.data as any)?.toolStatuses || [],
    status: status?.data,
    isLoading: configLoading || installationsLoading || statusLoading,

    // Mutations
    updateConfig: updateConfig.mutate,
    install: install.mutate,
    uninstall: uninstall.mutate,

    // Mutation states
    isUpdating: updateConfig.isPending,
    isInstalling: install.isPending,
    isUninstalling: uninstall.isPending,

    // Helper methods
    isToolInstalled: (tool: string) => {
      return (installations?.data as any)?.toolStatuses?.some((toolStatus: any) => toolStatus.tool === tool && toolStatus.installed) ?? false
    },

    getInstallation: (tool: string) => {
      return (installations?.data as any)?.installations?.find((installation: any) => installation.tool === tool)
    },

    getToolStatus: (tool: string) => {
      return (installations?.data as any)?.toolStatuses?.find((toolStatus: any) => toolStatus.tool === tool)
    }
  }
}

// ============================================================================
// Type Exports
// ============================================================================

// Types already declared above, no need to re-export
// export type {
//   MCPExecutionQuery,
//   MCPAnalyticsRequest,
//   MCPAnalyticsOverview,
//   MCPToolExecution,
//   MCPToolStatistics,
//   MCPExecutionTimeline,
//   MCPToolPattern,
//   GlobalMCPConfig,
//   GlobalMCPInstallation,
//   GlobalMCPStatus
// }

// Export query keys for external use
export { MCP_ENHANCED_KEYS as MCP_KEYS }