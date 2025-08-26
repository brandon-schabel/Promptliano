/**
 * Promptliano Interceptor System
 *
 * A comprehensive interceptor framework for Hono-based APIs that provides:
 * - Cross-cutting concerns (auth, logging, caching, rate limiting)
 * - Type-safe configuration and context management
 * - Dependency resolution and execution ordering
 * - Performance monitoring and metrics collection
 * - Route and method-specific filtering
 */

// Core types and interfaces
export * from './types'

// Chain orchestration
export { InterceptorChain, createInterceptorChain, createMockNext } from './chain'

// Registry management
export { DefaultInterceptorRegistry, createInterceptorRegistry, getGlobalRegistry, setGlobalRegistry } from './registry'

// Context management
export {
  InterceptorContextManager,
  createContextMiddleware,
  withInterceptorContext,
  TypedMetadata,
  createTypedMetadata
} from './context'

// Configuration
export {
  GlobalInterceptorConfigSchema,
  InterceptorDefinitionSchema,
  InterceptorConfigLoader,
  DEFAULT_DEVELOPMENT_CONFIG,
  DEFAULT_PRODUCTION_CONFIG,
  createInterceptorConfig,
  loadConfigFromEnv,
  validateInterceptorDefinition,
  type GlobalInterceptorConfig,
  type InterceptorDefinition
} from './config'

import type { Hono } from 'hono'
import type { Context } from 'hono'
import { createInterceptorRegistry } from './registry'
import { createInterceptorChain } from './chain'
import { createContextMiddleware } from './context'
import { loadConfigFromEnv } from './config'
import type { InterceptorRegistry, Interceptor, InterceptorContext } from './types'
import type { InterceptorChain as IInterceptorChain } from './chain'

/**
 * Main interceptor system orchestrator
 * Provides a high-level API for setting up and managing the interceptor system
 */
export class InterceptorSystem {
  private registry: InterceptorRegistry
  private requestChain: IInterceptorChain
  private responseChain: IInterceptorChain
  private errorChain: IInterceptorChain
  private configLoader: ReturnType<typeof loadConfigFromEnv>

  constructor(configOverrides?: any) {
    this.configLoader = loadConfigFromEnv()

    // Apply config overrides if provided
    if (configOverrides) {
      this.configLoader.updateConfig(configOverrides)
    }

    this.registry = createInterceptorRegistry()

    const chainConfig = this.configLoader.getChainConfig()

    this.requestChain = createInterceptorChain(this.registry, chainConfig)
    this.responseChain = createInterceptorChain(this.registry, chainConfig)
    this.errorChain = createInterceptorChain(this.registry, chainConfig)
  }

  /**
   * Register an interceptor with the system
   */
  register(interceptor: Interceptor): void {
    this.registry.register(interceptor)
  }

  /**
   * Register multiple interceptors
   */
  registerMany(interceptors: Interceptor[]): void {
    interceptors.forEach((interceptor) => this.register(interceptor))
  }

  /**
   * Apply interceptor system to a Hono app
   */
  applyTo(app: Hono): void {
    if (!this.configLoader.getConfig().enabled) {
      console.log('[InterceptorSystem] Interceptor system is disabled')
      return
    }

    // Add context middleware first
    app.use('*', createContextMiddleware())

    // Add request interceptors
    app.use('*', this.requestChain.createMiddleware('request'))

    // Add response interceptors (these run after route handlers)
    app.use('*', async (context: Context, next: () => Promise<void>) => {
      await next() // Let route handler execute first

      // Then run response interceptors
      const interceptorContext = context.get('interceptorContext')
      if (interceptorContext) {
        await this.responseChain.execute('response', context, interceptorContext, context.req.path, context.req.method)
      }
    })

    // Add error interceptors
    app.onError(async (error: Error, context: Context) => {
      const interceptorContext = context.get('interceptorContext')
      if (interceptorContext) {
        try {
          await this.errorChain.execute('error', context, interceptorContext, context.req.path, context.req.method)
        } catch (errorInterceptorError) {
          console.error('[InterceptorSystem] Error in error interceptors:', errorInterceptorError)
        }
      }

      // Re-throw the original error to maintain normal error handling
      throw error
    })

    console.log('[InterceptorSystem] Interceptor system applied to Hono app')
  }

  /**
   * Get the registry instance
   */
  getRegistry(): InterceptorRegistry {
    return this.registry
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      interceptorCount: this.registry.getAll().length,
      enabledCount: this.registry.getAll().filter((i) => i.enabled).length,
      registryStats: this.registry.getStats(),
      config: this.configLoader.getConfig()
    }
  }

  /**
   * Enable or disable the entire system
   */
  setEnabled(enabled: boolean): void {
    this.configLoader.updateConfig({ enabled })
  }

  /**
   * Update system configuration
   */
  updateConfig(config: Parameters<typeof this.configLoader.updateConfig>[0]): void {
    this.configLoader.updateConfig(config)
  }

  /**
   * Clear all interceptors (useful for testing)
   */
  clear(): void {
    this.registry.clear()
  }
}

/**
 * Singleton instance for global use
 */
let globalInterceptorSystem: InterceptorSystem | undefined

/**
 * Get the global interceptor system instance
 */
export function getGlobalInterceptorSystem(): InterceptorSystem {
  if (!globalInterceptorSystem) {
    globalInterceptorSystem = new InterceptorSystem()
  }
  return globalInterceptorSystem
}

/**
 * Set the global interceptor system (useful for testing)
 */
export function setGlobalInterceptorSystem(system: InterceptorSystem): void {
  globalInterceptorSystem = system
}

/**
 * Factory function to create a new interceptor system
 */
export function createInterceptorSystem(configOverrides?: any): InterceptorSystem {
  return new InterceptorSystem(configOverrides)
}

/**
 * Quick setup function for common use cases
 * Applies a pre-configured interceptor system to a Hono app
 */
export function setupInterceptors(
  app: Hono,
  options?: {
    /** Custom interceptors to register */
    interceptors?: Interceptor[]
    /** Configuration overrides */
    config?: any
    /** Whether to use built-in interceptors */
    useBuiltIns?: boolean
  }
): InterceptorSystem {
  const system = createInterceptorSystem(options?.config)

  // Register custom interceptors
  if (options?.interceptors) {
    system.registerMany(options.interceptors)
  }

  // TODO: Register built-in interceptors when implemented
  if (options?.useBuiltIns !== false) {
    // This will be implemented in Phase 2 when we create the built-in interceptors
    console.log('[InterceptorSystem] Built-in interceptors will be added in Phase 2')
  }

  system.applyTo(app)
  return system
}

/**
 * Utility functions for common interceptor operations
 */
export const InterceptorUtils = {
  /**
   * Create a simple logging interceptor
   */
  createLoggingInterceptor(name = 'logger', order = 10): Interceptor {
    return {
      name,
      order,
      phase: 'request',
      enabled: true,
      handler: async (context, interceptorContext, next) => {
        const start = Date.now()
        console.log(`[${interceptorContext.requestId}] ${context.req.method} ${context.req.path}`)

        await next()

        const duration = Date.now() - start
        console.log(`[${interceptorContext.requestId}] Completed in ${duration}ms`)
      }
    }
  },

  /**
   * Create a simple timing interceptor
   */
  createTimingInterceptor(name = 'timer', order = 5): Interceptor {
    return {
      name,
      order,
      phase: 'request',
      enabled: true,
      handler: async (context, interceptorContext, next) => {
        const start = Date.now()
        await next()
        const duration = Date.now() - start
        interceptorContext.metadata.responseTime = duration

        // Add timing header
        context.header('X-Response-Time', `${duration}ms`)
      }
    }
  },

  /**
   * Create a simple request ID interceptor
   */
  createRequestIdInterceptor(name = 'request-id', order = 1): Interceptor {
    return {
      name,
      order,
      phase: 'request',
      enabled: true,
      handler: async (context, interceptorContext, next) => {
        context.header('X-Request-ID', interceptorContext.requestId)
        await next()
      }
    }
  },

  /**
   * Create a CORS interceptor
   */
  createCorsInterceptor(name = 'cors', order = 15, origins = ['*']): Interceptor {
    return {
      name,
      order,
      phase: 'response',
      enabled: true,
      handler: async (context, interceptorContext, next) => {
        await next()

        context.header('Access-Control-Allow-Origin', origins.join(', '))
        context.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        context.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      }
    }
  }
}

/**
 * Re-export key types for convenience
 */
export type {
  Interceptor,
  InterceptorContext,
  InterceptorHandler,
  InterceptorPhase,
  InterceptorRegistry,
  InterceptorChainResult,
  InterceptorChainConfig
} from './types'
