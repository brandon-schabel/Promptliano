import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { ChatPageTestData } from '../fixtures/chat-page-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Chat History Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test chat history
    await TestDataManager.setupChatHistory(page, ChatPageTestData.testChats)
  })

  test('should open and close chat history drawer', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Open history drawer
    await chatPage.openChatHistory()

    // Verify drawer is visible
    await expect(chatPage.historyDrawer).toBeVisible()
    await expect(chatPage.historyList).toBeVisible()

    // Close drawer (click outside or close button)
    await page.mouse.click(100, 300) // Click outside drawer
    await expect(chatPage.historyDrawer).not.toBeVisible()
  })

  test('should display chat history items', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatHistory()

    // Verify all test chats are displayed
    await expect(chatPage.historyItems).toHaveCount(ChatPageTestData.testChats.length)

    // Verify chat names are displayed
    for (const chat of ChatPageTestData.testChats) {
      await expect(chatPage.historyItemByName(chat.name)).toBeVisible()
    }

    // Verify recent chats appear at top (assuming chronological order)
    const firstItem = chatPage.historyItems.first()
    await expect(firstItem).toContainText('Code Review Session') // Most recent
  })

  test('should navigate to selected chat from history', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatHistory()

    // Click on specific chat
    await chatPage.historyItemByName('Bug Analysis Discussion').click()

    // Should navigate to that chat
    await expect(page).toHaveURL(/.*\/chat\/2/)
    await expect(chatPage.chatName).toContainText('Bug Analysis Discussion')

    // History drawer should close
    await expect(chatPage.historyDrawer).not.toBeVisible()

    // Messages should be loaded
    await expect(chatPage.messages).toHaveCount.atLeast(2)
  })

  test('should search chat history', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatHistory()

    // Find search input in history drawer
    const searchInput = page.getByTestId('history-search')
    await searchInput.fill('Bug')

    // Should filter results
    await expect(chatPage.historyItemByName('Bug Analysis Discussion')).toBeVisible()
    await expect(chatPage.historyItemByName('Code Review Session')).not.toBeVisible()

    // Clear search
    await searchInput.clear()

    // All items should be visible again
    await expect(chatPage.historyItems).toHaveCount(ChatPageTestData.testChats.length)
  })
})
