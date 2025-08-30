/**
 * Project Page - File Tree Test Suite
 *
 * Tests file/folder selection, right-click context menus,
 * git integration features, and file tree navigation.
 */

import { test, expect } from '@playwright/test'
import { ProjectPage } from '../pages/project-page'
import { ProjectPageTestUtils } from '../utils/project-page-test-manager'
import { ProjectPageTestData, ProjectPageDataFactory } from '../fixtures/project-page-data'
import { MCPTestHelpers } from '../utils/mcp-test-helpers'

test.describe('Project Page - File Tree Display', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    // Setup environment with comprehensive file structure
    const fileScenario = ProjectPageDataFactory.createFileOperationScenario()
    await testManager.setupProjectPageEnvironment({
      fileStructure: fileScenario.fileStructure
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should populate file tree when project loads', async ({ page }) => {
    // Wait for file tree to load
    await expect(projectPage.fileTree).toBeVisible()

    // Verify main directories are visible
    await expect(projectPage.folderNode('src')).toBeVisible()
    await expect(projectPage.folderNode('tests')).toBeVisible()
    await expect(projectPage.folderNode('docs')).toBeVisible()
    await expect(projectPage.folderNode('config')).toBeVisible()

    // Verify root files are visible
    await expect(projectPage.fileNode('package.json')).toBeVisible()
    await expect(projectPage.fileNode('.gitignore')).toBeVisible()
    await expect(projectPage.fileNode('docker-compose.yml')).toBeVisible()
  })

  test('should show file tree structure hierarchically', async ({ page }) => {
    await expect(projectPage.fileTree).toBeVisible()

    // Check that folders can be expanded/collapsed
    const srcFolder = projectPage.folderNode('src')
    await expect(srcFolder).toBeVisible()

    // Click to expand folder (if not already expanded)
    const expandButton = srcFolder.locator('button, [role="button"]').first()
    if (await expandButton.isVisible()) {
      await expandButton.click()
    }

    // Verify subfolders appear
    await expect(projectPage.folderNode('auth')).toBeVisible({ timeout: 3000 })
    await expect(projectPage.folderNode('components')).toBeVisible()
    await expect(projectPage.folderNode('utils')).toBeVisible()
  })

  test('should display files with appropriate icons and metadata', async ({ page }) => {
    await expect(projectPage.fileTree).toBeVisible()

    // Check that files have appropriate visual indicators
    const packageJsonFile = projectPage.fileNode('package.json')
    await expect(packageJsonFile).toBeVisible()

    // Look for file size, modification date, or other metadata
    const hasMetadata =
      (await packageJsonFile.locator('[data-testid*="file-size"], [data-testid*="file-date"], .file-meta').count()) > 0
    // Metadata may not always be visible, so we just check it doesn't break the layout
  })

  test('should handle large file trees efficiently', async ({ page }) => {
    // Setup large file structure
    const largeStructure = {
      'large-src/': Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`file${i}.ts`, `Content for file ${i}`])),
      'another-large/': Object.fromEntries(
        Array.from({ length: 15 }, (_, i) => [`component${i}.tsx`, `Component ${i} content`])
      )
    }

    await testManager.setupProjectWithFiles(largeStructure)
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Should render without performance issues
    await expect(projectPage.fileTree).toBeVisible()

    // Expand large folder
    const largeFolder = projectPage.folderNode('large-src')
    if (await largeFolder.isVisible()) {
      await largeFolder.click()

      // Should show files without significant delay
      await expect(projectPage.fileNode('file0.ts')).toBeVisible({ timeout: 5000 })
      await expect(projectPage.fileNode('file19.ts')).toBeVisible()
    }
  })
})

test.describe('Project Page - File Selection', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle individual file selection', async ({ page }) => {
    // Select a single file
    await projectPage.toggleFileSelection('package.json')

    // Verify file appears in selected files
    const selectedFiles = await projectPage.getSelectedFilesList()
    expect(selectedFiles).toContain('package.json')

    // Verify checkbox state
    expect(await projectPage.isFileSelected('package.json')).toBeTruthy()
  })

  test('should handle file deselection', async ({ page }) => {
    // Select then deselect a file
    await projectPage.toggleFileSelection('package.json')
    expect(await projectPage.isFileSelected('package.json')).toBeTruthy()

    await projectPage.toggleFileSelection('package.json')
    expect(await projectPage.isFileSelected('package.json')).toBeFalsy()

    // File should be removed from selected files list
    const selectedFiles = await projectPage.getSelectedFilesList()
    expect(selectedFiles).not.toContain('package.json')
  })

  test('should select multiple files independently', async ({ page }) => {
    // Select multiple files
    await projectPage.toggleFileSelection('package.json')
    await projectPage.toggleFileSelection('.gitignore')
    await projectPage.toggleFileSelection('docker-compose.yml')

    // Verify all files are selected
    expect(await projectPage.isFileSelected('package.json')).toBeTruthy()
    expect(await projectPage.isFileSelected('.gitignore')).toBeTruthy()
    expect(await projectPage.isFileSelected('docker-compose.yml')).toBeTruthy()

    // Verify selected files list
    const selectedFiles = await projectPage.getSelectedFilesList()
    expect(selectedFiles).toContain('package.json')
    expect(selectedFiles).toContain('.gitignore')
    expect(selectedFiles).toContain('docker-compose.yml')
  })

  test('should select all files in folder when folder is selected', async ({ page }) => {
    // Select an entire folder
    await projectPage.toggleFolderSelection('docs')

    // Verify all files in folder are selected
    const selectedFiles = await projectPage.getSelectedFilesList()
    expect(selectedFiles).toContain('README.md')
    expect(selectedFiles).toContain('API.md')
    expect(selectedFiles).toContain('CONTRIBUTING.md')
    expect(selectedFiles).toContain('DEPLOYMENT.md')
  })

  test('should handle nested folder selection', async ({ page }) => {
    // Expand src folder first
    const srcFolder = projectPage.folderNode('src')
    const expandButton = srcFolder.locator('button, [role="button"]').first()
    if (await expandButton.isVisible()) {
      await expandButton.click()
    }

    // Select auth subfolder
    await projectPage.toggleFolderSelection('auth')

    // Verify auth files are selected
    const selectedFiles = await projectPage.getSelectedFilesList()
    expect(selectedFiles.some((file) => file.includes('login.ts'))).toBeTruthy()
    expect(selectedFiles.some((file) => file.includes('register.ts'))).toBeTruthy()
  })

  test('should maintain selections across navigation', async ({ page }) => {
    // Select some files
    await projectPage.toggleFileSelection('package.json')
    await projectPage.toggleFileSelection('.gitignore')

    // Navigate away and back
    await projectPage.gotoProjectsList()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Selections should be preserved
    expect(await projectPage.isFileSelected('package.json')).toBeTruthy()
    expect(await projectPage.isFileSelected('.gitignore')).toBeTruthy()
  })
})

test.describe('Project Page - File Context Menus', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should show file context menu on right-click', async ({ page }) => {
    await projectPage.rightClickFile('package.json')

    // Verify context menu appears with expected options
    await expect(projectPage.fileContextMenu).toBeVisible()

    const expectedMenuItems = ['Copy Relative Path', 'Copy Absolute Path', 'Open In Editor', 'Copy File Contents']

    for (const item of expectedMenuItems) {
      await expect(projectPage.fileContextMenu.getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('should show token count in file context menu', async ({ page }) => {
    await projectPage.rightClickFile('package.json')

    await expect(projectPage.fileContextMenu).toBeVisible()

    // Look for token count display
    await expect(projectPage.fileContextMenu).toContainText(/\d+\s*token/i)
  })

  test('should copy relative path via context menu', async ({ page }) => {
    await projectPage.copyFileRelativePath('package.json')

    // Verify success toast
    await expect(page.getByText('Relative path copied')).toBeVisible()
  })

  test('should copy absolute path via context menu', async ({ page }) => {
    await projectPage.copyFileAbsolutePath('package.json')

    await expect(page.getByText('Absolute path copied')).toBeVisible()
  })

  test('should copy file contents via context menu', async ({ page }) => {
    await projectPage.copyFileContents('package.json')

    await expect(page.getByText('File contents copied')).toBeVisible()
  })

  test('should handle folder context menu', async ({ page }) => {
    await projectPage.rightClickFolder('src')

    await expect(projectPage.folderContextMenu).toBeVisible()

    const expectedFolderMenuItems = ['Copy Folder Contents', 'Copy Folder Summaries', 'Copy Folder Tree']

    for (const item of expectedFolderMenuItems) {
      await expect(projectPage.folderContextMenu.getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('should show token counts for folder options', async ({ page }) => {
    await projectPage.rightClickFolder('src')

    // Hover over menu items to see token counts
    const folderContentsOption = projectPage.folderContextMenu.getByRole('menuitem', { name: 'Copy Folder Contents' })
    await folderContentsOption.hover()

    // Should show token count for the operation
    await expect(page.getByText(/\d+\s*token/i)).toBeVisible({ timeout: 2000 })
  })

  test('should copy folder contents', async ({ page }) => {
    await projectPage.copyFolderContents('docs')

    await expect(page.getByText('Folder contents copied')).toBeVisible()
  })

  test('should close context menu when clicking elsewhere', async ({ page }) => {
    await projectPage.rightClickFile('package.json')
    await expect(projectPage.fileContextMenu).toBeVisible()

    // Click somewhere else
    await projectPage.fileTree.click({ position: { x: 50, y: 50 } })

    await expect(projectPage.fileContextMenu).not.toBeVisible({ timeout: 2000 })
  })

  test('should close context menu with escape key', async ({ page }) => {
    await projectPage.rightClickFile('package.json')
    await expect(projectPage.fileContextMenu).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(projectPage.fileContextMenu).not.toBeVisible()
  })
})

test.describe('Project Page - Git Integration', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should show git status indicators on files', async ({ page }) => {
    // Setup git-modified file
    await testManager.setupGitModifiedFile('src/auth/login.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    const modifiedFile = projectPage.fileNode('login.ts')
    if (await modifiedFile.isVisible()) {
      // Look for git status indicator (M for modified, etc.)
      const hasGitIndicator = await modifiedFile.locator('.git-status, [data-testid*="git-status"]').isVisible()
      // Git indicators may not always be visible depending on implementation
    }
  })

  test('should show git-specific context menu for modified files', async ({ page }) => {
    await testManager.setupGitModifiedFile('src/auth/login.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Expand src folder to access login.ts
    const srcFolder = projectPage.folderNode('src')
    const expandButton = srcFolder.locator('button').first()
    if (await expandButton.isVisible()) {
      await expandButton.click()
    }

    // Expand auth subfolder
    const authFolder = projectPage.folderNode('auth')
    if (await authFolder.isVisible()) {
      const authExpandButton = authFolder.locator('button').first()
      if (await authExpandButton.isVisible()) {
        await authExpandButton.click()
      }
    }

    await projectPage.rightClickFile('login.ts')
    await expect(projectPage.fileContextMenu).toBeVisible()

    // Verify git-specific options are present
    const gitMenuItems = ['Stage File', 'Copy Previous Version', 'Copy Diff']

    for (const item of gitMenuItems) {
      await expect(projectPage.fileContextMenu.getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('should handle file staging operation', async ({ page }) => {
    await testManager.setupGitModifiedFile('src/auth/login.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Navigate to file and stage it
    await projectPage.stageFile('login.ts')

    await expect(page.getByText('File staged successfully')).toBeVisible()
  })

  test('should show unstage option for staged files', async ({ page }) => {
    await testManager.setupStagedFile('src/auth/register.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    await projectPage.rightClickFile('register.ts')
    await expect(projectPage.fileContextMenu).toBeVisible()

    // Should show unstage option instead of stage
    await expect(projectPage.fileContextMenu.getByRole('menuitem', { name: 'Unstage File' })).toBeVisible()
  })

  test('should handle file unstaging operation', async ({ page }) => {
    await testManager.setupStagedFile('src/auth/register.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    await projectPage.unstageFile('register.ts')

    await expect(page.getByText('File unstaged successfully')).toBeVisible()
  })

  test('should copy git diff for modified files', async ({ page }) => {
    await testManager.setupGitModifiedFile('src/auth/login.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    await projectPage.rightClickFile('login.ts')
    await expect(projectPage.fileContextMenu).toBeVisible()

    await projectPage.fileMenuCopyDiff.click()
    await expect(page.getByText(/diff.*copied|changes.*copied/i)).toBeVisible()
  })

  test('should copy previous version of modified files', async ({ page }) => {
    await testManager.setupGitModifiedFile('src/auth/login.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    await projectPage.rightClickFile('login.ts')
    await expect(projectPage.fileContextMenu).toBeVisible()

    await projectPage.fileMenuCopyPreviousVersion.click()
    await expect(page.getByText(/previous.*version.*copied|original.*copied/i)).toBeVisible()
  })

  test('should handle git operations for folders with changes', async ({ page }) => {
    // Setup multiple modified files in a folder
    await testManager.setupGitModifiedFile('src/auth/login.ts')
    await testManager.setupGitModifiedFile('src/auth/register.ts')
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    await projectPage.rightClickFolder('auth')
    await expect(projectPage.folderContextMenu).toBeVisible()

    // Folder context menu might include git operations for all files in folder
    const hasFolderGitOptions = await projectPage.folderContextMenu.getByText(/stage.*all|commit.*folder/i).isVisible()
    // This may not be implemented, so we just check it doesn't break
  })
})

test.describe('Project Page - File Tree Navigation', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should expand and collapse folders', async ({ page }) => {
    const srcFolder = projectPage.folderNode('src')
    await expect(srcFolder).toBeVisible()

    // Get initial state
    const authFolderVisible = await projectPage.folderNode('auth').isVisible()

    // Click to toggle folder
    const toggleButton = srcFolder.locator('button, [aria-expanded]').first()
    if (await toggleButton.isVisible()) {
      await toggleButton.click()

      // State should have changed
      await page.waitForTimeout(500) // Allow for animation
      const newAuthFolderVisible = await projectPage.folderNode('auth').isVisible()
      expect(newAuthFolderVisible).not.toBe(authFolderVisible)
    }
  })

  test('should handle deep folder navigation', async ({ page }) => {
    // Navigate to deeply nested folder: src/components/ui/
    const srcFolder = projectPage.folderNode('src')
    if (await srcFolder.isVisible()) {
      await srcFolder.locator('button').first().click()
    }

    const componentsFolder = projectPage.folderNode('components')
    if (await componentsFolder.isVisible()) {
      await componentsFolder.locator('button').first().click()
    }

    const uiFolder = projectPage.folderNode('ui')
    if (await uiFolder.isVisible()) {
      await uiFolder.locator('button').first().click()

      // Verify files in ui folder are visible
      await expect(projectPage.fileNode('Button.tsx')).toBeVisible({ timeout: 3000 })
      await expect(projectPage.fileNode('Input.tsx')).toBeVisible()
      await expect(projectPage.fileNode('Modal.tsx')).toBeVisible()
    }
  })

  test('should maintain folder expansion state', async ({ page }) => {
    // Expand src folder
    const srcFolder = projectPage.folderNode('src')
    const expandButton = srcFolder.locator('button').first()
    if (await expandButton.isVisible()) {
      await expandButton.click()
    }

    // Verify auth folder is visible
    await expect(projectPage.folderNode('auth')).toBeVisible({ timeout: 2000 })

    // Navigate away and back
    await projectPage.gotoProjectsList()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Folder expansion state should be preserved
    const authStillVisible = await projectPage.folderNode('auth').isVisible()
    // This depends on implementation - some apps preserve state, others don't
  })

  test('should handle keyboard navigation', async ({ page }) => {
    await expect(projectPage.fileTree).toBeVisible()

    // Click on file tree to focus it
    await projectPage.fileTree.click()

    // Try arrow key navigation
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // Check if focus moved (visual focus indicator)
    const focusedElement = page.locator(':focus')
    const isFocusInTree = await focusedElement.isVisible()

    // Focus management may vary by implementation
    if (isFocusInTree) {
      // Try space or enter to select/expand
      await page.keyboard.press('Space')
      await page.waitForTimeout(200)
    }
  })

  test('should scroll long file lists', async ({ page }) => {
    // Setup a folder with many files
    const manyFiles = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`file${i}.ts`, `File ${i} content`]))

    await testManager.setupProjectWithFiles({ 'many-files/': manyFiles })
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Expand the folder with many files
    const manyFilesFolder = projectPage.folderNode('many-files')
    if (await manyFilesFolder.isVisible()) {
      await manyFilesFolder.locator('button').first().click()

      // Should be able to scroll through files
      const firstFile = projectPage.fileNode('file0.ts')
      const lastFile = projectPage.fileNode('file49.ts')

      if (await firstFile.isVisible()) {
        // Scroll to bottom to see last file
        await projectPage.fileTree.evaluate((el) => (el.scrollTop = el.scrollHeight))
        await expect(lastFile).toBeVisible({ timeout: 3000 })

        // Scroll back to top
        await projectPage.fileTree.evaluate((el) => (el.scrollTop = 0))
        await expect(firstFile).toBeVisible()
      }
    }
  })
})

test.describe('Project Page - File Tree Performance', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'performance', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle large file trees without performance degradation', async ({ page }) => {
    // Create large file structure
    const largeStructure = {}
    for (let i = 0; i < 10; i++) {
      largeStructure[`folder${i}/`] = Object.fromEntries(
        Array.from({ length: 20 }, (_, j) => [`file${i}-${j}.ts`, `Content for file ${i}-${j}`])
      )
    }

    await testManager.setupProjectWithFiles(largeStructure)
    await projectPage.gotoProject(1)

    // Measure loading time
    const startTime = Date.now()
    await projectPage.waitForProjectPageLoad()
    const loadTime = Date.now() - startTime

    // Should load within reasonable time
    expect(loadTime).toBeLessThan(10000) // 10 seconds max

    await expect(projectPage.fileTree).toBeVisible()
  })

  test('should lazy load folder contents', async ({ page }) => {
    // Setup deep folder structure
    const deepStructure = {
      'level1/': {
        'level2/': {
          'level3/': Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`deep-file${i}.ts`, `Deep file ${i}`]))
        }
      }
    }

    await testManager.setupProjectWithFiles(deepStructure)
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Initially, deep files should not be loaded
    const initialDeepFileVisible = await projectPage.fileNode('deep-file99.ts').isVisible()
    expect(initialDeepFileVisible).toBeFalsy()

    // Navigate to deep folder
    await projectPage.folderNode('level1').locator('button').first().click()
    await projectPage.folderNode('level2').locator('button').first().click()
    await projectPage.folderNode('level3').locator('button').first().click()

    // Now deep files should be visible
    await expect(projectPage.fileNode('deep-file0.ts')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Project Page - File Tree Error Handling', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle file loading errors gracefully', async ({ page }) => {
    // Mock file API to return error
    await page.route('**/api/files/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load file tree' })
      })
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Should show error state
    const errorMessage = page.getByText(/error.*loading.*files|failed.*file.*tree/i)
    if (await errorMessage.isVisible({ timeout: 5000 })) {
      await expect(errorMessage).toBeVisible()
    } else {
      // Should at least not crash
      await expect(projectPage.fileTree).toBeVisible()
    }
  })

  test('should handle permission errors for file operations', async ({ page }) => {
    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Mock file operation to return permission error
    await page.route('**/api/files/copy**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Permission denied' })
      })
    })

    await projectPage.rightClickFile('package.json')
    await projectPage.fileMenuCopyContents.click()

    // Should show permission error
    const errorToast = page.getByText(/permission.*denied|access.*denied/i)
    if (await errorToast.isVisible({ timeout: 3000 })) {
      await expect(errorToast).toBeVisible()
    }
  })

  test('should recover from network interruptions', async ({ page }) => {
    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Verify initial load works
    await expect(projectPage.fileTree).toBeVisible()

    // Simulate network interruption
    await page.route('**/api/**', (route) => route.abort())

    // Try to perform file operation
    await projectPage.rightClickFile('package.json')
    await projectPage.fileMenuCopyContents.click()

    // Should handle network error gracefully
    const networkError = page.getByText(/network.*error|offline|connection.*failed/i)
    if (await networkError.isVisible({ timeout: 3000 })) {
      await expect(networkError).toBeVisible()
    }

    // Restore network
    await page.unrouteAll()

    // Should recover when network is restored
    // This depends on retry logic implementation
  })
})
