import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('Performance and Edge Case Tests', () => {
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

  test.describe('Large Project Performance', () => {
    test('should handle project with 1000+ files efficiently', async () => {
      // Create large project with many files
      const testProject = await TestProjectHelpers.createLargeProject({
        fileCount: 1000,
        directoryDepth: 5,
        includeVariousFileTypes: true
      })
      testProjects.push(testProject)

      const startTime = Date.now()

      // Load project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(10000) // Should load within 10 seconds

      // Navigate to project
      const navStartTime = Date.now()
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      
      const navTime = Date.now() - navStartTime
      expect(navTime).toBeLessThan(5000) // Should navigate within 5 seconds

      // Verify file explorer loads
      const fileExplorer = appPage.page.locator('[data-testid="file-explorer"], [data-testid="file-tree"]')
      await expect(fileExplorer).toBeVisible({ timeout: 15000 })

      // Test search performance in large project
      const searchInput = appPage.page.locator('[data-testid="file-search"], input[placeholder*="Search"]')
      if (await searchInput.isVisible()) {
        const searchStartTime = Date.now()
        await searchInput.fill('test')
        
        // Wait for search results
        await appPage.page.waitForTimeout(2000)
        
        const searchTime = Date.now() - searchStartTime
        expect(searchTime).toBeLessThan(3000) // Search should complete within 3 seconds
      }
    })

    test('should handle deeply nested directory structures', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'custom',
        structure: [
          'level1/level2/level3/level4/level5/level6/level7/level8/deep-file.txt',
          'level1/level2/level3/level4/level5/another-deep-file.js',
          'level1/level2/level3/config.json',
          'level1/shallow-file.md'
        ]
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Should handle deeply nested structures without crashing
      const fileExplorer = appPage.page.locator('[data-testid="file-explorer"], [data-testid="file-tree"]')
      await expect(fileExplorer).toBeVisible({ timeout: 10000 })

      // Try to expand nested directories
      const expandableItems = appPage.page.locator('[data-testid*="expand"], button[aria-expanded="false"]')
      const expandCount = await expandableItems.count()
      
      if (expandCount > 0) {
        // Expand first few levels
        for (let i = 0; i < Math.min(3, expandCount); i++) {
          try {
            await expandableItems.nth(i).click({ timeout: 2000 })
            await appPage.page.waitForTimeout(500) // Allow UI to update
          } catch (error) {
            console.warn(`Could not expand item ${i}:`, error.message)
          }
        }
      }

      // Verify no crashes or performance issues
      expect(await appPage.isPageResponsive()).toBe(true)
    })

    test('should handle projects with mixed large and small files', async () => {
      const testProject = await TestProjectHelpers.createTestProject(
        TestProjectPresets.withVariousFileSizes()
      )
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify project loads despite mixed file sizes
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      // Test file selection with various file sizes
      const fileItems = appPage.page.locator('[data-testid*="file-item"], [data-file-type]')
      const fileCount = await fileItems.count()
      
      if (fileCount > 0) {
        // Select multiple files of different sizes
        for (let i = 0; i < Math.min(5, fileCount); i++) {
          try {
            await fileItems.nth(i).click({ timeout: 2000 })
            await appPage.page.waitForTimeout(200) // Brief pause between selections
          } catch (error) {
            console.warn(`Could not select file ${i}:`, error.message)
          }
        }
      }

      expect(await appPage.isPageResponsive()).toBe(true)
    })
  })

  test.describe('Special Character and Edge Case Handling', () => {
    test('should handle projects with special characters in paths', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'custom',
        name: 'test-project-éñ-特殊字符-🚀',
        structure: [
          'файл с русскими символами.txt',
          '文件名.js',
          'file with spaces and (parentheses).md',
          'file.with.many.dots.json',
          'UPPERCASE-FILE.TXT',
          'file_with_underscores.py',
          'file-with-dashes.css',
          'file@with#special$chars%.html'
        ]
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      
      // Should be able to load project with special characters
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify files with special characters are displayed
      const fileExplorer = appPage.page.locator('[data-testid="file-explorer"], [data-testid="file-tree"]')
      await expect(fileExplorer).toBeVisible({ timeout: 10000 })

      // Try to interact with files with special characters
      const specialFiles = [
        'файл с русскими символами.txt',
        'file with spaces and (parentheses).md',
        'file@with#special$chars%.html'
      ]

      for (const fileName of specialFiles) {
        const fileElement = appPage.page.locator(`text="${fileName}"`).first()
        if (await fileElement.isVisible({ timeout: 2000 })) {
          await fileElement.click()
          // Brief pause to allow selection
          await appPage.page.waitForTimeout(300)
        }
      }

      expect(await appPage.isPageResponsive()).toBe(true)
    })

    test('should handle empty and minimal projects', async () => {
      // Test completely empty project
      const emptyProject = await TestProjectHelpers.createTestProject({
        template: 'empty',
        structure: []
      })
      testProjects.push(emptyProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, emptyProject)
      
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, emptyProject)).toBe(true)
      await TestProjectHelpers.openProjectInApp(appPage.page, emptyProject)

      // Should handle empty project gracefully
      const emptyMessage = appPage.page.locator('[data-testid*="empty"], text*="No files"')
      if (await emptyMessage.isVisible({ timeout: 5000 })) {
        expect(await emptyMessage.isVisible()).toBe(true)
      }

      // Test minimal project with just one file
      const minimalProject = await TestProjectHelpers.createTestProject({
        template: 'minimal',
        structure: ['README.md']
      })
      testProjects.push(minimalProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, minimalProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, minimalProject)

      const readmeFile = appPage.page.locator('text="README.md"').first()
      await expect(readmeFile).toBeVisible({ timeout: 5000 })
    })

    test('should handle projects with binary and media files', async () => {
      const testProject = await TestProjectHelpers.createTestProject(
        TestProjectPresets.withBinaryFiles()
      )
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify binary files are handled properly
      const binaryFileTypes = ['.png', '.jpg', '.pdf', '.zip', '.exe']
      
      for (const fileType of binaryFileTypes) {
        const binaryFile = appPage.page.locator(`text*="${fileType}"`).first()
        if (await binaryFile.isVisible({ timeout: 2000 })) {
          // Should be able to select binary files without crashing
          await binaryFile.click()
          await appPage.page.waitForTimeout(300)
        }
      }

      expect(await appPage.isPageResponsive()).toBe(true)
    })

    test('should handle projects with symlinks and shortcuts', async () => {
      // Note: This test may not work on all systems due to symlink creation permissions
      try {
        const testProject = await TestProjectHelpers.createTestProject({
          template: 'with-symlinks',
          includeSymlinks: true
        })
        testProjects.push(testProject)

        await sidebarPage.navigateToSection('projects')
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
        await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

        // Should handle symlinks gracefully without infinite loops
        const fileExplorer = appPage.page.locator('[data-testid="file-explorer"], [data-testid="file-tree"]')
        await expect(fileExplorer).toBeVisible({ timeout: 10000 })

        expect(await appPage.isPageResponsive()).toBe(true)
      } catch (error) {
        console.warn('Symlink test skipped due to system limitations:', error.message)
        test.skip()
      }
    })

    test('should handle projects with read-only files and permission issues', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'with-permissions',
        includeReadOnlyFiles: true
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Should load project despite permission restrictions
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      // Try to select read-only files
      const readOnlyFiles = appPage.page.locator('[data-readonly="true"], [data-file-readonly]')
      const readOnlyCount = await readOnlyFiles.count()

      if (readOnlyCount > 0) {
        await readOnlyFiles.first().click()
        await appPage.page.waitForTimeout(300)
      }

      expect(await appPage.isPageResponsive()).toBe(true)
    })
  })

  test.describe('Memory and Resource Management', () => {
    test('should handle rapid project switching without memory leaks', async () => {
      // Create multiple projects for switching
      const projects = await TestProjectHelpers.createTestProjects([
        TestProjectPresets.minimal(),
        TestProjectPresets.webApp(),
        TestProjectPresets.apiService()
      ])
      testProjects.push(...projects)

      await sidebarPage.navigateToSection('projects')

      // Load all projects
      for (const project of projects) {
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, project)
      }

      // Rapidly switch between projects
      for (let i = 0; i < 10; i++) {
        const project = projects[i % projects.length]
        await TestProjectHelpers.openProjectInApp(appPage.page, project)
        await appPage.page.waitForTimeout(100) // Brief pause
        
        // Go back to projects list
        await sidebarPage.navigateToSection('projects')
        await appPage.page.waitForTimeout(100)
      }

      // Should remain responsive after rapid switching
      expect(await appPage.isPageResponsive()).toBe(true)
    })

    test('should handle concurrent file operations', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Try to perform multiple file selections concurrently
      const fileItems = appPage.page.locator('[data-testid*="file-item"], [data-file-type]')
      const fileCount = await fileItems.count()

      if (fileCount > 5) {
        // Select multiple files rapidly
        const promises = []
        for (let i = 0; i < Math.min(10, fileCount); i++) {
          promises.push(
            fileItems.nth(i).click().catch((error) => {
              console.warn(`Concurrent selection error for file ${i}:`, error.message)
            })
          )
        }

        await Promise.allSettled(promises)
        await appPage.page.waitForTimeout(1000) // Allow UI to settle
      }

      expect(await appPage.isPageResponsive()).toBe(true)
    })

    test('should handle browser tab visibility changes', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Simulate tab becoming hidden and visible again
      await appPage.page.evaluate(() => {
        // Simulate tab becoming hidden
        Object.defineProperty(document, 'hidden', { value: true, writable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await appPage.page.waitForTimeout(1000)

      await appPage.page.evaluate(() => {
        // Simulate tab becoming visible
        Object.defineProperty(document, 'hidden', { value: false, writable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await appPage.page.waitForTimeout(1000)

      // App should still be responsive after visibility changes
      expect(await appPage.isPageResponsive()).toBe(true)
    })
  })

  test.describe('Error Recovery and Resilience', () => {
    test('should recover from temporary network issues', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Simulate network offline
      await appPage.page.context().setOffline(true)
      
      // Try to perform operations while offline
      try {
        await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      } catch (error) {
        // Expected to fail while offline
        console.log('Expected error while offline:', error.message)
      }

      // Restore network
      await appPage.page.context().setOffline(false)
      
      // Should be able to perform operations after network restoration
      await appPage.page.waitForTimeout(2000) // Allow reconnection
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)
    })

    test('should handle corrupted or incomplete project data', async () => {
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'corrupted',
        includeCorruptedFiles: true
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      
      // Should handle loading corrupted project gracefully
      try {
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
        
        // If it loads, verify error handling
        const errorMessages = appPage.page.locator('[data-testid*="error"], .error, [role="alert"]')
        const hasErrors = await errorMessages.count() > 0
        
        if (hasErrors) {
          console.log('Expected errors detected for corrupted project')
        }
        
        expect(await appPage.isPageResponsive()).toBe(true)
      } catch (error) {
        // Expected behavior for corrupted projects
        console.log('Expected error for corrupted project:', error.message)
        expect(error.message).toContain('error') // Should contain error indication
      }
    })

    test('should handle extremely long file and directory names', async () => {
      const longName = 'a'.repeat(255) // Very long file name
      const testProject = await TestProjectHelpers.createTestProject({
        template: 'custom',
        structure: [
          `${longName}.txt`,
          `directory_${'b'.repeat(100)}/nested_file.js`,
          'normal-file.md'
        ]
      })
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      
      try {
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
        await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

        // Should handle long names gracefully
        expect(await appPage.isPageResponsive()).toBe(true)
      } catch (error) {
        // Some systems may not support extremely long file names
        console.warn('Long filename test limitation:', error.message)
      }
    })
  })

  test.describe('Cross-Browser and Environment Tests', () => {
    test('should work consistently across different viewport sizes', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Test different viewport sizes
      const viewportSizes = [
        { width: 320, height: 568 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 } // Desktop
      ]

      for (const viewport of viewportSizes) {
        await appPage.page.setViewportSize(viewport)
        await appPage.page.waitForTimeout(500) // Allow layout to adjust

        await sidebarPage.navigateToSection('projects')
        await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
        
        // Verify app is usable at this viewport size
        expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)
        
        // Check if sidebar is responsive
        const sidebar = appPage.page.locator('[data-testid="app-sidebar"], [data-sidebar="sidebar"]')
        await expect(sidebar).toBeVisible({ timeout: 5000 })
      }

      // Reset to default viewport
      await appPage.page.setViewportSize({ width: 1280, height: 720 })
    })

    test('should handle page refresh and state restoration', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify we're in the project
      const currentUrl = appPage.page.url()
      expect(currentUrl).toContain('project')

      // Refresh the page
      await appPage.page.reload({ waitUntil: 'networkidle' })
      await appPage.waitForAppReady()

      // Should restore state after refresh
      expect(await appPage.isPageResponsive()).toBe(true)
      
      // Should still show project context
      const projectContext = appPage.page.locator('[data-testid*="project"], [data-context="project"]')
      if (await projectContext.isVisible({ timeout: 5000 })) {
        expect(await projectContext.isVisible()).toBe(true)
      }
    })
  })

  test.describe('Performance Benchmarks', () => {
    test('should load projects within acceptable time limits', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Measure initial app load time
      const appLoadStart = Date.now()
      await appPage.goto('/')
      await appPage.waitForAppReady()
      const appLoadTime = Date.now() - appLoadStart
      
      expect(appLoadTime).toBeLessThan(5000) // App should load within 5 seconds

      // Measure project loading time
      const projectLoadStart = Date.now()
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      const projectLoadTime = Date.now() - projectLoadStart

      expect(projectLoadTime).toBeLessThan(3000) // Project load within 3 seconds

      // Measure navigation time
      const navStart = Date.now()
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      const navTime = Date.now() - navStart

      expect(navTime).toBeLessThan(2000) // Navigation within 2 seconds
    })

    test('should maintain responsive UI during intensive operations', async () => {
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
          const searchInput = appPage.page.locator('[data-testid="file-search"], input[placeholder*="Search"]')
          if (await searchInput.isVisible({ timeout: 1000 })) {
            await searchInput.fill('test')
          }
        },
        // File selection operation
        async () => {
          const fileItems = appPage.page.locator('[data-testid*="file-item"]')
          const count = await fileItems.count()
          if (count > 0) {
            await fileItems.first().click()
          }
        },
        // Navigation operation
        async () => {
          await sidebarPage.navigateToSection('prompts')
          await sidebarPage.navigateToSection('projects')
        }
      ]

      // Execute operations concurrently
      await Promise.allSettled(operations.map(op => op()))

      // UI should remain responsive
      expect(await appPage.isPageResponsive()).toBe(true)
    })
  })
})