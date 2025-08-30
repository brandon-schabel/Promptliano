/**
 * Page Object Model for Prompt Management Page
 *
 * This class provides comprehensive interaction methods for testing
 * the prompt management functionality including import, CRUD operations,
 * search/sort, bulk actions, and modal interactions.
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export interface CreatePromptData {
  title: string
  content: string
  tags?: string[]
  category?: string
}

export class PromptManagementPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // ============================================================================
  // Main Page Elements
  // ============================================================================

  get pageHeader() {
    return this.page.getByTestId('prompt-management-header')
  }

  get pageTitle() {
    return this.page.getByRole('heading', { name: /prompt.*management|manage.*prompts/i })
  }

  // ============================================================================
  // Import Functionality Elements
  // ============================================================================

  get importButton() {
    return this.page.getByTestId('import-prompts-button')
  }

  get importDialog() {
    return this.page.getByTestId('import-prompts-dialog')
  }

  get chooseFilesButton() {
    return this.page.getByTestId('choose-files-button')
  }

  get fileInput() {
    return this.page.locator('input[type="file"]')
  }

  get selectedFilesDisplay() {
    return this.page.getByTestId('selected-files-display')
  }

  get executeImportButton() {
    return this.page.getByRole('button', { name: /import|import selected/i })
  }

  get importProgressIndicator() {
    return this.page.getByTestId('import-progress')
  }

  get importSuccessMessage() {
    return this.page.getByText(/import.*completed.*successfully|import.*successful/i)
  }

  get importErrorMessage() {
    return this.page.getByTestId('import-error-message')
  }

  // ============================================================================
  // Prompts Grid and Cards
  // ============================================================================

  get promptsGrid() {
    return this.page.getByTestId('prompts-grid')
  }

  get promptCards() {
    return this.page.getByTestId('prompt-card')
  }

  get emptyState() {
    return this.page.getByTestId('no-prompts-state')
  }

  get loadingState() {
    return this.page.getByTestId('prompts-loading')
  }

  promptCardByTitle(title: string) {
    return this.page.getByTestId('prompt-card').filter({ hasText: title })
  }

  // ============================================================================
  // Prompt Card Elements
  // ============================================================================

  getPromptCardTitle(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-title')
  }

  getPromptCardCreatedAt(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-created-at')
  }

  getPromptCardPreview(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-content-preview')
  }

  getPromptCardCheckbox(title: string) {
    return this.promptCardByTitle(title).getByRole('checkbox')
  }

  getPromptCardMenu(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-card-menu')
  }

  getPromptCardTokenCount(title: string) {
    return this.promptCardByTitle(title).getByTestId('token-count')
  }

  getPromptCardTags(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-tags')
  }

  getPromptCardCategory(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-category')
  }

  // ============================================================================
  // Prompt Card Menu Actions
  // ============================================================================

  get promptCardMenuItems() {
    return {
      copyContent: this.page.getByRole('menuitem', { name: /copy.*content/i }),
      edit: this.page.getByRole('menuitem', { name: /edit/i }),
      duplicate: this.page.getByRole('menuitem', { name: /duplicate|copy/i }),
      exportMarkdown: this.page.getByRole('menuitem', { name: /export.*markdown/i }),
      delete: this.page.getByRole('menuitem', { name: /delete/i })
    }
  }

  // ============================================================================
  // Toolbar and Actions
  // ============================================================================

  get toolbar() {
    return this.page.getByTestId('prompts-toolbar')
  }

  get sortButton() {
    return this.page.getByTestId('sort-prompts-button')
  }

  get sortMenu() {
    return this.page.getByTestId('sort-menu')
  }

  get searchInput() {
    return this.page.getByTestId('prompt-search-input')
  }

  get searchClearButton() {
    return this.page.getByTestId('search-clear-button')
  }

  get createPromptButton() {
    return this.page.getByTestId('create-prompt-button')
  }

  get refreshButton() {
    return this.page.getByTestId('refresh-prompts-button')
  }

  get viewModeToggle() {
    return this.page.getByTestId('view-mode-toggle')
  }

  // ============================================================================
  // Selection and Bulk Actions
  // ============================================================================

  get selectAllCheckbox() {
    return this.page.getByTestId('select-all-prompts')
  }

  get selectedPromptsCount() {
    return this.page.getByTestId('selected-prompts-count')
  }

  get bulkActionsMenu() {
    return this.page.getByTestId('bulk-actions-menu')
  }

  get bulkActionsButton() {
    return this.page.getByTestId('bulk-actions-button')
  }

  get bulkExportButton() {
    return this.page.getByRole('menuitem', { name: /export.*selected|bulk.*export/i })
  }

  get bulkDeleteButton() {
    return this.page.getByRole('menuitem', { name: /delete.*selected|bulk.*delete/i })
  }

  get bulkCategoryUpdateButton() {
    return this.page.getByRole('menuitem', { name: /update.*category/i })
  }

  // ============================================================================
  // Create/Edit Prompt Modal
  // ============================================================================

  get promptModal() {
    return this.page.getByTestId('prompt-modal')
  }

  get promptModalTitle() {
    return this.promptModal.getByRole('heading')
  }

  get promptNameInput() {
    return this.page.getByTestId('prompt-name-input')
  }

  get promptContentTextarea() {
    return this.page.getByTestId('prompt-content-textarea')
  }

  get promptContentEditor() {
    return this.page.getByTestId('prompt-content-editor')
  }

  get promptTokenCounter() {
    return this.page.getByTestId('prompt-token-counter')
  }

  get promptPreview() {
    return this.page.getByTestId('prompt-preview')
  }

  get promptPreviewTab() {
    return this.page.getByRole('tab', { name: /preview/i })
  }

  get promptEditTab() {
    return this.page.getByRole('tab', { name: /edit/i })
  }

  get promptTagsInput() {
    return this.page.getByTestId('prompt-tags-input')
  }

  get promptCategorySelect() {
    return this.page.getByTestId('prompt-category-select')
  }

  get promptDescriptionInput() {
    return this.page.getByTestId('prompt-description-input')
  }

  get savePromptButton() {
    return this.page.getByRole('button', { name: /save|create/i }).filter({ hasNotText: /cancel/i })
  }

  get cancelPromptButton() {
    return this.page.getByRole('button', { name: /cancel/i })
  }

  get promptValidationErrors() {
    return this.page.getByTestId('prompt-validation-errors')
  }

  // ============================================================================
  // Filters and Search
  // ============================================================================

  get categoryFilter() {
    return this.page.getByTestId('category-filter')
  }

  get tagFilter() {
    return this.page.getByTestId('tag-filter')
  }

  get dateRangeFilter() {
    return this.page.getByTestId('date-range-filter')
  }

  get tokenCountFilter() {
    return this.page.getByTestId('token-count-filter')
  }

  get clearFiltersButton() {
    return this.page.getByTestId('clear-filters-button')
  }

  get activeFiltersDisplay() {
    return this.page.getByTestId('active-filters')
  }

  // ============================================================================
  // Confirmation and Error Dialogs
  // ============================================================================

  get confirmationDialog() {
    return this.page.getByTestId('confirmation-dialog')
  }

  get bulkDeleteConfirmation() {
    return this.page.getByTestId('bulk-delete-confirmation')
  }

  get errorDialog() {
    return this.page.getByTestId('error-dialog')
  }

  get successToast() {
    return this.page.getByTestId('success-toast')
  }

  get errorToast() {
    return this.page.getByTestId('error-toast')
  }

  // ============================================================================
  // Navigation and Helper Methods
  // ============================================================================

  /**
   * Navigate to prompts management page
   */
  async goto(path: string = '/prompts') {
    await super.goto(path)
    await this.waitForPageLoad()
  }

  /**
   * Wait for prompts to load
   */
  async waitForPromptsLoaded() {
    await expect(this.promptCards.first().or(this.emptyState)).toBeVisible({ timeout: 10000 })
    await expect(this.loadingState).not.toBeVisible()
  }

  // ============================================================================
  // Import Functionality Methods
  // ============================================================================

  /**
   * Open import dialog
   */
  async openImportDialog() {
    await this.importButton.click()
    await expect(this.importDialog).toBeVisible()
  }

  /**
   * Select files for import
   */
  async selectPromptFiles(filePaths: string | string[]) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths]

    await this.chooseFilesButton.click()
    await this.fileInput.setInputFiles(paths)

    // Wait for files to be processed
    await expect(this.selectedFilesDisplay).toBeVisible()
  }

  /**
   * Execute import process
   */
  async executeImport() {
    await this.executeImportButton.click()

    // Wait for import to complete
    await expect(this.importDialog.or(this.importSuccessMessage)).toBeVisible({ timeout: 30000 })
  }

  /**
   * Complete import workflow
   */
  async importPromptFiles(filePaths: string | string[]) {
    await this.openImportDialog()
    await this.selectPromptFiles(filePaths)
    await this.executeImport()

    // Wait for import completion
    try {
      await expect(this.importSuccessMessage).toBeVisible({ timeout: 30000 })
      await expect(this.importDialog).not.toBeVisible()
    } catch {
      // Check for error messages
      const errorVisible = await this.importErrorMessage.isVisible()
      if (errorVisible) {
        throw new Error(`Import failed: ${await this.importErrorMessage.textContent()}`)
      }
    }
  }

  // ============================================================================
  // Prompt Card Interaction Methods
  // ============================================================================

  /**
   * Open prompt card menu
   */
  async openPromptCardMenu(title: string) {
    const card = this.promptCardByTitle(title)
    await expect(card).toBeVisible()

    // Hover to reveal menu button
    await card.hover()
    await this.getPromptCardMenu(title).click()

    // Wait for menu to appear
    await expect(this.promptCardMenuItems.edit).toBeVisible()
  }

  /**
   * Copy prompt content to clipboard
   */
  async copyPromptContent(title: string) {
    await this.openPromptCardMenu(title)
    await this.promptCardMenuItems.copyContent.click()

    // Wait for success message
    await expect(this.successToast.or(this.page.getByText('copied to clipboard'))).toBeVisible()
  }

  /**
   * Export prompt as markdown
   */
  async exportPrompt(title: string) {
    await this.openPromptCardMenu(title)

    // Setup download handler
    const downloadPromise = this.page.waitForEvent('download', { timeout: 10000 })
    await this.promptCardMenuItems.exportMarkdown.click()

    return await downloadPromise
  }

  /**
   * Delete prompt with confirmation
   */
  async deletePrompt(title: string) {
    await this.openPromptCardMenu(title)
    await this.promptCardMenuItems.delete.click()

    // Handle confirmation dialog
    await expect(this.confirmationDialog).toBeVisible()
    await this.page.getByRole('button', { name: /delete|confirm/i }).click()

    // Wait for deletion to complete
    await expect(this.promptCardByTitle(title)).not.toBeVisible({ timeout: 10000 })
  }

  // ============================================================================
  // Create/Edit Prompt Methods
  // ============================================================================

  /**
   * Create new prompt
   */
  async createNewPrompt(promptData: CreatePromptData) {
    await this.createPromptButton.click()
    await expect(this.promptModal).toBeVisible()

    // Fill form fields
    await this.promptNameInput.fill(promptData.title)
    await this.fillPromptContent(promptData.content)

    if (promptData.tags && promptData.tags.length > 0) {
      await this.addPromptTags(promptData.tags)
    }

    if (promptData.category) {
      await this.promptCategorySelect.selectOption(promptData.category)
    }

    // Save prompt
    await this.savePromptButton.click()
    await expect(this.promptModal).not.toBeVisible({ timeout: 10000 })

    // Verify prompt was created
    await expect(this.promptCardByTitle(promptData.title)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Edit existing prompt
   */
  async editPrompt(currentTitle: string, updates: Partial<CreatePromptData>) {
    await this.openPromptCardMenu(currentTitle)
    await this.promptCardMenuItems.edit.click()

    await expect(this.promptModal).toBeVisible()
    await expect(this.promptModalTitle).toContainText(/edit/i)

    if (updates.title) {
      await this.promptNameInput.clear()
      await this.promptNameInput.fill(updates.title)
    }

    if (updates.content) {
      await this.fillPromptContent(updates.content)
    }

    if (updates.tags) {
      await this.clearPromptTags()
      await this.addPromptTags(updates.tags)
    }

    if (updates.category) {
      await this.promptCategorySelect.selectOption(updates.category)
    }

    await this.savePromptButton.click()
    await expect(this.promptModal).not.toBeVisible({ timeout: 10000 })
  }

  /**
   * Fill prompt content (handles both textarea and editor)
   */
  private async fillPromptContent(content: string) {
    const editorVisible = await this.promptContentEditor.isVisible().catch(() => false)

    if (editorVisible) {
      // Monaco editor or similar
      await this.promptContentEditor.click()
      await this.page.keyboard.press('Control+A')
      await this.page.keyboard.type(content)
    } else {
      // Simple textarea
      await this.promptContentTextarea.clear()
      await this.promptContentTextarea.fill(content)
    }
  }

  /**
   * Add tags to prompt
   */
  private async addPromptTags(tags: string[]) {
    for (const tag of tags) {
      await this.promptTagsInput.fill(tag)
      await this.promptTagsInput.press('Enter')

      // Wait for tag to be added
      await expect(this.page.getByTestId('tag-chip').filter({ hasText: tag })).toBeVisible()
    }
  }

  /**
   * Clear all tags
   */
  private async clearPromptTags() {
    const tagChips = this.page.getByTestId('tag-chip')
    const count = await tagChips.count()

    for (let i = count - 1; i >= 0; i--) {
      const removeButton = tagChips.nth(i).getByRole('button', { name: /remove|×/ })
      if (await removeButton.isVisible()) {
        await removeButton.click()
      }
    }
  }

  // ============================================================================
  // Search and Sort Methods
  // ============================================================================

  /**
   * Search prompts
   */
  async searchPrompts(query: string) {
    await this.searchInput.fill(query)
    // Wait for search results to update (debounced)
    await this.page.waitForTimeout(600)
    await this.waitForPromptsLoaded()
  }

  /**
   * Clear search
   */
  async clearSearch() {
    if (await this.searchClearButton.isVisible()) {
      await this.searchClearButton.click()
    } else {
      await this.searchInput.clear()
    }
    await this.waitForPromptsLoaded()
  }

  /**
   * Sort prompts
   */
  async sortPrompts(field: string, direction: 'asc' | 'desc' = 'asc') {
    await this.sortButton.click()
    await expect(this.sortMenu).toBeVisible()

    // Select sort field
    const sortOption = this.page.getByRole('menuitem', { name: new RegExp(field, 'i') })
    await sortOption.click()

    // If descending order is needed and not the default, click again or select desc option
    if (direction === 'desc') {
      const descOption = this.page.getByRole('menuitem', { name: new RegExp(`${field}.*desc|desc.*${field}`, 'i') })
      if (await descOption.isVisible()) {
        await descOption.click()
      }
    }

    await this.waitForPromptsLoaded()
  }

  // ============================================================================
  // Selection and Bulk Operations
  // ============================================================================

  /**
   * Select prompt card
   */
  async selectPromptCard(title: string) {
    const checkbox = this.getPromptCardCheckbox(title)
    await checkbox.check()
    await expect(checkbox).toBeChecked()
  }

  /**
   * Select all prompts
   */
  async selectAllPrompts() {
    await this.selectAllCheckbox.check()

    // Verify selection count is updated
    await expect(this.selectedPromptsCount).toBeVisible()
  }

  /**
   * Clear all selections
   */
  async clearSelection() {
    if (await this.selectAllCheckbox.isChecked()) {
      await this.selectAllCheckbox.uncheck()
    }

    await expect(this.selectedPromptsCount).not.toBeVisible()
  }

  /**
   * Perform bulk export
   */
  async bulkExportSelected() {
    await this.bulkActionsButton.click()

    const downloadPromise = this.page.waitForEvent('download', { timeout: 10000 })
    await this.bulkExportButton.click()

    return await downloadPromise
  }

  /**
   * Perform bulk delete
   */
  async bulkDeleteSelected() {
    const selectedCount = await this.getSelectedCount()

    await this.bulkActionsButton.click()
    await this.bulkDeleteButton.click()

    // Handle confirmation
    await expect(this.bulkDeleteConfirmation).toBeVisible()
    await expect(this.bulkDeleteConfirmation).toContainText(selectedCount.toString())

    await this.page.getByRole('button', { name: /delete|confirm/i }).click()

    // Wait for deletion to complete
    await expect(this.selectedPromptsCount).not.toBeVisible()
  }

  // ============================================================================
  // Data Retrieval Methods
  // ============================================================================

  /**
   * Get all visible prompt titles
   */
  async getVisiblePromptTitles(): Promise<string[]> {
    await this.waitForPromptsLoaded()

    const cards = this.promptCards
    const count = await cards.count()
    const titles: string[] = []

    for (let i = 0; i < count; i++) {
      const titleElement = cards.nth(i).getByTestId('prompt-title')
      const title = await titleElement.textContent()
      if (title) titles.push(title.trim())
    }

    return titles
  }

  /**
   * Get prompt count
   */
  async getPromptCount(): Promise<number> {
    if (await this.emptyState.isVisible()) {
      return 0
    }
    return await this.promptCards.count()
  }

  /**
   * Get selected prompt count
   */
  async getSelectedCount(): Promise<number> {
    const countText = await this.selectedPromptsCount.textContent()
    if (!countText) return 0

    const match = countText.match(/(\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * Check if prompt exists
   */
  async promptExists(title: string): Promise<boolean> {
    return await this.promptCardByTitle(title).isVisible()
  }

  /**
   * Get prompt information
   */
  async getPromptInfo(title: string) {
    const card = this.promptCardByTitle(title)
    await expect(card).toBeVisible()

    const titleText = await this.getPromptCardTitle(title).textContent()
    const preview = await this.getPromptCardPreview(title).textContent()
    const tokenCount = await this.getPromptCardTokenCount(title).textContent()
    const createdAt = await this.getPromptCardCreatedAt(title).textContent()

    // Get tags
    const tagsElements = this.getPromptCardTags(title).locator('.tag, [data-testid="tag-chip"]')
    const tagsCount = await tagsElements.count()
    const tags: string[] = []

    for (let i = 0; i < tagsCount; i++) {
      const tagText = await tagsElements.nth(i).textContent()
      if (tagText) tags.push(tagText.trim())
    }

    return {
      title: titleText?.trim() || '',
      preview: preview?.trim() || '',
      tokenCount: tokenCount?.trim() || '',
      createdAt: createdAt?.trim() || '',
      tags
    }
  }

  /**
   * Wait for token count update
   */
  async waitForTokenCountUpdate(expectedMin: number = 1) {
    await this.page.waitForFunction(
      (min) => {
        const counter = document.querySelector('[data-testid="prompt-token-counter"]')
        if (!counter) return false

        const text = counter.textContent || ''
        const tokens = parseInt(text.match(/(\d+)/)?.[1] || '0')
        return tokens >= min
      },
      expectedMin,
      { timeout: 5000 }
    )
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Take screenshot of prompts grid
   */
  async screenshotPromptsGrid(filename?: string) {
    return await this.promptsGrid.screenshot({
      path: filename,
      type: 'png'
    })
  }

  /**
   * Wait for import/export operation to complete
   */
  async waitForFileOperation(timeout: number = 30000) {
    await this.page.waitForFunction(
      () => {
        // Look for loading indicators to disappear
        const importProgress = document.querySelector('[data-testid="import-progress"]')
        const exportProgress = document.querySelector('[data-testid="export-progress"]')

        return !importProgress && !exportProgress
      },
      { timeout }
    )
  }
}
