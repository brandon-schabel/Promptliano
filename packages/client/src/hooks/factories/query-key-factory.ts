/**
 * Query Key Factory - Hierarchical key generation for optimal caching
 * 
 * This factory creates consistent, hierarchical query keys that enable:
 * - Granular cache invalidation
 * - Efficient cache updates
 * - Predictable key structures
 * - Type-safe key generation
 */

export interface QueryKeyFactory {
  all: readonly unknown[]
  lists: () => readonly unknown[]
  list: (params?: any) => readonly unknown[]
  detail: (id: number | string) => readonly unknown[]
  details: () => readonly unknown[]
  search: (query: string) => readonly unknown[]
  searches: () => readonly unknown[]
  infinite: (params?: any) => readonly unknown[]
  infinites: () => readonly unknown[]
  count: () => readonly unknown[]
  stats: () => readonly unknown[]
  metadata: () => readonly unknown[]
  related: (id: number | string, relation: string) => readonly unknown[]
  byField: (field: string, value: any) => readonly unknown[]
}

/**
 * Create hierarchical query keys for a domain
 * 
 * @param domain - The domain name (e.g., 'projects', 'tickets')
 * @returns QueryKeyFactory with all standard key patterns
 * 
 * @example
 * const PROJECT_KEYS = createQueryKeys('projects')
 * // Usage:
 * queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
 * queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(123) })
 */
export function createQueryKeys(domain: string): QueryKeyFactory {
  return {
    // Root key for all queries in this domain
    all: [domain] as const,

    // List queries
    lists: () => [...[domain], 'list'] as const,
    list: (params?: any) => {
      if (!params || Object.keys(params).length === 0) {
        return [...[domain], 'list'] as const
      }
      return [...[domain], 'list', params] as const
    },

    // Detail queries
    details: () => [...[domain], 'detail'] as const,
    detail: (id: number | string) => [...[domain], 'detail', id] as const,

    // Search queries
    searches: () => [...[domain], 'search'] as const,
    search: (query: string) => [...[domain], 'search', query] as const,

    // Infinite queries
    infinites: () => [...[domain], 'infinite'] as const,
    infinite: (params?: any) => {
      if (!params || Object.keys(params).length === 0) {
        return [...[domain], 'infinite'] as const
      }
      return [...[domain], 'infinite', params] as const
    },

    // Aggregate queries
    count: () => [...[domain], 'count'] as const,
    stats: () => [...[domain], 'stats'] as const,
    metadata: () => [...[domain], 'metadata'] as const,

    // Related data queries
    related: (id: number | string, relation: string) => 
      [...[domain], 'detail', id, 'related', relation] as const,

    // Field-based queries
    byField: (field: string, value: any) => 
      [...[domain], 'by', field, value] as const
  }
}

/**
 * Extended query key factory with additional patterns
 */
export interface ExtendedQueryKeyFactory extends QueryKeyFactory {
  table: (tableState?: any) => readonly unknown[]
  export: (format?: string) => readonly unknown[]
  import: (format?: string) => readonly unknown[]
  batch: (operation: string) => readonly unknown[]
  realtime: () => readonly unknown[]
  subscription: (channel?: string) => readonly unknown[]
  cache: () => readonly unknown[]
}

/**
 * Create extended query keys with additional patterns
 */
export function createExtendedQueryKeys(domain: string): ExtendedQueryKeyFactory {
  const baseKeys = createQueryKeys(domain)
  
  return {
    ...baseKeys,
    
    // Table-specific queries
    table: (tableState?: any) => {
      if (!tableState) {
        return [...[domain], 'table'] as const
      }
      return [...[domain], 'table', tableState] as const
    },

    // Import/Export queries
    export: (format?: string) => 
      format 
        ? [...[domain], 'export', format] as const
        : [...[domain], 'export'] as const,
    import: (format?: string) => 
      format 
        ? [...[domain], 'import', format] as const
        : [...[domain], 'import'] as const,

    // Batch operation queries
    batch: (operation: string) => [...[domain], 'batch', operation] as const,

    // Real-time queries
    realtime: () => [...[domain], 'realtime'] as const,
    subscription: (channel?: string) => 
      channel 
        ? [...[domain], 'subscription', channel] as const
        : [...[domain], 'subscription'] as const,

    // Cache management
    cache: () => [...[domain], 'cache'] as const
  }
}

/**
 * Composite query key factory for cross-domain queries
 */
export interface CompositeQueryKeyFactory {
  between: (domain1: string, id1: number | string, domain2: string) => readonly unknown[]
  intersection: (domains: string[]) => readonly unknown[]
  union: (domains: string[]) => readonly unknown[]
  aggregate: (domains: string[], metric: string) => readonly unknown[]
}

/**
 * Create composite query keys for cross-domain operations
 */
export function createCompositeQueryKeys(): CompositeQueryKeyFactory {
  return {
    // Relationship between two domains
    between: (domain1: string, id1: number | string, domain2: string) => 
      ['composite', domain1, id1, domain2] as const,

    // Intersection of multiple domains
    intersection: (domains: string[]) => 
      ['composite', 'intersection', ...domains] as const,

    // Union of multiple domains
    union: (domains: string[]) => 
      ['composite', 'union', ...domains] as const,

    // Aggregate across domains
    aggregate: (domains: string[], metric: string) => 
      ['composite', 'aggregate', metric, ...domains] as const
  }
}

/**
 * Stale time constants for different data volatility levels
 */
export const STALE_TIMES = {
  // Real-time data that changes frequently
  REALTIME: 0, // Always fresh
  
  // Highly volatile data (messages, notifications)
  VOLATILE: 30 * 1000, // 30 seconds
  
  // Semi-volatile data (tickets, tasks)
  SEMI_VOLATILE: 1 * 60 * 1000, // 1 minute
  
  // Semi-stable data (projects, users)
  SEMI_STABLE: 5 * 60 * 1000, // 5 minutes
  
  // Stable data (settings, configurations)
  STABLE: 10 * 60 * 1000, // 10 minutes
  
  // Static data (metadata, schemas)
  STATIC: 60 * 60 * 1000, // 1 hour
  
  // Permanent data (constants, enums)
  PERMANENT: 24 * 60 * 60 * 1000 // 24 hours
} as const

/**
 * Garbage collection time constants
 */
export const GC_TIMES = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  EXTENDED: 60 * 60 * 1000, // 1 hour
  PERMANENT: Infinity // Never garbage collect
} as const

/**
 * Helper to determine stale time based on domain
 */
export function getStaleTimeForDomain(domain: string): number {
  const staleTimeMap: Record<string, number> = {
    // Real-time domains
    'messages': STALE_TIMES.REALTIME,
    'notifications': STALE_TIMES.REALTIME,
    'presence': STALE_TIMES.REALTIME,
    
    // Volatile domains
    'chat': STALE_TIMES.VOLATILE,
    'activities': STALE_TIMES.VOLATILE,
    'logs': STALE_TIMES.VOLATILE,
    
    // Semi-volatile domains
    'tickets': STALE_TIMES.SEMI_VOLATILE,
    'tasks': STALE_TIMES.SEMI_VOLATILE,
    'comments': STALE_TIMES.SEMI_VOLATILE,
    
    // Semi-stable domains
    'projects': STALE_TIMES.SEMI_STABLE,
    'users': STALE_TIMES.SEMI_STABLE,
    'teams': STALE_TIMES.SEMI_STABLE,
    
    // Stable domains
    'settings': STALE_TIMES.STABLE,
    'preferences': STALE_TIMES.STABLE,
    'configurations': STALE_TIMES.STABLE,
    
    // Static domains
    'schemas': STALE_TIMES.STATIC,
    'metadata': STALE_TIMES.STATIC,
    'permissions': STALE_TIMES.STATIC
  }
  
  return staleTimeMap[domain] || STALE_TIMES.SEMI_STABLE
}

/**
 * Type-safe query key builder with compile-time validation
 */
export class QueryKeyBuilder<T extends string> {
  private segments: unknown[] = []

  constructor(private domain: T) {
    this.segments = [domain]
  }

  add(...segments: unknown[]): this {
    this.segments.push(...segments)
    return this
  }

  build(): readonly unknown[] {
    return Object.freeze([...this.segments])
  }

  toString(): string {
    return JSON.stringify(this.segments)
  }
}

/**
 * Create a type-safe query key builder
 */
export function buildQueryKey<T extends string>(domain: T): QueryKeyBuilder<T> {
  return new QueryKeyBuilder(domain)
}