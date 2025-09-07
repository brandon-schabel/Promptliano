/**
 * Schema Transformers - Handle JSON to TypeScript Type Conversions
 * 
 * These utilities handle the conversion between Drizzle's Json types
 * and proper TypeScript types for API validation and client consumption.
 */

import { z } from '@hono/zod-openapi'

// =============================================================================
// JSON FIELD TRANSFORMERS
// =============================================================================

/**
 * Transform JSON field to string array
 */
export const jsonToStringArraySchema = () => 
  z.union([
    z.string(),
    z.array(z.string()),
    z.null()
  ]).transform((val): string[] => {
    if (val === null || val === undefined) return []
    if (Array.isArray(val)) return val
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  })

/**
 * Transform JSON field to number array
 */
export const jsonToNumberArraySchema = () =>
  z.union([
    z.string(),
    z.array(z.number()),
    z.null()
  ]).transform((val): number[] => {
    if (val === null || val === undefined) return []
    if (Array.isArray(val)) return val.filter(x => typeof x === 'number')
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'number') : []
      } catch {
        return []
      }
    }
    return []
  })

/**
 * Transform JSON field to record object
 */
export const jsonToRecordSchema = <T extends Record<string, any>>() =>
  z.union([
    z.string(),
    z.record(z.string(), z.any()),
    z.null()
  ]).transform((val): T | null => {
    if (val === null || val === undefined) return null
    if (typeof val === 'object' && !Array.isArray(val)) return val as T
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null
      } catch {
        return null
      }
    }
    return null
  })

/**
 * Transform JSON field to any object
 */
export const jsonToObjectSchema = () =>
  z.union([
    z.string(),
    z.any(),
    z.null()
  ]).transform((val): any => {
    if (val === null || val === undefined) return null
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return val
      }
    }
    return val
  })

// =============================================================================
// SCHEMA EXTENSION HELPERS
// =============================================================================

/**
 * Extend a base schema with JSON field transformations
 */
export function withJsonTransforms(
  baseSchema: any,
  transforms: Record<string, any>
) {
  // Handle both old ZodObject types and new BuildSchema types
  if (typeof baseSchema.extend === 'function') {
    return baseSchema.extend(transforms)
  }
  // Fallback for schemas without extend method
  return baseSchema
}

/**
 * Common field transformations for entities with JSON fields
 */
export const commonJsonTransforms = {
  // Array fields
  tags: jsonToStringArraySchema(),
  suggestedFileIds: jsonToStringArraySchema(),
  suggestedAgentIds: jsonToStringArraySchema(),
  suggestedPromptIds: jsonToNumberArraySchema(),
  dependencies: jsonToNumberArraySchema(),
  
  // Object fields
  customHeaders: jsonToRecordSchema<Record<string, string>>(),
  metadata: jsonToRecordSchema<Record<string, any>>(),
  tabData: jsonToRecordSchema<Record<string, any>>(),
  args: jsonToRecordSchema<Record<string, any>>(),
  
  // Complex object fields with specific types
  imports: jsonToObjectSchema(),
  exports: jsonToObjectSchema(),
  message: jsonToObjectSchema(),
  toolUseResult: jsonToObjectSchema(),
  tagger: jsonToObjectSchema()
} as const

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Infer the output type from a transformed schema
 */
export type InferTransformed<T extends z.ZodSchema> = z.infer<T>

/**
 * Create a transformed select schema from a base Drizzle select schema
 */
export function createTransformedSelectSchema(
  baseSchema: any,
  transforms: Record<string, any>
) {
  return withJsonTransforms(baseSchema, transforms)
}

/**
 * Create insert/update schemas with proper array handling
 */
export function createTransformedInsertSchema(
  baseSchema: any,
  omitFields: string[] = ['id', 'createdAt', 'updatedAt']
) {
  // Handle both old ZodObject types and new BuildSchema types
  if (typeof baseSchema.omit === 'function') {
    // Only omit fields that actually exist in the schema to avoid errors
    const validOmitFields = omitFields.filter(field => {
      // Check if field exists in the schema shape
      return baseSchema._zod?.def?.shape?.[field] || baseSchema._def?.shape?.[field]
    })
    
    if (validOmitFields.length === 0) {
      return baseSchema // No fields to omit
    }
    
    const omitObject = validOmitFields.reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {} as Record<string, true>)
    
    return baseSchema.omit(omitObject)
  }
  
  // Fallback for schemas without omit method
  return baseSchema
}

/**
 * Validation helpers for runtime JSON parsing
 */
export const validateJsonField = {
  stringArray: (value: unknown): string[] => {
    const result = jsonToStringArraySchema().safeParse(value)
    return result.success ? result.data : []
  },
  
  numberArray: (value: unknown): number[] => {
    const result = jsonToNumberArraySchema().safeParse(value)
    return result.success ? result.data : []
  },
  
  record: <T extends Record<string, any>>(value: unknown): T | null => {
    const result = jsonToRecordSchema<T>().safeParse(value)
    return result.success ? result.data : null
  }
}
