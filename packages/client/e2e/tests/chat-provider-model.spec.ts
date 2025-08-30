import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { ChatPageTestData } from '../fixtures/chat-page-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Provider and Model Management', () => {
  test.describe('Provider Selection', () => {
    test.beforeEach(async ({ page }) => {
      // Setup available providers for testing
      await TestDataManager.setupProviders(page, ChatPageTestData.testProviders)
    })

    test('should display available providers', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Click provider selector
      await chatPage.providerSelector.click()

      // Verify available providers are shown
      for (const provider of ChatPageTestData.testProviders) {
        if (provider.available) {
          await expect(page.getByTestId(`provider-option-${provider.id}`)).toBeVisible()
          await expect(page.getByText(provider.name)).toBeVisible()
        }
      }
    })

    test('should change provider and update model options', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Select OpenAI provider
      await chatPage.selectProvider('openai')

      // Verify provider changed
      await expect(chatPage.providerDisplay).toContainText('OpenAI')

      // Click model selector to see updated models
      await chatPage.modelSelector.click()

      // Verify OpenAI models are available
      await expect(page.getByTestId('model-option-gpt-4')).toBeVisible()
      await expect(page.getByTestId('model-option-gpt-4-turbo')).toBeVisible()

      // Switch to Anthropic
      await chatPage.selectProvider('anthropic')

      // Verify Anthropic models are now available
      await chatPage.modelSelector.click()
      await expect(page.getByTestId('model-option-claude-4-sonnet')).toBeVisible()
    })

    test('should handle provider switching during conversation', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send a message with default provider
      await chatPage.sendMessage('Hello from Anthropic')

      // Wait for response (mocked or real)
      await chatPage.waitForAIResponse()

      // Switch provider
      await chatPage.selectProvider('openai')
      await chatPage.selectModel('gpt-4')

      // Send another message
      await chatPage.sendMessage('Hello from OpenAI')

      // Verify both messages exist in conversation
      await expect(chatPage.getUserMessage('Hello from Anthropic')).toBeVisible()
      await expect(chatPage.getUserMessage('Hello from OpenAI')).toBeVisible()

      // Verify provider info is preserved per message (if displayed)
      const anthropicMessage = chatPage.getUserMessage('Hello from Anthropic')
      const openaiMessage = chatPage.getUserMessage('Hello from OpenAI')

      // Messages should indicate which provider was used (if UI shows this)
      // This would depend on your specific implementation
    })
  })

  test.describe('Model Selection', () => {
    test('should display available models for selected provider', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Ensure Anthropic is selected
      await chatPage.selectProvider('anthropic')

      // Click model selector
      await chatPage.modelSelector.click()

      // Verify Anthropic models are displayed
      const anthropicProvider = ChatPageTestData.testProviders.find((p) => p.id === 'anthropic')
      for (const model of anthropicProvider?.models || []) {
        await expect(page.getByTestId(`model-option-${model}`)).toBeVisible()
      }
    })

    test('should update model display when model is changed', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Select specific model
      await chatPage.selectModel('claude-3-opus-20240229')

      // Verify model display updated
      await expect(chatPage.modelDisplay).toContainText('claude-3-opus-20240229')
    })

    test('should preserve model selection across page reloads', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Select specific provider and model
      await chatPage.selectProvider('openai')
      await chatPage.selectModel('gpt-4-turbo')

      // Reload page
      await page.reload()
      await chatPage.waitForPageLoad()

      // Verify selections are preserved
      await expect(chatPage.providerDisplay).toContainText('OpenAI')
      await expect(chatPage.modelDisplay).toContainText('gpt-4-turbo')
    })
  })
})
