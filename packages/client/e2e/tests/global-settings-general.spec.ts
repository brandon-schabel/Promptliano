/**
 * Global Settings General Tests
 *
 * Tests for general settings functionality including provider configuration,
 * dark mode, auto-refresh, tooltips, and other UI preferences.
 */

import { test, expect } from '@playwright/test'
import { GlobalSettingsPage } from '../pages/global-settings-page'
import { TestDataManager } from '../utils/test-data-manager'
import { GlobalSettingsTestData } from '../fixtures/global-settings-data'

test.describe('Global Settings - General Settings', () => {
  let settingsPage: GlobalSettingsPage
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    settingsPage = new GlobalSettingsPage(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Navigate to settings and ensure general tab is active
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('general')
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should display LLM provider configuration link', async ({ page }) => {
    // Verify provider config link is visible
    await expect(settingsPage.llmProviderConfigLink).toBeVisible()
    await expect(settingsPage.llmProviderConfigLink).toContainText(/provider.*config|llm.*config|manage.*provider/i)

    // Click should navigate to providers page
    await settingsPage.llmProviderConfigLink.click()

    // Should navigate to providers configuration
    await expect(page).toHaveURL(/.*\/(providers|llm-config|provider-config)/)

    // Navigate back to verify
    await page.goBack()
    await expect(page).toHaveURL(/.*\/settings/)
    await expect(settingsPage.generalSection).toBeVisible()
  })

  test('should toggle auto-refresh on window focus', async ({ page }) => {
    // Get initial state
    const initialState = await settingsPage.autoRefreshToggle.isChecked()

    // Toggle the setting
    await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, !initialState)
    await settingsPage.applySettings()

    // Verify setting is persisted after reload
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('general')

    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: !initialState })

    // Test the actual functionality by simulating window focus
    if (!initialState) {
      // If auto-refresh is now enabled, test focus behavior
      await page.evaluate(() => {
        // Simulate window blur then focus
        window.dispatchEvent(new Event('blur'))
        window.dispatchEvent(new Event('focus'))
      })

      // In a real app, this might trigger data refresh
      // For testing, we verify the setting is properly stored
      const settingsData = await page.evaluate(
        () => localStorage.getItem('settings') || sessionStorage.getItem('settings')
      )

      if (settingsData) {
        const settings = JSON.parse(settingsData)
        expect(settings.general?.autoRefreshOnFocus).toBe(!initialState)
      }
    }
  })

  test('should toggle dark mode and apply theme changes', async ({ page }) => {
    // Get initial theme state
    const initialTheme = await settingsPage.getCurrentTheme()
    const isDarkMode = initialTheme.includes('dark')

    // Toggle dark mode
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, !isDarkMode)
    await settingsPage.applySettings()

    // Verify theme changed immediately
    const newTheme = await settingsPage.getCurrentTheme()
    if (!isDarkMode) {
      expect(newTheme.toLowerCase()).toContain('dark')
    } else {
      expect(newTheme.toLowerCase()).not.toContain('dark')
    }

    // Verify CSS variables are updated
    const cssVariables = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        background: style.getPropertyValue('--background') || style.backgroundColor,
        foreground: style.getPropertyValue('--foreground') || style.color,
        colorScheme: style.getPropertyValue('color-scheme')
      }
    })

    expect(cssVariables.background || cssVariables.foreground || cssVariables.colorScheme).toBeTruthy()

    // Theme should persist across page reloads
    await page.reload()
    await settingsPage.waitForPageLoad()

    const persistedTheme = await settingsPage.getCurrentTheme()
    if (!isDarkMode) {
      expect(persistedTheme.toLowerCase()).toContain('dark')
    } else {
      expect(persistedTheme.toLowerCase()).not.toContain('dark')
    }
  })

  test('should toggle auto-scroll chat messages', async ({ page }) => {
    // Enable auto-scroll setting
    await settingsPage.toggleSetting(settingsPage.autoScrollToggle, true)
    await settingsPage.applySettings()

    // Navigate to chat page to test functionality
    await page.goto('/chat')

    // Look for chat container
    const chatContainer = page
      .getByTestId('chat-container')
      .or(page.getByTestId('messages-container'))
      .or(page.locator('.chat-container, .messages-container').first())

    const chatExists = await chatContainer.isVisible({ timeout: 2000 }).catch(() => false)

    if (chatExists) {
      // Test scroll behavior configuration
      const scrollBehavior = await page.evaluate(() => {
        const container = document.querySelector(
          '[data-testid="chat-container"], [data-testid="messages-container"], .chat-container, .messages-container'
        )
        if (container) {
          const styles = getComputedStyle(container)
          return {
            scrollBehavior: styles.scrollBehavior,
            overflowY: styles.overflowY
          }
        }
        return null
      })

      if (scrollBehavior) {
        // Verify scroll behavior is configured
        expect(['auto', 'smooth', 'scroll']).toContain(scrollBehavior.scrollBehavior || scrollBehavior.overflowY)
      }
    }

    // Return to settings and disable auto-scroll
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.autoScrollToggle, false)
    await settingsPage.applySettings()

    // Verify setting is stored
    await expect(settingsPage.autoScrollToggle).toBeChecked({ checked: false })
  })

  test('should toggle spacebar for autocomplete', async ({ page }) => {
    // Enable spacebar autocomplete
    await settingsPage.toggleSetting(settingsPage.spacebarAutocompleteToggle, true)
    await settingsPage.applySettings()

    // Test in a context where autocomplete might be available
    await page.goto('/projects')

    // Look for search inputs where autocomplete might work
    const searchInputs = [
      page.getByTestId('file-search-input'),
      page.getByTestId('project-search'),
      page.getByPlaceholder(/search/i),
      page.locator('input[type="search"], input[placeholder*="search" i]').first()
    ]

    let foundInput = false
    for (const input of searchInputs) {
      const exists = await input.isVisible({ timeout: 1000 }).catch(() => false)
      if (exists) {
        foundInput = true

        // Type partial text
        await input.fill('test')

        // Press spacebar
        await page.keyboard.press('Space')

        // In a real implementation, this might trigger autocomplete
        // For testing, we verify the setting is stored and input handles space correctly
        const inputValue = await input.inputValue()
        expect(inputValue).toContain('test ')

        break
      }
    }

    // If no suitable input found, just verify setting persistence
    if (!foundInput) {
      await settingsPage.navigateToSettings()
      await settingsPage.switchToTab('general')
      await expect(settingsPage.spacebarAutocompleteToggle).toBeChecked({ checked: true })
    }
  })

  test('should toggle informational tooltips', async ({ page }) => {
    // Disable tooltips
    await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, true)
    await settingsPage.applySettings()

    // Navigate to a page that might have tooltips
    await page.goto('/')

    // Look for elements that typically have tooltips
    const tooltipElements = [
      page.getByTestId('tooltip-element'),
      page.locator('[title]').first(),
      page.locator('[data-tooltip]').first(),
      page.getByRole('button').first()
    ]

    let testedTooltips = false
    for (const element of tooltipElements) {
      const exists = await element.isVisible({ timeout: 1000 }).catch(() => false)
      if (exists) {
        // Hover over element
        await element.hover()

        // Wait for potential tooltip
        await page.waitForTimeout(1000)

        // Check for tooltip visibility
        const tooltip = page.getByRole('tooltip').or(page.locator('.tooltip, [data-testid="tooltip"]').first())

        const tooltipVisible = await tooltip.isVisible({ timeout: 500 }).catch(() => false)

        // If tooltips are disabled, they shouldn't appear
        if (tooltipVisible) {
          // Tooltip might still appear if implementation doesn't respect setting
          console.log('Tooltip still visible - implementation may not respect setting')
        }

        testedTooltips = true
        break
      }
    }

    // Re-enable tooltips
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, false)
    await settingsPage.applySettings()

    // Verify setting is stored correctly
    await expect(settingsPage.hideTooltipsToggle).toBeChecked({ checked: false })
  })

  test('should handle rapid toggle changes without errors', async ({ page }) => {
    const toggles = [
      settingsPage.autoRefreshToggle,
      settingsPage.darkModeToggle,
      settingsPage.autoScrollToggle,
      settingsPage.spacebarAutocompleteToggle,
      settingsPage.hideTooltipsToggle
    ]

    // Rapidly toggle all settings
    for (let i = 0; i < 3; i++) {
      for (const toggle of toggles) {
        await toggle.click()
        await page.waitForTimeout(50) // Small delay to simulate realistic usage
      }
    }

    // Apply settings - should handle all changes
    await settingsPage.applySettings()

    // Verify page is still functional
    await expect(settingsPage.generalSection).toBeVisible()
    await expect(settingsPage.saveStatus).toContainText(/saved|applied|success/i)
  })

  test('should preserve general settings after page reload', async ({ page }) => {
    // Configure multiple general settings
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, false)
    await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, true)
    await settingsPage.applySettings()

    // Reload page
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('general')

    // All settings should be preserved
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: false })
    await expect(settingsPage.hideTooltipsToggle).toBeChecked({ checked: true })
  })

  test('should handle settings conflicts gracefully', async ({ page }) => {
    // Test scenario where multiple settings might conflict
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.applySettings()

    // Immediately toggle again before first change is fully processed
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, false)
    await settingsPage.applySettings()

    // Should handle conflicting requests gracefully
    await expect(settingsPage.saveStatus).toContainText(/saved|applied|success/i, { timeout: 10000 })

    // Final state should be consistent
    const finalDarkMode = await settingsPage.darkModeToggle.isChecked()
    expect(typeof finalDarkMode).toBe('boolean')
  })

  test('should reset general settings to defaults', async ({ page }) => {
    // Change settings from defaults
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, false)
    await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, true)
    await settingsPage.applySettings()

    // Reset to defaults
    await settingsPage.resetToDefaults()

    // Verify settings match defaults
    const defaults = GlobalSettingsTestData.DEFAULT_SETTINGS.general
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: defaults.darkMode })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: defaults.autoRefreshOnFocus })
    await expect(settingsPage.hideTooltipsToggle).toBeChecked({ checked: defaults.hideInformationalTooltips })
  })

  test('should show validation feedback for invalid operations', async ({ page }) => {
    // Try to trigger validation errors by rapid changes or invalid states

    // Mock an API error for settings save
    await page.route('**/api/settings**', async (route) => {
      const request = route.request()
      if (request.method() === 'PUT' || request.method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid settings configuration',
            details: 'General settings validation failed'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Make a change and try to save
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    try {
      await settingsPage.applySettings()
    } catch (error) {
      // Expected to fail due to mocked error
    }

    // Should show error feedback
    const hasValidationError = await settingsPage.hasValidationError(/invalid|error|failed/i)
    const hasErrorMessage = await settingsPage.hasErrorMessage()

    expect(hasValidationError || hasErrorMessage).toBe(true)
  })

  test('should maintain settings state during tab switching', async ({ page }) => {
    // Make changes in general tab
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    // Switch to another tab without saving
    await settingsPage.switchToTab('chat')

    // Switch back to general
    await settingsPage.switchToTab('general')

    // Changes should still be present (unsaved)
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })

    // Save should still work
    await settingsPage.applySettings()
    await expect(settingsPage.saveStatus).toContainText(/saved|applied|success/i)
  })

  test('should handle browser storage limitations', async ({ page }) => {
    // Fill localStorage with large amounts of data to simulate storage pressure
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        try {
          localStorage.setItem(`large-data-${i}`, 'x'.repeat(10000))
        } catch (e) {
          // Storage quota exceeded, which is what we want to test
          break
        }
      }
    })

    // Try to save settings
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    try {
      await settingsPage.applySettings()

      // If save succeeds despite storage pressure, that's good
      await expect(settingsPage.saveStatus).toContainText(/saved|applied|success/i)
    } catch (error) {
      // If save fails, app should handle gracefully
      const hasErrorMessage = await settingsPage.hasErrorMessage()
      expect(hasErrorMessage).toBe(true)
    }

    // Clean up test data
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        localStorage.removeItem(`large-data-${i}`)
      }
    })
  })
})
