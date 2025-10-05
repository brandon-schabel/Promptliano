import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
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
    .replace(/\*\*/g, '___DOUBLE_STAR___') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/___DOUBLE_STAR___/g, '.*') // ** matches everything including /
    .replace(/\?/g, '.') // ? matches single character

  const regex = new RegExp('^' + regexPattern + '$')
  return regex.test(path)
}

/**
 * Default token validation function using authService
 */
async function defaultValidateToken(token: string): Promise<any> {
  // Import at the top if not already imported
  const { authService } = await import('@promptliano/services')

  // Verify JWT token
  const payload = authService.verifyAccessToken(token)
  if (!payload) {
    throw ErrorFactory.unauthorized('Invalid or expired token')
  }

  // Get user from database to ensure they still exist and are active
  const { authRepository } = await import('@promptliano/database')
  const user = await authRepository.getUserById(payload.userId)

  if (!user) {
    throw ErrorFactory.unauthorized('User not found')
  }

  if (!user.isActive) {
    throw ErrorFactory.unauthorized('User account is deactivated')
  }

  return user
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
      const isPublicRoute = config.publicRoutes?.some((pattern) => matchesRoutePattern(pattern, currentPath)) || false

      if (isPublicRoute) {
        // Public route - proceed without authentication
        await next()
        return
      }

      // Extract token from httpOnly cookie (not from headers!)
      const token = getCookie(context, 'access_token')

      if (!token) {
        // No token provided in cookie
        if (config.onUnauthorized) {
          const response = await config.onUnauthorized(context)
          throw new Error('Custom unauthorized response handled')
        }
        throw ErrorFactory.unauthorized('Authentication required')
      }

      // Validate token
      const validateFn = config.validateToken || defaultValidateToken

      try {
        const user = await validateFn(token)

        // Store user in interceptor context and Hono context
        interceptorContext.user = user
        context.set('user', user)

        // Add authentication metadata
        interceptorContext.metadata.authMethod = 'httponly-cookie'
        interceptorContext.metadata.tokenLength = token.length
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

      throw new InterceptorError(`Authentication failed: ${error}`, 'auth-interceptor', 'request', error as Error)
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
    '/api/public/*',
    '/api/auth/setup',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/status',
    '/api/csrf-token',      // CSRF token endpoint
    '/doc',                  // OpenAPI documentation
    '/swagger',              // Swagger UI
    '/_openapi-debug'        // Debug endpoint
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
  publicRoutes: ['/api/health', '/api/status']
})

/**
 * Utility function to check if a route is public
 */
export function isPublicRoute(path: string, publicRoutes: string[] = []): boolean {
  return publicRoutes.some((pattern) => matchesRoutePattern(pattern, path))
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
