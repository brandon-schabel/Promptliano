import { type Page, type Locator } from '@playwright/test'

/**
 * Simplified Page Object Model for Chat page
 * Following the flat structure pattern established for Projects page
 */
export class ChatPage {
  readonly page: Page
  
  // Chat Sidebar Elements
  readonly sidebarToggleButton: Locator
  readonly chatSidebar: Locator
  readonly newChatButton: Locator
  readonly chatHistoryList: Locator
  readonly chatHistoryItems: Locator
  readonly chatHistoryCount: Locator
  readonly loadMoreButton: Locator
  
  // Chat Header Elements
  readonly chatTitle: Locator
  readonly modelSettingsButton: Locator
  readonly providerModelDisplay: Locator
  
  // Messages Area Elements
  readonly messagesContainer: Locator
  readonly messageItems: Locator
  readonly emptyStateCard: Locator
  readonly emptyStateTitle: Locator
  readonly emptyStateText: Locator
  readonly loadingIndicator: Locator
  
  // Message Input Area Elements
  readonly messageForm: Locator
  readonly messageInput: Locator
  readonly sendButton: Locator
  readonly modelInfoDisplay: Locator
  readonly copyModelIdButton: Locator
  
  // Message Options Elements (within each message)
  readonly messageOptionsButton: Locator
  readonly copyMessageButton: Locator
  readonly forkMessageButton: Locator
  readonly deleteMessageButton: Locator
  readonly excludeMessageSwitch: Locator
  readonly rawViewSwitch: Locator
  
  // Model Settings Popover Elements
  readonly settingsPopover: Locator
  readonly providerSelector: Locator
  readonly modelSelector: Locator
  readonly temperatureSlider: Locator
  readonly maxTokensInput: Locator
  readonly topPSlider: Locator
  readonly frequencyPenaltySlider: Locator
  readonly presencePenaltySlider: Locator
  
  // Error Display Elements
  readonly errorDisplay: Locator
  readonly errorMessage: Locator
  readonly errorRetryButton: Locator
  readonly errorDismissButton: Locator
  
  // Think Block Elements
  readonly thinkBlock: Locator
  readonly thinkBlockSummary: Locator
  readonly thinkBlockContent: Locator
  readonly copyThinkBlockButton: Locator

  constructor(page: Page) {
    this.page = page
    
    // Chat Sidebar Elements
    this.sidebarToggleButton = page.getByRole('button', { name: /Toggle chat sidebar/i })
    this.chatSidebar = page.locator('.sliding-sidebar').or(page.locator('aside'))
    this.newChatButton = page.getByRole('button', { name: /New Chat/i })
    this.chatHistoryList = page.locator('.chat-list').or(page.locator('ul').filter({ has: page.locator('.chat-item') }))
    this.chatHistoryItems = page.locator('.chat-item').or(page.locator('li').filter({ hasText: /chat/i }))
    this.chatHistoryCount = page.getByText(/Chat History \(\d+\)/)
    this.loadMoreButton = page.getByRole('button', { name: /Show More/i })
    
    // Chat Header Elements
    this.chatTitle = page.locator('h1, h2, .font-semibold.text-lg').filter({ hasText: /Chat|Loading/ })
    this.modelSettingsButton = page.getByRole('button', { name: /settings/i }).or(page.locator('[aria-label*="settings"]'))
    this.providerModelDisplay = page.getByText(/Using:/)
    
    // Messages Area Elements
    this.messagesContainer = page.locator('main').or(page.locator('.space-y-4').filter({ has: page.locator('.message') }))
    this.messageItems = page.locator('.relative.rounded-lg.p-3')
    this.emptyStateCard = page.locator('.max-w-md.text-center').filter({ has: page.getByText(/No messages yet|No Chat Selected|Welcome/i) })
    this.emptyStateTitle = page.getByText(/No messages yet|No Chat Selected|Welcome/i)
    this.emptyStateText = page.getByText(/Start the conversation|Select a chat/i)
    this.loadingIndicator = page.getByText(/Loading messages|Loading Chat/i)
    
    // Message Input Area Elements
    this.messageForm = page.locator('form').filter({ has: page.locator('input, textarea') })
    this.messageInput = page.locator('#adaptive-chat-input').locator('input, textarea')
    this.sendButton = page.getByRole('button', { name: /Send message/i })
    this.modelInfoDisplay = page.locator('.text-xs.text-muted-foreground').filter({ hasText: /Using:/ })
    this.copyModelIdButton = page.getByRole('button', { name: /Copy model ID/i })
    
    // Message Options Elements
    this.messageOptionsButton = page.getByRole('button', { name: /Options/i })
    this.copyMessageButton = page.getByRole('button', { name: /Copy message/i })
    this.forkMessageButton = page.getByRole('button', { name: /Fork from here/i })
    this.deleteMessageButton = page.getByRole('button', { name: /Delete message/i })
    this.excludeMessageSwitch = page.locator('[id*="exclude"]')
    this.rawViewSwitch = page.locator('[id*="raw"]')
    
    // Model Settings Popover Elements
    this.settingsPopover = page.getByRole('dialog').or(page.locator('[role="dialog"]'))
    this.providerSelector = page.getByRole('combobox').first()
    this.modelSelector = page.getByRole('combobox').nth(1)
    this.temperatureSlider = page.locator('input[type="range"]').first()
    this.maxTokensInput = page.locator('input[type="number"]').first()
    this.topPSlider = page.locator('input[type="range"]').nth(1)
    this.frequencyPenaltySlider = page.locator('input[type="range"]').nth(2)
    this.presencePenaltySlider = page.locator('input[type="range"]').nth(3)
    
    // Error Display Elements
    this.errorDisplay = page.locator('.ai-error-display').or(page.getByText(/AI Error|Error/i).locator('..'))
    this.errorMessage = page.getByText(/Failed to|Error:|Connection failed/i)
    this.errorRetryButton = page.getByRole('button', { name: /Retry/i })
    this.errorDismissButton = page.getByRole('button', { name: /Dismiss/i })
    
    // Think Block Elements
    this.thinkBlock = page.locator('details').or(page.locator('.bg-secondary'))
    this.thinkBlockSummary = page.getByText(/View Hidden Reasoning/i)
    this.thinkBlockContent = page.locator('.font-mono.bg-background')
    this.copyThinkBlockButton = page.getByRole('button', { name: /Copy Reasoning/i })
  }

  // Navigation methods
  async goto(chatId?: number) {
    if (chatId) {
      await this.page.goto(`/chat?chatId=${chatId}`)
    } else {
      await this.page.goto('/chat')
    }
    await this.page.waitForLoadState('networkidle')
  }

  async gotoWithParams(params: { chatId?: number; prefill?: boolean; projectId?: number }) {
    const searchParams = new URLSearchParams()
    if (params.chatId) searchParams.set('chatId', params.chatId.toString())
    if (params.prefill) searchParams.set('prefill', 'true')
    if (params.projectId) searchParams.set('projectId', params.projectId.toString())
    
    const queryString = searchParams.toString()
    await this.page.goto(`/chat${queryString ? `?${queryString}` : ''}`)
    await this.page.waitForLoadState('networkidle')
  }

  // Chat sidebar methods
  async toggleSidebar() {
    await this.sidebarToggleButton.click()
    await this.page.waitForTimeout(300) // Wait for animation
  }

  async createNewChat() {
    const sidebarVisible = await this.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await this.toggleSidebar()
    }
    await this.newChatButton.click()
    await this.page.waitForTimeout(500)
  }

  async selectChat(chatTitle: string) {
    const sidebarVisible = await this.chatSidebar.isVisible()
    if (!sidebarVisible) {
      await this.toggleSidebar()
    }
    
    const chatItem = this.page.getByText(chatTitle, { exact: false })
    await chatItem.click()
    await this.page.waitForTimeout(500)
  }

  async renameChat(oldTitle: string, newTitle: string) {
    const chatItem = this.page.getByText(oldTitle, { exact: false }).locator('..')
    await chatItem.hover()
    
    const editButton = chatItem.getByRole('button', { name: /Rename/i })
    await editButton.click()
    
    const input = chatItem.locator('input')
    await input.clear()
    await input.fill(newTitle)
    await input.press('Enter')
    await this.page.waitForTimeout(500)
  }

  async deleteChat(chatTitle: string) {
    const chatItem = this.page.getByText(chatTitle, { exact: false }).locator('..')
    await chatItem.hover()
    
    const deleteButton = chatItem.getByRole('button', { name: /Delete/i })
    await deleteButton.click()
    
    // Handle confirmation dialog if it appears
    await this.page.waitForTimeout(500)
  }

  // Message methods
  async sendMessage(text: string) {
    await this.messageInput.fill(text)
    await this.sendButton.click()
    await this.page.waitForTimeout(1000)
  }

  async waitForResponse(timeout: number = 10000) {
    try {
      // Wait for loading state to appear and disappear
      await this.page.getByText('...').waitFor({ state: 'visible', timeout: 2000 })
      await this.page.getByText('...').waitFor({ state: 'hidden', timeout })
    } catch {
      // If no loading indicator, just wait a bit
      await this.page.waitForTimeout(2000)
    }
  }

  async getMessageByIndex(index: number) {
    return this.messageItems.nth(index)
  }

  async getMessageByText(text: string) {
    return this.messageItems.filter({ hasText: text }).first()
  }

  async openMessageOptions(messageIndex: number) {
    const message = await this.getMessageByIndex(messageIndex)
    const optionsButton = message.getByRole('button', { name: /Options/i })
    await optionsButton.click()
    await this.page.waitForTimeout(300)
  }

  async copyMessage(messageIndex: number) {
    await this.openMessageOptions(messageIndex)
    await this.copyMessageButton.click()
    await this.page.waitForTimeout(300)
  }

  async forkMessage(messageIndex: number) {
    await this.openMessageOptions(messageIndex)
    await this.forkMessageButton.click()
    await this.page.waitForTimeout(500)
  }

  async deleteMessage(messageIndex: number) {
    await this.openMessageOptions(messageIndex)
    await this.deleteMessageButton.click()
    await this.page.waitForTimeout(500)
  }

  async toggleExcludeMessage(messageIndex: number) {
    await this.openMessageOptions(messageIndex)
    const excludeSwitch = this.page.locator('[id*="exclude"]').nth(messageIndex)
    await excludeSwitch.click()
    await this.page.waitForTimeout(300)
  }

  async toggleRawView(messageIndex: number) {
    await this.openMessageOptions(messageIndex)
    const rawSwitch = this.page.locator('[id*="raw"]').nth(messageIndex)
    await rawSwitch.click()
    await this.page.waitForTimeout(300)
  }

  // Model settings methods
  async openModelSettings() {
    await this.modelSettingsButton.click()
    await this.page.waitForTimeout(300)
  }

  async selectProvider(provider: string) {
    await this.openModelSettings()
    await this.providerSelector.click()
    await this.page.getByRole('option', { name: provider }).click()
    await this.page.waitForTimeout(300)
  }

  async selectModel(model: string) {
    await this.openModelSettings()
    await this.modelSelector.click()
    await this.page.getByRole('option', { name: model }).click()
    await this.page.waitForTimeout(300)
  }

  async setTemperature(value: number) {
    await this.openModelSettings()
    await this.temperatureSlider.fill(value.toString())
    await this.page.waitForTimeout(300)
  }

  async setMaxTokens(value: number) {
    await this.openModelSettings()
    await this.maxTokensInput.fill(value.toString())
    await this.page.waitForTimeout(300)
  }

  // Helper methods
  async expectChatActive(chatTitle: string) {
    await this.chatTitle.waitFor({ state: 'visible' })
    const titleText = await this.chatTitle.textContent()
    if (!titleText?.includes(chatTitle)) {
      throw new Error(`Expected chat "${chatTitle}" to be active, but found "${titleText}"`)
    }
  }

  async expectMessageCount(count: number) {
    const messages = await this.messageItems.count()
    if (messages !== count) {
      throw new Error(`Expected ${count} messages, but found ${messages}`)
    }
  }

  async expectEmptyState() {
    await this.emptyStateCard.waitFor({ state: 'visible' })
  }

  async expectError() {
    await this.errorDisplay.waitFor({ state: 'visible' })
  }

  async dismissError() {
    if (await this.errorDismissButton.isVisible()) {
      await this.errorDismissButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  async retryOnError() {
    if (await this.errorRetryButton.isVisible()) {
      await this.errorRetryButton.click()
      await this.page.waitForTimeout(500)
    }
  }
}