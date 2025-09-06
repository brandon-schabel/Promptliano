# Schema Architecture Guide - Application-Level Validation

The `@promptliano/schemas` package handles **application-level validation only**. The **single source of truth** is now `@promptliano/database`, where Drizzle ORM tables automatically generate Zod schemas, TypeScript types, and database migrations.

## Agent Integration Requirements

### Mandatory Agent Usage

1. **After Implementation** - Always use `staff-engineer-code-reviewer`
2. **For Refactoring** - Use `promptliano-code-quality-architect`
3. **Package-Specific Agents**:
   - `promptliano-schema-architect` - Application-level validation patterns
   - `promptliano-database-architect` - Database schemas (primary source)
   - `promptliano-api-architect` - API integration

## Architecture: Database-First Design

### 🎯 Single Source of Truth: `@promptliano/database`

```
@promptliano/database/          # 🎯 SOURCE OF TRUTH
├── src/schema.ts              # Drizzle table definitions
└── Auto-generated:
    ├── Zod schemas            # via drizzle-zod
    ├── TypeScript types       # via $inferSelect/$inferInsert
    └── Database migrations    # via drizzle-kit

@promptliano/schemas/          # 📋 APPLICATION VALIDATION
├── src/global-state.schemas.ts # UI state management
├── src/gen-ai.schemas.ts      # AI/LLM configurations
├── src/mcp.schemas.ts         # MCP protocol validation
├── src/file-*.schemas.ts      # File system operations
└── src/common.schemas.ts      # API responses & utilities
```

### Data Flow Pipeline

```
Drizzle Schema → Zod Schemas → Hono OpenAPI → TypeScript Types → Generated CRUD
```

**Critical Rule**: Import database types from `@promptliano/database`, not this package.

## Database-First Development Pattern

### 1. Define Once in Database

```typescript
// @promptliano/database/src/schema.ts - SOURCE OF TRUTH
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  createdAt: integer('created_at').notNull()
})

// Auto-generate everything
export const insertProjectSchema = createInsertSchema(projects)
export const selectProjectSchema = createSelectSchema(projects)
export type Project = typeof projects.$inferSelect
export type InsertProject = typeof projects.$inferInsert
```

### 2. Use in APIs with Full Type Safety

```typescript
// @promptliano/server/src/routes/projects.ts
import { insertProjectSchema, selectProjectSchema } from '@promptliano/database'

app.post('/projects', zValidator('json', insertProjectSchema), async (c) => {
  const data = c.req.valid('json') // Fully typed from Drizzle!
  const project = await createProject(data)
  return c.json({ success: true, data: project })
})
```

### 3. Application Schemas Reference Database Types

```typescript
// This package - application-level validation only
import { selectProjectSchema } from '@promptliano/database'

export const projectListResponseSchema = successResponseSchema(
  z.array(selectProjectSchema) // Reference database schema
)
```

## Application Schema Responsibilities

This package only handles non-database validation:

### 1. Global State Management

```typescript
// global-state.schemas.ts
export const projectTabStateSchema = z.object({
  selectedFileIds: z.array(z.string()).default([]),
  activeTicketId: entityIdOptionalSchema,
  filters: z
    .object({
      status: z.array(z.enum(['open', 'in_progress', 'closed'])).default([])
    })
    .default({})
})
```

### 2. API Response Formatting

```typescript
// common.schemas.ts
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  })

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string()
})
```

### 3. File Operations

```typescript
// file-operations.schemas.ts
export const fileSummaryRequestSchema = z.object({
  filePaths: z.array(z.string().min(1)),
  options: z
    .object({
      maxTokens: z.number().int().min(100).max(4000).default(1000),
      strategy: z.enum(['fast', 'balanced', 'thorough']).default('balanced')
    })
    .default({})
})
```

### 4. MCP Protocol Validation

```typescript
// mcp.schemas.ts
export const mcpToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()),
  call_id: z.string().optional()
})
```

### 5. AI Configuration

```typescript
// gen-ai.schemas.ts
export const aiSdkOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional()
})
```

## Validation Utilities

### ID and Timestamp Schemas

```typescript
// Entity IDs
entityIdSchema // Required entity ID
entityIdOptionalSchema // Optional entity ID
entityIdCoercibleSchema // Coerces strings to numbers (URL params)

// Unix timestamps with preprocessing
unixTSSchemaSpec // Required timestamp
unixTSOptionalSchemaSpec // Optional timestamp

// Special IDs (can accept -1 as null)
idSchemaSpec // Accepts -1 or valid timestamp
```

### Timestamp Preprocessing

Handles multiple input formats automatically:

```typescript
// Accepts: milliseconds, seconds, ISO strings, Date objects
// Outputs: consistent millisecond timestamp
```

## Integration Patterns

### ✅ Correct Usage

```typescript
// Import database types from database package
import { type Project, type InsertProject, insertProjectSchema, selectProjectSchema } from '@promptliano/database'

// Import application types from this package
import { type GlobalState, type FileSummaryRequest, globalStateSchema } from '@promptliano/schemas'
```

### ❌ Forbidden Usage

```typescript
// Never define database entities manually
type Project = {
  id: number
  name: string
  // DON'T DO THIS
}
```

## Development Workflow

### Adding Database Entities

1. Define Drizzle table in `@promptliano/database`
2. Generate migration: `bun drizzle:generate`
3. Use auto-generated schemas in APIs
4. Reference from application schemas if needed

### Adding Application Schemas

1. Identify if it's truly application-level (not database entity)
2. Create schema in appropriate domain file
3. Include OpenAPI metadata
4. Add tests for validation logic

## Best Practices

### Package Separation Rules

- **Database entities**: Always in `@promptliano/database` with Drizzle
- **Application state**: UI, MCP, file operations in this package
- **Import correctly**: Database types from database package, app types from here
- **Never duplicate**: If it exists in database, import it

### Schema Design Strategy

- **Start with database**: Define Drizzle tables first for entities
- **Layer validation**: Add application-specific validation on top
- **Use composition**: Build complex schemas from simple ones
- **Fail fast**: Validate at boundaries (API, forms, file operations)

### Testing Approach

- **Test validation logic**: Invalid inputs, edge cases, defaults
- **Test integration**: Database ↔ application schema compatibility
- **Test boundaries**: API endpoints, form validation, file operations

## Common Patterns

### Pagination

```typescript
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
})
```

### Search

```typescript
export const searchQuerySchema = z.object({
  q: z.string().min(1),
  filters: z.record(z.string()).optional(),
  includeDeleted: z.boolean().default(false)
})
```

## Summary

This package provides application-level validation while `@promptliano/database` serves as the single source of truth for all data entities. The database-first approach ensures:

- **100% type consistency** - Single source, zero drift
- **Zero maintenance** - Database changes propagate automatically
- **Clear separation** - Database vs application concerns
- **Full stack safety** - End-to-end type checking

Always import database types from `@promptliano/database` and use this package only for application-specific validation needs.
