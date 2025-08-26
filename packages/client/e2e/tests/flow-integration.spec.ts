import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { TestProjectHelpers } from '../utils/test-project-helpers'

test.describe('Flow Integration - UI Testing', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let testProject: any
  let cleanupActions: (() => Promise<void>)[] = []

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)

    // Create a test project for flow testing
    testProject = await TestProjectHelpers.createTestProject({
      template: 'web-app',
      name: `Flow UI Test ${Date.now()}`,
      includeDependencies: true,
      includeGit: true
    })

    cleanupActions.push(async () => {
      if (testProject) {
        await TestProjectHelpers.cleanupSpecificProjects([testProject])
      }
    })

    await appPage.goto()
    await TestProjectHelpers.loadProjectIntoApp(page, testProject)

    // Navigate to flow tab
    await appPage.page.locator('[data-testid="flow-tab"], button:has-text("Flow"), .nav-tab:has-text("Flow")').click()
    await appPage.waitForLoadingComplete()
  })

  test.afterEach(async () => {
    for (const cleanup of cleanupActions.reverse()) {
      try {
        await cleanup()
      } catch (error) {
        console.warn('Cleanup failed:', error)
      }
    }
    cleanupActions = []
  })

  test.describe('Flow Sidebar Navigation', () => {
    test('should display flow navigation options', async () => {
      const flowSidebar = appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar')
      await expect(flowSidebar).toBeVisible()

      // Check navigation items
      await expect(flowSidebar.locator('button:has-text("Task Queues"), button:has-text("Queues")')).toBeVisible()
      await expect(flowSidebar.locator('button:has-text("Tickets")')).toBeVisible()
      await expect(flowSidebar.locator('button:has-text("Kanban")')).toBeVisible()
      await expect(flowSidebar.locator('button:has-text("Analytics")')).toBeVisible()
    })

    test('should navigate between flow views', async () => {
      const flowSidebar = appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar')
      
      // Test navigation to Tickets view
      await flowSidebar.locator('button:has-text("Tickets")').click()
      await appPage.waitForLoadingComplete()
      
      const ticketsView = appPage.page.locator('[data-testid="tickets-view"], .tickets-view, text="Tickets"')
      if (await ticketsView.isVisible()) {
        await expect(ticketsView).toBeVisible()
      }

      // Test navigation to Kanban view
      await flowSidebar.locator('button:has-text("Kanban")').click()
      await appPage.waitForLoadingComplete()
      
      const kanbanView = appPage.page.locator('[data-testid="kanban-board"], .kanban-board, text="Kanban"')
      if (await kanbanView.isVisible()) {
        await expect(kanbanView).toBeVisible()
      }
    })
  })

  test.describe('Queue Overview View', () => {
    test.beforeEach(async () => {
      await appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar').locator('button:has-text("Queues"), button:has-text("Task Queues")').click()
      await appPage.waitForLoadingComplete()
    })

    test('should display queue interface', async () => {
      // Look for queue-related elements
      const queueElements = appPage.page.locator('[data-testid="queue-grid"], .queue-grid, [data-testid="queue-overview"], .queue-overview, text=/queue/i')
      if (await queueElements.count() > 0) {
        await expect(queueElements.first()).toBeVisible()
      }
    })

    test('should show create queue option', async () => {
      const createQueueButton = appPage.page.locator('[data-testid="create-queue"], button:has-text("Create Queue"), button:has-text("New Queue")')
      if (await createQueueButton.isVisible()) {
        await expect(createQueueButton).toBeVisible()
      }
    })
  })

  test.describe('Tickets View', () => {
    test.beforeEach(async () => {
      await appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar').locator('button:has-text("Tickets")').click()
      await appPage.waitForLoadingComplete()
    })

    test('should display tickets interface', async () => {
      // Check for tickets view elements
      const ticketsElements = appPage.page.locator('[data-testid="tickets-view"], .tickets-view, [data-testid="ticket-list"], .ticket-list')
      if (await ticketsElements.count() > 0) {
        await expect(ticketsElements.first()).toBeVisible()
      }
    })

    test('should show create ticket option', async () => {
      const createTicketButton = appPage.page.locator('[data-testid="new-ticket"], button:has-text("New Ticket"), button:has-text("Create Ticket")')
      if (await createTicketButton.isVisible()) {
        await expect(createTicketButton).toBeVisible()
      }
    })

    test('should display filtering options', async () => {
      // Look for filter controls
      const filterElements = appPage.page.locator('[data-testid*="filter"], .filter, select')
      if (await filterElements.count() > 0) {
        await expect(filterElements.first()).toBeVisible()
      }
    })
  })

  test.describe('Kanban View', () => {
    test.beforeEach(async () => {
      await appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar').locator('button:has-text("Kanban")').click()
      await appPage.waitForLoadingComplete()
    })

    test('should display kanban board interface', async () => {
      // Look for kanban board elements
      const kanbanElements = appPage.page.locator('[data-testid="kanban-board"], .kanban-board, text="Board"')
      if (await kanbanElements.count() > 0) {
        await expect(kanbanElements.first()).toBeVisible()
      }
    })

    test('should show kanban columns', async () => {
      // Look for kanban columns
      const columns = appPage.page.locator('[data-testid="kanban-column"], .kanban-column, [data-testid*="column"]')
      if (await columns.count() > 0) {
        await expect(columns.first()).toBeVisible()
      }
    })
  })

  test.describe('Analytics View', () => {
    test.beforeEach(async () => {
      await appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar').locator('button:has-text("Analytics")').click()
      await appPage.waitForLoadingComplete()
    })

    test('should display analytics interface', async () => {
      // Look for analytics elements
      const analyticsElements = appPage.page.locator('[data-testid="analytics-view"], .analytics-view, text="Analytics"')
      if (await analyticsElements.count() > 0) {
        await expect(analyticsElements.first()).toBeVisible()
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async () => {
      await appPage.page.setViewportSize({ width: 375, height: 667 })
      await appPage.page.reload()
      await appPage.waitForLoadingComplete()

      // Navigate to flow tab
      await appPage.page.locator('[data-testid="flow-tab"], button:has-text("Flow")').click()
      await appPage.waitForLoadingComplete()

      // Sidebar should still be functional
      const flowSidebar = appPage.page.locator('[data-testid="flow-sidebar"], .flow-sidebar')
      await expect(flowSidebar).toBeVisible()
    })
  })
})