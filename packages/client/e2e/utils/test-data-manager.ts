/**
 * Test Data Manager for Isolation and Cleanup
 * 
 * This module provides comprehensive test data management with isolation,
 * cleanup, and coordination for parallel test execution.
 */

import { Page, TestInfo } from '@playwright/test'
import { IsolatedTestDataFactory, DatabaseIsolationConfig } from '../fixtures/shared-test-data'
import type { ProjectData, PromptData, TicketData, QueueData } from '../fixtures/test-data'

/**
 * Test data scope for managing isolated test data
 */
interface TestDataScope {
  testId: string
  testName: string
  projects: ProjectData[]
  prompts: PromptData[]
  tickets: TicketData[]
  queues: QueueData[]
  createdAt: number
  page?: Page
}

/**
 * Cleanup registry to track resources that need cleanup
 */
interface CleanupRegistry {
  databases: string[]
  temporaryFiles: string[]
  mcpConnections: string[]
  apiSessions: string[]
  backgroundProcesses: number[]
}

/**
 * Test Data Manager class for coordinating test data lifecycle
 */
export class TestDataManager {
  private scope: TestDataScope
  private cleanupRegistry: CleanupRegistry
  private page: Page
  private testInfo?: TestInfo

  constructor(page: Page, testInfo?: TestInfo) {
    this.page = page
    this.testInfo = testInfo
    
    const testName = testInfo?.title || 'Unknown Test'
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    this.scope = {
      testId,
      testName,
      projects: [],
      prompts: [],
      tickets: [],
      queues: [],
      createdAt: Date.now(),
      page
    }

    this.cleanupRegistry = {
      databases: [],
      temporaryFiles: [],
      mcpConnections: [],
      apiSessions: [],
      backgroundProcesses: []
    }
  }

  /**
   * Create isolated project data for this test
   */
  async createProject(overrides: Partial<ProjectData> = {}): Promise<ProjectData> {
    const project = IsolatedTestDataFactory.createIsolatedProject(
      this.scope.testName,
      overrides
    )
    
    this.scope.projects.push(project)
    
    // Register for cleanup if it creates files/directories
    if (project.path && project.path.startsWith('/tmp/')) {
      this.cleanupRegistry.temporaryFiles.push(project.path)
    }
    
    return project
  }

  /**
   * Create isolated prompt data for this test
   */
  async createPrompt(overrides: Partial<PromptData> = {}): Promise<PromptData> {
    const prompt = IsolatedTestDataFactory.createIsolatedPrompt(
      this.scope.testName,
      overrides
    )
    
    this.scope.prompts.push(prompt)
    return prompt
  }

  /**
   * Create isolated ticket data for this test
   */
  async createTicket(overrides: Partial<TicketData> = {}): Promise<TicketData> {
    const ticket = IsolatedTestDataFactory.createIsolatedTicket(
      this.scope.testName,
      overrides
    )
    
    this.scope.tickets.push(ticket)
    return ticket
  }

  /**
   * Create isolated queue data for this test
   */
  async createQueue(overrides: Partial<QueueData> = {}): Promise<QueueData> {
    const queue = IsolatedTestDataFactory.createIsolatedQueue(
      this.scope.testName,
      overrides
    )
    
    this.scope.queues.push(queue)
    return queue
  }

  /**
   * Create a complete isolated test scenario
   */
  async createScenario(): Promise<{
    project: ProjectData
    prompts: PromptData[]
    tickets: TicketData[]
    queue: QueueData
  }> {
    const scenario = IsolatedTestDataFactory.createIsolatedScenario(this.scope.testName)
    
    this.scope.projects.push(scenario.project)
    this.scope.prompts.push(...scenario.prompts)
    this.scope.tickets.push(...scenario.tickets)
    this.scope.queues.push(scenario.queue)
    
    return scenario
  }

  /**
   * Set up isolated database for this test
   */
  async setupIsolatedDatabase(): Promise<void> {
    const dbConfig = DatabaseIsolationConfig.createTestDatabaseConfig(this.scope.testName)
    
    // Register database for cleanup
    this.cleanupRegistry.databases.push(dbConfig.databasePath)
    
    // Set environment variables for isolated database
    await this.page.evaluate((config) => {
      window.localStorage.setItem('test-database-config', JSON.stringify(config))
    }, dbConfig)
  }

  /**
   * Begin database transaction for rollback-based testing
   */
  async beginTransaction(): Promise<void> {
    await this.page.evaluate(() => {
      // Signal to the application to begin a transaction
      window.localStorage.setItem('test-transaction-mode', 'true')
    })
  }

  /**
   * Rollback database transaction
   */
  async rollbackTransaction(): Promise<void> {
    await this.page.evaluate(() => {
      // Signal to the application to rollback the transaction
      window.localStorage.setItem('test-rollback-requested', 'true')
    })
  }

  /**
   * Create unique temporary directory for file operations
   */
  async createTempDirectory(): Promise<string> {
    const tempDir = `/tmp/playwright-test-${this.scope.testId}`
    this.cleanupRegistry.temporaryFiles.push(tempDir)
    return tempDir
  }

  /**
   * Register a background process for cleanup
   */
  registerBackgroundProcess(pid: number): void {
    this.cleanupRegistry.backgroundProcesses.push(pid)
  }

  /**
   * Register MCP connection for cleanup
   */
  registerMCPConnection(connectionId: string): void {
    this.cleanupRegistry.mcpConnections.push(connectionId)
  }

  /**
   * Register API session for cleanup
   */
  registerAPISession(sessionId: string): void {
    this.cleanupRegistry.apiSessions.push(sessionId)
  }

  /**
   * Get current test scope information
   */
  getScope(): TestDataScope {
    return { ...this.scope }
  }

  /**
   * Get cleanup registry
   */
  getCleanupRegistry(): CleanupRegistry {
    return { ...this.cleanupRegistry }
  }

  /**
   * Comprehensive cleanup of all test resources
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = []

    try {
      // Cleanup database transactions
      await this.rollbackTransaction()
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      // Cleanup databases
      await this.cleanupDatabases()
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      // Cleanup temporary files
      await this.cleanupTemporaryFiles()
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      // Cleanup MCP connections
      await this.cleanupMCPConnections()
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      // Cleanup API sessions
      await this.cleanupAPISessions()
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      // Cleanup background processes
      await this.cleanupBackgroundProcesses()
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      // Clear browser storage
      await this.clearBrowserStorage()
    } catch (error) {
      errors.push(error as Error)
    }

    // Log any cleanup errors but don't fail the test
    if (errors.length > 0) {
      console.warn(`Test cleanup encountered ${errors.length} errors:`)
      errors.forEach((error, index) => {
        console.warn(`  ${index + 1}. ${error.message}`)
      })
    }
  }

  /**
   * Cleanup databases created during test
   */
  private async cleanupDatabases(): Promise<void> {
    for (const dbPath of this.cleanupRegistry.databases) {
      try {
        if (dbPath !== ':memory:') {
          // Signal the application to cleanup the database
          await this.page.evaluate((path) => {
            window.localStorage.setItem('cleanup-database', path)
          }, dbPath)
        }
      } catch (error) {
        console.warn(`Failed to cleanup database ${dbPath}:`, error)
      }
    }
  }

  /**
   * Cleanup temporary files and directories
   */
  private async cleanupTemporaryFiles(): Promise<void> {
    for (const filePath of this.cleanupRegistry.temporaryFiles) {
      try {
        // Signal the application to cleanup the file/directory
        await this.page.evaluate((path) => {
          window.localStorage.setItem('cleanup-file', path)
        }, filePath)
      } catch (error) {
        console.warn(`Failed to cleanup file ${filePath}:`, error)
      }
    }
  }

  /**
   * Cleanup MCP connections
   */
  private async cleanupMCPConnections(): Promise<void> {
    for (const connectionId of this.cleanupRegistry.mcpConnections) {
      try {
        await this.page.evaluate((id) => {
          window.localStorage.setItem('cleanup-mcp-connection', id)
        }, connectionId)
      } catch (error) {
        console.warn(`Failed to cleanup MCP connection ${connectionId}:`, error)
      }
    }
  }

  /**
   * Cleanup API sessions
   */
  private async cleanupAPISessions(): Promise<void> {
    for (const sessionId of this.cleanupRegistry.apiSessions) {
      try {
        await this.page.evaluate((id) => {
          window.localStorage.setItem('cleanup-api-session', id)
        }, sessionId)
      } catch (error) {
        console.warn(`Failed to cleanup API session ${sessionId}:`, error)
      }
    }
  }

  /**
   * Cleanup background processes
   */
  private async cleanupBackgroundProcesses(): Promise<void> {
    for (const pid of this.cleanupRegistry.backgroundProcesses) {
      try {
        await this.page.evaluate((processId) => {
          window.localStorage.setItem('cleanup-process', processId.toString())
        }, pid)
      } catch (error) {
        console.warn(`Failed to cleanup process ${pid}:`, error)
      }
    }
  }

  /**
   * Clear browser storage used during test
   */
  private async clearBrowserStorage(): Promise<void> {
    await this.page.evaluate(() => {
      // Clear localStorage items created during test
      const keysToKeep = ['theme', 'user-preferences']
      const allKeys = Object.keys(localStorage)
      
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key)
        }
      })
      
      // Clear sessionStorage
      sessionStorage.clear()
    })
  }
}

/**
 * Global Test Coordinator for managing test execution order and resource allocation
 */
export class GlobalTestCoordinator {
  private static instance: GlobalTestCoordinator
  private activeTests: Map<string, TestDataManager> = new Map()
  private resourceLocks: Map<string, string> = new Map()
  private testMetrics: Map<string, TestMetrics> = new Map()

  interface TestMetrics {
    startTime: number
    endTime?: number
    dataCreated: number
    cleanupTime?: number
    errors: string[]
  }

  private constructor() {}

  static getInstance(): GlobalTestCoordinator {
    if (!this.instance) {
      this.instance = new GlobalTestCoordinator()
    }
    return this.instance
  }

  /**
   * Register a test and its data manager
   */
  registerTest(testId: string, dataManager: TestDataManager): void {
    this.activeTests.set(testId, dataManager)
    this.testMetrics.set(testId, {
      startTime: Date.now(),
      dataCreated: 0,
      errors: []
    })
  }

  /**
   * Unregister a test after completion
   */
  unregisterTest(testId: string): void {
    const metrics = this.testMetrics.get(testId)
    if (metrics) {
      metrics.endTime = Date.now()
    }
    
    this.activeTests.delete(testId)
  }

  /**
   * Request exclusive access to a resource
   */
  async requestResourceLock(resource: string, testId: string): Promise<boolean> {
    if (this.resourceLocks.has(resource)) {
      const currentOwner = this.resourceLocks.get(resource)
      if (currentOwner !== testId) {
        return false // Resource is locked by another test
      }
    }
    
    this.resourceLocks.set(resource, testId)
    return true
  }

  /**
   * Release a resource lock
   */
  releaseResourceLock(resource: string, testId: string): void {
    const currentOwner = this.resourceLocks.get(resource)
    if (currentOwner === testId) {
      this.resourceLocks.delete(resource)
    }
  }

  /**
   * Get current test execution statistics
   */
  getExecutionStats(): {
    activeTests: number
    lockedResources: number
    avgTestDuration: number
    totalErrors: number
  } {
    const completedMetrics = Array.from(this.testMetrics.values())
      .filter(m => m.endTime)
    
    const avgDuration = completedMetrics.length > 0
      ? completedMetrics.reduce((sum, m) => sum + (m.endTime! - m.startTime), 0) / completedMetrics.length
      : 0

    const totalErrors = Array.from(this.testMetrics.values())
      .reduce((sum, m) => sum + m.errors.length, 0)

    return {
      activeTests: this.activeTests.size,
      lockedResources: this.resourceLocks.size,
      avgTestDuration: avgDuration,
      totalErrors
    }
  }

  /**
   * Perform emergency cleanup of all active tests
   */
  async emergencyCleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.activeTests.values())
      .map(dataManager => dataManager.cleanup())

    await Promise.allSettled(cleanupPromises)
    
    this.activeTests.clear()
    this.resourceLocks.clear()
  }
}

/**
 * Utility functions for test data coordination
 */
export const TestCoordinationUtils = {
  /**
   * Create a test data manager with automatic registration
   */
  createDataManager(page: Page, testInfo?: TestInfo): TestDataManager {
    const manager = new TestDataManager(page, testInfo)
    const coordinator = GlobalTestCoordinator.getInstance()
    
    if (testInfo) {
      coordinator.registerTest(testInfo.testId, manager)
    }
    
    return manager
  },

  /**
   * Wait for resource availability
   */
  async waitForResource(resource: string, testId: string, timeout = 30000): Promise<boolean> {
    const coordinator = GlobalTestCoordinator.getInstance()
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (await coordinator.requestResourceLock(resource, testId)) {
        return true
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return false
  },

  /**
   * Generate unique test identifiers to avoid conflicts
   */
  generateUniqueId(prefix = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },

  /**
   * Create test-specific selectors to avoid conflicts
   */
  createTestSelector(testId: string, element: string): string {
    return `[data-testid="${testId}-${element}"]`
  }
}