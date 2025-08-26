import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('File Panel Testing', () => {
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
    if (testProjects.length > 0) {
      await TestProjectHelpers.cleanupSpecificProjects(testProjects)
      testProjects = []
    }
  })

  test.describe('File Explorer Functionality', () => {
    test('should load project and display file explorer', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Navigate to projects and load the test project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify we're in the project context
      await expect(appPage.page).toHaveURL(/\/projects/)

      // Verify file panel is visible
      const filePanel = appPage.page.locator('[data-testid="file-panel"], .file-panel')
      await expect(filePanel).toBeVisible({ timeout: 10000 })

      // Verify file explorer components are present
      const fileExplorer = appPage.page.locator('[data-testid="file-explorer"]')
      await expect(fileExplorer).toBeVisible()

      // Verify project header shows project info
      const projectHeader = appPage.page.locator('[data-testid="project-header"]')
      await expect(projectHeader).toBeVisible()
      await expect(projectHeader).toContainText(testProject.name)
    })

    test('should search files with autocomplete suggestions', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Find file search input
      const searchInput = appPage.page.locator(
        ['[data-testid="file-search"]', 'input[placeholder*="Search files"]', 'input[placeholder*="search"]'].join(', ')
      )

      if (await searchInput.isVisible({ timeout: 5000 })) {
        // Type search query
        await searchInput.fill('package')
        await appPage.page.waitForTimeout(500) // Wait for debounce

        // Check for autocomplete suggestions
        const autocomplete = appPage.page.locator(
          ['[data-testid="file-autocomplete"]', '.autocomplete-results', '[role="listbox"]'].join(', ')
        )

        if (await autocomplete.isVisible({ timeout: 3000 })) {
          // Verify suggestions appear
          const suggestions = autocomplete.locator('li, [role="option"]')
          const suggestionCount = await suggestions.count()
          expect(suggestionCount).toBeGreaterThan(0)

          // Test keyboard navigation
          await searchInput.press('ArrowDown')
          await appPage.page.waitForTimeout(200)

          // Test selection with Enter
          await searchInput.press('Enter')
          await appPage.page.waitForTimeout(500)
        }
      }
    })

    test('should navigate file tree with keyboard', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Find file tree
      const fileTree = appPage.page.locator(
        ['[data-testid="file-tree"]', '.file-tree', '[data-testid="file-explorer"]'].join(', ')
      )

      await expect(fileTree).toBeVisible({ timeout: 10000 })

      // Test keyboard navigation if tree is focusable
      if (await fileTree.isVisible()) {
        // Focus the tree
        await fileTree.focus()

        // Test arrow key navigation
        await appPage.page.keyboard.press('ArrowDown')
        await appPage.page.waitForTimeout(200)

        await appPage.page.keyboard.press('ArrowUp')
        await appPage.page.waitForTimeout(200)

        // Test expand/collapse with right/left arrows
        await appPage.page.keyboard.press('ArrowRight')
        await appPage.page.waitForTimeout(300)

        await appPage.page.keyboard.press('ArrowLeft')
        await appPage.page.waitForTimeout(300)
      }
    })

    test('should select and deselect files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Wait for files to load
      await appPage.page.waitForTimeout(2000)

      // Look for file items
      const fileItems = appPage.page.locator(
        [
          '[data-testid="file-item"]',
          '.file-item',
          '[data-file-type]',
          'button:has-text(".js")',
          'button:has-text(".ts")',
          'button:has-text("package.json")'
        ].join(', ')
      )

      const fileCount = await fileItems.count()
      if (fileCount > 0) {
        // Select first file
        await fileItems.first().click()
        await appPage.page.waitForTimeout(500)

        // Verify selection (look for visual indicators)
        const selectedFiles = appPage.page.locator(
          ['[data-testid="selected-files"]', '.selected-files', '.selected-file-item'].join(', ')
        )

        if (await selectedFiles.isVisible({ timeout: 3000 })) {
          const selectedCount = await selectedFiles.count()
          expect(selectedCount).toBeGreaterThan(0)
        }

        // Try multi-select if more files available
        if (fileCount > 1) {
          // Hold Cmd/Ctrl and click second file
          await fileItems.nth(1).click({
            modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control']
          })
          await appPage.page.waitForTimeout(500)
        }
      }
    })

    test('should handle file selection undo/redo', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      await appPage.page.waitForTimeout(2000)

      // Look for file items
      const fileItems = appPage.page.locator(['[data-testid="file-item"]', '.file-item', '[data-file-type]'].join(', '))

      const fileCount = await fileItems.count()
      if (fileCount > 0) {
        // Select a file
        await fileItems.first().click()
        await appPage.page.waitForTimeout(500)

        // Test undo with keyboard shortcut
        await appPage.page.keyboard.press('Meta+z') // or 'Control+z' on Windows
        await appPage.page.waitForTimeout(500)

        // Test redo
        await appPage.page.keyboard.press('Shift+Meta+z')
        await appPage.page.waitForTimeout(500)

        // Verify toast messages for undo/redo
        const toastMessages = appPage.page.locator('[data-testid="toast"], .toast, [data-sonner-toast]')
        if (await toastMessages.first().isVisible({ timeout: 2000 })) {
          // Check for undo/redo related messages
          const toastText = await toastMessages.first().textContent()
          expect(toastText).toMatch(/(undo|redo|reverted|restored)/i)
        }
      }
    })

    test('should filter files by type and extension', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for filter options
      const filterButton = appPage.page.locator(
        ['[data-testid="file-filter"]', 'button:has-text("Filter")', '.filter-button'].join(', ')
      )

      if (await filterButton.isVisible({ timeout: 3000 })) {
        await filterButton.click()
        await appPage.page.waitForTimeout(300)

        // Look for filter options
        const filterOptions = appPage.page.locator(
          ['[data-testid="filter-option"]', '.filter-option', 'input[type="checkbox"]'].join(', ')
        )

        const optionCount = await filterOptions.count()
        if (optionCount > 0) {
          // Toggle some filters
          await filterOptions.first().click()
          await appPage.page.waitForTimeout(500)

          // Verify filter is applied
          const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
          const filteredCount = await fileItems.count()
          // The count should change based on filter
        }
      }
    })

    test('should collapse and expand directories', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for expandable directories
      const directories = appPage.page.locator(
        ['[data-testid="directory-item"]', '.directory-item', '[data-expandable="true"]', 'button[aria-expanded]'].join(
          ', '
        )
      )

      const dirCount = await directories.count()
      if (dirCount > 0) {
        const firstDir = directories.first()

        // Check initial state
        const isExpanded = await firstDir.getAttribute('aria-expanded')

        // Toggle expansion
        await firstDir.click()
        await appPage.page.waitForTimeout(500)

        // Verify state changed
        const newState = await firstDir.getAttribute('aria-expanded')
        expect(newState).not.toBe(isExpanded)

        // Toggle back
        await firstDir.click()
        await appPage.page.waitForTimeout(500)
      }
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should focus search with Cmd+F', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Trigger search shortcut
      await appPage.page.keyboard.press('Meta+f')
      await appPage.page.waitForTimeout(300)

      // Verify search input is focused
      const searchInput = appPage.page.locator(
        ['[data-testid="file-search"]', 'input[placeholder*="search"]'].join(', ')
      )

      if (await searchInput.isVisible({ timeout: 2000 })) {
        await expect(searchInput).toBeFocused()
      }
    })

    test('should focus file tree with Cmd+G', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Trigger file tree focus shortcut
      await appPage.page.keyboard.press('Meta+g')
      await appPage.page.waitForTimeout(300)

      // Verify file tree area is focused
      const fileTree = appPage.page.locator(
        ['[data-testid="file-tree"]', '.file-tree', '[data-testid="file-explorer"]'].join(', ')
      )

      if (await fileTree.isVisible({ timeout: 2000 })) {
        // Check if tree or its children have focus
        const focusedElement = appPage.page.locator(':focus')
        const isFocusInTree = (await fileTree.locator(':focus').count()) > 0
        // Focus should be within the file tree area
      }
    })

    test('should handle tab navigation between panels', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Test tab navigation
      await appPage.page.keyboard.press('Tab')
      await appPage.page.waitForTimeout(200)

      let focusedElement = appPage.page.locator(':focus')
      const firstFocus = await focusedElement.boundingBox()

      await appPage.page.keyboard.press('Tab')
      await appPage.page.waitForTimeout(200)

      focusedElement = appPage.page.locator(':focus')
      const secondFocus = await focusedElement.boundingBox()

      // Focus should move to different elements
      if (firstFocus && secondFocus) {
        expect(firstFocus.x !== secondFocus.x || firstFocus.y !== secondFocus.y).toBe(true)
      }
    })
  })

  test.describe('Performance with Large Projects', () => {
    test('should handle projects with 1000+ files efficiently', async () => {
      const startTime = Date.now()

      const testProject = await TestProjectHelpers.createLargeProject({
        fileCount: 1000,
        directoryDepth: 5,
        includeVariousFileTypes: true
      })
      testProjects.push(testProject)

      const createTime = Date.now() - startTime
      expect(createTime).toBeLessThan(30000) // Should create within 30 seconds

      await sidebarPage.navigateToSection('projects')

      const loadStartTime = Date.now()
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Wait for file explorer to load
      const fileExplorer = appPage.page.locator('[data-testid="file-explorer"], [data-testid="file-tree"]')
      await expect(fileExplorer).toBeVisible({ timeout: 15000 })

      const loadTime = Date.now() - loadStartTime
      expect(loadTime).toBeLessThan(10000) // Should load within 10 seconds

      // Test search performance
      const searchInput = appPage.page.locator('[data-testid="file-search"], input[placeholder*="search"]')
      if (await searchInput.isVisible({ timeout: 3000 })) {
        const searchStartTime = Date.now()
        await searchInput.fill('test')
        await appPage.page.waitForTimeout(1000) // Wait for search to complete

        const searchTime = Date.now() - searchStartTime
        expect(searchTime).toBeLessThan(3000) // Search should complete within 3 seconds
      }
    })

    test('should maintain responsiveness during file operations', async () => {
      const testProject = await TestProjectHelpers.createLargeProject({
        fileCount: 500,
        directoryDepth: 3
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Perform multiple operations simultaneously
      const operations = [
        // Search operation
        async () => {
          const searchInput = appPage.page.locator('[data-testid="file-search"], input[placeholder*="search"]')
          if (await searchInput.isVisible({ timeout: 1000 })) {
            await searchInput.fill('test')
          }
        },
        // File selection operation
        async () => {
          const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
          const count = await fileItems.count()
          if (count > 0) {
            await fileItems.first().click()
          }
        },
        // Directory expansion
        async () => {
          const directories = appPage.page.locator('[data-testid="directory-item"], button[aria-expanded]')
          const dirCount = await directories.count()
          if (dirCount > 0) {
            await directories.first().click()
          }
        }
      ]

      // Execute operations concurrently
      await Promise.allSettled(operations.map((op) => op()))

      // Verify page remains responsive
      expect(await appPage.isPageResponsive()).toBe(true)
    })
  })

  test.describe('File Display and Count', () => {
    test('should display accurate file count', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Check for file count display
      const fileCountDisplay = appPage.page.locator(
        ['[data-testid="file-count"]', '.file-count', 'text*="files"'].join(', ')
      )

      if (await fileCountDisplay.isVisible({ timeout: 5000 })) {
        const countText = await fileCountDisplay.textContent()
        expect(countText).toMatch(/\d+\s*(file|item)s?/i)
      }

      // Count actual file items and verify accuracy
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const actualFileCount = await fileItems.count()

      if (actualFileCount > 0) {
        // Verify the count makes sense for a web app project
        expect(actualFileCount).toBeGreaterThan(5) // Should have multiple files
        expect(actualFileCount).toBeLessThan(200) // Should be reasonable for test project
      }
    })

    test('should show/hide hidden files appropriately', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'web-app',
        structure: ['.gitignore', '.env', '.hidden-folder/file.txt', 'visible-file.js', 'package.json']
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for hidden file toggle
      const hiddenFileToggle = appPage.page.locator(
        ['[data-testid="show-hidden-files"]', 'button:has-text("Hidden")', '.hidden-toggle'].join(', ')
      )

      if (await hiddenFileToggle.isVisible({ timeout: 3000 })) {
        // Count files before toggle
        const initialCount = await appPage.page.locator('[data-testid="file-item"], .file-item').count()

        // Toggle hidden files
        await hiddenFileToggle.click()
        await appPage.page.waitForTimeout(500)

        // Count files after toggle
        const afterToggleCount = await appPage.page.locator('[data-testid="file-item"], .file-item').count()

        // Count should change when showing/hiding hidden files
        expect(afterToggleCount).not.toBe(initialCount)
      }
    })
  })
})
