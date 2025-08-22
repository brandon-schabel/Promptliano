# 05: Unified Error Factory System

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