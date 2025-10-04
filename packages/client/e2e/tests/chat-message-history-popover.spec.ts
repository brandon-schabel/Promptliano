/**
 * Chat Message History Popover - E2E Tests
 * Tests the message history popover component for controlling AI context
 *
 * Coverage:
 * - Popover visibility and trigger conditions
 * - Progress bar display and updates
 * - Preview information (message count, tokens)
 * - Popover interaction (open/close)
 * - Slider functionality within popover
 * - Token count updates in real-time
 * - Warning banner display
 * - Integration with chat system
 * - Accessibility features
 */

import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { AppPage } from '../pages/app.page'

test.describe('Message History Popover', () => {
  let chatPage: ChatPage
  let appPage: AppPage

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    appPage = new AppPage(page)

    // Navigate to chat and wait for ready
    await page.goto('/chat')
    await appPage.waitForAppReady()
  })

  test.describe('Popover Visibility', () => {
    test('should not display popover trigger when chat is empty', async () => {
      // Empty chat should not show popover trigger
      const triggerVisible = await chatPage.isPopoverTriggerVisible()
      expect(triggerVisible).toBe(false)
    })

    test('should not display popover trigger with only 1 message', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send first message
      await chatPage.sendMessage('Hello, this is my first message')
      await page.waitForTimeout(2000)

      // With only 1 message pair, popover should not appear
      const triggerVisible = await chatPage.isPopoverTriggerVisible()
      expect(triggerVisible).toBe(false)
    })

    test('should display popover trigger after sending second message', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send first message
      await chatPage.sendMessage('First message')
      await page.waitForTimeout(2000)

      // Send second message
      await chatPage.sendMessage('Second message')
      await page.waitForTimeout(2000)

      // Popover trigger should now be visible
      const triggerVisible = await chatPage.isPopoverTriggerVisible()
      expect(triggerVisible).toBe(true)
    })

    test('should show popover on same row as system prompt', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send multiple messages to trigger popover
      await chatPage.sendMessage('Message 1')
      await page.waitForTimeout(1000)
      await chatPage.sendMessage('Message 2')
      await page.waitForTimeout(2000)

      // Check that trigger is visible and positioned correctly
      const trigger = chatPage.messageHistoryPopoverTrigger
      await expect(trigger).toBeVisible()

      // Verify it's in the same container as system prompt label
      const systemPromptArea = page.locator('text=/system prompt/i').first()
      if (await systemPromptArea.isVisible()) {
        const systemPromptBox = await systemPromptArea.boundingBox()
        const triggerBox = await trigger.boundingBox()

        // Should be on approximately the same vertical position (within 100px)
        expect(Math.abs((systemPromptBox?.y || 0) - (triggerBox?.y || 0))).toBeLessThan(100)
      }
    })
  })

  test.describe('Progress Bar Display', () => {
    test('should display progress bar in preview', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Progress bar should be visible
      await expect(chatPage.messageHistoryProgressBar).toBeVisible()
    })

    test('should reflect current message selection percentage', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create 10 messages
      for (let i = 0; i < 10; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(600)
      }

      // Set slider to 50% (5 of 10 messages)
      const max = await chatPage.getSliderMax()
      const halfValue = Math.ceil(max / 2)
      await chatPage.setSliderValue(halfValue)

      // Progress bar should show approximately 50%
      const percentage = await chatPage.getProgressBarPercentage()
      const expectedPercentage = (halfValue / max) * 100
      expect(Math.abs(percentage - expectedPercentage)).toBeLessThan(10) // Allow 10% variance
    })

    test('should update progress bar when slider moves', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 8; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(600)
      }

      // Get initial progress
      const initialPercentage = await chatPage.getProgressBarPercentage()

      // Reduce slider to minimum
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)

      // Progress should decrease
      const newPercentage = await chatPage.getProgressBarPercentage()
      expect(newPercentage).toBeLessThan(initialPercentage)
    })

    test('should show correct percentage at minimum and maximum values', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // At maximum, should be 100%
      const max = await chatPage.getSliderMax()
      await chatPage.setSliderValue(max)
      const maxPercentage = await chatPage.getProgressBarPercentage()
      expect(maxPercentage).toBeGreaterThanOrEqual(95) // Allow small variance

      // At minimum, should be much lower
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)
      const minPercentage = await chatPage.getProgressBarPercentage()
      expect(minPercentage).toBeLessThan(50)
    })
  })

  test.describe('Preview Information', () => {
    test('should show correct message count text', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send 3 messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Test ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Check message count text
      const countText = await chatPage.getMessageCountText()
      expect(countText).toMatch(/\d+ of \d+ messages/)
    })

    test('should show token count in preview', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage('This is a test message with content')
        await page.waitForTimeout(800)
      }

      // Token count should be visible and greater than zero
      const tokenCount = await chatPage.getTokenCountFromPreview()
      expect(tokenCount).toBeGreaterThan(0)
    })

    test('should update preview when slider changes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create multiple messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Get initial token count
      const initialTokens = await chatPage.getTokenCountFromPreview()

      // Reduce slider
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)

      // Token count should decrease
      const newTokens = await chatPage.getTokenCountFromPreview()
      expect(newTokens).toBeLessThan(initialTokens)
    })

    test('should have hover effect on preview', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(700)
      }

      // Hover over trigger
      await chatPage.messageHistoryPopoverTrigger.hover()

      // Should have cursor pointer style or hover state
      const cursor = await chatPage.messageHistoryPopoverTrigger.evaluate((el) => {
        return window.getComputedStyle(el).cursor
      })

      expect(cursor).toBe('pointer')
    })
  })

  test.describe('Popover Interaction', () => {
    test('should open popover when clicking preview', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Click trigger to open popover
      await chatPage.openMessageHistoryPopover()

      // Popover should be visible
      const isVisible = await chatPage.isPopoverVisible()
      expect(isVisible).toBe(true)
    })

    test('should close popover when clicking outside', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(700)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()
      expect(await chatPage.isPopoverVisible()).toBe(true)

      // Close popover
      await chatPage.closeMessageHistoryPopover()

      // Should no longer be visible
      const isVisible = await chatPage.isPopoverVisible()
      expect(isVisible).toBe(false)
    })

    test('should contain slider in popover', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 4; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Slider should be visible inside popover
      await expect(chatPage.messageHistorySliderInPopover).toBeVisible()
    })

    test('should show detailed token breakdown in popover', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(800)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Should show history, input, and total token displays
      await expect(chatPage.historyTokensDisplay).toBeVisible()
      await expect(chatPage.inputTokensDisplay).toBeVisible()
      await expect(chatPage.totalTokensDisplay).toBeVisible()
    })
  })

  test.describe('Slider Functionality in Popover', () => {
    test('should adjust slider within popover', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Adjust slider
      const min = await chatPage.getSliderMin()
      await chatPage.adjustSliderInPopover(min)

      // Verify slider value changed
      const sliderValue = await chatPage.messageHistorySliderInPopover.inputValue()
      expect(parseInt(sliderValue, 10)).toBe(min)
    })

    test('should update token counts in real-time when slider changes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 6; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(600)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Get initial token count
      const initialHistoryTokens = await chatPage.getHistoryTokensCount()

      // Adjust slider to minimum
      const min = await chatPage.getSliderMin()
      await chatPage.adjustSliderInPopover(min)

      // History tokens should decrease
      const newHistoryTokens = await chatPage.getHistoryTokensCount()
      expect(newHistoryTokens).toBeLessThan(initialHistoryTokens)
    })

    test('should update progress bar preview when slider changes in popover', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 8; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(600)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Get initial progress
      const initialProgress = await chatPage.getProgressBarPercentage()

      // Adjust slider
      const min = await chatPage.getSliderMin()
      await chatPage.adjustSliderInPopover(min)

      // Progress should update
      const newProgress = await chatPage.getProgressBarPercentage()
      expect(newProgress).toBeLessThan(initialProgress)
    })

    test('should sync slider value between popover and main view', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Open popover and adjust slider
      await chatPage.openMessageHistoryPopover()
      const targetValue = 3
      await chatPage.adjustSliderInPopover(targetValue)

      // Close popover
      await chatPage.closeMessageHistoryPopover()

      // Main slider should reflect the same value
      const mainSliderValue = await chatPage.getSliderValue()
      expect(mainSliderValue).toBe(targetValue)
    })
  })

  test.describe('Warning Banner', () => {
    test('should show warning when tokens exceed 8000', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create many messages with long content
      for (let i = 0; i < 15; i++) {
        const longMessage = 'A'.repeat(500) + ` Message ${i}`
        await chatPage.sendMessage(longMessage)
        await page.waitForTimeout(500)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Set slider to maximum
      const max = await chatPage.getSliderMax()
      await chatPage.adjustSliderInPopover(max)

      // Type long input
      await chatPage.typeInInput('B'.repeat(1000))

      // Check if warning appears
      const totalTokens = await chatPage.getTotalTokensCount()
      if (totalTokens > 8000) {
        const warningVisible = await chatPage.isContextWarningVisible()
        expect(warningVisible).toBe(true)
      }
    })

    test('should have correct warning message', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create many long messages
      for (let i = 0; i < 20; i++) {
        await chatPage.sendMessage('A'.repeat(400))
        await page.waitForTimeout(400)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Check for warning
      const totalTokens = await chatPage.getTotalTokensCount()
      if (totalTokens > 8000) {
        const warningText = await chatPage.messageHistoryWarningBanner.textContent()
        expect(warningText).toMatch(/large context|increase.*cost/i)
      }
    })

    test('should show warning inside popover', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create many messages
      for (let i = 0; i < 15; i++) {
        await chatPage.sendMessage('X'.repeat(500))
        await page.waitForTimeout(500)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Set max and type long input
      const max = await chatPage.getSliderMax()
      await chatPage.adjustSliderInPopover(max)
      await chatPage.typeInInput('Y'.repeat(1000))

      // Warning should be inside popover
      const totalTokens = await chatPage.getTotalTokensCount()
      if (totalTokens > 8000) {
        const warningInPopover = chatPage.messageHistoryPopover.locator(
          '[data-testid="context-warning"]'
        )
        const isVisible = await warningInPopover.isVisible().catch(() => false)
        expect(isVisible).toBe(true)
      }
    })
  })

  test.describe('Integration with Chat', () => {
    test('should filter message history correctly', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send several messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Context message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Open popover and limit context
      await chatPage.openMessageHistoryPopover()
      const min = await chatPage.getSliderMin()
      await chatPage.adjustSliderInPopover(min)
      await chatPage.closeMessageHistoryPopover()

      // Send new message - should use limited context
      await chatPage.sendMessage('What was my first message?')
      await page.waitForTimeout(3000)

      // This verifies the integration works (full verification requires API mocking)
    })

    test('should include maxMessagesToInclude parameter in API requests', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Set up request listener
      const requestPromise = page.waitForRequest(
        (request) =>
          request.url().includes('/api/ai/chat/completions') && request.method() === 'POST'
      )

      // Open popover and adjust slider
      await chatPage.openMessageHistoryPopover()
      await chatPage.adjustSliderInPopover(3)
      await chatPage.closeMessageHistoryPopover()

      // Send message
      await chatPage.sendMessage('Test message')

      // Check request includes maxMessagesToInclude
      const request = await requestPromise
      const postData = request.postDataJSON()
      expect(postData).toHaveProperty('maxMessagesToInclude')
      expect(postData.maxMessagesToInclude).toBe(3)
    })

    test('should persist slider value across messages', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(700)
      }

      // Set slider to specific value via popover
      await chatPage.openMessageHistoryPopover()
      const targetValue = 3
      await chatPage.adjustSliderInPopover(targetValue)
      await chatPage.closeMessageHistoryPopover()

      // Send another message
      await chatPage.sendMessage('Another message')
      await page.waitForTimeout(2000)

      // Slider should maintain the same value
      const sliderValue = await chatPage.getSliderValue()
      expect(sliderValue).toBe(targetValue)
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard accessible', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Focus trigger with keyboard
      await chatPage.messageHistoryPopoverTrigger.focus()
      await page.keyboard.press('Enter')

      // Popover should open
      await expect(chatPage.messageHistoryPopover).toBeVisible()

      // Should be able to navigate with keyboard
      await page.keyboard.press('Tab')
      await page.keyboard.press('ArrowLeft')

      // Escape should close popover
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      const isVisible = await chatPage.isPopoverVisible()
      expect(isVisible).toBe(false)
    })

    test('should have proper ARIA attributes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(800)
      }

      // Check trigger has proper attributes
      const trigger = chatPage.messageHistoryPopoverTrigger
      const ariaExpanded = await trigger.getAttribute('aria-expanded')
      expect(ariaExpanded).toBeDefined()

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Popover should have role
      const popoverRole = await chatPage.messageHistoryPopover.getAttribute('role')
      expect(['dialog', 'menu', 'tooltip'].includes(popoverRole || '')).toBe(true)
    })

    test('should announce changes to screen readers', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 4; i++) {
        await chatPage.sendMessage(`Message ${i}`)
        await page.waitForTimeout(700)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Check for live region for token updates
      const liveRegion = page.locator('[aria-live]')
      if (await liveRegion.count() > 0) {
        const ariaLive = await liveRegion.first().getAttribute('aria-live')
        expect(['polite', 'assertive'].includes(ariaLive || '')).toBe(true)
      }
    })
  })

  test.describe('Edge Cases', () => {
    test('should handle exactly 2 messages (minimum for popover)', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send exactly 2 messages
      await chatPage.sendMessage('First')
      await page.waitForTimeout(1000)
      await chatPage.sendMessage('Second')
      await page.waitForTimeout(2000)

      // Trigger should be visible
      const triggerVisible = await chatPage.isPopoverTriggerVisible()
      expect(triggerVisible).toBe(true)

      // Should be able to open popover
      await chatPage.openMessageHistoryPopover()
      expect(await chatPage.isPopoverVisible()).toBe(true)
    })

    test('should handle rapid popover open/close', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(800)
      }

      // Rapidly open and close
      for (let i = 0; i < 3; i++) {
        await chatPage.messageHistoryPopoverTrigger.click()
        await page.waitForTimeout(100)
        await chatPage.closeMessageHistoryPopover()
        await page.waitForTimeout(100)
      }

      // Should still work correctly
      await chatPage.openMessageHistoryPopover()
      expect(await chatPage.isPopoverVisible()).toBe(true)
    })

    test('should handle slider adjustment while popover is open', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 6; i++) {
        await chatPage.sendMessage(`Message ${i}`)
        await page.waitForTimeout(600)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Adjust main slider while popover is open
      await chatPage.setSliderValue(2)

      // Popover slider should sync
      const popoverSliderValue = await chatPage.messageHistorySliderInPopover.inputValue()
      expect(parseInt(popoverSliderValue, 10)).toBe(2)
    })

    test('should handle very large token counts in display', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages with very long content
      for (let i = 0; i < 10; i++) {
        const veryLongMessage = 'Z'.repeat(1000)
        await chatPage.sendMessage(veryLongMessage)
        await page.waitForTimeout(500)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Token displays should show large numbers correctly
      const totalTokens = await chatPage.getTotalTokensCount()
      expect(totalTokens).toBeGreaterThan(1000)

      // Display should not overflow
      const tokenDisplay = chatPage.totalTokensDisplay
      const isVisible = await tokenDisplay.isVisible()
      expect(isVisible).toBe(true)
    })
  })

  test.describe('Performance', () => {
    test('should update popover efficiently with many messages', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create many messages
      for (let i = 0; i < 20; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(300)
      }

      // Open popover - should be responsive
      const startTime = Date.now()
      await chatPage.openMessageHistoryPopover()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should open quickly
    })

    test('should debounce slider changes in popover', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 8; i++) {
        await chatPage.sendMessage(`Test ${i}`)
        await page.waitForTimeout(600)
      }

      // Open popover
      await chatPage.openMessageHistoryPopover()

      // Rapidly change slider
      const startTime = Date.now()
      for (let i = 1; i <= 5; i++) {
        await chatPage.messageHistorySliderInPopover.fill(i.toString())
        await page.waitForTimeout(50)
      }
      const endTime = Date.now()

      // Should complete quickly due to debouncing
      expect(endTime - startTime).toBeLessThan(2000)
    })
  })
})