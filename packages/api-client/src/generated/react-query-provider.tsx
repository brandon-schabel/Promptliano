/**
 * AUTO-GENERATED REACT QUERY PROVIDER
 * Generated at: 2025-08-22T23:54:01.428Z
 *
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Create a client with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000 // 10 minutes (was cacheTime)
    },
    mutations: {
      retry: 1
    }
  }
})

interface ApiProviderProps {
  children: React.ReactNode
  baseUrl?: string
  enableDevtools?: boolean
}

/**
 * Provider component that sets up React Query and the API client
 */
export function ApiProvider({
  children,
  baseUrl,
  enableDevtools = process.env.NODE_ENV === 'development'
}: ApiProviderProps) {
  // Note: API client initialization would be handled by the consumer
  // of this library by creating their own instance of ApiClient

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {enableDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

/**
 * Hook to get the query client instance
 */
export function useApiQueryClient() {
  return queryClient
}
