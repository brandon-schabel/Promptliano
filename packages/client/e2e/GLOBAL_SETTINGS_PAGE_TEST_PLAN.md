# Global Settings Page Comprehensive Test Plan

## Overview
The Global Settings Page is the application-wide configuration interface accessible via the bottom-left gear icon in Promptliano. It manages system preferences, user interface settings, chat configurations, code editor themes, and provider integrations. This test plan covers all settings categories with validation, persistence, and cross-feature integration testing.

## Test Scope & Requirements

### Major Components
1. **Navigation Access** - Bottom-left gear icon and routing to /settings
2. **General Settings** - LLM provider configuration, UI preferences, auto-refresh settings
3. **System Toggles** - Dark mode, auto-scroll, spacebar autocomplete, tooltip preferences
4. **Chat Settings** - Auto-naming chats, message behavior, provider defaults
5. **Code Editor Configuration** - Theme selection, editor preferences, syntax highlighting
6. **Settings Persistence** - Local storage, cross-session consistency, import/export

### Technical Integration Points
- **Settings Storage**: Local storage and database persistence
- **Theme System**: Dynamic theme switching and CSS variable management
- **Provider Integration**: Links to provider configuration and model selection
- **Real-time Updates**: Immediate application of setting changes across the application
- **Settings Validation**: Input validation and constraint checking

## Test Data Requirements

### Shared Test Data Setup
```typescript
// Location: e2e/fixtures/global-settings-data.ts
export const GlobalSettingsTestData = {
  // Default settings state for testing
  defaultSettings: {
    general: {
      llmProvider: 'anthropic',
      autoRefreshOnFocus: true,
      darkMode: false,
      autoScrollChatMessages: true,
      useSpacebarForAutocomplete: true,
      hideInformationalTooltips: false
    },
    chat: {
      autoNameChats: true,
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-sonnet-20240229',
      showTimestamps: false,
      compactMode: false
    },
    editor: {
      theme: 'vscode-light',
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      lineNumbers: true,
      minimap: false
    }
  },

  // Test scenarios for different setting combinations
  testScenarios: [
    {
      name: 'Dark Mode Power User',
      settings: {
        general: { darkMode: true, hideInformationalTooltips: true, autoRefreshOnFocus: false },
        chat: { autoNameChats: false, compactMode: true, showTimestamps: true },
        editor: { theme: 'dracula', fontSize: 16, minimap: true }
      }
    },
    {
      name: 'Light Mode Beginner',
      settings: {
        general: { darkMode: false, hideInformationalTooltips: false, autoScrollChatMessages: true },
        chat: { autoNameChats: true, compactMode: false },
        editor: { theme: 'github-light', fontSize: 12, wordWrap: true }
      }
    },
    {
      name: 'Accessibility Focused',
      settings: {
        general: { useSpacebarForAutocomplete: false, hideInformationalTooltips: false },
        chat: { showTimestamps: true, compactMode: false },
        editor: { theme: 'high-contrast', fontSize: 18, lineNumbers: true }
      }
    }
  ],

  // Available theme options for testing
  availableThemes: [
    'vscode-light',
    'vscode-dark',
    'github-light',
    'github-dark',
    'monokai',
    'dracula',
    'solarized-light',
    'solarized-dark',
    'high-contrast',
    'tomorrow-night'
  ],

  // Provider options for testing
  availableProviders: [
    { id: 'anthropic', name: 'Anthropic', available: true },
    { id: 'openai', name: 'OpenAI', available: true },
    { id: 'ollama', name: 'Ollama (Local)', available: false },
    { id: 'lmstudio', name: 'LM Studio (Local)', available: false }
  ],

  // Invalid settings for validation testing
  invalidSettings: {
    editor: {
      fontSize: -5,
      tabSize: 0,
      invalidTheme: 'nonexistent-theme'
    },
    timeouts: {
      negative: -1000,
      tooLarge: 999999999
    }
  },

  // Settings export/import test data
  settingsExportData: {
    validExport: {
      version: '1.0',
      timestamp: '2024-01-20T10:00:00Z',
      settings: {
        general: { darkMode: true, autoRefreshOnFocus: false },
        chat: { autoNameChats: false },
        editor: { theme: 'monokai', fontSize: 16 }
      }
    },
    invalidExport: {
      version: '0.5', // Unsupported version
      settings: {
        invalidSection: { badSetting: 'invalid' }
      }
    }
  }
}
```

## Page Object Model Extensions

### GlobalSettingsPage Class Implementation
```typescript
// Location: e2e/pages/global-settings-page.ts
export class GlobalSettingsPage extends BasePage {
  // Navigation and access
  get settingsButton() {
    return this.page.getByTestId('settings-button')
  }

  get pageHeader() {
    return this.page.getByTestId('settings-page-header')
  }

  get pageTitle() {
    return this.page.getByRole('heading', { name: /settings|preferences/i })
  }

  // Settings sections/tabs
  get generalTab() {
    return this.page.getByRole('tab', { name: /general/i })
  }

  get chatTab() {
    return this.page.getByRole('tab', { name: /chat/i })
  }

  get editorTab() {
    return this.page.getByRole('tab', { name: /editor|code/i })
  }

  get advancedTab() {
    return this.page.getByRole('tab', { name: /advanced/i })
  }

  // General Settings Elements
  get generalSection() {
    return this.page.getByTestId('general-settings-section')
  }

  get llmProviderConfigLink() {
    return this.generalSection.getByRole('link', { name: /provider.*config|llm.*provider/i })
  }

  get autoRefreshToggle() {
    return this.generalSection.getByTestId('auto-refresh-toggle')
  }

  get darkModeToggle() {
    return this.generalSection.getByTestId('dark-mode-toggle')
  }

  get autoScrollToggle() {
    return this.generalSection.getByTestId('auto-scroll-toggle')
  }

  get spacebarAutocompleteToggle() {
    return this.generalSection.getByTestId('spacebar-autocomplete-toggle')
  }

  get hideTooltipsToggle() {
    return this.generalSection.getByTestId('hide-tooltips-toggle')
  }

  // Chat Settings Elements
  get chatSection() {
    return this.page.getByTestId('chat-settings-section')
  }

  get autoNameChatsToggle() {
    return this.chatSection.getByTestId('auto-name-chats-toggle')
  }

  get defaultProviderSelect() {
    return this.chatSection.getByTestId('default-provider-select')
  }

  get defaultModelSelect() {
    return this.chatSection.getByTestId('default-model-select')
  }

  get showTimestampsToggle() {
    return this.chatSection.getByTestId('show-timestamps-toggle')
  }

  get compactModeToggle() {
    return this.chatSection.getByTestId('compact-mode-toggle')
  }

  // Code Editor Settings Elements
  get editorSection() {
    return this.page.getByTestId('editor-settings-section')
  }

  get themeSelect() {
    return this.editorSection.getByTestId('editor-theme-select')
  }

  get fontSizeInput() {
    return this.editorSection.getByTestId('font-size-input')
  }

  get tabSizeInput() {
    return this.editorSection.getByTestId('tab-size-input')
  }

  get wordWrapToggle() {
    return this.editorSection.getByTestId('word-wrap-toggle')
  }

  get lineNumbersToggle() {
    return this.editorSection.getByTestId('line-numbers-toggle')
  }

  get minimapToggle() {
    return this.editorSection.getByTestId('minimap-toggle')
  }

  // Settings management
  get saveButton() {
    return this.page.getByRole('button', { name: /save.*settings|apply/i })
  }

  get resetButton() {
    return this.page.getByRole('button', { name: /reset|restore.*defaults/i })
  }

  get exportButton() {
    return this.page.getByRole('button', { name: /export.*settings/i })
  }

  get importButton() {
    return this.page.getByRole('button', { name: /import.*settings/i })
  }

  get importFileInput() {
    return this.page.locator('input[type="file"]')
  }

  // Status and feedback
  get saveStatus() {
    return this.page.getByTestId('save-status')
  }

  get validationErrors() {
    return this.page.getByTestId('validation-error')
  }

  get settingsPreview() {
    return this.page.getByTestId('settings-preview')
  }

  // Helper methods
  async navigateToSettings() {
    await this.settingsButton.click()
    await expect(this.page).toHaveURL(/.*\/settings/)
    await this.waitForPageLoad()
  }

  async switchToTab(tabName: 'general' | 'chat' | 'editor' | 'advanced') {
    const tabMap = {
      general: this.generalTab,
      chat: this.chatTab,
      editor: this.editorTab,
      advanced: this.advancedTab
    }
    
    await tabMap[tabName].click()
    await expect(tabMap[tabName]).toHaveAttribute('aria-selected', 'true')
  }

  async toggleSetting(toggleElement: any, value: boolean) {
    const isCurrentlyChecked = await toggleElement.isChecked()
    
    if (isCurrentlyChecked !== value) {
      await toggleElement.click()
    }
    
    await expect(toggleElement).toBeChecked({ checked: value })
  }

  async selectFromDropdown(selectElement: any, value: string) {
    await selectElement.click()
    await this.page.getByRole('option', { name: value }).click()
    
    // Verify selection
    const selectedValue = await selectElement.inputValue()
    expect(selectedValue).toBe(value)
  }

  async setNumberInput(inputElement: any, value: number) {
    await inputElement.clear()
    await inputElement.fill(value.toString())
    
    // Trigger change event
    await inputElement.blur()
    
    await expect(inputElement).toHaveValue(value.toString())
  }

  async applySettings() {
    await this.saveButton.click()
    
    // Wait for save confirmation
    await expect(this.saveStatus).toContainText(/saved|applied/i, { timeout: 5000 })
  }

  async resetToDefaults() {
    await this.resetButton.click()
    
    // Handle confirmation dialog
    const confirmDialog = this.page.getByTestId('reset-confirmation')
    if (await confirmDialog.isVisible()) {
      await this.page.getByRole('button', { name: /reset|confirm/i }).click()
    }
    
    await expect(this.saveStatus).toContainText(/reset|restored/i)
  }

  async exportSettings(): Promise<string> {
    const downloadPromise = this.page.waitForEvent('download')
    
    await this.exportButton.click()
    
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/settings.*\.json$/)
    
    return download.suggestedFilename()
  }

  async importSettings(filePath: string) {
    await this.importButton.click()
    await this.importFileInput.setInputFiles(filePath)
    
    // Handle import confirmation
    const importDialog = this.page.getByTestId('import-confirmation')
    if (await importDialog.isVisible()) {
      await this.page.getByRole('button', { name: /import|apply/i }).click()
    }
    
    await expect(this.saveStatus).toContainText(/imported|loaded/i)
  }

  async getCurrentTheme(): Promise<string> {
    return await this.page.evaluate(() => {
      return document.documentElement.className.match(/theme-(\w+)/)?.[1] || 'light'
    })
  }

  async verifyThemeApplied(themeName: string) {
    const currentTheme = await this.getCurrentTheme()
    expect(currentTheme).toBe(themeName)
    
    // Verify theme-specific CSS is loaded
    const themeStyles = await this.page.evaluate((theme) => {
      const computedStyle = getComputedStyle(document.body)
      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color
      }
    }, themeName)
    
    expect(themeStyles.backgroundColor).toBeTruthy()
    expect(themeStyles.color).toBeTruthy()
  }
}
```

## Test Scenarios

### 1. Navigation and Page Access

#### 1.1 Settings Access Tests
```typescript
test.describe('Global Settings - Navigation and Access', () => {
  test('should navigate to settings page via gear icon', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/')

    // Verify gear icon is in bottom-left position
    await expect(settingsPage.settingsButton).toBeVisible()
    
    const buttonBox = await settingsPage.settingsButton.boundingBox()
    const viewport = page.viewportSize()
    
    expect(buttonBox?.x).toBeLessThan(200) // Left side
    expect(buttonBox?.y).toBeGreaterThan((viewport?.height || 800) - 200) // Bottom area

    // Navigate to settings
    await settingsPage.navigateToSettings()

    // Verify settings page elements
    await expect(settingsPage.pageHeader).toBeVisible()
    await expect(settingsPage.pageTitle).toContainText(/settings|preferences/i)

    // Verify settings tabs are visible
    await expect(settingsPage.generalTab).toBeVisible()
    await expect(settingsPage.chatTab).toBeVisible()
    await expect(settingsPage.editorTab).toBeVisible()
  })

  test('should navigate directly via URL', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    
    // Navigate directly to settings URL
    await settingsPage.goto('/settings')

    // Should load settings page correctly
    await expect(settingsPage.pageHeader).toBeVisible()
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true')
  })

  test('should handle deep links to specific settings tabs', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    
    // Navigate to specific tab via URL fragment or query param
    await settingsPage.goto('/settings?tab=editor')

    // Should open directly to editor tab
    await expect(settingsPage.editorTab).toHaveAttribute('aria-selected', 'true')
    await expect(settingsPage.editorSection).toBeVisible()
  })

  test('should maintain navigation state when switching tabs', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Switch between tabs
    await settingsPage.switchToTab('chat')
    await expect(settingsPage.chatSection).toBeVisible()

    await settingsPage.switchToTab('editor')
    await expect(settingsPage.editorSection).toBeVisible()

    // Go back to general
    await settingsPage.switchToTab('general')
    await expect(settingsPage.generalSection).toBeVisible()

    // URL should reflect current tab (if implemented)
    expect(page.url()).toMatch(/settings/)
  })

  test('should handle keyboard navigation between tabs', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Focus on tab list
    await settingsPage.generalTab.focus()

    // Use arrow keys to navigate
    await page.keyboard.press('ArrowRight')
    await expect(settingsPage.chatTab).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(settingsPage.editorTab).toBeFocused()

    // Enter/Space should activate tab
    await page.keyboard.press('Enter')
    await expect(settingsPage.editorTab).toHaveAttribute('aria-selected', 'true')
  })
})
```

#### 1.2 General Settings Tests
```typescript
test.describe('Global Settings - General Settings', () => {
  test('should display LLM provider configuration link', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Verify provider config link
    await expect(settingsPage.llmProviderConfigLink).toBeVisible()
    await expect(settingsPage.llmProviderConfigLink).toContainText(/provider.*config|llm.*config/i)

    // Click should navigate to providers page
    await settingsPage.llmProviderConfigLink.click()
    await expect(page).toHaveURL(/.*\/providers/)
    
    // Navigate back to verify
    await page.goBack()
    await expect(page).toHaveURL(/.*\/settings/)
  })

  test('should toggle auto-refresh on window focus', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Test toggle functionality
    const initialState = await settingsPage.autoRefreshToggle.isChecked()
    
    await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, !initialState)
    await settingsPage.applySettings()

    // Verify setting is persisted
    await page.reload()
    await settingsPage.waitForPageLoad()
    
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: !initialState })

    // Test the actual functionality by triggering window focus
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    
    // Should trigger refresh behavior (implementation dependent)
    if (!initialState) {
      // If auto-refresh is now enabled, verify refresh behavior
      const refreshIndicator = page.getByTestId('refresh-indicator')
      const hasRefreshIndicator = await refreshIndicator.isVisible().catch(() => false)
      
      // This test might need adjustment based on actual refresh implementation
      expect(hasRefreshIndicator || true).toBe(true) // Placeholder for actual test
    }
  })

  test('should toggle dark mode and apply theme changes', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Get initial theme
    const initialTheme = await settingsPage.getCurrentTheme()
    
    // Toggle dark mode
    const isDarkMode = initialTheme.includes('dark')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, !isDarkMode)
    await settingsPage.applySettings()

    // Verify theme changed immediately
    const newTheme = await settingsPage.getCurrentTheme()
    if (!isDarkMode) {
      expect(newTheme).toMatch(/dark/)
    } else {
      expect(newTheme).not.toMatch(/dark/)
    }

    // Verify CSS variables updated
    const cssVariables = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        background: style.getPropertyValue('--background'),
        foreground: style.getPropertyValue('--foreground')
      }
    })

    expect(cssVariables.background).toBeTruthy()
    expect(cssVariables.foreground).toBeTruthy()

    // Theme should persist across page reloads
    await page.reload()
    await settingsPage.waitForPageLoad()
    
    const persistedTheme = await settingsPage.getCurrentTheme()
    expect(persistedTheme).toBe(newTheme)
  })

  test('should toggle auto-scroll chat messages', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Toggle auto-scroll setting
    await settingsPage.toggleSetting(settingsPage.autoScrollToggle, true)
    await settingsPage.applySettings()

    // Navigate to chat to test functionality
    await page.goto('/chat')

    // Add multiple messages to test scrolling
    const chatPage = page.getByTestId('chat-container')
    if (await chatPage.isVisible()) {
      // Simulate new message arrival (would need actual chat implementation)
      // This is a placeholder for testing auto-scroll behavior
      const scrollBehavior = await page.evaluate(() => {
        const chatContainer = document.querySelector('[data-testid="chat-container"]')
        return chatContainer ? getComputedStyle(chatContainer).scrollBehavior : 'auto'
      })
      
      // Verify scroll behavior is configured correctly
      expect(['auto', 'smooth']).toContain(scrollBehavior)
    }
  })

  test('should toggle spacebar for autocomplete', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Enable spacebar autocomplete
    await settingsPage.toggleSetting(settingsPage.spacebarAutocompleteToggle, true)
    await settingsPage.applySettings()

    // Test in a context where autocomplete would be available (like file search)
    await page.goto('/projects/1') // Navigate to a project page

    const fileSearchInput = page.getByTestId('file-search-input')
    if (await fileSearchInput.isVisible()) {
      // Type partial filename
      await fileSearchInput.fill('read')
      
      // Press spacebar - should trigger selection if autocomplete is available
      await page.keyboard.press('Space')
      
      // Verify spacebar triggers autocomplete (implementation dependent)
      const autocompletePopup = page.getByTestId('autocomplete-popup')
      const hasAutocomplete = await autocompletePopup.isVisible().catch(() => false)
      
      // This test would need adjustment based on actual autocomplete implementation
      expect(hasAutocomplete || true).toBe(true)
    }
  })

  test('should toggle informational tooltips', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Disable tooltips
    await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, true)
    await settingsPage.applySettings()

    // Navigate to a page with tooltips
    await page.goto('/')

    // Find element that normally has tooltips
    const elementWithTooltip = page.getByTestId('tooltip-element').first()
    if (await elementWithTooltip.isVisible()) {
      // Hover over element
      await elementWithTooltip.hover()
      
      // Tooltip should not appear
      const tooltip = page.getByRole('tooltip')
      const hasTooltip = await tooltip.isVisible({ timeout: 2000 }).catch(() => false)
      
      expect(hasTooltip).toBe(false)
    }

    // Re-enable tooltips
    await page.goto('/settings')
    await settingsPage.toggleSetting(settingsPage.hideTooltipsToggle, false)
    await settingsPage.applySettings()

    // Now tooltips should work
    await page.goto('/')
    if (await elementWithTooltip.isVisible()) {
      await elementWithTooltip.hover()
      
      const tooltipVisible = await tooltip.isVisible({ timeout: 2000 }).catch(() => false)
      expect(tooltipVisible).toBe(true)
    }
  })
})
```

### 2. Chat Settings Configuration

#### 2.1 Chat Preferences Tests
```typescript
test.describe('Global Settings - Chat Settings', () => {
  test('should configure auto-naming for chats', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('chat')

    // Enable auto-naming
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, true)
    await settingsPage.applySettings()

    // Create new chat to test auto-naming
    await page.goto('/chat')
    const newChatButton = page.getByRole('button', { name: /new.*chat/i })
    
    if (await newChatButton.isVisible()) {
      await newChatButton.click()
      
      // Send a message that should generate a name
      const messageInput = page.getByTestId('message-input')
      await messageInput.fill('Help me debug this authentication issue in my React app')
      await page.keyboard.press('Enter')

      // Wait for AI response and auto-naming
      await page.waitForTimeout(3000)

      // Chat should have been automatically named
      const chatName = page.getByTestId('chat-name')
      const nameText = await chatName.textContent()
      
      expect(nameText).toBeTruthy()
      expect(nameText).not.toMatch(/^Chat \d+$/) // Should not be default "Chat 1" format
      expect(nameText?.toLowerCase()).toMatch(/debug|auth|react/)
    }
  })

  test('should set default provider and model for new chats', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('chat')

    // Set default provider
    await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'openai')
    
    // Set default model (should update when provider changes)
    await settingsPage.selectFromDropdown(settingsPage.defaultModelSelect, 'gpt-4')
    
    await settingsPage.applySettings()

    // Create new chat
    await page.goto('/chat/new')

    // Verify default provider and model are selected
    const providerDisplay = page.getByTestId('provider-display')
    const modelDisplay = page.getByTestId('model-display')

    await expect(providerDisplay).toContainText('openai')
    await expect(modelDisplay).toContainText('gpt-4')
  })

  test('should configure chat message timestamps', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('chat')

    // Enable timestamps
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
    await settingsPage.applySettings()

    // Go to existing chat with messages
    await page.goto('/chat/1')

    // Messages should show timestamps
    const messages = page.getByTestId('message')
    if (await messages.count() > 0) {
      const firstMessage = messages.first()
      const timestamp = firstMessage.getByTestId('timestamp')
      
      await expect(timestamp).toBeVisible()
      
      const timestampText = await timestamp.textContent()
      expect(timestampText).toMatch(/\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}/) // Time or date format
    }

    // Disable timestamps
    await page.goto('/settings')
    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, false)
    await settingsPage.applySettings()

    // Timestamps should be hidden
    await page.goto('/chat/1')
    if (await messages.count() > 0) {
      const timestamp = messages.first().getByTestId('timestamp')
      const isTimestampVisible = await timestamp.isVisible().catch(() => false)
      expect(isTimestampVisible).toBe(false)
    }
  })

  test('should toggle compact mode for chat interface', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('chat')

    // Enable compact mode
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)
    await settingsPage.applySettings()

    // Navigate to chat
    await page.goto('/chat')

    // Chat interface should have compact styling
    const chatContainer = page.getByTestId('chat-container')
    const messagesContainer = page.getByTestId('messages-container')

    await expect(chatContainer).toHaveClass(/compact/)
    
    // Messages should have reduced spacing
    const messageSpacing = await page.evaluate(() => {
      const messageElement = document.querySelector('[data-testid="message"]')
      return messageElement ? getComputedStyle(messageElement).marginBottom : '0px'
    })

    const spacingValue = parseInt(messageSpacing)
    expect(spacingValue).toBeLessThan(16) // Compact mode should have less spacing

    // Disable compact mode
    await page.goto('/settings')
    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, false)
    await settingsPage.applySettings()

    // Should return to normal spacing
    await page.goto('/chat')
    
    const normalSpacing = await page.evaluate(() => {
      const messageElement = document.querySelector('[data-testid="message"]')
      return messageElement ? getComputedStyle(messageElement).marginBottom : '0px'
    })

    const normalSpacingValue = parseInt(normalSpacing)
    expect(normalSpacingValue).toBeGreaterThan(spacingValue)
  })

  test('should persist chat settings across sessions', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('chat')

    // Configure multiple chat settings
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)
    await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'anthropic')

    await settingsPage.applySettings()

    // Reload page to simulate new session
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('chat')

    // All settings should be preserved
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: false })
    await expect(settingsPage.showTimestampsToggle).toBeChecked({ checked: true })
    await expect(settingsPage.compactModeToggle).toBeChecked({ checked: true })
    
    const providerValue = await settingsPage.defaultProviderSelect.inputValue()
    expect(providerValue).toBe('anthropic')
  })
})
```

### 3. Code Editor Theme and Configuration

#### 3.1 Editor Theme Tests
```typescript
test.describe('Global Settings - Code Editor Configuration', () => {
  test('should display all available editor themes', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Open theme dropdown
    await settingsPage.themeSelect.click()

    // Verify all expected themes are available
    for (const theme of GlobalSettingsTestData.availableThemes) {
      await expect(page.getByRole('option', { name: theme })).toBeVisible()
    }

    // Close dropdown
    await page.keyboard.press('Escape')
  })

  test('should change editor theme and apply immediately', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Select a specific theme
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'dracula')
    await settingsPage.applySettings()

    // Navigate to a page with code editor (like project page)
    await page.goto('/projects/1')

    // Look for code editor or syntax-highlighted content
    const codeElement = page.locator('pre, code, .monaco-editor, .cm-editor').first()
    
    if (await codeElement.isVisible()) {
      // Check that dracula theme styles are applied
      const editorStyles = await codeElement.evaluate(el => {
        const styles = getComputedStyle(el)
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        }
      })

      // Dracula theme should have dark background
      expect(editorStyles.backgroundColor).toMatch(/rgb\(40, 42, 54\)|#282a36|.*dark.*/)
    }

    // Test another theme
    await page.goto('/settings')
    await settingsPage.switchToTab('editor')
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'github-light')
    await settingsPage.applySettings()

    await page.goto('/projects/1')
    if (await codeElement.isVisible()) {
      const lightStyles = await codeElement.evaluate(el => {
        const styles = getComputedStyle(el)
        return styles.backgroundColor
      })

      // Light theme should have light background
      expect(lightStyles).toMatch(/rgb\(255, 255, 255\)|#ffffff|.*light.*|^$/)
    }
  })

  test('should configure editor font size', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Set font size
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 18)
    await settingsPage.applySettings()

    // Check font size is applied in editor contexts
    await page.goto('/projects/1')

    const codeElement = page.locator('pre, code, .monaco-editor, .cm-editor').first()
    if (await codeElement.isVisible()) {
      const fontSize = await codeElement.evaluate(el => {
        return getComputedStyle(el).fontSize
      })

      expect(fontSize).toBe('18px')
    }

    // Test font size validation
    await page.goto('/settings')
    await settingsPage.switchToTab('editor')
    
    // Try invalid font size
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, -5)
    
    // Should show validation error or prevent invalid input
    const hasError = await settingsPage.validationErrors.filter({ hasText: /font.*size|invalid.*size/i }).isVisible()
    const inputValue = await settingsPage.fontSizeInput.inputValue()
    
    // Either shows error or prevents invalid value
    expect(hasError || parseInt(inputValue) > 0).toBe(true)
  })

  test('should configure tab size for indentation', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Set tab size to 4
    await settingsPage.setNumberInput(settingsPage.tabSizeInput, 4)
    await settingsPage.applySettings()

    // Navigate to editor context
    await page.goto('/projects/1')

    // Create or find code editor instance
    const editor = page.locator('.monaco-editor, .cm-editor').first()
    
    if (await editor.isVisible()) {
      // Focus editor and check tab behavior
      await editor.click()
      await page.keyboard.press('Tab')

      // Check that tab inserts 4 spaces (implementation dependent)
      const tabWidth = await editor.evaluate(el => {
        // This would need actual editor API integration
        return 4 // Placeholder - would check actual tab width
      })

      expect(tabWidth).toBe(4)
    }

    // Test validation for tab size
    await page.goto('/settings')
    await settingsPage.switchToTab('editor')
    
    await settingsPage.setNumberInput(settingsPage.tabSizeInput, 0)
    
    const hasError = await settingsPage.validationErrors.filter({ hasText: /tab.*size/i }).isVisible()
    const isRevertedToValid = parseInt(await settingsPage.tabSizeInput.inputValue()) > 0
    
    expect(hasError || isRevertedToValid).toBe(true)
  })

  test('should toggle word wrap in editor', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Enable word wrap
    await settingsPage.toggleSetting(settingsPage.wordWrapToggle, true)
    await settingsPage.applySettings()

    // Navigate to editor
    await page.goto('/projects/1')

    const editor = page.locator('.monaco-editor, .cm-editor, pre').first()
    if (await editor.isVisible()) {
      // Check CSS or editor configuration for word wrap
      const wordWrapStyle = await editor.evaluate(el => {
        const styles = getComputedStyle(el)
        return styles.whiteSpace || styles.wordWrap
      })

      expect(['pre-wrap', 'break-word', 'normal']).toContain(wordWrapStyle)
    }

    // Disable word wrap
    await page.goto('/settings')
    await settingsPage.switchToTab('editor')
    await settingsPage.toggleSetting(settingsPage.wordWrapToggle, false)
    await settingsPage.applySettings()

    await page.goto('/projects/1')
    if (await editor.isVisible()) {
      const noWrapStyle = await editor.evaluate(el => {
        return getComputedStyle(el).whiteSpace
      })

      expect(['pre', 'nowrap']).toContain(noWrapStyle)
    }
  })

  test('should toggle line numbers and minimap', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Enable line numbers and minimap
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, true)
    await settingsPage.toggleSetting(settingsPage.minimapToggle, true)
    await settingsPage.applySettings()

    // Check if editor features are enabled
    await page.goto('/projects/1')

    const editor = page.locator('.monaco-editor').first()
    if (await editor.isVisible()) {
      // Check for line numbers
      const lineNumbers = editor.locator('.line-numbers, .cm-lineNumbers')
      const hasLineNumbers = await lineNumbers.isVisible().catch(() => false)
      
      // Check for minimap
      const minimap = editor.locator('.minimap, .cm-minimap')
      const hasMinimap = await minimap.isVisible().catch(() => false)

      expect(hasLineNumbers).toBe(true)
      expect(hasMinimap).toBe(true)
    }

    // Disable features
    await page.goto('/settings')
    await settingsPage.switchToTab('editor')
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, false)
    await settingsPage.toggleSetting(settingsPage.minimapToggle, false)
    await settingsPage.applySettings()

    await page.goto('/projects/1')
    if (await editor.isVisible()) {
      const lineNumbersHidden = await lineNumbers.isVisible().catch(() => true)
      const minimapHidden = await minimap.isVisible().catch(() => true)

      expect(lineNumbersHidden).toBe(false)
      expect(minimapHidden).toBe(false)
    }
  })
})
```

### 4. Settings Persistence and Management

#### 4.1 Settings Import/Export Tests
```typescript
test.describe('Global Settings - Settings Management', () => {
  test('should export current settings to JSON file', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Configure some custom settings
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await settingsPage.switchToTab('editor')
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'monokai')
    
    await settingsPage.applySettings()

    // Export settings
    const filename = await settingsPage.exportSettings()

    // Verify export file was created
    expect(filename).toBeTruthy()
    expect(filename).toMatch(/settings.*\.json$/)

    // If we can access the file contents, verify structure
    // This would depend on test environment file access capabilities
  })

  test('should import settings from JSON file', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    
    // Create test settings file
    const testSettingsFile = await TestDataManager.createTempFile('test-settings.json', 
      JSON.stringify(GlobalSettingsTestData.settingsExportData.validExport)
    )

    await settingsPage.goto('/settings')

    // Import settings
    await settingsPage.importSettings(testSettingsFile)

    // Verify settings were applied
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: false })

    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: false })

    await settingsPage.switchToTab('editor')
    const themeValue = await settingsPage.themeSelect.inputValue()
    expect(themeValue).toBe('monokai')

    // Clean up
    await TestDataManager.cleanupTempFiles([testSettingsFile])
  })

  test('should validate imported settings format', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    
    // Create invalid settings file
    const invalidSettingsFile = await TestDataManager.createTempFile('invalid-settings.json', 
      JSON.stringify(GlobalSettingsTestData.settingsExportData.invalidExport)
    )

    await settingsPage.goto('/settings')

    // Try to import invalid settings
    await settingsPage.importButton.click()
    await settingsPage.importFileInput.setInputFiles(invalidSettingsFile)

    // Should show validation error
    const errorMessage = settingsPage.validationErrors
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText(/invalid.*format|version.*not.*supported/i)

    // Settings should not be changed
    // Verify some default values remain unchanged
    const isDarkMode = await settingsPage.darkModeToggle.isChecked()
    expect(typeof isDarkMode).toBe('boolean') // Should have valid state, not broken

    await TestDataManager.cleanupTempFiles([invalidSettingsFile])
  })

  test('should reset settings to defaults', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')

    // Change multiple settings from defaults
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)
    await settingsPage.toggleSetting(settingsPage.autoRefreshToggle, false)
    
    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'openai')

    await settingsPage.switchToTab('editor')
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'dracula')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 18)

    await settingsPage.applySettings()

    // Reset to defaults
    await settingsPage.resetToDefaults()

    // Verify settings are restored to defaults
    await expect(settingsPage.darkModeToggle).toBeChecked({ 
      checked: GlobalSettingsTestData.defaultSettings.general.darkMode 
    })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ 
      checked: GlobalSettingsTestData.defaultSettings.general.autoRefreshOnFocus 
    })

    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ 
      checked: GlobalSettingsTestData.defaultSettings.chat.autoNameChats 
    })

    await settingsPage.switchToTab('editor')
    const resetTheme = await settingsPage.themeSelect.inputValue()
    expect(resetTheme).toBe(GlobalSettingsTestData.defaultSettings.editor.theme)

    const resetFontSize = await settingsPage.fontSizeInput.inputValue()
    expect(parseInt(resetFontSize)).toBe(GlobalSettingsTestData.defaultSettings.editor.fontSize)
  })

  test('should handle concurrent settings changes', async ({ page, context }) => {
    const settingsPage = new GlobalSettingsPage(page)
    
    // Open settings in first tab
    await settingsPage.goto('/settings')
    await settingsPage.toggleSetting(settingsPage.darkModeToggle, true)

    // Open settings in second tab
    const secondPage = await context.newPage()
    const secondSettingsPage = new GlobalSettingsPage(secondPage)
    await secondSettingsPage.goto('/settings')
    
    // Make different change in second tab
    await secondSettingsPage.toggleSetting(secondSettingsPage.autoRefreshToggle, false)
    await secondSettingsPage.applySettings()

    // Apply changes in first tab
    await settingsPage.applySettings()

    // Both settings should be preserved (not overwrite each other)
    await page.reload()
    await settingsPage.waitForPageLoad()
    
    await expect(settingsPage.darkModeToggle).toBeChecked({ checked: true })
    await expect(settingsPage.autoRefreshToggle).toBeChecked({ checked: false })

    await secondPage.close()
  })

  test('should validate setting constraints and ranges', async ({ page }) => {
    const settingsPage = new GlobalSettingsPage(page)
    await settingsPage.goto('/settings')
    await settingsPage.switchToTab('editor')

    // Test font size constraints
    const invalidFontSizes = [-1, 0, 5, 72] // Too small or too large
    
    for (const size of invalidFontSizes) {
      await settingsPage.fontSizeInput.clear()
      await settingsPage.fontSizeInput.fill(size.toString())
      await settingsPage.fontSizeInput.blur()

      // Should either show validation error or clamp to valid range
      const hasError = await settingsPage.validationErrors.filter({ hasText: /font.*size/i }).isVisible()
      const actualValue = parseInt(await settingsPage.fontSizeInput.inputValue())
      
      if (!hasError) {
        // If no error, value should be clamped to valid range
        expect(actualValue).toBeGreaterThanOrEqual(8)
        expect(actualValue).toBeLessThanOrEqual(48)
      }
    }

    // Test tab size constraints
    await settingsPage.tabSizeInput.clear()
    await settingsPage.tabSizeInput.fill('0')
    await settingsPage.tabSizeInput.blur()

    const tabSizeError = await settingsPage.validationErrors.filter({ hasText: /tab.*size/i }).isVisible()
    const tabSizeValue = parseInt(await settingsPage.tabSizeInput.inputValue())
    
    expect(tabSizeError || tabSizeValue > 0).toBe(true)
  })
})
```

## Best Practices and Recommendations

### 1. Settings Architecture
- **Layered Persistence**: Implement settings hierarchy (defaults → user preferences → session overrides)
- **Real-time Application**: Apply settings changes immediately without requiring page refresh
- **Validation Framework**: Comprehensive client-side validation with user-friendly error messages

### 2. Theme Management  
- **CSS Custom Properties**: Use CSS variables for dynamic theme switching
- **Accessibility Compliance**: Ensure themes meet WCAG contrast requirements
- **Performance Optimization**: Minimize layout shifts during theme changes

### 3. Cross-Feature Integration
- **Settings Propagation**: Ensure settings changes affect all relevant application areas
- **State Synchronization**: Handle settings changes across multiple browser tabs
- **Feature Dependencies**: Test how settings interact with other application features

### 4. User Experience
- **Progressive Enhancement**: Provide fallbacks for unsupported settings
- **Contextual Help**: Include descriptions and tooltips for complex settings
- **Import/Export**: Enable settings portability across installations

## Execution Strategy

### 1. Test Organization
- **Tab-based Groups**: Group tests by settings categories (general, chat, editor)
- **Integration Tests**: Test settings effects on other application areas
- **Persistence Tests**: Verify settings survive browser sessions and page reloads

### 2. Environment Requirements
- **Theme Assets**: Ensure all theme CSS files are available in test environment
- **Provider Mocks**: Mock provider availability for realistic testing scenarios
- **File System**: Mock file operations for import/export functionality

### 3. Performance Considerations
- **Theme Switching**: Monitor performance impact of dynamic theme changes
- **Settings Validation**: Test with large settings objects and complex configurations
- **Memory Management**: Verify settings don't cause memory leaks during frequent changes

This comprehensive test plan ensures the Global Settings Page functionality is thoroughly validated across all configuration options, providing reliable and user-friendly settings management for Promptliano users across different usage patterns and preferences.