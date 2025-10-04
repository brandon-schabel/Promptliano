// MCP Active Tools API Routes
// Provides information about active MCP servers and their tools

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { mcpService } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import type { APIProviders } from '@promptliano/database'

// Define Groq remote MCP tools based on Groq documentation
const GROQ_REMOTE_TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web using Parallel AI web search MCP',
    category: 'search'
  },
  {
    name: 'web_scrape',
    description: 'Extract content from websites using Firecrawl MCP',
    category: 'extraction'
  },
  {
    name: 'stripe_invoice',
    description: 'Create and manage Stripe invoices',
    category: 'payment'
  },
  {
    name: 'stripe_payment',
    description: 'Process payments through Stripe',
    category: 'payment'
  },
  {
    name: 'web_fetch',
    description: 'Fetch and analyze web page content',
    category: 'extraction'
  }
]

// Schemas
const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional()
})

const MCPServerInfoSchema = z.object({
  name: z.string(),
  type: z.enum(['local', 'remote']),
  enabled: z.boolean(),
  toolCount: z.number(),
  tools: z.array(MCPToolSchema),
  conditionalOn: z.string().optional()
})

const ActiveMCPToolsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      mcps: z.array(MCPServerInfoSchema),
      totalTools: z.number(),
      provider: z.string().optional()
    })
  })
  .openapi('ActiveMCPToolsResponse')

const ActiveMCPToolsQuerySchema = z.object({
  projectId: z.coerce.number().optional(),
  provider: z.string().optional()
})

// Helper function to handle ApiError responses consistently
const handleApiError = (error: unknown, c: any) => {
  console.error('[MCPToolsRoutes] Error:', error)
  if (error instanceof ApiError) {
    return c.json(
      { success: false, error: { message: error.message, code: error.code, details: error.details } },
      error.status
    )
  }
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  console.error('[MCPToolsRoutes] Internal error:', errorMessage)
  return c.json(
    { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR', details: errorMessage } },
    500
  )
}

// Routes
const getActiveMCPToolsRoute = createRoute({
  method: 'get',
  path: '/api/mcp/active-tools',
  request: {
    query: ActiveMCPToolsQuerySchema
  },
  responses: createStandardResponses(ActiveMCPToolsResponseSchema),
  tags: ['MCP Tools'],
  description:
    'Get active MCP servers and their tools, including conditional Groq remote MCP based on provider selection'
})

// Handlers
export const mcpToolsRoutes = new OpenAPIHono().openapi(getActiveMCPToolsRoute, async (c) => {
  try {
    const { projectId, provider } = c.req.valid('query')

    const mcps: z.infer<typeof MCPServerInfoSchema>[] = []
    let totalTools = 0

    // Always include Promptliano MCP (local)
    const promptlianoMCP = {
      name: 'Promptliano',
      type: 'local' as const,
      enabled: true,
      toolCount: 12, // Approximate count of Promptliano MCP tools
      tools: [
        { name: 'mcp__promptliano__project_manager', description: 'Manage projects and files' },
        { name: 'mcp__promptliano__flow_manager', description: 'Manage workflows, tickets, and queues' },
        { name: 'mcp__promptliano__prompt_manager', description: 'Manage prompts' },
        { name: 'mcp__promptliano__ai_assistant', description: 'AI-powered development assistance' },
        { name: 'mcp__promptliano__git_manager', description: 'Git operations' },
        { name: 'mcp__promptliano__queue_manager', description: 'Queue management' },
        { name: 'mcp__promptliano__task_manager', description: 'Task management' },
        { name: 'mcp__promptliano__ticket_manager', description: 'Ticket management' },
        { name: 'mcp__promptliano__queue_processor', description: 'Queue processing' },
        { name: 'mcp__promptliano__database_manager', description: 'Database operations' },
        { name: 'mcp__promptliano__mcp_manager', description: 'MCP server management' },
        { name: 'mcp__promptliano__service_architect', description: 'Service architecture' }
      ]
    }
    mcps.push(promptlianoMCP)
    totalTools += promptlianoMCP.toolCount

    // Include Chrome DevTools MCP if available
    // Note: In production, this would check if Chrome DevTools MCP is actually configured
    const chromeDevToolsMCP = {
      name: 'Chrome DevTools',
      type: 'local' as const,
      enabled: true,
      toolCount: 8,
      tools: [
        { name: 'mcp__chrome-devtools__take_snapshot', description: 'Take page snapshot', category: 'browser' },
        { name: 'mcp__chrome-devtools__click', description: 'Click element', category: 'browser' },
        { name: 'mcp__chrome-devtools__fill', description: 'Fill form field', category: 'browser' },
        { name: 'mcp__chrome-devtools__navigate_page', description: 'Navigate to URL', category: 'browser' },
        {
          name: 'mcp__chrome-devtools__list_console_messages',
          description: 'Get console messages',
          category: 'browser'
        },
        { name: 'mcp__chrome-devtools__evaluate_script', description: 'Execute JavaScript', category: 'browser' },
        {
          name: 'mcp__chrome-devtools__list_network_requests',
          description: 'Get network requests',
          category: 'browser'
        },
        { name: 'mcp__chrome-devtools__take_screenshot', description: 'Take screenshot', category: 'browser' }
      ]
    }
    mcps.push(chromeDevToolsMCP)
    totalTools += chromeDevToolsMCP.toolCount

    // Conditionally include Groq remote MCP if provider is 'groq'
    if (provider?.toLowerCase() === 'groq') {
      const groqMCP = {
        name: 'Groq',
        type: 'remote' as const,
        enabled: true,
        toolCount: GROQ_REMOTE_TOOLS.length,
        tools: GROQ_REMOTE_TOOLS,
        conditionalOn: 'groq-provider'
      }
      mcps.push(groqMCP)
      totalTools += groqMCP.toolCount
    } else {
      // Include Groq MCP as disabled when not using Groq provider
      const groqMCP = {
        name: 'Groq',
        type: 'remote' as const,
        enabled: false,
        toolCount: GROQ_REMOTE_TOOLS.length,
        tools: GROQ_REMOTE_TOOLS,
        conditionalOn: 'groq-provider'
      }
      mcps.push(groqMCP)
    }

    // If projectId is provided, fetch project-specific MCP tools
    if (projectId) {
      try {
        const projectTools = await mcpService.listTools(projectId)
        // Note: These would override or augment the default tools list
        // For now, we use the static lists above
        console.log(`[MCPToolsRoutes] Project ${projectId} has ${projectTools.length} additional tools`)
      } catch (error) {
        console.warn(`[MCPToolsRoutes] Failed to fetch project-specific tools:`, error)
        // Continue with default tools
      }
    }

    return c.json(
      successResponse({
        mcps,
        totalTools,
        provider
      })
    )
  } catch (error) {
    return handleApiError(error, c)
  }
})
