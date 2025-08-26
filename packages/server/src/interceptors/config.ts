import { z } from 'zod'
import {
  InterceptorConfigSchema,
  InterceptorChainConfigSchema,
  AuthInterceptorConfigSchema,
  LoggingInterceptorConfigSchema,
  RateLimitInterceptorConfigSchema,
  CacheInterceptorConfigSchema
} from './types'

/**
 * Global interceptor system configuration
 */
export const GlobalInterceptorConfigSchema = z.object({
  /** Whether the interceptor system is enabled */
  enabled: z.boolean().default(true),

  /** Global chain configuration */
  chain: InterceptorChainConfigSchema.optional(),

  /** Global configuration for built-in interceptors */
  interceptors: z
    .object({
      /** Authentication interceptor config */
      auth: AuthInterceptorConfigSchema.optional(),

      /** Logging interceptor config */
      logging: LoggingInterceptorConfigSchema.optional(),

      /** Rate limiting interceptor config */
      rateLimit: RateLimitInterceptorConfigSchema.optional(),

      /** Caching interceptor config */
      cache: CacheInterceptorConfigSchema.optional()
    })
    .optional(),

  /** Route-specific interceptor configurations */
  routes: z
    .record(
      z.string(), // Route pattern
      z.object({
        /** Override enabled state for specific interceptors */
        enabled: z.record(z.string(), z.boolean()).optional(),

        /** Route-specific interceptor configurations */
        config: z.record(z.string(), z.any()).optional(),

        /** Additional interceptors to apply only to this route */
        additional: z.array(InterceptorConfigSchema).optional()
      })
    )
    .optional(),

  /** Environment-specific overrides */
  environments: z
    .record(
      z.string(), // Environment name (development, production, etc.)
      z.object({
        /** Override global enabled state */
        enabled: z.boolean().optional(),

        /** Override chain configuration */
        chain: InterceptorChainConfigSchema.partial().optional(),

        /** Override interceptor configurations */
        interceptors: z.record(z.string(), z.any()).optional()
      })
    )
    .optional(),

  /** Performance and monitoring settings */
  monitoring: z
    .object({
      /** Enable performance metrics collection */
      enableMetrics: z.boolean().default(true),

      /** Enable detailed logging */
      enableLogging: z.boolean().default(false),

      /** Metrics collection interval in milliseconds */
      metricsInterval: z.number().int().positive().default(60000),

      /** Maximum number of metrics to keep in memory */
      maxMetricsHistory: z.number().int().positive().default(1000),

      /** Whether to log slow interceptors */
      logSlowInterceptors: z.boolean().default(true),

      /** Threshold for slow interceptor logging in milliseconds */
      slowInterceptorThreshold: z.number().int().positive().default(100)
    })
    .optional()
})

export type GlobalInterceptorConfig = z.infer<typeof GlobalInterceptorConfigSchema>

/**
 * Individual interceptor configuration with metadata
 */
export const InterceptorDefinitionSchema = z.object({
  /** Interceptor configuration */
  config: InterceptorConfigSchema,

  /** Source of this interceptor (built-in, plugin, custom) */
  source: z.enum(['built-in', 'plugin', 'custom']).default('custom'),

  /** Version of the interceptor */
  version: z.string().optional(),

  /** Description of what this interceptor does */
  description: z.string().optional(),

  /** Author/maintainer information */
  author: z.string().optional(),

  /** Whether this interceptor requires specific dependencies */
  requiredDependencies: z.array(z.string()).optional(),

  /** Performance characteristics */
  performance: z
    .object({
      /** Expected average execution time in milliseconds */
      averageExecutionTime: z.number().optional(),

      /** Maximum execution time in milliseconds */
      maxExecutionTime: z.number().optional(),

      /** Memory usage characteristics */
      memoryUsage: z.enum(['low', 'medium', 'high']).optional(),

      /** CPU usage characteristics */
      cpuUsage: z.enum(['low', 'medium', 'high']).optional()
    })
    .optional()
})

export type InterceptorDefinition = z.infer<typeof InterceptorDefinitionSchema>

/**
 * Configuration loader with environment support
 */
export class InterceptorConfigLoader {
  private config: GlobalInterceptorConfig
  private environment: string

  constructor(config?: Partial<GlobalInterceptorConfig>, environment = 'development') {
    this.environment = environment
    this.config = GlobalInterceptorConfigSchema.parse(config || {})
    this.applyEnvironmentOverrides()
  }

  /**
   * Get the complete configuration
   */
  getConfig(): GlobalInterceptorConfig {
    return this.config
  }

  /**
   * Get chain configuration
   */
  getChainConfig(): z.infer<typeof InterceptorChainConfigSchema> {
    return this.config.chain || InterceptorChainConfigSchema.parse({})
  }

  /**
   * Get configuration for a specific interceptor
   */
  getInterceptorConfig<T = any>(interceptorName: string): T | undefined {
    return this.config.interceptors?.[interceptorName as keyof typeof this.config.interceptors] as T
  }

  /**
   * Get route-specific configuration
   */
  getRouteConfig(route: string): {
    enabled: Record<string, boolean>
    config: Record<string, any>
    additional: z.infer<typeof InterceptorConfigSchema>[]
  } {
    const routeConfig = this.config.routes?.[route]
    return {
      enabled: routeConfig?.enabled || {},
      config: routeConfig?.config || {},
      additional: routeConfig?.additional || []
    }
  }

  /**
   * Check if an interceptor is enabled for a specific route
   */
  isInterceptorEnabled(interceptorName: string, route?: string): boolean {
    if (!this.config.enabled) {
      return false
    }

    if (route) {
      // Check each route pattern to see if it matches
      const routePatterns = Object.keys(this.config.routes || {})
      for (const pattern of routePatterns) {
        if (this.matchesRoutePattern(route, pattern)) {
          const routeConfig = this.getRouteConfig(pattern)
          if (interceptorName in routeConfig.enabled) {
            return routeConfig.enabled[interceptorName]
          }
        }
      }
    }

    return true // Default to enabled
  }

  /**
   * Check if a route matches a pattern (supports wildcards)
   */
  private matchesRoutePattern(route: string, pattern: string): boolean {
    // Convert pattern to regex
    // Replace * with .* for wildcard matching
    const regexPattern = pattern.replace(/\*/g, '.*')
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(route)
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): NonNullable<GlobalInterceptorConfig['monitoring']> {
    return (
      this.config.monitoring || {
        enableMetrics: true,
        enableLogging: false,
        metricsInterval: 60000,
        maxMetricsHistory: 1000,
        logSlowInterceptors: true,
        slowInterceptorThreshold: 100
      }
    )
  }

  /**
   * Apply environment-specific overrides
   */
  private applyEnvironmentOverrides(): void {
    const envConfig = this.config.environments?.[this.environment]
    if (!envConfig) return

    if (envConfig.enabled !== undefined) {
      this.config.enabled = envConfig.enabled
    }

    if (envConfig.chain) {
      this.config.chain = {
        continueOnError: false,
        timeoutMs: 30000,
        enableMetrics: true,
        enableLogging: false,
        ...this.config.chain,
        ...envConfig.chain
      }
    }

    if (envConfig.interceptors) {
      this.config.interceptors = {
        ...this.config.interceptors,
        ...envConfig.interceptors
      }
    }
  }

  /**
   * Validate configuration against schema
   */
  validate(): { valid: boolean; errors?: string[] } {
    try {
      GlobalInterceptorConfigSchema.parse(this.config)
      return { valid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        }
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      }
    }
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<GlobalInterceptorConfig>): void {
    this.config = GlobalInterceptorConfigSchema.parse({
      ...this.config,
      ...updates
    })
    this.applyEnvironmentOverrides()
  }

  /**
   * Export configuration for debugging
   */
  export(): GlobalInterceptorConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * Get configuration for a specific route and interceptor
   */
  getRouteInterceptorConfig<T = any>(route: string, interceptorName: string): T | undefined {
    const routePatterns = Object.keys(this.config.routes || {})
    for (const pattern of routePatterns) {
      if (this.matchesRoutePattern(route, pattern)) {
        const routeConfig = this.getRouteConfig(pattern)
        return routeConfig.config[interceptorName] as T
      }
    }
    return undefined
  }

  /**
   * Get all matching route patterns for a given route
   */
  getMatchingRoutePatterns(route: string): string[] {
    const routePatterns = Object.keys(this.config.routes || {})
    return routePatterns.filter((pattern) => this.matchesRoutePattern(route, pattern))
  }

  /**
   * Merge configurations with priority order
   */
  mergeConfigurations<T>(globalConfig: T | undefined, routeConfig: T | undefined, defaults: T): T {
    return {
      ...defaults,
      ...globalConfig,
      ...routeConfig
    }
  }
}

/**
 * Default configuration for different environments
 */
export const DEFAULT_DEVELOPMENT_CONFIG: GlobalInterceptorConfig = {
  enabled: true,
  chain: {
    continueOnError: false,
    timeoutMs: 30000,
    enableMetrics: true,
    enableLogging: true
  },
  interceptors: {
    auth: {
      requireAuth: false,
      publicRoutes: ['*'] // All routes public in development
    },
    logging: {
      level: 'debug',
      logRequestBody: true,
      logResponseBody: true,
      maxBodySize: 1024 * 1024
    },
    rateLimit: {
      maxRequests: 1000,
      windowMs: 60000 // 1 minute
    },
    cache: {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      methods: ['GET']
    }
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    metricsInterval: 30000,
    maxMetricsHistory: 500,
    logSlowInterceptors: true,
    slowInterceptorThreshold: 50
  }
}

export const DEFAULT_PRODUCTION_CONFIG: GlobalInterceptorConfig = {
  enabled: true,
  chain: {
    continueOnError: true,
    timeoutMs: 10000,
    enableMetrics: true,
    enableLogging: false
  },
  interceptors: {
    auth: {
      requireAuth: true,
      publicRoutes: ['/api/health', '/api/docs', '/swagger']
    },
    logging: {
      level: 'info',
      logRequestBody: false,
      logResponseBody: false,
      maxBodySize: 1024
    },
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    },
    cache: {
      defaultTtl: 15 * 60 * 1000, // 15 minutes
      methods: ['GET', 'HEAD']
    }
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: false,
    metricsInterval: 60000,
    maxMetricsHistory: 1000,
    logSlowInterceptors: true,
    slowInterceptorThreshold: 100
  }
}

/**
 * Configuration factory for different environments
 */
export function createInterceptorConfig(
  environment: string,
  overrides?: Partial<GlobalInterceptorConfig>
): InterceptorConfigLoader {
  let baseConfig: GlobalInterceptorConfig

  switch (environment) {
    case 'production':
      baseConfig = DEFAULT_PRODUCTION_CONFIG
      break
    case 'development':
    default:
      baseConfig = DEFAULT_DEVELOPMENT_CONFIG
      break
  }

  const config = overrides ? { ...baseConfig, ...overrides } : baseConfig
  return new InterceptorConfigLoader(config, environment)
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): InterceptorConfigLoader {
  const environment = process.env.NODE_ENV || 'development'

  const envConfig: Partial<GlobalInterceptorConfig> = {}

  // Only apply env overrides if explicitly set
  if (process.env.INTERCEPTORS_ENABLED !== undefined) {
    envConfig.enabled = process.env.INTERCEPTORS_ENABLED !== 'false'
  }

  if (
    process.env.INTERCEPTORS_LOG_ENABLED !== undefined ||
    process.env.INTERCEPTORS_METRICS_ENABLED !== undefined ||
    process.env.INTERCEPTORS_TIMEOUT_MS !== undefined
  ) {
    envConfig.chain = {
      continueOnError: false,
      enableLogging: process.env.INTERCEPTORS_LOG_ENABLED === 'true',
      enableMetrics: process.env.INTERCEPTORS_METRICS_ENABLED !== 'false',
      timeoutMs: process.env.INTERCEPTORS_TIMEOUT_MS ? parseInt(process.env.INTERCEPTORS_TIMEOUT_MS, 10) : 30000
    }
  }

  return createInterceptorConfig(environment, envConfig)
}

/**
 * Validate interceptor definition against schema
 */
export function validateInterceptorDefinition(definition: unknown): {
  valid: boolean
  data?: InterceptorDefinition
  errors?: string[]
} {
  try {
    const data = InterceptorDefinitionSchema.parse(definition)
    return { valid: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      }
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error']
    }
  }
}
