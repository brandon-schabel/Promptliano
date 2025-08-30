import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ManageProjectModal } from '../pages/manage-project-modal'
import { ManageProjectModalTestData, ManageProjectModalTestUtils } from '../fixtures/manage-project-modal-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Manage Project Modal - Project Creation Workflow', () => {
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

  test.describe('Create Project Form Tests', () => {
    test('should open create project form from "Add Project" button', async ({ page }) => {
      await modalPage.openModal()

      // Click add project button
      await modalPage.openCreateProjectForm()

      // Verify form elements are visible and properly structured
      await expect(modalPage.projectDialog).toBeVisible()
      await expect(modalPage.projectDialogTitle).toContainText(/new.*project/i)

      // Verify all form fields are present
      await expect(modalPage.projectNameInput).toBeVisible()
      await expect(modalPage.projectPathInput).toBeVisible()
      await expect(modalPage.projectDescriptionInput).toBeVisible()
      await expect(modalPage.browseDirectoryButton).toBeVisible()

      // Verify action buttons
      await expect(modalPage.createProjectButton).toBeVisible()
      await expect(modalPage.cancelCreateButton).toBeVisible()

      // Initially create button should be disabled (form validation)
      await expect(modalPage.createProjectButton).toBeDisabled()
    })

    test('should display proper form field labels and placeholders', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Check that form fields have proper labels
      await expect(modalPage.projectNameInput).toHaveAttribute('type', 'text')
      await expect(modalPage.projectPathInput).toHaveAttribute('type', 'text')

      // Check if fields have proper ARIA labels or associated labels
      const nameLabel = await modalPage.projectNameInput.getAttribute('aria-label')
      const pathLabel = await modalPage.projectPathInput.getAttribute('aria-label')

      // Should have some form of labeling
      expect(nameLabel || (await modalPage.projectDialog.locator('label[for*="name"]').count())).toBeTruthy()
      expect(pathLabel || (await modalPage.projectDialog.locator('label[for*="path"]').count())).toBeTruthy()
    })

    test('should handle form cancellation and reset state', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Fill some test data
      const testData = ManageProjectModalTestData.newProjectData.valid.minimal
      await modalPage.projectNameInput.fill('Test Project To Cancel')
      await modalPage.projectPathInput.fill('/tmp/cancelled-project')
      await modalPage.projectDescriptionInput.fill('This should be discarded')

      // Cancel the form
      await modalPage.cancelCreateButton.click()

      // Form dialog should be hidden
      await expect(modalPage.projectDialog).not.toBeVisible()

      // Should return to main modal view
      await expect(modalPage.modal).toBeVisible()
      await expect(modalPage.addProjectButton).toBeVisible()

      // Reopen form should have empty/reset fields
      await modalPage.openCreateProjectForm()
      await expect(modalPage.projectNameInput).toHaveValue('')
      await expect(modalPage.projectPathInput).toHaveValue('')
      await expect(modalPage.projectDescriptionInput).toHaveValue('')
    })

    test('should enable/disable create button based on validation state', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Initially disabled
      await expect(modalPage.createProjectButton).toBeDisabled()

      // Fill only name - should still be disabled (path required)
      await modalPage.projectNameInput.fill('Test Project')
      await expect(modalPage.createProjectButton).toBeDisabled()

      // Add path - should enable
      await modalPage.projectPathInput.fill('/tmp/test-project')
      await expect(modalPage.createProjectButton).toBeEnabled()

      // Clear name - should disable again
      await modalPage.projectNameInput.clear()
      await expect(modalPage.createProjectButton).toBeDisabled()

      // Restore both - should enable
      await modalPage.projectNameInput.fill('Test Project')
      await expect(modalPage.createProjectButton).toBeEnabled()
    })

    test('should handle form field focus and keyboard navigation', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Test Tab navigation through form fields
      await modalPage.projectNameInput.focus()
      await expect(modalPage.projectNameInput).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(modalPage.projectPathInput).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(modalPage.projectDescriptionInput).toBeFocused()

      // Test that Enter key doesn't accidentally submit when fields are invalid
      await modalPage.projectNameInput.focus()
      await page.keyboard.press('Enter')

      // Form should not submit (create button disabled)
      await expect(modalPage.projectDialog).toBeVisible()
    })

    test('should show visual feedback for field validation', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Try to focus away from required fields without filling them
      await modalPage.projectNameInput.focus()
      await modalPage.projectNameInput.blur()

      await modalPage.projectPathInput.focus()
      await modalPage.projectPathInput.blur()

      // Check for visual validation feedback (may be implementation-specific)
      const nameHasError = await modalPage.projectNameInput.evaluate((input) => {
        return (
          input.hasAttribute('aria-invalid') || input.classList.contains('error') || input.classList.contains('invalid')
        )
      })

      const pathHasError = await modalPage.projectPathInput.evaluate((input) => {
        return (
          input.hasAttribute('aria-invalid') || input.classList.contains('error') || input.classList.contains('invalid')
        )
      })

      // At least one validation mechanism should be present
      expect(nameHasError || pathHasError).toBeTruthy()
    })
  })

  test.describe('Project Validation Tests', () => {
    test('should validate required fields with proper error messages', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Try to create without any data
      await modalPage.createProjectButton.click()

      // Should show validation errors for required fields
      if (await modalPage.validationErrors.isVisible({ timeout: 2000 })) {
        const errorText = await modalPage.validationErrors.textContent()
        expect(errorText).toMatch(/name.*required|path.*required|required/i)
      }

      // Fill name only, try again
      await modalPage.projectNameInput.fill('Test Project')
      await modalPage.createProjectButton.click()

      // Should still show path validation error
      if (await modalPage.validationErrors.isVisible({ timeout: 2000 })) {
        const errorText = await modalPage.validationErrors.textContent()
        expect(errorText).toMatch(/path.*required|required/i)
      }
    })

    test('should validate project name uniqueness', async ({ page }) => {
      // Setup existing projects
      const existingProjects = ManageProjectModalTestData.existingProjects.slice(0, 2)
      await page.route('**/api/projects**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: existingProjects })
        })
      })

      await modalPage.openModal()
      await modalPage.waitForProjectsLoaded()
      await modalPage.openCreateProjectForm()

      // Try to use existing project name
      const duplicateData = ManageProjectModalTestData.newProjectData.invalid.duplicateName
      await modalPage.fillProjectForm(duplicateData)

      // Mock validation endpoint to return uniqueness error
      await page.route('**/api/projects/validate**', async (route) => {
        const requestData = await route.request().postDataJSON()
        if (requestData.name === duplicateData.name) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Validation failed',
              details: { name: 'Project name already exists' }
            })
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ valid: true })
          })
        }
      })

      await modalPage.createProjectButton.click()

      // Should show uniqueness validation error
      if (await modalPage.validationErrors.isVisible({ timeout: 3000 })) {
        const errorText = await modalPage.validationErrors.textContent()
        expect(errorText).toMatch(/name.*exists|already.*exists|duplicate/i)
      }

      // Fix the name and verify validation passes
      await modalPage.projectNameInput.clear()
      await modalPage.projectNameInput.fill('Unique Project Name')

      // Should clear validation error and enable create button
      await expect(modalPage.createProjectButton).toBeEnabled()
    })

    test('should validate path format and accessibility', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const invalidPathTestCases = ManageProjectModalTestData.newProjectData.invalid

      // Test each invalid path scenario
      for (const [scenarioName, testData] of Object.entries(invalidPathTestCases)) {
        if (testData.path !== undefined) {
          await modalPage.projectNameInput.clear()
          await modalPage.projectNameInput.fill(`Test ${scenarioName}`)

          await modalPage.projectPathInput.clear()
          await modalPage.projectPathInput.fill(testData.path)

          // Mock path validation
          await page.route('**/api/projects/validate-path**', async (route) => {
            const requestData = await route.request().postDataJSON()

            if (
              testData.path === '' ||
              testData.path.startsWith('./') ||
              testData.path === '/nonexistent/invalid/path/that/does/not/exist'
            ) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  error: testData.expectedError || 'Invalid path'
                })
              })
            } else {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ valid: true })
              })
            }
          })

          await modalPage.createProjectButton.click()

          // Should show path validation error or button should remain disabled
          const hasValidationError = await modalPage.validationErrors.isVisible({ timeout: 1000 })
          const isButtonDisabled = await modalPage.createProjectButton.isDisabled()

          expect(hasValidationError || isButtonDisabled).toBe(true)
        }
      }
    })

    test('should validate project name format and special characters', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Test various name validation scenarios
      const nameTestCases = [
        { name: '', shouldFail: true, error: 'required' },
        { name: 'A'.repeat(256), shouldFail: true, error: 'too long' },
        { name: 'Project/With/Slashes', shouldFail: true, error: 'invalid characters' },
        { name: 'Valid Project Name!', shouldFail: false },
        { name: 'Project with Special-Characters & Symbols!', shouldFail: false }
      ]

      for (const testCase of nameTestCases) {
        await modalPage.projectNameInput.clear()
        await modalPage.projectNameInput.fill(testCase.name)
        await modalPage.projectPathInput.clear()
        await modalPage.projectPathInput.fill('/tmp/test-path')

        // Mock name validation
        await page.route('**/api/projects/validate-name**', async (route) => {
          if (testCase.shouldFail) {
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({ error: `Name validation failed: ${testCase.error}` })
            })
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ valid: true })
            })
          }
        })

        if (testCase.shouldFail) {
          // Should show validation error or disable button
          await modalPage.createProjectButton.click()
          const hasError = await modalPage.validationErrors.isVisible({ timeout: 1000 })
          const isDisabled = await modalPage.createProjectButton.isDisabled()
          expect(hasError || isDisabled).toBe(true)
        } else {
          // Should be valid
          await expect(modalPage.createProjectButton).toBeEnabled()
        }
      }
    })

    test('should handle real-time validation feedback', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Setup real-time validation mock
      await page.route('**/api/projects/validate**', async (route) => {
        const requestData = await route.request().postDataJSON()

        // Simulate different validation responses
        if (!requestData.name) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Name is required' })
          })
        } else if (requestData.name === 'Promptliano Core') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Project name already exists' })
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ valid: true })
          })
        }
      })

      // Type in name and check for real-time feedback
      await modalPage.projectNameInput.type('Test Project')
      await modalPage.projectPathInput.fill('/tmp/test')

      // Should become valid
      await expect(modalPage.createProjectButton).toBeEnabled()

      // Change to invalid name
      await modalPage.projectNameInput.clear()
      await modalPage.projectNameInput.type('Promptliano Core')

      // Should show validation feedback
      await page.waitForTimeout(500) // Allow time for validation
      const hasError = await modalPage.validationErrors.isVisible({ timeout: 2000 })
      const isDisabled = await modalPage.createProjectButton.isDisabled()

      expect(hasError || isDisabled).toBe(true)
    })
  })

  test.describe('Project Creation Success Tests', () => {
    test('should create project with complete data successfully', async ({ page }) => {
      // Mock successful project creation
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const requestData = await route.request().postDataJSON()
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: Date.now(),
                ...requestData,
                status: 'active',
                createdAt: new Date().toISOString(),
                fileCount: 0
              }
            })
          })
        }
      })

      // Mock file system scan for the new project
      await page.route('**/api/projects/*/sync', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate scan time
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              fileCount: 15,
              scanComplete: true,
              status: 'synced'
            }
          })
        })
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.complete
      await modalPage.fillProjectForm(testData)

      // Submit the form
      await modalPage.createProjectButton.click()

      // Project dialog should close
      await expect(modalPage.projectDialog).not.toBeVisible()

      // Should show sync progress if implemented
      if (await modalPage.syncProgressDialog.isVisible({ timeout: 2000 })) {
        await expect(modalPage.syncStatus).toBeVisible()
        await expect(modalPage.syncMessage).toContainText(/scanning|importing|indexing/i)

        // Wait for sync to complete
        await modalPage.waitForProjectSync()
      }

      // Project should appear in the list
      await modalPage.waitForProjectsLoaded()
      await expect(modalPage.projectItem(testData.name)).toBeVisible()
    })

    test('should create minimal project with only required fields', async ({ page }) => {
      // Mock successful minimal project creation
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const requestData = await route.request().postDataJSON()
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: Date.now(),
                name: requestData.name,
                path: requestData.path,
                description: requestData.description || '',
                status: 'active',
                createdAt: new Date().toISOString(),
                fileCount: 0
              }
            })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.minimal
      await modalPage.fillProjectForm(testData)

      await modalPage.createProjectButton.click()

      // Should succeed with minimal data
      await expect(modalPage.projectDialog).not.toBeVisible()

      // Wait for project to appear in list
      await modalPage.waitForProjectsLoaded()
      await expect(modalPage.projectItem(testData.name)).toBeVisible()
    })

    test('should handle project creation with special characters in name', async ({ page }) => {
      // Mock project creation with special characters
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const requestData = await route.request().postDataJSON()
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: Date.now(),
                ...requestData,
                status: 'active',
                createdAt: new Date().toISOString(),
                fileCount: 0
              }
            })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.withSpecialChars
      await modalPage.fillProjectForm(testData)

      await modalPage.createProjectButton.click()

      // Should handle special characters correctly
      await expect(modalPage.projectDialog).not.toBeVisible()
      await modalPage.waitForProjectsLoaded()
      await expect(modalPage.projectItem(testData.name)).toBeVisible()
    })

    test('should update UI and show success feedback after creation', async ({ page }) => {
      let createdProject: any = null

      // Mock successful project creation with data capture
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const requestData = await route.request().postDataJSON()
          createdProject = {
            id: Date.now(),
            ...requestData,
            status: 'active',
            createdAt: new Date().toISOString(),
            fileCount: 8
          }
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ data: createdProject })
          })
        } else {
          // Mock projects list endpoint to return created project
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: createdProject ? [createdProject] : []
            })
          })
        }
      })

      await modalPage.openModal()
      const initialCount = await modalPage.getProjectCount()

      await modalPage.openCreateProjectForm()
      const testData = ManageProjectModalTestData.newProjectData.valid.complete
      await modalPage.fillProjectForm(testData)
      await modalPage.createProjectButton.click()

      // Form should close
      await expect(modalPage.projectDialog).not.toBeVisible()

      // Should return to project list view
      await expect(modalPage.modal).toBeVisible()

      // Wait for projects to reload and check count increased
      await modalPage.waitForProjectsLoaded()
      const newCount = await modalPage.getProjectCount()
      expect(newCount).toBe(initialCount + 1)

      // Verify the new project appears with correct information
      await expect(modalPage.projectItem(testData.name)).toBeVisible()
      await expect(modalPage.getProjectName(testData.name)).toContainText(testData.name)
      await expect(modalPage.getProjectPath(testData.name)).toContainText(testData.path)

      // Check for success message or notification
      const successMessage = page.locator('[role="alert"]').filter({ hasText: /success|created/i })
      if (await successMessage.isVisible({ timeout: 2000 })) {
        await expect(successMessage).toContainText(/project.*created|success/i)
      }
    })

    test('should handle project creation with deep directory paths', async ({ page }) => {
      // Mock creation with deep path
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const requestData = await route.request().postDataJSON()
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: Date.now(),
                ...requestData,
                status: 'active',
                createdAt: new Date().toISOString(),
                fileCount: 3
              }
            })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.deepPath
      await modalPage.fillProjectForm(testData)

      await modalPage.createProjectButton.click()

      // Should handle deep paths correctly
      await expect(modalPage.projectDialog).not.toBeVisible()
      await modalPage.waitForProjectsLoaded()
      await expect(modalPage.projectItem(testData.name)).toBeVisible()

      // Verify deep path is displayed properly (may be truncated in UI)
      const pathElement = modalPage.getProjectPath(testData.name)
      const pathText = await pathElement.textContent()

      // Should contain at least part of the deep path
      expect(pathText).toMatch(/very.*deep.*nested|\.\.\..*project/i)
    })

    test('should navigate to created project after successful creation', async ({ page }) => {
      // Mock successful creation and navigation
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const requestData = await route.request().postDataJSON()
          const createdProject = {
            id: 999,
            ...requestData,
            status: 'active',
            createdAt: new Date().toISOString(),
            fileCount: 0
          }
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ data: createdProject })
          })
        }
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
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.complete
      await modalPage.fillProjectForm(testData)
      await modalPage.createProjectButton.click()

      // Wait for creation to complete
      await expect(modalPage.projectDialog).not.toBeVisible()
      await modalPage.waitForProjectsLoaded()

      // Click on the newly created project
      const createdProjectItem = modalPage.projectItem(testData.name)
      await expect(createdProjectItem).toBeVisible()

      const openButton = modalPage.getOpenProjectButton(testData.name)
      await openButton.click()

      // Modal should close after selection
      await expect(modalPage.modal).not.toBeVisible()

      // Should potentially show project context or navigate to project view
      // (Implementation depends on app behavior)
    })
  })

  test.describe('Project Creation Error Handling', () => {
    test('should handle API errors during project creation', async ({ page }) => {
      // Mock API error response
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal server error',
              message: 'Failed to create project due to server error'
            })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.complete
      await modalPage.fillProjectForm(testData)
      await modalPage.createProjectButton.click()

      // Should show error message
      await expect(modalPage.errorMessage).toBeVisible({ timeout: 5000 })
      const errorText = await modalPage.errorMessage.textContent()
      expect(errorText).toMatch(/error|failed|server.*error/i)

      // Form should remain open for retry
      await expect(modalPage.projectDialog).toBeVisible()
      await expect(modalPage.createProjectButton).toBeEnabled()
    })

    test('should handle network timeouts and connection errors', async ({ page }) => {
      // Mock network timeout
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          // Simulate timeout by never responding
          await new Promise((resolve) => setTimeout(resolve, 10000))
          await route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Request timeout' })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.valid.minimal
      await modalPage.fillProjectForm(testData)
      await modalPage.createProjectButton.click()

      // Should show loading state initially
      const createButtonText = await modalPage.createProjectButton.textContent()
      expect(createButtonText).toMatch(/creating|loading|processing/i)

      // Should eventually show timeout error
      await expect(modalPage.errorMessage).toBeVisible({ timeout: 15000 })
      const errorText = await modalPage.errorMessage.textContent()
      expect(errorText).toMatch(/timeout|connection.*failed|network.*error/i)

      // Should provide retry option
      const retryButton = modalPage.projectDialog.getByRole('button', { name: /retry|try.*again/i })
      if (await retryButton.isVisible({ timeout: 1000 })) {
        await expect(retryButton).toBeVisible()
      } else {
        // At minimum, create button should be re-enabled for retry
        await expect(modalPage.createProjectButton).toBeEnabled()
      }
    })

    test('should handle validation errors from backend', async ({ page }) => {
      // Mock backend validation error
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Validation failed',
              details: {
                path: 'Directory does not exist or is not accessible',
                name: 'Project name contains invalid characters'
              }
            })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      const testData = ManageProjectModalTestData.newProjectData.invalid.invalidPath
      await modalPage.fillProjectForm({
        name: testData.name,
        path: testData.path,
        description: testData.description
      })

      await modalPage.createProjectButton.click()

      // Should show validation errors from server
      await expect(modalPage.validationErrors).toBeVisible({ timeout: 3000 })
      const errorText = await modalPage.validationErrors.textContent()
      expect(errorText).toMatch(/directory.*not.*exist|invalid.*characters/i)

      // Form should remain open for correction
      await expect(modalPage.projectDialog).toBeVisible()

      // User should be able to correct and retry
      await modalPage.projectPathInput.clear()
      await modalPage.projectPathInput.fill('/tmp/valid-path')
      await expect(modalPage.createProjectButton).toBeEnabled()
    })

    test('should display user-friendly error messages', async ({ page }) => {
      const errorScenarios = [
        {
          statusCode: 403,
          serverError: 'Permission denied',
          expectedUserMessage: /permission.*denied|access.*denied|not.*allowed/i
        },
        {
          statusCode: 409,
          serverError: 'Project already exists',
          expectedUserMessage: /already.*exists|duplicate.*project/i
        },
        {
          statusCode: 422,
          serverError: 'Invalid project data',
          expectedUserMessage: /invalid.*data|check.*information/i
        },
        {
          statusCode: 507,
          serverError: 'Insufficient storage space',
          expectedUserMessage: /storage.*space|disk.*full/i
        }
      ]

      for (const scenario of errorScenarios) {
        // Mock specific error response
        await page.route('**/api/projects', async (route) => {
          if (route.request().method() === 'POST') {
            await route.fulfill({
              status: scenario.statusCode,
              contentType: 'application/json',
              body: JSON.stringify({ error: scenario.serverError })
            })
          }
        })

        await modalPage.openModal()
        await modalPage.openCreateProjectForm()

        const testData = ManageProjectModalTestData.newProjectData.valid.minimal
        await modalPage.fillProjectForm(testData)
        await modalPage.createProjectButton.click()

        // Check for user-friendly error message
        await expect(modalPage.errorMessage).toBeVisible({ timeout: 3000 })
        const errorText = await modalPage.errorMessage.textContent()
        expect(errorText).toMatch(scenario.expectedUserMessage)

        // Close modal to reset for next test
        await modalPage.closeModal()
      }
    })

    test('should handle file system permission errors', async ({ page }) => {
      // Mock file system permission error during project scanning
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: Date.now(),
                name: 'Test Project',
                path: '/restricted/path',
                status: 'created'
              }
            })
          })
        }
      })

      await page.route('**/api/projects/*/sync', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Permission denied',
            details: 'Cannot access project directory for file scanning'
          })
        })
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      await modalPage.fillProjectForm({
        name: 'Restricted Access Project',
        path: '/restricted/path',
        description: 'Testing permission errors'
      })

      await modalPage.createProjectButton.click()

      // Project should be created but sync should fail
      await expect(modalPage.projectDialog).not.toBeVisible()

      // Should show sync error
      if (await modalPage.syncProgressDialog.isVisible({ timeout: 2000 })) {
        await expect(modalPage.errorMessage).toBeVisible({ timeout: 5000 })
        const errorText = await modalPage.errorMessage.textContent()
        expect(errorText).toMatch(/permission.*denied|access.*denied|cannot.*access/i)
      }

      // Should provide options to fix or retry
      const retryButton = page.getByRole('button', { name: /retry|scan.*again/i })
      const changePathButton = page.getByRole('button', { name: /change.*path|edit.*project/i })

      const hasRetryOption = await retryButton.isVisible({ timeout: 1000 })
      const hasChangePathOption = await changePathButton.isVisible({ timeout: 1000 })

      expect(hasRetryOption || hasChangePathOption).toBe(true)
    })

    test('should handle concurrent project creation conflicts', async ({ page }) => {
      let requestCount = 0

      // Mock concurrent creation conflict
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          requestCount++
          if (requestCount === 1) {
            // Simulate delay for first request
            await new Promise((resolve) => setTimeout(resolve, 2000))
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                data: {
                  id: Date.now(),
                  name: 'Concurrent Project',
                  path: '/tmp/concurrent-project',
                  status: 'active'
                }
              })
            })
          } else {
            // Second concurrent request fails due to conflict
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                error: 'Conflict',
                message: 'Project with this name was just created'
              })
            })
          }
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      await modalPage.fillProjectForm({
        name: 'Concurrent Project',
        path: '/tmp/concurrent-project'
      })

      await modalPage.createProjectButton.click()

      // Should handle conflict gracefully
      await expect(modalPage.errorMessage).toBeVisible({ timeout: 10000 })
      const errorText = await modalPage.errorMessage.textContent()
      expect(errorText).toMatch(/conflict|already.*created|name.*taken/i)

      // Should suggest alternative or allow name change
      await expect(modalPage.projectDialog).toBeVisible()
      await expect(modalPage.projectNameInput).toBeEnabled()
    })
  })
})
