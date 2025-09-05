/**
 * CRUD Operations Test Suite for Prompts Page
 * 
 * Tests create, read, update, and delete operations for prompts
 * including validation, error handling, and edge cases.
 */

import { test, expect } from '@playwright/test'
import { PromptsPage } from '../pages/prompts.page'
import { PromptTestHelpers } from '../helpers/prompt-helper'
import { 
  BasicPromptTemplates, 
  EdgeCasePrompts, 
  ComplexPromptTemplate,
  PromptTestDataFactory 
} from '../fixtures/prompt-management-data'
import type { PromptData } from '../fixtures/test-data'

test.describe('Prompts CRUD Operations', () => {
  let promptsPage: PromptsPage
  let testHelpers: PromptTestHelpers
  let createdPrompts: string[] = []

  test.beforeEach(async ({ page }) => {
    promptsPage = new PromptsPage(page)
    testHelpers = new PromptTestHelpers(page)
    createdPrompts = []

    // Navigate to prompts page
    await promptsPage.goto()
    await promptsPage.waitForLoadingComplete()
  })

  test.afterEach(async () => {
    // Clean up created prompts
    for (const promptTitle of createdPrompts) {
      try {
        if (await promptsPage.promptExists(promptTitle)) {
          await promptsPage.deletePrompt(promptTitle)
        }
      } catch (error) {
        // Prompt might already be deleted
      }
    }
  })

  test.describe('Create Operations', () => {
    test('should create a basic prompt with all fields', async ({ page }) => {
      const promptData = BasicPromptTemplates.codeReview

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Verify prompt was created
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      
      // Verify prompt details
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.title).toBe(promptData.title)
      expect(promptInfo.description).toBe(promptData.description)
      
      // Verify tags
      for (const tag of promptData.tags || []) {
        expect(promptInfo.tags).toContain(tag)
      }

      // Verify success message
      await testHelpers.assertToastMessage('Prompt created successfully')
    })

    test('should create a minimal prompt with only required fields', async ({ page }) => {
      const promptData = {
        title: 'Minimal Test Prompt',
        content: 'This is a minimal prompt content'
      }

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Verify prompt was created
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.title).toBe(promptData.title)
    })

    test('should create a complex prompt with variables', async ({ page }) => {
      const promptData = ComplexPromptTemplate

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Verify prompt was created
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      
      // Open prompt to verify content preserved
      await promptsPage.openPrompt(promptData.title)
      await expect(promptsPage.promptDialog).toBeVisible()
      
      // Verify variables are preserved in content
      const contentElement = promptsPage.promptContentTextarea.or(promptsPage.promptEditor)
      await expect(contentElement).toBeVisible()
    })

    test('should validate required fields', async ({ page }) => {
      // Open create dialog
      await promptsPage.createPromptButton.click()
      await expect(promptsPage.promptDialog).toBeVisible()

      // Try to submit without filling required fields
      await promptsPage.submitPromptButton.click()

      // Should show validation errors
      const errorMessage = page.locator('.error-message, [role="alert"]')
      await expect(errorMessage.first()).toBeVisible()

      // Dialog should remain open
      await expect(promptsPage.promptDialog).toBeVisible()
    })

    test('should handle duplicate titles gracefully', async ({ page }) => {
      const promptData = {
        title: 'Duplicate Test Prompt',
        content: 'Original content'
      }

      // Create first prompt
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Try to create duplicate
      await promptsPage.createPromptButton.click()
      await promptsPage.promptTitleInput.fill(promptData.title)
      await promptsPage.promptContentTextarea.fill('Different content')
      await promptsPage.submitPromptButton.click()

      // Should show error about duplicate
      await testHelpers.assertToastMessage('already exists', 'error')
    })

    test('should create multiple prompts in sequence', async ({ page }) => {
      const prompts = PromptTestDataFactory.generateCRUDTestSet().slice(0, 3)

      for (const promptData of prompts) {
        await promptsPage.createPrompt(promptData)
        createdPrompts.push(promptData.title)
        
        // Verify each prompt is created
        await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      }

      // Verify all prompts are visible
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBeGreaterThanOrEqual(prompts.length)
    })

    test('should handle special characters in prompt data', async ({ page }) => {
      const promptData = EdgeCasePrompts.specialCharacters

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Verify prompt was created with special characters intact
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
    })

    test('should create prompt with many tags', async ({ page }) => {
      const promptData = EdgeCasePrompts.manyTags

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Verify prompt was created
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      
      // Verify tags are displayed (might be truncated)
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.tags.length).toBeGreaterThan(0)
    })
  })

  test.describe('Read Operations', () => {
    test('should display prompt details correctly', async ({ page }) => {
      const promptData = BasicPromptTemplates.documentation

      // Create prompt via API or helper
      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Open prompt details
      await promptsPage.openPrompt(promptData.title)
      
      // Verify dialog shows prompt details
      await expect(promptsPage.promptDialog).toBeVisible()
      await expect(promptsPage.promptTitleInput).toHaveValue(promptData.title)
      
      // Verify content is displayed
      const contentElement = promptsPage.promptContentTextarea.or(promptsPage.promptEditor)
      await expect(contentElement).toBeVisible()
    })

    test('should list all created prompts', async ({ page }) => {
      const prompts = PromptTestDataFactory.generateCRUDTestSet().slice(0, 5)

      // Create multiple prompts
      for (const promptData of prompts) {
        await promptsPage.createPrompt(promptData)
        createdPrompts.push(promptData.title)
      }

      // Verify all prompts are listed
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      for (const prompt of prompts) {
        expect(visibleTitles).toContain(prompt.title)
      }
    })

    test('should show empty state when no prompts exist', async ({ page }) => {
      // Navigate to a fresh prompts page (assuming no prompts initially)
      await promptsPage.goto()
      
      // Check for empty state or existing prompts
      const hasPrompts = await promptsPage.getPromptCount() > 0
      
      if (!hasPrompts) {
        await expect(promptsPage.emptyState).toBeVisible()
      }
    })

    test('should display prompt metadata correctly', async ({ page }) => {
      const promptData = BasicPromptTemplates.testGeneration

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      
      // Verify all metadata is present
      expect(promptInfo.title).toBe(promptData.title)
      expect(promptInfo.description).toBe(promptData.description)
      expect(promptInfo.tags).toEqual(expect.arrayContaining(promptData.tags || []))
      expect(promptInfo.lastModified).toBeTruthy()
    })
  })

  test.describe('Update Operations', () => {
    test('should edit prompt title', async ({ page }) => {
      const originalData = {
        title: 'Original Title',
        content: 'Original content'
      }
      const updatedTitle = 'Updated Title'

      // Create original prompt
      await promptsPage.createPrompt(originalData)
      createdPrompts.push(originalData.title)

      // Edit the prompt
      await promptsPage.editPrompt(originalData.title, {
        title: updatedTitle
      })
      createdPrompts.push(updatedTitle)

      // Verify old title is gone and new title exists
      await expect(promptsPage.getPromptCard(updatedTitle)).toBeVisible()
      await expect(promptsPage.getPromptCard(originalData.title)).not.toBeVisible()
    })

    test('should edit prompt content', async ({ page }) => {
      const originalData = BasicPromptTemplates.refactoring
      const updatedContent = 'This is the updated content for the refactoring assistant'

      await promptsPage.createPrompt(originalData)
      createdPrompts.push(originalData.title)

      // Edit the content
      await promptsPage.editPrompt(originalData.title, {
        content: updatedContent
      })

      // Open prompt to verify content updated
      await promptsPage.openPrompt(originalData.title)
      const contentElement = promptsPage.promptContentTextarea.or(promptsPage.promptEditor)
      await expect(contentElement).toBeVisible()
    })

    test('should edit prompt description and tags', async ({ page }) => {
      const originalData = {
        title: 'Test Prompt for Editing',
        content: 'Test content',
        description: 'Original description',
        tags: ['original', 'test']
      }

      const updates = {
        description: 'Updated description with more details',
        tags: ['updated', 'modified', 'test']
      }

      await promptsPage.createPrompt(originalData)
      createdPrompts.push(originalData.title)

      // Edit description and tags
      await promptsPage.editPrompt(originalData.title, updates)

      // Verify updates
      const promptInfo = await promptsPage.getPromptInfo(originalData.title)
      expect(promptInfo.description).toBe(updates.description)
      
      for (const tag of updates.tags || []) {
        expect(promptInfo.tags).toContain(tag)
      }
    })

    test('should handle edit cancellation', async ({ page }) => {
      const promptData = BasicPromptTemplates.debugging

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Start editing
      await promptsPage.openPromptMenu(promptData.title)
      await promptsPage.promptMenuEdit.click()
      await expect(promptsPage.promptDialog).toBeVisible()

      // Make changes but cancel
      await promptsPage.promptTitleInput.fill('Cancelled Title')
      await promptsPage.cancelPromptButton.click()

      // Verify prompt unchanged
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.title).toBe(promptData.title)
    })

    test('should validate updates before saving', async ({ page }) => {
      const promptData = {
        title: 'Validation Test Prompt',
        content: 'Test content'
      }

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Try to edit with invalid data (empty title)
      await promptsPage.openPromptMenu(promptData.title)
      await promptsPage.promptMenuEdit.click()
      await promptsPage.promptTitleInput.clear()
      await promptsPage.submitPromptButton.click()

      // Should show validation error
      const errorMessage = page.locator('.error-message, [role="alert"]')
      await expect(errorMessage.first()).toBeVisible()
    })
  })

  test.describe('Delete Operations', () => {
    test('should delete a single prompt with confirmation', async ({ page }) => {
      const promptData = {
        title: 'Prompt to Delete',
        content: 'This prompt will be deleted'
      }

      await promptsPage.createPrompt(promptData)
      
      // Delete the prompt
      await promptsPage.deletePrompt(promptData.title)

      // Verify prompt is deleted
      await expect(promptsPage.getPromptCard(promptData.title)).not.toBeVisible()
      
      // Verify success message
      await testHelpers.assertToastMessage('deleted successfully')
    })

    test('should cancel deletion when declined', async ({ page }) => {
      const promptData = {
        title: 'Prompt Not to Delete',
        content: 'This prompt should remain'
      }

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Start deletion but cancel
      await promptsPage.openPromptMenu(promptData.title)
      await promptsPage.promptMenuDelete.click()
      
      // Cancel in confirmation dialog
      await promptsPage.handleConfirmationDialog('cancel')

      // Verify prompt still exists
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
    })

    test('should delete multiple prompts in sequence', async ({ page }) => {
      const prompts = [
        { title: 'Delete Me 1', content: 'Content 1' },
        { title: 'Delete Me 2', content: 'Content 2' },
        { title: 'Delete Me 3', content: 'Content 3' }
      ]

      // Create prompts
      for (const promptData of prompts) {
        await promptsPage.createPrompt(promptData)
      }

      // Delete each prompt
      for (const promptData of prompts) {
        await promptsPage.deletePrompt(promptData.title)
        await expect(promptsPage.getPromptCard(promptData.title)).not.toBeVisible()
      }

      // Verify all are deleted
      for (const promptData of prompts) {
        expect(await promptsPage.promptExists(promptData.title)).toBe(false)
      }
    })
  })

  test.describe('Duplicate Operations', () => {
    test('should duplicate a prompt with auto-generated name', async ({ page }) => {
      const originalData = BasicPromptTemplates.codeReview

      await promptsPage.createPrompt(originalData)
      createdPrompts.push(originalData.title)

      // Duplicate without specifying new name
      await promptsPage.duplicatePrompt(originalData.title)
      
      const expectedDuplicateName = `${originalData.title} (Copy)`
      createdPrompts.push(expectedDuplicateName)

      // Verify both prompts exist
      await expect(promptsPage.getPromptCard(originalData.title)).toBeVisible()
      await expect(promptsPage.getPromptCard(expectedDuplicateName)).toBeVisible()
    })

    test('should duplicate a prompt with custom name', async ({ page }) => {
      const originalData = BasicPromptTemplates.documentation
      const duplicateName = 'Custom Duplicate Name'

      await promptsPage.createPrompt(originalData)
      createdPrompts.push(originalData.title)

      // Duplicate with custom name
      await promptsPage.duplicatePrompt(originalData.title, duplicateName)
      createdPrompts.push(duplicateName)

      // Verify both prompts exist
      await expect(promptsPage.getPromptCard(originalData.title)).toBeVisible()
      await expect(promptsPage.getPromptCard(duplicateName)).toBeVisible()

      // Verify duplicate has same content
      const originalInfo = await promptsPage.getPromptInfo(originalData.title)
      const duplicateInfo = await promptsPage.getPromptInfo(duplicateName)
      
      expect(duplicateInfo.description).toBe(originalInfo.description)
      expect(duplicateInfo.tags).toEqual(originalInfo.tags)
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors during creation', async ({ page }) => {
      // Mock network error
      await testHelpers.mockNetworkError('**/api/prompts')

      const promptData = {
        title: 'Network Error Test',
        content: 'This should fail'
      }

      // Try to create prompt
      await promptsPage.createPromptButton.click()
      await promptsPage.promptTitleInput.fill(promptData.title)
      await promptsPage.promptContentTextarea.fill(promptData.content)
      await promptsPage.submitPromptButton.click()

      // Should show error message
      await testHelpers.assertToastMessage('Failed', 'error')
    })

    test('should handle server errors gracefully', async ({ page }) => {
      // Mock server error
      await testHelpers.mockAPIError('**/api/prompts', 500, 'Internal Server Error')

      const promptData = {
        title: 'Server Error Test',
        content: 'This should show error'
      }

      // Try to create prompt
      await promptsPage.createPromptButton.click()
      await promptsPage.promptTitleInput.fill(promptData.title)
      await promptsPage.promptContentTextarea.fill(promptData.content)
      await promptsPage.submitPromptButton.click()

      // Should show error message
      await testHelpers.assertToastMessage('Error', 'error')
    })

    test('should handle large content gracefully', async ({ page }) => {
      const largeContent = PromptTestHelpers.generateLargeContent(1000)
      const promptData = {
        title: 'Large Content Test',
        content: largeContent
      }

      await promptsPage.createPrompt(promptData)
      createdPrompts.push(promptData.title)

      // Verify prompt was created successfully
      await expect(promptsPage.getPromptCard(promptData.title)).toBeVisible()
    })

    test('should prevent XSS attacks', async ({ page }) => {
      const xssPrompt = EdgeCasePrompts.xssAttempt

      await promptsPage.createPrompt(xssPrompt)
      createdPrompts.push(xssPrompt.title)

      // Verify prompt is created but XSS is prevented
      await expect(promptsPage.getPromptCard(xssPrompt.title)).toBeVisible()
      
      // Check that no alert was triggered
      const alerts: string[] = []
      page.on('dialog', dialog => {
        alerts.push(dialog.message())
        dialog.dismiss()
      })

      // Wait a moment to see if any XSS executes
      await page.waitForTimeout(1000)
      expect(alerts).toHaveLength(0)
    })

    test('should prevent SQL injection', async ({ page }) => {
      const sqlPrompt = EdgeCasePrompts.sqlInjection

      await promptsPage.createPrompt(sqlPrompt)
      createdPrompts.push(sqlPrompt.title)

      // Verify prompt is created safely
      await expect(promptsPage.getPromptCard(sqlPrompt.title)).toBeVisible()
      
      // Verify the system is still functional
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBeGreaterThan(0)
    })
  })
})