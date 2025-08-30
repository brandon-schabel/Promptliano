# Database Migration System

## Overview

`migrate.ts` handles Drizzle ORM database migrations, table creation, and performance optimization for the SQLite database.

## Core Functions

### `runMigrations()`

Executes all pending Drizzle migrations from the `./drizzle` folder.

```typescript
import { runMigrations } from './migrate'
await runMigrations()
```

### `createInitialSchema()`

Creates all tables and performance indexes on first run. Validates table creation and sets up optimized indexes.

```typescript
import { createInitialSchema } from './migrate'
await createInitialSchema()
```

### `generateId()`

Generates unique timestamp-based IDs for new records.

```typescript
import { generateId } from './migrate'
const id = generateId() // Returns: timestamp + random
```

## Running Migrations

### Development

```bash
# Run migrations manually
bun run migrate

# Test with validation
bun run test:migration:validate
```

### Programmatic Usage

```typescript
import { createInitialSchema, runMigrations } from '@promptliano/database/migrations/migrate'

// First time setup
await createInitialSchema()

// Apply new migrations
await runMigrations()
```

## Tables Created

- `projects`, `tickets`, `ticket_tasks`
- `chats`, `chat_messages`, `prompts`
- `queues`, `queue_items`
- `claude_agents`, `claude_commands`, `claude_hooks`
- `provider_keys`, `files`, `selected_files`, `active_tabs`

## Performance Indexes

Automatically creates composite indexes for:

- `tickets(project_id, status)` - Fast project filtering
- `tickets(project_id, priority)` - Priority sorting
- `ticket_tasks(ticket_id, done)` - Task completion queries
- `chat_messages(chat_id, created_at)` - Message history
- `queue_items(queue_id, status)` - Queue processing
- `files(project_id, is_relevant)` - File relevance filtering
