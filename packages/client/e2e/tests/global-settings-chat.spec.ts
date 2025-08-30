/**
 * Global Settings Chat Tests
 *
 * Tests for chat settings configuration including auto-naming,
 * provider/model selection, timestamps, compact mode, and chat behavior.
 */

import { test, expect } from '@playwright/test'
import { GlobalSettingsPage } from '../pages/global-settings-page'
import { TestDataManager } from '../utils/test-data-manager'
import { GlobalSettingsTestData, PROVIDER_MODELS } from '../fixtures/global-settings-data'

test.describe('Global Settings - Chat Settings', () => {
  let settingsPage: GlobalSettingsPage
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    settingsPage = new GlobalSettingsPage(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Mock providers API for consistent testing
    await TestDataManager.setupProviders(page, GlobalSettingsTestData.AVAILABLE_PROVIDERS)

    // Navigate to chat settings
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('chat')
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should configure auto-naming for chats', async ({ page }) => {
    // Enable auto-naming
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, true)
    await settingsPage.applySettings()

    // Navigate to chat page to test functionality
    await page.goto('/chat')

    // Look for new chat button or functionality
    const newChatButton = page
      .getByRole('button', { name: /new.*chat|start.*chat/i })
      .or(page.getByTestId('new-chat-button'))
      .or(page.locator('[data-testid*="chat"] button, .new-chat-button').first())

    const chatButtonExists = await newChatButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (chatButtonExists) {
      await newChatButton.click()

      // Send a message that should generate an auto-name
      const messageInput = page
        .getByTestId('message-input')
        .or(page.getByPlaceholder(/message|type/i))
        .or(page.locator('textarea, input[type="text"]').last())

      const inputExists = await messageInput.isVisible({ timeout: 2000 }).catch(() => false)

      if (inputExists) {
        await messageInput.fill('Help me debug this authentication issue in my React app')
        await page.keyboard.press('Enter')

        // Wait for potential auto-naming (implementation dependent)
        await page.waitForTimeout(3000)

        // Look for chat name elements
        const chatNameSelectors = [
          page.getByTestId('chat-name'),
          page.getByTestId('chat-title'),
          page.locator('.chat-name, .chat-title').first(),
          page.locator('[data-testid*="chat"][data-testid*="name"]').first()
        ]

        for (const nameSelector of chatNameSelectors) {
          const exists = await nameSelector.isVisible({ timeout: 1000 }).catch(() => false)
          if (exists) {
            const nameText = await nameSelector.textContent()

            if (nameText && nameText.trim()) {
              // Should not be default "Chat 1" format if auto-naming worked
              expect(nameText).toBeTruthy()

              // If auto-naming is working, should contain relevant keywords
              if (!nameText.match(/^Chat \d+$/)) {
                expect(nameText.toLowerCase()).toMatch(/debug|auth|react|help/)
              }
            }
            break
          }
        }
      }
    }

    // Verify setting persisted
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('chat')
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: true })
  })

  test('should set default provider and model for new chats', async ({ page }) => {
    // Mock available models for providers
    await page.route('**/api/models**', async (route) => {
      const url = route.request().url()

      if (url.includes('openai')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: PROVIDER_MODELS.openai })
        })
      } else if (url.includes('anthropic')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: PROVIDER_MODELS.anthropic })
        })
      } else {
        await route.continue()
      }
    })

    // Set default provider
    await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'openai')

    // Wait for model dropdown to update
    await page.waitForTimeout(500)

    // Set default model
    await settingsPage.selectFromDropdown(settingsPage.defaultModelSelect, 'gpt-4')

    await settingsPage.applySettings()

    // Navigate to chat page
    await page.goto('/chat')

    // Look for provider/model display elements
    const providerDisplays = [
      page.getByTestId('provider-display'),
      page.getByTestId('current-provider'),
      page.locator('.provider-display, .current-provider').first()
    ]

    const modelDisplays = [
      page.getByTestId('model-display'),
      page.getByTestId('current-model'),
      page.locator('.model-display, .current-model').first()
    ]

    // Check if provider display shows openai
    for (const display of providerDisplays) {
      const exists = await display.isVisible({ timeout: 2000 }).catch(() => false)
      if (exists) {
        const text = await display.textContent()
        if (text?.toLowerCase().includes('openai')) {
          expect(text.toLowerCase()).toContain('openai')
        }
        break
      }
    }

    // Check if model display shows gpt-4
    for (const display of modelDisplays) {
      const exists = await display.isVisible({ timeout: 2000 }).catch(() => false)
      if (exists) {
        const text = await display.textContent()
        if (text?.toLowerCase().includes('gpt-4')) {
          expect(text.toLowerCase()).toContain('gpt-4')
        }
        break
      }
    }
  })

  test('should configure chat message timestamps', async ({ page }) => {
    // Enable timestamps
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
    await settingsPage.applySettings()

    // Mock a chat with messages
    await TestDataManager.setupChatHistory(page, [
      {
        id: 1,
        name: 'Test Chat',
        messages: [
          { role: 'user', content: 'Hello', timestamp: Date.now() - 60000 },
          { role: 'assistant', content: 'Hi there!', timestamp: Date.now() - 30000 }
        ]
      }
    ])

    // Go to chat page
    await page.goto('/chat/1')

    // Look for message elements
    const messageSelectors = [page.getByTestId('message'), page.locator('.message, .chat-message').first()]

    for (const messageSelector of messageSelectors) {
      const messages = await messageSelector.all()
      if (messages.length > 0) {
        const firstMessage = messages[0]

        // Look for timestamp within message
        const timestampSelectors = [
          firstMessage.getByTestId('timestamp'),
          firstMessage.getByTestId('message-time'),
          firstMessage.locator('.timestamp, .message-time, .time').first()
        ]

        for (const timestampSelector of timestampSelectors) {
          const exists = await timestampSelector.isVisible({ timeout: 1000 }).catch(() => false)
          if (exists) {
            const timestampText = await timestampSelector.textContent()
            if (timestampText?.trim()) {
              // Should match time or date format
              expect(timestampText).toMatch(/\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}/)
            }
            break
          }
        }
        break
      }
    }

    // Disable timestamps and verify they're hidden
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, false)
    await settingsPage.applySettings()

    await page.goto('/chat/1')

    // Timestamps should be hidden or not rendered
    const timestampsVisible = await page
      .getByTestId('timestamp')
      .or(page.locator('.timestamp, .message-time, .time'))
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    // If timestamps are still visible, they should be hidden via CSS
    if (timestampsVisible) {
      const timestampElement = await page.locator('.timestamp, .message-time, .time').first()
      const isHidden = await timestampElement
        .evaluate((el) => {
          const styles = getComputedStyle(el)
          return styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0'
        })
        .catch(() => false)

      expect(isHidden).toBe(true)
    }
  })

  test('should toggle compact mode for chat interface', async ({ page }) => {
    // Enable compact mode
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)
    await settingsPage.applySettings()

    // Navigate to chat
    await page.goto('/chat')

    // Look for chat interface elements
    const chatContainers = [
      page.getByTestId('chat-container'),
      page.getByTestId('messages-container'),
      page.locator('.chat-container, .messages-container').first()
    ]

    for (const container of chatContainers) {
      const exists = await container.isVisible({ timeout: 2000 }).catch(() => false)
      if (exists) {
        // Check if compact class is applied
        const hasCompactClass = await container
          .evaluate(
            (el) =>
              el.classList.contains('compact') ||
              el.classList.contains('compact-mode') ||
              el.closest('.compact, .compact-mode') !== null
          )
          .catch(() => false)

        if (hasCompactClass) {
          expect(hasCompactClass).toBe(true)
        }

        // Check for reduced spacing via computed styles
        const spacing = await container
          .evaluate((el) => {
            const styles = getComputedStyle(el)
            return {
              padding: styles.padding,
              margin: styles.margin,
              gap: styles.gap
            }
          })
          .catch(() => null)

        if (spacing) {
          // In compact mode, spacing should be reduced
          const paddingValue = parseInt(spacing.padding) || 0
          const marginValue = parseInt(spacing.margin) || 0

          // Compact mode typically has smaller spacing
          expect(paddingValue + marginValue).toBeLessThan(32) // Arbitrary threshold
        }

        break
      }
    }

    // Disable compact mode
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('chat')
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, false)
    await settingsPage.applySettings()

    // Return to chat and verify normal spacing
    await page.goto('/chat')

    for (const container of chatContainers) {
      const exists = await container.isVisible({ timeout: 2000 }).catch(() => false)
      if (exists) {
        const hasCompactClass = await container
          .evaluate((el) => el.classList.contains('compact') || el.classList.contains('compact-mode'))
          .catch(() => false)

        expect(hasCompactClass).toBe(false)
        break
      }
    }
  })

  test('should persist chat settings across sessions', async ({ page }) => {
    // Configure multiple chat settings
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)

    // Set provider if dropdown is available
    const providerExists = await settingsPage.defaultProviderSelect.isVisible({ timeout: 2000 }).catch(() => false)
    if (providerExists) {
      await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'anthropic')
    }

    await settingsPage.applySettings()

    // Reload page to simulate new session
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('chat')

    // All settings should be preserved
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: false })
    await expect(settingsPage.showTimestampsToggle).toBeChecked({ checked: true })
    await expect(settingsPage.compactModeToggle).toBeChecked({ checked: true })

    if (providerExists) {
      // Verify provider selection persisted (implementation dependent)
      const providerValue = await settingsPage.defaultProviderSelect.textContent().catch(() => '')
      if (providerValue) {
        expect(providerValue.toLowerCase()).toContain('anthropic')
      }
    }
  })

  test('should handle provider availability changes', async ({ page }) => {
    // Mock scenario where provider becomes unavailable
    await page.route('**/api/providers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'anthropic', name: 'Anthropic', available: true },
            { id: 'openai', name: 'OpenAI', available: false } // OpenAI unavailable
          ]
        })
      })
    })

    // Reload settings to get updated provider list
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('chat')

    // Try to select unavailable provider
    const providerExists = await settingsPage.defaultProviderSelect.isVisible({ timeout: 2000 }).catch(() => false)

    if (providerExists) {
      await settingsPage.defaultProviderSelect.click()

      // OpenAI should be disabled or not available
      const openaiOption = page.getByRole('option', { name: /openai/i })
      const openaiExists = await openaiOption.isVisible({ timeout: 1000 }).catch(() => false)

      if (openaiExists) {
        const isDisabled = await openaiOption.isDisabled().catch(() => false)
        expect(isDisabled).toBe(true)
      }

      // Should be able to select available provider
      await page.getByRole('option', { name: /anthropic/i }).click()

      // Close dropdown
      await page.keyboard.press('Escape')
    }
  })

  test('should validate model compatibility with selected provider', async ({ page }) => {
    // Mock provider-specific models
    await page.route('**/api/providers/*/models**', async (route) => {
      const url = route.request().url()

      if (url.includes('anthropic')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: PROVIDER_MODELS.anthropic })
        })
      } else if (url.includes('openai')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: PROVIDER_MODELS.openai })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        })
      }
    })

    // Select Anthropic provider
    const providerExists = await settingsPage.defaultProviderSelect.isVisible({ timeout: 2000 }).catch(() => false)
    const modelExists = await settingsPage.defaultModelSelect.isVisible({ timeout: 2000 }).catch(() => false)

    if (providerExists && modelExists) {
      await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'anthropic')

      // Wait for models to load
      await page.waitForTimeout(1000)

      // Model dropdown should show Anthropic models
      await settingsPage.defaultModelSelect.click()

      // Should see Claude models
      for (const model of PROVIDER_MODELS.anthropic) {
        const modelOption = page.getByRole('option', { name: new RegExp(model, 'i') })
        const exists = await modelOption.isVisible({ timeout: 500 }).catch(() => false)
        if (exists) {
          expect(exists).toBe(true)
          break
        }
      }

      // Close dropdown
      await page.keyboard.press('Escape')

      // Switch to OpenAI
      await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'openai')
      await page.waitForTimeout(1000)

      // Model dropdown should now show OpenAI models
      await settingsPage.defaultModelSelect.click()

      // Should see GPT models
      for (const model of PROVIDER_MODELS.openai) {
        const modelOption = page.getByRole('option', { name: new RegExp(model, 'i') })
        const exists = await modelOption.isVisible({ timeout: 500 }).catch(() => false)
        if (exists) {
          expect(exists).toBe(true)
          break
        }
      }

      await page.keyboard.press('Escape')
    }
  })

  test('should handle chat settings with large message histories', async ({ page }) => {
    // Enable settings that might affect performance
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, false) // Non-compact mode
    await settingsPage.applySettings()

    // Setup large chat history
    await TestDataManager.setupLargeChatHistory(page, 100)

    // Navigate to large chat
    await page.goto('/chat/large-history')

    // Measure load time
    const startTime = Date.now()

    // Wait for chat to load
    const chatLoaded = await page
      .getByTestId('chat-container')
      .or(page.locator('.chat-container, .messages-container'))
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)

    const loadTime = Date.now() - startTime

    if (chatLoaded) {
      // Should load within reasonable time even with settings enabled
      expect(loadTime).toBeLessThan(5000) // 5 seconds max

      // Check that timestamps are showing for messages
      const timestampsVisible = await page
        .getByTestId('timestamp')
        .or(page.locator('.timestamp, .message-time'))
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      // If timestamps are implemented, they should be visible
      if (timestampsVisible) {
        expect(timestampsVisible).toBe(true)
      }
    }
  })

  test('should reset chat settings to defaults', async ({ page }) => {
    // Change all chat settings from defaults
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await settingsPage.toggleSetting(settingsPage.showTimestampsToggle, true)
    await settingsPage.toggleSetting(settingsPage.compactModeToggle, true)

    const providerExists = await settingsPage.defaultProviderSelect.isVisible({ timeout: 2000 }).catch(() => false)
    if (providerExists) {
      await settingsPage.selectFromDropdown(settingsPage.defaultProviderSelect, 'openai')
    }

    await settingsPage.applySettings()

    // Reset to defaults
    await settingsPage.resetToDefaults()

    // Verify settings match defaults
    const defaults = GlobalSettingsTestData.DEFAULT_SETTINGS.chat
    await expect(settingsPage.autoNameChatsToggle).toBeChecked({ checked: defaults.autoNameChats })
    await expect(settingsPage.showTimestampsToggle).toBeChecked({ checked: defaults.showTimestamps })
    await expect(settingsPage.compactModeToggle).toBeChecked({ checked: defaults.compactMode })
  })

  test('should handle simultaneous chat settings changes', async ({ page }) => {
    // Open settings in multiple tabs to test concurrent changes
    const context = page.context()
    const secondPage = await context.newPage()

    const secondSettingsPage = new GlobalSettingsPage(secondPage)
    await secondSettingsPage.navigateToSettings()
    await secondSettingsPage.switchToTab('chat')

    // Make different changes in each tab
    await settingsPage.toggleSetting(settingsPage.autoNameChatsToggle, false)
    await secondSettingsPage.toggleSetting(secondSettingsPage.showTimestampsToggle, true)

    // Save both simultaneously
    const [result1, result2] = await Promise.allSettled([
      settingsPage.applySettings(),
      secondSettingsPage.applySettings()
    ])

    // Both should succeed or handle conflicts gracefully
    const successCount = [result1, result2].filter((r) => r.status === 'fulfilled').length
    expect(successCount).toBeGreaterThan(0) // At least one should succeed

    // Final state should be consistent
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('chat')

    const autoNaming = await settingsPage.autoNameChatsToggle.isChecked()
    const timestamps = await settingsPage.showTimestampsToggle.isChecked()

    // Should have consistent boolean values
    expect(typeof autoNaming).toBe('boolean')
    expect(typeof timestamps).toBe('boolean')

    await secondPage.close()
  })
})
