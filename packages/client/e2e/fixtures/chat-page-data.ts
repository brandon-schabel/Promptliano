export const ChatPageTestData = {
  // Test chat conversations
  testChats: [
    {
      id: 1,
      name: 'Code Review Session',
      messages: [
        { role: 'user', content: 'Please review this authentication function', timestamp: Date.now() - 3600000 },
        {
          role: 'assistant',
          content: "I'll analyze your authentication function for security and best practices...",
          timestamp: Date.now() - 3500000
        }
      ],
      provider: 'anthropic',
      model: 'claude-4-sonnet'
    },
    {
      id: 2,
      name: 'Bug Analysis Discussion',
      messages: [
        { role: 'user', content: "I'm encountering a strange bug in the login flow", timestamp: Date.now() - 7200000 },
        {
          role: 'assistant',
          content: 'Let me help you debug this login issue. Can you share the error message?',
          timestamp: Date.now() - 7100000
        }
      ],
      provider: 'openai',
      model: 'gpt-4'
    },
    {
      id: 3,
      name: 'Empty Chat',
      messages: [],
      provider: 'anthropic',
      model: 'claude-4-sonnet'
    }
  ],

  // Test providers and models
  testProviders: [
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: ['claude-3-opus-20240229', 'claude-4-sonnet', 'claude-3-haiku-20240307'],
      available: true
    },
    {
      id: 'openai',
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      available: true
    },
    {
      id: 'ollama',
      name: 'Ollama (Local)',
      models: ['llama3', 'codellama', 'mistral'],
      available: false // May not be available in test environment
    },
    {
      id: 'lmstudio',
      name: 'LM Studio (Local)',
      models: ['local-model'],
      available: false // May not be available in test environment
    }
  ],

  // Test model settings
  defaultSettings: {
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0
  },

  // Test messages for different scenarios
  testMessages: {
    simple: 'Hello, can you help me with a coding question?',
    complex: `I'm working on a React application and need help implementing user authentication. 
Here's my current setup:
- Using React 19 with TypeScript
- Backend API with JWT tokens
- Need to handle login, logout, and protected routes

Can you provide guidance on best practices?`,
    codeSnippet: `Please review this function:

\`\`\`typescript
function authenticate(username: string, password: string) {
  if (!username || !password) {
    throw new Error('Invalid credentials');
  }
  return jwt.sign({ username }, 'secret', { expiresIn: '1h' });
}
\`\`\``,
    longMessage: 'This is a very long message '.repeat(100) + 'that tests message handling with extensive content.'
  }
}
