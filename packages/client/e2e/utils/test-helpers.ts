import { type Page, expect } from '@playwright/test'
import { API_ENDPOINTS, HTTP_STATUS, API_PATTERNS, getCorrectedEndpoint } from './api-endpoint-config'
import { TestErrorHandler, PageLoadHelper, FormHelper } from './error-handling'
import { FlakyTestPrevention } from './flaky-test-patterns'

/**
 * Common assertion helpers for E2E tests
 */
export class TestAssertions {
  /**
   * Assert that an API response was successful
   */
  static async assertSuccessfulAPIResponse(
    page: Page,
    urlPattern: string | RegExp,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
  ) {
    const response = await page.waitForResponse(
      (response) => response.url().match(urlPattern) !== null && response.request().method() === method
    )

    expect(response.status()).toBe(200)

    const responseBody = await response.json().catch(() => ({}))
    expect(responseBody.success).toBe(true)

    return responseBody
  }

  /**
   * Assert that a toast notification appears
   */
  static async assertToastMessage(page: Page, message: string) {
    const toast = page.locator(`[data-sonner-toast]:has-text("${message}")`)
    await expect(toast).toBeVisible({ timeout: 5000 })
  }

  /**
   * Assert that a confirmation dialog appears and handle it
   */
  static async assertAndHandleConfirmation(page: Page, action: 'accept' | 'dismiss' = 'accept') {
    const dialog = page.locator('[role="dialog"], [data-testid="confirmation-dialog"]')
    await expect(dialog).toBeVisible()

    if (action === 'accept') {
      await page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').click()
    } else {
      await page.locator('button:has-text("Cancel"), button:has-text("No")').click()
    }
  }

  /**
   * Assert that page navigation occurred
   */
  static async assertNavigation(page: Page, expectedPattern: string | RegExp) {
    await expect(page).toHaveURL(expectedPattern)
  }

  /**
   * Assert that loading has completed
   */
  static async assertLoadingComplete(page: Page) {
    // Wait for loading spinners to disappear
    await page
      .waitForSelector('[data-testid="loading"], .loading, [aria-label*="loading"]', {
        state: 'hidden',
        timeout: 10000
      })
      .catch(() => {
        // Ignore if no loading indicators exist
      })

    // Wait for network to be idle
    await page.waitForLoadState('networkidle')
  }

  /**
   * Assert that an error message is displayed
   */
  static async assertErrorMessage(page: Page, expectedMessage?: string) {
    const errorElement = page.locator('[data-testid="error"], .error, [role="alert"]')
    await expect(errorElement).toBeVisible()

    if (expectedMessage) {
      await expect(errorElement).toContainText(expectedMessage)
    }
  }

  /**
   * Assert that no error messages are displayed
   */
  static async assertNoErrors(page: Page) {
    const errorElement = page.locator('[data-testid="error"], .error, [role="alert"]')
    await expect(errorElement).not.toBeVisible()
  }
}

/**
 * Utilities for interacting with the MCP system
 */
export class MCPTestHelpers {
  /**
   * Simulate MCP tool call via the browser
   */
  static async callMCPTool(page: Page, toolName: string, args: Record<string, any>) {
    // This would depend on how MCP tools are exposed in the browser
    // For now, we'll simulate via the global window object
    const result = await page.evaluate(
      async ({ tool, arguments: toolArgs }) => {
        // @ts-ignore - MCP client would be exposed globally
        return await window.mcpClient?.call(tool, toolArgs)
      },
      { tool: toolName, arguments: args }
    )

    return result
  }

  /**
   * Test project manager MCP tool
   */
  static async testProjectManagerTool(page: Page, action: string, data?: any) {
    return await this.callMCPTool(page, 'project_manager', {
      action,
      data
    })
  }

  /**
   * Test ticket manager MCP tool
   */
  static async testTicketManagerTool(page: Page, action: string, data?: any) {
    // Map legacy ticket_manager calls to flow_manager actions
    const map: Record<string, { action: string; transform?: (d: any) => any }> = {
      create: {
        action: 'tickets_create',
        transform: (d) => ({
          title: d?.ticket?.title ?? d?.title,
          overview: d?.ticket?.overview ?? d?.overview,
          priority: d?.ticket?.priority ?? d?.priority,
          projectId: d?.projectId
        })
      },
      list: { action: 'tickets_list' },
      update_status: { action: 'tickets_update' },
      get_status: { action: 'tickets_get' }
    }
    const mapped = map[action] || { action }
    const payload = mapped.transform ? mapped.transform(data) : data
    return await this.callMCPTool(page, 'flow_manager', { action: mapped.action, ...payload })
  }

  /**
   * Test queue processor MCP tool
   */
  static async testQueueProcessorTool(page: Page, action: string, data?: any) {
    // Map legacy queue_processor calls to flow_manager
    const map: Record<string, { action: string; transform?: (d: any) => any }> = {
      create_queue: {
        action: 'queues_create',
        transform: (d) => ({
          name: d?.queue?.name ?? d?.name,
          description: d?.queue?.description ?? d?.description,
          projectId: d?.queue?.projectId ?? d?.projectId,
          maxParallelItems: d?.queue?.maxParallelItems
        })
      },
      add_item: {
        action: 'enqueue_ticket',
        transform: (d) => ({ queueId: d?.queueId, ticketId: d?.itemId, priority: d?.priority })
      },
      start_processing: {
        action: 'processor_get_next',
        transform: (d) => ({ queueId: d?.queueId, agentId: d?.agentId ?? 'test-agent' })
      },
      get_queue_status: {
        action: 'queues_get_stats',
        transform: (d) => ({ queueId: d?.queueId })
      },
      get_status: {
        action: 'queues_get_stats',
        transform: (d) => ({ queueId: d?.queueId })
      }
    }
    const mapped = map[action] || { action }
    const payload = mapped.transform ? mapped.transform(data) : data
    return await this.callMCPTool(page, 'flow_manager', { action: mapped.action, ...payload })
  }

  /**
   * Test prompt manager MCP tool
   */
  static async testPromptManagerTool(page: Page, action: string, data?: any) {
    return await this.callMCPTool(page, 'prompt_manager', {
      action,
      data
    })
  }

  /**
   * Verify MCP tools are available
   */
  static async verifyMCPToolsAvailable(page: Page): Promise<string[]> {
    const availableTools = await page.evaluate(() => {
      // @ts-ignore - MCP client would be exposed globally
      return window.mcpClient?.listTools() || []
    })

    return availableTools
  }
}

/**
 * API interaction helpers
 */
export class APITestHelpers {
  /**
   * Make direct API call for test setup/teardown
   */
  static async makeAPICall(
    page: Page,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ) {
    const baseUrl = new URL(page.url()).origin.replace(':5173', ':3147') // Client port to API port

    const response = await page.evaluate(
      async ({ url, method, body }) => {
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json'
          }
        }

        if (body && method !== 'GET') {
          options.body = JSON.stringify(body)
        }

        const res = await fetch(url, options)
        return {
          status: res.status,
          ok: res.ok,
          data: await res.json().catch(() => ({}))
        }
      },
      { url: `${baseUrl}${endpoint}`, method, body }
    )

    return response
  }

  /**
   * Create test project via API using correct endpoint
   */
  static async createTestProject(page: Page, projectData: any) {
    return await this.makeAPICall(page, API_ENDPOINTS.PROJECTS.BASE, 'POST', projectData)
  }

  /**
   * Clean up test project via API using correct endpoint
   */
  static async deleteTestProject(page: Page, projectId: number) {
    return await this.makeAPICall(page, API_ENDPOINTS.PROJECTS.BY_ID(projectId), 'DELETE')
  }

  /**
   * Create test prompt via API using correct endpoint
   */
  static async createTestPrompt(page: Page, promptData: any) {
    return await this.makeAPICall(page, API_ENDPOINTS.PROMPTS.BASE, 'POST', promptData)
  }

  /**
   * Create test ticket via API using correct endpoint
   */
  static async createTestTicket(page: Page, ticketData: any) {
    return await this.makeAPICall(page, API_ENDPOINTS.TICKETS.BASE, 'POST', ticketData)
  }

  /**
   * Create test queue via API using correct endpoint
   */
  static async createTestQueue(page: Page, queueData: any) {
    return await this.makeAPICall(page, API_ENDPOINTS.QUEUES.BASE, 'POST', queueData)
  }
}

/**
 * Enhanced API testing utilities with endpoint validation
 */
export class EnhancedAPIHelpers {
  /**
   * Make API call with automatic endpoint correction
   */
  static async makeAPICall(page: Page, endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: any) {
    const correctedEndpoint = getCorrectedEndpoint(endpoint)
    if (correctedEndpoint !== endpoint) {
      console.warn(`Corrected endpoint: ${endpoint} -> ${correctedEndpoint}`)
    }

    return await APITestHelpers.makeAPICall(page, correctedEndpoint, method, data)
  }

  /**
   * Wait for and validate API response with proper patterns
   */
  static async waitForAPIResponse(
    page: Page,
    urlPattern: string | RegExp,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    expectedStatus: number = HTTP_STATUS.OK
  ) {
    const response = await page.waitForResponse(
      (response) => response.url().match(urlPattern) !== null && response.request().method() === method
    )

    expect(response.status()).toBe(expectedStatus)

    if (expectedStatus >= 200 && expectedStatus < 300) {
      const responseBody = await response.json()
      if (method === 'POST' || method === 'PUT') {
        expect(responseBody).toMatchObject(API_PATTERNS.SUCCESS_RESPONSE)
      } else if (method === 'DELETE') {
        expect(responseBody).toMatchObject(API_PATTERNS.OPERATION_SUCCESS)
      }
      return responseBody
    }

    return response
  }

  /**
   * Mock API endpoint with realistic response
   */
  static async mockAPIEndpoint(
    page: Page,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    mockResponse: any,
    status: number = HTTP_STATUS.OK
  ) {
    await page.route(`**${endpoint}`, (route) => {
      if (route.request().method() === method) {
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Mock AI streaming endpoint for testing
   */
  static async mockAIStreamingEndpoint(page: Page, mockChunks: string[]) {
    await page.route(`**${API_ENDPOINTS.AI.CHAT}`, (route) => {
      if (route.request().method() === 'POST') {
        // Create Server-Sent Events stream
        const chunks = mockChunks.map((chunk) => `data: ${JSON.stringify({ content: chunk })}\n\n`)
        const body = chunks.join('') + 'data: [DONE]\n\n'

        route.fulfill({
          status: HTTP_STATUS.OK,
          contentType: 'text/event-stream',
          body
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Simulate API error for testing error handling
   */
  static async simulateAPIError(
    page: Page,
    endpoint: string,
    errorType: 'timeout' | 'network' | 'server' | 'validation' = 'server'
  ) {
    await page.route(`**${endpoint}`, (route) => {
      switch (errorType) {
        case 'timeout':
          // Don't respond to simulate timeout
          break
        case 'network':
          route.abort('failed')
          break
        case 'validation':
          route.fulfill({
            status: HTTP_STATUS.VALIDATION_ERROR,
            contentType: 'application/json',
            body: JSON.stringify(API_PATTERNS.ERROR_RESPONSE)
          })
          break
        case 'server':
        default:
          route.fulfill({
            status: HTTP_STATUS.INTERNAL_ERROR,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Internal server error'
            })
          })
      }
    })
  }

  /**
   * Batch create test entities with proper cleanup tracking
   */
  static async batchCreateTestEntities<T>(
    page: Page,
    entityType: 'projects' | 'tickets' | 'prompts' | 'queues',
    entities: T[],
    cleanup: Set<{ type: string; id: number }>
  ): Promise<T[]> {
    const endpoint = {
      projects: API_ENDPOINTS.PROJECTS.BASE,
      tickets: API_ENDPOINTS.TICKETS.BASE,
      prompts: API_ENDPOINTS.PROMPTS.BASE,
      queues: API_ENDPOINTS.QUEUES.BASE
    }[entityType]

    const created: T[] = []

    for (const entity of entities) {
      const response = await this.makeAPICall(page, endpoint, 'POST', entity)
      const createdEntity = response.data
      created.push(createdEntity)
      cleanup.add({ type: entityType.slice(0, -1), id: createdEntity.id })
    }

    return created
  }
}

/**
 * Database seeding and cleanup helpers
 */
export class TestDataManager {
  private createdItems: Array<{ type: string; id: number }> = []

  constructor(private page: Page) { }

  /**
   * Create and track a test project
   */
  async createProject(projectData: any) {
    const response = await APITestHelpers.createTestProject(this.page, projectData)
    if (response.ok && response.data.data?.id) {
      this.createdItems.push({ type: 'project', id: response.data.data.id })
    }
    return response
  }

  /**
   * Create and track a test prompt
   */
  async createPrompt(promptData: any) {
    const response = await APITestHelpers.createTestPrompt(this.page, promptData)
    if (response.ok && response.data.data?.id) {
      this.createdItems.push({ type: 'prompt', id: response.data.data.id })
    }
    return response
  }

  /**
   * Create and track a test ticket
   */
  async createTicket(ticketData: any) {
    const response = await APITestHelpers.createTestTicket(this.page, ticketData)
    if (response.ok && response.data.data?.id) {
      this.createdItems.push({ type: 'ticket', id: response.data.data.id })
    }
    return response
  }

  /**
   * Clean up all created test data
   */
  async cleanup() {
    for (const item of this.createdItems) {
      try {
        await APITestHelpers.makeAPICall(this.page, `/api/${item.type}s/${item.id}`, 'DELETE')
      } catch (error) {
        console.warn(`Failed to cleanup ${item.type} ${item.id}:`, error)
      }
    }
    this.createdItems = []
  }

  /**
   * Get list of created items for verification
   */
  getCreatedItems() {
    return [...this.createdItems]
  }
}

/**
 * File system interaction helpers for testing
 */
export class FileSystemHelpers {
  /**
   * Create a temporary directory for testing
   */
  static async createTempDirectory(page: Page, dirName: string): Promise<string> {
    const tempPath = `/tmp/e2e-test-${Date.now()}-${dirName}`

    // This would need to be implemented based on how file system access works
    // in your application. It might use Electron APIs or other mechanisms.

    return tempPath
  }

  /**
   * Clean up temporary directories
   */
  static async cleanupTempDirectories(page: Page, paths: string[]) {
    // Implementation would depend on your file system access mechanism
    for (const path of paths) {
      try {
        // Cleanup logic here
        console.log(`Cleaning up ${path}`)
      } catch (error) {
        console.warn(`Failed to cleanup ${path}:`, error)
      }
    }
  }
}

/**
 * Performance testing helpers
 */
export class PerformanceHelpers {
  /**
   * Measure page load time
   */
  static async measurePageLoad(page: Page, url: string) {
    const startTime = Date.now()
    await page.goto(url, { waitUntil: 'networkidle' })
    const endTime = Date.now()

    return {
      loadTime: endTime - startTime,
      navigationTimings: await page.evaluate(() => {
        const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        return {
          dns: timing.domainLookupEnd - timing.domainLookupStart,
          tcp: timing.connectEnd - timing.connectStart,
          request: timing.responseStart - timing.requestStart,
          response: timing.responseEnd - timing.responseStart,
          domComplete: timing.domComplete - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart
        }
      })
    }
  }

  /**
   * Measure API response time
   */
  static async measureAPICall(page: Page, urlPattern: string | RegExp) {
    const startTime = Date.now()
    const response = await page.waitForResponse((resp) => resp.url().match(urlPattern) !== null)
    const endTime = Date.now()

    return {
      responseTime: endTime - startTime,
      status: response.status(),
      size: response.headers()['content-length'] || 0
    }
  }
}

/**
 * Accessibility testing helpers
 */
export class AccessibilityHelpers {
  /**
   * Check for basic accessibility violations
   */
  static async checkBasicAccessibility(page: Page) {
    const violations = await page.evaluate(() => {
      const issues: string[] = []

      // Check for images without alt text
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])')
      if (imagesWithoutAlt.length > 0) {
        issues.push(`Found ${imagesWithoutAlt.length} images without alt text`)
      }

      // Check for buttons without labels
      const buttonsWithoutLabels = document.querySelectorAll('button:not([aria-label]):not([title])')
      const unlabeledButtons = Array.from(buttonsWithoutLabels).filter((btn) => !btn.textContent?.trim())
      if (unlabeledButtons.length > 0) {
        issues.push(`Found ${unlabeledButtons.length} buttons without labels`)
      }

      // Check for form inputs without labels
      const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
      const unlabeledInputs = Array.from(inputsWithoutLabels).filter((input) => {
        const id = input.getAttribute('id')
        return !id || !document.querySelector(`label[for="${id}"]`)
      })
      if (unlabeledInputs.length > 0) {
        issues.push(`Found ${unlabeledInputs.length} inputs without labels`)
      }

      return issues
    })

    return violations
  }

  /**
   * Test keyboard navigation
   */
  static async testKeyboardNavigation(page: Page, expectedFocusableElements: string[]) {
    const focusedElements: string[] = []

    for (let i = 0; i < expectedFocusableElements.length; i++) {
      await page.keyboard.press('Tab')

      const focusedElement = await page.evaluate(() => {
        const focused = document.activeElement
        return focused
          ? focused.tagName.toLowerCase() + (focused.className ? '.' + focused.className.split(' ').join('.') : '')
          : ''
      })

      focusedElements.push(focusedElement)
    }

    return focusedElements
  }
}

/**
 * Screenshot and visual regression helpers
 */
export class VisualTestHelpers {
  /**
   * Take a screenshot of a specific element
   */
  static async screenshotElement(page: Page, selector: string, name: string) {
    const element = page.locator(selector)
    await element.screenshot({
      path: `e2e/screenshots/elements/${name}-${Date.now()}.png`
    })
  }

  /**
   * Take a full page screenshot
   */
  static async screenshotPage(page: Page, name: string) {
    await page.screenshot({
      path: `e2e/screenshots/pages/${name}-${Date.now()}.png`,
      fullPage: true
    })
  }

  /**
   * Compare visual state (basic implementation)
   */
  static async compareVisual(page: Page, selector: string, baselineName: string) {
    const element = page.locator(selector)

    // This would be expanded with actual visual regression testing tools
    await expect(element).toHaveScreenshot(`${baselineName}.png`)
  }
}

/**
 * Wait utilities for complex scenarios
 */
export class WaitHelpers {
  /**
   * Wait for multiple conditions to be met
   */
  static async waitForAll(conditions: Promise<any>[], timeout = 10000) {
    return await Promise.race([
      Promise.all(conditions),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout))
    ])
  }

  /**
   * Wait for any of multiple conditions to be met
   */
  static async waitForAny(conditions: Promise<any>[], timeout = 10000) {
    return await Promise.race([
      Promise.race(conditions),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout))
    ])
  }

  /**
   * Retry an operation until it succeeds
   */
  static async retryUntilSuccess<T>(operation: () => Promise<T>, maxAttempts = 5, delayMs = 1000): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError!.message}`)
  }
}
