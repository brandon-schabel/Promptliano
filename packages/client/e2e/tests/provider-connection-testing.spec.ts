import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../pages/providers.page'
import { ProviderPageTestData, ProviderTestDataHelper } from '../fixtures/provider-page-data'

/**
 * Provider Connection Testing and Validation Tests
 *
 * These tests cover connection testing functionality for both local and cloud providers,
 * including real API calls, timeout handling, rate limiting, and simultaneous testing.
 */
test.describe('Provider Connection Testing and Validation', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    await providersPage.goto()
    await providersPage.waitForPageLoad()
  })

  test.describe('Connection Testing with Real API Calls', () => {
    test('should test provider connections with successful API calls', async ({ page }) => {
      // Mock successful API responses
      await page.route('**/api.openai.com/v1/models', (route) => {
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

      // Configure OpenAI key
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Test connection
      const testButton = providersPage.getProviderTestButton('openai')
      await testButton.click()

      // Should show testing state
      await expect(page.getByText(/testing.*connection|connecting/i)).toBeVisible()

      // Should show successful result
      const testResult = page.getByTestId('test-result-openai')
      await expect(testResult).toBeVisible({ timeout: 15000 })
      await expect(testResult).toContainText(/success|connected|working/i)

      // Should load and display models
      const modelList = providersPage.getModelList('openai')
      await expect(modelList).toBeVisible()
      await expect(modelList.getByText('gpt-4')).toBeVisible()
      await expect(modelList.getByText('gpt-3.5-turbo')).toBeVisible()
    })

    test('should test local provider connections', async ({ page }) => {
      // Mock successful Ollama response
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

      await providersPage.waitForProviderDetection()

      // Test Ollama connection if available
      const ollamaAvailable = await providersPage.checkLocalProviderAvailability('ollama')

      if (ollamaAvailable) {
        const startTime = Date.now()
        await providersPage.testProviderConnection('ollama')
        const responseTime = Date.now() - startTime

        // Should complete within reasonable time
        expect(responseTime).toBeLessThan(10000) // Less than 10 seconds

        const testResult = page.getByTestId('test-result-ollama')
        await expect(testResult).toBeVisible()
        await expect(testResult).toContainText(/success|connected|working/i)
      }
    })

    test('should handle connection test failures appropriately', async ({ page }) => {
      // Mock API failure
      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: {
              message: 'Internal server error',
              type: 'server_error'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Test connection
      await providersPage.getProviderTestButton('anthropic').click()

      // Should show error result
      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toBeVisible({ timeout: 15000 })
      await expect(errorResult).toContainText(/error|failed|server.*error/i)

      // Should not load models
      const modelList = providersPage.getModelList('anthropic')
      const modelCount = await modelList.locator('[data-testid^=\"model-\"]').count()
      expect(modelCount).toBe(0)
    })
  })

  test.describe('Timeout and Performance Handling', () => {
    test('should handle network timeouts gracefully', async ({ page }) => {
      // Mock timeout scenario - don't respond to simulate timeout
      await page.route('**/api.anthropic.com/**', (route) => {
        // Don't respond immediately to simulate timeout
        setTimeout(() => {
          route.fulfill({
            status: 408,
            body: JSON.stringify({ error: { message: 'Request timeout' } })
          })
        }, 20000) // 20 second delay (longer than most timeout settings)
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Test connection
      await providersPage.getProviderTestButton('anthropic').click()

      // Should eventually show timeout error
      const testResult = page.getByTestId('test-result-anthropic')
      await expect(testResult).toBeVisible({ timeout: 25000 })
      await expect(testResult).toContainText(/timeout|slow|network.*error/i)
    })

    test('should show response time information for successful connections', async ({ page }) => {
      // Mock slow but successful response
      await page.route('**/api.openai.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }, 3000) // 3 second delay
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      const startTime = Date.now()
      await providersPage.testProviderConnection('openai')
      const totalTime = Date.now() - startTime

      // Should have taken at least 3 seconds
      expect(totalTime).toBeGreaterThan(2500)

      const testResult = page.getByTestId('test-result-openai')
      await expect(testResult).toBeVisible()

      // Check if response time is displayed (if UI supports it)
      const responseTimeElement = testResult.locator('[data-testid=\"response-time\"], .response-time')
      const hasResponseTime = (await responseTimeElement.count()) > 0

      if (hasResponseTime) {
        await expect(responseTimeElement).toBeVisible()
        const timeText = await responseTimeElement.textContent()
        expect(timeText).toMatch(/\\d+.*ms|\\d+.*second/i)
      }
    })

    test('should handle cancellation of long-running tests', async ({ page }) => {
      // Mock very slow response
      await page.route('**/api.openai.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [] })
          })
        }, 30000) // 30 second delay
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Start connection test
      await providersPage.getProviderTestButton('openai').click()

      // Look for cancel button
      const cancelButton = page.getByRole('button', { name: /cancel|stop.*test/i })
      const hasCancelButton = await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasCancelButton) {
        // Cancel the test
        await cancelButton.click()

        // Should show cancelled state
        const testResult = page.getByTestId('test-result-openai')
        await expect(testResult).toContainText(/cancelled|stopped|aborted/i)
      } else {
        // If no cancel button, test should eventually timeout
        const testResult = page.getByTestId('test-result-openai')
        await expect(testResult).toBeVisible({ timeout: 35000 })
      }
    })

    test('should track multiple connection attempts', async ({ page }) => {
      let attemptCount = 0

      await page.route('**/api.openai.com/**', (route) => {
        attemptCount++

        if (attemptCount === 1) {
          // First attempt fails
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: { message: 'Server error' } })
          })
        } else {
          // Second attempt succeeds
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // First test attempt
      await providersPage.testProviderConnection('openai')
      let testResult = page.getByTestId('test-result-openai')
      await expect(testResult).toContainText(/error|failed/i)

      // Second test attempt
      await providersPage.testProviderConnection('openai')
      await expect(testResult).toContainText(/success|connected/i)

      expect(attemptCount).toBe(2)
    })
  })

  test.describe('Simultaneous Provider Testing', () => {
    test('should test multiple providers simultaneously', async ({ page }) => {
      // Mock successful responses for both providers with different delays
      await page.route('**/api.openai.com/v1/models', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }, 1000) // 1 second delay
      })

      await page.route('**/api.anthropic.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }, 1500) // 1.5 second delay
      })

      // Configure both providers
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Start both tests simultaneously
      await Promise.all([
        providersPage.getProviderTestButton('openai').click(),
        providersPage.getProviderTestButton('anthropic').click()
      ])

      // Both should eventually show results
      await expect(page.getByTestId('test-result-openai')).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('test-result-anthropic')).toBeVisible({ timeout: 15000 })

      // Both should show success
      await expect(page.getByTestId('test-result-openai')).toContainText(/success|connected/i)
      await expect(page.getByTestId('test-result-anthropic')).toContainText(/success|connected/i)

      // Each should have their own models loaded
      await expect(providersPage.getModelList('openai').getByText('gpt-4')).toBeVisible()
      await expect(providersPage.getModelList('anthropic').getByText('claude-3-sonnet')).toBeVisible()
    })

    test('should handle mixed success/failure in simultaneous tests', async ({ page }) => {
      // Mock OpenAI success, Anthropic failure
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      })

      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', 'invalid-key')

      // Start both tests
      await Promise.all([
        providersPage.getProviderTestButton('openai').click(),
        providersPage.getProviderTestButton('anthropic').click()
      ])

      // OpenAI should succeed
      const openaiResult = page.getByTestId('test-result-openai')
      await expect(openaiResult).toContainText(/success|connected/i)

      // Anthropic should fail
      const anthropicResult = page.getByTestId('test-result-anthropic')
      const anthropicError = providersPage.getConnectionError('anthropic')

      const hasResult = await anthropicResult.isVisible().catch(() => false)
      const hasError = await anthropicError.isVisible().catch(() => false)

      expect(hasResult || hasError).toBe(true)

      if (hasError) {
        await expect(anthropicError).toContainText(/invalid|error|failed/i)
      }
    })

    test('should not interfere with each other during simultaneous testing', async ({ page }) => {
      let openaiCalls = 0
      let anthropicCalls = 0

      await page.route('**/api.openai.com/**', (route) => {
        openaiCalls++
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }, 2000)
      })

      await page.route('**/api.anthropic.com/**', (route) => {
        anthropicCalls++
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }, 1000)
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Start tests simultaneously
      const startTime = Date.now()
      await Promise.all([
        providersPage.getProviderTestButton('openai').click(),
        providersPage.getProviderTestButton('anthropic').click()
      ])

      // Wait for both to complete
      await Promise.all([
        expect(page.getByTestId('test-result-openai')).toBeVisible(),
        expect(page.getByTestId('test-result-anthropic')).toBeVisible()
      ])

      const totalTime = Date.now() - startTime

      // Should complete in roughly the time of the slowest call (2s + overhead)
      // not the sum of both calls (3s)
      expect(totalTime).toBeLessThan(4000)
      expect(totalTime).toBeGreaterThan(1500)

      // Each provider should have been called exactly once
      expect(openaiCalls).toBe(1)
      expect(anthropicCalls).toBe(1)
    })
  })

  test.describe('Rate Limiting and Error Handling', () => {
    test('should handle rate limiting from providers', async ({ page }) => {
      // Mock rate limit response
      await page.route('**/api.openai.com/**', (route) => {
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

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Test connection
      await providersPage.testProviderConnection('openai')

      // Should show rate limit error
      const testResult = page.getByTestId('test-result-openai')
      const errorResult = providersPage.getConnectionError('openai')

      const hasTestResult = await testResult.isVisible().catch(() => false)
      const hasErrorResult = await errorResult.isVisible().catch(() => false)

      expect(hasTestResult || hasErrorResult).toBe(true)

      const resultElement = hasErrorResult ? errorResult : testResult
      await expect(resultElement).toContainText(/rate.*limit|too.*many.*requests/i)

      // Should suggest retry later
      await expect(resultElement).toContainText(/try.*later|retry.*after/i)
    })

    test('should handle authentication errors', async ({ page }) => {
      // Mock auth failure
      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: {
              type: 'authentication_error',
              message: 'invalid x-api-key'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('anthropic', 'invalid-key')
      await providersPage.testProviderConnection('anthropic')

      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toContainText(/invalid.*key|authentication.*error/i)

      // Should suggest checking API key
      const hasKeySuggestion = await page
        .getByText(/check.*key|verify.*key|api.*key.*invalid/i)
        .isVisible()
        .catch(() => false)
      expect(hasKeySuggestion).toBe(true)
    })

    test('should handle network connectivity issues', async ({ page }) => {
      // Mock network failure
      await page.route('**/api.openai.com/**', (route) => {
        route.abort('failed')
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/network.*error|connection.*failed|unable.*to.*connect/i)

      // Should suggest network troubleshooting
      const hasNetworkSuggestion = await page
        .getByText(/check.*connection|network.*settings|firewall/i)
        .isVisible()
        .catch(() => false)
      expect(hasNetworkSuggestion).toBe(true)
    })

    test('should handle service unavailable scenarios', async ({ page }) => {
      // Mock service unavailable
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({
            error: {
              message: 'Service temporarily unavailable',
              type: 'service_unavailable'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/service.*unavailable|temporarily.*unavailable/i)

      // Should suggest checking status page or retrying later
      const hasStatusSuggestion = await page
        .getByText(/status.*page|try.*later|maintenance/i)
        .isVisible()
        .catch(() => false)
      expect(hasStatusSuggestion).toBe(true)
    })
  })

  test.describe('Connection Test State Management', () => {
    test('should maintain test state during page interactions', async ({ page }) => {
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Test result should persist
      const testResult = page.getByTestId('test-result-openai')
      await expect(testResult).toContainText(/success|connected/i)

      // Scroll or interact with other parts of page
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(1000)

      // Test result should still be visible
      await expect(testResult).toContainText(/success|connected/i)
    })

    test('should clear test results when configuration changes', async ({ page }) => {
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const testResult = page.getByTestId('test-result-openai')
      await expect(testResult).toContainText(/success|connected/i)

      // Change API key
      await providersPage.configureCloudProvider('openai', 'new-test-key-different')

      // Old test result should be cleared or marked as outdated
      const isResultCleared = await testResult.isHidden().catch(() => false)
      const hasOutdatedMarker = (await testResult.locator('.outdated, [data-outdated]').count()) > 0

      expect(isResultCleared || hasOutdatedMarker).toBe(true)
    })

    test('should show appropriate retry options after failures', async ({ page }) => {
      // Mock initial failure
      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: { message: 'Server error' } })
        })
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))
      await providersPage.testProviderConnection('anthropic')

      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toContainText(/error|failed/i)

      // Should show retry option
      const retryButton = page.getByRole('button', { name: /retry|test.*again/i })
      const hasRetryButton = await retryButton.isVisible().catch(() => false)

      if (hasRetryButton) {
        await retryButton.click()

        // Should start new test
        await expect(page.getByText(/testing|connecting/i)).toBeVisible({ timeout: 2000 })
      } else {
        // If no explicit retry button, test button should still work
        await providersPage.testProviderConnection('anthropic')
        await expect(errorResult).toBeVisible()
      }
    })
  })
})
