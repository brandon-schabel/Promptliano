#!/usr/bin/env bun
/**
 * Reset and reinitialize model configurations
 */

import { db } from '../db'
import { modelConfigs, modelPresets } from '../schema'
import { initializeModelConfigs } from './init-model-configs'

async function resetModelConfigs() {
  console.log('🗑️  Clearing existing model configurations...')

  try {
    // Delete all presets first (due to foreign key constraint)
    await db.delete(modelPresets)
    console.log('✅ Cleared model presets')

    // Delete all configs
    await db.delete(modelConfigs)
    console.log('✅ Cleared model configs')

    // Reinitialize with new metadata
    console.log('\n📝 Re-initializing model configurations with UI metadata...')
    await initializeModelConfigs()

    console.log('🎉 Model configuration reset complete!')
  } catch (error) {
    console.error('❌ Error resetting model configurations:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.main) {
  resetModelConfigs()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
