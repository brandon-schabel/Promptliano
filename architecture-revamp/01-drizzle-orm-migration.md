# 01: Drizzle ORM Migration - Foundation

## 📋 Migration TODO Tracker

### Prerequisites (Complete Before Starting)
- [ ] Install Drizzle dependencies (Priority: HIGH) [0.5 hours]
  - drizzle-orm, drizzle-kit, @libsql/client
- [ ] Create database backup strategy (Priority: HIGH) [1 hour]
  - Automated backup before each migration step
  - Rollback procedures documented
- [ ] Set up parallel testing environment (Priority: HIGH) [2 hours]
  - Duplicate database for A/B testing
  - Performance comparison framework
- [ ] Document current schema completely (Priority: HIGH) [3 hours]
  - Extract all table definitions from existing SQLite
  - Document all relationships and constraints
  - Identify all JSON fields and their structures

### Phase 1: Schema Definition Tasks [Days 1-2]
- [ ] Core infrastructure setup (Priority: HIGH) [4 hours]
  - [ ] Create packages/storage/src/schema/index.ts
  - [ ] Configure drizzle.config.ts with migration paths
  - [ ] Set up DrizzleDB client initialization
  - [ ] Create type export structure
- [ ] Define primary entity schemas (Priority: HIGH) [6 hours]
  - [ ] projects table with all fields and indexes
  - [ ] tickets table with queue fields
  - [ ] tasks table with ticket relationships
  - [ ] chats and chat_messages tables
  - [ ] files and selected_files tables
- [ ] Define supporting entity schemas (Priority: HIGH) [4 hours]
  - [ ] prompts table with project relationships
  - [ ] agents table with configuration JSON
  - [ ] queues and queue_items tables
  - [ ] user_preferences and settings tables
- [ ] Configure relationships and constraints (Priority: HIGH) [3 hours]
  - [ ] Set up foreign key relationships
  - [ ] Define cascade delete rules
  - [ ] Create composite indexes for performance
  - [ ] Add check constraints for enums
- [ ] Generate Zod schemas from Drizzle (Priority: HIGH) [2 hours]
  - [ ] Configure drizzle-zod integration
  - [ ] Export insert and select schemas
  - [ ] Create validation utilities
  - [ ] Test schema generation

### Phase 2: Migration Scripts [Days 3-4]
- [ ] Create migration infrastructure (Priority: HIGH) [3 hours]
  - [ ] Build migration runner with version tracking
  - [ ] Create rollback mechanism
  - [ ] Add migration validation checks
  - [ ] Set up migration testing framework
- [ ] Write data migration scripts (Priority: HIGH) [8 hours]
  - [ ] Create 001_initial_schema.ts migration
  - [ ] Handle JSON field conversions (tags, metadata)
  - [ ] Convert Unix timestamps properly
  - [ ] Preserve all existing data integrity
  - [ ] Create indexes after data migration
- [ ] Test migrations on copy database (Priority: HIGH) [4 hours]
  - [ ] Run forward migration
  - [ ] Verify data integrity
  - [ ] Test rollback procedures
  - [ ] Benchmark migration performance

### Phase 3: Repository Pattern Implementation [Days 5-6]
- [ ] Create base repository class (Priority: HIGH) [3 hours]
  - [ ] Implement CRUD operations
  - [ ] Add transaction support
  - [ ] Create query builder helpers
  - [ ] Add soft delete support
- [ ] Implement entity repositories (Priority: HIGH) [8 hours]
  - [ ] ProjectRepository with relations
  - [ ] TicketRepository with queue methods
  - [ ] TaskRepository with bulk operations
  - [ ] ChatRepository with message handling
  - [ ] FileRepository with selection logic
- [ ] Add advanced query methods (Priority: MEDIUM) [4 hours]
  - [ ] Implement pagination utilities
  - [ ] Create search functionality
  - [ ] Add aggregation queries
  - [ ] Build complex join queries
- [ ] Create repository tests (Priority: HIGH) [6 hours]
  - [ ] Unit tests for each repository
  - [ ] Integration tests with real SQLite
  - [ ] Performance benchmarks
  - [ ] Edge case testing

### Phase 4: Service Layer Integration [Days 7-8]
- [ ] Update service layer to use repositories (Priority: HIGH) [10 hours]
  - [ ] ProjectService migration
  - [ ] TicketService with queue integration
  - [ ] TaskService with bulk operations
  - [ ] ChatService with streaming support
  - [ ] FileService with summarization
- [ ] Remove old storage classes (Priority: HIGH) [4 hours]
  - [ ] Delete BaseStorage class
  - [ ] Remove individual storage classes
  - [ ] Clean up SQL converter utilities
  - [ ] Archive legacy migration files
- [ ] Update API endpoints (Priority: HIGH) [6 hours]
  - [ ] Modify Hono routes to use new services
  - [ ] Update request/response types
  - [ ] Ensure backwards compatibility
  - [ ] Add deprecation notices where needed

### Phase 5: Type Generation and Export [Days 9-10]
- [ ] Set up type generation pipeline (Priority: HIGH) [3 hours]
  - [ ] Configure automatic type generation
  - [ ] Create type export strategy
  - [ ] Set up watch mode for development
  - [ ] Add to build process
- [ ] Update frontend type imports (Priority: HIGH) [4 hours]
  - [ ] Replace manual interfaces with generated types
  - [ ] Update API client types
  - [ ] Fix TypeScript errors
  - [ ] Remove duplicate type definitions
- [ ] Create type documentation (Priority: MEDIUM) [2 hours]
  - [ ] Generate type documentation
  - [ ] Create usage examples
  - [ ] Document migration patterns
  - [ ] Add to developer guide

### Testing Requirements
- [ ] Unit test coverage (Priority: HIGH) [8 hours total]
  - [ ] Schema definition tests
  - [ ] Repository method tests
  - [ ] Service layer tests
  - [ ] Type inference tests
- [ ] Integration testing (Priority: HIGH) [6 hours total]
  - [ ] End-to-end flow tests
  - [ ] Transaction rollback tests
  - [ ] Concurrent access tests
  - [ ] Migration process tests
- [ ] Performance testing (Priority: HIGH) [4 hours total]
  - [ ] Query performance benchmarks
  - [ ] Bulk operation benchmarks
  - [ ] Memory usage analysis
  - [ ] Connection pool testing

### Performance Benchmarks to Validate
- [ ] Single entity fetch benchmark (Priority: HIGH) [1 hour]
  - Target: 8-12ms → 0.5-1ms (10x improvement)
  - [ ] Measure current performance
  - [ ] Implement Drizzle version
  - [ ] Compare and document results
- [ ] Bulk insert benchmark (Priority: HIGH) [1 hour]
  - Target: 450-600ms → 15-25ms for 100 items (20x improvement)
  - [ ] Test current implementation
  - [ ] Test Drizzle prepared statements
  - [ ] Document performance gains
- [ ] Complex join query benchmark (Priority: HIGH) [1 hour]
  - Target: 25-35ms → 2-4ms (8x improvement)
  - [ ] Identify slowest current queries
  - [ ] Rewrite with Drizzle query builder
  - [ ] Measure improvement
- [ ] Type conversion overhead (Priority: MEDIUM) [1 hour]
  - Target: 3-5ms → 0ms (compile-time)
  - [ ] Measure current runtime conversion
  - [ ] Verify compile-time with Drizzle
  - [ ] Document elimination of overhead
- [ ] Memory usage comparison (Priority: MEDIUM) [2 hours]
  - Target: 180MB → 120MB (33% reduction)
  - [ ] Profile current memory usage
  - [ ] Profile Drizzle implementation
  - [ ] Identify memory savings

### Documentation Tasks
- [ ] Create migration guide (Priority: HIGH) [3 hours]
  - [ ] Step-by-step migration instructions
  - [ ] Common pitfall warnings
  - [ ] Rollback procedures
  - [ ] Troubleshooting guide
- [ ] Update API documentation (Priority: HIGH) [2 hours]
  - [ ] Document new type exports
  - [ ] Update endpoint descriptions
  - [ ] Add migration notes
  - [ ] Create changelog
- [ ] Create developer onboarding (Priority: MEDIUM) [2 hours]
  - [ ] Drizzle basics for team
  - [ ] Repository pattern guide
  - [ ] Query builder examples
  - [ ] Best practices document
- [ ] Write post-mortem document (Priority: LOW) [1 hour]
  - [ ] Lessons learned
  - [ ] Performance improvements
  - [ ] Future recommendations
  - [ ] Team feedback

### Rollback Plan Items
- [ ] Implement feature flags (Priority: HIGH) [2 hours]
  - [ ] Create DRIZZLE_ENABLED flag
  - [ ] Dual-path service implementation
  - [ ] Runtime switching capability
  - [ ] Performance monitoring for both paths
- [ ] Create rollback scripts (Priority: HIGH) [2 hours]
  - [ ] Database rollback migrations
  - [ ] Code rollback procedures
  - [ ] Configuration rollback
  - [ ] Data validation scripts
- [ ] Set up monitoring (Priority: HIGH) [3 hours]
  - [ ] Query performance monitoring
  - [ ] Error rate tracking
  - [ ] Data integrity checks
  - [ ] Automated alerts
- [ ] Document emergency procedures (Priority: HIGH) [1 hour]
  - [ ] Rollback decision criteria
  - [ ] Step-by-step rollback process
  - [ ] Communication plan
  - [ ] Post-rollback validation

### Code Quality Checkpoints
- [ ] Remove all manual SQL strings (Priority: HIGH)
  - [ ] Audit codebase for raw SQL
  - [ ] Replace with Drizzle queries
  - [ ] Verify no SQL injection risks
- [ ] Achieve 100% type coverage (Priority: HIGH)
  - [ ] No 'any' types in storage layer
  - [ ] Full inference from database to UI
  - [ ] Strict null checks enabled
- [ ] Pass all existing tests (Priority: HIGH)
  - [ ] Run full test suite
  - [ ] Fix any breaking changes
  - [ ] Add new tests for Drizzle features
- [ ] Code review completion (Priority: HIGH)
  - [ ] Internal team review
  - [ ] Security review for SQL injection
  - [ ] Performance review
  - [ ] Architecture review

### Success Validation
- [ ] Lines of code reduction achieved (Priority: HIGH)
  - Target: 20,811 → 2,700 lines (87% reduction)
  - [ ] Measure before state
  - [ ] Measure after state
  - [ ] Document reduction
- [ ] Type safety verification (Priority: HIGH)
  - [ ] No runtime type errors
  - [ ] Full IDE autocomplete
  - [ ] Refactoring safety demonstrated
- [ ] Performance targets met (Priority: HIGH)
  - [ ] All benchmarks passing
  - [ ] No performance regressions
  - [ ] Improved query times documented
- [ ] Developer experience improved (Priority: MEDIUM)
  - [ ] Time to add new entity reduced
  - [ ] Onboarding time reduced
  - [ ] Bug reduction measured

### Post-Migration Cleanup
- [ ] Archive old code (Priority: LOW) [1 hour]
  - [ ] Move to legacy folder
  - [ ] Document removal date
  - [ ] Create cleanup PR
- [ ] Update CI/CD pipelines (Priority: MEDIUM) [2 hours]
  - [ ] Update build scripts
  - [ ] Modify test commands
  - [ ] Update deployment process
- [ ] Remove old dependencies (Priority: LOW) [0.5 hours]
  - [ ] Uninstall unused packages
  - [ ] Update package.json
  - [ ] Verify no breaking changes

### Estimated Total Time: 120-140 hours (2-3 weeks with 2 developers)

## 🔴 CRITICAL: This MUST be completed first - Everything depends on this

## Overview
Migrate from manual SQLite management to Drizzle ORM, establishing schemas as the single source of truth for the entire application. This migration will eliminate 20,000+ lines of boilerplate code and provide complete type safety from database to UI.

## Why This Is The Foundation

1. **Single Source of Truth**: Drizzle schemas become the canonical definition for all data structures
2. **Type Safety**: Automatic TypeScript types flow from database to frontend
3. **Migration System**: Proper schema versioning and migration tracking
4. **Query Builder**: Type-safe queries replace error-prone SQL strings
5. **Performance**: Prepared statements and query optimization built-in

## Current Problems Being Solved

```typescript
// CURRENT: Manual SQL with no type safety
const result = await db.run(
  `INSERT INTO tickets (title, project_id, status) VALUES (?, ?, ?)`,
  [title, projectId, 'open'] // No validation, no types
);

// CURRENT: Manual schema drift
interface Ticket {
  id: number;
  title: string;
  // Hope this matches the database...
}
```

## Target Implementation

### 1. Schema Definition (Single Source of Truth)

```typescript
// packages/storage/src/schema/index.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Define schema once - types everywhere
export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  overview: text('overview').default(''),
  status: text('status', { 
    enum: ['open', 'in_progress', 'completed', 'archived'] 
  }).default('open'),
  priority: text('priority', {
    enum: ['low', 'normal', 'high', 'urgent']
  }).default('normal'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>().default({}),
  created: integer('created', { mode: 'timestamp_ms' }).notNull(),
  updated: integer('updated', { mode: 'timestamp_ms' }).notNull(),
});

// Auto-generate Zod schemas from Drizzle
export const insertTicketSchema = createInsertSchema(tickets);
export const selectTicketSchema = createSelectSchema(tickets);

// Type inference - no manual interfaces!
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
```

### 2. Migration System

```typescript
// packages/storage/src/migrations/0001_initial.ts
import { sql } from 'drizzle-orm';

export async function up(db: Database) {
  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      overview TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      tags TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `.run(db);
  
  await sql`CREATE INDEX idx_tickets_project ON tickets(project_id)`.run(db);
  await sql`CREATE INDEX idx_tickets_status ON tickets(status)`.run(db);
}
```

### 3. Type-Safe Queries

```typescript
// packages/storage/src/repositories/ticket-repository.ts
import { eq, and, desc, sql } from 'drizzle-orm';

export class TicketRepository {
  constructor(private db: DrizzleDB) {}

  // Fully typed, no SQL strings
  async create(data: NewTicket): Promise<Ticket> {
    const [ticket] = await this.db
      .insert(tickets)
      .values({
        ...data,
        created: new Date(),
        updated: new Date(),
      })
      .returning();
    
    return ticket; // Fully typed!
  }

  async findByProject(projectId: number): Promise<Ticket[]> {
    return this.db
      .select()
      .from(tickets)
      .where(eq(tickets.projectId, projectId))
      .orderBy(desc(tickets.created));
  }

  // Complex queries with joins
  async getWithTasks(ticketId: number) {
    return this.db
      .select({
        ticket: tickets,
        tasks: sql<Task[]>`
          JSON_GROUP_ARRAY(
            JSON_OBJECT(
              'id', ${tasks.id},
              'content', ${tasks.content},
              'done', ${tasks.done}
            )
          )
        `,
        taskCount: count(tasks.id),
      })
      .from(tickets)
      .leftJoin(tasks, eq(tasks.ticketId, tickets.id))
      .where(eq(tickets.id, ticketId))
      .groupBy(tickets.id);
  }
}
```

## Migration Strategy

### Phase 1: Setup (Day 1-2)
1. Install Drizzle dependencies
2. Create schema definitions for all existing tables
3. Generate migration from current schema
4. Set up migration runner

### Phase 2: Schema Migration (Day 3-5)
```typescript
// Convert each table
const tables = [
  'projects',
  'tickets', 
  'tasks',
  'chats',
  'files',
  'prompts',
  'agents',
  'queues',
];

// For each table:
// 1. Define Drizzle schema
// 2. Generate Zod schemas
// 3. Export types
// 4. Create repository
```

### Phase 3: Repository Pattern (Day 6-8)
```typescript
// Replace BaseStorage with repositories
export class BaseRepository<T> {
  constructor(
    protected db: DrizzleDB,
    protected table: Table,
  ) {}

  async findById(id: number): Promise<T | null> {
    const [result] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    
    return result || null;
  }

  async create(data: Partial<T>): Promise<T> {
    const [result] = await this.db
      .insert(this.table)
      .values(data)
      .returning();
    
    return result;
  }
}
```

### Phase 4: Service Integration (Day 9-10)
```typescript
// Services use repositories
export class TicketService {
  constructor(private repo: TicketRepository) {}

  async createTicket(data: CreateTicketDTO): Promise<Ticket> {
    // Validation happens at schema level
    const validated = insertTicketSchema.parse(data);
    return this.repo.create(validated);
  }
}
```

## Files to Modify

### New Files
- `packages/storage/src/schema/index.ts` - All Drizzle schemas
- `packages/storage/src/db/client.ts` - Drizzle client setup
- `packages/storage/src/migrations/*.ts` - Migration files
- `packages/storage/src/repositories/*.ts` - Repository pattern

### Files to Delete (After Migration)
- `packages/storage/src/base-storage.ts` - Replaced by repositories
- `packages/storage/src/converters/*.ts` - No longer needed
- `packages/storage/src/*-storage.ts` - All manual storage classes
- Manual SQL query files

## Success Metrics

### Quantitative
- ✅ 20,000+ lines removed from storage layer
- ✅ 100% type safety from database to UI
- ✅ 0 manual SQL strings in codebase
- ✅ 50% reduction in storage-related bugs

### Qualitative
- ✅ Adding a new field propagates types automatically
- ✅ Refactoring is safe with TypeScript checking
- ✅ New developers understand data model immediately
- ✅ Migrations are versioned and reversible

## Testing Strategy

```typescript
// Test with in-memory SQLite
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

describe('TicketRepository', () => {
  let db: DrizzleDB;
  let repo: TicketRepository;

  beforeEach(async () => {
    const client = createClient({ url: ':memory:' });
    db = drizzle(client);
    await migrate(db);
    repo = new TicketRepository(db);
  });

  it('should create ticket with type safety', async () => {
    const ticket = await repo.create({
      projectId: 1,
      title: 'Test Ticket',
      // TypeScript ensures all required fields
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.title).toBe('Test Ticket');
  });
});
```

## Rollback Plan

1. Keep existing storage classes during migration
2. Feature flag for Drizzle vs legacy storage
3. Parallel run both systems for validation
4. One-click rollback to legacy if issues

## Dependencies

- This blocks EVERYTHING else
- No other improvements can start until schemas are in Drizzle
- Frontend hook factories need these types
- Service layer needs repositories
- Route generation needs schemas

## Team Requirements

- 1-2 senior developers
- Experience with ORMs preferred
- Understanding of Promptliano's data model
- 2 weeks dedicated time

## Next Steps After Completion

Once Drizzle migration is complete, these can start in parallel:
1. Storage layer overhaul (02)
2. Frontend hook factory (07)
3. Route generation (04)
4. Error factory (05)
5. Interceptors (06)

## Code Examples to Reference

See the main MAIN_ARCHITECTURE_IMPROVEMENTS.md file sections:
- Lines 54-441: Complete Drizzle implementation examples
- Lines 442-623: Migration patterns
- Lines 1350-1543: Schema-to-frontend flow

## Questions to Resolve

1. Which SQLite driver? (better-sqlite3 vs libsql)
2. Migration tool? (Drizzle Kit vs custom)
3. Backup strategy during migration?
4. Performance benchmarks needed?

## Definition of Done

- [ ] All tables defined in Drizzle schemas
- [ ] Zod schemas auto-generated from Drizzle
- [ ] All storage classes replaced with repositories
- [ ] Services using new repositories
- [ ] Frontend using Drizzle-generated types
- [ ] All tests passing with new implementation
- [ ] Migration guide documented
- [ ] Performance benchmarks completed
- [ ] No manual SQL strings remaining