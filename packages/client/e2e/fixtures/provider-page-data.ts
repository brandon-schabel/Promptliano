/**
 * Provider Page Test Data Fixtures
 *
 * Comprehensive test data for provider management functionality including
 * local providers (Ollama, LM Studio) and cloud providers (OpenAI, Anthropic)
 * with various test scenarios and mock responses.
 */

export interface LocalProvider {
  id: string
  name: string
  type: 'local'
  defaultUrl: string
  healthEndpoint: string
  modelsEndpoint: string
  expectedModels: string[]
  testPrompt: string
  installInstructions: string
  installUrl?: string
}

export interface CloudProvider {
  id: string
  name: string
  type: 'cloud'
  baseUrl: string
  modelsEndpoint: string
  testEndpoint: string
  keyFormat: string
  models: string[]
  testKey: string
  invalidKey: string
  testPrompt: string
}

export interface TestScenarios {
  localAvailable: {
    mockOllamaResponse: { status: number; body: any }
    mockLMStudioResponse: { status: number; body: any }
  }
  localUnavailable: {
    mockOllamaResponse: { status: number; error: string }
    mockLMStudioResponse: { status: number; error: string }
  }
  cloudKeyValid: {
    openaiResponse: { status: number; body: any }
    anthropicResponse: { status: number; body: any }
  }
  cloudKeyInvalid: {
    openaiResponse: { status: number; body: any }
    anthropicResponse: { status: number; body: any }
  }
}

/**
 * Main provider page test data containing all configurations and scenarios
 */
export const ProviderPageTestData = {
  /**
   * Local providers that may or may not be available
   */
  localProviders: [
    {
      id: 'ollama',
      name: 'Ollama',
      type: 'local' as const,
      defaultUrl: 'http://localhost:11434',
      healthEndpoint: '/api/version',
      modelsEndpoint: '/api/tags',
      expectedModels: ['llama3', 'codellama', 'mistral', 'llama3.1', 'phi3', 'qwen2'],
      testPrompt: 'Hello, this is a test message for Ollama',
      installInstructions: 'Install Ollama from ollama.ai',
      installUrl: 'https://ollama.ai'
    },
    {
      id: 'lmstudio',
      name: 'LM Studio',
      type: 'local' as const,
      defaultUrl: 'http://localhost:1234',
      healthEndpoint: '/v1/models',
      modelsEndpoint: '/v1/models',
      expectedModels: ['local-model', 'custom-model', 'huggingface-model'],
      testPrompt: 'Hello, this is a test message for LM Studio',
      installInstructions: 'Install LM Studio from lmstudio.ai',
      installUrl: 'https://lmstudio.ai'
    }
  ] as LocalProvider[],

  /**
   * Cloud providers with mock configurations
   */
  cloudProviders: [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'cloud' as const,
      baseUrl: 'https://api.openai.com/v1',
      modelsEndpoint: '/models',
      testEndpoint: '/models',
      keyFormat: 'sk-[48 characters]',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4o-mini'],
      testKey: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
      invalidKey: 'invalid-key-format',
      testPrompt: 'Hello, this is a test message for OpenAI'
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      type: 'cloud' as const,
      baseUrl: 'https://api.anthropic.com',
      modelsEndpoint: '/v1/models',
      testEndpoint: '/v1/models',
      keyFormat: 'sk-ant-[varies]',
      models: [
        'claude-3-opus-20240229',
        'claude-4-sonnet',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20241022'
      ],
      testKey: 'sk-ant-test1234567890abcdef1234567890abcdef',
      invalidKey: 'invalid-anthropic-key',
      testPrompt: 'Hello, this is a test message for Anthropic'
    }
  ] as CloudProvider[],

  /**
   * Test scenarios for different provider states
   */
  testScenarios: {
    localAvailable: {
      mockOllamaResponse: {
        status: 200,
        body: {
          version: '0.1.32',
          models: [
            { name: 'llama3:latest', size: 4661211808, modified_at: '2024-01-15T10:30:00Z' },
            { name: 'codellama:7b', size: 3825819519, modified_at: '2024-01-14T08:20:00Z' },
            { name: 'mistral:latest', size: 4109016141, modified_at: '2024-01-13T16:45:00Z' }
          ]
        }
      },
      mockLMStudioResponse: {
        status: 200,
        body: {
          data: [
            { id: 'local-model', object: 'model', owned_by: 'user', created: 1640995200 },
            { id: 'custom-model-7b', object: 'model', owned_by: 'user', created: 1640991600 }
          ]
        }
      }
    },
    localUnavailable: {
      mockOllamaResponse: { status: 0, error: 'ECONNREFUSED' },
      mockLMStudioResponse: { status: 0, error: 'ECONNREFUSED' }
    },
    cloudKeyValid: {
      openaiResponse: {
        status: 200,
        body: {
          data: [
            { id: 'gpt-4', object: 'model', owned_by: 'openai', created: 1687882411 },
            { id: 'gpt-4-turbo', object: 'model', owned_by: 'openai', created: 1712361441 },
            { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai', created: 1677610602 }
          ]
        }
      },
      anthropicResponse: {
        status: 200,
        body: {
          data: [
            { id: 'claude-3-opus-20240229', type: 'model', display_name: 'Claude 3 Opus' },
            { id: 'claude-4-sonnet', type: 'model', display_name: 'Claude 3 Sonnet' },
            { id: 'claude-3-haiku-20240307', type: 'model', display_name: 'Claude 3 Haiku' }
          ]
        }
      }
    },
    cloudKeyInvalid: {
      openaiResponse: {
        status: 401,
        body: {
          error: {
            message:
              'Incorrect API key provided: sk-test1***cdef. You can find your API key at https://platform.openai.com/account/api-keys.',
            type: 'invalid_request_error',
            param: null,
            code: 'invalid_api_key'
          }
        }
      },
      anthropicResponse: {
        status: 401,
        body: {
          error: {
            type: 'authentication_error',
            message: 'invalid x-api-key'
          }
        }
      }
    }
  } as TestScenarios,

  /**
   * Error scenarios for comprehensive testing
   */
  errorScenarios: {
    networkTimeout: {
      description: 'Network request timeout',
      mockResponse: null, // No response (timeout)
      expectedBehavior: 'Show timeout error with retry option'
    },
    serviceUnavailable: {
      description: 'Provider service temporarily unavailable',
      mockResponse: {
        status: 503,
        body: {
          error: {
            message: 'The server is temporarily unable to service your request',
            type: 'server_error'
          }
        }
      },
      expectedBehavior: 'Show service unavailable message with status page link'
    },
    rateLimitExceeded: {
      description: 'API rate limit exceeded',
      mockResponse: {
        status: 429,
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0'
        },
        body: {
          error: {
            message: 'Rate limit exceeded. Try again in 60 seconds.',
            type: 'rate_limit_error'
          }
        }
      },
      expectedBehavior: 'Show rate limit warning with retry timer'
    },
    invalidJsonResponse: {
      description: 'Invalid JSON response from provider',
      mockResponse: {
        status: 200,
        body: 'invalid json response'
      },
      expectedBehavior: 'Show parsing error with technical details'
    },
    forbiddenAccess: {
      description: 'Access forbidden by provider',
      mockResponse: {
        status: 403,
        body: {
          error: {
            message: 'You do not have access to this resource',
            type: 'forbidden_error'
          }
        }
      },
      expectedBehavior: 'Show access denied message with account verification'
    }
  },

  /**
   * Security test scenarios
   */
  securityScenarios: {
    apiKeyMasking: {
      realKey: 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
      expectedMaskedDisplays: [
        'sk-************************************def',
        '********************************abcdef',
        'sk-••••••••••••••••••••••••••••••••••••••••def',
        '*'.repeat(48) // Fully masked
      ]
    },
    keyFormatValidation: {
      validFormats: {
        openai: [
          'sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          'sk-test1234567890abcdef1234567890abcdef1234567890abcdef',
          'sk-1234567890abcdef1234567890abcdef1234567890abcdef'
        ],
        anthropic: [
          'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          'sk-ant-1234567890abcdef1234567890abcdef'
        ]
      },
      invalidFormats: [
        'not-a-key',
        'sk-',
        'sk-tooshort',
        '12345',
        '',
        'api-key-without-prefix',
        'sk-invalid-format-123'
      ]
    },
    storageValidation: {
      shouldNotAppearInStorage: ['sk-test1234567890abcdef', 'sk-ant-secretkey123456', 'real-api-key-value'],
      expectedStoragePatterns: ['encrypted_key_hash', 'key_reference_id', 'masked_key_display']
    }
  },

  /**
   * Performance test configurations
   */
  performanceScenarios: {
    slowConnection: {
      description: 'Slow network connection simulation',
      delay: 5000, // 5 second delay
      expectedBehavior: 'Show loading indicator and allow cancellation'
    },
    fastConnection: {
      description: 'Fast network connection',
      delay: 100, // 100ms delay
      expectedBehavior: 'Quick response with minimal loading time'
    },
    simultaneousRequests: {
      description: 'Multiple provider tests at once',
      providerCount: 4,
      expectedBehavior: 'All tests complete independently without interference'
    }
  },

  /**
   * Model discovery test data
   */
  modelDiscoveryScenarios: {
    largeModelList: {
      description: 'Provider with many available models',
      models: Array.from({ length: 50 }, (_, i) => ({
        id: `model-${i + 1}`,
        name: `Test Model ${i + 1}`,
        contextLength: Math.floor(Math.random() * 32000) + 2000,
        capabilities: ['chat', 'completion'].slice(0, Math.floor(Math.random() * 2) + 1)
      }))
    },
    emptyModelList: {
      description: 'Provider with no available models',
      models: [],
      expectedMessage: /no.*models|models.*unavailable|no.*models.*found/i
    },
    modelWithMetadata: {
      description: 'Models with detailed metadata',
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          contextLength: 8192,
          capabilities: ['chat', 'completion'],
          pricing: { input: 0.03, output: 0.06 },
          description: 'Most capable GPT-4 model'
        },
        {
          id: 'claude-4-sonnet',
          name: 'Claude 3 Sonnet',
          contextLength: 200000,
          capabilities: ['chat', 'vision'],
          description: 'Balanced model for most tasks'
        }
      ]
    }
  },

  /**
   * UI interaction patterns
   */
  uiPatterns: {
    apiKeyInputBehaviors: {
      maskedByDefault: true,
      showToggleButton: true,
      clearButtonVisible: true,
      validationOnBlur: true,
      saveButtonEnabledOnValid: true
    },
    connectionTestBehaviors: {
      showLoadingState: true,
      allowCancellation: true,
      displayResponseTime: true,
      showRetryButton: true,
      persistResults: true
    },
    providerStatusIndicators: {
      online: {
        color: 'green',
        icon: 'check-circle',
        tooltip: 'Provider is online and responding'
      },
      offline: {
        color: 'red',
        icon: 'x-circle',
        tooltip: 'Provider is not responding'
      },
      testing: {
        color: 'yellow',
        icon: 'loading',
        tooltip: 'Testing connection...'
      },
      warning: {
        color: 'orange',
        icon: 'alert-triangle',
        tooltip: 'Provider responding slowly'
      }
    }
  }
}

/**
 * Helper functions for test data manipulation
 */
export class ProviderTestDataHelper {
  /**
   * Get provider by ID
   */
  static getProviderById(id: string): LocalProvider | CloudProvider | undefined {
    const allProviders = [...ProviderPageTestData.localProviders, ...ProviderPageTestData.cloudProviders]
    return allProviders.find((provider) => provider.id === id)
  }

  /**
   * Create mock API response for provider health check
   */
  static createHealthCheckResponse(providerId: string, isHealthy: boolean = true) {
    const provider = this.getProviderById(providerId)
    if (!provider) throw new Error(`Provider ${providerId} not found`)

    if (provider.type === 'local') {
      const localProvider = provider as LocalProvider
      if (isHealthy) {
        return {
          status: 200,
          body: providerId === 'ollama' ? { version: '0.1.32' } : { data: [{ id: 'local-model' }] }
        }
      } else {
        return { status: 0, error: 'ECONNREFUSED' }
      }
    } else {
      const cloudProvider = provider as CloudProvider
      if (isHealthy) {
        return ProviderPageTestData.testScenarios.cloudKeyValid[
          `${providerId}Response` as keyof typeof ProviderPageTestData.testScenarios.cloudKeyValid
        ]
      } else {
        return ProviderPageTestData.testScenarios.cloudKeyInvalid[
          `${providerId}Response` as keyof typeof ProviderPageTestData.testScenarios.cloudKeyInvalid
        ]
      }
    }
  }

  /**
   * Generate test API key for cloud provider
   */
  static generateTestApiKey(providerId: string): string {
    const provider = this.getProviderById(providerId) as CloudProvider
    if (!provider || provider.type !== 'cloud') {
      throw new Error(`Cloud provider ${providerId} not found`)
    }

    return provider.testKey
  }

  /**
   * Generate invalid API key for testing
   */
  static generateInvalidApiKey(providerId: string): string {
    const provider = this.getProviderById(providerId) as CloudProvider
    if (!provider || provider.type !== 'cloud') {
      throw new Error(`Cloud provider ${providerId} not found`)
    }

    return provider.invalidKey
  }

  /**
   * Create test scenario with specific conditions
   */
  static createTestScenario(options: {
    localProvidersAvailable?: string[]
    cloudProvidersConfigured?: string[]
    simulateErrors?: string[]
  }) {
    return {
      localProviders: ProviderPageTestData.localProviders.filter(
        (p) => options.localProvidersAvailable?.includes(p.id) ?? false
      ),
      cloudProviders: ProviderPageTestData.cloudProviders.filter(
        (p) => options.cloudProvidersConfigured?.includes(p.id) ?? false
      ),
      errors: options.simulateErrors || []
    }
  }
}

/**
 * Export everything for easy access in tests
 */
export default ProviderPageTestData
