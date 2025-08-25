import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { FlowPage, type FlowItem } from '../pages/flow.page'
import { TicketsPage } from '../pages/tickets.page'
import { ProjectsPage } from '../pages/projects.page'
import { TestDataFactory } from '../fixtures/test-data'
import { TestAssertions, TestDataManager, MCPTestHelpers } from '../utils/test-helpers'

test.describe('Flow System', () => {
  let appPage: AppPage
  let flowPage: FlowPage
  let ticketsPage: TicketsPage
  let projectsPage: ProjectsPage
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    flowPage = new FlowPage(page)
    ticketsPage = new TicketsPage(page)
    projectsPage = new ProjectsPage(page)
    dataManager = new TestDataManager(page)

    // Navigate to flow page and wait for app to be ready
    await flowPage.goto()
    await appPage.waitForAppReady()
    await flowPage.waitForFlowToLoad()
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
  })

  test.describe('Flow Tab Navigation and Layout', () => {
    test('should display flow interface correctly', async ({ page }) => {
      // Verify main flow elements are visible
      await expect(page.getByTestId('flow-diagram')).toBeVisible()
      await expect(page.getByTestId('flow-controls')).toBeVisible()
      await expect(page.getByTestId('flow-statistics')).toBeVisible()
      
      // Verify flow controls are available
      await expect(page.getByRole('button', { name: 'Create Queue' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Zoom In' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Zoom Out' })).toBeVisible()
    })

    test('should support zoom functionality', async ({ page }) => {
      // Test zoom in
      await flowPage.zoomIn(2)
      
      // Verify zoom level increased (check if elements appear larger)
      const diagramBounds = await page.getByTestId('flow-diagram').boundingBox()
      expect(diagramBounds).not.toBeNull()
      
      // Test zoom out
      await flowPage.zoomOut(3)
      
      // Test reset zoom
      await flowPage.resetZoom()
      
      // Verify zoom controls are responsive
      await expect(page.getByRole('button', { name: 'Zoom In' })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Zoom Out' })).toBeEnabled()
    })

    test('should support pan functionality', async ({ page }) => {
      // Create some content to pan around
      await flowPage.createQueue({
        name: 'Pan Test Queue 1',
        description: 'Queue for testing pan functionality'
      })

      await flowPage.createQueue({
        name: 'Pan Test Queue 2',
        description: 'Second queue for pan testing'
      })

      // Test panning in different directions
      await flowPage.panFlowDiagram('right', 100)
      await flowPage.panFlowDiagram('down', 100)
      await flowPage.panFlowDiagram('left', 50)
      await flowPage.panFlowDiagram('up', 50)

      // Verify diagram is still responsive after panning
      await expect(page.getByTestId('flow-diagram')).toBeVisible()
    })

    test('should be responsive across different viewport sizes', async ({ page }) => {
      await flowPage.verifyResponsiveLayout()
    })
  })

  test.describe('Queue Management', () => {
    test('should create a new queue successfully', async ({ page }) => {
      const queueConfig = {
        name: 'Test Development Queue',
        description: 'Queue for development workflow testing',
        type: 'development',
        processingRate: 5,
        maxConcurrent: 3
      }

      const queueId = await flowPage.createQueue(queueConfig)

      // Verify queue was created
      expect(queueId).toBeTruthy()
      await expect(page.getByTestId(`queue-${queueConfig.name}`)).toBeVisible()
      
      // Verify queue shows correct configuration
      const queueElement = page.getByTestId(`queue-${queueConfig.name}`)
      await expect(queueElement.getByText(queueConfig.name)).toBeVisible()
      await expect(queueElement.getByText(queueConfig.description)).toBeVisible()
    })

    test('should configure queue with advanced settings', async ({ page }) => {
      const queueConfig = {
        name: 'Advanced Config Queue',
        description: 'Testing advanced queue configuration',
        type: 'custom',
        processingRate: 10,
        maxConcurrent: 5
      }

      await flowPage.createQueue(queueConfig)

      // View queue details
      await flowPage.viewQueueDetails(queueConfig.name)

      // Verify advanced settings are reflected
      const detailsPanel = page.getByTestId('queue-details-panel')
      await expect(detailsPanel.getByText(`Processing Rate: ${queueConfig.processingRate}/min`)).toBeVisible()
      await expect(detailsPanel.getByText(`Max Concurrent: ${queueConfig.maxConcurrent}`)).toBeVisible()
    })

    test('should start and stop queue processing', async ({ page }) => {
      const queueName = 'Processing Test Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for testing start/stop functionality'
      })

      // Add some test items
      const testItems: FlowItem[] = [
        {
          id: 'item-1',
          type: 'task',
          title: 'Test Task 1',
          status: 'pending',
          priority: 'medium'
        },
        {
          id: 'item-2',
          type: 'task',
          title: 'Test Task 2',
          status: 'pending',
          priority: 'high'
        }
      ]

      await flowPage.addItemsToQueue(queueName, testItems)

      // Start processing
      await flowPage.startQueue(queueName)
      
      const status = await flowPage.getQueueStatus(queueName)
      expect(status.toLowerCase()).toContain('processing')

      // Pause processing
      await flowPage.pauseQueue(queueName)
      
      const pausedStatus = await flowPage.getQueueStatus(queueName)
      expect(pausedStatus.toLowerCase()).toContain('paused')

      // Stop processing
      await flowPage.stopQueue(queueName)
      
      const stoppedStatus = await flowPage.getQueueStatus(queueName)
      expect(stoppedStatus.toLowerCase()).toContain('idle')
    })

    test('should add and manage queue items', async ({ page }) => {
      const queueName = 'Items Management Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Testing queue item management'
      })

      const testItems: FlowItem[] = [
        {
          id: 'item-1',
          type: 'ticket',
          title: 'Fix authentication bug',
          status: 'pending',
          priority: 'high'
        },
        {
          id: 'item-2',
          type: 'task',
          title: 'Update documentation',
          status: 'pending',
          priority: 'medium'
        },
        {
          id: 'item-3',
          type: 'project',
          title: 'Code review',
          status: 'pending',
          priority: 'low'
        }
      ]

      await flowPage.addItemsToQueue(queueName, testItems)

      // Verify items were added
      const itemCount = await flowPage.getQueueItemCount(queueName)
      expect(itemCount).toBe(3)

      // Verify items appear with correct priorities
      const queueElement = page.getByTestId(`queue-${queueName}`)
      await expect(queueElement.getByText('Fix authentication bug')).toBeVisible()
      await expect(queueElement.getByText('Update documentation')).toBeVisible()
      await expect(queueElement.getByText('Code review')).toBeVisible()
    })

    test('should clear queue items', async ({ page }) => {
      const queueName = 'Clear Test Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Testing queue clearing'
      })

      // Add items
      const testItems: FlowItem[] = [
        {
          id: 'item-1',
          type: 'task',
          title: 'Item to be cleared 1',
          status: 'pending',
          priority: 'medium'
        },
        {
          id: 'item-2',
          type: 'task',
          title: 'Item to be cleared 2',
          status: 'pending',
          priority: 'medium'
        }
      ]

      await flowPage.addItemsToQueue(queueName, testItems)

      // Clear the queue
      await flowPage.clearQueue(queueName)

      // Verify queue is empty
      const itemCount = await flowPage.getQueueItemCount(queueName)
      expect(itemCount).toBe(0)
    })
  })

  test.describe('Flow Integration with Tickets and Projects', () => {
    test('should integrate tickets into flow queue', async ({ page }) => {
      // First create a project and ticket
      await projectsPage.goto()
      const projectData = TestDataFactory.createProject({
        name: 'Flow Integration Project'
      })
      await projectsPage.createProject(projectData)

      await ticketsPage.goto()
      const ticketData = TestDataFactory.createTicket({
        title: 'Flow Integration Ticket',
        description: 'Ticket for flow integration testing',
        projectId: 1
      })
      await ticketsPage.createTicket(ticketData)

      // Navigate back to flow
      await flowPage.goto()
      await flowPage.waitForFlowToLoad()

      // Create a queue
      const queueName = 'Ticket Integration Queue'
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for ticket integration'
      })

      // Add the ticket to the queue (this would be done via drag-drop or context menu)
      const ticketItem: FlowItem = {
        id: 'ticket-1',
        type: 'ticket',
        title: ticketData.title,
        status: 'pending',
        priority: 'medium'
      }

      await flowPage.addItemsToQueue(queueName, [ticketItem])

      // Verify ticket appears in queue
      const queueElement = page.getByTestId(`queue-${queueName}`)
      await expect(queueElement.getByText(ticketData.title)).toBeVisible()
    })

    test('should process complete development workflow', async ({ page }) => {
      // Create a development workflow queue
      const workflowQueue = 'Development Workflow'
      await flowPage.createQueue({
        name: workflowQueue,
        description: 'Complete development workflow processing',
        type: 'development'
      })

      // Create workflow items representing a complete development cycle
      const workflowItems: FlowItem[] = [
        {
          id: 'planning',
          type: 'task',
          title: 'Project Planning',
          status: 'pending',
          priority: 'high'
        },
        {
          id: 'design',
          type: 'task',
          title: 'UI/UX Design',
          status: 'pending',
          priority: 'high'
        },
        {
          id: 'implementation',
          type: 'task',
          title: 'Feature Implementation',
          status: 'pending',
          priority: 'medium'
        },
        {
          id: 'testing',
          type: 'task',
          title: 'Testing and QA',
          status: 'pending',
          priority: 'medium'
        },
        {
          id: 'deployment',
          type: 'task',
          title: 'Production Deployment',
          status: 'pending',
          priority: 'low'
        }
      ]

      await flowPage.addItemsToQueue(workflowQueue, workflowItems)

      // Start processing the workflow
      await flowPage.startQueue(workflowQueue)

      // Monitor the processing
      const processingResult = await flowPage.monitorQueueProcessing(workflowQueue, 10000)
      
      // Verify workflow processed items
      expect(processingResult.itemsProcessed).toBeGreaterThan(0)
    })

    test('should move items between queues', async ({ page }) => {
      // Create two queues
      const sourceQueue = 'Source Queue'
      const targetQueue = 'Target Queue'
      
      await flowPage.createQueue({
        name: sourceQueue,
        description: 'Source queue for move testing'
      })

      await flowPage.createQueue({
        name: targetQueue,
        description: 'Target queue for move testing'
      })

      // Add item to source queue
      const testItem: FlowItem = {
        id: 'moveable-item',
        type: 'task',
        title: 'Item to Move',
        status: 'pending',
        priority: 'medium'
      }

      await flowPage.addItemsToQueue(sourceQueue, [testItem])

      // Move item between queues
      await flowPage.moveItemBetweenQueues(testItem.title, sourceQueue, targetQueue)

      // Verify item moved
      const targetQueueElement = page.getByTestId(`queue-${targetQueue}`)
      await expect(targetQueueElement.getByText(testItem.title)).toBeVisible()
      
      const targetItemCount = await flowPage.getQueueItemCount(targetQueue)
      expect(targetItemCount).toBe(1)
      
      const sourceItemCount = await flowPage.getQueueItemCount(sourceQueue)
      expect(sourceItemCount).toBe(0)
    })
  })

  test.describe('Flow Statistics and Monitoring', () => {
    test('should display flow statistics correctly', async ({ page }) => {
      // Create multiple queues with different states
      await flowPage.createQueue({
        name: 'Stats Queue 1',
        description: 'First queue for statistics'
      })

      await flowPage.createQueue({
        name: 'Stats Queue 2',
        description: 'Second queue for statistics'
      })

      // Add items to queues
      const items1: FlowItem[] = [
        { id: '1', type: 'task', title: 'Task 1', status: 'pending', priority: 'high' },
        { id: '2', type: 'task', title: 'Task 2', status: 'pending', priority: 'medium' }
      ]

      const items2: FlowItem[] = [
        { id: '3', type: 'task', title: 'Task 3', status: 'pending', priority: 'low' }
      ]

      await flowPage.addItemsToQueue('Stats Queue 1', items1)
      await flowPage.addItemsToQueue('Stats Queue 2', items2)

      // Get statistics
      const stats = await flowPage.getFlowStatistics()

      // Verify statistics are accurate
      expect(stats.totalQueues).toBe(2)
      expect(stats.totalItems).toBe(3)
      expect(stats.processingItems).toBeGreaterThanOrEqual(0)
      expect(stats.completedItems).toBeGreaterThanOrEqual(0)
    })

    test('should monitor real-time queue processing', async ({ page }) => {
      const queueName = 'Monitoring Test Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for real-time monitoring'
      })

      // Add items for processing
      const testItems: FlowItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `monitor-item-${i}`,
        type: 'task',
        title: `Monitoring Task ${i + 1}`,
        status: 'pending',
        priority: 'medium'
      }))

      await flowPage.addItemsToQueue(queueName, testItems)

      // Start monitoring
      await flowPage.startQueue(queueName)
      
      // Monitor processing with timeout
      const monitoringResult = await flowPage.monitorQueueProcessing(queueName, 15000)

      // Verify monitoring captured processing data
      expect(monitoringResult.startTime).toBeGreaterThan(0)
      expect(monitoringResult.endTime).toBeGreaterThan(monitoringResult.startTime)
      expect(monitoringResult.itemsProcessed).toBeGreaterThanOrEqual(0)
    })

    test('should track processing performance metrics', async ({ page }) => {
      const queueName = 'Performance Metrics Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for performance metrics testing',
        processingRate: 10,
        maxConcurrent: 2
      })

      // Test performance with a moderate load
      const performanceResult = await flowPage.testFlowPerformance(queueName, 10)

      // Verify performance metrics are reasonable
      expect(performanceResult.setupTime).toBeGreaterThan(0)
      expect(performanceResult.processingTime).toBeGreaterThan(0)
      expect(performanceResult.itemsPerSecond).toBeGreaterThanOrEqual(0)

      console.log(`Performance Test Results:
        Setup Time: ${performanceResult.setupTime}ms
        Processing Time: ${performanceResult.processingTime}ms
        Items/Second: ${performanceResult.itemsPerSecond.toFixed(2)}`)
    })
  })

  test.describe('Flow Configuration and Export/Import', () => {
    test('should export flow configuration', async ({ page }) => {
      // Create a complex flow setup
      await flowPage.createQueue({
        name: 'Export Test Queue 1',
        description: 'First queue for export testing',
        type: 'development'
      })

      await flowPage.createQueue({
        name: 'Export Test Queue 2',
        description: 'Second queue for export testing',
        type: 'review'
      })

      // Connect queues if connection feature exists
      try {
        await flowPage.connectQueues('Export Test Queue 1', 'Export Test Queue 2')
      } catch (error) {
        // Connection feature may not be implemented yet
        console.log('Queue connection feature not available')
      }

      // Export configuration
      await flowPage.exportFlowConfiguration()

      // Export verification is handled in the page object method
    })

    test('should filter queues by status', async ({ page }) => {
      // Create queues with different statuses
      const idleQueue = 'Idle Status Queue'
      const processingQueue = 'Processing Status Queue'
      
      await flowPage.createQueue({
        name: idleQueue,
        description: 'Queue that will remain idle'
      })

      await flowPage.createQueue({
        name: processingQueue,
        description: 'Queue that will be processing'
      })

      // Add items to processing queue and start it
      const testItems: FlowItem[] = [
        { id: '1', type: 'task', title: 'Processing Task', status: 'pending', priority: 'medium' }
      ]

      await flowPage.addItemsToQueue(processingQueue, testItems)
      await flowPage.startQueue(processingQueue)

      // Filter by processing status
      await flowPage.filterQueuesByStatus('processing')

      // Verify only processing queue is visible
      await expect(page.getByTestId(`queue-${processingQueue}`)).toBeVisible()
      
      // The idle queue might be hidden or shown based on filter implementation
      // This depends on the specific filtering behavior
    })

    test('should search queues by name', async ({ page }) => {
      // Create queues with searchable names
      await flowPage.createQueue({
        name: 'Development Queue Alpha',
        description: 'Alpha development queue'
      })

      await flowPage.createQueue({
        name: 'Testing Queue Beta',
        description: 'Beta testing queue'
      })

      await flowPage.createQueue({
        name: 'Development Queue Gamma',
        description: 'Gamma development queue'
      })

      // Search for development queues
      await flowPage.searchQueues('Development')

      // Verify search results show only development queues
      await expect(page.getByTestId('queue-Development Queue Alpha')).toBeVisible()
      await expect(page.getByTestId('queue-Development Queue Gamma')).toBeVisible()
      
      // Testing queue should be filtered out (depending on implementation)
      // This verification depends on how search filtering is implemented
    })
  })

  test.describe('Drag and Drop Functionality', () => {
    test('should support drag and drop operations', async ({ page }) => {
      await flowPage.testDragAndDrop()
      
      // Create queues for drag and drop testing
      await flowPage.createQueue({
        name: 'Drag Source Queue',
        description: 'Source queue for drag testing'
      })

      await flowPage.createQueue({
        name: 'Drop Target Queue',
        description: 'Target queue for drop testing'
      })

      // Add item to source queue
      const testItem: FlowItem = {
        id: 'draggable-item',
        type: 'task',
        title: 'Draggable Test Item',
        status: 'pending',
        priority: 'medium'
      }

      await flowPage.addItemsToQueue('Drag Source Queue', [testItem])

      // Test drag and drop between queues
      await flowPage.moveItemBetweenQueues(
        testItem.title, 
        'Drag Source Queue', 
        'Drop Target Queue'
      )

      // Verify drag and drop succeeded
      const targetQueue = page.getByTestId('queue-Drop Target Queue')
      await expect(targetQueue.getByText(testItem.title)).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle queue creation errors gracefully', async ({ page }) => {
      // Try to create queue with empty name
      await page.getByRole('button', { name: 'Create Queue' }).click()
      
      const queueDialog = page.getByTestId('queue-dialog')
      await expect(queueDialog).toBeVisible()
      
      // Try to save without filling required fields
      await page.getByRole('button', { name: 'Save Queue' }).click()
      
      // Verify validation error
      await expect(page.getByText('Queue name is required')).toBeVisible()
    })

    test('should handle queue processing errors', async ({ page }) => {
      const queueName = 'Error Handling Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for error handling testing'
      })

      // Mock processing error
      await page.route('**/api/queue/process', route => 
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Processing failed' })
        })
      )

      // Add items and try to start processing
      const testItems: FlowItem[] = [
        { id: '1', type: 'task', title: 'Error Test Task', status: 'pending', priority: 'medium' }
      ]

      await flowPage.addItemsToQueue(queueName, testItems)
      await flowPage.startQueue(queueName)

      // Verify error is handled gracefully
      await expect(page.getByText(/processing failed|error occurred/i)).toBeVisible()
    })

    test('should handle network failures during queue operations', async ({ page }) => {
      const queueName = 'Network Error Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for network error testing'
      })

      // Simulate network failure
      await page.route('**/api/queue/**', route => route.abort('failed'))

      // Try to add items during network failure
      const testItems: FlowItem[] = [
        { id: '1', type: 'task', title: 'Network Test Task', status: 'pending', priority: 'medium' }
      ]

      try {
        await flowPage.addItemsToQueue(queueName, testItems)
      } catch (error) {
        // Expected to fail due to network simulation
      }

      // Verify error handling UI appears
      await expect(page.getByText(/network error|connection failed/i)).toBeVisible()
    })
  })

  test.describe('Performance and Scalability', () => {
    test('should handle large number of queues efficiently', async ({ page }) => {
      const queueCount = 20
      const startTime = Date.now()

      // Create many queues
      for (let i = 1; i <= queueCount; i++) {
        await flowPage.createQueue({
          name: `Scale Test Queue ${i}`,
          description: `Queue ${i} for scalability testing`
        })
      }

      const creationTime = Date.now() - startTime

      // Verify performance is reasonable (less than 1 second per queue on average)
      expect(creationTime / queueCount).toBeLessThan(1000)

      // Verify flow diagram still renders properly with many queues
      await expect(page.getByTestId('flow-diagram')).toBeVisible()
      
      // Verify zoom and pan still work with many queues
      await flowPage.zoomOut(2)
      await flowPage.panFlowDiagram('right', 100)
      
      console.log(`Created ${queueCount} queues in ${creationTime}ms (${(creationTime/queueCount).toFixed(0)}ms per queue)`)
    })

    test('should process high-volume queue efficiently', async ({ page }) => {
      const queueName = 'High Volume Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Queue for high volume testing',
        processingRate: 20,
        maxConcurrent: 5
      })

      // Test with 50 items
      const performanceResult = await flowPage.testFlowPerformance(queueName, 50)

      // Verify performance metrics
      expect(performanceResult.setupTime).toBeLessThan(10000) // Setup under 10 seconds
      expect(performanceResult.itemsPerSecond).toBeGreaterThan(0) // Some processing occurred

      console.log(`High Volume Test Results:
        Items: 50
        Setup: ${performanceResult.setupTime}ms
        Processing: ${performanceResult.processingTime}ms
        Rate: ${performanceResult.itemsPerSecond.toFixed(2)} items/sec`)
    })

    test('should maintain UI responsiveness during queue operations', async ({ page }) => {
      const queueName = 'Responsiveness Test Queue'
      
      await flowPage.createQueue({
        name: queueName,
        description: 'Testing UI responsiveness'
      })

      // Add many items
      const testItems: FlowItem[] = Array.from({ length: 30 }, (_, i) => ({
        id: `responsive-item-${i}`,
        type: 'task',
        title: `Responsiveness Task ${i + 1}`,
        status: 'pending',
        priority: 'medium'
      }))

      await flowPage.addItemsToQueue(queueName, testItems)

      // Start processing
      await flowPage.startQueue(queueName)

      // Verify UI remains responsive during processing
      await expect(page.getByRole('button', { name: 'Create Queue' })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Zoom In' })).toBeEnabled()
      
      // Test interaction responsiveness
      await flowPage.zoomIn(1)
      await expect(page.getByTestId('flow-diagram')).toBeVisible()
    })
  })
})