/**
 * Hook Factory System
 * 
 * Main export point for the hook factory system.
 * Separate package to avoid circular dependencies.
 */

export {
  createCrudHooks,
  type CrudHookConfig,
  type CrudApiClient,
  type QueryKeyFactory,
  type EntityMessages,
  type OptimisticConfig,
  type PrefetchConfig,
  type InvalidationStrategy,
  type PaginatedResponse,
  type PaginationParams,
  type EntityIdentifiable,
  type StringEntityIdentifiable,
  type Timestamped,
  type PollingConfig,
  type PollingStrategy,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseInfiniteQueryOptions
} from './crud-hook-factory'