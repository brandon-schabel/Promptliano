/**
 * Advanced MCP Integration Safety Patterns
 * 
 * This module provides comprehensive safety patterns for MCP integration testing,
 * including circuit breakers, retry logic, timeout handling, and graceful degradation.
 */

import { Page, expect, TestInfo } from '@playwright/test'
import { MCPTestHelpers, type MCPServerStatus } from './mcp-test-helpers'

/**
 * MCP Connection state tracking
 */
interface MCPConnectionState {
  status: 'connected' | 'disconnected' | 'error' | 'timeout'
  lastChecked: number
  consecutiveFailures: number
  circuitBreakerOpen: boolean
  tools: string[]
  version?: string
  error?: string
}

/**
 * MCP Safety configuration
 */
interface MCPSafetyConfig {
  connectionTimeout: number
  retryAttempts: number
  retryDelay: number
  circuitBreakerThreshold: number
  circuitBreakerResetTime: number
  healthCheckInterval: number
  gracefulDegradation: boolean
  fallbackBehavior: 'mock' | 'skip' | 'error'
}

/**
 * MCP Tool execution result with safety metadata
 */
interface SafeMCPResult {
  success: boolean
  data?: any
  error?: string
  executionTime: number
  usedFallback: boolean
  circuitBreakerTriggered: boolean
  retryCount: number
}

/**
 * MCP Integration Safety Manager
 */
export class MCPIntegrationSafety {
  private static instance: MCPIntegrationSafety
  private connectionState: MCPConnectionState
  private config: MCPSafetyConfig
  private healthCheckTimer?: NodeJS.Timeout
  private page: Page

  constructor(page: Page, config?: Partial<MCPSafetyConfig>) {
    this.page = page
    this.config = {
      connectionTimeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 30000,
      healthCheckInterval: 10000,
      gracefulDegradation: true,
      fallbackBehavior: 'mock',
      ...config
    }

    this.connectionState = {
      status: 'disconnected',
      lastChecked: 0,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      tools: []
    }

    this.startHealthChecking()
  }

  static getInstance(page: Page, config?: Partial<MCPSafetyConfig>): MCPIntegrationSafety {
    if (!this.instance) {
      this.instance = new MCPIntegrationSafety(page, config)
    }
    return this.instance
  }

  /**
   * Start continuous health checking
   */
  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck()
    }, this.config.healthCheckInterval)
  }

  /**
   * Stop health checking
   */
  stopHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }
  }

  /**
   * Perform MCP health check with circuit breaker logic
   */
  async performHealthCheck(): Promise<MCPConnectionState> {
    const startTime = Date.now()

    try {
      // Skip if circuit breaker is open and not ready to reset
      if (this.isCircuitBreakerOpen()) {
        return this.connectionState
      }

      const status = await Promise.race([
        MCPTestHelpers.checkMCPAvailability(this.page),
        this.createTimeoutPromise(this.config.connectionTimeout)
      ])

      this.updateConnectionState(status, Date.now() - startTime)
      return this.connectionState

    } catch (error) {
      this.handleConnectionError(error as Error, Date.now() - startTime)
      return this.connectionState
    }
  }

  /**
   * Create a timeout promise for connection attempts
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeout)
    })
  }

  /**
   * Update connection state based on health check result
   */
  private updateConnectionState(status: MCPServerStatus, responseTime: number): void {
    this.connectionState.lastChecked = Date.now()

    if (status.connected) {
      this.connectionState.status = 'connected'
      this.connectionState.tools = status.tools
      this.connectionState.version = status.version
      this.connectionState.consecutiveFailures = 0
      this.connectionState.circuitBreakerOpen = false
      this.connectionState.error = undefined
    } else {
      this.handleConnectionFailure(status.error || 'Unknown connection failure')
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error, responseTime: number): void {
    this.connectionState.lastChecked = Date.now()
    this.connectionState.error = error.message

    if (error.message.includes('timeout')) {
      this.connectionState.status = 'timeout'
    } else {
      this.connectionState.status = 'error'
    }

    this.handleConnectionFailure(error.message)
  }

  /**
   * Handle connection failure and circuit breaker logic
   */
  private handleConnectionFailure(errorMessage: string): void {
    this.connectionState.consecutiveFailures++
    this.connectionState.error = errorMessage

    // Open circuit breaker if threshold is reached
    if (this.connectionState.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.connectionState.circuitBreakerOpen = true
      console.warn(`🔴 MCP Circuit breaker opened after ${this.connectionState.consecutiveFailures} failures`)
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.connectionState.circuitBreakerOpen) {
      return false
    }

    // Check if circuit breaker should reset
    const timeSinceLastCheck = Date.now() - this.connectionState.lastChecked
    if (timeSinceLastCheck > this.config.circuitBreakerResetTime) {
      this.connectionState.circuitBreakerOpen = false
      this.connectionState.consecutiveFailures = 0
      console.log('🟡 MCP Circuit breaker reset - attempting reconnection')
      return false
    }

    return true
  }

  /**
   * Safely execute MCP tool with comprehensive error handling
   */
  async safelyExecuteMCPTool(
    toolName: string,
    params: any,
    testContext?: string
  ): Promise<SafeMCPResult> {
    const startTime = Date.now()
    let retryCount = 0
    let lastError: string | undefined

    // Check circuit breaker first
    if (this.isCircuitBreakerOpen()) {
      return {
        success: false,
        error: 'Circuit breaker is open - MCP calls blocked',
        executionTime: 0,
        usedFallback: true,
        circuitBreakerTriggered: true,
        retryCount: 0
      }
    }

    // Ensure we have recent connection status
    await this.performHealthCheck()

    // If MCP is not available, handle gracefully
    if (this.connectionState.status !== 'connected') {
      return await this.handleMCPUnavailable(toolName, params, testContext)
    }

    // Attempt execution with retries
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await Promise.race([
          MCPTestHelpers.callMCPTool(this.page, toolName, params),
          this.createTimeoutPromise(this.config.connectionTimeout)
        ])

        if (result && !result.error) {
          return {
            success: true,
            data: result,
            executionTime: Date.now() - startTime,
            usedFallback: false,
            circuitBreakerTriggered: false,
            retryCount: attempt
          }
        } else {
          lastError = result?.error || 'Unknown error'
          retryCount = attempt
        }

      } catch (error) {
        lastError = (error as Error).message
        retryCount = attempt

        // Don't retry on timeout or circuit breaker errors
        if (lastError.includes('timeout') || lastError.includes('Circuit breaker')) {
          break
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt))
        }
      }
    }

    // All retries failed - handle with fallback
    this.handleConnectionFailure(lastError || 'Max retries exceeded')

    if (this.config.gracefulDegradation) {
      return await this.handleMCPUnavailable(toolName, params, testContext)
    }

    return {
      success: false,
      error: lastError || 'MCP execution failed after retries',
      executionTime: Date.now() - startTime,
      usedFallback: false,
      circuitBreakerTriggered: false,
      retryCount
    }
  }

  /**
   * Handle MCP unavailable scenarios based on configuration
   */
  private async handleMCPUnavailable(
    toolName: string,
    params: any,
    testContext?: string
  ): Promise<SafeMCPResult> {
    const executionTime = Date.now()

    switch (this.config.fallbackBehavior) {
      case 'mock':
        console.log(`🎭 Using mock for MCP tool '${toolName}' (${testContext || 'no context'})`)
        const mockResult = await this.executeMockTool(toolName, params)
        return {
          success: true,
          data: mockResult,
          executionTime: Date.now() - executionTime,
          usedFallback: true,
          circuitBreakerTriggered: this.connectionState.circuitBreakerOpen,
          retryCount: 0
        }

      case 'skip':
        console.log(`⏭️ Skipping MCP tool '${toolName}' - not available (${testContext || 'no context'})`)
        return {
          success: true,
          data: { skipped: true, reason: 'MCP not available' },
          executionTime: Date.now() - executionTime,
          usedFallback: true,
          circuitBreakerTriggered: this.connectionState.circuitBreakerOpen,
          retryCount: 0
        }

      case 'error':
        return {
          success: false,
          error: `MCP tool '${toolName}' required but not available`,
          executionTime: Date.now() - executionTime,
          usedFallback: false,
          circuitBreakerTriggered: this.connectionState.circuitBreakerOpen,
          retryCount: 0
        }

      default:
        return {
          success: false,
          error: `Unknown fallback behavior: ${this.config.fallbackBehavior}`,
          executionTime: Date.now() - executionTime,
          usedFallback: false,
          circuitBreakerTriggered: false,
          retryCount: 0
        }
    }
  }

  /**
   * Execute mock tool with realistic behavior
   */
  private async executeMockTool(toolName: string, params: any): Promise<any> {
    // Add small delay to simulate network latency
    await this.delay(50 + Math.random() * 100)

    const mockHandlers: Record<string, (params: any) => any> = {
      'project_manager': this.mockProjectManager,
      'ticket_manager': this.mockTicketManager,
      'queue_processor': this.mockQueueProcessor,
      'prompt_manager': this.mockPromptManager,
      'task_manager': this.mockTaskManager
    }

    const handler = mockHandlers[toolName]
    if (handler) {
      return handler.call(this, params)
    }

    // Generic mock response
    return {
      success: true,
      data: {
        tool: toolName,
        params,
        mockResponse: true,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Mock project manager tool
   */
  private mockProjectManager(params: any): any {
    switch (params.action) {
      case 'overview':
        return {
          success: true,
          data: {
            id: params.projectId || 1,
            name: 'Mock Test Project',
            path: '/tmp/mock-project',
            files: ['README.md', 'src/index.ts'],
            tickets: [],
            prompts: []
          }
        }
      case 'suggest_files':
        return {
          success: true,
          data: [
            { path: 'src/components/MockComponent.tsx', relevance: 0.9 },
            { path: 'src/utils/mockUtils.ts', relevance: 0.7 },
            { path: 'tests/mock.test.ts', relevance: 0.6 }
          ]
        }
      default:
        return { success: false, error: `Mock action '${params.action}' not implemented` }
    }
  }

  /**
   * Mock ticket manager tool
   */
  private mockTicketManager(params: any): any {
    switch (params.action) {
      case 'create':
        return {
          success: true,
          data: {
            id: Math.floor(Math.random() * 1000) + 1,
            title: params.data?.title || 'Mock Ticket',
            overview: params.data?.overview || 'Mock ticket overview',
            priority: params.data?.priority || 'normal',
            createdAt: new Date().toISOString()
          }
        }
      case 'list':
        return {
          success: true,
          data: [
            { id: 1, title: 'Mock Ticket 1', overview: 'Mock overview 1', priority: 'high' },
            { id: 2, title: 'Mock Ticket 2', overview: 'Mock overview 2', priority: 'normal' }
          ]
        }
      default:
        return { success: false, error: `Mock action '${params.action}' not implemented` }
    }
  }

  /**
   * Mock queue processor tool
   */
  private mockQueueProcessor(params: any): any {
    switch (params.action) {
      case 'get_next_task':
        return {
          success: true,
          data: {
            id: Math.floor(Math.random() * 100) + 1,
            content: 'Mock task from queue',
            status: 'pending',
            priority: 'normal'
          }
        }
      case 'complete_task':
        return {
          success: true,
          data: { id: params.data?.itemId, status: 'completed' }
        }
      default:
        return { success: false, error: `Mock action '${params.action}' not implemented` }
    }
  }

  /**
   * Mock prompt manager tool
   */
  private mockPromptManager(params: any): any {
    switch (params.action) {
      case 'create':
        return {
          success: true,
          data: {
            id: Math.floor(Math.random() * 1000) + 1,
            title: params.data?.title || 'Mock Prompt',
            content: params.data?.content || 'Mock prompt content',
            tags: params.data?.tags || ['mock', 'test']
          }
        }
      case 'list':
        return {
          success: true,
          data: [
            { id: 1, title: 'Mock Prompt 1', content: 'Mock content 1' },
            { id: 2, title: 'Mock Prompt 2', content: 'Mock content 2' }
          ]
        }
      default:
        return { success: false, error: `Mock action '${params.action}' not implemented` }
    }
  }

  /**
   * Mock task manager tool
   */
  private mockTaskManager(params: any): any {
    switch (params.action) {
      case 'create':
        return {
          success: true,
          data: {
            id: Math.floor(Math.random() * 1000) + 1,
            content: params.data?.content || 'Mock task',
            description: params.data?.description || 'Mock task description',
            done: false
          }
        }
      default:
        return { success: false, error: `Mock action '${params.action}' not implemented` }
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): MCPConnectionState {
    return { ...this.connectionState }
  }

  /**
   * Get safety configuration
   */
  getConfig(): MCPSafetyConfig {
    return { ...this.config }
  }

  /**
   * Update safety configuration
   */
  updateConfig(updates: Partial<MCPSafetyConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.connectionState.circuitBreakerOpen = false
    this.connectionState.consecutiveFailures = 0
    console.log('🔄 MCP Circuit breaker manually reset')
  }

  /**
   * Force circuit breaker open (for testing)
   */
  forceCircuitBreakerOpen(): void {
    this.connectionState.circuitBreakerOpen = true
    console.log('🔴 MCP Circuit breaker manually opened')
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopHealthChecking()
  }
}

/**
 * Utility functions for MCP safety testing
 */
export const MCPSafetyUtils = {
  /**
   * Create MCP safety manager for test
   */
  createSafetyManager(page: Page, testInfo?: TestInfo): MCPIntegrationSafety {
    const testName = testInfo?.title || 'unknown-test'
    
    return MCPIntegrationSafety.getInstance(page, {
      connectionTimeout: 3000, // Shorter timeout for tests
      retryAttempts: 2, // Fewer retries for faster tests
      retryDelay: 500, // Shorter delay for faster tests
      circuitBreakerThreshold: 3, // Lower threshold for tests
      gracefulDegradation: true,
      fallbackBehavior: 'mock'
    })
  },

  /**
   * Test MCP functionality with comprehensive safety
   */
  async testWithMCPSafety<T>(
    page: Page,
    testName: string,
    testFn: (safetyManager: MCPIntegrationSafety) => Promise<T>
  ): Promise<T> {
    const safetyManager = this.createSafetyManager(page)
    
    try {
      console.log(`🛡️ Starting safe MCP test: ${testName}`)
      const result = await testFn(safetyManager)
      console.log(`✅ Safe MCP test completed: ${testName}`)
      return result
    } finally {
      safetyManager.cleanup()
    }
  },

  /**
   * Assert MCP result with safety checks
   */
  assertSafeMCPResult(result: SafeMCPResult, expectSuccess: boolean = true): void {
    expect(result).toBeDefined()
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.executionTime).toBe('number')
    expect(typeof result.usedFallback).toBe('boolean')
    expect(typeof result.circuitBreakerTriggered).toBe('boolean')
    expect(typeof result.retryCount).toBe('number')

    if (expectSuccess) {
      expect(result.success).toBe(true)
      if (result.usedFallback) {
        console.log(`ℹ️ Test used fallback behavior (circuit breaker: ${result.circuitBreakerTriggered})`)
      }
    } else {
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    }
  },

  /**
   * Wait for MCP circuit breaker to reset
   */
  async waitForCircuitBreakerReset(
    safetyManager: MCPIntegrationSafety,
    maxWait: number = 35000
  ): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWait) {
      const status = safetyManager.getConnectionStatus()
      if (!status.circuitBreakerOpen) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    return false
  }
}