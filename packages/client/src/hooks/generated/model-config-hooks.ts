/**
 * Model Configuration Hooks - Factory Pattern Implementation
 * Provides comprehensive hooks for model configuration management
 */

import { useApiClient } from '../api/use-api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ModelConfig, CreateModelConfig, UpdateModelConfig } from '@promptliano/database'
import type { ModelPreset, CreateModelPreset, UpdateModelPreset } from '@promptliano/database'

// ============================================================================
// Query Keys
// ============================================================================

export const MODEL_CONFIG_KEYS = {
  all: ['model-configs'] as const,
  lists: () => [...MODEL_CONFIG_KEYS.all, 'list'] as const,
  list: () => [...MODEL_CONFIG_KEYS.lists()] as const,
  details: () => [...MODEL_CONFIG_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...MODEL_CONFIG_KEYS.details(), id] as const,
  defaultForProvider: (provider: string) => [...MODEL_CONFIG_KEYS.all, 'default', provider] as const,
  presets: (configId: number) => [...MODEL_CONFIG_KEYS.all, configId, 'presets'] as const,
  preset: (configId: number, presetId: number) => [...MODEL_CONFIG_KEYS.all, configId, 'presets', presetId] as const,
  export: () => [...MODEL_CONFIG_KEYS.all, 'export'] as const
}

// ============================================================================
// Model Configuration Hooks
// ============================================================================

/**
 * Hook to fetch all model configurations
 */
export function useModelConfigs() {
  const client = useApiClient()

  return useQuery({
    queryKey: MODEL_CONFIG_KEYS.list(),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.list()
    },
    enabled: !!client,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

/**
 * Hook to fetch a specific model configuration
 */
export function useModelConfig(id: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: MODEL_CONFIG_KEYS.detail(id),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.getById(id)
    },
    enabled: !!client && id > 0,
    staleTime: 5 * 60 * 1000
  })
}

/**
 * Hook to fetch default configuration for a provider
 */
export function useDefaultModelConfig(provider: string) {
  const client = useApiClient()

  return useQuery({
    queryKey: MODEL_CONFIG_KEYS.defaultForProvider(provider),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.getDefaultForProvider(provider)
    },
    enabled: !!client && !!provider,
    staleTime: 5 * 60 * 1000
  })
}

/**
 * Hook to create a new model configuration
 */
export function useCreateModelConfig() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateModelConfig) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.all })
      toast.success('Model configuration created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create model configuration')
    }
  })
}

/**
 * Hook to update a model configuration
 */
export function useUpdateModelConfig() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateModelConfig }) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.update(id, data)
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.detail(id) })
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.lists() })
      toast.success('Model configuration updated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update model configuration')
    }
  })
}

/**
 * Hook to delete a model configuration
 */
export function useDeleteModelConfig() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.all })
      toast.success('Model configuration deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete model configuration')
    }
  })
}

// ============================================================================
// Model Preset Hooks
// ============================================================================

/**
 * Hook to fetch presets for a model configuration
 */
export function useModelPresets(configId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: MODEL_CONFIG_KEYS.presets(configId),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.getModelPresets(configId)
    },
    enabled: !!client && configId > 0,
    staleTime: 5 * 60 * 1000
  })
}

/**
 * Hook to create a new preset
 */
export function useCreateModelPreset(configId: number) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateModelPreset) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.createPreset(configId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.presets(configId) })
      toast.success('Preset created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create preset')
    }
  })
}

/**
 * Hook to update a preset
 */
export function useUpdateModelPreset(configId: number) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ presetId, data }: { presetId: number; data: UpdateModelPreset }) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.updatePreset(configId, presetId, data)
    },
    onSuccess: (_, { presetId }) => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.preset(configId, presetId) })
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.presets(configId) })
      toast.success('Preset updated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update preset')
    }
  })
}

/**
 * Hook to delete a preset
 */
export function useDeleteModelPreset(configId: number) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (presetId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.deletePreset(configId, presetId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.presets(configId) })
      toast.success('Preset deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete preset')
    }
  })
}

/**
 * Hook to apply a preset to a model configuration
 */
export function useApplyModelPreset() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ configId, presetId }: { configId: number; presetId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.applyPreset(configId, presetId)
    },
    onSuccess: (_, { configId }) => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.detail(configId) })
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.lists() })
      toast.success('Preset applied successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to apply preset')
    }
  })
}

// ============================================================================
// Import/Export Hooks
// ============================================================================

/**
 * Hook to export all configurations
 */
export function useExportModelConfigs() {
  const client = useApiClient()

  return useQuery({
    queryKey: MODEL_CONFIG_KEYS.export(),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.exportConfigs()
    },
    enabled: false, // Manual trigger only
    staleTime: 0 // Always fresh
  })
}

/**
 * Hook to import configurations
 */
export function useImportModelConfigs() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => {
      if (!client) throw new Error('API client not initialized')
      return client.modelConfigs.importConfigs(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.all })
      toast.success('Configurations imported successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to import configurations')
    }
  })
}

// ============================================================================
// Invalidation Utilities
// ============================================================================

/**
 * Hook to invalidate model configuration queries
 */
export function useInvalidateModelConfigs() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.all })
    },
    invalidateList: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.lists() })
    },
    invalidateDetail: (id: number) => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.detail(id) })
    },
    invalidatePresets: (configId: number) => {
      queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_KEYS.presets(configId) })
    }
  }
}
