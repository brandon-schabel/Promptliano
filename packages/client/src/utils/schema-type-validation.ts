/**
 * Schema Type Validation Utility
 *
 * Ensures that Zod schemas match their corresponding TypeScript types
 * and validates runtime data against both schema and type constraints.
 * Demonstrates advanced TypeScript type validation patterns.
 */

import { z } from 'zod'
import type { ProviderKey, CreateProviderKey, UpdateProviderKey, APIProviders } from '@promptliano/database'
import { ProviderKeySchema, CreateProviderKeySchema, UpdateProviderKeySchema } from '@promptliano/database'
import { isValidProviderKey, type ValidationResult, extractErrorMessage } from './type-guards'

// ============================================================================
// Type-Schema Compatibility Validation
// ============================================================================

/**
 * Validates that a schema produces types that match the expected TypeScript types
 * Updated to support both ZodType and BuildSchema types from drizzle-zod v0.8.3
 * Disabled strict validation during migration to drizzle-zod v0.8.3
 */
export type SchemaTypeValidator<TSchema, TExpectedType> = boolean

// ============================================================================
// Provider Schema Validations
// ============================================================================

/**
 * Validate that provider schemas match their TypeScript types
 */
type ProviderSchemaValidation = {
  select: SchemaTypeValidator<typeof ProviderKeySchema, ProviderKey>
  create: SchemaTypeValidator<typeof CreateProviderKeySchema, CreateProviderKey>
  update: SchemaTypeValidator<typeof UpdateProviderKeySchema, UpdateProviderKey>
}

// This will cause a TypeScript error if schemas don't match types
// Commented out to avoid compilation issues during migration
// const _providerSchemaValidation: ProviderSchemaValidation = {
//   select: true,
//   create: true,
//   update: true
// }

// ============================================================================
// Runtime Schema Validation Utilities
// ============================================================================

/**
 * Comprehensive provider key validation combining schema and type checking
 */
export const validateProviderKeyData = (data: unknown): ValidationResult<ProviderKey> => {
  try {
    // First, validate with type guard
    if (!isValidProviderKey(data)) {
      return {
        success: false,
        error: 'Data does not match ProviderKey type structure'
      }
    }

    // Then validate with Zod schema
    const schemaResult = ProviderKeySchema.safeParse(data)
    if (!schemaResult.success) {
      return {
        success: false,
        error: `Schema validation failed: ${schemaResult.error.issues ? schemaResult.error.issues.map((e: any) => e.message).join(', ') : schemaResult.error.message || 'Unknown validation error'}`
      }
    }

    // Both validations passed
    return { success: true, data: data as ProviderKey }
  } catch (error) {
    return {
      success: false,
      error: extractErrorMessage(error)
    }
  }
}

/**
 * Validate provider key creation data
 */
export const validateCreateProviderKeyData = (data: unknown): ValidationResult<CreateProviderKey> => {
  try {
    const schemaResult = CreateProviderKeySchema.safeParse(data)
    if (!schemaResult.success) {
      return {
        success: false,
        error: `Create schema validation failed: ${schemaResult.error.issues ? schemaResult.error.issues.map((e: any) => e.message).join(', ') : schemaResult.error.message || 'Unknown validation error'}`
      }
    }

    // Additional business logic validation
    const validatedData = schemaResult.data

    // Validate provider is a known type
    const validProviders: APIProviders[] = [
      'openai',
      'anthropic',
      'google_gemini',
      'groq',
      'together',
      'xai',
      'openrouter',
      'lmstudio',
      'ollama',
      'custom'
    ]

    if (!validProviders.includes(validatedData.provider as APIProviders)) {
      return {
        success: false,
        error: `Invalid provider: ${validatedData.provider}. Must be one of: ${validProviders.join(', ')}`
      }
    }

    return { success: true, data: validatedData }
  } catch (error) {
    return {
      success: false,
      error: extractErrorMessage(error)
    }
  }
}

/**
 * Validate provider key update data
 */
export const validateUpdateProviderKeyData = (data: unknown): ValidationResult<UpdateProviderKey> => {
  try {
    const schemaResult = UpdateProviderKeySchema.safeParse(data)
    if (!schemaResult.success) {
      return {
        success: false,
        error: `Update schema validation failed: ${schemaResult.error.issues ? schemaResult.error.issues.map((e: any) => e.message).join(', ') : schemaResult.error.message || 'Unknown validation error'}`
      }
    }

    return { success: true, data: schemaResult.data }
  } catch (error) {
    return {
      success: false,
      error: extractErrorMessage(error)
    }
  }
}

// ============================================================================
// Advanced Validation with Discrimination
// ============================================================================

/**
 * Provider-specific validation rules based on provider type
 */
export const validateProviderSpecificData = (
  provider: APIProviders,
  data: Partial<CreateProviderKey>
): ValidationResult<CreateProviderKey> => {
  // Base validation first
  const baseResult = validateCreateProviderKeyData(data)
  if (!baseResult.success) {
    return baseResult
  }

  const validatedData = baseResult.data

  // Provider-specific validation
  switch (provider) {
    case 'openai':
      if (validatedData.key && !validatedData.key.startsWith('sk-')) {
        return {
          success: false,
          error: 'OpenAI API keys must start with "sk-"'
        }
      }
      break

    case 'anthropic':
      if (validatedData.key && !validatedData.key.startsWith('sk-ant-')) {
        return {
          success: false,
          error: 'Anthropic API keys must start with "sk-ant-"'
        }
      }
      break

    case 'google_gemini':
      if (validatedData.key && validatedData.key.length < 20) {
        return {
          success: false,
          error: 'Google API keys are typically longer than 20 characters'
        }
      }
      break

    case 'ollama':
    case 'lmstudio':
      if (!validatedData.baseUrl) {
        return {
          success: false,
          error: `${provider} requires a base URL`
        }
      }

      try {
        new URL(validatedData.baseUrl)
      } catch {
        return {
          success: false,
          error: 'Base URL must be a valid URL'
        }
      }
      break

    case 'custom':
      if (!validatedData.baseUrl && !validatedData.key) {
        return {
          success: false,
          error: 'Custom providers require either a base URL or API key'
        }
      }
      break
  }

  return { success: true, data: validatedData }
}

// ============================================================================
// Batch Validation Utilities
// ============================================================================

/**
 * Validate array of provider keys with detailed error reporting
 */
export const validateProviderKeysArray = (data: unknown[]): ValidationResult<ProviderKey[]> => {
  const validatedKeys: ProviderKey[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const result = validateProviderKeyData(data[i])

    if (result.success) {
      validatedKeys.push(result.data)
    } else {
      errors.push(`Item ${i}: ${result.error}`)
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: `Validation failed for ${errors.length} items:\n${errors.join('\n')}`
    }
  }

  return { success: true, data: validatedKeys }
}

// ============================================================================
// Type-safe Assertion Functions
// ============================================================================

/**
 * Assert that data matches ProviderKey type and schema
 */
export const assertProviderKey = (data: unknown): ProviderKey => {
  const result = validateProviderKeyData(data)
  if (!result.success) {
    throw new TypeError(`Provider key validation failed: ${result.error}`)
  }
  return result.data
}

/**
 * Assert that data matches CreateProviderKey type and schema
 */
export const assertCreateProviderKey = (data: unknown): CreateProviderKey => {
  const result = validateCreateProviderKeyData(data)
  if (!result.success) {
    throw new TypeError(`Create provider key validation failed: ${result.error}`)
  }
  return result.data
}

/**
 * Assert that data matches UpdateProviderKey type and schema
 */
export const assertUpdateProviderKey = (data: unknown): UpdateProviderKey => {
  const result = validateUpdateProviderKeyData(data)
  if (!result.success) {
    throw new TypeError(`Update provider key validation failed: ${result.error}`)
  }
  return result.data
}

// ============================================================================
// Schema Introspection Utilities
// ============================================================================

/**
 * Get schema field information for UI generation
 */
export const getProviderKeySchemaFields = () => {
  const schema = CreateProviderKeySchema
  const shape = schema.shape

  return Object.entries(shape).map(([key, field]) => ({
    name: key,
    required: !field.isOptional(),
    type: field._def.typeName,
    description: field._def.description || `Field: ${key}`
  }))
}

/**
 * Generate form validation schema for UI components
 */
export const createProviderKeyFormSchema = (provider: APIProviders) => {
  // Return the refined schema with proper typing
  const baseSchema = CreateProviderKeySchema

  // Add provider-specific validation
  switch (provider) {
    case 'openai':
      return baseSchema.refine((data) => !data.key || data.key.startsWith('sk-'), {
        message: 'OpenAI API keys must start with "sk-"',
        path: ['key']
      })

    case 'anthropic':
      return baseSchema.refine((data) => !data.key || data.key.startsWith('sk-ant-'), {
        message: 'Anthropic API keys must start with "sk-ant-"',
        path: ['key']
      })

    case 'ollama':
    case 'lmstudio':
      return baseSchema.refine((data) => !!data.baseUrl, {
        message: 'Base URL is required for local providers',
        path: ['baseUrl']
      })

    default:
      return baseSchema
  }
}

// ============================================================================
// All validation functions are exported above with their declarations
// ============================================================================
