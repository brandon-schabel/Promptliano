/**
 * Request Validation Middleware
 * 
 * Provides comprehensive request validation for:
 * - Request body validation
 * - Query parameter validation
 * - Path parameter validation
 * - Header validation
 * - Custom validation rules
 */

import type { Context } from 'hono'
import { z } from 'zod'
import { ErrorFactory } from '@promptliano/shared'

/**
 * Validation options
 */
export interface ValidationOptions {
  stripUnknown?: boolean     // Remove unknown fields
  abortEarly?: boolean       // Stop on first error
  coerce?: boolean          // Coerce types
}

/**
 * Validate request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>, options: ValidationOptions = {}) {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const body = await c.req.json()
      
      // Apply options
      let validationSchema = schema
      
      if (options.stripUnknown) {
        // Only apply strip() if it's a ZodObject (has the method)
        if ('strip' in schema && typeof schema.strip === 'function') {
          validationSchema = (schema as any).strip()
        }
      }
      
      // Validate
      const validated = validationSchema.parse(body)
      
      // Store validated data in context
      c.set('validatedBody', validated)
      
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error // Let error middleware handle it
      }
      
      // JSON parsing error
      if (error instanceof SyntaxError) {
        throw ErrorFactory.invalidInput('body', 'valid JSON', 'invalid JSON')
      }
      
      throw error
    }
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, options: ValidationOptions = {}) {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const query = c.req.query()
      
      // Convert query object (all values are strings or arrays)
      const parsed = options.coerce !== false
        ? coerceQueryParams(query, schema)
        : query
      
      // Validate
      const validated = schema.parse(parsed)
      
      // Store validated data in context
      c.set('validatedQuery', validated)
      
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error
      }
      throw error
    }
  }
}

/**
 * Validate path parameters
 */
export function validateParams<T>(schema: z.ZodSchema<T>, options: ValidationOptions = {}) {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const params = c.req.param()
      
      // Convert params (all values are strings)
      const parsed = options.coerce !== false
        ? coerceParams(params, schema)
        : params
      
      // Validate
      const validated = schema.parse(parsed)
      
      // Store validated data in context
      c.set('validatedParams', validated)
      
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error
      }
      throw error
    }
  }
}

/**
 * Validate headers
 */
export function validateHeaders<T>(schema: z.ZodSchema<T>, options: ValidationOptions = {}) {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      // Get all headers
      const headers: Record<string, string> = {}
      
      // Hono doesn't provide a way to get all headers, so we need to check specific ones
      // based on the schema shape
      const shape = (schema as any)._def?.shape
      
      if (shape) {
        Object.keys(shape).forEach(key => {
          const value = c.req.header(key)
          if (value !== undefined) {
            headers[key] = value
          }
        })
      }
      
      // Validate
      const validated = schema.parse(headers)
      
      // Store validated data in context
      c.set('validatedHeaders', validated)
      
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error
      }
      throw error
    }
  }
}

/**
 * Combined validation for all request parts
 */
export function validateRequest<
  TBody = any,
  TQuery = any,
  TParams = any,
  THeaders = any
>(schemas: {
  body?: z.ZodSchema<TBody>
  query?: z.ZodSchema<TQuery>
  params?: z.ZodSchema<TParams>
  headers?: z.ZodSchema<THeaders>
}, options: ValidationOptions = {}) {
  return async (c: Context, next: () => Promise<void>) => {
    const errors: z.ZodIssue[] = []
    
    // Validate body
    if (schemas.body) {
      try {
        const body = await c.req.json()
        const validated = schemas.body.parse(body)
        c.set('validatedBody', validated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(
            ...error.issues.map((e) => ({
              ...e,
              path: ['body', ...e.path]
            }))
          )
        } else {
          throw error
        }
      }
    }
    
    // Validate query
    if (schemas.query) {
      try {
        const query = c.req.query()
        const parsed = options.coerce !== false
          ? coerceQueryParams(query, schemas.query)
          : query
        const validated = schemas.query.parse(parsed)
        c.set('validatedQuery', validated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(
            ...error.issues.map((e) => ({
              ...e,
              path: ['query', ...e.path]
            }))
          )
        }
      }
    }
    
    // Validate params
    if (schemas.params) {
      try {
        const params = c.req.param()
        const parsed = options.coerce !== false
          ? coerceParams(params, schemas.params)
          : params
        const validated = schemas.params.parse(parsed)
        c.set('validatedParams', validated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(
            ...error.issues.map((e) => ({
              ...e,
              path: ['params', ...e.path]
            }))
          )
        }
      }
    }
    
    // Validate headers
    if (schemas.headers) {
      try {
        const headers: Record<string, string> = {}
        const shape = (schemas.headers as any)._def?.shape
        
        if (shape) {
          Object.keys(shape).forEach(key => {
            const value = c.req.header(key)
            if (value !== undefined) {
              headers[key] = value
            }
          })
        }
        
        const validated = schemas.headers.parse(headers)
        c.set('validatedHeaders', validated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(
            ...error.issues.map((e) => ({
              ...e,
              path: ['headers', ...e.path]
            }))
          )
        }
      }
    }
    
    // If there are errors and abortEarly is true, throw
    if (errors.length > 0) {
      const zodError = new z.ZodError(errors)
      throw zodError
    }
    
    await next()
  }
}

/**
 * Custom validation rules
 */
export function validateCustom(
  validator: (c: Context) => Promise<void> | void
) {
  return async (c: Context, next: () => Promise<void>) => {
    await validator(c)
    await next()
  }
}

/**
 * Coerce query parameters to match schema types
 */
function coerceQueryParams(query: Record<string, string | string[]>, schema: z.ZodSchema): any {
  const result: Record<string, any> = {}
  const shape = (schema as any)._def?.shape || {}
  
  Object.keys(query).forEach(key => {
    const value = query[key]
    const fieldSchema = shape[key]
    
    if (!fieldSchema) {
      result[key] = value
      return
    }
    
    // Try to infer the type from the schema
    const typeName = fieldSchema._def?.typeName
    
    if (typeName === 'ZodNumber' || fieldSchema._def?.coerce === 'number') {
      result[key] = Array.isArray(value)
        ? value.map(v => parseFloat(v))
        : parseFloat(value as string)
    } else if (typeName === 'ZodBoolean' || fieldSchema._def?.coerce === 'boolean') {
      result[key] = Array.isArray(value)
        ? value.map(v => v === 'true' || v === '1')
        : value === 'true' || value === '1'
    } else if (typeName === 'ZodArray') {
      result[key] = Array.isArray(value) ? value : [value]
    } else {
      result[key] = value
    }
  })
  
  return result
}

/**
 * Coerce path parameters to match schema types
 */
function coerceParams(params: Record<string, string>, schema: z.ZodSchema): any {
  const result: Record<string, any> = {}
  const shape = (schema as any)._def?.shape || {}
  
  Object.keys(params).forEach(key => {
    const value = params[key]
    const fieldSchema = shape[key]
    
    if (!fieldSchema) {
      result[key] = value
      return
    }
    
    // Try to infer the type from the schema
    const typeName = fieldSchema._def?.typeName
    
    if (typeName === 'ZodNumber' || fieldSchema._def?.coerce === 'number') {
      result[key] = parseFloat(value)
    } else if (typeName === 'ZodBoolean' || fieldSchema._def?.coerce === 'boolean') {
      result[key] = value === 'true' || value === '1'
    } else {
      result[key] = value
    }
  })
  
  return result
}

/**
 * Sanitization helpers
 */
export const sanitize = {
  /**
   * Remove HTML tags
   */
  html(value: string): string {
    return value.replace(/<[^>]*>/g, '')
  },
  
  /**
   * Escape special characters
   */
  escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  },
  
  /**
   * Trim whitespace
   */
  trim(value: string): string {
    return value.trim()
  },
  
  /**
   * Remove non-alphanumeric characters
   */
  alphanumeric(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '')
  },
  
  /**
   * Normalize whitespace
   */
  whitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
  }
}

/**
 * Common validation schemas
 */
export const commonValidators = {
  /**
   * Email validation
   */
  email: z.string().email(),
  
  /**
   * URL validation
   */
  url: z.string().url(),
  
  /**
   * UUID validation
   */
  uuid: z.string().uuid(),
  
  /**
   * Positive integer
   */
  positiveInt: z.coerce.number().int().positive(),
  
  /**
   * Pagination query params
   */
  pagination: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('asc')
  }),
  
  /**
   * ID parameter
   */
  idParam: z.object({
    id: z.coerce.number().int().positive()
  }),
  
  /**
   * Search query
   */
  searchQuery: z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  }),
  
  /**
   * Date range
   */
  dateRange: z.object({
    from: z.coerce.date(),
    to: z.coerce.date()
  }).refine(data => data.from <= data.to, {
    message: 'From date must be before or equal to to date'
  })
}

/**
 * Create conditional validation
 */
export function conditionalValidation<T>(
  condition: (c: Context) => boolean,
  schema: z.ZodSchema<T>
) {
  return async (c: Context, next: () => Promise<void>) => {
    if (condition(c)) {
      const validator = validateBody(schema)
      await validator(c, next)
    } else {
      await next()
    }
  }
}

/**
 * Validate array length
 */
export function validateArrayLength(
  field: string,
  min?: number,
  max?: number
) {
  return async (c: Context, next: () => Promise<void>) => {
    const body = await c.req.json()
    const array = body[field]
    
    if (!Array.isArray(array)) {
      throw ErrorFactory.invalidInput(field, 'array', typeof array)
    }
    
    if (min !== undefined && array.length < min) {
      throw ErrorFactory.invalidInput(
        field,
        `array with at least ${min} items`,
        `array with ${array.length} items`
      )
    }
    
    if (max !== undefined && array.length > max) {
      throw ErrorFactory.invalidInput(
        field,
        `array with at most ${max} items`,
        `array with ${array.length} items`
      )
    }
    
    await next()
  }
}
