import { serve } from 'bun'
import type { ServerWebSocket } from 'bun'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import { app } from './src/app'

import { listProjects, createLogger } from '@promptliano/services'
import { getServerConfig } from '@promptliano/config'
import { watchersManager, createCleanupService } from '@promptliano/services'
import { runMigrations, initializeModelConfigs, getDatabasePath } from '@promptliano/database'

interface WebSocketData {
  clientId: string
  projectId?: number
  subscriptions?: Set<string>
}

const logger = createLogger('Server')

const serverConfig = getServerConfig()

if (process.env.PROMPTLIANO_DEBUG_STREAM === 'true') {
  const baseFetch = globalThis.fetch.bind(globalThis)
  const debugFetch = (async function fetchWithDebug(
    input: Request | URL | string,
    init?: RequestInit
  ): Promise<Response> {
    const method = input instanceof Request ? input.method : init?.method ?? 'GET'
    const url = input instanceof Request ? input.url : input.toString()
    try {
      console.debug('[AI fetch] →', method, url)
      const response = await baseFetch(input as any, init)
      const contentType = response.headers.get('content-type') ?? 'unknown'
      console.debug('[AI fetch] ←', response.status, url, contentType)

      if (
        url.includes('openrouter.ai/api') &&
        response.status === 200 &&
        contentType.includes('text/html')
      ) {
        const bodyText = await response.text()
        console.warn(
          '[AI fetch] OpenRouter returned HTML response; ensure OPENROUTER_SITE_URL points to a publicly accessible URL. '
        )
        return new Response(
          JSON.stringify({
            error: {
              message:
                'OpenRouter returned HTML instead of JSON. Update OPENROUTER_SITE_URL and OPENROUTER_APP_TITLE to public values.',
              detail: bodyText.slice(0, 200)
            }
          }),
          {
            status: 502,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      return response
    } catch (error) {
      console.error('[AI fetch] ✖', url, error)
      throw error
    }
  }) as typeof fetch

  Object.assign(debugFetch, baseFetch)
  globalThis.fetch = debugFetch
}

// Use the imported watchersManager, remove the local creation
// export const watchersManager = createWatchersManager();
const cleanupService = createCleanupService({
  intervalMs: 5 * 60 * 1000
})

// in dev client dist is relative to the server file so it would be server/client-dist
// in build it is relative to the root so it would be dist/client-dist
const CLIENT_PATH = serverConfig.isDevEnv ? join(import.meta.dir, 'client-dist') : './client-dist'

type ServerConfig = {
  port?: number
}

type Server = ReturnType<typeof serve>

export async function instantiateServer({
  port = Number(serverConfig.serverPort)
}: ServerConfig = {}): Promise<Server> {
  logger.info(`Starting server initialization on port ${port}...`)
  // Log database location as early as possible for debugging
  try {
    const earlyDbPath = getDatabasePath()
    logger.info(`Database location (pre-migration): ${earlyDbPath === ':memory:' ? 'in-memory' : earlyDbPath}`)
  } catch (e) {
    logger.warn('Unable to determine database path before migrations', e)
  }
  // Ensure database schema is up-to-date before serving requests or starting watchers
  try {
    await runMigrations()
    logger.info('Database migrations completed')

    // Initialize model presets and log specifics
    const initResult = await initializeModelConfigs({ forceReset: serverConfig.isDevEnv })
    switch (initResult.status) {
      case 'seeded':
        logger.info(
          `Model presets seeded (${initResult.configsInserted} configs, ${initResult.presetsInserted} presets)`
        )
        break
      case 'skipped_existing':
        logger.info('Model presets present; skipping seeding')
        break
      case 'skipped_missing_tables':
        logger.warn(`Model presets skipped: ${initResult.reason}`)
        break
      case 'skipped_error':
        logger.error(`Model presets initialization failed: ${initResult.reason}`)
        break
    }
    // Log database location for visibility
    const dbPath = getDatabasePath()
    logger.info(`Database location: ${dbPath === ':memory:' ? 'in-memory' : dbPath}`)
  } catch (error) {
    logger.error('Database migration failed during server startup', error)
  }
  const server = serve({
    // idleTimeout of 255 seconds (4.25 minutes) to support long-running operations
    // like asset generation which can take up to 3 minutes
    idleTimeout: 255,
    port,
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url)

      if (url.pathname === '/') {
        return new Response(Bun.file(join(CLIENT_PATH, 'index.html')))
      }

      if (url.pathname === '/ws') {
        const clientId = crypto.randomUUID()
        const upgraded: boolean = server.upgrade(req, { data: { clientId } })
        if (upgraded) {
          // Return a dummy response that won't be used since the connection is upgraded
          return new Response(null, { status: 101 })
        }
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      // FIXED: Always return API responses for API routes, regardless of status code
      if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
        logger.debug(`Routing ${req.method} ${url.pathname} to Hono app`)
        const response = await app.fetch(req)
        logger.debug(`Hono response status: ${response.status}`)
        return response
      }

      const isStaticFile = /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname)
      if (isStaticFile) {
        return serveStatic(url.pathname)
      }

      // For non-API routes, try Hono first, then fallback to frontend
      const honoResponse = await app.fetch(req)
      if (honoResponse && honoResponse.status !== 404) {
        return honoResponse
      }

      const frontendEnpoints = ['/projects', '/chat']
      if (frontendEnpoints.includes(url.pathname)) {
        return serveStatic('index.html')
      }

      return serveStatic('index.html')
    }

    // WebSocket functionality temporarily disabled after job queue removal
    // TODO: Implement WebSocket management without job queue dependency
    // websocket: {
    //   async open(ws: ServerWebSocket<WebSocketData>) {
    //     // TODO: Implement WebSocket client management
    //   },
    //   close(ws: ServerWebSocket<WebSocketData>) {
    //     // TODO: Implement WebSocket cleanup
    //   },
    //   async message(ws: ServerWebSocket<WebSocketData>, rawMessage: string | Buffer) {
    //     // TODO: Implement WebSocket message handling
    //   }
    // }
  })

  // Start watchers for existing projects
  ;(async () => {
    logger.info('Starting project watchers...')
    try {
      const allProjects = await listProjects()
      logger.info(`Found ${allProjects.length} projects to watch`)
      for (const project of allProjects) {
        // TODO: this seems to slow down server startup sometimes, so this this should be done async/in a different process
        watchersManager.startWatchingProject(project, ['node_modules', 'dist', '.git', '*.tmp', '*.db-journal'])
      }
      logger.info('Project watchers started')
    } catch (error) {
      logger.error('Error starting project watchers', error)
    }

    cleanupService.start()
  })()

  logger.info(`Server running at http://${serverConfig.host}:${server.port}`)
  logger.info(`Server swagger at http://${serverConfig.host}:${server.port}/swagger`)
  logger.info(`Server docs at http://${serverConfig.host}:${server.port}/doc`)
  // Helpful developer links
  const inspectorClientPort = Number(process.env.MCP_INSPECTOR_CLIENT_PORT || process.env.CLIENT_PORT) || 6274
  const inspectorServerPort = Number(process.env.MCP_INSPECTOR_SERVER_PORT) || 6277
  const drizzlePort = Number(process.env.DRIZZLE_STUDIO_PORT) || 4983
  logger.info(`MCP Inspector UI (if running): http://localhost:${inspectorClientPort}`)
  logger.info(`MCP Inspector Proxy (if running): http://localhost:${inspectorServerPort}`)
  logger.info(`Drizzle Studio (if running): http://localhost:${drizzlePort}`)

  // Flush stdout to ensure output is visible
  if (process.stdout.isTTY) {
    process.stdout.write('')
  }

  return server
}

function serveStatic(path: string): Response {
  try {
    const filePath = join(CLIENT_PATH, path)
    const stat = statSync(filePath)
    if (stat.isFile()) {
      return new Response(Bun.file(filePath))
    }
    return new Response(Bun.file(join(CLIENT_PATH, 'index.html')))
  } catch {
    return new Response(Bun.file(join(CLIENT_PATH, 'index.html')))
  }
}

if (import.meta.main) {
  ;(async () => {
    // Parse command line arguments
    const args = process.argv.slice(2)

    // Check if we should start in MCP stdio mode
    if (args.includes('--mcp-stdio')) {
      // Import and start MCP stdio server directly
      logger.info('Starting Promptliano MCP server in stdio mode...')
      if (process.platform === 'win32') {
        logger.info('Running on Windows - ensuring compatible stdio handling')
      }
      await import('./src/mcp-stdio-server.js')
      return
    }

    let port = serverConfig.port

    // Look for --port argument
    const portIndex = args.indexOf('--port')
    if (portIndex !== -1 && args[portIndex + 1]) {
      const parsedPort = parseInt(args[portIndex + 1], 10)
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        port = parsedPort
      }
    }

    // Start normal HTTP server
    logger.info('Starting server...')
    try {
      const server = await instantiateServer({ port })
      logger.info('Server instantiated successfully')

      function handleShutdown() {
        logger.info('Received kill signal. Shutting down gracefully...')
        watchersManager.stopAllWatchers?.()
        server.stop()
        process.exit(0)
      }
      process.on('SIGINT', handleShutdown)
      process.on('SIGTERM', handleShutdown)
    } catch (error) {
      logger.error('Failed to start server', error)
      process.exit(1)
    }
  })()
}
