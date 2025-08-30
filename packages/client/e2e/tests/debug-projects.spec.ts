import { test, expect } from '@playwright/test'

test.describe('Debug Projects Page', () => {
  test('should debug projects page elements', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Wait for initialization to complete or timeout
    try {
      // Wait for the "Initializing Promptliano..." message to disappear
      await page.waitForSelector('text=Initializing Promptliano', { state: 'hidden', timeout: 30000 })
      console.log('✅ Initialization completed successfully')
    } catch {
      console.log('⚠️ Initialization is taking longer than expected, proceeding with current state')
    }

    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'debug-projects-page.png', fullPage: true })

    // Log what elements are actually present
    const bodyContent = await page.locator('body').innerHTML()
    console.log('Body content (first 1000 chars):', bodyContent.substring(0, 1000))

    // Check if basic elements exist
    const hasRoot = await page.locator('#root').count()
    const hasMain = await page.locator('main').count()
    const hasHeader = await page.locator('header').count()
    const hasNavigation = await page.locator('nav').count()

    console.log('Element counts:', { hasRoot, hasMain, hasHeader, hasNavigation })

    // Check for projects-specific elements
    const projectElements = {
      projectsContainer: await page.getByTestId('projects-container').count(),
      projectCard: await page.getByTestId('project-card').count(),
      createProjectButton: await page.getByTestId('create-project-button').count(),
      projectsList: await page.getByTestId('projects-list').count(),
      manageProjectsButton: await page.getByRole('button', { name: /manage.*project/i }).count()
    }

    console.log('Project elements:', projectElements)

    // Try to find any project-related text
    const projectTexts = {
      hasProjectsHeading: await page.getByText(/projects/i).count(),
      hasCreateText: await page.getByText(/create/i).count(),
      hasManageText: await page.getByText(/manage/i).count(),
      hasNewText: await page.getByText(/new.*project/i).count()
    }

    console.log('Project texts:', projectTexts)

    // Try to find buttons
    const buttons = await page.locator('button').count()
    const links = await page.locator('a').count()

    console.log('Interactive elements:', { buttons, links })

    // Check if we're on the right URL
    const currentUrl = page.url()
    console.log('Current URL:', currentUrl)

    // Get page title
    const title = await page.title()
    console.log('Page title:', title)

    // Look for sidebar items
    const sidebarItems = await page.locator('[data-sidebar] a, nav a').count()
    console.log('Sidebar navigation items:', sidebarItems)

    // This test is just for debugging, so we'll pass regardless
    expect(true).toBe(true)
  })
})
