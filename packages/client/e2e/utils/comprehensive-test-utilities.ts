/**
 * Comprehensive Test Utilities for Master Test Coordination
 *
 * This module provides a complete suite of utilities for coordinated test execution,
 * including performance measurement, visual testing, data validation, and debugging tools.
 */

import { Page, expect, TestInfo, Locator } from '@playwright/test'
import { TestDataManager } from './test-data-manager'
import { MCPIntegrationSafety } from './mcp-integration-safety'
import { ParallelExecutionCoordinator } from './parallel-execution-coordinator'

/**
 * Performance metrics for test operations
 */
interface PerformanceMetrics {
  pageLoadTime: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay: number
  operationTimes: Map<string, number>
  memoryUsage?: number
}

/**
 * Test step result with metadata
 */
interface TestStepResult {
  stepName: string
  success: boolean
  duration: number
  error?: string
  screenshot?: string
  metrics?: Partial<PerformanceMetrics>
}

/**
 * Comprehensive test context
 */
interface ComprehensiveTestContext {
  testInfo: TestInfo
  dataManager: TestDataManager
  safetyManager: MCPIntegrationSafety
  coordinator: ParallelExecutionCoordinator
  page: Page
  steps: TestStepResult[]
  startTime: number
}

/**
 * Visual testing configuration
 */
interface VisualTestConfig {
  threshold: number
  maxDiffPixels: number
  animations: 'disabled' | 'allow' | 'hide'
  clip?: { x: number; y: number; width: number; height: number }
  mask?: Locator[]
}

/**
 * Comprehensive Test Utilities class
 */
export class ComprehensiveTestUtilities {
  private context: ComprehensiveTestContext
  private performanceObserver?: any

  constructor(context: ComprehensiveTestContext) {
    this.context = context
  }

  /**
   * Create a comprehensive test context
   */
  static async create(page: Page, testInfo: TestInfo): Promise<ComprehensiveTestUtilities> {
    const dataManager = new TestDataManager(page, testInfo)
    const safetyManager = MCPIntegrationSafety.getInstance(page)
    const coordinator = ParallelExecutionCoordinator.getInstance()

    const context: ComprehensiveTestContext = {
      testInfo,
      dataManager,
      safetyManager,
      coordinator,
      page,
      steps: [],
      startTime: Date.now()
    }

    return new ComprehensiveTestUtilities(context)
  }

  /**
   * Execute a test step with comprehensive tracking
   */
  async executeStep<T>(
    stepName: string,
    operation: () => Promise<T>,
    options: {
      timeout?: number
      retryCount?: number
      takeScreenshot?: boolean
      measurePerformance?: boolean
    } = {}
  ): Promise<T> {
    const { timeout = 30000, retryCount = 0, takeScreenshot = false, measurePerformance = false } = options

    const startTime = Date.now()
    let result: T
    let error: Error | undefined
    let screenshot: string | undefined

    console.log(`📋 Executing step: ${stepName}`)

    try {
      // Set up performance monitoring if requested
      if (measurePerformance) {
        await this.startPerformanceMonitoring()
      }

      // Execute operation with timeout
      result = await this.executeWithTimeout(operation, timeout)

      // Take screenshot if successful and requested
      if (takeScreenshot) {
        screenshot = await this.takeStepScreenshot(stepName, 'success')
      }

      const duration = Date.now() - startTime
      const metrics = measurePerformance ? await this.getPerformanceMetrics() : undefined

      this.context.steps.push({
        stepName,
        success: true,
        duration,
        screenshot,
        metrics
      })

      console.log(`✅ Step completed: ${stepName} (${duration}ms)`)
      return result
    } catch (caughtError) {
      error = caughtError as Error
      const duration = Date.now() - startTime

      // Take screenshot on error
      screenshot = await this.takeStepScreenshot(stepName, 'error')

      this.context.steps.push({
        stepName,
        success: false,
        duration,
        error: error.message,
        screenshot
      })

      // Retry logic
      if (retryCount > 0) {
        console.log(`🔄 Retrying step: ${stepName} (${retryCount} attempts remaining)`)
        await this.delay(1000) // Brief delay before retry
        return this.executeStep(stepName, operation, { ...options, retryCount: retryCount - 1 })
      }

      console.error(`❌ Step failed: ${stepName} - ${error.message}`)
      throw error
    }
  }

  /**
   * Measure page load performance
   */
  async measurePageLoad(url?: string): Promise<PerformanceMetrics> {
    const startTime = Date.now()

    if (url) {
      await this.context.page.goto(url)
    }

    // Wait for page to be ready
    await this.context.page.waitForLoadState('networkidle')

    // Get performance metrics
    const performanceMetrics = await this.context.page.evaluate(() => {
      const timing = performance.timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

      return {
        pageLoadTime: timing.loadEventEnd - timing.navigationStart,
        firstContentfulPaint: 0, // Will be updated below
        largestContentfulPaint: 0, // Will be updated below
        cumulativeLayoutShift: 0, // Will be updated below
        firstInputDelay: 0, // Will be updated below
        operationTimes: new Map(),
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
      }
    })

    // Get Core Web Vitals
    const webVitals = await this.context.page.evaluate(() => {
      return new Promise((resolve) => {
        let fcpValue = 0
        let lcpValue = 0
        let clsValue = 0
        let fidValue = 0

        // First Contentful Paint
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              fcpValue = entry.startTime
            }
          }
        }).observe({ entryTypes: ['paint'] })

        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          if (entries.length > 0) {
            lcpValue = entries[entries.length - 1].startTime
          }
        }).observe({ entryTypes: ['largest-contentful-paint'] })

        // Cumulative Layout Shift
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        }).observe({ entryTypes: ['layout-shift'] })

        // First Input Delay
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            fidValue = (entry as any).processingStart - entry.startTime
          }
        }).observe({ entryTypes: ['first-input'] })

        // Resolve after a brief wait to collect metrics
        setTimeout(() => {
          resolve({
            firstContentfulPaint: fcpValue,
            largestContentfulPaint: lcpValue,
            cumulativeLayoutShift: clsValue,
            firstInputDelay: fidValue
          })
        }, 1000)
      })
    })

    return {
      ...performanceMetrics,
      ...(webVitals as any),
      pageLoadTime: Date.now() - startTime
    }
  }

  /**
   * Start performance monitoring
   */
  private async startPerformanceMonitoring(): Promise<void> {
    await this.context.page.addInitScript(() => {
      window.performanceData = {
        marks: new Map(),
        measures: new Map()
      }

      window.markPerformance = (name: string) => {
        performance.mark(name)
        window.performanceData.marks.set(name, performance.now())
      }

      window.measurePerformance = (name: string, startMark: string, endMark?: string) => {
        performance.measure(name, startMark, endMark)
        const measure = performance.getEntriesByName(name, 'measure')[0]
        window.performanceData.measures.set(name, measure.duration)
      }
    })
  }

  /**
   * Get current performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return await this.context.page.evaluate(() => {
      const data = (window as any).performanceData || { marks: new Map(), measures: new Map() }

      return {
        pageLoadTime: performance.now(),
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0,
        operationTimes: data.measures,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
      }
    })
  }

  /**
   * Perform visual regression testing
   */
  async performVisualTest(
    name: string,
    element?: Locator | string,
    config: VisualTestConfig = {
      threshold: 0.2,
      maxDiffPixels: 100,
      animations: 'disabled'
    }
  ): Promise<void> {
    const { page } = this.context

    // Disable animations for consistent screenshots
    if (config.animations === 'disabled') {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-delay: -1ms !important;
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            background-attachment: initial !important;
            scroll-behavior: auto !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
      })
    }

    // Wait for animations to settle
    await this.delay(100)

    const screenshotOptions: any = {
      threshold: config.threshold,
      maxDiffPixels: config.maxDiffPixels,
      animations: config.animations === 'allow' ? 'allow' : 'disabled'
    }

    if (config.clip) {
      screenshotOptions.clip = config.clip
    }

    if (config.mask) {
      screenshotOptions.mask = config.mask
    }

    if (element) {
      if (typeof element === 'string') {
        await expect(page.locator(element)).toHaveScreenshot(`${name}.png`, screenshotOptions)
      } else {
        await expect(element).toHaveScreenshot(`${name}.png`, screenshotOptions)
      }
    } else {
      await expect(page).toHaveScreenshot(`${name}.png`, screenshotOptions)
    }
  }

  /**
   * Test responsive behavior across different viewport sizes
   */
  async testResponsiveBehavior(
    testFn: (viewportSize: { width: number; height: number }) => Promise<void>,
    viewports: { name: string; width: number; height: number }[] = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'wide', width: 1920, height: 1080 }
    ]
  ): Promise<void> {
    for (const viewport of viewports) {
      await this.executeStep(`Test responsive behavior: ${viewport.name}`, async () => {
        await this.context.page.setViewportSize({
          width: viewport.width,
          height: viewport.height
        })

        // Wait for responsive changes to settle
        await this.delay(500)

        await testFn(viewport)
      })
    }
  }

  /**
   * Test accessibility compliance
   */
  async testAccessibility(
    options: {
      includeTags?: string[]
      excludeTags?: string[]
      element?: string
    } = {}
  ): Promise<any> {
    const { includeTags = [], excludeTags = [], element } = options

    // Inject axe-core for accessibility testing
    await this.context.page.addScriptTag({
      url: 'https://unpkg.com/axe-core@4.6.3/axe.min.js'
    })

    const results = await this.context.page.evaluate(
      (testOptions) => {
        return (window as any).axe.run(testOptions.element || document, {
          tags: testOptions.includeTags,
          exclude: testOptions.excludeTags
        })
      },
      { includeTags, excludeTags, element }
    )

    // Assert no violations
    if (results.violations.length > 0) {
      console.error('Accessibility violations found:', results.violations)
      throw new Error(`Found ${results.violations.length} accessibility violations`)
    }

    return results
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(
    startElement: string,
    expectedElements: string[],
    keys: string[] = ['Tab']
  ): Promise<void> {
    await this.context.page.locator(startElement).focus()

    for (let i = 0; i < expectedElements.length; i++) {
      await this.context.page.keyboard.press(keys[0])
      await expect(this.context.page.locator(expectedElements[i])).toBeFocused()
    }
  }

  /**
   * Wait for element with enhanced options
   */
  async waitForElement(
    selector: string,
    options: {
      state?: 'attached' | 'detached' | 'visible' | 'hidden'
      timeout?: number
      retryInterval?: number
    } = {}
  ): Promise<Locator> {
    const { state = 'visible', timeout = 30000, retryInterval = 1000 } = options

    const element = this.context.page.locator(selector)
    await element.waitFor({ state, timeout })

    return element
  }

  /**
   * Fill form with comprehensive validation
   */
  async fillForm(
    formData: Record<string, any>,
    options: {
      validateOnBlur?: boolean
      submitAfterFill?: boolean
      formSelector?: string
    } = {}
  ): Promise<void> {
    const { validateOnBlur = true, submitAfterFill = false, formSelector } = options

    for (const [fieldName, value] of Object.entries(formData)) {
      const field = this.context.page.locator(`[name="${fieldName}"]`)

      await field.fill(value.toString())

      if (validateOnBlur) {
        await field.blur()
        // Wait a brief moment for validation to trigger
        await this.delay(100)
      }
    }

    if (submitAfterFill) {
      const submitButton = formSelector
        ? this.context.page.locator(`${formSelector} [type="submit"]`)
        : this.context.page.locator('[type="submit"]')

      await submitButton.click()
    }
  }

  /**
   * Test API endpoints integration
   */
  async testAPIEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    expectedStatus: number = 200
  ): Promise<any> {
    const response = await this.context.page.request.fetch(endpoint, {
      method,
      data: method !== 'GET' ? data : undefined
    })

    expect(response.status()).toBe(expectedStatus)

    if (response.headers()['content-type']?.includes('application/json')) {
      return await response.json()
    }

    return await response.text()
  }

  /**
   * Handle flaky tests with advanced retry logic
   */
  async handleFlakyOperation<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      retryDelay?: number
      retryCondition?: (error: Error) => boolean
      onRetry?: (attempt: number, error: Error) => void
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, retryCondition = () => true, onRetry = () => {} } = options

    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt > maxRetries || !retryCondition(lastError)) {
          throw lastError
        }

        onRetry(attempt, lastError)
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries}: ${lastError.message}`)

        // Exponential backoff
        await this.delay(retryDelay * Math.pow(2, attempt - 1))
      }
    }

    throw lastError!
  }

  /**
   * Take step screenshot with context
   */
  private async takeStepScreenshot(stepName: string, status: 'success' | 'error'): Promise<string> {
    const filename = `step-${stepName.replace(/\s+/g, '-')}-${status}-${Date.now()}.png`
    const screenshotPath = `test-results/${this.context.testInfo.testId}/${filename}`

    await this.context.page.screenshot({
      path: screenshotPath,
      fullPage: true
    })

    return screenshotPath
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`))
      }, timeout)

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer))
    })
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get comprehensive test report
   */
  getTestReport(): {
    testInfo: TestInfo
    duration: number
    steps: TestStepResult[]
    successRate: number
    totalOperationTime: number
    averageStepTime: number
  } {
    const duration = Date.now() - this.context.startTime
    const successfulSteps = this.context.steps.filter((s) => s.success).length
    const successRate = this.context.steps.length > 0 ? (successfulSteps / this.context.steps.length) * 100 : 0
    const totalOperationTime = this.context.steps.reduce((sum, s) => sum + s.duration, 0)
    const averageStepTime = this.context.steps.length > 0 ? totalOperationTime / this.context.steps.length : 0

    return {
      testInfo: this.context.testInfo,
      duration,
      steps: [...this.context.steps],
      successRate,
      totalOperationTime,
      averageStepTime
    }
  }

  /**
   * Cleanup test resources
   */
  async cleanup(): Promise<void> {
    await this.context.dataManager.cleanup()
    this.context.safetyManager.cleanup()
  }
}

/**
 * Test utility functions for common operations
 */
export const TestUtilities = {
  /**
   * Wait for toast notification
   */
  async waitForToast(page: Page, message?: string, timeout = 5000): Promise<Locator> {
    const toastSelector = '[data-sonner-toast]'
    const toast = page.locator(toastSelector).first()

    await toast.waitFor({ state: 'visible', timeout })

    if (message) {
      await expect(toast).toContainText(message)
    }

    return toast
  },

  /**
   * Wait for loading states to complete
   */
  async waitForLoadingComplete(page: Page, timeout = 10000): Promise<void> {
    // Wait for common loading indicators to disappear
    const loadingSelectors = ['[data-testid="loading"]', '.spinner', '.loading', '[aria-label*="loading"]']

    for (const selector of loadingSelectors) {
      const loadingElement = page.locator(selector)
      if ((await loadingElement.count()) > 0) {
        await loadingElement.waitFor({ state: 'hidden', timeout })
      }
    }

    // Wait for network idle
    await page.waitForLoadState('networkidle')
  },

  /**
   * Clear all browser data
   */
  async clearBrowserData(page: Page): Promise<void> {
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Clear cookies
    await page.context().clearCookies()
  },

  /**
   * Mock time for consistent testing
   */
  async mockTime(page: Page, timestamp: number): Promise<void> {
    await page.addInitScript(`
      Date.now = () => ${timestamp};
      Date.prototype.getTime = () => ${timestamp};
    `)
  },

  /**
   * Generate test data with specific patterns
   */
  generateTestData: {
    email: (prefix = 'test') => `${prefix}+${Date.now()}@example.com`,
    phone: () => `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    url: (path = '') => `https://test-${Date.now()}.example.com${path}`,
    uuid: () => crypto.randomUUID(),
    name: () => `Test User ${Date.now()}`,
    text: (length = 10) =>
      Array(length)
        .fill(0)
        .map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
        .join('')
  }
}
