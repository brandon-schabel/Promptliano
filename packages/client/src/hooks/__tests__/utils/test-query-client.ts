/**
 * Test Query Client Setup
 * Creates configured QueryClient instances for testing
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { QueryClientConfig } from '@tanstack/react-query'

export interface TestQueryClientOptions extends Partial<QueryClientConfig> {
  enableLogging?: boolean
  enableRetries?: boolean
  defaultStaleTime?: number
  defaultCacheTime?: number
}

export function createTestQueryClient(options: TestQueryClientOptions = {}): QueryClient {
  const {
    enableLogging = false,
    enableRetries = false,
    defaultStaleTime = 0, // No stale time for predictable tests
    defaultCacheTime = 1000 * 60 * 5, // 5 minutes
    ...queryClientConfig
  } = options

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: enableRetries ? 3 : false,
        retryDelay: 0,
        staleTime: defaultStaleTime,
        gcTime: defaultCacheTime,
        // Disable network error retries for tests
        networkMode: 'online',
        ...queryClientConfig.defaultOptions?.queries
      },
      mutations: {
        retry: enableRetries ? 3 : false,
        retryDelay: 0,
        networkMode: 'online',
        ...queryClientConfig.defaultOptions?.mutations
      }
    },
    logger: enableLogging ? undefined : {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    ...queryClientConfig
  })
}