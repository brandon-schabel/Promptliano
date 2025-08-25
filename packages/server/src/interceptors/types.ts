import type { Context } from 'hono'
import { z } from 'zod'

/**
 * Core interceptor context that flows through the interceptor chain
 * Provides shared state and metadata between interceptors
 */
export interface InterceptorContext {
  /** Unique identifier for this request */
  requestId: string
  /** Request start timestamp */
  startTime: number
  /** Authenticated user information (if available) */
  user?: any
  /** Shared metadata between interceptors */
  metadata: Record<string, any>
  /** Performance metrics for this request */
  metrics: {
    /** Individual interceptor execution times */
    interceptorTimings: Record<string, number>
    /** Total request processing time */
    totalTime?: number
  }
  /** Cache keys for this request */
  cacheKeys: string[]
  /** Security context */
  security: {
    /** IP address of the requester */
    ip: string
    /** User agent string */
    userAgent?: string
    /** Rate limit keys used */
    rateLimitKeys: string[]
  }
}

/**
 * Interceptor execution phases
 */
export type InterceptorPhase = 'request' | 'response' | 'error'

/**
 * Interceptor handler function signature
 */
export type InterceptorHandler = (
  context: Context,
  interceptorContext: InterceptorContext,
  next: () => Promise<void>
) => Promise<void>

/**
 * Interceptor error handler function signature
 */
export type InterceptorErrorHandler = (
  error: Error,
  context: Context,
  interceptorContext: InterceptorContext
) => Promise<void> | void

/**
 * Core interceptor interface
 */
export interface Interceptor {
  /** Unique name identifier for the interceptor */
  name: string
  /** Execution order (lower numbers run first) */
  order: number
  /** Which phase this interceptor runs in */
  phase: InterceptorPhase
  /** Whether this interceptor is currently enabled */
  enabled: boolean
  /** Main handler function */
  handler: InterceptorHandler
  /** Optional error handler */
  errorHandler?: InterceptorErrorHandler
  /** Dependencies - other interceptors that must run before this one */
  dependencies?: string[]
  /** Routes this interceptor applies to (glob patterns) */
  routes?: string[]
  /** HTTP methods this interceptor applies to */
  methods?: string[]
  /** Tags for categorizing interceptors */
  tags?: string[]
  /** Configuration for this interceptor */
  config?: Record<string, any>
}

/**
 * Interceptor chain execution result
 */
export interface InterceptorChainResult {
  /** Whether the chain executed successfully */
  success: boolean
  /** Any error that occurred during execution */
  error?: Error
  /** Performance metrics for the chain */
  metrics: {
    /** Total execution time */
    totalTime: number
    /** Individual interceptor timings */
    interceptorTimings: Record<string, number>
    /** Number of interceptors executed */
    interceptorCount: number
  }
  /** Final interceptor context state */
  context: InterceptorContext
}

/**
 * Interceptor chain configuration
 */
export interface InterceptorChainConfig {
  /** Whether to continue execution if an interceptor fails */
  continueOnError?: boolean
  /** Maximum execution time before timeout */
  timeoutMs?: number
  /** Whether to collect detailed performance metrics */
  enableMetrics?: boolean
  /** Whether to log interceptor execution */
  enableLogging?: boolean
}

/**
 * Interceptor registry interface
 */
export interface InterceptorRegistry {
  /** Register a new interceptor */
  register(interceptor: Interceptor): void
  /** Unregister an interceptor by name */
  unregister(name: string): boolean
  /** Get an interceptor by name */
  get(name: string): Interceptor | undefined
  /** Get all interceptors for a specific phase */
  getByPhase(phase: InterceptorPhase): Interceptor[]
  /** Get all registered interceptors */
  getAll(): Interceptor[]
  /** Check if an interceptor is registered */
  has(name: string): boolean
  /** Enable/disable an interceptor */
  setEnabled(name: string, enabled: boolean): boolean
  /** Get interceptors that match route and method criteria */
  getMatching(route: string, method: string, phase: InterceptorPhase): Interceptor[]
  /** Clear all interceptors */
  clear(): void
  /** Get registry statistics */
  getStats(): {
    total: number
    enabled: number
    disabled: number
    byPhase: Record<InterceptorPhase, number>
  }
}

/**
 * Interceptor factory function for creating configured interceptors
 */
export type InterceptorFactory<T = any> = (config: T) => Interceptor

/**
 * Built-in interceptor types
 */
export interface AuthInterceptorConfig {
  /** Whether to require authentication for all routes */
  requireAuth?: boolean
  /** Routes that don't require authentication */
  publicRoutes?: string[]
  /** Token validation function */
  validateToken?: (token: string) => Promise<any>
  /** Custom unauthorized handler */
  onUnauthorized?: (context: Context) => Promise<Response>
}

export interface LoggingInterceptorConfig {
  /** Log level */
  level?: 'debug' | 'info' | 'warn' | 'error'
  /** Whether to log request bodies */
  logRequestBody?: boolean
  /** Whether to log response bodies */
  logResponseBody?: boolean
  /** Maximum body size to log */
  maxBodySize?: number
  /** Threshold for slow request warnings in milliseconds */
  slowThreshold?: number
  /** Custom logger function */
  logger?: (level: string, message: string, data?: any) => void
}

export interface RateLimitInterceptorConfig {
  /** Window size in milliseconds */
  windowMs: number
  /** Maximum requests per window */
  max: number
  /** Storage backend */
  store?: any
  /** Key generator function */
  keyGenerator?: (context: Context, interceptorContext: InterceptorContext) => string
  /** Skip condition function */
  skip?: (context: Context, interceptorContext: InterceptorContext) => boolean
  /** Skip successful requests */
  skipSuccessfulRequests: boolean
  /** Skip failed requests */
  skipFailedRequests: boolean
  /** Per-route rate limits */
  perRouteLimit?: Record<string, number>
  /** Per-user rate limit */
  perUserLimit?: number
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number
  /** Custom limit reached handler */
  onLimitReached?: (context: Context, interceptorContext: InterceptorContext) => Promise<any>
}

export interface RateLimitStore {
  /** Get current count for a key */
  get(key: string): Promise<number>
  /** Increment count for a key */
  increment(key: string, windowMs: number): Promise<number>
  /** Reset count for a key */
  reset(key: string): Promise<void>
}

export interface CacheInterceptorConfig {
  /** Whether caching is enabled */
  enabled: boolean
  /** Default cache TTL in milliseconds */
  defaultTtl: number
  /** Maximum cache size */
  maxSize: number
  /** HTTP methods to cache */
  allowedMethods: string[]
  /** Whether to include query parameters in cache key */
  includeQuery: boolean
  /** Cache storage backend */
  cache?: any
}

export interface CacheStore {
  /** Get cached value */
  get(key: string): Promise<any>
  /** Set cached value */
  set(key: string, value: any, ttlMs?: number): Promise<void>
  /** Delete cached value */
  delete(key: string): Promise<void>
  /** Check if key exists */
  has(key: string): Promise<boolean>
}

export interface ValidationInterceptorConfig {
  /** Whether validation is enabled */
  enabled: boolean
  /** Validate request body */
  validateBody: boolean
  /** Validate query parameters */
  validateQuery: boolean
  /** Validate path parameters */
  validateParams: boolean
  /** Validate headers */
  validateHeaders: boolean
  /** Allow form data parsing */
  allowFormData: boolean
  /** Route-specific validation schemas */
  schemas: Record<string, Record<string, any>>
  /** Custom validation error handler */
  onValidationError?: (context: Context, interceptorContext: InterceptorContext, errors: any) => Promise<any>
}

export interface ErrorHandlerInterceptorConfig {
  /** Whether error handling is enabled */
  enabled: boolean
  /** Include stack traces in error responses */
  includeStackTrace: boolean
  /** Include detailed error information */
  includeDetails: boolean
  /** Enable error reporting to external services */
  enableErrorReporting: boolean
  /** Enable HTML error pages for browser requests */
  enableHtmlErrorPages: boolean
  /** Sanitize sensitive data from error messages */
  sanitizeSensitiveData: boolean
  /** Custom error mapping for specific error types */
  customErrorMap: Record<string, { status: number; message: string; code?: string }>
  /** Custom error reporter function */
  errorReporter?: (error: Error, context: any) => Promise<void>
}

/**
 * Interceptor execution context for the chain
 */
export interface InterceptorExecutionContext {
  /** Current request context */
  requestContext: Context
  /** Shared interceptor context */
  interceptorContext: InterceptorContext
  /** Chain configuration */
  chainConfig: InterceptorChainConfig
  /** Registry reference */
  registry: InterceptorRegistry
}

/**
 * Interceptor lifecycle hooks
 */
export interface InterceptorLifecycleHooks {
  /** Called before interceptor execution */
  beforeExecution?: (interceptor: Interceptor, context: InterceptorExecutionContext) => Promise<void>
  /** Called after successful interceptor execution */
  afterExecution?: (interceptor: Interceptor, context: InterceptorExecutionContext, result: any) => Promise<void>
  /** Called when interceptor throws an error */
  onError?: (interceptor: Interceptor, context: InterceptorExecutionContext, error: Error) => Promise<void>
  /** Called when interceptor chain completes */
  onChainComplete?: (result: InterceptorChainResult) => Promise<void>
}

/**
 * Validation schemas for interceptor configuration
 */
export const InterceptorPhaseSchema = z.enum(['request', 'response', 'error'])

export const InterceptorConfigSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().min(0),
  phase: InterceptorPhaseSchema,
  enabled: z.boolean().default(true),
  dependencies: z.array(z.string()).optional(),
  routes: z.array(z.string()).optional(),
  methods: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.any()).optional()
})

export const InterceptorChainConfigSchema = z.object({
  continueOnError: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(30000),
  enableMetrics: z.boolean().default(true),
  enableLogging: z.boolean().default(false)
})

export const AuthInterceptorConfigSchema = z.object({
  requireAuth: z.boolean().default(true),
  publicRoutes: z.array(z.string()).default([]),
  // Note: validateToken and onUnauthorized are functions, so not validated by Zod
})

export const LoggingInterceptorConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logRequestBody: z.boolean().default(false),
  logResponseBody: z.boolean().default(false),
  maxBodySize: z.number().int().positive().default(1024 * 1024), // 1MB
})

export const RateLimitInterceptorConfigSchema = z.object({
  maxRequests: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  // Note: keyGenerator, onRateLimitExceeded, and store are functions/objects, so not validated by Zod
})

export const CacheInterceptorConfigSchema = z.object({
  defaultTtl: z.number().int().positive().default(5 * 60 * 1000), // 5 minutes
  routes: z.array(z.string()).optional(),
  methods: z.array(z.string()).default(['GET']),
})

/**
 * Type utilities for interceptor development
 */
export type InterceptorName = string
export type InterceptorOrder = number
export type InterceptorRoute = string
export type InterceptorMethod = string

/**
 * Error types for interceptor system
 */
export class InterceptorError extends Error {
  constructor(
    message: string,
    public interceptorName: string,
    public phase: InterceptorPhase,
    public cause?: Error
  ) {
    super(message)
    this.name = 'InterceptorError'
  }
}

export class InterceptorTimeoutError extends InterceptorError {
  constructor(interceptorName: string, timeoutMs: number) {
    super(`Interceptor '${interceptorName}' timed out after ${timeoutMs}ms`, interceptorName, 'request')
    this.name = 'InterceptorTimeoutError'
  }
}

export class InterceptorDependencyError extends InterceptorError {
  constructor(interceptorName: string, missingDependency: string) {
    super(
      `Interceptor '${interceptorName}' has unmet dependency: '${missingDependency}'`,
      interceptorName,
      'request'
    )
    this.name = 'InterceptorDependencyError'
  }
}

export class InterceptorRegistrationError extends Error {
  constructor(message: string, public interceptorName: string) {
    super(message)
    this.name = 'InterceptorRegistrationError'
  }
}