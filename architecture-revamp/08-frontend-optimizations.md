# 08: Frontend Optimization Strategies

## 📋 Frontend Optimizations TODO Tracker

### 🔑 Query Key System Standardization
- [ ] Create unified query key factory for consistent cache management (Priority: HIGH) [4 hours]
- [ ] Implement query key namespace conventions (tickets, projects, tasks, etc.) (Priority: HIGH) [2 hours]
- [ ] Add query key validation and type safety (Priority: MEDIUM) [3 hours]
- [ ] Build query key dependency mapping for smart invalidation (Priority: HIGH) [5 hours]

### 🚨 Error Handling Unification
- [ ] Design global error boundary with recovery strategies (Priority: HIGH) [3 hours]
- [ ] Create smart error classification (network, validation, auth, etc.) (Priority: HIGH) [4 hours]
- [ ] Implement context-aware error messages and actions (Priority: MEDIUM) [3 hours]
- [ ] Add automatic retry logic with exponential backoff (Priority: MEDIUM) [2 hours]
- [ ] Build error reporting and monitoring dashboard (Priority: LOW) [4 hours]

### ⏳ Loading State Management
- [ ] Create intelligent loading state components (skeletons, spinners, placeholders) (Priority: HIGH) [4 hours]
- [ ] Implement progressive loading for complex views (Priority: MEDIUM) [5 hours]
- [ ] Add loading state orchestration for dependent queries (Priority: HIGH) [3 hours]
- [ ] Build empty state components with contextual actions (Priority: MEDIUM) [3 hours]
- [ ] Design loading state transitions and animations (Priority: LOW) [2 hours]

### 📊 Performance Monitoring Setup
- [ ] Implement real-time performance metrics collection (Priority: HIGH) [4 hours]
- [ ] Create performance dashboard with query analytics (Priority: MEDIUM) [6 hours]
- [ ] Add slow query detection and alerting (Priority: HIGH) [3 hours]
- [ ] Build cache hit/miss ratio monitoring (Priority: MEDIUM) [2 hours]
- [ ] Design performance regression detection (Priority: LOW) [4 hours]

### 🔄 Batch Operations Implementation
- [ ] Create batch mutation factory for bulk operations (Priority: HIGH) [5 hours]
- [ ] Implement optimistic batch updates with rollback (Priority: HIGH) [6 hours]
- [ ] Add batch request deduplication and throttling (Priority: MEDIUM) [4 hours]
- [ ] Build batch progress tracking and user feedback (Priority: MEDIUM) [3 hours]
- [ ] Design batch operation conflict resolution (Priority: LOW) [4 hours]

### 🔗 Cross-Tab Synchronization
- [ ] Implement BroadcastChannel-based state sync (Priority: HIGH) [4 hours]
- [ ] Create cross-tab mutation broadcasting (Priority: HIGH) [3 hours]
- [ ] Add optimistic update synchronization across tabs (Priority: MEDIUM) [4 hours]
- [ ] Build cross-tab cache invalidation strategy (Priority: HIGH) [3 hours]
- [ ] Design offline/online state sync handling (Priority: LOW) [5 hours]

### 🚀 Intelligent Prefetching
- [ ] Create hover-based prefetching system (Priority: HIGH) [4 hours]
- [ ] Implement viewport intersection prefetching (Priority: HIGH) [3 hours]
- [ ] Add route-based predictive prefetching (Priority: MEDIUM) [5 hours]
- [ ] Build prefetch priority management (Priority: MEDIUM) [3 hours]
- [ ] Design prefetch cache warming strategies (Priority: LOW) [4 hours]

### 🎯 Performance Optimization Goals
- [ ] Achieve 80% faster perceived performance (Priority: HIGH) [Target Metric]
- [ ] Reduce duplicate requests by 90% (Priority: HIGH) [Target Metric]
- [ ] Implement instant navigation (100% prefetched) (Priority: HIGH) [Target Metric]
- [ ] Cut API calls by 50% through smart caching (Priority: HIGH) [Target Metric]
- [ ] Eliminate 14,000+ lines of performance-related code (Priority: MEDIUM) [Target Metric]

### 🔧 Integration & Finalization
- [ ] Integrate all optimizations with existing hook factory (Priority: HIGH) [6 hours]
- [ ] Update all components to use optimization patterns (Priority: HIGH) [8 hours]
- [ ] Create optimization best practices documentation (Priority: MEDIUM) [3 hours]
- [ ] Build performance testing suite for regression prevention (Priority: MEDIUM) [5 hours]
- [ ] Conduct comprehensive performance audit and tuning (Priority: HIGH) [4 hours]

**Total Estimated Hours: 137 hours**
**Target Completion: 3-4 week sprint**

---

## Dependencies
- **REQUIRES**: 07-frontend-hook-factory.md (Builds on hook patterns)
- **BLOCKS**: None (Final optimization layer)
- **PARALLEL WITH**: Late-stage backend work

## Overview
Implement advanced frontend optimizations including intelligent prefetching, cross-tab synchronization, and request deduplication. Eliminates 14,000+ lines of performance-related code while improving user experience by 10x.

## Current Problems

```typescript
// PROBLEM 1: No prefetching
// User clicks, then waits for data

// PROBLEM 2: Duplicate requests
// Same data fetched multiple times

// PROBLEM 3: No cross-tab sync
// Changes in one tab don't reflect in others

// PROBLEM 4: Poor cache management
// Stale data or unnecessary refetches
```

## Target Implementation

### 1. Intelligent Prefetching

```typescript
// packages/client/src/optimization/prefetch-manager.ts
export class PrefetchManager {
  private observer: IntersectionObserver;
  private prefetchQueue = new Set<() => Promise<void>>();

  constructor() {
    // Prefetch on hover
    document.addEventListener('mouseover', this.handleHover);
    
    // Prefetch on viewport intersection
    this.observer = new IntersectionObserver(
      this.handleIntersection,
      { rootMargin: '50px' }
    );
  }

  // Prefetch when element is hovered
  private handleHover = (e: MouseEvent) => {
    const element = (e.target as HTMLElement).closest('[data-prefetch]');
    if (!element) return;

    const prefetchKey = element.getAttribute('data-prefetch');
    if (!prefetchKey) return;

    this.prefetch(prefetchKey);
  };

  // Prefetch when element enters viewport
  private handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const prefetchKey = entry.target.getAttribute('data-prefetch');
        if (prefetchKey) {
          this.prefetch(prefetchKey);
          this.observer.unobserve(entry.target);
        }
      }
    });
  };

  private async prefetch(key: string) {
    const [entity, id] = key.split(':');
    
    switch (entity) {
      case 'ticket':
        await queryClient.prefetchQuery({
          queryKey: ['tickets', 'detail', id],
          queryFn: () => apiClient.tickets.getById(Number(id)),
        });
        break;
      // ... other entities
    }
  }

  observe(element: HTMLElement) {
    this.observer.observe(element);
  }
}

// Usage in components
<Link 
  to={`/tickets/${ticket.id}`}
  data-prefetch={`ticket:${ticket.id}`}
>
  {ticket.title}
</Link>
```

### 2. Cross-Tab Synchronization

```typescript
// packages/client/src/optimization/cross-tab-sync.ts
export class CrossTabSync {
  private channel: BroadcastChannel;
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.channel = new BroadcastChannel('promptliano-sync');
    
    this.channel.addEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;

    switch (type) {
      case 'INVALIDATE':
        this.queryClient.invalidateQueries(payload.queryKey);
        break;
        
      case 'UPDATE':
        this.queryClient.setQueryData(
          payload.queryKey,
          payload.data
        );
        break;
        
      case 'OPTIMISTIC_UPDATE':
        this.applyOptimisticUpdate(payload);
        break;
    }
  };

  broadcast(type: string, payload: any) {
    this.channel.postMessage({ type, payload });
  }

  // Sync mutations across tabs
  syncMutation(queryKey: QueryKey, data: any) {
    this.broadcast('UPDATE', { queryKey, data });
  }

  // Sync invalidations
  syncInvalidation(queryKey: QueryKey) {
    this.broadcast('INVALIDATE', { queryKey });
  }
}

// Hook integration
export function useCrossTabSync() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const sync = new CrossTabSync(queryClient);
    
    // Sync all mutations
    queryClient.getMutationCache().subscribe((mutation) => {
      if (mutation.state.status === 'success') {
        sync.syncInvalidation(mutation.options.mutationKey);
      }
    });
    
    return () => sync.dispose();
  }, []);
}
```

### 3. Request Deduplication

```typescript
// packages/client/src/optimization/request-deduplicator.ts
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // If request is already in flight, return existing promise
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // Start new request
    const promise = fetcher().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// Integrate with API client
const deduplicator = new RequestDeduplicator();

export const optimizedApiClient = new Proxy(apiClient, {
  get(target, prop) {
    const original = target[prop];
    
    if (typeof original === 'function') {
      return (...args: any[]) => {
        const key = `${prop}:${JSON.stringify(args)}`;
        return deduplicator.dedupe(key, () => original(...args));
      };
    }
    
    return original;
  },
});
```

### 4. Smart Cache Management

```typescript
// packages/client/src/optimization/cache-manager.ts
export class SmartCacheManager {
  constructor(private queryClient: QueryClient) {
    this.setupGarbageCollection();
    this.setupSmartInvalidation();
  }

  // Garbage collect unused data
  private setupGarbageCollection() {
    setInterval(() => {
      const cache = this.queryClient.getQueryCache();
      const queries = cache.getAll();

      queries.forEach(query => {
        const { queryKey, state } = query;
        
        // Remove old, unused data
        if (
          state.dataUpdatedAt < Date.now() - 30 * 60 * 1000 && // 30 mins old
          state.fetchStatus === 'idle' &&
          !query.getObserversCount()
        ) {
          cache.remove(query);
        }
      });
    }, 60000); // Every minute
  }

  // Smart invalidation based on relationships
  private setupSmartInvalidation() {
    this.queryClient.setMutationDefaults(['createTicket'], {
      onSuccess: () => {
        // Invalidate related queries
        this.queryClient.invalidateQueries(['tickets']);
        this.queryClient.invalidateQueries(['projects', 'stats']);
      },
    });
  }

  // Optimistic garbage collection
  clearStaleOptimisticUpdates() {
    const cache = this.queryClient.getQueryCache();
    
    cache.getAll().forEach(query => {
      if (query.state.data?._optimistic) {
        const age = Date.now() - query.state.dataUpdatedAt;
        
        if (age > 5000) { // 5 seconds
          this.queryClient.invalidateQueries(query.queryKey);
        }
      }
    });
  }
}
```

### 5. Performance Monitoring

```typescript
// packages/client/src/optimization/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();

  trackQuery(queryKey: QueryKey, duration: number) {
    const key = JSON.stringify(queryKey);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
      });
    }

    const metric = this.metrics.get(key)!;
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;

    // Alert on slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected: ${key} took ${duration}ms`);
    }
  }

  getSlowQueries(threshold = 500): QueryKey[] {
    return Array.from(this.metrics.entries())
      .filter(([_, metric]) => metric.avgDuration > threshold)
      .map(([key]) => JSON.parse(key));
  }

  optimizeSlow() {
    const slowQueries = this.getSlowQueries();
    
    slowQueries.forEach(queryKey => {
      // Increase stale time for slow queries
      this.queryClient.setQueryDefaults(queryKey, {
        staleTime: 10 * 60 * 1000, // 10 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
      });
    });
  }
}
```

## Migration Strategy

### Phase 1: Core Optimizations (Day 1-3)
1. Implement prefetch manager
2. Set up cross-tab sync
3. Add request deduplication
4. Configure smart cache

### Phase 2: Integration (Day 4-5)
1. Integrate with hook factory
2. Add to all components
3. Configure monitoring

### Phase 3: Fine-tuning (Day 6-7)
1. Analyze performance metrics
2. Optimize slow queries
3. Adjust cache strategies

## Success Metrics

- ✅ 14,000+ lines of optimization code eliminated
- ✅ 90% reduction in duplicate requests
- ✅ 100% of navigation is instant (prefetched)
- ✅ Cross-tab sync working perfectly
- ✅ 50% reduction in API calls
- ✅ 10x improvement in perceived performance

## Definition of Done

- [ ] Prefetch manager implemented
- [ ] Cross-tab sync working
- [ ] Request deduplication active
- [ ] Smart cache configured
- [ ] Performance monitoring enabled
- [ ] All components optimized
- [ ] Metrics dashboard created