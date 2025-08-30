import { type Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class SidebarPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Main sidebar container
  get sidebar() {
    return this.page.locator('[data-testid="sidebar-container"], [data-sidebar="sidebar"]')
  }

  get sidebarHeader() {
    return this.page.locator('[data-testid="sidebar-header"]')
  }

  get sidebarContent() {
    return this.page.locator('[data-sidebar="content"]')
  }

  get sidebarFooter() {
    return this.page.locator('[data-sidebar="footer"]')
  }

  // Navigation items
  get projectsNavItem() {
    return this.page.locator('[data-testid="sidebar-nav-projects"]')
  }

  get chatNavItem() {
    return this.page.locator('[data-testid="sidebar-nav-chat"]')
  }

  get promptsNavItem() {
    return this.page.locator('[data-testid="sidebar-nav-prompts"]')
  }

  get providersNavItem() {
    return this.page.locator('[data-testid="sidebar-nav-providers"]')
  }

  get settingsNavItem() {
    return this.page.locator('[data-testid="sidebar-nav-settings"]')
  }

  // Footer actions
  get manageProjectsButton() {
    return this.page.locator('[data-testid="sidebar-manage-projects"]')
  }

  get recentProjectsSection() {
    return this.page.locator('[data-testid="sidebar-recent-projects"]')
  }

  // Sidebar state and interactions
  get sidebarToggle() {
    return this.page.locator('[data-testid="sidebar-toggle"], button[aria-label*="sidebar"]')
  }

  get sidebarRail() {
    return this.page.locator('[data-sidebar="rail"]')
  }

  /**
   * Navigate to a section using the sidebar
   */
  async navigateToSection(section: 'projects' | 'chat' | 'prompts' | 'providers' | 'settings') {
    const navMap = {
      projects: this.projectsNavItem,
      chat: this.chatNavItem,
      prompts: this.promptsNavItem,
      providers: this.providersNavItem,
      settings: this.settingsNavItem
    }

    const navItem = navMap[section]
    await navItem.click()
    await this.waitForLoadingComplete()

    // Verify navigation occurred
    await expect(this.page).toHaveURL(new RegExp(section))
  }

  /**
   * Check if sidebar is expanded
   */
  async isSidebarExpanded(): Promise<boolean> {
    const sidebar = this.sidebar
    const state = await sidebar.getAttribute('data-state')
    const collapsible = await sidebar.getAttribute('data-collapsible')

    // Check if sidebar is in collapsed state
    return state !== 'collapsed' && collapsible !== 'icon'
  }

  /**
   * Toggle sidebar collapsed/expanded state
   */
  async toggleSidebar() {
    if (await this.sidebarToggle.isVisible()) {
      await this.sidebarToggle.click()
      await this.page.waitForTimeout(200) // Wait for transition
    } else {
      // Try clicking on rail to expand
      if (await this.sidebarRail.isVisible()) {
        await this.sidebarRail.click()
        await this.page.waitForTimeout(200)
      }
    }
  }

  /**
   * Open the manage projects dialog
   */
  async openManageProjects() {
    await this.manageProjectsButton.click()

    // Wait for dialog to appear
    const projectDialog = this.page.locator('[role="dialog"]')
    await expect(projectDialog).toBeVisible()

    return projectDialog
  }

  /**
   * Select a recent project
   */
  async selectRecentProject(projectName: string) {
    const recentProjectLink = this.recentProjectsSection.locator(`text="${projectName}"`).first()
    await expect(recentProjectLink).toBeVisible()
    await recentProjectLink.click()
    await this.waitForLoadingComplete()
  }

  /**
   * Get all navigation items that are currently visible
   */
  async getVisibleNavItems(): Promise<string[]> {
    const navItems = [
      { name: 'projects', locator: this.projectsNavItem },
      { name: 'chat', locator: this.chatNavItem },
      { name: 'prompts', locator: this.promptsNavItem },
      { name: 'providers', locator: this.providersNavItem },
      { name: 'settings', locator: this.settingsNavItem }
    ]

    const visibleItems: string[] = []

    for (const item of navItems) {
      if (await item.locator.isVisible()) {
        visibleItems.push(item.name)
      }
    }

    return visibleItems
  }

  /**
   * Get the currently active navigation item
   */
  async getActiveNavItem(): Promise<string | null> {
    const activeSelectors = ['[data-state="active"]', '[aria-current="page"]', '.active', '[data-active="true"]']

    for (const selector of activeSelectors) {
      const activeElement = this.sidebar.locator(selector).first()
      if (await activeElement.isVisible()) {
        return await activeElement.textContent()
      }
    }

    return null
  }

  /**
   * Check if recent projects section is visible
   */
  async hasRecentProjects(): Promise<boolean> {
    return await this.recentProjectsSection.isVisible()
  }

  /**
   * Get list of recent project names
   */
  async getRecentProjectNames(): Promise<string[]> {
    if (!(await this.hasRecentProjects())) {
      return []
    }

    const projectLinks = this.recentProjectsSection.locator('span:last-child')
    const count = await projectLinks.count()
    const names: string[] = []

    for (let i = 0; i < count; i++) {
      const name = await projectLinks.nth(i).textContent()
      if (name) {
        names.push(name.trim())
      }
    }

    return names
  }

  /**
   * Verify sidebar structure and elements
   */
  async verifySidebarStructure() {
    // Check main components exist
    await expect(this.sidebar).toBeVisible()
    await expect(this.sidebarHeader).toBeVisible()
    await expect(this.sidebarContent).toBeVisible()
    await expect(this.sidebarFooter).toBeVisible()

    // Check core navigation items
    await expect(this.projectsNavItem).toBeVisible()
    await expect(this.chatNavItem).toBeVisible()
    await expect(this.promptsNavItem).toBeVisible()
    await expect(this.providersNavItem).toBeVisible()

    // Check footer actions
    await expect(this.manageProjectsButton).toBeVisible()
    await expect(this.settingsNavItem).toBeVisible()
  }

  /**
   * Wait for sidebar to be fully loaded and interactive
   */
  async waitForSidebarReady() {
    await expect(this.sidebar).toBeVisible()
    await expect(this.projectsNavItem).toBeVisible()
    await this.waitForLoadingComplete()

    // Ensure sidebar is interactive
    await expect(this.projectsNavItem).toBeEnabled()
  }

  /**
   * Check for responsive behavior at different screen sizes
   */
  async testResponsiveBehavior() {
    // Desktop - sidebar should be visible
    await this.page.setViewportSize({ width: 1200, height: 800 })
    await expect(this.sidebar).toBeVisible()

    // Tablet - sidebar might be collapsible
    await this.page.setViewportSize({ width: 768, height: 1024 })
    await this.page.waitForTimeout(300) // Allow for responsive changes

    // Mobile - sidebar should be toggleable or hidden
    await this.page.setViewportSize({ width: 375, height: 667 })
    await this.page.waitForTimeout(300)

    // Reset to desktop
    await this.page.setViewportSize({ width: 1200, height: 800 })
    await this.page.waitForTimeout(300)
  }
}
