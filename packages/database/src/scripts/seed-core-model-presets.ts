#!/usr/bin/env bun
/**
 * Seed the database with the four core model presets (low, medium, high, planning).
 * The script is idempotent – existing rows are updated in place and missing rows are inserted.
 */

import { eq } from 'drizzle-orm'

import { db } from '../db'
import { runMigrations } from '../migrations/migrate'
import { modelConfigs, modelPresets } from '../schema'

type SeedConfig = {
  name: 'low' | 'medium' | 'high' | 'planning'
  displayName: string
  description: string
  provider: string
  model: string
  presetCategory: 'low' | 'medium' | 'high' | 'planning'
  uiIcon: string
  uiColor: string
  uiOrder: number
  defaultPreset?: boolean
}

type SeedPreset = {
  name: string
  description: string
  category: 'general' | 'coding' | 'creative' | 'analysis' | 'chat' | 'productivity'
  metadata: Record<string, unknown>
}

const CORE_CONFIGS: SeedConfig[] = [
  {
    name: 'low',
    displayName: 'Low - Fast Local',
    description: 'Optimized for quick, low-cost responses.',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5',
    presetCategory: 'low',
    uiIcon: 'Zap',
    uiColor: 'text-green-600',
    uiOrder: 1
  },
  {
    name: 'medium',
    displayName: 'Medium - Balanced',
    description: 'Balanced quality and latency for day-to-day work.',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5',
    presetCategory: 'medium',
    uiIcon: 'Gauge',
    uiColor: 'text-blue-600',
    uiOrder: 2,
    defaultPreset: true
  },
  // High Intelligence/Large Context
  {
    name: 'high',
    displayName: 'High - Maximum Quality',
    description: 'Highest quality for complex reasoning and long context.',
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro',
    presetCategory: 'high',
    uiIcon: 'Rocket',
    uiColor: 'text-purple-600',
    uiOrder: 3
  },
  // Large Context
  {
    name: 'planning',
    displayName: 'Planning - Task Breakdown',
    description: 'Focused on outlining plans and multi-step execution.',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    presetCategory: 'planning',
    uiIcon: 'Brain',
    uiColor: 'text-orange-600',
    uiOrder: 4
  }
]

const CORE_PRESETS: Record<SeedConfig['name'], SeedPreset> = {
  low: {
    name: 'Quick Responses',
    description: 'Fast replies with concise explanations.',
    category: 'productivity',
    metadata: {
      temperature: 0.5,
      maxTokens: 2048,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'You are a concise assistant focused on speed and clarity.'
    }
  },
  medium: {
    name: 'Balanced General Purpose',
    description: 'Reliable assistant for everyday development work.',
    category: 'general',
    metadata: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'Provide thoughtful, well-reasoned answers with helpful detail.'
    }
  },
  high: {
    name: 'Deep Analysis',
    description: 'High quality model for complex problem solving.',
    category: 'analysis',
    metadata: {
      temperature: 0.6,
      maxTokens: 16000,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'Reason carefully and articulate detailed, structured responses.'
    }
  },
  planning: {
    name: 'Strategic Planner',
    description: 'Generate plans, task breakdowns, and next steps.',
    category: 'productivity',
    metadata: {
      temperature: 0.5,
      maxTokens: 8192,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'Break work into actionable steps with priorities and dependencies.'
    }
  }
}

const now = () => Date.now()

async function ensureConfig(def: SeedConfig): Promise<number> {
  const existing = await db
    .select({ id: modelConfigs.id })
    .from(modelConfigs)
    .where(eq(modelConfigs.name, def.name))
    .limit(1)

  const baseFields = {
    displayName: def.displayName,
    provider: def.provider,
    model: def.model,
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    description: def.description,
    presetCategory: def.presetCategory,
    uiIcon: def.uiIcon,
    uiColor: def.uiColor,
    uiOrder: def.uiOrder,
    isDefault: def.defaultPreset ?? false,
    isSystemPreset: true,
    isActive: true,
    updatedAt: now()
  }

  if (existing.length > 0) {
    const [{ id }] = existing
    await db
      .update(modelConfigs)
      .set(baseFields)
      .where(eq(modelConfigs.id, id))
    return id
  }

  const inserted = await db
    .insert(modelConfigs)
    .values({
      name: def.name,
      createdAt: now(),
      ...baseFields
    })
    .returning({ id: modelConfigs.id })

  return inserted[0].id
}

async function ensurePreset(configId: number, key: SeedConfig['name']): Promise<void> {
  const preset = CORE_PRESETS[key]
  const existing = await db
    .select({ id: modelPresets.id })
    .from(modelPresets)
    .where(eq(modelPresets.name, preset.name))
    .limit(1)

  const payload = {
    description: preset.description,
    category: preset.category,
    metadata: preset.metadata,
    isSystemPreset: true,
    isActive: true,
    usageCount: 0,
    configId,
    updatedAt: now()
  }

  if (existing.length > 0) {
    const [{ id }] = existing
    await db
      .update(modelPresets)
      .set(payload)
      .where(eq(modelPresets.id, id))
    return
  }

  await db.insert(modelPresets).values({
    name: preset.name,
    createdAt: now(),
    ...payload
  })
}

async function main() {
  console.log('🌱 Seeding core model presets...')
  await runMigrations()

  for (const config of CORE_CONFIGS) {
    const configId = await ensureConfig(config)
    await ensurePreset(configId, config.name)
    console.log(`  • ${config.displayName} (${config.provider}/${config.model}) ready`)
  }

  console.log('✅ Core presets are seeded.')
}

main().catch((error) => {
  console.error('❌ Failed to seed model presets:', error)
  process.exit(1)
})
