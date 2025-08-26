# Prompt Management Page Comprehensive Test Plan

## Overview

The Prompt Management Page is the central hub for creating, organizing, and managing AI prompt templates in Promptliano. It provides comprehensive CRUD operations, markdown import/export functionality, categorization, and search capabilities. This test plan covers all prompt management features including import workflows, card interactions, and content organization.

## Test Scope & Requirements

### Major Components

1. **Import Functionality** - Markdown file import with multi-file support
2. **Prompt Cards** - Display, selection, and interaction with prompt templates
3. **Prompt Actions** - Three-dot menu with copy, edit, export, delete operations
4. **Content Management** - Rich text editing, token counting, preview functionality
5. **Organization Features** - Sorting, filtering, search, and categorization
6. **Creation Modal** - New prompt creation with validation and token counting

### Technical Integration Points

- **File System Integration**: Import markdown files from local file system
- **Database Operations**: CRUD operations for prompt storage and retrieval
- **Content Processing**: Markdown parsing, token counting, content validation
- **Search Integration**: Full-text search across prompt titles and content
- **Export Functionality**: Generate markdown files for individual or bulk export

## Test Data Requirements

### Shared Test Data Setup

```typescript
// Location: e2e/fixtures/prompt-management-data.ts
export const PromptManagementTestData = {
  // Sample prompts for testing different scenarios
  testPrompts: [
    {
      title: 'Code Review Assistant',
      content: `# Code Review Checklist

Please review the following {{language}} code for:

## Security Issues
- Input validation
- SQL injection prevention
- XSS vulnerabilities

## Best Practices
- Code organization
- Error handling
- Performance considerations

## Code to Review:
{{code}}

## Additional Context:
{{context}}`,
      tags: ['code-review', 'development', 'quality-assurance'],
      category: 'Development',
      tokenCount: 145
    },
    {
      title: 'Documentation Generator',
      content: `Generate comprehensive documentation for {{feature_name}}.

## Requirements:
- Overview and purpose
- Installation instructions  
- Usage examples
- API reference (if applicable)
- Troubleshooting guide

## Input Details:
{{feature_details}}

## Target Audience:
{{audience_level}}`,
      tags: ['documentation', 'technical-writing'],
      category: 'Documentation',
      tokenCount: 98
    },
    {
      title: 'Bug Report Analyzer',
      content: `Analyze the following bug report and provide:

1. **Root Cause Analysis**
2. **Reproduction Steps**
3. **Potential Solutions**
4. **Prevention Strategies**

## Bug Report:
{{bug_description}}

## Environment Details:
{{environment_info}}

## Steps Already Tried:
{{attempted_solutions}}`,
      tags: ['debugging', 'troubleshooting', 'analysis'],
      category: 'Support',
      tokenCount: 87
    },
    {
      title: 'Test Case Generator',
      content: `Create comprehensive test cases for {{functionality}}.

Include:
- Unit tests
- Integration tests  
- Edge cases
- Error scenarios

## Functionality Description:
{{description}}

## Expected Behavior:
{{expected_output}}`,
      tags: ['testing', 'qa', 'automation'],
      category: 'Testing',
      tokenCount: 76
    }
  ],

  // Sample markdown files for import testing
  importTestFiles: [
    {
      filename: 'code-review-prompts.md',
      content: `# Code Review Prompts

## Security Review
Review this code for security vulnerabilities:
{{code}}

## Performance Review  
Analyze this code for performance issues:
{{code}}

## Best Practices Review
Check if this code follows best practices:
{{code}}`
    },
    {
      filename: 'project-management-prompts.md',
      content: `# Project Management Templates

## Sprint Planning
Plan the next sprint based on:
- Team capacity: {{capacity}}
- Priority items: {{priorities}}
- Dependencies: {{dependencies}}

## Retrospective Facilitator
Facilitate a team retrospective covering:
- What went well: {{successes}}
- What to improve: {{improvements}} 
- Action items: {{actions}}`
    }
  ],

  // Sort and filter test scenarios
  sortingScenarios: [
    {
      field: 'title',
      direction: 'asc',
      expected: ['Bug Report Analyzer', 'Code Review Assistant', 'Documentation Generator']
    },
    {
      field: 'title',
      direction: 'desc',
      expected: ['Test Case Generator', 'Documentation Generator', 'Code Review Assistant']
    },
    { field: 'created_at', direction: 'desc', expected: 'chronological' },
    { field: 'token_count', direction: 'asc', expected: 'ascending by tokens' }
  ],

  // Search test queries
  searchQueries: [
    { query: 'code', expectedResults: ['Code Review Assistant', 'Bug Report Analyzer'] },
    { query: 'documentation', expectedResults: ['Documentation Generator'] },
    { query: 'test', expectedResults: ['Test Case Generator'] },
    { query: 'review analysis', expectedResults: ['Code Review Assistant', 'Bug Report Analyzer'] },
    { query: 'nonexistent', expectedResults: [] }
  ]
}
```

## Page Object Model Extensions

### PromptManagementPage Class Implementation

```typescript
// Location: e2e/pages/prompt-management-page.ts
export class PromptManagementPage extends BasePage {
  // Main page elements
  get pageHeader() {
    return this.page.getByTestId('prompt-management-header')
  }

  get pageTitle() {
    return this.page.getByRole('heading', { name: /prompt.*management|manage.*prompts/i })
  }

  // Import functionality
  get importButton() {
    return this.page.getByTestId('import-prompts-button')
  }

  get importDialog() {
    return this.page.getByTestId('import-prompts-dialog')
  }

  get chooseFilesButton() {
    return this.page.getByTestId('choose-files-button')
  }

  get fileInput() {
    return this.page.locator('input[type="file"]')
  }

  get selectedFilesDisplay() {
    return this.page.getByTestId('selected-files-display')
  }

  get executeImportButton() {
    return this.page.getByRole('button', { name: /import|import selected/i })
  }

  // Prompt cards and grid
  get promptsGrid() {
    return this.page.getByTestId('prompts-grid')
  }

  get promptCards() {
    return this.page.getByTestId('prompt-card')
  }

  get emptyState() {
    return this.page.getByTestId('no-prompts-state')
  }

  promptCardByTitle(title: string) {
    return this.page.getByTestId('prompt-card').filter({ hasText: title })
  }

  // Prompt card elements
  getPromptCardTitle(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-title')
  }

  getPromptCardCreatedAt(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-created-at')
  }

  getPromptCardPreview(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-content-preview')
  }

  getPromptCardCheckbox(title: string) {
    return this.promptCardByTitle(title).getByRole('checkbox')
  }

  getPromptCardMenu(title: string) {
    return this.promptCardByTitle(title).getByTestId('prompt-card-menu')
  }

  getPromptCardTokenCount(title: string) {
    return this.promptCardByTitle(title).getByTestId('token-count')
  }

  // Prompt card menu actions
  get promptCardMenuItems() {
    return {
      copyContent: this.page.getByRole('menuitem', { name: /copy.*content/i }),
      edit: this.page.getByRole('menuitem', { name: /edit/i }),
      exportMarkdown: this.page.getByRole('menuitem', { name: /export.*markdown/i }),
      delete: this.page.getByRole('menuitem', { name: /delete/i })
    }
  }

  // Toolbar and actions
  get toolbar() {
    return this.page.getByTestId('prompts-toolbar')
  }

  get sortButton() {
    return this.page.getByTestId('sort-prompts-button')
  }

  get sortMenu() {
    return this.page.getByTestId('sort-menu')
  }

  get searchInput() {
    return this.page.getByTestId('prompt-search-input')
  }

  get createPromptButton() {
    return this.page.getByTestId('create-prompt-button')
  }

  get selectedPromptsCount() {
    return this.page.getByTestId('selected-prompts-count')
  }

  get bulkActionsMenu() {
    return this.page.getByTestId('bulk-actions-menu')
  }

  // Create/Edit Prompt Modal
  get promptModal() {
    return this.page.getByTestId('prompt-modal')
  }

  get promptNameInput() {
    return this.page.getByTestId('prompt-name-input')
  }

  get promptContentTextarea() {
    return this.page.getByTestId('prompt-content-textarea')
  }

  get promptTokenCounter() {
    return this.page.getByTestId('prompt-token-counter')
  }

  get promptPreview() {
    return this.page.getByTestId('prompt-preview')
  }

  get promptTagsInput() {
    return this.page.getByTestId('prompt-tags-input')
  }

  get promptCategorySelect() {
    return this.page.getByTestId('prompt-category-select')
  }

  get savePromptButton() {
    return this.page.getByRole('button', { name: /save|create/i })
  }

  get cancelPromptButton() {
    return this.page.getByRole('button', { name: /cancel/i })
  }

  // Helper methods
  async openImportDialog() {
    await this.importButton.click()
    await expect(this.importDialog).toBeVisible()
  }

  async selectPromptFile(filePath: string) {
    await this.chooseFilesButton.click()
    await this.fileInput.setInputFiles(filePath)
  }

  async openPromptCardMenu(title: string) {
    await this.promptCardByTitle(title).hover()
    await this.getPromptCardMenu(title).click()
  }

  async createNewPrompt(promptData: { title: string; content: string; tags?: string[] }) {
    await this.createPromptButton.click()
    await expect(this.promptModal).toBeVisible()

    await this.promptNameInput.fill(promptData.title)
    await this.promptContentTextarea.fill(promptData.content)

    if (promptData.tags) {
      for (const tag of promptData.tags) {
        await this.promptTagsInput.fill(tag)
        await this.promptTagsInput.press('Enter')
      }
    }

    await this.savePromptButton.click()
    await expect(this.promptModal).not.toBeVisible()
  }

  async searchPrompts(query: string) {
    await this.searchInput.fill(query)
    // Wait for search results to update
    await this.page.waitForTimeout(500)
  }

  async sortPrompts(field: string, direction: 'asc' | 'desc' = 'asc') {
    await this.sortButton.click()
    await expect(this.sortMenu).toBeVisible()

    await this.page.getByRole('menuitem', { name: new RegExp(field, 'i') }).click()

    if (direction === 'desc') {
      // Click again for descending order
      await this.sortButton.click()
      await this.page.getByRole('menuitem', { name: new RegExp(`${field}.*desc`, 'i') }).click()
    }
  }

  async selectPromptCard(title: string) {
    const checkbox = this.getPromptCardCheckbox(title)
    await checkbox.check()
    await expect(checkbox).toBeChecked()
  }

  async getVisiblePromptTitles(): Promise<string[]> {
    const cards = this.promptCards
    const count = await cards.count()
    const titles: string[] = []

    for (let i = 0; i < count; i++) {
      const titleElement = cards.nth(i).getByTestId('prompt-title')
      const title = await titleElement.textContent()
      if (title) titles.push(title)
    }

    return titles
  }
}
```

## Test Scenarios

### 1. Import Functionality Tests

#### 1.1 Basic Import Operations

```typescript
test.describe('Prompt Import Functionality', () => {
  let testFiles: string[] = []

  test.beforeEach(async ({ page }) => {
    // Create temporary markdown files for testing
    testFiles = await TestDataManager.createTempMarkdownFiles(PromptManagementTestData.importTestFiles)
  })

  test.afterEach(async () => {
    // Clean up temporary files
    await TestDataManager.cleanupTempFiles(testFiles)
  })

  test('should open import dialog when import button is clicked', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
    await promptPage.openImportDialog()

    // Select multiple files
    await promptPage.selectPromptFile(testFiles[0])

    // Verify file is displayed in selection
    await expect(promptPage.selectedFilesDisplay).toBeVisible()
    await expect(promptPage.selectedFilesDisplay).toContainText('code-review-prompts.md')

    // Import button should be enabled
    await expect(promptPage.executeImportButton).toBeEnabled()
  })

  test('should import single markdown file successfully', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
    await promptPage.openImportDialog()

    // Select and import file
    await promptPage.selectPromptFile(testFiles[0])
    await promptPage.executeImportButton.click()

    // Wait for import to complete
    await expect(promptPage.importDialog).not.toBeVisible()

    // Verify prompts were imported
    await expect(page.getByText('Import completed successfully')).toBeVisible()

    // Check that prompts appear in the grid
    await expect(promptPage.promptCardByTitle('Security Review')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Performance Review')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Best Practices Review')).toBeVisible()
  })

  test('should import multiple markdown files', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
    await promptPage.openImportDialog()

    // Select multiple files (if supported)
    await promptPage.fileInput.setInputFiles(testFiles)

    // Should show multiple files selected
    await expect(promptPage.selectedFilesDisplay).toContainText('2 files selected')

    // Import all files
    await promptPage.executeImportButton.click()

    // Verify all prompts imported
    await expect(page.getByText('Import completed successfully')).toBeVisible()

    // Should have prompts from both files
    await expect(promptPage.promptCardByTitle('Security Review')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Sprint Planning')).toBeVisible()
    await expect(promptPage.promptCardByTitle('Retrospective Facilitator')).toBeVisible()
  })

  test('should validate file types and show errors for invalid files', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)

    // Create invalid file for testing
    const invalidFile = await TestDataManager.createTempFile('invalid.txt', 'Not markdown content')

    await promptPage.goto('/prompts')
    await promptPage.openImportDialog()

    try {
      await promptPage.selectPromptFile(invalidFile)

      // Should show error or prevent selection
      const errorMessage = page.getByText(/invalid.*file|markdown.*only|unsupported.*format/i)
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible()
      } else {
        // Or import button should remain disabled
        await expect(promptPage.executeImportButton).toBeDisabled()
      }
    } finally {
      await TestDataManager.cleanupTempFiles([invalidFile])
    }
  })

  test('should handle import errors gracefully', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)

    // Create malformed markdown file
    const malformedFile = await TestDataManager.createTempFile(
      'malformed.md',
      '# Incomplete markdown\n{{invalid_template'
    )

    await promptPage.goto('/prompts')
    await promptPage.openImportDialog()

    try {
      await promptPage.selectPromptFile(malformedFile)
      await promptPage.executeImportButton.click()

      // Should show error message but not crash
      await expect(page.getByText(/import.*error|failed.*import/i)).toBeVisible()

      // Dialog should still be closeable
      await page.getByRole('button', { name: 'Close' }).click()
      await expect(promptPage.importDialog).not.toBeVisible()
    } finally {
      await TestDataManager.cleanupTempFiles([malformedFile])
    }
  })
})
```

#### 1.2 Prompt Cards Display Tests

```typescript
test.describe('Prompt Cards Display and Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test prompts
    await TestDataManager.setupPrompts(page, PromptManagementTestData.testPrompts)
  })

  test('should display prompt cards with all required information', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    const promptPage = new PromptManagementPage(page)

    // Navigate to prompts page with no data
    await TestDataManager.clearAllPrompts(page)
    await promptPage.goto('/prompts')

    // Verify empty state is displayed
    await expect(promptPage.emptyState).toBeVisible()
    await expect(page.getByText(/no.*prompts|create.*first.*prompt/i)).toBeVisible()

    // Should still show create button
    await expect(promptPage.createPromptButton).toBeVisible()

    // Should not show grid
    await expect(promptPage.promptsGrid).not.toBeVisible()
  })

  test('should show proper card layout and responsive design', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
```

#### 1.3 Prompt Card Menu Actions Tests

```typescript
test.describe('Prompt Card Menu Actions', () => {
  test.beforeEach(async ({ page }) => {
    await TestDataManager.setupPrompts(page, PromptManagementTestData.testPrompts)
  })

  test('should display all menu options when three-dot menu is clicked', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Open menu and click copy content
    await promptPage.openPromptCardMenu('Code Review Assistant')
    await promptPage.promptCardMenuItems.copyContent.click()

    // Verify success notification
    await expect(page.getByText('Content copied to clipboard')).toBeVisible()

    // Verify clipboard content (if accessible in test environment)
    if (await page.evaluate(() => 'clipboard' in navigator)) {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText).toContain('Code Review Checklist')
      expect(clipboardText).toContain('{{language}}')
    }
  })

  test('should open edit dialog when edit is clicked', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Open menu and click edit
    await promptPage.openPromptCardMenu('Documentation Generator')
    await promptPage.promptCardMenuItems.edit.click()

    // Verify edit modal opens
    await expect(promptPage.promptModal).toBeVisible()
    await expect(page.getByText('Edit Prompt')).toBeVisible()

    // Verify form is pre-filled with existing data
    await expect(promptPage.promptNameInput).toHaveValue('Documentation Generator')

    const contentValue = await promptPage.promptContentTextarea.inputValue()
    expect(contentValue).toContain('Generate comprehensive documentation')

    // Can cancel without changes
    await promptPage.cancelPromptButton.click()
    await expect(promptPage.promptModal).not.toBeVisible()
  })

  test('should export prompt as markdown file', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Setup download handler
    const downloadPromise = page.waitForEvent('download')

    // Open menu and click export
    await promptPage.openPromptCardMenu('Bug Report Analyzer')
    await promptPage.promptCardMenuItems.exportMarkdown.click()

    // Wait for download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/bug.*report.*analyzer.*\.md$/i)

    // Verify download content (if accessible)
    const downloadPath = await download.path()
    if (downloadPath) {
      const fs = require('fs')
      const content = fs.readFileSync(downloadPath, 'utf8')
      expect(content).toContain('# Bug Report Analyzer')
      expect(content).toContain('Root Cause Analysis')
      expect(content).toContain('{{bug_description}}')
    }
  })

  test('should delete prompt with confirmation', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Count prompts before deletion
    const initialCount = await promptPage.promptCards.count()

    // Open menu and click delete
    await promptPage.openPromptCardMenu('Test Case Generator')
    await promptPage.promptCardMenuItems.delete.click()

    // Should show confirmation dialog
    const confirmDialog = page.getByTestId('confirmation-dialog')
    await expect(confirmDialog).toBeVisible()
    await expect(confirmDialog).toContainText(/delete.*prompt|are.*you.*sure/i)

    // Confirm deletion
    await page.getByRole('button', { name: /delete|confirm/i }).click()

    // Verify prompt was deleted
    await expect(promptPage.promptCardByTitle('Test Case Generator')).not.toBeVisible()
    await expect(promptPage.promptCards).toHaveCount(initialCount - 1)

    // Verify success message
    await expect(page.getByText('Prompt deleted successfully')).toBeVisible()
  })

  test('should cancel deletion when confirmation is dismissed', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    const initialCount = await promptPage.promptCards.count()

    // Open menu and click delete
    await promptPage.openPromptCardMenu('Code Review Assistant')
    await promptPage.promptCardMenuItems.delete.click()

    // Cancel deletion
    const confirmDialog = page.getByTestId('confirmation-dialog')
    await page.getByRole('button', { name: /cancel/i }).click()

    // Verify prompt still exists
    await expect(promptPage.promptCardByTitle('Code Review Assistant')).toBeVisible()
    await expect(promptPage.promptCards).toHaveCount(initialCount)
  })
})
```

### 2. Sorting and Organization Tests

#### 2.1 Sorting Functionality Tests

```typescript
test.describe('Prompt Sorting and Organization', () => {
  test.beforeEach(async ({ page }) => {
    await TestDataManager.setupPrompts(page, PromptManagementTestData.testPrompts)
  })

  test('should sort prompts by title alphabetically', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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

      if (previousDate) {
        expect(currentDate.getTime()).toBeLessThanOrEqual(previousDate.getTime())
      }
      previousDate = currentDate
    }
  })

  test('should sort prompts by token count', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Set custom sort
    await promptPage.sortPrompts('title', 'desc')
    const titlesBefore = await promptPage.getVisiblePromptTitles()

    // Reload page
    await page.reload()
    await promptPage.waitForPageLoad()

    // Verify sort is preserved
    const titlesAfter = await promptPage.getVisiblePromptTitles()
    expect(titlesAfter).toEqual(titlesBefore)
  })
})
```

#### 2.2 Search and Filtering Tests

```typescript
test.describe('Prompt Search and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await TestDataManager.setupPrompts(page, PromptManagementTestData.testPrompts)
  })

  test('should filter prompts by search query', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Test each search scenario
    for (const scenario of PromptManagementTestData.searchQueries) {
      await promptPage.searchPrompts(scenario.query)

      if (scenario.expectedResults.length === 0) {
        // Should show no results
        await expect(promptPage.promptCards).toHaveCount(0)
        await expect(page.getByText(/no.*results|no.*prompts.*found/i)).toBeVisible()
      } else {
        // Should show matching prompts
        await expect(promptPage.promptCards).toHaveCount(scenario.expectedResults.length)

        for (const expectedTitle of scenario.expectedResults) {
          await expect(promptPage.promptCardByTitle(expectedTitle)).toBeVisible()
        }
      }

      // Clear search for next test
      await promptPage.searchInput.clear()
      await page.waitForTimeout(500)
    }
  })

  test('should search across prompt titles and content', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Search for content that appears in prompt body but not title
    await promptPage.searchPrompts('security vulnerabilities')

    // Should find Code Review Assistant (has security in content)
    await expect(promptPage.promptCardByTitle('Code Review Assistant')).toBeVisible()

    // Should not show prompts without matching content
    await expect(promptPage.promptCardByTitle('Documentation Generator')).not.toBeVisible()
  })

  test('should highlight search terms in results', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Search for specific term
    await promptPage.searchPrompts('documentation')

    // Check if search terms are highlighted (implementation dependent)
    const searchResults = promptPage.promptCards
    if ((await searchResults.first().locator('.highlight, mark, .search-highlight').count()) > 0) {
      await expect(searchResults.first().locator('.highlight, mark, .search-highlight')).toBeVisible()
    }
  })

  test('should handle special characters and edge cases in search', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Test special characters
    const specialQueries = ['{{code}}', 'test-case', 'C++', 'user@domain.com']

    for (const query of specialQueries) {
      await promptPage.searchPrompts(query)

      // Should not crash and should return some results or empty state
      const resultCount = await promptPage.promptCards.count()
      expect(resultCount).toBeGreaterThanOrEqual(0)

      await promptPage.searchInput.clear()
      await page.waitForTimeout(300)
    }
  })

  test('should debounce search input for performance', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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

    // Should not have made excessive requests
    const searchRequests = requests.filter((url) => url.includes('search'))
    expect(searchRequests.length).toBeLessThan(searchTerm.length) // Should be debounced
  })
})
```

### 3. Create Prompt Modal Tests

#### 3.1 Prompt Creation Tests

```typescript
test.describe('Create Prompt Modal', () => {
  test('should open create prompt modal with all fields', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Click create button
    await promptPage.createPromptButton.click()

    // Verify modal is displayed
    await expect(promptPage.promptModal).toBeVisible()
    await expect(page.getByText(/create.*prompt|new.*prompt/i)).toBeVisible()

    // Verify all form fields are present
    await expect(promptPage.promptNameInput).toBeVisible()
    await expect(promptPage.promptContentTextarea).toBeVisible()
    await expect(promptPage.promptTokenCounter).toBeVisible()
    await expect(promptPage.promptTagsInput).toBeVisible()
    await expect(promptPage.promptCategorySelect).toBeVisible()

    // Verify action buttons
    await expect(promptPage.savePromptButton).toBeVisible()
    await expect(promptPage.cancelPromptButton).toBeVisible()

    // Initially save button should be disabled
    await expect(promptPage.savePromptButton).toBeDisabled()
  })

  test('should show live token count while typing', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
    await promptPage.createPromptButton.click()

    // Initially should show 0 tokens
    await expect(promptPage.promptTokenCounter).toContainText('0 tokens')

    // Type content and verify token count updates
    await promptPage.promptContentTextarea.fill('This is a test prompt with some content')

    // Token count should update (may be approximate)
    await expect(promptPage.promptTokenCounter).toContainText(/[1-9]\d* tokens/)

    // Add more content
    await promptPage.promptContentTextarea.fill(`This is a longer test prompt with more content.
It includes multiple sentences and should have a higher token count.
Variables like {{variable_name}} should also be counted.`)

    // Token count should increase
    const tokenText = await promptPage.promptTokenCounter.textContent()
    const tokenCount = parseInt(tokenText?.match(/(\d+)/)?.[1] || '0')
    expect(tokenCount).toBeGreaterThan(20)
  })

  test('should create new prompt successfully', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

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
    await expect(page.getByText('Prompt created successfully')).toBeVisible()

    // Verify prompt appears in grid
    await expect(promptPage.promptCardByTitle(newPrompt.title)).toBeVisible()

    // Verify prompt content is correct
    const newCard = promptPage.promptCardByTitle(newPrompt.title)
    const preview = promptPage.getPromptCardPreview(newPrompt.title)
    await expect(preview).toContainText('Help create automated tests')

    // Verify token count is displayed
    await expect(promptPage.getPromptCardTokenCount(newPrompt.title)).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
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

    const nameError = page.getByText(/title.*required|name.*required/i)
    if (await nameError.isVisible()) {
      await expect(nameError).toBeVisible()
    }
  })

  test('should handle tags input with Enter key', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
    await promptPage.createPromptButton.click()

    // Add multiple tags
    const tags = ['testing', 'automation', 'quality-assurance']

    for (const tag of tags) {
      await promptPage.promptTagsInput.fill(tag)
      await promptPage.promptTagsInput.press('Enter')
    }

    // Verify tags are displayed as chips/badges
    for (const tag of tags) {
      await expect(page.getByTestId('tag-chip').filter({ hasText: tag })).toBeVisible()
    }

    // Should be able to remove tags
    const firstTagRemove = page
      .getByTestId('tag-chip')
      .first()
      .getByRole('button', { name: /remove|×/ })
    if (await firstTagRemove.isVisible()) {
      await firstTagRemove.click()
      await expect(page.getByTestId('tag-chip')).toHaveCount(tags.length - 1)
    }
  })

  test('should support markdown preview', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')
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
    const previewTab = page.getByRole('tab', { name: /preview/i })
    if (await previewTab.isVisible()) {
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
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    const initialCount = await promptPage.promptCards.count()

    await promptPage.createPromptButton.click()

    // Fill some data
    await promptPage.promptNameInput.fill('Test Prompt To Cancel')
    await promptPage.promptContentTextarea.fill('This should be discarded')

    // Cancel
    await promptPage.cancelPromptButton.click()

    // Modal should close
    await expect(promptPage.promptModal).not.toBeVisible()

    // No new prompt should be created
    await expect(promptPage.promptCards).toHaveCount(initialCount)
  })
})
```

### 4. Bulk Operations and Selection Tests

#### 4.1 Multi-Selection Tests

```typescript
test.describe('Bulk Operations and Multi-Selection', () => {
  test.beforeEach(async ({ page }) => {
    await TestDataManager.setupPrompts(page, PromptManagementTestData.testPrompts)
  })

  test('should select multiple prompts with checkboxes', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Select first two prompts
    await promptPage.selectPromptCard('Code Review Assistant')
    await promptPage.selectPromptCard('Documentation Generator')

    // Verify selection count
    await expect(promptPage.selectedPromptsCount).toContainText('2 selected')

    // Verify bulk actions menu appears
    await expect(promptPage.bulkActionsMenu).toBeVisible()

    // Select third prompt
    await promptPage.selectPromptCard('Bug Report Analyzer')
    await expect(promptPage.selectedPromptsCount).toContainText('3 selected')
  })

  test('should select all prompts with select all checkbox', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Find and click select all checkbox
    const selectAllCheckbox = page.getByTestId('select-all-prompts')
    await selectAllCheckbox.check()

    // All prompt checkboxes should be selected
    const promptCount = await promptPage.promptCards.count()
    await expect(promptPage.selectedPromptsCount).toContainText(`${promptCount} selected`)

    // All individual checkboxes should be checked
    for (const prompt of PromptManagementTestData.testPrompts) {
      await expect(promptPage.getPromptCardCheckbox(prompt.title)).toBeChecked()
    }

    // Unselect all
    await selectAllCheckbox.uncheck()
    await expect(promptPage.selectedPromptsCount).not.toBeVisible()
  })

  test('should perform bulk export of selected prompts', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Select multiple prompts
    await promptPage.selectPromptCard('Code Review Assistant')
    await promptPage.selectPromptCard('Bug Report Analyzer')

    // Click bulk actions menu
    await promptPage.bulkActionsMenu.click()

    // Setup download handler for zip file
    const downloadPromise = page.waitForEvent('download')

    // Click bulk export
    await page.getByRole('menuitem', { name: /export.*selected|bulk.*export/i }).click()

    // Verify download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/prompts.*export.*\.(zip|md)$/i)
  })

  test('should perform bulk delete with confirmation', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    const initialCount = await promptPage.promptCards.count()

    // Select prompts to delete
    await promptPage.selectPromptCard('Test Case Generator')
    await promptPage.selectPromptCard('Bug Report Analyzer')

    // Open bulk actions and delete
    await promptPage.bulkActionsMenu.click()
    await page.getByRole('menuitem', { name: /delete.*selected|bulk.*delete/i }).click()

    // Confirm deletion
    const confirmDialog = page.getByTestId('bulk-delete-confirmation')
    await expect(confirmDialog).toBeVisible()
    await expect(confirmDialog).toContainText('2 prompts')

    await page.getByRole('button', { name: /delete|confirm/i }).click()

    // Verify prompts were deleted
    await expect(promptPage.promptCards).toHaveCount(initialCount - 2)
    await expect(promptPage.promptCardByTitle('Test Case Generator')).not.toBeVisible()
    await expect(promptPage.promptCardByTitle('Bug Report Analyzer')).not.toBeVisible()

    // Selection should be cleared
    await expect(promptPage.selectedPromptsCount).not.toBeVisible()
  })

  test('should clear selection when search filters results', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await promptPage.goto('/prompts')

    // Select some prompts
    await promptPage.selectPromptCard('Code Review Assistant')
    await promptPage.selectPromptCard('Documentation Generator')

    await expect(promptPage.selectedPromptsCount).toContainText('2 selected')

    // Search for something that doesn't include selected items
    await promptPage.searchPrompts('bug report')

    // Selection should be cleared or adjusted
    const selectionText = await promptPage.selectedPromptsCount.textContent().catch(() => '')
    expect(selectionText).not.toContain('2 selected')
  })
})
```

## Performance and Accessibility Tests

### Performance Tests

```typescript
test.describe('Prompt Management Performance', () => {
  test('should handle large number of prompts efficiently', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)

    // Setup large dataset
    await TestDataManager.setupLargePromptDataset(page, 100)

    const startTime = Date.now()
    await promptPage.goto('/prompts')

    // Should load within reasonable time
    await expect(promptPage.promptCards.first()).toBeVisible({ timeout: 10000 })
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(5000) // 5 seconds max

    // Search should be fast
    const searchStartTime = Date.now()
    await promptPage.searchPrompts('code')
    await promptPage.promptCards.first().waitFor()
    const searchTime = Date.now() - searchStartTime

    expect(searchTime).toBeLessThan(2000) // 2 seconds max
  })

  test('should implement virtual scrolling or pagination for large datasets', async ({ page }) => {
    const promptPage = new PromptManagementPage(page)
    await TestDataManager.setupLargePromptDataset(page, 500)

    await promptPage.goto('/prompts')

    // Should not render all 500 cards at once (performance optimization)
    const renderedCards = await promptPage.promptCards.count()
    expect(renderedCards).toBeLessThan(100) // Should use virtual scrolling or pagination

    // Check for pagination or load more functionality
    const pagination = page.getByTestId('pagination')
    const loadMoreButton = page.getByRole('button', { name: /load.*more|show.*more/i })

    const hasPagination = await pagination.isVisible().catch(() => false)
    const hasLoadMore = await loadMoreButton.isVisible().catch(() => false)

    expect(hasPagination || hasLoadMore).toBe(true)
  })
})
```

## Best Practices and Recommendations

### 1. Test Data Management

- **File System Integration**: Use temporary files for import testing with proper cleanup
- **Large Datasets**: Test with realistic numbers of prompts (100+ items)
- **Content Variety**: Include prompts with various lengths, formats, and special characters

### 2. UI Interaction Testing

- **Async Operations**: Properly wait for file imports, search results, token counting
- **Bulk Operations**: Test selection state management and bulk action performance
- **Modal Management**: Ensure proper focus handling and keyboard navigation

### 3. Performance Optimization

- **Search Debouncing**: Verify search input is debounced for performance
- **Virtual Rendering**: Test large datasets don't cause performance issues
- **Memory Management**: Monitor for memory leaks during bulk operations

### 4. Cross-Platform Compatibility

- **File Import**: Test file selection on different operating systems
- **Download Handling**: Verify export functionality across browsers
- **Responsive Design**: Test layout at various screen sizes

## Execution Strategy

### 1. Test Organization

- **Import Tests**: Run sequentially due to file system dependencies
- **CRUD Operations**: Can run in parallel with proper data isolation
- **Search/Sort Tests**: Group together for consistent dataset
- **Performance Tests**: Run separately with controlled datasets

### 2. Environment Setup

- **Temporary Files**: Create and cleanup test markdown files
- **Database State**: Ensure clean state between test runs
- **File Downloads**: Configure download directory for test files

This comprehensive test plan ensures the Prompt Management Page is thoroughly validated across all features, from basic CRUD operations to complex import workflows and bulk operations, providing reliable functionality for prompt template organization and management.
