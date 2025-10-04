/**
 * Chat Page Object
 * Handles interactions with the chat interface including MCP indicator
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class ChatPage extends BasePage {
  // Chat elements
  readonly chatInterface: Locator
  readonly chatHeader: Locator
  readonly chatInput: Locator
  readonly sendButton: Locator
  readonly modelSettingsButton: Locator
  readonly presetSelector: Locator

  // MCP elements
  readonly mcpIndicator: Locator
  readonly mcpIndicatorBadge: Locator
  readonly mcpPopover: Locator
  readonly mcpPopoverContent: Locator

  // Provider elements
  readonly providerSelector: Locator

  constructor(page: Page) {
    super(page)

    // Chat elements
    this.chatInterface = page.locator('[data-testid="chat-interface"], .chat-container')
    this.chatHeader = page.locator('.chat-header, [data-testid="chat-header"]')
    this.chatInput = page.locator('textarea[placeholder*="message"], [data-testid="chat-input"]')
    this.sendButton = page.locator('button[type="submit"], [data-testid="send-button"]')
    this.modelSettingsButton = page.locator('button:has-text("Settings"), [data-testid="model-settings"]')
    this.presetSelector = page.locator('[data-testid="preset-selector"]')

    // MCP elements
    this.mcpIndicator = page.locator('button:has(svg[class*="lucide-server"])')
    this.mcpIndicatorBadge = this.mcpIndicator.locator('[class*="badge"]')
    this.mcpPopover = page.locator('[role="dialog"]:has-text("Active MCP Servers")')
    this.mcpPopoverContent = this.mcpPopover.locator('[class*="popover-content"]')

    // Provider elements
    this.providerSelector = page.locator('select[name="provider"], [data-testid="provider-selector"]')
  }

  /**
   * Navigate to chat page
   */
  async goto() {
    await this.page.goto('/chat')
    await this.waitForLoad()
  }

  /**
   * Wait for chat interface to be ready
   */
  async waitForLoad() {
    await this.chatInterface.waitFor({ state: 'visible', timeout: 10000 })
  }

  /**
   * Create a new chat
   */
  async createNewChat() {
    const newChatButton = this.page.locator('button:has-text("New Chat"), [data-testid="new-chat"]')
    await newChatButton.click()
    await this.page.waitForTimeout(500) // Wait for navigation
  }

  /**
   * Get MCP indicator badge count
   */
  async getMCPCount(): Promise<number> {
    await this.mcpIndicatorBadge.waitFor({ state: 'visible', timeout: 5000 })
    const text = await this.mcpIndicatorBadge.textContent()
    return parseInt(text?.trim() || '0', 10)
  }

  /**
   * Check if MCP indicator is visible
   */
  async isMCPIndicatorVisible(): Promise<boolean> {
    try {
      await this.mcpIndicator.waitFor({ state: 'visible', timeout: 3000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Open MCP info popover
   */
  async openMCPPopover() {
    await this.mcpIndicator.waitFor({ state: 'visible', timeout: 5000 })
    await this.mcpIndicator.click()
    await this.mcpPopover.waitFor({ state: 'visible', timeout: 3000 })
  }

  /**
   * Close MCP info popover
   */
  async closeMCPPopover() {
    // Click outside or find close button
    const closeButton = this.mcpPopover.locator('button:has-text("Close")')
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      // Click outside the popover
      await this.page.mouse.click(100, 100)
    }
    await this.mcpPopover.waitFor({ state: 'hidden', timeout: 3000 })
  }

  /**
   * Get list of MCPs from the popover
   */
  async getMCPList(): Promise<string[]> {
    await this.openMCPPopover()

    // Find all MCP names in the popover
    const mcpNames = await this.mcpPopoverContent.locator('[class*="font-medium"]').allTextContents()

    await this.closeMCPPopover()
    return mcpNames.filter((name) => name.trim().length > 0)
  }

  /**
   * Get enabled MCPs from the popover
   */
  async getEnabledMCPs(): Promise<string[]> {
    await this.openMCPPopover()

    // Find MCPs that are enabled (look for enabled indicators)
    const enabledMCPs: string[] = []
    const mcpElements = await this.mcpPopoverContent.locator('[class*="border-primary"]').all()

    for (const element of mcpElements) {
      const name = await element.locator('[class*="font-medium"]').first().textContent()
      if (name) enabledMCPs.push(name.trim())
    }

    await this.closeMCPPopover()
    return enabledMCPs
  }

  /**
   * Check if specific MCP is enabled
   */
  async isMCPEnabled(mcpName: string): Promise<boolean> {
    await this.openMCPPopover()

    const mcpElement = this.mcpPopoverContent.locator(`text="${mcpName}"`).first()
    const isVisible = await mcpElement.isVisible()

    if (!isVisible) {
      await this.closeMCPPopover()
      return false
    }

    // Check if parent has enabled styling
    const parent = mcpElement.locator('..').locator('..')
    const classList = await parent.getAttribute('class')
    const isEnabled = classList?.includes('border-primary') || false

    await this.closeMCPPopover()
    return isEnabled
  }

  /**
   * Get tool count for a specific MCP
   */
  async getMCPToolCount(mcpName: string): Promise<number> {
    await this.openMCPPopover()

    const mcpSection = this.mcpPopoverContent.locator(`text="${mcpName}"`).locator('../..')
    const toolBadge = mcpSection.locator('text=/\\d+ tools?/')
    const text = await toolBadge.textContent()
    const match = text?.match(/(\d+) tools?/)

    await this.closeMCPPopover()
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Expand MCP to see tools
   */
  async expandMCP(mcpName: string) {
    await this.openMCPPopover()

    const mcpSection = this.mcpPopoverContent.locator(`text="${mcpName}"`).locator('../..')
    const expandButton = mcpSection.locator('button').last()
    await expandButton.click()
    await this.page.waitForTimeout(300) // Wait for animation
  }

  /**
   * Get tools for a specific MCP
   */
  async getMCPTools(mcpName: string): Promise<string[]> {
    await this.expandMCP(mcpName)

    const mcpSection = this.mcpPopoverContent.locator(`text="${mcpName}"`).locator('../..')
    const tools = await mcpSection.locator('[class*="font-medium"]').allTextContents()

    await this.closeMCPPopover()
    return tools.filter((tool) => tool.trim() && tool !== mcpName)
  }

  /**
   * Change provider (requires opening model settings)
   */
  async changeProvider(provider: string) {
    // Open model settings
    await this.modelSettingsButton.click()
    await this.page.waitForTimeout(500)

    // Find and select provider
    const providerSelect = this.page.locator('select[name*="provider"], [data-testid="provider-select"]')
    await providerSelect.selectOption(provider)
    await this.page.waitForTimeout(500)

    // Close settings
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(500)
  }

  /**
   * Verify MCP popover structure
   */
  async verifyMCPPopoverStructure() {
    await this.openMCPPopover()

    // Should have title
    await expect(this.mcpPopover.locator('text="Active MCP Servers"')).toBeVisible()

    // Should have MCP count info
    await expect(this.mcpPopover.locator('text=/\\d+ enabled/')).toBeVisible()
    await expect(this.mcpPopover.locator('text=/\\d+ total tools/')).toBeVisible()

    await this.closeMCPPopover()
  }
}
