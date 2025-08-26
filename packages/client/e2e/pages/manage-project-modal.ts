import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Page Object Model for the Manage Project Modal
 *
 * This modal is accessible via the ProjectSwitcher "Manage Projects" option
 * and provides project listing, creation, editing, and management capabilities.
 */
export class ManageProjectModal extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Modal trigger and container elements
  get modalTriggerButton(): Locator {
    // The "Manage Projects" option in ProjectSwitcher dropdown
    return this.page.getByRole('menuitem', { name: /manage.*projects/i })
  }

  get projectSwitcherButton(): Locator {
    // The main project switcher button that opens the dropdown
    return this.page.getByRole('button').filter({ hasText: /select.*project|loading/i })
  }

  get modal(): Locator {
    // The main modal dialog with "Select or Create Project" title
    return this.page.locator('[role="dialog"]').filter({ hasText: /select.*create.*project/i })
  }

  get modalHeader(): Locator {
    return this.modal.locator('[data-testid="dialog-header"], .dialog-header').first()
  }

  get modalTitle(): Locator {
    return this.modal.getByRole('heading', { name: /select.*create.*project/i })
  }

  get closeButton(): Locator {
    return this.modal.getByRole('button', { name: /close/i })
  }

  // Project list elements
  get projectList(): Locator {
    return this.modal.locator('.space-y-1').filter({ hasText: /projects/i })
  }

  get projectItems(): Locator {
    return this.projectList.locator('.group').filter({ has: this.page.locator('svg[data-lucide="folder"]') })
  }

  get emptyState(): Locator {
    return this.modal.getByText(/no.*projects.*yet/i)
  }

  get loadingState(): Locator {
    return this.modal.locator('button').filter({ hasText: /loading/i })
  }

  projectItem(projectName: string): Locator {
    return this.projectItems.filter({ hasText: projectName })
  }

  getProjectName(projectName: string): Locator {
    return this.projectItem(projectName).locator('div').filter({ hasText: projectName }).first()
  }

  getProjectPath(projectName: string): Locator {
    return this.projectItem(projectName).locator('.text-muted-foreground').first()
  }

  getProjectButton(projectName: string): Locator {
    return this.projectItem(projectName).getByRole('button').first()
  }

  getProjectActions(projectName: string): Locator {
    return this.projectItem(projectName).getByRole('button', { name: /more/i })
  }

  // Project actions
  getOpenProjectButton(projectName: string): Locator {
    return this.getProjectButton(projectName)
  }

  getEditProjectButton(projectName: string): Locator {
    return this.page.getByRole('menuitem', { name: /edit.*project/i })
  }

  getDeleteProjectButton(projectName: string): Locator {
    return this.page.getByRole('menuitem', { name: /delete.*project/i })
  }

  // Add new project elements
  get addProjectButton(): Locator {
    return this.modal
      .getByRole('button', { name: /project/i })
      .filter({ has: this.page.locator('svg[data-lucide="plus"]') })
  }

  // Project Dialog (Create/Edit Form) elements
  get projectDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /new.*project|edit.*project/i })
  }

  get projectDialogTitle(): Locator {
    return this.projectDialog.getByRole('heading', { name: /new.*project|edit.*project/i })
  }

  get projectNameInput(): Locator {
    return this.projectDialog.getByLabel(/name/i)
  }

  get projectPathInput(): Locator {
    return this.projectDialog.getByLabel(/path/i)
  }

  get projectDescriptionInput(): Locator {
    return this.projectDialog.getByLabel(/description/i)
  }

  get browseDirectoryButton(): Locator {
    return this.projectDialog.getByRole('button').filter({ has: this.page.locator('svg[data-lucide="folder-open"]') })
  }

  get createProjectButton(): Locator {
    return this.projectDialog.getByRole('button', { name: /create.*project|save.*changes/i })
  }

  get cancelCreateButton(): Locator {
    return this.projectDialog.getByRole('button', { name: /cancel/i })
  }

  // Directory Browser Dialog elements
  get directoryBrowser(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /browse|select.*directory/i })
  }

  get directoryBrowserHeader(): Locator {
    return this.directoryBrowser.locator('header, .dialog-header').first()
  }

  get currentPathDisplay(): Locator {
    return this.directoryBrowser.locator('[data-testid="current-path"], .current-path')
  }

  get parentDirectoryButton(): Locator {
    return this.directoryBrowser.getByRole('button', { name: /parent|up|back/i })
  }

  get directoryList(): Locator {
    return this.directoryBrowser.locator('[data-testid="directory-list"], .directory-list')
  }

  get directoryItems(): Locator {
    return this.directoryList.locator('button, .directory-item').filter({ hasText: /folder/i })
  }

  get fileItems(): Locator {
    return this.directoryList.locator('button, .file-item').not(this.directoryItems)
  }

  getDirectoryItem(name: string): Locator {
    return this.directoryItems.filter({ hasText: name })
  }

  get selectDirectoryButton(): Locator {
    return this.directoryBrowser.getByRole('button', { name: /select/i })
  }

  get cancelBrowseButton(): Locator {
    return this.directoryBrowser.getByRole('button', { name: /cancel/i })
  }

  // Sync Progress Dialog elements
  get syncProgressDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /sync|progress/i })
  }

  get syncStatus(): Locator {
    return this.syncProgressDialog.locator('[data-testid="sync-status"], .sync-status')
  }

  get syncProgress(): Locator {
    return this.syncProgressDialog.locator('progress, [role="progressbar"]')
  }

  get syncMessage(): Locator {
    return this.syncProgressDialog.locator('[data-testid="sync-message"], .sync-message')
  }

  get cancelSyncButton(): Locator {
    return this.syncProgressDialog.getByRole('button', { name: /cancel/i })
  }

  // Validation and error messages
  get validationErrors(): Locator {
    return this.projectDialog.locator('[data-testid="validation-error"], .error, [role="alert"]')
  }

  get errorMessage(): Locator {
    return this.page.locator('[data-testid="error-message"], .error-message, [role="alert"]')
  }

  // Delete confirmation dialog
  get deleteConfirmationDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /delete.*project/i })
  }

  get confirmDeleteButton(): Locator {
    return this.deleteConfirmationDialog.getByRole('button', { name: /delete/i })
  }

  get cancelDeleteButton(): Locator {
    return this.deleteConfirmationDialog.getByRole('button', { name: /cancel/i })
  }

  // Helper methods

  /**
   * Open the manage project modal via ProjectSwitcher
   */
  async openModal(): Promise<void> {
    // First click the project switcher to open dropdown
    await this.projectSwitcherButton.click()

    // Wait for dropdown to be visible
    await expect(this.modalTriggerButton).toBeVisible()

    // Click "Manage Projects"
    await this.modalTriggerButton.click()

    // Wait for modal to open
    await expect(this.modal).toBeVisible()
    await expect(this.modalTitle).toBeVisible()
  }

  /**
   * Close the modal
   */
  async closeModal(): Promise<void> {
    // Try Escape key first, then close button
    await this.page.keyboard.press('Escape')

    // If modal is still visible, use close button
    if (await this.modal.isVisible({ timeout: 1000 })) {
      await this.closeButton.click()
    }

    await expect(this.modal).not.toBeVisible()
  }

  /**
   * Open the create project form
   */
  async openCreateProjectForm(): Promise<void> {
    await this.addProjectButton.click()
    await expect(this.projectDialog).toBeVisible()
    await expect(this.projectDialogTitle).toContainText(/new.*project/i)
  }

  /**
   * Fill the project form with data
   */
  async fillProjectForm(projectData: { name: string; path?: string; description?: string }): Promise<void> {
    await this.projectNameInput.fill(projectData.name)

    if (projectData.path) {
      await this.projectPathInput.fill(projectData.path)
    }

    if (projectData.description) {
      await this.projectDescriptionInput.fill(projectData.description)
    }
  }

  /**
   * Browse for a folder and select it
   */
  async browseFolderAndSelect(targetPath: string): Promise<void> {
    await this.browseDirectoryButton.click()
    await expect(this.directoryBrowser).toBeVisible()

    // Simple path navigation - in real implementation this would be more sophisticated
    const pathParts = targetPath.split('/').filter(Boolean)

    for (const part of pathParts) {
      if (part === '..') {
        if (await this.parentDirectoryButton.isVisible()) {
          await this.parentDirectoryButton.click()
        }
      } else {
        const dirItem = this.getDirectoryItem(part)
        if (await dirItem.isVisible()) {
          await dirItem.dblclick()
        }
      }

      // Wait for navigation to complete
      await this.page.waitForTimeout(500)
    }

    await this.selectDirectoryButton.click()
    await expect(this.directoryBrowser).not.toBeVisible()

    // Verify path was selected
    await expect(this.projectPathInput).toHaveValue(targetPath)
  }

  /**
   * Create a new project with the given data
   */
  async createProject(projectData: { name: string; path?: string; description?: string }): Promise<void> {
    await this.openCreateProjectForm()
    await this.fillProjectForm(projectData)

    // If path is provided but input is empty, use browse
    if (projectData.path && !(await this.projectPathInput.inputValue())) {
      await this.browseFolderAndSelect(projectData.path)
    }

    await this.createProjectButton.click()

    // Project dialog should close
    await expect(this.projectDialog).not.toBeVisible()
  }

  /**
   * Wait for project sync to complete
   */
  async waitForProjectSync(timeout = 30000): Promise<void> {
    // Wait for sync dialog to appear
    await expect(this.syncProgressDialog).toBeVisible({ timeout: 5000 })

    // Wait for sync to complete (dialog disappears)
    await expect(this.syncProgressDialog).not.toBeVisible({ timeout })
  }

  /**
   * Get the count of visible projects
   */
  async getProjectCount(): Promise<number> {
    if (await this.emptyState.isVisible({ timeout: 1000 })) {
      return 0
    }
    return await this.projectItems.count()
  }

  /**
   * Select/open a project
   */
  async selectProject(projectName: string): Promise<void> {
    await this.getOpenProjectButton(projectName).click()

    // Modal should close and navigate to projects
    await expect(this.modal).not.toBeVisible()
  }

  /**
   * Delete a project with confirmation
   */
  async deleteProject(projectName: string, confirm: boolean = true): Promise<void> {
    // Click the project actions menu
    await this.getProjectActions(projectName).click()

    // Click delete option
    await this.getDeleteProjectButton(projectName).click()

    // Handle confirmation dialog
    await expect(this.deleteConfirmationDialog).toBeVisible()

    if (confirm) {
      await this.confirmDeleteButton.click()
    } else {
      await this.cancelDeleteButton.click()
    }

    // Wait for dialog to close
    await expect(this.deleteConfirmationDialog).not.toBeVisible()
  }

  /**
   * Edit a project
   */
  async editProject(
    projectName: string,
    updates: {
      name?: string
      description?: string
    }
  ): Promise<void> {
    // Click the project actions menu
    await this.getProjectActions(projectName).click()

    // Click edit option
    await this.getEditProjectButton(projectName).click()

    // Wait for edit dialog
    await expect(this.projectDialog).toBeVisible()
    await expect(this.projectDialogTitle).toContainText(/edit.*project/i)

    // Make updates
    if (updates.name) {
      await this.projectNameInput.clear()
      await this.projectNameInput.fill(updates.name)
    }

    if (updates.description) {
      await this.projectDescriptionInput.clear()
      await this.projectDescriptionInput.fill(updates.description)
    }

    // Save changes
    await this.createProjectButton.click()

    // Dialog should close
    await expect(this.projectDialog).not.toBeVisible()
  }

  /**
   * Check if a project exists in the list
   */
  async projectExists(projectName: string): Promise<boolean> {
    return await this.projectItem(projectName).isVisible({ timeout: 1000 })
  }

  /**
   * Wait for projects to load
   */
  async waitForProjectsLoaded(): Promise<void> {
    // Wait for loading to finish
    await expect(this.loadingState).not.toBeVisible({ timeout: 10000 })

    // Wait for either projects to appear or empty state
    await expect(this.projectItems.first().or(this.emptyState)).toBeVisible({ timeout: 5000 })
  }

  /**
   * Get all visible project names
   */
  async getVisibleProjectNames(): Promise<string[]> {
    const count = await this.projectItems.count()
    const names: string[] = []

    for (let i = 0; i < count; i++) {
      const projectItem = this.projectItems.nth(i)
      const nameElement = projectItem.locator('div').first()
      const name = await nameElement.textContent()
      if (name) {
        names.push(name.trim())
      }
    }

    return names
  }

  /**
   * Check if modal is in empty state
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible({ timeout: 1000 })
  }

  /**
   * Handle sync cancellation
   */
  async cancelSync(): Promise<void> {
    if (await this.syncProgressDialog.isVisible()) {
      await this.cancelSyncButton.click()
      await expect(this.syncProgressDialog).not.toBeVisible()
    }
  }
}
