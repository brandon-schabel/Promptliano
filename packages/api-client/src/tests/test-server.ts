import { serve } from 'bun'
import type { Server } from 'bun'
import { app } from '@promptliano/server/src/app'
import { join, dirname } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { runMigrations, rawDb, dbUtils } from '@promptliano/database'

export interface TestServerConfig {
  port?: number
  databasePath?: string
  enableRateLimit?: boolean
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug'
  /** Health check timeout in ms (default: 5000) */
  healthCheckTimeout?: number
  /** Health check retry interval in ms (default: 100) */
  healthCheckInterval?: number
  /** Server startup timeout in ms (default: 10000) */
  startupTimeout?: number
  /** Enable graceful shutdown (default: true) */
  enableGracefulShutdown?: boolean
  /** Database initialization timeout in ms (default: 5000) */
  dbInitTimeout?: number
  /** Enable resource monitoring for memory leaks */
  enableResourceMonitoring?: boolean
}

export interface TestServerInstance {
  server: Server
  port: number
  baseUrl: string
  databasePath: string
  cleanup: () => Promise<void>
  /** Health check function */
  healthCheck: () => Promise<boolean>
  /** Server readiness status */
  isReady: boolean
  /** Resource usage tracking */
  getResourceUsage?: () => Promise<ResourceUsage>
}

export interface ResourceUsage {
  memoryUsage: NodeJS.MemoryUsage
  uptime: number
  activeConnections?: number
}

/**
 * Creates an isolated test server with its own database
 */
export async function createTestServer(config: TestServerConfig = {}): Promise<TestServerInstance> {
  const startTime = Date.now()
  const {
    healthCheckTimeout = 5000,
    healthCheckInterval = 100,
    startupTimeout = 10000,
    enableGracefulShutdown = true,
    dbInitTimeout = 5000,
    enableResourceMonitoring = false
  } = config

  let tempDir: string
  let databasePath: string
  let isMemoryDB = false

  // Handle database path configuration with memory database support
  if (config.databasePath === ':memory:' || config.databasePath?.includes(':memory:')) {
    isMemoryDB = true
    databasePath = ':memory:'
    tempDir = '' // No temp dir needed for memory DB
  } else {
    tempDir = mkdtempSync(join(tmpdir(), 'promptliano-test-'))
    databasePath = config.databasePath || join(tempDir, 'test.db')
  }

  // Store original environment for restoration
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PROMPTLIANO_DB_PATH: process.env.PROMPTLIANO_DB_PATH,
    DATABASE_PATH: process.env.DATABASE_PATH,
    PROMPTLIANO_DATA_DIR: process.env.PROMPTLIANO_DATA_DIR,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    LOG_LEVEL: process.env.LOG_LEVEL
  }

  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test'
    // Prefer new @promptliano/database env variables
    // Memory DB is selected automatically when NODE_ENV==='test'
    if (!isMemoryDB) {
      process.env.DATABASE_PATH = databasePath
      // Also set legacy var for any remaining consumers
      process.env.PROMPTLIANO_DB_PATH = databasePath
      try {
        // Set PROMPTLIANO_DATA_DIR to the directory containing the DB file for compatibility
        process.env.PROMPTLIANO_DATA_DIR = dirname(databasePath)
      } catch {}
    }
    process.env.RATE_LIMIT_ENABLED = config.enableRateLimit ? 'true' : 'false'
    process.env.LOG_LEVEL = config.logLevel || 'silent'

    // Initialize database with timeout protection
    await Promise.race([
      runMigrations(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Database initialization timeout after ${dbInitTimeout}ms`)), dbInitTimeout)
      )
    ])

    // Start server with startup timeout protection
    const port = config.port || 0
    let server: Server

    try {
      server = serve({
        port,
        fetch: app.fetch.bind(app),
        development: false,
        // Enhanced error handling for CI
        error(error) {
          if (config.logLevel !== 'silent') {
            console.error('Server error:', error)
          }
          return new Response('Internal Server Error', { status: 500 })
        }
      })
    } catch (error) {
      throw new Error(`Failed to start server: ${error}`)
    }

    const actualPort = server.port
    const baseUrl = `http://localhost:${actualPort}`

    // Enhanced health check with timeout protection
    const isServerReady = await Promise.race([
      waitForServerEnhanced(baseUrl, healthCheckTimeout, healthCheckInterval),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error(`Server startup timeout after ${startupTimeout}ms`)), startupTimeout)
      )
    ])

    if (!isServerReady) {
      server.stop(true)
      throw new Error('Server failed to become ready')
    }

    // Resource monitoring setup
    let resourceMonitor: NodeJS.Timer | undefined
    if (enableResourceMonitoring) {
      resourceMonitor = setInterval(() => {
        const usage = process.memoryUsage()
        if (usage.heapUsed > 100 * 1024 * 1024) {
          // 100MB threshold
          console.warn(`High memory usage detected: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`)
        }
      }, 5000)
    }

    // Enhanced cleanup function with graceful shutdown
    const cleanup = async () => {
      try {
        if (resourceMonitor) {
          clearInterval(resourceMonitor)
        }

        if (enableGracefulShutdown) {
          // Give ongoing requests time to complete
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        // Stop the server
        server.stop(true)

        // Close DB connection (no-op for memory DB)
        try {
          dbUtils.close()
        } catch {}

        // Restore environment variables
        Object.assign(process.env, originalEnv)

        // Clean up temporary database and directory (skip for memory DB)
        if (!isMemoryDB && tempDir) {
          try {
            rmSync(tempDir, { recursive: true, force: true })
          } catch (error) {
            if (config.logLevel !== 'silent') {
              console.warn('Failed to clean up test directory:', tempDir, error)
            }
          }
        }
      } catch (error) {
        if (config.logLevel !== 'silent') {
          console.error('Error during cleanup:', error)
        }
      }
    }

    // Health check function
    const healthCheck = async (): Promise<boolean> => {
      try {
        const response = await fetch(`${baseUrl}/api/health`, {
          signal: AbortSignal.timeout(2000)
        })
        return response.ok
      } catch {
        return false
      }
    }

    // Resource usage function
    const getResourceUsage = enableResourceMonitoring
      ? async (): Promise<ResourceUsage> => {
          return {
            memoryUsage: process.memoryUsage(),
            uptime: Date.now() - startTime
          }
        }
      : undefined

    return {
      server,
      port: actualPort,
      baseUrl,
      databasePath,
      cleanup,
      healthCheck,
      isReady: true,
      getResourceUsage
    }
  } catch (error) {
    // Cleanup on failure
    Object.assign(process.env, originalEnv)
    if (!isMemoryDB && tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
    throw error
  }
}

/**
 * Enhanced health check with better error reporting and retry logic
 */
async function waitForServerEnhanced(baseUrl: string, timeoutMs = 5000, intervalMs = 100): Promise<boolean> {
  const start = Date.now()
  let lastError: string = ''
  let attempts = 0

  while (Date.now() - start < timeoutMs) {
    attempts++
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      const response = await fetch(`${baseUrl}/api/health`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'promptliano-test-client',
          Accept: 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        // Verify the health response structure
        if (data && (data.success === true || data.status === 'ok')) {
          return true
        } else {
          lastError = `Invalid health response: ${JSON.stringify(data)}`
        }
      } else {
        lastError = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          lastError = 'Health check timeout (2s)'
        } else if (error.message.includes('ECONNREFUSED')) {
          lastError = 'Connection refused'
        } else {
          lastError = error.message
        }
      } else {
        lastError = String(error)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(
    `Test server failed to start within ${timeoutMs}ms. ` + `Last error after ${attempts} attempts: ${lastError}`
  )
}

/**
 * Legacy function for backward compatibility
 */
async function waitForServer(baseUrl: string, timeoutMs = 5000): Promise<void> {
  await waitForServerEnhanced(baseUrl, timeoutMs)
}

/**
 * Resets the test database to a clean state with enhanced error handling
 */
export async function resetTestDatabase(databasePath: string, timeoutMs = 5000): Promise<void> {
  try {
    // Re-run migrations with timeout protection
    await Promise.race([
      runMigrations(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Database reset timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ])
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to reset test database: ${errorMessage}`)
  }
}

/**
 * Validates database connection and schema
 */
export async function validateTestDatabase(databasePath: string): Promise<boolean> {
  try {
    // Check if critical tables exist using rawDb
    const tables = ['projects', 'tickets', 'ticket_tasks', 'queues']
    for (const table of tables) {
      try {
        rawDb.query(`SELECT 1 FROM ${table} LIMIT 1`).all()
      } catch (error) {
        console.warn(`Table ${table} not accessible:`, error)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Database validation failed:', error)
    return false
  }
}

/**
 * Enhanced utility function for creating isolated test environments
 */
export async function withTestServer<T>(
  testFn: (instance: TestServerInstance) => Promise<T>,
  config?: TestServerConfig
): Promise<T> {
  const testServer = await createTestServer(config)

  try {
    // Pre-test health check
    const isHealthy = await testServer.healthCheck()
    if (!isHealthy) {
      throw new Error('Test server failed pre-test health check')
    }

    return await testFn(testServer)
  } finally {
    await testServer.cleanup()
  }
}

/**
 * Utility for running tests with multiple server instances
 */
export async function withMultipleTestServers<T>(
  testFn: (instances: TestServerInstance[]) => Promise<T>,
  configs: TestServerConfig[]
): Promise<T> {
  const factory = createTestServerFactory()

  try {
    const instances = await Promise.all(configs.map((config) => factory.createServer(config)))

    // Health check all instances
    const { healthy, total } = await factory.healthCheckAll()
    if (healthy !== total) {
      throw new Error(`Only ${healthy}/${total} servers passed health check`)
    }

    return await testFn(instances)
  } finally {
    await factory.cleanupAll()
  }
}

/**
 * Enhanced test server factory with better lifecycle management
 */
export function createTestServerFactory() {
  const activeServers: TestServerInstance[] = []
  let isShuttingDown = false

  const createServer = async (config?: TestServerConfig): Promise<TestServerInstance> => {
    if (isShuttingDown) {
      throw new Error('Cannot create server during shutdown')
    }

    const instance = await createTestServer(config)
    activeServers.push(instance)

    // Validate server is actually working
    const isHealthy = await instance.healthCheck()
    if (!isHealthy) {
      await instance.cleanup()
      const index = activeServers.indexOf(instance)
      if (index > -1) {
        activeServers.splice(index, 1)
      }
      throw new Error('Created server failed health check')
    }

    return instance
  }

  const cleanupAll = async (): Promise<void> => {
    if (isShuttingDown) return
    isShuttingDown = true

    try {
      // Cleanup servers in parallel with timeout protection
      const cleanupPromises = activeServers.map(async (instance) => {
        try {
          await Promise.race([
            instance.cleanup(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 5000))
          ])
        } catch (error) {
          console.warn('Failed to cleanup server instance:', error)
        }
      })

      await Promise.all(cleanupPromises)
    } finally {
      activeServers.length = 0
      isShuttingDown = false
    }
  }

  const healthCheckAll = async (): Promise<{ healthy: number; total: number }> => {
    const healthPromises = activeServers.map((instance) => instance.healthCheck())
    const results = await Promise.all(healthPromises)
    const healthy = results.filter(Boolean).length

    return { healthy, total: activeServers.length }
  }

  const getResourceUsage = async (): Promise<ResourceUsage[]> => {
    const usagePromises = activeServers
      .filter((instance) => instance.getResourceUsage)
      .map((instance) => instance.getResourceUsage!())

    return Promise.all(usagePromises)
  }

  return {
    createServer,
    cleanupAll,
    healthCheckAll,
    getResourceUsage,
    getActiveServers: () => [...activeServers],
    isShuttingDown: () => isShuttingDown
  }
}
