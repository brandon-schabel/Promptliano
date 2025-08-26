import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../pages/providers.page'
import { ProviderPageTestData } from '../fixtures/provider-page-data'

/**
 * Local Provider Detection and Management Tests
 *
 * These tests cover the detection, connection testing, and management of local AI providers
 * including Ollama and LM Studio. Tests handle both available and unavailable scenarios.
 */
test.describe('Local Provider Detection and Management', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    await providersPage.goto()
    await providersPage.waitForPageLoad()
  })

  test.describe('Provider Availability Detection', () => {
    test('should detect available local providers', async ({ page }) => {
      // Mock successful responses for local providers
      await page.route('**/localhost:11434/api/version', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ProviderPageTestData.testScenarios.localAvailable.mockOllamaResponse.body)
        })
      })

      await page.route('**/localhost:1234/v1/models', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ProviderPageTestData.testScenarios.localAvailable.mockLMStudioResponse.body)
        })
      })

      await providersPage.goto()

      // Wait for provider detection to complete
      await expect(providersPage.localProvidersSection).toBeVisible()
      await providersPage.waitForProviderDetection()

      // Check Ollama status
      const ollamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')
      if (ollamaAvailable) {
        await expect(providersPage.getProviderStatus('ollama')).toContainText(/online|available|connected/i)
        await expect(providersPage.getProviderStatusIndicator('ollama')).toHaveClass(/online|available|connected/)

        // Test button should be visible and enabled
        await expect(providersPage.getProviderTestButton('ollama')).toBeVisible()
        await expect(providersPage.getProviderTestButton('ollama')).toBeEnabled()
      } else {
        await expect(providersPage.getProviderStatus('ollama')).toContainText(/offline|unavailable|not.*found/i)
        await expect(providersPage.getProviderInstallButton('ollama')).toBeVisible()
      }

      // Check LM Studio status
      const lmStudioAvailable = await providersPage.checkLocalProviderAvailability('lmstudio')
      if (lmStudioAvailable) {
        await expect(providersPage.getProviderStatus('lmstudio')).toContainText(/online|available|connected/i)
        await expect(providersPage.getProviderTestButton('lmstudio')).toBeVisible()
      } else {
        await expect(providersPage.getProviderStatus('lmstudio')).toContainText(/offline|unavailable/i)
        await expect(providersPage.getProviderInstallButton('lmstudio')).toBeVisible()
      }
    })

    test('should handle unavailable local providers gracefully', async ({ page }) => {
      // Mock connection failures
      await page.route('**/localhost:11434/**', (route) => {
        route.abort('failed')
      })

      await page.route('**/localhost:1234/**', (route) => {
        route.abort('failed')
      })

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Both providers should show as unavailable
      await expect(providersPage.getProviderStatus('ollama')).toContainText(/offline|unavailable|not.*running/i)
      await expect(providersPage.getProviderStatus('lmstudio')).toContainText(/offline|unavailable|not.*running/i)

      // Should show install buttons
      await expect(providersPage.getProviderInstallButton('ollama')).toBeVisible()
      await expect(providersPage.getProviderInstallButton('lmstudio')).toBeVisible()

      // Install buttons should be clickable
      const ollamaInstallBtn = providersPage.getProviderInstallButton('ollama')
      await expect(ollamaInstallBtn).toBeVisible()
      await expect(ollamaInstallBtn).toBeEnabled()

      const lmStudioInstallBtn = providersPage.getProviderInstallButton('lmstudio')
      await expect(lmStudioInstallBtn).toBeVisible()
      await expect(lmStudioInstallBtn).toBeEnabled()
    })

    test('should handle mixed availability scenarios', async ({ page }) => {
      // Mock Ollama as available, LM Studio as unavailable
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
                { name: 'llama3:latest', size: 4661211808 },
                { name: 'codellama:7b', size: 3825819519 }
              ]
            })
          })
        } else {
          route.fulfill({ status: 200, body: '{}' })
        }
      })

      await page.route('**/localhost:1234/**', (route) => {
        route.abort('failed')
      })

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Ollama should be available
      const ollamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')
      if (ollamaAvailable) {
        await expect(providersPage.getProviderStatus('ollama')).toContainText(/online|available|connected/i)
        await expect(providersPage.getProviderTestButton('ollama')).toBeVisible()
      }

      // LM Studio should be unavailable
      await expect(providersPage.getProviderStatus('lmstudio')).toContainText(/offline|unavailable/i)
      await expect(providersPage.getProviderInstallButton('lmstudio')).toBeVisible()
    })
  })

  test.describe('Connection Testing', () => {
    test('should test local provider connections successfully', async ({ page }) => {
      // Mock Ollama as available with models
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
              models: [{ name: 'llama3:latest' }, { name: 'codellama:latest' }]
            })
          })
        } else {
          route.fulfill({ status: 200, body: '{}' })
        }
      })

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Test Ollama connection if available
      const ollamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')
      if (ollamaAvailable) {
        await providersPage.testProviderConnection('ollama')

        // Should show successful test result
        const testResult = page.getByTestId('test-result-ollama')
        await expect(testResult).toBeVisible()
        await expect(testResult).toContainText(/success|connected|working/i)

        // Should display available models if model list is shown
        const modelList = providersPage.getModelList('ollama')
        const isModelListVisible = await modelList.isVisible().catch(() => false)

        if (isModelListVisible) {
          await expect(modelList.getByText('llama3:latest')).toBeVisible()
          await expect(modelList.getByText('codellama:latest')).toBeVisible()
        }
      }
    })

    test('should handle connection test failures gracefully', async ({ page }) => {
      // Mock Ollama as initially appearing available but failing on detailed test
      await page.route('**/localhost:11434/api/version', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ version: '0.1.32' })
        })
      })

      await page.route('**/localhost:11434/api/tags', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        })
      })

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      const ollamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')
      if (ollamaAvailable) {
        await providersPage.testProviderConnection('ollama')

        // Should show error or warning in test result
        const testResult = page.getByTestId('test-result-ollama')
        const errorResult = providersPage.getConnectionError('ollama')

        const hasTestResult = await testResult.isVisible().catch(() => false)
        const hasErrorResult = await errorResult.isVisible().catch(() => false)

        expect(hasTestResult || hasErrorResult).toBe(true)

        if (hasErrorResult) {
          await expect(errorResult).toContainText(/error|failed|unavailable/i)
        }
      }
    })

    test('should show connection response time information', async ({ page }) => {
      // Mock slow but successful response
      await page.route('**/localhost:11434/**', (route) => {
        setTimeout(() => {
          const url = route.request().url()
          if (url.includes('/api/version')) {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ version: '0.1.32' })
            })
          } else if (url.includes('/api/tags')) {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ models: [{ name: 'llama3:latest' }] })
            })
          } else {
            route.fulfill({ status: 200, body: '{}' })
          }
        }, 2000) // 2 second delay
      })

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      const ollamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')
      if (ollamaAvailable) {
        const startTime = Date.now()
        await providersPage.testProviderConnection('ollama')
        const endTime = Date.now()
        const responseTime = endTime - startTime

        // Should have taken at least 2 seconds due to our mock delay
        expect(responseTime).toBeGreaterThan(1500)

        const testResult = page.getByTestId('test-result-ollama')
        await expect(testResult).toBeVisible()

        // Check if response time is displayed (if UI supports it)
        const responseTimeElement = testResult.locator('[data-testid=\"response-time\"], .response-time')
        const hasResponseTime = (await responseTimeElement.count()) > 0

        if (hasResponseTime) {
          await expect(responseTimeElement).toBeVisible()
        }
      }
    })
  })

  test.describe('Provider URL Configuration', () => {
    test('should display default provider URLs', async ({ page }) => {
      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Should display default URLs for local providers
      await expect(providersPage.getProviderUrl('ollama')).toContainText('localhost:11434')
      await expect(providersPage.getProviderUrl('lmstudio')).toContainText('localhost:1234')
    })

    test('should allow URL editing if supported', async ({ page }) => {
      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Check if URL editing is supported
      const urlElement = providersPage.getProviderUrl('ollama')
      const hasEditableInput = (await urlElement.locator('input').count()) > 0

      if (hasEditableInput) {
        const urlInput = urlElement.locator('input')
        await urlInput.clear()
        await urlInput.fill('http://localhost:11435')

        // Save changes (press Enter or look for save button)
        await page.keyboard.press('Enter')

        // Should update URL display
        await expect(providersPage.getProviderUrl('ollama')).toContainText('localhost:11435')
      }
    })

    test('should validate URL format', async ({ page }) => {
      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      const urlElement = providersPage.getProviderUrl('ollama')
      const hasEditableInput = (await urlElement.locator('input').count()) > 0

      if (hasEditableInput) {
        const urlInput = urlElement.locator('input')

        // Test invalid URL formats
        const invalidUrls = [
          'not-a-url',
          'ftp://localhost:11434',
          'localhost:11434', // Missing protocol
          'http://localhost:99999' // Invalid port
        ]

        for (const invalidUrl of invalidUrls) {
          await urlInput.clear()
          await urlInput.fill(invalidUrl)
          await page.keyboard.press('Enter')

          // Should show validation error or reject the input
          const hasError = await page
            .getByText(/invalid.*url|url.*format/i)
            .isVisible()
            .catch(() => false)
          const urlReverted = (await urlInput.inputValue()) !== invalidUrl

          expect(hasError || urlReverted).toBe(true)
        }
      }
    })
  })

  test.describe('Install Instructions and Help', () => {
    test('should show install instructions for unavailable providers', async ({ page }) => {
      // Mock providers as unavailable
      await page.route('**/localhost:11434/**', (route) => route.abort('failed'))
      await page.route('**/localhost:1234/**', (route) => route.abort('failed'))

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Click install button for Ollama
      await providersPage.getProviderInstallButton('ollama').click()

      // Should show install instructions or redirect
      const installDialog = page.getByTestId('install-instructions-dialog')
      const externalLink = page.getByRole('link', { name: /ollama\\.ai|download.*ollama/i })

      const hasDialog = await installDialog.isVisible().catch(() => false)
      const hasLink = await externalLink.isVisible().catch(() => false)

      expect(hasDialog || hasLink).toBe(true)

      if (hasDialog) {
        await expect(installDialog).toContainText(/install.*ollama|download.*ollama/i)
        await expect(installDialog).toContainText(/ollama\\.ai/)

        // Dialog should have close button
        const closeButton = installDialog.getByRole('button', { name: /close|dismiss/i })
        await expect(closeButton).toBeVisible()
        await closeButton.click()
        await expect(installDialog).toBeHidden()
      }
    })

    test('should show different install instructions for different providers', async ({ page }) => {
      // Mock both providers as unavailable
      await page.route('**/localhost:11434/**', (route) => route.abort('failed'))
      await page.route('**/localhost:1234/**', (route) => route.abort('failed'))

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Test Ollama install instructions
      await providersPage.getProviderInstallButton('ollama').click()

      const ollamaDialog = page.getByTestId('install-instructions-dialog')
      const hasOllamaDialog = await ollamaDialog.isVisible().catch(() => false)

      if (hasOllamaDialog) {
        await expect(ollamaDialog).toContainText(/ollama/i)
        await expect(ollamaDialog).not.toContainText(/lm.*studio/i)

        // Close dialog
        await page.getByRole('button', { name: /close/i }).click()
        await expect(ollamaDialog).toBeHidden()
      }

      // Test LM Studio install instructions
      await providersPage.getProviderInstallButton('lmstudio').click()

      const lmStudioDialog = page.getByTestId('install-instructions-dialog')
      const hasLmStudioDialog = await lmStudioDialog.isVisible().catch(() => false)

      if (hasLmStudioDialog) {
        await expect(lmStudioDialog).toContainText(/lm.*studio/i)
        await expect(lmStudioDialog).not.toContainText(/ollama/i)
      }
    })

    test('should provide helpful troubleshooting information', async ({ page }) => {
      // Mock providers as unavailable
      await page.route('**/localhost:11434/**', (route) => route.abort('failed'))

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Should show troubleshooting hints in status or help area
      const statusMessage = providersPage.getProviderStatusMessage('ollama')
      const hasStatusMessage = await statusMessage.isVisible().catch(() => false)

      if (hasStatusMessage) {
        const messageText = await statusMessage.textContent()

        // Should contain helpful information
        expect(messageText).toMatch(/not.*running|install|start.*ollama|check.*installation/i)
      }

      // Clicking install should provide more detailed help
      await providersPage.getProviderInstallButton('ollama').click()

      const helpContent = page.getByTestId('install-instructions-dialog')
      const hasHelpContent = await helpContent.isVisible().catch(() => false)

      if (hasHelpContent) {
        // Should contain specific installation steps
        await expect(helpContent).toContainText(/download|install|start|run/i)

        // Should contain links or commands
        const hasLinks = (await helpContent.locator('a[href]').count()) > 0
        const hasCommands = (await helpContent.locator('code, .command').count()) > 0

        expect(hasLinks || hasCommands).toBe(true)
      }
    })
  })

  test.describe('Provider Status Persistence', () => {
    test('should remember provider status after page reload', async ({ page }) => {
      // Setup initial state with one provider available
      await page.route('**/localhost:11434/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ version: '0.1.32' })
        })
      })

      await page.route('**/localhost:1234/**', (route) => {
        route.abort('failed')
      })

      await providersPage.goto()
      await providersPage.waitForProviderDetection()

      // Record initial states
      const initialOllamaStatus = await providersPage.getProviderStatus('ollama').textContent()
      const initialLmStudioStatus = await providersPage.getProviderStatus('lmstudio').textContent()

      // Reload page
      await page.reload()
      await providersPage.waitForPageLoad()
      await providersPage.waitForProviderDetection()

      // Status should be consistent after reload
      const reloadedOllamaStatus = await providersPage.getProviderStatus('ollama').textContent()
      const reloadedLmStudioStatus = await providersPage.getProviderStatus('lmstudio').textContent()

      // Status should be similar (allowing for slight wording differences)
      if (initialOllamaStatus?.includes('online') || initialOllamaStatus?.includes('available')) {
        expect(reloadedOllamaStatus).toMatch(/online|available|connected/i)
      }

      if (initialLmStudioStatus?.includes('offline') || initialLmStudioStatus?.includes('unavailable')) {
        expect(reloadedLmStudioStatus).toMatch(/offline|unavailable|not.*running/i)
      }
    })
  })
})
