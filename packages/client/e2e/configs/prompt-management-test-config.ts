/**
 * Test Configuration for Prompt Management E2E Tests
 *
 * This configuration file defines test execution strategies,
 * environment setup, and coordination for prompt management tests.
 */

export interface PromptTestConfig {
  // Test execution settings
  parallel: boolean
  timeout: number
  retries: number

  // Test data settings
  cleanupAfterEach: boolean
  isolateData: boolean
  useRealAPI: boolean

  // Performance settings
  maxPrompts: number
  importTimeout: number
  searchDebounce: number

  // Browser settings
  headless: boolean
  slowMo: number
  screenshot: 'off' | 'only-on-failure' | 'on'
  video: 'off' | 'on' | 'retain-on-failure'
}

/**
 * Default configuration for prompt management tests
 */
export const DEFAULT_PROMPT_TEST_CONFIG: PromptTestConfig = {
  // Test execution
  parallel: true,
  timeout: 30000, // 30 seconds per test
  retries: 2,

  // Test data
  cleanupAfterEach: true,
  isolateData: true,
  useRealAPI: false, // Use mocked API by default

  // Performance
  maxPrompts: 1000,
  importTimeout: 60000, // 1 minute for large imports
  searchDebounce: 300,

  // Browser
  headless: true,
  slowMo: 0,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}

/**
 * Configuration for different test environments
 */
export const TEST_ENVIRONMENTS = {
  development: {
    ...DEFAULT_PROMPT_TEST_CONFIG,
    headless: false,
    slowMo: 100,
    screenshot: 'on',
    video: 'on',
    useRealAPI: true,
    parallel: false,
    retries: 0
  },

  ci: {
    ...DEFAULT_PROMPT_TEST_CONFIG,
    headless: true,
    timeout: 60000, // Longer timeout for CI
    retries: 3,
    parallel: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  performance: {
    ...DEFAULT_PROMPT_TEST_CONFIG,
    timeout: 120000, // 2 minutes for performance tests
    maxPrompts: 5000,
    importTimeout: 300000, // 5 minutes for large imports
    parallel: false, // Run performance tests sequentially
    retries: 1
  },

  smoke: {
    ...DEFAULT_PROMPT_TEST_CONFIG,
    timeout: 15000, // Quick smoke tests
    maxPrompts: 10,
    parallel: true,
    retries: 1,
    cleanupAfterEach: false // Skip cleanup for speed
  }
}

/**
 * Test execution strategies for different scenarios
 */
export const TEST_STRATEGIES = {
  // Standard test run - comprehensive coverage
  comprehensive: {
    includes: [
      '**/prompt-management-comprehensive.spec.ts',
      '**/prompt-management-advanced.spec.ts',
      '**/prompts.spec.ts'
    ],
    config: DEFAULT_PROMPT_TEST_CONFIG
  },

  // Import-focused testing
  import_only: {
    includes: ['**/prompt-management-comprehensive.spec.ts'],
    grep: /@import|Import Functionality/,
    config: {
      ...DEFAULT_PROMPT_TEST_CONFIG,
      importTimeout: 120000
    }
  },

  // Performance-focused testing
  performance_only: {
    includes: ['**/prompt-management-comprehensive.spec.ts', '**/prompt-management-advanced.spec.ts'],
    grep: /@performance|Performance|memory|large/,
    config: TEST_ENVIRONMENTS.performance
  },

  // Accessibility testing
  accessibility_only: {
    includes: ['**/prompt-management-advanced.spec.ts'],
    grep: /@accessibility|Accessibility|keyboard|aria/,
    config: {
      ...DEFAULT_PROMPT_TEST_CONFIG,
      slowMo: 200, // Slower for accessibility testing
      headless: false
    }
  },

  // Quick smoke test
  smoke_test: {
    includes: ['**/prompt-management-comprehensive.spec.ts'],
    grep: /@smoke|should display prompt cards|should create new prompt|should import single/,
    config: TEST_ENVIRONMENTS.smoke
  },

  // Error handling tests
  error_handling: {
    includes: ['**/prompt-management-comprehensive.spec.ts', '**/prompt-management-advanced.spec.ts'],
    grep: /@error|Error Handling|should handle.*error|should validate/,
    config: {
      ...DEFAULT_PROMPT_TEST_CONFIG,
      timeout: 45000,
      retries: 1
    }
  }
}

/**
 * Test data configurations for different scenarios
 */
export const TEST_DATA_CONFIGS = {
  minimal: {
    promptCount: 4,
    importFiles: 2,
    searchQueries: 3,
    bulkOperations: false
  },

  standard: {
    promptCount: 10,
    importFiles: 5,
    searchQueries: 8,
    bulkOperations: true
  },

  large: {
    promptCount: 100,
    importFiles: 20,
    searchQueries: 15,
    bulkOperations: true
  },

  performance: {
    promptCount: 1000,
    importFiles: 50,
    searchQueries: 25,
    bulkOperations: true
  }
}

/**
 * Browser configurations for cross-browser testing
 */
export const BROWSER_CONFIGS = {
  chromium: {
    name: 'chromium',
    use: {
      ...DEFAULT_PROMPT_TEST_CONFIG,
      channel: 'chrome'
    }
  },

  firefox: {
    name: 'firefox',
    use: {
      ...DEFAULT_PROMPT_TEST_CONFIG
    }
  },

  webkit: {
    name: 'webkit',
    use: {
      ...DEFAULT_PROMPT_TEST_CONFIG
    }
  },

  mobile_chrome: {
    name: 'Mobile Chrome',
    use: {
      ...DEFAULT_PROMPT_TEST_CONFIG,
      ...devices['Pixel 5']
    }
  },

  mobile_safari: {
    name: 'Mobile Safari',
    use: {
      ...DEFAULT_PROMPT_TEST_CONFIG,
      ...devices['iPhone 12']
    }
  }
}

/**
 * Utility functions for test configuration
 */
export class PromptTestConfigManager {
  /**
   * Get configuration for specific environment
   */
  static getEnvironmentConfig(env: keyof typeof TEST_ENVIRONMENTS): PromptTestConfig {
    return TEST_ENVIRONMENTS[env] || DEFAULT_PROMPT_TEST_CONFIG
  }

  /**
   * Get test strategy configuration
   */
  static getStrategyConfig(strategy: keyof typeof TEST_STRATEGIES) {
    return TEST_STRATEGIES[strategy]
  }

  /**
   * Merge custom config with defaults
   */
  static mergeConfig(customConfig: Partial<PromptTestConfig>): PromptTestConfig {
    return { ...DEFAULT_PROMPT_TEST_CONFIG, ...customConfig }
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: PromptTestConfig): boolean {
    const errors: string[] = []

    if (config.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms')
    }

    if (config.maxPrompts < 1) {
      errors.push('maxPrompts must be positive')
    }

    if (config.retries < 0) {
      errors.push('retries must be non-negative')
    }

    if (errors.length > 0) {
      console.error('Configuration validation errors:', errors)
      return false
    }

    return true
  }

  /**
   * Get recommended configuration based on test scope
   */
  static getRecommendedConfig(testScope: {
    testCount: number
    hasPerformanceTests: boolean
    hasImportTests: boolean
    isCI: boolean
  }): PromptTestConfig {
    let baseConfig = DEFAULT_PROMPT_TEST_CONFIG

    // Adjust for CI environment
    if (testScope.isCI) {
      baseConfig = TEST_ENVIRONMENTS.ci
    }

    // Adjust for performance tests
    if (testScope.hasPerformanceTests) {
      baseConfig = {
        ...baseConfig,
        timeout: Math.max(baseConfig.timeout, 120000),
        parallel: false
      }
    }

    // Adjust for import tests
    if (testScope.hasImportTests) {
      baseConfig = {
        ...baseConfig,
        importTimeout: Math.max(baseConfig.importTimeout, 120000)
      }
    }

    // Adjust for large test suites
    if (testScope.testCount > 50) {
      baseConfig = {
        ...baseConfig,
        parallel: true,
        retries: Math.min(baseConfig.retries, 1) // Reduce retries for large suites
      }
    }

    return baseConfig
  }
}

// Device imports for mobile testing
import { devices } from '@playwright/test'

/**
 * Export configurations for use in playwright.config.ts
 */
export {
  DEFAULT_PROMPT_TEST_CONFIG as defaultConfig,
  TEST_ENVIRONMENTS as environments,
  TEST_STRATEGIES as strategies,
  BROWSER_CONFIGS as browsers
}
