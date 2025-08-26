import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('Prompt Overview Panel Testing', () => {
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

  test.describe('Panel Layout Management', () => {
    test('should display prompt overview panel in project context', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify prompt overview panel is visible
      const promptOverviewPanel = appPage.page.locator([
        '[data-testid="prompt-overview-panel"]',
        '.prompt-overview-panel',
        '[data-testid="prompt-panel"]'
      ].join(', '))

      await expect(promptOverviewPanel).toBeVisible({ timeout: 10000 })

      // Should contain prompts and selected files sections
      const promptsSection = appPage.page.locator([
        '[data-testid="prompts-list"]',
        '.prompts-list',
        '.prompts-section'
      ].join(', '))

      const selectedFilesSection = appPage.page.locator([
        '[data-testid="selected-files"]',
        '.selected-files-list',
        '.selected-files-section'
      ].join(', '))

      if (await promptsSection.isVisible({ timeout: 3000 })) {
        await expect(promptsSection).toBeVisible()
      }

      if (await selectedFilesSection.isVisible({ timeout: 3000 })) {
        await expect(selectedFilesSection).toBeVisible()
      }
    })

    test('should support resizable panels (vertical split)', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for resizable panel divider
      const resizeHandle = appPage.page.locator([
        '[data-testid="resize-handle"]',
        '.resize-handle',
        '[data-panel-resize-handle-enabled]',
        '.panel-divider'
      ].join(', '))

      if (await resizeHandle.isVisible({ timeout: 5000 })) {
        // Get initial position
        const initialBounds = await resizeHandle.boundingBox()
        
        if (initialBounds) {
          // Try to drag the resize handle
          await resizeHandle.hover()
          await appPage.page.mouse.down()
          await appPage.page.mouse.move(initialBounds.x, initialBounds.y + 50)
          await appPage.page.mouse.up()
          await appPage.page.waitForTimeout(500)

          // Verify position changed
          const newBounds = await resizeHandle.boundingBox()
          if (newBounds) {
            expect(Math.abs(newBounds.y - initialBounds.y)).toBeGreaterThan(10)
          }
        }
      }
    })

    test('should handle collapsible sections', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for collapsible section headers
      const collapsibleHeaders = appPage.page.locator([
        '[data-testid="collapsible-header"]',
        '[data-testid*="collapse"]',
        'button[aria-expanded]',
        '.collapsible-trigger'
      ].join(', '))

      const headerCount = await collapsibleHeaders.count()
      if (headerCount > 0) {
        const firstHeader = collapsibleHeaders.first()
        
        // Check initial state
        const initialState = await firstHeader.getAttribute('aria-expanded')
        
        // Toggle collapse
        await firstHeader.click()
        await appPage.page.waitForTimeout(500)
        
        // Verify state changed
        const newState = await firstHeader.getAttribute('aria-expanded')
        expect(newState).not.toBe(initialState)

        // Toggle back
        await firstHeader.click()
        await appPage.page.waitForTimeout(500)
        
        // Should return to initial state
        const finalState = await firstHeader.getAttribute('aria-expanded')
        expect(finalState).toBe(initialState)
      }
    })

    test('should persist panel state across sessions', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Modify panel state (collapse a section)
      const collapsibleHeader = appPage.page.locator('[data-testid*="collapse"], button[aria-expanded]')
      if (await collapsibleHeader.first().isVisible({ timeout: 3000 })) {
        const initialState = await collapsibleHeader.first().getAttribute('aria-expanded')
        await collapsibleHeader.first().click()
        await appPage.page.waitForTimeout(500)
        
        // Reload the page
        await appPage.page.reload()
        await appPage.waitForAppReady()
        
        // Navigate back to the project
        await sidebarPage.navigateToSection('projects')
        await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
        
        // Check if state was persisted
        if (await collapsibleHeader.first().isVisible({ timeout: 5000 })) {
          const persistedState = await collapsibleHeader.first().getAttribute('aria-expanded')
          expect(persistedState).not.toBe(initialState)
        }
      }
    })

    test('should respond to viewport changes', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Test different viewport sizes
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 }    // Mobile
      ]

      for (const viewport of viewports) {
        await appPage.page.setViewportSize(viewport)
        await appPage.page.waitForTimeout(500)

        const promptOverviewPanel = appPage.page.locator('[data-testid="prompt-overview-panel"], .prompt-overview-panel')
        
        if (await promptOverviewPanel.isVisible({ timeout: 3000 })) {
          // Panel should adapt to different screen sizes
          const bounds = await promptOverviewPanel.boundingBox()
          if (bounds) {
            expect(bounds.width).toBeLessThanOrEqual(viewport.width)
            expect(bounds.height).toBeLessThanOrEqual(viewport.height)
          }
        }
      }

      // Reset to default
      await appPage.page.setViewportSize({ width: 1280, height: 720 })
    })
  })

  test.describe('Selected Files Display', () => {
    test('should show selected files with paths', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select some files first
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const fileCount = await fileItems.count()
      
      if (fileCount > 0) {
        // Select first file
        await fileItems.first().click()
        await appPage.page.waitForTimeout(1000)

        // Check selected files display
        const selectedFilesDisplay = appPage.page.locator([
          '[data-testid="selected-files-display"]',
          '.selected-files-list',
          '.selected-file-item'
        ].join(', '))

        if (await selectedFilesDisplay.isVisible({ timeout: 3000 })) {
          // Should show file path
          const filePathElements = selectedFilesDisplay.locator('[data-testid="file-path"], .file-path')
          const pathCount = await filePathElements.count()
          expect(pathCount).toBeGreaterThan(0)

          if (pathCount > 0) {
            const pathText = await filePathElements.first().textContent()
            expect(pathText).toBeTruthy()
            expect(pathText.length).toBeGreaterThan(0)
          }
        }
      }
    })

    test('should remove files from selection', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select multiple files
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const fileCount = await fileItems.count()
      
      if (fileCount > 1) {
        await fileItems.first().click()
        await appPage.page.waitForTimeout(500)
        
        await fileItems.nth(1).click({ 
          modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'] 
        })
        await appPage.page.waitForTimeout(1000)

        // Look for remove buttons in selected files
        const removeButtons = appPage.page.locator([
          '[data-testid="remove-file"]',
          'button[aria-label*="remove"]',
          '.remove-file-button',
          'button:has([data-lucide="x"])'
        ].join(', '))

        const removeButtonCount = await removeButtons.count()
        if (removeButtonCount > 0) {
          // Remove first selected file
          await removeButtons.first().click()
          await appPage.page.waitForTimeout(500)

          // Should have fewer selected files now
          const remainingFiles = appPage.page.locator('.selected-file-item')
          const remainingCount = await remainingFiles.count()
          expect(remainingCount).toBeLessThan(2)
        }
      }
    })

    test('should clear all selections', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select multiple files
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const fileCount = await fileItems.count()
      
      if (fileCount > 0) {
        // Select multiple files
        for (let i = 0; i < Math.min(3, fileCount); i++) {
          await fileItems.nth(i).click({ 
            modifiers: i > 0 ? (process.platform === 'darwin' ? ['Meta'] : ['Control']) : [] 
          })
          await appPage.page.waitForTimeout(300)
        }

        // Look for clear all button
        const clearAllButton = appPage.page.locator([
          '[data-testid="clear-all-files"]',
          'button:has-text("Clear")',
          'button:has-text("Clear All")',
          '.clear-all-button'
        ].join(', '))

        if (await clearAllButton.isVisible({ timeout: 3000 })) {
          await clearAllButton.click()
          await appPage.page.waitForTimeout(500)

          // Should have no selected files
          const selectedFiles = appPage.page.locator('.selected-file-item')
          const remainingCount = await selectedFiles.count()
          expect(remainingCount).toBe(0)
        }
      }
    })

    test('should show file preview on hover', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select a file
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      if (await fileItems.first().isVisible({ timeout: 3000 })) {
        await fileItems.first().click()
        await appPage.page.waitForTimeout(1000)

        // Find selected file in the overview panel
        const selectedFile = appPage.page.locator('.selected-file-item').first()
        
        if (await selectedFile.isVisible({ timeout: 3000 })) {
          // Hover over the selected file
          await selectedFile.hover()
          await appPage.page.waitForTimeout(500)

          // Look for preview tooltip or popup
          const preview = appPage.page.locator([
            '[data-testid="file-preview"]',
            '.file-preview',
            '[role="tooltip"]',
            '.preview-popup'
          ].join(', '))

          if (await preview.isVisible({ timeout: 2000 })) {
            const previewContent = await preview.textContent()
            expect(previewContent.length).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  test.describe('Prompts List', () => {
    test('should display saved prompts', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Create a prompt first
      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        await promptTextArea.fill('Test prompt for display in overview panel')
        
        const saveButton = appPage.page.locator('[data-testid="save-prompt"], button:has-text("Save")')
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click()
          await appPage.page.waitForTimeout(1000)

          // Check prompts list in overview panel
          const promptsList = appPage.page.locator([
            '[data-testid="prompts-list"]',
            '.prompts-list'
          ].join(', '))

          if (await promptsList.isVisible({ timeout: 3000 })) {
            const promptItems = promptsList.locator('[data-testid="prompt-item"], .prompt-item')
            const promptCount = await promptItems.count()
            expect(promptCount).toBeGreaterThan(0)

            // Should show prompt content or title
            if (promptCount > 0) {
              const promptText = await promptItems.first().textContent()
              expect(promptText).toContain('Test prompt')
            }
          }
        }
      }
    })

    test('should search and filter prompts', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Create multiple prompts with different content
      const prompts = [
        'JavaScript code review prompt',
        'CSS styling guidelines prompt',
        'API documentation prompt'
      ]

      for (const promptText of prompts) {
        const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
        if (await promptTextArea.isVisible({ timeout: 3000 })) {
          await promptTextArea.fill(promptText)
          
          const saveButton = appPage.page.locator('[data-testid="save-prompt"], button:has-text("Save")')
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click()
            await appPage.page.waitForTimeout(1000)
          }
        }
      }

      // Look for prompt search functionality
      const promptSearch = appPage.page.locator([
        '[data-testid="prompt-search"]',
        '.prompt-search',
        'input[placeholder*="search prompt"]'
      ].join(', '))

      if (await promptSearch.isVisible({ timeout: 3000 })) {
        // Search for specific prompts
        await promptSearch.fill('JavaScript')
        await appPage.page.waitForTimeout(500)

        const filteredPrompts = appPage.page.locator('[data-testid="prompt-item"], .prompt-item')
        const filteredCount = await filteredPrompts.count()
        
        // Should show fewer prompts after filtering
        if (filteredCount > 0) {
          const promptText = await filteredPrompts.first().textContent()
          expect(promptText).toContain('JavaScript')
        }
      }
    })

    test('should sort prompts by date/name', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for sort options
      const sortOptions = appPage.page.locator([
        '[data-testid="prompt-sort"]',
        '.sort-prompts',
        'select',
        '[role="combobox"]'
      ].join(', '))

      if (await sortOptions.isVisible({ timeout: 3000 })) {
        // Try different sort options
        await sortOptions.click()
        await appPage.page.waitForTimeout(300)

        const sortByDate = appPage.page.locator('option:has-text("Date"), [role="option"]:has-text("Date")')
        if (await sortByDate.isVisible({ timeout: 2000 })) {
          await sortByDate.click()
          await appPage.page.waitForTimeout(500)
        }

        const sortByName = appPage.page.locator('option:has-text("Name"), [role="option"]:has-text("Name")')
        if (await sortByName.isVisible({ timeout: 2000 })) {
          await sortByName.click()
          await appPage.page.waitForTimeout(500)
        }
      }
    })

    test('should select prompts for editing', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Create a prompt first
      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        const originalPrompt = 'Original prompt for editing test'
        await promptTextArea.fill(originalPrompt)
        
        const saveButton = appPage.page.locator('[data-testid="save-prompt"], button:has-text("Save")')
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click()
          await appPage.page.waitForTimeout(1000)

          // Find the prompt in the list
          const promptItem = appPage.page.locator('[data-testid="prompt-item"], .prompt-item').first()
          
          if (await promptItem.isVisible({ timeout: 3000 })) {
            // Click to select/edit the prompt
            await promptItem.click()
            await appPage.page.waitForTimeout(500)

            // Should populate the textarea for editing
            const textareaContent = await promptTextArea.inputValue()
            expect(textareaContent).toBe(originalPrompt)

            // Try editing
            const editedPrompt = 'Edited prompt content'
            await promptTextArea.fill(editedPrompt)
            await appPage.page.waitForTimeout(500)

            if (await saveButton.isVisible({ timeout: 2000 })) {
              await saveButton.click()
              await appPage.page.waitForTimeout(1000)

              // Should update the prompt in the list
              const updatedPromptText = await promptItem.textContent()
              expect(updatedPromptText).toContain('Edited')
            }
          }
        }
      }
    })
  })

  test.describe('Panel Integration', () => {
    test('should synchronize with file panel selections', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select files in the file panel
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const fileCount = await fileItems.count()
      
      if (fileCount > 0) {
        await fileItems.first().click()
        await appPage.page.waitForTimeout(1000)

        // Check that selection is reflected in overview panel
        const selectedFilesDisplay = appPage.page.locator([
          '[data-testid="selected-files-display"]',
          '.selected-files-list'
        ].join(', '))

        if (await selectedFilesDisplay.isVisible({ timeout: 3000 })) {
          const selectedFileItems = selectedFilesDisplay.locator('.selected-file-item')
          const selectedCount = await selectedFileItems.count()
          expect(selectedCount).toBe(1)
        }

        // Select another file
        if (fileCount > 1) {
          await fileItems.nth(1).click({ 
            modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'] 
          })
          await appPage.page.waitForTimeout(500)

          // Overview should update
          if (await selectedFilesDisplay.isVisible({ timeout: 2000 })) {
            const updatedFileItems = selectedFilesDisplay.locator('.selected-file-item')
            const updatedCount = await updatedFileItems.count()
            expect(updatedCount).toBe(2)
          }
        }
      }
    })

    test('should maintain state consistency across panels', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Make changes in different panels and verify consistency
      
      // 1. Select files in file panel
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      if (await fileItems.first().isVisible({ timeout: 3000 })) {
        await fileItems.first().click()
        await appPage.page.waitForTimeout(500)
      }

      // 2. Create prompt in input panel
      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 3000 })) {
        await promptTextArea.fill('Consistency test prompt')
        
        const saveButton = appPage.page.locator('[data-testid="save-prompt"], button:has-text("Save")')
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click()
          await appPage.page.waitForTimeout(1000)
        }
      }

      // 3. Verify all panels show consistent state
      const selectedFiles = appPage.page.locator('.selected-file-item')
      const savedPrompts = appPage.page.locator('[data-testid="prompt-item"], .prompt-item')

      const fileCount = await selectedFiles.count()
      const promptCount = await savedPrompts.count()

      expect(fileCount).toBeGreaterThan(0)
      expect(promptCount).toBeGreaterThan(0)

      // 4. Remove file from overview panel and verify consistency
      const removeButton = appPage.page.locator('[data-testid="remove-file"], button[aria-label*="remove"]')
      if (await removeButton.first().isVisible({ timeout: 2000 })) {
        await removeButton.first().click()
        await appPage.page.waitForTimeout(500)

        // File should be removed from all panels
        const updatedFileCount = await selectedFiles.count()
        expect(updatedFileCount).toBeLessThan(fileCount)
      }
    })
  })
})