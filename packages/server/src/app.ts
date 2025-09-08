import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ApiError, ErrorFactory } from '@promptliano/shared'
// Import consolidated routes
import { projectRoutes } from './routes/project-routes'
import { ticketRoutes } from './routes/ticket-routes'
import { chatRoutes } from './routes/chat-routes'
import { promptRoutes } from './routes/prompt-routes'
import { queueRoutes } from './routes/queue-routes'
import { providerKeyRoutes as consolidatedProviderKeyRoutes } from './routes/provider-key-routes'

// Manual routes (complex operations)
import { genAiRoutes } from './routes/gen-ai-routes'
import { flowRoutes } from './routes/flow-routes'
import { browseDirectoryRoutes } from './routes/browse-directory-routes'
import { mcpRoutes } from './routes/mcp'
import { gitRoutes } from './routes/git'
import { gitAdvancedRoutes } from './routes/git-advanced-routes'
import { projectTabRoutes } from './routes/project-tab-routes'
import { agentFilesRoutes } from './routes/agent-files-routes'
import { mcpInstallationRoutes } from './routes/mcp-installation-routes'
import { processManagementRoutes } from './routes/process-management-routes'
// import { mcpConfigRoutes } from './routes/mcp-config-routes-factory'
// Legacy provider key routes (supports /api/keys and /api/providers/health)
import { providerKeyRoutes as providerKeyLegacyRoutes } from './routes/provider-key-routes'
import { modelConfigRoutes } from './routes/model-config-routes'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import { ZodError } from 'zod'
import { fromError as zodFromError } from 'zod-validation-error'
import type { Context } from 'hono'
import packageJson from '../package.json'
import { getServerConfig, getRateLimitConfig } from '@promptliano/config'
import { rateLimiter } from 'hono-rate-limiter'

const serverConfig = getServerConfig()
const rateLimitConfig = getRateLimitConfig()

// Rate limit configuration
const RATE_LIMIT_ENABLED = rateLimitConfig.enabled
const RATE_LIMIT_WINDOW_MS = rateLimitConfig.windowMs
const RATE_LIMIT_MAX_REQUESTS = rateLimitConfig.maxRequests
const AI_RATE_LIMIT_WINDOW_MS = rateLimitConfig.aiWindowMs
const AI_RATE_LIMIT_MAX_REQUESTS = rateLimitConfig.aiMaxRequests
import { swaggerUI } from '@hono/swagger-ui'
import { ApiErrorResponseSchema } from '@promptliano/schemas'

// Helper to format Zod errors for more readable responses
const formatZodErrors = (error: z.ZodError) => {
  return error.flatten().fieldErrors
}

// Initialize the Hono app with default error handling for validation
export const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      console.error('Validation Error:', JSON.stringify(result.error.issues, null, 2))

      // Use ErrorFactory for consistent validation error handling
      const validationError = ErrorFactory.validationFailed(result.error)

      return c.json(
        {
          success: false,
          error: {
            message: validationError.message,
            code: validationError.code,
            details: validationError.details as Record<string, any> | undefined
          }
        } satisfies z.infer<typeof ApiErrorResponseSchema>,
        validationError.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
      )
    }
  }
})

// Add CORS middleware
app.use('*', cors(serverConfig.corsConfig))

// Add logger middleware
app.use('*', logger())

// Helper function to get client IP with better localhost detection
const getClientIP = (c: Context) => {
  // Check for forwarded headers first (production)
  const forwarded = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  if (forwarded) return forwarded

  // For local development with Hono/Bun, check common localhost patterns
  const host = c.req.header('host')
  if (host && (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1'))) {
    return 'localhost'
  }

  // Try to get IP from CF-Connecting-IP (Cloudflare) or similar headers
  const cfIP = c.req.header('cf-connecting-ip')
  if (cfIP) return cfIP

  // Default fallback
  return 'unknown'
}

// Initiator metadata middleware (audit-friendly, header echo)
app.use('*', async (c, next) => {
  await next()
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      const initiator = c.req.header('x-initiator') || c.req.header('x-user-id') || getClientIP(c)
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      c.header('X-Initiator', initiator || 'unknown')
      c.header('X-Request-Id', requestId)
      // Lightweight server-side log for traceability
      console.log(`[Initiator] ${c.req.method} ${c.req.path} by ${initiator} (reqId=${requestId})`)
    }
  } catch {
    // Do not block response on metadata issues
  }
})

// General rate limiter - 500 requests per 15 minutes per IP
const generalLimiter = rateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-6', // Return rate limit info in headers
  keyGenerator: getClientIP,
  handler: (c) => {
    // Use ErrorFactory for consistent rate limit error handling
    const rateLimitError = ErrorFactory.rateLimitExceeded(
      RATE_LIMIT_MAX_REQUESTS,
      `${RATE_LIMIT_WINDOW_MS / 1000 / 60} minutes`,
      Math.floor(RATE_LIMIT_WINDOW_MS / 1000)
    )

    const rateLimitDetails = (rateLimitError.details as Record<string, any>) || {}
    return c.json(
      {
        success: false,
        error: {
          message: rateLimitError.message,
          code: rateLimitError.code,
          details: {
            ...rateLimitDetails,
            resetAt: Date.now() + RATE_LIMIT_WINDOW_MS
          }
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>,
      rateLimitError.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
    )
  }
})

// Stricter AI rate limiter - 100 requests per 10 minutes per IP
const aiLimiter = rateLimiter({
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  limit: AI_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-6',
  keyGenerator: getClientIP,
  handler: (c) => {
    // Use ErrorFactory for consistent AI rate limit error handling
    const aiRateLimitError = ErrorFactory.rateLimitExceeded(
      AI_RATE_LIMIT_MAX_REQUESTS,
      `${AI_RATE_LIMIT_WINDOW_MS / 1000 / 60} minutes`,
      Math.floor(AI_RATE_LIMIT_WINDOW_MS / 1000)
    )

    const aiRateLimitDetails = (aiRateLimitError.details as Record<string, any>) || {}
    return c.json(
      {
        success: false,
        error: {
          message: `AI endpoint ${aiRateLimitError.message.toLowerCase()}`,
          code: `AI_${aiRateLimitError.code}`,
          details: {
            ...aiRateLimitDetails,
            resetAt: Date.now() + AI_RATE_LIMIT_WINDOW_MS
          }
        }
      } satisfies z.infer<typeof ApiErrorResponseSchema>,
      aiRateLimitError.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
    )
  }
})

// Apply rate limiters only if enabled
if (RATE_LIMIT_ENABLED) {
  console.log(
    `[Server] Rate limiting enabled - General: ${RATE_LIMIT_MAX_REQUESTS}/${RATE_LIMIT_WINDOW_MS}ms, AI: ${AI_RATE_LIMIT_MAX_REQUESTS}/${AI_RATE_LIMIT_WINDOW_MS}ms`
  )

  // Apply general rate limiter to all routes
  app.use('*', generalLimiter)

  // Apply stricter AI rate limiter to AI-intensive endpoints
  app.use('/api/gen-ai/*', aiLimiter)
  app.use('/api/chats/*', aiLimiter)
  app.use('/api/projects/*/suggest-files', aiLimiter)
  app.use('/api/projects/*/optimize-input', aiLimiter)
  app.use('/api/projects/*/mcp/suggest-files', aiLimiter)
  app.use('/api/projects/*/mcp/compact-summary', aiLimiter)
  app.use('/api/projects/*/files/*/summarize', aiLimiter)
  app.use('/api/tickets/*/suggest-tasks', aiLimiter)
  app.use('/api/tickets/*/suggest-files', aiLimiter)
  app.use('/api/tickets/*/auto-generate-tasks', aiLimiter)
  app.use('/api/projects/*/suggest-agents', aiLimiter)
  app.use('/api/projects/*/commands/suggest', aiLimiter)
} else {
  console.log('[Server] Rate limiting disabled in development mode')
}

// Add specific MCP route debugging
app.use('/api/mcp*', async (c, next) => {
  console.log(`[MCP Debug] ${c.req.method} ${c.req.path}`)
  await next()
  console.log(`[MCP Debug] Response status: ${c.res.status}`)
})

app.use('/api/projects/*/mcp*', async (c, next) => {
  console.log(`[MCP Debug] ${c.req.method} ${c.req.path}`)
  await next()
  console.log(`[MCP Debug] Response status: ${c.res.status}`)
})

app.get('/api/health', (c) => c.json({ success: true }))

// OpenAPI schema debug endpoint to find undefined/mis-imported schemas fast
app.get('/api/_openapi-debug', async (c) => {
  try {
    const Schemas = await import('@promptliano/schemas')
    const toCheck: Record<string, any> = {
      // Entity-level (generated routes)
      ProjectSchema: (Schemas as any).ProjectSchema,
      CreateProjectSchema: (Schemas as any).CreateProjectSchema,
      UpdateProjectSchema: (Schemas as any).UpdateProjectSchema,
      ProjectIdParamsSchema: (Schemas as any).ProjectIdParamsSchema,

      TicketSchema: (Schemas as any).TicketSchema,
      CreateTicketSchema: (Schemas as any).CreateTicketSchema,
      UpdateTicketSchema: (Schemas as any).UpdateTicketSchema,
      TicketIdParamsSchema: (Schemas as any).TicketIdParamsSchema,

      TicketTaskSchema: (Schemas as any).TicketTaskSchema,
      CreateTicketTaskSchema: (Schemas as any).CreateTicketTaskSchema,
      UpdateTicketTaskSchema: (Schemas as any).UpdateTicketTaskSchema,

      ChatSchema: (Schemas as any).ChatSchema,
      CreateChatSchema: (Schemas as any).CreateChatSchema,
      UpdateChatSchema: (Schemas as any).UpdateChatSchema,
      ChatIdParamsSchema: (Schemas as any).ChatIdParamsSchema,

      ChatMessageSchema: (Schemas as any).ChatMessageSchema,
      CreateChatMessageSchema: (Schemas as any).CreateChatMessageSchema,
      UpdateChatMessageSchema: (Schemas as any).UpdateChatMessageSchema,
      ChatMessageIdParamsSchema: (Schemas as any).ChatMessageIdParamsSchema,

      PromptSchema: (Schemas as any).PromptSchema,
      CreatePromptSchema: (Schemas as any).CreatePromptSchema,
      UpdatePromptSchema: (Schemas as any).UpdatePromptSchema,

      QueueSchema: (Schemas as any).QueueSchema,
      CreateQueueSchema: (Schemas as any).CreateQueueSchema,
      UpdateQueueSchema: (Schemas as any).UpdateQueueSchema,
      QueueIdParamsSchema: (Schemas as any).QueueIdParamsSchema,

      QueueItemSchema: (Schemas as any).QueueItemSchema,
      CreateQueueItemSchema: (Schemas as any).CreateQueueItemSchema,
      UpdateQueueItemSchema: (Schemas as any).UpdateQueueItemSchema,
      QueueItemIdParamsSchema: (Schemas as any).QueueItemIdParamsSchema,

      FileSchema: (Schemas as any).FileSchema,
      CreateFileSchema: (Schemas as any).CreateFileSchema,
      UpdateFileSchema: (Schemas as any).UpdateFileSchema,
      FileIdParamsSchema: (Schemas as any).FileIdParamsSchema,

      ProviderKeySchema: (Schemas as any).ProviderKeySchema,
      CreateProviderKeySchema: (Schemas as any).CreateProviderKeySchema,
      UpdateProviderKeySchema: (Schemas as any).UpdateProviderKeySchema,

      // ActiveTab schemas removed (frontend only)

      SelectedFileSchema: (Schemas as any).SelectedFileSchema,
      CreateSelectedFileSchema: (Schemas as any).CreateSelectedFileSchema,
      UpdateSelectedFileSchema: (Schemas as any).UpdateSelectedFileSchema,
      SelectedFileIdParamsSchema: (Schemas as any).SelectedFileIdParamsSchema,

      // Custom response schemas commonly used by generated routes
      FileListResponseSchema: (Schemas as any).FileListResponseSchema,
      ProjectSummaryResponseSchema: (Schemas as any).ProjectSummaryResponseSchema,
      SuggestFilesBodySchema: (Schemas as any).SuggestFilesBodySchema,
      SuggestFilesResponseSchema: (Schemas as any).SuggestFilesResponseSchema,
      TaskListResponseSchema: (Schemas as any).TaskListResponseSchema,
      ChatMessageResponseSchema: (Schemas as any).ChatMessageResponseSchema,
      ChatMessageListResponseSchema: (Schemas as any).ChatMessageListResponseSchema,
      QueueItemCreateSchema: (Schemas as any).QueueItemCreateSchema,
      QueueItemResponseSchema: (Schemas as any).QueueItemResponseSchema,
      QueueStatsResponseSchema: (Schemas as any).QueueStatsResponseSchema,
      OptimizePromptResponseSchema: (Schemas as any).OptimizePromptResponseSchema
    }

    const report = Object.fromEntries(
      Object.entries(toCheck).map(([k, v]) => [
        k,
        {
          defined: v !== undefined && v !== null,
          type: typeof v,
          has_def: !!(v && (v as any).def),
          has__def: !!(v && (v as any)._def),
          has_openapi: !!(v && (v as any).openapi)
        }
      ])
    )

    return c.json({ success: true, data: report })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || String(e) }, 500)
  }
})

// Register manual CRUD routes
app.route('/', projectRoutes)
app.route('/', ticketRoutes)
app.route('/', chatRoutes)
app.route('/', promptRoutes)
app.route('/', queueRoutes)
app.route('/', consolidatedProviderKeyRoutes)

// Register legacy provider key routes for backward compatibility
app.route('/', providerKeyLegacyRoutes)

// Register MCP config routes
// app.route('/', mcpConfigRoutes)
app.route('/', modelConfigRoutes) // Model configuration and presets

// KEEP: Complex operations that don't conflict
app.route('/', flowRoutes)
app.route('/', genAiRoutes)
app.route('/', browseDirectoryRoutes)
app.route('/', mcpRoutes)
app.route('/', gitRoutes)
app.route('/', gitAdvancedRoutes)
app.route('/', projectTabRoutes)
app.route('/', agentFilesRoutes)
app.route('/', mcpInstallationRoutes)
app.route('/', processManagementRoutes)

// NOTE: These route files have been replaced by generated routes:
// - chatRoutes -> /api/chats CRUD via generated routes
// - projectRoutes -> /api/projects CRUD via generated routes
// - providerKeyRoutes -> /api/providerkeys CRUD via generated routes
// - promptRoutes -> /api/prompts CRUD via generated routes
// - ticketRoutes -> /api/tickets CRUD via generated routes
// - queueRoutes -> /api/queues CRUD via generated routes
// - activeTabRoutes removed (frontend-only tabs)

// Global error handler with ErrorFactory integration
app.onError((err, c) => {
  console.error('[ErrorHandler]', err)

  // Use ErrorFactory.wrap to handle all error types consistently
  const apiError = ErrorFactory.wrap(err, 'Global error handler')

  console.error(`[ErrorHandler] Processed Error: ${apiError.status} - ${apiError.code} - ${apiError.message}`)

  const responseBody: z.infer<typeof ApiErrorResponseSchema> = {
    success: false,
    error: {
      message: apiError.message,
      code: apiError.code,
      details: apiError.details as Record<string, any> | undefined
    }
  }

  return c.json(responseBody, apiError.status as 400 | 401 | 403 | 404 | 409 | 422 | 500)
})

// Serve Swagger UI at /swagger and robust OpenAPI JSON at /doc
app.get('/swagger', swaggerUI({ url: '/doc' }))

app.get('/doc', async (c) => {
  const isDevelopment = process.env.NODE_ENV !== 'production'

  // Helper: format Zod issues consistently
  const formatZodIssues = (err: unknown) => {
    try {
      const zerr = err instanceof ZodError ? err : null
      if (!zerr) return undefined
      return zerr.issues.map((issue) => ({
        path: issue.path.join('.') || 'root',
        message: issue.message,
        code: (issue as any).code,
        received: isDevelopment ? (issue as any).received : undefined
      }))
    } catch {
      return undefined
    }
  }

  // Helper: heuristics to provide actionable hints
  const diagnose = (e: any) => {
    const msg = String(e?.message || e)
    const hints: string[] = []
    if (/"def" in schema|schema is not an Object/i.test(msg)) {
      hints.push(
        'A route likely passed a non-OpenAPI Zod schema. Ensure routes import z from @hono/zod-openapi, not zod.'
      )
    }
    if (/Missing parameter data/i.test(msg)) {
      hints.push('For transformed/refined query params, set openapi.param { name, in: "query" } on the field.')
    }
    return hints.length ? hints : undefined
  }

  // Build docs in isolation and skip failing groups with diagnostics
  const finalApp = new OpenAPIHono()
  const buildLog: Record<string, { ok: boolean; error?: string; stack?: string; zodIssues?: any; hints?: string[] }> =
    {}

  function tryRegister(label: string, registerTo: (app: OpenAPIHono) => void) {
    // Probe registration in isolation
    const probe = new OpenAPIHono()
    try {
      registerTo(probe)
      probe.getOpenAPI31Document({ openapi: '3.1.1', info: { title: 'probe', version: '0' } })
      buildLog[label] = { ok: true }
      // Only add to the final app if probe succeeded
      registerTo(finalApp)
    } catch (e: any) {
      const zodIssues = formatZodIssues(e)
      const hints = diagnose(e)
      const stack = isDevelopment ? e?.stack || undefined : undefined
      console.error('[OpenAPI Doc] Group error', {
        group: label,
        message: e?.message || String(e),
        path: c.req.path,
        method: c.req.method,
        timestamp: new Date().toISOString(),
        zodIssues,
        hints
      })
      buildLog[label] = {
        ok: false,
        error: e?.message || String(e),
        stack,
        zodIssues,
        hints
      }
    }
  }

  // Register manual routes for OpenAPI documentation
  tryRegister('Projects', (a) => a.route('/', projectRoutes))
  tryRegister('Tickets', (a) => a.route('/', ticketRoutes))
  tryRegister('Chats', (a) => a.route('/', chatRoutes))
  tryRegister('Prompts', (a) => a.route('/', promptRoutes))
  tryRegister('Queues', (a) => a.route('/', queueRoutes))
  tryRegister('ProviderKeys', (a) => a.route('/', consolidatedProviderKeyRoutes))
  tryRegister('providerKeyLegacyRoutes', (a) => a.route('/', providerKeyLegacyRoutes))
  tryRegister('genAiRoutes', (a) => a.route('/', genAiRoutes))
  tryRegister('flowRoutes', (a) => a.route('/', flowRoutes))
  tryRegister('browseDirectoryRoutes', (a) => a.route('/', browseDirectoryRoutes))
  tryRegister('mcpRoutes', (a) => a.route('/', mcpRoutes))
  tryRegister('gitRoutes', (a) => a.route('/', gitRoutes))
  tryRegister('gitAdvancedRoutes', (a) => a.route('/', gitAdvancedRoutes))
  tryRegister('projectTabRoutes', (a) => a.route('/', projectTabRoutes))
  tryRegister('agentFilesRoutes', (a) => a.route('/', agentFilesRoutes))
  tryRegister('mcpInstallationRoutes', (a) => a.route('/', mcpInstallationRoutes))
  tryRegister('processManagementRoutes', (a) => a.route('/', processManagementRoutes))
  // tryRegister('mcpConfigRoutes', (a) => a.route('/', mcpConfigRoutes)) // TODO: Define mcpConfigRoutes or remove
  tryRegister('modelConfigRoutes', (a) => a.route('/', modelConfigRoutes))

  try {
    const doc = finalApp.getOpenAPI31Document({
      openapi: '3.1.1',
      info: {
        description: 'Promptliano OpenAPI Server Spec',
        version: packageJson.version,
        title: packageJson.name
      }
    })
    // Attach diagnostics under an extension field
    ;(doc as any)['x-doc-build'] = buildLog
    return c.json(doc)
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : String(err)
    const zodIssues = formatZodIssues(err)
    const zodReadable = err instanceof ZodError ? zodFromError(err).toString() : undefined
    const hints = diagnose(err)

    const payload: any = {
      openapi: '3.1.1',
      info: {
        description: 'Promptliano OpenAPI Server Spec (generation error)',
        version: packageJson.version,
        title: packageJson.name
      },
      paths: {},
      error: {
        message,
        code: 'OPENAPI_GENERATION_FAILED',
        ...(isDevelopment && { stack: err?.stack })
      },
      'x-doc-build': buildLog,
      ...(zodIssues && { zodIssues }),
      ...(zodReadable && { zod: zodReadable }),
      ...(hints && { hints })
    }

    return c.json(payload, 500)
  }
})

// Manual routes are registered directly above, no async registration needed
