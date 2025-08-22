# Architecture Improvements - Dependency Graph

## 📋 Dependencies TODO Tracker

### 🔴 Critical Package Dependencies (Must Complete First)

#### Drizzle ORM Installation & Setup
- [ ] Install core Drizzle packages: `drizzle-orm`, `drizzle-kit` (Priority: HIGH) [2 hours]
- [ ] Install SQLite driver: `better-sqlite3` and types (Priority: HIGH) [1 hour]
- [ ] Configure Drizzle config file and connection setup (Priority: HIGH) [3 hours]
- [ ] Set up Drizzle migrations directory and tooling (Priority: HIGH) [2 hours]
- [ ] Create initial migration scripts from existing schemas (Priority: HIGH) [8 hours]

#### Development Environment Updates
- [ ] Update workspace TypeScript configs for Drizzle (Priority: HIGH) [2 hours]
- [ ] Configure ESLint rules for Drizzle patterns (Priority: MEDIUM) [1 hour]
- [ ] Set up development database seeding scripts (Priority: MEDIUM) [3 hours]
- [ ] Update .gitignore for Drizzle generated files (Priority: LOW) [0.5 hours]

### 🟡 Package Dependency Updates & Conflicts

#### Core Package Updates
- [ ] Audit and update all database-related packages (Priority: HIGH) [4 hours]
- [ ] Resolve version conflicts between ORM packages (Priority: HIGH) [3 hours]
- [ ] Update @promptliano/schemas dependencies (Priority: HIGH) [2 hours]
- [ ] Update @promptliano/storage package.json (Priority: HIGH) [1 hour]
- [ ] Update @promptliano/services dependencies (Priority: MEDIUM) [2 hours]

#### Type Safety & Validation
- [ ] Update Zod to latest compatible version (Priority: MEDIUM) [2 hours]
- [ ] Ensure TypeScript version compatibility across workspace (Priority: HIGH) [3 hours]
- [ ] Update type definition packages (@types/*) (Priority: MEDIUM) [1 hour]
- [ ] Resolve any peer dependency warnings (Priority: LOW) [2 hours]

### 🟢 Development Tooling Dependencies

#### Build & Test Configuration
- [ ] Update Bun configurations for new packages (Priority: MEDIUM) [2 hours]
- [ ] Configure test environment for Drizzle (Priority: MEDIUM) [3 hours]
- [ ] Update package.json scripts for migration commands (Priority: MEDIUM) [1 hour]
- [ ] Set up database test fixtures and cleanup (Priority: MEDIUM) [4 hours]
- [ ] Update CI/CD pipeline for new dependencies (Priority: HIGH) [3 hours]

#### Code Generation & Tooling
- [ ] Install and configure Drizzle Studio (Priority: LOW) [1 hour]
- [ ] Set up database introspection tooling (Priority: LOW) [2 hours]
- [ ] Configure schema validation in pre-commit hooks (Priority: MEDIUM) [2 hours]
- [ ] Update code generation scripts for new patterns (Priority: MEDIUM) [3 hours]

### 🔵 Frontend Dependencies (After Backend Complete)

#### Hook Factory Dependencies
- [ ] Update React Query/Tanstack Query version (Priority: MEDIUM) [2 hours]
- [ ] Install any new React dev dependencies (Priority: LOW) [1 hour]
- [ ] Update frontend build tools for new patterns (Priority: MEDIUM) [2 hours]
- [ ] Configure frontend testing with new backend (Priority: MEDIUM) [3 hours]

### 📚 Documentation Dependencies

#### Package Documentation
- [ ] Update package.json descriptions and keywords (Priority: LOW) [1 hour]
- [ ] Create dependency decision log (Priority: MEDIUM) [2 hours]
- [ ] Document new development setup procedures (Priority: MEDIUM) [3 hours]
- [ ] Update troubleshooting guides for new stack (Priority: MEDIUM) [2 hours]
- [ ] Create migration rollback procedures (Priority: HIGH) [4 hours]

#### API Documentation
- [ ] Update OpenAPI specs for schema changes (Priority: HIGH) [4 hours]
- [ ] Document new validation patterns (Priority: MEDIUM) [2 hours]
- [ ] Update client SDK documentation (Priority: MEDIUM) [2 hours]

### 🚨 Risk Mitigation Tasks

#### Backup & Rollback Preparation
- [ ] Create database backup procedures (Priority: HIGH) [2 hours]
- [ ] Set up feature flags for gradual rollout (Priority: HIGH) [4 hours]
- [ ] Create rollback scripts for dependencies (Priority: HIGH) [3 hours]
- [ ] Test rollback procedures in staging (Priority: HIGH) [2 hours]

#### Version Lock & Security
- [ ] Pin critical dependency versions (Priority: HIGH) [1 hour]
- [ ] Run security audit on new packages (Priority: HIGH) [1 hour]
- [ ] Update dependency license compliance (Priority: MEDIUM) [1 hour]
- [ ] Set up automated dependency monitoring (Priority: LOW) [2 hours]

### 📊 Progress Tracking

#### Completion Metrics
- [ ] Set up dependency health dashboard (Priority: LOW) [3 hours]
- [ ] Create migration progress tracking (Priority: MEDIUM) [2 hours]
- [ ] Monitor build performance with new deps (Priority: MEDIUM) [1 hour]
- [ ] Track bundle size impact (Priority: MEDIUM) [1 hour]

**Total Estimated Hours: 94 hours**
**Critical Path Hours: 18 hours**
**Parallel Work Hours: 76 hours**

---

## Overview
This document maps the dependencies between all architecture improvements, identifying what must be done sequentially and what can be done in parallel.

## Critical Path (Sequential - MUST be in order)

```mermaid
graph TD
    A[01: Drizzle ORM Migration - Foundation] --> B[02: Storage Layer Overhaul]
    B --> C[03: Service Layer Patterns]
    A --> D[07: Frontend Hook Factory]
    D --> E[08: Frontend Optimizations]
```

## Parallel Work Opportunities

### After Drizzle ORM is complete, these can be done in parallel:

```mermaid
graph TD
    A[01: Drizzle ORM Complete] --> B[Group 1: Storage/Services]
    A --> C[Group 2: Route Generation]
    A --> D[Group 3: Error Handling]
    A --> E[Group 4: Interceptors]
    A --> F[Group 5: Frontend Hooks]
```

## Detailed Dependencies

### 🔴 CRITICAL - Must Be First
**01-drizzle-orm-migration.md**
- **Dependencies:** None (Foundation)
- **Blocks:** Everything else
- **Why:** Becomes the single source of truth for all schemas
- **Estimated Time:** 1-2 weeks
- **Team Size:** 1-2 developers

### 🟡 Backend Core (Depends on Drizzle)

**02-storage-layer-overhaul.md**
- **Dependencies:** 01 (Drizzle ORM)
- **Blocks:** 03 (Service Layer)
- **Can parallel with:** 04, 05, 06, 07
- **Estimated Time:** 2-3 weeks
- **Team Size:** 2-3 developers

**03-service-layer-patterns.md**
- **Dependencies:** 01, 02 (Drizzle + Storage)
- **Blocks:** API consumption
- **Can parallel with:** 04, 05, 06
- **Estimated Time:** 2 weeks
- **Team Size:** 2 developers

### 🟢 Parallel Backend (Can start after Drizzle)

**04-route-generation.md**
- **Dependencies:** 01 (Drizzle schemas)
- **Blocks:** None
- **Can parallel with:** 02, 05, 06, 07
- **Estimated Time:** 1 week
- **Team Size:** 1 developer

**05-error-factory.md**
- **Dependencies:** None (but better with 01)
- **Blocks:** None
- **Can parallel with:** All others
- **Estimated Time:** 3-4 days
- **Team Size:** 1 developer

**06-interceptors.md**
- **Dependencies:** None
- **Blocks:** None
- **Can parallel with:** All others
- **Estimated Time:** 3-4 days
- **Team Size:** 1 developer

### 🔵 Frontend (Depends on Backend schemas)

**07-frontend-hook-factory.md**
- **Dependencies:** 01 (Drizzle schemas)
- **Blocks:** 08 (Frontend optimizations)
- **Can parallel with:** 02, 03, 04, 05, 06
- **Estimated Time:** 2-3 weeks
- **Team Size:** 2-3 developers

**08-frontend-optimizations.md**
- **Dependencies:** 07 (Hook Factory)
- **Blocks:** None
- **Can parallel with:** Late-stage backend work
- **Estimated Time:** 1-2 weeks
- **Team Size:** 2 developers

## Optimal Team Distribution

### Sprint 1-2: Foundation (Weeks 1-2)
- **Team A (2 devs):** 01-drizzle-orm-migration.md

### Sprint 3-4: Parallel Execution (Weeks 3-4)
- **Team A (3 devs):** 02-storage-layer-overhaul.md
- **Team B (2 devs):** 07-frontend-hook-factory.md (start)
- **Team C (1 dev):** 04-route-generation.md
- **Team D (1 dev):** 05-error-factory.md + 06-interceptors.md

### Sprint 5-6: Integration (Weeks 5-6)
- **Team A (2 devs):** 03-service-layer-patterns.md
- **Team B (3 devs):** 07-frontend-hook-factory.md (complete)
- **Team C+D (2 devs):** Integration and testing

### Sprint 7-8: Optimization (Weeks 7-8)
- **Team B (2 devs):** 08-frontend-optimizations.md
- **All teams:** Migration, testing, and refinement

## Risk Mitigation

### High-Risk Dependencies
1. **Drizzle ORM Migration** - Everything depends on this
   - Mitigation: Start immediately, allocate best developers
   - Have rollback plan ready

2. **Storage Layer** - Services depend on this
   - Mitigation: Can start design while Drizzle is in progress
   - Create interfaces early

### Low-Risk Parallel Work
- Error Factory and Interceptors have no dependencies
- Can be developed and tested independently
- Can be integrated last without blocking other work

## Success Criteria

Each improvement is complete when:
1. ✅ All code is migrated to new patterns
2. ✅ Tests are passing with new implementation
3. ✅ Documentation is updated
4. ✅ No regressions in functionality
5. ✅ Performance metrics meet or exceed targets

## Quick Reference Matrix

| File | Depends On | Blocks | Can Parallel With | Priority |
|------|------------|--------|-------------------|----------|
| 01-drizzle | None | All | None | 🔴 CRITICAL |
| 02-storage | 01 | 03 | 04,05,06,07 | 🟡 HIGH |
| 03-service | 01,02 | None | 04,05,06,08 | 🟡 HIGH |
| 04-routes | 01 | None | 02,03,05,06,07 | 🟢 MEDIUM |
| 05-errors | None | None | All | 🟢 MEDIUM |
| 06-interceptors | None | None | All | 🟢 MEDIUM |
| 07-hooks | 01 | 08 | 02,03,04,05,06 | 🔵 HIGH |
| 08-frontend-opt | 07 | None | 03,04,05,06 | 🔵 MEDIUM |

## Recommended Reading Order

For understanding the full picture:
1. Read this dependencies file first
2. Read 01-drizzle-orm-migration.md (foundation)
3. Read 09-implementation-roadmap.md (timeline)
4. Then read specific improvements based on your team assignment