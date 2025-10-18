import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import {
  createAuthClient,
  type User,
  type AuthClient,
  type AuthStatusResponse,
  type AuthStatusData
} from '@promptliano/api-client'
import { DEFAULT_AUTH_SETTINGS, normalizeAuthStatus } from '@/routes/__root'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { clearCsrfToken } from '@/lib/csrf'
import { useQueryClient } from '@tanstack/react-query'
import { withTimeout, isNetworkError } from '@/lib/system/network'
import { CONNECTION_QUERY_KEY, ConnectionSnapshot } from '@/lib/system/connection-status'

/**
 * Auth context interface - PASSWORD REQUIRED
 */
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  needsSetup: boolean
  authClient: AuthClient
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setupFirstUser: (username: string, password: string, email?: string) => Promise<void>
  refreshAuth: () => Promise<void>
  checkSetupStatus: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

/**
 * Storage keys (tokens are now in httpOnly cookies, NOT localStorage)
 */
const STORAGE_KEYS = {
  USER: 'promptliano_user' // Only store user data (non-sensitive) in localStorage
} as const

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: React.ReactNode
  serverUrl?: string
}

/**
 * AuthProvider component
 * Manages authentication state using httpOnly cookies
 * Tokens are stored securely in httpOnly cookies by the server
 */
export function AuthProvider({
  children,
  serverUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3147'
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const authClientRef = useRef<AuthClient>(createAuthClient(serverUrl))

  // CRITICAL: Access React Query to use cached auth status
  const queryClient = useQueryClient()

  const connectionSnapshot = queryClient.getQueryData<ConnectionSnapshot>(CONNECTION_QUERY_KEY)
  const isOffline = connectionSnapshot?.status && connectionSnapshot.status !== 'connected'

  /**
   * Store user data in localStorage (no tokens!)
   */
  const storeUserData = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData))
    setUser(userData)
  }, [])

  /**
   * Clear auth data from localStorage
   */
  const clearAuthData = useCallback(() => {
    // Clear old token storage (migration cleanup)
    localStorage.removeItem('promptliano_access_token')
    localStorage.removeItem('promptliano_refresh_token')
    localStorage.removeItem(STORAGE_KEYS.USER)
    setUser(null)
  }, [])

  /**
   * Setup token refresh interval
   * Checks every 5 minutes and refreshes token using httpOnly cookie
   */
  const setupTokenRefresh = useCallback(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    refreshIntervalRef.current = setInterval(
      async () => {
        try {
          // Server will use httpOnly cookie to refresh tokens
          const response = await authClientRef.current.refreshToken()

          // Update stored user data if changed
          if (response.data?.user) {
            storeUserData(response.data.user)
          }

          console.log('Token refreshed successfully')
        } catch (error) {
          console.error('Token refresh failed:', error)
          // Session expired - logout
          await logout()
        }
      },
      5 * 60 * 1000
    ) // Every 5 minutes
  }, [])

  /**
   * First-time setup - create admin user
   * PASSWORD REQUIRED - all accounts must have passwords
   */
  const setupFirstUser = useCallback(
    async (username: string, password: string, email?: string) => {
      try {
        const response = await authClientRef.current.setup({
          username,
          password,
          email
        })

        // Server sets httpOnly cookies automatically
        // We only store non-sensitive user data
        if (response.data?.user) {
          storeUserData(response.data.user)
        }
        setupTokenRefresh()
        toast.success('Account created successfully!')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Setup failed'
        toast.error(errorMessage)
        throw error
      }
    },
    [storeUserData, setupTokenRefresh]
  )

  /**
   * Login with username and password
   * PASSWORD REQUIRED - all users must authenticate with password
   */
  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const response = await authClientRef.current.login({
          username,
          password
        })

        // Server sets httpOnly cookies automatically
        // We only store non-sensitive user data
        if (response.data?.user) {
          storeUserData(response.data.user)
        }
        setupTokenRefresh()
        toast.success('Logged in successfully!')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed'
        toast.error(errorMessage)
        throw error
      }
    },
    [storeUserData, setupTokenRefresh]
  )

  /**
   * Logout and clear auth data
   * Redirects to /login after successful logout
   */
  const logout = useCallback(async () => {
    try {
      // Server will clear httpOnly cookies
      await authClientRef.current.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local user data
      clearAuthData()
      clearCsrfToken()

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }

      // Clear React Query cache
      queryClient.clear()

      toast.success('Logged out successfully')

      // Redirect to login page
      // Using window.location for full page reload to clear all state
      window.location.href = '/login'
    }
  }, [clearAuthData, queryClient])

  /**
   * Manual auth refresh
   */
  const refreshAuth = useCallback(async () => {
    try {
      // Server handles refresh using httpOnly cookies
      const response = await authClientRef.current.refreshToken()

      if (response.data?.user) {
        storeUserData(response.data.user)
      }
    } catch (error) {
      await logout()
    }
  }, [storeUserData, logout])

  /**
   * Check setup status (for manual checks)
   * Uses cached data from React Query
   */
  const checkSetupStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Use cached auth status first
      const cachedAuthStatus = queryClient.getQueryData(['auth', 'full-status'])
      const normalizedCache = cachedAuthStatus ? normalizeAuthStatus(cachedAuthStatus) : undefined

      if (normalizedCache !== undefined) {
        console.log('[checkSetupStatus] Using cached status:', normalizedCache.data.needsSetup)
        const needsSetupValue = normalizedCache.data.needsSetup
        setNeedsSetup(needsSetupValue)
        return needsSetupValue
      }

      // If no cache, fetch fresh (rare case)
      console.log('[checkSetupStatus] No cache, fetching fresh status')
      const response = await authClientRef.current.getAuthStatus()
      const normalizedStatus = normalizeAuthStatus(response)

      const needsSetupValue = normalizedStatus.data.needsSetup
      setNeedsSetup(needsSetupValue)

      // Update cache
      queryClient.setQueryData(['auth', 'full-status'], normalizedStatus)
      queryClient.setQueryData(['auth', 'setup-status'], needsSetupValue)

      return needsSetupValue
    } catch (error) {
      console.error('[checkSetupStatus] Failed to check setup status:', error)
      setNeedsSetup(false)
      return false
    }
  }, [queryClient])

  /**
   * Initialize auth state from localStorage
   * OPTIMIZED: Uses cached status from React Query (NO API calls!)
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // CRITICAL: Use cached auth status from React Query (root route already fetched it)
        const cachedAuthStatus = queryClient.getQueryData(['auth', 'full-status'])
        const normalizedStatus = cachedAuthStatus ? normalizeAuthStatus(cachedAuthStatus) : undefined

        if (!normalizedStatus) {
          if (isOffline) {
            setIsLoading(false)
            return
          }
          console.log('[AuthContext] No cached auth status, waiting for root route to load')
          setIsLoading(false)
          return
        }

        console.log('[AuthContext] Using cached auth status:', normalizedStatus)
        const needsSetupValue = normalizedStatus.data.needsSetup
        setNeedsSetup(needsSetupValue)

        if (needsSetupValue) {
          console.log('[AuthContext] Setup required - skipping auth initialization')
          setIsLoading(false)
          return
        }

        // Setup complete - proceed with normal auth flow
        // Verify session with server (don't trust localStorage alone)
        try {
          if (isOffline) {
            setIsLoading(false)
            return
          }
          const response = await withTimeout(authClientRef.current.getCurrentUser(), 6000)
          if (response.data?.user) {
            storeUserData(response.data.user)
            setupTokenRefresh()
          } else {
            clearAuthData()
          }
        } catch (error) {
          if (isNetworkError(error)) {
            console.warn('[AuthContext] Session verification skipped due to offline state')
          } else {
            console.log('[AuthContext] Session verification failed, clearing auth data')
            clearAuthData()
          }
        }
      } catch (error) {
        // Setup status check failed
        if (isNetworkError(error) || isOffline) {
          console.warn('[AuthContext] Initialization skipped due to offline state')
        } else {
          console.error('[AuthContext] Initialization error:', error)
          clearAuthData()
          setNeedsSetup(true)
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Only run once on mount
    initAuth()

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [isOffline, queryClient]) // Depend on queryClient

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    needsSetup,
    authClient: authClientRef.current,
    login,
    logout,
    setupFirstUser,
    refreshAuth,
    checkSetupStatus
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
