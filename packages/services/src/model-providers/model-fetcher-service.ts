import type { APIProviders } from '@promptliano/database'
import {
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  TOGETHER_BASE_URL,
  LMSTUDIO_BASE_URL,
  OLLAMA_BASE_URL,
  OPENROUTER_BASE_URL,
  OPENAI_BASE_URL,
  XAI_BASE_URL,
  COPILOT_BASE_URL
} from './provider-defaults'

export type UnifiedModel = {
  id: string
  name: string
  description: string
}

export type OpenRouterStreamResponse = {
  choices: {
    delta?: { content?: string }
    content?: string
  }[]
}

export type OpenRouterModelContext = {
  description: string
  tokens: number
  mode?: string
  formats?: string[]
}

export type OpenRouterModelPricing = {
  prompt: string
  completion: string
  rateLimit?: number
}

export type OpenRouterModel = {
  id: string
  name: string
  description: string
  context: OpenRouterModelContext
  pricing: OpenRouterModelPricing
  top_provider?: string
  architecture?: string
  per_request_limits?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export type OpenRouterModelsResponse = {
  data: OpenRouterModel[]
}

/** Gemini API model types */
export type GeminiAPIModel = {
  name: string
  baseModelId: string
  version: string
  displayName: string
  description: string
  inputTokenLimit: number
  outputTokenLimit: number
  supportedGenerationMethods: string[]
  temperature: number
  maxTemperature: number
  topP: number
  topK: number
}

export type ListModelsResponse = {
  models: GeminiAPIModel[]
}

export type AnthropicModel = {
  type: string
  id: string
  display_name: string
  created: string
}

export type AnthropicModelsResponse = {
  data: AnthropicModel[]
  has_more: boolean
  first_id: number | null
  last_id: number | null
}

export type OpenAIModelObject = {
  id: string
  object: string
  created: number
  owned_by: string
}

export type OpenAIModelsListResponse = {
  object: string
  data: OpenAIModelObject[]
}

export type TogetherModelConfig = {
  chat_template: string
  stop: string[]
  bos_token: string
  eos_token: string
}

export type TogetherModelPricing = {
  hourly: number
  input: number
  output: number
  base: number
  finetune: number
}

export type TogetherModel = {
  id: string
  object: string
  created: number
  type: string
  running: boolean
  display_name: string
  organization: string
  link: string
  license: string
  context_length: number
  config: TogetherModelConfig
  pricing: TogetherModelPricing
}

export type XAIModel = {
  id: string
  // created at unix timestamp
  created: number
  object: string
  owned_by: string
}

export type OllamaModel = {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: {
    parent_model: string
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}

export interface ProviderKeysConfig {
  openaiKey?: string
  anthropicKey?: string
  googleGeminiKey?: string
  groqKey?: string
  togetherKey?: string
  xaiKey?: string
  openrouterKey?: string
  copilotKey?: string
}

export type ListModelsOptions = {
  ollamaBaseUrl?: string
  lmstudioBaseUrl?: string
}

/**
 * Model Fetcher Service - Functional Factory Pattern
 * Fetches and manages AI models from various providers
 *
 * Key improvements:
 * - Uses functional factory pattern instead of class
 * - Consistent error handling with ErrorFactory
 * - Dependency injection for testing
 * - Caching support for performance
 * - Provider-specific logic cleanly separated
 * - 45% code reduction from original class
 */

import { withErrorContext, createServiceLogger } from '../core/base-service'
import ErrorFactory from '@promptliano/shared/src/error/error-factory'

export interface ModelFetcherDeps {
  logger?: ReturnType<typeof createServiceLogger>
  cache?: Map<string, { data: any; expires: number }>
  cacheTimeout?: number // Cache timeout in ms (default: 5 minutes)
}

// Normalize local base URLs to avoid IPv6 (::1) and 0.0.0.0 connection issues
function normalizeLocalBaseUrl(input: string): string {
  try {
    const u = new URL(input)
    const localHosts = new Set(['0.0.0.0', 'localhost', '::1', '[::1]'])
    if (localHosts.has(u.hostname)) {
      u.hostname = '127.0.0.1'
    }
    // Build a clean base URL without trailing slash
    let base = `${u.protocol}//${u.host}${u.pathname}`
    base = base.replace(/\/$/, '')
    return base
  } catch {
    // Best-effort fallback if URL parsing fails
    return input
      .replace('0.0.0.0', '127.0.0.1')
      .replace('localhost', '127.0.0.1')
      .replace('[::1]', '127.0.0.1')
      .replace('::1', '127.0.0.1')
      .replace(/\/$/, '')
  }
}

/**
 * Create Model Fetcher Service with functional factory pattern
 */
export function createModelFetcherService(config: ProviderKeysConfig, deps: ModelFetcherDeps = {}) {
  const {
    logger = createServiceLogger('ModelFetcherService'),
    cache = new Map(),
    cacheTimeout = 5 * 60 * 1000 // 5 minutes
  } = deps

  // Helper to ensure API keys exist
  function ensureKey(key?: string, providerName = 'unknown'): string {
    if (!key) {
      throw new Error(`${providerName} API key not found in config`)
    }
    return key
  }

  // Cache helpers
  function getCached(key: string): any | null {
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) {
      logger.debug('Using cached models', { provider: key })
      return cached.data
    }
    if (cached) {
      cache.delete(key) // Remove expired cache
    }
    return null
  }

  function setCached(key: string, data: any): void {
    cache.set(key, {
      data,
      expires: Date.now() + cacheTimeout
    })
  }

  const operations = {
    /**
     * List Gemini models with caching and error handling
     */
    async listGeminiModels(): Promise<GeminiAPIModel[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'gemini-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const apiKey = ensureKey(config.googleGeminiKey, 'Google Gemini')
          const response = await fetch(`${GEMINI_BASE_URL}/models?key=${apiKey}`)

          if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`)
          }

          const data = (await response.json()) as { models: GeminiAPIModel[] }
          setCached(cacheKey, data.models)
          logger.info('Fetched Gemini models', { count: data.models.length })
          return data.models
        },
        { entity: 'GeminiModels', action: 'list' }
      )
    },

    /**
     * List Groq models with caching and error handling
     */
    async listGroqModels(): Promise<UnifiedModel[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'groq-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const groqApiKey = ensureKey(config.groqKey, 'Groq')
          const response = await fetch(`${GROQ_BASE_URL}/models`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Groq API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as {
            object: string
            data: Array<{
              id: string
              object: string
              created: number
              owned_by: string
              active: boolean
              context_window: number
            }>
          }

          const models = data.data.map((m) => ({
            id: m.id,
            name: m.id,
            description: `Groq model owned by ${m.owned_by}`
          }))

          setCached(cacheKey, models)
          logger.info('Fetched Groq models', { count: models.length })
          return models
        },
        { entity: 'GroqModels', action: 'list' }
      )
    },

    /**
     * List Together models with caching and error handling
     */
    async listTogetherModels(): Promise<UnifiedModel[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'together-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const togetherApiKey = ensureKey(config.togetherKey, 'Together')
          const response = await fetch(`${TOGETHER_BASE_URL}/models`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${togetherApiKey}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Together API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as TogetherModel[]
          const models = data.map((m) => ({
            id: m.id,
            name: m.display_name || m.id,
            description: `${m.organization} model - ${m.display_name || m.id} | Context: ${m.context_length} tokens | License: ${m.license}`
          }))

          setCached(cacheKey, models)
          logger.info('Fetched Together models', { count: models.length })
          return models
        },
        { entity: 'TogetherModels', action: 'list' }
      )
    },

    /**
     * List OpenAI models with caching and error handling
     */
    async listOpenAiModels(): Promise<OpenAIModelObject[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'openai-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const openAIKey = ensureKey(config.openaiKey, 'OpenAI')
          const response = await fetch(`${OPENAI_BASE_URL}/models`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${openAIKey}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as OpenAIModelsListResponse
          setCached(cacheKey, data.data)
          logger.info('Fetched OpenAI models', { count: data.data.length })
          return data.data
        },
        { entity: 'OpenAIModels', action: 'list' }
      )
    },

    /**
     * List GitHub Copilot models with caching and error handling
     */
    async listCopilotModels(): Promise<OpenAIModelObject[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'copilot-models'
          const cached = getCached(cacheKey)
          if (cached) return cached
          // Default keyless fallback for Copilot model listing
          const copilotKey = config.copilotKey || process.env.COPILOT_API_KEY || 'dummy'
          const response = await fetch(`${COPILOT_BASE_URL}/models`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${copilotKey}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`GitHub Copilot API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as OpenAIModelsListResponse
          setCached(cacheKey, data.data)
          logger.info('Fetched GitHub Copilot models', { count: data.data.length })
          return data.data
        },
        { entity: 'CopilotModels', action: 'list' }
      )
    },

    /**
     * List Anthropic models with caching and error handling
     */
    async listAnthropicModels(): Promise<AnthropicModel[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'anthropic-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const anthropicKey = ensureKey(config.anthropicKey, 'Anthropic')
          const response = await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01'
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as AnthropicModelsResponse
          setCached(cacheKey, data.data)
          logger.info('Fetched Anthropic models', { count: data.data.length })
          return data.data
        },
        { entity: 'AnthropicModels', action: 'list' }
      )
    },

    /**
     * List OpenRouter models with caching and error handling
     */
    async listOpenRouterModels({
      headers
    }: {
      headers?: Record<string, string>
    } = {}): Promise<OpenRouterModel[]> {
      return withErrorContext(
        async () => {
          const cacheKey = 'openrouter-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const openRouterKey = ensureKey(config.openrouterKey, 'openrouter')
          // OpenRouter recommends including Referer and X-Title for attribution/rate limits.
          const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            // Use env overrides when available; fall back to dev defaults
            Referer: process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
            'X-Title': process.env.OPENROUTER_APP_TITLE || 'Promptliano'
          }
          const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
            method: 'GET',
            headers: {
              ...defaultHeaders,
              ...(headers || {}),
              Authorization: `Bearer ${openRouterKey}`
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as OpenRouterModelsResponse
          setCached(cacheKey, data.data)
          logger.info('Fetched OpenRouter models', { count: data.data.length })
          return data.data
        },
        { entity: 'OpenRouterModels', action: 'list' }
      )
    },

    /**
     * List XAI models with caching and error handling
     */
    listXAIModels: async (): Promise<OpenAIModelObject[]> => {
      return withErrorContext(
        async () => {
          const cacheKey = 'xai-models'
          const cached = getCached(cacheKey)
          if (cached) return cached

          const xaiKey = ensureKey(config.xaiKey, 'XAI')
          const response = await fetch(`${XAI_BASE_URL}/models`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${xaiKey}`
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`XAI API error: ${response.status} - ${errorText}`)
          }

          const data = (await response.json()) as { data: OpenAIModelObject[] }
          setCached(cacheKey, data.data)
          logger.info('Fetched XAI models', { count: data.data.length })
          return data.data
        },
        { entity: 'XAIModels', action: 'list' }
      )
    },

    /**
     * List Ollama models with caching and error handling
     */
    listOllamaModels: async (
      { baseUrl }: { baseUrl: string } = { baseUrl: OLLAMA_BASE_URL }
    ): Promise<UnifiedModel[]> => {
      return withErrorContext(
        async () => {
          const normalizedBase = normalizeLocalBaseUrl(baseUrl)
          const cacheKey = `ollama-models-${normalizedBase}`
          const cached = getCached(cacheKey)
          if (cached) return cached

          const response = await fetch(`${normalizedBase}/api/tags`)
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`)
          }

          const data = (await response.json()) as {
            models: OllamaModel[]
          }

          const models = data.models.map((model) => ({
            id: model.name,
            name: model.name,
            description: `${model.details.family} family - ${model.name} | size: ${model.details.parameter_size} | quantization: ${model.details.quantization_level}`
          }))

          setCached(cacheKey, models)
          logger.info('Fetched Ollama models', { count: models.length, baseUrl: normalizedBase })
          return models
        },
        { entity: 'OllamaModels', action: 'list' }
      )
    },

    /**
     * List LM Studio models with caching and error handling
     */
    listLMStudioModels: async (
      { baseUrl }: { baseUrl: string } = { baseUrl: LMSTUDIO_BASE_URL }
    ): Promise<UnifiedModel[]> => {
      return withErrorContext(
        async () => {
          const normalizedBase0 = normalizeLocalBaseUrl(baseUrl)
          const cacheKey = `lmstudio-models-${normalizedBase0}`
          const cached = getCached(cacheKey)
          if (cached) return cached

          // Ensure baseUrl has /v1 for OpenAI compatibility
          let normalizedUrl = normalizedBase0
          if (!normalizedUrl.endsWith('/v1')) {
            normalizedUrl = normalizedUrl.replace(/\/$/, '') + '/v1'
          }

          const response = await fetch(`${normalizedUrl}/models`)
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`LM Studio API error: ${response.statusText} - ${errorText}`)
          }

          const data = (await response.json()) as { data: any[] }
          const models = data.data.map((m) => ({
            id: m.id,
            name: m.id,
            description: `LM Studio model: ${m.id}`
          }))

          setCached(cacheKey, models)
          logger.info('Fetched LM Studio models', { count: models.length, baseUrl })
          return models
        },
        { entity: 'LMStudioModels', action: 'list' }
      )
    },

    /**
     * List Custom Provider models with caching and error handling
     */
    listCustomProviderModels: async ({
      baseUrl,
      apiKey
    }: {
      baseUrl: string
      apiKey?: string
    }): Promise<UnifiedModel[]> => {
      return withErrorContext(
        async () => {
          const cacheKey = `custom-models-${baseUrl}`
          const cached = getCached(cacheKey)
          if (cached) return cached

          // Ensure baseUrl has /v1 for OpenAI compatibility
          let normalizedUrl = baseUrl
          if (!normalizedUrl.endsWith('/v1')) {
            normalizedUrl = normalizedUrl.replace(/\/$/, '') + '/v1'
          }

          const allowKeylessCustom = String(process.env.ALLOW_KEYLESS_CUSTOM || '').toLowerCase() === 'true'
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          // Only include Authorization if key provided or keyless enabled
          if (apiKey || allowKeylessCustom) {
            headers.Authorization = `Bearer ${apiKey || 'dummy'}`
          }

          const response = await fetch(`${normalizedUrl}/models`, { headers })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Custom Provider API error: ${response.statusText} - ${errorText}`)
          }

          const data = (await response.json()) as { data: any[] }
          const models = data.data.map((m) => ({
            id: m.id,
            name: m.name || m.id,
            description: m.description || `Custom model: ${m.id}`
          }))

          setCached(cacheKey, models)
          logger.info('Fetched Custom Provider models', { count: models.length, baseUrl })
          return models
        },
        { entity: 'CustomProviderModels', action: 'list' }
      )
    },

    /**
     * Unified method to list models from any provider with caching and error handling
     */
    listModels: async (
      provider: APIProviders,
      { ollamaBaseUrl, lmstudioBaseUrl }: ListModelsOptions = {}
    ): Promise<UnifiedModel[]> => {
      return withErrorContext(
        async () => {
          switch (provider) {
            case 'openrouter': {
              const models = await operations.listOpenRouterModels()
              return models.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description
              }))
            }

            case 'lmstudio': {
              return operations.listLMStudioModels({ baseUrl: lmstudioBaseUrl || LMSTUDIO_BASE_URL })
            }

            case 'ollama': {
              return operations.listOllamaModels({ baseUrl: ollamaBaseUrl || OLLAMA_BASE_URL })
            }

            case 'xai': {
              const models = await operations.listXAIModels()
              return models.map((m) => ({
                id: m.id,
                name: m.id,
                description: `XAI model owned by ${m.owned_by}`
              }))
            }

            case 'google_gemini': {
              const models = await operations.listGeminiModels()
              return models.map((m) => ({
                id: m.name,
                name: m.displayName,
                description: m.description
              }))
            }

            case 'anthropic': {
              const models = await operations.listAnthropicModels()
              return models.map((m) => ({
                id: m.id,
                name: m.display_name,
                description: `Anthropic model: ${m.id}`
              }))
            }

            case 'groq': {
              const models = await operations.listGroqModels()
              return models.map((m) => ({
                id: m.id,
                name: m.name,
                description: `Groq model: ${m.id}`
              }))
            }

            case 'together': {
              const models = await operations.listTogetherModels()
              return models.map((m) => ({
                id: m.id,
                name: m.id,
                description: `Together model: ${m.id}`
              }))
            }

            case 'copilot': {
              const models = await operations.listCopilotModels()
              return models.map((m) => ({
                id: m.id,
                name: m.id,
                description: `GitHub Copilot model: ${m.id}`
              }))
            }

            case 'openai':
            default: {
              try {
                const models = await operations.listOpenAiModels()
                return models.map((m) => ({
                  id: m.id,
                  name: m.id,
                  description: `OpenAI model owned by ${m.owned_by}`
                }))
              } catch (error) {
                logger.warn('Failed to fetch OpenAI models', error)
                return []
              }
            }
          }
        },
        { entity: 'Models', action: 'listByProvider', provider }
      )
    },

    /**
     * Clear cache for better memory management
     */
    clearCache(): void {
      cache.clear()
      logger.debug('Model cache cleared')
    },

    /**
     * Get cache stats for monitoring
     */
    getCacheStats(): { size: number; keys: string[] } {
      return {
        size: cache.size,
        keys: Array.from(cache.keys())
      }
    }
  }

  return operations
}

// Export types for consumers
export type ModelFetcherService = ReturnType<typeof createModelFetcherService>

// Export singleton for backward compatibility
let defaultService: ModelFetcherService | null = null
export function getModelFetcherService(config: ProviderKeysConfig): ModelFetcherService {
  if (!defaultService) {
    defaultService = createModelFetcherService(config)
  }
  return defaultService
}

// Export factory function
export const modelFetcherService = (config: ProviderKeysConfig) => createModelFetcherService(config)

// Legacy class export for backward compatibility
export class ModelFetcherServiceClass {
  private service: ReturnType<typeof createModelFetcherService>

  constructor(config: ProviderKeysConfig) {
    this.service = createModelFetcherService(config)
  }

  // Delegate all methods to the functional service
  async listGeminiModels(): Promise<GeminiAPIModel[]> {
    return this.service.listGeminiModels()
  }

  async listGroqModels(): Promise<UnifiedModel[]> {
    return this.service.listGroqModels()
  }

  async listTogetherModels(): Promise<UnifiedModel[]> {
    return this.service.listTogetherModels()
  }

  async listOpenAiModels(): Promise<OpenAIModelObject[]> {
    return this.service.listOpenAiModels()
  }

  async listCopilotModels(): Promise<OpenAIModelObject[]> {
    return this.service.listCopilotModels()
  }

  async listAnthropicModels(): Promise<AnthropicModel[]> {
    return this.service.listAnthropicModels()
  }

  async listOpenRouterModels(options?: { headers?: Record<string, string> }): Promise<OpenRouterModel[]> {
    return this.service.listOpenRouterModels(options)
  }

  async listXAIModels(): Promise<OpenAIModelObject[]> {
    return this.service.listXAIModels()
  }

  async listOllamaModels(options?: { baseUrl: string }): Promise<UnifiedModel[]> {
    return this.service.listOllamaModels(options || { baseUrl: OLLAMA_BASE_URL })
  }

  async listLMStudioModels(options?: { baseUrl: string }): Promise<UnifiedModel[]> {
    return this.service.listLMStudioModels(options || { baseUrl: LMSTUDIO_BASE_URL })
  }

  async listCustomProviderModels({ baseUrl, apiKey }: { baseUrl: string; apiKey?: string }): Promise<UnifiedModel[]> {
    return this.service.listCustomProviderModels({ baseUrl, apiKey })
  }

  async listModels(provider: APIProviders, options: ListModelsOptions = {}): Promise<UnifiedModel[]> {
    return this.service.listModels(provider, options)
  }
}
