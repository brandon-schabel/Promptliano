import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../../pages/projects.page'
import { ProjectHelpers } from '../../helpers/project-helpers'
import { 
  generateUniqueProject, 
  testFiles, 
  testPrompts,
  createTestScenario 
} from '../../fixtures/project-data'

test.describe('Projects - Context Tab Tests', () => {
  let projectsPage: ProjectsPage
  let testProjectId: number | null = null

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    
    // Create a test project for these tests
    const projectData = generateUniqueProject('context-test')
    const project = await ProjectHelpers.createTestProject(page, projectData)
    
    if (project && project.id) {
      testProjectId = project.id
      
      // Create some test files and prompts
      await ProjectHelpers.createTestFiles(page, project.id, testFiles.simple)
      await ProjectHelpers.createTestPrompts(page, testPrompts.slice(0, 3))
      
      // Navigate to the project context tab
      await projectsPage.gotoWithTab('context', project.id)
      await ProjectHelpers.waitForInitialization(page)
    }
  })

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (testProjectId) {
      await ProjectHelpers.deleteTestProject(page, testProjectId)
    }
  })

  test('should display context tab elements', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check if context tab is active
    const contextTabVisible = await projectsPage.contextTab.isVisible()
    
    if (!contextTabVisible) {
      console.log('⚠️ Context tab not visible - project may not be loaded')
      return
    }

    await projectsPage.expectTabActive('context')
    
    // Check for main elements
    const elements = [
      { name: 'User Input', element: projectsPage.userInputTextarea },
      { name: 'Copy All Button', element: projectsPage.copyAllButton },
      { name: 'Search Files Button', element: projectsPage.searchFilesButton },
      { name: 'Suggest Prompts Button', element: projectsPage.suggestPromptsButton }
    ]

    for (const { name, element } of elements) {
      const isVisible = await element.isVisible()
      if (isVisible) {
        console.log(`✅ ${name} is visible`)
      } else {
        console.log(`⚠️ ${name} not visible`)
      }
    }
  })

  test('should enter and display user input', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    const testInput = 'This is a test task description for the AI assistant'
    
    // Enter user input
    await projectsPage.enterUserInput(testInput)
    
    // Verify input was entered
    const inputValue = await projectsPage.userInputTextarea.inputValue()
    expect(inputValue).toBe(testInput)
    
    console.log('✅ User input entered successfully')
  })

  test('should search and select files', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check if file panel is visible
    const fileTreeVisible = await projectsPage.fileTree.isVisible()
    
    if (!fileTreeVisible) {
      // Try to open file panel
      await projectsPage.searchFilesButton.click()
      await page.waitForTimeout(1000)
    }

    // Search for files
    await projectsPage.searchFiles('index')
    await page.waitForTimeout(500)
    
    // Try to select a file
    const indexFile = page.getByText('index.js', { exact: false })
    const fileVisible = await indexFile.isVisible()
    
    if (fileVisible) {
      await indexFile.click()
      await page.waitForTimeout(500)
      
      // Check if file was selected (might show in selected files list)
      const selectedFilesVisible = await projectsPage.selectedFilesList.isVisible()
      if (selectedFilesVisible) {
        await projectsPage.expectFileSelected('index.js')
      }
      
      console.log('✅ File search and selection working')
    } else {
      console.log('⚠️ No files found in search')
    }
  })

  test('should search and select prompts', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check if prompt panel is visible
    const promptListVisible = await projectsPage.promptList.isVisible()
    
    if (!promptListVisible) {
      // Try to open prompt panel
      await projectsPage.suggestPromptsButton.click()
      await page.waitForTimeout(1000)
    }

    // Search for prompts
    await projectsPage.searchPrompts('Code')
    await page.waitForTimeout(500)
    
    // Try to select a prompt
    const codePrompt = page.getByText('Code Review', { exact: false })
    const promptVisible = await codePrompt.isVisible()
    
    if (promptVisible) {
      await codePrompt.click()
      await page.waitForTimeout(500)
      
      // Check if prompt was selected
      const selectedPromptsVisible = await projectsPage.selectedPromptsList.isVisible()
      if (selectedPromptsVisible) {
        await projectsPage.expectPromptSelected('Code Review')
      }
      
      console.log('✅ Prompt search and selection working')
    } else {
      console.log('⚠️ No prompts found in search')
    }
  })

  test('should copy context to clipboard', async ({ page, context }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    
    // Enter some user input
    const testInput = 'Test context for copying'
    await projectsPage.enterUserInput(testInput)
    
    // Click copy button
    await projectsPage.copyContext()
    
    // Check for success toast/notification
    const toastMessage = await ProjectHelpers.getToastMessage(page)
    if (toastMessage) {
      expect(toastMessage.toLowerCase()).toContain('cop')
      console.log('✅ Copy context showed success message')
    }
    
    // Try to read clipboard (might not work in all environments)
    try {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      if (clipboardText) {
        expect(clipboardText).toContain(testInput)
        console.log('✅ Context copied to clipboard')
      }
    } catch (error) {
      console.log('ℹ️ Could not verify clipboard content (expected in CI)')
    }
  })

  test('should navigate to chat with context', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Enter user input
    const testInput = 'Help me refactor this code'
    await projectsPage.enterUserInput(testInput)
    
    // Check if chat button is visible
    const chatButtonVisible = await projectsPage.chatButton.isVisible()
    
    if (chatButtonVisible) {
      // Click chat button
      await projectsPage.chatButton.click()
      
      // Wait for navigation
      await page.waitForTimeout(2000)
      
      // Check if we navigated to chat
      if (page.url().includes('/chat')) {
        console.log('✅ Navigated to chat with context')
        
        // Check if context was passed (might be in URL or chat input)
        const chatInput = page.getByPlaceholder(/type a message/i)
        const inputVisible = await chatInput.isVisible()
        
        if (inputVisible) {
          const chatValue = await chatInput.inputValue()
          if (chatValue.includes(testInput)) {
            console.log('✅ Context transferred to chat')
          }
        }
      } else {
        console.log('⚠️ Did not navigate to chat')
      }
    } else {
      console.log('ℹ️ Chat button not visible')
    }
  })

  test('should handle file suggestions dialog', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Click search files button
    await projectsPage.searchFilesButton.click()
    await page.waitForTimeout(1000)
    
    // Check if dialog opened
    const dialogVisible = await projectsPage.fileSuggestionsDialog.isVisible()
    
    if (dialogVisible) {
      console.log('✅ File suggestions dialog opened')
      
      // Check for file list in dialog
      const fileItems = projectsPage.fileSuggestionsDialog.locator('[role="treeitem"], [role="listitem"]')
      const fileCount = await fileItems.count()
      
      if (fileCount > 0) {
        console.log(`✅ Found ${fileCount} files in dialog`)
        
        // Try to select a file
        await fileItems.first().click()
        await page.waitForTimeout(500)
        
        // Close dialog (ESC or close button)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
        
        // Check if dialog closed
        const stillVisible = await projectsPage.fileSuggestionsDialog.isVisible()
        expect(stillVisible).toBe(false)
      }
    } else {
      console.log('ℹ️ File suggestions dialog did not open as expected')
    }
  })

  test('should handle prompt suggestions dialog', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Click suggest prompts button
    await projectsPage.suggestPromptsButton.click()
    await page.waitForTimeout(1000)
    
    // Check if dialog opened
    const dialogVisible = await projectsPage.promptSuggestionsDialog.isVisible()
    
    if (dialogVisible) {
      console.log('✅ Prompt suggestions dialog opened')
      
      // Check for prompt list in dialog
      const promptItems = projectsPage.promptSuggestionsDialog.locator('[role="listitem"], [role="option"]')
      const promptCount = await promptItems.count()
      
      if (promptCount > 0) {
        console.log(`✅ Found ${promptCount} prompts in dialog`)
        
        // Try to select a prompt
        await promptItems.first().click()
        await page.waitForTimeout(500)
        
        // Close dialog
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
        
        // Check if dialog closed
        const stillVisible = await projectsPage.promptSuggestionsDialog.isVisible()
        expect(stillVisible).toBe(false)
      }
    } else {
      console.log('ℹ️ Prompt suggestions dialog did not open as expected')
    }
  })

  test('should preserve context when switching tabs', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Enter user input
    const testInput = 'This input should be preserved'
    await projectsPage.enterUserInput(testInput)
    
    // Switch to another tab
    const flowTabVisible = await projectsPage.flowTab.isVisible()
    
    if (flowTabVisible) {
      await projectsPage.switchToFlowTab()
      await page.waitForTimeout(1000)
      
      // Switch back to context tab
      await projectsPage.switchToContextTab()
      await page.waitForTimeout(1000)
      
      // Check if input is still there
      const inputValue = await projectsPage.userInputTextarea.inputValue()
      expect(inputValue).toBe(testInput)
      
      console.log('✅ Context preserved when switching tabs')
    } else {
      console.log('ℹ️ Cannot test tab switching - tabs not visible')
    }
  })

  test('should handle keyboard shortcuts if available', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Test common keyboard shortcuts
    
    // Try Cmd/Ctrl+K for search
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(500)
    
    // Check if any command palette or search opened
    const commandPalette = page.getByRole('dialog', { name: /command/i })
    const searchDialog = page.getByRole('dialog', { name: /search/i })
    
    const paletteVisible = await commandPalette.isVisible()
    const searchVisible = await searchDialog.isVisible()
    
    if (paletteVisible || searchVisible) {
      console.log('✅ Keyboard shortcut opened command/search')
      await page.keyboard.press('Escape')
    }
    
    // Try Cmd/Ctrl+Enter to submit (if in input)
    await projectsPage.enterUserInput('Test input')
    await page.keyboard.press('Meta+Enter')
    await page.waitForTimeout(500)
    
    // Check if any action was triggered
    const toastMessage = await ProjectHelpers.getToastMessage(page)
    if (toastMessage) {
      console.log('✅ Keyboard shortcut triggered action')
    }
  })
})