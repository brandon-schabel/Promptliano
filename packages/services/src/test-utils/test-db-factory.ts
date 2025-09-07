import { createTestDatabase, TestDatabase } from '@promptliano/database'
import { createLogger } from '../utils/logger'

const logger = createLogger('TestDbFactory')

export interface TestDbContext {
  db: TestDatabase
  projectId: number
  queueId: number
  cleanup: () => Promise<void>
}

export class TestDatabaseFactory {
  private static instances = new Map<string, TestDbContext>()

  /**
   * Create an isolated test database with seeded data
   */
  static async createTestContext(testId?: string): Promise<TestDbContext> {
    const contextId = testId || `test-${Date.now()}-${Math.random()}`

    // Check if context already exists
    if (this.instances.has(contextId)) {
      return this.instances.get(contextId)!
    }

    logger.debug(`Creating test database context: ${contextId}`)

    // Create isolated database
    const db = await createTestDatabase({
      testId: contextId,
      verbose: false,
      seedData: false, // We'll seed manually to avoid interface issues
      useMemory: false // Use file-based for better isolation
    })

    const context: TestDbContext = {
      db,
      projectId: 0, // No seeded data - tests will create their own
      queueId: 0, // No seeded data - tests will create their own
      cleanup: async () => {
        logger.debug(`Cleaning up test database context: ${contextId}`)
        db.close()
        this.instances.delete(contextId)
      }
    }

    this.instances.set(contextId, context)
    return context
  }

  /**
   * Clean up all test contexts
   */
  static async cleanupAll(): Promise<void> {
    const promises = Array.from(this.instances.values()).map((ctx) => ctx.cleanup())
    await Promise.all(promises)
    this.instances.clear()
  }
}
