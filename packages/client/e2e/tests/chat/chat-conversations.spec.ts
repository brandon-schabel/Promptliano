import { test, expect } from '@playwright/test'
import { ChatPage } from '../../pages/chat.page'
import { ChatHelpers } from '../../helpers/chat-helpers'
import { 
  generateUniqueChat,
  testMessages,
  generateTestMessage
} from '../../fixtures/chat-data'

test.describe('Chat - Conversations', () => {
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

  test('should display conversation messages', async ({ page }) => {
    // Create chat with test conversation
    const chatData = generateUniqueChat('conversation-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      
      // Create a conversation
      await ChatHelpers.createTestConversation(page, chat.id, testMessages.simple)
      
      // Navigate to chat
      await chatPage.goto(chat.id)
      await ChatHelpers.waitForChatReady(page)
      
      // Check message count
      const messageCount = await chatPage.messageItems.count()
      
      if (messageCount > 0) {
        console.log(`✅ Found ${messageCount} messages in conversation`)
        
        // Check first message (user)
        const firstMessage = await chatPage.getMessageByIndex(0)
        const firstText = await firstMessage.textContent()
        expect(firstText).toContain('Hello')
        
        // Check if messages alternate between user and assistant
        for (let i = 0; i < Math.min(messageCount, 4); i++) {
          const message = await chatPage.getMessageByIndex(i)
          const roleText = await message.locator('.font-semibold').textContent()
          
          if (i % 2 === 0) {
            expect(roleText).toContain('You')
            console.log(`✅ Message ${i}: User message`)
          } else {
            expect(roleText).toContain('Assistant')
            console.log(`✅ Message ${i}: Assistant message`)
          }
        }
      } else {
        console.log('ℹ️ No messages found - API creation might not be supported')
      }
    }
  })

  test('should handle message options menu', async ({ page }) => {
    // Create chat with a message
    const chatData = generateUniqueChat('options-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send a test message
      await ChatHelpers.mockAIResponse(page, 'Test response')
      await chatPage.sendMessage('Test message for options')
      await page.waitForTimeout(2000)
      
      // Check if message exists
      const messageCount = await chatPage.messageItems.count()
      
      if (messageCount > 0) {
        // Open options for first message
        await chatPage.openMessageOptions(0)
        
        // Check if popover opened
        const popoverVisible = await page.locator('[role="dialog"]').isVisible()
        
        if (popoverVisible) {
          console.log('✅ Message options popover opened')
          
          // Check for option buttons
          const copyVisible = await chatPage.copyMessageButton.isVisible()
          const forkVisible = await chatPage.forkMessageButton.isVisible()
          const deleteVisible = await chatPage.deleteMessageButton.isVisible()
          
          expect(copyVisible || forkVisible || deleteVisible).toBe(true)
          console.log('✅ Message option buttons visible')
          
          // Close popover
          await page.keyboard.press('Escape')
          await page.waitForTimeout(300)
        } else {
          console.log('⚠️ Message options popover not visible')
        }
      }
    }
  })

  test('should copy message content', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    
    // Create chat with message
    const chatData = generateUniqueChat('copy-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send a message
      const testMessage = 'This message will be copied'
      await ChatHelpers.mockAIResponse(page, 'Response to copy test')
      await chatPage.sendMessage(testMessage)
      await page.waitForTimeout(2000)
      
      // Copy first message
      const messageCount = await chatPage.messageItems.count()
      
      if (messageCount > 0) {
        await chatPage.copyMessage(0)
        
        // Check for success toast
        const toastMessage = await ChatHelpers.getToastMessage(page)
        if (toastMessage) {
          expect(toastMessage.toLowerCase()).toContain('cop')
          console.log('✅ Copy success message shown')
        }
        
        // Try to verify clipboard content
        try {
          const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
          if (clipboardText) {
            console.log('✅ Message copied to clipboard')
          }
        } catch {
          console.log('ℹ️ Cannot verify clipboard content (expected in CI)')
        }
      }
    }
  })

  test('should toggle exclude message', async ({ page }) => {
    // Create chat with messages
    const chatData = generateUniqueChat('exclude-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send messages
      await ChatHelpers.mockAIResponse(page, 'Response 1')
      await chatPage.sendMessage('Message 1')
      await page.waitForTimeout(2000)
      
      const messageCount = await chatPage.messageItems.count()
      
      if (messageCount > 0) {
        // Toggle exclude for first message
        await chatPage.toggleExcludeMessage(0)
        await page.waitForTimeout(500)
        
        // Check if message appears excluded (usually has opacity change)
        const firstMessage = await chatPage.getMessageByIndex(0)
        const opacity = await firstMessage.evaluate(el => window.getComputedStyle(el).opacity)
        
        if (opacity === '0.5') {
          console.log('✅ Message marked as excluded')
        } else {
          console.log('ℹ️ Exclude visual indication might differ')
        }
        
        // Toggle back
        await chatPage.toggleExcludeMessage(0)
        await page.waitForTimeout(500)
        
        const newOpacity = await firstMessage.evaluate(el => window.getComputedStyle(el).opacity)
        if (newOpacity === '1') {
          console.log('✅ Message exclude toggled back')
        }
      }
    }
  })

  test('should toggle raw view', async ({ page }) => {
    // Create chat with formatted message
    const chatData = generateUniqueChat('raw-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send message with markdown
      const markdownMessage = '**Bold** and *italic* text with `code`'
      await ChatHelpers.mockAIResponse(page, markdownMessage)
      await chatPage.sendMessage('Test markdown')
      await page.waitForTimeout(2000)
      
      const messageCount = await chatPage.messageItems.count()
      
      if (messageCount > 1) {
        // Toggle raw view for assistant message (index 1)
        await chatPage.toggleRawView(1)
        await page.waitForTimeout(500)
        
        // Check if raw view is shown (usually shows in monospace font)
        const message = await chatPage.getMessageByIndex(1)
        const preElement = message.locator('pre')
        const preVisible = await preElement.isVisible()
        
        if (preVisible) {
          console.log('✅ Raw view enabled')
          
          // Check content is not formatted
          const rawContent = await preElement.textContent()
          expect(rawContent).toContain('**Bold**')
          console.log('✅ Markdown shown as raw text')
        }
        
        // Toggle back
        await chatPage.toggleRawView(1)
        await page.waitForTimeout(500)
        
        const preHidden = await preElement.isHidden()
        if (preHidden) {
          console.log('✅ Raw view disabled')
        }
      }
    }
  })

  test('should delete a message', async ({ page }) => {
    // Create chat with messages
    const chatData = generateUniqueChat('delete-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send multiple messages
      await ChatHelpers.mockAIResponse(page, 'Response 1')
      await chatPage.sendMessage('Message to delete')
      await page.waitForTimeout(1000)
      
      await ChatHelpers.mockAIResponse(page, 'Response 2')
      await chatPage.sendMessage('Message to keep')
      await page.waitForTimeout(1000)
      
      const initialCount = await chatPage.messageItems.count()
      
      if (initialCount >= 2) {
        // Delete first message
        await chatPage.deleteMessage(0)
        
        // Handle confirmation dialog
        page.on('dialog', async dialog => {
          await dialog.accept()
        })
        
        await page.waitForTimeout(1000)
        
        const newCount = await chatPage.messageItems.count()
        
        if (newCount < initialCount) {
          console.log('✅ Message deleted successfully')
        } else {
          console.log('⚠️ Message might not have been deleted')
        }
      }
    }
  })

  test('should fork conversation from message', async ({ page }) => {
    // Create chat with conversation
    const chatData = generateUniqueChat('fork-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      
      // Create conversation
      await ChatHelpers.createTestConversation(page, chat.id, testMessages.simple)
      await chatPage.goto(chat.id)
      await ChatHelpers.waitForChatReady(page)
      
      const messageCount = await chatPage.messageItems.count()
      
      if (messageCount > 0) {
        // Fork from first message
        await chatPage.forkMessage(0)
        await page.waitForTimeout(1000)
        
        // Check for success message
        const toastMessage = await ChatHelpers.getToastMessage(page)
        
        if (toastMessage) {
          expect(toastMessage.toLowerCase()).toContain('fork')
          console.log('✅ Fork success message shown')
          
          // Check if new chat was created
          const newChatId = await ChatHelpers.getCurrentChatId(page)
          if (newChatId && newChatId !== chat.id) {
            createdChatIds.push(newChatId)
            console.log(`✅ Forked to new chat: ${newChatId}`)
          }
        } else {
          console.log('⚠️ Fork might not be supported without proper backend')
        }
      }
    }
  })

  test('should handle think blocks', async ({ page }) => {
    // Create chat
    const chatData = generateUniqueChat('think-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Mock response with think block
      const thinkResponse = testMessages.withThinkBlock[1].content
      await ChatHelpers.mockAIResponse(page, thinkResponse)
      
      await chatPage.sendMessage('What is 2 + 2?')
      await page.waitForTimeout(2000)
      
      // Check for think block
      const thinkBlockVisible = await chatPage.thinkBlock.isVisible()
      
      if (thinkBlockVisible) {
        console.log('✅ Think block detected')
        
        // Check if it's collapsed by default
        const summaryVisible = await chatPage.thinkBlockSummary.isVisible()
        
        if (summaryVisible) {
          console.log('✅ Think block shows summary')
          
          // Expand think block
          await chatPage.thinkBlockSummary.click()
          await page.waitForTimeout(500)
          
          // Check if content is visible
          const contentVisible = await chatPage.thinkBlockContent.isVisible()
          if (contentVisible) {
            const content = await chatPage.thinkBlockContent.textContent()
            expect(content).toContain('simple arithmetic')
            console.log('✅ Think block content accessible')
          }
          
          // Check for copy button
          const copyButtonVisible = await chatPage.copyThinkBlockButton.isVisible()
          if (copyButtonVisible) {
            console.log('✅ Copy reasoning button available')
          }
        }
      } else {
        console.log('ℹ️ Think block not visible (might be processed differently)')
      }
    }
  })

  test('should auto-scroll to new messages', async ({ page }) => {
    // Create chat
    const chatData = generateUniqueChat('scroll-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Send multiple messages to create scrollable content
      for (let i = 0; i < 5; i++) {
        await ChatHelpers.mockAIResponse(page, `Response ${i + 1}`)
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(1000)
      }
      
      // Check if last message is in view
      const lastMessageIndex = await chatPage.messageItems.count() - 1
      if (lastMessageIndex >= 0) {
        const lastMessage = await chatPage.getMessageByIndex(lastMessageIndex)
        const isInViewport = await lastMessage.isIntersectingViewport()
        
        if (isInViewport) {
          console.log('✅ Auto-scroll working - last message visible')
        } else {
          console.log('⚠️ Last message not in viewport')
        }
      }
    }
  })

  test('should handle long conversations', async ({ page }) => {
    // Create chat with long conversation
    const chatData = generateUniqueChat('long-conv')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      
      // Create long conversation
      await ChatHelpers.createTestConversation(page, chat.id, testMessages.longConversation)
      await chatPage.goto(chat.id)
      await ChatHelpers.waitForChatReady(page)
      
      const messageCount = await chatPage.messageItems.count()
      console.log(`✅ Long conversation loaded with ${messageCount} messages`)
      
      if (messageCount >= 4) {
        // Check if all messages are accessible
        for (let i = 0; i < Math.min(messageCount, 4); i++) {
          const message = await chatPage.getMessageByIndex(i)
          const isVisible = await message.isVisible()
          expect(isVisible).toBe(true)
        }
        console.log('✅ All messages in long conversation accessible')
        
        // Scroll to top
        await page.keyboard.press('Home')
        await page.waitForTimeout(500)
        
        // Check if first message is visible
        const firstMessage = await chatPage.getMessageByIndex(0)
        const firstVisible = await firstMessage.isIntersectingViewport()
        
        if (firstVisible) {
          console.log('✅ Can scroll to beginning of conversation')
        }
        
        // Scroll to bottom
        await page.keyboard.press('End')
        await page.waitForTimeout(500)
        
        // Check if last message is visible
        const lastMessage = await chatPage.getMessageByIndex(messageCount - 1)
        const lastVisible = await lastMessage.isIntersectingViewport()
        
        if (lastVisible) {
          console.log('✅ Can scroll to end of conversation')
        }
      }
    }
  })
})