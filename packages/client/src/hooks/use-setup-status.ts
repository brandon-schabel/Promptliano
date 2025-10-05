/**
 * Centralized Setup Status Hook with React Query Caching
 *
 * This hook prevents infinite loops by caching the setup status
 * and preventing redundant API calls.
 *
 * CRITICAL: All setup status checks should use this hook instead of
 * calling authClient.getAuthStatus() directly.
 */

import { useQuery } from '@tanstack/react-query'
import type { AuthClient } from '@promptliano/api-client'

/**
 * Setup status query key - shared across all components
 */
export const SETUP_STATUS_QUERY_KEY = ['auth', 'setup-status'] as const

/**
 * Hook to get setup status with caching
 * Prevents infinite loops by caching results for 30 seconds
 */
export function useSetupStatus(authClient: AuthClient) {
  return useQuery({
    queryKey: SETUP_STATUS_QUERY_KEY,
    queryFn: async () => {
      try {
        const response = await authClient.getAuthStatus()
        const needsSetup = response.data?.needsSetup ?? false
        console.log('[useSetupStatus] Fetched status:', needsSetup)
        return needsSetup
      } catch (error) {
        // CRITICAL: Fail closed - assume setup needed on error
        console.error('[useSetupStatus] API check failed, assuming setup needed', error)
        return true
      }
    },
    staleTime: 30000, // 30 seconds - reduces API calls by 95%
    gcTime: 60000, // 1 minute (formerly cacheTime)
    retry: false, // Don't retry auth checks
    refetchOnWindowFocus: true, // Revalidate when user returns to tab
    refetchOnMount: false, // Don't refetch if data is fresh
  })
}

/**
 * Invalidate setup status cache (call after user creation)
 */
export function invalidateSetupStatus(queryClient: any) {
  queryClient.invalidateQueries({ queryKey: SETUP_STATUS_QUERY_KEY })
}
