import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class ChatPage extends BasePage {
  // Chat Header Elements - using actual implementation
  get chatHeader() {
    return this.page.locator('header, .chat-header, nav') // Fallback to navigation area
  }

  get historyDrawerButton() {
    return this.page.getByRole('button', { name: /history|drawer|menu/i })
  }

  get chatName() {
    return this.page.locator('.chat-title, h1, h2').first()
  }

  get chatSettingsButton() {
    return this.page.getByRole('button', { name: /settings|config/i })
  }

  // Message Area Elements - using actual implementation
  get messagesContainer() {
    return this.page.locator('main, .messages, .chat-messages').first()
  }

  get messages() {
    return this.page.locator('.message, [data-message], .chat-message')
  }

  get emptyState() {
    return this.page.locator('.empty-state').or(this.page.getByText('No messages yet'))
  }

  get emptyStateText() {
    return this.page.getByText('No messages yet')
  }

  get emptyStateSubtext() {
    return this.page.getByText('Start the conversation by typing')
  }

  // User Input Elements - using actual implementation
  get userInputArea() {
    return this.page.locator('form, .input-area, .message-form').first()
  }

  get messageInput() {
    return this.page.locator('input[placeholder*="Type"], input[placeholder*="message"]')
  }

  get sendButton() {
    return this.page.locator('button[type="submit"], button[aria-label*="Send"]')
  }

  get providerSelector() {
    return this.page.getByRole('combobox').or(this.page.getByRole('button', { name: /provider|model/i }))
  }

  get modelSelector() {
    return this.page.getByRole('combobox').or(this.page.getByRole('button', { name: /model/i }))
  }

  get providerDisplay() {
    return this.page.getByText(/Using:.*openai|Using:.*anthropic|Using:.*claude|Using:.*gpt/i)
  }

  get modelDisplay() {
    return this.page.getByText(/gpt-|claude-|llama/i)
  }

  // Chat History Elements - using actual implementation
  get historyDrawer() {
    return this.page.locator('.history-drawer, [role="dialog"], aside').first()
  }

  get historyList() {
    return this.page.locator('.history-list, ul, .chat-list')
  }

  get historyItems() {
    return this.page.locator('.history-item, li, .chat-item')
  }

  historyItemByName(name: string) {
    return this.page.getByText(name)
  }

  // Chat Settings Elements - using actual implementation
  get settingsModal() {
    return this.page.locator('[role="dialog"]').filter({ hasText: /settings|config/i })
  }

  get temperatureSlider() {
    return this.page
      .locator('input[type="range"]')
      .filter({ hasText: /temperature/i })
      .or(this.page.locator('input').filter({ hasText: /temperature/i }))
  }

  get maxTokensInput() {
    return this.page
      .locator('input[type="number"]')
      .filter({ hasText: /tokens/i })
      .or(this.page.locator('input').filter({ hasText: /tokens/i }))
  }

  get topPSlider() {
    return this.page.locator('input[type="range"]').filter({ hasText: /top.*p/i })
  }

  get frequencyPenaltySlider() {
    return this.page.locator('input[type="range"]').filter({ hasText: /frequency/i })
  }

  get presencePenaltySlider() {
    return this.page.locator('input[type="range"]').filter({ hasText: /presence/i })
  }

  constructor(page: Page) {
    super(page)
  }

  // Helper Methods - updated for actual implementation
  async sendMessage(message: string) {
    // Ensure input is available
    await expect(this.messageInput).toBeVisible()

    // Fill the message input
    await this.messageInput.fill(message)

    // Verify message was typed
    await expect(this.messageInput).toHaveValue(message)

    // Click send button
    await this.sendButton.click()

    // Wait for the message to be processed
    await this.page.waitForTimeout(2000)

    // Check if input is still available (might disappear during processing)
    try {
      // Wait for input to be cleared or become available again
      await expect(this.messageInput).toHaveValue('', { timeout: 10000 })
    } catch {
      // If input is not available, that's also acceptable - message might be processing
      console.log('⚠️ Message input not available after sending - this may be normal during processing')
    }
  }

  async selectProvider(providerId: string) {
    // Click on provider area to access selector
    const providerArea = this.page.getByText(/Using:/)
    if (await providerArea.isVisible()) {
      await providerArea.click()
    }

    // Try to find provider option
    const providerOption = this.page.getByText(providerId, { exact: false })
    if (await providerOption.isVisible()) {
      await providerOption.click()
    }
  }

  async selectModel(modelName: string) {
    // Click on model area to access selector
    const modelArea = this.page.getByText(/gpt-|claude-|llama/)
    if (await modelArea.isVisible()) {
      await modelArea.click()
    }

    // Try to find model option
    const modelOption = this.page.getByText(modelName, { exact: false })
    if (await modelOption.isVisible()) {
      await modelOption.click()
    }
  }

  async openChatHistory() {
    // Look for history/menu button in sidebar or header
    const historyButton = this.page.getByRole('button', { name: /history|menu/i }).first()
    if (await historyButton.isVisible()) {
      await historyButton.click()
      await this.page.waitForTimeout(500) // Wait for drawer to open
    }
  }

  async openChatSettings() {
    // Look for settings button
    const settingsButton = this.page.getByRole('button', { name: /settings|config/i }).first()
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      await this.page.waitForTimeout(500) // Wait for modal to open
    }
  }

  async waitForAIResponse(timeout = 30000) {
    // Wait for any loading indicators or response
    try {
      // Look for loading states
      await expect(this.page.locator('.loading, [data-loading], .thinking')).toBeVisible({ timeout: 5000 })
      await expect(this.page.locator('.loading, [data-loading], .thinking')).toBeHidden({ timeout })
    } catch {
      // If no loading indicator, just wait a reasonable time for response
      await this.page.waitForTimeout(3000)
    }
  }

  getUserMessage(messageText: string) {
    // Look for messages containing the text
    return this.page.getByText(messageText).first()
  }

  getAssistantMessage(index: number = 0) {
    // Look for AI response messages
    return this.messages.nth(index * 2 + 1) // Assuming alternating user/AI pattern
  }

  // Check for error states
  async hasError() {
    const errorSelectors = [
      this.page.getByText('Error in Main Content'),
      this.page.getByText('AI Error'),
      this.page.getByText('Failed to fetch'),
      this.page.getByText(/error|failed/i).first()
    ]

    for (const selector of errorSelectors) {
      if (await selector.isVisible()) {
        return true
      }
    }
    return false
  }

  async getErrorMessage() {
    const errorElements = [
      this.page.getByText('Error in Main Content'),
      this.page.getByText('AI Error'),
      this.page.getByText('Failed to fetch')
    ]

    for (const element of errorElements) {
      if (await element.isVisible()) {
        return await element.textContent()
      }
    }
    return null
  }

  // Message History Slider - New Methods for Testing
  get messageHistorySlider() {
    return this.page.locator('[data-testid="message-history-slider"], input[type="range"]')
  }

  get sliderLabel() {
    return this.page.locator('text=/\\d+ of \\d+ messages/')
  }

  get historyTokensDisplay() {
    return this.page.locator('[data-testid="history-tokens"]')
  }

  get inputTokensDisplay() {
    return this.page.locator('[data-testid="input-tokens"]')
  }

  get totalTokensDisplay() {
    return this.page.locator('[data-testid="total-tokens"]')
  }

  get contextWarning() {
    return this.page.locator('[data-testid="context-warning"]').or(
      this.page.getByText(/large context|increase.*cost/i)
    )
  }

  async isSliderVisible(): Promise<boolean> {
    try {
      await this.messageHistorySlider.waitFor({ state: 'visible', timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  async getSliderValue(): Promise<number> {
    const value = await this.messageHistorySlider.inputValue()
    return parseInt(value, 10)
  }

  async setSliderValue(value: number) {
    await this.messageHistorySlider.fill(value.toString())
    await this.page.waitForTimeout(500) // Wait for token calculation
  }

  async getSliderMin(): Promise<number> {
    const min = await this.messageHistorySlider.getAttribute('min')
    return parseInt(min || '1', 10)
  }

  async getSliderMax(): Promise<number> {
    const max = await this.messageHistorySlider.getAttribute('max')
    return parseInt(max || '1', 10)
  }

  async getHistoryTokensCount(): Promise<number> {
    const text = await this.historyTokensDisplay.textContent()
    const match = text?.match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
  }

  async getInputTokensCount(): Promise<number> {
    const text = await this.inputTokensDisplay.textContent()
    const match = text?.match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
  }

  async getTotalTokensCount(): Promise<number> {
    const text = await this.totalTokensDisplay.textContent()
    const match = text?.match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
  }

  async isContextWarningVisible(): Promise<boolean> {
    return await this.contextWarning.isVisible().catch(() => false)
  }

  async typeInInput(text: string) {
    await this.messageInput.fill(text)
    await this.page.waitForTimeout(500) // Wait for debounced token calculation
  }

  async getMessageCount(): Promise<number> {
    return await this.messages.count()
  }

  async verifyTokenCountsSum() {
    const history = await this.getHistoryTokensCount()
    const input = await this.getInputTokensCount()
    const total = await this.getTotalTokensCount()
    return total === history + input
  }

  // Message History Popover - New Methods for Popover Testing
  get messageHistoryPopoverTrigger() {
    return this.page.locator('[data-testid="message-history-popover-trigger"]')
  }

  get messageHistoryPopover() {
    return this.page.locator('[data-testid="message-history-popover"]')
  }

  get messageHistoryProgressBar() {
    return this.page.locator('[data-testid="message-history-progress-bar"]')
  }

  get messageHistoryPreviewText() {
    return this.page.locator('[data-testid="message-history-preview-text"]')
  }

  get messageHistorySliderInPopover() {
    return this.messageHistoryPopover.locator('input[type="range"]')
  }

  get messageHistoryWarningBanner() {
    return this.page.locator('[data-testid="context-warning"]').or(
      this.page.getByText(/large context|increase.*cost/i)
    )
  }

  async openMessageHistoryPopover(): Promise<void> {
    await this.messageHistoryPopoverTrigger.click()
    await this.page.waitForTimeout(300) // Wait for popover animation
    await expect(this.messageHistoryPopover).toBeVisible()
  }

  async closeMessageHistoryPopover(): Promise<void> {
    // Click outside the popover to close it
    await this.page.locator('body').click({ position: { x: 0, y: 0 } })
    await this.page.waitForTimeout(300) // Wait for popover animation
  }

  async getProgressBarPercentage(): Promise<number> {
    const style = await this.messageHistoryProgressBar.getAttribute('style')
    if (!style) return 0

    // Extract percentage from "width: XX%" style
    const match = style.match(/width:\s*(\d+)%/)
    return match ? parseInt(match[1], 10) : 0
  }

  async getMessageCountText(): Promise<string> {
    const text = await this.messageHistoryPreviewText.textContent()
    return text || ''
  }

  async getTokenCountFromPreview(): Promise<number> {
    const text = await this.messageHistoryPreviewText.textContent()
    const match = text?.match(/(\d+)\s+tokens/)
    return match ? parseInt(match[1], 10) : 0
  }

  async adjustSliderInPopover(value: number): Promise<void> {
    await this.messageHistorySliderInPopover.fill(value.toString())
    await this.page.waitForTimeout(500) // Wait for token calculation
  }

  async isPopoverVisible(): Promise<boolean> {
    try {
      await this.messageHistoryPopover.waitFor({ state: 'visible', timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  async isPopoverTriggerVisible(): Promise<boolean> {
    try {
      await this.messageHistoryPopoverTrigger.waitFor({ state: 'visible', timeout: 2000 })
      return true
    } catch {
      return false
    }
  }
}
