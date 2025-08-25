# CLAUDE.md

# 🎯 Promptliano Development Guide

## Core Philosophy: Agent-First + Drizzle-First

Promptliano is built on two foundational principles:

1. **Agent-First Development** - Every task requires specialized expertise
2. **Drizzle-First Architecture** - Database schema drives everything

---

## 🏗️ Architecture Overview: Database → Everything

```
packages/database/src/schema.ts (THE SOURCE OF TRUTH)
    ↓
Auto-generated Types & Zod Schemas
    ↓
Repository Layer (Drizzle queries)
    ↓
Service Layer (Functional factories)
    ↓
API Routes (Hono + OpenAPI)
    ↓
Frontend Hooks (Hook factories)
    ↓
UI Components (React + shadcn/ui)
```

### ⚡ Key Benefits Achieved
- **64,000+ lines eliminated** from codebase
- **10-15x development velocity** increase
- **100% type safety** from database to UI
- **6-20x performance improvement** on backend

---

## 🤖 Agent Quick Reference

**RULE: Every task needs an agent. No exceptions.**

| Working On | Agent | Why |
|------------|-------|-----|
| **Planning** | `promptliano-planning-architect` | Creates tickets with agent assignments |
| **Database** | `drizzle-migration-architect` | Drizzle ORM expertise |
| **Services** | `promptliano-service-architect` | Functional factory patterns |
| **API Routes** | `hono-bun-api-architect` | Hono + OpenAPI + Zod |
| **Frontend** | `promptliano-ui-architect` | React components + hook factories |
| **Forms** | `promptliano-forms-architect` | Form validation + UX patterns |
| **E2E Testing** | `promptliano-playwright-expert` | **NEW** - Playwright E2E tests with MCP integration |
| **API Testing** | `api-test-automation-expert` | Isolated test environments |
| **Routing** | `tanstack-router-expert` | Type-safe routing with TanStack Router |
| **Schemas** | `zod-schema-architect` | Data validation schemas |
| **Type Safety** | `typescript-type-safety-auditor` | Remove 'any' types, ensure type safety |
| **AI Features** | `vercel-ai-sdk-expert` | AI SDK integration and streaming |
| **Code Review** | `staff-engineer-code-reviewer` | **MANDATORY after ALL work** |

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
mcp__promptliano__project_manager(
  action: "overview",
  projectId: 1754713756748
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

| Package | Purpose | Key Changes |
|---------|---------|-------------|
| `@promptliano/database` | **Drizzle ORM, source of truth** | NEW - replaces storage |
| `@promptliano/services` | **Functional factory services** | 75% code reduction |
| `@promptliano/client` | **React app with hook factories** | 76% frontend reduction |
| `@promptliano/server` | **Hono API with route generation** | 40% route code reduction |
| `@promptliano/ui` | **Component library** | Enhanced patterns |

### Import Patterns (NEW)

```typescript
// Database operations
import { ticketRepository } from '@promptliano/database'

// Service factories
import { createTicketService } from '@promptliano/services'

// Auto-generated types
import { TicketSchema } from '@promptliano/database/schema'

// Hook factories
import { useTickets } from '@promptliano/client/hooks'
```

---

## 🛠️ Practical Examples

### Database-First Feature Development

#### 1. Define Schema (Source of Truth)
```typescript
// packages/database/src/schema.ts
export const myFeature = sqliteTable('my_feature', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  projectId: integer('project_id').references(() => projects.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})
```

#### 2. Types Auto-Generate
```bash
bun run db:generate  # Creates Zod schemas automatically
```

#### 3. Create Repository
```typescript
// packages/database/src/repositories/my-feature-repository.ts
export const myFeatureRepository = createBaseRepository(myFeature, {
  async getByProject(projectId: number) {
    return await db.select().from(myFeature).where(eq(myFeature.projectId, projectId))
  }
})
```

#### 4. Service Factory
```typescript
// packages/services/src/my-feature-service.ts
export function createMyFeatureService(deps = {}) {
  const baseService = createCrudService({
    entityName: 'MyFeature',
    repository: myFeatureRepository,
    schema: MyFeatureSchema
  })
  
  return extendService(baseService, {
    // Add domain-specific methods
  })
}
```

#### 5. Hook Factory
```typescript
// packages/client/src/hooks/my-feature-hooks.ts
const myFeatureHooks = createEntityHooks<MyFeature, CreateMyFeature, UpdateMyFeature>({
  entityName: 'MyFeature',
  clientPath: 'my-features'
})

export const useMyFeatures = myFeatureHooks.useGetAll
export const useCreateMyFeature = myFeatureHooks.useCreate
```

### Performance: Before vs After

| Step | Old Process | New Process | Improvement |
|------|-------------|-------------|-------------|
| Schema + Types | 3 hours | 15 minutes | **12x faster** |
| Repository | 4 hours | 30 minutes | **8x faster** |
| Services | 3 hours | 20 minutes | **9x faster** |
| API Routes | 2 hours | 10 minutes | **12x faster** |
| React Hooks | 3 hours | 15 minutes | **12x faster** |
| **Total** | **15 hours** | **1.5 hours** | **10x faster** |

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

### For New Features:
- [ ] Load `promptliano-planning-architect`
- [ ] Create tickets with agent assignments
- [ ] Process through queue system
- [ ] Use assigned specialized agents
- [ ] Run `staff-engineer-code-reviewer`
- [ ] Complete and validate

### For Database Work:
- [ ] Define schema in `packages/database/src/schema.ts`
- [ ] Auto-generate types with `bun run db:generate`
- [ ] Create repository with Drizzle queries
- [ ] Use `drizzle-migration-architect` agent

### For Frontend Work:
- [ ] Use hook factories (not manual hooks)
- [ ] Leverage auto-generated types
- [ ] Use `promptliano-ui-architect` agent
- [ ] Test with existing components

---

## 💡 Key Reminders

✅ **Database schema** drives everything - it's the single source of truth
✅ **Agent specialization** ensures quality and consistency  
✅ **Functional factories** eliminate boilerplate across the stack
✅ **Type safety** prevents runtime errors through compile-time validation
✅ **Performance gains** are automatic with modern patterns

**Result: 10-15x faster development with better quality code**

---

## 🔄 Essential MCP Tools

```
# Project overview
mcp__promptliano__project_manager(action: "overview", projectId: 1754713756748)

# File suggestions  
mcp__promptliano__project_manager(action: "suggest_files", projectId: 1754713756748, data: { prompt: "auth" })

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

**Just remember: Agent first, schema first, types follow automatically.**