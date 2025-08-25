import { type Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class PromptsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Prompt list elements
  get promptsContainer() {
    return this.page.locator('[data-testid="prompts-container"], .prompts-container')
  }

  get promptCards() {
    return this.page.locator('[data-testid="prompt-card"], .prompt-card')
  }

  get emptyState() {
    return this.page.locator('[data-testid="no-prompts"], text="No prompts found"')
  }

  // Prompt actions
  get createPromptButton() {
    return this.page.locator('[data-testid="create-prompt"], button:has-text("New Prompt"), button:has-text("Create Prompt")')
  }

  get importPromptButton() {
    return this.page.locator('[data-testid="import-prompt"], button:has-text("Import Prompt")')
  }

  // Prompt dialog/form elements
  get promptDialog() {
    return this.page.locator('[role="dialog"], [data-testid="prompt-dialog"]')
  }

  get promptTitleInput() { // Changed from promptNameInput to promptTitleInput to match schema
    return this.page.locator('input[name="title"], input[placeholder*="prompt title" i], input[placeholder*="prompt name" i]')
  }

  get promptContentTextarea() {
    return this.page.locator('textarea[name="content"], [data-testid="prompt-content"]')
  }

  get promptDescriptionInput() {
    return this.page.locator('textarea[name="description"], input[name="description"]')
  }

  get promptCategorySelect() {
    return this.page.locator('select[name="category"], [data-testid="category-select"]')
  }

  get promptTagsInput() {
    return this.page.locator('input[name="tags"], [data-testid="tags-input"]')
  }

  get submitPromptButton() {
    return this.page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
  }

  get cancelPromptButton() {
    return this.page.locator('button:has-text("Cancel")')
  }

  // Prompt editor (Monaco/CodeMirror)
  get promptEditor() {
    return this.page.locator('.monaco-editor, .cm-editor, [data-testid="prompt-editor"]')
  }

  // Search and filters
  get searchInput() {
    return this.page.locator('[data-testid="prompt-search"], input[placeholder*="search" i]')
  }

  get categoryFilter() {
    return this.page.locator('[data-testid="category-filter"], select[name="category-filter"]')
  }

  get tagsFilter() {
    return this.page.locator('[data-testid="tags-filter"]')
  }

  get sortSelect() {
    return this.page.locator('[data-testid="sort-prompts"], select')
  }

  // Prompt card actions
  getPromptCard(promptTitle: string) { // Changed parameter name
    return this.page.locator(`[data-testid="prompt-card"]:has-text("${promptTitle}"), .prompt-card:has-text("${promptTitle}")`)
  }

  getPromptCardMenu(promptTitle: string) { // Changed parameter name
    return this.getPromptCard(promptTitle).locator('[data-testid="prompt-menu"], button[aria-label*="menu"]')
  }

  get promptMenuEdit() {
    return this.page.locator('[data-testid="edit-prompt"], text="Edit"')
  }

  get promptMenuDuplicate() {
    return this.page.locator('[data-testid="duplicate-prompt"], text="Duplicate"')
  }

  get promptMenuDelete() {
    return this.page.locator('[data-testid="delete-prompt"], text="Delete"')
  }

  get promptMenuExport() {
    return this.page.locator('[data-testid="export-prompt"], text="Export"')
  }

  /**
   * Navigate to prompts page
   */
  async goto() {
    await super.goto('/prompts')
  }

  /**
   * Create a new prompt
   */
  async createPrompt(promptData: {
    title: string // Changed from 'name' to 'title' to match schema
    content: string
    description?: string
    tags?: string[] // Removed category as it's not in schema
  }) {
    await this.createPromptButton.click()
    await expect(this.promptDialog).toBeVisible()

    // Fill prompt details
    await this.promptTitleInput.fill(promptData.title) // Updated method name
    
    // Fill content - check if we have a code editor or simple textarea
    if (await this.promptEditor.isVisible()) {
      // Monaco editor or similar
      await this.promptEditor.click()
      await this.page.keyboard.type(promptData.content)
    } else {
      await this.promptContentTextarea.fill(promptData.content)
    }

    if (promptData.description) {
      await this.promptDescriptionInput.fill(promptData.description)
    }

    // Category field removed as it's not in the database schema

    if (promptData.tags && promptData.tags.length > 0) {
      for (const tag of promptData.tags) {
        await this.promptTagsInput.fill(tag)
        await this.page.keyboard.press('Enter')
      }
    }

    // Submit the form
    await this.submitPromptButton.click()
    
    // Wait for prompt creation
    await this.waitForAPIResponse(/\/api\/prompts/, 'POST')
    await this.waitForLoadingComplete()
    
    // Verify prompt was created
    await expect(this.getPromptCard(promptData.title)).toBeVisible({ timeout: 10000 }) // Updated to use title
  }

  /**
   * Edit an existing prompt
   */
  async editPrompt(currentTitle: string, updates: { // Changed currentName to currentTitle
    title?: string // Changed name to title
    content?: string
    description?: string
    tags?: string[] // Removed category
  }) {
    await this.openPromptMenu(currentTitle)
    await this.promptMenuEdit.click()
    
    await expect(this.promptDialog).toBeVisible()

    if (updates.title) {
      await this.promptTitleInput.fill(updates.title) // Updated method name
    }

    if (updates.content) {
      if (await this.promptEditor.isVisible()) {
        await this.promptEditor.click()
        await this.page.keyboard.selectAll()
        await this.page.keyboard.type(updates.content)
      } else {
        await this.promptContentTextarea.fill(updates.content)
      }
    }

    if (updates.description) {
      await this.promptDescriptionInput.fill(updates.description)
    }

    // Category field removed as it's not in the database schema

    await this.submitPromptButton.click()
    await this.waitForAPIResponse(/\/api\/prompts/, 'PUT')
    await this.waitForLoadingComplete()
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(promptTitle: string) { // Changed promptName to promptTitle
    await this.openPromptMenu(promptTitle)
    await this.promptMenuDelete.click()
    
    // Handle confirmation dialog
    await this.handleConfirmationDialog('accept')
    
    // Wait for deletion
    await this.waitForAPIResponse(/\/api\/prompts/, 'DELETE')
    await this.waitForLoadingComplete()
    
    // Verify prompt was deleted
    await expect(this.getPromptCard(promptTitle)).not.toBeVisible()
  }

  /**
   * Duplicate a prompt
   */
  async duplicatePrompt(promptTitle: string, newTitle?: string) { // Changed parameter names
    await this.openPromptMenu(promptTitle)
    await this.promptMenuDuplicate.click()
    
    if (newTitle) {
      await expect(this.promptDialog).toBeVisible()
      await this.promptTitleInput.fill(newTitle) // Updated method name
      await this.submitPromptButton.click()
    }
    
    await this.waitForAPIResponse(/\/api\/prompts/, 'POST')
    await this.waitForLoadingComplete()
    
    const expectedTitle = newTitle || `${promptTitle} (Copy)`
    await expect(this.getPromptCard(expectedTitle)).toBeVisible()
  }

  /**
   * Open a prompt for editing/viewing
   */
  async openPrompt(promptTitle: string) { // Changed parameter name
    await this.getPromptCard(promptTitle).click()
    await this.waitForLoadingComplete()
    
    // Should open prompt editor or detail view
    await expect(this.promptEditor.or(this.promptDialog)).toBeVisible()
  }

  /**
   * Open prompt menu
   */
  async openPromptMenu(promptTitle: string) { // Changed parameter name
    const promptCard = this.getPromptCard(promptTitle)
    await expect(promptCard).toBeVisible()
    
    // Hover to reveal menu button
    await promptCard.hover()
    
    const menuButton = this.getPromptCardMenu(promptTitle)
    await menuButton.click()
    
    // Wait for menu to appear
    await expect(this.promptMenuEdit).toBeVisible()
  }

  /**
   * Search for prompts
   */
  async searchPrompts(query: string) {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.waitForLoadingComplete()
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption(category)
    await this.waitForLoadingComplete()
  }

  /**
   * Filter by tag
   */
  async filterByTag(tag: string) {
    const tagElement = this.page.locator(`[data-testid="tag-${tag}"], .tag:has-text("${tag}")`)
    await tagElement.click()
    await this.waitForLoadingComplete()
  }

  /**
   * Get all visible prompt titles
   */
  async getVisiblePromptTitles(): Promise<string[]> { // Changed method name and return type description
    const cards = this.promptCards
    const count = await cards.count()
    const titles: string[] = []
    
    for (let i = 0; i < count; i++) {
      const title = await cards.nth(i).locator('[data-testid="prompt-title"], [data-testid="prompt-name"], .prompt-title, .prompt-name').textContent()
      if (title) titles.push(title.trim())
    }
    
    return titles
  }

  /**
   * Check if prompt exists
   */
  async promptExists(promptTitle: string): Promise<boolean> { // Changed parameter name
    return await this.getPromptCard(promptTitle).isVisible()
  }

  /**
   * Get prompt card information
   */
  async getPromptInfo(promptTitle: string) { // Changed parameter name
    const card = this.getPromptCard(promptTitle)
    await expect(card).toBeVisible()
    
    const title = await card.locator('[data-testid="prompt-title"], [data-testid="prompt-name"], .prompt-title, .prompt-name').textContent()
    const description = await card.locator('[data-testid="prompt-description"], .prompt-description').textContent()
    const tags = await card.locator('[data-testid="prompt-tags"], .prompt-tags [data-testid="tag"]').allTextContents()
    const lastModified = await card.locator('[data-testid="prompt-modified"], .prompt-modified').textContent()
    
    return {
      title: title?.trim() || '', // Changed from 'name' to 'title'
      description: description?.trim() || '',
      tags: tags.map(tag => tag.trim()).filter(Boolean), // Removed category
      lastModified: lastModified?.trim() || ''
    }
  }

  /**
   * Wait for prompts to load
   */
  async waitForPromptsLoaded() {
    await expect(this.promptCards.first().or(this.emptyState)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Import prompt from markdown
   */
  async importPrompt(markdownContent: string) {
    await this.importPromptButton.click()
    
    // This would depend on the actual import implementation
    // Might be a file input or a text area
    const importInput = this.page.locator('input[type="file"], textarea[placeholder*="markdown" i]')
    
    if (await importInput.getAttribute('type') === 'file') {
      // File input - would need to create a temporary file
      // This is more complex in testing
    } else {
      // Text area
      await importInput.fill(markdownContent)
    }
    
    await this.submitPromptButton.click()
    await this.waitForAPIResponse(/\/api\/prompts/, 'POST')
    await this.waitForLoadingComplete()
  }

  /**
   * Export prompt
   */
  async exportPrompt(promptTitle: string) { // Changed parameter name
    await this.openPromptMenu(promptTitle)
    await this.promptMenuExport.click()
    
    // This would trigger a download or show export options
    // In testing, we might just verify the API call
    await this.waitForAPIResponse(/\/api\/prompts\/.*\/export/, 'GET')
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
   * Check if in empty state
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible()
  }
}