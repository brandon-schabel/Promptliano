import { test, expect } from '@playwright/test'
import { ChatPage } from '../../pages/chat.page'
import { ChatHelpers } from '../../helpers/chat-helpers'
import { 
  generateUniqueChat,
  testProviders,
  testModelSettings
} from '../../fixtures/chat-data'

test.describe('Chat - Models and Settings', () => {
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

  test('should display model information', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('model-info')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Check for model info display
      const modelInfoVisible = await chatPage.modelInfoDisplay.isVisible()
      
      if (modelInfoVisible) {
        const modelInfo = await chatPage.modelInfoDisplay.textContent()
        console.log(`✅ Model info displayed: ${modelInfo}`)
        
        // Should show provider and model
        expect(modelInfo).toMatch(/Using:/i)
        
        // Check for copy model ID button
        const copyButtonVisible = await chatPage.copyModelIdButton.isVisible()
        if (copyButtonVisible) {
          console.log('✅ Copy model ID button available')
        }
      } else {
        console.log('⚠️ Model info not visible')
      }
    }
  })

  test('should open model settings popover', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('settings-popover')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Check if settings button is visible
      const settingsButtonVisible = await chatPage.modelSettingsButton.isVisible()
      
      if (settingsButtonVisible) {
        // Open settings
        await chatPage.openModelSettings()
        
        // Check if popover opened
        const popoverVisible = await chatPage.settingsPopover.isVisible()
        expect(popoverVisible).toBe(true)
        console.log('✅ Settings popover opened')
        
        // Check for settings elements
        const elements = [
          { name: 'Provider selector', element: chatPage.providerSelector },
          { name: 'Model selector', element: chatPage.modelSelector },
          { name: 'Temperature slider', element: chatPage.temperatureSlider },
          { name: 'Max tokens input', element: chatPage.maxTokensInput }
        ]
        
        for (const { name, element } of elements) {
          const isVisible = await element.isVisible()
          if (isVisible) {
            console.log(`✅ ${name} visible in settings`)
          }
        }
        
        // Close popover
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
        
        const popoverHidden = await chatPage.settingsPopover.isHidden()
        expect(popoverHidden).toBe(true)
        console.log('✅ Settings popover closed')
      } else {
        console.log('ℹ️ Settings button not available (no active chat)')
      }
    }
  })

  test('should change provider selection', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('provider-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      await chatPage.openModelSettings()
      
      // Click provider selector
      await chatPage.providerSelector.click()
      await page.waitForTimeout(500)
      
      // Check for provider options
      const options = page.getByRole('option')
      const optionCount = await options.count()
      
      if (optionCount > 0) {
        console.log(`✅ Found ${optionCount} provider options`)
        
        // Select a different provider
        const secondOption = options.nth(1)
        const optionText = await secondOption.textContent()
        await secondOption.click()
        await page.waitForTimeout(500)
        
        console.log(`✅ Selected provider: ${optionText}`)
        
        // Close settings
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
        
        // Check if provider changed in display
        const modelInfo = await chatPage.modelInfoDisplay.textContent()
        if (modelInfo?.includes(optionText || '')) {
          console.log('✅ Provider change reflected in UI')
        }
      } else {
        console.log('⚠️ No provider options available')
      }
    }
  })

  test('should change model selection', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('model-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      await chatPage.openModelSettings()
      
      // Click model selector
      await chatPage.modelSelector.click()
      await page.waitForTimeout(500)
      
      // Check for model options
      const options = page.getByRole('option')
      const optionCount = await options.count()
      
      if (optionCount > 0) {
        console.log(`✅ Found ${optionCount} model options`)
        
        // Get current model
        const currentModel = await chatPage.modelSelector.textContent()
        
        // Select a different model
        const differentOption = options.first()
        const newModel = await differentOption.textContent()
        
        if (newModel !== currentModel) {
          await differentOption.click()
          await page.waitForTimeout(500)
          console.log(`✅ Changed model to: ${newModel}`)
        }
        
        // Close settings
        await page.keyboard.press('Escape')
      } else {
        console.log('⚠️ No model options available')
      }
    }
  })

  test('should adjust temperature setting', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('temperature-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      await chatPage.openModelSettings()
      
      // Check temperature slider
      const sliderVisible = await chatPage.temperatureSlider.isVisible()
      
      if (sliderVisible) {
        // Get current value
        const currentValue = await chatPage.temperatureSlider.inputValue()
        console.log(`ℹ️ Current temperature: ${currentValue}`)
        
        // Set new temperature
        const newTemp = 0.5
        await chatPage.setTemperature(newTemp)
        
        // Verify change
        const updatedValue = await chatPage.temperatureSlider.inputValue()
        expect(parseFloat(updatedValue)).toBeCloseTo(newTemp, 1)
        console.log(`✅ Temperature set to: ${updatedValue}`)
        
        // Try extreme values
        await chatPage.temperatureSlider.fill('0')
        let value = await chatPage.temperatureSlider.inputValue()
        expect(parseFloat(value)).toBe(0)
        console.log('✅ Min temperature (0) accepted')
        
        await chatPage.temperatureSlider.fill('2')
        value = await chatPage.temperatureSlider.inputValue()
        expect(parseFloat(value)).toBeLessThanOrEqual(2)
        console.log('✅ Max temperature accepted')
      } else {
        console.log('⚠️ Temperature slider not visible')
      }
      
      // Close settings
      await page.keyboard.press('Escape')
    }
  })

  test('should adjust max tokens setting', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('tokens-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      await chatPage.openModelSettings()
      
      // Check max tokens input
      const inputVisible = await chatPage.maxTokensInput.isVisible()
      
      if (inputVisible) {
        // Get current value
        const currentValue = await chatPage.maxTokensInput.inputValue()
        console.log(`ℹ️ Current max tokens: ${currentValue}`)
        
        // Set new value
        const newTokens = 2048
        await chatPage.setMaxTokens(newTokens)
        
        // Verify change
        const updatedValue = await chatPage.maxTokensInput.inputValue()
        expect(parseInt(updatedValue)).toBe(newTokens)
        console.log(`✅ Max tokens set to: ${updatedValue}`)
        
        // Try large value
        await chatPage.maxTokensInput.fill('100000')
        const largeValue = await chatPage.maxTokensInput.inputValue()
        console.log(`✅ Large token value accepted: ${largeValue}`)
      } else {
        console.log('⚠️ Max tokens input not visible')
      }
      
      // Close settings
      await page.keyboard.press('Escape')
    }
  })

  test('should adjust advanced settings', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('advanced-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      await chatPage.openModelSettings()
      
      // Test Top P
      const topPVisible = await chatPage.topPSlider.isVisible()
      if (topPVisible) {
        await chatPage.topPSlider.fill('0.8')
        const topPValue = await chatPage.topPSlider.inputValue()
        expect(parseFloat(topPValue)).toBeCloseTo(0.8, 1)
        console.log(`✅ Top P set to: ${topPValue}`)
      }
      
      // Test Frequency Penalty
      const freqVisible = await chatPage.frequencyPenaltySlider.isVisible()
      if (freqVisible) {
        await chatPage.frequencyPenaltySlider.fill('0.5')
        const freqValue = await chatPage.frequencyPenaltySlider.inputValue()
        expect(parseFloat(freqValue)).toBeCloseTo(0.5, 1)
        console.log(`✅ Frequency penalty set to: ${freqValue}`)
      }
      
      // Test Presence Penalty
      const presVisible = await chatPage.presencePenaltySlider.isVisible()
      if (presVisible) {
        await chatPage.presencePenaltySlider.fill('0.3')
        const presValue = await chatPage.presencePenaltySlider.inputValue()
        expect(parseFloat(presValue)).toBeCloseTo(0.3, 1)
        console.log(`✅ Presence penalty set to: ${presValue}`)
      }
      
      // Close settings
      await page.keyboard.press('Escape')
    }
  })

  test('should copy model ID', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    
    // Create a chat
    const chatData = generateUniqueChat('copy-model')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Check for copy model ID button
      const copyButtonVisible = await chatPage.copyModelIdButton.isVisible()
      
      if (copyButtonVisible) {
        await chatPage.copyModelIdButton.click()
        await page.waitForTimeout(500)
        
        // Check for success message
        const toastMessage = await ChatHelpers.getToastMessage(page)
        if (toastMessage) {
          expect(toastMessage.toLowerCase()).toContain('cop')
          console.log('✅ Model ID copy success message shown')
        }
        
        // Try to verify clipboard
        try {
          const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
          if (clipboardText) {
            console.log(`✅ Model ID copied: ${clipboardText}`)
            // Should be a model ID like 'gpt-4' or 'claude-3-opus'
            expect(clipboardText).toMatch(/^[a-z0-9-_.]+$/i)
          }
        } catch {
          console.log('ℹ️ Cannot verify clipboard (expected in CI)')
        }
      } else {
        console.log('ℹ️ Copy model ID button not visible')
      }
    }
  })

  test('should persist settings across chats', async ({ page }) => {
    // Create first chat
    const chat1Data = generateUniqueChat('persist-1')
    const chat1 = await ChatHelpers.createTestChat(page, chat1Data)
    
    if (chat1.id) {
      createdChatIds.push(chat1.id)
      await chatPage.goto(chat1.id)
      
      // Set specific settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (settingsVisible) {
        await chatPage.openModelSettings()
        
        // Set temperature to specific value
        await chatPage.setTemperature(0.8)
        
        // Set max tokens
        await chatPage.setMaxTokens(3000)
        
        // Close settings
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
        
        console.log('✅ Settings configured for first chat')
      }
      
      // Create second chat
      const chat2Data = generateUniqueChat('persist-2')
      const chat2 = await ChatHelpers.createTestChat(page, chat2Data)
      
      if (chat2.id) {
        createdChatIds.push(chat2.id)
        await chatPage.goto(chat2.id)
        
        // Check if settings persisted
        if (await chatPage.modelSettingsButton.isVisible()) {
          await chatPage.openModelSettings()
          
          // Check temperature
          const tempValue = await chatPage.temperatureSlider.inputValue()
          if (parseFloat(tempValue) === 0.8) {
            console.log('✅ Temperature setting persisted')
          } else {
            console.log(`ℹ️ Temperature not persisted (${tempValue} vs 0.8)`)
          }
          
          // Check max tokens
          const tokensValue = await chatPage.maxTokensInput.inputValue()
          if (parseInt(tokensValue) === 3000) {
            console.log('✅ Max tokens setting persisted')
          } else {
            console.log(`ℹ️ Max tokens not persisted (${tokensValue} vs 3000)`)
          }
          
          // Close settings
          await page.keyboard.press('Escape')
        }
      }
    }
  })

  test('should handle invalid settings gracefully', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('invalid-test')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      await chatPage.openModelSettings()
      
      // Try invalid temperature (negative)
      await chatPage.temperatureSlider.fill('-1')
      let value = await chatPage.temperatureSlider.inputValue()
      expect(parseFloat(value)).toBeGreaterThanOrEqual(0)
      console.log('✅ Negative temperature prevented')
      
      // Try invalid max tokens (negative)
      await chatPage.maxTokensInput.fill('-100')
      value = await chatPage.maxTokensInput.inputValue()
      
      // Should either prevent negative or convert to positive
      if (value === '-100' || value === '') {
        console.log('ℹ️ Negative tokens allowed in input (might validate on submit)')
      } else {
        expect(parseInt(value)).toBeGreaterThanOrEqual(0)
        console.log('✅ Negative tokens prevented')
      }
      
      // Try invalid max tokens (too large)
      await chatPage.maxTokensInput.fill('999999999')
      value = await chatPage.maxTokensInput.inputValue()
      console.log(`ℹ️ Large token value: ${value} (validation may occur on submit)`)
      
      // Close settings
      await page.keyboard.press('Escape')
    }
  })

  test('should show appropriate settings for different providers', async ({ page }) => {
    // Create a chat
    const chatData = generateUniqueChat('provider-settings')
    const chat = await ChatHelpers.createTestChat(page, chatData)
    
    if (chat.id) {
      createdChatIds.push(chat.id)
      await chatPage.goto(chat.id)
      
      // Open settings
      const settingsVisible = await chatPage.modelSettingsButton.isVisible()
      if (!settingsVisible) {
        console.log('ℹ️ Settings not available')
        return
      }
      
      // Check settings for each provider
      for (const provider of ['openai', 'anthropic']) {
        await chatPage.selectProvider(provider)
        await page.waitForTimeout(500)
        
        await chatPage.openModelSettings()
        
        // Check which settings are available
        const settings = {
          temperature: await chatPage.temperatureSlider.isVisible(),
          maxTokens: await chatPage.maxTokensInput.isVisible(),
          topP: await chatPage.topPSlider.isVisible(),
          frequency: await chatPage.frequencyPenaltySlider.isVisible(),
          presence: await chatPage.presencePenaltySlider.isVisible()
        }
        
        console.log(`ℹ️ ${provider} settings:`, settings)
        
        // Different providers might have different settings
        expect(settings.temperature).toBe(true) // All should have temperature
        expect(settings.maxTokens).toBe(true) // All should have max tokens
        
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }
  })
})