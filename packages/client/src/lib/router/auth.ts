import { redirect } from '@tanstack/react-router'
import type { ParsedLocation } from '@tanstack/react-router'
import { jwtDecode } from 'jwt-decode'
import type { User } from '@promptliano/api-client'
import { normalizeAuthStatus } from '@/routes/__root'

/**
 * JWT payload interface
 */
interface JWTPayload {
  sub: string // User ID
  username: string
  role: 'admin' | 'user'
  exp: number // Expiration timestamp
  iat: number // Issued at timestamp
}

/**
 * Authentication state interface
 */
export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  accessToken?: string
}

/**
 * Storage keys for tokens
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'promptliano_access_token',
  REFRESH_TOKEN: 'promptliano_refresh_token',
  USER: 'promptliano_user'
} as const

/**
 * Get current authentication state
 * Validates JWT tokens and returns user information
 */
export function getAuthState(): AuthState {
  try {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    const userStr = localStorage.getItem(STORAGE_KEYS.USER)

    if (!accessToken || !userStr) {
      return {
        isAuthenticated: false,
        user: null
      }
    }

    // Verify token is not expired
    const decoded = jwtDecode<JWTPayload>(accessToken)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      // Token expired - clear auth data
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.USER)
      return {
        isAuthenticated: false,
        user: null
      }
    }

    // Token is valid
    const user = JSON.parse(userStr) as User
    return {
      isAuthenticated: true,
      user,
      accessToken
    }
  } catch (error) {
    console.error('Error getting auth state:', error)
    return {
      isAuthenticated: false,
      user: null
    }
  }
}

/**
 * beforeLoad function to check authentication
 * Redirects to setup if needed, then to login if not authenticated
 */
export async function requireAuth({
  location,
  context
}: {
  location: ParsedLocation
  context: Record<string, unknown>
}) {
  // CRITICAL: Use cached setup status from React Query (no API calls!)
  const authContext = context as any
  if (authContext.queryClient) {
    try {
      // Use cached value only - this was already checked in root route
      const cachedStatus = authContext.queryClient.getQueryData(['auth', 'full-status'])
      const normalizedStatus = cachedStatus ? normalizeAuthStatus(cachedStatus) : undefined

      if (normalizedStatus?.data.needsSetup === true) {
        console.log('[requireAuth] Setup needed (from cache), redirecting to /setup')
        throw redirect({
          to: '/setup'
        })
      }
    } catch (error) {
      // If error is a redirect, rethrow it
      if (error && typeof error === 'object' && 'to' in error) {
        throw error
      }
      console.error('[requireAuth] Error checking cached setup status:', error)
    }
  }

  // Then check authentication
  const auth = getAuthState()

  if (!auth.isAuthenticated) {
    throw redirect({
      to: '/login',
      search: {
        redirect: location.href
      }
    })
  }

  // Return auth state to be merged into context
  return {
    auth
  }
}

/**
 * beforeLoad function for admin-only routes
 * Redirects to setup if needed, then checks authentication and admin role
 */
export async function requireAdmin({
  location,
  context
}: {
  location: ParsedLocation
  context: Record<string, unknown>
}) {
  // CRITICAL: Use cached setup status from React Query (no API calls!)
  const authContext = context as any
  if (authContext.queryClient) {
    try {
      // Use cached value only - this was already checked in root route
      const cachedStatus = authContext.queryClient.getQueryData(['auth', 'full-status'])
      const normalizedStatus = cachedStatus ? normalizeAuthStatus(cachedStatus) : undefined

      if (normalizedStatus?.data.needsSetup === true) {
        console.log('[requireAdmin] Setup needed (from cache), redirecting to /setup')
        throw redirect({
          to: '/setup'
        })
      }
    } catch (error) {
      // If error is a redirect, rethrow it
      if (error && typeof error === 'object' && 'to' in error) {
        throw error
      }
      console.error('[requireAdmin] Error checking cached setup status:', error)
    }
  }

  // Then check authentication
  const auth = getAuthState()

  if (!auth.isAuthenticated) {
    throw redirect({
      to: '/login',
      search: {
        redirect: location.href
      }
    })
  }

  // Check for admin role
  if (auth.user?.role !== 'admin') {
    throw redirect({
      to: '/projects'
    })
  }

  return {
    auth: {
      ...auth,
      isAdmin: true
    }
  }
}

/**
 * Helper to check if user has specific permissions
 */
export function hasPermission(auth: AuthState, permission: string): boolean {
  if (!auth.isAuthenticated || !auth.user) return false

  // Admin has all permissions
  if (auth.user.role === 'admin') return true

  // Define permission mappings
  const rolePermissions: Record<string, string[]> = {
    admin: ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
    user: ['read', 'write']
  }

  return rolePermissions[auth.user.role]?.includes(permission) || false
}
