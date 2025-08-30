import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createTestEnvironment, type TestEnvironment } from './test-environment'
import { getEnhancedTestConfig, detectCIEnvironment } from './test-config'
import { TestDataManager, TestSuiteManager, ResourceMonitor, retryWithBackoff } from './test-utilities'
import { createTestServer } from './test-server'

describe('Enhanced Test Infrastructure', () => {
  let testSuite: TestSuiteManager

  beforeAll(() => {
    testSuite = new TestSuiteManager()
  })

  afterAll(async () => {
    await testSuite.cleanup()
  })

  test('should detect CI environment correctly', () => {
    const { isCI, ciProvider, isLocal } = detectCIEnvironment()

    expect(typeof isCI).toBe('boolean')
    expect(typeof isLocal).toBe('boolean')
    expect(isCI).toBe(!isLocal)

    if (isCI) {
      expect(ciProvider).toBeTruthy()
    }
  })

  test('should get enhanced test configuration', () => {
    const config = getEnhancedTestConfig()

    expect(config).toBeDefined()
    expect(config.server).toBeDefined()
    expect(config.database).toBeDefined()
    expect(config.ai).toBeDefined()
    expect(config.execution).toBeDefined()
    expect(config.environment).toBeDefined()
    expect(config.ci).toBeDefined()

    // CI-specific checks
    expect(typeof config.ci.healthCheckTimeout).toBe('number')
    expect(typeof config.ci.dbInitTimeout).toBe('number')
    expect(typeof config.ci.enableResourceMonitoring).toBe('boolean')
    expect(typeof config.ci.maxMemoryUsage).toBe('number')
  })

  test('should create test environment with enhanced configuration', async () => {
    const env = await createTestEnvironment({
      database: { useMemory: true },
      execution: { logLevel: 'silent' }
    })

    try {
      expect(env).toBeDefined()
      expect(env.baseUrl).toMatch(/^http:\/\/localhost:\d+$/)
      expect(env.config).toBeDefined()
      expect(env.cleanup).toBeDefined()

      // Test server should be ready
      if (env.server) {
        expect(env.server.isReady).toBe(true)
        const healthCheck = await env.server.healthCheck()
        expect(healthCheck).toBe(true)
      }
    } finally {
      await env.cleanup()
    }
  })

  test('should create isolated test server with enhanced features', async () => {
    const server = await createTestServer({
      databasePath: ':memory:',
      logLevel: 'silent',
      enableResourceMonitoring: false,
      healthCheckTimeout: 3000,
      dbInitTimeout: 3000
    })

    try {
      expect(server).toBeDefined()
      expect(server.port).toBeGreaterThan(0)
      expect(server.baseUrl).toMatch(/^http:\/\/localhost:\d+$/)
      expect(server.isReady).toBe(true)
      expect(typeof server.healthCheck).toBe('function')
      expect(typeof server.cleanup).toBe('function')

      // Test health check
      const isHealthy = await server.healthCheck()
      expect(isHealthy).toBe(true)
    } finally {
      await server.cleanup()
    }
  })

  test('should manage test data with TestDataManager', async () => {
    const env = await testSuite.createEnvironment({
      database: { useMemory: true },
      execution: { logLevel: 'silent' }
    })

    const dataManager = testSuite.getDataManager(env)

    // Track some resources
    dataManager.track('projects', 1)
    dataManager.track('projects', 2)
    dataManager.track('tickets', 'ticket-1')

    // Verify tracking
    const projects = dataManager.getTracked('projects')
    const tickets = dataManager.getTracked('tickets')

    expect(projects).toEqual([1, 2])
    expect(tickets).toEqual(['ticket-1'])

    // Cleanup should work without error
    await dataManager.cleanup()
  })

  test('should handle retry operations with backoff', async () => {
    let attempts = 0
    const maxAttempts = 3

    const operation = async () => {
      attempts++
      if (attempts < maxAttempts) {
        throw new Error('Operation failed')
      }
      return 'success'
    }

    const result = await retryWithBackoff(operation, {
      maxAttempts,
      initialDelay: 10,
      backoffFactor: 2
    })

    expect(result).toBe('success')
    expect(attempts).toBe(maxAttempts)
  })

  test('should monitor resources correctly', () => {
    const monitor = new ResourceMonitor(50) // 50MB threshold

    expect(monitor).toBeDefined()

    // Start and stop monitoring
    monitor.start(100) // 100ms interval
    const stats1 = monitor.getStats()

    // Stats should be available
    expect(typeof stats1.current).toBe('number')
    expect(typeof stats1.peak).toBe('number')
    expect(typeof stats1.average).toBe('number')
    expect(typeof stats1.samples).toBe('number')

    monitor.stop()

    // Should not detect leak with minimal samples
    expect(monitor.hasMemoryLeak()).toBe(false)
  })

  test('should manage multiple test environments', async () => {
    const suite = new TestSuiteManager() // Use isolated suite for this test

    try {
      const config1 = { database: { useMemory: true }, execution: { logLevel: 'silent' as const } }
      const config2 = { database: { useMemory: true }, execution: { logLevel: 'silent' as const } }

      const env1 = await suite.createEnvironment(config1)
      const env2 = await suite.createEnvironment(config2)

      expect(env1.baseUrl).not.toBe(env2.baseUrl) // Different ports

      // Both should be healthy
      const health = await suite.getHealthStatus()
      expect(health.environments).toBe(2)
      expect(health.isHealthy).toBe(true)
    } finally {
      await suite.cleanup()
    }
  })

  test('should handle server factory lifecycle', async () => {
    const server1 = await testSuite.createServer({
      database: { useMemory: true },
      execution: { logLevel: 'silent' }
    })

    const server2 = await testSuite.createServer({
      database: { useMemory: true },
      execution: { logLevel: 'silent' }
    })

    expect(server1.port).not.toBe(server2.port) // Different ports

    // Health check all servers
    const health = await testSuite.getHealthStatus()
    expect(health.servers.total).toBeGreaterThanOrEqual(2)
    expect(health.servers.healthy).toBe(health.servers.total)
  })
})
