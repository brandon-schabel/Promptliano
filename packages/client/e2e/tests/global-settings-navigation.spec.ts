/**
 * Global Settings Navigation Tests
 *
 * Tests for settings page navigation, accessibility, tab management,
 * and URL routing functionality.
 */

import { test, expect } from '@playwright/test'
import { GlobalSettingsPage } from '../pages/global-settings-page'
import { TestDataManager } from '../utils/test-data-manager'
import { GlobalSettingsTestData } from '../fixtures/global-settings-data'

test.describe('Global Settings - Navigation and Access', () => {
  let settingsPage: GlobalSettingsPage
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    settingsPage = new GlobalSettingsPage(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Start from home page
    await settingsPage.goto('/')
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should navigate to settings page via gear icon', async ({ page }) => {
    // Verify gear icon is visible and positioned in bottom-left
    await expect(settingsPage.settingsButton).toBeVisible()
    await settingsPage.verifySettingsButtonPosition()

    // Navigate to settings
    await settingsPage.navigateToSettings()

    // Verify settings page elements are visible
    await expect(settingsPage.pageHeader).toBeVisible()
    await expect(settingsPage.pageTitle).toContainText(/settings|preferences/i)

    // Verify all settings tabs are visible
    await expect(settingsPage.generalTab).toBeVisible()
    await expect(settingsPage.chatTab).toBeVisible()
    await expect(settingsPage.editorTab).toBeVisible()

    // Verify general tab is active by default
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
    await expect(settingsPage.generalSection).toBeVisible()
  })

  test('should navigate directly via URL', async ({ page }) => {
    // Navigate directly to settings URL
    await settingsPage.navigateToSettingsTab()

    // Should load settings page correctly
    await expect(settingsPage.pageHeader).toBeVisible()
    await expect(settingsPage.pageTitle).toBeVisible()

    // General tab should be active by default
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
    await expect(settingsPage.generalSection).toBeVisible()

    // URL should be correct
    expect(page.url()).toMatch(/\/settings/)
  })

  test('should handle deep links to specific settings tabs', async ({ page }) => {
    // Test navigation to each tab via URL
    const tabs = ['general', 'chat', 'editor'] as const

    for (const tab of tabs) {
      await settingsPage.navigateToSettingsTab(tab)

      // Verify correct tab is selected
      await settingsPage.verifyTabSelected(tab)

      // Verify tab content is visible
      const sectionMap = {
        general: settingsPage.generalSection,
        chat: settingsPage.chatSection,
        editor: settingsPage.editorSection
      }

      await expect(sectionMap[tab]).toBeVisible()

      // Verify URL includes tab parameter (if implemented)
      if (page.url().includes('tab=')) {
        expect(page.url()).toContain(`tab=${tab}`)
      }
    }
  })

  test('should maintain navigation state when switching tabs', async ({ page }) => {
    await settingsPage.navigateToSettings()

    // Switch between tabs and verify state
    await settingsPage.switchToTab('chat')
    await expect(settingsPage.chatSection).toBeVisible()
    await expect(settingsPage.chatTab).toHaveAttribute('aria-selected', 'true')

    await settingsPage.switchToTab('editor')
    await expect(settingsPage.editorSection).toBeVisible()
    await expect(settingsPage.editorTab).toHaveAttribute('aria-selected', 'true')

    // Go back to general
    await settingsPage.switchToTab('general')
    await expect(settingsPage.generalSection).toBeVisible()
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')

    // Verify URL reflects current state
    expect(page.url()).toMatch(/settings/)
  })

  test('should handle keyboard navigation between tabs', async ({ page }) => {
    await settingsPage.navigateToSettings()

    // Test arrow key navigation
    await settingsPage.navigateTabsWithKeyboard()

    // Test Enter/Space activation
    await settingsPage.activateTabWithKeyboard('chat')
    await expect(settingsPage.chatSection).toBeVisible()

    await settingsPage.activateTabWithKeyboard('editor')
    await expect(settingsPage.editorSection).toBeVisible()
  })

  test('should handle browser back/forward navigation', async ({ page }) => {
    await settingsPage.navigateToSettings()

    // Navigate to different tabs
    await settingsPage.switchToTab('chat')
    await settingsPage.switchToTab('editor')

    // Use browser back button
    await page.goBack()

    // Should maintain settings page state (behavior may vary based on implementation)
    await expect(settingsPage.pageHeader).toBeVisible()

    // Use forward button
    await page.goForward()
    await expect(settingsPage.pageHeader).toBeVisible()
  })

  test('should handle page refresh while on settings', async ({ page }) => {
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('chat')

    // Refresh the page
    await page.reload()
    await settingsPage.waitForPageLoad()

    // Should return to settings page (may default to general tab)
    await expect(settingsPage.pageHeader).toBeVisible()
    await expect(settingsPage.pageTitle).toBeVisible()

    // At least one tab should be active
    const activeTabs = await page.locator('[role="tab"][aria-selected="true"]').count()
    expect(activeTabs).toBeGreaterThan(0)
  })

  test('should display loading states during navigation', async ({ page }) => {
    // Mock slow loading for settings
    await page.route('**/api/settings**', async (route) => {
      await page.waitForTimeout(1000) // Simulate loading delay
      await route.continue()
    })

    await settingsPage.navigateToSettings()

    // Loading indicator should be handled gracefully
    // (This test validates that page doesn't break during loading)
    await expect(settingsPage.pageHeader).toBeVisible({ timeout: 15000 })
  })

  test('should handle settings access from different pages', async ({ page }) => {
    const testPages = ['/', '/projects', '/chat']

    for (const testPage of testPages) {
      // Navigate to test page
      await settingsPage.goto(testPage)

      // Verify settings button is accessible
      await expect(settingsPage.settingsButton).toBeVisible()

      // Navigate to settings
      await settingsPage.navigateToSettings()
      await expect(settingsPage.pageHeader).toBeVisible()

      // Verify we can navigate back
      await page.goBack()
      expect(page.url()).toContain(testPage)
    }
  })

  test('should maintain accessibility standards in navigation', async ({ page }) => {
    await settingsPage.navigateToSettings()

    // Check ARIA attributes on tabs
    const tabs = [settingsPage.generalTab, settingsPage.chatTab, settingsPage.editorTab]

    for (const tab of tabs) {
      await expect(tab).toHaveAttribute('role', 'tab')
      await expect(tab).toHaveAttribute('aria-selected')

      // Tab should be keyboard focusable
      await tab.focus()
      await expect(tab).toBeFocused()
    }

    // Check tab panels have proper ARIA attributes
    await expect(settingsPage.generalSection).toHaveAttribute('role', 'tabpanel')
    await expect(settingsPage.chatSection).toHaveAttribute('role', 'tabpanel')
    await expect(settingsPage.editorSection).toHaveAttribute('role', 'tabpanel')
  })

  test('should handle rapid tab switching without errors', async ({ page }) => {
    await settingsPage.navigateToSettings()

    // Rapidly switch between tabs
    for (let i = 0; i < 5; i++) {
      await settingsPage.switchToTab('chat')
      await settingsPage.switchToTab('editor')
      await settingsPage.switchToTab('general')

      // Small delay to allow processing
      await page.waitForTimeout(50)
    }

    // Should end in stable state
    await expect(settingsPage.generalSection).toBeVisible()
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
  })

  test('should show appropriate error states for navigation failures', async ({ page }) => {
    // Mock API errors
    await page.route('**/api/settings**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Settings service unavailable' })
      })
    })

    await settingsPage.navigateToSettings()

    // Should handle errors gracefully
    // Either show error message or fallback UI
    const hasError = await settingsPage.hasErrorMessage()
    const hasContent = await settingsPage.pageHeader.isVisible({ timeout: 5000 }).catch(() => false)

    // One of these should be true (either error handling or fallback content)
    expect(hasError || hasContent).toBe(true)
  })

  test('should preserve settings navigation state across multiple visits', async ({ page }) => {
    // First visit - go to editor tab
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')

    // Navigate away
    await page.goto('/')

    // Return to settings
    await settingsPage.navigateToSettings()

    // Should remember last active tab (implementation dependent)
    // At minimum, should load successfully
    await expect(settingsPage.pageHeader).toBeVisible()

    const activeTabs = await page.locator('[role="tab"][aria-selected="true"]').count()
    expect(activeTabs).toBe(1) // Exactly one tab should be active
  })

  test('should handle concurrent navigation requests', async ({ page }) => {
    await settingsPage.goto('/')

    // Start multiple navigation attempts simultaneously
    const navigationPromises = [
      settingsPage.navigateToSettings(),
      settingsPage.navigateToSettings(),
      settingsPage.navigateToSettings()
    ]

    // All should resolve without error
    await Promise.all(navigationPromises)

    // Should end in valid settings page state
    await expect(settingsPage.pageHeader).toBeVisible()
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
  })
})
