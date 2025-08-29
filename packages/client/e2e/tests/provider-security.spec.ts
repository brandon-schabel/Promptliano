import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../pages/providers.page'
import { ProviderPageTestData, ProviderTestDataHelper } from '../fixtures/provider-page-data'

/**
 * Provider Security and Data Protection Tests
 *
 * These tests cover security aspects of provider management including
 * API key masking, secure storage, transmission security, and prevention
 * of sensitive data exposure in browser storage and network requests.
 */
test.describe('Provider Security and Data Protection', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)
    await providersPage.goto()
    await providersPage.waitForPageLoad()

    // Set up basic API mocks for security testing
    await page.route('**/api.openai.com/**', (route) => {
      const authHeader = route.request().headers()['authorization']
      if (authHeader?.includes('Bearer sk-')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
        })
      } else {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      }
    })

    await page.route('**/api.anthropic.com/**', (route) => {
      const authHeader = route.request().headers()['x-api-key']
      if (authHeader?.includes('sk-ant-')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [{ id: 'claude-4-sonnet' }] })
        })
      } else {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: { message: 'Invalid API key' } })
        })
      }
    })
  })

  test.describe('API Key Masking and Display Security', () => {
    test('should mask API keys in UI inputs', async ({ page }) => {
      const testKey = 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef'

      // Configure key
      await providersPage.configureCloudProvider('openai', testKey)

      // Key should be masked in input
      const keyInput = providersPage.getApiKeyInput('openai')
      const displayValue = await keyInput.inputValue()

      // Should not show full key
      expect(displayValue).not.toBe(testKey)
      expect(displayValue).toMatch(/\*+|sk-\*\*/)

      // Verify with multiple masking patterns from test data
      const expectedPatterns = ProviderPageTestData.securityScenarios.apiKeyMasking.expectedMaskedDisplays
      const matchesPattern = expectedPatterns.some((pattern) => {
        if (pattern.includes('*')) {
          return displayValue.includes('*')
        } else if (pattern.includes('\u2022')) {
          return displayValue.includes('\u2022')
        }
        return false
      })

      expect(matchesPattern).toBe(true)
    })

    test('should use proper input type for key masking', async ({ page }) => {
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      const keyInput = providersPage.getApiKeyInput('openai')

      // Input should be password type by default
      const inputType = await keyInput.getAttribute('type')
      expect(inputType).toBe('password')
    })

    test('should handle key visibility toggle securely', async ({ page }) => {
      const testKey = 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef'
      await providersPage.configureCloudProvider('anthropic', testKey)

      const keyInput = providersPage.getApiKeyInput('anthropic')
      const toggleButton = providersPage.getApiKeyToggleVisibility('anthropic')

      // Should start as password (hidden)
      expect(await keyInput.getAttribute('type')).toBe('password')

      // Toggle to show
      await toggleButton.click()
      await page.waitForTimeout(500) // Allow UI to update

      expect(await keyInput.getAttribute('type')).toBe('text')
      const visibleValue = await keyInput.inputValue()

      // When visible, should show actual key or appropriately formatted version
      expect(visibleValue).toContain('sk-')

      // Toggle back to hidden
      await toggleButton.click()
      await page.waitForTimeout(500)

      expect(await keyInput.getAttribute('type')).toBe('password')
    })

    test('should mask keys consistently across different providers', async ({ page }) => {
      const openaiKey = ProviderTestDataHelper.generateTestApiKey('openai')
      const anthropicKey = ProviderTestDataHelper.generateTestApiKey('anthropic')

      await providersPage.configureCloudProvider('openai', openaiKey)
      await providersPage.configureCloudProvider('anthropic', anthropicKey)

      // Both should be masked consistently
      const openaiMasked = await providersPage.verifyApiKeyMasking('openai', openaiKey)
      const anthropicMasked = await providersPage.verifyApiKeyMasking('anthropic', anthropicKey)

      expect(openaiMasked).toBe(true)
      expect(anthropicMasked).toBe(true)
    })

    test('should not expose keys in browser developer tools', async ({ page }) => {
      const testKey = 'sk-sensitive1234567890abcdef1234567890abcdef1234567890abcdef'

      await providersPage.configureCloudProvider('openai', testKey)

      // Check that the key is not exposed in the DOM
      const pageContent = await page.content()
      expect(pageContent).not.toContain(testKey)

      // Check input elements specifically
      const allInputs = page.locator('input')
      const inputCount = await allInputs.count()

      for (let i = 0; i < inputCount; i++) {
        const input = allInputs.nth(i)
        const value = await input.inputValue().catch(() => '')
        const placeholder = await input.getAttribute('placeholder')
        const defaultValue = await input.getAttribute('value')

        expect(value).not.toBe(testKey)
        expect(placeholder).not.toContain(testKey)
        expect(defaultValue).not.toContain(testKey)
      }

      // Check all text content
      const textElements = page.locator('*:visible')
      const elementCount = await textElements.count()

      // Sample check (not all elements to avoid performance issues)
      const samplesToCheck = Math.min(elementCount, 50)
      for (let i = 0; i < samplesToCheck; i++) {
        const element = textElements.nth(i)
        const textContent = await element.textContent().catch(() => '')
        expect(textContent).not.toContain(testKey)
      }
    })
  })

  test.describe('Browser Storage Security', () => {
    test('should not expose API keys in localStorage', async ({ page }) => {
      const sensitiveKeys = ProviderPageTestData.securityScenarios.storageValidation.shouldNotAppearInStorage

      // Configure providers with test keys
      await providersPage.configureCloudProvider('openai', sensitiveKeys[0])
      await providersPage.configureCloudProvider('anthropic', sensitiveKeys[1])

      // Check localStorage doesn't contain raw keys
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

      // Raw API keys should not be in localStorage
      const storageString = JSON.stringify(localStorage).toLowerCase()

      for (const sensitiveKey of sensitiveKeys) {
        expect(storageString).not.toContain(sensitiveKey.toLowerCase())
      }

      // Should contain acceptable patterns instead
      const acceptablePatterns = ProviderPageTestData.securityScenarios.storageValidation.expectedStoragePatterns
      const hasAcceptablePattern = acceptablePatterns.some((pattern) => storageString.includes(pattern.toLowerCase()))

      // If any provider data is stored, it should use secure patterns
      const hasProviderData = Object.keys(localStorage).some(
        (key) =>
          key.toLowerCase().includes('provider') ||
          key.toLowerCase().includes('api') ||
          key.toLowerCase().includes('key')
      )

      if (hasProviderData) {
        expect(hasAcceptablePattern).toBe(true)
      }
    })

    test('should not expose API keys in sessionStorage', async ({ page }) => {
      await providersPage.configureCloudProvider('openai', 'sk-secret123456789abcdef')

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

      const sessionString = JSON.stringify(sessionStorage).toLowerCase()
      expect(sessionString).not.toContain('sk-secret123456789abcdef')
    })

    test('should not expose keys in browser memory after clearing', async ({ page }) => {
      const testKey = 'sk-memory1234567890abcdef1234567890abcdef1234567890abcdef'

      // Configure and then clear key
      await providersPage.configureCloudProvider('openai', testKey)
      await providersPage.clearApiKey('openai')

      // Check that key is not lingering in storage
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

      const storageString = JSON.stringify(localStorage)
      expect(storageString).not.toContain(testKey)

      // Check DOM doesn't contain the key
      const pageContent = await page.content()
      expect(pageContent).not.toContain(testKey)
    })

    test('should handle storage quotas and limits securely', async ({ page }) => {
      // Test with many providers configured to see storage behavior
      const manyKeys = Array.from({ length: 10 }, (_, i) => `sk-test${i}${'x'.repeat(40)}`)

      for (let i = 0; i < manyKeys.length; i++) {
        const providerId = i % 2 === 0 ? 'openai' : 'anthropic'
        await providersPage.configureCloudProvider(providerId, manyKeys[i])
      }

      // Check that storage doesn't contain raw keys even with many configurations
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

      const storageString = JSON.stringify(localStorage)

      for (const key of manyKeys) {
        expect(storageString).not.toContain(key)
      }
    })
  })

  test.describe('Network Transmission Security', () => {
    test('should validate key format before transmission', async ({ page }) => {
      // Monitor network requests
      const requests: any[] = []
      page.on('request', (req) => {
        if (req.url().includes('/api/providers') || req.url().includes('/providers')) {
          requests.push({
            url: req.url(),
            method: req.method(),
            postData: req.postDataJSON(),
            headers: req.headers()
          })
        }
      })

      // Try to save invalid format key
      const keyInput = providersPage.getApiKeyInput('openai')
      await keyInput.fill('invalid-key')

      const saveButton = providersPage.getSaveKeyButton('openai')

      // If save button is enabled, clicking should either validate or reject
      if (await saveButton.isEnabled()) {
        await saveButton.click()

        // Should either show validation error or not send invalid key
        const hasError = await page
          .getByText(/invalid.*format|key.*format/i)
          .isVisible()
          .catch(() => false)

        if (!hasError) {
          // Check that invalid key wasn't transmitted
          const relevantRequests = requests.filter((r) => r.postData?.apiKey)
          for (const req of relevantRequests) {
            expect(req.postData.apiKey).not.toBe('invalid-key')
          }
        }
      }
    })

    test('should use secure headers for API key transmission', async ({ page }) => {
      let requestHeaders: Record<string, string> = {}

      // Intercept API calls to check headers
      page.on('request', (req) => {
        if (req.url().includes('api.openai.com') || req.url().includes('api.anthropic.com')) {
          requestHeaders = req.headers()
        }
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.validateApiKey('openai')

      // Should use proper authorization header
      expect(requestHeaders['authorization']).toMatch(/Bearer sk-/)

      // Should not expose key in other headers
      const headerString = JSON.stringify(requestHeaders).toLowerCase()
      const testKey = ProviderTestDataHelper.generateTestApiKey('openai')

      // Key should only appear in authorization header, not elsewhere
      const authHeaderOnly =
        Object.keys(requestHeaders).filter(
          (key) => key.toLowerCase() !== 'authorization' && requestHeaders[key].includes(testKey.substring(0, 10))
        ).length === 0

      expect(authHeaderOnly).toBe(true)
    })

    test('should not log API keys in console', async ({ page }) => {
      const consoleMessages: string[] = []

      page.on('console', (msg) => {
        consoleMessages.push(msg.text().toLowerCase())
      })

      const testKey = 'sk-console1234567890abcdef1234567890abcdef1234567890abcdef'
      await providersPage.configureCloudProvider('openai', testKey)
      await providersPage.validateApiKey('openai')

      // Wait for any async logging
      await page.waitForTimeout(2000)

      // Console messages should not contain the API key
      const hasKeyInConsole = consoleMessages.some(
        (msg) => msg.includes(testKey.toLowerCase()) || msg.includes(testKey.substring(0, 20).toLowerCase())
      )

      expect(hasKeyInConsole).toBe(false)
    })

    test('should handle HTTPS requirements properly', async ({ page }) => {
      // Mock HTTP (insecure) endpoint
      await page.route('http://insecure-api.example.com/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [] })
        })
      })

      // Try to configure provider with HTTP endpoint (if URL editing is supported)
      const urlElement = providersPage.getProviderUrl('openai')
      const hasEditableUrl = (await urlElement.locator('input').count()) > 0

      if (hasEditableUrl) {
        const urlInput = urlElement.locator('input')
        await urlInput.fill('http://insecure-api.example.com')

        // Should warn about insecure connection
        const securityWarning = page.getByText(/insecure|http.*warning|use.*https/i)
        const hasWarning = await securityWarning.isVisible({ timeout: 2000 }).catch(() => false)

        expect(hasWarning).toBe(true)
      }
    })
  })

  test.describe('Error Message Security', () => {
    test('should not expose sensitive information in error messages', async ({ page }) => {
      const testKey = 'sk-sensitive1234567890abcdef1234567890abcdef1234567890abcdef'

      // Configure with valid format but fake key
      await providersPage.configureCloudProvider('openai', testKey)

      // Mock error response that might contain sensitive info
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: {
              message: `Incorrect API key provided: ${testKey}. You can find your API key at...`,
              type: 'invalid_request_error'
            }
          })
        })
      })

      await providersPage.validateApiKey('openai')

      // Error message should not contain the full API key
      const errorElement = providersPage.getValidationResult('openai')
      const errorText = await errorElement.textContent()

      expect(errorText).not.toContain(testKey)

      // Should contain masked version or generic error
      expect(errorText).toMatch(/invalid|incorrect.*key|sk-\*\*|authentication.*failed/i)
    })

    test('should sanitize error messages from providers', async ({ page }) => {
      await page.route('**/api.anthropic.com/**', (route) => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({
            error: {
              message: 'Request failed: x-api-key header "sk-ant-secretkey123" is invalid',
              type: 'invalid_request_error'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('anthropic', 'sk-ant-secretkey123')
      await providersPage.validateApiKey('anthropic')

      const errorResult = providersPage.getValidationResult('anthropic')
      const errorText = await errorResult.textContent()

      // Should not contain the actual API key from error message
      expect(errorText).not.toContain('sk-ant-secretkey123')

      // Should contain sanitized version
      expect(errorText).toMatch(/invalid|error|failed/i)
    })

    test('should not expose internal system paths in errors', async ({ page }) => {
      // Mock error that might contain file paths
      await page.route('**/api.openai.com/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: {
              message: 'Internal error at /home/user/.config/api-keys.json line 42',
              type: 'server_error'
            }
          })
        })
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.validateApiKey('openai')

      const errorResult = providersPage.getValidationResult('openai')
      const errorText = await errorResult.textContent()

      // Should not contain file paths or internal details
      expect(errorText).not.toMatch(/\/home|C:\\|\\.(json|config|env)/i)

      // Should show generic server error
      expect(errorText).toMatch(/server.*error|internal.*error|try.*later/i)
    })
  })

  test.describe('Input Validation and Sanitization', () => {
    test('should prevent XSS in provider configuration', async ({ page }) => {
      const xssPayloads = [
        '<script>alert(\"xss\")</script>',
        'javascript:alert(\"xss\")',
        '<img src=x onerror=alert(\"xss\")>',
        '\"><script>alert(\"xss\")</script>'
      ]

      for (const payload of xssPayloads) {
        // Try XSS in API key input
        const keyInput = providersPage.getApiKeyInput('openai')
        await keyInput.fill(payload)

        // Page should not execute script
        const alertPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null)
        await page.waitForTimeout(500)
        const dialog = await alertPromise

        expect(dialog).toBeNull()

        // Input should be sanitized or rejected
        const inputValue = await keyInput.inputValue()
        expect(inputValue).not.toContain('<script>')
      }
    })

    test('should validate input lengths to prevent overflow', async ({ page }) => {
      // Test with extremely long input
      const veryLongKey = 'sk-' + 'x'.repeat(10000)

      const keyInput = providersPage.getApiKeyInput('openai')
      await keyInput.fill(veryLongKey)

      const saveButton = providersPage.getSaveKeyButton('openai')
      const isEnabled = await saveButton.isEnabled()

      if (isEnabled) {
        await saveButton.click()

        // Should show validation error or length limit
        const errorMessage = page.getByText(/too.*long|length.*limit|invalid.*length/i)
        const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false)

        if (!hasError) {
          // Input should be truncated to reasonable length
          const finalValue = await keyInput.inputValue()
          expect(finalValue.length).toBeLessThan(1000)
        }
      }
    })

    test('should handle special characters securely', async ({ page }) => {
      const specialChars = ['sk-test\\n\\r\\t', 'sk-test\\u0000\\u0001', 'sk-test"\\', "sk-test'\\'"]

      for (const testKey of specialChars) {
        const keyInput = providersPage.getApiKeyInput('anthropic')
        await keyInput.fill(testKey)

        // Should handle special characters without breaking UI
        const inputValue = await keyInput.inputValue()

        // Input should not break or cause errors
        expect(inputValue).toBeDefined()

        // UI should remain functional
        const saveButton = providersPage.getSaveKeyButton('anthropic')
        await expect(saveButton).toBeVisible()
      }
    })
  })

  test.describe('Session and State Security', () => {
    test('should clear sensitive data on logout/session end', async ({ page }) => {
      const testKey = 'sk-session1234567890abcdef1234567890abcdef1234567890abcdef'

      await providersPage.configureCloudProvider('openai', testKey)

      // Simulate session end (if logout functionality exists)
      const logoutButton = page.getByRole('button', { name: /logout|sign.*out/i })
      const hasLogout = await logoutButton.isVisible().catch(() => false)

      if (hasLogout) {
        await logoutButton.click()

        // Check that sensitive data is cleared
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

        const storageString = JSON.stringify(localStorage)
        expect(storageString).not.toContain(testKey)
      }
    })

    test('should handle tab/window close securely', async ({ page }) => {
      await providersPage.configureCloudProvider('openai', 'sk-window123456789abcdef')

      // Simulate navigation away
      await page.goto('about:blank')

      // Navigate back
      await providersPage.goto()
      await providersPage.waitForPageLoad()

      // Sensitive data should be handled appropriately
      // (Either cleared or properly secured)
      const keyInput = providersPage.getApiKeyInput('openai')
      const value = await keyInput.inputValue()

      // If key is retained, it should be masked
      if (value && value !== '') {
        expect(value).toMatch(/\*+|configured|saved/)
        expect(value).not.toContain('sk-window123456789abcdef')
      }
    })

    test('should handle concurrent sessions securely', async ({ browser }) => {
      // Open second tab/context
      const secondContext = await browser.newContext()
      const secondPage = await secondContext.newPage()
      const secondProvidersPage = new ProvidersPage(secondPage)

      // Configure provider in first tab
      await providersPage.configureCloudProvider('openai', 'sk-concurrent123456789abcdef')

      // Check second tab
      await secondProvidersPage.goto()
      await secondProvidersPage.waitForPageLoad()

      // Second tab should not automatically have access to first tab's keys
      const secondKeyInput = secondProvidersPage.getApiKeyInput('openai')
      const secondValue = await secondKeyInput.inputValue()

      // Should either be empty or properly isolated
      expect(secondValue).not.toContain('sk-concurrent123456789abcdef')

      await secondContext.close()
    })
  })
})
