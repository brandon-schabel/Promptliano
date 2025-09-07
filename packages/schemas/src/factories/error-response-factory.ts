import { z } from '@hono/zod-openapi'

/**
 * Creates a standard error response schema
 */
export function createErrorResponseSchema(
  code: string,
  defaultMessage: string,
  options?: {
    includeDetails?: boolean
    includeStack?: boolean
    includeTimestamp?: boolean
    includeRequestId?: boolean
  }
) {
  const errorSchema: Record<string, z.ZodTypeAny> = {
    code: z.literal(code),
    message: z.string().default(defaultMessage)
  }
  
  if (options?.includeDetails) {
    errorSchema['details'] = z.record(z.string(), z.any()).optional().describe('Additional error details')
  }
  
  if (options?.includeStack) {
    errorSchema['stack'] = z.string().optional().describe('Stack trace (dev only)')
  }
  
  if (options?.includeTimestamp) {
    errorSchema['timestamp'] = z.number().describe('Error timestamp')
  }
  
  if (options?.includeRequestId) {
    errorSchema['requestId'] = z.string().optional().describe('Request ID for tracing')
  }
  
  return z.object({
    success: z.literal(false),
    error: z.object(errorSchema)
  }).openapi(`${code}ErrorResponse`, {
    description: defaultMessage,
    example: {
      success: false,
      error: {
        code,
        message: defaultMessage,
        ...(options?.includeDetails && { details: {} }),
        ...(options?.includeTimestamp && { timestamp: Date.now() })
      }
    }
  })
}

/**
 * Creates validation error response with field errors
 */
export function createValidationErrorResponseSchema(name?: string) {
  return z.object({
    success: z.literal(false),
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.string().default('Validation failed'),
      fieldErrors: z.record(z.string(), z.array(z.string())).describe('Field-specific errors')
    })
  }).openapi(name || 'ValidationErrorResponse', {
    example: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fieldErrors: {
          email: ['Invalid email format'],
          password: ['Must be at least 8 characters']
        }
      }
    }
  })
}

/**
 * Standard error responses for common HTTP status codes
 */
export const standardErrorResponses = {
  400: createErrorResponseSchema('BAD_REQUEST', 'Invalid request parameters'),
  401: createErrorResponseSchema('UNAUTHORIZED', 'Authentication required'),
  403: createErrorResponseSchema('FORBIDDEN', 'Insufficient permissions'),
  404: createErrorResponseSchema('NOT_FOUND', 'Resource not found'),
  409: createErrorResponseSchema('CONFLICT', 'Resource conflict'),
  422: createValidationErrorResponseSchema(),
  429: createErrorResponseSchema('RATE_LIMITED', 'Too many requests', { includeDetails: true }),
  500: createErrorResponseSchema('INTERNAL_ERROR', 'Internal server error'),
  502: createErrorResponseSchema('BAD_GATEWAY', 'External service error'),
  503: createErrorResponseSchema('SERVICE_UNAVAILABLE', 'Service temporarily unavailable')
}

/**
 * Creates a multi-error response for batch operations
 */
export function createBatchErrorResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || itemSchema._def.description || 'Item'
  
  return z.object({
    success: z.literal(false),
    errors: z.array(z.object({
      index: z.number(),
      item: itemSchema.optional(),
      error: z.object({
        code: z.string(),
        message: z.string()
      })
    })),
    successCount: z.number().int().min(0),
    errorCount: z.number().int().min(0)
  }).openapi(`${schemaName}BatchErrorResponse`)
}

/**
 * Creates a partial failure response (some succeeded, some failed)
 */
export function createPartialFailureResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || itemSchema._def.description || 'Item'
  
  return z.object({
    success: z.literal(false),
    partial: z.literal(true),
    succeeded: z.array(itemSchema),
    failed: z.array(z.object({
      item: itemSchema.optional(),
      error: z.object({
        code: z.string(),
        message: z.string()
      })
    })),
    summary: z.object({
      total: z.number(),
      successCount: z.number(),
      failureCount: z.number(),
      successRate: z.number().min(0).max(1)
    })
  }).openapi(`${schemaName}PartialFailureResponse`)
}

/**
 * Creates a retry-able error response
 */
export function createRetryableErrorResponseSchema(
  code: string,
  message: string,
  options?: {
    retryAfter?: number
    maxRetries?: number
  }
) {
  return z.object({
    success: z.literal(false),
    error: z.object({
      code: z.literal(code),
      message: z.string().default(message),
      retryable: z.literal(true),
      retryAfter: options?.retryAfter ? z.number().default(options.retryAfter).describe('Seconds to wait before retry') : z.number().optional().describe('Seconds to wait before retry'),
      maxRetries: options?.maxRetries ? z.number().default(options.maxRetries).describe('Maximum retry attempts') : z.number().optional().describe('Maximum retry attempts'),
      backoffStrategy: z.enum(['linear', 'exponential']).default('exponential')
    })
  }).openapi(`${code}RetryableErrorResponse`)
}

/**
 * Creates an error response with suggested actions
 */
export function createActionableErrorResponseSchema(
  code: string,
  message: string,
  actions: string[]
) {
  return z.object({
    success: z.literal(false),
    error: z.object({
      code: z.literal(code),
      message: z.string().default(message),
      suggestedActions: z.array(z.string()).default(actions),
      helpUrl: z.string().optional()
    })
  }).openapi(`${code}ActionableErrorResponse`)
}

/**
 * Creates a field validation error detail schema
 */
export function createFieldErrorSchema() {
  return z.object({
    field: z.string().describe('Field path'),
    message: z.string().describe('Error message'),
    code: z.string().optional().describe('Error code'),
    value: z.any().optional().describe('Invalid value provided')
  })
}

/**
 * Creates a comprehensive validation error response
 */
export function createDetailedValidationErrorResponseSchema() {
  return z.object({
    success: z.literal(false),
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.string().default('One or more validation errors occurred'),
      errors: z.array(createFieldErrorSchema()),
      summary: z.object({
        totalErrors: z.number(),
        affectedFields: z.array(z.string())
      }).optional()
    })
  }).openapi('DetailedValidationErrorResponse')
}