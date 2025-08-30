# Generated Hooks

Factory-generated React Query hooks that eliminate boilerplate and provide consistent patterns across all entities.

## Directory Structure

```
generated/
├── index.ts              # Main exports - all generated hooks
├── entity-configs.ts     # Entity configurations for factory
├── query-keys.ts        # Centralized cache key management
├── types.ts             # TypeScript type definitions
├── ai-chat-hooks.ts     # AI chat streaming hooks
├── flow-hooks.ts        # Queue/flow management hooks
├── git-hooks.ts         # Git operations hooks
├── mcp-hooks.ts         # MCP protocol hooks
└── providers-hooks.ts   # Provider management hooks
```

## Usage

### Basic CRUD Operations

```typescript
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject
} from '@/hooks/generated'

function ProjectList() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()

  const handleCreate = () => {
    createProject.mutate({
      name: 'New Project',
      path: '/path/to/project'
    })
  }

  return (
    // Your component JSX
  )
}
```

### Specialized Hooks

```typescript
// AI Chat
import { useAIStreamChat } from '@/hooks/generated/ai-chat-hooks'

const { messages, sendMessage, isLoading } = useAIStreamChat({
  chatId: 1,
  provider: 'openai',
  model: 'gpt-4'
})

// Git Operations
import { useGitCommit, useGitStatus } from '@/hooks/generated/git-hooks'

const { data: status } = useGitStatus(projectId)
const commit = useGitCommit(projectId)

// Flow Management
import { useFlowQueue, useMoveQueueItem } from '@/hooks/generated/flow-hooks'

const { data: queue } = useFlowQueue(queueId)
const moveItem = useMoveQueueItem()
```

## Available Entities

- **Projects** - Full CRUD + files, sync, statistics
- **Tickets** - CRUD + tasks, completion workflows
- **Chats** - CRUD + streaming messages, forking
- **Prompts** - CRUD + optimization, validation
- **Agents** - CRUD + execution, capabilities
- **Queues** - CRUD + flow operations, processing
- **Provider Keys** - CRUD + validation, testing
- **Git** - Status, commit, branch, stash operations
- **MCP** - Servers, tools, resources, sessions
- **AI** - Chat streaming, text generation

## Key Features

- 🚀 **Optimistic Updates** - Instant UI feedback
- 🔄 **Smart Invalidation** - Automatic cache management
- 📦 **Batch Operations** - Efficient bulk actions
- 🔍 **Type Safety** - Full TypeScript support
- ⚡ **Prefetching** - Background data loading
- 🔔 **Notifications** - Built-in success/error toasts

## Technical Details

For implementation patterns, factory details, and migration guides, see [CLAUDE.md](./CLAUDE.md).
