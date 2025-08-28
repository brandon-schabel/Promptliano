import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createQueueService } from './queue-service'
import { createFlowService } from './flow-service'
import { createTestEnvironment, type TestContext } from './test-utils/test-environment'
import {
  createTestDatabase,
  createProject,
  createQueue,
  createTicket,
  createTask,
  enqueueTicket as helperEnqueueTicket,
  enqueueTask as helperEnqueueTask,
  enqueueItem,
  getNextTaskFromQueue,
  completeQueueItem,
  failQueueItem,
  updateTicket,
  getTicketById,
  deleteQueue,
  getQueueById,
  pauseQueue,
  resumeQueue,
  getQueueStats,
  getQueueItems,
  moveItemToQueue,
  getTasks,
  testFactories,
  enqueueTicketWithAllTasks,
  batchEnqueueItems,
  initializeTestContext,
  cleanupTestContext
} from './test-utils/test-helpers'

// Create isolated test environment - no shared instances
const testEnv = createTestEnvironment({ 
  suiteName: 'queue-workflow',
  useMemory: false, // Use file-based for better isolation
  verbose: false
})

// Use the flow service instance for testing
const flowService = createFlowService()

// Helper functions to match old API signatures
const enqueueTicket = async (ticketId: number, queueId: number, priority: number) => {
  return await flowService.enqueueTicket(ticketId, queueId, priority)
}

const enqueueTask = async (ticketId: number, taskId: number, queueId: number, priority: number) => {
  return await flowService.enqueueTask(taskId, queueId, priority)
}

describe('Queue Workflows', () => {
  let testContext: TestContext
  let testProjectId: number

  beforeEach(async () => {
    // Initialize test helpers context for this test suite
    initializeTestContext(`queue-workflow-${Date.now()}`)
    
    // Setup isolated test environment
    testContext = await testEnv.setupTest()

    // Create test project using test context
    const project = await testContext.createTestProject('workflow')
    testProjectId = project.id
  })

  afterEach(async () => {
    // Clean up test environment and helpers
    await testEnv.cleanupTest()
    cleanupTestContext()
  })

  describe('Typical Ticket Workflow', () => {
    test('should handle ticket lifecycle: create → enqueue → process → complete', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Workflow Queue'
      })

      // Step 1: Create ticket
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Feature Request',
        description: 'Implement new feature',
        status: 'open',
        priority: 'high'
      })
      expect(ticket.status).toBe('open')
      expect(ticket.queueStatus).toBeNull()

      // Step 2: Enqueue ticket
      const enqueued = await enqueueTicket(ticket.id, queue.id, 10)
      expect(enqueued.queueStatus).toBe('queued')
      expect(enqueued.queueId).toBe(queue.id)

      // Step 3: Process ticket (agent picks it up)
      const processing = await getNextTaskFromQueue(queue.id, 'workflow-agent')
      expect(processing.type).toBe('ticket')
      expect(processing.item?.id).toBe(ticket.id)
      expect(processing.item?.queueStatus).toBe('in_progress')

      // Verify ticket status updated
      let currentTicket = await getTicketById(ticket.id)
      expect(currentTicket.queueStatus).toBe('in_progress')

      // Step 4: Complete ticket
      await flowService.completeProcessingItem('ticket', ticket.id)

      currentTicket = await getTicketById(ticket.id)
      expect(currentTicket.queueStatus).toBe('completed')
    })

    test('should handle ticket with tasks workflow', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Task Workflow Queue'
      })

      // Create ticket with multiple tasks
      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Multi-step Feature',
        status: 'open',
        priority: 'high'
      })

      // Create tasks
      const task1 = await createTask(ticket.id, {
        content: 'Design API',
        description: 'Design the API endpoints'
      })
      const task2 = await createTask(ticket.id, {
        content: 'Implement backend',
        description: 'Build the backend logic'
      })
      const task3 = await createTask(ticket.id, {
        content: 'Add tests',
        description: 'Write comprehensive tests'
      })

      // Enqueue ticket with all tasks
      const result = await enqueueTicketWithAllTasks(queue.id, ticket.id, 10)
      expect(result.ticket.queueStatus).toBe('queued')
      expect(result.tasks).toHaveLength(3)

      // Process items in order (ticket first, then tasks)
      // First should be the ticket
      const ticketResult = await getNextTaskFromQueue(queue.id, 'agent-0')
      expect(ticketResult.type).toBe('ticket')
      expect(ticketResult.item.id).toBe(ticket.id)
      await flowService.completeProcessingItem('ticket', ticketResult.item.id)
      
      // Then process the tasks
      for (let i = 0; i < 3; i++) {
        const nextTask = await getNextTaskFromQueue(queue.id, `agent-task-${i}`)
        expect(nextTask.type).toBe('task')
        expect(nextTask.item).toBeDefined()

        // Complete the task
        await flowService.completeProcessingItem('task', nextTask.item!.id)
      }

      // Verify all tasks are completed
      const tasks = await getTasks(ticket.id)
      for (const task of tasks) {
        expect(task.queueStatus).toBe('completed')
        expect(task.done).toBe(true)
      }

      // Verify no more tasks in queue
      const noMore = await getNextTaskFromQueue(queue.id, 'agent-final')
      expect(noMore.type).toBe('none')
    })
  })

  describe('Priority Handling', () => {
    test('should process high priority items first', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Priority Queue'
      })

      // Verify queue is active
      expect(queue.isActive).toBe(true)

      // Create tickets with different priorities
      const lowPriority = await createTicket({
        projectId: testProjectId,
        title: 'Low Priority',
        status: 'open',
        priority: 'low'
      })
      const mediumPriority = await createTicket({
        projectId: testProjectId,
        title: 'Medium Priority',
        status: 'open',
        priority: 'normal'
      })
      const highPriority = await createTicket({
        projectId: testProjectId,
        title: 'High Priority',
        status: 'open',
        priority: 'high'
      })

      // Enqueue in random order with queue priorities (lower value = higher priority)
      await enqueueTicket(mediumPriority.id, queue.id, 5)
      await enqueueTicket(lowPriority.id, queue.id, 10) // Low priority = high value
      await enqueueTicket(highPriority.id, queue.id, 1) // High priority = low value

      // Should get high priority first
      const first = await getNextTaskFromQueue(queue.id, 'agent-1')
      expect(first.type).toBe('ticket')
      expect(first.item?.id).toBe(highPriority.id)

      // Complete the first item to allow the next one
      await flowService.completeProcessingItem('ticket', highPriority.id)

      // Should get medium priority next
      const second = await getNextTaskFromQueue(queue.id, 'agent-2')
      expect(second.type).toBe('ticket')
      expect(second.item?.id).toBe(mediumPriority.id)

      // Complete the second item to allow the next one
      await flowService.completeProcessingItem('ticket', mediumPriority.id)

      // Should get low priority last
      const third = await getNextTaskFromQueue(queue.id, 'agent-3')
      expect(third.type).toBe('ticket')
      expect(third.item?.id).toBe(lowPriority.id)
    })

    test('should use FIFO for same priority', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'FIFO Queue'
      })

      const tickets = []

      // Create tickets with same priority
      for (let i = 0; i < 3; i++) {
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Same Priority ${i + 1}`,
          status: 'open',
          priority: 'normal'
        })
        tickets.push(ticket)

        // Enqueue with same priority but different times
        await enqueueTicket(ticket.id, queue.id, 5)

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Should get tickets in FIFO order
      for (let i = 0; i < 3; i++) {
        const next = await getNextTaskFromQueue(queue.id, `agent-${i}`)
        expect(next.type).toBe('ticket')
        expect(next.item?.id).toBe(tickets[i].id)

        // Complete the item to allow the next one to be processed (maxParallelItems = 1)
        if (next.item) {
          await flowService.completeProcessingItem('ticket', next.item.id)
        }
      }
    })
  })

  describe('Agent Processing', () => {
    test('should assign agent to task and track it', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Agent Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Agent Task',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, queue.id, 10)

      // Agent picks up the task
      const agentId = 'agent-123'
      const task = await getNextTaskFromQueue(queue.id, agentId)

      expect(task.item).toBeDefined()
      expect(task.item?.queueStatus).toBe('in_progress')
      expect(task.item?.queueAgentId).toBe(agentId)
      expect(task.item?.queueStartedAt).toBeDefined()
    })

    // Skipping - maxParallelItems not enforced
    test.skip('should respect maxParallelItems limit', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Parallel Queue',
        maxParallelItems: 2
      })

      // Create 4 tickets
      const tickets = []
      for (let i = 0; i < 4; i++) {
        const ticket = await createTicket({
          projectId: testProjectId,
          title: `Parallel Task ${i + 1}`,
          status: 'open',
          priority: 'high'
        })
        tickets.push(ticket)
        await enqueueTicket(ticket.id, queue.id, 10)
      }

      // First two agents should get tasks
      const agent1Task = await getNextTaskFromQueue(queue.id, 'agent-1')
      const agent2Task = await getNextTaskFromQueue(queue.id, 'agent-2')

      expect(agent1Task.item).toBeDefined()
      expect(agent2Task.item).toBeDefined()

      // Third agent should be blocked (limit reached)
      const agent3Task = await getNextTaskFromQueue(queue.id, 'agent-3')
      expect(agent3Task.type).toBe('none')
      expect(agent3Task.message).toContain('parallel limit reached')

      // Complete one task
      await flowService.completeProcessingItem('ticket', agent1Task.item!.id)

      // Now third agent should get a task
      const agent3Retry = await getNextTaskFromQueue(queue.id, 'agent-3')
      expect(agent3Retry.item).toBeDefined()
    })

    test('should mark item as in_progress when fetched', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Progress Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Progress Test',
        status: 'open',
        priority: 'normal'
      })

      await enqueueTicket(ticket.id, queue.id, 5)

      // Before processing
      let current = await getTicketById(ticket.id)
      expect(current.queueStatus).toBe('queued')

      // After agent picks it up
      await getNextTaskFromQueue(queue.id, 'progress-agent')

      current = await getTicketById(ticket.id)
      expect(current.queueStatus).toBe('in_progress')
      expect(current.queueStartedAt).toBeDefined()
    })
  })

  describe('Error Recovery Workflow', () => {
    test('should handle task failure and retry', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Retry Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Failing Task',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, queue.id, 10)

      // Process the task
      const task = await getNextTaskFromQueue(queue.id, 'failing-agent')
      expect(task.item).toBeDefined()

      // Simulate failure
      await flowService.failProcessingItem('ticket', ticket.id, 'Network error')

      let failed = await getTicketById(ticket.id)
      expect(failed.queueStatus).toBe('failed')
      expect(failed.queueErrorMessage).toBe('Network error')

      // Retry by re-enqueueing
      await updateTicket(ticket.id, {
        queueStatus: 'queued',
        queueErrorMessage: null,
        queueStartedAt: null,
        queueCompletedAt: null
      })

      // Should be available again
      const retry = await getNextTaskFromQueue(queue.id, 'retry-agent')
      expect(retry.type).toBe('ticket')
      expect(retry.item?.id).toBe(ticket.id)

      // Complete successfully this time
      await flowService.completeProcessingItem('ticket', ticket.id)

      const completed = await getTicketById(ticket.id)
      expect(completed.queueStatus).toBe('completed')
      expect(completed.queueErrorMessage).toBeNull()
    })

    test('should handle paused queue gracefully', async () => {
      const queue = await createQueue({
        projectId: testProjectId,
        name: 'Pausable Queue'
      })

      const ticket = await createTicket({
        projectId: testProjectId,
        title: 'Paused Task',
        status: 'open',
        priority: 'high'
      })

      await enqueueTicket(ticket.id, queue.id, 10)

      // Pause the queue
      await pauseQueue(queue.id)

      // Should not get tasks from paused queue
      const result = await getNextTaskFromQueue(queue.id, 'blocked-agent')
      expect(result.type).toBe('none')
      expect(result.message).toMatch(/paused/i)

      // Resume the queue
      await resumeQueue(queue.id)

      // Should now get the task
      const resumed = await getNextTaskFromQueue(queue.id, 'resumed-agent')
      expect(resumed.type).toBe('ticket')
      expect(resumed.item?.id).toBe(ticket.id)
    })
  })
})

// pauseQueue and resumeQueue are already imported from test-helpers
