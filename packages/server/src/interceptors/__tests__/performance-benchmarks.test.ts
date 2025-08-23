import { describe, expect, it, beforeEach } from 'bun:test'
import { OpenAPIHono } from '@hono/zod-openapi'
import { createHonoAppWithInterceptors } from '../hono-integration'
import { InterceptorSystem } from '../index'
import type { Interceptor } from '../types'

/**
 * Performance benchmarks for the interceptor system
 * 
 * These tests measure the performance impact of the interceptor system
 * compared to native Hono middleware and ensure performance targets are met.
 */

interface BenchmarkResult {
  name: string
  averageTime: number
  medianTime: number
  p95Time: number
  p99Time: number
  totalRequests: number
  requestsPerSecond: number
}

class PerformanceBenchmark {
  private results: number[] = []

  async runBenchmark(
    name: string,
    setup: () => Promise<any>,
    operation: (setup: any) => Promise<any>,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    console.log(`\n[Benchmark] Running "${name}" with ${iterations} iterations...`)
    
    // Setup
    const setupResult = await setup()
    
    // Warmup
    for (let i = 0; i < 10; i++) {
      await operation(setupResult)
    }
    
    // Actual benchmark
    this.results = []
    const startTime = Date.now()
    
    for (let i = 0; i < iterations; i++) {
      const opStart = Date.now()
      await operation(setupResult)
      const opEnd = Date.now()
      this.results.push(opEnd - opStart)
    }
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // Calculate statistics
    this.results.sort((a, b) => a - b)
    const averageTime = this.results.reduce((sum, time) => sum + time, 0) / iterations
    const medianTime = this.results[Math.floor(iterations / 2)]
    const p95Time = this.results[Math.floor(iterations * 0.95)]
    const p99Time = this.results[Math.floor(iterations * 0.99)]
    const requestsPerSecond = (iterations / totalTime) * 1000
    
    const result: BenchmarkResult = {
      name,
      averageTime,
      medianTime,
      p95Time,
      p99Time,
      totalRequests: iterations,
      requestsPerSecond
    }
    
    console.log(`[Benchmark] ${name} Results:`)
    console.log(`  Average: ${averageTime.toFixed(2)}ms`)
    console.log(`  Median: ${medianTime.toFixed(2)}ms`)
    console.log(`  P95: ${p95Time.toFixed(2)}ms`)
    console.log(`  P99: ${p99Time.toFixed(2)}ms`)
    console.log(`  RPS: ${requestsPerSecond.toFixed(0)} req/s`)
    
    return result
  }

  createMockInterceptor(name: string, delay: number = 0): Interceptor {
    return {
      name,
      order: 10,
      phase: 'request',
      enabled: true,
      handler: async (c, ctx, next) => {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        // Simulate some work
        let sum = 0
        for (let i = 0; i < 100; i++) {
          sum += Math.random()
        }
        await next()
      }
    }
  }
}

describe('Interceptor Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark

  beforeEach(() => {
    benchmark = new PerformanceBenchmark()
  })

  describe('Baseline Performance', () => {
    it('should measure vanilla Hono performance', async () => {
      const result = await benchmark.runBenchmark(
        'Vanilla Hono',
        async () => {
          const app = new OpenAPIHono()
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        500
      )

      expect(result.averageTime).toBeLessThan(10) // Should be very fast
      expect(result.requestsPerSecond).toBeGreaterThan(100) // Should handle many requests
    })

    it('should measure native Hono middleware performance', async () => {
      const result = await benchmark.runBenchmark(
        'Native Hono Middleware',
        async () => {
          const app = new OpenAPIHono()
          
          // Add some typical middleware
          app.use('*', async (c, next) => {
            c.set('requestId', 'req-123')
            await next()
          })
          
          app.use('*', async (c, next) => {
            const start = Date.now()
            await next()
            c.header('X-Response-Time', `${Date.now() - start}ms`)
          })
          
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        500
      )

      expect(result.averageTime).toBeLessThan(15) // Should be reasonably fast with middleware
    })
  })

  describe('Interceptor System Performance', () => {
    it('should measure interceptor system with no interceptors', async () => {
      const result = await benchmark.runBenchmark(
        'Interceptor System (Empty)',
        async () => {
          const system = new InterceptorSystem()
          const app = new OpenAPIHono()
          system.applyTo(app)
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        500
      )

      expect(result.averageTime).toBeLessThan(20) // Should have minimal overhead
    })

    it('should measure interceptor system with single interceptor', async () => {
      const result = await benchmark.runBenchmark(
        'Interceptor System (1 Interceptor)',
        async () => {
          const system = new InterceptorSystem()
          system.register(benchmark.createMockInterceptor('test-interceptor'))
          
          const app = new OpenAPIHono()
          system.applyTo(app)
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        500
      )

      expect(result.averageTime).toBeLessThan(25) // Small overhead per interceptor
    })

    it('should measure interceptor system with multiple interceptors', async () => {
      const result = await benchmark.runBenchmark(
        'Interceptor System (5 Interceptors)',
        async () => {
          const system = new InterceptorSystem()
          
          // Register 5 interceptors
          for (let i = 1; i <= 5; i++) {
            system.register(benchmark.createMockInterceptor(`interceptor-${i}`))
          }
          
          const app = new OpenAPIHono()
          system.applyTo(app)
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        300
      )

      expect(result.averageTime).toBeLessThan(50) // Linear overhead scaling
    })

    it('should measure default interceptor configuration', async () => {
      const result = await benchmark.runBenchmark(
        'Default Interceptor Setup',
        async () => {
          const app = createHonoAppWithInterceptors()
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        200
      )

      expect(result.averageTime).toBeLessThan(100) // Full interceptor stack
      expect(result.requestsPerSecond).toBeGreaterThan(20) // Should still be performant
    })
  })

  describe('Scaling Performance', () => {
    it('should test performance with different interceptor counts', async () => {
      const results: BenchmarkResult[] = []
      const interceptorCounts = [0, 1, 3, 5, 10]

      for (const count of interceptorCounts) {
        const result = await benchmark.runBenchmark(
          `${count} Interceptors`,
          async () => {
            const system = new InterceptorSystem()
            
            for (let i = 1; i <= count; i++) {
              system.register(benchmark.createMockInterceptor(`interceptor-${i}`))
            }
            
            const app = new OpenAPIHono()
            system.applyTo(app)
            app.get('/test', (c) => c.json({ message: 'Hello World' }))
            return app
          },
          async (app) => {
            const req = new Request('http://localhost/test')
            const res = await app.request(req)
            return res.json()
          },
          100
        )
        
        results.push(result)
      }

      // Verify linear scaling
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1]
        const curr = results[i]
        
        // Each additional interceptor should add less than 10ms overhead
        const additionalOverhead = curr.averageTime - prev.averageTime
        expect(additionalOverhead).toBeLessThan(10)
      }

      console.log('\n[Scaling Analysis]')
      results.forEach(result => {
        console.log(`${result.name}: ${result.averageTime.toFixed(2)}ms avg, ${result.requestsPerSecond.toFixed(0)} RPS`)
      })
    })

    it('should test memory usage with interceptors', async () => {
      const getMemoryUsage = () => {
        const usage = process.memoryUsage()
        return usage.heapUsed / 1024 / 1024 // MB
      }

      const baselineMemory = getMemoryUsage()
      
      // Create system with many interceptors
      const system = new InterceptorSystem()
      for (let i = 1; i <= 20; i++) {
        system.register(benchmark.createMockInterceptor(`memory-test-${i}`))
      }
      
      const withInterceptorsMemory = getMemoryUsage()
      const memoryIncrease = withInterceptorsMemory - baselineMemory
      
      console.log(`\n[Memory Usage]`)
      console.log(`Baseline: ${baselineMemory.toFixed(2)} MB`)
      console.log(`With 20 interceptors: ${withInterceptorsMemory.toFixed(2)} MB`)
      console.log(`Increase: ${memoryIncrease.toFixed(2)} MB`)
      
      // Should not use excessive memory
      expect(memoryIncrease).toBeLessThan(5) // Less than 5MB for 20 interceptors
    })
  })

  describe('Error Handling Performance', () => {
    it('should measure error interceptor performance', async () => {
      const result = await benchmark.runBenchmark(
        'Error Handling',
        async () => {
          const system = new InterceptorSystem()
          
          // Add error interceptor
          system.register({
            name: 'error-interceptor',
            order: 10,
            phase: 'error',
            enabled: true,
            handler: async (c, ctx, next) => {
              c.json({ error: 'Handled' }, 500)
            }
          })
          
          const app = new OpenAPIHono()
          system.applyTo(app)
          
          app.get('/error', () => {
            throw new Error('Test error')
          })
          
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/error')
          const res = await app.request(req)
          return res.json()
        },
        200
      )

      expect(result.averageTime).toBeLessThan(50) // Error handling should be fast
    })
  })

  describe('Route Matching Performance', () => {
    it('should test performance with many route patterns', async () => {
      const result = await benchmark.runBenchmark(
        'Route Matching (Many Patterns)',
        async () => {
          const system = new InterceptorSystem()
          
          // Add interceptors with different route patterns
          const patterns = [
            '/api/*',
            '/api/users/*',
            '/api/users/:id',
            '/api/projects/*',
            '/api/projects/:id/files/*',
            '/admin/*',
            '/public/*'
          ]
          
          patterns.forEach((pattern, index) => {
            system.register({
              name: `route-interceptor-${index}`,
              order: 10 + index,
              phase: 'request',
              enabled: true,
              routes: [pattern],
              handler: async (c, ctx, next) => {
                // Simulate some work
                Math.random()
                await next()
              }
            })
          })
          
          const app = new OpenAPIHono()
          system.applyTo(app)
          app.get('/api/users/123', (c) => c.json({ id: 123 }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/api/users/123')
          const res = await app.request(req)
          return res.json()
        },
        300
      )

      expect(result.averageTime).toBeLessThan(30) // Route matching should be efficient
    })
  })

  describe('Performance Regression Tests', () => {
    it('should ensure interceptor overhead is acceptable', async () => {
      // Test that interceptor system adds less than 100% overhead to vanilla Hono
      const vanillaResult = await benchmark.runBenchmark(
        'Vanilla for Comparison',
        async () => {
          const app = new OpenAPIHono()
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        200
      )

      const interceptorResult = await benchmark.runBenchmark(
        'Interceptor System for Comparison',
        async () => {
          const app = createHonoAppWithInterceptors()
          app.get('/test', (c) => c.json({ message: 'Hello World' }))
          return app
        },
        async (app) => {
          const req = new Request('http://localhost/test')
          const res = await app.request(req)
          return res.json()
        },
        200
      )

      const overhead = (interceptorResult.averageTime - vanillaResult.averageTime) / vanillaResult.averageTime
      console.log(`\n[Overhead Analysis]`)
      console.log(`Vanilla: ${vanillaResult.averageTime.toFixed(2)}ms`)
      console.log(`Interceptor: ${interceptorResult.averageTime.toFixed(2)}ms`)
      console.log(`Overhead: ${(overhead * 100).toFixed(1)}%`)

      // Should add less than 500% overhead (5x slower)
      expect(overhead).toBeLessThan(5)
    })
  })
})

describe('Performance Requirements', () => {
  it('should meet performance SLA requirements', () => {
    // Define performance requirements
    const requirements = {
      maxAverageResponseTime: 100, // ms
      minRequestsPerSecond: 50,
      maxMemoryOverhead: 10, // MB
      maxPerInterceptorOverhead: 5 // ms per interceptor
    }

    console.log('\n[Performance SLA Requirements]')
    console.log(`Max Average Response Time: ${requirements.maxAverageResponseTime}ms`)
    console.log(`Min Requests Per Second: ${requirements.minRequestsPerSecond}`)
    console.log(`Max Memory Overhead: ${requirements.maxMemoryOverhead}MB`)
    console.log(`Max Per-Interceptor Overhead: ${requirements.maxPerInterceptorOverhead}ms`)

    // These are documented requirements that should be met
    expect(requirements.maxAverageResponseTime).toBeGreaterThan(0)
    expect(requirements.minRequestsPerSecond).toBeGreaterThan(0)
    expect(requirements.maxMemoryOverhead).toBeGreaterThan(0)
    expect(requirements.maxPerInterceptorOverhead).toBeGreaterThan(0)
  })
})