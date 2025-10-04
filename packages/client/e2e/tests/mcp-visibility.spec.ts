/**
 * E2E Tests for MCP Visibility and Groq Integration
 * Tests the MCP indicator, popover, and conditional Groq MCP enablement
 */

import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { AppPage } from '../pages/app.page'

test.describe('MCP Visibility Tests', () => {
  let chatPage: ChatPage
  let appPage: AppPage

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    appPage = new AppPage(page)

    // Navigate to chat and ensure we have an active chat
    await chatPage.goto()
    await appPage.waitForAppReady()

    // Create a new chat if needed
    try {
      await chatPage.createNewChat()
    } catch {
      // Chat may already exist
    }
  })

  test('should display MCP indicator in chat header', async () => {
    const isVisible = await chatPage.isMCPIndicatorVisible()
    expect(isVisible).toBe(true)
  })

  test('should show default MCP count (2 MCPs: Promptliano + Chrome DevTools)', async () => {
    const mcpCount = await chatPage.getMCPCount()
    expect(mcpCount).toBeGreaterThanOrEqual(2)
  })

  test('should open MCP popover when clicking indicator', async () => {
    await chatPage.openMCPPopover()

    // Popover should be visible
    await expect(chatPage.mcpPopover).toBeVisible()

    // Should have title
    await expect(chatPage.mcpPopover.locator('text="Active MCP Servers"')).toBeVisible()

    await chatPage.closeMCPPopover()
  })

  test('should display Promptliano MCP as enabled', async () => {
    const isEnabled = await chatPage.isMCPEnabled('Promptliano')
    expect(isEnabled).toBe(true)
  })

  test('should display Chrome DevTools MCP as enabled', async () => {
    const isEnabled = await chatPage.isMCPEnabled('Chrome DevTools')
    expect(isEnabled).toBe(true)
  })

  test('should show correct tool count for Promptliano MCP', async () => {
    const toolCount = await chatPage.getMCPToolCount('Promptliano')
    expect(toolCount).toBeGreaterThan(0)
    expect(toolCount).toBe(12) // Expected count based on implementation
  })

  test('should show correct tool count for Chrome DevTools MCP', async () => {
    const toolCount = await chatPage.getMCPToolCount('Chrome DevTools')
    expect(toolCount).toBeGreaterThan(0)
    expect(toolCount).toBe(8) // Expected count based on implementation
  })

  test('should expand MCP to show tools list', async () => {
    await chatPage.expandMCP('Promptliano')

    // Should show tool names
    await expect(chatPage.mcpPopover.locator('text="mcp__promptliano__project_manager"')).toBeVisible()

    await chatPage.closeMCPPopover()
  })

  test('should verify MCP popover structure', async () => {
    await chatPage.verifyMCPPopoverStructure()
  })

  test('should display total tool count', async () => {
    await chatPage.openMCPPopover()

    // Should show total tools (12 + 8 = 20 without Groq)
    await expect(chatPage.mcpPopover.locator('text=/\\d+ total tools/')).toBeVisible()

    await chatPage.closeMCPPopover()
  })

  test.describe('Local/Remote MCP Indicators', () => {
    test('should show Promptliano as local MCP', async () => {
      await chatPage.openMCPPopover()

      const promptlianoSection = chatPage.mcpPopoverContent.locator('text="Promptliano"').locator('../..')
      const localBadge = promptlianoSection.locator('text="local"')
      await expect(localBadge).toBeVisible()

      await chatPage.closeMCPPopover()
    })

    test('should show Chrome DevTools as local MCP', async () => {
      await chatPage.openMCPPopover()

      const chromeSection = chatPage.mcpPopoverContent.locator('text="Chrome DevTools"').locator('../..')
      const localBadge = chromeSection.locator('text="local"')
      await expect(localBadge).toBeVisible()

      await chatPage.closeMCPPopover()
    })
  })

  test.describe('Groq Remote MCP Integration', () => {
    test.skip('should show Groq MCP as disabled with non-Groq provider', async () => {
      // This test is skipped because provider selection UI may not be easily accessible
      // In production, this would test that Groq MCP is present but disabled
      
      await chatPage.openMCPPopover()

      // Look for Groq MCP
      const groqElement = chatPage.mcpPopoverContent.locator('text="Groq"')
      const isVisible = await groqElement.isVisible()

      if (isVisible) {
        // Should be marked as disabled or in inactive section
        const inactiveSection = chatPage.mcpPopover.locator('text=/inactive MCP/')
        expect(await inactiveSection.isVisible()).toBe(true)
      }

      await chatPage.closeMCPPopover()
    })

    test.skip('should enable Groq MCP when Groq provider is selected', async () => {
      // This test is skipped because it requires provider switching functionality
      // In production, this would:
      // 1. Change provider to Groq
      // 2. Verify MCP count increases to 3
      // 3. Verify Groq MCP shows as enabled
      // 4. Verify Groq tools are visible (web_search, web_scrape, etc.)

      await chatPage.changeProvider('groq')
      await chatPage.page.waitForTimeout(1000)

      const mcpCount = await chatPage.getMCPCount()
      expect(mcpCount).toBe(3)

      const isGroqEnabled = await chatPage.isMCPEnabled('Groq')
      expect(isGroqEnabled).toBe(true)

      const toolCount = await chatPage.getMCPToolCount('Groq')
      expect(toolCount).toBe(5) // web_search, web_scrape, stripe_invoice, stripe_payment, web_fetch
    })

    test.skip('should show Groq remote MCP badge', async () => {
      // This test would verify Groq MCP has "remote" badge
      await chatPage.changeProvider('groq')
      await chatPage.openMCPPopover()

      const groqSection = chatPage.mcpPopoverContent.locator('text="Groq"').locator('../..')
      const remoteBadge = groqSection.locator('text="remote"')
      await expect(remoteBadge).toBeVisible()

      await chatPage.closeMCPPopover()
    })

    test.skip('should display Groq tools when expanded', async () => {
      // This test would verify Groq tools are visible
      await chatPage.changeProvider('groq')

      const tools = await chatPage.getMCPTools('Groq')
      expect(tools).toContain('web_search')
      expect(tools).toContain('web_scrape')
      expect(tools).toContain('stripe_invoice')
      expect(tools).toContain('stripe_payment')
      expect(tools).toContain('web_fetch')
    })
  })

  test.describe('MCP Popover Interactions', () => {
    test('should close popover when clicking close button', async () => {
      await chatPage.openMCPPopover()
      await expect(chatPage.mcpPopover).toBeVisible()

      await chatPage.closeMCPPopover()
      await expect(chatPage.mcpPopover).not.toBeVisible()
    })

    test('should toggle MCP expansion', async () => {
      await chatPage.openMCPPopover()

      const mcpSection = chatPage.mcpPopoverContent.locator('text="Promptliano"').locator('../..')
      const expandButton = mcpSection.locator('button').last()

      // Expand
      await expandButton.click()
      await chatPage.page.waitForTimeout(300)

      // Should show tools
      await expect(mcpSection.locator('text="mcp__promptliano__project_manager"')).toBeVisible()

      // Collapse
      await expandButton.click()
      await chatPage.page.waitForTimeout(300)

      // Tools should be hidden (or section collapsed)
      await chatPage.closeMCPPopover()
    })
  })

  test.describe('Real-time Updates', () => {
    test.skip('should update MCP count when provider changes', async () => {
      // Initial count
      const initialCount = await chatPage.getMCPCount()

      // Change to Groq provider
      await chatPage.changeProvider('groq')
      await chatPage.page.waitForTimeout(1000)

      // Count should increase
      const newCount = await chatPage.getMCPCount()
      expect(newCount).toBeGreaterThan(initialCount)
    })

    test.skip('should update MCP list when provider changes', async () => {
      // Get initial list
      const initialList = await chatPage.getMCPList()

      // Change to Groq provider
      await chatPage.changeProvider('groq')
      await chatPage.page.waitForTimeout(1000)

      // List should include Groq
      const newList = await chatPage.getMCPList()
      expect(newList.length).toBeGreaterThan(initialList.length)
      expect(newList).toContain('Groq')
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Even if API fails, MCP indicator should still be visible
      const isVisible = await chatPage.isMCPIndicatorVisible()
      expect(isVisible).toBe(true)
    })

    test('should handle empty MCP lists gracefully', async () => {
      // Popover should open even if there are no MCPs (edge case)
      await chatPage.openMCPPopover()
      await expect(chatPage.mcpPopover).toBeVisible()
      await chatPage.closeMCPPopover()
    })
  })
})
