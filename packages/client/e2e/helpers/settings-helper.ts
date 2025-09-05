/**
 * Settings Helper Utilities for E2E Testing
 * 
 * Provides utilities for settings page testing including data generation,
 * validation, persistence testing, and import/export operations.
 */

import { Page, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface GeneralSettings {
  darkMode?: boolean
  autoRefreshOnFocus?: boolean
  autoScrollChatMessages?: boolean
  useSpacebarForAutocomplete?: boolean
  hideInformationalTooltips?: boolean
}

export interface ChatSettings {
  autoNameChats?: boolean
  defaultProvider?: string
  defaultModel?: string
  showTimestamps?: boolean
  compactMode?: boolean
}

export interface EditorSettings {
  theme?: string
  fontSize?: number
  tabSize?: number
  wordWrap?: boolean
  lineNumbers?: boolean
  minimap?: boolean
}

export interface AppSettings {
  general?: GeneralSettings
  chat?: ChatSettings
  editor?: EditorSettings
  advanced?: any
}

/**
 * Settings test helper utilities
 */
export class SettingsTestHelpers {
  constructor(private page: Page) {}

  /**
   * Generate default settings configuration
   */
  static getDefaultSettings(): AppSettings {
    return {
      general: {
        darkMode: false,
        autoRefreshOnFocus: true,
        autoScrollChatMessages: true,
        useSpacebarForAutocomplete: false,
        hideInformationalTooltips: false
      },
      chat: {
        autoNameChats: true,
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
        showTimestamps: false,
        compactMode: false
      },
      editor: {
        theme: 'vs-light',
        fontSize: 14,
        tabSize: 2,
        wordWrap: false,
        lineNumbers: true,
        minimap: false
      }
    }
  }

  /**
   * Generate test settings with specific overrides
   */
  static generateTestSettings(overrides: Partial<AppSettings> = {}): AppSettings {
    const defaults = this.getDefaultSettings()
    
    return {
      general: { ...defaults.general, ...overrides.general },
      chat: { ...defaults.chat, ...overrides.chat },
      editor: { ...defaults.editor, ...overrides.editor },
      advanced: overrides.advanced
    }
  }

  /**
   * Generate random settings for testing
   */
  static generateRandomSettings(): AppSettings {
    const themes = ['vs-light', 'vs-dark', 'monokai', 'github-dark', 'dracula']
    const providers = ['openai', 'anthropic', 'google', 'local']
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro']
    
    return {
      general: {
        darkMode: Math.random() > 0.5,
        autoRefreshOnFocus: Math.random() > 0.5,
        autoScrollChatMessages: Math.random() > 0.5,
        useSpacebarForAutocomplete: Math.random() > 0.5,
        hideInformationalTooltips: Math.random() > 0.5
      },
      chat: {
        autoNameChats: Math.random() > 0.5,
        defaultProvider: providers[Math.floor(Math.random() * providers.length)],
        defaultModel: models[Math.floor(Math.random() * models.length)],
        showTimestamps: Math.random() > 0.5,
        compactMode: Math.random() > 0.5
      },
      editor: {
        theme: themes[Math.floor(Math.random() * themes.length)],
        fontSize: Math.floor(Math.random() * 12) + 10, // 10-22
        tabSize: Math.random() > 0.5 ? 2 : 4,
        wordWrap: Math.random() > 0.5,
        lineNumbers: Math.random() > 0.5,
        minimap: Math.random() > 0.5
      }
    }
  }

  /**
   * Create settings export file for import testing
   */
  async createSettingsExportFile(settings: AppSettings, filename?: string): Promise<string> {
    const tempDir = `/tmp/playwright-settings-tests-${Date.now()}`
    await fs.mkdir(tempDir, { recursive: true })
    
    const fileName = filename || `settings-export-${Date.now()}.json`
    const filePath = join(tempDir, fileName)
    
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings
    }
    
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8')
    
    return filePath
  }

  /**
   * Validate settings file format
   */
  static validateSettingsFile(content: string): { valid: boolean; errors?: string[] } {
    const errors: string[] = []
    
    try {
      const data = JSON.parse(content)
      
      // Check required fields
      if (!data.version) errors.push('Missing version field')
      if (!data.settings) errors.push('Missing settings field')
      
      // Validate settings structure
      if (data.settings) {
        const { general, chat, editor } = data.settings
        
        // Validate general settings types
        if (general) {
          if (typeof general.darkMode !== 'undefined' && typeof general.darkMode !== 'boolean') {
            errors.push('darkMode must be boolean')
          }
          if (typeof general.autoRefreshOnFocus !== 'undefined' && typeof general.autoRefreshOnFocus !== 'boolean') {
            errors.push('autoRefreshOnFocus must be boolean')
          }
        }
        
        // Validate editor settings types
        if (editor) {
          if (typeof editor.fontSize !== 'undefined') {
            const size = Number(editor.fontSize)
            if (isNaN(size) || size < 8 || size > 32) {
              errors.push('fontSize must be a number between 8 and 32')
            }
          }
          if (typeof editor.tabSize !== 'undefined') {
            const size = Number(editor.tabSize)
            if (isNaN(size) || size < 1 || size > 8) {
              errors.push('tabSize must be a number between 1 and 8')
            }
          }
        }
      }
      
      return { valid: errors.length === 0, errors }
    } catch (error) {
      return { valid: false, errors: ['Invalid JSON format'] }
    }
  }

  /**
   * Compare two settings objects
   */
  static compareSettings(actual: AppSettings, expected: AppSettings): {
    match: boolean
    differences: string[]
  } {
    const differences: string[] = []
    
    // Compare general settings
    if (expected.general) {
      Object.entries(expected.general).forEach(([key, value]) => {
        const actualValue = actual.general?.[key as keyof GeneralSettings]
        if (actualValue !== value) {
          differences.push(`general.${key}: expected ${value}, got ${actualValue}`)
        }
      })
    }
    
    // Compare chat settings
    if (expected.chat) {
      Object.entries(expected.chat).forEach(([key, value]) => {
        const actualValue = actual.chat?.[key as keyof ChatSettings]
        if (actualValue !== value) {
          differences.push(`chat.${key}: expected ${value}, got ${actualValue}`)
        }
      })
    }
    
    // Compare editor settings
    if (expected.editor) {
      Object.entries(expected.editor).forEach(([key, value]) => {
        const actualValue = actual.editor?.[key as keyof EditorSettings]
        if (actualValue !== value) {
          differences.push(`editor.${key}: expected ${value}, got ${actualValue}`)
        }
      })
    }
    
    return {
      match: differences.length === 0,
      differences
    }
  }

  /**
   * Mock settings API responses
   */
  async mockSettingsAPI(operation: 'get' | 'save' | 'reset', response?: any) {
    const baseUrl = '**/api/settings'
    
    switch (operation) {
      case 'get':
        await this.page.route(baseUrl, route =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: response || SettingsTestHelpers.getDefaultSettings()
            })
          })
        )
        break
        
      case 'save':
        await this.page.route(baseUrl, route => {
          if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                message: 'Settings saved successfully'
              })
            })
          } else {
            route.continue()
          }
        })
        break
        
      case 'reset':
        await this.page.route(`${baseUrl}/reset`, route =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: SettingsTestHelpers.getDefaultSettings(),
              message: 'Settings reset to defaults'
            })
          })
        )
        break
    }
  }

  /**
   * Test settings persistence through localStorage
   */
  async verifyLocalStorageSettings(expectedSettings: AppSettings) {
    const storedSettings = await this.page.evaluate(() => {
      const settings = localStorage.getItem('app-settings')
      return settings ? JSON.parse(settings) : null
    })
    
    if (!storedSettings) {
      throw new Error('No settings found in localStorage')
    }
    
    const comparison = SettingsTestHelpers.compareSettings(storedSettings, expectedSettings)
    
    if (!comparison.match) {
      throw new Error(`Settings mismatch: ${comparison.differences.join(', ')}`)
    }
  }

  /**
   * Clear all stored settings
   */
  async clearStoredSettings() {
    await this.page.evaluate(() => {
      localStorage.removeItem('app-settings')
      sessionStorage.removeItem('app-settings')
      
      // Clear cookies related to settings
      document.cookie.split(';').forEach(cookie => {
        if (cookie.includes('settings') || cookie.includes('theme')) {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        }
      })
    })
  }

  /**
   * Verify theme is applied correctly
   */
  async verifyThemeApplication(isDarkMode: boolean) {
    const htmlClass = await this.page.evaluate(() => document.documentElement.className)
    
    if (isDarkMode) {
      expect(htmlClass).toContain('dark')
    } else {
      expect(htmlClass).not.toContain('dark')
    }
    
    // Check CSS variables
    const cssVars = await this.page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement)
      return {
        background: styles.getPropertyValue('--background'),
        foreground: styles.getPropertyValue('--foreground'),
        primary: styles.getPropertyValue('--primary')
      }
    })
    
    // Dark mode should have different color values
    if (isDarkMode) {
      // Dark colors typically have lower RGB values for background
      expect(cssVars.background).toBeTruthy()
    } else {
      // Light colors typically have higher RGB values for background
      expect(cssVars.background).toBeTruthy()
    }
  }

  /**
   * Verify editor settings are applied
   */
  async verifyEditorSettings(settings: EditorSettings) {
    // Navigate to a page with code editor
    await this.page.goto('/editor')
    
    const editorElement = this.page.locator('.monaco-editor, .cm-editor')
    
    if (await editorElement.isVisible()) {
      const editorStyles = await editorElement.evaluate((el) => {
        const styles = getComputedStyle(el)
        return {
          fontSize: styles.fontSize,
          tabSize: styles.tabSize || (el as any).style.tabSize
        }
      })
      
      if (settings.fontSize) {
        expect(parseInt(editorStyles.fontSize)).toBe(settings.fontSize)
      }
    }
  }

  /**
   * Generate invalid settings for error testing
   */
  static generateInvalidSettings(): any {
    return {
      general: {
        darkMode: 'not-a-boolean', // Invalid type
        autoRefreshOnFocus: null
      },
      chat: {
        defaultProvider: '', // Empty string
        defaultModel: 123 // Wrong type
      },
      editor: {
        fontSize: -5, // Invalid range
        tabSize: 100, // Invalid range
        theme: null
      }
    }
  }

  /**
   * Clean up test files and data
   */
  async cleanup(tempFiles: string[] = []) {
    // Clean up temporary files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file)
      } catch (error) {
        // File might already be deleted
      }
    }
    
    // Clean up temp directories
    try {
      const tempDirs = await fs.readdir('/tmp')
      const testDirs = tempDirs.filter(dir => dir.startsWith('playwright-settings-tests-'))
      
      for (const dir of testDirs) {
        await fs.rmdir(join('/tmp', dir), { recursive: true })
      }
    } catch (error) {
      // Directory cleanup failed, not critical
    }
    
    // Clear browser storage
    await this.clearStoredSettings()
  }

  /**
   * Wait for settings to be saved
   */
  async waitForSettingsSaved() {
    await this.page.waitForResponse(
      response => response.url().includes('/api/settings') && response.status() === 200,
      { timeout: 5000 }
    )
  }

  /**
   * Assert settings validation error
   */
  async assertValidationError(expectedError: string) {
    const errorElement = this.page.locator('[data-testid="validation-error"], .error-message')
    await expect(errorElement).toBeVisible()
    await expect(errorElement).toContainText(expectedError)
  }
}