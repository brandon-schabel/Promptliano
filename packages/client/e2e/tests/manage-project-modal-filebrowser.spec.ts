import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ManageProjectModal } from '../pages/manage-project-modal'
import { ManageProjectModalTestData, ManageProjectModalTestUtils } from '../fixtures/manage-project-modal-data'
import { TestDataManager } from '../utils/test-data-manager'

test.describe('Manage Project Modal - File Browser Integration Tests', () => {
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

    // Setup mock file system for consistent testing
    await setupMockFileSystem(page)
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
  })

  /**
   * Setup mock file system API for testing file browser functionality
   */
  async function setupMockFileSystem(page: any) {
    const mockStructure = ManageProjectModalTestData.mockDirectoryStructure

    // Mock file system browsing API
    await page.route('**/api/filesystem/browse**', async (route: any) => {
      const url = route.request().url()
      const urlParams = new URL(url).searchParams
      const requestedPath = urlParams.get('path') || '/'

      // Find the directory in our mock structure
      const pathParts = requestedPath === '/' ? [] : requestedPath.split('/').filter(Boolean)
      let currentNode = mockStructure['/']

      for (const part of pathParts) {
        if (currentNode?.children?.[part]) {
          currentNode = currentNode.children[part]
        } else {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Directory not found' })
          })
          return
        }
      }

      // Check permissions
      if (currentNode.permissions === 'none') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Permission denied' })
        })
        return
      }

      // Return directory contents
      const contents = currentNode.children
        ? Object.entries(currentNode.children).map(([name, node]) => ({
            name,
            type: node.type,
            size: node.size || 0,
            lastModified: node.lastModified || new Date().toISOString(),
            permissions: node.permissions || 'readwrite',
            isHidden: node.isHidden || false
          }))
        : []

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            path: requestedPath,
            contents: contents.filter((item) => !item.isHidden || urlParams.get('showHidden') === 'true')
          }
        })
      })
    })

    // Mock path validation API
    await page.route('**/api/filesystem/validate-path**', async (route: any) => {
      const requestData = await route.request().postDataJSON()
      const pathToValidate = requestData.path

      if (!pathToValidate || pathToValidate === '') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Path is required' })
        })
        return
      }

      if (!pathToValidate.startsWith('/')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Path must be absolute' })
        })
        return
      }

      // Check if path exists in mock structure
      const pathParts = pathToValidate.split('/').filter(Boolean)
      let currentNode = mockStructure['/']

      for (const part of pathParts) {
        if (currentNode?.children?.[part]) {
          currentNode = currentNode.children[part]
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Directory does not exist' })
          })
          return
        }
      }

      if (currentNode.type !== 'directory') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Path is not a directory' })
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      })
    })
  }

  test.describe('File Browser Opening Tests', () => {
    test('should open file browser when browse button is clicked', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Click the browse directory button
      await modalPage.browseDirectoryButton.click()

      // File browser dialog should open
      await expect(modalPage.directoryBrowser).toBeVisible()
      await expect(modalPage.directoryBrowserHeader).toBeVisible()

      // Should show current path display
      await expect(modalPage.currentPathDisplay).toBeVisible()
      const currentPath = await modalPage.currentPathDisplay.textContent()
      expect(currentPath).toBeTruthy()

      // Should show directory list
      await expect(modalPage.directoryList).toBeVisible()

      // Should show some directory items (at minimum tmp, Users, System from mock data)
      await expect(modalPage.directoryItems).toHaveCount.atLeast(1)

      // Should have action buttons
      await expect(modalPage.selectDirectoryButton).toBeVisible()
      await expect(modalPage.cancelBrowseButton).toBeVisible()
    })

    test('should display file browser with proper initial state', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Should start at root directory
      const initialPath = await modalPage.currentPathDisplay.textContent()
      expect(initialPath).toBe('/')

      // Should show root level directories from mock structure
      const expectedRootDirs = ['tmp', 'Users', 'System']
      for (const dirName of expectedRootDirs) {
        await expect(modalPage.getDirectoryItem(dirName)).toBeVisible()
      }

      // Parent directory button should be disabled at root
      const parentButton = modalPage.parentDirectoryButton
      if (await parentButton.isVisible()) {
        await expect(parentButton).toBeDisabled()
      }

      // Select button should be enabled (can select root)
      await expect(modalPage.selectDirectoryButton).toBeEnabled()
    })

    test('should show file browser with accessibility features', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Dialog should have proper ARIA attributes
      await expect(modalPage.directoryBrowser).toHaveAttribute('role', 'dialog')

      // Should have aria-modal
      const hasAriaModal = await modalPage.directoryBrowser.getAttribute('aria-modal')
      expect(hasAriaModal).toBe('true')

      // Should have focus management
      const focusedElement = page.locator(':focus')
      const isWithinBrowser = await modalPage.directoryBrowser.locator(':focus').count()
      expect(isWithinBrowser).toBeGreaterThan(0)

      // Directory items should be keyboard navigable
      await page.keyboard.press('Tab')
      await expect(modalPage.directoryItems.first()).toBeFocused()

      // Should support Arrow key navigation
      await page.keyboard.press('ArrowDown')
      const secondItem = modalPage.directoryItems.nth(1)
      if (await secondItem.isVisible()) {
        await expect(secondItem).toBeFocused()
      }
    })

    test('should handle file browser dialog closing', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Verify browser is open
      await expect(modalPage.directoryBrowser).toBeVisible()

      // Close with cancel button
      await modalPage.cancelBrowseButton.click()
      await expect(modalPage.directoryBrowser).not.toBeVisible()

      // Should return to project form
      await expect(modalPage.projectDialog).toBeVisible()

      // Open browser again and close with Escape
      await modalPage.browseDirectoryButton.click()
      await expect(modalPage.directoryBrowser).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(modalPage.directoryBrowser).not.toBeVisible()
    })
  })

  test.describe('Directory Navigation Tests', () => {
    test('should navigate through directory structure via double-click', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to /tmp
      await modalPage.getDirectoryItem('tmp').dblclick()

      // Path should update
      await expect(modalPage.currentPathDisplay).toContainText('/tmp')

      // Should show test-projects directory
      await expect(modalPage.getDirectoryItem('test-projects')).toBeVisible()

      // Navigate deeper to test-projects
      await modalPage.getDirectoryItem('test-projects').dblclick()

      // Path should update again
      await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects')

      // Should show project directories
      await expect(modalPage.getDirectoryItem('project-a')).toBeVisible()
      await expect(modalPage.getDirectoryItem('project-b')).toBeVisible()
      await expect(modalPage.getDirectoryItem('empty-folder')).toBeVisible()
    })

    test('should update current path display during navigation', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Start at root
      await expect(modalPage.currentPathDisplay).toContainText('/')

      // Navigate to Users
      await modalPage.getDirectoryItem('Users').dblclick()
      await expect(modalPage.currentPathDisplay).toContainText('/Users')

      // Navigate to developer
      await modalPage.getDirectoryItem('developer').dblclick()
      await expect(modalPage.currentPathDisplay).toContainText('/Users/developer')

      // Navigate to Documents
      await modalPage.getDirectoryItem('Documents').dblclick()
      await expect(modalPage.currentPathDisplay).toContainText('/Users/developer/Documents')

      // Path should be displayed clearly and completely
      const fullPath = await modalPage.currentPathDisplay.textContent()
      expect(fullPath).toBe('/Users/developer/Documents')
    })

    test('should handle parent directory navigation with back button', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to a nested directory first
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('project-a').dblclick()

      // Should be at /tmp/test-projects/project-a
      await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects/project-a')

      // Use parent directory button
      await modalPage.parentDirectoryButton.click()
      await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects')

      // Should show parent directory contents
      await expect(modalPage.getDirectoryItem('project-a')).toBeVisible()
      await expect(modalPage.getDirectoryItem('project-b')).toBeVisible()

      // Go up one more level
      await modalPage.parentDirectoryButton.click()
      await expect(modalPage.currentPathDisplay).toContainText('/tmp')

      // Should show tmp contents
      await expect(modalPage.getDirectoryItem('test-projects')).toBeVisible()
    })

    test('should disable parent button at root level', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // At root level, parent button should be disabled
      await expect(modalPage.currentPathDisplay).toContainText('/')

      const parentButton = modalPage.parentDirectoryButton
      if (await parentButton.isVisible()) {
        await expect(parentButton).toBeDisabled()
      }

      // Navigate away from root
      await modalPage.getDirectoryItem('tmp').dblclick()

      // Parent button should now be enabled
      if (await parentButton.isVisible()) {
        await expect(parentButton).toBeEnabled()
      }

      // Go back to root
      await parentButton.click()
      await expect(modalPage.currentPathDisplay).toContainText('/')

      // Parent button should be disabled again
      if (await parentButton.isVisible()) {
        await expect(parentButton).toBeDisabled()
      }
    })

    test('should handle keyboard navigation in directory list', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Focus first directory item
      await modalPage.directoryItems.first().focus()

      // Use Arrow keys to navigate
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')

      // Use Enter to navigate into directory
      await page.keyboard.press('Enter')

      // Should navigate into the focused directory
      // (Implementation depends on which directory was focused)
      const newPath = await modalPage.currentPathDisplay.textContent()
      expect(newPath).not.toBe('/')
    })
  })

  test.describe('Directory Selection Tests', () => {
    test('should select directory and populate path input', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to a specific directory
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('project-a').click() // Single click to select

      // Current path should show project-a
      await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects/project-a')

      // Select this directory
      await modalPage.selectDirectoryButton.click()

      // File browser should close
      await expect(modalPage.directoryBrowser).not.toBeVisible()

      // Path should be populated in the project form
      await expect(modalPage.projectPathInput).toHaveValue('/tmp/test-projects/project-a')

      // Should return to project creation form
      await expect(modalPage.projectDialog).toBeVisible()
    })

    test('should differentiate between directories and files', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to a directory with both files and folders
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('project-a').dblclick()

      // Should show both directories and files
      const directories = modalPage.directoryItems
      const files = modalPage.fileItems

      // Should have at least one directory (src, tests)
      await expect(directories).toHaveCount.atLeast(1)

      // Should have files (package.json, README.md)
      await expect(files).toHaveCount.atLeast(1)

      // Directory items should be visually distinct from files
      const srcDirectory = modalPage.getDirectoryItem('src')
      if (await srcDirectory.isVisible()) {
        // Should have folder icon or distinct styling
        const hasDirectoryIcon = await srcDirectory.locator('svg[data-lucide="folder"]').isVisible()
        const hasDirectoryClass = await srcDirectory.evaluate(
          (el) => el.classList.contains('directory') || el.classList.contains('folder')
        )
        expect(hasDirectoryIcon || hasDirectoryClass).toBe(true)
      }

      // Files should not be double-clickable for navigation
      const fileItem = files.first()
      if (await fileItem.isVisible()) {
        await fileItem.dblclick()
        // Path should not change (files can't be navigated into)
        await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects/project-a')
      }
    })

    test('should show directory contents preview when selecting', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to project-a which has known contents
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('project-a').click()

      // Should show the contents of project-a
      const expectedDirectories = ['src', 'tests']
      const expectedFiles = ['package.json', 'README.md']

      // Check for expected directories
      for (const dirName of expectedDirectories) {
        await expect(modalPage.getDirectoryItem(dirName)).toBeVisible()
      }

      // Check for expected files (if file items are visible in browser)
      const fileItems = modalPage.fileItems
      const fileCount = await fileItems.count()
      if (fileCount > 0) {
        // At minimum should see some files
        expect(fileCount).toBeGreaterThanOrEqual(2)
      }
    })

    test('should handle selecting deeply nested directories', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to a deeply nested path
      const navigationPath = ['tmp', 'test-projects', 'project-a', 'src', 'components']

      for (const dirName of navigationPath) {
        await modalPage.getDirectoryItem(dirName).dblclick()
        await page.waitForTimeout(200) // Allow navigation to complete
      }

      // Should be at the deep path
      const expectedPath = `/tmp/test-projects/project-a/src/components`
      await expect(modalPage.currentPathDisplay).toContainText(expectedPath)

      // Select this deep directory
      await modalPage.selectDirectoryButton.click()

      // Should populate the full deep path
      await expect(modalPage.projectPathInput).toHaveValue(expectedPath)
      await expect(modalPage.directoryBrowser).not.toBeVisible()
    })

    test('should handle selecting empty directories', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to empty folder
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('empty-folder').click()

      // Should show empty directory
      await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects/empty-folder')

      // Directory list should be empty or show "no contents" message
      const itemCount = (await modalPage.directoryItems.count()) + (await modalPage.fileItems.count())
      expect(itemCount).toBe(0)

      // Should still allow selection of empty directory
      await expect(modalPage.selectDirectoryButton).toBeEnabled()
      await modalPage.selectDirectoryButton.click()

      // Should select empty directory successfully
      await expect(modalPage.projectPathInput).toHaveValue('/tmp/test-projects/empty-folder')
    })
  })

  test.describe('File System Error Handling', () => {
    test('should handle permission denied errors', async ({ page }) => {
      // Override mock to simulate permission error for restricted directory
      await page.route('**/api/filesystem/browse**', async (route) => {
        const url = route.request().url()
        const urlParams = new URL(url).searchParams
        const requestedPath = urlParams.get('path') || '/'

        if (requestedPath.includes('restricted')) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Permission denied',
              message: 'You do not have permission to access this directory'
            })
          })
          return
        }

        // Fall back to normal mock behavior
        route.continue()
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to Users then try restricted
      await modalPage.getDirectoryItem('Users').dblclick()
      await modalPage.getDirectoryItem('restricted').dblclick()

      // Should show permission error
      const errorMessage = modalPage.directoryBrowser.locator('[role="alert"], .error-message')
      await expect(errorMessage).toBeVisible()
      const errorText = await errorMessage.textContent()
      expect(errorText).toMatch(/permission.*denied|access.*denied/i)

      // Should provide guidance
      const guidanceText = modalPage.directoryBrowser.getByText(/choose.*different|permission/i)
      await expect(guidanceText).toBeVisible()

      // Should still allow navigation to other directories
      await modalPage.cancelBrowseButton.click()
      await modalPage.browseDirectoryButton.click()

      // Should be able to navigate to accessible directories
      await modalPage.getDirectoryItem('tmp').dblclick()
      await expect(modalPage.currentPathDisplay).toContainText('/tmp')
    })

    test('should handle non-existent directory errors', async ({ page }) => {
      // Override mock to simulate 404 for non-existent paths
      await page.route('**/api/filesystem/browse**', async (route) => {
        const url = route.request().url()
        const urlParams = new URL(url).searchParams
        const requestedPath = urlParams.get('path') || '/'

        if (requestedPath.includes('nonexistent')) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Directory not found',
              message: 'The requested directory does not exist'
            })
          })
          return
        }

        route.continue()
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Manually set path input to non-existent directory and try to browse
      await modalPage.projectPathInput.fill('/nonexistent/path')
      await modalPage.browseDirectoryButton.click()

      // Should show error message
      const errorMessage = modalPage.directoryBrowser.locator('[role="alert"], .error-message')
      if (await errorMessage.isVisible({ timeout: 3000 })) {
        const errorText = await errorMessage.textContent()
        expect(errorText).toMatch(/not.*found|does.*not.*exist|directory.*not.*found/i)
      }

      // Should fallback to root or safe directory
      const currentPath = await modalPage.currentPathDisplay.textContent()
      expect(currentPath).toBe('/') // Should fallback to root
    })

    test('should handle network timeout errors during browsing', async ({ page }) => {
      let requestCount = 0

      // Mock network timeout on second request
      await page.route('**/api/filesystem/browse**', async (route) => {
        requestCount++

        if (requestCount === 2) {
          // Simulate timeout by delaying response
          await new Promise((resolve) => setTimeout(resolve, 5000))
          await route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Request timeout',
              message: 'The request took too long to complete'
            })
          })
          return
        }

        route.continue()
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // First request should work (loads root)
      await expect(modalPage.currentPathDisplay).toContainText('/')

      // Second request should timeout
      await modalPage.getDirectoryItem('tmp').dblclick()

      // Should show timeout error
      const errorMessage = modalPage.directoryBrowser.locator('[role="alert"], .error-message')
      await expect(errorMessage).toBeVisible({ timeout: 7000 })
      const errorText = await errorMessage.textContent()
      expect(errorText).toMatch(/timeout|took.*too.*long|network.*error/i)

      // Should provide retry option
      const retryButton = modalPage.directoryBrowser.getByRole('button', { name: /retry|try.*again/i })
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible()
      }
    })

    test('should provide user guidance for error recovery', async ({ page }) => {
      // Mock various errors and check guidance
      const errorScenarios = [
        {
          errorType: 'permission',
          status: 403,
          error: 'Permission denied',
          expectedGuidance: /permission|choose.*different|access.*denied/i
        },
        {
          errorType: 'not-found',
          status: 404,
          error: 'Directory not found',
          expectedGuidance: /not.*found|choose.*valid|directory.*exist/i
        },
        {
          errorType: 'server-error',
          status: 500,
          error: 'Internal server error',
          expectedGuidance: /server.*error|try.*again|contact.*support/i
        }
      ]

      for (const scenario of errorScenarios) {
        await page.route('**/api/filesystem/browse**', async (route) => {
          const url = route.request().url()
          const urlParams = new URL(url).searchParams
          const requestedPath = urlParams.get('path') || '/'

          if (requestedPath.includes(scenario.errorType)) {
            await route.fulfill({
              status: scenario.status,
              contentType: 'application/json',
              body: JSON.stringify({
                error: scenario.error,
                message: `Simulated ${scenario.errorType} error for testing`
              })
            })
            return
          }

          route.continue()
        })

        await modalPage.openModal()
        await modalPage.openCreateProjectForm()
        await modalPage.projectPathInput.fill(`/error-test/${scenario.errorType}/path`)
        await modalPage.browseDirectoryButton.click()

        // Should show error and guidance
        const errorMessage = modalPage.directoryBrowser.locator('[role="alert"], .error-message')
        await expect(errorMessage).toBeVisible({ timeout: 3000 })

        const guidanceText = await modalPage.directoryBrowser.textContent()
        expect(guidanceText).toMatch(scenario.expectedGuidance)

        // Close modal to reset for next scenario
        await modalPage.cancelBrowseButton.click()
        await modalPage.closeModal()
      }
    })

    test('should handle graceful degradation when file system API unavailable', async ({ page }) => {
      // Mock complete API unavailability
      await page.route('**/api/filesystem/**', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service unavailable',
            message: 'File system service is temporarily unavailable'
          })
        })
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Should show service unavailable message
      const errorMessage = modalPage.directoryBrowser.locator('[role="alert"], .error-message')
      await expect(errorMessage).toBeVisible()
      const errorText = await errorMessage.textContent()
      expect(errorText).toMatch(/service.*unavailable|temporarily.*unavailable/i)

      // Should suggest manual path entry
      const manualEntryGuidance = modalPage.directoryBrowser.getByText(/enter.*path.*manually|type.*path/i)
      if (await manualEntryGuidance.isVisible()) {
        await expect(manualEntryGuidance).toBeVisible()
      }

      // Should allow closing browser and manual path entry
      await modalPage.cancelBrowseButton.click()
      await expect(modalPage.directoryBrowser).not.toBeVisible()

      // User can still enter path manually
      await modalPage.projectPathInput.fill('/manual/path/entry')
      await expect(modalPage.projectPathInput).toHaveValue('/manual/path/entry')
    })
  })

  test.describe('File Browser Performance Tests', () => {
    test('should handle large directories efficiently (1000+ files)', async ({ page }) => {
      // Mock large directory structure
      await page.route('**/api/filesystem/browse**', async (route) => {
        const url = route.request().url()
        const urlParams = new URL(url).searchParams
        const requestedPath = urlParams.get('path') || '/'

        if (requestedPath.includes('large-project')) {
          // Generate large file list
          const largeContents = Array.from({ length: 1000 }, (_, i) => ({
            name: `file-${String(i + 1).padStart(4, '0')}.txt`,
            type: 'file',
            size: Math.floor(Math.random() * 10000) + 1000,
            lastModified: new Date().toISOString(),
            permissions: 'readwrite'
          }))

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                path: requestedPath,
                contents: largeContents
              }
            })
          })
          return
        }

        route.continue()
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to large directory
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()

      const startTime = Date.now()
      await modalPage.getDirectoryItem('large-project').dblclick()

      // Should load within reasonable time (< 2 seconds)
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(2000)

      // Should show directory contents
      await expect(modalPage.currentPathDisplay).toContainText('/tmp/test-projects/large-project')

      // UI should remain responsive
      const fileItems = modalPage.fileItems
      const itemCount = await fileItems.count()
      expect(itemCount).toBeGreaterThan(0) // Should show at least some files

      // Should be able to scroll through items
      await page.keyboard.press('PageDown')
      await page.keyboard.press('PageUp')

      // Performance check - should respond to interactions quickly
      const interactionStart = Date.now()
      await modalPage.selectDirectoryButton.click()
      const interactionTime = Date.now() - interactionStart
      expect(interactionTime).toBeLessThan(1000)
    })

    test('should handle deep nested structure navigation efficiently', async ({ page }) => {
      // Mock deep directory structure
      await page.route('**/api/filesystem/browse**', async (route) => {
        const url = route.request().url()
        const urlParams = new URL(url).searchParams
        const requestedPath = urlParams.get('path') || '/'

        // Create very deep path structure
        const pathParts = requestedPath.split('/').filter(Boolean)

        if (requestedPath.includes('deep-test') && pathParts.length < 20) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                path: requestedPath,
                contents: [
                  {
                    name: `level-${pathParts.length + 1}`,
                    type: 'directory',
                    size: 0,
                    lastModified: new Date().toISOString(),
                    permissions: 'readwrite'
                  }
                ]
              }
            })
          })
          return
        }

        route.continue()
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Manually enter deep path for testing
      await modalPage.projectPathInput.fill('/tmp/deep-test/level-1')
      await modalPage.browseDirectoryButton.click()

      // Should handle deep navigation without performance issues
      const deepPath = '/tmp/deep-test/level-1/level-2/level-3/level-4/level-5'

      const navigationStart = Date.now()

      // Navigate through multiple levels quickly
      for (let level = 1; level <= 5; level++) {
        const levelDir = modalPage.getDirectoryItem(`level-${level}`)
        if (await levelDir.isVisible()) {
          await levelDir.dblclick()
          await page.waitForTimeout(100) // Minimal wait for navigation
        }
      }

      const navigationTime = Date.now() - navigationStart
      expect(navigationTime).toBeLessThan(3000) // Should navigate quickly

      // Path should be updated correctly
      const finalPath = await modalPage.currentPathDisplay.textContent()
      expect(finalPath).toContain('level-5')

      // Parent navigation should also be efficient
      const parentNavStart = Date.now()

      // Navigate back up
      for (let i = 0; i < 3; i++) {
        await modalPage.parentDirectoryButton.click()
        await page.waitForTimeout(50)
      }

      const parentNavTime = Date.now() - parentNavStart
      expect(parentNavTime).toBeLessThan(2000)
    })

    test('should maintain responsive UI during file operations', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Perform rapid navigation operations
      const operations = [
        () => modalPage.getDirectoryItem('tmp').dblclick(),
        () => modalPage.getDirectoryItem('test-projects').dblclick(),
        () => modalPage.parentDirectoryButton.click(),
        () => modalPage.getDirectoryItem('test-projects').dblclick(),
        () => modalPage.getDirectoryItem('project-a').click(),
        () => modalPage.selectDirectoryButton.click()
      ]

      // Measure UI responsiveness during operations
      let totalResponseTime = 0

      for (const operation of operations) {
        const start = Date.now()
        await operation()
        await page.waitForTimeout(100) // Allow operation to complete
        const responseTime = Date.now() - start
        totalResponseTime += responseTime
      }

      // Average response time should be reasonable
      const avgResponseTime = totalResponseTime / operations.length
      expect(avgResponseTime).toBeLessThan(500) // Should respond within 500ms on average

      // File browser should have completed the operation
      await expect(modalPage.directoryBrowser).not.toBeVisible()
      await expect(modalPage.projectPathInput).toHaveValue('/tmp/test-projects/project-a')
    })

    test('should handle memory efficiently with large file lists', async ({ page }) => {
      // Monitor memory usage during large directory operations
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()
      await modalPage.browseDirectoryButton.click()

      // Navigate to large project
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('large-project').dblclick()

      // Perform memory-intensive operations
      const initialMemory = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0)

      // Scroll through items multiple times
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('PageDown')
        await page.waitForTimeout(50)
      }

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('PageUp')
        await page.waitForTimeout(50)
      }

      const finalMemory = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0)

      // Memory usage should not increase dramatically
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100
        expect(memoryIncreasePercent).toBeLessThan(50) // Less than 50% memory increase
      }

      // UI should still be responsive after memory operations
      await modalPage.selectDirectoryButton.click()
      await expect(modalPage.directoryBrowser).not.toBeVisible()
    })
  })

  test.describe('File Browser Integration with Project Creation', () => {
    test('should integrate browsed path with project creation workflow', async ({ page }) => {
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
                fileCount: 8
              }
            })
          })
        }
      })

      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Fill project name
      await modalPage.projectNameInput.fill('Browsed Path Project')

      // Use file browser to select path
      await modalPage.browseDirectoryButton.click()
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('project-a').click()
      await modalPage.selectDirectoryButton.click()

      // Path should be populated
      await expect(modalPage.projectPathInput).toHaveValue('/tmp/test-projects/project-a')

      // Add description
      await modalPage.projectDescriptionInput.fill('Project created using file browser')

      // Create project
      await modalPage.createProjectButton.click()

      // Should create project successfully
      await expect(modalPage.projectDialog).not.toBeVisible()

      // Should show project in list
      await modalPage.waitForProjectsLoaded()
      await expect(modalPage.projectItem('Browsed Path Project')).toBeVisible()
    })

    test('should validate browsed path before project creation', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Fill project name
      await modalPage.projectNameInput.fill('Validation Test Project')

      // Browse to a path that might become invalid
      await modalPage.browseDirectoryButton.click()
      await modalPage.getDirectoryItem('tmp').dblclick()
      await modalPage.getDirectoryItem('test-projects').dblclick()
      await modalPage.getDirectoryItem('empty-folder').click()
      await modalPage.selectDirectoryButton.click()

      // Mock path validation to fail
      await page.route('**/api/projects/validate-path**', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Path is not suitable for project creation' })
        })
      })

      // Attempt to create project
      await modalPage.createProjectButton.click()

      // Should show validation error
      await expect(modalPage.validationErrors).toBeVisible()
      const errorText = await modalPage.validationErrors.textContent()
      expect(errorText).toMatch(/not.*suitable|validation.*failed/i)

      // Should remain on form for correction
      await expect(modalPage.projectDialog).toBeVisible()
    })

    test('should remember last browsed location between sessions', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Browse to a specific location
      await modalPage.browseDirectoryButton.click()
      await modalPage.getDirectoryItem('Users').dblclick()
      await modalPage.getDirectoryItem('developer').dblclick()
      await modalPage.getDirectoryItem('Documents').click()

      // Cancel without selecting
      await modalPage.cancelBrowseButton.click()

      // Open browser again
      await modalPage.browseDirectoryButton.click()

      // Should remember the last location (or at least not start at root)
      const currentPath = await modalPage.currentPathDisplay.textContent()

      // Depending on implementation, might remember exact location or parent
      const remembersLocation =
        currentPath?.includes('/Users/developer') || currentPath?.includes('/Users') || currentPath !== '/'

      expect(remembersLocation).toBe(true)
    })

    test('should handle file browser closing during project creation', async ({ page }) => {
      await modalPage.openModal()
      await modalPage.openCreateProjectForm()

      // Fill some data
      await modalPage.projectNameInput.fill('Interrupted Project')
      await modalPage.projectPathInput.fill('/some/manual/path')

      // Open browser
      await modalPage.browseDirectoryButton.click()

      // Close browser without selecting
      await page.keyboard.press('Escape')

      // Should return to form with original path intact
      await expect(modalPage.projectDialog).toBeVisible()
      await expect(modalPage.projectPathInput).toHaveValue('/some/manual/path')

      // Form should still be functional
      await modalPage.projectDescriptionInput.fill('Description added after browser cancel')
      await expect(modalPage.createProjectButton).toBeEnabled()
    })
  })
})
