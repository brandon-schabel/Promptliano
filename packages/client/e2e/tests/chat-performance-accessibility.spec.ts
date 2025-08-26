import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { ChatPageTestData } from '../fixtures/chat-page-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Chat Performance and Accessibility', () => {
  test.describe('Performance Tests', () => {
    test('should handle large chat histories efficiently', async ({ page }) => {
      const chatPage = new ChatPage(page)

      // Setup large chat history
      await TestDataManager.setupLargeChatHistory(page, 100) // 100 previous messages

      const startTime = Date.now()
      await chatPage.goto('/chat/large-history')

      // Should load within reasonable time
      await chatPage.waitForPageLoad()
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(5000) // 5 seconds max

      // Should be able to scroll through history smoothly
      await chatPage.messagesContainer.hover()
      await page.mouse.wheel(0, -1000) // Scroll up

      // Check that older messages are loaded/visible
      await expect(chatPage.messages.first()).toBeVisible()
    })

    test('should stream AI responses efficiently', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send message and measure response time
      const startTime = Date.now()
      await chatPage.sendMessage('Generate a detailed code review')

      // First response chunk should appear quickly
      await expect(page.getByTestId('typing-indicator')).toBeVisible({ timeout: 3000 })
      const firstChunkTime = Date.now() - startTime

      expect(firstChunkTime).toBeLessThan(3000) // First chunk within 3 seconds

      // Full response should complete in reasonable time
      await chatPage.waitForAIResponse(30000)
      const totalTime = Date.now() - startTime
      expect(totalTime).toBeLessThan(30000) // Complete response within 30 seconds
    })

    test('should maintain UI responsiveness during AI responses', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send message
      await chatPage.sendMessage('Long response test')

      // While AI is responding, UI should remain responsive
      await expect(page.getByTestId('typing-indicator')).toBeVisible()

      // Should be able to interact with other UI elements
      await chatPage.historyDrawerButton.click()
      await expect(chatPage.historyDrawer).toBeVisible()

      await chatPage.chatSettingsButton.click()
      await expect(chatPage.settingsModal).toBeVisible()

      // Close modals
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
    })
  })

  test.describe('Accessibility Tests', () => {
    test('should support keyboard navigation', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Tab to message input
      await page.keyboard.press('Tab')
      await expect(chatPage.messageInput).toBeFocused()

      // Type and send with keyboard
      await page.keyboard.type('Keyboard navigation test')
      await page.keyboard.press('Enter')

      // Should send message
      await expect(chatPage.getUserMessage('Keyboard navigation test')).toBeVisible()

      // Tab to other controls
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Should be able to access provider selector
      await page.keyboard.press('Enter') // Open provider menu

      // Arrow keys should navigate options
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter') // Select option
    })

    test('should have proper ARIA labels', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Check important elements have ARIA labels
      await expect(chatPage.messageInput).toHaveAttribute('aria-label', /message.*input|type.*message/i)
      await expect(chatPage.sendButton).toHaveAttribute('aria-label', /send.*message/i)
      await expect(chatPage.historyDrawerButton).toHaveAttribute('aria-label', /chat.*history|open.*history/i)
      await expect(chatPage.chatSettingsButton).toHaveAttribute('aria-label', /settings|chat.*settings/i)

      // Messages should have proper roles
      const userMessage = chatPage.messages.first()
      if (await userMessage.isVisible()) {
        await expect(userMessage).toHaveAttribute('role', 'article')
        await expect(userMessage).toHaveAttribute('aria-label', /message.*from|user.*message/i)
      }
    })

    test('should announce AI responses to screen readers', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Send message
      await chatPage.sendMessage('Screen reader test')

      // AI response should be announced
      await chatPage.waitForAIResponse()
      const aiResponse = chatPage.getAssistantMessage()

      // Should have aria-live region or proper announcement
      await expect(aiResponse).toHaveAttribute('aria-live', 'polite')
      // Or check for aria-label that would be announced
      const hasAnnouncementText = await aiResponse.getAttribute('aria-label')
      expect(hasAnnouncementText).toMatch(/assistant.*response|ai.*reply/i)
    })

    test('should support high contrast and color schemes', async ({ page }) => {
      const chatPage = new ChatPage(page)

      // Test with forced colors mode (Windows high contrast)
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })
      await chatPage.goto('/chat')

      // Elements should still be visible and functional
      await expect(chatPage.messageInput).toBeVisible()
      await expect(chatPage.sendButton).toBeVisible()

      // Send a message to verify functionality
      await chatPage.sendMessage('High contrast test')
      await expect(chatPage.getUserMessage('High contrast test')).toBeVisible()
    })

    test('should support zoom up to 200%', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Set zoom level to 200%
      await page.setViewportSize({ width: 640, height: 480 }) // Simulate zoomed view

      // Interface should still be usable
      await expect(chatPage.messageInput).toBeVisible()
      await expect(chatPage.sendButton).toBeVisible()

      // Should be able to send message
      await chatPage.sendMessage('Zoom test message')
      await expect(chatPage.getUserMessage('Zoom test message')).toBeVisible()

      // Navigation should work
      await chatPage.historyDrawerButton.click()
      await expect(chatPage.historyDrawer).toBeVisible()
    })

    test('should support voice control patterns', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Check for proper button text that voice control can recognize
      await expect(chatPage.sendButton).toHaveText(/send|submit/i)

      // Check for clear action names
      await expect(chatPage.historyDrawerButton).toHaveAccessibleName(/history|previous.*chats/i)
      await expect(chatPage.chatSettingsButton).toHaveAccessibleName(/settings|preferences/i)

      // Form controls should have clear labels
      await expect(chatPage.messageInput).toHaveAccessibleName(/message|text|input/i)
    })
  })
})
