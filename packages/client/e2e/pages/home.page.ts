/**
 * Home/Index Page Object Model
 * 
 * Represents the landing page and initial user experience, including
 * dashboard overview, quick actions, recent activity, and navigation.
 */

import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // ============================================
  // HEADER & NAVIGATION
  // ============================================

  get logo() {
    return this.page.locator('[data-testid="app-logo"], .app-logo, a[href="/"]').first()
  }

  get headerTitle() {
    return this.page.locator('[data-testid="app-title"], h1').first()
  }

  get userMenu() {
    return this.page.locator('[data-testid="user-menu"], button[aria-label*="user" i]')
  }

  get mainNavigation() {
    return this.page.locator('[data-testid="main-nav"], nav[role="navigation"]').first()
  }

  // Navigation links
  get projectsLink() {
    return this.page.locator('[data-testid="nav-projects"], a[href*="projects"]').first()
  }

  get chatLink() {
    return this.page.locator('[data-testid="nav-chat"], a[href*="chat"]').first()
  }

  get promptsLink() {
    return this.page.locator('[data-testid="nav-prompts"], a[href*="prompts"]').first()
  }

  get settingsLink() {
    return this.page.locator('[data-testid="nav-settings"], a[href*="settings"]').first()
  }

  // ============================================
  // DASHBOARD OVERVIEW
  // ============================================

  get dashboardContainer() {
    return this.page.locator('[data-testid="dashboard"], .dashboard-container').first()
  }

  get welcomeMessage() {
    return this.page.locator('[data-testid="welcome-message"], h2:has-text("Welcome")').first()
  }

  get statsContainer() {
    return this.page.locator('[data-testid="stats-container"], .stats-overview')
  }

  get projectCount() {
    return this.page.locator('[data-testid="project-count"], .stat-card:has-text("Projects")')
  }

  get chatCount() {
    return this.page.locator('[data-testid="chat-count"], .stat-card:has-text("Chats")')
  }

  get promptCount() {
    return this.page.locator('[data-testid="prompt-count"], .stat-card:has-text("Prompts")')
  }

  // ============================================
  // QUICK ACTIONS
  // ============================================

  get quickActionsSection() {
    return this.page.locator('[data-testid="quick-actions"], .quick-actions')
  }

  get newProjectButton() {
    return this.page.locator('[data-testid="new-project-btn"], button:has-text("New Project")')
  }

  get newChatButton() {
    return this.page.locator('[data-testid="new-chat-btn"], button:has-text("New Chat")')
  }

  get createPromptButton() {
    return this.page.locator('[data-testid="create-prompt-btn"], button:has-text("Create Prompt")')
  }

  get importButton() {
    return this.page.locator('[data-testid="import-btn"], button:has-text("Import")')
  }

  // ============================================
  // RECENT ACTIVITY
  // ============================================

  get recentActivitySection() {
    return this.page.locator('[data-testid="recent-activity"], .recent-activity')
  }

  get recentProjects() {
    return this.page.locator('[data-testid="recent-projects"], .recent-projects-list')
  }

  get recentChats() {
    return this.page.locator('[data-testid="recent-chats"], .recent-chats-list')
  }

  get recentPrompts() {
    return this.page.locator('[data-testid="recent-prompts"], .recent-prompts-list')
  }

  get activityItems() {
    return this.page.locator('[data-testid="activity-item"], .activity-item')
  }

  // ============================================
  // ONBOARDING ELEMENTS
  // ============================================

  get onboardingBanner() {
    return this.page.locator('[data-testid="onboarding-banner"], .onboarding-welcome')
  }

  get getStartedButton() {
    return this.page.locator('[data-testid="get-started"], button:has-text("Get Started")')
  }

  get skipOnboardingButton() {
    return this.page.locator('[data-testid="skip-onboarding"], button:has-text("Skip")')
  }

  get onboardingProgress() {
    return this.page.locator('[data-testid="onboarding-progress"], .progress-indicator')
  }

  get tutorialCards() {
    return this.page.locator('[data-testid="tutorial-card"], .tutorial-card')
  }

  // ============================================
  // SIDEBAR
  // ============================================

  get sidebar() {
    return this.page.locator('[data-testid="sidebar"], aside[role="navigation"]')
  }

  get sidebarToggle() {
    return this.page.locator('[data-testid="sidebar-toggle"], button[aria-label*="menu" i]')
  }

  get sidebarProjects() {
    return this.page.locator('[data-testid="sidebar-projects"], .sidebar-projects')
  }

  get sidebarRecent() {
    return this.page.locator('[data-testid="sidebar-recent"], .sidebar-recent')
  }

  // ============================================
  // EMPTY STATES
  // ============================================

  get emptyState() {
    return this.page.locator('[data-testid="empty-state"], .empty-state')
  }

  get noProjectsMessage() {
    return this.page.locator(':text("No projects"), :text("Create your first project")')
  }

  get noActivityMessage() {
    return this.page.locator(':text("No recent activity"), :text("Start by creating")')
  }

  // ============================================
  // METHODS
  // ============================================

  /**
   * Navigate to home page
   */
  async goto() {
    await this.page.goto('/')
    await this.waitForLoadingComplete()
  }

  /**
   * Check if user is on home/landing page
   */
  async isOnHomePage(): Promise<boolean> {
    const url = this.page.url()
    return url.endsWith('/') || url.includes('/projects') || url.includes('/dashboard')
  }

  /**
   * Navigate using quick action
   */
  async useQuickAction(action: 'project' | 'chat' | 'prompt') {
    switch (action) {
      case 'project':
        await this.newProjectButton.click()
        break
      case 'chat':
        await this.newChatButton.click()
        break
      case 'prompt':
        await this.createPromptButton.click()
        break
    }
    await this.waitForLoadingComplete()
  }

  /**
   * Navigate to section via main navigation
   */
  async navigateToSection(section: 'projects' | 'chat' | 'prompts' | 'settings') {
    switch (section) {
      case 'projects':
        await this.projectsLink.click()
        break
      case 'chat':
        await this.chatLink.click()
        break
      case 'prompts':
        await this.promptsLink.click()
        break
      case 'settings':
        await this.settingsLink.click()
        break
    }
    await this.waitForLoadingComplete()
  }

  /**
   * Get recent activity count
   */
  async getRecentActivityCount(): Promise<number> {
    const items = await this.activityItems.all()
    return items.length
  }

  /**
   * Check if onboarding is shown
   */
  async isOnboardingVisible(): Promise<boolean> {
    return await this.onboardingBanner.isVisible().catch(() => false)
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding() {
    if (await this.isOnboardingVisible()) {
      await this.getStartedButton.click()
      // Handle onboarding steps
      await this.waitForLoadingComplete()
    }
  }

  /**
   * Skip onboarding
   */
  async skipOnboarding() {
    if (await this.skipOnboardingButton.isVisible()) {
      await this.skipOnboardingButton.click()
      await this.waitForLoadingComplete()
    }
  }

  /**
   * Toggle sidebar
   */
  async toggleSidebar() {
    await this.sidebarToggle.click()
    await this.page.waitForTimeout(300) // Animation
  }

  /**
   * Check if sidebar is visible
   */
  async isSidebarVisible(): Promise<boolean> {
    return await this.sidebar.isVisible()
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{
    projects?: number
    chats?: number
    prompts?: number
  }> {
    const stats: any = {}

    if (await this.projectCount.isVisible()) {
      const text = await this.projectCount.textContent()
      const match = text?.match(/\d+/)
      if (match) stats.projects = parseInt(match[0])
    }

    if (await this.chatCount.isVisible()) {
      const text = await this.chatCount.textContent()
      const match = text?.match(/\d+/)
      if (match) stats.chats = parseInt(match[0])
    }

    if (await this.promptCount.isVisible()) {
      const text = await this.promptCount.textContent()
      const match = text?.match(/\d+/)
      if (match) stats.prompts = parseInt(match[0])
    }

    return stats
  }

  /**
   * Open recent item
   */
  async openRecentItem(index: number = 0) {
    const items = await this.activityItems.all()
    if (items[index]) {
      await items[index].click()
      await this.waitForLoadingComplete()
    }
  }

  /**
   * Search from home page
   */
  async searchFromHome(query: string) {
    // Look for global search
    const searchInput = this.page.locator('[data-testid="global-search"], input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(query)
      await searchInput.press('Enter')
      await this.waitForLoadingComplete()
    }
  }

  /**
   * Check if empty state is shown
   */
  async hasEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible()
  }

  /**
   * Get tutorial cards count
   */
  async getTutorialCardsCount(): Promise<number> {
    if (await this.tutorialCards.first().isVisible()) {
      return await this.tutorialCards.count()
    }
    return 0
  }

  /**
   * Open user menu
   */
  async openUserMenu() {
    if (await this.userMenu.isVisible()) {
      await this.userMenu.click()
      await this.page.waitForTimeout(200)
    }
  }

  /**
   * Sign out from user menu
   */
  async signOut() {
    await this.openUserMenu()
    const signOutButton = this.page.locator(':text("Sign Out"), :text("Logout")')
    if (await signOutButton.isVisible()) {
      await signOutButton.click()
      await this.waitForLoadingComplete()
    }
  }

  /**
   * Verify page is loaded
   */
  async waitForHomePageLoad() {
    // Wait for either dashboard or projects page (since home redirects)
    await Promise.race([
      this.dashboardContainer.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.page.locator('.projects-container').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.page.waitForURL(/\/(projects|dashboard)/, { timeout: 10000 }).catch(() => {})
    ])
    await this.waitForLoadingComplete()
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    // Check for user menu or auth indicators
    const hasUserMenu = await this.userMenu.isVisible().catch(() => false)
    const hasSignOut = await this.page.locator(':text("Sign Out")').isVisible().catch(() => false)
    return hasUserMenu || hasSignOut
  }
}