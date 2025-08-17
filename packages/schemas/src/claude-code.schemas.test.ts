import { describe, test, expect } from 'bun:test'
import {
  ClaudeMessageSchema,
  ClaudeMessageLenientSchema,
  type ClaudeMessage,
  type ClaudeMessageLenient
} from './claude-code.schemas'

describe('Claude Code Schemas', () => {
  describe('ClaudeMessageSchema', () => {
    test('should accept system message type', () => {
      const message = {
        type: 'system',
        message: {
          role: 'system',
          content: 'System message content'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('system')
        expect(result.data.message?.role).toBe('system')
      }
    })

    test('should accept summary message type', () => {
      const message = {
        type: 'summary',
        message: {
          role: 'assistant',
          content: 'Summary content'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('summary')
      }
    })

    test('should accept null content', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: null
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.message?.content).toBe(null)
      }
    })

    test('should accept null values for optional fields', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Test content',
          id: null,
          model: null
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session',
        uuid: null,
        parentUuid: null,
        requestId: null,
        userType: null,
        cwd: null,
        version: null,
        gitBranch: null,
        tokensUsed: null,
        costUsd: null,
        durationMs: null,
        model: null
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should accept toolUseResult as string', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Test content'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session',
        toolUseResult: '{"oldTodos": [], "newTodos": []}'
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should accept toolUseResult as array', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Test content'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session',
        toolUseResult: [{ todo: 'test' }]
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should accept toolUseResult as null', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Test content'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session',
        toolUseResult: null
      }

      const result = ClaudeMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })
  })

  describe('ClaudeMessageLenientSchema', () => {
    test('should handle unknown message types', () => {
      const message = {
        type: 'unknown_type',
        message: {
          role: 'assistant',
          content: 'Test content'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const result = ClaudeMessageLenientSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should handle message as string', () => {
      const message = {
        type: 'assistant',
        message: 'This is a string message',
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const result = ClaudeMessageLenientSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should handle message as array', () => {
      const message = {
        type: 'assistant',
        message: ['item1', 'item2'],
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const result = ClaudeMessageLenientSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should handle missing required fields with defaults', () => {
      const message = {}

      const result = ClaudeMessageLenientSchema.safeParse(message)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('assistant')
        expect(result.data.sessionId).toBe('unknown')
        expect(typeof result.data.timestamp).toBe('string')
      }
    })

    test('should handle complex edge case with mixed types', () => {
      const message = {
        type: 'weird_type',
        message: {
          role: 'unknown_role',
          content: null,
          id: null,
          model: null
        },
        timestamp: null,
        sessionId: null,
        uuid: null,
        parentUuid: null,
        toolUseResult: 'not_json',
        tokensUsed: null,
        costUsd: null
      }

      const result = ClaudeMessageLenientSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('should preserve passthrough fields', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Test'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test',
        customField: 'custom_value',
        anotherField: { nested: 'data' }
      }

      const result = ClaudeMessageLenientSchema.safeParse(message)
      expect(result.success).toBe(true)
      if (result.success) {
        // Passthrough fields are preserved but not in the inferred type
        expect((result.data as any).customField).toBe('custom_value')
        expect((result.data as any).anotherField.nested).toBe('data')
      }
    })
  })

  describe('Edge cases that previously failed', () => {
    test('should handle system role with system type', () => {
      const message = {
        type: 'system',
        message: {
          role: 'system',
          content: 'System initialization message'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const strictResult = ClaudeMessageSchema.safeParse(message)
      const lenientResult = ClaudeMessageLenientSchema.safeParse(message)
      
      expect(strictResult.success).toBe(true)
      expect(lenientResult.success).toBe(true)
    })

    test('should handle summary type messages', () => {
      const message = {
        type: 'summary',
        message: {
          role: 'assistant',
          content: 'This is a summary of the conversation'
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session'
      }

      const strictResult = ClaudeMessageSchema.safeParse(message)
      const lenientResult = ClaudeMessageLenientSchema.safeParse(message)
      
      expect(strictResult.success).toBe(true)
      expect(lenientResult.success).toBe(true)
    })

    test('should handle null string fields', () => {
      const message = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Test content',
          id: null,
          model: null
        },
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session',
        uuid: null,
        parentUuid: null,
        requestId: null,
        userType: null,
        cwd: null,
        version: null,
        gitBranch: null
      }

      const strictResult = ClaudeMessageSchema.safeParse(message)
      expect(strictResult.success).toBe(true)
    })

    test('should handle array content in various formats', () => {
      const messages = [
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'text', text: 'World' }
            ]
          },
          timestamp: '2023-01-01T00:00:00Z',
          sessionId: 'test-session'
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: ['simple', 'array', 'content']
          },
          timestamp: '2023-01-01T00:00:00Z',
          sessionId: 'test-session'
        }
      ]

      for (const message of messages) {
        const lenientResult = ClaudeMessageLenientSchema.safeParse(message)
        expect(lenientResult.success).toBe(true)
      }
    })

    test('should handle top-level content field (system messages)', () => {
      const message = {
        type: 'system',
        content: 'System initialization message',
        timestamp: '2023-01-01T00:00:00Z',
        sessionId: 'test-session',
        isMeta: true,
        toolUseID: 'tool-123',
        level: 'info'
      }

      const strictResult = ClaudeMessageSchema.safeParse(message)
      const lenientResult = ClaudeMessageLenientSchema.safeParse(message)
      
      expect(strictResult.success).toBe(true)
      expect(lenientResult.success).toBe(true)
      
      if (strictResult.success) {
        expect(strictResult.data.content).toBe('System initialization message')
        expect(strictResult.data.isMeta).toBe(true)
        expect(strictResult.data.toolUseID).toBe('tool-123')
        expect(strictResult.data.level).toBe('info')
      }
    })
  })
})