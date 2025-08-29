import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ApiError, ErrorFactory } from '@promptliano/shared'
// Import generated routes
import { registerAllGeneratedRoutes } from './routes/generated/index.generated'
// Factory-migrated routes (Phase 4 & 5)
import { chatRoutes } from './routes/chat-routes-factory'
import { promptRoutes } from './routes/prompt-routes-factory'
import { ticketRoutes } from './routes/ticket-routes-factory'
import { providerKeyRoutes } from './routes/provider-key-routes-factory'
// Legacy provider key routes (supports /api/keys and /api/providers/health)
import { providerKeyRoutes as providerKeyLegacyRoutes } from './routes/provider-key-routes'
import { activeTabRoutes } from './routes/active-tab-routes-factory'

// Manual routes (complex operations)
import { genAiRoutes } from './routes/gen-ai-routes'
import { projectRoutes } from './routes/project-routes-factory'
import { flowRoutes } from './routes/flow-routes'
import { browseDirectoryRoutes } from './routes/browse-directory-routes'
import { mcpRoutes } from './routes/mcp'
import { gitRoutes } from './routes/git'
import { gitAdvancedRoutes } from './routes/git-advanced-routes'
import { projectTabRoutes } from './routes/project-tab-routes'
import { agentFilesRoutes } from './routes/agent-files-routes'
import { mcpInstallationRoutes } from './routes/mcp-installation-routes'
import { mcpConfigRoutes } from './routes/mcp-config-routes-factory'
import { OpenAPIHono, z } from '@hono/zod-openapi'
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

// Register generated routes (CRUD operations for all entities)
registerAllGeneratedRoutes(app)

// Register factory-migrated routes (standardized CRUD + custom operations)
app.route('/', chatRoutes)         // Factory: CRUD + fork operations  
app.route('/', promptRoutes)       // Factory: CRUD + file operations
app.route('/', ticketRoutes)       // Factory: CRUD + task operations
// Removed queueRoutes to enforce Flow-only queue API
app.route('/', providerKeyRoutes)  // Factory: CRUD + validation
// Register legacy provider key routes for backward compatibility with clients
// expecting /api/keys and /api/providers/health endpoints
app.route('/', providerKeyLegacyRoutes)
app.route('/', activeTabRoutes)           // Factory: Get/Set/Clear operations (/api/active-tab)
app.route('/', projectRoutes)      // Factory: CRUD + sync, files, summary operations
app.route('/', mcpConfigRoutes)    // Factory: Global + project MCP config

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


// NOTE: These route files have been replaced by generated routes:
// - chatRoutes -> /api/chats CRUD via generated routes
// - projectRoutes -> /api/projects CRUD via generated routes
// - providerKeyRoutes -> /api/providerkeys CRUD via generated routes
// - promptRoutes -> /api/prompts CRUD via generated routes
// - ticketRoutes -> /api/tickets CRUD via generated routes
// - queueRoutes -> /api/queues CRUD via generated routes
// - claudeAgentRoutes -> /api/claudeagents CRUD via generated routes
// - claudeCommandRoutes -> /api/claudecommands CRUD via generated routes
// - activeTabRoutes -> /api/activetabs CRUD via generated routes

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

// server swagger ui at /swagger
app.get('/swagger', swaggerUI({ url: '/doc' }))

app.doc('/doc', {
  openapi: '3.1.1',
  info: {
    description: 'Promptliano OpenAPI Server Spec',
    version: packageJson.version,
    title: packageJson.name
  }
})
