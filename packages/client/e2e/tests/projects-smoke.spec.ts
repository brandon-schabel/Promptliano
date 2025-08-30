import { test, expect } from '@playwright/test'

test.describe('Projects Smoke Tests', () => {
  test('should load projects page and show initialization', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Verify that the page loads and shows the sidebar with specific selectors
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible()
    await expect(page.getByTestId('sidebar-header').getByText('Promptliano')).toBeVisible()

    // Check if we're in initialization state (which is expected) using exact text
    const isInitializing = await page.getByText('Initializing Promptliano…', { exact: true }).isVisible()
    const initMessage = await page
      .getByText('Preparing workspace and checking for existing projects', { exact: true })
      .isVisible()

    if (isInitializing) {
      console.log('✅ Projects page loaded and shows initialization screen')
      expect(initMessage).toBe(true)
    } else {
      console.log('✅ Projects page loaded and initialization completed')
      // If initialization is complete, there should be project-related content
      const hasProjectContent = await page.locator('main').isVisible()
      expect(hasProjectContent).toBe(true)
    }

    // Verify sidebar navigation is accessible
    await expect(page.getByText('Chat')).toBeVisible()
    await expect(page.getByText('Prompts')).toBeVisible()
    await expect(page.getByText('Providers')).toBeVisible()
  })

  test('should be able to navigate from projects to other pages', async ({ page }) => {
    // Start on projects page
    await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Click on Chat in sidebar
    await page.getByText('Chat').click()

    // Wait for navigation
    await page.waitForTimeout(2000)

    // Verify we're on chat page
    expect(page.url()).toContain('/chat')

    // Go back to Projects using the specific role button
    await page.getByRole('button', { name: 'Projects', exact: true }).click()
    await page.waitForTimeout(1000)

    // Verify we're back on projects
    expect(page.url()).toContain('/projects')
  })

  test('should show manage projects in sidebar', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Verify the "Manage Projects" link exists in sidebar using testid
    const manageProjectsLink = page.getByTestId('sidebar-manage-projects')
    await expect(manageProjectsLink).toBeVisible()

    // This link should be clickable
    await expect(manageProjectsLink).toBeEnabled()
  })

  test('should display expected initialization state consistently', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Take screenshot for debugging
    await page.screenshot({ path: 'projects-initialization-state.png', fullPage: true })

    // Verify initialization elements are present and visible using exact text matching
    await expect(page.getByText('Initializing Promptliano…', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Preparing workspace and checking for existing projects', { exact: true })
    ).toBeVisible()

    // Verify sidebar structure is intact using testids where available
    await expect(page.getByTestId('sidebar-header').getByText('Promptliano')).toBeVisible()
    await expect(page.getByText('Core')).toBeVisible()
    await expect(page.getByText('Tools')).toBeVisible()

    // Verify all sidebar links are present using role selectors where possible
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible()
    await expect(page.getByText('Chat')).toBeVisible()
    await expect(page.getByText('Prompts')).toBeVisible()
    await expect(page.getByText('Providers')).toBeVisible()
    await expect(page.getByTestId('sidebar-manage-projects')).toBeVisible()
    await expect(page.getByText('Settings')).toBeVisible()
    await expect(page.getByText('Help')).toBeVisible()

    console.log('✅ Projects page consistently shows initialization state with complete sidebar')
  })
})
