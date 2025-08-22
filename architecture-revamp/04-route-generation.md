# 04: Route Code Generation System

## Dependencies
- **REQUIRES**: 01-drizzle-orm-migration.md (Need Drizzle schemas)
- **BLOCKS**: None (Routes are consumed by API clients)
- **PARALLEL WITH**: 02, 03, 05, 06, 07 (Can work alongside these)

## Overview
Implement automatic route generation from Drizzle schemas, eliminating 5,000+ lines of repetitive API endpoint code. Routes are generated with full OpenAPI documentation, Zod validation, and type safety.

## Current Problems

```typescript
// PROBLEM 1: Manual route definition (repeated 100+ times)
app.post('/api/tickets', async (c) => {
  try {
    const body = await c.req.json();
    // Manual validation
    if (!body.title) {
      return c.json({ error: 'Title required' }, 400);
    }
    const result = await ticketService.create(body);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// PROBLEM 2: No OpenAPI documentation
// PROBLEM 3: No automatic validation
// PROBLEM 4: Inconsistent error handling
// PROBLEM 5: No type safety between backend and frontend
```

## Target Implementation

### 1. Route Generation from Schemas

```typescript
// packages/server/src/generators/route-generator.ts
import { generateRoutes } from './utils/route-factory';
import * as schemas from '@promptliano/schemas';

// Generate all CRUD routes from schemas
export const generatedRoutes = generateRoutes({
  entities: {
    project: {
      schema: schemas.ProjectSchema,
      service: projectService,
      path: '/projects',
      operations: ['create', 'read', 'update', 'delete', 'list'],
    },
    ticket: {
      schema: schemas.TicketSchema,
      service: ticketService,
      path: '/tickets',
      operations: ['create', 'read', 'update', 'delete', 'list'],
      customRoutes: [
        {
          method: 'post',
          path: '/:id/tasks',
          handler: 'createWithTasks',
          schema: schemas.CreateTicketWithTasksSchema,
        },
      ],
    },
    // ... all entities
  },
});

// Automatically generates:
// POST   /api/projects
// GET    /api/projects/:id
// PUT    /api/projects/:id
// DELETE /api/projects/:id
// GET    /api/projects
// ... for all entities
```

### 2. Route Factory Implementation

```typescript
// packages/server/src/utils/route-factory.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';

export function generateRoutes(config: RouteConfig) {
  const app = new OpenAPIHono();

  Object.entries(config.entities).forEach(([name, entity]) => {
    if (entity.operations.includes('create')) {
      app.openapi(
        createRoute({
          method: 'post',
          path: entity.path,
          tags: [name],
          request: {
            body: {
              content: {
                'application/json': {
                  schema: entity.schema.omit({ id: true, created: true, updated: true }),
                },
              },
            },
          },
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: entity.schema,
                },
              },
              description: `Create ${name}`,
            },
            400: {
              content: {
                'application/json': {
                  schema: ErrorSchema,
                },
              },
              description: 'Validation error',
            },
          },
        }),
        async (c) => {
          const validated = c.req.valid('json');
          const result = await entity.service.create(validated);
          return c.json(result);
        }
      );
    }

    if (entity.operations.includes('read')) {
      app.openapi(
        createRoute({
          method: 'get',
          path: `${entity.path}/:id`,
          tags: [name],
          request: {
            params: z.object({
              id: z.string().transform(Number),
            }),
          },
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: entity.schema,
                },
              },
              description: `Get ${name} by ID`,
            },
            404: {
              content: {
                'application/json': {
                  schema: ErrorSchema,
                },
              },
              description: 'Not found',
            },
          },
        }),
        async (c) => {
          const { id } = c.req.valid('param');
          const result = await entity.service.getById(id);
          return c.json(result);
        }
      );
    }

    if (entity.operations.includes('update')) {
      app.openapi(
        createRoute({
          method: 'put',
          path: `${entity.path}/:id`,
          tags: [name],
          request: {
            params: z.object({
              id: z.string().transform(Number),
            }),
            body: {
              content: {
                'application/json': {
                  schema: entity.schema.partial().omit({ id: true, created: true }),
                },
              },
            },
          },
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: entity.schema,
                },
              },
              description: `Update ${name}`,
            },
          },
        }),
        async (c) => {
          const { id } = c.req.valid('param');
          const body = c.req.valid('json');
          const result = await entity.service.update(id, body);
          return c.json(result);
        }
      );
    }

    // Generate custom routes
    entity.customRoutes?.forEach((custom) => {
      app.openapi(
        createRoute({
          method: custom.method,
          path: `${entity.path}${custom.path}`,
          tags: [name],
          request: {
            body: custom.schema ? {
              content: {
                'application/json': {
                  schema: custom.schema,
                },
              },
            } : undefined,
          },
          responses: custom.responses || {
            200: {
              content: {
                'application/json': {
                  schema: z.any(),
                },
              },
              description: custom.description || 'Success',
            },
          },
        }),
        async (c) => {
          const validated = custom.schema ? c.req.valid('json') : undefined;
          const params = c.req.param();
          const result = await entity.service[custom.handler](params, validated);
          return c.json(result);
        }
      );
    });
  });

  return app;
}
```

### 3. OpenAPI Documentation Generation

```typescript
// packages/server/src/openapi.ts
import { generatedRoutes } from './generators/route-generator';

// Auto-generate OpenAPI spec
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Promptliano API',
    description: 'Auto-generated from Drizzle schemas',
  },
  servers: [
    {
      url: 'http://localhost:3147',
      description: 'Development server',
    },
  ],
});

// Swagger UI
app.get('/swagger', swaggerUI({ url: '/openapi.json' }));

// Export types for frontend
export type ApiRoutes = typeof generatedRoutes;
```

### 4. Type-Safe API Client Generation

```typescript
// packages/api-client/src/generated/client.ts
import { hc } from 'hono/client';
import type { ApiRoutes } from '@promptliano/server';

// Auto-generated client with full type safety
export const apiClient = hc<ApiRoutes>('/api');

// Usage in frontend - fully typed!
const project = await apiClient.projects.$post({
  json: {
    name: 'New Project', // TypeScript knows the shape
    path: '/path',
  },
});

const ticket = await apiClient.tickets[':id'].$get({
  param: { id: '123' },
});
```

## Migration Strategy

### Phase 1: Setup Infrastructure (Day 1-2)
1. Install Hono OpenAPI dependencies
2. Create route factory utilities
3. Set up OpenAPI documentation
4. Configure Swagger UI

### Phase 2: Generate Entity Routes (Day 3-4)
```typescript
// Generate routes for each entity
const entities = [
  'projects',
  'tickets',
  'tasks',
  'chats',
  'files',
  'prompts',
  'agents',
  'queues',
];

// Each gets full CRUD + custom routes
```

### Phase 3: Custom Route Patterns (Day 5-6)
```typescript
// Define reusable patterns
const routePatterns = {
  // Bulk operations
  bulkCreate: generateBulkRoute('create'),
  bulkUpdate: generateBulkRoute('update'),
  bulkDelete: generateBulkRoute('delete'),
  
  // Search and filtering
  search: generateSearchRoute(),
  filter: generateFilterRoute(),
  
  // Relationships
  hasMany: generateHasManyRoute(),
  belongsTo: generateBelongsToRoute(),
  
  // Statistics
  stats: generateStatsRoute(),
  count: generateCountRoute(),
};
```

### Phase 4: API Client Generation (Day 7)
```typescript
// Auto-generate TypeScript client
await generateApiClient({
  input: './openapi.json',
  output: 'packages/api-client/src/generated/',
  includeTypes: true,
  includeClient: true,
});
```

## Code Reduction Examples

### Before (Manual Routes)
```typescript
// 100+ lines per entity
app.post('/api/tickets', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.title || typeof body.title !== 'string') {
      return c.json({ error: 'Invalid title' }, 400);
    }
    
    if (!body.projectId || typeof body.projectId !== 'number') {
      return c.json({ error: 'Invalid projectId' }, 400);
    }
    
    const ticket = await ticketService.create({
      title: body.title,
      projectId: body.projectId,
      overview: body.overview || '',
      status: body.status || 'open',
      priority: body.priority || 'normal',
    });
    
    return c.json(ticket);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/tickets/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({ error: 'Invalid ID' }, 400);
    }
    
    const ticket = await ticketService.getById(id);
    
    if (!ticket) {
      return c.json({ error: 'Not found' }, 404);
    }
    
    return c.json(ticket);
  } catch (error) {
    console.error('Failed to get ticket:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ... 80+ more lines for update, delete, list
```

### After (Generated Routes)
```typescript
// 5 lines to generate all routes
const ticketRoutes = generateRoutes({
  entities: {
    ticket: {
      schema: TicketSchema,
      service: ticketService,
      path: '/tickets',
      operations: ['create', 'read', 'update', 'delete', 'list'],
    },
  },
});
```

## Benefits

### Consistency
- All routes follow the same pattern
- Uniform error responses
- Consistent validation

### Documentation
- OpenAPI spec always up-to-date
- Swagger UI for testing
- Type definitions for clients

### Type Safety
- End-to-end type safety
- No manual type definitions
- Schema changes propagate automatically

### Developer Experience
- No boilerplate code
- Fast iteration
- Less bugs

## Performance Optimizations

```typescript
// Route-level caching
const routeCache = new Map();

function withCache(handler: Handler) {
  return async (c: Context) => {
    const key = `${c.req.method}:${c.req.path}`;
    
    if (c.req.method === 'GET') {
      const cached = routeCache.get(key);
      if (cached) {
        return c.json(cached);
      }
    }
    
    const result = await handler(c);
    
    if (c.req.method === 'GET') {
      routeCache.set(key, result);
    }
    
    return result;
  };
}
```

## Success Metrics

- ✅ 5,000+ lines of route code eliminated
- ✅ 100% routes have OpenAPI documentation
- ✅ 100% routes have Zod validation
- ✅ Type-safe API client generated
- ✅ 0 manual route definitions

## Files to Modify

### New Files
- `packages/server/src/generators/route-generator.ts`
- `packages/server/src/utils/route-factory.ts`
- `packages/server/src/utils/route-patterns.ts`
- `packages/api-client/src/generated/client.ts`

### Files to Update
- `packages/server/src/index.ts` - Use generated routes
- `packages/server/src/openapi.ts` - OpenAPI configuration

### Files to Delete
- All manual route files
- Manual validation code
- Manual type definitions

## Definition of Done

- [ ] Route factory implemented
- [ ] All entities have generated routes
- [ ] OpenAPI documentation generated
- [ ] Swagger UI configured
- [ ] API client generated
- [ ] Frontend using generated client
- [ ] All manual routes removed
- [ ] Performance optimizations added
- [ ] Documentation updated