export interface TestProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'custom'
  endpoint?: string
  apiKey?: string
  models?: string[]
  defaultModel?: string
  settings?: {
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
  }
}

export const testProviders = {
  // Local providers
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    type: 'ollama' as const,
    endpoint: 'http://localhost:11434',
    models: ['llama2', 'mistral', 'codellama'],
    defaultModel: 'llama2'
  },
  
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    type: 'lmstudio' as const,
    endpoint: 'http://localhost:1234/v1',
    models: ['local-model-1', 'local-model-2'],
    defaultModel: 'local-model-1'
  },
  
  // Cloud providers
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai' as const,
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-test-1234567890',
    models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview'],
    defaultModel: 'gpt-3.5-turbo',
    settings: {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0
    }
  },
  
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic' as const,
    endpoint: 'https://api.anthropic.com/v1',
    apiKey: 'sk-ant-test-1234567890',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    defaultModel: 'claude-3-sonnet',
    settings: {
      temperature: 0.5,
      maxTokens: 4096
    }
  },
  
  // Custom provider
  custom: {
    id: 'custom-llm',
    name: 'Custom LLM Server',
    type: 'custom' as const,
    endpoint: 'http://localhost:8080/v1',
    apiKey: 'custom-key-123',
    models: ['custom-model'],
    defaultModel: 'custom-model'
  }
}

export const invalidProviders = {
  missingEndpoint: {
    id: 'invalid-1',
    name: 'Missing Endpoint',
    type: 'custom' as const,
    apiKey: 'key-123'
  },
  
  invalidEndpoint: {
    id: 'invalid-2',
    name: 'Invalid Endpoint',
    type: 'custom' as const,
    endpoint: 'not-a-url',
    apiKey: 'key-123'
  },
  
  wrongPort: {
    id: 'invalid-3',
    name: 'Wrong Port',
    type: 'ollama' as const,
    endpoint: 'http://localhost:99999'
  }
}

export const testApiKeys = {
  valid: {
    openai: 'sk-test-valid-openai-key',
    anthropic: 'sk-ant-test-valid-anthropic-key'
  },
  invalid: {
    openai: 'invalid-openai-key',
    anthropic: 'invalid-anthropic-key'
  },
  malformed: {
    openai: 'sk-',
    anthropic: 'sk-ant-'
  }
}

export const testModels = {
  openai: [
    { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
    { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', description: 'Latest GPT-4' }
  ],
  
  anthropic: [
    { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Most powerful' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and light' }
  ],
  
  ollama: [
    { id: 'llama2', name: 'Llama 2', description: 'Meta\'s open model' },
    { id: 'mistral', name: 'Mistral', description: 'Efficient 7B model' },
    { id: 'codellama', name: 'Code Llama', description: 'Code-focused model' }
  ]
}

export const providerSettings = {
  default: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  
  creative: {
    temperature: 0.9,
    maxTokens: 4096,
    topP: 0.95,
    frequencyPenalty: 0.5,
    presencePenalty: 0.5
  },
  
  precise: {
    temperature: 0.3,
    maxTokens: 1024,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  
  coding: {
    temperature: 0.2,
    maxTokens: 8192,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
}

export const mockResponses = {
  ollama: {
    version: {
      status: 200,
      body: { version: '0.1.38' }
    },
    tags: {
      status: 200,
      body: {
        models: [
          { name: 'llama2:latest', size: 3825819519, modified_at: '2024-01-01T00:00:00Z' },
          { name: 'mistral:latest', size: 4109865155, modified_at: '2024-01-01T00:00:00Z' }
        ]
      }
    },
    generate: {
      status: 200,
      body: {
        model: 'llama2',
        response: 'Test response from Ollama',
        done: true
      }
    }
  },
  
  lmstudio: {
    models: {
      status: 200,
      body: {
        data: [
          { id: 'local-model-1', object: 'model', owned_by: 'local' },
          { id: 'local-model-2', object: 'model', owned_by: 'local' }
        ]
      }
    },
    completion: {
      status: 200,
      body: {
        choices: [{
          text: 'Test response from LM Studio',
          index: 0,
          finish_reason: 'stop'
        }]
      }
    }
  },
  
  openai: {
    models: {
      status: 200,
      body: {
        data: [
          { id: 'gpt-4', object: 'model', owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' }
        ]
      }
    },
    completion: {
      status: 200,
      body: {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Test response from OpenAI'
          },
          finish_reason: 'stop'
        }]
      }
    },
    error: {
      status: 401,
      body: {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }
    }
  },
  
  anthropic: {
    models: {
      status: 200,
      body: {
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
      }
    },
    completion: {
      status: 200,
      body: {
        content: [{
          type: 'text',
          text: 'Test response from Anthropic'
        }],
        stop_reason: 'end_turn'
      }
    },
    error: {
      status: 401,
      body: {
        error: {
          type: 'authentication_error',
          message: 'Invalid API key'
        }
      }
    }
  }
}

export function generateUniqueProvider(prefix: string): TestProvider {
  const timestamp = Date.now()
  return {
    id: `${prefix}-${timestamp}`,
    name: `Test Provider ${timestamp}`,
    type: 'custom',
    endpoint: `http://localhost:${8000 + (timestamp % 1000)}/v1`,
    apiKey: `test-key-${timestamp}`,
    models: ['test-model'],
    defaultModel: 'test-model'
  }
}

export function getRandomProvider(): TestProvider {
  const providers = Object.values(testProviders)
  return providers[Math.floor(Math.random() * providers.length)]
}

export function getMockApiKey(provider: 'openai' | 'anthropic', valid: boolean = true): string {
  return valid ? testApiKeys.valid[provider] : testApiKeys.invalid[provider]
}

export function getProviderModels(providerType: string): any[] {
  switch (providerType) {
    case 'openai':
      return testModels.openai
    case 'anthropic':
      return testModels.anthropic
    case 'ollama':
      return testModels.ollama
    default:
      return []
  }
}

export function getProviderSettings(preset: 'default' | 'creative' | 'precise' | 'coding' = 'default') {
  return providerSettings[preset]
}