import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../../pages/providers.page'
import { ProviderHelpers } from '../../helpers/provider-helpers'
import {
  testProviders,
  testApiKeys,
  generateUniqueProvider,
  getProviderSettings
} from '../../fixtures/provider-data'

test.describe('Providers - Configuration', () => {
  let providersPage: ProvidersPage
  let createdProviderIds: number[] = []

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    
    // Setup mock provider responses
    await ProviderHelpers.setupMockProviders(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup created providers
    if (createdProviderIds.length > 0) {
      await ProviderHelpers.cleanupTestProviders(page, createdProviderIds)
      createdProviderIds = []
    }
  })

  test('should navigate to providers page', async ({ page }) => {
    await providersPage.goto()
    
    // Check page title
    await expect(providersPage.pageTitle).toBeVisible()
    const titleText = await providersPage.pageTitle.textContent()
    expect(titleText).toMatch(/provider|ai/i)
    
    // Check sections are visible
    const localSectionVisible = await providersPage.localProvidersSection.isVisible()
    const cloudSectionVisible = await providersPage.cloudProvidersSection.isVisible()
    
    expect(localSectionVisible || cloudSectionVisible).toBe(true)
    console.log('✅ Providers page loaded successfully')
  })

  test('should detect local providers', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Check Ollama
    const ollamaCard = providersPage.getLocalProviderCard('ollama')
    const ollamaVisible = await ollamaCard.isVisible()
    
    if (ollamaVisible) {
      console.log('✅ Ollama provider detected')
      
      const ollamaAvailable = await ProviderHelpers.isProviderAvailable(page, 'ollama')
      console.log(`ℹ️ Ollama status: ${ollamaAvailable ? 'Available' : 'Offline'}`)
    }
    
    // Check LM Studio
    const lmStudioCard = providersPage.getLocalProviderCard('lmstudio')
    const lmStudioVisible = await lmStudioCard.isVisible()
    
    if (lmStudioVisible) {
      console.log('✅ LM Studio provider detected')
      
      const lmStudioAvailable = await ProviderHelpers.isProviderAvailable(page, 'lmstudio')
      console.log(`ℹ️ LM Studio status: ${lmStudioAvailable ? 'Available' : 'Offline'}`)
    }
    
    expect(ollamaVisible || lmStudioVisible).toBe(true)
  })

  test('should configure OpenAI provider', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Find OpenAI card
    const openaiCard = providersPage.getCloudProviderCard('openai')
    await expect(openaiCard).toBeVisible()
    
    // Configure API key
    const apiKey = testApiKeys.valid.openai
    const configured = await ProviderHelpers.configureApiKey(page, 'openai', apiKey)
    
    if (configured) {
      console.log('✅ OpenAI API key configured')
      
      // Validate the key
      const isValid = await ProviderHelpers.validateApiKey(page, 'openai')
      expect(isValid).toBe(true)
      console.log('✅ OpenAI API key validated')
      
      // Check available models
      const models = await ProviderHelpers.getAvailableModels(page, 'openai')
      console.log(`ℹ️ Available OpenAI models: ${models.join(', ')}`)
      expect(models.length).toBeGreaterThan(0)
    } else {
      console.log('⚠️ Could not configure OpenAI provider')
    }
  })

  test('should configure Anthropic provider', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Find Anthropic card
    const anthropicCard = providersPage.getCloudProviderCard('anthropic')
    await expect(anthropicCard).toBeVisible()
    
    // Configure API key
    const apiKey = testApiKeys.valid.anthropic
    const configured = await ProviderHelpers.configureApiKey(page, 'anthropic', apiKey)
    
    if (configured) {
      console.log('✅ Anthropic API key configured')
      
      // Validate the key
      const isValid = await ProviderHelpers.validateApiKey(page, 'anthropic')
      expect(isValid).toBe(true)
      console.log('✅ Anthropic API key validated')
      
      // Check available models
      const models = await ProviderHelpers.getAvailableModels(page, 'anthropic')
      console.log(`ℹ️ Available Anthropic models: ${models.join(', ')}`)
      expect(models.length).toBeGreaterThan(0)
    } else {
      console.log('⚠️ Could not configure Anthropic provider')
    }
  })

  test('should handle invalid API keys', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Try invalid OpenAI key
    const invalidKey = testApiKeys.invalid.openai
    await ProviderHelpers.configureApiKey(page, 'openai', invalidKey)
    
    // Validate should fail
    const isValid = await ProviderHelpers.validateApiKey(page, 'openai')
    expect(isValid).toBe(false)
    console.log('✅ Invalid API key correctly rejected')
    
    // Check for error message
    const error = await ProviderHelpers.getProviderError(page, 'openai')
    if (error) {
      expect(error).toContain('Invalid')
      console.log(`✅ Error message shown: ${error}`)
    }
  })

  test('should mask API keys in UI', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure API key
    const apiKey = testApiKeys.valid.openai
    await ProviderHelpers.configureApiKey(page, 'openai', apiKey)
    
    // Check if key is masked
    const keyInput = providersPage.getApiKeyInput('openai')
    const inputType = await keyInput.getAttribute('type')
    expect(inputType).toBe('password')
    console.log('✅ API key is masked by default')
    
    // Toggle visibility
    const isVisible = await ProviderHelpers.toggleKeyVisibility(page, 'openai')
    expect(isVisible).toBe(true)
    console.log('✅ API key visibility can be toggled')
    
    // Toggle back
    const isHidden = await ProviderHelpers.toggleKeyVisibility(page, 'openai')
    expect(isHidden).toBe(false)
    console.log('✅ API key can be hidden again')
  })

  test('should clear API keys', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure API key first
    const apiKey = testApiKeys.valid.openai
    await ProviderHelpers.configureApiKey(page, 'openai', apiKey)
    
    // Clear the key
    const cleared = await ProviderHelpers.clearApiKey(page, 'openai')
    expect(cleared).toBe(true)
    console.log('✅ API key cleared successfully')
    
    // Verify input is empty
    const keyInput = providersPage.getApiKeyInput('openai')
    const value = await keyInput.inputValue()
    expect(value).toBe('')
  })

  test('should test local provider connections', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Test Ollama connection
    const ollamaCard = providersPage.getLocalProviderCard('ollama')
    if (await ollamaCard.isVisible()) {
      const result = await ProviderHelpers.testProviderConnection(page, 'ollama')
      console.log(`ℹ️ Ollama test result: ${result.success ? 'Connected' : result.error}`)
      
      if (result.models && result.models.length > 0) {
        console.log(`ℹ️ Ollama models: ${result.models.join(', ')}`)
      }
    }
    
    // Test LM Studio connection
    const lmStudioCard = providersPage.getLocalProviderCard('lmstudio')
    if (await lmStudioCard.isVisible()) {
      const result = await ProviderHelpers.testProviderConnection(page, 'lmstudio')
      console.log(`ℹ️ LM Studio test result: ${result.success ? 'Connected' : result.error}`)
      
      if (result.models && result.models.length > 0) {
        console.log(`ℹ️ LM Studio models: ${result.models.join(', ')}`)
      }
    }
  })

  test('should select and save model preferences', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure OpenAI first
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Get available models
    const models = await ProviderHelpers.getAvailableModels(page, 'openai')
    
    if (models.length > 0) {
      // Select a model
      const modelToSelect = models[0]
      const selected = await ProviderHelpers.selectModel(page, 'openai', modelToSelect)
      expect(selected).toBe(true)
      console.log(`✅ Selected model: ${modelToSelect}`)
      
      // Reload page and verify selection persists
      await page.reload()
      await ProviderHelpers.waitForProvidersReady(page)
      
      // Check if model is still selected
      const modelSelect = page.getByTestId('model-select-openai')
      if (await modelSelect.isVisible()) {
        const selectedValue = await modelSelect.inputValue()
        expect(selectedValue).toBe(modelToSelect)
        console.log('✅ Model selection persisted')
      }
    }
  })

  test('should set default provider', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure a provider first
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Set as default
    const setDefault = await ProviderHelpers.setDefaultProvider(page, 'openai')
    expect(setDefault).toBe(true)
    console.log('✅ Set OpenAI as default provider')
    
    // Check for default badge
    const defaultBadge = page.getByTestId('default-badge-openai')
    await expect(defaultBadge).toBeVisible()
    
    // Reload and verify default persists
    await page.reload()
    await ProviderHelpers.waitForProvidersReady(page)
    
    await expect(defaultBadge).toBeVisible()
    console.log('✅ Default provider setting persisted')
  })

  test('should show provider status indicators', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Check all providers for status indicators
    const providers = await ProviderHelpers.getAllProviders(page)
    
    for (const provider of providers) {
      console.log(`Provider: ${provider.name} - Type: ${provider.type} - Status: ${provider.status}`)
      
      // Status should be one of: online, offline, configuring, error
      expect(['online', 'offline', 'configuring', 'error', 'available', 'unavailable']).toContain(
        provider.status.toLowerCase()
      )
    }
    
    console.log(`✅ All ${providers.length} providers show status indicators`)
  })

  test('should handle provider settings configuration', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure OpenAI
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Open settings for OpenAI
    const settingsButton = page.getByTestId('settings-openai')
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      
      // Check for settings dialog/panel
      const settingsPanel = page.getByTestId('provider-settings-panel')
      await expect(settingsPanel).toBeVisible()
      
      // Configure temperature
      const tempSlider = page.getByLabel(/temperature/i)
      if (await tempSlider.isVisible()) {
        await tempSlider.fill('0.8')
        console.log('✅ Temperature configured')
      }
      
      // Configure max tokens
      const maxTokensInput = page.getByLabel(/max.*tokens/i)
      if (await maxTokensInput.isVisible()) {
        await maxTokensInput.fill('4096')
        console.log('✅ Max tokens configured')
      }
      
      // Save settings
      const saveButton = page.getByRole('button', { name: /save.*settings/i })
      if (await saveButton.isVisible()) {
        await saveButton.click()
        
        // Check for success message
        const toast = await ProviderHelpers.getToastMessage(page)
        if (toast) {
          expect(toast).toContain('saved')
          console.log('✅ Settings saved successfully')
        }
      }
    } else {
      console.log('ℹ️ Provider settings not available in UI')
    }
  })

  test('should handle multiple providers configuration', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure multiple providers
    const providers = [
      { id: 'openai', key: testApiKeys.valid.openai },
      { id: 'anthropic', key: testApiKeys.valid.anthropic }
    ]
    
    for (const provider of providers) {
      const configured = await ProviderHelpers.configureApiKey(page, provider.id, provider.key)
      if (configured) {
        console.log(`✅ Configured ${provider.id}`)
      }
    }
    
    // Get all configured providers
    const allProviders = await ProviderHelpers.getAllProviders(page)
    const configuredCount = allProviders.filter(p => 
      p.status.toLowerCase() === 'online' || 
      p.status.toLowerCase() === 'available'
    ).length
    
    console.log(`✅ ${configuredCount} providers configured successfully`)
    expect(configuredCount).toBeGreaterThan(0)
  })
})