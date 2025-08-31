#!/usr/bin/env bun

import { createProviderKeyService } from './packages/services/src/provider-key-service'

async function testOpenRouterModels() {
  console.log('Testing OpenRouter models fetching...')
  
  const service = createProviderKeyService()
  
  // We need to get a provider key first
  const keys = await service.listKeysUncensored()
  const openrouterKey = keys.find(k => k.provider === 'openrouter')
  
  if (!openrouterKey) {
    console.error('No OpenRouter key found in database')
    return
  }
  
  console.log('Found OpenRouter key:', {
    id: openrouterKey.id,
    provider: openrouterKey.provider,
    hasKey: !!openrouterKey.key
  })
  
  try {
    // Test the provider
    const result = await service.testProvider({
      providerId: openrouterKey.id
    })
    console.log('Test result:', {
      success: result.success,
      provider: result.provider,
      modelCount: result.models?.length || 0,
      error: result.error
    })
    
    if (result.models && result.models.length > 0) {
      console.log('Sample models:')
      result.models.slice(0, 5).forEach(model => {
        console.log(`  - ${model.id}: ${model.name}`)
      })
    }
  } catch (error) {
    console.error('Error testing OpenRouter:', error)
  }
}

testOpenRouterModels()