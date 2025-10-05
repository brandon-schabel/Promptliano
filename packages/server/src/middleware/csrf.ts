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
  let token = c.get('csrfToken') || getCookie(c, 'csrf_token')

  if (!token) {
    // Generate new token
    token = generateCsrfToken()
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000)
    storeCsrfToken(token, expiresAt)

    // Set cookie so client can read it
    setCookie(c, 'csrf_token', token, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })
  }

  return c.json({ token }, 200)
}
