/**
 * Shared Test Data System for Master Test Coordination
 *
 * This module provides centralized test data that can be safely shared across
 * all parallel test executions while maintaining proper isolation.
 */

import { TestDataFactory, type ProjectData, type PromptData, type QueueData, type TicketData } from './test-data'

/**
 * Shared test data that is available to all tests
 * These are read-only reference data that don't conflict between parallel tests
 */
export const SharedTestData = {
  /**
   * Default project used for testing basic functionality
   */
  defaultProject: TestDataFactory.createProject({
    name: 'Shared Test Project',
    path: '/tmp/shared-project-reference',
    description: 'Default project for E2E test scenarios - read-only reference'
  }),

  /**
   * Common prompt templates available to all tests
   */
  commonPrompts: TestDataFactory.createPromptSet(),

  /**
   * Standard test queues for workflow testing
   */
  testQueues: [
    TestDataFactory.createQueue({
      name: 'Features',
      description: 'Queue for feature development tasks',
      maxParallelItems: 3
    }),
    TestDataFactory.createQueue({
      name: 'Bugs',
      description: 'Queue for bug fix tasks',
      maxParallelItems: 5
    }),
    TestDataFactory.createQueue({
      name: 'Improvements',
      description: 'Queue for improvement tasks',
      maxParallelItems: 2
    })
  ],

  /**
   * Reference file structures for project testing
   */
  referenceFileStructures: {
    simpleProject: ['README.md', 'package.json', 'src/index.ts', 'src/utils.ts', 'tests/index.test.ts'],
    reactProject: [
      'README.md',
      'package.json',
      'src/App.tsx',
      'src/components/Button.tsx',
      'src/components/Header.tsx',
      'src/hooks/useCounter.ts',
      'tests/App.test.tsx'
    ],
    fullStackProject: [
      'README.md',
      'package.json',
      'frontend/src/App.tsx',
      'frontend/src/components/Layout.tsx',
      'backend/src/server.ts',
      'backend/src/routes/api.ts',
      'shared/types.ts'
    ]
  },

  /**
   * Common provider configurations for testing
   */
  providerConfigs: {
    openai: {
      name: 'OpenAI Test Provider',
      type: 'openai' as const,
      apiKey: 'sk-test-fake-key-for-testing',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo'
    },
    anthropic: {
      name: 'Anthropic Test Provider',
      type: 'anthropic' as const,
      apiKey: 'sk-ant-test-fake-key-for-testing',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-haiku-20240307'
    },
    local: {
      name: 'Local Test Provider',
      type: 'ollama' as const,
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama2'
    }
  }
}

/**
 * Test-specific data factories that create isolated data for individual tests
 * These ensure each test has its own unique data that won't conflict with parallel executions
 */
export class IsolatedTestDataFactory {
  private static testCounter = 0
  private static testRunId = Date.now()

  /**
   * Get a unique identifier for this test run
   */
  private static getTestId(): string {
    return `${this.testRunId}-${++this.testCounter}`
  }

  /**
   * Create a project with guaranteed unique identifiers
   */
  static createIsolatedProject(testName: string, overrides: Partial<ProjectData> = {}): ProjectData {
    const testId = this.getTestId()
    return TestDataFactory.createProject({
      name: `${testName}-Project-${testId}`,
      path: `/tmp/test-projects/${testName.toLowerCase().replace(/\s+/g, '-')}-${testId}`,
      description: `Isolated test project for ${testName} (ID: ${testId})`,
      ...overrides
    })
  }

  /**
   * Create prompts with test-specific namespacing
   */
  static createIsolatedPrompt(testName: string, overrides: Partial<PromptData> = {}): PromptData {
    const testId = this.getTestId()
    return TestDataFactory.createPrompt({
      title: `${testName}-Prompt-${testId}`,
      content: `Test prompt for ${testName} (ID: ${testId})\n\n{{task}}`,
      description: `Isolated test prompt for ${testName}`,
      tags: ['test', testName.toLowerCase().replace(/\s+/g, '-'), testId],
      ...overrides
    })
  }

  /**
   * Create tickets with unique identifiers and project associations
   */
  static createIsolatedTicket(testName: string, overrides: Partial<TicketData> = {}): TicketData {
    const testId = this.getTestId()
    return TestDataFactory.createTicket({
      title: `${testName}-Ticket-${testId}`,
      overview: `Isolated test ticket for ${testName} (ID: ${testId})`,
      priority: 'normal',
      tasks: [
        `Task 1 for ${testName} test ${testId}`,
        `Task 2 for ${testName} test ${testId}`,
        `Task 3 for ${testName} test ${testId}`
      ],
      ...overrides
    })
  }

  /**
   * Create queues with test-specific configuration
   */
  static createIsolatedQueue(testName: string, overrides: Partial<QueueData> = {}): QueueData {
    const testId = this.getTestId()
    return TestDataFactory.createQueue({
      name: `${testName}-Queue-${testId}`,
      description: `Isolated test queue for ${testName} (ID: ${testId})`,
      maxParallelItems: 1, // Default to 1 for isolated testing
      ...overrides
    })
  }

  /**
   * Create a complete isolated test scenario
   */
  static createIsolatedScenario(testName: string): {
    project: ProjectData
    prompts: PromptData[]
    tickets: TicketData[]
    queue: QueueData
    testId: string
  } {
    const testId = this.getTestId()

    const project = this.createIsolatedProject(testName)

    const prompts = [
      this.createIsolatedPrompt(testName, {
        title: `${testName}-CodeReview-${testId}`,
        content: 'Review this code and provide feedback:\n\n{{code}}',
        tags: ['code', 'review', testName.toLowerCase()]
      }),
      this.createIsolatedPrompt(testName, {
        title: `${testName}-Documentation-${testId}`,
        content: 'Generate documentation for:\n\n{{feature}}',
        tags: ['docs', 'generation', testName.toLowerCase()]
      })
    ]

    const tickets = [
      this.createIsolatedTicket(testName, {
        title: `${testName}-Setup-${testId}`,
        overview: `Setup task for ${testName} test scenario`,
        priority: 'high'
      }),
      this.createIsolatedTicket(testName, {
        title: `${testName}-Implementation-${testId}`,
        overview: `Implementation task for ${testName} test scenario`,
        priority: 'normal'
      })
    ]

    const queue = this.createIsolatedQueue(testName)

    return { project, prompts, tickets, queue, testId }
  }

  /**
   * Reset the counter for a new test run (useful for test setup)
   */
  static resetForNewTestRun(): void {
    this.testCounter = 0
    this.testRunId = Date.now()
  }
}

/**
 * Database isolation patterns for test data
 */
export const DatabaseIsolationConfig = {
  /**
   * Memory database configuration for complete isolation
   */
  memoryDatabase: {
    databasePath: ':memory:',
    autoMigrate: true,
    cleanupOnExit: true
  },

  /**
   * Test database configuration with unique names
   */
  createTestDatabaseConfig: (testName: string) => ({
    databasePath: `/tmp/test-databases/${testName.replace(/\s+/g, '-')}-${Date.now()}.db`,
    autoMigrate: true,
    cleanupOnExit: true
  }),

  /**
   * Database cleanup utilities
   */
  cleanup: {
    async cleanupTestDatabases() {
      // This would be implemented by the specific test framework
      console.log('Cleaning up test databases...')
    },

    async resetDatabase() {
      // Reset to clean state for next test
      console.log('Resetting database to clean state...')
    }
  }
}

/**
 * MCP integration test data and configuration
 */
export const MCPTestData = {
  /**
   * Test project configurations for MCP integration testing
   */
  mcpProjects: {
    simpleProject: {
      ...SharedTestData.defaultProject,
      name: 'MCP Simple Project',
      path: '/tmp/mcp-simple-project'
    },

    complexProject: TestDataFactory.createProject({
      name: 'MCP Complex Project',
      path: '/tmp/mcp-complex-project',
      description: 'Complex project for testing MCP integration with multiple features'
    })
  },

  /**
   * Mock MCP responses for testing without actual MCP server
   */
  mockResponses: {
    projectList: [
      { id: 1, name: 'Mock Project 1', path: '/mock/project1' },
      { id: 2, name: 'Mock Project 2', path: '/mock/project2' }
    ],

    promptList: [
      { id: 1, title: 'Mock Prompt 1', content: 'Mock prompt content' },
      { id: 2, title: 'Mock Prompt 2', content: 'Another mock prompt' }
    ],

    ticketList: [
      { id: 1, title: 'Mock Ticket 1', overview: 'Mock ticket overview' },
      { id: 2, title: 'Mock Ticket 2', overview: 'Another mock ticket' }
    ]
  },

  /**
   * MCP server health check responses
   */
  healthCheckResponses: {
    healthy: { status: 'ok', timestamp: Date.now() },
    unhealthy: { status: 'error', message: 'MCP server unavailable' },
    timeout: null // Simulates timeout scenario
  }
}

/**
 * Performance test data for large-scale testing
 */
export const PerformanceTestData = {
  /**
   * Generate large datasets for performance testing
   */
  createLargeProjectSet(count = 100): ProjectData[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createProject({
        name: `Performance Test Project ${i + 1}`,
        path: `/tmp/perf-projects/project-${i + 1}`,
        description: `Performance testing project ${i + 1} of ${count}`
      })
    )
  },

  createLargePromptSet(count = 200): PromptData[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createPrompt({
        title: `Performance Test Prompt ${i + 1}`,
        content: `This is performance test prompt ${i + 1} of ${count}.\n\n{{input}}`,
        tags: ['performance', 'test', `batch-${Math.floor(i / 50)}`]
      })
    )
  },

  createLargeTicketSet(count = 500): TicketData[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createTicket({
        title: `Performance Test Ticket ${i + 1}`,
        overview: `Performance testing ticket ${i + 1} of ${count}`,
        priority: ['low', 'normal', 'high'][i % 3] as 'low' | 'normal' | 'high',
        tasks: Array.from(
          { length: Math.floor(Math.random() * 5) + 1 },
          (_, j) => `Task ${j + 1} for performance ticket ${i + 1}`
        )
      })
    )
  }
}

/**
 * Export all shared test data for easy access
 */
export default {
  SharedTestData,
  IsolatedTestDataFactory,
  DatabaseIsolationConfig,
  MCPTestData,
  PerformanceTestData
}
