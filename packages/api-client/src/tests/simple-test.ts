#!/usr/bin/env bun
/**
 * Simple test script to verify the test environment works
 */

import { createTestEnvironment } from './test-environment'
import { createPromptlianoClient } from '@promptliano/api-client'

async function runSimpleTest() {
  console.log('🧪 Running simple test to verify environment...')
  
  let testEnv
  try {
    // Create isolated test environment
    console.log('📦 Creating test environment...')
    testEnv = await createTestEnvironment({
      useIsolatedServer: false, // Use existing server for now
      database: {
        useMemory: true
      },
      execution: {
        logLevel: 'info'
      }
    })
    
    console.log('✅ Test environment created')
    console.log(`📍 Base URL: ${testEnv.baseUrl}`)
    
    // Create API client
    const client = createPromptlianoClient({
      baseUrl: testEnv.baseUrl
    })
    
    // Try a simple API call
    console.log('🔍 Testing API connection...')
    try {
      const projects = await client.projects.listProjects()
      console.log(`✅ API call successful! Found ${projects.length || 0} projects`)
    } catch (error: any) {
      console.error('❌ API call failed:', error.message)
      
      // Try the TypeSafeApiClient directly
      console.log('🔄 Trying TypeSafeApiClient...')
      const typeSafeClient = client.typeSafeClient
      try {
        const response = await typeSafeClient.getProjects()
        console.log(`✅ TypeSafeApiClient worked! Response:`, response)
      } catch (tsError: any) {
        console.error('❌ TypeSafeApiClient also failed:', tsError.message)
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to create test environment:', error)
  } finally {
    if (testEnv) {
      console.log('🧹 Cleaning up...')
      await testEnv.cleanup()
    }
  }
}

// Run the test
runSimpleTest().catch(console.error)