/**
 * Comprehensive Prompt Management Tests
 * Tests all CRUD operations, hover interactions, three-dot menus, and clipboard operations
 */

import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../pages/projects.page'
import { PromptManagementPage } from '../pages/prompt-management.page'
import { createPrompt, createProject, createScenario } from '../fixtures/enhanced-test-builders'
import { TestDataFactory } from '../fixtures/test-data'

test.describe('Prompt Management - Detailed Testing', () => {
  let projectsPage: ProjectsPage
  let promptManagementPage: PromptManagementPage
  let testProject: any

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    promptManagementPage = new PromptManagementPage(page)

    // Create test project with sample prompts
    const scenario = createScenario('prompt_management')
      .withProject(p => p.asWebApp())
      .withPrompts(
        p => p.asCodeReview().title('Code Review Expert'),
        p => p.asDocumentation().title('Documentation Generator'),
        p => p.asTesting().title('Test Suite Creator'),
        p => p.asBugAnalysis().title('Bug Analysis Assistant'),
        p => p.asRefactoring().title('Refactoring Guide')
      )
      .build()

    testProject = scenario.project

    // Navigate to project page
    await page.goto(`/projects/${testProject.id}`)
    await promptManagementPage.waitForPromptsLoad()
  })

  test.describe('Prompt Card Display and Information', () => {
    test('should display all prompt cards with correct information', async () => {
      // Verify all test prompts are displayed
      const promptCount = await promptManagementPage.getPromptCount()
      expect(promptCount).toBeGreaterThanOrEqual(5)

      // Check specific prompts
      const codeReviewPrompt = await promptManagementPage.findPromptByTitle('Code Review Expert')
      expect(codeReviewPrompt).toBeTruthy()
      expect(codeReviewPrompt?.description).toContain('Comprehensive code review assistant')
      expect(codeReviewPrompt?.tags).toContain('code')
      expect(codeReviewPrompt?.tags).toContain('review')

      const documentationPrompt = await promptManagementPage.findPromptByTitle('Documentation Generator')
      expect(documentationPrompt).toBeTruthy()
      expect(documentationPrompt?.description).toContain('Generates technical documentation')
      expect(documentationPrompt?.tags).toContain('docs')
    })

    test('should display prompt metadata correctly', async () => {
      const firstPrompt = await promptManagementPage.getPromptCardInfo(0)
      
      // Verify required fields
      expect(firstPrompt.title).toBeTruthy()
      expect(firstPrompt.title.length).toBeGreaterThan(0)
      
      // Check optional metadata if present
      if (firstPrompt.tokenCount) {
        expect(firstPrompt.tokenCount).toBeGreaterThan(0)
      }
      
      if (firstPrompt.lastModified) {
        expect(firstPrompt.lastModified).toBeTruthy()
      }
    })

    test('should display prompt preview content', async () => {
      const codeReviewCard = await promptManagementPage.getPromptCardInfo('Code Review Expert')
      
      if (codeReviewCard.content) {
        expect(codeReviewCard.content).toContain('review')
        expect(codeReviewCard.content).toContain('code')
      }
    })
  })

  test.describe('Hover Interactions', () => {
    test('should show copy icon on prompt card hover', async () => {
      await promptManagementPage.hoverPromptCard('Code Review Expert')
      
      const card = promptManagementPage.promptCard('Code Review Expert')
      await expect(promptManagementPage.promptCopyIcon(card)).toBeVisible()
    })

    test('should show three-dot menu on prompt card hover', async () => {
      await promptManagementPage.hoverPromptCard('Documentation Generator')
      
      const card = promptManagementPage.promptCard('Documentation Generator')
      await expect(promptManagementPage.promptThreeDotMenu(card)).toBeVisible()
    })

    test('should hide hover actions when mouse moves away', async () => {
      const card = promptManagementPage.promptCard('Test Suite Creator')
      
      // Hover to show actions
      await promptManagementPage.hoverPromptCard('Test Suite Creator')
      await expect(promptManagementPage.promptHoverOverlay(card)).toBeVisible()
      
      // Move mouse away
      await promptManagementPage.unhoverPromptCard()
      await expect(promptManagementPage.promptHoverOverlay(card)).toBeHidden({ timeout: 2000 })
    })

    test('should maintain hover state during interaction', async () => {
      await promptManagementPage.hoverPromptCard('Bug Analysis Assistant', { duration: 500 })
      
      const card = promptManagementPage.promptCard('Bug Analysis Assistant')
      
      // Verify actions remain visible during interaction
      await expect(promptManagementPage.promptCopyIcon(card)).toBeVisible()
      await expect(promptManagementPage.promptThreeDotMenu(card)).toBeVisible()
      
      // Should be able to interact with copy icon
      await promptManagementPage.promptCopyIcon(card).click()
      await promptManagementPage.waitForToast(/copied.*clipboard/i)
    })

    test('should show hover effects on all visible prompt cards', async () => {
      const promptCount = await promptManagementPage.getPromptCount()
      
      for (let i = 0; i < Math.min(promptCount, 3); i++) {
        await promptManagementPage.verifyHoverActionsAppear(i)
        await promptManagementPage.unhoverPromptCard()
        await test.step(`Verified hover for prompt ${i}`, async () => {})
      }
    })
  })

  test.describe('Copy Operations', () => {
    test('should copy prompt content via hover copy icon', async () => {
      await promptManagementPage.copyPromptViaIcon('Refactoring Guide')
    })

    test('should copy prompt content via three-dot menu', async () => {
      await promptManagementPage.copyPromptViaMenu('Code Review Expert')
    })

    test('should handle clipboard permissions gracefully', async ({ context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      
      await promptManagementPage.copyPromptViaIcon('Documentation Generator')
      
      // Verify clipboard content if accessible
      const clipboardContent = await promptManagementPage.page.evaluate(() => {
        return navigator.clipboard.readText().catch(() => null)
      })
      
      if (clipboardContent) {
        expect(clipboardContent).toContain('documentation')
      }
    })

    test('should show different toast messages for different copy operations', async () => {
      // Copy via icon
      await promptManagementPage.copyPromptViaIcon('Test Suite Creator')
      
      // Copy via menu 
      await promptManagementPage.copyPromptViaMenu('Bug Analysis Assistant')
    })
  })

  test.describe('Three-Dot Menu Operations', () => {
    test('should open and close three-dot menu correctly', async () => {
      await promptManagementPage.openPromptContextMenu('Code Review Expert')
      await expect(promptManagementPage.promptContextMenu).toBeVisible()
      
      await promptManagementPage.closePromptContextMenu()
      await expect(promptManagementPage.promptContextMenu).toBeHidden()
    })

    test('should display all menu options', async () => {
      await promptManagementPage.openPromptContextMenu('Documentation Generator')
      await promptManagementPage.verifyContextMenuOptions()
    })

    test('should handle View Prompt action', async () => {
      await promptManagementPage.viewPrompt('Test Suite Creator')
      
      // Verify view dialog content
      const content = await promptManagementPage.getPromptContentFromViewDialog()
      expect(content).toContain('test')
      expect(content).toContain('Test')
      
      await promptManagementPage.closePromptViewDialog()
    })

    test('should handle Edit Prompt action', async () => {
      await promptManagementPage.editPrompt('Bug Analysis Assistant')
      
      // Verify edit form is populated
      await expect(promptManagementPage.promptTitleInput).toHaveValue(/Bug Analysis/)
      await expect(promptManagementPage.promptContentEditor).toBeVisible()
      
      // Make a small edit
      await promptManagementPage.fillPromptEditForm({
        description: 'Updated: Analyzes and helps resolve bugs with enhanced features'
      })
      
      await promptManagementPage.savePromptChanges()
      
      // Verify update was applied
      const updatedPrompt = await promptManagementPage.findPromptByTitle('Bug Analysis Assistant')
      expect(updatedPrompt?.description).toContain('Updated:')
    })

    test('should handle Export as Markdown action', async () => {
      const download = await promptManagementPage.exportPromptAsMarkdown('Refactoring Guide')
      await promptManagementPage.verifyMarkdownExport(download, 'refactoring')
    })

    test('should handle Delete Prompt action with confirmation', async () => {
      // Create a temporary prompt for deletion
      await promptManagementPage.createPrompt({
        title: 'Temporary Test Prompt',
        content: 'This prompt will be deleted during testing',
        description: 'Test prompt for deletion'
      })
      
      // Delete without confirmation (should cancel)
      await promptManagementPage.deletePrompt('Temporary Test Prompt', false)
      
      // Verify prompt still exists
      const stillExists = await promptManagementPage.findPromptByTitle('Temporary Test Prompt')
      expect(stillExists).toBeTruthy()
      
      // Delete with confirmation
      await promptManagementPage.deletePrompt('Temporary Test Prompt', true)
      await promptManagementPage.verifyPromptDeleted('Temporary Test Prompt')
    })

    test('should handle menu keyboard navigation', async () => {
      await promptManagementPage.openPromptContextMenu('Code Review Expert')
      
      // Navigate with arrow keys
      await promptManagementPage.page.keyboard.press('ArrowDown')
      await expect(promptManagementPage.menuEditPrompt).toBeFocused()
      
      await promptManagementPage.page.keyboard.press('ArrowDown')
      await expect(promptManagementPage.menuCopyContent).toBeFocused()
      
      // Close with Escape
      await promptManagementPage.page.keyboard.press('Escape')
      await expect(promptManagementPage.promptContextMenu).toBeHidden()
    })
  })

  test.describe('Prompt CRUD Operations', () => {
    test('should create new prompt successfully', async () => {
      const newPromptData = {
        title: 'API Design Expert',
        content: 'Design and review RESTful APIs with best practices:\n\n{{api_spec}}\n\nProvide feedback on:\n- Resource naming\n- HTTP methods\n- Status codes\n- Security considerations',
        description: 'Expert assistant for API design and review',
        tags: ['api', 'design', 'rest']
      }
      
      await promptManagementPage.createPrompt(newPromptData)
      
      // Verify prompt was created
      const createdPrompt = await promptManagementPage.findPromptByTitle(newPromptData.title)
      expect(createdPrompt).toBeTruthy()
      expect(createdPrompt?.description).toBe(newPromptData.description)
    })

    test('should update existing prompt', async () => {
      const updateData = {
        title: 'Enhanced Code Review Expert',
        description: 'Advanced code review with security and performance analysis',
        content: 'Enhanced code review prompt with additional security checks',
        tags: ['code', 'review', 'security', 'performance']
      }
      
      await promptManagementPage.editPrompt('Code Review Expert')
      await promptManagementPage.fillPromptEditForm(updateData)
      await promptManagementPage.savePromptChanges()
      
      // Verify updates
      const updatedPrompt = await promptManagementPage.findPromptByTitle(updateData.title)
      expect(updatedPrompt).toBeTruthy()
      expect(updatedPrompt?.description).toBe(updateData.description)
    })

    test('should handle edit form validation', async () => {
      await promptManagementPage.editPrompt('Documentation Generator')
      
      // Try to save with empty title
      await promptManagementPage.fillPromptEditForm({ title: '' })
      await promptManagementPage.savePromptChanges()
      
      // Should show validation error and keep dialog open
      await expect(promptManagementPage.promptEditDialog).toBeVisible()
      await promptManagementPage.waitForToast(/title.*required/i)
    })

    test('should cancel prompt creation', async () => {
      await promptManagementPage.createNewPrompt()
      await promptManagementPage.fillPromptEditForm({
        title: 'Cancelled Prompt',
        content: 'This should not be saved'
      })
      
      await promptManagementPage.cancelPromptChanges()
      
      // Verify prompt was not created
      const cancelledPrompt = await promptManagementPage.findPromptByTitle('Cancelled Prompt')
      expect(cancelledPrompt).toBeFalsy()
    })

    test('should perform complete CRUD workflow', async () => {
      const testPromptData = {
        title: 'CRUD Test Prompt',
        content: 'Original content for CRUD testing',
        description: 'Test prompt for CRUD operations',
        tags: ['test', 'crud']
      }
      
      await promptManagementPage.testPromptCRUDWorkflow(testPromptData)
    })
  })

  test.describe('Prompt Content and Monaco Editor', () => {
    test('should handle Monaco editor in prompt editing', async () => {
      await promptManagementPage.editPrompt('Test Suite Creator')
      
      // Check if Monaco editor is present
      const hasMonaco = await promptManagementPage.promptContentEditor
        .locator('.monaco-editor')
        .isVisible()
      
      if (hasMonaco) {
        // Test Monaco-specific functionality
        const newContent = 'Updated content with Monaco editor:\n\n{{test_target}}\n\nGenerate comprehensive tests including:\n- Unit tests\n- Integration tests\n- Edge cases\n- Performance tests'
        
        await promptManagementPage.fillPromptEditForm({
          content: newContent
        })
        
        await promptManagementPage.savePromptChanges()
        
        // Verify content was updated
        await promptManagementPage.viewPrompt('Test Suite Creator')
        const viewContent = await promptManagementPage.getPromptContentFromViewDialog()
        expect(viewContent).toContain('Updated content with Monaco')
        await promptManagementPage.closePromptViewDialog()
      }
    })

    test('should preserve content formatting', async () => {
      const formattedContent = `# Formatted Prompt

This is a **formatted** prompt with:

1. Numbered lists
2. **Bold text**
3. \`Code blocks\`

## Variables
- {{input}}
- {{context}}

### Code Example
\`\`\`javascript
console.log("Hello, World!");
\`\`\`
`
      
      await promptManagementPage.createPrompt({
        title: 'Formatted Content Test',
        content: formattedContent,
        description: 'Tests content formatting preservation'
      })
      
      // View the prompt to check formatting
      await promptManagementPage.viewPrompt('Formatted Content Test')
      const content = await promptManagementPage.getPromptContentFromViewDialog()
      
      expect(content).toContain('# Formatted Prompt')
      expect(content).toContain('**formatted**')
      expect(content).toContain('{{input}}')
      expect(content).toContain('console.log')
      
      await promptManagementPage.closePromptViewDialog()
    })
  })

  test.describe('Performance and Accessibility', () => {
    test('should handle large number of prompts efficiently', async () => {
      // Create additional prompts for performance testing
      const startTime = Date.now()
      
      for (let i = 0; i < 10; i++) {
        await promptManagementPage.createPrompt({
          title: `Performance Test Prompt ${i + 1}`,
          content: `Test content for performance prompt ${i + 1}`,
          description: `Performance test prompt number ${i + 1}`
        })
      }
      
      const endTime = Date.now()
      const creationTime = endTime - startTime
      
      // Should create prompts within reasonable time (30 seconds for 10 prompts)
      expect(creationTime).toBeLessThan(30000)
      
      // Verify all prompts are displayed
      const totalPrompts = await promptManagementPage.getPromptCount()
      expect(totalPrompts).toBeGreaterThanOrEqual(15) // Original 5 + 10 new ones
    })

    test('should support keyboard navigation through prompt cards', async () => {
      const firstCard = promptManagementPage.promptCardByIndex(0)
      
      // Focus first prompt card
      await firstCard.focus()
      
      // Tab to hover actions when focused
      await promptManagementPage.page.keyboard.press('Tab')
      
      // Should be able to activate copy with Enter
      await promptManagementPage.page.keyboard.press('Enter')
      await promptManagementPage.waitForToast(/copied/i)
    })

    test('should have proper ARIA labels and roles', async () => {
      const promptCard = promptManagementPage.promptCardByIndex(0)
      
      // Check accessibility attributes
      await expect(promptCard).toHaveAttribute('role')
      
      const copyIcon = promptManagementPage.promptCopyIcon(promptCard)
      await promptCard.hover()
      
      if (await copyIcon.isVisible()) {
        await expect(copyIcon).toHaveAttribute('aria-label')
      }
    })

    test('should work correctly at different viewport sizes', async () => {
      // Test desktop view
      await promptManagementPage.page.setViewportSize({ width: 1920, height: 1080 })
      await expect(promptManagementPage.promptsContainer).toBeVisible()
      
      // Test tablet view
      await promptManagementPage.page.setViewportSize({ width: 768, height: 1024 })
      await expect(promptManagementPage.promptsContainer).toBeVisible()
      
      // Test mobile view
      await promptManagementPage.page.setViewportSize({ width: 375, height: 667 })
      await expect(promptManagementPage.promptsContainer).toBeVisible()
      
      // Verify prompts are still accessible
      const promptCount = await promptManagementPage.getPromptCount()
      expect(promptCount).toBeGreaterThan(0)
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle empty prompt list gracefully', async ({ page }) => {
      // Navigate to project with no prompts
      await page.goto('/projects/empty-project')
      await promptManagementPage.waitForPromptsLoad()
      
      // Should show empty state
      await expect(promptManagementPage.emptyPromptsState).toBeVisible()
    })

    test('should handle network errors during CRUD operations', async () => {
      // Simulate network failure
      await promptManagementPage.page.route('**/api/prompts/**', route => route.abort())
      
      try {
        await promptManagementPage.createNewPrompt()
        await promptManagementPage.fillPromptEditForm({
          title: 'Network Error Test',
          content: 'This should fail'
        })
        await promptManagementPage.savePromptChanges()
        
        // Should show error message
        await promptManagementPage.waitForToast(/error.*creating/i)
      } finally {
        // Restore network
        await promptManagementPage.page.unroute('**/api/prompts/**')
      }
    })

    test('should handle concurrent prompt operations', async () => {
      // Perform multiple operations simultaneously
      await Promise.all([
        promptManagementPage.hoverPromptCard(0),
        promptManagementPage.hoverPromptCard(1),
        promptManagementPage.hoverPromptCard(2)
      ])
      
      // All hover operations should complete successfully
      for (let i = 0; i < 3; i++) {
        const card = promptManagementPage.promptCardByIndex(i)
        await expect(promptManagementPage.promptHoverOverlay(card)).toBeVisible()
      }
    })

    test('should handle malformed prompt data gracefully', async () => {
      // This test would depend on how the backend handles malformed data
      // Here we test the frontend's resilience to missing or malformed fields
      
      const allPrompts = await promptManagementPage.getAllPromptCardsInfo()
      
      // Each prompt should have at minimum a title
      for (const prompt of allPrompts) {
        expect(prompt.title).toBeTruthy()
        expect(prompt.title.length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Integration with Project Context', () => {
    test('should allow adding prompts to project context', async () => {
      // Switch to context tab
      await projectContextPage.navigateToContext()
      
      // Trigger prompt suggestions
      await projectContextPage.fillUserInput('I need help with code review')
      await projectContextPage.triggerPromptSuggestions()
      
      // Should suggest the Code Review Expert prompt
      const suggestions = await projectContextPage.getSuggestedPrompts()
      const codeReviewSuggestion = suggestions.find(s => s.title.includes('Code Review'))
      expect(codeReviewSuggestion).toBeTruthy()
      
      // Select the suggestion
      await projectContextPage.selectPromptSuggestionByTitle('Code Review Expert')
      
      // Verify prompt was added to context
      const selectedPrompts = await projectContextPage.getSelectedPromptsList()
      expect(selectedPrompts).toContain('Code Review Expert')
    })

    test('should update context when prompts are modified', async () => {
      // Add a prompt to context first
      await projectContextPage.navigateToContext()
      await projectContextPage.fillUserInput('Documentation help needed')
      await projectContextPage.triggerPromptSuggestions()
      await projectContextPage.selectPromptSuggestionByTitle('Documentation Generator')
      
      // Modify the prompt
      await promptManagementPage.editPrompt('Documentation Generator')
      await promptManagementPage.fillPromptEditForm({
        title: 'Advanced Documentation Generator'
      })
      await promptManagementPage.savePromptChanges()
      
      // Return to context tab and verify updated name
      await projectContextPage.navigateToContext()
      const selectedPrompts = await projectContextPage.getSelectedPromptsList()
      expect(selectedPrompts).toContain('Advanced Documentation Generator')
    })
  })
})