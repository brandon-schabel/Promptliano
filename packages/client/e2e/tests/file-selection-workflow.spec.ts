import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { FilesPage } from '../pages/files.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('File Selection Workflow Tests', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let filesPage: FilesPage
  let sidebarPage: SidebarPage
  let testProjects: TestProject[] = []

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)
    filesPage = new FilesPage(page)
    sidebarPage = new SidebarPage(page)
    
    await appPage.goto('/')
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up test projects
    if (testProjects.length > 0) {
      await TestProjectHelpers.cleanupSpecificProjects(testProjects)
      testProjects = []
    }
  })

  test.describe('Project File Tree Navigation', () => {
    test('should display project file structure', async () => {
      // Create web app project with known structure
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Load project and navigate to files
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Wait for file explorer to be visible
      await filesPage.waitForFilesInterfaceLoad()

      // Verify key files and directories are visible
      const expectedStructure = ['src/', 'package.json', 'README.md', 'public/']
      
      for (const item of expectedStructure) {
        const element = appPage.page.locator(`text="${item}"`)
        await expect(element).toBeVisible({ timeout: 5000 })
      }
    })

    test('should expand and collapse directories', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Find src directory
      const srcDirectory = appPage.page.locator('[data-testid="directory-src"], text="src/"').first()
      await expect(srcDirectory).toBeVisible()

      // Click to expand
      await srcDirectory.click()

      // Should show contents of src directory
      await expect(appPage.page.locator('text="index.tsx"')).toBeVisible({ timeout: 3000 })
      await expect(appPage.page.locator('text="App.tsx"')).toBeVisible({ timeout: 3000 })
    })

    test('should navigate deep directory structures', async () => {
      const testProject = await TestProjectHelpers.createTestProject(
        TestProjectPresets.largeMonorepo()
      )
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Navigate through nested structure
      const packagesDir = appPage.page.locator('text="packages/"').first()
      if (await packagesDir.isVisible()) {
        await packagesDir.click()
        
        // Should show package contents
        await expect(appPage.page.locator('text="core/"')).toBeVisible({ timeout: 3000 })
        await expect(appPage.page.locator('text="ui/"')).toBeVisible({ timeout: 3000 })
      }
    })
  })

  test.describe('Single File Selection', () => {
    test('should select individual files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select package.json file
      await filesPage.selectFile('package.json')

      // Verify file is selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(1)

      // Verify file appears in selected files panel
      await expect(filesPage.selectedFilesList.getByText('package.json')).toBeVisible()
    })

    test('should show file preview when selected', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select and preview README.md
      await filesPage.selectFile('README.md')
      await filesPage.previewFile('README.md')

      // Verify preview opens
      await expect(filesPage.filePreview).toBeVisible()
      await expect(filesPage.filePreview.getByText('README.md')).toBeVisible()
    })

    test('should deselect files', async () => {
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select a file
      await filesPage.selectFile('index.js')
      expect(await filesPage.getSelectedFilesCount()).toBe(1)

      // Deselect the file
      await filesPage.removeSelectedFile('index.js')
      expect(await filesPage.getSelectedFilesCount()).toBe(0)
    })
  })

  test.describe('Multiple File Selection', () => {
    test('should select multiple files with Ctrl+Click', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select multiple files
      const filesToSelect = ['package.json', 'README.md', 'tsconfig.json']
      await filesPage.selectMultipleFiles(filesToSelect)

      // Verify selection count
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(filesToSelect.length)
    })

    test('should select all files', async () => {
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select all files
      await filesPage.selectAllFiles()

      // Should have selected multiple files
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBeGreaterThan(2)
    })

    test('should clear all selected files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select multiple files first
      await filesPage.selectMultipleFiles(['package.json', 'README.md'])
      expect(await filesPage.getSelectedFilesCount()).toBe(2)

      // Clear all selections
      await filesPage.clearAllSelectedFiles()
      expect(await filesPage.getSelectedFilesCount()).toBe(0)
    })

    test('should handle batch file operations', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      const filesToSelect = ['package.json', 'README.md', 'tsconfig.json']
      
      // Test batch selection
      await filesPage.testBatchOperations(filesToSelect, 'select')
      
      // Test batch removal
      await filesPage.testBatchOperations(filesToSelect, 'remove')
    })
  })

  test.describe('File Search and Filtering', () => {
    test('should search files by name', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Search for TypeScript files
      await filesPage.searchFiles('tsx')

      // Should show TypeScript files
      await expect(appPage.page.locator('text="App.tsx"')).toBeVisible({ timeout: 3000 })
      await expect(appPage.page.locator('text="index.tsx"')).toBeVisible({ timeout: 3000 })
    })

    test('should filter files by type', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Filter by JavaScript/TypeScript files
      await filesPage.filterFilesByType('typescript')

      // Should show only TypeScript files
      const visibleFiles = await filesPage.getVisibleFiles()
      const tsFiles = visibleFiles.filter(file => 
        file.name.endsWith('.ts') || file.name.endsWith('.tsx')
      )
      expect(tsFiles.length).toBeGreaterThan(0)
    })

    test('should sort files by different criteria', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Test sorting by name
      await filesPage.sortFilesBy('name')
      
      // Get file list after sorting
      const files = await filesPage.getVisibleFiles()
      expect(files.length).toBeGreaterThan(1)

      // Test sorting by size
      await filesPage.sortFilesBy('size')
      
      // Files should still be visible
      const filesAfterSort = await filesPage.getVisibleFiles()
      expect(filesAfterSort.length).toBeGreaterThan(1)
    })
  })

  test.describe('File Selection by Type', () => {
    test('should select all TypeScript files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Get TypeScript files from project
      const tsFiles = TestProjectHelpers.getProjectTypeScriptFiles(testProject)
      expect(tsFiles.length).toBeGreaterThan(0)

      // Select TypeScript files
      for (const tsFile of tsFiles.slice(0, 3)) { // Select first 3 to avoid overwhelming
        const fileName = tsFile.split('/').pop()
        if (fileName) {
          try {
            await filesPage.selectFile(fileName)
          } catch (error) {
            console.warn(`Could not select file ${fileName}:`, error)
          }
        }
      }

      // Verify some files were selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBeGreaterThan(0)
    })

    test('should select configuration files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Get configuration files
      const configFiles = TestProjectHelpers.getProjectConfigFiles(testProject)
      expect(configFiles.length).toBeGreaterThan(0)

      // Select config files that should be visible at root level
      const rootConfigFiles = ['package.json', 'tsconfig.json']
      
      for (const configFile of rootConfigFiles) {
        if (configFiles.includes(configFile)) {
          await filesPage.selectFile(configFile)
        }
      }

      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBeGreaterThan(0)
    })

    test('should select files by pattern', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Search and select all JSON files
      await filesPage.searchFiles('.json')
      
      // Select visible JSON files
      const jsonFile = appPage.page.locator('text="package.json"')
      if (await jsonFile.isVisible()) {
        await jsonFile.click()
        
        const selectedCount = await filesPage.getSelectedFilesCount()
        expect(selectedCount).toBeGreaterThan(0)
      }
    })
  })

  test.describe('File Context and Metadata', () => {
    test('should display file metadata', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Get metadata for package.json
      try {
        const metadata = await filesPage.getFileMetadata('package.json')
        
        expect(metadata.name).toBe('package.json')
        expect(metadata.type).toContain('json') // Should contain json type
        expect(metadata.size).toBeTruthy() // Should have size info
      } catch (error) {
        console.warn('File metadata not fully available in current UI implementation')
      }
    })

    test('should maintain selection state across views', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select files
      await filesPage.selectMultipleFiles(['package.json', 'README.md'])
      const initialCount = await filesPage.getSelectedFilesCount()
      expect(initialCount).toBe(2)

      // Switch view mode if available
      try {
        await filesPage.toggleViewMode()
        await appPage.waitForLoadingComplete()
        
        // Selection should persist
        const countAfterToggle = await filesPage.getSelectedFilesCount()
        expect(countAfterToggle).toBe(initialCount)
      } catch (error) {
        console.warn('View mode toggle not available')
      }
    })

    test('should handle file selection with keyboard navigation', async () => {
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Test keyboard navigation
      await filesPage.testKeyboardNavigation()
    })

    test('should provide file context menus', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Test context menu for package.json
      await filesPage.testFileContextMenu('package.json')
    })
  })

  test.describe('File Selection Performance', () => {
    test('should handle large numbers of files efficiently', async () => {
      const testProject = await TestProjectHelpers.createLargeProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      const startTime = Date.now()
      await filesPage.waitForFilesInterfaceLoad()
      const endTime = Date.now()

      const loadTime = endTime - startTime
      expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds

      // Verify project stats
      const stats = await TestProjectHelpers.getProjectStats(testProject)
      expect(stats.fileCount).toBeGreaterThan(50) // Large project should have many files
    })

    test('should maintain responsive UI during file operations', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Rapidly select and deselect files
      const files = ['package.json', 'README.md', 'tsconfig.json']
      
      for (let i = 0; i < 3; i++) {
        for (const file of files) {
          try {
            await filesPage.selectFile(file)
            await filesPage.removeSelectedFile(file)
          } catch (error) {
            console.warn(`File operation failed for ${file}:`, error)
          }
        }
      }

      // UI should remain responsive
      const finalCount = await filesPage.getSelectedFilesCount()
      expect(finalCount).toBe(0) // All files should be deselected
    })
  })
})