/**
 * Advanced TypeScript Type System for Provider Management
 * 
 * Demonstrates sophisticated TypeScript patterns including:
 * - Conditional types for provider-specific configurations
 * - Template literal types for model naming patterns
 * - Mapped types for provider capabilities
 * - Type inference with branded types
 * - Discriminated unions for exhaustive pattern matching
 */

import type { APIProviders } from '@promptliano/database'

// ============================================================================
// Template Literal Types for Model Naming Patterns
// ============================================================================

/**
 * Template literal type for model naming conventions
 */
type ModelNamePattern<T extends APIProviders> = 
  T extends 'openai' ? `gpt-${string}` | `o1-${string}` | `text-${string}` :
  T extends 'anthropic' ? `claude-${string}` :
  T extends 'google_gemini' ? `gemini-${string}` :
  T extends 'groq' ? `${string}-groq` | `mixtral-${string}` | `llama-${string}` :
  T extends 'together' ? `${string}@${string}` :
  T extends 'xai' ? `grok-${string}` :
  T extends 'openrouter' ? `${string}/${string}` :
  T extends 'ollama' | 'lmstudio' ? string :
  T extends 'custom' ? string :
  never

/**
 * Extract provider from model name using template literal inference
 */
type InferProviderFromModel<T extends string> =
  T extends `gpt-${string}` ? 'openai' :
  T extends `o1-${string}` ? 'openai' :
  T extends `text-${string}` ? 'openai' :
  T extends `claude-${string}` ? 'anthropic' :
  T extends `gemini-${string}` ? 'google_gemini' :
  T extends `${string}-groq` ? 'groq' :
  T extends `mixtral-${string}` ? 'groq' :
  T extends `llama-${string}` ? 'groq' :
  T extends `${string}@${string}` ? 'together' :
  T extends `grok-${string}` ? 'xai' :
  T extends `${string}/${string}` ? 'openrouter' :
  'custom' | 'ollama' | 'lmstudio'

// ============================================================================
// Conditional Types for Provider-Specific Configurations
// ============================================================================

/**
 * Provider-specific configuration types using conditional types
 */
type ProviderConfig<T extends APIProviders> = 
  T extends 'openai' ? {
    apiKey: string
    organization?: string
    project?: string
    baseURL?: string
  } :
  T extends 'anthropic' ? {
    apiKey: string
    baseURL?: string
  } :
  T extends 'google_gemini' ? {
    apiKey: string
    baseURL?: string
  } :
  T extends 'groq' ? {
    apiKey: string
    baseURL?: string
  } :
  T extends 'together' ? {
    apiKey: string
    baseURL?: string
  } :
  T extends 'xai' ? {
    apiKey: string
    baseURL?: string
  } :
  T extends 'openrouter' ? {
    apiKey: string
    baseURL?: string
    httpReferer?: string
    xTitle?: string
  } :
  T extends 'ollama' ? {
    baseURL: string
    timeout?: number
  } :
  T extends 'lmstudio' ? {
    baseURL: string
    timeout?: number
  } :
  T extends 'custom' ? {
    baseURL: string
    apiKey?: string
    headers?: Record<string, string>
    timeout?: number
  } :
  never

/**
 * Provider capabilities mapped type
 */
type ProviderCapabilities<T extends APIProviders> = {
  readonly supportsStreaming: T extends 'ollama' | 'lmstudio' | 'custom' ? boolean : true
  readonly supportsVision: T extends 'openai' | 'anthropic' | 'google_gemini' | 'openrouter' ? true : false
  readonly supportsFunctionCalling: T extends 'openai' | 'anthropic' | 'google_gemini' | 'groq' | 'together' | 'openrouter' ? true : false
  readonly supportsSystemPrompts: T extends 'openai' | 'anthropic' | 'google_gemini' | 'groq' | 'together' | 'xai' | 'openrouter' ? true : 
                                  T extends 'ollama' | 'lmstudio' | 'custom' ? boolean : false
  readonly maxContextLength: T extends 'openai' ? 128000 | 200000 :
                            T extends 'anthropic' ? 200000 :
                            T extends 'google_gemini' ? 1000000 | 2000000 :
                            T extends 'groq' ? 32768 | 131072 :
                            T extends 'together' ? 32768 | 200000 :
                            T extends 'xai' ? 131072 :
                            T extends 'openrouter' ? number :
                            T extends 'ollama' | 'lmstudio' | 'custom' ? number :
                            never
}

// ============================================================================
// Discriminated Union for Provider Types
// ============================================================================

/**
 * Discriminated union for exhaustive provider type checking
 */
type ProviderType = 
  | { kind: 'cloud'; provider: Exclude<APIProviders, 'ollama' | 'lmstudio' | 'custom'>; requiresKey: true }
  | { kind: 'local'; provider: 'ollama' | 'lmstudio'; requiresKey: false }
  | { kind: 'custom'; provider: 'custom'; requiresKey: boolean }

/**
 * Type guard for provider type discrimination
 */
export const getProviderType = (provider: APIProviders): ProviderType => {
  switch (provider) {
    case 'openai':
    case 'anthropic':
    case 'google_gemini':
    case 'groq':
    case 'together':
    case 'xai':
    case 'openrouter':
      return { kind: 'cloud', provider, requiresKey: true }
    
    case 'ollama':
    case 'lmstudio':
      return { kind: 'local', provider, requiresKey: false }
    
    case 'custom':
      return { kind: 'custom', provider: 'custom', requiresKey: false } // Configurable
    
    default:
      // Exhaustive check - this should never be reached
      const _exhaustiveCheck: never = provider
      throw new Error(`Unknown provider: ${_exhaustiveCheck}`)
  }
}

// ============================================================================
// Mapped Types for Provider Operations
// ============================================================================

/**
 * Map provider to their supported model operations
 */
type ProviderModelOperations = {
  [K in APIProviders]: {
    list: () => Promise<ModelNamePattern<K>[]>
    validate: (model: string) => model is ModelNamePattern<K>
    getCapabilities: () => ProviderCapabilities<K>
    getConfig: () => ProviderConfig<K>
  }
}

/**
 * Utility type to extract provider operations
 */
export type ProviderOperations<T extends APIProviders> = ProviderModelOperations[T]

// ============================================================================
// Conditional Type for Model Selection Constraints
// ============================================================================

/**
 * Model selection constraints based on provider capabilities
 */
type ModelSelectionConstraint<TProvider extends APIProviders, TFeature extends keyof ProviderCapabilities<TProvider>> = 
  ProviderCapabilities<TProvider>[TFeature] extends true 
    ? { available: true; models: ModelNamePattern<TProvider>[] }
    : ProviderCapabilities<TProvider>[TFeature] extends false
    ? { available: false; models: never[] }
    : { available: boolean; models: ModelNamePattern<TProvider>[] }

// ============================================================================
// Advanced Inference Patterns
// ============================================================================

/**
 * Infer provider configuration from partial data
 */
type InferProviderFromConfig<T> = 
  T extends { organization: string } ? 'openai' :
  T extends { httpReferer: string } ? 'openrouter' :
  T extends { timeout: number; baseURL: string } & { apiKey?: undefined } ? 'ollama' | 'lmstudio' :
  T extends { headers: Record<string, string> } ? 'custom' :
  APIProviders

/**
 * Type-safe provider factory with inference
 */
export interface ProviderFactory {
  create<T extends APIProviders>(
    provider: T,
    config: ProviderConfig<T>
  ): {
    provider: T
    config: ProviderConfig<T>
    capabilities: ProviderCapabilities<T>
    type: ProviderType
    validateModel: (model: string) => model is ModelNamePattern<T>
    inferProvider: <M extends string>(model: M) => InferProviderFromModel<M>
  }
}

// ============================================================================
// Implementation with Advanced Type Inference
// ============================================================================

/**
 * Create a type-safe provider instance
 */
export const createProviderInstance = <T extends APIProviders>(
  provider: T,
  config: ProviderConfig<T>
): ReturnType<ProviderFactory['create']> => {
  const capabilities = getProviderCapabilities(provider)
  const type = getProviderType(provider)
  
  return {
    provider,
    config,
    capabilities,
    type,
    validateModel: (model: string): model is ModelNamePattern<T> => {
      return validateModelForProvider(provider, model)
    },
    inferProvider: <M extends string>(model: M): InferProviderFromModel<M> => {
      return inferProviderFromModelName(model) as InferProviderFromModel<M>
    }
  }
}

// ============================================================================
// Helper Functions with Type Guards
// ============================================================================

/**
 * Get provider capabilities with proper typing
 */
function getProviderCapabilities<T extends APIProviders>(provider: T): ProviderCapabilities<T> {
  const baseCapabilities = {
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: false,
    supportsSystemPrompts: false,
    maxContextLength: 4096
  } as const

  switch (provider) {
    case 'openai':
      return {
        ...baseCapabilities,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsSystemPrompts: true,
        maxContextLength: 128000
      } as ProviderCapabilities<T>
      
    case 'anthropic':
      return {
        ...baseCapabilities,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsSystemPrompts: true,
        maxContextLength: 200000
      } as ProviderCapabilities<T>
      
    case 'google_gemini':
      return {
        ...baseCapabilities,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsSystemPrompts: true,
        maxContextLength: 1000000
      } as ProviderCapabilities<T>
      
    case 'groq':
      return {
        ...baseCapabilities,
        supportsFunctionCalling: true,
        supportsSystemPrompts: true,
        maxContextLength: 32768
      } as ProviderCapabilities<T>
      
    case 'together':
      return {
        ...baseCapabilities,
        supportsFunctionCalling: true,
        supportsSystemPrompts: true,
        maxContextLength: 32768
      } as ProviderCapabilities<T>
      
    case 'xai':
      return {
        ...baseCapabilities,
        supportsSystemPrompts: true,
        maxContextLength: 131072
      } as ProviderCapabilities<T>
      
    case 'openrouter':
      return {
        ...baseCapabilities,
        supportsVision: true,
        supportsFunctionCalling: true,
        supportsSystemPrompts: true,
        maxContextLength: 200000
      } as ProviderCapabilities<T>
      
    case 'ollama':
    case 'lmstudio':
      return {
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: false,
        supportsSystemPrompts: true,
        maxContextLength: 32768
      } as ProviderCapabilities<T>
      
    case 'custom':
      return {
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: false,
        supportsSystemPrompts: true,
        maxContextLength: 32768
      } as ProviderCapabilities<T>
      
    default:
      const _exhaustiveCheck: never = provider
      throw new Error(`Unknown provider: ${_exhaustiveCheck}`)
  }
}

/**
 * Validate model name against provider patterns
 */
function validateModelForProvider<T extends APIProviders>(
  provider: T,
  model: string
): model is ModelNamePattern<T> {
  switch (provider) {
    case 'openai':
      return /^(gpt-|o1-|text-)/.test(model)
    case 'anthropic':
      return /^claude-/.test(model)
    case 'google_gemini':
      return /^gemini-/.test(model)
    case 'groq':
      return /(-groq$|^mixtral-|^llama-)/.test(model)
    case 'together':
      return /@/.test(model)
    case 'xai':
      return /^grok-/.test(model)
    case 'openrouter':
      return /\//.test(model)
    case 'ollama':
    case 'lmstudio':
    case 'custom':
      return model.length > 0
    default:
      return false
  }
}

/**
 * Infer provider from model name
 */
function inferProviderFromModelName(model: string): APIProviders {
  if (/^(gpt-|o1-|text-)/.test(model)) return 'openai'
  if (/^claude-/.test(model)) return 'anthropic'
  if (/^gemini-/.test(model)) return 'google_gemini'
  if (/(-groq$|^mixtral-|^llama-)/.test(model)) return 'groq'
  if (/@/.test(model)) return 'together'
  if (/^grok-/.test(model)) return 'xai'
  if (/\//.test(model)) return 'openrouter'
  
  // Default for ambiguous cases
  return 'custom'
}

// ============================================================================
// Export Advanced Types for External Use
// ============================================================================

export type {
  ModelNamePattern,
  InferProviderFromModel,
  ProviderConfig,
  ProviderCapabilities,
  ProviderType,
  ModelSelectionConstraint,
  InferProviderFromConfig
}

// ============================================================================
// Utility Types for Hook Factories
// ============================================================================

/**
 * Extract provider-specific hook types
 */
export type ProviderHookConfig<T extends APIProviders> = {
  provider: T
  config: ProviderConfig<T>
  capabilities: ProviderCapabilities<T>
}

/**
 * Model selection hook constraints
 */
export type ModelSelectionHookConstraints<T extends APIProviders> = {
  provider: T
  availableModels: ModelNamePattern<T>[]
  selectedModel: ModelNamePattern<T> | null
  setModel: (model: ModelNamePattern<T>) => void
  validateModel: (model: string) => model is ModelNamePattern<T>
}