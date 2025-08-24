// Recent changes:
// - Initial implementation of MCP status indicator component
// - Shows real-time connection status
// - Displays last activity time
// - Auto-refreshes every 30 seconds
// - Tooltips for detailed information

import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@promptliano/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { Loader2, WifiOff, Wifi } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useApiClient } from '@/hooks/api/use-api-client'

interface MCPStatusIndicatorProps {
  projectId: number
}

export function MCPStatusIndicator({ projectId }: MCPStatusIndicatorProps) {
  const client = useApiClient()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mcp-status', projectId],
    queryFn: async () => {
      if (!client) return
      const response = await client.projects.getMCPInstallationStatus(projectId)
      return response
    },
    enabled: !!client,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  })

  useEffect(() => {
    // Refetch when component mounts
    refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <Badge variant='secondary' className='gap-1'>
        <Loader2 className='h-3 w-3 animate-spin' />
        Checking MCP...
      </Badge>
    )
  }

  // MCP status doesn't have connection status - it shows installation status
  // This component should show MCP installation status instead
  const mcpStatus = data?.data || data
  const isInstalled = (mcpStatus && 'claudeDesktop' in mcpStatus ? mcpStatus.claudeDesktop?.installed : false) || 
                     (mcpStatus && 'claudeCode' in mcpStatus ? mcpStatus.claudeCode?.globalConfigExists : false) || false
  const hasConfig = (mcpStatus && 'claudeDesktop' in mcpStatus ? mcpStatus.claudeDesktop?.configExists : false) ||
                   (mcpStatus && 'claudeCode' in mcpStatus ? mcpStatus.claudeCode?.globalConfigExists : false) || false

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isInstalled && hasConfig ? 'default' : 'secondary'}
            className={`gap-1 cursor-help ${isInstalled && hasConfig ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {isInstalled && hasConfig ? <Wifi className='h-3 w-3' /> : <WifiOff className='h-3 w-3' />}
            MCP {isInstalled && hasConfig ? 'Configured' : 'Not Configured'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className='space-y-1'>
            <p className='font-semibold'>MCP Status: {isInstalled && hasConfig ? 'Configured' : 'Not Configured'}</p>
            {mcpStatus && 'claudeDesktop' in mcpStatus && mcpStatus.claudeDesktop?.installed && (
              <p className='text-xs text-muted-foreground'>Claude Desktop: Installed</p>
            )}
            {mcpStatus && 'claudeCode' in mcpStatus && mcpStatus.claudeCode?.globalConfigExists && (
              <p className='text-xs text-muted-foreground'>Claude Code: Global config exists</p>
            )}
            {(!isInstalled || !hasConfig) && (
              <p className='text-xs text-muted-foreground'>Install MCP tools to enable integration</p>
            )}
            {mcpStatus && 'claudeDesktop' in mcpStatus && mcpStatus.claudeDesktop?.error && (
              <p className='text-xs text-red-400'>Desktop Error: {mcpStatus.claudeDesktop.error}</p>
            )}
            {mcpStatus && 'claudeCode' in mcpStatus && mcpStatus.claudeCode?.error && (
              <p className='text-xs text-red-400'>Code Error: {mcpStatus.claudeCode.error}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
