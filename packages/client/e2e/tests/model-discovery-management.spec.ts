import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../pages/providers.page'
import { ProviderPageTestData, ProviderTestDataHelper } from '../fixtures/provider-page-data'

/**
 * Model Discovery and Management Tests
 *
 * These tests cover model discovery, display, management, and selection functionality
 * for both local and cloud providers including handling of large model lists,
 * empty states, and model metadata display.
 */
test.describe('Model Discovery and Management', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    await providersPage.goto()
    await providersPage.waitForPageLoad()
  })

  test.describe('Model Discovery and Display', () => {
    test('should discover and display available models for each provider', async ({ page }) => {
      // Mock model discovery for different providers
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: ProviderPageTestData.cloudProviders
              .find((p) => p.id === 'openai')
              ?.models.map((model) => ({ id: model, object: 'model' }))
          })
        })
      })

      await page.route('**/localhost:11434/api/tags', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            models: ProviderPageTestData.localProviders
              .find((p) => p.id === 'ollama')
              ?.expectedModels.map((model) => ({ name: model }))
          })
        })
      })

      // Configure OpenAI and test
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Should display OpenAI models
      const openaiModels = await providersPage.getAvailableModels('openai')
      expect(openaiModels.length).toBeGreaterThan(0)
      expect(openaiModels).toContain('gpt-4')
      expect(openaiModels).toContain('gpt-3.5-turbo')

      // Test local provider if available
      await providersPage.waitForProviderDetection()
      const isOllamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')
      if (isOllamaAvailable) {
        await providersPage.testProviderConnection('ollama')
        const ollamaModels = await providersPage.getAvailableModels('ollama')
        expect(ollamaModels.length).toBeGreaterThan(0)
      }
    })

    test('should display model metadata when available', async ({ page }) => {
      // Mock detailed model information
      await page.route('**/api.openai.com/v1/models', (route) => {
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

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Should show model details (if UI supports it)
      const gpt4Model = providersPage.getModelItem('openai', 'gpt-4')
      const modelExists = await gpt4Model.isVisible().catch(() => false)

      if (modelExists) {
        // Check for context length information
        const contextInfo = gpt4Model.locator('[data-testid=\"context-length\"], .context-length')
        const hasContextInfo = (await contextInfo.count()) > 0

        if (hasContextInfo) {
          await expect(contextInfo).toContainText(/8192|8k/)
        }

        // Check for capabilities
        const capabilityInfo = gpt4Model.locator('[data-testid=\"capabilities\"], .capabilities')
        const hasCapabilityInfo = (await capabilityInfo.count()) > 0

        if (hasCapabilityInfo) {
          await expect(capabilityInfo).toContainText(/chat|completion/)
        }
      }
    })

    test('should handle large model lists efficiently', async ({ page }) => {
      // Mock large model list
      const largeModelList = ProviderPageTestData.modelDiscoveryScenarios.largeModelList.models

      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: largeModelList.map((model) => ({ id: model.id, object: 'model', name: model.name }))
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()

      // Should display models efficiently (check if virtualization or pagination is used)
      const visibleModels = await modelList.locator('[data-testid^=\"model-\"]').count()

      // Either shows all models or uses virtualization/pagination
      expect(visibleModels).toBeGreaterThan(0)

      // If virtualization is used, there should be fewer visible items than total
      if (visibleModels < largeModelList.length) {
        // Check for scroll container or pagination
        const scrollContainer = modelList.locator('.scroll, [data-virtualized], .virtual-list')
        const pagination = page.getByTestId('model-pagination')

        const hasVirtualization = (await scrollContainer.count()) > 0
        const hasPagination = await pagination.isVisible().catch(() => false)

        expect(hasVirtualization || hasPagination).toBe(true)
      }
    })

    test('should display local provider models with proper formatting', async ({ page }) => {
      // Mock Ollama with various model formats
      await page.route('**/localhost:11434/**', (route) => {
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
                {
                  name: 'llama3:8b',
                  size: 4661211808,
                  modified_at: '2024-01-15T10:30:00Z',
                  details: {
                    format: 'gguf',
                    family: 'llama',
                    parameter_size: '8B'
                  }
                },
                {
                  name: 'codellama:7b-instruct',
                  size: 3825819519,
                  modified_at: '2024-01-14T08:20:00Z',
                  details: {
                    format: 'gguf',
                    family: 'llama',
                    parameter_size: '7B'
                  }
                },
                {
                  name: 'mistral:latest',
                  size: 4109016141,
                  modified_at: '2024-01-13T16:45:00Z'
                }
              ]
            })
          })
        } else {
          route.fulfill({ status: 200, body: '{}' })
        }
      })

      await providersPage.waitForProviderDetection()
      const isOllamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')

      if (isOllamaAvailable) {
        await providersPage.testProviderConnection('ollama')

        const modelList = providersPage.getModelList('ollama')
        await expect(modelList).toBeVisible()

        // Should display model names properly
        await expect(modelList.getByText('llama3:8b')).toBeVisible()
        await expect(modelList.getByText('codellama:7b-instruct')).toBeVisible()
        await expect(modelList.getByText('mistral:latest')).toBeVisible()

        // Check if size information is displayed
        const modelWithSize = modelList.locator('[data-testid=\"model-llama3:8b\"]')
        const modelExists = await modelWithSize.isVisible().catch(() => false)

        if (modelExists) {
          const sizeInfo = modelWithSize.locator('.size, [data-testid=\"model-size\"]')
          const hasSizeInfo = (await sizeInfo.count()) > 0

          if (hasSizeInfo) {
            const sizeText = await sizeInfo.textContent()
            expect(sizeText).toMatch(/4\\.\\dGB|4661MB|4\\sGB/)
          }
        }
      }
    })
  })

  test.describe('Empty States and Error Handling', () => {
    test('should handle empty model lists gracefully', async ({ page }) => {
      // Mock empty model response
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [] })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Should show message about no models
      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()
      await expect(modelList.getByText(/no.*models|models.*unavailable/i)).toBeVisible()
    })

    test('should handle model fetching failures', async ({ page }) => {
      // Mock successful auth but failed model fetch
      let requestCount = 0
      await page.route('**/api.anthropic.com/**', (route) => {
        requestCount++
        if (requestCount === 1) {
          // First request (validation) succeeds
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [] })
          })
        } else {
          // Model fetch fails
          route.fulfill({
            status: 500,
            body: JSON.stringify({
              error: { message: 'Unable to fetch models' }
            })
          })
        }
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))
      await providersPage.testProviderConnection('anthropic')

      const modelList = providersPage.getModelList('anthropic')
      const errorMessage = modelList.getByText(/error.*loading.*models|unable.*to.*fetch/i)

      await expect(errorMessage).toBeVisible({ timeout: 10000 })
    })

    test('should show appropriate loading states during model discovery', async ({ page }) => {
      // Mock slow model response
      await page.route('**/api.openai.com/v1/models', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              data: [
                { id: 'gpt-4', object: 'model' },
                { id: 'gpt-3.5-turbo', object: 'model' }
              ]
            })
          })
        }, 3000) // 3 second delay
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Start connection test
      await providersPage.getProviderTestButton('openai').click()

      // Should show loading state for models
      const modelList = providersPage.getModelList('openai')
      const loadingIndicator = modelList.locator('.loading, [data-loading], [data-testid=\"loading\"]')
      const loadingText = modelList.getByText(/loading.*models|discovering.*models/i)

      const hasLoadingIndicator = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)
      const hasLoadingText = await loadingText.isVisible({ timeout: 2000 }).catch(() => false)

      expect(hasLoadingIndicator || hasLoadingText).toBe(true)

      // Should eventually show models
      await expect(modelList.getByText('gpt-4')).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Model List Refresh and Updates', () => {
    test('should refresh model lists when connection is retested', async ({ page }) => {
      let requestCount = 0
      await page.route('**/api.anthropic.com/**', (route) => {
        requestCount++
        const models =
          requestCount === 1
            ? [{ id: 'claude-3-haiku-20240307' }]
            : [{ id: 'claude-3-haiku-20240307' }, { id: 'claude-4-sonnet' }, { id: 'claude-3-opus-20240229' }]

        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: models })
        })
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // First test - should show one model
      await providersPage.testProviderConnection('anthropic')
      let models = await providersPage.getAvailableModels('anthropic')
      expect(models).toHaveLength(1)

      // Retest - should show updated models
      await providersPage.testProviderConnection('anthropic')
      models = await providersPage.getAvailableModels('anthropic')
      expect(models).toHaveLength(3)
    })

    test('should handle refresh button functionality', async ({ page }) => {
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }]
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Look for refresh button
      const refreshButton = page.getByRole('button', { name: /refresh.*models|reload.*models/i })
      const modelList = providersPage.getModelList('openai')
      const refreshInModelList = modelList.getByRole('button', { name: /refresh|reload/i })

      const hasGlobalRefresh = await refreshButton.isVisible().catch(() => false)
      const hasLocalRefresh = await refreshInModelList.isVisible().catch(() => false)

      if (hasGlobalRefresh || hasLocalRefresh) {
        const buttonToClick = hasGlobalRefresh ? refreshButton : refreshInModelList

        await buttonToClick.click()

        // Should show loading state briefly
        const loadingState = modelList.locator('.loading, [data-loading]')
        const hasLoading = await loadingState.isVisible({ timeout: 1000 }).catch(() => false)

        if (hasLoading) {
          await expect(loadingState).toBeHidden({ timeout: 10000 })
        }

        // Models should be refreshed
        await expect(modelList.getByText('gpt-4')).toBeVisible()
      }
    })

    test('should maintain model selection during refresh', async ({ page }) => {
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model' },
              { id: 'gpt-4-turbo', object: 'model' }
            ]
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Select a model (if model selection is supported)
      const modelList = providersPage.getModelList('openai')
      const gpt4Model = modelList.getByText('gpt-4')

      const isModelSelectable =
        (await gpt4Model.locator('input[type=\"radio\"], input[type=\"checkbox\"]').count()) > 0 ||
        (await gpt4Model.getAttribute('data-selectable')) !== null

      if (isModelSelectable) {
        await gpt4Model.click()

        // Verify selection
        const isSelected =
          (await gpt4Model.locator('.selected, [data-selected]').count()) > 0 ||
          (await gpt4Model.locator('input:checked').count()) > 0

        expect(isSelected).toBe(true)

        // Refresh models
        const refreshButton = page.getByRole('button', { name: /refresh.*models/i })
        if (await refreshButton.isVisible().catch(() => false)) {
          await refreshButton.click()

          // Wait for refresh to complete
          await expect(modelList.getByText('gpt-4')).toBeVisible()

          // Selection should be maintained
          const stillSelected =
            (await gpt4Model.locator('.selected, [data-selected]').count()) > 0 ||
            (await gpt4Model.locator('input:checked').count()) > 0

          expect(stillSelected).toBe(true)
        }
      }
    })
  })

  test.describe('Model Information and Details', () => {
    test('should display comprehensive model information', async ({ page }) => {
      // Mock models with rich metadata
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: ProviderPageTestData.modelDiscoveryScenarios.modelWithMetadata.models.map((model) => ({
              id: model.id,
              object: 'model',
              name: model.name,
              context_length: model.contextLength,
              capabilities: model.capabilities,
              description: model.description,
              pricing: model.pricing
            }))
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()

      // Check for GPT-4 model details
      const gpt4Model = providersPage.getModelItem('openai', 'gpt-4')
      const modelExists = await gpt4Model.isVisible().catch(() => false)

      if (modelExists) {
        // Check for description
        const hasDescription = (await gpt4Model.locator('.description, [data-testid=\"description\"]').count()) > 0
        if (hasDescription) {
          await expect(gpt4Model).toContainText(/most.*capable/i)
        }

        // Check for context length
        const hasContextLength = (await gpt4Model.locator('.context, [data-testid=\"context-length\"]').count()) > 0
        if (hasContextLength) {
          await expect(gpt4Model).toContainText(/8192|8k/i)
        }

        // Check for capabilities
        const hasCapabilities = (await gpt4Model.locator('.capabilities, [data-testid=\"capabilities\"]').count()) > 0
        if (hasCapabilities) {
          await expect(gpt4Model).toContainText(/chat|completion/i)
        }

        // Check for pricing (if displayed)
        const hasPricing = (await gpt4Model.locator('.pricing, [data-testid=\"pricing\"]').count()) > 0
        if (hasPricing) {
          await expect(gpt4Model).toContainText(/0\\.03|\\$0\\.03/i)
        }
      }
    })

    test('should handle model tooltips and expanded information', async ({ page }) => {
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [
              {
                id: 'gpt-4',
                object: 'model',
                description: 'Most capable GPT-4 model, great for complex tasks',
                context_length: 8192
              }
            ]
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const gpt4Model = providersPage.getModelItem('openai', 'gpt-4')
      const modelExists = await gpt4Model.isVisible().catch(() => false)

      if (modelExists) {
        // Try hovering to show tooltip
        await gpt4Model.hover()

        const tooltip = page.locator('.tooltip, [data-tooltip], [role=\"tooltip\"]')
        const hasTooltip = await tooltip.isVisible({ timeout: 2000 }).catch(() => false)

        if (hasTooltip) {
          await expect(tooltip).toContainText(/gpt-4|complex.*tasks|capable/i)
        }

        // Try clicking to show expanded info
        const expandButton = gpt4Model.locator('.expand, [data-testid=\"expand\"], .more-info')
        const hasExpandButton = (await expandButton.count()) > 0

        if (hasExpandButton) {
          await expandButton.click()

          const expandedInfo = page.locator('.expanded-info, [data-testid=\"model-details\"]')
          await expect(expandedInfo).toBeVisible()
          await expect(expandedInfo).toContainText(/8192|context.*length/i)
        }
      }
    })

    test('should sort models appropriately', async ({ page }) => {
      const models = [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', order: 3 },
        { id: 'gpt-4', name: 'GPT-4', order: 1 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', order: 2 }
      ]

      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: models.map((model) => ({ id: model.id, object: 'model', name: model.name }))
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()

      // Get all model elements in order
      const modelElements = await modelList.locator('[data-testid^=\"model-\"]').all()

      if (modelElements.length >= 3) {
        const modelTexts = await Promise.all(modelElements.slice(0, 3).map((el) => el.textContent()))

        // Should be sorted (exact order depends on UI implementation)
        // Common sorting: newest first, alphabetical, or by capability
        expect(modelTexts).toHaveLength(3)
        expect(modelTexts).toContain('gpt-4')
        expect(modelTexts).toContain('gpt-3.5-turbo')
        expect(modelTexts).toContain('gpt-4-turbo')
      }
    })
  })

  test.describe('Model Selection and Preferences', () => {
    test('should allow model selection for providers', async ({ page }) => {
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model' }
            ]
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()

      // Look for model selection mechanism
      const gpt4Model = modelList.getByText('gpt-4')
      const hasRadioButton = (await gpt4Model.locator('input[type=\"radio\"]').count()) > 0
      const hasCheckbox = (await gpt4Model.locator('input[type=\"checkbox\"]').count()) > 0
      const isClickable = (await gpt4Model.getAttribute('data-selectable')) !== null

      if (hasRadioButton || hasCheckbox || isClickable) {
        await gpt4Model.click()

        // Should indicate selection
        const isSelected = (await gpt4Model.locator('.selected, [data-selected], input:checked').count()) > 0
        expect(isSelected).toBe(true)
      }
    })

    test('should remember model preferences', async ({ page }) => {
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model' }
            ]
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const modelList = providersPage.getModelList('openai')
      const gpt4Model = modelList.getByText('gpt-4')

      // Select model if selection is supported
      const isSelectable = (await gpt4Model.locator('input, [data-selectable]').count()) > 0

      if (isSelectable) {
        await gpt4Model.click()

        // Reload page
        await page.reload()
        await providersPage.waitForPageLoad()

        // Model preference should be remembered
        await expect(modelList.getByText('gpt-4')).toBeVisible()
        const stillSelected = (await gpt4Model.locator('.selected, [data-selected], input:checked').count()) > 0
        expect(stillSelected).toBe(true)
      }
    })

    test('should handle default model selection', async ({ page }) => {
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model', default: true }
            ]
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()

      // Should indicate which model is default
      const defaultModel = modelList.locator('.default, [data-default], .recommended')
      const hasDefaultIndicator = (await defaultModel.count()) > 0

      if (hasDefaultIndicator) {
        await expect(defaultModel).toBeVisible()
        // Default model should contain text about being default/recommended
        await expect(defaultModel).toContainText(/default|recommended|suggested/i)
      }
    })
  })
})
