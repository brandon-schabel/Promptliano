/**
 * Parallel Execution Coordinator
 *
 * This module provides advanced coordination for parallel test execution,
 * ensuring proper resource management, load balancing, and conflict prevention.
 */

import { TestInfo, Worker } from '@playwright/test'
import { GlobalTestCoordinator } from './test-data-manager'

/**
 * Configuration for parallel test execution
 */
interface ParallelExecutionConfig {
  maxWorkers: number
  resourcePools: ResourcePool[]
  loadBalancingStrategy: 'round-robin' | 'least-loaded' | 'resource-aware'
  retryStrategy: RetryStrategy
  timeouts: TimeoutConfig
}

interface ResourcePool {
  name: string
  type: 'database' | 'file-system' | 'network' | 'mcp-connection'
  maxConcurrent: number
  currentUsage: number
  waitingQueue: string[]
}

interface RetryStrategy {
  maxRetries: number
  retryDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

interface TimeoutConfig {
  testTimeout: number
  actionTimeout: number
  resourceWaitTimeout: number
  cleanupTimeout: number
}

/**
 * Worker load information for load balancing
 */
interface WorkerLoad {
  workerId: string
  activeTests: number
  resourceUsage: Map<string, number>
  performance: {
    avgTestDuration: number
    successRate: number
    lastUpdateTime: number
  }
}

/**
 * Test execution context with resource requirements
 */
interface TestExecutionContext {
  testId: string
  testName: string
  requiredResources: string[]
  estimatedDuration: number
  priority: 'low' | 'normal' | 'high' | 'critical'
  retryCount: number
  startTime?: number
  assignedWorker?: string
}

/**
 * Parallel Execution Coordinator class
 */
export class ParallelExecutionCoordinator {
  private static instance: ParallelExecutionCoordinator
  private config: ParallelExecutionConfig
  private resourcePools: Map<string, ResourcePool> = new Map()
  private workerLoads: Map<string, WorkerLoad> = new Map()
  private executionQueue: TestExecutionContext[] = []
  private activeTests: Map<string, TestExecutionContext> = new Map()

  private constructor(config: ParallelExecutionConfig) {
    this.config = config
    this.initializeResourcePools()
  }

  static getInstance(config?: ParallelExecutionConfig): ParallelExecutionCoordinator {
    if (!this.instance) {
      this.instance = new ParallelExecutionCoordinator(config || this.getDefaultConfig())
    }
    return this.instance
  }

  /**
   * Get default configuration for parallel execution
   */
  private static getDefaultConfig(): ParallelExecutionConfig {
    return {
      maxWorkers: parseInt(process.env.CI ? '2' : '4'),
      resourcePools: [
        {
          name: 'database',
          type: 'database',
          maxConcurrent: 10,
          currentUsage: 0,
          waitingQueue: []
        },
        {
          name: 'file-system',
          type: 'file-system',
          maxConcurrent: 20,
          currentUsage: 0,
          waitingQueue: []
        },
        {
          name: 'network',
          type: 'network',
          maxConcurrent: 15,
          currentUsage: 0,
          waitingQueue: []
        },
        {
          name: 'mcp-connection',
          type: 'mcp-connection',
          maxConcurrent: 5,
          currentUsage: 0,
          waitingQueue: []
        }
      ],
      loadBalancingStrategy: 'resource-aware',
      retryStrategy: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        retryableErrors: ['TimeoutError', 'NetworkError', 'TemporaryResourceUnavailable']
      },
      timeouts: {
        testTimeout: 60000,
        actionTimeout: 10000,
        resourceWaitTimeout: 30000,
        cleanupTimeout: 5000
      }
    }
  }

  /**
   * Initialize resource pools
   */
  private initializeResourcePools(): void {
    this.config.resourcePools.forEach((pool) => {
      this.resourcePools.set(pool.name, { ...pool })
    })
  }

  /**
   * Request test execution with resource requirements
   */
  async requestTestExecution(context: Partial<TestExecutionContext>): Promise<string> {
    const testContext: TestExecutionContext = {
      testId: context.testId || this.generateTestId(),
      testName: context.testName || 'Unknown Test',
      requiredResources: context.requiredResources || ['database'],
      estimatedDuration: context.estimatedDuration || 30000,
      priority: context.priority || 'normal',
      retryCount: context.retryCount || 0
    }

    // Check resource availability
    const canExecuteNow = await this.checkResourceAvailability(testContext.requiredResources)

    if (canExecuteNow) {
      await this.allocateResources(testContext)
      const worker = await this.assignWorker(testContext)
      testContext.assignedWorker = worker
      testContext.startTime = Date.now()

      this.activeTests.set(testContext.testId, testContext)
      return testContext.testId
    } else {
      // Add to execution queue
      this.addToExecutionQueue(testContext)
      return testContext.testId
    }
  }

  /**
   * Complete test execution and cleanup resources
   */
  async completeTestExecution(testId: string, success: boolean): Promise<void> {
    const testContext = this.activeTests.get(testId)
    if (!testContext) {
      return
    }

    // Update worker load information
    if (testContext.assignedWorker) {
      await this.updateWorkerLoad(testContext.assignedWorker, testContext, success)
    }

    // Release allocated resources
    await this.releaseResources(testContext)

    // Remove from active tests
    this.activeTests.delete(testId)

    // Process waiting queue
    await this.processExecutionQueue()
  }

  /**
   * Handle test retry
   */
  async retryTest(testId: string, error: Error): Promise<boolean> {
    const testContext = this.activeTests.get(testId)
    if (!testContext) {
      return false
    }

    const shouldRetry = this.shouldRetryTest(testContext, error)
    if (!shouldRetry) {
      await this.completeTestExecution(testId, false)
      return false
    }

    // Increment retry count
    testContext.retryCount++

    // Calculate retry delay
    const delay =
      this.config.retryStrategy.retryDelay *
      Math.pow(this.config.retryStrategy.backoffMultiplier, testContext.retryCount - 1)

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Re-request execution
    await this.completeTestExecution(testId, false)
    await this.requestTestExecution(testContext)

    return true
  }

  /**
   * Check if resources are available for test execution
   */
  private async checkResourceAvailability(requiredResources: string[]): Promise<boolean> {
    return requiredResources.every((resourceName) => {
      const pool = this.resourcePools.get(resourceName)
      return pool && pool.currentUsage < pool.maxConcurrent
    })
  }

  /**
   * Allocate resources for test execution
   */
  private async allocateResources(testContext: TestExecutionContext): Promise<void> {
    for (const resourceName of testContext.requiredResources) {
      const pool = this.resourcePools.get(resourceName)
      if (pool) {
        pool.currentUsage++
      }
    }
  }

  /**
   * Release resources after test completion
   */
  private async releaseResources(testContext: TestExecutionContext): Promise<void> {
    for (const resourceName of testContext.requiredResources) {
      const pool = this.resourcePools.get(resourceName)
      if (pool && pool.currentUsage > 0) {
        pool.currentUsage--
      }
    }
  }

  /**
   * Assign worker based on load balancing strategy
   */
  private async assignWorker(testContext: TestExecutionContext): Promise<string> {
    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.assignWorkerRoundRobin()

      case 'least-loaded':
        return this.assignWorkerLeastLoaded()

      case 'resource-aware':
        return this.assignWorkerResourceAware(testContext)

      default:
        return this.assignWorkerRoundRobin()
    }
  }

  /**
   * Round-robin worker assignment
   */
  private assignWorkerRoundRobin(): string {
    const workers = Array.from(this.workerLoads.keys())
    if (workers.length === 0) {
      return 'worker-0' // Default worker
    }

    const currentIndex = workers.length % this.config.maxWorkers
    return workers[currentIndex] || 'worker-0'
  }

  /**
   * Least loaded worker assignment
   */
  private assignWorkerLeastLoaded(): string {
    let leastLoadedWorker = 'worker-0'
    let minLoad = Infinity

    this.workerLoads.forEach((load, workerId) => {
      if (load.activeTests < minLoad) {
        minLoad = load.activeTests
        leastLoadedWorker = workerId
      }
    })

    return leastLoadedWorker
  }

  /**
   * Resource-aware worker assignment
   */
  private assignWorkerResourceAware(testContext: TestExecutionContext): string {
    let bestWorker = 'worker-0'
    let bestScore = -Infinity

    this.workerLoads.forEach((load, workerId) => {
      // Calculate score based on resource usage and performance
      const resourceScore = this.calculateResourceScore(load, testContext.requiredResources)
      const performanceScore = load.performance.successRate * 100
      const loadScore = Math.max(0, 100 - load.activeTests * 10)

      const totalScore = resourceScore * 0.4 + performanceScore * 0.4 + loadScore * 0.2

      if (totalScore > bestScore) {
        bestScore = totalScore
        bestWorker = workerId
      }
    })

    return bestWorker
  }

  /**
   * Calculate resource utilization score for a worker
   */
  private calculateResourceScore(workerLoad: WorkerLoad, requiredResources: string[]): number {
    let totalScore = 0
    let resourceCount = 0

    requiredResources.forEach((resource) => {
      const usage = workerLoad.resourceUsage.get(resource) || 0
      const pool = this.resourcePools.get(resource)

      if (pool) {
        const utilizationRate = usage / pool.maxConcurrent
        totalScore += Math.max(0, 100 - utilizationRate * 100)
        resourceCount++
      }
    })

    return resourceCount > 0 ? totalScore / resourceCount : 50
  }

  /**
   * Update worker load information after test completion
   */
  private async updateWorkerLoad(workerId: string, testContext: TestExecutionContext, success: boolean): Promise<void> {
    let workerLoad = this.workerLoads.get(workerId)

    if (!workerLoad) {
      workerLoad = {
        workerId,
        activeTests: 0,
        resourceUsage: new Map(),
        performance: {
          avgTestDuration: 0,
          successRate: 1,
          lastUpdateTime: Date.now()
        }
      }
      this.workerLoads.set(workerId, workerLoad)
    }

    // Update active test count
    workerLoad.activeTests = Math.max(0, workerLoad.activeTests - 1)

    // Update resource usage
    testContext.requiredResources.forEach((resource) => {
      const currentUsage = workerLoad!.resourceUsage.get(resource) || 0
      workerLoad!.resourceUsage.set(resource, Math.max(0, currentUsage - 1))
    })

    // Update performance metrics
    if (testContext.startTime) {
      const duration = Date.now() - testContext.startTime
      const currentAvg = workerLoad.performance.avgTestDuration
      workerLoad.performance.avgTestDuration = currentAvg === 0 ? duration : (currentAvg + duration) / 2

      // Update success rate (exponential moving average)
      const alpha = 0.1
      workerLoad.performance.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * workerLoad.performance.successRate
    }

    workerLoad.performance.lastUpdateTime = Date.now()
  }

  /**
   * Add test to execution queue based on priority
   */
  private addToExecutionQueue(testContext: TestExecutionContext): void {
    // Insert based on priority (higher priority first)
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 }
    const contextPriority = priorityOrder[testContext.priority]

    let insertIndex = this.executionQueue.length
    for (let i = 0; i < this.executionQueue.length; i++) {
      const queuePriority = priorityOrder[this.executionQueue[i].priority]
      if (contextPriority < queuePriority) {
        insertIndex = i
        break
      }
    }

    this.executionQueue.splice(insertIndex, 0, testContext)
  }

  /**
   * Process execution queue and start waiting tests
   */
  private async processExecutionQueue(): Promise<void> {
    const readyTests: TestExecutionContext[] = []

    for (let i = 0; i < this.executionQueue.length; i++) {
      const testContext = this.executionQueue[i]
      const canExecute = await this.checkResourceAvailability(testContext.requiredResources)

      if (canExecute) {
        readyTests.push(testContext)
        this.executionQueue.splice(i, 1)
        i-- // Adjust index after removal
      }
    }

    // Start ready tests
    for (const testContext of readyTests) {
      await this.allocateResources(testContext)
      const worker = await this.assignWorker(testContext)
      testContext.assignedWorker = worker
      testContext.startTime = Date.now()

      this.activeTests.set(testContext.testId, testContext)
    }
  }

  /**
   * Determine if a test should be retried based on error and configuration
   */
  private shouldRetryTest(testContext: TestExecutionContext, error: Error): boolean {
    if (testContext.retryCount >= this.config.retryStrategy.maxRetries) {
      return false
    }

    return this.config.retryStrategy.retryableErrors.some(
      (retryableError) => error.name.includes(retryableError) || error.message.includes(retryableError)
    )
  }

  /**
   * Generate unique test ID
   */
  private generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    activeTests: number
    queuedTests: number
    resourceUtilization: Map<string, number>
    workerLoads: Map<string, WorkerLoad>
    avgWaitTime: number
  } {
    const resourceUtilization = new Map<string, number>()
    this.resourcePools.forEach((pool, name) => {
      resourceUtilization.set(name, (pool.currentUsage / pool.maxConcurrent) * 100)
    })

    const totalWaitTime = this.executionQueue.reduce((sum, test) => {
      return sum + (Date.now() - (test.startTime || Date.now()))
    }, 0)
    const avgWaitTime = this.executionQueue.length > 0 ? totalWaitTime / this.executionQueue.length : 0

    return {
      activeTests: this.activeTests.size,
      queuedTests: this.executionQueue.length,
      resourceUtilization,
      workerLoads: new Map(this.workerLoads),
      avgWaitTime
    }
  }

  /**
   * Emergency shutdown - cleanup all resources
   */
  async emergencyShutdown(): Promise<void> {
    // Clear all queues
    this.executionQueue.length = 0
    this.activeTests.clear()

    // Reset resource pools
    this.resourcePools.forEach((pool) => {
      pool.currentUsage = 0
      pool.waitingQueue.length = 0
    })

    // Clear worker loads
    this.workerLoads.clear()
  }
}

/**
 * Test execution helper functions
 */
export const ParallelExecutionUtils = {
  /**
   * Create execution coordinator with test-specific configuration
   */
  createCoordinator(overrides: Partial<ParallelExecutionConfig> = {}): ParallelExecutionCoordinator {
    const config = {
      ...ParallelExecutionCoordinator['getDefaultConfig'](),
      ...overrides
    }
    return ParallelExecutionCoordinator.getInstance(config)
  },

  /**
   * Estimate test resource requirements based on test name and content
   */
  estimateResourceRequirements(testName: string): string[] {
    const requirements: string[] = ['database'] // Always need database

    if (testName.toLowerCase().includes('file')) {
      requirements.push('file-system')
    }

    if (testName.toLowerCase().includes('api') || testName.toLowerCase().includes('network')) {
      requirements.push('network')
    }

    if (testName.toLowerCase().includes('mcp') || testName.toLowerCase().includes('chat')) {
      requirements.push('mcp-connection')
    }

    return requirements
  },

  /**
   * Calculate test priority based on test characteristics
   */
  calculateTestPriority(testInfo: TestInfo): 'low' | 'normal' | 'high' | 'critical' {
    const testName = testInfo.title.toLowerCase()

    if (testName.includes('smoke') || testName.includes('basic')) {
      return 'critical'
    }

    if (testName.includes('auth') || testName.includes('security')) {
      return 'high'
    }

    if (testName.includes('performance') || testName.includes('visual')) {
      return 'low'
    }

    return 'normal'
  }
}
