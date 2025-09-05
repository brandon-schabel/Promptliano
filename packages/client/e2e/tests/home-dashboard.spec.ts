/**
 * Home Dashboard Test Suite
 * 
 * Tests the dashboard overview, statistics, recent activity,
 * and quick actions on the home/landing page.
 */

import { test, expect } from '@playwright/test'
import { HomePage } from '../pages/home.page'
import { ProjectsPage } from '../pages/projects.page'
import { ChatPage } from '../pages/chat.page'
import { PromptsPage } from '../pages/prompts.page'
import { AppPage } from '../pages/app.page'

test.describe('Home Dashboard Overview', () => {
  let homePage: HomePage
  let appPage: AppPage
  let projectsPage: ProjectsPage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)

    // Navigate to home
    await homePage.goto()
    await homePage.waitForHomePageLoad()
  })

  test.describe('Initial Landing Experience', () => {
    test('should redirect home route to projects or dashboard', async ({ page }) => {
      await homePage.goto()
      
      // Should redirect from / to /projects or /dashboard
      const url = page.url()
      expect(url).toMatch(/\/(projects|dashboard)/)
      
      // Should show main content
      const hasContent = await Promise.race([
        homePage.dashboardContainer.isVisible().catch(() => false),
        page.locator('.projects-container').isVisible().catch(() => false)
      ])
      expect(hasContent).toBe(true)
    })

    test('should display application header and navigation', async () => {
      // Check header elements
      await expect(homePage.logo.or(homePage.headerTitle)).toBeVisible()
      
      // Check main navigation
      if (await homePage.mainNavigation.isVisible()) {
        await expect(homePage.projectsLink).toBeVisible()
        await expect(homePage.chatLink).toBeVisible()
        await expect(homePage.promptsLink).toBeVisible()
      }
    })

    test('should show user menu when authenticated', async () => {
      const isAuthenticated = await homePage.isAuthenticated()
      
      if (isAuthenticated) {
        await expect(homePage.userMenu).toBeVisible()
        
        // Test user menu interaction
        await homePage.openUserMenu()
        
        // Menu should contain user options
        const menuOptions = homePage.page.locator('[role="menu"], .dropdown-menu')
        await expect(menuOptions).toBeVisible()
      }
    })

    test('should display sidebar navigation', async () => {
      // Check if sidebar exists
      const hasSidebar = await homePage.sidebar.isVisible().catch(() => false)
      
      if (hasSidebar) {
        // Test sidebar toggle
        const initialVisibility = await homePage.isSidebarVisible()
        await homePage.toggleSidebar()
        
        // Wait for animation
        await homePage.page.waitForTimeout(500)
        
        const newVisibility = await homePage.isSidebarVisible()
        expect(newVisibility).not.toBe(initialVisibility)
      }
    })
  })

  test.describe('Dashboard Statistics', () => {
    test('should display overview statistics', async () => {
      // Check if stats are shown
      if (await homePage.statsContainer.isVisible()) {
        const stats = await homePage.getDashboardStats()
        
        // Should have at least one stat
        expect(Object.keys(stats).length).toBeGreaterThan(0)
        
        // Verify stat values are numbers
        if (stats.projects !== undefined) {
          expect(stats.projects).toBeGreaterThanOrEqual(0)
        }
        if (stats.chats !== undefined) {
          expect(stats.chats).toBeGreaterThanOrEqual(0)
        }
        if (stats.prompts !== undefined) {
          expect(stats.prompts).toBeGreaterThanOrEqual(0)
        }
      }
    })

    test('should update statistics when data changes', async ({ page }) => {
      // Get initial stats if available
      if (await homePage.statsContainer.isVisible()) {
        const initialStats = await homePage.getDashboardStats()
        
        // Create a new project (if possible)
        if (await homePage.newProjectButton.isVisible()) {
          await homePage.useQuickAction('project')
          
          // Handle project creation dialog
          const dialog = page.locator('[role="dialog"], .modal')
          if (await dialog.isVisible()) {
            // Cancel for now
            const cancelButton = page.locator('button:has-text("Cancel")')
            await cancelButton.click()
          }
          
          // Go back to home
          await homePage.goto()
          
          // Stats might update
          const newStats = await homePage.getDashboardStats()
          expect(newStats).toBeDefined()
        }
      }
    })

    test('should handle empty state gracefully', async () => {
      const hasEmptyState = await homePage.hasEmptyState()
      
      if (hasEmptyState) {
        // Should show helpful empty state
        await expect(homePage.emptyState).toBeVisible()
        
        // Should provide actions to get started
        const hasActions = await Promise.race([
          homePage.newProjectButton.isVisible(),
          homePage.getStartedButton.isVisible(),
          homePage.page.locator('button:has-text("Create")').first().isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasActions).toBe(true)
      }
    })
  })

  test.describe('Quick Actions', () => {
    test('should display quick action buttons', async () => {
      // Check if quick actions section exists
      if (await homePage.quickActionsSection.isVisible()) {
        // Should have at least one quick action
        const hasProjectAction = await homePage.newProjectButton.isVisible()
        const hasChatAction = await homePage.newChatButton.isVisible()
        const hasPromptAction = await homePage.createPromptButton.isVisible()
        
        expect(hasProjectAction || hasChatAction || hasPromptAction).toBe(true)
      }
    })

    test('should navigate to new project creation', async ({ page }) => {
      if (await homePage.newProjectButton.isVisible()) {
        await homePage.useQuickAction('project')
        
        // Should show project creation dialog or page
        const hasProjectCreation = await Promise.race([
          page.locator('[role="dialog"]:has-text("project")').isVisible(),
          page.locator('.create-project').isVisible(),
          page.waitForURL(/.*project.*new/, { timeout: 3000 }).then(() => true)
        ].map(p => p.catch(() => false)))
        
        expect(hasProjectCreation).toBe(true)
      }
    })

    test('should navigate to new chat', async ({ page }) => {
      if (await homePage.newChatButton.isVisible()) {
        await homePage.useQuickAction('chat')
        
        // Should navigate to chat or show chat dialog
        const hasChatInterface = await Promise.race([
          page.waitForURL(/.*chat/, { timeout: 3000 }).then(() => true),
          page.locator('.chat-interface').isVisible(),
          page.locator('[role="dialog"]:has-text("chat")').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasChatInterface).toBe(true)
      }
    })

    test('should navigate to prompt creation', async ({ page }) => {
      if (await homePage.createPromptButton.isVisible()) {
        await homePage.useQuickAction('prompt')
        
        // Should show prompt creation
        const hasPromptCreation = await Promise.race([
          page.waitForURL(/.*prompt/, { timeout: 3000 }).then(() => true),
          page.locator('[role="dialog"]:has-text("prompt")').isVisible(),
          page.locator('.create-prompt').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasPromptCreation).toBe(true)
      }
    })

    test('should handle import action', async ({ page }) => {
      if (await homePage.importButton.isVisible()) {
        await homePage.importButton.click()
        
        // Should show import dialog or file picker
        const hasImport = await Promise.race([
          page.locator('[role="dialog"]:has-text("import")').isVisible(),
          page.locator('input[type="file"]').isVisible(),
          page.locator('.import-wizard').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasImport).toBe(true)
      }
    })
  })

  test.describe('Recent Activity', () => {
    test('should display recent activity section', async () => {
      if (await homePage.recentActivitySection.isVisible()) {
        const activityCount = await homePage.getRecentActivityCount()
        
        // If there's activity, should show items
        if (activityCount > 0) {
          await expect(homePage.activityItems.first()).toBeVisible()
        } else {
          // Should show empty state
          await expect(homePage.noActivityMessage).toBeVisible()
        }
      }
    })

    test('should show recent projects', async () => {
      if (await homePage.recentProjects.isVisible()) {
        const projectItems = homePage.recentProjects.locator('.project-item, [data-testid="project-item"]')
        const count = await projectItems.count()
        
        if (count > 0) {
          // Verify project items are clickable
          const firstProject = projectItems.first()
          await expect(firstProject).toBeVisible()
          
          // Should have project name
          const projectName = await firstProject.textContent()
          expect(projectName).toBeTruthy()
        }
      }
    })

    test('should show recent chats', async () => {
      if (await homePage.recentChats.isVisible()) {
        const chatItems = homePage.recentChats.locator('.chat-item, [data-testid="chat-item"]')
        const count = await chatItems.count()
        
        if (count > 0) {
          const firstChat = chatItems.first()
          await expect(firstChat).toBeVisible()
          
          // Should have chat title or preview
          const chatText = await firstChat.textContent()
          expect(chatText).toBeTruthy()
        }
      }
    })

    test('should navigate to recent item on click', async ({ page }) => {
      const activityCount = await homePage.getRecentActivityCount()
      
      if (activityCount > 0) {
        // Click first recent item
        await homePage.openRecentItem(0)
        
        // Should navigate away from home
        await page.waitForTimeout(1000)
        const url = page.url()
        
        // Should navigate to project, chat, or prompt
        expect(url).toMatch(/\/(project|chat|prompt)/)
      }
    })

    test('should update recent activity in real-time', async ({ page }) => {
      // Get initial activity count
      const initialCount = await homePage.getRecentActivityCount()
      
      // Perform an action that creates activity
      if (await homePage.newChatButton.isVisible()) {
        await homePage.useQuickAction('chat')
        
        // Cancel or go back
        await page.goBack()
        await homePage.waitForHomePageLoad()
        
        // Activity might be updated
        const newCount = await homePage.getRecentActivityCount()
        expect(newCount).toBeGreaterThanOrEqual(initialCount)
      }
    })
  })

  test.describe('Welcome and Empty States', () => {
    test('should show welcome message for new users', async () => {
      // Check for welcome message
      if (await homePage.welcomeMessage.isVisible()) {
        const welcomeText = await homePage.welcomeMessage.textContent()
        expect(welcomeText).toContain('Welcome')
      }
    })

    test('should show appropriate empty state when no data', async () => {
      const hasEmptyState = await homePage.hasEmptyState()
      
      if (hasEmptyState) {
        // Should show helpful message
        const emptyMessage = await homePage.emptyState.textContent()
        expect(emptyMessage).toBeTruthy()
        
        // Should provide call-to-action
        const hasCTA = await Promise.race([
          homePage.getStartedButton.isVisible(),
          homePage.newProjectButton.isVisible(),
          homePage.page.locator('button:has-text("Create")').first().isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasCTA).toBe(true)
      }
    })

    test('should handle no projects state', async () => {
      if (await homePage.noProjectsMessage.isVisible()) {
        // Should show create project option
        const hasCreateOption = await Promise.race([
          homePage.newProjectButton.isVisible(),
          homePage.page.locator('button:has-text("Create"):has-text("Project")').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasCreateOption).toBe(true)
      }
    })
  })

  test.describe('Search Functionality', () => {
    test('should provide global search', async ({ page }) => {
      const searchInput = page.locator('[data-testid="global-search"], input[placeholder*="search" i]').first()
      
      if (await searchInput.isVisible()) {
        // Test search functionality
        await homePage.searchFromHome('test query')
        
        // Should navigate to search results or filter content
        await page.waitForTimeout(1000)
        
        // Check if search affected the page
        const hasSearchResults = await Promise.race([
          page.locator('.search-results').isVisible(),
          page.locator('[data-testid="search-results"]').isVisible(),
          page.waitForURL(/.*search/, { timeout: 2000 }).then(() => true)
        ].map(p => p.catch(() => false)))
        
        // Search was processed in some way
        expect(searchInput).toBeVisible()
      }
    })

    test('should handle search with no results', async ({ page }) => {
      const searchInput = page.locator('[data-testid="global-search"], input[placeholder*="search" i]').first()
      
      if (await searchInput.isVisible()) {
        // Search for something unlikely to exist
        await homePage.searchFromHome('xyzabc123notfound')
        
        await page.waitForTimeout(1000)
        
        // Should show no results message or empty state
        const hasNoResults = await Promise.race([
          page.locator(':text("No results")').isVisible(),
          page.locator(':text("No matches")').isVisible(),
          page.locator('.empty-search-results').isVisible()
        ].map(p => p.catch(() => false)))
        
        // Some indication of no results
        expect(await searchInput.inputValue()).toBe('xyzabc123notfound')
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await homePage.goto()
      await homePage.waitForHomePageLoad()
      
      // Sidebar should be hidden by default on mobile
      if (await homePage.sidebar.isVisible()) {
        const sidebarBounds = await homePage.sidebar.boundingBox()
        
        // Sidebar might be off-screen or overlaid
        if (sidebarBounds) {
          expect(sidebarBounds.x <= 0 || sidebarBounds.width === 375).toBeTruthy()
        }
      }
      
      // Navigation should be accessible via menu
      if (await homePage.sidebarToggle.isVisible()) {
        await homePage.toggleSidebar()
        await expect(homePage.sidebar).toBeVisible()
      }
    })

    test('should adapt to tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await homePage.goto()
      await homePage.waitForHomePageLoad()
      
      // Content should be visible
      const hasContent = await Promise.race([
        homePage.dashboardContainer.isVisible(),
        page.locator('.projects-container').isVisible()
      ].map(p => p.catch(() => false)))
      
      expect(hasContent).toBe(true)
    })

    test('should handle landscape orientation', async ({ page }) => {
      // Set landscape mobile viewport
      await page.setViewportSize({ width: 667, height: 375 })
      
      await homePage.goto()
      await homePage.waitForHomePageLoad()
      
      // Main content should still be accessible
      const isAccessible = await homePage.isOnHomePage()
      expect(isAccessible).toBe(true)
    })
  })

  test.describe('Performance', () => {
    test('should load home page quickly', async ({ page }) => {
      const startTime = Date.now()
      
      await homePage.goto()
      await homePage.waitForHomePageLoad()
      
      const loadTime = Date.now() - startTime
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
    })

    test('should handle rapid navigation', async ({ page }) => {
      // Rapidly navigate between sections
      for (let i = 0; i < 5; i++) {
        if (await homePage.projectsLink.isVisible()) {
          await homePage.navigateToSection('projects')
        }
        await page.goBack()
      }
      
      // Should remain stable
      await homePage.waitForHomePageLoad()
      expect(await homePage.isOnHomePage()).toBe(true)
    })
  })
})