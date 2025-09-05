#!/usr/bin/env bun
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { serverManager } from '../utils/server-manager'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface TestConfig {
  skipBuild?: boolean
  headed?: boolean
  debug?: boolean
  project?: string
  grep?: string
  config?: string
  updateSnapshots?: boolean
  workers?: number
  reporter?: string
}

/**
 * Build client and run Playwright tests against production build
 */
async function buildAndTest(config: TestConfig = {}) {
  const {
    skipBuild = false,
    headed = false,
    debug = false,
    project = undefined,
    grep = undefined,
    config: configFile = 'playwright-production.config.ts',
    updateSnapshots = false,
    workers = undefined,
    reporter = undefined
  } = config

  console.log('🎭 Promptliano E2E Production Test Runner')
  console.log('=========================================\n')

  try {
    // Step 1: Build client (unless skipped)
    if (!skipBuild) {
      console.log('📦 Step 1: Building client for production...')
      await serverManager.buildClient()
      console.log('✅ Client build complete\n')
    } else {
      // Verify build exists
      const clientDistPath = path.join(__dirname, '../../../server/client-dist/index.html')
      if (!existsSync(clientDistPath)) {
        throw new Error(
          'Client build not found. Please run without --skip-build flag or run "bun run build:client" manually.'
        )
      }
      console.log('⏭️  Skipping build step (using existing build)\n')
    }

    // Step 2: Start server with production build
    console.log('🚀 Step 2: Starting server with production build...')
    const serverProcess = await serverManager.startServer({
      port: 53147,
      nodeEnv: 'production',
      logLevel: process.env.DEBUG ? 'debug' : 'error',
      serveClient: true
    })
    console.log(`✅ Server running at: ${serverProcess.url}`)
    console.log(`✅ API available at: ${serverProcess.apiUrl}\n`)

    // Step 3: Run Playwright tests
    console.log('🧪 Step 3: Running Playwright E2E tests...')
    console.log(`Config: ${configFile}`)
    if (headed) console.log('Mode: Headed (with browser UI)')
    if (debug) console.log('Mode: Debug (will pause on first test)')
    if (project) console.log(`Browser: ${project}`)
    if (grep) console.log(`Filter: ${grep}`)
    if (workers) console.log(`Workers: ${workers}`)
    console.log('')

    // Build Playwright command
    const playwrightArgs = ['playwright', 'test']
    
    // Add config file
    playwrightArgs.push(`--config=${configFile}`)
    
    // Add optional flags
    if (headed) playwrightArgs.push('--headed')
    if (debug) playwrightArgs.push('--debug')
    if (project) playwrightArgs.push(`--project=${project}`)
    if (grep) playwrightArgs.push(`--grep=${grep}`)
    if (updateSnapshots) playwrightArgs.push('--update-snapshots')
    if (workers) playwrightArgs.push(`--workers=${workers}`)
    if (reporter) playwrightArgs.push(`--reporter=${reporter}`)

    // Run tests
    const testProcess = spawn('bunx', playwrightArgs, {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_BASE_URL: serverProcess.url,
        VITE_API_URL: serverProcess.apiUrl
      }
    })

    // Wait for tests to complete
    const exitCode = await new Promise<number>((resolve) => {
      testProcess.on('exit', (code) => {
        resolve(code || 0)
      })
    })

    // Step 4: Cleanup
    console.log('\n🧹 Step 4: Cleaning up...')
    await serverManager.stopAll()
    console.log('✅ Cleanup complete\n')

    // Report results
    if (exitCode === 0) {
      console.log('✅ All tests passed!')
      process.exit(0)
    } else {
      console.log(`❌ Tests failed with exit code: ${exitCode}`)
      process.exit(exitCode)
    }

  } catch (error) {
    console.error('\n❌ Error during test execution:', error)
    
    // Cleanup on error
    console.log('\n🧹 Cleaning up after error...')
    await serverManager.stopAll()
    
    process.exit(1)
  }
}

// Parse command line arguments
function parseArgs(): TestConfig {
  const args = process.argv.slice(2)
  const config: TestConfig = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--skip-build':
        config.skipBuild = true
        break
      case '--headed':
        config.headed = true
        break
      case '--debug':
        config.debug = true
        break
      case '--update-snapshots':
        config.updateSnapshots = true
        break
      case '--project':
        config.project = args[++i]
        break
      case '--grep':
        config.grep = args[++i]
        break
      case '--config':
        config.config = args[++i]
        break
      case '--workers':
        config.workers = parseInt(args[++i])
        break
      case '--reporter':
        config.reporter = args[++i]
        break
      case '--help':
        printHelp()
        process.exit(0)
    }
  }

  return config
}

function printHelp() {
  console.log(`
Promptliano E2E Production Test Runner

Usage: bun run e2e/scripts/build-and-test.ts [options]

Options:
  --skip-build         Skip the client build step (use existing build)
  --headed             Run tests in headed mode (with browser UI)
  --debug              Run tests in debug mode (pauses on first test)
  --project <name>     Run tests in specific browser (chromium, firefox, webkit)
  --grep <pattern>     Only run tests matching the pattern
  --config <file>      Use specific Playwright config file (default: playwright-production.config.ts)
  --update-snapshots   Update visual regression snapshots
  --workers <n>        Number of parallel workers
  --reporter <type>    Test reporter to use (html, json, list, etc.)
  --help               Show this help message

Examples:
  # Run all tests with fresh build
  bun run e2e/scripts/build-and-test.ts

  # Run tests with existing build
  bun run e2e/scripts/build-and-test.ts --skip-build

  # Debug tests in headed mode
  bun run e2e/scripts/build-and-test.ts --headed --debug

  # Run only smoke tests in Chrome
  bun run e2e/scripts/build-and-test.ts --project chromium --grep smoke

  # Update visual snapshots
  bun run e2e/scripts/build-and-test.ts --update-snapshots
`)
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received interrupt signal, cleaning up...')
  await serverManager.stopAll()
  process.exit(130)
})

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received termination signal, cleaning up...')
  await serverManager.stopAll()
  process.exit(143)
})

// Main execution
if (import.meta.main) {
  const config = parseArgs()
  buildAndTest(config)
}