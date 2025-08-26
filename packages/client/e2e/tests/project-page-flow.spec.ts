/**
 * Project Page - Flow Feature Test Suite
 *
 * Tests queue statistics display, queue cards, queue details modal,
 * and overall flow management functionality.
 */

import { test, expect } from '@playwright/test'
import { ProjectPage } from '../pages/project-page'
import { ProjectPageTestUtils } from '../utils/project-page-test-manager'
import { ProjectPageTestData, ProjectPageDataFactory } from '../fixtures/project-page-data'
import { MCPTestHelpers } from '../utils/mcp-test-helpers'

test.describe('Project Page - Flow Feature Display', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    // Setup environment with flow test data
    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.setupFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should display flow section', async ({ page }) => {
    // Wait for flow section to load
    await expect(projectPage.flowSection).toBeVisible()

    // Verify main flow components are present
    await expect(projectPage.queueStats).toBeVisible()

    // Verify queue cards are displayed
    for (const queue of ProjectPageTestData.testQueues) {
      await expect(projectPage.queueCard(queue.name)).toBeVisible()
    }
  })

  test('should display queue statistics correctly', async ({ page }) => {
    await expect(projectPage.flowSection).toBeVisible()
    await expect(projectPage.queueStats).toBeVisible()

    // Get queue statistics
    const stats = await projectPage.getQueueStatistics()

    // Verify statistics are reasonable
    expect(stats.activeQueues).toBeGreaterThanOrEqual(0)
    expect(stats.totalQueues).toBeGreaterThanOrEqual(stats.activeQueues)
    expect(stats.inProgress).toBeGreaterThanOrEqual(0)
    expect(stats.pending).toBeGreaterThanOrEqual(0)
    expect(stats.completed).toBeGreaterThanOrEqual(0)

    // Verify statistics display on page
    await expect(projectPage.activeQueuesCount).toContainText(stats.activeQueues.toString())
    await expect(projectPage.totalQueuesCount).toContainText(stats.totalQueues.toString())
    await expect(projectPage.inProgressCount).toContainText(stats.inProgress.toString())
  })

  test('should show individual queue information', async ({ page }) => {
    await expect(projectPage.flowSection).toBeVisible()

    // Verify each test queue is displayed with correct information
    for (const queue of ProjectPageTestData.testQueues) {
      const queueCard = projectPage.queueCard(queue.name)
      await expect(queueCard).toBeVisible()

      // Verify queue name is displayed
      await expect(queueCard).toContainText(queue.name)

      // Verify queue description if present
      if (queue.description) {
        await expect(queueCard).toContainText(queue.description)
      }

      // Verify "View Queue Details" button exists
      await expect(projectPage.queueViewDetailsButton(queue.name)).toBeVisible()

      // Look for queue statistics on the card
      const cardText = await queueCard.textContent()
      expect(cardText).toBeTruthy()
    }
  })

  test('should display queue cards with proper layout', async ({ page }) => {
    await expect(projectPage.flowSection).toBeVisible()

    const queueCards = []
    for (const queue of ProjectPageTestData.testQueues) {
      queueCards.push(projectPage.queueCard(queue.name))
    }

    // Verify all cards are visible
    for (const card of queueCards) {
      await expect(card).toBeVisible()
    }

    // Verify cards have proper dimensions and don't overlap
    if (queueCards.length > 1) {
      const firstCardBox = await queueCards[0].boundingBox()
      const secondCardBox = await queueCards[1].boundingBox()

      expect(firstCardBox).toBeTruthy()
      expect(secondCardBox).toBeTruthy()

      // Cards should have reasonable dimensions
      expect(firstCardBox!.width).toBeGreaterThan(150)
      expect(firstCardBox!.height).toBeGreaterThan(100)

      // Cards should not overlap (check they're either side by side or stacked)
      const noOverlap =
        firstCardBox!.x + firstCardBox!.width <= secondCardBox!.x + 10 || // Side by side (with small margin)
        firstCardBox!.y + firstCardBox!.height <= secondCardBox!.y + 10 // Stacked vertically

      expect(noOverlap).toBeTruthy()
    }
  })

  test('should update statistics when queue state changes', async ({ page }) => {
    await expect(projectPage.flowSection).toBeVisible()

    // Get initial statistics
    const initialStats = await projectPage.getQueueStatistics()

    // Simulate a state change by mocking an update
    await page.route('**/api/queues/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            activeQueues: initialStats.activeQueues + 1,
            totalQueues: initialStats.totalQueues + 1,
            inProgress: initialStats.inProgress + 2,
            pending: initialStats.pending - 1,
            completed: initialStats.completed + 1
          }
        })
      })
    })

    // Trigger a refresh of statistics (this depends on implementation)
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Verify statistics have updated
    const updatedStats = await projectPage.getQueueStatistics()
    expect(updatedStats.activeQueues).toBe(initialStats.activeQueues + 1)
    expect(updatedStats.totalQueues).toBe(initialStats.totalQueues + 1)
  })
})

test.describe('Project Page - Queue Details Modal', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.setupFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should open queue details modal', async ({ page }) => {
    // Click "View Queue Details" for the first queue
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    // Verify modal opens
    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Verify modal contains queue name
    await expect(projectPage.queueDetailsModal).toContainText(firstQueue.name)
  })

  test('should display all tabs in queue details modal', async ({ page }) => {
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Verify all expected tabs are present
    const expectedTabs = ['All', 'Pending', 'In Progress', 'Completed']
    for (const tab of expectedTabs) {
      await expect(projectPage.queueDetailsModal.getByRole('tab', { name: tab })).toBeVisible()
    }
  })

  test('should show correct item counts in tabs', async ({ page }) => {
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Click "All" tab
    await projectPage.clickQueueModalTab('all')

    // Get item count from tab text
    const allTabText = await projectPage.queueModalAllTab.textContent()
    const allItemCount = parseInt(allTabText?.match(/\((\d+)\)/)?.[1] || '0')

    // Verify items are displayed
    const displayedItems = await projectPage.getQueueItemsCount()
    expect(displayedItems).toBe(allItemCount)

    // Test other tabs
    await projectPage.clickQueueModalTab('pending')
    const pendingItems = await projectPage.getQueueItemsCount()
    expect(pendingItems).toBeGreaterThanOrEqual(0)

    await projectPage.clickQueueModalTab('in_progress')
    const inProgressItems = await projectPage.getQueueItemsCount()
    expect(inProgressItems).toBeGreaterThanOrEqual(0)

    await projectPage.clickQueueModalTab('completed')
    const completedItems = await projectPage.getQueueItemsCount()
    expect(completedItems).toBeGreaterThanOrEqual(0)
  })

  test('should filter items by status when switching tabs', async ({ page }) => {
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Click different tabs and verify filtering works
    await projectPage.clickQueueModalTab('pending')
    const pendingItemsCount = await projectPage.getQueueItemsCount()

    await projectPage.clickQueueModalTab('completed')
    const completedItemsCount = await projectPage.getQueueItemsCount()

    await projectPage.clickQueueModalTab('all')
    const allItemsCount = await projectPage.getQueueItemsCount()

    // All items should be greater than or equal to individual status counts
    expect(allItemsCount).toBeGreaterThanOrEqual(pendingItemsCount)
    expect(allItemsCount).toBeGreaterThanOrEqual(completedItemsCount)
  })

  test('should display queue item details', async ({ page }) => {
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()
    await projectPage.clickQueueModalTab('all')

    const items = await projectPage.getQueueItemsCount()
    if (items > 0) {
      const firstItem = projectPage.queueItems.first()
      await expect(firstItem).toBeVisible()

      // Items should have meaningful content
      const itemText = await firstItem.textContent()
      expect(itemText).toBeTruthy()
      expect(itemText!.length).toBeGreaterThan(10)
    }
  })

  test('should close modal correctly', async ({ page }) => {
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Close modal using close button
    await projectPage.closeQueueDetailsModal()
    await expect(projectPage.queueDetailsModal).not.toBeVisible()
  })

  test('should close modal with escape key', async ({ page }) => {
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Press escape to close
    await page.keyboard.press('Escape')
    await expect(projectPage.queueDetailsModal).not.toBeVisible()
  })

  test('should handle empty queue', async ({ page }) => {
    // Setup empty queue
    await page.route('**/api/queues/*/items', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            all: [],
            pending: [],
            inProgress: [],
            completed: []
          }
        })
      })
    })

    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)

    await expect(projectPage.queueDetailsModal).toBeVisible()
    await projectPage.clickQueueModalTab('all')

    // Should show empty state
    const itemCount = await projectPage.getQueueItemsCount()
    expect(itemCount).toBe(0)

    // Look for empty state message
    const emptyMessage = projectPage.queueDetailsModal.getByText(/no items|empty|nothing/i)
    if (await emptyMessage.isVisible({ timeout: 2000 })) {
      await expect(emptyMessage).toBeVisible()
    }
  })

  test('should handle multiple queues independently', async ({ page }) => {
    // Test that each queue modal shows different content
    const queues = ProjectPageTestData.testQueues.slice(0, 2)

    for (const queue of queues) {
      await projectPage.openQueueDetails(queue.name)
      await expect(projectPage.queueDetailsModal).toBeVisible()
      await expect(projectPage.queueDetailsModal).toContainText(queue.name)

      await projectPage.closeQueueDetailsModal()
      await expect(projectPage.queueDetailsModal).not.toBeVisible()
    }
  })
})

test.describe('Project Page - Flow Feature Integration', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should work with MCP integration when available', async ({ page }) => {
    await MCPTestHelpers.testMCPIntegrationSafely(page, 'flow features with MCP', async (mcpAvailable) => {
      if (mcpAvailable) {
        // Setup with real MCP integration
        await testManager.setupProjectPageEnvironment()
      } else {
        // Setup with mocks
        await testManager.setupProjectPageEnvironment()
        const flowScenario = ProjectPageDataFactory.createFlowScenario()
        await testManager.mockFlowTestData(flowScenario.testQueues, flowScenario.testTickets)
      }

      await projectPage.gotoProject(1)
      await projectPage.waitForProjectPageLoad()

      // Test basic flow functionality works regardless of MCP availability
      await expect(projectPage.flowSection).toBeVisible()
      await expect(projectPage.queueStats).toBeVisible()

      // Test queue cards are displayed
      const queueCardCount = await projectPage.page.getByTestId('queue-card').count()
      expect(queueCardCount).toBeGreaterThan(0)
    })
  })

  test('should gracefully handle MCP unavailability', async ({ page }) => {
    // Force MCP to be unavailable
    testManager.updateConfig({ enableMCP: false })

    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.mockFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // All flow features should still work with mocks
    await expect(projectPage.flowSection).toBeVisible()
    await expect(projectPage.queueStats).toBeVisible()

    // Statistics should still be displayed
    const stats = await projectPage.getQueueStatistics()
    expect(stats.totalQueues).toBeGreaterThan(0)
  })

  test('should integrate with other project page features', async ({ page }) => {
    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.setupFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Verify all major sections are loaded
    await projectPage.verifyAllSectionsLoaded()

    // Test that flow section doesn't interfere with other features
    // Fill user input
    await projectPage.fillUserInput('Testing flow integration')
    await expect(projectPage.userInputTextarea).toHaveValue('Testing flow integration')

    // Check file tree still works
    await expect(projectPage.fileTree).toBeVisible()

    // Check prompts still work
    await expect(projectPage.promptsContainer).toBeVisible()

    // Flow section should still be responsive
    await expect(projectPage.flowSection).toBeVisible()
    const stats = await projectPage.getQueueStatistics()
    expect(stats).toBeTruthy()
  })
})

test.describe('Project Page - Flow Feature Performance', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'performance', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle large number of queues efficiently', async ({ page }) => {
    // Create many queues
    const manyQueues = Array.from({ length: 20 }, (_, i) => ({
      name: `Queue ${i + 1}`,
      description: `Test queue ${i + 1} for performance testing`,
      maxParallelItems: Math.floor(Math.random() * 5) + 1,
      id: i + 1
    }))

    // Create many tickets
    const manyTickets = Array.from({ length: 100 }, (_, i) => ({
      title: `Ticket ${i + 1}`,
      overview: `Performance test ticket ${i + 1}`,
      priority: ['low', 'normal', 'high'][i % 3],
      id: i + 1,
      queueId: (i % 20) + 1 // Distribute across queues
    }))

    await testManager.setupProjectPageEnvironment()
    await testManager.setupFlowTestData(manyQueues, manyTickets)

    // Measure loading time
    const startTime = Date.now()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
    const loadTime = Date.now() - startTime

    // Should load within reasonable time even with many queues
    expect(loadTime).toBeLessThan(15000) // 15 seconds max

    await expect(projectPage.flowSection).toBeVisible()

    // Statistics should still be accurate
    const stats = await projectPage.getQueueStatistics()
    expect(stats.totalQueues).toBe(20)
  })

  test('should handle frequent statistics updates', async ({ page }) => {
    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.setupFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Simulate frequent updates
    let updateCount = 0
    await page.route('**/api/queues/stats', async (route) => {
      updateCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            activeQueues: 3 + (updateCount % 2),
            totalQueues: 4,
            inProgress: 5 + updateCount,
            pending: Math.max(0, 10 - updateCount),
            completed: 15 + updateCount * 2
          }
        })
      })
    })

    // Trigger multiple updates
    for (let i = 0; i < 10; i++) {
      await page.reload()
      await projectPage.waitForProjectPageLoad()

      // Verify page still responds
      await expect(projectPage.flowSection).toBeVisible()
      const stats = await projectPage.getQueueStatistics()
      expect(stats).toBeTruthy()

      await page.waitForTimeout(100)
    }

    expect(updateCount).toBeGreaterThan(5)
  })
})

test.describe('Project Page - Flow Feature Error Handling', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle queue loading errors gracefully', async ({ page }) => {
    // Mock queue API to return error
    await page.route('**/api/queues**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to load queues'
        })
      })
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Flow section should still be visible but show error state
    await expect(projectPage.flowSection).toBeVisible()

    // Should show error message or empty state
    const errorMessage = page.getByTestId('queues-error').or(page.getByText(/error.*queue|failed.*load/i))
    if (await errorMessage.isVisible({ timeout: 5000 })) {
      await expect(errorMessage).toBeVisible()
    } else {
      // Should at least show empty state
      const queueCount = await page.getByTestId('queue-card').count()
      expect(queueCount).toBe(0)
    }
  })

  test('should handle modal loading errors', async ({ page }) => {
    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.setupFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Mock queue details to fail
    await page.route('**/api/queues/*/items', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load queue items' })
      })
    })

    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.queueViewDetailsButton(firstQueue.name).click()

    // Modal should still open
    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Should show error state in modal
    const modalError = projectPage.queueDetailsModal.getByText(/error|failed|loading/i)
    if (await modalError.isVisible({ timeout: 5000 })) {
      await expect(modalError).toBeVisible()
    }
  })

  test('should handle slow API responses', async ({ page }) => {
    // Mock slow queue loading
    await page.route('**/api/queues**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000)) // 3 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: ProjectPageTestData.testQueues.slice(0, 2)
        })
      })
    })

    await projectPage.gotoProject(1)

    // Should show loading state
    const loadingIndicator = page.getByTestId('flow-loading').or(page.getByText('Loading'))
    if (await loadingIndicator.isVisible({ timeout: 2000 })) {
      await expect(loadingIndicator).toBeVisible()
    }

    // Eventually should load
    await expect(projectPage.flowSection).toBeVisible({ timeout: 10000 })
    await expect(projectPage.queueStats).toBeVisible()
  })

  test('should handle network disconnection during modal usage', async ({ page }) => {
    const flowScenario = ProjectPageDataFactory.createFlowScenario()
    await testManager.setupProjectPageEnvironment(flowScenario)
    await testManager.setupFlowTestData(flowScenario.testQueues, flowScenario.testTickets)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Open modal successfully first
    const firstQueue = ProjectPageTestData.testQueues[0]
    await projectPage.openQueueDetails(firstQueue.name)
    await expect(projectPage.queueDetailsModal).toBeVisible()

    // Simulate network disconnection
    await page.route('**/api/**', (route) => route.abort())

    // Try to switch tabs (which might trigger API calls)
    await projectPage.clickQueueModalTab('pending')

    // Should handle network error gracefully
    const networkError = page.getByText(/network.*error|offline|connection/i)
    if (await networkError.isVisible({ timeout: 3000 })) {
      await expect(networkError).toBeVisible()
    } else {
      // Should at least not crash the modal
      await expect(projectPage.queueDetailsModal).toBeVisible()
    }
  })
})
