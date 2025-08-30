import { describe, it, expect } from 'bun:test'
import { Hono } from 'hono'
import { createCrudRoutes } from '../src/routes/factories/crud-routes-factory'

describe('Route Performance', () => {
  it('should handle CRUD routes efficiently', async () => {
    const app = new Hono()
    
    // Mock service
    const mockService = {
      list: async () => [],
      get: async (id: number) => ({ id, name: 'Test' }),
      getById: async (id: number) => ({ id, name: 'Test' }),
      create: async (data: any) => ({ id: 1, ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async (id: number) => true
    }
    
    // Create routes
    const routes = createCrudRoutes({
      entityName: 'Test',
      path: 'api/test',
      tags: ['Test'],
      service: mockService,
      schemas: {
        entity: {} as any,
        create: {} as any,
        update: {} as any
      }
    })
    
    app.route('/', routes)
    
    // Benchmark requests
    const startTime = performance.now()
    const requests = []
    
    // Simulate 100 requests
    for (let i = 0; i < 100; i++) {
      requests.push(
        app.request('/api/test', { method: 'GET' }),
        app.request('/api/test/1', { method: 'GET' }),
        app.request('/api/test', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' })
        })
      )
    }
    
    await Promise.all(requests)
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTime = totalTime / 300 // 300 total requests
    
    console.log(`Total time: ${totalTime.toFixed(2)}ms`)
    console.log(`Average per request: ${avgTime.toFixed(2)}ms`)
    
    // Performance should be under 5ms per request
    expect(avgTime).toBeLessThan(5)
  })
  
  it('should have minimal memory overhead', () => {
    const initialMemory = process.memoryUsage().heapUsed
    
    // Create 10 route sets
    const routes = []
    for (let i = 0; i < 10; i++) {
      routes.push(createCrudRoutes({
        entityName: `Entity${i}`,
        path: `api/entity${i}`,
        tags: ['Test'],
        service: {
          list: async () => [],
          get: async () => null,
          getById: async () => null,
          create: async () => null,
          update: async () => null,
          delete: async () => null
        } as any,
        schemas: {
          entity: {} as any,
          create: {} as any,
          update: {} as any
        }
      }))
    }
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024 // MB
    
    console.log(`Memory used for 10 route sets: ${memoryUsed.toFixed(2)}MB`)
    
    // Should use less than 10MB for 10 route sets
    expect(memoryUsed).toBeLessThan(10)
  })
})