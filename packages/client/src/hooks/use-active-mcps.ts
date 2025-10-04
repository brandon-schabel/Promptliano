/**
 * Hook for fetching active MCP servers and their tools
 * Includes conditional Groq remote MCP based on provider selection
 */

import { useQuery } from '@tanstack/react-query'
import { useApiClient } from './api/use-api-client'
import type { APIProviders } from '@promptliano/database'

export interface MCPTool {
  name: string
  description?: string
  category?: string
}

export interface MCPServerInfo {
  name: string
  type: 'local' | 'remote'
  enabled: boolean
  toolCount: number
  tools: MCPTool[]
  conditionalOn?: string
}

export interface ActiveMCPsResponse {
  mcps: MCPServerInfo[]
  totalTools: number
  provider?: string
}

// ============================================================================
// Query Keys
// ============================================================================

export const MCP_KEYS = {
  all: ['mcp'] as const,
  activeTools: (provider?: string, projectId?: number) => [...MCP_KEYS.all, 'active-tools', provider, projectId] as const
}

// ============================================================================
// MCP Hooks
// ============================================================================

/**
 * Fetch active MCP servers and their tools
 * @param provider - Current AI provider (affects Groq remote MCP availability)
 * @param projectId - Optional project ID for project-specific MCPs
 */
export function useActiveMCPs(provider?: APIProviders | string, projectId?: number) {
  const client = useApiClient()

  return useQuery<ActiveMCPsResponse>({
    queryKey: MCP_KEYS.activeTools(provider, projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')

      const result = await client.mcp.listMcpActiveTools({
        provider,
        projectId
      })

      if (!result.success) {
        throw new Error('Failed to fetch active MCPs')
      }

      return result.data
    },
    enabled: !!client && !!provider,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000 // 5 minutes
  })
}

/**
 * Get the count of enabled MCPs
 */
export function useEnabledMCPCount(provider?: APIProviders | string, projectId?: number) {
  const { data } = useActiveMCPs(provider, projectId)
  return data?.mcps.filter((mcp) => mcp.enabled).length || 0
}

/**
 * Get the total count of tools across all enabled MCPs
 */
export function useTotalMCPToolCount(provider?: APIProviders | string, projectId?: number) {
  const { data } = useActiveMCPs(provider, projectId)
  return data?.totalTools || 0
}
