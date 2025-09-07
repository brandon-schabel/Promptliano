import { z } from '@hono/zod-openapi'
import { getZodDescription, getZodExample } from '../utils/zod-meta'

/**
 * Creates a paginated response schema with metadata
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  options?: {
    description?: string
    includeCursors?: boolean
    includeStats?: boolean
    name?: string
  }
) {
  const schemaName = options?.name || getZodDescription(itemSchema) || 'Item'
  
  const paginationSchema: Record<string, z.ZodTypeAny> = {
    page: z.number().int().min(1).describe('Current page number'),
    pageSize: z.number().int().min(1).max(100).describe('Items per page'),
    totalPages: z.number().int().min(0).describe('Total number of pages'),
    totalItems: z.number().int().min(0).describe('Total number of items'),
    hasMore: z.boolean().describe('Whether there are more pages'),
    hasPrevious: z.boolean().describe('Whether there is a previous page')
  }
  
  // Add cursor-based pagination if requested
  if (options?.includeCursors) {
    paginationSchema['nextCursor'] = z.string().nullable().optional().describe('Cursor for next page')
    paginationSchema['previousCursor'] = z.string().nullable().optional().describe('Cursor for previous page')
  }
  
  // Add statistics if requested
  if (options?.includeStats) {
    paginationSchema['stats'] = z.object({
      minId: z.number().optional(),
      maxId: z.number().optional(),
      averageSize: z.number().optional()
    }).optional()
  }
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object(paginationSchema)
  }).openapi(`${schemaName}PaginatedResponse`, {
    description: options?.description || `Paginated list of ${schemaName}s`,
    example: {
      success: true,
      data: [getZodExample(itemSchema) || {}],
      pagination: {
        page: 1,
        pageSize: 10,
        totalPages: 5,
        totalItems: 50,
        hasMore: true,
        hasPrevious: false,
        ...(options?.includeCursors && {
          nextCursor: 'eyJpZCI6MTB9',
          previousCursor: null
        })
      }
    }
  })
}

/**
 * Creates an infinite scroll response schema
 */
export function createInfiniteScrollResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    cursor: z.string().nullable().describe('Cursor for next batch'),
    hasMore: z.boolean().describe('Whether more items exist'),
    totalLoaded: z.number().int().min(0).optional().describe('Total items loaded so far')
  }).openapi(`${schemaName}InfiniteScrollResponse`)
}

/**
 * Creates offset-based pagination response
 */
export function createOffsetPaginationResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    offset: z.number().int().min(0),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0)
  }).openapi(`${schemaName}OffsetPaginationResponse`)
}

/**
 * Creates a keyset pagination response
 */
export function createKeysetPaginationResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  keyField: string,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object({
      lastKey: z.any().nullable().describe(`Last ${keyField} in the current set`),
      hasMore: z.boolean(),
      pageSize: z.number().int().min(1).max(100),
      direction: z.enum(['forward', 'backward']).default('forward')
    })
  }).openapi(`${schemaName}KeysetPaginationResponse`)
}

/**
 * Creates a relay-style cursor pagination response
 */
export function createRelayPaginationResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Item'
  
  const EdgeSchema = z.object({
    node: itemSchema,
    cursor: z.string()
  })
  
  return z.object({
    success: z.literal(true),
    data: z.object({
      edges: z.array(EdgeSchema),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        hasPreviousPage: z.boolean(),
        startCursor: z.string().nullable(),
        endCursor: z.string().nullable(),
        totalCount: z.number().int().min(0).optional()
      })
    })
  }).openapi(`${schemaName}RelayPaginationResponse`)
}

/**
 * Creates a time-based pagination response
 */
export function createTimeBasedPaginationResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object({
      since: z.number().describe('Unix timestamp for start of range'),
      until: z.number().describe('Unix timestamp for end of range'),
      hasMore: z.boolean(),
      nextSince: z.number().optional().describe('Timestamp for next page'),
      previousUntil: z.number().optional().describe('Timestamp for previous page')
    })
  }).openapi(`${schemaName}TimeBasedPaginationResponse`)
}

/**
 * Creates a hybrid pagination response (supports both offset and cursor)
 */
export function createHybridPaginationResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object({
      // Offset-based
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100),
      totalPages: z.number().int().min(0).optional(),
      totalItems: z.number().int().min(0),
      // Cursor-based
      cursor: z.string().nullable().optional(),
      nextCursor: z.string().nullable().optional(),
      previousCursor: z.string().nullable().optional(),
      // Common
      hasMore: z.boolean(),
      hasPrevious: z.boolean()
    })
  }).openapi(`${schemaName}HybridPaginationResponse`)
}
