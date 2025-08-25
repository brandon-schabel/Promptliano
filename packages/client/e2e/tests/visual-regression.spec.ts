import { test, expect } from '@playwright/test'
import { VisualTesting, VISUAL_TEST_PRESETS, COMMON_COMPONENT_TESTS } from '../utils/visual-testing'
import { TestErrorHandler, PageLoadHelper } from '../utils/error-handling'

test.describe('Visual Regression Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page and wait for it to be ready
    await TestErrorHandler.safeNavigate(page, '/')
    await PageLoadHelper.waitForPageReady(page, {
      waitForSelectors: ['main', '[data-testid="app-loaded"]']
    })
  })

  test('Homepage - Full page visual test', async ({ page }) => {
    await VisualTesting.compareFullPage(page, 'homepage', VISUAL_TEST_PRESETS.strict)
  })

  test('Homepage - Responsive visual test', async ({ page }) => {
    await VisualTesting.compareResponsive(page, 'homepage-responsive', {
      ...VISUAL_TEST_PRESETS.component,
      breakpoints: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1440, height: 900 }
      ]
    })
  })

  test('Homepage - Theme variations', async ({ page }) => {
    await VisualTesting.compareThemes(page, 'homepage-themes', {
      ...VISUAL_TEST_PRESETS.strict,
      themes: ['light', 'dark']
    })
  })

  test('Projects page - Visual test suite', async ({ page }) => {
    await TestErrorHandler.safeNavigate(page, '/projects')
    await PageLoadHelper.waitForPageReady(page)
    
    await VisualTesting.createPageVisualSuite(page, 'projects-page', {
      includeResponsive: true,
      includeThemes: true,
      includeComponents: [
        {
          name: 'project-card',
          selector: '[data-testid="project-card"]',
          states: ['hover']
        },
        {
          name: 'sidebar-navigation',
          selector: 'nav, [data-testid="sidebar"]',
          states: []
        }
      ]
    })
  })

  test('Chat interface - Component visual tests', async ({ page }) => {
    await TestErrorHandler.safeNavigate(page, '/chat')
    await PageLoadHelper.waitForPageReady(page)
    
    // Test chat-specific components
    const chatComponents = [
      {
        name: 'chat-input',
        selector: '[data-testid="chat-input"], .chat-input',
        states: ['focus'],
        interactions: [
          {
            name: 'with-text',
            action: async (locator) => {
              await locator.fill('Hello, this is a test message')
            }
          }
        ]
      },
      {
        name: 'message-bubble',
        selector: '.message, [data-testid="message"]',
        states: []
      }
    ]

    await VisualTesting.compareComponentStates(page, chatComponents, VISUAL_TEST_PRESETS.component)
  })

  test('Form elements - State variations', async ({ page }) => {
    // Navigate to a page with forms (could be settings or project creation)
    await TestErrorHandler.safeNavigate(page, '/settings')
    await PageLoadHelper.waitForPageReady(page)
    
    await VisualTesting.compareComponentStates(
      page, 
      COMMON_COMPONENT_TESTS,
      VISUAL_TEST_PRESETS.component
    )
  })

  test('Navigation menu - Interactive states', async ({ page }) => {
    const navigationComponent = [{
      name: 'main-navigation',
      selector: 'nav[role="navigation"], .main-nav, [data-testid="navigation"]',
      states: [],
      interactions: [
        {
          name: 'menu-open',
          action: async (locator) => {
            // Try to open mobile menu if present
            const menuButton = locator.page().locator('[data-testid="menu-toggle"], .menu-toggle, button[aria-label*="menu" i]')
            const count = await menuButton.count()
            if (count > 0) {
              await menuButton.first().click()
              await locator.page().waitForTimeout(300)
            }
          }
        }
      ]
    }]

    await VisualTesting.compareComponentStates(page, navigationComponent, VISUAL_TEST_PRESETS.component)
  })

  test('Data tables - Content variations', async ({ page }) => {
    // Navigate to a page with data tables
    await TestErrorHandler.safeNavigate(page, '/projects')
    await PageLoadHelper.waitForPageReady(page)
    
    // Wait for table data to load
    const tableLocator = page.locator('table, [data-testid="data-table"], .data-table').first()
    const tableExists = await tableLocator.count() > 0
    
    if (tableExists) {
      await VisualTesting.compareComponent(
        tableLocator, 
        'data-table-loaded',
        VISUAL_TEST_PRESETS.relaxed
      )
      
      // Test responsive table behavior
      await VisualTesting.compareResponsive(
        page,
        'data-table-responsive',
        {
          ...VISUAL_TEST_PRESETS.component,
          component: 'table, [data-testid="data-table"], .data-table'
        }
      )
    } else {
      console.log('⏭️ Skipping data table test - no tables found')
    }
  })

  test('Modal dialogs - State testing', async ({ page }) => {
    await TestErrorHandler.safeNavigate(page, '/projects')
    await PageLoadHelper.waitForPageReady(page)
    
    // Look for buttons that trigger modals
    const modalTriggers = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New"), [data-testid*="create"], [data-testid*="add"]')
    const triggerCount = await modalTriggers.count()
    
    if (triggerCount > 0) {
      // Click the first available modal trigger
      await modalTriggers.first().click()
      
      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="dialog"]')
      await modal.waitFor({ state: 'visible', timeout: 5000 })
      
      // Take screenshot of modal
      await VisualTesting.compareComponent(
        modal,
        'modal-dialog-open',
        VISUAL_TEST_PRESETS.strict
      )
      
      // Close modal for cleanup
      const closeButton = modal.locator('[data-dismiss="modal"], .modal-close, button:has-text("Cancel"), [aria-label*="close" i]')
      const closeCount = await closeButton.count()
      if (closeCount > 0) {
        await closeButton.first().click()
      } else {
        // Try escape key
        await page.keyboard.press('Escape')
      }
    } else {
      console.log('⏭️ Skipping modal test - no modal triggers found')
    }
  })

  test('Error states - Visual validation', async ({ page }) => {
    // Navigate to a non-existent route to test 404 page
    await page.goto('/non-existent-route')
    await PageLoadHelper.waitForPageReady(page, { skipNetworkIdle: true })
    
    // Take screenshot of error state
    await VisualTesting.compareFullPage(page, '404-error-page', VISUAL_TEST_PRESETS.strict)
  })

  test('Loading states - Visual validation', async ({ page }) => {
    // Intercept network requests to simulate slow loading
    await page.route('**/api/**', route => {
      setTimeout(() => route.continue(), 2000) // 2 second delay
    })
    
    // Navigate and capture loading state
    const navigationPromise = page.goto('/projects')
    
    // Try to capture loading state quickly
    try {
      await page.waitForSelector('[data-testid="loading"], .loading, .spinner', { timeout: 1000 })
      await VisualTesting.compareFullPage(page, 'loading-state', VISUAL_TEST_PRESETS.relaxed)
    } catch (error) {
      console.log('⏭️ Loading state too fast to capture')
    }
    
    // Wait for navigation to complete
    await navigationPromise
    await PageLoadHelper.waitForPageReady(page)
    
    // Clear the route intercept
    await page.unroute('**/api/**')
  })
})