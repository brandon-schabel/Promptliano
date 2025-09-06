/**
 * Intelligence-based Model Configuration Service
 * Maps intelligence levels (low/medium/high/planning) to appropriate models and use cases
 */

import { modelConfigRepository } from '@promptliano/database'
// Type definition for model configuration
export interface ModelOptionsWithProvider {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  topK: number
  frequencyPenalty: number
  presencePenalty: number
}

// Intelligence level configurations based on models.config.ts
const INTELLIGENCE_MODEL_CONFIGS = {
  low: {
    provider: 'lmstudio',
    model: 'unsloth-qwen3-coder-30b-a3b-instruct-qx4-mlx',
    temperature: 0.7,
    maxTokens: 32000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  medium: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 25000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  high: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro',
    temperature: 0.7,
    maxTokens: 200000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  planning: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 25000,
    topP: 0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
} as const

export type IntelligenceLevel = 'low' | 'medium' | 'high' | 'planning'

export interface IntelligenceUseCase {
  level: IntelligenceLevel
  name: string
  description: string
  examples: string[]
  requiredCapabilities: string[]
}

/**
 * Use case mappings for intelligence levels
 */
const INTELLIGENCE_USE_CASES: IntelligenceUseCase[] = [
  {
    level: 'low',
    name: 'Summarization',
    description: 'Quick summaries and basic information extraction',
    examples: ['File summaries', 'Code overview', 'Quick searches'],
    requiredCapabilities: ['basic-reasoning', 'text-extraction']
  },
  {
    level: 'low',
    name: 'Basic Q&A',
    description: 'Simple question answering and information retrieval',
    examples: ['Documentation lookup', 'API reference', 'Syntax questions'],
    requiredCapabilities: ['factual-recall', 'pattern-matching']
  },
  {
    level: 'medium',
    name: 'Code Generation',
    description: 'Generate code snippets and implement features',
    examples: ['Component creation', 'API endpoints', 'Unit tests'],
    requiredCapabilities: ['code-synthesis', 'pattern-application']
  },
  {
    level: 'medium',
    name: 'Documentation',
    description: 'Write and improve documentation',
    examples: ['README files', 'API docs', 'Code comments'],
    requiredCapabilities: ['technical-writing', 'context-awareness']
  },
  {
    level: 'high',
    name: 'File Suggestions',
    description: 'Intelligent file selection with large context windows',
    examples: ['Relevant files for task', 'Dependency analysis', 'Impact assessment'],
    requiredCapabilities: ['large-context', 'relationship-mapping', 'relevance-scoring']
  },
  {
    level: 'high',
    name: 'Architecture Design',
    description: 'Complex system design and architectural decisions',
    examples: ['System architecture', 'Database design', 'API design'],
    requiredCapabilities: ['systems-thinking', 'trade-off-analysis', 'long-term-planning']
  },
  {
    level: 'high',
    name: 'Complex Refactoring',
    description: 'Large-scale code refactoring and optimization',
    examples: ['Performance optimization', 'Code migration', 'Pattern implementation'],
    requiredCapabilities: ['code-analysis', 'pattern-recognition', 'impact-assessment']
  },
  {
    level: 'planning',
    name: 'Task Breakdown',
    description: 'Break down complex tasks into actionable items',
    examples: ['Feature planning', 'Sprint planning', 'Milestone definition'],
    requiredCapabilities: ['decomposition', 'prioritization', 'dependency-analysis']
  },
  {
    level: 'planning',
    name: 'Project Planning',
    description: 'Create comprehensive project plans and roadmaps',
    examples: ['Project roadmap', 'Resource allocation', 'Timeline estimation'],
    requiredCapabilities: ['strategic-thinking', 'resource-management', 'risk-assessment']
  },
  {
    level: 'planning',
    name: 'Ticket Management',
    description: 'Create and organize tickets with appropriate context',
    examples: ['Bug reports', 'Feature requests', 'Task tickets'],
    requiredCapabilities: ['context-extraction', 'categorization', 'priority-assessment']
  }
]

/**
 * Intelligence level configurations
 */
const INTELLIGENCE_CONFIGS: Record<IntelligenceLevel, ModelOptionsWithProvider & { metadata: any }> = {
  low: {
    ...INTELLIGENCE_MODEL_CONFIGS.low,
    metadata: {
      contextWindow: 32000,
      speed: 'very-fast',
      costPerMillion: 0.05,
      capabilities: ['basic-reasoning', 'text-extraction', 'factual-recall', 'pattern-matching']
    }
  },
  medium: {
    ...INTELLIGENCE_MODEL_CONFIGS.medium,
    metadata: {
      contextWindow: 25000,
      speed: 'fast',
      costPerMillion: 0.15,
      capabilities: ['code-synthesis', 'pattern-application', 'technical-writing', 'context-awareness']
    }
  },
  high: {
    ...INTELLIGENCE_MODEL_CONFIGS.high,
    metadata: {
      contextWindow: 200000,
      speed: 'moderate',
      costPerMillion: 1.25,
      capabilities: [
        'large-context',
        'relationship-mapping',
        'relevance-scoring',
        'systems-thinking',
        'trade-off-analysis',
        'long-term-planning',
        'code-analysis',
        'pattern-recognition',
        'impact-assessment'
      ]
    }
  },
  planning: {
    ...INTELLIGENCE_MODEL_CONFIGS.planning,
    metadata: {
      contextWindow: 25000,
      speed: 'fast',
      costPerMillion: 0.15,
      capabilities: [
        'decomposition',
        'prioritization',
        'dependency-analysis',
        'strategic-thinking',
        'resource-management',
        'risk-assessment',
        'context-extraction',
        'categorization',
        'priority-assessment'
      ]
    }
  }
}

export interface IntelligenceModelServiceDeps {
  repository?: typeof modelConfigRepository
}

export function createIntelligenceModelService(deps: IntelligenceModelServiceDeps = {}) {
  const { repository = modelConfigRepository } = deps

  return {
    /**
     * Get the appropriate intelligence level for a use case
     */
    getIntelligenceLevelForUseCase(useCase: string): IntelligenceLevel {
      const foundCase = INTELLIGENCE_USE_CASES.find(
        (uc) => uc.name.toLowerCase() === useCase.toLowerCase() ||
        uc.examples.some((ex) => ex.toLowerCase().includes(useCase.toLowerCase()))
      )
      
      return foundCase?.level || 'medium' // Default to medium if not found
    },

    /**
     * Get model configuration for an intelligence level
     */
    getConfigForIntelligence(level: IntelligenceLevel): ModelOptionsWithProvider & { metadata: any } {
      return INTELLIGENCE_CONFIGS[level]
    },

    /**
     * Get use cases for an intelligence level
     */
    getUseCasesForLevel(level: IntelligenceLevel): IntelligenceUseCase[] {
      return INTELLIGENCE_USE_CASES.filter((uc) => uc.level === level)
    },

    /**
     * Determine if a use case requires a specific capability
     */
    hasCapability(level: IntelligenceLevel, capability: string): boolean {
      return INTELLIGENCE_CONFIGS[level].metadata.capabilities.includes(capability)
    },

    /**
     * Get recommended intelligence level based on task characteristics
     */
    recommendIntelligenceLevel(characteristics: {
      contextSize?: number
      complexity?: 'simple' | 'moderate' | 'complex'
      taskType?: string
      requiresPlanning?: boolean
    }): IntelligenceLevel {
      const { contextSize = 0, complexity = 'moderate', taskType, requiresPlanning = false } = characteristics

      // Planning tasks always use planning level
      if (requiresPlanning || taskType?.includes('planning')) {
        return 'planning'
      }

      // Large context requires high intelligence
      if (contextSize > 50000) {
        return 'high'
      }

      // Complex tasks require high intelligence
      if (complexity === 'complex') {
        return 'high'
      }

      // Simple tasks can use low intelligence
      if (complexity === 'simple' || contextSize < 5000) {
        return 'low'
      }

      // Default to medium for moderate complexity
      return 'medium'
    },

    /**
     * Initialize database with intelligence-based presets
     */
    async initializeIntelligencePresets() {
      const configs = []

      for (const [level, config] of Object.entries(INTELLIGENCE_CONFIGS)) {
        const { metadata, ...modelConfig } = config
        
        configs.push({
          name: `${level}-intelligence`,
          displayName: `${level.charAt(0).toUpperCase() + level.slice(1)} Intelligence`,
          provider: modelConfig.provider,
          model: modelConfig.model,
          temperature: modelConfig.temperature,
          maxTokens: modelConfig.maxTokens,
          topP: modelConfig.topP || 1.0,
          topK: modelConfig.topK || 0,
          frequencyPenalty: modelConfig.frequencyPenalty || 0,
          presencePenalty: modelConfig.presencePenalty || 0,
          isDefault: level === 'medium',
          isSystemPreset: true,
          metadata: metadata
        })
      }

      // Create configurations in database
      for (const config of configs) {
        await repository.create(config)
      }

      return configs
    },

    /**
     * Get cost estimate for a task
     */
    estimateCost(level: IntelligenceLevel, estimatedTokens: number): number {
      const config = INTELLIGENCE_CONFIGS[level]
      const costPerMillion = config.metadata.costPerMillion
      return (estimatedTokens / 1000000) * costPerMillion
    },

    /**
     * Validate if a task fits within context window
     */
    validateContextSize(level: IntelligenceLevel, contextSize: number): boolean {
      const config = INTELLIGENCE_CONFIGS[level]
      return contextSize <= config.metadata.contextWindow
    }
  }
}

// Export singleton instance
export const intelligenceModelService = createIntelligenceModelService()

