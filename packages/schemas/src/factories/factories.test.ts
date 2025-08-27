import { describe, test, expect } from 'bun:test'
import { z } from '@hono/zod-openapi'
import {
  createSuccessResponseSchema,
  createListResponseSchema,
  createPaginatedResponseSchema,
  createErrorResponseSchema,
  createStreamingResponseSchema,
  createOperationResponseSchema,
  createMetadataResponseSchema,
  createGroupedListResponseSchema,
  createValidationErrorResponseSchema,
  createBatchErrorResponseSchema,
  standardErrorResponses
} from './index'

describe('Response Schema Factories', () => {
  const TestSchema = z.object({
    id: z.number(),
    name: z.string()
  }).describe('TestEntity')

  describe('createSuccessResponseSchema', () => {
    test('generates correct schema structure', () => {
      const schema = createSuccessResponseSchema(TestSchema)
      
      const parsed = schema.parse({
        success: true,
        data: { id: 1, name: 'Test' }
      })
      
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual({ id: 1, name: 'Test' })
    })

    test('preserves OpenAPI metadata', () => {
      const schema = createSuccessResponseSchema(TestSchema, { name: 'TestEntity' })
      
      expect(schema._def.openapi).toBeDefined()
      expect(schema._def.openapi?.ref).toBe('TestEntityResponse')
    })

    test('handles additional fields', () => {
      const schema = createSuccessResponseSchema(TestSchema, {
        additionalFields: {
          timestamp: z.number()
        }
      })
      
      const parsed = schema.parse({
        success: true,
        data: { id: 1, name: 'Test' },
        timestamp: Date.now()
      })
      
      expect(parsed.timestamp).toBeDefined()
    })
  })

  describe('createListResponseSchema', () => {
    test('generates list response', () => {
      const schema = createListResponseSchema(TestSchema)
      
      const parsed = schema.parse({
        success: true,
        data: [
          { id: 1, name: 'Test1' },
          { id: 2, name: 'Test2' }
        ]
      })
      
      expect(parsed.data).toHaveLength(2)
    })

    test('includes optional count', () => {
      const schema = createListResponseSchema(TestSchema, {
        includeCount: true
      })
      
      const parsed = schema.parse({
        success: true,
        data: [{ id: 1, name: 'Test' }],
        count: 1
      })
      
      expect(parsed.count).toBe(1)
    })

    test('includes filters when requested', () => {
      const schema = createListResponseSchema(TestSchema, {
        includeFilters: true
      })
      
      const parsed = schema.parse({
        success: true,
        data: [],
        appliedFilters: { status: 'active' }
      })
      
      expect(parsed.appliedFilters).toEqual({ status: 'active' })
    })
  })

  describe('createPaginatedResponseSchema', () => {
    test('generates paginated response', () => {
      const schema = createPaginatedResponseSchema(TestSchema)
      
      const parsed = schema.parse({
        success: true,
        data: [{ id: 1, name: 'Test' }],
        pagination: {
          page: 1,
          pageSize: 10,
          totalPages: 5,
          totalItems: 50,
          hasMore: true,
          hasPrevious: false
        }
      })
      
      expect(parsed.pagination.page).toBe(1)
      expect(parsed.pagination.totalItems).toBe(50)
    })

    test('includes cursors when requested', () => {
      const schema = createPaginatedResponseSchema(TestSchema, {
        includeCursors: true
      })
      
      const parsed = schema.parse({
        success: true,
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalItems: 0,
          hasMore: false,
          hasPrevious: false,
          nextCursor: 'abc123',
          previousCursor: null
        }
      })
      
      expect(parsed.pagination.nextCursor).toBe('abc123')
    })
  })

  describe('createErrorResponseSchema', () => {
    test('generates error response', () => {
      const schema = createErrorResponseSchema('TEST_ERROR', 'Test error occurred')
      
      const parsed = schema.parse({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error occurred'
        }
      })
      
      expect(parsed.success).toBe(false)
      expect(parsed.error.code).toBe('TEST_ERROR')
    })

    test('includes optional fields', () => {
      const schema = createErrorResponseSchema('TEST_ERROR', 'Test error', {
        includeDetails: true,
        includeTimestamp: true
      })
      
      const now = Date.now()
      const parsed = schema.parse({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error',
          details: { field: 'value' },
          timestamp: now
        }
      })
      
      expect(parsed.error.details).toEqual({ field: 'value' })
      expect(parsed.error.timestamp).toBe(now)
    })
  })

  describe('createValidationErrorResponseSchema', () => {
    test('generates validation error response', () => {
      const schema = createValidationErrorResponseSchema()
      
      const parsed = schema.parse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: {
            email: ['Invalid email format'],
            password: ['Too short']
          }
        }
      })
      
      expect(parsed.error.fieldErrors.email).toContain('Invalid email format')
    })
  })

  describe('createStreamingResponseSchema', () => {
    test('generates streaming response', () => {
      const schema = createStreamingResponseSchema(TestSchema)
      
      const parsed = schema.parse({
        event: 'data',
        data: { id: 1, name: 'Test' }
      })
      
      expect(parsed.event).toBe('data')
    })

    test('handles error events', () => {
      const schema = createStreamingResponseSchema(TestSchema)
      
      const parsed = schema.parse({
        event: 'error',
        data: { error: 'Something went wrong' }
      })
      
      expect(parsed.event).toBe('error')
    })

    test('includes heartbeat when requested', () => {
      const schema = createStreamingResponseSchema(TestSchema, {
        includeHeartbeat: true
      })
      
      const parsed = schema.parse({
        event: 'heartbeat',
        data: { heartbeat: Date.now() }
      })
      
      expect(parsed.event).toBe('heartbeat')
    })
  })

  describe('createOperationResponseSchema', () => {
    test('generates operation response', () => {
      const schema = createOperationResponseSchema('Delete')
      
      const parsed = schema.parse({
        success: true,
        message: 'Delete completed successfully'
      })
      
      expect(parsed.success).toBe(true)
      expect(parsed.message).toBe('Delete completed successfully')
    })

    test('uses custom message', () => {
      const schema = createOperationResponseSchema('Update', {
        message: 'Record updated'
      })
      
      const parsed = schema.parse({
        success: true,
        message: 'Record updated'
      })
      
      expect(parsed.message).toBe('Record updated')
    })
  })

  describe('createGroupedListResponseSchema', () => {
    test('generates grouped list response', () => {
      const schema = createGroupedListResponseSchema(TestSchema, 'category')
      
      const parsed = schema.parse({
        success: true,
        data: {
          'category1': [{ id: 1, name: 'Test1' }],
          'category2': [{ id: 2, name: 'Test2' }]
        },
        groupedBy: 'category',
        groupCount: 2
      })
      
      expect(parsed.groupedBy).toBe('category')
      expect(parsed.groupCount).toBe(2)
    })
  })

  describe('createBatchErrorResponseSchema', () => {
    test('generates batch error response', () => {
      const schema = createBatchErrorResponseSchema(TestSchema)
      
      const parsed = schema.parse({
        success: false,
        errors: [
          {
            index: 0,
            item: { id: 1, name: 'Test' },
            error: {
              code: 'INVALID',
              message: 'Invalid item'
            }
          }
        ],
        successCount: 2,
        errorCount: 1
      })
      
      expect(parsed.errors).toHaveLength(1)
      expect(parsed.successCount).toBe(2)
      expect(parsed.errorCount).toBe(1)
    })
  })

  describe('standardErrorResponses', () => {
    test('includes common HTTP status codes', () => {
      expect(standardErrorResponses[400]).toBeDefined()
      expect(standardErrorResponses[401]).toBeDefined()
      expect(standardErrorResponses[404]).toBeDefined()
      expect(standardErrorResponses[500]).toBeDefined()
    })

    test('error responses have correct structure', () => {
      const notFoundSchema = standardErrorResponses[404]
      const parsed = notFoundSchema.parse({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found'
        }
      })
      
      expect(parsed.error.code).toBe('NOT_FOUND')
    })
  })

  describe('Factory backward compatibility', () => {
    test('factory output matches manual schema structure', () => {
      // Original manual schema pattern
      const manualSchema = z.object({
        success: z.literal(true),
        data: TestSchema
      })
      
      // Factory-generated schema
      const factorySchema = createSuccessResponseSchema(TestSchema)
      
      // Same input should work for both
      const testData = {
        success: true,
        data: { id: 1, name: 'Test' }
      }
      
      const manualResult = manualSchema.parse(testData)
      const factoryResult = factorySchema.parse(testData)
      
      // Results should be identical
      expect(manualResult).toEqual(factoryResult)
    })

    test('list factory matches manual list schema', () => {
      const manualListSchema = z.object({
        success: z.literal(true),
        data: z.array(TestSchema)
      })
      
      const factoryListSchema = createListResponseSchema(TestSchema)
      
      const testData = {
        success: true,
        data: [
          { id: 1, name: 'Test1' },
          { id: 2, name: 'Test2' }
        ]
      }
      
      const manualResult = manualListSchema.parse(testData)
      const factoryResult = factoryListSchema.parse(testData)
      
      expect(manualResult).toEqual(factoryResult)
    })
  })

  describe('createMetadataResponseSchema', () => {
    test('generates response with metadata', () => {
      const metadataSchema = z.object({
        version: z.string(),
        timestamp: z.number()
      })
      
      const schema = createMetadataResponseSchema(TestSchema, metadataSchema)
      
      const parsed = schema.parse({
        success: true,
        data: { id: 1, name: 'Test' },
        metadata: {
          version: '1.0.0',
          timestamp: Date.now()
        }
      })
      
      expect(parsed.metadata.version).toBe('1.0.0')
    })
  })
})