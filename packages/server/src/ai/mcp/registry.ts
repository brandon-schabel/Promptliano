import { experimental_createMCPClient, tool, type Tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { createRequire } from 'module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const loadStdioClientTransport = () => {
  const candidates = [
    '@modelcontextprotocol/sdk/client/stdio',
    '@modelcontextprotocol/sdk/client/stdio.js',
    '@modelcontextprotocol/sdk/dist/esm/client/stdio.js',
    '@modelcontextprotocol/sdk/dist/client/stdio.js',
    '@modelcontextprotocol/sdk/dist/cjs/client/stdio.js'
  ]

  for (const candidate of candidates) {
    try {
      const mod = require(candidate) as { StdioClientTransport?: new (options: { command: string; args: string[] }) => any }
      if (mod?.StdioClientTransport) {
        return mod.StdioClientTransport
      }
    } catch (error) {
      // Ignore resolution errors and try next candidate
    }
  }

  throw new Error('Failed to load MCP StdioClientTransport from @modelcontextprotocol/sdk')
}

const StdioClientTransport = loadStdioClientTransport() as new (options: {
  command: string
  args?: string[]
  cwd?: string
}) => any

export interface McpToolSuite {
  tools: ToolSet
  cleanup: () => Promise<void>
  metadata: Array<{ name: string; description?: string }>
}

export interface McpSuiteOptions {
  enablePromptliano?: boolean
  enableChromeDevtools?: boolean
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const serverRoot = join(moduleDir, '..', '..', '..')
const promptlianoScript = join(serverRoot, 'mcp-start.sh')

type StdioServerConfig = { name: string; command: string; args?: string[]; cwd?: string }

function loadStdioServersFromEnv(): StdioServerConfig[] {
  const raw = process.env.MCP_STDIO_SERVERS
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => typeof entry?.name === 'string' && typeof entry?.command === 'string')
  } catch {
    console.warn('[MCP] Invalid MCP_STDIO_SERVERS JSON; ignoring.')
    return []
  }
}

export async function createMcpToolSuite(options: McpSuiteOptions = {}): Promise<McpToolSuite> {
  const enablePromptliano = options.enablePromptliano !== false
  const enableChromeDevtools = options.enableChromeDevtools !== false
  const clients: Array<{ close: () => Promise<void> }> = []
  const tools: ToolSet = {}
  const metadata: Array<{ name: string; description?: string }> = []

  if (enablePromptliano) {
    const promptlianoClient = await experimental_createMCPClient({
      transport: new StdioClientTransport({
        command: process.platform === 'win32' ? 'cmd' : 'sh',
        args: process.platform === 'win32' ? ['/c', promptlianoScript] : [promptlianoScript]
      })
    })

    clients.push({ close: () => promptlianoClient.close() })
    const promptlianoTools = await wrapMcpTools(promptlianoClient, metadata, 'promptliano')
    Object.assign(tools, promptlianoTools)
  }

  if (enableChromeDevtools) {
    const chromeDevtoolsCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    try {
      const chromeDevtoolsClient = await experimental_createMCPClient({
        transport: new StdioClientTransport({
          command: chromeDevtoolsCommand,
          args: ['chrome-devtools-mcp@latest']
        })
      })

      clients.push({ close: () => chromeDevtoolsClient.close() })
      const chromeDevtoolsTools = await wrapMcpTools(chromeDevtoolsClient, metadata, 'chrome-devtools')
      Object.assign(tools, chromeDevtoolsTools)
    } catch (error) {
      console.warn('[MCP] Failed to start chrome-devtools MCP server', error)
    }
  }

  for (const server of loadStdioServersFromEnv()) {
    try {
      const client = await experimental_createMCPClient({
        transport: new StdioClientTransport({
          command: server.command,
          args: server.args ?? [],
          cwd: server.cwd
        })
      })

      clients.push({ close: () => client.close() })
      const serverTools = await wrapMcpTools(client, metadata, server.name)
      Object.assign(tools, serverTools)
    } catch (error) {
      console.warn(`[MCP] Failed to start MCP stdio server "${server.name}"`, error)
    }
  }

  const cleanup = async () => {
    await Promise.allSettled(clients.map((client) => client.close()))
  }

  return { tools, cleanup, metadata }
}

type McpClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

async function wrapMcpTools(
  client: McpClient,
  metadata: Array<{ name: string; description?: string }>,
  prefix?: string
): Promise<ToolSet> {
  const mcpTools = await client.tools()
  const wrapped: ToolSet = {}

  if (Array.isArray(mcpTools)) {
    const callTool = (client as unknown as { callTool?: (input: { name: string; arguments: unknown }) => Promise<unknown> })
      .callTool

    for (const toolDef of mcpTools) {
      if (!toolDef?.name) continue
      const toolName = toolDef.name
      const publishedName = prefix ? `${prefix}:${toolName}` : toolName
      const schema = toolDef.inputSchema ? jsonSchemaToZod(toolDef.inputSchema) : z.any()

      metadata.push({ name: publishedName, description: toolDef.description })

      if (typeof callTool !== 'function') {
        // Without callTool we cannot invoke legacy definitions
        continue
      }

      wrapped[publishedName] = tool({
        description: toolDef.description ?? `MCP tool ${publishedName}`,
        inputSchema: schema,
        execute: async (args) => {
          const result = await callTool({
            name: toolName,
            arguments: args ?? {}
          })

          return normalizeMcpResult(result)
        }
      })
    }
  } else if (mcpTools && typeof mcpTools === 'object') {
    for (const [toolName, toolInstance] of Object.entries(mcpTools)) {
      if (!toolInstance) continue
      const typedTool = toolInstance as Tool<any, any>
      const publishedName = prefix ? `${prefix}:${toolName}` : toolName
      metadata.push({ name: publishedName, description: (typedTool as any).description })
      wrapped[publishedName] = typedTool
    }
  }

  return wrapped
}

function normalizeMcpResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result

  const payload = result as Record<string, unknown>
  if (Array.isArray(payload.content)) {
    const textParts = payload.content
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const text = (part as any).text
        return typeof text === 'string' ? text : ''
      })
      .filter(Boolean)

    if (textParts.length > 0) {
      return textParts.join('\n')
    }
  }

  return payload
}

function jsonSchemaToZod(_schema: unknown): z.ZodTypeAny {
  // TODO: Convert JSON Schema → Zod. For now fall back to accept-any schema so
  // MCP tools remain callable while we iterate on schema conversion.
  return z.any()
}
