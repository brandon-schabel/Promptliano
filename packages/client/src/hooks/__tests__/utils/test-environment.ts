/**
 * Test Environment Setup Utilities
 * Creates isolated test environments for hook factory testing
 */

export interface TestEnvironmentOptions {
  enableRealtime?: boolean
  enableCaching?: boolean
  enableOptimistic?: boolean
  enableProfiling?: boolean
  enableBenchmarks?: boolean
  enableStressTesting?: boolean
  enableWebSocket?: boolean
  enableAnalytics?: boolean
  timeout?: number
}

export class TestEnvironment {
  private options: TestEnvironmentOptions
  private cleanup: (() => Promise<void>)[] = []

  constructor(options: TestEnvironmentOptions) {
    this.options = options
  }

  async cleanup(): Promise<void> {
    await Promise.all(this.cleanup.map(fn => fn()))
    this.cleanup = []
  }

  addCleanup(fn: () => Promise<void>): void {
    this.cleanup.push(fn)
  }
}

export async function createTestEnvironment(options: TestEnvironmentOptions = {}): Promise<TestEnvironment> {
  const env = new TestEnvironment(options)

  // Setup test-specific configurations
  if (options.enableRealtime) {
    // Mock WebSocket server for real-time testing
    const mockWs = global.WebSocket || (() => {})
    env.addCleanup(async () => {
      // Cleanup WebSocket mocks
    })
  }

  if (options.enableCaching) {
    // Enhanced caching for tests
  }

  if (options.enableProfiling) {
    // Performance profiling setup
  }

  return env
}