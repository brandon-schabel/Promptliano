/**
 * Prompt Helper Utilities for E2E Testing
 * 
 * Provides comprehensive utilities for prompt-related E2E tests including
 * data generation, API mocking, file handling, and common assertions.
 */

import { Page, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { TestDataFactory, type PromptData } from '../fixtures/test-data'

export interface MockPromptResponse {
  id: number
  title: string
  content: string
  description?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
  projectId?: number
}

export interface ImportFile {
  path: string
  content: string
  filename: string
}

/**
 * Prompt test helper utilities
 */
export class PromptTestHelpers {
  constructor(private page: Page) {}

  /**
   * Generate test prompt data with unique values
   */
  static generatePromptData(overrides: Partial<PromptData> = {}): PromptData {
    return TestDataFactory.createPrompt(overrides)
  }

  /**
   * Generate multiple test prompts with different categories
   */
  static generatePromptSet(count: number = 5): PromptData[] {
    const tags = [
      ['code', 'review'],
      ['docs', 'writing'],
      ['test', 'qa'],
      ['design', 'architecture'],
      ['refactor', 'improvement']
    ]

    return Array.from({ length: count }, (_, index) => 
      TestDataFactory.createPrompt({
        title: `Test Prompt ${index + 1}`,
        content: `Content for test prompt ${index + 1}`,
        description: `Description for test prompt ${index + 1}`,
        tags: tags[index % tags.length]
      })
    )
  }

  /**
   * Create markdown content for import testing
   */
  static createMarkdownContent(prompts: PromptData[]): string {
    return prompts.map(prompt => `
# ${prompt.title}

${prompt.description || ''}

## Content

${prompt.content}

${prompt.tags ? `## Tags\n${prompt.tags.map(tag => `- ${tag}`).join('\n')}` : ''}

---
`).join('\n')
  }

  /**
   * Create temporary markdown file for import testing
   */
  async createTempMarkdownFile(
    filename: string,
    prompts: PromptData[]
  ): Promise<string> {
    const tempDir = `/tmp/playwright-prompt-tests-${Date.now()}`
    await fs.mkdir(tempDir, { recursive: true })
    
    const filePath = join(tempDir, filename)
    const content = PromptTestHelpers.createMarkdownContent(prompts)
    await fs.writeFile(filePath, content, 'utf8')
    
    return filePath
  }

  /**
   * Mock API responses for prompt operations
   */
  async mockPromptAPI(operation: 'list' | 'create' | 'update' | 'delete', response?: any) {
    const baseUrl = '**/api/prompts'
    
    switch (operation) {
      case 'list':
        await this.page.route(baseUrl, route => 
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: response || []
            })
          })
        )
        break
        
      case 'create':
        await this.page.route(`${baseUrl}`, route => {
          if (route.request().method() === 'POST') {
            route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: {
                  id: Date.now(),
                  ...response,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              })
            })
          } else {
            route.continue()
          }
        })
        break
        
      case 'update':
        await this.page.route(`${baseUrl}/*`, route => {
          if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: response
              })
            })
          } else {
            route.continue()
          }
        })
        break
        
      case 'delete':
        await this.page.route(`${baseUrl}/*`, route => {
          if (route.request().method() === 'DELETE') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                message: 'Prompt deleted successfully'
              })
            })
          } else {
            route.continue()
          }
        })
        break
    }
  }

  /**
   * Mock network errors for error handling tests
   */
  async mockNetworkError(endpoint: string = '**/api/prompts') {
    await this.page.route(endpoint, route => route.abort())
  }

  /**
   * Mock API error responses
   */
  async mockAPIError(
    endpoint: string,
    errorCode: number = 500,
    errorMessage: string = 'Internal Server Error'
  ) {
    await this.page.route(endpoint, route =>
      route.fulfill({
        status: errorCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: errorCode,
            message: errorMessage
          }
        })
      })
    )
  }

  /**
   * Wait for prompt-related API calls
   */
  async waitForPromptAPI(
    operation: 'list' | 'create' | 'update' | 'delete',
    timeout: number = 5000
  ) {
    const patterns = {
      list: /\/api\/prompts$/,
      create: /\/api\/prompts$/,
      update: /\/api\/prompts\/\d+$/,
      delete: /\/api\/prompts\/\d+$/
    }

    const methods = {
      list: 'GET',
      create: 'POST',
      update: ['PUT', 'PATCH'],
      delete: 'DELETE'
    }

    const response = await this.page.waitForResponse(
      response => {
        const url = response.url()
        const method = response.request().method()
        const methodMatch = Array.isArray(methods[operation]) 
          ? methods[operation].includes(method)
          : method === methods[operation]
        
        return patterns[operation].test(url) && methodMatch
      },
      { timeout }
    )

    return response
  }

  /**
   * Assert toast messages
   */
  async assertToastMessage(expectedMessage: string, type: 'success' | 'error' | 'info' = 'success') {
    const toastSelector = type === 'error' 
      ? '[data-sonner-toast][data-type="error"]'
      : '[data-sonner-toast][data-type="success"]'
    
    const toast = this.page.locator(toastSelector)
    await expect(toast).toBeVisible()
    await expect(toast).toContainText(expectedMessage)
  }

  /**
   * Assert prompt card is visible with correct data
   */
  async assertPromptCard(promptData: PromptData) {
    const card = this.page.locator(`[data-testid="prompt-card"]:has-text("${promptData.title}")`)
    await expect(card).toBeVisible()
    
    if (promptData.description) {
      await expect(card).toContainText(promptData.description)
    }
    
    if (promptData.tags) {
      for (const tag of promptData.tags) {
        await expect(card.locator('[data-testid="tag"]')).toContainText(tag)
      }
    }
  }

  /**
   * Assert prompt count
   */
  async assertPromptCount(expectedCount: number) {
    const cards = this.page.locator('[data-testid="prompt-card"]')
    await expect(cards).toHaveCount(expectedCount)
  }

  /**
   * Clean up test data
   */
  async cleanup(tempFiles: string[] = []) {
    // Clean up temporary files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file)
      } catch (error) {
        // File might already be deleted
      }
    }

    // Clean up temp directories
    const tempDirs = await fs.readdir('/tmp')
    const testDirs = tempDirs.filter(dir => dir.startsWith('playwright-prompt-tests-'))
    
    for (const dir of testDirs) {
      try {
        await fs.rmdir(join('/tmp', dir), { recursive: true })
      } catch (error) {
        // Directory might already be deleted
      }
    }
  }

  /**
   * Validate prompt data structure
   */
  static validatePromptData(prompt: any): boolean {
    return (
      typeof prompt.title === 'string' &&
      typeof prompt.content === 'string' &&
      prompt.title.length > 0 &&
      prompt.content.length > 0 &&
      (!prompt.description || typeof prompt.description === 'string') &&
      (!prompt.tags || Array.isArray(prompt.tags))
    )
  }

  /**
   * Generate large prompt content for performance testing
   */
  static generateLargeContent(lines: number = 1000): string {
    return Array.from({ length: lines }, (_, i) => 
      `Line ${i + 1}: This is test content for performance testing. ` +
      `It contains various elements like {{variable_${i}}} and code blocks.`
    ).join('\n')
  }

  /**
   * Create prompt with variables for template testing
   */
  static createPromptWithVariables(): PromptData {
    return {
      title: 'Template Prompt with Variables',
      content: `
You are an AI assistant helping with {{task_type}}.

User Context: {{user_context}}

Instructions:
1. Analyze the {{input_type}}
2. Consider {{constraints}}
3. Generate {{output_format}}

Additional Parameters:
- Language: {{language}}
- Style: {{style}}
- Length: {{length}}

{{additional_instructions}}
`,
      description: 'A template prompt with multiple variable placeholders',
      tags: ['template', 'variables', 'reusable']
    }
  }

  /**
   * Wait for prompt editor to be ready
   */
  async waitForEditorReady() {
    // Wait for Monaco editor or textarea
    const editor = this.page.locator('.monaco-editor, .cm-editor, textarea[name="content"]')
    await expect(editor).toBeVisible({ timeout: 5000 })
    
    // Additional wait for Monaco to fully initialize if present
    if (await this.page.locator('.monaco-editor').isVisible()) {
      await this.page.waitForTimeout(500)
    }
  }

  /**
   * Get all visible prompt titles
   */
  async getVisiblePromptTitles(): Promise<string[]> {
    const cards = this.page.locator('[data-testid="prompt-card"]')
    const count = await cards.count()
    const titles: string[] = []
    
    for (let i = 0; i < count; i++) {
      const titleElement = cards.nth(i).locator('[data-testid="prompt-title"], .prompt-title')
      const title = await titleElement.textContent()
      if (title) {
        titles.push(title.trim())
      }
    }
    
    return titles
  }

  /**
   * Perform batch operations
   */
  async selectMultiplePrompts(titles: string[]) {
    for (const title of titles) {
      const card = this.page.locator(`[data-testid="prompt-card"]:has-text("${title}")`)
      const checkbox = card.locator('input[type="checkbox"]')
      await checkbox.check()
    }
  }

  /**
   * Assert search results
   */
  async assertSearchResults(searchTerm: string, expectedTitles: string[]) {
    const searchInput = this.page.locator('[data-testid="prompt-search"], input[placeholder*="search" i]')
    await searchInput.fill(searchTerm)
    await searchInput.press('Enter')
    
    // Wait for search to complete
    await this.page.waitForTimeout(500)
    
    const visibleTitles = await this.getVisiblePromptTitles()
    
    for (const expectedTitle of expectedTitles) {
      expect(visibleTitles).toContain(expectedTitle)
    }
  }
}

/**
 * Prompt import/export helpers
 */
export class PromptImportExportHelpers {
  /**
   * Create a valid markdown file for import
   */
  static createValidMarkdownFile(prompts: PromptData[]): string {
    return prompts.map(prompt => `
# ${prompt.title}

${prompt.description || 'No description provided'}

## Content

\`\`\`
${prompt.content}
\`\`\`

## Metadata

- Created: ${new Date().toISOString()}
- Tags: ${prompt.tags?.join(', ') || 'none'}

---
`).join('\n\n')
  }

  /**
   * Create an invalid markdown file for error testing
   */
  static createInvalidMarkdownFile(): string {
    return `
This is not a valid prompt format.
It lacks the proper structure and headers.
`
  }

  /**
   * Parse exported markdown content
   */
  static parseExportedMarkdown(content: string): PromptData[] {
    const prompts: PromptData[] = []
    const sections = content.split('---').filter(s => s.trim())
    
    for (const section of sections) {
      const titleMatch = section.match(/^#\s+(.+)$/m)
      const contentMatch = section.match(/```\n([\s\S]+?)\n```/m)
      const tagsMatch = section.match(/Tags:\s*(.+)$/m)
      
      if (titleMatch && contentMatch) {
        prompts.push({
          title: titleMatch[1].trim(),
          content: contentMatch[1].trim(),
          tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : undefined
        })
      }
    }
    
    return prompts
  }
}