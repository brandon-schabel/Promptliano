/**
 * Query Serialization Layer for Test Isolation
 * 
 * Solves the "Missing parameter '1'" errors by ensuring that all database
 * queries execute sequentially rather than concurrently, preventing SQLite
 * prepared statement corruption in Bun's test environment.
 * 
 * This is a workaround for Bun 1.2.0's concurrent SQLite access issues
 * with Drizzle ORM parameter binding.
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { Database } from 'bun:sqlite'

/**
 * Query queue to serialize all database operations
 */
class QueryQueue {
  private static instance: QueryQueue
  private queue: Promise<any> = Promise.resolve()
  private operations = 0
  private verbose = false
  
  static getInstance(verbose = false): QueryQueue {
    if (!QueryQueue.instance) {
      QueryQueue.instance = new QueryQueue()
      QueryQueue.instance.verbose = verbose
    }
    return QueryQueue.instance
  }
  
  /**
   * Execute a query function in the queue
   */
  async execute<T>(queryFn: () => Promise<T>, operation = 'query'): Promise<T> {
    const operationId = ++this.operations
    
    if (this.verbose) {
      console.log(`[QUERY QUEUE] Queuing operation ${operationId}: ${operation}`)
    }
    
    const result = this.queue.then(async () => {
      if (this.verbose) {
        console.log(`[QUERY QUEUE] Executing operation ${operationId}: ${operation}`)
      }
      
      try {
        const startTime = Date.now()
        const outcome = await queryFn()
        const duration = Date.now() - startTime
        
        if (this.verbose && duration > 100) {
          console.log(`[QUERY QUEUE] Completed operation ${operationId} in ${duration}ms`)
        }
        
        return outcome
      } catch (error) {
        if (this.verbose) {
          console.error(`[QUERY QUEUE] Failed operation ${operationId}:`, error)
        }
        throw error
      }
    })
    
    // Continue the queue even if this operation fails
    this.queue = result.catch(() => {})
    
    return result
  }
  
  /**
   * Reset the queue (for testing)
   */
  static reset(): void {
    QueryQueue.instance = undefined as any
  }
  
  /**
   * Get queue statistics
   */
  getStats(): { operations: number } {
    return { operations: this.operations }
  }
}

/**
 * Create a serialized Drizzle client that queues all operations
 */
export function createSerializedDrizzleClient(
  sqlite: Database, 
  options: { verbose?: boolean, schema?: any } = {}
): ReturnType<typeof drizzle> {
  const { verbose = false, schema } = options
  const queue = QueryQueue.getInstance(verbose)
  
  // Create the actual Drizzle client
  const originalClient = drizzle(sqlite, { schema, logger: verbose })
  
  // Track method calls for debugging
  const methodCalls = new Map<string, number>()
  
  // Proxy all method calls through the query queue
  return new Proxy(originalClient, {
    get(target, prop: string | symbol) {
      const value = target[prop as keyof typeof target]
      
      if (typeof value === 'function' && typeof prop === 'string') {
        // Track method usage
        const callCount = methodCalls.get(prop) || 0
        methodCalls.set(prop, callCount + 1)
        
        return (...args: any[]) => {
          const operation = `${prop}(${args.length} args)`
          
          return queue.execute(() => {
            // Apply the original method with proper context
            return value.apply(target, args)
          }, operation)
        }
      }
      
      return value
    }
  }) as ReturnType<typeof drizzle>
}

/**
 * Query execution utilities for advanced cases
 */
export const queryUtils = {
  /**
   * Execute multiple queries in sequence
   */
  async executeSequence<T>(queries: (() => Promise<T>)[]): Promise<T[]> {
    const queue = QueryQueue.getInstance()
    const results: T[] = []
    
    for (let i = 0; i < queries.length; i++) {
      const result = await queue.execute(queries[i], `sequence-${i}`)
      results.push(result)
    }
    
    return results
  },
  
  /**
   * Execute a query with retry logic for flaky operations
   */
  async executeWithRetry<T>(
    queryFn: () => Promise<T>, 
    maxRetries = 3, 
    operation = 'retry-query'
  ): Promise<T> {
    const queue = QueryQueue.getInstance()
    
    return queue.execute(async () => {
      let lastError: Error
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await queryFn()
        } catch (error) {
          lastError = error as Error
          
          // Don't retry on parameter binding errors - they won't recover
          if (lastError.message.includes('Missing parameter')) {
            throw lastError
          }
          
          // Wait briefly before retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, attempt * 10))
          }
        }
      }
      
      throw lastError!
    }, operation)
  },
  
  /**
   * Get queue statistics
   */
  getQueueStats() {
    return QueryQueue.getInstance().getStats()
  },
  
  /**
   * Reset the global queue (for testing)
   */
  resetQueue() {
    QueryQueue.reset()
  }
}

/**
 * Transaction wrapper that ensures all operations in a transaction
 * are executed in sequence
 */
export async function serializedTransaction<T>(
  db: ReturnType<typeof createSerializedDrizzleClient>,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const queue = QueryQueue.getInstance()
  
  return queue.execute(async () => {
    // Execute the entire transaction as a single queued operation
    return (db as any).transaction(callback)
  }, 'transaction')
}

/**
 * Batch operation helper
 */
export async function serializedBatch<T extends any[]>(
  db: ReturnType<typeof createSerializedDrizzleClient>,
  operations: T
): Promise<any[]> {
  const queue = QueryQueue.getInstance()
  
  return queue.execute(async () => {
    // Execute batch as a single queued operation
    return (db as any).batch(operations)
  }, 'batch')
}