/**
 * Advanced Error Recovery and Test Resilience Patterns
 * 
 * This module provides comprehensive error recovery patterns for test execution,
 * including state recovery, automatic fallbacks, and intelligent retry mechanisms.
 */

import { Page, TestInfo, expect } from '@playwright/test'
import { TestDataManager } from './test-data-manager'
import { MCPIntegrationSafety } from './mcp-integration-safety'

/**
 * Error classification for intelligent recovery
 */
enum ErrorType {
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  ELEMENT_NOT_FOUND = 'element_not_found',
  ASSERTION_FAILED = 'assertion_failed',
  PAGE_CRASH = 'page_crash',
  MCP_FAILURE = 'mcp_failure',
  DATABASE_ERROR = 'database_error',
  PERMISSION_DENIED = 'permission_denied',
  UNKNOWN = 'unknown'
}

/**
 * Recovery strategy definition
 */
interface RecoveryStrategy {
  type: ErrorType
  maxAttempts: number
  recoveryActions: RecoveryAction[]
  fallbackAction?: () => Promise<void>
  skipCondition?: (error: Error) => boolean
}

/**
 * Recovery action types
 */
type RecoveryAction = 
  | { type: 'wait'; duration: number }
  | { type: 'reload'; waitForReady: boolean }
  | { type: 'navigate'; url: string }
  | { type: 'clearState'; includeStorage: boolean }
  | { type: 'resetData'; recreateData: boolean }
  | { type: 'screenshot'; name: string }
  | { type: 'custom'; action: () => Promise<void> }

/**
 * Test state checkpoint for recovery
 */
interface TestStateCheckpoint {
  id: string
  timestamp: number
  pageUrl: string
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  testData: any
  customState?: any
}

/**
 * Advanced Error Recovery Manager
 */
export class AdvancedErrorRecovery {
  private page: Page
  private testInfo: TestInfo
  private dataManager?: TestDataManager
  private mcpSafety?: MCPIntegrationSafety
  private checkpoints: Map<string, TestStateCheckpoint> = new Map()
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy> = new Map()
  private errorHistory: Array<{ error: Error; timestamp: number; resolved: boolean }> = []

  constructor(
    page: Page, 
    testInfo: TestInfo, 
    dataManager?: TestDataManager,
    mcpSafety?: MCPIntegrationSafety
  ) {
    this.page = page
    this.testInfo = testInfo
    this.dataManager = dataManager
    this.mcpSafety = mcpSafety
    this.setupDefaultRecoveryStrategies()
    this.setupErrorListeners()
  }

  /**
   * Setup default recovery strategies for common error types
   */
  private setupDefaultRecoveryStrategies(): void {
    // Timeout errors - usually resolved by waiting and retrying
    this.recoveryStrategies.set(ErrorType.TIMEOUT, {
      type: ErrorType.TIMEOUT,
      maxAttempts: 3,
      recoveryActions: [
        { type: 'wait', duration: 2000 },
        { type: 'screenshot', name: 'timeout-recovery' }
      ]
    })

    // Network errors - reload page and wait
    this.recoveryStrategies.set(ErrorType.NETWORK, {
      type: ErrorType.NETWORK,
      maxAttempts: 2,
      recoveryActions: [
        { type: 'wait', duration: 3000 },
        { type: 'reload', waitForReady: true },
        { type: 'screenshot', name: 'network-recovery' }
      ]
    })

    // Element not found - wait, reload, or navigate back
    this.recoveryStrategies.set(ErrorType.ELEMENT_NOT_FOUND, {
      type: ErrorType.ELEMENT_NOT_FOUND,
      maxAttempts: 2,
      recoveryActions: [
        { type: 'wait', duration: 1000 },
        { type: 'screenshot', name: 'element-missing' }
      ],
      fallbackAction: async () => {
        await this.restoreLastCheckpoint()
      }
    })

    // Page crashes - navigate to safe state
    this.recoveryStrategies.set(ErrorType.PAGE_CRASH, {
      type: ErrorType.PAGE_CRASH,
      maxAttempts: 1,
      recoveryActions: [
        { type: 'navigate', url: '/' },
        { type: 'wait', duration: 3000 },
        { type: 'clearState', includeStorage: true },
        { type: 'resetData', recreateData: true }
      ]
    })

    // MCP failures - use fallback behavior
    this.recoveryStrategies.set(ErrorType.MCP_FAILURE, {
      type: ErrorType.MCP_FAILURE,
      maxAttempts: 2,
      recoveryActions: [
        { type: 'wait', duration: 1000 },
        { type: 'custom', action: async () => {
          if (this.mcpSafety) {
            this.mcpSafety.resetCircuitBreaker()
          }
        }}
      ]
    })

    // Database errors - reset test data
    this.recoveryStrategies.set(ErrorType.DATABASE_ERROR, {
      type: ErrorType.DATABASE_ERROR,
      maxAttempts: 1,
      recoveryActions: [
        { type: 'resetData', recreateData: true },
        { type: 'reload', waitForReady: true }
      ]
    })
  }

  /**
   * Setup error listeners for automatic error detection
   */
  private setupErrorListeners(): void {
    // Listen for page crashes
    this.page.on('crash', () => {
      this.recordError(new Error('Page crashed'), ErrorType.PAGE_CRASH)
    })

    // Listen for console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.recordError(new Error(`Console error: ${msg.text()}`), ErrorType.UNKNOWN)
      }
    })

    // Listen for failed network requests
    this.page.on('requestfailed', request => {
      this.recordError(
        new Error(`Request failed: ${request.url()} - ${request.failure()?.errorText}`),
        ErrorType.NETWORK
      )
    })
  }

  /**
   * Record error in history for analysis
   */
  private recordError(error: Error, type: ErrorType): void {
    this.errorHistory.push({
      error,
      timestamp: Date.now(),
      resolved: false
    })

    console.warn(`🔴 Error recorded (${type}): ${error.message}`)
  }

  /**
   * Classify error type for appropriate recovery strategy
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()
    
    if (message.includes('timeout')) return ErrorType.TIMEOUT
    if (message.includes('network') || message.includes('net::')) return ErrorType.NETWORK
    if (message.includes('not found') || message.includes('no such element')) return ErrorType.ELEMENT_NOT_FOUND
    if (message.includes('expect') || message.includes('assertion')) return ErrorType.ASSERTION_FAILED
    if (message.includes('crash') || message.includes('crashed')) return ErrorType.PAGE_CRASH
    if (message.includes('mcp') || message.includes('circuit breaker')) return ErrorType.MCP_FAILURE
    if (message.includes('database') || message.includes('sqlite')) return ErrorType.DATABASE_ERROR
    if (message.includes('permission') || message.includes('access')) return ErrorType.PERMISSION_DENIED
    
    return ErrorType.UNKNOWN
  }

  /**
   * Execute recovery operation with comprehensive error handling
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: string = 'Unknown Operation',
    customStrategy?: Partial<RecoveryStrategy>
  ): Promise<T> {
    let attempts = 0
    let lastError: Error

    while (attempts < 5) { // Maximum global attempts
      try {
        console.log(`🔄 Executing: ${context} (attempt ${attempts + 1})`)
        const result = await operation()
        
        // Mark recent errors as resolved on success
        this.errorHistory
          .filter(e => !e.resolved && Date.now() - e.timestamp < 30000)
          .forEach(e => e.resolved = true)
        
        return result

      } catch (error) {
        lastError = error as Error
        attempts++
        
        const errorType = this.classifyError(lastError)
        console.error(`❌ ${context} failed (${errorType}): ${lastError.message}`)
        
        // Record the error
        this.recordError(lastError, errorType)
        
        // Get recovery strategy
        const strategy = customStrategy 
          ? { ...this.recoveryStrategies.get(errorType), ...customStrategy }
          : this.recoveryStrategies.get(errorType)
        
        if (!strategy || attempts > strategy.maxAttempts) {
          break
        }

        // Check skip condition
        if (strategy.skipCondition?.(lastError)) {
          console.log(`⏭️ Skipping recovery for ${context} due to skip condition`)
          break
        }

        // Execute recovery actions
        console.log(`🛠️ Attempting recovery for ${context} using ${strategy.type} strategy`)
        await this.executeRecoveryActions(strategy.recoveryActions)
        
        // Brief pause before retry
        await this.delay(500)
      }
    }

    // All recovery attempts failed - try fallback
    const errorType = this.classifyError(lastError!)
    const strategy = this.recoveryStrategies.get(errorType)
    
    if (strategy?.fallbackAction) {
      try {
        console.log(`🆘 Executing fallback action for ${context}`)
        await strategy.fallbackAction()
        
        // Try operation one more time after fallback
        return await operation()
      } catch (fallbackError) {
        console.error(`💥 Fallback failed for ${context}: ${(fallbackError as Error).message}`)
      }
    }

    // Complete failure
    throw new Error(
      `Operation '${context}' failed after ${attempts} attempts. ` +
      `Final error: ${lastError!.message}\n` +
      `Error history: ${this.getRecentErrorSummary()}`
    )
  }

  /**
   * Execute array of recovery actions
   */
  private async executeRecoveryActions(actions: RecoveryAction[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeRecoveryAction(action)
      } catch (error) {
        console.warn(`⚠️ Recovery action failed: ${action.type} - ${(error as Error).message}`)
      }
    }
  }

  /**
   * Execute single recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction): Promise<void> {
    switch (action.type) {
      case 'wait':
        console.log(`⏳ Waiting ${action.duration}ms for recovery`)
        await this.delay(action.duration)
        break

      case 'reload':
        console.log('🔄 Reloading page for recovery')
        await this.page.reload()
        if (action.waitForReady) {
          await this.page.waitForLoadState('networkidle', { timeout: 10000 })
        }
        break

      case 'navigate':
        console.log(`🧭 Navigating to ${action.url} for recovery`)
        await this.page.goto(action.url)
        await this.page.waitForLoadState('networkidle', { timeout: 10000 })
        break

      case 'clearState':
        console.log('🧹 Clearing browser state for recovery')
        await this.page.evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        if (action.includeStorage) {
          await this.page.context().clearCookies()
        }
        break

      case 'resetData':
        console.log('💾 Resetting test data for recovery')
        if (this.dataManager && action.recreateData) {
          await this.dataManager.cleanup()
          // Data manager would need to recreate essential data
        }
        break

      case 'screenshot':
        console.log(`📸 Taking recovery screenshot: ${action.name}`)
        await this.page.screenshot({
          path: `test-results/recovery-${action.name}-${Date.now()}.png`,
          fullPage: true
        })
        break

      case 'custom':
        console.log('⚙️ Executing custom recovery action')
        await action.action()
        break
    }
  }

  /**
   * Create checkpoint of current test state
   */
  async createCheckpoint(id: string, customState?: any): Promise<void> {
    const checkpoint: TestStateCheckpoint = {
      id,
      timestamp: Date.now(),
      pageUrl: this.page.url(),
      localStorage: await this.page.evaluate(() => ({ ...localStorage })),
      sessionStorage: await this.page.evaluate(() => ({ ...sessionStorage })),
      testData: this.dataManager?.getScope(),
      customState
    }

    this.checkpoints.set(id, checkpoint)
    console.log(`📍 Created checkpoint: ${id}`)
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(id: string): Promise<void> {
    const checkpoint = this.checkpoints.get(id)
    if (!checkpoint) {
      throw new Error(`Checkpoint '${id}' not found`)
    }

    console.log(`🔄 Restoring checkpoint: ${id}`)

    // Navigate to saved URL
    await this.page.goto(checkpoint.pageUrl)

    // Restore browser storage
    await this.page.evaluate((storage) => {
      localStorage.clear()
      sessionStorage.clear()
      Object.entries(storage.localStorage).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
      Object.entries(storage.sessionStorage).forEach(([key, value]) => {
        sessionStorage.setItem(key, value)
      })
    }, { 
      localStorage: checkpoint.localStorage, 
      sessionStorage: checkpoint.sessionStorage 
    })

    // Wait for page to stabilize
    await this.page.waitForLoadState('networkidle', { timeout: 10000 })
  }

  /**
   * Restore most recent checkpoint
   */
  async restoreLastCheckpoint(): Promise<void> {
    const checkpoints = Array.from(this.checkpoints.values())
    if (checkpoints.length === 0) {
      throw new Error('No checkpoints available for recovery')
    }

    const latest = checkpoints.sort((a, b) => b.timestamp - a.timestamp)[0]
    await this.restoreCheckpoint(latest.id)
  }

  /**
   * Get summary of recent errors for debugging
   */
  private getRecentErrorSummary(): string {
    const recentErrors = this.errorHistory
      .filter(e => Date.now() - e.timestamp < 60000) // Last minute
      .slice(-5) // Last 5 errors

    return recentErrors
      .map(e => `${e.error.message} (${e.resolved ? 'resolved' : 'unresolved'})`)
      .join('; ')
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.type, strategy)
    console.log(`➕ Added recovery strategy for: ${strategy.type}`)
  }

  /**
   * Get error statistics for test analysis
   */
  getErrorStatistics(): {
    totalErrors: number
    resolvedErrors: number
    errorsByType: Map<ErrorType, number>
    recentErrors: number
  } {
    const errorsByType = new Map<ErrorType, number>()
    
    this.errorHistory.forEach(e => {
      const type = this.classifyError(e.error)
      errorsByType.set(type, (errorsByType.get(type) || 0) + 1)
    })

    return {
      totalErrors: this.errorHistory.length,
      resolvedErrors: this.errorHistory.filter(e => e.resolved).length,
      errorsByType,
      recentErrors: this.errorHistory.filter(e => Date.now() - e.timestamp < 60000).length
    }
  }

  /**
   * Cleanup checkpoints and listeners
   */
  cleanup(): void {
    this.checkpoints.clear()
    this.errorHistory.length = 0
    // Note: Page listeners are automatically cleaned up when page is closed
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Utility functions for error recovery testing
 */
export const ErrorRecoveryUtils = {
  /**
   * Create error recovery manager for test
   */
  createRecoveryManager(
    page: Page, 
    testInfo: TestInfo,
    dataManager?: TestDataManager,
    mcpSafety?: MCPIntegrationSafety
  ): AdvancedErrorRecovery {
    return new AdvancedErrorRecovery(page, testInfo, dataManager, mcpSafety)
  },

  /**
   * Test operation with automatic recovery
   */
  async testWithRecovery<T>(
    page: Page,
    testInfo: TestInfo,
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const recovery = new AdvancedErrorRecovery(page, testInfo)
    try {
      return await recovery.executeWithRecovery(operation, context)
    } finally {
      recovery.cleanup()
    }
  },

  /**
   * Common recovery patterns
   */
  recoveryPatterns: {
    /**
     * Retry with exponential backoff
     */
    async exponentialBackoff<T>(
      operation: () => Promise<T>,
      maxAttempts = 3,
      baseDelay = 1000
    ): Promise<T> {
      let lastError: Error

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation()
        } catch (error) {
          lastError = error as Error
          
          if (attempt === maxAttempts) break
          
          const delay = baseDelay * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError!
    },

    /**
     * Circuit breaker pattern
     */
    createCircuitBreaker<T>(
      operation: () => Promise<T>,
      failureThreshold = 5,
      resetTimeout = 60000
    ) {
      let failures = 0
      let lastFailureTime = 0
      let state: 'closed' | 'open' | 'half-open' = 'closed'

      return async (): Promise<T> => {
        const now = Date.now()

        // Reset if enough time has passed
        if (state === 'open' && now - lastFailureTime > resetTimeout) {
          state = 'half-open'
          failures = 0
        }

        // Reject if circuit is open
        if (state === 'open') {
          throw new Error('Circuit breaker is open - operation blocked')
        }

        try {
          const result = await operation()
          
          // Reset on success
          if (state === 'half-open') {
            state = 'closed'
          }
          failures = 0
          
          return result
        } catch (error) {
          failures++
          lastFailureTime = now

          // Open circuit if threshold exceeded
          if (failures >= failureThreshold) {
            state = 'open'
          }

          throw error
        }
      }
    }
  }
}