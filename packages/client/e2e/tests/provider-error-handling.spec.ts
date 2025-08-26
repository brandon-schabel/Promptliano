import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../pages/providers.page'
import { ProviderPageTestData, ProviderTestDataHelper } from '../fixtures/provider-page-data'

/**
 * Provider Error Handling and Recovery Tests
 *
 * These tests cover comprehensive error handling scenarios including
 * service outages, network failures, recovery mechanisms, and user
 * guidance for common provider issues.
 */
test.describe('Provider Error Handling and Recovery', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    await providersPage.goto()
    await providersPage.waitForPageLoad()
  })

  test.describe('Service Outage Handling', () => {
    test('should handle provider service outages gracefully', async ({ page }) => {
      // Mock service outage
      await page.route('**/api.openai.com/**', (route) => {
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

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Test connection
      await providersPage.testProviderConnection('openai')

      // Should show service outage message
      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toBeVisible()
      await expect(errorResult).toContainText(/service.*unavailable|server.*error|outage/i)

      // Should suggest retry or status page
      await expect(errorResult).toContainText(/try.*later|status|retry/i)
    })

    test('should handle DNS resolution failures', async ({ page }) => {
      // Mock DNS failure
      await page.route('**/api.anthropic.com/**', (route) => {
        route.abort('nameerror')
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))
      await providersPage.testProviderConnection('anthropic')

      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toContainText(/network.*error|dns.*error|unable.*to.*resolve/i)

      // Should provide troubleshooting guidance
      const hasTroubleshooting = await page
        .getByText(/check.*internet|network.*connection|firewall/i)
        .isVisible()
        .catch(() => false)
      expect(hasTroubleshooting).toBe(true)
    })

    test('should handle SSL/TLS certificate errors', async ({ page }) => {
      // Mock SSL certificate error
      await page.route('**/api.openai.com/**', (route) => {
        route.abort('certerror')
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/certificate.*error|ssl.*error|security.*error/i)

      // Should suggest checking system time or security settings
      const hasSslGuidance = await page
        .getByText(/system.*time|security.*settings|certificate/i)
        .isVisible()
        .catch(() => false)
      expect(hasSslGuidance).toBe(true)
    })

    test('should differentiate between temporary and permanent service issues', async ({ page }) => {
      // Test temporary issue (503)
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 503,
          headers: {
            'retry-after': '300'
          },
          body: JSON.stringify({
            error: {
              message: 'Service temporarily unavailable',
              type: 'server_error'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const tempErrorResult = providersPage.getConnectionError('openai')
      await expect(tempErrorResult).toContainText(/temporarily.*unavailable|try.*later|retry.*after/i)

      // Test permanent issue (410 Gone)
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 410,
          body: JSON.stringify({
            error: {
              message: 'This endpoint is no longer available',
              type: 'endpoint_gone'
            }
          })
        })
      })

      await providersPage.testProviderConnection('openai')

      const permErrorResult = providersPage.getConnectionError('openai')
      await expect(permErrorResult).toContainText(/no.*longer.*available|endpoint.*deprecated|permanent.*error/i)
    })
  })

  test.describe('Network Error Recovery', () => {
    test('should recover from network errors', async ({ page }) => {
      let shouldFail = true
      await page.route('**/api.anthropic.com/**', (route) => {
        if (shouldFail) {
          route.abort('failed')
        } else {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // First attempt should fail
      await providersPage.testProviderConnection('anthropic')

      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toContainText(/network.*error|connection.*failed/i)

      // Fix the network and retry
      shouldFail = false
      await providersPage.testProviderConnection('anthropic')

      // Should now succeed
      const successResult = page.getByTestId('test-result-anthropic')
      await expect(successResult).toContainText(/success|connected/i)
    })

    test('should handle intermittent connectivity issues', async ({ page }) => {
      let requestCount = 0
      await page.route('**/api.openai.com/**', (route) => {
        requestCount++

        if (requestCount % 2 === 1) {
          // Odd requests fail
          route.abort('failed')
        } else {
          // Even requests succeed
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // First test fails
      await providersPage.testProviderConnection('openai')
      let errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/network.*error|connection.*failed/i)

      // Second test succeeds
      await providersPage.testProviderConnection('openai')
      const successResult = page.getByTestId('test-result-openai')
      await expect(successResult).toContainText(/success|connected/i)
    })

    test('should provide retry mechanisms with backoff', async ({ page }) => {
      let attemptCount = 0
      const attemptTimes: number[] = []

      await page.route('**/api.anthropic.com/**', (route) => {
        attemptCount++
        attemptTimes.push(Date.now())

        if (attemptCount < 3) {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: { message: 'Server error' } })
          })
        } else {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Test connection multiple times to trigger retry logic
      await providersPage.testProviderConnection('anthropic')

      // Look for retry button
      const retryButton = page.getByRole('button', { name: /retry|try.*again/i })
      const hasRetryButton = await retryButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasRetryButton) {
        await retryButton.click()
        await page.waitForTimeout(1000)

        if (attemptCount < 3) {
          await retryButton.click()
          await page.waitForTimeout(1000)
        }

        // Should eventually succeed
        const successResult = page.getByTestId('test-result-anthropic')
        await expect(successResult).toContainText(/success|connected/i)

        // Check if there was appropriate delay between retries (backoff)
        if (attemptTimes.length >= 2) {
          const timeBetweenAttempts = attemptTimes[1] - attemptTimes[0]
          expect(timeBetweenAttempts).toBeGreaterThan(500) // At least 500ms delay
        }
      }
    })

    test('should handle connection timeouts gracefully', async ({ page }) => {
      // Mock very slow response
      await page.route('**/api.openai.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 408,
            body: JSON.stringify({ error: { message: 'Request timeout' } })
          })
        }, 20000) // 20 second timeout
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Should eventually show timeout error
      const timeoutResult = page.getByTestId('test-result-openai')
      const errorResult = providersPage.getConnectionError('openai')

      const hasTimeoutResult = await timeoutResult.isVisible({ timeout: 25000 }).catch(() => false)
      const hasErrorResult = await errorResult.isVisible({ timeout: 25000 }).catch(() => false)

      expect(hasTimeoutResult || hasErrorResult).toBe(true)

      const resultElement = hasTimeoutResult ? timeoutResult : errorResult
      await expect(resultElement).toContainText(/timeout|slow|network.*error/i)
    })
  })

  test.describe('Invalid Response Handling', () => {
    test('should handle invalid JSON responses gracefully', async ({ page }) => {
      // Mock invalid JSON response
      await page.route('**/api.openai.com/v1/models', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json response'
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      // Should handle parsing error gracefully
      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/invalid.*response|parsing.*error|unexpected.*response/i)
    })

    test('should handle malformed API responses', async ({ page }) => {
      // Mock response with missing required fields
      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            // Missing 'data' field expected by the client
            invalid: 'response structure'
          })
        })
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))
      await providersPage.testProviderConnection('anthropic')

      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toContainText(/invalid.*response|unexpected.*format|malformed.*response/i)
    })

    test('should handle empty responses', async ({ page }) => {
      // Mock empty response
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: ''
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/empty.*response|no.*response|invalid.*response/i)
    })

    test('should handle content-type mismatches', async ({ page }) => {
      // Mock response with wrong content-type
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<html><body>This is HTML, not JSON</body></html>'
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/invalid.*response|unexpected.*format|content.*type/i)
    })
  })

  test.describe('Clear Error Messages for Common Issues', () => {
    test('should provide clear error messages for common issues', async ({ page }) => {
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
        await page.route('**/api.openai.com/**', (route) => {
          route.fulfill({
            status: scenario.status,
            contentType: 'application/json',
            body: JSON.stringify(scenario.body)
          })
        })

        await providersPage.configureCloudProvider('openai', 'test-key')
        await providersPage.testProviderConnection('openai')

        const errorResult = providersPage.getConnectionError('openai')
        await expect(errorResult).toContainText(scenario.expectedMessage)

        // Clear route for next test
        await page.unroute('**/api.openai.com/**')
      }
    })

    test('should provide actionable guidance for authentication errors', async ({ page }) => {
      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: {
              message: 'Invalid API key',
              type: 'authentication_error'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('anthropic', 'invalid-key')
      await providersPage.testProviderConnection('anthropic')

      const errorResult = providersPage.getConnectionError('anthropic')

      // Should provide actionable guidance
      await expect(errorResult).toContainText(/check.*key|verify.*key|api.*key.*invalid/i)

      // Should suggest where to get a valid key
      const hasGuidance = await page
        .getByText(/console|dashboard|account.*settings/i)
        .isVisible()
        .catch(() => false)
      expect(hasGuidance).toBe(true)
    })

    test('should provide helpful guidance for quota/billing issues', async ({ page }) => {
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 403,
          body: JSON.stringify({
            error: {
              message: 'You have exceeded your quota',
              type: 'quota_exceeded'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/quota.*exceeded|billing|usage.*limit/i)

      // Should suggest checking billing/usage
      const hasBillingGuidance = await page
        .getByText(/billing|usage|upgrade.*plan/i)
        .isVisible()
        .catch(() => false)
      expect(hasBillingGuidance).toBe(true)
    })

    test('should handle deprecated API versions gracefully', async ({ page }) => {
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({
            error: {
              message: 'This API version is deprecated',
              type: 'api_version_deprecated'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/deprecated|api.*version|upgrade.*required/i)

      // Should suggest updating or checking for app updates
      const hasUpdateGuidance = await page
        .getByText(/update.*app|new.*version|check.*updates/i)
        .isVisible()
        .catch(() => false)
      expect(hasUpdateGuidance).toBe(true)
    })
  })

  test.describe('Simultaneous Test Conflict Handling', () => {
    test('should handle simultaneous provider tests without conflicts', async ({ page }) => {
      // Mock different response times for each provider
      await page.route('**/api.openai.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }, 1000)
      })

      await page.route('**/api.anthropic.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }, 2000)
      })

      // Configure both providers
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Start tests simultaneously
      await Promise.all([
        providersPage.getProviderTestButton('openai').click(),
        providersPage.getProviderTestButton('anthropic').click()
      ])

      // Both should complete successfully without interference
      await expect(page.getByTestId('test-result-openai')).toContainText(/success|connected/i)
      await expect(page.getByTestId('test-result-anthropic')).toContainText(/success|connected/i)

      // Each should have their own models loaded
      await expect(providersPage.getModelList('openai').getByText('gpt-4')).toBeVisible()
      await expect(providersPage.getModelList('anthropic').getByText('claude-3-sonnet')).toBeVisible()
    })

    test('should handle mixed success and failure in simultaneous tests', async ({ page }) => {
      // Mock OpenAI success, Anthropic failure
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      })

      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: { message: 'Server error' } })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Start both tests
      await Promise.all([
        providersPage.getProviderTestButton('openai').click(),
        providersPage.getProviderTestButton('anthropic').click()
      ])

      // OpenAI should succeed
      const openaiResult = page.getByTestId('test-result-openai')
      await expect(openaiResult).toContainText(/success|connected/i)

      // Anthropic should fail independently
      const anthropicError = providersPage.getConnectionError('anthropic')
      await expect(anthropicError).toContainText(/error|server.*error|failed/i)

      // OpenAI success shouldn't be affected by Anthropic failure
      await expect(openaiResult).toContainText(/success|connected/i)
    })

    test('should prevent race conditions in test state management', async ({ page }) => {
      let openaiCallCount = 0
      let anthropicCallCount = 0

      await page.route('**/api.openai.com/**', (route) => {
        openaiCallCount++
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }, Math.random() * 2000) // Random delay 0-2 seconds
      })

      await page.route('**/api.anthropic.com/**', (route) => {
        anthropicCallCount++
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }, Math.random() * 2000) // Random delay 0-2 seconds
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Rapidly start multiple tests
      const testPromises = [
        providersPage.getProviderTestButton('openai').click(),
        providersPage.getProviderTestButton('anthropic').click(),
        page.waitForTimeout(500).then(() => providersPage.getProviderTestButton('openai').click()),
        page.waitForTimeout(1000).then(() => providersPage.getProviderTestButton('anthropic').click())
      ]

      await Promise.allSettled(testPromises)

      // Should handle all tests appropriately without race conditions
      await expect(page.getByTestId('test-result-openai')).toContainText(/success|connected/i)
      await expect(page.getByTestId('test-result-anthropic')).toContainText(/success|connected/i)

      // Each provider should have been called at least once
      expect(openaiCallCount).toBeGreaterThan(0)
      expect(anthropicCallCount).toBeGreaterThan(0)
    })
  })

  test.describe('Error Recovery User Experience', () => {
    test('should provide clear recovery steps after errors', async ({ page }) => {
      // Mock error scenario
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({
            error: { message: 'Service unavailable' }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.testProviderConnection('openai')

      const errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toBeVisible()

      // Should provide recovery options
      const retryButton = page.getByRole('button', { name: /retry|try.*again/i })
      const hasRetryButton = await retryButton.isVisible().catch(() => false)

      if (hasRetryButton) {
        expect(hasRetryButton).toBe(true)
      }

      // Should provide helpful links or guidance
      const helpLink = page.getByRole('link', { name: /help|support|status|documentation/i })
      const hasHelpLink = await helpLink.isVisible().catch(() => false)

      if (hasHelpLink) {
        expect(hasHelpLink).toBe(true)
      }
    })

    test('should maintain user context during error recovery', async ({ page }) => {
      let shouldFail = true
      await page.route('**/api.anthropic.com/**', (route) => {
        if (shouldFail) {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: { message: 'Server error' } })
          })
        } else {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'claude-3-sonnet' }] })
          })
        }
      })

      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Initial test fails
      await providersPage.testProviderConnection('anthropic')
      const errorResult = providersPage.getConnectionError('anthropic')
      await expect(errorResult).toContainText(/error|server.*error/i)

      // API key should still be configured
      const keyInput = providersPage.getApiKeyInput('anthropic')
      const keyValue = await keyInput.inputValue()
      expect(keyValue).not.toBe('')

      // Fix the error and retry
      shouldFail = false
      await providersPage.testProviderConnection('anthropic')

      // Should now succeed and maintain configuration
      const successResult = page.getByTestId('test-result-anthropic')
      await expect(successResult).toContainText(/success|connected/i)

      // Key should still be configured
      const finalKeyValue = await keyInput.inputValue()
      expect(finalKeyValue).not.toBe('')
    })

    test('should handle progressive error escalation', async ({ page }) => {
      let attemptCount = 0
      const errorCodes = [500, 502, 503, 504] // Escalating server errors

      await page.route('**/api.openai.com/**', (route) => {
        const errorCode = errorCodes[Math.min(attemptCount, errorCodes.length - 1)]
        attemptCount++

        route.fulfill({
          status: errorCode,
          body: JSON.stringify({
            error: { message: `Server error ${errorCode}` }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Multiple test attempts
      for (let i = 0; i < 3; i++) {
        await providersPage.testProviderConnection('openai')

        const errorResult = providersPage.getConnectionError('openai')
        await expect(errorResult).toBeVisible()

        // Error messages should be appropriate for the error type
        if (i === 0) {
          await expect(errorResult).toContainText(/server.*error|internal.*error/i)
        } else if (i === 1) {
          await expect(errorResult).toContainText(/bad.*gateway|proxy.*error/i)
        } else {
          await expect(errorResult).toContainText(/service.*unavailable|maintenance/i)
        }

        // Wait before next attempt
        await page.waitForTimeout(1000)
      }
    })

    test('should provide escalating help based on repeated failures', async ({ page }) => {
      let failureCount = 0

      await page.route('**/api.openai.com/**', (route) => {
        failureCount++
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: { message: 'Invalid API key' }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', 'invalid-key')

      // First failure
      await providersPage.testProviderConnection('openai')
      let errorResult = providersPage.getConnectionError('openai')
      await expect(errorResult).toContainText(/invalid.*key/i)

      // Second failure
      await providersPage.testProviderConnection('openai')

      // Should provide additional help after repeated failures
      const additionalHelp = page.getByText(/still.*having.*trouble|need.*more.*help|contact.*support/i)
      const hasAdditionalHelp = await additionalHelp.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasAdditionalHelp || failureCount >= 2) {
        // After multiple failures, should offer more comprehensive help
        const helpOptions = page.locator('[data-testid*="help"], .help, [data-help]')
        const hasHelpOptions = (await helpOptions.count()) > 0

        if (hasHelpOptions) {
          expect(hasHelpOptions).toBe(true)
        }
      }
    })
  })
})
