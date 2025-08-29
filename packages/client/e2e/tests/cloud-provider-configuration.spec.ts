import { test, expect } from '@playwright/test'
import { ProvidersPage } from '../pages/providers.page'
import { ProviderPageTestData, ProviderTestDataHelper } from '../fixtures/provider-page-data'

/**
 * Cloud Provider Configuration Tests
 *
 * These tests cover the configuration and management of cloud AI providers
 * including OpenAI and Anthropic with API key validation, format checking,
 * and secure storage behaviors.
 */
test.describe('Cloud Provider Configuration', () => {
  let providersPage: ProvidersPage

  test.beforeEach(async ({ page }) => {
    providersPage = new ProvidersPage(page)

    // Mock API endpoints for cloud providers
    await page.route('**/api.openai.com/v1/**', (route) => {
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

    await page.route('**/api.anthropic.com/**', (route) => {
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
              { id: 'claude-4-sonnet' },
              { id: 'claude-3-haiku-20240307' }
            ]
          })
        })
      }
    })

    await providersPage.goto()
    await providersPage.waitForPageLoad()
  })

  test.describe('API Key Configuration', () => {
    test('should configure OpenAI API key successfully', async ({ page }) => {
      // Configure OpenAI
      const openaiKey = ProviderTestDataHelper.generateTestApiKey('openai')
      await providersPage.configureCloudProvider('openai', openaiKey)

      // Verify key is saved (should be masked)
      const keyInput = providersPage.getApiKeyInput('openai')
      const keyValue = await keyInput.inputValue()
      expect(keyValue).toMatch(/\*+|sk-\*\*/) // Should be masked

      // Should be able to validate key
      const isValid = await providersPage.validateApiKey('openai')
      expect(isValid).toBe(true)

      // Should show available models
      await expect(providersPage.getModelList('openai')).toBeVisible()
      const models = await providersPage.getAvailableModels('openai')
      expect(models.length).toBeGreaterThan(0)
      expect(models).toContain('gpt-4')
    })

    test('should configure Anthropic API key successfully', async ({ page }) => {
      const anthropicKey = ProviderTestDataHelper.generateTestApiKey('anthropic')
      await providersPage.configureCloudProvider('anthropic', anthropicKey)

      // Verify key is saved and masked
      const keyInput = providersPage.getApiKeyInput('anthropic')
      const keyValue = await keyInput.inputValue()

      // Should not show the full key
      expect(keyValue).not.toBe(anthropicKey)
      expect(keyValue).toMatch(/\*+|sk-ant-\*\*/)

      // Should validate successfully
      const isValid = await providersPage.validateApiKey('anthropic')
      expect(isValid).toBe(true)

      // Should load models
      const models = await providersPage.getAvailableModels('anthropic')
      expect(models.length).toBeGreaterThan(0)
      expect(models.some((model) => model.includes('claude'))).toBe(true)
    })

    test('should handle invalid API keys gracefully', async ({ page }) => {
      // Try to configure with invalid key
      await providersPage.configureCloudProvider('openai', 'invalid-key-format')

      // Validation should fail
      const isValid = await providersPage.validateApiKey('openai')
      expect(isValid).toBe(false)

      // Should show error message
      const validationResult = providersPage.getValidationResult('openai')
      await expect(validationResult).toContainText(/invalid|error|failed/i)

      // Models should not be loaded
      const modelList = providersPage.getModelList('openai')
      const modelCount = await modelList.locator('[data-testid^=\"model-\"]').count()
      expect(modelCount).toBe(0)
    })

    test('should validate multiple providers independently', async ({ page }) => {
      // Configure OpenAI with valid key
      const openaiKey = ProviderTestDataHelper.generateTestApiKey('openai')
      await providersPage.configureCloudProvider('openai', openaiKey)

      // Configure Anthropic with invalid key
      await providersPage.configureCloudProvider('anthropic', 'invalid-anthropic-key')

      // OpenAI validation should succeed
      const openaiValid = await providersPage.validateApiKey('openai')
      expect(openaiValid).toBe(true)

      // Anthropic validation should fail
      const anthropicValid = await providersPage.validateApiKey('anthropic')
      expect(anthropicValid).toBe(false)

      // OpenAI should show models
      const openaiModels = await providersPage.getAvailableModels('openai')
      expect(openaiModels.length).toBeGreaterThan(0)

      // Anthropic should show error
      const anthropicError = providersPage.getValidationResult('anthropic')
      await expect(anthropicError).toContainText(/invalid|error/i)
    })
  })

  test.describe('API Key Visibility and Security', () => {
    test('should toggle API key visibility', async ({ page }) => {
      // Configure a key first
      await providersPage.configureCloudProvider('anthropic', 'sk-ant-test1234567890abcdef')

      const keyInput = providersPage.getApiKeyInput('anthropic')
      const toggleButton = providersPage.getApiKeyToggleVisibility('anthropic')

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

    test('should mask API keys properly in UI', async ({ page }) => {
      const testKey = 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef'

      await providersPage.configureCloudProvider('openai', testKey)

      // Verify API key is properly masked
      const isMasked = await providersPage.verifyApiKeyMasking('openai', testKey)
      expect(isMasked).toBe(true)

      // Key input should not contain the full original key
      const keyInput = providersPage.getApiKeyInput('openai')
      const displayValue = await keyInput.inputValue()
      expect(displayValue).not.toBe(testKey)
    })

    test('should maintain key masking after page reload', async ({ page }) => {
      const testKey = ProviderTestDataHelper.generateTestApiKey('openai')

      // Configure key
      await providersPage.configureCloudProvider('openai', testKey)

      // Reload page
      await page.reload()
      await providersPage.waitForPageLoad()

      // Key should still be configured but masked
      const keyInput = providersPage.getApiKeyInput('openai')
      const value = await keyInput.inputValue()

      // Should indicate key is saved but not expose it
      expect(value).toMatch(/\*+|configured|saved/)
      expect(value).not.toContain(testKey.slice(-10)) // Should not contain end of key
    })

    test('should handle key visibility toggle edge cases', async ({ page }) => {
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      const { wasHidden, isNowVisible } = await providersPage.toggleApiKeyVisibility('openai')

      // Should properly track visibility state
      expect(wasHidden).toBe(true) // Should start hidden
      expect(isNowVisible).toBe(true) // Should now be visible

      // Toggle back
      const { wasHidden: wasVisible, isNowVisible: isNowHidden } = await providersPage.toggleApiKeyVisibility('openai')
      expect(wasVisible).toBe(false) // Was visible
      expect(isNowHidden).toBe(false) // Now hidden (isNowVisible = false)
    })
  })

  test.describe('API Key Management', () => {
    test('should clear saved API keys', async ({ page }) => {
      // Configure key
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Clear key
      await providersPage.clearApiKey('openai')

      // Key input should be empty
      const keyInput = providersPage.getApiKeyInput('openai')
      await expect(keyInput).toHaveValue('')

      // Models should be cleared
      const modelList = providersPage.getModelList('openai')
      const modelCount = await modelList.locator('[data-testid^=\"model-\"]').count()
      expect(modelCount).toBe(0)
    })

    test('should confirm key clearing', async ({ page }) => {
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Click clear button
      await providersPage.getClearKeyButton('anthropic').click()

      // Should show confirmation dialog
      const confirmDialog = page.getByTestId('clear-key-confirmation')
      const hasConfirmDialog = await confirmDialog.isVisible().catch(() => false)

      if (hasConfirmDialog) {
        // Should be able to cancel
        const cancelButton = page.getByRole('button', { name: /cancel|no/i })
        const hasCancelButton = await cancelButton.isVisible().catch(() => false)

        if (hasCancelButton) {
          await cancelButton.click()

          // Key should still be there
          const keyInput = providersPage.getApiKeyInput('anthropic')
          const value = await keyInput.inputValue()
          expect(value).not.toBe('')
        }

        // Try clearing again and confirm
        await providersPage.getClearKeyButton('anthropic').click()
        await page.getByRole('button', { name: /clear|confirm|yes/i }).click()

        // Now key should be cleared
        const keyInput = providersPage.getApiKeyInput('anthropic')
        await expect(keyInput).toHaveValue('')
      }
    })

    test('should handle multiple API keys independently', async ({ page }) => {
      // Configure both providers
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))
      await providersPage.configureCloudProvider('anthropic', ProviderTestDataHelper.generateTestApiKey('anthropic'))

      // Verify both are configured
      const openaiInput = providersPage.getApiKeyInput('openai')
      const anthropicInput = providersPage.getApiKeyInput('anthropic')

      expect(await openaiInput.inputValue()).not.toBe('')
      expect(await anthropicInput.inputValue()).not.toBe('')

      // Clear only OpenAI
      await providersPage.clearApiKey('openai')

      // OpenAI should be cleared, Anthropic should remain
      await expect(openaiInput).toHaveValue('')
      expect(await anthropicInput.inputValue()).not.toBe('')

      // Anthropic should still be able to validate
      const anthropicValid = await providersPage.validateApiKey('anthropic')
      expect(anthropicValid).toBe(true)
    })
  })

  test.describe('Key Format Validation', () => {
    test('should validate API key format before saving', async ({ page }) => {
      // Test invalid format keys
      const invalidFormats = ['not-a-key', 'sk-', 'sk-tooshort', '12345', '']

      for (const invalidKey of invalidFormats) {
        const keyInput = providersPage.getApiKeyInput('openai')
        await keyInput.clear()
        await keyInput.fill(invalidKey)

        // Save button should be disabled or validation error shown
        const saveButton = providersPage.getSaveKeyButton('openai')
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

    test('should accept valid API key formats', async ({ page }) => {
      const validKeys = [
        'sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
        'sk-1234567890abcdef1234567890abcdef1234567890abcdef'
      ]

      for (const validKey of validKeys) {
        const keyInput = providersPage.getApiKeyInput('openai')
        await keyInput.clear()
        await keyInput.fill(validKey)

        const saveButton = providersPage.getSaveKeyButton('openai')
        await expect(saveButton).toBeEnabled()

        // Should not show format validation errors
        const formatError = page.getByText(/invalid.*format|key.*format/i)
        const hasFormatError = await formatError.isVisible().catch(() => false)
        expect(hasFormatError).toBe(false)
      }
    })

    test('should validate different provider key formats', async ({ page }) => {
      // OpenAI format validation
      const openaiValidFormats = [
        'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
        'sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      ]

      for (const key of openaiValidFormats) {
        const keyInput = providersPage.getApiKeyInput('openai')
        await keyInput.fill(key)

        const saveButton = providersPage.getSaveKeyButton('openai')
        await expect(saveButton).toBeEnabled()
      }

      // Anthropic format validation
      const anthropicValidFormats = [
        'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'sk-ant-1234567890abcdef1234567890abcdef'
      ]

      for (const key of anthropicValidFormats) {
        const keyInput = providersPage.getApiKeyInput('anthropic')
        await keyInput.fill(key)

        const saveButton = providersPage.getSaveKeyButton('anthropic')
        await expect(saveButton).toBeEnabled()
      }

      // Cross-provider format should be rejected
      const openaiKeyInput = providersPage.getApiKeyInput('openai')
      await openaiKeyInput.fill('sk-ant-1234567890abcdef1234567890abcdef')

      // Should either disable save button or show validation error
      const openaiSaveButton = providersPage.getSaveKeyButton('openai')
      const isEnabled = await openaiSaveButton.isEnabled()

      if (isEnabled) {
        await openaiSaveButton.click()
        const errorMessage = page.getByText(/invalid.*format|wrong.*provider/i)
        await expect(errorMessage).toBeVisible({ timeout: 3000 })
      } else {
        expect(isEnabled).toBe(false)
      }
    })
  })

  test.describe('Provider Status and Feedback', () => {
    test('should show appropriate status indicators', async ({ page }) => {
      // Test unconfigured state
      const openaiCard = providersPage.getCloudProviderCard('openai')
      const statusElement = openaiCard.getByTestId('provider-status')

      const initialStatus = await statusElement.textContent().catch(() => '')
      expect(initialStatus).toMatch(/not.*configured|configure.*required|no.*key/i)

      // Configure provider
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Status should update to configured/valid
      const configuredStatus = await statusElement.textContent()
      expect(configuredStatus).toMatch(/configured|valid|ready/i)
    })

    test('should provide clear validation feedback', async ({ page }) => {
      // Test with valid key
      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      const isValid = await providersPage.validateApiKey('openai')
      expect(isValid).toBe(true)

      const validationResult = providersPage.getValidationResult('openai')
      await expect(validationResult).toContainText(/valid|success|working/i)

      // Test with invalid key
      await providersPage.configureCloudProvider('anthropic', 'invalid-key')

      const isInvalid = await providersPage.validateApiKey('anthropic')
      expect(isInvalid).toBe(false)

      const invalidResult = providersPage.getValidationResult('anthropic')
      await expect(invalidResult).toContainText(/invalid|error|failed/i)
    })

    test('should show loading states during validation', async ({ page }) => {
      // Mock slow response to see loading state
      await page.route('**/api.openai.com/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ data: [{ id: 'gpt-4' }] })
          })
        }, 2000) // 2 second delay
      })

      await providersPage.configureCloudProvider('openai', ProviderTestDataHelper.generateTestApiKey('openai'))

      // Start validation
      const validateButton = providersPage.getValidateKeyButton('openai')
      await validateButton.click()

      // Should show loading state
      const loadingIndicator = page
        .getByText(/validating|testing|checking/i)
        .or(page.locator('[data-testid*=\"loading\"], .loading, .spinner'))

      await expect(loadingIndicator).toBeVisible({ timeout: 1000 })

      // Eventually should show result
      const validationResult = providersPage.getValidationResult('openai')
      await expect(validationResult).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Keyboard and Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Focus on first API key input
      const openaiKeyInput = providersPage.getApiKeyInput('openai')
      await openaiKeyInput.focus()

      // Tab should move to save button
      await page.keyboard.press('Tab')
      const saveButton = providersPage.getSaveKeyButton('openai')
      await expect(saveButton).toBeFocused()

      // Enter should activate save
      await openaiKeyInput.focus()
      await openaiKeyInput.fill(ProviderTestDataHelper.generateTestApiKey('openai'))
      await page.keyboard.press('Enter')

      // Should trigger save action
      await expect(page.getByText(/key.*saved|saved.*successfully/i)).toBeVisible({ timeout: 5000 })
    })

    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Check that form elements have proper labels
      const openaiKeyInput = providersPage.getApiKeyInput('openai')
      const inputLabel =
        (await openaiKeyInput.getAttribute('aria-label')) || (await openaiKeyInput.getAttribute('placeholder'))

      expect(inputLabel).toMatch(/api.*key|openai.*key/i)

      // Check that buttons have proper roles and labels
      const saveButton = providersPage.getSaveKeyButton('openai')
      const saveLabel = (await saveButton.textContent()) || (await saveButton.getAttribute('aria-label'))

      expect(saveLabel).toMatch(/save|configure/i)

      // Check validation results are announced
      await providersPage.configureCloudProvider('openai', 'invalid-key')
      await providersPage.validateApiKey('openai')

      const validationResult = providersPage.getValidationResult('openai')
      const hasAriaLive = (await validationResult.getAttribute('aria-live')) !== null
      const hasRole =
        (await validationResult.getAttribute('role')) === 'status' ||
        (await validationResult.getAttribute('role')) === 'alert'

      expect(hasAriaLive || hasRole).toBe(true)
    })
  })
})
