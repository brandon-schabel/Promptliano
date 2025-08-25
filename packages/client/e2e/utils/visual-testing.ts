/**
 * Visual Regression Testing Utilities
 * 
 * Provides comprehensive visual testing capabilities with screenshot comparison,
 * responsive testing, and component-level visual validation.
 */

import { type Page, type Locator, expect } from '@playwright/test'
import path from 'path'

export interface VisualTestOptions {
  threshold?: number
  maxDiffPixels?: number
  animations?: 'disabled' | 'allow'
  clip?: { x: number; y: number; width: number; height: number }
  fullPage?: boolean
  mask?: Locator[]
  mode?: 'light' | 'dark' | 'both'
}

export interface ResponsiveBreakpoint {
  name: string
  width: number
  height: number
}

export interface ComponentVisualTest {
  name: string
  selector: string
  states?: string[]
  interactions?: Array<{
    name: string
    action: (locator: Locator) => Promise<void>
  }>
}

/**
 * Visual regression testing utilities
 */
export class VisualTesting {
  private static readonly DEFAULT_BREAKPOINTS: ResponsiveBreakpoint[] = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide', width: 1920, height: 1080 }
  ]

  /**
   * Take a full page screenshot with comparison
   */
  static async compareFullPage(
    page: Page,
    name: string,
    options: VisualTestOptions = {}
  ): Promise<void> {
    const {
      threshold = 0.1,
      maxDiffPixels = 100,
      animations = 'disabled',
      fullPage = true,
      mask = [],
      mode = 'light'
    } = options

    await this.preparePageForVisualTesting(page, { animations, mode })

    const screenshotOptions = {
      fullPage,
      threshold,
      maxDiffPixels,
      mask,
      animations: animations === 'disabled' ? 'disabled' as const : 'allow' as const
    }

    await expect(page).toHaveScreenshot(`${name}-full-page.png`, screenshotOptions)
    console.log(`✅ Full page visual test passed: ${name}`)
  }

  /**
   * Take a component-specific screenshot
   */
  static async compareComponent(
    locator: Locator,
    name: string,
    options: VisualTestOptions = {}
  ): Promise<void> {
    const {
      threshold = 0.1,
      maxDiffPixels = 50,
      animations = 'disabled',
      mask = []
    } = options

    const page = locator.page()
    await this.preparePageForVisualTesting(page, { animations })

    // Ensure component is visible and stable
    await locator.waitFor({ state: 'visible' })
    await locator.scrollIntoViewIfNeeded()
    
    // Wait for any animations to complete
    await page.waitForTimeout(500)

    const screenshotOptions = {
      threshold,
      maxDiffPixels,
      mask,
      animations: animations === 'disabled' ? 'disabled' as const : 'allow' as const
    }

    await expect(locator).toHaveScreenshot(`${name}-component.png`, screenshotOptions)
    console.log(`✅ Component visual test passed: ${name}`)
  }

  /**
   * Test component across multiple responsive breakpoints
   */
  static async compareResponsive(
    page: Page,
    name: string,
    options: VisualTestOptions & {
      breakpoints?: ResponsiveBreakpoint[]
      component?: string
    } = {}
  ): Promise<void> {
    const {
      breakpoints = this.DEFAULT_BREAKPOINTS,
      component,
      ...visualOptions
    } = options

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({
        width: breakpoint.width,
        height: breakpoint.height
      })

      // Wait for responsive changes to apply
      await page.waitForTimeout(500)

      const testName = `${name}-${breakpoint.name}`

      if (component) {
        const locator = page.locator(component)
        await this.compareComponent(locator, testName, visualOptions)
      } else {
        await this.compareFullPage(page, testName, visualOptions)
      }
    }

    console.log(`✅ Responsive visual tests passed for: ${name}`)
  }

  /**
   * Test component in different states (hover, focus, active, etc.)
   */
  static async compareComponentStates(
    page: Page,
    tests: ComponentVisualTest[],
    options: VisualTestOptions = {}
  ): Promise<void> {
    for (const test of tests) {
      const locator = page.locator(test.selector)
      
      // Default state
      await this.compareComponent(locator, `${test.name}-default`, options)
      
      // Test specific states if defined
      if (test.states) {
        for (const state of test.states) {
          await this.applyState(locator, state)
          await this.compareComponent(locator, `${test.name}-${state}`, options)
        }
      }
      
      // Test interactions if defined
      if (test.interactions) {
        for (const interaction of test.interactions) {
          await interaction.action(locator)
          await this.compareComponent(locator, `${test.name}-${interaction.name}`, options)
        }
      }
      
      // Reset to default state
      await this.resetComponentState(page, locator)
    }

    console.log(`✅ Component state visual tests completed`)
  }

  /**
   * Test dark/light mode variations
   */
  static async compareThemes(
    page: Page,
    name: string,
    options: Omit<VisualTestOptions, 'mode'> & {
      component?: string
      themes?: string[]
    } = {}
  ): Promise<void> {
    const {
      themes = ['light', 'dark'],
      component,
      ...visualOptions
    } = options

    for (const theme of themes) {
      await this.setTheme(page, theme)
      
      const testName = `${name}-${theme}`

      if (component) {
        const locator = page.locator(component)
        await this.compareComponent(locator, testName, visualOptions)
      } else {
        await this.compareFullPage(page, testName, visualOptions)
      }
    }

    console.log(`✅ Theme visual tests passed for: ${name}`)
  }

  /**
   * Create a visual test suite for a complete page
   */
  static async createPageVisualSuite(
    page: Page,
    pageName: string,
    options: {
      includeResponsive?: boolean
      includeThemes?: boolean
      includeComponents?: ComponentVisualTest[]
      customBreakpoints?: ResponsiveBreakpoint[]
    } = {}
  ): Promise<void> {
    const {
      includeResponsive = true,
      includeThemes = true,
      includeComponents = [],
      customBreakpoints
    } = options

    console.log(`🎨 Starting visual test suite for: ${pageName}`)

    // Full page screenshot
    await this.compareFullPage(page, pageName)

    // Responsive testing
    if (includeResponsive) {
      await this.compareResponsive(page, pageName, {
        breakpoints: customBreakpoints
      })
    }

    // Theme testing
    if (includeThemes) {
      await this.compareThemes(page, pageName)
    }

    // Component-specific testing
    if (includeComponents.length > 0) {
      await this.compareComponentStates(page, includeComponents)
    }

    console.log(`✅ Visual test suite completed for: ${pageName}`)
  }

  /**
   * Prepare page for consistent visual testing
   */
  private static async preparePageForVisualTesting(
    page: Page,
    options: { animations?: 'disabled' | 'allow'; mode?: string } = {}
  ): Promise<void> {
    const { animations = 'disabled', mode = 'light' } = options

    // Disable animations for consistent screenshots
    if (animations === 'disabled') {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
      })
    }

    // Set consistent theme
    if (mode === 'dark') {
      await this.setTheme(page, 'dark')
    } else {
      await this.setTheme(page, 'light')
    }

    // Wait for page to be fully loaded and stable
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Additional stability time
  }

  /**
   * Apply a specific state to a component
   */
  private static async applyState(locator: Locator, state: string): Promise<void> {
    const page = locator.page()

    switch (state) {
      case 'hover':
        await locator.hover()
        break
      case 'focus':
        await locator.focus()
        break
      case 'active':
        await page.mouse.down()
        break
      case 'disabled':
        await page.evaluate((el) => {
          if (el) el.setAttribute('disabled', 'true')
        }, await locator.elementHandle())
        break
      default:
        // Custom state - try to apply via class or data attribute
        await page.evaluate(([el, state]) => {
          if (el) {
            el.classList.add(`state-${state}`)
            el.setAttribute(`data-state`, state)
          }
        }, [await locator.elementHandle(), state])
    }

    await page.waitForTimeout(200) // Allow state to apply
  }

  /**
   * Reset component to default state
   */
  private static async resetComponentState(page: Page, locator: Locator): Promise<void> {
    // Click elsewhere to remove focus/hover
    await page.mouse.click(0, 0)
    
    // Release mouse if held down
    await page.mouse.up()
    
    // Remove custom state attributes
    await page.evaluate((el) => {
      if (el) {
        el.removeAttribute('disabled')
        Array.from(el.classList).forEach(cls => {
          if (cls.startsWith('state-')) {
            el.classList.remove(cls)
          }
        })
        el.removeAttribute('data-state')
      }
    }, await locator.elementHandle())

    await page.waitForTimeout(200)
  }

  /**
   * Set application theme
   */
  private static async setTheme(page: Page, theme: string): Promise<void> {
    // Try common theme switching methods
    await page.evaluate((themeValue) => {
      // Method 1: localStorage
      localStorage.setItem('theme', themeValue)
      
      // Method 2: data attribute on html
      document.documentElement.setAttribute('data-theme', themeValue)
      
      // Method 3: class on html
      document.documentElement.className = document.documentElement.className
        .replace(/theme-\w+/g, '')
        .concat(` theme-${themeValue}`)
      
      // Method 4: CSS variables
      if (themeValue === 'dark') {
        document.documentElement.style.setProperty('--color-scheme', 'dark')
      } else {
        document.documentElement.style.setProperty('--color-scheme', 'light')
      }
      
      // Trigger theme change event if application uses it
      window.dispatchEvent(new CustomEvent('themechange', { detail: themeValue }))
    }, theme)

    // Wait for theme to apply
    await page.waitForTimeout(500)
  }

  /**
   * Create visual diff report
   */
  static async generateVisualReport(
    testResults: Array<{
      name: string
      passed: boolean
      diffPixels?: number
      threshold?: number
    }>
  ): Promise<string> {
    const totalTests = testResults.length
    const passedTests = testResults.filter(t => t.passed).length
    const failedTests = totalTests - passedTests

    const report = `
# Visual Regression Test Report

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${failedTests}
- Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%

## Failed Tests
${testResults
  .filter(t => !t.passed)
  .map(t => `- ${t.name}: ${t.diffPixels} pixels changed (threshold: ${t.threshold})`)
  .join('\n')}

## Passed Tests
${testResults
  .filter(t => t.passed)
  .map(t => `- ${t.name}`)
  .join('\n')}
    `.trim()

    // Save report to file
    const fs = require('fs/promises')
    const reportPath = path.join('test-results', 'visual-regression-report.md')
    await fs.writeFile(reportPath, report, 'utf-8')

    console.log(`📊 Visual regression report generated: ${reportPath}`)
    return report
  }
}

/**
 * Visual test configuration presets
 */
export const VISUAL_TEST_PRESETS = {
  // Strict comparison for critical UI components
  strict: {
    threshold: 0.05,
    maxDiffPixels: 20,
    animations: 'disabled' as const
  },
  
  // Relaxed comparison for dynamic content areas
  relaxed: {
    threshold: 0.2,
    maxDiffPixels: 200,
    animations: 'allow' as const
  },
  
  // Component-focused testing
  component: {
    threshold: 0.1,
    maxDiffPixels: 50,
    animations: 'disabled' as const,
    fullPage: false
  },
  
  // Mobile-optimized testing
  mobile: {
    threshold: 0.15,
    maxDiffPixels: 100,
    animations: 'disabled' as const,
    clip: { x: 0, y: 0, width: 375, height: 667 }
  }
} as const

/**
 * Common component visual tests
 */
export const COMMON_COMPONENT_TESTS: ComponentVisualTest[] = [
  {
    name: 'button-primary',
    selector: 'button[type="submit"], .btn-primary',
    states: ['hover', 'focus', 'disabled']
  },
  {
    name: 'form-input',
    selector: 'input[type="text"], input[type="email"]',
    states: ['focus', 'disabled'],
    interactions: [
      {
        name: 'with-value',
        action: async (locator) => {
          await locator.fill('Sample text')
        }
      }
    ]
  },
  {
    name: 'navigation-menu',
    selector: 'nav, .navigation',
    states: ['hover']
  },
  {
    name: 'data-table',
    selector: 'table, .data-table',
    states: []
  },
  {
    name: 'modal-dialog',
    selector: '[role="dialog"], .modal',
    states: []
  }
]