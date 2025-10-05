/**
 * Admin Routes - User management endpoints (admin only)
 *
 * Provides admin-only user management operations
 * following Promptliano's Hono OpenAPI patterns.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import { ApiErrorResponseSchema } from '@promptliano/schemas'
import { authRepository, type User } from '@promptliano/database'
import { authService } from '@promptliano/services'
import { ErrorFactory } from '@promptliano/shared'
import { selectUserSchema } from '@promptliano/database'
import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { rateLimiters } from '../middleware/rate-limiter'

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

// ID params schema
const UserIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
}).openapi('UserIdParams')

// Create user request schema
const CreateUserRequestSchema = z.object({
  username: z.string().min(3).max(255),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional().default('user')
}).openapi('CreateUserRequest')

// Update user request schema
const UpdateUserRequestSchema = z.object({
  username: z.string().min(3).max(255).optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional(),
  isActive: z.boolean().optional()
}).openapi('UpdateUserRequest')

// User response schema
const UserResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: selectUserSchema
  })
}).openapi('AdminUserResponse')

// User list response schema
const UserListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    users: z.array(selectUserSchema)
  })
}).openapi('UserListResponse')

// Delete response schema
const DeleteUserResponseSchema = z.object({
  success: z.literal(true),
  message: z.string()
}).openapi('DeleteUserResponse')

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Helper to get authenticated admin user from request
 * Uses httpOnly cookie-based authentication for security
 */
async function getAuthenticatedAdmin(c: Context): Promise<User> {
  // Extract token from httpOnly cookie (consistent with auth flow)
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

  if (user.role !== 'admin') {
    throw ErrorFactory.forbidden('Admin access required', 'perform this action')
  }

  return user
}

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

/**
 * GET /api/admin/users - List all users
 */
const listUsersRoute = createRoute({
  method: 'get',
  path: '/api/admin/users',
  tags: ['Admin', 'Users'],
  summary: 'List all users (admin only)',
  description: 'Get a list of all users in the system',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: UserListResponseSchema } },
      description: 'Users retrieved successfully'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Not authenticated'
    },
    403: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Admin access required'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * POST /api/admin/users - Create user
 */
const createUserRoute = createRoute({
  method: 'post',
  path: '/api/admin/users',
  tags: ['Admin', 'Users'],
  summary: 'Create a new user (admin only)',
  description: 'Create a new user with specified role and credentials',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserRequestSchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'User created successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid input'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Not authenticated'
    },
    403: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Admin access required'
    },
    409: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Username already exists'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

/**
 * PUT /api/admin/users/:id - Update user
 */
const updateUserRoute = createRoute({
  method: 'put',
  path: '/api/admin/users/{id}',
  tags: ['Admin', 'Users'],
  summary: 'Update user (admin only)',
  description: 'Update user information. Cannot modify own role or deactivate self.',
  security: [{ bearerAuth: [] }],
  request: {
    params: UserIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateUserRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'User updated successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid input or operation'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Not authenticated'
    },
    403: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Admin access required or forbidden operation'
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
 * DELETE /api/admin/users/:id - Delete user
 */
const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/api/admin/users/{id}',
  tags: ['Admin', 'Users'],
  summary: 'Delete user (admin only)',
  description: 'Delete a user. Cannot delete self or last admin.',
  security: [{ bearerAuth: [] }],
  request: {
    params: UserIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteUserResponseSchema } },
      description: 'User deleted successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Cannot delete self or last admin'
    },
    401: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Not authenticated'
    },
    403: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Admin access required'
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

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export const adminRoutes = new OpenAPIHono()

// Apply rate limiter to all admin routes (100 requests per 15 minutes)
adminRoutes.use('*', rateLimiters.admin)

/**
 * List all users handler
 */
adminRoutes.openapi(listUsersRoute, async (c) => {
  try {
    // Verify admin access
    await getAuthenticatedAdmin(c)

    const users = await authRepository.listUsers()
    return c.json(successResponse({ users }), 200)
  } catch (error) {
    throw error
  }
})

/**
 * Create user handler
 */
adminRoutes.openapi(createUserRoute, async (c) => {
  const { username, email, password, role } = c.req.valid('json')

  try {
    // Verify admin access
    await getAuthenticatedAdmin(c)

    // Check if username already exists
    const existingUser = await authRepository.getUserByUsername(username)
    if (existingUser) {
      throw ErrorFactory.conflict(`User with username '${username}' already exists`)
    }

    // Hash password if provided
    let passwordHash: string | null = null
    if (password) {
      passwordHash = await authService.hashPassword(password)
    }

    // Create user
    const user = await authRepository.createUser({
      username,
      email: email || null,
      passwordHash,
      role: role || 'user'
    })

    return c.json(successResponse({ user }), 201)
  } catch (error) {
    throw error
  }
})

/**
 * Update user handler
 */
adminRoutes.openapi(updateUserRoute, async (c) => {
  const { id } = c.req.valid('param')
  const updateData = c.req.valid('json')

  try {
    // Verify admin access and get current user
    const currentUser = await getAuthenticatedAdmin(c)

    // Get user to update
    const user = await authRepository.getUserById(id)
    if (!user) {
      throw ErrorFactory.notFound('User', id)
    }

    // Validation: Cannot modify own role
    if (currentUser.id === id && updateData.role && updateData.role !== user.role) {
      throw ErrorFactory.forbidden('Cannot modify your own role', 'update')
    }

    // Validation: Cannot deactivate self
    if (currentUser.id === id && updateData.isActive === false) {
      throw ErrorFactory.forbidden('Cannot deactivate your own account', 'update')
    }

    // Validation: Cannot remove last admin
    if (updateData.role && updateData.role !== 'admin' && user.role === 'admin') {
      const adminCount = await authRepository.countAdmins()
      if (adminCount <= 1) {
        throw ErrorFactory.businessRuleViolation(
          'Cannot change role of last admin',
          'At least one admin user must exist'
        )
      }
    }

    // Hash password if provided
    let dataToUpdate: any = { ...updateData }
    if (updateData.password) {
      dataToUpdate.passwordHash = await authService.hashPassword(updateData.password)
      delete dataToUpdate.password
    }

    // Update user
    const updatedUser = await authRepository.updateUser(id, dataToUpdate)

    return c.json(successResponse({ user: updatedUser }), 200)
  } catch (error) {
    throw error
  }
})

/**
 * Delete user handler
 */
adminRoutes.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.valid('param')

  try {
    // Verify admin access and get current user
    const currentUser = await getAuthenticatedAdmin(c)

    // Get user to delete
    const user = await authRepository.getUserById(id)
    if (!user) {
      throw ErrorFactory.notFound('User', id)
    }

    // Validation: Cannot delete self
    if (currentUser.id === id) {
      throw ErrorFactory.forbidden('Cannot delete your own account', 'delete')
    }

    // Validation: Cannot delete last admin
    if (user.role === 'admin') {
      const adminCount = await authRepository.countAdmins()
      if (adminCount <= 1) {
        throw ErrorFactory.businessRuleViolation(
          'Cannot delete last admin',
          'At least one admin user must exist'
        )
      }
    }

    // Delete user (cascade will delete refresh tokens)
    const deleted = await authRepository.deleteUser(id)

    if (!deleted) {
      throw ErrorFactory.deleteFailed('User', id, 'No rows affected')
    }

    return c.json({
      success: true as const,
      message: 'User deleted successfully'
    }, 200)
  } catch (error) {
    throw error
  }
})

// Export route registration function
export function registerAdminRoutes(app: OpenAPIHono) {
  app.route('/', adminRoutes)
}

export type AdminRoutesType = typeof adminRoutes
