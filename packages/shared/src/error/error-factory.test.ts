import { describe, test, expect } from 'bun:test'
import { ZodError, z } from 'zod'
import {
  ErrorFactory,
  assertExists,
  assertValid,
  assertUpdateSucceeded,
  assertDeleteSucceeded,
  assertDatabaseOperation,
  handleZodError,
  withErrorContext,
  createErrorHandler
} from './error-factory'
import { ApiError } from './api-error'

describe('ErrorFactory', () => {
  describe('Entity Errors', () => {
    test('notFound creates proper 404 error', () => {
      const error = ErrorFactory.notFound('User', 123)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(404)
      expect(error.message).toBe('User with ID 123 not found')
      expect(error.code).toBe('USER_NOT_FOUND')
      expect(error.details).toEqual({ entity: 'User', id: 123 })
    })

    test('notFound with context includes metadata', () => {
      const error = ErrorFactory.notFound('Project', 'abc-123', {
        userId: 456,
        action: 'read'
      })
      expect(error.details).toEqual({
        entity: 'Project',
        id: 'abc-123',
        userId: 456,
        action: 'read'
      })
    })

    test('alreadyExists creates proper 409 error', () => {
      const error = ErrorFactory.alreadyExists('User', 'email', 'test@example.com')
      expect(error.status).toBe(409)
      expect(error.message).toBe("User with email 'test@example.com' already exists")
      expect(error.code).toBe('ALREADY_EXISTS')
    })

    test('duplicate is alias for alreadyExists', () => {
      const error1 = ErrorFactory.duplicate('Task', 'name', 'Test Task')
      const error2 = ErrorFactory.alreadyExists('Task', 'name', 'Test Task')
      expect(error1.message).toBe(error2.message)
      expect(error1.code).toBe(error2.code)
    })
  })

  describe('Validation Errors', () => {
    test('validationFailed with ZodError', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      })

      try {
        schema.parse({ name: 123, age: 'invalid' })
      } catch (zodError) {
        const error = ErrorFactory.validationFailed(zodError as ZodError)
        expect(error.status).toBe(400)
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.details?.errors).toBeDefined()
        expect(error.details?.issues).toBeDefined()
      }
    })

    test('validationFailed with custom errors', () => {
      const customErrors = { field: 'name', message: 'Invalid name' }
      const error = ErrorFactory.validationFailed(customErrors)
      expect(error.status).toBe(400)
      expect(error.details?.errors).toEqual(customErrors)
    })

    test('invalidInput creates proper error', () => {
      const error = ErrorFactory.invalidInput('age', 'number', 'string value')
      expect(error.status).toBe(400)
      expect(error.message).toBe('Invalid age: expected number, got string')
      expect(error.code).toBe('INVALID_INPUT')
    })

    test('missingRequired creates proper error', () => {
      const error = ErrorFactory.missingRequired('email', 'user registration')
      expect(error.message).toBe('Missing required field: email in user registration')
      expect(error.code).toBe('MISSING_REQUIRED_FIELD')
    })
  })

  describe('Operation Errors', () => {
    test('operationFailed creates proper error', () => {
      const error = ErrorFactory.operationFailed('file upload', 'disk full')
      expect(error.status).toBe(500)
      expect(error.message).toBe("Operation 'file upload' failed: disk full")
      expect(error.code).toBe('OPERATION_FAILED')
    })

    test('createFailed with reason', () => {
      const error = ErrorFactory.createFailed('User', 'database constraint')
      expect(error.message).toBe('Failed to create User: database constraint')
      expect(error.code).toBe('CREATE_FAILED')
    })

    test('updateFailed with ID', () => {
      const error = ErrorFactory.updateFailed('Project', 456)
      expect(error.message).toBe('Failed to update Project with ID 456')
      expect(error.code).toBe('UPDATE_FAILED')
    })

    test('deleteFailed with reason', () => {
      const error = ErrorFactory.deleteFailed('Task', 'task-789', 'has dependencies')
      expect(error.message).toBe('Failed to delete Task with ID task-789: has dependencies')
    })
  })

  describe('Authentication & Authorization Errors', () => {
    test('unauthorized with default message', () => {
      const error = ErrorFactory.unauthorized()
      expect(error.status).toBe(401)
      expect(error.message).toBe('Unauthorized')
      expect(error.code).toBe('UNAUTHORIZED')
    })

    test('unauthorized with custom reason', () => {
      const error = ErrorFactory.unauthorized('Invalid token')
      expect(error.message).toBe('Invalid token')
    })

    test('forbidden with resource and action', () => {
      const error = ErrorFactory.forbidden('admin panel', 'write')
      expect(error.status).toBe(403)
      expect(error.message).toBe('Access to admin panel for write is forbidden')
      expect(error.code).toBe('FORBIDDEN')
    })

    test('tokenExpired creates proper error', () => {
      const error = ErrorFactory.tokenExpired('refresh token')
      expect(error.status).toBe(401)
      expect(error.message).toBe('refresh token has expired')
      expect(error.code).toBe('TOKEN_EXPIRED')
    })

    test('invalidCredentials creates proper error', () => {
      const error = ErrorFactory.invalidCredentials()
      expect(error.message).toBe('Invalid credentials provided')
      expect(error.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('Service & System Errors', () => {
    test('serviceUnavailable with retry', () => {
      const error = ErrorFactory.serviceUnavailable('Database', 30)
      expect(error.status).toBe(503)
      expect(error.message).toBe('Database is currently unavailable')
      expect(error.details?.retryAfter).toBe(30)
    })

    test('rateLimitExceeded with details', () => {
      const error = ErrorFactory.rateLimitExceeded(100, '1 hour', 3600)
      expect(error.status).toBe(429)
      expect(error.message).toBe('Rate limit exceeded: 100 requests per 1 hour')
      expect(error.details?.limit).toBe(100)
      expect(error.details?.window).toBe('1 hour')
      expect(error.details?.retryAfter).toBe(3600)
    })

    test('databaseError with operation', () => {
      const error = ErrorFactory.databaseError('INSERT', 'constraint violation')
      expect(error.message).toBe('Database error during INSERT: constraint violation')
      expect(error.code).toBe('DATABASE_ERROR')
    })

    test('fileSystemError with path', () => {
      const error = ErrorFactory.fileSystemError('read', '/path/to/file', 'permission denied')
      expect(error.message).toBe("File system error during read on '/path/to/file': permission denied")
      expect(error.code).toBe('FILE_SYSTEM_ERROR')
    })

    test('externalServiceError with details', () => {
      const error = ErrorFactory.externalServiceError('Payment Gateway', 502, { error: 'timeout' })
      expect(error.status).toBe(502)
      expect(error.message).toBe("External service 'Payment Gateway' returned an error")
      expect(error.details?.statusCode).toBe(502)
    })
  })

  describe('Business Logic Errors', () => {
    test('invalidState creates proper error', () => {
      const error = ErrorFactory.invalidState('Order', 'delivered', 'cancel')
      expect(error.message).toBe('Cannot cancel Order in current state: delivered')
      expect(error.code).toBe('INVALID_STATE')
    })

    test('invalidRelationship creates proper error', () => {
      const error = ErrorFactory.invalidRelationship('Task', 123, 'Project', 456)
      expect(error.message).toBe('Invalid relationship: Task 123 does not belong to Project 456')
      expect(error.code).toBe('INVALID_RELATIONSHIP')
    })

    test('businessRuleViolation with details', () => {
      const error = ErrorFactory.businessRuleViolation('minimum order amount', 'Order must be at least $10')
      expect(error.status).toBe(422)
      expect(error.message).toBe('Business rule violation: minimum order amount. Order must be at least $10')
      expect(error.code).toBe('BUSINESS_RULE_VIOLATION')
    })

    test('conflict creates proper error', () => {
      const error = ErrorFactory.conflict('Resource is locked', { lockedBy: 'user-123' })
      expect(error.status).toBe(409)
      expect(error.message).toBe('Resource is locked')
      expect(error.code).toBe('CONFLICT')
    })
  })

  describe('Utility Methods', () => {
    test('wrap returns ApiError as-is', () => {
      const original = new ApiError(404, 'Not found', 'NOT_FOUND')
      const wrapped = ErrorFactory.wrap(original)
      expect(wrapped).toBe(original)
    })

    test('wrap handles ZodError', () => {
      const schema = z.string()
      try {
        schema.parse(123)
      } catch (zodError) {
        const wrapped = ErrorFactory.wrap(zodError)
        expect(wrapped.status).toBe(400)
        expect(wrapped.code).toBe('VALIDATION_ERROR')
      }
    })

    test('wrap handles Error with context', () => {
      const error = new Error('Something went wrong')
      const wrapped = ErrorFactory.wrap(error, 'user.create')
      expect(wrapped.message).toBe('user.create: Something went wrong')
      expect(wrapped.code).toBe('INTERNAL_ERROR')
    })

    test('wrap handles SQLite constraint errors', () => {
      const error = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed')
      const wrapped = ErrorFactory.wrap(error)
      expect(wrapped.status).toBe(409)
      expect(wrapped.code).toBe('CONFLICT')
    })

    test('wrap handles file system errors', () => {
      const error = new Error('ENOENT: no such file or directory')
      const wrapped = ErrorFactory.wrap(error)
      expect(wrapped.code).toBe('FILE_SYSTEM_ERROR')
    })

    test('forEntity creates entity-specific factory', () => {
      const userErrors = ErrorFactory.forEntity('User')

      const notFound = userErrors.notFound(123)
      expect(notFound.message).toBe('User with ID 123 not found')

      const createFailed = userErrors.createFailed('duplicate email')
      expect(createFailed.message).toBe('Failed to create User: duplicate email')
    })
  })

  describe('Helper Functions', () => {
    test('assertExists throws on null', () => {
      expect(() => assertExists(null, 'User', 123)).toThrow(ApiError)
      expect(() => assertExists(null, 'User', 123)).toThrow('User with ID 123 not found')
    })

    test('assertExists throws on undefined', () => {
      expect(() => assertExists(undefined, 'Project', 'abc')).toThrow('Project with ID abc not found')
    })

    test('assertExists passes with value', () => {
      const value = { id: 1, name: 'Test' }
      expect(() => assertExists(value, 'Entity', 1)).not.toThrow()
    })

    test('assertValid validates schema', () => {
      const schema = z.object({ name: z.string() })
      const result = assertValid({ name: 'Test' }, schema)
      expect(result).toEqual({ name: 'Test' })
    })

    test('assertValid throws on invalid data', () => {
      const schema = z.object({ age: z.number() })
      expect(() => assertValid({ age: 'not a number' }, schema)).toThrow(ApiError)
    })

    test('assertUpdateSucceeded throws on failure', () => {
      expect(() => assertUpdateSucceeded(null, 'User', 123)).toThrow('Failed to update User')
      expect(() => assertUpdateSucceeded({ changes: 0 }, 'User', 123)).toThrow('No rows affected')
    })

    test('assertUpdateSucceeded passes on success', () => {
      expect(() => assertUpdateSucceeded({ changes: 1 }, 'User', 123)).not.toThrow()
      expect(() => assertUpdateSucceeded(true, 'User', 123)).not.toThrow()
    })

    test('assertDeleteSucceeded throws on failure', () => {
      expect(() => assertDeleteSucceeded(null, 'Task', 456)).toThrow('Failed to delete Task')
      expect(() => assertDeleteSucceeded({ changes: 0 }, 'Task', 456)).toThrow('No rows affected')
    })

    test('assertDatabaseOperation throws on null', () => {
      expect(() => assertDatabaseOperation(null, 'SELECT')).toThrow('Database error during SELECT')
    })

    test('handleZodError throws with context', () => {
      const schema = z.string()
      try {
        schema.parse(123)
      } catch (zodError) {
        expect(() => handleZodError(zodError as ZodError, 'User', 'create')).toThrow(ApiError)
      }
    })
  })

  describe('Error Context', () => {
    test('withErrorContext adds context to errors', async () => {
      const operation = async () => {
        throw new Error('Operation failed')
      }

      try {
        await withErrorContext(operation, {
          entity: 'User',
          action: 'create',
          userId: 123
        })
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        const apiError = error as ApiError
        expect(apiError.message).toContain('User.create')
        expect(apiError.details?.entity).toBe('User')
        expect(apiError.details?.userId).toBe(123)
      }
    })

    test('withErrorContext preserves ApiError', async () => {
      const originalError = new ApiError(404, 'Not found', 'NOT_FOUND', { original: true })

      const operation = async () => {
        throw originalError
      }

      try {
        await withErrorContext(operation, {
          entity: 'Project',
          action: 'read'
        })
      } catch (error) {
        const apiError = error as ApiError
        expect(apiError.status).toBe(404)
        expect(apiError.details?.original).toBe(true)
        expect(apiError.details?.entity).toBe('Project')
      }
    })
  })

  describe('Error Handler Creation', () => {
    test('createErrorHandler creates entity-specific handler', async () => {
      const handler = createErrorHandler('Product')

      // Test wrap
      const wrapped = handler.wrap(new Error('Test'), 'update')
      expect(wrapped.message).toContain('Product.update')

      // Test assertExists
      expect(() => handler.assertExists(null, 789)).toThrow('Product with ID 789 not found')

      // Test assertUpdateSucceeded
      expect(() => handler.assertUpdateSucceeded({ changes: 0 }, 'prod-123')).toThrow('Failed to update Product')

      // Test withContext
      try {
        await handler.withContext(async () => {
          throw new Error('Context test')
        }, 'delete')
      } catch (error) {
        const apiError = error as ApiError
        expect(apiError.message).toContain('Product.delete')
      }
    })
  })
})
