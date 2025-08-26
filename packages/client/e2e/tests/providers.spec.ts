import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProvidersPage, type ProviderConfig } from '../pages/providers.page'
import { ChatPage } from '../pages/chat.page'
import { TestDataFactory } from '../fixtures/test-data'
import { TestAssertions, TestDataManager } from '../utils/test-helpers'

test.describe('Provider Configuration', () => {
  let appPage: AppPage
  let providersPage: ProvidersPage
  let chatPage: ChatPage
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    providersPage = new ProvidersPage(page)
    chatPage = new ChatPage(page)
    dataManager = new TestDataManager(page)

    // Navigate to providers page and wait for app to be ready
    await providersPage.goto()
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
  })

  test.describe('Provider Management', () => {
    test('should display providers management interface', async ({ page }) => {
      // Verify main elements are visible
      await expect(page.getByRole('button', { name: 'Add Provider' })).toBeVisible()
      await expect(page.getByTestId('providers-list')).toBeVisible()

      // Verify page title
      await expect(page.getByRole('heading', { name: 'AI Providers' })).toBeVisible()
    })

    test('should add LM Studio provider successfully', async ({ page }) => {
      const lmStudioConfig: ProviderConfig = {
        name: 'Test LM Studio',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(lmStudioConfig)

      // Verify provider appears in list
      await providersPage.verifyProviderInList(lmStudioConfig.name)

      // Verify provider card shows correct information
      const providerCard = page.getByTestId(`provider-${lmStudioConfig.name}`)
      await expect(providerCard.getByTestId('provider-type')).toContainText('lmstudio')
      await expect(providerCard.getByTestId('provider-endpoint')).toContainText('localhost:1234')
    })

    test('should add OpenAI provider successfully', async ({ page }) => {
      const openAIConfig: ProviderConfig = {
        name: 'Test OpenAI',
        type: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'sk-test-key-not-real'
      }

      await providersPage.addProvider(openAIConfig)

      // Verify provider appears in list
      await providersPage.verifyProviderInList(openAIConfig.name)

      // Verify API key is masked in display
      const providerCard = page.getByTestId(`provider-${openAIConfig.name}`)
      await expect(providerCard.getByTestId('api-key-display')).toContainText('sk-***')
    })

    test('should edit existing provider', async ({ page }) => {
      // Add a provider first
      const originalConfig: ProviderConfig = {
        name: 'Original Provider',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(originalConfig)

      // Edit the provider
      const updatedConfig: Partial<ProviderConfig> = {
        name: 'Updated Provider',
        endpoint: 'http://localhost:5678/v1'
      }

      await providersPage.editProvider(originalConfig.name, updatedConfig)

      // Verify changes were applied
      await providersPage.verifyProviderInList(updatedConfig.name!)
      const providerCard = page.getByTestId(`provider-${updatedConfig.name}`)
      await expect(providerCard.getByTestId('provider-endpoint')).toContainText('localhost:5678')
    })

    test('should delete provider with confirmation', async ({ page }) => {
      // Add a provider first
      const providerConfig: ProviderConfig = {
        name: 'Provider to Delete',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(providerConfig)
      await providersPage.verifyProviderInList(providerConfig.name)

      // Delete the provider
      await providersPage.deleteProvider(providerConfig.name)

      // Verify provider is removed
      await expect(page.getByTestId(`provider-${providerConfig.name}`)).toBeHidden()
    })

    test('should validate required fields when adding provider', async ({ page }) => {
      await providersPage.verifyValidation()
    })
  })

  test.describe('Provider Connection Testing', () => {
    test('should test LM Studio connection when service is available', async ({ page }) => {
      // Check if LM Studio is running
      const lmStudioAvailable = await page.evaluate(() => {
        return fetch('http://localhost:1234/v1/models')
          .then(() => true)
          .catch(() => false)
      })

      if (!lmStudioAvailable) {
        test.skip('LM Studio not available for connection test')
        return
      }

      const config: ProviderConfig = {
        name: 'LM Studio Connection Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)

      // Test connection
      const connected = await providersPage.testConnection()
      expect(connected).toBe(true)

      // Verify connection status indicator
      const status = await providersPage.getProviderStatus(config.name)
      expect(status.toLowerCase()).toContain('connected')
    })

    test('should handle connection failure gracefully', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Failed Connection Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:9999/v1' // Non-existent endpoint
      }

      // Mock network failure
      await page.route('**/v1/**', (route) => route.abort('failed'))

      await providersPage.addProvider(config)

      // Connection should fail
      const connected = await providersPage.testConnection()
      expect(connected).toBe(false)

      // Verify error status
      const status = await providersPage.getProviderStatus(config.name)
      expect(status.toLowerCase()).toContain('failed')
    })

    test('should test connection for multiple providers', async ({ page }) => {
      // Add multiple providers
      const providers: ProviderConfig[] = [
        {
          name: 'LM Studio Test',
          type: 'lmstudio',
          endpoint: 'http://localhost:1234/v1'
        },
        {
          name: 'Mock OpenAI Test',
          type: 'openai',
          endpoint: 'http://localhost:8080/v1',
          apiKey: 'test-key'
        }
      ]

      for (const provider of providers) {
        await providersPage.addProvider(provider)
      }

      // Test all providers
      const results = await providersPage.testAllProviders()

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('LM Studio Test')
      expect(results[1].name).toBe('Mock OpenAI Test')
    })
  })

  test.describe('Model Selection and Configuration', () => {
    test('should select model for provider', async ({ page }) => {
      // Skip if LM Studio not available
      const lmStudioAvailable = await page.evaluate(() => {
        return fetch('http://localhost:1234/v1/models')
          .then(() => true)
          .catch(() => false)
      })

      if (!lmStudioAvailable) {
        test.skip('LM Studio not available for model selection test')
        return
      }

      await providersPage.setupLMStudioProvider()

      // Verify model selection worked
      await expect(page.getByRole('combobox', { name: 'Model' })).toContainText('GPT-OSS-20B')
    })

    test('should configure advanced settings', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Advanced Settings Test',
        type: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        settings: {
          temperature: 0.7,
          maxTokens: 2048
        }
      }

      await providersPage.addProvider(config)

      // Verify advanced settings were applied
      const providerCard = page.getByTestId(`provider-${config.name}`)
      await expect(providerCard.getByTestId('temperature-value')).toContainText('0.7')
      await expect(providerCard.getByTestId('max-tokens-value')).toContainText('2048')
    })

    test('should refresh models list', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Model Refresh Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)

      // Mock models response
      await page.route('**/v1/models', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [{ id: 'test-model-1' }, { id: 'test-model-2' }]
          })
        })
      )

      await providersPage.selectModel('test-model-1')

      // Verify model was selected
      await expect(page.getByRole('combobox', { name: 'Model' })).toHaveValue('test-model-1')
    })
  })

  test.describe('Provider Integration with Chat', () => {
    test('should use configured provider in chat', async ({ page }) => {
      // Add provider
      const config: ProviderConfig = {
        name: 'Chat Integration Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)

      // Navigate to chat
      await chatPage.goto()
      await chatPage.createNewChat()

      // Select the configured provider
      await chatPage.selectProvider(config.name)

      // Verify provider is available in chat
      await expect(page.getByRole('combobox', { name: 'Provider' })).toContainText(config.name)
    })

    test('should set default provider for new chats', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Default Provider Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)
      await providersPage.setDefaultProvider(config.name)

      // Navigate to chat and create new chat
      await chatPage.goto()
      await chatPage.createNewChat()

      // Verify default provider is pre-selected
      await expect(page.getByRole('combobox', { name: 'Provider' })).toContainText(config.name)
    })

    test('should handle provider switching in active chat', async ({ page }) => {
      // Add multiple providers
      const provider1: ProviderConfig = {
        name: 'Provider 1',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      const provider2: ProviderConfig = {
        name: 'Provider 2',
        type: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'test-key'
      }

      await providersPage.addProvider(provider1)
      await providersPage.addProvider(provider2)

      // Start chat with first provider
      await chatPage.goto()
      await chatPage.createNewChat()
      await chatPage.selectProvider(provider1.name)
      await chatPage.sendMessage('Test message with provider 1')

      // Switch to second provider
      await chatPage.selectProvider(provider2.name)

      // Verify provider switch worked
      await expect(page.getByRole('combobox', { name: 'Provider' })).toContainText(provider2.name)

      // Verify chat history is preserved
      await expect(page.getByText('Test message with provider 1')).toBeVisible()
    })
  })

  test.describe('Provider Health and Monitoring', () => {
    test('should check provider health status', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Health Check Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)

      // Perform health check
      const healthResult = await providersPage.checkProviderHealth(config.name)

      // Verify health check result structure
      expect(healthResult).toHaveProperty('available')
      expect(typeof healthResult.available).toBe('boolean')

      if (healthResult.available) {
        expect(healthResult).toHaveProperty('responseTime')
        expect(typeof healthResult.responseTime).toBe('number')
      } else {
        expect(healthResult).toHaveProperty('error')
        expect(typeof healthResult.error).toBe('string')
      }
    })

    test('should display provider statistics', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Statistics Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)

      // View provider statistics
      const providerCard = page.getByTestId(`provider-${config.name}`)
      const statsButton = providerCard.getByRole('button', { name: 'View Stats' })

      if (await statsButton.isVisible()) {
        await statsButton.click()

        // Verify statistics are displayed
        await expect(page.getByTestId('provider-stats')).toBeVisible()
        await expect(page.getByText(/requests/i)).toBeVisible()
        await expect(page.getByText(/response time/i)).toBeVisible()
      }
    })

    test('should test provider rate limiting', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Rate Limit Test',
        type: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'test-key'
      }

      await providersPage.addProvider(config)
      await providersPage.testRateLimiting(config.name)

      // Verify rate limit information is displayed
      const providerCard = page.getByTestId(`provider-${config.name}`)
      await expect(providerCard.getByTestId('rate-limit-info')).toBeVisible()
    })
  })

  test.describe('Configuration Import/Export', () => {
    test('should export provider configuration', async ({ page }) => {
      // Add a provider first
      const config: ProviderConfig = {
        name: 'Export Test Provider',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      await providersPage.addProvider(config)
      await providersPage.exportProviderConfig()

      // Export functionality is verified in the page object method
    })

    test('should import provider configuration', async ({ page, context }) => {
      // Create a test configuration file
      const testConfig = {
        providers: [
          {
            name: 'Imported Provider',
            type: 'lmstudio',
            endpoint: 'http://localhost:1234/v1'
          }
        ]
      }

      // Write config to a temporary file
      const fs = require('fs')
      const path = require('path')
      const tempDir = await context.storageState({ path: 'temp-storage' })
      const configPath = path.join('/tmp', 'test-providers.json')

      fs.writeFileSync(configPath, JSON.stringify(testConfig))

      await providersPage.importProviderConfig(configPath)

      // Verify imported provider appears
      await providersPage.verifyProviderInList('Imported Provider')

      // Cleanup
      fs.unlinkSync(configPath)
    })
  })

  test.describe('Error Handling', () => {
    test('should handle invalid endpoint gracefully', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Invalid Endpoint Test',
        type: 'lmstudio',
        endpoint: 'invalid-url-format'
      }

      // Try to add provider with invalid endpoint
      await page.getByRole('button', { name: 'Add Provider' }).click()
      await page.getByLabel('Provider Name').fill(config.name)
      await page.getByLabel('Provider Type').selectOption(config.type)
      await page.getByLabel('Endpoint URL').fill(config.endpoint!)

      // Test connection should fail with validation error
      await page.getByRole('button', { name: 'Test Connection' }).click()

      // Verify error message
      await expect(page.getByText(/invalid endpoint format/i)).toBeVisible()
    })

    test('should handle API key validation for OpenAI', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'API Key Validation Test',
        type: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'invalid-key-format'
      }

      // Mock invalid API key response
      await page.route('**/v1/**', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      )

      // Try to add provider
      await page.getByRole('button', { name: 'Add Provider' }).click()
      await page.getByLabel('Provider Name').fill(config.name)
      await page.getByLabel('Provider Type').selectOption(config.type)
      await page.getByLabel('Endpoint URL').fill(config.endpoint!)
      await page.getByLabel('API Key').fill(config.apiKey!)

      await page.getByRole('button', { name: 'Test Connection' }).click()

      // Verify authentication error
      await expect(page.getByText(/invalid api key/i)).toBeVisible()
    })

    test('should handle network timeouts during connection test', async ({ page }) => {
      const config: ProviderConfig = {
        name: 'Timeout Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      }

      // Mock timeout
      await page.route('**/v1/**', (route) => {
        setTimeout(() => route.abort('timedout'), 10000)
      })

      // Try to add provider
      await page.getByRole('button', { name: 'Add Provider' }).click()
      await page.getByLabel('Provider Name').fill(config.name)
      await page.getByLabel('Provider Type').selectOption(config.type)
      await page.getByLabel('Endpoint URL').fill(config.endpoint!)

      await page.getByRole('button', { name: 'Test Connection' }).click()

      // Wait for timeout message
      await expect(page.getByText(/connection timeout/i)).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Performance', () => {
    test('should load providers page within acceptable time', async ({ page }) => {
      const startTime = Date.now()

      await providersPage.goto()
      await appPage.waitForAppReady()

      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // 3 second limit
    })

    test('should handle multiple providers efficiently', async ({ page }) => {
      // Add multiple providers
      const providers: ProviderConfig[] = []
      for (let i = 1; i <= 10; i++) {
        providers.push({
          name: `Performance Test Provider ${i}`,
          type: 'lmstudio',
          endpoint: `http://localhost:${1234 + i}/v1`
        })
      }

      const startTime = Date.now()

      for (const provider of providers) {
        await providersPage.addProvider(provider)
      }

      const totalTime = Date.now() - startTime
      const averageTime = totalTime / providers.length

      // Verify reasonable performance (less than 2 seconds per provider on average)
      expect(averageTime).toBeLessThan(2000)

      // Verify all providers appear in list
      const providersList = await providersPage.getProvidersList()
      expect(providersList).toHaveLength(10)
    })
  })

  test.describe('Accessibility', () => {
    test('should support keyboard navigation in provider configuration', async ({ page }) => {
      // Navigate using keyboard
      await page.keyboard.press('Tab') // Focus on Add Provider button
      await page.keyboard.press('Enter') // Open dialog

      // Verify dialog opened
      await expect(page.getByTestId('provider-dialog')).toBeVisible()

      // Navigate through form fields
      await page.keyboard.press('Tab') // Provider name
      await page.keyboard.type('Keyboard Nav Test')

      await page.keyboard.press('Tab') // Provider type
      await page.keyboard.press('Enter') // Open dropdown
      await page.keyboard.press('ArrowDown') // Select option
      await page.keyboard.press('Enter') // Confirm selection

      await page.keyboard.press('Tab') // Endpoint
      await page.keyboard.type('http://localhost:1234/v1')

      await page.keyboard.press('Tab') // Test Connection button
      await page.keyboard.press('Enter') // Test connection

      // Verify keyboard navigation worked
      await expect(page.getByLabel('Provider Name')).toHaveValue('Keyboard Nav Test')
    })

    test('should have proper ARIA labels for provider elements', async ({ page }) => {
      await providersPage.addProvider({
        name: 'ARIA Test',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234/v1'
      })

      // Verify ARIA labels
      await expect(page.getByLabel('Provider Name')).toHaveAttribute('aria-label')
      await expect(page.getByLabel('Provider Type')).toHaveAttribute('aria-label')
      await expect(page.getByLabel('Endpoint URL')).toHaveAttribute('aria-label')
      await expect(page.getByRole('button', { name: 'Test Connection' })).toHaveAttribute('aria-describedby')
    })
  })
})
