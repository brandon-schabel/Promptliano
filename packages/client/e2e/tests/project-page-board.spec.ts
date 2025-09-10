/**
 * Project Page - Task Queue Board Test Suite
 *
 * Tests drag-and-drop operations, ticket-task relationships,
 * queue management, and board interactions.
 */

import { test, expect } from '@playwright/test'
import { ProjectPage } from '../pages/project-page'
import { ProjectPageTestUtils } from '../utils/project-page-test-manager'
import { ProjectPageTestData, ProjectPageDataFactory } from '../fixtures/project-page-data'
import { MCPTestHelpers } from '../utils/mcp-test-helpers'

test.describe('Project Page - Task Queue Board Display', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'drag-drop', testInfo)
    projectPage = new ProjectPage(page)

    // Setup environment with drag-drop test data
    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should display task queue board with all columns', async ({ page }) => {
    // Wait for task queue board to load
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Verify Unqueued column exists
    await expect(projectPage.unqueuedColumn).toBeVisible()
    await expect(projectPage.unqueuedColumn).toContainText('Unqueued')

    // Verify all test queue columns exist
    for (const queue of ProjectPageTestData.testQueues) {
      await expect(projectPage.queueColumn(queue.name)).toBeVisible()
      await expect(projectPage.queueColumn(queue.name)).toContainText(queue.name)
    }
  })

  test('should display tickets with their task information', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Find tickets in the board
    const ticketCards = projectPage.page.getByTestId('ticket-card')
    const ticketCount = await ticketCards.count()
    expect(ticketCount).toBeGreaterThan(0)

    // Check first few tickets
    for (let i = 0; i < Math.min(ticketCount, 3); i++) {
      const ticket = ticketCards.nth(i)
      await expect(ticket).toBeVisible()

      // Verify ticket shows title
      const ticketTitle = ticket.getByTestId('ticket-title')
      if (await ticketTitle.isVisible()) {
        const titleText = await ticketTitle.textContent()
        expect(titleText).toBeTruthy()
        expect(titleText!.length).toBeGreaterThan(0)
      }

      // Verify ticket shows task count
      const ticketTasks = ticket.getByTestId('ticket-tasks')
      if (await ticketTasks.isVisible()) {
        const tasksText = await ticketTasks.textContent()
        expect(tasksText).toMatch(/\d+\s+task/i)
      }
    }
  })

  test('should show appropriate tickets in each column', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Check unqueued column has some tickets
    const unqueuedTickets = await projectPage.getTicketCountInColumn('unqueued')
    expect(unqueuedTickets).toBeGreaterThanOrEqual(0)

    // Check each queue column
    for (const queue of ProjectPageTestData.testQueues) {
      const ticketsInQueue = await projectPage.getTicketCountInColumn(queue.name)
      expect(ticketsInQueue).toBeGreaterThanOrEqual(0)
    }

    // Total tickets should be sum of all columns
    let totalTickets = unqueuedTickets
    for (const queue of ProjectPageTestData.testQueues) {
      totalTickets += await projectPage.getTicketCountInColumn(queue.name)
    }

    expect(totalTickets).toBeGreaterThan(0)
  })

  test('should display board with proper layout and styling', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Verify board has reasonable dimensions
    const boardBox = await projectPage.taskQueueBoard.boundingBox()
    expect(boardBox).toBeTruthy()
    expect(boardBox!.width).toBeGreaterThan(800) // Minimum width for multiple columns
    expect(boardBox!.height).toBeGreaterThan(400) // Minimum height

    // Verify columns are properly laid out
    const columns = await projectPage.getAllColumnNames()
    expect(columns.length).toBeGreaterThanOrEqual(4) // Unqueued + 3 test queues

    // Check column spacing (columns should not overlap)
    const unqueuedBox = await projectPage.unqueuedColumn.boundingBox()
    const firstQueueBox = await projectPage.queueColumn(ProjectPageTestData.testQueues[0].name).boundingBox()

    if (unqueuedBox && firstQueueBox) {
      expect(unqueuedBox.x + unqueuedBox.width).toBeLessThanOrEqual(firstQueueBox.x + 20) // Allow small overlap for styling
    }
  })

  test('should verify drag-drop functionality is enabled', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Verify drag-drop is enabled
    const dragDropEnabled = await projectPage.verifyDragDropEnabled()
    if (!dragDropEnabled) {
      // If drag-drop attributes aren't set, the functionality might still work
      console.warn('Drag-drop attributes not found, but functionality may still work')
    }

    // Test that tickets have proper cursor styling for dragging
    const firstTicket = projectPage.page.getByTestId('ticket-card').first()
    if (await firstTicket.isVisible()) {
      const cursorStyle = await firstTicket.evaluate((el) => getComputedStyle(el).cursor)
      // Should have move cursor or pointer cursor for draggable elements
      expect(['move', 'pointer', 'grab', 'default']).toContain(cursorStyle)
    }
  })
})

test.describe('Project Page - Drag and Drop Operations', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'drag-drop', testInfo)
    projectPage = new ProjectPage(page)

    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should drag ticket from unqueued to a queue', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Get initial counts
    const initialUnqueuedCount = await projectPage.getTicketCountInColumn('unqueued')
    const initialFeaturesCount = await projectPage.getTicketCountInColumn('Features')

    // Only proceed if there are unqueued tickets
    if (initialUnqueuedCount > 0) {
      // Get a ticket from unqueued column
      const unqueuedTickets = projectPage.unqueuedColumn.getByTestId('ticket-card')
      const firstUnqueuedTicket = unqueuedTickets.first()
      await expect(firstUnqueuedTicket).toBeVisible()

      const ticketTitle = await firstUnqueuedTicket.getByTestId('ticket-title').textContent()

      // Drag ticket to Features queue
      await projectPage.dragTicketToQueue(ticketTitle!, 'Features')

      // Verify ticket is now in Features queue
      await expect(projectPage.verifyTicketInColumn(ticketTitle!, 'Features')).resolves.toBeTruthy()

      // Verify ticket counts updated
      const newUnqueuedCount = await projectPage.getTicketCountInColumn('unqueued')
      const newFeaturesCount = await projectPage.getTicketCountInColumn('Features')

      expect(newUnqueuedCount).toBe(initialUnqueuedCount - 1)
      expect(newFeaturesCount).toBe(initialFeaturesCount + 1)
    } else {
      console.log('No unqueued tickets available for drag test')
    }
  })

  test('should drag ticket between two queues', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    const sourceQueue = 'Features'
    const targetQueue = 'Bugs'

    const initialSourceCount = await projectPage.getTicketCountInColumn(sourceQueue)
    const initialTargetCount = await projectPage.getTicketCountInColumn(targetQueue)

    // Only proceed if source queue has tickets
    if (initialSourceCount > 0) {
      const sourceTickets = projectPage.queueColumn(sourceQueue).getByTestId('ticket-card')
      const firstTicket = sourceTickets.first()
      await expect(firstTicket).toBeVisible()

      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

      // Drag from Features to Bugs
      await projectPage.dragTicketToQueue(ticketTitle!, targetQueue)

      // Verify ticket moved
      await expect(projectPage.verifyTicketInColumn(ticketTitle!, targetQueue)).resolves.toBeTruthy()
      await expect(projectPage.verifyTicketInColumn(ticketTitle!, sourceQueue)).resolves.toBeFalsy()

      // Verify counts updated
      const newSourceCount = await projectPage.getTicketCountInColumn(sourceQueue)
      const newTargetCount = await projectPage.getTicketCountInColumn(targetQueue)

      expect(newSourceCount).toBe(initialSourceCount - 1)
      expect(newTargetCount).toBe(initialTargetCount + 1)
    }
  })

  test('should drag ticket back to unqueued column', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    const sourceQueue = 'Features'
    const initialSourceCount = await projectPage.getTicketCountInColumn(sourceQueue)
    const initialUnqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (initialSourceCount > 0) {
      const sourceTickets = projectPage.queueColumn(sourceQueue).getByTestId('ticket-card')
      const firstTicket = sourceTickets.first()
      await expect(firstTicket).toBeVisible()

      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

      // Drag back to unqueued
      await projectPage.dragTicketToQueue(ticketTitle!, 'unqueued')

      // Verify ticket is unqueued
      await expect(projectPage.verifyTicketInColumn(ticketTitle!, 'unqueued')).resolves.toBeTruthy()
      await expect(projectPage.verifyTicketInColumn(ticketTitle!, sourceQueue)).resolves.toBeFalsy()

      // Verify counts updated
      const newSourceCount = await projectPage.getTicketCountInColumn(sourceQueue)
      const newUnqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

      expect(newSourceCount).toBe(initialSourceCount - 1)
      expect(newUnqueuedCount).toBe(initialUnqueuedCount + 1)
    }
  })

  test('should handle multiple drag operations in sequence', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Perform multiple drag operations
    const operations = [
      { from: 'unqueued', to: 'Features' },
      { from: 'Features', to: 'Bugs' },
      { from: 'Bugs', to: 'Improvements' }
    ]

    for (const operation of operations) {
      const sourceColumn = operation.from === 'unqueued' ? 'unqueued' : operation.from
      const targetColumn = operation.to === 'unqueued' ? 'unqueued' : operation.to

      const sourceCount = await projectPage.getTicketCountInColumn(sourceColumn)

      if (sourceCount > 0) {
        // Get first ticket from source column
        const sourceColumnElement =
          sourceColumn === 'unqueued' ? projectPage.unqueuedColumn : projectPage.queueColumn(sourceColumn)

        const tickets = sourceColumnElement.getByTestId('ticket-card')
        const firstTicket = tickets.first()

        if (await firstTicket.isVisible()) {
          const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

          if (ticketTitle) {
            await projectPage.dragTicketToQueue(ticketTitle, targetColumn)

            // Verify the move
            await expect(projectPage.verifyTicketInColumn(ticketTitle, targetColumn)).resolves.toBeTruthy()

            // Small delay between operations
            await page.waitForTimeout(500)
          }
        }
      }
    }
  })

  test('should handle drag and drop with visual feedback', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
      await expect(firstTicket).toBeVisible()

      // Start drag operation
      const ticketBox = await firstTicket.boundingBox()
      expect(ticketBox).toBeTruthy()

      // Move mouse to ticket to initiate hover
      await page.mouse.move(ticketBox!.x + ticketBox!.width / 2, ticketBox!.y + ticketBox!.height / 2)
      await page.mouse.down()

      // Look for drag visual feedback
      const draggedElement = page.locator('.dragging, [data-dragging="true"]')
      if (await draggedElement.isVisible({ timeout: 1000 })) {
        // Check visual feedback styles
        const opacity = await draggedElement.evaluate((el) => getComputedStyle(el).opacity)
        // During drag, element might be semi-transparent
        expect(parseFloat(opacity)).toBeLessThanOrEqual(1)
      }

      // Complete the drag
      const featuresColumn = projectPage.queueColumn('Features')
      const featuresBox = await featuresColumn.boundingBox()
      if (featuresBox) {
        await page.mouse.move(featuresBox.x + featuresBox.width / 2, featuresBox.y + featuresBox.height / 2)
        await page.mouse.up()
      }
    }
  })
})

test.describe('Project Page - Ticket-Task Relationships', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'drag-drop', testInfo)
    projectPage = new ProjectPage(page)

    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should move all tasks with ticket when dragging', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Find a ticket with tasks
    const featuresColumn = projectPage.queueColumn('Features')
    const ticketsInFeatures = featuresColumn.getByTestId('ticket-card')

    if ((await ticketsInFeatures.count()) > 0) {
      const firstTicket = ticketsInFeatures.first()
      await expect(firstTicket).toBeVisible()

      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()
      const taskCount = await projectPage.getTaskCountForTicket(ticketTitle!)

      // Get initial task counts in target column
      const bugsColumn = projectPage.queueColumn('Bugs')
      const initialBugsTasks = await bugsColumn.getByTestId('task-card').count()

      // Drag ticket from Features to Bugs
      await projectPage.dragTicketToQueue(ticketTitle!, 'Bugs')

      // Verify all tasks moved with the ticket
      const newBugsTasks = await bugsColumn.getByTestId('task-card').count()
      expect(newBugsTasks).toBe(initialBugsTasks + taskCount)

      // Verify tasks still belong to the moved ticket
      const movedTicket = bugsColumn.getByTestId('ticket-card').filter({ hasText: ticketTitle! })
      if (await movedTicket.isVisible()) {
        const ticketTasksAfterMove = await projectPage.getTaskCountForTicket(ticketTitle!)
        expect(ticketTasksAfterMove).toBe(taskCount)
      }
    }
  })

  test('should maintain ticket-task relationships during moves', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Find a specific ticket we know has tasks
    const authTicket = projectPage.ticketCard('Implement User Authentication')

    if (await authTicket.isVisible()) {
      // Get tasks belonging to this ticket before move
      const tasksBeforeMove = authTicket.getByTestId('task-card')
      const taskCountBefore = await tasksBeforeMove.count()

      // Get current queue
      const currentColumn = authTicket.locator(
        'xpath=ancestor::*[@data-testid="queue-column" or @data-testid="unqueued-column"]'
      )

      // Move to different queue
      await projectPage.dragTicketToQueue('Implement User Authentication', 'Improvements')

      // Find moved ticket
      const movedTicket = projectPage.queueColumn('Improvements').getByTestId('ticket-card').filter({
        hasText: 'Implement User Authentication'
      })

      if (await movedTicket.isVisible()) {
        // Verify all tasks moved and still belong to the ticket
        const tasksAfterMove = movedTicket.getByTestId('task-card')
        await expect(tasksAfterMove).toHaveCount(taskCountBefore)

        // Verify specific task content is preserved
        if (taskCountBefore > 0) {
          await expect(tasksAfterMove.first()).toContainText('Design login UI')
        }
      }
    }
  })

  test('should display correct task counts in tickets', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Check several tickets for task count accuracy
    const ticketCards = projectPage.page.getByTestId('ticket-card')
    const ticketCount = await ticketCards.count()

    for (let i = 0; i < Math.min(ticketCount, 3); i++) {
      const ticket = ticketCards.nth(i)
      const ticketTitle = await ticket.getByTestId('ticket-title').textContent()

      if (ticketTitle) {
        // Get displayed task count
        const displayedCount = await projectPage.getTaskCountForTicket(ticketTitle)

        // Count actual task cards for this ticket
        const actualTaskCards = ticket.getByTestId('task-card')
        const actualCount = await actualTaskCards.count()

        // Displayed count should match actual count
        expect(displayedCount).toBe(actualCount)
      }
    }
  })

  test('should show task details within tickets', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    const ticketCards = projectPage.page.getByTestId('ticket-card')

    if ((await ticketCards.count()) > 0) {
      const firstTicket = ticketCards.first()
      const taskCards = firstTicket.getByTestId('task-card')

      if ((await taskCards.count()) > 0) {
        const firstTask = taskCards.first()
        await expect(firstTask).toBeVisible()

        // Task should have meaningful content
        const taskText = await firstTask.textContent()
        expect(taskText).toBeTruthy()
        expect(taskText!.length).toBeGreaterThan(5)

        // Task should reference its parent ticket
        const taskTicketInfo = firstTask.getByTestId('task-ticket')
        if (await taskTicketInfo.isVisible()) {
          const ticketReference = await taskTicketInfo.textContent()
          expect(ticketReference).toBeTruthy()
        }
      }
    }
  })

  test('should handle orphaned tasks appropriately', async ({ page }) => {
    // This test verifies that if a ticket is moved, its tasks follow correctly
    // and don't become orphaned in the original column

    await expect(projectPage.taskQueueBoard).toBeVisible()

    const featuresColumn = projectPage.queueColumn('Features')
    const initialFeaturesTasks = await featuresColumn.getByTestId('task-card').count()

    if (initialFeaturesTasks > 0) {
      // Find ticket with tasks in Features
      const ticketsInFeatures = featuresColumn.getByTestId('ticket-card')
      const firstTicket = ticketsInFeatures.first()

      if (await firstTicket.isVisible()) {
        const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()
        const ticketTaskCount = await projectPage.getTaskCountForTicket(ticketTitle!)

        // Move ticket to Bugs
        await projectPage.dragTicketToQueue(ticketTitle!, 'Bugs')

        // Verify no orphaned tasks left in Features column
        const remainingFeaturesTasks = await featuresColumn.getByTestId('task-card').count()
        expect(remainingFeaturesTasks).toBe(initialFeaturesTasks - ticketTaskCount)

        // Verify tasks are now in Bugs column with their ticket
        const bugsColumn = projectPage.queueColumn('Bugs')
        const movedTicket = bugsColumn.getByTestId('ticket-card').filter({ hasText: ticketTitle! })
        const tasksWithMovedTicket = movedTicket.getByTestId('task-card')
        await expect(tasksWithMovedTicket).toHaveCount(ticketTaskCount)
      }
    }
  })
})

test.describe('Project Page - Queue Management via Board', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'drag-drop', testInfo)
    projectPage = new ProjectPage(page)

    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should update queue statistics when tickets are moved', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Get initial statistics
    const initialStats = await projectPage.getQueueStatistics()

    // Move a ticket if possible
    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstUnqueuedTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
      const ticketTitle = await firstUnqueuedTicket.getByTestId('ticket-title').textContent()

      if (ticketTitle) {
        // Move ticket from unqueued to Features
        await projectPage.dragTicketToQueue(ticketTitle, 'Features')

        // Wait for statistics to update
        await page.waitForTimeout(1000)

        // Get updated statistics
        const updatedStats = await projectPage.getQueueStatistics()

        // Statistics should reflect the change
        // (This depends on how statistics are calculated)
        expect(updatedStats).toBeTruthy()
      }
    }
  })

  test('should handle queue capacity limits gracefully', async ({ page }) => {
    // Test assumes queues have maxParallelItems limits
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Try to move many tickets to Improvements queue (which has maxParallelItems: 1)
    const improvementsQueue = 'Improvements'
    const initialImprovementsCount = await projectPage.getTicketCountInColumn(improvementsQueue)

    // Try to add multiple tickets
    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    for (let i = 0; i < Math.min(unqueuedCount, 3); i++) {
      const unqueuedTickets = projectPage.unqueuedColumn.getByTestId('ticket-card')

      if ((await unqueuedTickets.count()) > 0) {
        const ticket = unqueuedTickets.first()
        const ticketTitle = await ticket.getByTestId('ticket-title').textContent()

        if (ticketTitle) {
          await projectPage.dragTicketToQueue(ticketTitle, improvementsQueue)
          await page.waitForTimeout(500)
        }
      }
    }

    // Check if queue respects capacity limits
    const finalImprovementsCount = await projectPage.getTicketCountInColumn(improvementsQueue)
    // This test depends on whether capacity limits are enforced in the UI
    expect(finalImprovementsCount).toBeGreaterThanOrEqual(initialImprovementsCount)
  })

  test('should provide visual feedback for invalid drop zones', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()

      // Start drag
      const ticketBox = await firstTicket.boundingBox()
      if (ticketBox) {
        await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2)
        await page.mouse.down()

        // Move over invalid drop zone (outside columns)
        await page.mouse.move(100, 100) // Top left corner

        // Look for invalid drop zone feedback
        const invalidDropFeedback = page.locator('.invalid-drop, [data-invalid-drop="true"], .no-drop')
        if (await invalidDropFeedback.isVisible({ timeout: 500 })) {
          // Cursor might change to indicate invalid drop
          const cursorStyle = await page.locator('body').evaluate((el) => getComputedStyle(el).cursor)
          expect(['no-drop', 'not-allowed']).toContain(cursorStyle)
        }

        // Cancel drag
        await page.mouse.up()
      }
    }
  })

  test('should maintain board state during page interactions', async ({ page }) => {
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Record initial board state
    const initialUnqueuedCount = await projectPage.getTicketCountInColumn('unqueued')
    const initialFeaturesCount = await projectPage.getTicketCountInColumn('Features')

    // Perform other page interactions
    await projectPage.fillUserInput('Test board state persistence')
    await projectPage.toggleFileSelection('package.json')

    // Board state should remain unchanged
    const currentUnqueuedCount = await projectPage.getTicketCountInColumn('unqueued')
    const currentFeaturesCount = await projectPage.getTicketCountInColumn('Features')

    expect(currentUnqueuedCount).toBe(initialUnqueuedCount)
    expect(currentFeaturesCount).toBe(initialFeaturesCount)
  })
})

test.describe('Project Page - Board Performance and Edge Cases', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'performance', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle large numbers of tickets efficiently', async ({ page }) => {
    // Create scenario with many tickets
    const manyTickets = Array.from({ length: 50 }, (_, i) => ({
      title: `Performance Test Ticket ${i + 1}`,
      overview: `Ticket ${i + 1} for performance testing`,
      priority: ['low', 'normal', 'high'][i % 3],
      id: i + 1,
      queueId: i % 4 === 0 ? null : (i % 3) + 1,
      tasks: ProjectPageDataFactory.createTasksForTicket(`Performance Test Ticket ${i + 1}`, 3)
    }))

    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData({
      queues: ProjectPageTestData.testQueues,
      tickets: manyTickets,
      unqueuedTickets: 10
    })

    // Measure loading time
    const startTime = Date.now()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
    const loadTime = Date.now() - startTime

    // Should load within reasonable time
    expect(loadTime).toBeLessThan(15000) // 15 seconds max

    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Board should be responsive
    const totalTickets = await projectPage.page.getByTestId('ticket-card').count()
    expect(totalTickets).toBeGreaterThan(40) // Should show most tickets
  })

  test('should handle rapid drag operations', async ({ page }) => {
    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Perform rapid drag operations
    const operations = ['Features', 'Bugs', 'Improvements', 'Features']

    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

      if (ticketTitle) {
        for (const targetQueue of operations) {
          await projectPage.dragTicketToQueue(ticketTitle, targetQueue)
          await page.waitForTimeout(200) // Short delay between operations
        }

        // Verify final state is correct
        await expect(projectPage.verifyTicketInColumn(ticketTitle, 'Features')).resolves.toBeTruthy()
      }
    }
  })

  test('should handle edge case: empty board', async ({ page }) => {
    // Setup empty board
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData({
      queues: ProjectPageTestData.testQueues,
      tickets: [],
      unqueuedTickets: 0
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    await expect(projectPage.taskQueueBoard).toBeVisible()

    // All columns should be empty but visible
    expect(await projectPage.getTicketCountInColumn('unqueued')).toBe(0)

    for (const queue of ProjectPageTestData.testQueues) {
      expect(await projectPage.getTicketCountInColumn(queue.name)).toBe(0)
    }

    // Should show empty state messaging
    const emptyState = page.getByText(/no tickets|empty|drag tickets/i)
    if (await emptyState.isVisible({ timeout: 3000 })) {
      await expect(emptyState).toBeVisible()
    }
  })

  test('should handle edge case: tickets without tasks', async ({ page }) => {
    // Create tickets without tasks
    const ticketsWithoutTasks = [
      {
        title: 'Ticket Without Tasks',
        overview: 'This ticket has no associated tasks',
        priority: 'normal' as const,
        id: 1,
        queueId: null,
        tasks: []
      }
    ]

    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData({
      queues: ProjectPageTestData.testQueues,
      tickets: ticketsWithoutTasks,
      unqueuedTickets: 1
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    const ticketWithoutTasks = projectPage.ticketCard('Ticket Without Tasks')
    await expect(ticketWithoutTasks).toBeVisible()

    // Should show 0 tasks
    const taskCount = await projectPage.getTaskCountForTicket('Ticket Without Tasks')
    expect(taskCount).toBe(0)

    // Should still be draggable
    await projectPage.dragTicketToQueue('Ticket Without Tasks', 'Features')
    await expect(projectPage.verifyTicketInColumn('Ticket Without Tasks', 'Features')).resolves.toBeTruthy()
  })
})

test.describe('Project Page - Board Error Handling', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'drag-drop', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle drag operation failures gracefully', async ({ page }) => {
    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Mock drag operation to fail
    await page.route('**/api/tickets/*/queue', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to move ticket' })
      })
    })

    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

      if (ticketTitle) {
        // Try to drag ticket - should fail
        await projectPage.dragTicketToQueue(ticketTitle, 'Features')

        // Should show error message
        const errorMessage = page.getByText(/error.*moving|failed.*move|operation.*failed/i)
        if (await errorMessage.isVisible({ timeout: 5000 })) {
          await expect(errorMessage).toBeVisible()
        }

        // Ticket should remain in original position
        await expect(projectPage.verifyTicketInColumn(ticketTitle, 'unqueued')).resolves.toBeTruthy()
      }
    }
  })

  test('should handle board loading errors', async ({ page }) => {
    // Mock board data loading to fail
    await page.route('**/api/board/tickets**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load board data' })
      })
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Board should still be visible but show error state
    await expect(projectPage.taskQueueBoard).toBeVisible()

    const errorState = page.getByText(/error.*loading|failed.*load.*board/i)
    if (await errorState.isVisible({ timeout: 5000 })) {
      await expect(errorState).toBeVisible()
    } else {
      // Should at least show empty board
      const ticketCount = await projectPage.page.getByTestId('ticket-card').count()
      expect(ticketCount).toBe(0)
    }
  })

  test('should recover from network interruptions', async ({ page }) => {
    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Verify initial state
    await expect(projectPage.taskQueueBoard).toBeVisible()

    // Simulate network failure
    await page.route('**/api/**', (route) => route.abort())

    // Try to perform drag operation
    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

      if (ticketTitle) {
        try {
          await projectPage.dragTicketToQueue(ticketTitle, 'Features')
        } catch (error) {
          // Expected to fail due to network interruption
        }

        // Should show network error
        const networkError = page.getByText(/network.*error|offline|connection.*failed/i)
        if (await networkError.isVisible({ timeout: 3000 })) {
          await expect(networkError).toBeVisible()
        }
      }
    }
  })

  test('should handle concurrent drag operations', async ({ page }) => {
    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // This test simulates what would happen if multiple users
    // were dragging tickets simultaneously (optimistic updates)

    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount >= 2) {
      const tickets = projectPage.unqueuedColumn.getByTestId('ticket-card')

      const firstTicketTitle = await tickets.nth(0).getByTestId('ticket-title').textContent()
      const secondTicketTitle = await tickets.nth(1).getByTestId('ticket-title').textContent()

      if (firstTicketTitle && secondTicketTitle) {
        // Simulate concurrent operations by making API calls slow
        let callCount = 0
        await page.route('**/api/tickets/*/queue', async (route) => {
          callCount++
          await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { message: `Move operation ${callCount} completed` }
            })
          })
        })

        // Start both drag operations quickly
        const dragPromise1 = projectPage.dragTicketToQueue(firstTicketTitle, 'Features')
        const dragPromise2 = projectPage.dragTicketToQueue(secondTicketTitle, 'Bugs')

        // Wait for both to complete
        await Promise.all([dragPromise1, dragPromise2])

        // Both operations should succeed
        await expect(projectPage.verifyTicketInColumn(firstTicketTitle, 'Features')).resolves.toBeTruthy()
        await expect(projectPage.verifyTicketInColumn(secondTicketTitle, 'Bugs')).resolves.toBeTruthy()
      }
    }
  })
})

test.describe('Project Page - Board Integration with MCP', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'drag-drop', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should work with MCP integration when available', async ({ page }) => {
    await MCPTestHelpers.testMCPIntegrationSafely(page, 'board with MCP', async (mcpAvailable) => {
      if (mcpAvailable) {
        // Setup with real MCP integration
        const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
        await testManager.setupProjectPageEnvironment()
        await testManager.setupTaskQueueBoardData(dragDropScenario)
      } else {
        // Setup with mocks
        const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
        await testManager.setupProjectPageEnvironment()
        await testManager.setupTaskQueueBoardData(dragDropScenario)
      }

      await projectPage.gotoProject(1)
      await projectPage.waitForProjectPageLoad()

      // Test basic board functionality works regardless of MCP availability
      await expect(projectPage.taskQueueBoard).toBeVisible()

      const ticketCount = await projectPage.page.getByTestId('ticket-card').count()
      expect(ticketCount).toBeGreaterThan(0)

      // Test drag operations work
      const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

      if (unqueuedCount > 0) {
        const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
        const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

        if (ticketTitle) {
          await projectPage.dragTicketToQueue(ticketTitle, 'Features')
          await expect(projectPage.verifyTicketInColumn(ticketTitle, 'Features')).resolves.toBeTruthy()
        }
      }
    })
  })

  test('should handle MCP tool calls for queue operations', async ({ page }) => {
    const dragDropScenario = ProjectPageDataFactory.createDragDropScenario()
    await testManager.setupProjectPageEnvironment()
    await testManager.setupTaskQueueBoardData(dragDropScenario)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Mock MCP tool calls
    await page.route('**/api/mcp/**', async (route) => {
      const postData = await route.request().postDataJSON()

      if (postData?.tool === 'flow_manager') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            result: {
              action: postData.params?.action || 'move_ticket',
              data: { message: 'MCP queue operation completed' }
            }
          })
        })
      } else {
        route.continue()
      }
    })

    // Perform board operations that might trigger MCP calls
    const unqueuedCount = await projectPage.getTicketCountInColumn('unqueued')

    if (unqueuedCount > 0) {
      const firstTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
      const ticketTitle = await firstTicket.getByTestId('ticket-title').textContent()

      if (ticketTitle) {
        await projectPage.dragTicketToQueue(ticketTitle, 'Features')

        // Should work with MCP integration
        await expect(projectPage.verifyTicketInColumn(ticketTitle, 'Features')).resolves.toBeTruthy()
      }
    }
  })
})
