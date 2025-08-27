import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import { createQueueService } from './queue-service'
import { createFlowService } from './flow-service'
import { createTestEnvironment } from './test-utils/test-environment'
import { queues, createBaseRepository, extendRepository } from '@promptliano/database'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

// Create test environment for core functionality tests
const testEnv = createTestEnvironment({ 
  suiteName: 'queue-core-functionality',
  isolateDatabase: true,
  verbose: false
})

describe('Queue Core Functionality', () => {
  let queueService: ReturnType<typeof createQueueService>
  let flowService: ReturnType<typeof createFlowService>
  let testContext: Awaited<ReturnType<typeof testEnv.setupTest>>

  // Test configuration
  const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
  const testTimeout = isCI ? 15000 : 10000

  beforeEach(async () => {
    // Setup test environment with automatic resource tracking
    testContext = await testEnv.setupTest()
    
    // Create queue service with test database and extended repository
    const baseQueueRepository = createBaseRepository(queues, testContext.testDb.db, undefined, 'Queue')
    const testQueueRepository = extendRepository(baseQueueRepository, {
      async getByProject(projectId: number) {
        return baseQueueRepository.findWhere(eq(queues.projectId, projectId))
      },
      async getActive(projectId?: number) {
        const conditions = [eq(queues.isActive, true)]
        if (projectId) {
          conditions.push(eq(queues.projectId, projectId))
        }
        return baseQueueRepository.findWhere(eq(queues.isActive, true))
      },
      // Add missing methods that the queue service expects
      async getItems(queueId: number) {
        return []
      },
      async getWithItems(id: number) {
        const queue = await baseQueueRepository.getById(id)
        if (!queue) return null
        return { ...queue, items: [] }
      },
      async addItem(data: any) {
        return { id: Date.now(), ...data, createdAt: Date.now(), updatedAt: Date.now() }
      },
      async getItemById(id: number) { return null },
      async removeItem(id: number) { return true },
      async updateItem(id: number, data: any) {
        return { id, ...data, createdAt: Date.now(), updatedAt: Date.now() }
      },
      async deleteItem(id: number) { return true },
      async getNextItem(queueId: number) { return null },
      async getQueueStats(queueId: number) {
        return { totalItems: 0, queuedItems: 0, processingItems: 0, completedItems: 0, failedItems: 0 }
      }
    })
    
    // Create services with test repositories
    queueService = createQueueService({ queueRepository: testQueueRepository })
    flowService = createFlowService()
    
    // Create default test project
    await testContext.createTestProject('core-tests')
  })

  afterEach(async () => {
    // Cleanup test environment and all tracked resources
    await testEnv.cleanupTest()
  })


  describe('Queue CRUD Operations', () => {
    test(
      'should create queue with defaults',
      async () => {
        const queueName = testContext.generateTestName('Default Queue')
        const queue = await queueService.create({
          projectId: testContext.testProjectId!,
          name: queueName,
          description: 'Testing defaults'
        })
        testContext.trackResource('queue', queue.id)

        expect(queue.id).toBeDefined()
        expect(queue.name).toBe(queueName)
        expect(queue.description).toBe('Testing defaults')
        expect(queue.status).toBe('active')
        expect(queue.maxParallelItems).toBe(1)
        expect(queue.createdAt).toBeDefined()
        expect(queue.updatedAt).toBeDefined()
      },
      testTimeout
    )

    test(
      'should update queue properties',
      async () => {
        const originalName = testContext.generateTestName('Original Name')
        const updatedName = testContext.generateTestName('Updated Name')
        const queue = await queueService.create({
          projectId: testContext.testProjectId!,
          name: originalName,
          description: 'Original'
        })
        testContext.trackResource('queue', queue.id)

        const updated = await queueService.update(queue.id, {
          name: updatedName,
          description: 'Updated description',
          maxParallelItems: 5
        })

        expect(updated.id).toBe(queue.id)
        expect(updated.name).toBe(updatedName)
        expect(updated.description).toBe('Updated description')
        expect(updated.maxParallelItems).toBe(5)
      },
      testTimeout
    )

    test(
      'should pause and resume queue',
      async () => {
        const queueName = testContext.generateTestName('Pausable Queue')
        const queue = await queueService.create({
          projectId: testContext.testProjectId!,
          name: queueName
        })
        testContext.trackResource('queue', queue.id)

        expect(queue.status).toBe('active')

        const paused = await queueService.setStatus(queue.id, false)
        expect(paused.status).toBe('paused')
        expect(paused.id).toBe(queue.id)

        const resumed = await queueService.setStatus(queue.id, true)
        expect(resumed.status).toBe('active')
        expect(resumed.id).toBe(queue.id)
      },
      testTimeout
    )

    test(
      'should delete queue',
      async () => {
        const queueName = testContext.generateTestName('Deletable Queue')
        const queue = await queueService.create({
          projectId: testContext.testProjectId!,
          name: queueName
        })
        // Don't track in testResources since we're testing deletion

        await queueService.delete!(queue.id)

        await expect(queueService.getById(queue.id)).rejects.toThrow(ApiError)
        await expect(queueService.getById(queue.id)).rejects.toThrow(/not found/)
      },
      testTimeout
    )
  })

  describe('Ticket Operations', () => {
    let testQueue: any

    beforeEach(async () => {
      testQueue = await testContext.createTestQueue()
    })

    test(
      'should enqueue single ticket',
      async () => {
        const ticket = await testContext.createTestTicket()

        const enqueued = await flowService.enqueueTicket(ticket.id, testQueue.id, 10)

        expect(enqueued.id).toBe(ticket.id)
        expect(enqueued.queueId).toBe(testQueue.id)
        expect(enqueued.queueStatus).toBe('queued')
        expect(enqueued.queuePriority).toBe(10)
        expect(enqueued.queuedAt).toBeDefined()
      },
      testTimeout
    )

    test(
      'should dequeue ticket',
      async () => {
        const ticket = await testContext.createTestTicket()

        await flowService.enqueueTicket(ticket.id, testQueue.id, 5)

        const dequeued = await flowService.dequeueTicket(ticket.id)

        expect(dequeued.id).toBe(ticket.id)
        expect(dequeued.queueId).toBeNull()
        expect(dequeued.queueStatus).toBeNull()
        expect(dequeued.queuePriority).toBeNull()
        expect(dequeued.queuedAt).toBeNull()
      },
      testTimeout
    )

    test(
      'should get ticket queue status',
      async () => {
        const ticketSuffix = randomBytes(4).toString('hex')
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Status Test ${suiteId}-${ticketSuffix}`,
          status: 'open',
          priority: 'low',
          overview: ''
        })
        testResources.push({ type: 'ticket', id: ticket.id })

        // Add delay in CI to ensure ticket creation is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        // Before enqueueing
        let fetchedTicket = await getTicketById(ticket.id)
        expect(fetchedTicket.queueStatus).toBeUndefined()

        // After enqueueing
        await enqueueTicket(ticket.id, testQueue.id, 3)

        // Add delay in CI to ensure enqueue is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        fetchedTicket = await getTicketById(ticket.id)
        expect(fetchedTicket.queueStatus).toBe('queued')
      },
      testTimeout
    )

    test(
      'should complete ticket in queue',
      async () => {
        const ticketSuffix = randomBytes(4).toString('hex')
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Complete Test ${suiteId}-${ticketSuffix}`,
          status: 'in_progress',
          priority: 'high',
          overview: ''
        })
        testResources.push({ type: 'ticket', id: ticket.id })

        await enqueueTicket(ticket.id, testQueue.id, 10)

        // Add delay in CI to ensure enqueue is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        // Mark as in_progress (simulating processing)
        await ticketStorage.updateTicket(ticket.id, { queueStatus: 'in_progress' })

        // Add delay in CI to ensure update is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        // Complete the ticket
        await completeQueueItem('ticket', ticket.id)

        // Add delay in CI to ensure completion is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        const completed = await getTicketById(ticket.id)
        expect(completed.queueStatus).toBe('completed')
      },
      testTimeout
    )
  })

  describe('Task Operations', () => {
    let testQueue: any
    let testTicket: any

    beforeEach(async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      const ticketSuffix = randomBytes(4).toString('hex')

      testQueue = await createQueue({
        projectId: testProjectId,
        name: `Task Queue ${suiteId}-${queueSuffix}`
      })
      testResources.push({ type: 'queue', id: testQueue.id })

      testTicket = await createTicket({
        projectId: testProjectId,
        title: `Parent Ticket ${suiteId}-${ticketSuffix}`,
        status: 'open',
        priority: 'normal',
        overview: ''
      })
      testResources.push({ type: 'ticket', id: testTicket.id })

      // Add delay in CI to ensure both resources are created
      if (isCI) {
        await new Promise((resolve) => setTimeout(resolve, asyncWaitTime * 2))
      }
    })

    test(
      'should enqueue task with ticket',
      async () => {
        const taskSuffix = randomBytes(4).toString('hex')
        const task = await createTask(testTicket.id, {
          content: `Test Task ${suiteId}-${taskSuffix}`,
          description: 'A test task'
        })
        testResources.push({ type: 'task', id: task.id })

        // Add delay in CI to ensure task creation is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        const enqueued = await enqueueTask(testTicket.id, task.id, testQueue.id, 7)

        expect(enqueued.id).toBe(task.id)
        expect(enqueued.queueId).toBe(testQueue.id)
        expect(enqueued.queueStatus).toBe('queued')
        expect(enqueued.queuePriority).toBe(7)
      },
      testTimeout
    )

    test(
      'should process task from queue',
      async () => {
        const taskSuffix = randomBytes(4).toString('hex')
        const task = await createTask(testTicket.id, {
          content: `Process Task ${suiteId}-${taskSuffix}`,
          description: 'Task to process'
        })
        testResources.push({ type: 'task', id: task.id })

        await enqueueTask(testTicket.id, task.id, testQueue.id, 5)

        // Add delay in CI to ensure enqueue is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        // Get task from queue (simulating agent processing)
        const agentId = `test-agent-${suiteId}-${randomBytes(2).toString('hex')}`
        const result = await getNextTaskFromQueue(testQueue.id, agentId)

        expect(result.type).toBe('task')
        expect(result.item).toBeDefined()
        expect(result.item?.id).toBe(task.id)
        expect((result.item as any)?.queueStatus).toBe('in_progress')
      },
      testTimeout
    )

    test(
      'should complete task',
      async () => {
        const taskSuffix = randomBytes(4).toString('hex')
        const task = await createTask(testTicket.id, {
          content: `Complete Task ${suiteId}-${taskSuffix}`,
          description: 'Task to complete'
        })
        testResources.push({ type: 'task', id: task.id })

        await enqueueTask(testTicket.id, task.id, testQueue.id, 8)

        // Add delay in CI to ensure enqueue is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        // Mark as in_progress via queue
        const agentId = `test-agent-${suiteId}-${randomBytes(2).toString('hex')}`
        await getNextTaskFromQueue(testQueue.id, agentId)

        // Add delay in CI to ensure status update is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        // Complete the task (tasks require ticketId)
        await completeQueueItem('task', task.id, testTicket.id)

        // Add delay in CI to ensure completion is committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
        }

        const tasks = await getTasks(testTicket.id)
        const completed = tasks.find((t) => t.id === task.id)

        expect(completed?.queueStatus).toBe('completed')
        expect(completed?.done).toBe(true)
      },
      testTimeout
    )
  })

  describe('Basic Statistics', () => {
    let testQueue: any

    beforeEach(async () => {
      const queueSuffix = randomBytes(4).toString('hex')
      testQueue = await createQueue({
        projectId: testProjectId,
        name: `Stats Queue ${suiteId}-${queueSuffix}`
      })
      testResources.push({ type: 'queue', id: testQueue.id })

      // Add delay in CI to ensure queue creation is committed
      if (isCI) {
        await new Promise((resolve) => setTimeout(resolve, asyncWaitTime))
      }
    })

    test(
      'should get queue item counts',
      async () => {
        const ticketIds: number[] = []

        // Create and enqueue 3 tickets
        for (let i = 0; i < 3; i++) {
          const ticketSuffix = randomBytes(4).toString('hex')
          const ticket = await createTicket({
            projectId: testProjectId,
            title: `Ticket ${i + 1} ${suiteId}-${ticketSuffix}`,
            status: 'open',
            priority: 'normal',
            overview: ''
          })
          ticketIds.push(ticket.id)
          testResources.push({ type: 'ticket', id: ticket.id })

          await enqueueTicket(ticket.id, testQueue.id, 5)

          // Add small delay between operations in CI
          if (isCI) {
            await new Promise((resolve) => setTimeout(resolve, asyncWaitTime / 2))
          }
        }

        // Add delay in CI to ensure all operations are committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime * 2))
        }

        const stats = await getQueueStats(testQueue.id)

        expect(stats.totalItems).toBe(3)
        expect(stats.queuedItems).toBe(3)
        expect(stats.inProgressItems).toBe(0)
        expect(stats.completedItems).toBe(0)
        expect(stats.ticketCount).toBe(3)
        expect(stats.taskCount).toBe(0)
      },
      testTimeout
    )

    test(
      'should get queue status breakdown',
      async () => {
        const ticketSuffix1 = randomBytes(4).toString('hex')
        const ticketSuffix2 = randomBytes(4).toString('hex')
        const ticketSuffix3 = randomBytes(4).toString('hex')

        // Create tickets with different statuses
        const ticket1 = await createTicket({
          projectId: testProjectId,
          title: `Queued ${suiteId}-${ticketSuffix1}`,
          status: 'open',
          priority: 'high',
          overview: ''
        })
        testResources.push({ type: 'ticket', id: ticket1.id })

        const ticket2 = await createTicket({
          projectId: testProjectId,
          title: `Processing ${suiteId}-${ticketSuffix2}`,
          status: 'in_progress',
          priority: 'normal',
          overview: ''
        })
        testResources.push({ type: 'ticket', id: ticket2.id })

        const ticket3 = await createTicket({
          projectId: testProjectId,
          title: `Done ${suiteId}-${ticketSuffix3}`,
          status: 'closed',
          priority: 'low',
          overview: ''
        })
        testResources.push({ type: 'ticket', id: ticket3.id })

        // Enqueue all
        await enqueueTicket(ticket1.id, testQueue.id, 10)
        await enqueueTicket(ticket2.id, testQueue.id, 5)
        await enqueueTicket(ticket3.id, testQueue.id, 1)

        // Add delay in CI to ensure all enqueue operations are committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime * 2))
        }

        // Update statuses
        await ticketStorage.updateTicket(ticket2.id, { queueStatus: 'in_progress' })
        await ticketStorage.updateTicket(ticket3.id, { queueStatus: 'completed' })

        // Add delay in CI to ensure all status updates are committed
        if (isCI) {
          await new Promise((resolve) => setTimeout(resolve, asyncWaitTime * 2))
        }

        const stats = await getQueueStats(testQueue.id)

        expect(stats.queuedItems).toBe(1)
        expect(stats.inProgressItems).toBe(1)
        expect(stats.completedItems).toBe(1)
        expect(stats.failedItems).toBe(0)
      },
      testTimeout
    )
  })
})
