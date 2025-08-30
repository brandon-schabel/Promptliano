import { type Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class TicketsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Ticket list elements
  get ticketsContainer() {
    return this.page.locator('[data-testid="tickets-container"], .tickets-container')
  }

  get ticketCards() {
    return this.page.locator('[data-testid="ticket-card"], .ticket-card')
  }

  get emptyState() {
    return this.page.locator('[data-testid="no-tickets"], text="No tickets found"')
  }

  // Ticket actions
  get createTicketButton() {
    return this.page.locator(
      '[data-testid="create-ticket"], button:has-text("New Ticket"), button:has-text("Create Ticket")'
    )
  }

  // Ticket dialog/form elements
  get ticketDialog() {
    return this.page.locator('[role="dialog"], [data-testid="ticket-dialog"]')
  }

  get ticketTitleInput() {
    return this.page.locator('input[name="title"], input[placeholder*="ticket title" i]')
  }

  get ticketOverviewTextarea() {
    // Changed from description to overview to match schema
    return this.page.locator(
      'textarea[name="overview"], textarea[name="description"], [data-testid="ticket-overview"], [data-testid="ticket-description"]'
    )
  }

  get ticketPrioritySelect() {
    return this.page.locator('select[name="priority"], [data-testid="priority-select"]')
  }

  get ticketProjectSelect() {
    return this.page.locator('select[name="projectId"], [data-testid="project-select"]')
  }

  get submitTicketButton() {
    return this.page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
  }

  get cancelTicketButton() {
    return this.page.locator('button:has-text("Cancel")')
  }

  // Task management within ticket
  get tasksSection() {
    return this.page.locator('[data-testid="ticket-tasks"], .ticket-tasks')
  }

  get addTaskButton() {
    return this.page.locator('[data-testid="add-task"], button:has-text("Add Task")')
  }

  get taskInput() {
    return this.page.locator('input[name="task"], input[placeholder*="task" i]')
  }

  get taskItems() {
    return this.page.locator('[data-testid="task-item"], .task-item')
  }

  // Ticket card actions
  getTicketCard(ticketTitle: string) {
    return this.page.locator(
      `[data-testid="ticket-card"]:has-text("${ticketTitle}"), .ticket-card:has-text("${ticketTitle}")`
    )
  }

  getTicketCardMenu(ticketTitle: string) {
    return this.getTicketCard(ticketTitle).locator('[data-testid="ticket-menu"], button[aria-label*="menu"]')
  }

  get ticketMenuEdit() {
    return this.page.locator('[data-testid="edit-ticket"], text="Edit"')
  }

  get ticketMenuDelete() {
    return this.page.locator('[data-testid="delete-ticket"], text="Delete"')
  }

  get ticketMenuAddToQueue() {
    return this.page.locator('[data-testid="add-to-queue"], text="Add to Queue"')
  }

  get ticketMenuAssignAgent() {
    return this.page.locator('[data-testid="assign-agent"], text="Assign Agent"')
  }

  // Status and filters
  get statusFilter() {
    return this.page.locator('[data-testid="status-filter"], select[name="status-filter"]')
  }

  get priorityFilter() {
    return this.page.locator('[data-testid="priority-filter"], select[name="priority-filter"]')
  }

  get projectFilter() {
    return this.page.locator('[data-testid="project-filter"], select[name="project-filter"]')
  }

  get searchInput() {
    return this.page.locator('[data-testid="ticket-search"], input[placeholder*="search" i]')
  }

  /**
   * Navigate to tickets page
   */
  async goto() {
    await super.goto('/tickets')
  }

  /**
   * Create a new ticket with tasks
   */
  async createTicket(ticketData: {
    title: string
    overview?: string // Changed from description to overview to match schema
    priority?: 'low' | 'normal' | 'high' // Removed 'urgent' as it's not in schema
    projectId?: number
    tasks?: string[]
  }) {
    await this.createTicketButton.click()
    await expect(this.ticketDialog).toBeVisible()

    // Fill ticket details
    await this.ticketTitleInput.fill(ticketData.title)

    if (ticketData.overview) {
      await this.ticketOverviewTextarea.fill(ticketData.overview) // Updated method name
    }

    if (ticketData.priority) {
      await this.ticketPrioritySelect.selectOption(ticketData.priority)
    }

    if (ticketData.projectId) {
      await this.ticketProjectSelect.selectOption(ticketData.projectId.toString())
    }

    // Add tasks if provided
    if (ticketData.tasks && ticketData.tasks.length > 0) {
      for (const taskText of ticketData.tasks) {
        await this.addTask(taskText)
      }
    }

    // Submit the form
    await this.submitTicketButton.click()

    // Wait for ticket creation
    await this.waitForAPIResponse(/\/api\/tickets/, 'POST')
    await this.waitForLoadingComplete()

    // Verify ticket was created
    await expect(this.getTicketCard(ticketData.title)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Add a task to the current ticket being created/edited
   */
  async addTask(taskText: string) {
    await this.addTaskButton.click()

    const taskInputs = this.taskInput
    const lastInput = taskInputs.last()
    await lastInput.fill(taskText)

    // Press Enter or Tab to confirm the task
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(300) // Wait for task to be added
  }

  /**
   * Edit an existing ticket
   */
  async editTicket(
    currentTitle: string,
    updates: {
      title?: string
      overview?: string // Changed from description to overview to match schema
      priority?: string
      status?: string
    }
  ) {
    await this.openTicketMenu(currentTitle)
    await this.ticketMenuEdit.click()

    await expect(this.ticketDialog).toBeVisible()

    if (updates.title) {
      await this.ticketTitleInput.fill(updates.title)
    }

    if (updates.overview) {
      await this.ticketOverviewTextarea.fill(updates.overview) // Updated method name
    }

    if (updates.priority) {
      await this.ticketPrioritySelect.selectOption(updates.priority)
    }

    await this.submitTicketButton.click()
    await this.waitForAPIResponse(/\/api\/tickets/, 'PUT')
    await this.waitForLoadingComplete()
  }

  /**
   * Delete a ticket
   */
  async deleteTicket(ticketTitle: string) {
    await this.openTicketMenu(ticketTitle)
    await this.ticketMenuDelete.click()

    // Handle confirmation dialog
    await this.handleConfirmationDialog('accept')

    // Wait for deletion
    await this.waitForAPIResponse(/\/api\/tickets/, 'DELETE')
    await this.waitForLoadingComplete()

    // Verify ticket was deleted
    await expect(this.getTicketCard(ticketTitle)).not.toBeVisible()
  }

  /**
   * Open a ticket for detailed view
   */
  async openTicket(ticketTitle: string) {
    await this.getTicketCard(ticketTitle).click()
    await this.waitForLoadingComplete()

    // Should navigate to ticket detail view
    await expect(this.page).toHaveURL(new RegExp('/tickets/\\d+'))
  }

  /**
   * Open ticket menu
   */
  async openTicketMenu(ticketTitle: string) {
    const ticketCard = this.getTicketCard(ticketTitle)
    await expect(ticketCard).toBeVisible()

    // Hover to reveal menu button
    await ticketCard.hover()

    const menuButton = this.getTicketCardMenu(ticketTitle)
    await menuButton.click()

    // Wait for menu to appear
    await expect(this.ticketMenuEdit).toBeVisible()
  }

  /**
   * Add ticket to queue
   */
  async addTicketToQueue(ticketTitle: string, queueName?: string) {
    await this.openTicketMenu(ticketTitle)
    await this.ticketMenuAddToQueue.click()

    if (queueName) {
      // Select specific queue if multiple options
      const queueOption = this.page.locator(`text="${queueName}", [data-testid="queue-${queueName}"]`)
      await queueOption.click()
    }

    // Wait for queue addition
    await this.waitForAPIResponse(/\/api\/queues\/.*\/items/, 'POST')
    await this.waitForLoadingComplete()
  }

  /**
   * Assign agent to ticket
   */
  async assignAgentToTicket(ticketTitle: string, agentName: string) {
    await this.openTicketMenu(ticketTitle)
    await this.ticketMenuAssignAgent.click()

    // Select agent from list
    const agentOption = this.page.locator(`text="${agentName}", [data-testid="agent-${agentName}"]`)
    await agentOption.click()

    await this.waitForAPIResponse(/\/api\/tickets/, 'PUT')
    await this.waitForLoadingComplete()
  }

  /**
   * Filter tickets by status
   */
  async filterByStatus(status: 'open' | 'in-progress' | 'completed' | 'cancelled') {
    await this.statusFilter.selectOption(status)
    await this.waitForLoadingComplete()
  }

  /**
   * Filter tickets by priority
   */
  async filterByPriority(priority: 'low' | 'normal' | 'high' | 'urgent') {
    await this.priorityFilter.selectOption(priority)
    await this.waitForLoadingComplete()
  }

  /**
   * Filter tickets by project
   */
  async filterByProject(projectId: number) {
    await this.projectFilter.selectOption(projectId.toString())
    await this.waitForLoadingComplete()
  }

  /**
   * Search tickets
   */
  async searchTickets(query: string) {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.waitForLoadingComplete()
  }

  /**
   * Get all visible ticket titles
   */
  async getVisibleTicketTitles(): Promise<string[]> {
    const cards = this.ticketCards
    const count = await cards.count()
    const titles: string[] = []

    for (let i = 0; i < count; i++) {
      const title = await cards.nth(i).locator('[data-testid="ticket-title"], .ticket-title').textContent()
      if (title) titles.push(title.trim())
    }

    return titles
  }

  /**
   * Check if ticket exists
   */
  async ticketExists(ticketTitle: string): Promise<boolean> {
    return await this.getTicketCard(ticketTitle).isVisible()
  }

  /**
   * Get ticket information
   */
  async getTicketInfo(ticketTitle: string) {
    const card = this.getTicketCard(ticketTitle)
    await expect(card).toBeVisible()

    const title = await card.locator('[data-testid="ticket-title"], .ticket-title').textContent()
    const description = await card.locator('[data-testid="ticket-description"], .ticket-description').textContent()
    const priority = await card.locator('[data-testid="ticket-priority"], .ticket-priority').textContent()
    const status = await card.locator('[data-testid="ticket-status"], .ticket-status').textContent()
    const assignee = await card.locator('[data-testid="ticket-assignee"], .ticket-assignee').textContent()
    const taskCount = await card.locator('[data-testid="task-count"], .task-count').textContent()

    return {
      title: title?.trim() || '',
      description: description?.trim() || '',
      priority: priority?.trim() || '',
      status: status?.trim() || '',
      assignee: assignee?.trim() || '',
      taskCount: taskCount?.trim() || '0'
    }
  }

  /**
   * Toggle task completion in ticket detail view
   */
  async toggleTask(taskText: string) {
    const taskItem = this.page.locator(
      `[data-testid="task-item"]:has-text("${taskText}"), .task-item:has-text("${taskText}")`
    )
    const checkbox = taskItem.locator('input[type="checkbox"], [data-testid="task-checkbox"]')
    await checkbox.click()

    await this.waitForAPIResponse(/\/api\/tasks/, 'PUT')
  }

  /**
   * Wait for tickets to load
   */
  async waitForTicketsLoaded() {
    await expect(this.ticketCards.first().or(this.emptyState)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Get ticket count
   */
  async getTicketCount(): Promise<number> {
    if (await this.emptyState.isVisible()) {
      return 0
    }
    return await this.ticketCards.count()
  }

  /**
   * Check if in empty state
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible()
  }

  /**
   * Get tickets by status
   */
  async getTicketsByStatus(status: string): Promise<string[]> {
    const tickets = await this.ticketCards.all()
    const filteredTitles: string[] = []

    for (const ticket of tickets) {
      const ticketStatus = await ticket.locator('[data-testid="ticket-status"], .ticket-status').textContent()
      if (ticketStatus?.trim().toLowerCase() === status.toLowerCase()) {
        const title = await ticket.locator('[data-testid="ticket-title"], .ticket-title').textContent()
        if (title) filteredTitles.push(title.trim())
      }
    }

    return filteredTitles
  }
}
