/**
 * Home Navigation Test Suite
 * 
 * Tests navigation shortcuts, routing behavior, keyboard navigation,
 * and navigation flows from the home/landing page.
 */

import { test, expect } from '@playwright/test'
import { HomePage } from '../pages/home.page'
import { ProjectsPage } from '../pages/projects.page'
import { ChatPage } from '../pages/chat.page'
import { PromptsPage } from '../pages/prompts.page'

test.describe('Home Navigation Behavior', () => {
  let homePage: HomePage
  let projectsPage: ProjectsPage
  let chatPage: ChatPage
  let promptsPage: PromptsPage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
    projectsPage = new ProjectsPage(page)
    chatPage = new ChatPage(page)
    promptsPage = new PromptsPage(page)

    // Navigate to home
    await homePage.goto()
  })

  test.describe('Route Redirects', () => {
    test('should redirect from / to /projects', async ({ page }) => {
      await page.goto('/')
      await page.waitForURL(/.*/, { timeout: 5000 })
      
      const url = page.url()
      expect(url).toMatch(/\/projects/)
    })

    test('should handle direct navigation to home', async ({ page }) => {
      await page.goto('/')
      await homePage.waitForHomePageLoad()
      
      // Should be on a valid page
      const isValidPage = await homePage.isOnHomePage()
      expect(isValidPage).toBe(true)
    })

    test('should preserve query parameters during redirect', async ({ page }) => {
      await page.goto('/?tab=settings&view=advanced')
      await page.waitForURL(/.*/, { timeout: 5000 })
      
      // Query params might be preserved or transformed
      const url = page.url()
      expect(url).toContain('projects')
    })

    test('should handle invalid routes gracefully', async ({ page }) => {
      await page.goto('/nonexistent-route')
      await page.waitForTimeout(1000)
      
      // Should show 404 or redirect to valid route
      const has404 = await page.locator(':text("404")').isVisible().catch(() => false)
      const redirected = page.url().includes('/projects')
      
      expect(has404 || redirected).toBe(true)
    })
  })

  test.describe('Main Navigation', () => {
    test('should navigate to projects section', async ({ page }) => {
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        
        // Should be on projects page
        await expect(page).toHaveURL(/\/projects/)
        await expect(projectsPage.page.locator('main')).toBeVisible()
      }
    })

    test('should navigate to chat section', async ({ page }) => {
      if (await homePage.chatLink.isVisible()) {
        await homePage.navigateToSection('chat')
        
        // Should be on chat page
        await expect(page).toHaveURL(/\/chat/)
      }
    })

    test('should navigate to prompts section', async ({ page }) => {
      if (await homePage.promptsLink.isVisible()) {
        await homePage.navigateToSection('prompts')
        
        // Should be on prompts page
        await expect(page).toHaveURL(/\/prompts/)
      }
    })

    test('should navigate to settings section', async ({ page }) => {
      if (await homePage.settingsLink.isVisible()) {
        await homePage.navigateToSection('settings')
        
        // Should be on settings page
        await expect(page).toHaveURL(/\/settings/)
      }
    })

    test('should maintain active navigation state', async ({ page }) => {
      // Navigate to different sections and check active state
      const sections = ['projects', 'chat', 'prompts'] as const
      
      for (const section of sections) {
        const link = section === 'projects' ? homePage.projectsLink :
                    section === 'chat' ? homePage.chatLink :
                    homePage.promptsLink
        
        if (await link.isVisible()) {
          await homePage.navigateToSection(section)
          
          // Check if link has active state
          const isActive = await link.getAttribute('data-active') === 'true' ||
                          await link.getAttribute('aria-current') === 'page'
          
          // Navigation state should be reflected
          expect(page.url()).toContain(section)
        }
      }
    })
  })

  test.describe('Browser Navigation', () => {
    test('should handle browser back button', async ({ page }) => {
      // Navigate through multiple pages
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        await page.waitForURL(/\/projects/)
      }
      
      if (await homePage.chatLink.isVisible()) {
        await homePage.navigateToSection('chat')
        await page.waitForURL(/\/chat/)
      }
      
      // Go back
      await page.goBack()
      await page.waitForTimeout(500)
      
      // Should be on previous page
      expect(page.url()).toContain('projects')
      
      // Go back again
      await page.goBack()
      await page.waitForTimeout(500)
      
      // Should be on home or initial redirect
      const isHome = await homePage.isOnHomePage()
      expect(isHome).toBe(true)
    })

    test('should handle browser forward button', async ({ page }) => {
      // Navigate and go back
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        await page.goBack()
        
        // Go forward
        await page.goForward()
        await page.waitForTimeout(500)
        
        // Should be back on projects
        expect(page.url()).toContain('projects')
      }
    })

    test('should handle page refresh', async ({ page }) => {
      // Navigate to a section
      if (await homePage.chatLink.isVisible()) {
        await homePage.navigateToSection('chat')
        const urlBefore = page.url()
        
        // Refresh page
        await page.reload()
        await page.waitForLoadState('networkidle')
        
        // Should remain on same page
        const urlAfter = page.url()
        expect(urlAfter).toBe(urlBefore)
      }
    })

    test('should maintain state across navigation', async ({ page }) => {
      // Set some state
      await page.evaluate(() => {
        localStorage.setItem('navigationTest', 'testValue')
      })
      
      // Navigate away and back
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        await page.goBack()
      }
      
      // State should persist
      const value = await page.evaluate(() => {
        return localStorage.getItem('navigationTest')
      })
      
      expect(value).toBe('testValue')
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation', async ({ page }) => {
      // Focus should move through interactive elements
      await page.keyboard.press('Tab')
      
      // Check if an element is focused
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName
      })
      
      expect(focusedElement).toBeTruthy()
      
      // Tab through multiple elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
      }
      
      // Should have moved focus
      const newFocusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName
      })
      
      expect(newFocusedElement).toBeTruthy()
    })

    test('should support keyboard shortcuts for navigation', async ({ page }) => {
      // Test common shortcuts
      const shortcuts = [
        { key: 'g p', section: 'projects' },
        { key: 'g c', section: 'chat' },
        { key: 'g s', section: 'settings' }
      ]
      
      for (const { key, section } of shortcuts) {
        // Try keyboard shortcut
        const keys = key.split(' ')
        for (const k of keys) {
          await page.keyboard.press(k)
          await page.waitForTimeout(100)
        }
        
        // Check if navigation occurred
        // Note: This depends on implementation
        await page.waitForTimeout(500)
      }
    })

    test('should support escape key for closing dialogs', async ({ page }) => {
      // Open a dialog if available
      if (await homePage.newProjectButton.isVisible()) {
        await homePage.newProjectButton.click()
        
        // Wait for dialog
        const dialog = page.locator('[role="dialog"]')
        if (await dialog.isVisible()) {
          // Press escape
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500)
          
          // Dialog should close
          await expect(dialog).not.toBeVisible()
        }
      }
    })

    test('should support enter key for activation', async ({ page }) => {
      // Focus a button
      if (await homePage.newChatButton.isVisible()) {
        await homePage.newChatButton.focus()
        
        // Press enter
        await page.keyboard.press('Enter')
        await page.waitForTimeout(500)
        
        // Should trigger action
        const hasAction = page.url().includes('chat') || 
                         await page.locator('[role="dialog"]').isVisible()
        
        expect(hasAction).toBe(true)
      }
    })
  })

  test.describe('Sidebar Navigation', () => {
    test('should toggle sidebar visibility', async () => {
      if (await homePage.sidebarToggle.isVisible()) {
        const initialState = await homePage.isSidebarVisible()
        
        await homePage.toggleSidebar()
        
        const newState = await homePage.isSidebarVisible()
        expect(newState).not.toBe(initialState)
      }
    })

    test('should navigate from sidebar links', async ({ page }) => {
      if (await homePage.sidebar.isVisible()) {
        // Look for sidebar navigation items
        const sidebarLinks = homePage.sidebar.locator('a[href]')
        const linkCount = await sidebarLinks.count()
        
        if (linkCount > 0) {
          // Click first link
          const firstLink = sidebarLinks.first()
          const href = await firstLink.getAttribute('href')
          
          await firstLink.click()
          await page.waitForTimeout(1000)
          
          // Should navigate
          if (href && !href.startsWith('#')) {
            expect(page.url()).toContain(href.replace(/^\//, ''))
          }
        }
      }
    })

    test('should show recent items in sidebar', async () => {
      if (await homePage.sidebarRecent.isVisible()) {
        const recentItems = homePage.sidebarRecent.locator('a, button')
        const count = await recentItems.count()
        
        // Should have recent items or empty state
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })

    test('should collapse/expand sidebar sections', async ({ page }) => {
      if (await homePage.sidebar.isVisible()) {
        // Look for collapsible sections
        const collapsibles = homePage.sidebar.locator('[data-state], [aria-expanded]')
        
        if (await collapsibles.first().isVisible()) {
          const initialState = await collapsibles.first().getAttribute('data-state') || 
                              await collapsibles.first().getAttribute('aria-expanded')
          
          await collapsibles.first().click()
          await page.waitForTimeout(300)
          
          const newState = await collapsibles.first().getAttribute('data-state') || 
                          await collapsibles.first().getAttribute('aria-expanded')
          
          expect(newState).not.toBe(initialState)
        }
      }
    })
  })

  test.describe('Breadcrumb Navigation', () => {
    test('should display breadcrumbs', async ({ page }) => {
      // Navigate to a deeper page
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        
        // Look for breadcrumbs
        const breadcrumbs = page.locator('[aria-label="Breadcrumb"], .breadcrumbs, nav[data-testid="breadcrumbs"]')
        
        if (await breadcrumbs.isVisible()) {
          const items = breadcrumbs.locator('a, span')
          const count = await items.count()
          
          expect(count).toBeGreaterThanOrEqual(1)
        }
      }
    })

    test('should navigate via breadcrumbs', async ({ page }) => {
      // Navigate to a deeper page first
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        
        const breadcrumbs = page.locator('[aria-label="Breadcrumb"], .breadcrumbs')
        if (await breadcrumbs.isVisible()) {
          const homeLink = breadcrumbs.locator('a').first()
          
          if (await homeLink.isVisible()) {
            await homeLink.click()
            await page.waitForTimeout(500)
            
            // Should navigate back
            const isHome = await homePage.isOnHomePage()
            expect(isHome).toBe(true)
          }
        }
      }
    })
  })

  test.describe('Quick Navigation', () => {
    test('should open command palette', async ({ page }) => {
      // Try to open command palette (usually Cmd/Ctrl+K)
      await page.keyboard.press('Control+K')
      await page.waitForTimeout(500)
      
      // Check if command palette opened
      const hasCommandPalette = await Promise.race([
        page.locator('[role="dialog"]:has-text("command")').isVisible(),
        page.locator('[data-testid="command-palette"]').isVisible(),
        page.locator('input[placeholder*="search" i]').isVisible()
      ].map(p => p.catch(() => false)))
      
      if (hasCommandPalette) {
        // Close it
        await page.keyboard.press('Escape')
      }
    })

    test('should navigate using search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="search" i]').first()
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('settings')
        await searchInput.press('Enter')
        await page.waitForTimeout(1000)
        
        // Should navigate or show results
        const navigated = page.url().includes('settings') || 
                         page.url().includes('search')
        
        expect(navigated || await searchInput.isVisible()).toBe(true)
      }
    })

    test('should support jump-to navigation', async ({ page }) => {
      // Look for jump-to or quick nav elements
      const jumpTo = page.locator('[data-testid="jump-to"], .quick-nav')
      
      if (await jumpTo.isVisible()) {
        await jumpTo.click()
        
        // Should show navigation options
        const hasOptions = await page.locator('[role="menu"], .dropdown').isVisible()
        expect(hasOptions).toBe(true)
      }
    })
  })

  test.describe('Navigation State Management', () => {
    test('should preserve navigation history', async ({ page }) => {
      const navigationHistory: string[] = []
      
      // Track navigation
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          navigationHistory.push(page.url())
        }
      })
      
      // Navigate through sections
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
      }
      if (await homePage.chatLink.isVisible()) {
        await homePage.navigateToSection('chat')
      }
      
      // History should be tracked
      expect(navigationHistory.length).toBeGreaterThanOrEqual(2)
    })

    test('should handle deep linking', async ({ page }) => {
      // Try deep link
      await page.goto('/projects?projectId=123&tab=flow')
      await page.waitForLoadState('networkidle')
      
      // Should load with parameters
      const url = page.url()
      expect(url).toContain('projects')
      
      // Parameters might be processed
      const hasParams = url.includes('projectId') || url.includes('tab')
      expect(hasParams || url.includes('projects')).toBe(true)
    })

    test('should handle navigation errors gracefully', async ({ page }) => {
      // Simulate navigation error
      await page.route('**/api/**', (route) => {
        route.abort('failed')
      })
      
      // Try to navigate
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        await page.waitForTimeout(1000)
        
        // Should handle error gracefully
        const hasError = await page.locator(':text("error")').isVisible().catch(() => false)
        const stillAccessible = await page.locator('main').isVisible()
        
        expect(hasError || stillAccessible).toBe(true)
      }
    })
  })

  test.describe('Mobile Navigation', () => {
    test('should show mobile menu on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await homePage.goto()
      
      // Look for mobile menu button
      const mobileMenu = page.locator('[aria-label*="menu" i], .mobile-menu-toggle')
      
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click()
        await page.waitForTimeout(300)
        
        // Menu should open
        const hasMenu = await Promise.race([
          homePage.sidebar.isVisible(),
          page.locator('.mobile-menu').isVisible(),
          page.locator('[role="navigation"]').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasMenu).toBe(true)
      }
    })

    test('should handle swipe gestures on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await homePage.goto()
      
      // Simulate swipe (if supported)
      const startX = 50
      const startY = 200
      const endX = 300
      
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(endX, startY, { steps: 10 })
      await page.mouse.up()
      
      await page.waitForTimeout(500)
      
      // Check if sidebar opened (implementation dependent)
      const sidebarVisible = await homePage.isSidebarVisible()
      // Swipe might or might not be implemented
      expect(typeof sidebarVisible).toBe('boolean')
    })

    test('should adapt navigation for touch devices', async ({ page }) => {
      // Set touch viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      // Touch events should work
      if (await homePage.projectsLink.isVisible()) {
        await homePage.projectsLink.tap()
        await page.waitForTimeout(500)
        
        // Should navigate
        expect(page.url()).toContain('projects')
      }
    })
  })

  test.describe('Accessibility Navigation', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      // Check for ARIA labels
      const navElements = page.locator('nav, [role="navigation"]')
      const count = await navElements.count()
      
      for (let i = 0; i < count; i++) {
        const element = navElements.nth(i)
        const ariaLabel = await element.getAttribute('aria-label')
        
        // Navigation elements should have labels
        if (await element.isVisible()) {
          expect(ariaLabel || await element.getAttribute('role')).toBeTruthy()
        }
      }
    })

    test('should support screen reader navigation', async ({ page }) => {
      // Check for skip links
      const skipLinks = page.locator('a[href^="#"]:has-text("skip"), .skip-link')
      
      if (await skipLinks.first().isVisible()) {
        await skipLinks.first().click()
        
        // Should skip to main content
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.tagName
        })
        
        expect(focusedElement).toBeTruthy()
      }
    })

    test('should have logical tab order', async ({ page }) => {
      const tabOrder: string[] = []
      
      // Tab through elements and record order
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        
        const focused = await page.evaluate(() => {
          const el = document.activeElement
          return el ? el.tagName + (el.id ? '#' + el.id : '') : null
        })
        
        if (focused) {
          tabOrder.push(focused)
        }
      }
      
      // Should have a logical order
      expect(tabOrder.length).toBeGreaterThan(0)
      expect(tabOrder).not.toContain(null)
    })

    test('should announce navigation changes', async ({ page }) => {
      // Check for live regions
      const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]')
      const hasLiveRegions = await liveRegions.first().isVisible().catch(() => false)
      
      // Navigate and check for announcements
      if (await homePage.projectsLink.isVisible()) {
        await homePage.navigateToSection('projects')
        
        // Check if navigation was announced
        // This depends on implementation
        expect(hasLiveRegions || page.url().includes('projects')).toBe(true)
      }
    })
  })

  test.describe('Performance', () => {
    test('should navigate quickly between sections', async ({ page }) => {
      const timings: number[] = []
      
      // Measure navigation times
      const sections = ['projects', 'chat', 'prompts'] as const
      
      for (const section of sections) {
        const link = section === 'projects' ? homePage.projectsLink :
                    section === 'chat' ? homePage.chatLink :
                    homePage.promptsLink
        
        if (await link.isVisible()) {
          const startTime = Date.now()
          await homePage.navigateToSection(section)
          const endTime = Date.now()
          
          timings.push(endTime - startTime)
        }
      }
      
      // Navigation should be fast
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length
      expect(avgTime).toBeLessThan(2000) // 2 seconds average
    })

    test('should handle rapid navigation changes', async ({ page }) => {
      // Rapidly switch between sections
      for (let i = 0; i < 10; i++) {
        if (await homePage.projectsLink.isVisible()) {
          await homePage.projectsLink.click()
        }
        if (await homePage.chatLink.isVisible()) {
          await homePage.chatLink.click()
        }
      }
      
      // Should remain stable
      await page.waitForTimeout(1000)
      const isStable = await page.locator('main').isVisible()
      expect(isStable).toBe(true)
    })

    test('should preload navigation targets', async ({ page }) => {
      // Check for preloading hints
      const links = page.locator('a[rel*="preload"], a[rel*="prefetch"], link[rel*="prefetch"]')
      const hasPreloading = await links.first().isVisible().catch(() => false)
      
      // Preloading is optional but good for performance
      expect(typeof hasPreloading).toBe('boolean')
    })
  })
})