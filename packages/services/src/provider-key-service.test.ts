import { describe, test, expect, beforeEach, mock } from 'bun:test'

// Mock repository at module level before any imports
const mockRepository = {
  create: mock(),
  getById: mock(),
  getAll: mock(),
  update: mock(),
  delete: mock(),
  exists: mock(),
  findWhere: mock(),
  findOneWhere: mock(),
  getByName: mock(),
  getActive: mock(),
  getByProvider: mock()
}

// Mock the crypto functions at module level
const mockEncryptKey = mock()
const mockDecryptKey = mock()

// Set up the mocks with proper implementations
mockEncryptKey.mockImplementation(async (plaintext: string) => ({
  encrypted: `encrypted_${plaintext}`,
  iv: 'mock-iv',
  tag: 'mock-tag',
  salt: 'mock-salt'
}))

mockDecryptKey.mockImplementation(async (data: any) => {
  if (data.encrypted && data.encrypted.startsWith('encrypted_')) {
    return data.encrypted.replace('encrypted_', '')
  }
  if (data.encryptedValue) {
    return data.encryptedValue.replace('encrypted_', '')
  }
  return 'decrypted_value'
})

// Mock the database module
mock.module('@promptliano/database', () => ({
  providerKeyRepository: mockRepository,
  providerKeys: {
    provider: { name: 'provider' }
  },
  eq: mock((field: any, value: any) => ({ field, value }))
}))

// Mock the crypto module
mock.module('@promptliano/shared/src/utils/crypto', () => ({
  encryptKey: mockEncryptKey,
  decryptKey: mockDecryptKey,
  generateEncryptionKey: mock(() => 'mock-encryption-key'),
  isEncrypted: (value: any) => {
    return typeof value === 'object' && value !== null && value.encrypted
  }
}))

// Import service and types after mocking
const { createProviderKeyService } = await import('./provider-key-service')
import type { ProviderKey, CreateProviderKey, UpdateProviderKey } from '@promptliano/database'
import { ErrorFactory } from '@promptliano/shared'

describe('provider-key-service (Repository Pattern)', () => {
  let service: ReturnType<typeof createProviderKeyService>

  beforeEach(() => {
    // Reset all mocks
    Object.values(mockRepository).forEach((mockFn) => {
      if (typeof mockFn === 'function' && 'mockReset' in mockFn) {
        ;(mockFn as any).mockReset()
      }
    })
    mockEncryptKey.mockClear()
    mockDecryptKey.mockClear()

    // Restore implementations after clearing
    mockEncryptKey.mockImplementation(async (plaintext: string) => ({
      encrypted: `encrypted_${plaintext}`,
      iv: 'mock-iv',
      tag: 'mock-tag',
      salt: 'mock-salt'
    }))

    mockDecryptKey.mockImplementation(async (data: any) => {
      if (data.encrypted && data.encrypted.startsWith('encrypted_')) {
        return data.encrypted.replace('encrypted_', '')
      }
      if (data.encryptedValue) {
        return data.encryptedValue.replace('encrypted_', '')
      }
      return 'decrypted_value'
    })

    // Create service instance
    service = createProviderKeyService()
  })

  describe('Key Creation and Retrieval', () => {
    test('createKey inserts new provider key', async () => {
      const input = {
        provider: 'openai',
        key: 'test-api-key',
        name: 'openai',
        isDefault: false
      }

      const createdKey: ProviderKey = {
        id: 1,
        name: input.name,
        provider: input.provider,
        keyName: input.name,
        encryptedValue: 'encrypted_test-api-key',
        key: 'encrypted_test-api-key',
        encrypted: true,
        iv: 'mock-iv',
        tag: 'mock-tag',
        salt: 'mock-salt',
        baseUrl: null,
        customHeaders: {},
        isDefault: false,
        isActive: true,
        environment: 'production',
        description: null,
        expiresAt: null,
        lastUsed: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockRepository.findWhere.mockResolvedValue([]) // No existing default keys
      mockRepository.create.mockResolvedValue(createdKey)

      const result = await service.createKey(input)

      expect(result.id).toBe(1)
      expect(result.provider).toBe(input.provider)
      expect(result.key).toBe('test****-key') // Service returns masked key for security
      expect(result.encrypted).toBe(true)
      expect(result.iv).toBe('mock-iv')
      expect(result.tag).toBe('mock-tag')
      expect(result.salt).toBe('mock-salt')

      expect(mockEncryptKey).toHaveBeenCalledWith('test-api-key')
      expect(mockRepository.create).toHaveBeenCalled()
    })

    test('getKeyById returns key or null if not found', async () => {
      const testKey: ProviderKey = {
        id: 1,
        name: 'test-key',
        provider: 'get_by_id_test',
        keyName: 'get_by_id_test',
        encryptedValue: 'encrypted_decrypted_value',
        key: 'encrypted_decrypted_value',
        encrypted: true,
        iv: 'test-iv',
        tag: 'test-tag',
        salt: 'test-salt',
        baseUrl: null,
        customHeaders: {},
        isDefault: false,
        isActive: true,
        environment: 'production',
        description: null,
        expiresAt: null,
        lastUsed: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // Test found case
      mockRepository.getById.mockResolvedValueOnce(testKey)

      const found = await service.getKeyById(1)
      expect(found).toBeDefined()
      expect(found?.id).toBe(1)
      expect(found?.key).toBe('decrypted_value') // Should be decrypted
      expect(mockDecryptKey).toHaveBeenCalled()

      // Test not found case
      mockRepository.getById.mockResolvedValueOnce(null)

      const missing = await service.getKeyById(9999)
      expect(missing).toBeNull()
    })
  })

  describe('Key Updates', () => {
    test('updateKey modifies existing row and updates timestamp', async () => {
      const existingKey: ProviderKey = {
        id: 1,
        name: 'initial_provider',
        provider: 'initial_provider',
        keyName: 'initial_provider',
        encryptedValue: 'encrypted_initial_key',
        key: 'encrypted_initial_key',
        encrypted: true,
        iv: 'old-iv',
        tag: 'old-tag',
        salt: 'old-salt',
        baseUrl: null,
        customHeaders: {},
        isDefault: false,
        isActive: true,
        environment: 'production',
        description: null,
        expiresAt: null,
        lastUsed: null,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000
      }

      const updatedKey: ProviderKey = {
        ...existingKey,
        key: 'encrypted_updated_key',
        provider: 'new_provider_name',
        updatedAt: Date.now()
      }

      mockRepository.getById.mockResolvedValue(existingKey)
      mockRepository.findWhere.mockResolvedValue([]) // No other default keys
      mockRepository.update.mockResolvedValue(updatedKey)

      const updates = { key: 'updated_key', provider: 'new_provider_name' }
      const result = await service.updateKey(1, updates)

      expect(result).toBeDefined()
      expect(result.id).toBe(1)
      expect(result.key).toBe('updated_key') // Should return the new key value directly
      expect(result.provider).toBe('new_provider_name')
      expect(result.updatedAt).toBe(updatedKey.updatedAt)

      expect(mockRepository.getById).toHaveBeenCalledWith(1)
      expect(mockEncryptKey).toHaveBeenCalledWith('updated_key')
      expect(mockRepository.update).toHaveBeenCalled()
    })

    test('updateKey throws ApiError if key not found', async () => {
      mockRepository.getById.mockResolvedValue(null)

      await expect(service.updateKey(9999, { key: 'some_key' })).rejects.toThrow('Provider Key with ID 9999 not found')

      expect(mockRepository.getById).toHaveBeenCalledWith(9999)
    })
  })

  describe('Key Deletion', () => {
    test('deleteKey removes row, returns boolean indicating success', async () => {
      // Test successful deletion
      mockRepository.exists.mockResolvedValueOnce(true)
      mockRepository.delete.mockResolvedValueOnce(true)

      const result1 = await service.deleteKey(1)
      expect(result1).toBe(true)
      expect(mockRepository.exists).toHaveBeenCalledWith(1)
      expect(mockRepository.delete).toHaveBeenCalledWith(1)

      // Test deletion of non-existent key
      mockRepository.exists.mockResolvedValueOnce(false)

      const result2 = await service.deleteKey(9999)
      expect(result2).toBe(false)
      expect(mockRepository.exists).toHaveBeenCalledWith(9999)
    })
  })

  describe('Key Masking and Censoring', () => {
    test('key masking logic handles edge cases correctly', async () => {
      const keys: ProviderKey[] = [
        {
          id: 1,
          name: 'very-short',
          provider: 'test1',
          keyName: 'very-short',
          encryptedValue: 'encrypted_abc',
          key: 'encrypted_abc',
          encrypted: true,
          iv: 'iv1',
          tag: 'tag1',
          salt: 'salt1',
          baseUrl: null,
          customHeaders: {},
          isDefault: false,
          isActive: true,
          environment: 'production',
          description: null,
          expiresAt: null,
          lastUsed: null,
          createdAt: Date.now() - 4000,
          updatedAt: Date.now() - 4000
        },
        {
          id: 2,
          name: 'short',
          provider: 'test2',
          keyName: 'short',
          encryptedValue: 'encrypted_abcdefgh',
          key: 'encrypted_abcdefgh',
          encrypted: true,
          iv: 'iv2',
          tag: 'tag2',
          salt: 'salt2',
          baseUrl: null,
          customHeaders: {},
          isDefault: false,
          isActive: true,
          environment: 'production',
          description: null,
          expiresAt: null,
          lastUsed: null,
          createdAt: Date.now() - 3000,
          updatedAt: Date.now() - 3000
        },
        {
          id: 3,
          name: 'medium',
          provider: 'test3',
          keyName: 'medium',
          encryptedValue: 'encrypted_abcdefghijk',
          key: 'encrypted_abcdefghijk',
          encrypted: true,
          iv: 'iv3',
          tag: 'tag3',
          salt: 'salt3',
          baseUrl: null,
          customHeaders: {},
          isDefault: false,
          isActive: true,
          environment: 'production',
          description: null,
          expiresAt: null,
          lastUsed: null,
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000
        },
        {
          id: 4,
          name: 'long',
          provider: 'test4',
          keyName: 'long',
          encryptedValue: 'encrypted_sk-1234567890abcdef1234567890abcdef',
          key: 'encrypted_sk-1234567890abcdef1234567890abcdef',
          encrypted: true,
          iv: 'iv4',
          tag: 'tag4',
          salt: 'salt4',
          baseUrl: null,
          customHeaders: {},
          isDefault: false,
          isActive: true,
          environment: 'production',
          description: null,
          expiresAt: null,
          lastUsed: null,
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000
        }
      ]

      mockRepository.getAll.mockResolvedValue(keys)

      const censoredList = await service.listKeysCensoredKeys()
      expect(censoredList).toHaveLength(4)

      // All encrypted keys should show as ********
      const veryShortResult = censoredList.find((k) => k.name === 'very-short')
      const shortResult = censoredList.find((k) => k.name === 'short')
      const mediumResult = censoredList.find((k) => k.name === 'medium')
      const longResult = censoredList.find((k) => k.name === 'long')

      expect(veryShortResult?.key).toBe('********')
      expect(shortResult?.key).toBe('********')
      expect(mediumResult?.key).toBe('********')
      expect(longResult?.key).toBe('********')
    })
  })
})
