# Services Package - Business Logic Layer

Expert service architect guide for `@promptliano/services` - business logic layer between database and API routes using functional factory patterns.

## Core Architecture: Database-First Services

**Principles:**

1. Database-first integration - `@promptliano/database` as single source of truth
2. Functional factory pattern - Services created via factories, not classes
3. Repository integration - Delegate data operations to typed repositories
4. Consistent error handling - ErrorFactory for standardized responses
5. Dependency injection - Services accept dependencies for testing

**Service Flow:**

```
@promptliano/database → Repositories → Services → API Routes → Frontend Hooks
```

## Package Structure

```
packages/services/src/
├── core/                 # Infrastructure
│   ├── base-service.ts   # CRUD factory
│   ├── error-factory.ts  # Error patterns
│   └── service-logger.ts # Logging
├── [entity]-service.ts   # Domain services
├── error-mappers.ts      # Provider errors
├── service-container.ts  # Service composition
└── db.ts                 # Database connection
```

## Service Implementation Patterns

### Basic Service Factory

Use functional factory pattern for all services:

```typescript
export interface ExampleServiceDeps {
  repository?: typeof exampleRepository
  logger?: ReturnType<typeof createServiceLogger>
}

export function createExampleService(deps: ExampleServiceDeps = {}) {
  const { repository = exampleRepository, logger = createServiceLogger('ExampleService') } = deps

  const baseService = createCrudService<Example, CreateExample, UpdateExample>({
    entityName: 'Example',
    repository,
    schema: ExampleSchema,
    logger
  })

  return extendService(baseService, {
    async getBySpecialCriteria(criteria: string): Promise<Example[]> {
      try {
        const results = await repository.getBySpecialCriteria(criteria)
        logger.info('Retrieved examples', { count: results.length })
        return results
      } catch (error) {
        throw ErrorFactory.database.queryFailed('Failed to retrieve examples', { criteria })
      }
    }
  })
}

export const exampleService = createExampleService()
```

### Service with External Dependencies

```typescript
export interface ComplexServiceDeps {
  repository?: typeof complexRepository
  otherService?: ReturnType<typeof createOtherService>
  externalApi?: ReturnType<typeof createExternalApiClient>
}

export function createComplexService(deps: ComplexServiceDeps = {}) {
  const {
    repository = complexRepository,
    otherService = createOtherService(),
    externalApi = createExternalApiClient()
  } = deps

  return {
    async performComplexOperation(id: number): Promise<ComplexEntity> {
      try {
        const entity = await repository.getById(id)
        if (!entity) throw ErrorFactory.validation.notFound('ComplexEntity', id.toString())

        const relatedData = await otherService.getRelatedData(entity.relatedId)
        const externalData = await externalApi.fetchData(entity.externalId)

        return await repository.update(id, {
          processedAt: Date.now(),
          externalStatus: externalData.status
        })
      } catch (error) {
        if (error instanceof ErrorFactory.BaseError) throw error
        throw ErrorFactory.service.operationFailed('Complex operation failed', { id })
      }
    }
  }
}
```

## Database Integration Best Practices

### Repository Usage

- **Always use repositories** - Never direct database imports
- **Use auto-generated types** from `@promptliano/database`
- **Extend repositories** for custom queries

```typescript
// ✅ GOOD
import { projectRepository, type Project } from '@promptliano/database'
export function createProjectService() {
  return {
    async getProject(id: number) {
      return await projectRepository.getById(id)
    }
  }
}

// ❌ BAD - Direct DB access
import { db } from '@promptliano/database'
export function createProjectService() {
  return {
    async getProject(id: number) {
      return await db.select().from(projects).where(eq(projects.id, id))
    }
  }
}
```

## Error Handling with ErrorFactory

Use consistent error handling patterns:

```typescript
import { ErrorFactory } from '@promptliano/shared'

export function createExampleService() {
  return {
    async getExample(id: number) {
      try {
        const example = await exampleRepository.getById(id)
        if (!example) throw ErrorFactory.validation.notFound('Example', id.toString())
        return example
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          throw ErrorFactory.validation.constraintViolation('Constraint failed')
        }
        if (error instanceof ErrorFactory.BaseError) throw error
        throw ErrorFactory.database.queryFailed('Failed to retrieve example', { id })
      }
    },

    async callExternalApi(endpoint: string) {
      try {
        const response = await fetch(endpoint)
        if (!response.ok) throw ErrorFactory.external.apiError('API failed', response.status, { endpoint })
        return await response.json()
      } catch (error) {
        if (error instanceof ErrorFactory.BaseError) throw error
        throw ErrorFactory.external.networkError('Network error', { endpoint })
      }
    }
  }
}
```

**Error Categories:**

- `ErrorFactory.validation.*` - Data validation, not found, constraints
- `ErrorFactory.database.*` - Database operation failures
- `ErrorFactory.service.*` - Business logic failures
- `ErrorFactory.external.*` - External API/service failures
- `ErrorFactory.auth.*` - Authentication/authorization

## Testing Guide

**Core Principles:**

1. **Complete isolation** - Each test gets its own database, mocks, and clean state
2. **Test data factories** - Use `TestDataFactory` for consistent test data
3. **Mock external dependencies** - Mock services and repositories not under test
4. **Comprehensive coverage** - Test happy paths, errors, edge cases

**Basic Test Structure:**

```typescript
describe('ServiceName (Isolated Database)', () => {
  let testDb: any
  let service: ReturnType<typeof createServiceUnderTest>

  beforeEach(async () => {
    testDb = createTestDatabase({
      testId: `test-${Date.now()}-${Math.random()}`,
      useMemory: true
    })
    const drizzleDb = drizzle(testDb.rawDb, { schema })
    service = createServiceUnderTest({ drizzleDb })
  })

  afterEach(async () => {
    if (testDb) testDb.close()
  })

  test('should create entity', async () => {
    const testData = TestDataFactory.entity()
    const result = await service.create(testData)
    expect(result.id).toBeDefined()
  })
})
```

### Testing Architecture

#### Database Isolation Pattern

```typescript
import { createTestDatabase } from '@promptliano/database'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '@promptliano/database'
import { TestDataFactory } from './test-utils/test-data-factories'

describe('Service Name (Isolated Database)', () => {
  let testDb: any
  let service: ReturnType<typeof createServiceUnderTest>

  beforeEach(async () => {
    testDb = createTestDatabase({
      testId: `service-name-${Date.now()}-${Math.random()}`,
      verbose: false,
      seedData: false,
      useMemory: true,
      busyTimeout: 30000
    })

    const drizzleDb = drizzle(testDb.rawDb, { schema })
    service = createServiceUnderTest({ drizzleDb })
  })

  afterEach(async () => {
    if (testDb) {
      testDb.close()
    }
  })
})
```

**Test Data Factories:**

```typescript
const testProject = TestDataFactory.project({
  name: 'Test Project',
  path: '/test/project'
})
const testTicket = TestDataFactory.ticket(testProject.id, {
  title: 'Test Ticket',
  status: 'open'
})
```

**Repository Mocking:**

```typescript
const mockRepository = {
  create: mock(async (data: any) => ({ id: Date.now(), ...data })),
  getById: mock(async (id: number) => null),
  update: mock(async (id: number, data: any) => ({ id, ...data })),
  delete: mock(async (id: number) => true)
}
```

**Running Tests:**

```bash
bun test packages/services/src/service-name.test.ts
bun run test:services  # Run all service tests
```

**Best Practices:**

- Complete isolation per test
- Mock external dependencies
- Use descriptive test names
- Test happy paths, errors, and edge cases

## Service Usage in API Routes

Services integrate seamlessly with Hono API routes:

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createExampleService } from '@promptliano/services'
import { insertExampleSchema } from '@promptliano/database'

const app = new Hono()
const exampleService = createExampleService()

app.post(
  '/examples',
  zValidator('json', insertExampleSchema.omit({ id: true, createdAt: true, updatedAt: true })),
  async (c) => {
    const data = c.req.valid('json')
    const example = await exampleService.create(data)
    return c.json({ success: true, data: example }, 201)
  }
)
```

export { app as exampleRoutes }

````

## Performance Best Practices

### Repository Optimization
Use repository methods efficiently:

```typescript
// ✅ GOOD: Single query with relations
async getProjectWithTickets(id: number) {
  return await projectRepository.getWithTickets(id)
}

// ❌ BAD: N+1 query problem
async getProjectWithTickets(id: number) {
  const project = await projectRepository.getById(id)
  const tickets = await ticketRepository.getByProjectId(id)
  return { ...project, tickets }
}
````

### Batch Operations

```typescript
// ✅ GOOD: Batch processing
async createMultipleTickets(tickets: CreateTicket[]): Promise<Ticket[]> {
  return await ticketRepository.createMany(tickets)
}

// ❌ BAD: Loop with individual creates
async createMultipleTickets(tickets: CreateTicket[]): Promise<Ticket[]> {
  const results = []
  for (const ticket of tickets) {
    results.push(await ticketRepository.create(ticket))
  }
  return results
}
```

## Service Composition Patterns

### Service Container

```typescript
// packages/services/src/service-container.ts
import { createProjectService } from './project-service'
import { createTicketService } from './ticket-service'
import { createChatService } from './chat-service'

export function createServiceContainer() {
  const projectService = createProjectService()
  const ticketService = createTicketService({ projectService })
  const chatService = createChatService({ projectService, ticketService })

  return {
    project: projectService,
    ticket: ticketService,
    chat: chatService
  }
}

export const services = createServiceContainer()
```

### Cross-Service Communication

```typescript
export function createTicketService(deps: TicketServiceDeps = {}) {
  const { projectService = createProjectService(), repository = ticketRepository } = deps

  return {
    async createTicketWithValidation(data: CreateTicket) {
      const project = await projectService.get(data.projectId)
      if (!project) throw ErrorFactory.validation.notFound('Project', data.projectId.toString())

      const existingTickets = await repository.getByProjectId(data.projectId)
      if (existingTickets.length >= 100) {
        throw ErrorFactory.validation.invalidInput('Project has reached maximum ticket limit')
      }

      return await repository.create(data)
    }
  }
}
```

## Key Principles Summary

### DO

1. **Use functional factory patterns** - `createXxxService(deps)` not classes
2. **Import all types from `@promptliano/database`** - Single source of truth
3. **Use repositories for data access** - Never direct database calls
4. **Implement consistent error handling** - Always use ErrorFactory
5. **Write comprehensive tests** - Both unit and integration tests
6. **Accept dependencies for injection** - Makes testing and composition easier
7. **Log important operations** - Use structured logging
8. **Validate business rules** - Services enforce domain logic

### DON'T

1. **Don't use classes or singletons** - Use functional factories
2. **Don't define your own types** - Use database-generated types
3. **Don't access database directly** - Go through repositories
4. **Don't throw generic errors** - Use ErrorFactory categories
5. **Don't mix concerns** - Keep services focused on business logic
6. **Don't skip dependency injection** - Make services testable
7. **Don't ignore errors** - Properly handle and categorize all failures
8. **Don't duplicate validation** - Repository/database handles data validation

## Migration from Legacy Services

### Before (Legacy Pattern)

```typescript
class ProjectService {
  async getProject(id: number) {
    // Manual database queries, mixed concerns
  }
}

export default new ProjectService()
```

### After (Modern Pattern)

```typescript
export function createProjectService(deps = {}) {
  return {
    async get(id: number) {
      // Use repository, proper error handling
    }
  }
}

export const projectService = createProjectService()
```

**Result:** 75% code reduction, 100% type safety, consistent error handling, easy testing, clear separation of concerns, single source of truth from database schemas.
