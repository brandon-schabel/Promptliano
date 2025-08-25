import { type Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class AppPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // Navigation elements
  get sidebar() {
    return this.page.locator('[data-testid="sidebar"], .sidebar, aside')
  }

  get sidebarProjectsLink() {
    return this.page.locator('a[href*="/projects"], nav a:has-text("Projects")')
  }

  get sidebarPromptsLink() {
    return this.page.locator('a[href*="/prompts"], nav a:has-text("Prompts")')
  }

  get sidebarTicketsLink() {
    return this.page.locator('a[href*="/tickets"], nav a:has-text("Tickets")')
  }

  get sidebarQueueLink() {
    return this.page.locator('a[href*="/queue"], nav a:has-text("Queue")')
  }

  get sidebarChatLink() {
    return this.page.locator('a[href*="/chat"], nav a:has-text("Chat")')
  }

  get sidebarSettingsLink() {
    return this.page.locator('a[href*="/settings"], nav a:has-text("Settings")')
  }

  // Command palette
  get commandPalette() {
    return this.page.locator('[data-testid="command-palette"], [cmdk-root]')
  }

  // Global elements
  get header() {
    return this.page.locator('header, [data-testid="header"]')
  }

  get mainContent() {
    return this.page.locator('main, [data-testid="main-content"]')
  }

  get themeToggle() {
    return this.page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"]')
  }

  get userMenu() {
    return this.page.locator('[data-testid="user-menu"], [role="button"][aria-label*="user"]')
  }

  /**
   * Navigate to a specific section using sidebar
   */
  async navigateToSection(section: 'projects' | 'prompts' | 'tickets' | 'queue' | 'chat' | 'settings') {
    const linkMap = {
      projects: this.sidebarProjectsLink,
      prompts: this.sidebarPromptsLink,
      tickets: this.sidebarTicketsLink,
      queue: this.sidebarQueueLink,
      chat: this.sidebarChatLink,
      settings: this.sidebarSettingsLink,
    }

    const link = linkMap[section]
    await link.click()
    await this.waitForLoadingComplete()
    
    // Verify navigation
    await expect(this.page).toHaveURL(new RegExp(section))
  }

  /**
   * Open command palette using keyboard shortcut
   */
  async openCommandPalette() {
    await this.page.keyboard.press('Meta+k') // or Ctrl+k
    await expect(this.commandPalette).toBeVisible()
  }

  /**
   * Use command palette to navigate
   */
  async useCommandPalette(command: string) {
    await this.openCommandPalette()
    await this.page.fill('[cmdk-input], [data-testid="command-input"]', command)
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.press('Enter')
    await this.waitForLoadingComplete()
  }

  /**
   * Toggle theme
   */
  async toggleTheme() {
    await this.themeToggle.click()
    await this.page.waitForTimeout(500) // Wait for theme transition
  }

  /**
   * Check if sidebar is expanded
   */
  async isSidebarExpanded(): Promise<boolean> {
    // This will depend on the actual sidebar implementation
    const sidebar = await this.sidebar
    const className = await sidebar.getAttribute('class')
    return !className?.includes('collapsed') && !className?.includes('minimize')
  }

  /**
   * Toggle sidebar if it's collapsible
   */
  async toggleSidebar() {
    const sidebarToggle = this.page.locator('[data-testid="sidebar-toggle"], button[aria-label*="sidebar"]')
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click()
    }
  }

  /**
   * Wait for the app to be ready
   */
  async waitForAppReady() {
    // Wait for the main layout elements to be visible
    await expect(this.sidebar.or(this.mainContent)).toBeVisible()
    
    // Wait for any initial API calls to complete
    await this.waitForLoadingComplete()
    
    // Check if there are any provider key setup requirements
    const providerSetupNeeded = await this.isElementVisible('[data-testid="provider-setup"], text="Provider Keys"', 1000)
    
    if (providerSetupNeeded) {
      console.log('ℹ️ Provider setup may be required for full functionality')
    }
  }

  /**
   * Get current active navigation item
   */
  async getActiveNavItem(): Promise<string> {
    const activeNav = this.page.locator('nav a[aria-current="page"], nav a.active, nav a[data-active="true"]').first()
    return (await activeNav.textContent()) || ''
  }

  /**
   * Check if user is authenticated/on dashboard
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.isElementVisible('[data-testid="dashboard"], [data-testid="projects-view"]', 2000)
  }

  /**
   * Check for global error states
   */
  async hasGlobalError(): Promise<boolean> {
    return await this.isElementVisible('[data-testid="global-error"], .error-boundary', 1000)
  }

  /**
   * Get the current project name if one is selected
   */
  async getCurrentProjectName(): Promise<string | null> {
    const projectIndicator = this.page.locator('[data-testid="current-project"], .current-project').first()
    if (await projectIndicator.isVisible()) {
      return await projectIndicator.textContent()
    }
    return null
  }

  /**
   * Wait for any ongoing operations to complete
   */
  async waitForOperationsComplete() {
    // Wait for any progress indicators
    await this.page.waitForSelector('[data-testid="progress"], .progress, [role="progressbar"]', {
      state: 'hidden',
      timeout: 30000
    }).catch(() => {
      // Ignore if no progress indicators exist
    })
    
    await this.waitForLoadingComplete()
  }
}