import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages/chat.page'
import { ChatPageTestData } from '../fixtures/chat-page-data'

test.describe('Chat Settings and Configuration', () => {
  test.describe('Model Settings Configuration', () => {
    test('should open chat settings modal', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Open settings
      await chatPage.openChatSettings()

      // Verify modal is displayed with all settings
      await expect(chatPage.settingsModal).toBeVisible()
      await expect(page.getByText('Model Settings')).toBeVisible()

      // Verify all setting controls are present
      await expect(chatPage.temperatureSlider).toBeVisible()
      await expect(chatPage.maxTokensInput).toBeVisible()
      await expect(chatPage.topPSlider).toBeVisible()
      await expect(chatPage.frequencyPenaltySlider).toBeVisible()
      await expect(chatPage.presencePenaltySlider).toBeVisible()
    })

    test('should adjust temperature setting', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')
      await chatPage.openChatSettings()

      // Get current temperature value
      const currentTemp = await chatPage.temperatureSlider.inputValue()
      const newTemp = '0.9'

      // Adjust temperature
      await chatPage.temperatureSlider.fill(newTemp)

      // Verify value changed
      await expect(chatPage.temperatureSlider).toHaveValue(newTemp)

      // Save settings (if there's a save button)
      const saveButton = page.getByRole('button', { name: 'Save' })
      if (await saveButton.isVisible()) {
        await saveButton.click()
      }

      // Close modal
      await page.getByRole('button', { name: 'Close' }).click()
      await expect(chatPage.settingsModal).not.toBeVisible()
    })

    test('should adjust max tokens setting', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')
      await chatPage.openChatSettings()

      // Set max tokens
      await chatPage.maxTokensInput.fill('2000')

      // Verify value updated
      await expect(chatPage.maxTokensInput).toHaveValue('2000')

      // Test validation - should not allow invalid values
      await chatPage.maxTokensInput.fill('999999')

      // Should either prevent input or show validation error
      const errorMessage = page.getByText(/max tokens.*limit|invalid.*tokens/i)
      const inputValue = await chatPage.maxTokensInput.inputValue()

      // Either validation prevented the input or error is shown
      expect(parseInt(inputValue) <= 100000 || (await errorMessage.isVisible())).toBe(true)
    })

    test('should adjust penalty settings with sliders', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')
      await chatPage.openChatSettings()

      // Test Top P slider
      await chatPage.topPSlider.fill('0.8')
      await expect(chatPage.topPSlider).toHaveValue('0.8')

      // Test Frequency Penalty slider
      await chatPage.frequencyPenaltySlider.fill('0.5')
      await expect(chatPage.frequencyPenaltySlider).toHaveValue('0.5')

      // Test Presence Penalty slider
      await chatPage.presencePenaltySlider.fill('0.3')
      await expect(chatPage.presencePenaltySlider).toHaveValue('0.3')

      // Verify sliders stay within valid ranges (0-2 for penalties, 0-1 for top-p)
      await chatPage.frequencyPenaltySlider.fill('3.0')
      const freqValue = await chatPage.frequencyPenaltySlider.inputValue()
      expect(parseFloat(freqValue)).toBeLessThanOrEqual(2.0)

      await chatPage.topPSlider.fill('1.5')
      const topPValue = await chatPage.topPSlider.inputValue()
      expect(parseFloat(topPValue)).toBeLessThanOrEqual(1.0)
    })

    test('should persist settings across chat sessions', async ({ page }) => {
      const chatPage = new ChatPage(page)
      await chatPage.goto('/chat')

      // Set custom settings
      await chatPage.openChatSettings()
      await chatPage.temperatureSlider.fill('0.2')
      await chatPage.maxTokensInput.fill('1500')

      const saveButton = page.getByRole('button', { name: 'Save' })
      if (await saveButton.isVisible()) {
        await saveButton.click()
      }
      await page.getByRole('button', { name: 'Close' }).click()

      // Navigate to different chat
      await page.goto('/chat/new')

      // Open settings again
      await chatPage.openChatSettings()

      // Verify settings persisted
      await expect(chatPage.temperatureSlider).toHaveValue('0.2')
      await expect(chatPage.maxTokensInput).toHaveValue('1500')
    })
  })
})
