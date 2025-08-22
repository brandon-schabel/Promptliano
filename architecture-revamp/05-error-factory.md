# 05: Unified Error Factory System

## 📋 Error Factory TODO Tracker

### Core Implementation
- [ ] Create enhanced ErrorFactory class with 15+ standardized error methods (Priority: HIGH) [3 hours]
- [ ] Implement ApiError class with proper status codes and context details (Priority: HIGH) [1.5 hours]
- [ ] Create error context tracking system with withErrorContext wrapper (Priority: HIGH) [2 hours]
- [ ] Add assertExists and assertValid helper functions (Priority: HIGH) [1 hour]
- [ ] Implement error code standardization with consistent naming patterns (Priority: HIGH) [1 hour]

### Error Type Standardization
- [ ] Define entity-specific error factories (User, Ticket, Task, Project, etc.) (Priority: HIGH) [2 hours]
- [ ] Create validation error handling with Zod integration (Priority: HIGH) [1.5 hours]
- [ ] Implement authentication/authorization error patterns (Priority: HIGH) [1 hour]
- [ ] Add service availability and rate limiting errors (Priority: MEDIUM) [1 hour]
- [ ] Create database operation error patterns (Priority: HIGH) [1.5 hours]

### Context Tracking Setup
- [ ] Design error context structure for operation tracking (Priority: HIGH) [1 hour]
- [ ] Implement request tracing with correlation IDs (Priority: MEDIUM) [2 hours]
- [ ] Add user context to error logging (Priority: MEDIUM) [1 hour]
- [ ] Create error context inheritance for nested operations (Priority: MEDIUM) [1.5 hours]
- [ ] Add performance metrics to error context (Priority: LOW) [1 hour]

### Integration Across All Layers
- [ ] Replace 50+ manual error patterns in storage layer (Priority: HIGH) [4 hours]
- [ ] Migrate service layer error handling to ErrorFactory (Priority: HIGH) [4 hours]
- [ ] Update all route handlers to use standardized errors (Priority: HIGH) [3 hours]
- [ ] Convert client-side error handling patterns (Priority: MEDIUM) [2 hours]
- [ ] Update React hooks to handle standardized error responses (Priority: MEDIUM) [2 hours]

### Middleware Implementation
- [ ] Create global error handler middleware for Hono (Priority: HIGH) [2 hours]
- [ ] Implement error logging with structured format (Priority: HIGH) [1.5 hours]
- [ ] Add error response formatting middleware (Priority: HIGH) [1 hour]
- [ ] Create development vs production error detail filtering (Priority: MEDIUM) [1 hour]
- [ ] Implement error notification system for critical failures (Priority: LOW) [2 hours]

### Testing Requirements
- [ ] Write comprehensive ErrorFactory unit tests (Priority: HIGH) [2 hours]
- [ ] Create error handling integration tests for API routes (Priority: HIGH) [3 hours]
- [ ] Add error context propagation tests (Priority: MEDIUM) [1.5 hours]
- [ ] Test error middleware with various error types (Priority: HIGH) [2 hours]
- [ ] Create end-to-end error scenario tests (Priority: MEDIUM) [2 hours]

### Documentation & Migration
- [ ] Create error handling migration guide (Priority: MEDIUM) [2 hours]
- [ ] Document error code standards and conventions (Priority: MEDIUM) [1 hour]
- [ ] Add error debugging guide for development (Priority: LOW) [1 hour]
- [ ] Create error monitoring and alerting documentation (Priority: LOW) [1 hour]

**Total Estimated Effort: 45 hours**
**Critical Path: Core Implementation → Integration → Testing**

## Dependencies
- **REQUIRES**: None (Can start immediately)
- **BLOCKS**: None (Used by all layers)
- **PARALLEL WITH**: All others (Independent system)

## Overview
Create a centralized error handling system that eliminates 3,000+ lines of inconsistent error handling code. Provides standardized error creation, consistent error responses, and proper error context throughout the application.

## Current Problems

```typescript
// PROBLEM: 50+ different ways to handle errors
throw new Error('Not found');
throw new ApiError(404, 'Not found');
return { error: 'Not found' };
return null; // Silent failure
console.error(error); // Just log it
res.status(500).send('Error'); // Manual response
```

## Target Implementation

### 1. Centralized Error Factory

```typescript
// packages/shared/src/errors/error-factory.ts
export class ErrorFactory {
  // Entity errors
  static notFound(entity: string, id: number | string): ApiError {
    return new ApiError(404, `${entity} with ID ${id} not found`, {
      code: `${entity.toUpperCase()}_NOT_FOUND`,
      entity,
      id,
    });
  }

  static alreadyExists(entity: string, field: string, value: string): ApiError {
    return new ApiError(409, `${entity} with ${field} '${value}' already exists`, {
      code: 'ALREADY_EXISTS',
      entity,
      field,
      value,
    });
  }

  // Validation errors
  static validationFailed(errors: ZodError): ApiError {
    return new ApiError(400, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      errors: errors.format(),
    });
  }

  static invalidInput(field: string, expected: string): ApiError {
    return new ApiError(400, `Invalid ${field}: expected ${expected}`, {
      code: 'INVALID_INPUT',
      field,
      expected,
    });
  }

  // Operation errors
  static operationFailed(operation: string, reason?: string): ApiError {
    return new ApiError(500, `Operation '${operation}' failed${reason ? `: ${reason}` : ''}`, {
      code: 'OPERATION_FAILED',
      operation,
      reason,
    });
  }

  // Auth errors
  static unauthorized(reason?: string): ApiError {
    return new ApiError(401, reason || 'Unauthorized', {
      code: 'UNAUTHORIZED',
    });
  }

  static forbidden(resource: string): ApiError {
    return new ApiError(403, `Access to ${resource} is forbidden`, {
      code: 'FORBIDDEN',
      resource,
    });
  }

  // Service errors
  static serviceUnavailable(service: string): ApiError {
    return new ApiError(503, `${service} is currently unavailable`, {
      code: 'SERVICE_UNAVAILABLE',
      service,
    });
  }

  static rateLimitExceeded(limit: number, window: string): ApiError {
    return new ApiError(429, `Rate limit exceeded: ${limit} requests per ${window}`, {
      code: 'RATE_LIMIT_EXCEEDED',
      limit,
      window,
    });
  }

  // Wrap unknown errors
  static wrap(error: unknown, context?: string): ApiError {
    if (error instanceof ApiError) return error;
    
    if (error instanceof ZodError) {
      return this.validationFailed(error);
    }
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new ApiError(500, context ? `${context}: ${message}` : message, {
      code: 'INTERNAL_ERROR',
      originalError: error instanceof Error ? error.stack : error,
    });
  }
}
```

### 2. Error Context System

```typescript
// packages/shared/src/errors/error-context.ts
export async function withErrorContext<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw ErrorFactory.wrap(error, `${context.entity}.${context.action}`);
  }
}

export function assertExists<T>(
  value: T | null | undefined,
  entity: string,
  id: number | string
): asserts value is T {
  if (!value) {
    throw ErrorFactory.notFound(entity, id);
  }
}

export function assertValid<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw ErrorFactory.validationFailed(error);
    }
    throw ErrorFactory.wrap(error, context);
  }
}
```

### 3. Global Error Handler

```typescript
// packages/server/src/middleware/error-handler.ts
export function globalErrorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({
      error: err.message,
      code: err.details?.code,
      details: err.details,
    }, err.statusCode);
  }

  // Log unexpected errors
  logger.error('Unexpected error:', err);

  return c.json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  }, 500);
}

app.onError(globalErrorHandler);
```

## Migration Strategy

### Phase 1: Create Error Infrastructure (Day 1)
1. Implement ErrorFactory class
2. Create error context helpers
3. Set up global error handler
4. Add error logging

### Phase 2: Replace Error Creation (Day 2-3)
```typescript
// Find and replace patterns
// OLD: throw new Error('Not found')
// NEW: throw ErrorFactory.notFound('Entity', id)

// OLD: return null
// NEW: throw appropriate error

// OLD: console.error(error)
// NEW: logger.error(error) + throw
```

### Phase 3: Add Error Context (Day 4)
```typescript
// Wrap operations with context
return withErrorContext(
  async () => {
    // operation
  },
  { entity: 'Ticket', action: 'create' }
);
```

## Success Metrics

- ✅ 3,000+ lines of error handling removed
- ✅ 100% consistent error responses
- ✅ All errors have proper context
- ✅ Improved debugging with error traces

## Definition of Done

- [ ] ErrorFactory implemented
- [ ] All manual errors replaced
- [ ] Global error handler configured
- [ ] Error logging integrated
- [ ] Tests for error scenarios