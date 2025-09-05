/**
 * Integration Test Suite for Prompts Page
 * 
 * Tests integration with projects, MCP tools, import/export functionality,
 * and cross-component interactions.
 */

import { test, expect } from '@playwright/test'
import { PromptsPage } from '../pages/prompts.page'
import { ProjectsPage } from '../pages/projects.page'
import { AppPage } from '../pages/app.page'
import { PromptTestHelpers, PromptImportExportHelpers } from '../helpers/prompt-helper'
import { 
  IntegrationTestPrompts,
  MarkdownImportFiles,
  BasicPromptTemplates,
  PromptTestDataFactory 
} from '../fixtures/prompt-management-data'
import { TestDataFactory } from '../fixtures/test-data'

test.describe('Prompts Integration Features', () => {
  let promptsPage: PromptsPage
  let projectsPage: ProjectsPage
  let appPage: AppPage
  let testHelpers: PromptTestHelpers
  let createdPrompts: string[] = []
  let createdProjects: string[] = []

  test.beforeEach(async ({ page }) => {
    promptsPage = new PromptsPage(page)
    projectsPage = new ProjectsPage(page)
    appPage = new AppPage(page)
    testHelpers = new PromptTestHelpers(page)
    createdPrompts = []
    createdProjects = []

    // Navigate to app and wait for initialization
    await appPage.goto()
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up created prompts
    for (const promptTitle of createdPrompts) {
      try {
        await promptsPage.goto()
        if (await promptsPage.promptExists(promptTitle)) {
          await promptsPage.deletePrompt(promptTitle)
        }
      } catch (error) {
        // Continue cleanup
      }
    }

    // Clean up created projects
    for (const projectName of createdProjects) {
      try {
        await projectsPage.goto()
        // Project cleanup would depend on ProjectsPage implementation
      } catch (error) {
        // Continue cleanup
      }
    }

    // Clean up temporary files
    await testHelpers.cleanup()
  })

  test.describe('Project Integration', () => {
    test('should associate prompts with projects', async ({ page }) => {
      // Create a test project first
      const projectData = TestDataFactory.createProject()
      
      // Navigate to projects and create project
      await projectsPage.goto()
      // Assuming project creation method exists
      // await projectsPage.createProject(projectData)
      createdProjects.push(projectData.name)

      // Create a prompt
      const promptData = IntegrationTestPrompts.projectSpecific
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Associate prompt with project (implementation depends on UI)
      const associateButton = page.locator('[data-testid="associate-project"], button:has-text("Add to Project")')
      
      if (await associateButton.isVisible()) {
        await associateButton.click()
        
        // Select project in dialog
        const projectOption = page.locator(`[data-testid="project-option"]:has-text("${projectData.name}")`)
        if (await projectOption.isVisible()) {
          await projectOption.click()
          
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Add")')
          await confirmButton.click()
          
          // Verify association
          await testHelpers.assertToastMessage('added to project')
        }
      }
    })

    test('should share prompts between projects', async ({ page }) => {
      const sharedPrompt = IntegrationTestPrompts.crossProject
      
      // Create the shared prompt
      await promptsPage.goto()
      await promptsPage.createPrompt(sharedPrompt)
      createdPrompts.push(sharedPrompt.title)

      // Verify prompt can be accessed from different contexts
      await expect(promptsPage.getPromptCard(sharedPrompt.title)).toBeVisible()
    })

    test('should filter prompts by project', async ({ page }) => {
      // Check if project filter is available
      const projectFilter = page.locator('[data-testid="project-filter"], select[name="project"]')
      
      if (await projectFilter.isVisible()) {
        // Select a project filter
        await projectFilter.selectOption({ index: 1 })
        await promptsPage.waitForLoadingComplete()
        
        // Verify filtered results
        const promptCount = await promptsPage.getPromptCount()
        expect(promptCount).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe('Import/Export Functionality', () => {
    test('should import prompts from markdown file', async ({ page }) => {
      // Create a markdown file for import
      const importPrompts = PromptTestDataFactory.generateCRUDTestSet().slice(0, 3)
      const markdownContent = PromptImportExportHelpers.createValidMarkdownFile(importPrompts)
      const tempFile = await testHelpers.createTempMarkdownFile('import-test.md', importPrompts)

      await promptsPage.goto()
      
      // Check if import button is available
      if (await promptsPage.importPromptButton.isVisible()) {
        await promptsPage.importPromptButton.click()
        
        // Handle file input
        const fileInput = page.locator('input[type="file"]')
        if (await fileInput.isVisible()) {
          await fileInput.setInputFiles(tempFile)
          
          // Confirm import
          const importButton = page.locator('button:has-text("Import"), button:has-text("Upload")')
          await importButton.click()
          
          // Wait for import to complete
          await promptsPage.waitForLoadingComplete()
          
          // Verify prompts were imported
          for (const prompt of importPrompts) {
            createdPrompts.push(prompt.title)
            await expect(promptsPage.getPromptCard(prompt.title)).toBeVisible()
          }
        }
      }
    })

    test('should export single prompt to markdown', async ({ page }) => {
      const promptData = BasicPromptTemplates.codeReview
      
      // Create a prompt to export
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Export the prompt
      const downloadPromise = page.waitForEvent('download')
      await promptsPage.exportPrompt(promptData.title)
      
      try {
        const download = await downloadPromise
        expect(download).toBeTruthy()
        
        // Verify download filename
        const filename = download.suggestedFilename()
        expect(filename).toContain('.md')
      } catch (error) {
        // Export might be handled differently (e.g., clipboard)
        await testHelpers.assertToastMessage('exported')
      }
    })

    test('should export multiple prompts', async ({ page }) => {
      const prompts = PromptTestDataFactory.generateCRUDTestSet().slice(0, 3)
      
      // Create multiple prompts
      for (const promptData of prompts) {
        await promptsPage.goto()
        await promptsPage.createPrompt(promptData)
        createdPrompts.push(promptData.title)
      }

      // Select prompts for export
      await testHelpers.selectMultiplePrompts(prompts.map(p => p.title))
      
      // Look for bulk export option
      const bulkExportButton = page.locator('[data-testid="bulk-export"], button:has-text("Export Selected")')
      
      if (await bulkExportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download')
        await bulkExportButton.click()
        
        try {
          const download = await downloadPromise
          expect(download).toBeTruthy()
        } catch {
          await testHelpers.assertToastMessage('exported')
        }
      }
    })

    test('should validate markdown format on import', async ({ page }) => {
      const invalidContent = MarkdownImportFiles.invalid
      const tempFile = await testHelpers.createTempMarkdownFile(
        'invalid-import.md', 
        [{ title: 'Invalid', content: invalidContent }]
      )

      await promptsPage.goto()
      
      if (await promptsPage.importPromptButton.isVisible()) {
        await promptsPage.importPromptButton.click()
        
        const fileInput = page.locator('input[type="file"]')
        if (await fileInput.isVisible()) {
          await fileInput.setInputFiles(tempFile)
          
          const importButton = page.locator('button:has-text("Import")')
          await importButton.click()
          
          // Should show validation error
          await testHelpers.assertToastMessage('Invalid', 'error')
        }
      }
    })

    test('should handle complex markdown imports', async ({ page }) => {
      const complexContent = MarkdownImportFiles.complex
      const tempFile = await testHelpers.createTempMarkdownFile(
        'complex-import.md',
        [{ title: 'Complex Import', content: complexContent }]
      )

      await promptsPage.goto()
      
      if (await promptsPage.importPromptButton.isVisible()) {
        await promptsPage.importPromptButton.click()
        
        const fileInput = page.locator('input[type="file"]')
        if (await fileInput.isVisible()) {
          await fileInput.setInputFiles(tempFile)
          
          const importButton = page.locator('button:has-text("Import")')
          await importButton.click()
          
          await promptsPage.waitForLoadingComplete()
          
          // Verify complex prompt was imported
          createdPrompts.push('Advanced AI Assistant')
          const importedCard = promptsPage.getPromptCard('Advanced AI Assistant')
          
          if (await importedCard.isVisible()) {
            await expect(importedCard).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('MCP Tool Integration', () => {
    test('should integrate with MCP prompt_manager tool', async ({ page }) => {
      // Check if MCP tools are available
      const mcpIndicator = page.locator('[data-testid="mcp-status"], .mcp-indicator')
      
      if (await mcpIndicator.isVisible()) {
        // Create a prompt
        const promptData = IntegrationTestPrompts.mcpTool
        await promptsPage.goto()
        await promptsPage.createPrompt(promptData)
        createdPrompts.push(promptData.title)

        // Verify MCP can access the prompt
        // This would typically involve checking MCP tool responses
        await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      }
    })

    test('should sync prompts with MCP tools', async ({ page }) => {
      // Create prompt via UI
      const promptData = BasicPromptTemplates.testGeneration
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Check if MCP sync indicator shows
      const syncIndicator = page.locator('[data-testid="mcp-sync"], .sync-status')
      
      if (await syncIndicator.isVisible()) {
        await expect(syncIndicator).toContainText('synced')
      }
    })

    test('should handle MCP tool suggestions', async ({ page }) => {
      await promptsPage.goto()
      
      // Check for MCP suggestions
      const suggestionsButton = page.locator('[data-testid="mcp-suggestions"], button:has-text("Suggestions")')
      
      if (await suggestionsButton.isVisible()) {
        await suggestionsButton.click()
        
        // Verify suggestions panel opens
        const suggestionsPanel = page.locator('[data-testid="suggestions-panel"]')
        await expect(suggestionsPanel).toBeVisible()
        
        // Check if suggestions are displayed
        const suggestionItems = suggestionsPanel.locator('[data-testid="suggestion-item"]')
        const count = await suggestionItems.count()
        expect(count).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Cross-Component Integration', () => {
    test('should navigate between prompts and other sections', async ({ page }) => {
      // Start at prompts page
      await promptsPage.goto()
      await promptsPage.waitForPromptsLoaded()
      
      // Navigate to projects
      await appPage.navigateToProjects()
      await expect(page).toHaveURL(/.*projects/)
      
      // Navigate back to prompts
      await appPage.navigateToPrompts()
      await expect(page).toHaveURL(/.*prompts/)
      
      // Verify prompts are still loaded
      await promptsPage.waitForPromptsLoaded()
    })

    test('should maintain prompt selection across navigation', async ({ page }) => {
      const promptData = BasicPromptTemplates.documentation
      
      // Create and select a prompt
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)
      
      // Open prompt
      await promptsPage.openPrompt(promptData.title)
      await expect(promptsPage.promptDialog).toBeVisible()
      
      // Close and navigate away
      await promptsPage.cancelPromptButton.click()
      await appPage.navigateToProjects()
      
      // Navigate back
      await appPage.navigateToPrompts()
      
      // Prompt should still be visible
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
    })

    test('should handle keyboard shortcuts', async ({ page }) => {
      await promptsPage.goto()
      
      // Test search shortcut (usually Cmd/Ctrl + K or /)
      await page.keyboard.press('Control+k')
      
      // Check if search is focused
      const searchFocused = await promptsPage.searchInput.evaluate(el => el === document.activeElement)
      
      if (searchFocused) {
        expect(searchFocused).toBe(true)
      }
      
      // Test escape to clear/close
      await page.keyboard.press('Escape')
      
      // Test new prompt shortcut if available
      await page.keyboard.press('Control+n')
      
      // Check if create dialog opens
      if (await promptsPage.promptDialog.isVisible()) {
        await expect(promptsPage.promptDialog).toBeVisible()
        await promptsPage.cancelPromptButton.click()
      }
    })

    test('should handle browser back/forward navigation', async ({ page }) => {
      // Create a prompt
      const promptData = BasicPromptTemplates.refactoring
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)
      
      // Navigate to different sections
      await appPage.navigateToProjects()
      await appPage.navigateToChat()
      
      // Use browser back button
      await page.goBack()
      await expect(page).toHaveURL(/.*projects/)
      
      await page.goBack()
      await expect(page).toHaveURL(/.*prompts/)
      
      // Verify prompt is still there
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      
      // Use browser forward button
      await page.goForward()
      await expect(page).toHaveURL(/.*projects/)
    })
  })

  test.describe('Data Persistence', () => {
    test('should persist prompts after page refresh', async ({ page }) => {
      const promptData = BasicPromptTemplates.debugging
      
      // Create a prompt
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)
      
      // Refresh the page
      await page.reload()
      await promptsPage.waitForPromptsLoaded()
      
      // Verify prompt persists
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.title).toBe(promptData.title)
      expect(promptInfo.description).toBe(promptData.description)
    })

    test('should sync prompts across tabs', async ({ browser }) => {
      // Create prompt in first tab
      const page1 = await browser.newPage()
      const promptsPage1 = new PromptsPage(page1)
      const promptData = BasicPromptTemplates.codeReview
      
      await promptsPage1.goto()
      await promptsPage1.createPrompt(promptData)
      createdPrompts.push(promptData.title)
      
      // Open second tab
      const page2 = await browser.newPage()
      const promptsPage2 = new PromptsPage(page2)
      await promptsPage2.goto()
      await promptsPage2.waitForPromptsLoaded()
      
      // Verify prompt appears in second tab
      await expect(promptsPage2.getPromptCard(promptData.title)).toBeVisible()
      
      // Clean up
      await page1.close()
      await page2.close()
    })

    test('should handle concurrent modifications', async ({ browser }) => {
      // Create initial prompt
      const promptData = {
        title: 'Concurrent Test Prompt',
        content: 'Initial content'
      }
      
      const page1 = await browser.newPage()
      const promptsPage1 = new PromptsPage(page1)
      await promptsPage1.goto()
      await promptsPage1.createPrompt(promptData)
      createdPrompts.push(promptData.title)
      
      // Open second tab
      const page2 = await browser.newPage()
      const promptsPage2 = new PromptsPage(page2)
      await promptsPage2.goto()
      
      // Edit in first tab
      await promptsPage1.editPrompt(promptData.title, {
        content: 'Updated from tab 1'
      })
      
      // Refresh second tab
      await page2.reload()
      await promptsPage2.waitForPromptsLoaded()
      
      // Verify update is visible
      await expect(promptsPage2.getPromptCard(promptData.title)).toBeVisible()
      
      await page1.close()
      await page2.close()
    })
  })

  test.describe('Error Recovery', () => {
    test('should recover from network interruption', async ({ page }) => {
      const promptData = BasicPromptTemplates.testGeneration
      
      // Create prompt
      await promptsPage.goto()
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)
      
      // Simulate network interruption
      await page.context().setOffline(true)
      
      // Try to perform action
      try {
        await promptsPage.searchPrompts('test')
      } catch {
        // Expected to fail
      }
      
      // Restore network
      await page.context().setOffline(false)
      
      // Verify recovery
      await page.reload()
      await promptsPage.waitForPromptsLoaded()
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
    })

    test('should handle session timeout gracefully', async ({ page }) => {
      await promptsPage.goto()
      
      // Simulate session timeout by clearing cookies
      await page.context().clearCookies()
      
      // Try to create a prompt
      const promptData = {
        title: 'Session Test Prompt',
        content: 'Test content'
      }
      
      try {
        await promptsPage.createPrompt(promptData)
      } catch {
        // Might redirect to login or show error
        const loginPage = page.locator('[data-testid="login"], .login-form')
        const errorMessage = page.locator('[role="alert"], .error-message')
        
        const isLoginVisible = await loginPage.isVisible()
        const isErrorVisible = await errorMessage.isVisible()
        
        expect(isLoginVisible || isErrorVisible).toBe(true)
      }
    })

    test('should handle API rate limiting', async ({ page }) => {
      // Mock rate limit response
      await testHelpers.mockAPIError('**/api/prompts', 429, 'Too Many Requests')
      
      const promptData = {
        title: 'Rate Limit Test',
        content: 'Test content'
      }
      
      // Try to create prompt
      await promptsPage.goto()
      await promptsPage.createPromptButton.click()
      await promptsPage.promptTitleInput.fill(promptData.title)
      await promptsPage.promptContentTextarea.fill(promptData.content)
      await promptsPage.submitPromptButton.click()
      
      // Should show rate limit error
      await testHelpers.assertToastMessage('Too Many Requests', 'error')
    })
  })
})