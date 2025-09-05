import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../../pages/projects.page'
import { ProjectHelpers } from '../../helpers/project-helpers'
import { generateUniqueProject } from '../../fixtures/project-data'

test.describe('Projects - Navigation Tests', () => {
  let projectsPage: ProjectsPage
  let createdProjectIds: number[] = []

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup created projects
    if (createdProjectIds.length > 0) {
      await ProjectHelpers.cleanupTestData(page, createdProjectIds)
      createdProjectIds = []
    }
  })

  test('should navigate to projects page and show initialization or content', async ({ page }) => {
    await projectsPage.goto()
    
    // Check if we're initializing or have content
    const isInitializing = await ProjectHelpers.isInitializing(page)
    
    if (isInitializing) {
      await projectsPage.expectInitializationState()
      console.log('✅ Projects page is in initialization state')
    } else {
      await expect(page.locator('main')).toBeVisible()
      console.log('✅ Projects page loaded with content')
    }
    
    // Verify sidebar is present
    await expect(projectsPage.projectsButton).toBeVisible()
    await expect(page.getByText('Chat')).toBeVisible()
    await expect(page.getByText('Prompts')).toBeVisible()
    await expect(page.getByText('Providers')).toBeVisible()
  })

  test('should navigate between different tabs', async ({ page }) => {
    await projectsPage.goto()
    await ProjectHelpers.waitForInitialization(page)
    
    // Check if tabs are visible (they might not be if no project is selected)
    const contextTabVisible = await projectsPage.contextTab.isVisible()
    
    if (!contextTabVisible) {
      console.log('ℹ️ Tabs not visible - likely no project selected')
      return
    }
    
    // Test tab navigation
    await test.step('Navigate to Context tab', async () => {
      await projectsPage.switchToContextTab()
      await projectsPage.expectTabActive('context')
      expect(page.url()).toContain('activeView=context')
    })
    
    await test.step('Navigate to Flow tab', async () => {
      await projectsPage.switchToFlowTab()
      await projectsPage.expectTabActive('flow')
      expect(page.url()).toContain('activeView=flow')
    })
    
    await test.step('Navigate to Git tab', async () => {
      await projectsPage.switchToGitTab()
      await projectsPage.expectTabActive('git')
      expect(page.url()).toContain('activeView=git')
    })
    
    await test.step('Navigate to Manage tab', async () => {
      await projectsPage.switchToManageTab()
      await projectsPage.expectTabActive('manage')
      expect(page.url()).toContain('activeView=manage')
    })
  })

  test('should navigate with URL parameters', async ({ page }) => {
    // Test direct navigation with tab parameter
    await projectsPage.gotoWithTab('flow')
    
    const url = new URL(page.url())
    expect(url.searchParams.get('activeView')).toBe('flow')
    
    // Navigate to different tab via URL
    await projectsPage.gotoWithTab('git')
    expect(page.url()).toContain('activeView=git')
  })

  test('should navigate to other pages from projects', async ({ page }) => {
    await projectsPage.goto()
    
    // Navigate to Chat
    await page.getByText('Chat').click()
    await page.waitForURL('**/chat')
    expect(page.url()).toContain('/chat')
    
    // Navigate back to Projects
    await projectsPage.projectsButton.click()
    await page.waitForURL('**/projects')
    expect(page.url()).toContain('/projects')
    
    // Navigate to Providers
    await page.getByText('Providers').click()
    await page.waitForURL('**/providers')
    expect(page.url()).toContain('/providers')
    
    // Return to Projects
    await projectsPage.projectsButton.click()
    expect(page.url()).toContain('/projects')
  })

  test('should handle project selection if available', async ({ page }) => {
    // This test depends on whether projects exist
    await projectsPage.goto()
    await ProjectHelpers.waitForInitialization(page)
    
    // Check if project switcher is visible
    const switcher = projectsPage.projectSwitcher
    const switcherVisible = await switcher.isVisible()
    
    if (switcherVisible) {
      await switcher.click()
      
      // Check if there are any projects in the dropdown
      const projectOptions = page.getByRole('option')
      const optionCount = await projectOptions.count()
      
      if (optionCount > 0) {
        // Select first project
        await projectOptions.first().click()
        
        // Verify URL updated with project ID
        await page.waitForTimeout(1000)
        const projectId = await ProjectHelpers.getCurrentProjectId(page)
        expect(projectId).toBeTruthy()
        
        console.log(`✅ Selected project with ID: ${projectId}`)
      } else {
        console.log('ℹ️ No projects available to select')
      }
    } else {
      console.log('ℹ️ Project switcher not visible - likely in initialization')
    }
  })

  test('should preserve tab selection when navigating', async ({ page }) => {
    await projectsPage.goto()
    await ProjectHelpers.waitForInitialization(page)
    
    // Check if tabs are available
    const flowTabVisible = await projectsPage.flowTab.isVisible()
    
    if (!flowTabVisible) {
      console.log('ℹ️ Tabs not available - skipping tab preservation test')
      return
    }
    
    // Navigate to Flow tab
    await projectsPage.switchToFlowTab()
    const flowUrl = page.url()
    
    // Navigate away
    await page.getByText('Chat').click()
    await page.waitForURL('**/chat')
    
    // Navigate back using browser back
    await page.goBack()
    await page.waitForURL('**/projects')
    
    // Check if we're still on flow tab
    expect(page.url()).toContain('activeView=flow')
    await projectsPage.expectTabActive('flow')
  })

  test('should handle breadcrumb navigation if available', async ({ page }) => {
    await projectsPage.goto()
    await ProjectHelpers.waitForInitialization(page)
    
    const breadcrumbs = projectsPage.breadcrumbs
    const breadcrumbsVisible = await breadcrumbs.isVisible()
    
    if (breadcrumbsVisible) {
      // Click on breadcrumb items
      const breadcrumbItems = breadcrumbs.locator('a, button')
      const itemCount = await breadcrumbItems.count()
      
      if (itemCount > 0) {
        // Click first breadcrumb (usually home/projects)
        await breadcrumbItems.first().click()
        await page.waitForTimeout(500)
        
        // Verify we're still on projects page
        expect(await ProjectHelpers.isOnProjectsPage(page)).toBe(true)
        console.log('✅ Breadcrumb navigation working')
      }
    } else {
      console.log('ℹ️ Breadcrumbs not visible')
    }
  })

  test('should show manage projects link in sidebar', async ({ page }) => {
    await projectsPage.goto()
    
    // Check for manage projects link
    const manageLink = page.getByTestId('sidebar-manage-projects')
    await expect(manageLink).toBeVisible()
    await expect(manageLink).toBeEnabled()
    
    // Click the link
    await manageLink.click()
    await page.waitForTimeout(1000)
    
    // This might open a modal or navigate to manage section
    // Check for either possibility
    const manageModalVisible = await page.getByRole('dialog', { name: /manage/i }).isVisible()
    const manageTabActive = await projectsPage.manageTab.isVisible() && 
                           await projectsPage.manageTab.getAttribute('data-state') === 'active'
    
    expect(manageModalVisible || manageTabActive).toBeTruthy()
    console.log('✅ Manage projects accessible from sidebar')
  })

  test('should handle direct URL navigation to specific project and tab', async ({ page }) => {
    // Create a test project first
    const projectData = generateUniqueProject('nav-test')
    const project = await ProjectHelpers.createTestProject(page, projectData)
    
    if (project && project.id) {
      createdProjectIds.push(project.id)
      
      // Navigate directly to project with specific tab
      await projectsPage.gotoWithTab('git', project.id)
      
      // Verify URL
      expect(page.url()).toContain(`projectId=${project.id}`)
      expect(page.url()).toContain('activeView=git')
      
      // Verify correct tab is active (if visible)
      const gitTabVisible = await projectsPage.gitTab.isVisible()
      if (gitTabVisible) {
        await projectsPage.expectTabActive('git')
      }
      
      console.log('✅ Direct URL navigation working')
    } else {
      console.log('⚠️ Could not create test project - skipping direct navigation test')
    }
  })
})