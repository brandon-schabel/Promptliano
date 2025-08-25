import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ChatPage } from '../pages/chat.page'
import { TestDataFactory } from '../fixtures/test-data'
import { TestAssertions, TestDataManager } from '../utils/test-helpers'

test.describe('Chat System', () => {
  let appPage: AppPage
  let chatPage: ChatPage
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    chatPage = new ChatPage(page)
    dataManager = new TestDataManager(page)

    // Navigate to chat page and wait for app to be ready
    await chatPage.goto()
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
  })

  test.describe('Chat Creation and Management', () => {
    test('should create a new chat session', async () => {
      await chatPage.createNewChat()

      // Verify new chat session is created
      await expect(page.getByTestId('chat-session')).toBeVisible()
      
      // Verify chat input is available
      await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible()
      
      // Verify send button is available
      await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    })

    test('should initialize chat with default provider and model', async ({ page }) => {
      await chatPage.createNewChat()

      // Verify provider selector is available
      await expect(page.getByRole('combobox', { name: 'Provider' })).toBeVisible()
      
      // Verify model selector is available
      await expect(page.getByRole('combobox', { name: 'Model' })).toBeVisible()
    })

    test('should allow switching between multiple chat sessions', async ({ page }) => {
      // Create first chat
      await chatPage.createNewChat()
      const firstChatId = await page.getAttribute('[data-testid="chat-session"]', 'data-chat-id')
      
      // Send a message in first chat
      await chatPage.sendMessage('First chat message')
      
      // Create second chat
      await chatPage.createNewChat()
      const secondChatId = await page.getAttribute('[data-testid="chat-session"]', 'data-chat-id')
      
      // Send a message in second chat
      await chatPage.sendMessage('Second chat message')
      
      // Switch back to first chat
      if (firstChatId) {
        await chatPage.switchToChat(firstChatId)
        
        // Verify first chat message is still there
        await expect(page.getByText('First chat message')).toBeVisible()
      }
    })
  })

  test.describe('Message Operations', () => {
    test.beforeEach(async ({ page }) => {
      await chatPage.createNewChat()
      // Skip provider/model setup for tests that don't need AI responses
    })

    test('should send message using Enter key', async () => {
      const testMessage = 'Hello, this is a test message!'
      
      await chatPage.sendMessage(testMessage)
      
      // Verify message appears in chat
      await expect(page.getByText(testMessage)).toBeVisible()
      
      // Verify message has correct role attribute
      await expect(page.locator('[data-message-role="user"]').getByText(testMessage)).toBeVisible()
    })

    test('should send message using Send button', async () => {
      const testMessage = 'Test message via button'
      
      await chatPage.sendMessageWithButton(testMessage)
      
      // Verify message appears in chat
      await expect(page.getByText(testMessage)).toBeVisible()
    })

    test('should handle empty messages gracefully', async ({ page }) => {
      // Try to send empty message
      await page.getByRole('textbox', { name: 'Message' }).press('Enter')
      
      // Verify no empty message is sent
      await expect(page.locator('[data-message-role="user"]')).toHaveCount(0)
    })

    test('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000) // 1000 character message
      
      await chatPage.sendMessage(longMessage)
      
      // Verify long message is handled properly
      await expect(page.getByText(longMessage)).toBeVisible()
    })

    test('should support markdown formatting in messages', async () => {
      const markdownMessage = '**Bold text** and *italic text* with `code` and\n\n```javascript\nconst test = "code block";\n```'
      
      await chatPage.verifyMarkdownRendering(markdownMessage)
      
      // Verify markdown is rendered correctly
      await expect(page.locator('strong')).toContainText('Bold text')
      await expect(page.locator('em')).toContainText('italic text')
      await expect(page.locator('code')).toContainText('code')
      await expect(page.locator('pre code')).toContainText('const test = "code block";')
    })
  })

  test.describe('AI Provider Integration', () => {
    test('should allow selecting different AI providers', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Open provider dropdown
      await page.getByRole('combobox', { name: 'Provider' }).click()
      
      // Verify provider options are available
      await expect(page.getByRole('option', { name: 'LM Studio' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'OpenAI' })).toBeVisible()
      
      // Select LM Studio provider
      await chatPage.selectProvider('LM Studio')
      
      // Verify provider is selected
      await expect(page.getByRole('combobox', { name: 'Provider' })).toContainText('LM Studio')
    })

    test('should allow selecting different models', async ({ page }) => {
      await chatPage.createNewChat()
      await chatPage.selectProvider('LM Studio')
      
      // Open model dropdown
      await page.getByRole('combobox', { name: 'Model' }).click()
      
      // Verify model options are available
      await expect(page.getByRole('option')).toHaveCountGreaterThan(0)
      
      // Select a model
      await chatPage.selectModel('GPT-OSS-20B')
      
      // Verify model is selected
      await expect(page.getByRole('combobox', { name: 'Model' })).toContainText('GPT-OSS-20B')
    })

    test('should generate AI response when LM Studio is available', async ({ page }) => {
      // Skip this test if LM Studio is not available
      const lmStudioAvailable = await page.evaluate(() => {
        return fetch('http://localhost:1234/v1/models')
          .then(() => true)
          .catch(() => false)
      })

      if (!lmStudioAvailable) {
        test.skip('LM Studio not available')
        return
      }

      await chatPage.createNewChat()
      await chatPage.selectProvider('LM Studio')
      await chatPage.selectModel('GPT-OSS-20B')
      
      await chatPage.sendMessage('Hello AI, please respond with "Hello human!"')
      
      // Wait for AI response
      await chatPage.waitForAIResponse()
      
      // Verify AI response appears
      await expect(page.locator('[data-message-role="assistant"]')).toBeVisible()
      
      const response = await chatPage.getLatestAIResponse()
      expect(response.length).toBeGreaterThan(0)
    })

    test('should handle AI provider timeout gracefully', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Mock slow AI provider response
      await page.route('**/api/chat/completions', route => {
        setTimeout(() => route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request timeout' })
        }), 1000)
      })
      
      await chatPage.sendMessage('Test timeout scenario')
      
      // Verify timeout error is handled gracefully
      await expect(page.getByText('Request timed out')).toBeVisible()
    })

    test('should show loading indicator during AI response generation', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Mock delayed AI response
      await page.route('**/api/chat/completions', route => {
        setTimeout(() => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            choices: [{ message: { content: 'Delayed response' } }] 
          })
        }), 2000)
      })
      
      await chatPage.sendMessage('Generate loading test')
      
      // Verify loading indicator appears
      await expect(page.getByTestId('ai-loading')).toBeVisible()
      
      // Wait for response and verify loading disappears
      await chatPage.waitForAIResponse()
      await expect(page.getByTestId('ai-loading')).toBeHidden()
    })
  })

  test.describe('Message Features', () => {
    test.beforeEach(async () => {
      await chatPage.createNewChat()
    })

    test('should allow editing sent messages', async () => {
      const originalMessage = 'Original message text'
      const editedMessage = 'Edited message text'
      
      await chatPage.sendMessage(originalMessage)
      await chatPage.editMessage(originalMessage, editedMessage)
      
      // Verify message was updated
      await expect(page.getByText(editedMessage)).toBeVisible()
      await expect(page.getByText(originalMessage)).toBeHidden()
    })

    test('should allow deleting messages', async () => {
      const messageToDelete = 'Message to be deleted'
      
      await chatPage.sendMessage(messageToDelete)
      await chatPage.deleteMessage(messageToDelete)
      
      // Verify message was removed
      await expect(page.getByText(messageToDelete)).toBeHidden()
    })

    test('should allow copying message content', async ({ page, context }) => {
      const messageToCopy = 'Message to copy to clipboard'
      
      await chatPage.sendMessage(messageToCopy)
      
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      
      await chatPage.copyMessage(messageToCopy)
      
      // Verify clipboard content (if browser supports it)
      const clipboardContent = await page.evaluate(() => navigator.clipboard?.readText())
      if (clipboardContent !== undefined) {
        expect(clipboardContent).toContain(messageToCopy)
      }
    })

    test('should maintain message threading', async () => {
      await chatPage.sendMessage('First message')
      await chatPage.sendMessage('Second message')
      await chatPage.sendMessage('Third message')
      
      const messages = await chatPage.getAllMessages()
      
      // Verify message order is preserved
      expect(messages).toHaveLength(3)
      expect(messages[0].content).toContain('First message')
      expect(messages[1].content).toContain('Second message')
      expect(messages[2].content).toContain('Third message')
    })
  })

  test.describe('Chat Features', () => {
    test.beforeEach(async () => {
      await chatPage.createNewChat()
    })

    test('should clear chat history', async () => {
      // Send several messages
      await chatPage.sendMessage('Message 1')
      await chatPage.sendMessage('Message 2')
      await chatPage.sendMessage('Message 3')
      
      // Clear history
      await chatPage.clearHistory()
      
      // Verify chat is empty
      const messages = await chatPage.getAllMessages()
      expect(messages).toHaveLength(0)
    })

    test('should persist chat history across page reloads', async () => {
      await chatPage.sendMessage('Persistent message')
      
      const isPersistent = await chatPage.verifyChatPersistence()
      expect(isPersistent).toBe(true)
    })

    test('should export chat transcript', async ({ page }) => {
      await chatPage.sendMessage('Message for export')
      await chatPage.sendMessage('Another message')
      
      await chatPage.exportChatTranscript()
      
      // Verify download was triggered
      // (Download verification is handled in the page object)
    })

    test('should search within chat history', async ({ page }) => {
      await chatPage.sendMessage('Searchable message about cats')
      await chatPage.sendMessage('Another message about dogs')
      await chatPage.sendMessage('Final message about birds')
      
      await chatPage.searchChatHistory('cats')
      
      // Verify search highlights the relevant message
      await expect(page.getByTestId('search-highlight')).toBeVisible()
    })

    test('should handle concurrent chat sessions', async ({ page, context }) => {
      // Open second page/tab
      const secondPage = await context.newPage()
      const secondChatPage = new ChatPage(secondPage)
      
      await secondChatPage.goto()
      await secondChatPage.createNewChat()
      
      // Send messages in both chats
      await chatPage.sendMessage('Message from first chat')
      await secondChatPage.sendMessage('Message from second chat')
      
      // Verify both chats maintain their state
      await expect(page.getByText('Message from first chat')).toBeVisible()
      await expect(secondPage.getByText('Message from second chat')).toBeVisible()
      
      await secondPage.close()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort('failed'))
      
      await chatPage.sendMessage('Test network error')
      
      // Verify error message is displayed
      await expect(page.getByText(/network error|connection failed/i)).toBeVisible()
    })

    test('should handle AI service unavailable', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Mock AI service unavailable
      await page.route('**/api/chat/completions', route => 
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' })
        })
      )
      
      await chatPage.sendMessage('Test service unavailable')
      
      // Verify appropriate error message
      await expect(page.getByText(/service unavailable|ai unavailable/i)).toBeVisible()
    })

    test('should handle malformed AI responses', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Mock malformed response
      await page.route('**/api/chat/completions', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json response'
        })
      )
      
      await chatPage.sendMessage('Test malformed response')
      
      // Verify error handling
      await expect(page.getByText(/error processing response/i)).toBeVisible()
    })

    test('should not have JavaScript console errors during normal usage', async () => {
      const consoleErrors = await chatPage.verifyNoConsoleErrors()
      
      // Verify no console errors occurred
      expect(consoleErrors).toHaveLength(0)
    })
  })

  test.describe('Performance', () => {
    test('should load chat interface within acceptable time', async ({ page }) => {
      const startTime = Date.now()
      
      await chatPage.goto()
      await appPage.waitForAppReady()
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // 3 second limit
    })

    test('should handle large chat histories efficiently', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Send many messages to test performance
      for (let i = 0; i < 50; i++) {
        await chatPage.sendMessage(`Performance test message ${i + 1}`)
      }
      
      // Verify UI remains responsive
      await expect(page.getByRole('textbox', { name: 'Message' })).toBeEnabled()
      
      const stats = await chatPage.getChatStats()
      expect(stats.messageCount).toBe(50)
    })

    test('should maintain performance with long messages', async () => {
      await chatPage.createNewChat()
      
      const longMessage = 'A'.repeat(10000) // 10KB message
      
      const startTime = Date.now()
      await chatPage.sendMessage(longMessage)
      const sendTime = Date.now() - startTime
      
      // Verify message sending performance
      expect(sendTime).toBeLessThan(2000) // 2 second limit for UI interaction
    })
  })

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Tab to chat input
      await page.keyboard.press('Tab')
      await expect(page.getByRole('textbox', { name: 'Message' })).toBeFocused()
      
      // Type message
      await page.keyboard.type('Accessibility test message')
      
      // Send with Enter
      await page.keyboard.press('Enter')
      
      // Verify message was sent
      await expect(page.getByText('Accessibility test message')).toBeVisible()
    })

    test('should have proper ARIA labels', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Verify important elements have ARIA labels
      await expect(page.getByRole('textbox', { name: 'Message' })).toHaveAttribute('aria-label')
      await expect(page.getByRole('button', { name: 'Send' })).toHaveAttribute('aria-label')
      await expect(page.getByRole('combobox', { name: 'Provider' })).toHaveAttribute('aria-label')
    })

    test('should announce AI responses to screen readers', async ({ page }) => {
      await chatPage.createNewChat()
      
      // Mock AI response
      await page.route('**/api/chat/completions', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            choices: [{ message: { content: 'AI response for accessibility test' } }] 
          })
        })
      )
      
      await chatPage.sendMessage('Test accessibility')
      await chatPage.waitForAIResponse()
      
      // Verify AI response has proper accessibility attributes
      await expect(page.locator('[data-message-role="assistant"]')).toHaveAttribute('aria-live', 'polite')
    })
  })
})