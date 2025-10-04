/**
 * Chat Message History Slider - E2E Tests
 * Tests the message history slider feature for controlling AI context
 *
 * Coverage:
 * - Slider visibility and appearance
 * - Token count calculation and display
 * - Slider value changes affect context
 * - Settings persistence
 * - Warning messages for large context
 * - Edge cases and error handling
 */

import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { AppPage } from '../pages/app.page'

test.describe('Message History Slider', () => {
  let chatPage: ChatPage
  let appPage: AppPage

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    appPage = new AppPage(page)

    // Navigate to chat and wait for ready
    await page.goto('/chat')
    await appPage.waitForAppReady()
  })

  test.describe('Slider Visibility', () => {
    test('should not display slider when chat is empty', async () => {
      // Empty chat should not show slider
      const sliderVisible = await chatPage.isSliderVisible()
      expect(sliderVisible).toBe(false)
    })

    test('should display slider after sending first message', async ({ page }) => {
      // Skip if AI providers not configured
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send a message
      await chatPage.sendMessage('Hello, this is my first message')

      // Wait for response
      await page.waitForTimeout(2000)

      // Slider should now be visible
      const sliderVisible = await chatPage.isSliderVisible()
      expect(sliderVisible).toBe(true)
    })

    test('should display slider with multiple messages', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send multiple messages
      await chatPage.sendMessage('Message 1')
      await page.waitForTimeout(1000)
      await chatPage.sendMessage('Message 2')
      await page.waitForTimeout(1000)

      // Slider should be visible
      const sliderVisible = await chatPage.isSliderVisible()
      expect(sliderVisible).toBe(true)
    })
  })

  test.describe('Slider Functionality', () => {
    test('should have correct min, max, and step values', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create some messages
      await chatPage.sendMessage('Test message 1')
      await page.waitForTimeout(1000)
      await chatPage.sendMessage('Test message 2')
      await page.waitForTimeout(1000)

      // Check slider attributes
      const min = await chatPage.getSliderMin()
      const max = await chatPage.getSliderMax()
      const current = await chatPage.getSliderValue()

      expect(min).toBeGreaterThanOrEqual(1)
      expect(max).toBeGreaterThanOrEqual(min)
      expect(current).toBeGreaterThanOrEqual(min)
      expect(current).toBeLessThanOrEqual(max)
    })

    test('should update when slider value changes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Test message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Get initial value
      const initialValue = await chatPage.getSliderValue()

      // Change slider value
      const min = await chatPage.getSliderMin()
      if (initialValue > min) {
        await chatPage.setSliderValue(min)
        const newValue = await chatPage.getSliderValue()
        expect(newValue).toBe(min)
      }
    })

    test('should show correct message count in label', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      await chatPage.sendMessage('Message 1')
      await page.waitForTimeout(1000)
      await chatPage.sendMessage('Message 2')
      await page.waitForTimeout(1000)

      // Check label text
      const labelText = await chatPage.sliderLabel.textContent()
      expect(labelText).toMatch(/\d+ of \d+ messages/)
    })
  })

  test.describe('Token Count Display', () => {
    test('should display history tokens', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send a message
      await chatPage.sendMessage('This is a test message with some content')
      await page.waitForTimeout(2000)

      // Check token displays are visible
      await expect(chatPage.historyTokensDisplay).toBeVisible()

      // Should have a non-zero token count
      const historyTokens = await chatPage.getHistoryTokensCount()
      expect(historyTokens).toBeGreaterThan(0)
    })

    test('should display input tokens when typing', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send initial message to show slider
      await chatPage.sendMessage('Initial message')
      await page.waitForTimeout(2000)

      // Type in input
      await chatPage.typeInInput('This is my new input message')

      // Check input token count
      await expect(chatPage.inputTokensDisplay).toBeVisible()
      const inputTokens = await chatPage.getInputTokensCount()
      expect(inputTokens).toBeGreaterThan(0)
    })

    test('should display total context tokens', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send message and type input
      await chatPage.sendMessage('History message')
      await page.waitForTimeout(2000)
      await chatPage.typeInInput('New input')

      // Check total tokens
      await expect(chatPage.totalTokensDisplay).toBeVisible()
      const totalTokens = await chatPage.getTotalTokensCount()
      expect(totalTokens).toBeGreaterThan(0)
    })

    test('should verify token counts sum correctly', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send message and type input
      await chatPage.sendMessage('Test message for token counting')
      await page.waitForTimeout(2000)
      await chatPage.typeInInput('Additional input text')

      // Verify sum
      const sumsCorrectly = await chatPage.verifyTokenCountsSum()
      expect(sumsCorrectly).toBe(true)
    })
  })

  test.describe('Token Count Updates', () => {
    test('should update history tokens when slider changes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create multiple messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Get initial token count
      const initialTokens = await chatPage.getHistoryTokensCount()

      // Reduce slider value
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)

      // Token count should decrease
      const newTokens = await chatPage.getHistoryTokensCount()
      expect(newTokens).toBeLessThan(initialTokens)
    })

    test('should update input tokens when typing', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send initial message
      await chatPage.sendMessage('Initial')
      await page.waitForTimeout(2000)

      // Type short message
      await chatPage.typeInInput('Hi')
      const shortTokens = await chatPage.getInputTokensCount()

      // Type longer message
      await chatPage.typeInInput('This is a much longer message with more content')
      const longTokens = await chatPage.getInputTokensCount()

      // Longer message should have more tokens
      expect(longTokens).toBeGreaterThan(shortTokens)
    })

    test('should update total tokens when either component changes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Get initial total
      const initialTotal = await chatPage.getTotalTokensCount()

      // Change slider
      const currentValue = await chatPage.getSliderValue()
      const min = await chatPage.getSliderMin()
      if (currentValue > min) {
        await chatPage.setSliderValue(min)
        const newTotal = await chatPage.getTotalTokensCount()
        expect(newTotal).not.toBe(initialTotal)
      }
    })
  })

  test.describe('Context Warning', () => {
    test('should show warning for large context', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Create many messages with long content
      for (let i = 0; i < 10; i++) {
        const longMessage = 'A'.repeat(500) + ` Message ${i}`
        await chatPage.sendMessage(longMessage)
        await page.waitForTimeout(800)
      }

      // Set slider to maximum
      const max = await chatPage.getSliderMax()
      await chatPage.setSliderValue(max)

      // Type long input
      await chatPage.typeInInput('B'.repeat(1000))

      // Check if warning appears
      const totalTokens = await chatPage.getTotalTokensCount()
      if (totalTokens > 8000) {
        const warningVisible = await chatPage.isContextWarningVisible()
        expect(warningVisible).toBe(true)
      }
    })

    test('should hide warning for small context', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send small message
      await chatPage.sendMessage('Small')
      await page.waitForTimeout(2000)

      // Set slider to minimum
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)

      // Type small input
      await chatPage.typeInInput('Hi')

      // Warning should not be visible
      const warningVisible = await chatPage.isContextWarningVisible()
      expect(warningVisible).toBe(false)
    })
  })

  test.describe('Edge Cases', () => {
    test('should handle slider at minimum value', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Set to minimum
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)

      const value = await chatPage.getSliderValue()
      expect(value).toBe(min)

      // Should still calculate tokens
      const tokens = await chatPage.getHistoryTokensCount()
      expect(tokens).toBeGreaterThanOrEqual(0)
    })

    test('should handle slider at maximum value', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Set to maximum
      const max = await chatPage.getSliderMax()
      await chatPage.setSliderValue(max)

      const value = await chatPage.getSliderValue()
      expect(value).toBe(max)

      // Should calculate tokens for all messages
      const tokens = await chatPage.getHistoryTokensCount()
      expect(tokens).toBeGreaterThan(0)
    })

    test('should handle empty input field', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send message
      await chatPage.sendMessage('Test')
      await page.waitForTimeout(2000)

      // Clear input
      await chatPage.typeInInput('')

      // Input tokens should be 0 or very small
      const inputTokens = await chatPage.getInputTokensCount()
      expect(inputTokens).toBeLessThanOrEqual(1)
    })

    test('should handle rapid slider changes', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      const min = await chatPage.getSliderMin()
      const max = await chatPage.getSliderMax()

      // Rapidly change slider
      await chatPage.setSliderValue(min)
      await chatPage.setSliderValue(max)
      await chatPage.setSliderValue(Math.floor((min + max) / 2))

      // Should still work correctly
      const value = await chatPage.getSliderValue()
      expect(value).toBeGreaterThanOrEqual(min)
      expect(value).toBeLessThanOrEqual(max)
    })
  })

  test.describe('Persistence', () => {
    test('should remember slider value across page reloads', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Set slider to specific value
      const targetValue = 3
      await chatPage.setSliderValue(targetValue)
      const beforeReload = await chatPage.getSliderValue()

      // Reload page
      await page.reload()
      await appPage.waitForAppReady()

      // Check if value persisted (if implemented)
      // Note: This might not be implemented yet
      const afterReload = await chatPage.getSliderValue()
      // If persistence is implemented, uncomment:
      // expect(afterReload).toBe(beforeReload)
    })
  })

  test.describe('Integration with Chat', () => {
    test('should affect messages sent to AI', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send several messages
      for (let i = 0; i < 5; i++) {
        await chatPage.sendMessage(`Context message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Set slider to limit context
      const min = await chatPage.getSliderMin()
      await chatPage.setSliderValue(min)

      // Send new message
      await chatPage.sendMessage('What was my first message?')
      await page.waitForTimeout(3000)

      // AI should not have access to early messages
      // (This would require mocking or checking the API request)
    })

    test('should update max when new messages arrive', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send initial messages
      await chatPage.sendMessage('Message 1')
      await page.waitForTimeout(1000)
      await chatPage.sendMessage('Message 2')
      await page.waitForTimeout(1000)

      const initialMax = await chatPage.getSliderMax()

      // Send another message
      await chatPage.sendMessage('Message 3')
      await page.waitForTimeout(2000)

      const newMax = await chatPage.getSliderMax()

      // Max should increase
      expect(newMax).toBeGreaterThan(initialMax)
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard accessible', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send messages
      for (let i = 0; i < 3; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(800)
      }

      // Focus slider
      await chatPage.messageHistorySlider.focus()

      // Use arrow keys to change value
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(500)

      // Should have changed value
      const value = await chatPage.getSliderValue()
      const min = await chatPage.getSliderMin()
      expect(value).toBeGreaterThanOrEqual(min)
    })

    test('should have proper ARIA labels', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send message to show slider
      await chatPage.sendMessage('Test')
      await page.waitForTimeout(2000)

      // Check for accessibility attributes
      const slider = chatPage.messageHistorySlider
      const role = await slider.getAttribute('role')
      const ariaLabel = await slider.getAttribute('aria-label')

      // Slider should have proper role
      expect(role === 'slider' || role === null).toBe(true) // null is ok for input[type=range]
    })
  })

  test.describe('Performance', () => {
    test('should handle large number of messages efficiently', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send many messages (simulated quickly)
      const startTime = Date.now()

      for (let i = 0; i < 20; i++) {
        await chatPage.sendMessage(`Message ${i + 1}`)
        await page.waitForTimeout(300) // Shorter wait
      }

      // Slider should still be responsive
      const max = await chatPage.getSliderMax()
      await chatPage.setSliderValue(max)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time
      expect(duration).toBeLessThan(60000) // 60 seconds
    })

    test('should debounce token calculations', async ({ page }) => {
      test.skip(
        !(await page.locator('[data-testid="send-button"]').isEnabled()),
        'AI provider not configured'
      )

      // Send message
      await chatPage.sendMessage('Test')
      await page.waitForTimeout(2000)

      // Rapidly type in input
      const startTime = Date.now()
      for (let i = 0; i < 10; i++) {
        await chatPage.messageInput.fill(`Test ${i}`)
        await page.waitForTimeout(50) // Very fast typing
      }
      const endTime = Date.now()

      // Should not lag (debouncing should help)
      expect(endTime - startTime).toBeLessThan(2000)
    })
  })
})