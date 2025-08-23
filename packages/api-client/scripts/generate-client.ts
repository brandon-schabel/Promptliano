#!/usr/bin/env bun

/**
 * Automatic API Client Generation from OpenAPI Spec
 * Generates type-safe TypeScript clients from server's OpenAPI specification
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const execAsync = promisify(exec)

interface GenerationConfig {
  serverUrl: string
  outputDir: string
  openApiPath: string
  generatedDir: string
}

const config: GenerationConfig = {
  serverUrl: process.env.PROMPTLIANO_SERVER_URL || 'http://localhost:3147',
  outputDir: './src/generated',
  openApiPath: '/doc',
  generatedDir: 'generated'
}

/**
 * Fetch OpenAPI specification from server
 */
async function fetchOpenApiSpec(): Promise<object> {
  console.log('🔍 Fetching OpenAPI specification...')
  
  try {
    const response = await fetch(`${config.serverUrl}${config.openApiPath}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`)
    }
    
    const spec = await response.json()
    console.log('✅ OpenAPI specification fetched successfully')
    return spec
  } catch (error) {
    console.error('❌ Failed to fetch OpenAPI spec:', error)
    throw error
  }
}

/**
 * Generate TypeScript types from OpenAPI spec using openapi-typescript
 */
async function generateTypes(spec: object): Promise<void> {
  console.log('🏭 Generating TypeScript types...')
  
  // Ensure output directory exists
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true })
  }
  
  // Write spec to temporary file
  const specPath = join(config.outputDir, 'openapi-spec.json')
  writeFileSync(specPath, JSON.stringify(spec, null, 2))
  
  // Generate types using openapi-typescript
  const typesPath = join(config.outputDir, 'api-types.ts')
  
  try {
    await execAsync(`bunx openapi-typescript ${specPath} --output ${typesPath}`)
    console.log('✅ TypeScript types generated successfully')
  } catch (error) {
    console.error('❌ Failed to generate types:', error)
    throw error
  }
}

/**
 * Generate type-safe client SDK from OpenAPI spec
 */
function generateTypeSafeClient(): void {
  console.log('🚀 Generating type-safe API client...')
  
  const clientContent = `/**
 * AUTO-GENERATED TYPE-SAFE API CLIENT
 * Generated at: ${new Date().toISOString()}
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import type { paths } from './api-types'

export type ApiPaths = paths

// Extract operation types for better IntelliSense
export type GetProjectsResponse = paths['/api/projects']['get']['responses']['200']['content']['application/json']
export type CreateProjectRequest = paths['/api/projects']['post']['requestBody']['content']['application/json']
export type CreateProjectResponse = paths['/api/projects']['post']['responses']['200']['content']['application/json']

export type GetTicketsResponse = paths['/api/tickets']['get']['responses']['200']['content']['application/json']
export type CreateTicketRequest = paths['/api/tickets']['post']['requestBody']['content']['application/json']
export type CreateTicketResponse = paths['/api/tickets']['post']['responses']['200']['content']['application/json']

export type GetChatsResponse = paths['/api/chats']['get']['responses']['200']['content']['application/json']
export type CreateChatRequest = paths['/api/chats']['post']['requestBody']['content']['application/json']
export type CreateChatResponse = paths['/api/chats']['post']['responses']['200']['content']['application/json']

export type GetQueuesResponse = paths['/api/queues']['get']['responses']['200']['content']['application/json']
export type CreateQueueRequest = paths['/api/queues']['post']['requestBody']['content']['application/json']
export type CreateQueueResponse = paths['/api/queues']['post']['responses']['200']['content']['application/json']

/**
 * Type-safe API client with full IntelliSense support
 */
export class TypeSafeApiClient {
  constructor(private baseUrl: string = 'http://localhost:3147') {}

  // Projects
  async getProjects(): Promise<GetProjectsResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/projects\`)
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  async createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/projects\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  // Tickets  
  async getTickets(): Promise<GetTicketsResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/tickets\`)
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  async createTicket(data: CreateTicketRequest): Promise<CreateTicketResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/tickets\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  // Chats
  async getChats(): Promise<GetChatsResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/chats\`)
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  async createChat(data: CreateChatRequest): Promise<CreateChatResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/chats\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  // Queues
  async getQueues(): Promise<GetQueuesResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/queues\`)
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }

  async createQueue(data: CreateQueueRequest): Promise<CreateQueueResponse> {
    const response = await fetch(\`\${this.baseUrl}/api/queues\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
    return response.json()
  }
}

/**
 * Factory function for creating the type-safe API client
 */
export function createTypeSafeClient(baseUrl?: string): TypeSafeApiClient {
  return new TypeSafeApiClient(baseUrl)
}
`
  
  const clientPath = join(config.outputDir, 'type-safe-client.ts')
  writeFileSync(clientPath, clientContent)
  
  console.log('✅ Type-safe API client generated successfully')
}

/**
 * Create basic index file (hooks will be added by advanced hooks generator)
 */
function createGeneratedIndex(): void {
  console.log('📝 Creating generated index file...')
  
  const indexContent = `/**
 * AUTO-GENERATED API CLIENT
 * Generated at: ${new Date().toISOString()}
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

// Type-safe API types
export * from './api-types'

// Type-safe API client
export * from './type-safe-client'

// OpenAPI specification  
export { default as openApiSpec } from './openapi-spec.json'

// Note: Advanced React Query hooks and provider are added by generate-advanced-hooks.ts
`
  
  const indexPath = join(config.outputDir, 'index.ts')
  writeFileSync(indexPath, indexContent)
  
  console.log('✅ Generated index file created')
}

/**
 * Main generation function
 */
async function generateApiClient(): Promise<void> {
  console.log('🎯 Starting API client generation...')
  console.log(`📍 Server URL: ${config.serverUrl}`)
  console.log(`📂 Output directory: ${config.outputDir}`)
  
  try {
    // Step 1: Fetch OpenAPI spec
    const spec = await fetchOpenApiSpec()
    
    // Step 2: Generate TypeScript types
    await generateTypes(spec)
    
    // Step 3: Generate type-safe client
    generateTypeSafeClient()
    
    // Step 4: Create index file
    createGeneratedIndex()
    
    console.log('🎉 API client generation completed successfully!')
    console.log(`📦 Generated files available in: ${config.outputDir}`)
    
  } catch (error) {
    console.error('💥 API client generation failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.main) {
  generateApiClient()
}

export { generateApiClient, config }
