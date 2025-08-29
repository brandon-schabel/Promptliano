/**
 * Global Settings Test Data Fixtures
 *
 * Comprehensive test data for the global settings page functionality,
 * including all settings categories, validation scenarios, and import/export data.
 */

/**
 * Available editor themes for testing
 */
export const AVAILABLE_THEMES = [
  'vscode-light',
  'vscode-dark',
  'github-light',
  'github-dark',
  'monokai',
  'dracula',
  'solarized-light',
  'solarized-dark',
  'high-contrast',
  'tomorrow-night'
] as const

/**
 * Available provider configurations
 */
export const AVAILABLE_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', available: true },
  { id: 'openai', name: 'OpenAI', available: true },
  { id: 'ollama', name: 'Ollama (Local)', available: false },
  { id: 'lmstudio', name: 'LM Studio (Local)', available: false }
] as const

/**
 * Default settings configuration for testing baseline functionality
 */
export const DEFAULT_SETTINGS = {
  general: {
    llmProvider: 'anthropic',
    autoRefreshOnFocus: true,
    darkMode: false,
    autoScrollChatMessages: true,
    useSpacebarForAutocomplete: true,
    hideInformationalTooltips: false
  },
  chat: {
    autoNameChats: true,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-4-sonnet',
    showTimestamps: false,
    compactMode: false
  },
  editor: {
    theme: 'vscode-light',
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    minimap: false
  }
} as const

/**
 * Test scenarios for different user personas and configurations
 */
export const TEST_SCENARIOS = [
  {
    name: 'Dark Mode Power User',
    description: 'Advanced user with customized dark theme and compact interface',
    settings: {
      general: {
        darkMode: true,
        hideInformationalTooltips: true,
        autoRefreshOnFocus: false,
        autoScrollChatMessages: true,
        useSpacebarForAutocomplete: true
      },
      chat: {
        autoNameChats: false,
        compactMode: true,
        showTimestamps: true,
        defaultProvider: 'openai',
        defaultModel: 'gpt-4'
      },
      editor: {
        theme: 'dracula',
        fontSize: 16,
        tabSize: 4,
        wordWrap: false,
        lineNumbers: true,
        minimap: true
      }
    }
  },
  {
    name: 'Light Mode Beginner',
    description: 'New user with accessibility-friendly light theme settings',
    settings: {
      general: {
        darkMode: false,
        hideInformationalTooltips: false,
        autoRefreshOnFocus: true,
        autoScrollChatMessages: true,
        useSpacebarForAutocomplete: false
      },
      chat: {
        autoNameChats: true,
        compactMode: false,
        showTimestamps: false,
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-haiku-20240307'
      },
      editor: {
        theme: 'github-light',
        fontSize: 12,
        tabSize: 2,
        wordWrap: true,
        lineNumbers: true,
        minimap: false
      }
    }
  },
  {
    name: 'Accessibility Focused',
    description: 'User with accessibility needs requiring larger fonts and high contrast',
    settings: {
      general: {
        darkMode: false,
        hideInformationalTooltips: false,
        autoRefreshOnFocus: true,
        autoScrollChatMessages: true,
        useSpacebarForAutocomplete: false
      },
      chat: {
        autoNameChats: true,
        compactMode: false,
        showTimestamps: true,
        defaultProvider: 'anthropic',
        defaultModel: 'claude-4-sonnet'
      },
      editor: {
        theme: 'high-contrast',
        fontSize: 18,
        tabSize: 4,
        wordWrap: true,
        lineNumbers: true,
        minimap: false
      }
    }
  },
  {
    name: 'Minimal Configuration',
    description: 'User preferring minimal, distraction-free interface',
    settings: {
      general: {
        darkMode: true,
        hideInformationalTooltips: true,
        autoRefreshOnFocus: false,
        autoScrollChatMessages: false,
        useSpacebarForAutocomplete: true
      },
      chat: {
        autoNameChats: false,
        compactMode: true,
        showTimestamps: false,
        defaultProvider: 'anthropic',
        defaultModel: 'claude-4-sonnet'
      },
      editor: {
        theme: 'vscode-dark',
        fontSize: 14,
        tabSize: 2,
        wordWrap: false,
        lineNumbers: false,
        minimap: false
      }
    }
  }
] as const

/**
 * Invalid settings for validation testing
 */
export const INVALID_SETTINGS = {
  editor: {
    fontSize: {
      tooSmall: -5,
      zero: 0,
      tooLarge: 100,
      notANumber: 'invalid'
    },
    tabSize: {
      tooSmall: -1,
      zero: 0,
      tooLarge: 50,
      notANumber: 'invalid'
    },
    theme: {
      nonexistent: 'nonexistent-theme',
      empty: '',
      invalid: 'not-a-real-theme'
    }
  },
  general: {
    provider: {
      nonexistent: 'fake-provider',
      empty: '',
      invalid: 123
    }
  },
  chat: {
    provider: {
      unavailable: 'unavailable-provider',
      invalid: null
    },
    model: {
      nonexistent: 'fake-model-name',
      empty: '',
      invalid: 42
    }
  }
} as const

/**
 * Settings export/import test data
 */
export const SETTINGS_EXPORT_DATA = {
  validExport: {
    version: '1.0',
    timestamp: '2024-01-20T10:00:00Z',
    settings: {
      general: {
        darkMode: true,
        autoRefreshOnFocus: false,
        autoScrollChatMessages: true,
        useSpacebarForAutocomplete: true,
        hideInformationalTooltips: false
      },
      chat: {
        autoNameChats: false,
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
        showTimestamps: true,
        compactMode: false
      },
      editor: {
        theme: 'monokai',
        fontSize: 16,
        tabSize: 4,
        wordWrap: false,
        lineNumbers: true,
        minimap: true
      }
    }
  },
  invalidExport: {
    version: '0.5', // Unsupported version
    timestamp: 'invalid-date',
    settings: {
      invalidSection: {
        badSetting: 'invalid'
      },
      general: {
        darkMode: 'not-a-boolean',
        invalidProperty: 'should-not-exist'
      }
    }
  },
  corruptedExport: {
    // Missing required fields
    settings: {
      general: {
        darkMode: true
      }
    }
  },
  emptyExport: {},
  malformedJson: 'this is not json'
} as const

/**
 * Theme validation data for testing CSS application
 */
export const THEME_VALIDATION = {
  'vscode-light': {
    expectedBackgroundColors: ['#ffffff', 'rgb(255, 255, 255)', 'white'],
    expectedTextColors: ['#000000', 'rgb(0, 0, 0)', 'black', '#333333'],
    cssClass: 'theme-vscode-light'
  },
  'vscode-dark': {
    expectedBackgroundColors: ['#1e1e1e', '#2d2d30', 'rgb(30, 30, 30)'],
    expectedTextColors: ['#d4d4d4', '#ffffff', 'rgb(212, 212, 212)'],
    cssClass: 'theme-vscode-dark'
  },
  dracula: {
    expectedBackgroundColors: ['#282a36', 'rgb(40, 42, 54)'],
    expectedTextColors: ['#f8f8f2', 'rgb(248, 248, 242)'],
    cssClass: 'theme-dracula'
  },
  'github-light': {
    expectedBackgroundColors: ['#ffffff', '#f6f8fa', 'rgb(255, 255, 255)'],
    expectedTextColors: ['#24292e', 'rgb(36, 41, 46)'],
    cssClass: 'theme-github-light'
  },
  'high-contrast': {
    expectedBackgroundColors: ['#000000', 'rgb(0, 0, 0)', 'black'],
    expectedTextColors: ['#ffffff', 'rgb(255, 255, 255)', 'white'],
    cssClass: 'theme-high-contrast'
  }
} as const

/**
 * Font size constraints for validation
 */
export const FONT_SIZE_CONSTRAINTS = {
  minimum: 8,
  maximum: 48,
  default: 14,
  validSizes: [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48],
  invalidSizes: [-1, 0, 3, 100, 'invalid', null, undefined]
} as const

/**
 * Tab size constraints for validation
 */
export const TAB_SIZE_CONSTRAINTS = {
  minimum: 1,
  maximum: 16,
  default: 2,
  validSizes: [1, 2, 4, 8, 16],
  invalidSizes: [-1, 0, 20, 'invalid', null, undefined]
} as const

/**
 * Settings categories for organized testing
 */
export const SETTINGS_CATEGORIES = {
  general: {
    displayName: 'General Settings',
    tabId: 'general',
    testId: 'general-settings-section'
  },
  chat: {
    displayName: 'Chat Settings',
    tabId: 'chat',
    testId: 'chat-settings-section'
  },
  editor: {
    displayName: 'Code Editor',
    tabId: 'editor',
    testId: 'editor-settings-section'
  },
  advanced: {
    displayName: 'Advanced Settings',
    tabId: 'advanced',
    testId: 'advanced-settings-section'
  }
} as const

/**
 * Expected model options for each provider
 */
export const PROVIDER_MODELS = {
  anthropic: ['claude-3-opus-20240229', 'claude-4-sonnet', 'claude-3-haiku-20240307'],
  openai: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
  ollama: ['llama2', 'codellama', 'mistral'],
  lmstudio: ['local-model-1', 'local-model-2']
} as const

/**
 * Validation error messages for testing
 */
export const VALIDATION_MESSAGES = {
  fontSize: {
    tooSmall: 'Font size must be at least 8px',
    tooLarge: 'Font size must be no more than 48px',
    notANumber: 'Font size must be a valid number'
  },
  tabSize: {
    tooSmall: 'Tab size must be at least 1',
    tooLarge: 'Tab size must be no more than 16',
    notANumber: 'Tab size must be a valid number'
  },
  theme: {
    invalid: 'Selected theme is not available',
    notFound: 'Theme not found'
  },
  provider: {
    unavailable: 'Selected provider is not available',
    invalid: 'Invalid provider configuration'
  },
  import: {
    invalidFormat: 'Invalid settings file format',
    unsupportedVersion: 'Settings version not supported',
    malformedJson: 'File contains malformed JSON',
    missingFields: 'Required settings fields are missing'
  }
} as const

/**
 * Performance test data for stress testing
 */
export const PERFORMANCE_TEST_DATA = {
  rapidToggleCount: 50,
  settingsChangeDelay: 100,
  stressTestDuration: 30000,
  expectedResponseTime: 500,
  maxMemoryIncrease: 10 // MB
} as const

/**
 * Accessibility test requirements
 */
export const ACCESSIBILITY_REQUIREMENTS = {
  minimumContrastRatio: 4.5,
  keyboardNavigationRequired: true,
  screenReaderLabelsRequired: true,
  focusIndicatorsRequired: true,
  ariaAttributesRequired: ['aria-selected', 'aria-expanded', 'aria-label', 'aria-describedby']
} as const

/**
 * Test data factory for creating isolated test scenarios
 */
export class GlobalSettingsTestDataFactory {
  private static testCounter = 0

  /**
   * Create unique test settings configuration
   */
  static createUniqueSettings(baseName: string, overrides = {}) {
    const testId = ++this.testCounter
    return {
      testId: `${baseName}-${testId}-${Date.now()}`,
      settings: {
        ...DEFAULT_SETTINGS,
        ...overrides
      }
    }
  }

  /**
   * Create temporary settings file for import testing
   */
  static async createTempSettingsFile(data: any, filename?: string): Promise<string> {
    const testId = ++this.testCounter
    const name = filename || `test-settings-${testId}.json`
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

    // This would be implemented with actual file system operations in the test environment
    return `/tmp/${name}`
  }

  /**
   * Create settings for specific test scenarios
   */
  static createScenarioSettings(scenarioName: keyof typeof TEST_SCENARIOS) {
    const scenario = TEST_SCENARIOS.find((s) => s.name === scenarioName)
    if (!scenario) {
      throw new Error(`Test scenario '${scenarioName}' not found`)
    }

    return this.createUniqueSettings(scenarioName, scenario.settings)
  }

  /**
   * Create invalid settings for validation testing
   */
  static createInvalidSettings(invalidationType: string) {
    const testId = ++this.testCounter
    return {
      testId: `invalid-${invalidationType}-${testId}`,
      settings: INVALID_SETTINGS
    }
  }

  /**
   * Reset test counter for new test run
   */
  static resetCounter() {
    this.testCounter = 0
  }
}

/**
 * Main export containing all test data
 */
export const GlobalSettingsTestData = {
  AVAILABLE_THEMES,
  AVAILABLE_PROVIDERS,
  DEFAULT_SETTINGS,
  TEST_SCENARIOS,
  INVALID_SETTINGS,
  SETTINGS_EXPORT_DATA,
  THEME_VALIDATION,
  FONT_SIZE_CONSTRAINTS,
  TAB_SIZE_CONSTRAINTS,
  SETTINGS_CATEGORIES,
  PROVIDER_MODELS,
  VALIDATION_MESSAGES,
  PERFORMANCE_TEST_DATA,
  ACCESSIBILITY_REQUIREMENTS,
  Factory: GlobalSettingsTestDataFactory
} as const

export default GlobalSettingsTestData
