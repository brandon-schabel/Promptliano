# 07: Frontend Hook Factory Pattern

## Dependencies
- **REQUIRES**: 01-drizzle-orm-migration.md (Need Drizzle schemas for types)
- **BLOCKS**: 08-frontend-optimizations.md (Optimizations build on hooks)
- **PARALLEL WITH**: 02, 03, 04, 05, 06 (Can work alongside backend)

## Overview
Implement a hook factory pattern that eliminates 30,000+ lines of repetitive React hook code. Creates reusable, type-safe hooks for all CRUD operations, subscriptions, and state management.

## Current Problems

```typescript
// PROBLEM: Same hook pattern repeated 200+ times
export function useTickets(projectId: number) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['tickets', projectId],
    queryFn: () => apiClient.tickets.getByProject(projectId),
  });
  
  const createMutation = useMutation({
    mutationFn: (data: CreateTicket) => apiClient.tickets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTicket }) =>
      apiClient.tickets.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
    },
  });
  
  // ... 50+ more lines
}

// Repeated for EVERY entity (30,000+ lines total)
```

## Target Implementation

### 1. Universal Hook Factory

```typescript
// packages/client/src/hooks/factory/create-entity-hooks.ts
export function createEntityHooks<
  TEntity extends { id: number },
  TCreate,
  TUpdate
>(config: EntityHookConfig<TEntity, TCreate, TUpdate>) {
  const {
    entityName,
    apiClient,
    queryKey,
    optimisticUpdate = true,
    realtimeSync = true,
  } = config;

  return {
    // List hook with filtering, sorting, pagination
    useList: (options?: ListOptions) => {
      const queryClient = useQueryClient();
      
      const query = useQuery({
        queryKey: [queryKey, 'list', options],
        queryFn: () => apiClient.list(options),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      // Real-time subscription
      useEffect(() => {
        if (!realtimeSync) return;
        
        const unsubscribe = subscribeToChanges(queryKey, () => {
          queryClient.invalidateQueries([queryKey]);
        });
        
        return unsubscribe;
      }, []);

      return {
        ...query,
        items: query.data?.items ?? [],
        total: query.data?.total ?? 0,
      };
    },

    // Single entity hook
    useOne: (id: number) => {
      return useQuery({
        queryKey: [queryKey, 'detail', id],
        queryFn: () => apiClient.getById(id),
        enabled: !!id,
      });
    },

    // Create mutation with optimistic updates
    useCreate: () => {
      const queryClient = useQueryClient();
      
      return useMutation({
        mutationFn: apiClient.create,
        
        onMutate: async (newData: TCreate) => {
          if (!optimisticUpdate) return;
          
          await queryClient.cancelQueries([queryKey]);
          
          const optimisticEntity = {
            ...newData,
            id: Date.now(), // Temporary ID
            created: Date.now(),
            updated: Date.now(),
          } as TEntity;
          
          queryClient.setQueryData(
            [queryKey, 'list'],
            (old: any) => ({
              ...old,
              items: [optimisticEntity, ...(old?.items ?? [])],
            })
          );
          
          return { optimisticEntity };
        },
        
        onError: (err, newData, context) => {
          if (context?.optimisticEntity) {
            queryClient.setQueryData(
              [queryKey, 'list'],
              (old: any) => ({
                ...old,
                items: old?.items.filter(
                  (item: TEntity) => item.id !== context.optimisticEntity.id
                ),
              })
            );
          }
        },
        
        onSettled: () => {
          queryClient.invalidateQueries([queryKey]);
        },
      });
    },

    // Update mutation with optimistic updates
    useUpdate: () => {
      const queryClient = useQueryClient();
      
      return useMutation({
        mutationFn: ({ id, data }: { id: number; data: TUpdate }) =>
          apiClient.update(id, data),
        
        onMutate: async ({ id, data }) => {
          if (!optimisticUpdate) return;
          
          await queryClient.cancelQueries([queryKey, 'detail', id]);
          
          const previousEntity = queryClient.getQueryData<TEntity>([
            queryKey,
            'detail',
            id,
          ]);
          
          if (previousEntity) {
            const optimisticEntity = {
              ...previousEntity,
              ...data,
              updated: Date.now(),
            };
            
            queryClient.setQueryData(
              [queryKey, 'detail', id],
              optimisticEntity
            );
            
            // Update in list too
            queryClient.setQueryData(
              [queryKey, 'list'],
              (old: any) => ({
                ...old,
                items: old?.items.map((item: TEntity) =>
                  item.id === id ? optimisticEntity : item
                ),
              })
            );
          }
          
          return { previousEntity };
        },
        
        onError: (err, variables, context) => {
          if (context?.previousEntity) {
            queryClient.setQueryData(
              [queryKey, 'detail', variables.id],
              context.previousEntity
            );
          }
        },
        
        onSettled: (data, error, { id }) => {
          queryClient.invalidateQueries([queryKey, 'detail', id]);
          queryClient.invalidateQueries([queryKey, 'list']);
        },
      });
    },

    // Delete mutation
    useDelete: () => {
      const queryClient = useQueryClient();
      
      return useMutation({
        mutationFn: apiClient.delete,
        
        onMutate: async (id: number) => {
          if (!optimisticUpdate) return;
          
          await queryClient.cancelQueries([queryKey]);
          
          queryClient.setQueryData(
            [queryKey, 'list'],
            (old: any) => ({
              ...old,
              items: old?.items.filter((item: TEntity) => item.id !== id),
            })
          );
        },
        
        onSettled: () => {
          queryClient.invalidateQueries([queryKey]);
        },
      });
    },

    // Bulk operations
    useBulkCreate: () => {
      const queryClient = useQueryClient();
      
      return useMutation({
        mutationFn: (items: TCreate[]) => apiClient.bulkCreate(items),
        onSettled: () => {
          queryClient.invalidateQueries([queryKey]);
        },
      });
    },

    useBulkUpdate: () => {
      const queryClient = useQueryClient();
      
      return useMutation({
        mutationFn: (updates: Array<{ id: number; data: TUpdate }>) =>
          apiClient.bulkUpdate(updates),
        onSettled: () => {
          queryClient.invalidateQueries([queryKey]);
        },
      });
    },

    useBulkDelete: () => {
      const queryClient = useQueryClient();
      
      return useMutation({
        mutationFn: (ids: number[]) => apiClient.bulkDelete(ids),
        onSettled: () => {
          queryClient.invalidateQueries([queryKey]);
        },
      });
    },

    // Search and filtering
    useSearch: (query: string, options?: SearchOptions) => {
      return useQuery({
        queryKey: [queryKey, 'search', query, options],
        queryFn: () => apiClient.search(query, options),
        enabled: query.length > 2,
        debounce: 300,
      });
    },

    // Infinite scroll
    useInfiniteList: (options?: ListOptions) => {
      return useInfiniteQuery({
        queryKey: [queryKey, 'infinite', options],
        queryFn: ({ pageParam = 0 }) =>
          apiClient.list({ ...options, offset: pageParam }),
        getNextPageParam: (lastPage, pages) =>
          lastPage.hasMore ? pages.length * (options?.limit ?? 20) : undefined,
      });
    },

    // Subscription to changes
    useSubscription: (callback: (event: EntityEvent<TEntity>) => void) => {
      useEffect(() => {
        const unsubscribe = subscribeToEntity(entityName, callback);
        return unsubscribe;
      }, [callback]);
    },

    // Prefetching
    usePrefetch: () => {
      const queryClient = useQueryClient();
      
      return {
        prefetchOne: (id: number) =>
          queryClient.prefetchQuery({
            queryKey: [queryKey, 'detail', id],
            queryFn: () => apiClient.getById(id),
          }),
        
        prefetchList: (options?: ListOptions) =>
          queryClient.prefetchQuery({
            queryKey: [queryKey, 'list', options],
            queryFn: () => apiClient.list(options),
          }),
      };
    },
  };
}
```

### 2. Generate Hooks for All Entities

```typescript
// packages/client/src/hooks/generated/index.ts
import { createEntityHooks } from '../factory/create-entity-hooks';
import { apiClient } from '@promptliano/api-client';
import type * as schemas from '@promptliano/schemas';

// Generate hooks for all entities
export const projectHooks = createEntityHooks<
  schemas.Project,
  schemas.CreateProject,
  schemas.UpdateProject
>({
  entityName: 'project',
  apiClient: apiClient.projects,
  queryKey: 'projects',
});

export const ticketHooks = createEntityHooks<
  schemas.Ticket,
  schemas.CreateTicket,
  schemas.UpdateTicket
>({
  entityName: 'ticket',
  apiClient: apiClient.tickets,
  queryKey: 'tickets',
});

// ... for all entities

// Export convenient aliases
export const {
  useList: useProjects,
  useOne: useProject,
  useCreate: useCreateProject,
  useUpdate: useUpdateProject,
  useDelete: useDeleteProject,
} = projectHooks;

export const {
  useList: useTickets,
  useOne: useTicket,
  useCreate: useCreateTicket,
  useUpdate: useUpdateTicket,
  useDelete: useDeleteTicket,
} = ticketHooks;
```

### 3. Usage in Components

```typescript
// Super clean component code
export function TicketList({ projectId }: { projectId: number }) {
  const { items: tickets, isLoading } = useTickets({ projectId });
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();

  if (isLoading) return <Spinner />;

  return (
    <div>
      {tickets.map(ticket => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          onUpdate={(data) => updateTicket.mutate({ id: ticket.id, data })}
          onDelete={() => deleteTicket.mutate(ticket.id)}
        />
      ))}
      
      <CreateTicketForm
        onSubmit={(data) => createTicket.mutate(data)}
      />
    </div>
  );
}
```

## Migration Strategy

### Phase 1: Create Hook Factory (Day 1-3)
1. Implement createEntityHooks factory
2. Add optimistic update logic
3. Add real-time sync support
4. Add infinite scroll support

### Phase 2: Generate Entity Hooks (Day 4-5)
```typescript
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

// Generate hooks for each
```

### Phase 3: Migrate Components (Day 6-10)
- Replace manual hooks with generated hooks
- Remove duplicate hook code
- Update component imports

## Success Metrics

- ✅ 30,000+ lines of hook code eliminated
- ✅ 100% consistent data fetching patterns
- ✅ Optimistic updates everywhere
- ✅ Real-time sync built-in
- ✅ Type safety from backend to UI

## Definition of Done

- [ ] Hook factory implemented
- [ ] All entity hooks generated
- [ ] Optimistic updates working
- [ ] Real-time sync configured
- [ ] All components migrated
- [ ] Old hooks removed
- [ ] Performance benchmarks