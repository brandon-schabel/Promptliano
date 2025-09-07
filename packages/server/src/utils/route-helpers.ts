import { z } from '@hono/zod-openapi'
import { ApiError, ErrorFactory, assertExists, assertValid, withErrorContext } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import type { Context } from 'hono'

/**
 * Generic success response schema factory
 * Reduces repetitive response schema definitions
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T, name: string) {
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
export function createListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T, name: string) {
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
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T, name: string) {
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
  // Be defensive: if a non-Zod value is passed, coerce to z.any() to avoid doc generation crashes
  const schema: z.ZodTypeAny =
    successSchema &&
    typeof successSchema === 'object' &&
    (('_def' in (successSchema as any)) || ('def' in (successSchema as any)))
      ? (successSchema as z.ZodTypeAny)
      : z.any()
  return {
    200: {
      content: {
        'application/json': { schema }
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
  const schema: z.ZodTypeAny =
    successSchema &&
    typeof successSchema === 'object' &&
    (('_def' in (successSchema as any)) || ('def' in (successSchema as any)))
      ? (successSchema as z.ZodTypeAny)
      : z.any()
  return {
    [statusCode]: {
      content: {
        'application/json': { schema }
      },
      description
    },
    ...standardResponses
  } as const
}

/**
 * Wrapper for route handlers with automatic error handling using ErrorFactory
 * Reduces repetitive try-catch blocks and provides consistent error formatting
 */
export function withErrorHandling<C extends Context, T extends any[], R>(
  handler: (c: C, ...args: T) => Promise<R>
): (c: C, ...args: T) => Promise<R> {
  return async (c: C, ...args: T): Promise<R> => {
    try {
      return await handler(c, ...args)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error // Will be handled by Hono error middleware
      }

      // Use ErrorFactory.wrap for consistent error handling
      throw ErrorFactory.wrap(error, 'Route handler')
    }
  }
}

/**
 * Extract and validate route parameters with ErrorFactory integration
 */
export function validateRouteParam(
  c: Context,
  paramName: string,
  type: 'number' | 'string' = 'number'
): number | string {
  const value = c.req.param(paramName)

  if (!value) {
    throw ErrorFactory.missingRequired(paramName, 'route parameter')
  }

  if (type === 'number') {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) {
      throw ErrorFactory.invalidParam(paramName, 'number', value)
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
 * Uses safe extraction methods to avoid type system conflicts
 *
 * Note: For full type safety, prefer using c.req.valid() directly in route handlers
 * where the Context type is properly constrained by OpenAPI route definitions.
 */
export function createRouteHandler<TParams = Record<string, any>, TQuery = Record<string, any>, TBody = any>(
  handler: (args: { params?: TParams; query?: TQuery; body?: TBody; c: Context }) => Promise<any>
): (c: Context) => Promise<any> {
  return withErrorHandling(async (c: Context) => {
    // Extract parameters from the context using safe methods
    let params: TParams | undefined
    let query: TQuery | undefined
    let body: TBody | undefined

    // Use runtime validation extraction with proper error handling
    try {
      // Check if context has validated params - this works in OpenAPI routes
      if ('valid' in c.req && typeof (c.req as any).valid === 'function') {
        params = (c.req as any).valid('param') as TParams
      }
    } catch {
      // If validation fails, params remain undefined
    }

    try {
      // Check if context has validated query - this works in OpenAPI routes
      if ('valid' in c.req && typeof (c.req as any).valid === 'function') {
        query = (c.req as any).valid('query') as TQuery
      }
    } catch {
      // If validation fails, query remains undefined
    }

    try {
      // Check if context has validated body - this works in OpenAPI routes
      if ('valid' in c.req && typeof (c.req as any).valid === 'function') {
        body = (c.req as any).valid('json') as TBody
      }
    } catch {
      // If validation fails, body remains undefined
    }

    const result = await handler({
      params,
      query,
      body,
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
export function createSimpleRouteHandler(handler: (c: Context) => Promise<any>) {
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
 * Batch validation helper for multiple entities using ErrorFactory
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

  const failures = validationResults.filter((r) => !r.isValid)

  if (failures.length > 0) {
    throw ErrorFactory.validationFailed(
      {
        message: `Validation failed for ${failures.length} ${entityName}(s)`,
        failures
      } as any,
      { entity: entityName, action: 'batch_validation', failures }
    )
  }
}

/**
 * Enhanced route handler with context-aware error handling
 */
export function withRouteContext<T extends any[], R>(
  entityName: string,
  action: string,
  handler: (c: Context, ...args: T) => Promise<R>
): (c: Context, ...args: T) => Promise<R> {
  return async (c: Context, ...args: T): Promise<R> => {
    return await withErrorContext(() => handler(c, ...args), { entity: entityName, action })
  }
}

/**
 * Validate and extract entity ID from route parameters
 */
export function extractEntityId(c: Context, paramName: string = 'id'): number {
  const value = c.req.param(paramName)

  if (!value) {
    throw ErrorFactory.missingRequired(paramName, 'path parameter')
  }

  const id = parseInt(value, 10)
  if (isNaN(id) || id <= 0) {
    throw ErrorFactory.invalidParam(paramName, 'positive integer', value)
  }

  return id
}

/**
 * Safe JSON body extraction with validation
 */
export function extractValidatedBody<T>(c: Context, schema: z.ZodSchema<T>, entityContext?: string): T {
  try {
    const body = (c.req as any).valid('json')
    return assertValid(body, schema, entityContext)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw ErrorFactory.validationFailed(error, { entity: entityContext })
  }
}

/**
 * Create a standard CRUD route set with ErrorFactory integration
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
  const entityErrors = ErrorFactory.forEntity(entityName)

  return {
    list: withRouteContext(entityName, 'list', async (c) => {
      const entities = await service.list()
      return successResponseJson(c, entities)
    }),

    get: withRouteContext(entityName, 'get', async (c) => {
      const id = extractEntityId(c)
      const entity = await service.get(id)

      if (!entity) {
        throw entityErrors.notFound(id)
      }

      return successResponseJson(c, entity)
    }),

    create: withRouteContext(entityName, 'create', async (c) => {
      const body = (c.req as any).valid('json')
      const entity = await service.create(body)
      return successResponseJson(c, entity)
    }),

    update: withRouteContext(entityName, 'update', async (c) => {
      const id = extractEntityId(c)
      const body = (c.req as any).valid('json')

      const entity = await service.update(id, body)
      return successResponseJson(c, entity)
    }),

    delete: withRouteContext(entityName, 'delete', async (c) => {
      const id = extractEntityId(c)
      const success = await service.delete(id)

      if (!success) {
        throw entityErrors.notFound(id)
      }

      return operationSuccessResponseJson(c, `${entityName} deleted successfully`)
    })
  }
}
