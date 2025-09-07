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
    queryKey: ['mcp-installation-detect'],
    queryFn: async () => {
      if (!client) return
      // Use the MCP installation detection endpoint which returns tools array
      const response = await client.typeSafeClient.listMcpInstallationDetect()
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

  // MCP installation detection returns tools array with installation status
  const tools = data?.data?.tools || []
  const claudeDesktop = tools.find((t) => t.tool === 'claude-desktop')
  const claudeCode = tools.find((t) => t.tool === 'claude-code')

  const isInstalled = claudeDesktop?.installed || claudeCode?.installed || false
  const hasConfig = claudeDesktop?.configExists || claudeCode?.configExists || false

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
            {claudeDesktop?.installed && <p className='text-xs text-muted-foreground'>Claude Desktop: Installed</p>}
            {claudeCode?.installed && <p className='text-xs text-muted-foreground'>Claude Code: Installed</p>}
            {(!isInstalled || !hasConfig) && (
              <p className='text-xs text-muted-foreground'>Install MCP tools to enable integration</p>
            )}
            {claudeDesktop?.hasPromptliano && (
              <p className='text-xs text-green-400'>Claude Desktop has Promptliano configured</p>
            )}
            {claudeCode?.hasPromptliano && (
              <p className='text-xs text-green-400'>Claude Code has Promptliano configured</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
