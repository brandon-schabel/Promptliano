# Manage Project Modal Comprehensive Test Plan

## Overview
The Manage Project Modal is the project management interface accessible via the bottom-left button in Promptliano. It provides project discovery, creation, import, and management capabilities through a modal interface. This test plan covers project listing, creation workflow, file browser integration, and project synchronization processes.

## Test Scope & Requirements

### Major Components
1. **Modal Trigger** - Bottom-left button accessibility and modal opening
2. **Project List Display** - Existing projects with metadata and actions
3. **Project Creation** - New project form with validation and browser integration
4. **File Browser Integration** - Client-side directory selection and navigation
5. **Project Import** - Directory scanning, file indexing, and project setup
6. **Project Management** - Edit, delete, archive operations on existing projects

### Technical Integration Points
- **File System Access**: Client-side file browser for directory selection
- **Project Synchronization**: File scanning, indexing, and database updates
- **Modal Management**: Focus handling, keyboard navigation, and accessibility
- **Real-time Updates**: Project status updates during import/sync operations
- **Error Handling**: File access permissions, invalid directories, sync failures

## Test Data Requirements

### Shared Test Data Setup
```typescript
// Location: e2e/fixtures/manage-project-modal-data.ts
export const ManageProjectModalTestData = {
  // Existing projects for testing
  existingProjects: [
    {
      id: 1,
      name: 'Promptliano Core',
      path: '/Users/developer/projects/promptliano',
      description: 'Core Promptliano application development',
      createdAt: '2024-01-15T10:00:00Z',
      lastAccessed: '2024-01-20T14:30:00Z',
      fileCount: 245,
      status: 'active'
    },
    {
      id: 2,
      name: 'E-Commerce App',
      path: '/Users/developer/projects/ecommerce-app',
      description: 'React-based e-commerce platform',
      createdAt: '2024-01-10T09:15:00Z',
      lastAccessed: '2024-01-18T16:45:00Z',
      fileCount: 156,
      status: 'active'
    },
    {
      id: 3,
      name: 'Legacy API',
      path: '/Users/developer/old-projects/legacy-api',
      description: 'Legacy Node.js API (needs migration)',
      createdAt: '2023-12-01T11:20:00Z',
      lastAccessed: '2023-12-15T09:30:00Z',
      fileCount: 89,
      status: 'archived'
    }
  ],

  // New project test data
  newProjectData: {
    valid: {
      name: 'New Test Project',
      path: '/tmp/test-projects/new-project',
      description: 'A test project for E2E testing'
    },
    validMinimal: {
      name: 'Minimal Project',
      path: '/tmp/test-projects/minimal'
    },
    invalid: {
      emptyName: {
        name: '',
        path: '/tmp/test-projects/empty-name',
        description: 'Project with empty name'
      },
      emptyPath: {
        name: 'No Path Project',
        path: '',
        description: 'Project with no path'
      },
      invalidPath: {
        name: 'Invalid Path Project', 
        path: '/nonexistent/invalid/path',
        description: 'Project with invalid path'
      },
      duplicateName: {
        name: 'Promptliano Core', // Same as existing project
        path: '/tmp/test-projects/duplicate',
        description: 'Duplicate project name'
      }
    }
  },

  // Mock file system structure for testing
  mockDirectoryStructure: {
    '/tmp/test-projects': {
      type: 'directory',
      children: {
        'project-a': {
          type: 'directory',
          children: {
            'src': {
              type: 'directory',
              children: {
                'main.js': { type: 'file', size: 1024 },
                'utils.js': { type: 'file', size: 512 }
              }
            },
            'package.json': { type: 'file', size: 256 },
            'README.md': { type: 'file', size: 128 }
          }
        },
        'project-b': {
          type: 'directory',
          children: {
            'index.html': { type: 'file', size: 2048 },
            'styles.css': { type: 'file', size: 1536 }
          }
        },
        'empty-folder': {
          type: 'directory',
          children: {}
        }
      }
    },
    '/Users': {
      type: 'directory',
      children: {
        'developer': {
          type: 'directory',
          children: {
            'Documents': { type: 'directory', children: {} },
            'Projects': { type: 'directory', children: {} },
            'Desktop': { type: 'directory', children: {} }
          }
        }
      }
    }
  },

  // File browser test scenarios
  fileBrowserScenarios: [
    {
      name: 'navigate to nested directory',
      startPath: '/',
      navigationPath: ['Users', 'developer', 'Documents'],
      expectedPath: '/Users/developer/Documents'
    },
    {
      name: 'select project directory with files',
      startPath: '/tmp/test-projects',
      navigationPath: ['project-a'],
      expectedPath: '/tmp/test-projects/project-a',
      expectedFiles: ['package.json', 'README.md'],
      expectedFolders: ['src']
    },
    {
      name: 'handle empty directory',
      startPath: '/tmp/test-projects',
      navigationPath: ['empty-folder'],
      expectedPath: '/tmp/test-projects/empty-folder',
      expectedFiles: [],
      expectedFolders: []
    }
  ]
}
```

## Page Object Model Extensions

### ManageProjectModal Class Implementation
```typescript
// Location: e2e/pages/manage-project-modal.ts
export class ManageProjectModal extends BasePage {
  // Modal trigger and container
  get modalTriggerButton() {
    return this.page.getByTestId('manage-projects-button')
  }

  get modal() {
    return this.page.getByTestId('manage-project-modal')
  }

  get modalHeader() {
    return this.modal.getByTestId('modal-header')
  }

  get modalTitle() {
    return this.modal.getByRole('heading', { name: /manage.*projects|projects/i })
  }

  get closeButton() {
    return this.modal.getByRole('button', { name: /close|×/ })
  }

  // Project list elements
  get projectList() {
    return this.modal.getByTestId('project-list')
  }

  get projectItems() {
    return this.projectList.getByTestId('project-item')
  }

  get emptyState() {
    return this.modal.getByTestId('no-projects-state')
  }

  projectItem(projectName: string) {
    return this.projectList.getByTestId('project-item').filter({ hasText: projectName })
  }

  getProjectName(projectName: string) {
    return this.projectItem(projectName).getByTestId('project-name')
  }

  getProjectPath(projectName: string) {
    return this.projectItem(projectName).getByTestId('project-path')
  }

  getProjectDescription(projectName: string) {
    return this.projectItem(projectName).getByTestId('project-description')
  }

  getProjectMetadata(projectName: string) {
    return this.projectItem(projectName).getByTestId('project-metadata')
  }

  getProjectActions(projectName: string) {
    return this.projectItem(projectName).getByTestId('project-actions')
  }

  // Project actions
  getOpenProjectButton(projectName: string) {
    return this.getProjectActions(projectName).getByRole('button', { name: /open|select/i })
  }

  getEditProjectButton(projectName: string) {
    return this.getProjectActions(projectName).getByRole('button', { name: /edit/i })
  }

  getDeleteProjectButton(projectName: string) {
    return this.getProjectActions(projectName).getByRole('button', { name: /delete|remove/i })
  }

  // Add new project elements
  get addProjectButton() {
    return this.modal.getByTestId('add-project-button')
  }

  get createProjectForm() {
    return this.modal.getByTestId('create-project-form')
  }

  get projectNameInput() {
    return this.createProjectForm.getByTestId('project-name-input')
  }

  get projectPathInput() {
    return this.createProjectForm.getByTestId('project-path-input')
  }

  get projectDescriptionInput() {
    return this.createProjectForm.getByTestId('project-description-input')
  }

  get browseDirectoryButton() {
    return this.createProjectForm.getByTestId('browse-directory-button')
  }

  get createProjectButton() {
    return this.createProjectForm.getByRole('button', { name: /create.*project|create/i })
  }

  get cancelCreateButton() {
    return this.createProjectForm.getByRole('button', { name: /cancel/i })
  }

  // File browser elements
  get fileBrowser() {
    return this.page.getByTestId('file-browser-dialog')
  }

  get fileBrowserHeader() {
    return this.fileBrowser.getByTestId('file-browser-header')
  }

  get currentPathDisplay() {
    return this.fileBrowser.getByTestId('current-path')
  }

  get parentDirectoryButton() {
    return this.fileBrowser.getByRole('button', { name: /parent|up|\.\./ })
  }

  get directoryList() {
    return this.fileBrowser.getByTestId('directory-list')
  }

  get directoryItems() {
    return this.directoryList.getByTestId('directory-item')
  }

  get fileItems() {
    return this.directoryList.getByTestId('file-item')
  }

  getDirectoryItem(name: string) {
    return this.directoryList.getByTestId('directory-item').filter({ hasText: name })
  }

  get selectDirectoryButton() {
    return this.fileBrowser.getByRole('button', { name: /select.*directory|select/i })
  }

  get cancelBrowseButton() {
    return this.fileBrowser.getByRole('button', { name: /cancel/i })
  }

  // Project sync and status
  get syncStatus() {
    return this.modal.getByTestId('sync-status')
  }

  get syncProgress() {
    return this.modal.getByTestId('sync-progress')
  }

  get syncMessage() {
    return this.modal.getByTestId('sync-message')
  }

  // Validation and error messages
  get validationErrors() {
    return this.createProjectForm.getByTestId('validation-error')
  }

  get errorMessage() {
    return this.modal.getByTestId('error-message')
  }

  // Helper methods
  async openModal() {
    await this.modalTriggerButton.click()
    await expect(this.modal).toBeVisible()
    await expect(this.modalTitle).toBeVisible()
  }

  async closeModal() {
    await this.closeButton.click()
    await expect(this.modal).not.toBeVisible()
  }

  async openCreateProjectForm() {
    await this.addProjectButton.click()
    await expect(this.createProjectForm).toBeVisible()
  }

  async fillProjectForm(projectData: { name: string; path?: string; description?: string }) {
    await this.projectNameInput.fill(projectData.name)
    
    if (projectData.path) {
      await this.projectPathInput.fill(projectData.path)
    }
    
    if (projectData.description) {
      await this.projectDescriptionInput.fill(projectData.description)
    }
  }

  async browseFolderAndSelect(targetPath: string) {
    await this.browseDirectoryButton.click()
    await expect(this.fileBrowser).toBeVisible()

    // Navigate to target path (simplified - would need actual navigation logic)
    const pathParts = targetPath.split('/').filter(Boolean)
    
    for (const part of pathParts) {
      if (part === '..') {
        await this.parentDirectoryButton.click()
      } else {
        const dirItem = this.getDirectoryItem(part)
        if (await dirItem.isVisible()) {
          await dirItem.dblclick()
        }
      }
      
      // Wait for navigation to complete
      await this.page.waitForTimeout(500)
    }

    await this.selectDirectoryButton.click()
    await expect(this.fileBrowser).not.toBeVisible()

    // Verify path was selected
    await expect(this.projectPathInput).toHaveValue(targetPath)
  }

  async createProject(projectData: { name: string; path?: string; description?: string }) {
    await this.openCreateProjectForm()
    await this.fillProjectForm(projectData)

    if (projectData.path && !await this.projectPathInput.inputValue()) {
      await this.browseFolderAndSelect(projectData.path)
    }

    await this.createProjectButton.click()
  }

  async waitForProjectSync() {
    // Wait for sync to start
    await expect(this.syncStatus).toBeVisible({ timeout: 5000 })
    
    // Wait for sync to complete
    await expect(this.syncStatus).toContainText(/complete|finished|done/i, { timeout: 30000 })
  }

  async getProjectCount(): Promise<number> {
    return await this.projectItems.count()
  }

  async selectProject(projectName: string) {
    await this.getOpenProjectButton(projectName).click()
  }

  async deleteProject(projectName: string, confirm: boolean = true) {
    await this.getDeleteProjectButton(projectName).click()
    
    // Handle confirmation dialog
    const confirmDialog = this.page.getByTestId('delete-project-confirmation')
    await expect(confirmDialog).toBeVisible()
    
    if (confirm) {
      await this.page.getByRole('button', { name: /delete|confirm/i }).click()
    } else {
      await this.page.getByRole('button', { name: /cancel/i }).click()
    }
  }
}
```

## Test Scenarios

### 1. Modal Access and Display

#### 1.1 Modal Trigger and Basic Display Tests
```typescript
test.describe('Manage Project Modal - Access and Display', () => {
  test('should open modal when bottom-left button is clicked', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')

    // Verify trigger button exists and is positioned correctly
    await expect(modalPage.modalTriggerButton).toBeVisible()
    
    // Check button positioning (should be in bottom-left area)
    const buttonBox = await modalPage.modalTriggerButton.boundingBox()
    const viewport = page.viewportSize()
    
    expect(buttonBox?.x).toBeLessThan(200) // Left side
    expect(buttonBox?.y).toBeGreaterThan((viewport?.height || 800) - 200) // Bottom area

    // Open modal
    await modalPage.openModal()

    // Verify modal elements
    await expect(modalPage.modalHeader).toBeVisible()
    await expect(modalPage.modalTitle).toContainText(/manage.*projects|projects/i)
    await expect(modalPage.closeButton).toBeVisible()
  })

  test('should display existing projects in list', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Setup test projects
    await TestDataManager.setupProjects(page, ManageProjectModalTestData.existingProjects)
    
    await modalPage.goto('/')
    await modalPage.openModal()

    // Verify project list is visible
    await expect(modalPage.projectList).toBeVisible()
    
    // Check that all test projects are displayed
    const projectCount = await modalPage.getProjectCount()
    expect(projectCount).toBe(3)

    // Verify project details for each project
    for (const project of ManageProjectModalTestData.existingProjects) {
      const projectCard = modalPage.projectItem(project.name)
      await expect(projectCard).toBeVisible()

      // Check project information
      await expect(modalPage.getProjectName(project.name)).toContainText(project.name)
      await expect(modalPage.getProjectPath(project.name)).toContainText(project.path)
      
      if (project.description) {
        await expect(modalPage.getProjectDescription(project.name)).toContainText(project.description)
      }

      // Check metadata (file count, last accessed, etc.)
      const metadata = modalPage.getProjectMetadata(project.name)
      await expect(metadata).toContainText(project.fileCount.toString())
      
      // Check action buttons
      await expect(modalPage.getOpenProjectButton(project.name)).toBeVisible()
      await expect(modalPage.getEditProjectButton(project.name)).toBeVisible()
      await expect(modalPage.getDeleteProjectButton(project.name)).toBeVisible()
    }
  })

  test('should display empty state when no projects exist', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Clear all projects
    await TestDataManager.clearAllProjects(page)
    
    await modalPage.goto('/')
    await modalPage.openModal()

    // Verify empty state
    await expect(modalPage.emptyState).toBeVisible()
    await expect(page.getByText(/no.*projects|create.*first.*project/i)).toBeVisible()

    // Add project button should still be visible
    await expect(modalPage.addProjectButton).toBeVisible()

    // Project list should not be visible
    await expect(modalPage.projectList).not.toBeVisible()
  })

  test('should close modal with close button and escape key', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    
    // Open modal
    await modalPage.openModal()

    // Close with close button
    await modalPage.closeModal()

    // Open again and close with Escape key
    await modalPage.openModal()
    await page.keyboard.press('Escape')
    await expect(modalPage.modal).not.toBeVisible()
  })

  test('should handle modal focus and accessibility', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    
    await modalPage.openModal()

    // Modal should be focused or contain focused element
    const focusedElement = page.locator(':focus')
    const modalContainsFocus = await modalPage.modal.locator(':focus').count() > 0
    
    expect(modalContainsFocus).toBe(true)

    // Should trap focus within modal (Tab navigation stays within modal)
    await page.keyboard.press('Tab')
    const afterTabFocus = await modalPage.modal.locator(':focus').count()
    expect(afterTabFocus).toBeGreaterThan(0)

    // Should have proper ARIA attributes
    await expect(modalPage.modal).toHaveAttribute('role', 'dialog')
    await expect(modalPage.modal).toHaveAttribute('aria-modal', 'true')
  })
})
```

#### 1.2 Project Selection and Navigation Tests
```typescript
test.describe('Manage Project Modal - Project Selection', () => {
  test.beforeEach(async ({ page }) => {
    await TestDataManager.setupProjects(page, ManageProjectModalTestData.existingProjects)
  })

  test('should select and open project', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Select a project
    await modalPage.selectProject('Promptliano Core')

    // Should navigate to project page
    await expect(page).toHaveURL(/.*\/projects\/\d+/)
    
    // Modal should close
    await expect(modalPage.modal).not.toBeVisible()

    // Project context should be loaded (verify project-specific elements)
    await expect(page.getByTestId('project-name')).toContainText('Promptliano Core')
  })

  test('should show project metadata correctly', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Check metadata for first project
    const coreProject = ManageProjectModalTestData.existingProjects[0]
    const metadata = modalPage.getProjectMetadata(coreProject.name)

    // Should show file count
    await expect(metadata).toContainText('245 files')

    // Should show last accessed date (format may vary)
    await expect(metadata).toContainText(/last.*accessed|accessed/i)

    // Should show creation date
    const createdText = await metadata.textContent()
    expect(createdText).toMatch(/created|added/i)

    // Should indicate project status
    await expect(metadata).toContainText(/active|archived/)
  })

  test('should handle archived projects differently', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Archived project should be visually distinct
    const archivedProject = modalPage.projectItem('Legacy API')
    await expect(archivedProject).toBeVisible()

    // Should have archived indicator
    await expect(archivedProject).toHaveClass(/archived|inactive/)
    
    // Or should show archived status in metadata
    const metadata = modalPage.getProjectMetadata('Legacy API')
    await expect(metadata).toContainText(/archived|inactive/)

    // Open button might be disabled or show different action
    const openButton = modalPage.getOpenProjectButton('Legacy API')
    const buttonText = await openButton.textContent()
    
    // Either disabled or shows "Restore" instead of "Open"
    const isDisabled = await openButton.isDisabled()
    const showsRestore = buttonText?.toLowerCase().includes('restore')
    
    expect(isDisabled || showsRestore).toBe(true)
  })

  test('should sort projects by different criteria', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Should have sort options (if implemented)
    const sortButton = modalPage.modal.getByTestId('sort-projects')
    if (await sortButton.isVisible()) {
      await sortButton.click()

      // Test sort by name
      await page.getByRole('menuitem', { name: /name|alphabetical/i }).click()
      
      // Verify alphabetical order
      const projectNames = await modalPage.projectItems.allTextContents()
      const sortedNames = [...projectNames].sort()
      expect(projectNames).toEqual(sortedNames)

      // Test sort by last accessed
      await sortButton.click()
      await page.getByRole('menuitem', { name: /last.*accessed|recent/i }).click()
      
      // Most recently accessed should be first
      const firstProject = modalPage.projectItems.first()
      await expect(firstProject).toContainText('Promptliano Core') // Most recent in test data
    }
  })
})
```

### 2. Project Creation Workflow

#### 2.1 Create Project Form Tests
```typescript
test.describe('Manage Project Modal - Project Creation', () => {
  test('should open create project form', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Click add project button
    await modalPage.openCreateProjectForm()

    // Verify form elements
    await expect(modalPage.createProjectForm).toBeVisible()
    await expect(modalPage.projectNameInput).toBeVisible()
    await expect(modalPage.projectPathInput).toBeVisible()
    await expect(modalPage.projectDescriptionInput).toBeVisible()
    await expect(modalPage.browseDirectoryButton).toBeVisible()
    await expect(modalPage.createProjectButton).toBeVisible()
    await expect(modalPage.cancelCreateButton).toBeVisible()

    // Initially create button should be disabled
    await expect(modalPage.createProjectButton).toBeDisabled()
  })

  test('should validate required fields', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()

    // Try to create without required fields
    await modalPage.createProjectButton.click()

    // Should show validation errors
    const nameError = modalPage.validationErrors.filter({ hasText: /name.*required/i })
    const pathError = modalPage.validationErrors.filter({ hasText: /path.*required/i })

    await expect(nameError).toBeVisible()
    await expect(pathError).toBeVisible()

    // Fill name only
    await modalPage.projectNameInput.fill('Test Project')
    await modalPage.createProjectButton.click()

    // Path should still be required
    await expect(pathError).toBeVisible()

    // Fill path - now should be valid
    await modalPage.projectPathInput.fill('/tmp/test-project')
    await expect(modalPage.createProjectButton).toBeEnabled()
  })

  test('should validate project name uniqueness', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Setup existing projects
    await TestDataManager.setupProjects(page, ManageProjectModalTestData.existingProjects)
    
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()

    // Try to use existing project name
    const duplicateData = ManageProjectModalTestData.newProjectData.invalid.duplicateName
    await modalPage.fillProjectForm(duplicateData)

    await modalPage.createProjectButton.click()

    // Should show uniqueness validation error
    const uniqueError = modalPage.validationErrors.filter({ hasText: /name.*exists|already.*exists/i })
    await expect(uniqueError).toBeVisible()

    // Fix the name
    await modalPage.projectNameInput.clear()
    await modalPage.projectNameInput.fill('Unique Project Name')

    // Should now be valid
    await expect(modalPage.createProjectButton).toBeEnabled()
  })

  test('should validate path format and accessibility', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()

    // Test invalid path formats
    const invalidPaths = [
      'relative/path',
      'C:\\Windows\\Path', // Unix-style test - might be valid on Windows
      '/path/with spaces/unescaped',
      ''
    ]

    await modalPage.projectNameInput.fill('Test Project')

    for (const invalidPath of invalidPaths) {
      await modalPage.projectPathInput.clear()
      await modalPage.projectPathInput.fill(invalidPath)
      await modalPage.createProjectButton.click()

      // Should show path validation error or create button disabled
      const hasError = await modalPage.validationErrors.filter({ hasText: /path|invalid/i }).isVisible()
      const isDisabled = await modalPage.createProjectButton.isDisabled()
      
      expect(hasError || isDisabled).toBe(true)
    }
  })

  test('should handle form cancellation', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()

    // Fill some data
    await modalPage.projectNameInput.fill('Cancelled Project')
    await modalPage.projectDescriptionInput.fill('This should be discarded')

    // Cancel form
    await modalPage.cancelCreateButton.click()

    // Form should be hidden
    await expect(modalPage.createProjectForm).not.toBeVisible()

    // Should return to project list
    await expect(modalPage.projectList).toBeVisible()

    // Reopen form should be empty
    await modalPage.openCreateProjectForm()
    await expect(modalPage.projectNameInput).toHaveValue('')
    await expect(modalPage.projectDescriptionInput).toHaveValue('')
  })
})
```

#### 2.2 File Browser Integration Tests
```typescript
test.describe('Manage Project Modal - File Browser Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock file system API for testing
    await TestDataManager.setupMockFileSystem(page, ManageProjectModalTestData.mockDirectoryStructure)
  })

  test('should open file browser when browse button is clicked', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()

    // Click browse button
    await modalPage.browseDirectoryButton.click()

    // File browser should open
    await expect(modalPage.fileBrowser).toBeVisible()
    await expect(modalPage.fileBrowserHeader).toBeVisible()
    await expect(modalPage.currentPathDisplay).toBeVisible()
    await expect(modalPage.directoryList).toBeVisible()

    // Should show initial directory contents
    await expect(modalPage.directoryItems).toHaveCount.atLeast(1)
  })

  test('should navigate through directory structure', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()
    await modalPage.browseDirectoryButton.click()

    // Should start at root or user directory
    const initialPath = await modalPage.currentPathDisplay.textContent()
    expect(initialPath).toBeTruthy()

    // Navigate to Users directory
    if (await modalPage.getDirectoryItem('Users').isVisible()) {
      await modalPage.getDirectoryItem('Users').dblclick()
      
      // Path should update
      const newPath = await modalPage.currentPathDisplay.textContent()
      expect(newPath).toContain('Users')

      // Should show subdirectories
      await expect(modalPage.getDirectoryItem('developer')).toBeVisible()

      // Navigate deeper
      await modalPage.getDirectoryItem('developer').dblclick()
      
      const deeperPath = await modalPage.currentPathDisplay.textContent()
      expect(deeperPath).toContain('Users/developer')
    }
  })

  test('should handle parent directory navigation', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()
    await modalPage.browseDirectoryButton.click()

    // Navigate to a subdirectory first
    if (await modalPage.getDirectoryItem('tmp').isVisible()) {
      await modalPage.getDirectoryItem('tmp').dblclick()
      const subPath = await modalPage.currentPathDisplay.textContent()
      expect(subPath).toContain('tmp')

      // Use parent directory button
      await modalPage.parentDirectoryButton.click()
      
      const parentPath = await modalPage.currentPathDisplay.textContent()
      expect(parentPath).not.toContain('tmp')
    }
  })

  test('should select directory and populate path input', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()
    await modalPage.browseDirectoryButton.click()

    // Navigate to test projects directory
    const targetPath = '/tmp/test-projects/project-a'
    
    // Simulate navigation (implementation would depend on actual file system API)
    await modalPage.getDirectoryItem('tmp').dblclick()
    await modalPage.getDirectoryItem('test-projects').dblclick()
    await modalPage.getDirectoryItem('project-a').click() // Single click to select

    // Select directory
    await modalPage.selectDirectoryButton.click()

    // File browser should close
    await expect(modalPage.fileBrowser).not.toBeVisible()

    // Path should be populated in form
    await expect(modalPage.projectPathInput).toHaveValue(targetPath)
  })

  test('should show directory contents preview', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()
    await modalPage.browseDirectoryButton.click()

    // Navigate to project with files
    await modalPage.getDirectoryItem('tmp').dblclick()
    await modalPage.getDirectoryItem('test-projects').dblclick()
    await modalPage.getDirectoryItem('project-a').click()

    // Should show directory contents
    await expect(modalPage.directoryItems).toHaveCount(1) // 'src' directory
    await expect(modalPage.fileItems).toHaveCount(2) // package.json, README.md

    // Should differentiate between files and directories
    await expect(modalPage.getDirectoryItem('src')).toHaveClass(/directory|folder/)
    await expect(modalPage.directoryList.getByTestId('file-item').filter({ hasText: 'package.json' })).toHaveClass(/file/)
  })

  test('should handle file system errors gracefully', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Mock file system error
    await page.route('**/file-system/**', route => {
      route.fulfill({
        status: 403,
        body: JSON.stringify({ error: 'Permission denied' })
      })
    })

    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()
    await modalPage.browseDirectoryButton.click()

    // Should handle error gracefully
    const errorMessage = modalPage.fileBrowser.getByText(/permission.*denied|access.*denied|error/i)
    await expect(errorMessage).toBeVisible()

    // Should allow user to cancel
    await modalPage.cancelBrowseButton.click()
    await expect(modalPage.fileBrowser).not.toBeVisible()
  })

  test('should filter and show only directories in browser', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()
    await modalPage.browseDirectoryButton.click()

    // Navigate to directory with mixed content
    await modalPage.getDirectoryItem('tmp').dblclick()
    await modalPage.getDirectoryItem('test-projects').dblclick()

    // Should show directories for navigation
    await expect(modalPage.getDirectoryItem('project-a')).toBeVisible()
    await expect(modalPage.getDirectoryItem('project-b')).toBeVisible()
    await expect(modalPage.getDirectoryItem('empty-folder')).toBeVisible()

    // Files should be visible but not selectable for project creation
    // (Implementation detail - depends on design)
    const fileItems = modalPage.fileItems
    if (await fileItems.count() > 0) {
      // Files might be shown but disabled/dimmed
      await expect(fileItems.first()).toHaveClass(/disabled|dimmed/)
    }
  })
})
```

### 3. Project Import and Synchronization

#### 3.1 Project Creation and Import Tests
```typescript
test.describe('Manage Project Modal - Project Import and Sync', () => {
  test('should create project and initiate file sync', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Setup mock file system with project files
    await TestDataManager.setupMockFileSystem(page, ManageProjectModalTestData.mockDirectoryStructure)
    
    await modalPage.goto('/')
    await modalPage.openModal()

    // Create new project
    const projectData = ManageProjectModalTestData.newProjectData.valid
    await modalPage.createProject(projectData)

    // Should start sync process
    await expect(modalPage.syncStatus).toBeVisible()
    await expect(modalPage.syncMessage).toContainText(/scanning|importing|indexing/i)

    // Should show progress indicator
    await expect(modalPage.syncProgress).toBeVisible()

    // Wait for sync to complete
    await modalPage.waitForProjectSync()

    // Should show completion message
    await expect(modalPage.syncMessage).toContainText(/complete|finished|done/i)

    // Project should appear in list
    await expect(modalPage.projectItem(projectData.name)).toBeVisible()

    // Should show file count
    const metadata = modalPage.getProjectMetadata(projectData.name)
    await expect(metadata).toContainText(/\d+.*file/)
  })

  test('should handle large project import with progress tracking', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Setup large project structure
    await TestDataManager.setupLargeProjectStructure(page, 500) // 500 files
    
    await modalPage.goto('/')
    await modalPage.openModal()

    const projectData = {
      name: 'Large Test Project',
      path: '/tmp/large-project',
      description: 'Project with many files for sync testing'
    }

    await modalPage.createProject(projectData)

    // Should show detailed progress
    await expect(modalPage.syncProgress).toBeVisible()
    
    // Progress should update over time
    const initialProgress = await modalPage.syncProgress.getAttribute('value')
    
    // Wait a bit and check progress increased
    await page.waitForTimeout(2000)
    const laterProgress = await modalPage.syncProgress.getAttribute('value')
    
    if (initialProgress && laterProgress) {
      expect(parseInt(laterProgress)).toBeGreaterThan(parseInt(initialProgress))
    }

    // Should show file count progress in message
    await expect(modalPage.syncMessage).toContainText(/\d+.*of.*\d+.*files/i)

    // Complete sync
    await modalPage.waitForProjectSync()
    
    // Final file count should be accurate
    const metadata = modalPage.getProjectMetadata(projectData.name)
    await expect(metadata).toContainText('500')
  })

  test('should handle sync errors and provide recovery options', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Mock sync failure
    await page.route('**/api/projects/sync', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'File system access error' })
      })
    })

    await modalPage.goto('/')
    await modalPage.openModal()

    const projectData = ManageProjectModalTestData.newProjectData.valid
    await modalPage.createProject(projectData)

    // Should show error message
    await expect(modalPage.errorMessage).toBeVisible()
    await expect(modalPage.errorMessage).toContainText(/error|failed|sync.*error/i)

    // Should provide retry option
    const retryButton = modalPage.modal.getByRole('button', { name: /retry|try.*again/i })
    await expect(retryButton).toBeVisible()

    // Should allow cancellation/deletion of failed project
    const deleteButton = modalPage.modal.getByRole('button', { name: /cancel|delete|remove/i })
    await expect(deleteButton).toBeVisible()
  })

  test('should skip non-relevant files during sync', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Setup project with mixed file types including irrelevant ones
    await TestDataManager.setupProjectWithMixedFiles(page, {
      relevant: ['src/main.js', 'README.md', 'package.json', 'src/utils.js'],
      irrelevant: ['.DS_Store', 'node_modules/package/index.js', '.git/config', 'dist/bundle.js']
    })

    await modalPage.goto('/')
    await modalPage.openModal()

    const projectData = {
      name: 'Mixed Files Project',
      path: '/tmp/mixed-files-project'
    }

    await modalPage.createProject(projectData)
    await modalPage.waitForProjectSync()

    // Should only count relevant files
    const metadata = modalPage.getProjectMetadata(projectData.name)
    const fileCountText = await metadata.textContent()
    const fileCount = parseInt(fileCountText?.match(/(\d+).*file/)?.[1] || '0')
    
    // Should be 4 relevant files, not all 8
    expect(fileCount).toBe(4)

    // Sync message should indicate filtering
    await expect(modalPage.syncMessage).toContainText(/filtered|skipped|ignored/i)
  })

  test('should handle permission errors during file scanning', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Mock permission error during scan
    await page.route('**/api/projects/scan', route => {
      route.fulfill({
        status: 403,
        body: JSON.stringify({ 
          error: 'Permission denied',
          details: 'Cannot access /private/restricted/'
        })
      })
    })

    await modalPage.goto('/')
    await modalPage.openModal()

    const projectData = {
      name: 'Restricted Project',
      path: '/private/restricted'
    }

    await modalPage.createProject(projectData)

    // Should show permission error
    await expect(modalPage.errorMessage).toBeVisible()
    await expect(modalPage.errorMessage).toContainText(/permission.*denied|access.*denied/i)

    // Should suggest solutions
    await expect(modalPage.errorMessage).toContainText(/check.*permissions|choose.*different/i)

    // Should allow path change
    const changePathButton = modalPage.modal.getByRole('button', { name: /change.*path|browse/i })
    await expect(changePathButton).toBeVisible()
  })

  test('should validate project directory exists before sync', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()
    await modalPage.openCreateProjectForm()

    // Fill form with non-existent path
    const invalidData = ManageProjectModalTestData.newProjectData.invalid.invalidPath
    await modalPage.fillProjectForm(invalidData)

    await modalPage.createProjectButton.click()

    // Should validate path exists before starting sync
    const pathError = modalPage.validationErrors.filter({ hasText: /path.*not.*exist|invalid.*path|directory.*not.*found/i })
    await expect(pathError).toBeVisible()

    // Create button should remain disabled or show error
    const isDisabled = await modalPage.createProjectButton.isDisabled()
    expect(isDisabled).toBe(true)
  })
})
```

### 4. Project Management Operations

#### 4.1 Edit and Delete Operations Tests
```typescript
test.describe('Manage Project Modal - Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await TestDataManager.setupProjects(page, ManageProjectModalTestData.existingProjects)
  })

  test('should edit existing project details', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Click edit for existing project
    await modalPage.getEditProjectButton('E-Commerce App').click()

    // Should open edit form
    const editForm = modalPage.modal.getByTestId('edit-project-form')
    await expect(editForm).toBeVisible()

    // Form should be pre-populated
    const nameInput = editForm.getByTestId('project-name-input')
    const descInput = editForm.getByTestId('project-description-input')
    
    await expect(nameInput).toHaveValue('E-Commerce App')
    await expect(descInput).toHaveValue('React-based e-commerce platform')

    // Make changes
    await nameInput.clear()
    await nameInput.fill('Updated E-Commerce App')
    
    await descInput.clear()
    await descInput.fill('Updated description for the e-commerce platform')

    // Save changes
    await editForm.getByRole('button', { name: /save|update/i }).click()

    // Should update project in list
    await expect(modalPage.projectItem('Updated E-Commerce App')).toBeVisible()
    await expect(modalPage.getProjectDescription('Updated E-Commerce App')).toContainText('Updated description')

    // Original name should not exist anymore
    await expect(modalPage.projectItem('E-Commerce App')).not.toBeVisible()
  })

  test('should delete project with confirmation', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    const initialCount = await modalPage.getProjectCount()

    // Delete project
    await modalPage.deleteProject('Legacy API', true)

    // Should be removed from list
    await expect(modalPage.projectItem('Legacy API')).not.toBeVisible()
    
    // Project count should decrease
    const newCount = await modalPage.getProjectCount()
    expect(newCount).toBe(initialCount - 1)

    // Should show success message
    await expect(page.getByText('Project deleted successfully')).toBeVisible()
  })

  test('should cancel project deletion', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    const initialCount = await modalPage.getProjectCount()

    // Try to delete but cancel
    await modalPage.deleteProject('Promptliano Core', false)

    // Project should still exist
    await expect(modalPage.projectItem('Promptliano Core')).toBeVisible()
    
    // Count should be unchanged
    const newCount = await modalPage.getProjectCount()
    expect(newCount).toBe(initialCount)
  })

  test('should handle project deletion errors', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    
    // Mock deletion error
    await page.route('**/api/projects/*', route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Cannot delete project with active sessions' })
        })
      } else {
        route.continue()
      }
    })

    await modalPage.goto('/')
    await modalPage.openModal()

    await modalPage.deleteProject('E-Commerce App', true)

    // Should show error message
    await expect(modalPage.errorMessage).toBeVisible()
    await expect(modalPage.errorMessage).toContainText(/cannot.*delete|active.*sessions/i)

    // Project should still be visible
    await expect(modalPage.projectItem('E-Commerce App')).toBeVisible()
  })

  test('should archive/restore projects', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Archive active project
    const activeProject = modalPage.projectItem('Promptliano Core')
    const archiveButton = activeProject.getByRole('button', { name: /archive/i })
    
    if (await archiveButton.isVisible()) {
      await archiveButton.click()

      // Confirm archiving
      const confirmDialog = page.getByTestId('archive-project-confirmation')
      await page.getByRole('button', { name: /archive|confirm/i }).click()

      // Project should show as archived
      await expect(activeProject).toHaveClass(/archived/)
      await expect(modalPage.getProjectMetadata('Promptliano Core')).toContainText(/archived/)
    }

    // Restore archived project
    const archivedProject = modalPage.projectItem('Legacy API')
    const restoreButton = archivedProject.getByRole('button', { name: /restore/i })
    
    if (await restoreButton.isVisible()) {
      await restoreButton.click()

      // Project should show as active
      await expect(archivedProject).not.toHaveClass(/archived/)
      await expect(modalPage.getProjectMetadata('Legacy API')).toContainText(/active/)
    }
  })

  test('should refresh project file counts and metadata', async ({ page }) => {
    const modalPage = new ManageProjectModal(page)
    await modalPage.goto('/')
    await modalPage.openModal()

    // Find refresh button for project
    const refreshButton = modalPage.projectItem('Promptliano Core').getByRole('button', { name: /refresh|sync|update/i })
    
    if (await refreshButton.isVisible()) {
      // Mock updated file count
      await page.route('**/api/projects/*/sync', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ fileCount: 267, lastModified: new Date().toISOString() })
        })
      })

      await refreshButton.click()

      // Should show sync in progress
      await expect(modalPage.syncStatus).toBeVisible()

      // Wait for completion
      await modalPage.waitForProjectSync()

      // File count should be updated
      const metadata = modalPage.getProjectMetadata('Promptliano Core')
      await expect(metadata).toContainText('267 files')
    }
  })
})
```

## Best Practices and Recommendations

### 1. Modal Management
- **Focus Handling**: Ensure proper focus management and tab trapping
- **Keyboard Navigation**: Support Escape key closing and accessibility features
- **State Persistence**: Handle modal state during navigation and errors

### 2. File System Integration
- **Cross-Platform**: Test file browser on different operating systems
- **Permission Handling**: Gracefully handle file system permission errors
- **Large Directories**: Optimize performance for directories with many files

### 3. Project Synchronization
- **Progress Feedback**: Provide clear progress indicators for long operations
- **Error Recovery**: Allow users to retry failed operations
- **Incremental Updates**: Support efficient re-sync of existing projects

### 4. User Experience
- **Loading States**: Show appropriate loading indicators during operations
- **Error Messages**: Provide actionable error messages with recovery options
- **Validation Feedback**: Real-time validation with clear error messages

## Execution Strategy

### 1. Test Organization
- **Modal Tests**: Can run in parallel with proper cleanup
- **File System Tests**: Use mocked file system API for consistency
- **Project Management**: Require database state management between tests
- **Sync Operations**: May need sequential execution for timing-dependent tests

### 2. Mock Requirements
- **File System API**: Mock directory browsing and file access
- **Project Sync**: Mock file scanning and indexing operations
- **Database Operations**: Mock project CRUD operations for isolation

### 3. Performance Considerations
- **Large Projects**: Test with realistic project sizes (100+ files)
- **Concurrent Operations**: Test multiple sync operations simultaneously
- **Memory Management**: Monitor for memory leaks during large imports

This comprehensive test plan ensures the Manage Project Modal functionality is thoroughly validated across all project management workflows, from discovery and creation to import and synchronization, providing reliable project management capabilities for Promptliano users.