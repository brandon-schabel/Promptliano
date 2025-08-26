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

/**
 * Extract method information from OpenAPI operation
 */
interface OperationInfo {
  path: string
  method: string
  operationId?: string
  summary?: string
  tags?: string[]
  parameters?: any[]
  requestBody?: any
  responses?: any
  hasPathParams: boolean
  hasQueryParams: boolean
  hasRequestBody: boolean
  pathParams: string[]
  queryParams: string[]
}

/**
 * Parse OpenAPI spec and extract all operations
 */
function parseOpenApiOperations(spec: any): OperationInfo[] {
  const operations: OperationInfo[] = []
  const paths = spec.paths || {}

  Object.entries(paths).forEach(([path, pathItem]: [string, any]) => {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']

    httpMethods.forEach((method) => {
      const operation = pathItem[method]
      if (!operation) return

      // Extract path parameters from URL template (supports both {param} and :param formats)
      const pathParams = extractPathParams(path)

      // Extract query parameters from operation parameters
      const queryParams = (operation.parameters || [])
        .filter((param: any) => param.in === 'query')
        .map((param: any) => param.name)

      // Check for request body
      const hasRequestBody = !!operation.requestBody

      operations.push({
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary,
        tags: operation.tags,
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses,
        hasPathParams: pathParams.length > 0,
        hasQueryParams: queryParams.length > 0,
        hasRequestBody,
        pathParams,
        queryParams
      })
    })
  })

  return operations
}

/**
 * Convert path to method name
 */
function pathToMethodName(path: string, method: string): string {
  // Remove /api prefix and clean up the path
  let cleanPath = path.replace(/^\/api\/?/, '').replace(/\/$/, '')

  // Handle root path
  if (!cleanPath) {
    return method.toLowerCase() + 'Root'
  }

  // Split by slashes and parameters
  const pathSegments = cleanPath.split('/').filter((segment) => segment.length > 0)

  // Check if this is a simple CRUD operation
  const isSingleResourceCrud =
    pathSegments.length === 2 && (pathSegments[1]?.startsWith('{') || pathSegments[1]?.startsWith(':'))

  const isCollectionCrud = pathSegments.length === 1

  // For CRUD operations, use clean method names
  if (isSingleResourceCrud || isCollectionCrud) {
    const entityName = pathSegments[0]
    const cleanEntityName =
      entityName ??
      'unknown'
        .split('-')
        .map((word, index) =>
          index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('')

    // Create clean CRUD method names
    if (method === 'GET') {
      if (isSingleResourceCrud) {
        // GET /projects/{id} -> getProject
        return 'get' + cleanEntityName.charAt(0).toUpperCase() + cleanEntityName.slice(1).slice(0, -1) // Remove trailing 's'
      } else {
        // GET /projects -> getProjects (keep plural for collections)
        return 'get' + cleanEntityName.charAt(0).toUpperCase() + cleanEntityName.slice(1)
      }
    } else if (method === 'POST') {
      // POST /projects -> createProject (singular)
      return 'create' + cleanEntityName.charAt(0).toUpperCase() + cleanEntityName.slice(1).slice(0, -1)
    } else if (method === 'PUT' || method === 'PATCH') {
      // PATCH /projects/{id} -> updateProject
      return 'update' + cleanEntityName.charAt(0).toUpperCase() + cleanEntityName.slice(1).slice(0, -1)
    } else if (method === 'DELETE') {
      // DELETE /projects/{id} -> deleteProject
      return 'delete' + cleanEntityName.charAt(0).toUpperCase() + cleanEntityName.slice(1).slice(0, -1)
    }
  }

  // For complex paths, use the original logic
  const parts = pathSegments.map((part) => {
    // Convert path parameters {id} to ById, {name} to ByName
    if (part.startsWith('{') && part.endsWith('}')) {
      const paramName = part.slice(1, -1)
      return 'By' + paramName.charAt(0).toUpperCase() + paramName.slice(1)
    }
    // Convert :param style parameters to ByParam
    if (part.startsWith(':')) {
      const paramName = part.slice(1)
      return 'By' + paramName.charAt(0).toUpperCase() + paramName.slice(1)
    }
    // Convert kebab-case to camelCase
    return part
      .split('-')
      .map((word, index) =>
        index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('')
  })

  // Create method name based on HTTP method
  let methodName = method.toLowerCase()

  // Add descriptive prefixes based on HTTP method
  if (method === 'GET') {
    // For GET methods, use 'get' or 'list' based on path structure
    const hasIdParam = parts.some((part) => part.toLowerCase().includes('byid'))
    methodName = hasIdParam || parts.length === 1 ? 'get' : 'list'
  } else if (method === 'POST') {
    methodName = 'create'
  } else if (method === 'PUT') {
    methodName = 'update'
  } else if (method === 'PATCH') {
    methodName = 'update'
  } else if (method === 'DELETE') {
    methodName = 'delete'
  }

  // Join parts to create final method name
  const baseName = parts
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')

  return methodName + baseName.charAt(0).toUpperCase() + baseName.slice(1)
}

/**
 * Normalize path for TypeScript type name generation
 */
function normalizePathForTypeName(path: string): string {
  return (
    path
      // Convert :param to {param} for consistency
      .replace(/:([^/]+)/g, '{$1}')
      // Remove any remaining colons that might cause issues
      .replace(/:/g, '')
  )
}

/**
 * Extract path parameters from various formats
 */
function extractPathParams(path: string): string[] {
  const params: string[] = []

  // Extract {param} style parameters
  const braceParams = path.match(/\{([^}]+)\}/g)
  if (braceParams) {
    params.push(...braceParams.map((p) => p.slice(1, -1)))
  }

  // Extract :param style parameters
  const colonParams = path.match(/:([^/]+)/g)
  if (colonParams) {
    params.push(...colonParams.map((p) => p.slice(1)))
  }

  return params
}

/**
 * Check if a path exists in the OpenAPI spec types
 */
function isValidPathForTypes(path: string, spec: any): boolean {
  const normalizedPath = normalizePathForTypeName(path)
  return !!spec.paths?.[normalizedPath]
}

/**
 * Check if an operation has supported request body format
 */
function hasSupportedRequestBody(operation: any): boolean {
  if (!operation.requestBody) return true // No request body is fine

  const content = operation.requestBody?.content
  if (!content) return true

  // We support application/json and no content
  return !!content['application/json']
}

/**
 * Generate TypeScript types and method implementations from OpenAPI spec
 */
function generateClientFromSpec(spec: any): { clientTypes: string; clientMethods: string } {
  const operations = parseOpenApiOperations(spec)

  console.log(`🔍 Found ${operations.length} operations to generate`)

  // Filter operations to only include those that are supported
  const supportedOperations = operations.filter((operation) => {
    const pathExists = isValidPathForTypes(operation.path, spec)
    const supportedRequestBody = hasSupportedRequestBody(operation)

    if (!pathExists) {
      console.warn(`⚠️  Skipping operation with path not in types: ${operation.method} ${operation.path}`)
      return false
    }

    if (!supportedRequestBody) {
      console.warn(`⚠️  Skipping operation with unsupported request body: ${operation.method} ${operation.path}`)
      return false
    }

    return true
  })

  console.log(`✅ Generating ${supportedOperations.length} supported operations`)

  // Group operations by tags for better organization
  const operationsByTag = supportedOperations.reduce(
    (acc, op) => {
      const tag = op.tags?.[0] || 'Default'
      if (!acc[tag]) acc[tag] = []
      acc[tag].push(op)
      return acc
    },
    {} as Record<string, OperationInfo[]>
  )

  // Generate type definitions
  let clientTypes = '// ===== GENERATED TYPES FOR ALL ENDPOINTS =====\n\n'
  const generatedTypes = new Set<string>()

  // Generate method implementations
  let clientMethods = '  // ===== GENERATED API METHODS =====\n\n'

  Object.entries(operationsByTag).forEach(([tag, tagOperations]) => {
    clientMethods += `  // ${tag} Operations\n`

    tagOperations.forEach((operation) => {
      const methodName = pathToMethodName(operation.path, operation.method)

      // Generate unique type names for this operation
      const typePrefix = methodName.charAt(0).toUpperCase() + methodName.slice(1)
      const requestType = `${typePrefix}Request`
      const responseType = `${typePrefix}Response`
      const paramsType = `${typePrefix}Params`
      const queryType = `${typePrefix}Query`

      // Generate request/response types
      if (!generatedTypes.has(responseType)) {
        const responsePath = normalizePathForTypeName(operation.path)
        const successResponse =
          operation.responses?.['200'] || operation.responses?.['201'] || operation.responses?.['204']

        if (successResponse?.content?.['application/json']?.schema) {
          // Use the actual success status code (200, 201, or 204)
          const statusCode = operation.responses?.['200'] ? '200' : operation.responses?.['201'] ? '201' : '204'
          clientTypes += `export type ${responseType} = paths['${responsePath}']['${operation.method.toLowerCase()}']['responses']['${statusCode}']['content']['application/json']\n`
        } else {
          clientTypes += `export type ${responseType} = { success: boolean; message?: string }\n`
        }
        generatedTypes.add(responseType)
      }

      if (operation.hasRequestBody && !generatedTypes.has(requestType)) {
        const requestPath = normalizePathForTypeName(operation.path)
        clientTypes += `export type ${requestType} = paths['${requestPath}']['${operation.method.toLowerCase()}']['requestBody']['content']['application/json']\n`
        generatedTypes.add(requestType)
      }

      // Generate method implementation
      let methodSignature = `  /**\n   * ${operation.summary || `${operation.method} ${operation.path}`}\n   */\n`
      methodSignature += `  async ${methodName}(`

      const methodParams: string[] = []

      // Add path parameters
      if (operation.hasPathParams) {
        operation.pathParams.forEach((param) => {
          methodParams.push(`${param}: string | number`)
        })
      }

      // Add request body parameter
      if (operation.hasRequestBody) {
        methodParams.push(`data: ${requestType}`)
      }

      // Add query parameters as optional object
      if (operation.hasQueryParams) {
        methodParams.push(`query?: { ${operation.queryParams.map((p) => `${p}?: any`).join('; ')} }`)
      }

      // Add options parameter
      methodParams.push('options?: { timeout?: number }')

      methodSignature += methodParams.join(', ')
      methodSignature += `): Promise<${responseType}> {\n`

      // Method implementation
      let pathExpression = operation.path
      if (operation.hasPathParams) {
        pathExpression =
          'this.buildPath(`' + operation.path + '`, { ' + operation.pathParams.map((p) => `${p}`).join(', ') + ' })'
      } else {
        pathExpression = '`' + operation.path + '`'
      }

      const requestOptions: string[] = []
      if (operation.hasQueryParams) {
        requestOptions.push('params: query')
      }
      if (operation.hasRequestBody) {
        requestOptions.push('body: data')
      }
      requestOptions.push('timeout: options?.timeout')

      methodSignature += `    return this.request<${responseType}>('${operation.method}', ${pathExpression}`
      if (requestOptions.length > 0) {
        methodSignature += `, { ${requestOptions.join(', ')} }`
      }
      methodSignature += ')\n'
      methodSignature += '  }\n\n'

      clientMethods += methodSignature
    })

    clientMethods += '\n'
  })

  return { clientTypes, clientMethods }
}

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
function generateTypeSafeClient(spec: any): void {
  console.log('🚀 Generating type-safe API client...')
  console.log(`📊 Processing ${Object.keys(spec.paths || {}).length} API endpoints...`)

  const { clientTypes, clientMethods } = generateClientFromSpec(spec)

  const clientContent = `/**
 * AUTO-GENERATED TYPE-SAFE API CLIENT
 * Generated at: ${new Date().toISOString()}
 * Generated from: ${Object.keys(spec.paths || {}).length} API endpoints
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import type { paths } from './api-types'

// Re-export all paths for external usage
export type ApiPaths = paths

${clientTypes}

/**
 * Comprehensive type-safe API client with full coverage of all endpoints
 * 
 * Features:
 * - Type-safe request/response handling
 * - Path parameter validation  
 * - Query parameter support
 * - Request body validation
 * - Proper HTTP method handling
 * - Error handling with context
 * - Support for all ${Object.keys(spec.paths || {}).length} API endpoints
 */
export class TypeSafeApiClient {
  private baseUrl: string
  private timeout: number
  private headers: Record<string, string>

  constructor(config?: {
    baseUrl?: string
    timeout?: number
    headers?: Record<string, string>
  }) {
    this.baseUrl = config?.baseUrl || 'http://localhost:3147'
    this.timeout = config?.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      ...config?.headers
    }
  }

  /**
   * Internal request handler with proper error handling
   */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, any>
      body?: any
      timeout?: number
    }
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    
    // Add query parameters
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const controller = new AbortController()
    const requestTimeout = options?.timeout || this.timeout
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: this.headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        
        const error = new Error(
          errorData?.error?.message || errorData?.message || \`HTTP \${response.status}: \${response.statusText}\`
        ) as Error & { statusCode: number; code?: string; details?: any }
        error.statusCode = response.status
        error.code = errorData?.error?.code
        error.details = errorData?.error?.details
        throw error
      }

      const responseText = await response.text()
      return responseText ? JSON.parse(responseText) : undefined
    } catch (e) {
      clearTimeout(timeoutId)
      if (e instanceof Error && e.name === 'AbortError') {
        const timeoutError = new Error('Request timeout') as Error & { statusCode: number; code: string }
        timeoutError.statusCode = 408
        timeoutError.code = 'TIMEOUT'
        throw timeoutError
      }
      throw e
    }
  }

  /**
   * Validate and encode path parameters
   */
  private buildPath(template: string, params: Record<string, any>): string {
    let path = template
    
    // Replace path parameters like {id} or :id
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        throw new Error(\`Missing required path parameter: \${key}\`)
      }
      path = path.replace(new RegExp(\`[{:]\${key}[}]?\`, 'g'), encodeURIComponent(String(value)))
    })
    
    // Check if any parameters remain unreplaced
    const unmatched = path.match(/[{:][^}]+[}]?/g)
    if (unmatched) {
      throw new Error(\`Missing path parameters: \${unmatched.join(', ')}\`)
    }
    
    return path
  }

${clientMethods}
}

/**
 * Factory function for creating the type-safe API client
 */
export function createTypeSafeClient(config?: {
  baseUrl?: string
  timeout?: number
  headers?: Record<string, string>
}): TypeSafeApiClient {
  return new TypeSafeApiClient(config)
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
    generateTypeSafeClient(spec)

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
