/**
 * MCP Info Popover Component
 * Displays detailed information about active MCP servers and their tools
 * Shows tool counts, categories, and expandable tool lists
 */

import { useState } from 'react'
import { Server, ChevronDown, ChevronRight, Globe, Laptop, Badge as BadgeIcon, Loader2 } from 'lucide-react'
import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, ScrollArea } from '@promptliano/ui'
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading MCP info...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4">
        <p className="text-sm text-destructive">Failed to load MCP information</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    )
  }

  if (!data || data.mcps.length === 0) {
    return (
      <div className="py-4">
        <p className="text-sm text-muted-foreground">No MCP servers available</p>
      </div>
    )
  }

  const enabledMCPs = data.mcps.filter((mcp) => mcp.enabled)
  const disabledMCPs = data.mcps.filter((mcp) => !mcp.enabled)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">Active MCP Servers</h4>
          <p className="text-xs text-muted-foreground">
            {enabledMCPs.length} enabled • {data.totalTools} total tools
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Enabled MCPs */}
      {enabledMCPs.length > 0 && (
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {enabledMCPs.map((mcp) => {
              const isExpanded = expandedMCPs.has(mcp.name)

              return (
                <div
                  key={mcp.name}
                  className={cn(
                    'border rounded-lg p-3 transition-colors',
                    mcp.enabled ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      {mcp.type === 'local' ? (
                        <Laptop className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Globe className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium text-sm">{mcp.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {mcp.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {mcp.toolCount} tools
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => toggleMCP(mcp.name)}>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {mcp.conditionalOn && (
                    <div className="mt-2">
                      <Badge variant="default" className="text-xs">
                        Active with {mcp.conditionalOn}
                      </Badge>
                    </div>
                  )}

                  {/* Expandable Tool List */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="space-y-2">
                        {mcp.tools.map((tool, idx) => (
                          <div key={`${tool.name}-${idx}`} className="flex items-start gap-2 text-xs">
                            <BadgeIcon className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{tool.name}</p>
                              {tool.description && (
                                <p className="text-muted-foreground mt-0.5">{tool.description}</p>
                              )}
                              {tool.category && (
                                <Badge variant="outline" className="mt-1 text-[10px] py-0">
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
        </ScrollArea>
      )}

      {/* Disabled MCPs (collapsed) */}
      {disabledMCPs.length > 0 && (
        <div className="pt-3 border-t border-border">
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground transition-colors">
              {disabledMCPs.length} inactive MCP{disabledMCPs.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-1">
              {disabledMCPs.map((mcp) => (
                <div key={mcp.name} className="flex items-center justify-between py-1">
                  <span>{mcp.name}</span>
                  {mcp.conditionalOn && (
                    <span className="text-[10px]">Requires {mcp.conditionalOn}</span>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Provider Context */}
      {data.provider && (
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Current provider: <span className="font-medium">{data.provider}</span>
        </div>
      )}
    </div>
  )
}
