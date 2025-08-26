import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { ChatPageTestData } from '../fixtures/chat-page-data'

test.describe('Chat Interface Basic Functionality', () => {
  test.describe('Chat Header and Navigation', () => {
    test('should display chat history drawer button in header', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Verify header exists
      await expect(chatPage.chatHeader).toBeVisible()

      // Verify history drawer button is in top left
      await expect(chatPage.historyDrawerButton).toBeVisible()

      // Check button positioning (should be in top-left area)
      const buttonBox = await chatPage.historyDrawerButton.boundingBox()
      expect(buttonBox?.x).toBeLessThan(200) // Should be in left portion
      expect(buttonBox?.y).toBeLessThan(100) // Should be near top
    })

    test('should display chat name in header', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat/1') // Load specific chat

      // Verify chat name is displayed
      await expect(chatPage.chatName).toBeVisible()
      await expect(chatPage.chatName).toContainText('Code Review Session')
    })

    test('should have chat settings button in top right', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Verify settings button exists and is positioned in top right
      await expect(chatPage.chatSettingsButton).toBeVisible()

      const buttonBox = await chatPage.chatSettingsButton.boundingBox()
      const pageWidth = await page.viewportSize().then((v) => v?.width || 1280)
      expect(buttonBox?.x).toBeGreaterThan(pageWidth - 200) // Should be in right portion
    })
  })

  test.describe('Empty Chat State', () => {
    test('should display empty state for new chat', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat/new')

      // Verify empty state is displayed
      await expect(chatPage.emptyState).toBeVisible()
      await expect(chatPage.emptyStateText).toBeVisible()
      await expect(chatPage.emptyStateSubtext).toBeVisible()

      // Verify exact text content
      await expect(chatPage.emptyStateText).toHaveText('No messages yet')
      await expect(chatPage.emptyStateSubtext).toHaveText('start the conversation by typing your message below')

      // Verify no messages are displayed
      await expect(chatPage.messages).toHaveCount(0)
    })

    test('should hide empty state when messages exist', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat/1') // Chat with existing messages

      // Empty state should not be visible
      await expect(chatPage.emptyState).not.toBeVisible()

      // Messages should be visible instead
      await expect(chatPage.messages).toHaveCount.atLeast(1)
    })
  })

  test.describe('User Input Area', () => {
    test('should display provider and model in input area', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Verify user input area exists
      await expect(chatPage.userInputArea).toBeVisible()

      // Verify provider and model are displayed
      await expect(chatPage.providerDisplay).toBeVisible()
      await expect(chatPage.modelDisplay).toBeVisible()

      // Should show default provider and model
      await expect(chatPage.providerDisplay).toContainText(/anthropic|openai/i)
      await expect(chatPage.modelDisplay).toContainText(/claude|gpt/i)
    })

    test('should handle message input and sending', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      const testMessage = ChatPageTestData.testMessages.simple

      // Type message
      await chatPage.messageInput.fill(testMessage)
      await expect(chatPage.messageInput).toHaveValue(testMessage)

      // Send message
      await chatPage.sendButton.click()

      // Verify message appears in conversation
      await expect(chatPage.getUserMessage(testMessage)).toBeVisible()

      // Verify input is cleared after sending
      await expect(chatPage.messageInput).toHaveValue('')
    })

    test('should send message with Enter key', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      const testMessage = ChatPageTestData.testMessages.simple

      // Type message and press Enter
      await chatPage.messageInput.fill(testMessage)
      await chatPage.messageInput.press('Enter')

      // Verify message was sent
      await expect(chatPage.getUserMessage(testMessage)).toBeVisible()
      await expect(chatPage.messageInput).toHaveValue('')
    })

    test('should reset input after message is sent', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      const testMessage = 'Test message for input reset'

      // Send message
      await chatPage.sendMessage(testMessage)

      // Verify input is completely cleared and ready for next message
      await expect(chatPage.messageInput).toHaveValue('')
      await expect(chatPage.messageInput).toBeFocused() // Should maintain focus for continuous typing
    })
  })
})
