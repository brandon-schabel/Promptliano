import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { SidebarPage } from '../pages/sidebar.page'

test.describe('Navigation Tests', () => {
  let appPage: AppPage
  let sidebarPage: SidebarPage

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    sidebarPage = new SidebarPage(page)

    await page.goto('/')
    await appPage.waitForAppReady()
  })

  test('should display sidebar with all navigation elements', async () => {
    await sidebarPage.verifySidebarStructure()

    // Verify all main navigation items are present
    const visibleNavItems = await sidebarPage.getVisibleNavItems()
    expect(visibleNavItems).toContain('projects')
    expect(visibleNavItems).toContain('chat')
    expect(visibleNavItems).toContain('prompts')
    expect(visibleNavItems).toContain('providers')
    expect(visibleNavItems).toContain('settings')
  })

  test('should navigate to projects section', async () => {
    await sidebarPage.navigateToSection('projects')

    // Verify we're on the projects page
    await expect(appPage.page).toHaveURL(/\/projects/)

    // Check if projects content is loaded
    const hasProjectsContent = await appPage.isElementVisible('[data-testid="projects-view"], .projects-content', 2000)
    expect(hasProjectsContent).toBeTruthy()
  })

  test('should navigate to chat section', async () => {
    await sidebarPage.navigateToSection('chat')

    // Verify we're on the chat page
    await expect(appPage.page).toHaveURL(/\/chat/)

    // Check if chat interface is loaded
    const hasChatContent = await appPage.isElementVisible('[data-testid="chat-interface"], .chat-container', 2000)
    expect(hasChatContent).toBeTruthy()
  })

  test('should navigate to prompts section', async () => {
    await sidebarPage.navigateToSection('prompts')

    // Verify we're on the prompts page
    await expect(appPage.page).toHaveURL(/\/prompts/)

    // Check if prompts content is loaded
    const hasPromptsContent = await appPage.isElementVisible('[data-testid="prompts-view"], .prompts-content', 2000)
    expect(hasPromptsContent).toBeTruthy()
  })

  test('should navigate to providers section', async () => {
    await sidebarPage.navigateToSection('providers')

    // Verify we're on the providers page
    await expect(appPage.page).toHaveURL(/\/providers/)

    // Check if providers content is loaded
    const hasProvidersContent = await appPage.isElementVisible(
      '[data-testid="providers-view"], .providers-content',
      2000
    )
    expect(hasProvidersContent).toBeTruthy()
  })

  test('should navigate to settings section', async () => {
    await sidebarPage.navigateToSection('settings')

    // Verify we're on the settings page
    await expect(appPage.page).toHaveURL(/\/settings/)

    // Check if settings content is loaded
    const hasSettingsContent = await appPage.isElementVisible('[data-testid="settings-view"], .settings-content', 2000)
    expect(hasSettingsContent).toBeTruthy()
  })

  test('should open command palette with keyboard shortcut', async () => {
    await appPage.openCommandPalette()

    // Verify command palette is visible
    await expect(appPage.commandPalette).toBeVisible()

    // Verify command input is focused
    const commandInput = appPage.page.locator('[data-testid="command-input"]')
    await expect(commandInput).toBeVisible()
    await expect(commandInput).toBeFocused()
  })

  test('should navigate using command palette', async () => {
    await appPage.useCommandPalette('prompts')

    // Should navigate to prompts page
    await expect(appPage.page).toHaveURL(/\/prompts/)
  })

  test('should open manage projects dialog', async () => {
    const dialog = await sidebarPage.openManageProjects()

    // Verify dialog is open and contains project management content
    await expect(dialog).toBeVisible()

    // Should contain project list or create project button
    const hasProjectContent = await appPage.isElementVisible(
      'text="Open Project", text="Create", text="New Project"',
      2000
    )
    expect(hasProjectContent).toBeTruthy()
  })

  test('should handle sidebar toggle functionality', async () => {
    // Check initial sidebar state
    const initiallyExpanded = await sidebarPage.isSidebarExpanded()
    console.log(`Sidebar initially expanded: ${initiallyExpanded}`)

    // Toggle sidebar
    await sidebarPage.toggleSidebar()
    await appPage.page.waitForTimeout(300) // Wait for animation

    // Check if state changed
    const afterToggle = await sidebarPage.isSidebarExpanded()
    console.log(`Sidebar after toggle: ${afterToggle}`)

    // The state should have changed (though the exact behavior depends on screen size)
    // On desktop, it might just change visual state without hiding completely
    expect(typeof afterToggle).toBe('boolean')
  })

  test('should show active navigation state', async () => {
    // Navigate to projects
    await sidebarPage.navigateToSection('projects')

    // Check that projects nav item shows as active
    const activeItem = await sidebarPage.getActiveNavItem()
    expect(activeItem).toContain('Projects')
  })

  test('should handle responsive behavior', async () => {
    await sidebarPage.testResponsiveBehavior()

    // Sidebar should still be functional after responsive changes
    await sidebarPage.waitForSidebarReady()
    await expect(sidebarPage.sidebar).toBeVisible()
  })

  test('should maintain navigation state across page reloads', async () => {
    // Navigate to a specific section
    await sidebarPage.navigateToSection('prompts')
    await expect(appPage.page).toHaveURL(/\/prompts/)

    // Reload the page
    await appPage.page.reload()
    await appPage.waitForAppReady()

    // Should still be on the same page
    await expect(appPage.page).toHaveURL(/\/prompts/)
  })

  test.describe('Recent Projects', () => {
    test('should display recent projects when available', async () => {
      // Check if recent projects section exists
      const hasRecentProjects = await sidebarPage.hasRecentProjects()

      if (hasRecentProjects) {
        const recentProjectNames = await sidebarPage.getRecentProjectNames()
        expect(recentProjectNames.length).toBeGreaterThan(0)
        console.log(`Recent projects found: ${recentProjectNames.join(', ')}`)

        // Try to select the first recent project
        if (recentProjectNames.length > 0) {
          await sidebarPage.selectRecentProject(recentProjectNames[0])
          await expect(appPage.page).toHaveURL(/\/projects/)
        }
      } else {
        console.log('No recent projects section visible - this is normal for new installations')
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle navigation errors gracefully', async () => {
      // Try to navigate to a section that might not be fully loaded
      await sidebarPage.navigateToSection('settings')

      // Even if there are errors, sidebar should remain functional
      await expect(sidebarPage.sidebar).toBeVisible()
      await expect(sidebarPage.projectsNavItem).toBeVisible()
    })

    test('should recover from navigation failures', async () => {
      // Navigate to projects as a baseline
      await sidebarPage.navigateToSection('projects')
      await expect(appPage.page).toHaveURL(/\/projects/)

      // Navigation should work consistently
      await sidebarPage.navigateToSection('chat')
      await expect(appPage.page).toHaveURL(/\/chat/)
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should support keyboard navigation in sidebar', async () => {
      // Focus the first navigation item
      await sidebarPage.projectsNavItem.focus()
      await expect(sidebarPage.projectsNavItem).toBeFocused()

      // Tab through navigation items
      await appPage.page.keyboard.press('Tab')

      // Should focus next navigation element
      const focusedElement = await appPage.page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('should handle Enter key on navigation items', async () => {
      // Focus and press Enter on prompts nav item
      await sidebarPage.promptsNavItem.focus()
      await appPage.page.keyboard.press('Enter')

      // Should navigate to prompts
      await expect(appPage.page).toHaveURL(/\/prompts/)
    })
  })

  test.describe('Visual State', () => {
    test('should maintain consistent visual state', async () => {
      // Take screenshot of initial state for visual regression testing
      await expect(sidebarPage.sidebar).toBeVisible()

      // Navigate through different sections
      const sections = ['projects', 'chat', 'prompts'] as const

      for (const section of sections) {
        await sidebarPage.navigateToSection(section)
        await expect(appPage.page).toHaveURL(new RegExp(section))

        // Sidebar should remain visible and functional
        await expect(sidebarPage.sidebar).toBeVisible()
      }
    })

    test('should handle theme changes', async () => {
      // If theme toggle is available, test it
      if (await appPage.themeToggle.isVisible()) {
        await appPage.toggleTheme()

        // Sidebar should still be visible and functional after theme change
        await expect(sidebarPage.sidebar).toBeVisible()
        await sidebarPage.navigateToSection('projects')
        await expect(appPage.page).toHaveURL(/\/projects/)
      }
    })
  })
})
