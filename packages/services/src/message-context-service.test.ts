/**
 * Message Context Service Tests - Comprehensive Test Coverage
 * Tests message limiting, token calculation, and context window management
 *
 * Testing approach:
 * - Pure function testing (no database needed)
 * - Mock gpt-tokenizer for isolated testing
 * - Comprehensive edge cases and error scenarios
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { Message as AIMessage } from 'ai'

// Mock gpt-tokenizer before importing the service
const mockCountTokens = mock((messages: any[]) => {
  // Simulate token counting: ~4 chars per token
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return total + Math.ceil(content.length / 4)
  }, 0)
})

mock.module('gpt-tokenizer/model/gpt-4o', () => ({
  countTokens: mockCountTokens
}))

// Now import the service
import { createMessageContextService } from './message-context-service'
import type { MessageContextOptions } from './message-context-service'

// Test data factory
function createTestMessage(role: 'user' | 'assistant' | 'system', content: string): AIMessage {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: new Date()
  }
}

function createTestMessages(count: number): AIMessage[] {
  const messages: AIMessage[] = []
  for (let i = 0; i < count; i++) {
    messages.push(
      createTestMessage('user', `User message ${i}: This is a test message with some content.`),
      createTestMessage('assistant', `Assistant response ${i}: Here is my response to your message.`)
    )
  }
  return messages
}

function createConversationWithSystem(): AIMessage[] {
  return [
    createTestMessage('system', 'You are a helpful AI assistant. Always be polite and accurate.'),
    createTestMessage('user', 'Hello, how are you?'),
    createTestMessage('assistant', 'I am doing well, thank you for asking!'),
    createTestMessage('user', 'Can you help me with a task?'),
    createTestMessage('assistant', 'Of course! I would be happy to help you.')
  ]
}

describe('MessageContextService - Unit Tests (Isolated)', () => {
  let service: ReturnType<typeof createMessageContextService>

  beforeEach(() => {
    mockCountTokens.mockClear()
    service = createMessageContextService()
  })

  describe('Basic Message Limiting', () => {
    test('should limit messages to maxMessages', () => {
      const messages = createTestMessages(50) // 100 messages (50 pairs)

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10
      })

      expect(result.messages.length).toBe(10)
      expect(result.metadata.totalMessages).toBe(100)
      expect(result.metadata.includedMessages).toBe(10)
      expect(result.metadata.excludedMessages).toBe(90)
    })

    test('should return all messages when maxMessages exceeds total', () => {
      const messages = createTestMessages(5) // 10 messages

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 50
      })

      expect(result.messages.length).toBe(10)
      expect(result.metadata.includedMessages).toBe(10)
      expect(result.metadata.excludedMessages).toBe(0)
    })

    test('should select most recent messages', () => {
      const messages = [
        createTestMessage('user', 'Message 1'),
        createTestMessage('user', 'Message 2'),
        createTestMessage('user', 'Message 3'),
        createTestMessage('user', 'Message 4'),
        createTestMessage('user', 'Message 5')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 2,
        includeSystemPrompt: false
      })

      expect(result.messages.length).toBe(2)
      expect(result.messages[0]?.content).toContain('Message 4')
      expect(result.messages[1]?.content).toContain('Message 5')
    })

    test('should use default maxMessages of 50', () => {
      const messages = createTestMessages(60) // 120 messages

      const result = service.selectMessagesForContext(messages, {})

      expect(result.messages.length).toBe(50)
      expect(result.metadata.includedMessages).toBe(50)
    })
  })

  describe('System Prompt Preservation', () => {
    test('should preserve system prompt by default', () => {
      const messages = createConversationWithSystem()

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 2,
        includeSystemPrompt: true
      })

      expect(result.messages[0]?.role).toBe('system')
      expect(result.messages[0]?.content).toContain('helpful AI assistant')
      expect(result.messages.length).toBe(3) // system + 2 conversation messages
    })

    test('should exclude system prompt when includeSystemPrompt is false', () => {
      const messages = createConversationWithSystem()

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 2,
        includeSystemPrompt: false
      })

      expect(result.messages[0]?.role).not.toBe('system')
      expect(result.messages.length).toBe(2)
    })

    test('should handle messages without system prompt', () => {
      const messages = createTestMessages(5) // No system prompt

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 4,
        includeSystemPrompt: true
      })

      expect(result.messages.length).toBe(4)
      expect(result.messages.some(m => m.role === 'system')).toBe(false)
    })

    test('should count system prompt tokens separately', () => {
      const messages = createConversationWithSystem()

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10,
        includeSystemPrompt: true
      })

      expect(result.metadata.systemPromptTokens).toBeGreaterThan(0)
      expect(result.metadata.userMessagesTokens).toBeGreaterThan(0)
      expect(result.metadata.assistantMessagesTokens).toBeGreaterThan(0)
    })
  })

  describe('User-Assistant Pair Preservation', () => {
    test('should start with user message when preserving pairs', () => {
      const messages = [
        createTestMessage('system', 'System prompt'),
        createTestMessage('assistant', 'Random assistant message'), // Should be excluded
        createTestMessage('user', 'User message 1'),
        createTestMessage('assistant', 'Assistant response 1'),
        createTestMessage('user', 'User message 2'),
        createTestMessage('assistant', 'Assistant response 2')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10,
        includeSystemPrompt: false,
        preserveUserAssistantPairs: true
      })

      // Should exclude leading assistant message
      expect(result.messages[0]?.role).toBe('user')
      expect(result.messages[0]?.content).toContain('User message 1')
    })

    test('should allow assistant-first messages when preserveUserAssistantPairs is false', () => {
      const messages = [
        createTestMessage('assistant', 'Initial assistant message'),
        createTestMessage('user', 'User message 1'),
        createTestMessage('assistant', 'Assistant response 1')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10,
        includeSystemPrompt: false,
        preserveUserAssistantPairs: false
      })

      expect(result.messages[0]?.role).toBe('assistant')
      expect(result.messages.length).toBe(3)
    })
  })

  describe('Token Calculation', () => {
    test('should calculate tokens for simple messages', () => {
      const messages = [
        createTestMessage('user', 'Hello world')
      ]

      const tokens = service.calculateTotalTokens(messages)

      expect(tokens).toBeGreaterThan(0)
      // Token counting uses either gpt-tokenizer or fallback estimation
      expect(tokens).toBeLessThan(20) // Sanity check
    })

    test('should calculate tokens for multiple messages', () => {
      const messages = createTestMessages(5) // 10 messages

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10
      })

      expect(result.metadata.totalTokens).toBeGreaterThan(0)
      // Allow small variance in token calculation
      const sum =
        result.metadata.systemPromptTokens +
        result.metadata.userMessagesTokens +
        result.metadata.assistantMessagesTokens
      expect(Math.abs(result.metadata.totalTokens - sum)).toBeLessThan(5)
    })

    test('should handle empty messages', () => {
      const messages = [
        createTestMessage('user', '')
      ]

      const tokens = service.estimateMessageTokens(messages[0]!)

      expect(tokens).toBeGreaterThanOrEqual(0)
    })

    test('should estimate tokens using character count fallback', () => {
      const message = createTestMessage('user', 'This is a test message with exactly forty chars')

      const tokens = service.estimateMessageTokens(message)

      // ~4 chars per token with density adjustment = ~12-16 tokens
      expect(tokens).toBeGreaterThan(8)
      expect(tokens).toBeLessThan(18)
    })

    test('should calculate tokens per message', () => {
      const messages = [
        createTestMessage('user', 'Short'),
        createTestMessage('user', 'This is a much longer message with more content'),
        createTestMessage('user', 'Medium length message')
      ]

      const tokensPerMessage = service.calculateTokensPerMessage(messages)

      expect(Object.keys(tokensPerMessage)).toHaveLength(3)
      expect(tokensPerMessage['message_0']).toBeLessThan(tokensPerMessage['message_1']!)
    })
  })

  describe('Token Limiting', () => {
    test('should trim messages to token limit', () => {
      const messages = createTestMessages(20) // 40 messages

      const result = service.selectMessagesForContext(messages, {
        maxContextTokens: 100,
        includeSystemPrompt: false
      })

      expect(result.metadata.totalTokens).toBeLessThanOrEqual(100)
      expect(result.messages.length).toBeLessThan(40)
    })

    test('should preserve system prompt even with token limit', () => {
      const messages = [
        createTestMessage('system', 'You are a helpful assistant'),
        ...createTestMessages(20) // 40 messages
      ]

      const result = service.selectMessagesForContext(messages, {
        maxContextTokens: 50,
        includeSystemPrompt: true
      })

      expect(result.messages[0]?.role).toBe('system')
      expect(result.metadata.systemPromptTokens).toBeGreaterThan(0)
      expect(result.metadata.totalTokens).toBeLessThanOrEqual(50)
    })

    test('should handle token limit smaller than system prompt', () => {
      const messages = [
        createTestMessage('system', 'A very long system prompt that contains many tokens and exceeds the limit'),
        createTestMessage('user', 'Hello'),
        createTestMessage('assistant', 'Hi')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxContextTokens: 10,
        includeSystemPrompt: true
      })

      // Should still include system prompt even if it exceeds limit
      expect(result.messages[0]?.role).toBe('system')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty message array', () => {
      const messages: AIMessage[] = []

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10
      })

      expect(result.messages.length).toBe(0)
      expect(result.metadata.totalMessages).toBe(0)
      expect(result.metadata.totalTokens).toBe(0)
    })

    test('should handle single message', () => {
      const messages = [
        createTestMessage('user', 'Single message')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10
      })

      expect(result.messages.length).toBe(1)
      expect(result.metadata.includedMessages).toBe(1)
      expect(result.metadata.excludedMessages).toBe(0)
    })

    test('should handle maxMessages of 1', () => {
      const messages = createTestMessages(10) // 20 messages

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 1,
        includeSystemPrompt: false,
        preserveUserAssistantPairs: false // Allow single message without pair
      })

      expect(result.messages.length).toBeGreaterThanOrEqual(1)
      expect(result.metadata.excludedMessages).toBeGreaterThan(0)
    })

    test('should handle messages with complex content', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' }
          ],
          createdAt: new Date()
        }
      ]

      const tokens = service.estimateMessageTokens(messages[0]!)

      expect(tokens).toBeGreaterThan(0)
    })

    test('should handle null/undefined content gracefully', () => {
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: undefined as any,
        createdAt: new Date()
      }

      const tokens = service.estimateMessageTokens(message)

      expect(tokens).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Metadata Accuracy', () => {
    test('should provide accurate metadata counts', () => {
      const messages = [
        createTestMessage('system', 'System prompt'),
        ...createTestMessages(10) // 20 messages
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 5,
        includeSystemPrompt: true,
        preserveUserAssistantPairs: false // Get exact count
      })

      expect(result.metadata.totalMessages).toBe(21)
      expect(result.metadata.includedMessages).toBe(6) // system + 5 messages
      expect(result.metadata.excludedMessages).toBe(15)
    })

    test('should categorize tokens by role', () => {
      const messages = [
        createTestMessage('system', 'System prompt'),
        createTestMessage('user', 'User message 1'),
        createTestMessage('assistant', 'Assistant response 1'),
        createTestMessage('user', 'User message 2'),
        createTestMessage('assistant', 'Assistant response 2')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 10,
        includeSystemPrompt: true
      })

      expect(result.metadata.systemPromptTokens).toBeGreaterThan(0)
      expect(result.metadata.userMessagesTokens).toBeGreaterThan(0)
      expect(result.metadata.assistantMessagesTokens).toBeGreaterThan(0)

      // Verify sum is close to total (allow small variance from different calculation methods)
      const sum =
        result.metadata.systemPromptTokens +
        result.metadata.userMessagesTokens +
        result.metadata.assistantMessagesTokens

      expect(Math.abs(sum - result.metadata.totalTokens)).toBeLessThan(10)
    })
  })

  describe('Performance Tests', () => {
    test('should handle large message arrays efficiently', () => {
      const messages = createTestMessages(500) // 1000 messages

      const startTime = Date.now()
      const result = service.selectMessagesForContext(messages, {
        maxMessages: 50
      })
      const endTime = Date.now()

      expect(result.messages.length).toBe(50)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in < 100ms
    })

    test('should handle token calculation for large messages', () => {
      const largeContent = 'A'.repeat(10000) // 10k characters
      const messages = [
        createTestMessage('user', largeContent)
      ]

      const startTime = Date.now()
      const tokens = service.calculateTotalTokens(messages)
      const endTime = Date.now()

      expect(tokens).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(100) // Should be reasonably fast
    })
  })

  describe('Options Validation', () => {
    test('should use default options when none provided', () => {
      const messages = createTestMessages(60) // 120 messages

      const result = service.selectMessagesForContext(messages)

      // Default maxMessages = 50, includeSystemPrompt = true, preserveUserAssistantPairs = true
      expect(result.messages.length).toBe(50)
    })

    test('should merge provided options with defaults', () => {
      const messages = createConversationWithSystem()

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 2
        // Other options should use defaults
      })

      expect(result.messages[0]?.role).toBe('system') // includeSystemPrompt defaults to true
      expect(result.messages.length).toBe(3) // system + 2 messages
    })
  })

  describe('Token Counting Fallback', () => {
    test('should fallback to estimation when gpt-tokenizer fails', () => {
      // Make mock throw error to trigger fallback
      mockCountTokens.mockImplementationOnce(() => {
        throw new Error('Token counting failed')
      })

      const messages = [
        createTestMessage('user', 'This message has approximately forty chars')
      ]

      const tokens = service.calculateTotalTokens(messages)

      // Should use estimation fallback (~10 tokens for 40 chars)
      expect(tokens).toBeGreaterThan(8)
      expect(tokens).toBeLessThan(15)
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle typical chat scenario', () => {
      const messages = [
        createTestMessage('system', 'You are a coding assistant'),
        createTestMessage('user', 'How do I write a function in TypeScript?'),
        createTestMessage('assistant', 'Here is an example: function add(a: number, b: number): number { return a + b }'),
        createTestMessage('user', 'Can you explain generics?'),
        createTestMessage('assistant', 'Generics allow you to write reusable code...'),
        createTestMessage('user', 'Show me an example'),
        createTestMessage('assistant', 'Here is a generic function: function identity<T>(arg: T): T { return arg }')
      ]

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 4,
        includeSystemPrompt: true,
        preserveUserAssistantPairs: true
      })

      // Should include system + last 4 messages
      expect(result.messages.length).toBe(5)
      expect(result.messages[0]?.role).toBe('system')
      expect(result.messages[1]?.role).toBe('user') // Start with user message
      expect(result.metadata.totalMessages).toBe(7)
    })

    test('should handle chat with context limit exceeded', () => {
      const messages = createTestMessages(100) // 200 messages

      const result = service.selectMessagesForContext(messages, {
        maxMessages: 20,
        maxContextTokens: 500
      })

      expect(result.messages.length).toBeLessThanOrEqual(20)
      expect(result.metadata.totalTokens).toBeLessThanOrEqual(500)
    })
  })
})