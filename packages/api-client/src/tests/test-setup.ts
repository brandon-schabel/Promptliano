#!/usr/bin/env bun

import { existsSync, unlinkSync } from 'fs'
import { TEST_DB_PATH, TEST_ENCRYPTION_KEY, getEnhancedTestConfig, detectCIEnvironment } from './test-config'
import { ResourceMonitor, TestTimeoutManager } from './test-utilities'

/**
 * Initialize test environment with enhanced CI support
 */
export async function initializeTestEnvironment(): Promise<void> {
  const { isCI, ciProvider } = detectCIEnvironment()
  const config = getEnhancedTestConfig()
  
  console.log(`🧪 Initializing test environment for ${isCI ? ciProvider || 'CI' : 'local development'}...`)
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.TEST_DB_PATH = TEST_DB_PATH
  process.env.PROMPTLIANO_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  
  // Set CI-specific optimizations
  if (isCI) {
    process.env.TEST_USE_MEMORY_DB = 'true'
    process.env.TEST_PARALLEL = 'false'
    process.env.AI_USE_MOCKS = 'true'
    process.env.SKIP_AI_TESTS = 'true'
    
    console.log('   Applied CI optimizations:')
    console.log('   - Memory database enabled')
    console.log('   - Parallel tests disabled')
    console.log('   - AI mocks enabled')
    console.log('   - AI tests skipped')
  }
  
  // Only clean up file-based databases (not memory)
  if (!config.database.useMemory && existsSync(TEST_DB_PATH)) {
    console.log(`   Removing existing test database: ${TEST_DB_PATH}`)
    unlinkSync(TEST_DB_PATH)
    
    // Remove associated SQLite files
    const associatedFiles = [`${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]
    for (const file of associatedFiles) {
      if (existsSync(file)) {
        console.log(`   Removing: ${file}`)
        unlinkSync(file)
      }
    }
  }
  
  console.log('✅ Test environment initialized')
}

/**
 * Clean up test environment with enhanced error handling
 */
export async function cleanupTestEnvironment(): Promise<void> {
  const { isCI } = detectCIEnvironment()
  const config = getEnhancedTestConfig()
  
  console.log('🧹 Cleaning up test environment...')
  
  // Only clean up file-based databases (skip memory databases)
  if (!config.database.useMemory) {
    const filesToRemove = [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]
    
    const cleanupPromises = filesToRemove.map(async (file) => {
      if (existsSync(file)) {
        try {
          unlinkSync(file)
          if (!isCI || config.execution.logLevel !== 'silent') {
            console.log(`   Removed: ${file}`)
          }
        } catch (error) {
          if (!isCI || config.execution.logLevel !== 'silent') {
            console.warn(`   Failed to remove ${file}:`, error)
          }
        }
      }
    })
    
    // Execute cleanup in parallel for CI speed
    if (isCI) {
      await Promise.all(cleanupPromises)
    } else {
      // Sequential for local development
      for (const promise of cleanupPromises) {
        await promise
      }
    }
  }
  
  console.log('✅ Test environment cleaned up')
}

/**
 * Enhanced server readiness check with CI optimizations
 */
export async function waitForServer(url: string, maxAttempts?: number): Promise<boolean> {
  const { isCI } = detectCIEnvironment()
  const config = getEnhancedTestConfig()
  const timeoutManager = new TestTimeoutManager()
  
  const attempts = maxAttempts || (isCI ? 15 : 10) // More attempts in CI
  const delay = isCI ? 500 : 2000 // Shorter delay in CI
  const requestTimeout = isCI ? 2000 : 5000 // Shorter request timeout in CI
  
  console.log(`⏳ Waiting for server at ${url}...`)
  
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await timeoutManager.race(
          fetch(`${url}/api/health`, {
            signal: AbortSignal.timeout(requestTimeout),
            headers: {
              'User-Agent': 'promptliano-test-setup',
              'Accept': 'application/json'
            }
          }),
          `health-check-${attempt}`
        )
        
        if (response.ok) {
          const data = await response.json()
          if (data && (data.success === true || data.status === 'ok')) {
            if (!isCI || config.execution.logLevel !== 'silent') {
              console.log(`✅ Server is ready (attempt ${attempt}/${attempts})`)
            }
            return true
          }
        }
      } catch (error) {
        // Server not ready yet, continue
        if (config.execution.logLevel === 'debug') {
          console.log(`   Attempt ${attempt} failed:`, error instanceof Error ? error.message : error)
        }
      }
      
      if (attempt < attempts) {
        if (!isCI || config.execution.logLevel !== 'silent') {
          console.log(`   Server not ready, waiting... (attempt ${attempt}/${attempts})`)
        }
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    console.log(`❌ Server not ready after ${attempts} attempts`)
    return false
  } finally {
    timeoutManager.clearAll()
  }
}

/**
 * Initialize test database with fresh schema
 */
export async function initializeTestDatabase(): Promise<void> {
  console.log('🗄️  Initializing test database...')
  
  // The database will be created automatically when the server starts with TEST_DB_PATH
  // The migrations will run automatically on first connection
  
  console.log('✅ Test database initialization prepared')
}

/**
 * Global resource monitor for memory leak detection
 */
let globalResourceMonitor: ResourceMonitor | undefined

/**
 * Enhanced test suite setup with resource monitoring
 */
export async function setupTestSuite(): Promise<void> {
  const { isCI } = detectCIEnvironment()
  const config = getEnhancedTestConfig()
  
  await initializeTestEnvironment()
  await initializeTestDatabase()
  
  // Start resource monitoring in local development
  if (!isCI && config.ci.enableResourceMonitoring) {
    globalResourceMonitor = new ResourceMonitor(config.ci.maxMemoryUsage / 1024 / 1024)
    globalResourceMonitor.start()
    console.log('🔍 Resource monitoring started')
  }
}

/**
 * Enhanced test suite teardown with resource monitoring
 */
export async function teardownTestSuite(): Promise<void> {
  const { isCI } = detectCIEnvironment()
  
  // Stop resource monitoring and report stats
  if (globalResourceMonitor) {
    globalResourceMonitor.stop()
    const stats = globalResourceMonitor.getStats()
    
    console.log('📊 Resource Usage Stats:')
    console.log(`   Current: ${stats.current}MB`)
    console.log(`   Peak: ${stats.peak}MB`)
    console.log(`   Average: ${stats.average}MB`)
    console.log(`   Samples: ${stats.samples}`)
    
    if (globalResourceMonitor.hasMemoryLeak()) {
      console.warn('⚠️  Potential memory leak detected!')
    }
    
    globalResourceMonitor = undefined
  }
  
  await cleanupTestEnvironment()
  
  // Force garbage collection in CI to clean up resources
  if (isCI && global.gc) {
    global.gc()
  }
}

/**
 * Get current resource monitoring stats
 */
export function getResourceStats() {
  return globalResourceMonitor?.getStats() || null
}

/**
 * Check if there's a potential memory leak
 */
export function hasMemoryLeak(): boolean {
  return globalResourceMonitor?.hasMemoryLeak() || false
}