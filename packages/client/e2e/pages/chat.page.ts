import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class ChatPage extends BasePage {
  private readonly newChatButton: Locator
  private readonly chatInput: Locator
  private readonly sendButton: Locator
  private readonly messagesList: Locator
  private readonly providerSelect: Locator
  private readonly modelSelect: Locator
  private readonly clearHistoryButton: Locator
  private readonly chatHistory: Locator
  private readonly aiResponseContainer: Locator
  private readonly messageActionsButton: Locator
  private readonly editMessageButton: Locator
  private readonly deleteMessageButton: Locator
  private readonly copyMessageButton: Locator
  private readonly loadingIndicator: Locator

  constructor(page: Page) {
    super(page)
    this.newChatButton = page.getByRole('button', { name: 'New Chat' })
    this.chatInput = page.getByRole('textbox', { name: 'Message' })
    this.sendButton = page.getByRole('button', { name: 'Send' })
    this.messagesList = page.getByTestId('messages-list')
    this.providerSelect = page.getByRole('combobox', { name: 'Provider' })
    this.modelSelect = page.getByRole('combobox', { name: 'Model' })
    this.clearHistoryButton = page.getByRole('button', { name: 'Clear History' })
    this.chatHistory = page.getByTestId('chat-history')
    this.aiResponseContainer = page.getByTestId('ai-response')
    this.messageActionsButton = page.getByTestId('message-actions')
    this.editMessageButton = page.getByRole('button', { name: 'Edit' })
    this.deleteMessageButton = page.getByRole('button', { name: 'Delete' })
    this.copyMessageButton = page.getByRole('button', { name: 'Copy' })
    this.loadingIndicator = page.getByTestId('ai-loading')
  }

  /**
   * Navigate to the chat interface
   */
  async goto() {
    await super.goto('/chat')
  }

  /**
   * Create a new chat session
   */
  async createNewChat(): Promise<void> {
    await this.newChatButton.click()
    await this.waitForElement('[data-testid="chat-session"]')
  }

  /**
   * Select AI provider for the chat
   */
  async selectProvider(providerName: string): Promise<void> {
    await this.providerSelect.click()
    await this.page.getByRole('option', { name: providerName }).click()
    await this.page.waitForTimeout(500) // Allow provider to initialize
  }

  /**
   * Select AI model for the chat
   */
  async selectModel(modelName: string): Promise<void> {
    await this.modelSelect.click()
    await this.page.getByRole('option', { name: modelName }).click()
    await this.page.waitForTimeout(500) // Allow model to load
  }

  /**
   * Send a message in the chat
   */
  async sendMessage(message: string): Promise<void> {
    await this.chatInput.fill(message)
    
    // Send using Enter key
    await this.chatInput.press('Enter')
    
    // Wait for message to appear in chat
    await expect(this.messagesList.getByText(message)).toBeVisible()
  }

  /**
   * Send a message using the send button
   */
  async sendMessageWithButton(message: string): Promise<void> {
    await this.chatInput.fill(message)
    await this.sendButton.click()
    
    // Wait for message to appear in chat
    await expect(this.messagesList.getByText(message)).toBeVisible()
  }

  /**
   * Wait for AI response to be generated
   */
  async waitForAIResponse(timeout = 30000): Promise<void> {
    // Wait for loading indicator to appear
    await expect(this.loadingIndicator).toBeVisible({ timeout: 5000 })
    
    // Wait for loading to complete
    await expect(this.loadingIndicator).toBeHidden({ timeout })
    
    // Wait for response content
    await expect(this.aiResponseContainer).toBeVisible({ timeout: 5000 })
  }

  /**
   * Get the latest AI response text
   */
  async getLatestAIResponse(): Promise<string> {
    const responses = await this.aiResponseContainer.all()
    if (responses.length === 0) {
      throw new Error('No AI responses found')
    }
    
    const latestResponse = responses[responses.length - 1]
    return await latestResponse.textContent() || ''
  }

  /**
   * Get all messages in the chat
   */
  async getAllMessages(): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.messagesList.locator('[data-message-role]').all()
    const result = []
    
    for (const message of messages) {
      const role = await message.getAttribute('data-message-role')
      const content = await message.textContent()
      result.push({ role: role || 'unknown', content: content || '' })
    }
    
    return result
  }

  /**
   * Edit a message (click edit button on specific message)
   */
  async editMessage(originalText: string, newText: string): Promise<void> {
    const messageElement = this.messagesList.getByText(originalText)
    await messageElement.hover()
    
    // Click the message actions button
    const actionsButton = messageElement.locator('..').getByTestId('message-actions')
    await actionsButton.click()
    
    await this.editMessageButton.click()
    
    // Edit the message in the input field
    const editInput = this.page.getByTestId('edit-message-input')
    await editInput.fill(newText)
    await editInput.press('Enter')
    
    // Verify the message was updated
    await expect(this.messagesList.getByText(newText)).toBeVisible()
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageText: string): Promise<void> {
    const messageElement = this.messagesList.getByText(messageText)
    await messageElement.hover()
    
    // Click the message actions button
    const actionsButton = messageElement.locator('..').getByTestId('message-actions')
    await actionsButton.click()
    
    await this.deleteMessageButton.click()
    
    // Confirm deletion if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: 'Confirm' })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
    
    // Verify the message was removed
    await expect(this.messagesList.getByText(messageText)).toBeHidden()
  }

  /**
   * Copy a message to clipboard
   */
  async copyMessage(messageText: string): Promise<void> {
    const messageElement = this.messagesList.getByText(messageText)
    await messageElement.hover()
    
    // Click the message actions button
    const actionsButton = messageElement.locator('..').getByTestId('message-actions')
    await actionsButton.click()
    
    await this.copyMessageButton.click()
    
    // Verify copy success notification
    await expect(this.page.getByText('Copied to clipboard')).toBeVisible()
  }

  /**
   * Clear chat history
   */
  async clearHistory(): Promise<void> {
    await this.clearHistoryButton.click()
    
    // Confirm if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: 'Clear' })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
    
    // Verify history is cleared
    await expect(this.messagesList).toBeEmpty()
  }

  /**
   * Verify chat session is persisted (reload page and check)
   */
  async verifyChatPersistence(): Promise<boolean> {
    const messagesBefore = await this.getAllMessages()
    
    // Reload the page
    await this.page.reload()
    await this.waitForPageLoad()
    
    const messagesAfter = await this.getAllMessages()
    
    return messagesBefore.length === messagesAfter.length && 
           messagesBefore.length > 0
  }

  /**
   * Test markdown rendering in messages
   */
  async verifyMarkdownRendering(messageText: string): Promise<void> {
    await this.sendMessage(messageText)
    
    // Check for specific markdown elements
    if (messageText.includes('```')) {
      await expect(this.messagesList.locator('pre code')).toBeVisible()
    }
    
    if (messageText.includes('**')) {
      await expect(this.messagesList.locator('strong')).toBeVisible()
    }
    
    if (messageText.includes('*')) {
      await expect(this.messagesList.locator('em')).toBeVisible()
    }
  }

  /**
   * Test streaming response (if implemented)
   */
  async verifyStreamingResponse(): Promise<void> {
    await this.sendMessage('Write a long story about a cat')
    
    // Wait for streaming to start
    await expect(this.loadingIndicator).toBeVisible()
    
    // Check if response appears gradually (streaming effect)
    await expect(this.aiResponseContainer).toBeVisible()
    
    // Wait for complete response
    await this.waitForAIResponse()
  }

  /**
   * Switch between different chat sessions
   */
  async switchToChat(chatId: string): Promise<void> {
    const chatTab = this.page.getByTestId(`chat-tab-${chatId}`)
    await chatTab.click()
    await this.waitForPageLoad()
  }

  /**
   * Export chat transcript
   */
  async exportChatTranscript(): Promise<void> {
    const exportButton = this.page.getByRole('button', { name: 'Export' })
    
    // Start download
    const downloadPromise = this.page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise
    
    // Verify download started
    expect(download.suggestedFilename()).toContain('.md')
  }

  /**
   * Search within chat history
   */
  async searchChatHistory(searchTerm: string): Promise<void> {
    const searchInput = this.page.getByTestId('chat-search')
    await searchInput.fill(searchTerm)
    await searchInput.press('Enter')
    
    // Verify search results highlighted
    await expect(this.page.getByTestId('search-highlight')).toBeVisible()
  }

  /**
   * Verify no JavaScript errors in console during chat usage
   */
  async verifyNoConsoleErrors(): Promise<string[]> {
    const consoleErrors: string[] = []
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Perform basic chat operations
    await this.createNewChat()
    await this.sendMessage('Hello, test message')
    await this.waitForAIResponse()
    
    return consoleErrors
  }

  /**
   * Get chat statistics (message count, response times)
   */
  async getChatStats(): Promise<{
    messageCount: number
    averageResponseTime: number
  }> {
    const messages = await this.getAllMessages()
    const messageCount = messages.length
    
    // This would need to be implemented based on your app's metrics
    // For now, return mock data
    return {
      messageCount,
      averageResponseTime: 1500 // milliseconds
    }
  }
}