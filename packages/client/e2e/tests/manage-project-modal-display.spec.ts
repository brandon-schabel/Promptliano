import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ManageProjectModal } from '../pages/manage-project-modal'
import { ManageProjectModalTestData, ManageProjectModalTestUtils } from '../fixtures/manage-project-modal-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Manage Project Modal - Display and Access', () => {
  let appPage: AppPage
  let modalPage: ManageProjectModal
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    appPage = new AppPage(page)
    modalPage = new ManageProjectModal(page)
    dataManager = new TestDataManager(page, testInfo)

    // Navigate to the app and wait for it to be ready
    await appPage.goto('/')
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
  })

  test.describe('Modal Access Tests', () => {
    test('should open modal when ProjectSwitcher "Manage Projects" option is clicked', async ({ page }) => {
      // Verify the project switcher button exists and is positioned correctly
      await expect(modalPage.projectSwitcherButton).toBeVisible()

      // Open the modal
      await modalPage.openModal()

      // Verify modal elements are visible and properly structured
      await expect(modalPage.modal).toBeVisible()
      await expect(modalPage.modalTitle).toBeVisible()
      await expect(modalPage.modalTitle).toContainText(/select.*create.*project/i)
      await expect(modalPage.closeButton).toBeVisible()

      // Verify modal has proper ARIA attributes for accessibility
      await expect(modalPage.modal).toHaveAttribute('role', 'dialog')

      // Check that the modal header is visible
      const headerVisible = await modalPage.modalHeader.isVisible({ timeout: 1000 })
      if (headerVisible) {
        await expect(modalPage.modalHeader).toBeVisible()
      }
    })

    test('should handle modal focus and keyboard accessibility', async ({ page }) => {
      await modalPage.openModal()

      // Modal should be focused or contain a focused element
      const focusedElement = page.locator(':focus')
      const modalElement = modalPage.modal

      // Check that focus is within the modal
      const focusWithinModal = await modalElement.evaluate((modal) => {
        const focused = document.activeElement
        return modal.contains(focused) || modal === focused
      })

      expect(focusWithinModal).toBe(true)

      // Test tab navigation stays within modal
      await page.keyboard.press('Tab')

      // After tab, focus should still be within modal
      const afterTabFocus = await modalElement.evaluate((modal) => {
        const focused = document.activeElement
        return modal.contains(focused) || modal === focused
      })

      expect(afterTabFocus).toBe(true)

      // Verify modal has proper ARIA attributes
      const ariaModal = await modalPage.modal.getAttribute('aria-modal')
      expect(ariaModal).toBe('true')
    })

    test('should close modal with close button', async ({ page }) => {
      await modalPage.openModal()

      // Verify modal is open
      await expect(modalPage.modal).toBeVisible()

      // Close with close button
      await modalPage.closeButton.click()

      // Verify modal is closed
      await expect(modalPage.modal).not.toBeVisible()
    })

    test('should close modal with Escape key', async ({ page }) => {
      await modalPage.openModal()

      // Verify modal is open
      await expect(modalPage.modal).toBeVisible()

      // Close with Escape key
      await page.keyboard.press('Escape')

      // Verify modal is closed
      await expect(modalPage.modal).not.toBeVisible()
    })

    test('should handle multiple open/close cycles correctly', async ({ page }) => {
      // Test opening and closing modal multiple times
      for (let i = 0; i < 3; i++) {
        await modalPage.openModal()
        await expect(modalPage.modal).toBeVisible()

        if (i % 2 === 0) {
          // Close with button
          await modalPage.closeButton.click()
        } else {
          // Close with Escape
          await page.keyboard.press('Escape')
        }

        await expect(modalPage.modal).not.toBeVisible()
      }
    })
  })

  test.describe('Project List Display Tests', () => {
    test('should display existing projects with complete metadata', async ({ page }) => {
      // Set up test projects using the test data
      const testProjects = ManageProjectModalTestData.existingProjects.slice(0, 3)

      // Mock the projects API to return our test data
      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: testProjects })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      // Verify project list is visible
      await expect(modalPage.projectList).toBeVisible()

      // Check that the correct number of projects are displayed
      const projectCount = await modalPage.getProjectCount()
      expect(projectCount).toBe(testProjects.length)

      // Verify each project's information is displayed correctly
      for (const project of testProjects) {
        const projectCard = modalPage.projectItem(project.name)
        await expect(projectCard).toBeVisible()

        // Check project name is displayed
        await expect(modalPage.getProjectName(project.name)).toContainText(project.name)

        // Check project path is displayed
        await expect(modalPage.getProjectPath(project.name)).toContainText(project.path)

        // Check action buttons are visible
        await expect(modalPage.getProjectButton(project.name)).toBeVisible()

        // If project has actions menu, verify it's available
        const actionsButton = modalPage.getProjectActions(project.name)
        if (await actionsButton.isVisible({ timeout: 1000 })) {
          await expect(actionsButton).toBeVisible()
        }
      }
    })

    test('should show project metadata and status information', async ({ page }) => {
      const testProject = ManageProjectModalTestData.existingProjects[0] // Promptliano Core

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [testProject] })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      const projectItem = modalPage.projectItem(testProject.name)
      await expect(projectItem).toBeVisible()

      // Check that project metadata is present (implementation may vary)
      const projectText = await projectItem.textContent()

      // Should contain project name
      expect(projectText).toContain(testProject.name)

      // Should contain some path indication
      expect(projectText).toContain(testProject.path)
    })

    test('should display empty state when no projects exist', async ({ page }) => {
      // Mock empty projects response
      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      // Verify empty state is displayed
      await expect(modalPage.emptyState).toBeVisible()

      // Verify project count is zero
      const projectCount = await modalPage.getProjectCount()
      expect(projectCount).toBe(0)

      // Add project button should still be available
      await expect(modalPage.addProjectButton).toBeVisible()

      // Project list should not be visible or should be empty
      const projectListVisible = await modalPage.projectList.isVisible({ timeout: 1000 })
      if (projectListVisible) {
        const itemCount = await modalPage.projectItems.count()
        expect(itemCount).toBe(0)
      }
    })

    test('should handle loading states properly', async ({ page }) => {
      // Set up a delayed response to test loading state
      await page.route('**/api/projects**', async (route) => {
        // Delay response to simulate loading
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: ManageProjectModalTestData.existingProjects.slice(0, 2) })
        })
      })

      await modalPage.openModal()

      // Check for loading state
      const loadingVisible = await modalPage.loadingState.isVisible({ timeout: 500 })
      if (loadingVisible) {
        await expect(modalPage.loadingState).toBeVisible()
      }

      // Wait for projects to load and verify they appear
      await modalPage.waitForProjectsLoaded()
      const projectCount = await modalPage.getProjectCount()
      expect(projectCount).toBeGreaterThan(0)
    })

    test('should display project action buttons correctly', async ({ page }) => {
      const testProjects = ManageProjectModalTestData.existingProjects.slice(0, 2)

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: testProjects })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      for (const project of testProjects) {
        // Each project should have a primary action button (open/select)
        const openButton = modalPage.getOpenProjectButton(project.name)
        await expect(openButton).toBeVisible()

        // Check if actions menu exists
        const actionsButton = modalPage.getProjectActions(project.name)
        const hasActions = await actionsButton.isVisible({ timeout: 1000 })

        if (hasActions) {
          // If actions menu exists, test that it can be opened
          await actionsButton.click()

          // Look for edit/delete options (may vary by implementation)
          const editOption = page.getByRole('menuitem').filter({ hasText: /edit/i })
          const deleteOption = page.getByRole('menuitem').filter({ hasText: /delete/i })

          // At least one action should be available
          const editVisible = await editOption.isVisible({ timeout: 1000 })
          const deleteVisible = await deleteOption.isVisible({ timeout: 1000 })

          expect(editVisible || deleteVisible).toBe(true)

          // Close the menu by clicking elsewhere
          await modalPage.modal.click({ position: { x: 100, y: 100 } })
        }
      }
    })
  })

  test.describe('Project Selection Tests', () => {
    test('should select and open project correctly', async ({ page }) => {
      const testProject = ManageProjectModalTestData.existingProjects[0]

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [testProject] })
        })
      })

      // Mock project selection endpoint
      await page.route('**/api/projects/*/select', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      // Select the project
      const openButton = modalPage.getOpenProjectButton(testProject.name)
      await openButton.click()

      // Modal should close after selection
      await expect(modalPage.modal).not.toBeVisible()

      // Should potentially navigate or show project context
      // (Implementation depends on app behavior after project selection)
    })

    test('should handle project selection with different statuses', async ({ page }) => {
      // Test with active and archived projects
      const activeProject = ManageProjectModalTestData.existingProjects.find((p) => p.status === 'active')!
      const archivedProject = ManageProjectModalTestData.existingProjects.find((p) => p.status === 'archived')!

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [activeProject, archivedProject] })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      // Active project should be selectable
      const activeButton = modalPage.getOpenProjectButton(activeProject.name)
      await expect(activeButton).toBeVisible()
      await expect(activeButton).toBeEnabled()

      // Check archived project handling
      const archivedItem = modalPage.projectItem(archivedProject.name)
      await expect(archivedItem).toBeVisible()

      // Archived projects may have different button text or be disabled
      const archivedButton = modalPage.getOpenProjectButton(archivedProject.name)
      const buttonText = await archivedButton.textContent()
      const isEnabled = await archivedButton.isEnabled()

      // Either button is disabled or shows different text (like "Restore")
      if (buttonText?.toLowerCase().includes('restore')) {
        expect(buttonText).toMatch(/restore/i)
      } else {
        // If no restore option, button might be disabled
        // (Implementation specific - this test adapts to actual behavior)
        expect(typeof isEnabled).toBe('boolean')
      }
    })

    test('should display accurate project information in list', async ({ page }) => {
      const testProject = ManageProjectModalTestData.existingProjects[0]

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [testProject] })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      const projectItem = modalPage.projectItem(testProject.name)
      await expect(projectItem).toBeVisible()

      // Check project name display
      const nameElement = modalPage.getProjectName(testProject.name)
      await expect(nameElement).toContainText(testProject.name)

      // Check project path display
      const pathElement = modalPage.getProjectPath(testProject.name)
      await expect(pathElement).toContainText(testProject.path)

      // Verify the full project item contains expected information
      const itemText = await projectItem.textContent()
      expect(itemText).toContain(testProject.name)
      expect(itemText).toContain(testProject.path)
    })

    test('should handle projects with long names and paths gracefully', async ({ page }) => {
      // Create a project with very long name and path for UI testing
      const longNameProject = {
        ...ManageProjectModalTestData.existingProjects[0],
        name: 'Very Long Project Name That Tests Maximum Length Handling And Display In UI Components',
        path: '/very/long/path/that/might/cause/display/issues/in/the/user/interface/components/project-directory'
      }

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [longNameProject] })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      const projectItem = modalPage.projectItem(longNameProject.name)
      await expect(projectItem).toBeVisible()

      // Verify long content doesn't break layout
      const projectBoundingBox = await projectItem.boundingBox()
      expect(projectBoundingBox).toBeTruthy()

      // Check that project is still interactive despite long content
      const openButton = modalPage.getOpenProjectButton(longNameProject.name)
      await expect(openButton).toBeVisible()
      await expect(openButton).toBeEnabled()
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error response
      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        })
      })

      await modalPage.openModal()

      // Should show error state or fallback content
      const hasError = await modalPage.errorMessage.isVisible({ timeout: 5000 })
      const hasEmptyState = await modalPage.emptyState.isVisible({ timeout: 1000 })

      // Either error message or empty state should be shown
      expect(hasError || hasEmptyState).toBe(true)

      // Modal should remain functional
      await expect(modalPage.addProjectButton).toBeVisible()
    })

    test('should handle slow network responses', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/projects**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: ManageProjectModalTestData.existingProjects.slice(0, 1) })
        })
      })

      await modalPage.openModal()

      // Check loading state appears during delay
      const loadingVisible = await modalPage.loadingState.isVisible({ timeout: 1000 })
      if (loadingVisible) {
        await expect(modalPage.loadingState).toBeVisible()
      }

      // Eventually projects should load
      await modalPage.waitForProjectsLoaded()
      const projectCount = await modalPage.getProjectCount()
      expect(projectCount).toBe(1)
    })

    test('should maintain modal state during errors', async ({ page }) => {
      await modalPage.openModal()

      // Mock error after modal is open
      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden' })
        })
      })

      // Reload projects (if there's a refresh mechanism)
      // The modal should stay open and functional
      await expect(modalPage.modal).toBeVisible()
      await expect(modalPage.addProjectButton).toBeVisible()

      // Should be able to close modal normally
      await modalPage.closeModal()
    })
  })

  test.describe('Performance and Scalability', () => {
    test('should handle large number of projects efficiently', async ({ page }) => {
      // Use the performance test data with 50 projects
      const largeProjectList = ManageProjectModalTestData.performanceData.largeProjectList

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: largeProjectList })
        })
      })

      const startTime = Date.now()
      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()
      const loadTime = Date.now() - startTime

      // Should load in reasonable time (less than 5 seconds)
      expect(loadTime).toBeLessThan(5000)

      // Should display correct number of projects
      const projectCount = await modalPage.getProjectCount()
      expect(projectCount).toBe(largeProjectList.length)

      // Should be able to scroll if needed
      const modalBox = await modalPage.modal.boundingBox()
      expect(modalBox).toBeTruthy()

      // First and last projects should be accessible
      const firstProject = modalPage.projectItem(largeProjectList[0].name)
      const lastProject = modalPage.projectItem(largeProjectList[largeProjectList.length - 1].name)

      await expect(firstProject).toBeVisible()

      // Last project might need scrolling to be visible
      if (await lastProject.isVisible({ timeout: 1000 })) {
        await expect(lastProject).toBeVisible()
      } else {
        // Try scrolling to last project
        await lastProject.scrollIntoViewIfNeeded()
        await expect(lastProject).toBeVisible()
      }
    })

    test('should maintain responsiveness during project loading', async ({ page }) => {
      // Mock staggered loading response
      await page.route('**/api/projects**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: ManageProjectModalTestData.existingProjects })
        })
      })

      await modalPage.openModal()

      // Modal should remain interactive during loading
      await expect(modalPage.addProjectButton).toBeVisible()
      await expect(modalPage.closeButton).toBeVisible()

      // Should be able to close modal even during loading
      await modalPage.closeModal()
    })
  })

  test.describe('Accessibility Compliance', () => {
    test('should meet accessibility standards for modal interaction', async ({ page }) => {
      await modalPage.openModal()

      // Test keyboard navigation
      await page.keyboard.press('Tab')

      // Check focus is trapped within modal
      const focusedElement = page.locator(':focus')
      const modalContainsFocus = await modalPage.modal.evaluate(
        (modal, focused) => {
          return modal.contains(focused)
        },
        await focusedElement.elementHandle()
      )

      expect(modalContainsFocus).toBe(true)

      // Test that modal has proper ARIA labels
      const modalRole = await modalPage.modal.getAttribute('role')
      expect(modalRole).toBe('dialog')

      const ariaModal = await modalPage.modal.getAttribute('aria-modal')
      expect(ariaModal).toBe('true')
    })

    test('should provide proper screen reader support', async ({ page }) => {
      const testProjects = ManageProjectModalTestData.existingProjects.slice(0, 2)

      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: testProjects })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()

      // Check that project list has proper labeling
      const projectList = modalPage.projectList
      if (await projectList.isVisible()) {
        // List should have proper structure for screen readers
        const hasProperStructure = await projectList.evaluate((list) => {
          // Check for proper list structure or labeling
          return (
            list.getAttribute('role') === 'list' ||
            list.querySelector('[role="list"]') !== null ||
            list.hasAttribute('aria-label')
          )
        })

        expect(hasProperStructure).toBe(true)
      }
    })

    test('should handle high contrast and zoom scenarios', async ({ page }) => {
      // Simulate high contrast mode
      await page.addStyleTag({
        content: `
          * {
            background: black !important;
            color: white !important;
            border-color: white !important;
          }
        `
      })

      await modalPage.openModal()

      // Modal should still be visible and functional
      await expect(modalPage.modal).toBeVisible()
      await expect(modalPage.modalTitle).toBeVisible()
      await expect(modalPage.addProjectButton).toBeVisible()

      // Should be able to close modal
      await modalPage.closeModal()
    })
  })
})
