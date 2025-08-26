/**
 * Enhanced test utilities for CI and test environment management
 */

import { createTestEnvironment, type TestEnvironment, type TestEnvironmentConfig } from './test-environment'
import { getEnhancedTestConfig, detectCIEnvironment } from './test-config'
import { createTestServerFactory } from './test-server'
import type { TestServerInstance } from './test-server'

/**
 * Test data manager for automatic cleanup between tests
 */
export class TestDataManager {
  private createdResources: Map<string, Set<string | number>> = new Map()
  private environment: TestEnvironment

  constructor(environment: TestEnvironment) {
    this.environment = environment
  }

  /**
   * Track a created resource for automatic cleanup
   */
  track(resourceType: string, resourceId: string | number): void {
    if (!this.createdResources.has(resourceType)) {
      this.createdResources.set(resourceType, new Set())
    }
    const resourceSet = this.createdResources.get(resourceType)
    if (resourceSet) {
      resourceSet.add(resourceId)
    }
  }

  /**
   * Get all tracked resources of a specific type
   */
  getTracked(resourceType: string): (string | number)[] {
    return Array.from(this.createdResources.get(resourceType) || [])
  }

  /**
   * Clean up all tracked resources
   */
  async cleanup(): Promise<void> {
    const { isCI } = detectCIEnvironment()
    const startTime = Date.now()

    try {
      // Cleanup in reverse order (last created, first cleaned)
      const resourceTypes = Array.from(this.createdResources.keys()).reverse()

      for (const resourceType of resourceTypes) {
        const resources = Array.from(this.createdResources.get(resourceType) || []).reverse()

        // Cleanup resources in parallel for CI speed
        if (isCI && resources.length > 1) {
          await Promise.all(resources.map((id) => this.cleanupResource(resourceType, id)))
        } else {
          // Sequential cleanup for local development (easier debugging)
          for (const resourceId of resources) {
            await this.cleanupResource(resourceType, resourceId)
          }
        }
      }

      const cleanupTime = Date.now() - startTime
      if (cleanupTime > 1000) {
        console.warn(`Test cleanup took ${cleanupTime}ms (slower than expected)`)
      }
    } finally {
      this.createdResources.clear()
    }
  }

  private async cleanupResource(resourceType: string, resourceId: string | number): Promise<void> {
    try {
      // Resource-specific cleanup logic would go here
      // This is a placeholder for actual cleanup implementation
      if (this.environment.config.execution.logLevel === 'debug') {
        console.log(`Cleaning up ${resourceType}: ${resourceId}`)
      }
    } catch (error) {
      if (this.environment.config.execution.logLevel !== 'silent') {
        console.warn(`Failed to cleanup ${resourceType} ${resourceId}:`, error)
      }
    }
  }
}

/**
 * Enhanced test suite manager with automatic resource management
 */
export class TestSuiteManager {
  private serverFactory = createTestServerFactory()
  private environments: TestEnvironment[] = []
  private dataManagers: TestDataManager[] = []
  private isShuttingDown = false

  /**
   * Create a new test environment with automatic tracking
   */
  async createEnvironment(config?: TestEnvironmentConfig): Promise<TestEnvironment> {
    if (this.isShuttingDown) {
      throw new Error('Cannot create environment during shutdown')
    }

    const environment = await createTestEnvironment(config)
    this.environments.push(environment)

    const dataManager = new TestDataManager(environment)
    this.dataManagers.push(dataManager)

    return environment
  }

  /**
   * Create a test server with automatic tracking
   */
  async createServer(config?: TestEnvironmentConfig): Promise<TestServerInstance> {
    if (this.isShuttingDown) {
      throw new Error('Cannot create server during shutdown')
    }

    const enhancedConfig = getEnhancedTestConfig()

    const serverConfig = {
      databasePath: config?.database?.useMemory ? ':memory:' : config?.database?.path,
      enableRateLimit: config?.execution?.enableRateLimit ?? false,
      logLevel: config?.execution?.logLevel ?? enhancedConfig.execution.logLevel,
      healthCheckTimeout: enhancedConfig.ci.healthCheckTimeout,
      dbInitTimeout: enhancedConfig.ci.dbInitTimeout,
      enableResourceMonitoring: enhancedConfig.ci.enableResourceMonitoring
    }

    return this.serverFactory.createServer(serverConfig)
  }

  /**
   * Get a data manager for the given environment
   */
  getDataManager(environment: TestEnvironment): TestDataManager {
    const index = this.environments.indexOf(environment)
    if (index === -1) {
      throw new Error('Environment not managed by this test suite')
    }
    return this.dataManagers[index]
  }

  /**
   * Clean up all managed resources
   */
  async cleanup(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    try {
      const { isCI } = detectCIEnvironment()

      // Cleanup data managers first
      const dataCleanupPromises = this.dataManagers.map((manager) => manager.cleanup())

      // Cleanup environments
      const envCleanupPromises = this.environments.map((env) => env.cleanup())

      // Cleanup server factory
      const serverCleanupPromise = this.serverFactory.cleanupAll()

      // Execute cleanup in parallel for CI
      if (isCI) {
        await Promise.all([Promise.all(dataCleanupPromises), Promise.all(envCleanupPromises), serverCleanupPromise])
      } else {
        // Sequential cleanup for local development
        await Promise.all(dataCleanupPromises)
        await Promise.all(envCleanupPromises)
        await serverCleanupPromise
      }
    } finally {
      this.environments.length = 0
      this.dataManagers.length = 0
      this.isShuttingDown = false
    }
  }

  /**
   * Get health status of all managed resources
   */
  async getHealthStatus(): Promise<{
    environments: number
    servers: { healthy: number; total: number }
    isHealthy: boolean
  }> {
    const serverHealth = await this.serverFactory.healthCheckAll()
    const environmentCount = this.environments.length

    return {
      environments: environmentCount,
      servers: serverHealth,
      isHealthy: serverHealth.healthy === serverHealth.total
    }
  }
}

/**
 * Retry utility with exponential backoff for flaky operations
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    backoffFactor?: number
    maxDelay?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    backoffFactor = 2,
    maxDelay = 10000,
    shouldRetry = () => true
  } = options

  let lastError: Error
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw lastError!
}

/**
 * Network operation retry utility specifically for API calls
 */
export async function retryNetworkOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    timeoutMs?: number
  } = {}
): Promise<T> {
  const { maxAttempts = 3, timeoutMs = 5000 } = options
  const { isCI } = detectCIEnvironment()

  return retryWithBackoff(
    async () => {
      // Add timeout protection
      return Promise.race([
        operation(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs))
      ])
    },
    {
      maxAttempts: isCI ? maxAttempts : maxAttempts - 1, // More retries in CI
      initialDelay: isCI ? 500 : 1000,
      shouldRetry: (error) => {
        // Retry on network errors, timeouts, and 5xx responses
        return (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('timeout') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('Operation timeout') ||
          (error as any).status >= 500
        )
      }
    }
  )
}

/**
 * Resource monitoring utility for memory leak detection
 */
export class ResourceMonitor {
  private samples: Array<{
    timestamp: number
    memory: NodeJS.MemoryUsage
    heap: number
  }> = []
  private interval: NodeJS.Timer | undefined
  private thresholdMB: number

  constructor(thresholdMB = 100) {
    this.thresholdMB = thresholdMB
  }

  start(intervalMs = 1000): void {
    if (this.interval) return

    this.interval = setInterval(() => {
      const memory = process.memoryUsage()
      const heapMB = memory.heapUsed / 1024 / 1024

      this.samples.push({
        timestamp: Date.now(),
        memory,
        heap: heapMB
      })

      // Keep only recent samples
      if (this.samples.length > 100) {
        this.samples = this.samples.slice(-50)
      }

      // Check for memory threshold breach
      if (heapMB > this.thresholdMB) {
        console.warn(`High memory usage: ${Math.round(heapMB)}MB (threshold: ${this.thresholdMB}MB)`)
      }
    }, intervalMs)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }
  }

  getStats(): {
    current: number
    peak: number
    average: number
    samples: number
  } {
    if (this.samples.length === 0) {
      return { current: 0, peak: 0, average: 0, samples: 0 }
    }

    const heaps = this.samples.map((s) => s.heap)
    const current = heaps[heaps.length - 1]
    const peak = Math.max(...heaps)
    const average = heaps.reduce((a, b) => a + b, 0) / heaps.length

    return {
      current: Math.round(current),
      peak: Math.round(peak),
      average: Math.round(average),
      samples: this.samples.length
    }
  }

  hasMemoryLeak(): boolean {
    if (this.samples.length < 10) return false

    // Simple leak detection: memory consistently increasing
    const recent = this.samples.slice(-10)
    const older = this.samples.slice(-20, -10)

    if (older.length === 0) return false

    const recentAvg = recent.reduce((a, b) => a + b.heap, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b.heap, 0) / older.length

    // Consider it a leak if memory increased by more than 20MB consistently
    return recentAvg - olderAvg > 20
  }
}

/**
 * Test timeout manager for CI environments
 */
export class TestTimeoutManager {
  private timeouts = new Map<string, NodeJS.Timeout>()
  private defaultTimeout: number

  constructor() {
    const { isCI } = detectCIEnvironment()
    this.defaultTimeout = isCI ? 15000 : 30000
  }

  /**
   * Create a timeout for an operation
   */
  create(name: string, timeoutMs?: number): Promise<never> {
    const timeout = timeoutMs || this.defaultTimeout

    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        this.timeouts.delete(name)
        reject(new Error(`Test operation '${name}' timeout after ${timeout}ms`))
      }, timeout)

      this.timeouts.set(name, timeoutId)
    })
  }

  /**
   * Clear a specific timeout
   */
  clear(name: string): void {
    const timeoutId = this.timeouts.get(name)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.timeouts.delete(name)
    }
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    for (const [name, timeoutId] of this.timeouts) {
      clearTimeout(timeoutId)
    }
    this.timeouts.clear()
  }

  /**
   * Race an operation against a timeout
   */
  async race<T>(operation: Promise<T>, name: string, timeoutMs?: number): Promise<T> {
    try {
      return await Promise.race([operation, this.create(name, timeoutMs)])
    } finally {
      this.clear(name)
    }
  }
}

/**
 * Global test suite manager instance
 */
export const globalTestSuite = new TestSuiteManager()

/**
 * Utility function to run tests with automatic cleanup
 */
export async function withTestSuite<T>(testFn: (suite: TestSuiteManager) => Promise<T>): Promise<T> {
  const suite = new TestSuiteManager()

  try {
    return await testFn(suite)
  } finally {
    await suite.cleanup()
  }
}

/**
 * Utility to create an isolated test environment with data manager
 */
export async function withIsolatedTest<T>(
  testFn: (env: TestEnvironment, dataManager: TestDataManager) => Promise<T>,
  config?: TestEnvironmentConfig
): Promise<T> {
  return withTestSuite(async (suite) => {
    const env = await suite.createEnvironment(config)
    const dataManager = suite.getDataManager(env)
    return testFn(env, dataManager)
  })
}
