# Database Package - Single Source of Truth

Expert database architect guide for `@promptliano/database` - the foundation of Promptliano's type system.

## Core Architecture: Drizzle + Zod

**Single Definition → Everything Auto-Generated**

```typescript
// 1. Define table in schema.ts (THE ONLY DEFINITION NEEDED)
export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status', { enum: ['open', 'in_progress', 'closed'] }).default('open'),
  projectId: integer('project_id').notNull().references(() => projects.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdx: index('tickets_project_idx').on(table.projectId),
  statusIdx: index('tickets_status_idx').on(table.status)
}))

// 2. Auto-generate schemas & types
export const insertTicketSchema = createInsertSchema(tickets)
export const selectTicketSchema = createSelectSchema(tickets)
export type Ticket = typeof tickets.$inferSelect
export type CreateTicket = z.infer<typeof insertTicketSchema.omit({
  id: true, createdAt: true, updatedAt: true
})>

// 3. Define relationships
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, { fields: [tickets.projectId], references: [projects.id] }),
  tasks: many(ticketTasks)
}))
```

**Result:** Database table + TypeScript types + Zod schemas + API validation + Client types - all from ONE definition.

## Package Structure

```
packages/database/
├── src/
│   ├── schema.ts           # THE SOURCE OF TRUTH - all tables
│   ├── db.ts              # Database connection
│   ├── repositories/      # Query layer
│   │   ├── base-repository.ts
│   │   └── [entity]-repository.ts
│   └── migrations/        # Auto-generated
├── index.ts               # Public exports
└── drizzle.config.ts
```

## Usage Across Stack

### Import Pattern (ALL Packages)

```typescript
// ALWAYS import from @promptliano/database
import {
  type Ticket, // Auto-inferred type
  type CreateTicket, // Creation type
  insertTicketSchema, // Zod schema
  ticketRepository // Repository instance
} from '@promptliano/database'

// NEVER define your own types or schemas!
```

### Service Layer

```typescript
export function createTicketService(deps = {}) {
  const { repository = ticketRepository } = deps

  return {
    async create(data: CreateTicket): Promise<Ticket> {
      return await repository.create(data) // Fully typed!
    }
  }
}
```

### API Routes

```typescript
app.post(
  '/tickets',
  zValidator('json', insertTicketSchema.omit({ id: true, createdAt: true, updatedAt: true })),
  async (c) => {
    const data = c.req.valid('json') // Auto-typed!
    const ticket = await ticketService.create(data)
    return c.json({ success: true, data: ticket })
  }
)
```

### React Components

```typescript
const form = useForm<CreateTicket>({
  resolver: zodResolver(createTicketSchema)
})
```

## Repository Pattern

### Base Repository (Auto-CRUD)

```typescript
export function createBaseRepository<TTable>(table: TTable) {
  return {
    async create(data): Promise<TSelect> {
      const result = await db
        .insert(table)
        .values({
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()
      return result[0]
    },
    async getById(id: number) {
      const result = await db.select().from(table).where(eq(table.id, id))
      return result[0] || null
    },
    async update(id: number, data) {
      const result = await db
        .update(table)
        .set({ ...data, updatedAt: Date.now() })
        .where(eq(table.id, id))
        .returning()
      return result[0]
    },
    async delete(id: number) {
      const result = await db.delete(table).where(eq(table.id, id))
      return result.changes > 0
    }
  }
}
```

### Extend for Domain Logic

```typescript
export const ticketRepository = {
  ...createBaseRepository(tickets),
  async getByProject(projectId: number) {
    return db.select().from(tickets).where(eq(tickets.projectId, projectId))
  }
}
```

## Migrations

```bash
bun drizzle:generate  # Generate migration from schema changes
bun drizzle:migrate  # Apply migrations
bun drizzle:studio   # Visual database browser
```

## Critical Patterns

### ✅ DO

- **Single import source:** Always `from '@promptliano/database'`
- **Schema-driven:** Define in schema.ts, auto-generate everything else
- **Use repositories:** Never raw database access in services
- **Add indexes:** For foreign keys and commonly queried fields
- **Timestamp fields:** Always include createdAt/updatedAt

### ❌ DON'T

- **Manual types:** Never define entity types outside database package
- **Type adapters:** No DTO conversions or field mapping
- **Mixed schemas:** Don't use old @promptliano/schemas package
- **Direct DB access:** Always go through repositories
- **Skip validation:** Let drizzle-zod handle validation automatically

## Performance Keys

```typescript
// Indexes for common queries
export const files = sqliteTable(
  'files',
  {
    // ... fields
  },
  (table) => ({
    projectIdx: index('files_project_idx').on(table.projectId),
    pathIdx: index('files_path_idx').on(table.path),
    relevantIdx: index('files_relevant_idx').on(table.isRelevant, table.relevanceScore)
  })
)

// Prepared statements for hot paths
const getByProject = db
  .select()
  .from(tickets)
  .where(eq(tickets.projectId, placeholder('projectId')))
  .prepare()
```

## Testing

```typescript
describe('TicketRepository', () => {
  let testDb: Database

  beforeEach(async () => {
    testDb = await createTestDatabase()
  })

  test('creates ticket with valid data', async () => {
    const ticket = await ticketRepository.create({
      title: 'Test Ticket',
      projectId: 1
    })
    expect(ticket.id).toBeGreaterThan(0)
    expect(ticket.createdAt).toBeDefined()
  })
})
```

## Agent Requirements

**Mandatory agents for database work:**

- `drizzle-migration-architect` - Schema migrations
- `promptliano-sqlite-expert` - SQLite optimizations
- `typescript-type-safety-auditor` - Type validation
- `staff-engineer-code-reviewer` - Review all changes

## Key Metrics

| Aspect                | Impact                                   |
| --------------------- | ---------------------------------------- |
| **Code Reduction**    | 87% less code (10K → 1.3K lines)         |
| **Type Safety**       | 100% compile-time validation             |
| **Development Speed** | 24x faster (2 hours → 5 min/entity)      |
| **Maintenance**       | Zero sync issues (automatic propagation) |

---

**Remember:** The database schema IS your type system, validation layer, and API contract. One source of truth, zero duplication, complete type safety.
