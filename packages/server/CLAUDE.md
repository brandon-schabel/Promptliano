# Server Architecture Guide - CLAUDE.md

This guide covers the Promptliano server architecture built on **Drizzle → Zod → Hono → Bun** with MCP integration.

## Architecture Overview

The server follows a **Drizzle-first** approach where the database schema is the single source of truth that generates everything else:

**🔄 Data Flow Pipeline:**
```
Drizzle Schema → Zod Schemas → Hono OpenAPI → TypeScript Types → Generated CRUD
```

**Core Stack:**
- **Drizzle ORM**: Source of truth for all data structures, auto-generates types
- **Zod Schemas**: Runtime validation derived from Drizzle schemas via `drizzle-zod`
- **Hono Framework**: Type-safe OpenAPI routes with automatic validation
- **Bun Runtime**: Ultra-fast execution with native SQLite driver (3-6x faster)
- **MCP Integration**: AI tool protocol for seamless agent interactions

### Core Directory Structure

```
packages/server/
├── server.ts              # Main server entry point
├── src/
│   ├── app.ts             # Hono app configuration & middleware
│   ├── routes/            # API route definitions by domain
│   ├── mcp/               # Model Context Protocol implementation
│   │   ├── server.ts      # MCP server setup
│   │   ├── tools/         # MCP tool implementations by category
│   │   └── consolidated-tools.ts
│   └── services/          # WebSocket and other services
├── mcp-*.ts              # MCP standalone servers
└── data/                 # Runtime data storage
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure API security, error handling, and performance optimizations

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on service layer abstraction and middleware composition

3. **Package-Specific Agents**
   - Use `hono-bun-api-architect` for API endpoint development
   - Use `promptliano-mcp-tool-creator` for MCP tool implementation
   - Use `zod-schema-architect` for request/response validation schemas
   - Use `promptliano-sqlite-expert` for database optimization

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Include API documentation and example requests for new endpoints

## Drizzle-First Development Flow

**1. Drizzle Schema (Source of Truth)**
```typescript
// Define once in @promptliano/storage
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})
```

**2. Auto-Generate Everything**
```typescript
// Zod schemas auto-generated via drizzle-zod
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
const insertProjectSchema = createInsertSchema(projects)
const selectProjectSchema = createSelectSchema(projects)
type Project = typeof projects.$inferSelect
type NewProject = typeof projects.$inferInsert
```

**3. Type-Safe API Routes**
```typescript
// OpenAPI routes with automatic validation
const createProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects',
  request: { body: { content: { 'application/json': { schema: insertProjectSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: selectProjectSchema } } } }
})
```

**4. Generated CRUD + MCP Tools**
- Service layer uses inferred types
- MCP tools provide AI access
- API client gets full type safety
- React hooks work seamlessly

This package handles **MCP tools** and **API routes** with full type propagation from Drizzle.

## Beautiful API Generation

### Drizzle → OpenAPI Integration

```typescript
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { projects } from '@promptliano/storage'

// Auto-generated schemas from Drizzle
const insertProjectSchema = createInsertSchema(projects)
const selectProjectSchema = createSelectSchema(projects)

// Type-safe OpenAPI route
const createProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects',
  request: { body: { content: { 'application/json': { schema: insertProjectSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: selectProjectSchema } } } }
})

// Handler with full type safety
projectRoutes.openapi(createProjectRoute, async (c) => {
  const data = c.req.valid('json') // Fully typed from Drizzle schema
  const project = await createProject(data) // Service uses inferred types
  return c.json({ success: true, data: project })
})
```

### Generated CRUD Routes

For standard entities, routes follow predictable patterns:
- `GET /api/{entity}` - List with filtering
- `POST /api/{entity}` - Create with validation  
- `GET /api/{entity}/{id}` - Get by ID
- `PUT /api/{entity}/{id}` - Update with partial validation
- `DELETE /api/{entity}/{id}` - Delete with cascading

All validation, types, and OpenAPI docs are auto-generated from Drizzle schemas.

## MCP Tool Architecture

MCP tools provide AI agents with structured access to server functionality.

### Tool Pattern

```typescript
export const projectManagerTool: MCPToolDefinition = {
  name: 'mcp__promptliano__project_manager',
  description: 'Manage projects and files',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['overview', 'get_file_content', 'update_file_content'] },
      projectId: { type: 'number' },
      data: { type: 'object' }
    },
    required: ['action']
  },
  handler: createTrackedHandler('project_manager', async (args) => {
    const { action, projectId, data } = args
    
    switch (action) {
      case 'overview':
        const overview = await getProjectOverview(projectId)
        return { content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }] }
      case 'get_file_content':
        const content = await getFileContent(projectId, data.path)
        return { content: [{ type: 'text', text: content }] }
      // ...
    }
  })
}
```

### Tool Categories

- **project/** - File operations, project management
- **workflow/** - Tickets, tasks, queues 
- **content/** - AI agents, prompts
- **analysis/** - File summarization
- **git/** - Git operations

Tools use the same Drizzle-inferred types as API routes for consistency.

## Core Patterns

### Service Integration
```typescript
// Routes use services with Drizzle-inferred types
const project = await getProjectById(projectId) // Fully typed from schema
const newProject = await createProject(createData) // Validates against Drizzle schema
```

### Error Handling
```typescript
// Global error middleware handles Zod validation errors automatically
app.onError((err, c) => {
  if (err instanceof z.ZodError) {
    return c.json({ success: false, error: 'Validation failed' }, 422)
  }
  return c.json({ success: false, error: err.message }, 500)
})
```

### WebSocket Integration
```typescript
// Real-time updates for job queue and file changes
const wsManager = getWebSocketManager()
wsManager.broadcast({ type: 'project-updated', projectId })
```

### Response Format
```typescript
// Consistent API responses
{ success: true, data: T }           // Success
{ success: false, error: string }    // Error
```

## Development Commands

```bash
bun run dev          # Development server
bun run start        # Production server  
bun run server.ts --mcp-stdio  # MCP mode for AI agents
```

## Key Files

- `src/app.ts` - Hono app with middleware
- `src/routes/` - Domain-organized API routes
- `src/mcp/tools/` - AI tool implementations
- `server.ts` - Main server entry point

This architecture ensures **type safety from database to frontend** with minimal boilerplate through the Drizzle → Zod → Hono → TypeScript pipeline.
