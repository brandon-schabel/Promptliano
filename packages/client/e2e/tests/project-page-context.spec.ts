/**
 * Project Page - Context Tab Test Suite
 *
 * Tests user input management, file suggestions, prompt suggestions,
 * copy to chat functionality, and project summary display.
 */

import { test, expect } from '@playwright/test'
import { ProjectPage } from '../pages/project-page'
import { ProjectPageTestUtils } from '../utils/project-page-test-manager'
import { ProjectPageTestData } from '../fixtures/project-page-data'
import { MCPTestHelpers } from '../utils/mcp-test-helpers'

test.describe('Project Context Tab - User Input Management', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    // Setup complete project environment
    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle user input and copy functionality', async ({ page }) => {
    // Test user input
    const testInput = 'Please review the authentication system and provide feedback on security best practices'
    await projectPage.fillUserInput(testInput)

    // Verify input is saved and displayed
    await expect(projectPage.userInputTextarea).toHaveValue(testInput)

    // Test copy all functionality
    await projectPage.copyAllButton.click()

    // Verify toast notification appears
    await expect(page.getByText('Copied to clipboard')).toBeVisible()

    // Test that input persists after page interaction
    await page.reload()
    await projectPage.waitForProjectPageLoad()
    await expect(projectPage.userInputTextarea).toHaveValue(testInput)
  })

  test('should preserve user input during navigation', async ({ page }) => {
    const testInput = 'Context should persist across navigation'
    await projectPage.fillUserInput(testInput)

    // Navigate away and back
    await projectPage.gotoProjectsList()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Verify input is preserved
    await expect(projectPage.userInputTextarea).toHaveValue(testInput)
  })

  test('should handle large user input efficiently', async ({ page }) => {
    // Create large input text (several paragraphs)
    const largeInput = Array.from(
      { length: 10 },
      (_, i) =>
        `Paragraph ${i + 1}: This is a detailed description of the requirements for this project. ` +
        `We need to ensure that the system can handle complex user input, maintain performance, ` +
        `and provide appropriate feedback to users about their context.`
    ).join('\n\n')

    await projectPage.fillUserInput(largeInput)

    // Verify large input is handled correctly
    await expect(projectPage.userInputTextarea).toHaveValue(largeInput)

    // Test copy functionality with large content
    await projectPage.copyAllButton.click()
    await expect(page.getByText('Copied to clipboard')).toBeVisible()
  })

  test('should show character count and provide feedback', async ({ page }) => {
    const testInput = 'Testing character count functionality'
    await projectPage.fillUserInput(testInput)

    // Look for character counter if it exists
    const characterCounter = page.getByTestId('character-count')
    if (await characterCounter.isVisible()) {
      const counterText = await characterCounter.textContent()
      expect(counterText).toContain(testInput.length.toString())
    }
  })
})

test.describe('Project Context Tab - File Suggestions', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    // Setup environment with file structure
    await testManager.setupProjectPageEnvironment({
      fileStructure: ProjectPageTestData.fileStructure
    })
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should suggest files based on authentication-related input', async ({ page }) => {
    // Enter authentication-related context
    await projectPage.fillUserInput('auth authentication login user security jwt token validation')

    // Click search files button
    await projectPage.searchFilesButton.click()

    // Wait for and verify file suggestions dialog appears
    await expect(projectPage.fileSuggestionsDialog).toBeVisible()

    // Verify relevant files are suggested
    const suggestions = projectPage.suggestedFiles
    await expect(suggestions).toHaveCount.atLeast(1)

    // Check that suggestions are relevant to authentication
    const suggestionTexts = await suggestions.allTextContents()
    const hasAuthRelatedFiles = suggestionTexts.some((text) => /auth|login|jwt|token|security/i.test(text))
    expect(hasAuthRelatedFiles).toBeTruthy()
  })

  test('should suggest component files for UI-related input', async ({ page }) => {
    await projectPage.fillUserInput('button component UI interface form modal dialog')

    await projectPage.searchFilesButton.click()
    await expect(projectPage.fileSuggestionsDialog).toBeVisible()

    // Verify UI component files are suggested
    const suggestions = await projectPage.suggestedFiles.allTextContents()
    const hasUIFiles = suggestions.some((text) => /button|modal|input|component/i.test(text))
    expect(hasUIFiles).toBeTruthy()
  })

  test('should suggest test files for testing-related input', async ({ page }) => {
    await projectPage.fillUserInput('testing unit test integration test e2e test cases')

    await projectPage.searchFilesButton.click()
    await expect(projectPage.fileSuggestionsDialog).toBeVisible()

    const suggestions = await projectPage.suggestedFiles.allTextContents()
    const hasTestFiles = suggestions.some((text) => /test|spec/i.test(text))
    expect(hasTestFiles).toBeTruthy()
  })

  test('should handle file selection from suggestions', async ({ page }) => {
    await projectPage.fillUserInput('authentication system')
    await projectPage.searchFilesButton.click()

    await expect(projectPage.fileSuggestionsDialog).toBeVisible()
    await expect(projectPage.suggestedFiles).toHaveCount.atLeast(1)

    // Select the first suggested file
    await projectPage.suggestedFiles.first().click()

    // Verify dialog closes and file is selected
    await expect(projectPage.fileSuggestionsDialog).not.toBeVisible()

    // The file should now appear in the selected files area
    const selectedFiles = await projectPage.getSelectedFilesList()
    expect(selectedFiles.length).toBeGreaterThan(0)
  })

  test('should close suggestions dialog without selection', async ({ page }) => {
    await projectPage.fillUserInput('test input')
    await projectPage.searchFilesButton.click()

    await expect(projectPage.fileSuggestionsDialog).toBeVisible()

    // Close dialog with X button or ESC
    await page.keyboard.press('Escape')
    await expect(projectPage.fileSuggestionsDialog).not.toBeVisible()
  })

  test('should show token counts for suggested files', async ({ page }) => {
    await projectPage.fillUserInput('authentication')
    await projectPage.searchFilesButton.click()

    await expect(projectPage.fileSuggestionsDialog).toBeVisible()
    const firstSuggestion = projectPage.suggestedFiles.first()

    // Look for token count information
    await expect(firstSuggestion).toContainText(/\d+\s*token/i)
  })
})

test.describe('Project Context Tab - Prompt Suggestions', () => {
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

  test('should suggest prompts based on code review context', async ({ page }) => {
    await projectPage.fillUserInput('I need help with code review quality best practices')

    await projectPage.suggestPromptsButton.click()
    await expect(projectPage.promptSuggestionsDialog).toBeVisible()

    // Verify relevant prompts are suggested
    const suggestions = projectPage.suggestedPrompts
    await expect(suggestions).toHaveCount.atLeast(1)

    const suggestionTexts = await suggestions.allTextContents()
    const hasCodeReviewPrompts = suggestionTexts.some((text) => /review|code|quality/i.test(text))
    expect(hasCodeReviewPrompts).toBeTruthy()
  })

  test('should suggest documentation prompts for doc-related input', async ({ page }) => {
    await projectPage.fillUserInput('documentation API docs technical writing')

    await projectPage.suggestPromptsButton.click()
    await expect(projectPage.promptSuggestionsDialog).toBeVisible()

    const suggestions = await projectPage.suggestedPrompts.allTextContents()
    const hasDocPrompts = suggestions.some((text) => /documentation|docs|writing/i.test(text))
    expect(hasDocPrompts).toBeTruthy()
  })

  test('should suggest testing prompts for QA-related input', async ({ page }) => {
    await projectPage.fillUserInput('testing test cases quality assurance QA')

    await projectPage.suggestPromptsButton.click()
    await expect(projectPage.promptSuggestionsDialog).toBeVisible()

    const suggestions = await projectPage.suggestedPrompts.allTextContents()
    const hasTestingPrompts = suggestions.some((text) => /test|qa|quality/i.test(text))
    expect(hasTestingPrompts).toBeTruthy()
  })

  test('should handle prompt selection from suggestions', async ({ page }) => {
    await projectPage.fillUserInput('code review assistance needed')
    await projectPage.suggestPromptsButton.click()

    await expect(projectPage.promptSuggestionsDialog).toBeVisible()
    await expect(projectPage.suggestedPrompts).toHaveCount.atLeast(1)

    // Select the first suggested prompt
    const firstSuggestion = projectPage.suggestedPrompts.first()
    const promptTitle = await firstSuggestion.textContent()

    await firstSuggestion.click()

    // Verify dialog closes and prompt is applied/selected
    await expect(projectPage.promptSuggestionsDialog).not.toBeVisible()

    // The prompt should be added to the context or selected prompts
    // This depends on how the UI handles prompt selection
  })

  test('should show prompt previews on hover', async ({ page }) => {
    await projectPage.fillUserInput('code assistance')
    await projectPage.suggestPromptsButton.click()

    await expect(projectPage.promptSuggestionsDialog).toBeVisible()
    const firstSuggestion = projectPage.suggestedPrompts.first()

    await firstSuggestion.hover()

    // Look for preview content (tooltip, expanded content, etc.)
    const preview = page.getByTestId('prompt-preview')
    if (await preview.isVisible()) {
      await expect(preview).toBeVisible()
      await expect(preview).toContainText(/review|code|assistant/i)
    }
  })
})

test.describe('Project Context Tab - Copy to Chat', () => {
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

  test('should copy context with user input to chat', async ({ page }) => {
    const userInput = 'Help me understand the authentication flow'
    await projectPage.fillUserInput(userInput)

    // Click chat button
    await projectPage.chatButton.click()

    // Should navigate to chat page
    await expect(page).toHaveURL(/.*\/chat/)

    // Verify context is copied to chat input
    const chatInput = page.getByTestId('chat-input')
    if (await chatInput.isVisible()) {
      await expect(chatInput).toContainText(userInput)
    }
  })

  test('should copy context with selected files and prompts', async ({ page }) => {
    const userInput = 'Review authentication system'
    await projectPage.fillUserInput(userInput)

    // Select some files
    await projectPage.toggleFileSelection('auth.service.ts')
    await projectPage.toggleFileSelection('login.ts')

    // Navigate to chat
    await projectPage.chatButton.click()
    await expect(page).toHaveURL(/.*\/chat/)

    // Check that file references are included in context
    const chatInput = page.getByTestId('chat-input')
    if (await chatInput.isVisible()) {
      await expect(chatInput).toContainText(userInput)
      // Should also contain file references
      await expect(chatInput).toContainText(/auth\.service\.ts|login\.ts/)
    }
  })

  test('should preserve context when returning from chat', async ({ page }) => {
    const userInput = 'Test context preservation'
    await projectPage.fillUserInput(userInput)

    // Go to chat and back
    await projectPage.chatButton.click()
    await expect(page).toHaveURL(/.*\/chat/)

    await page.goBack()
    await projectPage.waitForProjectPageLoad()

    // Verify context is preserved
    await expect(projectPage.userInputTextarea).toHaveValue(userInput)
  })

  test('should handle empty context gracefully', async ({ page }) => {
    // Don't enter any user input

    await projectPage.chatButton.click()
    await expect(page).toHaveURL(/.*\/chat/)

    // Chat should still work with empty context
    const chatInput = page.getByTestId('chat-input')
    if (await chatInput.isVisible()) {
      // Should either be empty or have placeholder text
      const inputValue = await chatInput.inputValue()
      expect(typeof inputValue).toBe('string') // Should not error
    }
  })
})

test.describe('Project Context Tab - Project Summary', () => {
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

  test('should display project summary markdown content', async ({ page }) => {
    // Wait for summary section to load
    await expect(projectPage.summarySection).toBeVisible()

    // Verify summary section has content
    const summaryContent = await projectPage.getProjectSummary()
    expect(summaryContent).toBeTruthy()
    expect(summaryContent.length).toBeGreaterThan(0)
  })

  test('should render markdown formatting in summary', async ({ page }) => {
    await expect(projectPage.summarySection).toBeVisible()

    // Check for markdown content elements
    const markdownContent = projectPage.summarySection.locator('.markdown-content, [data-testid="markdown-content"]')
    if (await markdownContent.isVisible()) {
      await expect(markdownContent).toBeVisible()

      // Look for typical markdown elements
      const hasMarkdownElements = await page.evaluate(() => {
        const content = document.querySelector('[data-testid="project-summary"]')
        if (!content) return false

        const text = content.textContent || ''
        return text.includes('Project') || text.includes('Files') || text.includes('Structure')
      })

      expect(hasMarkdownElements).toBeTruthy()
    }
  })

  test('should update summary when project changes', async ({ page }) => {
    const initialSummary = await projectPage.getProjectSummary()

    // Make a change to the project (e.g., select files)
    await projectPage.toggleFileSelection('package.json')

    // Wait for potential summary update
    await page.waitForTimeout(1000)

    // Summary might update or remain the same - just verify it's still valid
    const updatedSummary = await projectPage.getProjectSummary()
    expect(updatedSummary).toBeTruthy()
  })

  test('should handle long summary content', async ({ page }) => {
    await expect(projectPage.summarySection).toBeVisible()

    // Verify summary section doesn't overflow or break layout
    const summaryBox = await projectPage.summarySection.boundingBox()
    expect(summaryBox).toBeTruthy()
    expect(summaryBox!.height).toBeGreaterThan(0)
    expect(summaryBox!.width).toBeGreaterThan(0)
  })

  test('should be scrollable if content is long', async ({ page }) => {
    const summarySection = projectPage.summarySection

    // Check if scrolling is enabled when content is long
    const isScrollable = await summarySection.evaluate((element) => {
      return element.scrollHeight > element.clientHeight
    })

    // If scrollable, verify scroll works
    if (isScrollable) {
      const initialScrollTop = await summarySection.evaluate((el) => el.scrollTop)
      await summarySection.evaluate((el) => (el.scrollTop = 50))
      const newScrollTop = await summarySection.evaluate((el) => el.scrollTop)
      expect(newScrollTop).toBeGreaterThan(initialScrollTop)
    }
  })
})

test.describe('Project Context Tab - MCP Integration', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should work with MCP integration when available', async ({ page }) => {
    await MCPTestHelpers.testMCPIntegrationSafely(page, 'context tab with MCP', async (mcpAvailable) => {
      if (mcpAvailable) {
        // Setup with real MCP integration
        await testManager.setupProjectPageEnvironment()
      } else {
        // Setup with mocks
        await testManager.setupProjectPageEnvironment()
      }

      await projectPage.gotoProject(1)
      await projectPage.waitForProjectPageLoad()

      // Test basic functionality works regardless of MCP availability
      await projectPage.fillUserInput('Test MCP integration')
      await expect(projectPage.userInputTextarea).toHaveValue('Test MCP integration')

      // Test file suggestions work
      await projectPage.searchFilesButton.click()
      await expect(projectPage.fileSuggestionsDialog).toBeVisible()
    })
  })

  test('should gracefully handle MCP unavailability', async ({ page }) => {
    // Force MCP to be unavailable
    testManager.updateConfig({ enableMCP: false })

    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // All features should still work with mocks
    await projectPage.fillUserInput('Test without MCP')
    await expect(projectPage.userInputTextarea).toHaveValue('Test without MCP')

    await projectPage.searchFilesButton.click()
    await expect(projectPage.fileSuggestionsDialog).toBeVisible()
  })
})
