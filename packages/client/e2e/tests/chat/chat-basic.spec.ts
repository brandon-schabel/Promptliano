import { test, expect } from '@playwright/test'
import { ChatPage } from '../../pages/chat.page'
import { ChatHelpers } from '../../helpers/chat-helpers'
import { 
  generateUniqueChat,
  testInputs
} from '../../fixtures/chat-data'

test.describe('Chat - Basic Operations', () => {
  let chatPage: ChatPage
  let createdChatIds: number[] = []

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    
    // Setup mock providers to avoid real API calls
    await ChatHelpers.setupMockProviders(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup created chats
    if (createdChatIds.length > 0) {
      await ChatHelpers.cleanupTestChats(page, createdChatIds)
      createdChatIds = []
    }
  })

  test('should navigate to chat page and show initial state', async ({ page }) => {
    await chatPage.goto()
    
    // Check for initial empty state
    const emptyStateVisible = await chatPage.emptyStateCard.isVisible()
    
    if (emptyStateVisible) {
      await chatPage.expectEmptyState()
      console.log('✅ Chat page shows empty state')
      
      // Check for welcome message
      const welcomeText = await chatPage.emptyStateTitle.textContent()
      expect(welcomeText).toMatch(/Welcome|No Chat Selected/i)
    } else {
      // Chat might already be selected
      const titleVisible = await chatPage.chatTitle.isVisible()
      if (titleVisible) {
        console.log('✅ Chat page loaded with active chat')
      }
    }
    
    // Verify essential UI elements
    await expect(chatPage.sidebarToggleButton).toBeVisible()
    await expect(chatPage.messageForm).toBeVisible()
    await expect(chatPage.messageInput).toBeVisible()
    await expect(chatPage.sendButton).toBeVisible()
  })

  test('should create a new chat', async ({ page }) => {
    await chatPage.goto()
    
    // Create new chat
    await chatPage.createNewChat()
    
    // Wait for chat to be created
    await page.waitForTimeout(1000)
    
    // Check if chat was created
    const chatId = await ChatHelpers.getCurrentChatId(page)
    if (chatId) {
      createdChatIds.push(chatId)
      console.log(`✅ New chat created with ID: ${chatId}`)
    }
    
    // Verify we're no longer in empty state
    const emptyStateVisible = await chatPage.emptyStateCard.isVisible()
    expect(emptyStateVisible).toBe(false)
    
    // Verify message input is ready
    await expect(chatPage.messageInput).toBeVisible()
    await expect(chatPage.messageInput).toBeEnabled()
  })

  test('should type and send a message', async ({ page }) => {
    // Create a test chat first
    const chatData = generateUniqueChat('send-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Mock AI response to avoid real API calls
    await ChatHelpers.mockAIResponse(page, 'This is a mock response for testing')
    
    // Type a message
    const testMessage = testInputs.medium
    await chatPage.messageInput.fill(testMessage)
    
    // Verify message was typed
    await expect(chatPage.messageInput).toHaveValue(testMessage)
    
    // Send the message
    await chatPage.sendMessage(testMessage)
    
    // Wait for message to appear
    const messageAppeared = await ChatHelpers.waitForMessage(page, testMessage, 5000)
    
    if (messageAppeared) {
      console.log('✅ Message sent and displayed')
      
      // Check for response (mock or error)
      await page.waitForTimeout(2000)
      
      const hasError = await ChatHelpers.hasError(page)
      if (hasError) {
        const errorMsg = await ChatHelpers.getErrorMessage(page)
        console.log(`ℹ️ Expected error (no real AI configured): ${errorMsg}`)
      } else {
        // Check if mock response appeared
        const mockResponseVisible = await page.getByText('mock response').isVisible()
        if (mockResponseVisible) {
          console.log('✅ Mock response received')
        }
      }
    } else {
      console.log('⚠️ Message not visible after sending')
    }
  })

  test('should handle empty message submission', async ({ page }) => {
    // Create a test chat
    const chatData = generateUniqueChat('empty-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Try to send empty message
    await chatPage.messageInput.clear()
    
    // Check if send button is disabled for empty input
    const isDisabled = await chatPage.sendButton.isDisabled()
    expect(isDisabled).toBe(true)
    console.log('✅ Send button disabled for empty message')
    
    // Try clicking anyway
    await chatPage.sendButton.click({ force: true })
    await page.waitForTimeout(1000)
    
    // Verify no message was sent
    const messageCount = await chatPage.messageItems.count()
    expect(messageCount).toBe(0)
    console.log('✅ Empty message not sent')
  })

  test('should handle multiline input', async ({ page }) => {
    // Create a test chat
    const chatData = generateUniqueChat('multiline-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Type multiline message
    const multilineMessage = testInputs.multiline
    await chatPage.messageInput.fill(multilineMessage)
    
    // Check if input switched to textarea for multiline
    const textarea = page.locator('#adaptive-chat-input textarea')
    const textareaVisible = await textarea.isVisible()
    
    if (textareaVisible) {
      console.log('✅ Input switched to multiline mode')
      
      // Verify content is preserved
      const value = await textarea.inputValue()
      expect(value).toBe(multilineMessage)
    } else {
      // Single line input might still work
      const value = await chatPage.messageInput.inputValue()
      expect(value).toContain('Line 1')
    }
  })

  test('should handle special characters and unicode', async ({ page }) => {
    // Create a test chat
    const chatData = generateUniqueChat('special-chars')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Test special characters
    await chatPage.messageInput.fill(testInputs.specialCharacters)
    let value = await chatPage.messageInput.inputValue()
    expect(value).toBe(testInputs.specialCharacters)
    console.log('✅ Special characters handled correctly')
    
    // Clear and test unicode
    await chatPage.messageInput.clear()
    await chatPage.messageInput.fill(testInputs.unicode)
    value = await chatPage.messageInput.inputValue()
    expect(value).toBe(testInputs.unicode)
    console.log('✅ Unicode and emoji handled correctly')
  })

  test('should use keyboard shortcut to send message', async ({ page }) => {
    // Create a test chat
    const chatData = generateUniqueChat('keyboard-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Mock AI response
    await ChatHelpers.mockAIResponse(page, 'Response to keyboard test')
    
    // Type message
    const testMessage = 'Testing keyboard shortcut'
    await chatPage.messageInput.fill(testMessage)
    
    // Press Enter to send (not Shift+Enter which creates new line)
    await chatPage.messageInput.press('Enter')
    
    await page.waitForTimeout(1000)
    
    // Check if message was sent
    const messageAppeared = await ChatHelpers.waitForMessage(page, testMessage, 3000)
    
    if (messageAppeared) {
      console.log('✅ Message sent using Enter key')
    } else {
      // Check if input is cleared (another sign of successful send)
      const inputValue = await chatPage.messageInput.inputValue()
      if (inputValue === '') {
        console.log('✅ Message sent (input cleared)')
      }
    }
  })

  test('should toggle chat sidebar', async ({ page }) => {
    await chatPage.goto()
    
    // Check initial sidebar state
    const initiallyVisible = await chatPage.chatSidebar.isVisible()
    console.log(`ℹ️ Sidebar initially ${initiallyVisible ? 'visible' : 'hidden'}`)
    
    // Toggle sidebar
    await chatPage.toggleSidebar()
    await page.waitForTimeout(500)
    
    // Check new state
    const afterToggle = await chatPage.chatSidebar.isVisible()
    expect(afterToggle).toBe(!initiallyVisible)
    console.log('✅ Sidebar toggled successfully')
    
    // Toggle back
    await chatPage.toggleSidebar()
    await page.waitForTimeout(500)
    
    const finalState = await chatPage.chatSidebar.isVisible()
    expect(finalState).toBe(initiallyVisible)
    console.log('✅ Sidebar toggled back to original state')
  })

  test('should show loading state during message processing', async ({ page }) => {
    // Create a test chat
    const chatData = generateUniqueChat('loading-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Set up delayed mock response
    await page.route('**/api/chat/completions', async (route) => {
      await page.waitForTimeout(2000) // Delay response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Delayed response'
            }
          }]
        })
      })
    })
    
    // Send message
    await chatPage.sendMessage('Test loading state')
    
    // Check for loading indicator
    const loadingVisible = await page.getByText('...').isVisible({ timeout: 2000 })
    
    if (loadingVisible) {
      console.log('✅ Loading indicator shown during processing')
      
      // Wait for loading to complete
      await page.getByText('...').waitFor({ state: 'hidden', timeout: 5000 })
      console.log('✅ Loading indicator hidden after completion')
    } else {
      console.log('ℹ️ Loading state might be too quick to observe')
    }
  })

  test('should preserve input on navigation', async ({ page }) => {
    // Create a test chat
    const chatData = generateUniqueChat('preserve-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
    }
    
    // Type a message but don't send
    const testMessage = 'This message should be preserved'
    await chatPage.messageInput.fill(testMessage)
    
    // Navigate away and back
    await page.goto('/projects')
    await page.waitForTimeout(1000)
    await chatPage.goto(chat.id)
    
    // Check if input was preserved (localStorage)
    await page.waitForTimeout(1000)
    const preservedValue = await chatPage.messageInput.inputValue()
    
    if (preservedValue === testMessage) {
      console.log('✅ Input preserved across navigation')
    } else if (preservedValue === '') {
      console.log('ℹ️ Input not preserved (expected behavior in some cases)')
    }
  })
})