import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Simple Page Object Model for Projects Page
 * Follows modern Playwright best practices with minimal abstraction
 */
export class ProjectsPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ============================================
  // NAVIGATION & HEADER
  // ============================================

  get projectsButton() {
    return this.page.getByRole('button', { name: 'Projects', exact: true })
  }

  get projectSwitcher() {
    return this.page.getByTestId('project-switcher')
  }

  get breadcrumbs() {
    return this.page.getByTestId('breadcrumbs')
  }

  // ============================================
  // TAB NAVIGATION
  // ============================================

  get contextTab() {
    return this.page.getByRole('tab', { name: /context/i })
  }

  get flowTab() {
    return this.page.getByRole('tab', { name: /flow/i })
  }

  get gitTab() {
    return this.page.getByRole('tab', { name: /git/i })
  }

  get manageTab() {
    return this.page.getByRole('tab', { name: /manage/i })
  }

  // ============================================
  // CONTEXT TAB ELEMENTS
  // ============================================

  get userInputTextarea() {
    return this.page.getByPlaceholder(/describe your task/i).or(
      this.page.getByTestId('user-input-textarea')
    )
  }

  get copyAllButton() {
    return this.page.getByRole('button', { name: /copy all/i })
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

  // File Panel
  get fileSearchInput() {
    return this.page.getByPlaceholder(/search files/i)
  }

  get fileTree() {
    return this.page.getByTestId('file-tree')
  }

  get selectedFilesList() {
    return this.page.getByTestId('selected-files-list')
  }

  // Prompt Panel
  get promptSearchInput() {
    return this.page.getByPlaceholder(/search prompts/i)
  }

  get promptList() {
    return this.page.getByTestId('prompt-list')
  }

  get selectedPromptsList() {
    return this.page.getByTestId('selected-prompts-list')
  }

  // ============================================
  // FLOW TAB ELEMENTS
  // ============================================

  get flowViewSelector() {
    return this.page.getByTestId('flow-view-selector')
  }

  get queuesList() {
    return this.page.getByTestId('queues-list')
  }

  get ticketsList() {
    return this.page.getByTestId('tickets-list')
  }

  get kanbanBoard() {
    return this.page.getByTestId('kanban-board')
  }

  get createTicketButton() {
    return this.page.getByRole('button', { name: /create ticket/i })
  }

  get createQueueButton() {
    return this.page.getByRole('button', { name: /create queue/i })
  }

  // ============================================
  // GIT TAB ELEMENTS
  // ============================================

  get gitStatusSection() {
    return this.page.getByTestId('git-status')
  }

  get gitChangedFiles() {
    return this.page.getByTestId('git-changed-files')
  }

  get gitCommitHistory() {
    return this.page.getByTestId('git-commit-history')
  }

  get gitBranchSelector() {
    return this.page.getByTestId('git-branch-selector')
  }

  get gitStageButton() {
    return this.page.getByRole('button', { name: /stage/i })
  }

  get gitCommitButton() {
    return this.page.getByRole('button', { name: /commit/i })
  }

  // ============================================
  // MANAGE TAB ELEMENTS
  // ============================================

  get projectSettingsForm() {
    return this.page.getByTestId('project-settings-form')
  }

  get projectNameInput() {
    return this.page.getByLabel(/project name/i)
  }

  get projectPathInput() {
    return this.page.getByLabel(/project path/i)
  }

  get deleteProjectButton() {
    return this.page.getByRole('button', { name: /delete project/i })
  }

  get saveSettingsButton() {
    return this.page.getByRole('button', { name: /save/i })
  }

  // ============================================
  // INITIALIZATION STATE
  // ============================================

  get initializingMessage() {
    return this.page.getByText('Initializing Promptliano…', { exact: true })
  }

  get initSubMessage() {
    return this.page.getByText('Preparing workspace and checking for existing projects', { exact: true })
  }

  // ============================================
  // DIALOGS & MODALS
  // ============================================

  get createProjectDialog() {
    return this.page.getByRole('dialog', { name: /create project/i })
  }

  get confirmDeleteDialog() {
    return this.page.getByRole('dialog', { name: /confirm delete/i })
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  async goto(projectId?: number) {
    if (projectId) {
      await this.page.goto(`/projects?projectId=${projectId}`)
    } else {
      await this.page.goto('/projects')
    }
    await this.waitForLoad()
  }

  async gotoWithTab(tab: 'context' | 'flow' | 'git' | 'manage', projectId?: number) {
    const url = projectId 
      ? `/projects?projectId=${projectId}&activeView=${tab}`
      : `/projects?activeView=${tab}`
    await this.page.goto(url)
    await this.waitForLoad()
  }

  async waitForLoad() {
    // Wait for either initialization or main content
    await Promise.race([
      this.initializingMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      this.page.locator('main').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    ])
  }

  // ============================================
  // TAB SWITCHING METHODS
  // ============================================

  async switchToContextTab() {
    await this.contextTab.click()
    await expect(this.userInputTextarea.or(this.fileTree)).toBeVisible({ timeout: 5000 })
  }

  async switchToFlowTab() {
    await this.flowTab.click()
    await expect(this.flowViewSelector.or(this.queuesList).or(this.ticketsList)).toBeVisible({ timeout: 5000 })
  }

  async switchToGitTab() {
    await this.gitTab.click()
    await expect(this.gitStatusSection.or(this.gitChangedFiles)).toBeVisible({ timeout: 5000 })
  }

  async switchToManageTab() {
    await this.manageTab.click()
    await expect(this.projectSettingsForm.or(this.projectNameInput)).toBeVisible({ timeout: 5000 })
  }

  // ============================================
  // CONTEXT TAB METHODS
  // ============================================

  async enterUserInput(text: string) {
    await this.userInputTextarea.fill(text)
  }

  async searchFiles(query: string) {
    await this.fileSearchInput.fill(query)
    await this.page.waitForTimeout(500) // Debounce
  }

  async selectFile(fileName: string) {
    await this.fileTree.getByText(fileName).click()
  }

  async searchPrompts(query: string) {
    await this.promptSearchInput.fill(query)
    await this.page.waitForTimeout(500) // Debounce
  }

  async selectPrompt(promptName: string) {
    await this.promptList.getByText(promptName).click()
  }

  async copyContext() {
    await this.copyAllButton.click()
    // Wait for toast or success indicator
    await this.page.waitForTimeout(1000)
  }

  // ============================================
  // FLOW TAB METHODS
  // ============================================

  async selectFlowView(view: 'queues' | 'tickets' | 'kanban') {
    await this.flowViewSelector.click()
    await this.page.getByRole('option', { name: view }).click()
  }

  async createTicket(title: string, description?: string) {
    await this.createTicketButton.click()
    await this.page.getByLabel(/title/i).fill(title)
    if (description) {
      await this.page.getByLabel(/description/i).fill(description)
    }
    await this.page.getByRole('button', { name: /create/i }).click()
  }

  async createQueue(name: string, description?: string) {
    await this.createQueueButton.click()
    await this.page.getByLabel(/name/i).fill(name)
    if (description) {
      await this.page.getByLabel(/description/i).fill(description)
    }
    await this.page.getByRole('button', { name: /create/i }).click()
  }

  // ============================================
  // GIT TAB METHODS
  // ============================================

  async stageFile(fileName: string) {
    const fileRow = this.gitChangedFiles.getByText(fileName).locator('..')
    await fileRow.getByRole('button', { name: /stage/i }).click()
  }

  async commitChanges(message: string) {
    await this.page.getByPlaceholder(/commit message/i).fill(message)
    await this.gitCommitButton.click()
  }

  async switchBranch(branchName: string) {
    await this.gitBranchSelector.click()
    await this.page.getByRole('option', { name: branchName }).click()
  }

  // ============================================
  // MANAGE TAB METHODS
  // ============================================

  async updateProjectName(newName: string) {
    await this.projectNameInput.clear()
    await this.projectNameInput.fill(newName)
    await this.saveSettingsButton.click()
  }

  async updateProjectPath(newPath: string) {
    await this.projectPathInput.clear()
    await this.projectPathInput.fill(newPath)
    await this.saveSettingsButton.click()
  }

  async deleteProject() {
    await this.deleteProjectButton.click()
    // Wait for confirmation dialog
    await expect(this.confirmDeleteDialog).toBeVisible()
    await this.page.getByRole('button', { name: /confirm/i }).click()
  }

  // ============================================
  // ASSERTION HELPERS
  // ============================================

  async expectInitializationState() {
    await expect(this.initializingMessage).toBeVisible()
    await expect(this.initSubMessage).toBeVisible()
  }

  async expectProjectLoaded(projectName?: string) {
    if (projectName) {
      await expect(this.projectSwitcher).toContainText(projectName)
    }
    await expect(this.page.locator('main')).toBeVisible()
  }

  async expectTabActive(tab: 'context' | 'flow' | 'git' | 'manage') {
    const tabElement = tab === 'context' ? this.contextTab :
                      tab === 'flow' ? this.flowTab :
                      tab === 'git' ? this.gitTab :
                      this.manageTab
    
    await expect(tabElement).toHaveAttribute('data-state', 'active')
  }

  async expectFileSelected(fileName: string) {
    await expect(this.selectedFilesList.getByText(fileName)).toBeVisible()
  }

  async expectPromptSelected(promptName: string) {
    await expect(this.selectedPromptsList.getByText(promptName)).toBeVisible()
  }
}