import type { Context } from 'hono'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorChainResult,
  type InterceptorChainConfig,
  type InterceptorPhase,
  type InterceptorRegistry,
  type InterceptorExecutionContext,
  type InterceptorLifecycleHooks,
  InterceptorError,
  InterceptorTimeoutError,
  InterceptorDependencyError
} from './types'

/**
 * InterceptorChain orchestrates the execution of interceptors in the correct order
 * with proper error handling, metrics collection, and lifecycle management
 */
export class InterceptorChain {
  private readonly registry: InterceptorRegistry
  private readonly config: InterceptorChainConfig
  private readonly lifecycleHooks: InterceptorLifecycleHooks
  private totalExecutions = 0
  private totalExecutionTime = 0

  constructor(
    registry: InterceptorRegistry,
    config: InterceptorChainConfig = {},
    lifecycleHooks: InterceptorLifecycleHooks = {}
  ) {
    this.registry = registry
    this.config = {
      continueOnError: false,
      timeoutMs: 30000,
      enableMetrics: true,
      enableLogging: false,
      ...config
    }
    this.lifecycleHooks = lifecycleHooks
  }

  /**
   * Execute interceptors for a specific phase (request, response, error)
   */
  async execute(
    phase: InterceptorPhase,
    context: Context,
    interceptorContext: InterceptorContext,
    route?: string,
    method?: string
  ): Promise<InterceptorChainResult> {
    const startTime = Date.now()
    const executionContext: InterceptorExecutionContext = {
      requestContext: context,
      interceptorContext,
      chainConfig: this.config,
      registry: this.registry
    }

    try {
      // Get applicable interceptors for this phase, route, and method
      const interceptors = this.getApplicableInterceptors(phase, route, method)

      if (this.config.enableLogging) {
        console.log(`[InterceptorChain] Executing ${interceptors.length} interceptors for phase '${phase}'`)
      }

      // Validate dependencies
      this.validateDependencies(interceptors)

      // Sort interceptors by order
      const sortedInterceptors = this.sortInterceptors(interceptors)

      // Execute interceptors in order
      await this.executeInterceptors(sortedInterceptors, executionContext)

      const totalTime = Date.now() - startTime
      interceptorContext.metrics.totalTime = totalTime
      this.recordExecution(totalTime)

      const result: InterceptorChainResult = {
        success: true,
        metrics: {
          totalTime,
          interceptorTimings: interceptorContext.metrics.interceptorTimings,
          interceptorCount: sortedInterceptors.length
        },
        context: interceptorContext
      }

      // Call lifecycle hook
      if (this.lifecycleHooks.onChainComplete) {
        await this.lifecycleHooks.onChainComplete(result)
      }

      return result
    } catch (error) {
      const totalTime = Date.now() - startTime
      interceptorContext.metrics.totalTime = totalTime
      this.recordExecution(totalTime)

      const result: InterceptorChainResult = {
        success: false,
        error: error as Error,
        metrics: {
          totalTime,
          interceptorTimings: interceptorContext.metrics.interceptorTimings,
          interceptorCount: 0
        },
        context: interceptorContext
      }

      // Call lifecycle hook
      if (this.lifecycleHooks.onChainComplete) {
        await this.lifecycleHooks.onChainComplete(result)
      }

      throw error
    }
  }

  /**
   * Get interceptors that apply to the current request
   */
  private getApplicableInterceptors(phase: InterceptorPhase, route?: string, method?: string): Interceptor[] {
    if (route && method) {
      return this.registry.getMatching(route, method, phase)
    }
    return this.registry.getByPhase(phase).filter((interceptor) => interceptor.enabled)
  }

  /**
   * Validate that all dependencies are satisfied
   */
  private validateDependencies(interceptors: Interceptor[]): void {
    const interceptorNames = new Set(interceptors.map((i) => i.name))

    for (const interceptor of interceptors) {
      if (interceptor.dependencies) {
        for (const dependency of interceptor.dependencies) {
          if (!interceptorNames.has(dependency)) {
            throw new InterceptorDependencyError(interceptor.name, dependency)
          }
        }
      }
    }
  }

  /**
   * Sort interceptors by order, taking dependencies into account
   */
  private sortInterceptors(interceptors: Interceptor[]): Interceptor[] {
    // First sort by order
    const sorted = [...interceptors].sort((a, b) => a.order - b.order)

    // Then apply topological sort for dependencies
    return this.topologicalSort(sorted)
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(interceptors: Interceptor[]): Interceptor[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const result: Interceptor[] = []
    const interceptorMap = new Map(interceptors.map((i) => [i.name, i]))

    const visit = (interceptor: Interceptor) => {
      if (visiting.has(interceptor.name)) {
        throw new Error(`Circular dependency detected involving interceptor '${interceptor.name}'`)
      }

      if (visited.has(interceptor.name)) {
        return
      }

      visiting.add(interceptor.name)

      // Visit dependencies first
      if (interceptor.dependencies) {
        for (const depName of interceptor.dependencies) {
          const dependency = interceptorMap.get(depName)
          if (dependency) {
            visit(dependency)
          }
        }
      }

      visiting.delete(interceptor.name)
      visited.add(interceptor.name)
      result.push(interceptor)
    }

    for (const interceptor of interceptors) {
      if (!visited.has(interceptor.name)) {
        visit(interceptor)
      }
    }

    return result
  }

  /**
   * Execute interceptors in sequence with proper error handling
   */
  private async executeInterceptors(
    interceptors: Interceptor[],
    executionContext: InterceptorExecutionContext
  ): Promise<void> {
    for (const interceptor of interceptors) {
      await this.executeInterceptor(interceptor, executionContext)
    }
  }

  /**
   * Execute a single interceptor with timeout and error handling
   */
  private async executeInterceptor(
    interceptor: Interceptor,
    executionContext: InterceptorExecutionContext
  ): Promise<void> {
    const { requestContext, interceptorContext } = executionContext
    const startTime = Date.now()
    const timeoutMs = this.config.timeoutMs ?? 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      // Call before execution hook
      if (this.lifecycleHooks.beforeExecution) {
        await this.lifecycleHooks.beforeExecution(interceptor, executionContext)
      }

      if (this.config.enableLogging) {
        console.log(`[InterceptorChain] Executing interceptor '${interceptor.name}'`)
      }

      const executionPromise = this.executeWithNextHandler(interceptor, requestContext, interceptorContext)
      const promises: Array<Promise<unknown>> = [executionPromise]

      if (timeoutMs > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new InterceptorTimeoutError(interceptor.name, timeoutMs))
          }, timeoutMs)
        })
        promises.push(timeoutPromise)
      }

      const result = await Promise.race(promises)
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      const executionTime = Date.now() - startTime
      if (this.config.enableMetrics) {
        interceptorContext.metrics.interceptorTimings[interceptor.name] = executionTime
      }

      // Call after execution hook
      if (this.lifecycleHooks.afterExecution) {
        await this.lifecycleHooks.afterExecution(interceptor, executionContext, result)
      }

      if (this.config.enableLogging) {
        console.log(`[InterceptorChain] Completed interceptor '${interceptor.name}' in ${executionTime}ms`)
      }
    } catch (error) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      const executionTime = Date.now() - startTime
      if (this.config.enableMetrics) {
        interceptorContext.metrics.interceptorTimings[interceptor.name] = executionTime
      }

      // Call error lifecycle hook
      if (this.lifecycleHooks.onError) {
        await this.lifecycleHooks.onError(interceptor, executionContext, error as Error)
      }

      // Try interceptor's error handler first
      if (interceptor.errorHandler) {
        try {
          await interceptor.errorHandler(error as Error, requestContext, interceptorContext)
          if (this.config.continueOnError) {
            return // Continue with next interceptor
          }
        } catch (handlerError) {
          throw new InterceptorError(
            `Error in interceptor '${interceptor.name}' error handler: ${handlerError}`,
            interceptor.name,
            interceptor.phase,
            handlerError as Error
          )
        }
      }

      // If we reach here, either no error handler or continueOnError is false
      if (this.config.continueOnError) {
        console.warn(`[InterceptorChain] Interceptor '${interceptor.name}' failed, continuing: ${error}`)
        return
      }

      throw new InterceptorError(
        `Interceptor '${interceptor.name}' failed: ${error}`,
        interceptor.name,
        interceptor.phase,
        error as Error
      )
    }
  }

  /**
   * Execute interceptor with proper next() handler
   */
  private async executeWithNextHandler(
    interceptor: Interceptor,
    context: Context,
    interceptorContext: InterceptorContext
  ): Promise<void> {
    let nextCalled = false

    const next = async () => {
      if (nextCalled) {
        throw new Error(`next() called multiple times in interceptor '${interceptor.name}'`)
      }
      nextCalled = true
    }

    await interceptor.handler(context, interceptorContext, next)

    // For certain phases, next() must be called
    if ((interceptor.phase === 'request' || interceptor.phase === 'response') && !nextCalled) {
      console.warn(`[InterceptorChain] Interceptor '${interceptor.name}' did not call next()`)
    }
  }

  /**
   * Create a middleware function for Hono
   */
  createMiddleware(phase: InterceptorPhase = 'request') {
    return async (context: Context, next: () => Promise<void>) => {
      const route = context.req.path
      const method = context.req.method

      // Create interceptor context
      const interceptorContext: InterceptorContext = {
        requestId: context.get('requestId') || this.generateRequestId(),
        startTime: Date.now(),
        metadata: {},
        metrics: {
          interceptorTimings: {}
        },
        cacheKeys: [],
        security: {
          ip: this.getClientIP(context),
          userAgent: context.req.header('user-agent'),
          rateLimitKeys: []
        }
      }

      // Store context for later phases
      context.set('interceptorContext', interceptorContext)

      try {
        // Execute interceptors for this phase
        await this.execute(phase, context, interceptorContext, route, method)

        // Call the next middleware/handler
        if (phase === 'request') {
          await next()
        }
      } catch (error) {
        // If we have an error phase, execute error interceptors
        if (phase !== 'error') {
          try {
            await this.execute('error', context, interceptorContext, route, method)
          } catch (errorPhaseError) {
            console.error('[InterceptorChain] Error in error phase interceptors:', errorPhaseError)
          }
        }
        throw error
      }
    }
  }

  private recordExecution(durationMs: number): void {
    this.totalExecutions += 1
    this.totalExecutionTime += durationMs
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Extract client IP from request
   */
  private getClientIP(context: Context): string {
    return context.req.header('x-forwarded-for') || context.req.header('x-real-ip') || 'unknown'
  }

  /**
   * Update chain configuration
   */
  updateConfig(config: Partial<InterceptorChainConfig>): void {
    Object.assign(this.config, config)
  }

  /**
   * Get current configuration
   */
  getConfig(): InterceptorChainConfig {
    return { ...this.config }
  }

  /**
   * Get performance metrics for the chain
   */
  getMetrics(): { totalExecutions: number; averageExecutionTime: number } {
    const averageExecutionTime =
      this.totalExecutions === 0 ? 0 : this.totalExecutionTime / this.totalExecutions
    return {
      totalExecutions: this.totalExecutions,
      averageExecutionTime
    }
  }
}

/**
 * Factory function to create a pre-configured interceptor chain
 */
export function createInterceptorChain(
  registry: InterceptorRegistry,
  config?: InterceptorChainConfig,
  lifecycleHooks?: InterceptorLifecycleHooks
): InterceptorChain {
  return new InterceptorChain(registry, config, lifecycleHooks)
}

/**
 * Utility function to create a simple next handler for testing
 */
export function createMockNext(): () => Promise<void> {
  return async () => {
    // Mock implementation for testing
  }
}
