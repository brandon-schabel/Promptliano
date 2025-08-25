import type { FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...')
  
  try {
    // Clean up any temporary files created during tests
    const authFile = path.join(__dirname, '../fixtures/auth.json')
    if (fs.existsSync(authFile)) {
      fs.unlinkSync(authFile)
      console.log('🗑️  Cleaned up authentication state file')
    }
    
    // Clean up any test artifacts
    const testDataDir = path.join(__dirname, '../fixtures/test-data')
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true })
      console.log('🗑️  Cleaned up test data directory')
    }
    
    console.log('✅ Global teardown completed successfully')
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error)
    throw error
  }
}

export default globalTeardown