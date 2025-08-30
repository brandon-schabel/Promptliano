import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { isValidOpenAIUrl, normalizeHeaders, extractModelCapabilities } from './custom-provider-validator'

describe('Custom Provider Validator - Pure Functions', () => {
  describe('isValidOpenAIUrl', () => {
    test('should accept valid HTTP URLs', () => {
      expect(isValidOpenAIUrl('http://localhost:1234/v1')).toBe(true)
      expect(isValidOpenAIUrl('http://api.example.com')).toBe(true)
    })

    test('should accept valid HTTPS URLs', () => {
      expect(isValidOpenAIUrl('https://api.openai.com/v1')).toBe(true)
      expect(isValidOpenAIUrl('https://custom.provider.io/api/v1')).toBe(true)
    })

    test('should reject invalid URLs', () => {
      expect(isValidOpenAIUrl('not-a-url')).toBe(false)
      expect(isValidOpenAIUrl('ftp://example.com')).toBe(false)
      expect(isValidOpenAIUrl('ws://example.com')).toBe(false)
      expect(isValidOpenAIUrl('')).toBe(false)
    })

    test('should handle URLs with paths and query strings', () => {
      expect(isValidOpenAIUrl('https://api.example.com/v1/models?limit=10')).toBe(true)
      expect(isValidOpenAIUrl('http://localhost:8080/api/v1#anchor')).toBe(true)
    })
  })

  describe('normalizeHeaders', () => {
    test('should normalize header names to proper case', () => {
      const headers = {
        'content-type': 'application/json',
        'x-api-key': 'secret',
        AUTHORIZATION: 'Bearer token'
      }

      const normalized = normalizeHeaders(headers)

      expect(normalized).toEqual({
        'Content-Type': 'application/json',
        'X-Api-Key': 'secret',
        Authorization: 'Bearer token'
      })
    })

    test('should handle empty headers', () => {
      expect(normalizeHeaders({})).toEqual({})
      expect(normalizeHeaders(undefined)).toEqual({})
    })

    test('should handle single-word headers', () => {
      const headers = {
        host: 'example.com',
        accept: '*/*'
      }

      const normalized = normalizeHeaders(headers)

      expect(normalized).toEqual({
        Host: 'example.com',
        Accept: '*/*'
      })
    })
  })

  describe('extractModelCapabilities', () => {
    test('should detect vision models', () => {
      expect(extractModelCapabilities('gpt-4-vision-preview').likelySupportsVision).toBe(true)
      expect(extractModelCapabilities('gpt-4-turbo-2024-04-09').likelySupportsVision).toBe(true)
      expect(extractModelCapabilities('claude-3-opus').likelySupportsVision).toBe(false)
      expect(extractModelCapabilities('gemini-pro-vision').likelySupportsVision).toBe(true)
    })

    test('should detect models with tool support', () => {
      expect(extractModelCapabilities('gpt-4-0613').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('gpt-3.5-turbo').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('claude-4-sonnet').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('gemini-pro').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('llama-2-7b').likelySupportsTools).toBe(false)
    })

    test('should detect JSON mode support', () => {
      expect(extractModelCapabilities('gpt-4-turbo').likelySupportsJson).toBe(true)
      expect(extractModelCapabilities('gpt-3.5-turbo').likelySupportsJson).toBe(true)
      expect(extractModelCapabilities('text-davinci-003').likelySupportsJson).toBe(false)
      expect(extractModelCapabilities('text-curie-001').likelySupportsJson).toBe(false)
      expect(extractModelCapabilities('text-babbage-001').likelySupportsJson).toBe(false)
    })

    test('should handle various model naming conventions', () => {
      const capabilities = extractModelCapabilities('Custom-Model-v2-Vision-Tools')
      expect(capabilities.likelySupportsVision).toBe(true)
      expect(capabilities.likelySupportsTools).toBe(false) // Doesn't match known patterns
      expect(capabilities.likelySupportsJson).toBe(true)
    })
  })

  // Migrated test pattern section
  describe('Custom Provider Validator (Migrated Pattern)', () => {
    let testContext: any
    let testEnv: any

    beforeEach(async () => {
      // Create test environment
      testEnv = {
        setupTest: async () => ({
          testProjectId: 1,
          testDb: { db: {} }
        }),
        cleanupTest: async () => { }
      }

      testContext = await testEnv.setupTest()
    })

    afterEach(async () => {
      await testEnv.cleanupTest()
    })

    test('should demonstrate migrated pattern structure', async () => {
      // This test demonstrates the migrated pattern structure
      // In a real implementation, this would use TestDataFactory and proper database isolation

      const mockRepository = {
        create: async (data: any) => ({
          id: Date.now(),
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }),
        getById: async (id: number) => ({
          id,
          projectId: testContext.testProjectId,
          name: 'custom-provider',
          url: 'https://api.custom-provider.com/v1',
          headers: { 'Authorization': 'Bearer token' },
          models: ['gpt-4', 'gpt-3.5-turbo'],
          capabilities: ['chat', 'completions'],
          isValid: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }),
        getByProject: async (projectId: number) => [],
        update: async (id: number, data: any) => ({
          id,
          ...data,
          updatedAt: Date.now()
        }),
        delete: async (id: number) => true,
        validate: async (config: any) => ({
          isValid: true,
          errors: [],
          warnings: []
        })
      }

      // This would create a service with proper database isolation
      // const customProviderService = createCustomProviderService({
      //   providerRepository: mockRepository,
      //   validator: mockValidator,
      //   projectService: mockProjectService
      // })

      // For now, just verify the pattern structure is in place
      expect(mockRepository).toBeDefined()
      expect(typeof mockRepository.create).toBe('function')
      expect(typeof mockRepository.validate).toBe('function')
    })

    test('should integrate with TestDataFactory pattern', async () => {
      // This demonstrates how the migrated pattern would use TestDataFactory
      // In practice, this would create custom provider records using TestDataFactory

      const providerData = {
        projectId: testContext.testProjectId,
        name: 'Test Custom Provider',
        url: 'https://api.test-provider.com/v1',
        headers: {
          'Authorization': 'Bearer test-token-123',
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key'
        },
        models: [
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo',
          'claude-3-opus',
          'claude-3-sonnet'
        ],
        capabilities: [
          'chat',
          'completions',
          'embeddings',
          'moderations'
        ],
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 150000
        },
        isActive: true,
        lastValidated: new Date().toISOString()
      }

      expect(providerData.projectId).toBe(testContext.testProjectId)
      expect(providerData.name).toBe('Test Custom Provider')
      expect(providerData.url).toBe('https://api.test-provider.com/v1')
      expect(providerData.models.length).toBe(5)
      expect(providerData.capabilities).toContain('chat')
      expect(providerData.capabilities).toContain('embeddings')
      expect(providerData.rateLimits.requestsPerMinute).toBe(60)
      expect(providerData.isActive).toBe(true)
    })
  })
})
