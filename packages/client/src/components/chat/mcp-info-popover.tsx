/**
 * MCP Info Popover Component
 * Displays detailed information about active MCP servers and their tools
 * Shows tool counts, categories, and expandable tool lists
 */

import { useState } from 'react'
import { Server, ChevronDown, ChevronRight, Globe, Laptop, Badge as BadgeIcon, Loader2 } from 'lucide-react'
import { Badge, Button } from '@promptliano/ui'
import { useActiveMCPs } from '@/hooks/use-active-mcps'
import type { APIProviders } from '@promptliano/database'
import { cn } from '@/lib/utils'

export interface MCPInfoPopoverProps {
  provider: APIProviders | string
  projectId?: number
  onClose?: () => void
}

export function MCPInfoPopover({ provider, projectId, onClose }: MCPInfoPopoverProps) {
  const { data, isLoading, error } = useActiveMCPs(provider, projectId)
  const [expandedMCPs, setExpandedMCPs] = useState<Set<string>>(new Set())

  const toggleMCP = (mcpName: string) => {
    setExpandedMCPs((prev) => {
      const next = new Set(prev)
      if (next.has(mcpName)) {
        next.delete(mcpName)
      } else {
        next.add(mcpName)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className='flex h-48 items-center justify-center p-6'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        <span className='ml-2 text-sm text-muted-foreground'>Loading MCP info...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-6'>
        <p className='text-sm text-destructive'>Failed to load MCP information</p>
        <p className='mt-1 text-xs text-muted-foreground'>{error.message}</p>
      </div>
    )
  }

  if (!data || data.mcps.length === 0) {
    return (
      <div className='p-6'>
        <p className='text-sm text-muted-foreground'>No MCP servers available</p>
      </div>
    )
  }

  const enabledMCPs = data.mcps.filter((mcp) => mcp.enabled)
  const disabledMCPs = data.mcps.filter((mcp) => !mcp.enabled)

  return (
    <div className='flex max-h-[70vh] min-h-[12rem] w-full flex-col'>
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div>
          <h4 className='text-sm font-semibold'>Active MCP Servers</h4>
          <p className='text-xs text-muted-foreground'>
            {enabledMCPs.length} enabled • {data.totalTools} total tools
          </p>
        </div>
        {onClose && (
          <Button variant='ghost' size='sm' onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-3'>
        <div className='space-y-4'>
          {/* Enabled MCPs */}
          {enabledMCPs.length > 0 ? (
            <div className='space-y-3'>
              {enabledMCPs.map((mcp) => {
                const isExpanded = expandedMCPs.has(mcp.name)

                return (
                  <div
                    key={mcp.name}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      mcp.enabled ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'
                    )}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex flex-1 items-center gap-2'>
                        {mcp.type === 'local' ? (
                          <Laptop className='h-4 w-4 text-blue-500' />
                        ) : (
                          <Globe className='h-4 w-4 text-green-500' />
                        )}
                        <span className='text-sm font-medium'>{mcp.name}</span>
                        <Badge variant='secondary' className='text-xs'>
                          {mcp.type}
                        </Badge>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Badge variant='outline' className='text-xs'>
                          {mcp.toolCount} tools
                        </Badge>
                        <Button variant='ghost' size='sm' onClick={() => toggleMCP(mcp.name)}>
                          {isExpanded ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
                        </Button>
                      </div>
                    </div>

                    {mcp.conditionalOn && (
                      <div className='mt-2'>
                        <Badge variant='default' className='text-xs'>
                          Active with {mcp.conditionalOn}
                        </Badge>
                      </div>
                    )}

                    {/* Expandable Tool List */}
                    {isExpanded && (
                      <div className='mt-3 border-t pt-3'>
                        <div className='space-y-2'>
                          {mcp.tools.map((tool, idx) => (
                            <div key={`${tool.name}-${idx}`} className='flex items-start gap-2 text-xs'>
                              <BadgeIcon className='mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground' />
                              <div className='min-w-0 flex-1'>
                                <p className='truncate font-medium text-foreground'>{tool.name}</p>
                                {tool.description && <p className='mt-0.5 text-muted-foreground'>{tool.description}</p>}
                                {tool.category && (
                                  <Badge variant='outline' className='mt-1 py-0 text-[10px]'>
                                    {tool.category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className='rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground'>
              No enabled MCP servers for the selected provider
            </div>
          )}

          {/* Disabled MCPs (collapsed) */}
          {disabledMCPs.length > 0 && (
            <div className='border-t pt-3 text-xs text-muted-foreground'>
              <details>
                <summary className='cursor-pointer transition-colors hover:text-foreground'>
                  {disabledMCPs.length} inactive MCP{disabledMCPs.length > 1 ? 's' : ''}
                </summary>
                <div className='mt-2 space-y-1'>
                  {disabledMCPs.map((mcp) => (
                    <div key={mcp.name} className='flex items-center justify-between py-1'>
                      <span>{mcp.name}</span>
                      {mcp.conditionalOn && <span className='text-[10px]'>Requires {mcp.conditionalOn}</span>}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Provider Context */}
          {data.provider && (
            <div className='border-t pt-3 text-xs text-muted-foreground'>
              Current provider: <span className='font-medium'>{data.provider}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
