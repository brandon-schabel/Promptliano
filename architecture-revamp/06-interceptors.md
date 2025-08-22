# 06: Request/Response Interceptor System

## Dependencies
- **REQUIRES**: None (Can start immediately)
- **BLOCKS**: None (Middleware layer)
- **PARALLEL WITH**: All others (Independent system)

## Overview
Implement a centralized interceptor system for cross-cutting concerns like authentication, logging, caching, and metrics. Eliminates 2,000+ lines of repeated middleware code.

## Current Problems

```typescript
// PROBLEM: Same logic repeated in every route
app.post('/api/tickets', async (c) => {
  // Auth check (repeated 100+ times)
  const token = c.req.header('Authorization');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  
  // Logging (repeated 100+ times)
  console.log(`POST /api/tickets`);
  
  // Timing (repeated 100+ times)
  const start = Date.now();
  
  // ... actual logic
  
  // Response logging (repeated 100+ times)
  console.log(`Took ${Date.now() - start}ms`);
});
```

## Target Implementation

### 1. Request Interceptors

```typescript
// packages/server/src/interceptors/request-interceptors.ts
export const requestInterceptors = {
  // Authentication
  auth: async (c: Context, next: Next) => {
    const token = c.req.header('Authorization');
    
    if (!token && !isPublicRoute(c.req.path)) {
      throw ErrorFactory.unauthorized();
    }
    
    if (token) {
      const user = await validateToken(token);
      c.set('user', user);
    }
    
    await next();
  },

  // Request logging
  logging: async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = generateRequestId();
    
    c.set('requestId', requestId);
    
    logger.info({
      requestId,
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      ip: c.req.header('x-forwarded-for'),
    });
    
    await next();
    
    logger.info({
      requestId,
      status: c.res.status,
      duration: Date.now() - start,
    });
  },

  // Rate limiting
  rateLimit: async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const key = `${ip}:${c.req.path}`;
    
    if (await rateLimiter.isExceeded(key)) {
      throw ErrorFactory.rateLimitExceeded(60, '1 minute');
    }
    
    await rateLimiter.increment(key);
    await next();
  },

  // Request validation
  validation: async (c: Context, next: Next) => {
    // Validate common headers
    const contentType = c.req.header('content-type');
    
    if (c.req.method !== 'GET' && !contentType?.includes('application/json')) {
      throw ErrorFactory.invalidInput('content-type', 'application/json');
    }
    
    await next();
  },
};
```

### 2. Response Interceptors

```typescript
// packages/server/src/interceptors/response-interceptors.ts
export const responseInterceptors = {
  // Response caching
  cache: async (c: Context, next: Next) => {
    if (c.req.method === 'GET') {
      const cached = await cache.get(c.req.url);
      
      if (cached) {
        c.header('X-Cache', 'HIT');
        return c.json(cached);
      }
    }
    
    await next();
    
    if (c.req.method === 'GET' && c.res.status === 200) {
      const body = await c.res.json();
      await cache.set(c.req.url, body, 60000); // 1 minute
      c.header('X-Cache', 'MISS');
    }
  },

  // Response transformation
  transform: async (c: Context, next: Next) => {
    await next();
    
    // Wrap successful responses
    if (c.res.status < 400) {
      const body = await c.res.json();
      
      c.json({
        success: true,
        data: body,
        timestamp: Date.now(),
        requestId: c.get('requestId'),
      });
    }
  },

  // Metrics collection
  metrics: async (c: Context, next: Next) => {
    const start = Date.now();
    
    await next();
    
    metrics.record({
      route: c.req.path,
      method: c.req.method,
      status: c.res.status,
      duration: Date.now() - start,
    });
  },

  // Security headers
  security: async (c: Context, next: Next) => {
    await next();
    
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Strict-Transport-Security', 'max-age=31536000');
  },
};
```

### 3. Interceptor Chain

```typescript
// packages/server/src/interceptors/index.ts
export function applyInterceptors(app: Hono) {
  // Apply in specific order
  app.use('*', requestInterceptors.logging);
  app.use('*', requestInterceptors.rateLimit);
  app.use('*', requestInterceptors.validation);
  app.use('*', requestInterceptors.auth);
  
  app.use('*', responseInterceptors.cache);
  app.use('*', responseInterceptors.metrics);
  app.use('*', responseInterceptors.security);
  app.use('*', responseInterceptors.transform);
  
  return app;
}

// Usage
const app = new Hono();
applyInterceptors(app);
app.route('/api', generatedRoutes);
```

## Migration Strategy

### Phase 1: Create Interceptors (Day 1-2)
1. Implement request interceptors
2. Implement response interceptors
3. Create interceptor chain
4. Add configuration options

### Phase 2: Remove Duplicate Code (Day 3)
```typescript
// Remove from all routes:
// - Manual auth checks
// - Manual logging
// - Manual timing
// - Manual caching
// - Manual headers
```

## Success Metrics

- ✅ 2,000+ lines of middleware code removed
- ✅ 100% consistent auth checking
- ✅ Automatic request/response logging
- ✅ Built-in caching layer
- ✅ Centralized metrics collection

## Definition of Done

- [ ] All interceptors implemented
- [ ] Interceptor chain configured
- [ ] Duplicate middleware removed
- [ ] Tests for interceptors
- [ ] Performance benchmarks