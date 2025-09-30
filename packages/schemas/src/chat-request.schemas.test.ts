import { describe, it, expect } from 'bun:test'
import { AiChatStreamRequestSchema } from './chat-request.schemas'

describe('AiChatStreamRequestSchema', () => {
  describe('Basic validation', () => {
    it('should accept valid request with all required fields', () => {
      const validRequest = {
        chatId: 1,
        userMessage: 'Hello, world!'
      }

      const result = AiChatStreamRequestSchema.parse(validRequest)
      expect(result.chatId).toBe(1)
      expect(result.userMessage).toBe('Hello, world!')
      expect(result.includeSystemPrompt).toBe(true) // Default value
    })

    it('should accept valid request with all fields', () => {
      const fullRequest = {
        chatId: 42,
        userMessage: 'Complete message',
        systemMessage: 'You are a helpful assistant',
        tempId: 'temp-123',
        enableChatAutoNaming: true,
        toolsEnabled: true,
        toolChoice: 'auto' as const,
        maxMessagesToInclude: 50,
        includeSystemPrompt: false,
        options: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
          frequencyPenalty: 0.5,
          presencePenalty: 0.3,
          stream: true
        }
      }

      const result = AiChatStreamRequestSchema.parse(fullRequest)
      expect(result.chatId).toBe(42)
      expect(result.maxMessagesToInclude).toBe(50)
      expect(result.includeSystemPrompt).toBe(false)
    })

    it('should reject invalid chatId', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 0, // Must be positive
          userMessage: 'Hello'
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: -1, // Must be positive
          userMessage: 'Hello'
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 'not-a-number',
          userMessage: 'Hello'
        })
      ).toThrow()
    })

    it('should reject empty userMessage', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: '' // Must have at least 1 character
        })
      ).toThrow()
    })

    it('should reject missing required fields', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1
          // Missing userMessage
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          userMessage: 'Hello'
          // Missing chatId
        })
      ).toThrow()
    })
  })

  describe('maxMessagesToInclude validation', () => {
    it('should accept valid message counts', () => {
      const validCounts = [1, 10, 25, 50, 75, 100]

      validCounts.forEach((count) => {
        const result = AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: count
        })
        expect(result.maxMessagesToInclude).toBe(count)
      })
    })

    it('should accept undefined maxMessagesToInclude (include all messages)', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello'
        // maxMessagesToInclude is optional
      })
      expect(result.maxMessagesToInclude).toBeUndefined()
    })

    it('should reject maxMessagesToInclude below minimum (1)', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 0
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: -5
        })
      ).toThrow()
    })

    it('should reject maxMessagesToInclude above maximum (100)', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 101
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 1000
        })
      ).toThrow()
    })

    it('should reject non-integer maxMessagesToInclude', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 25.5
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 'not-a-number'
        })
      ).toThrow()
    })

    it('should handle boundary values correctly', () => {
      // Min boundary
      const minResult = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        maxMessagesToInclude: 1
      })
      expect(minResult.maxMessagesToInclude).toBe(1)

      // Max boundary
      const maxResult = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        maxMessagesToInclude: 100
      })
      expect(maxResult.maxMessagesToInclude).toBe(100)
    })
  })

  describe('includeSystemPrompt validation', () => {
    it('should default to true when not provided', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello'
      })
      expect(result.includeSystemPrompt).toBe(true)
    })

    it('should accept explicit true value', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        includeSystemPrompt: true
      })
      expect(result.includeSystemPrompt).toBe(true)
    })

    it('should accept explicit false value', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        includeSystemPrompt: false
      })
      expect(result.includeSystemPrompt).toBe(false)
    })

    it('should reject non-boolean values', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          includeSystemPrompt: 'yes'
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          includeSystemPrompt: 1
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          includeSystemPrompt: null
        })
      ).toThrow()
    })
  })

  describe('Combined context control fields', () => {
    it('should work with both maxMessagesToInclude and includeSystemPrompt', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        maxMessagesToInclude: 25,
        includeSystemPrompt: false
      })
      expect(result.maxMessagesToInclude).toBe(25)
      expect(result.includeSystemPrompt).toBe(false)
    })

    it('should handle all context control scenarios', () => {
      // Scenario 1: Limit messages, include system prompt
      const scenario1 = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        maxMessagesToInclude: 10,
        includeSystemPrompt: true
      })
      expect(scenario1.maxMessagesToInclude).toBe(10)
      expect(scenario1.includeSystemPrompt).toBe(true)

      // Scenario 2: Limit messages, exclude system prompt
      const scenario2 = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        maxMessagesToInclude: 10,
        includeSystemPrompt: false
      })
      expect(scenario2.maxMessagesToInclude).toBe(10)
      expect(scenario2.includeSystemPrompt).toBe(false)

      // Scenario 3: No limit, exclude system prompt
      const scenario3 = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        includeSystemPrompt: false
      })
      expect(scenario3.maxMessagesToInclude).toBeUndefined()
      expect(scenario3.includeSystemPrompt).toBe(false)

      // Scenario 4: No limit, include system prompt (defaults)
      const scenario4 = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello'
      })
      expect(scenario4.maxMessagesToInclude).toBeUndefined()
      expect(scenario4.includeSystemPrompt).toBe(true)
    })
  })

  describe('Options validation', () => {
    it('should accept valid options', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        options: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.8,
          maxTokens: 2000,
          topP: 0.95,
          frequencyPenalty: 0.2,
          presencePenalty: 0.1,
          stream: true
        }
      })
      expect(result.options?.provider).toBe('openai')
      expect(result.options?.temperature).toBe(0.8)
    })

    it('should reject invalid temperature values', () => {
      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          options: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: -1 // Must be >= 0
          }
        })
      ).toThrow()

      expect(() =>
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          options: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 3 // Must be <= 2
          }
        })
      ).toThrow()
    })

    it('should work with context fields and options combined', () => {
      const result = AiChatStreamRequestSchema.parse({
        chatId: 1,
        userMessage: 'Hello',
        maxMessagesToInclude: 30,
        includeSystemPrompt: false,
        options: {
          provider: 'anthropic',
          model: 'claude-3',
          temperature: 0.7,
          maxTokens: 4096
        }
      })
      expect(result.maxMessagesToInclude).toBe(30)
      expect(result.includeSystemPrompt).toBe(false)
      expect(result.options?.provider).toBe('anthropic')
      expect(result.options?.maxTokens).toBe(4096)
    })
  })

  describe('Type inference', () => {
    it('should properly infer TypeScript types', () => {
      const validRequest = {
        chatId: 1,
        userMessage: 'Test message',
        maxMessagesToInclude: 25,
        includeSystemPrompt: false
      }

      const parsed = AiChatStreamRequestSchema.parse(validRequest)

      // These should compile without TypeScript errors
      const chatId: number = parsed.chatId
      const message: string = parsed.userMessage
      const maxMessages: number | undefined = parsed.maxMessagesToInclude
      const includeSystem: boolean = parsed.includeSystemPrompt

      expect(chatId).toBe(1)
      expect(message).toBe('Test message')
      expect(maxMessages).toBe(25)
      expect(includeSystem).toBe(false)
    })
  })

  describe('Error messages', () => {
    it('should provide clear error messages for validation failures', () => {
      try {
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 150 // Above maximum
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('100')
      }

      try {
        AiChatStreamRequestSchema.parse({
          chatId: 1,
          userMessage: 'Hello',
          maxMessagesToInclude: 0 // Below minimum
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('1')
      }
    })
  })
})