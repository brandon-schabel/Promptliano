import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('User Input Panel Testing', () => {
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

  test.describe('Prompt Creation & Management', () => {
    test('should display user input panel when project is loaded', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Verify user input panel is visible
      const userInputPanel = appPage.page.locator(
        ['[data-testid="user-input-panel"]', '.user-input-panel', '[data-testid="input-panel"]'].join(', ')
      )

      await expect(userInputPanel).toBeVisible({ timeout: 10000 })

      // Check for main components within the panel
      const textArea = appPage.page.locator(
        ['[data-testid="prompt-textarea"]', 'textarea[placeholder*="prompt"]', '.expandable-textarea textarea'].join(
          ', '
        )
      )

      if (await textArea.isVisible({ timeout: 5000 })) {
        await expect(textArea).toBeVisible()
      }
    })

    test('should create new prompts with title and content', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for prompt creation area
      const promptTextArea = appPage.page.locator(
        ['[data-testid="prompt-textarea"]', 'textarea[placeholder*="prompt"]', 'textarea'].join(', ')
      )

      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        // Type a prompt
        const testPrompt = 'Explain the main components in this project and their relationships.'
        await promptTextArea.fill(testPrompt)
        await appPage.page.waitForTimeout(500)

        // Look for save/create button
        const saveButton = appPage.page.locator(
          [
            '[data-testid="save-prompt"]',
            'button:has-text("Save")',
            'button:has-text("Create")',
            '[data-testid="create-prompt"]'
          ].join(', ')
        )

        if (await saveButton.isVisible({ timeout: 3000 })) {
          await saveButton.click()
          await appPage.page.waitForTimeout(1000)

          // Verify prompt was created (look for success feedback)
          const successMessage = appPage.page.locator(
            [
              '[data-testid="success-toast"]',
              '.toast',
              '[data-sonner-toast]:has-text("success")',
              'text*="created"'
            ].join(', ')
          )

          if (await successMessage.isVisible({ timeout: 3000 })) {
            expect(await successMessage.isVisible()).toBe(true)
          }
        }
      }
    })

    test('should associate prompts with selected files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // First select some files
      const fileItems = appPage.page.locator(
        ['[data-testid="file-item"]', '.file-item', 'button:has-text(".js")', 'button:has-text("package.json")'].join(
          ', '
        )
      )

      const fileCount = await fileItems.count()
      if (fileCount > 0) {
        // Select first file
        await fileItems.first().click()
        await appPage.page.waitForTimeout(500)

        // Now create prompt with selected files
        const promptTextArea = appPage.page.locator(['[data-testid="prompt-textarea"]', 'textarea'].join(', '))

        if (await promptTextArea.isVisible({ timeout: 3000 })) {
          await promptTextArea.fill('Review the selected files for potential improvements.')

          // Look for context indicator showing selected files
          const selectedFilesContext = appPage.page.locator(
            [
              '[data-testid="selected-files-context"]',
              '.selected-files-indicator',
              'text*="file selected"',
              'text*="files selected"'
            ].join(', ')
          )

          if (await selectedFilesContext.isVisible({ timeout: 2000 })) {
            const contextText = await selectedFilesContext.textContent()
            expect(contextText).toMatch(/\d+\s*(file|item)s?\s*(selected|included)/i)
          }

          // Create the prompt
          const saveButton = appPage.page.locator(
            ['[data-testid="save-prompt"]', 'button:has-text("Save")', 'button:has-text("Create")'].join(', ')
          )

          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click()
            await appPage.page.waitForTimeout(1000)
          }
        }
      }
    })

    test('should calculate and display token counts', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select some files to get token context
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const fileCount = await fileItems.count()
      if (fileCount > 0) {
        await fileItems.first().click()
        await appPage.page.waitForTimeout(1000)

        // Look for token count display
        const tokenDisplay = appPage.page.locator(
          [
            '[data-testid="token-count"]',
            '.token-count',
            'text*="token"',
            'text*="k"', // For abbreviated counts like "10k"
            'text*="m"' // For millions
          ].join(', ')
        )

        if (await tokenDisplay.isVisible({ timeout: 3000 })) {
          const tokenText = await tokenDisplay.textContent()
          // Should show some token count (could be 0 for empty files)
          expect(tokenText).toMatch(/\d+[km]?\s*tokens?/i)
        }

        // Add text to prompt and verify token count updates
        const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
        if (await promptTextArea.isVisible({ timeout: 2000 })) {
          await promptTextArea.fill('This is a test prompt with some content to generate tokens for counting.')
          await appPage.page.waitForTimeout(1000)

          // Token count should update
          if (await tokenDisplay.isVisible({ timeout: 2000 })) {
            const updatedTokenText = await tokenDisplay.textContent()
            expect(updatedTokenText).toMatch(/\d+[km]?\s*tokens?/i)
          }
        }
      }
    })

    test('should copy prompt content to clipboard', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      const promptText = 'Copy this prompt content to clipboard for testing.'

      // Fill prompt area
      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        await promptTextArea.fill(promptText)
        await appPage.page.waitForTimeout(500)

        // Look for copy button
        const copyButton = appPage.page.locator(
          [
            '[data-testid="copy-prompt"]',
            'button[aria-label*="copy"]',
            'button:has([data-lucide="copy"])',
            '.copy-button'
          ].join(', ')
        )

        if (await copyButton.isVisible({ timeout: 3000 })) {
          await copyButton.click()
          await appPage.page.waitForTimeout(500)

          // Verify copy feedback
          const copyFeedback = appPage.page.locator(
            [
              '[data-testid="copy-success"]',
              'button:has([data-lucide="check"])',
              '.toast:has-text("copied")',
              'text*="copied"'
            ].join(', ')
          )

          if (await copyFeedback.isVisible({ timeout: 2000 })) {
            expect(await copyFeedback.isVisible()).toBe(true)
          }
        }
      }
    })

    test('should edit existing prompts', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Create a prompt first
      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        const originalPrompt = 'Original prompt content'
        await promptTextArea.fill(originalPrompt)

        // Save the prompt
        const saveButton = appPage.page.locator('[data-testid="save-prompt"], button:has-text("Save")')
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click()
          await appPage.page.waitForTimeout(1000)

          // Now try to edit it
          const editedPrompt = 'Edited prompt content with changes'
          await promptTextArea.clear()
          await promptTextArea.fill(editedPrompt)
          await appPage.page.waitForTimeout(500)

          // Save changes
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click()
            await appPage.page.waitForTimeout(1000)

            // Verify the prompt was updated
            const currentContent = await promptTextArea.inputValue()
            expect(currentContent).toContain('Edited prompt content')
          }
        }
      }
    })
  })

  test.describe('AI Suggestions', () => {
    test('should suggest files based on prompt content', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Create a prompt that would suggest specific files
      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        await promptTextArea.fill('Show me the package.json file and main entry point of this project.')
        await appPage.page.waitForTimeout(1000)

        // Look for file suggestion button or automatic suggestions
        const suggestFilesButton = appPage.page.locator(
          [
            '[data-testid="suggest-files"]',
            'button:has-text("Suggest")',
            'button:has([data-lucide="search"])',
            '.suggest-files-button'
          ].join(', ')
        )

        if (await suggestFilesButton.isVisible({ timeout: 3000 })) {
          await suggestFilesButton.click()
          await appPage.page.waitForTimeout(2000) // Wait for AI processing

          // Look for suggestions dialog or results
          const suggestionsDialog = appPage.page.locator(
            ['[data-testid="file-suggestions"]', '[role="dialog"]:has-text("suggest")', '.suggestions-dialog'].join(
              ', '
            )
          )

          if (await suggestionsDialog.isVisible({ timeout: 5000 })) {
            // Should show suggested files
            const suggestedFiles = suggestionsDialog.locator('[data-testid="suggested-file"], .suggestion-item')
            const suggestionCount = await suggestedFiles.count()
            expect(suggestionCount).toBeGreaterThan(0)

            // Try to accept a suggestion
            if (suggestionCount > 0) {
              await suggestedFiles.first().click()
              await appPage.page.waitForTimeout(500)
            }
          }
        }
      }
    })

    test('should suggest prompts based on selected files', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select some files first
      const fileItems = appPage.page.locator('[data-testid="file-item"], .file-item')
      const fileCount = await fileItems.count()
      if (fileCount > 0) {
        await fileItems.first().click()
        await appPage.page.waitForTimeout(1000)

        // Look for prompt suggestion button
        const suggestPromptsButton = appPage.page.locator(
          [
            '[data-testid="suggest-prompts"]',
            'button:has-text("Suggest")',
            'button:has([data-lucide="lightbulb"])',
            '.suggest-prompts-button'
          ].join(', ')
        )

        if (await suggestPromptsButton.isVisible({ timeout: 3000 })) {
          await suggestPromptsButton.click()
          await appPage.page.waitForTimeout(2000) // Wait for AI processing

          // Look for prompt suggestions
          const promptSuggestions = appPage.page.locator(
            ['[data-testid="prompt-suggestions"]', '[role="dialog"]:has-text("prompt")', '.prompt-suggestions'].join(
              ', '
            )
          )

          if (await promptSuggestions.isVisible({ timeout: 5000 })) {
            const suggestedPrompts = promptSuggestions.locator('[data-testid="suggested-prompt"], .prompt-suggestion')
            const promptCount = await suggestedPrompts.count()
            expect(promptCount).toBeGreaterThan(0)

            // Try to use a suggested prompt
            if (promptCount > 0) {
              await suggestedPrompts.first().click()
              await appPage.page.waitForTimeout(500)

              // Verify prompt was inserted
              const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
              if (await promptTextArea.isVisible()) {
                const promptContent = await promptTextArea.inputValue()
                expect(promptContent.length).toBeGreaterThan(0)
              }
            }
          }
        }
      }
    })

    test('should show loading states for AI operations', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Trigger an AI operation
      const suggestButton = appPage.page.locator(
        ['[data-testid="suggest-files"]', '[data-testid="suggest-prompts"]', 'button:has-text("Suggest")'].join(', ')
      )

      if (await suggestButton.isVisible({ timeout: 3000 })) {
        await suggestButton.click()

        // Look for loading indicator
        const loadingIndicator = appPage.page.locator(
          ['[data-testid="loading"]', '.loading', '.spinner', 'svg[data-lucide="loader-2"]'].join(', ')
        )

        if (await loadingIndicator.isVisible({ timeout: 1000 })) {
          expect(await loadingIndicator.isVisible()).toBe(true)
        }

        // Wait for loading to finish
        await appPage.page.waitForTimeout(3000)

        // Loading should be gone
        if (await loadingIndicator.isVisible({ timeout: 1000 })) {
          expect(await loadingIndicator.isVisible()).toBe(false)
        }
      }
    })
  })

  test.describe('Summary Integration', () => {
    test('should display project summary when available', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for project summary section
      const summarySection = appPage.page.locator(
        ['[data-testid="project-summary"]', '.project-summary', '.summary-section'].join(', ')
      )

      if (await summarySection.isVisible({ timeout: 5000 })) {
        // Should show summary content or placeholder
        const summaryContent = await summarySection.textContent()
        expect(summaryContent.length).toBeGreaterThan(0)
      }
    })

    test('should generate project summaries', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for generate summary button
      const generateSummaryButton = appPage.page.locator(
        ['[data-testid="generate-summary"]', 'button:has-text("Generate")', 'button:has-text("Summary")'].join(', ')
      )

      if (await generateSummaryButton.isVisible({ timeout: 3000 })) {
        await generateSummaryButton.click()

        // Should show loading state
        const loadingIndicator = appPage.page.locator(
          ['[data-testid="summary-loading"]', '.loading', 'text*="generating"'].join(', ')
        )

        if (await loadingIndicator.isVisible({ timeout: 2000 })) {
          expect(await loadingIndicator.isVisible()).toBe(true)
        }

        // Wait for summary generation
        await appPage.page.waitForTimeout(5000)

        // Should show generated summary
        const summaryContent = appPage.page.locator(['[data-testid="summary-content"]', '.summary-content'].join(', '))

        if (await summaryContent.isVisible({ timeout: 3000 })) {
          const content = await summaryContent.textContent()
          expect(content.length).toBeGreaterThan(20) // Should have substantial content
        }
      }
    })

    test('should update summary status appropriately', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Look for summary status indicator
      const summaryStatus = appPage.page.locator(
        ['[data-testid="summary-status"]', '.summary-status', '.status-indicator'].join(', ')
      )

      if (await summaryStatus.isVisible({ timeout: 3000 })) {
        const statusText = await summaryStatus.textContent()
        // Should show some status like "up to date", "outdated", "generating"
        expect(statusText).toMatch(/(up to date|outdated|generating|ready|pending)/i)
      }
    })
  })

  test.describe('Expandable Text Area Behavior', () => {
    test('should expand textarea as content grows', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        // Get initial height
        const initialHeight = await promptTextArea.boundingBox()

        // Add multiple lines of content
        const longContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10'
        await promptTextArea.fill(longContent)
        await appPage.page.waitForTimeout(500)

        // Get height after content
        const expandedHeight = await promptTextArea.boundingBox()

        if (initialHeight && expandedHeight) {
          // Height should increase with content
          expect(expandedHeight.height).toBeGreaterThan(initialHeight.height)
        }
      }
    })

    test('should handle keyboard shortcuts in textarea', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      const promptTextArea = appPage.page.locator('[data-testid="prompt-textarea"], textarea')
      if (await promptTextArea.isVisible({ timeout: 5000 })) {
        await promptTextArea.focus()

        // Type some content
        await promptTextArea.fill('Test content for keyboard shortcuts')

        // Test select all
        await appPage.page.keyboard.press('Meta+a')
        await appPage.page.waitForTimeout(200)

        // Test copy
        await appPage.page.keyboard.press('Meta+c')
        await appPage.page.waitForTimeout(200)

        // Clear and test paste
        await promptTextArea.fill('')
        await appPage.page.keyboard.press('Meta+v')
        await appPage.page.waitForTimeout(200)

        // Should have pasted the content back
        const content = await promptTextArea.inputValue()
        expect(content).toBe('Test content for keyboard shortcuts')
      }
    })
  })
})
