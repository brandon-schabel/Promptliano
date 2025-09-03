#!/usr/bin/env bun
/**
 * Initialize system default model configurations
 * Run this script to seed the database with intelligence-based presets
 */

import { db } from '../db'
import { modelConfigs, modelPresets } from '../schema'
import type { CreateModelConfig, CreateModelPreset } from '../schema'
// Intelligence level configurations based on models.config.ts
const INTELLIGENCE_CONFIGS = {
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

const defaultConfigs: (CreateModelConfig & {createdAt: number, updatedAt: number})[] = [
  // Intelligence-based configurations
  {
    name: 'low-intelligence',
    displayName: 'Low - Fast Local',
    provider: INTELLIGENCE_CONFIGS.low.provider as any,
    model: INTELLIGENCE_CONFIGS.low.model,
    temperature: INTELLIGENCE_CONFIGS.low.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.low.maxTokens,
    topP: INTELLIGENCE_CONFIGS.low.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.low.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.low.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.low.presencePenalty,
    systemPrompt: 'You are a helpful AI assistant optimized for quick, concise responses.',
    description: 'Optimized for quick responses using local models',
    presetCategory: 'low' as any,
    uiIcon: 'Zap',
    uiColor: 'text-green-600',
    uiOrder: 1,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'medium-intelligence',
    displayName: 'Medium - Balanced',
    provider: INTELLIGENCE_CONFIGS.medium.provider as any,
    model: INTELLIGENCE_CONFIGS.medium.model,
    temperature: INTELLIGENCE_CONFIGS.medium.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.medium.maxTokens,
    topP: INTELLIGENCE_CONFIGS.medium.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.medium.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.medium.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.medium.presencePenalty,
    systemPrompt: 'You are a helpful AI assistant with balanced capabilities for development tasks.',
    description: 'Balance between speed and quality',
    presetCategory: 'medium' as any,
    uiIcon: 'Gauge',
    uiColor: 'text-blue-600',
    uiOrder: 2,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'high-intelligence',
    displayName: 'High - Maximum Quality',
    provider: INTELLIGENCE_CONFIGS.high.provider as any,
    model: INTELLIGENCE_CONFIGS.high.model,
    temperature: INTELLIGENCE_CONFIGS.high.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.high.maxTokens,
    topP: INTELLIGENCE_CONFIGS.high.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.high.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.high.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.high.presencePenalty,
    systemPrompt: 'You are an expert AI assistant capable of handling complex tasks with large context windows.',
    description: 'Best quality for complex tasks',
    presetCategory: 'high' as any,
    uiIcon: 'Rocket',
    uiColor: 'text-purple-600',
    uiOrder: 3,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'planning-intelligence',
    displayName: 'Planning - Task Breakdown',
    provider: INTELLIGENCE_CONFIGS.planning.provider as any,
    model: INTELLIGENCE_CONFIGS.planning.model,
    temperature: INTELLIGENCE_CONFIGS.planning.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.planning.maxTokens,
    topP: INTELLIGENCE_CONFIGS.planning.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.planning.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.planning.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.planning.presencePenalty,
    systemPrompt: 'You are a planning specialist optimized for breaking down complex tasks and creating actionable plans.',
    description: 'Optimized for planning and task analysis',
    presetCategory: 'planning' as any,
    uiIcon: 'Brain',
    uiColor: 'text-orange-600',
    uiOrder: 4,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Keep some provider-specific models for flexibility
  {
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 16384,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Anthropic Models
  {
    name: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are Claude, a helpful AI assistant.',
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'claude-3-5-haiku',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are Claude, a helpful AI assistant.',
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Google Models
  {
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'google',
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'google',
    model: 'gemini-1.5-flash',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Groq Models
  {
    name: 'llama-3.1-70b',
    displayName: 'Llama 3.1 70B',
    provider: 'groq',
    model: 'llama-3.1-70b-versatile',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Perplexity Models
  {
    name: 'llama-3.1-sonar-large',
    displayName: 'Llama 3.1 Sonar Large',
    provider: 'perplexity',
    model: 'llama-3.1-sonar-large-128k-online',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are a helpful assistant with access to real-time information.',
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Mistral Models
  {
    name: 'mistral-large',
    displayName: 'Mistral Large',
    provider: 'mistral',
    model: 'mistral-large-latest',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Cohere Models
  {
    name: 'command-r-plus',
    displayName: 'Command R+',
    provider: 'cohere',
    model: 'command-r-plus',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Fireworks Models
  {
    name: 'llama-3.1-405b',
    displayName: 'Llama 3.1 405B Instruct',
    provider: 'fireworks',
    model: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Together AI Models
  {
    name: 'llama-3.2-90b-vision',
    displayName: 'Llama 3.2 90B Vision',
    provider: 'together',
    model: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // OpenRouter Models
  {
    name: 'openrouter-auto',
    displayName: 'OpenRouter Auto',
    provider: 'openrouter',
    model: 'openrouter/auto',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

const defaultPresets: Omit<CreateModelPreset, 'configId'>[] = [
  // Intelligence-based presets
  {
    name: 'Quick Summary',
    description: 'Fast summarization using low intelligence model',
    category: 'productivity',
    metadata: {
      intelligenceLevel: 'low',
      temperature: 0.3,
      maxTokens: 2048,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'Provide concise, clear summaries focusing on key points.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'File Analysis',
    description: 'Intelligent file selection with large context',
    category: 'analysis',
    metadata: {
      intelligenceLevel: 'high',
      temperature: 0.5,
      maxTokens: 8192,
      topP: 0.95,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'Analyze files and suggest the most relevant ones based on the task context.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Task Planning',
    description: 'Break down complex tasks into actionable items',
    category: 'productivity',
    metadata: {
      intelligenceLevel: 'planning',
      temperature: 0.6,
      maxTokens: 4096,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'Create detailed, actionable task breakdowns with clear dependencies and priorities.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Code Generation',
    description: 'Generate code with medium intelligence',
    category: 'coding',
    metadata: {
      intelligenceLevel: 'medium',
      temperature: 0.3,
      maxTokens: 8192,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'You are an expert programmer. Generate clean, efficient, and well-documented code.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Creative Writing',
    description: 'Higher temperature for creative and varied outputs',
    category: 'creative',
    metadata: {
      intelligenceLevel: 'medium',
      temperature: 0.9,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      systemPrompt: 'You are a creative writing assistant. Be imaginative, descriptive, and engaging.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Code Generation',
    description: 'Optimized for generating code with lower temperature',
    category: 'coding',
    metadata: {
      temperature: 0.3,
      maxTokens: 8192,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'You are an expert programmer. Generate clean, efficient, and well-documented code.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Analytical',
    description: 'Precise and focused responses for analysis',
    category: 'analysis',
    metadata: {
      temperature: 0.2,
      maxTokens: 4096,
      topP: 0.85,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'You are an analytical assistant. Provide precise, logical, and well-reasoned responses.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Conversational',
    description: 'Natural conversation with balanced parameters',
    category: 'chat',
    metadata: {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
      systemPrompt: 'You are a friendly conversational assistant. Be natural, engaging, and helpful.'
    },
    isSystemPreset: true,
    usageCount: 0
  },
  {
    name: 'Summarization',
    description: 'Concise and focused summaries',
    category: 'productivity',
    metadata: {
      temperature: 0.3,
      maxTokens: 1024,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'You are a summarization expert. Provide concise, accurate summaries that capture key points.'
    },
    isSystemPreset: true,
    usageCount: 0
  }
]

export async function initializeModelConfigs() {
  console.log('🚀 Initializing model configurations...')
  
  try {
    // Check if configs already exist
    const existingConfigs = await db.select().from(modelConfigs).limit(1)
    if (existingConfigs.length > 0) {
      console.log('⚠️  Model configurations already exist. Skipping initialization.')
      console.log('   To reinitialize, delete existing configs first.')
      return
    }
    
    // Insert default configurations
    console.log('📝 Inserting default model configurations...')
    const insertedConfigs = await db.insert(modelConfigs).values(defaultConfigs).returning()
    console.log(`✅ Inserted ${insertedConfigs.length} model configurations`)
    
    // Create presets for each configuration
    console.log('📝 Creating model presets...')
    let presetCount = 0
    
    for (const config of insertedConfigs) {
      // Create presets for each model config
      const presetsForConfig = defaultPresets.map(preset => ({
        ...preset,
        configId: config.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))
      
      if (presetsForConfig.length > 0) {
        await db.insert(modelPresets).values(presetsForConfig)
        presetCount += presetsForConfig.length
      }
    }
    
    console.log(`✅ Created ${presetCount} model presets`)
    console.log('🎉 Model configuration initialization complete!')
    
  } catch (error) {
    console.error('❌ Error initializing model configurations:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.main) {
  initializeModelConfigs()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}