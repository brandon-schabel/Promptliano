/**
 * Test Helpers - Enhanced for Test Isolation
 *
 * Provides comprehensive test helper functions with proper database isolation.
 * Each helper function now uses its own isolated database to prevent
 * "Missing parameter '1'" errors caused by concurrent access.
 *
 * BREAKING CHANGE: No longer uses global database - each operation is isolated
 */

import { randomBytes } from 'crypto'
import {
  createTestDatabase,
  type TestDatabase,
  type Queue,
  type Project,
  type Ticket,
  type TicketTask,
  type CreateProject,
  type CreateTicket,
  type CreateQueue,
  type CreateTask,
  projects,
  tickets,
  ticketTasks,
  queues,
  createBaseRepository
} from '@promptliano/database'
import { createQueueService } from '../queue-service'
import { createFlowService } from '../flow/core'

/**
 * Shared test database context - one per test suite for relationship consistency
 * This allows entities to reference each other while maintaining isolation between suites
 */
let sharedTestContext: {
  db: TestDatabase
  contextId: string
} | null = null

/**
 * Initialize a shared test context for a test suite
 * Call this in beforeEach or beforeAll to ensure isolation
 */
export async function initializeTestContext(suiteId?: string): Promise<TestDatabase> {
  const contextId = suiteId || `suite-${randomBytes(6).toString('hex')}`

  // Close previous context if it exists
  if (sharedTestContext) {
    try {
      sharedTestContext.db.close()
    } catch (error) {
      console.warn('Failed to close previous test context:', error)
    }
  }

  // Create new isolated context
  const db = await createTestDatabase({
    testId: `helpers-${contextId}`,
    verbose: false,
    seedData: false,
    useMemory: false // Use file-based for better isolation
  })

  sharedTestContext = { db, contextId }
  return db
}

/**
 * Get the current shared test database
 * Creates a new context if none exists (for backward compatibility)
 */
async function getSharedTestDb(): Promise<TestDatabase> {
  if (!sharedTestContext) {
    return await initializeTestContext()
  }
  return sharedTestContext.db
}

/**
 * Clean up the shared test context
 * Call this in afterEach or afterAll
 */
export function cleanupTestContext(): void {
  if (sharedTestContext) {
    try {
      sharedTestContext.db.close()
    } catch (error) {
      console.warn(`Failed to close test context ${sharedTestContext.contextId}:`, error)
    }
    sharedTestContext = null
  }
}

/**
 * Reset the shared test context without closing it
 * Useful for clearing data between tests in the same suite
 */
export async function resetTestContext(): Promise<void> {
  if (sharedTestContext) {
    await sharedTestContext.db.reset()
  }
}

/**
 * Create test database (backward compatibility export)
 */
export { createTestDatabase }

/**
 * Create a test project with realistic data
 * Uses shared test database context for relationship consistency
 */
export async function createProject(data?: Partial<CreateProject>): Promise<Project> {
  const db = await getSharedTestDb()
  const testId = randomBytes(4).toString('hex')

  // Create project repository with shared test database
  const projectRepo = createBaseRepository(projects, db.db)

  const projectData: CreateProject = {
    name: data?.name || `Test Project ${testId}`,
    path: data?.path || `/test/projects/${testId}`,
    description: data?.description || 'Test project created by test helpers',
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  return await projectRepo.create(projectData)
}

/**
 * Create a test ticket with realistic data
 */
export async function createTicket(data: Partial<CreateTicket> & { projectId: number }): Promise<Ticket> {
  const db = getSharedTestDb()
  const testId = randomBytes(4).toString('hex')

  // Create ticket repository with shared test database
  const ticketRepo = createBaseRepository(tickets, db.db)

  const ticketData: CreateTicket = {
    title: data.title || `Test Ticket ${testId}`,
    overview: data.overview || 'Test ticket created by test helpers',
    projectId: data.projectId,
    status: data.status || 'open',
    priority: data.priority || 'normal',
    suggestedFileIds: data.suggestedFileIds || [],
    suggestedAgentIds: data.suggestedAgentIds || [],
    suggestedPromptIds: data.suggestedPromptIds || [],
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  return await ticketRepo.create(ticketData)
}

/**
 * Create a test queue with realistic data
 */
export async function createQueue(data: Partial<CreateQueue> & { projectId: number }): Promise<Queue> {
  const db = getSharedTestDb()
  const testId = randomBytes(4).toString('hex')

  // Create queue repository with shared test database
  const queueRepo = createBaseRepository(queues, db.db)

  const queueData: CreateQueue = {
    name: data.name || `Test Queue ${testId}`,
    description: data.description || 'Test queue created by test helpers',
    projectId: data.projectId,
    maxParallelItems: data.maxParallelItems || 1,
    isActive: data.isActive !== undefined ? data.isActive : true,
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  return await queueRepo.create(queueData)
}

/**
 * Create a test task with realistic data
 */
export async function createTask(ticketId: number, data: Partial<CreateTask>): Promise<TicketTask> {
  const db = getSharedTestDb()
  const testId = randomBytes(4).toString('hex')

  // Create task repository with shared test database
  const taskRepo = createBaseRepository(ticketTasks, db.db)

  const taskData: CreateTask = {
    ticketId,
    content: data.content || `Test Task ${testId}`,
    description: data.description || 'Test task created by test helpers',
    done: data.done || false,
    status: data.status || 'pending',
    orderIndex: data.orderIndex || 0,
    estimatedHours: data.estimatedHours || null,
    dependencies: data.dependencies || [],
    tags: data.tags || [],
    agentId: data.agentId || null,
    suggestedFileIds: data.suggestedFileIds || [],
    suggestedPromptIds: data.suggestedPromptIds || [],
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  return await taskRepo.create(taskData)
}

/**
 * Get ticket by ID
 */
export async function getTicketById(id: number): Promise<Ticket> {
  const db = getSharedTestDb()
  const ticketRepo = createBaseRepository(tickets, db.db)

  const ticket = await ticketRepo.getById(id)
  if (!ticket) {
    throw new Error(`Ticket with ID ${id} not found`)
  }
  return ticket
}

/**
 * Update a ticket
 */
export async function updateTicket(id: number, data: Partial<Ticket>): Promise<Ticket> {
  const db = getSharedTestDb()
  const ticketRepo = createBaseRepository(tickets, db.db)

  return await ticketRepo.update(id, data)
}

/**
 * Delete a ticket
 */
export async function deleteTicket(id: number): Promise<void> {
  const db = getSharedTestDb()
  const ticketRepo = createBaseRepository(tickets, db.db)

  await ticketRepo.delete(id)
}

/**
 * Get tasks for a ticket
 */
export async function getTasks(ticketId: number): Promise<TicketTask[]> {
  const db = getSharedTestDb()
  const taskRepo = createBaseRepository(ticketTasks, db.db)

  // Use findWhere with proper Drizzle condition
  const { eq } = await import('drizzle-orm')
  return await (taskRepo as any).findWhere(eq(ticketTasks.ticketId, ticketId))
}

/**
 * Update a task
 */
export async function updateTask(ticketId: number, taskId: number, data: Partial<TicketTask>): Promise<TicketTask> {
  const db = getSharedTestDb()
  const taskRepo = createBaseRepository(ticketTasks, db.db)

  return await taskRepo.update(taskId, data)
}

/**
 * Get queue by ID
 */
export async function getQueueById(id: number): Promise<Queue> {
  const db = getSharedTestDb()
  const queueRepo = createBaseRepository(queues, db.db)

  const queue = await queueRepo.getById(id)
  if (!queue) {
    throw new Error(`Queue with ID ${id} not found`)
  }
  return queue
}

/**
 * Delete queue
 */
export async function deleteQueue(id: number): Promise<void> {
  const db = getSharedTestDb()
  const queueRepo = createBaseRepository(queues, db.db)

  await queueRepo.delete(id)
}

/**
 * Flow Service Operations - using actual flow service
 */
const flowService = createFlowService()

/**
 * Enqueue a ticket to a queue
 */
export async function enqueueTicket(ticketId: number, queueId: number, priority: number): Promise<Ticket> {
  return await flowService.enqueueTicket(ticketId, queueId, priority)
}

/**
 * Enqueue a task to a queue
 */
export async function enqueueTask(
  ticketId: number,
  taskId: number,
  queueId: number,
  priority: number
): Promise<TicketTask> {
  return await flowService.enqueueTask(taskId, queueId, priority)
}

/**
 * Enqueue an item to a queue (generic)
 */
export async function enqueueItem(
  queueId: number,
  item: {
    type: 'ticket' | 'task'
    referenceId: number
    title?: string
    priority: number
  }
): Promise<any> {
  if (item.type === 'ticket') {
    return await flowService.enqueueTicket(item.referenceId, queueId, item.priority)
  } else if (item.type === 'task') {
    // For tasks, we need to find the ticket ID
    const db = getSharedTestDb()
    const taskRepo = createBaseRepository(ticketTasks, db.db)
    const task = await taskRepo.getById(item.referenceId)
    if (!task) {
      throw new Error(`Task with ID ${item.referenceId} not found`)
    }
    return await flowService.enqueueTask(item.referenceId, queueId, item.priority)
  }
  throw new Error(`Unsupported item type: ${item.type}`)
}

/**
 * Dequeue a ticket from queue
 */
export async function dequeueTicket(ticketId: number): Promise<Ticket> {
  return await flowService.dequeueTicket(ticketId)
}

/**
 * Get next task from queue (simulates getting and starting to process an item)
 */
export async function getNextTaskFromQueue(
  queueId: number,
  agentId: string
): Promise<{
  type: 'ticket' | 'task' | 'none'
  item?: any
  message?: string
}> {
  try {
    const db = getSharedTestDb()
    const queueRepo = createBaseRepository(queues, db.db)

    // First check if queue is active
    const queue = await queueRepo.getById(queueId)
    if (!queue) {
      return { type: 'none', message: 'Queue not found' }
    }
    if (!queue.isActive) {
      return { type: 'none', message: 'Queue is paused' }
    }

    // Get items in the queue
    const { tickets, tasks } = await flowService.getQueueItems(queueId)

    // Find the highest priority item that's not already in progress
    const allItems = [
      ...tickets
        .filter((t) => t.queueStatus === 'queued')
        .map((t) => ({
          type: 'ticket' as const,
          item: t,
          priority: t.queuePriority || 5,
          queuedAt: t.queuedAt || 0
        })),
      ...tasks
        .filter((t) => t.queueStatus === 'queued')
        .map((t) => ({
          type: 'task' as const,
          item: t,
          priority: t.queuePriority || 5,
          queuedAt: t.queuedAt || 0
        }))
    ]

    if (allItems.length === 0) {
      return { type: 'none', message: 'No items available in queue' }
    }

    // Sort by priority (lower number = higher priority), then by queued time (FIFO for same priority)
    allItems.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.queuedAt - b.queuedAt
    })

    const nextItem = allItems[0]

    // Start processing the item
    await flowService.startProcessingItem(nextItem.type, nextItem.item.id, agentId)

    // Return the updated item
    if (nextItem.type === 'ticket') {
      const ticket = await flowService.getTicketById(nextItem.item.id)
      return { type: 'ticket', item: ticket }
    } else {
      // For task, we need to get it through the ticket's tasks
      const taskRepo = createBaseRepository(ticketTasks, db.db)
      const task = await taskRepo.getById(nextItem.item.id)
      return { type: 'task', item: task }
    }
  } catch (error) {
    console.error('Error getting next task from queue:', error)
    return { type: 'none', message: (error as Error).message }
  }
}

/**
 * Complete a queue item
 */
export async function completeQueueItem(itemId: number, result: { success: boolean }): Promise<void> {
  // Try to determine the item type by checking which entity exists with this ID
  const db = getSharedTestDb()
  const ticketRepo = createBaseRepository(tickets, db.db)
  const taskRepo = createBaseRepository(ticketTasks, db.db)

  try {
    // Check if it's a ticket
    const ticket = await ticketRepo.getById(itemId)
    if (ticket) {
      await flowService.completeProcessingItem('ticket', itemId)
      return
    }
  } catch (error) {
    // Ignore, try task next
  }

  try {
    // Check if it's a task
    const task = await taskRepo.getById(itemId)
    if (task) {
      await flowService.completeProcessingItem('task', itemId)
      return
    }
  } catch (error) {
    // Neither found
  }

  // Fallback: assume it's a ticket (backward compatibility)
  await flowService.completeProcessingItem('ticket', itemId)
}

/**
 * Fail a queue item
 */
export async function failQueueItem(itemId: number, result: { success: boolean; error: string }): Promise<void> {
  // Handle legacy signature for backward compatibility
  await flowService.failProcessingItem('ticket', itemId, result.error)
}

/**
 * Queue Service Operations - using actual queue service
 */
const queueService = createQueueService()

/**
 * Pause a queue
 */
export async function pauseQueue(queueId: number): Promise<Queue> {
  return await queueService.setStatus(queueId, false)
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueId: number): Promise<Queue> {
  return await queueService.setStatus(queueId, true)
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueId: number): Promise<{
  totalItems: number
  queuedItems: number
  inProgressItems: number
  completedItems: number
  failedItems: number
  ticketCount: number
  taskCount: number
}> {
  // Use flow service to get queue items and calculate stats
  const { tickets, tasks } = await flowService.getQueueItems(queueId)

  const ticketStats = {
    queued: tickets.filter((t) => t.queueStatus === 'queued').length,
    inProgress: tickets.filter((t) => t.queueStatus === 'in_progress').length,
    completed: tickets.filter((t) => t.queueStatus === 'completed').length,
    failed: tickets.filter((t) => t.queueStatus === 'failed').length,
    total: tickets.length
  }

  const taskStats = {
    queued: tasks.filter((t) => t.queueStatus === 'queued').length,
    inProgress: tasks.filter((t) => t.queueStatus === 'in_progress').length,
    completed: tasks.filter((t) => t.queueStatus === 'completed').length,
    failed: tasks.filter((t) => t.queueStatus === 'failed').length,
    total: tasks.length
  }

  return {
    totalItems: ticketStats.total + taskStats.total,
    queuedItems: ticketStats.queued + taskStats.queued,
    inProgressItems: ticketStats.inProgress + taskStats.inProgress,
    completedItems: ticketStats.completed + taskStats.completed,
    failedItems: ticketStats.failed + taskStats.failed,
    ticketCount: ticketStats.total,
    taskCount: taskStats.total
  }
}

/**
 * Get queue items
 */
export async function getQueueItems(queueId: number): Promise<any[]> {
  return await flowService.getQueueItems(queueId)
}

/**
 * Batch enqueue items
 */
export async function batchEnqueueItems(
  queueId: number,
  items: Array<{ ticketId?: number; taskId?: number; priority: number }>
): Promise<{
  ticket?: Ticket
  tasks: TicketTask[]
}> {
  const results: { ticket?: Ticket; tasks: TicketTask[] } = { tasks: [] }

  for (const item of items) {
    if (item.ticketId) {
      const ticket = await enqueueTicket(item.ticketId, queueId, item.priority)
      if (!results.ticket) {
        results.ticket = ticket
      }
    }
    if (item.taskId) {
      const db = getSharedTestDb()
      const taskRepo = createBaseRepository(ticketTasks, db.db)
      const task = await taskRepo.getById(item.taskId)
      if (task) {
        const enqueuedTask = await enqueueTask(task.ticketId, item.taskId, queueId, item.priority)
        results.tasks.push(enqueuedTask)
      }
    }
  }

  return results
}

/**
 * Enqueue ticket with all its tasks
 */
export async function enqueueTicketWithAllTasks(
  queueId: number,
  ticketId: number,
  basePriority: number = 5
): Promise<{
  ticket: Ticket
  tasks: TicketTask[]
}> {
  // First enqueue the ticket
  const ticket = await enqueueTicket(ticketId, queueId, basePriority)

  // Get all tasks for this ticket
  const tasks = await getTasks(ticketId)
  const enqueuedTasks: TicketTask[] = []

  // Enqueue each task that's not already done
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task.done) {
      // Give tasks slightly lower priority than the parent ticket
      const taskPriority = basePriority + i + 1
      const enqueuedTask = await enqueueTask(ticketId, task.id, queueId, taskPriority)
      enqueuedTasks.push(enqueuedTask)
    }
  }

  return {
    ticket,
    tasks: enqueuedTasks
  }
}

/**
 * Move item to queue (for testing queue transfers)
 */
export async function moveItemToQueue(
  type: 'ticket' | 'task',
  itemId: number,
  targetQueueId: number | null
): Promise<void> {
  const db = getSharedTestDb()

  if (type === 'ticket') {
    const ticketRepo = createBaseRepository(tickets, db.db)
    await ticketRepo.update(itemId, {
      queueId: targetQueueId,
      queueStatus: targetQueueId ? 'queued' : null,
      queuePriority: targetQueueId ? 5 : null,
      queuedAt: targetQueueId ? Date.now() : null
    })
  } else if (type === 'task') {
    const taskRepo = createBaseRepository(ticketTasks, db.db)
    await taskRepo.update(itemId, {
      queueId: targetQueueId,
      queueStatus: targetQueueId ? 'queued' : null,
      queuePriority: targetQueueId ? 5 : null,
      queuedAt: targetQueueId ? Date.now() : null
    })
  }
}

/**
 * Test data factories for consistent test data
 */
export const testFactories = {
  project: (overrides?: Partial<CreateProject>): CreateProject => ({
    name: `Test Project ${randomBytes(4).toString('hex')}`,
    path: `/test/projects/${randomBytes(4).toString('hex')}`,
    description: 'Test project from factory',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }),

  ticket: (overrides?: Partial<CreateTicket>): CreateTicket => ({
    title: `Test Ticket ${randomBytes(4).toString('hex')}`,
    overview: 'Test ticket from factory',
    projectId: 1, // Will need to be overridden
    status: 'open',
    priority: 'normal',
    suggestedFileIds: [],
    suggestedAgentIds: [],
    suggestedPromptIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }),

  queue: (overrides?: Partial<CreateQueue>): CreateQueue => ({
    name: `Test Queue ${randomBytes(4).toString('hex')}`,
    description: 'Test queue from factory',
    projectId: 1, // Will need to be overridden
    maxParallelItems: 1,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }),

  task: (overrides?: Partial<CreateTask>): CreateTask => ({
    ticketId: 1, // Will need to be overridden
    content: `Test Task ${randomBytes(4).toString('hex')}`,
    description: 'Test task from factory',
    done: false,
    status: 'pending',
    orderIndex: 0,
    estimatedHours: null,
    dependencies: [],
    tags: [],
    agentId: null,
    suggestedFileIds: [],
    suggestedPromptIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  })
}

/**
 * Cleanup function to reset shared test context
 * This replaces the old global database cleanup
 */
export async function cleanupTestHelpers(): Promise<void> {
  cleanupTestContext()
}
