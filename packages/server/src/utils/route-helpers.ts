import { z } from '@hono/zod-openapi'
import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import type { Context } from 'hono'

/**
 * Generic success response schema factory
 * Reduces repetitive response schema definitions
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true),
      data: dataSchema
    })
    .openapi(name)
}

/**
 * Generic list response schema factory
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true),
      data: z.array(itemSchema)
    })
    .openapi(name)
}

/**
 * Generic paginated response schema factory
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true),
      data: z.array(itemSchema),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        hasMore: z.boolean()
      })
    })
    .openapi(name)
}

/**
 * Standard error responses for OpenAPI routes
 */
export const standardResponses = {
  400: {
    content: {
      'application/json': { schema: ApiErrorResponseSchema }
    },
    description: 'Bad Request'
  },
  404: {
    content: {
      'application/json': { schema: ApiErrorResponseSchema }
    },
    description: 'Resource Not Found'
  },
  422: {
    content: {
      'application/json': { schema: ApiErrorResponseSchema }
    },
    description: 'Validation Error'
  },
  500: {
    content: {
      'application/json': { schema: ApiErrorResponseSchema }
    },
    description: 'Internal Server Error'
  }
} as const

/**
 * Create standard response set for routes
 */
export function createStandardResponses(successSchema: z.ZodTypeAny) {
  return {
    200: {
      content: {
        'application/json': { schema: successSchema }
      },
      description: 'Success'
    },
    ...standardResponses
  }
}

/**
 * Create standard responses with custom status code
 */
export function createStandardResponsesWithStatus(
  successSchema: z.ZodTypeAny, 
  statusCode: number = 200, 
  description: string = 'Success'
) {
  return {
    [statusCode]: {
      content: {
        'application/json': { schema: successSchema }
      },
      description
    },
    ...standardResponses
  }
}

/**
 * Wrapper for route handlers with automatic error handling
 * Reduces repetitive try-catch blocks
 */
export function withErrorHandling<T extends any[], R>(
  handler: (c: Context, ...args: T) => Promise<R>
): (c: Context, ...args: T) => Promise<R> {
  return async (c: Context, ...args: T): Promise<R> => {
    try {
      return await handler(c, ...args)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error // Will be handled by Hono error middleware
      }
      
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      throw new ApiError(500, message, 'INTERNAL_ERROR')
    }
  }
}

/**
 * Extract and validate route parameters with better error messages
 */
export function validateRouteParam(
  c: Context,
  paramName: string,
  type: 'number' | 'string' = 'number'
): number | string {
  const value = c.req.param(paramName)
  
  if (!value) {
    throw new ApiError(400, `Missing required parameter: ${paramName}`, 'MISSING_PARAM')
  }
  
  if (type === 'number') {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) {
      throw new ApiError(400, `Invalid ${paramName}: must be a number`, 'INVALID_PARAM')
    }
    return parsed
  }
  
  return value
}

/**
 * Standard success response helper - returns data object
 */
export function successResponse<T>(data: T) {
  return {
    success: true as const,
    data
  }
}

/**
 * Standard success response helper with Context - returns Hono response
 */
export function successResponseJson<T>(c: Context, data: T) {
  return c.json({
    success: true as const,
    data
  })
}

/**
 * Standard operation success response helper - returns data object
 */
export function operationSuccessResponse(message: string = 'Operation completed successfully') {
  return {
    success: true as const,
    message
  }
}

/**
 * Standard operation success response helper with Context - returns Hono response
 */
export function operationSuccessResponseJson(c: Context, message: string = 'Operation completed successfully') {
  return c.json({
    success: true as const,
    message
  })
}

/**
 * Create a route handler with built-in validation and error handling
 * Simplified version that doesn't pre-extract parameters
 */
export function createRouteHandler<
  TParams = any,
  TQuery = any,
  TBody = any
>(
  handler: (args: {
    params?: TParams
    query?: TQuery
    body?: TBody
    c: Context
  }) => Promise<any>
): (c: Context) => Promise<any> {
  return withErrorHandling(async (c: Context) => {
    // Let the handler extract its own parameters using c.req.valid()
    // This avoids type inference issues
    const result = await handler({ 
      params: undefined as TParams,
      query: undefined as TQuery,
      body: undefined as TBody,
      c 
    })
    
    // If result is already a Response, return it directly
    if (result && typeof result === 'object' && result.constructor?.name === 'Response') {
      return result
    }
    
    return c.json(result)
  })
}

/**
 * Simple route handler wrapper without parameter extraction
 * Use this when you want to handle c.req.valid() calls manually
 */
export function createSimpleRouteHandler(
  handler: (c: Context) => Promise<any>
) {
  return withErrorHandling(async (c: Context) => {
    const result = await handler(c)
    
    // If result is already a Response, return it directly
    if (result && typeof result === 'object' && result.constructor?.name === 'Response') {
      return result
    }
    
    return c.json(result)
  })
}

/**
 * Batch validation helper for multiple entities
 */
export async function validateEntities<T>(
  entities: T[],
  validator: (entity: T) => Promise<boolean> | boolean,
  entityName: string
): Promise<void> {
  const validationResults = await Promise.all(
    entities.map(async (entity, index) => {
      try {
        const isValid = await validator(entity)
        return { index, isValid, entity }
      } catch (error) {
        return { index, isValid: false, entity, error }
      }
    })
  )
  
  const failures = validationResults.filter(r => !r.isValid)
  
  if (failures.length > 0) {
    throw new ApiError(
      400,
      `Validation failed for ${failures.length} ${entityName}(s)`,
      'BATCH_VALIDATION_ERROR',
      { failures }
    )
  }
}

/**
 * Create a standard CRUD route set
 */
export function createCrudRoutes<TEntity extends { id: number }>(
  entityName: string,
  service: {
    list: () => Promise<TEntity[]>
    get: (id: number) => Promise<TEntity>
    create: (data: any) => Promise<TEntity>
    update: (id: number, data: any) => Promise<TEntity>
    delete: (id: number) => Promise<boolean>
  }
) {
  return {
    list: createSimpleRouteHandler(async (c) => {
      const entities = await service.list()
      return successResponseJson(c, entities)
    }),
    
    get: createSimpleRouteHandler(async (c) => {
      const params = (c.req as any).valid('param')
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        throw new ApiError(400, 'Invalid ID parameter', 'INVALID_PARAM')
      }
      
      const entity = await service.get(id)
      
      if (!entity) {
        throw new ApiError(404, `${entityName} not found`, `${entityName.toUpperCase()}_NOT_FOUND`)
      }
      
      return successResponseJson(c, entity)
    }),
    
    create: createSimpleRouteHandler(async (c) => {
      const body = (c.req as any).valid('json')
      
      const entity = await service.create(body)
      return successResponseJson(c, entity)
    }),
    
    update: createSimpleRouteHandler(async (c) => {
      const params = (c.req as any).valid('param')
      const body = (c.req as any).valid('json')
      
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        throw new ApiError(400, 'Invalid ID parameter', 'INVALID_PARAM')
      }
      
      const entity = await service.update(id, body)
      return successResponseJson(c, entity)
    }),
    
    delete: createSimpleRouteHandler(async (c) => {
      const params = (c.req as any).valid('param')
      
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        throw new ApiError(400, 'Invalid ID parameter', 'INVALID_PARAM')
      }
      
      const success = await service.delete(id)
      
      if (!success) {
        throw new ApiError(404, `${entityName} not found`, `${entityName.toUpperCase()}_NOT_FOUND`)
      }
      
      return operationSuccessResponseJson(c, `${entityName} deleted successfully`)
    })
  }
}