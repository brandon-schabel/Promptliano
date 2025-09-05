/**
 * Settings Page Object Model
 * 
 * Simplified interface for settings page that delegates to GlobalSettingsPage
 * for consistency with the test requirements.
 */

import { Page } from '@playwright/test'
import { GlobalSettingsPage } from './global-settings-page'

export class SettingsPage extends GlobalSettingsPage {
  constructor(page: Page) {
    super(page)
  }

  /**
   * Navigate to settings page
   */
  async goto(): Promise<void> {
    await this.navigateToSettings()
  }

  /**
   * Quick access methods for common operations
   */
  async toggleDarkMode(enabled: boolean): Promise<void> {
    await this.switchToTab('general')
    await this.toggleSetting(this.darkModeToggle, enabled)
  }

  async setEditorFontSize(size: number): Promise<void> {
    await this.switchToTab('editor')
    await this.setNumberInput(this.fontSizeInput, size)
  }

  async setEditorTheme(theme: string): Promise<void> {
    await this.switchToTab('editor')
    await this.selectFromDropdown(this.themeSelect, theme)
  }

  async enableAutoNameChats(enabled: boolean): Promise<void> {
    await this.switchToTab('chat')
    await this.toggleSetting(this.autoNameChatsToggle, enabled)
  }

  async saveSettings(): Promise<void> {
    await this.applySettings()
  }

  async resetSettings(): Promise<void> {
    await this.resetToDefaults()
  }

  /**
   * Check if settings are saved
   */
  async areSettingsSaved(): Promise<boolean> {
    const statusText = await this.saveStatus.textContent()
    return statusText?.includes('saved') || statusText?.includes('success') || false
  }

  /**
   * Get current settings values
   */
  async getCurrentSettings(): Promise<{
    general: any
    chat: any
    editor: any
  }> {
    const settings = {
      general: {},
      chat: {},
      editor: {}
    }

    // Get general settings
    await this.switchToTab('general')
    settings.general = {
      darkMode: await this.darkModeToggle.isChecked(),
      autoRefresh: await this.autoRefreshToggle.isChecked(),
      autoScroll: await this.autoScrollToggle.isChecked(),
      spacebarAutocomplete: await this.spacebarAutocompleteToggle.isChecked(),
      hideTooltips: await this.hideTooltipsToggle.isChecked()
    }

    // Get chat settings
    await this.switchToTab('chat')
    settings.chat = {
      autoNameChats: await this.autoNameChatsToggle.isChecked(),
      showTimestamps: await this.showTimestampsToggle.isChecked(),
      compactMode: await this.compactModeToggle.isChecked()
    }

    // Get editor settings
    await this.switchToTab('editor')
    settings.editor = {
      fontSize: await this.fontSizeInput.inputValue(),
      tabSize: await this.tabSizeInput.inputValue(),
      wordWrap: await this.wordWrapToggle.isChecked(),
      lineNumbers: await this.lineNumbersToggle.isChecked(),
      minimap: await this.minimapToggle.isChecked()
    }

    return settings
  }
}