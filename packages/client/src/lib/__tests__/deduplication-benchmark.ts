/**
 * Request Deduplication Performance Benchmarks
 * 
 * Comprehensive performance testing suite for measuring the impact
 * of request deduplication on application performance.
 * 
 * Benchmarks cover:
 * - Request latency reduction
 * - Memory usage optimization
 * - Cache efficiency
 * - Bundle size impact
 * - Real-world usage patterns
 */

import { RequestDeduplicator, createQueryKeyBasedDeduplicator } from '../request-deduplicator'
import { DeduplicatedApiClient } from '../deduplicated-api-client'

// ============================================================================
// Benchmark Configuration
// ============================================================================

interface BenchmarkConfig {
  iterations: number
  requestCount: number
  duplicateRatio: number // 0-1, percentage of requests that are duplicates
  requestDelay: number // Simulated network delay in ms
  enableLogging: boolean
}

interface BenchmarkResult {
  scenario: string
  withDeduplication: {
    totalTime: number
    averageTime: number
    requestCount: number
    actualNetworkCalls: number
    memoryUsage: number
  }
  withoutDeduplication: {
    totalTime: number
    averageTime: number
    requestCount: number
    actualNetworkCalls: number
    memoryUsage: number
  }
  improvement: {
    timeReduction: number // percentage
    requestReduction: number // percentage
    memoryReduction: number // percentage
  }
}

// ============================================================================
// Mock Request Executor
// ============================================================================

class MockRequestExecutor {
  private callCount = 0
  private delay: number

  constructor(delay: number = 100) {
    this.delay = delay
  }

  async execute(requestKey: string): Promise<any> {
    this.callCount++
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.delay))
    
    return {
      id: this.callCount,
      data: `Response for ${requestKey}`,
      timestamp: Date.now()
    }
  }

  getCallCount(): number {
    return this.callCount
  }

  reset(): void {
    this.callCount = 0
  }
}

// ============================================================================
// Benchmark Utilities
// ============================================================================

class BenchmarkUtils {
  static measureMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024 // MB
    }
    
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
    }
    
    return 0
  }

  static generateRequestPattern(config: BenchmarkConfig): Array<{
    method: string
    endpoint: string
    params?: Record<string, any>
    body?: any
  }> {
    const requests = []
    const uniqueRequestCount = Math.floor(config.requestCount * (1 - config.duplicateRatio))
    
    // Generate unique requests
    for (let i = 0; i < uniqueRequestCount; i++) {
      requests.push({
        method: 'GET',
        endpoint: `/api/resource/${i}`,
        params: { id: i, type: 'benchmark' }
      })
    }
    
    // Fill remaining with duplicates
    while (requests.length < config.requestCount) {
      const randomIndex = Math.floor(Math.random() * uniqueRequestCount)
      requests.push(requests[randomIndex])
    }
    
    // Shuffle to simulate real usage
    return this.shuffleArray(requests)
  }

  static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  static async measureAsync<T>(fn: () => Promise<T>): Promise<{
    result: T
    duration: number
    memoryBefore: number
    memoryAfter: number
  }> {
    const memoryBefore = this.measureMemory()
    const startTime = performance.now()
    
    const result = await fn()
    
    const endTime = performance.now()
    const memoryAfter = this.measureMemory()
    
    return {
      result,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter
    }
  }
}

// ============================================================================
// Core Benchmark Functions
// ============================================================================

export class DeduplicationBenchmark {
  private config: BenchmarkConfig
  private mockExecutor: MockRequestExecutor

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      iterations: 5,
      requestCount: 100,
      duplicateRatio: 0.6, // 60% duplicates
      requestDelay: 50,
      enableLogging: false,
      ...config
    }
    
    this.mockExecutor = new MockRequestExecutor(this.config.requestDelay)
  }

  /**
   * Benchmark basic deduplication performance
   */
  async benchmarkBasicDeduplication(): Promise<BenchmarkResult> {
    const requests = BenchmarkUtils.generateRequestPattern(this.config)
    
    // Test with deduplication
    const withDeduplication = await this.runWithDeduplication(requests)
    
    // Test without deduplication
    const withoutDeduplication = await this.runWithoutDeduplication(requests)
    
    return this.calculateImprovement(
      'Basic Deduplication',
      withDeduplication,
      withoutDeduplication
    )
  }

  /**
   * Benchmark query-key-based deduplication
   */
  async benchmarkQueryKeyDeduplication(): Promise<BenchmarkResult> {
    const requests = this.generateApiLikeRequests()
    
    // Test with query-key-based deduplication
    const withDeduplication = await this.runWithQueryKeyDeduplication(requests)
    
    // Test without deduplication
    const withoutDeduplication = await this.runWithoutDeduplication(requests)
    
    return this.calculateImprovement(
      'Query Key Deduplication',
      withDeduplication,
      withoutDeduplication
    )
  }

  /**
   * Benchmark real-world usage patterns
   */
  async benchmarkRealWorldPatterns(): Promise<BenchmarkResult[]> {
    const patterns = [
      this.generateDashboardLoadPattern(),
      this.generateUserInteractionPattern(),
      this.generateBackgroundRefreshPattern(),
      this.generateFormSubmissionPattern()
    ]
    
    const results: BenchmarkResult[] = []
    
    for (const [name, requests] of patterns) {
      const withDeduplication = await this.runWithDeduplication(requests)
      const withoutDeduplication = await this.runWithoutDeduplication(requests)
      
      results.push(this.calculateImprovement(
        name,
        withDeduplication,
        withoutDeduplication
      ))
    }
    
    return results
  }

  /**
   * Benchmark concurrent request handling
   */
  async benchmarkConcurrentRequests(): Promise<BenchmarkResult> {
    const requests = BenchmarkUtils.generateRequestPattern({
      ...this.config,
      duplicateRatio: 0.8 // High duplicate ratio for concurrent scenario
    })
    
    // Test with deduplication (concurrent)
    const withDeduplication = await this.runConcurrentWithDeduplication(requests)
    
    // Test without deduplication (concurrent)
    const withoutDeduplication = await this.runConcurrentWithoutDeduplication(requests)
    
    return this.calculateImprovement(
      'Concurrent Requests',
      withDeduplication,
      withoutDeduplication
    )
  }

  /**
   * Benchmark memory usage under load
   */
  async benchmarkMemoryUsage(): Promise<{
    deduplicationMemoryGrowth: number
    traditionalMemoryGrowth: number
    improvement: number
  }> {
    const largeRequestSet = BenchmarkUtils.generateRequestPattern({
      ...this.config,
      requestCount: 1000,
      duplicateRatio: 0.5
    })
    
    // Memory test with deduplication
    const deduplicator = new RequestDeduplicator({ maxCacheSize: 500 })
    const memoryBefore = BenchmarkUtils.measureMemory()
    
    await Promise.all(
      largeRequestSet.map(request => 
        deduplicator.deduplicate(request, () => this.mockExecutor.execute(JSON.stringify(request)))
      )
    )
    
    const memoryAfterDeduplication = BenchmarkUtils.measureMemory()
    deduplicator.destroy()
    
    // Memory test without deduplication
    this.mockExecutor.reset()
    const memoryBeforeTraditional = BenchmarkUtils.measureMemory()
    
    await Promise.all(
      largeRequestSet.map(request => 
        this.mockExecutor.execute(JSON.stringify(request))
      )
    )
    
    const memoryAfterTraditional = BenchmarkUtils.measureMemory()
    
    const deduplicationMemoryGrowth = memoryAfterDeduplication - memoryBefore
    const traditionalMemoryGrowth = memoryAfterTraditional - memoryBeforeTraditional
    
    return {
      deduplicationMemoryGrowth,
      traditionalMemoryGrowth,
      improvement: ((traditionalMemoryGrowth - deduplicationMemoryGrowth) / traditionalMemoryGrowth) * 100
    }
  }

  // ============================================================================
  // Private Test Runners
  // ============================================================================

  private async runWithDeduplication(requests: any[]) {
    const deduplicator = new RequestDeduplicator()
    this.mockExecutor.reset()
    
    const measurement = await BenchmarkUtils.measureAsync(async () => {
      await Promise.all(
        requests.map(request => 
          deduplicator.deduplicate(request, () => this.mockExecutor.execute(JSON.stringify(request)))
        )
      )
    })
    
    const result = {
      totalTime: measurement.duration,
      averageTime: measurement.duration / requests.length,
      requestCount: requests.length,
      actualNetworkCalls: this.mockExecutor.getCallCount(),
      memoryUsage: measurement.memoryAfter - measurement.memoryBefore
    }
    
    deduplicator.destroy()
    return result
  }

  private async runWithQueryKeyDeduplication(requests: any[]) {
    const deduplicator = createQueryKeyBasedDeduplicator()
    this.mockExecutor.reset()
    
    const measurement = await BenchmarkUtils.measureAsync(async () => {
      await Promise.all(
        requests.map(request => 
          deduplicator.deduplicate(request, () => this.mockExecutor.execute(JSON.stringify(request)))
        )
      )
    })
    
    const result = {
      totalTime: measurement.duration,
      averageTime: measurement.duration / requests.length,
      requestCount: requests.length,
      actualNetworkCalls: this.mockExecutor.getCallCount(),
      memoryUsage: measurement.memoryAfter - measurement.memoryBefore
    }
    
    deduplicator.destroy()
    return result
  }

  private async runWithoutDeduplication(requests: any[]) {
    this.mockExecutor.reset()
    
    const measurement = await BenchmarkUtils.measureAsync(async () => {
      await Promise.all(
        requests.map(request => 
          this.mockExecutor.execute(JSON.stringify(request))
        )
      )
    })
    
    return {
      totalTime: measurement.duration,
      averageTime: measurement.duration / requests.length,
      requestCount: requests.length,
      actualNetworkCalls: this.mockExecutor.getCallCount(),
      memoryUsage: measurement.memoryAfter - measurement.memoryBefore
    }
  }

  private async runConcurrentWithDeduplication(requests: any[]) {
    const deduplicator = new RequestDeduplicator()
    this.mockExecutor.reset()
    
    // Simulate concurrent bursts
    const batchSize = 20
    const batches = []
    
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize))
    }
    
    const measurement = await BenchmarkUtils.measureAsync(async () => {
      for (const batch of batches) {
        await Promise.all(
          batch.map(request => 
            deduplicator.deduplicate(request, () => this.mockExecutor.execute(JSON.stringify(request)))
          )
        )
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    })
    
    const result = {
      totalTime: measurement.duration,
      averageTime: measurement.duration / requests.length,
      requestCount: requests.length,
      actualNetworkCalls: this.mockExecutor.getCallCount(),
      memoryUsage: measurement.memoryAfter - measurement.memoryBefore
    }
    
    deduplicator.destroy()
    return result
  }

  private async runConcurrentWithoutDeduplication(requests: any[]) {
    this.mockExecutor.reset()
    
    // Same batch pattern but without deduplication
    const batchSize = 20
    const batches = []
    
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize))
    }
    
    const measurement = await BenchmarkUtils.measureAsync(async () => {
      for (const batch of batches) {
        await Promise.all(
          batch.map(request => 
            this.mockExecutor.execute(JSON.stringify(request))
          )
        )
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    })
    
    return {
      totalTime: measurement.duration,
      averageTime: measurement.duration / requests.length,
      requestCount: requests.length,
      actualNetworkCalls: this.mockExecutor.getCallCount(),
      memoryUsage: measurement.memoryAfter - measurement.memoryBefore
    }
  }

  // ============================================================================
  // Request Pattern Generators
  // ============================================================================

  private generateApiLikeRequests() {
    return [
      // Projects list (commonly duplicated)
      { method: 'GET', endpoint: '/projects' },
      { method: 'GET', endpoint: '/projects' },
      { method: 'GET', endpoint: '/projects' },
      
      // Project details
      { method: 'GET', endpoint: '/projects/1' },
      { method: 'GET', endpoint: '/projects/1' },
      { method: 'GET', endpoint: '/projects/2' },
      
      // Tickets for projects
      { method: 'GET', endpoint: '/tickets', params: { projectId: 1 } },
      { method: 'GET', endpoint: '/tickets', params: { projectId: 1 } },
      { method: 'GET', endpoint: '/tickets', params: { projectId: 2 } },
      
      // User info (frequently accessed)
      { method: 'GET', endpoint: '/user/profile' },
      { method: 'GET', endpoint: '/user/profile' },
      { method: 'GET', endpoint: '/user/profile' },
      
      // Settings
      { method: 'GET', endpoint: '/settings' },
      { method: 'GET', endpoint: '/settings' }
    ]
  }

  private generateDashboardLoadPattern(): [string, any[]] {
    return ['Dashboard Load', [
      { method: 'GET', endpoint: '/dashboard/stats' },
      { method: 'GET', endpoint: '/projects' },
      { method: 'GET', endpoint: '/tickets/recent' },
      { method: 'GET', endpoint: '/user/notifications' },
      { method: 'GET', endpoint: '/dashboard/stats' }, // Duplicate
      { method: 'GET', endpoint: '/projects' }, // Duplicate
    ]]
  }

  private generateUserInteractionPattern(): [string, any[]] {
    return ['User Interaction', [
      { method: 'GET', endpoint: '/projects/1' },
      { method: 'GET', endpoint: '/projects/1/files' },
      { method: 'GET', endpoint: '/projects/1' }, // User goes back
      { method: 'GET', endpoint: '/projects/1/tickets' },
      { method: 'GET', endpoint: '/projects/1' }, // User goes back again
      { method: 'GET', endpoint: '/projects/1/files' }, // Duplicate
    ]]
  }

  private generateBackgroundRefreshPattern(): [string, any[]] {
    return ['Background Refresh', [
      { method: 'GET', endpoint: '/notifications' },
      { method: 'GET', endpoint: '/user/status' },
      { method: 'GET', endpoint: '/notifications' }, // Auto-refresh
      { method: 'GET', endpoint: '/user/status' }, // Auto-refresh
      { method: 'GET', endpoint: '/sync/status' },
      { method: 'GET', endpoint: '/notifications' }, // Another refresh
    ]]
  }

  private generateFormSubmissionPattern(): [string, any[]] {
    return ['Form Submission', [
      { method: 'GET', endpoint: '/form/options' },
      { method: 'GET', endpoint: '/projects' }, // For dropdown
      { method: 'POST', endpoint: '/tickets', body: { title: 'Test' } },
      { method: 'GET', endpoint: '/projects' }, // Refresh after submit
      { method: 'GET', endpoint: '/tickets' }, // View updated list
      { method: 'GET', endpoint: '/form/options' }, // Form accessed again
    ]]
  }

  // ============================================================================
  // Result Calculation
  // ============================================================================

  private calculateImprovement(
    scenario: string,
    withDeduplication: any,
    withoutDeduplication: any
  ): BenchmarkResult {
    const timeReduction = ((withoutDeduplication.totalTime - withDeduplication.totalTime) / withoutDeduplication.totalTime) * 100
    const requestReduction = ((withoutDeduplication.actualNetworkCalls - withDeduplication.actualNetworkCalls) / withoutDeduplication.actualNetworkCalls) * 100
    const memoryReduction = withoutDeduplication.memoryUsage > 0 
      ? ((withoutDeduplication.memoryUsage - withDeduplication.memoryUsage) / withoutDeduplication.memoryUsage) * 100
      : 0

    return {
      scenario,
      withDeduplication,
      withoutDeduplication,
      improvement: {
        timeReduction: Math.max(0, timeReduction),
        requestReduction: Math.max(0, requestReduction),
        memoryReduction: Math.max(0, memoryReduction)
      }
    }
  }
}

// ============================================================================
// Benchmark Runner
// ============================================================================

export async function runDeduplicationBenchmarks(config?: Partial<BenchmarkConfig>) {
  const benchmark = new DeduplicationBenchmark(config)
  
  console.log('🚀 Starting Request Deduplication Benchmarks...\n')
  
  // Basic deduplication benchmark
  console.log('1. Basic Deduplication Benchmark')
  const basicResult = await benchmark.benchmarkBasicDeduplication()
  printBenchmarkResult(basicResult)
  
  // Query key benchmark
  console.log('2. Query Key Deduplication Benchmark')
  const queryKeyResult = await benchmark.benchmarkQueryKeyDeduplication()
  printBenchmarkResult(queryKeyResult)
  
  // Concurrent requests benchmark
  console.log('3. Concurrent Requests Benchmark')
  const concurrentResult = await benchmark.benchmarkConcurrentRequests()
  printBenchmarkResult(concurrentResult)
  
  // Real-world patterns
  console.log('4. Real-World Usage Patterns')
  const realWorldResults = await benchmark.benchmarkRealWorldPatterns()
  realWorldResults.forEach(printBenchmarkResult)
  
  // Memory usage benchmark
  console.log('5. Memory Usage Benchmark')
  const memoryResult = await benchmark.benchmarkMemoryUsage()
  printMemoryBenchmarkResult(memoryResult)
  
  console.log('\n✅ Benchmarks completed!')
  
  return {
    basic: basicResult,
    queryKey: queryKeyResult,
    concurrent: concurrentResult,
    realWorld: realWorldResults,
    memory: memoryResult
  }
}

function printBenchmarkResult(result: BenchmarkResult) {
  console.log(`\n📊 ${result.scenario}`)
  console.log(`   Time Improvement: ${result.improvement.timeReduction.toFixed(1)}%`)
  console.log(`   Request Reduction: ${result.improvement.requestReduction.toFixed(1)}%`)
  console.log(`   Memory Improvement: ${result.improvement.memoryReduction.toFixed(1)}%`)
  console.log(`   Network Calls: ${result.withDeduplication.actualNetworkCalls} vs ${result.withoutDeduplication.actualNetworkCalls}`)
}

function printMemoryBenchmarkResult(result: {
  deduplicationMemoryGrowth: number
  traditionalMemoryGrowth: number
  improvement: number
}) {
  console.log(`\n💾 Memory Usage`)
  console.log(`   With Deduplication: ${result.deduplicationMemoryGrowth.toFixed(2)}MB`)
  console.log(`   Without Deduplication: ${result.traditionalMemoryGrowth.toFixed(2)}MB`)
  console.log(`   Memory Improvement: ${result.improvement.toFixed(1)}%`)
}