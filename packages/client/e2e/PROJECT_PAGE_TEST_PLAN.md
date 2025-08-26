# Project Page Comprehensive Test Plan

## Overview
The Project Page is the central hub of Promptliano, integrating project context management, prompt organization, file tree navigation, flow features with task queues, and the task queue board. This test plan covers all major functionality with specific attention to MCP integration and complex user workflows.

## Test Scope & Requirements

### Major Components
1. **Project Context Tab** - User input, file selection, prompt management, context copying
2. **Prompt Management** - CRUD operations with hover actions and contextual menus
3. **File Tree Testing** - File/folder selection, right-click context menus, git integration
4. **Flow Feature** - Task queue monitoring and ticket management
5. **Task Queue Board** - Drag-and-drop queue management with ticket/task organization

### Technical Integration Points
- **MCP Integration**: Project manager, ticket manager, queue processor tools
- **File System Integration**: File selection, path management, git operations
- **Database Operations**: Project data persistence and synchronization
- **Real-time Updates**: Queue status changes, file modifications, task completions

## Test Data Requirements

### Shared Test Data Setup
```typescript
// Location: e2e/fixtures/project-page-data.ts
export const ProjectPageTestData = {
  // Test project with realistic file structure
  testProject: TestDataFactory.createProject({
    name: 'Project Page Test Suite',
    path: '/tmp/project-page-tests',
    description: 'Comprehensive test project for Project Page features'
  }),

  // Sample prompts for management testing
  testPrompts: [
    TestDataFactory.createPrompt({
      title: 'Code Review Assistant',
      content: 'Review the following code for {{language}} and provide feedback:\n\n{{code}}',
      tags: ['code-review', 'quality']
    }),
    TestDataFactory.createPrompt({
      title: 'Documentation Generator',
      content: 'Generate documentation for {{feature}}:\n\n{{requirements}}',
      tags: ['documentation', 'automation']
    }),
    TestDataFactory.createPrompt({
      title: 'Test Case Creator',
      content: 'Create test cases for:\n\n{{functionality}}',
      tags: ['testing', 'qa']
    })
  ],

  // Queue system test data
  testQueues: [
    TestDataFactory.createQueue({ name: 'Features', maxParallelItems: 3 }),
    TestDataFactory.createQueue({ name: 'Bugs', maxParallelItems: 2 }),
    TestDataFactory.createQueue({ name: 'Improvements', maxParallelItems: 1 })
  ],

  // Test tickets with tasks
  testTickets: [
    TestDataFactory.createTicket({
      title: 'Implement User Authentication',
      overview: 'Add secure user authentication system',
      priority: 'high',
      tasks: [
        'Design login UI',
        'Implement JWT tokens',
        'Add password validation',
        'Create user session management',
        'Add logout functionality'
      ]
    }),
    TestDataFactory.createTicket({
      title: 'Fix Navigation Bug',
      overview: 'Resolve issue with sidebar navigation',
      priority: 'normal',
      tasks: [
        'Reproduce navigation issue',
        'Identify root cause',
        'Implement fix',
        'Test across browsers'
      ]
    }),
    TestDataFactory.createTicket({
      title: 'Performance Optimization',
      overview: 'Improve application load times',
      priority: 'low',
      tasks: [
        'Profile current performance',
        'Identify bottlenecks',
        'Optimize bundle size',
        'Implement lazy loading',
        'Measure improvements'
      ]
    })
  ]
}
```

## Page Object Model Extensions

### ProjectPage Class Enhancements
```typescript
// Location: e2e/pages/project-page.ts
export class ProjectPage extends BasePage {
  // Project Context Tab Elements
  get contextTab() {
    return this.page.getByTestId('project-context-tab')
  }

  get userInputTextarea() {
    return this.page.getByTestId('user-input-textarea')
  }

  get copyAllButton() {
    return this.page.getByRole('button', { name: 'Copy All' })
  }

  get searchFilesButton() {
    return this.page.getByRole('button', { name: /search files/i })
  }

  get suggestPromptsButton() {
    return this.page.getByRole('button', { name: /suggest prompts/i })
  }

  get chatButton() {
    return this.page.getByRole('button', { name: /chat/i })
  }

  get summarySection() {
    return this.page.getByTestId('project-summary')
  }

  // Prompt Management Elements
  get promptsContainer() {
    return this.page.getByTestId('project-prompts')
  }

  get promptCards() {
    return this.page.getByTestId('prompt-card')
  }

  promptCardByTitle(title: string) {
    return this.page.getByTestId('prompt-card').filter({ hasText: title })
  }

  promptCardCopyIcon(title: string) {
    return this.promptCardByTitle(title).getByTestId('copy-icon')
  }

  promptCardMenu(title: string) {
    return this.promptCardByTitle(title).getByTestId('three-dot-menu')
  }

  // File Tree Elements
  get fileTree() {
    return this.page.getByTestId('file-tree')
  }

  get selectedFiles() {
    return this.page.getByTestId('selected-files')
  }

  fileNode(fileName: string) {
    return this.page.getByTestId('file-node').filter({ hasText: fileName })
  }

  folderNode(folderName: string) {
    return this.page.getByTestId('folder-node').filter({ hasText: folderName })
  }

  // Flow Feature Elements  
  get flowSection() {
    return this.page.getByTestId('flow-section')
  }

  get queueStats() {
    return this.page.getByTestId('queue-stats')
  }

  get activeQueuesCount() {
    return this.page.getByTestId('active-queues-count')
  }

  get totalQueuesCount() {
    return this.page.getByTestId('total-queues-count')
  }

  get inProgressCount() {
    return this.page.getByTestId('in-progress-count')
  }

  queueCard(queueName: string) {
    return this.page.getByTestId('queue-card').filter({ hasText: queueName })
  }

  queueViewDetailsButton(queueName: string) {
    return this.queueCard(queueName).getByRole('button', { name: /view queue details/i })
  }

  // Task Queue Board Elements
  get taskQueueBoard() {
    return this.page.getByTestId('task-queue-board')
  }

  get unqueuedColumn() {
    return this.page.getByTestId('unqueued-column')
  }

  queueColumn(queueName: string) {
    return this.page.getByTestId('queue-column').filter({ hasText: queueName })
  }

  ticketCard(ticketTitle: string) {
    return this.page.getByTestId('ticket-card').filter({ hasText: ticketTitle })
  }

  taskCard(taskTitle: string) {
    return this.page.getByTestId('task-card').filter({ hasText: taskTitle })
  }
}
```

## Test Scenarios

### 1. Project Context Tab Tests

#### 1.1 User Input Management
```typescript
test.describe('Project Context - User Input', () => {
  test('should handle user input and copy functionality', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Test user input
    const testInput = 'Please review the authentication system and provide feedback'
    await projectPage.userInputTextarea.fill(testInput)

    // Verify input is saved
    await expect(projectPage.userInputTextarea).toHaveValue(testInput)

    // Test copy all functionality
    await projectPage.copyAllButton.click()

    // Verify toast notification
    await expect(page.getByText('Copied to clipboard')).toBeVisible()

    // Verify clipboard content (if accessible)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain(testInput)
  })

  test('should suggest files based on user input', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Enter specific user input that should trigger file suggestions
    await projectPage.userInputTextarea.fill('auth authentication login')

    // Click search files button
    await projectPage.searchFilesButton.click()

    // Wait for and verify file suggestions dialog
    await expect(page.getByTestId('file-suggestions-dialog')).toBeVisible()

    // Verify relevant files are suggested (should include auth-related files)
    const suggestions = page.getByTestId('suggested-file')
    await expect(suggestions).toHaveCount.atLeast(1)

    // Check that suggestions are relevant to input
    const firstSuggestion = suggestions.first()
    const suggestionText = await firstSuggestion.textContent()
    expect(suggestionText.toLowerCase()).toMatch(/(auth|login|user|security)/)
  })

  test('should suggest prompts based on context', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Enter context that should trigger prompt suggestions
    await projectPage.userInputTextarea.fill('I need help with code review')

    // Click suggest prompts button
    await projectPage.suggestPromptsButton.click()

    // Verify prompt suggestions dialog
    await expect(page.getByTestId('prompt-suggestions-dialog')).toBeVisible()

    // Verify relevant prompts are suggested
    const suggestions = page.getByTestId('suggested-prompt')
    await expect(suggestions).toHaveCount.atLeast(1)

    // Verify suggestions are contextually relevant
    const firstSuggestion = suggestions.first()
    await expect(firstSuggestion).toContainText(/review|code|quality/)
  })

  test('should copy context to chat', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Set up context: user input, selected files, selected prompts
    await projectPage.userInputTextarea.fill('Help with authentication')
    
    // Select some files
    await projectPage.fileNode('auth.ts').getByRole('checkbox').check()
    await projectPage.fileNode('user.ts').getByRole('checkbox').check()

    // Select some prompts (assuming they're selectable)
    await projectPage.promptCardByTitle('Code Review Assistant').getByRole('checkbox').check()

    // Click chat button
    await projectPage.chatButton.click()

    // Should navigate to chat with context
    await expect(page).toHaveURL(/.*\/chat/)
    
    // Verify context is copied to chat input
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toContainText('Help with authentication')
    
    // Should also contain file and prompt references
    await expect(chatInput).toContainText('auth.ts')
    await expect(chatInput).toContainText('Code Review Assistant')
  })

  test('should display project summary markdown', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Wait for summary to load
    await projectPage.summarySection.waitFor()

    // Verify summary section exists and has content
    await expect(projectPage.summarySection).toBeVisible()
    
    // Check for markdown formatting elements
    const summaryContent = projectPage.summarySection.locator('.markdown-content')
    await expect(summaryContent).toBeVisible()

    // Verify typical project summary elements
    await expect(summaryContent).toContainText(/project|files|structure/)
  })
})
```

#### 1.2 Prompt Management Tests
```typescript
test.describe('Project Context - Prompt Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup project with test prompts
    const testData = ProjectPageTestData.testPrompts
    await TestDataManager.setupProjectPrompts(page, testData)
  })

  test('should display prompt cards with hover effects', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Wait for prompts to load
    await expect(projectPage.promptCards).toHaveCount.atLeast(3)

    // Test hover on first prompt
    const firstPrompt = projectPage.promptCards.first()
    await firstPrompt.hover()

    // Verify copy icon appears on hover
    await expect(projectPage.promptCardCopyIcon('Code Review Assistant')).toBeVisible()

    // Verify three-dot menu appears on hover
    await expect(projectPage.promptCardMenu('Code Review Assistant')).toBeVisible()
  })

  test('should handle copy icon functionality', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Hover over prompt to reveal copy icon
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    
    // Click copy icon
    await projectPage.promptCardCopyIcon('Code Review Assistant').click()

    // Verify copy success feedback
    await expect(page.getByText('Prompt copied to clipboard')).toBeVisible()
  })

  test('should display three-dot menu with all options', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Hover and click three-dot menu
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    await projectPage.promptCardMenu('Code Review Assistant').click()

    // Verify all menu options are present
    const menuItems = [
      'View Prompt',
      'Edit Prompt', 
      'Copy Content',
      'Export as Markdown',
      'Delete Prompt'
    ]

    for (const item of menuItems) {
      await expect(page.getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('should handle prompt menu actions', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Test View Prompt action
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    await projectPage.promptCardMenu('Code Review Assistant').click()
    await page.getByRole('menuitem', { name: 'View Prompt' }).click()

    await expect(page.getByTestId('prompt-view-dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()

    // Test Edit Prompt action
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    await projectPage.promptCardMenu('Code Review Assistant').click()
    await page.getByRole('menuitem', { name: 'Edit Prompt' }).click()

    await expect(page.getByTestId('prompt-edit-dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Test Copy Content action
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    await projectPage.promptCardMenu('Code Review Assistant').click()
    await page.getByRole('menuitem', { name: 'Copy Content' }).click()

    await expect(page.getByText('Prompt content copied')).toBeVisible()

    // Test Export as Markdown
    const downloadPromise = page.waitForEvent('download')
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    await projectPage.promptCardMenu('Code Review Assistant').click()
    await page.getByRole('menuitem', { name: 'Export as Markdown' }).click()
    
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/.*\.md$/)

    // Test Delete Prompt (with confirmation)
    await projectPage.promptCardByTitle('Code Review Assistant').hover()
    await projectPage.promptCardMenu('Code Review Assistant').click()
    await page.getByRole('menuitem', { name: 'Delete Prompt' }).click()

    // Handle confirmation dialog
    await expect(page.getByTestId('confirmation-dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click() // Don't actually delete

    // Verify prompt still exists
    await expect(projectPage.promptCardByTitle('Code Review Assistant')).toBeVisible()
  })
})
```

#### 1.3 File Tree Testing
```typescript
test.describe('File Tree Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup project with realistic file structure
    await TestDataManager.setupProjectWithFiles(page, {
      'src/auth/': ['login.ts', 'register.ts', 'auth.service.ts'],
      'src/components/': ['Button.tsx', 'Input.tsx', 'Modal.tsx'],
      'src/utils/': ['helpers.ts', 'constants.ts'],
      'tests/': ['auth.test.ts', 'components.test.ts'],
      'package.json': '',
      'README.md': ''
    })
  })

  test('should populate selected files when project loads', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Wait for file tree to load
    await projectPage.fileTree.waitFor()

    // Verify files are populated in the tree
    await expect(projectPage.fileNode('package.json')).toBeVisible()
    await expect(projectPage.fileNode('README.md')).toBeVisible()
    await expect(projectPage.folderNode('src')).toBeVisible()

    // Verify some files appear in selected files initially
    await expect(projectPage.selectedFiles).toBeVisible()
  })

  test('should handle individual file selection', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Click checkbox for individual file
    const fileCheckbox = projectPage.fileNode('package.json').getByRole('checkbox')
    await fileCheckbox.check()

    // Verify file appears in selected files
    await expect(projectPage.selectedFiles.getByText('package.json')).toBeVisible()

    // Uncheck the file
    await fileCheckbox.uncheck()

    // Verify file is removed from selected files
    await expect(projectPage.selectedFiles.getByText('package.json')).not.toBeVisible()
  })

  test('should select all files in folder when folder is clicked', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Click on folder checkbox
    const folderCheckbox = projectPage.folderNode('src').getByRole('checkbox')
    await folderCheckbox.check()

    // Verify all files in folder are selected
    await expect(projectPage.selectedFiles.getByText('login.ts')).toBeVisible()
    await expect(projectPage.selectedFiles.getByText('register.ts')).toBeVisible()
    await expect(projectPage.selectedFiles.getByText('Button.tsx')).toBeVisible()
  })

  test('should handle folder right-click context menu', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Right-click on folder
    await projectPage.folderNode('src').click({ button: 'right' })

    // Verify context menu appears with correct options
    const contextMenu = page.getByTestId('folder-context-menu')
    await expect(contextMenu).toBeVisible()

    const expectedMenuItems = [
      'Copy Folder Contents',
      'Copy Folder Summaries', 
      'Copy Folder Tree'
    ]

    for (const item of expectedMenuItems) {
      await expect(contextMenu.getByRole('menuitem', { name: item })).toBeVisible()
    }

    // Test each menu option shows token counts
    await contextMenu.getByRole('menuitem', { name: 'Copy Folder Contents' }).hover()
    await expect(page.getByText(/\d+ tokens/)).toBeVisible()
  })

  test('should handle file right-click context menu', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Right-click on regular file
    await projectPage.fileNode('package.json').click({ button: 'right' })

    // Verify context menu with standard file options
    const contextMenu = page.getByTestId('file-context-menu')
    await expect(contextMenu).toBeVisible()

    const expectedItems = [
      'Copy Relative Path',
      'Copy Absolute Path',
      'Open In Editor',
      'Copy File Contents'
    ]

    for (const item of expectedItems) {
      await expect(contextMenu.getByRole('menuitem', { name: item })).toBeVisible()
    }

    // Verify token count is displayed
    await expect(contextMenu.getByText(/\(\d+ tokens\)/)).toBeVisible()
  })

  test('should handle git-modified file right-click context menu', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    
    // Setup a file with git modifications
    await TestDataManager.setupGitModifiedFile(page, 'src/auth/login.ts')
    await projectPage.goto('/projects/1')

    // Right-click on modified file
    await projectPage.fileNode('login.ts').click({ button: 'right' })

    // Verify additional git-related options
    const contextMenu = page.getByTestId('file-context-menu')
    await expect(contextMenu).toBeVisible()

    const gitMenuItems = [
      'Stage File',
      'Copy Previous Version', 
      'Copy Diff'
    ]

    for (const item of gitMenuItems) {
      await expect(contextMenu.getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('should handle staged file operations', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    
    // Setup a staged file
    await TestDataManager.setupStagedFile(page, 'src/auth/login.ts')
    await projectPage.goto('/projects/1')

    // Right-click on staged file
    await projectPage.fileNode('login.ts').click({ button: 'right' })

    // Verify unstage option is available
    const contextMenu = page.getByTestId('file-context-menu')
    await expect(contextMenu.getByRole('menuitem', { name: 'Unstage File' })).toBeVisible()

    // Test unstage functionality
    await contextMenu.getByRole('menuitem', { name: 'Unstage File' }).click()
    await expect(page.getByText('File unstaged successfully')).toBeVisible()
  })
})
```

#### 1.4 Flow Feature Tests
```typescript
test.describe('Flow Feature - Queue Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test queues and tickets using MCP integration
    await MCPTestHelpers.testMCPIntegrationSafely(page, 'flow setup', async (mcpAvailable) => {
      if (mcpAvailable) {
        await TestDataManager.setupFlowTestData(page, ProjectPageTestData.testQueues, ProjectPageTestData.testTickets)
      } else {
        await TestDataManager.mockFlowTestData(page, ProjectPageTestData.testQueues, ProjectPageTestData.testTickets)
      }
    })
  })

  test('should display queue statistics correctly', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Wait for flow section to load
    await projectPage.flowSection.waitFor()

    // Verify queue statistics are displayed
    await expect(projectPage.queueStats).toBeVisible()

    // Check active queues count
    const activeCount = await projectPage.activeQueuesCount.textContent()
    expect(parseInt(activeCount || '0')).toBeGreaterThan(0)

    // Check total queues count  
    const totalCount = await projectPage.totalQueuesCount.textContent()
    expect(parseInt(totalCount || '0')).toBeGreaterThanOrEqual(parseInt(activeCount || '0'))

    // Check in-progress count
    const inProgressCount = await projectPage.inProgressCount.textContent()
    expect(parseInt(inProgressCount || '0')).toBeGreaterThanOrEqual(0)
  })

  test('should display queue cards with correct information', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Verify each test queue is displayed
    for (const queue of ProjectPageTestData.testQueues) {
      const queueCard = projectPage.queueCard(queue.name)
      await expect(queueCard).toBeVisible()

      // Verify queue information is displayed
      await expect(queueCard).toContainText(queue.name)
      if (queue.description) {
        await expect(queueCard).toContainText(queue.description)
      }

      // Verify "View Queue Details" button exists
      await expect(projectPage.queueViewDetailsButton(queue.name)).toBeVisible()
    }
  })

  test('should open queue details modal with correct content', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Click "View Queue Details" for Features queue
    await projectPage.queueViewDetailsButton('Features').click()

    // Verify modal opens
    const queueModal = page.getByTestId('queue-details-modal')
    await expect(queueModal).toBeVisible()

    // Verify modal has tabs for different ticket statuses
    const expectedTabs = ['All', 'Pending', 'In Progress', 'Completed']
    for (const tab of expectedTabs) {
      await expect(queueModal.getByRole('tab', { name: tab })).toBeVisible()
    }

    // Verify "All" tab shows correct total count
    const allTab = queueModal.getByRole('tab', { name: 'All' })
    const tabText = await allTab.textContent()
    const itemCount = parseInt(tabText?.match(/\((\d+)\)/)?.[1] || '0')
    
    // Should match the displayed count in the tab content
    await allTab.click()
    const items = queueModal.getByTestId('queue-item')
    await expect(items).toHaveCount(itemCount)

    // Close modal
    await queueModal.getByRole('button', { name: 'Close' }).click()
    await expect(queueModal).not.toBeVisible()
  })
})
```

#### 1.5 Task Queue Board Tests
```typescript
test.describe('Task Queue Board - Drag and Drop Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup comprehensive test data with tickets and tasks
    await TestDataManager.setupTaskQueueBoardData(page, {
      queues: ProjectPageTestData.testQueues,
      tickets: ProjectPageTestData.testTickets,
      unqueuedTickets: 2 // Some tickets should start unqueued
    })
  })

  test('should display all queue columns including Unqueued', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Wait for task queue board to load
    await projectPage.taskQueueBoard.waitFor()

    // Verify Unqueued column exists
    await expect(projectPage.unqueuedColumn).toBeVisible()
    await expect(projectPage.unqueuedColumn).toContainText('Unqueued')

    // Verify all test queue columns exist
    for (const queue of ProjectPageTestData.testQueues) {
      await expect(projectPage.queueColumn(queue.name)).toBeVisible()
      await expect(projectPage.queueColumn(queue.name)).toContainText(queue.name)
    }
  })

  test('should display tickets with their tasks', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Find a ticket in the board
    const firstTicket = projectPage.ticketCard('Implement User Authentication')
    await expect(firstTicket).toBeVisible()

    // Verify ticket shows basic information
    await expect(firstTicket).toContainText('Implement User Authentication')
    await expect(firstTicket).toContainText('Add secure user authentication system')

    // Verify ticket shows its tasks
    const ticketTasks = firstTicket.getByTestId('ticket-tasks')
    await expect(ticketTasks).toBeVisible()

    // Should show task count (e.g., "5 tasks")
    await expect(firstTicket).toContainText(/\d+ task/)
  })

  test('should drag ticket from unqueued to queue', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Find an unqueued ticket
    const unqueuedTicket = projectPage.unqueuedColumn.getByTestId('ticket-card').first()
    await expect(unqueuedTicket).toBeVisible()

    const ticketTitle = await unqueuedTicket.getByTestId('ticket-title').textContent()

    // Drag ticket to Features queue
    const featuresColumn = projectPage.queueColumn('Features')
    await unqueuedTicket.dragTo(featuresColumn)

    // Verify ticket is now in Features queue
    await expect(featuresColumn.getByText(ticketTitle || '')).toBeVisible()

    // Verify ticket is no longer in Unqueued
    await expect(projectPage.unqueuedColumn.getByText(ticketTitle || '')).not.toBeVisible()

    // Verify success notification
    await expect(page.getByText('Ticket added to Features queue')).toBeVisible()
  })

  test('should move ticket and tasks together', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Get initial task count in Features queue
    const featuresColumn = projectPage.queueColumn('Features')
    const initialTaskCount = await featuresColumn.getByTestId('task-card').count()

    // Find a ticket with multiple tasks in Bugs queue
    const bugsColumn = projectPage.queueColumn('Bugs') 
    const ticketWithTasks = bugsColumn.getByTestId('ticket-card').first()
    
    // Get the number of tasks this ticket has
    const ticketTasksText = await ticketWithTasks.getByTestId('ticket-tasks').textContent()
    const taskCount = parseInt(ticketTasksText?.match(/(\d+) task/)?.[1] || '0')

    // Drag ticket from Bugs to Features
    await ticketWithTasks.dragTo(featuresColumn)

    // Verify all tasks moved with the ticket
    const newTaskCount = await featuresColumn.getByTestId('task-card').count()
    expect(newTaskCount).toBe(initialTaskCount + taskCount)

    // Verify task ownership is maintained
    const movedTicketTitle = await ticketWithTasks.getByTestId('ticket-title').textContent()
    const tasksInFeatures = featuresColumn.getByTestId('task-card')
    
    // Check that moved tasks belong to the moved ticket
    let ticketTasksFound = 0
    for (let i = 0; i < await tasksInFeatures.count(); i++) {
      const task = tasksInFeatures.nth(i)
      const taskTicketInfo = await task.getByTestId('task-ticket').textContent()
      if (taskTicketInfo?.includes(movedTicketTitle || '')) {
        ticketTasksFound++
      }
    }
    
    expect(ticketTasksFound).toBe(taskCount)
  })

  test('should move tickets between two queues', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Move ticket from Features to Bugs queue
    const featuresColumn = projectPage.queueColumn('Features')
    const bugsColumn = projectPage.queueColumn('Bugs')

    // Get a ticket from Features
    const ticketInFeatures = featuresColumn.getByTestId('ticket-card').first()
    await expect(ticketInFeatures).toBeVisible()
    
    const ticketTitle = await ticketInFeatures.getByTestId('ticket-title').textContent()

    // Get initial counts
    const initialFeaturesTickets = await featuresColumn.getByTestId('ticket-card').count()
    const initialBugsTickets = await bugsColumn.getByTestId('ticket-card').count()

    // Drag ticket from Features to Bugs
    await ticketInFeatures.dragTo(bugsColumn)

    // Verify ticket counts updated
    await expect(featuresColumn.getByTestId('ticket-card')).toHaveCount(initialFeaturesTickets - 1)
    await expect(bugsColumn.getByTestId('ticket-card')).toHaveCount(initialBugsTickets + 1)

    // Verify ticket is now in Bugs queue
    await expect(bugsColumn.getByText(ticketTitle || '')).toBeVisible()
    await expect(featuresColumn.getByText(ticketTitle || '')).not.toBeVisible()
  })

  test('should unqueue tickets and tasks', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Get a ticket from a queue
    const featuresColumn = projectPage.queueColumn('Features')
    const ticketInQueue = featuresColumn.getByTestId('ticket-card').first()
    
    const ticketTitle = await ticketInQueue.getByTestId('ticket-title').textContent()
    const tasksCount = await ticketInQueue.getByTestId('task-card').count()

    // Drag back to Unqueued column
    await ticketInQueue.dragTo(projectPage.unqueuedColumn)

    // Verify ticket is back in Unqueued
    await expect(projectPage.unqueuedColumn.getByText(ticketTitle || '')).toBeVisible()
    await expect(featuresColumn.getByText(ticketTitle || '')).not.toBeVisible()

    // Verify tasks are also unqueued
    const unqueuedTasks = projectPage.unqueuedColumn.getByTestId('task-card')
    let unqueuedTasksFromTicket = 0
    
    for (let i = 0; i < await unqueuedTasks.count(); i++) {
      const task = unqueuedTasks.nth(i)
      const taskTicketInfo = await task.getByTestId('task-ticket').textContent()
      if (taskTicketInfo?.includes(ticketTitle || '')) {
        unqueuedTasksFromTicket++
      }
    }
    
    expect(unqueuedTasksFromTicket).toBe(tasksCount)
  })

  test('should maintain ticket-task relationships during moves', async ({ page }) => {
    const projectPage = new ProjectPage(page)
    await projectPage.goto('/projects/1')

    // Select a specific ticket with known tasks
    const authTicket = projectPage.ticketCard('Implement User Authentication')
    await expect(authTicket).toBeVisible()

    // Get current queue location
    const currentColumn = authTicket.locator('xpath=ancestor::*[@data-testid="queue-column" or @data-testid="unqueued-column"]')
    const currentQueueName = await currentColumn.getAttribute('data-queue-name')

    // Count tasks belonging to this ticket before move
    const tasksBeforeMove = authTicket.getByTestId('task-card')
    const taskCountBefore = await tasksBeforeMove.count()

    // Move to different queue
    const targetQueue = projectPage.queueColumn('Improvements')
    await authTicket.dragTo(targetQueue)

    // Verify ticket moved
    await expect(targetQueue.getByText('Implement User Authentication')).toBeVisible()

    // Verify all tasks moved and still belong to the ticket
    const movedTicket = targetQueue.getByTestId('ticket-card').filter({ hasText: 'Implement User Authentication' })
    const tasksAfterMove = movedTicket.getByTestId('task-card')
    
    await expect(tasksAfterMove).toHaveCount(taskCountBefore)

    // Verify task content is preserved
    await expect(tasksAfterMove.first()).toContainText('Design login UI')
    await expect(tasksAfterMove.nth(1)).toContainText('Implement JWT tokens')
  })
})
```

## Best Practices and Recommendations

### 1. Test Data Management
- **Isolation**: Each test creates its own project context to avoid interference
- **Cleanup**: Comprehensive cleanup after each test ensures no data pollution
- **Realistic Data**: Use representative file structures and content for accurate testing

### 2. MCP Integration Testing
- **Graceful Degradation**: Tests work with or without MCP server availability
- **Mock Fallbacks**: Comprehensive mocks ensure tests run in any environment
- **Error Handling**: Tests verify error states and recovery mechanisms

### 3. Async Operations Handling
- **Smart Waiting**: Use appropriate waits for file loading, queue updates, drag operations
- **Network Awareness**: Handle API calls and file system operations with proper timeouts
- **State Verification**: Ensure UI reflects backend state changes accurately

### 4. Performance Considerations
- **Large File Sets**: Test behavior with realistic project sizes
- **Concurrent Operations**: Verify drag-and-drop works with multiple simultaneous actions
- **Memory Management**: Monitor for memory leaks during extensive drag operations

### 5. Accessibility Testing
- **Keyboard Navigation**: Verify all drag-drop operations have keyboard alternatives
- **Screen Reader Support**: Ensure queue status and changes are announced
- **Focus Management**: Test focus behavior during modal operations

## Execution Strategy

### 1. Sequential Dependencies
Some tests should run in specific order:
1. **Basic Navigation** - Ensure page loads correctly
2. **Project Context Setup** - Establish baseline functionality
3. **MCP Integration** - Test with and without MCP availability
4. **Complex Workflows** - Multi-step operations requiring stable foundation

### 2. Parallel Execution Groups
Tests can run in parallel within these groups:
- **Prompt Management Tests** (isolated prompt operations)
- **File Tree Tests** (independent file system operations)  
- **Flow Feature Tests** (queue statistics and viewing)
- **Drag-and-Drop Tests** (independent board operations)

### 3. Resource Requirements
- **Database**: Isolated test database per test file
- **File System**: Temporary directories for each test
- **Network**: Mock external API calls for consistent results

This comprehensive test plan ensures the Project Page functionality is thoroughly validated across all major features, with special attention to complex drag-and-drop workflows, MCP integration, and realistic user scenarios.