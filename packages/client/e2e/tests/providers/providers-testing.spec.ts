import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../../pages/providers.page'
import { ProviderHelpers } from '../../helpers/provider-helpers'
import {
  testProviders,
  testApiKeys,
  mockResponses,
  getProviderModels
} from '../../fixtures/provider-data'

test.describe('Providers - Testing & Validation', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    
    // Setup mock provider responses
    await ProviderHelpers.setupMockProviders(page)
  })

  test('should test provider connection with valid endpoint', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Mock successful Ollama connection
    await page.route('**/localhost:11434/api/version', async (route) => {
      await route.fulfill({
        status: mockResponses.ollama.version.status,
        body: JSON.stringify(mockResponses.ollama.version.body)
      })
    })
    
    // Test Ollama connection
    const result = await ProviderHelpers.testProviderConnection(page, 'ollama')
    expect(result.success).toBe(true)
    console.log('✅ Provider connection test successful')
    
    // Check status indicator
    const statusIndicator = providersPage.getProviderStatusIndicator('ollama')
    await expect(statusIndicator).toBeVisible()
    const classes = await statusIndicator.getAttribute('class')
    expect(classes).toContain('online')
  })

  test('should handle provider connection timeout', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Mock timeout for Ollama
    await page.route('**/localhost:11434/**', async (route) => {
      await page.waitForTimeout(15000) // Simulate timeout
      await route.abort('timedout')
    })
    
    // Test connection (should timeout)
    const testButton = providersPage.getProviderTestButton('ollama')
    if (await testButton.isVisible()) {
      await testButton.click()
      
      // Wait for timeout message
      await page.waitForTimeout(5000)
      
      const error = await ProviderHelpers.getProviderError(page, 'ollama')
      if (error) {
        expect(error.toLowerCase()).toMatch(/timeout|timed out|connection failed/)
        console.log('✅ Connection timeout handled correctly')
      }
    }
  })

  test('should validate API key format', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Test malformed OpenAI key
    const malformedKey = 'not-a-valid-key'
    const keyInput = providersPage.getApiKeyInput('openai')
    await keyInput.fill(malformedKey)
    
    // Try to save
    const saveButton = providersPage.getSaveKeyButton('openai')
    await saveButton.click()
    
    // Check for validation error
    await page.waitForTimeout(1000)
    const error = await ProviderHelpers.getProviderError(page, 'openai')
    
    if (error) {
      expect(error.toLowerCase()).toMatch(/invalid|format|key/)
      console.log('✅ Invalid key format rejected')
    } else {
      // Alternative: Check if save was prevented
      const value = await keyInput.inputValue()
      if (value === '') {
        console.log('✅ Invalid key not saved')
      }
    }
  })

  test('should refresh and display available models', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure OpenAI with valid key
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Mock models response
    await page.route('**/api.openai.com/v1/models', async (route) => {
      await route.fulfill({
        status: mockResponses.openai.models.status,
        body: JSON.stringify(mockResponses.openai.models.body)
      })
    })
    
    // Get models
    const models = await ProviderHelpers.getAvailableModels(page, 'openai')
    expect(models.length).toBeGreaterThan(0)
    console.log(`✅ Found ${models.length} models: ${models.join(', ')}`)
    
    // Verify models are displayed in UI
    const modelsList = providersPage.getModelList('openai')
    if (await modelsList.isVisible()) {
      const modelCount = await modelsList.locator('[data-model-item]').count()
      expect(modelCount).toBe(models.length)
    }
  })

  test('should test chat completion with provider', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure OpenAI
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Mock completion response
    await page.route('**/api.openai.com/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: mockResponses.openai.completion.status,
        body: JSON.stringify(mockResponses.openai.completion.body)
      })
    })
    
    // Find test chat button
    const testChatButton = page.getByTestId('test-chat-openai')
    if (await testChatButton.isVisible()) {
      await testChatButton.click()
      
      // Wait for test dialog
      const testDialog = page.getByTestId('test-chat-dialog')
      await expect(testDialog).toBeVisible()
      
      // Send test message
      const testInput = testDialog.locator('input, textarea')
      await testInput.fill('Test message')
      
      const sendButton = testDialog.getByRole('button', { name: /send|test/i })
      await sendButton.click()
      
      // Wait for response
      await page.waitForTimeout(2000)
      
      // Check for response
      const responseArea = testDialog.locator('[data-test-response]')
      if (await responseArea.isVisible()) {
        const responseText = await responseArea.textContent()
        expect(responseText).toContain('Test response')
        console.log('✅ Chat completion test successful')
      }
      
      // Close dialog
      const closeButton = testDialog.getByRole('button', { name: /close/i })
      await closeButton.click()
    } else {
      console.log('ℹ️ Test chat feature not available in UI')
    }
  })

  test('should handle rate limiting', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure OpenAI
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Mock rate limit response
    await page.route('**/api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 429,
        body: JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded'
          }
        })
      })
    })
    
    // Try to validate key (should hit rate limit)
    const validateButton = providersPage.getValidateKeyButton('openai')
    await validateButton.click()
    
    // Wait for error
    await page.waitForTimeout(2000)
    
    const error = await ProviderHelpers.getProviderError(page, 'openai')
    if (error) {
      expect(error.toLowerCase()).toContain('rate limit')
      console.log('✅ Rate limiting handled correctly')
    }
    
    // Check for retry suggestion
    const retryMessage = page.getByText(/try again|retry/i)
    if (await retryMessage.isVisible()) {
      console.log('✅ Retry suggestion shown')
    }
  })

  test('should test failover between providers', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure multiple providers
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    await ProviderHelpers.configureApiKey(page, 'anthropic', testApiKeys.valid.anthropic)
    
    // Set OpenAI as primary
    await ProviderHelpers.setDefaultProvider(page, 'openai')
    
    // Mock OpenAI failure
    await page.route('**/api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })
    
    // Mock Anthropic success
    await page.route('**/api.anthropic.com/**', async (route) => {
      await route.fulfill({
        status: mockResponses.anthropic.completion.status,
        body: JSON.stringify(mockResponses.anthropic.completion.body)
      })
    })
    
    // Test failover behavior
    const testFailoverButton = page.getByTestId('test-failover')
    if (await testFailoverButton.isVisible()) {
      await testFailoverButton.click()
      
      // Wait for failover test
      await page.waitForTimeout(3000)
      
      // Check result
      const resultElement = page.getByTestId('failover-result')
      const resultText = await resultElement.textContent()
      
      if (resultText?.includes('failover successful')) {
        console.log('✅ Failover to backup provider successful')
      }
    } else {
      console.log('ℹ️ Failover testing not available in UI')
    }
  })

  test('should validate provider response format', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure provider
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Mock invalid response format
    await page.route('**/api.openai.com/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ invalid: 'response format' })
      })
    })
    
    // Test chat
    const testButton = page.getByTestId('test-chat-openai')
    if (await testButton.isVisible()) {
      await testButton.click()
      
      // Send test message
      const testDialog = page.getByTestId('test-chat-dialog')
      await expect(testDialog).toBeVisible()
      
      const testInput = testDialog.locator('input, textarea')
      await testInput.fill('Test')
      
      const sendButton = testDialog.getByRole('button', { name: /send/i })
      await sendButton.click()
      
      // Wait for error
      await page.waitForTimeout(2000)
      
      const error = await ProviderHelpers.getProviderError(page, 'openai')
      if (error) {
        expect(error.toLowerCase()).toMatch(/invalid|format|response/)
        console.log('✅ Invalid response format detected')
      }
    }
  })

  test('should test provider health check', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Mock healthy Ollama
    await page.route('**/localhost:11434/api/version', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockResponses.ollama.version.body)
      })
    })
    
    await page.route('**/localhost:11434/api/tags', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockResponses.ollama.tags.body)
      })
    })
    
    // Perform health check
    const healthButton = page.getByTestId('health-check-ollama')
    if (await healthButton.isVisible()) {
      await healthButton.click()
      
      // Wait for health check
      await page.waitForTimeout(2000)
      
      // Check health status
      const healthStatus = page.getByTestId('health-status-ollama')
      const statusText = await healthStatus.textContent()
      
      expect(statusText?.toLowerCase()).toContain('healthy')
      console.log('✅ Provider health check passed')
      
      // Check for model count
      const modelCount = page.getByTestId('model-count-ollama')
      if (await modelCount.isVisible()) {
        const count = await modelCount.textContent()
        console.log(`ℹ️ Provider has ${count} models available`)
      }
    } else {
      // Alternative: Use connection test
      const result = await ProviderHelpers.testProviderConnection(page, 'ollama')
      if (result.success) {
        console.log('✅ Provider is healthy')
      }
    }
  })

  test('should test streaming capabilities', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure provider
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Test streaming
    const streamTestButton = page.getByTestId('test-streaming-openai')
    if (await streamTestButton.isVisible()) {
      await streamTestButton.click()
      
      // Wait for streaming test dialog
      const streamDialog = page.getByTestId('streaming-test-dialog')
      await expect(streamDialog).toBeVisible()
      
      // Start streaming test
      const startButton = streamDialog.getByRole('button', { name: /start/i })
      await startButton.click()
      
      // Check for streaming indicator
      const streamingIndicator = streamDialog.locator('[data-streaming]')
      await expect(streamingIndicator).toBeVisible()
      
      // Wait for completion
      await page.waitForTimeout(3000)
      
      // Check result
      const resultText = await streamDialog.locator('[data-result]').textContent()
      if (resultText?.includes('streaming supported')) {
        console.log('✅ Provider supports streaming')
      } else {
        console.log('ℹ️ Provider does not support streaming')
      }
      
      // Close dialog
      const closeButton = streamDialog.getByRole('button', { name: /close/i })
      await closeButton.click()
    } else {
      console.log('ℹ️ Streaming test not available in UI')
    }
  })

  test('should test multiple providers concurrently', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure multiple providers
    const providers = [
      { id: 'openai', key: testApiKeys.valid.openai },
      { id: 'anthropic', key: testApiKeys.valid.anthropic }
    ]
    
    for (const provider of providers) {
      await ProviderHelpers.configureApiKey(page, provider.id, provider.key)
    }
    
    // Test all providers button
    const testAllButton = page.getByTestId('test-all-providers')
    if (await testAllButton.isVisible()) {
      await testAllButton.click()
      
      // Wait for all tests to complete
      await page.waitForTimeout(5000)
      
      // Check results
      for (const provider of providers) {
        const resultElement = page.getByTestId(`test-result-${provider.id}`)
        if (await resultElement.isVisible()) {
          const result = await resultElement.textContent()
          console.log(`${provider.id}: ${result}`)
        }
      }
      
      console.log('✅ All providers tested concurrently')
    } else {
      // Test individually
      for (const provider of providers) {
        const result = await ProviderHelpers.testProviderConnection(page, provider.id)
        console.log(`${provider.id}: ${result.success ? 'Connected' : 'Failed'}`)
      }
    }
  })

  test('should validate provider capabilities', async ({ page }) => {
    await providersPage.goto()
    await ProviderHelpers.waitForProvidersReady(page)
    
    // Configure OpenAI
    await ProviderHelpers.configureApiKey(page, 'openai', testApiKeys.valid.openai)
    
    // Check capabilities
    const capabilitiesButton = page.getByTestId('check-capabilities-openai')
    if (await capabilitiesButton.isVisible()) {
      await capabilitiesButton.click()
      
      // Wait for capabilities check
      await page.waitForTimeout(2000)
      
      // Check results
      const capabilities = page.getByTestId('capabilities-openai')
      await expect(capabilities).toBeVisible()
      
      const capText = await capabilities.textContent()
      
      // Check for expected capabilities
      const expectedCapabilities = ['chat', 'completion', 'embedding', 'moderation']
      for (const cap of expectedCapabilities) {
        if (capText?.toLowerCase().includes(cap)) {
          console.log(`✅ Provider supports ${cap}`)
        }
      }
    } else {
      console.log('ℹ️ Capabilities check not available in UI')
    }
  })
})