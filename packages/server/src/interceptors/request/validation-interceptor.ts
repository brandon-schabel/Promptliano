import type { Context } from 'hono'
import { z } from 'zod'
import {
  type Interceptor,
  type InterceptorContext,
  type InterceptorHandler,
  type ValidationInterceptorConfig,
  InterceptorError
} from '../types'

/**
 * Validation schema definition for a specific route and method
 */
interface RouteValidationSchema {
  body?: z.ZodSchema
  query?: z.ZodSchema
  params?: z.ZodSchema
  headers?: z.ZodSchema
}

/**
 * Validation result structure
 */
interface ValidationResult {
  valid: boolean
  errors?: Array<{
    field: string
    message: string
    code: string
  }>
}

/**
 * Pattern matcher for route patterns (supports wildcards)
 */
function matchesRoutePattern(pattern: string, path: string): boolean {
  // Convert route pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '___DOUBLE_STAR___')  // Temporarily replace **
    .replace(/\*/g, '[^/]*')                // * matches anything except /
    .replace(/___DOUBLE_STAR___/g, '.*')    // ** matches everything including /
    .replace(/:\w+/g, '[^/]+')              // :param matches path segments
    .replace(/\?/g, '.')                    // ? matches single character
  
  const regex = new RegExp('^' + regexPattern + '$')
  return regex.test(path)
}

/**
 * Find matching schema for a route and method
 */
function findMatchingSchema(
  path: string,
  method: string,
  schemas: Record<string, Record<string, RouteValidationSchema>>
): RouteValidationSchema | undefined {
  // First try exact match
  if (schemas[path]?.[method]) {
    return schemas[path][method]
  }

  // Then try pattern matching
  for (const [pattern, methodSchemas] of Object.entries(schemas)) {
    if (matchesRoutePattern(pattern, path) && methodSchemas[method]) {
      return methodSchemas[method]
    }
  }

  return undefined
}

/**
 * Validate data against a Zod schema
 */
function validateWithSchema(schema: z.ZodSchema, data: any): ValidationResult {
  try {
    schema.parse(data)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
      return { valid: false, errors }
    }
    
    return {
      valid: false,
      errors: [{
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Validation failed',
        code: 'UNKNOWN_ERROR'
      }]
    }
  }
}

/**
 * Extract request body based on content type
 */
async function extractRequestBody(context: Context, allowFormData: boolean = false): Promise<any> {
  const contentType = context.req.header('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      return await context.req.json()
    }
    
    if (allowFormData && (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    )) {
      // For form data, try to use parseBody if available
      if (typeof context.req.parseBody === 'function') {
        return await context.req.parseBody()
      }
      // Fallback to formData
      const formData = await context.req.formData()
      const result: Record<string, any> = {}
      const entries = Array.from(formData.entries())
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i]
        result[key] = value
      }
      return result
    }

    // For other content types, return undefined (skip validation)
    return undefined
  } catch (error) {
    throw new Error(`Failed to parse request body: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract query parameters as an object
 */
function extractQueryParams(context: Context): Record<string, string> {
  const url = new URL(context.req.url, 'http://localhost')
  const params: Record<string, string> = {}
  
  const entries = Array.from(url.searchParams.entries())
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i]
    params[key] = value
  }
  
  return params
}

/**
 * Extract path parameters as an object
 */
function extractPathParams(context: Context, schema?: z.ZodSchema): Record<string, string> {
  const params: Record<string, string> = {}
  
  // If we have a schema, extract param names from it
  if (schema && 'shape' in schema && schema.shape) {
    const shape = schema.shape as Record<string, any>
    for (const key of Object.keys(shape)) {
      const value = context.req.param(key)
      if (value !== undefined) {
        params[key] = value
      }
    }
  }
  
  return params
}

/**
 * Create validation interceptor handler
 */
function createValidationHandler(config: ValidationInterceptorConfig): InterceptorHandler {
  return async (context: Context, interceptorContext: InterceptorContext, next: () => Promise<void>) => {
    const startTime = Date.now()
    
    try {
      // Skip if validation is disabled
      if (!config.enabled) {
        await next()
        return
      }

      const method = context.req.method
      const path = context.req.path

      // Find matching schema
      const schema = findMatchingSchema(path, method, config.schemas || {})
      
      // If no schema found, skip validation
      if (!schema) {
        await next()
        return
      }

      const validationResults: Record<string, ValidationResult> = {}
      const allErrors: Record<string, any[]> = {}

      // Validate request body
      if (config.validateBody && schema.body) {
        try {
          const body = await extractRequestBody(context, config.allowFormData)
          if (body !== undefined) {
            const result = validateWithSchema(schema.body, body)
            validationResults.body = result
            if (!result.valid && result.errors) {
              allErrors.body = result.errors
            }
          }
        } catch (error) {
          allErrors.body = [{
            field: 'body',
            message: error instanceof Error ? error.message : 'Failed to parse request body',
            code: 'BODY_PARSE_ERROR'
          }]
          validationResults.body = { valid: false, errors: allErrors.body }
        }
      }

      // Validate query parameters
      if (config.validateQuery && schema.query) {
        const queryParams = extractQueryParams(context)
        const result = validateWithSchema(schema.query, queryParams)
        validationResults.query = result
        if (!result.valid && result.errors) {
          allErrors.query = result.errors
        }
      }

      // Validate path parameters
      if (config.validateParams && schema.params) {
        const pathParams = extractPathParams(context, schema.params)
        const result = validateWithSchema(schema.params, pathParams)
        validationResults.params = result
        if (!result.valid && result.errors) {
          allErrors.params = result.errors
        }
      }

      // Validate headers
      if (config.validateHeaders && schema.headers) {
        const headers: Record<string, string> = {}
        // Extract relevant headers (this is simplified - in real implementation,
        // you'd want to extract all headers or specific ones based on schema)
        if ('shape' in schema.headers && schema.headers.shape) {
          const shape = schema.headers.shape as Record<string, any>
          for (const key of Object.keys(shape)) {
            const value = context.req.header(key.toLowerCase())
            if (value !== undefined) {
              headers[key] = value
            }
          }
        }
        
        const result = validateWithSchema(schema.headers, headers)
        validationResults.headers = result
        if (!result.valid && result.errors) {
          allErrors.headers = result.errors
        }
      }

      // Check if any validation failed
      const hasErrors = Object.keys(allErrors).length > 0

      if (hasErrors) {
        // Use custom error handler if provided
        if (config.onValidationError) {
          return await config.onValidationError(context, interceptorContext, allErrors)
        }

        // Default validation error response
        context.status(400)
        return context.json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: allErrors
          }
        })
      }

      // Store validation results in context
      const validationSummary: Record<string, boolean> = {
        bodyValid: validationResults.body?.valid ?? true,
        queryValid: validationResults.query?.valid ?? true,
        paramsValid: validationResults.params?.valid ?? true
      }

      // Only include headersValid if headers validation was performed
      if (config.validateHeaders && schema.headers) {
        validationSummary.headersValid = validationResults.headers?.valid ?? true
      }

      interceptorContext.metadata.validation = validationSummary

      // Continue to next interceptor/handler
      await next()

    } catch (error) {
      // Record timing even on error
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['validation'] = duration

      throw error
    } finally {
      // Record timing
      const duration = Date.now() - startTime
      interceptorContext.metrics.interceptorTimings['validation'] = duration
    }
  }
}

/**
 * Create validation interceptor with configuration
 */
export function createValidationInterceptor(config: Partial<ValidationInterceptorConfig> = {}): Interceptor {
  const defaultConfig: ValidationInterceptorConfig = {
    enabled: true,
    validateBody: true,
    validateQuery: false,
    validateParams: false,
    validateHeaders: false,
    allowFormData: false,
    schemas: {},
    ...config
  }

  return {
    name: 'validation-interceptor',
    order: 15, // Run after auth but before business logic
    phase: 'request',
    enabled: true,
    handler: createValidationHandler(defaultConfig),
    config: defaultConfig,
    tags: ['validation', 'security'],
    routes: [], // Apply to all routes by default (will be filtered by schemas)
    methods: [] // Apply to all methods by default (will be filtered by schemas)
  }
}

/**
 * Pre-configured validation interceptor for API routes
 */
export const apiValidationInterceptor = createValidationInterceptor({
  validateBody: true,
  validateQuery: true,
  validateParams: true,
  allowFormData: true
})

/**
 * Pre-configured validation interceptor for strict validation
 */
export const strictValidationInterceptor = createValidationInterceptor({
  validateBody: true,
  validateQuery: true,
  validateParams: true,
  validateHeaders: true,
  allowFormData: false
})

/**
 * Utility function to create a simple body validation schema
 */
export function createBodyValidationSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape)
}

/**
 * Utility function to create a query validation schema with common patterns
 */
export function createQueryValidationSchema(options: {
  pagination?: boolean
  sorting?: string[]
  filtering?: Record<string, z.ZodSchema>
  search?: boolean
} = {}): z.ZodSchema {
  const shape: Record<string, z.ZodSchema> = {}

  if (options.pagination) {
    shape.page = z.string().regex(/^\d+$/).transform(Number).optional()
    shape.limit = z.string().regex(/^\d+$/).transform(Number).optional()
    shape.offset = z.string().regex(/^\d+$/).transform(Number).optional()
  }

  if (options.sorting && options.sorting.length > 0) {
    shape.sort = z.enum(options.sorting as [string, ...string[]]).optional()
    shape.order = z.enum(['asc', 'desc']).optional()
  }

  if (options.search) {
    shape.q = z.string().optional()
    shape.search = z.string().optional()
  }

  if (options.filtering) {
    Object.assign(shape, options.filtering)
  }

  return z.object(shape)
}

/**
 * Utility function to create path parameter validation schema
 */
export function createParamsValidationSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape)
}

/**
 * Common validation schemas
 */
export const CommonValidationSchemas = {
  /** Standard ID parameter */
  idParam: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),

  /** UUID parameter */
  uuidParam: z.object({
    id: z.string().uuid()
  }),

  /** Pagination query */
  paginationQuery: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional()
  }),

  /** Search query */
  searchQuery: z.object({
    q: z.string().min(1).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional()
  }),

  /** Common headers */
  apiHeaders: z.object({
    authorization: z.string().startsWith('Bearer ').optional(),
    'content-type': z.string().optional(),
    'x-api-key': z.string().optional()
  })
}

/**
 * Utility function to merge validation schemas
 */
export function mergeValidationSchemas(
  ...schemas: z.ZodObject<any>[]
): z.ZodObject<any> {
  return schemas.reduce((merged, schema) => merged.merge(schema))
}

/**
 * Utility function to make all fields optional in a schema
 */
export function makeOptional<T extends z.ZodObject<any>>(schema: T): z.ZodOptional<T> {
  return schema.optional()
}

/**
 * Utility function to make all fields partial in a schema
 */
export function makePartial<T extends z.ZodObject<any>>(schema: T): z.ZodObject<any> {
  return schema.partial() as z.ZodObject<any>
}