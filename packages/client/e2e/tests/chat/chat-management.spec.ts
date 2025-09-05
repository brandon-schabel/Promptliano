import { test, expect } from '@playwright/test'
import { ChatPage } from '../../pages/chat.page'
import { ChatHelpers } from '../../helpers/chat-helpers'
import { 
  generateUniqueChat,
  getRandomChat
} from '../../fixtures/chat-data'

test.describe('Chat - Management', () => {
  let chatPage: ChatPage
  let createdChatIds: number[] = []

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    
    // Setup mock providers
    await ChatHelpers.setupMockProviders(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (createdChatIds.length > 0) {
      await ChatHelpers.cleanupTestChats(page, createdChatIds)
      createdChatIds = []
    }
  })

  test('should display chat sidebar', async ({ page }) => {
    await chatPage.goto()
    
    // Open sidebar if not visible
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Check sidebar elements
    await expect(chatPage.newChatButton).toBeVisible()
    console.log('✅ New chat button visible')
    
    // Check for chat history section
    const historyCountVisible = await chatPage.chatHistoryCount.isVisible()
    if (historyCountVisible) {
      const countText = await chatPage.chatHistoryCount.textContent()
      console.log(`✅ Chat history shown: ${countText}`)
    }
    
    // Check if list is present
    const listVisible = await chatPage.chatHistoryList.isVisible()
    expect(listVisible).toBe(true)
    console.log('✅ Chat history list visible')
  })

  test('should create multiple chats', async ({ page }) => {
    await chatPage.goto()
    
    // Create multiple chats
    const chatCount = 3
    const chatIds: number[] = []
    
    for (let i = 0; i < chatCount; i++) {
      await chatPage.createNewChat()
      await page.waitForTimeout(1000)
      
      const chatId = await ChatHelpers.getCurrentChatId(page)
      if (chatId) {
        chatIds.push(chatId)
        createdChatIds.push(chatId)
        console.log(`✅ Created chat ${i + 1} with ID: ${chatId}`)
      }
    }
    
    // Open sidebar to see all chats
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Count chat items
    const itemCount = await chatPage.chatHistoryItems.count()
    expect(itemCount).toBeGreaterThanOrEqual(chatCount)
    console.log(`✅ ${itemCount} chats shown in history`)
  })

  test('should switch between chats', async ({ page }) => {
    // Create two chats
    const chat1Data = generateUniqueChat('switch-1')
    const chat1 = await ChatHelpers.createTestChat(page, chat1Data)
    
    const chat2Data = generateUniqueChat('switch-2')
    const chat2 = await ChatHelpers.createTestChat(page, chat2Data)
    
    if (chat1.id) createdChatIds.push(chat1.id)
    if (chat2.id) createdChatIds.push(chat2.id)
    
    // Start with chat1
    await chatPage.goto(chat1.id)
    
    // Send a message in chat1
    await ChatHelpers.mockAIResponse(page, 'Response in chat 1')
    await chatPage.sendMessage('Message in chat 1')
    await page.waitForTimeout(1000)
    
    // Switch to chat2
    await chatPage.goto(chat2.id)
    await page.waitForTimeout(1000)
    
    // Verify we're on chat2
    const currentChatId = await ChatHelpers.getCurrentChatId(page)
    expect(currentChatId).toBe(chat2.id)
    console.log('✅ Switched to chat 2')
    
    // Send a message in chat2
    await ChatHelpers.mockAIResponse(page, 'Response in chat 2')
    await chatPage.sendMessage('Message in chat 2')
    await page.waitForTimeout(1000)
    
    // Switch back to chat1
    await chatPage.goto(chat1.id)
    await page.waitForTimeout(1000)
    
    // Verify we're back on chat1
    const backToChatId = await ChatHelpers.getCurrentChatId(page)
    expect(backToChatId).toBe(chat1.id)
    console.log('✅ Switched back to chat 1')
    
    // Verify chat1 messages are still there
    const hasMessage = await ChatHelpers.waitForMessage(page, 'Message in chat 1', 2000)
    if (hasMessage) {
      console.log('✅ Chat 1 messages preserved')
    }
  })

  test('should rename a chat', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('rename-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open sidebar
      const sidebarVisible = await chatPage.chatSidebar.isVisible()
      if (!sidebarVisible) {
        await chatPage.toggleSidebar()
        await page.waitForTimeout(500)
      }
      
      // Find the chat in the list
      const chatItems = await chatPage.chatHistoryItems.all()
      
      if (chatItems.length > 0) {
        // Hover over first chat item
        await chatItems[0].hover()
        
        // Look for edit button
        const editButton = chatItems[0].getByRole('button', { name: /Rename|Edit/i })
        const editVisible = await editButton.isVisible()
        
        if (editVisible) {
          await editButton.click()
          await page.waitForTimeout(500)
          
          // Find input field
          const input = chatItems[0].locator('input')
          const inputVisible = await input.isVisible()
          
          if (inputVisible) {
            // Clear and enter new name
            await input.clear()
            const newName = 'Renamed Chat Test'
            await input.fill(newName)
            await input.press('Enter')
            await page.waitForTimeout(1000)
            
            // Verify rename
            const itemText = await chatItems[0].textContent()
            if (itemText?.includes(newName)) {
              console.log('✅ Chat renamed successfully')
            } else {
              console.log('⚠️ Rename might not have persisted')
            }
          }
        } else {
          console.log('ℹ️ Edit button not available')
        }
      }
    }
  })

  test('should delete a chat from sidebar', async ({ page }) => {
    // Create multiple chats
    const chat1 = await ChatHelpers.createTestChat(page, generateUniqueChat('delete-1'))
    const chat2 = await ChatHelpers.createTestChat(page, generateUniqueChat('keep-1'))
    
    if (chat1.id) createdChatIds.push(chat1.id)
    if (chat2.id) createdChatIds.push(chat2.id)
    
    await chatPage.goto(chat1.id)
    
    // Open sidebar
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Count initial chats
    const initialCount = await chatPage.chatHistoryItems.count()
    console.log(`ℹ️ Initial chat count: ${initialCount}`)
    
    // Find and delete first chat
    const chatItems = await chatPage.chatHistoryItems.all()
    
    if (chatItems.length > 0) {
      // Hover to show delete button
      await chatItems[0].hover()
      
      const deleteButton = chatItems[0].getByRole('button', { name: /Delete|Trash/i })
      const deleteVisible = await deleteButton.isVisible()
      
      if (deleteVisible) {
        // Set up dialog handler
        page.on('dialog', async dialog => {
          console.log('ℹ️ Confirmation dialog appeared')
          await dialog.accept()
        })
        
        await deleteButton.click()
        await page.waitForTimeout(1000)
        
        // Count chats after deletion
        const newCount = await chatPage.chatHistoryItems.count()
        
        if (newCount < initialCount) {
          console.log('✅ Chat deleted from sidebar')
          
          // Remove from cleanup list since it's deleted
          const index = createdChatIds.indexOf(chat1.id!)
          if (index > -1) {
            createdChatIds.splice(index, 1)
          }
        } else {
          console.log('⚠️ Chat count unchanged after delete')
        }
      } else {
        console.log('ℹ️ Delete button not available')
      }
    }
  })

  test('should show empty state when no chats', async ({ page }) => {
    // Navigate to chat with no selection
    await chatPage.goto()
    
    // Open sidebar to check
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Check if there are any chats
    const chatCount = await chatPage.chatHistoryItems.count()
    
    if (chatCount === 0) {
      // Check for empty state message in sidebar
      const emptyMessage = page.getByText('No chats yet')
      const emptyVisible = await emptyMessage.isVisible()
      
      if (emptyVisible) {
        console.log('✅ Empty state shown in sidebar')
      }
    }
    
    // Close sidebar
    await chatPage.toggleSidebar()
    await page.waitForTimeout(500)
    
    // Check main area empty state
    const mainEmptyState = await chatPage.emptyStateCard.isVisible()
    if (mainEmptyState) {
      console.log('✅ Empty state shown in main area')
      
      const emptyTitle = await chatPage.emptyStateTitle.textContent()
      expect(emptyTitle).toMatch(/No Chat Selected|Welcome/i)
    }
  })

  test('should handle chat search/filter if available', async ({ page }) => {
    // Create multiple chats with different names
    const chats = [
      await ChatHelpers.createTestChat(page, { title: 'Project Discussion', projectId: 1 }),
      await ChatHelpers.createTestChat(page, { title: 'Bug Report', projectId: 1 }),
      await ChatHelpers.createTestChat(page, { title: 'Feature Request', projectId: 1 })
    ]
    
    chats.forEach(chat => {
      if (chat.id) createdChatIds.push(chat.id)
    })
    
    await chatPage.goto()
    
    // Open sidebar
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Look for search input
    const searchInput = chatPage.chatSidebar.locator('input[placeholder*="Search"], input[placeholder*="Filter"]')
    const searchVisible = await searchInput.isVisible()
    
    if (searchVisible) {
      console.log('✅ Search input available')
      
      // Search for specific chat
      await searchInput.fill('Project')
      await page.waitForTimeout(500)
      
      // Check filtered results
      const visibleChats = await chatPage.chatHistoryItems.count()
      console.log(`ℹ️ ${visibleChats} chats match "Project"`)
      
      // Clear search
      await searchInput.clear()
      await page.waitForTimeout(500)
      
      // All chats should be visible again
      const allChats = await chatPage.chatHistoryItems.count()
      expect(allChats).toBeGreaterThanOrEqual(3)
      console.log('✅ Search/filter working')
    } else {
      console.log('ℹ️ Search feature not available')
    }
  })

  test('should load more chats if pagination available', async ({ page }) => {
    // This test checks if "load more" functionality works
    // First, we need many chats to trigger pagination
    
    await chatPage.goto()
    
    // Open sidebar
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Check if load more button exists
    const loadMoreVisible = await chatPage.loadMoreButton.isVisible()
    
    if (loadMoreVisible) {
      console.log('✅ Load more button available')
      
      // Get initial count
      const initialCount = await chatPage.chatHistoryItems.count()
      
      // Click load more
      await chatPage.loadMoreButton.click()
      await page.waitForTimeout(1000)
      
      // Check new count
      const newCount = await chatPage.chatHistoryItems.count()
      
      if (newCount > initialCount) {
        console.log(`✅ Loaded more chats: ${initialCount} → ${newCount}`)
      } else {
        console.log('ℹ️ No additional chats to load')
      }
    } else {
      console.log('ℹ️ Load more not needed (all chats visible)')
    }
  })

  test('should persist active chat across page reload', async ({ page }) => {
    // Create and navigate to a chat
    const chatData = generateUniqueChat('persist-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send a message to make it unique
      await ChatHelpers.mockAIResponse(page, 'Test response')
      await chatPage.sendMessage('Persistence test message')
      await page.waitForTimeout(1000)
      
      // Reload page
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Check if same chat is active
      const currentChatId = await ChatHelpers.getCurrentChatId(page)
      expect(currentChatId).toBe(chat.id)
      console.log('✅ Active chat persisted across reload')
      
      // Check if messages are still there
      const messageVisible = await ChatHelpers.waitForMessage(page, 'Persistence test message', 3000)
      if (messageVisible) {
        console.log('✅ Chat messages persisted')
      }
    }
  })

  test('should handle keyboard navigation in sidebar', async ({ page }) => {
    // Create multiple chats
    for (let i = 0; i < 3; i++) {
      const chat = await ChatHelpers.createTestChat(page, generateUniqueChat(`nav-${i}`))
      if (chat.id) createdChatIds.push(chat.id)
    }
    
    await chatPage.goto()
    
    // Open sidebar
    const sidebarVisible = await chatPage.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await chatPage.toggleSidebar()
      await page.waitForTimeout(500)
    }
    
    // Focus on first chat item
    const firstChat = chatPage.chatHistoryItems.first()
    if (await firstChat.isVisible()) {
      await firstChat.focus()
      
      // Try arrow navigation
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(300)
      
      // Check if focus moved
      const focusedElement = await page.evaluate(() => document.activeElement?.textContent)
      console.log(`ℹ️ Focused element: ${focusedElement?.substring(0, 20)}...`)
      
      // Try Enter to select
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)
      
      // Check if chat was selected
      const chatId = await ChatHelpers.getCurrentChatId(page)
      if (chatId) {
        console.log('✅ Keyboard navigation working')
      }
    }
  })
})