/**
 * Generated Providers Hooks - Factory Pattern Implementation
 * Migrated from use-providers-api.ts with factory-based patterns
 * 
 * Replaces 277 lines of manual provider hook code with factory-based patterns
 * Maintains all validation, health checks, and testing functionality
 */

import { useApiClient } from '../api/use-api-client'
import { createCrudHooks } from '../factories/crud-hook-factory'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  CreateProviderKeyBody,
  UpdateProviderKeyBody,
  ProviderKey,
  TestProviderRequest,
  TestProviderResponse,
  BatchTestProviderRequest,
  BatchTestProviderResponse,
  ProviderHealthStatus
} from '@promptliano/schemas'
import type { DataResponseSchema } from '@promptliano/api-client'

// ============================================================================
// Query Keys (enhanced from original)
// ============================================================================

export const PROVIDERS_ENHANCED_KEYS = {
  all: ['providers'] as const,
  lists: () => [...PROVIDERS_ENHANCED_KEYS.all, 'list'] as const,
  list: () => [...PROVIDERS_ENHANCED_KEYS.lists()] as const,
  details: () => [...PROVIDERS_ENHANCED_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...PROVIDERS_ENHANCED_KEYS.details(), id] as const,
  health: () => [...PROVIDERS_ENHANCED_KEYS.all, 'health'] as const,
  test: () => [...PROVIDERS_ENHANCED_KEYS.all, 'test'] as const
}

// ============================================================================
// Factory Configuration
// ============================================================================

const PROVIDERS_CONFIG = {
  entityName: 'ProviderKey',
  queryKeys: PROVIDERS_ENHANCED_KEYS,
  apiClient: {
    list: () => {
      const client = useApiClient()
      if (!client) throw new Error('API client not initialized')
      return client.keys.listKeys().then(r => r.data)
    },
    getById: (_, id: number) => {
      const client = useApiClient()
      if (!client) throw new Error('API client not initialized')
      return client.keys.getKey(id).then(r => r.data)
    },
    create: (_, data: CreateProviderKeyBody) => {
      const client = useApiClient()
      if (!client) throw new Error('API client not initialized')
      return client.keys.createKey(data).then(r => r.data)
    },
    update: (_, id: number, data: UpdateProviderKeyBody) => {
      const client = useApiClient()
      if (!client) throw new Error('API client not initialized')
      return client.keys.updateKey(id, data).then(r => r.data)
    },
    delete: (_, id: number) => {
      const client = useApiClient()
      if (!client) throw new Error('API client not initialized')
      return client.keys.deleteKey(id).then(() => undefined)
    }
  },
  staleTime: 5 * 60 * 1000, // 5 minutes preserved from original
  messages: {
    createSuccess: 'Provider key created successfully',
    createError: (error: any) => error?.message || 'Failed to create provider key',
    updateSuccess: 'Provider key updated successfully',
    updateError: (error: any) => error?.message || 'Failed to update provider key',
    deleteSuccess: 'Provider key deleted successfully',
    deleteError: (error: any) => error?.message || 'Failed to delete provider key'
  },
  invalidation: {
    onCreate: 'all' as const,
    onUpdate: 'all' as const,
    onDelete: 'all' as const
  }
}

// Create provider hooks using factory
const providerHooks = createCrudHooks<ProviderKey, CreateProviderKeyBody, UpdateProviderKeyBody>(PROVIDERS_CONFIG)

// ============================================================================
// Export Core CRUD Hooks (from factory)
// ============================================================================

export const useGetProviderKeys = providerHooks.useList
export const useGetProviderKey = providerHooks.useGetById
export const useCreateProviderKey = providerHooks.useCreate
export const useUpdateProviderKey = providerHooks.useUpdate
export const useDeleteProviderKey = providerHooks.useDelete

// ============================================================================
// Specialized Provider Query Hooks
// ============================================================================

/**
 * Get providers health status
 */
export function useGetProvidersHealth(refresh = false) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROVIDERS_ENHANCED_KEYS.health(),
    queryFn: async (): Promise<DataResponseSchema<ProviderHealthStatus[]>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.getProvidersHealth(refresh)
    },
    enabled: !!client,
    staleTime: refresh ? 0 : 2 * 60 * 1000, // 2 minutes if not refreshing (preserved)
    retry: (failureCount: number, error: Error) => {
      // Don't retry if client is null/disconnected
      if (error.message.includes('not connected')) {
        return false
      }
      return failureCount < 3
    }
  })
}

// ============================================================================
// Provider Testing Mutation Hooks
// ============================================================================

// Type guards (preserved from original)
const isValidTestProviderResponse = (response: unknown): response is DataResponseSchema<TestProviderResponse> => {
  if (typeof response !== 'object' || response === null) {
    return false
  }
  
  const responseObj = response as Record<string, unknown>
  
  return (
    'data' in responseObj &&
    typeof responseObj.data === 'object' &&
    responseObj.data !== null &&
    'success' in responseObj.data &&
    typeof (responseObj.data as Record<string, unknown>).success === 'boolean'
  )
}

const isValidBatchTestProviderResponse = (response: unknown): response is DataResponseSchema<BatchTestProviderResponse> => {
  if (typeof response !== 'object' || response === null) {
    return false
  }
  
  const responseObj = response as Record<string, unknown>
  
  return (
    'data' in responseObj &&
    typeof responseObj.data === 'object' &&
    responseObj.data !== null &&
    'results' in responseObj.data &&
    Array.isArray((responseObj.data as Record<string, unknown>).results)
  )
}

/**
 * Test single provider
 */
export function useTestProvider() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: TestProviderRequest): Promise<DataResponseSchema<TestProviderResponse>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.testProvider(data)
    },
    onSuccess: (response: DataResponseSchema<TestProviderResponse>) => {
      if (!isValidTestProviderResponse(response)) {
        toast.error('Invalid response format from provider test')
        return
      }
      
      const testData = response.data
      if (testData.success) {
        toast.success('Provider connected successfully')
        queryClient.invalidateQueries({ queryKey: PROVIDERS_ENHANCED_KEYS.health() })
      } else {
        toast.error(`Provider test failed: ${testData.error || 'Unknown error'}`)
      }
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to test provider'
      toast.error(message)
    }
  })
}

/**
 * Batch test providers
 */
export function useBatchTestProviders() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: BatchTestProviderRequest): Promise<DataResponseSchema<BatchTestProviderResponse>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.batchTestProviders(data)
    },
    onSuccess: (response: DataResponseSchema<BatchTestProviderResponse>) => {
      if (!isValidBatchTestProviderResponse(response)) {
        toast.error('Invalid response format from batch provider test')
        return
      }
      
      const testData = response.data
      const results = testData.results
      const successCount = results.filter((r: TestProviderResponse) => r.success).length
      const failCount = results.filter((r: TestProviderResponse) => !r.success).length

      if (successCount > 0 && failCount === 0) {
        toast.success(`All ${successCount} providers tested successfully`)
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} providers connected, ${failCount} failed`)
      } else {
        toast.error(`All ${failCount} provider tests failed`)
      }

      queryClient.invalidateQueries({ queryKey: PROVIDERS_ENHANCED_KEYS.health() })
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to test providers'
      toast.error(message)
    }
  })
}

// ============================================================================
// Factory-Based Invalidation Utilities
// ============================================================================

export function useInvalidateProviders() {
  return providerHooks.useInvalidate()
}

// ============================================================================
// Legacy Key Exports (for backward compatibility)
// ============================================================================

// Export as legacy name for backward compatibility
export const providerKeys = PROVIDERS_ENHANCED_KEYS

// ============================================================================
// Type Exports
// ============================================================================

export type {
  CreateProviderKeyBody,
  UpdateProviderKeyBody,
  ProviderKey,
  TestProviderRequest,
  TestProviderResponse,
  BatchTestProviderRequest,
  BatchTestProviderResponse,
  ProviderHealthStatus
}

// Export query keys for external use
export { PROVIDERS_ENHANCED_KEYS as PROVIDER_KEYS }