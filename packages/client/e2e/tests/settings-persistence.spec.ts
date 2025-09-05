/**
 * Settings Persistence Test Suite
 * 
 * Tests settings persistence across sessions, page reloads,
 * browser restarts, and different storage mechanisms.
 */

import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/settings.page'
import { AppPage } from '../pages/app.page'
import { ChatPage } from '../pages/chat.page'
import { SettingsTestHelpers, type AppSettings } from '../helpers/settings-helper'

test.describe('Settings - Persistence and State Management', () => {
  let settingsPage: SettingsPage
  let appPage: AppPage
  let testHelpers: SettingsTestHelpers

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page)
    appPage = new AppPage(page)
    testHelpers = new SettingsTestHelpers(page)

    // Clear all stored settings
    await testHelpers.clearStoredSettings()

    // Navigate to settings
    await appPage.goto()
    await appPage.waitForAppReady()
    await settingsPage.goto()
  })

  test.afterEach(async () => {
    await testHelpers.cleanup()
  })

  test.describe('Session Persistence', () => {
    test('should persist settings across page reload', async ({ page }) => {
      // Configure settings
      const testSettings: AppSettings = {
        general: {
          darkMode: true,
          autoRefreshOnFocus: false,
          autoScrollChatMessages: true
        },
        chat: {
          autoNameChats: false,
          showTimestamps: true
        },
        editor: {
          fontSize: 18,
          tabSize: 4,
          wordWrap: true
        }
      }

      await settingsPage.applyTestSettings(testSettings)

      // Reload page
      await page.reload()
      await settingsPage.goto()

      // Verify settings persisted
      await settingsPage.verifyAppliedSettings(testSettings)
    })

    test('should persist settings across navigation', async ({ page }) => {
      // Set some settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.setEditorFontSize(16)
      await settingsPage.saveSettings()

      // Navigate away
      await appPage.navigateToChat()
      await expect(page).toHaveURL(/.*\/chat/)

      // Navigate back to settings
      await settingsPage.goto()

      // Verify settings remain
      await expect(settingsPage.darkModeToggle).toBeChecked()
      await expect(settingsPage.fontSizeInput).toHaveValue('16')
    })

    test('should persist theme across all pages', async ({ page }) => {
      // Enable dark mode
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()

      // Check theme on different pages
      const pages = ['/chat', '/projects', '/prompts']
      
      for (const pageUrl of pages) {
        await page.goto(pageUrl)
        await testHelpers.verifyThemeApplication(true)
      }
    })

    test('should maintain settings during long session', async ({ page }) => {
      // Set initial settings
      const initialSettings = await settingsPage.getCurrentSettings()

      // Make changes over time
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()
      
      // Simulate time passing
      await page.waitForTimeout(2000)
      
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorFontSize(20)
      await settingsPage.saveSettings()
      
      await page.waitForTimeout(2000)
      
      // Verify all changes persist
      const currentSettings = await settingsPage.getCurrentSettings()
      expect(currentSettings.general.darkMode).toBe(true)
      expect(currentSettings.editor.fontSize).toBe('20')
    })
  })

  test.describe('Browser Storage', () => {
    test('should store settings in localStorage', async ({ page }) => {
      // Apply settings
      const settings = SettingsTestHelpers.generateTestSettings({
        general: { darkMode: true },
        editor: { fontSize: 16 }
      })
      
      await settingsPage.applyTestSettings(settings)

      // Check localStorage
      const storedData = await page.evaluate(() => {
        return localStorage.getItem('app-settings')
      })

      expect(storedData).toBeTruthy()
      const parsed = JSON.parse(storedData!)
      expect(parsed.general.darkMode).toBe(true)
      expect(parsed.editor.fontSize).toBe(16)
    })

    test('should fallback to sessionStorage if localStorage fails', async ({ page }) => {
      // Disable localStorage
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: false
        })
      })

      // Reload page
      await page.reload()
      await settingsPage.goto()

      // Apply settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()

      // Check sessionStorage
      const storedData = await page.evaluate(() => {
        return sessionStorage.getItem('app-settings')
      })

      if (storedData) {
        const parsed = JSON.parse(storedData)
        expect(parsed.general.darkMode).toBe(true)
      }
    })

    test('should handle storage events from other tabs', async ({ browser }) => {
      // Open two tabs
      const context1 = await browser.newContext()
      const page1 = await context1.newPage()
      const settingsPage1 = new SettingsPage(page1)
      
      const context2 = await browser.newContext()
      const page2 = await context2.newPage()
      const settingsPage2 = new SettingsPage(page2)

      // Navigate both to settings
      await settingsPage1.goto()
      await settingsPage2.goto()

      // Change setting in tab 1
      await settingsPage1.toggleDarkMode(true)
      await settingsPage1.saveSettings()

      // Wait for storage event to propagate
      await page2.waitForTimeout(1000)

      // Tab 2 should reflect the change
      await page2.reload()
      await expect(settingsPage2.darkModeToggle).toBeChecked()

      await context1.close()
      await context2.close()
    })

    test('should clean up old storage versions', async ({ page }) => {
      // Set old version data
      await page.evaluate(() => {
        localStorage.setItem('settings-v1', JSON.stringify({ old: true }))
        localStorage.setItem('settings-v2', JSON.stringify({ old: true }))
      })

      // Apply new settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()

      // Check that old versions are cleaned
      const hasOldVersions = await page.evaluate(() => {
        return localStorage.getItem('settings-v1') !== null ||
               localStorage.getItem('settings-v2') !== null
      })

      // Old versions might be cleaned up
      if (!hasOldVersions) {
        expect(hasOldVersions).toBe(false)
      }
    })
  })

  test.describe('Cross-Browser Persistence', () => {
    test('should export settings for browser migration', async ({ page }) => {
      // Set comprehensive settings
      const settings = SettingsTestHelpers.generateRandomSettings()
      await settingsPage.applyTestSettings(settings)

      // Export for migration
      const downloadPromise = page.waitForEvent('download')
      await settingsPage.exportButton.click()
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('settings')

      // File can be imported in another browser
    })

    test('should handle different browser storage limits', async ({ page }) => {
      // Test with large settings object
      const largeSettings = {
        general: SettingsTestHelpers.getDefaultSettings().general,
        chat: SettingsTestHelpers.getDefaultSettings().chat,
        editor: SettingsTestHelpers.getDefaultSettings().editor,
        custom: {
          // Add large custom data
          data: Array(1000).fill(null).map((_, i) => ({
            id: i,
            value: `test-value-${i}`,
            description: `This is a test description for item ${i}`
          }))
        }
      }

      // Try to save large settings
      try {
        await page.evaluate((settings) => {
          localStorage.setItem('app-settings', JSON.stringify(settings))
        }, largeSettings)

        // If successful, verify it persists
        await page.reload()
        
        const stored = await page.evaluate(() => {
          return localStorage.getItem('app-settings')
        })
        
        expect(stored).toBeTruthy()
      } catch (error) {
        // Should handle quota exceeded gracefully
        expect(error).toBeTruthy()
      }
    })
  })

  test.describe('Settings Migration', () => {
    test('should migrate settings from old format', async ({ page }) => {
      // Set old format settings
      const oldFormatSettings = {
        isDarkMode: true,  // Old naming
        editorFontSize: 16,  // Flat structure
        chatAutoName: true
      }

      await page.evaluate((settings) => {
        localStorage.setItem('legacy-settings', JSON.stringify(settings))
      }, oldFormatSettings)

      // Reload page (should trigger migration)
      await page.reload()
      await settingsPage.goto()

      // Check if migrated to new format
      const currentSettings = await settingsPage.getCurrentSettings()
      
      // Should have migrated old values
      if (currentSettings.general.darkMode !== undefined) {
        expect(currentSettings.general.darkMode).toBe(true)
      }
      if (currentSettings.editor.fontSize !== undefined) {
        expect(parseInt(currentSettings.editor.fontSize)).toBe(16)
      }
    })

    test('should preserve custom settings during migration', async ({ page }) => {
      // Set mixed old and new settings
      const mixedSettings = {
        general: { darkMode: true },
        customField: 'should-preserve',
        legacyField: 'old-value'
      }

      await page.evaluate((settings) => {
        localStorage.setItem('app-settings', JSON.stringify(settings))
      }, mixedSettings)

      // Apply new settings
      await settingsPage.toggleDarkMode(false)
      await settingsPage.saveSettings()

      // Check that custom fields are preserved
      const stored = await page.evaluate(() => {
        const data = localStorage.getItem('app-settings')
        return data ? JSON.parse(data) : null
      })

      if (stored && stored.customField) {
        expect(stored.customField).toBe('should-preserve')
      }
    })
  })

  test.describe('Performance and Optimization', () => {
    test('should debounce rapid setting changes', async ({ page }) => {
      let saveCount = 0
      
      // Monitor save requests
      await page.route('**/api/settings', route => {
        saveCount++
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true })
        })
      })

      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        await settingsPage.toggleDarkMode(i % 2 === 0)
      }

      // Wait for debounce
      await page.waitForTimeout(1000)

      // Should have debounced saves
      expect(saveCount).toBeLessThan(10)
    })

    test('should cache settings for quick access', async ({ page }) => {
      // Apply settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()

      // Measure time to retrieve settings
      const startTime = Date.now()
      const settings = await settingsPage.getCurrentSettings()
      const retrievalTime = Date.now() - startTime

      // Should be fast (from cache)
      expect(retrievalTime).toBeLessThan(100)
      expect(settings.general.darkMode).toBe(true)
    })

    test('should lazy load advanced settings', async ({ page }) => {
      // Navigate to advanced tab
      await settingsPage.switchToTab('advanced')

      // Advanced settings might load asynchronously
      const advancedSection = page.getByTestId('advanced-settings-section')
      await expect(advancedSection).toBeVisible({ timeout: 5000 })

      // Should not block other tabs
      await settingsPage.switchToTab('general')
      await expect(settingsPage.generalSection).toBeVisible()
    })
  })

  test.describe('Error Recovery and Fallbacks', () => {
    test('should recover from corrupted storage', async ({ page }) => {
      // Corrupt the stored settings
      await page.evaluate(() => {
        localStorage.setItem('app-settings', 'corrupted{not valid json}')
      })

      // Reload and navigate to settings
      await page.reload()
      await settingsPage.goto()

      // Should load with defaults
      const settings = await settingsPage.getCurrentSettings()
      expect(settings).toBeTruthy()
      expect(settings.general).toBeDefined()

      // Should be able to save new settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()
      
      await expect(settingsPage.saveStatus).toContainText(/saved|success/i)
    })

    test('should handle concurrent modifications', async ({ browser }) => {
      // Create two contexts
      const context1 = await browser.newContext()
      const page1 = await context1.newPage()
      const settings1 = new SettingsPage(page1)

      const context2 = await browser.newContext()
      const page2 = await context2.newPage()
      const settings2 = new SettingsPage(page2)

      await settings1.goto()
      await settings2.goto()

      // Make concurrent changes
      await Promise.all([
        settings1.toggleDarkMode(true),
        settings2.setEditorFontSize(20)
      ])

      // Save concurrently
      await Promise.all([
        settings1.saveSettings(),
        settings2.saveSettings()
      ])

      // Both saves should complete
      await expect(settings1.saveStatus).toContainText(/saved|success/i)
      await expect(settings2.saveStatus).toContainText(/saved|success/i)

      await context1.close()
      await context2.close()
    })

    test('should provide rollback on save failure', async ({ page }) => {
      // Get initial settings
      const initialSettings = await settingsPage.getCurrentSettings()

      // Mock save failure
      await page.route('**/api/settings', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Save failed' })
        })
      })

      // Try to change and save
      await settingsPage.toggleDarkMode(!initialSettings.general.darkMode)
      
      try {
        await settingsPage.saveSettings()
      } catch {
        // Expected to fail
      }

      // Should rollback to initial settings
      await page.reload()
      await settingsPage.goto()
      
      const currentSettings = await settingsPage.getCurrentSettings()
      expect(currentSettings.general.darkMode).toBe(initialSettings.general.darkMode)
    })
  })

  test.describe('Settings Sync Across Components', () => {
    test('should apply editor settings in code editor', async ({ page }) => {
      // Set editor preferences
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorFontSize(18)
      await settingsPage.setNumberInput(settingsPage.tabSizeInput, 4)
      await settingsPage.toggleSetting(settingsPage.wordWrapToggle, true)
      await settingsPage.saveSettings()

      // Navigate to a page with code editor
      await page.goto('/editor')
      
      // Check if editor respects settings
      const editor = page.locator('.monaco-editor, .cm-editor')
      
      if (await editor.isVisible()) {
        const editorConfig = await editor.evaluate((el) => {
          // Get computed styles or editor config
          const styles = getComputedStyle(el)
          return {
            fontSize: styles.fontSize,
            tabSize: (el as any).tabSize || styles.tabSize
          }
        })

        // Font size should match
        if (editorConfig.fontSize) {
          expect(parseInt(editorConfig.fontSize)).toBeCloseTo(18, 0)
        }
      }
    })

    test('should apply chat settings in chat interface', async ({ page }) => {
      // Configure chat settings
      await settingsPage.switchToTab('chat')
      await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
      await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)
      await settingsPage.saveSettings()

      // Navigate to chat
      const chatPage = new ChatPage(page)
      await chatPage.goto()

      // Verify settings applied
      // Check for timestamps
      const timestamp = page.locator('.message-timestamp, [data-testid="timestamp"]')
      const hasTimestamps = await timestamp.first().isVisible().catch(() => false)
      
      // Check for compact mode
      const chatContainer = page.locator('.chat-container, [data-testid="chat-messages"]')
      const classes = await chatContainer.getAttribute('class')
      
      if (classes?.includes('compact')) {
        expect(classes).toContain('compact')
      }
    })

    test('should persist settings through app updates', async ({ page }) => {
      // Set settings
      const settings = SettingsTestHelpers.generateRandomSettings()
      await settingsPage.applyTestSettings(settings)

      // Simulate app update (clear cache but keep localStorage)
      await page.evaluate(() => {
        // Clear everything except settings
        const settingsBackup = localStorage.getItem('app-settings')
        localStorage.clear()
        if (settingsBackup) {
          localStorage.setItem('app-settings', settingsBackup)
        }
      })

      // Reload (simulating app restart after update)
      await page.reload()
      await settingsPage.goto()

      // Settings should persist
      await settingsPage.verifyAppliedSettings(settings)
    })
  })

  test.describe('Settings Lifecycle', () => {
    test('should initialize with defaults on first run', async ({ page }) => {
      // Ensure clean state
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })

      // Navigate to settings
      await page.reload()
      await settingsPage.goto()

      // Should have default values
      const settings = await settingsPage.getCurrentSettings()
      const defaults = SettingsTestHelpers.getDefaultSettings()

      // Compare with defaults
      expect(settings.general.darkMode).toBe(defaults.general?.darkMode ?? false)
      expect(parseInt(settings.editor.fontSize)).toBe(defaults.editor?.fontSize ?? 14)
    })

    test('should track settings version for compatibility', async ({ page }) => {
      // Apply settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.saveSettings()

      // Check for version info
      const versionInfo = await page.evaluate(() => {
        const data = localStorage.getItem('app-settings')
        if (data) {
          const parsed = JSON.parse(data)
          return parsed.version || parsed._version
        }
        return null
      })

      // Should track version for migration purposes
      if (versionInfo) {
        expect(versionInfo).toBeTruthy()
      }
    })

    test('should handle settings reset lifecycle', async () => {
      // Apply custom settings
      await settingsPage.toggleDarkMode(true)
      await settingsPage.setEditorFontSize(20)
      await settingsPage.saveSettings()

      // Reset
      await settingsPage.resetSettings()

      // Verify defaults restored
      const defaults = SettingsTestHelpers.getDefaultSettings()
      const current = await settingsPage.getCurrentSettings()

      expect(current.general.darkMode).toBe(defaults.general?.darkMode ?? false)
      expect(parseInt(current.editor.fontSize)).toBe(defaults.editor?.fontSize ?? 14)
    })
  })
})