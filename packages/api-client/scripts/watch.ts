#!/usr/bin/env bun

/**
 * Watch mode for automatic API client regeneration
 * Monitors server OpenAPI spec changes and regenerates client automatically
 */

import { watch } from 'node:fs'
import { generateApiClient, config } from './generate-client'

let isGenerating = false
let lastGenerationTime = 0
const DEBOUNCE_MS = 2000

/**
 * Debounced generation to avoid rapid successive regenerations
 */
async function debouncedGenerate(): Promise<void> {
  const now = Date.now()

  if (isGenerating || now - lastGenerationTime < DEBOUNCE_MS) {
    return
  }

  isGenerating = true
  lastGenerationTime = now

  try {
    console.log('\n🔄 Changes detected, regenerating API client...')
    await generateApiClient()
    console.log('✅ API client regenerated successfully\n')
  } catch (error) {
    console.error('❌ Regeneration failed:', error)
  } finally {
    isGenerating = false
  }
}

/**
 * Check if server is available
 */
async function checkServerAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${config.serverUrl}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Poll for OpenAPI spec changes
 */
async function pollForChanges(): Promise<void> {
  let lastSpecHash = ''

  const poll = async () => {
    try {
      if (await checkServerAvailability()) {
        const response = await fetch(`${config.serverUrl}${config.openApiPath}`)
        if (response.ok) {
          const spec = await response.text()
          const specHash = await Bun.hash(spec).toString()

          if (lastSpecHash && lastSpecHash !== specHash) {
            console.log('📡 OpenAPI spec changed, triggering regeneration...')
            await debouncedGenerate()
          }

          lastSpecHash = specHash
        }
      }
    } catch (error) {
      // Silently ignore errors during polling
    }

    setTimeout(poll, 5000) // Poll every 5 seconds
  }

  poll()
}

/**
 * Start watch mode
 */
async function startWatchMode(): Promise<void> {
  console.log('👀 Starting API client watch mode...')
  console.log(`📍 Monitoring server: ${config.serverUrl}`)
  console.log('🔄 Will automatically regenerate client when OpenAPI spec changes')
  console.log('⏹️  Press Ctrl+C to stop\n')

  // Initial generation
  try {
    await generateApiClient()
    console.log('🔗 Generating advanced hooks...')
    // Import and run advanced hooks generation
    const { generateAdvancedHooksSystem } = await import('./generate-advanced-hooks')
    await generateAdvancedHooksSystem()
  } catch (error) {
    console.error('❌ Initial generation failed:', error)
    console.log('🔄 Will retry when server becomes available...\n')
  }

  // Start polling for changes
  await pollForChanges()
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping API client watch mode...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Stopping API client watch mode...')
  process.exit(0)
})

// Run if called directly
if (import.meta.main) {
  startWatchMode()
}

export { startWatchMode }
