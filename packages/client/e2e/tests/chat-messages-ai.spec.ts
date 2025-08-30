import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { ChatPageTestData } from '../fixtures/chat-page-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Message Handling and AI Integration', () => {
  test.describe('Message Flow Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Setup AI provider mocks for consistent testing
      await TestDataManager.setupAIProviderMocks(page)
    })

    test('should handle AI response streaming', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send message
      await chatPage.sendMessage(ChatPageTestData.testMessages.simple)

      // Should show typing indicator during response
      await expect(page.getByTestId('typing-indicator')).toBeVisible()

      // Wait for AI response to complete
      await chatPage.waitForAIResponse()

      // Typing indicator should disappear
      await expect(page.getByTestId('typing-indicator')).not.toBeVisible()

      // Assistant response should appear
      const aiResponse = chatPage.getAssistantMessage()
      await expect(aiResponse).toBeVisible()
      await expect(aiResponse).toContainText(/help|assist|can|I/i) // Typical AI response patterns
    })

    test('should handle multiple provider responses', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Test with Anthropic
      await chatPage.selectProvider('anthropic')
      await chatPage.sendMessage('Hello from Anthropic test')
      await chatPage.waitForAIResponse()

      const anthropicResponse = chatPage.getAssistantMessage(0)
      await expect(anthropicResponse).toBeVisible()

      // Switch to OpenAI
      await chatPage.selectProvider('openai')
      await chatPage.sendMessage('Hello from OpenAI test')
      await chatPage.waitForAIResponse()

      const openaiResponse = chatPage.getAssistantMessage(1)
      await expect(openaiResponse).toBeVisible()

      // Both responses should be present
      await expect(chatPage.messages).toHaveCount(4) // 2 user + 2 assistant messages
    })

    test('should handle long messages gracefully', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send very long message
      await chatPage.sendMessage(ChatPageTestData.testMessages.longMessage)

      // Message should be sent and displayed
      const longUserMessage = chatPage.getUserMessage(ChatPageTestData.testMessages.longMessage)
      await expect(longUserMessage).toBeVisible()

      // Should handle response normally (may be truncated or summarized by AI)
      await chatPage.waitForAIResponse()
      const response = chatPage.getAssistantMessage()
      await expect(response).toBeVisible()
    })

    test('should handle code snippets in messages', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send message with code
      await chatPage.sendMessage(ChatPageTestData.testMessages.codeSnippet)

      // Verify code formatting is preserved
      const codeMessage = chatPage.getUserMessage(ChatPageTestData.testMessages.codeSnippet)
      await expect(codeMessage).toBeVisible()

      // Check for code block formatting
      await expect(codeMessage.locator('pre, code')).toBeVisible()
      await expect(codeMessage).toContainText('typescript')
      await expect(codeMessage).toContainText('function authenticate')

      // AI should respond appropriately to code
      await chatPage.waitForAIResponse()
      const aiResponse = chatPage.getAssistantMessage()
      await expect(aiResponse).toContainText(/code|function|review|security/i)
    })
  })

  test.describe('Error Handling Tests', () => {
    test('should handle AI service unavailable', async ({ page }) => {
      const chatPage = new ChatPage(page)

      // Mock AI service failure
      await page.route('**/api/chat/**', (route) => {
        route.fulfill({ status: 503, body: JSON.stringify({ error: 'Service unavailable' }) })
      })

      await chatPage.goto('/chat')
      await chatPage.sendMessage('Test message during service outage')

      // Should show error message
      await expect(page.getByText(/service.*unavailable|error.*occurred/i)).toBeVisible()

      // User message should still be visible
      await expect(chatPage.getUserMessage('Test message during service outage')).toBeVisible()

      // Should allow retry
      const retryButton = page.getByRole('button', { name: /retry|try again/i })
      if (await retryButton.isVisible()) {
        await retryButton.click()
      }
    })

    test('should handle network errors gracefully', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Simulate network failure during message send
      await page.setOffline(true)

      await chatPage.messageInput.fill('Message during network failure')
      await chatPage.sendButton.click()

      // Should show network error
      await expect(page.getByText(/network.*error|connection.*failed/i)).toBeVisible()

      // Restore network
      await page.setOffline(false)

      // Message should retry or allow manual retry
      const retryButton = page.getByRole('button', { name: /retry|send/i })
      if (await retryButton.isVisible()) {
        await retryButton.click()
        await chatPage.waitForAIResponse()
      }
    })

    test('should handle malformed AI responses', async ({ page }) => {
      const chatPage = new ChatPage(page)

      // Mock malformed response
      await page.route('**/api/chat/**', (route) => {
        route.fulfill({
          status: 200,
          body: 'Invalid JSON response'
        })
      })

      await chatPage.goto('/chat')
      await chatPage.sendMessage('Test malformed response')

      // Should handle error gracefully
      await expect(page.getByText(/error.*response|unexpected.*error/i)).toBeVisible()

      // User message should still be displayed
      await expect(chatPage.getUserMessage('Test malformed response')).toBeVisible()
    })

    test('should handle provider timeout gracefully', async ({ page }) => {
      const chatPage = new ChatPage(page)

      // Mock slow/timeout response
      await page.route('**/api/chat/**', (route) => {
        // Don't fulfill the route to simulate timeout
        setTimeout(() => {
          route.fulfill({ status: 408, body: JSON.stringify({ error: 'Request timeout' }) })
        }, 35000) // Longer than typical timeout
      })

      await chatPage.goto('/chat')
      await chatPage.sendMessage('Test timeout handling')

      // Should eventually show timeout error
      await expect(page.getByText(/timeout|taking.*long/i)).toBeVisible({ timeout: 40000 })
    })
  })
})
