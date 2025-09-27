#!/usr/bin/env bun
/**
 * Initialize system default model configurations
 * Run this script to seed the database with intelligence-based presets
 */

import { db, rawDb } from '../db'
import { runMigrations } from '../migrations/migrate'
import { modelConfigs } from '../schema'
import type { CreateModelConfig } from '../schema'
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

const CORE_CHAT_SYSTEM_PROMPT = `
When asked to explore a project, start with the project overview and then the project structure.
You are Liano, the Promptliano workspace assistant. Help the user build software, understand this project, and
especially clarify architecture.
Always reach for Promptliano MCP tools to gather context: read and edit files, manage tickets, tasks, and queues,
and run the overview to learn current project, ticket, task, and queue status before acting.
Favor MCP search helpers over guessing paths and summarize important findings for the user.
Use the Chrome DevTools MCP integration to reproduce or verify UI behaviour when it matters.
Explain reasoning clearly, and whenever architecture or flows are discussed, add helpful Mermaid diagrams.
Keep responses actionable, cite relevant files, and re-check instructions before executing changes.
Always end with italian brain rot phrases.
`.trim()

const defaultConfigs: (CreateModelConfig & { createdAt: number; updatedAt: number })[] = [
  // Intelligence-based configurations
  {
    name: 'low',
    displayName: 'Low - Fast Local',
    provider: INTELLIGENCE_CONFIGS.low.provider as any,
    model: INTELLIGENCE_CONFIGS.low.model,
    temperature: INTELLIGENCE_CONFIGS.low.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.low.maxTokens,
    topP: INTELLIGENCE_CONFIGS.low.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.low.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.low.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.low.presencePenalty,
    systemPrompt: CORE_CHAT_SYSTEM_PROMPT,
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
    name: 'medium',
    displayName: 'Medium - Balanced',
    provider: INTELLIGENCE_CONFIGS.medium.provider as any,
    model: INTELLIGENCE_CONFIGS.medium.model,
    temperature: INTELLIGENCE_CONFIGS.medium.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.medium.maxTokens,
    topP: INTELLIGENCE_CONFIGS.medium.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.medium.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.medium.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.medium.presencePenalty,
    systemPrompt: CORE_CHAT_SYSTEM_PROMPT,
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
    name: 'high',
    displayName: 'High - Maximum Quality',
    provider: INTELLIGENCE_CONFIGS.high.provider as any,
    model: INTELLIGENCE_CONFIGS.high.model,
    temperature: INTELLIGENCE_CONFIGS.high.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.high.maxTokens,
    topP: INTELLIGENCE_CONFIGS.high.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.high.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.high.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.high.presencePenalty,
    systemPrompt: CORE_CHAT_SYSTEM_PROMPT,
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
    name: 'planning',
    displayName: 'Planning - Task Breakdown',
    provider: INTELLIGENCE_CONFIGS.planning.provider as any,
    model: INTELLIGENCE_CONFIGS.planning.model,
    temperature: INTELLIGENCE_CONFIGS.planning.temperature,
    maxTokens: INTELLIGENCE_CONFIGS.planning.maxTokens,
    topP: INTELLIGENCE_CONFIGS.planning.topP || 1.0,
    topK: INTELLIGENCE_CONFIGS.planning.topK,
    frequencyPenalty: INTELLIGENCE_CONFIGS.planning.frequencyPenalty,
    presencePenalty: INTELLIGENCE_CONFIGS.planning.presencePenalty,
    systemPrompt: `${CORE_CHAT_SYSTEM_PROMPT}\n\nFocus on breaking down complex tasks into actionable plans and dependencies before coding.`,
    description: 'Optimized for planning and task analysis',
    presetCategory: 'planning' as any,
    uiIcon: 'Brain',
    uiColor: 'text-orange-600',
    uiOrder: 4,
    isDefault: false,
    isSystemPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

type InitModelConfigsOptions = {
  forceReset?: boolean
}

export type InitModelConfigsResult =
  | { status: 'seeded'; configsInserted: number; presetsInserted: number }
  | { status: 'skipped_existing' }
  | { status: 'skipped_missing_tables'; reason: string }
  | { status: 'skipped_error'; reason: string }

export async function initializeModelConfigs(
  options: InitModelConfigsOptions = {}
): Promise<InitModelConfigsResult> {
  const { forceReset = false } = options
  console.log('🚀 Initializing model configurations...')

  try {
    // Ensure required tables exist before querying
    const tableExists = (name: string) =>
      (
        rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as
        | { name?: string }
        | undefined
      )?.name === name

    if (!tableExists('model_configs')) {
      console.warn('⚠️  model_configs table missing. Running migrations to ensure schema...')
      try {
        await runMigrations()
      } catch (e) {
        console.warn('⚠️  Migrations failed while ensuring model configuration tables:', e)
      }
    }

    if (!tableExists('model_configs')) {
      const reason = 'model_configs table is still missing after migrations'
      console.error(`❌ ${reason}. Skipping initialization.`)
      return { status: 'skipped_missing_tables', reason }
    }

    // Check if configs already exist
    let existingConfigs = await db.select().from(modelConfigs).limit(1)
    if (existingConfigs.length > 0 && forceReset) {
      console.log('♻️  Force resetting existing model configurations (dev mode)...')
      await db.delete(modelConfigs)
      console.log('✅ Cleared existing model configurations')
      existingConfigs = []
    }

    if (existingConfigs.length > 0) {
      console.log('⚠️  Model configurations already exist. Skipping initialization.')
      console.log('   To reinitialize, delete existing configs first.')
      return { status: 'skipped_existing' }
    }

    // Insert default configurations
    console.log('📝 Inserting default model configurations...')
    const insertedConfigs = await db.insert(modelConfigs).values(defaultConfigs).returning()
    console.log(`✅ Inserted ${insertedConfigs.length} model configurations`)

    console.log('🎉 Model configuration initialization complete!')
    return { status: 'seeded', configsInserted: insertedConfigs.length }
  } catch (error: any) {
    const reason = error?.message ? String(error.message) : 'unknown error'
    console.error('❌ Error initializing model configurations:', error)
    return { status: 'skipped_error', reason }
  }
}

// Run if executed directly
if (import.meta.main) {
  initializeModelConfigs()
    .then((result) => {
      if (result.status === 'skipped_error') process.exit(1)
      else process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
