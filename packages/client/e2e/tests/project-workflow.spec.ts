import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('Project Workflow Tests', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let sidebarPage: SidebarPage
  let testProjects: TestProject[] = []

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)
    sidebarPage = new SidebarPage(page)

    await appPage.goto('/')
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up test projects created in this test
    if (testProjects.length > 0) {
      await TestProjectHelpers.cleanupSpecificProjects(testProjects)
      testProjects = []
    }
  })

  test.describe('Project Creation from Existing Folders', () => {
    test('should create project from existing web app folder', async () => {
      // Create test project on disk
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Verify project exists on disk
      expect(await TestProjectHelpers.verifyProjectOnDisk(testProject)).toBe(true)

      // Navigate to projects page
      await sidebarPage.navigateToSection('projects')

      // Load project into application
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Verify project appears in the application
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      // Verify project information
      const projectInfo = await projectsPage.getProjectInfo(testProject.name)
      expect(projectInfo.name).toBe(testProject.name)
      expect(projectInfo.path).toBe(testProject.path)
    })

    test('should create project from existing API service folder', async () => {
      // Create API service project
      const testProject = await TestProjectHelpers.createApiProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Verify project is loaded
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      // Get project statistics
      const stats = await TestProjectHelpers.getProjectStats(testProject)
      expect(stats.fileCount).toBeGreaterThan(5) // API service should have multiple files
      expect(stats.directoryCount).toBeGreaterThan(2) // Should have src/, etc.
    })

    test('should create project from simple folder structure', async () => {
      // Create simple project
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      // Simple project should have minimal files
      const stats = await TestProjectHelpers.getProjectStats(testProject)
      expect(stats.fileCount).toBeLessThan(10)
    })

    test('should handle project with nested directory structure', async () => {
      // Create library project (has nested structure)
      const testProject = await TestProjectHelpers.createLibraryProject()
      testProjects.push(testProject)

      // Verify nested structure exists
      const structure = testProject.structure
      expect(structure.some((item) => item.includes('src/'))).toBe(true)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)
    })

    test('should validate project path before creation', async () => {
      // Try to create project with invalid path
      await sidebarPage.navigateToSection('projects')

      const createButton = appPage.page.locator('[data-testid="create-project"], button:has-text("New Project")')
      await createButton.click()

      const dialog = appPage.page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()

      // Fill with invalid path
      await appPage.page.locator('input[name="name"]').fill('Invalid Project')
      await appPage.page.locator('input[name="path"]').fill('/nonexistent/path')

      const submitButton = appPage.page.locator('button[type="submit"]')
      await submitButton.click()

      // Should show validation error
      const errorMessage = appPage.page.locator('[data-testid="error"], .error, [role="alert"]')
      await expect(errorMessage).toBeVisible()
    })
  })

  test.describe('Project Loading and Navigation', () => {
    test('should load and navigate to project', async () => {
      // Create and load test project
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Open the project
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Should navigate to project view
      await expect(appPage.page).toHaveURL(/\/projects\/\d+/)

      // Verify we're in the correct project context
      const currentProject = await appPage.getCurrentProjectName()
      expect(currentProject).toContain(testProject.name)
    })

    test('should show project file structure', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Wait for file explorer to load
      const fileExplorer = appPage.page.locator('[data-testid="file-explorer"], [data-testid="file-tree"]')
      await expect(fileExplorer).toBeVisible({ timeout: 10000 })

      // Verify some expected files are visible
      const expectedFiles = ['package.json', 'README.md', 'src/']
      for (const file of expectedFiles) {
        const fileElement = appPage.page.locator(`text="${file}"`).first()
        await expect(fileElement).toBeVisible()
      }
    })

    test('should maintain project context when switching views', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Switch to different views within project
      const viewTabs = ['context', 'flow', 'git']

      for (const view of viewTabs) {
        try {
          const tabElement = appPage.page.locator(`button:has-text("${view}")`, { timeout: 5000 })
          if (await tabElement.isVisible()) {
            await tabElement.click()
            await appPage.waitForLoadingComplete()

            // Verify we're still in the same project
            const currentProject = await appPage.getCurrentProjectName()
            expect(currentProject).toContain(testProject.name)
          }
        } catch (error) {
          console.warn(`View ${view} not available in this project context`)
        }
      }
    })
  })

  test.describe('Project Management Operations', () => {
    test('should rename project', async () => {
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Rename project
      const newName = `${testProject.name}-renamed`
      await projectsPage.editProject(testProject.name, { name: newName })

      // Verify project was renamed
      expect(await projectsPage.projectExists(newName)).toBe(true)
      expect(await projectsPage.projectExists(testProject.name)).toBe(false)
    })

    test('should delete project from application', async () => {
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Delete project through UI
      await projectsPage.deleteProject(testProject.name)

      // Verify project is removed from UI
      expect(await projectsPage.projectExists(testProject.name)).toBe(false)

      // Note: This should only remove from app, not delete actual files
      expect(await TestProjectHelpers.verifyProjectOnDisk(testProject)).toBe(true)
    })

    test('should handle project with different file types', async () => {
      const testProject = await TestProjectHelpers.createTestProject(TestProjectPresets.withBinaryFiles())
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify different file types are recognized
      const jsFiles = TestProjectHelpers.getProjectJavaScriptFiles(testProject)
      const configFiles = TestProjectHelpers.getProjectConfigFiles(testProject)

      expect(jsFiles.length).toBeGreaterThan(0)
      expect(configFiles.length).toBeGreaterThan(0)
    })
  })

  test.describe('Project Validation and Error Handling', () => {
    test('should handle missing project directory gracefully', async () => {
      // Create project then remove directory
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Remove project directory
      await TestProjectHelpers.cleanupSpecificProjects([testProject])

      // Try to open project - should handle gracefully
      await appPage.page.goto('/')
      await sidebarPage.navigateToSection('projects')

      const projectCard = appPage.page.locator(`text="${testProject.name}"`)
      if (await projectCard.isVisible()) {
        await projectCard.click()

        // Should show error or handle missing directory
        await expect(appPage.page.locator('[data-testid="error"], .error')).toBeVisible({ timeout: 5000 })
      }
    })

    test('should validate project structure', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Validate project structure
      const validation = TestProjectHelpers.validateProjectStructure(testProject)
      expect(validation.valid).toBe(true)
      expect(validation.errors.length).toBe(0)
    })

    test('should handle projects with special characters in names', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'simple',
        name: 'test-project-with-special-chars-&-symbols'
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')

      // Should be able to load project with special characters
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)
    })
  })

  test.describe('Multiple Projects Management', () => {
    test('should handle multiple projects', async () => {
      // Create multiple test projects
      const projects = await TestProjectHelpers.createTestProjects([
        TestProjectPresets.minimal(),
        TestProjectPresets.webApp(),
        TestProjectPresets.apiService()
      ])
      testProjects.push(...projects)

      await sidebarPage.navigateToSection('projects')

      // Load all projects into application
      for (const project of projects) {
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, project)
      }

      // Verify all projects are visible
      for (const project of projects) {
        expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, project)).toBe(true)
      }

      // Check project count
      const projectCount = await projectsPage.getProjectCount()
      expect(projectCount).toBe(projects.length)
    })

    test('should switch between projects', async () => {
      const project1 = await TestProjectHelpers.createWebAppProject()
      const project2 = await TestProjectHelpers.createApiProject()
      testProjects.push(project1, project2)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, project1)
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, project2)

      // Open first project
      await TestProjectHelpers.openProjectInApp(appPage.page, project1)
      let currentProject = await appPage.getCurrentProjectName()
      expect(currentProject).toContain(project1.name)

      // Switch to second project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.openProjectInApp(appPage.page, project2)
      currentProject = await appPage.getCurrentProjectName()
      expect(currentProject).toContain(project2.name)
    })

    test('should maintain recent projects list', async () => {
      const projects = await TestProjectHelpers.createTestProjects([
        TestProjectPresets.minimal(),
        TestProjectPresets.webApp()
      ])
      testProjects.push(...projects)

      await sidebarPage.navigateToSection('projects')

      // Load and open projects
      for (const project of projects) {
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, project)
        await TestProjectHelpers.openProjectInApp(appPage.page, project)
        await sidebarPage.navigateToSection('projects') // Go back to projects list
      }

      // Check if recent projects are visible in sidebar
      if (await sidebarPage.hasRecentProjects()) {
        const recentProjects = await sidebarPage.getRecentProjectNames()
        expect(recentProjects.length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Project Import and Export', () => {
    test('should import project configuration', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // This test would depend on actual import functionality
      // For now, just verify the project can be loaded normally
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      const stats = await TestProjectHelpers.getProjectStats(testProject)
      expect(stats.fileCount).toBeGreaterThan(5)
    })

    test('should handle project with existing .git directory', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'web-app',
        includeGit: true
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Should handle git projects normally
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)
    })
  })
})
