/**
 * Test data fixtures for chat tests
 * Provides sample data for consistent testing
 */

export const testChats = {
  simple: {
    title: 'Test Chat Simple',
    projectId: 1
  },
  
  withContext: {
    title: 'Test Chat with Context',
    projectId: 1,
    systemMessage: 'You are a helpful coding assistant'
  },
  
  technical: {
    title: 'Technical Discussion',
    projectId: 1,
    systemMessage: 'You are an expert software engineer'
  }
}

export const testMessages = {
  simple: [
    {
      role: 'user' as const,
      content: 'Hello, how are you?'
    },
    {
      role: 'assistant' as const,
      content: 'Hello! I\'m doing well, thank you for asking. How can I help you today?'
    }
  ],
  
  coding: [
    {
      role: 'user' as const,
      content: 'Can you help me write a function to calculate fibonacci numbers?'
    },
    {
      role: 'assistant' as const,
      content: `Sure! Here's a function to calculate Fibonacci numbers:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  
  let prev = 0;
  let current = 1;
  
  for (let i = 2; i <= n; i++) {
    const temp = current;
    current = prev + current;
    prev = temp;
  }
  
  return current;
}
\`\`\`

This iterative approach is more efficient than recursion for larger numbers.`
    }
  ],
  
  withThinkBlock: [
    {
      role: 'user' as const,
      content: 'What is 2 + 2?'
    },
    {
      role: 'assistant' as const,
      content: `<think>
The user is asking a simple arithmetic question. 2 + 2 equals 4.
This is a basic addition problem.
</think>

2 + 2 equals 4.`
    }
  ],
  
  longConversation: [
    {
      role: 'user' as const,
      content: 'I need help planning a web application'
    },
    {
      role: 'assistant' as const,
      content: 'I\'d be happy to help you plan a web application! To get started, could you tell me more about what kind of application you have in mind?'
    },
    {
      role: 'user' as const,
      content: 'It\'s a task management app for teams'
    },
    {
      role: 'assistant' as const,
      content: 'Great! A task management app for teams. Let me help you outline the key components and features you\'ll need.'
    },
    {
      role: 'user' as const,
      content: 'What technologies would you recommend?'
    },
    {
      role: 'assistant' as const,
      content: 'For a modern task management app, I\'d recommend a React frontend with TypeScript, a Node.js backend with Express or Fastify, and PostgreSQL for the database.'
    }
  ]
}

export const testProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    models: [
      { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000 }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    enabled: true,
    models: [
      { id: 'claude-3-opus', name: 'Claude 3 Opus', maxTokens: 200000 },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', maxTokens: 200000 },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', maxTokens: 200000 }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: true,
    models: [
      { id: 'openrouter/auto', name: 'Auto (Best)', maxTokens: 100000 },
      { id: 'meta-llama/llama-3.1-405b', name: 'Llama 3.1 405B', maxTokens: 32768 }
    ]
  }
]

export const testModelSettings = {
  default: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  
  creative: {
    temperature: 0.9,
    maxTokens: 8192,
    topP: 0.95,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1
  },
  
  precise: {
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.8,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  
  maxOutput: {
    temperature: 0.7,
    maxTokens: 100000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
}

export const errorScenarios = {
  networkError: {
    message: 'Failed to fetch',
    type: 'network'
  },
  
  rateLimitError: {
    message: 'Rate limit exceeded. Please try again later.',
    type: 'rate_limit'
  },
  
  authError: {
    message: 'Invalid API key or authentication failed',
    type: 'auth'
  },
  
  modelError: {
    message: 'Model not available or invalid model ID',
    type: 'model'
  },
  
  timeoutError: {
    message: 'Request timed out. Please try again.',
    type: 'timeout'
  }
}

export const testInputs = {
  short: 'Hello',
  
  medium: 'Can you explain how React hooks work and provide some examples?',
  
  long: `I'm working on a complex web application and need help with the architecture. 
The app needs to handle real-time updates, user authentication, file uploads, 
and integration with multiple third-party APIs. Can you help me design a scalable 
solution that can handle thousands of concurrent users?`,
  
  withCode: `Here's my current code:
\`\`\`javascript
function processData(data) {
  return data.map(item => item.value * 2)
}
\`\`\`
How can I make this more efficient?`,
  
  withFormatting: `Please help me with the following:
1. **First issue**: Error handling
2. *Second issue*: Performance optimization
3. \`Third issue\`: Code formatting

Can you address each point?`,
  
  multiline: `Line 1: This is the first line
Line 2: This is the second line
Line 3: This is the third line

Multiple paragraphs with spacing.`,
  
  specialCharacters: 'Test with special chars: @#$%^&*(){}[]|\\:";\'<>?,./`~',
  
  unicode: 'Test with emoji 😀 and unicode characters: 你好 مرحبا こんにちは'
}

/**
 * Helper function to get a random chat
 */
export function getRandomChat() {
  const chats = Object.values(testChats)
  return chats[Math.floor(Math.random() * chats.length)]
}

/**
 * Helper function to get random messages
 */
export function getRandomMessages(count: number = 2) {
  const allMessages = [
    ...testMessages.simple,
    ...testMessages.coding,
    ...testMessages.withThinkBlock
  ]
  
  const shuffled = [...allMessages].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

/**
 * Generate unique test chat
 */
export function generateUniqueChat(suffix?: string) {
  const timestamp = Date.now()
  const nameSuffix = suffix || timestamp.toString()
  
  return {
    title: `Test Chat ${nameSuffix}`,
    projectId: 1
  }
}

/**
 * Generate test message
 */
export function generateTestMessage(role: 'user' | 'assistant', length: 'short' | 'medium' | 'long' = 'medium') {
  const templates = {
    short: [
      'Hello',
      'Yes',
      'No',
      'Thanks',
      'Got it'
    ],
    medium: [
      'Can you help me with this?',
      'I understand. What about the other approach?',
      'That makes sense. Could you elaborate?',
      'Here\'s what I\'m trying to accomplish...',
      'Let me explain the problem in more detail.'
    ],
    long: [
      'I\'m working on a complex problem that involves multiple components and I need your help to understand the best approach.',
      'After considering your suggestion, I think we need to explore alternative solutions that might better fit our requirements.',
      'The current implementation has several issues that we need to address, including performance bottlenecks and maintainability concerns.'
    ]
  }
  
  const messages = templates[length]
  const content = messages[Math.floor(Math.random() * messages.length)]
  
  return {
    role,
    content
  }
}

/**
 * Create a complete test scenario
 */
export function createTestScenario() {
  return {
    chat: generateUniqueChat(),
    messages: getRandomMessages(4),
    provider: testProviders[0],
    model: testProviders[0].models[0],
    settings: testModelSettings.default
  }
}