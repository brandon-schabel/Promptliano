import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'
import { CONSOLIDATED_TOOLS, getConsolidatedToolByName } from './tools'
import { listResources, readResource } from './resources'
import { createMCPError, formatMCPErrorResponse, MCPError, MCPErrorCode } from './mcp-errors'
import type { MCPToolDefinition } from './tools-registry'
import { z } from 'zod'

const LooseCallToolRequestSchema = z
  .object({
    method: z.literal('tools/call'),
    params: z
      .object({
        name: z.string(),
        arguments: z.any().optional()
      })
      .passthrough()
  })
  .passthrough()

function parseProjectScope(): number | null {
  const raw = process.env.PROMPTLIANO_PROJECT_ID
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function resolveProjectIdArg(args: Record<string, unknown> | undefined, fallback: number | null): number | undefined {
  if (args && typeof args.projectId === 'number') {
    return args.projectId
  }
  return fallback ?? undefined
}

export function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'promptliano-mcp',
      version: '0.11.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = CONSOLIDATED_TOOLS.map((tool: MCPToolDefinition) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))

    return { tools }
  })

  server.setRequestHandler(LooseCallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    console.error('[MCP] Received tools/call request', { name, args })
    const tool = getConsolidatedToolByName(name)

    if (!tool) {
      const error = createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown tool: ${name}`, { tool: name })
      return await formatMCPErrorResponse(error)
    }

    const scopeProjectId = parseProjectScope()
    const effectiveProjectId = resolveProjectIdArg(args as Record<string, unknown> | undefined, scopeProjectId)
    const normalizedArgs = ((args as Record<string, unknown>) || {}) as Record<string, unknown>
    if (effectiveProjectId !== undefined && normalizedArgs.projectId === undefined) {
      normalizedArgs.projectId = effectiveProjectId
    }
    const start = Date.now()
    console.error(`[MCP] → tools/call ${name}`)

    try {
      const result = await tool.handler(normalizedArgs, effectiveProjectId)
      console.error(`[MCP] ← tools/call ${name} (${Date.now() - start}ms)`)
      return result
    } catch (error) {
      console.error(`[MCP] ✕ tools/call ${name}:`, error)
      const formatted = await formatMCPErrorResponse(
        error instanceof MCPError ? error : MCPError.fromError(error, { tool: name, projectId: effectiveProjectId })
      )
      return formatted
    }
  })

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const projectId = parseProjectScope()
      const resources = await listResources(projectId)
      return { resources }
    } catch (error) {
      console.error('[MCP] Error listing resources:', error)
      return { resources: [] }
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const projectId = parseProjectScope()
    try {
      return await readResource(request.params.uri, projectId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Resource read failed: ${message}`)
    }
  })

  return server
}
