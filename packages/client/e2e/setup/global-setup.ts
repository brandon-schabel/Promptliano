import { chromium, type FullConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { TestProjectHelpers } from '../utils/test-project-helpers'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...')
  
  const { baseURL } = config.projects[0].use
  
  try {
    // Setup test project infrastructure
    console.log('📁 Setting up test project infrastructure...')
    await setupTestProjectInfrastructure()
    
    // Launch browser for setup
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()
    
    console.log(`📱 Navigating to ${baseURL}`)
    
    // Wait for the application to be ready
    await page.goto(baseURL || 'http://localhost:1420', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    // Wait for React to hydrate and the app to be interactive
    await page.waitForSelector('[data-testid="app-ready"], body', { timeout: 10000 })
    
    // Check if we need authentication (optional)
    // This can be expanded based on Promptliano's auth requirements
    
    // Save authenticated state if needed
    const authFile = path.join(__dirname, '../fixtures/auth.json')
    await context.storageState({ path: authFile })
    
    console.log('💾 Saved authentication state')
    
    await browser.close()
    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
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