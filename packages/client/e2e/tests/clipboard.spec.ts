import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../pages/projects.page'
import { ChatPage } from '../pages/chat.page'
import { FlowPage } from '../pages/flow.page'
import { FilesPage } from '../pages/files.page'
import { testDataFactory } from '../utils/test-data-factory'

test.describe('Copy Functionality Tests', () => {
  test.describe('Text Content Copy Operations', () => {
    test('should copy prompt content to clipboard', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyPrompt-${Date.now()}`
      const promptContent = 'This is a test prompt content that should be copied to clipboard.'

      await projectsPage.createProject(testProjectName, 'Copy prompt test project')
      await projectsPage.openProject(testProjectName)

      // Create a prompt
      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Test Prompt')
      await page.getByTestId('prompt-content-textarea').fill(promptContent)
      await page.getByTestId('save-prompt').click()

      // Copy prompt content
      await page.getByTestId('prompt-Test Prompt').hover()
      await page.getByTestId('copy-prompt-content').click()

      // Verify success notification
      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
      await expect(page.getByText('Prompt content copied to clipboard')).toBeVisible()

      // Verify clipboard content by pasting into a text field
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V') // Cmd+V on Mac, Ctrl+V on others

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBe(promptContent)
    })

    test('should copy project description to clipboard', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyProjectDesc-${Date.now()}`
      const projectDescription =
        'This is a comprehensive test project description with detailed information about the project goals and requirements.'

      await projectsPage.createProject(testProjectName, projectDescription)
      await projectsPage.openProject(testProjectName)

      // Copy project description
      await page.getByTestId('project-actions-menu').click()
      await page.getByTestId('copy-project-description').click()

      // Verify notification and clipboard content
      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBe(projectDescription)
    })

    test('should copy chat messages to clipboard', async ({ page }) => {
      const chatPage = new ChatPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyChatMsg-${Date.now()}`
      const testMessage = 'This is a test message that should be copied to clipboard successfully.'

      await projectsPage.createProject(testProjectName, 'Copy chat message test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-chat').click()

      await chatPage.sendMessage(testMessage)

      // Copy message content
      await page.getByTestId('chat-message').first().hover()
      await page.getByTestId('copy-message').first().click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify clipboard content
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBe(testMessage)
    })

    test('should copy code blocks from chat responses', async ({ page }) => {
      const chatPage = new ChatPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyCodeBlock-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Copy code block test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-chat').click()

      await chatPage.sendMessage('Write a simple JavaScript function')
      await chatPage.waitForAIResponse()

      // Copy code block
      await page.getByTestId('code-block').first().hover()
      await page.getByTestId('copy-code-block').first().click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
      await expect(page.getByText('Code copied to clipboard')).toBeVisible()

      // Verify the copied code is properly formatted
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toContain('function')
      expect(pastedContent).toMatch(/\{[\s\S]*\}/) // Should contain braces
    })

    test('should copy multiple items in sequence', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopySequence-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Sequential copy test')
      await projectsPage.openProject(testProjectName)

      const promptContents = [
        'First prompt content for sequential copying',
        'Second prompt content for testing clipboard operations',
        'Third prompt content to verify sequential functionality'
      ]

      // Create multiple prompts
      for (let i = 0; i < promptContents.length; i++) {
        await page.getByTestId('add-prompt-button').click()
        await page.getByTestId('prompt-name-input').fill(`Prompt ${i + 1}`)
        await page.getByTestId('prompt-content-textarea').fill(promptContents[i])
        await page.getByTestId('save-prompt').click()
      }

      // Copy each prompt in sequence and verify
      for (let i = 0; i < promptContents.length; i++) {
        await page.getByTestId(`prompt-Prompt ${i + 1}`).hover()
        await page.getByTestId('copy-prompt-content').nth(i).click()

        await expect(page.getByTestId('copy-success-notification')).toBeVisible()

        // Clear previous content and paste
        await page.getByTestId('test-paste-area').click()
        await page.getByTestId('test-paste-area').fill('')
        await page.keyboard.press('Meta+V')

        const pastedContent = await page.getByTestId('test-paste-area').inputValue()
        expect(pastedContent).toBe(promptContents[i])

        // Wait for notification to disappear
        await page.getByTestId('dismiss-notification').click()
      }
    })
  })

  test.describe('Structured Data Copy Operations', () => {
    test('should copy entire project structure as JSON', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyProjectJSON-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'JSON export test project')
      await projectsPage.openProject(testProjectName)

      // Add some content to make the export meaningful
      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Test Prompt')
      await page.getByTestId('prompt-content-textarea').fill('Test content')
      await page.getByTestId('save-prompt').click()

      // Copy project as JSON
      await page.getByTestId('project-actions-menu').click()
      await page.getByTestId('copy-project-json').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
      await expect(page.getByText('Project structure copied as JSON')).toBeVisible()

      // Verify JSON structure
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()

      // Verify it's valid JSON
      const jsonData = JSON.parse(pastedContent)
      expect(jsonData).toHaveProperty('name', testProjectName)
      expect(jsonData).toHaveProperty('description', 'JSON export test project')
      expect(jsonData).toHaveProperty('prompts')
      expect(jsonData.prompts).toHaveLength(1)
      expect(jsonData.prompts[0]).toHaveProperty('name', 'Test Prompt')
    })

    test('should copy flow configuration as YAML', async ({ page }) => {
      const flowPage = new FlowPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyFlowYAML-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Flow YAML test project')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-flow').click()

      // Create a flow configuration
      await flowPage.createQueue('Test Queue', 'Queue for YAML export test')
      await flowPage.addItemsToQueue('Test Queue', [
        { type: 'prompt', name: 'Initial Prompt', priority: 'high' },
        { type: 'task', name: 'Process Data', priority: 'medium' }
      ])

      // Copy flow as YAML
      await page.getByTestId('flow-actions-menu').click()
      await page.getByTestId('copy-flow-yaml').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify YAML structure
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toContain('name: Test Queue')
      expect(pastedContent).toContain('- type: prompt')
      expect(pastedContent).toContain('  name: Initial Prompt')
      expect(pastedContent).toContain('  priority: high')
    })

    test('should copy selected prompts as markdown', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyMarkdown-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Markdown export test')
      await projectsPage.openProject(testProjectName)

      // Create multiple prompts
      const prompts = [
        { name: 'Prompt 1', content: '# First Prompt\n\nThis is the first test prompt.' },
        { name: 'Prompt 2', content: '## Second Prompt\n\nThis is the second prompt with **bold** text.' },
        { name: 'Prompt 3', content: '### Third Prompt\n\n- List item 1\n- List item 2' }
      ]

      for (const prompt of prompts) {
        await page.getByTestId('add-prompt-button').click()
        await page.getByTestId('prompt-name-input').fill(prompt.name)
        await page.getByTestId('prompt-content-textarea').fill(prompt.content)
        await page.getByTestId('save-prompt').click()
      }

      // Select multiple prompts
      await page.getByTestId('select-prompts-mode').click()
      for (const prompt of prompts) {
        await page.getByTestId(`select-prompt-${prompt.name}`).check()
      }

      // Copy selected as markdown
      await page.getByTestId('copy-selected-markdown').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
      await expect(page.getByText('3 prompts copied as Markdown')).toBeVisible()

      // Verify markdown structure
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toContain('# First Prompt')
      expect(pastedContent).toContain('## Second Prompt')
      expect(pastedContent).toContain('### Third Prompt')
      expect(pastedContent).toContain('**bold**')
      expect(pastedContent).toContain('- List item 1')
    })
  })

  test.describe('File and Media Copy Operations', () => {
    test('should copy file paths to clipboard', async ({ page }) => {
      const filesPage = new FilesPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyFilePaths-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'File path copy test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-files').click()

      // Select multiple files
      await filesPage.selectFile('test1.txt')
      await page.keyboard.down('Meta') // Hold Cmd/Ctrl
      await filesPage.selectFile('test2.txt')
      await filesPage.selectFile('test3.txt')
      await page.keyboard.up('Meta')

      // Copy file paths
      await page.getByTestId('copy-file-paths').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
      await expect(page.getByText('3 file paths copied')).toBeVisible()

      // Verify file paths
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toContain('test1.txt')
      expect(pastedContent).toContain('test2.txt')
      expect(pastedContent).toContain('test3.txt')
      expect(pastedContent.split('\n')).toHaveLength(3)
    })

    test('should copy file content to clipboard', async ({ page }) => {
      const filesPage = new FilesPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyFileContent-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'File content copy test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-files').click()

      // Select a text file
      await filesPage.selectFile('sample.txt')
      await page.getByTestId('preview-file').click()

      // Copy file content
      await page.getByTestId('copy-file-content').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify content
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBeTruthy()
      expect(pastedContent.length).toBeGreaterThan(0)
    })

    test('should copy image as base64 data URL', async ({ page }) => {
      const filesPage = new FilesPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyImageData-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Image copy test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-files').click()

      // Select an image file
      await filesPage.selectFile('test-image.png')
      await page.getByTestId('preview-file').click()

      // Copy image as data URL
      await page.getByTestId('copy-image-data').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
      await expect(page.getByText('Image copied as data URL')).toBeVisible()

      // Verify data URL format
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toMatch(/^data:image\/png;base64,/)
    })
  })

  test.describe('Advanced Copy Features', () => {
    test('should copy with custom formatting options', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CustomFormat-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Custom format test')
      await projectsPage.openProject(testProjectName)

      // Create a prompt
      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Format Test')
      await page.getByTestId('prompt-content-textarea').fill('Test content for formatting')
      await page.getByTestId('save-prompt').click()

      // Open copy options dialog
      await page.getByTestId('prompt-Format Test').hover()
      await page.getByTestId('copy-options-menu').click()

      // Select custom formatting
      await page.getByTestId('copy-format-options').click()
      await page.getByTestId('include-timestamp').check()
      await page.getByTestId('include-metadata').check()
      await page.getByTestId('format-as-code-block').check()
      await page.getByTestId('apply-copy-format').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify formatted content
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toContain('```')
      expect(pastedContent).toContain('Test content for formatting')
      expect(pastedContent).toMatch(/\d{4}-\d{2}-\d{2}/) // Should contain date
      expect(pastedContent).toContain('Format Test') // Should contain metadata
    })

    test('should handle copy operations with large content', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `LargeCopy-${Date.now()}`
      const largeContent = 'A'.repeat(10000) // 10KB of content

      await projectsPage.createProject(testProjectName, 'Large content copy test')
      await projectsPage.openProject(testProjectName)

      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Large Prompt')
      await page.getByTestId('prompt-content-textarea').fill(largeContent)
      await page.getByTestId('save-prompt').click()

      // Copy large content
      await page.getByTestId('prompt-Large Prompt').hover()
      await page.getByTestId('copy-prompt-content').click()

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify large content was copied correctly
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBe(largeContent)
      expect(pastedContent.length).toBe(10000)
    })

    test('should provide copy history and quick access', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyHistory-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Copy history test')
      await projectsPage.openProject(testProjectName)

      // Copy multiple different items
      const copyItems = ['First copied item', 'Second copied item', 'Third copied item']

      for (let i = 0; i < copyItems.length; i++) {
        await page.getByTestId('add-prompt-button').click()
        await page.getByTestId('prompt-name-input').fill(`Prompt ${i + 1}`)
        await page.getByTestId('prompt-content-textarea').fill(copyItems[i])
        await page.getByTestId('save-prompt').click()

        await page.getByTestId(`prompt-Prompt ${i + 1}`).hover()
        await page.getByTestId('copy-prompt-content').click()
        await page.getByTestId('dismiss-notification').click()
      }

      // Open copy history
      await page.getByTestId('copy-history-button').click()
      await expect(page.getByTestId('copy-history-panel')).toBeVisible()

      // Verify history items
      for (const item of copyItems) {
        await expect(page.getByText(item.substring(0, 20))).toBeVisible()
      }

      // Re-copy from history
      await page.getByTestId('copy-from-history').first().click()

      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBe(copyItems[copyItems.length - 1])
    })

    test('should handle copy failures gracefully', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyFailure-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Copy failure test')
      await projectsPage.openProject(testProjectName)

      // Mock clipboard API to fail
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: () => Promise.reject(new Error('Clipboard access denied'))
          }
        })
      })

      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Failure Test')
      await page.getByTestId('prompt-content-textarea').fill('This copy should fail')
      await page.getByTestId('save-prompt').click()

      // Attempt to copy
      await page.getByTestId('prompt-Failure Test').hover()
      await page.getByTestId('copy-prompt-content').click()

      // Verify error handling
      await expect(page.getByTestId('copy-error-notification')).toBeVisible()
      await expect(page.getByText('Failed to copy to clipboard')).toBeVisible()
      await expect(page.getByTestId('fallback-copy-dialog')).toBeVisible()

      // Verify fallback method is offered
      await expect(page.getByText('Please manually copy the text below')).toBeVisible()
      await expect(page.getByTestId('fallback-copy-text')).toBeVisible()

      const fallbackText = await page.getByTestId('fallback-copy-text').textContent()
      expect(fallbackText).toBe('This copy should fail')
    })
  })

  test.describe('Keyboard Shortcuts and Accessibility', () => {
    test('should support keyboard shortcuts for copy operations', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `KeyboardCopy-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Keyboard copy test')
      await projectsPage.openProject(testProjectName)

      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Keyboard Test')
      await page.getByTestId('prompt-content-textarea').fill('Content for keyboard copy test')
      await page.getByTestId('save-prompt').click()

      // Focus on prompt and use keyboard shortcut
      await page.getByTestId('prompt-Keyboard Test').focus()
      await page.keyboard.press('Meta+Shift+C') // Custom copy shortcut

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify content was copied
      await page.getByTestId('test-paste-area').click()
      await page.keyboard.press('Meta+V')

      const pastedContent = await page.getByTestId('test-paste-area').inputValue()
      expect(pastedContent).toBe('Content for keyboard copy test')
    })

    test('should be accessible with screen readers', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `AccessibleCopy-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Accessibility test')
      await projectsPage.openProject(testProjectName)

      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Accessible Test')
      await page.getByTestId('prompt-content-textarea').fill('Accessible copy content')
      await page.getByTestId('save-prompt').click()

      const copyButton = page.getByTestId('copy-prompt-content')

      // Verify accessibility attributes
      await expect(copyButton).toHaveAttribute('aria-label', /copy.*clipboard/i)
      await expect(copyButton).toHaveAttribute('role', 'button')

      // Verify keyboard navigation
      await copyButton.focus()
      await page.keyboard.press('Enter')

      await expect(page.getByTestId('copy-success-notification')).toBeVisible()

      // Verify screen reader announcement
      const srAnnouncement = page.getByRole('status').or(page.getByRole('alert'))
      await expect(srAnnouncement).toHaveText(/copied.*clipboard/i)
    })

    test('should provide copy status updates for assistive technology', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CopyStatus-${Date.now()}`

      await projectsPage.createProject(testProjectName, 'Copy status test')
      await projectsPage.openProject(testProjectName)

      await page.getByTestId('add-prompt-button').click()
      await page.getByTestId('prompt-name-input').fill('Status Test')
      await page.getByTestId('prompt-content-textarea').fill('Status update content')
      await page.getByTestId('save-prompt').click()

      // Monitor ARIA live regions
      const liveRegion = page.getByTestId('copy-status-live-region')
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite')

      // Trigger copy and verify status updates
      await page.getByTestId('copy-prompt-content').click()

      await expect(liveRegion).toHaveText('Copying to clipboard...')
      await expect(liveRegion).toHaveText('Successfully copied to clipboard')

      // Verify final state
      await expect(page.getByTestId('copy-success-notification')).toBeVisible()
    })
  })
})
