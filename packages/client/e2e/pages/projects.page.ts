import { type Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class ProjectsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Project list elements
  get projectGrid() {
    return this.page.locator('[data-testid="projects-grid"], .projects-grid')
  }

  get projectCards() {
    return this.page.locator('[data-testid="project-card"], .project-card')
  }

  get emptyState() {
    return this.page.locator('[data-testid="no-projects"], text="No projects found"')
  }

  // Project actions
  get createProjectButton() {
    return this.page.locator(
      '[data-testid="create-project"], button:has-text("New Project"), button:has-text("Create Project")'
    )
  }

  get importProjectButton() {
    return this.page.locator('[data-testid="import-project"], button:has-text("Import Project")')
  }

  // Project dialog elements
  get projectDialog() {
    return this.page.locator('[role="dialog"], [data-testid="project-dialog"]')
  }

  get projectNameInput() {
    return this.page.locator('input[name="name"], input[placeholder*="project name" i]')
  }

  get projectPathInput() {
    return this.page.locator('input[name="path"], input[placeholder*="path" i]')
  }

  get projectDescriptionInput() {
    return this.page.locator('textarea[name="description"], textarea[placeholder*="description" i]')
  }

  get selectDirectoryButton() {
    return this.page.locator('[data-testid="select-directory"], button:has-text("Select Directory")')
  }

  get submitProjectButton() {
    return this.page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
  }

  get cancelProjectButton() {
    return this.page.locator('button:has-text("Cancel")')
  }

  // Project card actions
  getProjectCard(projectName: string) {
    return this.page.locator(
      `[data-testid="project-card"]:has-text("${projectName}"), .project-card:has-text("${projectName}")`
    )
  }

  getProjectCardMenu(projectName: string) {
    return this.getProjectCard(projectName).locator('[data-testid="project-menu"], button[aria-label*="menu"]')
  }

  get projectMenuEdit() {
    return this.page.locator('[data-testid="edit-project"], text="Edit"')
  }

  get projectMenuDelete() {
    return this.page.locator('[data-testid="delete-project"], text="Delete"')
  }

  get projectMenuSettings() {
    return this.page.locator('[data-testid="project-settings"], text="Settings"')
  }

  // Search and filters
  get searchInput() {
    return this.page.locator('[data-testid="project-search"], input[placeholder*="search" i]')
  }

  get sortSelect() {
    return this.page.locator('[data-testid="sort-projects"], select')
  }

  get filterButton() {
    return this.page.locator('[data-testid="filter-projects"], button:has-text("Filter")')
  }

  /**
   * Navigate to projects page
   */
  async goto() {
    await super.goto('/projects')
  }

  /**
   * Create a new project
   */
  async createProject(projectData: { name: string; path?: string; description?: string }) {
    await this.createProjectButton.click()
    await expect(this.projectDialog).toBeVisible()

    // Fill project details
    await this.projectNameInput.fill(projectData.name)

    if (projectData.path) {
      await this.projectPathInput.fill(projectData.path)
    } else {
      // Use directory selector if path not provided
      if (await this.selectDirectoryButton.isVisible()) {
        await this.selectDirectoryButton.click()
        // In a real implementation, this would handle the directory picker
        // For testing, we might need to mock or use a default path
      }
    }

    if (projectData.description) {
      await this.projectDescriptionInput.fill(projectData.description)
    }

    // Submit the form
    await this.submitProjectButton.click()

    // Wait for project creation to complete
    await this.waitForAPIResponse(/\/api\/projects/, 'POST')
    await this.waitForLoadingComplete()

    // Verify project was created
    await expect(this.getProjectCard(projectData.name)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Edit an existing project
   */
  async editProject(
    currentName: string,
    updates: {
      name?: string
      description?: string
    }
  ) {
    await this.openProjectMenu(currentName)
    await this.projectMenuEdit.click()

    await expect(this.projectDialog).toBeVisible()

    if (updates.name) {
      await this.projectNameInput.fill(updates.name)
    }

    if (updates.description) {
      await this.projectDescriptionInput.fill(updates.description)
    }

    await this.submitProjectButton.click()
    await this.waitForAPIResponse(/\/api\/projects/, 'PUT')
    await this.waitForLoadingComplete()
  }

  /**
   * Delete a project
   */
  async deleteProject(projectName: string) {
    await this.openProjectMenu(projectName)
    await this.projectMenuDelete.click()

    // Handle confirmation dialog
    await this.handleConfirmationDialog('accept')

    // Wait for deletion API call
    await this.waitForAPIResponse(/\/api\/projects/, 'DELETE')
    await this.waitForLoadingComplete()

    // Verify project was deleted
    await expect(this.getProjectCard(projectName)).not.toBeVisible()
  }

  /**
   * Open a project (navigate to project view)
   */
  async openProject(projectName: string) {
    await this.getProjectCard(projectName).click()
    await this.waitForLoadingComplete()

    // Should navigate to project detail/dashboard
    await expect(this.page).toHaveURL(new RegExp('/projects/\\d+'))
  }

  /**
   * Open project menu
   */
  async openProjectMenu(projectName: string) {
    const projectCard = this.getProjectCard(projectName)
    await expect(projectCard).toBeVisible()

    // Hover to reveal menu button
    await projectCard.hover()

    const menuButton = this.getProjectCardMenu(projectName)
    await menuButton.click()

    // Wait for menu to appear
    await expect(this.projectMenuEdit).toBeVisible()
  }

  /**
   * Search for projects
   */
  async searchProjects(query: string) {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.waitForLoadingComplete()
  }

  /**
   * Get all visible project names
   */
  async getVisibleProjectNames(): Promise<string[]> {
    const cards = this.projectCards
    const count = await cards.count()
    const names: string[] = []

    for (let i = 0; i < count; i++) {
      const name = await cards.nth(i).locator('[data-testid="project-name"], .project-name').textContent()
      if (name) names.push(name.trim())
    }

    return names
  }

  /**
   * Check if project exists in the list
   */
  async projectExists(projectName: string): Promise<boolean> {
    return await this.getProjectCard(projectName).isVisible()
  }

  /**
   * Get project card info
   */
  async getProjectInfo(projectName: string) {
    const card = this.getProjectCard(projectName)
    await expect(card).toBeVisible()

    const name = await card.locator('[data-testid="project-name"], .project-name').textContent()
    const path = await card.locator('[data-testid="project-path"], .project-path').textContent()
    const description = await card.locator('[data-testid="project-description"], .project-description').textContent()
    const lastModified = await card.locator('[data-testid="project-modified"], .project-modified').textContent()

    return {
      name: name?.trim() || '',
      path: path?.trim() || '',
      description: description?.trim() || '',
      lastModified: lastModified?.trim() || ''
    }
  }

  /**
   * Wait for projects to load
   */
  async waitForProjectsLoaded() {
    // Wait for either projects to appear or empty state
    await expect(this.projectCards.first().or(this.emptyState)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Sort projects
   */
  async sortProjects(sortBy: 'name' | 'date' | 'size') {
    await this.sortSelect.selectOption(sortBy)
    await this.waitForLoadingComplete()
  }

  /**
   * Check if in empty state
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible()
  }

  /**
   * Get project count
   */
  async getProjectCount(): Promise<number> {
    if (await this.isEmptyState()) {
      return 0
    }
    return await this.projectCards.count()
  }
}
