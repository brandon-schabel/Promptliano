/**
 * Test Data Factories for Message Testing
 * Provides utilities for creating test messages and calculating expected tokens
 */

/**
 * Simple test message type for testing purposes
 * This is a simplified version for test data generation
 */
export type TestMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string | any[]
  createdAt: Date
  metadata?: Record<string, any>
}

/**
 * Create a test message with specified role and content
 */
export function createTestMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  options: {
    id?: string
    createdAt?: Date
    metadata?: Record<string, any>
  } = {}
): TestMessage {
  return {
    id: options.id || `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: options.createdAt || new Date(),
    ...options
  }
}

/**
 * Create multiple test messages
 * Creates alternating user/assistant pairs
 */
export function createTestMessages(count: number, messagePrefix = 'Test message'): TestMessage[] {
  const messages: TestMessage[] = []

  for (let i = 0; i < count; i++) {
    const isUser = i % 2 === 0
    messages.push(
      createTestMessage(
        isUser ? 'user' : 'assistant',
        `${messagePrefix} ${Math.floor(i / 2) + 1} - ${isUser ? 'user' : 'assistant'} turn`
      )
    )
  }

  return messages
}

/**
 * Create a conversation with system prompt
 */
export function createConversationWithSystem(turns: number = 3): TestMessage[] {
  const messages: TestMessage[] = [
    createTestMessage('system', 'You are a helpful AI assistant. Be concise and accurate.')
  ]

  for (let i = 0; i < turns; i++) {
    messages.push(
      createTestMessage('user', `User question ${i + 1}: Can you help me with this task?`),
      createTestMessage('assistant', `Assistant response ${i + 1}: Of course! I'd be happy to help you.`)
    )
  }

  return messages
}

/**
 * Create messages with varying lengths
 */
export function createMessagesWithVaryingLengths(): TestMessage[] {
  return [
    createTestMessage('user', 'Hi'),
    createTestMessage('assistant', 'Hello! How can I help you today?'),
    createTestMessage(
      'user',
      'This is a medium length message with some context about what I need help with.'
    ),
    createTestMessage(
      'assistant',
      'I understand. This is also a medium length response that provides helpful information.'
    ),
    createTestMessage(
      'user',
      'This is a very long message that contains a lot of detail and context about the problem I am trying to solve. '.repeat(
        5
      )
    ),
    createTestMessage(
      'assistant',
      'I see. Let me provide a comprehensive response that addresses all of your concerns in detail. '.repeat(5)
    )
  ]
}

/**
 * Create messages for testing token limits
 */
export function createLargeConversation(messageCount: number = 50): TestMessage[] {
  const messages: TestMessage[] = [
    createTestMessage('system', 'You are a helpful assistant specialized in technical topics.')
  ]

  for (let i = 0; i < messageCount; i++) {
    messages.push(
      createTestMessage(
        'user',
        `User question ${i + 1}: ${generateRandomContent(50 + Math.random() * 100)}`
      ),
      createTestMessage(
        'assistant',
        `Assistant response ${i + 1}: ${generateRandomContent(100 + Math.random() * 200)}`
      )
    )
  }

  return messages
}

/**
 * Generate random content of specified word count
 */
function generateRandomContent(wordCount: number): string {
  const words = [
    'the',
    'quick',
    'brown',
    'fox',
    'jumps',
    'over',
    'lazy',
    'dog',
    'hello',
    'world',
    'test',
    'message',
    'content',
    'example',
    'data'
  ]

  const result: string[] = []
  for (let i = 0; i < wordCount; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]!)
  }

  return result.join(' ')
}

/**
 * Calculate expected tokens for test messages
 * Uses simplified estimation: ~4 characters per token
 */
export function calculateExpectedTokens(messages: TestMessage[]): number {
  return messages.reduce((total, message) => {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    return total + Math.ceil(content.length / 4)
  }, 0)
}

/**
 * Calculate expected tokens by role
 */
export function calculateExpectedTokensByRole(messages: TestMessage[]): {
  system: number
  user: number
  assistant: number
  total: number
} {
  const result = { system: 0, user: 0, assistant: 0, total: 0 }

  messages.forEach((message) => {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    const tokens = Math.ceil(content.length / 4)

    // Only count tokens for recognized roles
    if (message.role === 'system' || message.role === 'user' || message.role === 'assistant') {
      result[message.role] += tokens
    }
    result.total += tokens
  })

  return result
}

/**
 * Create messages that will exceed token limit
 */
export function createLargeContextMessages(targetTokens: number = 10000): TestMessage[] {
  const messages: TestMessage[] = []
  let currentTokens = 0

  let i = 0
  while (currentTokens < targetTokens) {
    const messageLength = 500 + Math.random() * 500
    const content = generateRandomContent(Math.floor(messageLength / 5))
    const message = createTestMessage(i % 2 === 0 ? 'user' : 'assistant', content)

    messages.push(message)
    currentTokens += calculateExpectedTokens([message])
    i++
  }

  return messages
}

/**
 * Create minimal test conversation
 */
export function createMinimalConversation(): TestMessage[] {
  return [
    createTestMessage('user', 'Hello'),
    createTestMessage('assistant', 'Hi there!')
  ]
}

/**
 * Create conversation with specific token count
 * Useful for testing token thresholds
 */
export function createConversationWithTokenCount(targetTokens: number): TestMessage[] {
  const messages: TestMessage[] = []
  let currentTokens = 0

  let i = 0
  while (currentTokens < targetTokens) {
    // Create messages of varying sizes to reach target
    const remainingTokens = targetTokens - currentTokens
    const messageTokens = Math.min(remainingTokens, 50 + Math.random() * 100)
    const messageLength = messageTokens * 4 // ~4 chars per token

    const content = generateRandomContent(Math.floor(messageLength / 5))
    const message = createTestMessage(i % 2 === 0 ? 'user' : 'assistant', content)

    messages.push(message)
    currentTokens += calculateExpectedTokens([message])
    i++
  }

  return messages
}

/**
 * Create messages with complex content (array-based)
 */
export function createMessagesWithComplexContent(): TestMessage[] {
  return [
    {
      id: 'msg-complex-1',
      role: 'user',
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' }
      ] as any,
      createdAt: new Date()
    },
    {
      id: 'msg-complex-2',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi there!' }] as any,
      createdAt: new Date()
    }
  ]
}

/**
 * Verify token count is within expected range
 * Accounts for estimation vs. actual tokenization differences
 */
export function expectTokensInRange(actual: number, expected: number, tolerancePercent: number = 20) {
  const minExpected = expected * (1 - tolerancePercent / 100)
  const maxExpected = expected * (1 + tolerancePercent / 100)

  return {
    min: minExpected,
    max: maxExpected,
    isInRange: actual >= minExpected && actual <= maxExpected,
    actual,
    expected
  }
}