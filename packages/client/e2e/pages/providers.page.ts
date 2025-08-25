import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export interface ProviderConfig {
  name: string
  type: 'lmstudio' | 'openai' | 'anthropic' | 'custom'
  endpoint?: string
  apiKey?: string
  model?: string
  settings?: Record<string, any>
}

export class ProvidersPage extends BasePage {
  private readonly addProviderButton: Locator
  private readonly providersList: Locator
  private readonly providerNameInput: Locator
  private readonly providerTypeSelect: Locator
  private readonly endpointInput: Locator
  private readonly apiKeyInput: Locator
  private readonly testConnectionButton: Locator
  private readonly saveProviderButton: Locator
  private readonly cancelButton: Locator
  private readonly deleteProviderButton: Locator
  private readonly editProviderButton: Locator
  private readonly connectionStatusIndicator: Locator
  private readonly modelSelect: Locator
  private readonly refreshModelsButton: Locator
  private readonly advancedSettingsToggle: Locator
  private readonly temperatureSlider: Locator
  private readonly maxTokensInput: Locator
  private readonly providerDialog: Locator

  constructor(page: Page) {
    super(page)
    this.addProviderButton = page.getByRole('button', { name: 'Add Provider' })
    this.providersList = page.getByTestId('providers-list')
    this.providerNameInput = page.getByLabel('Provider Name')
    this.providerTypeSelect = page.getByLabel('Provider Type')
    this.endpointInput = page.getByLabel('Endpoint URL')
    this.apiKeyInput = page.getByLabel('API Key')
    this.testConnectionButton = page.getByRole('button', { name: 'Test Connection' })
    this.saveProviderButton = page.getByRole('button', { name: 'Save Provider' })
    this.cancelButton = page.getByRole('button', { name: 'Cancel' })
    this.deleteProviderButton = page.getByRole('button', { name: 'Delete' })
    this.editProviderButton = page.getByRole('button', { name: 'Edit' })
    this.connectionStatusIndicator = page.getByTestId('connection-status')
    this.modelSelect = page.getByLabel('Model')
    this.refreshModelsButton = page.getByRole('button', { name: 'Refresh Models' })
    this.advancedSettingsToggle = page.getByRole('button', { name: 'Advanced Settings' })
    this.temperatureSlider = page.getByLabel('Temperature')
    this.maxTokensInput = page.getByLabel('Max Tokens')
    this.providerDialog = page.getByTestId('provider-dialog')
  }

  /**
   * Navigate to the providers management page
   */
  async goto() {
    await super.goto('/providers')
  }

  /**
   * Add a new AI provider
   */
  async addProvider(config: ProviderConfig): Promise<void> {
    await this.addProviderButton.click()
    await expect(this.providerDialog).toBeVisible()

    // Fill basic provider information
    await this.providerNameInput.fill(config.name)
    
    // Select provider type
    await this.providerTypeSelect.click()
    await this.page.getByRole('option', { name: config.type }).click()

    // Fill endpoint if provided
    if (config.endpoint) {
      await this.endpointInput.fill(config.endpoint)
    }

    // Fill API key if provided (for non-local providers)
    if (config.apiKey) {
      await this.apiKeyInput.fill(config.apiKey)
    }

    // Test connection before saving
    await this.testConnection()

    // Configure advanced settings if provided
    if (config.settings) {
      await this.configureAdvancedSettings(config.settings)
    }

    // Save the provider
    await this.saveProviderButton.click()
    await expect(this.providerDialog).toBeHidden()

    // Verify provider appears in the list
    await this.verifyProviderInList(config.name)
  }

  /**
   * Test connection to a provider
   */
  async testConnection(): Promise<boolean> {
    await this.testConnectionButton.click()
    
    // Wait for connection test to complete
    await this.page.waitForTimeout(2000)
    
    // Check connection status
    const statusElement = this.connectionStatusIndicator
    const status = await statusElement.textContent()
    
    if (status?.toLowerCase().includes('connected')) {
      await expect(this.connectionStatusIndicator).toHaveClass(/success|connected/)
      return true
    } else {
      await expect(this.connectionStatusIndicator).toHaveClass(/error|failed/)
      return false
    }
  }

  /**
   * Edit an existing provider
   */
  async editProvider(providerName: string, updates: Partial<ProviderConfig>): Promise<void> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    await providerCard.hover()
    
    const editButton = providerCard.getByRole('button', { name: 'Edit' })
    await editButton.click()
    
    await expect(this.providerDialog).toBeVisible()

    // Apply updates
    if (updates.name) {
      await this.providerNameInput.fill(updates.name)
    }

    if (updates.endpoint) {
      await this.endpointInput.fill(updates.endpoint)
    }

    if (updates.apiKey) {
      await this.apiKeyInput.fill(updates.apiKey)
    }

    if (updates.settings) {
      await this.configureAdvancedSettings(updates.settings)
    }

    // Test connection if endpoint or key changed
    if (updates.endpoint || updates.apiKey) {
      await this.testConnection()
    }

    // Save changes
    await this.saveProviderButton.click()
    await expect(this.providerDialog).toBeHidden()
  }

  /**
   * Delete a provider
   */
  async deleteProvider(providerName: string): Promise<void> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    await providerCard.hover()
    
    const deleteButton = providerCard.getByRole('button', { name: 'Delete' })
    await deleteButton.click()

    // Confirm deletion
    const confirmButton = this.page.getByRole('button', { name: 'Delete' })
    await confirmButton.click()

    // Verify provider is removed from the list
    await expect(providerCard).toBeHidden()
  }

  /**
   * Set up LM Studio provider specifically
   */
  async setupLMStudioProvider(): Promise<void> {
    const lmStudioConfig: ProviderConfig = {
      name: 'LM Studio Local',
      type: 'lmstudio',
      endpoint: 'http://localhost:1234/v1'
    }

    await this.addProvider(lmStudioConfig)
    
    // Select a model after setup
    await this.selectModel('GPT-OSS-20B')
  }

  /**
   * Set up OpenAI provider
   */
  async setupOpenAIProvider(apiKey: string): Promise<void> {
    const openAIConfig: ProviderConfig = {
      name: 'OpenAI GPT',
      type: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: apiKey
    }

    await this.addProvider(openAIConfig)
  }

  /**
   * Select a model for a provider
   */
  async selectModel(modelName: string): Promise<void> {
    // Refresh models list first
    await this.refreshModelsButton.click()
    await this.page.waitForTimeout(2000)

    // Select the model
    await this.modelSelect.click()
    await this.page.getByRole('option', { name: modelName }).click()

    // Verify model is selected
    await expect(this.modelSelect).toHaveValue(modelName)
  }

  /**
   * Configure advanced settings
   */
  async configureAdvancedSettings(settings: Record<string, any>): Promise<void> {
    // Open advanced settings
    await this.advancedSettingsToggle.click()

    // Configure temperature if provided
    if (settings.temperature !== undefined) {
      await this.temperatureSlider.fill(settings.temperature.toString())
    }

    // Configure max tokens if provided
    if (settings.maxTokens !== undefined) {
      await this.maxTokensInput.fill(settings.maxTokens.toString())
    }

    // Add more settings as needed
  }

  /**
   * Get list of all configured providers
   */
  async getProvidersList(): Promise<Array<{ name: string; type: string; status: string }>> {
    const providerCards = await this.providersList.getByTestId(/provider-/).all()
    const providers = []

    for (const card of providerCards) {
      const name = await card.getByTestId('provider-name').textContent()
      const type = await card.getByTestId('provider-type').textContent()
      const statusElement = card.getByTestId('provider-status')
      const status = await statusElement.textContent()

      providers.push({
        name: name || '',
        type: type || '',
        status: status || ''
      })
    }

    return providers
  }

  /**
   * Verify provider appears in the list
   */
  async verifyProviderInList(providerName: string): Promise<void> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    await expect(providerCard).toBeVisible()
  }

  /**
   * Get connection status for a provider
   */
  async getProviderStatus(providerName: string): Promise<string> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    const statusElement = providerCard.getByTestId('provider-status')
    return await statusElement.textContent() || ''
  }

  /**
   * Test all providers connection status
   */
  async testAllProviders(): Promise<Array<{ name: string; connected: boolean }>> {
    const providers = await this.getProvidersList()
    const results = []

    for (const provider of providers) {
      const providerCard = this.providersList.getByTestId(`provider-${provider.name}`)
      const testButton = providerCard.getByRole('button', { name: 'Test' })
      
      await testButton.click()
      await this.page.waitForTimeout(2000)
      
      const status = await this.getProviderStatus(provider.name)
      const connected = status.toLowerCase().includes('connected')
      
      results.push({
        name: provider.name,
        connected
      })
    }

    return results
  }

  /**
   * Import provider configuration from file
   */
  async importProviderConfig(filePath: string): Promise<void> {
    const importButton = this.page.getByRole('button', { name: 'Import Config' })
    
    // Set up file chooser
    const fileChooserPromise = this.page.waitForEvent('filechooser')
    await importButton.click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(filePath)

    // Wait for import to complete
    await expect(this.page.getByText('Configuration imported successfully')).toBeVisible()
  }

  /**
   * Export provider configuration
   */
  async exportProviderConfig(): Promise<void> {
    const exportButton = this.page.getByRole('button', { name: 'Export Config' })
    
    // Start download
    const downloadPromise = this.page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toMatch(/providers.*\.json$/)
  }

  /**
   * Check provider health/availability
   */
  async checkProviderHealth(providerName: string): Promise<{
    available: boolean
    responseTime?: number
    models?: string[]
    error?: string
  }> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    const healthButton = providerCard.getByRole('button', { name: 'Health Check' })
    
    const startTime = Date.now()
    await healthButton.click()
    
    // Wait for health check to complete
    await this.page.waitForTimeout(3000)
    
    const responseTime = Date.now() - startTime
    const status = await this.getProviderStatus(providerName)
    
    if (status.toLowerCase().includes('healthy')) {
      // Get available models if provider is healthy
      const modelsButton = providerCard.getByRole('button', { name: 'View Models' })
      if (await modelsButton.isVisible()) {
        await modelsButton.click()
        const modelsList = await this.page.getByTestId('models-list').textContent()
        const models = modelsList?.split(',').map(m => m.trim()) || []
        
        return { available: true, responseTime, models }
      }
      
      return { available: true, responseTime }
    } else {
      const errorElement = providerCard.getByTestId('provider-error')
      const error = await errorElement.textContent()
      return { available: false, error: error || 'Unknown error' }
    }
  }

  /**
   * Set default provider for new chats
   */
  async setDefaultProvider(providerName: string): Promise<void> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    const setDefaultButton = providerCard.getByRole('button', { name: 'Set as Default' })
    
    await setDefaultButton.click()
    
    // Verify default status
    await expect(providerCard.getByTestId('default-badge')).toBeVisible()
  }

  /**
   * Verify provider configuration form validation
   */
  async verifyValidation(): Promise<void> {
    await this.addProviderButton.click()
    await expect(this.providerDialog).toBeVisible()

    // Try to save without required fields
    await this.saveProviderButton.click()

    // Verify validation errors
    await expect(this.page.getByText('Provider name is required')).toBeVisible()
    await expect(this.page.getByText('Provider type is required')).toBeVisible()

    await this.cancelButton.click()
  }

  /**
   * Test provider rate limiting
   */
  async testRateLimiting(providerName: string): Promise<void> {
    const providerCard = this.providersList.getByTestId(`provider-${providerName}`)
    const rateLimitButton = providerCard.getByRole('button', { name: 'Test Rate Limit' })
    
    await rateLimitButton.click()
    
    // Wait for rate limit test
    await this.page.waitForTimeout(5000)
    
    // Verify rate limit info is displayed
    await expect(providerCard.getByTestId('rate-limit-info')).toBeVisible()
  }
}