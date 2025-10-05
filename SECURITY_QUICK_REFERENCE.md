# 🔒 Security Implementation - Quick Reference

**Use this document for quick lookups during implementation**

---

## 📚 Document Index

| Document | Purpose | Use When |
|----------|---------|----------|
| **SECURITY_FIXES.md** | Complete vulnerability analysis with code examples | Need detailed technical information about a specific vulnerability |
| **SECURITY_IMPLEMENTATION_PLAN.md** | Full implementation plan with 14 tickets and 60+ tasks | Planning work or implementing specific tickets |
| **SECURITY_IMPLEMENTATION_SUMMARY.md** | Executive overview and success criteria | High-level planning or status reporting |
| **SECURITY_QUICK_REFERENCE.md** | This file - Quick lookups | Need quick answers during implementation |

---

## 🎯 Ticket Quick Lookup

### P0 - CRITICAL (Week 1) - Production Blockers

| ID | Issue | Effort | Agent | Files |
|----|-------|--------|-------|-------|
| **P0-1** | JWT Secret Hardcoded | 2h | `promptliano-service-architect` | `auth-service.ts`, `.env.example`, `app.ts` |
| **P0-2** | localStorage Tokens | 1d | `promptliano-fullstack-architect` | `auth-routes.ts`, `auth-interceptor.ts`, `auth-context.tsx` |
| **P0-3** | No Rate Limiting | 4h | `promptliano-api-architect` | `auth-routes.ts`, `admin-routes.ts`, `middleware/rate-limit.ts` (new) |
| **P0-4** | No CSRF Protection | 4h | `promptliano-fullstack-architect` | `middleware/csrf.ts` (new), `app.ts`, `api-client.ts` |

### P1 - HIGH (Week 2)

| ID | Issue | Effort | Agent | Files |
|----|-------|--------|-------|-------|
| **P1-1** | No Token Blacklist | 6h | `promptliano-database-architect` + `promptliano-service-architect` | `schema.ts`, `token-blacklist-service.ts` (new), `auth-interceptor.ts` |
| **P1-2** | Timing Attacks | 3h | `promptliano-service-architect` | `auth-service.ts` |
| **P1-3** | Client-Side Auth | 2h | `promptliano-frontend-architect` | `auth-context.tsx`, `auth.ts` |

### P2 - MEDIUM (Month 1)

| ID | Issue | Effort | Agent | Files |
|----|-------|--------|-------|-------|
| **P2-1** | Input Sanitization | 4h | `promptliano-api-architect` | `middleware/validation.ts` (new), all routes |
| **P2-2** | Account Lockout | 5h | `promptliano-database-architect` + `promptliano-service-architect` | `schema.ts`, `auth-service.ts` |
| **P2-3** | Sensitive Logging | 2h | `promptliano-service-architect` | `logging/sanitize.ts` (new), `auth-service.ts` |
| **P2-4** | Weak Passwords | 3h | `promptliano-service-architect` | `auth-service.ts` |

### P3 - LOW (Future)

| ID | Issue | Effort | Agent | Files |
|----|-------|--------|-------|-------|
| **P3-1** | Error Messages | 2h | `promptliano-api-architect` | `auth-routes.ts`, `auth-service.ts` |
| **P3-2** | Token Reuse | 6h | `promptliano-database-architect` + `promptliano-service-architect` | `schema.ts`, `auth-service.ts` |

### MANDATORY

| ID | Issue | Effort | Agent | Files |
|----|-------|--------|-------|-------|
| **REVIEW-1** | Security Code Review | 4h | `staff-engineer-code-reviewer` | All security implementation files |

---

## 🤖 Agent Command Templates

### Load Service Architect
```
Load agent: promptliano-service-architect
Context: SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-1
Task: Implement JWT secret validation with forbidden defaults check
```

### Load API Architect
```
Load agent: promptliano-api-architect
Context: SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-3
Task: Implement rate limiting middleware for authentication endpoints
```

### Load Frontend Architect
```
Load agent: promptliano-frontend-architect
Context: SECURITY_IMPLEMENTATION_PLAN.md - Ticket P0-2 Task 2.3
Task: Update auth context to use cookie-based authentication
```

### Load Database Architect
```
Load agent: promptliano-database-architect
Context: SECURITY_IMPLEMENTATION_PLAN.md - Ticket P1-1 Task 5.1
Task: Create token blacklist database schema and migration
```

### Load Code Reviewer (MANDATORY)
```
Load agent: staff-engineer-code-reviewer
Context: SECURITY_IMPLEMENTATION_PLAN.md - Ticket REVIEW-1
Task: Comprehensive security implementation review before production
```

---

## 📋 Quick Checklists

### Before Starting Implementation
- [ ] Read SECURITY_IMPLEMENTATION_SUMMARY.md for overview
- [ ] Understand priority order (P0 → P1 → P2 → P3)
- [ ] Review agent assignments
- [ ] Set up development environment
- [ ] Create feature branch: `git checkout -b security-hardening`

### For Each Ticket
- [ ] Read ticket description in SECURITY_IMPLEMENTATION_PLAN.md
- [ ] Review detailed implementation in SECURITY_FIXES.md
- [ ] Load appropriate specialized agent
- [ ] Complete all tasks in order
- [ ] Run verification steps
- [ ] Run tests
- [ ] Commit changes with descriptive message

### Before Production Deployment
- [ ] All P0 tickets completed ✅
- [ ] All P1 tickets completed ✅
- [ ] All P2 tickets completed (recommended) ✅
- [ ] REVIEW-1 completed (MANDATORY) ✅
- [ ] All tests passing ✅
- [ ] Security audit score ≥ 85/100 ✅
- [ ] Production environment variables configured ✅
- [ ] Monitoring and alerting configured ✅
- [ ] Deployment runbook reviewed ✅

---

## 🔧 Common Commands

### Development
```bash
# Start development server
bun run dev

# Run tests
bun run test

# Run type check
bun run typecheck

# Run database migration
bun run db:migrate

# Generate new JWT secret
openssl rand -base64 64

# Test with specific environment
JWT_SECRET=$(openssl rand -base64 64) NODE_ENV=production bun run dev
```

### Testing Security Fixes
```bash
# Test rate limiting
for i in {1..6}; do curl -X POST http://localhost:3147/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"wrong"}'; done

# Test CSRF protection
curl -c cookies.txt http://localhost:3147/api/csrf-token
curl -b cookies.txt -X POST http://localhost:3147/api/projects \
  -H "X-CSRF-Token: <token>"

# Test httpOnly cookies
curl -c cookies.txt -X POST http://localhost:3147/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
cat cookies.txt  # Verify httpOnly flag

# Test weak secret rejection
JWT_SECRET="weak" bun run dev  # Should fail
```

---

## 📊 File Paths Quick Reference

### Most Frequently Modified Files

```
Backend (Server & Services)
├── /packages/services/src/auth-service.ts ⭐ (P0-1, P1-1, P1-2, P2-2, P2-3, P2-4)
├── /packages/server/src/routes/auth-routes.ts ⭐ (P0-2, P0-3, P2-1, P2-2, P3-1)
├── /packages/server/src/interceptors/request/auth-interceptor.ts (P0-2, P1-1)
├── /packages/server/src/app.ts (P0-1, P0-4)
└── /packages/database/src/schema.ts (P1-1, P2-2, P3-2)

Frontend (Client)
├── /packages/client/src/contexts/auth-context.tsx ⭐ (P0-2, P1-3)
├── /packages/client/src/lib/router/auth.ts (P0-2, P1-3)
└── /packages/api-client/src/base-client.ts (P0-2, P0-4)

New Files to Create
├── /packages/server/src/middleware/rate-limit.ts (P0-3)
├── /packages/server/src/middleware/csrf.ts (P0-4)
├── /packages/services/src/token-blacklist-service.ts (P1-1)
├── /packages/server/src/jobs/token-cleanup.ts (P1-1)
├── /packages/server/src/middleware/validation.ts (P2-1)
└── /packages/shared/src/logging/sanitize.ts (P2-3)

Configuration
├── /.env.example (P0-1)
└── /packages/config/src/index.ts (P0-1 - if exists)
```

---

## 🎯 Severity Legend

| Symbol | Severity | Priority | Action |
|--------|----------|----------|--------|
| 🔴 | CRITICAL (9-10/10) | P0 | Fix immediately - production blocker |
| 🟠 | HIGH (6-8/10) | P0-P1 | Fix within 1-2 weeks |
| 🟡 | MEDIUM (4-5/10) | P2 | Fix within month 1 |
| 🟢 | LOW (1-3/10) | P3 | Fix as time permits |

---

## 📈 Progress Tracking Template

```markdown
## Security Implementation Progress

### Week 1 - P0 CRITICAL
- [ ] P0-1: JWT Secret Hardcoded (2h)
  - [ ] Task 1.1: JWT Secret Validation
  - [ ] Task 1.2: Server Startup Checks
  - [ ] Task 1.3: Environment Documentation
- [ ] P0-2: localStorage Token Storage (1d)
  - [ ] Task 2.1: Cookie-Based Auth on Server
  - [ ] Task 2.2: Update Auth Interceptor
  - [ ] Task 2.3: Update Frontend Auth Context
  - [ ] Task 2.4: Update API Client
  - [ ] Task 2.5: Update Router Auth Guard
  - [ ] Task 2.6: Migration Guide
- [ ] P0-3: No Rate Limiting (4h)
  - [ ] Task 3.1: Install Dependencies
  - [ ] Task 3.2: Create Rate Limiting Middleware
  - [ ] Task 3.3: Apply to Auth Routes
  - [ ] Task 3.4: Apply to Admin Routes
- [ ] P0-4: Missing CSRF Protection (4h)
  - [ ] Task 4.1: Install Dependencies
  - [ ] Task 4.2: Implement CSRF Middleware
  - [ ] Task 4.3: Update API Client
  - [ ] Task 4.4: Apply to Routes

### Week 2 - P1 HIGH
- [ ] P1-1: No Token Blacklist (6h)
- [ ] P1-2: Timing Attacks (3h)
- [ ] P1-3: Client-Side Auth (2h)

### Month 1 - P2 MEDIUM
- [ ] P2-1: Input Sanitization (4h)
- [ ] P2-2: Account Lockout (5h)
- [ ] P2-3: Sensitive Logging (2h)
- [ ] P2-4: Weak Passwords (3h)

### MANDATORY
- [ ] REVIEW-1: Comprehensive Security Review (4h)
```

---

## ⚠️ Critical Reminders

### DO NOT
- ❌ Skip P0 tickets
- ❌ Deploy to production without REVIEW-1
- ❌ Modify security code without agent review
- ❌ Use default JWT secrets in any environment
- ❌ Store tokens in localStorage
- ❌ Skip verification steps

### DO
- ✅ Complete tickets in priority order
- ✅ Run all verification steps
- ✅ Complete comprehensive code review
- ✅ Test each fix thoroughly
- ✅ Update documentation
- ✅ Configure production environment variables

---

## 🚀 Quick Start Commands

### Start Security Implementation
```bash
# 1. Create feature branch
git checkout -b security-hardening

# 2. Review plan
cat SECURITY_IMPLEMENTATION_SUMMARY.md

# 3. Start with P0-1
# Load agent: promptliano-service-architect
# Implement JWT secret validation

# 4. Test implementation
JWT_SECRET="weak" bun run dev  # Should fail
JWT_SECRET=$(openssl rand -base64 64) bun run dev  # Should succeed

# 5. Commit
git add .
git commit -m "Security: Implement JWT secret validation (P0-1)"
```

---

## 📞 Help & Resources

### Need Help?
1. **Check SECURITY_FIXES.md** - Complete code examples for each fix
2. **Check SECURITY_IMPLEMENTATION_PLAN.md** - Detailed task breakdown
3. **Review verification steps** - Each task includes testing commands
4. **Load appropriate agent** - Specialized agents know how to implement

### Documentation Structure
```
SECURITY_FIXES.md                    ← Technical details + code examples
SECURITY_IMPLEMENTATION_PLAN.md      ← Complete implementation guide
SECURITY_IMPLEMENTATION_SUMMARY.md   ← Executive overview
SECURITY_QUICK_REFERENCE.md          ← This file (quick lookups)
```

---

**Remember:** Security is a systematic process. Follow the plan, use the specialized agents, complete verification steps, and finish with comprehensive code review.

**Next Step:** Read `SECURITY_IMPLEMENTATION_SUMMARY.md` for the executive overview, then start implementing P0 tickets in order.
