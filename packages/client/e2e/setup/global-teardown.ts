import type { FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { TestProjectHelpers } from '../utils/test-project-helpers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...')

  try {
    // Clean up test projects
    console.log('🗂️ Cleaning up test projects...')
    await TestProjectHelpers.cleanupTestProjects()
    console.log('✅ Test projects cleaned up')

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

    // Clean up test project directories
    const testProjectsDir = '/tmp/e2e-test-projects'
    if (fs.existsSync(testProjectsDir)) {
      try {
        fs.rmSync(testProjectsDir, { recursive: true, force: true })
        console.log('🗑️  Cleaned up test projects directory')
      } catch (error) {
        console.warn('⚠️ Failed to clean up test projects directory:', error.message)
        // Don't fail teardown if cleanup fails
      }
    }

    console.log('✅ Global teardown completed successfully')
  } catch (error) {
    console.error('❌ Global teardown failed:', error)
    throw error
  }
}

export default globalTeardown
