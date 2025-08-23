import {
  type Interceptor,
  type InterceptorRegistry,
  type InterceptorPhase,
  InterceptorRegistrationError
} from './types'

/**
 * Simple pattern matcher for route patterns
 */
function matchesPattern(pattern: string, path: string): boolean {
  // Convert glob-like patterns to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '___DOUBLE_STAR___')  // Temporarily replace **
    .replace(/\*/g, '[^/]*')                // * matches anything except /
    .replace(/___DOUBLE_STAR___/g, '.*')    // ** matches everything including /
    .replace(/\?/g, '.')                    // ? matches single character
  
  const regex = new RegExp('^' + regexPattern + '$')
  return regex.test(path)
}

/**
 * In-memory interceptor registry implementation
 */
export class DefaultInterceptorRegistry implements InterceptorRegistry {
  private interceptors = new Map<string, Interceptor>()

  /**
   * Register a new interceptor
   */
  register(interceptor: Interceptor): void {
    // Validate interceptor
    if (!interceptor.name || typeof interceptor.name !== 'string') {
      throw new InterceptorRegistrationError('Interceptor name is required', interceptor.name || 'unknown')
    }

    if (this.interceptors.has(interceptor.name)) {
      throw new InterceptorRegistrationError(
        `Interceptor with name '${interceptor.name}' already registered`,
        interceptor.name
      )
    }

    if (typeof interceptor.order !== 'number' || interceptor.order < 0) {
      throw new InterceptorRegistrationError(
        `Interceptor '${interceptor.name}' must have a valid order (non-negative number)`,
        interceptor.name
      )
    }

    if (!['request', 'response', 'error'].includes(interceptor.phase)) {
      throw new InterceptorRegistrationError(
        `Interceptor '${interceptor.name}' must have a valid phase (request, response, or error)`,
        interceptor.name
      )
    }

    if (typeof interceptor.handler !== 'function') {
      throw new InterceptorRegistrationError(
        `Interceptor '${interceptor.name}' must have a valid handler function`,
        interceptor.name
      )
    }

    this.interceptors.set(interceptor.name, { ...interceptor })
  }

  /**
   * Unregister an interceptor by name
   */
  unregister(name: string): boolean {
    return this.interceptors.delete(name)
  }

  /**
   * Get an interceptor by name
   */
  get(name: string): Interceptor | undefined {
    return this.interceptors.get(name)
  }

  /**
   * Get all interceptors for a specific phase
   */
  getByPhase(phase: InterceptorPhase): Interceptor[] {
    return Array.from(this.interceptors.values())
      .filter(interceptor => interceptor.phase === phase)
      .sort((a, b) => a.order - b.order)
  }

  /**
   * Get all registered interceptors
   */
  getAll(): Interceptor[] {
    return Array.from(this.interceptors.values())
  }

  /**
   * Check if an interceptor is registered
   */
  has(name: string): boolean {
    return this.interceptors.has(name)
  }

  /**
   * Enable/disable an interceptor
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const interceptor = this.interceptors.get(name)
    if (!interceptor) {
      return false
    }

    interceptor.enabled = enabled
    return true
  }

  /**
   * Get interceptors that match route and method criteria
   */
  getMatching(route: string, method: string, phase: InterceptorPhase): Interceptor[] {
    return Array.from(this.interceptors.values())
      .filter(interceptor => {
        // Must be correct phase and enabled
        if (interceptor.phase !== phase || !interceptor.enabled) {
          return false
        }

        // Check route patterns
        if (interceptor.routes && interceptor.routes.length > 0) {
          const routeMatches = interceptor.routes.some(pattern => 
            matchesPattern(pattern, route)
          )
          if (!routeMatches) {
            return false
          }
        }

        // Check method filters
        if (interceptor.methods && interceptor.methods.length > 0) {
          if (!interceptor.methods.includes(method.toUpperCase())) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => a.order - b.order)
  }

  /**
   * Clear all interceptors (useful for testing)
   */
  clear(): void {
    this.interceptors.clear()
  }

  /**
   * Get interceptors by tag
   */
  getByTag(tag: string): Interceptor[] {
    return Array.from(this.interceptors.values())
      .filter(interceptor => interceptor.tags?.includes(tag))
      .sort((a, b) => a.order - b.order)
  }

  /**
   * Get interceptors that depend on a specific interceptor
   */
  getDependents(interceptorName: string): Interceptor[] {
    return Array.from(this.interceptors.values())
      .filter(interceptor => 
        interceptor.dependencies?.includes(interceptorName)
      )
  }

  /**
   * Validate all dependencies are satisfied
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const interceptorNames = new Set(this.interceptors.keys())

    for (const interceptor of Array.from(this.interceptors.values())) {
      if (interceptor.dependencies) {
        for (const dependency of interceptor.dependencies) {
          if (!interceptorNames.has(dependency)) {
            errors.push(
              `Interceptor '${interceptor.name}' depends on '${dependency}' which is not registered`
            )
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get statistics about the registry
   */
  getStats(): {
    total: number
    enabled: number
    disabled: number
    byPhase: Record<InterceptorPhase, number>
  } {
    const interceptors = Array.from(this.interceptors.values())
    const stats = {
      total: interceptors.length,
      enabled: interceptors.filter(i => i.enabled).length,
      disabled: interceptors.filter(i => !i.enabled).length,
      byPhase: {
        request: interceptors.filter(i => i.phase === 'request').length,
        response: interceptors.filter(i => i.phase === 'response').length,
        error: interceptors.filter(i => i.phase === 'error').length
      }
    }

    return stats
  }
}

/**
 * Factory function to create a new registry instance
 */
export function createInterceptorRegistry(): InterceptorRegistry {
  return new DefaultInterceptorRegistry()
}

/**
 * Singleton registry instance for the application
 */
let globalRegistry: InterceptorRegistry | null = null

/**
 * Get the global registry instance
 */
export function getGlobalRegistry(): InterceptorRegistry {
  if (!globalRegistry) {
    globalRegistry = createInterceptorRegistry()
  }
  return globalRegistry
}

/**
 * Set the global registry instance (useful for testing)
 */
export function setGlobalRegistry(registry: InterceptorRegistry): void {
  globalRegistry = registry
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null
}