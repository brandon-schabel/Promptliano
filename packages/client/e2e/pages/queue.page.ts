import { type Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class QueuePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Queue management elements
  get queueContainer() {
    return this.page.locator('[data-testid="queue-container"], .queue-container')
  }

  get queueBoard() {
    return this.page.locator('[data-testid="queue-board"], .queue-board, .kanban-board')
  }

  get queueColumns() {
    return this.page.locator('[data-testid="queue-column"], .queue-column, .kanban-column')
  }

  get queueItems() {
    return this.page.locator('[data-testid="queue-item"], .queue-item, .kanban-item')
  }

  // Queue actions
  get createQueueButton() {
    return this.page.locator('[data-testid="create-queue"], button:has-text("New Queue"), button:has-text("Create Queue")')
  }

  get queueSelector() {
    return this.page.locator('[data-testid="queue-selector"], select[name="queue"]')
  }

  get addItemButton() {
    return this.page.locator('[data-testid="add-queue-item"], button:has-text("Add Item")')
  }

  get processQueueButton() {
    return this.page.locator('[data-testid="process-queue"], button:has-text("Process Queue")')
  }

  get pauseQueueButton() {
    return this.page.locator('[data-testid="pause-queue"], button:has-text("Pause")')
  }

  get clearQueueButton() {
    return this.page.locator('[data-testid="clear-queue"], button:has-text("Clear Queue")')
  }

  // Queue dialog/form elements
  get queueDialog() {
    return this.page.locator('[role="dialog"], [data-testid="queue-dialog"]')
  }

  get queueNameInput() {
    return this.page.locator('input[name="name"], input[placeholder*="queue name" i]')
  }

  get queueDescriptionInput() {
    return this.page.locator('textarea[name="description"], input[name="description"]')
  }

  get maxParallelInput() {
    return this.page.locator('input[name="maxParallelItems"], input[type="number"]')
  }

  get submitQueueButton() {
    return this.page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
  }

  get cancelQueueButton() {
    return this.page.locator('button:has-text("Cancel")')
  }

  // Queue status elements
  get queueStats() {
    return this.page.locator('[data-testid="queue-stats"], .queue-stats')
  }

  get queueStatus() {
    return this.page.locator('[data-testid="queue-status"], .queue-status')
  }

  get processingCount() {
    return this.page.locator('[data-testid="processing-count"], .processing-count')
  }

  get completedCount() {
    return this.page.locator('[data-testid="completed-count"], .completed-count')
  }

  get pendingCount() {
    return this.page.locator('[data-testid="pending-count"], .pending-count')
  }

  /**
   * Navigate to queue page
   */
  async goto() {
    await super.goto('/queue')
  }

  /**
   * Create a new queue
   */
  async createQueue(queueData: {
    name: string
    description?: string
    maxParallelItems?: number
  }) {
    await this.createQueueButton.click()
    await expect(this.queueDialog).toBeVisible()

    // Fill queue details
    await this.queueNameInput.fill(queueData.name)
    
    if (queueData.description) {
      await this.queueDescriptionInput.fill(queueData.description)
    }

    if (queueData.maxParallelItems) {
      await this.maxParallelInput.fill(queueData.maxParallelItems.toString())
    }

    // Submit the form
    await this.submitQueueButton.click()
    
    // Wait for queue creation
    await this.waitForAPIResponse(/\/api\/queues/, 'POST')
    await this.waitForLoadingComplete()
    
    // Verify queue was created (should appear in selector)
    await expect(this.queueSelector.locator(`option:has-text("${queueData.name}")`)).toBeAttached()
  }

  /**
   * Select a queue to work with
   */
  async selectQueue(queueName: string) {
    await this.queueSelector.selectOption({ label: queueName })
    await this.waitForLoadingComplete()
  }

  /**
   * Add item to queue (usually a ticket or task)
   */
  async addItemToQueue(itemData: {
    type: 'ticket' | 'task'
    id: number
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  }) {
    await this.addItemButton.click()
    
    // This would show a dialog to select tickets/tasks
    const itemDialog = this.page.locator('[data-testid="add-item-dialog"], [role="dialog"]')
    await expect(itemDialog).toBeVisible()
    
    // Select item type
    const typeSelector = this.page.locator(`[data-testid="item-type-${itemData.type}"], input[value="${itemData.type}"]`)
    await typeSelector.click()
    
    // Select specific item
    const itemSelector = this.page.locator(`[data-testid="item-${itemData.id}"], [value="${itemData.id}"]`)
    await itemSelector.click()
    
    if (itemData.priority) {
      const prioritySelect = this.page.locator('select[name="priority"]')
      await prioritySelect.selectOption(itemData.priority)
    }
    
    await this.page.locator('button:has-text("Add to Queue")').click()
    
    // Wait for item to be added
    await this.waitForAPIResponse(/\/api\/queues\/.*\/items/, 'POST')
    await this.waitForLoadingComplete()
  }

  /**
   * Start processing the queue
   */
  async processQueue() {
    await this.processQueueButton.click()
    
    // Wait for processing to start
    await this.waitForAPIResponse(/\/api\/queues\/.*\/process/, 'POST')
    await this.waitForLoadingComplete()
    
    // Verify queue is processing
    await expect(this.queueStatus).toHaveText(/processing|running/i)
  }

  /**
   * Pause queue processing
   */
  async pauseQueue() {
    await this.pauseQueueButton.click()
    
    await this.waitForAPIResponse(/\/api\/queues\/.*\/pause/, 'POST')
    await this.waitForLoadingComplete()
    
    // Verify queue is paused
    await expect(this.queueStatus).toHaveText(/paused/i)
  }

  /**
   * Clear all items from queue
   */
  async clearQueue() {
    await this.clearQueueButton.click()
    
    // Handle confirmation dialog
    await this.handleConfirmationDialog('accept')
    
    await this.waitForAPIResponse(/\/api\/queues\/.*\/clear/, 'POST')
    await this.waitForLoadingComplete()
    
    // Verify queue is empty
    await expect(this.queueItems).toHaveCount(0)
  }

  /**
   * Drag and drop queue item between columns
   */
  async moveQueueItem(itemTitle: string, toColumn: 'pending' | 'processing' | 'completed' | 'failed') {
    const item = this.getQueueItem(itemTitle)
    const targetColumn = this.getQueueColumn(toColumn)
    
    await expect(item).toBeVisible()
    await expect(targetColumn).toBeVisible()
    
    // Perform drag and drop
    await item.dragTo(targetColumn)
    
    // Wait for the update
    await this.waitForAPIResponse(/\/api\/queues\/.*\/items/, 'PUT')
    await this.waitForLoadingComplete()
  }

  /**
   * Get queue item by title/content
   */
  getQueueItem(itemTitle: string) {
    return this.page.locator(`[data-testid="queue-item"]:has-text("${itemTitle}"), .queue-item:has-text("${itemTitle}")`)
  }

  /**
   * Get queue column by status
   */
  getQueueColumn(status: string) {
    return this.page.locator(`[data-testid="queue-column-${status}"], .queue-column[data-status="${status}"]`)
  }

  /**
   * Get items in a specific column
   */
  getItemsInColumn(status: 'pending' | 'processing' | 'completed' | 'failed') {
    const column = this.getQueueColumn(status)
    return column.locator('[data-testid="queue-item"], .queue-item')
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const pending = await this.getTextContent('[data-testid="pending-count"]')
    const processing = await this.getTextContent('[data-testid="processing-count"]')
    const completed = await this.getTextContent('[data-testid="completed-count"]')
    const failed = await this.getTextContent('[data-testid="failed-count"]').catch(() => '0')
    
    return {
      pending: parseInt(pending) || 0,
      processing: parseInt(processing) || 0,
      completed: parseInt(completed) || 0,
      failed: parseInt(failed) || 0
    }
  }

  /**
   * Wait for queue processing to complete
   */
  async waitForQueueProcessingComplete(timeoutMs = 30000) {
    // Wait for all items to move out of processing
    await expect(this.getItemsInColumn('processing')).toHaveCount(0, { timeout: timeoutMs })
    
    // Verify queue status is idle
    await expect(this.queueStatus).toHaveText(/idle|completed/i, { timeout: 5000 })
  }

  /**
   * Get current queue status
   */
  async getCurrentQueueStatus(): Promise<string> {
    const statusText = await this.getTextContent('[data-testid="queue-status"]')
    return statusText.toLowerCase()
  }

  /**
   * Check if queue is processing
   */
  async isQueueProcessing(): Promise<boolean> {
    const status = await this.getCurrentQueueStatus()
    return status.includes('processing') || status.includes('running')
  }

  /**
   * View queue item details
   */
  async viewQueueItemDetails(itemTitle: string) {
    const item = this.getQueueItem(itemTitle)
    await item.click()
    
    // Should open item detail dialog or navigate to detail view
    const detailView = this.page.locator('[data-testid="queue-item-detail"], [role="dialog"]')
    await expect(detailView).toBeVisible()
  }

  /**
   * Remove item from queue
   */
  async removeQueueItem(itemTitle: string) {
    const item = this.getQueueItem(itemTitle)
    await item.hover()
    
    const removeButton = item.locator('[data-testid="remove-item"], button[aria-label*="remove"]')
    await removeButton.click()
    
    // Handle confirmation
    await this.handleConfirmationDialog('accept')
    
    await this.waitForAPIResponse(/\/api\/queues\/.*\/items/, 'DELETE')
    await this.waitForLoadingComplete()
    
    // Verify item was removed
    await expect(this.getQueueItem(itemTitle)).not.toBeVisible()
  }

  /**
   * Get all queue names from selector
   */
  async getAvailableQueues(): Promise<string[]> {
    const options = await this.queueSelector.locator('option').allTextContents()
    return options.filter(option => option.trim() && option !== 'Select Queue')
  }

  /**
   * Check if queue has items
   */
  async hasQueueItems(): Promise<boolean> {
    return await this.queueItems.count() > 0
  }

  /**
   * Get total item count in queue
   */
  async getTotalItemCount(): Promise<number> {
    return await this.queueItems.count()
  }

  /**
   * Wait for queue board to load
   */
  async waitForQueueBoardLoaded() {
    await expect(this.queueBoard).toBeVisible({ timeout: 10000 })
    await expect(this.queueColumns.first()).toBeVisible({ timeout: 10000 })
  }

  /**
   * Get queue processing progress
   */
  async getProcessingProgress(): Promise<{ completed: number; total: number; percentage: number }> {
    const stats = await this.getQueueStats()
    const total = stats.pending + stats.processing + stats.completed + stats.failed
    const completed = stats.completed
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return { completed, total, percentage }
  }

  /**
   * Monitor queue processing until completion
   */
  async monitorQueueUntilComplete(checkIntervalMs = 2000, maxWaitMs = 60000) {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const isProcessing = await this.isQueueProcessing()
      const hasProcessingItems = await this.getItemsInColumn('processing').count() > 0
      
      if (!isProcessing && !hasProcessingItems) {
        return await this.getQueueStats()
      }
      
      await this.page.waitForTimeout(checkIntervalMs)
    }
    
    throw new Error(`Queue processing did not complete within ${maxWaitMs}ms`)
  }
}