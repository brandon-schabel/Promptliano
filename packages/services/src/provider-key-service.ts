import { providerKeyRepository, eq } from '@promptliano/database'
import {
  type ProviderKey,
  type InsertProviderKey as CreateProviderKeyInput,
  type InsertProviderKey as UpdateProviderKeyInput,
  selectProviderKeySchema as ProviderKeySchema
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
// Note: These types should be migrated to @promptliano/database in next phase
import { ApiError } from '@promptliano/shared'
import { ErrorFactory, assertExists, handleZodError, withErrorContext } from '@promptliano/shared'
import { logger } from './utils/logger'
import { z } from '@hono/zod-openapi'
import { normalizeToUnixMs } from '@promptliano/shared'
import { encryptKey, decryptKey, isEncrypted, type EncryptedData } from '@promptliano/shared/src/utils/crypto'
import { getProviderTimeout, createProviderTimeout } from './utils/provider-timeouts'

// The mapDbRowToProviderKey function is no longer needed as we store objects directly
// that should conform to the ProviderKey schema.

export type CreateProviderKeyInput = z.infer<typeof CreateProviderKeyInputSchema>

/**
 * Returns an object of functions to create, list, update, and delete provider keys,
 * using repository pattern with Drizzle ORM.
 */
export function createProviderKeyService() {
  async function createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    return withErrorContext(
      async () => {
        const now = normalizeToUnixMs(new Date())

        // If this new key is set to default, unset other defaults for the same provider
        if (data.isDefault) {
          const existingDefaultKeys = await providerKeyRepository.findWhere(
            eq(providerKeyRepository.getTable().provider, data.provider)
          )
          
          // Update all existing default keys for this provider to not be default
          const defaultKeys = existingDefaultKeys.filter(key => key.isDefault)
          if (defaultKeys.length > 0) {
            await Promise.all(
              defaultKeys.map(key =>
                providerKeyRepository.update(key.id, { isDefault: false })
              )
            )
          }
        }

        // Encrypt the API key
        const encryptedData = await encryptKey(data.key)

        const newKeyData: Omit<ProviderKey, 'id' | 'createdAt' | 'updatedAt'> = {
          name: data.name,
          provider: data.provider,
          key: encryptedData.encrypted, // Store encrypted key
          encrypted: true,
          iv: encryptedData.iv,
          tag: encryptedData.tag,
          salt: encryptedData.salt,
          baseUrl: data.baseUrl, // Custom provider base URL
          customHeaders: data.customHeaders, // Custom provider headers
          isDefault: data.isDefault ?? false,
          isActive: data.isActive ?? true,
          environment: data.environment ?? 'production',
          description: data.description,
          expiresAt: data.expiresAt,
          lastUsed: data.lastUsed,
        }

        // Create the key using repository (ID, createdAt, updatedAt handled automatically)
        const createdKey = await providerKeyRepository.create(newKeyData)

        // Return the key with decrypted value
        return { ...createdKey, key: data.key }
      },
      { entity: 'ProviderKey', action: 'create' }
    )
  }

  async function listKeysCensoredKeys(): Promise<ProviderKey[]> {
    return withErrorContext(
      async () => {
        // Get all keys from repository (already sorted by createdAt desc)
        const allKeys = await providerKeyRepository.getAll('desc')
        
        const keyList = allKeys.map((key) => {
          // For encrypted keys, we don't decrypt them, just show a generic mask
          if (key.encrypted) {
            return { ...key, key: '********' }
          }
          // For unencrypted keys (legacy), mask them properly
          const maskedKey =
            key.key.length > 8 ? `${key.key.substring(0, 4)}****${key.key.substring(key.key.length - 4)}` : '********'
          return { ...key, key: maskedKey }
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
        const allKeys = await providerKeyRepository.getAll('desc')
        
        const keyList = await Promise.all(
          allKeys.map(async (key) => {
            // Decrypt key if encrypted
            if (key.encrypted && key.iv && key.tag && key.salt) {
              try {
                const decryptedKey = await decryptKey({
                  encrypted: key.key,
                  iv: key.iv,
                  tag: key.tag,
                  salt: key.salt
                })
                return { ...key, key: decryptedKey }
              } catch (error) {
                logger.error(`Failed to decrypt key ${key.id}`, { 
                  error, 
                  keyId: key.id,
                  provider: key.provider 
                })
                throw ErrorFactory.operationFailed('decrypt provider key', `Key ID: ${key.id}`)
              }
            }
            return key
          })
        )

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
    const allKeys = await listKeysUncensored()
    const customKeys = allKeys.filter(key => key.provider === 'custom' && key.baseUrl)
    
    return customKeys.map(key => ({
      id: `custom_${key.id}`,
      name: key.name || 'Custom Provider',
      baseUrl: key.baseUrl,
      keyId: key.id
    }))
  }

  async function getKeyById(id: number): Promise<ProviderKey | null> {
    return withErrorContext(
      async () => {
        const foundKeyData = await providerKeyRepository.getById(id)

        if (!foundKeyData) {
          return null
        }

        // Decrypt key if encrypted
        if (foundKeyData.encrypted && foundKeyData.iv && foundKeyData.tag && foundKeyData.salt) {
          try {
            const decryptedKey = await decryptKey({
              encrypted: foundKeyData.key,
              iv: foundKeyData.iv,
              tag: foundKeyData.tag,
              salt: foundKeyData.salt
            })
            return { ...foundKeyData, key: decryptedKey }
          } catch (error) {
            logger.error(`Failed to decrypt key ${id}:`, error)
            throw ErrorFactory.operationFailed('decrypt provider key', `Key ID: ${id}`)
          }
        }

        return foundKeyData
      },
      { entity: 'ProviderKey', action: 'getById', id }
    )
  }

  async function updateKey(id: number, data: UpdateProviderKeyInput): Promise<ProviderKey> {
    return withErrorContext(
      async () => {
        // First, get the existing key to verify it exists
        const existingKey = await providerKeyRepository.getById(id)
        assertExists(existingKey, 'Provider Key', id)

        // If this key is being set to default, unset other defaults for the same provider
        const targetProvider = data.provider ?? existingKey.provider
        if (data.isDefault === true && existingKey.provider === targetProvider) {
          const existingDefaultKeys = await providerKeyRepository.findWhere(
            eq(providerKeyRepository.getTable().provider, targetProvider)
          )
          
          // Update all existing default keys for this provider to not be default (except current key)
          const defaultKeys = existingDefaultKeys.filter(key => key.isDefault && key.id !== id)
          if (defaultKeys.length > 0) {
            await Promise.all(
              defaultKeys.map(key =>
                providerKeyRepository.update(key.id, { isDefault: false })
              )
            )
          }
        }

        // Prepare update data
        let updateData: Partial<UpdateProviderKeyInput> = {
          name: data.name,
          provider: data.provider,
          baseUrl: data.baseUrl,
          customHeaders: data.customHeaders,
          isDefault: data.isDefault,
          isActive: data.isActive,
          environment: data.environment,
          description: data.description,
          expiresAt: data.expiresAt,
          lastUsed: data.lastUsed,
        }

        // If key is being updated, encrypt it
        if (data.key) {
          const encryptedData = await encryptKey(data.key)
          updateData = {
            ...updateData,
            key: encryptedData.encrypted,
            encrypted: true,
            iv: encryptedData.iv,
            tag: encryptedData.tag,
            salt: encryptedData.salt
          }
        }

        // Update the key using repository
        const updatedKey = await providerKeyRepository.update(id, updateData)

        // Return the key with decrypted value if we have a new key or if it's encrypted
        if (data.key) {
          // Return with the new key value (don't decrypt what we just encrypted)
          return { ...updatedKey, key: data.key }
        } else if (updatedKey.encrypted && updatedKey.iv && updatedKey.tag && updatedKey.salt) {
          // Decrypt the existing key for return
          try {
            const decryptedKey = await decryptKey({
              encrypted: updatedKey.key,
              iv: updatedKey.iv,
              tag: updatedKey.tag,
              salt: updatedKey.salt
            })
            return { ...updatedKey, key: decryptedKey }
          } catch (error) {
            logger.error(`Failed to decrypt key ${id}:`, error)
            throw ErrorFactory.operationFailed('decrypt provider key', `Key ID: ${id}`)
          }
        }

        return updatedKey
      },
      { entity: 'ProviderKey', action: 'update', id }
    )
  }

  async function deleteKey(id: number): Promise<boolean> {
    return withErrorContext(
      async () => {
        // Check if key exists first
        const keyExists = await providerKeyRepository.exists(id)
        if (!keyExists) {
          return false // Key not found, nothing to delete
        }

        // Delete the key using repository
        const deleted = await providerKeyRepository.delete(id)
        return deleted
      },
      { entity: 'ProviderKey', action: 'delete', id }
    )
  }

  async function testProvider(request: TestProviderRequest): Promise<TestProviderResponse> {
    const startTime = Date.now()
    const testedAt = normalizeToUnixMs(new Date())

    try {
      // Test connection based on provider type
      const result = await performProviderTest(request)
      const responseTime = Date.now() - startTime

      return {
        success: true,
        provider: request.provider,
        status: 'connected',
        models: result.models,
        responseTime,
        testedAt
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        success: false,
        provider: request.provider,
        status: 'error',
        models: [],
        responseTime,
        error: errorMessage,
        testedAt
      }
    }
  }

  async function batchTestProviders(request: BatchTestProviderRequest): Promise<BatchTestProviderResponse> {
    const startTime = Date.now()
    let results: TestProviderResponse[]

    if (request.parallel) {
      // Run tests in parallel
      results = await Promise.all(request.providers.map(testProvider))
    } else {
      // Run tests sequentially
      results = []
      for (const providerRequest of request.providers) {
        const result = await testProvider(providerRequest)
        results.push(result)
      }
    }

    const totalTime = Date.now() - startTime

    // Calculate summary
    const summary = {
      connected: results.filter((r) => r.status === 'connected').length,
      disconnected: results.filter((r) => r.status === 'disconnected').length,
      error: results.filter((r) => r.status === 'error').length
    }

    return {
      results,
      summary,
      totalTime
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
            provider,
            apiKey: key.key,
            timeout: 5000 // Short timeout for health checks
          }

          const testResult = await testProvider(testRequest)

          healthStatuses.push({
            provider,
            status: testResult.success ? 'healthy' : 'unhealthy',
            lastChecked: testResult.testedAt,
            uptime: testResult.success ? 100 : 0, // Simplified uptime calculation
            averageResponseTime: testResult.responseTime,
            modelCount: testResult.models.length
          })
        } else {
          // Return cached/estimated health status based on key data
          healthStatuses.push({
            provider,
            status: (key.isActive ?? true) ? 'healthy' : 'unknown',
            lastChecked: key.lastUsed ?? key.updated,
            uptime: (key.isActive ?? true) ? 99.8 : 0, // Estimated uptime
            averageResponseTime: 1000, // Default estimate
            modelCount: 0 // Unknown without fresh check
          })
        }
      } catch (error) {
        // Failed to check this provider
        healthStatuses.push({
          provider,
          status: 'unhealthy',
          lastChecked: normalizeToUnixMs(new Date()),
          uptime: 0,
          averageResponseTime: 0,
          modelCount: 0
        })
      }
    }

    return healthStatuses
  }

  /**
   * Internal helper function to perform the actual provider test
   */
  async function performProviderTest(request: TestProviderRequest): Promise<{ models: ProviderModel[] }> {
    const { provider, apiKey, url } = request
    
    // Use provider-specific timeout, or fallback to request timeout if specified
    const providerTimeout = getProviderTimeout(provider as any, 'validation')
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
          const openaiData = await response.json() as { data?: Array<{ id: string }> }
          models =
            openaiData.data?.map((model) => ({
              id: model.id,
              name: model.id,
              description: `OpenAI model: ${model.id}`
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
              { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent model' },
              { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
              { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Powerful model for complex tasks' }
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
          const ollamaData = await response.json() as { models?: Array<{ name: string }> }
          models =
            ollamaData.models?.map((model) => ({
              id: model.name,
              name: model.name,
              description: `Ollama model: ${model.name}`
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
            throw ErrorFactory.operationFailed('custom provider API request', `${response.status}: ${response.statusText}`)
          }
          
          const customData = await response.json() as { data?: Array<{ id?: string; name?: string }> }
          models =
            customData.data?.map((model) => {
              const modelId = model.id || 'unknown'
              const modelName = model.name || model.id || 'Unknown Model'
              return {
                id: modelId,
                name: modelName,
                description: `Custom provider model: ${model.id || model.name || 'unknown'}`
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
          const lmstudioData = await response.json() as { data?: Array<{ id: string }> }
          models =
            lmstudioData.data?.map((model) => ({
              id: model.id,
              name: model.id,
              description: `LMStudio model: ${model.id}`
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

export const providerKeyService = createProviderKeyService()
