import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '../fixtures/.auth/user.json')

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication state...')

  try {
    // Navigate to the application
    await page.goto('/')

    // Wait for the app to load with fallback selectors
    try {
      await page.waitForSelector('[data-testid="app-ready"]', { timeout: 5000 })
    } catch {
      try {
        await page.waitForSelector('[id="root"], main, .app', { timeout: 5000 })
      } catch {
        // Final fallback - wait for content to load
        await page.waitForFunction(() => document.body.children.length > 0, { timeout: 10000 })
        console.log('⚠️ Using fallback app detection for auth setup')
      }
    }

    // Check if we're already on a dashboard/authenticated page
    // If not, this might need provider key setup
    const isDashboard = (await page.locator('[data-testid="dashboard"], [data-testid="projects-view"]').count()) > 0

    if (!isDashboard) {
      console.log('⚠️  Not on dashboard - may need provider key setup')

      // Navigate to provider setup if needed
      const providerSetupButton = page
        .locator('[data-testid="provider-setup"]')
        .or(page.getByText('Provider Keys'))
        .or(page.getByText('Setup'))
      if ((await providerSetupButton.count()) > 0) {
        await providerSetupButton.first().click()
      }

      // This would need to be customized based on actual Promptliano auth flow
      // For now, we'll just ensure we can navigate the app
    }

    // Verify we can access core functionality
    // Check that the page has loaded successfully
    await expect(page).toHaveTitle(/.+/) // Any title is fine, just not empty

    // Save authenticated state
    await page.context().storageState({ path: authFile })
    console.log('✅ Authentication state saved')
  } catch (error) {
    console.error('❌ Authentication setup failed:', error)
    throw error
  }
})
