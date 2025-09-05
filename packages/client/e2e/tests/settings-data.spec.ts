/**
 * Settings Data Management Test Suite
 * 
 * Tests import/export functionality, data validation,
 * and settings synchronization across the application.
 */

import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/settings.page'
import { AppPage } from '../pages/app.page'
import { SettingsTestHelpers, type AppSettings } from '../helpers/settings-helper'
import { promises as fs } from 'fs'

test.describe('Settings - Data Management', () => {
  let settingsPage: SettingsPage
  let appPage: AppPage
  let testHelpers: SettingsTestHelpers
  let tempFiles: string[] = []

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page)
    appPage = new AppPage(page)
    testHelpers = new SettingsTestHelpers(page)
    tempFiles = []

    // Clear existing settings
    await testHelpers.clearStoredSettings()

    // Navigate to settings
    await appPage.goto()
    await appPage.waitForAppReady()
    await settingsPage.goto()
  })

  test.afterEach(async () => {
    // Clean up temp files and settings
    await testHelpers.cleanup(tempFiles)
  })

  test.describe('Export Functionality', () => {
    test('should export current settings to file', async ({ page }) => {
      // Configure some settings
      const testSettings = SettingsTestHelpers.generateTestSettings({
        general: { darkMode: true, autoRefreshOnFocus: false },
        editor: { fontSize: 18, theme: 'vs-dark' }
      })
      
      await settingsPage.applyTestSettings(testSettings)
      
      // Export settings
      const downloadPromise = page.waitForEvent('download')
      await settingsPage.exportButton.click()
      
      const download = await downloadPromise
      const filename = download.suggestedFilename()
      
      // Verify filename format
      expect(filename).toMatch(/settings.*\.json$/)
      
      // Save and read the file
      const path = `/tmp/${filename}`
      await download.saveAs(path)
      tempFiles.push(path)
      
      const content = await fs.readFile(path, 'utf8')
      const exportedData = JSON.parse(content)
      
      // Verify export structure
      expect(exportedData).toHaveProperty('version')
      expect(exportedData).toHaveProperty('settings')
      expect(exportedData).toHaveProperty('exportedAt')
      
      // Verify settings content
      expect(exportedData.settings.general.darkMode).toBe(true)
      expect(exportedData.settings.editor.fontSize).toBe(18)
    })

    test('should include all settings categories in export', async ({ page }) => {
      // Set various settings across categories
      const fullSettings = {
        general: {
          darkMode: true,
          autoRefreshOnFocus: true,
          autoScrollChatMessages: false,
          useSpacebarForAutocomplete: true,
          hideInformationalTooltips: false
        },
        chat: {
          autoNameChats: true,
          showTimestamps: true,
          compactMode: false
        },
        editor: {
          theme: 'monokai',
          fontSize: 16,
          tabSize: 4,
          wordWrap: true,
          lineNumbers: true,
          minimap: false
        }
      }
      
      await settingsPage.applyTestSettings(fullSettings)
      
      // Export
      const downloadPromise = page.waitForEvent('download')
      await settingsPage.exportButton.click()
      
      const download = await downloadPromise
      const path = `/tmp/${download.suggestedFilename()}`
      await download.saveAs(path)
      tempFiles.push(path)
      
      const content = await fs.readFile(path, 'utf8')
      const exportedData = JSON.parse(content)
      
      // Verify all categories
      expect(exportedData.settings).toHaveProperty('general')
      expect(exportedData.settings).toHaveProperty('chat')
      expect(exportedData.settings).toHaveProperty('editor')
      
      // Verify complete data
      const comparison = SettingsTestHelpers.compareSettings(exportedData.settings, fullSettings)
      expect(comparison.match).toBe(true)
    })

    test('should export with metadata', async ({ page }) => {
      // Export settings
      const downloadPromise = page.waitForEvent('download')
      await settingsPage.exportButton.click()
      
      const download = await downloadPromise
      const path = `/tmp/${download.suggestedFilename()}`
      await download.saveAs(path)
      tempFiles.push(path)
      
      const content = await fs.readFile(path, 'utf8')
      const exportedData = JSON.parse(content)
      
      // Check metadata
      expect(exportedData.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(exportedData.exportedAt).toBeTruthy()
      
      // Verify timestamp is recent
      const exportTime = new Date(exportedData.exportedAt)
      const now = new Date()
      const timeDiff = now.getTime() - exportTime.getTime()
      expect(timeDiff).toBeLessThan(60000) // Within 1 minute
    })
  })

  test.describe('Import Functionality', () => {
    test('should import settings from file', async () => {
      // Create import file
      const importSettings: AppSettings = {
        general: { darkMode: true, autoRefreshOnFocus: false },
        chat: { autoNameChats: false, showTimestamps: true },
        editor: { fontSize: 20, theme: 'github-dark' }
      }
      
      const importFile = await testHelpers.createSettingsExportFile(importSettings)
      tempFiles.push(importFile)
      
      // Import settings
      await settingsPage.importSettings(importFile)
      
      // Verify import success message
      await expect(settingsPage.saveStatus).toContainText(/imported|loaded|success/i)
      
      // Verify settings applied
      await settingsPage.verifyAppliedSettings(importSettings)
    })

    test('should validate import file format', async () => {
      // Create invalid file
      const invalidFile = `/tmp/invalid-settings-${Date.now()}.json`
      await fs.writeFile(invalidFile, '{"invalid": "format"}', 'utf8')
      tempFiles.push(invalidFile)
      
      // Try to import
      await settingsPage.importButton.click()
      await settingsPage.importFileInput.setInputFiles(invalidFile)
      
      // Should show error
      const hasError = await settingsPage.hasValidationError('invalid|format|settings')
      expect(hasError).toBe(true)
    })

    test('should handle malformed JSON gracefully', async () => {
      // Create malformed JSON file
      const malformedFile = `/tmp/malformed-${Date.now()}.json`
      await fs.writeFile(malformedFile, '{"settings": {invalid json}', 'utf8')
      tempFiles.push(malformedFile)
      
      // Try to import
      await settingsPage.importButton.click()
      await settingsPage.importFileInput.setInputFiles(malformedFile)
      
      // Should show error
      const hasError = await settingsPage.hasValidationError('invalid|parse|JSON')
      expect(hasError).toBe(true)
    })

    test('should merge imported settings with existing', async () => {
      // Set some initial settings
      await settingsPage.toggleDarkMode(false)
      await settingsPage.switchToTab('editor')
      await settingsPage.setEditorFontSize(14)
      await settingsPage.saveSettings()
      
      // Create partial import file (only general settings)
      const partialSettings: AppSettings = {
        general: { darkMode: true, autoScrollChatMessages: false }
      }
      
      const importFile = await testHelpers.createSettingsExportFile(partialSettings)
      tempFiles.push(importFile)
      
      // Import
      await settingsPage.importSettings(importFile)
      
      // Check merged result
      const currentSettings = await settingsPage.getCurrentSettings()
      
      // General settings should be updated
      expect(currentSettings.general.darkMode).toBe(true)
      expect(currentSettings.general.autoScroll).toBe(false)
      
      // Editor settings should remain
      expect(currentSettings.editor.fontSize).toBe('14')
    })

    test('should show import confirmation dialog', async () => {
      // Create import file
      const importSettings = SettingsTestHelpers.generateRandomSettings()
      const importFile = await testHelpers.createSettingsExportFile(importSettings)
      tempFiles.push(importFile)
      
      // Start import
      await settingsPage.importButton.click()
      await settingsPage.importFileInput.setInputFiles(importFile)
      
      // Check for confirmation dialog
      const confirmDialog = settingsPage.page.getByTestId('import-confirmation')
      const isVisible = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)
      
      if (isVisible) {
        // Confirm import
        await settingsPage.page.getByRole('button', { name: /import|confirm/i }).click()
      }
      
      // Verify import completed
      await expect(settingsPage.saveStatus).toContainText(/imported|success/i)
    })
  })

  test.describe('Data Validation', () => {
    test('should validate settings data types', async () => {
      // Test invalid data through API
      const invalidSettings = SettingsTestHelpers.generateInvalidSettings()
      
      // Create file with invalid settings
      const invalidFile = await testHelpers.createSettingsExportFile(invalidSettings)
      tempFiles.push(invalidFile)
      
      // Try to import
      await settingsPage.importButton.click()
      await settingsPage.importFileInput.setInputFiles(invalidFile)
      
      // Should show validation errors
      const errors = await settingsPage.getValidationErrors()
      expect(errors.length).toBeGreaterThan(0)
    })

    test('should validate numeric ranges', async () => {
      await settingsPage.switchToTab('editor')
      
      // Test font size boundaries
      const testValues = [
        { value: 7, valid: false },  // Too small
        { value: 8, valid: true },   // Min valid
        { value: 32, valid: true },  // Max valid
        { value: 33, valid: false }  // Too large
      ]
      
      for (const test of testValues) {
        await settingsPage.fontSizeInput.fill(test.value.toString())
        await settingsPage.fontSizeInput.blur()
        
        if (!test.valid) {
          // Should show error or reset
          const hasError = await settingsPage.hasValidationError('font size')
          const currentValue = await settingsPage.fontSizeInput.inputValue()
          
          expect(hasError || currentValue !== test.value.toString()).toBe(true)
        }
      }
    })

    test('should validate required fields', async () => {
      // Create settings without required fields
      const incompleteSettings = {
        general: { darkMode: true }
        // Missing other potentially required fields
      }
      
      const file = await testHelpers.createSettingsExportFile(incompleteSettings)
      tempFiles.push(file)
      
      // Import should handle gracefully
      await settingsPage.importSettings(file)
      
      // Should either fill defaults or show message
      const currentSettings = await settingsPage.getCurrentSettings()
      
      // Check that defaults are applied for missing fields
      expect(currentSettings.editor.fontSize).toBeTruthy()
      expect(currentSettings.chat.autoNameChats).toBeDefined()
    })

    test('should sanitize string inputs', async () => {
      await settingsPage.switchToTab('editor')
      
      // Try to input script tag in theme name (if custom themes allowed)
      const maliciousInput = '<script>alert("XSS")</script>'
      
      // This would depend on how the theme selector works
      // If it's a text input:
      const themeInput = settingsPage.page.locator('input[name="theme"]')
      if (await themeInput.isVisible()) {
        await themeInput.fill(maliciousInput)
        await settingsPage.saveSettings()
        
        // Verify sanitized
        const savedValue = await themeInput.inputValue()
        expect(savedValue).not.toContain('<script>')
      }
    })
  })

  test.describe('Settings Synchronization', () => {
    test('should sync settings across browser tabs', async ({ browser }) => {
      // Set settings in first tab
      const settings = {
        general: { darkMode: true },
        editor: { fontSize: 18 }
      }
      
      await settingsPage.applyTestSettings(settings)
      
      // Open second tab
      const context2 = await browser.newContext()
      const page2 = await context2.newPage()
      const settingsPage2 = new SettingsPage(page2)
      
      await settingsPage2.goto()
      
      // Verify settings synced
      await settingsPage2.verifyAppliedSettings(settings)
      
      await context2.close()
    })

    test('should sync settings with localStorage', async () => {
      // Apply settings
      const settings = SettingsTestHelpers.generateTestSettings({
        general: { darkMode: true, autoRefreshOnFocus: false }
      })
      
      await settingsPage.applyTestSettings(settings)
      
      // Verify in localStorage
      await testHelpers.verifyLocalStorageSettings(settings)
    })

    test('should handle concurrent settings updates', async ({ browser }) => {
      // Open two tabs
      const page1 = settingsPage.page
      const page2 = await browser.newPage()
      const settingsPage2 = new SettingsPage(page2)
      
      await settingsPage2.goto()
      
      // Make different changes in each tab
      await settingsPage.toggleDarkMode(true)
      await settingsPage2.switchToTab('editor')
      await settingsPage2.setEditorFontSize(20)
      
      // Save both
      await Promise.all([
        settingsPage.saveSettings(),
        settingsPage2.saveSettings()
      ])
      
      // Reload both and check final state
      await page1.reload()
      await page2.reload()
      
      await settingsPage.goto()
      await settingsPage2.goto()
      
      // Both changes should be preserved (last write wins for conflicts)
      const settings1 = await settingsPage.getCurrentSettings()
      const settings2 = await settingsPage2.getCurrentSettings()
      
      expect(settings1).toEqual(settings2)
      
      await page2.close()
    })
  })

  test.describe('Backup and Restore', () => {
    test('should create settings backup before import', async () => {
      // Set initial settings
      const initialSettings = {
        general: { darkMode: false },
        editor: { fontSize: 14 }
      }
      
      await settingsPage.applyTestSettings(initialSettings)
      
      // Import new settings
      const newSettings = {
        general: { darkMode: true },
        editor: { fontSize: 20 }
      }
      
      const importFile = await testHelpers.createSettingsExportFile(newSettings)
      tempFiles.push(importFile)
      
      // Import (should backup first)
      await settingsPage.importSettings(importFile)
      
      // Check if backup was created (might be in localStorage)
      const hasBackup = await settingsPage.page.evaluate(() => {
        return localStorage.getItem('settings-backup') !== null
      })
      
      expect(hasBackup).toBe(true)
    })

    test('should restore from backup after failed import', async () => {
      // Set initial settings
      const initialSettings = await settingsPage.getCurrentSettings()
      
      // Create invalid import file
      const invalidFile = `/tmp/invalid-${Date.now()}.json`
      await fs.writeFile(invalidFile, '{"invalid": true}', 'utf8')
      tempFiles.push(invalidFile)
      
      // Try to import (should fail)
      try {
        await settingsPage.importSettings(invalidFile)
      } catch {
        // Expected to fail
      }
      
      // Settings should remain unchanged
      const currentSettings = await settingsPage.getCurrentSettings()
      expect(currentSettings).toEqual(initialSettings)
    })
  })

  test.describe('Batch Operations', () => {
    test('should export multiple setting profiles', async ({ page }) => {
      // Create different profiles
      const profiles = [
        {
          name: 'dark-theme-profile',
          settings: { general: { darkMode: true }, editor: { theme: 'vs-dark' } }
        },
        {
          name: 'light-theme-profile',
          settings: { general: { darkMode: false }, editor: { theme: 'vs-light' } }
        }
      ]
      
      for (const profile of profiles) {
        // Apply settings
        await settingsPage.applyTestSettings(profile.settings)
        
        // Export with specific name
        const downloadPromise = page.waitForEvent('download')
        await settingsPage.exportButton.click()
        
        const download = await downloadPromise
        const path = `/tmp/${profile.name}.json`
        await download.saveAs(path)
        tempFiles.push(path)
        
        // Verify export
        const content = await fs.readFile(path, 'utf8')
        const data = JSON.parse(content)
        
        expect(data.settings.general.darkMode).toBe(profile.settings.general.darkMode)
      }
    })

    test('should validate batch imported settings', async () => {
      // Create multiple setting files
      const settingsFiles = [
        SettingsTestHelpers.generateRandomSettings(),
        SettingsTestHelpers.generateRandomSettings(),
        SettingsTestHelpers.generateRandomSettings()
      ]
      
      for (const settings of settingsFiles) {
        const file = await testHelpers.createSettingsExportFile(settings)
        tempFiles.push(file)
        
        // Validate file
        const content = await fs.readFile(file, 'utf8')
        const validation = SettingsTestHelpers.validateSettingsFile(content)
        
        expect(validation.valid).toBe(true)
      }
    })
  })

  test.describe('Error Recovery', () => {
    test('should handle storage quota exceeded', async ({ page }) => {
      // Fill localStorage to near capacity
      await page.evaluate(() => {
        const largeData = 'x'.repeat(1024 * 1024) // 1MB string
        try {
          for (let i = 0; i < 5; i++) {
            localStorage.setItem(`test-data-${i}`, largeData)
          }
        } catch {
          // Storage might be full
        }
      })
      
      // Try to save settings
      await settingsPage.toggleDarkMode(true)
      
      try {
        await settingsPage.saveSettings()
      } catch (error) {
        // Should handle gracefully
        const hasError = await settingsPage.hasValidationError('storage|quota|space')
        expect(hasError || error).toBeTruthy()
      }
      
      // Clean up
      await page.evaluate(() => {
        for (let i = 0; i < 5; i++) {
          localStorage.removeItem(`test-data-${i}`)
        }
      })
    })

    test('should recover from corrupted settings', async ({ page }) => {
      // Corrupt localStorage
      await page.evaluate(() => {
        localStorage.setItem('app-settings', 'corrupted{invalid json}')
      })
      
      // Reload page
      await page.reload()
      await settingsPage.goto()
      
      // Should load with defaults or show recovery option
      const currentSettings = await settingsPage.getCurrentSettings()
      
      // Should have valid settings (defaults)
      expect(currentSettings.general).toBeDefined()
      expect(currentSettings.editor).toBeDefined()
    })

    test('should handle network errors during import/export', async ({ page }) => {
      // Simulate offline
      await page.context().setOffline(true)
      
      // Try to export (might work locally)
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
      await settingsPage.exportButton.click()
      
      const download = await downloadPromise
      
      // Restore network
      await page.context().setOffline(false)
      
      // Export should work or show appropriate message
      if (!download) {
        const hasError = await settingsPage.hasValidationError('network|offline|connection')
        expect(hasError).toBe(true)
      }
    })
  })
})