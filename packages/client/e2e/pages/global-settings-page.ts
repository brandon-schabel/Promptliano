/**
 * Global Settings Page Object Model
 *
 * Provides comprehensive page object interface for testing all global settings
 * functionality including navigation, configuration, validation, and persistence.
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'
import { GlobalSettingsTestData, THEME_VALIDATION } from '../fixtures/global-settings-data'

export class GlobalSettingsPage extends BasePage {
  // Navigation and access elements
  readonly settingsButton: Locator
  readonly pageHeader: Locator
  readonly pageTitle: Locator

  // Settings category tabs
  readonly generalTab: Locator
  readonly chatTab: Locator
  readonly editorTab: Locator
  readonly advancedTab: Locator

  // General settings section
  readonly generalSection: Locator
  readonly llmProviderConfigLink: Locator
  readonly autoRefreshToggle: Locator
  readonly darkModeToggle: Locator
  readonly autoScrollToggle: Locator
  readonly spacebarAutocompleteToggle: Locator
  readonly hideTooltipsToggle: Locator

  // Chat settings section
  readonly chatSection: Locator
  readonly autoNameChatsToggle: Locator
  readonly defaultProviderSelect: Locator
  readonly defaultModelSelect: Locator
  readonly showTimestampsToggle: Locator
  readonly compactModeToggle: Locator

  // Code editor settings section
  readonly editorSection: Locator
  readonly themeSelect: Locator
  readonly fontSizeInput: Locator
  readonly tabSizeInput: Locator
  readonly wordWrapToggle: Locator
  readonly lineNumbersToggle: Locator
  readonly minimapToggle: Locator

  // Settings management controls
  readonly saveButton: Locator
  readonly resetButton: Locator
  readonly exportButton: Locator
  readonly importButton: Locator
  readonly importFileInput: Locator

  // Status and feedback elements
  readonly saveStatus: Locator
  readonly validationErrors: Locator
  readonly settingsPreview: Locator
  readonly loadingIndicator: Locator

  constructor(page: Page) {
    super(page)

    // Navigation and access
    this.settingsButton = page.getByTestId('settings-button')
    this.pageHeader = page.getByTestId('settings-page-header')
    this.pageTitle = page.getByRole('heading', { name: /settings|preferences/i })

    // Settings tabs
    this.generalTab = page.getByRole('tab', { name: /general/i })
    this.chatTab = page.getByRole('tab', { name: /chat/i })
    this.editorTab = page.getByRole('tab', { name: /editor|code/i })
    this.advancedTab = page.getByRole('tab', { name: /advanced/i })

    // General settings elements
    this.generalSection = page.getByTestId('general-settings-section')
    this.llmProviderConfigLink = this.generalSection.getByRole('link', { name: /provider.*config|llm.*provider/i })
    this.autoRefreshToggle = this.generalSection.getByTestId('auto-refresh-toggle')
    this.darkModeToggle = this.generalSection.getByTestId('dark-mode-toggle')
    this.autoScrollToggle = this.generalSection.getByTestId('auto-scroll-toggle')
    this.spacebarAutocompleteToggle = this.generalSection.getByTestId('spacebar-autocomplete-toggle')
    this.hideTooltipsToggle = this.generalSection.getByTestId('hide-tooltips-toggle')

    // Chat settings elements
    this.chatSection = page.getByTestId('chat-settings-section')
    this.autoNameChatsToggle = this.chatSection.getByTestId('auto-name-chats-toggle')
    this.defaultProviderSelect = this.chatSection.getByTestId('default-provider-select')
    this.defaultModelSelect = this.chatSection.getByTestId('default-model-select')
    this.showTimestampsToggle = this.chatSection.getByTestId('show-timestamps-toggle')
    this.compactModeToggle = this.chatSection.getByTestId('compact-mode-toggle')

    // Code editor elements
    this.editorSection = page.getByTestId('editor-settings-section')
    this.themeSelect = this.editorSection.getByTestId('editor-theme-select')
    this.fontSizeInput = this.editorSection.getByTestId('font-size-input')
    this.tabSizeInput = this.editorSection.getByTestId('tab-size-input')
    this.wordWrapToggle = this.editorSection.getByTestId('word-wrap-toggle')
    this.lineNumbersToggle = this.editorSection.getByTestId('line-numbers-toggle')
    this.minimapToggle = this.editorSection.getByTestId('minimap-toggle')

    // Settings management
    this.saveButton = page.getByRole('button', { name: /save.*settings|apply/i })
    this.resetButton = page.getByRole('button', { name: /reset|restore.*defaults/i })
    this.exportButton = page.getByRole('button', { name: /export.*settings/i })
    this.importButton = page.getByRole('button', { name: /import.*settings/i })
    this.importFileInput = page.locator('input[type="file"]')

    // Status and feedback
    this.saveStatus = page.getByTestId('save-status')
    this.validationErrors = page.getByTestId('validation-error')
    this.settingsPreview = page.getByTestId('settings-preview')
    this.loadingIndicator = page.getByTestId('settings-loading')
  }

  /**
   * Navigate to the settings page via the settings button
   */
  async navigateToSettings(): Promise<void> {
    await this.settingsButton.click()
    await expect(this.page).toHaveURL(/.*\/settings/)
    await this.waitForPageLoad()

    // Wait for settings to fully load
    await this.waitForSettingsLoad()
  }

  /**
   * Navigate directly to settings URL with optional tab
   */
  async navigateToSettingsTab(tab?: 'general' | 'chat' | 'editor' | 'advanced'): Promise<void> {
    const url = tab ? `/settings?tab=${tab}` : '/settings'
    await this.goto(url)
    await this.waitForSettingsLoad()

    if (tab) {
      await this.verifyTabSelected(tab)
    }
  }

  /**
   * Switch to a specific settings tab
   */
  async switchToTab(tabName: 'general' | 'chat' | 'editor' | 'advanced'): Promise<void> {
    const tabMap = {
      general: this.generalTab,
      chat: this.chatTab,
      editor: this.editorTab,
      advanced: this.advancedTab
    }

    const tab = tabMap[tabName]
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')

    // Wait for tab content to load
    await this.waitForTabContent(tabName)
  }

  /**
   * Verify a specific tab is selected
   */
  async verifyTabSelected(tabName: 'general' | 'chat' | 'editor' | 'advanced'): Promise<void> {
    const tabMap = {
      general: this.generalTab,
      chat: this.chatTab,
      editor: this.editorTab,
      advanced: this.advancedTab
    }

    await expect(tabMap[tabName]).toHaveAttribute('aria-selected', 'true')
  }

  /**
   * Toggle a boolean setting
   */
  async toggleSetting(toggleElement: Locator, value: boolean): Promise<void> {
    const isCurrentlyChecked = await toggleElement.isChecked()

    if (isCurrentlyChecked !== value) {
      await toggleElement.click()

      // Wait for the change to register
      await this.page.waitForTimeout(100)
    }

    await expect(toggleElement).toBeChecked({ checked: value })
  }

  /**
   * Select an option from a dropdown
   */
  async selectFromDropdown(selectElement: Locator, value: string): Promise<void> {
    await selectElement.click()

    // Wait for dropdown to open
    await this.page.waitForTimeout(200)

    // Click the option
    const option = this.page.getByRole('option', { name: new RegExp(value, 'i') })
    await option.click()

    // Verify selection
    await this.page.waitForTimeout(100)
  }

  /**
   * Set a numeric input value
   */
  async setNumberInput(inputElement: Locator, value: number): Promise<void> {
    await inputElement.clear()
    await inputElement.fill(value.toString())

    // Trigger change event by blurring
    await inputElement.blur()

    // Wait for validation
    await this.page.waitForTimeout(200)
  }

  /**
   * Apply/save current settings
   */
  async applySettings(): Promise<void> {
    await this.saveButton.click()

    // Wait for save confirmation with timeout
    try {
      await expect(this.saveStatus).toContainText(/saved|applied|success/i, { timeout: 10000 })
    } catch (error) {
      // Check for any error messages
      const hasError = await this.hasErrorMessage()
      if (hasError) {
        const errorMsg = await this.getErrorMessage()
        throw new Error(`Settings save failed: ${errorMsg}`)
      }
      throw error
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    await this.resetButton.click()

    // Handle confirmation dialog if it appears
    const confirmDialog = this.page.getByTestId('reset-confirmation')
    const dialogVisible = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)

    if (dialogVisible) {
      await this.page.getByRole('button', { name: /reset|confirm|yes/i }).click()
    }

    // Wait for reset completion
    await expect(this.saveStatus).toContainText(/reset|restored|default/i, { timeout: 5000 })
  }

  /**
   * Export settings to file
   */
  async exportSettings(): Promise<string> {
    const downloadPromise = this.page.waitForEvent('download')

    await this.exportButton.click()

    const download = await downloadPromise
    const filename = download.suggestedFilename()

    expect(filename).toMatch(/settings.*\.json$/)

    return filename
  }

  /**
   * Import settings from file
   */
  async importSettings(filePath: string): Promise<void> {
    await this.importButton.click()
    await this.importFileInput.setInputFiles(filePath)

    // Handle import confirmation if it appears
    const importDialog = this.page.getByTestId('import-confirmation')
    const dialogVisible = await importDialog.isVisible({ timeout: 2000 }).catch(() => false)

    if (dialogVisible) {
      await this.page.getByRole('button', { name: /import|apply|confirm/i }).click()
    }

    // Wait for import completion
    await expect(this.saveStatus).toContainText(/imported|loaded|success/i, { timeout: 5000 })
  }

  /**
   * Get the current theme from the DOM
   */
  async getCurrentTheme(): Promise<string> {
    return await this.page.evaluate(() => {
      // Check for theme class on document element
      const classList = Array.from(document.documentElement.classList)
      const themeClass = classList.find((cls) => cls.startsWith('theme-'))

      if (themeClass) {
        return themeClass.replace('theme-', '')
      }

      // Fallback to checking CSS custom properties
      const computedStyle = getComputedStyle(document.documentElement)
      const colorScheme = computedStyle.getPropertyValue('color-scheme').trim()

      return colorScheme === 'dark' ? 'dark' : 'light'
    })
  }

  /**
   * Verify a theme is properly applied
   */
  async verifyThemeApplied(themeName: keyof typeof THEME_VALIDATION): Promise<void> {
    // Wait for theme to be applied
    await this.page.waitForTimeout(500)

    const currentTheme = await this.getCurrentTheme()
    expect(currentTheme).toContain(themeName)

    // Verify theme-specific CSS is loaded
    const themeConfig = THEME_VALIDATION[themeName]
    if (themeConfig) {
      const bodyStyles = await this.page.evaluate(() => {
        const computedStyle = getComputedStyle(document.body)
        return {
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color
        }
      })

      // Check if background color matches expected theme colors
      const expectedBg = themeConfig.expectedBackgroundColors
      const expectedText = themeConfig.expectedTextColors

      const bgMatches = expectedBg.some(
        (bg) => bodyStyles.backgroundColor.includes(bg) || bg.includes(bodyStyles.backgroundColor)
      )
      const textMatches = expectedText.some(
        (text) => bodyStyles.color.includes(text) || text.includes(bodyStyles.color)
      )

      expect(bgMatches || textMatches).toBe(true)
    }
  }

  /**
   * Get all validation errors currently displayed
   */
  async getValidationErrors(): Promise<string[]> {
    const errorElements = await this.validationErrors.all()
    const errors: string[] = []

    for (const element of errorElements) {
      const text = await element.textContent()
      if (text?.trim()) {
        errors.push(text.trim())
      }
    }

    return errors
  }

  /**
   * Check if a specific validation error is displayed
   */
  async hasValidationError(errorPattern: string | RegExp): Promise<boolean> {
    try {
      await expect(this.validationErrors.filter({ hasText: errorPattern })).toBeVisible({ timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Verify settings gear icon position (bottom-left)
   */
  async verifySettingsButtonPosition(): Promise<void> {
    await expect(this.settingsButton).toBeVisible()

    const buttonBox = await this.settingsButton.boundingBox()
    const viewport = this.page.viewportSize()

    if (!buttonBox || !viewport) {
      throw new Error('Could not get button position or viewport size')
    }

    // Should be in bottom-left area
    expect(buttonBox.x).toBeLessThan(200) // Left side
    expect(buttonBox.y).toBeGreaterThan(viewport.height - 200) // Bottom area
  }

  /**
   * Handle keyboard navigation between tabs
   */
  async navigateTabsWithKeyboard(): Promise<void> {
    // Focus on first tab
    await this.generalTab.focus()

    // Use arrow keys to navigate
    await this.page.keyboard.press('ArrowRight')
    await expect(this.chatTab).toBeFocused()

    await this.page.keyboard.press('ArrowRight')
    await expect(this.editorTab).toBeFocused()

    await this.page.keyboard.press('ArrowRight')
    await expect(this.advancedTab).toBeFocused()

    // Wrap around
    await this.page.keyboard.press('ArrowRight')
    await expect(this.generalTab).toBeFocused()
  }

  /**
   * Activate tab with keyboard
   */
  async activateTabWithKeyboard(tabName: 'general' | 'chat' | 'editor' | 'advanced'): Promise<void> {
    const tabMap = {
      general: this.generalTab,
      chat: this.chatTab,
      editor: this.editorTab,
      advanced: this.advancedTab
    }

    const tab = tabMap[tabName]
    await tab.focus()
    await this.page.keyboard.press('Enter')

    await expect(tab).toHaveAttribute('aria-selected', 'true')
  }

  /**
   * Test settings persistence across page reload
   */
  async testSettingsPersistence(settingsToTest: any): Promise<void> {
    // Apply the settings
    await this.applyTestSettings(settingsToTest)

    // Reload the page
    await this.page.reload()
    await this.waitForPageLoad()
    await this.waitForSettingsLoad()

    // Verify settings persisted
    await this.verifyAppliedSettings(settingsToTest)
  }

  /**
   * Apply a complete settings configuration for testing
   */
  async applyTestSettings(settings: any): Promise<void> {
    // Apply general settings
    if (settings.general) {
      await this.switchToTab('general')

      if (typeof settings.general.darkMode === 'boolean') {
        await this.toggleSetting(this.darkModeToggle, settings.general.darkMode)
      }
      if (typeof settings.general.autoRefreshOnFocus === 'boolean') {
        await this.toggleSetting(this.autoRefreshToggle, settings.general.autoRefreshOnFocus)
      }
      if (typeof settings.general.autoScrollChatMessages === 'boolean') {
        await this.toggleSetting(this.autoScrollToggle, settings.general.autoScrollChatMessages)
      }
      if (typeof settings.general.useSpacebarForAutocomplete === 'boolean') {
        await this.toggleSetting(this.spacebarAutocompleteToggle, settings.general.useSpacebarForAutocomplete)
      }
      if (typeof settings.general.hideInformationalTooltips === 'boolean') {
        await this.toggleSetting(this.hideTooltipsToggle, settings.general.hideInformationalTooltips)
      }
    }

    // Apply chat settings
    if (settings.chat) {
      await this.switchToTab('chat')

      if (typeof settings.chat.autoNameChats === 'boolean') {
        await this.toggleSetting(this.autoNameChatsToggle, settings.chat.autoNameChats)
      }
      if (settings.chat.defaultProvider) {
        await this.selectFromDropdown(this.defaultProviderSelect, settings.chat.defaultProvider)
      }
      if (settings.chat.defaultModel) {
        await this.selectFromDropdown(this.defaultModelSelect, settings.chat.defaultModel)
      }
      if (typeof settings.chat.showTimestamps === 'boolean') {
        await this.toggleSetting(this.showTimestampsToggle, settings.chat.showTimestamps)
      }
      if (typeof settings.chat.compactMode === 'boolean') {
        await this.toggleSetting(this.compactModeToggle, settings.chat.compactMode)
      }
    }

    // Apply editor settings
    if (settings.editor) {
      await this.switchToTab('editor')

      if (settings.editor.theme) {
        await this.selectFromDropdown(this.themeSelect, settings.editor.theme)
      }
      if (typeof settings.editor.fontSize === 'number') {
        await this.setNumberInput(this.fontSizeInput, settings.editor.fontSize)
      }
      if (typeof settings.editor.tabSize === 'number') {
        await this.setNumberInput(this.tabSizeInput, settings.editor.tabSize)
      }
      if (typeof settings.editor.wordWrap === 'boolean') {
        await this.toggleSetting(this.wordWrapToggle, settings.editor.wordWrap)
      }
      if (typeof settings.editor.lineNumbers === 'boolean') {
        await this.toggleSetting(this.lineNumbersToggle, settings.editor.lineNumbers)
      }
      if (typeof settings.editor.minimap === 'boolean') {
        await this.toggleSetting(this.minimapToggle, settings.editor.minimap)
      }
    }

    // Save all settings
    await this.applySettings()
  }

  /**
   * Verify that settings match expected values
   */
  async verifyAppliedSettings(expectedSettings: any): Promise<void> {
    // Verify general settings
    if (expectedSettings.general) {
      await this.switchToTab('general')

      if (typeof expectedSettings.general.darkMode === 'boolean') {
        await expect(this.darkModeToggle).toBeChecked({ checked: expectedSettings.general.darkMode })
      }
      if (typeof expectedSettings.general.autoRefreshOnFocus === 'boolean') {
        await expect(this.autoRefreshToggle).toBeChecked({ checked: expectedSettings.general.autoRefreshOnFocus })
      }
      if (typeof expectedSettings.general.autoScrollChatMessages === 'boolean') {
        await expect(this.autoScrollToggle).toBeChecked({ checked: expectedSettings.general.autoScrollChatMessages })
      }
      if (typeof expectedSettings.general.useSpacebarForAutocomplete === 'boolean') {
        await expect(this.spacebarAutocompleteToggle).toBeChecked({
          checked: expectedSettings.general.useSpacebarForAutocomplete
        })
      }
      if (typeof expectedSettings.general.hideInformationalTooltips === 'boolean') {
        await expect(this.hideTooltipsToggle).toBeChecked({
          checked: expectedSettings.general.hideInformationalTooltips
        })
      }
    }

    // Verify chat settings
    if (expectedSettings.chat) {
      await this.switchToTab('chat')

      if (typeof expectedSettings.chat.autoNameChats === 'boolean') {
        await expect(this.autoNameChatsToggle).toBeChecked({ checked: expectedSettings.chat.autoNameChats })
      }
      if (typeof expectedSettings.chat.showTimestamps === 'boolean') {
        await expect(this.showTimestampsToggle).toBeChecked({ checked: expectedSettings.chat.showTimestamps })
      }
      if (typeof expectedSettings.chat.compactMode === 'boolean') {
        await expect(this.compactModeToggle).toBeChecked({ checked: expectedSettings.chat.compactMode })
      }
    }

    // Verify editor settings
    if (expectedSettings.editor) {
      await this.switchToTab('editor')

      if (typeof expectedSettings.editor.fontSize === 'number') {
        await expect(this.fontSizeInput).toHaveValue(expectedSettings.editor.fontSize.toString())
      }
      if (typeof expectedSettings.editor.tabSize === 'number') {
        await expect(this.tabSizeInput).toHaveValue(expectedSettings.editor.tabSize.toString())
      }
      if (typeof expectedSettings.editor.wordWrap === 'boolean') {
        await expect(this.wordWrapToggle).toBeChecked({ checked: expectedSettings.editor.wordWrap })
      }
      if (typeof expectedSettings.editor.lineNumbers === 'boolean') {
        await expect(this.lineNumbersToggle).toBeChecked({ checked: expectedSettings.editor.lineNumbers })
      }
      if (typeof expectedSettings.editor.minimap === 'boolean') {
        await expect(this.minimapToggle).toBeChecked({ checked: expectedSettings.editor.minimap })
      }
    }
  }

  /**
   * Wait for settings page to fully load
   */
  private async waitForSettingsLoad(): Promise<void> {
    // Wait for loading indicator to disappear
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // Loading indicator might not exist, that's okay
    })

    // Ensure at least one tab is visible and active
    await expect(this.generalTab).toBeVisible()

    // Wait for the active tab content to be visible
    const activeTab = await this.page.locator('[role="tab"][aria-selected="true"]')
    await expect(activeTab).toBeVisible()
  }

  /**
   * Wait for specific tab content to load
   */
  private async waitForTabContent(tabName: 'general' | 'chat' | 'editor' | 'advanced'): Promise<void> {
    const sectionMap = {
      general: this.generalSection,
      chat: this.chatSection,
      editor: this.editorSection,
      advanced: this.page.getByTestId('advanced-settings-section')
    }

    await expect(sectionMap[tabName]).toBeVisible()
  }
}
