/**
 * Error Handling and Flaky Test Prevention Utilities
 *
 * Provides robust patterns for handling common test failures,
 * retry mechanisms, and debugging utilities for flaky tests.
 */

import { type Page, type Locator, expect } from '@playwright/test'

export interface RetryOptions {
  maxAttempts?: number
  delay?: number
  backoff?: boolean
  timeout?: number
}

export interface WaitOptions {
  timeout?: number
  stable?: boolean
  visible?: boolean
  attached?: boolean
}

/**
 * Enhanced error handling utilities for Playwright tests
 */
export class TestErrorHandler {
  /**
   * Retry an operation with exponential backoff
   */
  static async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { maxAttempts = 3, delay = 1000, backoff = true, timeout = 30000 } = options

    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Apply timeout to the entire operation
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
        )

        const result = await Promise.race([operation(), timeoutPromise])

        // Success - log if this wasn't the first attempt
        if (attempt > 1) {
          console.log(`✅ Operation succeeded on attempt ${attempt}`)
        }

        return result
      } catch (error) {
        lastError = error as Error

        // Don't retry if this was the last attempt
        if (attempt === maxAttempts) {
          break
        }

        // Calculate delay with optional exponential backoff
        const currentDelay = backoff ? delay * Math.pow(2, attempt - 1) : delay

        console.warn(`⚠️ Attempt ${attempt} failed: ${lastError.message}. Retrying in ${currentDelay}ms...`)

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, currentDelay))
      }
    }

    // All attempts failed
    throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError.message}`)
  }

  /**
   * Safe navigation with error recovery
   */
  static async safeNavigate(page: Page, url: string, options: RetryOptions = {}) {
    return await this.withRetry(
      async () => {
        await page.goto(url)

        // Wait for basic page readiness
        await page.waitForLoadState('networkidle', { timeout: 10000 })

        // Verify navigation succeeded
        const currentUrl = page.url()
        if (!currentUrl.includes(url) && !url.includes('localhost')) {
          throw new Error(`Navigation failed: expected ${url}, got ${currentUrl}`)
        }
      },
      { maxAttempts: 3, delay: 2000, ...options }
    )
  }

  /**
   * Wait for element with enhanced error reporting
   */
  static async waitForElement(locator: Locator, description: string, options: WaitOptions = {}): Promise<void> {
    const { timeout = 10000, stable = true, visible = true, attached = true } = options

    try {
      // Wait for basic conditions
      if (attached) {
        await locator.waitFor({ state: 'attached', timeout })
      }

      if (visible) {
        await locator.waitFor({ state: 'visible', timeout })
      }

      // Wait for element to be stable (stop moving/changing)
      if (stable) {
        await this.waitForStable(locator, { timeout: timeout / 2 })
      }

      console.log(`✅ Element found: ${description}`)
    } catch (error) {
      // Enhanced error reporting
      const page = locator.page()
      const elementCount = await locator.count()
      const pageTitle = await page.title()
      const pageUrl = page.url()

      throw new Error(
        `Failed to find element: ${description}\n` +
          `  Page: ${pageTitle} (${pageUrl})\n` +
          `  Element count: ${elementCount}\n` +
          `  Original error: ${error.message}\n` +
          `  Tip: Check if element selector is correct or if page is fully loaded`
      )
    }
  }

  /**
   * Wait for element to stop moving/changing (stability check)
   */
  static async waitForStable(locator: Locator, options: { timeout?: number } = {}) {
    const { timeout = 5000 } = options
    const startTime = Date.now()
    let lastBoundingBox: any = null
    const stableFor = 100 // ms that element must be stable

    while (Date.now() - startTime < timeout) {
      try {
        const boundingBox = await locator.boundingBox({ timeout: 1000 })

        if (boundingBox && lastBoundingBox) {
          const moved =
            Math.abs(boundingBox.x - lastBoundingBox.x) > 1 ||
            Math.abs(boundingBox.y - lastBoundingBox.y) > 1 ||
            Math.abs(boundingBox.width - lastBoundingBox.width) > 1 ||
            Math.abs(boundingBox.height - lastBoundingBox.height) > 1

          if (!moved) {
            // Element is stable, wait a bit more to confirm
            await new Promise((resolve) => setTimeout(resolve, stableFor))
            return
          }
        }

        lastBoundingBox = boundingBox
        await new Promise((resolve) => setTimeout(resolve, 50))
      } catch (error) {
        // Element might not be visible/attached yet
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    throw new Error(`Element did not stabilize within ${timeout}ms`)
  }

  /**
   * Safe click with retry and stability checks
   */
  static async safeClick(locator: Locator, description: string, options: RetryOptions & WaitOptions = {}) {
    return await this.withRetry(
      async () => {
        // Wait for element to be ready
        await this.waitForElement(locator, description, options)

        // Ensure element is clickable
        await locator.waitFor({ state: 'visible' })

        // Scroll into view if needed
        await locator.scrollIntoViewIfNeeded()

        // Wait for any animations to complete
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Perform the click
        await locator.click()

        console.log(`✅ Clicked: ${description}`)
      },
      { maxAttempts: 3, delay: 500, ...options }
    )
  }

  /**
   * Safe text input with validation
   */
  static async safeType(
    locator: Locator,
    text: string,
    description: string,
    options: { clear?: boolean; verify?: boolean } & RetryOptions = {}
  ) {
    const { clear = true, verify = true, ...retryOptions } = options

    return await this.withRetry(
      async () => {
        // Wait for input to be ready
        await this.waitForElement(locator, description, { visible: true })

        // Clear existing content if requested
        if (clear) {
          await locator.clear()
        }

        // Type the text
        await locator.fill(text)

        // Verify the text was entered correctly
        if (verify) {
          await expect(locator).toHaveValue(text)
        }

        console.log(`✅ Typed "${text}" into: ${description}`)
      },
      { maxAttempts: 2, delay: 500, ...retryOptions }
    )
  }

  /**
   * Wait for network requests to complete
   */
  static async waitForNetwork(page: Page, timeout: number = 5000) {
    try {
      await page.waitForLoadState('networkidle', { timeout })
    } catch (error) {
      console.warn(`⚠️ Network idle timeout after ${timeout}ms, continuing anyway`)
    }
  }

  /**
   * Capture debug information on test failure
   */
  static async captureDebugInfo(page: Page, testName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `debug-${testName}-${timestamp}`

    try {
      // Capture screenshot
      await page.screenshot({
        path: `test-results/${filename}.png`,
        fullPage: true
      })

      // Capture page HTML
      const html = await page.content()
      await require('fs/promises').writeFile(`test-results/${filename}.html`, html, 'utf-8')

      // Capture console logs
      const logs = page.context().storageState
      await require('fs/promises').writeFile(
        `test-results/${filename}-console.json`,
        JSON.stringify(logs, null, 2),
        'utf-8'
      )

      console.log(`🔍 Debug info captured: ${filename}`)
    } catch (error) {
      console.error(`Failed to capture debug info: ${error.message}`)
    }
  }

  /**
   * Enhanced assertion with retry capability
   */
  static async assertWithRetry<T>(
    assertion: () => Promise<T> | T,
    description: string,
    options: RetryOptions = {}
  ): Promise<T> {
    return await this.withRetry(
      async () => {
        try {
          const result = await assertion()
          console.log(`✅ Assertion passed: ${description}`)
          return result
        } catch (error) {
          throw new Error(`Assertion failed: ${description} - ${error.message}`)
        }
      },
      { maxAttempts: 3, delay: 1000, ...options }
    )
  }
}

/**
 * Page load utilities with error handling
 */
export class PageLoadHelper {
  /**
   * Wait for page to be fully loaded and interactive
   */
  static async waitForPageReady(
    page: Page,
    options: {
      timeout?: number
      waitForSelectors?: string[]
      skipNetworkIdle?: boolean
    } = {}
  ) {
    const { timeout = 15000, waitForSelectors = [], skipNetworkIdle = false } = options

    try {
      // Wait for basic page load
      await page.waitForLoadState('load', { timeout })

      // Wait for network idle unless skipped
      if (!skipNetworkIdle) {
        await TestErrorHandler.waitForNetwork(page, timeout / 3)
      }

      // Wait for DOM to be ready
      await page.waitForLoadState('domcontentloaded', { timeout })

      // Wait for specific selectors if provided
      for (const selector of waitForSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 })
        } catch (error) {
          console.warn(`⚠️ Optional selector not found: ${selector}`)
        }
      }

      // Wait for any remaining JavaScript to execute
      await page.waitForFunction(() => document.readyState === 'complete')

      console.log(`✅ Page ready: ${page.url()}`)
    } catch (error) {
      throw new Error(`Page failed to load properly: ${error.message}`)
    }
  }

  /**
   * Check for common page load errors
   */
  static async detectPageErrors(page: Page): Promise<string[]> {
    const errors: string[] = []

    try {
      // Check for JavaScript errors in console
      const jsErrors = await page.evaluate(() => {
        return (window as any).__playwright_errors || []
      })

      if (jsErrors.length > 0) {
        errors.push(`JavaScript errors: ${jsErrors.join(', ')}`)
      }

      // Check for network errors
      const failedRequests = await page.evaluate(() => {
        return (window as any).__playwright_failed_requests || []
      })

      if (failedRequests.length > 0) {
        errors.push(`Failed requests: ${failedRequests.join(', ')}`)
      }

      // Check for missing essential elements
      const hasMainContent = (await page.locator('main, [role="main"], #main, .main-content').count()) > 0
      if (!hasMainContent) {
        errors.push('Main content area not found')
      }
    } catch (error) {
      errors.push(`Error detection failed: ${error.message}`)
    }

    return errors
  }
}

/**
 * Form interaction utilities with error handling
 */
export class FormHelper {
  /**
   * Fill form with proper error handling and validation
   */
  static async fillForm(
    page: Page,
    formData: Record<string, string | boolean>,
    options: {
      submitButton?: string
      validateAfterFill?: boolean
      waitForResponse?: boolean
    } = {}
  ) {
    const { submitButton, validateAfterFill = true, waitForResponse = true } = options

    try {
      // Fill each field
      for (const [fieldName, value] of Object.entries(formData)) {
        const field = page.locator(`[name="${fieldName}"], [id="${fieldName}"]`).first()

        await TestErrorHandler.waitForElement(field, `Field: ${fieldName}`)

        if (typeof value === 'boolean') {
          if (value) {
            await TestErrorHandler.safeClick(field, `Checkbox: ${fieldName}`)
          }
        } else {
          await TestErrorHandler.safeType(field, value, `Input: ${fieldName}`)
        }
      }

      // Validate field values if requested
      if (validateAfterFill) {
        for (const [fieldName, expectedValue] of Object.entries(formData)) {
          if (typeof expectedValue === 'string') {
            const field = page.locator(`[name="${fieldName}"], [id="${fieldName}"]`).first()
            await expect(field).toHaveValue(expectedValue)
          }
        }
      }

      // Submit form if button specified
      if (submitButton) {
        const submitBtn = page.locator(submitButton)

        if (waitForResponse) {
          // Wait for potential form submission response
          const responsePromise = page
            .waitForResponse((response) => response.status() === 200 || response.status() === 201)
            .catch(() => null) // Don't fail if no response

          await TestErrorHandler.safeClick(submitBtn, 'Submit button')

          // Wait a moment for response
          await Promise.race([responsePromise, new Promise((resolve) => setTimeout(resolve, 3000))])
        } else {
          await TestErrorHandler.safeClick(submitBtn, 'Submit button')
        }
      }

      console.log(`✅ Form filled successfully with ${Object.keys(formData).length} fields`)
    } catch (error) {
      throw new Error(`Form filling failed: ${error.message}`)
    }
  }

  /**
   * Wait for form validation messages
   */
  static async waitForValidation(page: Page, expectedErrors: string[] = [], timeout: number = 5000) {
    try {
      // Wait for any validation messages to appear
      await page.waitForSelector('[role="alert"], .error, .validation-error', { timeout })

      // If specific errors expected, validate them
      for (const expectedError of expectedErrors) {
        await expect(page.getByText(expectedError)).toBeVisible()
      }

      console.log(`✅ Form validation detected: ${expectedErrors.length} errors`)
    } catch (error) {
      if (expectedErrors.length > 0) {
        throw new Error(`Expected validation errors not found: ${expectedErrors.join(', ')}`)
      }
      // No validation errors found (might be expected)
    }
  }
}
