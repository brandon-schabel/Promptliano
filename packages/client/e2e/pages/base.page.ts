import { type Page, type Locator, expect } from '@playwright/test'

export class BasePage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string = '/') {
    await this.page.goto(path, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    await this.waitForPageLoad()
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForPageLoad() {
    // Wait for React to hydrate
    await this.page.waitForFunction(() => document.readyState === 'complete')

    // Wait for any loading spinners to disappear
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 5000 }).catch(() => {
      // Ignore if no loading spinner exists
    })
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, timeout = 5000): Promise<Locator> {
    const element = this.page.locator(selector)
    await element.waitFor({ state: 'visible', timeout })
    return element
  }

  /**
   * Click an element and wait for navigation if expected
   */
  async clickAndWaitForNavigation(selector: string, waitForURL?: string) {
    const [response] = await Promise.all([
      waitForURL ? this.page.waitForURL(waitForURL) : this.page.waitForResponse((resp) => resp.status() === 200),
      this.page.click(selector)
    ])
    return response
  }

  /**
   * Fill a form field
   */
  async fillField(selector: string, value: string) {
    await this.page.fill(selector, value)
    // Wait a bit for any validation to trigger
    await this.page.waitForTimeout(300)
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `e2e/screenshots/${name}-${Date.now()}.png`,
      fullPage: true
    })
  }

  /**
   * Wait for API response
   */
  async waitForAPIResponse(urlPattern: string | RegExp, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET') {
    return await this.page.waitForResponse(
      (response) =>
        response.url().match(urlPattern) !== null && response.request().method() === method && response.status() === 200
    )
  }

  /**
   * Get text content from an element
   */
  async getTextContent(selector: string): Promise<string> {
    const element = await this.waitForElement(selector)
    return (await element.textContent()) || ''
  }

  /**
   * Check if element exists and is visible
   */
  async isElementVisible(selector: string, timeout = 5000): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout })
      return true
    } catch {
      return false
    }
  }

  /**
   * Wait for toast notification
   */
  async waitForToast(message?: string) {
    if (message) {
      await expect(this.page.locator('[data-sonner-toast]', { hasText: message })).toBeVisible()
    } else {
      await expect(this.page.locator('[data-sonner-toast]')).toBeVisible()
    }
  }

  /**
   * Wait for confirmation dialog and interact with it
   */
  async handleConfirmationDialog(action: 'accept' | 'dismiss' = 'accept') {
    const dialog = this.page.locator('[role="dialog"], [data-testid="confirmation-dialog"]')
    await expect(dialog).toBeVisible()

    if (action === 'accept') {
      await this.page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').click()
    } else {
      await this.page.locator('button:has-text("Cancel"), button:has-text("No")').click()
    }
  }

  /**
   * Common keyboard shortcuts
   */
  async pressShortcut(shortcut: string) {
    await this.page.keyboard.press(shortcut)
  }

  /**
   * Wait for loading state to complete
   */
  async waitForLoadingComplete() {
    // Wait for any loading spinners
    await this.page
      .waitForSelector('[data-testid="loading"], .loading, [aria-label*="loading"]', {
        state: 'hidden',
        timeout: 10000
      })
      .catch(() => {
        // Ignore if no loading indicators exist
      })

    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Scroll element into view
   */
  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded()
  }

  /**
   * Get current URL
   */
  getCurrentURL(): string {
    return this.page.url()
  }

  /**
   * Wait for specific URL pattern
   */
  async waitForURL(pattern: string | RegExp, timeout = 10000) {
    await this.page.waitForURL(pattern, { timeout })
  }

  /**
   * Check for error messages
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.isElementVisible('[data-testid="error"], .error, [role="alert"]', 1000)
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const errorElement = this.page.locator('[data-testid="error"], .error, [role="alert"]').first()
    return (await errorElement.textContent()) || ''
  }
}
