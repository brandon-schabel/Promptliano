/**
 * Authentication Repository - Database operations for auth system
 * Provides user management, refresh tokens, and auth settings operations
 * Following Promptliano's functional repository pattern
 */

import { eq, and, count, lte } from 'drizzle-orm'
import { db } from '../db'
import {
  users,
  refreshTokens,
  authSettings,
  type User,
  type RefreshToken,
  type AuthSettings,
  type InsertUser,
  type InsertRefreshToken,
  type InsertAuthSettings
} from '../schema'

/**
 * Authentication Repository
 * Handles all database operations for authentication
 */
export const createAuthRepository = (dbInstance = db) => ({
  // =============================================================================
  // USER OPERATIONS
  // =============================================================================

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    const [user] = await dbInstance
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return user || null
  },

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await dbInstance
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    return user || null
  },

  /**
   * Create a new user
   */
  async createUser(data: {
    username: string
    email?: string | null
    passwordHash?: string | null
    role?: 'admin' | 'user'
  }): Promise<User> {
    const now = Date.now()
    const [user] = await dbInstance
      .insert(users)
      .values({
        ...data,
        role: data.role || 'user',
        isActive: true,
        createdAt: now,
        updatedAt: now
      })
      .returning()

    if (!user) {
      throw new Error('Failed to create user')
    }

    return user
  },

  /**
   * Update user
   */
  async updateUser(id: number, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const [user] = await dbInstance
      .update(users)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(users.id, id))
      .returning()

    if (!user) {
      throw new Error(`User with id ${id} not found`)
    }

    return user
  },

  /**
   * Delete user
   */
  async deleteUser(id: number): Promise<boolean> {
    const result = await dbInstance
      .delete(users)
      .where(eq(users.id, id))

    return (result as any).changes > 0
  },

  /**
   * List all users
   */
  async listUsers(): Promise<User[]> {
    return await dbInstance
      .select()
      .from(users)
      .orderBy(users.createdAt)
  },

  /**
   * Check if any users exist (for first-time setup)
   */
  async hasAnyUsers(): Promise<boolean> {
    const [result] = await dbInstance
      .select({ count: count() })
      .from(users)

    return (result?.count || 0) > 0
  },

  /**
   * Count admin users (prevent deleting last admin)
   */
  async countAdmins(): Promise<number> {
    const [result] = await dbInstance
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'admin'))

    return result?.count || 0
  },

  // =============================================================================
  // REFRESH TOKEN OPERATIONS
  // =============================================================================

  /**
   * Create refresh token
   */
  async createRefreshToken(
    userId: number,
    token: string,
    expiresAt: number
  ): Promise<RefreshToken> {
    const now = Date.now()
    const [refreshToken] = await dbInstance
      .insert(refreshTokens)
      .values({
        userId,
        token,
        expiresAt,
        createdAt: now
      })
      .returning()

    if (!refreshToken) {
      throw new Error('Failed to create refresh token')
    }

    return refreshToken
  },

  /**
   * Get refresh token
   */
  async getRefreshToken(token: string): Promise<RefreshToken | null> {
    const [refreshToken] = await dbInstance
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1)

    return refreshToken || null
  },

  /**
   * Get refresh token with user relation
   */
  async getRefreshTokenWithUser(token: string): Promise<(RefreshToken & { user: User }) | null> {
    const result = await dbInstance
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        token: refreshTokens.token,
        expiresAt: refreshTokens.expiresAt,
        createdAt: refreshTokens.createdAt,
        user: users
      })
      .from(refreshTokens)
      .innerJoin(users, eq(refreshTokens.userId, users.id))
      .where(eq(refreshTokens.token, token))
      .limit(1)

    if (!result[0]) return null

    const { user, ...tokenData } = result[0]
    return { ...tokenData, user }
  },

  /**
   * Delete refresh token
   */
  async deleteRefreshToken(token: string): Promise<boolean> {
    const result = await dbInstance
      .delete(refreshTokens)
      .where(eq(refreshTokens.token, token))

    return (result as any).changes > 0
  },

  /**
   * Delete all user refresh tokens
   */
  async deleteUserRefreshTokens(userId: number): Promise<number> {
    const result = await dbInstance
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId))

    return (result as any).changes || 0
  },

  /**
   * Delete expired tokens
   */
  async deleteExpiredTokens(): Promise<number> {
    const now = Date.now()
    const result = await dbInstance
      .delete(refreshTokens)
      .where(lte(refreshTokens.expiresAt, now))

    return (result as any).changes || 0
  },

  // =============================================================================
  // AUTH SETTINGS OPERATIONS
  // =============================================================================

  /**
   * Get auth settings (singleton)
   */
  async getAuthSettings(): Promise<AuthSettings | null> {
    const [settings] = await dbInstance
      .select()
      .from(authSettings)
      .limit(1)

    return settings || null
  },

  /**
   * Update or create auth settings
   */
  async updateAuthSettings(data: Partial<Omit<AuthSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AuthSettings> {
    const existing = await this.getAuthSettings()
    const now = Date.now()

    if (existing) {
      // Update existing
      const [updated] = await dbInstance
        .update(authSettings)
        .set({
          ...data,
          updatedAt: now
        })
        .where(eq(authSettings.id, existing.id))
        .returning()

      if (!updated) {
        throw new Error('Failed to update auth settings')
      }

      return updated
    } else {
      // Create new
      const [created] = await dbInstance
        .insert(authSettings)
        .values({
          authEnabled: data.authEnabled ?? true,
          requirePassword: data.requirePassword ?? false,
          sessionTimeout: data.sessionTimeout ?? 604800000, // 7 days default
          createdAt: now,
          updatedAt: now
        })
        .returning()

      if (!created) {
        throw new Error('Failed to create auth settings')
      }

      return created
    }
  },

  /**
   * Initialize auth settings with defaults
   */
  async initializeAuthSettings(): Promise<AuthSettings> {
    const existing = await this.getAuthSettings()
    if (existing) return existing

    const now = Date.now()
    const [settings] = await dbInstance
      .insert(authSettings)
      .values({
        authEnabled: true,
        requirePassword: false,
        sessionTimeout: 604800000, // 7 days in milliseconds
        createdAt: now,
        updatedAt: now
      })
      .returning()

    if (!settings) {
      throw new Error('Failed to initialize auth settings')
    }

    return settings
  }
})

// Export singleton instance
export const authRepository = createAuthRepository()

// Export factory for testing
export { createAuthRepository as createAuthRepositoryFactory }