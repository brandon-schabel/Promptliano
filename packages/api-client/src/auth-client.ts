import { BaseApiClient } from './base-client'

/**
 * User interface matching the auth system
 */
export interface User {
  id: number
  username: string
  email: string | null
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Auth settings interface
 */
export interface AuthSettings {
  requirePassword: boolean
  sessionTimeout: number
  maxLoginAttempts: number
}

/**
 * Auth status response (wrapped in standard response format)
 */
export interface AuthStatusResponse {
  success: true
  data: {
    needsSetup: boolean
    authSettings: AuthSettings
  }
}

/**
 * Auth response with tokens (wrapped in standard response format)
 */
export interface AuthResponse {
  success: true
  data: {
    user: User
    message?: string
  }
}

/**
 * Setup request body
 */
export interface SetupRequest {
  username: string
  password?: string
  email?: string
}

/**
 * Login request body
 */
export interface LoginRequest {
  username: string
  password?: string
}

/**
 * Refresh token request body
 */
export interface RefreshTokenRequest {
  refreshToken: string
}

/**
 * Logout request body
 */
export interface LogoutRequest {
  refreshToken: string
}

/**
 * Create user request body (admin only)
 */
export interface CreateUserRequest {
  username: string
  email?: string
  password?: string
  role?: 'admin' | 'user'
}

/**
 * Update user request body (admin only)
 */
export interface UpdateUserRequest {
  username?: string
  email?: string
  password?: string
  role?: 'admin' | 'user'
  isActive?: boolean
}

/**
 * AuthClient handles all authentication-related API operations
 * Provides type-safe methods for auth, user management, and JWT token handling
 */
export class AuthClient extends BaseApiClient {
  /**
   * Check if setup is needed and get auth settings
   */
  async getAuthStatus(): Promise<AuthStatusResponse> {
    return this.request<AuthStatusResponse>('GET', '/api/auth/status')
  }

  /**
   * First-time setup - create admin user
   */
  async setup(data: SetupRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/auth/setup', { body: data })
  }

  /**
   * Login with username and optional password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/auth/login', { body: data })
  }

  /**
   * Refresh access token using refresh token from httpOnly cookie
   */
  async refreshToken(data?: RefreshTokenRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/auth/refresh', { body: data || {} })
  }

  /**
   * Logout and invalidate refresh token from httpOnly cookie
   */
  async logout(data?: LogoutRequest): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('POST', '/api/auth/logout', { body: data || {} })
  }

  /**
   * Get current user profile
   * Uses httpOnly cookie for authentication
   */
  async getCurrentUser(): Promise<{ success: true; data: { user: User } }> {
    return this.request<{ success: true; data: { user: User } }>('GET', '/api/auth/me')
  }

  /**
   * List all users (admin only)
   * Uses httpOnly cookie for authentication
   */
  async listUsers(): Promise<{ success: true; data: { users: User[] } }> {
    return this.request<{ success: true; data: { users: User[] } }>('GET', '/api/admin/users')
  }

  /**
   * Create a new user (admin only)
   * Uses httpOnly cookie for authentication
   */
  async createUser(data: CreateUserRequest): Promise<{ success: true; data: { user: User } }> {
    return this.request<{ success: true; data: { user: User } }>('POST', '/api/admin/users', {
      body: data
    })
  }

  /**
   * Update an existing user (admin only)
   * Uses httpOnly cookie for authentication
   */
  async updateUser(id: number, data: UpdateUserRequest): Promise<{ success: true; data: { user: User } }> {
    return this.request<{ success: true; data: { user: User } }>('PUT', `/api/admin/users/${id}`, {
      body: data
    })
  }

  /**
   * Delete a user (admin only)
   * Uses httpOnly cookie for authentication
   */
  async deleteUser(id: number): Promise<{ success: true; message?: string }> {
    return this.request<{ success: true; message?: string }>('DELETE', `/api/admin/users/${id}`)
  }
}

/**
 * Create a new AuthClient instance
 */
export function createAuthClient(baseUrl: string): AuthClient {
  return new AuthClient({ baseUrl })
}
