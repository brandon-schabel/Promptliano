import { Page } from '@playwright/test'

export interface ProviderData {
  id?: number
  name: string
  type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'custom'
  apiKey?: string
  endpoint?: string
  model?: string
  settings?: Record<string, any>
}

export interface ProviderTestResult {
  success: boolean
  message?: string
  models?: string[]
  error?: string
}

export class ProviderHelpers {
  /**
   * Setup mock provider responses for testing
   */
  static async setupMockProviders(page: Page) {
    // Mock local provider endpoints
    await page.route('**/localhost:11434/**', async (route) => {
      // Ollama mock
      const url = route.request().url()
      if (url.includes('/api/version')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ version: '0.1.0' })
        })
      } else if (url.includes('/api/tags')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            models: [
              { name: 'llama2', size: 3825819519 },
              { name: 'mistral', size: 4109865155 }
            ]
          })
        })
      } else {
        await route.fulfill({ status: 200, body: '{}' })
      }
    })

    await page.route('**/localhost:1234/**', async (route) => {
      // LM Studio mock
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'lmstudio',
          object: 'model',
          data: [
            { id: 'local-model-1', object: 'model' },
            { id: 'local-model-2', object: 'model' }
          ]
        })
      })
    })

    // Mock cloud provider endpoints
    await page.route('**/api.openai.com/**', async (route) => {
      const authHeader = route.request().headers()['authorization']
      if (authHeader?.includes('sk-test')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model' }
            ]
          })
        })
      } else {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      }
    })

    await page.route('**/api.anthropic.com/**', async (route) => {
      const authHeader = route.request().headers()['x-api-key']
      if (authHeader?.includes('sk-ant-test')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            models: ['claude-3-opus', 'claude-3-sonnet']
          })
        })
      } else {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      }
    })
  }

  /**
   * Create a test provider via API if available
   */
  static async createTestProvider(page: Page, providerData: ProviderData): Promise<ProviderData> {
    try {
      const response = await page.request.post('/api/providers', {
        data: providerData
      })

      if (response.ok()) {
        const created = await response.json()
        console.log(`✅ Created provider via API: ${created.name}`)
        return created
      }
    } catch (error) {
      console.log('ℹ️ API creation failed, will use UI fallback')
    }

    // Return the data as-is if API fails
    return providerData
  }

  /**
   * Delete test provider via API
   */
  static async deleteTestProvider(page: Page, providerId: number): Promise<boolean> {
    try {
      const response = await page.request.delete(`/api/providers/${providerId}`)
      if (response.ok()) {
        console.log(`✅ Deleted provider ${providerId} via API`)
        return true
      }
    } catch (error) {
      console.log(`⚠️ Failed to delete provider ${providerId}`)
    }
    return false
  }

  /**
   * Clean up multiple test providers
   */
  static async cleanupTestProviders(page: Page, providerIds: number[]) {
    for (const id of providerIds) {
      await this.deleteTestProvider(page, id)
    }
  }

  /**
   * Test provider connection
   */
  static async testProviderConnection(
    page: Page,
    providerId: string
  ): Promise<ProviderTestResult> {
    try {
      // Click test button
      await page.getByTestId(`test-provider-${providerId}`).click()
      
      // Wait for result
      await page.waitForSelector(`[data-testid="test-result-${providerId}"]`, {
        timeout: 10000
      })
      
      const resultElement = page.getByTestId(`test-result-${providerId}`)
      const resultText = await resultElement.textContent()
      
      if (resultText?.includes('success') || resultText?.includes('connected')) {
        // Try to get models if available
        const modelsElement = page.getByTestId(`models-${providerId}`)
        let models: string[] = []
        
        if (await modelsElement.isVisible()) {
          const modelsText = await modelsElement.textContent()
          models = modelsText?.split(',').map(m => m.trim()) || []
        }
        
        return {
          success: true,
          message: 'Connection successful',
          models
        }
      } else {
        return {
          success: false,
          error: resultText || 'Connection failed'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Test failed: ${error}`
      }
    }
  }

  /**
   * Configure provider API key
   */
  static async configureApiKey(
    page: Page,
    providerId: string,
    apiKey: string
  ): Promise<boolean> {
    try {
      const keyInput = page.getByTestId(`api-key-input-${providerId}`)
      await keyInput.clear()
      await keyInput.fill(apiKey)
      
      // Save the key
      const saveButton = page.getByTestId(`save-key-${providerId}`)
      await saveButton.click()
      
      // Wait for save confirmation
      await page.waitForSelector('[data-testid="save-success"]', {
        timeout: 5000
      })
      
      return true
    } catch (error) {
      console.log(`⚠️ Failed to configure API key: ${error}`)
      return false
    }
  }

  /**
   * Validate API key
   */
  static async validateApiKey(
    page: Page,
    providerId: string
  ): Promise<boolean> {
    try {
      const validateButton = page.getByTestId(`validate-key-${providerId}`)
      await validateButton.click()
      
      // Wait for validation result
      await page.waitForSelector(`[data-testid="validation-result-${providerId}"]`, {
        timeout: 10000
      })
      
      const resultElement = page.getByTestId(`validation-result-${providerId}`)
      const resultText = await resultElement.textContent()
      
      return resultText?.includes('valid') || resultText?.includes('success') || false
    } catch (error) {
      console.log(`⚠️ Key validation failed: ${error}`)
      return false
    }
  }

  /**
   * Get available models for a provider
   */
  static async getAvailableModels(
    page: Page,
    providerId: string
  ): Promise<string[]> {
    try {
      // Refresh models
      const refreshButton = page.getByTestId(`refresh-models-${providerId}`)
      if (await refreshButton.isVisible()) {
        await refreshButton.click()
        await page.waitForTimeout(2000)
      }
      
      // Get models list
      const modelsList = page.getByTestId(`models-list-${providerId}`)
      await modelsList.waitFor({ timeout: 5000 })
      
      const modelElements = modelsList.locator('[data-model-item]')
      const count = await modelElements.count()
      const models: string[] = []
      
      for (let i = 0; i < count; i++) {
        const text = await modelElements.nth(i).textContent()
        if (text) models.push(text.trim())
      }
      
      return models
    } catch (error) {
      console.log(`⚠️ Failed to get models: ${error}`)
      return []
    }
  }

  /**
   * Select a model for a provider
   */
  static async selectModel(
    page: Page,
    providerId: string,
    modelName: string
  ): Promise<boolean> {
    try {
      const modelSelect = page.getByTestId(`model-select-${providerId}`)
      await modelSelect.selectOption(modelName)
      
      // Save selection
      const saveButton = page.getByTestId(`save-model-${providerId}`)
      if (await saveButton.isVisible()) {
        await saveButton.click()
        await page.waitForTimeout(1000)
      }
      
      return true
    } catch (error) {
      console.log(`⚠️ Failed to select model: ${error}`)
      return false
    }
  }

  /**
   * Check if provider is available/online
   */
  static async isProviderAvailable(
    page: Page,
    providerId: string
  ): Promise<boolean> {
    try {
      const statusIndicator = page.getByTestId(`status-${providerId}`)
      await statusIndicator.waitFor({ timeout: 5000 })
      
      const classes = await statusIndicator.getAttribute('class')
      const status = await statusIndicator.textContent()
      
      return (
        classes?.includes('online') ||
        classes?.includes('available') ||
        status?.toLowerCase().includes('online') ||
        status?.toLowerCase().includes('available') ||
        false
      )
    } catch {
      return false
    }
  }

  /**
   * Wait for all providers to initialize
   */
  static async waitForProvidersReady(page: Page) {
    // Wait for providers page to load
    await page.waitForSelector('[data-testid="providers-page"]', {
      timeout: 10000
    })
    
    // Wait a bit for provider detection
    await page.waitForTimeout(2000)
    
    // Wait for at least one provider section to be visible
    const localSection = page.getByTestId('local-providers-section')
    const cloudSection = page.getByTestId('cloud-providers-section')
    
    await Promise.race([
      localSection.waitFor({ timeout: 5000 }),
      cloudSection.waitFor({ timeout: 5000 })
    ])
  }

  /**
   * Get provider error message if any
   */
  static async getProviderError(
    page: Page,
    providerId: string
  ): Promise<string | null> {
    try {
      const errorElement = page.getByTestId(`error-${providerId}`)
      if (await errorElement.isVisible()) {
        return await errorElement.textContent()
      }
    } catch {
      // No error element
    }
    return null
  }

  /**
   * Toggle API key visibility
   */
  static async toggleKeyVisibility(
    page: Page,
    providerId: string
  ): Promise<boolean> {
    try {
      const toggleButton = page.getByTestId(`toggle-key-visibility-${providerId}`)
      await toggleButton.click()
      await page.waitForTimeout(500)
      
      const keyInput = page.getByTestId(`api-key-input-${providerId}`)
      const inputType = await keyInput.getAttribute('type')
      
      return inputType === 'text'
    } catch (error) {
      console.log(`⚠️ Failed to toggle key visibility: ${error}`)
      return false
    }
  }

  /**
   * Clear API key for a provider
   */
  static async clearApiKey(
    page: Page,
    providerId: string
  ): Promise<boolean> {
    try {
      const clearButton = page.getByTestId(`clear-key-${providerId}`)
      await clearButton.click()
      
      // Handle confirmation if present
      const confirmButton = page.getByRole('button', { name: /confirm|clear/i })
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click()
      }
      
      // Verify key is cleared
      const keyInput = page.getByTestId(`api-key-input-${providerId}`)
      const value = await keyInput.inputValue()
      
      return value === ''
    } catch (error) {
      console.log(`⚠️ Failed to clear API key: ${error}`)
      return false
    }
  }

  /**
   * Get all configured providers
   */
  static async getAllProviders(page: Page): Promise<Array<{
    id: string
    name: string
    type: string
    status: string
  }>> {
    const providers: Array<{
      id: string
      name: string
      type: string
      status: string
    }> = []
    
    try {
      // Get all provider cards
      const providerCards = page.locator('[data-provider-card]')
      const count = await providerCards.count()
      
      for (let i = 0; i < count; i++) {
        const card = providerCards.nth(i)
        const id = await card.getAttribute('data-provider-id') || ''
        const name = await card.getByTestId('provider-name').textContent() || ''
        const type = await card.getByTestId('provider-type').textContent() || ''
        const status = await card.getByTestId('provider-status').textContent() || ''
        
        providers.push({ id, name, type, status })
      }
    } catch (error) {
      console.log(`⚠️ Failed to get providers: ${error}`)
    }
    
    return providers
  }

  /**
   * Set default provider
   */
  static async setDefaultProvider(
    page: Page,
    providerId: string
  ): Promise<boolean> {
    try {
      const setDefaultButton = page.getByTestId(`set-default-${providerId}`)
      await setDefaultButton.click()
      
      // Wait for confirmation
      await page.waitForSelector(`[data-testid="default-badge-${providerId}"]`, {
        timeout: 5000
      })
      
      return true
    } catch (error) {
      console.log(`⚠️ Failed to set default provider: ${error}`)
      return false
    }
  }

  /**
   * Check for toast messages
   */
  static async getToastMessage(page: Page): Promise<string | null> {
    try {
      const toast = page.locator('[data-sonner-toast]')
      if (await toast.isVisible({ timeout: 2000 })) {
        return await toast.textContent()
      }
    } catch {
      // No toast
    }
    return null
  }
}