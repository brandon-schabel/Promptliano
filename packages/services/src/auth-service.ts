/**
 * Auth Service - Functional Factory Pattern
 *
 * Provides authentication, JWT token management, and password hashing
 * using bcrypt and jsonwebtoken.
 *
 * Features:
 * - Password hashing with bcrypt (10 rounds)
 * - JWT access token generation (15 min expiry)
 * - Secure refresh token generation (32 bytes hex)
 * - Token verification and validation
 * - First-time setup support
 * - Passwordless mode support
 * - Session management with token rotation
 */

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { authRepository } from '@promptliano/database'
import type { User, RefreshToken, AuthSettings } from '@promptliano/database'
import { withErrorContext, createServiceLogger } from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'

/**
 * Validate JWT secret meets security requirements
 */
function validateJwtSecret(secret: string): void {
  const MIN_SECRET_LENGTH = 32
  const FORBIDDEN_DEFAULTS = [
    'dev-secret-please-change-in-production',
    'secret',
    'password',
    'jwt-secret',
    'change-me'
  ]

  if (!secret) {
    throw new Error(
      'FATAL SECURITY ERROR: JWT_SECRET environment variable is required.\n' +
        'Generate a strong secret with: openssl rand -base64 64\n' +
        'Set in .env: JWT_SECRET=<generated-secret>'
    )
  }

  if (FORBIDDEN_DEFAULTS.some((forbidden) => secret.toLowerCase().includes(forbidden))) {
    throw new Error(
      'FATAL SECURITY ERROR: JWT_SECRET uses a forbidden default value.\n' +
        'This secret is publicly known and MUST be changed.\n' +
        'Generate a strong secret with: openssl rand -base64 64'
    )
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `FATAL SECURITY ERROR: JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.\n` +
        `Current length: ${secret.length}\n` +
        'Generate a strong secret with: openssl rand -base64 64'
    )
  }

  // Calculate entropy (basic check)
  const uniqueChars = new Set(secret.split('')).size
  if (uniqueChars < 16) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET has low entropy (character diversity).\n' +
        'Consider generating a new secret with: openssl rand -base64 64'
    )
  }
}

/**
 * Initialize and validate JWT secret
 */
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET

  // In production, fail fast if secret is missing or weak
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable MUST be set in production.\n' +
          'Server cannot start without a secure JWT secret.'
      )
    }
    validateJwtSecret(secret)
  }

  // In development/test, warn but allow (with secure default)
  if (!secret) {
    console.warn(
      '\n' +
        '═══════════════════════════════════════════════════════════\n' +
        '⚠️  SECURITY WARNING: Using auto-generated JWT secret\n' +
        '═══════════════════════════════════════════════════════════\n' +
        'For development, set JWT_SECRET in .env:\n' +
        '  openssl rand -base64 64 > .jwt-secret\n' +
        '  echo "JWT_SECRET=$(cat .jwt-secret)" >> .env\n' +
        '═══════════════════════════════════════════════════════════\n'
    )

    // Generate a random secret for this session only
    const sessionSecret = crypto.randomBytes(64).toString('base64')
    console.log('Using session secret (will change on restart):', sessionSecret.substring(0, 20) + '...')
    return sessionSecret
  }

  // Validate provided secret
  try {
    validateJwtSecret(secret)
    console.log('✅ JWT_SECRET validated successfully')
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
    console.error('⚠️  JWT_SECRET validation warning:', (error as Error).message)
  }

  return secret
})()

// Export for testing
export function getJwtSecret(): string {
  return JWT_SECRET
}

// JWT configuration
const ACCESS_TOKEN_EXPIRY = '15m' // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const BCRYPT_ROUNDS = 10

// JWT payload structure
export interface JWTPayload {
  userId: number
  username: string
  role: 'admin' | 'user'
  type: 'access'
  iat: number
  exp: number
}

// Service return types
export interface AuthTokens {
  user: User
  accessToken: string
  refreshToken: string
}

// Dependencies interface for dependency injection
export interface AuthServiceDeps {
  repository?: typeof authRepository
  logger?: ReturnType<typeof createServiceLogger>
  jwtSecret?: string
  accessTokenExpiry?: string
  refreshTokenExpiryMs?: number
  bcryptRounds?: number
}

/**
 * Create Auth Service with functional factory pattern
 */
export function createAuthService(deps: AuthServiceDeps = {}) {
  const {
    repository = authRepository,
    logger = createServiceLogger('AuthService'),
    jwtSecret = JWT_SECRET,
    accessTokenExpiry = ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiryMs = REFRESH_TOKEN_EXPIRY_MS,
    bcryptRounds = BCRYPT_ROUNDS
  } = deps

  // =============================================================================
  // PASSWORD MANAGEMENT
  // =============================================================================

  /**
   * Hash password with bcrypt (10 rounds)
   */
  async function hashPassword(password: string): Promise<string> {
    if (!password || password.length === 0) {
      throw ErrorFactory.invalidInput('password', 'non-empty string')
    }
    return await bcrypt.hash(password, bcryptRounds)
  }

  /**
   * Verify password against hash
   */
  async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false
    }
    return await bcrypt.compare(password, hash)
  }

  // =============================================================================
  // JWT TOKEN MANAGEMENT
  // =============================================================================

  /**
   * Generate JWT access token (15 min expiry)
   * Payload: { userId, username, role, type: 'access' }
   */
  function generateAccessToken(user: User): string {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'access' as const
    }

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: '15m',
      algorithm: 'HS256' as const
    }) as string

    return token
  }

  /**
   * Generate secure random refresh token (32 bytes hex)
   */
  function generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Verify and decode JWT access token
   * Returns null if invalid or expired
   */
  function verifyAccessToken(token: string): { userId: number; username: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256']
      }) as JWTPayload

      // Validate payload structure
      if (!decoded.userId || !decoded.username || !decoded.role || decoded.type !== 'access') {
        return null
      }

      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    } catch (error) {
      // Token invalid, expired, or malformed
      logger.debug('Token verification failed', { error })
      return null
    }
  }

  // =============================================================================
  // AUTHENTICATION OPERATIONS
  // =============================================================================

  /**
   * Setup first user as admin
   * Creates user, generates tokens, and stores refresh token
   * PASSWORD IS REQUIRED - no passwordless mode for initial setup
   */
  async function setupFirstUser(username: string, password: string): Promise<AuthTokens> {
    return withErrorContext(
      async () => {
        // Check if any users exist
        const hasUsers = await repository.hasAnyUsers()
        if (hasUsers) {
          throw ErrorFactory.badRequest('Users already exist. Cannot setup first user.')
        }

        // Validate username
        if (!username || username.trim().length === 0) {
          throw ErrorFactory.invalidInput('username', 'non-empty string')
        }

        // Validate password is provided
        if (!password || password.trim().length === 0) {
          throw ErrorFactory.invalidInput('password', 'non-empty string')
        }

        // Hash password (required)
        const passwordHash = await hashPassword(password)

        // Create first user as admin
        const user = await repository.createUser({
          username: username.trim(),
          passwordHash,
          role: 'admin'
        })

        // Generate tokens
        const accessToken = generateAccessToken(user)
        const refreshToken = generateRefreshToken()

        // Store refresh token
        const expiresAt = Date.now() + refreshTokenExpiryMs
        await repository.createRefreshToken(user.id, refreshToken, expiresAt)

        logger.info('First user setup completed', { userId: user.id, username: user.username })

        return {
          user,
          accessToken,
          refreshToken
        }
      },
      { entity: 'Auth', action: 'setupFirstUser' }
    )
  }

  /**
   * Authenticate user with username and password
   * Generates new tokens and stores refresh token
   * PASSWORD IS REQUIRED - all users must have passwords
   */
  async function authenticateUser(username: string, password: string): Promise<AuthTokens> {
    return withErrorContext(
      async () => {
        // Get user by username
        const user = await repository.getUserByUsername(username)
        if (!user) {
          throw ErrorFactory.notFound('User', username)
        }

        // Check if user is active
        if (!user.isActive) {
          throw ErrorFactory.badRequest('User account is inactive')
        }

        // Validate password is provided
        if (!password || password.trim().length === 0) {
          throw ErrorFactory.invalidInput('password', 'non-empty string')
        }

        // User must have a password hash
        if (!user.passwordHash) {
          throw ErrorFactory.badRequest('User account has no password set. Contact administrator.')
        }

        // Verify password
        const isValid = await verifyPassword(password, user.passwordHash)
        if (!isValid) {
          throw ErrorFactory.unauthorized('Invalid password')
        }

        // Generate tokens
        const accessToken = generateAccessToken(user)
        const refreshToken = generateRefreshToken()

        // Store refresh token
        const expiresAt = Date.now() + refreshTokenExpiryMs
        await repository.createRefreshToken(user.id, refreshToken, expiresAt)

        logger.info('User authenticated', { userId: user.id, username: user.username })

        return {
          user,
          accessToken,
          refreshToken
        }
      },
      { entity: 'Auth', action: 'authenticateUser' }
    )
  }

  /**
   * Refresh access token using refresh token
   * Validates refresh token, rotates it, and returns new tokens
   */
  async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    return withErrorContext(
      async () => {
        // Get refresh token with user
        const tokenData = await repository.getRefreshTokenWithUser(refreshToken)
        if (!tokenData) {
          throw ErrorFactory.notFound('Refresh token', 'provided token')
        }

        // Check if token is expired
        if (tokenData.expiresAt < Date.now()) {
          // Delete expired token
          await repository.deleteRefreshToken(refreshToken)
          throw ErrorFactory.unauthorized('Refresh token has expired')
        }

        // Check if user is active
        if (!tokenData.user.isActive) {
          throw ErrorFactory.forbidden('User account', 'access')
        }

        // Delete old refresh token (token rotation)
        await repository.deleteRefreshToken(refreshToken)

        // Generate new tokens
        const newAccessToken = generateAccessToken(tokenData.user)
        const newRefreshToken = generateRefreshToken()

        // Store new refresh token
        const expiresAt = Date.now() + refreshTokenExpiryMs
        await repository.createRefreshToken(tokenData.user.id, newRefreshToken, expiresAt)

        logger.info('Access token refreshed', { userId: tokenData.user.id })

        return {
          user: tokenData.user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      },
      { entity: 'Auth', action: 'refreshAccessToken' }
    )
  }

  /**
   * Logout user by invalidating refresh token
   */
  async function logout(refreshToken: string): Promise<boolean> {
    return withErrorContext(
      async () => {
        const deleted = await repository.deleteRefreshToken(refreshToken)
        if (deleted) {
          logger.info('User logged out')
        }
        return deleted
      },
      { entity: 'Auth', action: 'logout' }
    )
  }

  /**
   * Logout all sessions for a user
   * Invalidates all refresh tokens for the user
   */
  async function logoutAllSessions(userId: number): Promise<number> {
    return withErrorContext(
      async () => {
        const count = await repository.deleteUserRefreshTokens(userId)
        logger.info('All sessions logged out', { userId, count })
        return count
      },
      { entity: 'Auth', action: 'logoutAllSessions', id: userId }
    )
  }

  // =============================================================================
  // AUTH STATUS & SETTINGS
  // =============================================================================

  /**
   * Check if first-time setup is needed (no users exist)
   */
  async function needsSetup(): Promise<boolean> {
    return withErrorContext(
      async () => {
        const hasUsers = await repository.hasAnyUsers()
        return !hasUsers
      },
      { entity: 'Auth', action: 'needsSetup' }
    )
  }

  /**
   * Get global auth settings (initialize if not exists)
   */
  async function getAuthSettings(): Promise<AuthSettings> {
    return withErrorContext(
      async () => {
        let settings = await repository.getAuthSettings()
        if (!settings) {
          // Initialize with defaults
          settings = await repository.initializeAuthSettings()
          logger.info('Auth settings initialized')
        }
        return settings
      },
      { entity: 'Auth', action: 'getAuthSettings' }
    )
  }

  /**
   * Update auth settings
   */
  async function updateAuthSettings(data: Partial<Omit<AuthSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AuthSettings> {
    return withErrorContext(
      async () => {
        const settings = await repository.updateAuthSettings(data)
        logger.info('Auth settings updated', { data })
        return settings
      },
      { entity: 'Auth', action: 'updateAuthSettings' }
    )
  }

  // =============================================================================
  // CLEANUP UTILITIES
  // =============================================================================

  /**
   * Delete expired refresh tokens (cleanup utility)
   */
  async function cleanupExpiredTokens(): Promise<number> {
    return withErrorContext(
      async () => {
        const count = await repository.deleteExpiredTokens()
        if (count > 0) {
          logger.info('Expired tokens cleaned up', { count })
        }
        return count
      },
      { entity: 'Auth', action: 'cleanupExpiredTokens' }
    )
  }

  // Return service interface
  return {
    // Password management
    hashPassword,
    verifyPassword,

    // Token management
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,

    // Authentication operations
    setupFirstUser,
    authenticateUser,
    refreshAccessToken,
    logout,
    logoutAllSessions,

    // Auth status & settings
    needsSetup,
    getAuthSettings,
    updateAuthSettings,

    // Utilities
    cleanupExpiredTokens
  }
}

// Export type for consumers
export type AuthService = ReturnType<typeof createAuthService>

// Export singleton for backward compatibility
export const authService = createAuthService()

// Export individual functions for tree-shaking and backward compatibility
export const {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  setupFirstUser,
  authenticateUser,
  refreshAccessToken,
  logout,
  logoutAllSessions,
  needsSetup,
  getAuthSettings,
  updateAuthSettings,
  cleanupExpiredTokens
} = authService
