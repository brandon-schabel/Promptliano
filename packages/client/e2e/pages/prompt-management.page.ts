/**
 * PromptManagementPage - Dedicated page object for Prompt Management functionality
 * Covers prompt CRUD operations, hover interactions, three-dot menus, and all prompt actions
 */

import { type Page, type Locator, expect, type Download } from '@playwright/test'
import { BasePage } from './base.page'

export interface PromptCardInfo {
  title: string
  description?: string
  content?: string
  tags?: string[]
  tokenCount?: number
  lastModified?: string
}

export class PromptManagementPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // ========================================
  // PROMPT CONTAINER ELEMENTS
  // ========================================

  get promptsContainer() {
    return this.page.getByTestId('project-prompts-container')
  }

  get promptsGrid() {
    return this.page.getByTestId('prompts-grid')
  }

  get promptCards() {
    return this.promptsGrid.getByTestId('prompt-card')
  }

  get emptyPromptsState() {
    return this.page.getByTestId('empty-prompts-state')
  }

  get promptsLoadingState() {
    return this.page.getByTestId('prompts-loading')
  }

  get createPromptButton() {
    return this.page.getByTestId('create-prompt-button')
  }

  // ========================================
  // INDIVIDUAL PROMPT CARD ELEMENTS
  // ========================================

  /**
   * Get prompt card by title
   */
  promptCard(title: string): Locator {
    return this.promptCards.filter({ hasText: title }).first()
  }

  /**
   * Get prompt card by index
   */
  promptCardByIndex(index: number): Locator {
    return this.promptCards.nth(index)
  }

  /**
   * Get prompt title element within a card
   */
  promptTitle(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-title')
  }

  /**
   * Get prompt description within a card
   */
  promptDescription(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-description')
  }

  /**
   * Get prompt preview content within a card
   */
  promptPreview(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-preview')
  }

  /**
   * Get prompt tags within a card
   */
  promptTags(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-tags')
  }

  /**
   * Get prompt token count within a card
   */
  promptTokenCount(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-token-count')
  }

  /**
   * Get prompt last modified date within a card
   */
  promptLastModified(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-last-modified')
  }

  // ========================================
  // HOVER INTERACTION ELEMENTS
  // ========================================

  /**
   * Get copy icon that appears on hover
   */
  promptCopyIcon(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-copy-icon')
  }

  /**
   * Get three-dot menu that appears on hover
   */
  promptThreeDotMenu(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-three-dot-menu')
  }

  /**
   * Get hover overlay that contains actions
   */
  promptHoverOverlay(cardLocator: Locator): Locator {
    return cardLocator.getByTestId('prompt-hover-overlay')
  }

  // ========================================
  // THREE-DOT MENU ELEMENTS
  // ========================================

  get promptContextMenu() {
    return this.page.getByTestId('prompt-context-menu')
  }

  get menuViewPrompt() {
    return this.promptContextMenu.getByRole('menuitem', { name: /view prompt/i })
  }

  get menuEditPrompt() {
    return this.promptContextMenu.getByRole('menuitem', { name: /edit prompt/i })
  }

  get menuCopyContent() {
    return this.promptContextMenu.getByRole('menuitem', { name: /copy content/i })
  }

  get menuExportMarkdown() {
    return this.promptContextMenu.getByRole('menuitem', { name: /export.*markdown/i })
  }

  get menuDeletePrompt() {
    return this.promptContextMenu.getByRole('menuitem', { name: /delete prompt/i })
  }

  get menuDuplicatePrompt() {
    return this.promptContextMenu.getByRole('menuitem', { name: /duplicate/i })
  }

  get menuAddToProject() {
    return this.promptContextMenu.getByRole('menuitem', { name: /add to project/i })
  }

  // ========================================
  // DIALOG AND MODAL ELEMENTS
  // ========================================

  get promptViewDialog() {
    return this.page.getByTestId('prompt-view-dialog')
  }

  get promptEditDialog() {
    return this.page.getByTestId('prompt-edit-dialog')
  }

  get promptCreateDialog() {
    return this.page.getByTestId('prompt-create-dialog')
  }

  get confirmDeleteDialog() {
    return this.page.getByTestId('confirm-delete-dialog')
  }

  // Form elements in dialogs
  get promptTitleInput() {
    return this.page.getByTestId('prompt-title-input')
  }

  get promptDescriptionInput() {
    return this.page.getByTestId('prompt-description-input')
  }

  get promptContentEditor() {
    return this.page.getByTestId('prompt-content-editor')
  }

  get promptTagsInput() {
    return this.page.getByTestId('prompt-tags-input')
  }

  get savePromptButton() {
    return this.page.getByTestId('save-prompt-button')
  }

  get cancelPromptButton() {
    return this.page.getByTestId('cancel-prompt-button')
  }

  get confirmDeleteButton() {
    return this.confirmDeleteDialog.getByTestId('confirm-delete-button')
  }

  get cancelDeleteButton() {
    return this.confirmDeleteDialog.getByTestId('cancel-delete-button')
  }

  // ========================================
  // BASIC NAVIGATION AND SETUP
  // ========================================

  /**
   * Wait for prompts to load
   */
  async waitForPromptsLoad() {
    await expect(this.promptsLoadingState).toBeHidden({ timeout: 10000 })
    await expect(this.promptsContainer).toBeVisible()
  }

  /**
   * Get total number of prompt cards
   */
  async getPromptCount(): Promise<number> {
    await this.waitForPromptsLoad()
    return await this.promptCards.count()
  }

  /**
   * Verify prompts section is visible and loaded
   */
  async verifyPromptsLoaded() {
    await expect(this.promptsContainer).toBeVisible()
    await this.waitForPromptsLoad()
  }

  // ========================================
  // HOVER INTERACTION METHODS
  // ========================================

  /**
   * Hover over a prompt card to reveal actions
   */
  async hoverPromptCard(identifier: string | number, options: { duration?: number } = {}) {
    const { duration = 300 } = options
    
    const card = typeof identifier === 'string' 
      ? this.promptCard(identifier)
      : this.promptCardByIndex(identifier)
    
    await expect(card).toBeVisible()
    
    // Perform hover with optional duration
    await card.hover()
    
    if (duration > 0) {
      await this.page.waitForTimeout(duration)
    }

    // Verify hover overlay is visible
    await expect(this.promptHoverOverlay(card)).toBeVisible({ timeout: 2000 })
  }

  /**
   * Verify hover actions appear correctly
   */
  async verifyHoverActionsAppear(identifier: string | number) {
    const card = typeof identifier === 'string' 
      ? this.promptCard(identifier)
      : this.promptCardByIndex(identifier)
    
    await this.hoverPromptCard(identifier)

    // Check that copy icon is visible
    await expect(this.promptCopyIcon(card)).toBeVisible()
    
    // Check that three-dot menu is visible
    await expect(this.promptThreeDotMenu(card)).toBeVisible()
  }

  /**
   * Move mouse away from card to hide hover actions
   */
  async unhoverPromptCard() {
    // Move mouse to a neutral area
    await this.page.mouse.move(0, 0)
    await this.page.waitForTimeout(200)
  }

  // ========================================
  // COPY OPERATIONS
  // ========================================

  /**
   * Copy prompt using the hover copy icon
   */
  async copyPromptViaIcon(identifier: string | number) {
    const card = typeof identifier === 'string' 
      ? this.promptCard(identifier)
      : this.promptCardByIndex(identifier)

    await this.hoverPromptCard(identifier)
    await this.promptCopyIcon(card).click()
    
    await this.waitForToast(/copied.*clipboard/i)
  }

  /**
   * Copy prompt content via context menu
   */
  async copyPromptViaMenu(identifier: string | number) {
    await this.openPromptContextMenu(identifier)
    await this.menuCopyContent.click()
    
    await this.waitForToast(/content.*copied/i)
    await expect(this.promptContextMenu).toBeHidden()
  }

  // ========================================
  // THREE-DOT MENU OPERATIONS
  // ========================================

  /**
   * Open the three-dot context menu for a prompt
   */
  async openPromptContextMenu(identifier: string | number) {
    const card = typeof identifier === 'string' 
      ? this.promptCard(identifier)
      : this.promptCardByIndex(identifier)

    await this.hoverPromptCard(identifier)
    await this.promptThreeDotMenu(card).click()
    
    await expect(this.promptContextMenu).toBeVisible()
  }

  /**
   * Close the context menu
   */
  async closePromptContextMenu() {
    await this.page.keyboard.press('Escape')
    await expect(this.promptContextMenu).toBeHidden()
  }

  /**
   * Verify all menu options are present
   */
  async verifyContextMenuOptions() {
    await expect(this.menuViewPrompt).toBeVisible()
    await expect(this.menuEditPrompt).toBeVisible()
    await expect(this.menuCopyContent).toBeVisible()
    await expect(this.menuExportMarkdown).toBeVisible()
    await expect(this.menuDeletePrompt).toBeVisible()
  }

  // ========================================
  // VIEW PROMPT OPERATIONS
  // ========================================

  /**
   * View prompt details in modal
   */
  async viewPrompt(identifier: string | number) {
    await this.openPromptContextMenu(identifier)
    await this.menuViewPrompt.click()
    
    await expect(this.promptViewDialog).toBeVisible()
    await expect(this.promptContextMenu).toBeHidden()
  }

  /**
   * Get prompt content from view dialog
   */
  async getPromptContentFromViewDialog(): Promise<string> {
    const contentElement = this.promptViewDialog.getByTestId('prompt-content')
    return (await contentElement.textContent()) || ''
  }

  /**
   * Close prompt view dialog
   */
  async closePromptViewDialog() {
    const closeButton = this.promptViewDialog.getByRole('button', { name: /close/i })
    await closeButton.click()
    await expect(this.promptViewDialog).toBeHidden()
  }

  // ========================================
  // EDIT PROMPT OPERATIONS
  // ========================================

  /**
   * Open prompt for editing
   */
  async editPrompt(identifier: string | number) {
    await this.openPromptContextMenu(identifier)
    await this.menuEditPrompt.click()
    
    await expect(this.promptEditDialog).toBeVisible()
    await expect(this.promptContextMenu).toBeHidden()
    
    // Wait for form to be ready
    await expect(this.promptTitleInput).toBeVisible()
    await expect(this.promptContentEditor).toBeVisible()
  }

  /**
   * Fill prompt edit form
   */
  async fillPromptEditForm(data: {
    title?: string
    description?: string
    content?: string
    tags?: string[]
  }) {
    const { title, description, content, tags } = data

    if (title !== undefined) {
      await this.promptTitleInput.clear()
      await this.promptTitleInput.fill(title)
    }

    if (description !== undefined) {
      await this.promptDescriptionInput.clear()
      await this.promptDescriptionInput.fill(description)
    }

    if (content !== undefined) {
      // Handle Monaco editor if present
      const isMonaco = await this.promptContentEditor.locator('.monaco-editor').isVisible()
      
      if (isMonaco) {
        await this.setMonacoEditorContent(content)
      } else {
        await this.promptContentEditor.clear()
        await this.promptContentEditor.fill(content)
      }
    }

    if (tags !== undefined) {
      await this.promptTagsInput.clear()
      await this.promptTagsInput.fill(tags.join(', '))
    }
  }

  /**
   * Save prompt changes
   */
  async savePromptChanges() {
    await this.savePromptButton.click()
    await this.waitForToast(/saved.*successfully/i)
    await expect(this.promptEditDialog).toBeHidden()
  }

  /**
   * Cancel prompt changes
   */
  async cancelPromptChanges() {
    await this.cancelPromptButton.click()
    await expect(this.promptEditDialog).toBeHidden()
  }

  // ========================================
  // CREATE PROMPT OPERATIONS
  // ========================================

  /**
   * Open create prompt dialog
   */
  async createNewPrompt() {
    await this.createPromptButton.click()
    await expect(this.promptCreateDialog).toBeVisible()
  }

  /**
   * Create a new prompt with provided data
   */
  async createPrompt(data: {
    title: string
    description?: string
    content: string
    tags?: string[]
  }) {
    await this.createNewPrompt()
    await this.fillPromptEditForm(data)
    await this.savePromptChanges()
    
    // Wait for new prompt to appear in list
    await expect(this.promptCard(data.title)).toBeVisible({ timeout: 5000 })
  }

  // ========================================
  // DELETE PROMPT OPERATIONS
  // ========================================

  /**
   * Delete a prompt with confirmation
   */
  async deletePrompt(identifier: string | number, confirm: boolean = true) {
    await this.openPromptContextMenu(identifier)
    await this.menuDeletePrompt.click()
    
    await expect(this.confirmDeleteDialog).toBeVisible()
    
    if (confirm) {
      await this.confirmDeleteButton.click()
      await this.waitForToast(/deleted.*successfully/i)
      await expect(this.confirmDeleteDialog).toBeHidden()
    } else {
      await this.cancelDeleteButton.click()
      await expect(this.confirmDeleteDialog).toBeHidden()
    }
  }

  /**
   * Verify prompt was deleted
   */
  async verifyPromptDeleted(title: string) {
    await expect(this.promptCard(title)).toBeHidden({ timeout: 5000 })
  }

  // ========================================
  // EXPORT OPERATIONS
  // ========================================

  /**
   * Export prompt as markdown
   */
  async exportPromptAsMarkdown(identifier: string | number): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download')
    
    await this.openPromptContextMenu(identifier)
    await this.menuExportMarkdown.click()
    
    const download = await downloadPromise
    await expect(this.promptContextMenu).toBeHidden()
    
    return download
  }

  /**
   * Verify markdown export
   */
  async verifyMarkdownExport(download: Download, expectedFilename?: string) {
    if (expectedFilename) {
      expect(download.suggestedFilename()).toContain(expectedFilename)
    }
    
    expect(download.suggestedFilename()).toMatch(/\.md$/)
  }

  // ========================================
  // PROMPT INFORMATION METHODS
  // ========================================

  /**
   * Get complete prompt card information
   */
  async getPromptCardInfo(identifier: string | number): Promise<PromptCardInfo> {
    const card = typeof identifier === 'string' 
      ? this.promptCard(identifier)
      : this.promptCardByIndex(identifier)

    await expect(card).toBeVisible()

    const title = await this.promptTitle(card).textContent() || ''
    const description = await this.promptDescription(card).isVisible() 
      ? await this.promptDescription(card).textContent() || undefined
      : undefined
    const preview = await this.promptPreview(card).isVisible() 
      ? await this.promptPreview(card).textContent() || undefined
      : undefined

    // Get tags if visible
    const tags: string[] = []
    if (await this.promptTags(card).isVisible()) {
      const tagElements = this.promptTags(card).locator('[data-testid="prompt-tag"]')
      const count = await tagElements.count()
      for (let i = 0; i < count; i++) {
        const tag = await tagElements.nth(i).textContent()
        if (tag) tags.push(tag.trim())
      }
    }

    // Get token count if visible
    const tokenCount = await this.promptTokenCount(card).isVisible()
      ? parseInt((await this.promptTokenCount(card).textContent())?.match(/(\d+)/)?.[1] || '0')
      : undefined

    // Get last modified if visible
    const lastModified = await this.promptLastModified(card).isVisible()
      ? await this.promptLastModified(card).textContent() || undefined
      : undefined

    return {
      title: title.trim(),
      description,
      content: preview,
      tags: tags.length > 0 ? tags : undefined,
      tokenCount,
      lastModified
    }
  }

  /**
   * Get all visible prompt cards information
   */
  async getAllPromptCardsInfo(): Promise<PromptCardInfo[]> {
    const count = await this.getPromptCount()
    const promptsInfo: PromptCardInfo[] = []

    for (let i = 0; i < count; i++) {
      const info = await this.getPromptCardInfo(i)
      promptsInfo.push(info)
    }

    return promptsInfo
  }

  /**
   * Find prompt by title
   */
  async findPromptByTitle(title: string): Promise<PromptCardInfo | null> {
    const allPrompts = await this.getAllPromptCardsInfo()
    return allPrompts.find(p => p.title === title) || null
  }

  // ========================================
  // VALIDATION AND TESTING HELPERS
  // ========================================

  /**
   * Verify prompt card displays correctly
   */
  async verifyPromptCardDisplay(identifier: string | number, expectedData: Partial<PromptCardInfo>) {
    const cardInfo = await this.getPromptCardInfo(identifier)

    if (expectedData.title) {
      expect(cardInfo.title).toBe(expectedData.title)
    }

    if (expectedData.description) {
      expect(cardInfo.description).toBe(expectedData.description)
    }

    if (expectedData.tags) {
      expect(cardInfo.tags).toEqual(expectedData.tags)
    }

    if (expectedData.tokenCount) {
      expect(cardInfo.tokenCount).toBe(expectedData.tokenCount)
    }
  }

  /**
   * Test all hover interactions for a prompt
   */
  async testPromptHoverInteractions(identifier: string | number) {
    // Test hover shows actions
    await this.verifyHoverActionsAppear(identifier)
    
    // Test copy icon works
    await this.copyPromptViaIcon(identifier)
    
    // Test three-dot menu opens
    await this.openPromptContextMenu(identifier)
    await this.verifyContextMenuOptions()
    await this.closePromptContextMenu()
    
    // Test unhover hides actions
    await this.unhoverPromptCard()
    
    const card = typeof identifier === 'string' 
      ? this.promptCard(identifier)
      : this.promptCardByIndex(identifier)
    
    await expect(this.promptHoverOverlay(card)).toBeHidden({ timeout: 2000 })
  }

  /**
   * Test complete CRUD workflow for a prompt
   */
  async testPromptCRUDWorkflow(promptData: {
    title: string
    description?: string
    content: string
    tags?: string[]
  }) {
    // Create
    await this.createPrompt(promptData)
    
    // Read - verify it exists
    const created = await this.findPromptByTitle(promptData.title)
    expect(created).toBeTruthy()
    
    // Update
    const updatedData = {
      ...promptData,
      title: promptData.title + ' (Updated)',
      content: promptData.content + '\n\nUpdated content'
    }
    
    await this.editPrompt(promptData.title)
    await this.fillPromptEditForm(updatedData)
    await this.savePromptChanges()
    
    // Verify update
    const updated = await this.findPromptByTitle(updatedData.title)
    expect(updated).toBeTruthy()
    
    // Delete
    await this.deletePrompt(updatedData.title, true)
    await this.verifyPromptDeleted(updatedData.title)
  }

  // ========================================
  // MONACO EDITOR HELPERS
  // ========================================

  /**
   * Set content in Monaco editor (if present)
   */
  private async setMonacoEditorContent(content: string) {
    await this.page.evaluate((text) => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor) {
        const editors = monaco.editor.getModels()
        if (editors.length > 0) {
          editors[0].setValue(text)
        }
      }
    }, content)
    
    await this.page.waitForTimeout(200)
  }

  /**
   * Take screenshot of prompts section
   */
  async takePromptsScreenshot(name: string = 'prompts') {
    await this.promptsContainer.screenshot({
      path: `e2e/screenshots/prompts-${name}-${Date.now()}.png`
    })
  }
}