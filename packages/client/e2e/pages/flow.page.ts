import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export interface FlowQueue {
  id: string
  name: string
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'error'
  itemCount: number
  processingRate?: number
}

export interface FlowItem {
  id: string
  type: 'ticket' | 'task' | 'project'
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export class FlowPage extends BasePage {
  private readonly flowDiagram: Locator
  private readonly createQueueButton: Locator
  private readonly queuesList: Locator
  private readonly flowControls: Locator
  private readonly zoomInButton: Locator
  private readonly zoomOutButton: Locator
  private readonly resetZoomButton: Locator
  private readonly panControls: Locator
  private readonly flowStats: Locator
  private readonly queueNameInput: Locator
  private readonly queueDescriptionInput: Locator
  private readonly queueTypeSelect: Locator
  private readonly processingRateSlider: Locator
  private readonly maxConcurrentSlider: Locator
  private readonly saveQueueButton: Locator
  private readonly startQueueButton: Locator
  private readonly pauseQueueButton: Locator
  private readonly stopQueueButton: Locator
  private readonly clearQueueButton: Locator
  private readonly addItemButton: Locator
  private readonly queueItemsList: Locator
  private readonly dragDropArea: Locator
  private readonly flowVisualization: Locator

  constructor(page: Page) {
    super(page)
    this.flowDiagram = page.getByTestId('flow-diagram')
    this.createQueueButton = page.getByRole('button', { name: 'Create Queue' })
    this.queuesList = page.getByTestId('queues-list')
    this.flowControls = page.getByTestId('flow-controls')
    this.zoomInButton = page.getByRole('button', { name: 'Zoom In' })
    this.zoomOutButton = page.getByRole('button', { name: 'Zoom Out' })
    this.resetZoomButton = page.getByRole('button', { name: 'Reset Zoom' })
    this.panControls = page.getByTestId('pan-controls')
    this.flowStats = page.getByTestId('flow-statistics')
    this.queueNameInput = page.getByLabel('Queue Name')
    this.queueDescriptionInput = page.getByLabel('Description')
    this.queueTypeSelect = page.getByLabel('Queue Type')
    this.processingRateSlider = page.getByLabel('Processing Rate')
    this.maxConcurrentSlider = page.getByLabel('Max Concurrent Items')
    this.saveQueueButton = page.getByRole('button', { name: 'Save Queue' })
    this.startQueueButton = page.getByRole('button', { name: 'Start Processing' })
    this.pauseQueueButton = page.getByRole('button', { name: 'Pause' })
    this.stopQueueButton = page.getByRole('button', { name: 'Stop' })
    this.clearQueueButton = page.getByRole('button', { name: 'Clear Queue' })
    this.addItemButton = page.getByRole('button', { name: 'Add Item' })
    this.queueItemsList = page.getByTestId('queue-items')
    this.dragDropArea = page.getByTestId('drag-drop-area')
    this.flowVisualization = page.getByTestId('flow-visualization')
  }

  /**
   * Navigate to the Flow tab
   */
  async goto() {
    await super.goto('/flow')
  }

  /**
   * Navigate to Flow tab from the main navigation
   */
  async navigateToFlow() {
    const flowTab = this.page.getByRole('tab', { name: 'Flow' })
    await flowTab.click()
    await this.waitForFlowToLoad()
  }

  /**
   * Wait for flow diagram to fully load
   */
  async waitForFlowToLoad(): Promise<void> {
    await expect(this.flowDiagram).toBeVisible()
    await expect(this.flowVisualization).toBeVisible()

    // Wait for any initial loading animations
    await this.page.waitForTimeout(1000)
  }

  /**
   * Create a new queue
   */
  async createQueue(queueConfig: {
    name: string
    description?: string
    type?: string
    processingRate?: number
    maxConcurrent?: number
  }): Promise<string> {
    await this.createQueueButton.click()

    // Wait for queue creation dialog
    const queueDialog = this.page.getByTestId('queue-dialog')
    await expect(queueDialog).toBeVisible()

    // Fill queue details
    await this.queueNameInput.fill(queueConfig.name)

    if (queueConfig.description) {
      await this.queueDescriptionInput.fill(queueConfig.description)
    }

    if (queueConfig.type) {
      await this.queueTypeSelect.selectOption(queueConfig.type)
    }

    if (queueConfig.processingRate) {
      await this.processingRateSlider.fill(queueConfig.processingRate.toString())
    }

    if (queueConfig.maxConcurrent) {
      await this.maxConcurrentSlider.fill(queueConfig.maxConcurrent.toString())
    }

    // Save the queue
    await this.saveQueueButton.click()
    await expect(queueDialog).toBeHidden()

    // Wait for queue to appear in the flow diagram
    const queueElement = this.flowDiagram.getByTestId(`queue-${queueConfig.name}`)
    await expect(queueElement).toBeVisible()

    // Return the queue ID for further operations
    return (await queueElement.getAttribute('data-queue-id')) || ''
  }

  /**
   * Add items to a queue
   */
  async addItemsToQueue(queueName: string, items: FlowItem[]): Promise<void> {
    const queueElement = this.getQueueElement(queueName)

    // Click on the queue to select it
    await queueElement.click()

    // Add each item
    for (const item of items) {
      await this.addItemButton.click()

      const itemDialog = this.page.getByTestId('item-dialog')
      await expect(itemDialog).toBeVisible()

      // Fill item details
      await this.page.getByLabel('Item Type').selectOption(item.type)
      await this.page.getByLabel('Title').fill(item.title)
      await this.page.getByLabel('Priority').selectOption(item.priority)

      // Save item
      await this.page.getByRole('button', { name: 'Add Item' }).click()
      await expect(itemDialog).toBeHidden()
    }

    // Verify items were added
    const itemCount = await this.getQueueItemCount(queueName)
    expect(itemCount).toBe(items.length)
  }

  /**
   * Start processing a queue
   */
  async startQueue(queueName: string): Promise<void> {
    const queueElement = this.getQueueElement(queueName)
    await queueElement.click()

    await this.startQueueButton.click()

    // Verify queue status changed to processing
    await expect(queueElement.getByTestId('queue-status')).toContainText('processing')
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queueElement = this.getQueueElement(queueName)
    await queueElement.click()

    await this.pauseQueueButton.click()

    // Verify queue status changed to paused
    await expect(queueElement.getByTestId('queue-status')).toContainText('paused')
  }

  /**
   * Stop a queue
   */
  async stopQueue(queueName: string): Promise<void> {
    const queueElement = this.getQueueElement(queueName)
    await queueElement.click()

    await this.stopQueueButton.click()

    // Confirm stop if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: 'Stop' })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }

    // Verify queue status changed to idle
    await expect(queueElement.getByTestId('queue-status')).toContainText('idle')
  }

  /**
   * Clear all items from a queue
   */
  async clearQueue(queueName: string): Promise<void> {
    const queueElement = this.getQueueElement(queueName)
    await queueElement.click()

    await this.clearQueueButton.click()

    // Confirm clear if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: 'Clear' })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }

    // Verify queue is empty
    const itemCount = await this.getQueueItemCount(queueName)
    expect(itemCount).toBe(0)
  }

  /**
   * Get queue element by name
   */
  private getQueueElement(queueName: string): Locator {
    return this.flowDiagram.getByTestId(`queue-${queueName}`)
  }

  /**
   * Get the number of items in a queue
   */
  async getQueueItemCount(queueName: string): Promise<number> {
    const queueElement = this.getQueueElement(queueName)
    const countElement = queueElement.getByTestId('item-count')
    const countText = await countElement.textContent()
    return parseInt(countText || '0', 10)
  }

  /**
   * Get queue status
   */
  async getQueueStatus(queueName: string): Promise<string> {
    const queueElement = this.getQueueElement(queueName)
    const statusElement = queueElement.getByTestId('queue-status')
    return (await statusElement.textContent()) || ''
  }

  /**
   * Move items between queues using drag and drop
   */
  async moveItemBetweenQueues(itemTitle: string, fromQueue: string, toQueue: string): Promise<void> {
    const sourceQueue = this.getQueueElement(fromQueue)
    const targetQueue = this.getQueueElement(toQueue)

    // Find the item in the source queue
    const item = sourceQueue.getByText(itemTitle)

    // Drag from source to target
    await item.dragTo(targetQueue)

    // Verify item moved
    await expect(targetQueue.getByText(itemTitle)).toBeVisible()
    await expect(sourceQueue.getByText(itemTitle)).toBeHidden()
  }

  /**
   * Zoom controls for the flow diagram
   */
  async zoomIn(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.zoomInButton.click()
      await this.page.waitForTimeout(200)
    }
  }

  async zoomOut(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.zoomOutButton.click()
      await this.page.waitForTimeout(200)
    }
  }

  async resetZoom(): Promise<void> {
    await this.resetZoomButton.click()
  }

  /**
   * Pan the flow diagram
   */
  async panFlowDiagram(direction: 'up' | 'down' | 'left' | 'right', distance: number = 100): Promise<void> {
    const bounds = await this.flowDiagram.boundingBox()
    if (!bounds) throw new Error('Flow diagram not visible')

    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2

    let startX = centerX
    let startY = centerY
    let endX = centerX
    let endY = centerY

    switch (direction) {
      case 'up':
        endY -= distance
        break
      case 'down':
        endY += distance
        break
      case 'left':
        endX -= distance
        break
      case 'right':
        endX += distance
        break
    }

    // Perform pan gesture
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(endX, endY)
    await this.page.mouse.up()
  }

  /**
   * Get flow statistics
   */
  async getFlowStatistics(): Promise<{
    totalQueues: number
    totalItems: number
    processingItems: number
    completedItems: number
    averageProcessingTime: number
  }> {
    await expect(this.flowStats).toBeVisible()

    const totalQueues = parseInt((await this.flowStats.getByTestId('total-queues').textContent()) || '0', 10)
    const totalItems = parseInt((await this.flowStats.getByTestId('total-items').textContent()) || '0', 10)
    const processingItems = parseInt((await this.flowStats.getByTestId('processing-items').textContent()) || '0', 10)
    const completedItems = parseInt((await this.flowStats.getByTestId('completed-items').textContent()) || '0', 10)
    const averageProcessingTime = parseFloat(
      (await this.flowStats.getByTestId('avg-processing-time').textContent()) || '0'
    )

    return {
      totalQueues,
      totalItems,
      processingItems,
      completedItems,
      averageProcessingTime
    }
  }

  /**
   * View queue details panel
   */
  async viewQueueDetails(queueName: string): Promise<void> {
    const queueElement = this.getQueueElement(queueName)
    await queueElement.dblclick()

    // Verify details panel opens
    const detailsPanel = this.page.getByTestId('queue-details-panel')
    await expect(detailsPanel).toBeVisible()
  }

  /**
   * Filter queues by status
   */
  async filterQueuesByStatus(status: string): Promise<void> {
    const filterButton = this.page.getByRole('button', { name: 'Filter' })
    await filterButton.click()

    const statusFilter = this.page.getByRole('checkbox', { name: status })
    await statusFilter.check()

    // Apply filter
    const applyButton = this.page.getByRole('button', { name: 'Apply Filter' })
    await applyButton.click()
  }

  /**
   * Search for specific queues
   */
  async searchQueues(searchTerm: string): Promise<void> {
    const searchInput = this.page.getByTestId('queue-search')
    await searchInput.fill(searchTerm)
    await searchInput.press('Enter')
  }

  /**
   * Export flow configuration
   */
  async exportFlowConfiguration(): Promise<void> {
    const exportButton = this.page.getByRole('button', { name: 'Export Flow' })

    const downloadPromise = this.page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/flow.*\.json$/)
  }

  /**
   * Import flow configuration
   */
  async importFlowConfiguration(filePath: string): Promise<void> {
    const importButton = this.page.getByRole('button', { name: 'Import Flow' })

    const fileChooserPromise = this.page.waitForEvent('filechooser')
    await importButton.click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(filePath)

    await expect(this.page.getByText('Flow configuration imported')).toBeVisible()
  }

  /**
   * Connect queues with flow connections
   */
  async connectQueues(sourceQueue: string, targetQueue: string): Promise<void> {
    const source = this.getQueueElement(sourceQueue)
    const target = this.getQueueElement(targetQueue)

    // Click connection mode button if available
    const connectionMode = this.page.getByRole('button', { name: 'Connection Mode' })
    if (await connectionMode.isVisible()) {
      await connectionMode.click()
    }

    // Click source queue
    await source.click()

    // Click target queue
    await target.click()

    // Verify connection was created
    const connection = this.flowDiagram.getByTestId(`connection-${sourceQueue}-${targetQueue}`)
    await expect(connection).toBeVisible()
  }

  /**
   * Monitor queue processing in real-time
   */
  async monitorQueueProcessing(
    queueName: string,
    timeout: number = 30000
  ): Promise<{
    startTime: number
    endTime: number
    itemsProcessed: number
  }> {
    const startTime = Date.now()
    const initialCount = await this.getQueueItemCount(queueName)

    // Wait for processing to complete or timeout
    let endTime = startTime
    let finalCount = initialCount

    while (endTime - startTime < timeout) {
      finalCount = await this.getQueueItemCount(queueName)
      if (finalCount === 0) {
        endTime = Date.now()
        break
      }

      await this.page.waitForTimeout(1000)
      endTime = Date.now()
    }

    return {
      startTime,
      endTime,
      itemsProcessed: initialCount - finalCount
    }
  }

  /**
   * Test flow performance under load
   */
  async testFlowPerformance(
    queueName: string,
    itemCount: number
  ): Promise<{
    setupTime: number
    processingTime: number
    itemsPerSecond: number
  }> {
    const setupStart = Date.now()

    // Create test items
    const testItems: FlowItem[] = []
    for (let i = 0; i < itemCount; i++) {
      testItems.push({
        id: `test-item-${i}`,
        type: 'task',
        title: `Performance Test Item ${i}`,
        status: 'pending',
        priority: 'medium'
      })
    }

    await this.addItemsToQueue(queueName, testItems)
    const setupTime = Date.now() - setupStart

    // Start processing and monitor
    await this.startQueue(queueName)
    const processingResult = await this.monitorQueueProcessing(queueName)

    const processingTime = processingResult.endTime - processingResult.startTime
    const itemsPerSecond = processingResult.itemsProcessed / (processingTime / 1000)

    return {
      setupTime,
      processingTime,
      itemsPerSecond
    }
  }

  /**
   * Verify responsive layout for flow diagram
   */
  async verifyResponsiveLayout(): Promise<void> {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 }, // Tablet
      { width: 768, height: 1024 }, // Mobile landscape
      { width: 375, height: 667 } // Mobile portrait
    ]

    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport)
      await this.page.waitForTimeout(500)

      // Verify flow diagram adapts to viewport
      await expect(this.flowDiagram).toBeVisible()

      // Verify controls remain accessible
      await expect(this.flowControls).toBeVisible()

      console.log(`✅ Flow layout responsive at ${viewport.width}x${viewport.height}`)
    }
  }

  /**
   * Test drag and drop functionality
   */
  async testDragAndDrop(): Promise<void> {
    // Test dragging items within the flow
    await expect(this.dragDropArea).toBeVisible()

    // Verify drag and drop areas are properly configured
    const dropZones = await this.page.getByTestId('drop-zone').all()
    expect(dropZones.length).toBeGreaterThan(0)
  }
}
