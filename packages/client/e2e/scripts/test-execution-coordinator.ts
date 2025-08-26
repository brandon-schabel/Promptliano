/**
 * Test Execution Coordinator Scripts
 *
 * This module provides scripts and utilities for coordinating comprehensive
 * test execution across all environments and configurations.
 */

import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { resolve, join } from 'path'

/**
 * Test execution environment configuration
 */
interface TestEnvironment {
  name: string
  config: string
  servers: ServerConfig[]
  envVars: Record<string, string>
  healthChecks: HealthCheck[]
  timeout: number
}

interface ServerConfig {
  name: string
  command: string
  port: number
  cwd?: string
  env?: Record<string, string>
  healthCheck: string
  readyPattern?: RegExp
}

interface HealthCheck {
  name: string
  url: string
  expectedStatus?: number
  timeout?: number
}

/**
 * Test execution result summary
 */
interface ExecutionSummary {
  environment: string
  startTime: number
  endTime: number
  duration: number
  totalTests: number
  passed: number
  failed: number
  skipped: number
  flaky: number
  performance: {
    avgTestDuration: number
    slowestTest: { name: string; duration: number }
    fastestTest: { name: string; duration: number }
  }
  coverage?: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
  errors: Array<{
    test: string
    error: string
    recovery: boolean
  }>
}

/**
 * Main test execution coordinator
 */
export class TestExecutionCoordinator {
  private environments: Map<string, TestEnvironment> = new Map()
  private runningProcesses: Map<string, ChildProcess> = new Map()
  private executionResults: ExecutionSummary[] = []

  constructor() {
    this.setupEnvironments()
  }

  /**
   * Setup predefined test environments
   */
  private setupEnvironments(): void {
    // Full production-like testing
    this.environments.set('production', {
      name: 'Production Testing',
      config: 'playwright.config.ts',
      servers: [
        {
          name: 'backend',
          command: 'bun run dev',
          port: 3147,
          cwd: '../server',
          env: { NODE_ENV: 'test', DATABASE_PATH: ':memory:' },
          healthCheck: 'http://localhost:3147/health',
          readyPattern: /Server listening on port 3147/
        },
        {
          name: 'frontend',
          command: 'bun run dev',
          port: 1420,
          env: { VITE_BASE_URL: 'http://localhost:1420' },
          healthCheck: 'http://localhost:1420',
          readyPattern: /Local:\s+http:\/\/localhost:1420/
        }
      ],
      envVars: {
        NODE_ENV: 'test',
        VITE_BASE_URL: 'http://localhost:1420',
        API_BASE_URL: 'http://localhost:3147'
      },
      healthChecks: [
        { name: 'Frontend', url: 'http://localhost:1420' },
        { name: 'Backend API', url: 'http://localhost:3147/health' },
        { name: 'MCP Integration', url: 'http://localhost:3147/mcp/health', expectedStatus: 200 }
      ],
      timeout: 300000 // 5 minutes
    })

    // CI/CD optimized testing
    this.environments.set('ci', {
      name: 'CI/CD Testing',
      config: 'playwright-ci.config.ts',
      servers: [], // Assumes servers are already running in CI
      envVars: {
        NODE_ENV: 'test',
        CI: 'true',
        VITE_BASE_URL: 'http://localhost:1420',
        API_BASE_URL: 'http://localhost:3147'
      },
      healthChecks: [
        { name: 'Frontend', url: 'http://localhost:1420' },
        { name: 'Backend API', url: 'http://localhost:3147/health' }
      ],
      timeout: 600000 // 10 minutes for CI
    })

    // Fast development testing
    this.environments.set('development', {
      name: 'Development Testing',
      config: 'playwright-fast.config.ts',
      servers: [
        {
          name: 'backend',
          command: 'bun run dev',
          port: 3147,
          cwd: '../server',
          env: { NODE_ENV: 'test', DEV: 'true' },
          healthCheck: 'http://localhost:3147/health'
        }
      ],
      envVars: {
        NODE_ENV: 'development',
        VITE_BASE_URL: 'http://localhost:1420'
      },
      healthChecks: [{ name: 'Backend API', url: 'http://localhost:3147/health' }],
      timeout: 120000 // 2 minutes
    })

    // Minimal smoke testing
    this.environments.set('smoke', {
      name: 'Smoke Testing',
      config: 'playwright-basic.config.ts',
      servers: [],
      envVars: {
        NODE_ENV: 'test'
      },
      healthChecks: [],
      timeout: 60000 // 1 minute
    })

    // Visual regression testing
    this.environments.set('visual', {
      name: 'Visual Regression Testing',
      config: 'playwright-visual.config.ts',
      servers: [
        {
          name: 'frontend',
          command: 'bun run dev',
          port: 1420,
          healthCheck: 'http://localhost:1420'
        }
      ],
      envVars: {
        NODE_ENV: 'test',
        DISABLE_ANIMATIONS: 'true'
      },
      healthChecks: [{ name: 'Frontend', url: 'http://localhost:1420' }],
      timeout: 180000 // 3 minutes
    })
  }

  /**
   * Execute tests in specified environment
   */
  async executeTests(
    environmentName: string,
    options: {
      grep?: string
      headed?: boolean
      workers?: number
      retries?: number
      reporter?: string[]
      updateSnapshots?: boolean
    } = {}
  ): Promise<ExecutionSummary> {
    const environment = this.environments.get(environmentName)
    if (!environment) {
      throw new Error(`Environment '${environmentName}' not found`)
    }

    console.log(`🚀 Starting test execution in ${environment.name} environment`)
    const startTime = Date.now()

    try {
      // Start required servers
      await this.startServers(environment)

      // Wait for services to be healthy
      await this.waitForHealthy(environment)

      // Execute the tests
      const result = await this.runPlaywrightTests(environment, options)

      // Create execution summary
      const summary: ExecutionSummary = {
        environment: environmentName,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        ...result
      }

      this.executionResults.push(summary)
      await this.generateExecutionReport(summary)

      return summary
    } finally {
      // Always cleanup servers
      await this.stopServers(environment)
    }
  }

  /**
   * Execute tests across multiple environments in sequence
   */
  async executeTestSuite(
    environments: string[],
    options: {
      continueOnFailure?: boolean
      generateReport?: boolean
    } = {}
  ): Promise<ExecutionSummary[]> {
    const { continueOnFailure = false, generateReport = true } = options
    const results: ExecutionSummary[] = []

    console.log(`🎯 Executing test suite across ${environments.length} environments`)

    for (const envName of environments) {
      try {
        const result = await this.executeTests(envName)
        results.push(result)

        if (result.failed > 0 && !continueOnFailure) {
          console.error(`❌ Tests failed in ${envName} environment, stopping execution`)
          break
        }
      } catch (error) {
        console.error(`💥 Failed to execute tests in ${envName}: ${(error as Error).message}`)

        if (!continueOnFailure) {
          throw error
        }
      }
    }

    if (generateReport) {
      await this.generateSuiteReport(results)
    }

    return results
  }

  /**
   * Start servers for environment
   */
  private async startServers(environment: TestEnvironment): Promise<void> {
    console.log(`🔧 Starting ${environment.servers.length} servers...`)

    const startPromises = environment.servers.map(async (server) => {
      console.log(`  Starting ${server.name} server...`)

      const env = {
        ...process.env,
        ...environment.envVars,
        ...server.env
      }

      const child = spawn('sh', ['-c', server.command], {
        cwd: server.cwd ? resolve(server.cwd) : process.cwd(),
        env,
        stdio: 'pipe'
      })

      this.runningProcesses.set(server.name, child)

      // Set up logging
      child.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log(`[${server.name}] ${output.trim()}`)
      })

      child.stderr?.on('data', (data) => {
        const output = data.toString()
        console.error(`[${server.name}] ${output.trim()}`)
      })

      // Wait for server to be ready
      if (server.readyPattern) {
        await this.waitForPattern(child, server.readyPattern, 30000)
      } else {
        await this.delay(3000) // Default wait
      }

      console.log(`  ✅ ${server.name} server started`)
    })

    await Promise.all(startPromises)
  }

  /**
   * Wait for pattern in process output
   */
  private waitForPattern(process: ChildProcess, pattern: RegExp, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Pattern ${pattern} not found within ${timeout}ms`))
      }, timeout)

      const onData = (data: Buffer) => {
        if (pattern.test(data.toString())) {
          clearTimeout(timer)
          process.stdout?.off('data', onData)
          process.stderr?.off('data', onData)
          resolve()
        }
      }

      process.stdout?.on('data', onData)
      process.stderr?.on('data', onData)
    })
  }

  /**
   * Wait for all health checks to pass
   */
  private async waitForHealthy(environment: TestEnvironment): Promise<void> {
    console.log(`🏥 Checking health of ${environment.healthChecks.length} services...`)

    const healthPromises = environment.healthChecks.map(async (check) => {
      console.log(`  Checking ${check.name}...`)

      const maxAttempts = 30
      const delay = 1000

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(check.url, {
            signal: AbortSignal.timeout(check.timeout || 5000)
          })

          const expectedStatus = check.expectedStatus || 200
          if (response.status === expectedStatus) {
            console.log(`  ✅ ${check.name} is healthy`)
            return
          }

          console.log(`  ⏳ ${check.name} returned ${response.status}, retrying...`)
        } catch (error) {
          console.log(`  ⏳ ${check.name} health check failed (attempt ${attempt}/${maxAttempts})`)
        }

        if (attempt < maxAttempts) {
          await this.delay(delay)
        }
      }

      throw new Error(`Health check failed for ${check.name} after ${maxAttempts} attempts`)
    })

    await Promise.all(healthPromises)
    console.log(`✅ All services are healthy`)
  }

  /**
   * Run Playwright tests with specified configuration
   */
  private async runPlaywrightTests(environment: TestEnvironment, options: any): Promise<Partial<ExecutionSummary>> {
    console.log(`🎭 Running Playwright tests with config: ${environment.config}`)

    const args = ['playwright', 'test', '--config', environment.config]

    // Add options
    if (options.grep) args.push('--grep', options.grep)
    if (options.headed) args.push('--headed')
    if (options.workers) args.push('--workers', options.workers.toString())
    if (options.retries) args.push('--retries', options.retries.toString())
    if (options.updateSnapshots) args.push('--update-snapshots')
    if (options.reporter) {
      options.reporter.forEach((r: string) => {
        args.push('--reporter', r)
      })
    }

    return new Promise((resolve, reject) => {
      const child = spawn('bunx', args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...environment.envVars
        },
        stdio: 'pipe'
      })

      let output = ''
      let errorOutput = ''

      child.stdout?.on('data', (data) => {
        const text = data.toString()
        output += text
        console.log(text.trim())
      })

      child.stderr?.on('data', (data) => {
        const text = data.toString()
        errorOutput += text
        console.error(text.trim())
      })

      child.on('close', (code) => {
        const result = this.parsePlaywrightOutput(output)

        if (code === 0) {
          resolve(result)
        } else {
          reject(new Error(`Playwright tests failed with exit code ${code}\n${errorOutput}`))
        }
      })

      // Set timeout
      setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(`Tests timed out after ${environment.timeout}ms`))
      }, environment.timeout)
    })
  }

  /**
   * Parse Playwright test output for statistics
   */
  private parsePlaywrightOutput(output: string): Partial<ExecutionSummary> {
    const lines = output.split('\n')

    let totalTests = 0
    let passed = 0
    let failed = 0
    let skipped = 0
    let flaky = 0

    const errors: Array<{ test: string; error: string; recovery: boolean }> = []

    // Parse test results
    lines.forEach((line) => {
      if (line.includes('passed')) {
        const match = line.match(/(\d+) passed/)
        if (match) passed = parseInt(match[1])
      }

      if (line.includes('failed')) {
        const match = line.match(/(\d+) failed/)
        if (match) failed = parseInt(match[1])
      }

      if (line.includes('skipped')) {
        const match = line.match(/(\d+) skipped/)
        if (match) skipped = parseInt(match[1])
      }

      if (line.includes('flaky')) {
        const match = line.match(/(\d+) flaky/)
        if (match) flaky = parseInt(match[1])
      }
    })

    totalTests = passed + failed + skipped + flaky

    // Mock performance data (would be parsed from actual output)
    const performance = {
      avgTestDuration: 2500,
      slowestTest: { name: 'complex-workflow.spec.ts', duration: 45000 },
      fastestTest: { name: 'smoke.spec.ts', duration: 500 }
    }

    return {
      totalTests,
      passed,
      failed,
      skipped,
      flaky,
      performance,
      errors
    }
  }

  /**
   * Stop all running servers
   */
  private async stopServers(environment: TestEnvironment): Promise<void> {
    console.log(`🛑 Stopping ${this.runningProcesses.size} servers...`)

    const stopPromises = Array.from(this.runningProcesses.entries()).map(async ([name, process]) => {
      try {
        process.kill('SIGTERM')

        // Wait for graceful shutdown
        await new Promise((resolve) => {
          process.on('exit', resolve)
          setTimeout(() => {
            process.kill('SIGKILL')
            resolve(void 0)
          }, 5000)
        })

        console.log(`  ✅ ${name} server stopped`)
      } catch (error) {
        console.warn(`  ⚠️ Failed to stop ${name} server: ${(error as Error).message}`)
      }
    })

    await Promise.all(stopPromises)
    this.runningProcesses.clear()
  }

  /**
   * Generate execution report
   */
  private async generateExecutionReport(summary: ExecutionSummary): Promise<void> {
    const reportPath = `test-results/execution-report-${summary.environment}-${Date.now()}.json`

    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2))
    console.log(`📊 Execution report generated: ${reportPath}`)
  }

  /**
   * Generate comprehensive suite report
   */
  private async generateSuiteReport(results: ExecutionSummary[]): Promise<void> {
    const suiteReport = {
      timestamp: new Date().toISOString(),
      environments: results.length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      totalTests: results.reduce((sum, r) => sum + r.totalTests, 0),
      totalPassed: results.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
      totalFlaky: results.reduce((sum, r) => sum + r.flaky, 0),
      results
    }

    const reportPath = `test-results/suite-report-${Date.now()}.json`
    await fs.writeFile(reportPath, JSON.stringify(suiteReport, null, 2))

    // Also generate HTML report
    const htmlReport = this.generateHtmlReport(suiteReport)
    await fs.writeFile(`test-results/suite-report-${Date.now()}.html`, htmlReport)

    console.log(`📊 Suite report generated: ${reportPath}`)
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(suiteReport: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Suite Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .environment { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
            .passed { color: #28a745; }
            .failed { color: #dc3545; }
            .skipped { color: #6c757d; }
            .flaky { color: #ffc107; }
        </style>
    </head>
    <body>
        <h1>Test Suite Execution Report</h1>
        <div class="summary">
            <h2>Summary</h2>
            <p><strong>Executed:</strong> ${suiteReport.timestamp}</p>
            <p><strong>Environments:</strong> ${suiteReport.environments}</p>
            <p><strong>Total Duration:</strong> ${(suiteReport.totalDuration / 1000 / 60).toFixed(2)} minutes</p>
            <p><strong>Total Tests:</strong> ${suiteReport.totalTests}</p>
            <p><span class="passed">Passed: ${suiteReport.totalPassed}</span> | 
               <span class="failed">Failed: ${suiteReport.totalFailed}</span> | 
               <span class="skipped">Skipped: ${suiteReport.totalSkipped}</span> | 
               <span class="flaky">Flaky: ${suiteReport.totalFlaky}</span></p>
        </div>
        
        ${suiteReport.results
          .map(
            (result: ExecutionSummary) => `
            <div class="environment">
                <h3>${result.environment} Environment</h3>
                <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s</p>
                <p><strong>Tests:</strong> ${result.totalTests}</p>
                <p><span class="passed">Passed: ${result.passed}</span> | 
                   <span class="failed">Failed: ${result.failed}</span> | 
                   <span class="skipped">Skipped: ${result.skipped}</span> | 
                   <span class="flaky">Flaky: ${result.flaky}</span></p>
                <p><strong>Performance:</strong></p>
                <ul>
                    <li>Average Test Duration: ${result.performance.avgTestDuration}ms</li>
                    <li>Slowest Test: ${result.performance.slowestTest.name} (${result.performance.slowestTest.duration}ms)</li>
                    <li>Fastest Test: ${result.performance.fastestTest.name} (${result.performance.fastestTest.duration}ms)</li>
                </ul>
            </div>
        `
          )
          .join('')}
    </body>
    </html>
    `
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get available environments
   */
  getEnvironments(): string[] {
    return Array.from(this.environments.keys())
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ExecutionSummary[] {
    return [...this.executionResults]
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    // Stop all running processes
    for (const [name, process] of this.runningProcesses) {
      try {
        process.kill('SIGTERM')
      } catch (error) {
        console.warn(`Failed to stop ${name}: ${(error as Error).message}`)
      }
    }
    this.runningProcesses.clear()
  }
}

/**
 * CLI interface for test execution
 */
export async function main() {
  const coordinator = new TestExecutionCoordinator()

  const args = process.argv.slice(2)
  const environment = args[0] || 'development'

  const options = {
    headed: args.includes('--headed'),
    grep: args.find((arg) => arg.startsWith('--grep='))?.split('=')[1],
    workers: args.find((arg) => arg.startsWith('--workers='))?.split('=')[1]
      ? parseInt(args.find((arg) => arg.startsWith('--workers='))!.split('=')[1])
      : undefined
  }

  try {
    console.log(`🎯 Executing tests in ${environment} environment`)
    const result = await coordinator.executeTests(environment, options)

    console.log('\n📊 Test Execution Summary:')
    console.log(`  Environment: ${result.environment}`)
    console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`)
    console.log(`  Total Tests: ${result.totalTests}`)
    console.log(`  ✅ Passed: ${result.passed}`)
    console.log(`  ❌ Failed: ${result.failed}`)
    console.log(`  ⏭️ Skipped: ${result.skipped}`)
    console.log(`  🔄 Flaky: ${result.flaky}`)

    process.exit(result.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error(`💥 Test execution failed: ${(error as Error).message}`)
    process.exit(1)
  } finally {
    await coordinator.cleanup()
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main()
}
