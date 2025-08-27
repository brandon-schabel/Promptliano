import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { createTicketService } from './ticket-service'
import { createTestEnvironment, type TestContext } from './test-utils/test-environment'
import type {
  Ticket,
  CreateTicket as CreateTicketBody,
  UpdateTicket as UpdateTicketBody,
  TicketTask,
  CreateTask as CreateTaskBody,
  UpdateTask as UpdateTaskBody
} from '@promptliano/database'

// Create test environment for this suite
const testEnv = createTestEnvironment({
  suiteName: 'ticket-service',
  seedData: false,
  verbose: false
})

// Service instance
let ticketService: ReturnType<typeof createTicketService>

// Mock AI service
const generateStructuredDataMock = mock(async () => {
  return { object: { tasks: [{ title: 'MockTask', description: 'MockDesc' }] } }
})

mock.module('./gen-ai-services', () => ({
  generateStructuredData: generateStructuredDataMock
}))

describe('Ticket Service (Functional Factory)', () => {
  let context: TestContext
  let summaryMock: ReturnType<typeof mock>

  beforeEach(async () => {
    context = await testEnv.setupTest()
    ticketService = createTicketService()

    summaryMock = mock(async () => 'Fake project summary content')
    
    // Reset mocks
    generateStructuredDataMock.mockClear()
    summaryMock.mockClear()
  })

  afterEach(async () => {
    await testEnv.cleanupTest()
  })

  test('createTicket inserts new row', async () => {
    const project = await context.createTestProject()
    const ticketData: CreateTicketBody = {
      projectId: project.id,
      title: 'TestTicket',
      overview: 'Test overview',
      status: 'open',
      priority: 'normal'
    }

    const newTicket = await ticketService.create(ticketData)
    context.trackResource('ticket', newTicket.id)

    expect(newTicket.id).toBeDefined()
    expect(newTicket.title).toBe('TestTicket')
    expect(newTicket.projectId).toBe(project.id)

    // Test by fetching through service layer
    const found = await ticketService.getById(newTicket.id)
    expect(found.title).toBe('TestTicket')
    expect(found.projectId).toBe(project.id)
  })

  test('getTicketById throws if not found', async () => {
    await expect(ticketService.getById(99999)).rejects.toThrow('Ticket with ID 99999 not found')
  })

  test('getByProject returns tickets for specific project', async () => {
    const projectA = await context.createTestProject('A')
    const projectB = await context.createTestProject('B')

    // Insert tickets
    const ticketA1 = await ticketService.create({
      projectId: projectA.id,
      title: 'TicketA1',
      overview: 'Overview A1',
      status: 'open',
      priority: 'normal'
    })
    context.trackResource('ticket', ticketA1.id)

    const ticketA2 = await ticketService.create({
      projectId: projectA.id,
      title: 'TicketA2',
      overview: 'Overview A2',
      status: 'open',
      priority: 'normal'
    })
    context.trackResource('ticket', ticketA2.id)

    const ticketB1 = await ticketService.create({
      projectId: projectB.id,
      title: 'TicketB1',
      overview: 'Overview B1',
      status: 'open',
      priority: 'normal'
    })
    context.trackResource('ticket', ticketB1.id)

    const forA = await ticketService.getByProject(projectA.id)
    expect(forA.length).toBe(2)

    const forB = await ticketService.getByProject(projectB.id)
    expect(forB.length).toBe(1)
  })

  test('update modifies ticket fields', async () => {
    const project = await context.createTestProject()
    const ticket = await ticketService.create({
      projectId: project.id,
      title: 'Old',
      overview: 'Old overview',
      status: 'open',
      priority: 'normal'
    })
    context.trackResource('ticket', ticket.id)

    const updated = await ticketService.update(ticket.id, {
      title: 'NewTitle',
      status: 'closed'
    })

    expect(updated).not.toBeNull()
    expect(updated.title).toBe('NewTitle')
    expect(updated.status).toBe('closed')

    // Test updating non-existent ticket
    await expect(ticketService.update(99999, { title: 'No' })).rejects.toThrow('Ticket with ID 99999 not found')
  })

  test('delete removes ticket', async () => {
    const project = await context.createTestProject()
    const ticket = await ticketService.create({
      projectId: project.id,
      title: 'DelMe',
      overview: 'Delete me overview',
      status: 'open',
      priority: 'normal'
    })

    // Don't track this resource since we're testing deletion
    const success = await ticketService.delete(ticket.id)
    expect(success).toBe(true)

    await expect(ticketService.getById(ticket.id)).rejects.toThrow('Ticket with ID')

    // Try deleting again - should return false or throw
    await expect(ticketService.delete(ticket.id)).rejects.toThrow('Ticket with ID')
  })

  describe('Task Management', () => {
    let project: any
    let ticket: Ticket

    beforeEach(async () => {
      project = await context.createTestProject('tasks')
      ticket = await context.createTestTicket(project.id)
    })

    test('getWithTasks includes task data', async () => {
      const ticketWithTasks = await ticketService.getWithTasks(ticket.id)
      
      expect(ticketWithTasks).toBeDefined()
      expect(ticketWithTasks.id).toBe(ticket.id)
      expect(Array.isArray(ticketWithTasks.tasks)).toBe(true)
    })

    test('task operations work through service', async () => {
      // Note: This is a simplified test since task operations 
      // depend on the task repository integration
      const ticketWithTasks = await ticketService.getWithTasks(ticket.id)
      expect(ticketWithTasks.tasks).toBeDefined()
    })
  })

  describe('Complex Operations', () => {
    test('service supports extended operations', async () => {
      const project = await context.createTestProject('complex')
      
      // Test that service has the expected methods
      expect(typeof ticketService.getByProject).toBe('function')
      expect(typeof ticketService.getWithTasks).toBe('function')
      expect(typeof ticketService.create).toBe('function')
      expect(typeof ticketService.update).toBe('function')
      expect(typeof ticketService.delete).toBe('function')
      expect(typeof ticketService.getById).toBe('function')
    })

    test('handles service dependencies gracefully', async () => {
      const project = await context.createTestProject('deps')
      
      // Test that service methods exist and are callable
      const tickets = await ticketService.getByProject(project.id)
      expect(Array.isArray(tickets)).toBe(true)
    })
  })
})