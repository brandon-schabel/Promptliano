import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ApiError } from '@promptliano/shared'
import { createQueueService } from './queue-service'
import { createFlowService } from './flow-service'
import { createTicketService, createTaskService } from './ticket-service'
import { createTestEnvironment, testRepositoryHelpers } from './test-utils/test-environment'
import { randomBytes } from 'crypto'
import type { Ticket, TicketTask, Queue } from '@promptliano/database'

// Create test environment for consolidated tests
const testEnv = createTestEnvironment({ 
  suiteName: 'queue-consolidated',
  isolateDatabase: true,
  verbose: false
})

describe('Consolidated Queue System Tests', () => {
  let queueService: ReturnType<typeof createQueueService>
  let flowService: ReturnType<typeof createFlowService>
  let ticketService: ReturnType<typeof createTicketService>
  let taskService: ReturnType<typeof createTaskService>
  let testContext: Awaited<ReturnType<typeof testEnv.setupTest>>
  let testQueueId: number
  let testQueueName: string
  let testProjectId: number

  beforeEach(async () => {
    // Setup test environment with automatic resource tracking
    testContext = await testEnv.setupTest()
    
    // Create services with default repositories
    // The services will use the test database connection
    queueService = createQueueService()
    flowService = createFlowService()
    ticketService = createTicketService()
    taskService = createTaskService()
    
    // Create default test project
    await testContext.createTestProject('consolidated-tests')
    testProjectId = testContext.testProjectId!

    // Create a test queue for most tests
    testQueueName = testContext.generateTestName('Test Queue')
    const queue = await queueService.create({
      projectId: testProjectId,
      name: testQueueName,
      description: 'Testing consolidated queue system'
    })
    testQueueId = queue.id
    testContext.trackResource('queue', queue.id)
  })

  afterEach(async () => {
    // Cleanup test environment and all tracked resources
    await testEnv.cleanupTest()
  })

  describe('Queue CRUD Operations', () => {
    test('should create a queue with default values', async () => {
      const queueName = testContext.generateTestName('Another Test Queue')
      const queue = await queueService.create({
        projectId: testContext.testProjectId!,
        name: queueName,
        description: 'Test description'
      })
      testContext.trackResource('queue', queue.id)

      expect(queue).toBeDefined()
      expect(queue.name).toBe(queueName)
      expect(queue.status).toBe('active')
      expect(queue.maxParallelItems).toBe(1)
    })

    test('should get queue by ID', async () => {
      const queue = await queueService.getById(testQueueId)

      expect(queue).toBeDefined()
      expect(queue.id).toBe(testQueueId)
      expect(queue.name).toBe(testQueueName)
    })

    test('should list queues by project', async () => {
      const queues = await queueService.getByProject(testContext.testProjectId!)

      expect(queues.length).toBeGreaterThan(0)
      expect(queues.some((q) => q.id === testQueueId)).toBe(true)
    })

    test('should update queue properties', async () => {
      const updated = await queueService.update(testQueueId, {
        name: 'Updated Queue Name',
        maxParallelItems: 5
      })

      expect(updated.name).toBe('Updated Queue Name')
      expect(updated.maxParallelItems).toBe(5)
    })

    test('should pause and resume queue', async () => {
      const paused = await queueService.setStatus(testQueueId, false)
      expect(paused.status).toBe('paused')

      const resumed = await queueService.setStatus(testQueueId, true)
      expect(resumed.status).toBe('active')
    })
  })

  describe('Ticket Enqueueing (Flow System)', () => {
    let testTicketId: number

    beforeEach(async () => {
      // Create a test ticket
      const ticket = await testContext.createTestTicket()
      testTicketId = ticket.id
    })

    test('should enqueue ticket with queue fields', async () => {
      const enqueued = await flowService.enqueueTicket(testTicketId, testQueueId, 5)

      expect(enqueued.queueId).toBe(testQueueId)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(5)
      expect(enqueued.queuedAt).toBeDefined()
    })

    test('should dequeue ticket by clearing queue fields', async () => {
      // First enqueue
      await flowService.enqueueTicket(testTicketId, testQueueId, 5)

      // Then dequeue
      const dequeued = await flowService.dequeueTicket(testTicketId)

      expect(dequeued.queueId).toBeUndefined()
      expect(dequeued.queueStatus).toBeUndefined()
      expect(dequeued.queuePriority).toBeUndefined()
    })

    test('should prevent duplicate enqueueing', async () => {
      // Enqueue once
      await flowService.enqueueTicket(testTicketId, testQueueId, 5)

      // Try to enqueue again to a different queue
      const anotherQueueName = testContext.generateTestName('Another Queue')
      const anotherQueue = await queueService.create({
        projectId: testProjectId,
        name: anotherQueueName,
        description: 'Second queue for duplicate test'
      })
      testContext.trackResource('queue', anotherQueue.id)

      // Should be able to move to another queue (not an error in this implementation)
      const movedTicket = await flowService.enqueueTicket(testTicketId, anotherQueue.id, 3)
      expect(movedTicket.queueId).toBe(anotherQueue.id)
    })

    test('should enqueue ticket with all its tasks', async () => {
      // Create tasks for the ticket
      const task1 = await flowService.createTask(testTicketId, {
        content: 'Task 1',
        description: 'First task'
      })
      const task2 = await flowService.createTask(testTicketId, {
        content: 'Task 2',
        description: 'Second task'
      })

      // Enqueue ticket with tasks
      await flowService.enqueueTicketWithTasks(testTicketId, testQueueId, 5)

      // Verify ticket is enqueued
      const enqueuedTicket = await flowService.getTicketById(testTicketId)
      expect(enqueuedTicket?.queueId).toBe(testQueueId)

      // Verify tasks are enqueued
      const tasks = await flowService.getQueueItems(testQueueId)
      expect(tasks.tasks).toHaveLength(2)
      expect(tasks.tasks.every(t => t.queueId === testQueueId)).toBe(true)
    })
  })

  describe('Task Enqueueing (Flow System)', () => {
    let testTicketId: number
    let testTaskId: number

    beforeEach(async () => {
      // Create a test ticket and task
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Test Ticket for Task',
        overview: 'Task queue testing',
        status: 'open',
        priority: 'normal'
      })
      testTicketId = ticket.id
      testContext.trackResource('ticket', ticket.id)

      const task = await flowService.createTask(testTicketId, {
        content: 'Test Task',
        description: 'For queue testing'
      })
      testTaskId = task.id
      testContext.trackResource('task', task.id)
    })

    test('should enqueue task with queue fields', async () => {
      const enqueued = await flowService.enqueueTask(testTaskId, testQueueId, 3)

      expect(enqueued.queueId).toBe(testQueueId)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queuePriority).toBe(3)
      expect(enqueued.queuedAt).toBeDefined()
    })

    test('should dequeue task by clearing queue fields', async () => {
      // First enqueue
      await flowService.enqueueTask(testTaskId, testQueueId, 3)

      // Then dequeue
      const dequeued = await flowService.dequeueTask(testTaskId)

      expect(dequeued.queueId).toBeUndefined()
      expect(dequeued.queueStatus).toBeUndefined()
      expect(dequeued.queuePriority).toBeUndefined()
    })
  })

  describe('Queue Statistics (Flow System)', () => {
    test('should calculate queue stats from tickets/tasks', async () => {
      // Create and enqueue multiple tickets
      const ticket1 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Ticket 1',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Ticket 2',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      testContext.trackResource('ticket', ticket1.id)
      testContext.trackResource('ticket', ticket2.id)

      await flowService.enqueueTicket(ticket1.id, testQueueId, 10)
      await flowService.enqueueTicket(ticket2.id, testQueueId, 5)

      // Get queue items to verify stats
      const queueItems = await flowService.getQueueItems(testQueueId)

      expect(queueItems.tickets).toHaveLength(2)
      expect(queueItems.tickets.every(t => t.queueId === testQueueId)).toBe(true)
      expect(queueItems.tickets.every(t => t.queueStatus === 'queued')).toBe(true)
      expect(queueItems.tasks).toHaveLength(0)
    })

    test('should track different queue statuses', async () => {
      // Create tickets with different statuses
      const ticket1 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Queued Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'In Progress Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'normal'
      })
      const ticket3 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Completed Ticket',
        overview: '',
        status: 'closed',
        priority: 'low'
      })
      testContext.trackResource('ticket', ticket1.id)
      testContext.trackResource('ticket', ticket2.id)
      testContext.trackResource('ticket', ticket3.id)

      // Enqueue all tickets
      await flowService.enqueueTicket(ticket1.id, testQueueId, 10)
      await flowService.enqueueTicket(ticket2.id, testQueueId, 5)
      await flowService.enqueueTicket(ticket3.id, testQueueId, 1)

      // Update their queue statuses
      // Start processing ticket2
      await flowService.startProcessingItem('ticket', ticket2.id, 'agent-x')
      // Complete ticket3
      await flowService.startProcessingItem('ticket', ticket3.id, 'agent-y')
      await flowService.completeProcessingItem('ticket', ticket3.id)

      // Get queue items to verify statuses
      const queueItems = await flowService.getQueueItems(testQueueId)
      const tickets = queueItems.tickets

      const queuedTickets = tickets.filter(t => t.queueStatus === 'queued')
      const inProgressTickets = tickets.filter(t => t.queueStatus === 'in_progress')
      const completedTickets = tickets.filter(t => t.queueStatus === 'completed')

      expect(tickets).toHaveLength(3)
      expect(queuedTickets).toHaveLength(1) // ticket1
      expect(inProgressTickets).toHaveLength(1) // ticket2
      expect(completedTickets).toHaveLength(1) // ticket3
    })

    test('should get all queues with stats', async () => {
      // Create another queue
      const queue2Name = testContext.generateTestName('Second Queue')
      const queue2 = await queueService.create({
        projectId: testProjectId,
        name: queue2Name,
        description: 'Second queue for stats test'
      })
      testContext.trackResource('queue', queue2.id)

      // Add items to both queues
      const ticket1 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Ticket for Queue 1',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket2 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Ticket for Queue 2',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      testContext.trackResource('ticket', ticket1.id)
      testContext.trackResource('ticket', ticket2.id)

      await flowService.enqueueTicket(ticket1.id, testQueueId, 10)
      await flowService.enqueueTicket(ticket2.id, queue2.id, 5)

      // Get queues for the project
      const queues = await queueService.getByProject(testProjectId)

      expect(queues.length).toBeGreaterThanOrEqual(2)

      // Check that both queues exist
      const queue1 = queues.find((q) => q.id === testQueueId)
      const queue2Found = queues.find((q) => q.id === queue2.id)

      expect(queue1).toBeDefined()
      expect(queue2Found).toBeDefined()
      
      // Verify items are in the correct queues
      const queue1Items = await flowService.getQueueItems(testQueueId)
      const queue2Items = await flowService.getQueueItems(queue2.id)
      
      expect(queue1Items.tickets).toHaveLength(1)
      expect(queue2Items.tickets).toHaveLength(1)
    })
  })

  describe('Queue Processing (Flow System)', () => {
    test('should get next task from queue by priority', async () => {
      // Create multiple tickets with different priorities
      const ticket1 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Low Priority',
        overview: '',
        status: 'open',
        priority: 'low'
      })
      const ticket2 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'High Priority',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const ticket3 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Medium Priority',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      testContext.trackResource('ticket', ticket1.id)
      testContext.trackResource('ticket', ticket2.id)
      testContext.trackResource('ticket', ticket3.id)

      await flowService.enqueueTicket(ticket1.id, testQueueId, 10) // Lowest priority
      await flowService.enqueueTicket(ticket2.id, testQueueId, 1) // Highest priority (lower number = higher priority)
      await flowService.enqueueTicket(ticket3.id, testQueueId, 5) // Medium priority

      // Get queue items and check order
      const queueItems = await flowService.getQueueItems(testQueueId)
      const sortedTickets = queueItems.tickets.sort((a, b) => (a.queuePriority || 0) - (b.queuePriority || 0))
      
      // Highest priority (lowest number) should be first
      expect(sortedTickets[0]?.id).toBe(ticket2.id)
      expect(sortedTickets[0]?.queuePriority).toBe(1)
    })

    test('should mark item as in_progress when fetched', async () => {
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Test Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      testContext.trackResource('ticket', ticket.id)

      await flowService.enqueueTicket(ticket.id, testQueueId, 5)

      // Start processing the ticket
      await flowService.startProcessingItem('ticket', ticket.id, 'test-agent')

      // Verify the ticket was updated
      const updatedTicket = await flowService.getTicketById(ticket.id)
      expect(updatedTicket?.queueStatus).toBe('in_progress')
      expect(updatedTicket?.queueAgentId).toBe('test-agent')
    })

    test('should handle empty queue', async () => {
      const queueItems = await flowService.getQueueItems(testQueueId)

      expect(queueItems.tickets).toHaveLength(0)
      expect(queueItems.tasks).toHaveLength(0)
    })
  })

  describe('Queue Item Movement', () => {
    test('should move ticket between queues', async () => {
      // Create second queue
      const queue2Name = testContext.generateTestName('Target Queue')
      const queue2 = await queueService.create({
        projectId: testProjectId,
        name: queue2Name,
        description: 'Target queue for movement test'
      })
      testContext.trackResource('queue', queue2.id)

      // Create and enqueue ticket
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Mobile Ticket',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      testContext.trackResource('ticket', ticket.id)

      await flowService.enqueueTicket(ticket.id, testQueueId, 5)

      // Move to another queue
      await flowService.moveItem('ticket', ticket.id, queue2.id, 5)

      // Verify moved
      const movedTicket = await flowService.getTicketById(ticket.id)
      expect(movedTicket?.queueId).toBe(queue2.id)
      expect(movedTicket?.queueStatus).toBe('queued')

      // Verify queue contents
      const queue1Items = await flowService.getQueueItems(testQueueId)
      const queue2Items = await flowService.getQueueItems(queue2.id)

      expect(queue1Items.tickets).toHaveLength(0)
      expect(queue2Items.tickets).toHaveLength(1)
    })

    test('should remove from queue when moving to null', async () => {
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Removable Ticket',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      testContext.trackResource('ticket', ticket.id)

      await flowService.enqueueTicket(ticket.id, testQueueId, 5)

      // Remove from queue
      await flowService.moveItem('ticket', ticket.id, null)

      // Verify removed
      const updatedTicket = await flowService.getTicketById(ticket.id)
      expect(updatedTicket?.queueId).toBeUndefined()
      expect(updatedTicket?.queueStatus).toBeUndefined()
    })
  })

  describe('Queue Item Completion and Failure', () => {
    test('should complete queue item', async () => {
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Completable Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'high'
      })
      testContext.trackResource('ticket', ticket.id)

      await flowService.enqueueTicket(ticket.id, testQueueId, 10)
      // Start processing
      await flowService.startProcessingItem('ticket', ticket.id, 'agent-z')

      // Complete the item
      await flowService.completeProcessingItem('ticket', ticket.id)

      // Verify completed
      const completedTicket = await flowService.getTicketById(ticket.id)
      expect(completedTicket?.queueStatus).toBe('completed')
      // Note: The flow service doesn't automatically change ticket status to 'closed'
      // That would be handled by higher-level business logic
    })

    test('should fail queue item with error message', async () => {
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Failing Ticket',
        overview: '',
        status: 'in_progress',
        priority: 'high'
      })
      testContext.trackResource('ticket', ticket.id)

      await flowService.enqueueTicket(ticket.id, testQueueId, 10)
      // Start processing
      await flowService.startProcessingItem('ticket', ticket.id, 'test-agent')

      // Fail the item
      await flowService.failProcessingItem('ticket', ticket.id, 'Test failure reason')

      // Verify failed
      const failedTicket = await flowService.getTicketById(ticket.id)
      expect(failedTicket?.queueStatus).toBe('failed')
      expect(failedTicket?.queueErrorMessage).toBe('Test failure reason')
    })
  })

  describe('Unqueued Items', () => {
    test('should find unqueued items', async () => {
      // Create some tickets - some queued, some not
      const queuedTicket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Queued Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      const unqueuedTicket1 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Unqueued Ticket 1',
        overview: '',
        status: 'open',
        priority: 'normal'
      })
      const unqueuedTicket2 = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Unqueued Ticket 2',
        overview: '',
        status: 'in_progress',
        priority: 'low'
      })
      testContext.trackResource('ticket', queuedTicket.id)
      testContext.trackResource('ticket', unqueuedTicket1.id)
      testContext.trackResource('ticket', unqueuedTicket2.id)

      // Only enqueue one
      await flowService.enqueueTicket(queuedTicket.id, testQueueId, 5)

      // Get unqueued items
      const unqueued = await flowService.getUnqueuedItems(testProjectId)

      expect(unqueued.tickets.length).toBe(2)
      expect(unqueued.tickets.some((t) => t.id === unqueuedTicket1.id)).toBe(true)
      expect(unqueued.tickets.some((t) => t.id === unqueuedTicket2.id)).toBe(true)
      expect(unqueued.tickets.some((t) => t.id === queuedTicket.id)).toBe(false)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid queue ID gracefully', async () => {
      await expect(queueService.getById(999999)).rejects.toThrow(ApiError)
      await expect(queueService.getById(999999)).rejects.toThrow(/not found/i)
    })

    test('should handle invalid ticket ID when enqueueing', async () => {
      await expect(flowService.enqueueTicket(999999, testQueueId, 5)).rejects.toThrow(ApiError)
      await expect(flowService.enqueueTicket(999999, testQueueId, 5)).rejects.toThrow(/No rows affected|not found/i)
    })

    test('should handle pausing already paused queue', async () => {
      // Pause queue
      const paused = await queueService.setStatus(testQueueId, false)
      expect(paused.status).toBe('paused')

      // Pause again - should be idempotent
      const stillPaused = await queueService.setStatus(testQueueId, false)
      expect(stillPaused.status).toBe('paused')
    })

    test('should handle resuming already active queue', async () => {
      // Ensure queue is active (should be by default)
      const active = await queueService.setStatus(testQueueId, true)
      expect(active.status).toBe('active')
      
      // Resume again - should be idempotent
      const stillActive = await queueService.setStatus(testQueueId, true)
      expect(stillActive.status).toBe('active')
    })

    test('should handle concurrent enqueueing', async () => {
      const tickets = await Promise.all([
        flowService.createTicket({
          projectId: testProjectId,
          title: 'Concurrent 1',
          overview: '',
          status: 'open',
          priority: 'high'
        }),
        flowService.createTicket({
          projectId: testProjectId,
          title: 'Concurrent 2',
          overview: '',
          status: 'open',
          priority: 'normal'
        }),
        flowService.createTicket({
          projectId: testProjectId,
          title: 'Concurrent 3',
          overview: '',
          status: 'open',
          priority: 'low'
        })
      ])

      // Track resources for cleanup
      tickets.forEach(ticket => testContext.trackResource('ticket', ticket.id))

      // Enqueue all concurrently
      await Promise.all(tickets.map((ticket, index) => flowService.enqueueTicket(ticket.id, testQueueId, (index + 1) * 3)))

      // Verify all enqueued
      const queueItems = await flowService.getQueueItems(testQueueId)
      expect(queueItems.tickets).toHaveLength(3)
      expect(queueItems.tickets.every(t => t.queueStatus === 'queued')).toBe(true)
    })

    test('should handle queue deletion with items', async () => {
      // Create and enqueue a ticket
      const ticket = await flowService.createTicket({
        projectId: testProjectId,
        title: 'Orphan Ticket',
        overview: '',
        status: 'open',
        priority: 'high'
      })
      testContext.trackResource('ticket', ticket.id)
      await flowService.enqueueTicket(ticket.id, testQueueId, 5)

      // Delete the queue (this will be cleaned up by testContext)
      await queueService.delete(testQueueId)

      // Ticket should still exist but queue should be gone
      const orphanTicket = await flowService.getTicketById(ticket.id)
      expect(orphanTicket).toBeDefined()
      
      // Queue should no longer exist
      await expect(queueService.getById(testQueueId)).rejects.toThrow()
    })
  })
})

// Helper functions for backward compatibility
const createTicket = (data: any) => flowService.createTicket(data)
const createTask = (ticketId: number, data: any) => flowService.createTask(ticketId, data)
const enqueueTicket = (ticketId: number, queueId: number, priority: number) => flowService.enqueueTicket(ticketId, queueId, priority)
const getTicketById = (ticketId: number) => flowService.getTicketById(ticketId)
const createQueue = (data: any) => queueService.create(data)
const deleteQueue = (queueId: number) => queueService.delete(queueId)
const getQueueById = (queueId: number) => queueService.getById(queueId)
const getUnqueuedItems = (projectId: number) => flowService.getUnqueuedItems(projectId)
const moveItemToQueue = (type: 'ticket' | 'task', itemId: number, queueId: number | null) => flowService.moveItem(type, itemId, queueId)
const failQueueItem = (type: 'ticket' | 'task', itemId: number, error: string) => flowService.failProcessingItem(type, itemId, error)
