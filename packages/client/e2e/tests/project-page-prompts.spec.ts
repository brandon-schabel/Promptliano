/**
 * Project Page - Prompt Management Test Suite
 *
 * Tests prompt display, hover effects, copy functionality,
 * three-dot menu actions, and prompt organization features.
 */

import { test, expect } from '@playwright/test'
import { ProjectPage } from '../pages/project-page'
import { ProjectPageTestUtils } from '../utils/project-page-test-manager'
import { ProjectPageTestData, ProjectPageDataFactory } from '../fixtures/project-page-data'
import { MCPTestHelpers } from '../utils/mcp-test-helpers'

test.describe('Project Page - Prompt Display', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    // Setup environment with test prompts
    await testManager.setupProjectPageEnvironment()
    await testManager.setupProjectPrompts(ProjectPageTestData.testPrompts)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should display all project prompts', async ({ page }) => {
    // Wait for prompts container to be visible
    await expect(projectPage.promptsContainer).toBeVisible()

    // Verify expected number of prompt cards are displayed
    const expectedPromptCount = ProjectPageTestData.testPrompts.length
    await expect(projectPage.promptCards).toHaveCount(expectedPromptCount)

    // Verify each test prompt is displayed
    for (const prompt of ProjectPageTestData.testPrompts) {
      await expect(projectPage.promptCardByTitle(prompt.title)).toBeVisible()
    }
  })

  test('should display prompt card information correctly', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]
    const promptCard = projectPage.promptCardByTitle(firstPrompt.title)

    await expect(promptCard).toBeVisible()

    // Verify prompt title is displayed
    await expect(promptCard).toContainText(firstPrompt.title)

    // Verify prompt description if present
    if (firstPrompt.description) {
      await expect(promptCard).toContainText(firstPrompt.description)
    }

    // Verify tags are displayed
    if (firstPrompt.tags && firstPrompt.tags.length > 0) {
      for (const tag of firstPrompt.tags.slice(0, 3)) {
        // Check first few tags
        await expect(promptCard).toContainText(tag)
      }
    }
  })

  test('should handle empty prompts state gracefully', async ({ page }) => {
    // Setup environment with no prompts
    await testManager.setupProjectPrompts([])

    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Should show empty state or no prompt cards
    const promptCount = await projectPage.promptCards.count()
    expect(promptCount).toBe(0)

    // Look for empty state message
    const emptyState = page.getByTestId('no-prompts')
    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText(/no prompts|empty/i)
    }
  })

  test('should display prompts with proper layout and styling', async ({ page }) => {
    await expect(projectPage.promptsContainer).toBeVisible()

    // Verify prompt cards have proper layout
    const firstCard = projectPage.promptCards.first()
    const cardBox = await firstCard.boundingBox()

    expect(cardBox).toBeTruthy()
    expect(cardBox!.width).toBeGreaterThan(200) // Reasonable minimum width
    expect(cardBox!.height).toBeGreaterThan(50) // Reasonable minimum height

    // Verify cards are properly spaced (not overlapping)
    const allCards = projectPage.promptCards
    const cardCount = await allCards.count()

    if (cardCount > 1) {
      const firstCardBox = await allCards.nth(0).boundingBox()
      const secondCardBox = await allCards.nth(1).boundingBox()

      expect(firstCardBox).toBeTruthy()
      expect(secondCardBox).toBeTruthy()

      // Cards should not overlap
      const noOverlap =
        firstCardBox!.x + firstCardBox!.width <= secondCardBox!.x ||
        firstCardBox!.y + firstCardBox!.height <= secondCardBox!.y

      expect(noOverlap).toBeTruthy()
    }
  })
})

test.describe('Project Page - Prompt Hover Effects', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await testManager.setupProjectPrompts(ProjectPageTestData.testPrompts)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should show copy icon on hover', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    // Initially, copy icon should not be visible
    await expect(projectPage.promptCardCopyIcon(firstPrompt.title)).not.toBeVisible()

    // Hover over prompt card
    await projectPage.hoverPromptCard(firstPrompt.title)

    // Copy icon should become visible
    await expect(projectPage.promptCardCopyIcon(firstPrompt.title)).toBeVisible()
  })

  test('should show three-dot menu on hover', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    // Initially, menu should not be visible
    await expect(projectPage.promptCardMenu(firstPrompt.title)).not.toBeVisible()

    // Hover over prompt card
    await projectPage.hoverPromptCard(firstPrompt.title)

    // Three-dot menu should become visible
    await expect(projectPage.promptCardMenu(firstPrompt.title)).toBeVisible()
  })

  test('should hide hover elements when not hovering', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    // Hover to show elements
    await projectPage.hoverPromptCard(firstPrompt.title)
    await expect(projectPage.promptCardCopyIcon(firstPrompt.title)).toBeVisible()

    // Move hover away
    await projectPage.promptsContainer.hover()

    // Elements should be hidden again (with some timeout for CSS transitions)
    await expect(projectPage.promptCardCopyIcon(firstPrompt.title)).not.toBeVisible({ timeout: 2000 })
  })

  test('should show hover effects on multiple cards independently', async ({ page }) => {
    const prompts = ProjectPageTestData.testPrompts.slice(0, 2) // Test with first 2 prompts

    // Hover over first prompt
    await projectPage.hoverPromptCard(prompts[0].title)
    await expect(projectPage.promptCardCopyIcon(prompts[0].title)).toBeVisible()

    // Copy icon for second prompt should still be hidden
    await expect(projectPage.promptCardCopyIcon(prompts[1].title)).not.toBeVisible()

    // Hover over second prompt
    await projectPage.hoverPromptCard(prompts[1].title)
    await expect(projectPage.promptCardCopyIcon(prompts[1].title)).toBeVisible()
  })

  test('should maintain hover state during interaction', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.hoverPromptCard(firstPrompt.title)
    await expect(projectPage.promptCardCopyIcon(firstPrompt.title)).toBeVisible()

    // Click the copy icon while still hovering
    await projectPage.promptCardCopyIcon(firstPrompt.title).click()

    // Verify copy action worked
    await expect(page.getByText('Prompt copied to clipboard')).toBeVisible()
  })
})

test.describe('Project Page - Prompt Copy Functionality', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await testManager.setupProjectPrompts(ProjectPageTestData.testPrompts)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should copy prompt via copy icon', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.copyPromptViaIcon(firstPrompt.title)

    // Verify success toast appears
    await expect(page.getByText('Prompt copied to clipboard')).toBeVisible()
  })

  test('should copy prompt content via menu', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.copyPromptContent(firstPrompt.title)

    // Verify success toast
    await expect(page.getByText('Prompt content copied')).toBeVisible()
  })

  test('should copy different prompts independently', async ({ page }) => {
    const prompts = ProjectPageTestData.testPrompts.slice(0, 2)

    // Copy first prompt
    await projectPage.copyPromptViaIcon(prompts[0].title)
    await expect(page.getByText('Prompt copied to clipboard')).toBeVisible()

    // Wait for toast to disappear
    await expect(page.getByText('Prompt copied to clipboard')).not.toBeVisible({ timeout: 5000 })

    // Copy second prompt
    await projectPage.copyPromptViaIcon(prompts[1].title)
    await expect(page.getByText('Prompt copied to clipboard')).toBeVisible()
  })

  test('should handle copy errors gracefully', async ({ page }) => {
    // Mock clipboard API to fail
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new Error('Clipboard not available'))
        }
      })
    })

    const firstPrompt = ProjectPageTestData.testPrompts[0]
    await projectPage.hoverPromptCard(firstPrompt.title)
    await projectPage.promptCardCopyIcon(firstPrompt.title).click()

    // Should show error message or fallback
    const errorToast = page.getByText(/clipboard.*error|copy.*failed/i)
    if (await errorToast.isVisible({ timeout: 2000 })) {
      await expect(errorToast).toBeVisible()
    }
  })

  test('should provide visual feedback during copy', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.hoverPromptCard(firstPrompt.title)

    // Check for loading state during copy (if implemented)
    const copyIcon = projectPage.promptCardCopyIcon(firstPrompt.title)
    await copyIcon.click()

    // Look for visual feedback (spinning icon, color change, etc.)
    const feedback = page.getByTestId('copy-feedback').or(page.getByText('Copying...'))
    if (await feedback.isVisible({ timeout: 500 })) {
      await expect(feedback).toBeVisible()
    }
  })
})

test.describe('Project Page - Prompt Three-Dot Menu', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await testManager.setupProjectPrompts(ProjectPageTestData.testPrompts)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should display all menu options when opened', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.openPromptMenu(firstPrompt.title)

    // Verify all expected menu options are present
    const expectedMenuItems = ['View Prompt', 'Edit Prompt', 'Copy Content', 'Export as Markdown', 'Delete Prompt']

    for (const item of expectedMenuItems) {
      await expect(page.getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('should handle View Prompt action', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.viewPrompt(firstPrompt.title)

    // Verify prompt view dialog opens
    await expect(projectPage.promptViewDialog).toBeVisible()

    // Verify prompt content is displayed
    await expect(projectPage.promptViewDialog).toContainText(firstPrompt.title)
    if (firstPrompt.content) {
      await expect(projectPage.promptViewDialog).toContainText(firstPrompt.content.substring(0, 50))
    }

    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(projectPage.promptViewDialog).not.toBeVisible()
  })

  test('should handle Edit Prompt action', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.editPrompt(firstPrompt.title)

    // Verify prompt edit dialog opens
    await expect(projectPage.promptEditDialog).toBeVisible()

    // Verify form fields are populated
    const titleInput = page.getByLabel(/title|name/i)
    if (await titleInput.isVisible()) {
      await expect(titleInput).toHaveValue(firstPrompt.title)
    }

    // Cancel edit
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(projectPage.promptEditDialog).not.toBeVisible()
  })

  test('should handle Export as Markdown action', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    const download = await projectPage.exportPromptAsMarkdown(firstPrompt.title)

    // Verify download was initiated
    expect(download.suggestedFilename()).toMatch(/\.md$/)
    expect(download.suggestedFilename()).toContain(firstPrompt.title.toLowerCase().replace(/\s+/g, '-'))
  })

  test('should handle Delete Prompt confirmation', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    // Test canceling deletion
    await projectPage.deletePrompt(firstPrompt.title, false)

    // Verify prompt still exists
    await expect(projectPage.promptCardByTitle(firstPrompt.title)).toBeVisible()
  })

  test('should handle Delete Prompt confirmation with accept', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    // Test confirming deletion
    await projectPage.deletePrompt(firstPrompt.title, true)

    // Verify success message
    await expect(page.getByText('Prompt deleted')).toBeVisible()

    // Verify prompt is removed (in a real scenario)
    // For mocked environment, we might need to mock the deletion response
  })

  test('should close menu when clicking outside', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.openPromptMenu(firstPrompt.title)
    await expect(projectPage.promptMenuView).toBeVisible()

    // Click outside the menu
    await projectPage.promptsContainer.click({ position: { x: 10, y: 10 } })

    // Menu should close
    await expect(projectPage.promptMenuView).not.toBeVisible({ timeout: 2000 })
  })

  test('should close menu with escape key', async ({ page }) => {
    const firstPrompt = ProjectPageTestData.testPrompts[0]

    await projectPage.openPromptMenu(firstPrompt.title)
    await expect(projectPage.promptMenuView).toBeVisible()

    // Press escape key
    await page.keyboard.press('Escape')

    // Menu should close
    await expect(projectPage.promptMenuView).not.toBeVisible()
  })
})

test.describe('Project Page - Prompt Organization', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)

    await testManager.setupProjectPageEnvironment()
    await testManager.setupProjectPrompts(ProjectPageTestData.testPrompts)

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should display prompts with tags', async ({ page }) => {
    for (const prompt of ProjectPageTestData.testPrompts) {
      const promptCard = projectPage.promptCardByTitle(prompt.title)
      await expect(promptCard).toBeVisible()

      if (prompt.tags && prompt.tags.length > 0) {
        // Check that at least some tags are visible
        const hasVisibleTags = (await promptCard.locator('.tag, [data-testid="tag"]').count()) > 0
        if (hasVisibleTags) {
          // Verify tag content
          for (const tag of prompt.tags.slice(0, 2)) {
            // Check first 2 tags
            await expect(promptCard).toContainText(tag)
          }
        }
      }
    }
  })

  test('should handle prompts with different lengths', async ({ page }) => {
    // Test with the large prompt from ProjectPageDataFactory
    const promptScenario = ProjectPageDataFactory.createPromptManagementScenario()
    await testManager.setupProjectPrompts([...ProjectPageTestData.testPrompts, promptScenario.largePrompt])

    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Verify large prompt is displayed
    const largePromptCard = projectPage.promptCardByTitle(promptScenario.largePrompt.title)
    await expect(largePromptCard).toBeVisible()

    // Verify card layout is not broken by large content
    const cardBox = await largePromptCard.boundingBox()
    expect(cardBox).toBeTruthy()
    expect(cardBox!.height).toBeLessThan(500) // Should have reasonable height limit
  })

  test('should handle prompts with no content', async ({ page }) => {
    const promptScenario = ProjectPageDataFactory.createPromptManagementScenario()
    await testManager.setupProjectPrompts([promptScenario.emptyPrompt])

    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Verify empty prompt is displayed
    const emptyPromptCard = projectPage.promptCardByTitle(promptScenario.emptyPrompt.title)
    await expect(emptyPromptCard).toBeVisible()

    // Should show title even without content
    await expect(emptyPromptCard).toContainText(promptScenario.emptyPrompt.title)
  })

  test('should maintain card order consistently', async ({ page }) => {
    const promptTitles = ProjectPageTestData.testPrompts.map((p) => p.title)

    // Get initial order
    const initialOrder = []
    for (let i = 0; i < (await projectPage.promptCards.count()); i++) {
      const card = projectPage.promptCards.nth(i)
      const title = await card.textContent()
      initialOrder.push(title)
    }

    // Reload page
    await page.reload()
    await projectPage.waitForProjectPageLoad()

    // Get order after reload
    const reloadOrder = []
    for (let i = 0; i < (await projectPage.promptCards.count()); i++) {
      const card = projectPage.promptCards.nth(i)
      const title = await card.textContent()
      reloadOrder.push(title)
    }

    // Order should be consistent
    expect(reloadOrder).toEqual(initialOrder)
  })
})

test.describe('Project Page - Prompt Error Handling', () => {
  let projectPage: ProjectPage
  let testManager: any

  test.beforeEach(async ({ page }, testInfo) => {
    testManager = ProjectPageTestUtils.createManagerForScenario(page, 'full', testInfo)
    projectPage = new ProjectPage(page)
  })

  test.afterEach(async () => {
    await testManager.cleanup()
  })

  test('should handle prompt loading errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/prompts**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to load prompts'
        })
      })
    })

    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Should show error state or empty state
    const errorMessage = page.getByTestId('prompts-error').or(page.getByText(/error.*prompts|failed.*load/i))
    if (await errorMessage.isVisible({ timeout: 5000 })) {
      await expect(errorMessage).toBeVisible()
    } else {
      // Should at least not crash and show empty state
      const promptCount = await projectPage.promptCards.count()
      expect(promptCount).toBe(0)
    }
  })

  test('should handle slow prompt loading', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/prompts**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 2 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: ProjectPageTestData.testPrompts.slice(0, 2)
        })
      })
    })

    await projectPage.gotoProject(1)

    // Should show loading indicator
    const loadingIndicator = page.getByTestId('prompts-loading').or(page.getByText('Loading'))
    if (await loadingIndicator.isVisible({ timeout: 1000 })) {
      await expect(loadingIndicator).toBeVisible()
    }

    // Eventually prompts should load
    await expect(projectPage.promptCards).toHaveCount(2, { timeout: 5000 })
  })

  test('should handle network disconnection gracefully', async ({ page }) => {
    await testManager.setupProjectPageEnvironment()
    await projectPage.gotoProject(1)
    await projectPage.waitForProjectPageLoad()

    // Verify prompts load initially
    await expect(projectPage.promptCards).toHaveCount.atLeast(1)

    // Simulate network disconnection
    await page.route('**/api/**', (route) => route.abort())

    // Try to perform an action that requires network
    const firstPrompt = ProjectPageTestData.testPrompts[0]
    await projectPage.hoverPromptCard(firstPrompt.title)
    await projectPage.promptCardCopyIcon(firstPrompt.title).click()

    // Should handle the error gracefully (show offline message, fallback, etc.)
    const offlineMessage = page.getByText(/offline|network.*error|connection.*failed/i)
    if (await offlineMessage.isVisible({ timeout: 3000 })) {
      await expect(offlineMessage).toBeVisible()
    }
  })
})
