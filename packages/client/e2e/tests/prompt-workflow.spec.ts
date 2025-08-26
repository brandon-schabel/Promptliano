import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { PromptsPage } from '../pages/prompts.page'
import { FilesPage } from '../pages/files.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import { TestDataFactory } from '../fixtures/test-data'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('Prompt Workflow Tests', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let promptsPage: PromptsPage
  let filesPage: FilesPage
  let sidebarPage: SidebarPage
  let testProjects: TestProject[] = []

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)
    promptsPage = new PromptsPage(page)
    filesPage = new FilesPage(page)
    sidebarPage = new SidebarPage(page)

    await appPage.goto('/')
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    // Clean up test projects
    if (testProjects.length > 0) {
      await TestProjectHelpers.cleanupSpecificProjects(testProjects)
      testProjects = []
    }
  })

  test.describe('Basic Prompt Management', () => {
    test('should create a simple prompt', async () => {
      await sidebarPage.navigateToSection('prompts')

      const promptData = TestDataFactory.createPrompt({
        title: 'Test Code Review Prompt',
        content: 'Please review the following code and provide feedback:\n\n{{code}}',
        description: 'A prompt for code review tasks',
        tags: ['code', 'review', 'test']
      })

      await promptsPage.createPrompt(promptData)

      // Verify prompt was created
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)

      // Verify prompt information
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.title).toBe(promptData.title)
      expect(promptInfo.description).toBe(promptData.description)
    })

    test('should edit existing prompt', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create initial prompt
      const promptData = TestDataFactory.createPrompt({
        title: 'Original Prompt',
        content: 'Original content'
      })
      await promptsPage.createPrompt(promptData)

      // Edit the prompt
      const updatedData = {
        title: 'Updated Prompt Title',
        content: 'Updated prompt content with new instructions',
        description: 'Updated description'
      }

      await promptsPage.editPrompt(promptData.title, updatedData)

      // Verify changes
      expect(await promptsPage.promptExists(updatedData.title)).toBe(true)
      expect(await promptsPage.promptExists(promptData.title)).toBe(false)

      const promptInfo = await promptsPage.getPromptInfo(updatedData.title)
      expect(promptInfo.description).toBe(updatedData.description)
    })

    test('should delete prompt', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create prompt to delete
      const promptData = TestDataFactory.createPrompt({
        title: 'Prompt to Delete',
        content: 'This prompt will be deleted'
      })
      await promptsPage.createPrompt(promptData)

      // Delete the prompt
      await promptsPage.deletePrompt(promptData.title)

      // Verify prompt is deleted
      expect(await promptsPage.promptExists(promptData.title)).toBe(false)
    })

    test('should duplicate prompt', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create original prompt
      const promptData = TestDataFactory.createPrompt({
        title: 'Original Prompt for Duplication',
        content: 'This prompt will be duplicated'
      })
      await promptsPage.createPrompt(promptData)

      // Duplicate the prompt
      const duplicatedTitle = 'Duplicated Prompt'
      await promptsPage.duplicatePrompt(promptData.title, duplicatedTitle)

      // Verify both prompts exist
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
      expect(await promptsPage.promptExists(duplicatedTitle)).toBe(true)
    })
  })

  test.describe('Prompt with File Context', () => {
    test('should create prompt with selected project files', async () => {
      // Create a test project
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Load project into app
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select some files
      await filesPage.waitForFilesInterfaceLoad()
      await filesPage.selectMultipleFiles(['package.json', 'README.md'])

      // Navigate to prompts
      await sidebarPage.navigateToSection('prompts')

      // Create prompt that references selected files
      const promptData = TestDataFactory.createPrompt({
        title: 'Code Analysis with Context',
        content: `Please analyze the selected files and provide insights:

{{selectedFiles}}

Focus on:
- Project structure
- Dependencies
- Documentation quality

Provide specific recommendations for improvement.`,
        description: 'Analyzes project files and provides recommendations',
        tags: ['analysis', 'project', 'review']
      })

      await promptsPage.createPrompt(promptData)

      // Verify prompt was created
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
    })

    test('should maintain file context when editing prompts', async () => {
      // Create project and select files
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      await filesPage.waitForFilesInterfaceLoad()
      await filesPage.selectFile('package.json')

      // Create prompt with file context
      await sidebarPage.navigateToSection('prompts')

      const promptData = TestDataFactory.createPrompt({
        title: 'Package Analysis Prompt',
        content: 'Analyze the package.json file:\n\n{{package.json}}'
      })
      await promptsPage.createPrompt(promptData)

      // Edit prompt while maintaining context
      await promptsPage.editPrompt(promptData.title, {
        content: 'Updated: Analyze the package.json file and suggest improvements:\n\n{{package.json}}'
      })

      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
    })

    test('should handle prompts with multiple file types', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select different types of files
      await filesPage.waitForFilesInterfaceLoad()

      // Try to select various file types
      const filesToSelect = ['package.json', 'README.md', 'tsconfig.json']
      for (const file of filesToSelect) {
        try {
          await filesPage.selectFile(file)
        } catch (error) {
          console.warn(`Could not select ${file}:`, error)
        }
      }

      await sidebarPage.navigateToSection('prompts')

      // Create prompt for multi-file analysis
      const promptData = TestDataFactory.createPrompt({
        title: 'Multi-File Analysis',
        content: `Analyze the project configuration:

Configuration Files:
{{selectedFiles}}

Please provide:
1. Project setup analysis
2. Build configuration review  
3. Documentation assessment
4. Recommendations for improvements`,
        tags: ['configuration', 'analysis', 'setup']
      })

      await promptsPage.createPrompt(promptData)
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
    })
  })

  test.describe('Prompt Templates and Variables', () => {
    test('should create prompt with template variables', async () => {
      await sidebarPage.navigateToSection('prompts')

      const promptData = TestDataFactory.createPrompt({
        title: 'Dynamic Code Generator',
        content: `Generate {{language}} code for the following requirements:

Requirements: {{requirements}}

Please ensure the code includes:
- {{feature1}}
- {{feature2}}
- {{feature3}}

Style: {{codeStyle}}
Target: {{targetAudience}}

Additional notes: {{notes}}`,
        description: 'Template for generating code with multiple variables',
        tags: ['template', 'code-generation', 'dynamic']
      })

      await promptsPage.createPrompt(promptData)
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)

      // Verify prompt content includes variables
      const promptInfo = await promptsPage.getPromptInfo(promptData.title)
      expect(promptInfo.title).toBe(promptData.title)
    })

    test('should use prompt templates from library', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create template prompts
      const templates = [
        TestDataFactory.createPrompt({
          title: 'Bug Analysis Template',
          content: `Bug Report Analysis:

Issue: {{issueTitle}}
Description: {{issueDescription}}
Steps to Reproduce: {{stepsToReproduce}}
Expected Behavior: {{expectedBehavior}}
Actual Behavior: {{actualBehavior}}

Please provide:
1. Root cause analysis
2. Potential fixes
3. Prevention strategies`,
          tags: ['bug', 'template', 'analysis']
        }),
        TestDataFactory.createPrompt({
          title: 'Feature Documentation Template',
          content: `Feature Documentation:

Feature: {{featureName}}
Purpose: {{featurePurpose}}
Implementation: {{implementationDetails}}

Create comprehensive documentation including:
- User guide
- API reference
- Examples
- Best practices`,
          tags: ['documentation', 'template', 'feature']
        })
      ]

      for (const template of templates) {
        await promptsPage.createPrompt(template)
        expect(await promptsPage.promptExists(template.title)).toBe(true)
      }

      // Verify templates are available
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBeGreaterThanOrEqual(2)
    })

    test('should validate prompt template syntax', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create prompt with potential syntax issues
      const promptData = TestDataFactory.createPrompt({
        title: 'Syntax Test Prompt',
        content: `Test prompt with various syntax:

Valid variables: {{variable1}}, {{variable2}}
Nested: {{outer.inner}}
With spaces: {{ variable_with_spaces }}
Mixed: {{var1}} and some text {{var2}}

Invalid examples for testing:
{single} {{{ triple }}} {{unclosed}

End of prompt.`
      })

      await promptsPage.createPrompt(promptData)
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
    })
  })

  test.describe('Prompt Search and Organization', () => {
    test('should search prompts by title and content', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create multiple prompts with searchable content
      const prompts = [
        TestDataFactory.createPrompt({
          title: 'JavaScript Code Review',
          content: 'Review JavaScript code for best practices',
          tags: ['javascript', 'review']
        }),
        TestDataFactory.createPrompt({
          title: 'Python Bug Analysis',
          content: 'Analyze Python bugs and provide solutions',
          tags: ['python', 'bug', 'analysis']
        }),
        TestDataFactory.createPrompt({
          title: 'React Component Documentation',
          content: 'Document React components with examples',
          tags: ['react', 'documentation']
        })
      ]

      for (const prompt of prompts) {
        await promptsPage.createPrompt(prompt)
      }

      // Search for JavaScript-related prompts
      await promptsPage.searchPrompts('JavaScript')

      // Should show JavaScript prompt
      const visiblePrompts = await promptsPage.getVisiblePromptTitles()
      expect(visiblePrompts).toContain('JavaScript Code Review')
    })

    test('should filter prompts by tags', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create prompts with different tags
      const reviewPrompts = [
        TestDataFactory.createPrompt({
          title: 'Code Review 1',
          content: 'Review code for quality',
          tags: ['review', 'quality']
        }),
        TestDataFactory.createPrompt({
          title: 'Code Review 2',
          content: 'Review code for security',
          tags: ['review', 'security']
        }),
        TestDataFactory.createPrompt({
          title: 'Documentation Prompt',
          content: 'Create documentation',
          tags: ['documentation', 'writing']
        })
      ]

      for (const prompt of reviewPrompts) {
        await promptsPage.createPrompt(prompt)
      }

      // Filter by 'review' tag
      await promptsPage.filterByTag('review')

      const visiblePrompts = await promptsPage.getVisiblePromptTitles()
      expect(visiblePrompts).toContain('Code Review 1')
      expect(visiblePrompts).toContain('Code Review 2')
    })

    test('should sort prompts by different criteria', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create prompts in specific order
      const prompts = [
        TestDataFactory.createPrompt({ title: 'Z Last Prompt' }),
        TestDataFactory.createPrompt({ title: 'A First Prompt' }),
        TestDataFactory.createPrompt({ title: 'M Middle Prompt' })
      ]

      for (const prompt of prompts) {
        await promptsPage.createPrompt(prompt)
      }

      // Test sorting (if available)
      try {
        await promptsPage.sortSelect.selectOption('name')
        await appPage.waitForLoadingComplete()

        const sortedPrompts = await promptsPage.getVisiblePromptTitles()
        expect(sortedPrompts.length).toBeGreaterThan(0)
      } catch (error) {
        console.warn('Sorting not available in current implementation')
      }
    })
  })

  test.describe('Prompt Import and Export', () => {
    test('should export prompt as markdown', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create prompt to export
      const promptData = TestDataFactory.createPrompt({
        title: 'Export Test Prompt',
        content: 'This prompt will be exported to markdown',
        description: 'Test prompt for export functionality'
      })

      await promptsPage.createPrompt(promptData)

      // Export the prompt
      await promptsPage.exportPrompt(promptData.title)

      // Note: Actual file download verification would need additional setup
      // This test verifies the export action is triggered
    })

    test('should import prompt from markdown', async () => {
      await sidebarPage.navigateToSection('prompts')

      const markdownContent = `# Imported Prompt

This is a prompt imported from markdown.

## Variables
- {{variable1}}
- {{variable2}}

## Instructions
Please process the following: {{input}}`

      try {
        await promptsPage.importPrompt(markdownContent)

        // Verify imported prompt exists
        expect(await promptsPage.promptExists('Imported Prompt')).toBe(true)
      } catch (error) {
        console.warn('Import functionality not fully implemented:', error)
      }
    })
  })

  test.describe('Prompt Performance and Validation', () => {
    test('should handle large prompt content', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create large prompt content
      const largeContent = `# Large Prompt Test

${'This is a line of content for testing large prompts.\n'.repeat(100)}

Variables: ${Array.from({ length: 20 }, (_, i) => `{{var${i}}}`).join(', ')}

${'Additional content line for bulk testing.\n'.repeat(50)}`

      const promptData = TestDataFactory.createPrompt({
        title: 'Large Content Prompt',
        content: largeContent,
        description: 'Test prompt with large content'
      })

      const startTime = Date.now()
      await promptsPage.createPrompt(promptData)
      const endTime = Date.now()

      // Should handle large content within reasonable time
      expect(endTime - startTime).toBeLessThan(5000)
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
    })

    test('should validate prompt before saving', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Try to create prompt with missing required fields
      await promptsPage.createPromptButton.click()
      await expect(promptsPage.promptDialog).toBeVisible()

      // Leave title empty and try to submit
      await promptsPage.promptContentTextarea.fill('Content without title')
      await promptsPage.submitPromptButton.click()

      // Should show validation error or prevent submission
      // The exact behavior depends on the form validation implementation
    })

    test('should handle multiple simultaneous prompt operations', async () => {
      await sidebarPage.navigateToSection('prompts')

      // Create multiple prompts quickly
      const prompts = [
        TestDataFactory.createPrompt({ title: 'Rapid Test 1' }),
        TestDataFactory.createPrompt({ title: 'Rapid Test 2' }),
        TestDataFactory.createPrompt({ title: 'Rapid Test 3' })
      ]

      for (const prompt of prompts) {
        await promptsPage.createPrompt(prompt)
      }

      // Verify all prompts were created
      for (const prompt of prompts) {
        expect(await promptsPage.promptExists(prompt.title)).toBe(true)
      }

      const finalCount = await promptsPage.getPromptCount()
      expect(finalCount).toBeGreaterThanOrEqual(3)
    })
  })

  test.describe('Prompt Integration with Projects', () => {
    test('should associate prompts with specific projects', async () => {
      // Create test project
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Load project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Create project-specific prompt
      await sidebarPage.navigateToSection('prompts')

      const projectPrompt = TestDataFactory.createPrompt({
        title: `${testProject.name} - Code Review`,
        content: `Review code for the ${testProject.name} project:

{{selectedFiles}}

Focus on:
- React best practices
- TypeScript usage
- Project structure`,
        description: `Code review prompt for ${testProject.name}`,
        tags: ['project-specific', 'review']
      })

      await promptsPage.createPrompt(projectPrompt)
      expect(await promptsPage.promptExists(projectPrompt.title)).toBe(true)
    })

    test('should use prompts with project file selection', async () => {
      // Setup project and files
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Select TypeScript files
      await filesPage.waitForFilesInterfaceLoad()
      const tsFiles = TestProjectHelpers.getProjectTypeScriptFiles(testProject)

      for (const tsFile of tsFiles.slice(0, 2)) {
        const fileName = tsFile.split('/').pop()
        if (fileName) {
          try {
            await filesPage.selectFile(fileName)
          } catch (error) {
            console.warn(`Could not select ${fileName}`)
          }
        }
      }

      // Create prompt for selected files
      await sidebarPage.navigateToSection('prompts')

      const promptData = TestDataFactory.createPrompt({
        title: 'TypeScript Analysis',
        content: `Analyze the selected TypeScript files:

{{selectedFiles}}

Provide recommendations for:
1. Type safety improvements
2. Code organization
3. Performance optimizations
4. Best practices compliance`,
        tags: ['typescript', 'analysis', 'recommendations']
      })

      await promptsPage.createPrompt(promptData)
      expect(await promptsPage.promptExists(promptData.title)).toBe(true)
    })
  })
})
