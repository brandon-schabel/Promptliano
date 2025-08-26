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

describe('Provider Key Service Encryption', () => {
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

  test('createKey encrypts the API key', async () => {
    const keyData = {
      name: 'Test Key',
      provider: 'openai',
      key: 'sk-test-12345'
    }

    const createdKey: ProviderKey = {
      id: 1,
      name: keyData.name,
      provider: keyData.provider,
      keyName: keyData.name,
      encryptedValue: 'encrypted_sk-test-12345',
      key: 'encrypted_sk-test-12345',
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

    const result = await service.createKey(keyData)

    // Check that the key is marked as encrypted
    expect(result.encrypted).toBe(true)
    expect(result.iv).toBeDefined()
    expect(result.tag).toBeDefined()
    expect(result.salt).toBeDefined()

    // The API returns decrypted keys for developer convenience
    expect(result.key).toBe(keyData.key)

    expect(mockEncryptKey).toHaveBeenCalledWith('sk-test-12345')
    expect(mockRepository.create).toHaveBeenCalled()
  })

  test('getKeyById decrypts the API key', async () => {
    const keyData = {
      name: 'Test Key',
      provider: 'openai',
      key: 'sk-test-12345'
    }

    const storedKey: ProviderKey = {
      id: 1,
      name: keyData.name,
      provider: keyData.provider,
      keyName: keyData.name,
      encryptedValue: 'encrypted_sk-test-12345',
      key: 'encrypted_sk-test-12345',
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

    mockRepository.getById.mockResolvedValue(storedKey)

    const result = await service.getKeyById(1)

    expect(result).not.toBeNull()
    expect(result?.key).toBe(keyData.key) // Should be decrypted
    expect(mockDecryptKey).toHaveBeenCalled()
  })

  test('listKeysUncensored decrypts all keys', async () => {
    const keys = [
      { name: 'Key 1', provider: 'openai', key: 'sk-test-111' },
      { name: 'Key 2', provider: 'anthropic', key: 'sk-ant-222' },
      { name: 'Key 3', provider: 'openrouter', key: 'or-333' }
    ]

    const storedKeys: ProviderKey[] = keys.map((keyData, index) => ({
      id: index + 1,
      name: keyData.name,
      provider: keyData.provider,
      keyName: keyData.name,
      encryptedValue: `encrypted_${keyData.key}`,
      key: `encrypted_${keyData.key}`,
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
    }))

    mockRepository.getAll.mockResolvedValue(storedKeys)

    const result = await service.listKeysUncensored()

    expect(result).toHaveLength(3)

    for (let i = 0; i < keys.length; i++) {
      const listedKey = result.find((k) => k.name === keys[i].name)
      expect(listedKey?.key).toBe(keys[i].key)
    }
  })

  test('listKeysCensoredKeys masks the keys', async () => {
    const keyData = {
      name: 'Test Key',
      provider: 'openai',
      key: 'sk-test-12345678901234567890'
    }

    const storedKey: ProviderKey = {
      id: 1,
      name: keyData.name,
      provider: keyData.provider,
      keyName: keyData.name,
      encryptedValue: `encrypted_${keyData.key}`,
      key: `encrypted_${keyData.key}`,
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

    mockRepository.getAll.mockResolvedValue([storedKey])

    const result = await service.listKeysCensoredKeys()

    expect(result).toHaveLength(1)
    // Encrypted keys show generic mask
    expect(result[0].key).toBe('********')
    expect(result[0].key).not.toBe(keyData.key)
  })

  test('updateKey re-encrypts when key is changed', async () => {
    const originalKey = 'sk-test-original'
    const updatedKey = 'sk-test-updated'

    const existingKey: ProviderKey = {
      id: 1,
      name: 'Test Key',
      provider: 'openai',
      keyName: 'Test Key',
      encryptedValue: `encrypted_${originalKey}`,
      key: `encrypted_${originalKey}`,
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

    const updatedKeyResult: ProviderKey = {
      ...existingKey,
      key: `encrypted_${updatedKey}`,
      encryptedValue: `encrypted_${updatedKey}`,
      iv: 'mock-iv',
      tag: 'mock-tag',
      salt: 'mock-salt',
      updatedAt: Date.now()
    }

    mockRepository.getById.mockResolvedValue(existingKey)
    mockRepository.findWhere.mockResolvedValue([]) // No other default keys
    mockRepository.update.mockResolvedValue(updatedKeyResult)

    const result = await service.updateKey(1, {
      key: updatedKey
    })

    // Should have new encryption parameters
    expect(result.encrypted).toBe(true)
    expect(result.iv).not.toBe('old-iv')
    expect(result.salt).not.toBe('old-salt')

    // Should return decrypted key
    expect(result.key).toBe(updatedKey)

    expect(mockEncryptKey).toHaveBeenCalledWith(updatedKey)
    expect(mockRepository.update).toHaveBeenCalled()
  })

  test('handles mixed encrypted and unencrypted keys gracefully', async () => {
    // Mock keys with mixed encryption status
    const mixedKeys: ProviderKey[] = [
      {
        id: 1,
        name: 'Legacy Key',
        provider: 'openai',
        keyName: 'Legacy Key',
        encryptedValue: 'sk-plain-text-key',
        key: 'sk-plain-text-key',
        encrypted: false,
        iv: null,
        tag: null,
        salt: null,
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
        id: 2,
        name: 'New Key',
        provider: 'anthropic',
        keyName: 'New Key',
        encryptedValue: 'encrypted_sk-encrypted-key',
        key: 'encrypted_sk-encrypted-key',
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
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000
      }
    ]

    mockRepository.getAll.mockResolvedValue(mixedKeys)

    const result = await service.listKeysUncensored()

    expect(result).toHaveLength(2)

    const legacy = result.find((k) => k.name === 'Legacy Key')
    const newKey = result.find((k) => k.name === 'New Key')

    expect(legacy?.key).toBe('sk-plain-text-key')
    expect(newKey?.key).toBe('sk-encrypted-key')
  })
})
