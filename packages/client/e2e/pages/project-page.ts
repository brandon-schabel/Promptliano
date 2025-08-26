/**
 * Enhanced ProjectPage class for comprehensive Project Page testing
 * Covers Project Context, Prompts, File Tree, Flow Features, and Task Queue Board
 */

import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class ProjectPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // ========================================
  // PROJECT CONTEXT TAB ELEMENTS
  // ========================================

  get contextTab() {
    return this.page.getByTestId('project-context-tab')
  }

  get userInputTextarea() {
    return this.page.getByTestId('user-input-textarea')
  }

  get copyAllButton() {
    return this.page.getByRole('button', { name: 'Copy All' })
  }

  get searchFilesButton() {
    return this.page.getByRole('button', { name: /search files/i })
  }

  get suggestPromptsButton() {
    return this.page.getByRole('button', { name: /suggest prompts/i })
  }

  get chatButton() {
    return this.page.getByRole('button', { name: /chat/i })
  }

  get summarySection() {
    return this.page.getByTestId('project-summary')
  }

  get fileSuggestionsDialog() {
    return this.page.getByTestId('file-suggestions-dialog')
  }

  get promptSuggestionsDialog() {
    return this.page.getByTestId('prompt-suggestions-dialog')
  }

  get suggestedFiles() {
    return this.page.getByTestId('suggested-file')
  }

  get suggestedPrompts() {
    return this.page.getByTestId('suggested-prompt')
  }

  // ========================================
  // PROMPT MANAGEMENT ELEMENTS
  // ========================================

  get promptsContainer() {
    return this.page.getByTestId('project-prompts')
  }

  get promptCards() {
    return this.page.getByTestId('prompt-card')
  }

  promptCardByTitle(title: string) {
    return this.page.getByTestId('prompt-card').filter({ hasText: title })
  }

  promptCardCopyIcon(title: string) {
    return this.promptCardByTitle(title).getByTestId('copy-icon')
  }

  promptCardMenu(title: string) {
    return this.promptCardByTitle(title).getByTestId('three-dot-menu')
  }

  get promptViewDialog() {
    return this.page.getByTestId('prompt-view-dialog')
  }

  get promptEditDialog() {
    return this.page.getByTestId('prompt-edit-dialog')
  }

  // Prompt menu items
  get promptMenuView() {
    return this.page.getByRole('menuitem', { name: 'View Prompt' })
  }

  get promptMenuEdit() {
    return this.page.getByRole('menuitem', { name: 'Edit Prompt' })
  }

  get promptMenuCopy() {
    return this.page.getByRole('menuitem', { name: 'Copy Content' })
  }

  get promptMenuExport() {
    return this.page.getByRole('menuitem', { name: 'Export as Markdown' })
  }

  get promptMenuDelete() {
    return this.page.getByRole('menuitem', { name: 'Delete Prompt' })
  }

  // ========================================
  // FILE TREE ELEMENTS
  // ========================================

  get fileTree() {
    return this.page.getByTestId('file-tree')
  }

  get selectedFiles() {
    return this.page.getByTestId('selected-files')
  }

  fileNode(fileName: string) {
    return this.page.getByTestId('file-node').filter({ hasText: fileName })
  }

  folderNode(folderName: string) {
    return this.page.getByTestId('folder-node').filter({ hasText: folderName })
  }

  get fileContextMenu() {
    return this.page.getByTestId('file-context-menu')
  }

  get folderContextMenu() {
    return this.page.getByTestId('folder-context-menu')
  }

  // File context menu items
  get fileMenuCopyRelativePath() {
    return this.page.getByRole('menuitem', { name: 'Copy Relative Path' })
  }

  get fileMenuCopyAbsolutePath() {
    return this.page.getByRole('menuitem', { name: 'Copy Absolute Path' })
  }

  get fileMenuOpenInEditor() {
    return this.page.getByRole('menuitem', { name: 'Open In Editor' })
  }

  get fileMenuCopyContents() {
    return this.page.getByRole('menuitem', { name: 'Copy File Contents' })
  }

  // Git-specific file menu items
  get fileMenuStage() {
    return this.page.getByRole('menuitem', { name: 'Stage File' })
  }

  get fileMenuUnstage() {
    return this.page.getByRole('menuitem', { name: 'Unstage File' })
  }

  get fileMenuCopyPreviousVersion() {
    return this.page.getByRole('menuitem', { name: 'Copy Previous Version' })
  }

  get fileMenuCopyDiff() {
    return this.page.getByRole('menuitem', { name: 'Copy Diff' })
  }

  // Folder context menu items
  get folderMenuCopyContents() {
    return this.page.getByRole('menuitem', { name: 'Copy Folder Contents' })
  }

  get folderMenuCopySummaries() {
    return this.page.getByRole('menuitem', { name: 'Copy Folder Summaries' })
  }

  get folderMenuCopyTree() {
    return this.page.getByRole('menuitem', { name: 'Copy Folder Tree' })
  }

  // ========================================
  // FLOW FEATURE ELEMENTS
  // ========================================

  get flowSection() {
    return this.page.getByTestId('flow-section')
  }

  get queueStats() {
    return this.page.getByTestId('queue-stats')
  }

  get activeQueuesCount() {
    return this.page.getByTestId('active-queues-count')
  }

  get totalQueuesCount() {
    return this.page.getByTestId('total-queues-count')
  }

  get inProgressCount() {
    return this.page.getByTestId('in-progress-count')
  }

  get pendingCount() {
    return this.page.getByTestId('pending-count')
  }

  get completedCount() {
    return this.page.getByTestId('completed-count')
  }

  queueCard(queueName: string) {
    return this.page.getByTestId('queue-card').filter({ hasText: queueName })
  }

  queueViewDetailsButton(queueName: string) {
    return this.queueCard(queueName).getByRole('button', { name: /view queue details/i })
  }

  get queueDetailsModal() {
    return this.page.getByTestId('queue-details-modal')
  }

  get queueModalAllTab() {
    return this.page.getByRole('tab', { name: 'All' })
  }

  get queueModalPendingTab() {
    return this.page.getByRole('tab', { name: 'Pending' })
  }

  get queueModalInProgressTab() {
    return this.page.getByRole('tab', { name: 'In Progress' })
  }

  get queueModalCompletedTab() {
    return this.page.getByRole('tab', { name: 'Completed' })
  }

  get queueItems() {
    return this.page.getByTestId('queue-item')
  }

  // ========================================
  // TASK QUEUE BOARD ELEMENTS
  // ========================================

  get taskQueueBoard() {
    return this.page.getByTestId('task-queue-board')
  }

  get unqueuedColumn() {
    return this.page.getByTestId('unqueued-column')
  }

  queueColumn(queueName: string) {
    return this.page.getByTestId('queue-column').filter({ hasText: queueName })
  }

  ticketCard(ticketTitle: string) {
    return this.page.getByTestId('ticket-card').filter({ hasText: ticketTitle })
  }

  taskCard(taskTitle: string) {
    return this.page.getByTestId('task-card').filter({ hasText: taskTitle })
  }

  get ticketTasks() {
    return this.page.getByTestId('ticket-tasks')
  }

  get ticketTitle() {
    return this.page.getByTestId('ticket-title')
  }

  get taskTicket() {
    return this.page.getByTestId('task-ticket')
  }

  // ========================================
  // NAVIGATION AND BASIC METHODS
  // ========================================

  /**
   * Navigate to project page by ID
   */
  async gotoProject(projectId: number | string) {
    await super.goto(`/projects/${projectId}`)
  }

  /**
   * Navigate to projects list page
   */
  async gotoProjectsList() {
    await super.goto('/projects')
  }

  /**
   * Wait for project page to fully load
   */
  async waitForProjectPageLoad() {
    await this.waitForPageLoad()

    // Wait for main project sections to load
    const sectionsToWait = [
      this.contextTab,
      this.fileTree,
      this.promptsContainer,
      this.flowSection,
      this.taskQueueBoard
    ]

    // Wait for at least one section to be visible
    await expect(this.contextTab.or(this.fileTree).or(this.promptsContainer)).toBeVisible({ timeout: 10000 })
  }

  // ========================================
  // PROJECT CONTEXT METHODS
  // ========================================

  /**
   * Fill user input textarea
   */
  async fillUserInput(text: string) {
    await this.userInputTextarea.fill(text)
    // Wait for any debounced operations
    await this.page.waitForTimeout(500)
  }

  /**
   * Click copy all button and verify clipboard
   */
  async copyAllContext() {
    await this.copyAllButton.click()
    await this.waitForToast('Copied to clipboard')
  }

  /**
   * Search for files based on user input
   */
  async searchFiles() {
    await this.searchFilesButton.click()
    await expect(this.fileSuggestionsDialog).toBeVisible()
  }

  /**
   * Get file suggestions and select one
   */
  async selectFileSuggestion(index: number = 0) {
    await this.searchFiles()
    const suggestions = this.suggestedFiles
    await expect(suggestions).toHaveCount.atLeast(1)
    await suggestions.nth(index).click()
  }

  /**
   * Suggest prompts based on context
   */
  async suggestPrompts() {
    await this.suggestPromptsButton.click()
    await expect(this.promptSuggestionsDialog).toBeVisible()
  }

  /**
   * Select a prompt suggestion
   */
  async selectPromptSuggestion(index: number = 0) {
    await this.suggestPrompts()
    const suggestions = this.suggestedPrompts
    await expect(suggestions).toHaveCount.atLeast(1)
    await suggestions.nth(index).click()
  }

  /**
   * Copy context to chat
   */
  async copyToChat() {
    await this.chatButton.click()
    // Should navigate to chat page
    await this.waitForURL(/.*\/chat/)
  }

  /**
   * Get project summary content
   */
  async getProjectSummary(): Promise<string> {
    await expect(this.summarySection).toBeVisible()
    return (await this.summarySection.textContent()) || ''
  }

  // ========================================
  // PROMPT MANAGEMENT METHODS
  // ========================================

  /**
   * Hover over a prompt card to reveal actions
   */
  async hoverPromptCard(title: string) {
    await this.promptCardByTitle(title).hover()
    // Wait for hover effects to appear
    await this.page.waitForTimeout(200)
  }

  /**
   * Copy prompt using copy icon
   */
  async copyPromptViaIcon(title: string) {
    await this.hoverPromptCard(title)
    await this.promptCardCopyIcon(title).click()
    await this.waitForToast('Prompt copied to clipboard')
  }

  /**
   * Open prompt three-dot menu
   */
  async openPromptMenu(title: string) {
    await this.hoverPromptCard(title)
    await this.promptCardMenu(title).click()
    await expect(this.promptMenuView).toBeVisible()
  }

  /**
   * View prompt details
   */
  async viewPrompt(title: string) {
    await this.openPromptMenu(title)
    await this.promptMenuView.click()
    await expect(this.promptViewDialog).toBeVisible()
  }

  /**
   * Edit prompt
   */
  async editPrompt(title: string) {
    await this.openPromptMenu(title)
    await this.promptMenuEdit.click()
    await expect(this.promptEditDialog).toBeVisible()
  }

  /**
   * Copy prompt content via menu
   */
  async copyPromptContent(title: string) {
    await this.openPromptMenu(title)
    await this.promptMenuCopy.click()
    await this.waitForToast('Prompt content copied')
  }

  /**
   * Export prompt as markdown
   */
  async exportPromptAsMarkdown(title: string) {
    const downloadPromise = this.page.waitForEvent('download')
    await this.openPromptMenu(title)
    await this.promptMenuExport.click()
    return await downloadPromise
  }

  /**
   * Delete prompt (with confirmation handling)
   */
  async deletePrompt(title: string, confirm: boolean = false) {
    await this.openPromptMenu(title)
    await this.promptMenuDelete.click()

    // Handle confirmation dialog
    if (confirm) {
      await this.handleConfirmationDialog('accept')
      await this.waitForToast('Prompt deleted')
    } else {
      await this.handleConfirmationDialog('dismiss')
    }
  }

  // ========================================
  // FILE TREE METHODS
  // ========================================

  /**
   * Select/unselect a file
   */
  async toggleFileSelection(fileName: string) {
    const fileCheckbox = this.fileNode(fileName).getByRole('checkbox')
    await fileCheckbox.click()
  }

  /**
   * Select/unselect all files in a folder
   */
  async toggleFolderSelection(folderName: string) {
    const folderCheckbox = this.folderNode(folderName).getByRole('checkbox')
    await folderCheckbox.click()
  }

  /**
   * Right-click on file to open context menu
   */
  async rightClickFile(fileName: string) {
    await this.fileNode(fileName).click({ button: 'right' })
    await expect(this.fileContextMenu).toBeVisible()
  }

  /**
   * Right-click on folder to open context menu
   */
  async rightClickFolder(folderName: string) {
    await this.folderNode(folderName).click({ button: 'right' })
    await expect(this.folderContextMenu).toBeVisible()
  }

  /**
   * Copy file relative path
   */
  async copyFileRelativePath(fileName: string) {
    await this.rightClickFile(fileName)
    await this.fileMenuCopyRelativePath.click()
    await this.waitForToast('Relative path copied')
  }

  /**
   * Copy file absolute path
   */
  async copyFileAbsolutePath(fileName: string) {
    await this.rightClickFile(fileName)
    await this.fileMenuCopyAbsolutePath.click()
    await this.waitForToast('Absolute path copied')
  }

  /**
   * Copy file contents
   */
  async copyFileContents(fileName: string) {
    await this.rightClickFile(fileName)
    await this.fileMenuCopyContents.click()
    await this.waitForToast('File contents copied')
  }

  /**
   * Stage a git file
   */
  async stageFile(fileName: string) {
    await this.rightClickFile(fileName)
    await this.fileMenuStage.click()
    await this.waitForToast('File staged successfully')
  }

  /**
   * Unstage a git file
   */
  async unstageFile(fileName: string) {
    await this.rightClickFile(fileName)
    await this.fileMenuUnstage.click()
    await this.waitForToast('File unstaged successfully')
  }

  /**
   * Copy folder contents
   */
  async copyFolderContents(folderName: string) {
    await this.rightClickFolder(folderName)
    await this.folderMenuCopyContents.click()
    await this.waitForToast('Folder contents copied')
  }

  /**
   * Check if file is selected
   */
  async isFileSelected(fileName: string): Promise<boolean> {
    const checkbox = this.fileNode(fileName).getByRole('checkbox')
    return await checkbox.isChecked()
  }

  /**
   * Get selected files list
   */
  async getSelectedFilesList(): Promise<string[]> {
    const selectedFileElements = this.selectedFiles.locator('[data-testid="selected-file"]')
    const count = await selectedFileElements.count()
    const files: string[] = []

    for (let i = 0; i < count; i++) {
      const fileName = await selectedFileElements.nth(i).textContent()
      if (fileName) files.push(fileName.trim())
    }

    return files
  }

  // ========================================
  // FLOW FEATURE METHODS
  // ========================================

  /**
   * Get queue statistics
   */
  async getQueueStatistics() {
    await expect(this.queueStats).toBeVisible()

    return {
      activeQueues: parseInt((await this.activeQueuesCount.textContent()) || '0'),
      totalQueues: parseInt((await this.totalQueuesCount.textContent()) || '0'),
      inProgress: parseInt((await this.inProgressCount.textContent()) || '0'),
      pending: parseInt((await this.pendingCount.textContent()) || '0'),
      completed: parseInt((await this.completedCount.textContent()) || '0')
    }
  }

  /**
   * Open queue details modal
   */
  async openQueueDetails(queueName: string) {
    await this.queueViewDetailsButton(queueName).click()
    await expect(this.queueDetailsModal).toBeVisible()
  }

  /**
   * Navigate queue modal tabs
   */
  async clickQueueModalTab(tab: 'all' | 'pending' | 'in_progress' | 'completed') {
    const tabElement = {
      all: this.queueModalAllTab,
      pending: this.queueModalPendingTab,
      in_progress: this.queueModalInProgressTab,
      completed: this.queueModalCompletedTab
    }[tab]

    await tabElement.click()
    await this.waitForLoadingComplete()
  }

  /**
   * Get queue items count in modal
   */
  async getQueueItemsCount(): Promise<number> {
    return await this.queueItems.count()
  }

  /**
   * Close queue details modal
   */
  async closeQueueDetailsModal() {
    await this.page.getByRole('button', { name: 'Close' }).click()
    await expect(this.queueDetailsModal).not.toBeVisible()
  }

  // ========================================
  // TASK QUEUE BOARD METHODS
  // ========================================

  /**
   * Drag ticket between columns
   */
  async dragTicketToQueue(ticketTitle: string, targetQueueName: string | 'unqueued') {
    const ticket = this.ticketCard(ticketTitle)
    await expect(ticket).toBeVisible()

    const targetColumn = targetQueueName === 'unqueued' ? this.unqueuedColumn : this.queueColumn(targetQueueName)

    await ticket.dragTo(targetColumn)

    // Wait for drag operation to complete
    await this.waitForLoadingComplete()

    // Verify success notification
    if (targetQueueName === 'unqueued') {
      await this.waitForToast('Ticket moved to Unqueued')
    } else {
      await this.waitForToast(`Ticket added to ${targetQueueName} queue`)
    }
  }

  /**
   * Get ticket count in a column
   */
  async getTicketCountInColumn(columnName: string | 'unqueued'): Promise<number> {
    const column = columnName === 'unqueued' ? this.unqueuedColumn : this.queueColumn(columnName)

    return await column.getByTestId('ticket-card').count()
  }

  /**
   * Get task count for a ticket
   */
  async getTaskCountForTicket(ticketTitle: string): Promise<number> {
    const ticket = this.ticketCard(ticketTitle)
    const tasksElement = ticket.getByTestId('ticket-tasks')
    const tasksText = await tasksElement.textContent()

    // Extract number from text like "5 tasks"
    const match = tasksText?.match(/(\d+)\s+task/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * Verify ticket is in correct column
   */
  async verifyTicketInColumn(ticketTitle: string, columnName: string | 'unqueued'): Promise<boolean> {
    const column = columnName === 'unqueued' ? this.unqueuedColumn : this.queueColumn(columnName)

    return await column.getByText(ticketTitle).isVisible()
  }

  /**
   * Get all column names
   */
  async getAllColumnNames(): Promise<string[]> {
    const columns = this.page.getByTestId('queue-column')
    const count = await columns.count()
    const names: string[] = ['Unqueued'] // Always include Unqueued

    for (let i = 0; i < count; i++) {
      const name = await columns.nth(i).getAttribute('data-queue-name')
      if (name) names.push(name)
    }

    return names
  }

  /**
   * Verify drag and drop functionality is working
   */
  async verifyDragDropEnabled(): Promise<boolean> {
    // Check if columns have proper drag-drop attributes
    const firstTicket = this.ticketCard('').first()
    const draggable = await firstTicket.getAttribute('draggable')
    return draggable === 'true'
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Take screenshot of specific section
   */
  async takeScreenshotOfSection(section: 'context' | 'prompts' | 'files' | 'flow' | 'board', name: string) {
    const sectionElement = {
      context: this.contextTab,
      prompts: this.promptsContainer,
      files: this.fileTree,
      flow: this.flowSection,
      board: this.taskQueueBoard
    }[section]

    await sectionElement.screenshot({
      path: `e2e/screenshots/project-${section}-${name}-${Date.now()}.png`
    })
  }

  /**
   * Get clipboard content (if accessible)
   */
  async getClipboardContent(): Promise<string | null> {
    try {
      return await this.page.evaluate(() => navigator.clipboard.readText())
    } catch (error) {
      console.warn('Clipboard not accessible in test environment')
      return null
    }
  }

  /**
   * Wait for specific network requests to complete
   */
  async waitForProjectAPIRequests() {
    await Promise.all(
      [
        this.waitForAPIResponse(/\/api\/projects\/\d+/),
        this.waitForAPIResponse(/\/api\/prompts/),
        this.waitForAPIResponse(/\/api\/files/),
        this.waitForAPIResponse(/\/api\/queues/)
      ].map((p) => p.catch(() => {}))
    ) // Ignore failures for optional requests
  }

  /**
   * Verify all main sections are loaded
   */
  async verifyAllSectionsLoaded() {
    await expect(this.contextTab).toBeVisible()
    await expect(this.fileTree).toBeVisible()
    await expect(this.promptsContainer).toBeVisible()
    await expect(this.flowSection).toBeVisible()
    await expect(this.taskQueueBoard).toBeVisible()
  }
}
