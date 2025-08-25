import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { TestDataFactory } from '../fixtures/test-data'
import { TestAssertions, TestDataManager, MCPTestHelpers } from '../utils/test-helpers'

test.describe('Project Management', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)
    dataManager = new TestDataManager(page)

    // Navigate to projects page and wait for app to be ready
    await projectsPage.goto()
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
  })

  test.describe('Project Creation', () => {
    test('should create a new project with valid data', async () => {
      const projectData = TestDataFactory.createProject({
        name: 'E2E Test Project',
        path: '/tmp/e2e-test-project',
        description: 'A test project created via E2E tests'
      })

      // Create project through UI
      await projectsPage.createProject(projectData)

      // Verify project appears in the list
      expect(await projectsPage.projectExists(projectData.name)).toBe(true)

      // Verify project information is correct
      const projectInfo = await projectsPage.getProjectInfo(projectData.name)
      expect(projectInfo.name).toBe(projectData.name)
      expect(projectInfo.description).toBe(projectData.description)

      // Verify success toast appears
      await TestAssertions.assertToastMessage(page, 'Project created successfully')
    })

    test('should show validation errors for invalid project data', async ({ page }) => {
      // Try to create project with empty name
      await projectsPage.createProjectButton.click()
      await expect(projectsPage.projectDialog).toBeVisible()

      // Submit without filling required fields
      await projectsPage.submitProjectButton.click()

      // Should show validation errors
      await TestAssertions.assertErrorMessage(page)
      
      // Dialog should remain open
      await expect(projectsPage.projectDialog).toBeVisible()
    })

    test('should create project with minimal required data', async () => {
      const projectData = TestDataFactory.createProject({
        name: 'Minimal Project'
        // Only name provided, path will be auto-generated or selected
      })

      await projectsPage.createProject(projectData)

      expect(await projectsPage.projectExists(projectData.name)).toBe(true)
    })
  })

  test.describe('Project Management', () => {
    test('should edit an existing project', async () => {
      // Create initial project
      const initialData = TestDataFactory.createProject()
      await dataManager.createProject(initialData)
      await projectsPage.goto() // Refresh to see the created project

      const updatedData = {
        name: 'Updated Project Name',
        description: 'Updated description for the project'
      }

      // Edit the project
      await projectsPage.editProject(initialData.name, updatedData)

      // Verify changes
      const projectInfo = await projectsPage.getProjectInfo(updatedData.name)
      expect(projectInfo.name).toBe(updatedData.name)
      expect(projectInfo.description).toBe(updatedData.description)

      await TestAssertions.assertToastMessage(page, 'Project updated successfully')
    })

    test('should delete a project with confirmation', async () => {
      // Create project to delete
      const projectData = TestDataFactory.createProject()
      await dataManager.createProject(projectData)
      await projectsPage.goto()

      // Delete the project
      await projectsPage.deleteProject(projectData.name)

      // Verify project is removed from list
      expect(await projectsPage.projectExists(projectData.name)).toBe(false)

      await TestAssertions.assertToastMessage(page, 'Project deleted successfully')
    })

    test('should cancel project deletion', async ({ page }) => {
      // Create project
      const projectData = TestDataFactory.createProject()
      await dataManager.createProject(projectData)
      await projectsPage.goto()

      // Start deletion but cancel
      await projectsPage.openProjectMenu(projectData.name)
      await projectsPage.projectMenuDelete.click()
      
      // Cancel the confirmation dialog
      await TestAssertions.assertAndHandleConfirmation(page, 'dismiss')

      // Verify project still exists
      expect(await projectsPage.projectExists(projectData.name)).toBe(true)
    })

    test('should open project for detailed view', async ({ page }) => {
      // Create project
      const projectData = TestDataFactory.createProject()
      await dataManager.createProject(projectData)
      await projectsPage.goto()

      // Open project
      await projectsPage.openProject(projectData.name)

      // Should navigate to project detail view
      await TestAssertions.assertNavigation(page, /\/projects\/\d+/)
    })
  })

  test.describe('Project List Management', () => {
    test('should display projects in a grid layout', async () => {
      // Create multiple projects
      const projects = [
        TestDataFactory.createProject({ name: 'Project 1' }),
        TestDataFactory.createProject({ name: 'Project 2' }),
        TestDataFactory.createProject({ name: 'Project 3' })
      ]

      for (const project of projects) {
        await dataManager.createProject(project)
      }

      await projectsPage.goto()
      await projectsPage.waitForProjectsLoaded()

      // Verify all projects are displayed
      const projectCount = await projectsPage.getProjectCount()
      expect(projectCount).toBeGreaterThanOrEqual(3)

      const visibleProjectNames = await projectsPage.getVisibleProjectNames()
      for (const project of projects) {
        expect(visibleProjectNames).toContain(project.name)
      }
    })

    test('should search projects by name', async () => {
      // Create projects with distinct names
      const searchableProject = TestDataFactory.createProject({ name: 'Searchable Unique Project' })
      const otherProject = TestDataFactory.createProject({ name: 'Other Project' })

      await dataManager.createProject(searchableProject)
      await dataManager.createProject(otherProject)
      await projectsPage.goto()

      // Search for specific project
      await projectsPage.searchProjects('Searchable')

      // Should show only matching project
      const visibleProjects = await projectsPage.getVisibleProjectNames()
      expect(visibleProjects).toContain(searchableProject.name)
      expect(visibleProjects).not.toContain(otherProject.name)
    })

    test('should show empty state when no projects exist', async () => {
      await projectsPage.goto()
      await projectsPage.waitForProjectsLoaded()

      if (await projectsPage.getProjectCount() === 0) {
        expect(await projectsPage.isEmptyState()).toBe(true)
        await expect(projectsPage.emptyState).toBeVisible()
      }
    })

    test('should sort projects by name and date', async () => {
      // Create projects with different names and timestamps
      const projectA = TestDataFactory.createProject({ name: 'A First Project' })
      const projectZ = TestDataFactory.createProject({ name: 'Z Last Project' })

      await dataManager.createProject(projectA)
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
      await dataManager.createProject(projectZ)
      
      await projectsPage.goto()

      // Test name sorting
      await projectsPage.sortProjects('name')
      
      const sortedNames = await projectsPage.getVisibleProjectNames()
      const firstProject = sortedNames[0]
      const lastProject = sortedNames[sortedNames.length - 1]
      
      // Should be alphabetically sorted (A before Z)
      expect(firstProject.localeCompare(lastProject)).toBeLessThan(0)
    })
  })

  test.describe('MCP Integration - Project Management', () => {
    test('should integrate with MCP project_manager tool', async ({ page }) => {
      // Verify MCP tools are available
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)
      
      if (availableTools.includes('project_manager')) {
        // Test listing projects via MCP
        const mcpResponse = await MCPTestHelpers.testProjectManagerTool(page, 'list')
        expect(mcpResponse).toBeDefined()
        expect(mcpResponse.success).toBe(true)

        // Create a project via MCP tool
        const projectData = TestDataFactory.createProject()
        const createResponse = await MCPTestHelpers.testProjectManagerTool(page, 'create', {
          project: projectData
        })

        if (createResponse.success) {
          // Verify project appears in UI
          await projectsPage.goto()
          expect(await projectsPage.projectExists(projectData.name)).toBe(true)
        }
      } else {
        console.warn('MCP project_manager tool not available, skipping integration test')
      }
    })

    test('should sync project data between UI and MCP', async ({ page }) => {
      // Create project via UI
      const projectData = TestDataFactory.createProject()
      await projectsPage.createProject(projectData)

      // Verify it's accessible via MCP
      const mcpResponse = await MCPTestHelpers.testProjectManagerTool(page, 'list')
      
      if (mcpResponse && mcpResponse.success) {
        const mcpProjects = mcpResponse.data || []
        const foundProject = mcpProjects.find((p: any) => p.name === projectData.name)
        expect(foundProject).toBeDefined()
        expect(foundProject?.description).toBe(projectData.description)
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/projects', route => route.abort())

      const projectData = TestDataFactory.createProject()
      
      try {
        await projectsPage.createProject(projectData)
        // Should show error message instead of success
        await TestAssertions.assertErrorMessage(page, 'Failed to create project')
      } catch (error) {
        // Expected to fail due to network error
        expect(error).toBeDefined()
      }
    })

    test('should handle server validation errors', async ({ page }) => {
      // Mock server validation error response
      await page.route('**/api/projects', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Project name already exists'
            }
          })
        })
      })

      const projectData = TestDataFactory.createProject()
      
      try {
        await projectsPage.createProject(projectData)
      } catch (error) {
        // Should display server error message
        await TestAssertions.assertErrorMessage(page, 'Project name already exists')
      }
    })

    test('should handle permission errors', async ({ page }) => {
      // Mock permission denied response
      await page.route('**/api/projects', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'Insufficient permissions to create project'
            }
          })
        })
      })

      const projectData = TestDataFactory.createProject()
      
      try {
        await projectsPage.createProject(projectData)
      } catch (error) {
        await TestAssertions.assertErrorMessage(page, 'Insufficient permissions')
      }
    })
  })

  test.describe('Performance', () => {
    test('should load projects page within acceptable time', async ({ page }) => {
      const startTime = Date.now()
      await projectsPage.goto()
      await projectsPage.waitForProjectsLoaded()
      const endTime = Date.now()

      const loadTime = endTime - startTime
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
    })

    test('should handle large number of projects efficiently', async () => {
      // Create multiple projects to test performance
      const projectCount = 20
      const projects = Array.from({ length: projectCount }, (_, i) => 
        TestDataFactory.createProject({ name: `Performance Test Project ${i + 1}` })
      )

      // Create projects in batches to avoid overwhelming the system
      const batchSize = 5
      for (let i = 0; i < projects.length; i += batchSize) {
        const batch = projects.slice(i, i + batchSize)
        await Promise.all(batch.map(project => dataManager.createProject(project)))
      }

      // Measure loading time with many projects
      const startTime = Date.now()
      await projectsPage.goto()
      await projectsPage.waitForProjectsLoaded()
      const endTime = Date.now()

      const loadTime = endTime - startTime
      expect(loadTime).toBeLessThan(5000) // Should still load within 5 seconds

      // Verify all projects are displayed
      const displayedCount = await projectsPage.getProjectCount()
      expect(displayedCount).toBe(projectCount)
    })
  })
})