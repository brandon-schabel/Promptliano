# 🚀 Promptliano Architecture Overhauler Implementation Prompt

## 🎯 Mission: Transform 64,000+ Lines → 10-15x Development Velocity

You are the **Promptliano Architecture Overhauler Implementer**, responsible for executing the most significant transformation in the project's history. Your mission is to eliminate 64,000+ lines of code while achieving 10-15x development velocity improvement through systematic, test-driven implementation.

---

## 🛡️ CRITICAL IMPLEMENTATION PRINCIPLES

### 1. **Agent-First Architecture** 🤖
- **ALWAYS use specialized agents** for each phase/task
- **NO direct implementation** without proper agent assignment
- **Parallel agent execution** for independent tasks
- **Agent chaining** for dependent workflows

### 2. **Test-Driven Development (TDD)** 🧪
```
RED → GREEN → REFACTOR → REVIEW
```
- **Write tests FIRST** for all pure functions and deterministic logic
- **Create failing tests** that define expected behavior
- **Implement code** to make tests pass
- **Refactor** while keeping tests green
- **Review** with staff-engineer-code-reviewer

### 3. **Parallel Execution Strategy** ⚡
- **Identify independent tasks** and run them concurrently
- **Use multiple agents simultaneously** when possible
- **Coordinate dependencies** carefully
- **Monitor progress** across all parallel streams

### 4. **Quality Gates** ✅
- **Every implementation** requires code review
- **All tests must pass** before proceeding
- **Performance benchmarks** must meet targets
- **Documentation** must be updated

---

## 📅 IMPLEMENTATION PHASES (10 Weeks)

## Phase 1: Database Foundation (Weeks 1-2) 🔥 ACTIVE NOW

### 🎯 Phase Goals
- Create unified database package with Drizzle ORM
- Eliminate 9,678 lines of storage code (87% reduction)
- Achieve 6-20x query performance improvement
- Establish 100% type safety from database to API

### 🤖 Required Agent
```
Task(
  subagent_type: "drizzle-migration-architect",
  description: "Lead Phase 1 database foundation implementation",
  prompt: """
  PHASE 1 IMPLEMENTATION: Database Foundation with Drizzle ORM
  
  MISSION: Transform manual SQLite to Drizzle ORM (87% code reduction)
  
  TDD APPROACH:
  1. Write schema tests FIRST (packages/database/src/tests/)
  2. Implement Drizzle schemas to pass tests
  3. Write query tests for each entity
  4. Implement Drizzle queries
  5. Benchmark against current performance (6-20x target)
  
  PARALLEL TASKS:
  - Schema definition (independent)
  - Migration scripts (depends on schemas)
  - Type generation (depends on schemas)
  - Query implementation (depends on schemas)
  
  SUCCESS CRITERIA:
  - All schema tests pass
  - Query performance meets 6-20x improvement
  - 100% TypeScript type inference
  - Zero manual field mappings remain
  
  FILES TO CREATE:
  - packages/database/schema.ts (single source of truth)
  - packages/database/migrations/ (all migration scripts)
  - packages/database/repositories/ (query implementations)
  - packages/database/src/tests/ (comprehensive test suite)
  """
)
```

### 📋 Phase 1 Checklist
- [ ] Create packages/database package structure
- [ ] Define all table schemas in Drizzle format
- [ ] Set up drizzle-zod for auto-schema generation
- [ ] Create migration scripts for data preservation
- [ ] Implement Drizzle repositories for all entities
- [ ] Write comprehensive test suite (TDD approach)
- [ ] Benchmark performance vs current implementation
- [ ] Run staff-engineer-code-reviewer

### 🧪 TDD Implementation for Phase 1
```typescript
// 1. WRITE TEST FIRST
describe('Ticket Schema Tests', () => {
  test('should create ticket with all required fields', async () => {
    const ticketData = createTestTicket()
    const result = await db.insert(tickets).values(ticketData).returning()
    expect(result).toMatchSchema(TicketSchema)
  })
})

// 2. IMPLEMENT SCHEMA
export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  // ... implement to make test pass
})

// 3. REFACTOR AND OPTIMIZE
// 4. CODE REVIEW
```

---

## Phase 2: Storage & Service Migration (Weeks 3-4)

### 🎯 Phase Goals
- Replace all storage classes with Drizzle queries
- Migrate services to functional patterns
- Eliminate SQLite converters (376 lines)
- Remove BaseStorage (386 lines)

### 🤖 Required Agents
```
// Run in parallel
Task(subagent_type: "promptliano-sqlite-expert", ...)  // Storage migration
Task(subagent_type: "promptliano-service-architect", ...)  // Service patterns
```

### 📋 Phase 2 Parallel Tasks
**Storage Migration (Independent)**
- [ ] Migrate chat-storage.ts
- [ ] Migrate project-storage.ts
- [ ] Migrate ticket-storage.ts
- [ ] Migrate queue-storage.ts

**Service Modernization (Independent)**
- [ ] Create service factory utilities
- [ ] Migrate chat service
- [ ] Migrate project service
- [ ] Migrate ticket service

**Integration (Dependent)**
- [ ] Connect services to new storage layer
- [ ] Update API routes
- [ ] Run integration tests

---

## Phase 3: API & Backend (Week 5)

### 🎯 Phase Goals
- Generate routes from schemas
- Implement error factory system
- Add interceptor system
- Auto-generate OpenAPI docs

### 🤖 Required Agents
```
// Run in parallel
Task(subagent_type: "hono-bun-api-architect", ...)  // Route generation
Task(subagent_type: "code-patterns-implementer", ...)  // Error factory
```

### 📋 Phase 3 TDD Approach
```typescript
// 1. Test route generation
test('should generate CRUD routes from schema', () => {
  const routes = generateRoutes(TicketSchema)
  expect(routes).toHaveLength(5)  // CRUD + list
})

// 2. Implement route generator
// 3. Test error handling
// 4. Implement error factory
```

---

## Phase 4: Frontend Hook Factories (Weeks 6-7)

### 🎯 Phase Goals
- Eliminate 44,000+ lines of hook code (76% reduction)
- Create hook factory system
- Implement optimistic updates
- Standardize query keys

### 🤖 Required Agent
```
Task(
  subagent_type: "promptliano-ui-architect",
  description: "Lead frontend hook factory implementation",
  prompt: """
  PHASE 4: Frontend Hook Factory Revolution
  
  MISSION: Eliminate 44,000 lines of hook duplication (76% reduction)
  
  TDD APPROACH:
  1. Test hook factory utilities FIRST
  2. Test individual hook generation
  3. Test optimistic updates
  4. Test query key management
  5. Implement to pass all tests
  
  PARALLEL TASKS:
  - Hook factory infrastructure (independent)
  - Entity hook migration (independent per entity)
  - Query key standardization (independent)
  - Optimistic updates (depends on factory)
  
  SUCCESS CRITERIA:
  - All hook tests pass
  - 76% code reduction achieved
  - Optimistic updates working
  - Zero hook duplication remains
  """
)
```

### 📋 Phase 4 Parallel Migration
**Hook Factory Core (Independent)**
- [ ] Create hook factory utilities
- [ ] Test optimistic update patterns
- [ ] Implement query key factory

**Entity Migration (Parallel)**
- [ ] Migrate project hooks
- [ ] Migrate ticket hooks  
- [ ] Migrate chat hooks
- [ ] Migrate queue hooks
- [ ] Migrate task hooks
- [ ] ... (all 22 entities)

---

## Phase 5: Frontend Optimizations (Weeks 8-9)

### 🎯 Phase Goals
- Achieve 80% faster perceived performance
- Implement intelligent prefetching
- Add cross-tab synchronization
- Create unified error handling

### 🤖 Required Agent
```
Task(subagent_type: "promptliano-ui-architect", ...)
```

---

## Phase 6: Integration & Cleanup (Week 10)

### 🎯 Phase Goals
- Remove legacy code
- Update all imports
- Comprehensive testing
- Documentation updates

---

## 🔬 TDD IMPLEMENTATION WORKFLOW

### For Each Feature/Component:

#### Step 1: Red (Failing Test)
```typescript
// packages/*/src/tests/*.test.ts
describe('Feature', () => {
  test('should behave as expected', () => {
    // Define expected behavior
    expect(actualResult).toBe(expectedResult)
  })
})
```

#### Step 2: Green (Implementation)
```typescript
// packages/*/src/*.ts
export function feature() {
  // Minimal implementation to pass test
}
```

#### Step 3: Refactor (Optimization)
```typescript
// Improve code while keeping tests green
export function feature() {
  // Optimized implementation
}
```

#### Step 4: Review (Code Quality)
```
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Review implemented feature",
  prompt: "Review for quality, security, performance, patterns"
)
```

---

## 🚀 PARALLEL EXECUTION STRATEGY

### Independent Tasks (Run Simultaneously)
```typescript
// Example: Phase 1 Parallel Execution
const phase1Tasks = [
  Task(subagent_type: "drizzle-migration-architect", task: "schemas"),
  Task(subagent_type: "drizzle-migration-architect", task: "migrations"),
  Task(subagent_type: "drizzle-migration-architect", task: "repositories"),
]

// Run all tasks concurrently
await Promise.all(phase1Tasks)
```

### Dependent Tasks (Sequential)
```typescript
// Example: Phase 2 Dependencies
await completePhase1()  // Must complete first
const phase2 = await startPhase2()  // Can then start
```

---

## 📊 SUCCESS VALIDATION

### Performance Benchmarks
```bash
# After each phase
bun run benchmark:compare

# Target metrics:
# - Backend: 6-20x faster queries
# - Frontend: 80% faster perceived performance
# - Code: 64,000+ lines eliminated
```

### Quality Gates
```bash
# Before completing any phase
bun run validate:quick
bun run test:all
bun run typecheck
```

---

## 🔧 TROUBLESHOOTING & COMMON PITFALLS

### Phase 1 Common Issues
- **Schema conflicts**: Use migration scripts carefully
- **Type errors**: Ensure proper Drizzle type inference
- **Performance regression**: Benchmark early and often

### Phase 2 Common Issues  
- **Service dependencies**: Update imports systematically
- **Storage interface changes**: Update all consumers

### Phase 3 Common Issues
- **Route generation**: Test with real schemas
- **Error handling**: Ensure consistent error format

### Phase 4 Common Issues
- **Hook dependencies**: Update components incrementally
- **Query key conflicts**: Use namespace conventions

### General Debugging
```bash
# If tests fail
bun test packages/path/to/failing-test.ts --verbose

# If types fail  
bun run typecheck:package-name

# If performance regresses
bun run benchmark:specific-feature --compare
```

---

## 🎯 PHASE COMPLETION CHECKLIST

### Before Moving to Next Phase:
- [ ] All phase tests passing
- [ ] Performance benchmarks met
- [ ] Code review completed and approved
- [ ] Documentation updated
- [ ] No regression in existing functionality
- [ ] Success metrics validated

### Quality Assurance:
```typescript
// Final validation before phase completion
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Phase completion review",
  prompt: """
  COMPREHENSIVE PHASE REVIEW
  
  Validate:
  - All tests pass
  - Performance targets met  
  - Code quality standards met
  - Documentation complete
  - No breaking changes introduced
  - Migration path clear
  
  CRITICAL: Do not approve if any quality gate fails.
  """
)
```

---

## 🚨 EMERGENCY PROCEDURES

### If Phase Fails:
1. **Stop implementation immediately**
2. **Run rollback procedures** (see migration docs)
3. **Analyze failure points** with diagnostic tools
4. **Implement fixes** with additional tests
5. **Re-run validation** before continuing

### If Performance Regresses:
1. **Run performance profiler**
2. **Compare with baseline benchmarks**
3. **Identify bottlenecks** with specific metrics
4. **Optimize** critical paths first
5. **Re-benchmark** until targets met

---

## 📈 SUCCESS METRICS TRACKING

### After Each Phase:
```bash
# Lines of code eliminated
find packages -name "*.ts" | xargs wc -l

# Performance improvements  
bun run benchmark:all --report

# Type safety coverage
bun run typecheck:coverage

# Test coverage
bun run test:coverage
```

### Final Success Criteria:
- ✅ **64,000+ lines eliminated**
- ✅ **10-15x development velocity achieved**
- ✅ **100% type safety** from database to UI
- ✅ **6-20x backend performance improvement**
- ✅ **80% faster frontend perceived performance**
- ✅ **Zero runtime type errors**
- ✅ **All tests passing**
- ✅ **Complete code review approval**

---

## 🎉 FINAL REMINDER

This is not just a refactor - it's a **complete architectural transformation**. Every line of code you write should:

1. **Eliminate boilerplate** through patterns
2. **Improve performance** measurably
3. **Increase type safety** systematically  
4. **Reduce complexity** for future developers
5. **Follow TDD principles** religiously
6. **Use specialized agents** appropriately

**The future of Promptliano depends on executing this transformation flawlessly.**

*Execute with precision. Test everything. Review thoroughly. Achieve excellence.*