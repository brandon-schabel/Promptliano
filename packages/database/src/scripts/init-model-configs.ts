#!/usr/bin/env bun
/**
 * Initialize system default model configurations
 * Run this script to seed the database with default model configs and presets
 */

import { db } from '../db'
import { modelConfigs, modelPresets } from '../schema'
import type { CreateModelConfig, CreateModelPreset } from '../schema'

const defaultConfigs: CreateModelConfig[] = [
  // OpenAI Models
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
    systemPrompt: 'You are a helpful assistant.',
    isDefault: true,
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
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
    systemPrompt: 'You are a helpful assistant.',
    isDefault: true,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

const defaultPresets: Omit<CreateModelPreset, 'configId'>[] = [
  {
    name: 'Creative Writing',
    displayName: 'Creative Writing',
    description: 'Higher temperature for creative and varied outputs',
    category: 'creative',
    temperature: 0.9,
    maxTokens: 4096,
    topP: 0.95,
    frequencyPenalty: 0.5,
    presencePenalty: 0.5,
    systemPrompt: 'You are a creative writing assistant. Be imaginative, descriptive, and engaging.',
    isSystemPreset: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'Code Generation',
    displayName: 'Code Generation',
    description: 'Optimized for generating code with lower temperature',
    category: 'coding',
    temperature: 0.3,
    maxTokens: 8192,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are an expert programmer. Generate clean, efficient, and well-documented code.',
    isSystemPreset: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'Analytical',
    displayName: 'Analytical Reasoning',
    description: 'Precise and focused responses for analysis',
    category: 'analysis',
    temperature: 0.2,
    maxTokens: 4096,
    topP: 0.85,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are an analytical assistant. Provide precise, logical, and well-reasoned responses.',
    isSystemPreset: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'Conversational',
    displayName: 'Conversational',
    description: 'Natural conversation with balanced parameters',
    category: 'chat',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.3,
    presencePenalty: 0.3,
    systemPrompt: 'You are a friendly conversational assistant. Be natural, engaging, and helpful.',
    isSystemPreset: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    name: 'Summarization',
    displayName: 'Summarization',
    description: 'Concise and focused summaries',
    category: 'productivity',
    temperature: 0.3,
    maxTokens: 1024,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are a summarization expert. Provide concise, accurate summaries that capture key points.',
    isSystemPreset: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

async function initializeModelConfigs() {
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
        configId: config.id
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