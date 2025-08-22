# 01: Drizzle ORM Migration - Foundation

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