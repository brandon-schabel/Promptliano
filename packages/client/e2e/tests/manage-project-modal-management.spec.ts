/**
 * Comprehensive E2E Tests for Manage Project Modal - Project Management Operations
 *
 * This test file covers Section 4 (Project Management Operations) from the test plan:
 * - Edit Project Operations
 * - Delete Project Operations
 * - Project Archive/Restore Operations
 * - Project Refresh/Sync Operations
 * - Bulk Operations (where applicable)
 *
 * Tests include comprehensive error handling, confirmation dialogs, and UI state updates.
 */

import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { ManageProjectModal } from '../pages/manage-project-modal'
import { ManageProjectModalTestData, type ProjectWithMetadata } from '../fixtures/manage-project-modal-data'
import { TestDataManager } from '../utils/test-data-manager'

/**
 * Test group for project edit operations
 */
test.describe('Manage Project Modal - Edit Project Operations', () => {
  let modal: ManageProjectModal
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    modal = new ManageProjectModal(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Setup test projects
    await setupTestProjects(page)

    // Navigate to app and open modal
    await page.goto('/')
    await modal.openModal()
    await modal.waitForProjectsLoaded()
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should edit existing project details successfully', async ({ page }) => {
    const originalProject = ManageProjectModalTestData.existingProjects[1] // E-Commerce App
    const updates = {
      name: 'Updated E-Commerce Platform',
      description: 'Modern e-commerce platform with enhanced features and performance optimizations'
    }

    // Verify original project exists
    await expect(modal.projectItem(originalProject.name)).toBeVisible()

    // Edit the project
    await modal.editProject(originalProject.name, updates)

    // Verify project was updated in the list
    await expect(modal.projectItem(updates.name)).toBeVisible()
    await expect(modal.projectItem(originalProject.name)).not.toBeVisible()

    // Verify updated description is shown
    const updatedProjectItem = modal.projectItem(updates.name)
    await expect(updatedProjectItem).toContainText(updates.description)

    // Verify success message
    await expect(page.getByText(/project.*updated.*successfully/i)).toBeVisible({ timeout: 5000 })
  })

  test('should pre-populate edit form with current project data', async ({ page }) => {
    const projectToEdit = ManageProjectModalTestData.existingProjects[0] // Promptliano Core

    // Open project actions menu
    await modal.getProjectActions(projectToEdit.name).click()

    // Click edit option
    await modal.getEditProjectButton(projectToEdit.name).click()

    // Verify edit dialog opens with correct title
    await expect(modal.projectDialog).toBeVisible()
    await expect(modal.projectDialogTitle).toContainText(/edit.*project/i)

    // Verify form is pre-populated with existing data
    await expect(modal.projectNameInput).toHaveValue(projectToEdit.name)
    await expect(modal.projectPathInput).toHaveValue(projectToEdit.path)

    if (projectToEdit.description) {
      await expect(modal.projectDescriptionInput).toHaveValue(projectToEdit.description)
    }

    // Verify path input is read-only or disabled (paths shouldn't be editable)
    const pathInputDisabled = await modal.projectPathInput.isDisabled()
    const pathInputReadonly = await modal.projectPathInput.getAttribute('readonly')
    expect(pathInputDisabled || pathInputReadonly !== null).toBe(true)

    // Cancel to close dialog
    await modal.cancelCreateButton.click()
    await expect(modal.projectDialog).not.toBeVisible()
  })

  test('should validate project name uniqueness during edit', async ({ page }) => {
    const projectToEdit = ManageProjectModalTestData.existingProjects[2] // Legacy API
    const existingProjectName = ManageProjectModalTestData.existingProjects[0].name // Promptliano Core

    // Open edit form
    await modal.getProjectActions(projectToEdit.name).click()
    await modal.getEditProjectButton(projectToEdit.name).click()
    await expect(modal.projectDialog).toBeVisible()

    // Try to change name to existing project name
    await modal.projectNameInput.clear()
    await modal.projectNameInput.fill(existingProjectName)

    // Try to save
    await modal.createProjectButton.click()

    // Should show validation error
    const uniqueError = modal.validationErrors.filter({ hasText: /name.*exists|already.*exists|duplicate/i })
    await expect(uniqueError).toBeVisible()

    // Project should not be updated
    await expect(modal.projectItem(projectToEdit.name)).toBeVisible()
    await expect(modal.projectItem(existingProjectName)).toHaveCount(1) // Should still only have one

    // Fix the name to something unique
    await modal.projectNameInput.clear()
    await modal.projectNameInput.fill('Unique Updated Name')

    // Should now be able to save
    await expect(modal.createProjectButton).toBeEnabled()
  })

  test('should handle edit operation errors gracefully', async ({ page }) => {
    const projectToEdit = ManageProjectModalTestData.existingProjects[1] // E-Commerce App

    // Mock edit API to return error
    await page.route('**/api/projects/*', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Database connection failed',
            message: 'Unable to update project due to server error'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Attempt to edit project
    await modal.getProjectActions(projectToEdit.name).click()
    await modal.getEditProjectButton(projectToEdit.name).click()
    await expect(modal.projectDialog).toBeVisible()

    // Make changes
    await modal.projectNameInput.clear()
    await modal.projectNameInput.fill('Updated Name')

    // Try to save
    await modal.createProjectButton.click()

    // Should show error message
    await expect(modal.errorMessage).toBeVisible()
    await expect(modal.errorMessage).toContainText(/database.*connection.*failed|server.*error/i)

    // Original project should still exist unchanged
    await expect(modal.projectItem(projectToEdit.name)).toBeVisible()
    await expect(modal.projectItem('Updated Name')).not.toBeVisible()

    // Dialog should remain open for retry
    await expect(modal.projectDialog).toBeVisible()
  })

  test('should cancel edit operation without changes', async ({ page }) => {
    const projectToEdit = ManageProjectModalTestData.existingProjects[0] // Promptliano Core

    // Open edit form
    await modal.getProjectActions(projectToEdit.name).click()
    await modal.getEditProjectButton(projectToEdit.name).click()
    await expect(modal.projectDialog).toBeVisible()

    // Make some changes
    await modal.projectNameInput.clear()
    await modal.projectNameInput.fill('Cancelled Changes')
    await modal.projectDescriptionInput.clear()
    await modal.projectDescriptionInput.fill('These changes should be discarded')

    // Cancel the operation
    await modal.cancelCreateButton.click()

    // Dialog should close
    await expect(modal.projectDialog).not.toBeVisible()

    // Original project should remain unchanged
    await expect(modal.projectItem(projectToEdit.name)).toBeVisible()
    await expect(modal.projectItem('Cancelled Changes')).not.toBeVisible()

    // Verify original description is preserved
    const originalProjectItem = modal.projectItem(projectToEdit.name)
    if (projectToEdit.description) {
      await expect(originalProjectItem).toContainText(projectToEdit.description)
    }
  })
})

/**
 * Test group for project delete operations
 */
test.describe('Manage Project Modal - Delete Project Operations', () => {
  let modal: ManageProjectModal
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    modal = new ManageProjectModal(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Setup test projects
    await setupTestProjects(page)

    // Navigate to app and open modal
    await page.goto('/')
    await modal.openModal()
    await modal.waitForProjectsLoaded()
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should delete project with confirmation dialog', async ({ page }) => {
    const projectToDelete = ManageProjectModalTestData.existingProjects[4] // Data Analysis Library
    const initialProjectCount = await modal.getProjectCount()

    // Delete project with confirmation
    await modal.deleteProject(projectToDelete.name, true)

    // Project should be removed from list
    await expect(modal.projectItem(projectToDelete.name)).not.toBeVisible()

    // Project count should decrease
    const newProjectCount = await modal.getProjectCount()
    expect(newProjectCount).toBe(initialProjectCount - 1)

    // Should show success message
    await expect(page.getByText(/project.*deleted.*successfully|deleted.*project/i)).toBeVisible({ timeout: 5000 })
  })

  test('should cancel project deletion', async ({ page }) => {
    const projectToDelete = ManageProjectModalTestData.existingProjects[1] // E-Commerce App
    const initialProjectCount = await modal.getProjectCount()

    // Attempt delete but cancel
    await modal.deleteProject(projectToDelete.name, false)

    // Project should still exist
    await expect(modal.projectItem(projectToDelete.name)).toBeVisible()

    // Project count should be unchanged
    const newProjectCount = await modal.getProjectCount()
    expect(newProjectCount).toBe(initialProjectCount)

    // No success message should be shown
    await expect(page.getByText(/deleted.*successfully/i)).not.toBeVisible()
  })

  test('should show proper delete confirmation dialog', async ({ page }) => {
    const projectToDelete = ManageProjectModalTestData.existingProjects[2] // Legacy API

    // Click project actions menu
    await modal.getProjectActions(projectToDelete.name).click()

    // Click delete option
    await modal.getDeleteProjectButton(projectToDelete.name).click()

    // Verify confirmation dialog appears
    await expect(modal.deleteConfirmationDialog).toBeVisible()

    // Verify dialog contains project name
    await expect(modal.deleteConfirmationDialog).toContainText(projectToDelete.name)

    // Verify warning message
    await expect(modal.deleteConfirmationDialog).toContainText(
      /delete.*project|permanently.*remove|cannot.*be.*undone/i
    )

    // Verify both buttons are present
    await expect(modal.confirmDeleteButton).toBeVisible()
    await expect(modal.cancelDeleteButton).toBeVisible()

    // Verify delete button is styled as destructive
    const deleteButtonClass = await modal.confirmDeleteButton.getAttribute('class')
    expect(deleteButtonClass).toMatch(/destructive|danger|red/i)

    // Cancel to close dialog
    await modal.cancelDeleteButton.click()
    await expect(modal.deleteConfirmationDialog).not.toBeVisible()
  })

  test('should handle deletion errors with active sessions', async ({ page }) => {
    const projectToDelete = ManageProjectModalTestData.existingProjects[0] // Promptliano Core (simulate active)

    // Mock delete API to return active session error
    await page.route('**/api/projects/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 409, // Conflict
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Cannot delete project with active sessions',
            message: 'This project has active chat sessions. Please close all sessions before deleting.',
            activeSessionCount: 2
          })
        })
      } else {
        await route.continue()
      }
    })

    // Attempt to delete project
    await modal.deleteProject(projectToDelete.name, true)

    // Should show error message
    await expect(modal.errorMessage).toBeVisible()
    await expect(modal.errorMessage).toContainText(/cannot.*delete|active.*sessions/i)

    // Project should still exist
    await expect(modal.projectItem(projectToDelete.name)).toBeVisible()

    // Error should suggest action to take
    await expect(modal.errorMessage).toContainText(/close.*sessions|try.*again/i)
  })

  test('should handle deletion errors with file system issues', async ({ page }) => {
    const projectToDelete = ManageProjectModalTestData.existingProjects[3] // Mobile Fitness App

    // Mock delete API to return file system error
    await page.route('**/api/projects/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File system error',
            message: 'Unable to remove project files. Check permissions and try again.',
            code: 'EACCES'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Attempt to delete project
    await modal.deleteProject(projectToDelete.name, true)

    // Should show error message
    await expect(modal.errorMessage).toBeVisible()
    await expect(modal.errorMessage).toContainText(/file.*system.*error|permission/i)

    // Project should still exist
    await expect(modal.projectItem(projectToDelete.name)).toBeVisible()

    // Should provide recovery suggestion
    await expect(modal.errorMessage).toContainText(/check.*permissions|try.*again/i)
  })
})

/**
 * Test group for project archive/restore operations
 */
test.describe('Manage Project Modal - Archive/Restore Operations', () => {
  let modal: ManageProjectModal
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    modal = new ManageProjectModal(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Setup test projects
    await setupTestProjects(page)

    // Navigate to app and open modal
    await page.goto('/')
    await modal.openModal()
    await modal.waitForProjectsLoaded()
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should archive active project with confirmation', async ({ page }) => {
    const projectToArchive = ManageProjectModalTestData.existingProjects[1] // E-Commerce App (active)

    // Mock archive API
    await page.route('**/api/projects/*/archive', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Project archived successfully'
        })
      })
    })

    // Click project actions menu
    await modal.getProjectActions(projectToArchive.name).click()

    // Look for archive button/option
    const archiveButton = page.getByRole('menuitem', { name: /archive/i })

    if (await archiveButton.isVisible()) {
      await archiveButton.click()

      // Handle confirmation dialog if present
      const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: /archive.*project/i })
      if (await confirmDialog.isVisible({ timeout: 2000 })) {
        await page.getByRole('button', { name: /archive|confirm/i }).click()
      }

      // Wait for the operation to complete
      await page.waitForTimeout(1000)

      // Verify project shows as archived (visual indicator or status)
      const projectItem = modal.projectItem(projectToArchive.name)
      const projectClass = await projectItem.getAttribute('class')
      const isArchived =
        projectClass?.includes('archived') ||
        (await projectItem
          .locator('.text-muted-foreground')
          .filter({ hasText: /archived/i })
          .isVisible())

      expect(isArchived).toBe(true)

      // Verify success message
      await expect(page.getByText(/project.*archived.*successfully/i)).toBeVisible({ timeout: 5000 })
    } else {
      // Skip test if archive functionality is not visible
      test.skip()
    }
  })

  test('should restore archived project', async ({ page }) => {
    const archivedProject = ManageProjectModalTestData.existingProjects[2] // Legacy API (archived)

    // Mock restore API
    await page.route('**/api/projects/*/restore', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Project restored successfully'
        })
      })
    })

    // Find the archived project
    const projectItem = modal.projectItem(archivedProject.name)
    await expect(projectItem).toBeVisible()

    // Click project actions menu
    await modal.getProjectActions(archivedProject.name).click()

    // Look for restore button/option
    const restoreButton = page.getByRole('menuitem', { name: /restore/i })

    if (await restoreButton.isVisible()) {
      await restoreButton.click()

      // Wait for the operation to complete
      await page.waitForTimeout(1000)

      // Verify project no longer shows as archived
      const updatedProjectClass = await projectItem.getAttribute('class')
      const isActive =
        !updatedProjectClass?.includes('archived') &&
        (await projectItem
          .locator('.text-muted-foreground')
          .filter({ hasText: /active/i })
          .isVisible())

      expect(isActive).toBe(true)

      // Verify success message
      await expect(page.getByText(/project.*restored.*successfully/i)).toBeVisible({ timeout: 5000 })
    } else {
      // Skip test if restore functionality is not visible
      test.skip()
    }
  })

  test('should show different UI states for archived projects', async ({ page }) => {
    const archivedProject = ManageProjectModalTestData.existingProjects[2] // Legacy API (archived)
    const activeProject = ManageProjectModalTestData.existingProjects[0] // Promptliano Core (active)

    // Verify archived project has different styling
    const archivedProjectItem = modal.projectItem(archivedProject.name)
    const activeProjectItem = modal.projectItem(activeProject.name)

    await expect(archivedProjectItem).toBeVisible()
    await expect(activeProjectItem).toBeVisible()

    // Check for visual differences (opacity, color, etc.)
    const archivedOpacity = await archivedProjectItem.evaluate((el) => getComputedStyle(el).opacity)
    const activeOpacity = await activeProjectItem.evaluate((el) => getComputedStyle(el).opacity)

    // Archived projects should be visually distinct (lower opacity, muted colors, etc.)
    expect(parseFloat(archivedOpacity)).toBeLessThan(parseFloat(activeOpacity))

    // Check for archived indicator in metadata
    await expect(archivedProjectItem.locator('.text-muted-foreground').filter({ hasText: /archived/i })).toBeVisible()
  })

  test('should handle archive operation errors', async ({ page }) => {
    const projectToArchive = ManageProjectModalTestData.existingProjects[1] // E-Commerce App

    // Mock archive API to return error
    await page.route('**/api/projects/*/archive', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Cannot archive project',
          message: 'Project has pending tasks that must be completed first'
        })
      })
    })

    // Click project actions menu
    await modal.getProjectActions(projectToArchive.name).click()

    // Look for archive button
    const archiveButton = page.getByRole('menuitem', { name: /archive/i })

    if (await archiveButton.isVisible()) {
      await archiveButton.click()

      // Handle confirmation if present
      const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: /archive.*project/i })
      if (await confirmDialog.isVisible({ timeout: 2000 })) {
        await page.getByRole('button', { name: /archive|confirm/i }).click()
      }

      // Should show error message
      await expect(modal.errorMessage).toBeVisible()
      await expect(modal.errorMessage).toContainText(/cannot.*archive|pending.*tasks/i)

      // Project should remain in original state
      const projectItem = modal.projectItem(projectToArchive.name)
      const projectClass = await projectItem.getAttribute('class')
      expect(projectClass).not.toMatch(/archived/)
    } else {
      test.skip()
    }
  })
})

/**
 * Test group for project refresh/sync operations
 */
test.describe('Manage Project Modal - Refresh/Sync Operations', () => {
  let modal: ManageProjectModal
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    modal = new ManageProjectModal(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Setup test projects
    await setupTestProjects(page)

    // Navigate to app and open modal
    await page.goto('/')
    await modal.openModal()
    await modal.waitForProjectsLoaded()
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should refresh project metadata and file counts', async ({ page }) => {
    const projectToRefresh = ManageProjectModalTestData.existingProjects[0] // Promptliano Core

    // Mock sync/refresh API with updated file count
    await page.route('**/api/projects/*/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          fileCount: 267, // Updated from 245
          lastModified: new Date().toISOString(),
          message: 'Project synchronized successfully'
        })
      })
    })

    // Click project actions menu
    await modal.getProjectActions(projectToRefresh.name).click()

    // Look for refresh/sync button
    const refreshButton = page.getByRole('menuitem', { name: /refresh|sync|update/i })

    if (await refreshButton.isVisible()) {
      await refreshButton.click()

      // Should show sync in progress
      await expect(modal.syncProgressDialog).toBeVisible({ timeout: 5000 })
      await expect(modal.syncStatus).toContainText(/syncing|refreshing|updating/i)

      // Wait for sync completion
      await expect(modal.syncProgressDialog).not.toBeVisible({ timeout: 10000 })

      // Verify updated file count is displayed
      const projectItem = modal.projectItem(projectToRefresh.name)
      await expect(projectItem).toContainText('267')

      // Verify success message
      await expect(page.getByText(/project.*synchronized.*successfully|sync.*complete/i)).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })

  test('should show sync progress for large projects', async ({ page }) => {
    const largeProject = ManageProjectModalTestData.existingProjects[3] // Mobile Fitness App (simulate large)

    // Mock long-running sync operation
    let progressValue = 0
    await page.route('**/api/projects/*/sync', async (route) => {
      // Simulate progressive sync updates
      await page.waitForTimeout(500)
      progressValue += 25

      if (progressValue >= 100) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            fileCount: 178,
            progress: 100,
            message: 'Sync completed successfully'
          })
        })
      } else {
        await route.fulfill({
          status: 202, // Partial content
          contentType: 'application/json',
          body: JSON.stringify({
            progress: progressValue,
            message: `Scanning files... ${progressValue}% complete`,
            filesProcessed: Math.floor(178 * (progressValue / 100))
          })
        })
      }
    })

    // Mock progress updates endpoint
    await page.route('**/api/projects/*/sync-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          progress: progressValue,
          message: `Processing files... ${progressValue}% complete`
        })
      })
    })

    // Click project actions menu and refresh
    await modal.getProjectActions(largeProject.name).click()
    const refreshButton = page.getByRole('menuitem', { name: /refresh|sync|update/i })

    if (await refreshButton.isVisible()) {
      await refreshButton.click()

      // Verify sync progress dialog appears
      await expect(modal.syncProgressDialog).toBeVisible({ timeout: 5000 })

      // Verify progress indicator is present
      await expect(modal.syncProgress).toBeVisible()

      // Verify progress message updates
      await expect(modal.syncMessage).toContainText(/scanning|processing/i)

      // Wait for completion
      await expect(modal.syncProgressDialog).not.toBeVisible({ timeout: 15000 })
    } else {
      test.skip()
    }
  })

  test('should handle sync errors and provide retry options', async ({ page }) => {
    const projectToSync = ManageProjectModalTestData.existingProjects[1] // E-Commerce App

    // Mock sync API to return error
    await page.route('**/api/projects/*/sync', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'File system access error',
          message: 'Unable to access project directory. Check permissions.',
          code: 'EACCES'
        })
      })
    })

    // Click project actions menu and refresh
    await modal.getProjectActions(projectToSync.name).click()
    const refreshButton = page.getByRole('menuitem', { name: /refresh|sync|update/i })

    if (await refreshButton.isVisible()) {
      await refreshButton.click()

      // Should show error message
      await expect(modal.errorMessage).toBeVisible()
      await expect(modal.errorMessage).toContainText(/file.*system.*access.*error|permission/i)

      // Should provide retry option
      const retryButton = page.getByRole('button', { name: /retry|try.*again/i })
      await expect(retryButton).toBeVisible()

      // Should provide more details or help
      await expect(modal.errorMessage).toContainText(/check.*permissions|contact.*support/i)
    } else {
      test.skip()
    }
  })

  test('should handle sync cancellation', async ({ page }) => {
    const projectToSync = ManageProjectModalTestData.existingProjects[0] // Promptliano Core

    // Mock long-running sync
    await page.route('**/api/projects/*/sync', async (route) => {
      // Don't fulfill immediately to simulate long operation
      await page.waitForTimeout(10000)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Start sync operation
    await modal.getProjectActions(projectToSync.name).click()
    const refreshButton = page.getByRole('menuitem', { name: /refresh|sync|update/i })

    if (await refreshButton.isVisible()) {
      await refreshButton.click()

      // Wait for sync dialog to appear
      await expect(modal.syncProgressDialog).toBeVisible({ timeout: 5000 })

      // Cancel the sync operation
      await modal.cancelSync()

      // Sync dialog should close
      await expect(modal.syncProgressDialog).not.toBeVisible()

      // Should show cancellation message
      await expect(page.getByText(/sync.*cancelled|operation.*cancelled/i)).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })
})

/**
 * Test group for bulk operations (if supported)
 */
test.describe('Manage Project Modal - Bulk Operations', () => {
  let modal: ManageProjectModal
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    modal = new ManageProjectModal(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Setup test projects
    await setupTestProjects(page)

    // Navigate to app and open modal
    await page.goto('/')
    await modal.openModal()
    await modal.waitForProjectsLoaded()
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should support multi-select project operations', async ({ page }) => {
    // Look for multi-select functionality
    const selectAllCheckbox = modal.modal.getByRole('checkbox', { name: /select.*all/i })
    const bulkActionBar = modal.modal.getByTestId('bulk-actions')

    // Skip if bulk operations are not supported
    if (!(await selectAllCheckbox.isVisible({ timeout: 2000 }))) {
      test.skip()
    }

    // Select multiple projects
    const projectItems = await modal.projectItems.all()
    if (projectItems.length < 2) {
      test.skip()
    }

    // Select first two projects
    const firstProjectCheckbox = projectItems[0].getByRole('checkbox')
    const secondProjectCheckbox = projectItems[1].getByRole('checkbox')

    await firstProjectCheckbox.check()
    await secondProjectCheckbox.check()

    // Bulk action bar should appear
    await expect(bulkActionBar).toBeVisible()

    // Should show selected count
    await expect(bulkActionBar).toContainText(/2.*selected/i)

    // Should provide bulk actions
    const bulkDeleteButton = bulkActionBar.getByRole('button', { name: /delete/i })
    const bulkArchiveButton = bulkActionBar.getByRole('button', { name: /archive/i })

    expect((await bulkDeleteButton.isVisible()) || (await bulkArchiveButton.isVisible())).toBe(true)
  })

  test('should handle bulk delete with confirmation', async ({ page }) => {
    // Skip if bulk operations are not supported
    const bulkActionBar = modal.modal.getByTestId('bulk-actions')
    if (!(await bulkActionBar.isVisible({ timeout: 2000 }))) {
      test.skip()
    }

    // Mock bulk delete API
    await page.route('**/api/projects/bulk-delete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          deletedCount: 2,
          message: '2 projects deleted successfully'
        })
      })
    })

    // Select projects for deletion (last two projects to avoid conflicts)
    const projectItems = await modal.projectItems.all()
    const projectsToDelete = projectItems.slice(-2)

    for (const projectItem of projectsToDelete) {
      const checkbox = projectItem.getByRole('checkbox')
      await checkbox.check()
    }

    // Click bulk delete
    const bulkDeleteButton = bulkActionBar.getByRole('button', { name: /delete/i })
    await bulkDeleteButton.click()

    // Should show bulk delete confirmation
    const bulkDeleteDialog = page.locator('[role="dialog"]').filter({ hasText: /delete.*projects/i })
    await expect(bulkDeleteDialog).toBeVisible()

    // Should show count of projects to be deleted
    await expect(bulkDeleteDialog).toContainText(/2.*projects/i)

    // Confirm deletion
    await page.getByRole('button', { name: /delete/i }).click()

    // Should show success message
    await expect(page.getByText(/2.*projects.*deleted.*successfully/i)).toBeVisible({ timeout: 5000 })

    // Selected projects should be removed
    const remainingProjectCount = await modal.getProjectCount()
    expect(remainingProjectCount).toBe(ManageProjectModalTestData.existingProjects.length - 2)
  })

  test('should handle partial bulk operation failures', async ({ page }) => {
    // Skip if bulk operations are not supported
    const bulkActionBar = modal.modal.getByTestId('bulk-actions')
    if (!(await bulkActionBar.isVisible({ timeout: 2000 }))) {
      test.skip()
    }

    // Mock partial failure in bulk operation
    await page.route('**/api/projects/bulk-archive', async (route) => {
      await route.fulfill({
        status: 207, // Multi-status
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          results: [
            { id: 1, success: true, message: 'Archived successfully' },
            { id: 2, success: false, error: 'Cannot archive project with active sessions' }
          ],
          successCount: 1,
          errorCount: 1
        })
      })
    })

    // Select multiple projects
    const projectItems = await modal.projectItems.all()
    const projectsToArchive = projectItems.slice(0, 2)

    for (const projectItem of projectsToArchive) {
      const checkbox = projectItem.getByRole('checkbox')
      await checkbox.check()
    }

    // Click bulk archive
    const bulkArchiveButton = bulkActionBar.getByRole('button', { name: /archive/i })
    await bulkArchiveButton.click()

    // Should show partial success message
    await expect(page.getByText(/1.*project.*archived.*successfully/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/1.*project.*failed/i)).toBeVisible({ timeout: 5000 })

    // Should show detailed error information
    await expect(modal.errorMessage).toContainText(/active.*sessions/i)
  })
})

/**
 * Helper function to set up test projects
 */
async function setupTestProjects(page: Page) {
  const projects = ManageProjectModalTestData.existingProjects

  // Mock the projects API endpoint
  await page.route('**/api/projects**', async (route) => {
    const url = route.request().url()

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: projects,
          total: projects.length
        })
      })
    } else {
      await route.continue()
    }
  })

  // Mock project actions (edit, delete, archive, etc.)
  await page.route('**/api/projects/*', async (route) => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'PUT' || method === 'PATCH') {
      // Edit project
      const requestData = await route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Project updated successfully',
          data: { ...requestData }
        })
      })
    } else if (method === 'DELETE') {
      // Delete project
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Project deleted successfully'
        })
      })
    } else {
      await route.continue()
    }
  })
}
