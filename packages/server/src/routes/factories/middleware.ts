/**
 * Shared Middleware for Routes
 * 
 * Provides reusable middleware functions for:
 * - Authentication
 * - Rate limiting
 * - Logging
 * - Request validation
 * - CORS handling
 */

import type { Context } from 'hono'
import { ErrorFactory } from '@promptliano/shared'

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  requests: number      // Number of requests allowed
  window: number       // Time window in seconds
  keyGenerator?: (c: Context) => string  // Function to generate rate limit key
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  required?: boolean
  roles?: string[]
  permissions?: string[]
}

/**
 * Logging middleware
 * Logs request details and response time
 */
export const loggingMiddleware = async (c: Context, next: () => Promise<void>) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  
  console.log(`[${new Date().toISOString()}] ${method} ${path} - Request started`)
  
  await next()
  
  const duration = Date.now() - start
  const status = c.res.status
  
  console.log(`[${new Date().toISOString()}] ${method} ${path} - ${status} - ${duration}ms`)
}

/**
 * Authentication middleware
 * Validates JWT tokens and checks permissions
 */
export const authMiddleware = (config: AuthConfig = {}) => {
  return async (c: Context, next: () => Promise<void>) => {
    // Get authorization header
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader && config.required !== false) {
      throw ErrorFactory.unauthorized('No authorization header provided')
    }
    
    if (authHeader) {
      // Extract token
      const token = authHeader.replace('Bearer ', '')
      
      if (!token) {
        throw ErrorFactory.unauthorized('Invalid authorization header format')
      }
      
      // TODO: Implement actual JWT validation here
      // For now, we'll just check if a token exists
      // In production, validate with your auth service
      
      // Set user context (mock for now)
      c.set('user', {
        id: 'user-123',
        roles: ['user'],
        permissions: ['read', 'write']
      })
      
      // Check roles if specified
      if (config.roles && config.roles.length > 0) {
        const userRoles = c.get('user')?.roles || []
        const hasRole = config.roles.some(role => userRoles.includes(role))
        
        if (!hasRole) {
          throw ErrorFactory.forbidden('user roles', 'access')
        }
      }
      
      // Check permissions if specified
      if (config.permissions && config.permissions.length > 0) {
        const userPermissions = c.get('user')?.permissions || []
        const hasPermission = config.permissions.every(perm => userPermissions.includes(perm))
        
        if (!hasPermission) {
          throw ErrorFactory.forbidden('user permissions', 'access')
        }
      }
    }
    
    await next()
  }
}

/**
 * Rate limiting middleware
 * Limits requests per time window
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export const rateLimitMiddleware = (config: RateLimitConfig) => {
  const { requests, window, keyGenerator } = config
  
  return async (c: Context, next: () => Promise<void>) => {
    // Generate rate limit key
    const key = keyGenerator 
      ? keyGenerator(c)
      : c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'global'
    
    const now = Date.now()
    const windowMs = window * 1000
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)
    
    if (!entry || entry.resetTime <= now) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + windowMs
      }
    }
    
    // Check if limit exceeded
    if (entry.count >= requests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      
      c.header('X-RateLimit-Limit', requests.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', entry.resetTime.toString())
      c.header('Retry-After', retryAfter.toString())
      
      c.status(429)
      c.json({
        success: false,
        error: 'Too many requests',
        retryAfter
      })
      return // Early return without calling next()
    }
    
    // Increment counter
    entry.count++
    rateLimitStore.set(key, entry)
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', requests.toString())
    c.header('X-RateLimit-Remaining', (requests - entry.count).toString())
    c.header('X-RateLimit-Reset', entry.resetTime.toString())
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      cleanupRateLimitStore()
    }
    
    await next()
  }
}

/**
 * Cleanup expired rate limit entries
 */
function cleanupRateLimitStore() {
  const now = Date.now()
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing
 */
export const corsMiddleware = (origins: string[] = ['*']) => {
  return async (c: Context, next: () => Promise<void>) => {
    const origin = c.req.header('Origin') || ''
    
    // Check if origin is allowed
    const isAllowed = origins.includes('*') || origins.includes(origin)
    
    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin || '*')
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
      c.header('Access-Control-Allow-Credentials', 'true')
      c.header('Access-Control-Max-Age', '86400')
    }
    
    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      c.status(204)
      return c.body(null)
    }
    
    await next()
  }
}

/**
 * Request ID middleware
 * Adds a unique request ID for tracing
 */
export const requestIdMiddleware = async (c: Context, next: () => Promise<void>) => {
  const requestId = c.req.header('X-Request-ID') || generateRequestId()
  
  c.set('requestId', requestId)
  c.header('X-Request-ID', requestId)
  
  await next()
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Timeout middleware
 * Adds request timeout handling
 */
export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return async (c: Context, next: () => Promise<void>) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })
    
    try {
      await Promise.race([
        next(),
        timeoutPromise
      ])
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return c.json(
          {
            success: false,
            error: 'Request timeout'
          },
          408
        )
      }
      throw error
    }
  }
}

/**
 * Compression middleware
 * Enables response compression
 */
export const compressionMiddleware = async (c: Context, next: () => Promise<void>) => {
  const acceptEncoding = c.req.header('Accept-Encoding') || ''
  
  await next()
  
  // Check if client supports compression
  if (acceptEncoding.includes('gzip')) {
    c.header('Content-Encoding', 'gzip')
    // Note: Actual compression would be handled by the server/proxy
  }
}

/**
 * Security headers middleware
 * Adds security-related headers
 */
export const securityHeadersMiddleware = async (c: Context, next: () => Promise<void>) => {
  await next()
  
  // Security headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  )
}

/**
 * Cache control middleware
 * Sets appropriate cache headers
 */
export const cacheMiddleware = (maxAge: number = 0, sMaxAge?: number) => {
  return async (c: Context, next: () => Promise<void>) => {
    await next()
    
    if (c.req.method === 'GET') {
      if (maxAge > 0) {
        const cacheControl = [`max-age=${maxAge}`]
        
        if (sMaxAge !== undefined) {
          cacheControl.push(`s-maxage=${sMaxAge}`)
        }
        
        c.header('Cache-Control', cacheControl.join(', '))
      } else {
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
        c.header('Pragma', 'no-cache')
        c.header('Expires', '0')
      }
    }
  }
}

/**
 * API key validation middleware
 */
export const apiKeyMiddleware = (validKeys: string[] | ((key: string) => boolean)) => {
  return async (c: Context, next: () => Promise<void>) => {
    const apiKey = c.req.header('X-API-Key')
    
    if (!apiKey) {
      throw ErrorFactory.unauthorized('API key required')
    }
    
    const isValid = Array.isArray(validKeys)
      ? validKeys.includes(apiKey)
      : validKeys(apiKey)
    
    if (!isValid) {
      throw ErrorFactory.unauthorized('Invalid API key')
    }
    
    await next()
  }
}

/**
 * Compose multiple middleware functions
 */
export function composeMiddleware(
  ...middleware: Array<(c: Context, next: () => Promise<void>) => Promise<void>>
): (c: Context, next: () => Promise<void>) => Promise<void> {
  return async (c: Context, next: () => Promise<void>) => {
    let index = 0
    
    const dispatch = async (): Promise<void> => {
      if (index >= middleware.length) {
        return next()
      }
      
      const mw = middleware[index++]
      return mw(c, dispatch)
    }
    
    return dispatch()
  }
}