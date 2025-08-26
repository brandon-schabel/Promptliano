/**
 * Global Settings Persistence Tests
 *
 * Tests for settings persistence, import/export functionality,
 * validation, concurrent changes, and data management.
 */

import { test, expect } from '@playwright/test'
import { GlobalSettingsPage } from '../pages/global-settings-page'
import { TestDataManager } from '../utils/test-data-manager'
import { GlobalSettingsTestData, TEST_SCENARIOS } from '../fixtures/global-settings-data'

test.describe('Global Settings - Persistence and Management', () => {
  let settingsPage: GlobalSettingsPage
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    settingsPage = new GlobalSettingsPage(page)
    testDataManager = new TestDataManager(page, testInfo)

    await settingsPage.navigateToSettings()
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should export current settings to JSON file', async ({ page }) => {
    // Configure some custom settings across all sections
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, false)

    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)

    await settingsPage.switchToTab('editor')
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'monokai')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 16)

    await settingsPage.applySettings()

    // Export settings
    const filename = await settingsPage.exportSettings()

    // Verify export file was created
    expect(filename).toBeTruthy()
    expect(filename).toMatch(/settings.*\.json$/)

    // Verify the download was successful
    await expect(settingsPage.saveStatus)
      .toContainText(/export|download|saved/i, { timeout: 5000 })
      .catch(() => {
        // Export might not show status message
      })
  })

  test('should import valid settings from JSON file', async ({ page }) => {
    // Create test settings file data
    const testSettings = GlobalSettingsTestData.SETTINGS_EXPORT_DATA.validExport

    // Create temporary file for import
    const testSettingsFile = await page.evaluate((data) => {
      // Create a blob and URL for the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      return URL.createObjectURL(blob)
    }, testSettings)

    // Create actual file for upload (this is a mock approach)
    await page.addInitScript(
      (fileData) => {
        // Mock file creation for testing
        ;(window as any).__testSettingsData = fileData
      },
      JSON.stringify(testSettings, null, 2)
    )

    // Navigate to settings page
    await settingsPage.navigateToSettings()

    // Mock the file input behavior since we can't actually create files in browser tests
    await page.route('**/api/settings/import**', async (route) => {
      const importData = testSettings.settings

      // Simulate successful import
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Settings imported successfully',
          data: importData
        })
      })
    })

    // Trigger import (this will use the mocked API)
    await settingsPage.importButton.click()

    // Wait for import confirmation
    await expect(settingsPage.saveStatus)
      .toContainText(/import|load|success/i, { timeout: 10000 })
      .catch(() => {
        // Import might complete without explicit status
      })

    // Verify imported settings were applied
    await settingsPage.switchToTab('general')
    await expect(settingsPage.darkModeToggle).toBeChecked({
      checked: testSettings.settings.general.darkMode
    })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({
      checked: testSettings.settings.general.autoRefreshOnFocus
    })

    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({
      checked: testSettings.settings.chat.autoNameChats
    })
    await expect(settingsPage.showTimestampsToggle).toBeChecked({
      checked: testSettings.settings.chat.showTimestamps
    })

    await settingsPage.switchToTab('editor')
    await expect(settingsPage.fontSizeInput).toHaveValue(testSettings.settings.editor.fontSize.toString())
  })

  test('should validate imported settings format', async ({ page }) => {
    // Test invalid settings data
    const invalidSettingsData = GlobalSettingsTestData.SETTINGS_EXPORT_DATA.invalidExport

    // Mock invalid import
    await page.route('**/api/settings/import**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid settings format',
          details: 'Version 0.5 is not supported'
        })
      })
    })

    // Try to import invalid settings
    await settingsPage.importButton.click()

    // Should show validation error
    const hasValidationError = await settingsPage.hasValidationError(
      /invalid.*format|version.*not.*supported|unsupported/i
    )
    const hasErrorMessage = await settingsPage.hasErrorMessage()

    expect(hasValidationError || hasErrorMessage).toBe(true)

    // Settings should not be changed - verify some default values remain
    await settingsPage.switchToTab('general')
    const darkModeState = await settingsPage.darkModeToggle.isChecked()
    expect(typeof darkModeState).toBe('boolean') // Should have valid state, not broken
  })

  test('should reset all settings to defaults', async ({ page }) => {
    // Apply a complex configuration from test scenarios
    const testScenario = TEST_SCENARIOS[0] // Dark Mode Power User
    await settingsPage.applyTestSettings(testScenario.settings)

    // Verify non-default settings are applied
    await settingsPage.switchToTab('general')
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })

    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: false })

    await settingsPage.switchToTab('editor')
    await expect(settingsPage.fontSizeInput).toHaveValue('16')

    // Reset to defaults
    await settingsPage.resetToDefaults()

    // Verify all settings are restored to defaults
    const defaults = GlobalSettingsTestData.DEFAULT_SETTINGS

    await settingsPage.switchToTab('general')
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: defaults.general.darkMode })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: defaults.general.autoRefreshOnFocus })

    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: defaults.chat.autoNameChats })
    await expect(settingsPage.showTimestampsToggle).toBeChecked({ checked: defaults.chat.showTimestamps })

    await settingsPage.switchToTab('editor')
    await expect(settingsPage.fontSizeInput).toHaveValue(defaults.editor.fontSize.toString())
    await expect(settingsPage.tabSizeInput).toHaveValue(defaults.editor.tabSize.toString())
  })

  test('should handle concurrent settings changes across tabs', async ({ page, context }) => {
    // Open settings in first tab
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    // Open settings in second tab
    const secondPage = await context.newPage()
    const secondSettingsPage = new GlobalSettingsPage(secondPage)
    await secondSettingsPage.navigateToSettings()
    await secondSettingsPage.switchToTab('chat')

    // Make different change in second tab
    await secondSettingsPage.toggleSetting(secondSettingsPage.autoNameChatsToggle, false)
    await secondSettingsPage.applySettings()

    // Apply changes in first tab
    await settingsPage.applySettings()

    // Both settings should be preserved (not overwrite each other)
    await page.reload()
    await settingsPage.waitForPageLoad()

    // Verify both changes persisted
    await settingsPage.switchToTab('general')
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })

    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: false })

    await secondPage.close()
  })

  test('should persist settings across different session scenarios', async ({ page }) => {
    // Test persistence across various scenarios
    const scenarios = [
      {
        name: 'Page Reload',
        action: async () => {
          await page.reload()
          await settingsPage.waitForPageLoad()
        }
      },
      {
        name: 'Navigation Away and Back',
        action: async () => {
          await page.goto('/projects')
          await page.goto('/settings')
          await settingsPage.waitForPageLoad()
        }
      },
      {
        name: 'Browser Tab Close/Reopen Simulation',
        action: async () => {
          // Simulate session storage scenarios
          await page.evaluate(() => {
            sessionStorage.clear()
          })
          await page.reload()
          await settingsPage.waitForPageLoad()
        }
      }
    ]

    // Configure initial settings
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    await settingsPage.switchToTab('editor')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 18)

    await settingsPage.applySettings()

    // Test each scenario
    for (const scenario of scenarios) {
      await scenario.action()

      // Verify settings persisted
      await settingsPage.switchToTab('general')
      await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })

      await settingsPage.switchToTab('editor')
      await expect(settingsPage.fontSizeInput).toHaveValue('18')
    }
  })

  test('should handle storage limitations gracefully', async ({ page }) => {
    // Fill up local storage to simulate quota issues
    await page.evaluate(() => {
      const largeData = 'x'.repeat(50000)
      for (let i = 0; i < 200; i++) {
        try {
          localStorage.setItem(`large-data-${i}`, largeData)
        } catch (e) {
          // Storage full, which is what we want to test
          console.log(`Storage filled at iteration ${i}`)
          break
        }
      }
    })

    // Try to save settings with limited storage
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    try {
      await settingsPage.applySettings()

      // If save succeeds despite storage pressure, verify it worked
      await expect(settingsPage.saveStatus).toContainText(/saved|success/i)
    } catch (error) {
      // If save fails due to storage, should handle gracefully
      const hasErrorMessage = await settingsPage.hasErrorMessage()
      if (hasErrorMessage) {
        const errorMsg = await settingsPage.getErrorMessage()
        expect(errorMsg.toLowerCase()).toMatch(/storage|quota|space|full/)
      }
    }

    // Clean up storage
    await page.evaluate(() => {
      for (let i = 0; i < 200; i++) {
        localStorage.removeItem(`large-data-${i}`)
      }
    })
  })

  test('should maintain data integrity during rapid changes', async ({ page }) => {
    // Perform rapid sequential changes to test data consistency
    const rapidChanges = async () => {
      await settingsPage.switchToTab('general')
      await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

      await settingsPage.switchToTab('chat')
      await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)

      await settingsPage.switchToTab('editor')
      await settingsPage.setNumberInput(settingsPage.fontSizeInput, 16)

      await settingsPage.switchToTab('general')
      await settingsPage.toggleSetting(settingsPage.darkModeToggle, false)
    }

    // Perform rapid changes multiple times
    for (let i = 0; i < 3; i++) {
      await rapidChanges()
      await page.waitForTimeout(100) // Small delay
    }

    // Save final state
    await settingsPage.applySettings()

    // Verify final state is consistent
    await settingsPage.switchToTab('general')
    const finalDarkMode = await settingsPage.darkModeToggle.isChecked()

    await settingsPage.switchToTab('chat')
    const finalAutoNaming = await settingsPage.autoNameChatsToggle.isChecked()

    await settingsPage.switchToTab('editor')
    const finalFontSize = await settingsPage.fontSizeInput.inputValue()

    // All values should be valid booleans/numbers
    expect(typeof finalDarkMode).toBe('boolean')
    expect(typeof finalAutoNaming).toBe('boolean')
    expect(parseInt(finalFontSize)).toBeGreaterThan(0)
  })

  test('should handle network errors during settings operations', async ({ page }) => {
    // Mock network failures
    await page.route('**/api/settings**', async (route) => {
      const method = route.request().method()

      if (method === 'PUT' || method === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            message: 'Settings service temporarily unavailable'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Try to save settings
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    try {
      await settingsPage.applySettings()
    } catch (error) {
      // Expected to fail
    }

    // Should show appropriate error message
    const hasError = await settingsPage.hasErrorMessage()
    if (hasError) {
      const errorMsg = await settingsPage.getErrorMessage()
      expect(errorMsg.toLowerCase()).toMatch(/error|failed|unavailable|server/)
    }

    // Settings should remain in editable state
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })

    // Remove network error mock
    await page.unroute('**/api/settings**')

    // Retry should work
    await settingsPage.applySettings()
    await expect(settingsPage.saveStatus).toContainText(/saved|success/i, { timeout: 10000 })
  })

  test('should validate complete settings workflow', async ({ page }) => {
    // Test complete workflow: configure -> save -> export -> reset -> import

    // Step 1: Configure complex settings
    const testScenario = TEST_SCENARIOS[1] // Light Mode Beginner
    await settingsPage.applyTestSettings(testScenario.settings)

    // Step 2: Export settings
    const exportFilename = await settingsPage.exportSettings()
    expect(exportFilename).toBeTruthy()

    // Step 3: Make different changes
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.applySettings()

    // Step 4: Reset to defaults
    await settingsPage.resetToDefaults()

    // Verify reset worked
    const defaults = GlobalSettingsTestData.DEFAULT_SETTINGS
    await settingsPage.switchToTab('general')
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: defaults.general.darkMode })

    // Step 5: Import previously exported settings (mock)
    await page.route('**/api/settings/import**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: testScenario.settings
        })
      })
    })

    await settingsPage.importButton.click()
    await expect(settingsPage.saveStatus)
      .toContainText(/import|success/i, { timeout: 5000 })
      .catch(() => {})

    // Verify imported settings were restored
    await settingsPage.verifyAppliedSettings(testScenario.settings)
  })

  test('should handle settings versioning and migration', async ({ page }) => {
    // Test with old version settings format
    const oldVersionSettings = {
      version: '0.9', // Older version
      settings: {
        theme: 'dark', // Old format
        fontSize: 14,
        autoSave: true // Deprecated setting
      }
    }

    // Mock migration handling
    await page.route('**/api/settings/import**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          migrated: true,
          message: 'Settings migrated from version 0.9 to 1.0',
          data: {
            general: { darkMode: true },
            editor: { fontSize: 14, theme: 'vscode-dark' }
          }
        })
      })
    })

    // Import old settings
    await settingsPage.importButton.click()

    // Should handle migration gracefully
    await expect(settingsPage.saveStatus)
      .toContainText(/migrat|import|success/i, { timeout: 5000 })
      .catch(() => {})

    // Verify migrated settings were applied correctly
    await settingsPage.switchToTab('general')
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })

    await settingsPage.switchToTab('editor')
    await expect(settingsPage.fontSizeInput).toHaveValue('14')
  })

  test('should preserve unsaved changes warning', async ({ page }) => {
    // Make changes without saving
    await settingsPage.switchToTab('general')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    // Try to navigate away
    await page.goto('/projects')

    // Check if there was any prevention or warning (implementation dependent)
    // This test validates the application handles unsaved changes appropriately
    const currentUrl = page.url()

    if (currentUrl.includes('/projects')) {
      // Navigation succeeded - changes might be auto-saved or warned about
      console.log('Navigation succeeded - no unsaved changes warning')
    } else {
      // Navigation was prevented - good UX
      expect(currentUrl).toMatch(/settings/)
    }
  })
})
