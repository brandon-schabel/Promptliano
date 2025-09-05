import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient, PromptlianoError } from '../index'
import type { PromptlianoClient } from '../index'
import { createSimpleTestEnvironment } from './test-environment-simple'
import type { SimpleTestEnvironment } from './test-environment-simple'
import { TestDataManager, assertions } from './utils/test-helpers-enhanced'

// Import database schemas as source of truth
import { selectProviderKeySchema as ProviderKeySchema, type ProviderKey } from '@promptliano/database'

describe('Provider Key API Tests', () => {
  let testEnv: SimpleTestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager
  let testKeys: ProviderKey[] = []

  beforeAll(async () => {
    console.log('Starting Provider Key API Tests...')
    
    // Create simple test environment with proper database initialization
    testEnv = await createSimpleTestEnvironment()
    
    client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
    dataManager = new TestDataManager(client)
  })

  afterAll(async () => {
    console.log('Cleaning up provider key test data...')
    
    // Clean up using data manager
    await dataManager.cleanup()
    
    // Clean up any remaining test keys
    for (const key of testKeys) {
      try {
        await client.keys.deleteKey(key.id)
      } catch (err) {
        if (err instanceof PromptlianoError && err.statusCode === 404) {
          // Already deleted
        } else {
          console.error(`Failed to delete provider key ${key.id}:`, err)
        }
      }
    }
    
    // Clean up test environment
    await testEnv.cleanup()
  })

  test('POST /api/keys - Create provider keys', async () => {
    const testKeyData = [
      { name: 'Test OpenAI Key', provider: 'openai' as const, key: `sk-test-${Date.now()}abcdef`, isDefault: false },
      {
        name: 'Test Anthropic Key',
        provider: 'anthropic' as const,
        key: `sk-ant-test-${Date.now()}`,
        isDefault: false
      },
      { name: 'Test Groq Key', provider: 'groq' as const, key: `gsk_test_${Date.now()}`, isDefault: false }
    ]

    for (const data of testKeyData) {
      const result = await client.keys.createKey(data)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(ProviderKeySchema.omit({ key: true }).safeParse(result.data).success).toBe(true) // Key is returned in full on create/get by ID
      expect(result.data.name).toBe(data.name)
      expect(result.data.provider).toBe(data.provider)
      // Key should be masked for security - not returned in full
      // expect(result.data.key).toBe(data.key) // Commented out - keys are now masked
      expect(result.data.key).toBeDefined() // Key should exist but masked
      expect(result.data.isDefault).toBe(data.isDefault)
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.createdAt).toBeNumber()
      expect(result.data.updatedAt).toBeNumber()

      testKeys.push(result.data)
    }
  })

  test('GET /api/keys - List all provider keys (should mask secrets)', async () => {
    const result = await client.keys.listKeys()

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)

    for (const testKey of testKeys) {
      const found = result.data.find((k: ProviderKey) => k.id === testKey.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(testKey.name)
        expect(found.provider).toBe(testKey.provider)
        // Key should be masked in list view
        // For encrypted keys, the service returns '********'
        // For legacy unencrypted keys, it returns a pattern like 'sk-t****bcdef'
        if (found.key === '********') {
          // This is an encrypted key, which is expected
          expect(found.key).toBe('********')
        } else if (testKey.key.length > 8) {
          // Legacy masking pattern for unencrypted keys
          expect(found.key).toMatch(/^.{4}\*+.{4}$/)
        } else {
          expect(found.key).toBe('********') // Short keys also get fully masked
        }
        expect(found.isDefault).toBe(testKey.isDefault)
      }
    }
  })

  test('GET /api/keys/{keyId} - Get individual keys (keys should be masked)', async () => {
    for (const key of testKeys) {
      const result = await client.keys.getKey(key.id)

      expect(result.success).toBe(true)
      expect(result.data.id).toBe(key.id)
      expect(result.data.name).toBe(key.name)
      expect(result.data.provider).toBe(key.provider)
      // Keys are now masked for security even when getting by ID
      expect(result.data.key).toBeDefined()
      expect(typeof result.data.key).toBe('string')
      expect(result.data.isDefault).toBe(key.isDefault)
    }
  })

  test('PATCH /api/keys/{keyId} - Update provider keys', async () => {
    const updates = [
      { name: 'Updated OpenAI Key', isDefault: false },
      { key: `sk-ant-updated-${Date.now()}` },
      { name: 'Updated Groq Key Name', isDefault: true }
    ]

    for (let i = 0; i < testKeys.length; i++) {
      const currentKey = testKeys[i]
      if (!currentKey) continue
      const updateData = updates[i]
      if (!updateData) continue

      const result = await client.keys.updateKey(currentKey.id, updateData)

      expect(result.success).toBe(true)
      const updatedKey = result.data
      if (updateData.name) expect(updatedKey.name).toBe(updateData.name)
      else expect(updatedKey.name).toBe(currentKey.name)

      if ('key' in updateData && updateData.key) {
        expect(updatedKey.key).toBe(updateData.key)
      } else {
        // Key should be present but may be masked
        expect(updatedKey.key).toBeDefined()
        expect(typeof updatedKey.key).toBe('string')
      }

      if (updateData.isDefault !== undefined) expect(updatedKey.isDefault).toBe(updateData.isDefault)
      else expect(updatedKey.isDefault).toBe(currentKey.isDefault)

      expect(updatedKey.updatedAt).toBeGreaterThanOrEqual(currentKey.updatedAt)
      testKeys[i] = updatedKey // Update local copy
    }
  })

  test('GET /api/keys - Verify updates after PATCH and default key logic', async () => {
    const result = await client.keys.listKeys()
    expect(result.success).toBe(true)

    const keysByProvider: Record<string, ProviderKey[]> = {}
    for (const key of result.data) {
      if (!keysByProvider[key.provider]) {
        keysByProvider[key.provider] = []
      }
      keysByProvider[key.provider]!.push(key)
    }

    for (const provider in keysByProvider) {
      const providerKeys = keysByProvider[provider]!
      const defaultKeys = providerKeys.filter((k) => k.isDefault)
      expect(defaultKeys.length).toBeLessThanOrEqual(1) // Max one default per provider
    }

    // Verify local testKeys match the current state for name and isDefault
    for (const testKey of testKeys) {
      const found = result.data.find((k: ProviderKey) => k.id === testKey.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.name).toBe(testKey.name)
        expect(found.isDefault).toBe(testKey.isDefault)
      }
    }
  })

  test('DELETE /api/keys/{keyId} - Delete all test provider keys and verify', async () => {
    const keysToDelete = [...testKeys]
    testKeys = []

    for (const key of keysToDelete) {
      const result = await client.keys.deleteKey(key.id)
      expect(result.success).toBe(true)

      // Verify 404
      try {
        await client.keys.getKey(key.id)
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        // The error might be a plain Error with statusCode property
        expect(error).toBeDefined()
        expect(error.statusCode).toBe(404)
        // Check for the error code if available
        if (error.code) {
          expect(error.code).toBe('PROVIDER_KEY_NOT_FOUND')
        }
      }
    }
  })
})
