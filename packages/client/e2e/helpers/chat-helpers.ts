import { type Page } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'

/**
 * Simple helper functions for chat tests
 * Provides utilities for common chat operations without complex abstractions
 */
export class ChatHelpers {
  /**
   * Create a test chat using API or UI
   */
  static async createTestChat(page: Page, chatData: {
    title: string
    projectId?: number
  }) {
    // Try to use API if available
    try {
      const response = await page.request.post('/api/chats', {
        data: {
          title: chatData.title,
          projectId: chatData.projectId || 1
        }
      })
      
      if (response.ok()) {
        const chat = await response.json()
        return chat.data || chat
      }
    } catch (error) {
      console.log('API creation failed, falling back to UI creation')
    }

    // Fallback to UI creation
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await chatPage.createNewChat()
    
    // The new chat should be created with a default title
    // We can rename it if needed
    await page.waitForTimeout(1000)
    
    // Get the chat ID from URL
    const url = new URL(page.url())
    const chatId = url.searchParams.get('chatId')
    
    return { 
      id: chatId ? parseInt(chatId) : undefined,
      title: chatData.title 
    }
  }

  /**
   * Delete a chat using API or UI
   */
  static async deleteTestChat(page: Page, chatId: number | string) {
    try {
      const response = await page.request.delete(`/api/chats/${chatId}`)
      return response.ok()
    } catch (error) {
      console.log('API deletion failed, falling back to UI deletion')
    }

    // Fallback to UI deletion
    const chatPage = new ChatPage(page)
    await chatPage.goto(Number(chatId))
    await chatPage.toggleSidebar()
    
    // Find the chat in the list and delete it
    const chatItems = await page.locator('.chat-item').all()
    for (const item of chatItems) {
      const text = await item.textContent()
      if (text) {
        await item.hover()
        const deleteButton = item.getByRole('button', { name: /Delete/i })
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.waitForTimeout(500)
          return true
        }
      }
    }
    
    return false
  }

  /**
   * Create a test conversation with messages
   */
  static async createTestConversation(page: Page, chatId: number, messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>) {
    // Try to use API to seed messages
    try {
      for (const message of messages) {
        await page.request.post(`/api/chats/${chatId}/messages`, {
          data: message
        })
      }
      return true
    } catch (error) {
      console.log('API message creation failed')
    }

    // Fallback to UI (only for user messages)
    const chatPage = new ChatPage(page)
    await chatPage.goto(chatId)
    
    for (const message of messages) {
      if (message.role === 'user') {
        await chatPage.sendMessage(message.content)
        await page.waitForTimeout(1000)
      }
    }
    
    return true
  }

  /**
   * Mock AI response for predictable testing
   */
  static async mockAIResponse(page: Page, response: string) {
    // Intercept AI API calls and return mock response
    await page.route('**/api/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: response
            }
          }]
        })
      })
    })
  }

  /**
   * Wait for a message to appear in the chat
   */
  static async waitForMessage(page: Page, messageText: string, timeout: number = 10000) {
    const chatPage = new ChatPage(page)
    const message = chatPage.page.getByText(messageText, { exact: false })
    
    try {
      await message.waitFor({ state: 'visible', timeout })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get current chat ID from URL
   */
  static async getCurrentChatId(page: Page): Promise<number | null> {
    const url = new URL(page.url())
    const chatId = url.searchParams.get('chatId')
    return chatId ? parseInt(chatId) : null
  }

  /**
   * Check if chat is in loading state
   */
  static async isLoading(page: Page): Promise<boolean> {
    const loadingIndicators = [
      page.getByText('Loading messages'),
      page.getByText('Loading Chat'),
      page.getByText('...')
    ]
    
    for (const indicator of loadingIndicators) {
      if (await indicator.isVisible()) {
        return true
      }
    }
    
    return false
  }

  /**
   * Wait for chat to finish loading
   */
  static async waitForChatReady(page: Page, timeout: number = 10000) {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (!(await ChatHelpers.isLoading(page))) {
        return true
      }
      await page.waitForTimeout(500)
    }
    
    return false
  }

  /**
   * Get all messages from the chat
   */
  static async getAllMessages(page: Page): Promise<Array<{
    role: string
    content: string
  }>> {
    const chatPage = new ChatPage(page)
    const messages = []
    
    const messageElements = await chatPage.messageItems.all()
    
    for (let i = 0; i < messageElements.length; i++) {
      const element = messageElements[i]
      const text = await element.textContent()
      
      // Determine role based on position or content
      const roleElement = element.locator('.font-semibold').first()
      const roleText = await roleElement.textContent().catch(() => '')
      
      const role = roleText?.includes('You') ? 'user' : 'assistant'
      
      messages.push({
        role,
        content: text || ''
      })
    }
    
    return messages
  }

  /**
   * Clean up all test chats
   */
  static async cleanupTestChats(page: Page, chatIds: Array<number | string>) {
    for (const chatId of chatIds) {
      await ChatHelpers.deleteTestChat(page, chatId)
    }
  }

  /**
   * Get toast message if visible
   */
  static async getToastMessage(page: Page): Promise<string | null> {
    const toast = page.locator('[role="status"]').or(page.getByTestId('toast'))
    
    if (await toast.isVisible()) {
      return await toast.textContent()
    }
    
    return null
  }

  /**
   * Dismiss any visible toasts
   */
  static async dismissToasts(page: Page) {
    const toasts = page.locator('[role="status"]').or(page.getByTestId('toast'))
    const count = await toasts.count()
    
    for (let i = 0; i < count; i++) {
      const closeButton = toasts.nth(i).getByRole('button', { name: /close/i })
      if (await closeButton.isVisible()) {
        await closeButton.click()
      }
    }
  }

  /**
   * Check if we're on the chat page
   */
  static async isOnChatPage(page: Page): Promise<boolean> {
    return page.url().includes('/chat')
  }

  /**
   * Setup mock providers for testing
   */
  static async setupMockProviders(page: Page) {
    // Mock provider list endpoint
    await page.route('**/api/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'openai', name: 'OpenAI', enabled: true },
          { id: 'anthropic', name: 'Anthropic', enabled: true }
        ])
      })
    })

    // Mock models endpoint
    await page.route('**/api/models/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
          { id: 'claude-3-opus', name: 'Claude 3 Opus' }
        ])
      })
    })
  }

  /**
   * Check if chat has error state
   */
  static async hasError(page: Page): Promise<boolean> {
    const errorSelectors = [
      page.getByText('AI Error'),
      page.getByText('Failed to'),
      page.getByText('Error:'),
      page.locator('.ai-error-display')
    ]
    
    for (const selector of errorSelectors) {
      if (await selector.isVisible()) {
        return true
      }
    }
    
    return false
  }

  /**
   * Get error message if visible
   */
  static async getErrorMessage(page: Page): Promise<string | null> {
    const errorElements = [
      page.getByText('AI Error'),
      page.getByText('Failed to'),
      page.getByText('Error:')
    ]
    
    for (const element of errorElements) {
      if (await element.isVisible()) {
        const parent = element.locator('..')
        return await parent.textContent()
      }
    }
    
    return null
  }

  /**
   * Simulate network error for testing error handling
   */
  static async simulateNetworkError(page: Page) {
    await page.route('**/api/chat/**', async (route) => {
      await route.abort('failed')
    })
  }

  /**
   * Restore normal network behavior
   */
  static async restoreNetwork(page: Page) {
    await page.unroute('**/api/chat/**')
  }
}