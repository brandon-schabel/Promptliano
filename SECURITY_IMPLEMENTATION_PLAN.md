# 🔒 Promptliano Security Fixes - Implementation Plan

**Created:** 2025-10-04
**Status:** Ready for Implementation
**Total Issues:** 13 vulnerabilities (4 CRITICAL/HIGH P0, 3 HIGH P1, 6 MEDIUM/LOW P2-P3)

---

## 📋 Overview

This document provides a complete implementation plan for all security fixes documented in `SECURITY_FIXES.md`. Each issue is broken down into tickets and tasks with specific agent assignments, file suggestions, and verification steps.

### Implementation Timeline

```
Week 1 (P0 - CRITICAL): 2-3 days
├─ Issue #1: JWT Secret Hardcoded (2h)
├─ Issue #2: localStorage Token Storage (1d)
├─ Issue #3: No Rate Limiting (4h)
└─ Issue #4: Missing CSRF Protection (4h)

Week 2 (P1 - HIGH): 3-4 days
├─ Issue #5: No Token Blacklist (6h)
├─ Issue #6: Timing Attacks (3h)
└─ Issue #7: Client-side Token Expiry (2h)

Month 1 (P2 - MEDIUM): 1 week
├─ Issue #8: Input Sanitization (4h)
├─ Issue #9: Account Lockout (5h)
├─ Issue #10: Sensitive Logging (2h)
└─ Issue #11: Weak Passwords (3h)

Future (P3 - LOW): As needed
├─ Issue #12: Error Message Leaks (2h)
└─ Issue #13: Token Reuse Detection (6h)
```

---

## 🎯 P0 - CRITICAL PRIORITY (Week 1)

### Ticket P0-1: Fix JWT Secret Hardcoded Default

**Priority:** P0 (CRITICAL)
**Severity:** 🔴 10/10
**CVSS:** 9.8 (Critical)
**Estimated Effort:** 2 hours
**Agent:** `promptliano-service-architect`

#### Description
The JWT signing secret defaults to a publicly known hardcoded string. Any attacker can forge admin tokens if the default is used. This is the highest priority security fix.

#### Files Affected
- `/packages/services/src/auth-service.ts` (line 26)
- `/.env.example`
- `/packages/server/src/app.ts`

#### Tasks

**Task 1.1: Implement JWT Secret Validation**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Add `validateJwtSecret()` function with minimum length check (32 chars)
  - Add forbidden defaults list (dev-secret-please-change-in-production, secret, password, etc.)
  - Add entropy calculation for secret quality check
  - Implement IIFE for JWT_SECRET initialization with validation
  - Add production mode strict validation (fail fast)
  - Add development mode warnings with auto-generated session secret
  - Export `getJwtSecret()` for testing
- **Verification:**
  ```bash
  # Test weak secret rejection
  JWT_SECRET="weak" bun run dev  # Should fail

  # Test default secret rejection
  JWT_SECRET="dev-secret-please-change-in-production" bun run dev  # Should fail

  # Test strong secret acceptance
  JWT_SECRET=$(openssl rand -base64 64) bun run dev  # Should succeed
  ```

**Task 1.2: Add Server Startup Security Checks**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 30m
- **Files:**
  - `/packages/server/src/app.ts`
- **Implementation:**
  - Create `performSecurityChecks()` function
  - Check JWT secret validation on startup
  - Add production environment checks (HTTPS, debug mode, secure cookies)
  - Log security check results
  - Fail server startup if critical checks fail in production
- **Verification:**
  ```bash
  # Verify security checks run
  NODE_ENV=production bun run dev  # Should fail without JWT_SECRET
  JWT_SECRET=$(openssl rand -base64 64) NODE_ENV=production bun run dev  # Should pass
  ```

**Task 1.3: Update Environment Configuration Documentation**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 30m
- **Files:**
  - `/.env.example`
- **Implementation:**
  - Add comprehensive JWT secret configuration section
  - Include security warnings and generation instructions
  - Document required environment variables for production
  - Add example values with clear "DO NOT USE IN PRODUCTION" warnings
- **Verification:**
  - Review `.env.example` for clarity and completeness

---

### Ticket P0-2: Migrate from localStorage to httpOnly Cookies

**Priority:** P0 (CRITICAL)
**Severity:** 🔴 9/10
**CVSS:** 8.8 (High)
**Estimated Effort:** 1 day
**Agent:** `promptliano-fullstack-architect` (requires backend + frontend changes)

#### Description
Tokens are currently stored in localStorage, making them accessible to any JavaScript (including XSS attacks). Must migrate to httpOnly cookies which are inaccessible to JavaScript.

#### Files Affected
- `/packages/server/src/routes/auth-routes.ts`
- `/packages/server/src/interceptors/request/auth-interceptor.ts`
- `/packages/client/src/contexts/auth-context.tsx`
- `/packages/client/src/lib/router/auth.ts`
- `/packages/api-client/src/base-client.ts`

#### Tasks

**Task 2.1: Implement Cookie-Based Auth on Server**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 3h
- **Files:**
  - `/packages/server/src/routes/auth-routes.ts`
- **Implementation:**
  - Import Hono cookie utilities (setCookie, getCookie, deleteCookie)
  - Define COOKIE_OPTIONS with httpOnly, secure, sameSite: 'Strict'
  - Define ACCESS_COOKIE_OPTIONS (15min expiry)
  - Define REFRESH_COOKIE_OPTIONS (7d expiry)
  - Update login handler to set cookies instead of returning tokens
  - Update refresh handler to read from cookies
  - Update logout handler to delete cookies
  - Update setup handler to set cookies
  - Return ONLY user data in response bodies (no tokens)
- **Verification:**
  ```bash
  # Test login sets httpOnly cookies
  curl -c cookies.txt -X POST http://localhost:3147/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"password"}'

  # Verify cookies are httpOnly and secure
  cat cookies.txt  # Should show httpOnly flag
  ```

**Task 2.2: Update Auth Interceptor to Read Cookies**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/interceptors/request/auth-interceptor.ts`
- **Implementation:**
  - Import getCookie from Hono
  - Change token extraction from Authorization header to cookie
  - Read access_token from httpOnly cookie
  - Keep existing token validation logic
  - Update error messages for missing cookies
- **Verification:**
  ```bash
  # Test protected route requires cookie
  curl http://localhost:3147/api/protected  # Should fail 401

  # Test with cookie authentication
  curl -b cookies.txt http://localhost:3147/api/protected  # Should succeed
  ```

**Task 2.3: Update Frontend Auth Context for Cookie-Based Auth**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/client/src/contexts/auth-context.tsx`
- **Implementation:**
  - Remove all localStorage token operations
  - Remove STORAGE_KEYS for tokens (keep user only)
  - Update login to expect user data only (no tokens in response)
  - Update logout to call logout endpoint (server clears cookies)
  - Update token refresh to rely on httpOnly cookies
  - Add credentials: 'include' to all API calls
  - Simplify auth state management (no manual token storage)
- **Verification:**
  - Test login flow in browser
  - Verify tokens not in localStorage
  - Verify cookies are httpOnly in DevTools
  - Test logout clears cookies

**Task 2.4: Update API Client for Cookie Credentials**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/api-client/src/base-client.ts`
- **Implementation:**
  - Add credentials: 'include' to all fetch requests
  - Remove Authorization header logic
  - Update error handling for cookie-based auth
  - Handle 401s with automatic redirect to login
- **Verification:**
  ```typescript
  // Verify API calls include credentials
  const response = await api.getProjects()
  // Should automatically send cookies with request
  ```

**Task 2.5: Update Router Auth Guard for Cookie-Based Auth**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/client/src/lib/router/auth.ts`
- **Implementation:**
  - Remove localStorage token checks
  - Rely on API endpoint validation (cookies sent automatically)
  - Update beforeLoad to call auth validation endpoint
  - Simplify route protection logic (server validates cookies)
- **Verification:**
  - Test protected routes redirect to login when not authenticated
  - Test protected routes allow access when authenticated
  - Verify no localStorage usage

**Task 2.6: Add Migration Guide and Cleanup**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 30m
- **Implementation:**
  - Clear existing localStorage tokens on first cookie-based login
  - Add console warning about localStorage migration
  - Update user documentation
- **Verification:**
  - Test migration from localStorage to cookies
  - Verify old tokens are cleared

---

### Ticket P0-3: Implement Rate Limiting on Authentication Endpoints

**Priority:** P0 (CRITICAL)
**Severity:** 🟠 8/10
**CVSS:** 7.5 (High)
**Estimated Effort:** 4 hours
**Agent:** `promptliano-api-architect`

#### Description
Authentication endpoints have no rate limiting, allowing unlimited brute force attacks. Implement IP-based and account-based rate limiting.

#### Files Affected
- `/packages/server/src/routes/auth-routes.ts`
- `/packages/server/src/routes/admin-routes.ts`
- `/packages/server/src/middleware/` (new rate-limit middleware)

#### Tasks

**Task 3.1: Install Rate Limiting Dependencies**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 15m
- **Implementation:**
  ```bash
  cd /Users/brandon/Programming/promptliano
  bun add @hono/rate-limiter
  ```
- **Verification:**
  ```bash
  bun pm ls | grep rate-limiter
  ```

**Task 3.2: Create Rate Limiting Middleware**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/server/src/middleware/rate-limit.ts` (new file)
- **Implementation:**
  - Create strict auth rate limiter (5 attempts per 15 minutes per IP)
  - Create standard API rate limiter (100 requests per minute per IP)
  - Create admin route rate limiter (10 requests per minute per IP)
  - Use in-memory store for development
  - Add Redis support for production (optional, document in comments)
  - Add custom error responses with Retry-After header
  - Add logging for rate limit violations
- **Verification:**
  ```bash
  # Test rate limiting
  for i in {1..6}; do
    curl -X POST http://localhost:3147/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"test","password":"wrong"}'
  done
  # 6th request should return 429 Too Many Requests
  ```

**Task 3.3: Apply Rate Limiting to Auth Routes**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/routes/auth-routes.ts`
- **Implementation:**
  - Apply strictAuthRateLimit to login endpoint
  - Apply strictAuthRateLimit to setup endpoint
  - Apply standardRateLimit to refresh endpoint
  - Apply strictAuthRateLimit to password reset endpoints (if exists)
  - Add rate limit headers to responses
- **Verification:**
  - Test login rate limiting
  - Test rate limit headers in responses
  - Verify different IPs have separate limits

**Task 3.4: Apply Rate Limiting to Admin Routes**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 45m
- **Files:**
  - `/packages/server/src/routes/admin-routes.ts`
- **Implementation:**
  - Apply adminRateLimit to all admin endpoints
  - Add stricter limits for sensitive operations
  - Add audit logging for rate limit violations
- **Verification:**
  - Test admin endpoint rate limiting
  - Verify audit logs capture violations

---

### Ticket P0-4: Add CSRF Protection for State-Changing Operations

**Priority:** P0 (CRITICAL)
**Severity:** 🟠 7/10
**CVSS:** 6.5 (Medium)
**Estimated Effort:** 4 hours
**Agent:** `promptliano-fullstack-architect`

#### Description
POST/PUT/DELETE operations lack CSRF protection. Attackers can trick users into performing unwanted actions. Implement CSRF token validation for all state-changing operations.

#### Files Affected
- `/packages/server/src/middleware/` (new CSRF middleware)
- `/packages/server/src/routes/` (all routes)
- `/packages/client/src/lib/api-client.ts`

#### Tasks

**Task 4.1: Install CSRF Protection Dependencies**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 15m
- **Implementation:**
  ```bash
  cd /Users/brandon/Programming/promptliano
  bun add @hono/csrf
  ```

**Task 4.2: Implement CSRF Middleware**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/server/src/middleware/csrf.ts` (new file)
  - `/packages/server/src/app.ts`
- **Implementation:**
  - Configure CSRF middleware with cookie-based tokens
  - Set CSRF cookie options (httpOnly: false for reading, sameSite: Strict)
  - Define CSRF token generation endpoint
  - Apply CSRF validation to POST/PUT/DELETE/PATCH routes
  - Exclude public routes (login, setup) from CSRF validation
  - Add CSRF token to response headers
  - Configure origin validation
- **Verification:**
  ```bash
  # Test CSRF token generation
  curl -c cookies.txt http://localhost:3147/api/csrf-token

  # Test CSRF protected request
  curl -b cookies.txt -X POST http://localhost:3147/api/projects \
    -H "X-CSRF-Token: <token>" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```

**Task 4.3: Update API Client to Include CSRF Token**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/client/src/lib/api-client.ts`
- **Implementation:**
  - Fetch CSRF token on app initialization
  - Store CSRF token in memory (not localStorage)
  - Include X-CSRF-Token header in all POST/PUT/DELETE/PATCH requests
  - Refresh CSRF token on 403 CSRF errors
  - Add CSRF token to request interceptor
- **Verification:**
  - Test API calls include CSRF token
  - Test CSRF validation prevents unauthorized requests
  - Verify token refresh on expiry

**Task 4.4: Apply CSRF Protection to Routes**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 45m
- **Files:**
  - `/packages/server/src/app.ts`
- **Implementation:**
  - Apply CSRF middleware globally to app
  - Configure exemptions for public routes
  - Add CSRF validation logging
  - Document CSRF requirements in API docs
- **Verification:**
  - Test all state-changing endpoints require CSRF token
  - Test public endpoints don't require CSRF token
  - Verify CSRF errors return 403 with clear message

---

## 🎯 P1 - HIGH PRIORITY (Week 2)

### Ticket P1-1: Implement Token Revocation Blacklist

**Priority:** P1 (HIGH)
**Severity:** 🟠 6/10
**Estimated Effort:** 6 hours
**Agent:** `promptliano-database-architect` + `promptliano-service-architect`

#### Description
No mechanism to revoke tokens before expiry. Compromised tokens remain valid until expiration. Implement token blacklist for immediate revocation.

#### Files Affected
- `/packages/database/src/schema.ts`
- `/packages/services/src/auth-service.ts`
- `/packages/server/src/interceptors/request/auth-interceptor.ts`

#### Tasks

**Task 5.1: Create Token Blacklist Database Schema**
- **Agent:** `promptliano-database-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/database/src/schema.ts`
  - `/packages/database/drizzle/` (migration)
- **Implementation:**
  - Add `revokedTokens` table with columns:
    - id (primary key)
    - tokenHash (indexed, unique)
    - userId (indexed)
    - revokedAt (timestamp)
    - expiresAt (timestamp for cleanup)
    - reason (text - logout, compromised, etc.)
  - Add index on tokenHash for fast lookups
  - Add index on expiresAt for cleanup queries
  - Create migration script
- **Verification:**
  ```bash
  bun run db:migrate
  bun run db:studio  # Verify table exists
  ```

**Task 5.2: Implement Token Blacklist Service**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/services/src/token-blacklist-service.ts` (new file)
- **Implementation:**
  - Create `addToBlacklist(token, userId, reason)` function
  - Create `isBlacklisted(token)` function (check hash)
  - Create `revokeAllUserTokens(userId)` function
  - Create `cleanupExpiredTokens()` function
  - Hash tokens before storing (security + performance)
  - Add caching layer for frequently checked tokens
  - Add scheduled cleanup job (cron or interval)
- **Verification:**
  ```typescript
  // Test blacklist operations
  await tokenBlacklistService.addToBlacklist(token, userId, 'logout')
  const isBlacklisted = await tokenBlacklistService.isBlacklisted(token)
  // Should return true
  ```

**Task 5.3: Integrate Blacklist Check in Auth Interceptor**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/interceptors/request/auth-interceptor.ts`
- **Implementation:**
  - Add blacklist check after token validation
  - Return 401 if token is blacklisted
  - Add logging for blacklisted token attempts
  - Cache negative checks (token not blacklisted) for performance
- **Verification:**
  ```bash
  # Test revoked token is rejected
  # 1. Login and get token
  # 2. Logout (adds to blacklist)
  # 3. Try to use old token
  # Should return 401 Unauthorized
  ```

**Task 5.4: Add Token Revocation to Logout**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Update logout function to add tokens to blacklist
  - Add "Revoke all sessions" endpoint
  - Add admin endpoint to revoke user tokens
  - Add automatic blacklist cleanup on token expiry
- **Verification:**
  - Test logout adds tokens to blacklist
  - Test revoked tokens cannot be used
  - Test cleanup removes expired entries

**Task 5.5: Add Blacklist Cleanup Scheduler**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/jobs/token-cleanup.ts` (new file)
- **Implementation:**
  - Create scheduled job to run cleanup every hour
  - Delete blacklist entries where expiresAt < now
  - Add logging for cleanup operations
  - Add metrics for blacklist size
- **Verification:**
  ```bash
  # Test cleanup job runs
  # Add expired token to blacklist
  # Wait for cleanup interval
  # Verify token removed from database
  ```

---

### Ticket P1-2: Fix Timing Attack Vulnerabilities in Password Verification

**Priority:** P1 (HIGH)
**Severity:** 🟠 6/10
**Estimated Effort:** 3 hours
**Agent:** `promptliano-service-architect`

#### Description
Password verification returns immediately for non-existent users, creating timing attack vulnerability. Implement constant-time authentication.

#### Files Affected
- `/packages/services/src/auth-service.ts`

#### Tasks

**Task 6.1: Implement Constant-Time Authentication**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Always perform bcrypt comparison (even for non-existent users)
  - Use dummy hash for non-existent users (pre-computed bcrypt hash)
  - Ensure same code path for valid and invalid users
  - Add random jitter (50-200ms) to response times
  - Use crypto.timingSafeEqual for token comparisons
  - Document timing attack prevention in code comments
- **Verification:**
  ```bash
  # Test timing consistency
  time curl -X POST http://localhost:3147/api/auth/login \
    -d '{"username":"exists","password":"wrong"}'

  time curl -X POST http://localhost:3147/api/auth/login \
    -d '{"username":"doesnotexist","password":"wrong"}'

  # Response times should be similar (within 50ms)
  ```

**Task 6.2: Add Timing-Safe String Comparisons**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Import crypto.timingSafeEqual for token comparisons
  - Replace string === comparisons for sensitive data
  - Add helper function for timing-safe comparisons
  - Apply to refresh token validation
  - Apply to password reset token validation (if exists)
- **Verification:**
  ```typescript
  // Test timing-safe comparisons
  const result = timingSafeEqual(token1, token2)
  // Should use constant-time comparison
  ```

---

### Ticket P1-3: Remove Client-Side Token Expiry Authority

**Priority:** P1 (HIGH)
**Severity:** 🟠 5/10
**Estimated Effort:** 2 hours
**Agent:** `promptliano-frontend-architect`

#### Description
Client-side code checks token expiry and makes authorization decisions. This creates attack surface. All auth decisions must be server-side only.

#### Files Affected
- `/packages/client/src/contexts/auth-context.tsx`
- `/packages/client/src/lib/router/auth.ts`

#### Tasks

**Task 7.1: Remove Client-Side Token Expiry Checks**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/client/src/contexts/auth-context.tsx`
- **Implementation:**
  - Remove isTokenExpired() function
  - Remove client-side token expiry logic
  - Remove token decode logic (jwt-decode library)
  - Rely solely on server 401 responses
  - Handle 401 by triggering refresh or logout
  - Simplify auth context state management
- **Verification:**
  - Test authentication relies on server responses
  - Verify no client-side token validation
  - Test expired tokens are handled by server

**Task 7.2: Update Router Auth Guard**
- **Agent:** `promptliano-frontend-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/client/src/lib/router/auth.ts`
- **Implementation:**
  - Remove client-side expiry checks in beforeLoad
  - Make authentication endpoint call to validate session
  - Handle 401 responses with redirect to login
  - Remove token parsing logic
  - Simplify route protection (server is source of truth)
- **Verification:**
  - Test route guards work without client-side validation
  - Test expired sessions redirect to login
  - Verify no token decoding on client

---

## 🎯 P2 - MEDIUM PRIORITY (Month 1)

### Ticket P2-1: Implement Comprehensive Input Sanitization

**Priority:** P2 (MEDIUM)
**Severity:** 🟡 5/10
**Estimated Effort:** 4 hours
**Agent:** `promptliano-api-architect`

#### Description
Input sanitization is inconsistent across routes. Implement centralized Zod validation and DOMPurify sanitization for all user inputs.

#### Files Affected
- All routes in `/packages/server/src/routes/`
- `/packages/server/src/middleware/validation.ts` (new)

#### Tasks

**Task 8.1: Install Sanitization Dependencies**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 15m
- **Implementation:**
  ```bash
  bun add isomorphic-dompurify
  bun add -d @types/dompurify
  ```

**Task 8.2: Create Validation and Sanitization Middleware**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/server/src/middleware/validation.ts` (new file)
- **Implementation:**
  - Create sanitizeHtml() function using DOMPurify
  - Create sanitizeInput() function for general strings
  - Create Zod refinement helpers for sanitization
  - Create middleware for automatic input sanitization
  - Add configurable sanitization levels (strict, standard, minimal)
  - Document sanitization rules

**Task 8.3: Apply Sanitization to Auth Routes**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/routes/auth-routes.ts`
- **Implementation:**
  - Sanitize username input
  - Sanitize email input
  - Add Zod validation refinements
  - Apply sanitization middleware
- **Verification:**
  ```bash
  # Test XSS prevention
  curl -X POST http://localhost:3147/api/auth/login \
    -d '{"username":"<script>alert(1)</script>","password":"test"}'
  # Script tags should be sanitized
  ```

**Task 8.4: Apply Sanitization to All User Input Routes**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 45m
- **Files:**
  - All routes accepting user input
- **Implementation:**
  - Apply sanitization to project creation
  - Apply sanitization to ticket creation
  - Apply sanitization to task creation
  - Apply sanitization to any text input fields
  - Add validation tests

---

### Ticket P2-2: Implement Account Lockout After Failed Login Attempts

**Priority:** P2 (MEDIUM)
**Severity:** 🟡 5/10
**Estimated Effort:** 5 hours
**Agent:** `promptliano-database-architect` + `promptliano-service-architect`

#### Description
No protection against brute force password guessing on individual accounts. Implement account lockout after N failed attempts.

#### Files Affected
- `/packages/database/src/schema.ts`
- `/packages/services/src/auth-service.ts`

#### Tasks

**Task 9.1: Add Login Attempts Tracking to Database**
- **Agent:** `promptliano-database-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/database/src/schema.ts`
- **Implementation:**
  - Add `loginAttempts` table with columns:
    - id, userId, attemptedAt, successful, ipAddress, userAgent
  - Add `failedLoginCount` to users table
  - Add `lockedUntil` timestamp to users table
  - Create indexes for efficient queries
  - Create migration

**Task 9.2: Implement Account Lockout Logic**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Track failed login attempts per user
  - Lock account after 5 failed attempts (configurable)
  - Lock duration: 15 minutes (exponential backoff for repeat offenses)
  - Reset failed count on successful login
  - Add isAccountLocked() check before authentication
  - Add unlockAccount() function for admins
  - Send email notification on account lock (optional)

**Task 9.3: Add Account Lockout Responses**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/routes/auth-routes.ts`
- **Implementation:**
  - Return locked account error with unlock time
  - Add "Forgot Password" flow for locked accounts
  - Add admin endpoint to unlock accounts
  - Add logging for lockout events

**Task 9.4: Add Account Lockout Tests**
- **Agent:** `promptliano-testing-architect`
- **Estimated:** 1h
- **Implementation:**
  - Test account locks after N failed attempts
  - Test account unlocks after timeout
  - Test successful login resets counter
  - Test admin unlock functionality

---

### Ticket P2-3: Remove Sensitive Data from Logs

**Priority:** P2 (MEDIUM)
**Severity:** 🟡 4/10
**Estimated Effort:** 2 hours
**Agent:** `promptliano-service-architect`

#### Description
Passwords, tokens, and sensitive data may be logged. Implement log sanitization to prevent sensitive data leaks.

#### Files Affected
- `/packages/services/src/auth-service.ts`
- All logging statements across the codebase

#### Tasks

**Task 10.1: Create Log Sanitization Utility**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/shared/src/logging/sanitize.ts` (new file)
- **Implementation:**
  - Create sanitizeForLogging() function
  - Redact password fields
  - Redact token fields (access_token, refresh_token, etc.)
  - Redact email addresses (partially)
  - Redact sensitive headers (Authorization, Cookie, etc.)
  - Add whitelist for safe fields
  - Export sanitization helpers

**Task 10.2: Apply Log Sanitization to Auth Service**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 30m
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Remove password from error logs
  - Remove tokens from debug logs
  - Sanitize user objects before logging
  - Apply sanitization to all logging statements

**Task 10.3: Audit All Logging Statements**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 30m
- **Implementation:**
  - Search for console.log/error/warn across codebase
  - Identify sensitive data logging
  - Apply sanitization where needed
  - Document logging best practices

---

### Ticket P2-4: Enforce Strong Password Requirements

**Priority:** P2 (MEDIUM)
**Severity:** 🟡 4/10
**Estimated Effort:** 3 hours
**Agent:** `promptliano-service-architect`

#### Description
Password requirements are minimal. Implement strong password validation using zxcvbn for password strength estimation.

#### Files Affected
- `/packages/services/src/auth-service.ts`
- `/packages/schemas/src/auth.ts` (if exists)

#### Tasks

**Task 11.1: Install Password Strength Library**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 15m
- **Implementation:**
  ```bash
  bun add zxcvbn
  bun add -d @types/zxcvbn
  ```

**Task 11.2: Implement Password Strength Validation**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Add validatePasswordStrength() function using zxcvbn
  - Require minimum score of 3/4 (zxcvbn scale)
  - Minimum length 12 characters
  - Check against common passwords
  - Check against user data (username, email)
  - Provide helpful feedback messages
  - Add password strength indicator for UI

**Task 11.3: Add Password Validation to Registration**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 45m
- **Files:**
  - `/packages/server/src/routes/auth-routes.ts`
- **Implementation:**
  - Apply password validation to setup endpoint
  - Apply password validation to password change endpoint
  - Return detailed validation errors with improvement suggestions
  - Add password strength meter endpoint for real-time validation

---

## 🎯 P3 - LOW PRIORITY (Future)

### Ticket P3-1: Standardize Error Messages to Prevent Information Leakage

**Priority:** P3 (LOW)
**Severity:** 🟢 3/10
**Estimated Effort:** 2 hours
**Agent:** `promptliano-api-architect`

#### Description
Error messages reveal whether usernames exist. Standardize auth error messages to prevent enumeration attacks.

#### Tasks

**Task 12.1: Standardize Authentication Error Messages**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Files:**
  - `/packages/server/src/routes/auth-routes.ts`
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Use generic "Invalid credentials" for all auth failures
  - Don't reveal if username exists or doesn't exist
  - Don't reveal if password is wrong vs username wrong
  - Use same error for locked accounts
  - Add detailed logs server-side (not exposed to client)

**Task 12.2: Audit All Error Responses**
- **Agent:** `promptliano-api-architect`
- **Estimated:** 1h
- **Implementation:**
  - Review all error messages for information leaks
  - Standardize error responses across all routes
  - Create error message constants
  - Document secure error messaging guidelines

---

### Ticket P3-2: Implement Refresh Token Reuse Detection

**Priority:** P3 (LOW)
**Severity:** 🟢 3/10
**Estimated Effort:** 6 hours
**Agent:** `promptliano-database-architect` + `promptliano-service-architect`

#### Description
Token theft may go undetected if attackers use stolen refresh tokens. Implement token family tracking to detect and prevent token reuse attacks.

#### Files Affected
- `/packages/database/src/schema.ts`
- `/packages/services/src/auth-service.ts`

#### Tasks

**Task 13.1: Implement Token Families Database Schema**
- **Agent:** `promptliano-database-architect`
- **Estimated:** 2h
- **Files:**
  - `/packages/database/src/schema.ts`
- **Implementation:**
  - Add `tokenFamilies` table with columns:
    - id, userId, familyId (UUID), createdAt, revokedAt
  - Add `refreshTokens` table with columns:
    - id, familyId, tokenHash, issuedAt, expiresAt, usedAt, replacedBy
  - Create indexes for efficient queries
  - Create migration

**Task 13.2: Implement Token Family Logic**
- **Agent:** `promptliano-service-architect`
- **Estimated:** 3h
- **Files:**
  - `/packages/services/src/auth-service.ts`
- **Implementation:**
  - Generate familyId on initial login
  - Track token lineage (parent -> child relationships)
  - Detect reuse when already-used token is presented
  - Revoke entire token family on reuse detection
  - Force re-authentication on suspicious activity
  - Add logging and alerting for detected attacks

**Task 13.3: Add Reuse Detection Tests**
- **Agent:** `promptliano-testing-architect`
- **Estimated:** 1h
- **Implementation:**
  - Test token reuse detection
  - Test family revocation
  - Test legitimate refresh flows
  - Test concurrent refresh handling

---

## 🎯 Final Review Ticket

### Ticket REVIEW-1: Comprehensive Security Implementation Code Review

**Priority:** P0 (CRITICAL - Must complete before production)
**Estimated Effort:** 4 hours
**Agent:** `staff-engineer-code-reviewer`

#### Description
Comprehensive review of all security fixes to ensure proper implementation, no regressions, and complete coverage.

#### Tasks

**Task R.1: Review P0 Critical Security Fixes**
- **Agent:** `staff-engineer-code-reviewer`
- **Estimated:** 1h
- **Scope:**
  - JWT secret validation implementation
  - httpOnly cookie migration
  - Rate limiting effectiveness
  - CSRF protection completeness
- **Verification:**
  - Code quality and patterns
  - Security best practices
  - Performance implications
  - Test coverage

**Task R.2: Review P1 High Priority Security Fixes**
- **Agent:** `staff-engineer-code-reviewer`
- **Estimated:** 1h
- **Scope:**
  - Token blacklist implementation
  - Timing attack prevention
  - Client-side auth removal
- **Verification:**
  - Implementation correctness
  - Edge cases handled
  - Performance benchmarks
  - Security guarantees

**Task R.3: Review P2 Medium Priority Security Fixes**
- **Agent:** `staff-engineer-code-reviewer`
- **Estimated:** 1h
- **Scope:**
  - Input sanitization coverage
  - Account lockout logic
  - Log sanitization completeness
  - Password strength validation
- **Verification:**
  - Complete coverage
  - No bypasses possible
  - User experience impact
  - Documentation quality

**Task R.4: End-to-End Security Testing**
- **Agent:** `staff-engineer-code-reviewer`
- **Estimated:** 1h
- **Scope:**
  - Complete authentication flow
  - All attack vectors tested
  - Integration between fixes
  - Production readiness checklist
- **Verification:**
  - Penetration testing results
  - Security scan results
  - Performance impact assessment
  - Deployment readiness

**Task R.5: Security Documentation and Runbook**
- **Agent:** `staff-engineer-code-reviewer`
- **Estimated:** 30m
- **Deliverables:**
  - Security implementation summary
  - Configuration guide for production
  - Monitoring and alerting setup
  - Incident response procedures
  - Future security roadmap

---

## 📊 Implementation Tracking

### P0 Tickets (Week 1)
- [ ] P0-1: JWT Secret Validation (2h)
- [ ] P0-2: httpOnly Cookie Migration (1d)
- [ ] P0-3: Rate Limiting (4h)
- [ ] P0-4: CSRF Protection (4h)

### P1 Tickets (Week 2)
- [ ] P1-1: Token Blacklist (6h)
- [ ] P1-2: Timing Attack Prevention (3h)
- [ ] P1-3: Remove Client-Side Auth (2h)

### P2 Tickets (Month 1)
- [ ] P2-1: Input Sanitization (4h)
- [ ] P2-2: Account Lockout (5h)
- [ ] P2-3: Log Sanitization (2h)
- [ ] P2-4: Password Strength (3h)

### P3 Tickets (Future)
- [ ] P3-1: Error Message Standardization (2h)
- [ ] P3-2: Token Reuse Detection (6h)

### Final Review
- [ ] REVIEW-1: Comprehensive Security Review (4h)

---

## 🎯 Success Criteria

### P0 Completion (Production Blocker)
- ✅ JWT secret cannot be default value
- ✅ Tokens stored in httpOnly cookies only
- ✅ Rate limiting active on all auth endpoints
- ✅ CSRF protection on all state-changing operations
- ✅ All tests passing
- ✅ Code review approved

### P1 Completion (High Priority)
- ✅ Token revocation working for logout
- ✅ Timing attacks prevented with constant-time comparisons
- ✅ Client has no auth decision-making authority
- ✅ All tests passing

### P2 Completion (Quality Gates)
- ✅ Input sanitization applied to all user inputs
- ✅ Account lockout working after failed attempts
- ✅ No sensitive data in logs
- ✅ Strong password requirements enforced
- ✅ All tests passing

### Full Security Audit Pass
- ✅ All P0, P1, P2 tickets completed
- ✅ Comprehensive code review passed
- ✅ Security audit score improved from 62/100 to 90+/100
- ✅ Production deployment checklist completed
- ✅ Monitoring and alerting configured

---

## 📚 Reference Documentation

- **Source:** `/Users/brandon/Programming/promptliano/SECURITY_FIXES.md`
- **Complete Implementation Guides:** See SECURITY_FIXES.md for detailed code examples
- **Testing Procedures:** See SECURITY_FIXES.md for verification commands
- **Deployment Checklists:** See SECURITY_FIXES.md for production deployment steps

---

**Next Steps:**
1. Review this implementation plan
2. Create queue for security fixes using Promptliano MCP
3. Create tickets using Promptliano MCP with agent assignments
4. Process tickets in priority order (P0 → P1 → P2 → P3)
5. Comprehensive code review before production deployment
