/**
 * Advanced Type Guards and Validation Utilities
 * 
 * Provides comprehensive type safety for API responses, provider data,
 * and model selection components. Implements advanced TypeScript patterns
 * for runtime type validation and error handling.
 */

import type { APIProviders, ProviderKey } from '@promptliano/database'

// ============================================================================
// Generic Type Guard Utilities
// ============================================================================

/**
 * Type predicate for checking if a value is a non-null object
 */
export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type predicate for checking if a value is a non-empty string
 */
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Type predicate for checking if a value is a valid number
 */
export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

// ============================================================================
// Provider Type Guards
// ============================================================================

/**
 * Type guard for valid API provider names
 */
export const isValidAPIProvider = (value: unknown): value is APIProviders => {
  const validProviders: APIProviders[] = [
    'openai',
    'openrouter', 
    'lmstudio',
    'ollama',
    'xai',
    'google_gemini',
    'anthropic',
    'groq',
    'together',
    'custom'
  ]
  return typeof value === 'string' && validProviders.includes(value as APIProviders)
}

/**
 * Extended provider type guard that allows custom provider IDs
 */
export const isValidProviderIdentifier = (value: unknown): value is APIProviders | string => {
  if (isValidAPIProvider(value)) {
    return true
  }
  
  // Allow custom provider IDs (e.g., "custom_123")
  return typeof value === 'string' && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value)
}

/**
 * Type guard for ProviderKey objects from database
 */
export const isValidProviderKey = (value: unknown): value is ProviderKey => {
  if (!isObject(value)) return false
  
  const obj = value as Record<string, unknown>
  
  return (
    // Required fields
    isValidNumber(obj.id) &&
    isNonEmptyString(obj.provider) &&
    isNonEmptyString(obj.keyName) &&
    isNonEmptyString(obj.encryptedValue) &&
    typeof obj.encrypted === 'boolean' &&
    typeof obj.isDefault === 'boolean' &&
    typeof obj.isActive === 'boolean' &&
    isValidNumber(obj.createdAt) &&
    isValidNumber(obj.updatedAt) &&
    // Optional fields
    (obj.name === null || typeof obj.name === 'undefined' || isNonEmptyString(obj.name)) &&
    (obj.key === null || typeof obj.key === 'undefined' || isNonEmptyString(obj.key)) &&
    (obj.baseUrl === null || typeof obj.baseUrl === 'undefined' || isNonEmptyString(obj.baseUrl)) &&
    (obj.customHeaders === null || typeof obj.customHeaders === 'undefined' || isObject(obj.customHeaders))
  )
}

// ============================================================================
// Model Type Guards
// ============================================================================

/**
 * Type guard for model objects from API responses
 */
export interface ValidatedModelData {
  id: string
  name: string
  description?: string
  provider?: string
  contextLength?: number
  isChat?: boolean
  isCompletion?: boolean
}

export const isValidModelData = (value: unknown): value is ValidatedModelData => {
  if (!isObject(value)) return false
  
  const obj = value as Record<string, unknown>
  
  return (
    isNonEmptyString(obj.id) &&
    isNonEmptyString(obj.name) &&
    // Optional fields
    (obj.description === null || typeof obj.description === 'undefined' || isNonEmptyString(obj.description)) &&
    (obj.provider === null || typeof obj.provider === 'undefined' || isNonEmptyString(obj.provider)) &&
    (obj.contextLength === null || typeof obj.contextLength === 'undefined' || isValidNumber(obj.contextLength)) &&
    (obj.isChat === null || typeof obj.isChat === 'undefined' || typeof obj.isChat === 'boolean') &&
    (obj.isCompletion === null || typeof obj.isCompletion === 'undefined' || typeof obj.isCompletion === 'boolean')
  )
}

// ============================================================================
// API Response Type Guards
// ============================================================================

/**
 * Generic type guard for API data responses
 */
export interface DataResponse<T> {
  data: T
  success?: boolean
  message?: string
  error?: string
}

export const isValidDataResponse = <T>(
  value: unknown,
  validator: (data: unknown) => data is T
): value is DataResponse<T> => {
  if (!isObject(value)) return false
  
  const obj = value as Record<string, unknown>
  
  return (
    'data' in obj &&
    validator(obj.data) &&
    (obj.success === undefined || typeof obj.success === 'boolean') &&
    (obj.message === undefined || typeof obj.message === 'string') &&
    (obj.error === undefined || typeof obj.error === 'string')
  )
}

/**
 * Type guard for models API response
 */
export const isValidModelsResponse = (value: unknown): value is DataResponse<ValidatedModelData[]> => {
  return isValidDataResponse(value, (data): data is ValidatedModelData[] => {
    return Array.isArray(data) && data.every(isValidModelData)
  })
}

/**
 * Type guard for providers API response
 */
export const isValidProvidersResponse = (value: unknown): value is DataResponse<ProviderKey[]> => {
  return isValidDataResponse(value, (data): data is ProviderKey[] => {
    return Array.isArray(data) && data.every(isValidProviderKey)
  })
}

// ============================================================================
// Advanced Validation with Error Details
// ============================================================================

/**
 * Result type for validation operations
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; path?: string }

/**
 * Validates and transforms model data with detailed error reporting
 */
export const validateModelData = (value: unknown): ValidationResult<ValidatedModelData> => {
  if (!isObject(value)) {
    return { success: false, error: 'Expected object', path: 'root' }
  }
  
  const obj = value as Record<string, unknown>
  
  if (!isNonEmptyString(obj.id)) {
    return { success: false, error: 'Missing or invalid id', path: 'id' }
  }
  
  if (!isNonEmptyString(obj.name)) {
    return { success: false, error: 'Missing or invalid name', path: 'name' }
  }
  
  // Validate optional fields
  if (obj.description !== null && obj.description !== undefined && !isNonEmptyString(obj.description)) {
    return { success: false, error: 'Invalid description', path: 'description' }
  }
  
  if (obj.provider !== null && obj.provider !== undefined && !isNonEmptyString(obj.provider)) {
    return { success: false, error: 'Invalid provider', path: 'provider' }
  }
  
  if (obj.contextLength !== null && obj.contextLength !== undefined && !isValidNumber(obj.contextLength)) {
    return { success: false, error: 'Invalid context length', path: 'contextLength' }
  }
  
  return {
    success: true,
    data: {
      id: obj.id,
      name: obj.name,
      description: obj.description as string | undefined,
      provider: obj.provider as string | undefined,
      contextLength: obj.contextLength as number | undefined,
      isChat: obj.isChat as boolean | undefined,
      isCompletion: obj.isCompletion as boolean | undefined
    }
  }
}

/**
 * Validates array of models with error aggregation
 */
export const validateModelsArray = (value: unknown): ValidationResult<ValidatedModelData[]> => {
  if (!Array.isArray(value)) {
    return { success: false, error: 'Expected array', path: 'root' }
  }
  
  const validatedModels: ValidatedModelData[] = []
  
  for (let i = 0; i < value.length; i++) {
    const result = validateModelData(value[i])
    if (!result.success) {
      return { 
        success: false, 
        error: result.error, 
        path: `[${i}]${result.path ? '.' + result.path : ''}` 
      }
    }
    validatedModels.push(result.data)
  }
  
  return { success: true, data: validatedModels }
}

// ============================================================================
// Type Assertion Utilities
// ============================================================================

/**
 * Safely assert and transform unknown data to typed data
 */
export const assertValidModelData = (value: unknown): ValidatedModelData => {
  const result = validateModelData(value)
  if (!result.success) {
    throw new TypeError(`Model validation failed at ${result.path}: ${result.error}`)
  }
  return result.data
}

/**
 * Safely assert and transform unknown data to typed models array
 */
export const assertValidModelsArray = (value: unknown): ValidatedModelData[] => {
  const result = validateModelsArray(value)
  if (!result.success) {
    throw new TypeError(`Models array validation failed at ${result.path}: ${result.error}`)
  }
  return result.data
}

// ============================================================================
// Branded Types for Domain Safety
// ============================================================================

/**
 * Branded type for validated model IDs
 */
export type ValidatedModelId = string & { readonly __brand: 'ValidatedModelId' }

/**
 * Create a validated model ID
 */
export const createValidatedModelId = (id: string): ValidatedModelId => {
  if (!isNonEmptyString(id)) {
    throw new TypeError('Invalid model ID: must be a non-empty string')
  }
  return id as ValidatedModelId
}

/**
 * Branded type for validated provider identifiers  
 */
export type ValidatedProviderId = string & { readonly __brand: 'ValidatedProviderId' }

/**
 * Create a validated provider ID
 */
export const createValidatedProviderId = (id: string): ValidatedProviderId => {
  if (!isValidProviderIdentifier(id)) {
    throw new TypeError('Invalid provider ID: must be a valid provider identifier')
  }
  return id as ValidatedProviderId
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Safely extract error message from unknown error
 */
export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (isObject(error) && typeof error.message === 'string') {
    return error.message
  }
  
  return 'An unknown error occurred'
}

/**
 * Create a typed error with additional context
 */
export class TypeValidationError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly receivedValue?: unknown
  ) {
    super(message)
    this.name = 'TypeValidationError'
  }
}