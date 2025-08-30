import { TestDatabase } from '@promptliano/database'
import { TestDatabaseFactory, TestDbContext } from './test-db-factory'
import { createLogger } from '../utils/logger'

const logger = createLogger('ServiceTestBase')

export abstract class ServiceTestBase {
    protected db!: TestDatabase
    protected testContext!: TestDbContext
    protected projectId!: number
    protected queueId!: number

    /**
     * Setup test database before each test
     */
    async beforeEach(testId?: string): Promise<void> {
        try {
            this.testContext = await TestDatabaseFactory.createTestContext(testId)
            this.db = this.testContext.db
            this.projectId = this.testContext.projectId
            this.queueId = this.testContext.queueId

            // Reset database state
            await this.db.reset()

            logger.debug(`Test setup complete for: ${testId}`)
        } catch (error) {
            logger.error('Failed to setup test database', error)
            throw error
        }
    }

    /**
     * Cleanup after each test
     */
    async afterEach(): Promise<void> {
        if (this.testContext) {
            await this.testContext.cleanup()
        }
    }

    /**
     * Cleanup after all tests in suite
     */
    static async afterAll(): Promise<void> {
        await TestDatabaseFactory.cleanupAll()
    }
}
