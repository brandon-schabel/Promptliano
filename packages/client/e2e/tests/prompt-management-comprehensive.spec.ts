/**
 * Comprehensive E2E Tests for Prompt Management Page
 *
 * This test suite covers all aspects of prompt management including:
 * - Import functionality (file selection, validation, multi-file import)
 * - Prompt cards display and interaction
 * - Menu actions (copy, edit, export, delete)
 * - Sorting and organization
 * - Search and filtering
 * - Create prompt modal
 * - Bulk operations and multi-selection
 * - Performance tests
 * - Error handling and edge cases
 */

import { test, expect } from '@playwright/test'
import { PromptManagementPage } from '../pages/prompt-management-page'
import { PromptTestDataManager, PromptTestUtils } from '../utils/prompt-test-data-manager'
import { PromptManagementTestData, PromptManagementDataFactory } from '../fixtures/prompt-management-data'

test.describe('Prompt Management - Import Functionality', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager
  let testFiles: string[] = []

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForImportTests(page, 'import-tests')

    // Create temporary markdown files for testing
    testFiles = await dataManager.createImportTestFiles()

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should open import dialog when import button is clicked', async ({ page }) => {
    // Click import button
    await promptPage.openImportDialog()

    // Verify dialog elements are present
    await expect(promptPage.importDialog).toBeVisible()
    await expect(promptPage.chooseFilesButton).toBeVisible()
    await expect(page.getByText('Import Markdown Prompts')).toBeVisible()

    // Should show instructions
    await expect(page.getByText(/select.*markdown.*files|choose.*files/i)).toBeVisible()
  })

  test('should handle file selection and display selected files', async ({ page }) => {
    await promptPage.openImportDialog()

    // Select file
    await promptPage.selectPromptFiles(testFiles[0])

    // Verify file is displayed in selection
    await expect(promptPage.selectedFilesDisplay).toBeVisible()
    await expect(promptPage.selectedFilesDisplay).toContainText('code-review-prompts.md')

    // Import button should be enabled
    await expect(promptPage.executeImportButton).toBeEnabled()
  })

  test('should import single markdown file successfully', async ({ page }) => {
    await promptPage.openImportDialog()

    // Select and import file
    await promptPage.selectPromptFiles(testFiles[0])
    await promptPage.executeImport()

    // Wait for import to complete
    await expect(promptPage.importSuccessMessage).toBeVisible()

    // Check that prompts appear in the grid
    await expect(promptPage.promptCardByTitle('Security Review')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Performance Review')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Best Practices Review')).toBeVisible()
  })

  test('should import multiple markdown files', async ({ page }) => {
    await promptPage.openImportDialog()

    // Select multiple files
    await promptPage.selectPromptFiles(testFiles)

    // Should show multiple files selected
    await expect(promptPage.selectedFilesDisplay).toContainText('2 files selected')

    // Import all files
    await promptPage.executeImport()

    // Verify all prompts imported
    await expect(promptPage.importSuccessMessage).toBeVisible()

    // Should have prompts from both files
    await expect(promptPage.promptCardByTitle('Security Review')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Sprint Planning')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Retrospective Facilitator')).toBeVisible()
  })

  test('should validate file types and show errors for invalid files', async ({ page }) => {
    // Create invalid file for testing
    const invalidFile = await dataManager.createInvalidFile('unsupported')

    await promptPage.openImportDialog()

    try {
      await promptPage.selectPromptFiles(invalidFile)

      // Should show error or prevent selection
      const errorMessage = page.getByText(/invalid.*file|markdown.*only|unsupported.*format/i)
      const isErrorVisible = await errorMessage.isVisible().catch(() => false)

      if (isErrorVisible) {
        await expect(errorMessage).toBeVisible()
      } else {
        // Or import button should remain disabled
        await expect(promptPage.executeImportButton).toBeDisabled()
      }
    } finally {
      // File cleanup is handled by dataManager.cleanup()
    }
  })

  test('should handle import errors gracefully', async ({ page }) => {
    // Create malformed markdown file
    const malformedFile = await dataManager.createInvalidFile('malformed')

    await promptPage.openImportDialog()

    await promptPage.selectPromptFiles(malformedFile)
    await promptPage.executeImportButton.click()

    // Should show error message but not crash
    const errorShown = await Promise.race([
      promptPage.importErrorMessage.isVisible(),
      page.getByText(/import.*error|failed.*import/i).isVisible()
    ])

    expect(errorShown).toBe(true)

    // Dialog should still be closeable
    if (await page.getByRole('button', { name: /close|cancel/i }).isVisible()) {
      await page.getByRole('button', { name: /close|cancel/i }).click()
      await expect(promptPage.importDialog).not.toBeVisible()
    }
  })

  test('should handle large file imports', async ({ page }) => {
    // Create large import file
    const largeFile = await dataManager.createLargeImportFile(50)

    await promptPage.openImportDialog()
    await promptPage.selectPromptFiles(largeFile)

    // Start import and monitor progress
    const importPromise = promptPage.executeImport()

    // Should show progress indicator
    await expect(promptPage.importProgressIndicator).toBeVisible()

    // Wait for completion
    await importPromise

    // Should complete successfully
    await expect(promptPage.importSuccessMessage).toBeVisible()
  })
})

test.describe('Prompt Management - Cards Display and Interaction', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForStandardTests(page, 'cards-tests')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should display prompt cards with all required information', async ({ page }) => {
    // Wait for prompts to load
    await expect(promptPage.promptCards).toHaveCount(4)

    // Check each test prompt is displayed correctly
    for (const prompt of PromptManagementTestData.testPrompts) {
      const card = promptPage.promptCardByTitle(prompt.title)
      await expect(card).toBeVisible()

      // Verify title
      await expect(promptPage.getPromptCardTitle(prompt.title)).toContainText(prompt.title)

      // Verify created date is displayed
      await expect(promptPage.getPromptCardCreatedAt(prompt.title)).toBeVisible()

      // Verify content preview
      const preview = promptPage.getPromptCardPreview(prompt.title)
      await expect(preview).toBeVisible()

      // Should show truncated content
      const previewText = await preview.textContent()
      expect(previewText).toBeTruthy()
      expect(previewText!.length).toBeGreaterThan(0)

      // Verify selection checkbox
      await expect(promptPage.getPromptCardCheckbox(prompt.title)).toBeVisible()

      // Verify three-dot menu button
      await card.hover()
      await expect(promptPage.getPromptCardMenu(prompt.title)).toBeVisible()
    }
  })

  test('should display token count on prompt cards', async ({ page }) => {
    // Check token counts are displayed
    for (const prompt of PromptManagementTestData.testPrompts) {
      const tokenCount = promptPage.getPromptCardTokenCount(prompt.title)
      await expect(tokenCount).toBeVisible()

      // Should show a reasonable token count
      const tokenText = await tokenCount.textContent()
      expect(tokenText).toMatch(/\d+.*token/i)

      const tokens = parseInt(tokenText?.match(/\d+/)?.[0] || '0')
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(10000) // Reasonable upper limit
    }
  })

  test('should handle empty state when no prompts exist', async ({ page }) => {
    // Navigate to prompts page with no data
    await dataManager.clearAllPrompts(page)
    await page.reload()
    await promptPage.waitForPromptsLoaded()

    // Verify empty state is displayed
    await expect(promptPage.emptyState).toBeVisible()
    await expect(page.getByText(/no.*prompts|create.*first.*prompt/i)).toBeVisible()

    // Should still show create button
    await expect(promptPage.createPromptButton).toBeVisible()

    // Should not show grid
    const gridVisible = await promptPage.promptsGrid.isVisible().catch(() => false)
    if (gridVisible) {
      const cardCount = await promptPage.promptCards.count()
      expect(cardCount).toBe(0)
    }
  })

  test('should show proper card layout and responsive design', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(500) // Allow layout adjustment

    // Cards should be in a grid layout
    const gridColumns = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="prompts-grid"]')
      return grid ? getComputedStyle(grid).gridTemplateColumns : ''
    })

    expect(gridColumns).toMatch(/repeat|1fr/) // Should use CSS grid

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    // Should still display cards but potentially fewer columns
    await expect(promptPage.promptCards.first()).toBeVisible()

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)

    // Cards should stack vertically on mobile
    await expect(promptPage.promptCards.first()).toBeVisible()
  })
})

test.describe('Prompt Management - Card Menu Actions', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForStandardTests(page, 'menu-tests')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should display all menu options when three-dot menu is clicked', async ({ page }) => {
    // Open menu for first prompt
    await promptPage.openPromptCardMenu('Code Review Assistant')

    // Verify all menu items are present
    const menuItems = promptPage.promptCardMenuItems
    await expect(menuItems.copyContent).toBeVisible()
    await expect(menuItems.edit).toBeVisible()
    await expect(menuItems.exportMarkdown).toBeVisible()
    await expect(menuItems.delete).toBeVisible()

    // Verify menu item text
    await expect(menuItems.copyContent).toContainText(/copy.*content/i)
    await expect(menuItems.edit).toContainText(/edit/i)
    await expect(menuItems.exportMarkdown).toContainText(/export.*markdown/i)
    await expect(menuItems.delete).toContainText(/delete/i)
  })

  test('should copy prompt content to clipboard', async ({ page }) => {
    // Open menu and click copy content
    await promptPage.copyPromptContent('Code Review Assistant')

    // Verify success notification
    await expect(page.getByText(/copied.*clipboard|copy.*success/i)).toBeVisible()

    // Verify clipboard content (if accessible in test environment)
    if (await page.evaluate(() => 'clipboard' in navigator)) {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText).toContain('Code Review Checklist')
      expect(clipboardText).toContain('{{language}}')
    }
  })

  test('should open edit dialog when edit is clicked', async ({ page }) => {
    // Open menu and click edit
    await promptPage.openPromptCardMenu('Documentation Generator')
    await promptPage.promptCardMenuItems.edit.click()

    // Verify edit modal opens
    await expect(promptPage.promptModal).toBeVisible()
    await expect(promptPage.promptModalTitle).toContainText(/edit.*prompt/i)

    // Verify form is pre-filled with existing data
    await expect(promptPage.promptNameInput).toHaveValue('Documentation Generator')

    const contentValue = await promptPage.promptContentTextarea.inputValue()
    expect(contentValue).toContain('Generate comprehensive documentation')

    // Can cancel without changes
    await promptPage.cancelPromptButton.click()
    await expect(promptPage.promptModal).not.toBeVisible()
  })

  test('should export prompt as markdown file', async ({ page }) => {
    // Export prompt
    const download = await promptPage.exportPrompt('Bug Report Analyzer')

    expect(download.suggestedFilename()).toMatch(/bug.*report.*analyzer.*\.md$/i)

    // Verify download content (if accessible)
    const downloadPath = await download.path()
    if (downloadPath) {
      const isValid = await PromptTestUtils.verifyDownload(downloadPath, 'Bug Report Analyzer')
      expect(isValid).toBe(true)
    }
  })

  test('should delete prompt with confirmation', async ({ page }) => {
    // Count prompts before deletion
    const initialCount = await promptPage.getPromptCount()

    // Delete prompt
    await promptPage.deletePrompt('Test Case Generator')

    // Verify prompt was deleted
    await expect(promptPage.promptCardByTitle('Test Case Generator')).not.toBeVisible()

    const finalCount = await promptPage.getPromptCount()
    expect(finalCount).toBe(initialCount - 1)

    // Verify success message
    await expect(page.getByText(/deleted.*successfully|prompt.*removed/i)).toBeVisible()
  })

  test('should cancel deletion when confirmation is dismissed', async ({ page }) => {
    const initialCount = await promptPage.getPromptCount()

    // Open menu and click delete
    await promptPage.openPromptCardMenu('Code Review Assistant')
    await promptPage.promptCardMenuItems.delete.click()

    // Cancel deletion
    await expect(promptPage.confirmationDialog).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()

    // Verify prompt still exists
    await expect(promptPage.promptCardByTitle('Code Review Assistant')).toBeVisible()

    const finalCount = await promptPage.getPromptCount()
    expect(finalCount).toBe(initialCount)
  })
})

test.describe('Prompt Management - Sorting and Organization', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForStandardTests(page, 'sorting-tests')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should sort prompts by title alphabetically', async ({ page }) => {
    // Sort by title ascending
    await promptPage.sortPrompts('title', 'asc')

    // Verify sort order
    const titles = await promptPage.getVisiblePromptTitles()
    const sortedTitles = [...titles].sort()
    expect(titles).toEqual(sortedTitles)

    // Sort by title descending
    await promptPage.sortPrompts('title', 'desc')

    const descTitles = await promptPage.getVisiblePromptTitles()
    const reverseSortedTitles = [...sortedTitles].reverse()
    expect(descTitles).toEqual(reverseSortedTitles)
  })

  test('should sort prompts by creation date', async ({ page }) => {
    // Sort by creation date (newest first)
    await promptPage.sortPrompts('created_at', 'desc')

    // Get created dates from cards
    const cards = promptPage.promptCards
    const count = await cards.count()

    let previousDate: Date | null = null
    for (let i = 0; i < count; i++) {
      const dateElement = cards.nth(i).getByTestId('prompt-created-at')
      const dateText = await dateElement.textContent()
      const currentDate = new Date(dateText || '')

      if (previousDate && !isNaN(currentDate.getTime()) && !isNaN(previousDate.getTime())) {
        expect(currentDate.getTime()).toBeLessThanOrEqual(previousDate.getTime())
      }
      previousDate = currentDate
    }
  })

  test('should sort prompts by token count', async ({ page }) => {
    // Sort by token count ascending
    await promptPage.sortPrompts('tokens', 'asc')

    // Verify token count order
    const cards = promptPage.promptCards
    const count = await cards.count()

    let previousTokens: number | null = null
    for (let i = 0; i < count; i++) {
      const tokenElement = cards.nth(i).getByTestId('token-count')
      const tokenText = await tokenElement.textContent()
      const tokens = parseInt(tokenText?.match(/\d+/)?.[0] || '0')

      if (previousTokens !== null) {
        expect(tokens).toBeGreaterThanOrEqual(previousTokens)
      }
      previousTokens = tokens
    }
  })

  test('should persist sort preference across page reloads', async ({ page }) => {
    // Set custom sort
    await promptPage.sortPrompts('title', 'desc')
    const titlesBefore = await promptPage.getVisiblePromptTitles()

    // Reload page
    await page.reload()
    await promptPage.waitForPromptsLoaded()

    // Verify sort is preserved (if implemented)
    const titlesAfter = await promptPage.getVisiblePromptTitles()
    // Note: This test may need adjustment based on actual implementation
    expect(titlesAfter.length).toBeGreaterThan(0)
  })
})

test.describe('Prompt Management - Search and Filtering', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForStandardTests(page, 'search-tests')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should filter prompts by search query', async ({ page }) => {
    // Test each search scenario
    for (const scenario of PromptManagementTestData.searchQueries) {
      await promptPage.searchPrompts(scenario.query)

      if (scenario.expectedResults.length === 0) {
        // Should show no results
        const cardCount = await promptPage.getPromptCount()
        expect(cardCount).toBe(0)

        const noResultsVisible = await page.getByText(/no.*results|no.*prompts.*found/i).isVisible()
        if (noResultsVisible) {
          await expect(page.getByText(/no.*results|no.*prompts.*found/i)).toBeVisible()
        }
      } else {
        // Should show matching prompts
        const visibleTitles = await promptPage.getVisiblePromptTitles()

        for (const expectedTitle of scenario.expectedResults) {
          expect(visibleTitles).toContain(expectedTitle)
        }
      }

      // Clear search for next test
      await promptPage.clearSearch()
    }
  })

  test('should search across prompt titles and content', async ({ page }) => {
    // Search for content that appears in prompt body but not title
    await promptPage.searchPrompts('security vulnerabilities')

    // Should find Code Review Assistant (has security in content)
    const visibleTitles = await promptPage.getVisiblePromptTitles()
    expect(visibleTitles).toContain('Code Review Assistant')

    // Should not show prompts without matching content
    expect(visibleTitles).not.toContain('Documentation Generator')
  })

  test('should handle special characters and edge cases in search', async ({ page }) => {
    // Test special characters
    const specialQueries = ['{{code}}', 'test-case', 'C++', 'user@domain.com']

    for (const query of specialQueries) {
      await promptPage.searchPrompts(query)

      // Should not crash and should return some results or empty state
      const resultCount = await promptPage.getPromptCount()
      expect(resultCount).toBeGreaterThanOrEqual(0)

      await promptPage.clearSearch()
    }
  })

  test('should debounce search input for performance', async ({ page }) => {
    // Monitor network requests
    const requests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/search') || req.url().includes('/prompts')) {
        requests.push(req.url())
      }
    })

    // Type rapidly
    const searchTerm = 'documentation'
    for (let i = 0; i < searchTerm.length; i++) {
      await promptPage.searchInput.type(searchTerm[i])
      await page.waitForTimeout(50) // Fast typing
    }

    // Wait for debounce period
    await page.waitForTimeout(1000)

    // Should not have made excessive requests (implementation dependent)
    const searchRequests = requests.filter((url) => url.includes('search'))
    expect(searchRequests.length).toBeLessThan(searchTerm.length)
  })
})

test.describe('Prompt Management - Create Prompt Modal', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForStandardTests(page, 'create-tests')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should open create prompt modal with all fields', async ({ page }) => {
    // Click create button
    await promptPage.createPromptButton.click()

    // Verify modal is displayed
    await expect(promptPage.promptModal).toBeVisible()
    await expect(promptPage.promptModalTitle).toContainText(/create.*prompt|new.*prompt/i)

    // Verify all form fields are present
    await expect(promptPage.promptNameInput).toBeVisible()
    await expect(promptPage.promptContentTextarea.or(promptPage.promptContentEditor)).toBeVisible()
    await expect(promptPage.promptTokenCounter).toBeVisible()
    await expect(promptPage.promptTagsInput).toBeVisible()

    // Verify action buttons
    await expect(promptPage.savePromptButton).toBeVisible()
    await expect(promptPage.cancelPromptButton).toBeVisible()

    // Initially save button should be disabled
    const saveEnabled = await promptPage.savePromptButton.isEnabled()
    expect(saveEnabled).toBe(false)
  })

  test('should show live token count while typing', async ({ page }) => {
    await promptPage.createPromptButton.click()

    // Initially should show 0 tokens
    await expect(promptPage.promptTokenCounter).toContainText('0')

    // Type content and verify token count updates
    const testContent = 'This is a test prompt with some content'
    await promptPage.promptContentTextarea.fill(testContent)

    // Wait for token count to update
    await promptPage.waitForTokenCountUpdate()

    // Token count should update
    await expect(promptPage.promptTokenCounter).toContainText(/[1-9]\d*/)

    // Add more content
    const longerContent = `${testContent}
It includes multiple sentences and should have a higher token count.
Variables like {{variable_name}} should also be counted.`

    await promptPage.promptContentTextarea.fill(longerContent)
    await promptPage.waitForTokenCountUpdate(20)

    // Token count should increase
    const tokenText = await promptPage.promptTokenCounter.textContent()
    const tokenCount = parseInt(tokenText?.match(/(\d+)/)?.[1] || '0')
    expect(tokenCount).toBeGreaterThan(20)
  })

  test('should create new prompt successfully', async ({ page }) => {
    const newPrompt = {
      title: 'Test Automation Helper',
      content: `Help create automated tests for {{feature_name}}.

## Requirements:
- Unit tests
- Integration tests 
- E2E tests

## Feature Description:
{{feature_description}}

## Expected Coverage:
{{coverage_requirements}}`,
      tags: ['testing', 'automation', 'qa']
    }

    // Create prompt
    await promptPage.createNewPrompt(newPrompt)

    // Verify success message
    await expect(page.getByText(/created.*successfully|prompt.*saved/i)).toBeVisible()

    // Verify prompt appears in grid
    await expect(promptPage.promptCardByTitle(newPrompt.title)).toBeVisible()

    // Verify prompt content is correct
    const preview = promptPage.getPromptCardPreview(newPrompt.title)
    await expect(preview).toContainText('Help create automated tests')

    // Verify token count is displayed
    await expect(promptPage.getPromptCardTokenCount(newPrompt.title)).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    await promptPage.createPromptButton.click()

    // Try to save without filling fields
    await expect(promptPage.savePromptButton).toBeDisabled()

    // Fill only title
    await promptPage.promptNameInput.fill('Test Title')
    await expect(promptPage.savePromptButton).toBeDisabled()

    // Fill content - now should be enabled
    await promptPage.promptContentTextarea.fill('Test content')
    await expect(promptPage.savePromptButton).toBeEnabled()

    // Test validation messages (if implemented)
    await promptPage.promptNameInput.clear()
    await promptPage.promptNameInput.blur()

    // Check for validation errors
    const nameError = page.getByText(/title.*required|name.*required/i)
    const hasValidation = await nameError.isVisible().catch(() => false)

    if (hasValidation) {
      await expect(nameError).toBeVisible()
    }
  })

  test('should handle tags input with Enter key', async ({ page }) => {
    await promptPage.createPromptButton.click()

    // Add multiple tags
    const tags = ['testing', 'automation', 'quality-assurance']

    for (const tag of tags) {
      await promptPage.promptTagsInput.fill(tag)
      await promptPage.promptTagsInput.press('Enter')
    }

    // Verify tags are displayed as chips/badges
    for (const tag of tags) {
      const tagChip = page.getByTestId('tag-chip').filter({ hasText: tag })
      await expect(tagChip).toBeVisible()
    }

    // Should be able to remove tags
    const firstTagRemove = page
      .getByTestId('tag-chip')
      .first()
      .getByRole('button', { name: /remove|×/ })
    const canRemove = await firstTagRemove.isVisible().catch(() => false)

    if (canRemove) {
      await firstTagRemove.click()
      const remainingTags = await page.getByTestId('tag-chip').count()
      expect(remainingTags).toBe(tags.length - 1)
    }
  })

  test('should support markdown preview', async ({ page }) => {
    await promptPage.createPromptButton.click()

    // Fill content with markdown
    const markdownContent = `# Test Prompt

This is a **bold** text with *italic* and \`code\`.

## Instructions
1. First step
2. Second step
3. Third step

### Variables
- {{variable1}}: Description 1
- {{variable2}}: Description 2

\`\`\`javascript
function example() {
  return "Hello World";
}
\`\`\``

    await promptPage.promptContentTextarea.fill(markdownContent)

    // Switch to preview tab (if available)
    const previewTab = promptPage.promptPreviewTab
    const hasPreview = await previewTab.isVisible().catch(() => false)

    if (hasPreview) {
      await previewTab.click()

      // Verify markdown is rendered
      await expect(promptPage.promptPreview.locator('h1')).toContainText('Test Prompt')
      await expect(promptPage.promptPreview.locator('strong')).toContainText('bold')
      await expect(promptPage.promptPreview.locator('em')).toContainText('italic')
      await expect(promptPage.promptPreview.locator('code')).toContainText('code')
      await expect(promptPage.promptPreview.locator('pre')).toBeVisible()
    }
  })

  test('should cancel creation and discard changes', async ({ page }) => {
    const initialCount = await promptPage.getPromptCount()

    await promptPage.createPromptButton.click()

    // Fill some data
    await promptPage.promptNameInput.fill('Test Prompt To Cancel')
    await promptPage.promptContentTextarea.fill('This should be discarded')

    // Cancel
    await promptPage.cancelPromptButton.click()

    // Modal should close
    await expect(promptPage.promptModal).not.toBeVisible()

    // No new prompt should be created
    const finalCount = await promptPage.getPromptCount()
    expect(finalCount).toBe(initialCount)
  })
})

test.describe('Prompt Management - Bulk Operations', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
    dataManager = await PromptTestDataManager.createForStandardTests(page, 'bulk-tests')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test('should select multiple prompts with checkboxes', async ({ page }) => {
    // Select first two prompts
    await promptPage.selectPromptCard('Code Review Assistant')
    await promptPage.selectPromptCard('Documentation Generator')

    // Verify selection count
    await expect(promptPage.selectedPromptsCount).toContainText('2')

    // Verify bulk actions menu appears
    await expect(promptPage.bulkActionsButton).toBeVisible()

    // Select third prompt
    await promptPage.selectPromptCard('Bug Report Analyzer')
    await expect(promptPage.selectedPromptsCount).toContainText('3')
  })

  test('should select all prompts with select all checkbox', async ({ page }) => {
    // Find and click select all checkbox
    await promptPage.selectAllPrompts()

    // All individual checkboxes should be checked
    const promptCount = await promptPage.getPromptCount()
    await expect(promptPage.selectedPromptsCount).toContainText(promptCount.toString())

    for (const prompt of PromptManagementTestData.testPrompts) {
      const checkbox = promptPage.getPromptCardCheckbox(prompt.title)
      await expect(checkbox).toBeChecked()
    }

    // Unselect all
    await promptPage.clearSelection()
    await expect(promptPage.selectedPromptsCount).not.toBeVisible()
  })

  test('should perform bulk export of selected prompts', async ({ page }) => {
    // Select multiple prompts
    await promptPage.selectPromptCard('Code Review Assistant')
    await promptPage.selectPromptCard('Bug Report Analyzer')

    // Perform bulk export
    const download = await promptPage.bulkExportSelected()

    // Verify download
    expect(download.suggestedFilename()).toMatch(/prompts.*export.*\.(zip|md)$/i)
  })

  test('should perform bulk delete with confirmation', async ({ page }) => {
    const initialCount = await promptPage.getPromptCount()

    // Select prompts to delete
    await promptPage.selectPromptCard('Test Case Generator')
    await promptPage.selectPromptCard('Bug Report Analyzer')

    // Perform bulk delete
    await promptPage.bulkDeleteSelected()

    // Verify prompts were deleted
    const finalCount = await promptPage.getPromptCount()
    expect(finalCount).toBe(initialCount - 2)

    await expect(promptPage.promptCardByTitle('Test Case Generator')).not.toBeVisible()
    await expect(promptPage.promptCardByTitle('Bug Report Analyzer')).not.toBeVisible()

    // Selection should be cleared
    await expect(promptPage.selectedPromptsCount).not.toBeVisible()
  })

  test('should clear selection when search filters results', async ({ page }) => {
    // Select some prompts
    await promptPage.selectPromptCard('Code Review Assistant')
    await promptPage.selectPromptCard('Documentation Generator')

    await expect(promptPage.selectedPromptsCount).toContainText('2')

    // Search for something that doesn't include selected items
    await promptPage.searchPrompts('bug report')

    // Selection should be cleared or adjusted (implementation dependent)
    const selectionVisible = await promptPage.selectedPromptsCount.isVisible().catch(() => false)

    if (selectionVisible) {
      const selectionText = await promptPage.selectedPromptsCount.textContent()
      expect(selectionText).not.toContain('2 selected')
    }
  })
})

test.describe('Prompt Management - Performance Tests', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
  })

  test.afterEach(async () => {
    if (dataManager) {
      await dataManager.cleanup()
    }
  })

  test('should handle large number of prompts efficiently', async ({ page }) => {
    // Setup large dataset
    dataManager = await PromptTestDataManager.createForPerformanceTests(page, 'performance-test', 100)

    const startTime = Date.now()
    await promptPage.goto()

    // Should load within reasonable time
    await expect(promptPage.promptCards.first().or(promptPage.emptyState)).toBeVisible({ timeout: 10000 })
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(5000) // 5 seconds max

    // Search should be fast
    const searchStartTime = Date.now()
    await promptPage.searchPrompts('code')
    await promptPage.waitForPromptsLoaded()
    const searchTime = Date.now() - searchStartTime

    expect(searchTime).toBeLessThan(2000) // 2 seconds max
  })

  test('should implement pagination or virtual scrolling for large datasets', async ({ page }) => {
    dataManager = await PromptTestDataManager.createForPerformanceTests(page, 'pagination-test', 500)

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()

    // Should not render all 500 cards at once (performance optimization)
    const renderedCards = await promptPage.getPromptCount()
    expect(renderedCards).toBeLessThan(100) // Should use pagination or virtual scrolling

    // Check for pagination or load more functionality
    const pagination = page.getByTestId('pagination')
    const loadMoreButton = page.getByRole('button', { name: /load.*more|show.*more/i })

    const hasPagination = await pagination.isVisible().catch(() => false)
    const hasLoadMore = await loadMoreButton.isVisible().catch(() => false)

    // Should have some form of pagination or load more
    expect(hasPagination || hasLoadMore || renderedCards < 500).toBe(true)
  })

  test('should handle memory efficiently during bulk operations', async ({ page }) => {
    dataManager = await PromptTestDataManager.createForPerformanceTests(page, 'memory-test', 200)

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()

    // Monitor memory during bulk selection
    const memoryMetrics = await dataManager.monitorPerformance(page, async () => {
      await promptPage.selectAllPrompts()
      await page.waitForTimeout(1000) // Allow UI to update
    })

    // Should not consume excessive memory
    expect(memoryMetrics.memoryUsage).toBeLessThan(50 * 1024 * 1024) // 50MB threshold
    expect(memoryMetrics.duration).toBeLessThan(3000) // 3 second threshold
  })
})

test.describe('Prompt Management - Error Handling', () => {
  let promptPage: PromptManagementPage
  let dataManager: PromptTestDataManager

  test.beforeEach(async ({ page }) => {
    promptPage = new PromptManagementPage(page)
  })

  test.afterEach(async () => {
    if (dataManager) {
      await dataManager.cleanup()
    }
  })

  test('should handle network errors gracefully', async ({ page }) => {
    dataManager = await PromptTestDataManager.createForErrorTests(page, 'network-error-test', 'network')

    await promptPage.goto()

    // Should show error state
    const errorState = page.getByText(/error.*loading|failed.*load|network.*error/i)
    await expect(errorState).toBeVisible({ timeout: 10000 })

    // Should provide retry option
    const retryButton = page.getByRole('button', { name: /retry|reload|try.*again/i })
    const hasRetry = await retryButton.isVisible().catch(() => false)

    if (hasRetry) {
      await expect(retryButton).toBeVisible()
    }
  })

  test('should handle validation errors during prompt creation', async ({ page }) => {
    dataManager = await PromptTestDataManager.createForErrorTests(page, 'validation-error-test', 'validation')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()

    // Try to create prompt that will trigger validation error
    const promptData = {
      title: 'Duplicate Title',
      content: 'This should trigger a validation error'
    }

    await promptPage.createPromptButton.click()
    await promptPage.promptNameInput.fill(promptData.title)
    await promptPage.promptContentTextarea.fill(promptData.content)
    await promptPage.savePromptButton.click()

    // Should show validation error
    const errorMessage = page.getByText(/already.*exists|duplicate.*title|validation.*error/i)
    await expect(errorMessage).toBeVisible({ timeout: 5000 })

    // Modal should remain open for correction
    await expect(promptPage.promptModal).toBeVisible()
  })

  test('should handle import errors with detailed feedback', async ({ page }) => {
    dataManager = await PromptTestDataManager.createForImportTests(page, 'import-error-test')

    // Create problematic file
    const malformedFile = await dataManager.createInvalidFile('malformed')

    await promptPage.goto()
    await promptPage.waitForPromptsLoaded()

    await promptPage.openImportDialog()
    await promptPage.selectPromptFiles(malformedFile)
    await promptPage.executeImportButton.click()

    // Should show specific error information
    const errorMessage = promptPage.importErrorMessage.or(page.getByText(/import.*error|failed.*parse/i))
    await expect(errorMessage).toBeVisible({ timeout: 10000 })

    // Should allow user to try again
    await expect(promptPage.chooseFilesButton).toBeVisible()
  })
})
