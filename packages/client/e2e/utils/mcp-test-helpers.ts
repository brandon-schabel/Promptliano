/**
 * MCP (Model Context Protocol) Test Helpers
 *
 * Provides utilities for testing MCP integration with proper mocks,
 * availability checks, and error handling.
 */

import { type Page, expect } from '@playwright/test'
import { API_ENDPOINTS } from './api-endpoint-config'

export interface MCPToolCall {
  tool: string
  params: Record<string, any>
  result?: any
  error?: string
}

export interface MCPServerStatus {
  connected: boolean
  tools: string[]
  version?: string
  error?: string
}

/**
 * Enhanced MCP testing utilities with proper availability checks
 */
export class MCPTestHelpers {
  /**
   * Check if MCP functionality is available in the test environment
   */
  static async checkMCPAvailability(page: Page): Promise<MCPServerStatus> {
    try {
      // First check if the MCP client is available in the browser
      const browserMCPAvailable = await page.evaluate(() => {
        return typeof (window as any).mcpClient !== 'undefined'
      })

      if (browserMCPAvailable) {
        // Test actual browser-side MCP client
        return await page.evaluate(async () => {
          try {
            const client = (window as any).mcpClient
            const tools = (await client.listTools?.()) || []
            return {
              connected: true,
              tools: tools.map((t: any) => t.name),
              version: client.version
            }
          } catch (error) {
            return {
              connected: false,
              tools: [],
              error: error.message
            }
          }
        })
      }

      // Fallback: Check if MCP API endpoints are available via HTTP
      return await this.checkMCPViaAPI(page)
    } catch (error) {
      return {
        connected: false,
        tools: [],
        error: error.message
      }
    }
  }

  /**
   * Check MCP availability via HTTP API endpoints
   */
  private static async checkMCPViaAPI(page: Page): Promise<MCPServerStatus> {
    try {
      const response = await page.request.get(API_ENDPOINTS.MCP.SESSION)

      if (response.ok()) {
        const data = await response.json()
        return {
          connected: true,
          tools: data.availableTools || [],
          version: data.version
        }
      } else {
        return {
          connected: false,
          tools: [],
          error: `MCP API not available: ${response.status()}`
        }
      }
    } catch (error) {
      return {
        connected: false,
        tools: [],
        error: `Failed to check MCP API: ${error.message}`
      }
    }
  }

  /**
   * Verify that expected MCP tools are available
   */
  static async verifyMCPToolsAvailable(page: Page): Promise<string[]> {
    const status = await this.checkMCPAvailability(page)
    return status.tools
  }

  /**
   * Call MCP tool with proper error handling
   */
  static async callMCPTool(page: Page, toolName: string, params: Record<string, any>): Promise<any> {
    const status = await this.checkMCPAvailability(page)

    if (!status.connected) {
      console.warn(`MCP not available: ${status.error}`)
      return undefined
    }

    if (!status.tools.includes(toolName)) {
      console.warn(`MCP tool '${toolName}' not available. Available tools: ${status.tools.join(', ')}`)
      return undefined
    }

    try {
      // Try browser-side MCP client first
      const browserResult = await page.evaluate(
        async ({ toolName, params }) => {
          if (typeof (window as any).mcpClient !== 'undefined') {
            try {
              return await (window as any).mcpClient.callTool(toolName, params)
            } catch (error) {
              return { error: error.message }
            }
          }
          return null
        },
        { toolName, params }
      )

      if (browserResult) {
        return browserResult
      }

      // Fallback to HTTP API
      const response = await page.request.post(API_ENDPOINTS.MCP.EXECUTE, {
        data: { tool: toolName, params }
      })

      if (response.ok()) {
        return await response.json()
      } else {
        return { error: `HTTP MCP call failed: ${response.status()}` }
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Mock MCP client for testing when real MCP is not available
   */
  static async setupMCPMocks(page: Page, mockTools: Record<string, (params: any) => any>) {
    await page.addInitScript(
      (mockToolsStr) => {
        const mockTools = JSON.parse(mockToolsStr)

        // Create mock MCP client
        ;(window as any).mcpClient = {
          connected: true,
          version: '1.0.0-test',

          async listTools() {
            return Object.keys(mockTools).map((name) => ({ name }))
          },

          async callTool(toolName: string, params: any) {
            const mockFn = mockTools[toolName]
            if (!mockFn) {
              throw new Error(`Mock tool '${toolName}' not found`)
            }

            // Execute mock function (serialized as string)
            const fn = new Function('params', mockFn)
            return fn(params)
          },

          async ping() {
            return { status: 'ok', timestamp: Date.now() }
          }
        }
      },
      JSON.stringify(Object.fromEntries(Object.entries(mockTools).map(([key, fn]) => [key, fn.toString()])))
    )
  }

  /**
   * Create realistic MCP mocks for common Promptliano tools
   */
  static async setupPromptlianoMCPMocks(page: Page) {
    const mockTools = {
      project_manager: (params: any) => {
        if (params.action === 'overview') {
          return {
            success: true,
            data: {
              id: 1,
              name: 'Test Project',
              files: [],
              tickets: [],
              prompts: []
            }
          }
        }
        return { success: false, error: 'Action not mocked' }
      },

      ticket_manager: (params: any) => {
        if (params.action === 'create') {
          return {
            success: true,
            data: {
              id: 1,
              title: params.data?.title || 'Test Ticket',
              overview: params.data?.overview || 'Test overview',
              priority: 'normal'
            }
          }
        }
        return { success: false, error: 'Action not mocked' }
      },

      queue_processor: (params: any) => {
        if (params.action === 'get_next_task') {
          return {
            success: true,
            data: {
              id: 1,
              content: 'Test task',
              status: 'pending'
            }
          }
        }
        return { success: false, error: 'Action not mocked' }
      },

      prompt_manager: (params: any) => {
        if (params.action === 'create') {
          return {
            success: true,
            data: {
              id: 1,
              title: params.data?.title || 'Test Prompt',
              content: params.data?.content || 'Test content'
            }
          }
        }
        return { success: false, error: 'Action not mocked' }
      }
    }

    await this.setupMCPMocks(page, mockTools)
  }

  /**
   * Mock MCP API endpoints at the HTTP level
   */
  static async mockMCPAPIEndpoints(page: Page, enabledTools: string[] = []) {
    // Mock MCP session endpoint
    await page.route(`**${API_ENDPOINTS.MCP.SESSION}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          connected: true,
          availableTools: enabledTools,
          version: '1.0.0-test'
        })
      })
    })

    // Mock MCP execute endpoint
    await page.route(`**${API_ENDPOINTS.MCP.EXECUTE}`, (route) => {
      const postData = route.request().postDataJSON()
      const toolName = postData?.tool

      if (enabledTools.includes(toolName)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            result: {
              tool: toolName,
              data: 'Mock result for ' + toolName
            }
          })
        })
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: `Tool '${toolName}' not found`
          })
        })
      }
    })

    // Mock MCP test endpoint
    await page.route(`**${API_ENDPOINTS.MCP.TEST}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'ok',
          tools: enabledTools
        })
      })
    })
  }

  /**
   * Test MCP integration with graceful degradation
   */
  static async testMCPIntegrationSafely(
    page: Page,
    testName: string,
    testFn: (mcpAvailable: boolean) => Promise<void>
  ) {
    const status = await this.checkMCPAvailability(page)

    console.log(`MCP Test '${testName}': ${status.connected ? 'Connected' : 'Not Available'}`)

    if (status.error) {
      console.log(`MCP Status: ${status.error}`)
    }

    await testFn(status.connected)
  }

  /**
   * Skip test if MCP is not available (for tests that require real MCP)
   */
  static async skipIfMCPNotAvailable(page: Page, testName?: string) {
    const status = await this.checkMCPAvailability(page)

    if (!status.connected) {
      console.log(`Skipping test${testName ? ` '${testName}'` : ''}: MCP not available (${status.error})`)
      return true // Should skip
    }

    return false // Should run test
  }

  /**
   * Create a test environment that works with or without MCP
   */
  static async createMCPTestEnvironment(
    page: Page,
    options: {
      enableMocks?: boolean
      mockTools?: string[]
      requireReal?: boolean
    } = {}
  ) {
    const { enableMocks = true, mockTools = ['project_manager', 'ticket_manager'], requireReal = false } = options

    const status = await this.checkMCPAvailability(page)

    if (status.connected) {
      console.log('✅ Using real MCP server')
      return { mcpAvailable: true, usingMocks: false }
    }

    if (requireReal) {
      throw new Error('Real MCP server required but not available')
    }

    if (enableMocks) {
      console.log('🎭 Setting up MCP mocks')
      await this.setupPromptlianoMCPMocks(page)
      await this.mockMCPAPIEndpoints(page, mockTools)
      return { mcpAvailable: true, usingMocks: true }
    }

    console.log('⚠️ No MCP available (mocks disabled)')
    return { mcpAvailable: false, usingMocks: false }
  }

  /**
   * Assert MCP tool call result
   */
  static assertMCPResult(result: any, expectedSuccess: boolean = true) {
    if (expectedSuccess) {
      expect(result).toBeDefined()
      expect(result.error).toBeUndefined()
    } else {
      expect(result).toBeDefined()
      expect(result.error).toBeDefined()
    }
  }

  /**
   * Get MCP tool names with corrected naming conventions
   */
  static getMCPToolName(toolName: string): string {
    // Map test assumptions to actual MCP tool names
    const toolNameMap: Record<string, string> = {
      project_manager: 'mcp__promptliano__project_manager',
      ticket_manager: 'mcp__promptliano__ticket_manager',
      queue_processor: 'mcp__promptliano__queue_processor',
      prompt_manager: 'mcp__promptliano__prompt_manager',
      task_manager: 'mcp__promptliano__task_manager'
    }

    return toolNameMap[toolName] || toolName
  }
}
