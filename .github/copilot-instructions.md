# 🎯 Promptliano Development Guide

## ✅ Architecture Successfully Implemented: Schema-First + Agent-First

Promptliano has successfully implemented its modern architecture achieving:

1. **87%+ Code Reduction** - From manual SQL to Drizzle ORM
2. **100% Type Safety** - Schema-first design with Zod validation
3. **6-20x Performance Improvement** - Optimized queries and caching
4. **Modular Architecture** - Functional factories, route generators, hook factories

## Core Philosophy: Agent-First + Schema-First

Promptliano is built on two foundational principles:

1. **Agent-First Development** - Every task requires specialized expertise
2. **Schema-First Architecture** - Zod schemas drive everything

---

## 🏗️ Architecture Overview: Database Schema → Everything

```
packages/database/src/schema.ts (THE SOURCE OF TRUTH)
    ↓
Auto-generated Types & Zod Schemas
    ↓
Repository Layer (Drizzle queries)
    ↓
Service Layer (Functional factories)
    ↓
🔄 ROUTE GENERATION: bun run routes:generate
    ↓
API Routes (Hono + OpenAPI)
    ↓
🔄 API CLIENT GENERATION: bun run generate:api-client
    ↓
Frontend API Client (Type-safe)
    ↓
🔄 HOOK GENERATION: bun run build:client
    ↓
Frontend Hooks (Hook factories)
    ↓
UI Components (React + shadcn/ui)
```

### ⚡ Key Principles: Generation + Factory Patterns + Type Safety

- **Database Schema as Source of Truth** - Everything flows from the single Drizzle schema
- **Generation Patterns** - Routes, API clients, and hooks are auto-generated
- **Factory Patterns** - Pure functional factories eliminate boilerplate
- **100% Type Safety** - End-to-end TypeScript types from database to UI
- **Modular & Pure Functions** - Clean separation, no side effects, testable code
- **87%+ Code Reduction** - From manual SQL to modern generated patterns

---

## 🤖 Agent Quick Reference

**RULE: Every task needs an agent. No exceptions.**

| Working On      | Agent                            | Why                                                 |
| --------------- | -------------------------------- | --------------------------------------------------- |
| **Planning**    | `promptliano-planning-architect` | Creates tickets with agent assignments              |
| **Database**    | `promptliano-database-architect` | Drizzle ORM, migrations, repositories               |
| **Services**    | `promptliano-service-architect`  | Functional factory patterns                         |
| **API Routes**  | `promptliano-api-architect`      | Hono + OpenAPI + Zod validation                     |
| **Frontend**    | `promptliano-frontend-architect` | React + TanStack Router + components + forms        |
| **Testing**     | `promptliano-testing-architect`  | E2E + API testing, isolated environments            |
| **Schemas**     | `promptliano-schema-architect`   | Zod schemas, validation, type inference             |
| **AI Features** | `promptliano-ai-architect`       | AI SDK integration, streaming, orchestration        |
| **DevOps**      | `promptliano-devops-architect`   | CI/CD, deployment, monitoring                        |
| **MCP Tools**   | `promptliano-mcp-architect`      | MCP tool creation, integration                      |
| **Code Quality**| `promptliano-code-quality-architect`| Analysis, patterns, modularization                  |
| **Code Review** | `staff-engineer-code-reviewer`   | **MANDATORY** - Quality, security, type safety      |

### How to Load an Agent

```python
Task(
  subagent_type: "agent-name-from-table",
  description: "What you're implementing",
  prompt: "Implementation context and requirements"
)
```

---

## 🔄 Development Workflow

### 1. Start Every Session

```
# First, list projects to get a valid ID
mcp__promptliano__project_manager(action: "list")
# Then use a real projectId from the list
mcp__promptliano__project_manager(
  action: "overview",
  projectId: <PROJECT_ID>
)
```

### 2. Plan with Agent (MANDATORY)

```python
Task(
  subagent_type: "promptliano-planning-architect",
  description: "Plan feature with agent assignments",
  prompt: "Create tickets/tasks with specific agent assignments"
)
```

### 3. Process with Assigned Agent

```python
# Get next task
mcp__promptliano__queue_processor(...)

# Load the assigned agent FIRST
Task(
  subagent_type: "<ASSIGNED_AGENT>",
  description: "Task description",
  prompt: "Implementation details"
)

# Then implement within agent context
```

### 4. Review with Code Reviewer

```python
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Review implementation",
  prompt: "Check quality, security, performance"
)
```

### 5. Complete Task

```
mcp__promptliano__queue_processor(
  action: "complete_task",
  data: { itemId: 789, completionNotes: "Done" }
)
```

---

## 📦 Package Structure (Modernized)

| Package                 | Purpose                            | Key Achievements         |
| ----------------------- | ---------------------------------- | ------------------------ |
| `@promptliano/database` | **Drizzle ORM, source of truth**   | 87%+ code reduction      |
| `@promptliano/services` | **Functional factory services**    | 25% code reduction       |
| `@promptliano/client`   | **React app with hook factories**  | 76% frontend reduction   |
| `@promptliano/server`   | **Hono API with route generation** | 40% route code reduction |
| `@promptliano/ui`       | **Component library**              | Complete @promptliano/ui |

### Import Patterns (Implemented)

```typescript
// Schema-first types (single source of truth)
import { TicketSchema, CreateTicketSchema } from '@promptliano/schemas'

// Database operations with Drizzle ORM
import { ticketRepository } from '@promptliano/database'

// Functional service factories
import { createTicketService } from '@promptliano/services'

// Auto-generated React hooks with TanStack Query
import { useTickets, useCreateTicket } from '@promptliano/client'
```

---

## 🛠️ Practical Examples

### 🎯 Schema-First Development: The Complete Workflow

#### **Step 1: Define Database Schema (Source of Truth)**

```typescript
// packages/database/src/schema.ts
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  status: text('status', { enum: ['open', 'in_progress', 'closed'] }).notNull(),
  createdAt: integer('created_at').notNull()
})
```

#### **Step 2: Generate Routes (Automated)**

```bash
cd packages/server
bun run routes:generate
```

**Generated Route File:**

```typescript
// packages/server/src/routes/generated/project-routes.generated.ts
export function registerProjectRoutes(app: OpenAPIHono) {
  // GET /api/projects - List all projects
  app.openapi(routeSpec, async (c) => {
    const projects = await projectService.getAll()
    return c.json(projects)
  })

  // POST /api/projects - Create project
  app.openapi(routeSpec, async (c) => {
    const data = c.req.valid('json')
    const project = await projectService.create(data)
    return c.json(project, 201)
  })

  // GET /api/projects/:id - Get project by ID
  app.openapi(routeSpec, async (c) => {
    const { id } = c.req.valid('param')
    const project = await projectService.getById(Number(id))
    return c.json(project)
  })
}
```

#### **Step 3: Register Routes in Server (One Line)**

```typescript
// packages/server/src/app.ts
import { registerAllGeneratedRoutes } from './routes/generated/index.generated'

export const app = new OpenAPIHono()

// Register ALL generated routes in one line
registerAllGeneratedRoutes(app)
```

#### **Step 4: Generate API Client (Automated)**

```bash
cd packages/api-client
bun run generate
```

**Generated Client:**

```typescript
// packages/api-client/src/generated/type-safe-client.ts
export class TypeSafeApiClient {
  async getProjects(): Promise<Project[]> {
    return this.request('GET', '/api/projects')
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.request('POST', '/api/projects', { body: data })
  }

  async getProjectById(id: number): Promise<Project> {
    return this.request('GET', `/api/projects/${id}`)
  }
}
```

#### **Step 5: Generate React Hooks (Automated)**

```bash
cd packages/client
bun run build
```

**Generated Hooks:**

```typescript
// packages/client/src/hooks/generated/project-hooks.ts
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects()
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
  })
}
```

#### **Step 6: Use in Components (Zero Boilerplate)**

```typescript
// Your React component
import { useProjects, useCreateProject } from '@/hooks/generated'

function ProjectManager() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()

  const handleCreate = async (data: CreateProjectData) => {
    await createProject.mutateAsync(data)
    // Cache automatically invalidated, UI updates automatically
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <button onClick={() => handleCreate({ name: 'New Project' })}>
        Create Project
      </button>
      {projects?.map(project => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  )
}
```

### Performance: Before vs After

| Step           | Old Process  | New Process   | Improvement    |
| -------------- | ------------ | ------------- | -------------- |
| Schema + Types | 3 hours      | 15 minutes    | **12x faster** |
| Repository     | 4 hours      | 30 minutes    | **8x faster**  |
| Services       | 3 hours      | 20 minutes    | **9x faster**  |
| API Routes     | 2 hours      | 10 minutes    | **12x faster** |
| React Hooks    | 3 hours      | 15 minutes    | **12x faster** |
| **Total**      | **15 hours** | **1.5 hours** | **10x faster** |

---

## 🚀 Code Generation System: The Heart of Promptliano

Promptliano's code generation system is the **core innovation** that enables its 87%+ code reduction and perfect type safety. Everything flows from the database schema through automated generation pipelines.

### 🎯 Core Philosophy: "Database Schema → Generate Everything"

**Single source of truth drives everything:**

- Database schema defines the data model
- Generation creates API routes, types, clients, and hooks
- Factory patterns eliminate manual boilerplate
- 100% type safety from database to UI

### 📦 The Three Generation Pipelines

#### 1. **Route Generation** (`packages/server` → Server Integration)

**Pattern:** Database Schema → Generate Routes → Register in Server

**What it generates:**

- Complete Hono API routes from Drizzle schemas
- OpenAPI documentation with full type coverage
- CRUD endpoints for all entities (GET, POST, PUT, DELETE)
- Path/query parameter validation
- Request/response schemas with Zod

**Generated structure:**

```
packages/server/src/routes/generated/
├── *-routes.generated.ts     # Entity-specific routes
├── index.generated.ts        # Route registration hub
└── types.generated.ts        # Type definitions
```

**CLI Usage:**

```bash
cd packages/server

# Generate routes from database schema
bun run routes:generate

# Watch mode - auto-regenerate on schema changes
bun run routes:watch

# Extract config from existing schema
bun run routes:extract

# Validate generated routes
bun run routes:validate
```

**Server Integration:**

```typescript
// packages/server/src/app.ts
import { registerAllGeneratedRoutes } from './routes/generated/index.generated'

// Register all generated routes in one line
registerAllGeneratedRoutes(app)
```

#### 2. **API Client Generation** (`packages/api-client` → Frontend Integration)

**Pattern:** OpenAPI Spec → Generate Client → Type-Safe API Calls

**What it generates:**

- Complete TypeScript API client from OpenAPI spec
- Type-safe methods for all endpoints
- Path parameter validation and encoding
- Query parameter handling
- Request/response type definitions
- Error handling with proper typing

**Generated structure:**

```
packages/api-client/src/generated/
├── api-types.ts          # OpenAPI-generated types
├── type-safe-client.ts   # Main client class
├── openapi-spec.json     # Latest API spec
└── index.ts              # Exports
```

**Usage:**

```bash
cd packages/api-client

# Generate from running server
bun run generate

# Build with generation
bun run build
```

**Frontend Integration:**

```typescript
import { createTypeSafeClient } from '@promptliano/api-client'

const api = createTypeSafeClient({
  baseUrl: 'http://localhost:3147'
})

// Fully type-safe API calls
const projects = await api.getProjects()
const newProject = await api.createProject({
  name: 'My Project',
  description: 'A new project'
})
```

#### 3. **React Hooks Generation** (`packages/client` → UI Integration)

**Pattern:** API Client → Generate Hooks → Zero-Boilerplate React Components

**What it generates:**

- TanStack Query hooks for all entities
- Optimistic updates and cache management
- Type-safe mutations with proper error handling
- Loading states and error boundaries
- Automatic cache invalidation

**Generated structure:**

```
packages/client/src/hooks/generated/
├── index.ts                 # All hook exports
├── query-keys.ts           # Cache management
├── *-hooks.ts              # Entity-specific hooks
└── types.ts                 # Hook type definitions
```

**Usage:**

```bash
cd packages/client

# Hooks generate automatically during build
bun run build

# Or generate manually
bun run generate:hooks
```

**UI Integration:**

```typescript
import {
  useProjects,
  useCreateProject,
  useUpdateProject
} from '@/hooks/generated'

function ProjectManager() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()

  const handleCreate = async (data: CreateProjectData) => {
    await createProject.mutateAsync(data)
    // Cache automatically invalidated
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {projects?.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
```

### 🔄 Complete Development Workflow: Schema → UI

#### **The Generation Pipeline:**

```bash
# 1. Update Database Schema (Single Source of Truth)
packages/database/src/schema.ts
    ↓

# 2. Generate Server Routes
cd packages/server && bun run routes:generate
    ↓

# 3. Server Integration (One Line)
packages/server/src/app.ts → registerAllGeneratedRoutes(app)
    ↓

# 4. Generate API Client
cd packages/api-client && bun run generate
    ↓

# 5. Generate React Hooks
cd packages/client && bun run build
    ↓

# 6. Use Generated Hooks in Components
import { useProjects, useCreateProject } from '@/hooks/generated'
```

#### **Full Stack Type Safety Achieved:**

```typescript
// Database Schema (Source of Truth)
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull()
})

// Generated API Route
app.get('/api/projects', async (c) => {
  const projects = await projectService.getAll()
  return c.json(projects)
})

// Generated API Client
const api = createTypeSafeClient()
const projects = await api.getProjects() // Fully typed!

// Generated React Hook
const { data: projects, isLoading } = useProjects() // Fully typed!

// UI Component (Zero Boilerplate)
function ProjectList() {
  const { data: projects } = useProjects()
  return <div>{projects?.map(p => <div>{p.name}</div>)}</div>
}
```

#### **Watch Mode for Development:**

```bash
# Start development servers
bun run start:dev

# In another terminal - watch for schema changes
cd packages/server && bun run routes:watch

# In another terminal - watch for API changes
cd packages/api-client && bun run generate --watch
```

### ⚙️ Configuration Files

#### **Route Generator Config** (`route-codegen.config.json`)

```json
{
  "entities": [
    {
      "name": "Project",
      "plural": "projects",
      "tableName": "projects",
      "schemaPath": "@promptliano/schemas",
      "servicePath": "@promptliano/services",
      "options": {
        "includeSoftDelete": true,
        "enableSearch": true
      }
    }
  ],
  "outputDir": "./src/routes/generated",
  "options": {
    "watch": {
      "debounceMs": 1000,
      "watchPaths": ["packages/database/src/**/*.ts"]
    }
  }
}
```

#### **API Client Config** (Environment Variables)

```bash
# Server URL for OpenAPI spec fetch
PROMPTLIANO_SERVER_URL=http://localhost:3147

# Prefer server spec over local file
PREFER_SERVER_SPEC=true
```

### 📊 Codegen Benefits Achieved

| Generator          | Manual Lines Saved | Automation Level | Type Safety |
| ------------------ | ------------------ | ---------------- | ----------- |
| **API Client**     | ~500 lines         | 100%             | ✅ Full     |
| **Routes**         | ~800 lines         | 95%              | ✅ Full     |
| **React Hooks**    | ~600 lines         | 100%             | ✅ Full     |
| **Total**          | **~1,900 lines**   | **98%**          | ✅ Complete |

### 🎯 Best Practices: The Generation-First Mindset

#### **Core Principles:**

1. **Database Schema is King** - Everything flows from the single source of truth
2. **Generation Over Manual Code** - Let automation handle the boilerplate
3. **Factory Patterns Everywhere** - Pure functions, no side effects, composable
4. **Type Safety First** - Compile-time guarantees, zero runtime type errors
5. **Modularity & Simplicity** - Small, focused functions that do one thing well

#### **The Generation Workflow:**

```bash
# 🚀 Complete pipeline from schema to UI
cd packages/database && # Make schema changes
cd ../server && bun run routes:generate
cd ../api-client && bun run generate
cd ../client && bun run build

# 🎯 Result: Fully type-safe, zero-boilerplate UI components
```

#### **What to Generate vs What to Write:**

**🤖 Generate These (87%+ of code):**

- API routes from database schema
- Type-safe API clients
- React hooks with caching
- CRUD operations
- Type definitions

**✍️ Write These (13% custom logic):**

- Business logic functions
- Custom UI components
- Complex workflows
- Error handling strategies
- Configuration

#### **Development Commandments:**

- ✅ **Start with database schema changes**
- ✅ **Run generation after every schema change**
- ✅ **Use generated hooks in components (never manual API calls)**
- ✅ **Write pure functions and factory patterns**
- ✅ **Keep components simple - delegate to hooks**

#### **What NOT to Do:**

- ❌ Never edit `*.generated.ts` files
- ❌ Don't write manual API routes (use generation)
- ❌ Don't create manual React hooks (use generation)
- ❌ Don't duplicate type definitions
- ❌ Don't write imperative code when functional patterns exist

### 🔧 Troubleshooting

#### **Common Issues:**

```bash
# Clear all generated files
bun run routes:clean
rm -rf packages/api-client/src/generated/
rm -rf packages/client/src/hooks/generated/

# Regenerate everything
bun run routes:generate
bun run build:api-client
bun run build:client
```

#### **Debug Commands:**

```bash
# Validate route generation
bun run routes:validate

# Check API client generation
cd packages/api-client && bun run test

# Verify hook generation
cd packages/client && bun run typecheck
```

---

## ✅ Testing & Validation

### Core Commands (Use Bun Always)

```bash
# Quick validation
bun run validate:quick

# Full validation
bun run typecheck && bun run test:all

# Package-specific
bun run test:database
bun run test:services
bun run test:client
```

### Testing Rules

1. **Always use Bun** (not npm/yarn/pnpm)
2. **Run tests after changes** to relevant packages
3. **Full validation before commits** for substantial changes
4. **Package-specific tests** for quick iteration

---

## 🚨 Circuit Breakers

**If you catch yourself doing ANY of these - STOP:**

❌ Writing code without loading an agent first
❌ Skipping planning step for "simple" tasks  
❌ Creating manual schemas instead of using database schema
❌ Implementing without queue/ticket system
❌ Completing work without code review agent

**Recovery:** Stop → Load correct agent → Start over

---

## 🎯 Quick Start Checklist

### 🚀 New Feature Development (Generation-First)

- [ ] Load `promptliano-planning-architect` for feature planning
- [ ] Define database schema in `packages/database/src/schema.ts`
- [ ] Generate routes: `cd packages/server && bun run routes:generate`
- [ ] Generate API client: `cd packages/api-client && bun run generate`
- [ ] Generate React hooks: `cd packages/client && bun run build`
- [ ] Use generated hooks in components (zero boilerplate!)
- [ ] Run `staff-engineer-code-reviewer` for quality assurance

### 🗄️ Database Schema Changes (Source of Truth)

- [ ] Update `packages/database/src/schema.ts` (single source of truth)
- [ ] Run route generation: `cd packages/server && bun run routes:generate`
- [ ] Run API client generation: `cd packages/api-client && bun run generate`
- [ ] Run client build: `cd packages/client && bun run build`
- [ ] All types, routes, clients, and hooks automatically updated!

### 🎨 Frontend Development (Hook-First)

- [ ] Use generated hooks: `import { useEntity } from '@/hooks/generated'`
- [ ] Never write manual API calls or hooks
- [ ] Leverage 100% type safety from database to UI
- [ ] Focus on UI/UX, not boilerplate
- [ ] Components stay simple and focused

---

## 💡 Key Reminders

✅ **Database schema** drives everything - it's the single source of truth
✅ **Agent specialization** ensures quality and consistency  
✅ **Functional factories** eliminate boilerplate across the stack
✅ **Type safety** prevents runtime errors through compile-time validation
✅ **Performance gains** are automatic with modern patterns

**Result: 10-15x faster development with 87%+ code reduction and perfect type safety**

---

## 🔄 Essential MCP Tools

```
# Project overview
mcp__promptliano__project_manager(action: "overview", projectId: <PROJECT_ID>)

# File suggestions
mcp__promptliano__project_manager(action: "suggest_files", projectId: <PROJECT_ID>, data: { prompt: "auth" })

# Queue management
mcp__promptliano__queue_manager(action: "create_queue", ...)
mcp__promptliano__queue_processor(action: "get_next_task", ...)

# Task management
mcp__promptliano__ticket_manager(action: "create", ...)
mcp__promptliano__task_manager(action: "create", ...)
```

---

## 🎉 The Bottom Line

**You now have a 10-15x faster development system with:**

- Single source of truth (database schema)
- Specialized agents for every domain
- Automatic type generation and validation
- Modern patterns that eliminate boilerplate
- Comprehensive testing and review processes

**Just remember: Database schema → Generate everything → Use generated hooks. Everything else follows automatically.**

---

## 🎯 Core Development Principles

### **1. Database Schema as Source of Truth**

Everything starts with the database schema in `packages/database/src/schema.ts`. This single source drives:

- Type definitions across the entire stack
- API routes generation
- Frontend type safety
- Database migrations

### **2. Generation Patterns**

87%+ of code is auto-generated:

- **Route Generation**: `bun run routes:generate` creates API routes from schema
- **API Client Generation**: `bun run generate` creates type-safe clients
- **Hook Generation**: `bun run build` creates React hooks with caching

### **3. Factory Patterns**

Pure functional factories eliminate boilerplate:

- Service factories for business logic
- Route factories for API endpoints
- Hook factories for React components
- All composable, testable, and modular

### **4. Strong Type Safety**

End-to-end TypeScript types from database to UI:

- Compile-time error prevention
- IntelliSense everywhere
- Zero runtime type errors
- Automatic refactoring safety

### **5. Simplicity & Modularity**

- Small, focused functions
- Single responsibility principle
- No side effects in pure functions
- Clean separation of concerns
- Easy to test and maintain

### **6. Pure Functions**

- Predictable, testable code
- No hidden state or side effects
- Easy to compose and reuse
- Mathematical approach to programming
