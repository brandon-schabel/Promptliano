import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { ticketStorage } from './ticket-storage'
import { projectStorage } from './project-storage'
import { DatabaseManager, getDb } from './database-manager'
import { resetDatabaseInstance } from './test-utils'
import type { Ticket, TicketTask, Project } from '@promptliano/schemas'

describe('Ticket Storage', () => {
  let db: DatabaseManager
  let testProject: Project

  beforeEach(async () => {
    // Get fresh database instance
    db = getDb()
    // Ensure migrations are run
    const { runMigrations } = await import('./migrations/run-migrations')
    await runMigrations()
    
    // Create a unique test project for each test
    const projectId = Date.now() + Math.floor(Math.random() * 1000) // Add randomness
    testProject = {
      id: projectId,
      name: 'Test Project',
      description: 'Project for testing tickets',
      path: `/test/project/${projectId}`,
      created: Date.now(),
      updated: Date.now()
    }
    // Create project using the writeProjects method since there's no direct add method
    await projectStorage.writeProjects({ [testProject.id]: testProject })
  })

  afterEach(async () => {
    // Clean up test data using our test utilities
    const { clearAllData } = await import('./test-utils')
    await clearAllData()
  })

  afterAll(() => {
    // Reset database instance to ensure complete isolation
    resetDatabaseInstance()
  })

  describe('Database Constraints', () => {
    it('should enforce CHECK constraints on ticket status', async () => {
      const ticket: Ticket = {
        id: Date.now() - 100,
        projectId: testProject.id,
        title: 'Test Ticket',
        overview: 'Test overview',
        status: 'invalid_status' as any, // Invalid status
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }

      // Should throw validation error before reaching database
      await expect(ticketStorage.addTicket(ticket)).rejects.toThrow()
    })

    it('should enforce CHECK constraints on ticket priority', async () => {
      const ticket: Ticket = {
        id: Date.now() - 200,
        projectId: testProject.id,
        title: 'Test Ticket',
        overview: 'Test overview',
        status: 'open',
        priority: 'urgent' as any, // Invalid priority (should be low|normal|high)
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }

      await expect(ticketStorage.addTicket(ticket)).rejects.toThrow()
    })

    it('should handle NOT NULL constraints on JSON fields', async () => {
      const database = db.getDatabase()

      // Try to insert with NULL JSON field directly (bypassing validation)
      const insertQuery = database.prepare(`
        INSERT INTO tickets (
          id, project_id, title, overview, status, priority,
          suggested_file_ids, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `)

      // This should fail with NOT NULL constraint
      expect(() => {
        insertQuery.run(3, 100, 'Test', '', 'open', 'normal', Date.now(), Date.now())
      }).toThrow()
    })

    it('should enforce foreign key constraint on task deletion', async () => {
      // Create a ticket
      const ticket: Ticket = {
        id: Date.now() - 400,
        projectId: testProject.id,
        title: 'Parent Ticket',
        overview: '',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTicket(ticket)

      // Create a task
      const task: TicketTask = {
        id: Date.now() - 50,
        ticketId: ticket.id,
        content: 'Test Task',
        description: '',
        suggestedFileIds: [],
        done: false,
        orderIndex: 0,
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTask(task)

      // Delete the ticket
      await ticketStorage.deleteTicketData(ticket.id)

      // Task should be deleted due to CASCADE
      const foundTask = await ticketStorage.getTaskById(task.id)
      expect(foundTask).toBeNull()
    })
  })

  describe('Transaction Rollback', () => {
    it('should rollback all changes on error in writeTickets', async () => {
      // Use testProject that was already created
      const projectId = testProject.id

      // Add initial tickets
      const ticketId1 = Date.now() - 10000
      const initialTickets = {
        [ticketId1]: {
          id: ticketId1,
          projectId,
          title: 'Initial Ticket',
          overview: '',
          status: 'open' as const,
          priority: 'normal' as const,
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
      }
      await ticketStorage.writeTickets(projectId, initialTickets)

      // Verify initial ticket was created
      const ticketsBeforeError = await ticketStorage.readTickets(projectId)
      expect(Object.keys(ticketsBeforeError)).toHaveLength(1)
      expect(ticketsBeforeError[ticketId1]).toBeDefined()

      // Try to write new set of tickets with a mismatched projectId
      // This should fail and rollback, leaving the original ticket intact
      const ticketId2 = Date.now() - 5000
      const wrongProjectId = 999999999 // Non-existent project ID
      const badTickets = {
        [ticketId2]: {
          id: ticketId2,
          projectId: wrongProjectId, // Wrong project ID
          title: 'Bad Ticket',
          overview: '',
          status: 'open' as const,
          priority: 'normal' as const,
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
      }

      // The error is wrapped, so check for the generic message
      await expect(ticketStorage.writeTickets(projectId, badTickets)).rejects.toThrow('Failed to write tickets')

      // After a failed transaction, the database should be in the same state as before
      // Since writeTickets uses DELETE then INSERT in a transaction, and the transaction
      // failed, the original tickets should still be there
      const tickets = await ticketStorage.readTickets(projectId)
      expect(Object.keys(tickets)).toHaveLength(1)
      expect(tickets[ticketId1]).toBeDefined()
    })

    it('should rollback all changes on error in writeTicketTasks', async () => {
      const ticketId = Date.now() - 20000

      // Create parent ticket first
      const ticket: Ticket = {
        id: ticketId,
        projectId: testProject.id,
        title: 'Parent Ticket',
        overview: '',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTicket(ticket)

      // Add initial task
      const taskId1 = Date.now() - 1000
      const initialTasks = {
        [taskId1]: {
          id: taskId1,
          ticketId,
          content: 'Initial Task',
          description: '',
          suggestedFileIds: [],
          done: false,
          orderIndex: 0,
          created: Date.now(),
          updated: Date.now()
        }
      }
      await ticketStorage.writeTicketTasks(ticketId, initialTasks)

      // Try to write tasks with wrong ticketId
      const taskId2 = Date.now() - 2000
      const wrongTicketId = 999999999 // Non-existent ticket ID
      const badTasks = {
        [taskId2]: {
          id: taskId2,
          ticketId: wrongTicketId, // Wrong ticket ID
          content: 'Bad Task',
          description: '',
          suggestedFileIds: [],
          done: false,
          orderIndex: 1,
          created: Date.now(),
          updated: Date.now()
        }
      }

      // The error is wrapped, so check for the generic message
      await expect(ticketStorage.writeTicketTasks(ticketId, badTasks)).rejects.toThrow('Failed to write ticket_tasks')

      // Original task should still exist after rollback
      const tasks = await ticketStorage.readTicketTasks(ticketId)
      expect(Object.keys(tasks)).toHaveLength(1)
      expect(tasks[taskId1]).toBeDefined()
    })
  })

  describe('JSON Parsing Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const database = db.getDatabase()

      // Insert ticket with malformed JSON directly
      const insertQuery = database.prepare(`
        INSERT INTO tickets (
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertQuery.run(
        30,
        testProject.id,
        'Test Ticket',
        '',
        'open',
        'normal',
        '{invalid json}', // Malformed JSON
        '[]',
        '[]',
        Date.now(),
        Date.now()
      )

      // Should handle gracefully with fallback
      const tickets = await ticketStorage.readTickets(testProject.id)
      expect(tickets['30']).toBeDefined()
      expect(tickets['30']?.suggestedFileIds).toEqual([]) // Fallback value
    })

    it('should log warnings for JSON parse failures', async () => {
      const database = db.getDatabase()
      // Note: Bun doesn't have jest.spyOn, we'll track console.warn calls manually
      const originalWarn = console.warn
      const warnCalls: any[] = []
      console.warn = (...args) => warnCalls.push(args)

      // Insert task with malformed JSON
      const insertTicketQuery = database.prepare(`
        INSERT INTO tickets (id, project_id, title, overview, status, priority, 
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      insertTicketQuery.run(40, testProject.id, 'Parent', '', 'open', 'normal', '[]', '[]', '[]', Date.now(), Date.now())

      const insertTaskQuery = database.prepare(`
        INSERT INTO ticket_tasks (
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertTaskQuery.run(
        3,
        40,
        'Test Task',
        '',
        '[]',
        0,
        0,
        null,
        'not an array', // Invalid JSON
        '{"broken": ]', // Malformed JSON
        null,
        '[]',
        Date.now(),
        Date.now()
      )

      await ticketStorage.readTicketTasks(40)

      // Restore console.warn
      console.warn = originalWarn

      // Check that warnings were logged
      expect(warnCalls.length).toBeGreaterThan(0)
      expect(warnCalls.some((args) => args[0].includes('Failed to parse JSON'))).toBe(true)
    })
  })

  describe('Concurrent Access', () => {
    it('should handle concurrent reads safely', async () => {
      // Create a unique project for this test
      const concurrentProjectId = Date.now() + 10000
      const concurrentProject: Project = {
        id: concurrentProjectId,
        name: 'Concurrent Test Project',
        description: 'Project for testing concurrent access',
        path: `/test/concurrent/${concurrentProjectId}`,
        created: Date.now(),
        updated: Date.now()
      }
      await projectStorage.writeProjects({ [concurrentProject.id]: concurrentProject })

      // Create test tickets
      const tickets: Record<string, Ticket> = {}
      for (let i = 0; i < 10; i++) {
        tickets[String(Date.now() - 5000 + i)] = {
          id: Date.now() - 5000 + i,
          projectId: concurrentProjectId,
          title: `Ticket ${i}`,
          overview: '',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
      }
      await ticketStorage.writeTickets(concurrentProjectId, tickets)

      // Concurrent reads
      const readPromises = []
      for (let i = 0; i < 5; i++) {
        readPromises.push(ticketStorage.readTickets(concurrentProjectId))
      }

      const results = await Promise.all(readPromises)

      // All reads should return the same data
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(Object.keys(result)).toHaveLength(10)
      })
    })

    it('should handle concurrent writes with proper isolation', async () => {
      // Create a unique project for concurrent writes
      const concurrentWriteProjectId = Date.now() + 20000
      const concurrentWriteProject: Project = {
        id: concurrentWriteProjectId,
        name: 'Concurrent Write Test Project',
        description: 'Project for testing concurrent writes',
        path: `/test/concurrent-write/${concurrentWriteProjectId}`,
        created: Date.now(),
        updated: Date.now()
      }
      await projectStorage.writeProjects({ [concurrentWriteProject.id]: concurrentWriteProject })

      // Create multiple tickets concurrently
      const createPromises = []
      for (let i = 0; i < 5; i++) {
        const ticket: Ticket = {
          id: Date.now() - 6000 + i,
          projectId: concurrentWriteProjectId,
          title: `Concurrent Ticket ${i}`,
          overview: '',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
        createPromises.push(ticketStorage.addTicket(ticket))
      }

      await Promise.all(createPromises)

      // Verify all tickets were created
      const tickets = await ticketStorage.readTickets(concurrentWriteProjectId)
      expect(Object.keys(tickets)).toHaveLength(5) // 5 new concurrent tickets
    })
  })

  describe('Cascade Delete Behavior', () => {
    it('should delete all tasks when deleting a project', async () => {
      // Create a separate project for this test to avoid conflicts
      const separateProjectId = Date.now() + 1000
      const separateProject: Project = {
        id: separateProjectId,
        name: 'Cascade Test Project',
        description: 'Project for testing cascade deletion',
        path: `/test/cascade/${separateProjectId}`,
        created: Date.now(),
        updated: Date.now()
      }
      await projectStorage.writeProjects({ [separateProject.id]: separateProject })

      // Create tickets with tasks
      for (let i = 0; i < 3; i++) {
        const ticket: Ticket = {
          id: Date.now() - 7000 + i,
          projectId: separateProjectId,
          title: `Ticket ${i}`,
          overview: '',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          created: Date.now(),
          updated: Date.now()
        }
        await ticketStorage.addTicket(ticket)

        // Add tasks
        for (let j = 0; j < 2; j++) {
          const task: TicketTask = {
            id: Date.now() - 7000 + (i * 1000 + j * 10),
            ticketId: ticket.id,
            content: `Task ${j}`,
            description: '',
            suggestedFileIds: [],
            done: false,
            orderIndex: j,
            created: Date.now(),
            updated: Date.now()
          }
          await ticketStorage.addTask(task)
        }
      }

      // Delete all tickets for project
      await ticketStorage.deleteProjectTickets(separateProjectId)

      // Verify all tickets and tasks are gone
      const tickets = await ticketStorage.readTickets(separateProjectId)
      expect(Object.keys(tickets)).toHaveLength(0)

      // Check tasks are also deleted
      for (let i = 0; i < 3; i++) {
        const tasks = await ticketStorage.readTicketTasks(Date.now() - 7000 + i)
        expect(Object.keys(tasks)).toHaveLength(0)
      }
    })
  })

  describe('Data Validation', () => {
    it('should validate all ticket fields', async () => {
      const invalidTicket = {
        id: 'not-a-number', // Should be number
        projectId: testProject.id,
        title: '', // Should not be empty
        overview: 123, // Should be string
        status: 'open',
        priority: 'normal',
        suggestedFileIds: 'not-an-array', // Should be array
        created: 'not-a-timestamp', // Should be number
        updated: Date.now()
      } as any

      await expect(ticketStorage.addTicket(invalidTicket)).rejects.toThrow()
    })

    it('should validate all task fields', async () => {
      // Create parent ticket
      const ticket: Ticket = {
        id: Date.now() - 8000,
        projectId: testProject.id,
        title: 'Parent',
        overview: '',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        created: Date.now(),
        updated: Date.now()
      }
      await ticketStorage.addTicket(ticket)

      const invalidTask = {
        id: 'not-a-number', // Should be number
        ticketId: ticket.id,
        content: '', // Should not be empty
        description: '',
        suggestedFileIds: [],
        done: 'yes', // Should be boolean
        orderIndex: -5, // Should be >= 0
        tags: 'not-an-array', // Should be array
        created: Date.now(),
        updated: Date.now()
      } as any

      await expect(ticketStorage.addTask(invalidTask)).rejects.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a separate project for performance testing
      const perfProjectId = Date.now() + 2000
      const perfProject: Project = {
        id: perfProjectId,
        name: 'Performance Test Project',
        description: 'Project for testing performance',
        path: `/test/performance/${perfProjectId}`,
        created: Date.now(),
        updated: Date.now()
      }
      await projectStorage.writeProjects({ [perfProject.id]: perfProject })
      
      const projectId = perfProjectId
      const ticketCount = 100
      const tasksPerTicket = 10
      const baseTicketId = Date.now() - 1000000

      // Create many tickets
      const tickets: Record<string, Ticket> = {}
      for (let i = 0; i < ticketCount; i++) {
        const ticketId = baseTicketId + i
        tickets[String(ticketId)] = {
          id: ticketId,
          projectId,
          title: `Ticket ${i}`,
          overview: `Description for ticket ${i}`,
          status: i % 3 === 0 ? 'closed' : i % 2 === 0 ? 'in_progress' : 'open',
          priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'low' : 'normal',
          suggestedFileIds: [`file${i}.ts`, `test${i}.ts`],
          suggestedAgentIds: [`agent-${Date.now() - 2000 + i}`, `agent-${Date.now() - 1000 + i}`],
          suggestedPromptIds: [Date.now() - 500 + i, Date.now() - 400 + i], // Use numbers for prompt IDs
          created: Date.now() - i * 1000,
          updated: Date.now()
        }
      }

      const startWrite = Date.now()
      await ticketStorage.writeTickets(projectId, tickets)
      const writeTime = Date.now() - startWrite

      // Should complete in reasonable time
      expect(writeTime).toBeLessThan(1000) // Less than 1 second

      // Create tasks for each ticket
      const baseTaskId = Date.now() - 500000
      for (let i = 0; i < ticketCount; i++) {
        const tasks: Record<string, TicketTask> = {}
        for (let j = 0; j < tasksPerTicket; j++) {
          const taskId = baseTaskId + i * 100 + j
          tasks[String(taskId)] = {
            id: taskId,
            ticketId: baseTicketId + i,
            content: `Task ${j} for ticket ${i}`,
            description: `Detailed description of task ${j}`,
            suggestedFileIds: [`task${taskId}.ts`],
            done: j % 2 === 0,
            orderIndex: j,
            estimatedHours: j + 1,
            dependencies: j > 0 ? [baseTaskId + i * 100 + j - 1] : [],
            tags: [`tag${j % 3}`, `priority${j % 2}`],
            created: Date.now() - j * 1000,
            updated: Date.now()
          }
        }
        await ticketStorage.writeTicketTasks(baseTicketId + i, tasks)
      }

      // Test query performance
      const startRead = Date.now()
      const readTickets = await ticketStorage.readTickets(projectId)
      const readTime = Date.now() - startRead

      expect(Object.keys(readTickets)).toHaveLength(ticketCount)
      expect(readTime).toBeLessThan(100) // Should be very fast with indexes

      // Test basic query performance
      const startQuery = Date.now()
      const retrievedTickets = await ticketStorage.readTickets(projectId)
      const queryTime = Date.now() - startQuery

      expect(Object.keys(retrievedTickets)).toHaveLength(ticketCount)
      expect(queryTime).toBeLessThan(50) // Indexed query should be fast
    })
  })
})
