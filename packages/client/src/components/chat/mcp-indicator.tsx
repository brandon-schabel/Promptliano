/**
 * MCP Indicator Component
 * Shows active MCP servers count with visual indicator
 * Opens MCP info popover on click
 */

import { Server, Database } from 'lucide-react'
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '@promptliano/ui'
import { MCPInfoPopover } from './mcp-info-popover'
import { useEnabledMCPCount } from '@/hooks/use-active-mcps'
import type { APIProviders } from '@promptliano/database'
import { useState } from 'react'

export interface MCPIndicatorProps {
  provider: APIProviders | string
  projectId?: number
  className?: string
}

export function MCPIndicator({ provider, projectId, className }: MCPIndicatorProps) {
  const [open, setOpen] = useState(false)
  const enabledCount = useEnabledMCPCount(provider, projectId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className} title="View active MCP servers">
          <Server className="h-4 w-4 mr-1" />
          <Badge variant="secondary" className="ml-1">
            {enabledCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <MCPInfoPopover provider={provider} projectId={projectId} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
