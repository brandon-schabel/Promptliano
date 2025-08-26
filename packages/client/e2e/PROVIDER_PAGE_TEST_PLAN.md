# Provider Page Comprehensive Test Plan

## Overview
The Provider Page is the central configuration hub for AI provider settings in Promptliano, managing API keys, provider availability, and model configurations. It handles both local providers (Ollama, LM Studio) and cloud providers (OpenAI, Anthropic) with proper validation, security, and error handling. This test plan covers provider detection, configuration management, and testing workflows.

## Test Scope & Requirements

### Major Components
1. **Local Provider Detection** - Ollama and LM Studio availability detection
2. **Cloud Provider Configuration** - API key management and validation
3. **Provider Testing** - Connection testing and model availability
4. **Security Management** - Secure API key storage and validation
5. **Model Management** - Available model discovery and selection
6. **Error Handling** - Network issues, invalid keys, service unavailability

### Technical Integration Points
- **Local Service Detection**: HTTP health checks for Ollama/LM Studio
- **API Key Validation**: Secure storage and validation of provider credentials
- **Model Discovery**: Dynamic model list fetching from providers
- **Connection Testing**: Provider availability and response testing
- **Security Protocols**: Encrypted storage and secure transmission of credentials

## Test Data Requirements

### Shared Test Data Setup
```typescript
// Location: e2e/fixtures/provider-page-data.ts
export const ProviderPageTestData = {
  // Local providers that may or may not be available
  localProviders: [
    {
      id: 'ollama',
      name: 'Ollama',
      type: 'local',
      defaultUrl: 'http://localhost:11434',
      healthEndpoint: '/api/version',
      modelsEndpoint: '/api/tags',
      expectedModels: ['llama3', 'codellama', 'mistral', 'llama3.1'],
      testPrompt: 'Hello, this is a test message for Ollama',
      installInstructions: 'Install Ollama from ollama.ai'
    },
    {
      id: 'lmstudio',
      name: 'LM Studio', 
      type: 'local',
      defaultUrl: 'http://localhost:1234',
      healthEndpoint: '/v1/models',
      modelsEndpoint: '/v1/models',
      expectedModels: ['local-model', 'custom-model'],
      testPrompt: 'Hello, this is a test message for LM Studio',
      installInstructions: 'Install LM Studio from lmstudio.ai'
    }
  ],

  // Cloud providers with mock configurations  
  cloudProviders: [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'cloud',
      baseUrl: 'https://api.openai.com/v1',
      modelsEndpoint: '/models',
      testEndpoint: '/models',
      keyFormat: 'sk-[48 characters]',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
      testKey: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
      invalidKey: 'invalid-key-format',
      testPrompt: 'Hello, this is a test message for OpenAI'
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      type: 'cloud',
      baseUrl: 'https://api.anthropic.com',
      modelsEndpoint: '/v1/models',
      testEndpoint: '/v1/models',
      keyFormat: 'sk-ant-[varies]',
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
      testKey: 'sk-ant-test1234567890abcdef1234567890abcdef',
      invalidKey: 'invalid-anthropic-key',
      testPrompt: 'Hello, this is a test message for Anthropic'
    }
  ],

  // Test scenarios for different provider states
  testScenarios: {
    localAvailable: {
      mockOllamaResponse: { status: 200, body: { version: '0.1.32' } },
      mockLMStudioResponse: { status: 200, body: { data: [{ id: 'local-model' }] } }
    },
    localUnavailable: {
      mockOllamaResponse: { status: 0, error: 'ECONNREFUSED' },
      mockLMStudioResponse: { status: 0, error: 'ECONNREFUSED' }
    },
    cloudKeyValid: {
      openaiResponse: { status: 200, body: { data: [{ id: 'gpt-4' }] } },
      anthropicResponse: { status: 200, body: { data: [{ id: 'claude-3-sonnet' }] } }
    },
    cloudKeyInvalid: {
      openaiResponse: { status: 401, body: { error: { message: 'Invalid API key' } } },
      anthropicResponse: { status: 401, body: { error: { message: 'Invalid API key' } } }
    }
  }
}
```

## Page Object Model Extensions

### ProviderPage Class Implementation
```typescript
// Location: e2e/pages/provider-page.ts
export class ProviderPage extends BasePage {
  // Main page elements
  get pageHeader() {
    return this.page.getByTestId('provider-page-header')
  }

  get pageTitle() {
    return this.page.getByRole('heading', { name: /provider.*settings|ai.*providers/i })
  }

  // Provider sections
  get localProvidersSection() {
    return this.page.getByTestId('local-providers-section')
  }

  get cloudProvidersSection() {
    return this.page.getByTestId('cloud-providers-section')
  }

  // Local provider elements
  getLocalProviderCard(providerId: string) {
    return this.page.getByTestId(`provider-card-${providerId}`)
  }

  getProviderStatus(providerId: string) {
    return this.getLocalProviderCard(providerId).getByTestId('provider-status')
  }

  getProviderStatusIndicator(providerId: string) {
    return this.getLocalProviderCard(providerId).getByTestId('status-indicator')
  }

  getProviderUrl(providerId: string) {
    return this.getLocalProviderCard(providerId).getByTestId('provider-url')
  }

  getProviderTestButton(providerId: string) {
    return this.getLocalProviderCard(providerId).getByRole('button', { name: /test.*connection|test.*provider/i })
  }

  getProviderInstallButton(providerId: string) {
    return this.getLocalProviderCard(providerId).getByRole('button', { name: /install|download/i })
  }

  // Cloud provider elements
  getCloudProviderCard(providerId: string) {
    return this.page.getByTestId(`provider-card-${providerId}`)
  }

  getApiKeyInput(providerId: string) {
    return this.getCloudProviderCard(providerId).getByTestId(`api-key-input-${providerId}`)
  }

  getApiKeyToggleVisibility(providerId: string) {
    return this.getCloudProviderCard(providerId).getByTestId('toggle-key-visibility')
  }

  getSaveKeyButton(providerId: string) {
    return this.getCloudProviderCard(providerId).getByRole('button', { name: /save.*key|save/i })
  }

  getValidateKeyButton(providerId: string) {
    return this.getCloudProviderCard(providerId).getByRole('button', { name: /validate|test.*key/i })
  }

  getClearKeyButton(providerId: string) {
    return this.getCloudProviderCard(providerId).getByRole('button', { name: /clear|remove.*key/i })
  }

  // Model selection elements
  getModelList(providerId: string) {
    return this.getCloudProviderCard(providerId).getByTestId('available-models')
  }

  getModelItem(providerId: string, modelName: string) {
    return this.getModelList(providerId).getByTestId(`model-${modelName}`)
  }

  // Status and feedback elements
  getProviderStatusMessage(providerId: string) {
    return this.getLocalProviderCard(providerId).getByTestId('status-message')
  }

  getConnectionError(providerId: string) {
    return this.page.getByTestId(`connection-error-${providerId}`)
  }

  getValidationResult(providerId: string) {
    return this.page.getByTestId(`validation-result-${providerId}`)
  }

  // Global provider settings
  get globalSettingsSection() {
    return this.page.getByTestId('global-provider-settings')
  }

  get defaultProviderSelect() {
    return this.page.getByTestId('default-provider-select')
  }

  get timeoutSettings() {
    return this.page.getByTestId('timeout-settings')
  }

  // Helper methods
  async checkLocalProviderAvailability(providerId: string): Promise<boolean> {
    const statusIndicator = this.getProviderStatusIndicator(providerId)
    await statusIndicator.waitFor({ timeout: 5000 })
    
    const classes = await statusIndicator.getAttribute('class')
    return classes?.includes('online') || classes?.includes('available') || classes?.includes('connected') || false
  }

  async testProviderConnection(providerId: string): Promise<void> {
    await this.getProviderTestButton(providerId).click()
    
    // Wait for test to complete
    await this.page.waitForSelector(`[data-testid="test-result-${providerId}"]`, { timeout: 15000 })
  }

  async configureCloudProvider(providerId: string, apiKey: string): Promise<void> {
    const keyInput = this.getApiKeyInput(providerId)
    
    // Clear existing key
    await keyInput.clear()
    
    // Enter new key
    await keyInput.fill(apiKey)
    
    // Save key
    await this.getSaveKeyButton(providerId).click()
    
    // Wait for save confirmation
    await expect(this.page.getByText(/key.*saved|saved.*successfully/i)).toBeVisible({ timeout: 10000 })
  }

  async validateApiKey(providerId: string): Promise<boolean> {
    await this.getValidateKeyButton(providerId).click()
    
    // Wait for validation result
    await this.getValidationResult(providerId).waitFor({ timeout: 15000 })
    
    const resultText = await this.getValidationResult(providerId).textContent()
    return resultText?.includes('valid') || resultText?.includes('success') || false
  }

  async getAvailableModels(providerId: string): Promise<string[]> {
    const modelsList = this.getModelList(providerId)
    await modelsList.waitFor()
    
    const modelElements = modelsList.getByTestId(/^model-/)
    const count = await modelElements.count()
    const models: string[] = []
    
    for (let i = 0; i < count; i++) {
      const modelText = await modelElements.nth(i).textContent()
      if (modelText) models.push(modelText.trim())
    }
    
    return models
  }
}
```

## Test Scenarios

### 1. Local Provider Detection and Management

#### 1.1 Provider Availability Detection Tests
```typescript
test.describe('Local Provider Detection', () => {
  test('should detect available local providers', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    
    // Mock successful responses for local providers
    await page.route('**/localhost:11434/api/version', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ProviderPageTestData.testScenarios.localAvailable.mockOllamaResponse.body)
      })
    })
    
    await page.route('**/localhost:1234/v1/models', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ProviderPageTestData.testScenarios.localAvailable.mockLMStudioResponse.body)
      })
    })

    await providerPage.goto('/providers')

    // Wait for provider detection to complete
    await expect(providerPage.localProvidersSection).toBeVisible()

    // Check Ollama status
    const ollamaAvailable = await providerPage.checkLocalProviderAvailability('ollama')
    if (ollamaAvailable) {
      await expect(providerPage.getProviderStatus('ollama')).toContainText(/online|available|connected/i)
      await expect(providerPage.getProviderStatusIndicator('ollama')).toHaveClass(/online|available|connected/)
      
      // Test button should be visible and enabled
      await expect(providerPage.getProviderTestButton('ollama')).toBeVisible()
      await expect(providerPage.getProviderTestButton('ollama')).toBeEnabled()
    } else {
      await expect(providerPage.getProviderStatus('ollama')).toContainText(/offline|unavailable|not.*found/i)
      await expect(providerPage.getProviderInstallButton('ollama')).toBeVisible()
    }

    // Check LM Studio status
    const lmStudioAvailable = await providerPage.checkLocalProviderAvailability('lmstudio')
    if (lmStudioAvailable) {
      await expect(providerPage.getProviderStatus('lmstudio')).toContainText(/online|available|connected/i)
      await expect(providerPage.getProviderTestButton('lmstudio')).toBeVisible()
    } else {
      await expect(providerPage.getProviderStatus('lmstudio')).toContainText(/offline|unavailable/i)
      await expect(providerPage.getProviderInstallButton('lmstudio')).toBeVisible()
    }
  })

  test('should handle unavailable local providers gracefully', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    
    // Mock connection failures
    await page.route('**/localhost:11434/**', route => {
      route.abort('failed')
    })
    
    await page.route('**/localhost:1234/**', route => {
      route.abort('failed')
    })

    await providerPage.goto('/providers')

    // Both providers should show as unavailable
    await expect(providerPage.getProviderStatus('ollama')).toContainText(/offline|unavailable|not.*running/i)
    await expect(providerPage.getProviderStatus('lmstudio')).toContainText(/offline|unavailable|not.*running/i)

    // Should show install buttons
    await expect(providerPage.getProviderInstallButton('ollama')).toBeVisible()
    await expect(providerPage.getProviderInstallButton('lmstudio')).toBeVisible()

    // Install buttons should contain helpful links or instructions
    const ollamaInstallBtn = providerPage.getProviderInstallButton('ollama')
    await expect(ollamaInstallBtn).toBeVisible()
    
    const lmStudioInstallBtn = providerPage.getProviderInstallButton('lmstudio')
    await expect(lmStudioInstallBtn).toBeVisible()
  })

  test('should test local provider connections', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    
    // Mock Ollama as available
    await page.route('**/localhost:11434/**', route => {
      const url = route.request().url()
      if (url.includes('/api/version')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ version: '0.1.32' })
        })
      } else if (url.includes('/api/tags')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ 
            models: [
              { name: 'llama3:latest' },
              { name: 'codellama:latest' }
            ]
          })
        })
      } else {
        route.fulfill({ status: 200, body: '{}' })
      }
    })

    await providerPage.goto('/providers')

    // Test Ollama connection
    await providerPage.testProviderConnection('ollama')

    // Should show successful test result
    const testResult = page.getByTestId('test-result-ollama')
    await expect(testResult).toBeVisible()
    await expect(testResult).toContainText(/success|connected|working/i)

    // Should display available models
    const modelList = providerPage.getModelList('ollama')
    if (await modelList.isVisible()) {
      await expect(modelList.getByText('llama3:latest')).toBeVisible()
      await expect(modelList.getByText('codellama:latest')).toBeVisible()
    }
  })

  test('should handle provider URL configuration', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Should display default URLs
    await expect(providerPage.getProviderUrl('ollama')).toContainText('localhost:11434')
    await expect(providerPage.getProviderUrl('lmstudio')).toContainText('localhost:1234')

    // Should allow URL editing (if supported)
    const urlElement = providerPage.getProviderUrl('ollama')
    if (await urlElement.locator('input').count() > 0) {
      const urlInput = urlElement.locator('input')
      await urlInput.clear()
      await urlInput.fill('http://localhost:11435')
      
      // Save changes
      await page.keyboard.press('Enter')
      
      // Should update and test new URL
      await expect(providerPage.getProviderUrl('ollama')).toContainText('localhost:11435')
    }
  })

  test('should show install instructions for unavailable providers', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    
    // Mock providers as unavailable
    await page.route('**/localhost:11434/**', route => route.abort('failed'))
    await page.route('**/localhost:1234/**', route => route.abort('failed'))

    await providerPage.goto('/providers')

    // Click install button for Ollama
    await providerPage.getProviderInstallButton('ollama').click()

    // Should show install instructions or redirect
    const installDialog = page.getByTestId('install-instructions-dialog')
    const externalLink = page.getByRole('link', { name: /ollama\.ai|download.*ollama/i })

    const hasDialog = await installDialog.isVisible().catch(() => false)
    const hasLink = await externalLink.isVisible().catch(() => false)

    expect(hasDialog || hasLink).toBe(true)

    if (hasDialog) {
      await expect(installDialog).toContainText(/install.*ollama|download.*ollama/i)
      await expect(installDialog).toContainText(/ollama\.ai/)
    }
  })
})
```

#### 1.2 Cloud Provider Configuration Tests
```typescript
test.describe('Cloud Provider Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints for cloud providers
    await page.route('**/api.openai.com/v1/**', route => {
      const authHeader = route.request().headers()['authorization']
      
      if (!authHeader || authHeader === 'Bearer invalid-key-format') {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ 
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-4-turbo', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model' }
            ]
          })
        })
      }
    })

    await page.route('**/api.anthropic.com/**', route => {
      const authHeader = route.request().headers()['x-api-key']
      
      if (!authHeader || authHeader === 'invalid-anthropic-key') {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ 
            data: [
              { id: 'claude-3-opus-20240229' },
              { id: 'claude-3-sonnet-20240229' },
              { id: 'claude-3-haiku-20240307' }
            ]
          })
        })
      }
    })
  })

  test('should configure OpenAI API key successfully', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Configure OpenAI
    const openaiKey = ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!
    await providerPage.configureCloudProvider('openai', openaiKey)

    // Verify key is saved (should be masked)
    const keyInput = providerPage.getApiKeyInput('openai')
    const keyValue = await keyInput.inputValue()
    expect(keyValue).toMatch(/\*+|sk-\*+/) // Should be masked

    // Should be able to validate key
    const isValid = await providerPage.validateApiKey('openai')
    expect(isValid).toBe(true)

    // Should show available models
    await expect(providerPage.getModelList('openai')).toBeVisible()
    const models = await providerPage.getAvailableModels('openai')
    expect(models.length).toBeGreaterThan(0)
    expect(models).toContain('gpt-4')
  })

  test('should handle invalid API keys gracefully', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Try to configure with invalid key
    await providerPage.configureCloudProvider('openai', 'invalid-key-format')

    // Validation should fail
    const isValid = await providerPage.validateApiKey('openai')
    expect(isValid).toBe(false)

    // Should show error message
    const validationResult = providerPage.getValidationResult('openai')
    await expect(validationResult).toContainText(/invalid|error|failed/i)

    // Models should not be loaded
    const modelList = providerPage.getModelList('openai')
    const hasModels = await modelList.locator('[data-testid^="model-"]').count()
    expect(hasModels).toBe(0)
  })

  test('should toggle API key visibility', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Configure a key first
    await providerPage.configureCloudProvider('anthropic', 'sk-ant-test1234567890abcdef')

    const keyInput = providerPage.getApiKeyInput('anthropic')
    const toggleButton = providerPage.getApiKeyToggleVisibility('anthropic')

    // Key should be masked initially
    expect(await keyInput.getAttribute('type')).toBe('password')

    // Click toggle to show
    await toggleButton.click()
    expect(await keyInput.getAttribute('type')).toBe('text')
    
    const visibleValue = await keyInput.inputValue()
    expect(visibleValue).toContain('sk-ant-test123')

    // Click toggle to hide again
    await toggleButton.click()
    expect(await keyInput.getAttribute('type')).toBe('password')
  })

  test('should clear saved API keys', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Configure key
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)

    // Clear key
    await providerPage.getClearKeyButton('openai').click()

    // Should show confirmation
    const confirmDialog = page.getByTestId('clear-key-confirmation')
    await expect(confirmDialog).toBeVisible()
    await page.getByRole('button', { name: /clear|confirm/i }).click()

    // Key input should be empty
    const keyInput = providerPage.getApiKeyInput('openai')
    await expect(keyInput).toHaveValue('')

    // Models should be cleared
    const modelList = providerPage.getModelList('openai')
    const hasModels = await modelList.locator('[data-testid^="model-"]').count()
    expect(hasModels).toBe(0)
  })

  test('should validate API key format before saving', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Try invalid format keys
    const invalidFormats = [
      'not-a-key',
      'sk-',
      'sk-tooshort',
      '12345',
      ''
    ]

    for (const invalidKey of invalidFormats) {
      const keyInput = providerPage.getApiKeyInput('openai')
      await keyInput.clear()
      await keyInput.fill(invalidKey)

      // Save button should be disabled or validation error shown
      const saveButton = providerPage.getSaveKeyButton('openai')
      const isEnabled = await saveButton.isEnabled()
      
      if (isEnabled) {
        await saveButton.click()
        // Should show format error
        const errorMessage = page.getByText(/invalid.*format|key.*format/i)
        await expect(errorMessage).toBeVisible({ timeout: 5000 })
      } else {
        // Save button disabled is acceptable validation
        expect(isEnabled).toBe(false)
      }
    }
  })
})
```

### 2. Provider Testing and Validation

#### 2.1 Connection Testing Tests
```typescript
test.describe('Provider Connection Testing', () => {
  test('should test provider connections with real API calls', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock successful API responses
    await page.route('**/api.openai.com/v1/models', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'gpt-4', object: 'model', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' }
          ]
        })
      })
    })

    await providerPage.goto('/providers')

    // Configure OpenAI key
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)

    // Test connection
    const testButton = providerPage.getProviderTestButton('openai')
    await testButton.click()

    // Should show testing state
    await expect(page.getByText(/testing.*connection|connecting/i)).toBeVisible()

    // Should show successful result
    const testResult = page.getByTestId('test-result-openai')
    await expect(testResult).toBeVisible({ timeout: 15000 })
    await expect(testResult).toContainText(/success|connected|working/i)

    // Should load and display models
    const modelList = providerPage.getModelList('openai')
    await expect(modelList).toBeVisible()
    await expect(modelList.getByText('gpt-4')).toBeVisible()
    await expect(modelList.getByText('gpt-3.5-turbo')).toBeVisible()
  })

  test('should handle network timeouts gracefully', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock timeout scenario
    await page.route('**/api.anthropic.com/**', route => {
      // Don't respond to simulate timeout
      setTimeout(() => {
        route.fulfill({
          status: 408,
          body: JSON.stringify({ error: { message: 'Request timeout' } })
        })
      }, 30000) // 30 second timeout
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('anthropic', ProviderPageTestData.cloudProviders.find(p => p.id === 'anthropic')?.testKey!)

    // Test connection
    await providerPage.getProviderTestButton('anthropic').click()

    // Should eventually show timeout error
    const testResult = page.getByTestId('test-result-anthropic')
    await expect(testResult).toBeVisible({ timeout: 35000 })
    await expect(testResult).toContainText(/timeout|slow|network.*error/i)
  })

  test('should test multiple providers simultaneously', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock successful responses for both providers
    await page.route('**/api.openai.com/v1/models', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      }, 1000) // 1 second delay
    })

    await page.route('**/api.anthropic.com/**', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
        })
      }, 1500) // 1.5 second delay
    })

    await providerPage.goto('/providers')

    // Configure both providers
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)
    await providerPage.configureCloudProvider('anthropic', ProviderPageTestData.cloudProviders.find(p => p.id === 'anthropic')?.testKey!)

    // Start both tests
    await Promise.all([
      providerPage.getProviderTestButton('openai').click(),
      providerPage.getProviderTestButton('anthropic').click()
    ])

    // Both should eventually show results
    await expect(page.getByTestId('test-result-openai')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('test-result-anthropic')).toBeVisible({ timeout: 15000 })

    // Both should show success
    await expect(page.getByTestId('test-result-openai')).toContainText(/success|connected/i)
    await expect(page.getByTestId('test-result-anthropic')).toContainText(/success|connected/i)
  })

  test('should handle rate limiting from providers', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock rate limit response
    await page.route('**/api.openai.com/**', route => {
      route.fulfill({
        status: 429,
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0'
        },
        body: JSON.stringify({ 
          error: { 
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        })
      })
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)

    // Test connection
    await providerPage.getProviderTestButton('openai').click()

    // Should show rate limit error
    const testResult = page.getByTestId('test-result-openai')
    await expect(testResult).toBeVisible()
    await expect(testResult).toContainText(/rate.*limit|too.*many.*requests/i)

    // Should suggest retry later
    await expect(testResult).toContainText(/try.*later|retry.*after/i)
  })
})
```

#### 2.2 Model Discovery and Management Tests
```typescript
test.describe('Model Discovery and Management', () => {
  test('should discover and display available models for each provider', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock model discovery for different providers
    await page.route('**/api.openai.com/v1/models', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.models.map(model => ({ id: model, object: 'model' }))
        })
      })
    })

    await page.route('**/localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          models: ProviderPageTestData.localProviders.find(p => p.id === 'ollama')?.expectedModels.map(model => ({ name: model }))
        })
      })
    })

    await providerPage.goto('/providers')

    // Configure OpenAI and test
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)
    await providerPage.testProviderConnection('openai')

    // Should display OpenAI models
    const openaiModels = await providerPage.getAvailableModels('openai')
    expect(openaiModels.length).toBeGreaterThan(0)
    expect(openaiModels).toContain('gpt-4')
    expect(openaiModels).toContain('gpt-3.5-turbo')

    // Test local provider if available
    const isOllamaAvailable = await providerPage.checkLocalProviderAvailability('ollama')
    if (isOllamaAvailable) {
      await providerPage.testProviderConnection('ollama')
      const ollamaModels = await providerPage.getAvailableModels('ollama')
      expect(ollamaModels.length).toBeGreaterThan(0)
    }
  })

  test('should handle empty model lists gracefully', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock empty model response
    await page.route('**/api.openai.com/v1/models', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [] })
      })
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)
    await providerPage.testProviderConnection('openai')

    // Should show message about no models
    const modelList = providerPage.getModelList('openai')
    await expect(modelList).toBeVisible()
    await expect(modelList.getByText(/no.*models|models.*unavailable/i)).toBeVisible()
  })

  test('should refresh model lists when connection is retested', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    let requestCount = 0
    await page.route('**/api.anthropic.com/**', route => {
      requestCount++
      const models = requestCount === 1 
        ? [{ id: 'claude-3-haiku-20240307' }] 
        : [{ id: 'claude-3-haiku-20240307' }, { id: 'claude-3-sonnet-20240229' }, { id: 'claude-3-opus-20240229' }]
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: models })
      })
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('anthropic', ProviderPageTestData.cloudProviders.find(p => p.id === 'anthropic')?.testKey!)

    // First test - should show one model
    await providerPage.testProviderConnection('anthropic')
    let models = await providerPage.getAvailableModels('anthropic')
    expect(models).toHaveLength(1)

    // Retest - should show updated models
    await providerPage.testProviderConnection('anthropic')
    models = await providerPage.getAvailableModels('anthropic')
    expect(models).toHaveLength(3)
  })

  test('should show model capabilities and limitations', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock detailed model information
    await page.route('**/api.openai.com/v1/models', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: [
            { 
              id: 'gpt-4',
              object: 'model',
              owned_by: 'openai',
              permission: [{}],
              context_length: 8192,
              capabilities: ['chat', 'completion']
            },
            {
              id: 'gpt-3.5-turbo',
              object: 'model', 
              owned_by: 'openai',
              context_length: 4096,
              capabilities: ['chat']
            }
          ]
        })
      })
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)
    await providerPage.testProviderConnection('openai')

    // Should show model details (if UI supports it)
    const gpt4Model = providerPage.getModelItem('openai', 'gpt-4')
    if (await gpt4Model.isVisible()) {
      // Check for context length information
      const contextInfo = gpt4Model.locator('[data-testid="context-length"], .context-length')
      if (await contextInfo.count() > 0) {
        await expect(contextInfo).toContainText(/8192|8k/)
      }

      // Check for capabilities
      const capabilityInfo = gpt4Model.locator('[data-testid="capabilities"], .capabilities')
      if (await capabilityInfo.count() > 0) {
        await expect(capabilityInfo).toContainText(/chat|completion/)
      }
    }
  })
})
```

### 3. Security and Error Handling

#### 3.1 Security Tests
```typescript
test.describe('Provider Security and Data Protection', () => {
  test('should mask API keys in UI', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    const testKey = 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef'
    
    // Configure key
    await providerPage.configureCloudProvider('openai', testKey)

    // Key should be masked in input
    const keyInput = providerPage.getApiKeyInput('openai')
    const displayValue = await keyInput.inputValue()
    
    // Should not show full key
    expect(displayValue).not.toBe(testKey)
    expect(displayValue).toMatch(/\*+|sk-\*+/)
  })

  test('should not expose API keys in browser storage inspection', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    await providerPage.configureCloudProvider('anthropic', 'sk-ant-testsecretkey123456789')

    // Check localStorage doesn't contain raw key
    const localStorage = await page.evaluate(() => {
      const storage: any = {}
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          storage[key] = window.localStorage.getItem(key)
        }
      }
      return storage
    })

    // Raw API key should not be in localStorage
    const storageString = JSON.stringify(localStorage)
    expect(storageString).not.toContain('sk-ant-testsecretkey123456789')

    // Check sessionStorage as well
    const sessionStorage = await page.evaluate(() => {
      const storage: any = {}
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i)
        if (key) {
          storage[key] = window.sessionStorage.getItem(key)
        }
      }
      return storage
    })

    const sessionString = JSON.stringify(sessionStorage)
    expect(sessionString).not.toContain('sk-ant-testsecretkey123456789')
  })

  test('should validate key format before transmission', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Monitor network requests
    const requests: any[] = []
    page.on('request', req => {
      if (req.url().includes('/api/providers') || req.url().includes('/providers')) {
        requests.push({
          url: req.url(),
          method: req.method(),
          postData: req.postDataJSON()
        })
      }
    })

    // Try to save invalid format key
    const keyInput = providerPage.getApiKeyInput('openai')
    await keyInput.fill('invalid-key')
    
    const saveButton = providerPage.getSaveKeyButton('openai')
    
    // If save button is enabled, clicking should either validate or reject
    if (await saveButton.isEnabled()) {
      await saveButton.click()
      
      // Should either show validation error or not send invalid key
      const hasError = await page.getByText(/invalid.*format|key.*format/i).isVisible()
      
      if (!hasError) {
        // Check that invalid key wasn't transmitted
        const relevantRequests = requests.filter(r => r.postData?.apiKey)
        for (const req of relevantRequests) {
          expect(req.postData.apiKey).not.toBe('invalid-key')
        }
      }
    }
  })

  test('should handle secure key storage and retrieval', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    await providerPage.goto('/providers')

    // Configure key
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)

    // Reload page
    await page.reload()
    await providerPage.waitForPageLoad()

    // Key should still be configured but masked
    const keyInput = providerPage.getApiKeyInput('openai')
    const value = await keyInput.inputValue()
    
    // Should indicate key is saved but not expose it
    expect(value).toMatch(/\*+|configured|saved/)
    expect(value).not.toContain(ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey)
  })
})
```

#### 3.2 Error Handling and Recovery Tests
```typescript
test.describe('Error Handling and Recovery', () => {
  test('should handle provider service outages gracefully', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock service outage
    await page.route('**/api.openai.com/**', route => {
      route.fulfill({
        status: 503,
        body: JSON.stringify({
          error: {
            message: 'The server is temporarily unable to service your request',
            type: 'server_error'
          }
        })
      })
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)

    // Test connection
    await providerPage.testProviderConnection('openai')

    // Should show service outage message
    const errorResult = providerPage.getConnectionError('openai')
    await expect(errorResult).toBeVisible()
    await expect(errorResult).toContainText(/service.*unavailable|server.*error|outage/i)

    // Should suggest retry or status page
    await expect(errorResult).toContainText(/try.*later|status|retry/i)
  })

  test('should recover from network errors', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    
    let shouldFail = true
    await page.route('**/api.anthropic.com/**', route => {
      if (shouldFail) {
        route.abort('failed')
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
        })
      }
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('anthropic', ProviderPageTestData.cloudProviders.find(p => p.id === 'anthropic')?.testKey!)

    // First attempt should fail
    await providerPage.testProviderConnection('anthropic')
    
    const errorResult = providerPage.getConnectionError('anthropic')
    await expect(errorResult).toContainText(/network.*error|connection.*failed/i)

    // Fix the network and retry
    shouldFail = false
    await providerPage.testProviderConnection('anthropic')

    // Should now succeed
    const successResult = page.getByTestId('test-result-anthropic')
    await expect(successResult).toContainText(/success|connected/i)
  })

  test('should handle invalid API responses gracefully', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock invalid JSON response
    await page.route('**/api.openai.com/v1/models', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response'
      })
    })

    await providerPage.goto('/providers')
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)
    await providerPage.testProviderConnection('openai')

    // Should handle parsing error gracefully
    const errorResult = providerPage.getConnectionError('openai')
    await expect(errorResult).toContainText(/invalid.*response|parsing.*error|unexpected.*response/i)
  })

  test('should provide clear error messages for common issues', async ({ page }) => {
    const providerPage = new ProviderPage(page)
    
    // Test various error scenarios
    const errorScenarios = [
      {
        status: 401,
        body: { error: { message: 'Invalid API key' } },
        expectedMessage: /invalid.*key|unauthorized/i
      },
      {
        status: 403,
        body: { error: { message: 'Forbidden' } },
        expectedMessage: /forbidden|access.*denied/i
      },
      {
        status: 429,
        body: { error: { message: 'Rate limit exceeded' } },
        expectedMessage: /rate.*limit|too.*many.*requests/i
      },
      {
        status: 500,
        body: { error: { message: 'Internal server error' } },
        expectedMessage: /server.*error|internal.*error/i
      }
    ]

    for (const scenario of errorScenarios) {
      await page.route('**/api.openai.com/**', route => {
        route.fulfill({
          status: scenario.status,
          contentType: 'application/json',
          body: JSON.stringify(scenario.body)
        })
      })

      await providerPage.goto('/providers')
      await providerPage.configureCloudProvider('openai', 'test-key')
      await providerPage.testProviderConnection('openai')

      const errorResult = providerPage.getConnectionError('openai')
      await expect(errorResult).toContainText(scenario.expectedMessage)

      // Clear route for next test
      await page.unroute('**/api.openai.com/**')
    }
  })

  test('should handle simultaneous provider tests without conflicts', async ({ page }) => {
    const providerPage = new ProviderPage(page)

    // Mock different response times for each provider
    await page.route('**/api.openai.com/**', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      }, 1000)
    })

    await page.route('**/api.anthropic.com/**', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
        })
      }, 2000)
    })

    await providerPage.goto('/providers')

    // Configure both providers
    await providerPage.configureCloudProvider('openai', ProviderPageTestData.cloudProviders.find(p => p.id === 'openai')?.testKey!)
    await providerPage.configureCloudProvider('anthropic', ProviderPageTestData.cloudProviders.find(p => p.id === 'anthropic')?.testKey!)

    // Start tests simultaneously
    await Promise.all([
      providerPage.getProviderTestButton('openai').click(),
      providerPage.getProviderTestButton('anthropic').click()
    ])

    // Both should complete successfully without interference
    await expect(page.getByTestId('test-result-openai')).toContainText(/success|connected/i)
    await expect(page.getByTestId('test-result-anthropic')).toContainText(/success|connected/i)

    // Each should have their own models loaded
    await expect(providerPage.getModelList('openai').getByText('gpt-4')).toBeVisible()
    await expect(providerPage.getModelList('anthropic').getByText('claude-3-sonnet')).toBeVisible()
  })
})
```

## Best Practices and Recommendations

### 1. Environment-Aware Testing
- **Local Provider Detection**: Tests should handle when Ollama/LM Studio are not installed
- **Mock Strategies**: Use realistic mocks that match actual provider APIs
- **Network Conditions**: Test various network scenarios (slow, timeout, intermittent)

### 2. Security Testing
- **Key Masking**: Verify API keys are properly masked in UI and storage
- **Input Validation**: Test key format validation before transmission
- **Error Messages**: Ensure error messages don't expose sensitive information

### 3. Provider Integration
- **Rate Limiting**: Test handling of provider rate limits
- **API Changes**: Design tests to be resilient to minor API changes
- **Multiple Providers**: Test simultaneous provider operations

### 4. User Experience
- **Loading States**: Verify appropriate loading indicators during tests
- **Error Recovery**: Test user workflows for recovering from errors
- **Configuration Persistence**: Ensure settings survive page reloads

## Execution Strategy

### 1. Test Organization
- **Local Provider Tests**: Can run in parallel, use mocks for unavailable services
- **Cloud Provider Tests**: Use mocks to avoid API costs and rate limits
- **Security Tests**: Focus on client-side validation and UI behavior
- **Error Handling**: Test various failure scenarios systematically

### 2. Mock Management
- **Realistic Responses**: Use actual provider response formats
- **Error Simulation**: Cover common error scenarios with appropriate HTTP codes
- **Performance Testing**: Simulate slow responses and timeouts

### 3. CI/CD Considerations
- **No Real API Calls**: All tests use mocks to avoid costs and rate limits
- **Environment Variables**: Use test credentials that don't expose real keys
- **Parallel Execution**: Tests can run in parallel with proper mock isolation

This comprehensive test plan ensures the Provider Page functionality is thoroughly validated across all provider types, configuration scenarios, and error conditions, providing reliable and secure AI provider management for Promptliano users.