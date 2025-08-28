import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import { createQueueService } from './queue-service'
import { createFlowService } from './flow-service'
import { createTestEnvironment } from './test-utils/test-environment'
import { 
  queues, 
  tickets, 
  ticketTasks, 
  createBaseRepository, 
  extendRepository,
  queueRepository,
  ticketRepository,
  taskRepository 
} from '@promptliano/database'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { 
  getQueueStats, 
  getNextTaskFromQueue, 
  completeQueueItem,
  createTestDatabase 
} from './test-utils/test-helpers'

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
  let testQueueRepository: any
  let testTicketRepository: any
  let testTaskRepository: any

  // Test configuration
  const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
  const testTimeout = isCI ? 15000 : 10000

  beforeEach(async () => {
    // Setup test environment with automatic resource tracking
    testContext = await testEnv.setupTest()
    
    // Create base repositories first
    const baseQueueRepo = createBaseRepository(queues, testContext.testDb.db, undefined, 'Queue')
    const baseTicketRepo = createBaseRepository(tickets, testContext.testDb.db, undefined, 'Ticket')
    const baseTaskRepo = createBaseRepository(ticketTasks, testContext.testDb.db, undefined, 'TicketTask')
    
    // Create task repository first (no circular dependencies)
    testTaskRepository = extendRepository(baseTaskRepo, {
      async getByTicket(ticketId: number) {
        return baseTaskRepo.findWhere(eq(ticketTasks.ticketId, ticketId))
      },
      async addToQueue(taskId: number, queueId: number, priority: number = 5, position?: number) {
        const updateData = {
          queueId,
          queueStatus: 'queued' as const,
          queuePriority: priority,
          queuedAt: Date.now(),
          updatedAt: Date.now()
        }
        return baseTaskRepo.update(taskId, updateData)
      },
      async removeFromQueue(taskId: number) {
        const updateData = {
          queueId: null,
          queueStatus: null,
          queuePriority: null,
          queuedAt: null,
          updatedAt: Date.now()
        }
        return baseTaskRepo.update(taskId, updateData)
      }
    })
    
    // Create extended repositories with all required methods
    testQueueRepository = extendRepository(baseQueueRepo, {
      async getByProject(projectId: number) {
        return baseQueueRepo.findWhere(eq(queues.projectId, projectId))
      },
      async getActive(projectId?: number) {
        const conditions = [eq(queues.isActive, true)]
        if (projectId) {
          conditions.push(eq(queues.projectId, projectId))
        }
        return baseQueueRepo.findWhere(eq(queues.isActive, true))
      },
      async getItems(queueId: number) {
        // Simplified for testing - return empty array
        return []
      },
      async getWithItems(id: number) {
        const queue = await baseQueueRepo.getById(id)
        return queue ? { ...queue, items: [] } : null
      }
    })
    
    testTicketRepository = extendRepository(baseTicketRepo, {
      async getByProject(projectId: number) {
        return baseTicketRepo.findWhere(eq(tickets.projectId, projectId))
      },
      async getTasksByTicket(ticketId: number) {
        return baseTaskRepo.findWhere(eq(ticketTasks.ticketId, ticketId))
      },
      async addToQueue(ticketId: number, queueId: number, priority: number = 5, position?: number) {
        const updateData = {
          queueId,
          queueStatus: 'queued' as const,
          queuePriority: priority,
          queuedAt: Date.now(),
          updatedAt: Date.now()
        }
        return baseTicketRepo.update(ticketId, updateData)
      },
      async removeFromQueue(ticketId: number) {
        const updateData = {
          queueId: null,
          queueStatus: null,
          queuePriority: null,
          queuedAt: null,
          updatedAt: Date.now()
        }
        return baseTicketRepo.update(ticketId, updateData)
      },
      async createTask(data: any) {
        const taskData = {
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        return testTaskRepository.create(taskData)
      },
      async getTaskById(id: number) {
        return testTaskRepository.getById(id)
      },
      async updateTask(id: number, data: any) {
        return testTaskRepository.update(id, { ...data, updatedAt: Date.now() })
      }
    })
    
    // Create services with test database repositories
    queueService = createQueueService({
      queueRepository: testQueueRepository
    })
    flowService = createFlowService({
      ticketRepository: testTicketRepository,
      taskRepository: testTaskRepository,
      queueRepository: testQueueRepository
    })
    
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
        expect(dequeued.queueId).toBeUndefined()
        expect(dequeued.queueStatus).toBeUndefined()
        expect(dequeued.queuePriority).toBeUndefined()
        expect(dequeued.queuedAt).toBeUndefined()
      },
      testTimeout
    )

    test(
      'should get ticket queue status',
      async () => {
        const testQueue = await testContext.createTestQueue()
        const ticket = await testContext.createTestTicket()

        // Before enqueueing - should have no queue status
        let fetchedTicket = await flowService.getTicketById(ticket.id)
        expect(fetchedTicket.queueStatus).toBeUndefined()

        // After enqueueing
        await flowService.enqueueTicket(ticket.id, testQueue.id, 3)

        // Check the ticket has queue status
        fetchedTicket = await flowService.getTicketById(ticket.id)
        expect(fetchedTicket.queueStatus).toBe('queued')
      },
      testTimeout
    )

    test(
      'should complete ticket in queue',
      async () => {
        const testQueue = await testContext.createTestQueue()
        const ticket = await testContext.createTestTicket()

        // Enqueue the ticket
        await flowService.enqueueTicket(ticket.id, testQueue.id, 10)

        // Get the ticket to process (simulating agent pickup)
        const processingResult = await getNextTaskFromQueue(testQueue.id, 'test-agent')
        expect(processingResult.type).toBe('ticket')
        expect(processingResult.item?.id).toBe(ticket.id)

        // Complete the ticket
        await completeQueueItem(ticket.id, { success: true })

        const completed = await flowService.getTicketById(ticket.id)
        expect(completed.queueStatus).toBe('completed')
      },
      testTimeout
    )
  })

  describe('Task Operations', () => {
    let testQueue: any
    let testTicket: any

    beforeEach(async () => {
      // Create queue using test context to ensure proper database
      testQueue = await testContext.createTestQueue()
      testContext.trackResource('queue', testQueue.id)
      
      // Create ticket using test context to ensure proper database
      testTicket = await testContext.createTestTicket()
      testContext.trackResource('ticket', testTicket.id)
    })

    test(
      'should enqueue task with ticket',
      async () => {
        // Create a task for the ticket
        const task = await flowService.createTask(testTicket.id, {
          content: 'Test Task for Queue',
          description: 'A test task'
        })


        const enqueued = await flowService.enqueueTask(task.id, testQueue.id, 7)

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
        const task = await flowService.createTask(testTicket.id, {
          content: 'Process Task',
          description: 'Task to process'
        })

        await flowService.enqueueTask(task.id, testQueue.id, 5)

        // Get task from queue (simulating agent processing)
        const agentId = 'test-agent'
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
        const task = await flowService.createTask(testTicket.id, {
          content: 'Complete Task',
          description: 'Task to complete'
        })

        await flowService.enqueueTask(task.id, testQueue.id, 8)

        // Mark as in_progress via queue
        const agentId = 'test-agent'
        await getNextTaskFromQueue(testQueue.id, agentId)

        // Complete the task
        await completeQueueItem(task.id, { success: true })

        const tasks = await testTicketRepository.getTasksByTicket(testTicket.id)
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
      testQueue = await testContext.createTestQueue()
    })

    test(
      'should get queue item counts',
      async () => {
        // Create and enqueue 3 tickets
        for (let i = 0; i < 3; i++) {
          const ticket = await testContext.createTestTicket()
          await flowService.enqueueTicket(ticket.id, testQueue.id, 5)
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
        // Create tickets with different statuses
        const ticket1 = await testContext.createTestTicket()
        const ticket2 = await testContext.createTestTicket()
        const ticket3 = await testContext.createTestTicket()

        // Enqueue all
        await flowService.enqueueTicket(ticket1.id, testQueue.id, 10)
        await flowService.enqueueTicket(ticket2.id, testQueue.id, 5)
        await flowService.enqueueTicket(ticket3.id, testQueue.id, 1)

        // Simulate different queue statuses
        // Ticket2 gets picked up by agent (becomes in_progress)
        await getNextTaskFromQueue(testQueue.id, 'agent-1')
        
        // Ticket3 gets completed 
        await getNextTaskFromQueue(testQueue.id, 'agent-2')
        await completeQueueItem(ticket3.id, { success: true })

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
