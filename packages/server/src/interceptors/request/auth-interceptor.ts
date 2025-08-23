import type { Context } from 'hono'
import { ErrorFactory } from '@promptliano/shared'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorHandler,
  type AuthInterceptorConfig,
  InterceptorError
} from '../types'

/**
 * Pattern matcher for route patterns (supports wildcards)
 */
function matchesRoutePattern(pattern: string, path: string): boolean {
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
 * Default token validation function (placeholder)
 */
async function defaultValidateToken(token: string): Promise<any> {
  // This should be replaced with actual token validation logic
  throw ErrorFactory.unauthorized('No token validation function provided')
}

/**
 * Create authentication interceptor handler
 */
function createAuthHandler(config: AuthInterceptorConfig): InterceptorHandler {
  return async (context: Context, interceptorContext: InterceptorContext, next: () => Promise<void>) => {
    try {
      // Skip authentication if not required globally
      if (!config.requireAuth) {
        await next()
        return
      }

      const currentPath = context.req.path
      
      // Check if this is a public route
      const isPublicRoute = config.publicRoutes?.some(pattern => 
        matchesRoutePattern(pattern, currentPath)
      ) || false

      if (isPublicRoute) {
        // Public route - proceed without authentication
        await next()
        return
      }

      // Get authorization header
      const authHeader = context.req.header('authorization')
      
      if (!authHeader) {
        // No token provided
        if (config.onUnauthorized) {
          const response = await config.onUnauthorized(context)
          // In a real interceptor, this would need to handle the response properly
          throw new Error('Custom unauthorized response handled')
        }
        throw ErrorFactory.unauthorized('Authentication required')
      }

      // Extract token from Bearer header
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader

      // Validate token
      const validateFn = config.validateToken || defaultValidateToken
      
      try {
        const user = await validateFn(token)
        
        // Store user in interceptor context and Hono context
        interceptorContext.user = user
        context.set('user', user)
        
        // Add authentication metadata
        interceptorContext.metadata.authMethod = 'bearer'
        interceptorContext.metadata.tokenLength = authHeader.length
        interceptorContext.metadata.userId = user?.id
        
        await next()
      } catch (validationError) {
        if (config.onUnauthorized) {
          const response = await config.onUnauthorized(context)
          throw new Error('Token validation failed - custom handler invoked')
        }
        
        // Re-throw validation errors (like expired tokens, invalid credentials)
        throw validationError
      }
    } catch (error) {
      // Wrap any unexpected errors as InterceptorError
      if (error instanceof InterceptorError) {
        throw error
      }
      
      // If it's a known auth error (from ErrorFactory), re-throw it
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      
      throw new InterceptorError(
        `Authentication failed: ${error}`,
        'auth-interceptor',
        'request',
        error as Error
      )
    }
  }
}

/**
 * Create authentication interceptor with default configuration
 */
export function createAuthInterceptor(config: Partial<AuthInterceptorConfig> = {}): Interceptor {
  const defaultConfig: AuthInterceptorConfig = {
    requireAuth: true,
    publicRoutes: [],
    ...config
  }

  return {
    name: 'auth-interceptor',
    order: 10, // Run early in the request cycle
    phase: 'request',
    enabled: true,
    handler: createAuthHandler(defaultConfig),
    config: defaultConfig,
    tags: ['auth', 'security'],
    routes: [], // Apply to all routes by default
    methods: [] // Apply to all methods by default
  }
}

/**
 * Pre-configured authentication interceptor for common use cases
 */
export const authInterceptor = createAuthInterceptor({
  requireAuth: true,
  publicRoutes: [
    '/api/health',
    '/api/status',
    '/api/public/*'
  ]
})

/**
 * Authentication interceptor that allows optional authentication
 */
export const optionalAuthInterceptor = createAuthInterceptor({
  requireAuth: false
})

/**
 * Authentication interceptor for API routes only
 */
export const apiAuthInterceptor = createAuthInterceptor({
  requireAuth: true,
  publicRoutes: [
    '/api/health',
    '/api/status'
  ]
})

/**
 * Utility function to check if a route is public
 */
export function isPublicRoute(path: string, publicRoutes: string[] = []): boolean {
  return publicRoutes.some(pattern => matchesRoutePattern(pattern, path))
}

/**
 * Utility function to extract token from authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null
  }
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  
  return authHeader
}