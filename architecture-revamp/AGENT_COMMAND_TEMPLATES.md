# 🤖 Agent Command Templates - Copy-Paste Ready

## 🚀 Quick Start: Phase Execution Commands

### Phase 1: Database Foundation (ACTIVE NOW)

#### Primary Agent Command
```typescript
Task(
  subagent_type: "drizzle-migration-architect",
  description: "Execute Phase 1: Database Foundation with TDD",
  prompt: """
  EXECUTE PHASE 1: Drizzle ORM Migration (87% Storage Reduction)
  
  MISSION: Transform manual SQLite to Drizzle ORM following TDD principles
  
  STEP-BY-STEP EXECUTION:
  
  1. TEST-FIRST APPROACH:
     - Create packages/database/src/tests/schema.test.ts
     - Write failing tests for all entity schemas
     - Write failing tests for query operations
     - Write failing tests for relationship queries
  
  2. IMPLEMENT TO PASS TESTS:
     - Create packages/database/schema.ts (single source of truth)
     - Define all 15 entity tables with Drizzle syntax
     - Set up drizzle-zod for auto-schema generation
     - Implement repositories to pass query tests
  
  3. PARALLEL TASKS:
     - Schema definition (independent)
     - Migration script creation (depends on schema)
     - Repository implementation (depends on schema)
     - Performance benchmarking (depends on repositories)
  
  4. SUCCESS VALIDATION:
     - All tests pass (bun run test:database)
     - Performance benchmarks meet 6-20x improvement
     - Type safety: bun run typecheck:database
     - Code review with staff-engineer-code-reviewer
  
  CRITICAL FILES TO CREATE:
  - packages/database/package.json
  - packages/database/schema.ts (400 lines replacing 10,057)
  - packages/database/repositories/ (10 files)
  - packages/database/migrations/ (migration scripts)
  - packages/database/src/tests/ (comprehensive test suite)
  
  TARGET METRICS:
  - Code reduction: 9,678 → 2,700 lines (87% reduction)
  - Query performance: 6-20x improvement
  - Type inference: 100% compile-time validation
  - Manual converters eliminated: 376 lines → 0
  
  POST-COMPLETION:
  - Run staff-engineer-code-reviewer
  - Validate all success criteria
  - Prepare Phase 2 parallel tasks
  """
)
```

#### Supporting Agent Commands (Run in Parallel)

```typescript
// Schema Testing Agent
Task(
  subagent_type: "api-test-automation-expert",
  description: "Create comprehensive database test suite",
  prompt: """
  CREATE PHASE 1 TEST SUITE: Database Schema & Query Testing
  
  TDD REQUIREMENTS:
  1. Write failing tests FIRST for all schemas
  2. Write failing tests for CRUD operations
  3. Write failing tests for relationship queries
  4. Write performance benchmark tests
  
  FILES TO CREATE:
  - packages/database/src/tests/schema.test.ts
  - packages/database/src/tests/queries.test.ts
  - packages/database/src/tests/relationships.test.ts
  - packages/database/src/tests/performance.test.ts
  """
)

// Type Safety Validation Agent
Task(
  subagent_type: "typescript-type-safety-auditor",
  description: "Ensure 100% type safety in database layer",
  prompt: """
  VALIDATE TYPE SAFETY: Database Layer
  
  REQUIREMENTS:
  - 100% TypeScript coverage
  - Zero 'any' types
  - Complete type inference from Drizzle
  - Zod schema integration
  """
)
```

---

### Phase 2: Storage & Service Migration

#### Primary Command (Parallel Execution)
```typescript
// Storage Migration
Task(
  subagent_type: "promptliano-sqlite-expert",
  description: "Migrate all storage classes to Drizzle",
  prompt: """
  EXECUTE PHASE 2A: Storage Layer Migration
  
  TDD APPROACH:
  1. Test current storage behavior
  2. Implement Drizzle equivalent
  3. Validate behavior matches exactly
  4. Remove legacy storage classes
  
  PARALLEL ENTITY MIGRATION:
  - chat-storage.ts → Drizzle queries
  - project-storage.ts → Drizzle queries
  - ticket-storage.ts → Drizzle queries
  - queue-storage.ts → Drizzle queries
  - task-storage.ts → Drizzle queries
  - (All 15 storage classes)
  
  SUCCESS CRITERIA:
  - All storage tests pass
  - Behavior identical to legacy
  - Performance improved 6-20x
  - Zero field mappings remain
  """
)

// Service Modernization (Parallel)
Task(
  subagent_type: "promptliano-service-architect", 
  description: "Modernize service layer with functional patterns",
  prompt: """
  EXECUTE PHASE 2B: Service Layer Modernization
  
  TDD APPROACH:
  1. Test current service APIs
  2. Implement functional factories
  3. Integrate with new storage layer
  4. Validate API compatibility
  
  PARALLEL SERVICE MIGRATION:
  - chatService → functional factory
  - projectService → functional factory
  - ticketService → functional factory
  - queueService → functional factory
  - (All services)
  
  SUCCESS CRITERIA:
  - All service tests pass
  - 75% code reduction achieved
  - Error factory integration complete
  """
)
```

---

### Phase 3: API & Backend

#### Route Generation Command
```typescript
Task(
  subagent_type: "hono-bun-api-architect",
  description: "Implement route generation system",
  prompt: """
  EXECUTE PHASE 3: Route Generation & Error Factory
  
  TDD IMPLEMENTATION:
  1. Test route generation from schemas
  2. Implement route generator utility
  3. Test error factory patterns
  4. Implement unified error handling
  
  PARALLEL TASKS:
  - Route generator CLI tool
  - Error factory implementation
  - Interceptor system setup
  - OpenAPI auto-generation
  
  SUCCESS CRITERIA:
  - All route tests pass
  - 40% route code reduction
  - Consistent error handling
  - OpenAPI docs auto-generated
  """
)
```

---

### Phase 4: Frontend Hook Factories

#### Hook Factory Command
```typescript
Task(
  subagent_type: "promptliano-ui-architect",
  description: "Implement frontend hook factory system",
  prompt: """
  EXECUTE PHASE 4: Frontend Hook Factory Revolution
  
  MISSION: Eliminate 44,000+ lines of hook duplication
  
  TDD APPROACH:
  1. Test hook factory utilities
  2. Test entity hook generation
  3. Test optimistic updates
  4. Implement to pass all tests
  
  PARALLEL ENTITY MIGRATION:
  - Project hooks → factory pattern
  - Ticket hooks → factory pattern  
  - Chat hooks → factory pattern
  - Queue hooks → factory pattern
  - Task hooks → factory pattern
  - (All 22 entity types)
  
  SUCCESS CRITERIA:
  - All hook tests pass
  - 76% code reduction achieved
  - Optimistic updates working
  - Query key standardization complete
  
  SPECIFIC TASKS:
  1. Create packages/client/src/hooks/factories/
  2. Implement createEntityHooks factory
  3. Implement relationship hook patterns
  4. Migrate all individual hook files
  5. Test with existing components
  """
)
```

---

### Phase 5: Frontend Optimizations

#### Optimization Command
```typescript
Task(
  subagent_type: "promptliano-ui-architect",
  description: "Implement frontend performance optimizations",
  prompt: """
  EXECUTE PHASE 5: Frontend Performance Optimizations
  
  TARGET: 80% faster perceived performance
  
  TDD IMPLEMENTATION:
  1. Test performance monitoring
  2. Test prefetching behavior
  3. Test cross-tab synchronization
  4. Implement optimizations
  
  PARALLEL OPTIMIZATION TASKS:
  - Intelligent prefetching system
  - Cross-tab synchronization
  - Unified error handling
  - Performance monitoring
  - Batch operations
  
  SUCCESS CRITERIA:
  - 80% perceived performance improvement
  - Cross-tab sync working
  - Error handling unified
  - Performance metrics available
  """
)
```

---

### Phase 6: Integration & Cleanup

#### Final Integration Command
```typescript
Task(
  subagent_type: "code-simplifier-auditor",
  description: "Execute final cleanup and integration",
  prompt: """
  EXECUTE PHASE 6: Integration & Cleanup
  
  COMPREHENSIVE VALIDATION:
  1. Remove all legacy code
  2. Update all imports
  3. Run full test suite
  4. Validate performance targets
  5. Complete documentation
  
  SUCCESS VALIDATION:
  - 64,000+ lines eliminated
  - All tests passing
  - Performance targets met
  - Documentation complete
  """
)
```

---

## 🧪 TDD Command Templates

### Create Test First
```typescript
Task(
  subagent_type: "api-test-automation-expert",
  description: "Create failing tests for [FEATURE]",
  prompt: """
  TDD STEP 1: Create failing tests for [FEATURE]
  
  WRITE FAILING TESTS FOR:
  - Core functionality
  - Edge cases
  - Error scenarios
  - Performance requirements
  
  TEST FILES TO CREATE:
  - packages/[package]/src/tests/[feature].test.ts
  
  ENSURE TESTS FAIL INITIALLY (RED phase)
  """
)
```

### Implement to Pass Tests
```typescript
Task(
  subagent_type: "[appropriate-agent]",
  description: "Implement [FEATURE] to pass tests", 
  prompt: """
  TDD STEP 2: Implement [FEATURE] to pass failing tests
  
  IMPLEMENTATION REQUIREMENTS:
  - Make all tests pass (GREEN phase)
  - Minimal viable implementation
  - Focus on passing tests first
  - Optimize in refactor phase
  
  FILES TO CREATE:
  - [implementation files]
  """
)
```

### Refactor and Optimize
```typescript
Task(
  subagent_type: "[appropriate-agent]",
  description: "Refactor [FEATURE] while keeping tests green",
  prompt: """
  TDD STEP 3: Refactor [FEATURE] for optimization
  
  REFACTORING GOALS:
  - Improve performance
  - Enhance readability
  - Follow patterns
  - Maintain test coverage
  
  ENSURE: All tests remain green during refactoring
  """
)
```

### Code Review
```typescript
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Review [FEATURE] implementation",
  prompt: """
  TDD STEP 4: Comprehensive code review of [FEATURE]
  
  REVIEW CRITERIA:
  - Code quality and patterns
  - Security considerations
  - Performance implications
  - Test coverage adequacy
  - Documentation completeness
  
  CRITICAL: Do not approve if quality standards not met
  """
)
```

---

## 🚀 Parallel Execution Templates

### Launch Multiple Agents
```typescript
// Phase 1 Parallel Execution Example
const phase1Tasks = await Promise.all([
  Task(subagent_type: "drizzle-migration-architect", task: "schemas"),
  Task(subagent_type: "api-test-automation-expert", task: "tests"),
  Task(subagent_type: "typescript-type-safety-auditor", task: "types")
])
```

### Sequential with Dependencies
```typescript
// Phase 2 Sequential Example
const storageComplete = await Task(subagent_type: "promptliano-sqlite-expert", ...)
const serviceComplete = await Task(subagent_type: "promptliano-service-architect", ...)
const integrationComplete = await Task(subagent_type: "hono-bun-api-architect", ...)
```

---

## 📊 Validation Commands

### Performance Benchmarking
```bash
# After each phase
bun run benchmark:compare --phase=[1-6]

# Specific benchmarks
bun run benchmark:queries --compare-baseline
bun run benchmark:hooks --measure-reduction
bun run benchmark:bundle --size-analysis
```

### Quality Gates
```bash
# Before phase completion
bun run validate:quick
bun run test:all
bun run typecheck
bun run test:coverage --min-coverage=90
```

### Success Metrics Validation
```bash
# Code reduction measurement
find packages -name "*.ts" -not -path "*/node_modules/*" | xargs wc -l

# Performance comparison
bun run benchmark:all --report --compare-baseline

# Type safety coverage
bun run typecheck:coverage --report
```

---

## 🚨 Emergency Commands

### Rollback Procedures
```typescript
Task(
  subagent_type: "simple-git-integration-expert",
  description: "Emergency rollback for phase [X]",
  prompt: """
  EMERGENCY ROLLBACK: Phase [X] failed
  
  ROLLBACK STEPS:
  1. Revert to last known good state
  2. Preserve test improvements
  3. Analyze failure points
  4. Create recovery plan
  
  CRITICAL: Maintain system stability
  """
)
```

### Debug Performance Issues
```typescript
Task(
  subagent_type: "typescript-type-safety-auditor",
  description: "Debug performance regression",
  prompt: """
  DEBUG PERFORMANCE REGRESSION
  
  INVESTIGATION:
  1. Profile slow operations
  2. Compare with baseline
  3. Identify bottlenecks
  4. Propose optimizations
  
  TOOLS: Use profiler and benchmark suite
  """
)
```

---

## 🎯 Phase Completion Validation

### Final Phase Review
```typescript
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Complete phase [X] validation",
  prompt: """
  PHASE [X] COMPLETION REVIEW
  
  VALIDATE ALL CRITERIA:
  - [ ] All tests passing
  - [ ] Performance targets met
  - [ ] Code review approved
  - [ ] Documentation updated
  - [ ] No regressions introduced
  - [ ] Success metrics achieved
  
  DO NOT APPROVE unless ALL criteria met
  """
)
```

---

## 💡 Quick Reference

### Most Common Commands
- **Start Phase 1**: Copy Phase 1 Primary Agent Command
- **Run Tests**: `bun run test:all`
- **Check Performance**: `bun run benchmark:compare`
- **Code Review**: Use staff-engineer-code-reviewer
- **Validate Types**: `bun run typecheck`

### Emergency Contacts
- **Performance Issues**: Use performance profiling commands
- **Test Failures**: Check specific test output with `--verbose`
- **Type Errors**: Run `typecheck` with specific package
- **Build Failures**: Check for missing dependencies

**Remember: Every command should follow TDD → Review → Validate pattern**