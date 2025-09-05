/**
 * Enhanced Test Helpers and Utilities
 * 
 * Comprehensive testing utilities for the API client test suite including:
 * - Data factories for all entities
 * - Assertion helpers for common validations
 * - Test data management with automatic cleanup
 * - Performance tracking utilities
 * - Retry mechanisms for flaky operations
 */

import type { PromptlianoClient } from '../../index'
import { PromptlianoError } from '../../index'

// ============================================================================
// Data Factories - Create test data with sensible defaults
// ============================================================================

export const factories = {
  // Project-related factories
  createProjectData: (overrides = {}) => ({
    name: `Test Project ${Date.now()}`,
    path: `/tmp/test-project-${Date.now()}`,
    description: 'Test project description',
    ...overrides
  }),

  createFileData: (overrides = {}) => ({
    path: `test-file-${Date.now()}.ts`,
    name: `test-file-${Date.now()}.ts`,
    content: 'console.log("test file");',
    extension: '.ts',
    size: 26,
    ...overrides
  }),

  // Ticket & Task factories
  createTicketData: (overrides = {}) => ({
    title: `Test Ticket ${Date.now()}`,
    description: 'Test ticket description',
    priority: 'normal' as const,
    status: 'open' as const,
    overview: 'Test ticket overview',
    ...overrides
  }),

  createTaskData: (overrides = {}) => ({
    content: `Test task ${Date.now()}`,
    description: 'Test task description',
    done: false,
    estimatedHours: 2,
    tags: ['test'],
    ...overrides
  }),

  // Queue-related factories
  createQueueData: (overrides = {}) => ({
    name: `Test Queue ${Date.now()}`,
    description: 'Test queue description',
    maxParallelItems: 3,
    ...overrides
  }),

  createQueueItemData: (overrides = {}) => ({
    type: 'ticket' as const,
    itemId: 1,
    priority: 5,
    metadata: {},
    ...overrides
  }),

  // Chat-related factories
  createChatData: (overrides = {}) => ({
    name: `Test Chat ${Date.now()}`,
    description: 'Test chat description',
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.7,
    maxTokens: 1000,
    ...overrides
  }),

  createMessageData: (overrides = {}) => ({
    role: 'user' as const,
    content: 'Test message content',
    metadata: {},
    ...overrides
  }),

  // Prompt-related factories
  createPromptData: (overrides = {}) => ({
    name: `Test Prompt ${Date.now()}`,
    content: 'Test prompt content:\n\n{{variable}}',
    description: 'Test prompt description',
    tags: ['test', 'automated'],
    variables: ['variable'],
    ...overrides
  }),

  // Provider key factories
  createProviderKeyData: (overrides = {}) => ({
    provider: 'openai' as const,
    keyName: `test-key-${Date.now()}`,
    encryptedKey: 'encrypted-test-key',
    isActive: true,
    ...overrides
  }),

  // AI-specific factories
  createCompletionRequest: (overrides = {}) => ({
    prompt: 'Write a hello world function in TypeScript:',
    maxTokens: 100,
    temperature: 0.3,
    model: 'gpt-3.5-turbo',
    ...overrides
  }),

  createChatRequest: (overrides = {}) => ({
    messages: [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: 'Hello, how are you?' }
    ],
    maxTokens: 50,
    temperature: 0.3,
    model: 'gpt-3.5-turbo',
    ...overrides
  }),

  // Git-related factories
  createBranchData: (overrides = {}) => ({
    name: `feature/test-${Date.now()}`,
    from: 'main',
    checkout: true,
    ...overrides
  }),

  createCommitData: (overrides = {}) => ({
    message: `Test commit ${Date.now()}`,
    files: ['*'],
    ...overrides
  }),

  // MCP-related factories
  createMcpToolData: (overrides = {}) => ({
    name: `test-tool-${Date.now()}`,
    description: 'Test MCP tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    },
    ...overrides
  })
}

// ============================================================================
// Assertion Helpers - Common validation patterns
// ============================================================================

export const assertions = {
  // Response assertions
  assertSuccessResponse: (response: any, expectedData?: any) => {
    expect(response).toBeDefined()
    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    if (expectedData) {
      expect(response.data).toMatchObject(expectedData)
    }
    return response.data
  },

  assertErrorResponse: (
    response: any,
    expected: {
      statusCode?: number
      errorCode?: string
      message?: string | RegExp
    }
  ) => {
    expect(response).toBeDefined()
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
    
    if (expected.statusCode !== undefined) {
      expect(response.error.statusCode).toBe(expected.statusCode)
    }
    if (expected.errorCode) {
      expect(response.error.code).toBe(expected.errorCode)
    }
    if (expected.message) {
      if (expected.message instanceof RegExp) {
        expect(response.error.message).toMatch(expected.message)
      } else {
        expect(response.error.message).toContain(expected.message)
      }
    }
  },

  // Entity validation
  assertValidEntity: (entity: any, requiredFields: string[]) => {
    expect(entity).toBeDefined()
    expect(entity.id).toBeDefined()
    expect(typeof entity.id).toBe('number')
    
    // Check timestamps
    if ('created' in entity) {
      expect(entity.created).toBeDefined()
      expect(typeof entity.created).toBe('number')
    }
    if ('updated' in entity) {
      expect(entity.updated).toBeDefined()
      expect(typeof entity.updated).toBe('number')
    }
    
    // Check required fields
    for (const field of requiredFields) {
      expect(entity[field]).toBeDefined()
    }
    
    return entity
  },

  // Array assertions
  assertArrayOfItems: (array: any[], options?: {
    minLength?: number
    maxLength?: number
    exactLength?: number
    itemValidator?: (item: any) => void
  }) => {
    expect(Array.isArray(array)).toBe(true)
    
    if (options?.exactLength !== undefined) {
      expect(array.length).toBe(options.exactLength)
    }
    if (options?.minLength !== undefined) {
      expect(array.length).toBeGreaterThanOrEqual(options.minLength)
    }
    if (options?.maxLength !== undefined) {
      expect(array.length).toBeLessThanOrEqual(options.maxLength)
    }
    if (options?.itemValidator) {
      array.forEach(options.itemValidator)
    }
    
    return array
  },

  // AI-specific assertions
  assertValidAIResponse: (response: any) => {
    expect(response).toBeDefined()
    expect(response.content).toBeDefined()
    expect(typeof response.content).toBe('string')
    expect(response.content.length).toBeGreaterThan(0)
    
    if ('model' in response) {
      expect(response.model).toBeDefined()
    }
    if ('usage' in response) {
      expect(response.usage).toBeDefined()
      expect(response.usage.totalTokens).toBeGreaterThan(0)
    }
    
    return response
  },

  assertValidStreamingResponse: (chunks: string[]) => {
    expect(Array.isArray(chunks)).toBe(true)
    expect(chunks.length).toBeGreaterThan(0)
    
    const content = chunks.join('')
    expect(content.length).toBeGreaterThan(0)
    
    return content
  },

  // Pagination assertions
  assertValidPaginatedResponse: (response: any, options?: {
    expectedPage?: number
    expectedPerPage?: number
    minTotal?: number
  }) => {
    expect(response).toBeDefined()
    expect(response.data).toBeDefined()
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.pagination).toBeDefined()
    
    const { pagination } = response
    expect(pagination.page).toBeDefined()
    expect(pagination.perPage).toBeDefined()
    expect(pagination.total).toBeDefined()
    expect(pagination.totalPages).toBeDefined()
    
    if (options?.expectedPage !== undefined) {
      expect(pagination.page).toBe(options.expectedPage)
    }
    if (options?.expectedPerPage !== undefined) {
      expect(pagination.perPage).toBe(options.expectedPerPage)
    }
    if (options?.minTotal !== undefined) {
      expect(pagination.total).toBeGreaterThanOrEqual(options.minTotal)
    }
    
    return response
  }
}

// ============================================================================
// Test Data Manager - Automatic cleanup and lifecycle management
// ============================================================================

export class TestDataManager {
  private client: PromptlianoClient
  private createdProjects: number[] = []
  private createdTickets: number[] = []
  private createdQueues: number[] = []
  private createdChats: number[] = []
  private createdPrompts: number[] = []
  private cleanupStack: Array<() => Promise<void>> = []

  constructor(client: PromptlianoClient) {
    this.client = client
  }

  // Project management
  async createProject(data = {}) {
    const projectData = factories.createProjectData(data)
    const result = await this.client.projects.createProject(projectData)
    assertions.assertSuccessResponse(result)
    
    this.createdProjects.push(result.data.id)
    return result.data
  }

  // Ticket management
  async createTicket(projectId: number, data = {}) {
    const ticketData = factories.createTicketData({ projectId, ...data })
    const result = await this.client.tickets.createTicket(ticketData)
    assertions.assertSuccessResponse(result)
    
    this.createdTickets.push(result.data.id)
    return result.data
  }

  // Queue management
  async createQueue(projectId: number, data = {}) {
    const queueData = factories.createQueueData({ projectId, ...data })
    const result = await this.client.queues.createQueue(queueData)
    assertions.assertSuccessResponse(result)
    
    this.createdQueues.push(result.data.id)
    return result.data
  }

  // Chat management
  async createChat(projectId: number, data = {}) {
    const chatData = factories.createChatData({ projectId, ...data })
    const result = await this.client.chats.createChat(chatData)
    assertions.assertSuccessResponse(result)
    
    this.createdChats.push(result.data.id)
    return result.data
  }

  // Prompt management
  async createPrompt(data = {}) {
    const promptData = factories.createPromptData(data)
    const result = await this.client.prompts.createPrompt(promptData)
    assertions.assertSuccessResponse(result)
    
    this.createdPrompts.push(result.data.id)
    return result.data
  }

  // Add custom cleanup action
  addCleanupAction(action: () => Promise<void>) {
    this.cleanupStack.push(action)
  }

  // Cleanup all created resources
  async cleanup() {
    const errors: Error[] = []

    // Execute custom cleanup actions first
    for (const action of this.cleanupStack.reverse()) {
      try {
        await action()
      } catch (error) {
        errors.push(error as Error)
      }
    }

    // Clean up prompts
    for (const promptId of this.createdPrompts) {
      try {
        await this.client.prompts.deletePrompt(promptId)
      } catch (error) {
        if (error instanceof PromptlianoError && error.statusCode !== 404) {
          errors.push(error)
        }
      }
    }

    // Clean up chats
    for (const chatId of this.createdChats) {
      try {
        await this.client.chats.deleteChat(chatId)
      } catch (error) {
        if (error instanceof PromptlianoError && error.statusCode !== 404) {
          errors.push(error)
        }
      }
    }

    // Clean up queues
    for (const queueId of this.createdQueues) {
      try {
        await this.client.queues.deleteQueue(queueId)
      } catch (error) {
        if (error instanceof PromptlianoError && error.statusCode !== 404) {
          errors.push(error)
        }
      }
    }

    // Clean up tickets
    for (const ticketId of this.createdTickets) {
      try {
        await this.client.tickets.deleteTicket(ticketId)
      } catch (error) {
        if (error instanceof PromptlianoError && error.statusCode !== 404) {
          errors.push(error)
        }
      }
    }

    // Clean up projects last (due to foreign key constraints)
    for (const projectId of this.createdProjects) {
      try {
        await this.client.projects.deleteProject(projectId)
      } catch (error) {
        if (error instanceof PromptlianoError && error.statusCode !== 404) {
          errors.push(error)
        }
      }
    }

    // Clear tracking arrays
    this.createdProjects = []
    this.createdTickets = []
    this.createdQueues = []
    this.createdChats = []
    this.createdPrompts = []
    this.cleanupStack = []

    // Report any cleanup errors
    if (errors.length > 0) {
      console.warn(`Cleanup completed with ${errors.length} errors:`, errors)
    }
  }

  // Get statistics about created resources
  getStats() {
    return {
      projects: this.createdProjects.length,
      tickets: this.createdTickets.length,
      queues: this.createdQueues.length,
      chats: this.createdChats.length,
      prompts: this.createdPrompts.length,
      customActions: this.cleanupStack.length,
      total:
        this.createdProjects.length +
        this.createdTickets.length +
        this.createdQueues.length +
        this.createdChats.length +
        this.createdPrompts.length
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelayMs?: number
    maxDelayMs?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    shouldRetry = () => true
  } = options

  let lastError: any
  let delayMs = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs))
      delayMs = Math.min(delayMs * 2, maxDelayMs)
    }
  }

  throw lastError
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeoutMs?: number
    intervalMs?: number
    message?: string
  } = {}
): Promise<void> {
  const { timeoutMs = 5000, intervalMs = 100, message = 'Condition not met' } = options

  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition()
    if (result) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timeout waiting for condition: ${message}`)
}

/**
 * Performance tracking utility
 */
export class PerformanceTracker {
  private measurements: Map<string, number[]> = new Map()
  private activeTimers: Map<string, number> = new Map()

  start(label: string) {
    this.activeTimers.set(label, Date.now())
  }

  end(label: string) {
    const startTime = this.activeTimers.get(label)
    if (!startTime) {
      console.warn(`No active timer for label: ${label}`)
      return
    }

    const duration = Date.now() - startTime
    this.activeTimers.delete(label)

    const measurements = this.measurements.get(label) || []
    measurements.push(duration)
    this.measurements.set(label, measurements)

    return duration
  }

  getStats(label: string) {
    const measurements = this.measurements.get(label) || []
    if (measurements.length === 0) {
      return null
    }

    const sorted = [...measurements].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  getAllStats() {
    const stats: Record<string, any> = {}
    for (const [label, _] of this.measurements) {
      stats[label] = this.getStats(label)
    }
    return stats
  }

  reset() {
    this.measurements.clear()
    this.activeTimers.clear()
  }
}

/**
 * Create a test context with automatic cleanup
 */
export async function withTestContext<T>(
  client: PromptlianoClient,
  testFn: (context: {
    client: PromptlianoClient
    dataManager: TestDataManager
    perfTracker: PerformanceTracker
  }) => Promise<T>
): Promise<T> {
  const dataManager = new TestDataManager(client)
  const perfTracker = new PerformanceTracker()

  try {
    return await testFn({ client, dataManager, perfTracker })
  } finally {
    await dataManager.cleanup()
  }
}

// ============================================================================
// Mock Data Generators
// ============================================================================

export const mockData = {
  // Generate realistic file content
  generateFileContent(type: 'ts' | 'js' | 'json' | 'md' = 'ts', lines = 10): string {
    const templates = {
      ts: [
        'import { Injectable } from "@nestjs/common"',
        'export interface TestInterface {',
        '  id: number',
        '  name: string',
        '}',
        'export class TestClass {',
        '  constructor(private readonly service: TestService) {}',
        '  async method(): Promise<void> {',
        '    console.log("test")',
        '  }',
        '}'
      ],
      js: [
        'const express = require("express")',
        'const app = express()',
        'app.get("/", (req, res) => {',
        '  res.send("Hello World")',
        '})',
        'app.listen(3000, () => {',
        '  console.log("Server running")',
        '})'
      ],
      json: [
        '{',
        '  "name": "test-package",',
        '  "version": "1.0.0",',
        '  "dependencies": {',
        '    "express": "^4.18.0"',
        '  }',
        '}'
      ],
      md: [
        '# Test Document',
        '',
        '## Section 1',
        'This is a test document.',
        '',
        '## Section 2',
        '- Item 1',
        '- Item 2',
        '',
        '### Subsection',
        'More content here.'
      ]
    }

    const template = templates[type]
    const result: string[] = []
    
    for (let i = 0; i < lines; i++) {
      result.push(template[i % template.length])
    }
    
    return result.join('\n')
  },

  // Generate batch of test files
  generateFiles(count: number, projectId: number) {
    const files = []
    const extensions = ['ts', 'js', 'json', 'md']
    
    for (let i = 0; i < count; i++) {
      const ext = extensions[i % extensions.length]
      files.push({
        path: `test-file-${i}.${ext}`,
        name: `test-file-${i}.${ext}`,
        content: this.generateFileContent(ext as any),
        extension: `.${ext}`,
        projectId
      })
    }
    
    return files
  },

  // Generate test commits
  generateCommits(count: number) {
    const commits = []
    for (let i = 0; i < count; i++) {
      commits.push({
        hash: `${Math.random().toString(36).substring(2, 10)}`,
        message: `Test commit ${i}`,
        author: 'Test User',
        timestamp: Date.now() - i * 3600000
      })
    }
    return commits
  }
}

// ============================================================================
// Export convenience functions
// ============================================================================

export function createTestHelpers(client: PromptlianoClient) {
  return {
    dataManager: new TestDataManager(client),
    perfTracker: new PerformanceTracker(),
    factories,
    assertions,
    mockData,
    retryOperation,
    waitFor
  }
}

export default {
  factories,
  assertions,
  TestDataManager,
  PerformanceTracker,
  retryOperation,
  waitFor,
  withTestContext,
  mockData,
  createTestHelpers
}