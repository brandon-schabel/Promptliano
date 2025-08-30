import { eq, providerKeys } from '@promptliano/database'
import { validateJsonField } from '@promptliano/database/src/schema-transformers'
import {
  type ProviderKey,
  type CreateProviderKey,
  type UpdateProviderKey,
  type APIProviders,
  ProviderKeySchema
} from '@promptliano/database'
import {
  CreateProviderKeyInputSchema,
  type TestProviderRequest,
  type TestProviderResponse,
  type BatchTestProviderRequest,
  type BatchTestProviderResponse,
  type ProviderHealthStatus,
  type ProviderModel,
  ProviderStatusEnum,
  ProviderHealthStatusEnum
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { ErrorFactory, assertExists, handleZodError, withErrorContext } from '@promptliano/shared'
import { logger } from './utils/logger'
import { z } from '@hono/zod-openapi'
import { normalizeToUnixMs } from '@promptliano/shared'
import { getProviderTimeout, createProviderTimeout } from './utils/provider-timeouts'

// Type aliases for clarity
export type CreateProviderKeyInput = CreateProviderKey
export type UpdateProviderKeyInput = UpdateProviderKey

/**
 * Transform raw database provider key to properly typed provider key
 * This handles the conversion from repository BaseEntity to ProviderKey using database validators
 */
function transformProviderKey(rawKey: any): ProviderKey {
  const result = ProviderKeySchema.safeParse({
    ...rawKey,
    customHeaders: validateJsonField.record(rawKey.customHeaders)
  })
  if (result.success) {
    return result.data as ProviderKey
  }
  // Fallback with manual transformation using database validators
  return {
    ...rawKey,
    customHeaders: validateJsonField.record(rawKey.customHeaders) || {},
    isDefault: Boolean(rawKey.isDefault),
    isActive: Boolean(rawKey.isActive)
  } as ProviderKey
}

/**
 * Transform array of raw database provider keys
 */
function transformProviderKeys(rawKeys: any[]): ProviderKey[] {
  return rawKeys.map(transformProviderKey)
}

/**
 * Returns an object of functions to create, list, update, and delete provider keys,
 * using repository pattern with Drizzle ORM.
 */
export function createProviderKeyService() {
  // Lazy import to avoid circular dependency
  const getRepository = async () => {
    const { providerKeyRepository } = await import('@promptliano/database')
    return providerKeyRepository
  }

  /**
   * Helper function to mask API keys for security
   * Shows first 4 and last 4 characters with asterisks in between
   * @param key The API key to mask
   * @returns Masked version of the key
   */
  function maskApiKey(key: string): string {
    if (!key || key.length <= 8) return '********'
    return `${key.substring(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.substring(key.length - 4)}`
  }

  // Resolve actual key value from a secret reference (environment variable name)
  function resolveSecretRef(secretRef?: string | null): string | null {
    if (!secretRef) return null
    try {
      const val = process.env[secretRef]
      return val && typeof val === 'string' && val.trim().length > 0 ? val : null
    } catch {
      return null
    }
  }

  // Get the actual key value (from plain text or environment variable)
  function getKeyValue(keyData: any): string | null {
    // First try to resolve from environment variable if secretRef is provided
    const envValue = resolveSecretRef(keyData.secretRef)
    if (envValue) return envValue
    
    // Otherwise return the plain text key
    return keyData.key || null
  }

  /**
   * Normalize provider identifiers to canonical slugs used by the system
   */
  function canonicalizeProviderId(provider: string): APIProviders | string {
    const raw = (provider || '').trim().toLowerCase()
    const normalized = raw.replace(/[^a-z]/g, '')
    switch (normalized) {
      case 'openrouter':
        return 'openrouter'
      case 'openai':
        return 'openai'
      case 'anthropic':
        return 'anthropic'
      case 'googlegemini':
        return 'google_gemini'
      case 'groq':
        return 'groq'
      case 'together':
        return 'together'
      case 'xai':
        return 'xai'
      case 'lmstudio':
        return 'lmstudio'
      case 'ollama':
        return 'ollama'
      case 'custom':
        return 'custom'
      default:
        // Return lowercased original for unknowns
        return raw
    }
  }

  async function createKey(data: CreateProviderKeyInput & { key?: string | null; secretRef?: string | null }): Promise<ProviderKey> {
    return withErrorContext(
      async () => {
        const now = normalizeToUnixMs(new Date())

        // If this new key is set to default, unset other defaults for the same provider
        if (data.isDefault) {
          const repository = await getRepository()
          const existingDefaultKeys = await repository.findWhere(eq(providerKeys.provider, data.provider))

          // Update all existing default keys for this provider to not be default
          const transformedKeys = transformProviderKeys(existingDefaultKeys)
          const defaultKeys = transformedKeys.filter((key) => key.isDefault)
          if (defaultKeys.length > 0) {
            await Promise.all(defaultKeys.map((key) => repository.update(key.id, { isDefault: false })))
          }
        }

        // Simplified: Store either plain text key or environment variable reference
        const newKeyData = {
          name: data.name || null,
          provider: canonicalizeProviderId(data.provider),
          keyName: data.keyName || data.name || 'default', // Backward compatibility
          secretRef: (data as any).secretRef || null, // Environment variable name if provided
          key: (data as any).key || null, // Plain text key if provided
          baseUrl: data.baseUrl || null,
          customHeaders: data.customHeaders || {},
          isDefault: data.isDefault ?? false,
          isActive: data.isActive ?? true,
          environment: data.environment ?? 'production',
          description: data.description || null,
          expiresAt: data.expiresAt || null,
          lastUsed: data.lastUsed || null
        }

        // Create the key using repository (ID, createdAt, updatedAt handled automatically)
        const repository = await getRepository()
        const createdKey = await repository.create(newKeyData as any)
        const transformedKey = transformProviderKey(createdKey)

        // Return with masked key for security
        const actualKey = getKeyValue(transformedKey)
        return { ...transformedKey, key: actualKey ? maskApiKey(actualKey) : null }
      },
      { entity: 'ProviderKey', action: 'create' }
    )
  }

  async function listKeysCensoredKeys(): Promise<ProviderKey[]> {
    return withErrorContext(
      async () => {
        // Get all keys from repository (already sorted by createdAt desc)
        const repository = await getRepository()
        const allKeys = await repository.getAll('desc')
        const transformedKeys = transformProviderKeys(allKeys)

        const keyList = transformedKeys.map((key) => {
          const actualKey = getKeyValue(key)
          return { ...key, key: actualKey ? maskApiKey(actualKey) : null }
        })

        // Sort by provider, then by createdAt descending
        keyList.sort((a, b) => {
          if (a.provider < b.provider) return -1
          if (a.provider > b.provider) return 1
          // Sort by createdAt descending (newer first)
          if (a.createdAt > b.createdAt) return -1
          if (a.createdAt < b.createdAt) return 1
          return 0
        })

        return keyList
      },
      { entity: 'ProviderKey', action: 'listCensored' }
    )
  }

  async function listKeysUncensored(): Promise<ProviderKey[]> {
    return withErrorContext(
      async () => {
        // Get all keys from repository (already sorted by createdAt desc)
        const repository = await getRepository()
        const allKeys = await repository.getAll('desc')
        const transformedKeys = transformProviderKeys(allKeys)

        const keyList = transformedKeys.map((key) => {
          const actualKey = getKeyValue(key)
          return { ...key, key: actualKey }
        })

        // Sort by provider, then by createdAt descending
        keyList.sort((a, b) => {
          if (a.provider < b.provider) return -1
          if (a.provider > b.provider) return 1
          if (a.createdAt > b.createdAt) return -1
          if (a.createdAt < b.createdAt) return 1
          return 0
        })

        return keyList
      },
      { entity: 'ProviderKey', action: 'listUncensored' }
    )
  }

  /**
   * Get all custom providers as distinct provider options
   * Each custom provider will have a unique ID like "custom_<keyId>"
   */
  async function getCustomProviders(): Promise<Array<{ id: string; name: string; baseUrl?: string; keyId: number }>> {
    // We don't need decrypted keys for this list; use censored to avoid decryption issues
    const allKeys = await listKeysCensoredKeys()
    const customKeys = allKeys.filter((key) => key.provider === 'custom' && key.baseUrl)

    return customKeys.map((key) => ({
      id: `custom_${key.id}`,
      name: key.name || 'Custom Provider',
      baseUrl: key.baseUrl || undefined,
      keyId: key.id
    }))
  }

  async function getKeyById(id: number): Promise<ProviderKey | null> {
    return withErrorContext(
      async () => {
        const repository = await getRepository()
        const foundKeyData = await repository.getById(id)

        if (!foundKeyData) {
          return null
        }

        const typedKey = transformProviderKey(foundKeyData)
        const actualKey = getKeyValue(typedKey)
        return { ...typedKey, key: actualKey }
      },
      { entity: 'ProviderKey', action: 'getById', id }
    )
  }

  async function updateKey(id: number, data: UpdateProviderKeyInput & { secretRef?: string | null; key?: string | null }): Promise<ProviderKey> {
    return withErrorContext(
      async () => {
        // First, get the existing key to verify it exists
        const repository = await getRepository()
        const rawExistingKey = await repository.getById(id)
        assertExists(rawExistingKey, 'Provider Key', id)
        const existingKey = transformProviderKey(rawExistingKey)

        // If this key is being set to default, unset other defaults for the same provider
        const targetProvider = data.provider ?? existingKey.provider
        if (data.isDefault === true && existingKey.provider === targetProvider) {
          const existingDefaultKeys = await repository.findWhere(eq(providerKeys.provider, targetProvider))

          // Update all existing default keys for this provider to not be default (except current key)
          const transformedUpdateKeys = transformProviderKeys(existingDefaultKeys)
          const defaultKeys = transformedUpdateKeys.filter((key) => key.isDefault && key.id !== id)
          if (defaultKeys.length > 0) {
            await Promise.all(defaultKeys.map((key) => repository.update(key.id, { isDefault: false })))
          }
        }

        // Prepare update data (only include defined fields)
        let updateData: Partial<UpdateProviderKeyInput> = {}

        if (data.name !== undefined) updateData.name = data.name
        if (data.provider !== undefined) updateData.provider = canonicalizeProviderId(data.provider)
        if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl
        if (data.customHeaders !== undefined) updateData.customHeaders = data.customHeaders
        if (data.isDefault !== undefined) updateData.isDefault = data.isDefault
        if (data.isActive !== undefined) updateData.isActive = data.isActive
        if (data.environment !== undefined) updateData.environment = data.environment
        if (data.description !== undefined) updateData.description = data.description
        if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt
        if (data.lastUsed !== undefined) updateData.lastUsed = data.lastUsed

        // Simplified: Update plain text key or environment variable reference
        if ((data as any).secretRef !== undefined) {
          (updateData as any).secretRef = (data as any).secretRef
        }
        if ((data as any).key !== undefined) {
          (updateData as any).key = (data as any).key
        }

        // Update the key using repository
        const rawUpdatedKey = await repository.update(id, updateData)
        const updatedKey = transformProviderKey(rawUpdatedKey)

        // Return with actual key value
        const actualKey = getKeyValue(updatedKey)
        return { ...updatedKey, key: actualKey }
      },
      { entity: 'ProviderKey', action: 'update', id }
    )
  }

  async function deleteKey(id: number): Promise<boolean> {
    return withErrorContext(
      async () => {
        // Check if key exists first
        const repository = await getRepository()
        const keyExists = await repository.exists(id)
        if (!keyExists) {
          return false // Key not found, nothing to delete
        }

        // Delete the key using repository
        const deleted = await repository.delete(id)
        return deleted
      },
      { entity: 'ProviderKey', action: 'delete', id }
    )
  }

  async function testProvider(request: TestProviderRequest): Promise<TestProviderResponse> {
    const startTime = Date.now()

    try {
      // Get provider key by ID
      const providerKey = await getKeyById(request.providerId)
      if (!providerKey) {
        throw ErrorFactory.notFound('Provider', request.providerId)
      }

      // The key is already resolved (from plain text or env var) by getKeyById
      const apiKey = providerKey.key || ''
      if (!apiKey) {
        throw ErrorFactory.missingRequired('API key', 'provider')
      }

      // Create extended request for internal testing
      const testRequest = {
        ...request,
        provider: providerKey.provider,
        apiKey: apiKey,
        url: providerKey.baseUrl || undefined
      }

      // Test connection based on provider type
      const result = await performProviderTest(testRequest)
      const responseTime = Date.now() - startTime

      return {
        success: true,
        providerId: request.providerId,
        provider: providerKey.provider,
        model: request.model,
        latency: responseTime,
        response: `Connected successfully. Found ${result.models.length} models.`
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        success: false,
        providerId: request.providerId,
        provider: 'unknown',
        model: request.model,
        latency: responseTime,
        error: errorMessage
      }
    }
  }

  async function batchTestProviders(request: BatchTestProviderRequest): Promise<BatchTestProviderResponse> {
    const startTime = Date.now()
    let results: TestProviderResponse[]

    // Get provider IDs to test
    const providerIds = request.providerIds || []

    if (providerIds.length === 0) {
      // If no provider IDs specified, get all active providers
      const allProviders = await listKeysUncensored()
      providerIds.push(
        ...allProviders.filter((p: ProviderKey) => p.isActive || request.includeInactive).map((p: ProviderKey) => p.id)
      )
    }

    // Create test requests
    const testRequests: TestProviderRequest[] = providerIds.map((providerId) => ({
      providerId,
      testPrompt: request.testPrompt,
      model: undefined
    }))

    // Run tests sequentially (parallel not supported in schema)
    results = []
    for (const testRequest of testRequests) {
      try {
        const result = await testProvider(testRequest)
        results.push(result)
      } catch (error) {
        // Add failed test result
        results.push({
          success: false,
          providerId: testRequest.providerId,
          provider: 'unknown',
          latency: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const totalTime = Date.now() - startTime

    // Calculate summary according to schema
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const averageLatency =
      results.length > 0 ? results.reduce((sum, r) => sum + r.latency, 0) / results.length : undefined

    return {
      results,
      summary: {
        total: results.length,
        successful,
        failed,
        averageLatency
      }
    }
  }

  async function getProviderHealthStatus(refresh: boolean = false): Promise<ProviderHealthStatus[]> {
    // Get all configured provider keys
    const allKeys = await listKeysUncensored()
    const providerMap = new Map<string, ProviderKey>()

    // Get the default or first key for each provider
    for (const key of allKeys) {
      if (!providerMap.has(key.provider) || key.isDefault) {
        providerMap.set(key.provider, key)
      }
    }

    const healthStatuses: ProviderHealthStatus[] = []

    for (const [provider, key] of providerMap) {
      try {
        if (refresh) {
          // Perform fresh health check
          const testRequest: TestProviderRequest = {
            providerId: key.id,
            testPrompt: 'Health check'
          }

          const testResult = await testProvider(testRequest)

          healthStatuses.push({
            status: testResult.success ? 'healthy' : 'down',
            lastChecked: Date.now(),
            error: testResult.error,
            latency: testResult.latency
          })
        } else {
          // Return cached/estimated health status based on key data
          healthStatuses.push({
            status: (key.isActive ?? true) ? 'healthy' : 'unknown',
            lastChecked: key.lastUsed ?? key.updatedAt
          })
        }
      } catch (error) {
        // Failed to check this provider
        healthStatuses.push({
          status: 'down',
          lastChecked: normalizeToUnixMs(new Date()),
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return healthStatuses
  }

  /**
   * Internal helper function to perform the actual provider test
   */
  async function performProviderTest(
    request: TestProviderRequest & { provider: string; apiKey: string; url?: string; timeout?: number }
  ): Promise<{ models: ProviderModel[] }> {
    const { provider, apiKey, url } = request

    // Use provider-specific timeout, or fallback to request timeout if specified
    const providerTimeout = getProviderTimeout(provider as APIProviders, 'validation')
    const timeout = request.timeout || providerTimeout

    // Create fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    logger.info(`Testing provider ${provider} with timeout ${timeout}ms`)

    try {
      let response: Response
      let models: ProviderModel[] = []

      switch (provider) {
        case 'openai':
          if (!apiKey) {
            throw ErrorFactory.missingRequired('API key', 'OpenAI provider')
          }
          response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
          if (!response.ok) {
            throw ErrorFactory.operationFailed('OpenAI API request', `${response.status}: ${response.statusText}`)
          }
          const openaiData = (await response.json()) as { data?: Array<{ id: string }> }
          models =
            openaiData.data?.map((model) => ({
              id: model.id,
              name: model.id,
              provider: 'openai'
            })) || []
          break

        case 'anthropic':
          if (!apiKey) {
            throw ErrorFactory.missingRequired('API key', 'Anthropic provider')
          }
          // Anthropic doesn't have a direct models endpoint, so we'll test with a simple request
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }]
            }),
            signal: controller.signal
          })
          // Even if we get a specific error, if we get a 200 or auth-related error, the key is working
          if (response.ok || response.status === 400) {
            models = [
              { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
              { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
              { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' }
            ]
          } else if (response.status === 401) {
            throw ErrorFactory.operationFailed('Anthropic authentication', 'Invalid API key')
          } else {
            throw ErrorFactory.operationFailed('Anthropic API request', `${response.status}: ${response.statusText}`)
          }
          break

        case 'ollama':
          const ollamaUrl = url || 'http://localhost:11434'
          response = await fetch(`${ollamaUrl}/api/tags`, {
            signal: controller.signal
          })
          if (!response.ok) {
            throw ErrorFactory.operationFailed('Ollama connection', `${response.status}: ${response.statusText}`)
          }
          const ollamaData = (await response.json()) as { models?: Array<{ name: string }> }
          models =
            ollamaData.models?.map((model) => ({
              id: model.name,
              name: model.name,
              provider: 'ollama'
            })) || []
          break

        case 'custom': {
          // Test custom OpenAI-compatible provider
          if (!url) {
            throw ErrorFactory.missingRequired('Base URL', 'custom provider')
          }
          if (!apiKey) {
            throw ErrorFactory.missingRequired('API key', 'custom provider')
          }

          // Test with OpenAI-compatible /v1/models endpoint
          const customUrl = url.endsWith('/v1') ? url : `${url.replace(/\/$/, '')}/v1`
          response = await fetch(`${customUrl}/models`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })

          if (!response.ok) {
            throw ErrorFactory.operationFailed(
              'custom provider API request',
              `${response.status}: ${response.statusText}`
            )
          }

          const customData = (await response.json()) as { data?: Array<{ id?: string; name?: string }> }
          models =
            customData.data?.map((model) => {
              const modelId = model.id || 'unknown'
              const modelName = model.name || model.id || 'Unknown Model'
              return {
                id: modelId,
                name: modelName,
                provider: 'custom'
              }
            }) || []
          break
        }

        case 'lmstudio':
          const lmstudioUrl = url || 'http://localhost:1234'
          response = await fetch(`${lmstudioUrl}/v1/models`, {
            signal: controller.signal
          })
          if (!response.ok) {
            throw ErrorFactory.operationFailed('LMStudio connection', `${response.status}: ${response.statusText}`)
          }
          const lmstudioData = (await response.json()) as { data?: Array<{ id: string }> }
          models =
            lmstudioData.data?.map((model) => ({
              id: model.id,
              name: model.id,
              provider: 'lmstudio'
            })) || []
          break

        default:
          throw ErrorFactory.invalidParam('provider', 'supported provider type', provider)
      }

      return { models }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return {
    createKey,
    listKeysCensoredKeys,
    listKeysUncensored,
    getCustomProviders,
    getKeyById,
    updateKey,
    deleteKey,
    testProvider,
    batchTestProviders,
    getProviderHealthStatus
  }
}

// Create route-compatible wrapper around the main service
function createRouteCompatibleProviderKeyService() {
  const mainService = createProviderKeyService()

  return {
    // Route factory compatible methods
    async list(): Promise<ProviderKey[]> {
      return await mainService.listKeysCensoredKeys()
    },

    async getAll(): Promise<ProviderKey[]> {
      return await mainService.listKeysCensoredKeys()
    },

    async get(id: number | string): Promise<ProviderKey | null> {
      return await mainService.getKeyById(Number(id))
    },

    async getById(id: number | string): Promise<ProviderKey> {
      const key = await mainService.getKeyById(Number(id))
      if (!key) {
        throw ErrorFactory.notFound('ProviderKey', id)
      }
      return key
    },

    async create(data: CreateProviderKeyInput & { key?: string | null; secretRef?: string | null }): Promise<ProviderKey> {
      // Returns masked key by default for security
      return await mainService.createKey(data)
    },

    async update(id: number | string, data: UpdateProviderKeyInput): Promise<ProviderKey> {
      return await mainService.updateKey(Number(id), data)
    },

    async delete(id: number | string): Promise<boolean> {
      return await mainService.deleteKey(Number(id))
    },

    // Expose all original methods for backward compatibility
    ...mainService
  }
}

export const providerKeyService = createRouteCompatibleProviderKeyService()
