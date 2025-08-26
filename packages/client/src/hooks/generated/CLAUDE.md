# Generated Hooks System - Technical Implementation

## Architecture Overview

The Generated Hook System eliminates repetitive React Query code through powerful factory patterns, achieving 76% code reduction while providing enhanced functionality.

### Core Architecture

```
generated/
├── index.ts              # Main factory-generated hooks
├── entity-configs.ts     # Entity configurations
├── query-keys.ts        # Centralized cache key management
├── types.ts             # TypeScript type definitions
├── ai-chat-hooks.ts     # AI chat specialized hooks
├── flow-hooks.ts        # Flow management hooks
├── git-hooks.ts         # Git operations hooks
├── mcp-hooks.ts         # MCP protocol hooks
└── providers-hooks.ts   # Provider management hooks
```

## Factory Pattern Implementation

### CRUD Hook Factory

```typescript
export function createCrudHooks<TEntity, TCreate, TUpdate>(config: {
  entityName: string
  queryKeys: QueryKeyFactory
  apiClient: CrudApiClient<TEntity, TCreate, TUpdate>
  optimistic?: OptimisticConfig<TEntity>
  invalidation?: InvalidationStrategy
  messages?: EntityMessages
}) {
  // Generate complete CRUD operations with:
  // - Type-safe API calls
  // - Optimistic updates
  // - Smart cache invalidation
  // - Error handling
  // - Success notifications
}
```

### Client Wrapper Pattern

```typescript
function createClientWrapper<TEntity, TCreate, TUpdate>(config) {
  return {
    ...config,
    apiClient: {
      list: (_, params?) => {
        const client = useApiClient()
        if (!client) throw new Error('API client not initialized')
        return config.apiClient.list(client, params)
      }
      // Wraps all CRUD operations with client injection
    }
  }
}
```

## Query Key Management

### Hierarchical Key Structure

```typescript
export const PROJECT_ENHANCED_KEYS = {
  all: ['projects'] as const,
  lists: () => [...PROJECT_ENHANCED_KEYS.all, 'list'] as const,
  list: (params) => [...PROJECT_ENHANCED_KEYS.lists(), params] as const,
  details: () => [...PROJECT_ENHANCED_KEYS.all, 'detail'] as const,
  detail: (id) => [...PROJECT_ENHANCED_KEYS.details(), id] as const,

  // Relationship keys
  files: (projectId) => [...PROJECT_ENHANCED_KEYS.all, 'files', projectId] as const,
  sync: (projectId) => [...PROJECT_ENHANCED_KEYS.all, 'sync', projectId] as const,
  statistics: (projectId) => [...PROJECT_ENHANCED_KEYS.all, 'statistics', projectId] as const
}
```

### Relationship-Aware Invalidation

```typescript
const ENTITY_RELATIONSHIPS = {
  projects: ['tickets', 'prompts', 'agents', 'files', 'queues'],
  tickets: ['tasks', 'projects'],
  tasks: ['tickets'],
  chats: ['messages'],
  queues: ['queueItems', 'tickets', 'tasks']
}

export function invalidateWithRelationships(queryClient: QueryClient, entityName: string, cascade = true) {
  // Invalidate primary entity
  invalidateEntityQueries(queryClient, entityName)

  // Cascade to related entities
  if (cascade) {
    const related = ENTITY_RELATIONSHIPS[entityName]
    related?.forEach((relatedEntity) => {
      invalidateEntityQueries(queryClient, relatedEntity)
    })
  }
}
```

## Optimistic Updates

### Configuration Pattern

```typescript
export const projectOptimisticConfig: OptimisticConfig<Project> = {
  enabled: true,
  createOptimisticEntity: (data: CreateProjectBody) => ({
    ...data,
    id: -Date.now(), // Temporary negative ID
    created: Date.now(),
    updated: Date.now(),
    status: 'active'
  }),
  updateOptimisticEntity: (oldData, newData) => ({
    ...oldData,
    ...newData,
    updated: Date.now()
  }),
  deleteStrategy: 'remove' // or 'mark-deleted'
}
```

### Implementation in Factory

```typescript
const createMutation = useMutation({
  mutationFn: apiClient.create,
  onMutate: async (newData) => {
    if (!optimistic?.enabled) return

    // Cancel in-flight queries
    await queryClient.cancelQueries(queryKeys.all)

    // Snapshot current state
    const previousData = queryClient.getQueryData(queryKeys.lists())

    // Optimistic update
    const optimisticEntity = optimistic.createOptimisticEntity(newData)
    queryClient.setQueryData(queryKeys.lists(), (old) => [...(old || []), optimisticEntity])

    return { previousData }
  },
  onError: (err, newData, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData(queryKeys.lists(), context.previousData)
    }
  },
  onSettled: () => {
    // Ensure consistency
    queryClient.invalidateQueries(queryKeys.all)
  }
})
```

## Entity Configuration

### Standard Entity Config

```typescript
export const PROJECT_CONFIG = {
  entityName: 'Project',
  queryKeys: PROJECT_ENHANCED_KEYS,
  apiClient: {
    list: (client, params?) => client.projects.listProjects(params),
    getById: (client, id) => client.projects.getProject(id),
    create: (client, data) => client.projects.createProject(data),
    update: (client, id, data) => client.projects.updateProject(id, data),
    delete: (client, id) => client.projects.deleteProject(id)
  },
  optimistic: projectOptimisticConfig,
  invalidation: {
    onCreate: 'lists',
    onUpdate: 'lists',
    onDelete: 'all'
  },
  messages: ENTITY_MESSAGES.project
}
```

### Specialized Hooks

#### AI Chat Hooks

```typescript
export function useAIStreamChat({ chatId, provider, model }) {
  const { messages, append, stop, isLoading } = useChat({
    api: '/api/ai/chat',
    id: chatId.toString(),
    onError: handleAIError
  })

  const sendMessage = useCallback(
    async (content, options?) => {
      await append({ role: 'user', content, createdAt: new Date() }, { body: { chatId, provider, model, options } })
    },
    [append, chatId, provider, model]
  )

  return { messages, sendMessage, stop, isLoading }
}
```

#### Flow Management Hooks

```typescript
export function useFlowOperations() {
  const queryClient = useQueryClient()

  return {
    moveItem: useMutation({
      mutationFn: ({ itemId, targetQueueId }) => apiClient.flow.move(itemId, targetQueueId),
      onSuccess: () => {
        queryClient.invalidateQueries(['queues'])
        queryClient.invalidateQueries(['flow'])
      }
    }),

    processItem: useMutation({
      mutationFn: ({ itemId }) => apiClient.flow.process(itemId),
      onMutate: async ({ itemId }) => {
        // Optimistic status update
        await queryClient.cancelQueries(['flow', 'items', itemId])
        const previous = queryClient.getQueryData(['flow', 'items', itemId])
        queryClient.setQueryData(['flow', 'items', itemId], {
          ...previous,
          status: 'processing'
        })
        return { previous }
      }
    })
  }
}
```

#### Git Operations Hooks

```typescript
export function useGitOperations(projectId: number) {
  const queryClient = useQueryClient()

  return {
    commit: useMutation({
      mutationFn: (message: string) => apiClient.git.commit(projectId, message),
      onSuccess: () => {
        queryClient.invalidateQueries(['git', 'status', projectId])
        queryClient.invalidateQueries(['git', 'log', projectId])
        toast.success('Changes committed')
      }
    }),

    stage: useMutation({
      mutationFn: (files: string[]) => apiClient.git.stage(projectId, files),
      onSuccess: () => {
        queryClient.invalidateQueries(['git', 'status', projectId])
      }
    })
  }
}
```

## Performance Optimizations

### Prefetching Strategy

```typescript
export function usePrefetchRelatedData(entityName: string, id: number) {
  const queryClient = useQueryClient()
  const config = ENTITY_CONFIGS[entityName]

  useEffect(() => {
    // Prefetch related data in background
    const prefetchTasks = []

    if (config.relationships?.includes('files')) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: [...config.queryKeys.detail(id), 'files'],
          queryFn: () => config.apiClient.getFiles(id),
          staleTime: 5 * 60 * 1000
        })
      )
    }

    if (config.relationships?.includes('history')) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: [...config.queryKeys.detail(id), 'history'],
          queryFn: () => config.apiClient.getHistory(id)
        })
      )
    }

    Promise.all(prefetchTasks)
  }, [entityName, id])
}
```

### Batch Operations

```typescript
export function useBatchOperations<T>(entityName: string) {
  const queryClient = useQueryClient()
  const config = ENTITY_CONFIGS[entityName]

  return {
    batchCreate: useMutation({
      mutationFn: (items: T[]) => config.apiClient.batchCreate(items),
      onSuccess: () => {
        queryClient.invalidateQueries(config.queryKeys.all)
        toast.success(`Created ${items.length} ${entityName}s`)
      }
    }),

    batchUpdate: useMutation({
      mutationFn: (updates: Array<{ id: number; data: Partial<T> }>) =>
        Promise.all(updates.map(({ id, data }) => config.apiClient.update(id, data))),
      onSuccess: () => {
        queryClient.invalidateQueries(config.queryKeys.lists())
        updates.forEach(({ id }) => {
          queryClient.invalidateQueries(config.queryKeys.detail(id))
        })
      }
    }),

    batchDelete: useMutation({
      mutationFn: (ids: number[]) => Promise.all(ids.map((id) => config.apiClient.delete(id))),
      onSuccess: () => {
        queryClient.invalidateQueries(config.queryKeys.all)
        toast.success(`Deleted ${ids.length} items`)
      }
    })
  }
}
```

## Stale Time Configuration

```typescript
export const STALE_TIMES = {
  // Volatile data - refresh frequently
  MESSAGES: 0, // Always fresh
  TICKETS: 30 * 1000, // 30 seconds
  FLOW_ITEMS: 30 * 1000, // 30 seconds

  // Semi-stable data
  PROJECTS: 5 * 60 * 1000, // 5 minutes
  USERS: 5 * 60 * 1000, // 5 minutes

  // Stable data
  SETTINGS: 10 * 60 * 1000, // 10 minutes
  PROVIDER_KEYS: 10 * 60 * 1000, // 10 minutes

  // Static data - rarely changes
  CONFIGURATIONS: 60 * 60 * 1000, // 1 hour
  METADATA: 60 * 60 * 1000 // 1 hour
}
```

## Error Handling Patterns

```typescript
export function createErrorHandler(entityName: string) {
  return (error: any) => {
    if (error.response?.status === 404) {
      toast.error(`${entityName} not found`)
    } else if (error.response?.status === 403) {
      toast.error(`Not authorized to access ${entityName}`)
    } else if (error.response?.status === 422) {
      const message = error.response?.data?.message || 'Validation error'
      toast.error(message)
    } else {
      toast.error(`Failed to load ${entityName}`)
    }
  }
}
```

## Testing Patterns

```typescript
describe('Generated Hooks', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  it('should handle CRUD operations', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeDefined()
  })

  it('should handle optimistic updates', async () => {
    const { result } = renderHook(() => useCreateProject())

    act(() => {
      result.current.mutate({ name: 'Test', path: '/test' })
    })

    // Verify optimistic update applied immediately
    const cachedData = queryClient.getQueryData(['projects', 'list'])
    expect(cachedData).toContainEqual(
      expect.objectContaining({ name: 'Test' })
    )
  })
})
```

## Migration Strategy

### Phase 1: Identify Pattern

```typescript
// Old: Manual implementation
export function useGetProjects() {
  const client = useApiClient()
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => client.projects.listProjects()
  })
}

// New: Factory-generated
const projectHooks = createCrudHooks(PROJECT_CONFIG)
export const { useList: useProjects } = projectHooks
```

### Phase 2: Gradual Migration

1. Generate new hooks alongside existing ones
2. Update imports one component at a time
3. Test each migrated component
4. Remove old hooks once all references updated

### Phase 3: Leverage Advanced Features

- Enable optimistic updates
- Add prefetching
- Implement batch operations
- Add real-time synchronization

## Key Benefits

1. **Code Reduction**: 76% less code to maintain
2. **Type Safety**: 100% type inference from API client
3. **Consistency**: Uniform patterns across all entities
4. **Performance**: Built-in optimizations and caching
5. **Maintainability**: Single source of truth for each entity
6. **Extensibility**: Easy to add new entities or features
