/**
 * Advanced Provider Hook Factory
 * 
 * Demonstrates sophisticated TypeScript patterns for type-safe provider management:
 * - Generic constraints with conditional types
 * - Template literal type inference
 * - Discriminated unions for exhaustive checking
 * - Branded types for domain safety
 * - Advanced type guards with validation
 */

import { useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { APIProviders } from '@promptliano/database'
import { 
  createProviderInstance,
  getProviderType,
  type ProviderConfig,
  type ProviderCapabilities,
  type ModelNamePattern,
  type InferProviderFromModel,
  type ProviderHookConfig,
  type ModelSelectionHookConstraints
} from '@/utils/provider-type-system'
import {
  validateModelsArray,
  type ValidatedModelData,
  extractErrorMessage,
  type ValidationResult
} from '@/utils/type-guards'

// ============================================================================
// Advanced Hook Factory Interface
// ============================================================================

/**
 * Provider hook factory return type with conditional methods
 */
export interface ProviderHookFactory<T extends APIProviders> {
  // Basic provider management
  useProviderConfig: () => {
    config: ProviderConfig<T> | null
    capabilities: ProviderCapabilities<T>
    type: ReturnType<typeof getProviderType>
  }
  
  // Model management with type constraints
  useProviderModels: (options?: { 
    enabled?: boolean
    staleTime?: number
  }) => {
    models: ModelNamePattern<T>[]
    isLoading: boolean
    error: Error | null
    refetch: () => void
    validateModel: (model: string) => model is ModelNamePattern<T>
  }
  
  // Type-safe model selection
  useModelSelection: (defaultModel?: ModelNamePattern<T>) => ModelSelectionHookConstraints<T>
  
  // Provider-specific validation
  useProviderValidation: () => {
    validateApiKey: (key: string) => Promise<ValidationResult<boolean>>
    validateConfig: (config: Partial<ProviderConfig<T>>) => ValidationResult<ProviderConfig<T>>
    testConnection: () => Promise<ValidationResult<boolean>>
  }
  
  // Advanced inference capabilities  
  useModelInference: () => {
    inferProviderFromModel: <M extends string>(model: M) => InferProviderFromModel<M>
    suggestModels: (query: string) => ModelNamePattern<T>[]
    getModelRecommendations: (usage: 'chat' | 'completion' | 'vision' | 'function') => ModelNamePattern<T>[]
  }
}

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Creates a type-safe provider hook factory
 */
export function createProviderHookFactory<T extends APIProviders>(
  provider: T,
  config: ProviderConfig<T>
): ProviderHookFactory<T> {
  
  // Create provider instance with advanced typing
  const providerInstance = createProviderInstance(provider, config)
  
  return {
    useProviderConfig: () => {
      return useMemo(() => ({
        config,
        capabilities: providerInstance.capabilities,
        type: providerInstance.type
      }), [])
    },
    
    useProviderModels: (options = {}) => {
      const { enabled = true, staleTime = 5 * 60 * 1000 } = options
      
      const query = useQuery({
        queryKey: ['provider-models', provider],
        queryFn: async (): Promise<ModelNamePattern<T>[]> => {
          // Implementation would call actual API
          // For now, return empty array with proper typing
          return [] as ModelNamePattern<T>[]
        },
        enabled,
        staleTime
      })
      
      return {
        models: query.data || [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
        validateModel: providerInstance.validateModel
      }
    },
    
    useModelSelection: (defaultModel) => {
      const { models } = createProviderHookFactory(provider, config).useProviderModels()
      
      const [selectedModel, setSelectedModel] = useState<ModelNamePattern<T> | null>(
        defaultModel || null
      )
      
      return useMemo((): ModelSelectionHookConstraints<T> => ({
        provider,
        availableModels: models,
        selectedModel,
        setModel: (model: ModelNamePattern<T>) => {
          if (providerInstance.validateModel(model)) {
            setSelectedModel(model)
          } else {
            throw new TypeError(`Invalid model "${model}" for provider "${provider}"`)
          }
        },
        validateModel: providerInstance.validateModel
      }), [models, selectedModel])
    },
    
    useProviderValidation: () => {
      return useMemo(() => ({
        validateApiKey: async (key: string): Promise<ValidationResult<boolean>> => {
          try {
            // Implementation would validate API key
            if (!key || key.length === 0) {
              return { success: false, error: 'API key is required' }
            }
            
            // Provider-specific validation
            switch (provider) {
              case 'openai':
                if (!key.startsWith('sk-')) {
                  return { success: false, error: 'OpenAI API key must start with "sk-"' }
                }
                break
                
              case 'anthropic':
                if (!key.startsWith('sk-ant-')) {
                  return { success: false, error: 'Anthropic API key must start with "sk-ant-"' }
                }
                break
                
              case 'google_gemini':
                if (key.length < 20) {
                  return { success: false, error: 'Google API key appears to be too short' }
                }
                break
            }
            
            return { success: true, data: true }
          } catch (error) {
            return { 
              success: false, 
              error: extractErrorMessage(error)
            }
          }
        },
        
        validateConfig: (partialConfig: Partial<ProviderConfig<T>>): ValidationResult<ProviderConfig<T>> => {
          try {
            // Merge with defaults and validate
            const fullConfig = { ...config, ...partialConfig } as ProviderConfig<T>
            
            // Provider-specific validation
            const providerType = getProviderType(provider)
            
            if (providerType.requiresKey && !('apiKey' in fullConfig)) {
              return { success: false, error: 'API key is required for this provider' }
            }
            
            return { success: true, data: fullConfig }
          } catch (error) {
            return {
              success: false,
              error: extractErrorMessage(error)
            }
          }
        },
        
        testConnection: async (): Promise<ValidationResult<boolean>> => {
          try {
            // Implementation would test actual connection
            // For now, simulate validation
            return { success: true, data: true }
          } catch (error) {
            return {
              success: false,
              error: extractErrorMessage(error)
            }
          }
        }
      }), [])
    },
    
    useModelInference: () => {
      return useMemo(() => ({
        inferProviderFromModel: providerInstance.inferProvider,
        
        suggestModels: (query: string): ModelNamePattern<T>[] => {
          // Implementation would suggest models based on query
          // For now, return empty array with proper typing
          return [] as ModelNamePattern<T>[]
        },
        
        getModelRecommendations: (usage: 'chat' | 'completion' | 'vision' | 'function'): ModelNamePattern<T>[] => {
          // Provider-specific recommendations based on capabilities
          const capabilities = providerInstance.capabilities
          
          const recommendations: ModelNamePattern<T>[] = []
          
          // This would contain actual logic for recommendations
          // Based on provider capabilities and usage type
          
          return recommendations
        }
      }), [])
    }
  }
}

// ============================================================================
// Utility Hooks for Multiple Providers
// ============================================================================

/**
 * Hook for managing multiple providers with type safety
 */
export function useProviderManager<T extends readonly APIProviders[]>(
  providers: T
): {
  [K in T[number]]: ProviderHookFactory<K>
} {
  return useMemo(() => {
    const factories = {} as { [K in T[number]]: ProviderHookFactory<K> }
    
    for (const provider of providers) {
      // This would need actual config loading logic
      const config = {} as ProviderConfig<typeof provider>
      factories[provider] = createProviderHookFactory(provider, config)
    }
    
    return factories
  }, [providers])
}

/**
 * Advanced hook for cross-provider model comparison
 */
export function useModelComparison<T extends APIProviders[]>(
  providers: T,
  criteria: {
    contextLength?: number
    supportsFunctionCalling?: boolean
    supportsVision?: boolean
    supportsStreaming?: boolean
  }
) {
  const providerFactories = useProviderManager(providers)
  
  return useMemo(() => {
    const comparisons: Array<{
      provider: T[number]
      capabilities: ProviderCapabilities<T[number]>
      score: number
      models: ModelNamePattern<T[number]>[]
    }> = []
    
    for (const provider of providers) {
      const factory = providerFactories[provider]
      const { capabilities } = factory.useProviderConfig()
      const { models } = factory.useProviderModels()
      
      // Calculate compatibility score based on criteria
      let score = 0
      
      if (criteria.contextLength && capabilities.maxContextLength >= criteria.contextLength) {
        score += 10
      }
      
      if (criteria.supportsFunctionCalling && capabilities.supportsFunctionCalling) {
        score += 8
      }
      
      if (criteria.supportsVision && capabilities.supportsVision) {
        score += 6
      }
      
      if (criteria.supportsStreaming && capabilities.supportsStreaming) {
        score += 4
      }
      
      comparisons.push({
        provider,
        capabilities,
        score,
        models
      })
    }
    
    // Sort by compatibility score
    return comparisons.sort((a, b) => b.score - a.score)
  }, [providers, criteria, providerFactories])
}

// ============================================================================
// Type-safe Provider Registry
// ============================================================================

/**
 * Registry for managing provider instances with type safety
 */
class TypeSafeProviderRegistry {
  private providers = new Map<APIProviders, ProviderHookFactory<APIProviders>>()
  
  register<T extends APIProviders>(
    provider: T, 
    config: ProviderConfig<T>
  ): ProviderHookFactory<T> {
    const factory = createProviderHookFactory(provider, config)
    this.providers.set(provider, factory as ProviderHookFactory<APIProviders>)
    return factory
  }
  
  get<T extends APIProviders>(
    provider: T
  ): ProviderHookFactory<T> | undefined {
    return this.providers.get(provider) as ProviderHookFactory<T> | undefined
  }
  
  getAll(): Map<APIProviders, ProviderHookFactory<APIProviders>> {
    return new Map(this.providers)
  }
  
  has(provider: APIProviders): boolean {
    return this.providers.has(provider)
  }
  
  remove(provider: APIProviders): boolean {
    return this.providers.delete(provider)
  }
  
  clear(): void {
    this.providers.clear()
  }
}

export const providerRegistry = new TypeSafeProviderRegistry()

// Missing import for useState
import { useState } from 'react'