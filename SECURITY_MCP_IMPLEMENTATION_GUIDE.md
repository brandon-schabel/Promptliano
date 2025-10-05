# 🤖 Security Implementation - MCP Agent Workflow Guide

**How to implement security fixes using Promptliano MCP tools and specialized agents**

---

## 🎯 Overview

This guide provides the exact MCP commands and agent workflows to systematically implement all 13 security fixes using the Promptliano agent architecture.

### Prerequisites
- Promptliano MCP server running
- Project ID from Promptliano (get via `project_manager(action: "list")`)
- Understanding of agent-first workflow (see CLAUDE.md)

---

## 📋 Phase 0: Setup and Planning

### Step 1: Get Project Overview

```typescript
// Get project list
mcp__promptliano__project_manager({
  action: "list"
})

// Get project overview (use actual projectId from list)
mcp__promptliano__project_manager({
  action: "overview",
  projectId: 1754713756748
})
```

### Step 2: Create Security Implementation Queue

```typescript
// Create dedicated queue for security fixes
mcp__promptliano__flow_manager({
  action: "queues_create",
  projectId: 1754713756748,
  data: {
    name: "Security Hardening - Authentication",
    description: "Complete implementation of all 13 security fixes from SECURITY_FIXES.md audit",
    maxParallelItems: 1  // Sequential implementation for security
  }
})

// Response will include queueId - save this for later use
// Example: queueId: 123
```

---

## 📋 Phase 1: Create All Tickets (P0 → P1 → P2 → P3)

### P0-1: JWT Secret Hardcoded

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P0-1] CRITICAL: Fix JWT Secret Hardcoded Default",
    description: `**Priority:** P0 (CRITICAL)
**Severity:** 🔴 10/10 - CVSS 9.8
**Effort:** 2 hours
**Agent:** promptliano-service-architect

## Vulnerability
JWT signing secret defaults to publicly known hardcoded string. Attackers can forge admin tokens.

## Implementation Tasks
1. Add JWT secret validation function (min 32 chars, forbidden defaults)
2. Implement server startup security checks
3. Update .env.example with security documentation

## Files Affected
- /packages/services/src/auth-service.ts
- /.env.example
- /packages/server/src/app.ts

## Verification
- Test weak secret rejection
- Test default secret rejection
- Test strong secret acceptance
- Verify production mode fails without JWT_SECRET

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-1 for complete implementation guide.`,
    priority: 10,
    status: "pending",
    tags: ["security", "critical", "p0", "authentication"]
  }
})

// Save ticketId from response for creating tasks
```

### P0-2: localStorage Token Storage

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P0-2] CRITICAL: Migrate from localStorage to httpOnly Cookies",
    description: `**Priority:** P0 (CRITICAL)
**Severity:** 🔴 9/10 - CVSS 8.8
**Effort:** 1 day
**Agent:** promptliano-fullstack-architect

## Vulnerability
Tokens stored in localStorage are accessible to JavaScript, creating XSS vulnerability. Any XSS = complete token theft.

## Implementation Tasks
1. Implement cookie-based auth on server (httpOnly, secure, sameSite)
2. Update auth interceptor to read cookies
3. Update frontend auth context for cookie-based auth
4. Update API client to include credentials
5. Update router auth guard
6. Add migration guide and cleanup

## Files Affected
- /packages/server/src/routes/auth-routes.ts
- /packages/server/src/interceptors/request/auth-interceptor.ts
- /packages/client/src/contexts/auth-context.tsx
- /packages/client/src/lib/router/auth.ts
- /packages/api-client/src/base-client.ts

## Verification
- Test login sets httpOnly cookies
- Verify tokens not in localStorage
- Test protected routes work with cookies
- Test logout clears cookies

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-2 for complete implementation guide.`,
    priority: 10,
    status: "pending",
    tags: ["security", "critical", "p0", "xss", "cookies"]
  }
})
```

### P0-3: No Rate Limiting

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P0-3] HIGH: Implement Rate Limiting on Authentication Endpoints",
    description: `**Priority:** P0 (HIGH)
**Severity:** 🟠 8/10 - CVSS 7.5
**Effort:** 4 hours
**Agent:** promptliano-api-architect

## Vulnerability
No rate limiting allows unlimited brute force attacks on authentication endpoints.

## Implementation Tasks
1. Install @hono/rate-limiter
2. Create rate limiting middleware (strict auth, standard API, admin)
3. Apply to auth routes (5 attempts per 15min)
4. Apply to admin routes (10 requests per min)

## Files Affected
- /packages/server/src/middleware/rate-limit.ts (new)
- /packages/server/src/routes/auth-routes.ts
- /packages/server/src/routes/admin-routes.ts

## Verification
- Test 6 login attempts triggers 429
- Test rate limit headers in responses
- Test different IPs have separate limits

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-3 for complete implementation guide.`,
    priority: 8,
    status: "pending",
    tags: ["security", "high", "p0", "rate-limiting", "brute-force"]
  }
})
```

### P0-4: Missing CSRF Protection

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P0-4] HIGH: Add CSRF Protection for State-Changing Operations",
    description: `**Priority:** P0 (HIGH)
**Severity:** 🟠 7/10 - CVSS 6.5
**Effort:** 4 hours
**Agent:** promptliano-fullstack-architect

## Vulnerability
POST/PUT/DELETE operations lack CSRF protection. Attackers can trick users into unwanted actions.

## Implementation Tasks
1. Install @hono/csrf
2. Implement CSRF middleware with cookie-based tokens
3. Update API client to include CSRF token
4. Apply CSRF protection to all state-changing routes

## Files Affected
- /packages/server/src/middleware/csrf.ts (new)
- /packages/server/src/app.ts
- /packages/client/src/lib/api-client.ts

## Verification
- Test CSRF token generation
- Test CSRF protected requests require token
- Test CSRF validation prevents unauthorized requests

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-4 for complete implementation guide.`,
    priority: 8,
    status: "pending",
    tags: ["security", "high", "p0", "csrf"]
  }
})
```

### P1-1: No Token Blacklist

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P1-1] HIGH: Implement Token Revocation Blacklist",
    description: `**Priority:** P1 (HIGH)
**Severity:** 🟠 6/10
**Effort:** 6 hours
**Agent:** promptliano-database-architect + promptliano-service-architect

## Vulnerability
No mechanism to revoke tokens before expiry. Compromised tokens remain valid.

## Implementation Tasks
1. Create token blacklist database schema
2. Implement token blacklist service
3. Integrate blacklist check in auth interceptor
4. Add token revocation to logout
5. Add blacklist cleanup scheduler

## Files Affected
- /packages/database/src/schema.ts
- /packages/services/src/token-blacklist-service.ts (new)
- /packages/server/src/interceptors/request/auth-interceptor.ts
- /packages/server/src/jobs/token-cleanup.ts (new)

## Verification
- Test logout adds tokens to blacklist
- Test revoked tokens are rejected
- Test cleanup removes expired entries

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P1-1 for complete implementation guide.`,
    priority: 6,
    status: "pending",
    tags: ["security", "high", "p1", "token-revocation"]
  }
})
```

### P1-2: Timing Attacks

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P1-2] MEDIUM-HIGH: Fix Timing Attack Vulnerabilities",
    description: `**Priority:** P1 (MEDIUM-HIGH)
**Severity:** 🟠 6/10
**Effort:** 3 hours
**Agent:** promptliano-service-architect

## Vulnerability
Password verification returns immediately for non-existent users, creating timing attack.

## Implementation Tasks
1. Implement constant-time authentication (always run bcrypt)
2. Add timing-safe string comparisons for tokens

## Files Affected
- /packages/services/src/auth-service.ts

## Verification
- Test response times consistent for valid/invalid users
- Test timing-safe comparisons used for tokens

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P1-2 for complete implementation guide.`,
    priority: 6,
    status: "pending",
    tags: ["security", "medium-high", "p1", "timing-attack"]
  }
})
```

### P1-3: Client-Side Token Expiry

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[P1-3] MEDIUM: Remove Client-Side Token Expiry Authority",
    description: `**Priority:** P1 (MEDIUM)
**Severity:** 🟠 5/10
**Effort:** 2 hours
**Agent:** promptliano-frontend-architect

## Vulnerability
Client-side code makes authorization decisions. All auth must be server-side only.

## Implementation Tasks
1. Remove client-side token expiry checks
2. Update router auth guard to rely on server

## Files Affected
- /packages/client/src/contexts/auth-context.tsx
- /packages/client/src/lib/router/auth.ts

## Verification
- Test authentication relies on server responses
- Test expired sessions redirect to login

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket P1-3 for complete implementation guide.`,
    priority: 5,
    status: "pending",
    tags: ["security", "medium", "p1", "client-auth"]
  }
})
```

### P2-1 through P2-4, P3-1, P3-2 (Similar Pattern)

**Note:** Follow the same pattern for remaining tickets. Each ticket should include:
- Clear priority and severity
- Assigned specialized agent
- Estimated effort
- Complete description of vulnerability
- Task breakdown
- Files affected
- Verification steps
- Reference to detailed implementation plan

---

## 📋 Phase 2: Create Tasks for Each Ticket

### Example: Creating Tasks for P0-1

```typescript
// Get ticket ID from previous response
const ticketId = 456  // Replace with actual ID

// Task 1.1: JWT Secret Validation
mcp__promptliano__flow_manager({
  action: "tasks_create",
  ticketId: ticketId,
  data: {
    content: "Implement JWT secret validation function",
    description: `Add validateJwtSecret() function with:
- Minimum length check (32 chars)
- Forbidden defaults list
- Entropy calculation
- IIFE for JWT_SECRET initialization
- Production mode strict validation
- Development mode warnings

Files: /packages/services/src/auth-service.ts

Agent: promptliano-service-architect`,
    status: "pending",
    estimatedHours: 1,
    tags: ["security", "validation"]
  }
})

// Task 1.2: Server Startup Security Checks
mcp__promptliano__flow_manager({
  action: "tasks_create",
  ticketId: ticketId,
  data: {
    content: "Add server startup security checks",
    description: `Create performSecurityChecks() function:
- Check JWT secret validation
- Production environment checks
- Log security check results
- Fail server startup if critical checks fail

Files: /packages/server/src/app.ts

Agent: promptliano-api-architect`,
    status: "pending",
    estimatedHours: 0.5,
    tags: ["security", "startup"]
  }
})

// Task 1.3: Environment Documentation
mcp__promptliano__flow_manager({
  action: "tasks_create",
  ticketId: ticketId,
  data: {
    content: "Update environment configuration documentation",
    description: `Update .env.example with:
- Comprehensive JWT secret section
- Security warnings
- Generation instructions
- Required variables for production

Files: /.env.example

Agent: promptliano-service-architect`,
    status: "pending",
    estimatedHours: 0.5,
    tags: ["security", "documentation"]
  }
})
```

### Repeat for All Tickets

Create tasks for:
- **P0-2:** 6 tasks (server cookies, interceptor, frontend context, API client, router, migration)
- **P0-3:** 4 tasks (dependencies, middleware, auth routes, admin routes)
- **P0-4:** 4 tasks (dependencies, CSRF middleware, API client, routes)
- **P1-1:** 5 tasks (schema, service, interceptor, logout, cleanup)
- **P1-2:** 2 tasks (constant-time auth, timing-safe comparisons)
- **P1-3:** 2 tasks (remove expiry checks, update guards)
- **P2-1 through P2-4:** Similar pattern
- **P3-1, P3-2:** Similar pattern

---

## 📋 Phase 3: Enqueue Tickets in Priority Order

```typescript
// Enqueue P0 tickets first (highest priority)
mcp__promptliano__flow_manager({
  action: "queues_add_item",
  queueId: 123,  // Replace with actual queueId
  data: {
    ticketId: 456,  // P0-1
    priority: 10
  }
})

mcp__promptliano__flow_manager({
  action: "queues_add_item",
  queueId: 123,
  data: {
    ticketId: 457,  // P0-2
    priority: 10
  }
})

mcp__promptliano__flow_manager({
  action: "queues_add_item",
  queueId: 123,
  data: {
    ticketId: 458,  // P0-3
    priority: 8
  }
})

mcp__promptliano__flow_manager({
  action: "queues_add_item",
  queueId: 123,
  data: {
    ticketId: 459,  // P0-4
    priority: 8
  }
})

// Then P1 tickets
mcp__promptliano__flow_manager({
  action: "queues_add_item",
  queueId: 123,
  data: {
    ticketId: 460,  // P1-1
    priority: 6
  }
})

// Continue for P1-2, P1-3, P2-1 through P2-4, P3-1, P3-2
```

---

## 📋 Phase 4: Process Queue with Specialized Agents

### Get Next Task from Queue

```typescript
// Get next task to work on
mcp__promptliano__flow_manager({
  action: "processor_get_next",
  queueId: 123
})

// Response will include:
// - taskId
// - ticketId
// - task details
// - suggested agent
// - suggested files
```

### Load Specialized Agent for Task

```
Task(
  subagent_type: "promptliano-service-architect",
  description: "Implement JWT secret validation",
  prompt: `
Context: Security fix P0-1 - JWT Secret Hardcoded

Task: Implement JWT secret validation function

Files:
- /packages/services/src/auth-service.ts

Implementation:
Add validateJwtSecret() function with:
- Minimum length check (32 characters)
- Forbidden defaults list (dev-secret-please-change-in-production, secret, password, etc.)
- Entropy calculation (minimum 16 unique characters)
- IIFE for JWT_SECRET initialization with validation
- Production mode: fail fast if secret missing or weak
- Development mode: warn and auto-generate session secret

Reference: SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-1, Task 1.1
Complete code example: SECURITY_FIXES.md lines 122-224

Verification:
- Test weak secret rejection: JWT_SECRET="weak" bun run dev
- Test default rejection: JWT_SECRET="dev-secret-please-change-in-production" bun run dev
- Test strong acceptance: JWT_SECRET=$(openssl rand -base64 64) bun run dev
`
)
```

### Complete Task

```typescript
// After agent completes implementation
mcp__promptliano__flow_manager({
  action: "tasks_update",
  taskId: 789,
  data: {
    status: "completed",
    completionNotes: "JWT secret validation implemented with all checks. Tests passing."
  }
})

// Mark queue item as complete
mcp__promptliano__flow_manager({
  action: "processor_complete",
  itemId: 890,  // Queue item ID
  data: {
    completionNotes: "Task completed successfully"
  }
})
```

### Repeat Until Queue Empty

Continue the cycle:
1. Get next task from queue
2. Load specialized agent
3. Agent implements task
4. Verify implementation
5. Complete task
6. Move to next task

---

## 📋 Phase 5: Final Comprehensive Code Review

### Create Review Ticket

```typescript
mcp__promptliano__flow_manager({
  action: "tickets_create",
  projectId: 1754713756748,
  data: {
    title: "[REVIEW-1] MANDATORY: Comprehensive Security Implementation Review",
    description: `**Priority:** P0 (CRITICAL - Production Blocker)
**Effort:** 4 hours
**Agent:** staff-engineer-code-reviewer

## Purpose
Comprehensive review of all security fixes before production deployment.

## Review Tasks
1. Review P0 critical security fixes (JWT secret, cookies, rate limiting, CSRF)
2. Review P1 high priority fixes (blacklist, timing, client auth)
3. Review P2 medium priority fixes (sanitization, lockout, logging, passwords)
4. End-to-end security testing
5. Security documentation and runbook

## Success Criteria
- All security fixes implemented correctly
- No security regressions
- All tests passing
- Security audit score ≥ 90/100
- Production deployment checklist complete

## Reference
See SECURITY_IMPLEMENTATION_PLAN.md - Ticket REVIEW-1`,
    priority: 10,
    status: "pending",
    tags: ["security", "review", "mandatory", "production-blocker"]
  }
})
```

### Load Code Reviewer Agent

```
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Comprehensive security implementation review",
  prompt: `
Context: Complete security hardening implementation

Task: Review all security fixes for:
- Code quality and security best practices
- Implementation correctness
- Edge cases and error handling
- Performance implications
- Test coverage
- Production readiness

Files to Review:
- All files modified for P0, P1, P2 security fixes
- See SECURITY_IMPLEMENTATION_PLAN.md for complete file list

Focus Areas:
1. JWT secret validation and startup checks
2. httpOnly cookie implementation (XSS prevention)
3. Rate limiting effectiveness
4. CSRF protection completeness
5. Token blacklist implementation
6. Timing attack prevention
7. Input sanitization coverage
8. Account lockout logic
9. Log sanitization
10. Password strength validation

Deliverables:
- Security review report
- List of any issues found
- Production deployment checklist
- Recommendations for future improvements

Reference: SECURITY_IMPLEMENTATION_PLAN.md - Ticket REVIEW-1
`
)
```

---

## 📊 Progress Tracking with MCP

### Check Queue Status

```typescript
// Get queue statistics
mcp__promptliano__flow_manager({
  action: "queues_get_stats",
  queueId: 123
})

// Response includes:
// - Total items
// - Completed items
// - In progress items
// - Pending items
// - Average completion time
```

### List All Tickets

```typescript
// Get all tickets in project
mcp__promptliano__flow_manager({
  action: "tickets_list",
  projectId: 1754713756748,
  data: {
    status: "all"  // or "pending", "in_progress", "completed"
  }
})
```

### List All Tasks for Ticket

```typescript
// Get all tasks for a specific ticket
mcp__promptliano__flow_manager({
  action: "tasks_list",
  ticketId: 456,
  data: {
    status: "all"
  }
})
```

---

## 🎯 Success Criteria Checklist

### Phase 1: Setup Complete
- [ ] Project overview retrieved
- [ ] Security queue created
- [ ] All 14 tickets created (13 security + 1 review)
- [ ] All tasks created for tickets
- [ ] All tickets enqueued in priority order

### Phase 2: P0 Implementation Complete
- [ ] P0-1: JWT Secret validation implemented and tested
- [ ] P0-2: httpOnly cookies implemented and tested
- [ ] P0-3: Rate limiting implemented and tested
- [ ] P0-4: CSRF protection implemented and tested
- [ ] All P0 tests passing
- [ ] P0 tasks marked complete in queue

### Phase 3: P1 Implementation Complete
- [ ] P1-1: Token blacklist implemented and tested
- [ ] P1-2: Timing attack prevention implemented and tested
- [ ] P1-3: Client-side auth removed and tested
- [ ] All P1 tests passing
- [ ] P1 tasks marked complete in queue

### Phase 4: P2 Implementation Complete
- [ ] P2-1: Input sanitization implemented and tested
- [ ] P2-2: Account lockout implemented and tested
- [ ] P2-3: Log sanitization implemented and tested
- [ ] P2-4: Password strength implemented and tested
- [ ] All P2 tests passing
- [ ] P2 tasks marked complete in queue

### Phase 5: Final Review Complete
- [ ] Comprehensive code review completed
- [ ] All review issues addressed
- [ ] Security audit score ≥ 90/100
- [ ] Production deployment checklist complete
- [ ] All documentation updated
- [ ] Monitoring and alerting configured

---

## 🚀 Quick Start Command Sequence

```bash
# 1. List projects
mcp__promptliano__project_manager({ action: "list" })

# 2. Get project overview
mcp__promptliano__project_manager({
  action: "overview",
  projectId: 1754713756748
})

# 3. Create security queue
mcp__promptliano__flow_manager({
  action: "queues_create",
  projectId: 1754713756748,
  data: { name: "Security Hardening", maxParallelItems: 1 }
})

# 4. Create tickets (P0-1 through REVIEW-1)
# Use ticket creation commands from Phase 1

# 5. Create tasks for each ticket
# Use task creation commands from Phase 2

# 6. Enqueue tickets
# Use enqueue commands from Phase 3

# 7. Process queue
mcp__promptliano__flow_manager({
  action: "processor_get_next",
  queueId: 123
})

# 8. Load agent and implement
# Use agent loading pattern from Phase 4

# 9. Complete task
mcp__promptliano__flow_manager({
  action: "processor_complete",
  itemId: 890
})

# 10. Repeat steps 7-9 until queue empty

# 11. Final review
# Load staff-engineer-code-reviewer agent
```

---

## 📚 Additional Resources

- **SECURITY_FIXES.md** - Complete technical details with code examples
- **SECURITY_IMPLEMENTATION_PLAN.md** - Full implementation guide
- **SECURITY_IMPLEMENTATION_SUMMARY.md** - Executive overview
- **SECURITY_QUICK_REFERENCE.md** - Quick lookups and checklists

---

**Remember:** The MCP workflow ensures systematic, agent-driven implementation with complete tracking and verification at each step.
