import { z } from '@hono/zod-openapi'

/**
 * Schema factory options
 */
export interface SchemaFactoryOptions {
  name?: string
  description?: string
}

/**
 * Create a success response schema with data
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T, options: SchemaFactoryOptions = {}) {
  const schema = z.object({
    success: z.literal(true),
    data: dataSchema
  })

  if (options.name) {
    return schema.openapi(`${options.name}Response`)
  }

  return schema
}

/**
 * Create a list response schema
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T, options: SchemaFactoryOptions = {}) {
  const schema = z.object({
    success: z.literal(true),
    data: z.array(itemSchema)
  })

  if (options.name) {
    return schema.openapi(`${options.name}ListResponse`)
  }

  return schema
}

/**
 * Create an operation response schema (no data, just message)
 */
export function createOperationResponseSchema(operation: string, options: SchemaFactoryOptions = {}) {
  const schema = z.object({
    success: z.literal(true),
    message: z.string()
  })

  if (options.name) {
    return schema.openapi(`${options.name}OperationResponse`)
  }

  return schema
}

/**
 * Create a metadata response schema
 */
export function createMetadataResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  metadataSchema: z.ZodTypeAny,
  options: SchemaFactoryOptions = {}
) {
  const schema = z.object({
    success: z.literal(true),
    data: dataSchema,
    metadata: metadataSchema
  })

  if (options.name) {
    return schema.openapi(`${options.name}MetadataResponse`)
  }

  return schema
}
