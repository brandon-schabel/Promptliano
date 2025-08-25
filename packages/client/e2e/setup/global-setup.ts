import { chromium, type FullConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...')
  
  const { baseURL } = config.projects[0].use
  
  try {
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

export default globalSetup