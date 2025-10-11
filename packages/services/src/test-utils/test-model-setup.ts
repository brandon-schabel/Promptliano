import { modelConfigRepository } from '@promptliano/database'

/**
 * Seed model configs for testing
 * Creates low, medium, and high preset configurations
 */
export async function seedModelConfigs() {
  const now = Date.now()

  const configs = [
    {
      id: 1,
      name: 'low',
      displayName: 'Low - Fast',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      responseFormat: null,
      systemPrompt: null,
      isSystemPreset: true,
      isDefault: false,
      isActive: true,
      description: 'Fast preset for testing',
      presetCategory: 'speed',
      uiIcon: null,
      uiColor: null,
      uiOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 2,
      name: 'medium',
      displayName: 'Medium - Balanced',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      responseFormat: null,
      systemPrompt: null,
      isSystemPreset: true,
      isDefault: true,
      isActive: true,
      description: 'Balanced preset for testing',
      presetCategory: 'balanced',
      uiIcon: null,
      uiColor: null,
      uiOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 3,
      name: 'high',
      displayName: 'High - Quality',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.8,
      maxTokens: 8192,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      responseFormat: null,
      systemPrompt: null,
      isSystemPreset: true,
      isDefault: false,
      isActive: true,
      description: 'High quality preset for testing',
      presetCategory: 'quality',
      uiIcon: null,
      uiColor: null,
      uiOrder: 3,
      createdAt: now,
      updatedAt: now
    }
  ]

  for (const config of configs) {
    try {
      await modelConfigRepository.create(config as any)
    } catch (error) {
      // Ignore if already exists (may happen in repeated test runs)
      if (!String(error).includes('UNIQUE')) {
        console.warn('Failed to seed model config:', config.name, error)
      }
    }
  }
}
