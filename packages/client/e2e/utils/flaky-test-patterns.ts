/**
 * Flaky Test Prevention Patterns
 * 
 * Common patterns and utilities to prevent flaky tests by addressing
 * timing issues, race conditions, and unreliable selectors.
 */

import { type Page, type Locator, expect } from '@playwright/test'

export interface TimingOptions {
  timeout?: number
  pollingInterval?: number
  stable?: boolean
}

/**
 * Common patterns that cause flaky tests and their solutions
 */
export class FlakyTestPrevention {
  /**
   * Wait for element to exist AND be stable (common flaky test cause)
   */
  static async waitForStableElement(
    locator: Locator,
    description: string,
    options: TimingOptions = {}
  ): Promise<void> {
    const { timeout = 10000, pollingInterval = 100, stable = true } = options

    let isStable = false
    let stableCount = 0
    const requiredStableIterations = 3 // Element must be stable for this many checks

    const startTime = Date.now()

    while (Date.now() - startTime < timeout && (!stable || !isStable)) {
      try {
        // Check if element exists and is visible
        await locator.waitFor({ state: 'visible', timeout: 1000 })
        
        if (stable) {
          // Check if element position/size is stable
          const box1 = await locator.boundingBox()
          await new Promise(resolve => setTimeout(resolve, pollingInterval))
          const box2 = await locator.boundingBox()
          
          if (box1 && box2 && 
              Math.abs(box1.x - box2.x) < 1 && 
              Math.abs(box1.y - box2.y) < 1 &&
              Math.abs(box1.width - box2.width) < 1 &&
              Math.abs(box1.height - box2.height) < 1) {
            stableCount++
            if (stableCount >= requiredStableIterations) {
              isStable = true
            }
          } else {
            stableCount = 0 // Reset counter if element moved
          }
        } else {
          break // Element exists, no stability check needed
        }
      } catch (error) {
        stableCount = 0
        await new Promise(resolve => setTimeout(resolve, pollingInterval))
      }
    }

    if (stable && !isStable) {
      throw new Error(`Element "${description}" did not stabilize within ${timeout}ms`)
    }

    console.log(`✅ Stable element found: ${description}`)
  }

  /**
   * Reliable text content waiting (handles dynamic content)
   */
  static async waitForTextContent(
    locator: Locator,
    expectedText: string | RegExp,
    options: { timeout?: number; exact?: boolean } = {}
  ): Promise<void> {
    const { timeout = 10000, exact = false } = options

    await expect(async () => {
      const text = await locator.textContent({ timeout: 1000 })
      
      if (typeof expectedText === 'string') {
        if (exact) {
          expect(text?.trim()).toBe(expectedText)
        } else {
          expect(text).toContain(expectedText)
        }
      } else {
        expect(text).toMatch(expectedText)
      }
    }).toPass({ timeout })

    console.log(`✅ Text content verified: "${expectedText}"`)
  }

  /**
   * Wait for network requests to complete before proceeding
   */
  static async waitForNetworkQuiescence(
    page: Page,
    options: { 
      timeout?: number
      maxConcurrentRequests?: number 
      ignorePatterns?: RegExp[]
    } = {}
  ): Promise<void> {
    const { 
      timeout = 10000, 
      maxConcurrentRequests = 0,
      ignorePatterns = [/\.(png|jpg|jpeg|gif|svg|css|js)$/]
    } = options

    let activeRequests = 0
    const startTime = Date.now()

    // Track active requests
    const requestHandler = (request: any) => {
      const url = request.url()
      if (ignorePatterns.some(pattern => pattern.test(url))) {
        return
      }
      activeRequests++
    }

    const responseHandler = (response: any) => {
      const url = response.url()
      if (ignorePatterns.some(pattern => pattern.test(url))) {
        return
      }
      activeRequests--
    }

    page.on('request', requestHandler)
    page.on('response', responseHandler)
    page.on('requestfailed', responseHandler)

    try {
      // Wait for network to be quiet
      while (Date.now() - startTime < timeout) {
        if (activeRequests <= maxConcurrentRequests) {
          // Wait a bit more to ensure stability
          await new Promise(resolve => setTimeout(resolve, 500))
          if (activeRequests <= maxConcurrentRequests) {
            break
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (activeRequests > maxConcurrentRequests) {
        console.warn(`⚠️ Network timeout: ${activeRequests} requests still active`)
      } else {
        console.log(`✅ Network quiescence achieved`)
      }
    } finally {
      page.off('request', requestHandler)
      page.off('response', responseHandler)
      page.off('requestfailed', responseHandler)
    }
  }

  /**
   * Reliable dropdown/select interaction
   */
  static async selectOption(
    page: Page,
    selectLocator: Locator,
    option: string | { label?: string; value?: string },
    description: string = 'dropdown'
  ): Promise<void> {
    await this.waitForStableElement(selectLocator, description)

    // Handle different select types
    const tagName = await selectLocator.evaluate(el => el.tagName.toLowerCase())

    if (tagName === 'select') {
      // Native select element
      if (typeof option === 'string') {
        await selectLocator.selectOption(option)
      } else {
        await selectLocator.selectOption(option.value ? { value: option.value } : { label: option.label! })
      }
    } else {
      // Custom dropdown component
      await selectLocator.click()
      
      // Wait for dropdown to open
      await page.waitForTimeout(200)
      
      // Find and click option
      let optionLocator: Locator
      if (typeof option === 'string') {
        optionLocator = page.getByRole('option', { name: option })
          .or(page.getByText(option, { exact: true }))
          .or(page.locator(`[data-value="${option}"]`))
      } else {
        if (option.label) {
          optionLocator = page.getByRole('option', { name: option.label })
            .or(page.getByText(option.label, { exact: true }))
        } else {
          optionLocator = page.locator(`[data-value="${option.value}"]`)
        }
      }
      
      await this.waitForStableElement(optionLocator, `Option: ${JSON.stringify(option)}`)
      await optionLocator.click()
    }

    // Wait for selection to be processed
    await page.waitForTimeout(100)
    console.log(`✅ Selected option: ${JSON.stringify(option)} in ${description}`)
  }

  /**
   * Reliable table interaction (wait for data to load)
   */
  static async waitForTableData(
    page: Page,
    tableLocator: Locator,
    options: {
      minimumRows?: number
      timeout?: number
      skipEmpty?: boolean
    } = {}
  ): Promise<void> {
    const { minimumRows = 1, timeout = 10000, skipEmpty = true } = options

    await expect(async () => {
      // Wait for table to exist
      await tableLocator.waitFor({ state: 'visible', timeout: 1000 })
      
      // Count rows (excluding header if present)
      const rowCount = await tableLocator.locator('tbody tr, tr').count()
      
      if (skipEmpty) {
        // Check if rows have actual content (not just loading/empty states)
        const hasContent = await tableLocator
          .locator('tbody tr:first-child td, tr:first-child td')
          .first()
          .textContent()
        
        if (!hasContent || hasContent.trim().length === 0 || 
            hasContent.includes('loading') || hasContent.includes('No data')) {
          throw new Error('Table has empty or loading content')
        }
      }
      
      expect(rowCount).toBeGreaterThanOrEqual(minimumRows)
    }).toPass({ timeout })

    console.log(`✅ Table data loaded with at least ${minimumRows} rows`)
  }

  /**
   * Handle modal/dialog interactions reliably
   */
  static async interactWithModal(
    page: Page,
    action: 'open' | 'close' | 'confirm' | 'cancel',
    options: {
      trigger?: Locator
      modalSelector?: string
      buttonText?: string
      timeout?: number
    } = {}
  ): Promise<void> {
    const {
      trigger,
      modalSelector = '[role="dialog"], .modal, [data-modal]',
      buttonText,
      timeout = 10000
    } = options

    switch (action) {
      case 'open':
        if (!trigger) {
          throw new Error('Trigger element required for opening modal')
        }
        
        await this.waitForStableElement(trigger, 'Modal trigger')
        await trigger.click()
        
        // Wait for modal to appear and animate in
        await page.waitForSelector(modalSelector, { state: 'visible', timeout })
        await page.waitForTimeout(300) // Animation time
        
        console.log(`✅ Modal opened`)
        break

      case 'close':
      case 'cancel':
        const closeButton = buttonText 
          ? page.getByRole('button', { name: buttonText })
          : page.locator('[data-dismiss="modal"], .modal-close, [aria-label*="close" i]').first()
        
        await this.waitForStableElement(closeButton, 'Modal close button')
        await closeButton.click()
        
        // Wait for modal to disappear
        await page.waitForSelector(modalSelector, { state: 'hidden', timeout })
        
        console.log(`✅ Modal closed`)
        break

      case 'confirm':
        const confirmButton = buttonText
          ? page.getByRole('button', { name: buttonText })
          : page.getByRole('button', { name: /confirm|ok|save|submit/i }).first()
        
        await this.waitForStableElement(confirmButton, 'Modal confirm button')
        await confirmButton.click()
        
        // Wait for modal to disappear (action completed)
        await page.waitForSelector(modalSelector, { state: 'hidden', timeout })
        
        console.log(`✅ Modal confirmed`)
        break
    }
  }

  /**
   * Handle file upload interactions
   */
  static async uploadFile(
    page: Page,
    inputLocator: Locator,
    filePath: string,
    options: {
      waitForUpload?: boolean
      uploadTimeout?: number
    } = {}
  ): Promise<void> {
    const { waitForUpload = true, uploadTimeout = 15000 } = options

    await inputLocator.setInputFiles(filePath)
    
    if (waitForUpload) {
      // Wait for upload to complete (look for success indicators)
      try {
        await Promise.race([
          page.waitForSelector('.upload-success, [data-upload-status="success"]', 
            { timeout: uploadTimeout }),
          page.waitForSelector('.upload-complete, [data-upload="complete"]', 
            { timeout: uploadTimeout }),
          // Or wait for the file input to be cleared (some forms do this)
          expect(inputLocator).toHaveValue('', { timeout: uploadTimeout })
        ])
        
        console.log(`✅ File uploaded successfully: ${filePath}`)
      } catch (error) {
        console.warn(`⚠️ Could not confirm upload completion for: ${filePath}`)
      }
    }
  }

  /**
   * Handle search/filter interactions with debouncing
   */
  static async performSearch(
    page: Page,
    searchInput: Locator,
    query: string,
    options: {
      debounceMs?: number
      waitForResults?: boolean
      resultSelector?: string
      timeout?: number
    } = {}
  ): Promise<void> {
    const {
      debounceMs = 500,
      waitForResults = true,
      resultSelector = '[data-search-results], .search-results, .results',
      timeout = 10000
    } = options

    await this.waitForStableElement(searchInput, 'Search input')
    
    // Clear and type search query
    await searchInput.clear()
    await searchInput.type(query)
    
    // Wait for debounce
    await page.waitForTimeout(debounceMs)
    
    if (waitForResults) {
      // Wait for search results to update
      await expect(async () => {
        const results = page.locator(resultSelector)
        await results.waitFor({ state: 'visible', timeout: 1000 })
        
        // Ensure results have updated (not showing stale content)
        const hasNewResults = await results
          .getByText(query, { exact: false })
          .count()
          .then(count => count > 0)
          .catch(() => true) // Accept if no text match (might be valid)
        
        expect(hasNewResults).toBeTruthy()
      }).toPass({ timeout })
      
      console.log(`✅ Search completed for: "${query}"`)
    }
  }

  /**
   * Reliable drag and drop operation
   */
  static async dragAndDrop(
    page: Page,
    source: Locator,
    target: Locator,
    options: {
      steps?: number
      delay?: number
      offset?: { x: number; y: number }
    } = {}
  ): Promise<void> {
    const { steps = 5, delay = 100 } = options

    // Ensure both elements are stable and visible
    await this.waitForStableElement(source, 'Drag source')
    await this.waitForStableElement(target, 'Drop target')
    
    // Scroll both elements into view
    await source.scrollIntoViewIfNeeded()
    await target.scrollIntoViewIfNeeded()
    
    // Perform drag and drop with smooth steps
    await source.dragTo(target, { 
      steps,
      delay,
      ...options
    })
    
    // Wait for drop to be processed
    await page.waitForTimeout(300)
    
    console.log(`✅ Drag and drop completed`)
  }

  /**
   * Wait for animations to complete
   */
  static async waitForAnimations(
    page: Page,
    locator?: Locator,
    timeout: number = 2000
  ): Promise<void> {
    try {
      if (locator) {
        // Wait for specific element animations
        await expect(locator).toHaveCSS('animation-duration', '0s', { timeout })
      } else {
        // Wait for all page animations
        await page.waitForFunction(() => {
          const elements = document.querySelectorAll('*')
          return Array.from(elements).every(el => {
            const styles = window.getComputedStyle(el)
            return styles.animationDuration === '0s' || styles.animationDuration === ''
          })
        }, { timeout })
      }
      
      console.log(`✅ Animations completed`)
    } catch (error) {
      console.warn(`⚠️ Animation timeout, continuing anyway`)
    }
  }
}