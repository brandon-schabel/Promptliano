import { chromium, type FullConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { TestProjectHelpers } from '../utils/test-project-helpers'
import { mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { setupTestDatabase } from './test-database-setup'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Global setup for production E2E tests
 * Verifies build artifacts and prepares test environment
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for PRODUCTION E2E tests...')
  
  const { baseURL } = config.projects[0].use
  
  try {
    // Step 1: Verify production build exists
    console.log('📦 Verifying production build...')
    await verifyProductionBuild()
    
    // Step 2: Setup test database
    console.log('🗄️  Setting up test database...')
    await setupTestDatabase()
    
    // Step 3: Setup test project infrastructure
    console.log('📁 Setting up test project infrastructure...')
    await setupTestProjectInfrastructure()
    
    // Step 4: Verify server serves production build correctly
    console.log('🔍 Verifying production server...')
    await verifyProductionServer(baseURL || 'http://localhost:53147')
    
    // Step 5: Setup authentication state if needed
    console.log('🔐 Setting up authentication...')
    await setupAuthentication(baseURL || 'http://localhost:53147')
    
    // Step 6: Collect performance metrics (optional)
    if (process.env.COLLECT_METRICS) {
      console.log('📊 Collecting performance metrics...')
      await collectPerformanceMetrics(baseURL || 'http://localhost:53147')
    }
    
    console.log('✅ Global production setup completed successfully')
  } catch (error) {
    console.error('❌ Global production setup failed:', error)
    throw error
  }
}

/**
 * Verify that the production build exists and is valid
 */
async function verifyProductionBuild() {
  const clientDistPath = path.join(__dirname, '../../../server/client-dist')
  const indexPath = path.join(clientDistPath, 'index.html')
  const assetsPath = path.join(clientDistPath, 'assets')
  
  // Check if build directory exists
  if (!existsSync(clientDistPath)) {
    throw new Error(
      `Production build not found at: ${clientDistPath}\n` +
      'Please run "bun run build:client" from the root directory first.'
    )
  }
  
  // Check for index.html
  if (!existsSync(indexPath)) {
    throw new Error(
      `index.html not found in production build at: ${indexPath}\n` +
      'The build may be incomplete or corrupted.'
    )
  }
  
  // Check for assets directory
  if (!existsSync(assetsPath)) {
    throw new Error(
      `Assets directory not found at: ${assetsPath}\n` +
      'The build may be incomplete or corrupted.'
    )
  }
  
  // Verify assets exist
  try {
    const files = await readdir(assetsPath)
    
    const hasJS = files.some(f => f.endsWith('.js'))
    const hasCSS = files.some(f => f.endsWith('.css'))
    
    if (!hasJS) {
      throw new Error('No JavaScript bundles found in production build')
    }
    
    if (!hasCSS) {
      console.warn('⚠️  No CSS bundles found in production build (may be inlined)')
    }
    
    console.log(`✅ Production build verified: ${files.length} assets found`)
  } catch (error) {
    throw new Error(`Failed to verify production build assets: ${error.message}`)
  }
}

/**
 * Verify that the production server is running and serving the client
 */
async function verifyProductionServer(baseURL: string) {
  const maxRetries = 30 // 30 seconds total
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check API health
      const apiResponse = await fetch(`${baseURL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
      
      if (!apiResponse.ok) {
        throw new Error(`API health check failed: ${apiResponse.status}`)
      }
      
      // Check client is being served
      const clientResponse = await fetch(baseURL, {
        method: 'GET',
        headers: { 'Accept': 'text/html' }
      })
      
      if (!clientResponse.ok) {
        throw new Error(`Client serving check failed: ${clientResponse.status}`)
      }
      
      const html = await clientResponse.text()
      
      // Verify it's the production build (has hashed assets)
      if (!html.includes('assets/') || !html.includes('.js')) {
        throw new Error('Server is not serving the production build')
      }
      
      console.log('✅ Production server verified and serving client correctly')
      return
      
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  throw new Error(
    `Production server verification failed after ${maxRetries} attempts.\n` +
    `Last error: ${lastError?.message}\n` +
    `Make sure the server is running with: SERVE_CLIENT=true bun run server.ts`
  )
}

/**
 * Setup authentication state for tests
 */
async function setupAuthentication(baseURL: string) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    console.log(`📱 Navigating to production app at ${baseURL}`)
    
    // Navigate to the production app
    await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    
    // Wait for the app to be fully loaded
    try {
      await page.waitForSelector('[data-testid="app-ready"]', { 
        timeout: 10000,
        state: 'attached'
      })
    } catch {
      // Fallback: wait for any interactive element
      try {
        await page.waitForSelector('button, a, input', { 
          timeout: 10000,
          state: 'visible'
        })
      } catch {
        // Final fallback: ensure page has content
        await page.waitForFunction(
          () => document.body.textContent?.trim().length > 0,
          { timeout: 10000 }
        )
      }
    }
    
    // Save authentication state
    const authFile = path.join(__dirname, '../fixtures/auth-production.json')
    await context.storageState({ path: authFile })
    console.log('💾 Saved production authentication state')
    
  } finally {
    await browser.close()
  }
}

/**
 * Performance metrics collection for production builds
 */
async function collectPerformanceMetrics(baseURL: string) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Navigate and measure
    const startTime = Date.now()
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    const loadTime = Date.now() - startTime
    
    // Collect metrics
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      }
    })
    
    console.log('📊 Production Performance Metrics:')
    console.log(`  - Page Load Time: ${loadTime}ms`)
    console.log(`  - DOM Content Loaded: ${metrics.domContentLoaded}ms`)
    console.log(`  - Load Complete: ${metrics.loadComplete}ms`)
    console.log(`  - First Paint: ${metrics.firstPaint}ms`)
    console.log(`  - First Contentful Paint: ${metrics.firstContentfulPaint}ms`)
    
    // Warn if performance is poor
    if (loadTime > 5000) {
      console.warn('⚠️  Production build load time exceeds 5 seconds')
    }
    
  } finally {
    await browser.close()
  }
}

/**
 * Setup test project infrastructure
 */
async function setupTestProjectInfrastructure() {
  // Create base test projects directory
  const testProjectsDir = '/tmp/e2e-test-projects'

  if (!existsSync(testProjectsDir)) {
    await mkdir(testProjectsDir, { recursive: true })
    console.log(`📂 Created test projects directory: ${testProjectsDir}`)
  }

  // Clear any existing test projects from previous runs
  TestProjectHelpers.clearActiveProjects()
  console.log('🧹 Cleared previous test project state')

  // Pre-create common test project templates for faster tests
  try {
    console.log('🏗️ Pre-creating common test project templates...')

    // Create a simple project template that tests can copy
    const simpleTemplate = await TestProjectHelpers.createSimpleProject()
    console.log(`✅ Created simple project template: ${simpleTemplate.name}`)

    // Create a web app template
    const webAppTemplate = await TestProjectHelpers.createWebAppProject()
    console.log(`✅ Created web app template: ${webAppTemplate.name}`)
  } catch (error) {
    console.warn('⚠️ Failed to pre-create project templates:', error.message)
    // Don't fail global setup if template creation fails
  }

  console.log('✅ Test project infrastructure ready')
}

export default globalSetup