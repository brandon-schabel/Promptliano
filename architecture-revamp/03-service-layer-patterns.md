# 03: Unified Service Layer with Functional Patterns

## Dependencies
- **REQUIRES**: 01-drizzle-orm-migration.md (Need Drizzle schemas)
- **REQUIRES**: 02-storage-layer-overhaul.md (Need new storage layer)
- **BLOCKS**: API consumption (Services are used by routes)
- **PARALLEL WITH**: 04, 05, 06 (Can work alongside these)

## Overview
Transform the service layer from mixed class/singleton patterns to consistent functional composition with dependency injection and proper error handling using ErrorFactory. This eliminates 8,000+ lines of boilerplate.

## Current Problems

```typescript
// PROBLEM 1: Mixed patterns (classes, singletons, functions)
export class ProjectService {
  private static instance: ProjectService;
  static getInstance() { /* singleton */ }
}

export async function updateProject() { /* random function */ }

// PROBLEM 2: Inconsistent error handling
try {
  // Some throw custom errors
  throw new ApiError(404, 'Not found');
} catch (e) {
  // Others return null
  return null;
  // Some console.error
  console.error(e);
}

// PROBLEM 3: No dependency injection
import { projectStorage } from '../storage'; // Hard dependency

// PROBLEM 4: Duplicate logic everywhere
// Same validation in 10 places
if (!ticket) {
  throw new ApiError(404, `Ticket ${id} not found`);
}
```

## Target Architecture

### 1. Functional Service Pattern

```typescript
// packages/services/src/project-service.ts
import { createService } from './utils/service-factory';
import { ErrorFactory } from './utils/error-factory';
import type { ProjectRepository } from '@promptliano/storage';

export interface ProjectServiceDeps {
  repository: ProjectRepository;
  fileService?: FileService;
  logger?: Logger;
}

export function createProjectService(deps: ProjectServiceDeps) {
  const { repository, fileService, logger } = deps;

  return {
    async create(data: CreateProject): Promise<Project> {
      logger?.info('Creating project', { data });
      
      const validated = CreateProjectSchema.parse(data);
      const project = await repository.create(validated);
      
      if (fileService) {
        await fileService.initializeProject(project.path);
      }
      
      return project;
    },

    async getById(id: number): Promise<Project> {
      const project = await repository.findById(id);
      
      if (!project) {
        throw ErrorFactory.notFound('Project', id);
      }
      
      return project;
    },

    async update(id: number, data: UpdateProject): Promise<Project> {
      const existing = await this.getById(id);
      const validated = UpdateProjectSchema.parse(data);
      
      const updated = await repository.update(id, validated);
      
      if (!updated) {
        throw ErrorFactory.updateFailed('Project', id);
      }
      
      return updated;
    },

    async delete(id: number): Promise<boolean> {
      await this.getById(id); // Verify exists
      
      const result = await repository.delete(id);
      
      if (!result) {
        throw ErrorFactory.deleteFailed('Project', id);
      }
      
      if (fileService) {
        await fileService.cleanupProject(id);
      }
      
      return true;
    },

    // Domain-specific methods
    async syncFiles(id: number): Promise<SyncResult> {
      const project = await this.getById(id);
      
      if (!fileService) {
        throw ErrorFactory.serviceUnavailable('FileService');
      }
      
      return fileService.syncProject(project.path, {
        projectId: id,
        excludes: project.excludes,
      });
    },

    async getStats(id: number): Promise<ProjectStats> {
      const project = await this.getById(id);
      const [tickets, files, activity] = await Promise.all([
        repository.countTickets(id),
        repository.countFiles(id),
        repository.getRecentActivity(id),
      ]);
      
      return {
        project,
        tickets,
        files,
        activity,
      };
    },
  };
}

// Export type for consumers
export type ProjectService = ReturnType<typeof createProjectService>;

// Export singleton for backwards compatibility
export const projectService = createProjectService({
  repository: projectRepository,
  fileService: fileService,
  logger: defaultLogger,
});
```

### 2. Service Composition

```typescript
// packages/services/src/ticket-service.ts
export function createTicketService(deps: TicketServiceDeps) {
  const base = createCrudService<Ticket>({
    repository: deps.repository,
    entityName: 'Ticket',
    schema: TicketSchema,
  });

  const taskService = deps.taskService || createTaskService(deps.taskRepository);
  const aiService = deps.aiService;

  return {
    ...base, // Inherit CRUD operations

    // Extended operations
    async createWithTasks(
      data: CreateTicket & { generateTasks?: boolean }
    ): Promise<TicketWithTasks> {
      const ticket = await base.create(data);
      
      let tasks: Task[] = [];
      if (data.generateTasks && aiService) {
        const suggestions = await aiService.generateTaskSuggestions({
          title: ticket.title,
          overview: ticket.overview,
        });
        
        tasks = await Promise.all(
          suggestions.map(task =>
            taskService.create({
              ticketId: ticket.id,
              content: task.content,
              priority: task.priority,
            })
          )
        );
      }
      
      return { ticket, tasks };
    },

    async bulkUpdateStatus(
      updates: Array<{ id: number; status: TicketStatus }>
    ): Promise<number> {
      const results = await Promise.allSettled(
        updates.map(({ id, status }) =>
          base.update(id, { status })
        )
      );
      
      const successful = results.filter(
        r => r.status === 'fulfilled'
      ).length;
      
      if (successful < updates.length) {
        logger?.warn('Some updates failed', {
          total: updates.length,
          successful,
        });
      }
      
      return successful;
    },
  };
}
```

### 3. Error Factory Pattern

```typescript
// packages/services/src/utils/error-factory.ts
export class ErrorFactory {
  static notFound(entity: string, id: number | string): ApiError {
    return new ApiError(
      404,
      `${entity} with ID ${id} not found`,
      `${entity.toUpperCase()}_NOT_FOUND`
    );
  }

  static validationFailed(entity: string, errors: ZodError): ApiError {
    return new ApiError(
      400,
      `Validation failed for ${entity}`,
      'VALIDATION_ERROR',
      { errors: errors.format() }
    );
  }

  static updateFailed(entity: string, id: number | string): ApiError {
    return new ApiError(
      500,
      `Failed to update ${entity} with ID ${id}`,
      `${entity.toUpperCase()}_UPDATE_FAILED`
    );
  }

  static deleteFailed(entity: string, id: number | string): ApiError {
    return new ApiError(
      500,
      `Failed to delete ${entity} with ID ${id}`,
      `${entity.toUpperCase()}_DELETE_FAILED`
    );
  }

  static unauthorized(action: string): ApiError {
    return new ApiError(
      401,
      `Unauthorized to ${action}`,
      'UNAUTHORIZED'
    );
  }

  static forbidden(resource: string): ApiError {
    return new ApiError(
      403,
      `Access to ${resource} is forbidden`,
      'FORBIDDEN'
    );
  }

  static conflict(entity: string, field: string, value: string): ApiError {
    return new ApiError(
      409,
      `${entity} with ${field} '${value}' already exists`,
      'CONFLICT'
    );
  }

  static serviceUnavailable(service: string): ApiError {
    return new ApiError(
      503,
      `${service} is currently unavailable`,
      'SERVICE_UNAVAILABLE'
    );
  }

  static wrap(error: unknown, context: string): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    
    if (error instanceof ZodError) {
      return this.validationFailed(context, error);
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new ApiError(500, `${context}: ${message}`, 'INTERNAL_ERROR');
  }
}

### 4. Service Factory Helpers

```typescript
// packages/services/src/utils/service-factory.ts
export function createCrudService<T extends { id: number }>(config: {
  repository: BaseRepository<T>;
  entityName: string;
  schema: z.ZodSchema<T>;
}) {
  const { repository, entityName, schema } = config;

  return {
    async create(data: Omit<T, 'id' | 'created' | 'updated'>): Promise<T> {
      try {
        const validated = schema.parse({
          ...data,
          created: Date.now(),
          updated: Date.now(),
        });
        return await repository.create(validated);
      } catch (error) {
        throw ErrorFactory.wrap(error, `Creating ${entityName}`);
      }
    },

    async getById(id: number): Promise<T> {
      const entity = await repository.findById(id);
      if (!entity) {
        throw ErrorFactory.notFound(entityName, id);
      }
      return entity;
    },

    async getAll(options?: PaginationOptions): Promise<PaginatedResult<T>> {
      return repository.findAll(options);
    },

    async update(id: number, data: Partial<T>): Promise<T> {
      try {
        const existing = await this.getById(id);
        const validated = schema.parse({
          ...existing,
          ...data,
          updated: Date.now(),
        });
        
        const updated = await repository.update(id, validated);
        if (!updated) {
          throw ErrorFactory.updateFailed(entityName, id);
        }
        
        return updated;
      } catch (error) {
        throw ErrorFactory.wrap(error, `Updating ${entityName}`);
      }
    },

    async delete(id: number): Promise<boolean> {
      await this.getById(id); // Verify exists
      
      const result = await repository.delete(id);
      if (!result) {
        throw ErrorFactory.deleteFailed(entityName, id);
      }
      
      return true;
    },

    async exists(id: number): Promise<boolean> {
      return repository.exists(id);
    },

    async count(criteria?: Partial<T>): Promise<number> {
      return repository.count(criteria);
    },
  };
}

// Service composition helper
export function composeServices<T extends Record<string, any>>(
  services: T
): T & { dispose: () => Promise<void> } {
  return {
    ...services,
    async dispose() {
      await Promise.all(
        Object.values(services).map(service => {
          if (typeof service?.dispose === 'function') {
            return service.dispose();
          }
        })
      );
    },
  };
}
```

## Migration Strategy

### Phase 1: Create Base Infrastructure (Day 1-2)
1. Implement ErrorFactory
2. Create service factory helpers
3. Set up dependency injection patterns
4. Create service interfaces

### Phase 2: Service Migration (Day 3-8)
```typescript
// Services to migrate
const services = [
  'ProjectService',   // 1200 lines → 200 lines
  'TicketService',    // 1500 lines → 250 lines
  'TaskService',      // 800 lines → 150 lines
  'ChatService',      // 1100 lines → 200 lines
  'FileService',      // 1300 lines → 220 lines
  'PromptService',    // 900 lines → 160 lines
  'AgentService',     // 850 lines → 150 lines
  'QueueService',     // 1000 lines → 180 lines
];

// Migration pattern for each:
// 1. Create functional factory
// 2. Use createCrudService for base operations
// 3. Add domain-specific methods
// 4. Export types and singleton
// 5. Update consumers
```

### Phase 3: Dependency Injection (Day 9-10)
```typescript
// Create service container
export function createServiceContainer(config: ServiceConfig) {
  const repositories = createRepositories(config.db);
  
  const fileService = createFileService({
    repository: repositories.file,
    fs: config.fs || defaultFs,
  });
  
  const projectService = createProjectService({
    repository: repositories.project,
    fileService,
    logger: config.logger,
  });
  
  const ticketService = createTicketService({
    repository: repositories.ticket,
    taskRepository: repositories.task,
    aiService: config.aiService,
  });
  
  return composeServices({
    project: projectService,
    ticket: ticketService,
    file: fileService,
    // ... all services
  });
}

// Usage
const services = createServiceContainer({
  db: drizzleDb,
  logger: winston,
  aiService: openaiService,
});

// In routes
app.post('/projects', async (req, res) => {
  const project = await services.project.create(req.body);
  res.json(project);
});
```

### Phase 4: Testing Infrastructure (Day 11-12)
```typescript
// Easy testing with dependency injection
describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepo: MockRepository<Project>;
  
  beforeEach(() => {
    mockRepo = createMockRepository<Project>();
    service = createProjectService({
      repository: mockRepo,
      logger: silentLogger,
    });
  });
  
  it('should create project', async () => {
    mockRepo.create.mockResolvedValue(mockProject);
    
    const result = await service.create({
      name: 'Test',
      path: '/test',
    });
    
    expect(result).toEqual(mockProject);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test',
        path: '/test',
      })
    );
  });
  
  it('should throw when project not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    
    await expect(service.getById(999))
      .rejects
      .toThrow(ErrorFactory.notFound('Project', 999));
  });
});
```

## Code Reduction Examples

### Before (Class with Boilerplate)
```typescript
// 150+ lines for basic service
export class TicketService {
  private static instance: TicketService;
  private storage: TicketStorage;
  
  private constructor() {
    this.storage = TicketStorage.getInstance();
  }
  
  static getInstance(): TicketService {
    if (!this.instance) {
      this.instance = new TicketService();
    }
    return this.instance;
  }
  
  async createTicket(data: CreateTicketBody): Promise<Ticket> {
    try {
      // Manual validation
      if (!data.title) {
        throw new ApiError(400, 'Title is required');
      }
      if (!data.projectId) {
        throw new ApiError(400, 'Project ID is required');
      }
      
      // Check project exists
      const project = await projectStorage.getById(data.projectId);
      if (!project) {
        throw new ApiError(404, 'Project not found');
      }
      
      // Create ticket
      const ticket = await this.storage.create({
        ...data,
        status: data.status || 'open',
        priority: data.priority || 'normal',
        created: Date.now(),
        updated: Date.now(),
      });
      
      return ticket;
    } catch (error) {
      console.error('Failed to create ticket:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to create ticket');
    }
  }
  
  // ... 100+ more lines
}
```

### After (Functional with Composition)
```typescript
// 30 lines for same functionality + more features
export function createTicketService(deps: TicketServiceDeps) {
  const base = createCrudService<Ticket>({
    repository: deps.repository,
    entityName: 'Ticket',
    schema: TicketSchema,
  });
  
  return {
    ...base, // All CRUD operations included
    
    async createWithTasks(
      data: CreateTicket & { generateTasks?: boolean }
    ): Promise<TicketWithTasks> {
      const ticket = await base.create(data);
      const tasks = data.generateTasks 
        ? await deps.aiService?.generateTasks(ticket)
        : [];
      
      return { ticket, tasks };
    },
  };
}
```

## Benefits

### Consistency
- All services follow the same pattern
- Predictable error handling
- Uniform API across services

### Testability
- Easy to mock dependencies
- No singletons to wrestle with
- Isolated unit tests

### Maintainability
- 80% less code to maintain
- Clear separation of concerns
- Easy to extend with new methods

### Performance
- Lazy service initialization
- Efficient dependency injection
- No unnecessary object creation

## Success Metrics

- ✅ 8,000+ lines removed from service layer
- ✅ 100% consistent error handling
- ✅ All services using functional pattern
- ✅ Full dependency injection
- ✅ 90% test coverage achievable
- ✅ No singletons remaining

## Files to Modify

### New Files
- `packages/services/src/utils/error-factory.ts`
- `packages/services/src/utils/service-factory.ts`
- `packages/services/src/utils/service-container.ts`
- `packages/services/src/types/dependencies.ts`

### Files to Update
- All service files to functional pattern
- API routes to use service container
- Tests to use dependency injection

### Files to Delete
- Singleton implementations
- Manual error creation code
- Duplicate validation logic

## Definition of Done

- [ ] ErrorFactory implemented
- [ ] Service factory helpers created
- [ ] All services migrated to functional pattern
- [ ] Dependency injection implemented
- [ ] Service container created
- [ ] All routes using new services
- [ ] Tests updated with mocks
- [ ] No singletons remaining
- [ ] Documentation updated
```