/**
 * Test Data Manager for Prompt Management Testing
 *
 * This utility provides comprehensive test data management specifically
 * for prompt management E2E tests including file operations, database
 * state management, and cleanup coordination.
 */

import { Page } from '@playwright/test'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  PromptManagementTestData,
  PromptManagementDataFactory,
  ImportTestFile
} from '../fixtures/prompt-management-data'
import type { PromptTestData } from '../fixtures/prompt-management-data'

export interface TempFile {
  path: string
  content: string
  filename: string
}

export class PromptTestDataManager {
  private tempFiles: TempFile[] = []
  private createdPrompts: PromptTestData[] = []
  private tempDirectory: string

  constructor(
    private page: Page,
    testName: string = 'prompt-test'
  ) {
    const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    this.tempDirectory = `/tmp/playwright-prompt-tests/${sanitizedTestName}-${Date.now()}`
  }

  // ============================================================================
  // File Operations for Import Testing
  // ============================================================================

  /**
   * Create temporary markdown files for import testing
   */
  async createTempMarkdownFiles(importFiles: ImportTestFile[]): Promise<string[]> {
    const filePaths: string[] = []

    // Ensure temp directory exists
    await this.ensureTempDirectory()

    for (const file of importFiles) {
      const filePath = join(this.tempDirectory, file.filename)
      await fs.writeFile(filePath, file.content, 'utf8')

      this.tempFiles.push({
        path: filePath,
        content: file.content,
        filename: file.filename
      })

      filePaths.push(filePath)
    }

    return filePaths
  }

  /**
   * Create single temporary file for testing
   */
  async createTempFile(filename: string, content: string): Promise<string> {
    await this.ensureTempDirectory()

    const filePath = join(this.tempDirectory, filename)
    await fs.writeFile(filePath, content, 'utf8')

    this.tempFiles.push({
      path: filePath,
      content,
      filename
    })

    return filePath
  }

  /**
   * Create complex markdown file for advanced import testing
   */
  async createComplexMarkdownFile(): Promise<string> {
    const complexFile = PromptManagementDataFactory.createComplexMarkdownFile()
    return await this.createTempFile(complexFile.filename, complexFile.content)
  }

  /**
   * Create multiple import test files
   */
  async createImportTestFiles(): Promise<string[]> {
    return await this.createTempMarkdownFiles(PromptManagementTestData.importTestFiles)
  }

  /**
   * Create invalid file for error testing
   */
  async createInvalidFile(type: 'malformed' | 'unsupported' | 'empty' = 'malformed'): Promise<string> {
    let filename: string
    let content: string

    switch (type) {
      case 'malformed':
        filename = 'malformed.md'
        content = '# Incomplete markdown\n{{invalid_template without closing'
        break
      case 'unsupported':
        filename = 'unsupported.txt'
        content = 'This is not a markdown file'
        break
      case 'empty':
        filename = 'empty.md'
        content = ''
        break
    }

    return await this.createTempFile(filename, content)
  }

  /**
   * Create large file for performance testing
   */
  async createLargeImportFile(promptCount: number = 100): Promise<string> {
    const filename = `large-import-${promptCount}-prompts.md`
    const file = PromptManagementDataFactory.createImportTestFile(filename, promptCount)
    return await this.createTempFile(file.filename, file.content)
  }

  // ============================================================================
  // Database and UI State Management
  // ============================================================================

  /**
   * Setup prompts in the application database
   */
  async setupPrompts(page: Page, prompts: PromptTestData[]): Promise<void> {
    // Mock API endpoints for prompt data
    await page.route('**/api/prompts**', async (route) => {
      const method = route.request().method()

      switch (method) {
        case 'GET':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: prompts.map((prompt) => ({
                id: this.generateId(),
                title: prompt.title,
                content: prompt.content,
                tags: prompt.tags,
                category: prompt.category,
                tokenCount: prompt.tokenCount,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }))
            })
          })
          break

        case 'POST':
          const newPrompt = await route.request().postDataJSON()
          const createdPrompt = {
            id: this.generateId(),
            ...newPrompt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          this.createdPrompts.push(createdPrompt)

          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ data: createdPrompt })
          })
          break

        case 'PUT':
          const updatedPrompt = await route.request().postDataJSON()
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                ...updatedPrompt,
                updatedAt: new Date().toISOString()
              }
            })
          })
          break

        case 'DELETE':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          })
          break
      }
    })
  }

  /**
   * Setup large dataset for performance testing
   */
  async setupLargePromptDataset(page: Page, count: number): Promise<void> {
    const largeDataset = PromptManagementDataFactory.createLargeDataset(count)
    await this.setupPrompts(page, largeDataset)
  }

  /**
   * Clear all prompts from the application
   */
  async clearAllPrompts(page: Page): Promise<void> {
    await page.route('**/api/prompts**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        })
      }
    })
  }

  /**
   * Setup search API endpoints
   */
  async setupSearchAPI(page: Page, prompts: PromptTestData[]): Promise<void> {
    await page.route('**/api/prompts/search**', async (route) => {
      const url = new URL(route.request().url())
      const query = url.searchParams.get('q') || ''

      const filteredPrompts = prompts.filter(
        (prompt) =>
          prompt.title.toLowerCase().includes(query.toLowerCase()) ||
          prompt.content.toLowerCase().includes(query.toLowerCase()) ||
          prompt.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      )

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: filteredPrompts })
      })
    })
  }

  /**
   * Setup import API endpoints
   */
  async setupImportAPI(page: Page): Promise<void> {
    await page.route('**/api/prompts/import**', async (route) => {
      const method = route.request().method()

      if (method === 'POST') {
        // Simulate import processing
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const importedPrompts = PromptManagementTestData.testPrompts.slice(0, 3)

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              imported: importedPrompts.length,
              prompts: importedPrompts
            }
          })
        })
      }
    })
  }

  /**
   * Setup export API endpoints
   */
  async setupExportAPI(page: Page): Promise<void> {
    await page.route('**/api/prompts/export**', async (route) => {
      const markdownContent = '# Exported Prompt\n\nThis is the exported content.'

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': 'attachment; filename="prompt-export.md"'
        },
        body: markdownContent
      })
    })

    await page.route('**/api/prompts/bulk-export**', async (route) => {
      // Simulate ZIP file for bulk export
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="prompts-export.zip"'
        },
        body: Buffer.from('Mock ZIP file content')
      })
    })
  }

  // ============================================================================
  // Performance and Load Testing
  // ============================================================================

  /**
   * Create performance test scenario
   */
  async createPerformanceScenario(
    page: Page,
    options: {
      promptCount: number
      searchDelay?: number
      importDelay?: number
    }
  ): Promise<void> {
    const { promptCount, searchDelay = 100, importDelay = 500 } = options

    const prompts = PromptManagementDataFactory.createLargeDataset(promptCount)

    // Mock API with realistic delays
    await page.route('**/api/prompts**', async (route) => {
      const method = route.request().method()

      // Simulate realistic server response times
      if (method === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, searchDelay))
      } else if (method === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, importDelay))
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: prompts })
      })
    })
  }

  /**
   * Monitor performance metrics
   */
  async monitorPerformance(
    page: Page,
    operation: () => Promise<void>
  ): Promise<{
    duration: number
    memoryUsage: number
    networkRequests: number
  }> {
    let networkRequests = 0

    // Monitor network requests
    page.on('request', () => networkRequests++)

    const startTime = Date.now()
    const startMemory = await this.getMemoryUsage(page)

    await operation()

    const endTime = Date.now()
    const endMemory = await this.getMemoryUsage(page)

    return {
      duration: endTime - startTime,
      memoryUsage: endMemory - startMemory,
      networkRequests
    }
  }

  // ============================================================================
  // Error Simulation and Edge Cases
  // ============================================================================

  /**
   * Simulate network errors for testing error handling
   */
  async simulateNetworkError(
    page: Page,
    errorType: 'timeout' | 'server_error' | 'network_failure' = 'server_error'
  ): Promise<void> {
    await page.route('**/api/prompts**', async (route) => {
      switch (errorType) {
        case 'timeout':
          // Don't respond, causing timeout
          await new Promise((resolve) => setTimeout(resolve, 10000))
          break
        case 'server_error':
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal server error',
              message: 'Database connection failed'
            })
          })
          break
        case 'network_failure':
          await route.abort('failed')
          break
      }
    })
  }

  /**
   * Simulate validation errors
   */
  async simulateValidationError(
    page: Page,
    errorType: 'duplicate_title' | 'invalid_content' = 'duplicate_title'
  ): Promise<void> {
    await page.route('**/api/prompts', async (route) => {
      if (route.request().method() === 'POST') {
        const errorMessage =
          errorType === 'duplicate_title' ? 'A prompt with this title already exists' : 'Invalid prompt content format'

        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation error',
            message: errorMessage,
            field: errorType === 'duplicate_title' ? 'title' : 'content'
          })
        })
      }
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Ensure temporary directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDirectory, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Generate unique ID for test data
   */
  private generateId(): number {
    return Date.now() + Math.floor(Math.random() * 1000)
  }

  /**
   * Get memory usage from page
   */
  private async getMemoryUsage(page: Page): Promise<number> {
    return await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })
  }

  /**
   * Cleanup all temporary files and resources
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = []

    // Cleanup temporary files
    for (const file of this.tempFiles) {
      try {
        await fs.unlink(file.path)
      } catch (error) {
        errors.push(error as Error)
      }
    }

    // Cleanup temporary directory
    try {
      await fs.rmdir(this.tempDirectory, { recursive: true })
    } catch (error) {
      errors.push(error as Error)
    }

    // Reset API routes
    try {
      await this.page.unrouteAll()
    } catch (error) {
      errors.push(error as Error)
    }

    // Log cleanup errors (but don't fail)
    if (errors.length > 0) {
      console.warn(`Prompt test cleanup encountered ${errors.length} errors:`)
      errors.forEach((error, index) => {
        console.warn(`  ${index + 1}. ${error.message}`)
      })
    }

    // Clear arrays
    this.tempFiles = []
    this.createdPrompts = []
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create test data manager for standard prompt tests
   */
  static async createForStandardTests(page: Page, testName: string): Promise<PromptTestDataManager> {
    const manager = new PromptTestDataManager(page, testName)

    // Setup standard test data
    await manager.setupPrompts(page, PromptManagementTestData.testPrompts)
    await manager.setupImportAPI(page)
    await manager.setupExportAPI(page)
    await manager.setupSearchAPI(page, PromptManagementTestData.testPrompts)

    return manager
  }

  /**
   * Create test data manager for import tests
   */
  static async createForImportTests(page: Page, testName: string): Promise<PromptTestDataManager> {
    const manager = new PromptTestDataManager(page, testName)

    await manager.setupImportAPI(page)
    await manager.clearAllPrompts(page) // Start with empty state

    return manager
  }

  /**
   * Create test data manager for performance tests
   */
  static async createForPerformanceTests(
    page: Page,
    testName: string,
    promptCount: number = 1000
  ): Promise<PromptTestDataManager> {
    const manager = new PromptTestDataManager(page, testName)

    await manager.createPerformanceScenario(page, { promptCount })

    return manager
  }

  /**
   * Create test data manager for error tests
   */
  static async createForErrorTests(
    page: Page,
    testName: string,
    errorType: 'network' | 'validation' = 'network'
  ): Promise<PromptTestDataManager> {
    const manager = new PromptTestDataManager(page, testName)

    if (errorType === 'network') {
      await manager.simulateNetworkError(page)
    } else {
      await manager.simulateValidationError(page)
    }

    return manager
  }
}

/**
 * Utility functions for prompt testing
 */
export const PromptTestUtils = {
  /**
   * Wait for file download and verify content
   */
  async verifyDownload(downloadPath: string, expectedContent?: string): Promise<boolean> {
    try {
      const content = await fs.readFile(downloadPath, 'utf8')

      if (expectedContent) {
        return content.includes(expectedContent)
      }

      return content.length > 0
    } catch {
      return false
    }
  },

  /**
   * Create realistic test content
   */
  generateRealisticPromptContent(type: 'code' | 'documentation' | 'analysis' | 'general' = 'general'): string {
    const templates = {
      code: `Review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Please check for:
- Code quality and readability
- Performance optimizations
- Security vulnerabilities
- Best practices compliance

Provide specific recommendations for improvement.`,

      documentation: `Create documentation for {{feature_name}}.

## Overview
{{overview}}

## Installation
{{installation_steps}}

## Usage
{{usage_examples}}

## API Reference
{{api_details}}

## Troubleshooting
{{common_issues}}`,

      analysis: `Analyze the following {{subject}}:

{{content_to_analyze}}

Provide insights on:
1. **Key findings**: {{findings}}
2. **Recommendations**: {{recommendations}}  
3. **Next steps**: {{next_steps}}

Include data-driven conclusions where possible.`,

      general: `Help with {{task_description}}.

## Context
{{context_information}}

## Requirements
{{specific_requirements}}

## Expected Output
{{expected_format}}

Please provide detailed, actionable guidance.`
    }

    return templates[type]
  },

  /**
   * Validate markdown structure
   */
  validateMarkdownStructure(content: string): boolean {
    // Basic markdown validation
    const hasHeaders = /^#+\s/.test(content)
    const hasValidVariables = !/\{\{[^}]*$/.test(content) // No unclosed variables

    return hasHeaders && hasValidVariables
  },

  /**
   * Extract variables from prompt content
   */
  extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([^}]+)\}\}/g) || []
    return matches.map((match) => match.slice(2, -2).trim())
  }
}
