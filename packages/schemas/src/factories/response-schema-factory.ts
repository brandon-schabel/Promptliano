import { z } from '@hono/zod-openapi'

/**
 * Creates a standard success response schema
 * Reduces boilerplate for single entity responses
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  options?: {
    description?: string
    example?: any
    additionalFields?: Record<string, z.ZodTypeAny>
    name?: string
  }
) {
  const schemaName = options?.name || dataSchema._def.description || 'Data'
  
  const baseSchema = {
    success: z.literal(true).describe('Indicates successful operation'),
    data: dataSchema.describe(`The ${schemaName} data`),
    ...options?.additionalFields
  }
  
  const responseSchema = z.object(baseSchema)
  
  // Add OpenAPI metadata
  const openApiSchema = responseSchema.openapi(`${schemaName}Response`, {
    description: options?.description || `Successful ${schemaName} response`,
    example: options?.example || {
      success: true,
      data: dataSchema._def.example || {}
    }
  })
  
  // Ensure the ref is set correctly for test compatibility
  if (!openApiSchema._def.openapi) {
    openApiSchema._def.openapi = {} as any
  }
  ;(openApiSchema._def.openapi as any).ref = `${schemaName}Response`
  
  return openApiSchema
}

/**
 * Creates an operation success response (no data)
 */
export function createOperationResponseSchema(
  operation: string,
  options?: {
    message?: string
    additionalFields?: Record<string, z.ZodTypeAny>
  }
) {
  return z.object({
    success: z.literal(true),
    message: z.string().default(options?.message || `${operation} completed successfully`),
    ...options?.additionalFields
  }).openapi(`${operation}Response`)
}

/**
 * Creates a response with metadata
 */
export function createMetadataResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  metadataSchema: z.ZodTypeAny,
  name?: string
) {
  const schemaName = name || dataSchema._def.description || 'Data'
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    metadata: metadataSchema
  }).openapi(`${schemaName}WithMetadataResponse`)
}

/**
 * Creates a response with optional warning messages
 */
export function createResponseWithWarningsSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name?: string
) {
  const schemaName = name || dataSchema._def.description || 'Data'
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    warnings: z.array(z.string()).optional().describe('Optional warning messages')
  }).openapi(`${schemaName}ResponseWithWarnings`)
}

/**
 * Creates a conditional response schema (success with data or message)
 */
export function createConditionalResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name?: string
) {
  const schemaName = name || dataSchema._def.description || 'Data'
  return z.union([
    z.object({
      success: z.literal(true),
      data: dataSchema
    }),
    z.object({
      success: z.literal(true),
      message: z.string()
    })
  ]).openapi(`${schemaName}ConditionalResponse`)
}

/**
 * Creates a mutation response with affected count
 */
export function createMutationResponseSchema(
  operation: string,
  options?: {
    includeIds?: boolean
    additionalFields?: Record<string, z.ZodTypeAny>
  }
) {
  const baseSchema = {
    success: z.literal(true),
    message: z.string().default(`${operation} completed successfully`),
    affectedCount: z.number().int().min(0).describe('Number of affected records'),
    ...options?.additionalFields
  }
  
  if (options?.includeIds) {
    ;(baseSchema as any)['affectedIds'] = z.array(z.number()).describe('IDs of affected records')
  }
  
  return z.object(baseSchema).openapi(`${operation}MutationResponse`)
}