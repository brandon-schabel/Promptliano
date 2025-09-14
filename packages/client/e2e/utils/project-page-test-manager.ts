/**
 * Project Page Test Data Manager
 * Specialized utilities for Project Page test setup, isolation, and cleanup
 */

import { Page, TestInfo } from '@playwright/test'
import { TestDataManager } from './test-data-manager'
import { MCPTestHelpers } from './mcp-test-helpers'
import {
  ProjectPageTestData,
  ProjectPageDataFactory,
  type ProjectPageTestContext,
  type FileStructureData
} from '../fixtures/project-page-data'
import type { ProjectData, PromptData, QueueData, TicketData } from '../fixtures/test-data'

/**
 * Project-specific test data configuration
 */
interface ProjectPageTestConfig {
  enableMCP?: boolean
  mockFileSystem?: boolean
  useRealGit?: boolean
  simulateLargeProjects?: boolean
  enableDragDrop?: boolean
  mockNetworkDelay?: boolean
}

/**
 * Enhanced TestDataManager for Project Page testing
 */
export class ProjectPageTestManager extends TestDataManager {
  private config: ProjectPageTestConfig
  private mcpHelpers: typeof MCPTestHelpers

  constructor(page: Page, testInfo?: TestInfo, config: ProjectPageTestConfig = {}) {
    super(page, testInfo)
    this.config = {
      enableMCP: true,
      mockFileSystem: true,
      useRealGit: false,
      simulateLargeProjects: false,
      enableDragDrop: true,
      mockNetworkDelay: false,
      ...config
    }
    this.mcpHelpers = MCPTestHelpers
  }

  // ========================================
  // PROJECT PAGE SPECIFIC SETUP METHODS
  // ========================================

  /**
   * Setup complete project page test environment
   */
  async setupProjectPageEnvironment(context?: Partial<ProjectPageTestContext>): Promise<ProjectPageTestContext> {
    const testContext = ProjectPageDataFactory.createTestContext(context)

    // Setup MCP integration if enabled
    if (this.config.enableMCP) {
      await this.setupMCPIntegration()
    }

    // Setup file system mocking
    if (this.config.mockFileSystem) {
      await this.setupFileSystemMocks(testContext.fileStructure)
    }

    // Setup git integration
    if (this.config.useRealGit) {
      await this.setupGitIntegration(testContext.testProject.path)
    } else {
      await this.setupGitMocks()
    }

    // Setup network delays for realistic testing
    if (this.config.mockNetworkDelay) {
      await this.setupNetworkDelays()
    }

    // Setup drag-and-drop functionality
    if (this.config.enableDragDrop) {
      await this.setupDragDropCapabilities()
    }

    // Create project data via API/MCP
    await this.createProjectData(testContext)

    return testContext
  }

  /**
   * Setup MCP integration with fallback to mocks
   */
  private async setupMCPIntegration(): Promise<void> {
    const mcpEnvironment = await this.mcpHelpers.createMCPTestEnvironment(this.page, {
      enableMocks: true,
      mockTools: ['project_manager', 'flow_manager', 'prompt_manager'],
      requireReal: false
    })

    // Register MCP connection for cleanup
    if (mcpEnvironment.mcpAvailable) {
      this.registerMCPConnection('project-page-mcp')
    }
  }

  /**
   * Setup file system mocks for testing
   */
  private async setupFileSystemMocks(fileStructure: FileStructureData): Promise<void> {
    await this.page.route('**/api/files/**', async (route) => {
      const url = route.request().url()

      if (url.includes('/tree')) {
        // Return file tree structure
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: this.convertFileStructureToTree(fileStructure)
          })
        })
      } else if (url.includes('/content/')) {
        // Return file content
        const filePath = url.split('/content/')[1]
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              path: filePath,
              content: ProjectPageDataFactory.generateFileContent(filePath),
              tokens: Math.floor(Math.random() * 500) + 50 // Mock token count
            }
          })
        })
      } else {
        // Default file operation response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      }
    })
  }

  /**
   * Setup git integration mocks
   */
  private async setupGitMocks(): Promise<void> {
    await this.page.route('**/api/git/**', async (route) => {
      const url = route.request().url()

      if (url.includes('/status')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              modified: ['src/auth/login.ts', 'src/components/ui/Button.tsx'],
              staged: ['src/auth/register.ts'],
              untracked: ['temp-file.js'],
              branch: 'main'
            }
          })
        })
      } else if (url.includes('/diff/')) {
        const filePath = url.split('/diff/')[1]
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              path: filePath,
              diff: `@@ -1,5 +1,5 @@\n function example() {\n-  console.log('old');\n+  console.log('new');\n }`
            }
          })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      }
    })
  }

  /**
   * Setup network delays for realistic testing
   */
  private async setupNetworkDelays(): Promise<void> {
    await this.page.route('**/api/**', async (route) => {
      // Add random delay between 100-500ms
      const delay = Math.floor(Math.random() * 400) + 100
      await new Promise((resolve) => setTimeout(resolve, delay))
      route.continue()
    })
  }

  /**
   * Setup drag-and-drop capabilities
   */
  private async setupDragDropCapabilities(): Promise<void> {
    await this.page.addInitScript(() => {
      // Enable drag and drop for all relevant elements
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = `
          [data-testid="ticket-card"] {
            cursor: move;
          }
          [data-testid*="column"] {
            min-height: 200px;
          }
          .dragging {
            opacity: 0.5;
            transform: rotate(5deg);
          }
        `
        document.head.appendChild(style)
      })
    })
  }

  // ========================================
  // DATA CREATION METHODS
  // ========================================

  /**
   * Create all project data via API or MCP
   */
  private async createProjectData(context: ProjectPageTestContext): Promise<void> {
    // Create project
    await this.createProjectViaAPI(context.testProject)

    // Create prompts
    for (const prompt of context.testPrompts) {
      await this.createPromptViaAPI(prompt)
    }

    // Create queues
    for (const queue of context.testQueues) {
      await this.createQueueViaAPI(queue)
    }

    // Create tickets
    for (const ticket of context.testTickets) {
      await this.createTicketViaAPI(ticket)
    }
  }

  /**
   * Create project via API endpoint
   */
  private async createProjectViaAPI(project: ProjectData): Promise<void> {
    await this.page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...project, id: 1 }
          })
        })
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{ ...project, id: 1 }]
          })
        })
      } else {
        route.continue()
      }
    })

    // Mock project details endpoint
    await this.page.route('**/api/projects/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ...project, id: 1 }
        })
      })
    })
  }

  /**
   * Create prompts via API endpoint
   */
  private async createPromptViaAPI(prompt: PromptData): Promise<void> {
    await this.page.route('**/api/prompts**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: ProjectPageTestData.testPrompts.map((p, index) => ({ ...p, id: index + 1 }))
          })
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Create queues via API endpoint
   */
  private async createQueueViaAPI(queue: QueueData): Promise<void> {
    await this.page.route('**/api/queues**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: ProjectPageTestData.testQueues.map((q, index) => ({
              ...q,
              id: index + 1,
              itemCount: Math.floor(Math.random() * 10),
              inProgressCount: Math.floor(Math.random() * 3),
              completedCount: Math.floor(Math.random() * 15)
            }))
          })
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Create tickets via API endpoint
   */
  private async createTicketViaAPI(ticket: TicketData): Promise<void> {
    await this.page.route('**/api/tickets**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: ProjectPageTestData.testTickets.map((t, index) => ({
              ...t,
              id: index + 1,
              tasks: ProjectPageDataFactory.createTasksForTicket(t.title, 5),
              queueId: index % 3 === 0 ? null : (index % 3) + 1 // Some unqueued, some in queues
            }))
          })
        })
      } else {
        route.continue()
      }
    })
  }

  // ========================================
  // SPECIALIZED SETUP METHODS
  // ========================================

  /**
   * Setup project with specific prompts
   */
  async setupProjectPrompts(prompts: PromptData[]): Promise<void> {
    await this.page.route('**/api/projects/*/prompts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: prompts.map((p, index) => ({ ...p, id: index + 1 }))
        })
      })
    })
  }

  /**
   * Setup project with realistic file structure
   */
  async setupProjectWithFiles(fileStructure: Record<string, string[] | string>): Promise<void> {
    const convertedStructure = this.convertSimpleFileStructure(fileStructure)
    await this.setupFileSystemMocks(convertedStructure)
  }

  /**
   * Setup git-modified file for testing
   */
  async setupGitModifiedFile(filePath: string): Promise<void> {
    await this.page.route(`**/api/git/status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            modified: [filePath],
            staged: [],
            untracked: []
          }
        })
      })
    })
  }

  /**
   * Setup staged file for testing
   */
  async setupStagedFile(filePath: string): Promise<void> {
    await this.page.route(`**/api/git/status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            modified: [],
            staged: [filePath],
            untracked: []
          }
        })
      })
    })
  }

  /**
   * Setup flow test data with queues and tickets
   */
  async setupFlowTestData(queues: QueueData[], tickets: TicketData[]): Promise<void> {
    // Setup queues
    await this.page.route('**/api/queues**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: queues.map((q, index) => ({
            ...q,
            id: index + 1,
            activeCount: Math.floor(Math.random() * 3),
            totalCount: Math.floor(Math.random() * 10) + 5,
            inProgressCount: Math.floor(Math.random() * 3)
          }))
        })
      })
    })

    // Setup tickets with queue assignments
    await this.page.route('**/api/tickets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: tickets.map((t, index) => ({
            ...t,
            id: index + 1,
            queueId: index < 3 ? index + 1 : null, // First 3 tickets in queues
            status: ['pending', 'in_progress', 'completed'][index % 3],
            tasks: ProjectPageDataFactory.createTasksForTicket(t.title)
          }))
        })
      })
    })
  }

  /**
   * Mock flow test data (when MCP not available)
   */
  async mockFlowTestData(queues: QueueData[], tickets: TicketData[]): Promise<void> {
    // Same as setupFlowTestData but with additional mocking indicators
    await this.setupFlowTestData(queues, tickets)

    // Add mock indicators to the page
    await this.page.addInitScript(() => {
      ;(window as any).__FLOW_TEST_MODE = 'mock'
    })
  }

  /**
   * Setup task queue board data for drag-and-drop testing
   */
  async setupTaskQueueBoardData(config: {
    queues: QueueData[]
    tickets: TicketData[]
    unqueuedTickets?: number
  }): Promise<void> {
    const { queues, tickets, unqueuedTickets = 2 } = config

    // Create additional unqueued tickets
    const unqueuedTicketData = Array.from({ length: unqueuedTickets }, (_, index) => ({
      ...ProjectPageDataFactory.createMinimalContext('tickets'),
      id: 1000 + index,
      title: `Unqueued Ticket ${index + 1}`,
      overview: `Ticket waiting for queue assignment ${index + 1}`,
      queueId: null,
      status: 'pending' as const
    }))

    // Setup combined ticket data
    const allTickets = [
      ...tickets.map((t, index) => ({
        ...t,
        id: index + 1,
        queueId: (index % queues.length) + 1,
        tasks: ProjectPageDataFactory.createTasksForTicket(t.title)
      })),
      ...unqueuedTicketData
    ]

    await this.page.route('**/api/board/tickets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: allTickets
        })
      })
    })

    // Setup drag-and-drop API endpoints
    await this.page.route('**/api/tickets/*/queue', async (route) => {
      if (route.request().method() === 'PUT') {
        const postData = await route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ticketId: postData.ticketId,
              queueId: postData.queueId,
              message: postData.queueId ? `Ticket added to queue ${postData.queueId}` : 'Ticket moved to Unqueued'
            }
          })
        })
      } else {
        route.continue()
      }
    })
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Convert file structure to tree format expected by frontend
   */
  private convertFileStructureToTree(structure: FileStructureData, parentPath = ''): any[] {
    const tree: any[] = []

    for (const [name, content] of Object.entries(structure)) {
      const path = parentPath ? `${parentPath}/${name}` : name

      if (typeof content === 'string') {
        // File
        tree.push({
          name,
          path,
          type: 'file',
          size: content.length,
          tokens: Math.floor(content.length / 4), // Rough token estimate
          modified: Date.now() - Math.floor(Math.random() * 86400000), // Random time in last day
          gitStatus: Math.random() > 0.8 ? 'modified' : null
        })
      } else {
        // Directory
        tree.push({
          name,
          path,
          type: 'directory',
          children: this.convertFileStructureToTree(content, path),
          expanded: Math.random() > 0.5
        })
      }
    }

    return tree
  }

  /**
   * Convert simple file structure format to FileStructureData
   */
  private convertSimpleFileStructure(simple: Record<string, string[] | string>): FileStructureData {
    const converted: FileStructureData = {}

    for (const [key, value] of Object.entries(simple)) {
      if (Array.isArray(value)) {
        // It's a directory with files
        const dirContent: FileStructureData = {}
        for (const fileName of value) {
          dirContent[fileName] = ProjectPageDataFactory.generateFileContent(fileName)
        }
        converted[key] = dirContent
      } else {
        // It's a file
        converted[key] = value || ProjectPageDataFactory.generateFileContent(key)
      }
    }

    return converted
  }

  /**
   * Verify test environment is ready
   */
  async verifyEnvironmentReady(): Promise<boolean> {
    try {
      // Check that all main components are accessible
      await this.page.waitForSelector('[data-testid="project-context-tab"]', { timeout: 5000 })
      await this.page.waitForSelector('[data-testid="file-tree"]', { timeout: 5000 })
      await this.page.waitForSelector('[data-testid="project-prompts"]', { timeout: 5000 })
      await this.page.waitForSelector('[data-testid="flow-section"]', { timeout: 5000 })
      await this.page.waitForSelector('[data-testid="task-queue-board"]', { timeout: 5000 })

      return true
    } catch (error) {
      console.warn('Project page environment not ready:', error)
      return false
    }
  }

  /**
   * Get current test configuration
   */
  getConfig(): ProjectPageTestConfig {
    return { ...this.config }
  }

  /**
   * Update test configuration
   */
  updateConfig(updates: Partial<ProjectPageTestConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}

/**
 * Utility functions for Project Page testing
 */
export const ProjectPageTestUtils = {
  /**
   * Create test manager with standard configuration
   */
  createManager(page: Page, testInfo?: TestInfo, config?: ProjectPageTestConfig): ProjectPageTestManager {
    return new ProjectPageTestManager(page, testInfo, config)
  },

  /**
   * Create manager for specific test scenario
   */
  createManagerForScenario(
    page: Page,
    scenario: 'minimal' | 'full' | 'performance' | 'drag-drop',
    testInfo?: TestInfo
  ): ProjectPageTestManager {
    const configs = {
      minimal: {
        enableMCP: false,
        mockFileSystem: true,
        useRealGit: false,
        simulateLargeProjects: false,
        enableDragDrop: false,
        mockNetworkDelay: false
      },
      full: {
        enableMCP: true,
        mockFileSystem: true,
        useRealGit: false,
        simulateLargeProjects: false,
        enableDragDrop: true,
        mockNetworkDelay: true
      },
      performance: {
        enableMCP: true,
        mockFileSystem: true,
        useRealGit: false,
        simulateLargeProjects: true,
        enableDragDrop: true,
        mockNetworkDelay: false
      },
      'drag-drop': {
        enableMCP: true,
        mockFileSystem: false,
        useRealGit: false,
        simulateLargeProjects: false,
        enableDragDrop: true,
        mockNetworkDelay: false
      }
    }

    return new ProjectPageTestManager(page, testInfo, configs[scenario])
  },

  /**
   * Wait for project page to be fully loaded
   */
  async waitForProjectPageReady(page: Page, timeout = 10000): Promise<boolean> {
    try {
      await page.waitForSelector('[data-testid="project-context-tab"]', { timeout })
      await page.waitForLoadState('networkidle')
      return true
    } catch (error) {
      return false
    }
  }
}
