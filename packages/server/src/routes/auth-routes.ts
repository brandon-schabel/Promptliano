/**
 * Authentication Routes - Public authentication endpoints
 *
 * Provides user authentication, token management, and setup operations
 * following Promptliano's Hono OpenAPI patterns.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { createStandardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'
import { ApiErrorResponseSchema } from '@promptliano/schemas'
import { authService } from '@promptliano/services'
import { authRepository } from '@promptliano/database'
import { ErrorFactory } from '@promptliano/shared'
import { selectUserSchema, selectAuthSettingsSchema } from '@promptliano/database'
import { rateLimiters } from '../middleware/rate-limiter'
import { getCsrfTokenHandler } from '../middleware/csrf'

// =============================================================================
// COOKIE CONFIGURATION - HTTPONLY SECURITY
// =============================================================================

const COOKIE_OPTIONS = {
  httpOnly: true, // ✅ JavaScript cannot access (XSS protection)
  secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
  sameSite: 'Strict' as const, // ✅ CSRF protection
  path: '/',
  domain: undefined // Use default (current domain)
} as const

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 15 * 60 // 15 minutes
}

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 // 7 days
}

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

// Setup request schema - PASSWORD REQUIRED
const SetupRequestSchema = z.object({
  username: z.string().min(3).max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email().optional()
}).openapi('SetupRequest')

// Login request schema - PASSWORD REQUIRED
const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1, 'Password is required')
}).openapi('LoginRequest')

// Refresh token request schema (token comes from cookie, body is optional)
const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1).optional()
}).openapi('RefreshTokenRequest')

// Logout request schema (token comes from cookie, body is optional)
const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional()
}).openapi('LogoutRequest')

// Auth tokens response schema (tokens are in httpOnly cookies, NOT in response body)
const AuthTokensResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: selectUserSchema,
    message: z.string().optional()
  })
}).openapi('AuthTokensResponse')

// Auth status response schema
const AuthStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    needsSetup: z.boolean(),
    authSettings: selectAuthSettingsSchema
  })
}).openapi('AuthStatusResponse')

// User response schema
const UserResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: selectUserSchema
  })
}).openapi('UserResponse')

// Logout response schema
const LogoutResponseSchema = z.object({
  success: z.literal(true),
  message: z.string()
}).openapi('LogoutResponse')

// CSRF token response schema
const CsrfTokenResponseSchema = z.object({
  token: z.string()
}).openapi('CsrfTokenResponse')

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

/**
 * POST /api/auth/setup - First-time setup
 */
const setupRoute = createRoute({
  method: 'post',
  path: '/api/auth/setup',
  tags: ['Authentication'],
  summary: 'First-time setup - create first admin user',
  description: 'Creates the first admin user. Only works when no users exist.',
  request: {
    body: {
      content: { 'application/json': { schema: SetupRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AuthTokensResponseSchema } },
      description: 'First user created successfully'
    },
    409: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Setup already complete'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid input'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * POST /api/auth/login - User login
 */
const loginRoute = createRoute({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Authentication'],
  summary: 'User login',
  description: 'Authenticate user with username and optional password',
  request: {
    body: {
      content: { 'application/json': { schema: LoginRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AuthTokensResponseSchema } },
      description: 'Login successful'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid credentials'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'User not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * POST /api/auth/refresh - Refresh access token
 */
const refreshRoute = createRoute({
  method: 'post',
  path: '/api/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh access token',
  description: 'Get new access and refresh tokens using a valid refresh token',
  request: {
    body: {
      content: { 'application/json': { schema: RefreshTokenRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AuthTokensResponseSchema } },
      description: 'Token refreshed successfully'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid or expired refresh token'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Refresh token not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * POST /api/auth/logout - Logout (invalidate refresh token)
 */
const logoutRoute = createRoute({
  method: 'post',
  path: '/api/auth/logout',
  tags: ['Authentication'],
  summary: 'Logout',
  description: 'Invalidate refresh token to logout user',
  request: {
    body: {
      content: { 'application/json': { schema: LogoutRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: LogoutResponseSchema } },
      description: 'Logout successful'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * GET /api/auth/status - Check setup status
 */
const statusRoute = createRoute({
  method: 'get',
  path: '/api/auth/status',
  tags: ['Authentication'],
  summary: 'Check authentication status',
  description: 'Check if first-time setup is needed and get auth settings',
  responses: {
    200: {
      content: { 'application/json': { schema: AuthStatusResponseSchema } },
      description: 'Status retrieved successfully'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * GET /api/auth/me - Get current user
 */
const meRoute = createRoute({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Authentication'],
  summary: 'Get current user',
  description: 'Get current authenticated user from token',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'Current user retrieved successfully'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Not authenticated'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * GET /api/csrf-token - Get CSRF token
 */
const csrfTokenRoute = createRoute({
  method: 'get',
  path: '/api/csrf-token',
  tags: ['Authentication'],
  summary: 'Get CSRF token',
  description: 'Get CSRF token for protecting state-changing requests',
  responses: {
    200: {
      content: { 'application/json': { schema: CsrfTokenResponseSchema } },
      description: 'CSRF token retrieved successfully'
    }
  }
})

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export const authRoutes = new OpenAPIHono()

/**
 * Setup first user handler (rate limited: 3 attempts per hour)
 */
authRoutes.use(setupRoute.path, rateLimiters.setup)
authRoutes.openapi(setupRoute, async (c) => {
  const { username, password, email } = c.req.valid('json')

  try {
    // Check if setup is needed
    const needsSetup = await authService.needsSetup()
    if (!needsSetup) {
      throw ErrorFactory.conflict('Setup already complete. Users already exist.')
    }

    // Validate password is provided
    if (!password) {
      throw ErrorFactory.invalidInput('password', 'non-empty string')
    }

    // Create first admin user
    const result = await authService.setupFirstUser(username, password)

    // Set tokens as httpOnly cookies (JavaScript cannot access)
    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

    // Return ONLY user data (no tokens in response body)
    return c.json(successResponse({
      user: result.user,
      message: 'Setup completed successfully'
    }), 200)
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exist')) {
      throw ErrorFactory.conflict(error.message)
    }
    throw error
  }
})

/**
 * Login handler (rate limited: 5 attempts per 15 minutes)
 */
authRoutes.use(loginRoute.path, rateLimiters.login)
authRoutes.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid('json')

  try {
    // Validate password is provided
    if (!password) {
      throw ErrorFactory.invalidInput('password', 'non-empty string')
    }

    const result = await authService.authenticateUser(username, password)

    // Set tokens as httpOnly cookies (JavaScript cannot access)
    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

    // Return ONLY user data (no tokens in response body)
    return c.json(successResponse({
      user: result.user,
      message: 'Login successful'
    }), 200)
  } catch (error) {
    // AuthService already throws proper ErrorFactory errors
    throw error
  }
})

/**
 * Refresh token handler (rate limited: 20 attempts per 15 minutes)
 */
authRoutes.use(refreshRoute.path, rateLimiters.refresh)
authRoutes.openapi(refreshRoute, async (c) => {
  // Get refresh token from httpOnly cookie (preferred) or request body (migration)
  const bodyData = c.req.valid('json')
  const refreshToken = getCookie(c, 'refresh_token') || bodyData.refreshToken

  if (!refreshToken) {
    throw ErrorFactory.unauthorized('No refresh token provided')
  }

  try {
    const result = await authService.refreshAccessToken(refreshToken)

    // Set new tokens as httpOnly cookies
    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

    // Return ONLY user data (no tokens in response body)
    return c.json(successResponse({
      user: result.user,
      message: 'Token refreshed successfully'
    }), 200)
  } catch (error) {
    // Clear invalid cookies
    deleteCookie(c, 'access_token')
    deleteCookie(c, 'refresh_token')
    throw ErrorFactory.unauthorized('Invalid refresh token')
  }
})

/**
 * Logout handler
 */
authRoutes.openapi(logoutRoute, async (c) => {
  // Get refresh token from httpOnly cookie (preferred) or request body (migration)
  const bodyData = c.req.valid('json')
  const refreshToken = getCookie(c, 'refresh_token') || bodyData.refreshToken

  if (refreshToken) {
    try {
      await authService.logout(refreshToken)
    } catch (error) {
      // Log error but still clear cookies
      console.error('Error during logout:', error)
    }
  }

  // Clear auth cookies
  deleteCookie(c, 'access_token')
  deleteCookie(c, 'refresh_token')

  return c.json(successResponse({ message: 'Logged out successfully' }), 200)
})

/**
 * Status handler
 */
authRoutes.openapi(statusRoute, async (c) => {
  try {
    const needsSetup = await authService.needsSetup()
    const authSettings = await authService.getAuthSettings()

    return c.json(successResponse({
      needsSetup,
      authSettings
    }), 200)
  } catch (error) {
    throw error
  }
})

/**
 * Get current user handler (requires authentication)
 */
authRoutes.openapi(meRoute, async (c) => {
  try {
    // Get token from httpOnly cookie
    const token = getCookie(c, 'access_token')
    if (!token) {
      throw ErrorFactory.unauthorized('Authentication required')
    }


    // Verify token and get user info
    const decoded = authService.verifyAccessToken(token)
    if (!decoded) {
      throw ErrorFactory.unauthorized('Invalid or expired token')
    }

    // Get full user object from database
    const user = await authRepository.getUserById(decoded.userId)
    if (!user) {
      throw ErrorFactory.notFound('User', decoded.userId)
    }

    if (!user.isActive) {
      throw ErrorFactory.forbidden('User account', 'access')
    }

    return c.json(successResponse({ user }), 200)
  } catch (error) {
    throw error
  }
})

/**
 * CSRF token handler
 */
authRoutes.openapi(csrfTokenRoute, getCsrfTokenHandler)

// Export route registration function
export function registerAuthRoutes(app: OpenAPIHono) {
  app.route('/', authRoutes)
}

export type AuthRoutesType = typeof authRoutes
