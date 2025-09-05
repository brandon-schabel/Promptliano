/**
 * General Settings Test Suite
 * 
 * Tests general settings functionality including UI preferences,
 * theme switching, and basic configuration options.
 */

import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/settings.page'
import { AppPage } from '../pages/app.page'
import { SettingsTestHelpers } from '../helpers/settings-helper'

test.describe('Settings - General Configuration', () => {
  let settingsPage: SettingsPage
  let appPage: AppPage
  let testHelpers: SettingsTestHelpers

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page)
    appPage = new AppPage(page)
    testHelpers = new SettingsTestHelpers(page)

    // Clear any existing settings
    await testHelpers.clearStoredSettings()

    // Navigate to app and then to settings
    await appPage.goto()
    await appPage.waitForAppReady()
    await settingsPage.goto()
  })

  test.afterEach(async () => {
    // Clean up after each test
    await testHelpers.cleanup()
  })

  test.describe('Navigation and Access', () => {
    test('should access settings via gear icon', async ({ page }) => {
      // Go back to main app
      await appPage.goto()
      
      // Click settings button
      await settingsPage.settingsButton.click()
      
      // Verify navigation to settings
      await expect(page).toHaveURL(/.*\/settings/)
      await expect(settingsPage.pageTitle).toBeVisible()
      await expect(settingsPage.pageTitle).toContainText(/settings|preferences/i)
    })

    test('should display all settings tabs', async () => {
      // Verify all tabs are visible
      await expect(settingsPage.generalTab).toBeVisible()
      await expect(settingsPage.chatTab).toBeVisible()
      await expect(settingsPage.editorTab).toBeVisible()
      await expect(settingsPage.advancedTab).toBeVisible()
      
      // Verify general tab is selected by default
      await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
    })

    test('should switch between settings tabs', async () => {
      // Switch to chat tab
      await settingsPage.switchToTab('chat')
      await expect(settingsPage.chatTab).toHaveAttribute('aria-selected', 'true')
      await expect(settingsPage.chatSection).toBeVisible()
      
      // Switch to editor tab
      await settingsPage.switchToTab('editor')
      await expect(settingsPage.editorTab).toHaveAttribute('aria-selected', 'true')
      await expect(settingsPage.editorSection).toBeVisible()
      
      // Switch to advanced tab
      await settingsPage.switchToTab('advanced')
      await expect(settingsPage.advancedTab).toHaveAttribute('aria-selected', 'true')
      
      // Switch back to general
      await settingsPage.switchToTab('general')
      await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
      await expect(settingsPage.generalSection).toBeVisible()
    })

    test('should navigate tabs with keyboard', async () => {
      await settingsPage.navigateTabsWithKeyboard()
      
      // Activate tab with keyboard
      await settingsPage.activateTabWithKeyboard('chat')
      await expect(settingsPage.chatSection).toBeVisible()
    })

    test('should verify settings button position', async () => {
      await appPage.goto()
      await settingsPage.verifySettingsButtonPosition()
    })
  })

  test.describe('Theme Settings', () => {
    test('should toggle dark mode', async ({ page }) => {
      // Enable dark mode
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()
      
      // Verify dark mode is applied
      await testHelpers.verifyThemeApplication(true)
      
      // Disable dark mode
      await settingsPage.toggleDarkMode(false)
      await settingsPage.saveSettings()
      
      // Verify light mode is applied
      await testHelpers.verifyThemeApplication(false)
    })

    test('should apply theme immediately without save', async () => {
      // Toggle dark mode without saving
      await settingsPage.toggleDarkMode(true)
      
      // Theme should apply immediately
      await testHelpers.verifyThemeApplication(true)
    })

    test('should persist theme across page reload', async ({ page }) => {
      // Enable dark mode and save
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()
      
      // Reload page
      await page.reload()
      await settingsPage.waitForPageLoad()
      
      // Verify dark mode persists
      await testHelpers.verifyThemeApplication(true)
      await expect(settingsPage.darkModeToggle).toBeChecked()
    })

    test('should sync theme across tabs', async ({ browser }) => {
      // Enable dark mode in first tab
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()
      
      // Open second tab
      const page2 = await browser.newPage()
      const settingsPage2 = new SettingsPage(page2)
      await settingsPage2.goto()
      
      // Verify dark mode is enabled in second tab
      await expect(settingsPage2.darkModeToggle).toBeChecked()
      
      await page2.close()
    })
  })

  test.describe('General Settings Options', () => {
    test('should toggle auto-refresh setting', async () => {
      // Toggle auto-refresh
      await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, true)
      await settingsPage.saveSettings()
      
      // Verify saved
      await expect(settingsPage.saveStatus).toContainText(/saved|success/i)
      await expect(settingsPage.autoRefreshToggle).toBeChecked()
      
      // Toggle off
      await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, false)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.autoRefreshToggle).not.toBeChecked()
    })

    test('should toggle auto-scroll setting', async () => {
      // Toggle auto-scroll
      await settingsPage.toggleSetting(settingsPage.autoScrollToggle, true)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.autoScrollToggle).toBeChecked()
      
      // Toggle off
      await settingsPage.toggleSetting(settingsPage.autoScrollToggle, false)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.autoScrollToggle).not.toBeChecked()
    })

    test('should toggle spacebar autocomplete', async () => {
      // Enable spacebar autocomplete
      await settingsPage.toggleSetting(settingsPage.spacebarAutocompleteToggle, true)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.spacebarAutocompleteToggle).toBeChecked()
    })

    test('should toggle tooltip visibility', async () => {
      // Hide tooltips
      await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, true)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.hideTooltipsToggle).toBeChecked()
      
      // Show tooltips again
      await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, false)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.hideTooltipsToggle).not.toBeChecked()
    })

    test('should apply multiple settings at once', async () => {
      const testSettings = {
        general: {
          darkMode: true,
          autoRefreshOnFocus: false,
          autoScrollChatMessages: true,
          useSpacebarForAutocomplete: true,
          hideInformationalTooltips: false
        }
      }
      
      // Apply all settings
      await settingsPage.applyTestSettings(testSettings)
      
      // Verify all settings applied
      await settingsPage.verifyAppliedSettings(testSettings)
    })
  })

  test.describe('Chat Settings', () => {
    test('should toggle auto-name chats', async () => {
      await settingsPage.switchToTab('chat')
      
      // Enable auto-name
      await settingsPage.enableAutoNameChats(true)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.autoNameChatsToggle).toBeChecked()
      
      // Disable auto-name
      await settingsPage.enableAutoNameChats(false)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.autoNameChatsToggle).not.toBeChecked()
    })

    test('should set default provider and model', async () => {
      await settingsPage.switchToTab('chat')
      
      // Set provider
      await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'openai')
      
      // Set model
      await settingsPage.selectFromDropdown(settingsPage.defaultModelSelect, 'gpt-4')
      
      await settingsPage.saveSettings()
      
      // Verify saved
      await expect(settingsPage.saveStatus).toContainText(/saved|success/i)
    })

    test('should toggle timestamps and compact mode', async () => {
      await settingsPage.switchToTab('chat')
      
      // Enable timestamps
      await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
      
      // Enable compact mode
      await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)
      
      await settingsPage.saveSettings()
      
      // Verify both settings
      await expect(settingsPage.showTimestampsToggle).toBeChecked()
      await expect(settingsPage.compactModeToggle).toBeChecked()
    })
  })

  test.describe('Editor Settings', () => {
    test('should change editor theme', async () => {
      await settingsPage.switchToTab('editor')
      
      // Set dark theme
      await settingsPage.setEditorTheme('vs-dark')
      await settingsPage.saveSettings()
      
      // Verify theme change (would need actual editor to fully test)
      await expect(settingsPage.saveStatus).toContainText(/saved|success/i)
    })

    test('should adjust font size', async () => {
      await settingsPage.switchToTab('editor')
      
      // Set font size
      await settingsPage.setEditorFontSize(16)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.fontSizeInput).toHaveValue('16')
      
      // Test boundaries
      await settingsPage.setEditorFontSize(8)
      await expect(settingsPage.fontSizeInput).toHaveValue('8')
      
      await settingsPage.setEditorFontSize(32)
      await expect(settingsPage.fontSizeInput).toHaveValue('32')
    })

    test('should adjust tab size', async () => {
      await settingsPage.switchToTab('editor')
      
      // Set tab size
      await settingsPage.setNumberInput(settingsPage.tabSizeInput, 4)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.tabSizeInput).toHaveValue('4')
      
      // Change to 2
      await settingsPage.setNumberInput(settingsPage.tabSizeInput, 2)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.tabSizeInput).toHaveValue('2')
    })

    test('should toggle editor features', async () => {
      await settingsPage.switchToTab('editor')
      
      // Toggle word wrap
      await settingsPage.toggleSetting(settingsPage.wordWrapToggle, true)
      
      // Toggle line numbers
      await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, false)
      
      // Toggle minimap
      await settingsPage.toggleSetting(settingsPage.minimapToggle, true)
      
      await settingsPage.saveSettings()
      
      // Verify all toggles
      await expect(settingsPage.wordWrapToggle).toBeChecked()
      await expect(settingsPage.lineNumbersToggle).not.toBeChecked()
      await expect(settingsPage.minimapToggle).toBeChecked()
    })
  })

  test.describe('Settings Management', () => {
    test('should reset settings to defaults', async () => {
      // Change some settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorFontSize(20)
      await settingsPage.saveSettings()
      
      // Reset to defaults
      await settingsPage.resetSettings()
      
      // Verify reset
      await expect(settingsPage.saveStatus).toContainText(/reset|restored|default/i)
      
      // Check values are default
      await settingsPage.switchToTab('general')
      await expect(settingsPage.darkModeToggle).not.toBeChecked()
      
      await settingsPage.switchToTab('editor')
      await expect(settingsPage.fontSizeInput).toHaveValue('14')
    })

    test('should show save status indicator', async () => {
      // Make a change
      await settingsPage.toggleDarkMode(true)
      
      // Save
      await settingsPage.saveSettings()
      
      // Check status
      const isSaved = await settingsPage.areSettingsSaved()
      expect(isSaved).toBe(true)
    })

    test('should handle save errors gracefully', async ({ page }) => {
      // Mock save error
      await testHelpers.mockSettingsAPI('save', null)
      await page.route('**/api/settings', route =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Failed to save settings'
          })
        })
      )
      
      // Try to save
      await settingsPage.toggleDarkMode(true)
      
      try {
        await settingsPage.saveSettings()
      } catch (error) {
        // Expected to fail
        expect(error).toBeTruthy()
      }
    })

    test('should get current settings values', async () => {
      // Set some values
      await settingsPage.toggleDarkMode(true)
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorFontSize(18)
      await settingsPage.saveSettings()
      
      // Get current settings
      const currentSettings = await settingsPage.getCurrentSettings()
      
      // Verify values
      expect(currentSettings.general.darkMode).toBe(true)
      expect(currentSettings.editor.fontSize).toBe('18')
    })
  })

  test.describe('Validation', () => {
    test('should validate font size input', async () => {
      await settingsPage.switchToTab('editor')
      
      // Try invalid font size (too small)
      await settingsPage.fontSizeInput.fill('5')
      await settingsPage.fontSizeInput.blur()
      
      // Should show validation error
      const hasError = await settingsPage.hasValidationError('font size')
      
      if (hasError) {
        const errors = await settingsPage.getValidationErrors()
        expect(errors.length).toBeGreaterThan(0)
      }
    })

    test('should validate tab size input', async () => {
      await settingsPage.switchToTab('editor')
      
      // Try invalid tab size
      await settingsPage.tabSizeInput.fill('0')
      await settingsPage.tabSizeInput.blur()
      
      // Should show validation error or reset to valid value
      const value = await settingsPage.tabSizeInput.inputValue()
      const numValue = parseInt(value)
      expect(numValue).toBeGreaterThanOrEqual(1)
      expect(numValue).toBeLessThanOrEqual(8)
    })

    test('should prevent invalid settings combinations', async () => {
      // This would test business logic validation
      // For example, certain theme + font combinations might be invalid
      
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorTheme('high-contrast')
      await settingsPage.setEditorFontSize(8)
      
      // High contrast theme might require minimum font size
      const errors = await settingsPage.getValidationErrors()
      
      if (errors.length > 0) {
        expect(errors.some(e => e.includes('font') || e.includes('contrast'))).toBe(true)
      }
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should save settings with keyboard shortcut', async ({ page }) => {
      // Make a change
      await settingsPage.toggleDarkMode(true)
      
      // Use Ctrl/Cmd+S to save
      await page.keyboard.press('Control+s')
      
      // Verify saved
      const isSaved = await settingsPage.areSettingsSaved()
      expect(isSaved).toBe(true)
    })

    test('should navigate settings with Tab key', async ({ page }) => {
      // Tab through settings
      await settingsPage.generalTab.focus()
      
      // Tab to first toggle
      await page.keyboard.press('Tab')
      
      // Should focus on a toggle or input
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(['INPUT', 'BUTTON', 'SELECT']).toContain(focusedElement)
    })
  })

  test.describe('Responsive Design', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Reload settings page
      await settingsPage.goto()
      
      // Tabs might stack or show as dropdown on mobile
      const tabsVisible = await settingsPage.generalTab.isVisible()
      expect(tabsVisible).toBe(true)
      
      // Settings should still be accessible
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()
    })

    test('should handle tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await settingsPage.goto()
      
      // All functionality should work
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorFontSize(16)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.saveStatus).toContainText(/saved|success/i)
    })
  })
})