/**
 * Unified Error Code Mapping
 * 
 * Provides consistent error codes and mappings between backend ErrorFactory
 * and frontend error classification system
 * 
 * @module ErrorCodeMapping
 */

/**
 * Standard error codes used throughout the application
 */
export const ERROR_CODES = {
  // Entity Errors (404, 409)
  NOT_FOUND: 'NOT_FOUND',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DUPLICATE: 'DUPLICATE',
  
  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  
  // Operation Errors (500)
  OPERATION_FAILED: 'OPERATION_FAILED',
  CREATE_FAILED: 'CREATE_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  
  // Auth Errors (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Service Errors (500, 503, 429)
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic Errors (400, 422)
  INVALID_STATE: 'INVALID_STATE',
  INVALID_RELATIONSHIP: 'INVALID_RELATIONSHIP',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  CONFLICT: 'CONFLICT',
  
  // Network & System
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // AI-Specific Errors
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_CONTEXT_LENGTH: 'AI_CONTEXT_LENGTH',
  AI_MODEL_ERROR: 'AI_MODEL_ERROR',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

/**
 * Error category mapping for frontend classification
 */
export type ErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'client' | 'ai' | 'unknown'

/**
 * Map error codes to frontend categories
 */
export const ERROR_CODE_TO_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  // Network errors
  [ERROR_CODES.NETWORK_ERROR]: 'network',
  [ERROR_CODES.TIMEOUT]: 'network',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'network',
  
  // Auth errors
  [ERROR_CODES.UNAUTHORIZED]: 'auth',
  [ERROR_CODES.FORBIDDEN]: 'auth',
  [ERROR_CODES.TOKEN_EXPIRED]: 'auth',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'auth',
  
  // Validation errors
  [ERROR_CODES.VALIDATION_ERROR]: 'validation',
  [ERROR_CODES.INVALID_INPUT]: 'validation',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'validation',
  [ERROR_CODES.INVALID_PARAMETER]: 'validation',
  [ERROR_CODES.INVALID_STATE]: 'validation',
  [ERROR_CODES.INVALID_RELATIONSHIP]: 'validation',
  [ERROR_CODES.BUSINESS_RULE_VIOLATION]: 'validation',
  
  // Server errors
  [ERROR_CODES.OPERATION_FAILED]: 'server',
  [ERROR_CODES.CREATE_FAILED]: 'server',
  [ERROR_CODES.UPDATE_FAILED]: 'server',
  [ERROR_CODES.DELETE_FAILED]: 'server',
  [ERROR_CODES.DATABASE_ERROR]: 'server',
  [ERROR_CODES.FILE_SYSTEM_ERROR]: 'server',
  [ERROR_CODES.INTERNAL_ERROR]: 'server',
  
  // Client errors
  [ERROR_CODES.NOT_FOUND]: 'client',
  [ERROR_CODES.ENTITY_NOT_FOUND]: 'client',
  [ERROR_CODES.ALREADY_EXISTS]: 'client',
  [ERROR_CODES.DUPLICATE]: 'client',
  [ERROR_CODES.CONFLICT]: 'client',
  
  // AI errors
  [ERROR_CODES.AI_RATE_LIMIT]: 'ai',
  [ERROR_CODES.AI_CONTEXT_LENGTH]: 'ai',
  [ERROR_CODES.AI_MODEL_ERROR]: 'ai',
  [ERROR_CODES.AI_PROVIDER_ERROR]: 'ai',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'ai',
  
  // External service errors
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'server',
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Map error codes to severity levels
 */
export const ERROR_CODE_TO_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  // Critical - System failures
  [ERROR_CODES.NETWORK_ERROR]: 'critical',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'critical',
  [ERROR_CODES.DATABASE_ERROR]: 'critical',
  [ERROR_CODES.INTERNAL_ERROR]: 'critical',
  
  // High - Auth and security
  [ERROR_CODES.UNAUTHORIZED]: 'high',
  [ERROR_CODES.FORBIDDEN]: 'high',
  [ERROR_CODES.TOKEN_EXPIRED]: 'high',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'high',
  
  // Medium - User errors and validation
  [ERROR_CODES.VALIDATION_ERROR]: 'medium',
  [ERROR_CODES.INVALID_INPUT]: 'medium',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'medium',
  [ERROR_CODES.INVALID_PARAMETER]: 'medium',
  [ERROR_CODES.NOT_FOUND]: 'medium',
  [ERROR_CODES.ENTITY_NOT_FOUND]: 'medium',
  [ERROR_CODES.ALREADY_EXISTS]: 'medium',
  [ERROR_CODES.DUPLICATE]: 'medium',
  [ERROR_CODES.CONFLICT]: 'medium',
  [ERROR_CODES.INVALID_STATE]: 'medium',
  [ERROR_CODES.INVALID_RELATIONSHIP]: 'medium',
  [ERROR_CODES.BUSINESS_RULE_VIOLATION]: 'medium',
  
  // Low - Recoverable operations
  [ERROR_CODES.OPERATION_FAILED]: 'low',
  [ERROR_CODES.CREATE_FAILED]: 'low',
  [ERROR_CODES.UPDATE_FAILED]: 'low',
  [ERROR_CODES.DELETE_FAILED]: 'low',
  [ERROR_CODES.FILE_SYSTEM_ERROR]: 'low',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'low',
  [ERROR_CODES.AI_RATE_LIMIT]: 'low',
  [ERROR_CODES.AI_CONTEXT_LENGTH]: 'low',
  [ERROR_CODES.AI_MODEL_ERROR]: 'low',
  [ERROR_CODES.AI_PROVIDER_ERROR]: 'low',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'low',
  [ERROR_CODES.TIMEOUT]: 'low',
}

/**
 * Determine if an error is retryable based on its code
 */
export function isRetryableErrorCode(code: ErrorCode): boolean {
  const retryableCodes: ErrorCode[] = [
    ERROR_CODES.NETWORK_ERROR,
    ERROR_CODES.TIMEOUT,
    ERROR_CODES.SERVICE_UNAVAILABLE,
    ERROR_CODES.DATABASE_ERROR,
    ERROR_CODES.OPERATION_FAILED,
    ERROR_CODES.EXTERNAL_SERVICE_ERROR,
    ERROR_CODES.AI_RATE_LIMIT,
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ]
  
  return retryableCodes.includes(code)
}

/**
 * Get user-friendly message for error code
 */
export function getUserMessageForCode(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ERROR_CODES.NOT_FOUND]: 'The requested item could not be found.',
    [ERROR_CODES.ENTITY_NOT_FOUND]: 'The requested item could not be found.',
    [ERROR_CODES.ALREADY_EXISTS]: 'This item already exists.',
    [ERROR_CODES.DUPLICATE]: 'Duplicate item detected.',
    
    [ERROR_CODES.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided.',
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required information is missing.',
    [ERROR_CODES.INVALID_PARAMETER]: 'Invalid parameter provided.',
    
    [ERROR_CODES.OPERATION_FAILED]: 'The operation failed. Please try again.',
    [ERROR_CODES.CREATE_FAILED]: 'Failed to create item. Please try again.',
    [ERROR_CODES.UPDATE_FAILED]: 'Failed to update item. Please try again.',
    [ERROR_CODES.DELETE_FAILED]: 'Failed to delete item. Please try again.',
    
    [ERROR_CODES.UNAUTHORIZED]: 'Please sign in to continue.',
    [ERROR_CODES.FORBIDDEN]: 'You don\'t have permission to perform this action.',
    [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
    [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid credentials provided.',
    
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
    [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down.',
    [ERROR_CODES.DATABASE_ERROR]: 'Database error occurred. Please try again.',
    [ERROR_CODES.FILE_SYSTEM_ERROR]: 'File system error occurred.',
    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service error occurred.',
    
    [ERROR_CODES.INVALID_STATE]: 'Invalid state transition.',
    [ERROR_CODES.INVALID_RELATIONSHIP]: 'Invalid relationship between items.',
    [ERROR_CODES.BUSINESS_RULE_VIOLATION]: 'Business rule violation detected.',
    [ERROR_CODES.CONFLICT]: 'A conflict occurred. Please refresh and try again.',
    
    [ERROR_CODES.NETWORK_ERROR]: 'Network connection error. Please check your connection.',
    [ERROR_CODES.TIMEOUT]: 'The request timed out. Please try again.',
    [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred. Please try again.',
    
    [ERROR_CODES.AI_RATE_LIMIT]: 'AI rate limit reached. Please try again later.',
    [ERROR_CODES.AI_CONTEXT_LENGTH]: 'Message too long for AI model.',
    [ERROR_CODES.AI_MODEL_ERROR]: 'AI model error occurred.',
    [ERROR_CODES.AI_PROVIDER_ERROR]: 'AI provider error occurred.',
  }
  
  return messages[code] || 'An unexpected error occurred.'
}

/**
 * Extract error code from various error formats
 */
export function extractErrorCode(error: any): ErrorCode | undefined {
  // Direct error code
  if (error?.code && Object.values(ERROR_CODES).includes(error.code)) {
    return error.code as ErrorCode
  }
  
  // Nested error code
  if (error?.error?.code && Object.values(ERROR_CODES).includes(error.error.code)) {
    return error.error.code as ErrorCode
  }
  
  // From details
  if (error?.details?.code && Object.values(ERROR_CODES).includes(error.details.code)) {
    return error.details.code as ErrorCode
  }
  
  return undefined
}

export default {
  ERROR_CODES,
  ERROR_CODE_TO_CATEGORY,
  ERROR_CODE_TO_SEVERITY,
  isRetryableErrorCode,
  getUserMessageForCode,
  extractErrorCode,
}