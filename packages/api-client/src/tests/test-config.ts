// Legacy test configuration (for backward compatibility)
export const TEST_API_URL = 'http://localhost:3147'

// Test database configuration
export const TEST_DB_PATH = process.env.TEST_DB_PATH || '/tmp/promptliano-test.db'

// Test encryption key
export const TEST_ENCRYPTION_KEY =
  process.env.PROMPTLIANO_ENCRYPTION_KEY || 'test-key-for-automated-tests-only-not-secure'

// Test server configuration
export const TEST_SERVER_CONFIG = {
  baseUrl: TEST_API_URL,
  timeout: 30000,
  retries: 3
}

// Enhanced test configuration
export interface EnhancedTestConfig {
  /** Server configuration */
  server: {
    /** Whether to use isolated test server (recommended) */
    useIsolated: boolean
    /** External server URL (when not using isolated) */
    externalUrl: string
    /** Port configuration for isolated server */
    port: {
      /** Use dynamic port assignment (0 = OS assigns) */
      dynamic: boolean
      /** Fixed port (when not using dynamic) */
      fixed: number
    }
  }
  /** Database configuration */
  database: {
    /** Use in-memory database for faster tests */
    useMemory: boolean
    /** Database file path */
    path: string
    /** Reset database between test suites */
    resetBetweenSuites: boolean
  }
  /** AI service configuration */
  ai: {
    /** LMStudio configuration */
    lmstudio: {
      /** Enable LMStudio tests */
      enabled: boolean
      /** LMStudio server URL */
      baseUrl: string
      /** Target model name */
      model: string
      /** Request timeout for AI operations */
      timeout: number
      /** Skip tests if server unavailable */
      skipWhenUnavailable: boolean
    }
    /** Mock configuration */
    mocks: {
      /** Use mocks when AI services unavailable */
      enabled: boolean
      /** Mock response delay (ms) */
      delay: number
    }
  }
  /** Test execution settings */
  execution: {
    /** API request timeout */
    apiTimeout: number
    /** Enable rate limiting during tests */
    enableRateLimit: boolean
    /** Parallel test execution */
    parallel: boolean
    /** Log level during tests */
    logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug'
    /** Retry configuration */
    retries: {
      /** Max retry attempts */
      max: number
      /** Retry delay (ms) */
      delay: number
      /** Exponential backoff */
      backoff: boolean
    }
  }
  /** Environment detection */
  environment: {
    /** Force CI mode */
    forceCI: boolean
    /** Force local mode */
    forceLocal: boolean
    /** Enable debug mode */
    debug: boolean
  }
  /** CI-specific configuration */
  ci: {
    /** Detected CI provider */
    provider: string | null
    /** Health check timeout for CI */
    healthCheckTimeout: number
    /** Database initialization timeout for CI */
    dbInitTimeout: number
    /** Enable resource monitoring */
    enableResourceMonitoring: boolean
    /** Maximum memory usage threshold */
    maxMemoryUsage: number
  }
}

/**
 * Detects CI environment with enhanced detection logic
 */
export function detectCIEnvironment(): { isCI: boolean; ciProvider: string | null; isLocal: boolean } {
  // Enhanced CI detection for various providers
  const ciProviders = {
    'GitHub Actions': process.env.GITHUB_ACTIONS,
    'GitLab CI': process.env.GITLAB_CI,
    CircleCI: process.env.CIRCLECI,
    Buildkite: process.env.BUILDKITE,
    Jenkins: process.env.JENKINS_URL,
    'Azure DevOps': process.env.TF_BUILD,
    TeamCity: process.env.TEAMCITY_VERSION,
    'Travis CI': process.env.TRAVIS,
    AppVeyor: process.env.APPVEYOR,
    CodeBuild: process.env.CODEBUILD_BUILD_ID,
    Drone: process.env.DRONE,
    'Generic CI': process.env.CI
  }

  const detectedProvider = Object.entries(ciProviders).find(([_, value]) => value)?.[0] || null

  const isCI = detectedProvider !== null || process.env.FORCE_CI_MODE === 'true'
  const isLocal = !isCI && !process.env.FORCE_CI_MODE

  return { isCI, ciProvider: detectedProvider, isLocal }
}

/**
 * Gets enhanced test configuration based on environment
 */
export function getEnhancedTestConfig(): EnhancedTestConfig {
  const { isCI, ciProvider, isLocal } = detectCIEnvironment()
  const enableLMStudio = isLocal && process.env.SKIP_AI_TESTS !== 'true'

  // CI-specific optimizations
  const ciOptimizations = {
    // More aggressive timeouts in CI
    apiTimeout: isCI ? 10000 : 30000,
    healthCheckTimeout: isCI ? 3000 : 5000,
    dbInitTimeout: isCI ? 3000 : 5000,
    // Disable parallel execution in CI for stability
    parallel: !isCI && process.env.TEST_PARALLEL !== 'false',
    // Use memory database in CI for speed
    useMemoryDB: isCI || process.env.TEST_USE_MEMORY_DB === 'true',
    // Disable resource monitoring in CI unless explicitly enabled
    enableResourceMonitoring: isLocal && process.env.TEST_ENABLE_MONITORING === 'true'
  }

  return {
    server: {
      useIsolated: process.env.TEST_USE_EXTERNAL_SERVER !== 'true',
      externalUrl: process.env.TEST_API_URL || TEST_API_URL,
      port: {
        dynamic: process.env.TEST_FIXED_PORT !== 'true',
        fixed: parseInt(process.env.TEST_PORT || '3147', 10)
      }
    },
    database: {
      useMemory: ciOptimizations.useMemoryDB,
      path: process.env.TEST_DB_PATH || (ciOptimizations.useMemoryDB ? ':memory:' : '/tmp/promptliano-test.db'),
      resetBetweenSuites: process.env.TEST_KEEP_DB !== 'true'
    },
    ai: {
      lmstudio: {
        enabled: enableLMStudio,
        baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://192.168.1.38:1234',
        model: process.env.LMSTUDIO_MODEL || 'openai/gpt-oss-20b',
        timeout: parseInt(process.env.AI_TEST_TIMEOUT || (isCI ? '15000' : '30000'), 10),
        skipWhenUnavailable: process.env.AI_FAIL_WHEN_UNAVAILABLE !== 'true'
      },
      mocks: {
        enabled: process.env.AI_USE_MOCKS !== 'false',
        delay: parseInt(process.env.AI_MOCK_DELAY || (isCI ? '50' : '100'), 10)
      }
    },
    execution: {
      apiTimeout: parseInt(process.env.TEST_API_TIMEOUT || ciOptimizations.apiTimeout.toString(), 10),
      enableRateLimit: process.env.TEST_ENABLE_RATE_LIMIT === 'true',
      parallel: ciOptimizations.parallel,
      logLevel: (process.env.TEST_LOG_LEVEL as any) || (isCI ? 'error' : 'warn'),
      retries: {
        max: parseInt(process.env.TEST_RETRIES || (isCI ? '2' : '3'), 10),
        delay: parseInt(process.env.TEST_RETRY_DELAY || (isCI ? '500' : '1000'), 10),
        backoff: process.env.TEST_RETRY_BACKOFF !== 'false'
      }
    },
    environment: {
      forceCI: process.env.FORCE_CI_MODE === 'true',
      forceLocal: process.env.FORCE_LOCAL_MODE === 'true',
      debug: process.env.TEST_DEBUG === 'true'
    },
    // CI-specific configuration
    ci: {
      provider: ciProvider,
      healthCheckTimeout: ciOptimizations.healthCheckTimeout,
      dbInitTimeout: ciOptimizations.dbInitTimeout,
      enableResourceMonitoring: ciOptimizations.enableResourceMonitoring,
      maxMemoryUsage: parseInt(process.env.TEST_MAX_MEMORY_MB || '256', 10) * 1024 * 1024
    }
  }
}

/**
 * Environment variable documentation for test configuration
 */
export const TEST_ENV_VARS = {
  // Server configuration
  TEST_USE_EXTERNAL_SERVER: 'Set to "true" to use external server instead of isolated test server',
  TEST_API_URL: 'External server URL (default: http://localhost:3147)',
  TEST_FIXED_PORT: 'Set to "true" to use fixed port instead of dynamic assignment',
  TEST_PORT: 'Fixed port number for test server (default: 3147)',

  // Database configuration
  TEST_USE_MEMORY_DB: 'Set to "true" to force in-memory database',
  TEST_DB_PATH: 'Custom database file path',
  TEST_KEEP_DB: 'Set to "true" to preserve database between test suites',

  // AI configuration
  SKIP_AI_TESTS: 'Set to "true" to skip all AI endpoint tests',
  LMSTUDIO_BASE_URL: 'LMStudio server URL (default: http://192.168.1.38:1234)',
  LMSTUDIO_MODEL: 'Target model name (default: openai/gpt-oss-20b)',
  AI_TEST_TIMEOUT: 'Timeout for AI operations in ms (default: 30000)',
  AI_FAIL_WHEN_UNAVAILABLE: 'Set to "true" to fail tests when AI services unavailable',
  AI_USE_MOCKS: 'Set to "false" to disable mock responses',
  AI_MOCK_DELAY: 'Mock response delay in ms (default: 100)',

  // Execution configuration
  TEST_API_TIMEOUT: 'API request timeout in ms (default: 30000 local, 15000 CI)',
  TEST_ENABLE_RATE_LIMIT: 'Set to "true" to enable rate limiting during tests',
  TEST_PARALLEL: 'Set to "false" to disable parallel test execution',
  TEST_LOG_LEVEL: 'Log level: silent, error, warn, info, debug (default: warn)',
  TEST_RETRIES: 'Max retry attempts (default: 3)',
  TEST_RETRY_DELAY: 'Retry delay in ms (default: 1000)',
  TEST_RETRY_BACKOFF: 'Set to "false" to disable exponential backoff',

  // Environment control
  FORCE_CI_MODE: 'Set to "true" to force CI configuration',
  FORCE_LOCAL_MODE: 'Set to "true" to force local configuration',
  TEST_DEBUG: 'Set to "true" to enable debug output',

  // Legacy
  PROMPTLIANO_ENCRYPTION_KEY: 'Encryption key for provider keys (auto-generated if not set)',

  // CI-specific variables
  TEST_MAX_MEMORY_MB: 'Maximum memory usage in MB (default: 256)',
  TEST_HEALTH_CHECK_TIMEOUT: 'Health check timeout in ms (default: 5000 local, 3000 CI)',
  TEST_DB_INIT_TIMEOUT: 'Database initialization timeout in ms (default: 5000 local, 3000 CI)',
  TEST_ENABLE_MONITORING: 'Set to "true" to enable resource monitoring in local dev'
} as const

/**
 * Prints current test configuration with enhanced CI information
 */
export function printTestConfig(config?: EnhancedTestConfig): void {
  const testConfig = config || getEnhancedTestConfig()

  console.log('🧪 Test Configuration:')
  console.log('  Environment:')
  console.log(`    CI Provider: ${testConfig.ci.provider || 'Local Development'}`)
  console.log(`    Debug Mode: ${testConfig.environment.debug}`)
  console.log('  Server:')
  console.log(`    Isolated: ${testConfig.server.useIsolated}`)
  console.log(`    Port: ${testConfig.server.port.dynamic ? 'Dynamic' : testConfig.server.port.fixed}`)
  console.log(`    Health Check Timeout: ${testConfig.ci.healthCheckTimeout}ms`)
  console.log('  Database:')
  console.log(`    Type: ${testConfig.database.useMemory ? 'Memory' : 'File'}`)
  console.log(`    Path: ${testConfig.database.path}`)
  console.log(`    Init Timeout: ${testConfig.ci.dbInitTimeout}ms`)
  console.log('  AI Services:')
  console.log(`    LMStudio: ${testConfig.ai.lmstudio.enabled ? 'Enabled' : 'Disabled'}`)
  if (testConfig.ai.lmstudio.enabled) {
    console.log(`      URL: ${testConfig.ai.lmstudio.baseUrl}`)
    console.log(`      Model: ${testConfig.ai.lmstudio.model}`)
    console.log(`      Timeout: ${testConfig.ai.lmstudio.timeout}ms`)
  }
  console.log(`    Mocks: ${testConfig.ai.mocks.enabled ? 'Enabled' : 'Disabled'}`)
  console.log('  Execution:')
  console.log(`    Timeout: ${testConfig.execution.apiTimeout}ms`)
  console.log(`    Rate Limit: ${testConfig.execution.enableRateLimit}`)
  console.log(`    Parallel: ${testConfig.execution.parallel}`)
  console.log(`    Log Level: ${testConfig.execution.logLevel}`)
  console.log(`    Max Retries: ${testConfig.execution.retries.max}`)
  console.log('  Resource Monitoring:')
  console.log(`    Enabled: ${testConfig.ci.enableResourceMonitoring}`)
  console.log(`    Max Memory: ${Math.round(testConfig.ci.maxMemoryUsage / 1024 / 1024)}MB`)
}
