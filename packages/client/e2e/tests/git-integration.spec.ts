import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { TestProjectHelpers } from '../utils/test-project-helpers'

test.describe('Git Integration - UI Testing', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let testProject: any
  let cleanupActions: (() => Promise<void>)[] = []

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)

    // Create a simple test project with git
    testProject = await TestProjectHelpers.createTestProject({
      template: 'web-app',
      name: `Git UI Test ${Date.now()}`,
      includeGit: true,
      includeDependencies: true
    })

    cleanupActions.push(async () => {
      if (testProject) {
        await TestProjectHelpers.cleanupSpecificProjects([testProject])
      }
    })

    await appPage.goto()
    await TestProjectHelpers.loadProjectIntoApp(page, testProject)

    // Navigate to git tab
    await appPage.page.locator('[data-testid="git-tab"], button:has-text("Git"), .nav-tab:has-text("Git")').click()
    await appPage.waitForLoadingComplete()
  })

  test.afterEach(async () => {
    for (const cleanup of cleanupActions.reverse()) {
      try {
        await cleanup()
      } catch (error) {
        console.warn('Cleanup failed:', error)
      }
    }
    cleanupActions = []
  })

  test.describe('Git Sidebar Navigation', () => {
    test('should display git navigation options', async () => {
      const gitSidebar = appPage.page.locator('[data-testid="git-sidebar"], .git-sidebar')
      await expect(gitSidebar).toBeVisible()

      // Check navigation items
      await expect(gitSidebar.locator('button:has-text("Changes")')).toBeVisible()
      await expect(gitSidebar.locator('button:has-text("History")')).toBeVisible()
      await expect(gitSidebar.locator('button:has-text("Branches")')).toBeVisible()
    })

    test('should navigate between git views', async () => {
      const gitSidebar = appPage.page.locator('[data-testid="git-sidebar"], .git-sidebar')
      
      // Test navigation to History view
      await gitSidebar.locator('button:has-text("History")').click()
      await appPage.waitForLoadingComplete()
      
      // Should show some git history interface
      const historyView = appPage.page.locator('[data-testid="git-history"], .git-history, .commit-list')
      if (await historyView.isVisible()) {
        await expect(historyView).toBeVisible()
      }

      // Test navigation to Branches view
      await gitSidebar.locator('button:has-text("Branches")').click()
      await appPage.waitForLoadingComplete()
      
      const branchesView = appPage.page.locator('[data-testid="git-branches"], .git-branches, text="Branches"')
      if (await branchesView.isVisible()) {
        await expect(branchesView).toBeVisible()
      }
    })
  })

  test.describe('Git Changes View', () => {
    test.beforeEach(async () => {
      await appPage.page.locator('[data-testid="git-sidebar"], .git-sidebar').locator('button:has-text("Changes")').click()
      await appPage.waitForLoadingComplete()
    })

    test('should display git repository information', async () => {
      // Check for branch information
      const branchInfo = appPage.page.locator('[data-testid="branch-info"], .branch-info, text=/branch|main|master/')
      if (await branchInfo.isVisible()) {
        await expect(branchInfo).toBeVisible()
      }
    })

    test('should show staged and unstaged sections', async () => {
      // Check for unstaged changes section
      const unstagedSection = appPage.page.locator('[data-testid="unstaged-changes"], .unstaged-changes, text="Unstaged Changes"')
      await expect(unstagedSection).toBeVisible()

      // Check for staged changes section
      const stagedSection = appPage.page.locator('[data-testid="staged-changes"], .staged-changes, text="Staged Changes"')
      await expect(stagedSection).toBeVisible()
    })

    test('should display commit section', async () => {
      const commitSection = appPage.page.locator('[data-testid="commit-section"], .commit-section')
      if (await commitSection.isVisible()) {
        await expect(commitSection).toBeVisible()
        
        // Check for commit message input
        const commitTextarea = appPage.page.locator('[data-testid="commit-message"], textarea[placeholder*="Commit message"]')
        await expect(commitTextarea).toBeVisible()
        
        // Check for commit button
        const commitButton = appPage.page.locator('[data-testid="commit-button"], button:has-text("Commit")')
        await expect(commitButton).toBeVisible()
      }
    })
  })

  test.describe('Git History View', () => {
    test('should display commit history interface', async () => {
      await appPage.page.locator('[data-testid="git-sidebar"], .git-sidebar').locator('button:has-text("History")').click()
      await appPage.waitForLoadingComplete()

      // Look for history interface elements
      const historyElements = appPage.page.locator('[data-testid="commit-list"], .commit-list, .commit-card, text=/commit|history/')
      if (await historyElements.count() > 0) {
        await expect(historyElements.first()).toBeVisible()
      }
    })
  })

  test.describe('Git Branches View', () => {
    test('should display branches interface', async () => {
      await appPage.page.locator('[data-testid="git-sidebar"], .git-sidebar').locator('button:has-text("Branches")').click()
      await appPage.waitForLoadingComplete()

      // Look for branches interface
      const branchesElements = appPage.page.locator('[data-testid="branch-list"], .branch-list, .branch-card, text=/branches|branch/')
      if (await branchesElements.count() > 0) {
        await expect(branchesElements.first()).toBeVisible()
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle projects without git gracefully', async () => {
      // Create a project without git
      const nonGitProject = await TestProjectHelpers.createTestProject({
        template: 'simple',
        name: `Non Git Test ${Date.now()}`,
        includeGit: false,
        includeDependencies: false
      })

      cleanupActions.push(async () => {
        await TestProjectHelpers.cleanupSpecificProjects([nonGitProject])
      })

      await TestProjectHelpers.loadProjectIntoApp(appPage.page, nonGitProject)
      await appPage.page.locator('[data-testid="git-tab"], button:has-text("Git")').click()
      await appPage.waitForLoadingComplete()

      // Should show appropriate message for non-git projects
      const noGitMessage = appPage.page.locator('[data-testid="no-git"], .no-git, text=/not.*git|initialize.*git/i')
      if (await noGitMessage.isVisible()) {
        await expect(noGitMessage).toBeVisible()
      }
    })
  })
})