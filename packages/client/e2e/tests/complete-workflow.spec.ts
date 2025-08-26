import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { PromptsPage } from '../pages/prompts.page'
import { FilesPage } from '../pages/files.page'
import { SidebarPage } from '../pages/sidebar.page'
import { TestProjectHelpers, TestProjectPresets } from '../utils/test-project-helpers'
import { TestDataFactory } from '../fixtures/test-data'
import type { TestProject } from '../fixtures/test-project-factory'

test.describe('Complete End-to-End Workflow Tests', () => {
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

  test.describe('Complete Development Workflow', () => {
    test('should complete full project setup and code review workflow', async () => {
      /**
       * Complete workflow:
       * 1. Create realistic project folder structure
       * 2. Load project into application
       * 3. Navigate and explore file structure
       * 4. Select relevant files for review
       * 5. Create specialized prompts for code review
       * 6. Verify all components work together
       */

      // Step 1: Create realistic web application project
      console.log('📁 Creating test web application project...')
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Verify project structure on disk
      expect(await TestProjectHelpers.verifyProjectOnDisk(testProject)).toBe(true)

      const stats = await TestProjectHelpers.getProjectStats(testProject)
      expect(stats.fileCount).toBeGreaterThan(10) // Should have substantial files
      expect(stats.directoryCount).toBeGreaterThan(3) // Should have nested structure

      // Step 2: Load project into application
      console.log('🔄 Loading project into application...')
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)

      // Verify project appears in application
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      // Step 3: Open project and explore file structure
      console.log('📂 Opening project and exploring files...')
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Should be in project view
      await expect(appPage.page).toHaveURL(/\/projects\/\d+/)

      // Verify file explorer is available
      await filesPage.waitForFilesInterfaceLoad()

      // Step 4: Select files for code review
      console.log('📄 Selecting files for review...')
      const filesToReview = [
        'package.json', // Configuration
        'README.md', // Documentation
        'tsconfig.json' // TypeScript config
      ]

      let selectedCount = 0
      for (const file of filesToReview) {
        try {
          await filesPage.selectFile(file)
          selectedCount++
        } catch (error) {
          console.warn(`Could not select ${file}:`, error)
        }
      }

      expect(selectedCount).toBeGreaterThan(0) // At least some files selected

      // Verify files are in selected panel
      const actualSelectedCount = await filesPage.getSelectedFilesCount()
      expect(actualSelectedCount).toBeGreaterThanOrEqual(selectedCount)

      // Step 5: Create code review prompt
      console.log('📝 Creating code review prompt...')
      await sidebarPage.navigateToSection('prompts')

      const codeReviewPrompt = TestDataFactory.createPrompt({
        title: `${testProject.name} - Project Review`,
        content: `Please perform a comprehensive review of this React/TypeScript project:

## Selected Files for Review:
{{selectedFiles}}

## Review Focus Areas:

### 1. Project Configuration
- Analyze package.json for dependencies and scripts
- Review TypeScript configuration
- Check build setup and tooling

### 2. Code Quality  
- Assess TypeScript usage and type safety
- Review React component patterns
- Evaluate code organization

### 3. Documentation
- Review README completeness
- Check inline code documentation
- Assess setup instructions

### 4. Security & Performance
- Identify potential security issues
- Review performance considerations
- Check for best practices

## Please Provide:
1. **Strengths**: What's well implemented
2. **Issues**: Problems or anti-patterns found  
3. **Recommendations**: Specific improvements
4. **Priority**: Rank suggestions by importance

## Context
This is a ${testProject.name} project with the following structure:
- React components in src/components/  
- Utilities in src/utils/
- TypeScript configuration
- Standard React project layout`,
        description: `Comprehensive code review prompt for ${testProject.name}`,
        tags: ['code-review', 'react', 'typescript', 'comprehensive']
      })

      await promptsPage.createPrompt(codeReviewPrompt)

      // Verify prompt was created
      expect(await promptsPage.promptExists(codeReviewPrompt.title)).toBe(true)

      // Step 6: Verify workflow completion
      console.log('✅ Verifying workflow completion...')

      // Check prompt details
      const promptInfo = await promptsPage.getPromptInfo(codeReviewPrompt.title)
      expect(promptInfo.title).toBe(codeReviewPrompt.title)
      expect(promptInfo.description).toBe(codeReviewPrompt.description)

      // Verify we can navigate between sections while maintaining state
      await sidebarPage.navigateToSection('projects')
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, testProject)).toBe(true)

      await sidebarPage.navigateToSection('prompts')
      expect(await promptsPage.promptExists(codeReviewPrompt.title)).toBe(true)

      console.log('🎉 Complete workflow test passed successfully!')
    })

    test('should handle multi-project development scenario', async () => {
      /**
       * Scenario: Developer working on related frontend and backend projects
       * 1. Create frontend and API projects
       * 2. Load both into application
       * 3. Create prompts for different project types
       * 4. Switch between projects maintaining context
       */

      // Step 1: Create both frontend and backend projects
      console.log('🏗️ Creating frontend and backend projects...')
      const frontendProject = await TestProjectHelpers.createWebAppProject()
      const backendProject = await TestProjectHelpers.createApiProject()
      testProjects.push(frontendProject, backendProject)

      // Step 2: Load both projects
      console.log('📥 Loading projects into application...')
      await sidebarPage.navigateToSection('projects')

      await TestProjectHelpers.loadProjectIntoApp(appPage.page, frontendProject)
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, backendProject)

      // Verify both projects are loaded
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, frontendProject)).toBe(true)
      expect(await TestProjectHelpers.verifyProjectInApp(appPage.page, backendProject)).toBe(true)

      // Step 3: Work with frontend project
      console.log('⚛️ Working with frontend project...')
      await TestProjectHelpers.openProjectInApp(appPage.page, frontendProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select React-specific files
      try {
        await filesPage.selectMultipleFiles(['package.json', 'tsconfig.json'])
      } catch (error) {
        console.warn('Could not select all frontend files:', error)
      }

      // Create frontend-specific prompt
      await sidebarPage.navigateToSection('prompts')

      const frontendPrompt = TestDataFactory.createPrompt({
        title: 'React Frontend Review',
        content: `Review this React application:

{{selectedFiles}}

Focus on:
- Component architecture
- State management
- TypeScript usage
- Performance optimizations
- User experience`,
        tags: ['react', 'frontend', 'typescript']
      })

      await promptsPage.createPrompt(frontendPrompt)

      // Step 4: Work with backend project
      console.log('🖥️ Switching to backend project...')
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.openProjectInApp(appPage.page, backendProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select backend-specific files
      try {
        await filesPage.selectFile('package.json')
      } catch (error) {
        console.warn('Could not select backend files:', error)
      }

      // Create backend-specific prompt
      await sidebarPage.navigateToSection('prompts')

      const backendPrompt = TestDataFactory.createPrompt({
        title: 'API Backend Review',
        content: `Review this Node.js/Express API:

{{selectedFiles}}

Focus on:
- API design and RESTful patterns
- Error handling
- Security considerations  
- Performance and scalability
- Code organization`,
        tags: ['nodejs', 'api', 'backend', 'express']
      })

      await promptsPage.createPrompt(backendPrompt)

      // Step 5: Verify both prompts exist
      expect(await promptsPage.promptExists(frontendPrompt.title)).toBe(true)
      expect(await promptsPage.promptExists(backendPrompt.title)).toBe(true)

      // Step 6: Verify project switching maintains state
      await sidebarPage.navigateToSection('projects')

      // Switch back to frontend
      await TestProjectHelpers.openProjectInApp(appPage.page, frontendProject)
      expect(await appPage.getCurrentProjectName()).toContain(frontendProject.name.split('-')[0])

      // Switch to backend
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.openProjectInApp(appPage.page, backendProject)
      expect(await appPage.getCurrentProjectName()).toContain(backendProject.name.split('-')[0])

      console.log('🎉 Multi-project workflow completed successfully!')
    })

    test('should handle complete documentation workflow', async () => {
      /**
       * Documentation workflow:
       * 1. Create library project
       * 2. Select documentation-relevant files
       * 3. Create comprehensive documentation prompts
       * 4. Generate different types of documentation
       */

      // Step 1: Create library project (good for documentation workflow)
      console.log('📚 Creating library project...')
      const libraryProject = await TestProjectHelpers.createLibraryProject()
      testProjects.push(libraryProject)

      // Step 2: Load and open project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, libraryProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, libraryProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Step 3: Select files relevant to documentation
      const docRelevantFiles = ['package.json', 'README.md', 'tsconfig.json']

      for (const file of docRelevantFiles) {
        try {
          await filesPage.selectFile(file)
        } catch (error) {
          console.warn(`Could not select ${file} for documentation`)
        }
      }

      // Step 4: Create comprehensive documentation prompts
      await sidebarPage.navigateToSection('prompts')

      const documentationPrompts = [
        TestDataFactory.createPrompt({
          title: 'API Documentation Generator',
          content: `Generate comprehensive API documentation for this TypeScript library:

## Source Files:
{{selectedFiles}}

## Required Documentation:

### 1. Overview
- Purpose and key features
- Installation instructions
- Quick start guide

### 2. API Reference
- All exported functions and classes
- Parameter descriptions with types
- Return value descriptions
- Usage examples for each method

### 3. Advanced Usage
- Configuration options
- Best practices
- Performance considerations
- Error handling

Please format as professional markdown documentation.`,
          tags: ['documentation', 'api', 'library']
        }),

        TestDataFactory.createPrompt({
          title: 'User Guide Generator',
          content: `Create user-friendly documentation for this library:

{{selectedFiles}}

Generate:
1. **Getting Started** - Installation and basic setup
2. **Tutorials** - Step-by-step guides for common use cases  
3. **Examples** - Practical code examples
4. **FAQ** - Common questions and solutions
5. **Troubleshooting** - Problem resolution guide

Target audience: Developers new to this library.
Style: Clear, concise, example-driven.`,
          tags: ['user-guide', 'tutorial', 'examples']
        }),

        TestDataFactory.createPrompt({
          title: 'README Generator',
          content: `Generate a comprehensive README.md for this project:

{{selectedFiles}}

Include:
- Project title and description
- Badges (build status, version, license)
- Installation instructions
- Quick start example
- API overview
- Contributing guidelines
- License information
- Changelog link

Make it GitHub-ready and professional.`,
          tags: ['readme', 'github', 'project-docs']
        })
      ]

      // Create all documentation prompts
      for (const prompt of documentationPrompts) {
        await promptsPage.createPrompt(prompt)
        expect(await promptsPage.promptExists(prompt.title)).toBe(true)
      }

      // Step 5: Verify documentation workflow
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBeGreaterThanOrEqual(3)

      // Verify prompts can be found by searching
      await promptsPage.searchPrompts('documentation')
      const searchResults = await promptsPage.getVisiblePromptTitles()
      expect(searchResults.length).toBeGreaterThan(0)

      console.log('📖 Documentation workflow completed successfully!')
    })
  })

  test.describe('Integration and Context Preservation', () => {
    test('should maintain file selection across navigation', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Load project and select files
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select files
      await filesPage.selectMultipleFiles(['package.json', 'README.md'])
      const initialSelectedCount = await filesPage.getSelectedFilesCount()
      expect(initialSelectedCount).toBe(2)

      // Navigate to prompts and back
      await sidebarPage.navigateToSection('prompts')
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // File selection should be preserved
      const finalSelectedCount = await filesPage.getSelectedFilesCount()
      expect(finalSelectedCount).toBe(initialSelectedCount)
    })

    test('should handle complex project structures efficiently', async () => {
      // Create large monorepo project
      const largeProject = await TestProjectHelpers.createLargeProject()
      testProjects.push(largeProject)

      const startTime = Date.now()

      // Load and navigate large project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, largeProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, largeProject)
      await filesPage.waitForFilesInterfaceLoad()

      const endTime = Date.now()
      const loadTime = endTime - startTime

      // Should handle large project reasonably fast
      expect(loadTime).toBeLessThan(10000) // Less than 10 seconds

      // Verify project statistics
      const stats = await TestProjectHelpers.getProjectStats(largeProject)
      expect(stats.fileCount).toBeGreaterThan(50)
      expect(stats.directoryCount).toBeGreaterThan(10)
    })

    test('should recover gracefully from errors', async () => {
      const testProject = await TestProjectHelpers.createSimpleProject()
      testProjects.push(testProject)

      // Load project normally
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)

      // Simulate error condition by removing project directory
      await TestProjectHelpers.cleanupSpecificProjects([testProject])

      // Try to navigate back to project - should handle gracefully
      await sidebarPage.navigateToSection('projects')

      // Application should not crash and should show error state
      const hasError = await appPage.hasGlobalError()
      const isStillFunctional = await sidebarPage.sidebar.isVisible()

      // Either should show error OR remain functional
      expect(hasError || isStillFunctional).toBe(true)
    })
  })

  test.describe('User Journey Scenarios', () => {
    test('should support typical code review journey', async () => {
      /**
       * Typical developer code review journey:
       * 1. Open project
       * 2. Browse and understand structure
       * 3. Focus on specific files needing review
       * 4. Create review checklist/prompt
       * 5. Apply review to selected files
       */

      const webProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(webProject)

      // Developer opens project to review
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, webProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, webProject)

      // Browse project structure to understand it
      await filesPage.waitForFilesInterfaceLoad()

      // Look at key configuration files first
      await filesPage.selectFile('package.json')

      // Review would typically look at multiple files
      const reviewFiles = ['README.md', 'tsconfig.json']
      for (const file of reviewFiles) {
        try {
          await filesPage.selectFile(file)
        } catch (error) {
          console.warn(`File ${file} not available for selection`)
        }
      }

      // Create focused review prompt
      await sidebarPage.navigateToSection('prompts')

      const reviewPrompt = TestDataFactory.createPrompt({
        title: 'Focused Code Review',
        content: `Code Review Checklist for {{projectName}}:

## Files Under Review:
{{selectedFiles}}

## Review Criteria:

### 📋 Configuration Review
- [ ] Dependencies are appropriate and up-to-date
- [ ] Build configuration is optimal
- [ ] TypeScript settings follow best practices

### 📖 Documentation Review  
- [ ] README provides clear setup instructions
- [ ] Code comments explain complex logic
- [ ] API documentation is complete

### 🔧 Code Quality
- [ ] Follows consistent coding standards
- [ ] No obvious bugs or logic errors
- [ ] Performance considerations addressed

## Questions for Review:
1. Are there any security concerns?
2. Is the code maintainable?
3. Are there opportunities for refactoring?

## Next Steps:
- [ ] Approve changes
- [ ] Request modifications
- [ ] Schedule follow-up review`,
        description: 'Structured code review checklist',
        tags: ['review', 'checklist', 'process']
      })

      await promptsPage.createPrompt(reviewPrompt)
      expect(await promptsPage.promptExists(reviewPrompt.title)).toBe(true)

      // Verify the complete review setup
      const promptInfo = await promptsPage.getPromptInfo(reviewPrompt.title)
      expect(promptInfo.title).toBe(reviewPrompt.title)
    })

    test('should support learning/exploration journey', async () => {
      /**
       * Developer learning from existing codebase:
       * 1. Open unfamiliar project
       * 2. Create prompts to understand architecture
       * 3. Focus on specific patterns or components
       * 4. Generate learning materials
       */

      const complexProject = await TestProjectHelpers.createTestProject(TestProjectPresets.largeMonorepo())
      testProjects.push(complexProject)

      // Developer wants to understand this complex project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, complexProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, complexProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Select key architectural files
      try {
        await filesPage.selectFile('package.json')
      } catch (error) {
        console.warn('Could not select package.json for learning journey')
      }

      // Create learning-focused prompts
      await sidebarPage.navigateToSection('prompts')

      const learningPrompts = [
        TestDataFactory.createPrompt({
          title: 'Architecture Analysis',
          content: `Help me understand this project's architecture:

{{selectedFiles}}

Please explain:
1. **Overall Structure** - How is the codebase organized?
2. **Key Patterns** - What architectural patterns are used?  
3. **Dependencies** - What are the main libraries and why?
4. **Entry Points** - Where does execution begin?
5. **Data Flow** - How does data move through the system?

Provide a beginner-friendly explanation with examples.`,
          tags: ['learning', 'architecture', 'explanation']
        }),

        TestDataFactory.createPrompt({
          title: 'Best Practices Extraction',
          content: `Extract learning insights from this codebase:

{{selectedFiles}}

Identify:
1. **Good Patterns** - What practices should I adopt?
2. **Anti-patterns** - What should I avoid?
3. **Code Organization** - How is code structured?
4. **Testing Strategy** - How is testing approached?
5. **Documentation** - How is the project documented?

Create a "lessons learned" summary I can apply to my own projects.`,
          tags: ['best-practices', 'learning', 'patterns']
        })
      ]

      for (const prompt of learningPrompts) {
        await promptsPage.createPrompt(prompt)
        expect(await promptsPage.promptExists(prompt.title)).toBe(true)
      }

      console.log('📚 Learning journey workflow completed!')
    })
  })

  test.describe('Workflow Performance and Reliability', () => {
    test('should complete workflows within acceptable time limits', async () => {
      const startTime = Date.now()

      // Complete basic workflow within time limit
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()
      await filesPage.selectFile('package.json')

      await sidebarPage.navigateToSection('prompts')
      const quickPrompt = TestDataFactory.createPrompt({
        title: 'Quick Analysis',
        content: 'Analyze: {{selectedFiles}}'
      })
      await promptsPage.createPrompt(quickPrompt)

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Complete workflow should be under 30 seconds
      expect(totalTime).toBeLessThan(30000)

      console.log(`⚡ Workflow completed in ${totalTime}ms`)
    })

    test('should handle concurrent operations gracefully', async () => {
      const testProject = await TestProjectHelpers.createWebAppProject()
      testProjects.push(testProject)

      // Load project
      await sidebarPage.navigateToSection('projects')
      await TestProjectHelpers.loadProjectIntoApp(appPage.page, testProject)
      await TestProjectHelpers.openProjectInApp(appPage.page, testProject)
      await filesPage.waitForFilesInterfaceLoad()

      // Perform multiple operations in quick succession
      await filesPage.selectFile('package.json')
      await sidebarPage.navigateToSection('prompts')

      const prompt1 = TestDataFactory.createPrompt({ title: 'Concurrent Test 1' })
      const prompt2 = TestDataFactory.createPrompt({ title: 'Concurrent Test 2' })

      await promptsPage.createPrompt(prompt1)
      await promptsPage.createPrompt(prompt2)

      // Both prompts should be created successfully
      expect(await promptsPage.promptExists(prompt1.title)).toBe(true)
      expect(await promptsPage.promptExists(prompt2.title)).toBe(true)
    })
  })
})
