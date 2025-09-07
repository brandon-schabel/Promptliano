#!/usr/bin/env bun

// Script to run all API functional tests with proper environment setup

import { $ } from 'bun'
import { TEST_API_URL, TEST_ENCRYPTION_KEY, TEST_DB_PATH } from './test-config'
import { setupTestSuite, teardownTestSuite, waitForServer } from './test-setup'
import { createTestServer, type TestServerInstance } from './test-server'
import { resolve } from 'path'

console.log('🧪 Running API Functional Tests')
console.log(`🗄️  Test DB: ${TEST_DB_PATH}`)
console.log('─'.repeat(50))

const testFiles = ['projects-api.test.ts', 'chat-api.test.ts', 'prompt-api.test.ts', 'provider-key-api.test.ts']

let server: TestServerInstance | null = null
let serverProcess: any = null
const repoRoot = resolve(import.meta.dir, '../../../../')

try {
  // Setup test environment
  await setupTestSuite()

  // Start isolated test server (in-memory DB, no rate limiting)
  console.log('🚀 Starting test server...')
  try {
    server = await createTestServer({
      // Use dynamic port to avoid collisions; we'll export it via TEST_API_URL
      databasePath: ':memory:',
      enableRateLimit: false,
      logLevel: 'silent',
      enableResourceMonitoring: false
    })
  } catch (e) {
    console.warn('⚠️  createTestServer failed, falling back to spawning server:', e)
    // Fallback: spawn the server process at a fixed port
    serverProcess = Bun.spawn(['bun', 'run', 'packages/server/server.ts'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3147',
        TEST_API_URL: 'http://localhost:3147',
        PROMPTLIANO_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY
      },
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: repoRoot
    })

    // Pipe logs for visibility
    serverProcess.stdout?.pipeTo(
      new WritableStream({
        write(chunk) {
          console.log('[SERVER]', new TextDecoder().decode(chunk))
        }
      })
    )
    serverProcess.stderr?.pipeTo(
      new WritableStream({
        write(chunk) {
          console.error('[SERVER ERROR]', new TextDecoder().decode(chunk))
        }
      })
    )
  }

  // Set dynamic API URL for child test process
  process.env.TEST_API_URL = server ? server.baseUrl : 'http://localhost:3147'
  console.log(`📍 API URL: ${process.env.TEST_API_URL}`)

  // Wait for server to be ready (increased timeout for migrations)
  const serverReady = await waitForServer(process.env.TEST_API_URL, 30)
  if (!serverReady) {
    throw new Error('Server is not ready after waiting')
  }

  // Set environment variables for tests
  process.env.NODE_ENV = 'test'
  process.env.TEST_DB_PATH = TEST_DB_PATH
  process.env.PROMPTLIANO_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY

  // Run the tests with increased timeout
  await $`bun test ${testFiles} --timeout 60000 --bail`

  console.log('\n✅ All API tests completed successfully!')
} catch (error) {
  console.error('\n❌ API tests failed:', error)

  // Show more details about the error
  if (error instanceof Error) {
    console.error('Error details:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }

  process.exit(1)
} finally {
  // Kill test server
  if (server) {
    console.log('🛑 Stopping test server...')
    try {
      await server.cleanup()
    } catch (error) {
      console.warn('Warning: Failed to clean up test server:', error)
    }
  } else if (serverProcess) {
    console.log('🛑 Stopping spawned server...')
    try {
      serverProcess.kill()
      await new Promise((r) => setTimeout(r, 500))
    } catch (error) {
      console.warn('Warning: Failed to stop spawned server process:', error)
    }
  }

  // Always cleanup test environment
  try {
    await teardownTestSuite()
  } catch (cleanupError) {
    console.warn('Warning: Cleanup failed:', cleanupError)
  }
}
